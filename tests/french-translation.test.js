const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const processJs = fs.readFileSync(path.join(repoRoot, "translations", "process.js"), "utf8");
const welcomeHtml = fs.readFileSync(path.join(repoRoot, "docs", "ssapp.html"), "utf8");
const english = JSON.parse(fs.readFileSync(path.join(repoRoot, "translations", "en-us.json"), "utf8"));
const frenchSource = fs.readFileSync(path.join(repoRoot, "translations", "fr.json"), "utf8");
const french = JSON.parse(frenchSource);

assert.ok(popupHtml.includes('<option value="fr" title="French">Français</option>'));
assert.ok(popupJs.includes('if (lower.startsWith("fr")) return "fr";'));
assert.ok(processJs.includes('    "fr",'));
assert.ok(welcomeHtml.includes('"fr": {'));
assert.ok(welcomeHtml.includes('if (lower.indexOf("fr") === 0) return "fr";'));

let currentSection = "";
const sectionKeys = new Map();
for (const line of frenchSource.split(/\r?\n/)) {
	const sectionMatch = line.match(/^  "([^"]+)": \{$/);
	if (sectionMatch) {
		currentSection = sectionMatch[1];
		sectionKeys.set(currentSection, new Set());
		continue;
	}
	const keyMatch = currentSection && line.match(/^    "([^"]+)":/);
	if (!keyMatch) continue;
	assert.ok(!sectionKeys.get(currentSection).has(keyMatch[1]), `Duplicate French key: ${currentSection}.${keyMatch[1]}`);
	sectionKeys.get(currentSection).add(keyMatch[1]);
}

for (const section of ["innerHTML", "titles", "placeholders", "miscellaneous"]) {
	for (const key of Object.keys(english[section])) {
		assert.ok(
			Object.prototype.hasOwnProperty.call(french[section], key),
			`French ${section} is missing English source key: ${key}`
		);
	}
}

assert.strictEqual(french.innerHTML["select-a-different-translation"].trim(), "Sélectionnez une autre traduction");
assert.strictEqual(french.titles["select-language"], "Sélectionnez la langue");
assert.strictEqual(french.placeholders["search-all-options-by-keyword"], "Recherchez toutes les options par mot-clé...");

const popupTranslationKeys = new Set(
	Array.from(popupHtml.matchAll(/data-translate="([^"]+)"/g), (match) => match[1])
);
const missingPopupTranslationKeys = [];
for (const key of popupTranslationKeys) {
	if (
		!Object.prototype.hasOwnProperty.call(french.innerHTML, key) &&
		!Object.prototype.hasOwnProperty.call(french.miscellaneous, key)
	) {
		missingPopupTranslationKeys.push(key);
	}
}
assert.deepStrictEqual(missingPopupTranslationKeys, [], "French translation is missing current popup keys");

function decodeHtmlAttribute(value) {
	return value
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function translationAttributeKey(value) {
	return decodeHtmlAttribute(value)
		.toLowerCase()
		.replace(/[^a-zA-Z0-9\s\-]/g, "")
		.replace(/[\n\t\r]/g, "")
		.trim()
		.replaceAll(" ", "-");
}

const missingPopupAttributes = [];
for (const [attribute, section] of [["title", "titles"], ["placeholder", "placeholders"]]) {
	const values = Array.from(popupHtml.matchAll(new RegExp(`\\b${attribute}="([^"]*)"`, "g")), (match) => match[1]);
	for (const value of values) {
		const key = translationAttributeKey(value);
		if (!key) continue;
		if (!Object.prototype.hasOwnProperty.call(french[section], key)) {
			missingPopupAttributes.push({ section, key, value: decodeHtmlAttribute(value) });
		}
	}
}
assert.deepStrictEqual(missingPopupAttributes, [], "French translation is missing current popup titles/placeholders");

function structuralTokens(value) {
	return [
		...(value.match(/<[^>]+>/g) || []),
		...(value.match(/\{[^{}]+\}/g) || []),
		...(value.match(/https?:\/\/[^\s<>'"]+/gi) || [])
	];
}

for (const section of Object.keys(english)) {
	for (const key of Object.keys(english[section])) {
		const sourceValue = english[section][key];
		const translatedValue = french[section][key];
		assert.ok(translatedValue || !sourceValue, `French translation is empty: ${section}.${key}`);
		assert.deepStrictEqual(
			structuralTokens(translatedValue),
			structuralTokens(sourceValue),
			`French translation changed a placeholder, URL, or HTML tag: ${section}.${key}`
		);
		assert.ok(!/\[\[SSN(?:HOLD|ITEM)\d+\]\]/.test(translatedValue), `Generator marker remains: ${section}.${key}`);
	}
}

const inlineScripts = Array.from(welcomeHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
assert.ok(inlineScripts.length > 0, "Expected an inline welcome-page script");
inlineScripts.forEach((match) => new Function(match[1]));

console.log("PASS French translation wiring and structure");
