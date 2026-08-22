const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const multiAlertsSource = fs.readFileSync(path.join(repoRoot, "multi-alerts.js"), "utf8");
const settingsDefinitionsSource = fs.readFileSync(path.join(repoRoot, "shared", "config", "settingsDefinitions.js"), "utf8");

const expectedSettings = {
	customTwitchFollowMessage: "twitch-started-following-message",
	customTwitchSubscribedMessage: "twitch-subscribed-message",
	customTwitchSubscribedAtTierMessage: "twitch-subscribed-at-tier-message",
	customTwitchResubscribedMessage: "twitch-resubscribed-message"
};

const customUiTranslationKeys = [
	"custom-event-translations",
	"custom-event-translations-description",
	"custom-twitch-follow-message",
	"custom-twitch-subscription-tier-message",
	"custom-twitch-subscription-without-tier-message",
	"custom-twitch-resubscription-message"
];
const requiredAttributeTranslations = {
	titles: [
		"automatically-queue-only-youtube-super-chat-messages",
		"make-every-reaction-appear-from-the-same-point-at-the-bottom-center-of-the-screen"
	],
	placeholders: ["intro-main-brb"]
};

for (const [settingKey, translationKey] of Object.entries(expectedSettings)) {
	assert.ok(popupHtml.includes(`data-textsetting="${settingKey}"`), `Missing popup field: ${settingKey}`);
	assert.ok(backgroundSource.includes(`${settingKey}: "${translationKey}"`), `Missing override mapping: ${settingKey}`);
	assert.ok(settingsDefinitionsSource.includes(`"${settingKey}": {`), `Missing setting definition: ${settingKey}`);
}

assert.ok(backgroundSource.includes("settings.translation = applyCustomTranslationOverrides(false);"));
assert.ok(backgroundSource.includes("settings.translation = applyCustomTranslationOverrides(data);"));
assert.ok(popupSource.includes("formatCustomEventTranslation('customTwitchSubscribedAtTierMessage'"));
assert.ok(popupSource.includes("const commonSectionIds = ["));
assert.ok(popupSource.includes("'wrapper-profiles-options',\n        'wrapper-privhostbot-options-ext',\n        'wrapper-session-options',\n        'wrapper-export-options'"));
assert.ok(popupSource.includes("reorderGlobalSettingsSections();"));
assert.ok(!popupSource.includes("Welcome to the squad!"));
assert.ok(!multiAlertsSource.includes("Welcome to the squad!"));

const translationFiles = fs.readdirSync(path.join(repoRoot, "translations")).filter((file) => file.endsWith(".json"));
for (const file of translationFiles) {
	const translation = JSON.parse(fs.readFileSync(path.join(repoRoot, "translations", file), "utf8"));
	for (const translationKey of Object.values(expectedSettings)) {
		assert.ok(translation.innerHTML?.[translationKey], `${file} is missing event translation: ${translationKey}`);
	}
	for (const translationKey of customUiTranslationKeys) {
		assert.ok(translation.innerHTML?.[translationKey], `${file} is missing popup translation: ${translationKey}`);
	}
	for (const [section, translationKeys] of Object.entries(requiredAttributeTranslations)) {
		for (const translationKey of translationKeys) {
			assert.ok(translation[section]?.[translationKey], `${file} is missing ${section} translation: ${translationKey}`);
		}
	}
}

console.log("PASS custom translation override wiring");
