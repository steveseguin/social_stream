(function () {
	const HOST = "https://vpzone.tv";
	const SOURCE_NAME = "VPZone";
	const SOURCE_IMG = HOST + "/favicon.ico";
	const CONFIG_KEY = "vpzoneWsConfig";
	const DEFAULT_CONFIG = { channel: "", wsUrl: "wss://vpzone.tv/ws", token: "" };
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
		currentChannel: "",
		lastViewerCount: null,
		lastStatus: "",
		lastMessage: "",
		seenIds: new Set(),
		seenOrder: []
	};
	const wsProxy = {
		readyState: READY_STATE.CLOSED,
		close: function () { disconnect(true); },
		send: function () {
			log("VPZone WebSocket source is read-only. Sending chat is not supported.", "warn");
			return false;
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
		chip(els.authChip, state.cfg.token ? "Auth: token set" : "Auth: public", state.cfg.token ? "good" : "");
	}

	function normalizeChannel(value) {
		var raw = String(value || "").trim();
		var match;
		if (!raw) return "";
		try { raw = new URL(raw).pathname || raw; } catch (e) {
			if (raw.indexOf("://") === -1 && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) {
				try { raw = new URL("https://" + raw).pathname || raw; } catch (err) {}
			}
		}
		match = raw.match(/(?:^|\/)(?:stream|chat-dock)\/([^/?#]+)/i);
		if (match && match[1]) raw = decodeURIComponent(match[1]);
		return raw.replace(/^[#/]+/, "").replace(/^@+/, "").replace(/^\/+/, "").replace(/[/?#].*$/, "").trim();
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
		url.searchParams.set("stream", channel);
		if (state.cfg.token) url.searchParams.set("mode", "developer");
		else url.searchParams.delete("mode");
		return url.toString();
	}

	function loadConfig() {
		var query;
		var hash;
		var saved = {};
		try { saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") || {}; } catch (e) {}
		state.cfg.channel = normalizeChannel(saved.channel || "");
		state.cfg.wsUrl = normalizeWs(saved.wsUrl || DEFAULT_CONFIG.wsUrl);
		state.cfg.token = typeof saved.token === "string" ? saved.token : "";
		query = new URLSearchParams(window.location.search);
		hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
		if (query.get("channel") || query.get("username") || query.get("streamUsername") || hash.get("channel") || hash.get("username")) state.cfg.channel = normalizeChannel(query.get("channel") || query.get("username") || query.get("streamUsername") || hash.get("channel") || hash.get("username"));
		if (query.get("ws") || query.get("endpoint") || hash.get("ws") || hash.get("endpoint")) state.cfg.wsUrl = normalizeWs(query.get("ws") || query.get("endpoint") || hash.get("ws") || hash.get("endpoint"));
		if (query.get("token") || query.get("auth") || hash.get("token") || hash.get("auth")) state.cfg.token = String(query.get("token") || query.get("auth") || hash.get("token") || hash.get("auth") || "");
	}

	function saveConfig() {
		try { localStorage.setItem(CONFIG_KEY, JSON.stringify(state.cfg)); } catch (e) {}
	}

	function syncUiToState() {
		state.cfg.channel = normalizeChannel(els.channel ? els.channel.value : state.cfg.channel);
		state.cfg.wsUrl = normalizeWs(els.wsUrl ? els.wsUrl.value : state.cfg.wsUrl);
		state.cfg.token = String(els.token ? els.token.value : state.cfg.token || "");
		saveConfig();
		updateAuthChip();
		updateLink();
	}

	function syncStateToUi() {
		if (els.channel) els.channel.value = state.cfg.channel || "";
		if (els.wsUrl) els.wsUrl.value = state.cfg.wsUrl || DEFAULT_CONFIG.wsUrl;
		if (els.token) els.token.value = state.cfg.token || "";
		updateAuthChip();
		updateLink();
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

	function eventTime(ev) {
		return ev && (ev.createdAt || ev.timestamp || ev.sentAt) ? (ev.createdAt || ev.timestamp || ev.sentAt) : "";
	}

	function mapEventName(value) {
		value = String(value || "").toLowerCase();
		if (value === "viewer_join") return "joined";
		if (value === "viewer_quit") return "left";
		if (value === "follow") return "new_follower";
		if (value === "subscribe") return "new_subscriber";
		return value;
	}

	function buildChat(ev) {
		var data = basePayload();
		data.chatname = esc(ev.actorDisplayName || ev.displayName || ev.actorUsername || ev.username || "VPZone User");
		data.chatmessage = renderMessage(ev.message || ev.text || ev.body || "");
		data.chatimg = absUrl(ev.actorAvatarUrl || ev.avatarUrl || ev.actorAvatar || "");
		data.contentimg = absUrl(ev.contentimg || ev.contentImage || ev.imageUrl || "");
		data.membership = ev.metadata && ev.metadata.actorRank ? nice(ev.metadata.actorRank) : "";
		data.nameColor = ev.actorNameColor || ev.nameColor || "#c084fc";
		data.userid = ev.actorUserId != null ? String(ev.actorUserId) : (ev.userId != null ? String(ev.userId) : (ev.actorUsername || ev.username || ""));
		data.timestamp = eventTime(ev);
		data.meta = { id: ev.id != null ? ev.id : null, streamUsername: ev.streamUsername || state.currentChannel || state.cfg.channel, createdAt: eventTime(ev), actorUsername: ev.actorUsername || ev.username || "", actorRank: ev.metadata && ev.metadata.actorRank ? ev.metadata.actorRank : "", rawEventType: ev.eventType || ev.type || "chat_message", transport: "websocket" };
		return data.chatname && data.chatmessage ? data : null;
	}

	function buildEvent(ev) {
		var mapped = mapEventName(ev.eventType || ev.type || "");
		var data;
		if (!mapped || mapped === "presence" || mapped === "chat_message") return null;
		if (state.settings.captureevents === false || state.settings.hideevents) return null;
		if (mapped === "joined" && state.settings.capturejoinedevent === false) return null;
		data = basePayload();
		data.event = mapped;
		data.chatname = esc(ev.actorDisplayName || ev.displayName || ev.actorUsername || ev.username || SOURCE_NAME);
		data.chatmessage = mapped;
		data.chatimg = absUrl(ev.actorAvatarUrl || ev.avatarUrl || ev.actorAvatar || "");
		data.membership = ev.metadata && ev.metadata.actorRank ? nice(ev.metadata.actorRank) : "";
		data.nameColor = ev.actorNameColor || ev.nameColor || "#c084fc";
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

	function handleEvent(ev) {
		var key;
		var data;
		if (!ev || typeof ev !== "object") return;
		key = ev.id != null ? ev.id : [eventTime(ev), ev.actorUsername || ev.username || "", ev.eventType || ev.type || "", ev.message || ev.text || ""].join("::");
		if (!remember(key)) return;
		data = String(ev.eventType || ev.type || "").toLowerCase() === "chat_message" ? buildChat(ev) : buildEvent(ev);
		if (!data) return;
		pushMessage(data);
		appendFeed(data);
		chip(els.lastEventChip, "Last event: " + nice(data.event || ev.eventType || ev.type || "message"), data.event ? "warn" : "good");
	}

	function routePayload(payload) {
		var type;
		var ev;
		if (Array.isArray(payload)) { payload.forEach(routePayload); return; }
		if (!payload || typeof payload !== "object") return;
		if (Array.isArray(payload.events)) { payload.events.forEach(routePayload); return; }
		type = String(payload.type || "").toLowerCase();
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
		if (payload.eventType || payload.actorUsername || payload.actorDisplayName || payload.message) {
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
							if (request.type === "SEND_MESSAGE") { log("VPZone WebSocket source is read-only. Chat send is not supported.", "warn"); sendResponse(false); return; }
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
			if (request.type === "SEND_MESSAGE") log("VPZone WebSocket source is read-only. Chat send is not supported.", "warn");
		});
	}

	function bindUi() {
		if (els.save) els.save.addEventListener("click", function () { syncUiToState(); syncStateToUi(); log("Configuration saved.", "success"); });
		if (els.connect) els.connect.addEventListener("click", function () { try { connect(); } catch (error) { setStatus("error", "Connect failed: " + ((error && error.message) || error)); log("Connect failed: " + ((error && error.message) || error), "error"); syncButtons(); } });
		if (els.disconnect) els.disconnect.addEventListener("click", function () { disconnect(true); });
		if (els.channel) {
			els.channel.addEventListener("change", function () { state.cfg.channel = normalizeChannel(els.channel.value); updateLink(); });
			els.channel.addEventListener("keydown", function (event) { if (event.key === "Enter" && !state.active && els.connect) { event.preventDefault(); els.connect.click(); } });
		}
		if (els.wsUrl) els.wsUrl.addEventListener("change", function () { els.wsUrl.value = normalizeWs(els.wsUrl.value); });
		if (els.token) els.token.addEventListener("change", function () { state.cfg.token = String(els.token.value || ""); updateAuthChip(); });
	}

	function cacheElements() {
		els.channel = document.getElementById("channel-input");
		els.wsUrl = document.getElementById("ws-url");
		els.token = document.getElementById("auth-token");
		els.save = document.getElementById("save-config");
		els.connect = document.getElementById("connect-btn");
		els.disconnect = document.getElementById("disconnect-btn");
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
		syncStateToUi();
		chip(els.socketChip, "Socket: disconnected", "bad");
		chip(els.viewerChip, "Viewers: -", "");
		chip(els.lastEventChip, "Last event: Waiting", "");
		bindUi();
		bridge();
		syncButtons();
		log("VPZone WebSocket source ready.", "success");
		if (state.cfg.channel) {
			try { connect(); } catch (error) {
				setStatus("error", "Auto-connect failed: " + ((error && error.message) || error));
				log("Auto-connect failed: " + ((error && error.message) || error), "error");
				syncButtons();
			}
		}
		window.addEventListener("beforeunload", function () { disconnect(false); });
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
	else boot();
})();
