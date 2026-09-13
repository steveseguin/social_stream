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

	// Explicit relay addresses (including a trusted LAN host) keep precedence.
	// localserver selects a default endpoint; it does not enable new routes.
	function getRelayUrl(searchParams, parameter, defaultUrl) {
		var params = getSearchParams(searchParams);
		var explicitUrl = params && parameter ? params.get(parameter) : null;
		return explicitUrl || (params && params.has("localserver") ? getWebSocketUrl(params) : defaultUrl);
	}

	// Games and displays can receive captured chat directly from the extension route,
	// even with no Dock open to republish it on the API feed. Explicit
	// API-feed choices keep their existing channels.
	function getChatRelayConfig(searchParams) {
		var params = getSearchParams(searchParams);
		// An explicit API relay keeps its original address and channel even when
		// a generated local link also carries the captured-chat flag.
		var extensionFeed = !!(params && params.has("server2") && !params.get("server"));
		return {
			enabled: !!(params && (params.has("server") || extensionFeed)),
			url: getRelayUrl(params, extensionFeed ? "server2" : "server",
				extensionFeed ? "wss://io.socialstream.ninja/extension" : "wss://io.socialstream.ninja"),
			out: extensionFeed ? 3 : 2,
			in: extensionFeed ? 4 : 1
		};
	}

	// Opt-in relay adapter for older display templates. Returning false leaves their
	// existing WebRTC path untouched when no supported server route is requested.
	function connectLocalRelay(searchParams, session, receive, featured) {
		var params = getSearchParams(searchParams);
		if (!params || !session) return false;
		var parameter = params.has("server") ? "server" : params.has("server2") ? "server2" : params.has("server3") ? "server3" : null;
		if (!parameter || (!featured && parameter === "server3")) return false;
		var endpoint = getRelayUrl(params, parameter, parameter === "server" ? "wss://io.socialstream.ninja/api" : "wss://io.socialstream.ninja/extension");
		var channel = featured ? (parameter === "server" ? 2 : parameter === "server2" ? 4 : 1) : (parameter === "server" ? 1 : 4);
		var socket, retry, closed = false;
		function connect() {
			if (closed) return;
			try { socket = new WebSocket(endpoint); }
			catch (error) { console.warn("[Local Relay] Invalid relay address", error); return; }
			socket.onopen = function () { socket.send(JSON.stringify({ join: session.split(",")[0], out: 3, in: channel })); };
			socket.onmessage = function (event) {
				try {
					var data = JSON.parse(event.data);
					if (data && data.target && data.target !== "null" && data.target !== (params.get("label") || (featured ? "overlay" : "dock"))) return;
					receive(data && Object.prototype.hasOwnProperty.call(data, "overlayNinja") ? data.overlayNinja : data);
				} catch (error) { console.warn("[Local Relay] Display message failed", error); }
			};
			socket.onerror = function () { socket.close(); };
			socket.onclose = function () { if (!closed) retry = setTimeout(connect, 3000); };
		}
		window.addEventListener("beforeunload", function () {
			closed = true;
			clearTimeout(retry);
			if (socket) socket.close();
		});
		connect();
		return true;
	}

	return {
		DEFAULT_PORT: DEFAULT_PORT,
		MIN_PORT: MIN_PORT,
		MAX_PORT: MAX_PORT,
		normalizeExplicitPort: normalizeExplicitPort,
		getExplicitPort: getExplicitPort,
		getPort: getPort,
		getWebSocketUrl: getWebSocketUrl,
		getRelayUrl: getRelayUrl,
		getChatRelayConfig: getChatRelayConfig,
		connectLocalRelay: connectLocalRelay
	};
});
