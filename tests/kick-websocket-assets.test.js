const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const source = fs.readFileSync(
	path.resolve(__dirname, "..", "sources", "websocket", "kick.js"),
	"utf8"
);
const coreSource = fs.readFileSync(
	path.resolve(__dirname, "..", "providers", "kick", "core.js"),
	"utf8"
);

function findImage(result, className) {
	return result.images.find((image) => image.classes.includes(className));
}

(async () => {
	const kickCore = await import(`data:text/javascript;base64,${Buffer.from(coreSource).toString("base64")}`);
	assert.deepStrictEqual(kickCore.mapBadges([
		{ type: "moderator", text: "Moderator" },
		{ name: "level", image_url: "https://ext.cdn.kick.com/chat/badges/16.png", selected: true },
		{ name: "level", image_url: "https://ext.cdn.kick.com/chat/badges/22.png", selected: false }
	]), [
		{ type: "text", text: "Moderator" },
		"https://ext.cdn.kick.com/chat/badges/16.png"
	]);

	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage();
		await page.setContent("<!doctype html><html><body></body></html>");
		await page.evaluate(() => {
			window.__kickWsBootstrapped = true;
		});
		await page.addScriptTag({ content: source });
		await page.addScriptTag({
			content: `
				applyKickCoreFallbacks();
				window.__kickAssetTest = {
					render: function (message, fallback, payload) {
						return renderKickMessageHtml(message, fallback, payload);
					},
					replaceRich: function (value) {
						return replaceKickInlineAssets(value, { forceRich: true });
					},
					setTextOnly: function (value) {
						extension.settings.textonlymode = { setting: value === true };
					},
					setChannelIds: function (chatroomId, channelId) {
						state.socket.chatroomId = chatroomId;
						state.socket.channelId = channelId;
						state.channelId = channelId;
						state.channelSlug = 'kick-gift-test';
						return getPusherSubscriptionChannels();
					},
					resolveFromBridge: async function (response) {
						const originalFetch = window.fetch;
						state.channelSlug = 'kick-gift-test';
						state.channelId = null;
						state.socket.chatroomId = null;
						state.socket.channelId = null;
						state.socket.userId = null;
						window.fetch = async function () {
							return { ok: true, json: async function () { return response; } };
						};
						try {
							await resolveChannelForPusher();
							return {
								broadcasterUserId: state.channelId,
								chatroomId: state.socket.chatroomId,
								channelId: state.socket.channelId,
								userId: state.socket.userId,
							};
						} finally {
							window.fetch = originalFetch;
						}
					},
					resetGiftState: function () {
						state.recentGiftEventIds.clear();
						state.recentGiftSignatures.clear();
					},
					capturePusherFrame: function (frame) {
						const messages = [];
						const originalPushMessage = pushMessage;
						pushMessage = function (data) { messages.push(data); };
						try {
							handlePusherMessage({ data: JSON.stringify(frame) });
						} finally {
							pushMessage = originalPushMessage;
						}
						return messages;
					},
					captureBridgePacket: function (packet) {
						const messages = [];
						const originalPushMessage = pushMessage;
						pushMessage = function (data) { messages.push(data); };
						try {
							processBridgeEvent(packet);
						} finally {
							pushMessage = originalPushMessage;
						}
						return messages;
					},
					collectBadges: function (source) {
						return collectBadgesFromSources(source);
					}
				};
			`
		});

		const inspect = (message, fallback, payload) => page.evaluate(
			({ messageValue, fallbackValue, payloadValue }) => {
				const html = window.__kickAssetTest.render(messageValue, fallbackValue, payloadValue);
				const template = document.createElement("template");
				template.innerHTML = html;
				return {
					html,
					text: template.content.textContent,
					images: Array.from(template.content.querySelectorAll("img")).map((image) => ({
						alt: image.alt,
						classes: Array.from(image.classList),
						src: image.getAttribute("src")
					}))
				};
			},
			{ messageValue: message, fallbackValue: fallback, payloadValue: payload }
		);

		let result = await inspect(
			{ content: "hello [emote:123:Wave]" },
			"hello [emote:123:Wave]"
		);
		assert.strictEqual(result.images.length, 1, "normal Kick emote tokens must keep rendering");
		assert.strictEqual(result.images[0].src, "https://files.kick.com/emotes/123/fullsize");
		assert.ok(result.images[0].classes.includes("regular-emote"));
		assert.ok(!result.images[0].classes.includes("kick-sticker"));

		result = await inspect(
			{ content: "hello [STICKER:456:Party]" },
			"hello [STICKER:456:Party]"
		);
		let sticker = findImage(result, "kick-sticker");
		assert.ok(sticker, "sticker tokens must render as images");
		assert.strictEqual(sticker.src, "https://files.kick.com/emotes/456/fullsize");
		assert.strictEqual(sticker.alt, "Party");

		result = await inspect({
			fragments: [
				{ type: "text", text: "hello " },
				{ kind: "sticker", stickerId: 789, name: "Confetti" },
				{ kind: "emote", emoteId: 321, name: "WaveAgain" }
			]
		}, "");
		sticker = findImage(result, "kick-sticker");
		assert.ok(sticker, "kind=sticker fragments must render");
		assert.strictEqual(sticker.src, "https://files.kick.com/emotes/789/fullsize");
		assert.ok(result.images.some((image) => image.alt === "WaveAgain"));

		result = await inspect({
			fragments: [{ type: "sticker", sticker_id: 852, name: "DirectSticker" }]
		}, "");
		sticker = findImage(result, "kick-sticker");
		assert.ok(sticker, "type=sticker fragments must render");
		assert.strictEqual(sticker.src, "https://files.kick.com/emotes/852/fullsize");

		result = await inspect({
			fragments: [{ sticker: {
				sticker_id: 654,
				name: "Nested",
				image_url: "https://cdn.example.test/nested.webp"
			} }]
		}, "");
		sticker = findImage(result, "kick-sticker");
		assert.ok(sticker, "nested sticker fragments must render");
		assert.strictEqual(sticker.src, "https://cdn.example.test/nested.webp");

		const metadataPayload = {
			message: { content: "metadata sticker" },
			metadata: { sticker: { id: 987, name: "Attached" } }
		};
		result = await inspect(metadataPayload.message, "metadata sticker", metadataPayload);
		sticker = findImage(result, "kick-sticker");
		assert.ok(sticker, "sticker-only metadata must append its image");
		assert.strictEqual(result.images.length, 1);
		assert.strictEqual(result.text.trim(), "metadata sticker");

		const partialFragmentPayload = {
			message: { fragments: [{ type: "sticker", text: "Party" }] },
			metadata: { sticker: { id: 654321, name: "Party" } }
		};
		result = await inspect(partialFragmentPayload.message, "Party", partialFragmentPayload);
		sticker = findImage(result, "kick-sticker");
		assert.ok(sticker, "incomplete sticker fragments must fall back to metadata");
		assert.strictEqual(sticker.src, "https://files.kick.com/emotes/654321/fullsize");

		const tokenAndMetadata = {
			message: { content: "[sticker:246:Once]" },
			metadata: { sticker: { id: 246, name: "Once" } }
		};
		result = await inspect(tokenAndMetadata.message, tokenAndMetadata.message.content, tokenAndMetadata);
		assert.strictEqual(result.images.length, 1, "metadata must not duplicate an inline sticker token");

		await page.evaluate(() => window.__kickAssetTest.setTextOnly(true));
		result = await inspect({ content: "[sticker:135:Plain]" }, "[sticker:135:Plain]");
		assert.strictEqual(result.images.length, 0, "text-only output must not contain sticker images");
		assert.strictEqual(result.text, "[sticker:135:Plain]");

		const forcedRichHtml = await page.evaluate(() =>
			window.__kickAssetTest.replaceRich("[sticker:135:Plain]")
		);
		assert.ok(forcedRichHtml.includes("kick-sticker"), "the local source feed must stay rich in text-only mode");
		const escapedForcedRichHtml = await page.evaluate(() =>
			window.__kickAssetTest.replaceRich('[sticker:135:"><svg onload=alert(1)>]')
		);
		assert.ok(!escapedForcedRichHtml.includes("<svg"), "forced-rich sticker labels must remain escaped");
		assert.ok(escapedForcedRichHtml.includes("&quot;&gt;&lt;svg"));

		const resolvedIds = await page.evaluate(() => window.__kickAssetTest.resolveFromBridge({
			slug: "kick-gift-test",
			broadcaster_user_id: "987654321",
			channel_id: 15462911,
			chatroom_id: 15250312,
			chatroom_source: "client",
		}));
		assert.deepStrictEqual(resolvedIds, {
			broadcasterUserId: 987654321,
			chatroomId: "15250312",
			channelId: "15462911",
			userId: "987654321",
		});

		const subscriptionChannels = await page.evaluate(() =>
			window.__kickAssetTest.setChannelIds(15250312, 15462911)
		);
		assert.deepStrictEqual(subscriptionChannels, [
			"chatrooms.15250312.v2",
			"channel.15462911",
			"channel_15462911",
		]);

		const badgePayload = {
			identity: {
				badges: [
					{ type: "moderator", text: "Moderator" },
					{ type: "subscriber", text: "Subscriber", count: 3 }
				],
				badges_v2: [
					{ name: "level", image_url: "https://ext.cdn.kick.com/chat/badges/16.png", selected: true },
					{ name: "level", image_url: "https://ext.cdn.kick.com/chat/badges/22.png", selected: false }
				]
			}
		};
		const collectedBadges = await page.evaluate(
			(payload) => window.__kickAssetTest.collectBadges(payload),
			badgePayload
		);
		assert.deepStrictEqual(collectedBadges, [
			{ type: "text", text: "Moderator" },
			{ type: "text", text: "Subscriber" },
			"https://ext.cdn.kick.com/chat/badges/16.png"
		], "legacy badges and the selected v2 badge must be merged");

		const kicksGift = {
			// Captured basic KICK Gift shape; these can omit gift_transaction_id.
			message: "",
			sender: { id: 27183991, username: "RubyRiotYT", username_color: "#FF9D00" },
			gift: {
				gift_id: "hell_yeah",
				name: "Hell Yeah",
				amount: 1,
				type: "kicks",
				tier: "tier_1",
				pinned_time: 0,
			},
			created_at: "2026-07-14T22:00:00Z",
		};
		const makeGiftFrame = (channel, payload) => ({
			event: "KicksGifted",
			channel,
			data: JSON.stringify(payload),
		});

		await page.evaluate(() => window.__kickAssetTest.resetGiftState());
		let captured = await page.evaluate(
			(frame) => window.__kickAssetTest.capturePusherFrame(frame),
			makeGiftFrame("channel.15462911", kicksGift)
		);
		assert.deepStrictEqual(captured, [], "KicksGifted must be ignored on the legacy dot channel");

		captured = await page.evaluate(
			(frame) => window.__kickAssetTest.capturePusherFrame(frame),
			makeGiftFrame("channel_15462911", kicksGift)
		);
		assert.strictEqual(captured.length, 1, "KicksGifted must be forwarded from the underscore channel");
		const giftMessage = captured[0];
		assert.ok(!Object.prototype.hasOwnProperty.call(giftMessage, "id"));
		assert.strictEqual(giftMessage.type, "kick");
		assert.strictEqual(giftMessage.chatname, "RubyRiotYT");
		assert.strictEqual(giftMessage.chatmessage, "1 KICK - Hell Yeah");
		assert.strictEqual(giftMessage.hasDonation, "1 KICK");
		assert.strictEqual(giftMessage.contentimg, "https://files.kick.com/kicks/gifts/hell-yeah.webp");
		assert.ok(!Object.prototype.hasOwnProperty.call(giftMessage, "event"));
		assert.strictEqual(giftMessage.meta.giftId, "hell_yeah");

		captured = await page.evaluate((body) => window.__kickAssetTest.captureBridgePacket({
			type: "kicks.gifted",
			messageId: "webhook-event-1",
			body,
		}), {
			broadcaster: { user_id: 15462911, username: "kick-gift-test" },
			sender: { user_id: 27183991, username: "RubyRiotYT" },
			gift: { amount: 1, name: "Hell Yeah", type: "kicks", tier: "tier_1", message: "" },
			created_at: "2026-07-14T22:00:00Z",
		});
		assert.deepStrictEqual(captured, [], "the bridge copy of a Pusher Gift must be suppressed");

		await page.evaluate(() => window.__kickAssetTest.resetGiftState());
		const transactionGift = {
			...kicksGift,
			gift_transaction_id: "340003001122334",
			message: "rock on",
		};
		captured = await page.evaluate(
			(frame) => window.__kickAssetTest.capturePusherFrame(frame),
			makeGiftFrame("channel_15462911", transactionGift)
		);
		assert.strictEqual(captured.length, 1);
		assert.strictEqual(captured[0].id, transactionGift.gift_transaction_id);
		captured = await page.evaluate(
			(frame) => window.__kickAssetTest.capturePusherFrame(frame),
			makeGiftFrame("channel_15462911", transactionGift)
		);
		assert.deepStrictEqual(captured, [], "a repeated transaction ID must be suppressed");

		captured = await page.evaluate(
			(frame) => window.__kickAssetTest.capturePusherFrame(frame),
			makeGiftFrame("channel_15462911", { ...transactionGift, gift_transaction_id: "340003001122335" })
		);
		assert.strictEqual(captured.length, 1, "a second real Gift with identical content must remain visible");

		await page.close();
		console.log("kick-websocket-assets: all assertions passed");
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
