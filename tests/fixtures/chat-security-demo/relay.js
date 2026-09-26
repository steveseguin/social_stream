// Only optional integrations and I/O are mocked. Production ingress, bot processing,
// sanitizers, relay routing and socket serialization are loaded by the local server.
window.settings = { server2: true };
window.isExtensionOn = true;
window.messageCounter = 0;
window.spotify = null;
window.giveawayHost = null;
window.checkIfAllowed = function () { return true; };
window.checkExactDuplicateAlreadyReceived = function () { return false; };
window.isIndividualLikeEvent = function () { return false; };
window.noteTabActivity = function () {};
window.normalizeRoleIdentifier = function (value) { return String(value || '').trim().toLowerCase(); };
window.prependFirstTimerBadge = function () {}; // firsttimers disabled
window.containsProfanity = function () { return false; }; // adds a flag only; filtering disabled
window.isAiChatbotEnabled = function () { return false; };
window.applyExternalGifToMessage = function () {}; // GIF enrichment disabled
window.applyGiphyToMessage = async function () {}; // GIF enrichment disabled
window.eventFlowSystem = { processMessage: async function (data) { return data; } }; // no configured flows
window.getSettingFlag = function (key) { return !!settings[key]; };
window.captureLiveStatsFromMessage = window.captureBackgroundCreditsMessage = function () {};
window.isEventBlockedByCustomFilter = function () { return false; };
window.routeIndividualLikeEvent = function () { return { routed: false, stop: false }; };
window.normalizeEventName = function (data) { return String(data.event || '').toLowerCase(); };
window.hasTargetedMetaPayload = function () { return false; };
window.sendTargetP2P = function () { throw Error('Unexpected targeted event: fixture is ordinary Twitch chat'); };
window.sendDataToStreamDeckPeersP2P = function () { return false; };
window.sendToDisk = window.sendToH2R = window.sendToPost = window.sendToDiscord = window.sendToStreamerBot = function () {};
window.addMessageDB = async function () { return 1; };
window.socketserverDock = { readyState: 1, send: function (json) { window.__demoWire = JSON.parse(json); } };
window.__demoSanitizerCalls = 0;
var originalDemoFilterXSS = window.filterXSS;
window.filterXSS = function (value) {
  if (typeof value === 'string' && value.indexOf('SSN_LOCAL_PROBE') !== -1) window.__demoSanitizerCalls++;
  return originalDemoFilterXSS.apply(this, arguments);
};
