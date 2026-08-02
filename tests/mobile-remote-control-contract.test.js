const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
		 var remoteControlDockActions = { nextInQueue: true, clearOverlay: true, nextPinned: true, getQueueSize: true };
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

	const executeNamedDock = Function(
		"processInput",
		`var remoteControlDockResultCache = new Map();
		 var remoteControlDockActions = { nextInQueue: true, clearOverlay: true, nextPinned: true, getQueueSize: true };
		 var thisLabel = "producer";
		 ${source}; return executeRemoteControlDockRequest;`
	)(() => {
		throw new Error("a named Dock must not execute a default-target version 2 command");
	});
	assert.equal(executeNamedDock(request).skip, true);
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
	.then(testDockOwnerAndDeduplication)
	.then(testVersionedRoutingOwnership)
	.then(() => console.log("mobile remote-control contract tests passed"))
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
