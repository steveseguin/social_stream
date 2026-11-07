(function () {
	if (!/^(www\.)?altstream\.online$/.test(location.hostname) || window.__SSN_ALTSTREAM_ACTIVE__) return;
	window.__SSN_ALTSTREAM_ACTIVE__ = true;

	var settings = {};
	var isExtensionOn = true;
	var container = null;
	var observer = null;
	var initialized = false;
	var channel = location.pathname.split("/")[1] || "";
	var seen = new Set();
	var processedRows = new WeakSet();
	var rowSelector = '[id^="chat-message-"]';

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

	function getAllContentNodes(node) {
		if (node.nodeType === 3) return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") return settings.textonlymode ? "\n" : "<br>";
		if (node.nodeName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			if (settings.textonlymode) return alt;
			var src = resourceUrl(node.getAttribute("src"));
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var content = "";
		for (var i = 0; i < node.childNodes.length; i++) content += getAllContentNodes(node.childNodes[i]);
		return content;
	}

	function remember(row) {
		processedRows.add(row);
		seen.add(row.id);
		if (seen.size > 10000) seen.delete(seen.values().next().value);
	}

	function processMessage(row) {
		if (!row.isConnected || seen.has(row.id) || processedRows.has(row)) return;
		// Event cards and shoutouts are not ordinary chat rows.
		var line = row.querySelector(":scope > div.inline.break-words");
		var name = line && line.querySelector(":scope > button.font-black");
		if (!name || !name.textContent.trim()) return;
		var separator = name.nextElementSibling;
		while (separator && separator.textContent.trim() !== ":") separator = separator.nextElementSibling;
		if (!separator) return;
		var message = "";
		for (var node = separator.nextSibling; node; node = node.nextSibling) message += getAllContentNodes(node);
		message = message.trim();
		if (!message) return;

		var badges = [];
		var moderator = false;
		for (var badge = line.firstElementChild; badge && badge !== name; badge = badge.nextElementSibling) {
			var title = badge.getAttribute("title") || "";
			if (title === "Channel Moderator") moderator = true;
			if (badge.tagName === "IMG") {
				var src = resourceUrl(badge.getAttribute("src"));
				if (src) badges.push(src);
			} else if (title && badge.querySelector("svg")) {
				var svg = badge.querySelector("svg").cloneNode(true);
				svg.setAttribute("style", "height: 1em; width: auto; color: " + getComputedStyle(badge).color);
				badges.push({ type: "svg", html: svg.outerHTML });
			}
		}

		var data = {};
		data.chatname = name.textContent.trim();
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = getComputedStyle(name).color;
		data.chatmessage = message;
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "altstream";
		data.meta = { messageId: row.id.slice("chat-message-".length) };
		if (moderator) data.mod = true;
		remember(row);
		sendToApp({ message: data });
	}

	function scanMessages(history) {
		if ((location.pathname.split("/")[1] || "") !== channel) { scanPage(); return; }
		if (!container) return;
		container.querySelectorAll(rowSelector).forEach(function (row) {
			if (history || !isExtensionOn) remember(row);
			else processMessage(row);
		});
	}

	function scanPage() {
		var nextChannel = location.pathname.split("/")[1] || "";
		if (nextChannel !== channel) {
			channel = nextChannel;
			seen.clear();
			processedRows = new WeakSet();
			if (observer) observer.disconnect();
			container = null;
			initialized = false;
		}
		var row = document.querySelector(rowSelector);
		var next = (row && row.parentElement) || document.querySelector(".flex-1.space-y-1.overflow-y-auto");
		if (container && container.isConnected) return;
		if (observer) observer.disconnect();
		container = next;
		if (!container) return;
		// Skip the history already displayed when the chat opens.
		scanMessages(!initialized);
		initialized = true;
		observer = new MutationObserver(function () { scanMessages(false); });
		observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["id", "src"] });
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request === "getSource") { sendResponse("altstream"); return; }
			if (request === "focusChat") {
				var input = document.querySelector('textarea[placeholder="Type a message"]');
				if (input && !input.disabled && !input.readOnly) {
					input.focus();
					sendResponse(true);
					return;
				}
			}
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scanMessages(true); isExtensionOn = !!request.state; }
				sendResponse(true);
				return;
			}
			sendResponse(false);
		});
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) return;
			settings = response.settings || {};
			if ("state" in response) isExtensionOn = !!response.state;
		});
	}
	scanPage();
	setInterval(scanPage, 1000);
})();
