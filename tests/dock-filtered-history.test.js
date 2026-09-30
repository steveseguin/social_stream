const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
	extractFunction(dock, "isMembershipDonation"),
	extractFunction(dock, "shouldAutoQueueMessage"),
	"return shouldAutoQueueMessage;"
].join("\n");
function createAutoQueueMatcher(autoQueueDonations, autoQueueSuperChats, membershipsAsDonations = false) {
	return Function(
		"autoQueueDonations",
		"autoQueueSuperChats",
		"membershipsAsDonations",
		autoQueueSource
	)(autoQueueDonations, autoQueueSuperChats, membershipsAsDonations);
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

const membershipDonations = createAutoQueueMatcher(true, false, true);
assert.equal(membershipDonations({ event: "sponsorship", type: "youtube", membership: "MEMBERSHIP" }), true);
assert.equal(membershipDonations({ event: "giftpurchase", type: "youtube", membership: "gift_giver" }), true);
assert.equal(membershipDonations({ event: "membermilestone", type: "youtube", membership: "member_milestone" }), true);
assert.equal(membershipDonations({ event: "membershiprenewal", type: "youtube", membership: "MEMBERSHIP" }), true);
assert.equal(membershipDonations({ event: "resub", type: "twitch" }), true);
assert.equal(membershipDonations({ event: "new_subscriber", type: "kick" }), true);
assert.equal(membershipDonations({ event: "superchat", type: "youtube", hasDonation: "$5.00" }), true);
assert.equal(membershipDonations({ event: "giftredemption", type: "youtube", membership: "gift_recipient" }), false, "gift recipients must not count as donations");
assert.equal(membershipDonations({ type: "youtube", membership: "MEMBERSHIP", chatmessage: "hi" }), false, "member chat is not a membership event");
assert.equal(createAutoQueueMatcher(true, false, false)({ event: "sponsorship", type: "youtube" }), false, "memberships stay non-donations unless the option is on");
assert.equal(createAutoQueueMatcher(false, false, true)({ event: "sponsorship", type: "youtube" }), false, "counting memberships does not turn on auto-queue by itself");
assert.equal(createAutoQueueMatcher(false, true, true)({ event: "sponsorship", type: "youtube" }), false, "Super Chat-only queueing still means Super Chats only");
assert.match(popup, /data-param1="membershipsasdonations"/, "Dock settings should expose the count-memberships-as-donations toggle");
assert.match(dock, /skipDonations && \(data\.hasDonation \|\| data\.donation \|\| isMembershipDonation\(data\)\)/);
assert.match(dock, /autoshowdonos && \(data\.hasDonation \|\| isMembershipDonation\(data\)\)/);
assert.match(dock, /autoPinDonations && \(data\.hasDonation \|\| isMembershipDonation\(data\)\)/);
assert.match(dock, /var hasDonation = !!\(data\.donation \|\| data\.hasDonation \|\| isMembershipDonation\(data\)\);/);
assert.match(dock, /else if \(!isMembershipDonation\(data\)\) \{\s*node\.classList\.add\("noDono"\)/);

const isBufferedLiveMessage = Function(
	"historyMissedLiveBuffer",
	[extractFunction(dock, "isBufferedLiveMessage"), "return isBufferedLiveMessage;"].join("\n")
)([{ id: 101 }, { id: 102, mid: 202 }]);
assert.equal(isBufferedLiveMessage(101), true);
assert.equal(isBufferedLiveMessage("202"), true, "history rows match buffered rows by their original id");
assert.equal(isBufferedLiveMessage(303), false);
assert.equal(isBufferedLiveMessage(undefined), false);
assert.match(extractFunction(dock, "flushMissedLiveBuffer"), /deferredLive: true/, "rows held back by history browsing must keep queue/pin capture");
assert.match(dock, /if \(!suppressLiveSideEffects \|\| deferredLiveMessage\) \{/, "deferred live rows should reach the queue/pin block");

console.log("dock filtered history tests passed");
