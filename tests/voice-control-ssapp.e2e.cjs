// Isolated SSApp runtime; fictional messages through a private relay, no live channels.
const { _electron } = require("playwright");
const fs = require("fs"),
	path = require("path"),
	os = require("os"),
	assert = require("assert");
const root = path.resolve(__dirname, ".."),
	ssapp = process.env.SSAPP_REPO || path.resolve(root, "../ssapp");
const packaged = process.env.SSAPP_TEST_APP;
const output = fs.mkdtempSync(path.join(os.tmpdir(), "ssn-voice-qa-"));
let obsProcess = null,
	obsBrowser = null;
const delay = ms => new Promise(r => setTimeout(r, ms));
(async () => {
	const wrapper = path.join(output, "bootstrap.cjs");
	fs.writeFileSync(path.join(output, "savedSync.json"), JSON.stringify({ streamID: "artqa" + Date.now(), password: "false", state: false, settings: {}, wsServer: false }));
	fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:new URL(d.url).hostname!=='127.0.0.1'})));require(${JSON.stringify(path.join(ssapp, "bootstrap.js"))});`);
	const app = await _electron.launch({ executablePath: packaged || path.join(ssapp, "node_modules/electron/dist/electron.exe"), args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + path.join(ssapp, "tests/electron/fixtures/cohost-stt.wav"), ...(packaged ? [] : [wrapper, "--running-from-source", "--filesource", "file:///" + root.replace(/\\/g, "/") + "/"]), "--multiinstance", "--no-hwa"], cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: output, SSAPP_PREFER_LOCAL_ASSETS: packaged ? "1" : "0", SSAPP_DIAGNOSTICS_SAFE_GPU: "1", SSAPP_STT_MODEL_CACHE_DIR: path.join(ssapp, ".codex-tmp/whisper-cache") } });
	try {
		await app.evaluate(({ app, BrowserWindow }) => {
			const block = session => session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => callback({ cancel: new URL(details.url).hostname !== "127.0.0.1" }));
			BrowserWindow.getAllWindows().forEach(win => block(win.webContents.session));
			app.on("session-created", block);
		});
		const main = await app.firstWindow();
		main.setDefaultTimeout(20000);
		await main.waitForFunction(() => document.querySelector("#frame2"));
		await main.waitForFunction(() => {
			const f = document.getElementById("frame2");
			return f && f.src && f.src.includes("background");
		});
		await delay(1500);
		const bg = main.frames().find(f => f.url().includes("background.html"));
		assert(bg);
		await bg.waitForFunction(() => window.eventFlowSystem);
		await bg.evaluate(async () => {
			window.__voiceHits = 0;
			window.eventFlowSystem.allowEvalCustomJs = true;
			await window.eventFlowSystem.saveFlow({
				id: "voice-test",
				name: "Voice fixture",
				active: true,
				nodes: [
					{ id: "voice-trigger", type: "trigger", triggerType: "voicePhrase", x: 80, y: 90, config: { phrase: "cobalt lantern 7", cooldown: 300 } },
					{ id: "voice-action", type: "action", actionType: "customJs", x: 390, y: 90, config: { code: "window.__voiceHits++; return result;" } }
				],
				connections: [{ from: "voice-trigger", to: "voice-action" }]
			});
		});
		await main.locator('[data-page="event-flow-editor"]').click();
		await bg.waitForFunction(() => window.flowEditor);
		await bg.evaluate(async () => {
			document.getElementById("editor").style.display = "block";
			await window.flowEditor.loadFlow("voice-test");
			window.flowEditor.selectNode("voice-trigger");
		});
		await bg.locator("#prop-phrase").fill("cobalt lantern 7");
		await bg.locator("#prop-phrase").dispatchEvent("change");
		await bg.evaluate(() => window.flowEditor.saveCurrentFlow());
		assert.equal(await bg.locator("#prop-phrase").inputValue(), "cobalt lantern 7");
		await main.screenshot({ path: path.join(output, "voice-editor.png") });
		const created = app.waitForEvent("window");
		await bg.locator('a[href="voice-control.html"]').click();
		const page = await created;
		await app.evaluate(({ BrowserWindow }) => {
			const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes("voice-control.html"));
			if (win) {
				win.webContents.setBackgroundThrottling(false);
				win.setSize(650, 900);
				win.show();
			}
		});
		page.setDefaultTimeout(15000);
		const errors = [];
		page.on("pageerror", e => errors.push(e.message));
		await page.waitForFunction(() => document.getElementById("commands").textContent.startsWith("1 active"));
		assert(
			await page.evaluate(async () => {
				try {
					await window.ninjafy.syncVoiceCommands([]);
					return false;
				} catch (_) {
					return true;
				}
			}),
			"Control UI cannot impersonate Event Flow"
		);
		await page.locator("#devices").click();
		await page.waitForFunction(() => document.querySelectorAll("#microphone option").length > 1);
		await page.locator("#start").click();
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening", {}, { timeout: 90000 });
		if (process.argv.includes("--crash-only")) {
			await page.evaluate(() => window.ninjafy.voiceControl("stop"));
			await page.evaluate(() => window.ninjafy.voiceControl("start", { deviceId: "missing-voice-test-device" }));
			await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
			await page.evaluate(() => window.ninjafy.voiceControl("start"));
			await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
			await page.evaluate(() => window.ninjafy.voiceControl("arm", { armed: true }));
			await app.evaluate(({ BrowserWindow }) => {
				const capture = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith("/voice-capture.html"));
				global.qaCrash = { listeners: capture.webContents.listenerCount("render-process-gone"), started: Date.now() };
				capture.webContents.once("render-process-gone", (_e, d) => {
					global.qaCrash.gone = { details: d, at: Date.now() };
				});
				capture.webContents.forcefullyCrashRenderer();
			});
			await delay(5000);
			console.log("Crash diagnostic", await app.evaluate(() => global.qaCrash), await page.evaluate(() => window.ninjafy.voiceControl("status")));
			await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
			assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false);
			console.log("PASS isolated microphone renderer crash");
			return;
		}
		await page.waitForFunction(() => document.getElementById("match").textContent.includes("cobalt lantern 7"), {}, { timeout: 45000 });
		assert.equal(await bg.evaluate(() => window.__voiceHits), 0, "Test mode never runs actions");
		await page.screenshot({ path: path.join(output, "voice-test.png"), fullPage: true });
		await page.locator("#arm").check();
		await bg.waitForFunction(() => window.__voiceHits === 1, {}, { timeout: 45000 });
		await bg.evaluate(() => window.eventFlowSystem.processMessage({ type: "hostvoice", chatname: "Host", chatmessage: "cobalt lantern 7", textonly: true, event: "voicePhrase" }));
		assert.equal(await bg.evaluate(() => window.__voiceHits), 1, "Chat cannot forge microphone authority");
		await page.locator("#dock").click();
		await page.waitForFunction(() => !document.getElementById("dock-link").hidden);
		const link = await page.locator("#dock-link").inputValue();
		const dockCreated = app.waitForEvent("window");
		await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, width: 400, height: 900, webPreferences: { contextIsolation: true } }).loadURL(url), link);
		const dock = await dockCreated;
		await dock.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		await dock.reload();
		await dock.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		if (process.argv.includes("--obs")) {
			const net = require("net");
			const debugPort = await new Promise(resolve => {
				const server = net.createServer();
				server.listen(0, "127.0.0.1", () => {
					const port = server.address().port;
					server.close(() => resolve(port));
				});
			});
			const obsRoot = path.join(output, "obs");
			fs.cpSync("C:/Program Files/obs-studio", obsRoot, { recursive: true });
			const config = path.join(obsRoot, "config/obs-studio");
			fs.mkdirSync(path.join(config, "basic/profiles/Voice_QA"), { recursive: true });
			fs.mkdirSync(path.join(config, "basic/scenes"), { recursive: true });
			const ini = "[General]\nFirstRun=false\nEnableAutoUpdates=false\n[Basic]\nProfile=Voice_QA\nProfileDir=Voice_QA\nSceneCollection=Voice_QA\nSceneCollectionFile=Voice_QA\n[BasicWindow]\nExtraBrowserDocks=" + JSON.stringify([{ title: "Voice Control QA", url: link, uuid: "voiceqa" }]) + "\n";
			fs.writeFileSync(path.join(config, "global.ini"), ini);
			fs.writeFileSync(path.join(config, "user.ini"), ini);
			fs.writeFileSync(path.join(config, "basic/profiles/Voice_QA/basic.ini"), "[General]\nName=Voice_QA\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSType=0\nFPSCommon=30\n");
			fs.writeFileSync(path.join(config, "basic/scenes/Voice_QA.json"), JSON.stringify({ name: "Voice_QA", current_scene: "Voice QA", current_program_scene: "Voice QA", scene_order: [{ name: "Voice QA" }], sources: [{ name: "Voice QA", id: "scene", settings: { items: [] } }] }));
			obsProcess = require("child_process").spawn(path.join(obsRoot, "bin/64bit/obs64.exe"), ["--portable", "--multi", "--minimize-to-tray", "--disable-updater", "--remote-debugging-port=" + debugPort, "--remote-allow-origins=http://127.0.0.1:" + debugPort], { cwd: path.join(obsRoot, "bin/64bit"), windowsHide: true, stdio: "ignore" });
			let target;
			for (let n = 0; n < 40; n++) {
				try {
					const targets = await (await fetch("http://127.0.0.1:" + debugPort + "/json/list")).json();
					target = targets.find(p => p.url.startsWith(new URL(link).origin));
					if (target) break;
				} catch (_) {}
				await delay(500);
			}
			assert(target, "Actual OBS custom dock loaded");
			const WebSocket = require(path.join(ssapp, "node_modules/ws")),
				socket = new WebSocket(target.webSocketDebuggerUrl);
			await new Promise((resolve, reject) => {
				socket.once("open", resolve);
				socket.once("error", reject);
			});
			let requestId = 0;
			const pending = new Map();
			socket.on("message", raw => {
				const response = JSON.parse(raw);
				if (pending.has(response.id)) {
					const entry = pending.get(response.id);
					pending.delete(response.id);
					response.error ? entry.reject(Error(response.error.message)) : entry.resolve(response.result);
				}
			});
			const cdp = (method, params = {}) =>
				new Promise((resolve, reject) => {
					const id = ++requestId;
					pending.set(id, { resolve, reject });
					socket.send(JSON.stringify({ id, method, params }));
				});
			obsBrowser = { close: async () => socket.close() };
			const evaluate = async expression => (await cdp("Runtime.evaluate", { expression, returnByValue: true })).result.value;
			const waitListening = async () => {
				for (let i = 0; i < 40; i++) {
					if (await evaluate("document.getElementById('phase')?.textContent==='Listening'")) return;
					await delay(250);
				}
				throw Error("OBS dock did not connect");
			};
			await waitListening();
			await cdp("Page.reload");
			await delay(500);
			await waitListening();
			const shot = await cdp("Page.captureScreenshot", { format: "png" });
			fs.writeFileSync(path.join(output, "voice-actual-obs.png"), Buffer.from(shot.data, "base64"));
			await evaluate("document.getElementById('stop').click()");
			await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
			console.log("PASS actual OBS custom dock, session pairing across reload, and stopping SSApp listener");
		}
		await dock.screenshot({ path: path.join(output, "voice-dock.png") });
		if (await dock.locator("#stop").isEnabled()) await dock.locator("#stop").click();
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
		await delay(2500);
		assert.equal(await bg.evaluate(() => window.__voiceHits), 1);

		// Multiple controls must not multiply microphone capture or command execution.
		const thirdCreated = app.waitForEvent("window");
		await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } }).loadURL(url), link);
		const third = await thirdCreated;
		await third.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
		const starts = await Promise.all([
			page.evaluate(() =>
				window.ninjafy.voiceControl("start").then(
					() => true,
					() => false
				)
			),
			...[dock, third].map(p =>
				p.evaluate(async () => {
					const r = await fetch("/control", { method: "POST", headers: { "Content-Type": "application/json", "X-SSN-Voice": sessionStorage.getItem("ssn-voice-pair") }, body: JSON.stringify({ action: "start" }) });
					return !(await r.json()).error;
				})
			)
		]);
		assert.equal(starts.filter(Boolean).length, 1, "Only one concurrent Start succeeds");
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().endsWith("/voice-capture.html")).length), 1);
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false);
		await page.locator("#arm").check();
		await bg.waitForFunction(() => window.__voiceHits === 2, {}, { timeout: 45000 });
		await delay(6000);
		assert.equal(await bg.evaluate(() => window.__voiceHits), 2, "Three controls do not duplicate the command");
		if (process.argv.includes("--multi-audio")) {
			const cohosts = [];
			for (let i = 0; i < 2; i++) {
				const created = app.waitForEvent("window");
				const url = new URL("cohost.html?session=voice-concurrency-" + i, bg.url()).href;
				await main.evaluate(url => ipcRenderer.sendSync("createWindow", { url, visible: false }), url);
				const cohost = await created;
				await cohost.waitForFunction(() => typeof DesktopWhisperRecognition === "function");
				await cohost.evaluate(async () => {
					window.qaResults = [];
					window.qaErrors = [];
					window.qaInput = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
					window.qaRecognition = new DesktopWhisperRecognition(window.qaInput, await window.ninjafy.getSttCapabilities());
					window.qaRecognition.onresult = e => window.qaResults.push(e.results[0][0].transcript);
					window.qaRecognition.onerror = e => window.qaErrors.push(e.message);
					window.qaRecognition.start();
				});
				cohosts.push(cohost);
				await cohost.waitForFunction(() => qaResults.some(t => /cobalt.*lantern/i.test(t)), {}, { timeout: 90000 });
				console.log("PASS " + (i + 2) + " independent audio captures including Voice Control");
			}
			await delay(20000);
			for (const cohost of cohosts) {
				assert.deepEqual(await cohost.evaluate(() => qaErrors), []);
				assert(await cohost.evaluate(() => qaRecognition.capturing && qaResults.length >= 2));
			}
			const diagnostics = await cohosts[1].evaluate(() => window.ninjafy.getSttDiagnostics());
			assert.equal(diagnostics.workerCreateCount, 1, "Cohost streams reuse one ONNX worker");
			assert(diagnostics.queueLength <= 2, "No unbounded backlog with three audio streams");
			await cohosts[0].close();
			const before = await cohosts[1].evaluate(() => qaResults.length);
			await cohosts[1].waitForFunction(n => qaResults.length > n, before, { timeout: 45000 });
			await cohosts[1].close();
			await page.waitForFunction(() => document.getElementById("match").textContent.includes("cobalt lantern 7"), {}, { timeout: 30000 });
			assert.equal(await bg.evaluate(() => window.__voiceHits), 2, "Other microphones cannot emit host commands");
			console.log("PASS three streams, bounded queue, closing one preserves the others, no duplicate commands");
		}
		await third.locator("#stop").click();
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
		await third.close();
		console.log("PASS three control windows share one microphone and Stop");

		// Delay only this isolated renderer's permission path to reproduce a queued Start.
		await app.evaluate(async ({ BrowserWindow }) => {
			const capture = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith("/voice-capture.html"));
			await capture.webContents.executeJavaScript("window.qaGetMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async function(c){await new Promise(r=>setTimeout(r,800));return window.qaGetMedia(c);};void 0");
		});
		const cancelled = await page.evaluate(async () => {
			const devices = window.ninjafy.voiceControl("devices");
			await new Promise(r => setTimeout(r, 100));
			const start = window.ninjafy.voiceControl("start").then(
				() => false,
				e => e.message.includes("Cancelled by Stop")
			);
			await window.ninjafy.voiceControl("stop");
			await devices;
			return await start;
		});
		assert(cancelled, "Stop must cancel an already queued Start");
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).phase, "stopped");
		await app.evaluate(async ({ BrowserWindow }) => {
			const capture = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith("/voice-capture.html"));
			await capture.webContents.executeJavaScript("navigator.mediaDevices.getUserMedia=window.qaGetMedia;void 0");
		});
		const denied = await fetch(new URL("/control", link), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
		assert.equal(denied.status, 403);
		const invalid = await fetch(new URL("/control", link), { method: "POST", headers: { "Content-Type": "application/json", "X-SSN-Voice": new URL(link).hash.slice(1) }, body: "null" });
		assert.equal(invalid.status, 400);
		await page.evaluate(() => window.ninjafy.voiceControl("start", { deviceId: "missing-voice-test-device" }));
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false);

		await page.evaluate(() => window.ninjafy.voiceControl("start"));
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		await page.locator("#arm").check();
		await app.evaluate(({ BrowserWindow }) => {
			const capture = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith("/voice-capture.html"));
			global.qaCrash = { listeners: capture.webContents.listenerCount("render-process-gone"), started: Date.now() };
			capture.webContents.once("render-process-gone", (_event, details) => {
				global.qaCrash.gone = { details, at: Date.now() };
			});
			capture.webContents.forcefullyCrashRenderer();
		});
		try {
			await page.waitForFunction(() => document.getElementById("phase").textContent === "Stopped");
		} catch (error) {
			console.log("Crash diagnostic", await page.evaluate(async () => ({ ui: document.getElementById("phase").textContent, status: await window.ninjafy.voiceControl("status") })), await app.evaluate(({ BrowserWindow }) => ({ crash: global.qaCrash, windows: BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL(), pid: w.webContents.getOSProcessId(), crashed: w.webContents.isCrashed() })) })));
			throw error;
		}
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false, "Renderer crash disarms");
		await delay(2500);
		await page.evaluate(() => window.ninjafy.voiceControl("start"));
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening");
		assert.equal((await page.evaluate(() => window.ninjafy.voiceControl("status"))).armed, false, "Restart returns to Test mode");
		await page.locator("#stop").click();
		await page.locator("#revoke").click();
		await dock.waitForFunction(() => document.getElementById("phase").textContent === "Disconnected");
		assert.deepEqual(errors, []);
		console.log("PASS real Whisper, Test/Armed, native Event Flow action, forged-chat rejection, shared dock, reload, stop and pairing restrictions");
		console.log("Screenshots: " + output);
	} finally {
		if (obsBrowser) await obsBrowser.close();
		if (obsProcess) obsProcess.kill();
		await app.close();
	}
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
