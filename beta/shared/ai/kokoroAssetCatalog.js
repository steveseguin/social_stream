(function(root, factory) {
	var api = factory(root);
	if (typeof module !== "undefined" && module.exports) {
		module.exports = api;
	}
	root.SSNKokoroAssets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root) {
	var DEFAULT_REMOTE_HOST = "https://largefiles.socialstream.ninja/";
	var MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
	var RESOLVE_PREFIX = MODEL_ID + "/resolve/main/";
	var MODEL_FILES = [
		"config.json",
		"tokenizer.json",
		"tokenizer_config.json",
		"onnx/model_fp16.onnx",
		"onnx/model_quantized.onnx"
	];
	var DTYPE_SUFFIXES = {
		fp32: "",
		fp16: "_fp16",
		int8: "_int8",
		uint8: "_uint8",
		q8: "_quantized",
		q4: "_q4",
		q4f16: "_q4f16"
	};
	var VOICES = [
		"af_heart",
		"af_alloy",
		"af_aoede",
		"af_bella",
		"af_jessica",
		"af_kore",
		"af_nicole",
		"af_nova",
		"af_river",
		"af_sarah",
		"af_sky",
		"am_adam",
		"am_echo",
		"am_eric",
		"am_fenrir",
		"am_liam",
		"am_michael",
		"am_onyx",
		"am_puck",
		"am_santa",
		"bf_emma",
		"bf_isabella",
		"bm_george",
		"bm_lewis",
		"bf_alice",
		"bf_lily",
		"bm_daniel",
		"bm_fable"
	];

	function normalizeBase(value) {
		var normalized = value || DEFAULT_REMOTE_HOST;
		return /\/$/.test(normalized) ? normalized : normalized + "/";
	}

	function getRemoteHost(value) {
		return normalizeBase(value || (root && root.SSN_KOKORO_REMOTE_HOST) || DEFAULT_REMOTE_HOST);
	}

	function getResolveBase(value) {
		return getRemoteHost(value) + RESOLVE_PREFIX;
	}

	function getModelFile(dtype) {
		var suffix = DTYPE_SUFFIXES.hasOwnProperty(dtype) ? DTYPE_SUFFIXES[dtype] : DTYPE_SUFFIXES.fp32;
		return "onnx/model" + suffix + ".onnx";
	}

	function getModelUrl(dtype, value) {
		return getResolveBase(value) + getModelFile(dtype);
	}

	function getVoiceUrl(voice, value) {
		return getResolveBase(value) + "voices/" + voice + ".bin";
	}

	function getPreferredDtype(device) {
		return device === "webgpu" ? "fp16" : "q8";
	}

	function getAllAssetPaths() {
		return MODEL_FILES.concat(VOICES.map(function(voice) {
			return "voices/" + voice + ".bin";
		}));
	}

	return {
		defaultRemoteHost: DEFAULT_REMOTE_HOST,
		modelId: MODEL_ID,
		resolvePrefix: RESOLVE_PREFIX,
		modelFiles: MODEL_FILES.slice(),
		dtypeSuffixes: Object.assign({}, DTYPE_SUFFIXES),
		voices: VOICES.slice(),
		getRemoteHost: getRemoteHost,
		getResolveBase: getResolveBase,
		getModelFile: getModelFile,
		getModelUrl: getModelUrl,
		getVoiceUrl: getVoiceUrl,
		getPreferredDtype: getPreferredDtype,
		getAllAssetPaths: getAllAssetPaths
	};
});
