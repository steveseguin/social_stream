(function () {
	if (window.__SSN_CASTYR_SOURCE_ACTIVE__) {
		return;
	}
	window.__SSN_CASTYR_SOURCE_ACTIVE__ = true;

	var settings = {};
	var isExtensionOn = true;
	var observer = null;
	var observedContainer = null;
	var lastURL = location.href;
	var lastViewerCount = null;
	var backlogSuppressUntil = 0;
	var seenMessageKeys = {};
	var seenMessageKeyQueue = [];
	var recentFallbackKeys = new Map();
	var MAX_SEEN_MESSAGE_KEYS = 500;
	var FALLBACK_DUPLICATE_WINDOW_MS = 2000;
	var INITIAL_BACKLOG_SUPPRESS_MS = 750;
	var CHAT_CONTAINER_SELECTOR = ".chat-message-list";
	var CHAT_MESSAGE_SELECTOR = "p.chat-message";
	var VIEWER_COUNT_SELECTOR = "[title*='active in chat' i]";

	function hasChromeRuntime() {
		return typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback) {
		try {
			if (hasChromeRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
				return true;
			}
		} catch (e) {}

		try {
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== "undefined" ? window.__SSAPP_TAB_ID__ : null);
				return true;
			}
		} catch (e) {}

		try {
			var forwarded = {};
			for (var key in payload) {
				if (Object.prototype.hasOwnProperty.call(payload, key)) {
					forwarded[key] = payload[key];
				}
			}
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined") {
				forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			}
			window.postMessage(forwarded, "*");
			return true;
		} catch (e) {}

		return false;
	}

	function escapeHtml(value) {
		return String(value === null || typeof value === "undefined" ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function safeResourceUrl(value) {
		var url = String(value || "").trim();
		if (/^(https?:|data:image\/|blob:)/i.test(url)) {
			return url;
		}
		return "";
	}

	function getAllContentNodes(node) {
		var output = "";
		if (!node) {
			return output;
		}

		if (node.nodeType === 3) {
			return settings.textonlymode ? node.textContent || "" : escapeHtml(node.textContent || "");
		}

		if (node.nodeType !== 1) {
			return output;
		}

		if (node.nodeName === "BR") {
			return settings.textonlymode ? "\n" : "<br>";
		}

		if (node.nodeName === "IMG") {
			var alt = node.getAttribute("alt") || node.getAttribute("title") || "";
			if (settings.textonlymode) {
				return alt;
			}
			var src = safeResourceUrl(node.src || node.getAttribute("src"));
			if (!src) {
				return escapeHtml(alt);
			}
			return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">';
		}

		for (var i = 0; i < node.childNodes.length; i++) {
			output += getAllContentNodes(node.childNodes[i]);
		}

		if (!settings.textonlymode && node.nodeName === "A") {
			var href = safeResourceUrl(node.href || node.getAttribute("href"));
			if (href) {
				return '<a href="' + escapeHtml(href) + '" target="_blank">' + output + "</a>";
			}
		}

		return output;
	}

	function getNameColor(nameElement) {
		if (!nameElement) {
			return "";
		}
		try {
			if (nameElement.style && nameElement.style.color) {
				return nameElement.style.color;
			}
			return (window.getComputedStyle(nameElement).color || "").trim();
		} catch (e) {
			return "";
		}
	}

	function buildMessageData(row) {
		if (!row || !row.querySelector) {
			return null;
		}

		var nameElement = row.querySelector(".chat-message-username");
		var messageElement = row.querySelector(".chat-message-text");
		var name = nameElement ? (nameElement.textContent || "").trim() : "";
		if (!name) {
			name = (row.getAttribute("data-username") || "").trim();
		}
		var message = getAllContentNodes(messageElement).trim();
		if (!name || !message) {
			return null;
		}

		return {
			chatname: name,
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			nameColor: getNameColor(nameElement),
			chatmessage: message,
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "castyr"
		};
	}

	function getMessageIdentity(row, data) {
		var timestamp = (row.getAttribute("data-timestamp") || "").trim();
		var username = (row.getAttribute("data-username") || data.chatname || "").trim();
		if (timestamp) {
			return { key: "timestamp::" + timestamp + "::" + username, persistent: true };
		}
		return {
			key: "content::" + username + "::" + (data.chatmessage || ""),
			persistent: false
		};
	}

	function hasSeenOrRemember(identity) {
		if (!identity || !identity.key) {
			return false;
		}

		if (identity.persistent) {
			if (seenMessageKeys[identity.key]) {
				return true;
			}
			seenMessageKeys[identity.key] = true;
			seenMessageKeyQueue.push(identity.key);
			while (seenMessageKeyQueue.length > MAX_SEEN_MESSAGE_KEYS) {
				delete seenMessageKeys[seenMessageKeyQueue.shift()];
			}
			return false;
		}

		var now = Date.now();
		var previous = recentFallbackKeys.get(identity.key);
		recentFallbackKeys.set(identity.key, now);
		if (recentFallbackKeys.size > 200) {
			recentFallbackKeys.forEach(function (seenAt, key) {
				if (now - seenAt > FALLBACK_DUPLICATE_WINDOW_MS * 2) {
					recentFallbackKeys.delete(key);
				}
			});
		}
		return !!previous && now - previous < FALLBACK_DUPLICATE_WINDOW_MS;
	}

	function markRow(row, identity) {
		try {
			row.dataset.ssnCastyrMessageKey = identity && identity.key ? identity.key : "__castyr_backlog__";
		} catch (e) {}
	}

	function rememberRow(row) {
		var data = buildMessageData(row);
		if (!data) {
			markRow(row, null);
			return;
		}
		var identity = getMessageIdentity(row, data);
		markRow(row, identity);
		hasSeenOrRemember(identity);
	}

	function processMessage(row) {
		if (!row || row.nodeType !== 1 || !row.isConnected) {
			return;
		}

		var data = buildMessageData(row);
		if (!data) {
			return;
		}

		var identity = getMessageIdentity(row, data);
		if (row.dataset && row.dataset.ssnCastyrMessageKey === identity.key) {
			return;
		}

		markRow(row, identity);
		if (Date.now() < backlogSuppressUntil) {
			hasSeenOrRemember(identity);
			return;
		}
		if (hasSeenOrRemember(identity)) {
			return;
		}
		if (isExtensionOn) {
			sendToApp({ message: data });
		}
	}

	function findMessageRow(node) {
		if (!node) {
			return null;
		}
		if (node.nodeType === 1 && node.matches && node.matches(CHAT_MESSAGE_SELECTOR)) {
			return node;
		}
		if (node.nodeType === 1 && node.closest) {
			return node.closest(CHAT_MESSAGE_SELECTOR);
		}
		if (node.parentElement && node.parentElement.closest) {
			return node.parentElement.closest(CHAT_MESSAGE_SELECTOR);
		}
		return null;
	}

	function forEachMessageRow(node, callback) {
		var row = findMessageRow(node);
		if (row) {
			callback(row);
		}
		if (node && node.querySelectorAll) {
			var nestedRows = node.querySelectorAll(CHAT_MESSAGE_SELECTOR);
			for (var i = 0; i < nestedRows.length; i++) {
				if (nestedRows[i] !== row) {
					callback(nestedRows[i]);
				}
			}
		}
	}

	function markExistingMessages(container) {
		var rows = container.querySelectorAll(CHAT_MESSAGE_SELECTOR);
		for (var i = 0; i < rows.length; i++) {
			rememberRow(rows[i]);
		}
	}

	function scanMessages(container) {
		var rows = container.querySelectorAll(CHAT_MESSAGE_SELECTOR);
		for (var i = 0; i < rows.length; i++) {
			processMessage(rows[i]);
		}
	}

	function disconnectObserver() {
		if (!observer) {
			return;
		}
		try {
			observer.disconnect();
		} catch (e) {}
		observer = null;
	}

	function observeChat(container) {
		var MutationObserverRef = window.MutationObserver || window.WebKitMutationObserver;
		if (!MutationObserverRef || !container) {
			return;
		}

		observer = new MutationObserverRef(function (mutations) {
			for (var i = 0; i < mutations.length; i++) {
				for (var j = 0; j < mutations[i].addedNodes.length; j++) {
					forEachMessageRow(mutations[i].addedNodes[j], processMessage);
				}
				var changedRow = findMessageRow(mutations[i].target);
				if (changedRow) {
					processMessage(changedRow);
				}
			}
		});

		observer.observe(container, { childList: true, characterData: true, subtree: true });
	}

	function parseViewerCount(value) {
		var text = String(value || "").replace(/,/g, "").trim();
		var match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
		if (!match) {
			return null;
		}
		var multiplier = { K: 1000, M: 1000000, B: 1000000000 }[(match[2] || "").toUpperCase()] || 1;
		var count = Math.round(parseFloat(match[1]) * multiplier);
		return isFinite(count) ? count : null;
	}

	function checkViewerCount() {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}

		var viewerElement = document.querySelector(VIEWER_COUNT_SELECTOR);
		if (!viewerElement) {
			return;
		}
		var count = parseViewerCount(viewerElement.getAttribute("title") || viewerElement.textContent || "");
		if (count === null || count === lastViewerCount) {
			return;
		}
		lastViewerCount = count;
		sendToApp({ message: { type: "castyr", event: "viewer_update", meta: count } });
	}

	function findChatInput() {
		var input = document.querySelector("form input[placeholder*='Send a message' i], input[placeholder*='message' i]");
		if (!input || input.disabled || input.readOnly) {
			return null;
		}
		return input;
	}

	function requestSettings() {
		if (!hasChromeRuntime()) {
			return;
		}
		chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
				return;
			}
			response = response || {};
			if ("settings" in response) {
				settings = response.settings || {};
			}
			if ("state" in response) {
				isExtensionOn = response.state;
			}
			checkViewerCount();
		});
	}

	if (hasChromeRuntime() && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if (request === "getSource") {
					sendResponse("castyr");
					return;
				}
				if (request === "focusChat") {
					var input = findChatInput();
					if (input && input.focus) {
						input.focus();
						sendResponse(true);
						return;
					}
				}
				if (typeof request === "object" && request) {
					var handled = false;
					if ("settings" in request) {
						settings = request.settings || {};
						lastViewerCount = null;
						handled = true;
					}
					if ("state" in request) {
						isExtensionOn = request.state;
						handled = true;
					}
					if (handled) {
						checkViewerCount();
						sendResponse(true);
						return;
					}
				}
			} catch (e) {}
			sendResponse(false);
		});
	}

	function resetForNavigation() {
		disconnectObserver();
		observedContainer = null;
		lastViewerCount = null;
		seenMessageKeys = {};
		seenMessageKeyQueue = [];
		recentFallbackKeys.clear();
	}

	function scanPage() {
		try {
			if (location.href !== lastURL) {
				lastURL = location.href;
				resetForNavigation();
			}

			var container = document.querySelector(CHAT_CONTAINER_SELECTOR);
			if (!container) {
				return;
			}

			if (container !== observedContainer) {
				disconnectObserver();
				observedContainer = container;
				backlogSuppressUntil = Date.now() + INITIAL_BACKLOG_SUPPRESS_MS;
				markExistingMessages(container);
				observeChat(container);
			}

			scanMessages(container);
		} catch (e) {}
	}

	requestSettings();
	console.log("social stream injected");
	scanPage();
	setInterval(scanPage, 1000);
	setTimeout(checkViewerCount, 1000);
	setInterval(checkViewerCount, 5000);
})();
