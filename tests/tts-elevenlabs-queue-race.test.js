const assert = require("assert");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");

function createWavTone(durationSeconds = 0.8, sampleRate = 8000) {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index++) {
    const sample = Math.round(
      Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 5000,
    );
    wav.writeInt16LE(sample, 44 + index * 2);
  }

  return wav;
}

async function run() {
  const audio = createWavTone();
  const requests = [];
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  let result;
  try {
    const page = await browser.newPage();
    await page.route("https://api.elevenlabs.io/**", async (route) => {
      requests.push(JSON.parse(route.request().postData()).text);
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: audio,
      });
    });

    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ path: path.join(repoRoot, "tts.js") });

    result = await page.evaluate(async () => {
      TTS.TTSProvider = "elevenlabs";
      TTS.ElevenLabsKey = "test-key";
      TTS.speech = true;
      TTS.audio = document.createElement("audio");
      TTS.audio.onended = TTS.finishedAudio;

      let playingCount = 0;
      TTS.audio.addEventListener("playing", () => {
        playingCount++;
      });

      function send(id, name, message) {
        TTS.speechMeta({
          id,
          type: "youtube",
          chatname: name,
          chatmessage: message,
        });
      }

      function waitFor(condition, timeoutMs = 5000) {
        const startedAt = Date.now();
        return new Promise((resolve, reject) => {
          const check = () => {
            if (condition()) {
              resolve();
            } else if (Date.now() - startedAt >= timeoutMs) {
              reject(new Error("Timed out waiting for ElevenLabs playback"));
            } else {
              setTimeout(check, 10);
            }
          };
          check();
        });
      }

      send(1, "person one", "first message");
      await new Promise((resolve) => setTimeout(resolve, 50));
      send(2, "person two", "second message");

      await waitFor(() => playingCount === 2);
      const activeBeforeThird = TTS.premiumQueueActive;

      send(3, "person three", "third message");
      await new Promise((resolve) => setTimeout(resolve, 150));

      return {
        activeBeforeThird,
        playingCount,
        queuedAfterThird: TTS.premiumQueueTTS.length,
      };
    });
  } finally {
    await browser.close();
  }

  assert.strictEqual(
    result.activeBeforeThird,
    true,
    "the ElevenLabs queue must remain active while the second message is playing",
  );
  assert.strictEqual(
    requests.length,
    2,
    "the third ElevenLabs request must wait until the second audio finishes",
  );
  assert.strictEqual(
    result.playingCount,
    2,
    "the third message must not replace the currently playing second message",
  );
  assert.strictEqual(
    result.queuedAfterThird,
    1,
    "the third message must remain queued behind the second message",
  );

  console.log("PASS ElevenLabs pause-before-ended queue regression");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
