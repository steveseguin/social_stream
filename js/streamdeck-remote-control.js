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
		startSource: ["sourceControls", "start"],
		stopSource: ["sourceControls", "stop"],
		restartSource: ["sourceControls", "restart"],
		startAllSources: ["bulkControls", "startAll"],
		stopAllSources: ["bulkControls", "stopAll"],
		restartAllSources: ["bulkControls", "restartAll"],
		setSourceVisibility: ["visibility", "set"],
		toggleSourceVisibility: ["visibility", "toggle"],
		setSourceMute: ["mute", "set"],
		toggleSourceMute: ["mute", "toggle"],
		setSourceConnectionMode: ["connectionMode", "set"]
	};

	const SSN_ACTIONS = {
		nextInQueue: true,
		clearOverlay: true,
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
		stopentries: true,
		startentries: true,
		openentries: true,
		resumeentries: true,
		waitlistmessage: true,
		setwaitlistmessage: true,
		downloadwaitlist: true,
		selectwinner: true,
		resetpoll: true,
		closepoll: true
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
				sourceStatus: false
			};
		}

		return {
			available: true,
			runtime: options.runtime || "electron",
			version: options.version || null,
			sourceControls: capabilityValue(options, "sourceControls", {
				list: true,
				get: true,
				start: true,
				stop: true,
				restart: true
			}),
			bulkControls: capabilityValue(options, "bulkControls", {
				startAll: true,
				stopAll: true,
				restartAll: true,
				filters: ["all", "target", "groupId", "status"]
			}),
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
			})
		};
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
		makeResponse,
		makeError
	};
});
