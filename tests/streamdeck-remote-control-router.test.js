const assert = require("node:assert/strict");
const router = require("../js/streamdeck-remote-control.js");

const unavailable = router.buildCapabilities({
	runtime: "web",
	ssapp: { available: false }
});

assert.equal(unavailable.runtime, "web");
assert.equal(unavailable.ssapp.available, false);
assert.equal(unavailable.ssn.actions.pin, true);
assert.equal(unavailable.ssn.actions.clearDock, true);
assert.equal(unavailable.ssn.actions.clearHistory, true);
assert.equal(unavailable.ssn.actions.removefromwaitlist, true);
assert.equal(unavailable.ssn.actions.resetleaderboard, true);
assert.equal(unavailable.ssn.actions.startentries, true);
assert.equal(unavailable.ssn.actions.waitlistmessage, true);
assert.equal(router.isSsappRequest({ action: "startSource" }), true);
assert.equal(router.isSsappRequest({ action: "ssapp.stopSource" }), true);
assert.equal(router.isSsappRequest({ action: "customThing", target: "ssapp" }), true);
assert.equal(router.isSsappRequest({ action: "startSource", target: "overlay" }), false);
assert.equal(router.isSsappRequest({ action: "nextInQueue" }), false);
assert.equal(router.isSsappActionSupported("startSource", unavailable), false);

const available = router.buildCapabilities({
	runtime: "electron",
	ssapp: {
		available: true,
		runtime: "electron",
		version: "0.4.2",
		sourceControls: { list: true, get: true, add: true, remove: true, update: true, start: true, stop: true, restart: true },
		settings: { get: true, update: true }
	}
});

assert.equal(available.ssapp.available, true);
assert.equal(available.ssapp.version, "0.4.2");
assert.equal(available.ssapp.bridgeVersion, 1);
assert.equal(router.isSsappActionSupported("startSource", available), true);
assert.equal(router.isSsappActionSupported("ssapp.stopSource", available), true);
assert.equal(router.isSsappActionSupported("addSource", available), true);
assert.equal(router.isSsappActionSupported("updateSettings", available), true);
assert.equal(router.isSsappActionSupported("unknownSourceAction", available), false);

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
	request: "request-1",
	error: {
		code: "SSAPP_UNAVAILABLE",
		message: "No SSApp"
	}
});

console.log("streamdeck remote-control router tests passed");
