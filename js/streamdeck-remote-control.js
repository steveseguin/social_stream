(function (root, factory) {
	const api = factory();
	if (typeof module === "object" && module.exports) {
		module.exports = api;
	}
	if (root) {
		root.StreamDeckRemoteControl = api;
	}
})(typeof window !== "undefined" ? window : globalThis, function () {
	"use strict";

	const SSAPP_ACTIONS = {
		getSources: ["sourceControls", "list"],
		getSource: ["sourceControls", "get"],
		addSource: ["sourceControls", "add"],
		updateSource: ["sourceControls", "update"],
		removeSource: ["sourceControls", "remove"],
		startSource: ["sourceControls", "start"],
		stopSource: ["sourceControls", "stop"],
		restartSource: ["sourceControls", "restart"],
		setSourceVisibility: ["visibility", "set"],
		toggleSourceVisibility: ["visibility", "toggle"],
		setSourceMute: ["mute", "set"],
		toggleSourceMute: ["mute", "toggle"],
		setSourceConnectionMode: ["connectionMode", "set"]
	};

	const REMOTE_ADD_SOURCE_FIELDS = new Set(["target", "username", "videoId", "url", "connectionMode", "isVisible", "isMuted", "autoActivate", "idempotencyKey"]);
	const REMOTE_UPDATE_SOURCE_FIELDS = new Set(["url", "username", "videoId", "connectionMode", "isVisible", "isMuted", "autoActivate"]);
	const CREDENTIAL_QUERY_FIELDS = new Set(["access_token", "token", "auth", "authorization", "password", "pass", "secret", "api_key", "apikey", "key", "cookie", "session", "code"]);

	const SSN_ACTIONS = {
		nextInQueue: true,
		clearOverlay: true,
		clearDock: true,
		clear: true,
		clearAll: true,
		clearHistory: true,
		getQueueSize: true,
		sendChat: true,
		sendEncodedChat: true,
		pin: true,
		unpin: true,
		nextPinned: true,
		drawmode: true,
		removefromwaitlist: true,
		highlightwaitlist: true,
		resetwaitlist: true,
		resetleaderboard: true,
		stopentries: true,
		startentries: true,
		openentries: true,
		resumeentries: true,
		waitlistmessage: true,
		setwaitlistmessage: true,
		downloadwaitlist: true,
		selectwinner: true,
		starttimer: true,
		pausetimer: true,
		toggletimer: true,
		resettimer: true,
		timeradd: true,
		timersubtract: true,
		settimer: true,
		gettimerstate: true,
		loadpoll: true,
		setpollsettings: true,
		getpollpresets: true,
		createpoll: true,
		resetpoll: true,
		closepoll: true,
		startmap: true,
		pausemap: true,
		resetmap: true
	};

	const SOURCE_STATUS_VALUES = ["inactive", "activating", "active", "error"];
	const CONNECTION_MODE_VALUES = ["classic", "websocket", "tiktok-websocket", "tiktok-legacy"];

	function cloneCapabilityValue(value) {
		if (Array.isArray(value)) {
			return value.slice();
		}
		if (value && typeof value === "object") {
			return { ...value };
		}
		return value;
	}

	function capabilityValue(options, key, fallback) {
		if (Object.prototype.hasOwnProperty.call(options, key)) {
			return cloneCapabilityValue(options[key]);
		}
		return cloneCapabilityValue(fallback);
	}

	function buildSsappCapabilities(options = {}) {
		if (!options.available) {
			return {
				available: false,
				runtime: null,
				version: null,
				sourceControls: {},
				bulkControls: {},
				visibility: false,
				mute: false,
				connectionMode: false,
				sourceStatus: false,
				settings: false,
				platforms: {}
			};
		}

		return {
			available: true,
			runtime: options.runtime || "electron",
			version: options.version || null,
			apiVersion: options.apiVersion || null,
			bridgeVersion: typeof options.bridgeVersion === "number" ? options.bridgeVersion : 1,
			// App-level lifecycle and settings remain local-only. Remote controllers operate
			// public capture sources through Social Stream's existing transports.
			appControls: false,
			sourceControls: capabilityValue(options, "sourceControls", {
				list: true,
				get: true,
				start: true,
				stop: true,
				restart: true
			}),
			bulkControls: {},
			visibility: capabilityValue(options, "visibility", {
				get: true,
				set: true,
				toggle: true
			}),
			mute: capabilityValue(options, "mute", {
				get: true,
				set: true,
				toggle: true
			}),
			connectionMode: capabilityValue(options, "connectionMode", {
				get: true,
				set: true,
				values: CONNECTION_MODE_VALUES.slice()
			}),
			sourceStatus: capabilityValue(options, "sourceStatus", {
				get: true,
				values: SOURCE_STATUS_VALUES.slice()
			}),
			settings: false,
			platforms: capabilityValue(options, "platforms", {})
		};
	}

	function validatePublicSourceUrl(value) {
		if (value === undefined || value === null || value === "") {
			return null;
		}
		let parsed;
		try {
			parsed = new URL(String(value));
		} catch (error) {
			return "Source URL must be a valid HTTP(S) URL.";
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return "Source URL must use HTTP(S).";
		}
		if (parsed.username || parsed.password) {
			return "Remote source URLs cannot contain sign-in credentials.";
		}
		for (const key of parsed.searchParams.keys()) {
			if (CREDENTIAL_QUERY_FIELDS.has(String(key).toLowerCase())) {
				return "Remote source URLs cannot contain sign-in credentials.";
			}
		}
		if (/(?:access_token|token|authorization|password|secret|api[_-]?key|cookie|session|code)=/i.test(parsed.hash || "")) {
			return "Remote source URLs cannot contain sign-in credentials.";
		}
		return null;
	}

	function validateRemoteSsappRequest(request) {
		if (!request || typeof request !== "object") {
			return { ok: false, code: "INVALID_TARGET", message: "SSApp command request is required." };
		}
		const action = normalizeAction(request.action);
		if (action === "addSource") {
			const value = request.value;
			if (!value || typeof value !== "object" || Array.isArray(value)) {
				return { ok: false, code: "INVALID_TARGET", message: "Source details are required." };
			}
			for (const key of Object.keys(value)) {
				if (!REMOTE_ADD_SOURCE_FIELDS.has(key)) {
					return { ok: false, code: "UNSUPPORTED_FIELD", message: `Remote source creation does not support ${key}.` };
				}
			}
			const urlError = validatePublicSourceUrl(value.url);
			if (urlError) return { ok: false, code: "SIGN_IN_UNSUPPORTED", message: urlError };
		}
		if (action === "updateSource") {
			const value = request.value;
			const updates = value && typeof value === "object" && !Array.isArray(value) ? value.updates || value.settings || {} : {};
			for (const key of Object.keys(updates)) {
				if (!REMOTE_UPDATE_SOURCE_FIELDS.has(key)) {
					return { ok: false, code: "UNSUPPORTED_FIELD", message: `Remote source updates do not support ${key}.` };
				}
			}
			const urlError = validatePublicSourceUrl(updates.url);
			if (urlError) return { ok: false, code: "SIGN_IN_UNSUPPORTED", message: urlError };
		}
		return { ok: true };
	}

	function buildCapabilities(options = {}) {
		const ssappOptions = options.ssapp || {};
		return {
			type: "capabilities",
			version: 1,
			runtime: options.runtime || (ssappOptions.available ? "electron" : "web"),
			ssapp: buildSsappCapabilities(ssappOptions),
			ssn: {
				actions: { ...SSN_ACTIONS }
			}
		};
	}

	function normalizeAction(action) {
		if (typeof action !== "string") {
			return "";
		}
		if (action.startsWith("ssapp.")) {
			return action.slice("ssapp.".length);
		}
		return action;
	}

	function isCapabilityRequest(request) {
		if (!request || typeof request !== "object") {
			return false;
		}
		return request.action === "getCapabilities" || request.get === "capabilities";
	}

	function isSsappRequest(request) {
		if (!request || typeof request !== "object") {
			return false;
		}
		if (request.target === "ssapp") {
			return true;
		}
		if (typeof request.action === "string" && request.action.startsWith("ssapp.")) {
			return true;
		}
		if (request.target && request.target !== "null") {
			return false;
		}
		return !!SSAPP_ACTIONS[normalizeAction(request.action)];
	}

	function isSsappActionSupported(action, capabilities) {
		const normalized = normalizeAction(action);
		const path = SSAPP_ACTIONS[normalized];
		if (!path) {
			return false;
		}
		const ssapp = capabilities && capabilities.ssapp;
		if (!ssapp || ssapp.available !== true) {
			return false;
		}
		let current = ssapp;
		for (const key of path) {
			if (!current || current[key] === undefined || current[key] === false) {
				return false;
			}
			current = current[key];
		}
		return current === true || Array.isArray(current) || typeof current === "object";
	}

	function makeResponse(request, payload) {
		return {
			ok: true,
			request: request && request.get ? request.get : null,
			payload
		};
	}

	function makeError(request, code, message) {
		return {
			ok: false,
			request: request && request.get ? request.get : null,
			error: {
				code,
				message: message || code
			}
		};
	}

	return {
		SSAPP_ACTIONS,
		SSN_ACTIONS,
		buildCapabilities,
		buildSsappCapabilities,
		normalizeAction,
		isCapabilityRequest,
		isSsappRequest,
		isSsappActionSupported,
		validateRemoteSsappRequest,
		makeResponse,
		makeError
	};
});
