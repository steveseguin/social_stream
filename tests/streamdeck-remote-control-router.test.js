const assert = require("node:assert/strict");
const router = require("../js/streamdeck-remote-control.js");

const unavailable = router.buildCapabilities({
	runtime: "web",
	hostInstanceId: "host-test-1",
	ssapp: { available: false }
});

assert.equal(unavailable.runtime, "web");
assert.equal(unavailable.version, 2);
assert.equal(unavailable.protocol.name, "ssn-remote-control");
assert.equal(unavailable.protocol.version, 2);
assert.equal(unavailable.role, "social-stream-host");
assert.equal(unavailable.hostInstanceId, "host-test-1");
assert.equal(unavailable.host.instanceId, "host-test-1");
assert.equal(unavailable.ssapp.available, false);
assert.equal(unavailable.ssn.actions.pin, true);
assert.equal(unavailable.ssn.actions.clearDock, true);
assert.equal(unavailable.ssn.actions.clearHistory, true);
assert.equal(unavailable.ssn.actions.removefromwaitlist, true);
assert.equal(unavailable.ssn.actions.resetleaderboard, true);
assert.equal(unavailable.ssn.actions.startentries, true);
assert.equal(unavailable.ssn.actions.waitlistmessage, true);
assert.equal(unavailable.ssn.actions.creditsStart, true);
assert.equal(unavailable.ssn.actions.creditsPreview, true);
assert.equal(unavailable.ssn.actions.creditsTest, true);
assert.equal(unavailable.ssn.actions.creditsReset, true);
assert.equal(router.isSsappRequest({ action: "startSource" }), true);
assert.equal(router.isSsappRequest({ action: "ssapp.stopSource" }), true);
assert.equal(router.isSsappRequest({ action: "customThing", target: "ssapp" }), true);
assert.equal(router.isSsappRequest({ action: "startSource", target: "overlay" }), false);
assert.equal(router.isSsappRequest({ action: "nextInQueue" }), false);
const normalizedHttpRequest = router.normalizeRemoteRequest({
	action: "setSourceMute",
	target: "ssapp",
	value: '{"sourceId":"source-1","isMuted":true}'
});
assert.deepEqual(normalizedHttpRequest.value, { sourceId: "source-1", isMuted: true });
const unchangedSsnJsonString = router.normalizeRemoteRequest({ action: "customThing", value: '{"keep":"string"}' });
assert.equal(unchangedSsnJsonString.value, '{"keep":"string"}');
const unchangedInvalidJson = router.normalizeRemoteRequest({ action: "setSourceMute", target: "ssapp", value: "{invalid" });
assert.equal(unchangedInvalidJson.value, "{invalid");
assert.equal(router.isSsappActionSupported("startSource", unavailable), false);
assert.equal(unavailable.ssapp.remoteActions.startSource, false);
assert.equal(unavailable.ssapp.actionAvailability.startSource.state, "unavailable");
assert.equal(unavailable.ssn.actionDescriptors.clearOverlay.owner, "dock");
assert.equal(unavailable.ssn.actionDescriptors.getQueueSize.phase, 2);
assert.equal(unavailable.ssn.actionDescriptors.resettimer.confirmation, true);
assert.deepEqual(unavailable.ssn.actionDescriptors.resettimer.valueSchema.required, ["confirm"]);
assert.equal(unavailable.ssn.actionDescriptors.clearHistory.owner, "background");
assert.equal(unavailable.ssn.actionDescriptors.clearHistory.confirmation, true);
assert.equal(unavailable.ssn.actionDescriptors.getpollpresets.owner, "background");
assert.equal(unavailable.ssn.actionDescriptors.getpollpresets.risk, "read-only");
assert.equal(unavailable.ssn.actionDescriptors.creditsStart.owner, "background");
assert.equal(unavailable.ssn.actionDescriptors.creditsReset.risk, "destructive");
assert.equal(unavailable.ssn.actionAvailability.clearOverlay.state, "unknown");
assert.equal(unavailable.ssn.actionAvailability.starttimer.state, "available");
assert.equal(unavailable.ssn.actionAvailability.creditsStart.state, "unknown");
assert.equal(router.getActionOwner("clearOverlay"), "dock");
assert.equal(router.getActionOwner("starttimer"), "background");
assert.equal(router.getActionOwner("clearHistory"), "background");
assert.equal(router.getActionOwner("getpollpresets"), "background");
assert.equal(router.getActionOwner("creditsStart"), "background");
assert.equal(router.getActionOwner("restartSource"), "ssapp");
assert.equal(router.isRemoteSsnRequest({ action: "clearOverlay" }, "dock"), true);
assert.equal(router.isRemoteSsnRequest({ action: "clearOverlay" }, "background"), false);
assert.equal(router.isRemoteSsnRequest({ action: "creditsTest" }, "background"), true);
assert.equal(router.isVersionedRequest({ protocol: 2 }), true);
assert.equal(router.isVersionedRequest({ protocolVersion: 2 }), true);
assert.equal(router.isVersionedRequest({ protocol: 1 }), false);
assert.deepEqual(router.validateVersionedRequest({ protocol: 2, action: "getCapabilities", get: "caps-1" }), { ok: true });
assert.equal(router.validateVersionedRequest({ protocol: 2, action: "getCapabilities" }).code, "MISSING_CORRELATION_ID");
assert.equal(router.validateVersionedRequest({ protocol: 2, action: "sendChat", get: "x".repeat(257) }).code, "INVALID_CORRELATION_ID");
assert.equal(router.validateVersionedRequest({ protocol: 2, action: "sendChat", get: "chat-big", value: "x".repeat(33000) }).code, "PAYLOAD_TOO_LARGE");

const available = router.buildCapabilities({
	runtime: "electron",
	ssapp: {
		available: true,
		runtime: "electron",
		version: "0.4.2",
		sourceControls: { list: true, get: true, add: true, remove: true, update: true, start: true, stop: true, restart: true },
		appControls: { status: true, reload: true, shutdown: true },
		settings: { get: true, update: true }
	}
});

assert.equal(available.ssapp.available, true);
assert.equal(available.ssapp.version, "0.4.2");
assert.equal(available.ssapp.bridgeVersion, 1);
assert.equal(router.isSsappActionSupported("startSource", available), true);
assert.equal(router.isSsappActionSupported("ssapp.stopSource", available), true);
assert.equal(router.isSsappActionSupported("addSource", available), true);
assert.equal(router.isSsappActionSupported("updateSettings", available), false);
assert.equal(router.isSsappActionSupported("startAllSources", available), false);
assert.equal(available.ssapp.appControls, false);
assert.equal(available.ssapp.settings, false);
assert.deepEqual(available.ssapp.bulkControls, {});
assert.equal(available.ssapp.remoteActions.startSource, true);
assert.equal(available.ssapp.actionAvailability.startSource.state, "available");
assert.equal(available.ssapp.actionDescriptors.restartSource.risk, "disruptive");
assert.deepEqual(available.ssapp.actionDescriptors.setSourceMute.valueSchema.required, ["sourceId", "isMuted"]);
assert.equal(available.ssapp.actionDescriptors.setSourceMute.valueSchema.properties.isMuted.type, "boolean");
assert.equal(router.isSsappActionSupported("unknownSourceAction", available), false);

assert.deepEqual(router.validateRemoteSsappRequest({
	action: "addSource",
	value: { target: "youtube", videoId: "abcdefghijk", connectionMode: "classic" }
}), { ok: true });
assert.equal(router.validateRemoteSsappRequest({
	action: "addSource",
	value: { target: "youtube", url: "https://youtube.com/live_chat?v=abcdefghijk&access_token=secret" }
}).code, "SIGN_IN_UNSUPPORTED");
assert.equal(router.validateRemoteSsappRequest({
	action: "addSource",
	value: { target: "youtube", videoId: "abcdefghijk", customSession: "signed-in" }
}).code, "UNSUPPORTED_FIELD");
assert.equal(router.validateRemoteSsappRequest({
	action: "updateSource",
	value: { sourceId: "source-1", updates: { accountRole: "host" } }
}).code, "UNSUPPORTED_FIELD");

const partial = router.buildCapabilities({
	runtime: "electron",
	ssapp: {
		available: true,
		runtime: "electron",
		sourceControls: {
			list: true,
			get: true,
			start: false
		},
		mute: false
	}
});

assert.equal(partial.ssapp.sourceControls.start, false);
assert.equal(partial.ssapp.mute, false);
assert.equal(router.isSsappActionSupported("getSources", partial), true);
assert.equal(router.isSsappActionSupported("startSource", partial), false);
assert.equal(router.isSsappActionSupported("toggleSourceMute", partial), false);

const noMute = router.buildCapabilities({
	runtime: "electron",
	ssapp: { available: true, runtime: "electron" }
});
noMute.ssapp.mute = false;

assert.equal(router.isSsappActionSupported("toggleSourceMute", noMute), false);

const error = router.makeError({ get: "request-1" }, "SSAPP_UNAVAILABLE", "No SSApp");
assert.deepEqual(error, {
	ok: false,
	status: "failed",
	request: "request-1",
	error: {
		code: "SSAPP_UNAVAILABLE",
		message: "No SSApp"
	}
});

const accepted = router.makeResponse({ get: "request-2" }, { accepted: true, source: { status: "activating" } });
assert.equal(accepted.status, "accepted");
assert.equal(accepted.request, "request-2");

const normalizedLegacy = router.normalizeCommandResult({ get: "request-3" }, true);
assert.deepEqual(normalizedLegacy, {
	ok: true,
	status: "completed",
	request: "request-3",
	payload: { value: true }
});

console.log("streamdeck remote-control router tests passed");
