const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "worldswave.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const manifestEntry = manifest.content_scripts.find((entry) =>
	entry.js && entry.js.includes("./sources/worldswave.js")
);
assert.ok(manifestEntry, "WorldsWave content script entry is missing");
assert.deepStrictEqual(manifestEntry.matches, ["https://worldswave.com/*", "https://www.worldswave.com/*"]);

async function installFixture(page) {
	await page.setContent(`
		<!doctype html>
		<html>
			<body>
				<div id="viewer-count" class="ww-viewer-count" data-ww-viewer-count="12">12 viewers</div>
				<div data-ww-chat-root data-ww-channel="Ryan Roman">
					<div id="preview" data-ww-chat-list>
						<div class="ww-chat-message" data-ww-msg-id="backlog-1" data-ww-user-id="old-user" data-ww-display-name="Backlog User">
							<span class="ww-chat-display-name">Backlog User</span>
							<span class="ww-chat-body">Already visible</span>
						</div>
					</div>
				</div>
				<div data-ww-chat-root data-ww-channel="Ryan Roman"><div id="full-chat" data-ww-chat-list></div></div>
				<textarea id="chat-input" placeholder="Write a comment"></textarea>
			</body>
		</html>
	`);

	await page.addScriptTag({
		content: `
			window.__worldsWaveMessages = [];
			window.__worldsWaveRuntimeListener = null;
			window.chrome = {
				runtime: {
					id: "test-extension",
					lastError: null,
					sendMessage: function (id, payload, callback) {
						if (payload && payload.getSettings) {
							if (callback) callback({ state: true, settings: { textonlymode: false, showviewercount: true } });
							return;
						}
						if (payload && payload.message) window.__worldsWaveMessages.push(payload.message);
						if (callback) callback({});
					},
					onMessage: {
						addListener: function (listener) { window.__worldsWaveRuntimeListener = listener; }
					}
				}
			};
			window.__sendWorldsWaveRuntimeMessage = function (request) {
				return new Promise(function (resolve) {
					window.__worldsWaveRuntimeListener(request, {}, resolve);
				});
			};
			window.__addWorldsWaveMessage = function (containerId, id, name, text) {
				var row = document.createElement("div");
				row.className = "ww-chat-message";
				row.setAttribute("data-ww-msg-id", id);
				row.setAttribute("data-ww-user-id", "user-42");
				row.setAttribute("data-ww-display-name", name);
				row.setAttribute("data-ww-name-color", "rgb(12, 34, 56)");
				row.setAttribute("data-ww-mod", "1");
				row.setAttribute("data-ww-membership", "Wave Member");
				row.setAttribute("data-ww-donation", "$5.00");

				var avatar = document.createElement("img");
				avatar.className = "ww-chat-avatar";
				avatar.src = "https://worldswave.com/avatar.png";

				var badge = document.createElement("span");
				badge.className = "ww-chat-badge";
				badge.setAttribute("data-ww-badge", "Moderator");

				var author = document.createElement("span");
				author.className = "ww-chat-display-name";
				author.textContent = name;

				var body = document.createElement("span");
				body.className = "ww-chat-body";
				body.innerHTML = text;

				var attachment = document.createElement("img");
				attachment.className = "ww-chat-attachment";
				attachment.src = "https://worldswave.com/attachment.png";

				row.appendChild(avatar);
				row.appendChild(badge);
				row.appendChild(author);
				row.appendChild(body);
				row.appendChild(attachment);
				document.getElementById(containerId).appendChild(row);
				return row;
			};
		`
	});

	await page.addScriptTag({ content: source });
	await page.waitForFunction(() => document.querySelector('[data-ww-msg-id="backlog-1"]').dataset.ssnLastMessageSignature);
}

function chatMessages(page) {
	return page.evaluate(() => window.__worldsWaveMessages.filter((message) => !message.event));
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage();
		await installFixture(page);

		assert.strictEqual((await chatMessages(page)).length, 0, "initial chat history should be skipped");
		await page.waitForFunction(() =>
			window.__worldsWaveMessages.some((message) => message.event === "viewer_update" && message.meta === 12)
		);

		await page.evaluate(() => {
			window.__addWorldsWaveMessage(
				"preview",
				"message-100",
				"Ryan Roman",
				'Hello &lt;WorldsWave&gt; <strong>friends</strong> <img src="https://worldswave.com/emote.png" alt=":wave:">'
			);
			window.__addWorldsWaveMessage(
				"full-chat",
				"message-100",
				"Ryan Roman",
				'Hello &lt;WorldsWave&gt; <strong>friends</strong> <img src="https://worldswave.com/emote.png" alt=":wave:">'
			);
		});
		await page.waitForFunction(() => window.__worldsWaveMessages.filter((message) => !message.event).length === 1);

		const richMessage = (await chatMessages(page))[0];
		assert.strictEqual(richMessage.type, "worldswave");
		assert.strictEqual(richMessage.chatname, "Ryan Roman");
		assert.strictEqual(richMessage.userid, "user-42");
		assert.strictEqual(richMessage.nameColor, "rgb(12, 34, 56)");
		assert.strictEqual(richMessage.mod, true);
		assert.strictEqual(richMessage.membership, "Wave Member");
		assert.strictEqual(richMessage.hasDonation, "$5.00");
		assert.strictEqual(richMessage.chatimg, "https://worldswave.com/avatar.png");
		assert.strictEqual(richMessage.contentimg, "https://worldswave.com/attachment.png");
		assert.strictEqual(richMessage.sourceName, "Ryan Roman");
		assert.deepStrictEqual(richMessage.meta, { messageId: "message-100" });
		assert.deepStrictEqual(richMessage.chatbadges, [{ type: "text", text: "Moderator" }]);
		assert.ok(richMessage.chatmessage.includes("Hello &lt;WorldsWave&gt; friends"), richMessage.chatmessage);
		assert.ok(richMessage.chatmessage.includes('<img src="https://worldswave.com/emote.png" alt=":wave:">'));

		await page.evaluate(() => {
			window.__addWorldsWaveMessage("preview", "message-101", "Ryan Roman", "Same text");
			window.__addWorldsWaveMessage("preview", "message-102", "Ryan Roman", "Same text");
		});
		await page.waitForFunction(() => window.__worldsWaveMessages.filter((message) => !message.event).length === 3);

		await page.evaluate(() => {
			var count = document.getElementById("viewer-count");
			count.setAttribute("data-ww-viewer-count", "1,234");
			return window.__sendWorldsWaveRuntimeMessage({
				settings: { textonlymode: false, showviewercount: true }
			});
		});
		await page.waitForFunction(() =>
			window.__worldsWaveMessages.some((message) => message.event === "viewer_update" && message.meta === 1234)
		);

		await page.evaluate(() => window.__sendWorldsWaveRuntimeMessage({
			settings: { textonlymode: true, showviewercount: false }
		}));
		await page.evaluate(() => {
			window.__addWorldsWaveMessage(
				"preview",
				"message-103",
				"Plain User",
				'Plain <strong>bold</strong> <img src="https://worldswave.com/emote.png" alt=":wave:">'
			);
		});
		await page.waitForFunction(() => window.__worldsWaveMessages.filter((message) => !message.event).length === 4);
		const plainMessage = (await chatMessages(page))[3];
		assert.strictEqual(plainMessage.textonly, true);
		assert.strictEqual(plainMessage.chatmessage, "Plain bold :wave:");

		assert.strictEqual(await page.evaluate(() => window.__sendWorldsWaveRuntimeMessage("getSource")), "worldswave");
		assert.strictEqual(await page.evaluate(() => window.__sendWorldsWaveRuntimeMessage("focusChat")), true);
		assert.strictEqual(await page.evaluate(() => document.activeElement.id), "chat-input");

		console.log("WorldsWave source tests passed");
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
