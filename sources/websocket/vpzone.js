(function () {
	const HOST = "https://vpzone.tv";
	const SOURCE_NAME = "VPZone";
	const SOURCE_IMG = HOST + "/favicon.ico";
	const CONFIG_KEY = "vpzoneWsConfig";
	const TOKEN_KEY = "vpzoneWsTokens";
	const OAUTH_KEY = "vpzoneOAuthState";
	const DEFAULT_CLIENT_ID = "e63ceeb6-e9e6-4732-a7eb-a8f1613a2686";
	const DEFAULT_SCOPES = "profile:read chat:read chat:write";
	const DEFAULT_CONFIG = { channel: "", wsUrl: "wss://chat.nexus-7.vpzone.tv/ws", token: "", clientId: DEFAULT_CLIENT_ID, redirectUri: "", scopes: DEFAULT_SCOPES, hideMetrics: false };
	const RECONNECT_DELAY_MS = 4000;
	const MAX_SEEN_IDS = 1500;
	const READY_STATE = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

	try {
		if (window.__SSN_VPZONE_WS_LOADED__) return;
		window.__SSN_VPZONE_WS_LOADED__ = true;
	} catch (e) {}

	const els = {};
	const state = {
		cfg: Object.assign({}, DEFAULT_CONFIG),
		settings: {},
		isExtensionOn: true,
		active: false,
		manualDisconnect: false,
		socket: null,
		reconnectTimer: null,
		refreshTimer: null,
		currentChannel: "",
		lastViewerCount: null,
		lastStatus: "",
		lastMessage: "",
		tokens: null,
		seenIds: new Set(),
		seenOrder: [],
		avatarCache: new Map(),
		avatarPending: new Map(),
		avatarNegativeUntil: new Map()
	};
	const wsProxy = {
		readyState: READY_STATE.CLOSED,
		close: function () { disconnect(true); },
		send: function (rawMessage) {
			sendChatMessage(rawMessage).catch(function (error) {
				log("VPZone chat send failed: " + ((error && error.message) || error), "error");
			});
			return true;
		}
	};

	try { window.websocket = wsProxy; } catch (e) {}

	function extAvailable() {
		return typeof chrome !== "undefined" && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
	}

	function relay(payload) {
		if (!payload || typeof payload !== "object") return;
		try {
			if (extAvailable() && chrome.runtime.id) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, function () {});
				return;
			}
		} catch (e) {}
		try {
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== "undefined" ? window.__SSAPP_TAB_ID__ : null);
				return;
			}
		} catch (e) {}
		try {
			var forwarded = Object.assign({}, payload);
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined") forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			window.postMessage(forwarded, "*");
		} catch (e) {}
	}

	function pushMessage(data) {
		if (!state.isExtensionOn || !data || typeof data !== "object") return;
		relay({ message: data });
	}

	function pushStatus(status, message, meta) {
		var payload = { platform: "vpzone", status: String(status || ""), message: message || "" };
		if (meta && typeof meta === "object") {
			Object.keys(meta).forEach(function (key) {
				if (typeof meta[key] !== "undefined") payload[key] = meta[key];
			});
		}
		relay({ wssStatus: payload });
	}

	function esc(value) {
		return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function stripHtml(value) {
		try {
			var div = document.createElement("div");
			div.innerHTML = String(value || "");
			return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
		} catch (e) {
			return String(value || "").replace(/\s+/g, " ").trim();
		}
	}

	function absUrl(value) {
		try { return value ? new URL(value, HOST).href : ""; } catch (e) { return value || ""; }
	}

	function nice(value) {
		return String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
	}

	function mergeScopes(value) {
		var scopes = String((value || "") + " " + DEFAULT_SCOPES).split(/\s+/);
		var seen = {};
		var out = [];
		scopes.forEach(function (scope) {
			scope = String(scope || "").trim();
			if (!scope || seen[scope]) return;
			seen[scope] = true;
			out.push(scope);
		});
		return out.join(" ");
	}

	function base64Url(bytes) {
		var binary = "";
		var arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
		for (var i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
		return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
	}

	function randomVerifier() {
		var bytes = new Uint8Array(64);
		try { crypto.getRandomValues(bytes); } catch (e) {
			for (var i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
		}
		return base64Url(bytes);
	}

	function codeChallenge(verifier) {
		if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") {
			return Promise.reject(new Error("PKCE requires crypto.subtle support."));
		}
		return crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (digest) {
			return base64Url(digest);
		});
	}

	function defaultRedirectUri() {
		var href = String(window.location.href || "").split("#")[0].split("?")[0];
		if (!href) return "";
		return normalizeHostedRedirectUri(href) || href;
	}

	function normalizeHostedRedirectUri(value) {
		var url;
		try {
			url = new URL(String(value || "").trim());
		} catch (e) {
			return "";
		}
		if (!/^https:\/\/(?:beta\.)?socialstream\.ninja$/i.test(url.origin)) return "";
		if (!/\/(?:beta\/)?sources\/websocket\/vpzone(?:\.html)?$/i.test(url.pathname)) return "";
		url.pathname = url.pathname.replace(/vpzone\.html$/i, "vpzone");
		url.search = "";
		url.hash = "";
		return url.toString();
	}

	function normalizeRedirectUri(value) {
		var raw = String(value || "").trim();
		if (!raw) return defaultRedirectUri();
		return normalizeHostedRedirectUri(raw) || raw;
	}

	function ssappOAuthHandler() {
		try {
			if (window.ninjafy && typeof window.ninjafy.startVpzoneOAuth === "function") return window.ninjafy.startVpzoneOAuth;
		} catch (e) {}
		try {
			if (window.__ssapp && typeof window.__ssapp.startVpzoneOAuth === "function") return window.__ssapp.startVpzoneOAuth;
		} catch (e) {}
		return null;
	}

	function shouldUseSsappOAuth() {
		try {
			var query = new URLSearchParams(window.location.search || "");
			var hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
			return query.has("ssapp") || hash.has("ssapp") || window.location.protocol === "file:";
		} catch (e) {
			return window.location.protocol === "file:";
		}
	}

	function loadTokens() {
		try {
			var saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
			state.tokens = saved && saved.access_token ? saved : null;
		} catch (e) {
			state.tokens = null;
		}
		if (state.tokens && state.tokens.access_token) state.cfg.token = state.tokens.access_token;
	}

	function saveTokens() {
		try {
			if (state.tokens && state.tokens.access_token) localStorage.setItem(TOKEN_KEY, JSON.stringify(state.tokens));
			else localStorage.removeItem(TOKEN_KEY);
		} catch (e) {}
	}

	function scheduleRefresh() {
		if (state.refreshTimer) {
			clearTimeout(state.refreshTimer);
			state.refreshTimer = null;
		}
		if (!state.tokens || !state.tokens.refresh_token || !state.tokens.expires_at) return;
		var delay = Math.max(5000, Number(state.tokens.expires_at) - Date.now() - 60000);
		state.refreshTimer = setTimeout(function () {
			refreshOAuthToken().catch(function (error) {
				log("OAuth refresh failed: " + ((error && error.message) || error), "error");
				updateAuthChip();
			});
		}, delay);
	}

	function cleanupOAuthUrl() {
		try {
			var url = new URL(window.location.href);
			["code", "state", "error", "error_description"].forEach(function (key) { url.searchParams.delete(key); });
			history.replaceState({}, document.title, url.toString());
		} catch (e) {}
	}

	function jsonErrorMessage(json, fallback) {
		if (json && json.error_description) return String(json.error_description);
		if (json && typeof json.error === "string") return json.error;
		if (json && json.error && json.error.message) return String(json.error.message);
		if (json && json.message) return String(json.message);
		return fallback;
	}

	function jsonFetchError(message, status) {
		var error = new Error(message);
		if (status) error.status = status;
		return error;
	}

	function fetchJson(url, options) {
		options = options || {};
		var headers = options.headers || { Accept: "application/json" };
		return fetch(url, {
			method: options.method || "GET",
			cache: "no-store",
			credentials: "omit",
			headers: headers,
			body: options.body
		}).then(function (response) {
			return response.text().then(function (text) {
				var json = {};
				try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { error: text || "Invalid JSON response" }; }
				if (!response.ok) throw jsonFetchError(jsonErrorMessage(json, "HTTP " + response.status), response.status);
				return json;
			});
		}).catch(function (error) {
			if (!extAvailable()) throw error;
			return new Promise(function (resolve, reject) {
				try {
					chrome.runtime.sendMessage(chrome.runtime.id, {
						type: "toBackground",
						data: {
							cmd: "vpzoneFetchJson",
							url: url,
							method: options.method || "GET",
							body: options.body || "",
							contentType: headers["Content-Type"] || headers["content-type"] || "",
							authToken: options.authToken || ""
						}
					}, function (response) {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message || "VPZone background fetch failed"));
							return;
						}
						if (!response || !response.ok) {
							reject(jsonFetchError((response && response.error) || "VPZone background fetch failed", response && response.status));
							return;
						}
						resolve(response.data || {});
					});
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	function tokenRequest(params) {
		var body = new URLSearchParams();
		Object.keys(params || {}).forEach(function (key) {
			if (params[key] != null && params[key] !== "") body.set(key, params[key]);
		});
		return fetchJson(HOST + "/api/oauth/token", {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
			body: body.toString()
		});
	}

	function storeTokenResponse(json) {
		if (!json || !json.access_token) throw new Error("VPZONE did not return an access token.");
		state.tokens = {
			access_token: json.access_token,
			token_type: json.token_type || "Bearer",
			refresh_token: json.refresh_token || (state.tokens && state.tokens.refresh_token) || "",
			expires_at: json.expires_in ? Date.now() + (Number(json.expires_in) * 1000) : null
		};
		state.cfg.token = state.tokens.access_token;
		saveTokens();
		saveConfig();
		syncStateToUi();
		updateAuthChip();
		scheduleRefresh();
	}

	function exchangeOAuthCode(code, saved) {
		if (!code) return Promise.reject(new Error("Missing OAuth code."));
		saved = saved || {};
		return tokenRequest({
			grant_type: "authorization_code",
			client_id: state.cfg.clientId || DEFAULT_CLIENT_ID,
			code: code,
			redirect_uri: saved.redirectUri || normalizeRedirectUri(state.cfg.redirectUri),
			code_verifier: saved.verifier || ""
		}).then(function (json) {
			storeTokenResponse(json);
			log("VPZONE OAuth token acquired.", "success");
			return json;
		});
	}

	function refreshOAuthToken() {
		if (!state.tokens || !state.tokens.refresh_token) return Promise.resolve(null);
		return tokenRequest({
			grant_type: "refresh_token",
			client_id: state.cfg.clientId || DEFAULT_CLIENT_ID,
			refresh_token: state.tokens.refresh_token
		}).then(function (json) {
			storeTokenResponse(json);
			log("VPZONE OAuth token refreshed.", "success");
			return json;
		});
	}

	function startOAuth() {
		syncUiToState();
		var externalOAuth = ssappOAuthHandler();
		if (externalOAuth && shouldUseSsappOAuth()) return startExternalOAuth(externalOAuth);
		var verifier = randomVerifier();
		var stateValue = randomVerifier().slice(0, 32);
		var redirectUri = normalizeRedirectUri(state.cfg.redirectUri);
		var saved = {
			state: stateValue,
			verifier: verifier,
			redirectUri: redirectUri,
			channel: state.cfg.channel,
			wsUrl: state.cfg.wsUrl,
			scopes: state.cfg.scopes || DEFAULT_SCOPES,
			createdAt: Date.now()
		};
		return codeChallenge(verifier).then(function (challenge) {
			try { localStorage.setItem(OAUTH_KEY, JSON.stringify(saved)); } catch (e) {}
			var url = new URL(HOST + "/oauth/authorize");
			url.searchParams.set("response_type", "code");
			url.searchParams.set("client_id", state.cfg.clientId || DEFAULT_CLIENT_ID);
			url.searchParams.set("redirect_uri", redirectUri);
			url.searchParams.set("scope", state.cfg.scopes || DEFAULT_SCOPES);
			url.searchParams.set("state", stateValue);
			url.searchParams.set("code_challenge", challenge);
			url.searchParams.set("code_challenge_method", "S256");
			window.location.href = url.toString();
		});
	}

	function startExternalOAuth(handler) {
		handler = handler || ssappOAuthHandler();
		if (!handler) return Promise.reject(new Error("VPZONE desktop OAuth is unavailable."));
		return handler({
			clientId: state.cfg.clientId || DEFAULT_CLIENT_ID,
			scopes: String(state.cfg.scopes || DEFAULT_SCOPES).split(/\s+/).filter(Boolean)
		}).then(function (result) {
			if (!result || !result.success) throw new Error((result && result.error) || "VPZONE OAuth did not complete.");
			if (result.redirectUri) state.cfg.redirectUri = result.redirectUri;
			if (result.access_token) {
				storeTokenResponse(result);
				log("VPZONE OAuth token acquired.", "success");
				return result;
			}
			if (result.code) {
				return exchangeOAuthCode(result.code, {
					verifier: result.codeVerifier || "",
					redirectUri: result.redirectUri || normalizeRedirectUri(state.cfg.redirectUri)
				});
			}
			throw new Error("VPZONE OAuth did not return a token.");
		}).then(function (result) {
			connect();
			return result;
		});
	}

	function clearOAuth() {
		state.tokens = null;
		state.cfg.token = "";
		saveTokens();
		saveConfig();
		syncStateToUi();
		updateAuthChip();
		log("VPZONE auth cleared.", "warn");
	}

	function handleOAuthCallback() {
		var query = new URLSearchParams(window.location.search);
		var code = query.get("code");
		var returnedState = query.get("state");
		var error = query.get("error");
		var saved = {};
		if (!code && !error) {
			scheduleRefresh();
			return Promise.resolve(false);
		}
		try { saved = JSON.parse(localStorage.getItem(OAUTH_KEY) || "{}") || {}; } catch (e) {}
		cleanupOAuthUrl();
		if (error) return Promise.reject(new Error(query.get("error_description") || error));
		if (saved.state && returnedState && saved.state !== returnedState) return Promise.reject(new Error("OAuth state mismatch."));
		if (saved.channel) state.cfg.channel = normalizeChannel(saved.channel);
		if (saved.wsUrl) state.cfg.wsUrl = normalizeWs(saved.wsUrl);
		if (saved.scopes) state.cfg.scopes = saved.scopes;
		state.cfg.redirectUri = saved.redirectUri || normalizeRedirectUri(state.cfg.redirectUri);
		try { localStorage.removeItem(OAUTH_KEY); } catch (e) {}
		return exchangeOAuthCode(code, saved).then(function () { return true; });
	}

	function addLine(parent, className, html) {
		if (!parent) return;
		var entry = document.createElement("div");
		entry.className = className;
		entry.innerHTML = html;
		parent.appendChild(entry);
		while (parent.children.length > 250) parent.removeChild(parent.firstChild);
		parent.scrollTop = parent.scrollHeight;
	}

	function log(message, level) {
		var color = "#8ab8ff";
		level = level || "info";
		if (level === "success") color = "#7ef0c4";
		else if (level === "warn") color = "#ffd98b";
		else if (level === "error") color = "#ff9eaa";
		addLine(els.log, "log-entry", '<div class="log-meta" style="color:' + color + ';">' + esc(new Date().toLocaleTimeString()) + " [" + esc(level.toUpperCase()) + ']</div><div>' + esc(message || "") + "</div>");
	}

	function chip(element, text, tone) {
		if (!element) return;
		element.className = "chip";
		if (tone) element.classList.add(tone);
		element.textContent = text;
	}

	function setStatus(status, message, meta) {
		if (state.lastStatus === status && state.lastMessage === message) return;
		state.lastStatus = status;
		state.lastMessage = message || "";
		chip(els.socketChip, "Socket: " + (status || "disconnected"), status === "connected" ? "good" : (status === "connecting" ? "warn" : (status === "error" ? "bad" : "bad")));
		if (els.statusText && message) els.statusText.textContent = message;
		pushStatus(status, message, meta || {});
	}

	function updateAuthChip() {
		if (state.tokens && state.tokens.access_token) {
			chip(els.authChip, "Auth: OAuth", "good");
			return;
		}
		chip(els.authChip, state.cfg.token ? "Auth: token set" : "Auth: public", state.cfg.token ? "good" : "");
	}

	function normalizeChannel(value) {
		var raw = String(value || "").trim();
		var match;
		if (!raw) return "";
		try {
			var parsedUrl = new URL(raw);
			raw = parsedUrl.searchParams.get("channel") || parsedUrl.searchParams.get("username") || parsedUrl.searchParams.get("streamUsername") || parsedUrl.pathname || raw;
		} catch (e) {
			if (raw.indexOf("://") === -1 && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) {
				try {
					var inferredUrl = new URL("https://" + raw);
					raw = inferredUrl.searchParams.get("channel") || inferredUrl.searchParams.get("username") || inferredUrl.searchParams.get("streamUsername") || inferredUrl.pathname || raw;
				} catch (err) {}
			}
		}
		match = raw.match(/(?:^|\/)(?:watch|stream|chat-dock)\/([^/?#]+)/i);
		if (match && match[1]) raw = decodeURIComponent(match[1]);
		return raw.replace(/^[#/]+/, "").replace(/^@+/, "").replace(/^\/+/, "").replace(/[/?#].*$/, "").trim().toLowerCase();
	}

	function isGenericChannel(value) {
		var channel = String(value || "").trim().toLowerCase();
		return channel === "vpzone" || channel === "vpzone.tv" || channel === "www.vpzone.tv";
	}

	function normalizeWs(value) {
		var raw = String(value || "").trim();
		try {
			if (!raw) return DEFAULT_CONFIG.wsUrl;
			if (raw.indexOf("://") === -1) raw = (window.location.protocol === "https:" ? "wss://" : "ws://") + raw.replace(/^\/+/, "");
			raw = new URL(raw).toString();
			return /^wss?:\/\//i.test(raw) ? raw : DEFAULT_CONFIG.wsUrl;
		} catch (e) {
			return DEFAULT_CONFIG.wsUrl;
		}
	}

	function buildSocketUrl(channel) {
		var url = new URL(normalizeWs(state.cfg.wsUrl));
		url.searchParams.set("channel", channel);
		if (state.cfg.token) url.searchParams.set("mode", "developer");
		else url.searchParams.delete("mode");
		return url.toString();
	}

	function outgoingText(raw) {
		var text = "";
		var parsed;
		if (raw && typeof raw === "object") {
			text = raw.message || raw.chatmessage || raw.body || raw.text || raw.content || "";
		} else {
			text = String(raw == null ? "" : raw);
			if (/^\s*\{/.test(text)) {
				try {
					parsed = JSON.parse(text);
					if (parsed && typeof parsed === "object") text = parsed.message || parsed.chatmessage || parsed.body || parsed.text || parsed.content || text;
				} catch (e) {}
			}
			if (/^PRIVMSG\s+/i.test(text) && text.indexOf(" :") !== -1) text = text.slice(text.indexOf(" :") + 2);
			else if (text.indexOf(" :") !== -1 && text.indexOf("\r\n") === -1) text = text.slice(text.indexOf(" :") + 2);
		}
		return String(text || "").replace(/[\r\n]+$/g, "").trim();
	}

	function postChatMessage(channel, message, token) {
		return fetchJson(HOST + "/api/v1/channels/" + encodeURIComponent(channel) + "/chat", {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + token },
			body: JSON.stringify({ message: message }),
			authToken: token
		});
	}

	function sendChatMessage(rawMessage, didRefresh) {
		var message = outgoingText(rawMessage);
		var channel = normalizeChannel(state.currentChannel || state.cfg.channel);
		var token = String(state.cfg.token || "");
		if (!message) return Promise.reject(new Error("Message is empty."));
		if (!channel) return Promise.reject(new Error("Channel is required."));
		if (!token) return Promise.reject(new Error("VPZone auth with chat:write is required."));
		return postChatMessage(channel, message, token).catch(function (error) {
			if (!didRefresh && error && error.status === 401 && state.tokens && state.tokens.refresh_token) {
				log("VPZone token expired. Refreshing OAuth token.", "warn");
				return refreshOAuthToken().then(function () {
					return postChatMessage(channel, message, String(state.cfg.token || ""));
				});
			}
			throw error;
		}).then(function (json) {
			log("Sent chat message to @" + channel + ".", "success");
			return json;
		});
	}

	function loadConfig() {
		var query;
		var hash;
		var saved = {};
		try { saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") || {}; } catch (e) {}
		state.cfg.channel = normalizeChannel(saved.channel || "");
		state.cfg.wsUrl = normalizeWs(saved.wsUrl || DEFAULT_CONFIG.wsUrl);
		state.cfg.token = typeof saved.token === "string" ? saved.token : "";
		state.cfg.clientId = typeof saved.clientId === "string" && saved.clientId ? saved.clientId : DEFAULT_CLIENT_ID;
		state.cfg.redirectUri = normalizeRedirectUri(saved.redirectUri || "");
		state.cfg.scopes = DEFAULT_SCOPES;
		state.cfg.hideMetrics = !!saved.hideMetrics;
		query = new URLSearchParams(window.location.search);
		hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
		var requestedChannel = normalizeChannel(query.get("channel") || query.get("username") || query.get("streamUsername") || hash.get("channel") || hash.get("username"));
		if (requestedChannel && !isGenericChannel(requestedChannel)) state.cfg.channel = requestedChannel;
		if (query.get("ws") || query.get("endpoint") || hash.get("ws") || hash.get("endpoint")) state.cfg.wsUrl = normalizeWs(query.get("ws") || query.get("endpoint") || hash.get("ws") || hash.get("endpoint"));
		if (query.get("token") || query.get("auth") || hash.get("token") || hash.get("auth")) state.cfg.token = String(query.get("token") || query.get("auth") || hash.get("token") || hash.get("auth") || "");
		if (query.get("client_id") || hash.get("client_id")) state.cfg.clientId = String(query.get("client_id") || hash.get("client_id") || DEFAULT_CLIENT_ID);
		if (query.get("redirect_uri") || hash.get("redirect_uri")) state.cfg.redirectUri = normalizeRedirectUri(query.get("redirect_uri") || hash.get("redirect_uri"));
		if (query.get("scope") || hash.get("scope")) state.cfg.scopes = mergeScopes(query.get("scope") || hash.get("scope") || DEFAULT_SCOPES);
	}

	function saveConfig() {
		try { localStorage.setItem(CONFIG_KEY, JSON.stringify(state.cfg)); } catch (e) {}
	}

	function syncUiToState() {
		state.cfg.channel = normalizeChannel(els.channel ? els.channel.value : state.cfg.channel);
		state.cfg.wsUrl = normalizeWs(els.wsUrl ? els.wsUrl.value : state.cfg.wsUrl);
		state.cfg.token = String(els.token ? els.token.value : state.cfg.token || "");
		state.cfg.hideMetrics = !!(els.hideMetrics && els.hideMetrics.checked);
		applyMetricsVisibility();
		saveConfig();
		updateAuthChip();
		updateLink();
	}

	function syncStateToUi() {
		if (els.channel) els.channel.value = state.cfg.channel || "";
		if (els.wsUrl) els.wsUrl.value = state.cfg.wsUrl || DEFAULT_CONFIG.wsUrl;
		if (els.token) els.token.value = state.cfg.token || "";
		if (els.hideMetrics) els.hideMetrics.checked = !!state.cfg.hideMetrics;
		applyMetricsVisibility();
		updateAuthChip();
		updateLink();
	}

	function applyMetricsVisibility() {
		if (typeof document !== "undefined" && document.body) {
			document.body.classList.toggle("hide-metrics", !!state.cfg.hideMetrics);
		}
	}

	function syncButtons() {
		if (els.connect) els.connect.disabled = !!state.active;
		if (els.disconnect) els.disconnect.disabled = !state.active;
	}

	function updateLink() {
		if (!els.channelLink) return;
		var channel = normalizeChannel(state.currentChannel || state.cfg.channel);
		if (!channel) {
			els.channelLink.href = HOST;
			els.channelLink.textContent = "vpzone.tv";
			return;
		}
		els.channelLink.href = HOST + "/chat-dock/" + encodeURIComponent(channel);
		els.channelLink.textContent = els.channelLink.href;
	}

	function remember(id) {
		var key = String(id);
		if (state.seenIds.has(key)) return false;
		state.seenIds.add(key);
		state.seenOrder.push(key);
		while (state.seenOrder.length > MAX_SEEN_IDS) state.seenIds.delete(state.seenOrder.shift());
		return true;
	}

	function renderMessage(text) {
		text = String(text == null ? "" : text);
		return state.settings && state.settings.textonlymode ? text : esc(text).replace(/\n/g, "<br>");
	}

	function basePayload() {
		return { chatbadges: [], backgroundColor: "", textColor: "", chatimg: "", hasDonation: "", membership: "", contentimg: "", textonly: !!(state.settings && state.settings.textonlymode), type: "vpzone", sourceName: SOURCE_NAME, sourceImg: SOURCE_IMG };
	}

	// VPZONE chat frames don't carry an avatar URL — fetch from the public
	// profile-card endpoint (no auth, ~5min CDN cache server-side) and remember
	// per username. Negative lookups are cached briefly to avoid hammering the
	// API when a chatter doesn't have a profile yet.
	function fetchAvatar(username) {
		if (!username) return Promise.resolve("");
		var key = String(username).toLowerCase();
		if (key === "system" || key === "anonymous") return Promise.resolve("");
		var cached = state.avatarCache.get(key);
		if (cached) return Promise.resolve(cached);
		var until = state.avatarNegativeUntil.get(key);
		if (until && until > Date.now()) return Promise.resolve("");
		var pending = state.avatarPending.get(key);
		if (pending) return pending;
		var promise = fetchJson(HOST + "/api/chat/profile-card/" + encodeURIComponent(username))
			.then(function (json) {
				var url = json && json.avatar_url ? absUrl(String(json.avatar_url)) : "";
				if (url) state.avatarCache.set(key, url);
				else state.avatarNegativeUntil.set(key, Date.now() + 5 * 60 * 1000);
				return url;
			})
			.catch(function () {
				state.avatarNegativeUntil.set(key, Date.now() + 60 * 1000);
				return "";
			})
			.then(function (url) {
				state.avatarPending.delete(key);
				return url;
			});
		state.avatarPending.set(key, promise);
		return promise;
	}

	function eventTime(ev) {
		return ev && (ev.createdAt || ev.timestamp || ev.sentAt || ev.ts) ? (ev.createdAt || ev.timestamp || ev.sentAt || ev.ts) : "";
	}

	function mapEventName(value) {
		value = String(value || "").toLowerCase();
		if (value === "msg" || value === "message" || value === "new_message" || value === "chat") return "chat_message";
		if (value === "viewer_join") return "joined";
		if (value === "viewer_quit") return "left";
		if (value === "follow") return "new_follower";
		if (value === "subscribe" || value === "subscription") return "new_subscriber";
		if (value === "gift") return "gift_subscription";
		if (value === "raid") return "raid";
		if (value === "clip") return "clip";
		if (value === "level_up") return "level_up";
		return value;
	}

	function svgBadge(label, bg, width) {
		width = width || Math.max(20, Math.round(String(label || "").length * 6.5) + 14);
		return { html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="16" viewBox="0 0 ' + width + ' 16"><rect x="0.5" y="0.5" rx="3" ry="3" width="' + (width - 1) + '" height="15" fill="' + esc(bg || "#c084fc") + '"></rect><text x="' + (width / 2) + '" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#ffffff">' + esc(label || "") + "</text></svg>", type: "svg" };
	}

	function buildBadges(ev) {
		var badges = [];
		var subMonths = Number(ev.sub_months || ev.subMonths || 0);
		var subLabel = subMonths >= 12 ? Math.floor(subMonths / 12) + "y" : (subMonths >= 1 ? subMonths + "m" : "SUB");
		if (Array.isArray(ev.chatbadges)) badges = badges.concat(ev.chatbadges);
		if (Array.isArray(ev.badges)) badges = badges.concat(ev.badges);
		if (ev.is_owner || ev.isOwner) badges.push(svgBadge("OP", "#c071f5", 20));
		if (ev.is_subscriber || ev.isSubscriber) badges.push(svgBadge(subLabel, ev.tier === "tier3" ? "#00E9E2" : (ev.tier === "tier2" ? "#FF6DE4" : "#f9376b")));
		if (ev.metadata && ev.metadata.source === "twitch") badges.push(svgBadge("TW", "#9146FF", 20));
		return badges;
	}

	function buildChat(ev) {
		var rawName = ev.actorDisplayName || ev.displayName || ev.actorUsername || ev.username || "";
		if (!rawName || String(rawName).toLowerCase() === "system") return null;
		var data = basePayload();
		data.chatname = esc(rawName);
		data.chatmessage = renderMessage(ev.message || ev.text || ev.body || ev.content || "");
		data.chatimg = absUrl(ev.actorAvatarUrl || ev.avatarUrl || ev.actorAvatar || ev.avatar_url || ev.profileImage || "");
		data.contentimg = absUrl(ev.contentimg || ev.contentImage || ev.imageUrl || "");
		data.chatbadges = buildBadges(ev);
		data.membership = ev.metadata && ev.metadata.actorRank ? nice(ev.metadata.actorRank) : ((ev.is_subscriber || ev.isSubscriber) ? "Subscriber" : "");
		data.nameColor = ev.actorNameColor || ev.nameColor || ev.color || "#c084fc";
		data.userid = ev.actorUserId != null ? String(ev.actorUserId) : (ev.userId != null ? String(ev.userId) : (ev.actorUsername || ev.username || ""));
		data.timestamp = eventTime(ev);
		data.meta = { id: ev.id != null ? ev.id : null, streamUsername: ev.streamUsername || state.currentChannel || state.cfg.channel, createdAt: eventTime(ev), actorUsername: ev.actorUsername || ev.username || "", actorRank: ev.metadata && ev.metadata.actorRank ? ev.metadata.actorRank : "", rawEventType: ev.eventType || ev.type || "chat_message", transport: "websocket", isSubscriber: !!(ev.is_subscriber || ev.isSubscriber), subMonths: Number(ev.sub_months || ev.subMonths || 0), isOwner: !!(ev.is_owner || ev.isOwner) };
		return data.chatname && data.chatmessage ? data : null;
	}

	function buildEvent(ev) {
		var mapped = mapEventName(ev.eventType || ev.type || "");
		var data;
		if (!mapped || mapped === "presence" || mapped === "chat_message") return null;
		if (state.settings.hideevents) return null;
		if (mapped === "joined" && state.settings.capturejoinedevent === false) return null;
		var rawName = ev.actorDisplayName || ev.displayName || ev.actorUsername || ev.username || "";
		if (!rawName || String(rawName).toLowerCase() === "system") return null;
		data = basePayload();
		data.event = mapped;
		data.chatname = esc(rawName);
		data.chatmessage = renderMessage(ev.body || ev.message || ev.text || mapped);
		data.chatimg = absUrl(ev.actorAvatarUrl || ev.avatarUrl || ev.actorAvatar || ev.avatar_url || ev.profileImage || "");
		data.chatbadges = buildBadges(ev);
		data.membership = ev.metadata && ev.metadata.actorRank ? nice(ev.metadata.actorRank) : ((ev.is_subscriber || ev.isSubscriber) ? "Subscriber" : "");
		data.nameColor = ev.actorNameColor || ev.nameColor || ev.color || "#c084fc";
		data.userid = ev.actorUserId != null ? String(ev.actorUserId) : (ev.userId != null ? String(ev.userId) : (ev.actorUsername || ev.username || ""));
		data.timestamp = eventTime(ev);
		data.meta = { id: ev.id != null ? ev.id : null, streamUsername: ev.streamUsername || state.currentChannel || state.cfg.channel, createdAt: eventTime(ev), actorUsername: ev.actorUsername || ev.username || "", actorRank: ev.metadata && ev.metadata.actorRank ? ev.metadata.actorRank : "", rawEventType: ev.eventType || ev.type || "", transport: "websocket" };
		if (mapped === "new_follower") data.meta.followedOn = eventTime(ev);
		if (mapped === "new_subscriber") data.meta.subscribedOn = eventTime(ev);
		return data.chatname ? data : null;
	}

	function appendFeed(data) {
		var avatar = data.chatimg ? '<img class="avatar" src="' + esc(data.chatimg) + '" alt="" />' : '<span class="avatar placeholder"></span>';
		var body = data.textonly ? esc(String(data.chatmessage || "")).replace(/\n/g, "<br>") : String(data.chatmessage || "");
		var label = data.event ? '<span class="event-pill">' + esc(data.chatmessage || data.event) + "</span>" : '<span class="feed-message">' + body + "</span>";
		addLine(els.feed, "feed-entry", '<div class="feed-top">' + avatar + '<div style="min-width:0;flex:1 1 auto;"><div class="feed-meta">' + esc(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()) + "</div><div><span class=\"feed-name\">" + esc(stripHtml(data.chatname || "")) + "</span></div><div class=\"feed-message\">" + label + "</div></div></div>");
	}

	function viewerCount(obj) {
		var values = [];
		function push(value) { if (typeof value !== "undefined" && value !== null) values.push(value); }
		if (!obj || typeof obj !== "object") return null;
		push(obj.viewerCount); push(obj.viewer_count); push(obj.viewers); push(obj.count); push(obj.online);
		if (obj.meta && typeof obj.meta === "object") { push(obj.meta.viewerCount); push(obj.meta.viewer_count); push(obj.meta.viewers); push(obj.meta.count); }
		if (obj.presence && typeof obj.presence === "object") { push(obj.presence.viewerCount); push(obj.presence.viewer_count); push(obj.presence.viewers); push(obj.presence.count); }
		if (obj.payload && typeof obj.payload === "object") { push(obj.payload.viewerCount); push(obj.payload.viewer_count); push(obj.payload.viewers); push(obj.payload.count); }
		if (obj.data && typeof obj.data === "object") { push(obj.data.viewerCount); push(obj.data.viewer_count); push(obj.data.viewers); push(obj.data.count); }
		for (var i = 0; i < values.length; i += 1) {
			var num = Number(values[i]);
			if (isFinite(num)) return num;
		}
		return null;
	}

	function handlePresence(obj) {
		var count = viewerCount(obj);
		if (count === null) {
			log("Presence update received.", "info");
			return;
		}
		count = Math.max(0, Math.round(count));
		chip(els.viewerChip, "Viewers: " + String(count), count > 0 ? "good" : "");
		chip(els.lastEventChip, "Last event: Presence", count > 0 ? "good" : "");
		if (state.lastViewerCount === count) return;
		state.lastViewerCount = count;
		if (state.settings.showviewercount || state.settings.hypemode) pushMessage({ type: "vpzone", event: "viewer_update", meta: count, sourceName: SOURCE_NAME, sourceImg: SOURCE_IMG });
	}

	// System frames whose body is just an announcement (e.g. join messages from
	// the server fallback path) carry no user identity worth surfacing. We drop
	// them so the dock doesn't render "system: alice just joined" rows.
	function isJoinAnnouncement(ev) {
		if (!ev) return false;
		var t = String(ev.eventType || ev.type || "").toLowerCase();
		if (t !== "system") return false;
		if (ev.metadata && ev.metadata.kind) return false;
		var body = String(ev.body || ev.message || ev.text || "");
		return /\bjust\s+joined\b/i.test(body);
	}

	// Some VPZONE system frames identify the real actor via `metadata.username`
	// (level_up, etc.) rather than the top-level `username` which is hard-coded
	// to "system". Lift it so downstream renderers attribute the row correctly.
	function liftSystemActor(ev) {
		if (!ev || String(ev.eventType || ev.type || "").toLowerCase() !== "system") return;
		var meta = ev.metadata;
		if (!meta || typeof meta !== "object") return;
		var name = meta.username || meta.actorUsername || meta.user || "";
		if (!name) return;
		ev.actorUsername = name;
		ev.actorDisplayName = meta.display_name || meta.actorDisplayName || name;
		if (meta.kind) ev.type = String(meta.kind);
	}

	function handleEvent(ev) {
		var key;
		if (!ev || typeof ev !== "object") return;
		if (isJoinAnnouncement(ev)) return;
		liftSystemActor(ev);
		key = ev.id != null ? ev.id : [eventTime(ev), ev.actorUsername || ev.username || "", ev.eventType || ev.type || "", ev.message || ev.text || ev.body || ev.content || ""].join("::");
		if (!remember(key)) return;
		var actor = ev.actorUsername || ev.username || "";
		var hasCarriedAvatar = !!(ev.actorAvatarUrl || ev.avatarUrl || ev.actorAvatar || ev.avatar_url || ev.profileImage);
		var enrich = hasCarriedAvatar ? Promise.resolve("") : fetchAvatar(actor);
		enrich.then(function (avatarUrl) {
			if (avatarUrl && !hasCarriedAvatar) ev.avatarUrl = avatarUrl;
			var data = mapEventName(ev.eventType || ev.type || "") === "chat_message" ? buildChat(ev) : buildEvent(ev);
			if (!data) return;
			pushMessage(data);
			appendFeed(data);
			chip(els.lastEventChip, "Last event: " + nice(data.event || ev.eventType || ev.type || "message"), data.event ? "warn" : "good");
		});
	}

	function isVpzoneFrame(payload) {
		if (!payload || typeof payload !== "object") return false;
		if (payload.eventType || payload.actorUsername || payload.actorDisplayName || payload.message) return true;
		if (payload.username && (payload.body != null || payload.text != null || payload.content != null)) return true;
		if (mapEventName(payload.type) === "chat_message") return true;
		return false;
	}

	function routePayload(payload) {
		var type;
		var ev;
		if (Array.isArray(payload)) { payload.forEach(routePayload); return; }
		if (!payload || typeof payload !== "object") return;
		if (Array.isArray(payload.events)) { payload.events.forEach(routePayload); return; }
		type = String(payload.type || "").toLowerCase();
		if (type === "delete_message") return;
		if (type === "presence") { handlePresence(payload); return; }
		if (type === "stream_event" || type === "chat_event") {
			ev = payload.event && typeof payload.event === "object" ? payload.event : payload.data;
			if (ev && String(ev.eventType || ev.type || "").toLowerCase() === "presence") handlePresence(ev);
			else handleEvent(ev);
			return;
		}
		if (payload.error || type === "error") {
			setStatus("error", "VPZone error: " + String(payload.error || payload.message || "Unknown error"), { channel: state.currentChannel, wsUrl: state.cfg.wsUrl });
			log("VPZone reported an error: " + String(payload.error || payload.message || "Unknown error"), "error");
			return;
		}
		if (payload.event && typeof payload.event === "object") {
			if (String(payload.event.eventType || payload.event.type || "").toLowerCase() === "presence") handlePresence(payload.event);
			else handleEvent(payload.event);
			return;
		}
		if (isVpzoneFrame(payload)) {
			if (String(payload.eventType || payload.type || "").toLowerCase() === "presence") handlePresence(payload);
			else handleEvent(payload);
			return;
		}
		if (viewerCount(payload) !== null) handlePresence(payload);
	}

	function clearReconnect() {
		if (!state.reconnectTimer) return;
		clearTimeout(state.reconnectTimer);
		state.reconnectTimer = null;
	}

	function closeSocket() {
		if (!state.socket) return;
		try {
			state.socket.onopen = null;
			state.socket.onmessage = null;
			state.socket.onerror = null;
			state.socket.onclose = null;
			state.socket.close();
		} catch (e) {}
		state.socket = null;
		wsProxy.readyState = READY_STATE.CLOSED;
	}

	function scheduleReconnect(reason) {
		if (!state.active || state.manualDisconnect || state.reconnectTimer) return;
		setStatus("connecting", "Socket closed. Reconnecting in 4s...", { channel: state.currentChannel, wsUrl: state.cfg.wsUrl });
		log(reason || "VPZone socket closed. Reconnecting soon.", "warn");
		state.reconnectTimer = setTimeout(function () {
			state.reconnectTimer = null;
			openSocket(true);
		}, RECONNECT_DELAY_MS);
	}

	function openSocket(isReconnect) {
		var channel = normalizeChannel(state.currentChannel || state.cfg.channel);
		var wsUrl;
		var socket;
		if (!state.active) return;
		if (!channel) throw new Error("Channel is required.");
		wsUrl = buildSocketUrl(channel);
		closeSocket();
		state.currentChannel = channel;
		updateLink();
		wsProxy.readyState = READY_STATE.CONNECTING;
		setStatus("connecting", (isReconnect ? "Reconnecting" : "Connecting") + " to @" + channel + "...", { channel: channel, wsUrl: wsUrl });
		log((isReconnect ? "Reconnecting" : "Connecting") + " to " + wsUrl + " for @" + channel + ".", "info");
		try { socket = new WebSocket(wsUrl); } catch (error) {
			setStatus("error", "WebSocket open failed: " + ((error && error.message) || error), { channel: channel, wsUrl: wsUrl });
			log("WebSocket open failed: " + ((error && error.message) || error), "error");
			scheduleReconnect("WebSocket construction failed.");
			return;
		}
		state.socket = socket;
		socket.onopen = function () {
			wsProxy.readyState = READY_STATE.OPEN;
			if (state.cfg.token) {
				try { socket.send(JSON.stringify({ type: "auth", token: state.cfg.token })); } catch (e) {}
			}
			setStatus("connected", "Connected to @" + channel + " via VPZone WebSocket.", { channel: channel, wsUrl: wsUrl });
			log("Connected to @" + channel + ".", "success");
			if (state.cfg.token) log("Developer auth payload sent.", "info");
		};
		socket.onmessage = function (event) {
			try { routePayload(JSON.parse(event.data)); } catch (e) { log("Ignoring non-JSON socket payload.", "warn"); }
		};
		socket.onerror = function () { log("VPZone socket error.", "error"); };
		socket.onclose = function (event) {
			var reason = "VPZone socket closed";
			state.socket = null;
			wsProxy.readyState = READY_STATE.CLOSED;
			if (event && typeof event.code !== "undefined") reason += " (code " + event.code + (event.reason ? ", " + event.reason : "") + ")";
			// 1008 = policy violation. The VPZONE chat server uses it for
			// "bad channel", "banned", and other unrecoverable rejections —
			// reconnecting would just loop forever, so stop the worker and
			// surface a meaningful message based on the close reason.
			if (event && event.code === 1008) {
				state.active = false;
				var rejReason = String(event.reason || "");
				var msg = /bad channel/i.test(rejReason)
					? "VPZone rejected channel @" + channel + "."
					: /banned/i.test(rejReason)
						? "VPZone banned this account from @" + channel + "."
						: "VPZone rejected the connection: " + (rejReason || "policy violation");
				setStatus("error", msg, { channel: channel, wsUrl: wsUrl });
				log(reason + ". " + msg, "error");
				syncButtons();
				return;
			}
			if (!state.active || state.manualDisconnect) {
				setStatus("disconnected", "Disconnected from VPZone.", { channel: channel, wsUrl: wsUrl });
				log(reason + ".", "warn");
				return;
			}
			scheduleReconnect(reason + ".");
		};
	}

	function connect() {
		syncUiToState();
		if (!state.cfg.channel) throw new Error("Channel is required.");
		state.active = true;
		state.manualDisconnect = false;
		state.currentChannel = state.cfg.channel;
		state.lastViewerCount = null;
		state.seenIds.clear();
		state.seenOrder = [];
		chip(els.viewerChip, "Viewers: -", "");
		chip(els.lastEventChip, "Last event: Waiting", "");
		syncButtons();
		clearReconnect();
		openSocket(false);
	}

	function disconnect(manual) {
		state.manualDisconnect = manual !== false;
		state.active = false;
		clearReconnect();
		closeSocket();
		setStatus("disconnected", manual ? "Disconnected from VPZone." : "VPZone socket stopped.");
		syncButtons();
	}

	function bridge() {
		if (extAvailable()) {
			try {
				chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
					try {
						if (request === "getSource") { sendResponse("vpzone"); return; }
						if (request === "focusChat") { sendResponse(false); return; }
						if (request && typeof request === "object") {
							if ("settings" in request) { state.settings = request.settings || {}; sendResponse(true); return; }
							if ("state" in request) { state.isExtensionOn = !!request.state; sendResponse(true); return; }
							if (request.type === "SEND_MESSAGE") {
								sendChatMessage(request.message).then(function () {
									sendResponse(true);
								}).catch(function (error) {
									log("VPZone SEND_MESSAGE failed: " + ((error && error.message) || error), "error");
									sendResponse(false);
								});
								return true;
							}
						}
					} catch (error) {
						log("Extension bridge error: " + ((error && error.message) || error), "error");
					}
					sendResponse(false);
				});
			} catch (e) {}
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
					if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) return;
					response = response || {};
					if ("settings" in response) state.settings = response.settings || {};
					if ("state" in response) state.isExtensionOn = !!response.state;
				});
			} catch (e) {}
		}
		window.addEventListener("message", function (event) {
			var request = event && event.data;
			if (!request || typeof request !== "object") return;
			if (request.__ssappSendToTab) request = request.__ssappSendToTab;
			if (request.type === "SEND_MESSAGE") {
				sendChatMessage(request.message).catch(function (error) {
					log("VPZone postMessage SEND_MESSAGE failed: " + ((error && error.message) || error), "error");
				});
			}
		});
	}

	function bindUi() {
		if (els.save) els.save.addEventListener("click", function () { syncUiToState(); syncStateToUi(); log("Configuration saved.", "success"); });
		if (els.authorize) els.authorize.addEventListener("click", function () { startOAuth().catch(function (error) { setStatus("error", "OAuth start failed: " + ((error && error.message) || error)); log("OAuth start failed: " + ((error && error.message) || error), "error"); }); });
		if (els.clearAuth) els.clearAuth.addEventListener("click", function () { clearOAuth(); });
		if (els.connect) els.connect.addEventListener("click", function () { try { connect(); } catch (error) { setStatus("error", "Connect failed: " + ((error && error.message) || error)); log("Connect failed: " + ((error && error.message) || error), "error"); syncButtons(); } });
		if (els.disconnect) els.disconnect.addEventListener("click", function () { disconnect(true); });
		if (els.channel) {
			els.channel.addEventListener("change", function () { state.cfg.channel = normalizeChannel(els.channel.value); updateLink(); });
			els.channel.addEventListener("keydown", function (event) { if (event.key === "Enter" && !state.active && els.connect) { event.preventDefault(); els.connect.click(); } });
		}
		if (els.wsUrl) els.wsUrl.addEventListener("change", function () { els.wsUrl.value = normalizeWs(els.wsUrl.value); });
		if (els.token) els.token.addEventListener("change", function () { state.cfg.token = String(els.token.value || ""); updateAuthChip(); });
		if (els.hideMetrics) els.hideMetrics.addEventListener("change", function () { state.cfg.hideMetrics = !!els.hideMetrics.checked; applyMetricsVisibility(); saveConfig(); });
		try { window.__SSAPP_START_VPZONE_AUTH__ = function () { return startExternalOAuth(); }; } catch (e) {}
	}

	function cacheElements() {
		els.channel = document.getElementById("channel-input");
		els.wsUrl = document.getElementById("ws-url");
		els.token = document.getElementById("auth-token");
		els.save = document.getElementById("save-config");
		els.authorize = document.getElementById("authorize-btn");
		els.clearAuth = document.getElementById("clear-auth-btn");
		els.connect = document.getElementById("connect-btn");
		els.disconnect = document.getElementById("disconnect-btn");
		els.hideMetrics = document.getElementById("hide-metrics");
		els.socketChip = document.getElementById("socket-chip");
		els.viewerChip = document.getElementById("viewer-chip");
		els.lastEventChip = document.getElementById("last-event-chip");
		els.authChip = document.getElementById("auth-chip");
		els.statusText = document.getElementById("status-text");
		els.channelLink = document.getElementById("channel-link");
		els.feed = document.getElementById("feed");
		els.log = document.getElementById("log");
	}

	function boot() {
		cacheElements();
		loadConfig();
		loadTokens();
		syncStateToUi();
		chip(els.socketChip, "Socket: disconnected", "bad");
		chip(els.viewerChip, "Viewers: -", "");
		chip(els.lastEventChip, "Last event: Waiting", "");
		bindUi();
		bridge();
		syncButtons();
		log("VPZone WebSocket source ready.", "success");
		handleOAuthCallback().then(function () {
			if (state.cfg.channel) {
				try { connect(); } catch (error) {
					setStatus("error", "Auto-connect failed: " + ((error && error.message) || error));
					log("Auto-connect failed: " + ((error && error.message) || error), "error");
					syncButtons();
				}
			}
		}).catch(function (error) {
			setStatus("error", "OAuth failed: " + ((error && error.message) || error));
			log("OAuth failed: " + ((error && error.message) || error), "error");
		});
		window.addEventListener("beforeunload", function () { disconnect(false); });
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
	else boot();
})();
