const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const kokoroAssets = require(path.join(repoRoot, "shared", "ai", "kokoroAssetCatalog.js"));
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const ttsJs = fs.readFileSync(path.join(repoRoot, "tts.js"), "utf8");
const bundleWeb = fs.readFileSync(path.join(repoRoot, "thirdparty", "kokoro-bundle.es.js"), "utf8");
const bundleExtension = fs.readFileSync(path.join(repoRoot, "thirdparty", "kokoro-bundle.es.ext.js"), "utf8");

assert.strictEqual(kokoroAssets.getRemoteHost(), "https://largefiles.socialstream.ninja/");
assert.strictEqual(
	kokoroAssets.getModelUrl("q8"),
	"https://largefiles.socialstream.ninja/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx"
);
assert.strictEqual(
	kokoroAssets.getModelUrl("fp16"),
	"https://largefiles.socialstream.ninja/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_fp16.onnx"
);
assert.strictEqual(
	kokoroAssets.getVoiceUrl("af_aoede"),
	"https://largefiles.socialstream.ninja/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_aoede.bin"
);
assert.strictEqual(kokoroAssets.getPreferredDtype("wasm"), "q8");
assert.strictEqual(kokoroAssets.getPreferredDtype("webgpu"), "fp16");
assert.strictEqual(new Set(kokoroAssets.voices).size, kokoroAssets.voices.length);
assert.strictEqual(kokoroAssets.voices.length, 28);
assert.ok(kokoroAssets.getAllAssetPaths().includes("onnx/model_quantized.onnx"));
assert.ok(kokoroAssets.getAllAssetPaths().includes("onnx/model_fp16.onnx"));
assert.ok(!kokoroAssets.getAllAssetPaths().includes("onnx/model.onnx"));
assert.ok(popupHtml.includes("./shared/ai/kokoroAssetCatalog.js"));
assert.ok(!popupJs.includes("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx"));
assert.ok(!ttsJs.includes("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx"));
assert.ok(ttsJs.includes('window.SSN_KOKORO_REMOTE_HOST = kokoroAssets.getRemoteHost();'));
assert.ok(ttsJs.includes('dtype: kokoroAssets.getPreferredDtype(device),'));
assert.ok(!bundleWeb.includes("https://cdn.jsdelivr.net/npm/@huggingface/transformers@"));
assert.ok(!bundleWeb.includes('remoteHost: "https://huggingface.co/"'));
assert.ok(!bundleExtension.includes('remoteHost: "https://huggingface.co/"'));
assert.ok(!bundleWeb.includes("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/"));
assert.ok(!bundleExtension.includes("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/"));
assert.ok(!bundleWeb.includes('["huggingface.co", "hf.co"]'));
assert.ok(!bundleExtension.includes('["huggingface.co", "hf.co"]'));
assert.ok(bundleWeb.includes('["largefiles.socialstream.ninja"]'));
assert.ok(bundleExtension.includes('["largefiles.socialstream.ninja"]'));

console.log("PASS kokoro local asset wiring");
