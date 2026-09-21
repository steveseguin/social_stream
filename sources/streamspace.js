(function () {
	if (location.protocol !== "https:" ||
		["beta.stream.space", "stream.space"].indexOf(location.hostname) === -1 ||
		location.pathname !== "/chat-popup.php" || window.__SSN_STREAMSPACE_ACTIVE__) {
		return;
	}
	window.__SSN_STREAMSPACE_ACTIVE__ = true;

	var settings = {};
	var enabled = true;
	var container = null;
	var observer = null;
	var waitingForHistory = false;
	var seen = new Set();
	var processedRows = new WeakSet();
	var lastViewerCount = null;
	var channel = new URLSearchParams(location.search).get("channel") || "";

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

	function remember(row) {
		processedRows.add(row);
		var id = row.getAttribute("data-id");
		if (!id) return;
		seen.add(id);
		if (seen.size > 1000) seen.delete(seen.values().next().value);
	}

	function scanMessages(skip) {
		if (!container) return;
		// The site's initial history render ends by appending its welcome notice.
		if (waitingForHistory) {
			if (!container.querySelector(".chat-welcome")) return;
			waitingForHistory = false;
			skip = true;
		}
		var rows = container.querySelectorAll(".chat-msg[data-id]");
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			if (processedRows.has(row)) continue;
			var id = row.getAttribute("data-id");
			if (skip || !enabled || seen.has(id) || row.style.opacity === "0.3") {
				remember(row);
				continue;
			}
			var nameElement = row.querySelector(".chat-msg__nick");
			var textElement = row.querySelector(".chat-msg-line > .text");
			if (!nameElement || !textElement) continue;
			var name = nameElement.textContent.trim();
			var message = messageContent(textElement).trim();
			if (!name || !message) continue;
			var avatar = row.querySelector(".chat-msg__avatar");
			var badges = [];
			var level = row.querySelector("img.chat-msg__level");
			if (level) {
				var badgeUrl = resourceUrl(level.getAttribute("src"));
				if (badgeUrl) badges.push(badgeUrl);
			}
			remember(row);
			sendToApp({ message: {
				chatname: name,
				chatmessage: message,
				chatimg: avatar ? resourceUrl(avatar.getAttribute("src")) : "",
				chatbadges: badges,
				nameColor: window.getComputedStyle(row.querySelector(".author") || nameElement).color || "",
				backgroundColor: "", textColor: "", contentimg: "", hasDonation: "", membership: "",
				userid: row.getAttribute("data-user-id") || "",
				textonly: !!settings.textonlymode,
				platform: "streamspace", type: "streamspace"
			} });
		}
	}

	function checkViewerCount() {
		if (!enabled || !(settings.showviewercount || settings.hypemode)) return;
		var element = document.getElementById("popupViewersNum");
		if (!element) return;
		var text = element.textContent.replace(/,/g, "").trim();
		if (!/^\d+$/.test(text)) return;
		var count = Number(text);
		if (!isFinite(count) || count === lastViewerCount) return;
		lastViewerCount = count;
		sendToApp({ message: { type: "streamspace", event: "viewer_update", meta: count } });
	}

	function scanPage() {
		var currentChannel = new URLSearchParams(location.search).get("channel") || "";
		if (currentChannel !== channel) {
			channel = currentChannel;
			seen.clear();
			processedRows = new WeakSet();
			container = null;
			lastViewerCount = null;
		}
		var next = document.getElementById("chatMessages");
		if (next !== container) {
			if (observer) observer.disconnect();
			container = next;
			if (container) {
				waitingForHistory = !!container.querySelector(".chat-empty") && !container.querySelector(".chat-welcome");
				scanMessages(true);
				observer = new MutationObserver(function () { scanMessages(false); });
				observer.observe(container, { childList: true, subtree: true, characterData: true });
			}
		}
		checkViewerCount();
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("streamspace"); return; }
			if (request === "focusChat") {
				var input = document.getElementById("chatInput");
				if (input && !input.disabled && !input.readOnly) { input.focus(); respond(true); return; }
			}
			if (request && typeof request === "object") {
				if ("settings" in request) { settings = request.settings || {}; lastViewerCount = null; }
				if ("state" in request) { scanMessages(true); enabled = !!request.state; lastViewerCount = null; }
				checkViewerCount();
				respond(true);
				return;
			}
			respond(false);
		});
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) return;
			settings = response.settings || {};
			if ("state" in response) enabled = !!response.state;
			checkViewerCount();
		});
	}
	scanPage();
	setInterval(scanPage, 1000);
})();
