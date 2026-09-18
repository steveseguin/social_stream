(function () {
	var settings = {};
	var isExtensionOn = true;
	var observer = null;
	var observedContainer = null;
	var lastViewerCount = null;
	var seenMessageIds = {};
	var seenMessageIdQueue = [];
	var MAX_SEEN_MESSAGE_IDS = 500;
	var CHAT_CONTAINER_SELECTOR = "#chatMessages";
	var CHAT_MESSAGE_SELECTOR = ".chat-line.pro-message";

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
		return (value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function getMessageContent(element) {
		var response = "";
		if (!element) {
			return response;
		}
		for (var i = 0; i < element.childNodes.length; i++) {
			var node = element.childNodes[i];
			if (node.nodeType === 3) {
				response += settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
			} else if (node.nodeType === 1 && node.nodeName === "IMG") {
				if (settings.textonlymode) {
					response += node.getAttribute("alt") || node.getAttribute("title") || "";
				} else if (node.src) {
					response += '<img class="chat-emote" src="' + escapeHtml(node.src) + '" alt="' + escapeHtml(node.getAttribute("alt") || "") + '" title="' + escapeHtml(node.getAttribute("title") || "") + '">';
				}
			} else if (node.nodeType === 1 && node.nodeName === "BR") {
				response += settings.textonlymode ? "\n" : "<br>";
			} else if (node.nodeType === 1) {
				response += getMessageContent(node);
			}
		}
		return response;
	}

	function findMessageElement(row) {
		var bubble = row.querySelector(".chat-bubble");
		if (!bubble) {
			return null;
		}
		for (var i = 0; i < bubble.children.length; i++) {
			if (!bubble.children[i].classList.contains("chat-meta")) {
				return bubble.children[i];
			}
		}
		return null;
	}

	function rememberMessageId(messageId) {
		if (!messageId || seenMessageIds[messageId]) {
			return;
		}
		seenMessageIds[messageId] = true;
		seenMessageIdQueue.push(messageId);
		while (seenMessageIdQueue.length > MAX_SEEN_MESSAGE_IDS) {
			delete seenMessageIds[seenMessageIdQueue.shift()];
		}
	}

	function processMessage(row) {
		if (!row || !row.querySelector || row.ssnSealTeamSlothProcessed) {
			return false;
		}
		var messageId = row.getAttribute("data-message-id") || "";
		if (messageId && seenMessageIds[messageId]) {
			row.ssnSealTeamSlothProcessed = true;
			return false;
		}
		var nameElement = row.querySelector(".chat-name");
		var messageElement = findMessageElement(row);
		var name = nameElement ? nameElement.textContent.trim() : "";
		var message = getMessageContent(messageElement).trim();
		if (!name || !message) {
			return false;
		}
		var avatar = row.querySelector(".chat-avatar-mini img[src]");
		var badgeImages = row.querySelectorAll(".sts-role-badges img[src]");
		var chatbadges = [];
		for (var i = 0; i < badgeImages.length; i++) {
			if (badgeImages[i].src && chatbadges.indexOf(badgeImages[i].src) === -1) {
				chatbadges.push(badgeImages[i].src);
			}
		}
		var nameColor = "";
		try {
			nameColor = nameElement.style.getPropertyValue("--chat-name-color") || window.getComputedStyle(nameElement).color || "";
		} catch (e) {}
		var data = {
			chatname: name,
			chatbadges: chatbadges,
			backgroundColor: "",
			textColor: "",
			nameColor: nameColor,
			chatmessage: message,
			chatimg: avatar ? avatar.src : "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "sealteamsloth"
		};
		var userId = row.getAttribute("data-user-id") || "";
		if (userId) {
			data.userid = userId;
		}
		if (messageId) {
			data.id = messageId;
		}
		row.ssnSealTeamSlothProcessed = true;
		rememberMessageId(messageId);
		if (isExtensionOn) {
			sendToApp({ message: data });
		}
		return true;
	}

	function markExistingMessages(container) {
		var rows = container.querySelectorAll(CHAT_MESSAGE_SELECTOR);
		for (var i = 0; i < rows.length; i++) {
			rows[i].ssnSealTeamSlothProcessed = true;
			rememberMessageId(rows[i].getAttribute("data-message-id") || "");
		}
	}

	function scanForMessages(root) {
		if (!root || root.nodeType !== 1) {
			return;
		}
		if (root.matches && root.matches(CHAT_MESSAGE_SELECTOR)) {
			processMessage(root);
		}
		var rows = root.querySelectorAll ? root.querySelectorAll(CHAT_MESSAGE_SELECTOR) : [];
		for (var i = 0; i < rows.length; i++) {
			processMessage(rows[i]);
		}
	}

	function attachObserver(container) {
		if (observer) {
			observer.disconnect();
		}
		markExistingMessages(container);
		observer = new MutationObserver(function (mutations) {
			for (var i = 0; i < mutations.length; i++) {
				for (var j = 0; j < mutations[i].addedNodes.length; j++) {
					scanForMessages(mutations[i].addedNodes[j]);
				}
			}
		});
		observer.observe(container, { childList: true, subtree: true });
		observedContainer = container;
	}

	function checkViewerCount() {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}
		var viewerElement = document.querySelector("#chatViewerCount");
		if (!viewerElement) {
			return;
		}
		var viewerText = (viewerElement.textContent || "").replace(/,/g, "").trim();
		var viewerMatch = viewerText.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
		if (!viewerMatch) {
			return;
		}
		var multiplier = { K: 1000, M: 1000000, B: 1000000000 }[(viewerMatch[2] || "").toUpperCase()] || 1;
		var viewerCount = Math.round(parseFloat(viewerMatch[1]) * multiplier);
		if (isNaN(viewerCount) || viewerCount === lastViewerCount) {
			return;
		}
		lastViewerCount = viewerCount;
		sendToApp({ message: { type: "sealteamsloth", event: "viewer_update", meta: viewerCount } });
	}

	function focusChatInput() {
		var input = document.querySelector("#chatInput, #chatForm input, input[placeholder='Send a message...']");
		if (!input || input.disabled || input.readOnly) {
			return false;
		}
		input.focus();
		return true;
	}

	if (hasChromeRuntime()) {
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
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if (request === "getSource") {
					sendResponse("sealteamsloth");
					return;
				}
				if (request === "focusChat") {
					sendResponse(focusChatInput());
					return;
				}
				if (typeof request === "object" && request) {
					var handled = false;
					if ("state" in request) {
						isExtensionOn = request.state;
						handled = true;
					}
					if ("settings" in request) {
						settings = request.settings || {};
						lastViewerCount = null;
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

	function scanPage() {
		try {
			var container = document.querySelector(CHAT_CONTAINER_SELECTOR);
			if (container && container !== observedContainer) {
				attachObserver(container);
			}
			if (container) {
				scanForMessages(container);
			}
		} catch (e) {}
	}

	console.log("social stream injected");
	scanPage();
	setInterval(scanPage, 1000);
	setTimeout(checkViewerCount, 5000);
	setInterval(checkViewerCount, 30000);
})();
