const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

async function run() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	await page.route(/^https?:/, route => route.abort());

	try {
		await page.goto(pathToFileURL(path.join(root, "streamelements-importer.html")).href + "?session=test-session&password=test-password");
		const setupText = await page.locator("body").innerText();
		assert.ok(setupText.includes("Windows desktop app"), "importer should name desktop-app support");
		assert.ok(setupText.includes("Chrome extension"), "importer should name extension support");
		assert.ok(setupText.includes("enable Local file"), "importer should explain the OBS local-file step");
		assert.ok(setupText.includes("choose the downloaded HTML"), "importer should explain which file goes into OBS");
		assert.strictEqual(await page.locator("#previewBtn").innerText(), "Demo Preview");
		assert.strictEqual(await page.locator("#livePreviewBtn").innerText(), "Live Preview");
		assert.strictEqual(await page.locator("#sessionInput").getAttribute("value"), null);
		assert.strictEqual(await page.locator("#sessionInput").evaluate(element => element.value), "test-session");
		assert.strictEqual(await page.locator("#passwordInput").evaluate(element => element.value), "test-password");
		assert.strictEqual(
			await page.locator('.guide-link[href="./docs/streamelements-chat-guide.html"]').count(),
			1,
			"importer should link to the full checklist"
		);
		await page.setInputFiles("#fileInput", [
			{
				name: "html.txt",
				mimeType: "text/plain",
				buffer: Buffer.from('<div id="chat-container" class="chat-container"></div>')
			},
			{
				name: "css.txt",
				mimeType: "text/plain",
				buffer: Buffer.from(".chat-row img { width: 24px; height: 24px; }")
			},
			{
				name: "fields.txt",
				mimeType: "application/json",
				buffer: Buffer.from(JSON.stringify({
					autoRemoveAfterSeconds: { label: "Duration (second)", type: "number", value: 5 },
					maxMessages: { label: "Max Messages", type: "number", value: 5, min: 1, max: 20 }
				}))
			},
			{
				name: "data.txt",
				mimeType: "application/json",
				buffer: Buffer.from(JSON.stringify({ autoRemoveAfterSeconds: 12, maxMessages: 6 }))
			},
			{
				name: "js.txt",
				mimeType: "text/plain",
				buffer: Buffer.from(`
					var chatContainer = null;
					window.addEventListener("onWidgetLoad", function () {
						chatContainer = document.getElementById("chat-container");
					});
					window.addEventListener("onEventReceived", function (incoming) {
						if (!incoming.detail || incoming.detail.listener !== "message") return;
						var event = incoming.detail.event;
						window.__lastMessageEvent = event;
						var row = document.createElement("div");
						row.className = "chat-row";
						var message = document.createElement("span");
						message.className = "message";
						var messageHTML = event.data.text;
						(event.data.emotes || []).forEach(function (emote) {
							messageHTML = messageHTML.split(emote.name).join('<img alt="' + emote.name + '" src="' + emote.urls["1"] + '">');
						});
						message.innerHTML = messageHTML;
						row.appendChild(message);
						chatContainer.appendChild(row);
					});
				`)
			}
		]);

		await page.waitForFunction(() => {
			var preview = document.getElementById("previewFrame");
			return preview && preview.srcdoc;
		});
		assert.ok((await page.locator("#statusBox").innerText()).startsWith("Ready."), "successful import should state the next step first");
		const frame = page.frames().find(candidate => candidate !== page.mainFrame());
		await frame.waitForFunction(() => window.SSNSECompat && document.getElementById("chat-container"));
		assert.strictEqual(await frame.locator("iframe").count(), 0, "Demo Preview must not connect to live chat");
		assert.strictEqual(await frame.evaluate(() => window.SSN_SE_COMPAT_CONFIG.session), "", "demo code must not contain the session ID");
		assert.strictEqual(await frame.evaluate(() => window.SSN_SE_COMPAT_CONFIG.password), "", "demo code must not contain the session password");
		await frame.waitForTimeout(1800);
		await frame.evaluate(() => window.SSNSECompat.receive({ action: "clear" }));

		const imageURL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
		await frame.evaluate(url => {
			window.SSNSECompat.receive({
				type: "youtube",
				chatname: "Emote User",
				chatmessage: 'Hello <img alt="wave" src="' + url + '">',
				mid: "emote-message-1"
			});
		}, imageURL);

		const eventData = await frame.evaluate(() => window.__lastMessageEvent);
		assert.strictEqual(eventData.data.text, "Hello wave", "data.text should remain plain text with an emote token");
		assert.strictEqual(eventData.renderedText.indexOf("<img"), 6, "renderedText should retain SSN message HTML");
		assert.strictEqual(eventData.data.emotes.length, 1, "inline SSN emotes should map to StreamElements emotes");
		assert.strictEqual(eventData.data.emotes[0].name, "wave");
		assert.strictEqual(eventData.data.emotes[0].urls["1"], imageURL);

		const row = frame.locator(".chat-row").last();
		assert.strictEqual(await row.getAttribute("data-mid"), "emote-message-1", "rendered rows should receive the SSN message ID");
		assert.strictEqual(await row.getAttribute("data-chatname"), "Emote User");
		assert.strictEqual(await row.getAttribute("data-source-type"), "youtube");
		assert.strictEqual(await row.locator("img[alt=wave]").count(), 1, "mapped emote should render through a StreamElements-style widget");

		await frame.evaluate(() => window.SSNSECompat.receive({ deleteMessage: "emote-message-1" }));
		assert.strictEqual(await frame.locator(".chat-row").count(), 0, "deleteMessage should remove a row that ignores the delete event");
		const plain = await frame.evaluate(() => window.SSNSECompat.mapMessage({ chatmessage: "<b>Hello</b> &amp;", textonly: true }));
		assert.strictEqual(plain.data.text, "<b>Hello</b> &amp;", "plain text must retain literal tags and entities");
		assert.strictEqual(plain.renderedText, "&lt;b&gt;Hello&lt;/b&gt; &amp;amp;", "renderedText must escape plain-text messages");

		assert.strictEqual(await page.locator("#messageSettings").isVisible(), true, "recognized message settings should be shown");
		assert.strictEqual(await page.locator("#messageDuration").inputValue(), "12");
		assert.strictEqual(await page.locator("#maxMessages").inputValue(), "6");
		await page.locator("#keepMessagesVisible").check();
		await page.locator("#maxMessages").fill("20");
		await page.locator("#maxMessages").press("Tab");

		const downloadPromise = page.waitForEvent("download");
		await page.locator("#exportBtn").click();
		const download = await downloadPromise;
		const exportedHTML = fs.readFileSync(await download.path(), "utf8");
		assert.ok(exportedHTML.includes('"session":"test-session"'), "export should embed the session supplied by the popup URL");
		assert.ok(exportedHTML.includes('"password":"test-password"'), "export should embed the optional session password");
		assert.ok(exportedHTML.includes('"autoRemoveAfterSeconds":0'), "export should preserve the user's disabled auto-hide setting");
		assert.ok(exportedHTML.includes('"maxMessages":20'), "export should preserve the user's message-limit setting");
		assert.ok(exportedHTML.includes("window.SSNSECompat.start()"), "export should include and start the compatibility runtime");
		assert.ok(await page.locator("#exportModal").evaluate(element => element.classList.contains("open")), "export should show the OBS handoff steps");
		assert.ok((await page.locator("#exportModal").innerText()).includes("Enable Local file"));
		assert.ok((await page.locator("#exportModal").innerText()).includes("do not need to paste a session ID or edit a URL in OBS"));
		assert.strictEqual(await page.locator("#exportSessionHint").count(), 0, "simple OBS handoff should not show a URL override");

		await page.keyboard.press("Tab");
		assert.strictEqual(await page.evaluate(() => document.activeElement.id), "downloadReadmeBtn", "modal should wrap focus");
		await page.keyboard.press("Shift+Tab");
		assert.strictEqual(await page.evaluate(() => document.activeElement.id), "closeExportModalBtn");
		await page.keyboard.press("Escape");
		assert.strictEqual(await page.locator("#exportModal").isVisible(), false);
		assert.strictEqual(await page.evaluate(() => document.activeElement.id), "exportBtn", "closing the modal should restore focus");
		await page.setInputFiles("#fileInput", [
			{
				name: "html.txt",
				mimeType: "text/plain",
				buffer: Buffer.from('<div id="chat-container"></div>')
			},
			{
				name: "fields.txt",
				mimeType: "application/json",
				buffer: Buffer.from(JSON.stringify({ hideAfter: { type: "number", value: 999 } }))
			},
			{
				name: "data.txt",
				mimeType: "application/json",
				buffer: Buffer.from(JSON.stringify({ hideAfter: 999 }))
			}
		]);
		await page.waitForFunction(() => {
			return document.getElementById("keepMessagesVisible").checked && document.getElementById("messageDuration").value === "10";
		});
		assert.strictEqual(await page.locator("#messageDuration").inputValue(), "10", "re-enabling standard hideAfter should start from a useful duration");
		assert.strictEqual(await page.locator("#messageDuration").isEnabled(), false);
		await page.locator("#keepMessagesVisible").uncheck();
		assert.strictEqual(await page.locator("#messageDuration").isEnabled(), true);

		await checkImportLifecycle(page);

		console.log("StreamElements importer shim regression tests passed");
	} finally {
		await browser.close();
	}
}

async function checkImportLifecycle(page) {
	function file(name, text) {
		return { name, mimeType: "text/plain", buffer: Buffer.from(text) };
	}
	async function ready() {
		await page.waitForFunction(() => !document.getElementById("previewBtn").disabled);
	}

	await page.setInputFiles("#fileInput", [file("readme.txt", "This pack has no widget code.")]);
	await page.waitForFunction(() => document.getElementById("statusBox").textContent.includes("No widget code found"));
	assert.strictEqual(await page.locator("#exportBtn").isEnabled(), false, "invalid inputs must not produce a successful-looking export");
	assert.strictEqual(await page.locator("#previewFrame").getAttribute("srcdoc"), null, "invalid imports must clear the old preview");

	await page.setInputFiles("#zipInput", [file("broken.zip", "not a zip")]);
	await page.waitForFunction(() => document.getElementById("statusBox").textContent.includes("Could not read zip"));
	assert.strictEqual(await page.locator("#statusBox").getAttribute("aria-busy"), "false");
	assert.strictEqual(await page.locator("#exportBtn").isEnabled(), false);

	await page.locator("#sessionInput").fill("");
	await page.setInputFiles("#fileInput", [file("html.txt", '<div id="chat-container"></div>'), file("fields.txt", "{broken}")]);
	await ready();
	assert.ok((await page.locator("#statusBox").innerText()).includes("Invalid settings JSON in fields.txt"));
	assert.strictEqual(await page.locator("#livePreviewBtn").isEnabled(), false);
	assert.strictEqual(await page.locator("#exportBtn").isEnabled(), false);
	const frame = page.frames().find(candidate => candidate !== page.mainFrame());
	await frame.waitForFunction(() => window.SSNSECompat);
	await frame.evaluate(() => window.SSNSECompat.receive({ chatname: "<Viewer>", chatmessage: '<b>literal</b> &amp;', textonly: true, mid: "literal" }));
	const row = frame.locator('[data-mid="literal"]');
	assert.strictEqual(await row.locator(".user-message").innerText(), "<b>literal</b> &amp;");
	assert.strictEqual(await row.locator("b").count(), 0, "fallback renderer must not treat plain-text chat as HTML");

	await page.locator("#sessionInput").fill("test-session");
	await page.locator("#livePreviewBtn").click();
	await frame.waitForFunction(() => window.SSN_SE_COMPAT_CONFIG && window.SSN_SE_COMPAT_CONFIG.preview === false && document.querySelector("iframe"));
	assert.ok((await frame.locator("iframe").getAttribute("src")).includes("room=test-session"), "live preview must use the chosen session");
	await page.locator("#previewBtn").click();
	await frame.waitForFunction(() => window.SSN_SE_COMPAT_CONFIG && window.SSN_SE_COMPAT_CONFIG.preview === true);
	assert.strictEqual(await frame.locator("iframe").count(), 0, "switching back to Demo must remove the live bridge");

	// Pause remote asset processing, then clear or replace the active import.
	await page.evaluate(() => {
		window.__originalFetch = window.fetch;
		window.fetch = function () {
			return new Promise(resolve => {
				window.__finishAsset = () => resolve({ ok: true, text: () => Promise.resolve(".stale { color: red; }") });
			});
		};
	});
	const slowFiles = [file("html.txt", '<div id="old-widget"></div>'), file("css.txt", '@import url("https://example.test/style.css");')];
	await page.setInputFiles("#fileInput", slowFiles);
	await page.waitForFunction(() => window.__finishAsset);
	assert.strictEqual(await page.locator("#exportBtn").isEnabled(), false, "export stays disabled while processing");
	await page.locator("#clearBtn").click();
	await page.evaluate(async () => { window.__finishAsset(); await new Promise(resolve => setTimeout(resolve, 30)); });
	assert.strictEqual(await page.locator("#previewFrame").getAttribute("srcdoc"), null, "clear must invalidate pending import work");
	assert.strictEqual(await page.locator("#exportBtn").isEnabled(), false);
	assert.strictEqual(await page.locator("#fileInput").inputValue(), "", "clear must allow the same files to be selected again");

	await page.evaluate(() => { window.__finishAsset = null; });
	await page.setInputFiles("#fileInput", slowFiles);
	await page.waitForFunction(() => window.__finishAsset);
	await page.setInputFiles("#fileInput", [file("html.txt", '<div id="new-widget"></div>')]);
	await ready();
	await page.evaluate(async () => { window.__finishAsset(); await new Promise(resolve => setTimeout(resolve, 30)); });
	const markup = await page.locator("#previewFrame").getAttribute("srcdoc");
	assert.ok(markup.includes('id="new-widget"'), "latest selected widget must win");
	assert.ok(!markup.includes(".stale"), "old asset requests must not mutate the new import");

	// Exercise the timeout fallback without waiting eight seconds.
	await page.evaluate(() => {
		window.__originalSetTimeout = window.setTimeout;
		window.setTimeout = function (callback, delay) { return window.__originalSetTimeout(callback, delay === 8000 ? 25 : delay); };
		window.fetch = () => new Promise(() => {});
	});
	await page.setInputFiles("#fileInput", [file("html.txt", '<div id="chat-container"></div>'), file("css.txt", '.art { background: url("https://example.test/missing.png"); }')]);
	await ready();
	assert.ok((await page.locator("#statusBox").innerText()).includes("Remote assets left as URLs: 1"), "slow assets must not block preview and export indefinitely");
	await page.evaluate(() => { window.fetch = window.__originalFetch; window.setTimeout = window.__originalSetTimeout; });

	// An HTML-only widget script must not also receive the generic fallback rows.
	await page.setInputFiles("#fileInput", [file("widget.html", '<div id="chat-container"></div><script>window.addEventListener("onEventReceived", function(){ var p=document.createElement("p"); p.className="custom-row"; document.getElementById("chat-container").appendChild(p); });</script>')]);
	await ready();
	await frame.waitForFunction(() => window.SSNSECompat && window.SSN_SE_COMPAT_CONFIG.hasWidgetScript);
	await frame.evaluate(() => window.SSNSECompat.receive({ chatname: "Viewer", chatmessage: "Hello", mid: "inline-widget" }));
	assert.ok(await frame.locator(".custom-row").count());
	assert.strictEqual(await frame.locator(".message-row").count(), 0, "HTML inline scripts must not get duplicate generic rows");
}

const publicGuide = fs.readFileSync(path.join(root, "docs", "templates.html"), "utf8");
assert.ok(publicGuide.includes('id="streamelements-importer-guide"'), "templates page should contain the public importer guide");
assert.ok(publicGuide.includes("This works with both the SSN Windows desktop app and Chrome extension"));

const popup = fs.readFileSync(path.join(root, "popup.html"), "utf8");
assert.ok(popup.includes("Import StreamElements / Streamlabs chat skin"), "popup should name the importer clearly");
assert.ok(popup.includes('id="streamelements_importer_link"'), "popup importer link should accept the current session");

const popupScript = fs.readFileSync(path.join(root, "popup.js"), "utf8");
assert.ok(popupScript.includes('buildGeneratedUrl("streamelements-importer.html"'), "popup should pass the current session to the importer");

run().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
