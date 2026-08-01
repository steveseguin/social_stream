"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const ssappRoot = path.resolve(repoRoot, "..", "ssapp");
const electronPath = require(path.join(ssappRoot, "node_modules", "electron"));
const WebSocket = require(path.join(ssappRoot, "node_modules", "ws"));
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "ssapp-private-bot-e2e-"));

function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const port = server.address().port;
			server.close(() => resolve(port));
		});
	});
}

function closeServer(server) {
	return new Promise(resolve => {
		if (!server) {
			resolve();
			return;
		}
		server.close(() => resolve());
	});
}

async function createMockLlmServer() {
	const requests = [];
	const server = http.createServer((request, response) => {
		if (request.method === "OPTIONS") {
			response.writeHead(204, {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "authorization,content-type",
				"Access-Control-Allow-Methods": "POST,OPTIONS"
			});
			response.end();
			return;
		}

		let body = "";
		request.setEncoding("utf8");
		request.on("data", chunk => {
			body += chunk;
		});
		request.on("end", () => {
			let parsed = {};
			try {
				parsed = body ? JSON.parse(body) : {};
			} catch (_) {}
			const serialized = JSON.stringify(parsed);
			const markerMatch = serialized.match(/(IPC_E2E|NEGATIVE_E2E|P2P_E2E|WS_E2E|LEGACY_E2E)/);
			const marker = markerMatch ? markerMatch[1] : "PRIVATE_E2E";
			requests.push({ marker, url: request.url, body: parsed });
			const sendResponse = () => {
				response.writeHead(200, {
					"Access-Control-Allow-Origin": "*",
					"Content-Type": "application/json; charset=utf-8"
				});
				response.end(JSON.stringify({
					choices: [{
						message: {
							content: marker === "NEGATIVE_E2E" ? "No, this is a direct private answer." : `${marker}_REPLY`
						}
					}]
				}));
			};
			sendResponse();
		});
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	return {
		server,
		requests,
		baseUrl: `http://127.0.0.1:${server.address().port}`
	};
}

async function createDockRelayServer() {
	const messages = [];
	const server = new WebSocket.Server({ host: "127.0.0.1", port: 0 });
	await new Promise((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});
	server.on("connection", (socket, request) => {
		socket.route = request.url || "/";
		socket.relay = null;
		socket.on("message", raw => {
			const text = raw.toString();
			let data = null;
			try {
				data = JSON.parse(text);
			} catch (_) {
				return;
			}
			if (data && data.join) {
				socket.relay = {
					room: String(data.join),
					out: Number(data.out),
					in: Number(data.in)
				};
				return;
			}
			messages.push({ route: socket.route, data });
			if (!socket.relay) return;
			for (const peer of server.clients) {
				if (peer === socket || peer.readyState !== WebSocket.OPEN || !peer.relay) continue;
				if (peer.relay.room !== socket.relay.room || peer.relay.in !== socket.relay.out) continue;
				peer.send(text);
			}
		});
	});
	return {
		server,
		messages,
		baseUrl: `ws://127.0.0.1:${server.address().port}`
	};
}

function canReachDebugger(port) {
	return new Promise(resolve => {
		const request = http.get(`http://127.0.0.1:${port}/json/version`, response => {
			response.resume();
			resolve(response.statusCode === 200);
		});
		request.setTimeout(750, () => request.destroy());
		request.on("error", () => resolve(false));
	});
}

async function waitForDebugger(port, child) {
	const started = Date.now();
	while (Date.now() - started < 60000) {
		if (child.exitCode !== null) {
			throw new Error(`SSApp exited before its debugger was ready (code ${child.exitCode}).`);
		}
		if (await canReachDebugger(port)) return;
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error("Timed out waiting for the SSApp debugger.");
}

async function waitForMainPage(context) {
	const started = Date.now();
	while (Date.now() - started < 60000) {
		const page = context.pages().find(candidate => /\/index\.html(?:[?#]|$)/i.test(candidate.url()));
		if (page) return page;
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error("Timed out waiting for the SSApp main page.");
}

async function waitForBackgroundFrame(page) {
	const started = Date.now();
	while (Date.now() - started < 60000) {
		const frame = page.frames().find(candidate => /\/background\.html(?:[?#]|$)/i.test(candidate.url()));
		if (frame) {
			try {
				const ready = await frame.evaluate(() => (
					typeof processIncomingRequest === "function" &&
					typeof processMessageWithOllama === "function" &&
					typeof streamID === "string" &&
					!!streamID
				));
				if (ready) return frame;
			} catch (_) {}
		}
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error("Timed out waiting for the Social Stream background frame.");
}

async function waitForCondition(check, timeoutMs, message) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await check()) return;
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	throw new Error(message);
}

async function configureBackground(frame, llmBaseUrl) {
	return frame.evaluate(baseUrl => {
		settings.aiChatbotEnabled = { setting: true };
		delete settings.ollama;
		delete settings.disablehost;
		settings.aiProvider = { optionsetting: "custom" };
		settings.customAIEndpoint = { textsetting: `${baseUrl}/private-bot` };
		settings.customAIModel = { textsetting: "private-bot-e2e" };
		settings.customAIApiKey = { textsetting: "private-bot-e2e-key" };
		settings.ollamabotname = { textsetting: "NinjaBot" };
		settings.ollamaprompt = { textsetting: "Answer the private host prompt." };
		settings.ollamaRateLimitPerTab = { numbersetting: "0" };
		settings.ollamaMaxParallelAgents = { numbersetting: "1" };
		settings.bottriggerwords = { textsetting: "required-trigger" };
		settings.modLLMonly = { setting: true };
		settings.alwaysRespondLLM = false;
		settings.nollmcontext = true;
		settings.ollamatts = { setting: true };
		delete settings.ollamaoverlayonly;
		window.__privateBotE2E = {
			tabSendCount: 0
		};
		const originalSendMessageToTabs = sendMessageToTabs;
		sendMessageToTabs = function () {
			window.__privateBotE2E.tabSendCount += 1;
			return originalSendMessageToTabs.apply(this, arguments);
		};
		return {
			streamID,
			password: password || ""
		};
	}, llmBaseUrl);
}

async function openReceivingBotPage(browser, session) {
	const context = await browser.newContext();
	const params = new URLSearchParams({ session: session.streamID });
	if (session.password) params.set("password", session.password);
	const page = await context.newPage();
	await page.goto(`${pathToFileURL(path.join(repoRoot, "bot.html")).href}?${params}`, {
		waitUntil: "domcontentloaded"
	});
	await page.waitForFunction(() => typeof processData === "function" && typeof TTS === "object");
	await page.evaluate(() => {
		window.__privateBotSpoken = [];
		TTS.initAudioContext = function () {};
		TTS.speechMeta = function (data, force) {
			window.__privateBotSpoken.push({
				chatmessage: data.chatmessage,
				force: force
			});
		};
	});
	return { context, page };
}

async function waitForBotPeer(frame) {
	await frame.waitForFunction(() => {
		try {
			if (ninjaBridge && ninjaBridge.isReady()) {
				const peers = ninjaBridge.getPeers();
				if (peers && Object.keys(peers).some(key => peers[key] === "bot")) return true;
			}
		} catch (_) {}
		try {
			return Object.keys(connectedPeers || {}).some(key => connectedPeers[key] === "bot");
		} catch (_) {
			return false;
		}
	}, null, { timeout: 45000 });
}

async function waitForBotReply(botPage, message, spokenCount) {
	await botPage.waitForFunction(expected => {
		const element = document.getElementById("message");
		return element && element.textContent === expected;
	}, message, { timeout: 30000 });
	await botPage.waitForFunction(expectedCount => (
		Array.isArray(window.__privateBotSpoken) &&
		window.__privateBotSpoken.length >= expectedCount
	), spokenCount, { timeout: 10000 });
}

async function openDockPage(browser, session, extraParams) {
	const context = await browser.newContext();
	const params = new URLSearchParams({ session: session.streamID });
	if (session.password) params.set("password", session.password);
	if (extraParams) {
		Object.keys(extraParams).forEach(key => {
			params.set(key, extraParams[key]);
		});
	}
	const page = await context.newPage();
	await page.goto(`${pathToFileURL(path.join(repoRoot, "dock.html")).href}?${params}`, {
		waitUntil: "domcontentloaded"
	});
	await page.locator("#chatInputButton").waitFor({ state: "attached", timeout: 30000 });
	return { context, page };
}

async function openWebRtcCommandBridge(browser, session) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const room = JSON.stringify(session.streamID);
	const passwordValue = JSON.stringify(session.password || "false");
	await page.setContent(`
		<!doctype html>
		<html>
			<body>
				<iframe id="bridge" allow="midi;microphone;"></iframe>
				<script>
					window.connectedPeers = {};
					var bridge = document.getElementById("bridge");
					bridge.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" +
						encodeURIComponent(${passwordValue}) +
						"&push&notmobile&label=dock-e2e&view=" + encodeURIComponent(${room}) +
						"&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=" + encodeURIComponent(${room});
					window.addEventListener("message", function (event) {
						if (event.source !== bridge.contentWindow || !event.data || !event.data.UUID) return;
						if (
							(event.data.action === "push-connection-info" || event.data.action === "view-connection-info") &&
							event.data.value &&
							event.data.value.label
						) {
							window.connectedPeers[event.data.UUID] = event.data.value.label;
						}
					});
					window.sendPrivateBotCommand = function (value) {
						Object.keys(window.connectedPeers).forEach(function (uuid) {
							if (window.connectedPeers[uuid] !== "SocialStream") return;
							bridge.contentWindow.postMessage({
								sendData: {
									overlayNinja: {
										action: "askBot",
										value: value
									}
								},
								type: "rpcs",
								UUID: uuid
							}, "*");
						});
					};
				</script>
			</body>
		</html>
	`);
	await waitForCondition(
		() => page.evaluate('Object.keys(window.connectedPeers).some(function (key) { return window.connectedPeers[key] === "SocialStream"; })'),
		60000,
		"WebRTC command bridge did not discover the SocialStream peer."
	);
	return { context, page };
}

async function openDestinationPicker(page) {
	const button = page.locator("#getChatSources");
	if (!(await button.isVisible())) {
		await page.locator("#say_hello").click();
	}
	await button.click();
}

async function selectPrivateDestination(page) {
	await openDestinationPicker(page);
	const privateDestination = page.locator('#chatDestinationsList input[data-tab="BOT"]');
	await privateDestination.waitFor({ state: "visible", timeout: 30000 });
	await privateDestination.check();
	await page.locator("#tabslistclose").click();
}

async function sendComposerMessage(page, message) {
	const input = page.locator("#chatInput");
	if (!(await input.isVisible())) {
		await page.locator("#say_hello").click();
	}
	await input.fill(message);
	await page.locator("#chatInputButton").click();
}

async function run() {
	const debuggerPort = await getFreePort();
	const llm = await createMockLlmServer();
	const relay = await createDockRelayServer();
	const sourceUrl = pathToFileURL(repoRoot + path.sep).href;
	const child = spawn(
		electronPath,
		[
			".",
			"--running-from-source",
			"--multiinstance",
			"--filesource",
			sourceUrl,
			`--remote-debugging-port=${debuggerPort}`,
			"--no-hwa",
			"--disable-logs"
		],
		{
			cwd: ssappRoot,
			env: {
				...process.env,
				SSAPP_USER_DATA_DIR: profileDir,
				SSAPP_DIAGNOSTICS_SAFE_GPU: "1",
				SSAPP_DEBUG_LOGS: "0"
			},
			stdio: "ignore",
			windowsHide: true
		}
	);

	let appBrowser = null;
	let webBrowser = null;
	const contexts = [];
	try {
		await waitForDebugger(debuggerPort, child);
		appBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${debuggerPort}`);
		const appContext = appBrowser.contexts()[0];
		const mainPage = await waitForMainPage(appContext);
		const backgroundFrame = await waitForBackgroundFrame(mainPage);
		const session = await configureBackground(backgroundFrame, llm.baseUrl);

		webBrowser = await chromium.launch({ headless: false });
		const bot = await openReceivingBotPage(webBrowser, session);
		contexts.push(bot.context);
		await waitForBotPeer(backgroundFrame);

		await mainPage.evaluate(() => {
			require("electron").ipcRenderer.send("postMessage", {
				overlayNinja: {
					action: "askBot",
					value: "IPC_E2E"
				},
				fromDock: true
			});
		});
		await waitForBotReply(bot.page, "IPC_E2E_REPLY", 1);
		const ipcRequest = llm.requests.find(entry => entry.marker === "IPC_E2E");
		assert(ipcRequest, "The private IPC prompt did not reach the LLM.");
		const ipcPrompt = JSON.stringify(ipcRequest.body);
		assert.match(ipcPrompt, /responding directly to a private request from the host/i);
		assert.doesNotMatch(ipcPrompt, /participant in a live group chat room|Speak only when important/i);
		console.log("PASS: Electron-wrapped dock command -> private bot -> overlay/TTS");

		await mainPage.evaluate(() => {
			require("electron").ipcRenderer.send("postMessage", {
				overlayNinja: {
					action: "askBot",
					value: "NEGATIVE_E2E"
				},
				fromDock: true
			});
		});
		await waitForBotReply(bot.page, "No, this is a direct private answer.", 2);
		console.log("PASS: Private direct answers beginning with No are not screened out");

		const p2pBridge = await openWebRtcCommandBridge(webBrowser, session);
		contexts.push(p2pBridge.context);
		await p2pBridge.page.evaluate('sendPrivateBotCommand("P2P_E2E")');
		await waitForBotReply(bot.page, "P2P_E2E_REPLY", 3);
		console.log("PASS: WebRTC data-channel command -> private bot -> overlay/TTS");

		await backgroundFrame.evaluate(serverUrl => {
			serverURLDock = `${serverUrl}/dock`;
			settings.server2 = { setting: true };
			settings.server3 = { setting: true };
			setupSocketDock();
		}, relay.baseUrl);
		const websocketDock = await openDockPage(webBrowser, session, {
			server2: `${relay.baseUrl}/extension`,
			server3: `${relay.baseUrl}/extension`
		});
		contexts.push(websocketDock.context);
		await waitForCondition(
			() => Promise.resolve(
				Array.from(relay.server.clients).some(client => client.route === "/dock" && client.relay) &&
				Array.from(relay.server.clients).some(client => client.route === "/extension" && client.relay)
			),
			15000,
			"Dock did not connect to the server3 WebSocket."
		);
		await selectPrivateDestination(websocketDock.page);
		await sendComposerMessage(websocketDock.page, "WS_E2E");
		await waitForBotReply(bot.page, "WS_E2E_REPLY", 4);
		assert(relay.messages.some(entry => (
			entry.route === "/extension" &&
			entry.data &&
			entry.data.action === "askBot" &&
			entry.data.value === "WS_E2E"
		)), "The private command did not traverse the server3 WebSocket.");
		console.log("PASS: Dock UI over server3 WebSocket -> private bot -> overlay/TTS");

		const llmCountBeforeDisabledHost = llm.requests.length;
		await backgroundFrame.evaluate(() => {
			settings.disablehost = { setting: true };
		});
		await sendComposerMessage(websocketDock.page, "DISABLED_HOST_E2E");
		await new Promise(resolve => setTimeout(resolve, 1500));
		assert.strictEqual(llm.requests.length, llmCountBeforeDisabledHost, "disablehost did not block askBot.");
		assert.strictEqual(
			await bot.page.locator("#message").textContent(),
			"WS_E2E_REPLY",
			"disablehost unexpectedly produced a bot reply."
		);
		console.log("PASS: disablehost blocks askBot over server3");

		await backgroundFrame.evaluate(() => {
			delete settings.disablehost;
			delete settings.aiChatbotEnabled;
			delete settings.ollama;
		});
		await openDestinationPicker(websocketDock.page);
		await websocketDock.page.locator('#chatDestinationsList input[data-tab="TTS"]').waitFor({
			state: "visible",
			timeout: 15000
		});
		assert.strictEqual(
			await websocketDock.page.locator('#chatDestinationsList input[data-tab="BOT"]').count(),
			0,
			"Disabled bot destination remained visible."
		);
		await mainPage.evaluate(() => {
			require("electron").ipcRenderer.send("postMessage", {
				overlayNinja: {
					action: "askBot",
					value: "DISABLED_BOT_E2E"
				},
				fromDock: true
			});
		});
		const unavailableNotice = websocketDock.page.locator("#dockActionNotice");
		await unavailableNotice.waitFor({ state: "visible", timeout: 15000 });
		assert.match(await unavailableNotice.textContent(), /Enable the AI chat bot/i);
		console.log("PASS: Disabled bot is hidden and returns an unavailable notice");

		await backgroundFrame.evaluate(() => {
			settings.ollama = { setting: true };
		});
		await websocketDock.page.locator("#tabslistclose").click();
		await openDestinationPicker(websocketDock.page);
		const legacyPrivateDestination = websocketDock.page.locator('#chatDestinationsList input[data-tab="BOT"]');
		await legacyPrivateDestination.waitFor({ state: "visible", timeout: 15000 });
		await legacyPrivateDestination.check();
		await websocketDock.page.locator("#tabslistclose").click();
		await sendComposerMessage(websocketDock.page, "LEGACY_E2E");
		await waitForBotReply(bot.page, "LEGACY_E2E_REPLY", 5);
		console.log("PASS: Legacy ollama enable flag still supports private bot requests");

		const finalState = await backgroundFrame.evaluate(() => ({
			tabSendCount: window.__privateBotE2E.tabSendCount
		}));
		assert.strictEqual(finalState.tabSendCount, 0, "A private bot response was sent to a connected chat tab.");
		const spoken = await bot.page.evaluate(() => window.__privateBotSpoken.slice());
		assert(spoken.length >= 5 && spoken.every(entry => entry.force === true), "Bot overlay did not route every reply through forced TTS.");
		console.log("PASS: Private replies never entered chat and all carried the TTS route");
	} finally {
		for (const context of contexts) {
			await context.close().catch(() => {});
		}
		if (webBrowser) await webBrowser.close().catch(() => {});
		if (appBrowser) await appBrowser.close().catch(() => {});
		if (child.exitCode === null) child.kill();
		await new Promise(resolve => setTimeout(resolve, 500));
		for (const client of relay.server.clients) {
			client.terminate();
		}
		await closeServer(relay.server);
		await closeServer(llm.server);
		fs.rmSync(profileDir, { recursive: true, force: true });
	}
}

run().catch(error => {
	console.error(error.stack || error);
	process.exitCode = 1;
});
