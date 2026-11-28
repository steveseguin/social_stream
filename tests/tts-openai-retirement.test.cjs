"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "tts.js"), "utf8");
const official = "https://api.openai.com/v1/audio/speech";
const local = "http://127.0.0.1:8800/v1/audio/speech";

function startDockTts(params) {
    const callbacks = {};
    const attrs = new Map();
    const button = {
        style: {}, dataset: {}, classList: { remove() {} },
        setAttribute(k, v) { attrs.set(k, v); }, removeAttribute(k) { attrs.delete(k); },
        addEventListener() {}
    };
    const requests = [];
    const ctx = {
        Blob, URL, URLSearchParams, setTimeout, clearTimeout,
        AudioContext: class { constructor() { this.state = "running"; } },
        console: { warn() {}, error(...args) { throw new Error(args.join(" ")); } },
        document: {
            addEventListener(name, fn) { callbacks[name] = fn; },
            getElementById(id) { return id === "tts" ? button : null; },
            head: { appendChild() {} },
            createElement() { return {}; }
        },
        location: { protocol: "https:", search: "?" + new URLSearchParams({ speech: "en-US", ...params }) },
        fetch: async (url, init) => {
            requests.push({ url, method: init.method, body: JSON.parse(init.body), auth: init.headers.Authorization });
            return new Response(new Blob(["audio fixture"]), { headers: { "Content-Type": "audio/wav" } });
        }
    };
    ctx.window = ctx;
    vm.runInNewContext(source, ctx, { filename: "tts.js" });
    callbacks.DOMContentLoaded();
    return { TTS: ctx.TTS, button, attrs, requests };
}

(async () => {
    const configs = [
        [{ ttsprovider: "openai", openaikey: "fixture", voiceopenai: "onyx" }, official, "tts-1", "onyx", "mp3", 1, true],
        [{ ttsprovider: "openai", openaikey: "fixture", openaimodel: "custom", openaicustommodelx: "gpt-4o-mini-tts-2025-12-15", openaiformat: "wav" }, official, "gpt-4o-mini-tts-2025-12-15", "alloy", "wav", 1, true],
        [{ ttsprovider: "customtts", openaiendpoint: local, openaimodel: "tts-1-hd", voiceopenai: "me", openaiformat: "wav", openaispeed: "1.25" }, local, "tts-1-hd", "me", "wav", 1.25, false],
        [{ ttsprovider: "localtts", localttsendpoint: local, localttsmodel: "tts-1", localttsvoice: "local", localttsformat: "wav", localttsspeed: "0.75" }, local, "tts-1", "local", "wav", 0.75, false],
        [{ ttsprovider: "openai", openaiendpoint: local, openaimodel: "tts-1-hd", voiceopenai: "custom", openaicustomvoice: "myvoice", openaiformat: "wav" }, local, "tts-1-hd", "myvoice", "wav", 1, false],
        [{ ttsprovider: "openai", openaikey: "fixture", openaimodel: "other-model" }, official, "other-model", "alloy", "mp3", 1, false],
    ];
    for (const [params, url, model, voice, format, speed, warn] of configs) {
        const { TTS, button, attrs, requests } = startDockTts(params);
        assert.equal(TTS.TTSProvider, "openai");
        assert.equal(attrs.has("data-tts-warning"), warn);
        assert.equal(button.title.includes("January 6, 2027"), warn);
        let timer;
        const playback = new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(Error("TTS did not reach playback")), 1000);
            TTS.playAudioBlob = resolve;
        });
        TTS.speak("Test audio", true);
        const audio = await playback.finally(() => clearTimeout(timer));
        assert.equal(await audio.text(), "audio fixture");
        assert.deepEqual(requests, [{ url, method: "POST",
            body: { model, input: "Test audio", voice, response_format: format, speed },
            auth: url === official ? "Bearer fixture" : undefined }]);
    }
    const popup = fs.readFileSync(path.join(root, "popup.html"), "utf8");
    const guide = fs.readFileSync(path.join(root, "docs/tts-setup-guide.html"), "utf8");
    assert.equal((popup.match(/tts-setup-guide\.html#openai-retirement/g) || []).length, 4);
    assert.match(guide, /id="openai-retirement"/);
    console.log("PASS six Dock URL configurations, exact mocked Speech requests and playback handoff, and four popup guide links");
})().catch(error => { console.error(error); process.exitCode = 1; });
