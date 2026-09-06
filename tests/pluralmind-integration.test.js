const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage();
		await page.setContent("<!doctype html><html><body></body></html>");
		await page.addInitScript(() => {
			window.__pluralmindFetchCalls = [];
			window.fetch = async (url) => {
				window.__pluralmindFetchCalls.push(String(url));
				return ({
				ok: true,
				status: 200,
				json: async () => ({
					id: "system-1",
					color: "#123456",
					pronouns: null,
					autoproxy_member_id: null,
					members: [{
						id: "member-1",
						name: "Leah",
						color: "#eb98ca",
						pronouns: "she/her",
						case_sensitive: false,
						require_space: true,
						proxies: [{ text: "L:", type: 1 }]
					}]
				})
				});
			};
		});
		await page.reload();
		await page.addScriptTag({ path: path.join(root, "shared/vendor/pluralmind.iife.js") });
		await page.addScriptTag({ path: path.join(root, "shared/integrations/pluralmind.js") });
		assert.deepStrictEqual(await page.evaluate(() => window.__pluralmindFetchCalls), [], "Loading the opt-in integration must not call the API");
		assert.strictEqual(await page.evaluate(() => typeof window.pluralmind), "undefined", "Loading the opt-in integration must not initialize the vendor library");

		const result = await page.evaluate(async () => {
			const text = await SSNPluralmindIntegration.resolveMessage({
				userId: "1234",
				username: "leahinmoonlight",
				message: "L: hihi chat~"
			});
			const rendered = await SSNPluralmindIntegration.resolveRenderedMessage({
				userId: "1234",
				message: '<span>L: hello </span><img alt="Kappa" src="kappa.png">',
				documentRef: document
			});
			return {
				text,
				rendered,
				badge: SSNPluralmindIntegration.createPronounBadge(text.pronouns)
			};
		});

		assert.strictEqual(result.text.name, "Leah");
		assert.strictEqual(result.text.color, "#eb98ca");
		assert.strictEqual(result.text.pronouns, "she/her");
		assert.strictEqual(result.text.cleanedMessage, "hihi chat~");
		assert.strictEqual(result.rendered.cleanedMessage, '<span>hello </span><img alt="Kappa" src="kappa.png">');
		assert.deepStrictEqual(await page.evaluate(() => window.__pluralmindFetchCalls), ["https://pluralmind.chat/api/v2/system/1234"]);
		assert.deepStrictEqual(result.badge, {
			text: "she/her",
			type: "text",
			bgcolor: "#000",
			color: "#FFF",
			source: "pluralmind"
		});
		assert.strictEqual(await page.evaluate(() => SSNPluralmindIntegration.createPronounBadge('<img src=x onerror="alert(1)">').text), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

		const timedOut = await page.evaluate(async () => {
			window.pluralmind = {
				getSystem: function () { return new Promise(function () {}); },
				getProxiedMessage: function () { return null; }
			};
			return SSNPluralmindIntegration.resolveMessage({ username: "timeout", message: "L: hello", timeoutMs: 10 });
		});
		assert.strictEqual(timedOut, null, "PluralMind failures must leave the Twitch message unchanged");

		const disabledPage = await browser.newPage();
		await disabledPage.setContent('<!doctype html><html><body><div class="chat-room__content"><div id="messages"><div id="backlog" class="chat-line__message"></div></div></div></body></html>');
		await disabledPage.addScriptTag({
			content: `
				window.__pluralmindAdapterCalls = 0;
				window.__twitchMessages = [];
				window.SSNPluralmindIntegration = {
					resolveRenderedMessage: function () {
						window.__pluralmindAdapterCalls++;
						throw new Error("disabled integration was called");
					}
				};
				window.fetch = function () { return Promise.resolve({ text: function () { return Promise.resolve(""); } }); };
				window.RTCPeerConnection = function () {
					this.addIceCandidate = function () { return Promise.resolve(); };
					this.createDataChannel = function () { return { send: function () {} }; };
					this.createOffer = function () { return Promise.resolve({}); };
					this.createAnswer = function () { return Promise.resolve({}); };
					this.setLocalDescription = function (description) { this.localDescription = description; return Promise.resolve(); };
					this.setRemoteDescription = function (description) { this.remoteDescription = description; return Promise.resolve(); };
				};
				window.chrome = {
					runtime: {
						id: "test-extension",
						lastError: null,
						onMessage: { addListener: function () {} },
						sendMessage: function (id, payload, callback) {
							if (payload && payload.getSettings) {
								callback({ state: true, settings: { textonlymode: false } });
								return;
							}
							if (payload && payload.message) window.__twitchMessages.push(payload.message);
							if (callback) callback({ id: window.__twitchMessages.length });
						}
					}
				};
			`
		});
		await disabledPage.addScriptTag({ path: path.join(root, "sources/twitch.js") });
		await disabledPage.waitForFunction(() => document.getElementById("backlog").dataset.ignore === "true", null, { timeout: 6000 });
		await disabledPage.evaluate(() => {
			const row = document.createElement("div");
			row.className = "chat-line__message";
			row.innerHTML = '<span class="chat-author__display-name">ViewerName</span><span class="chat-author__intl-login">(@viewerlogin)</span><span data-a-target="chat-line-message-body">Hello chat</span>';
			document.getElementById("messages").appendChild(row);
		});
		await disabledPage.waitForFunction(() => window.__twitchMessages.length === 1, null, { timeout: 6000 });
		const disabledResult = await disabledPage.evaluate(() => ({ calls: window.__pluralmindAdapterCalls, message: window.__twitchMessages[0] }));
		assert.strictEqual(disabledResult.calls, 0, "Disabled Twitch capture must never call the PluralMind adapter");
		assert.strictEqual(disabledResult.message.chatname, "ViewerName");
		assert.strictEqual(disabledResult.message.username, "viewerlogin");
		assert.strictEqual(disabledResult.message.chatmessage, "Hello chat");
		assert.strictEqual(disabledResult.message.nameColor, "");
		assert.deepStrictEqual(disabledResult.message.chatbadges, []);
		assert.strictEqual(Object.prototype.hasOwnProperty.call(disabledResult.message, "meta"), false);
	} finally {
		await browser.close();
	}

	const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
	for (const source of ["./sources/twitch.js", "./sources/websocket/twitch.js"]) {
		const entry = manifest.content_scripts.find((candidate) => candidate.js && candidate.js.includes(source));
		assert(entry, `Missing manifest entry for ${source}`);
		assert.deepStrictEqual(entry.js.slice(-3), [
			"./shared/vendor/pluralmind.iife.js",
			"./shared/integrations/pluralmind.js",
			source
		]);
	}

	const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
	assert(!background.includes("pluralmind.chat/api/"), "PluralMind API access must stay out of the global background worker");
	assert(background.includes('badge.source === "pluralmind"'), "Alejo pronouns must defer to PluralMind pronouns");
	assert(background.includes('request.setting == "pluralmind"'), "PluralMind setting changes must reach active Twitch collectors");

	const domSource = fs.readFileSync(path.join(root, "sources/twitch.js"), "utf8");
	const websocketSource = fs.readFileSync(path.join(root, "sources/websocket/twitch.js"), "utf8");
	assert(domSource.includes("settings.pluralmind") && domSource.includes("resolveRenderedMessage"), "DOM Twitch capture must call the isolated adapter only behind the setting");
	assert(websocketSource.includes("settings.pluralmind") && websocketSource.includes("resolveRenderedMessage"), "WebSocket Twitch capture must preserve emotes through the isolated adapter only behind the setting");

	const dock = fs.readFileSync(path.join(root, "dock.html"), "utf8");
	assert(dock.includes('data.delete.meta.pluralmind && data.delete.userid'), "Only PluralMind deletes should opt into stable Twitch user IDs");
	assert(dock.includes('data.delete.meta.pluralmind && data.delete.username'), "Only PluralMind deletes should opt into stable Twitch usernames");

	console.log("PluralMind integration tests passed");
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
