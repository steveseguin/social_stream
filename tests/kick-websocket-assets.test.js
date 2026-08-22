const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const source = fs.readFileSync(
	path.resolve(__dirname, "..", "sources", "websocket", "kick.js"),
	"utf8"
);

function findImage(result, className) {
	return result.images.find((image) => image.classes.includes(className));
}

(async () => {
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
				window.__kickAssetTest = {
					render: function (message, fallback, payload) {
						return renderKickMessageHtml(message, fallback, payload);
					},
					replaceRich: function (value) {
						return replaceKickInlineAssets(value, { forceRich: true });
					},
					setTextOnly: function (value) {
						extension.settings.textonlymode = { setting: value === true };
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

		await page.close();
		console.log("kick-websocket-assets: all assertions passed");
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
