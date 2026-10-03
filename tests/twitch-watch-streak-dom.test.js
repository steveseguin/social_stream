#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "twitch.js"), "utf8");

async function installFixture(page, enabled) {
	await page.setContent(`<!doctype html><html><body><div class="chat-room__content"><div id="messages"><div id="backlog" class="chat-line__message"></div></div></div></body></html>`);
	await page.addScriptTag({
		content: `
			window.__twitchMessages = [];
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
							callback({ state: true, settings: { textonlymode: false, showtwitchwatchstreaks: ${enabled ? "true" : "false"} } });
							return;
						}
						if (payload && payload.message) window.__twitchMessages.push(payload.message);
						if (callback) callback({ id: window.__twitchMessages.length });
					}
				}
			};
		`
	});
	await page.addScriptTag({ content: source });
	await page.waitForFunction(() => document.getElementById("backlog").dataset.ignore === "true", null, { timeout: 6000 });
}

async function appendWatchStreak(page) {
	await page.evaluate(() => {
		const notice = document.createElement("div");
		notice.className = "user-notice-line watch-streak";
		notice.id = "dom-milestone-7";
		notice.innerHTML = `
			<span class="chat-author__display-name">ViewerName</span>
			<span data-test-selector="chat-line-message-body">ViewerName watched 7 consecutive streams and sparked a watch streak!</span>
		`;
		document.getElementById("messages").appendChild(notice);
	});
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const disabledPage = await browser.newPage();
		await installFixture(disabledPage, false);
		await appendWatchStreak(disabledPage);
		await disabledPage.waitForTimeout(500);
		assert.equal(await disabledPage.evaluate(() => window.__twitchMessages.length), 0, "DOM Watch Streaks must be off by default");

		const enabledPage = await browser.newPage();
		await installFixture(enabledPage, true);
		await appendWatchStreak(enabledPage);
		await enabledPage.waitForFunction(() => window.__twitchMessages.length === 1);
		const message = await enabledPage.evaluate(() => window.__twitchMessages[0]);
		assert.equal(message.event, "watch_streak");
		assert.equal(message.chatname, "ViewerName");
		assert.equal(message.meta.streakCount, 7);
		assert.equal(message.meta.milestoneId, "dom-milestone-7");
	} finally {
		await browser.close();
	}

	console.log("PASS: Twitch DOM Watch Streak capture is opt-in and normalized.");
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
