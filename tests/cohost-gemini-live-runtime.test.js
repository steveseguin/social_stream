const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      window.__geminiSockets = [];
      window.__geminiMessages = [];

      class MockGeminiSocket {
        constructor(url) {
          this.url = url;
          this.readyState = MockGeminiSocket.CONNECTING;
          this.listeners = {};
          window.__geminiSockets.push(this);
          setTimeout(() => {
            if (this.readyState !== MockGeminiSocket.CONNECTING) return;
            this.readyState = MockGeminiSocket.OPEN;
            this.dispatch("open", { target: this });
          }, 0);
        }
        addEventListener(type, callback, options) {
          if (!this.listeners[type]) this.listeners[type] = [];
          this.listeners[type].push({ callback, once: !!(options && options.once) });
        }
        dispatch(type, event) {
          const propertyHandler = this["on" + type];
          if (typeof propertyHandler === "function") propertyHandler(event);
          const listeners = (this.listeners[type] || []).slice();
          this.listeners[type] = (this.listeners[type] || []).filter(listener => !listener.once);
          listeners.forEach(listener => listener.callback(event));
        }
        emit(message) {
          if (typeof this.onmessage === "function") {
            this.onmessage({ data: JSON.stringify(message), target: this });
          }
        }
        send(value) {
          const message = JSON.parse(value);
          window.__geminiMessages.push({ socket: window.__geminiSockets.indexOf(this), message });
          if (message.setup) {
            const socketIndex = window.__geminiSockets.indexOf(this);
            setTimeout(() => {
              if (this.readyState !== MockGeminiSocket.OPEN) return;
              this.emit({ sessionResumptionUpdate: { resumable: true, newHandle: "resume-" + socketIndex } });
              this.emit({ setupComplete: {} });
            }, 20);
          }
        }
        close(code = 1000, reason = "") {
          if (this.readyState === MockGeminiSocket.CLOSED) return;
          this.readyState = MockGeminiSocket.CLOSED;
          this.dispatch("close", { code, reason, target: this });
        }
        serverClose(code, reason) {
          this.close(code, reason);
        }
      }
      MockGeminiSocket.CONNECTING = 0;
      MockGeminiSocket.OPEN = 1;
      MockGeminiSocket.CLOSING = 2;
      MockGeminiSocket.CLOSED = 3;
      window.WebSocket = MockGeminiSocket;

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          enumerateDevices: async () => [],
          getUserMedia: async () => new MediaStream(),
          getDisplayMedia: async () => new MediaStream(),
          addEventListener() {},
          removeEventListener() {}
        }
      });
    });

    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "cohost.html")).href);
    await page.waitForFunction(() => document.getElementById("providerSelect"));
    await page.selectOption("#providerSelect", "gemini");
    await page.fill("#apiKey", "mock-gemini-key");
    await page.check("#greetOnConnect");
    await page.click("#startButton");
    await page.waitForFunction(() => document.getElementById("startButton").textContent.trim() === "Stop Co-host");
    await page.waitForFunction(() => window.__geminiMessages.some(entry => entry.message.clientContent));

    assert.strictEqual(await page.evaluate(() => window.__geminiSockets.length), 1);
    assert.strictEqual(await page.evaluate(() => window.__geminiMessages.filter(entry => entry.message.clientContent).length), 1, "Gemini should greet once");
    const initialSetup = await page.evaluate(() => window.__geminiMessages.find(entry => entry.message.setup).message.setup);
    assert.deepStrictEqual(initialSetup.generationConfig.responseModalities, ["AUDIO"]);
    assert.deepStrictEqual(initialSetup.outputAudioTranscription, {});

    await page.evaluate(() => window.__geminiSockets[0].serverClose(1011, "DEADLINE_EXCEEDED"));
    await page.waitForFunction(() => window.__geminiSockets.length === 2, null, { timeout: 5000 });
    await page.waitForFunction(() => window.__geminiMessages.filter(entry => entry.message.setup).length === 2);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(await page.evaluate(() => window.__geminiMessages.filter(entry => entry.message.clientContent).length), 1, "Gemini must not greet again after reconnecting");

    const responseState = await page.evaluate(async () => {
      publisher.pendingAudioResponse = true;
      publisher.audioPlayer.samples = new Float32Array([0.25, -0.25]);
      publisher.audioPlayer.setPlaybackActive(true);
      await publisher.handleMessage({ data: JSON.stringify({ serverContent: { interrupted: true } }) });
      const interrupted = {
        active: publisher.responseActive,
        pendingAudio: publisher.pendingAudioResponse,
        bufferedSamples: publisher.audioPlayer.samples.length,
        playbackActive: publisher.audioPlayer.playbackActive
      };
      publisher.responseActive = true;
      publisher.pendingModelTextResponse = "finished";
      await publisher.handleMessage({ data: JSON.stringify({ serverContent: { generationComplete: true } }) });
      return {
        interrupted,
        completed: {
          active: publisher.responseActive,
          pendingText: publisher.pendingModelTextResponse
        }
      };
    });
    assert.deepStrictEqual(responseState.interrupted, { active: false, pendingAudio: false, bufferedSamples: 0, playbackActive: false });
    assert.deepStrictEqual(responseState.completed, { active: false, pendingText: "" });

    const textOnlyState = await page.evaluate(async () => {
      document.getElementById("responseType").value = "text";
      publisher.pendingModelTextResponse = "";
      publisher.audioPlayer.stop();
      await publisher.handleMessage({
        data: JSON.stringify({
          serverContent: {
            modelTurn: {
              parts: [
                { text: "internal model thought", thought: true },
                { inlineData: { mimeType: "audio/pcm;rate=24000", data: "AAA=" } }
              ]
            },
            outputTranscription: { text: "Visible transcript." },
            generationComplete: true
          }
        })
      });
      return {
        bufferedSamples: publisher.audioPlayer.samples.length,
        playbackActive: publisher.audioPlayer.playbackActive,
        lastMessage: publisher.conversationHistory[publisher.conversationHistory.length - 1]
      };
    });
    assert.strictEqual(textOnlyState.bufferedSamples, 0, "Text-only Gemini mode must not queue native audio playback");
    assert.strictEqual(textOnlyState.playbackActive, false, "Text-only Gemini mode must keep playback stopped");
    assert.strictEqual(textOnlyState.lastMessage.role, "assistant");
    assert.strictEqual(textOnlyState.lastMessage.content, "Visible transcript.");

    await page.evaluate(() => window.__geminiSockets[1].serverClose(1011, "RESOURCE_EXHAUSTED: quota"));
    await page.waitForFunction(() => document.getElementById("startButton").textContent.trim() === "Start Co-host");
    assert.strictEqual(await page.evaluate(() => window.__geminiSockets.length), 2, "A confirmed quota failure should require a manual restart");
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await browser.close();
  }

  console.log("Gemini Live mocked runtime passed.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
