(function () {
	if (window.__SSN_WORLDSWAVE_SOURCE_ACTIVE__) {
		return;
	}
	window.__SSN_WORLDSWAVE_SOURCE_ACTIVE__ = true;

	var settings = {};
	var isExtensionOn = true;
	var observer = null;
	var observedTarget = null;
	var lastURL = location.href;
	var lastViewerCount = null;
	var recentlySeenMessages = new Map();
	var DUPLICATE_WINDOW_MS = 10000;
	var ROW_SELECTOR = "#vylveelement_commentsv2river > [class*='StyledChatMessageItem'], #vylveelement_commentsv2river > [class*='vy_lv_comm_uid_'], #vy_lv_comments_section > .vy_lv_comment";

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

	function escapeHtml(unsafe) {
		return String(unsafe || "")
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
			var alt = node.getAttribute("alt") || "";
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

	function getNameElement(row) {
		try {
			return row.querySelector(".js__comment_author, [class*='SpanNickName']");
		} catch (e) {
			return null;
		}
	}

	function getAuthorName(row) {
		try {
			var hiddenName = row.querySelector(".js__comment_author_name");
			var value = hiddenName ? hiddenName.value || hiddenName.getAttribute("value") || "" : "";
			if (value.trim()) {
				return value.trim();
			}
			var nameElement = getNameElement(row);
			return nameElement ? (nameElement.textContent || "").trim() : "";
		} catch (e) {
			return "";
		}
	}

	function getMessageElement(row) {
		try {
			var message = row.querySelector(".vy_lv_comment4_str, [class*='SpanChatRoomComment']");
			if (message) {
				return message;
			}

			var content = row.querySelector("[class*='DivChatMessageContent'], .vy_lv_comment_str3");
			if (!content) {
				return null;
			}

			var candidates = content.querySelectorAll("span, div");
			for (var i = candidates.length - 1; i >= 0; i--) {
				var candidate = candidates[i];
				if (candidate.matches && candidate.matches(".js__comment_author, [class*='SpanNickName']")) {
					continue;
				}
				if ((candidate.textContent || "").trim() || candidate.querySelector("img[src]")) {
					return candidate;
				}
			}
		} catch (e) {}
		return null;
	}

	function getUserId(row) {
		try {
			var match = String(row.className || "").match(/(?:^|\s)vy_lv_comm_uid_(\d+)(?:\s|$)/);
			return match ? match[1] : "";
		} catch (e) {
			return "";
		}
	}

	function getNameColor(row) {
		var nameElement = getNameElement(row);
		if (!nameElement) {
			return "";
		}
		try {
			return (window.getComputedStyle(nameElement).color || "").trim();
		} catch (e) {
			return (nameElement.style && nameElement.style.color) || "";
		}
	}

	function buildMessageData(row) {
		var name = getAuthorName(row);
		var messageElement = getMessageElement(row);
		var message = getAllContentNodes(messageElement).trim();
		if (!name || !message) {
			return null;
		}

		var avatar = "";
		try {
			var avatarElement = row.querySelector(".vy_lv_comment2a img[src], [class*='DivBadgeWrap'] img[src], img[src]");
			avatar = avatarElement ? safeResourceUrl(avatarElement.src || avatarElement.getAttribute("src")) : "";
		} catch (e) {}

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = getNameColor(row);
		data.chatmessage = message;
		data.chatimg = avatar;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "worldswave";

		var userId = getUserId(row);
		if (userId) {
			data.userid = userId;
		}

		return data;
	}

	function getMessageSignature(data) {
		return [data.userid || "", data.chatname || "", data.chatmessage || "", data.chatimg || ""].join("::");
	}

	function hasSeenRecently(signature) {
		var now = Date.now();
		var previous = recentlySeenMessages.get(signature);
		recentlySeenMessages.set(signature, now);
		if (recentlySeenMessages.size > 250) {
			recentlySeenMessages.forEach(function (timestamp, key) {
				if (now - timestamp > DUPLICATE_WINDOW_MS * 2) {
					recentlySeenMessages.delete(key);
				}
			});
		}
		return !!previous && now - previous < DUPLICATE_WINDOW_MS;
	}

	function markRow(row, signature) {
		try {
			row.dataset.ssnLastMessageSignature = signature || "";
		} catch (e) {}
	}

	function processMessage(row) {
		if (!row || row.nodeType !== 1 || !row.isConnected) {
			return;
		}

		var data = buildMessageData(row);
		if (!data) {
			return;
		}

		var signature = getMessageSignature(data);
		if (row.dataset && row.dataset.ssnLastMessageSignature === signature) {
			return;
		}

		markRow(row, signature);
		if (hasSeenRecently(signature)) {
			return;
		}
		if (isExtensionOn) {
			sendToApp({ message: data });
		}
	}

	function markExistingMessages(container) {
		try {
			container.querySelectorAll(ROW_SELECTOR).forEach(function (row) {
				var data = buildMessageData(row);
				markRow(row, data ? getMessageSignature(data) : "__worldswave_backlog__");
			});
		} catch (e) {}
	}

	function findMessageRow(node) {
		if (!node) {
			return null;
		}
		if (node.nodeType === 1 && node.matches && node.matches(ROW_SELECTOR)) {
			return node;
		}
		if (node.nodeType === 1 && node.closest) {
			return node.closest(ROW_SELECTOR);
		}
		if (node.parentElement && node.parentElement.closest) {
			return node.parentElement.closest(ROW_SELECTOR);
		}
		return null;
	}

	function forEachMessageRow(node, callback) {
		var row = findMessageRow(node);
		if (row) {
			callback(row);
		}
		if (node && node.querySelectorAll) {
			node.querySelectorAll(ROW_SELECTOR).forEach(function (nestedRow) {
				if (nestedRow !== row) {
					callback(nestedRow);
				}
			});
		}
	}

	function observeChat(container) {
		var MutationObserverRef = window.MutationObserver || window.WebKitMutationObserver;
		if (!MutationObserverRef || !container) {
			return;
		}

		observer = new MutationObserverRef(function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes && mutation.addedNodes.length) {
					for (var i = 0; i < mutation.addedNodes.length; i++) {
						forEachMessageRow(mutation.addedNodes[i], processMessage);
					}
				} else if (mutation.type === "characterData") {
					var row = findMessageRow(mutation.target);
					if (row) {
						processMessage(row);
					}
				}
			});
		});

		observer.observe(container, { childList: true, characterData: true, subtree: true });
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

	function findChatContainer() {
		return document.querySelector("#vylveelement_commentsv2river") || document.querySelector("#vy_lv_comments_section");
	}

	function scanMessages(container) {
		try {
			container.querySelectorAll(ROW_SELECTOR).forEach(processMessage);
		} catch (e) {}
	}

	function parseViewerCount(value) {
		var normalized = String(value || "")
			.replace(/,/g, "")
			.trim();
		var match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
		if (!match) {
			return null;
		}
		var multiplier = { K: 1000, M: 1000000, B: 1000000000 }[(match[2] || "").toUpperCase()] || 1;
		return Math.round(parseFloat(match[1]) * multiplier);
	}

	function checkViewers() {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}

		var viewerElement = document.querySelector(".js__vylv_count2_viewers, [data-e2e='live-people-count']");
		var count = viewerElement ? parseViewerCount(viewerElement.textContent || viewerElement.getAttribute("aria-label")) : null;
		if (count === null) {
			if (lastViewerCount !== null) {
				lastViewerCount = null;
				sendToApp({ message: { type: "worldswave", event: "viewer_update", meta: 0 } });
			}
			return;
		}

		if (count === lastViewerCount) {
			return;
		}
		lastViewerCount = count;
		sendToApp({ message: { type: "worldswave", event: "viewer_update", meta: count } });
	}

	function findChatInput() {
		return document.querySelector("#vy_lv_txtaddcomment_js2, textarea[placeholder*='comment' i], .js__inputfantom, input[placeholder*='comment' i]");
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
			checkViewers();
		});
	}

	if (hasChromeRuntime() && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if (request === "getSource") {
					sendResponse("worldswave");
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
						handled = true;
					}
					if ("state" in request) {
						isExtensionOn = request.state;
						handled = true;
					}
					if (handled) {
						checkViewers();
						sendResponse(true);
						return;
					}
				}
			} catch (e) {}
			sendResponse(false);
		});
	}

	requestSettings();
	console.log("social stream injected");

	setInterval(function () {
		try {
			if (location.href !== lastURL) {
				lastURL = location.href;
				lastViewerCount = null;
				observedTarget = null;
				recentlySeenMessages.clear();
				disconnectObserver();
			}

			var container = findChatContainer();
			if (!container) {
				return;
			}

			if (container !== observedTarget) {
				disconnectObserver();
				observedTarget = container;
				markExistingMessages(container);
				observeChat(container);
			}

			scanMessages(container);
		} catch (e) {}
	}, 1000);

	setInterval(checkViewers, 10000);
	setTimeout(checkViewers, 1000);
})();
