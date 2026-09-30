const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dock = fs.readFileSync(path.resolve(__dirname, "..", "dock.html"), "utf8");
const popup = fs.readFileSync(path.resolve(__dirname, "..", "popup.html"), "utf8");

function extractFunction(source, name) {
	const start = source.indexOf(`function ${name}(`);
	assert.ok(start >= 0, `${name} was not found`);
	const bodyStart = source.indexOf("{", start);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index += 1) {
		if (source[index] === "{") depth += 1;
		if (source[index] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, index + 1);
		}
	}
	throw new Error(`${name} did not have a complete body`);
}

function node(id, hidden) {
	return {
		id,
		hidden,
		classList: { contains: className => className === "hidden" && hidden }
	};
}

const pruningSource = [
	extractFunction(dock, "isDockMessageVisible"),
	extractFunction(dock, "selectDockNodesForPruning"),
	"return selectDockNodesForPruning;"
].join("\n");
const selectDockNodesForPruning = Function(
	"window",
	pruningSource
)({ getComputedStyle: item => ({ display: item.hidden ? "none" : "block", visibility: "visible" }) });

const hiddenRows = Array.from({ length: 250 }, (_, index) => node(`hidden-${index}`, true));
const donationRows = Array.from({ length: 12 }, (_, index) => node(`donation-${index}`, false));
const historyRemovals = selectDockNodesForPruning(hiddenRows.concat(donationRows), 200, true);
assert.equal(historyRemovals.length, 50);
assert.ok(historyRemovals.every(item => item.hidden), "filtered history must prune hidden rows before visible donations");

const visibleRows = Array.from({ length: 205 }, (_, index) => node(`visible-${index}`, false));
const visibleHistoryRemovals = selectDockNodesForPruning(visibleRows, 200, true);
assert.deepEqual(visibleHistoryRemovals.map(item => item.id), ["visible-200", "visible-201", "visible-202", "visible-203", "visible-204"]);

const liveRemovals = selectDockNodesForPruning(hiddenRows.slice(0, 5).concat(donationRows.slice(0, 5)), 3, false);
assert.deepEqual(liveRemovals.map(item => item.id), ["hidden-0", "hidden-1", "donation-0", "donation-1"]);

assert.match(dock, /scrollDirection > 0 && isNearHistoryLiveEdge\(\)/, "history should only return live after downward scrolling");
assert.match(dock, /historyVisibleRowsLoaded < historyVisibleLoadTarget/, "filtered history should page until enough visible rows load");

const historyEntrySource = [
	extractFunction(dock, "shouldEnterHistoryBrowsing"),
	"return shouldEnterHistoryBrowsing;"
].join("\n");
const shouldEnterHistoryBrowsing = Function(historyEntrySource)();

assert.equal(shouldEnterHistoryBrowsing(false, 1, 20, true), false, "downward auto-scroll near the top must stay live");
assert.equal(shouldEnterHistoryBrowsing(false, 0, 0, true), false, "layout scroll events must stay live");
assert.equal(shouldEnterHistoryBrowsing(false, -1, 20, true), true, "upward scrolling should enter history");
assert.equal(shouldEnterHistoryBrowsing(true, -1, 0, false), true, "an upward wheel at the top should load history");
assert.equal(shouldEnterHistoryBrowsing(false, -1, 50, true), false, "history should only activate near the top");

const autoQueueSource = [
	extractFunction(dock, "shouldAutoQueueMessage"),
	"return shouldAutoQueueMessage;"
].join("\n");
function createAutoQueueMatcher(autoQueueDonations, autoQueueSuperChats, autoQueueMemberships = false) {
	return Function(
		"autoQueueDonations",
		"autoQueueSuperChats",
		"autoQueueMemberships",
		autoQueueSource
	)(autoQueueDonations, autoQueueSuperChats, autoQueueMemberships);
}

const superChatOnly = createAutoQueueMatcher(false, true);
assert.equal(superChatOnly({ event: "superchat", type: "youtube", hasDonation: "$5.00" }), true);
assert.equal(superChatOnly({ event: "SUPERCHAT", type: "youtubeshorts", hasDonation: "$10.00" }), true);
assert.equal(superChatOnly({ event: "supersticker", type: "youtube", hasDonation: "$5.00" }), false);
assert.equal(superChatOnly({ event: "donation", type: "kick", hasDonation: "$5.00" }), false);
assert.equal(superChatOnly({ type: "youtube", hasDonation: "$5.00" }), false);

const allDonations = createAutoQueueMatcher(true, false);
assert.equal(allDonations({ event: "superchat", type: "youtube", hasDonation: "$5.00" }), true);
assert.equal(allDonations({ event: "donation", type: "kick", donation: "$5.00" }), true);
assert.equal(allDonations({ event: "superchat", type: "youtube" }), false);

const superChatOverride = createAutoQueueMatcher(true, true);
assert.equal(superChatOverride({ event: "superchat", type: "youtube", hasDonation: "$5.00" }), true);
assert.equal(superChatOverride({ event: "donation", type: "kick", hasDonation: "$5.00" }), false);
assert.match(popup, /data-param1="autoqueuesuperchats"/, "Dock settings should expose the Super Chat-only queue toggle");

const membershipEvents = ["sponsorship", "resub", "membermilestone", "membershiprenewal", "giftpurchase", "giftredemption"];
for (const donations of [false, true]) {
	for (const superChats of [false, true]) {
		const disabled = createAutoQueueMatcher(donations, superChats);
		const enabled = createAutoQueueMatcher(donations, superChats, true);
		for (const type of ["youtube", "youtubeshorts"]) {
			for (const event of membershipEvents) {
				const message = { type, event, membership: "MEMBERSHIP", chatmessage: "Membership alert" };
				assert.equal(disabled(message), false, "Membership alerts must be opt-in");
				assert.equal(enabled(message), true, `${type} ${event} should queue with memberships enabled`);
				assert.equal(message.hasDonation, undefined, "Queueing must not assign a donation amount");
			}
		}
		assert.equal(enabled({ type: "youtube", membership: "MEMBERSHIP", member: true, chatmessage: "Hello" }), false);
		assert.equal(enabled({ type: "twitch", event: "resub", membership: "SUBSCRIBER" }), false);
		assert.equal(enabled({ type: "youtube", event: "redirect", membership: "REDIRECT" }), false);
		assert.equal(enabled({ type: "youtube", event: "superchat", hasDonation: "$5" }), donations || superChats);
		assert.equal(enabled({ type: "youtube", event: "supersticker", hasDonation: "$5" }), donations && !superChats);
	}
}
assert.equal(createAutoQueueMatcher(false, false, true)({ type: "youtube", event: "SPONSORSHIP" }), true);
assert.equal(createAutoQueueMatcher(false, false, true)(null), false);
assert.match(popup, /data-param1="autoqueuememberships"[^>]*aria-label="Auto-queue YouTube membership alerts"/);

// Exercise the production buffer/flush and queue helpers; stub only row rendering and the DOM.
const rendered = new Map();
const replayOptions = [];
const runtime = {
	autoQueueDonations: true,
	autoQueueSuperChats: false,
	autoQueueMemberships: true,
	autoQueueQuestions: true,
	selfQueue: ["!queue"],
	selectedQueue: [],
	historyBrowsing: true,
	historyReturnSyncPending: false,
	historyMissedLiveBuffer: [],
	applyHiddenState() {},
	updateQueueButton() {},
	cleanUpOldNodes() {},
	jumptoBottom2() {},
	dataAttributeSelector: (attribute, id) => String(id),
	document: { querySelector: id => rendered.get(id) || null },
	processData({ contents }, options) {
		replayOptions.push(options);
		if (contents.filtered) return false;
		return renderRow(contents);
	}
};
function renderRow(data) {
	const classes = new Set();
	const row = {
		rawContents: data,
		children: [{ dataset: {} }],
		classList: { contains: name => classes.has(name), add: name => classes.add(name) }
	};
	if (data.id) rendered.set(String(data.id), row);
	return row;
}
vm.createContext(runtime);
vm.runInContext([
	extractFunction(dock, "shouldAutoQueueMessage"),
	extractFunction(dock, "isQueueRequested"),
	extractFunction(dock, "queueMessageIfRequested"),
	extractFunction(dock, "bufferMissedLiveMessage"),
	extractFunction(dock, "flushMissedLiveBuffer")
].join("\n"), runtime);

const liveDonation = { id: "live", type: "youtube", event: "superchat", hasDonation: "$5" };
const liveRow = renderRow(liveDonation);
runtime.queueMessageIfRequested(liveRow, liveDonation);
assert.equal(runtime.selectedQueue.length, 1);
runtime.queueMessageIfRequested(liveRow, liveDonation);
assert.equal(runtime.selectedQueue.length, 1, "Already queued rows must not queue twice");

const deferred = { id: "deferred", type: "youtube", event: "superchat", hasDonation: "$10" };
const synced = { id: "synced", type: "youtube", event: "sponsorship", membership: "new_sponsor" };
runtime.bufferMissedLiveMessage(deferred);
runtime.bufferMissedLiveMessage(synced);
runtime.bufferMissedLiveMessage({ id: "filtered", type: "youtube", hasDonation: "$5", filtered: true });
runtime.bufferMissedLiveMessage({ id: "member-chat", type: "youtube", membership: "MEMBERSHIP", chatmessage: "Hello" });
runtime.flushMissedLiveBuffer();
assert.equal(replayOptions.length, 0, "Browsing history must defer the flush");
runtime.historyBrowsing = false;
runtime.historyReturnSyncPending = true;
runtime.flushMissedLiveBuffer();
assert.equal(replayOptions.length, 0, "History synchronization must finish before the flush");

// The recent-history response can render a buffered live message before the buffer flushes.
const syncedRow = renderRow(synced);
const oldRow = renderRow({ id: "old", type: "youtube", event: "superchat", hasDonation: "$20" });
runtime.historyReturnSyncPending = false;
runtime.flushMissedLiveBuffer();
assert.deepEqual(runtime.selectedQueue.map(row => row.rawContents.id), ["live", "deferred", "synced"]);
assert.equal(runtime.selectedQueue[2], syncedRow, "Use the row already rendered by recent history");
assert.equal(oldRow.classList.contains("queued"), false, "Older history must not be auto-queued");
assert.equal(rendered.has("filtered"), false, "Filtered messages must not be restored for queueing");
assert.equal(runtime.historyMissedLiveBuffer.length, 0);
assert.equal(replayOptions.length, 3, "Existing history rows must not be rendered again");
replayOptions.forEach(options => {
	assert.equal(options.reloaded, true);
	assert.equal(options.suppressLiveSideEffects, true, "Queue catch-up must not replay TTS, pinning, or auto-feature actions");
	assert.equal(options.skipHistoryDeferral, true);
});
runtime.flushMissedLiveBuffer();
assert.equal(runtime.selectedQueue.length, 3, "Repeated flushes must not duplicate queue entries");
runtime.bufferMissedLiveMessage(synced);
runtime.flushMissedLiveBuffer();
assert.equal(runtime.selectedQueue.length, 3, "A repeated buffered message must not duplicate an existing queued row");

for (const data of [
	{ id: "explicit", queueme: true },
	{ id: "command", chatmessage: "please !queue me" },
	{ id: "question", question: true },
	{ type: "youtube", event: "giftpurchase" }
]) {
	runtime.bufferMissedLiveMessage(data);
}
runtime.flushMissedLiveBuffer();
assert.equal(runtime.selectedQueue.length, 7, "Catch-up must honor explicit, command, question, and ID-less membership queueing");
runtime.selectedQueue.forEach((row, index) => assert.equal(row.children[0].dataset.qid, index + 1));

runtime.historyBrowsing = true;
runtime.selectedQueue = [];
const protectedMessages = [
	{ id: "overflow-superchat", type: "youtube", event: "superchat", hasDonation: "$5" },
	{ id: "overflow-membership", type: "youtube", event: "sponsorship" },
	{ id: "overflow-explicit", queueme: true },
	{ id: "overflow-command", chatmessage: "!queue Hello" },
	{ id: "overflow-question", question: true }
];
protectedMessages.forEach(message => runtime.bufferMissedLiveMessage(message));
for (let index = 0; index < 600; index++) {
	runtime.bufferMissedLiveMessage({ id: "overflow-chat-" + index, chatmessage: "Hello" });
}
assert.equal(runtime.historyMissedLiveBuffer.length, 500, "Ordinary traffic must still be capped");
assert.deepEqual(Array.from(runtime.historyMissedLiveBuffer.slice(0, 5), message => message.id), protectedMessages.map(message => message.id));
assert.equal(runtime.historyMissedLiveBuffer[5].id, "overflow-chat-105", "Evict the oldest ordinary messages first");
runtime.historyBrowsing = false;
runtime.flushMissedLiveBuffer();
assert.deepEqual(runtime.selectedQueue.map(row => row.rawContents.id), protectedMessages.map(message => message.id), "Overflow must preserve queued messages and their arrival order");

for (let index = 0; index < 501; index++) {
	runtime.bufferMissedLiveMessage({ id: "paid-only-" + index, type: "youtube", event: "superchat", hasDonation: "$5" });
}
assert.equal(runtime.historyMissedLiveBuffer.length, 501, "Queue entries must survive even when all buffered messages are eligible");
runtime.bufferMissedLiveMessage({ id: "ordinary-after-paid", chatmessage: "Hello" });
assert.equal(runtime.historyMissedLiveBuffer.length, 501);
assert.equal(runtime.historyMissedLiveBuffer[500].id, "paid-only-500", "An ordinary arrival must not evict a queue entry");
runtime.historyMissedLiveBuffer = [];

runtime.autoQueueDonations = false;
runtime.autoQueueMemberships = false;
runtime.autoQueueQuestions = false;
runtime.selfQueue = false;
runtime.bufferMissedLiveMessage({ id: "disabled-membership", type: "youtube", event: "sponsorship" });
for (let index = 0; index < 500; index++) {
	runtime.bufferMissedLiveMessage({ id: "ordinary-" + index, chatmessage: "Hello" });
}
assert.equal(runtime.historyMissedLiveBuffer.length, 500);
assert.equal(runtime.historyMissedLiveBuffer[0].id, "ordinary-0", "Disabled queue settings must retain normal history eviction");

console.log("dock filtered history tests passed");
