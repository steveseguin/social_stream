const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	await page.goto("https://www.tiktok.com/@raoul.le.blanc274/live", {
		waitUntil: "domcontentloaded",
		timeout: 60000
	});
	await page.waitForTimeout(20000);
	const result = await page.evaluate(() => {
		const rows = Array.from(document.querySelectorAll("[data-index]")).map((row) => ({
			index: row.getAttribute("data-index"),
			text: (row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160)
		}));
		const messages = Array.from(document.querySelectorAll("[data-e2e='chat-message']")).map((msg) => ({
			index: msg.closest("[data-index]")?.getAttribute("data-index") || "",
			name: msg.querySelector("[data-e2e='message-owner-name']")?.textContent?.trim() || "",
			text: (msg.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160)
		}));
		const indexCounts = rows.reduce((acc, row) => {
			acc[row.index] = (acc[row.index] || 0) + 1;
			return acc;
		}, {});
		return {
			url: location.href,
			title: document.title,
			rowCount: rows.length,
			messageCount: messages.length,
			indexes: rows.map((row) => row.index).slice(0, 40),
			duplicateIndexes: Object.keys(indexCounts).filter((key) => indexCounts[key] > 1).slice(0, 20),
			samples: messages.slice(-8)
		};
	});
	console.log(JSON.stringify(result, null, 2));
	await browser.close();
})().catch((error) => {
	console.error(error && error.stack || error);
	process.exit(1);
});
