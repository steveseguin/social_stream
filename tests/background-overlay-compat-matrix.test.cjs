"use strict";

// Run: node tests/background-overlay-compat-matrix.test.cjs
// Optional: SSN_COMPAT_MATRIX_FILTER=<template> SSN_COMPAT_MATRIX_CONCURRENCY=<count>

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const vm = require("vm");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const matrixFilter = String(process.env.SSN_COMPAT_MATRIX_FILTER || "").trim().toLowerCase();
const matrixConcurrency = Math.max(1, Number(process.env.SSN_COMPAT_MATRIX_CONCURRENCY) || 3);
const matrixDebug = process.env.SSN_COMPAT_MATRIX_DEBUG === "1";

const backgroundBuildSpecs = [
	{ label: "3.21.9", commit: "b9bae564" },
	{ label: "3.39.4", commit: "6b908ec5" },
	{ label: "3.49.2", commit: "23f2ee01" },
	{ label: "3.50.0", commit: "324143af" },
	{ label: "3.50.4-cws", commit: "56c4938f" },
	{ label: "3.50.5-main", commit: "ad0bcb60" },
	{ label: "3.50.5-cws", commit: "edc61217" },
	{ label: "3.50.6", commit: "f07d2a0e" },
	{ label: "working-tree", commit: null }
];

const fullOverlayVersions = [null, "3.21.9", "3.39.4", "3.50.4", "3.50.5", "3.50.6", "3.52.0"];
const rotatingOverlayVersions = ["3.21.9", "3.39.4", "3.50.4", "3.50.6", "3.52.0"];
const fullVersionTemplates = new Set(["dock.html", "sampleoverlay.html", "featured.html"]);

function extractFunction(source, name) {
	const start = source.indexOf(`function ${name}(`);
	assert(start >= 0, `Missing function ${name}`);
	const braceStart = source.indexOf("{", start);
	let depth = 0;
	let quote = "";
	let escaped = false;
	for (let index = braceStart; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === quote) quote = "";
			continue;
		}
		if (character === '"' || character === "'" || character === "`") {
			quote = character;
			continue;
		}
		if (character === "{") depth += 1;
		if (character === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, index + 1);
		}
	}
	throw new Error(`Unable to extract function ${name}`);
}

function readGitFile(commit, file) {
	try {
		return execFileSync("git", ["show", `${commit}:${file}`], {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"]
		});
	} catch (error) {
		throw new Error(`Historical fixture ${commit}:${file} is unavailable. A full Git checkout is required.`);
	}
}

function loadBackgroundBuilds() {
	return backgroundBuildSpecs.map(spec => {
		const source = spec.commit
			? readGitFile(spec.commit, "background.js")
			: fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
		const manifestSource = spec.commit
			? readGitFile(spec.commit, "manifest.json")
			: fs.readFileSync(path.join(repoRoot, "manifest.json"), "utf8");
		const manifest = JSON.parse(manifestSource);
		if (spec.commit) {
			assert.strictEqual(
				manifest.version,
				spec.label.split("-")[0],
				`${spec.commit}: historical manifest no longer matches fixture ${spec.label}`
			);
		}
		return {
			...spec,
			manifestVersion: manifest.version,
			source,
			sendDataP2PSource: extractFunction(source, "sendDataP2P"),
			setupSocketDockSource: extractFunction(source, "setupSocketDock"),
			supportsAdditiveDelivery: source.includes('getSettingFlag("server2additivedelivery")')
		};
	});
}

function cloneJson(value) {
	return JSON.parse(JSON.stringify(value));
}

function simulateBackgroundDelivery(build, payload, options) {
	const delivered = { websocket: [], webrtc: [] };
	const sandbox = {
		settings: options.server2 ? { server2: { setting: true } } : {},
		socketserverDock: {
			readyState: 1,
			send(serialized) {
				delivered.websocket.push(JSON.parse(serialized));
			}
		},
		iframe: {
			contentWindow: {
				postMessage(message) {
					if (message && message.sendData && message.sendData.overlayNinja !== undefined) {
						delivered.webrtc.push(cloneJson(message.sendData.overlayNinja));
					}
				}
			}
		},
		connectedPeers: { matrixPeer: "dock" },
		ninjaBridge: null,
		getSettingFlag(setting) {
			return setting === "server2additivedelivery" && !!options.additive;
		},
		getOverlayDisplayPayload(data) { return data; },
		markP2PFailure() {},
		console: {
			error() {},
			warn() {},
			log() {}
		}
	};
	vm.createContext(sandbox);
	// Newer builds route Stream Deck peers separately; load the real helper
	// while keeping older historical fixtures unchanged.
	const streamDeckHelper = build.source.includes("function sendDataToStreamDeckPeersP2P(")
		? extractFunction(build.source, "sendDataToStreamDeckPeersP2P")
		: "";
	vm.runInContext(
		`${streamDeckHelper}\n${build.sendDataP2PSource}\nthis.__sendDataP2P = sendDataP2P;`,
		sandbox,
		{ filename: `background-${build.label}-sendDataP2P.js` }
	);
	sandbox.__sendDataP2P(cloneJson(payload));
	return delivered;
}

function makeContractPayloads() {
	return [
		{ id: "chat-id", chatname: "Chat User", chatmessage: "chat with id", type: "youtube" },
		{ chatname: "No ID User", chatmessage: "chat without id", type: "twitch" },
		{ id: "donation-id", chatname: "Donor", chatmessage: "great stream", type: "youtube", hasDonation: "$5.00", donoValue: 5 },
		{ chatname: "Member", chatmessage: "member message", type: "twitch", membership: "Subscriber" },
		{ id: "event-id", chatname: "Follower", chatmessage: "followed", type: "twitch", event: "follow" },
		{ type: "event", event: "viewer_updates", meta: { youtube: 12, twitch: 8 } }
	];
}

function simulateBackgroundRemoteCommand(build, options) {
	const sockets = [];
	const commands = [];
	function FakeWebSocket(url) {
		this.url = url;
		this.readyState = FakeWebSocket.CONNECTING;
		this.sent = [];
		this.listeners = {};
		sockets.push(this);
	}
	FakeWebSocket.CONNECTING = 0;
	FakeWebSocket.OPEN = 1;
	FakeWebSocket.CLOSED = 3;
	FakeWebSocket.prototype.addEventListener = function (type, handler) {
		this.listeners[type] = handler;
	};
	FakeWebSocket.prototype.send = function (message) {
		this.sent.push(parseSocketMessage(message));
	};
	FakeWebSocket.prototype.close = function () {
		this.readyState = FakeWebSocket.CLOSED;
	};

	const sandbox = {
		settings: {
			server2: !!options.server2,
			server3: !!options.server3
		},
		isExtensionOn: true,
		reconnectionTimeoutDock: null,
		socketserverDock: false,
		serverURLDock: "ws://matrix.invalid/dock",
		conConDock: 0,
		streamID: "compat-background-command",
		WebSocket: FakeWebSocket,
		clearTimeout() {},
		setTimeout() { return 1; },
		processIncomingRequest(command) {
			commands.push(cloneJson(command));
		},
		combineHypeData() { return {}; },
		log() {},
		console: { error() {}, warn() {}, log() {} }
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`${build.setupSocketDockSource}\nthis.__setupSocketDock = setupSocketDock;`,
		sandbox,
		{ filename: `background-${build.label}-setupSocketDock.js` }
	);
	sandbox.__setupSocketDock();
	const socket = sockets[0] || null;
	if (socket) {
		socket.readyState = FakeWebSocket.OPEN;
		if (typeof socket.onopen === "function") socket.onopen();
		const listener = socket.listeners.message;
		if (listener) listener({ data: JSON.stringify(options.command) });
	}
	return { socket, commands };
}

function assertHistoricalBackgroundContracts(builds) {
	const payloads = makeContractPayloads();
	const remoteCommand = { action: "clearOverlay", target: "extension" };
	for (const build of builds) {
		for (const payload of payloads) {
			const p2p = simulateBackgroundDelivery(build, payload, { server2: false, additive: false });
			assert.strictEqual(p2p.websocket.length, 0, `${build.label}: P2P mode unexpectedly used WebSocket`);
			assert.strictEqual(p2p.webrtc.length, 1, `${build.label}: P2P mode did not emit exactly once`);
			assert.deepStrictEqual(p2p.webrtc[0], payload, `${build.label}: P2P mode changed the payload`);

			const server = simulateBackgroundDelivery(build, payload, { server2: true, additive: false });
			assert.strictEqual(server.websocket.length, 1, `${build.label}: server2 mode did not emit exactly once`);
			assert.strictEqual(server.webrtc.length, 0, `${build.label}: server2 mode unexpectedly duplicated over WebRTC`);
			assert.deepStrictEqual(server.websocket[0], payload, `${build.label}: server2 mode changed the payload`);

			if (build.supportsAdditiveDelivery) {
				const additive = simulateBackgroundDelivery(build, payload, { server2: true, additive: true });
				assert.strictEqual(additive.websocket.length, 1, `${build.label}: additive WebSocket copy missing`);
				assert.strictEqual(additive.webrtc.length, 1, `${build.label}: additive WebRTC copy missing`);
				assert.deepStrictEqual(additive.websocket[0], payload, `${build.label}: additive WebSocket payload changed`);
				assert.deepStrictEqual(additive.webrtc[0], payload, `${build.label}: additive WebRTC payload changed`);
			}
		}

		const remoteEnabled = simulateBackgroundRemoteCommand(build, {
			server2: true,
			server3: true,
			command: remoteCommand
		});
		assert(remoteEnabled.socket, `${build.label}: server3 did not open its command WebSocket`);
		assert.deepStrictEqual(
			remoteEnabled.socket.sent[0],
			{ join: "compat-background-command", out: 4, in: 3 },
			`${build.label}: server3 joined the wrong command channel`
		);
		assert.deepStrictEqual(remoteEnabled.commands, [remoteCommand], `${build.label}: remote API command was not processed once`);

		const feedOnly = simulateBackgroundRemoteCommand(build, {
			server2: true,
			server3: false,
			command: remoteCommand
		});
		assert(feedOnly.socket, `${build.label}: server2 did not open its feed WebSocket`);
		assert.strictEqual(feedOnly.commands.length, 0, `${build.label}: server2 accepted a server3-only remote command`);

		const transportsOff = simulateBackgroundRemoteCommand(build, {
			server2: false,
			server3: false,
			command: remoteCommand
		});
		assert.strictEqual(transportsOff.socket, null, `${build.label}: disabled server transports opened a WebSocket`);
	}
	console.log(`PASS historical background transport contracts (${builds.length} builds, ${payloads.length} payload types, remote commands)`);
}

function readStyledOverlayTemplates() {
	const popup = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
	const selectStart = popup.indexOf('<select id="overlay-preset-select"');
	assert(selectStart >= 0, "Missing styled-overlay selector in popup.html");
	const selectEnd = popup.indexOf("</select>", selectStart);
	assert(selectEnd > selectStart, "Styled-overlay selector is malformed");
	const selectSource = popup.slice(selectStart, selectEnd);
	const templates = [];
	const seen = new Set();
	const optionPattern = /<option\s+value="([^"]+?)"/g;
	let match;
	while ((match = optionPattern.exec(selectSource))) {
		const template = match[1];
		if (seen.has(template)) continue;
		seen.add(template);
		templates.push(template);
	}
	assert(templates.includes("sampleoverlay.html"), "Styled-overlay selector no longer includes sampleoverlay.html");
	assert(templates.length >= 20, `Expected the complete styled-overlay list, found only ${templates.length}`);
	return templates;
}

function extractAssignedObject(source, name) {
	const assignmentStart = source.indexOf(`const ${name} =`);
	assert(assignmentStart >= 0, `Missing ${name}`);
	const braceStart = source.indexOf("{", assignmentStart);
	let depth = 0;
	let quote = "";
	let escaped = false;
	for (let index = braceStart; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === quote) quote = "";
			continue;
		}
		if (character === '"' || character === "'" || character === "`") {
			quote = character;
			continue;
		}
		if (character === "{") depth += 1;
		if (character === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(braceStart, index + 1);
		}
	}
	throw new Error(`Unable to extract ${name}`);
}

function readStyledOverlayServerSupport() {
	const popup = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
	const objectSource = extractAssignedObject(popup, "CHAT_OVERLAY_SERVER_PARAM_SUPPORT");
	return vm.runInNewContext(`(${objectSource})`, {
		FULL_SERVER_LINK_SUPPORT: { server: true, server2: true, server3: true },
		NO_SERVER_LINK_SUPPORT: { server: false, server2: false, server3: false }
	});
}

function makeOverlayEntries() {
	const templates = readStyledOverlayTemplates();
	const serverSupport = readStyledOverlayServerSupport();
	const entries = [
		{ template: "dock.html", singleMessage: false, supportsServer2: true },
		{ template: "featured.html", singleMessage: true, supportsServer2: true }
	];
	for (const template of templates) {
		const support = serverSupport[getTemplatePath(template)] || {};
		entries.push({ template, singleMessage: false, supportsServer2: support.server2 === true });
	}
	return entries.filter(entry => !matrixFilter || entry.template.toLowerCase().includes(matrixFilter));
}

function getTemplatePath(template) {
	return template.split("?")[0];
}

function makeOverlayUrl(baseUrl, entry, session, version, serverUrl) {
	const separator = entry.template.includes("?") ? "&" : "?";
	let url = `${baseUrl}/${entry.template}${separator}session=${encodeURIComponent(session)}`;
	if (version) url += `&v=${encodeURIComponent(version)}`;
	if (serverUrl) url += `&server2=${encodeURIComponent(serverUrl)}`;
	return url;
}

function contentTypeFor(file) {
	const extension = path.extname(file).toLowerCase();
	return {
		".css": "text/css; charset=utf-8",
		".gif": "image/gif",
		".html": "text/html; charset=utf-8",
		".ico": "image/x-icon",
		".jpeg": "image/jpeg",
		".jpg": "image/jpeg",
		".js": "text/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png": "image/png",
		".svg": "image/svg+xml",
		".ttf": "font/ttf",
		".webp": "image/webp",
		".woff": "font/woff",
		".woff2": "font/woff2"
	}[extension] || "application/octet-stream";
}

async function createStaticServer() {
	const rootPrefix = `${repoRoot.toLowerCase()}${path.sep}`;
	const server = http.createServer((request, response) => {
		let pathname = "/";
		try {
			pathname = decodeURIComponent(new URL(request.url, "http://matrix.local").pathname);
		} catch (_) {}
		if (pathname === "/") pathname = "/index.html";
		const file = path.resolve(repoRoot, `.${pathname}`);
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
				"Content-Type": contentTypeFor(file)
			});
			response.end(body);
		});
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	return {
		server,
		baseUrl: `http://127.0.0.1:${server.address().port}`
	};
}

async function closeServer(server) {
	if (!server) return;
	await new Promise(resolve => server.close(resolve));
}

async function configureNetworkMocks(context) {
	const coloursSource = fs.readFileSync(path.join(repoRoot, "libs", "colours.js"), "utf8");
	await context.route("https://**/*", async route => {
		const url = route.request().url();
		if (url.startsWith("https://vdo.socialstream.ninja/")) {
			await route.fulfill({
				contentType: "text/html; charset=utf-8",
				body: "<!doctype html><html><body><script>window.__ssnCompatMatrixBridge=true;</script></body></html>"
			});
			return;
		}
		if (url === "https://socialstream.ninja/libs/colours.js") {
			await route.fulfill({ contentType: "text/javascript; charset=utf-8", body: coloursSource });
			return;
		}
		if (url.startsWith("https://cdn.jsdelivr.net/npm/dayjs")) {
			await route.fulfill({
				contentType: "text/javascript; charset=utf-8",
				body: "window.dayjs=function(){return {format:function(){return ''}}};"
			});
			return;
		}
		if (/fonts\.(?:googleapis|gstatic|cdnfonts)\.com/.test(url) || url.includes("vdo.ninja/examples/OpenDyslexic")) {
			await route.fulfill({ contentType: "text/css; charset=utf-8", body: "" });
			return;
		}
		await route.abort();
	});
}

function parseSocketMessage(message) {
	try {
		return JSON.parse(typeof message === "string" ? message : String(message));
	} catch (_) {
		return null;
	}
}

async function openOverlayHarness(context, baseUrl, entry, version, withServer, sessionSuffix) {
	const page = await context.newPage();
	const pageErrors = [];
	const sockets = [];
	await page.addInitScript(() => {
		// Dock intentionally replaces window.eval; Playwright's WebSocket mock uses it
		// internally, so preserve the native function inside this isolated test page.
		if (/\/dock\.html$/i.test(location.pathname)) {
			const nativeEval = window.eval;
			Object.defineProperty(window, "eval", {
				configurable: false,
				writable: false,
				value: nativeEval
			});
		}
	});
	page.on("pageerror", error => pageErrors.push(String(error && error.stack || error)));
	if (matrixDebug) page.on("console", message => console.error(`[browser] ${message.text()}`));
	await page.routeWebSocket("**", socket => {
		const record = { socket, url: socket.url(), join: null, messages: [] };
		sockets.push(record);
		socket.onMessage(message => {
			record.messages.push(message);
			const parsed = parseSocketMessage(message);
			if (parsed && parsed.join) record.join = parsed;
			if (matrixDebug) console.error(`[websocket page->server] ${record.url} ${String(message)}`);
		});
	});
	const session = `compat-${sessionSuffix}`.replace(/[^a-z0-9-]/gi, "-");
	const serverUrl = withServer ? "ws://matrix.invalid/extension" : "";
	const url = makeOverlayUrl(baseUrl, entry, session, version, serverUrl);
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
	if (matrixDebug) console.error(`[overlay] ${url}`);
	return { page, pageErrors, sockets, url };
}

async function waitForCondition(check, timeoutMs, message) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await check()) return;
		await new Promise(resolve => setTimeout(resolve, 40));
	}
	throw new Error(message);
}

async function getFeedSocket(harness) {
	await waitForCondition(
		() => Promise.resolve(harness.sockets.length > 0),
		4000,
		`${harness.url}: server2 WebSocket was not created`
	);

	// Some overlays send their join packet before Playwright attaches onMessage.
	// Prefer the confirmed input socket, then fall back to the controlled extension URL.
	try {
		await waitForCondition(
			() => Promise.resolve(harness.sockets.some(record => record.join && Number(record.join.in) === 4)),
			250,
			"server2 join packet was not observed"
		);
	} catch (_) {}
	const joinedSocket = harness.sockets.find(record => record.join && Number(record.join.in) === 4);
	if (joinedSocket) return joinedSocket;
	const extensionSocket = harness.sockets.find(record => record.url === "ws://matrix.invalid/extension");
	if (extensionSocket) return extensionSocket;
	throw new Error(`${harness.url}: could not identify the server2 input socket`);
}

function findBridgeFrame(page) {
	return page.frames().find(frame => frame !== page.mainFrame() && frame.url().startsWith("https://vdo.socialstream.ninja/"));
}

async function getBridgeFrame(page, required) {
	let frame = null;
	try {
		await waitForCondition(() => {
			frame = findBridgeFrame(page);
			return Promise.resolve(!!frame);
		}, required ? 4000 : 500, "WebRTC bridge iframe was not created");
	} catch (error) {
		if (required) throw error;
	}
	return frame;
}

async function sendWebSocketPayload(harness, payload) {
	const feedSocket = await getFeedSocket(harness);
	if (matrixDebug) console.error(`[websocket server->page] ${feedSocket.url} ${JSON.stringify(payload)}`);
	feedSocket.socket.send(JSON.stringify(payload));
}

async function sendWebRtcPayload(harness, payload) {
	const frame = await getBridgeFrame(harness.page, true);
	await frame.evaluate(message => {
		parent.postMessage({ dataReceived: { overlayNinja: message } }, "*");
	}, payload);
}

async function markerCount(page, marker) {
	let count = 0;
	for (const frame of page.frames()) {
		try {
			count += await frame.evaluate(value => {
				const text = document.body ? (document.body.textContent || "") : "";
				return text.split(value).length - 1;
			}, marker);
		} catch (_) {}
	}
	return count;
}

async function waitForMarker(page, marker, description) {
	try {
		await waitForCondition(
			async () => (await markerCount(page, marker)) > 0,
			5000,
			`${description}: marker ${marker} was not rendered`
		);
	} catch (_) {
		throw new Error(`${description}: marker ${marker} was not rendered`);
	}
}

function makeVisualPayload(marker, kind, includeId) {
	const payload = {
		chatname: `${kind} User`,
		chatmessage: marker,
		type: kind === "event" ? "twitch" : "youtube",
		textonly: true
	};
	if (includeId) payload.id = `${kind}-${marker}`;
	if (kind === "donation") {
		payload.hasDonation = "$7.00";
		payload.donoValue = 7;
	}
	if (kind === "membership") payload.membership = "Member";
	if (kind === "event") payload.event = "follow";
	return payload;
}

async function deliverSimulatedOutputs(harness, outputs) {
	for (const payload of outputs.websocket) await sendWebSocketPayload(harness, payload);
	for (const payload of outputs.webrtc) await sendWebRtcPayload(harness, payload);
}

async function assertMirroredDuplicate(harness, build, marker, includeId, singleRenderCount) {
	const payload = makeVisualPayload(marker, "chat", includeId);
	const websocket = simulateBackgroundDelivery(build, payload, { server2: true, additive: false });
	const webrtc = simulateBackgroundDelivery(build, payload, { server2: false, additive: false });
	await deliverSimulatedOutputs(harness, websocket);
	await deliverSimulatedOutputs(harness, webrtc);
	await waitForMarker(harness.page, marker, harness.url);
	await harness.page.waitForTimeout(1000);
	const mirroredCount = await markerCount(harness.page, marker);
	assert.strictEqual(
		mirroredCount,
		singleRenderCount,
		`${harness.url}: ${includeId ? "ID" : "ID-less"} message doubled across WebSocket and WebRTC`
	);
}

async function assertRepeatedIdlessPairing(harness, build, marker, singleRenderCount) {
	const payload = makeVisualPayload(marker, "membership", false);
	const websocket = simulateBackgroundDelivery(build, payload, { server2: true, additive: false });
	const webrtc = simulateBackgroundDelivery(build, payload, { server2: false, additive: false });
	await deliverSimulatedOutputs(harness, websocket);
	await deliverSimulatedOutputs(harness, websocket);
	await deliverSimulatedOutputs(harness, webrtc);
	await deliverSimulatedOutputs(harness, webrtc);
	await waitForMarker(harness.page, marker, harness.url);
	await harness.page.waitForTimeout(1000);
	const mirrored = await markerCount(harness.page, marker);
	assert.strictEqual(
		mirrored,
		singleRenderCount * 2,
		`${harness.url}: repeated ID-less deliveries were suppressed or their mirrors were not paired one-for-one`
	);
}

async function runOverlayCase(context, baseUrl, builds, task) {
	const { entry, version, taskIndex } = task;
	const versionLabel = version || "no-v";
	const caseLabel = `${entry.template} [${versionLabel}]`;
	let dualHarness = null;
	let p2pHarness = null;
	let dualBridge = null;
	try {
		if (!entry.supportsServer2) {
			p2pHarness = await openOverlayHarness(
				context,
				baseUrl,
				entry,
				version,
				false,
				`${taskIndex}-p2p-only`
			);
			const p2pBuild = builds[taskIndex % builds.length];
			const p2pMarker = `RTC_${taskIndex}_${p2pBuild.label}`.replace(/[^A-Z0-9_]/gi, "_");
			const p2pPayload = makeVisualPayload(p2pMarker, taskIndex % 2 ? "membership" : "chat", false);
			await deliverSimulatedOutputs(
				p2pHarness,
				simulateBackgroundDelivery(p2pBuild, p2pPayload, { server2: false, additive: false })
			);
			await waitForMarker(p2pHarness.page, p2pMarker, caseLabel);
			const seriousErrors = p2pHarness.pageErrors.filter(error => /(?:ReferenceError|SyntaxError|TypeError)/.test(error));
			assert.strictEqual(seriousErrors.length, 0, `${caseLabel}: uncaught page error: ${seriousErrors[0] || ""}`);
			return `${caseLabel} (WebRTC-only by declared capability)`;
		}

		dualHarness = await openOverlayHarness(
			context,
			baseUrl,
			entry,
			version,
			true,
			`${taskIndex}-dual`
		);
		const websocketBuild = builds[taskIndex % builds.length];
		const websocketMarker = `WS_${taskIndex}_${websocketBuild.label}`.replace(/[^A-Z0-9_]/gi, "_");
		const websocketPayload = makeVisualPayload(websocketMarker, taskIndex % 2 ? "donation" : "event", true);
		await deliverSimulatedOutputs(
			dualHarness,
			simulateBackgroundDelivery(websocketBuild, websocketPayload, { server2: true, additive: false })
		);
		await waitForMarker(dualHarness.page, websocketMarker, caseLabel);
		const singleRenderCount = await markerCount(dualHarness.page, websocketMarker);
		assert(singleRenderCount > 0, `${caseLabel}: single-render calibration marker was not visible`);

		const p2pBuild = builds[(taskIndex + 1) % builds.length];
		const p2pMarker = `RTC_${taskIndex}_${p2pBuild.label}`.replace(/[^A-Z0-9_]/gi, "_");
		const p2pPayload = makeVisualPayload(p2pMarker, taskIndex % 2 ? "membership" : "chat", false);
		dualBridge = await getBridgeFrame(dualHarness.page, false);
		if (dualBridge) {
			await deliverSimulatedOutputs(
				dualHarness,
				simulateBackgroundDelivery(p2pBuild, p2pPayload, { server2: false, additive: false })
			);
			await waitForMarker(dualHarness.page, p2pMarker, caseLabel);
		} else {
			p2pHarness = await openOverlayHarness(
				context,
				baseUrl,
				entry,
				version,
				false,
				`${taskIndex}-p2p`
			);
			await deliverSimulatedOutputs(
				p2pHarness,
				simulateBackgroundDelivery(p2pBuild, p2pPayload, { server2: false, additive: false })
			);
			await waitForMarker(p2pHarness.page, p2pMarker, caseLabel);
		}

		if (dualBridge) {
			const additiveBuild = builds.find(build => build.label === "working-tree");
			await assertMirroredDuplicate(dualHarness, additiveBuild, `DUP_ID_${taskIndex}`, true, singleRenderCount);
			await assertMirroredDuplicate(dualHarness, additiveBuild, `DUP_NOID_${taskIndex}`, false, singleRenderCount);
			if (!entry.singleMessage) {
				await assertRepeatedIdlessPairing(dualHarness, additiveBuild, `REPEAT_NOID_${taskIndex}`, singleRenderCount);
			}
		}

		const seriousErrors = dualHarness.pageErrors.concat(p2pHarness ? p2pHarness.pageErrors : [])
			.filter(error => /(?:ReferenceError|SyntaxError|TypeError)/.test(error));
		assert.strictEqual(seriousErrors.length, 0, `${caseLabel}: uncaught page error: ${seriousErrors[0] || ""}`);
		return caseLabel;
	} finally {
		if (p2pHarness) await p2pHarness.page.close().catch(() => {});
		if (dualHarness) await dualHarness.page.close().catch(() => {});
	}
}

function makeOverlayTasks(entries) {
	const tasks = [];
	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		const normalizedTemplate = getTemplatePath(entry.template);
		const versions = fullVersionTemplates.has(normalizedTemplate)
			? fullOverlayVersions
			: [null, rotatingOverlayVersions[index % rotatingOverlayVersions.length]];
		for (const version of versions) tasks.push({ entry, version });
	}
	return tasks.map((task, taskIndex) => ({ ...task, taskIndex }));
}

async function runTaskPool(tasks, worker, concurrency) {
	const failures = [];
	let nextTask = 0;
	let completed = 0;
	async function runWorker() {
		while (true) {
			const index = nextTask;
			nextTask += 1;
			if (index >= tasks.length) return;
			const task = tasks[index];
			try {
				const label = await worker(task);
				completed += 1;
				console.log(`PASS overlay matrix ${completed}/${tasks.length}: ${label}`);
			} catch (error) {
				completed += 1;
				const label = `${task.entry.template} [${task.version || "no-v"}]`;
				failures.push({ label, error });
				console.error(`FAIL overlay matrix ${completed}/${tasks.length}: ${label}: ${error.message}`);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => runWorker()));
	return failures;
}

async function run() {
	const builds = loadBackgroundBuilds();
	assertHistoricalBackgroundContracts(builds);
	const entries = makeOverlayEntries();
	assert(entries.length > 0, `No overlays matched SSN_COMPAT_MATRIX_FILTER=${matrixFilter}`);
	const tasks = makeOverlayTasks(entries);
	const staticServer = await createStaticServer();
	let browser = null;
	try {
		browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		await configureNetworkMocks(context);
		const failures = await runTaskPool(
			tasks,
			task => runOverlayCase(context, staticServer.baseUrl, builds, task),
			matrixConcurrency
		);
		await context.close();
		if (failures.length) {
			const details = failures.slice(0, 20).map(failure => `- ${failure.label}: ${failure.error.message}`).join("\n");
			throw new Error(`${failures.length} overlay compatibility case(s) failed:\n${details}`);
		}
		console.log(
			`PASS background/overlay compatibility matrix (${builds.length} backgrounds, ${entries.length} overlays, ${tasks.length} overlay/version cases)`
		);
	} finally {
		if (browser) await browser.close().catch(() => {});
		await closeServer(staticServer.server);
	}
}

run().catch(error => {
	console.error(error && error.stack || error);
	process.exitCode = 1;
});
