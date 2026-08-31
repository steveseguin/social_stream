const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "joystick.js"), "utf8");
const interceptor = fs.readFileSync(path.join(root, "sources", "inject", "joystick-ws.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const parserEntry = manifest.content_scripts.find((entry) => entry.js && entry.js.includes("./sources/joystick.js"));
const interceptorEntry = manifest.content_scripts.find((entry) => entry.js && entry.js.includes("./sources/inject/joystick-ws.js"));
assert(parserEntry, "Joystick parser must be registered in the manifest");
assert.strictEqual(parserEntry.run_at, "document_start");
assert(interceptorEntry, "Joystick WebSocket interceptor must be registered in the manifest");
assert.strictEqual(interceptorEntry.run_at, "document_start");
assert.strictEqual(interceptorEntry.world, "MAIN");

const CHROME_MOCK = `
	window.__joystickRelayed = [];
	window.__joystickListener = null;
	window.chrome = {
		runtime: {
			id: "test-extension",
			lastError: null,
			sendMessage: function (id, payload, callback) {
				if (payload && payload.getSettings) {
					if (callback) callback({ settings: { textonlymode: false, showviewercount: true }, state: true });
					return;
				}
				window.__joystickRelayed.push(payload);
				if (callback) callback({});
			},
			onMessage: {
				addListener: function (listener) { window.__joystickListener = listener; }
			}
		}
	};
`;

function packet(channel, message) {
	return {
		identifier: JSON.stringify({ channel, stream_id: "ravenvr" }),
		message
	};
}

async function postPacket(page, value) {
	await page.evaluate((data) => {
		window.postMessage({ source: "joystick-ws-interceptor", type: "receive", data: JSON.stringify(data) }, "*");
	}, value);
}

async function messages(page) {
	return page.evaluate(() => window.__joystickRelayed.filter((item) => item && item.message).map((item) => item.message));
}

async function deletes(page) {
	return page.evaluate(() => window.__joystickRelayed.filter((item) => item && item.delete).map((item) => item.delete));
}

async function testWebSocketCapture(browser) {
	const page = await browser.newPage();
	await page.setContent('<div><input placeholder="Write in chat"></div>');
	await page.addScriptTag({ content: CHROME_MOCK });
	await page.addScriptTag({ content: source });

	await postPacket(page, packet("ChatChannel", {
		event: "ChatMessage",
		type: "new_message",
		messageId: "m-1",
		channelId: "channel-1",
		createdAt: "2026-08-23T13:56:05Z",
		visibility: "public",
		text: "hello <b>world</b>",
		emotesUsed: [{ code: ":wave:", url: "https://example.com/wave.png" }],
		mentionedUsername: "segagenesis",
		highlight: true,
		author: {
			username: "alice",
			nickname: "Alice",
			usernameColor: "#123456",
			isModerator: true,
			isSubscriber: true,
			isVerified: true,
			signedPhotoThumbUrl: "https://example.com/alice.png"
		},
		streamer: { username: "ravenvr" }
	}));

	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.id === "m-1"));
	let captured = await messages(page);
	assert.strictEqual(captured[0].type, "joystick");
	assert.strictEqual(captured[0].chatname, "Alice");
	assert.strictEqual(captured[0].chatmessage, "hello world");
	assert.strictEqual(captured[0].id, "m-1");
	assert.strictEqual(captured[0].userid, "alice");
	assert.strictEqual(captured[0].membership, "Subscriber");
	assert.strictEqual(captured[0].nameColor, "#123456");
	assert.strictEqual(captured[0].mod, true);
	assert.strictEqual(captured[0].timestamp, "2026-08-23T13:56:05Z");
	assert.strictEqual(captured[0].meta.messageId, "m-1");
	assert.strictEqual("rawType" in captured[0].meta, false);

	await postPacket(page, packet("ChatChannel", {
		event: "ChatMessage",
		type: "new_message",
		messageId: "m-rendered-color",
		text: "rendered color",
		author: { username: "ColorUser", usernameColor: null }
	}));
	await page.evaluate(() => {
		const row = document.createElement("div");
		row.className = "chat-message";
		row.innerHTML = '<span class="font-semibold" style="color: rgb(187, 84, 202)">ColorUser: </span><span class="content">rendered color</span>';
		document.body.appendChild(row);
	});
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.id === "m-rendered-color"));
	captured = await messages(page);
	assert.strictEqual(captured.find((item) => item.id === "m-rendered-color").nameColor, "rgb(187, 84, 202)");

	await postPacket(page, packet("WhisperChatChannel", {
		event: "BotMessage",
		type: "event_bot_message",
		messageId: "m-private",
		visibility: "private",
		text: "welcome back",
		author: { username: "joystick.tv bot", usernameColor: "#1b88f4" }
	}));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.id === "m-private"));
	captured = await messages(page);
	const privateMessage = captured.find((item) => item.id === "m-private");
	assert.strictEqual(privateMessage.private, true);
	assert.strictEqual(privateMessage.bot, true);

	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "ViewerCountUpdated",
		text: "79 viewers",
		metadata: JSON.stringify({ number_of_viewers: 79 })
	}));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.event === "viewer_update"));
	captured = await messages(page);
	assert.strictEqual(captured.find((item) => item.event === "viewer_update").meta, 79);

	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "FollowerCountUpdated",
		text: "1339",
		metadata: JSON.stringify({ number_of_followers: 1339 })
	}));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.event === "follower_update"));
	captured = await messages(page);
	assert.strictEqual(captured.find((item) => item.event === "follower_update").meta, 1339);

	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "Tipped",
		text: "bob tipped 250 tokens",
		metadata: JSON.stringify({ who: "bob", how_much: 250, currency: "tokens" })
	}));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.event === "donation"));
	captured = await messages(page);
	const donation = captured.find((item) => item.event === "donation");
	assert.strictEqual(donation.chatname, "bob");
	assert.strictEqual(donation.hasDonation, "250 tokens");
	assert.strictEqual(donation.donoValue, 250);
	assert.deepStrictEqual(donation.meta, {
		eventType: "Tipped",
		supporter: "bob",
		amount: 250,
		currency: "tokens",
		message: "bob tipped 250 tokens",
		giftName: null,
		giftType: null,
		tier: null
	});
	await postPacket(page, packet("ChatChannel", {
		event: "BotMessage",
		type: "event_bot_message",
		messageId: "tip-bot-copy",
		text: "bob tipped 250 tokens",
		author: { username: "joystick.tv bot" }
	}));
	await page.waitForTimeout(150);
	captured = await messages(page);
	assert.strictEqual(captured.filter((item) => item.event === "donation" && item.chatname === "bob").length, 1, "bot and event-log tip copies must dedupe");

	await postPacket(page, packet("ChatChannel", {
		type: "edit_message",
		messageId: "m-1",
		text: "edited text",
		editedAt: "2026-08-23T13:57:05Z",
		editCount: 1
	}));
	await page.waitForFunction(() => window.__joystickRelayed.filter((item) => item && item.delete && item.delete.id === "m-1").length === 1);
	captured = await messages(page);
	const edited = captured.filter((item) => item.id === "m-1").pop();
	assert.strictEqual(edited.chatmessage, "edited text");
	assert.deepStrictEqual(edited.meta, { messageId: "m-1" });

	await postPacket(page, packet("ChatChannel", { type: "delete_message", messageId: "m-private" }));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.delete && item.delete.id === "m-private"));
	const removed = await deletes(page);
	assert(removed.some((item) => item.type === "joystick" && item.id === "m-private"));

	await postPacket(page, packet("ChatChannel", {
		event: "BotMessage",
		type: "event_bot_message",
		messageId: "follow-bot",
		text: "newfan is now following!",
		author: { username: "joystick.tv bot" }
	}));
	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "Followed",
		text: "newfan is now following!",
		metadata: JSON.stringify({ username: "newfan" })
	}));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.event === "new_follower"));
	captured = await messages(page);
	assert.strictEqual(captured.filter((item) => item.event === "new_follower" && item.username === "newfan").length, 1, "bot and event-log follow copies must dedupe");
	assert.strictEqual(captured.find((item) => item.event === "new_follower").chatmessage, "newfan is now following!");

	const beforeTransportNotice = captured.length;
	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "ChatMessageReceived",
		id: "transport-only",
		text: "new_message",
		metadata: JSON.stringify({})
	}));
	await page.waitForTimeout(150);
	captured = await messages(page);
	assert.strictEqual(captured.length, beforeTransportNotice, "ChatMessageReceived is a transport notification, not a Social Stream event");
	assert.strictEqual(captured.some((item) => item.event === "chat_message_received"), false);

	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "NewSubscription",
		text: "SubFan subscribed!",
		metadata: JSON.stringify({ who: "SubFan", plan: "Gold" })
	}));
	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "GiftedSubscription",
		text: "GiftFan gifted subscriptions!",
		metadata: JSON.stringify({ who: "GiftFan", subscriber: "Recipient", quantity: 2, plan: "Gold" })
	}));
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message && item.message.event === "subscription_gift"));
	captured = await messages(page);
	const subscriber = captured.find((item) => item.event === "new_subscriber");
	const subscriptionGift = captured.find((item) => item.event === "subscription_gift");
	assert.strictEqual(subscriber.membership, "Subscriber");
	assert.deepStrictEqual(subscriber.meta, {
		eventType: "NewSubscription",
		subscriber: "SubFan",
		gifter: null,
		totalGifted: null,
		duration: null,
		plan: "Gold"
	});
	assert.deepStrictEqual(subscriptionGift.meta, {
		eventType: "GiftedSubscription",
		subscriber: "Recipient",
		gifter: "GiftFan",
		totalGifted: 2,
		duration: null,
		plan: "Gold"
	});

	const beforeUnknownWidget = captured.length;
	await postPacket(page, packet("EventLogChannel", {
		event: "StreamEvent",
		type: "TipGoalUpdated",
		text: "widget refresh",
		metadata: JSON.stringify({ goal: 100 })
	}));
	await page.waitForTimeout(150);
	captured = await messages(page);
	assert.strictEqual(captured.length, beforeUnknownWidget, "unmapped widget state must not invent a Social Stream event type");

	await page.evaluate(() => {
		window.__joystickListener("focusChat", null, (value) => { window.__focusResult = value; });
	});
	assert.strictEqual(await page.evaluate(() => window.__focusResult), true);
	assert.strictEqual(await page.evaluate(() => document.activeElement.placeholder), "Write in chat");

	await page.close();
	console.log("Joystick WebSocket capture: ok");
}

async function testDomFallback(browser) {
	const page = await browser.newPage();
	await page.setContent(`
		<div class="chat-list flex overflow-y-auto scroll-smooth">
			<div class="chat-message"><div><span class="font-semibold">olduser: </span><span class="content">old message</span></div></div>
		</div>
		<input placeholder="Write in chat">
	`);
	await page.addScriptTag({ content: CHROME_MOCK });
	await page.addScriptTag({ content: source });
	await page.waitForTimeout(150);
	await page.evaluate(() => {
		const row = document.createElement("div");
		row.className = "chat-message flex w-full";
		row.innerHTML = '<div><span title="Verified Streamer"></span><span class="mr-1 cursor-pointer font-semibold" style="color: rgb(197, 80, 187)">Velstine: </span><span class="content">new DOM message</span></div>';
		document.querySelector(".chat-list").appendChild(row);
	});
	await page.waitForFunction(() => window.__joystickRelayed.some((item) => item && item.message));
	const captured = await messages(page);
	assert.strictEqual(captured.length, 1, "existing rows must not replay");
	assert.strictEqual(captured[0].chatname, "Velstine");
	assert.strictEqual(captured[0].chatmessage, "new DOM message");
	assert.strictEqual(captured[0].nameColor, "rgb(197, 80, 187)");
	assert.strictEqual(captured[0].chatbadges.length, 1);
	assert.strictEqual("meta" in captured[0], false);
	await page.close();
	console.log("Joystick DOM fallback: ok");
}

async function testInterceptor(browser) {
	const page = await browser.newPage();
	await page.route("https://joystick.tv/test", (route) => route.fulfill({
		status: 200,
		contentType: "text/html",
		body: "<div></div>"
	}));
	await page.goto("https://joystick.tv/test");
	await page.addScriptTag({ content: `
		window.__socketPosts = [];
		window.addEventListener("message", function (event) {
			if (event.data && event.data.source === "joystick-ws-interceptor") window.__socketPosts.push(event.data);
		});
		window.WebSocket = function (url, protocols) {
			this.url = url;
			this.protocols = protocols;
			this.listeners = {};
			window.__socket = this;
		};
		window.WebSocket.prototype.addEventListener = function (type, listener) { this.listeners[type] = listener; };
		window.WebSocket.prototype.emitMessage = function (data) { this.listeners.message({ data: data }); };
		window.WebSocket.CONNECTING = 0;
		window.WebSocket.OPEN = 1;
		window.WebSocket.CLOSING = 2;
		window.WebSocket.CLOSED = 3;
	` });
	await page.addScriptTag({ content: interceptor });
	await page.evaluate(() => {
		const socket = new WebSocket("wss://api.joystick.tv/cable?token=secret", ["actioncable-v1-json"]);
		socket.emitMessage('{"type":"welcome"}');
	});
	await page.waitForFunction(() => window.__socketPosts.length === 1);
	const post = await page.evaluate(() => window.__socketPosts[0]);
	assert.strictEqual(post.type, "receive");
	assert.strictEqual(post.data, '{"type":"welcome"}');
	assert.strictEqual("url" in post, false, "the interceptor must never expose the authenticated socket URL");
	await page.close();
	console.log("Joystick interceptor: ok");
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		await testWebSocketCapture(browser);
		await testDomFallback(browser);
		await testInterceptor(browser);
		console.log("Joystick source: all assertions passed");
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
