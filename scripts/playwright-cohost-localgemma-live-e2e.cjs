const { chromium } = require("playwright");
const { startStaticServer } = require("./playwright-static-server.cjs");

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4185;

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

(async () => {
	const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
	let browser;
	try {
		browser = await chromium.launch({
			channel: "chrome",
			headless: false,
			args: ["--enable-unsafe-webgpu", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
		});
		const context = await browser.newContext({ permissions: ["microphone", "camera"] });
		const page = await context.newPage();
		page.on("console", message => {
			if (message.type() === "error" || message.type() === "warning") {
				console.log(`PAGE_${message.type().toUpperCase()}:`, message.text());
			}
		});
		page.on("pageerror", error => console.log("PAGE_ERROR:", error.message));
		page.on("dialog", async dialog => {
			console.log("PAGE_DIALOG:", dialog.type(), dialog.message());
			await dialog.accept().catch(() => {});
		});

		await page.goto(`http://${HOST}:${PORT}/cohost.html?session=local-gemma-live-e2e`, {
			waitUntil: "domcontentloaded"
		});
		await page.waitForSelector("#providerSelect");
		await page.selectOption("#providerSelect", "localgemma");
		await page.selectOption("#responseType", "text");
		await page.waitForFunction(() => Array.from(document.querySelectorAll("#videoSource option")).some(option => option.value !== "none"), null, {
			timeout: 30000
		});
		const videoDeviceId = await page.$eval("#videoSource", select => Array.from(select.options).find(option => option.value !== "none")?.value || "");
		await page.selectOption("#videoSource", videoDeviceId);

		const startedAt = Date.now();
		await page.click("#startButton");
		try {
			await page.waitForFunction(() => document.getElementById("startButton")?.dataset.started === "true", null, {
				timeout: 180000
			});
		} catch (error) {
			const startupState = await page.evaluate(() => ({
				startText: document.getElementById("startButton")?.textContent.trim() || "",
				started: document.getElementById("startButton")?.dataset.started || "",
				diagState: document.getElementById("diagState")?.textContent.trim() || "",
				diagEvent: document.getElementById("diagEvent")?.textContent.trim() || "",
				diagError: document.getElementById("diagError")?.textContent.trim() || "",
				status: document.getElementById("status")?.textContent.trim() || ""
			}));
			throw new Error(`Cohost did not start: ${JSON.stringify(startupState)}; ${error.message}`);
		}
		await page.waitForFunction(
			() => {
				const button = document.getElementById("sendButton");
				return button && !button.disabled && button.textContent.trim() === "Send";
			},
			null,
			{ timeout: 180000 }
		);
		const readyMs = Date.now() - startedAt;

		const assistantCount = await page.locator("#responses .assistant-message").count();
		const prompt = "Briefly describe what you see on camera.";
		await page.fill(".message-input", prompt);
		await page.press(".message-input", "Enter");
		await page.waitForFunction(
			expectedCount => {
				const messages = Array.from(document.querySelectorAll("#responses .assistant-message"));
				return messages.length > expectedCount && messages.at(-1).textContent.trim().length > 0;
			},
			assistantCount,
			{ timeout: 120000 }
		);

		const state = await page.evaluate(() => ({
			diagProvider: document.getElementById("diagProvider")?.textContent.trim() || "",
			diagState: document.getElementById("diagState")?.textContent.trim() || "",
			diagError: document.getElementById("diagError")?.textContent.trim() || "",
			videoDisabled: document.getElementById("videoSource")?.disabled,
			videoValue: document.getElementById("videoSource")?.value || "",
			response: Array.from(document.querySelectorAll("#responses .assistant-message")).at(-1)?.textContent.trim() || ""
		}));

		assert(state.diagProvider.toLowerCase().includes("gemma"), `Unexpected provider diagnostics: ${state.diagProvider}`);
		assert(!state.diagError || state.diagError === "-", `Gemma cohost diagnostics reported an error: ${state.diagError}`);
		assert(state.videoDisabled === false && state.videoValue !== "none", "Gemma multimodal capture was not enabled.");
		console.log("GEMMA_COHOST_LIVE_RESULT:", JSON.stringify({ readyMs, ...state }));
		console.log("PASS live Local Gemma cohost Chrome test");
	} finally {
		if (browser) await browser.close().catch(() => {});
		server.close();
	}
})().catch(error => {
	console.error(error?.stack || error);
	process.exit(1);
});
