const assert = require("assert");
const net = require("net");
const path = require("path");
const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const repoRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const oversizedGif = Buffer.from(gif);
oversizedGif.writeUInt16LE(513, 6);

function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, host, () => {
			const port = server.address().port;
			server.close(() => resolve(port));
		});
	});
}

async function waitFor(page, predicate, argument, timeout = 10000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await page.evaluate(predicate, argument)) {
			return;
		}
		await page.waitForTimeout(25);
	}
	const images = await page.evaluate(() =>
		Array.from(document.querySelectorAll("img[alt]")).map(img => ({
			alt: img.alt,
			src: img.getAttribute("src"),
			srcset: img.getAttribute("srcset"),
			currentSrc: img.currentSrc,
			marker: img.dataset.staticEmote || "",
			naturalWidth: img.naturalWidth
		}))
	);
	throw new Error(`Timed out waiting for dock state: ${JSON.stringify(images)}`);
}

async function openDock(context, baseUrl, parameter) {
	const page = await context.newPage();
	await page.goto(`${baseUrl}/dock.html?session=static-emote-test&server${parameter ? `&${parameter}` : ""}`, {
		waitUntil: "domcontentloaded",
		timeout: 30000
	});
	return page;
}

async function sendDockMessage(page, html, name) {
	await page.evaluate(
		({ html, name }) => {
			window.processData(
				{
					contents: {
						chatname: name,
						chatmessage: html,
						chatimg: "",
						chatbadges: "",
						type: "youtube",
						textonly: false
					}
				},
				{
					reloaded: true,
					suppressLiveSideEffects: true,
					skipHistoryDeferral: true
				}
			);
		},
		{ html, name }
	);
}

async function readImage(page, alt) {
	return page.evaluate(imageAlt => {
		const img = document.querySelector(`img[alt="${imageAlt}"]`);
		if (!img) {
			return null;
		}
		return {
			src: img.getAttribute("src"),
			srcset: img.getAttribute("srcset"),
			currentSrc: img.currentSrc,
			marker: img.dataset.staticEmote || "",
			naturalWidth: img.naturalWidth
		};
	}, alt);
}

async function main() {
	const port = await getFreePort();
	const server = await startStaticServer({ root: repoRoot, host, port });
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const baseUrl = `http://${host}:${port}`;
	const pageErrors = [];
	let kickCorsRequests = 0;

	await context.addInitScript(() => {
		// dock.html intentionally replaces window.eval, while Playwright needs the native function.
		Object.defineProperty(window, "eval", {
			configurable: false,
			writable: false,
			value: window.eval
		});
	});

	await context.route("**/*", async route => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === baseUrl) {
			await route.continue();
			return;
		}

		const isKick = url.hostname === "files.kick.com" && url.pathname.indexOf("/emotes/") === 0;
		const isKnownEmote = isKick || url.hostname === "cdn.7tv.app" || url.hostname === "cdn.betterttv.net" || url.hostname === "cdn.frankerfacez.com" || url.hostname === "static-cdn.jtvnw.net" || url.hostname === "d3aqoihi2n8ty8.cloudfront.net" || url.hostname === "cdn.discordapp.com";
		const isArbitraryTestImage = url.hostname === "example.invalid";

		if (!isKnownEmote && !isArbitraryTestImage) {
			await route.abort();
			return;
		}

		const requestOrigin = request.headers().origin;
		if (isKick && requestOrigin) {
			kickCorsRequests += 1;
		}
		const isCorsFailure = isKick && url.pathname.indexOf("/cors-failure/") !== -1;
		const isStaticFallbackFailure = url.hostname === "cdn.7tv.app" && url.pathname.indexOf("/review-fallback/") !== -1 && url.pathname.indexOf("_static.") !== -1;

		if (isStaticFallbackFailure) {
			await route.fulfill({
				status: 404,
				contentType: "text/plain",
				headers: {
					"access-control-allow-origin": "*",
					"cross-origin-resource-policy": "cross-origin"
				},
				body: "not found"
			});
			return;
		}
		if (isCorsFailure && requestOrigin) {
			await route.abort();
			return;
		}

		const headers = {
			"cross-origin-resource-policy": "cross-origin"
		};
		headers["access-control-allow-origin"] = "*";
		await route.fulfill({
			status: 200,
			contentType: isKick || isArbitraryTestImage ? "image/gif" : "image/png",
			headers,
			body: isKick && url.pathname.indexOf("/oversized/") !== -1 ? oversizedGif : isKick || isArbitraryTestImage ? gif : png
		});
	});

	try {
		const disabledPage = await openDock(context, baseUrl, "");
		disabledPage.on("pageerror", error => pageErrors.push(String(error)));
		assert.strictEqual(await disabledPage.evaluate(() => window.makeEmoteStatic === null), true);
		await sendDockMessage(disabledPage, '<img class="regular-emote" alt="disabled-seven" src="https://cdn.7tv.app/emote/review-seven/2x.webp?v=1">' + '<img class="regular-emote" alt="disabled-srcset" srcset="https://cdn.7tv.app/emote/review-srcset/1x.webp?v=1 1x, https://cdn.7tv.app/emote/review-srcset/2x.webp?v=1 2x">' + '<img class="regular-emote" alt="disabled-kick" src="https://files.kick.com/emotes/review/fullsize">', "Feature disabled");
		await disabledPage.waitForTimeout(100);
		const disabledSeven = await readImage(disabledPage, "disabled-seven");
		const disabledSrcset = await readImage(disabledPage, "disabled-srcset");
		const disabledKick = await readImage(disabledPage, "disabled-kick");
		assert.strictEqual(disabledSeven.src, "https://cdn.7tv.app/emote/review-seven/2x.webp?v=1");
		assert.ok(disabledSrcset.srcset.indexOf("_static.") === -1);
		assert.ok(disabledSrcset.srcset.indexOf("2x.webp?v=1") !== -1);
		assert.ok(disabledKick.src.indexOf("data:") !== 0);
		assert.strictEqual(disabledSeven.marker, "");
		assert.strictEqual(disabledSrcset.marker, "");
		assert.strictEqual(disabledKick.marker, "");
		await disabledPage.close();

		const enabledPage = await openDock(context, baseUrl, "staticemotes");
		enabledPage.on("pageerror", error => pageErrors.push(String(error)));
		assert.strictEqual(await enabledPage.evaluate(() => typeof window.makeEmoteStatic), "function");
		await sendDockMessage(enabledPage, '<img class="regular-emote" alt="seven" src="https://cdn.7tv.app/emote/review-seven/2x.webp?v=1">' + '<img class="regular-emote" alt="bttv" src="https://cdn.betterttv.net/emote/review-bttv/2x?v=1">' + '<img class="regular-emote" alt="ffz" src="https://cdn.frankerfacez.com/emote/review-ffz/animated/2?v=1">' + '<img class="regular-emote" alt="twitch" src="https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0?v=1">' + '<img class="regular-emote" alt="cheer" src="https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/1/1.gif?v=1">' + '<img class="regular-emote" alt="discord" src="https://cdn.discordapp.com/emojis/123.gif?size=48&amp;animated=true">' + '<img class="regular-emote" alt="srcset-only" srcset="https://cdn.7tv.app/emote/review-srcset/1x.webp?v=1 1x, https://cdn.7tv.app/emote/review-srcset/2x.webp?v=1 2x">' + '<img class="regular-emote" alt="arbitrary" src="https://example.invalid/large.gif">' + '<img class="regular-emote" alt="kick-one" src="https://files.kick.com/emotes/review/fullsize">' + '<img class="regular-emote" alt="kick-two" src="https://files.kick.com/emotes/review/fullsize">' + '<img class="regular-emote" alt="kick-cors-failure" src="https://files.kick.com/emotes/cors-failure/fullsize">' + '<img class="regular-emote" alt="kick-oversized" src="https://files.kick.com/emotes/oversized/fullsize">' + '<img class="regular-emote" alt="fallback" src="https://cdn.7tv.app/emote/review-fallback/2x.webp" srcset="https://cdn.7tv.app/emote/review-fallback/1x.webp 1x, https://cdn.7tv.app/emote/review-fallback/2x.webp 2x">', "Feature enabled");

		await waitFor(enabledPage, () => {
			const kickOne = document.querySelector('img[alt="kick-one"]');
			const kickTwo = document.querySelector('img[alt="kick-two"]');
			const failedKick = document.querySelector('img[alt="kick-cors-failure"]');
			const oversizedKick = document.querySelector('img[alt="kick-oversized"]');
			const fallback = document.querySelector('img[alt="fallback"]');
			return kickOne && kickTwo && kickOne.src.indexOf("data:image/png;base64,") === 0 && kickTwo.src.indexOf("data:image/png;base64,") === 0 && failedKick && failedKick.dataset.staticEmote === "fallback" && oversizedKick && oversizedKick.dataset.staticEmote === "fallback" && fallback && fallback.naturalWidth === 1 && fallback.currentSrc.indexOf("_static.") === -1;
		});

		const seven = await readImage(enabledPage, "seven");
		const bttv = await readImage(enabledPage, "bttv");
		const ffz = await readImage(enabledPage, "ffz");
		const twitch = await readImage(enabledPage, "twitch");
		const cheer = await readImage(enabledPage, "cheer");
		const discord = await readImage(enabledPage, "discord");
		const srcsetOnly = await readImage(enabledPage, "srcset-only");
		const arbitrary = await readImage(enabledPage, "arbitrary");
		const failedKick = await readImage(enabledPage, "kick-cors-failure");
		const oversizedKick = await readImage(enabledPage, "kick-oversized");
		const fallback = await readImage(enabledPage, "fallback");

		assert.ok(seven.src.indexOf("/2x_static.webp?v=1") !== -1);
		assert.ok(bttv.src.indexOf("/static/2x.webp?v=1") !== -1);
		assert.ok(ffz.src.indexOf("/review-ffz/2?v=1") !== -1);
		assert.ok(twitch.src.indexOf("/static/dark/2.0?v=1") !== -1);
		assert.ok(cheer.src.indexOf("/static/1/1.png?v=1") !== -1);
		assert.ok(discord.src.indexOf("/123.png?") !== -1);
		assert.ok(discord.src.indexOf("animated=false") !== -1);
		assert.strictEqual(srcsetOnly.src, null);
		assert.ok(srcsetOnly.srcset.indexOf("1x_static.webp?v=1") !== -1);
		assert.strictEqual(srcsetOnly.naturalWidth, 1);
		assert.strictEqual(arbitrary.src, "https://example.invalid/large.gif");
		assert.strictEqual(arbitrary.marker, "");
		assert.strictEqual(failedKick.marker, "fallback");
		assert.ok(failedKick.src.indexOf("data:") !== 0);
		assert.strictEqual(oversizedKick.marker, "fallback");
		assert.ok(oversizedKick.src.indexOf("data:") !== 0);
		assert.ok(fallback.srcset.indexOf("_static.") === -1);
		assert.ok(fallback.currentSrc.indexOf("_static.") === -1);
		assert.strictEqual(fallback.naturalWidth, 1);
		assert.strictEqual(kickCorsRequests, 3);

		await sendDockMessage(enabledPage, '<img class="regular-emote" alt="kick-cached" src="https://files.kick.com/emotes/review/fullsize">', "Cached Kick");
		await waitFor(enabledPage, () => {
			const img = document.querySelector('img[alt="kick-cached"]');
			return img && img.src.indexOf("data:image/png;base64,") === 0;
		});
		assert.strictEqual(kickCorsRequests, 3);
		await enabledPage.close();

		for (const alias of ["noanimatedemotes", "freezeemotes"]) {
			const aliasPage = await openDock(context, baseUrl, alias);
			aliasPage.on("pageerror", error => pageErrors.push(String(error)));
			await sendDockMessage(aliasPage, `<img class="regular-emote" alt="${alias}" src="https://cdn.7tv.app/emote/review-${alias}/2x.webp">`, alias);
			await waitFor(
				aliasPage,
				currentAlias => {
					const img = document.querySelector(`img[alt="${currentAlias}"]`);
					return img && img.src.indexOf("_static.webp") !== -1;
				},
				alias
			);
			await aliasPage.close();
		}

		assert.deepStrictEqual(pageErrors, []);
		console.log("dock static-emotes tests passed");
	} finally {
		await context.close();
		await browser.close();
		await new Promise(resolve => server.close(resolve));
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
