(function () {
	if (location.protocol !== "https:" || location.hostname !== "prime.gs" || new URLSearchParams(location.search).get("chat_popout") !== "1" || !/^\/[^/]+\/?$/.test(location.pathname) || window.__SSN_PRIME_ACTIVE__) return;
	window.__SSN_PRIME_ACTIVE__ = true;
	var settings = {};
	var enabled = true;
	var container = null;
	var observer = null;
	var seen = new Set();
	var processedRows = new WeakSet();
	var channel = location.pathname;
	var historyId = 0;

	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback) {
		try {
			if (hasRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
			} else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
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

	function messageContent(node) {
		if (node.nodeType === 3) {
			return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		}
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") return settings.textonlymode ? "\n" : "<br>";
		if (node.nodeName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			var src = resourceUrl(node.getAttribute("src"));
			if (settings.textonlymode) return alt;
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) result += messageContent(node.childNodes[i]);
		return result;
	}


	function remember(row, key) {
		processedRows.add(row);
		if (key) {
			seen.add(key);
			if (seen.size > 1000) seen.delete(seen.values().next().value);
		}
	}

	function scanMessages(skip) {
		if (!container) return;
		var rows = container.querySelectorAll('.chat-message[data-message-id]');
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			if (processedRows.has(row)) continue;
			var key = row.getAttribute("data-message-id");
			if (skip) historyId = Math.max(historyId, Number(key) || 0);
			var textElement = row.querySelector("[data-chat-message-body]");
			var nameElement = row.querySelector("[data-user-card]");
			// Signed-out viewers get a plain span instead of a profile link.
			// Restrict the fallback to this message's header, excluding reply quotes.
			if (!nameElement && textElement && textElement.previousElementSibling) {
				nameElement = textElement.previousElementSibling.querySelector(".font-semibold.flex-shrink-0");
			}
			if (textElement && textElement.hasAttribute("data-ignored-placeholder")) { remember(row, key); continue; }
			if (!nameElement || !textElement) continue;
			var name = nameElement.textContent.trim();
			if (skip || !enabled || seen.has(key) || (Number(key) > 0 && Number(key) <= historyId)) { remember(row, key); continue; }
			var message = messageContent(textElement).trim();
			if (!name || !message) continue;
			remember(row, key);
			sendToApp({ message: {
				chatname: name, chatmessage: message,
				chatimg: "", chatbadges: "", backgroundColor: "", textColor: "",
				nameColor: window.getComputedStyle(nameElement).color || "",
				contentimg: "", hasDonation: "", membership: "",
				userid: row.getAttribute("data-user-id") || "",
				textonly: !!settings.textonlymode, platform: "prime", type: "prime"
			} });
		}
	}

	function scanPage() {
		if (location.pathname !== channel) {
			channel = location.pathname;
			seen.clear();
			processedRows = new WeakSet();
			historyId = 0;
			container = null;
		}
		var next = document.querySelector('#chat-messages');
		if (next !== container) {
			if (observer) observer.disconnect();
			container = next;
			if (container) {
				scanMessages(true);
				observer = new MutationObserver(function () { scanMessages(false); });
				observer.observe(container, { childList: true, subtree: true, characterData: true });
			}
		}
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("prime"); return; }
			if (request === "focusChat") {
				var input = document.querySelector('#chat-input');
				if (input && !input.disabled && !input.readOnly) { input.focus(); respond(true); return; }
			}
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scanMessages(true); enabled = !!request.state; }
				respond(true);
				return;
			}
			respond(false);
		});
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) return;
			settings = response.settings || {};
			if ("state" in response) enabled = !!response.state;
		});
	}
	scanPage();
	setInterval(scanPage, 1000);
})();
