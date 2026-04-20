const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const piperFile = fs.readFileSync(path.join(repoRoot, "thirdparty", "piper", "piper-tts-web.js"), "utf8");
const properPiperFile = fs.readFileSync(path.join(repoRoot, "thirdparty", "piper", "piper-tts-proper.js"), "utf8");

assert.ok(!piperFile.includes("https://huggingface.co/diffusionstudio/piper-voices/resolve/main"));
assert.ok(!piperFile.includes("https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/"));
assert.ok(!piperFile.includes("https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize"));
assert.ok(piperFile.includes('const DEFAULT_REMOTE_PIPER_BASE = "https://largefiles.socialstream.ninja/piper";'));
assert.ok(piperFile.includes('const ONNX_BASE = new URL("../transformersjs/ort/", import.meta.url).href;'));
assert.ok(piperFile.includes('const WASM_BASE = new URL("./piper_phonemize", import.meta.url).href;'));
assert.ok(piperFile.includes('const LOCAL_PIPER_BASE = trimTrailingSlash(new URL("./piper-voices/", import.meta.url).href);'));
assert.ok(piperFile.includes("getVoiceAssetCandidates(this.voiceId"));
assert.ok(piperFile.includes("return Object.values(LOCAL_VOICES_JSON.default);"));
assert.ok(!properPiperFile.includes("https://steveseguin.github.io/piper"));
assert.ok(properPiperFile.includes("const DEFAULT_REMOTE_PIPER_BASE = 'https://largefiles.socialstream.ninja/piper';"));
assert.ok(properPiperFile.includes("window.SSN_PIPER_REMOTE_BASE || window.ProperPiperRemoteBaseUrl || window.PIPER_REMOTE_BASE_URL"));

console.log("PASS piper local asset wiring");
