#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const dockUrl = pathToFileURL(path.resolve(__dirname, "..", "dock.html")).href;
const quoted = 'Replying to Alex: original question';
const answer = 'The new answer <b>stays readable</b>';
const html = '<i><small>' + quoted + ':&nbsp;</small></i> ' + answer;

(async () => {
	const browser = await chromium.launch({ headless: true, args: ["--renderer-process-limit=2"] });
	try {
		const page = await browser.newPage();
		// Dock disables window.eval; read computed styles through DevTools without changing that guard.
		const cdp = await page.context().newCDPSession(page);
		async function color(selector) {
			const result = await cdp.send("Runtime.evaluate", { expression: "getComputedStyle(document.querySelector(" + JSON.stringify(selector) + ")).color", returnByValue: true });
			return result.result.value;
		}
		await page.route(/^https?:/, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html></html>" }));
		await page.addInitScript(() => {
			document.addEventListener("DOMContentLoaded", () => document.body.classList.add("OBS"));
		});
		for (const scenario of [
			{ query: "", colored: false },
			{ query: "replycolor", colored: true, color: "rgb(168, 179, 207)" },
			{ query: "replycolor=%23ffcc00", colored: true, color: "rgb(255, 204, 0)" },
			{ query: "replycolor=00ccff&bubble&twolines", colored: true, color: "rgb(0, 204, 255)" },
			{ query: "replycolor=%23ffcc00&stripreplyto", colored: false, stripped: true },
			{ query: "replycolor=%23ffcc00&striphtml", colored: true, color: "rgb(255, 204, 0)", htmlStripped: true },
			{ query: "replycolor=%23ffcc00&normalize", colored: true, color: "rgb(255, 204, 0)" },
			{ query: "replycolor=%23ffcc00", colored: true, color: "rgb(255, 204, 0)", textonly: true }
		]) {
			await page.goto(dockUrl + "?session=reply-color-local-test&noavatar&notime&hidesource&" + scenario.query, { waitUntil: "domcontentloaded" });
			const iframe = await page.locator("iframe").first().elementHandle();
			const frame = await iframe.contentFrame();
			const message = {
				id: "reply-color-test", type: "kick", chatname: "LocalTest",
				initial: quoted, reply: answer,
				chatmessage: scenario.textonly ? quoted + ": " + answer : html,
				textonly: !!scenario.textonly
			};
			await frame.evaluate(data => parent.postMessage({ dataReceived: { overlayNinja: data } }, "*"), message);
			const content = page.locator("#content_reply-color-test");
			await content.waitFor();
			assert.equal(await content.locator(".reply-context").count(), scenario.colored ? 1 : 0, scenario.query);
			if (scenario.colored) {
				assert.equal(await color("#content_reply-color-test .reply-context"), scenario.color);
				assert.equal((await content.locator(".reply-context").textContent()).trim(), quoted + ":");
				assert.notEqual(await color("#content_reply-color-test"), scenario.color);
			}
			assert.equal(await content.locator("b").count(), scenario.textonly || scenario.htmlStripped ? 0 : 1, "Plain text must stay escaped; HTML formatting must survive");
			if (scenario.stripped) assert.equal(await content.textContent(), "The new answer stays readable");

			await frame.evaluate(() => parent.postMessage({ dataReceived: { overlayNinja: {
				id: "ordinary-test", type: "youtube", chatname: "LocalTest",
				chatmessage: "<i><small>Ordinary italic text</small></i> body", textonly: false
			} } }, "*"));
			await page.locator("#content_ordinary-test").waitFor();
			assert.equal(await page.locator("#content_ordinary-test .reply-context").count(), 0);
		}
		console.log("PASS: reply colors are opt-in, preserve the new message, and respect stripping/plain text.");
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
