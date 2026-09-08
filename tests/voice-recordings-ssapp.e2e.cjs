// Isolated SSApp runtime; fictional messages through a private relay, no live channels.
const { _electron } = require("playwright");
const fs = require("fs"),
	path = require("path"),
	os = require("os"),
	assert = require("assert");
const root = path.resolve(__dirname, ".."),
	ssapp = process.env.SSAPP_REPO || path.resolve(root, "../ssapp");
const packaged = process.env.SSAPP_TEST_APP;
const output = fs.mkdtempSync(path.join(os.tmpdir(), "ssn-voice-recordings-"));
let obsProcess = null,
	obsBrowser = null,
	playbackTimer = null;
const corpus = process.env.SSAPP_VOICE_CORPUS || path.join(os.tmpdir(), "ssn-voice-corpus");
const timeline = JSON.parse(fs.readFileSync(path.join(corpus, "timeline.json"), "utf8"));
const phrases = [...new Set(timeline.items.filter(item => item.expected).map(item => item.expected))];
const delay = ms => new Promise(r => setTimeout(r, ms));
(async () => {
	const wrapper = path.join(output, "bootstrap.cjs");
	fs.writeFileSync(path.join(output, "savedSync.json"), JSON.stringify({ streamID: "artqa" + Date.now(), password: "false", state: false, settings: {}, wsServer: false }));
	fs.writeFileSync(wrapper, `const {app,ipcMain}=require('electron');global.voiceQA={audio:[],ignored:[],ready:0};const handlers={};let controlEvent;const originalHandle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(name,fn)=>{handlers[name]=fn;originalHandle(name,async(event,...args)=>{const before=Date.now();const result=await fn(event,...args);if(name==='voice:control')controlEvent=event;if(name==='voice:capture'&&args[0]==='long-speech')global.voiceQA.ignored.push(before);if(name==='voice:capture'&&args[0]==='ready')global.voiceQA.ready=before;if(name==='voice:capture'&&args[0]==='audio'){const state=controlEvent?await handlers['voice:control'](controlEvent,'status'):{};global.voiceQA.audio.push({received:before,finished:Date.now(),trailing:args[1].trailingMs,bytes:args[1].audio.byteLength,text:state.heard,message:state.message});}return result;});};app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:new URL(d.url).hostname!=='127.0.0.1'})));require(${JSON.stringify(path.join(ssapp, "bootstrap.js"))});`);
	const app = await _electron.launch({ executablePath: packaged || path.join(ssapp, "node_modules/electron/dist/electron.exe"), args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + path.join(corpus, "corpus.wav"), ...(packaged ? [] : [wrapper, "--running-from-source", "--filesource", "file:///" + root.replace(/\\/g, "/") + "/"]), "--multiinstance", "--no-hwa"], cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: output, SSAPP_PREFER_LOCAL_ASSETS: packaged ? "1" : "0", SSAPP_DIAGNOSTICS_SAFE_GPU: "1", SSAPP_STT_MODEL_CACHE_DIR: path.join(ssapp, ".codex-tmp/whisper-cache") } });

	try {
		const main = await app.firstWindow();
		await main.waitForFunction(() => document.getElementById("frame2")?.src.includes("background"));
		await delay(1500);
		const bg = main.frames().find(f => f.url().includes("background.html"));
		await bg.waitForFunction(() => window.eventFlowSystem);
		if (packaged)
			await app.evaluate(({ app, ipcMain, BrowserWindow }) => {
				const block = s => s.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (d, cb) => cb({ cancel: new URL(d.url).hostname !== "127.0.0.1" }));
				BrowserWindow.getAllWindows().forEach(w => block(w.webContents.session));
				app.on("session-created", block);
				global.voiceQA = { audio: [], ignored: [], ready: 0 };
				let controlEvent;
				const control = ipcMain._invokeHandlers.get("voice:control"),
					capture = ipcMain._invokeHandlers.get("voice:capture");
				if (!control || !capture) throw Error("Packaged voice handlers are unavailable");
				ipcMain.removeHandler("voice:control");
				ipcMain.removeHandler("voice:capture");
				ipcMain.handle("voice:control", async (event, ...args) => {
					controlEvent = event;
					return control(event, ...args);
				});
				ipcMain.handle("voice:capture", async (event, kind, data) => {
					const before = Date.now();
					const result = await capture(event, kind, data);
					if (kind === "ready") global.voiceQA.ready = before;
					if (kind === "long-speech") global.voiceQA.ignored.push(before);
					if (kind === "audio") {
						const state = controlEvent ? await control(controlEvent, "status") : {};
						global.voiceQA.audio.push({ received: before, finished: Date.now(), trailing: data.trailingMs, bytes: data.audio.byteLength, text: state.heard, message: state.message });
					}
					return result;
				});
			});
		await bg.evaluate(async phrases => {
			window.__voiceEvents = [];
			window.eventFlowSystem.allowEvalCustomJs = true;
			for (const [i, phrase] of phrases.entries())
				await window.eventFlowSystem.saveFlow({
					id: "corpus-" + i,
					name: phrase,
					active: true,
					nodes: [
						{ id: "trigger", type: "trigger", triggerType: "voicePhrase", config: { phrase, cooldown: 1 } },
						{ id: "action", type: "action", actionType: "customJs", config: { code: "window.__voiceEvents.push({text:message.chatmessage,at:Date.now()});return result;" } }
					],
					connections: [{ from: "trigger", to: "action" }]
				});
		}, phrases);
		const created = app.waitForEvent("window");
		if (packaged) {
			const url = (await main.evaluate(() => window.ssappFallback.resolveUrl("voice-control.html", { branch: "main" }))).url;
			await main.evaluate(url => ipcRenderer.sendSync("createWindow", { url, visible: false }), url);
		} else await app.evaluate(({ BrowserWindow }, args) => new BrowserWindow({ show: false, width: 620, height: 820, webPreferences: { preload: args.preload, contextIsolation: true, backgroundThrottling: false } }).loadURL(args.url), { preload: path.join(ssapp, "preload.js"), url: require("url").pathToFileURL(path.join(root, "voice-control.html")).href });
		const page = await created;
		await page.waitForFunction(count => document.getElementById("commands").textContent.startsWith(count + " active"), phrases.length);
		await page.locator("#dock").click();
		await page.waitForFunction(() => !document.getElementById("dock-link").hidden);
		const link = await page.locator("#dock-link").inputValue();
		let gameCDP, gameEvaluate;
		if (!process.argv.includes("--no-obs")) {
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
			fs.writeFileSync(path.join(config, "basic/profiles/Voice_QA/basic.ini"), "[General]\nName=Voice_QA\n[Video]\nBaseCX=1920\nBaseCY=1080\nOutputCX=1920\nOutputCY=1080\nFPSType=0\nFPSCommon=60\n");
			fs.writeFileSync(
				path.join(config, "basic/scenes/Voice_QA.json"),
				JSON.stringify({
					name: "Voice_QA",
					current_scene: "Voice QA",
					current_program_scene: "Voice QA",
					scene_order: [{ name: "Voice QA" }],
					sources: [
						{ name: "Maze workload", id: "browser_source", settings: { is_local_file: true, local_file: path.join(root, "games/mazeraid.html"), width: 1920, height: 1080, fps: 60, shutdown: false } },
						{ name: "Voice QA", id: "scene", settings: { items: [{ id: 1, name: "Maze workload", visible: true, pos: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }] } }
					]
				})
			);
			obsProcess = require("child_process").spawn(path.join(obsRoot, "bin/64bit/obs64.exe"), ["--portable", "--multi", "--minimize-to-tray", "--disable-updater", "--remote-debugging-port=" + debugPort, "--remote-allow-origins=http://127.0.0.1:" + debugPort], { cwd: path.join(obsRoot, "bin/64bit"), windowsHide: true, stdio: "ignore" });
			let target;
			for (let n = 0; n < 40; n++) {
				try {
					const targets = await (await fetch("http://127.0.0.1:" + debugPort + "/json/list")).json();
					target = targets.find(p => p.url.includes("mazeraid.html"));
					if (target) break;
				} catch (_) {}
				await delay(500);
			}
			assert(target, "Actual OBS Maze Raid browser source loaded");
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
			const evaluate = async expression => {
				const response = await cdp("Runtime.evaluate", { expression, returnByValue: true });
				if (response.exceptionDetails) throw Error("OBS evaluation failed: " + expression);
				return response.result.value;
			};
			for (let n = 0; n < 180 && !(await evaluate('document.readyState === "complete"')); n++) await delay(250);
			assert.equal(await evaluate("document.readyState"), "complete", "OBS document finished loading before frame sampling");

			gameCDP = cdp;
			gameEvaluate = evaluate;
			await evaluate("window.qaFrames=[];window.qaLast=performance.now();function qaFrame(t){window.qaFrames.push(t-window.qaLast);window.qaLast=t;requestAnimationFrame(qaFrame)}requestAnimationFrame(qaFrame)");
		}

		console.log("Recording test output: " + output);
		console.log("Measuring 20-second OBS baseline");
		await delay(20000);
		const baseline = gameEvaluate ? await gameEvaluate("window.qaFrames.splice(0)") : [];
		if (gameEvaluate) assert(baseline.length > 100, "OBS frame sampler collected its baseline");
		await page.locator("#start").click();
		await page.waitForFunction(() => document.getElementById("phase").textContent === "Listening", {}, { timeout: 90000 });
		await page.locator("#arm").check();
		const started = await app.evaluate(() => global.voiceQA.ready);
		if (timeline.items.some(item => item.condition === "managed-tts")) {
			let wasPlaying = false;
			playbackTimer = setInterval(() => {
				const time = (Date.now() - started) / 1000;
				const playing = timeline.items.some(item => item.condition === "managed-tts" && time >= item.start - 0.5 && time <= item.end + 0.2);
				if (playing || wasPlaying) bg.evaluate(active => window.ninjafy.voicePlayback(active), playing).catch(() => {});
				wasPlaying = playing;
			}, 250);
		}

		const metrics = [];
		while (Date.now() - started < (timeline.duration + 2) * 1000) {
			await delay(1000);
			metrics.push({ at: Date.now(), processes: await app.evaluate(({ app }) => app.getAppMetrics().map(p => ({ pid: p.pid, type: p.type, cpu: p.cpu.percentCPUUsage, memory: p.memory.workingSetSize }))) });
			if (metrics.length % 30 === 0) console.log("Audio " + Math.round((Date.now() - started) / 1000) + "/" + Math.round(timeline.duration) + "s; actions " + (await bg.evaluate(() => window.__voiceEvents.length)));
		}
		await page.locator("#stop").click();
		const events = await bg.evaluate(() => window.__voiceEvents),
			qa = await app.evaluate(() => global.voiceQA);
		const frames = gameEvaluate ? await gameEvaluate("window.qaFrames.splice(0)") : [];
		if (gameCDP) {
			const shot = await gameCDP("Page.captureScreenshot", { format: "png" });
			fs.writeFileSync(path.join(output, "obs-maze-workload.png"), Buffer.from(shot.data, "base64"));
		}
		const normalized = s =>
			s
				.toLowerCase()
				.replace(/[.,!?;:]/g, "")
				.replace(/\s+/g, " ")
				.trim();
		const rows = timeline.items.map(item => {
			const hits = events.filter(e => e.at >= started + item.start * 1000 && e.at <= started + (item.end + 2.5) * 1000);
			return { ...item, hits: hits.map(h => ({ text: h.text, latencyMs: h.at - started - item.end * 1000 })), passed: item.expected ? hits.length === 1 && normalized(hits[0].text) === item.expected : hits.length === 0 };
		});
		const percentile = (values, p) => (values.length ? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] : null);
		const summary = {
			machine: { cpu: os.cpus()[0].model, logicalCores: os.cpus().length, ramGB: Math.round(os.totalmem() / 1073741824) },
			duration: timeline.duration,
			positive: { passed: rows.filter(r => r.expected && r.passed).length, total: rows.filter(r => r.expected).length },
			negative: { passed: rows.filter(r => !r.expected && r.passed).length, total: rows.filter(r => !r.expected).length },
			latencyP95: percentile(
				rows.filter(r => r.expected && r.passed).flatMap(r => r.hits.map(h => h.latencyMs)),
				0.95
			),
			obsAnimationFrames: { baselineP95: percentile(baseline.slice(5), 0.95), listeningP95: percentile(frames.slice(5), 0.95) },
			failures: rows.filter(r => !r.passed),
			unexpectedEvents: events.filter(e => !timeline.items.some(item => e.at >= started + item.start * 1000 && e.at <= started + (item.end + 2.5) * 1000))
		};
		fs.writeFileSync(path.join(output, "report.json"), JSON.stringify({ summary, rows, qa, events, metrics }, null, 2));
		console.log(JSON.stringify(summary, null, 2));
		await page.screenshot({ path: path.join(output, "voice-recordings.png"), fullPage: true });
		console.log("Report: " + path.join(output, "report.json"));
	} finally {
		if (playbackTimer) clearInterval(playbackTimer);
		if (obsBrowser) await obsBrowser.close();
		if (obsProcess) obsProcess.kill();
		await app.close();
	}
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
