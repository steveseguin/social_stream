(function () {
	if (location.protocol !== "https:" || !/^(www\.)?livacha\.com$/.test(location.hostname) ||
		!/^\/chat\/[^/]+\/?$/.test(location.pathname) || window.__SSN_LIVACHA_ACTIVE__) return;
	window.__SSN_LIVACHA_ACTIVE__ = true;

	var settings = {};
	var enabled = true;
	var channel = location.pathname;
	var container = null;
	var observer = null;
	var scanTimer = null;
	var initialized = false;
	var historyUntil = 0;
	var seen = new Set();
	var pendingRows = new WeakSet();

	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback) {
		try {
			if (hasRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
			} else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, callback || null, window.__SSAPP_TAB_ID__);
			}
		} catch (e) {}
	}

	function escapeHtml(value) {
		return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
			.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function resourceUrl(value) {
		try {
			if (!value) return "";
			var url = new URL(value, location.href);
			return /^https?:$/.test(url.protocol) ? url.href : "";
		} catch (e) { return ""; }
	}

	// Capture contract: textonly=true means a literal chatmessage string, not HTML.
	// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
	// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
	// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
	function content(node, textonly) {
		if (node.nodeType === 3) /* textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode. */ return textonly ? node.textContent : escapeHtml(node.textContent);
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") return " ";
		if (node.nodeName === "IMG") {
			var src = resourceUrl(node.getAttribute("src"));
			var alt = node.getAttribute("alt") || "";
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			if (textonly) return alt || (src ? "[image]" : "");
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) /* textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode. */ result += content(node.childNodes[i], textonly);
		if (node.nodeName === "LI") return result.trim() + "; ";
		if (/^(DIV|P|UL|OL|BLOCKQUOTE|PRE)$/.test(node.nodeName)) return result + " ";
		return result;
	}

	function remember(id) {
		seen.add(id);
		if (seen.size > 5000) seen.delete(seen.values().next().value);
	}

	function scanMessages(skip) {
		if (!container || location.pathname !== channel) return;
		var rows = container.querySelectorAll(":scope > .message[data-id]");
		if (!rows.length) return;
		if (!initialized) { initialized = true; historyUntil = Date.now() + 1000; }
		var skipHistory = skip || !enabled || Date.now() < historyUntil;
		var lastKnown = -1;
		for (var i = 0; i < rows.length; i++) {
			if (seen.has(rows[i].getAttribute("data-id"))) lastKnown = i;
		}
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			var id = row.getAttribute("data-id");
			if (!id || seen.has(id)) continue;
			// Older messages are prepended when the user loads more history.
			if (skipHistory || (i < lastKnown && !pendingRows.has(row))) { remember(id); continue; }
			pendingRows.add(row);
			var nameNode = row.querySelector(".message-content > .header > .dotted-hover");
			var body = row.querySelector(".message-content > .content > .html");
			if (!nameNode || !body) continue;
			var name = nameNode.textContent.trim();
			// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
			var textonly = !!settings.textonlymode;
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			var message = content(body, textonly).replace(/\s+/g, " ").trim();
			if (!name || !message) continue;
			var avatar = row.querySelector(".col-ava .ava img");
			remember(id);
			sendToApp({ message: {
				chatname: name, chatmessage: message,
				chatimg: avatar ? resourceUrl(avatar.getAttribute("src")) : "",
				nameColor: window.getComputedStyle(nameNode).color || "",
				chatbadges: "", backgroundColor: "", textColor: "",
				contentimg: "", hasDonation: "", membership: "",
				// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
				textonly: textonly, platform: "livacha", type: "livacha"
			} });
		}
	}

	function scheduleScan() {
		if (scanTimer !== null) return;
		scanTimer = setTimeout(function () { scanTimer = null; scanMessages(false); }, 80);
	}

	function scanPage() {
		if (location.pathname !== channel) {
			if (observer) observer.disconnect();
			channel = location.pathname;
			seen.clear();
			initialized = false;
			container = null;
		}
		var next = /^\/chat\/[^/]+\/?$/.test(channel) ? document.querySelector(".chatik .messages-container") : null;
		if (next !== container) {
			if (observer) observer.disconnect();
			container = next;
			pendingRows = new WeakSet();
			if (container) {
				scanMessages(true);
				observer = new MutationObserver(scheduleScan);
				observer.observe(container, { childList: true, subtree: true, characterData: true,
					attributes: true, attributeFilter: ["data-id", "src", "alt"] });
			}
		}
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("livacha"); return; }
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scanMessages(true); enabled = !!request.state; }
				respond(true);
				return;
			}
			respond(false);
		});
	}
	sendToApp({ getSettings: true }, function (response) {
		if (!response) return;
		settings = response.settings || {};
		if ("state" in response) enabled = !!response.state;
	});
	scanPage();
	setInterval(scanPage, 1000);
})();
