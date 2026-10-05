(function () {
	function isChatPage() {
		return /^(www\.)?starvios\.com$/i.test(location.hostname) && /^\/popout\/chat\/[^/]+\/?$/.test(location.pathname);
	}
	if (!isChatPage() || window.__SSN_STARVIOS_SOURCE_ACTIVE__) { return; }
	window.__SSN_STARVIOS_SOURCE_ACTIVE__ = true;

	var settings = {};
	var isExtensionOn = true;
	var container = null;
	var observer = null;
	var seen = new WeakSet();
	var currentPath = location.pathname;
	var readyAt = 0;
	// The scrolling timeline excludes the separate pinned-message panel and dialogs.
	var containerSelector = "main div.overscroll-contain.overflow-y-auto";

	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload) {
		try {
			if (hasRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, function () {});
			} else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
			}
		} catch (e) {}
	}

	function escapeHtml(value) {
		return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
			.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function messageContent(node) {
		if (node.nodeType === 3) {
			return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		}
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|BUTTON|SVG)$/.test(node.nodeName)) { return ""; }
		if (node.nodeName === "BR") { return settings.textonlymode ? "\n" : "<br>"; }
		if (node.nodeName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			if (settings.textonlymode) { return alt; }
			return /^https?:\/\//i.test(node.src) ? '<img src="' + escapeHtml(node.src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var text = "";
		for (var i = 0; i < node.childNodes.length; i++) { text += messageContent(node.childNodes[i]); }
		return text;
	}

	function processRow(row, backlog) {
		if (row.nodeType !== 1 || seen.has(row)) { return; }
		// Both ordinary and Starvies chat rows use the same author/body paragraph.
		// Reply previews and subscription/raid notices do not have these elements.
		var name = row.querySelector("p.break-words button.font-semibold");
		var body = name && name.parentElement.querySelector('span[class~="text-foreground/90"]');
		if (!name || !body) { return; }
		var chatname = name.textContent.trim();
		var message = messageContent(body).trim();
		if (!chatname || !message) { return; }
		seen.add(row);
		if (backlog || !isExtensionOn) { return; }
		var donation = "";
		if (row.classList.contains("border-chat-starvie/70")) {
			var amount = row.querySelector("p.tabular-nums");
			var match = amount && amount.textContent.match(/\u00b7\s*([\d.,\s]+ Starvies)\s*$/);
			if (match) { donation = match[1].trim(); }
		}
		sendToApp({ message: {
			chatname: chatname,
			chatmessage: message,
			nameColor: name.style.color || "",
			chatbadges: "",
			chatimg: "",
			backgroundColor: "",
			textColor: "",
			contentimg: "",
			hasDonation: donation,
			membership: "",
			textonly: !!settings.textonlymode,
			type: "starvios"
		} });
	}

	function scanRows() {
		if (!container || !isChatPage() || location.pathname !== currentPath) { return; }
		var backlog = Date.now() < readyAt;
		for (var i = 0; i < container.children.length; i++) { processRow(container.children[i], backlog); }
	}

	function scanPage() {
		var next = isChatPage() ? document.querySelector(containerSelector) : null;
		if (next !== container || location.pathname !== currentPath) {
			if (observer) { observer.disconnect(); }
			container = next;
			currentPath = location.pathname;
			seen = new WeakSet();
			if (container) {
				// Allow the initial asynchronous history render to settle without replaying it.
				readyAt = Date.now() + 1500;
				scanRows();
				observer = new MutationObserver(scanRows);
				observer.observe(container, { childList: true, subtree: true, characterData: true });
			}
		}
		scanRows();
	}

	function focusChat() {
		if (!isChatPage()) { return false; }
		var input = document.querySelector('main form input[aria-autocomplete="list"]');
		if (!input || input.disabled || input.readOnly || !input.getClientRects().length) { return false; }
		input.focus();
		return document.activeElement === input;
	}

	if (hasRuntime()) {
		chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) { return; }
			if ("settings" in response) { settings = response.settings || {}; }
			if ("state" in response) { isExtensionOn = response.state; }
		});
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request === "getSource") { sendResponse(isChatPage() ? "starvios" : false); return; }
			if (request === "focusChat") { sendResponse(focusChat()); return; }
			if (request && typeof request === "object") {
				if ("settings" in request) { settings = request.settings || {}; }
				if ("state" in request) { isExtensionOn = request.state; }
				sendResponse(true);
				return;
			}
			sendResponse(false);
		});
	}

	scanPage();
	setInterval(scanPage, 1000);
})();
