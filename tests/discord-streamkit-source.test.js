const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "discordstreamkit.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const manifestEntry = manifest.content_scripts.find((entry) =>
	entry.js && entry.js.includes("./sources/discordstreamkit.js")
);
assert.ok(manifestEntry, "Discord StreamKit content script entry is missing");
assert.deepStrictEqual(manifestEntry.matches, ["https://streamkit.discord.com/overlay/chat/*"]);

async function installFixture(page, useChromeRuntime) {
	await page.setContent(`
		<!doctype html>
		<html>
			<body>
				<div class="Chat_chatContainer__fixture">
					<div class="Chat_channelName__fixture">#reactions</div>
					<ul class="Chat_messages__fixture">
						<li class="Chat_message__fixture">
							<span class="Chat_timestamp__fixture">12:40 AM</span>
							<span class="Chat_username__fixture">Backlog</span>
							<span class="Chat_messageText__fixture">Already visible</span>
						</li>
					</ul>
				</div>
			</body>
		</html>
	`);

	await page.addScriptTag({
		content: `
			window.__streamKitMessages = [];
			window.__streamKitRuntimeListener = null;
			window.__addStreamKitMessage = function (name, messageHtml, color) {
				var row = document.createElement("li");
				row.className = "Chat_message__fixture";
				row.innerHTML = '<span class="Chat_timestamp__fixture">12:41 AM</span>'
					+ '<span class="Chat_username__fixture" style="color:' + (color || '') + '"></span>'
					+ '<span class="Chat_messageText__fixture"></span>';
				row.querySelector('[class^="Chat_username__"]').textContent = name;
				row.querySelector('[class^="Chat_messageText__"]').innerHTML = messageHtml;
				document.querySelector('[class^="Chat_messages__"]').appendChild(row);
				return row;
			};
			window.__sendStreamKitRuntimeMessage = function (request) {
				return new Promise(function (resolve) {
					window.__streamKitRuntimeListener(request, {}, resolve);
				});
			};
		`
	});

	if (useChromeRuntime) {
		await page.addScriptTag({
			content: `
				window.chrome = {
					runtime: {
						id: "test-extension",
						lastError: null,
						sendMessage: function (id, payload, callback) {
							if (payload && payload.getSettings) {
								if (callback) callback({ state: true, settings: { discord: true, textonlymode: false } });
								return;
							}
							if (payload && payload.message) window.__streamKitMessages.push(payload.message);
							if (callback) callback({});
						},
						onMessage: {
							addListener: function (listener) {
								window.__streamKitRuntimeListener = listener;
							}
						}
					}
				};
			`
		});
	} else {
		await page.addScriptTag({
			content: `
				window.ninjafy = {
					sendMessage: function (id, payload) {
						if (payload && payload.message) window.__streamKitMessages.push(payload.message);
					}
				};
			`
		});
	}

	await page.addScriptTag({ content: source });
	await page.waitForFunction(() =>
		document.querySelector('[class^="Chat_message__"]').dataset.ssnStreamKitSeen === "true"
	);
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const extensionPage = await browser.newPage();
		await installFixture(extensionPage, true);
		assert.strictEqual((await extensionPage.evaluate(() => window.__streamKitMessages.length)), 0,
			"initial StreamKit history should be skipped");

		await extensionPage.evaluate(() => {
			window.__addStreamKitMessage(
				"meevepics",
				'Hello &lt;Discord&gt; <strong>friends</strong> <img src="https://cdn.discordapp.com/emojis/123.webp" alt=":wave:">',
				"rgb(88, 101, 242)"
			);
		});
		await extensionPage.waitForFunction(() => window.__streamKitMessages.length === 1);
		const richMessage = await extensionPage.evaluate(() => window.__streamKitMessages[0]);
		assert.strictEqual(richMessage.type, "discord");
		assert.strictEqual(richMessage.chatname, "meevepics");
		assert.strictEqual(richMessage.nameColor, "rgb(88, 101, 242)");
		assert.strictEqual(richMessage.chatimg, "");
		assert.strictEqual(richMessage.contentimg, "");
		assert.strictEqual(richMessage.textonly, false);
		assert.ok(richMessage.chatmessage.includes("Hello &lt;Discord&gt; <strong>friends</strong>"));
		assert.ok(richMessage.chatmessage.includes('class="zero-width-emote"'));

		assert.strictEqual(
			await extensionPage.evaluate(() => window.__sendStreamKitRuntimeMessage("getSource")),
			"discord"
		);
		assert.strictEqual(
			await extensionPage.evaluate(() => window.__sendStreamKitRuntimeMessage("focusChat")),
			false
		);

		await extensionPage.evaluate(() =>
			window.__sendStreamKitRuntimeMessage({ settings: { discord: true, textonlymode: true } })
		);
		await extensionPage.evaluate(() => {
			window.__addStreamKitMessage(
				"plain-user",
				'Plain <strong>bold</strong> <img src="https://cdn.discordapp.com/emojis/456.webp" alt=":party:">',
				""
			);
		});
		await extensionPage.waitForFunction(() => window.__streamKitMessages.length === 2);
		const plainMessage = await extensionPage.evaluate(() => window.__streamKitMessages[1]);
		assert.strictEqual(plainMessage.textonly, true);
		assert.strictEqual(plainMessage.chatmessage, "Plain bold :party:");

		await extensionPage.evaluate(() => window.__sendStreamKitRuntimeMessage({ state: false }));
		await extensionPage.evaluate(() => window.__addStreamKitMessage("disabled", "Do not send", ""));
		await extensionPage.waitForTimeout(300);
		assert.strictEqual(await extensionPage.evaluate(() => window.__streamKitMessages.length), 2);

		const electronPage = await browser.newPage();
		await installFixture(electronPage, false);
		await electronPage.evaluate(() => window.__addStreamKitMessage("electron-user", "App bridge", ""));
		await electronPage.waitForFunction(() => window.__streamKitMessages.length === 1);
		assert.strictEqual(
			await electronPage.evaluate(() => window.__streamKitMessages[0].chatmessage),
			"App bridge"
		);
	} finally {
		await browser.close();
	}

	console.log("Discord StreamKit source passed (manifest, backlog, rich text, state, and app bridge).");
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
