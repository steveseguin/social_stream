const assert = require("node:assert/strict");
const router = require("../js/streamdeck-remote-control.js");

const unavailable = router.buildCapabilities({
	runtime: "web",
	ssapp: { available: false }
});

assert.equal(unavailable.runtime, "web");
assert.equal(unavailable.ssapp.available, false);
assert.equal(router.isSsappRequest({ action: "startSource" }), true);
assert.equal(router.isSsappRequest({ action: "ssapp.stopSource" }), true);
assert.equal(router.isSsappRequest({ action: "customThing", target: "ssapp" }), true);
assert.equal(router.isSsappRequest({ action: "nextInQueue" }), false);
assert.equal(router.isSsappActionSupported("startSource", unavailable), false);

const available = router.buildCapabilities({
	runtime: "electron",
	ssapp: { available: true, runtime: "electron" }
});

assert.equal(available.ssapp.available, true);
assert.equal(router.isSsappActionSupported("startSource", available), true);
assert.equal(router.isSsappActionSupported("ssapp.stopSource", available), true);
assert.equal(router.isSsappActionSupported("unknownSourceAction", available), false);

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
