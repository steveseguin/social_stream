const { chromium } = require("playwright");

const DEMO_URL = "https://webml-community-gemma-4-webgpu-kernels.static.hf.space/index.html";

(async () => {
	let browser;
	try {
		browser = await chromium.launch({
			channel: "chrome",
			headless: true,
			args: ["--enable-unsafe-webgpu"]
		});
		const context = await browser.newContext();
		const page = await context.newPage();
		page.on("console", message => {
			if (message.type() === "error" || message.type() === "warning") {
				console.log(`PAGE_${message.type().toUpperCase()}:`, message.text());
			}
		});
		page.on("pageerror", error => console.log("PAGE_ERROR:", error.message));

		await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
		const gpu = await page.evaluate(async () => ({
			hasWebGpu: !!navigator.gpu,
			hasAdapter: !!(navigator.gpu && (await navigator.gpu.requestAdapter()))
		}));
		if (!gpu.hasAdapter) throw new Error(`Installed Chrome has no WebGPU adapter: ${JSON.stringify(gpu)}`);

		const startedAt = Date.now();
		await page.click("#loadBtn");
		await page.waitForFunction(() => document.getElementById("loadBtnLabel")?.textContent?.includes("Model loaded"), null, { timeout: 1200000 });
		const loadMs = Date.now() - startedAt;

		await page.fill("#input", "Reply with exactly: Gemma kernel test passed");
		const generationStartedAt = Date.now();
		await page.click("#sendBtn");
		await page.waitForFunction(
			() => {
				const message = document.querySelector("#thread .msg.assistant:last-child");
				return message && message.querySelector(".meta") && !message.querySelector(".caret");
			},
			null,
			{ timeout: 300000 }
		);
		const generationMs = Date.now() - generationStartedAt;
		const result = await page.evaluate(() => {
			const message = document.querySelector("#thread .msg.assistant:last-child");
			return {
				text: message?.querySelector(".bubble")?.textContent?.trim() || "",
				meta: message?.querySelector(".meta")?.textContent?.trim() || "",
				status: document.getElementById("statusText")?.textContent?.trim() || ""
			};
		});

		console.log("GEMMA_KERNEL_RESULT:", JSON.stringify({ loadMs, generationMs, gpu, ...result }));
		if (!/Gemma kernel test passed/i.test(result.text)) {
			throw new Error(`Unexpected Gemma response: ${JSON.stringify(result)}`);
		}
		console.log("PASS Gemma 4 custom WebGPU kernel benchmark");
	} finally {
		if (browser) await browser.close().catch(() => {});
	}
})().catch(error => {
	console.error(error?.stack || error);
	process.exit(1);
});
