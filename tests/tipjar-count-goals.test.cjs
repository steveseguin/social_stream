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

async function testJarPrefillReset(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=jar&startamount=100&goal=100');
		await page.waitForFunction(() => jarHearts.length > 0);
		await page.evaluate(() => processData({ cmd: 'resettipjar' }));
		await page.waitForTimeout(3600);
		assert.strictEqual(await page.evaluate(() => currentAmount), 0);
		assert.strictEqual(await page.evaluate(() => jarHearts.length), 0, 'Reset must cancel pending prefill hearts');
		await page.evaluate(() => seedJarHearts());
		await page.waitForTimeout(200);
		assert.strictEqual(await page.evaluate(() => jarHearts.length), 0, 'An empty total must not prefill');
		assert.deepStrictEqual(errors, []);
		for (const mode of ['', '&hype&donationpoints=1']) {
			const next = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=jar&goal=100&celebration=hearts' + mode);
			await next.page.evaluate(() => processData({ id: 'reset-donation', type: 'youtube', chatname: 'Fixture', hasDonation: '$50', donoValue: 50 }));
			await next.page.waitForFunction(() => jarHearts.length > 0);
			await next.page.evaluate(() => processData({ cmd: 'resettipjar' }));
			await next.page.waitForTimeout(2500);
			assert.strictEqual(await next.page.evaluate(() => currentAmount), 0);
			assert.strictEqual(await next.page.evaluate(() => jarHearts.length), 0, 'Reset must cancel pending donation hearts');
			assert.strictEqual(await next.page.evaluate(() => jarHeartTimers.size), 0);
			await next.page.evaluate(() => processData({ id: 'after-reset', type: 'youtube', chatname: 'Fixture', hasDonation: '$5', donoValue: 5 }));
			await next.page.waitForFunction(() => jarHearts.length > 0);
			assert.deepStrictEqual(next.errors, []);
			await next.page.close();
		}
	} finally {
		await context.close();
	}
}

async function testFollowerTipExclusion(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		for (const [params, expectedTips, expectedFollow] of [
			['followergoal', 0, 1],
			['followergoal&donationpoints=2', 10, 1],
			['followergoal&donationpoints=2&notips', 0, 1],
			['goalmetric=followers&donationpoints=2&notips', 0, 1],
			['hype&donationpoints=2', 10, 0],
			['hype&donationpoints=2&notips', 0, 0]
		]) {
			const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=bar&goal=100&' + params);
			await page.evaluate(() => processData({ id: 'tip', type: 'youtube', chatname: 'Supporter', hasDonation: '$5', donoValue: 5 }));
			assert.strictEqual(await page.evaluate(() => currentAmount), expectedTips, params + ': tip contribution');
			await page.evaluate(() => processData({ id: 'follow', type: 'twitch', chatname: 'Follower', event: 'new_follower' }));
			assert.strictEqual(await page.evaluate(() => currentAmount), expectedTips + expectedFollow, params + ': follower contribution');
			assert.deepStrictEqual(errors, []);
			await page.close();
		}
	} finally {
		await context.close();
	}
}

const supporterEvents = [
	{ id: 'sub-1', type: 'twitch', event: 'new_subscriber', chatname: 'Zoe', chatimg: './media/user1.jpg', membership: 'Tier 1' },
	{ id: 'member-1', type: 'youtube', event: 'sponsorship', chatname: 'Eli', membership: 'Member' },
	{ id: 'resub-1', type: 'twitch', event: 'resub', chatname: 'Old Timer', membership: 'Tier 1' },
	{ id: 'follow-1', type: 'twitch', event: 'new_follower', chatname: 'Follower' },
	{ id: 'tip-1', type: 'twitch', chatname: 'Tipper', hasDonation: '$5.00', donoValue: 5 },
	{ id: 'gift-1', type: 'twitch', event: 'subscription_gift', chatname: 'Riley', chatimg: './media/user2.jpg', total: 5 }
];

async function testSubscriberGoal(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		for (const [params, expected] of [
			['goalmetric=subscribers', 7],
			['goalmetric=members', 7],
			['subscribergoal', 7],
			['goalmetric=subscribers&countresubs', 8],
			['goalmetric=subscribers&nogifts', 2],
			['goalmetric=subscribers&donationpoints=1', 12],
			['goalmetric=subscribers&followergoal', 7],
			['goalmetric=followers&subscribergoal', 1],
			['goalmetric=followers', 1]
		]) {
			const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=bar&goal=100&' + params);
			await page.evaluate(events => events.forEach(processData), supporterEvents);
			assert.strictEqual(await page.evaluate(() => currentAmount), expected, params);
			assert.deepStrictEqual(errors, [], params + ' browser errors');
			await page.close();
		}

		const goal = await openTipJar(context, baseUrl + '/tipjar.html?session=sub-goal&style=bar&goal=20&goalmetric=subscribers&persistent');
		assert.strictEqual(await goal.page.textContent('#bar-title'), 'Subscriber Goal');
		await goal.page.evaluate(event => processData(event), supporterEvents[0]);
		assert.strictEqual(await goal.page.textContent('#bar-text'), '1 subscriber / 20 subscribers');
		assert.strictEqual(await goal.page.textContent('#notification'), 'Zoe just subscribed!');
		await goal.page.evaluate(event => processData(event), supporterEvents[1]);
		assert.strictEqual(await goal.page.textContent('#bar-text'), '2 subscribers / 20 subscribers');
		assert.strictEqual(await goal.page.textContent('#notification'), 'Eli just became a member!');
		// Saved subscriber totals stay apart from Hype and follower totals.
		assert.strictEqual(await goal.page.evaluate(() => localStorage.getItem('tipjar_hype_amount_metric_subscribers')), '2');
		assert.strictEqual(await goal.page.evaluate(() => localStorage.getItem('tipjar_hype_amount')), null);
		// A "set amount" aimed at another measure must not move this one.
		await goal.page.evaluate(() => processData({ cmd: 'settipjaramount', value: 9, goalmetric: 'followers' }));
		assert.strictEqual(await goal.page.evaluate(() => currentAmount), 2);
		await goal.page.evaluate(() => processData({ cmd: 'settipjaramount', value: 9, goalmetric: 'count' }));
		assert.strictEqual(await goal.page.evaluate(() => currentAmount), 2);
		await goal.page.evaluate(() => processData({ cmd: 'settipjaramount', value: 9, goalmetric: 'subscribers' }));
		assert.strictEqual(await goal.page.evaluate(() => currentAmount), 9);
		assert.deepStrictEqual(goal.errors, [], 'Subscriber goal browser errors');

		const follower = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=bar&goal=20&followergoal');
		await follower.page.evaluate(() => processData({ cmd: 'settipjaramount', value: 4, goalmetric: 'subscribers' }));
		assert.strictEqual(await follower.page.evaluate(() => currentAmount), 0);
		await follower.page.evaluate(() => processData({ id: 'yt-follow', type: 'youtube', event: 'new_follower', chatname: 'Public Sub' }));
		assert.strictEqual(await follower.page.textContent('#bar-text'), '1 follower / 20 followers');
		assert.strictEqual(await follower.page.textContent('#notification'), 'Public Sub just subscribed!');
		// YouTube reports a burst of new subscribers as one grouped event.
		await follower.page.evaluate(() => processData({ id: 'yt-burst', type: 'youtube', event: 'new_follower', chatname: 'First +5', meta: { grouped: true, count: 6, others: 5 } }));
		assert.strictEqual(await follower.page.textContent('#bar-text'), '7 followers / 20 followers');
		assert.deepStrictEqual(follower.errors, [], 'Follower goal browser errors');
	} finally {
		await context.close();
	}
}

async function testCounterStyle(baseUrl, browser) {
	const context = await makeContext(browser);
	try {
		// 150 would complete a default goal of 100 and reset it; the counter has no target.
		const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=counter&goalmetric=subscribers&goal=5&levelsize=2&rollinggoal=3&startamount=150&panelopacity=0.5&accent=%23ffcc88');
		assert.strictEqual(await page.locator('.style-container.active').count(), 1);
		assert.strictEqual(await page.textContent('#summary-title'), 'New Subscribers');
		assert.strictEqual(await page.textContent('#summary-amount'), '150');
		assert.strictEqual(await page.getAttribute('#summary-progress', 'role'), 'status');
		assert.strictEqual(await page.getAttribute('#summary-progress', 'aria-valuenow'), null);
		for (const hidden of ['#summary-goal', '.summary-track', '.summary-footer', '.summary-ring', '#summary-latest']) {
			assert.strictEqual(await page.locator(hidden).isVisible(), false, hidden + ' must stay hidden on the counter');
		}
		assert.strictEqual(await page.locator('.summary-panel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(18, 24, 34, 0.5)');
		assert.strictEqual(await page.locator('#summary-amount').evaluate(el => getComputedStyle(el).color), 'rgb(255, 204, 136)');

		await page.evaluate(events => events.forEach(processData), supporterEvents);
		assert.strictEqual(await page.textContent('#summary-amount'), '157');
		assert.strictEqual(await page.evaluate(() => currentAmount), 157, 'The counter never resets or levels up');
		assert.strictEqual(await page.textContent('#notification'), 'Riley gifted 5 subs!');
		assert.strictEqual(await page.locator('#summary-latest').isVisible(), true);
		assert.strictEqual(await page.textContent('#summary-latest-name'), 'Riley');
		assert.strictEqual(await page.textContent('#summary-latest-detail'), '+5');
		assert((await page.getAttribute('#summary-latest-avatar', 'src')).endsWith('/media/user2.jpg'));
		assert.strictEqual(await page.getAttribute('#summary-progress', 'aria-label'), 'New Subscribers: 157');

		// Names go through the display filter, and only web or packaged image addresses reach the picture.
		await page.evaluate(() => processData({ id: 'sub-x', type: 'kick', event: 'new_subscriber', chatname: 'Tom &amp; Jerry<img src=x onerror="window.nameProbe=1"><script>window.nameProbe=1</script>', chatimg: 'javascript:window.avatarProbe=1' }));
		assert.strictEqual(await page.textContent('#summary-latest-name'), 'Tom & Jerry');
		assert.strictEqual(await page.locator('#summary-latest [onerror], #summary-latest script').count(), 0);
		assert.strictEqual(await page.getAttribute('#summary-latest-avatar', 'src'), null);
		assert.strictEqual(await page.locator('#summary-latest-avatar').isVisible(), false);
		assert.strictEqual(await page.evaluate(() => window.nameProbe || window.avatarProbe), undefined);

		await page.evaluate(() => processData({ cmd: 'resettipjar' }));
		assert.strictEqual(await page.textContent('#summary-amount'), '0');
		assert.strictEqual(await page.locator('#summary-latest').isVisible(), false);
		await page.setViewportSize({ width: 320, height: 400 });
		await page.evaluate(() => processData({ id: 'sub-long', type: 'twitch', event: 'new_subscriber', chatname: 'A supporter with a very long display name that keeps on going' }));
		assert(await page.locator('.summary-panel').evaluate(el => el.scrollWidth <= el.clientWidth), 'counter overflows at 320px');
		assert.deepStrictEqual(errors, [], 'Counter browser errors');
		await page.close();

		for (const [params, title, amount, detail] of [
			['', 'Total Raised', '$125.00', '$125.00'],
			['&goalmetric=count&tipjarevent=superchat', 'Super Chats', '1', ''],
			['&hype', 'Hype Points', '125', '$125.00'],
			['&title=Team%20Amethyst', 'Team Amethyst', '$125.00', '$125.00']
		]) {
			const next = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=counter' + params);
			await next.page.evaluate(() => processData({ id: 'sc-1', type: 'youtube', event: 'superchat', chatname: 'Maya', hasDonation: '$125.00' }));
			assert.strictEqual(await next.page.textContent('#summary-title'), title, params);
			assert.strictEqual(await next.page.textContent('#summary-amount'), amount, params);
			assert.strictEqual(await next.page.textContent('#summary-latest-name'), 'Maya', params);
			assert.strictEqual(await next.page.textContent('#summary-latest-detail'), detail, params);
			assert((await next.page.textContent('#notification')).indexOf('% of goal') === -1, params + ' showed a goal milestone');
			assert.deepStrictEqual(next.errors, [], params + ' browser errors');
			await next.page.close();
		}

		const bare = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=counter&goalmetric=followers&hidelatest&hidetitle');
		await bare.page.evaluate(event => processData(event), supporterEvents[3]);
		assert.strictEqual(await bare.page.textContent('#summary-amount'), '1');
		assert.strictEqual(await bare.page.locator('#summary-latest').isVisible(), false);
		assert.strictEqual(await bare.page.locator('#summary-title').isVisible(), false);
		assert.deepStrictEqual(bare.errors, [], 'Bare counter browser errors');
	} finally {
		await context.close();
	}
}

async function testVersusStyle(baseUrl, browser) {
	const context = await makeContext(browser);
	const follow = (id, type, chatname, extra) => Object.assign({ id, type, event: type === 'tiktok' ? 'followed' : 'new_follower', chatname }, extra || {});
	const tally = async page => [await page.textContent('#versus-tally-num-1'), await page.textContent('#versus-tally-num-2')];
	const counts = async page => [await page.textContent('#versus-count-1'), await page.textContent('#versus-count-2')];
	// What a channel's host sends: the race start, a revision, a count set by hand, and followers per platform.
	const host = (side, state) => [{ versusState: Object.assign({ start: 1000, rev: 0, base: 0, follows: {}, latest: null }, state) }, side];
	const send = (page, packet) => page.evaluate(args => processData(args[0], args[1]), packet);
	const versusUrl = baseUrl + '/tipjar.html?preview&style=versus&name=Amethysta&name2=AmethystMay&every=5&everyicon=pie';
	try {
		const { page, errors } = await openTipJar(context, versusUrl + '&accent=%23b388ff&accent2=%23ffb347&panelopacity=0.5');
		assert.strictEqual(await page.locator('.style-container.active').count(), 1);
		assert.strictEqual(await page.textContent('#versus-title'), 'New Followers');
		assert.strictEqual(await page.textContent('#versus-name-1'), 'Amethysta');
		assert.strictEqual(await page.textContent('#versus-name-2'), 'AmethystMay');
		assert.strictEqual(await page.textContent('#versus-initial-1'), 'A');
		assert.strictEqual(await page.locator('#versus-pips-1 .versus-pip').count(), 5);
		assert.strictEqual(await page.locator('#versus-tally-1 svg').count(), 1, 'the pie icon is drawn in the tally');
		assert.strictEqual(await page.locator('#versus-count-1').evaluate(el => getComputedStyle(el).color), 'rgb(179, 136, 255)');
		assert.strictEqual(await page.locator('#versus-count-2').evaluate(el => getComputedStyle(el).color), 'rgb(255, 179, 71)');
		assert.strictEqual(await page.locator('#versus-panel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(18, 24, 34, 0.5)');
		assert.strictEqual(await page.locator('#notification').isVisible(), false);
		for (const hidden of ['#versus-latest-1', '#versus-latest-2']) {
			assert.strictEqual(await page.locator(hidden).isVisible(), false, hidden + ' stays hidden until someone is counted');
		}

		// With no score from a host yet, the page counts for itself: followers on any platform, for the side
		// whose session sent them. Tips, paid subs and renewals are not followers.
		await page.evaluate(events => events.forEach(event => processData(event, 1)), [
			follow('f1', 'youtube', 'YT sub', { chatimg: './media/user1.jpg' }),
			follow('f2', 'twitch', 'Twitch follow'),
			follow('f2', 'twitch', 'Twitch follow'),
			follow('f3', 'tiktok', 'TikTok follow'),
			{ id: 't1', type: 'twitch', chatname: 'Tipper', hasDonation: '$5.00', donoValue: 5 },
			{ id: 's1', type: 'twitch', event: 'new_subscriber', chatname: 'Paid sub', membership: 'Tier 1' },
			{ id: 'r1', type: 'twitch', event: 'resub', chatname: 'Resub', membership: 'Tier 1' },
			follow('f4', 'kick', 'Kick follow')
		]);
		assert.deepStrictEqual(await counts(page), ['4', '0']);
		assert.strictEqual(await page.locator('#versus-pips-1 .versus-pip.on').count(), 4);
		assert.strictEqual(await page.textContent('#versus-latest-name-1'), 'Kick follow');

		// The two sessions number their messages separately, so the same id on the other side is a different person.
		await page.evaluate(event => processData(event, 2), follow('f1', 'twitch', 'May fan', { chatimg: './media/user2.jpg' }));
		assert.deepStrictEqual(await counts(page), ['4', '1']);
		assert((await page.getAttribute('#versus-latest-avatar-2', 'src')).endsWith('/media/user2.jpg'));

		// The fifth on one side sends a reward to the other, and the tally moves when it lands.
		await page.evaluate(event => processData(event, 1), follow('f5', 'youtube', 'Fifth'));
		assert.deepStrictEqual(await counts(page), ['5', '1']);
		assert.deepStrictEqual(await tally(page), ['0', '0']);
		assert.strictEqual(await page.locator('.versus-fly').count(), 1);
		assert.strictEqual(await page.locator('#versus-pips-1 .versus-pip.on').count(), 0);
		await page.waitForFunction(() => document.getElementById('versus-tally-num-2').textContent === '1');
		assert.strictEqual(await page.locator('.versus-fly').count(), 0);
		assert.strictEqual(await page.locator('#versus-side-2.hit').count(), 1);
		assert.strictEqual(await page.locator('#versus-side-1.hit').count(), 0);

		// YouTube can report a subscriber hours late. Anyone who subscribed before the race began is left out,
		// one by one inside a grouped alert too.
		const hourAgo = new Date(Date.now() - 3600000).toISOString();
		const soon = new Date(Date.now() + 60000).toISOString();
		await page.evaluate(event => processData(event, 1), follow('old1', 'youtube', 'Earlier sub', { meta: { subscribedAt: hourAgo } }));
		assert.deepStrictEqual(await counts(page), ['5', '1']);
		assert.strictEqual(await page.textContent('#versus-latest-name-1'), 'Fifth');
		await page.evaluate(event => processData(event, 1), follow('grp1', 'youtube', 'First +2', { meta: { grouped: true, count: 3, others: 2, subscribers: [{ subscribedAt: hourAgo }, { subscribedAt: soon }, { subscribedAt: hourAgo }] } }));
		assert.deepStrictEqual(await counts(page), ['6', '1']);
		await page.evaluate(event => processData(event, 1), follow('grp2', 'youtube', 'First +5', { meta: { grouped: true, count: 6, others: 5 } }));
		assert.deepStrictEqual(await counts(page), ['12', '1']);

		// Names go through the display filter, and only web or packaged image addresses reach the picture.
		await page.evaluate(event => processData(event, 2), follow('g5', 'kick', 'Tom &amp; Jerry<img src=x onerror="window.nameProbe=1">', { chatimg: 'javascript:window.avatarProbe=1' }));
		assert.strictEqual(await page.textContent('#versus-latest-name-2'), 'Tom & Jerry');
		assert.strictEqual(await page.locator('#versus-latest-2 [onerror]').count(), 0);
		assert.strictEqual(await page.getAttribute('#versus-latest-avatar-2', 'src'), null);
		assert.strictEqual(await page.evaluate(() => window.nameProbe || window.avatarProbe), undefined);
		await page.waitForFunction(() => document.getElementById('versus-tally-num-2').textContent === '2' && !document.querySelector('.versus-fly'));
		assert.deepStrictEqual(await counts(page), ['12', '2']);

		// The Tip Jar's own reset and set commands belong to the other jars in the session, not to this board.
		await page.evaluate(() => { processData({ cmd: 'resettipjar' }); processData({ cmd: 'settipjaramount', value: 99 }, 2); });
		assert.deepStrictEqual(await counts(page), ['12', '2']);
		assert.deepStrictEqual(await tally(page), ['0', '2']);

		// A host that keeps the score takes over its side. The first score is drawn as it stands, with nothing thrown.
		await send(page, host(2, { rev: 7, follows: { youtube: 3, twitch: 1 }, latest: { name: 'Host says', avatar: './media/user3.jpg', source: 'twitch' } }));
		assert.deepStrictEqual(await counts(page), ['12', '4']);
		assert.deepStrictEqual(await tally(page), ['0', '2'], 'twelve on one side is two for the other, four is none');
		assert.strictEqual(await page.locator('.versus-fly').count(), 0);
		assert.strictEqual(await page.textContent('#versus-latest-name-2'), 'Host says');
		assert.strictEqual(await page.locator('#versus-pips-1 .versus-pip.on').count(), 2);
		assert.strictEqual(await page.locator('#versus-pips-2 .versus-pip.on').count(), 4);
		assert.strictEqual(await page.getAttribute('#versus-panel', 'aria-label'), 'New Followers: Amethysta 12, AmethystMay 4');
		assert.strictEqual(await page.locator('#versus-share-a').evaluate(el => parseFloat(el.style.width)), 75);
		// From here the host's updates are the only thing that moves that side.
		await page.evaluate(event => processData(event, 2), follow('h1', 'twitch', 'Counted by the host'));
		assert.deepStrictEqual(await counts(page), ['12', '4']);
		// An older or repeated score changes nothing; a newer one with a gain is news.
		await send(page, host(2, { rev: 6, follows: { youtube: 9 } }));
		await send(page, host(2, { rev: 7, follows: { youtube: 9 } }));
		assert.deepStrictEqual(await counts(page), ['12', '4']);
		await send(page, host(2, { rev: 8, follows: { youtube: 3, twitch: 2 }, latest: { name: 'Fifth for May', avatar: '', source: 'twitch' } }));
		assert.deepStrictEqual(await counts(page), ['12', '5']);
		assert.strictEqual(await page.locator('.versus-fly').count(), 1);
		assert.deepStrictEqual(await tally(page), ['0', '2']);
		await page.waitForFunction(() => document.getElementById('versus-tally-num-1').textContent === '1' && !document.querySelector('.versus-fly'));
		assert.strictEqual(await page.textContent('#versus-latest-name-2'), 'Fifth for May');
		// A count corrected by hand, and a new race, are drawn as they stand.
		await send(page, host(2, { rev: 9, base: 30 }));
		assert.deepStrictEqual(await counts(page), ['12', '30']);
		assert.deepStrictEqual(await tally(page), ['6', '2'], 'a corrected count never throws rewards');
		assert.strictEqual(await page.locator('.versus-fly').count(), 0);
		await send(page, host(2, { start: 2000, rev: 0 }));
		assert.deepStrictEqual(await counts(page), ['12', '0']);
		assert.deepStrictEqual(await tally(page), ['0', '2']);
		assert.strictEqual(await page.locator('#versus-latest-2').isVisible(), false);
		// A score from the race before the reset is out of date, whatever its revision.
		await send(page, host(2, { start: 1000, rev: 50, base: 44 }));
		await send(page, [{ versusState: { start: 'soon', rev: 1 } }, 2]);
		await send(page, [{ versusState: null }, 2]);
		assert.deepStrictEqual(await counts(page), ['12', '0']);
		assert.strictEqual(await page.evaluate(() => currentAmount), 0, 'the single total stays idle');
		assert.strictEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.indexOf('tipjar') === 0).length), 0, 'the board saves nothing of its own');

		// A rush of rewards flies three at most; the tally still ends up right.
		await page.evaluate(() => {
			for (let i = 1; i <= 40; i++) processData({ versusState: { start: 2000, rev: i, base: 0, follows: { twitch: i } } }, 2);
		});
		assert(await page.locator('.versus-fly').count() <= 3);
		await page.waitForFunction(() => document.getElementById('versus-tally-num-1').textContent === '8' && !document.querySelector('.versus-fly'));
		await page.setViewportSize({ width: 320, height: 420 });
		await send(page, host(1, { rev: 1, follows: { twitch: 1234 }, latest: { name: 'A supporter with a very long display name that keeps on going', avatar: '', source: 'twitch' } }));
		assert.deepStrictEqual(await counts(page), ['1234', '40']);
		assert(await page.locator('#versus-panel').evaluate(el => el.scrollWidth <= el.clientWidth), 'versus overflows at 320px');
		assert.deepStrictEqual(errors, [], 'Versus browser errors');
		await page.close();

		// A copy of the board that opens late shows the same score as one that was there from the start.
		const early = await openTipJar(context, versusUrl);
		for (let i = 1; i <= 5; i++) await send(early.page, host(1, { rev: i, follows: { youtube: i }, latest: { name: 'Fan ' + i, avatar: '', source: 'youtube' } }));
		const late = await openTipJar(context, versusUrl);
		await send(late.page, host(1, { rev: 5, follows: { youtube: 5 }, latest: { name: 'Fan 5', avatar: '', source: 'youtube' } }));
		await early.page.waitForFunction(() => document.getElementById('versus-tally-num-2').textContent === '1');
		for (const copy of [early, late]) {
			assert.deepStrictEqual(await counts(copy.page), ['5', '0']);
			assert.deepStrictEqual(await tally(copy.page), ['0', '1']);
			assert.strictEqual(await copy.page.textContent('#versus-latest-name-1'), 'Fan 5');
			assert.deepStrictEqual(copy.errors, []);
		}

		// The board is a follower race whatever else the link asks for, and a source filter applies to a host's score too.
		for (const [params, expected] of [['&goalmetric=subscribers', '1'], ['&subpoints=1&giftpoints=1&followpoints=3', '1'], ['&title=Pie%20Day', '1']]) {
			const next = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=versus' + params);
			await next.page.evaluate(events => events.forEach(event => processData(event, 2)), supporterEvents);
			assert.strictEqual(await next.page.textContent('#versus-title'), params.indexOf('title=') === -1 ? 'New Followers' : 'Pie Day', params);
			assert.deepStrictEqual(await counts(next.page), ['0', expected], params);
			// Without "every" there is nothing to earn, so the dots and the tally are not shown.
			assert.strictEqual(await next.page.locator('#versus-tally-2').isVisible(), false, params);
			assert.strictEqual(await next.page.locator('#versus-pips-2').isVisible(), false, params);
			assert.strictEqual(await next.page.textContent('#versus-name-2'), 'Player 2', params);
			assert.deepStrictEqual(next.errors, [], params + ' browser errors');
			await next.page.close();
		}
		const filtered = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=versus&tipjarsource=youtube,twitch');
		await send(filtered.page, host(1, { rev: 1, base: 2, follows: { youtube: 3, youtubeshorts: 9, twitch: 4, tiktok: 50 } }));
		assert.deepStrictEqual(await counts(filtered.page), ['9', '0']);
		await filtered.page.evaluate(events => events.forEach(event => processData(event, 2)), [follow('k1', 'tiktok', 'Filtered out'), follow('k2', 'youtubeshorts', 'Shorts are YouTube')]);
		assert.deepStrictEqual(await counts(filtered.page), ['9', '1']);
		const included = { name: 'YouTube fan', source: 'youtube' };
		const excluded = { name: 'TikTok fan', source: 'tiktok' };
		await send(filtered.page, host(1, { rev: 2, follows: { youtube: 4, tiktok: 51 }, latest: excluded, latestBySource: [excluded, included] }));
		assert.strictEqual(await filtered.page.textContent('#versus-latest-name-1'), included.name);

		// Each session gets its own hidden bridge, and a message belongs to the side whose bridge delivered it.
		const live = await openTipJar(context, baseUrl + '/tipjar.html?session=AAAA&session2=BBBB&password2=secret&style=versus&every=5&persistent&hidelatest&hidetitle');
		assert((await live.page.getAttribute('#frame1', 'src')).indexOf('view=AAAA') !== -1);
		const second = await live.page.getAttribute('#frame2', 'src');
		assert(second.indexOf('view=BBBB') !== -1 && second.indexOf('room=BBBB') !== -1 && second.indexOf('password=secret') !== -1 && second.indexOf('label=tipjar') !== -1, second);
		const bridges = live.page.frames().filter(frame => frame !== live.page.mainFrame());
		assert.strictEqual(bridges.length, 2);
		for (const frame of bridges) {
			const side = frame.url().indexOf('view=BBBB') !== -1 ? 'B' : 'A';
			await frame.evaluate(name => {
				const post = overlayNinja => window.parent.postMessage({ dataReceived: { overlayNinja } }, '*');
				for (let i = 0; i < (name === 'B' ? 3 : 2); i++) post({ id: 'p' + i, type: 'youtube', event: 'new_follower', chatname: name + i });
				if (name === 'A') post({ versusState: { start: 5000, rev: 3, base: 0, follows: { youtube: 6 }, latest: null }, ssnControl: { id: 'control-a-1', target: 'tipjar' } });
			}, side);
		}
		await live.page.waitForFunction(() => document.getElementById('versus-count-1').textContent === '6' && document.getElementById('versus-count-2').textContent === '3');
		await live.page.waitForFunction(() => document.getElementById('versus-tally-num-2').textContent === '1');
		assert.strictEqual(await live.page.locator('#versus-title').isVisible(), false);
		assert.strictEqual(await live.page.locator('#versus-latest-1').isVisible(), false);
		assert.strictEqual(await live.page.evaluate(() => Object.keys(localStorage).filter(key => key.indexOf('tipjar') === 0).length), 0);
		assert.deepStrictEqual(live.errors, [], 'Bridged versus browser errors');
		// A board pointed at one session twice has no second side to listen to.
		const same = await openTipJar(context, baseUrl + '/tipjar.html?session=AAAA&session2=AAAA&style=versus');
		assert.strictEqual(await same.page.locator('#frame2').count(), 0);

		// The scoring rules the host and the board share.
		const rules = await same.page.evaluate(() => {
			const began = Date.parse('2026-11-27T19:00:00Z');
			const at = minutes => new Date(began + minutes * 60000).toISOString();
			const follower = meta => ({ type: 'youtube', event: 'new_follower', chatname: 'x', meta });
			return {
				plain: SSNVersus.countFollowers({ type: 'twitch', event: 'new_follower' }, began),
				tiktok: SSNVersus.countFollowers({ type: 'tiktok', event: 'followed' }, began),
				chat: SSNVersus.countFollowers({ type: 'twitch', chatmessage: 'hi' }, began),
				paid: SSNVersus.countFollowers({ type: 'twitch', event: 'new_subscriber' }, began),
				before: SSNVersus.countFollowers(follower({ subscribedAt: at(-60) }), began),
				after: SSNVersus.countFollowers(follower({ subscribedAt: at(1) }), began),
				undated: SSNVersus.countFollowers(follower({ subscribedAt: 'not a date' }), began),
				noStart: SSNVersus.countFollowers(follower({ subscribedAt: at(-60) }), 0),
				grouped: SSNVersus.countFollowers(follower({ grouped: true, count: 4, subscribers: [{ subscribedAt: at(-5) }, { subscribedAt: at(2) }, { subscribedAt: at(-1) }, { subscribedAt: at(3) }] }), began),
				groupedAllEarly: SSNVersus.countFollowers(follower({ grouped: true, count: 2, subscribers: [{ subscribedAt: at(-5) }, { subscribedAt: at(-1) }] }), began),
				groupedBare: SSNVersus.countFollowers(follower({ grouped: true, count: 6 }), began),
				shorts: SSNVersus.sourceOf({ type: 'YouTube Shorts' }),
				total: SSNVersus.total({ base: 2, follows: { youtube: 3, twitch: 4 } }),
				totalFiltered: SSNVersus.total({ base: 2, follows: { youtube: 3, twitch: 4 } }, ['twitch']),
				newerRace: SSNVersus.isNewer({ start: 2, rev: 0 }, { start: 1, rev: 99 }),
				olderRev: SSNVersus.isNewer({ start: 2, rev: 3 }, { start: 2, rev: 3 }),
				cleaned: SSNVersus.normalizeState({ start: '10', rev: '2', base: -4, follows: { YouTube: '3', bad: 'x', zero: 0 }, latest: { name: 5, avatar: 7 } })
			};
		});
		assert.deepStrictEqual(rules, {
			plain: 1, tiktok: 1, chat: 0, paid: 0, before: 0, after: 1, undated: 1, noStart: 1, grouped: 2, groupedAllEarly: 0, groupedBare: 6,
			shorts: 'youtube', total: 9, totalFiltered: 6, newerRace: true, olderRev: false,
			cleaned: { start: 10, rev: 2, base: 0, follows: { youtube: 3 }, latest: { name: '5', avatar: '', source: '' } }
		});
	} finally {
		await context.close();
	}
}

// The host's side of the Versus board, run against the real module with the host's globals stood in.
async function testVersusHost() {
	const vm = require("vm");
	const sources = ["shared/versus.js", "shared/versus-host.js"].map(file => fs.readFileSync(path.join(repoRoot, file), "utf8"));
	const stored = {};
	const startHost = session => {
		const sent = [];
		const host = { streamID: session, sent, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Object, Array, Promise,
			localStorage: { getItem: key => (key in stored ? stored[key] : null), setItem: (key, value) => { stored[key] = String(value); } },
			sendTargetP2P: (data, target) => { sent.push({ target, state: JSON.parse(JSON.stringify(data.versusState)) }); return Promise.resolve(true); } };
		host.window = host;
		vm.createContext(host);
		sources.forEach(code => vm.runInContext(code, host));
		return host;
	};
	const settle = () => new Promise(resolve => setTimeout(resolve, 400));
	const follower = (type, chatname, extra) => Object.assign({ type, event: "new_follower", chatname }, extra || {});

	const host = startHost("AAAA");
	const service = host.versusService;
	// Nothing is kept until a board has connected to this session.
	service.count(follower("twitch", "Too early"));
	assert.strictEqual(service.state(), null);
	const initial = JSON.parse(JSON.stringify(service.snapshot()));
	const start = initial.start;
	assert.deepStrictEqual(initial, { start, rev: 0, base: 0, follows: {}, latest: null });

	// Followers are counted per platform; a rush goes out as a few updates, and the last one has the full count.
	for (let i = 0; i < 30; i++) service.count(follower(i % 2 ? "twitch" : "youtubeshorts", "Fan " + i, { chatimg: "https://example.com/" + i + ".jpg" }));
	service.count({ type: "twitch", event: "new_subscriber", chatname: "Paid" });
	service.count({ type: "twitch", chatname: "Chatter", chatmessage: "hello" });
	await settle();
	assert(host.sent.length >= 1 && host.sent.length <= 3, "a rush of 30 sent " + host.sent.length + " updates");
	assert.strictEqual(host.sent[0].target, "tipjar");
	let last = host.sent[host.sent.length - 1].state;
	assert.deepStrictEqual(last.follows, { youtube: 15, twitch: 15 });
	assert.strictEqual(last.rev, 30);
	assert.deepStrictEqual(last.latest, { name: "Fan 29", avatar: "https://example.com/29.jpg", source: "twitch" });

	// A YouTube subscriber from before the race began does not count, one by one inside a grouped alert too.
	const early = new Date(start - 3600000).toISOString(), during = new Date(start + 1000).toISOString();
	service.count(follower("youtube", "Earlier", { meta: { subscribedAt: early } }));
	service.count(follower("youtube", "Group +2", { meta: { grouped: true, count: 3, subscribers: [{ subscribedAt: early }, { subscribedAt: during }, { subscribedAt: early }] } }));
	service.count(follower("youtube", "On time", { chatimg: "data:image/png;base64," + "A".repeat(3000), meta: { subscribedAt: during } }));
	await settle();
	last = host.sent[host.sent.length - 1].state;
	assert.deepStrictEqual(last.follows, { youtube: 17, twitch: 15 });
	assert.deepStrictEqual(last.latest, { name: "On time", avatar: "", source: "youtube" });

	// A correction sets the score and counting carries on from it; the race start does not move.
	assert.strictEqual(service.setCount("-1"), false);
	assert.strictEqual(service.setCount("12.9"), true);
	service.count(follower("kick", "After the fix"));
	await settle();
	last = host.sent[host.sent.length - 1].state;
	assert.deepStrictEqual([last.start, last.base, last.follows], [start, 12, { kick: 1 }]);
	assert.strictEqual(host.SSNVersus.total(last), 13);

	// The score survives a restart of the host, and belongs to the session it was counted for.
	const restarted = startHost("AAAA");
	assert.strictEqual(restarted.SSNVersus.total(restarted.versusService.state()), 13);
	restarted.versusService.count(follower("twitch", "After the restart"));
	await settle();
	assert.strictEqual(restarted.SSNVersus.total(restarted.sent[restarted.sent.length - 1].state), 14);
	assert(restarted.sent[restarted.sent.length - 1].state.rev > last.rev);
	assert.strictEqual(startHost("BBBB").versusService.state(), null);

	// A reset starts a new race: zero, a later start, and nobody from before it.
	await new Promise(resolve => setTimeout(resolve, 5));
	assert.strictEqual(restarted.versusService.reset(), true);
	restarted.versusService.count(follower("youtube", "Before the reset", { meta: { subscribedAt: new Date(start).toISOString() } }));
	await settle();
	const fresh = restarted.sent[restarted.sent.length - 1].state;
	assert(fresh.start > start);
	assert.deepStrictEqual([fresh.rev, fresh.base, fresh.follows, fresh.latest], [0, 0, {}, null]);
	const twitchFollow = (userId, followedAt) => follower("twitch", "Same name", { meta: { userId, followedAt } });
	restarted.versusService.count(twitchFollow("one", fresh.start - 1));
	restarted.versusService.count(twitchFollow("one", fresh.start + 1));
	restarted.versusService.count(twitchFollow("two", fresh.start + 1));
	const resumed = startHost("AAAA");
	resumed.versusService.count(twitchFollow("one", fresh.start + 1));
	resumed.versusService.count(twitchFollow("one", fresh.start + 2));
	assert.strictEqual(resumed.versusService.state().follows.twitch, 3);
	assert.strictEqual(restarted.SSNVersus.isNewer(fresh, last), true);
}

function testPopupContract() {
	const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
	const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
	assert(popupHtml.includes('data-optionparam12="goalmetric"'));
	assert(popupHtml.includes('<option value="count">Number of qualifying donations</option>'));
	assert(popupHtml.includes('<option value="followers">New followers / YouTube subscribers</option>'));
	assert(popupHtml.includes('<option value="subscribers">New paid subs / YouTube members</option>'));
	assert(popupHtml.includes('<option value="counter">Counter (running total, no goal)</option>'));
	assert(popupHtml.includes('data-optionparam12="tipjarevent"'));
	assert(popupHtml.includes('<option value="superchat">Super Chats only</option>'));
	assert(popupHtml.includes('data-optionparam12="countlabel"'));
	assert(popupHtml.includes('data-param12="excludegiftpurchase"'));
	assert(popupHtml.includes('data-param12="notips"'));
	assert(popupHtml.includes('data-param12="nosubs"'));
	assert(popupHtml.includes('data-param12="noresubs"'));
	assert(popupHtml.includes('data-param12="nogifts"'));
	assert(popupSource.includes("event: 'superchat'"));
	// The Versus board has its own reset and correction, apart from the Tip Jar's, and its score is kept by the host.
	assert(popupHtml.includes('data-action="resetversus" data-target="tipjar"'));
	assert(popupHtml.includes('data-action="setversuscount" data-target="tipjar" data-value-source="versus-set-count"'));
	assert(popupHtml.includes('<label for="versus-set-count">'));
	assert(popupSource.includes('msg.cmd == "resetversus"') && popupSource.includes('msg.cmd == "setversuscount"'));
	const hostSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
	assert(hostSource.includes('request.cmd === "resetversus"') && hostSource.includes('request.cmd === "setversuscount"'));
	assert(hostSource.includes('if (window.versusService) window.versusService.count(message);'));
	const loaderSource = fs.readFileSync(path.join(repoRoot, "loader.js"), "utf8");
	const loadOrder = ["'./shared/versus.js'", "'./background.js", "'./shared/versus-host.js'"].map(name => loaderSource.indexOf(name));
	assert(loadOrder[0] !== -1 && loadOrder[0] < loadOrder[1] && loadOrder[1] < loadOrder[2], "the host loads the Versus rules before, and its score keeper after, background.js");
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
		await testFollowerTipExclusion(baseUrl, browser);
		console.log("PASS Follower and Hype goals honor tip exclusion while preserving follower contributions");
		await testSubscriberGoal(baseUrl, browser);
		console.log("PASS Subscriber goals count new subs, members and gifts only, with their own saved total");
		await testCounterStyle(baseUrl, browser);
		console.log("PASS Counter shows a running total and the latest supporter with no goal behavior");
		await testVersusStyle(baseUrl, browser);
		console.log("PASS Versus shows each host's score on its own side and lands a reward on the other for every full set");
		await testVersusHost();
		console.log("PASS The host keeps a Versus score per session, skips followers from before the race, and survives a restart");
		await testJarPrefillReset(baseUrl, browser);
		console.log("PASS Reset clears prefilled jars and cancels queued donation hearts in donation and Hype modes");
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
