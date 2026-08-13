const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupSource = fs.readFileSync(path.resolve(__dirname, "..", "popup.js"), "utf8");

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

console.log("popup search tests passed");
