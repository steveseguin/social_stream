(function (root) {
	"use strict";
	// The session relay repeats requests and replies to everyone in the room, and the session ID sits in every
	// overlay link. So Breaks records travel encrypted, and the key only ever lives in the private link's fragment.
	var invalid = "This private Breaks link is no longer valid. Open Breaks again from Social Stream.";
	// The session relay closes the sender's connection above about 204,800 characters, so sealed messages stay under that.
	var maxSealed = 190000;
	function subtle() {
		if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("Private Breaks access needs HTTPS, localhost or the app.");
		return crypto.subtle;
	}
	function validKey(key) {
		return typeof key === "string" && /^[a-f0-9]{64}$/.test(key);
	}
	function newKey() {
		var bytes = crypto.getRandomValues(new Uint8Array(32));
		return Array.prototype.map
			.call(bytes, function (b) {
				return ("0" + b.toString(16)).slice(-2);
			})
			.join("");
	}
	function encode(bytes) {
		var out = "";
		for (var i = 0; i < bytes.length; i += 8192) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
		return btoa(out);
	}
	function decode(text) {
		var raw = atob(text),
			bytes = new Uint8Array(raw.length);
		for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
		return bytes;
	}
	function material(key) {
		if (!validKey(key)) throw new Error(invalid);
		var bytes = new Uint8Array(32);
		for (var i = 0; i < 32; i++) bytes[i] = parseInt(key.substr(i * 2, 2), 16);
		return subtle().importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
	}
	// The purpose stops a captured reply being sent back to the host as if it were a request.
	function options(purpose, iv) {
		return { name: "AES-GCM", iv: iv, additionalData: new TextEncoder().encode("ssn-breaks-1:" + purpose) };
	}
	async function seal(key, purpose, value) {
		var iv = crypto.getRandomValues(new Uint8Array(12)),
			box = await subtle().encrypt(options(purpose, iv), await material(key), new TextEncoder().encode(JSON.stringify(value)));
		return { iv: encode(iv), box: encode(new Uint8Array(box)) };
	}
	async function open(key, purpose, sealed) {
		if (!sealed || typeof sealed.iv !== "string" || typeof sealed.box !== "string") throw new Error(invalid);
		var plain;
		try {
			plain = await subtle().decrypt(options(purpose, decode(sealed.iv)), await material(key), decode(sealed.box));
		} catch (_) {
			throw new Error(invalid);
		}
		return JSON.parse(new TextDecoder().decode(plain));
	}
	var api = { invalid: invalid, maxSealed: maxSealed, validKey: validKey, newKey: newKey, seal: seal, open: open };
	root.SSNBreaksAccess = api;
	if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
