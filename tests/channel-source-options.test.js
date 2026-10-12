#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const payload = {
	id: "channel-source-test",
	type: "twitch",
	chatname: "ViewerName",
	chatmessage: "Shared Chat message",
	chatimg: "",
	sourceName: "OriginChannel",
	sourceImg: "./sources/images/twitch.png",
	textonly: true
};

async function getTransportFrame(page, filename) {
	const iframe = page.locator("iframe").first();
	await iframe.waitFor();
	const iframeHandle = await iframe.elementHandle();
	const frame = iframeHandle ? await iframeHandle.contentFrame() : null;
	assert.ok(frame, `${filename} did not create its transport iframe`);
	return frame;
}

async function renderPage(browser, filename, query, message = payload) {
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
	await page.route("https://vdo.socialstream.ninja/**", route => route.fulfill({
		status: 200,
		contentType: "text/html",
		body: "<!doctype html><html><body></body></html>"
	}));
	await page.goto(`${pathToFileURL(path.join(root, filename)).href}?session=channel-source-test&${query}`, {
		waitUntil: "domcontentloaded"
	});
	const frame = await getTransportFrame(page, filename);
	await frame.evaluate(incomingMessage => {
		parent.postMessage({ dataReceived: { overlayNinja: incomingMessage } }, "*");
	}, message);
	await page.waitForSelector(query.includes("branded") ? ".channel-source-icon" : ".channel-source-name");
	return page;
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const dockDefault = await renderPage(browser, "dock.html", "branded&noavatar");
		assert.equal(await dockDefault.locator(".channel-source-name").count(), 0);
		assert.equal(await dockDefault.locator(".channel-source-icon.large-channel-icon").count(), 0);
		const dockDefaultHeight = (await dockDefault.locator(".channel-source-icon").boundingBox()).height;

		const dockOptIn = await renderPage(browser, "dock.html", "branded&noavatar&largechannelicon&showchannelname");
		assert.equal(await dockOptIn.locator(".channel-source-name").textContent(), "OriginChannel");
		assert.equal(await dockOptIn.locator(".channel-source-icon.large-channel-icon").count(), 1);
		const dockLargeHeight = (await dockOptIn.locator(".channel-source-icon").boundingBox()).height;
		assert.ok(dockLargeHeight > dockDefaultHeight, `Dock channel icon did not grow: ${dockDefaultHeight} -> ${dockLargeHeight}`);

		const featuredDefault = await renderPage(browser, "featured.html", "branded&noavatar");
		assert.equal(await featuredDefault.locator(".channel-source-name").count(), 0);
		assert.equal(await featuredDefault.locator(".channel-source-icon.large-channel-icon").count(), 0);
		const featuredDefaultHeight = (await featuredDefault.locator(".channel-source-icon").boundingBox()).height;

		const featuredOptIn = await renderPage(browser, "featured.html", "branded&noavatar&largechannelicon&showchannelname");
		assert.equal(await featuredOptIn.locator(".channel-source-name").textContent(), "OriginChannel");
		assert.equal(await featuredOptIn.locator(".channel-source-icon.large-channel-icon").count(), 1);
		const featuredLargeHeight = (await featuredOptIn.locator(".channel-source-icon").boundingBox()).height;
		assert.ok(featuredLargeHeight > featuredDefaultHeight, `Featured channel icon did not grow: ${featuredDefaultHeight} -> ${featuredLargeHeight}`);

		const dockNameOnly = await renderPage(browser, "dock.html", "noavatar&showchannelname");
		assert.equal(await dockNameOnly.locator(".channel-source-name").textContent(), "OriginChannel");
		assert.equal(await dockNameOnly.locator(".channel-source-icon").count(), 0, "Channel name should not require the channel icon option");
		const unsafeSourceName = '<img src=x onerror="window.__channelNameUnsafe=true">';
		const dockEscaping = await renderPage(browser, "dock.html", "noavatar&showchannelname", {
			...payload,
			id: "channel-source-escaping",
			sourceName: unsafeSourceName
		});
		assert.equal(await dockEscaping.locator(".channel-source-name").textContent(), unsafeSourceName);
		assert.equal(await dockEscaping.locator(".channel-source-name img").count(), 0);
		assert.notEqual(await dockEscaping.evaluate("window.__channelNameUnsafe === true"), true);

		const dockLargeAvatar = await renderPage(browser, "dock.html", "branded&largeavatar&largechannelicon&showchannelname");
		assert.equal(await dockLargeAvatar.locator(".channel-source-name").textContent(), "OriginChannel");
		assert.equal((await dockLargeAvatar.locator(".channel-source-icon").boundingBox()).height, 33);

		const featuredAvatar = await renderPage(browser, "featured.html", "branded&largechannelicon&showchannelname");
		assert.equal(await featuredAvatar.locator(".channel-source-name").textContent(), "OriginChannel");
		assert.equal((await featuredAvatar.locator(".channel-source-icon").boundingBox()).height, 56);

		const soakArgument = process.argv.find(argument => argument.startsWith("--soak-count="));
		const soakCount = soakArgument ? Math.max(0, Number(soakArgument.split("=")[1]) || 0) : 0;
		if (soakCount) {
			const frame = await getTransportFrame(dockOptIn, "dock.html");
			await frame.evaluate(({ baseMessage, count }) => {
				for (let index = 0; index < count; index += 1) {
					parent.postMessage({
						dataReceived: {
							overlayNinja: {
								...baseMessage,
								id: `channel-source-soak-${index}`,
								sourceName: `OriginChannel${index % 10}`
							}
						}
					}, "*");
				}
			}, { baseMessage: payload, count: soakCount });
			await dockOptIn.waitForSelector(`#msg_channel-source-soak-${soakCount - 1}`);
			assert.ok(await dockOptIn.locator(".highlight-chat").count() <= 200, "Dock soak exceeded the live row limit");
			console.log(`Channel-source render soak passed: ${soakCount} messages.`);
		}

		console.log(`PASS: channel-source options are opt-in and enlarge Dock (${dockDefaultHeight}px -> ${dockLargeHeight}px) and Featured (${featuredDefaultHeight}px -> ${featuredLargeHeight}px).`);
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
