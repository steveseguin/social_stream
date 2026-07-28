const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const youtubePath = path.join(root, "sources", "websocket", "youtube.html");
const source = fs.readFileSync(youtubePath, "utf8");

function extractBetween(startToken, endToken) {
	const start = source.indexOf(startToken);
	const end = source.indexOf(endToken, start);
	assert.ok(start >= 0, "missing start token: " + startToken);
	assert.ok(end > start, "missing end token: " + endToken);
	return source.slice(start, end);
}

let authOnlyMode = false;
let fetchCalls = [];
let responseItems = [];

class MemoryStorage {
	constructor() {
		this.values = new Map();
	}

	get length() {
		return this.values.size;
	}

	key(index) {
		return Array.from(this.values.keys())[index] || null;
	}

	getItem(key) {
		return this.values.has(String(key)) ? this.values.get(String(key)) : null;
	}

	setItem(key, value) {
		this.values.set(String(key), String(value));
	}

	removeItem(key) {
		this.values.delete(String(key));
	}

	clear() {
		this.values.clear();
	}
}

const sharedStorage = new MemoryStorage();
let intervalId = 0;
const helperSource = extractBetween(
	"function normalizeYouTubeSignInTargetValue",
	"function verifyAndUseToken"
);

function createContext(instanceId) {
	const context = {
		console,
		localStorage: sharedStorage,
		isYouTubeAuthOnlyMode() {
			return authOnlyMode;
		},
		async fetchWithTimeout(url, timeout, headers) {
			fetchCalls.push({ url, timeout, headers });
			return {
				async json() {
					return { items: responseItems };
				}
			};
		},
		setTimeout(callback) {
			return setTimeout(callback, 0);
		},
		setInterval() {
			intervalId += 1;
			return intervalId;
		},
		clearInterval() {}
	};
	vm.createContext(context);
	vm.runInContext(
		[
			"var youtubeInitialTargetResolutionPending = true;",
			"var ownBroadcastLookupChannelId = '';",
			"var ownBroadcastLookupPromise = null;",
			"var activeYouTubeBroadcastMonitorLease = null;",
			"var youtubeBroadcastMonitorHeartbeatInterval = null;",
			"const YT_BROADCAST_MONITOR_STORAGE_PREFIX = 'youtubeBroadcastMonitorLease.v1.';",
			"const YT_BROADCAST_MONITOR_TTL_MS = 120000;",
			"const YT_BROADCAST_MONITOR_HEARTBEAT_MS = 30000;",
			"const YT_BROADCAST_MONITOR_CLAIM_SETTLE_MS = 0;",
			"const YT_BROADCAST_MONITOR_INSTANCE_ID = " + JSON.stringify(instanceId) + ";",
			helperSource
		].join("\n"),
		context
	);
	return context;
}

const context = createContext("monitor-a");

function assertTarget(actual, expected) {
	assert.strictEqual(actual.type, expected.type);
	assert.strictEqual(actual.source, expected.source);
	assert.strictEqual(actual.value, expected.value);
}

assertTarget(
	context.resolveYouTubeSignInTarget(" direct-video ", "url-channel", "saved-video", "saved-channel", false),
	{ type: "video", source: "url", value: "direct-video" }
);
assertTarget(
	context.resolveYouTubeSignInTarget("", " url-channel ", "saved-video", "saved-channel", false),
	{ type: "channel", source: "url", value: "url-channel" }
);
assertTarget(
	context.resolveYouTubeSignInTarget("", "", " saved-video ", "saved-channel", false),
	{ type: "video", source: "saved", value: "saved-video" }
);
assertTarget(
	context.resolveYouTubeSignInTarget("", "", "", " saved-channel ", false),
	{ type: "channel", source: "saved", value: "saved-channel" }
);
assertTarget(
	context.resolveYouTubeSignInTarget("", "", "", "", false),
	{ type: "own", source: "sign-in", value: "" }
);
assertTarget(
	context.resolveYouTubeSignInTarget("direct-video", "", "", "", true),
	{ type: "none", source: "auth-only", value: "" }
);

const now = Date.parse("2026-07-28T12:00:00Z");
const selectedLive = context.selectOwnYouTubeBroadcast([
	{
		id: "other-live",
		snippet: {
			channelId: "UC-other",
			liveChatId: "chat-other",
			actualStartTime: "2026-07-28T11:30:00Z"
		},
		status: { lifeCycleStatus: "live" }
	},
	{
		id: "own-upcoming",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-28T12:30:00Z"
		},
		status: { lifeCycleStatus: "ready" }
	},
	{
		id: "own-live-no-chat",
		snippet: {
			channelId: "UC-own",
			actualStartTime: "2026-07-28T11:45:00Z"
		},
		status: { lifeCycleStatus: "live" }
	},
	{
		id: "own-live-old",
		snippet: {
			channelId: "UC-own",
			liveChatId: "chat-old",
			actualStartTime: "2026-07-28T10:00:00Z"
		},
		status: { lifeCycleStatus: "live" }
	},
	{
		id: "own-live-current",
		snippet: {
			channelId: "UC-own",
			liveChatId: "chat-current",
			actualStartTime: "2026-07-28T11:00:00Z"
		},
		status: { lifeCycleStatus: "live" }
	}
], "UC-own", now);
assert.strictEqual(selectedLive.id, "own-live-current", "a usable current live stream should win");
const selectedUnmonitoredLive = context.selectOwnYouTubeBroadcast([
	{
		id: "already-monitored",
		snippet: {
			channelId: "UC-own",
			liveChatId: "chat-first",
			actualStartTime: "2026-07-28T11:30:00Z"
		},
		status: { lifeCycleStatus: "live" }
	},
	{
		id: "available-live",
		snippet: {
			channelId: "UC-own",
			liveChatId: "chat-second",
			actualStartTime: "2026-07-28T11:00:00Z"
		},
		status: { lifeCycleStatus: "live" }
	}
], "UC-own", now, { "already-monitored": true });
assert.strictEqual(selectedUnmonitoredLive.id, "available-live", "leased streams must be skipped");

const selectedUpcoming = context.selectOwnYouTubeBroadcast([
	{
		id: "completed",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-28T12:10:00Z"
		},
		status: { lifeCycleStatus: "complete" }
	},
	{
		id: "other-upcoming",
		snippet: {
			channelId: "UC-other",
			scheduledStartTime: "2026-07-28T12:15:00Z"
		},
		status: { lifeCycleStatus: "ready" }
	},
	{
		id: "later-upcoming",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-28T14:00:00Z"
		},
		status: { lifeCycleStatus: "testing" }
	},
	{
		id: "nearest-upcoming",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-28T13:00:00Z"
		},
		status: { lifeCycleStatus: "ready" }
	},
	{
		id: "past-upcoming",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-27T12:00:00Z"
		},
		status: { lifeCycleStatus: "created" }
	}
], "UC-own", now);
assert.strictEqual(selectedUpcoming.id, "nearest-upcoming", "the nearest future stream should win");

const selectedPastUpcoming = context.selectOwnYouTubeBroadcast([
	{
		id: "older-past",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-25T12:00:00Z"
		},
		status: { lifeCycleStatus: "ready" }
	},
	{
		id: "recent-past",
		snippet: {
			channelId: "UC-own",
			scheduledStartTime: "2026-07-28T11:00:00Z"
		},
		status: { lifeCycleStatus: "ready" }
	}
], "UC-own", now);
assert.strictEqual(selectedPastUpcoming.id, "recent-past", "the least-stale missed start should win");
assert.strictEqual(context.selectOwnYouTubeBroadcast([], "UC-own", now), null);

assert.strictEqual(context.consumeYouTubeInitialTargetResolution(), true);
assert.strictEqual(context.consumeYouTubeInitialTargetResolution(), false);
context.resetYouTubeSignInTargetResolution();
assert.strictEqual(context.consumeYouTubeInitialTargetResolution(), true);

(async () => {
	context.resetYouTubeSignInTargetResolution();
	responseItems = [
		{
			id: "auto-live",
			snippet: {
				channelId: "UC-own",
				liveChatId: "chat-auto",
				actualStartTime: "2026-07-28T11:00:00Z"
			},
			status: { lifeCycleStatus: "live" }
		}
	];
	fetchCalls = [];
	const first = context.getOwnYouTubeBroadcastCandidatesOnce("token", "UC-own");
	const second = context.getOwnYouTubeBroadcastCandidatesOnce("token", "UC-own");
	const results = await Promise.all([first, second]);
	assert.strictEqual(fetchCalls.length, 1, "own broadcasts must only be requested once per signed-in channel");
	assert.strictEqual(results[0][0].id, "auto-live");
	assert.strictEqual(results[1][0].id, "auto-live");
	assert.ok(fetchCalls[0].url.includes("/liveBroadcasts?"), "must use the low-cost liveBroadcasts endpoint");
	assert.ok(fetchCalls[0].url.includes("mine=true"), "must only request the signed-in account's broadcasts");
	assert.ok(fetchCalls[0].url.includes("broadcastType=all"), "persistent broadcasts must remain eligible");
	assert.ok(fetchCalls[0].url.includes("maxResults=50"), "the one request must not depend on pagination");
	assert.ok(!fetchCalls[0].url.includes("/search?"), "automatic discovery must not use search.list");
	assert.strictEqual(fetchCalls[0].timeout, 5000);
	assert.strictEqual(fetchCalls[0].headers.Authorization, "Bearer token");

	authOnlyMode = true;
	context.resetYouTubeSignInTargetResolution();
	const authOnlyCandidates = await context.getOwnYouTubeBroadcastCandidatesOnce("token", "UC-own");
	assert.strictEqual(fetchCalls.length, 1, "auth-only sign-in must not discover a broadcast");
	assert.strictEqual(authOnlyCandidates.length, 0);

	authOnlyMode = false;
	context.resetYouTubeSignInTargetResolution();
	responseItems = [
		{
			id: "wrong-channel",
			snippet: {
				channelId: "UC-other",
				liveChatId: "chat-other"
			},
			status: { lifeCycleStatus: "live" }
		}
	];
	const wrongChannelCandidates = await context.getOwnYouTubeBroadcastCandidatesOnce("token", "UC-own");
	assert.strictEqual(
		context.selectOwnYouTubeBroadcast(wrongChannelCandidates, "UC-own"),
		null,
		"a broadcast from another channel must never be selected"
	);

	sharedStorage.clear();
	const pageB = createContext("monitor-b");
	assert.strictEqual(
		context.activateYouTubeBroadcastMonitorLease("UC-account-a", "shared-video", "explicit"),
		true
	);
	assert.strictEqual(
		pageB.getYouTubeBroadcastsMonitoredByOtherPages("UC-account-a")["shared-video"],
		true,
		"another page for the same account must see the active video"
	);
	const availableForPageB = await pageB.selectAvailableOwnYouTubeBroadcast([
		{
			id: "shared-video",
			snippet: {
				channelId: "UC-account-a",
				liveChatId: "chat-shared",
				actualStartTime: "2026-07-28T11:30:00Z"
			},
			status: { lifeCycleStatus: "live" }
		},
		{
			id: "second-video",
			snippet: {
				channelId: "UC-account-a",
				liveChatId: "chat-second",
				actualStartTime: "2026-07-28T11:00:00Z"
			},
			status: { lifeCycleStatus: "live" }
		}
	], "UC-account-a");
	assert.strictEqual(availableForPageB.id, "second-video", "the next page should claim the next available live stream");
	pageB.releaseYouTubeBroadcastMonitorLease();
	assert.strictEqual(
		await pageB.tryClaimYouTubeBroadcastForAutomaticMonitoring("UC-account-a", "shared-video"),
		false,
		"the same account must not automatically claim an already monitored video"
	);
	assert.strictEqual(
		await pageB.tryClaimYouTubeBroadcastForAutomaticMonitoring("UC-account-b", "shared-video"),
		true,
		"a different signed-in account may monitor the same video"
	);
	pageB.releaseYouTubeBroadcastMonitorLease();
	context.releaseYouTubeBroadcastMonitorLease();

	const racePageA = createContext("monitor-race-a");
	const racePageB = createContext("monitor-race-b");
	const raceResults = await Promise.all([
		racePageA.tryClaimYouTubeBroadcastForAutomaticMonitoring("UC-race", "race-video"),
		racePageB.tryClaimYouTubeBroadcastForAutomaticMonitoring("UC-race", "race-video")
	]);
	assert.strictEqual(
		raceResults.filter(Boolean).length,
		1,
		"simultaneous pages must elect only one automatic monitor"
	);
	racePageA.releaseYouTubeBroadcastMonitorLease();
	racePageB.releaseYouTubeBroadcastMonitorLease();

	const staleKey = "youtubeBroadcastMonitorLease.v1.stale";
	sharedStorage.setItem(staleKey, JSON.stringify({
		accountId: "UC-stale",
		videoId: "stale-video",
		monitorId: "stale-monitor",
		mode: "auto",
		state: "active",
		expiresAt: Date.now() - 1
	}));
	context.readActiveYouTubeBroadcastMonitorLeases("UC-stale");
	assert.strictEqual(sharedStorage.getItem(staleKey), null, "expired monitor leases must be cleaned up");

	assert.ok(
		source.includes("const allowOwnBroadcastLookup = consumeYouTubeInitialTargetResolution();"),
		"the page must consume auto-discovery during initial sign-in resolution"
	);
	assert.ok(
		source.includes("target.type === 'own' && allowOwnBroadcastLookup"),
		"own-account discovery must be gated behind the initial no-target path"
	);
	assert.ok(
		source.includes("clearPolling({ preserveBroadcastMonitorLease: preserveBroadcastMonitorLease });"),
		"automatic claims must survive the connector's initial cleanup"
	);
	assert.ok(
		source.includes("activateYouTubeBroadcastMonitorLease(authenticatedChannelId, currentStream.id, monitorMode);"),
		"successful explicit and automatic connections must advertise their active video"
	);

	console.log("YouTube own-broadcast auto-connect tests passed.");
})().catch(function(error) {
	console.error(error);
	process.exitCode = 1;
});
