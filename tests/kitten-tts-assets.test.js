const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const ttsJs = fs.readFileSync(path.join(repoRoot, "tts.js"), "utf8");

assert.ok(ttsJs.includes("const kittenWasmPaths = {"));
assert.ok(ttsJs.includes("wasm: baseUrl + '/thirdparty/kitten-tts/ort-wasm-simd-threaded.jsep.wasm'"));
assert.ok(ttsJs.includes("await TTS.kittenInstance.init(modelUrl, voicesUrl, kittenWasmPaths);"));
assert.ok(!ttsJs.includes("ort.env.wasm.wasmPaths = baseUrl + '/thirdparty/kitten-tts/';"));

console.log("PASS kitten TTS asset wiring");
