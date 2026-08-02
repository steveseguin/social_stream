(function (root, factory) {
	var api = factory();
	if (typeof module === "object" && module.exports) {
		module.exports = api;
	}
	if (root) {
		root.SocialStreamLocalServer = api;
	}
})(typeof self !== "undefined" ? self : this, function () {
	"use strict";

	var DEFAULT_PORT = 3000;
	var MIN_PORT = 1024;
	var MAX_PORT = 65535;

	function normalizeExplicitPort(value) {
		if (typeof value === "number") {
			if (!Number.isInteger(value)) return null;
		} else if (typeof value === "string") {
			value = value.trim();
			if (!/^\d+$/.test(value)) return null;
			value = parseInt(value, 10);
		} else {
			return null;
		}

		if (value < MIN_PORT || value > MAX_PORT) return null;
		return value;
	}

	function getSearchParams(searchParams) {
		if (searchParams && typeof searchParams.get === "function") {
			return searchParams;
		}
		if (typeof window !== "undefined" && window.location) {
			return new URLSearchParams(window.location.search);
		}
		return null;
	}

	function getExplicitPort(searchParams) {
		var params = getSearchParams(searchParams);
		if (!params) return null;
		return normalizeExplicitPort(params.get("localserverport"));
	}

	function getPort(searchParams) {
		return getExplicitPort(searchParams) || DEFAULT_PORT;
	}

	function getWebSocketUrl(searchParams) {
		return "ws://127.0.0.1:" + getPort(searchParams);
	}

	return {
		DEFAULT_PORT: DEFAULT_PORT,
		MIN_PORT: MIN_PORT,
		MAX_PORT: MAX_PORT,
		normalizeExplicitPort: normalizeExplicitPort,
		getExplicitPort: getExplicitPort,
		getPort: getPort,
		getWebSocketUrl: getWebSocketUrl
	};
});
