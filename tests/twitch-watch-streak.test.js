#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

async function loadModule(relativePath) {
	const source = fs.readFileSync(path.join(root, relativePath), "utf8");
	return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

class FakeTmiClient {
	constructor() {
		this.handlers = new Map();
	}

	on(event, handler) {
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event).add(handler);
	}

	removeListener(event, handler) {
		this.handlers.get(event)?.delete(handler);
	}

	emit(event, ...args) {
		for (const handler of this.handlers.get(event) || []) handler(...args);
	}

	async connect() {
		return ["socialstream"];
	}

	disconnect() {}
}

(async () => {
	const { createTwitchChatClient, TWITCH_CHAT_EVENTS } = await loadModule("providers/twitch/chatClient.js");
	const fakeClient = new FakeTmiClient();
	const received = [];
	let soakMode = false;
	let soakReceived = 0;
	const chatClient = createTwitchChatClient({
		channel: "socialstream",
		clientFactory: async () => fakeClient,
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		formatters: {
			sanitize: value => String(value ?? ""),
			avatarUrl: value => `avatar:${value}`,
			now: () => 1000
		}
	});
	chatClient.on(TWITCH_CHAT_EVENTS.WATCH_STREAK, payload => {
		if (soakMode) {
			soakReceived += 1;
		} else {
			received.push(payload);
		}
	});
	await chatClient.connect();

	const baseTags = {
		username: "viewerlogin",
		login: "viewerlogin",
		"display-name": "ViewerName",
		"user-id": "viewer-123",
		id: "message-123",
		"msg-param-id": "milestone-123",
		"msg-param-value": "7",
		"room-id": "connected-room",
		"source-room-id": "origin-room",
		"system-msg": "ViewerName watched 7 consecutive streams and sparked a watch streak!",
		"tmi-sent-ts": "1712435520000"
	};

	fakeClient.emit("usernotice", "modiversary", "#socialstream", baseTags, "ignored");
	fakeClient.emit("usernotice", "viewermilestone", "#socialstream", {
		...baseTags,
		"msg-param-category": "other"
	}, "ignored");
	assert.equal(received.length, 0, "Non-Watch-Streak USERNOTICE messages must stay ignored");

	fakeClient.emit("usernotice", "viewermilestone", "#socialstream", {
		...baseTags,
		"msg-param-category": "watch-streak"
	}, "Thanks for the streams!");
	assert.equal(received.length, 1);
	assert.equal(received[0].event, "watch_streak");
	assert.equal(received[0].chatname, "ViewerName");
	assert.equal(received[0].username, "viewerlogin");
	assert.equal(received[0].userId, "viewer-123");
	assert.equal(received[0].chatmessage, baseTags["system-msg"]);
	assert.deepEqual(received[0].meta, { streakCount: 7, milestoneId: "milestone-123" });
	assert.equal(received[0].raw.userstate["source-room-id"], "origin-room");

	const popup = fs.readFileSync(path.join(root, "popup.html"), "utf8");
	const adapter = fs.readFileSync(path.join(root, "sources", "websocket", "twitch.js"), "utf8");
	assert.match(popup, /data-setting="showtwitchwatchstreaks"/);
	assert.match(adapter, /!settings\.showtwitchwatchstreaks/);
	assert.match(adapter, /TWITCH_CHAT_EVENTS\.WATCH_STREAK/);

	const soakArgument = process.argv.find(argument => argument.startsWith("--soak-ms="));
	const soakMs = soakArgument ? Math.max(0, Number(soakArgument.split("=")[1]) || 0) : 0;
	if (soakMs) {
		soakMode = true;
		const deadline = Date.now() + soakMs;
		let emitted = 0;
		while (Date.now() < deadline) {
			fakeClient.emit("usernotice", "viewermilestone", "#socialstream", {
				...baseTags,
				id: `message-${emitted}`,
				"msg-param-id": `milestone-${emitted}`,
				"msg-param-category": "watch-streak",
				"msg-param-value": String((emitted % 100) + 1)
			}, "");
			fakeClient.emit("usernotice", "modiversary", "#socialstream", baseTags, "ignored");
			emitted += 1;
		}
		assert.equal(soakReceived, emitted, "Soak must emit exactly one event per Watch Streak");
		assert.ok(emitted > 1000, `Soak emitted too few notices: ${emitted}`);
		console.log(`Twitch Watch Streak soak passed: ${emitted} accepted and ${emitted} unrelated notices ignored.`);
	}

	chatClient.destroy();
	console.log("PASS: Twitch Watch Streak USERNOTICE capture is specific and normalized.");
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
