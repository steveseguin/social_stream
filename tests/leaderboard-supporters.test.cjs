"use strict";

// Run: node tests/leaderboard-supporters.test.cjs

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
	".svg": "image/svg+xml; charset=utf-8",
	".woff2": "font/woff2"
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

async function makeContext(browser, viewport) {
	const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
	await context.route("https://**/*", async route => {
		const url = route.request().url();
		if (url.startsWith("https://vdo.socialstream.ninja/")) {
			await route.fulfill({
				contentType: "text/html; charset=utf-8",
				body: "<!doctype html><html><body></body></html>"
			});
			return;
		}
		if (/fonts\.(?:googleapis|gstatic)\.com/.test(url)) {
			await route.fulfill({ contentType: "text/css; charset=utf-8", body: "" });
			return;
		}
		await route.abort();
	});
	return context;
}

async function openPage(context, url) {
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(String(error && error.stack || error)));
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
	await page.waitForFunction(() => typeof window.processData === "function");
	return { page, errors };
}

async function testExistingLayoutIsolation(baseUrl, browser) {
	const context = await makeContext(browser, { width: 1000, height: 700 });
	try {
		const corner = await openPage(context, baseUrl + "/leaderboard.html?session=corner-isolation");
		const cornerState = await corner.page.evaluate(() => ({
			layout: document.body.getAttribute("data-layout"),
			showcaseDisplay: getComputedStyle(document.getElementById("supporter-showcase")).display,
			listDisplay: getComputedStyle(document.getElementById("leaderboard-content")).display,
			containerWidth: Math.round(document.getElementById("leaderboard-container").getBoundingClientRect().width)
		}));
		assert.strictEqual(cornerState.layout, "corner");
		assert.strictEqual(cornerState.showcaseDisplay, "none");
		assert.notStrictEqual(cornerState.listDisplay, "none");
		assert.strictEqual(cornerState.containerWidth, 300);
		assert.deepStrictEqual(corner.errors, [], "Corner layout browser errors: " + corner.errors.join("; "));

		const topbar = await openPage(context, baseUrl + "/leaderboard.html?session=topbar-isolation&layout=topbar");
		const topbarState = await topbar.page.evaluate(() => ({
			layout: document.body.getAttribute("data-layout"),
			showcaseDisplay: getComputedStyle(document.getElementById("supporter-showcase")).display,
			containerHeight: Math.round(document.getElementById("leaderboard-container").getBoundingClientRect().height)
		}));
		assert.strictEqual(topbarState.layout, "topbar");
		assert.strictEqual(topbarState.showcaseDisplay, "none");
		assert.strictEqual(topbarState.containerHeight, 60);
		assert.deepStrictEqual(topbar.errors, [], "Topbar layout browser errors: " + topbar.errors.join("; "));

		const popup = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
		assert(popup.includes('<option value="supporters">Supporter Showcase (Top 3 + Recent)</option>'));
	} finally {
		await context.close();
	}
}

async function testSupporterShowcase(baseUrl, browser) {
	const context = await makeContext(browser, { width: 620, height: 720 });
	try {
		const session = "supporter-showcase-contract";
		const url = baseUrl + "/leaderboard.html?session=" + session + "&layout=supporters&showavatar&showsource&maxentries=4&rotateinterval=60&persistdata";
		const harness = await openPage(context, url);
		const page = harness.page;

		await page.evaluate(() => {
			const now = Date.now();
			const send = window.processData;
			[
				{ id: "d1", chatname: "Alex One", type: "youtube", chatimg: "./media/user1.jpg", event: "donation", hasDonation: "$20.00", donoValue: 20, timestamp: now - 5000 },
				{ id: "d2", chatname: "Blair Two", type: "twitch", chatimg: "./media/user2.jpg", event: "donation", hasDonation: "$50.00", donoValue: 50, timestamp: now - 4000 },
				{ id: "d3", chatname: "Casey Three", type: "kick", chatimg: "./media/user3.jpg", event: "donation", hasDonation: "$30.00", donoValue: 30, timestamp: now - 3000 },
				{ id: "d4", chatname: "Drew Four", type: "tiktok", chatimg: "./media/user5.jpg", event: "gift", hasDonation: "$10.00", donoValue: 10, timestamp: now - 2000 },
				{ id: "d5", chatname: "Alex One", type: "youtube", chatimg: "./media/user1.jpg", event: "superchat", hasDonation: "$40.00", donoValue: 40, timestamp: now - 1000 },

				{ id: "s1", chatname: "Gift Leader", type: "twitch", chatimg: "./media/user1.jpg", event: "subscription_gift", total: 10, timestamp: now - 5000 },
				{ id: "s2", chatname: "Member Maker", type: "youtube", chatimg: "./media/user2.jpg", event: "giftpurchase", membership: "gift_giver", subtitle: "7 memberships", timestamp: now - 4000 },
				{ id: "s3", chatname: "Sub Supporter", type: "kick", chatimg: "./media/user3.jpg", event: "subscription_gift", meta: { totalGifted: 4 }, timestamp: now - 3000 },
				{ id: "s4", chatname: "Fresh Member", type: "twitch", chatimg: "./media/user5.jpg", event: "new_subscriber", membership: "Tier 1", timestamp: now - 2000 },
				{ id: "s5", chatname: "Returning Member", type: "kick", chatimg: "./media/user1.jpg", event: "resub", meta: { cumulativeMonths: 8 }, timestamp: now - 1000 },

				{ id: "f1", chatname: "Follower One", type: "youtube", chatimg: "./media/user1.jpg", event: "new_follower", timestamp: now - 5000 },
				{ id: "f2", chatname: "Follower Two", type: "twitch", chatimg: "./media/user2.jpg", event: "new_follower", timestamp: now - 4000 },
				{ id: "f3", chatname: "Follower Three", type: "kick", chatimg: "./media/user3.jpg", event: "new_follower", timestamp: now - 3000 },
				{ id: "f4", chatname: "Follower Four", type: "tiktok", chatimg: "./media/user5.jpg", event: "followed", timestamp: now - 2000 },
				{ id: "f5", chatname: "<img src=x onerror=window.__unsafe=true>", type: "facebook", event: "new_follower", timestamp: now - 1000 }
			].forEach(send);
		});

		const donationState = await page.evaluate(() => ({
			category: document.body.getAttribute("data-supporter-category"),
			title: document.getElementById("supporter-category-title").textContent,
			topNames: Array.from(document.querySelectorAll(".supporter-top-name")).map(element => element.textContent),
			topValues: Array.from(document.querySelectorAll(".supporter-top-value")).map(element => element.textContent),
			recentCount: document.querySelectorAll(".supporter-recent-item").length,
			recentNames: Array.from(document.querySelectorAll(".supporter-recent-name")).map(element => element.textContent),
			showcaseDisplay: getComputedStyle(document.getElementById("supporter-showcase")).display,
			legacyListDisplay: getComputedStyle(document.getElementById("leaderboard-content")).display,
			overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
			storageKeys: Object.keys(localStorage).sort()
		}));
		assert.strictEqual(donationState.category, "donations");
		assert.strictEqual(donationState.title, "Donations");
		assert.deepStrictEqual(donationState.topNames, ["Alex One", "Blair Two", "Casey Three"]);
		assert.deepStrictEqual(donationState.topValues, ["$60.00", "$50.00", "$30.00"]);
		assert.strictEqual(donationState.recentCount, 4);
		assert.deepStrictEqual(donationState.recentNames, ["Alex One", "Drew Four", "Casey Three", "Blair Two"]);
		assert.notStrictEqual(donationState.showcaseDisplay, "none");
		assert.strictEqual(donationState.legacyListDisplay, "none");
		assert(donationState.overflow <= 1, "Supporter layout overflowed horizontally");
		assert.deepStrictEqual(donationState.storageKeys, ["leaderboard_supporter-showcase-contract_supporters"]);

		await page.evaluate(() => window.setSupporterCategory("subscriptions", false));
		const subscriptionState = await page.evaluate(() => ({
			category: document.body.getAttribute("data-supporter-category"),
			topNames: Array.from(document.querySelectorAll(".supporter-top-name")).map(element => element.textContent),
			topValues: Array.from(document.querySelectorAll(".supporter-top-value")).map(element => element.textContent),
			recentDetails: Array.from(document.querySelectorAll(".supporter-recent-detail")).map(element => element.textContent)
		}));
		assert.strictEqual(subscriptionState.category, "subscriptions");
		assert.deepStrictEqual(subscriptionState.topNames, ["Gift Leader", "Member Maker", "Sub Supporter"]);
		assert.deepStrictEqual(subscriptionState.topValues, ["10 gifted", "7 gifted", "4 gifted"]);
		assert(subscriptionState.recentDetails.some(detail => detail === "Resubscribed · 8 months"));

		await page.evaluate(() => window.setSupporterCategory("followers", false));
		const followerState = await page.evaluate(() => ({
			category: document.body.getAttribute("data-supporter-category"),
			topHidden: document.getElementById("supporter-top-section").classList.contains("is-hidden"),
			recentCount: document.querySelectorAll(".supporter-recent-item").length,
			unsafeFlag: window.__unsafe === true,
			unsafeImageCount: document.querySelectorAll('.supporter-recent-list img[src="x"]').length,
			latestName: document.querySelector(".supporter-recent-name").textContent
		}));
		assert.strictEqual(followerState.category, "followers");
		assert.strictEqual(followerState.topHidden, true);
		assert.strictEqual(followerState.recentCount, 4);
		assert.strictEqual(followerState.unsafeFlag, false);
		assert.strictEqual(followerState.unsafeImageCount, 0);
		assert.strictEqual(followerState.latestName, "<img src=x onerror=window.__unsafe=true>");

		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => document.querySelectorAll(".supporter-top-card").length === 3);
		const restored = await page.evaluate(() => ({
			topNames: Array.from(document.querySelectorAll(".supporter-top-name")).map(element => element.textContent),
			recentCount: document.querySelectorAll(".supporter-recent-item").length
		}));
		assert.deepStrictEqual(restored.topNames, ["Alex One", "Blair Two", "Casey Three"]);
		assert.strictEqual(restored.recentCount, 4);
		assert.deepStrictEqual(harness.errors, [], "Supporter layout browser errors: " + harness.errors.join("; "));
	} finally {
		await context.close();
	}
}

async function testAutomaticRotation(baseUrl, browser) {
	const context = await makeContext(browser, { width: 620, height: 720 });
	try {
		const harness = await openPage(context, baseUrl + "/leaderboard.html?session=supporter-rotation&layout=supporters&demo&rotateinterval=3");
		assert.strictEqual(await harness.page.getAttribute("body", "data-supporter-category"), "donations");
		await harness.page.waitForFunction(
			() => document.body.getAttribute("data-supporter-category") === "subscriptions",
			null,
			{ timeout: 5000 }
		);
		assert.deepStrictEqual(harness.errors, [], "Supporter rotation browser errors: " + harness.errors.join("; "));
	} finally {
		await context.close();
	}
}

async function main() {
	const { server, baseUrl } = await startServer();
	const browser = await chromium.launch({ headless: true });
	try {
		await testExistingLayoutIsolation(baseUrl, browser);
		console.log("PASS existing leaderboard layouts remain isolated from Supporter Showcase");
		await testSupporterShowcase(baseUrl, browser);
		console.log("PASS Supporter Showcase ranks, rotates, persists, and safely renders activity");
		await testAutomaticRotation(baseUrl, browser);
		console.log("PASS Supporter Showcase automatically rotates categories");
	} finally {
		await browser.close();
		await new Promise(resolve => server.close(resolve));
	}
}

main().catch(error => {
	console.error(error.stack || error);
	process.exit(1);
});
