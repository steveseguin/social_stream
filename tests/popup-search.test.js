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
	"popupSearchToolbar",
	"popupSearchNoResults",
	"popupSearchResults",
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
assert.match(
	createIndexSource,
	/text: getPopupSearchText\(row\)/,
	"Grouped rows must retain their own searchable controls"
);

const applySearchSource = extractFunction(popupSource, "applyPopupSearchNow");
assert.doesNotMatch(
	applySearchSource,
	/openPopupSearchSection|setPopupSearchHidden|setPopupSearchMatch/,
	"Typing in search must not mutate the live settings UI"
);
assert.match(
	applySearchSource,
	/renderPopupSearchResults\(matches, matchedElements\.size\)/,
	"Search matches must render in the isolated results panel"
);
assert.doesNotMatch(
	applySearchSource,
	/!rowRecord\.containerOnly/,
	"Controls nested directly in grouped rows must remain searchable"
);
assert.match(
	popupSource,
	/applyPopupSearchNow\(value\);\s*\}, 200\);/,
	"Popup search must debounce typing long enough to avoid rerendering on every keystroke"
);
assert.match(popupHtml, /id="popupSearchResults"/, "Popup search results panel is missing");
assert.match(popupSource, /addPopupSearchSelectOptions\(parts, element\)/, "Dropdown choices must be searchable");
assert.match(popupSource, /data-\(\?:setting/, "Setting keys must be searchable as a fallback");

[
	["wrapper-global-mechanics-options", "Events &amp; Capture"],
	["wrapper-global-message-processing-options", "Message Processing"],
	["wrapper-global-connections-integrations-options", "Connections &amp; Integrations"]
].forEach(([id, label]) => {
	assert.match(popupHtml, new RegExp(`id="${id}"[\\s\\S]*?for="${id}"[\\s\\S]*?${label}`), `${label} section is missing`);
});

console.log("popup search tests passed");

const searchHelpers = ["normalizePopupSearchText", "getPopupSearchTerms", "addPopupSearchSynonyms", "popupSearchEscapeRegex", "popupSearchTextHasTerm", "popupSearchTextMatches"].map(name => extractFunction(popupSource, name)).join("\n");
const matchesSearch = Function(`${searchHelpers}
    return function(text, query) {
        const parts = [normalizePopupSearchText(text)];
        addPopupSearchSynonyms(parts);
        return popupSearchTextMatches(parts.join(' '), getPopupSearchTerms(query));
    };
`)();
[
    ["Enable TTS", "read chat aloud"],
    ["Font size", "bigger text"],
    ["Background opacity", "see through"],
    ["Profanity filter", "swearing"],
    ["User blacklist", "blocklist"],
    ["Show avatar", "profile picture"],
    ["Show timestamp", "message time"]
].forEach(([text, query]) => assert.equal(matchesSearch(text, query), true, query));
assert.equal(matchesSearch("Message delay", "read aloud"), false);
assert.equal(matchesSearch("Font size", "third party emotes"), false);
[
    ["bttv", "Better Twitch TV"],
    ["bttv", "BetterTTV"],
    ["seventv", "Seven TV"],
    ["seventv", "7 TV"],
    ["ffz", "FrankerFaceZ"],
    ["ffz", "Franker Face Z"]
].forEach(([setting, query]) => {
    const input = popupHtml.indexOf(`data-setting="${setting}"`);
    const row = popupHtml.slice(popupHtml.lastIndexOf('<div ', input), input);
    const keywords = row.match(/data-keywords="([^"]+)"/)[1];
    assert.equal(matchesSearch(keywords, query), true, query);
    assert.equal(matchesSearch(keywords, "third-party emotes"), true);
});
console.log("popup search keyword tests passed");
