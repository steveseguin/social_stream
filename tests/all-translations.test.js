const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const localeNames = [
	"en-us",
	"en-uk",
	"pt-br",
	"ar",
	"es",
	"fr",
	"de",
	"cs",
	"th",
	"zh-CN",
	"zh-TW",
	"tr",
	"uk",
	"test",
];
const translationSections = ["innerHTML", "titles", "placeholders", "miscellaneous"];
const translationsDir = path.join(repoRoot, "translations");
const english = JSON.parse(fs.readFileSync(path.join(translationsDir, "en-us.json"), "utf8"));
const localesByName = new Map();

function sortedPlaceholders(value) {
	return (String(value).match(/\{[^{}]+\}/g) || []).sort();
}

function functionalHtmlStructure(value) {
	const structure = [];
	for (const match of String(value).matchAll(/<(\/)?([a-z][a-z0-9-]*)([^>]*)>/gi)) {
		const attributes = [];
		for (const attribute of match[3].matchAll(
			/\b(id|class|type|name|for|href|target|rel|data-[a-z0-9-]+|min|max|value|size|style)=["']([^"']*)["']/gi
		)) {
			attributes.push(`${attribute[1].toLowerCase()}=${attribute[2]}`);
		}
		structure.push(`${match[1] ? "/" : ""}${match[2].toLowerCase()}|${attributes.sort().join("|")}`);
	}
	return structure;
}

function assertNoDuplicateSectionKeys(fileName, source) {
	let currentSection = "";
	const sectionKeys = new Map();
	for (const line of source.split(/\r?\n/)) {
		const sectionMatch = line.match(/^  "([^"]+)": \{$/);
		if (sectionMatch) {
			currentSection = sectionMatch[1];
			sectionKeys.set(currentSection, new Set());
			continue;
		}
		const keyMatch = currentSection && line.match(/^    "([^"]+)":/);
		if (!keyMatch) continue;
		assert.ok(
			!sectionKeys.get(currentSection).has(keyMatch[1]),
			`${fileName} has duplicate key: ${currentSection}.${keyMatch[1]}`
		);
		sectionKeys.get(currentSection).add(keyMatch[1]);
	}
}

for (const localeName of localeNames) {
	const fileName = `${localeName}.json`;
	const source = fs.readFileSync(path.join(translationsDir, fileName), "utf8");
	assertNoDuplicateSectionKeys(fileName, source);
	const locale = JSON.parse(source);
	localesByName.set(localeName, locale);

	for (const section of translationSections) {
		assert.ok(locale[section] && typeof locale[section] === "object", `${fileName} is missing section: ${section}`);
		for (const [key, sourceValue] of Object.entries(english[section])) {
			assert.ok(Object.prototype.hasOwnProperty.call(locale[section], key), `${fileName} is missing ${section}.${key}`);
			const translatedValue = locale[section][key];
			assert.strictEqual(typeof translatedValue, "string", `${fileName} ${section}.${key} is not text`);
			assert.ok(translatedValue.trim() || !sourceValue.trim(), `${fileName} has an empty translation: ${section}.${key}`);
			assert.deepStrictEqual(
				sortedPlaceholders(translatedValue),
				sortedPlaceholders(sourceValue),
				`${fileName} changed a placeholder: ${section}.${key}`
			);
			assert.deepStrictEqual(
				functionalHtmlStructure(translatedValue),
				functionalHtmlStructure(sourceValue),
				`${fileName} changed functional HTML: ${section}.${key}`
			);
			assert.ok(!/__SSN(?:HOLD|ITEM)_/.test(translatedValue), `${fileName} contains a generator marker: ${section}.${key}`);
		}
	}
}

const sourceScanExcludedDirectories = new Set([
	".git",
	".codex-tmp",
	"dist",
	"docs",
	"node_modules",
	"scripts",
	"tests",
	"thirdparty",
	"translations",
	"vendor",
]);

function collectSourceFiles(directory) {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (sourceScanExcludedDirectories.has(entry.name)) continue;
			files.push(...collectSourceFiles(fullPath));
		} else if (/\.(?:html|js)$/.test(entry.name)) {
			files.push(fullPath);
		}
	}
	return files;
}

const sourceFiles = collectSourceFiles(repoRoot);
const knownEnglishKeys = new Set(translationSections.flatMap((section) => Object.keys(english[section])));
const literalTranslationKeys = new Map();
const literalPatterns = [
	/data-(?:page-)?translate=["']([^"']+)["']/g,
	/data-page-(?:title|alt)=["']([^"']+)["']/g,
	/(?:getTranslation|formatTranslation|dashboardTranslation|SSNPageI18n\.t)\(\s*["']([^"']+)["']/g,
];

for (const filePath of sourceFiles) {
	const source = fs.readFileSync(filePath, "utf8");
	for (const pattern of literalPatterns) {
		for (const match of source.matchAll(pattern)) {
			if (!literalTranslationKeys.has(match[1])) literalTranslationKeys.set(match[1], []);
			literalTranslationKeys.get(match[1]).push(path.relative(repoRoot, filePath));
		}
	}
}

for (const [key, files] of literalTranslationKeys) {
	assert.ok(knownEnglishKeys.has(key), `English translation is missing ${key}, used by ${[...new Set(files)].join(", ")}`);
}

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

const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
for (const [attribute, section] of [
	["title", "titles"],
	["placeholder", "placeholders"],
]) {
	const keys = new Set(
		Array.from(popupHtml.matchAll(new RegExp(`\\b${attribute}="([^"]*)"`, "g")), (match) =>
			translationAttributeKey(match[1])
		).filter(Boolean)
	);
	for (const key of keys) {
		for (const localeName of localeNames) {
			const locale = localesByName.get(localeName);
			assert.ok(Object.prototype.hasOwnProperty.call(locale[section], key), `${localeName}.json is missing ${section}.${key}`);
		}
	}
}

const eventsHtml = fs.readFileSync(path.join(repoRoot, "events.html"), "utf8");
assert.ok(eventsHtml.includes("document.querySelectorAll('#header h1')"), "Events Dashboard headers must be translated");
assert.ok(eventsHtml.includes("applyDocumentLanguage(lang)"), "Events Dashboard must apply language direction metadata");

console.log(`PASS complete translation coverage for ${localeNames.length} locales`);
