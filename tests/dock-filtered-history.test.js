const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dock = fs.readFileSync(path.resolve(__dirname, "..", "dock.html"), "utf8");

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

console.log("dock filtered history tests passed");
