"use strict";
const test = require("node:test"),
	assert = require("node:assert/strict"),
	{ EventEmitter } = require("node:events");
const install = require("../../ssapp/voice-control-service");
const delay = ms => new Promise(r => setTimeout(r, ms));
function fixture() {
	const handles = {},
		sent = [];
	let win,
		resolveRecognition,
		slow = false;
	class Window extends EventEmitter {
		constructor() {
			super();
			win = this;
			this.dead = false;
			this.webContents = new EventEmitter();
			this.webContents.isCrashed = () => false;
			Object.assign(this.webContents, { mainFrame: {}, session: { setPermissionRequestHandler() {} }, setWindowOpenHandler() {}, send: (channel, data) => sent.push({ channel, data }) });
		}
		isDestroyed() {
			return this.dead;
		}
		async loadFile() {}
		destroy() {
			this.dead = true;
			this.emit("closed");
		}
	}
	const controller = { url: "file:///background.html", detached: false, send: (channel, data) => sent.push({ channel, data }) };
	const service = install({
		app: new EventEmitter(),
		BrowserWindow: Window,
		ipcMain: { handle: (name, fn) => (handles[name] = fn) },
		isControl: e => e.role === "control",
		isBackground: e => e.role === "background",
		isSpeechPage: e => e.role === "speech",
		sourceRoot: () => null,
		transcribe: async (_, audio) => {
			if (audio.byteLength === 32000) return { text: "" };
			if (slow) return await new Promise(r => (resolveRecognition = r));
			return { text: "Ninja celebration!" };
		}
	});
	const call = (action, options) => handles["voice:control"]({ role: "control", senderFrame: { url: "file:///voice-control.html" } }, action, options);
	const capture = (kind, data) => handles["voice:capture"]({ sender: win.webContents, senderFrame: win.webContents.mainFrame }, kind, data);
	const commands = () => sent.filter(s => s.channel === "voice:command");
	let epoch;
	return {
		handles,
		call,
		capture,
		commands,
		controller,
		service,
		setSlow: () => (slow = true),
		resolve: () => resolveRecognition({ text: "Ninja celebration!" }),
		crash: () => win.webContents.emit("render-process-gone"),
		crashWithoutEvent: () => {
			win.webContents.isCrashed = () => true;
		},
		breakCaptureSend: () => {
			win.webContents.send = () => {
				throw Error("Render frame was disposed");
			};
		},
		async start() {
			await handles["voice:sync"]({ role: "background", senderFrame: controller }, [{ flowId: "a", nodeId: "b", phrase: "ninja celebration", cooldown: 5 }]);
			await call("start");
			epoch = sent.filter(s => s.channel === "voice:capture-control" && s.data.epoch !== undefined).at(-1).data.epoch;
			await capture("ready", { epoch });
		},
		audio: () => capture("audio", { epoch, audio: new Float32Array(16000).buffer, trailingMs: 0 })
	};
}
test("Test mode, exact command matching and cooldown", async () => {
	const f = fixture();
	await f.start();
	await f.audio();
	assert.equal(f.commands().length, 0);
	await f.call("arm", { armed: true });
	await f.audio();
	await f.audio();
	assert.equal(f.commands().length, 1);
	assert.equal(f.commands()[0].data.nodeId, "b");
});
test("Stop discards recognition already in progress", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.setSlow();
	const pending = f.audio();
	await f.call("stop");
	f.resolve();
	await pending;
	assert.equal(f.commands().length, 0);
	assert.equal((await f.call("status")).phase, "stopped");
});
test("Stop completes even when the microphone frame is already gone", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.breakCaptureSend();
	await f.call("stop");
	assert.equal((await f.call("status")).phase, "stopped");
	assert.equal((await f.call("status")).armed, false);
});
test("A crashed microphone stops even without Electron's crash event", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.setSlow();
	const pending = f.audio();
	f.crashWithoutEvent();
	f.resolve();
	await pending;
	assert.equal(f.commands().length, 0);
	assert.equal((await f.call("status")).phase, "stopped");
	assert.equal((await f.call("status")).armed, false);
	await f.start();
	assert.equal((await f.call("status")).phase, "listening");
});
test("Arming does not promote speech recorded in Test mode", async () => {
	const f = fixture();
	await f.start();
	f.setSlow();
	const pending = f.audio();
	await f.call("arm", { armed: true });
	f.resolve();
	await pending;
	assert.equal(f.commands().length, 0);
});
test("Recognition older than two seconds expires", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.setSlow();
	const pending = f.audio();
	await delay(2050);
	f.resolve();
	await pending;
	assert.equal(f.commands().length, 0);
	assert.match((await f.call("status")).message, /too slow/);
});
test("SSApp playback suppresses commands", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	await f.handles["voice:playback"]({ role: "speech", sender: { id: 1 }, senderFrame: { routingId: 2 } }, true);
	await f.audio();
	assert.equal(f.commands().length, 0);
});
test("Detached background and crashed capture fail closed", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.controller.detached = true;
	await f.audio();
	assert.equal((await f.call("status")).phase, "stopped");
	assert.equal(f.commands().length, 0);
	const g = fixture();
	await g.start();
	await g.call("arm", { armed: true });
	g.crash();
	assert.equal((await g.call("status")).armed, false);
	assert.equal((await g.call("status")).phase, "stopped");
});
test("Untrusted IPC cannot control, register or submit speech", async () => {
	const f = fixture();
	assert.throws(() => f.handles["voice:control"]({}, "start"));
	assert.throws(() => f.handles["voice:sync"]({}, []));
	await assert.rejects(f.handles["voice:capture"]({}, "audio", {}));
});

test("Disarm/rearm never revives an in-flight command", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.setSlow();
	const pending = f.audio();
	await f.call("arm", { armed: false });
	await f.call("arm", { armed: true });
	f.resolve();
	await pending;
	assert.equal(f.commands().length, 0);
});

test("Stop cancels a Start queued behind microphone selection", async () => {
	const f = fixture();
	const devices = f.call("devices");
	await delay(0);
	const start = f.call("start");
	const outcome = start.then(
		() => null,
		e => e
	);
	await f.call("stop");
	await f.capture("devices", []);
	await devices;
	await outcome;
	assert.equal((await f.call("status")).phase, "stopped");
});

test("TTS overlapping an in-flight transcription suppresses it even after playback ends", async () => {
	const f = fixture();
	await f.start();
	await f.call("arm", { armed: true });
	f.setSlow();
	const pending = f.audio();
	const source = { role: "speech", sender: { id: 1 }, senderFrame: { routingId: 2 } };
	await f.handles["voice:playback"](source, true);
	await f.handles["voice:playback"](source, false);
	await delay(650);
	f.resolve();
	await pending;
	assert.equal(f.commands().length, 0);
});
