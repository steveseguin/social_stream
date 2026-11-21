// Lumni API source for Social Stream Ninja (sources/websocket/lumni.html).
// Polls the Lumni source API with the streamer's connection key and relays chat, gifts and join requests to SSN;
// replies typed in the SSN dock (SEND_MESSAGE) are posted to Lumni chat as the streamer.
// Connection keys stay in localStorage under the selected API origin, never in the URL.
(function () {
	const SOURCE = "lumni";
	const KEY_STORAGE = "lumniSsnKey";
	const DEFAULT_API = "https://app.lumni.live";
	const ALLOWED_API = /^https:\/\/(app|test)\.lumni\.live$|^http:\/\/localhost:\d+$/;
	const POLL_MS = 2000;
	const RETRY_MS = 5000;
	const REQUEST_TIMEOUT_MS = 15000;
	const KEY_FORMAT = /^lumni_ssn_[A-Za-z0-9_-]{59}$/;
	const LOADED_ATTR = "data-ssn-lumni-loaded";
	const BRIDGE_SOURCE = "ssn-lumni";
	const EXTENSION_MESSAGE = "ssn-lumni-extension-message";
	const EXTENSION_RESPONSE = "ssn-lumni-extension-response";

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

	const state = {
		key: "", api: DEFAULT_API, son: null, istek: "", running: false, connected: false,
		timer: null, generation: 0, requests: new Set(), sending: false,
		isExtensionOn: true, settings: {}
	};

	function storageKey() { return KEY_STORAGE + ":" + state.api; }
	function enabled(name) {
		const value = state.settings[name];
		return value === true || !!(value && typeof value === "object" && value.setting === true);
	}
	function applySettings(request) {
		if (!request || typeof request !== "object") return;
		if ("settings" in request) state.settings = request.settings || {};
		if ("state" in request) state.isExtensionOn = !!request.state;
	}

	function plainMessage(row) {
		const text = typeof row.chatmessage === "string" ? row.chatmessage : "";
		if (row.textonly === true || !text) return text;
		const template = document.createElement("template");
		template.innerHTML = text;
		template.content.querySelectorAll("script, style, iframe, object, embed").forEach(function (node) { node.remove(); });
		template.content.querySelectorAll("img").forEach(function (node) {
			node.replaceWith(document.createTextNode(node.getAttribute("alt") || ""));
		});
		return template.content.textContent || "";
	}

	function appendPreview(data) {
		if (!els.feed || (!data.chatname && !data.chatmessage && !data.hasDonation)) return;
		const row = document.createElement("div");
		row.className = "message";
		const name = document.createElement("strong");
		name.textContent = data.chatname ? data.chatname + ": " : "";
		row.appendChild(name);
		row.appendChild(document.createTextNode(plainMessage(data) + (data.hasDonation ? " (" + data.hasDonation + ")" : "")));
		els.feed.appendChild(row);
		while (els.feed.children.length > 300) els.feed.firstElementChild.remove();
		els.feed.scrollTop = els.feed.scrollHeight;
	}

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
		if (!state.isExtensionOn || !row || typeof row !== "object" || Array.isArray(row)) return;
		if (row.event === "viewer_update") {
			if (!enabled("showviewercount") && !enabled("hypemode")) return;
		} else if (row.event && (enabled("hideevents") || (row.event === "joined" && !enabled("capturejoinedevent")))) return;
		const data = Object.assign({ type: SOURCE }, row);
		data.type = SOURCE;
		if (enabled("textonlymode")) {
			data.chatmessage = plainMessage(row);
			data.textonly = true;
		}
		if ("donoValue" in data && (typeof data.donoValue !== "number" || !Number.isFinite(data.donoValue))) delete data.donoValue;
		appendPreview(data);
		relay({ message: data });
	}

	function pushStatus(status, message) {
		relay({ wssStatus: { platform: SOURCE, status: status, message: message || "" } });
	}

	const els = {};
	function setStatus(ok, text) {
		state.connected = !!ok;
		if (els.status) els.status.textContent = text;
		if (els.chip) {
			els.chip.textContent = "Connection: " + (ok ? "connected" : "disconnected");
			els.chip.className = "chip " + (ok ? "ok" : "bad");
			els.chip.setAttribute("data-connected", ok ? "true" : "false");
		}
		if (els.connect) els.connect.disabled = state.running;
		if (els.disconnect) els.disconnect.disabled = !state.running;
		if (els.send) els.send.disabled = !state.connected || state.sending;
	}

	async function post(path, body) {
		const controller = new AbortController();
		state.requests.add(controller);
		const timeout = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
		try {
			const res = await fetch(state.api + path, {
				method: "POST",
				cache: "no-store",
				credentials: "omit",
				redirect: "error",
				signal: controller.signal,
				headers: { authorization: "Bearer " + state.key, "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			let json = {};
			try { json = await res.json(); } catch (e) {}
			return { status: res.status, json: json || {} };
		} finally {
			clearTimeout(timeout);
			state.requests.delete(controller);
		}
	}

	async function poll(generation) {
		if (!state.running || generation !== state.generation) return;
		state.timer = null;
		let wait = POLL_MS;
		try {
			const r = await post("/api/ssn/olaylar", { son: state.son, istek: state.istek });
			if (!state.running || generation !== state.generation) return;
			if (r.status === 401) {
				stop("The key is no longer valid or the connection is closed in Lumni. Copy a new key from Lumni settings.");
				return;
			}
			if (r.status !== 200 || r.json.durum !== "ok") throw new Error("HTTP " + r.status);
			if ((r.json.satirlar && !Array.isArray(r.json.satirlar)) ||
				(r.json.istekler && !Array.isArray(r.json.istekler))) throw new Error("Invalid event response");
			const first = !state.connected;
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
			if (!state.running || generation !== state.generation) return;
			wait = RETRY_MS;
			setStatus(false, "Lumni is not reachable right now; retrying...");
			pushStatus("reconnecting", "Retrying Lumni connection");
		}
		if (state.running && generation === state.generation) state.timer = setTimeout(function () { poll(generation); }, wait);
	}

	function start() {
		if (state.running) return;
		const key = (els.key && els.key.value.trim()) || state.key;
		if (!KEY_FORMAT.test(key)) {
			setStatus(false, "That does not look like a Lumni connection key (it starts with lumni_ssn_).");
			return;
		}
		state.key = key;
		try { localStorage.setItem(storageKey(), key); } catch (e) {}
		if (els.key) els.key.value = "";
		state.son = null;
		state.istek = "";
		state.running = true;
		state.generation += 1;
		if (els.sendStatus) els.sendStatus.textContent = "";
		setStatus(false, "Connecting...");
		pushStatus("connecting", "");
		poll(state.generation);
	}

	function stop(text) {
		state.running = false;
		state.generation += 1;
		state.sending = false;
		if (state.timer) clearTimeout(state.timer);
		state.timer = null;
		state.requests.forEach(function (request) { request.abort(); });
		state.requests.clear();
		setStatus(false, text || "Disconnected.");
		pushStatus("disconnected", "");
	}

	async function sendChatMessage(raw) {
		let text = raw && typeof raw === "object" ? raw.message || raw.chatmessage || raw.text || "" : String(raw == null ? "" : raw);
		text = String(text).trim();
		if (!text || !state.key || !state.running || !state.connected || state.sending) return false;
		if (text.length > 300) {
			if (els.sendStatus) els.sendStatus.textContent = "Messages can be at most 300 characters.";
			return false;
		}
		const generation = state.generation;
		state.sending = true;
		if (els.send) els.send.disabled = true;
		try {
			const r = await post("/api/ssn/yaz", { metin: text });
			if (!state.running || generation !== state.generation) return false;
			if (r.status === 401) { stop("The key is no longer valid; message not sent."); return false; }
			const ok = r.status === 200 && r.json.durum === "ok";
			if (els.sendStatus) els.sendStatus.textContent = ok ? "" : "Lumni did not accept the message.";
			return ok;
		} catch (error) {
			if (generation === state.generation && els.sendStatus) els.sendStatus.textContent = "Delivery could not be confirmed. Check Lumni before sending again.";
			return false;
		} finally {
			if (generation === state.generation) {
				state.sending = false;
				if (els.send) els.send.disabled = !state.connected;
			}
		}
	}

	function handleRequest(request, sendResponse) {
		if (request && request.__ssappSendToTab) request = request.__ssappSendToTab;
		if (request === "getSource") { sendResponse && sendResponse(SOURCE); return false; }
		if (request === "focusChat") { sendResponse && sendResponse(false); return false; }
		if (!request || typeof request !== "object") { sendResponse && sendResponse(false); return false; }
		if ("settings" in request || "state" in request) {
			applySettings(request);
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
		const pending = new Map();
		let nextRequest = 0;
		try {
			chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
				if (request === "getSource") { sendResponse(SOURCE); return; }
				if (request === "focusChat") { sendResponse(false); return; }
				if (request && typeof request === "object" && ("settings" in request || "state" in request || request.type === "SEND_MESSAGE")) {
					if (request.type === "SEND_MESSAGE") {
						const id = ++nextRequest;
						const timeout = setTimeout(function () {
							pending.delete(id);
							sendResponse(false);
						}, REQUEST_TIMEOUT_MS + 1000);
						pending.set(id, { respond: sendResponse, timeout: timeout });
						window.postMessage({ source: BRIDGE_SOURCE, type: EXTENSION_MESSAGE, id: id, request: request }, "*");
						return true;
					}
					window.postMessage({ source: BRIDGE_SOURCE, type: EXTENSION_MESSAGE, request: request }, "*");
					sendResponse(true);
					return;
				}
				sendResponse(false);
			});
		} catch (e) {}
		window.addEventListener("message", function (event) {
			const m = event && event.data;
			if (event.source !== window || !m || typeof m !== "object") return;
			if (m.source === BRIDGE_SOURCE) {
				if (m.type === EXTENSION_RESPONSE && pending.has(m.id)) {
					const entry = pending.get(m.id);
					pending.delete(m.id);
					clearTimeout(entry.timeout);
					entry.respond(m.ok === true);
				}
				return;
			}
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
					applySettings(response);
				});
			} catch (e) {}
		}
		window.addEventListener("message", function (event) {
			if (event.source !== window) return;
			let request = event.data;
			if (!request || typeof request !== "object") return;
			if (request.source === BRIDGE_SOURCE && request.type === EXTENSION_MESSAGE) {
				const id = request.id;
				handleRequest(request.request, id ? function (ok) {
					window.postMessage({ source: BRIDGE_SOURCE, type: EXTENSION_RESPONSE, id: id, ok: ok === true }, "*");
				} : null);
				return;
			}
			else if (!request.__ssappSendToTab && request.type !== "SEND_MESSAGE" && !("state" in request) && !("settings" in request)) return;
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
		els.send = document.getElementById("send-btn");
		els.sendStatus = document.getElementById("send-status");
		els.feed = document.getElementById("chat-feed");
		state.api = apiBase();
		try { state.key = localStorage.getItem(storageKey()) || ""; } catch (e) {}
		if (els.connect) els.connect.addEventListener("click", start);
		if (els.disconnect) els.disconnect.addEventListener("click", function () { stop(); });
		if (els.forget) els.forget.addEventListener("click", function () {
			stop("Key forgotten.");
			state.key = "";
			if (els.key) els.key.value = "";
			try { localStorage.removeItem(storageKey()); localStorage.removeItem(KEY_STORAGE); } catch (e) {}
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
