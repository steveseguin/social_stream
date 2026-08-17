const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupSource = fs.readFileSync(path.resolve(__dirname, "..", "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.resolve(__dirname, "..", "popup.html"), "utf8");

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

const controlSource = extractFunction(popupSource, "isPopupSearchControl");
const isPopupSearchControl = Function(`${controlSource}\nreturn isPopupSearchControl;`)();

[
	"searchInput",
	"searchIcon",
	"popupSearchNoResults",
	"activeIcon",
	"languageIcon",
	"language-selector-container"
].forEach(id => {
	assert.equal(isPopupSearchControl({ id }), true, `${id} must remain visible while filtering`);
});
assert.equal(isPopupSearchControl({ id: "dock" }), false);
assert.equal(isPopupSearchControl(null), false);

const createIndexSource = extractFunction(popupSource, "createPopupSearchIndex");
assert.match(
	createIndexSource,
	/if \(isPopupSearchControl\(element\)\)\s*{\s*return;/,
	"Popup search controls must be excluded from the searchable top-level index"
);
assert.doesNotMatch(
	createIndexSource,
	/isPopupSearchNormallyHidden/,
	"Building the search index must not force computed-style reads across the popup"
);
assert.match(
	createIndexSource,
	/new Set\(rowElements\)/,
	"Nested search rows must be indexed without pairwise containment checks"
);

const applySearchSource = extractFunction(popupSource, "applyPopupSearchNow");
assert.doesNotMatch(
	applySearchSource,
	/openPopupSearchSections/,
	"Searching must not expand every settings section"
);
assert.match(
	applySearchSource,
	/openPopupSearchSection\(wrapper\)/,
	"Searching should expand only matching settings sections"
);
assert.doesNotMatch(
	applySearchSource,
	/setPopupSearchHidden\(rowRecord\.element/,
	"Searching must not hide every nonmatching option row individually"
);
assert.match(
	applySearchSource,
	/setPopupSearchMatch\(matchElement\)/,
	"Matching options should be highlighted within their visible section"
);
assert.match(
	popupSource,
	/applyPopupSearchNow\(value\);\s*\}, 200\);/,
	"Popup search must debounce typing long enough to avoid rerendering on every keystroke"
);

[
	["wrapper-global-mechanics-options", "Events &amp; Capture"],
	["wrapper-global-message-processing-options", "Message Processing"],
	["wrapper-global-connections-integrations-options", "Connections &amp; Integrations"]
].forEach(([id, label]) => {
	assert.match(popupHtml, new RegExp(`id="${id}"[\\s\\S]*?for="${id}"[\\s\\S]*?${label}`), `${label} section is missing`);
});

console.log("popup search tests passed");
