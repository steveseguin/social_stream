// The Windows portable extractor does not relay Electron's inspector to Playwright.
// Attach to the actual extracted app's Chromium endpoint instead.
const fs = require("fs"),
	path = require("path"),
	os = require("os"),
	assert = require("assert"),
	cp = require("child_process");
const { chromium } = require("playwright");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
	assert(process.env.SSAPP_TEST_PORTABLE, "Set SSAPP_TEST_PORTABLE to the local preview executable");
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ssn-voice-portable-"));
	const ssapp = path.resolve(__dirname, "../../ssapp");
	fs.writeFileSync(path.join(profile, "savedSync.json"), JSON.stringify({ streamID: "voiceportable" + Date.now(), password: "false", state: false, settings: {}, wsServer: false }));
	const child = cp.spawn(process.env.SSAPP_TEST_PORTABLE, ["--multiinstance", "--no-hwa", "--remote-debugging-port=0", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + path.join(ssapp, "tests/electron/fixtures/cohost-stt.wav")], { windowsHide: true, stdio: "ignore", env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_PREFER_LOCAL_ASSETS: "1", SSAPP_DIAGNOSTICS_SAFE_GPU: "1" } });
	let browser, main;
	try {
		const portFile = path.join(profile, "DevToolsActivePort");
		for (let n = 0; n < 240 && !fs.existsSync(portFile); n++) {
			assert.equal(child.exitCode, null, "Portable stayed running");
			await delay(500);
		}
		const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
		browser = await chromium.connectOverCDP("http://127.0.0.1:" + port);
		const context = browser.contexts()[0];
		await context.route(/^(https?|wss?):/, route => (new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort()));
		main = context.pages()[0] || (await context.waitForEvent("page"));
		await main.waitForFunction(() => document.getElementById("frame2")?.src.includes("background"));
		let bg;
		for (let n = 0; n < 150 && !bg; n++) {
			bg = main.frames().find(f => f.url().includes("background.html"));
			if (!bg) await delay(200);
		}
		assert(bg, "Bundled background frame loaded");
		await bg.waitForFunction(() => window.eventFlowSystem);
		await bg.evaluate(async () => {
			window.qaPortableHits = 0;
			window.eventFlowSystem.allowEvalCustomJs = true;
			await window.eventFlowSystem.saveFlow({
				id: "portable-voice",
				name: "Portable voice",
				active: true,
				nodes: [
					{ id: "trigger", type: "trigger", triggerType: "voicePhrase", config: { phrase: "cobalt lantern 7", cooldown: 300 } },
					{ id: "action", type: "action", actionType: "customJs", config: { code: "window.qaPortableHits++;return result;" } }
				],
				connections: [{ from: "trigger", to: "action" }]
			});
		});
		const created = context.waitForEvent("page");
		created.catch(() => {});
		await main.locator('[data-page="event-flow-editor"]').click();
		await bg.waitForFunction(() => window.flowEditor);
		await bg.evaluate(async () => {
			document.getElementById("editor").style.display = "block";
			await window.flowEditor.loadFlow("portable-voice");
			window.flowEditor.selectNode("trigger");
		});
		await bg.locator('a[href="voice-control.html"]').click();
		const page = await created;
		page.setDefaultTimeout(45000);
		assert(await page.evaluate(() => window.innerWidth >= 400), "Voice Control opens at a usable default width");
		await page.waitForFunction(() => window.ninjafy && window.ninjafy.voiceControl);
		await page.waitForFunction(() => document.getElementById("commands").textContent.startsWith("1 active"));
		await page.evaluate(() => window.ninjafy.voiceControl("start"));
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		await page.waitForFunction(() => document.getElementById("match").textContent.includes("cobalt lantern 7"));
		assert.equal(await bg.evaluate(() => window.qaPortableHits), 0);
		await page.evaluate(() => window.ninjafy.voiceControl("arm", { armed: true }));
		await bg.waitForFunction(() => window.qaPortableHits === 1, {}, { timeout: 45000 });
		await page.screenshot({ path: path.join(profile, "portable-voice.png"), fullPage: true });
		await page.evaluate(() => window.ninjafy.voiceControl("stop"));
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false);
		await page.evaluate(() => window.ninjafy.voiceControl("start"));
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false);
		await page.evaluate(() => window.ninjafy.voiceControl("stop"));
		console.log("PASS actual portable: bundled controls, real recorded microphone, Test/Armed, Event Flow action, Stop and restart disarmed");
		console.log("Evidence: " + profile);
	} finally {
		if (browser) {
			const cdp = await browser.newBrowserCDPSession().catch(() => null);
			if (cdp) await cdp.send("Browser.close").catch(() => {});
			await browser.close();
		}
		for (let n = 0; n < 20 && child.exitCode === null; n++) await delay(250);
		if (child.exitCode === null) child.kill();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
