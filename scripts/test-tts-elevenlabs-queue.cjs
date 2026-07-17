const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "tts.js"), "utf8");
const start = source.indexOf("TTS.ElevenLabsTTS =");
const end = source.indexOf("TTS.pcm16ToWav =", start);
assert.ok(start >= 0 && end > start, "ElevenLabs implementation must be extractable");
const implementation = source.slice(start, end);

function createHarness(fetchImpl, overrides = {}) {
    let finished = 0;
    const TTS = {
        premiumQueueActive: false,
        ElevenLabsKey: "test-key",
        elevenLabsSettings: {
            voiceName: "test-voice",
            latency: 1,
            model: "test-model",
            stability: 0.5,
            similarity: 0.5,
            style: 0,
            speakerBoost: true,
            speakingRate: 1,
        },
        neuroSyncEnabled: false,
        playAudioBlobAndWait: async () => true,
        sendToNeuroSync: async () => true,
        finishedAudio: () => {
            finished++;
            TTS.premiumQueueActive = false;
        },
        ...overrides,
    };
    const sandbox = vm.createContext({
        TTS,
        fetch: fetchImpl,
        console: { error() {}, warn() {} },
        JSON,
        Error,
    });
    vm.runInContext(implementation, sandbox);
    return { TTS, getFinished: () => finished };
}

async function run() {
    const failedRequest = createHarness(async () => ({
        ok: false,
        status: 429,
        blob: async () => ({ size: 100 }),
    }));
    await failedRequest.TTS.ElevenLabsTTS("rate limited");
    assert.equal(failedRequest.getFinished(), 1, "HTTP errors must release the premium queue");
    assert.equal(failedRequest.TTS.premiumQueueActive, false);

    let playbackCalls = 0;
    const rejectedPlayback = createHarness(
        async () => ({ ok: true, status: 200, blob: async () => ({ size: 100 }) }),
        {
            playAudioBlobAndWait: async () => {
                playbackCalls++;
                throw new Error("play rejected");
            },
        },
    );
    await rejectedPlayback.TTS.ElevenLabsTTS("cannot play");
    assert.equal(playbackCalls, 1);
    assert.equal(rejectedPlayback.getFinished(), 1, "playback errors must release the premium queue");
    assert.equal(rejectedPlayback.TTS.premiumQueueActive, false);

    let neuroSyncCalls = 0;
    const neuroSync = createHarness(
        async () => ({ ok: true, status: 200, blob: async () => ({ size: 100 }) }),
        {
            neuroSyncEnabled: true,
            sendToNeuroSync: async () => {
                neuroSyncCalls++;
            },
        },
    );
    await neuroSync.TTS.ElevenLabsTTS("neurosync");
    assert.equal(neuroSyncCalls, 1);
    assert.equal(neuroSync.getFinished(), 1, "NeuroSync completion must release the premium queue");

    console.log("PASS ElevenLabs queue recovery");
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
