const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

async function run() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();

	try {
		await page.goto(pathToFileURL(path.join(root, "streamelements-importer.html")).href + "?session=test-session&password=test-password");
		const setupText = await page.locator("body").innerText();
		assert.ok(setupText.includes("Windows desktop app"), "importer should name desktop-app support");
		assert.ok(setupText.includes("Chrome extension"), "importer should name extension support");
		assert.ok(setupText.includes("enable Local file"), "importer should explain the OBS local-file step");
		assert.ok(setupText.includes("Do not add the session ID in OBS"), "importer should say the session is not added in OBS");
		assert.strictEqual(await page.locator("#previewBtn").innerText(), "Demo Preview");
		assert.strictEqual(await page.locator("#livePreviewBtn").innerText(), "Live Preview");
		assert.strictEqual(await page.locator("#sessionInput").getAttribute("value"), null);
		assert.strictEqual(await page.locator("#sessionInput").evaluate(element => element.value), "test-session");
		assert.strictEqual(await page.locator("#passwordInput").evaluate(element => element.value), "test-password");
		assert.strictEqual(
			await page.locator('.guide-link[href="./docs/templates.html#streamelements-importer-guide"]').count(),
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
				buffer: Buffer.from("{}")
			},
			{
				name: "data.txt",
				mimeType: "application/json",
				buffer: Buffer.from("{}")
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

		const downloadPromise = page.waitForEvent("download");
		await page.locator("#exportBtn").click();
		const download = await downloadPromise;
		const exportedHTML = fs.readFileSync(await download.path(), "utf8");
		assert.ok(exportedHTML.includes('"session":"test-session"'), "export should embed the session supplied by the popup URL");
		assert.ok(exportedHTML.includes('"password":"test-password"'), "export should embed the optional session password");
		assert.ok(exportedHTML.includes("window.SSNSECompat.start()"), "export should include and start the compatibility runtime");
		assert.ok(await page.locator("#exportModal").evaluate(element => element.classList.contains("open")), "export should show the OBS handoff steps");
		assert.ok((await page.locator("#exportModal").innerText()).includes("Enable Local file"));
		assert.ok((await page.locator("#exportModal").innerText()).includes("do not need to paste a session ID or edit a URL in OBS"));
		assert.strictEqual(await page.locator("#exportSessionHint").count(), 0, "simple OBS handoff should not show a URL override");

		console.log("StreamElements importer shim regression tests passed");
	} finally {
		await browser.close();
	}
}

const publicGuide = fs.readFileSync(path.join(root, "docs", "templates.html"), "utf8");
assert.ok(publicGuide.includes('id="streamelements-importer-guide"'), "templates page should contain the public importer guide");
assert.ok(publicGuide.includes("This works with both the SSN Windows desktop app and Chrome extension"));

const popup = fs.readFileSync(path.join(root, "popup.html"), "utf8");
assert.ok(popup.includes("Convert it for OBS with the guided importer"), "popup should link to the guided importer");
assert.ok(popup.includes('id="streamelements_importer_link"'), "popup importer link should accept the current session");

const popupScript = fs.readFileSync(path.join(root, "popup.js"), "utf8");
assert.ok(popupScript.includes('buildGeneratedUrl("streamelements-importer.html"'), "popup should pass the current session to the importer");

run().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
