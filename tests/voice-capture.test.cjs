const test = require("node:test"),
	assert = require("node:assert/strict"),
	vm = require("vm"),
	fs = require("fs"),
	path = require("path");
async function capture() {
	let listener,
		processor,
		now = 0;
	const sent = [];
	const node = () => ({ connect() {}, disconnect() {} });
	class AudioContext {
		constructor() {
			this.sampleRate = 16000;
		}
		resume() {}
		close() {
			return Promise.resolve();
		}
		createMediaStreamSource() {
			return node();
		}
		createGain() {
			return { ...node(), gain: { value: 1 } };
		}
		createScriptProcessor() {
			processor = node();
			return processor;
		}
	}
	const track = { stop() {} };
	const context = { window: { voiceCapture: { onControl: fn => (listener = fn), send: async (kind, data) => sent.push({ kind, data }) } }, navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) } }, AudioContext, Float32Array, performance: { now: () => now } };
	vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../ssapp/voice-capture.js"), "utf8"), context);
	await listener({ epoch: 1 });
	return {
		sent,
		feed(seconds, amplitude) {
			for (let t = 0; t < seconds; t += 2048 / 16000) {
				now += 128;
				processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(2048).fill(amplitude) } });
			}
		}
	};
}
test("A short utterance is submitted after a pause", async () => {
	const c = await capture();
	c.feed(1, 0.1);
	c.feed(0.6, 0);
	assert.equal(c.sent.filter(s => s.kind === "audio").length, 1);
});
test("Long continuous speech is never submitted as isolated command fragments", async () => {
	const c = await capture();
	c.feed(6, 0.1);
	c.feed(0.6, 0);
	assert.equal(c.sent.filter(s => s.kind === "audio").length, 0);
	c.feed(1, 0.1);
	c.feed(0.6, 0);
	assert.equal(c.sent.filter(s => s.kind === "audio").length, 1, "Listening recovers after a pause");
});
