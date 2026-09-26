(function () {
	if (location.protocol !== "https:" || location.hostname !== "w.tv" || !/^\/[^/]+\/chat\/?$/.test(location.pathname) || window.__SSN_WTV_ACTIVE__) return;
	window.__SSN_WTV_ACTIVE__ = true;
	var settings = {};
	var enabled = true;
	var container = null;
	var observer = null;
	var seen = new Set();
	var processedRows = new WeakSet();
	var channel = location.pathname;
	var initialRowsSeen = false;
	var waitingFromEmpty = false;
	var atBottom = true;

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
			// Capture contract: textonly=true means a literal chatmessage string, not HTML.
			// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
			// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		}
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") /* textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode. */ return settings.textonlymode ? "\n" : "<br>";
		if (node.nodeName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			var src = resourceUrl(node.getAttribute("src"));
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
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
		var rows = container.querySelectorAll('[data-testid^="message-"]');
		// Virtualized rows mounted while browsing older chat are not new messages.
		if (!atBottom) skip = true;
		if (!initialRowsSeen && rows.length) { skip = true; initialRowsSeen = true; }
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			if (processedRows.has(row)) continue;
			var nameLink = row.querySelector("a[href]");
			var nameElement = nameLink && nameLink.querySelector('[data-testid="ui-tooltip"]');
			var textElement = nameLink && nameLink.nextElementSibling;
			if (!nameElement || !textElement || !textElement.classList.contains("break-words")) continue;
			var name = nameElement.textContent.trim().replace(/:\s*$/, "");
			var key = row.getAttribute("data-testid") + "::" + name + "::" + textElement.textContent + "::" +
				Array.prototype.map.call(textElement.querySelectorAll("img"), function (image) { return image.getAttribute("alt") || image.getAttribute("src") || ""; }).join("|");
			// This test ID is a render index, not a native message/user ID.
			if (skip || !enabled || seen.has(key)) { remember(row, key); continue; }
			var message = messageContent(textElement).trim();
			if (!name || !message) continue;
			remember(row, key);
			sendToApp({ message: {
				chatname: name, chatmessage: message,
				chatimg: "", chatbadges: "", backgroundColor: "", textColor: "",
				nameColor: window.getComputedStyle(nameElement).color || "",
				contentimg: "", hasDonation: "", membership: "",
				// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
				textonly: !!settings.textonlymode, platform: "wtv", type: "wtv"
			} });
		}
	}

	function updateScrollPosition() {
		if (container) atBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 80;
	}

	function scanPage() {
		if (location.pathname !== channel) {
			channel = location.pathname;
			seen.clear();
			processedRows = new WeakSet();
			initialRowsSeen = false;
			waitingFromEmpty = false;
			if (container) container.removeEventListener("scroll", updateScrollPosition);
			container = null;
		}
		if (document.querySelector('[data-testid="chat-empty-state"]')) {
			initialRowsSeen = true;
			waitingFromEmpty = true;
		}
		var next = document.querySelector('[data-chat-scroll-container]');
		if (next !== container) {
			if (observer) observer.disconnect();
			if (container) container.removeEventListener("scroll", updateScrollPosition);
			container = next;
			if (container) {
				updateScrollPosition();
				container.addEventListener("scroll", updateScrollPosition, { passive: true });
				scanMessages(!waitingFromEmpty);
				waitingFromEmpty = false;
				observer = new MutationObserver(function () { scanMessages(false); });
				observer.observe(container, { childList: true, subtree: true, characterData: true });
			}
		}
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("wtv"); return; }
			if (request === "focusChat") {
				var input = document.querySelector('.chat-input-scrollable[contenteditable="true"]');
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
