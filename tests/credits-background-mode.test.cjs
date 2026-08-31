"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const creditsSource = fs.readFileSync(path.join(repoRoot, "credits.html"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const creditsGuideSource = fs.readFileSync(path.join(repoRoot, "docs", "credits-roll-guide.html"), "utf8");

for (const match of creditsSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
	if (match[1].trim()) new vm.Script(match[1], { filename: "credits-inline.js" });
}

const creditsStateStart = backgroundSource.indexOf('const BACKGROUND_CREDITS_STORAGE_KEY = "creditsBackgroundState";');
const creditsStateEnd = backgroundSource.indexOf("function getVideoStatsConfig()", creditsStateStart);
assert.ok(creditsStateStart >= 0 && creditsStateEnd > creditsStateStart, "background credits state block is missing");
const remoteHandlerStart = backgroundSource.indexOf("async function handleStreamDeckBackgroundRequest(request)");
const remoteHandlerEnd = backgroundSource.indexOf("function sendStreamDeckPeerResult", remoteHandlerStart);
assert.ok(remoteHandlerStart >= 0 && remoteHandlerEnd > remoteHandlerStart, "remote-control background router is missing");
const creditsUiSyncStart = popupSource.indexOf("function syncCreditsControlUi()");
const creditsUiSyncEnd = popupSource.indexOf("\n\nfunction update(", creditsUiSyncStart);
assert.ok(creditsUiSyncStart >= 0 && creditsUiSyncEnd > creditsUiSyncStart, "credits UI sync function is missing");

function createBackgroundHarness(initialStorage = {}) {
	const storage = Object.assign({}, initialStorage);
	const targeted = [];
	const sandbox = {
		Map,
		Set,
		Promise,
		Number,
		Array,
		String,
		Date,
		Math,
		settings: { triggermode: { optionparam13: "background" } },
		streamID: "credits-test-session",
		isExtensionOn: true,
		remoteRouter: require(path.join(repoRoot, "js", "streamdeck-remote-control.js")),
		console: { log() {}, warn() {}, error() {} },
		setTimeout,
		clearTimeout,
		convertToUSD(value) {
			return Number(String(value || "").replace(/[^0-9.]/g, "")) || 0;
		},
		getSettingField(settingKey, fieldKey, fallback) {
			const entry = sandbox.settings[settingKey];
			return entry && entry[fieldKey] !== undefined ? entry[fieldKey] : fallback;
		},
		getStreamDeckRemoteControlRouter() {
			return sandbox.remoteRouter;
		},
		chrome: {
			storage: {
				local: {
					get(keys, callback) {
						const result = {};
						(keys || []).forEach(key => {
							if (Object.prototype.hasOwnProperty.call(storage, key)) result[key] = storage[key];
						});
						callback(result);
					},
					set(values) {
						Object.assign(storage, JSON.parse(JSON.stringify(values)));
					}
				}
			}
		},
		sendTargetP2P(packet, target, options) {
			targeted.push({ packet, target, options });
			return Promise.resolve(target === "dock");
		}
	};
	vm.createContext(sandbox);
	vm.runInContext(
		backgroundSource.slice(creditsStateStart, creditsStateEnd) +
			backgroundSource.slice(remoteHandlerStart, remoteHandlerEnd) +
			"\nthis.creditsApi = { captureBackgroundCreditsMessage, getBackgroundCreditsSnapshot, resetBackgroundCreditsCollection, getBackgroundCreditsTestSnapshot, sendCreditsCommandPacket, isCreditsRemoteAction, runCreditsCommand, handleStreamDeckBackgroundRequest, routeStreamDeckRemoteRequest };",
		sandbox,
		{ filename: "background-credits-state.js" }
	);
	return { sandbox, storage, targeted, api: sandbox.creditsApi };
}

(async function run() {
	const creditsUiElements = {
		creditsTriggerModeSelect: { value: "manual" },
		creditsStartBtn: { hidden: true },
		creditsPreviewBtn: { hidden: true },
		creditsBackgroundTestBtn: { hidden: true },
		creditsResetBtn: { hidden: false },
		creditsControlHint: { textContent: "" }
	};
	const creditsUiSandbox = {
		document: { getElementById: id => creditsUiElements[id] || null }
	};
	vm.runInNewContext(
		popupSource.slice(creditsUiSyncStart, creditsUiSyncEnd) + "\nsyncCreditsControlUi();",
		creditsUiSandbox,
		{ filename: "popup-credits-ui.js" }
	);
	assert.strictEqual(creditsUiElements.creditsStartBtn.hidden, false);
	assert.strictEqual(creditsUiElements.creditsPreviewBtn.hidden, false);
	assert.strictEqual(creditsUiElements.creditsBackgroundTestBtn.hidden, true);
	creditsUiElements.creditsTriggerModeSelect.value = "background";
	creditsUiSandbox.syncCreditsControlUi();
	assert.strictEqual(creditsUiElements.creditsStartBtn.hidden, false);
	assert.strictEqual(creditsUiElements.creditsPreviewBtn.hidden, false);
	assert.strictEqual(creditsUiElements.creditsBackgroundTestBtn.hidden, false);
	creditsUiElements.creditsTriggerModeSelect.value = "auto";
	creditsUiSandbox.syncCreditsControlUi();
	assert.strictEqual(creditsUiElements.creditsStartBtn.hidden, true);
	assert.strictEqual(creditsUiElements.creditsPreviewBtn.hidden, true);
	assert.strictEqual(creditsUiElements.creditsBackgroundTestBtn.hidden, true);

	const harness = createBackgroundHarness();
	harness.api.resetBackgroundCreditsCollection();
	harness.api.captureBackgroundCreditsMessage({ chatname: "Chatter", type: "youtube", chatmessage: "hello" });
	harness.api.captureBackgroundCreditsMessage({ chatname: "Member", type: "twitch", event: "channel_subscription_new" });
	harness.api.captureBackgroundCreditsMessage({ chatname: "Donor", type: "youtube", hasDonation: "$12.50", donoValue: 12.5 });
	harness.api.captureBackgroundCreditsMessage({ chatname: "Donor", type: "youtube", chatmessage: "again" });

	const snapshot = await harness.api.getBackgroundCreditsSnapshot();
	assert.strictEqual(snapshot.length, 3);
	assert.strictEqual(snapshot.find(user => user.name === "Chatter").messageCount, 1);
	assert.strictEqual(snapshot.find(user => user.name === "Member").isMember, true);
	assert.strictEqual(snapshot.find(user => user.name === "Donor").messageCount, 2);
	assert.strictEqual(snapshot.find(user => user.name === "Donor").donations, 12.5);
	assert.strictEqual(snapshot.find(user => user.name === "Donor").hasDonationActivity, true);

	harness.sandbox.settings.triggermode.optionparam13 = "manual";
	harness.api.captureBackgroundCreditsMessage({ chatname: "Ignored", type: "youtube", chatmessage: "not opted in" });
	assert.strictEqual((await harness.api.getBackgroundCreditsSnapshot()).length, 3);

	await harness.api.sendCreditsCommandPacket({ creditsCommand: "start", creditsSnapshot: snapshot });
	assert.deepStrictEqual(harness.targeted.map(entry => entry.target), ["credits", "dock"]);
	assert.strictEqual(harness.targeted[1].options.retry, true);
	assert.strictEqual(harness.api.isCreditsRemoteAction("creditsStart"), true);
	assert.strictEqual(harness.api.isCreditsRemoteAction("creditsTest"), true);
	assert.strictEqual(harness.api.isCreditsRemoteAction("creditsUnknown"), false);

	harness.sandbox.settings.triggermode.optionparam13 = "background";
	const remoteStart = await harness.api.runCreditsCommand("creditsStart");
	assert.strictEqual(remoteStart.success, true);
	assert.strictEqual(remoteStart.delivered, true);
	assert.strictEqual(remoteStart.creditsCount, 3);
	assert.strictEqual(harness.targeted[harness.targeted.length - 1].packet.creditsCommand, "start");

	const remoteTest = await harness.api.runCreditsCommand("creditsTest");
	assert.strictEqual(remoteTest.success, true);
	assert.strictEqual(remoteTest.creditsCount, 3);
	assert.strictEqual(harness.targeted[harness.targeted.length - 1].packet.creditsCommand, "test");

	const apiRoute = await harness.api.routeStreamDeckRemoteRequest({ action: "creditsPreview", get: "credits-api-test" }, { transport: "websocket" });
	assert.strictEqual(apiRoute.kind, "command");
	assert.strictEqual(apiRoute.result.ok, true);
	assert.strictEqual(apiRoute.result.request, "credits-api-test");
	assert.strictEqual(apiRoute.result.payload.action, "creditsPreview");
	assert.strictEqual(apiRoute.result.payload.creditsCount, 3);

	const fixtures = harness.api.getBackgroundCreditsTestSnapshot();
	assert.deepStrictEqual(Array.from(fixtures, user => user.name), ["Test Participant", "Test Member", "Test Donor"]);
	assert.strictEqual(fixtures.find(user => user.name === "Test Member").isMember, true);
	assert.strictEqual(fixtures.find(user => user.name === "Test Donor").hasDonationActivity, true);

	harness.sandbox.streamID = "different-session";
	assert.strictEqual((await harness.api.getBackgroundCreditsSnapshot()).length, 0);

	harness.api.resetBackgroundCreditsCollection();
	assert.strictEqual((await harness.api.getBackgroundCreditsSnapshot()).length, 0);
	const remoteReset = await harness.api.runCreditsCommand("creditsReset");
	assert.strictEqual(remoteReset.success, true);
	assert.strictEqual(remoteReset.creditsCount, 0);
	assert.strictEqual(harness.targeted[harness.targeted.length - 1].packet.creditsCommand, "reset");

	assert.ok(popupHtml.includes('<option value="background">Background collection (button-triggered)</option>'));
	assert.ok(popupHtml.includes('id="creditsBackgroundTestBtn"'));
	assert.ok(popupHtml.includes('id="creditsStartBtn" class="glowingButton" hidden'));
	assert.ok(!popupHtml.includes('class="credits-control-panel"'));
	assert.ok(popupHtml.includes('https://socialstream.ninja/beta/docs/credits-roll-guide.html'));
	assert.ok(popupSource.includes('cmd: "creditsBackgroundTest"'));
	assert.ok(popupSource.includes('function syncCreditsControlUi()'));
	assert.ok(popupSource.includes("startButton.hidden = !buttonTriggered"));
	assert.ok(popupSource.includes("testButton.hidden = mode !== 'background'"));
	assert.ok(creditsSource.includes('replaceCreditsUsersFromSnapshot(data.creditsSnapshot)'));
	assert.ok(creditsSource.includes('startCredits(creditsUsersFromSnapshot(data.creditsSnapshot))'));
	assert.ok(creditsSource.includes('>View Credits Guide</a>'));
	assert.ok(creditsGuideSource.includes('credits-settings-background-mode.png'));
	assert.ok(creditsGuideSource.includes('credits-roll-preview.png'));
	assert.ok(creditsGuideSource.includes('https://io.socialstream.ninja/SESSION_ID/creditsStart'));

	console.log("Credits background collection checks passed.");
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
