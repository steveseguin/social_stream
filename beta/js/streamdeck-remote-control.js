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

	const REMOTE_CONTROL_PROTOCOL_VERSION = 2;
	const REMOTE_CONTROL_ROLE = "social-stream-host";
	const REMOTE_CONTROL_MAX_REQUEST_LENGTH = 32768;
	const REMOTE_CONTROL_MAX_CORRELATION_LENGTH = 256;

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
	const SOURCE_ID_VALUE_SCHEMA = {
		type: "object",
		required: ["sourceId"],
		properties: { sourceId: { type: "string" } },
		additionalProperties: false
	};
	const SOURCE_LIST_VALUE_SCHEMA = {
		type: "object",
		properties: {
			target: { type: "string" },
			groupId: { type: "string" },
			status: { type: "string", enum: ["inactive", "activating", "active", "error"] }
		},
		additionalProperties: false
	};
	const SOURCE_MUTE_VALUE_SCHEMA = {
		type: "object",
		required: ["sourceId", "isMuted"],
		properties: { sourceId: { type: "string" }, isMuted: { type: "boolean" } },
		additionalProperties: false
	};
	const SOURCE_VISIBILITY_VALUE_SCHEMA = {
		type: "object",
		required: ["sourceId", "isVisible"],
		properties: { sourceId: { type: "string" }, isVisible: { type: "boolean" } },
		additionalProperties: false
	};
	const SOURCE_CONNECTION_MODE_VALUE_SCHEMA = {
		type: "object",
		required: ["sourceId", "mode"],
		properties: {
			sourceId: { type: "string" },
			mode: { type: "string", enum: ["classic", "websocket", "tiktok-websocket", "tiktok-legacy"] }
		},
		additionalProperties: false
	};

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
		resetmap: true,
		creditsStart: true,
		creditsPreview: true,
		creditsTest: true,
		creditsReset: true
	};

	const REMOTE_SSN_ACTION_DESCRIPTORS = {
		nextInQueue: {
			owner: "dock",
			phase: 1,
			category: "overlay",
			label: "Next queued message",
			risk: "mutating",
			requires: ["defaultDock"],
			callback: "guaranteed"
		},
		clearOverlay: {
			owner: "dock",
			phase: 1,
			category: "overlay",
			label: "Clear featured overlay",
			risk: "mutating",
			requires: ["defaultDock"],
			callback: "guaranteed"
		},
		nextPinned: {
			owner: "dock",
			phase: 1,
			category: "overlay",
			label: "Feature next pinned message",
			risk: "mutating",
			requires: ["defaultDock"],
			callback: "guaranteed"
		},
		getQueueSize: {
			owner: "dock",
			phase: 2,
			category: "queue",
			label: "Get queue size",
			risk: "read-only",
			requires: ["defaultDock"],
			callback: "guaranteed"
		},
		clearHistory: {
			owner: "background",
			phase: 1,
			category: "history",
			label: "Clear saved history",
			risk: "destructive",
			confirmation: true,
			callback: "guaranteed"
		},
		sendChat: {
			owner: "background",
			phase: 1,
			category: "chat",
			label: "Send chat message",
			risk: "mutating",
			valueSchema: { type: "string", maxLength: 2000 },
			requires: ["writableCaptureSource"],
			callback: "guaranteed"
		},
		starttimer: {
			owner: "background",
			phase: 1,
			category: "timer",
			label: "Start timer",
			risk: "mutating",
			callback: "guaranteed"
		},
		pausetimer: {
			owner: "background",
			phase: 1,
			category: "timer",
			label: "Pause timer",
			risk: "mutating",
			callback: "guaranteed"
		},
		resettimer: {
			owner: "background",
			phase: 1,
			category: "timer",
			label: "Reset timer",
			risk: "destructive",
			confirmation: true,
			valueSchema: {
				type: "object",
				required: ["confirm"],
				properties: { confirm: { const: true } },
				additionalProperties: false
			},
			callback: "guaranteed"
		},
		gettimerstate: {
			owner: "background",
			phase: 1,
			category: "timer",
			label: "Get timer state",
			risk: "read-only",
			callback: "guaranteed"
		},
		getpollpresets: {
			owner: "background",
			phase: 1,
			category: "poll",
			label: "Get poll presets",
			risk: "read-only",
			callback: "guaranteed"
		},
		creditsStart: {
			owner: "background",
			phase: 1,
			category: "credits",
			label: "Start credits",
			risk: "mutating",
			requires: ["creditsPage"],
			callback: "guaranteed"
		},
		creditsPreview: {
			owner: "background",
			phase: 1,
			category: "credits",
			label: "Preview credits",
			risk: "mutating",
			requires: ["creditsPage"],
			callback: "guaranteed"
		},
		creditsTest: {
			owner: "background",
			phase: 1,
			category: "credits",
			label: "Test credits",
			risk: "mutating",
			requires: ["creditsPage"],
			callback: "guaranteed"
		},
		creditsReset: {
			owner: "background",
			phase: 1,
			category: "credits",
			label: "Reset credits",
			risk: "destructive",
			requires: ["creditsPage"],
			callback: "guaranteed"
		}
	};

	const SSAPP_ACTION_DESCRIPTORS = {
		getSources: { owner: "ssapp", phase: 1, category: "sources", label: "List desktop sources", risk: "read-only", valueSchema: SOURCE_LIST_VALUE_SCHEMA, callback: "guaranteed" },
		getSource: { owner: "ssapp", phase: 1, category: "sources", label: "Get desktop source", risk: "read-only", valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		addSource: { owner: "ssapp", phase: 3, category: "sources", label: "Add desktop source", risk: "mutating", callback: "guaranteed" },
		updateSource: { owner: "ssapp", phase: 3, category: "sources", label: "Edit desktop source", risk: "mutating", callback: "guaranteed" },
		removeSource: { owner: "ssapp", phase: 3, category: "sources", label: "Remove desktop source", risk: "destructive", confirmation: true, valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		startSource: { owner: "ssapp", phase: 1, category: "sources", label: "Start desktop source", risk: "mutating", valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		stopSource: { owner: "ssapp", phase: 1, category: "sources", label: "Stop desktop source", risk: "disruptive", valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		restartSource: { owner: "ssapp", phase: 1, category: "sources", label: "Restart desktop source", risk: "disruptive", valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		setSourceVisibility: { owner: "ssapp", phase: 1, category: "sources", label: "Set desktop window visibility", risk: "mutating", valueSchema: SOURCE_VISIBILITY_VALUE_SCHEMA, callback: "guaranteed" },
		toggleSourceVisibility: { owner: "ssapp", phase: 1, category: "sources", label: "Toggle desktop window visibility", risk: "mutating", valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		setSourceMute: { owner: "ssapp", phase: 1, category: "sources", label: "Set desktop capture audio", risk: "mutating", valueSchema: SOURCE_MUTE_VALUE_SCHEMA, callback: "guaranteed" },
		toggleSourceMute: { owner: "ssapp", phase: 1, category: "sources", label: "Toggle desktop capture audio", risk: "mutating", valueSchema: SOURCE_ID_VALUE_SCHEMA, callback: "guaranteed" },
		setSourceConnectionMode: { owner: "ssapp", phase: 3, category: "sources", label: "Set source connection mode", risk: "disruptive", confirmation: true, valueSchema: SOURCE_CONNECTION_MODE_VALUE_SCHEMA, callback: "guaranteed" }
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

	function cloneDescriptorValue(value) {
		if (Array.isArray(value)) {
			return value.map(cloneDescriptorValue);
		}
		if (value && typeof value === "object") {
			const cloned = {};
			Object.keys(value).forEach(function (key) {
				cloned[key] = cloneDescriptorValue(value[key]);
			});
			return cloned;
		}
		return value;
	}

	function cloneDescriptorMap(source) {
		const cloned = {};
		Object.keys(source || {}).forEach(function (action) {
			cloned[action] = cloneDescriptorValue(source[action] || {});
		});
		return cloned;
	}

	function decorateSsappRemoteContract(capabilities) {
		const wrapper = { ssapp: capabilities };
		const remoteActions = {};
		const availability = {};
		Object.keys(SSAPP_ACTIONS).forEach(function (action) {
			const supported = isSsappActionSupported(action, wrapper);
			remoteActions[action] = supported;
			availability[action] = supported
				? { state: "available" }
				: {
						state: "unavailable",
						reason: capabilities.available === true ? "SSApp does not advertise this source capability." : "SSApp is not available."
					};
		});
		capabilities.remoteActions = remoteActions;
		capabilities.actionDescriptors = cloneDescriptorMap(SSAPP_ACTION_DESCRIPTORS);
		capabilities.actionAvailability = availability;
		return capabilities;
	}

	function buildSsappCapabilities(options = {}) {
		if (!options.available) {
			return decorateSsappRemoteContract({
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
			});
		}

		return decorateSsappRemoteContract({
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
		});
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

	function normalizeRemoteRequest(request) {
		if (!request || typeof request !== "object" || Array.isArray(request) || !isSsappRequest(request) || typeof request.value !== "string") {
			return request;
		}
		const value = request.value.trim();
		if (!value || (value[0] !== "{" && value[0] !== "[")) {
			return request;
		}
		try {
			const parsed = JSON.parse(value);
			if (!parsed || typeof parsed !== "object") {
				return request;
			}
			return { ...request, value: parsed };
		} catch (error) {
			return request;
		}
	}

	function normalizeAvailability(value, fallbackState, fallbackReason) {
		if (typeof value === "string") {
			value = { state: value };
		}
		if (!value || typeof value !== "object") {
			value = { state: fallbackState };
		}
		const state = ["available", "unavailable", "unknown"].includes(value.state) ? value.state : fallbackState;
		const normalized = { state };
		const reason = value.reason || fallbackReason;
		if (reason) {
			normalized.reason = String(reason);
		}
		return normalized;
	}

	function buildSsnAvailability(options = {}) {
		const overrides = options.ssnAvailability || {};
		const backgroundAvailable = options.backgroundAvailable !== false;
		const availability = {};
		Object.keys(REMOTE_SSN_ACTION_DESCRIPTORS).forEach(function (action) {
			const descriptor = REMOTE_SSN_ACTION_DESCRIPTORS[action];
			if (Object.prototype.hasOwnProperty.call(overrides, action)) {
				availability[action] = normalizeAvailability(overrides[action], "unknown", "Availability was not reported.");
				return;
			}
			if (descriptor.owner === "dock") {
				availability[action] = {
					state: "unknown",
					reason: "Requires a connected default Dock page."
				};
				return;
			}
			if (action === "sendChat") {
				availability[action] = backgroundAvailable
					? { state: "unknown", reason: "Requires at least one writable capture source." }
					: { state: "unavailable", reason: "Social Stream remote control is unavailable." };
				return;
			}
			if (descriptor.requires && descriptor.requires.indexOf("creditsPage") !== -1) {
				availability[action] = backgroundAvailable
					? { state: "unknown", reason: "Requires a connected Credits page." }
					: { state: "unavailable", reason: "Social Stream remote control is unavailable." };
				return;
			}
			availability[action] = backgroundAvailable
				? { state: "available" }
				: { state: "unavailable", reason: "Social Stream remote control is unavailable." };
		});
		return availability;
	}

	function buildCapabilities(options = {}) {
		const ssappOptions = options.ssapp || {};
		const runtime = options.runtime || (ssappOptions.available ? "electron" : "web");
		const hostInstanceId = options.hostInstanceId ? String(options.hostInstanceId) : null;
		return {
			type: "capabilities",
			version: REMOTE_CONTROL_PROTOCOL_VERSION,
			protocol: {
				name: "ssn-remote-control",
				version: REMOTE_CONTROL_PROTOCOL_VERSION
			},
			role: REMOTE_CONTROL_ROLE,
			hostInstanceId,
			host: {
				role: REMOTE_CONTROL_ROLE,
				instanceId: hostInstanceId,
				runtime
			},
			runtime,
			ssapp: buildSsappCapabilities(ssappOptions),
			ssn: {
				actions: { ...SSN_ACTIONS },
				actionDescriptors: cloneDescriptorMap(REMOTE_SSN_ACTION_DESCRIPTORS),
				actionAvailability: buildSsnAvailability(options)
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

	function isVersionedRequest(request) {
		if (!request || typeof request !== "object") {
			return false;
		}
		const version = Number(request.protocolVersion !== undefined ? request.protocolVersion : request.protocol);
		return isFinite(version) && version >= REMOTE_CONTROL_PROTOCOL_VERSION;
	}

	function validateVersionedRequest(request) {
		if (!isVersionedRequest(request)) {
			return { ok: true };
		}
		if (typeof request.action !== "string" || !request.action.trim()) {
			return { ok: false, code: "INVALID_REQUEST", message: "A version 2 request requires an action." };
		}
		if (typeof request.get !== "string" || !request.get.trim()) {
			return { ok: false, code: "MISSING_CORRELATION_ID", message: "A version 2 request requires a correlation ID." };
		}
		if (request.get.length > REMOTE_CONTROL_MAX_CORRELATION_LENGTH) {
			return { ok: false, code: "INVALID_CORRELATION_ID", message: "The correlation ID is too long." };
		}
		try {
			if (JSON.stringify(request).length > REMOTE_CONTROL_MAX_REQUEST_LENGTH) {
				return { ok: false, code: "PAYLOAD_TOO_LARGE", message: "The remote-control request is too large." };
			}
		} catch (error) {
			return { ok: false, code: "INVALID_REQUEST", message: "The remote-control request is not serializable." };
		}
		return { ok: true };
	}

	function getActionOwner(action) {
		const normalized = normalizeAction(action);
		if (SSAPP_ACTIONS[normalized]) {
			return "ssapp";
		}
		const descriptor = REMOTE_SSN_ACTION_DESCRIPTORS[normalized];
		return descriptor ? descriptor.owner : null;
	}

	function isRemoteSsnRequest(request, owner) {
		if (!request || typeof request !== "object") {
			return false;
		}
		const descriptor = REMOTE_SSN_ACTION_DESCRIPTORS[normalizeAction(request.action)];
		if (!descriptor) {
			return false;
		}
		return !owner || descriptor.owner === owner;
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

	function makeResponse(request, payload, status) {
		const resolvedStatus = status || (payload && payload.accepted === true ? "accepted" : "completed");
		return {
			ok: true,
			status: resolvedStatus,
			request: request && request.get ? request.get : null,
			payload
		};
	}

	function makeError(request, code, message) {
		return {
			ok: false,
			status: "failed",
			request: request && request.get ? request.get : null,
			error: {
				code,
				message: message || code
			}
		};
	}

	function normalizeCommandResult(request, result) {
		if (result && typeof result === "object" && !Array.isArray(result) && typeof result.ok === "boolean") {
			const normalized = { ...result };
			normalized.request = request && request.get ? request.get : normalized.request || null;
			normalized.status = normalized.status || (normalized.ok ? (normalized.payload && normalized.payload.accepted === true ? "accepted" : "completed") : "failed");
			return normalized;
		}
		if (result === false || result === null || result === undefined) {
			return makeError(request, "COMMAND_FAILED", "The command owner did not complete the request.");
		}
		return makeResponse(request, typeof result === "object" ? result : { value: result });
	}

	return {
		REMOTE_CONTROL_PROTOCOL_VERSION,
		REMOTE_CONTROL_ROLE,
		REMOTE_CONTROL_MAX_REQUEST_LENGTH,
		REMOTE_CONTROL_MAX_CORRELATION_LENGTH,
		SSAPP_ACTIONS,
		SSN_ACTIONS,
		REMOTE_SSN_ACTION_DESCRIPTORS,
		SSAPP_ACTION_DESCRIPTORS,
		buildCapabilities,
		buildSsappCapabilities,
		buildSsnAvailability,
		normalizeAction,
		isCapabilityRequest,
		isVersionedRequest,
		validateVersionedRequest,
		getActionOwner,
		isRemoteSsnRequest,
		isSsappRequest,
		isSsappActionSupported,
		validateRemoteSsappRequest,
		normalizeRemoteRequest,
		makeResponse,
		makeError,
		normalizeCommandResult
	};
});
