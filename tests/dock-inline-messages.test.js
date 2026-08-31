#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const message = {
	id: "inline-message-test",
	type: "twitch",
	chatname: "ByteSizedKai",
	chatmessage: "test test test test test test test test test test test test test test test test test test test test test test test test test test test test test test test test",
	chatimg: "",
	textonly: true
};

async function renderDock(browser, query) {
	const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
	await page.route("https://vdo.socialstream.ninja/**", route => route.fulfill({
		status: 200,
		contentType: "text/html",
		body: "<!doctype html><html><body></body></html>"
	}));
	await page.addInitScript(() => {
		document.addEventListener("DOMContentLoaded", () => document.body.classList.add("OBS"));
	});
	await page.goto(`${pathToFileURL(path.join(root, "dock.html")).href}?session=inline-message-test&noavatar&notime&hidesource&${query}`, {
		waitUntil: "domcontentloaded"
	});
	const iframe = page.locator("iframe").first();
	await iframe.waitFor();
	const iframeHandle = await iframe.elementHandle();
	const frame = iframeHandle ? await iframeHandle.contentFrame() : null;
	assert.ok(frame, "Dock did not create its transport iframe");
	await frame.evaluate(incomingMessage => {
		parent.postMessage({ dataReceived: { overlayNinja: incomingMessage } }, "*");
	}, message);
	await page.waitForSelector("#msg_inline-message-test");
	return page;
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const defaultDock = await renderDock(browser, "");
		assert.equal(await defaultDock.locator("body.inlinechat").count(), 0, "Default Dock unexpectedly enabled inline flow");
		assert.equal(await defaultDock.locator("#msg_inline-message-test > .hl-name").textContent(), "ByteSizedKai");
		const defaultNameBox = await defaultDock.locator("#msg_inline-message-test > .hl-name").boundingBox();
		const defaultMessageBox = await defaultDock.locator("#msg_inline-message-test > .hl-message").boundingBox();
		assert.ok(defaultMessageBox.y >= defaultNameBox.y + defaultNameBox.height - 1, "Default 800px layout behavior changed");

		const inlineDock = await renderDock(browser, "inline");
		assert.equal(await inlineDock.locator("body.inlinechat.notcompactmode").count(), 1, "Inline mode must retain normal styling");
		assert.equal(await inlineDock.locator("#msg_inline-message-test > .hl-name").textContent(), "ByteSizedKai:");
		const inlineNameBox = await inlineDock.locator("#msg_inline-message-test > .hl-name").boundingBox();
		const inlineMessageBox = await inlineDock.locator("#msg_inline-message-test > .hl-message").boundingBox();
		assert.ok(Math.abs(inlineMessageBox.y - inlineNameBox.y) < 12, "Inline message did not start beside the username");
		assert.ok(inlineMessageBox.height > inlineNameBox.height, "Long inline message did not wrap");

		const compactDock = await renderDock(browser, "compact");
		assert.equal(await compactDock.locator("body.notcompactmode").count(), 0, "Compact mode behavior changed");
		assert.equal(await compactDock.locator("#msg_inline-message-test > .hl-message > .hl-name").count(), 1, "Compact markup behavior changed");

		for (const conflict of [
			{ params: "bubble", nameSelector: "#msg_inline-message-test > .hl-name" },
			{ params: "split", nameSelector: "#msg_inline-message-test > .leftside .hl-name" }
		]) {
			const baseline = await renderDock(browser, conflict.params);
			const withInline = await renderDock(browser, `${conflict.params}&inline`);
			assert.equal(await withInline.locator("body.inlinechat").count(), 0, `${conflict.params} must take precedence over inline mode`);
			assert.equal(await withInline.locator(conflict.nameSelector).textContent(), "ByteSizedKai", `${conflict.params} unexpectedly gained inline punctuation`);
			assert.deepEqual(
				await withInline.locator("#msg_inline-message-test").boundingBox(),
				await baseline.locator("#msg_inline-message-test").boundingBox(),
				`${conflict.params} layout changed when inline was also requested`
			);
		}

		console.log("PASS: inline messages are opt-in and specialized layouts take precedence without changing.");
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
