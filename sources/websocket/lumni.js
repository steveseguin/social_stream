// Lumni API source for Social Stream Ninja (sources/websocket/lumni.html).
// Polls the Lumni source API with the streamer's connection key and relays chat, gifts and join requests to SSN;
// replies typed in the SSN dock (SEND_MESSAGE) are posted to Lumni chat as the streamer.
// The key is a scoped, revocable token created in Lumni › Settings › Social Stream Ninja: it can only read this
// channel's public chat and post plain text there. It is kept in localStorage and never put in a URL.
(function () {
	const SOURCE = "lumni";
	const KEY_STORAGE = "lumniSsnKey";
	const DEFAULT_API = "https://app.lumni.live";
	const ALLOWED_API = /^https:\/\/(app|test)\.lumni\.live$|^http:\/\/localhost:\d+$/;
	const POLL_MS = 2000;
	const RETRY_MS = 5000;
	const KEY_FORMAT = /^lumni_ssn_[A-Za-z0-9_-]{59}$/;
	const LOADED_ATTR = "data-ssn-lumni-loaded";
	const BRIDGE_SOURCE = "ssn-lumni";
	const EXTENSION_MESSAGE = "ssn-lumni-extension-message";

	function extAvailable() {
		return typeof chrome !== "undefined" && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
	}

	// Loaded both as a page script and as the extension content script: the second copy only bridges runtime messages.
	try {
		const root = document.documentElement;
		if (window.__SSN_LUMNI_LOADED__ || (root && root.getAttribute(LOADED_ATTR) === "1")) {
			if (extAvailable()) installContentBridge();
			return;
		}
		window.__SSN_LUMNI_LOADED__ = true;
		if (root) root.setAttribute(LOADED_ATTR, "1");
	} catch (e) {}

	const state = { key: "", api: DEFAULT_API, son: null, istek: "", running: false, timer: null, isExtensionOn: true };

	function apiBase() {
		try {
			const p = new URLSearchParams(location.search).get("api");
			if (p && ALLOWED_API.test(p.replace(/\/+$/, ""))) return p.replace(/\/+$/, "");
		} catch (e) {}
		return DEFAULT_API;
	}

	function relay(payload) {
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
			const forwarded = Object.assign({}, payload);
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined") forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			window.postMessage(forwarded, "*");
		} catch (e) {}
	}

	function pushMessage(row) {
		if (!state.isExtensionOn || !row || typeof row !== "object") return;
		const data = Object.assign({ type: SOURCE }, row);
		data.type = SOURCE;
		relay({ message: data });
	}

	function pushStatus(status, message) {
		relay({ wssStatus: { platform: SOURCE, status: status, message: message || "" } });
	}

	const els = {};
	function setStatus(ok, text) {
		if (els.status) els.status.textContent = text;
		if (els.chip) {
			els.chip.textContent = "Connection: " + (ok ? "connected" : "disconnected");
			els.chip.className = "chip " + (ok ? "ok" : "bad");
		}
		if (els.connect) els.connect.disabled = state.running;
		if (els.disconnect) els.disconnect.disabled = !state.running;
	}

	async function post(path, body) {
		const res = await fetch(state.api + path, {
			method: "POST",
			cache: "no-store",
			credentials: "omit",
			headers: { authorization: "Bearer " + state.key, "content-type": "application/json" },
			body: JSON.stringify(body)
		});
		let json = {};
		try { json = await res.json(); } catch (e) {}
		return { status: res.status, json: json };
	}

	async function poll() {
		if (!state.running) return;
		let wait = POLL_MS;
		try {
			const r = await post("/api/ssn/olaylar", { son: state.son, istek: state.istek });
			if (r.status === 401) {
				stop("The key is no longer valid or the connection is closed in Lumni. Copy a new key from Lumni settings.");
				pushStatus("disconnected", "Lumni key invalid");
				return;
			}
			if (r.status !== 200 || r.json.durum !== "ok") throw new Error("HTTP " + r.status);
			const first = state.son === null;
			if (typeof r.json.son === "number") state.son = r.json.son;
			if (typeof r.json.istek === "string") state.istek = r.json.istek;
			const rows = (r.json.satirlar || []).concat(r.json.istekler || []);
			rows.forEach(pushMessage);
			if (rows.length && els.last) els.last.textContent = "Last event: " + new Date().toLocaleTimeString();
			if (first) {
				setStatus(true, "Connected to Lumni.");
				pushStatus("connected", "");
			}
		} catch (e) {
			wait = RETRY_MS;
			setStatus(false, "Lumni is not reachable right now; retrying…");
		}
		if (state.running) state.timer = setTimeout(poll, wait);
	}

	function start() {
		const key = (els.key && els.key.value.trim()) || state.key;
		if (!KEY_FORMAT.test(key)) {
			setStatus(false, "That does not look like a Lumni connection key (it starts with lumni_ssn_).");
			return;
		}
		state.key = key;
		try { localStorage.setItem(KEY_STORAGE, key); } catch (e) {}
		if (els.key) els.key.value = "";
		state.son = null;
		state.istek = "";
		state.running = true;
		setStatus(false, "Connecting…");
		poll();
	}

	function stop(text) {
		state.running = false;
		if (state.timer) clearTimeout(state.timer);
		state.timer = null;
		setStatus(false, text || "Disconnected.");
	}

	async function sendChatMessage(raw) {
		let text = raw && typeof raw === "object" ? raw.message || raw.chatmessage || raw.text || "" : String(raw == null ? "" : raw);
		text = String(text).replace(/<[^>]*>/g, "").trim();
		if (!text || !state.key) return false;
		const r = await post("/api/ssn/yaz", { metin: text.slice(0, 300) });
		if (r.status === 401) stop("The key is no longer valid; message not sent.");
		return r.status === 200 && r.json.durum === "ok";
	}

	function handleRequest(request, sendResponse) {
		if (request === "getSource") { sendResponse && sendResponse(SOURCE); return false; }
		if (request === "focusChat") { sendResponse && sendResponse(false); return false; }
		if (!request || typeof request !== "object") { sendResponse && sendResponse(false); return false; }
		if (request.__ssappSendToTab) request = request.__ssappSendToTab;
		if ("settings" in request || "state" in request) {
			if ("state" in request) state.isExtensionOn = !!request.state;
			sendResponse && sendResponse(true);
			return false;
		}
		if (request.type === "SEND_MESSAGE") {
			sendChatMessage(request.message).then(function (ok) { sendResponse && sendResponse(ok); }, function () { sendResponse && sendResponse(false); });
			return true;
		}
		sendResponse && sendResponse(false);
		return false;
	}

	// Content-script copy: forward runtime messages to the page script and page relays to the runtime.
	function installContentBridge() {
		if (window.__SSN_LUMNI_BRIDGE__) return;
		window.__SSN_LUMNI_BRIDGE__ = true;
		try {
			chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
				if (request === "getSource") { sendResponse(SOURCE); return; }
				if (request === "focusChat") { sendResponse(false); return; }
				if (request && typeof request === "object" && ("settings" in request || "state" in request || request.type === "SEND_MESSAGE")) {
					window.postMessage({ source: BRIDGE_SOURCE, type: EXTENSION_MESSAGE, request: request }, "*");
					sendResponse(true);
					return;
				}
				sendResponse(false);
			});
		} catch (e) {}
		window.addEventListener("message", function (event) {
			const m = event && event.data;
			if (event.source !== window || !m || typeof m !== "object" || m.source === BRIDGE_SOURCE) return;
			if (!("message" in m) && !("wssStatus" in m)) return;
			try { chrome.runtime.sendMessage(chrome.runtime.id, m, function () {}); } catch (e) {}
		});
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
				if (chrome.runtime.lastError) return;
				window.postMessage({ source: BRIDGE_SOURCE, type: EXTENSION_MESSAGE, request: response || {} }, "*");
			});
		} catch (e) {}
	}

	function bridge() {
		if (extAvailable()) {
			try {
				chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
					return handleRequest(request, sendResponse);
				});
				window.__SSN_LUMNI_BRIDGE__ = true;
				chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
					if (chrome.runtime.lastError || !response) return;
					if ("state" in response) state.isExtensionOn = !!response.state;
				});
			} catch (e) {}
		}
		window.addEventListener("message", function (event) {
			if (event.source !== window) return;
			let request = event.data;
			if (!request || typeof request !== "object") return;
			if (request.source === BRIDGE_SOURCE && request.type === EXTENSION_MESSAGE) request = request.request;
			else if (!request.__ssappSendToTab && request.type !== "SEND_MESSAGE" && !("state" in request)) return;
			handleRequest(request, null);
		});
	}

	function init() {
		els.status = document.getElementById("status-text");
		els.chip = document.getElementById("socket-chip");
		els.last = document.getElementById("last-event-chip");
		els.key = document.getElementById("key-input");
		els.connect = document.getElementById("connect-btn");
		els.disconnect = document.getElementById("disconnect-btn");
		els.forget = document.getElementById("forget-btn");
		els.compose = document.getElementById("chat-compose");
		els.message = document.getElementById("chat-message");
		state.api = apiBase();
		try { state.key = localStorage.getItem(KEY_STORAGE) || ""; } catch (e) {}
		if (els.connect) els.connect.addEventListener("click", start);
		if (els.disconnect) els.disconnect.addEventListener("click", function () { stop(); pushStatus("disconnected", ""); });
		if (els.forget) els.forget.addEventListener("click", function () {
			stop("Key forgotten.");
			state.key = "";
			try { localStorage.removeItem(KEY_STORAGE); } catch (e) {}
		});
		if (els.compose) els.compose.addEventListener("submit", function (ev) {
			ev.preventDefault();
			const text = els.message ? els.message.value : "";
			sendChatMessage(text).then(function (ok) { if (ok && els.message) els.message.value = ""; });
		});
		bridge();
		if (KEY_FORMAT.test(state.key)) start();
		else setStatus(false, "Paste your Lumni connection key and connect.");
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
})();
