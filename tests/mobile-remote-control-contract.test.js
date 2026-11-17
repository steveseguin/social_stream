const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const router = require("../js/streamdeck-remote-control.js");
const root = path.resolve(__dirname, "..");

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function extractFunction(source, name) {
	const asyncNeedle = `async function ${name}(`;
	const regularNeedle = `function ${name}(`;
	let start = source.indexOf(asyncNeedle);
	if (start < 0) start = source.indexOf(regularNeedle);
	assert.ok(start >= 0, `${name} was not found`);
	const bodyStart = source.indexOf("{", start);
	let depth = 0;
	let quote = "";
	let escaped = false;
	let lineComment = false;
	let blockComment = false;
	for (let index = bodyStart; index < source.length; index += 1) {
		const character = source[index];
		const next = source[index + 1];
		if (lineComment) {
			if (character === "\n") lineComment = false;
			continue;
		}
		if (blockComment) {
			if (character === "*" && next === "/") {
				blockComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === quote) quote = "";
			continue;
		}
		if (character === "/" && next === "/") {
			lineComment = true;
			index += 1;
			continue;
		}
		if (character === "/" && next === "*") {
			blockComment = true;
			index += 1;
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
	throw new Error(`${name} did not have a complete body`);
}

async function testBackgroundCommandHandler() {
	const background = read("background.js");
	const source = [
		extractFunction(background, "isGiveawayAction"),
		extractFunction(background, "isStreamDeckTimerAction"),
		extractFunction(background, "isStreamDeckResetConfirmed"),
		extractFunction(background, "handleStreamDeckBackgroundRequest")
	].join("\n");
	const timerActions = [];
	let timerBroadcasts = 0;
	let sentChat = null;
	const handle = Function(
		"getStreamDeckRemoteControlRouter",
		"isExtensionOn",
		"settings",
		"normalizeRelayTabId",
		"sendMessageToTabs",
		"applyTimerAction",
		"initializeTimer",
		"exportTimerState",
		`${source}; return handleStreamDeckBackgroundRequest;`
	)(
		() => router,
		true,
		{},
		(value) => (value === undefined ? null : Number(value)),
		async (message) => {
			sentChat = message;
			return true;
		},
		(action, value) => timerActions.push({ action, value }),
		() => {
			timerBroadcasts += 1;
		},
		() => ({ running: true, currentMs: 12000 })
	);

	const chat = await handle({ action: "sendChat", protocol: 2, get: "chat-1", value: "hello", target: "youtube" });
	assert.equal(chat.ok, true);
	assert.equal(chat.status, "accepted");
	assert.equal(sentChat.response, "hello");
	assert.equal(sentChat.destination, "youtube");

	const invalidChat = await handle({ action: "sendChat", protocol: 2, get: "chat-2", value: "" });
	assert.equal(invalidChat.ok, false);
	assert.equal(invalidChat.error.code, "INVALID_VALUE");

	const unconfirmedReset = await handle({ action: "resettimer", protocol: 2, get: "timer-1" });
	assert.equal(unconfirmedReset.ok, false);
	assert.equal(unconfirmedReset.error.code, "CONFIRMATION_REQUIRED");

	const reset = await handle({ action: "resettimer", protocol: 2, get: "timer-2", value: { confirm: true } });
	assert.equal(reset.ok, true);
	assert.equal(reset.status, "completed");
	assert.deepEqual(timerActions, [{ action: "resettimer", value: { confirm: true } }]);
	assert.equal(timerBroadcasts, 1);
	assert.equal(reset.payload.timer.currentMs, 12000);
}

async function testSendChatRequiresDispatchCandidate() {
	const background = read("background.js");
	const source = [
		extractFunction(background, "processRelayTabBatch"),
		extractFunction(background, "sendMessageToTabs")
	].join("\n");
	let tabs = [];
	let dispatches = 0;
	let lastDispatchOptions = null;
	const sandbox = {
		chrome: {
			debugger: {},
			tabs: {
				query(_query, callback) {
					callback(tabs);
				}
			},
			runtime: { lastError: null }
		},
		isExtensionOn: true,
		settings: {},
		getSettingFlag: () => false,
		messageCounter: 1,
		lastAntiSpam: 0,
		messageTimeout: {},
		handleStageTen() {},
		getAccountRoleListSetting: () => [],
		getRelayTargetTabIdSet: () => new Set(),
		getSourceType: async () => "twitch",
		getLegacySSAppRelaySourceType: () => false,
		shouldApplyRelayAccountRoleFilter: () => false,
		filterRelayCandidateTabs: (candidates) => candidates,
		hasExplicitRelayTabTargets: () => false,
		isValidTab: async () => true,
		claimPublishedUrl: () => true,
		dispatchRelayMessageToTab: async (_tab, _data, options) => {
			dispatches += 1;
			lastDispatchOptions = options;
		},
		console,
		Promise,
		Set,
		Date
	};
	vm.runInNewContext(`${source}; this.sendMessageToTabs = sendMessageToTabs;`, sandbox);

	const missing = await sandbox.sendMessageToTabs({ response: "hello", outgoingOrigin: "host" });
	assert.equal(missing, false, "sendChat reported accepted without an eligible capture source");
	assert.equal(dispatches, 0);

	tabs = [{ id: 1, url: "https://www.twitch.tv/tester" }];
	const accepted = await sandbox.sendMessageToTabs({ response: "hello", outgoingOrigin: "host" });
	assert.equal(accepted, true, "sendChat rejected an eligible capture-source dispatch");
	assert.equal(dispatches, 1);

	await sandbox.sendMessageToTabs({ response: "automatic", botRoleControlled: true });
	assert.equal(lastDispatchOptions.messageOrigin, "chatbot", "automatic bot replies were not marked for bot-account routing");
}

function testWebsocketMessageOriginForwarding() {
	const background = read("background.js");
	const source = extractFunction(background, "relayMessageToWebsocketSourceTab");
	let captured = null;
	const relay = Function(
		"chrome",
		"console",
		`${source}; return relayMessageToWebsocketSourceTab;`
	)({
		tabs: {
			sendMessage(tabId, payload, callback) {
				captured = { tabId, payload };
				callback();
			}
		},
		runtime: { lastError: null }
	}, console);

	assert.equal(relay(42, "hello", "chatbot"), true);
	assert.deepEqual(captured, {
		tabId: 42,
		payload: {
			type: "SEND_MESSAGE",
			message: "hello",
			messageOrigin: "chatbot"
		}
	});
}

function testDockOwnerAndDeduplication() {
	const dock = read("dock.html");
	const source = [
		extractFunction(dock, "isVersionedRemoteControlRequest"),
		extractFunction(dock, "pruneRemoteControlDockResults"),
		extractFunction(dock, "makeRemoteControlDockResult"),
		extractFunction(dock, "executeRemoteControlDockRequest")
	].join("\n");
	let executions = 0;
	const execute = Function(
		"processInput",
		`var remoteControlDockResultCache = new Map();
		 var remoteControlDockActions = { nextInQueue: true, clearOverlay: true, nextPinned: true, getQueueSize: true, pin: true, unpin: true, clearDock: true, clear: true, clearAll: true };
		 var thisLabel = false;
		 ${source}; return executeRemoteControlDockRequest;`
	)(() => {
		executions += 1;
		return { queueLength: 2 };
	});

	const request = { action: "getQueueSize", protocol: 2, get: "queue-1" };
	const first = execute(request);
	const duplicate = execute(request);
	assert.equal(first.skip, false);
	assert.equal(first.result.ok, true);
	assert.equal(first.result.payload.queueLength, 2);
	assert.deepEqual(duplicate.result, first.result);
	assert.equal(executions, 1, "duplicate cross-transport delivery executed the Dock command twice");

	const backgroundOwned = execute({ action: "sendChat", protocol: 2, get: "chat-1", value: "hello" });
	assert.equal(backgroundOwned.skip, true);
	assert.equal(executions, 1);

	const legacy = execute({ action: "getQueueSize", get: "legacy-1" });
	assert.equal(legacy.skip, false);
	assert.deepEqual(legacy.result, { queueLength: 2 });
	assert.equal(executions, 2);
	for (const action of ["pin", "unpin", "clearDock", "clear", "clearAll"]) {
		const before = executions;
		const request = { action, protocol: 2, get: "duplicate-" + action, replyFormat: "commandResult" };
		const first = execute(request);
		assert.deepEqual(execute({ ...request, replyFormat: undefined }).result, first.result);
		assert.equal(executions, before + 1, action + " must execute only once across API and P2P");
	}

	const executeNamedDock = Function(
		"processInput",
		`var remoteControlDockResultCache = new Map();
		 var remoteControlDockActions = { nextInQueue: true, clearOverlay: true, nextPinned: true, getQueueSize: true, clearDock: true };
		 var thisLabel = "producer";
		 ${source}; return executeRemoteControlDockRequest;`
	)(request => {
		assert.equal(request.target, "producer", "a named Dock must not execute a default-target version 2 command");
		return true;
	});
	assert.equal(executeNamedDock(request).skip, true);
	assert.equal(executeNamedDock({ action: "clearDock", protocol: 2, get: "named-1" }).skip, true);
	assert.equal(executeNamedDock({ action: "clearDock", protocol: 2, get: "named-2", target: "producer" }).result.ok, true);
}

function testDockReplyFormats() {
	const dock = read("dock.html");
	const reply = Function(`${extractFunction(dock, "isVersionedRemoteControlRequest")}
		${extractFunction(dock, "buildRemoteControlDockReply")}; return buildRemoteControlDockReply;`)();
	const result = { ok: true, request: "clear-1", payload: { value: true } };
	const request = { action: "clearDock", protocol: 2, get: "clear-1", replyFormat: "commandResult" };
	assert.deepEqual(reply(request, result), { type: "commandResult", action: "clearDock", get: "clear-1", result });
	assert.deepEqual(reply({ ...request, replyFormat: undefined }, result), { callback: { get: "clear-1", result } }, "HTTP clients still require callback envelopes");
	assert.deepEqual(reply({ ...request, protocol: undefined }, result), { callback: { get: "clear-1", result } }, "legacy replies must remain unchanged");
}

async function testWebsocketDockFallback() {
	const background = read("background.js");
	const replies = [], timers = new Map();
	let timerId = 0, canSend = false;
	const context = vm.createContext({
		getStreamDeckRemoteControlRouter: () => router,
		pendingStreamDeckDockRequests: new Map(), MAX_PENDING_STREAM_DECK_DOCK_REQUESTS: 1,
		setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
		clearTimeout: id => timers.delete(id),
		sendStreamDeckDockRequestP2P: async () => canSend,
		sendStreamDeckCommandResult: (_socket, _request, result) => replies.push(result),
		sendDataP2P: packet => replies.push(packet.result)
	});
	vm.runInContext([
		"clearPendingStreamDeckDockRequest", "registerPendingStreamDeckDockRequest",
		"buildStreamDeckCallbackPacket", "buildStreamDeckCommandResultPacket",
		"sendStreamDeckDockResultToOrigin", "handleStreamDeckDockCallback", "routeStreamDeckRemoteRequest"
	].map(name => extractFunction(background, name)).join("\n"), context);
	const route = context.routeStreamDeckRemoteRequest;
	const websocket = { transport: "websocket", socket: {} };
	for (const action of ["pin", "unpin", "clearDock", "clear", "clearAll"]) {
		const result = await route({ action, protocol: 2, get: action }, websocket);
		assert.equal(result.kind, "deferred", "a WebSocket-only Dock must be allowed to answer " + action);
		assert.equal(context.pendingStreamDeckDockRequests.size, 0);
	}
	const request = { action: "clearDock", protocol: 2, get: "clear-1", replyFormat: "commandResult" };
	canSend = true;
	await route(request, websocket);
	const full = await route({ ...request, get: "clear-2" }, websocket);
	assert.equal(full.kind, "deferred", "a full P2P fallback queue must not reject a direct API command");
	Array.from(timers.values())[0]();
	assert.equal(context.pendingStreamDeckDockRequests.size, 0);
	assert.equal(replies.length, 0, "a missing fallback reply must not contradict a direct Dock result");

	await route(request, websocket);
	const dockResult = router.makeResponse(request, { value: true });
	assert.equal(context.handleStreamDeckDockCallback({ callback: { get: request.get, result: dockResult } }), true);
	assert.deepEqual(replies, [dockResult], "P2P-only Docks still answer WebSocket clients through the host");
	assert.equal(context.pendingStreamDeckDockRequests.size, 0);

	replies.length = 0;
	const peer = { transport: "webrtc", UUID: "test-peer" };
	await route(request, peer);
	Array.from(timers.values())[0]();
	assert.equal(replies[0].error.code, "TARGET_UNAVAILABLE", "P2P requests still report their missing owner");
	canSend = false;
	const missing = await route(request, peer);
	assert.equal(missing.result.error.code, "TARGET_UNAVAILABLE");
}

async function testVersionedRoutingOwnership() {
	const background = read("background.js");
	const source = extractFunction(background, "routeStreamDeckRemoteRequest");
	let backgroundCalls = 0;
	let dockSends = 0;
	const route = Function(
		"getStreamDeckRemoteControlRouter",
		"getStreamDeckCapabilities",
		"handleStreamDeckSsappRequest",
		"handleStreamDeckBackgroundRequest",
		"registerPendingStreamDeckDockRequest",
		"sendStreamDeckDockRequestP2P",
		"clearPendingStreamDeckDockRequest",
		`${source}; return routeStreamDeckRemoteRequest;`
	)(
		() => router,
		async () => router.buildCapabilities({ runtime: "web", hostInstanceId: "host-test" }),
		async (request) => router.makeResponse(request, { source: {} }),
		async (request) => {
			backgroundCalls += 1;
			return router.makeResponse(request, { timer: {} });
		},
		() => ({ ok: true, duplicate: false }),
		async () => {
			dockSends += 1;
			return true;
		},
		() => null
	);

	const timer = await route({ action: "starttimer", protocol: 2, get: "timer-1" }, { transport: "websocket" });
	assert.equal(timer.kind, "command");
	assert.equal(timer.result.ok, true);
	assert.equal(backgroundCalls, 1);

	const serverDock = await route({ action: "clearOverlay", protocol: 2, get: "dock-1" }, { transport: "websocket" });
	assert.equal(serverDock.kind, "deferred");
	assert.equal(dockSends, 0, "background should not duplicate a server-owned Dock command");

	const peerDock = await route({ action: "clearOverlay", protocol: 2, get: "dock-2" }, { transport: "webrtc", UUID: "mobile-peer" });
	assert.equal(peerDock.kind, "deferred");
	assert.equal(dockSends, 1);

	const capabilities = await route({ action: "getCapabilities", protocol: 2, get: "caps-1" }, { transport: "webrtc", UUID: "mobile-peer" });
	assert.equal(capabilities.kind, "capabilities");
	assert.equal(capabilities.result.ok, true);
	assert.equal(capabilities.result.payload.role, "social-stream-host");

	const missingCorrelation = await route({ action: "starttimer", protocol: 2 }, { transport: "webrtc", UUID: "mobile-peer" });
	assert.equal(missingCorrelation.kind, "command");
	assert.equal(missingCorrelation.result.ok, false);
	assert.equal(missingCorrelation.result.error.code, "MISSING_CORRELATION_ID");
}

Promise.resolve()
	.then(testBackgroundCommandHandler)
	.then(testSendChatRequiresDispatchCandidate)
	.then(testWebsocketMessageOriginForwarding)
	.then(testDockOwnerAndDeduplication)
	.then(testDockReplyFormats)
	.then(testWebsocketDockFallback)
	.then(testVersionedRoutingOwnership)
	.then(() => console.log("mobile remote-control contract tests passed"))
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
