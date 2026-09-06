"use strict";

// Run: node tests/tipjar-count-goals.test.cjs

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml; charset=utf-8"
};

async function startServer() {
	const rootPrefix = repoRoot.toLowerCase() + path.sep;
	const server = http.createServer((request, response) => {
		let pathname = "/";
		try {
			pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
		} catch (_) {}
		const file = path.resolve(repoRoot, "." + pathname);
		if (file.toLowerCase() !== repoRoot.toLowerCase() && !file.toLowerCase().startsWith(rootPrefix)) {
			response.writeHead(403);
			response.end("Forbidden");
			return;
		}
		fs.readFile(file, (error, body) => {
			if (error) {
				response.writeHead(404);
				response.end("Not found");
				return;
			}
			response.writeHead(200, {
				"Cache-Control": "no-store",
				"Content-Type": mimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream"
			});
			response.end(body);
		});
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	return { server, baseUrl: "http://127.0.0.1:" + server.address().port };
}

async function makeContext(browser) {
	const context = await browser.newContext({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1 });
	await context.route("https://vdo.socialstream.ninja/**", route => route.fulfill({
		contentType: "text/html; charset=utf-8",
		body: "<!doctype html><html><body></body></html>"
	}));
	return context;
}

async function openTipJar(context, url) {
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(String(error && error.stack || error)));
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
	await page.waitForFunction(() => typeof window.processData === "function");
	return { page, errors };
}

async function testSuperChatCountGoal(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		const harness = await openTipJar(
			context,
			baseUrl + "/tipjar.html?session=count-goal&style=bar&goal=3&goalmetric=count&tipjarsource=youtube&tipjarevent=superchat&persistent&controls"
		);
		await harness.page.evaluate(() => {
			[
				{ id: "sc-1", type: "youtube", event: "superchat", chatname: "Fan", hasDonation: "$1.00" },
				{ id: "sc-2", type: "youtube", event: "superchat", chatname: "Fan", hasDonation: "$100.00" },
				{ id: "ss-1", type: "youtube", event: "supersticker", chatname: "Sticker", hasDonation: "$5.00" },
				{ id: "gift-1", type: "youtube", event: "giftpurchase", chatname: "Gifter", membership: "gift_giver", count: 10 },
				{ id: "member-1", type: "youtube", event: "sponsorship", chatname: "Member", membership: "Member" },
				{ id: "other-1", type: "twitch", event: "superchat", chatname: "Other", hasDonation: "$20.00" }
			].forEach(window.processData);
		});

		assert.strictEqual(await harness.page.textContent("#bar-title"), "Super Chat Goal");
		assert.strictEqual(await harness.page.textContent("#bar-text"), "2 / 3 Super Chats");
		assert.strictEqual(await harness.page.evaluate(() => localStorage.getItem("tipjar_amount_metric_count_events_superchat_source_youtube")), "2");
		await harness.page.click("#toggle-history");
		assert((await harness.page.textContent("#history-list")).includes("Total: 2 Super Chats"));
		await harness.page.click("#close-history");
		await harness.page.click("#toggle-leaderboard");
		assert((await harness.page.textContent("#leaderboard-list")).includes("2 Super Chats"));

		await harness.page.reload({ waitUntil: "domcontentloaded" });
		await harness.page.waitForFunction(() => document.getElementById("bar-text").textContent === "2 / 3 Super Chats");
		assert.deepStrictEqual(harness.errors, [], "Count goal browser errors: " + harness.errors.join("; "));

		const moneyHarness = await openTipJar(
			context,
			baseUrl + "/tipjar.html?session=value-goal&style=bar&goal=100&tipjarsource=youtube&persistent"
		);
		assert.strictEqual(await moneyHarness.page.textContent("#bar-text"), "$0.00 / $100");
		await moneyHarness.page.evaluate(() => window.processData({
			id: "money-1",
			type: "youtube",
			event: "superchat",
			chatname: "Donor",
			hasDonation: "$10.00"
		}));
		assert.strictEqual(await moneyHarness.page.textContent("#bar-text"), "$10.00 / $100");
		assert.deepStrictEqual(moneyHarness.errors, [], "Money goal browser errors: " + moneyHarness.errors.join("; "));
	} finally {
		await context.close();
	}
}

async function testCombinedPaidMessageCount(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		const harness = await openTipJar(
			context,
			baseUrl + "/tipjar.html?session=paid-messages&style=text&goal=4&hype&goalmetric=count&tipjarsource=youtube&tipjarevent=superchat%2Csupersticker"
		);
		await harness.page.evaluate(() => {
			window.processData({ id: "paid-1", type: "youtube", event: "superchat", chatname: "Chat", hasDonation: "CA$2.00" });
			window.processData({ id: "paid-2", type: "youtube", event: "supersticker", chatname: "Sticker", hasDonation: "¥500" });
		});
		assert.strictEqual(await harness.page.textContent("#text-line"), "YouTube Paid Message Goal: 2 / 4 paid messages (50%)");
		assert.deepStrictEqual(harness.errors, [], "Combined count goal browser errors: " + harness.errors.join("; "));
	} finally {
		await context.close();
	}
}

async function testGiftPurchaseExclusion(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		const excluded = await openTipJar(
			context,
			baseUrl + "/tipjar.html?session=exclude-gifts&style=bar&hype&goal=50&subpoints=2&giftpoints=5&tipjarsource=youtube&excludegiftpurchase&noresetoncomplete"
		);
		await excluded.page.evaluate(() => {
			window.processData({ id: "gift-1", type: "youtube", event: "giftpurchase", chatname: "Gifter", membership: "gift_giver", count: 3 });
			window.processData({ id: "member-1", type: "youtube", event: "sponsorship", chatname: "Member", membership: "Member" });
			window.processData({ id: "sc-1", type: "youtube", event: "superchat", chatname: "Donor", hasDonation: "$5.00" });
		});
		assert.strictEqual(await excluded.page.textContent("#bar-text"), "7 pts / 50 pts");
		assert.deepStrictEqual(excluded.errors, [], "Gift exclusion browser errors: " + excluded.errors.join("; "));

		const included = await openTipJar(
			context,
			baseUrl + "/tipjar.html?session=include-gifts&style=bar&hype&goal=50&giftpoints=5&tipjarsource=youtube&noresetoncomplete"
		);
		await included.page.evaluate(() => window.processData({
			id: "gift-2",
			type: "youtube",
			event: "giftpurchase",
			chatname: "Gifter",
			membership: "gift_giver",
			count: 3
		}));
		assert.strictEqual(await included.page.textContent("#bar-text"), "15 pts / 50 pts");
		assert.deepStrictEqual(included.errors, [], "Gift inclusion browser errors: " + included.errors.join("; "));
	} finally {
		await context.close();
	}
}

async function testGoalLayouts(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		for (const style of ['card', 'ring', 'lowerthird', 'segmented']) {
			const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?session=layout-test&style=' + style + '&goal=100&startamount=25&celebration=none');
			assert.strictEqual(await page.locator('.style-container.active').count(), 1);
			assert.strictEqual(await page.textContent('#summary-amount'), '$25.00');
			assert.strictEqual(await page.textContent('#summary-percent'), '25%');
			await page.evaluate(() => processData({ type: 'youtube', event: 'superchat', chatname: 'Layout Test', hasDonation: '$25', donoValue: 25 }));
			assert.strictEqual(await page.textContent('#summary-percent'), '50%');
			assert.strictEqual(await page.getAttribute('#summary-progress', 'aria-valuenow'), '50');
			assert.strictEqual(await page.locator('#summary-ring-fill').evaluate(el => el.style.strokeDashoffset), '50');
			await page.setViewportSize({ width: 320, height: 500 });
			await page.evaluate(() => { document.getElementById('summary-title').textContent = 'A long community fundraiser title that needs to wrap'; });
			assert(await page.locator('.summary-panel').evaluate(el => el.scrollWidth <= el.clientWidth), style + ' overflows at 320px');
			for (const params of ['&goalmetric=count&countlabel=donations', '&hype&noresetoncomplete', '&levelsize=100', '&rollinggoal=100']) {
				await page.goto(baseUrl + '/tipjar.html?session=layout-test&style=' + style + '&goal=100&startamount=150&celebration=none' + params);
				await page.waitForFunction(() => typeof window.processData === 'function');
				const expected = params.includes('levelsize') ? '50%' : (params.includes('rollinggoal') ? '75%' : '100%');
				assert.strictEqual(await page.textContent('#summary-percent'), expected, style + params);
				if (params.includes('countlabel')) assert((await page.textContent('#summary-goal')).includes('donations'));
				if (params.includes('hype')) assert((await page.textContent('#summary-amount')).includes('pts'));
				if (params.includes('levelsize')) assert((await page.textContent('#summary-title')).includes('Lvl 2'));
			}
			assert.deepStrictEqual(errors, [], style + ' browser errors');
			await page.close();
		}
		if (process.env.TIPJAR_SCREENSHOTS) {
			fs.mkdirSync(process.env.TIPJAR_SCREENSHOTS, { recursive: true });
			const gallery = await context.newPage();
			await gallery.setViewportSize({ width: 1440, height: 1320 });
			await gallery.goto(baseUrl + '/tipjar.html?session=layout-gallery&style=text');
			await gallery.evaluate(base => {
				document.body.innerHTML = '';
				document.body.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);align-items:start;background:#343e50;overflow:auto;padding:16px;gap:12px;height:auto';
				for (const style of ['card', 'ring', 'segmented', 'lowerthird', 'meter', 'compact', 'bar', 'minimal', 'vertical']) {
					const tile = document.createElement('div');
					tile.innerHTML = '<div style="color:white;font:16px Arial;padding:8px">' + style + '</div>';
					const frame = document.createElement('iframe');
					frame.src = base + '/tipjar.html?session=layout-gallery&style=' + style + '&goal=1000&startamount=635&title=Community%20studio%20fund&theme=' + (style === 'ring' ? 'gold' : style === 'segmented' ? 'neon' : 'default');
					frame.style.cssText = 'width:100%;height:380px;border:0';
					tile.appendChild(frame);
					document.body.appendChild(tile);
				}
			}, baseUrl);
			await gallery.waitForTimeout(1600);
			await gallery.screenshot({ path: path.join(process.env.TIPJAR_SCREENSHOTS, 'tipjar-styles.png'), fullPage: true });
		}
	} finally {
		await context.close();
	}
}

function testPopupContract() {
	const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
	const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
	assert(popupHtml.includes('data-optionparam12="goalmetric"'));
	assert(popupHtml.includes('<option value="count">Number of qualifying donations</option>'));
	assert(popupHtml.includes('data-optionparam12="tipjarevent"'));
	assert(popupHtml.includes('<option value="superchat">Super Chats only</option>'));
	assert(popupHtml.includes('data-optionparam12="countlabel"'));
	assert(popupHtml.includes('data-param12="excludegiftpurchase"'));
	assert(popupHtml.includes('data-param12="notips"'));
	assert(popupHtml.includes('data-param12="nosubs"'));
	assert(popupHtml.includes('data-param12="noresubs"'));
	assert(popupHtml.includes('data-param12="nogifts"'));
	assert(popupSource.includes("event: 'superchat'"));
}

async function main() {
	const { server, baseUrl } = await startServer();
	const browser = await chromium.launch({ headless: true });
	try {
		testPopupContract();
		await testSuperChatCountGoal(baseUrl, browser);
		console.log("PASS Tip Jar counts only filtered YouTube Super Chats and isolates saved totals");
		await testCombinedPaidMessageCount(baseUrl, browser);
		console.log("PASS Tip Jar can count combined Super Chat and Super Sticker goals");
		await testGiftPurchaseExclusion(baseUrl, browser);
		console.log("PASS Tip Jar gifted-membership exclusion works in Hype mode");
		await testGoalLayouts(baseUrl, browser);
		console.log("PASS Goal layouts render donations, count/Hype/recurring goals, and narrow widths");
	} finally {
		await browser.close();
		await new Promise(resolve => server.close(resolve));
	}
}

module.exports = { startServer, makeContext, openTipJar };
if (require.main === module) {
	main().catch(error => {
		console.error(error.stack || error);
		process.exit(1);
	});
}
