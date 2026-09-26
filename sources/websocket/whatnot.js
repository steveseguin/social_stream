(function () {
	const SOCKET_URL = "wss://www.whatnot.com/services/live/socket/websocket?vsn=2.0.0&client_type=web&client_layer=nextjs&locale=en-US";
	const BRIDGE_SOURCE = "ssn-whatnot-extension";
	const LOADED_ATTR = "data-ssn-whatnot-ws-loaded";
	const MAX_SEEN_IDS = 2000;
	const els = {};

	// The page owns the connection; a later content-script injection supplies the
	// normal extension/app bridge without opening a second socket.
	installRuntimeBridge();
	if (window.__SSN_WHATNOT_WS_LOADED__) return;
	window.__SSN_WHATNOT_WS_LOADED__ = true;
	if (document.documentElement.getAttribute(LOADED_ATTR) === "1") return;
	document.documentElement.setAttribute(LOADED_ATTR, "1");

	let socket = null;
	let reconnectTimer = null;
	let heartbeatTimer = null;
	let timeoutTimer = null;
	let persistTimer = null;
	let active = false;
	let joined = false;
	let bridgeReady = false;
	let booted = false;
	let showId = "";
	let attempts = 0;
	let reference = 0;
	let pendingHeartbeat = null;
	let openedAt = 0;
	let seenIds = new Set();
	let historyInitialized = false;
	let captureEnabled = true;
	let sourceSettings = {};
	let lastStatus = "disconnected";
	let lastStatusMessage = "Waiting to connect.";

	function runtimeAvailable() {
		return typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
	}

	function installRuntimeBridge() {
		if (!runtimeAvailable() || window.__SSN_WHATNOT_RUNTIME_BRIDGE__) return;
		window.__SSN_WHATNOT_RUNTIME_BRIDGE__ = true;
		try {
			chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
				if (request === "getSource") { sendResponse("whatnot"); return; }
				if (request === "focusChat") { sendResponse(false); return; }
				if (request && typeof request === "object" && ("settings" in request || "state" in request)) {
					window.postMessage({ source: BRIDGE_SOURCE, request: request }, "*");
					sendResponse(true);
					return;
				}
				sendResponse(false);
			});
			chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
				if (chrome.runtime.lastError) return;
				window.postMessage({ source: BRIDGE_SOURCE, request: response || {}, ready: true }, "*");
			});
		} catch (e) {}
	}

	function relay(payload) {
		try {
			if (runtimeAvailable()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, function () {});
				return;
			}
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
				return;
			}
			window.postMessage(payload, "*");
		} catch (e) {}
	}

	function setStatus(status, message) {
		lastStatus = status;
		lastStatusMessage = message;
		if (els.status) {
			els.status.textContent = message;
			els.status.setAttribute("data-connected", status === "connected" ? "true" : "false");
			els.connect.disabled = active;
			els.disconnect.disabled = !active;
			els.channel.disabled = active;
		}
		if (bridgeReady) relay({ wssStatus: { platform: "whatnot", status: status, message: message } });
	}

	function normalizeShowId(value) {
		var raw = String(value || "").trim();
		var uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
		if (uuid.test(raw)) return raw.toLowerCase();
		try {
			var url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
			if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port || !/^(?:www\.)?whatnot\.com$/i.test(url.hostname)) return "";
			var match = url.pathname.match(/^\/(?:dashboard\/)?live\/([^/]+)\/?$/i);
			return match && uuid.test(match[1]) ? match[1].toLowerCase() : "";
		} catch (e) { return ""; }
	}

	function storageKey() { return "whatnotWsSeen:" + showId; }

	function persistSeenIds() {
		clearTimeout(persistTimer);
		persistTimer = null;
		if (!showId) return;
		try { sessionStorage.setItem(storageKey(), JSON.stringify({ initialized: historyInitialized, ids: Array.from(seenIds) })); } catch (e) {}
	}

	function loadSeenIds() {
		seenIds = new Set();
		historyInitialized = false;
		try {
			var saved = JSON.parse(sessionStorage.getItem(storageKey()) || "null");
			if (!saved || !Array.isArray(saved.ids)) return;
			seenIds = new Set(saved.ids.filter(function (id) { return typeof id === "string"; }).slice(-MAX_SEEN_IDS));
			historyInitialized = saved.initialized === true;
		} catch (e) {}
	}

	function rememberId(id) {
		if (typeof id !== "string" || !id) return false;
		if (seenIds.has(id)) return true;
		seenIds.add(id);
		while (seenIds.size > MAX_SEEN_IDS) seenIds.delete(seenIds.values().next().value);
		if (!persistTimer) persistTimer = setTimeout(persistSeenIds, 1000);
		return false;
	}

	function receiveChat(payload, history) {
		if (!payload || typeof payload !== "object" || (payload.topic && payload.topic !== "chat:" + showId)) return;
		if (rememberId(payload.id)) return;
		if (history && !historyInitialized) return;
		if (!captureEnabled) return;
		window.SSNWhatnotChat.processMessage(payload, "chat:" + showId);
	}

	function renderMessage(data) {
		if (!captureEnabled) return;
		relay({ message: data });
		const row = document.createElement("div");
		row.className = "message";
		const name = document.createElement("span");
		name.className = "chatname";
		// The shared parser escapes HTML unless text-only mode is enabled.
		function plainText(value) {
			if (data.textonly) return String(value || "");
			const text = document.createElement("div");
			text.innerHTML = String(value || "");
			return text.textContent || "";
		}
		name.textContent = plainText(data.chatname) + ": ";
		row.appendChild(name);
		row.appendChild(document.createTextNode(plainText(data.chatmessage)));
		const feed = els.feed;
		const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
		feed.appendChild(row);
		while (feed.children.length > 200) feed.removeChild(feed.firstChild);
		if (nearBottom) feed.scrollTop = feed.scrollHeight;
	}

	function clearSocket() {
		clearInterval(heartbeatTimer);
		clearTimeout(timeoutTimer);
		heartbeatTimer = null;
		timeoutTimer = null;
		pendingHeartbeat = null;
		joined = false;
		const previous = socket;
		socket = null;
		if (previous) {
			previous.onopen = previous.onmessage = previous.onerror = previous.onclose = null;
			try { previous.close(); } catch (e) {}
		}
	}

	function scheduleReconnect(message) {
		clearSocket();
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
		if (!active) return;
		const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempts++, 5))) + Math.floor(Math.random() * 500);
		setStatus("reconnecting", message + " Retrying in " + Math.ceil(delay / 1000) + " seconds.");
		reconnectTimer = setTimeout(openSocket, delay);
	}

	function send(topic, event, payload, joinRef) {
		const ref = String(++reference);
		socket.send(JSON.stringify([joinRef || null, ref, topic, event, payload || {}]));
		return ref;
	}

	function openSocket() {
		reconnectTimer = null;
		if (!active) return;
		clearSocket();
		setStatus("connecting", "Connecting to Whatnot chat...");
		let current;
		try { current = new WebSocket(SOCKET_URL); } catch (e) { scheduleReconnect("Could not open chat."); return; }
		socket = current;
		let joinRef = null;
		let recoverHistory = historyInitialized;
		timeoutTimer = setTimeout(function () { if (socket === current) scheduleReconnect("Chat connection timed out."); }, 15000);
		current.onopen = function () {
			if (socket !== current) return;
			openedAt = Date.now();
			joinRef = String(reference + 1);
			try { send("chat:" + showId, "phx_join", {}, joinRef); }
			catch (e) { scheduleReconnect("Chat connection lost."); return; }
			heartbeatTimer = setInterval(function () {
				if (socket !== current) return;
				if (pendingHeartbeat) {
					if (Date.now() - pendingHeartbeat.at >= 20000) scheduleReconnect("Chat stopped responding.");
					return;
				}
				try { pendingHeartbeat = { ref: send("phoenix", "heartbeat"), at: Date.now() }; }
				catch (e) { scheduleReconnect("Chat connection lost."); }
			}, 10000);
		};
		current.onmessage = function (event) {
			if (socket !== current || typeof event.data !== "string") return;
			let frame;
			try { frame = JSON.parse(event.data); } catch (e) { return; }
			if (!Array.isArray(frame) || frame.length !== 5) return;
			const topic = frame[2];
			const kind = frame[3];
			const payload = frame[4] || {};
			if (topic === "phoenix" && kind === "phx_reply") {
				if (pendingHeartbeat && frame[1] === pendingHeartbeat.ref && payload.status === "ok") {
					pendingHeartbeat = null;
					if (joined && Date.now() - openedAt >= 30000) attempts = 0;
				}
				return;
			}
			if (topic !== "chat:" + showId) return;
			if (kind === "phx_reply" && frame[1] === joinRef) {
				if (payload.status !== "ok") {
					disconnect();
					setStatus("error", "This show's public chat is unavailable. Check the live show link and reconnect.");
					return;
				}
				joined = true;
				clearTimeout(timeoutTimer);
				setStatus("connected", "Connected to Whatnot chat.");
			} else if (kind === "phx_error" || kind === "phx_close") {
				scheduleReconnect("Chat connection closed.");
			} else if (joined && kind === "new_msg") {
				receiveChat(payload, false);
			} else if (joined && kind === "latest_messages" && Array.isArray(payload.messages)) {
				// First connection establishes a baseline. Reconnects recover only
				// unseen messages in the server's limited recent-message snapshot.
				payload.messages.slice().reverse().forEach(function (message) { receiveChat(message, !recoverHistory); });
				historyInitialized = true;
				recoverHistory = true;
				persistSeenIds();
			}
		};
		current.onerror = function () { if (socket === current) scheduleReconnect("Could not connect to Whatnot chat."); };
		current.onclose = function () { if (socket === current) scheduleReconnect("Chat disconnected."); };
	}

	function connect() {
		if (active) return;
		if (!window.ninjafy || !window.SSNWhatnotChat) {
			setStatus("error", "Open this chat source in an updated Social Stream desktop app.");
			return;
		}
		if (!bridgeReady) { setStatus("connecting", "Waiting for the app connection..."); return; }
		const nextShowId = normalizeShowId(els.channel.value);
		if (!nextShowId) { setStatus("error", "Enter a Whatnot live show URL or its full show ID."); return; }
		persistSeenIds();
		if (showId !== nextShowId) els.feed.textContent = "";
		showId = nextShowId;
		els.channel.value = showId;
		loadSeenIds();
		active = true;
		attempts = 0;
		openSocket();
	}

	function disconnect() {
		active = false;
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
		clearSocket();
		persistSeenIds();
		setStatus("disconnected", "Disconnected.");
	}

	window.addEventListener("message", function (event) {
		if (event.source !== window || !event.data || event.data.source !== BRIDGE_SOURCE) return;
		const request = event.data.request || {};
		if ("settings" in request) sourceSettings = request.settings || {};
		if ("state" in request) captureEnabled = !!request.state;
		if (window.SSNWhatnotChat) window.SSNWhatnotChat.configure({ settings: sourceSettings, onMessage: renderMessage });
		if (event.data.ready) {
			bridgeReady = true;
			setStatus(lastStatus, lastStatusMessage);
			if (booted && els.channel.value) connect();
		}
	});
	window.addEventListener("online", function () {
		if (active && !joined) { clearTimeout(reconnectTimer); openSocket(); }
	});
	window.addEventListener("pagehide", disconnect);

	function boot() {
		els.channel = document.getElementById("channel-input");
		els.connect = document.getElementById("connect-button");
		els.disconnect = document.getElementById("disconnect-button");
		els.status = document.getElementById("socket-state");
		els.feed = document.getElementById("chat-feed");
		if (!els.channel || !els.connect || !els.disconnect || !els.status || !els.feed) return;
		const params = new URLSearchParams(window.location.search);
		els.channel.value = params.get("channel") || params.get("videoId") || params.get("url") || "";
		document.getElementById("connection-form").addEventListener("submit", function (event) { event.preventDefault(); connect(); });
		els.disconnect.addEventListener("click", disconnect);
		booted = true;
		if (window.SSNWhatnotChat) window.SSNWhatnotChat.configure({ settings: sourceSettings, onMessage: renderMessage });
		if (els.channel.value) connect();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
	else boot();
})();
