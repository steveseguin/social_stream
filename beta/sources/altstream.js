(function () {
	if (!/^(www\.)?altstream\.online$/.test(location.hostname) || window.__SSN_ALTSTREAM_ACTIVE__) return;
	var tipSelector = "div.group.rounded-lg.border-emerald-500";
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
		if (window.__ssnAltstreamMessageReader) return;
		window.__ssnAltstreamMessageReader = true;
		document.addEventListener("ssn-read-altstream-message", function (event) {
			var row = event.target;
			if (!row || !row.matches || !row.matches('[id^="chat-message-"], ' + tipSelector)) return;
			var message = rowMessage(row);
			if (!message) return;
			row.setAttribute("data-ssn-altstream-message", JSON.stringify({
				id: String(message.id),
				sentAt: Number.isFinite(message.sentAt) ? message.sentAt : null,
				authorUsername: typeof message.authorUsername === "string" ? message.authorUsername : "",
				authorImage: typeof message.authorImage === "string" ? message.authorImage : "",
				text: typeof message.text === "string" && message.text.indexOf("[KOFI_TIP]:") === 0 ? message.text : ""
			}));
		});
		return;
	}
	window.__SSN_ALTSTREAM_ACTIVE__ = true;

	var settings = {};
	var isExtensionOn = true;
	var ready = false;
	var container = null;
	var observer = null;
	var initialized = false;
	var startedAt = Math.floor(Date.now() / 1000) * 1000;
	var channel = location.pathname.split("/")[1] || "";
	var seen = new Set();
	var processedRows = new WeakSet();
	var rowSelector = '[id^="chat-message-"], ' + tipSelector;
	var viewerRequest = null;

	function viewerChannel() {
		var match = location.pathname.match(/^\/([^/]+)(?:\/chat)?\/?$/);
		try { return match ? decodeURIComponent(match[1]) : ""; } catch (e) { return ""; }
	}

	function checkViewers() {
		var username = viewerChannel();
		if (!ready || !username || viewerRequest || !isExtensionOn || !(settings.showviewercount || settings.hypemode)) return;
		var xhr = new XMLHttpRequest();
		viewerRequest = xhr;
		xhr.open("GET", "/api/v1/channels/" + encodeURIComponent(username));
		xhr.timeout = 10000;
		xhr.onload = function () {
			if (xhr.status !== 200 || username !== viewerChannel() || !isExtensionOn || !(settings.showviewercount || settings.hypemode)) return;
			try {
				var data = JSON.parse(xhr.responseText).data;
				if (!data || typeof data.username !== "string" || data.username.toLowerCase() !== username.toLowerCase()) return;
				var stream = data.stream;
				if (!stream || typeof stream.isLive !== "boolean") return;
				var count = stream.isLive ? stream.viewers : 0;
				if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return;
				sendToApp({ message: { type: "altstream", event: "viewer_update", meta: count } });
			} catch (e) {}
		};
		xhr.onloadend = function () { if (viewerRequest === xhr) viewerRequest = null; };
		xhr.send();
	}

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

	function remember(row, id) {
		processedRows.add(row);
		seen.add(id || row.id);
	}

	function matchesMessage(row, message) {
		if (!message || message.id === null || message.id === undefined || String(message.id) === "") return false;
		if (row.id) return "chat-message-" + message.id === row.id;
		return row.matches(tipSelector) && typeof message.text === "string" && message.text.indexOf("[KOFI_TIP]:") === 0;
	}

	function rowMessage(row) {
		var key = Object.keys(row).find(function (key) { return key.indexOf("__reactFiber$") === 0; });
		var fiber = key && row[key];
		for (var depth = 0; fiber && depth < 6; depth++, fiber = fiber.return) {
			var message = fiber.memoizedProps && fiber.memoizedProps.message;
			if (matchesMessage(row, message)) return message;
		}
		return null;
	}

	function messageDetails(row) {
		try {
			// SSApp can read the row directly. Chrome requests it from the page.
			var native = rowMessage(row);
			if (native) return native;
			row.removeAttribute("data-ssn-altstream-message");
			row.dispatchEvent(new CustomEvent("ssn-read-altstream-message", { bubbles: true }));
			var value = row.getAttribute("data-ssn-altstream-message");
			row.removeAttribute("data-ssn-altstream-message");
			var details = value && JSON.parse(value);
			return matchesMessage(row, details) ? details : null;
		} catch (e) { return null; }
	}

	function processTip(row, nativeMessage, id) {
		if (!row.isConnected || !nativeMessage || typeof nativeMessage.text !== "string" || nativeMessage.text.indexOf("[KOFI_TIP]:") !== 0) return;
		var name = row.querySelector("p > button.font-black");
		if (!name || !name.textContent.trim()) return;
		var tip;
		try { tip = JSON.parse(nativeMessage.text.slice("[KOFI_TIP]:".length)); } catch (e) { return; }
		if (!tip || typeof tip !== "object" || Array.isArray(tip)) return;
		if (settings.memberchatonly) { remember(row, id); return; }

		var amount = typeof tip.amount === "number" || typeof tip.amount === "string" ? String(tip.amount).trim() : "";
		var currency = typeof tip.currency === "string" && tip.currency.trim() ? tip.currency.trim().toUpperCase() : "USD";
		var hasAmount = /^\d+(?:\.\d+)?$/.test(amount) && Number.isFinite(Number(amount)) && /^[A-Z]{3}$/.test(currency);
		var message = typeof tip.message === "string" ? tip.message : "";
		var data = {
			chatname: name.textContent.trim(),
			chatbadges: [],
			backgroundColor: "",
			textColor: "",
			nameColor: getComputedStyle(name).color,
			chatmessage: settings.textonlymode ? message : escapeHtml(message),
			chatimg: "",
			hasDonation: hasAmount ? amount + " " + currency : "Ko-fi tip",
			membership: "",
			subtitle: "Ko-fi tip",
			contentimg: "",
			textonly: !!settings.textonlymode,
			type: "altstream",
			meta: { messageId: String(nativeMessage.id) }
		};
		if (hasAmount && currency === "USD") data.donoValue = Number(amount);
		remember(row, id);
		sendToApp({ message: data });
	}

	function processMessage(row, nativeMessage) {
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
		var membership = "";
		for (var badge = line.firstElementChild; badge && badge !== name; badge = badge.nextElementSibling) {
			var title = badge.getAttribute("title") || "";
			if (title === "Channel Moderator") moderator = true;
			if (title === "Channel Supporter") membership = "Channel Supporter";
			if (badge.tagName === "IMG") {
				var src = resourceUrl(badge.getAttribute("src"));
				if (src) badges.push(src);
			} else if (title && badge.querySelector("svg")) {
				var svg = badge.querySelector("svg").cloneNode(true);
				svg.setAttribute("style", "height: 1em; width: auto; color: " + getComputedStyle(badge).color);
				badges.push({ type: "svg", html: svg.outerHTML });
			}
		}
		if (settings.memberchatonly && !membership) { remember(row); return; }

		var data = {};
		data.chatname = name.textContent.trim();
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = getComputedStyle(name).color;
		data.chatmessage = message;
		data.chatimg = nativeMessage && typeof nativeMessage.authorImage === "string" ? resourceUrl(nativeMessage.authorImage) : "";
		data.hasDonation = "";
		data.membership = membership;
		data.contentimg = "";
		data.textonly = !!settings.textonlymode;
		data.type = "altstream";
		data.meta = { messageId: row.id.slice("chat-message-".length) };
		if (nativeMessage && typeof nativeMessage.authorUsername === "string" && nativeMessage.authorUsername) data.userid = nativeMessage.authorUsername;
		if (moderator) data.mod = true;
		remember(row);
		sendToApp({ message: data });
	}

	function scanMessages(history, skipAll) {
		if ((location.pathname.split("/")[1] || "") !== channel) { scanPage(); return; }
		if (!container) return;
		container.querySelectorAll(rowSelector).forEach(function (row) {
			if (seen.has(row.id) || processedRows.has(row)) return;
			var nativeMessage = messageDetails(row);
			// Tip cards have no DOM ID; use the same native identity as ordinary chat.
			var id = row.id || (nativeMessage ? "chat-message-" + nativeMessage.id : "");
			if (!id || seen.has(id)) return;
			var sentAt = nativeMessage && typeof nativeMessage.sentAt === "number" && Number.isFinite(nativeMessage.sentAt) ? nativeMessage.sentAt : null;
			if (skipAll || !isExtensionOn || (sentAt !== null ? sentAt < startedAt : history)) remember(row, id);
			else if (row.matches(tipSelector)) processTip(row, nativeMessage, id);
			else processMessage(row, nativeMessage);
		});
	}

	function scanPage() {
		if (!ready) return;
		var nextChannel = location.pathname.split("/")[1] || "";
		if (nextChannel !== channel) {
			channel = nextChannel;
			startedAt = Math.floor(Date.now() / 1000) * 1000;
			if (viewerRequest) { viewerRequest.abort(); viewerRequest = null; }
			checkViewers();
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
					sendResponse(document.activeElement === input);
					return;
				}
			}
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scanMessages(false, true); isExtensionOn = !!request.state; }
				checkViewers();
				sendResponse(true);
				return;
			}
			sendResponse(false);
		});
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) return;
			settings = response.settings || {};
			if ("state" in response) isExtensionOn = !!response.state;
			ready = true;
			scanPage();
			checkViewers();
		});
	} else { ready = true; }
	scanPage();
	setInterval(scanPage, 1000);
	setInterval(checkViewers, 30000);
})();
