const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const contentSource = fs.readFileSync(path.resolve(__dirname, "..", "sources", "vpzone.js"), "utf8");
const wsPagePath = path.resolve(__dirname, "..", "sources", "websocket", "vpzone.html");

const CHROME_MOCK = `
	window.__relayed = [];
	window.chrome = {
		runtime: {
			id: "test-extension",
			lastError: null,
			sendMessage: function (id, payload, cb) {
				if (payload && (payload.getSettings || payload === "getSettings")) {
					if (cb) cb({ settings: {}, state: true });
					return;
				}
				if (payload && payload.type === "toBackground") {
					var request = payload.data || {};
					if (String(request.url || "").indexOf("/api/chat/profile-card/testchan") !== -1) {
						if (cb) cb({
							ok: true,
							status: 200,
							data: {
								avatar_url: "https://cdn.example.test/testchan-avatar.webp",
								display_name: "Test Channel"
							}
						});
						return;
					}
					if (cb) cb({ ok: false, status: 0, error: "network disabled in test" });
					return;
				}
				window.__relayed.push(payload);
				if (cb) cb({ state: true });
			},
			onMessage: { addListener: function () {} }
		}
	};
`;

const WEBSOCKET_STUB = `
	window.__sockets = [];
	window.WebSocket = function (url) {
		this.url = url;
		this.readyState = 0;
		window.__sockets.push(this);
	};
	window.WebSocket.prototype.send = function () {};
	window.WebSocket.prototype.close = function () {
		this.readyState = 3;
		var self = this;
		setTimeout(function () { if (self.onclose) self.onclose({ code: 1000, reason: "" }); }, 0);
	};
`;

function relayedMessages(page) {
	return page.evaluate(() => window.__relayed.filter((p) => p && p.message).map((p) => p.message));
}

function relayedDeletes(page) {
	return page.evaluate(() => window.__relayed.filter((p) => p && p.delete).map((p) => p.delete));
}

function waitForRelayed(page, predicateSrc, expected) {
	return page.waitForFunction(
		([src, count]) => window.__relayed.filter(new Function("p", "return " + src)).length >= count,
		[predicateSrc, expected],
		{ timeout: 7000 }
	);
}

async function testContentScript(browser) {
	const page = await browser.newPage();
	await page.setContent("<div></div>");
	await page.addScriptTag({ content: CHROME_MOCK });
	await page.addScriptTag({
		content: `window.fetch = function () {
			return Promise.resolve({ ok: false, text: function () { return Promise.resolve(""); } });
		};`
	});
	await page.addScriptTag({ content: contentSource });

	const now = () => new Date().toISOString();
	const send = (frame) =>
		page.evaluate((f) => {
			window.postMessage({ source: "vpzone-ws-interceptor", type: "receive", data: JSON.stringify(f) }, "*");
		}, frame);

	// 1. Plain chat frame carries the native id top-level (delete-targeting fix).
	await send({ id: "m-1", type: "msg", username: "alice", body: "hello", ts: now() });
	await waitForRelayed(page, "p && p.message", 1);
	let messages = await relayedMessages(page);
	assert.strictEqual(messages[0].chatname, "alice");
	assert.strictEqual(messages[0].id, "m-1", "chat rows must carry the native frame id so deletes can match data-mid");
	assert.strictEqual(messages[0].meta.messageId, "m-1");
	assert.strictEqual(messages[0].type, "vpzone");

	// 2. Duplicate frame id is deduped.
	await send({ id: "m-1", type: "msg", username: "alice", body: "hello", ts: now() });
	// 3. Reply threading renders the Kick-style label and keeps the native id.
	await send({
		id: "m-2", type: "msg", username: "bob", body: "replying here", ts: now(),
		metadata: { reply_to: { message_id: "m-1", username: "alice", excerpt: "hello" } }
	});
	await waitForRelayed(page, "p && p.message", 2);
	messages = await relayedMessages(page);
	assert.strictEqual(messages.length, 2, "duplicate frame id must be deduped");
	const reply = messages[1];
	assert.strictEqual(reply.id, "m-2");
	assert.strictEqual(reply.initial, "alice: hello");
	assert.strictEqual(reply.reply, "replying here");
	assert.ok(reply.chatmessage.indexOf("<i><small>") === 0, "reply rows quote the target message");
	assert.strictEqual(reply.meta.reply.messageId, "m-1");

	// 4. Native VPZONE emotes render as images instead of raw shortcode text.
	await send({
		id: "m-emote", type: "msg", username: "emoter", body: "hello :wave:", ts: now(),
		emoteMap: { ":wave:": "https://cdn.example.test/wave.webp" }
	});
	await waitForRelayed(page, "p && p.message && p.message.id === 'm-emote'", 1);
	messages = await relayedMessages(page);
	const emote = messages.find((m) => m.id === "m-emote");
	assert.ok(emote.chatmessage.includes('class="regular-emote vpzone-emote"'));
	assert.ok(emote.chatmessage.includes('src="https://cdn.example.test/wave.webp"'));
	assert.ok(!emote.chatmessage.includes(":wave:"), "native emote shortcode must be replaced by its image");

	// 5. Pixels cheer becomes a donation-bearing chat row with the native id.
	await send({
		id: "m-3", type: "system", username: "system", ts: now(),
		metadata: { kind: "pixels_cheer", amount: 250, username: "carol", message: "great stream" }
	});
	await waitForRelayed(page, "p && p.message && p.message.hasDonation", 1);
	messages = await relayedMessages(page);
	const cheer = messages.find((m) => m.hasDonation);
	assert.strictEqual(cheer.hasDonation, "250 Pixels");
	assert.strictEqual(cheer.chatname, "carol");
	assert.strictEqual(cheer.id, "m-3");
	assert.ok(!cheer.event, "pixels cheers keep event blank (Kick tip pattern)");

	// 6. delete_message with camelCase metadata id.
	await send({ type: "delete_message", metadata: { messageId: "m-1" } });
	// 7. delete_message with snake_case metadata id (server emits snake_case elsewhere).
	await send({ type: "delete_message", metadata: { message_id: "m-2" } });
	// 8. clear_chat wipes by type.
	await send({ type: "clear_chat" });
	await waitForRelayed(page, "p && p.delete", 3);
	const deletes = await relayedDeletes(page);
	assert.deepStrictEqual(deletes[0], { type: "vpzone", id: "m-1" });
	assert.deepStrictEqual(deletes[1], { type: "vpzone", id: "m-2" });
	assert.deepStrictEqual(deletes[2], { type: "vpzone" });

	// 9. Outgoing raid frames are skipped; incoming shoutout/lifecycle/reward map to standard names.
	await send({ id: "m-5", type: "raid", username: "someone", body: "raiding out", ts: now(), metadata: { kind: "outgoing" } });
	await send({ id: "m-6", type: "system", username: "system", ts: now(), metadata: { kind: "stream_started", channel_slug: "testchan" } });
	await send({ id: "m-7", type: "system", username: "system", body: "redeemed Hydrate", ts: now(), metadata: { kind: "channel_points_redeem", username: "dave" } });
	await send({ id: "m-8", type: "shoutout", username: "modguy", ts: now(), metadata: { target_user: "friend" } });
	await waitForRelayed(page, "p && p.message", 7);
	messages = await relayedMessages(page);
	assert.strictEqual(messages.length, 7, "outgoing raid must not emit a row");
	const online = messages.find((m) => m.event === "stream_online");
	assert.strictEqual(online.chatname, "testchan");
	const reward = messages.find((m) => m.event === "reward");
	assert.strictEqual(reward.chatname, "dave");
	const shoutout = messages.find((m) => m.event === "shoutout");
	assert.strictEqual(shoutout.meta.targetUser, "friend");
	assert.ok(shoutout.chatmessage.indexOf("@friend") !== -1);

	await page.close();
	console.log("content script frame handling: ok");
}

async function testNestedDomCaptureAndBranding(browser) {
	const page = await browser.newPage();
	await page.route("https://vpzone.tv/**", async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname === "/api/chat/profile-card/testchan") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					avatar_url: "https://cdn.example.test/testchan-avatar.webp",
					display_name: "Test Channel"
				})
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "text/html",
			body: '<div data-chat-container="true"><div class="space-y-2"><div id="nested-rows"></div></div></div>'
		});
	});
	await page.goto("https://vpzone.tv/watch/testchan");
	await page.addScriptTag({ content: CHROME_MOCK });
	await page.addScriptTag({ content: contentSource });

	await page.evaluate(() => {
		function makeRow(username, message, id) {
			const row = document.createElement("div");
			row.setAttribute("data-chat-message", "true");
			row.setAttribute("data-username", username);
			row.setAttribute("data-msg-id", id);
			row.setAttribute("data-timestamp", new Date().toISOString());
			row.innerHTML = '<span data-chat-username="true"></span><p data-chat-body="true"></p><span data-chat-timestamp="true"></span>';
			row.querySelector('[data-chat-username="true"]').textContent = username;
			row.querySelector('[data-chat-body="true"]').textContent = message;
			row.querySelector('[data-chat-timestamp="true"]').textContent = new Date().toLocaleTimeString();
			return row;
		}
		document.querySelector("#nested-rows").appendChild(makeRow("nested-user", "Nested VPZONE message", "nested-1"));
		document.querySelector('[data-chat-container="true"]').appendChild(makeRow("direct-user", "Direct VPZONE control message", "direct-1"));
	});

	await waitForRelayed(page, "p && p.message && p.message.chatname", 2);
	const messages = await relayedMessages(page);
	assert.strictEqual(messages.filter((m) => m.chatname === "nested-user").length, 1, "nested VPZONE rows must be captured exactly once");
	assert.strictEqual(messages.filter((m) => m.chatname === "direct-user").length, 1, "direct VPZONE rows remain supported");
	messages.forEach((message) => {
		assert.strictEqual(message.sourceName, "Test Channel");
		assert.strictEqual(message.sourceImg, "https://cdn.example.test/testchan-avatar.webp");
	});

	await page.close();
	console.log("nested DOM capture and channel branding: ok");
}

async function testWebsocketPage(browser) {
	const page = await browser.newPage();
	await page.addInitScript({ content: CHROME_MOCK });
	await page.addInitScript({ content: WEBSOCKET_STUB });
	await page.goto("file://" + wsPagePath.replace(/\\/g, "/") + "?channel=testchan");

	await page.waitForFunction(() => window.__sockets && window.__sockets.length >= 1, null, { timeout: 7000 }).catch(async () => {
		await page.click("#connect-btn");
		await page.waitForFunction(() => window.__sockets && window.__sockets.length >= 1, null, { timeout: 7000 });
	});

	await page.evaluate(() => {
		const sock = window.__sockets[window.__sockets.length - 1];
		sock.readyState = 1;
		if (sock.onopen) sock.onopen({});
	});

	const now = () => new Date().toISOString();
	const send = (frame) =>
		page.evaluate((f) => {
			const sock = window.__sockets[window.__sockets.length - 1];
			if (sock.onmessage) sock.onmessage({ data: JSON.stringify(f) });
		}, frame);

	// Chat message with reply threading.
	await send({ type: "msg", id: "w-1", username: "alice", message: "hello", created_at: now() });
	await send({
		type: "msg", id: "w-2", username: "bob", message: "replying here", created_at: now(),
		metadata: { reply_to: { message_id: "w-1", username: "alice", excerpt: "hello" } }
	});
	await waitForRelayed(page, "p && p.message && p.message.chatname", 2);
	let messages = await relayedMessages(page);
	assert.strictEqual(messages[0].chatname, "alice");
	assert.strictEqual(messages[0].id, "w-1");
	assert.strictEqual(messages[0].chatmessage, "hello", "plain text must not be turned into bogus emote images");
	const reply = messages[1];
	assert.strictEqual(reply.initial, "alice: hello");
	assert.ok(reply.chatmessage.indexOf("<i><small>") === 0);
	assert.strictEqual(reply.meta.reply.messageId, "w-1");

	// Native VPZONE emotes and channel branding are preserved by the direct source.
	await send({
		type: "msg", id: "w-emote", username: "emoter", message: "hello :wave:", created_at: now(),
		emoteMap: { ":wave:": "https://cdn.example.test/wave.webp" }
	});
	await waitForRelayed(page, "p && p.message && p.message.id === 'w-emote'", 1);
	messages = await relayedMessages(page);
	const emote = messages.find((m) => m.id === "w-emote");
	assert.ok(emote.chatmessage.includes('class="regular-emote vpzone-emote"'));
	assert.ok(emote.chatmessage.includes('src="https://cdn.example.test/wave.webp"'));
	assert.ok(!emote.chatmessage.includes(":wave:"), "native emote shortcode must be replaced by its image");
	assert.strictEqual(emote.sourceName, "Test Channel");
	assert.strictEqual(emote.sourceImg, "https://cdn.example.test/testchan-avatar.webp");
	assert.ok(!emote.sourceImg.includes("sources/images/vpzone.png"), "sourceImg must be the channel avatar, not a second VPZONE logo");

	// Pixels cheer via system frame; actor sits in metadata.username and the
	// server composes a body ("X sent N Pixels!") that the builder discards.
	await send({ type: "system", id: "w-3", username: "system", body: "carol sent 250 Pixels!", created_at: now(), metadata: { kind: "pixels_cheer", amount: 250, username: "carol", message: "nice" } });
	await waitForRelayed(page, "p && p.message && p.message.hasDonation", 1);
	messages = await relayedMessages(page);
	const cheer = messages.find((m) => m.hasDonation);
	assert.strictEqual(cheer.hasDonation, "250 Pixels");
	assert.strictEqual(cheer.chatname, "carol");
	assert.strictEqual(cheer.event, "", "pixels cheers keep event blank");
	assert.strictEqual(cheer.meta.rawEventType, "pixels_cheer");

	// Gift subtitle, raid filtering, lifecycle, reward, mod message.
	await send({ type: "gift", id: "w-4", username: "gifter", body: "gifter gifted 5 subscriptions!", created_at: now(), metadata: { gift_count: 5 } });
	await send({ type: "raid", id: "w-5", username: "outraider", body: "Raiding another channel", created_at: now(), metadata: { kind: "outgoing" } });
	await send({ type: "raid", id: "w-6", username: "raider", body: "raider is raiding!", created_at: now(), metadata: { kind: "incoming", viewer_count: 42 } });
	await send({ type: "system", id: "w-7", username: "system", body: "Stream started", created_at: now(), metadata: { kind: "stream_started" } });
	await send({ type: "system", id: "w-8", username: "system", body: "redeemed Hydrate", created_at: now(), metadata: { kind: "channel_points_redeem", username: "dave" } });
	await send({ type: "mod_message", id: "w-9", username: "modann", message: "announcement", created_at: now() });
	await waitForRelayed(page, "p && p.message", 9);
	messages = await relayedMessages(page);
	assert.strictEqual(messages.filter((m) => m.chatname === "outraider").length, 0, "outgoing raids must be skipped");
	const gift = messages.find((m) => m.event === "subscription_gift");
	assert.strictEqual(gift.subtitle, "x5");
	const raid = messages.find((m) => m.event === "raid");
	assert.strictEqual(raid.meta.viewers, 42);
	const online = messages.find((m) => m.event === "stream_online");
	assert.strictEqual(online.chatname, "testchan", "lifecycle frames attribute to the connected channel");
	const reward = messages.find((m) => m.event === "reward");
	assert.strictEqual(reward.chatname, "dave");
	const modMsg = messages.find((m) => m.mod === true);
	assert.strictEqual(modMsg.chatname, "modann");
	assert.ok(modMsg.backgroundColor, "mod broadcasts render highlighted");

	// Platform-side deletes, both metadata casings, plus clear_chat.
	await send({ type: "delete_message", metadata: { messageId: "w-1" } });
	await send({ type: "delete_message", metadata: { message_id: "w-2" } });
	await send({ type: "clear_chat" });
	await waitForRelayed(page, "p && p.delete", 3);
	const deletes = await relayedDeletes(page);
	assert.deepStrictEqual(deletes[0], { type: "vpzone", id: "w-1" });
	assert.deepStrictEqual(deletes[1], { type: "vpzone", id: "w-2" });
	assert.deepStrictEqual(deletes[2], { type: "vpzone" });

	// The channel editor stays hidden without a signed-in owner token.
	const editorHidden = await page.$eval("#channel-editor", (el) => el.classList.contains("hidden"));
	assert.strictEqual(editorHidden, true, "stream info editor requires an owner token");

	await page.close();
	console.log("websocket page frame handling: ok");
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		await testNestedDomCaptureAndBranding(browser);
		await testContentScript(browser);
		await testWebsocketPage(browser);
		console.log("vpzone-ws-frames: all assertions passed");
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
