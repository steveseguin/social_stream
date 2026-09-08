const test = require("node:test"),
	assert = require("node:assert/strict"),
	fs = require("fs"),
	os = require("os"),
	path = require("path");
const create = require("../../ssapp/voice-native-whisper");
function fixture() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ssn-voice-download-"));
	const previous = process.env.SSAPP_NATIVE_WHISPER_CACHE_DIR;
	try {
		process.env.SSAPP_NATIVE_WHISPER_CACHE_DIR = root;
		return create({ app: { getPath: () => root } });
	} finally {
		if (previous === undefined) delete process.env.SSAPP_NATIVE_WHISPER_CACHE_DIR;
		else process.env.SSAPP_NATIVE_WHISPER_CACHE_DIR = previous;
	}
}
test("A corrupt native runtime download is rejected before execution", async () => {
	const original = global.fetch;
	try {
		global.fetch = async () => new Response("corrupt runtime");
		await assert.rejects(fixture().transcribe(new Float32Array(8000).buffer), /integrity check/);
	} finally {
		global.fetch = original;
	}
});
test("An oversized native runtime download is rejected", async () => {
	const original = global.fetch;
	try {
		global.fetch = async () => new Response(new Uint8Array(12000001));
		await assert.rejects(fixture().transcribe(new Float32Array(8000).buffer), /size limit/);
	} finally {
		global.fetch = original;
	}
});
test("Stop aborts a pending native download", async () => {
	const original = global.fetch;
	let began;
	const started = new Promise(r => (began = r));
	try {
		global.fetch = async (_url, { signal }) => {
			began();
			return await new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(Error("aborted")), { once: true }));
		};
		const native = fixture(),
			pending = native.transcribe(new Float32Array(8000).buffer);
		const check = assert.rejects(pending, /aborted/);
		await started;
		native.stop();
		await check;
	} finally {
		global.fetch = original;
	}
});
