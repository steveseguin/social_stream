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
		return ["test"];
	}

	disconnect() {}
}

async function captureMessage(chatClient, fakeClient, tags, message) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Twitch message was not emitted")), 1000);
		const off = chatClient.on("message", (payload) => {
			clearTimeout(timer);
			off();
			resolve(payload);
		});
		fakeClient.emit("chat", "#twitchdev", tags, message, false);
	});
}

(async () => {
	const { createTwitchChatClient } = await loadModule("providers/twitch/chatClient.js");
	const fakeClient = new FakeTmiClient();
	const chatClient = createTwitchChatClient({
		channel: "twitchdev",
		clientFactory: async () => fakeClient,
		logger: { debug() {}, info() {}, warn() {}, error() {} },
	});
	await chatClient.connect();

	const fallbackText = "[Y A Y Yes GIF by Djemilah Birnie]";
	const gifUrl = "https://media4.giphy.com/media/joSNxeswxuc74Juo8X/giphy.gif?cid=095d7a5dzizsiwgabonagkmigggv8v1spfai91ac3x0dsiy0&ep=v1_gifs_trending&rid=giphy.gif&ct=g";
	const ircPayload = await captureMessage(
		chatClient,
		fakeClient,
		{
			username: "twitchdev",
			"display-name": "TwitchDev",
			id: "401abf17-7e99-45d6-9bdf-43934e839327",
			gifs: `0-33|joSNxeswxuc74Juo8X|${gifUrl}`,
		},
		fallbackText
	);
	assert.equal(ircPayload.chatmessage, fallbackText);
	assert.equal(ircPayload.contentimg, gifUrl, "IRC GIF URL must be forwarded without modification");
	assert.equal(ircPayload.event, "chat");

	const eventSubUrl = "https://media0.giphy.com/media/example/giphy.gif?cid=eventsub&rid=giphy.gif";
	const eventSubPayload = await captureMessage(
		chatClient,
		fakeClient,
		{ username: "twitchdev", "display-name": "TwitchDev", id: "eventsub-gif" },
		{
			text: "[Good Morning Coffee GIF by VeeFriends]",
			fragments: [
				{
					type: "gif",
					text: "[Good Morning Coffee GIF by VeeFriends]",
					gif: { gif_id: "example", url: eventSubUrl },
				},
			],
		}
	);
	assert.equal(eventSubPayload.chatmessage, "[Good Morning Coffee GIF by VeeFriends]");
	assert.equal(eventSubPayload.contentimg, eventSubUrl, "EventSub GIF URL must be forwarded without modification");

	chatClient.destroy();
	console.log("PASS: Twitch IRC and EventSub GIF messages expose their supplied asset URL as contentimg.");
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
