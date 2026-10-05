#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const dockUrl = pathToFileURL(path.resolve(__dirname, "..", "dock.html")).href;
const quoted = 'Replying to Alex: original question';
const answer = 'The new answer <b>stays readable</b>';

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
			{ query: "replycolor=%23ffcc00", colored: true, color: "rgb(255, 204, 0)", type: "twitch" },
			{ query: "replycolor=%23ffcc00", colored: true, color: "rgb(255, 204, 0)", type: "youtube" },
			{ query: "replycolor=%23ffcc00&replylabelcolor", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(255, 255, 255)", type: "twitch", event: "action" },
			{ query: "replycolor=%23ffcc00", colored: true, color: "rgb(255, 204, 0)", type: "twitch", event: "bits" },
			{ query: "replylabelcolor", colored: false, labelColor: "rgb(255, 255, 255)", type: "twitch", event: "action" },
			{ query: "", colored: false, type: "twitch", event: "action" },
			{ query: "replycolor=00ccff&bubble&twolines", colored: true, color: "rgb(0, 204, 255)" },
			{ query: "replycolor=%23ffcc00&stripreplyto", colored: false, stripped: true },
			{ query: "replycolor=%23ffcc00&striphtml", colored: true, color: "rgb(255, 204, 0)", htmlStripped: true },
			{ query: "replycolor=%23ffcc00&normalize", colored: true, color: "rgb(255, 204, 0)" },
			{ query: "replycolor=%23ffcc00", colored: true, color: "rgb(255, 204, 0)", textonly: true },
			{ query: "replycolor=%23ffcc00&replylabelcolor", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(255, 255, 255)" },
			{ query: "replycolor=%23ffcc00&replylabelcolor=%2300ccff", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(0, 204, 255)", textonly: true },
			{ query: "replylabelcolor=%2300ccff", colored: false, labelColor: "rgb(0, 204, 255)" },
			{ query: "replylabelcolor&stripreplyto", colored: false, stripped: true },
			{ query: "replycolor=%23ffcc00&replylabelcolor&striphtml", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(255, 255, 255)", htmlStripped: true },
			{ query: "replycolor=%23ffcc00&replylabelcolor", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(255, 255, 255)", quotedHtml: 'Replying to <b style="color:red">Alex</b>: original question' },
			{ query: "replycolor=%23ffcc00&replylabelcolor&striphtml", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(255, 255, 255)", htmlStripped: true, initialHtml: 'Replying to <b>Alex</b>: original question', quotedHtml: 'Replying to <b>Alex</b>: original question', type: "twitch" },
			{ query: "replycolor=%23ffcc00&striphtml", colored: true, color: "rgb(255, 204, 0)", htmlStripped: true, quoted: "Fish & chips", initialHtml: "Fish &amp; chips", quotedHtml: "Fish &amp; chips", type: "kick" },
			{ query: "replycolor=%23ffcc00&striphtml", colored: true, color: "rgb(255, 204, 0)", htmlStripped: true, type: "twitch", event: "action" },
			{ query: "replycolor=%23ffcc00&stripreplyto", colored: false, stripped: true, type: "twitch", event: "action" },
			{ query: "replycolor=%23ffcc00&replylabelcolor", colored: true, color: "rgb(255, 204, 0)", labelColor: "rgb(255, 255, 255)", quoted: "Alex: original question", label: "Alex:", meta: { reply: { author: "Alex", text: "original question" } } },
			{ query: "replycolor=%23ffcc00&replylabelcolor", colored: true, color: "rgb(255, 204, 0)", quoted: "Question: is this a label?", type: "twitch" }
		]) {
			await page.goto(dockUrl + "?session=reply-color-local-test&noavatar&notime&hidesource&" + scenario.query, { waitUntil: "domcontentloaded" });
			const iframe = await page.locator("iframe").first().elementHandle();
			const frame = await iframe.contentFrame();
			const quote = scenario.quoted || quoted;
			const quoteHtml = '<i><small>' + (scenario.quotedHtml || quote) + ':&nbsp;</small></i> ' + answer;
			const message = {
				id: "reply-color-test", type: scenario.type || "kick", chatname: "LocalTest",
				initial: scenario.initialHtml || quote, reply: answer, meta: scenario.meta, event: scenario.event,
				chatmessage: scenario.textonly ? quote + ": " + answer : quoteHtml,
				textonly: !!scenario.textonly
			};
			await frame.evaluate(data => parent.postMessage({ dataReceived: { overlayNinja: data } }, "*"), message);
			const content = page.locator("#content_reply-color-test");
			await content.waitFor();
			assert.equal(await content.locator(".reply-context").count(), scenario.colored ? 1 : 0, scenario.query);
			if (scenario.colored) {
				assert.equal(await color("#content_reply-color-test .reply-context"), scenario.color);
				assert.equal((await content.locator(".reply-context").textContent()).trim(), quote + ":");
				assert.notEqual(await color("#content_reply-color-test"), scenario.color);
			}
			assert.equal(await content.locator(".reply-label").count(), scenario.labelColor ? 1 : 0, "Only recognized reply-to labels should receive the separate color");
			if (scenario.labelColor) {
				assert.equal(await content.locator(".reply-label").textContent(), scenario.label || "Replying to Alex:");
				assert.equal(await color("#content_reply-color-test .reply-label"), scenario.labelColor);
				if (scenario.quotedHtml && !scenario.htmlStripped) assert.equal(await color("#content_reply-color-test .reply-label b"), scenario.labelColor);
			}
			assert.equal(await content.locator("b").count(), scenario.textonly || scenario.htmlStripped ? 0 : (scenario.quotedHtml ? 2 : 1), "Plain text must stay escaped; HTML formatting must survive");
			if (!scenario.textonly && !scenario.htmlStripped) {
				// Event italics are applied to the displayed body, not a payload wrapper.
				const answerSelector = "#content_reply-color-test > b";
				assert.equal(await color(answerSelector), await color("#content_reply-color-test"), "The new answer must retain its normal color");
			}
			if (scenario.stripped) assert.equal(await content.textContent(), "The new answer stays readable");

			await frame.evaluate(() => parent.postMessage({ dataReceived: { overlayNinja: {
				id: "ordinary-test", type: "youtube", chatname: "LocalTest",
				chatmessage: "<i><small>Ordinary italic text</small></i> body", textonly: false
			} } }, "*"));
			await page.locator("#content_ordinary-test").waitFor();
			assert.equal(await page.locator("#content_ordinary-test .reply-context").count(), 0);
			assert.equal(await page.locator("#content_ordinary-test .reply-label").count(), 0);
		}
		console.log("PASS: reply colors are opt-in, preserve the new message, and respect stripping/plain text.");
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
