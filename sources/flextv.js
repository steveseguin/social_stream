(function () {
	var settings = {};
	var observer = null;
	var observedTarget = null;
	var lastURL = location.href;
	var didInitialBacklogSkip = false;
	var recentlySeenMessages = new Map();
	var DUPLICATE_WINDOW_MS = 1500;

	var CHAT_CONTAINER_SELECTOR = "#chat-feed, .chat-list, .chat-content";
	var CHAT_ITEM_SELECTOR = ".chat-item";

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
		try {
			if (settings.textonlymode) {
				return unsafe || "";
			}
			return (unsafe || "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");
		} catch (e) {
			return "";
		}
	}

	function getAllContentNodes(element) {
		var resp = "";

		if (!element) {
			return resp;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.nodeType === 3 || element.textContent) {
				return escapeHtml(element.textContent || "");
			}
			return "";
		}

		element.childNodes.forEach(function (node) {
			if (node.childNodes && node.childNodes.length) {
				resp += getAllContentNodes(node);
			} else if (node.nodeType === 3 && node.textContent && node.textContent.trim().length) {
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1) {
				if (settings.textonlymode) {
					if (node.nodeName === "IMG" && node.alt) {
						resp += escapeHtml(node.alt);
					}
				} else {
					if (node.nodeName === "IMG" && node.src) {
						node.src = node.src + "";
					}
					resp += node.outerHTML || "";
				}
			}
		});

		return resp;
	}

	function parseMember(nameEle) {
		try {
			var raw = nameEle ? nameEle.getAttribute("data-member") : "";
			if (!raw) {
				return {};
			}
			return JSON.parse(raw) || {};
		} catch (e) {
			return {};
		}
	}

	function getNameColor(nameWrapper) {
		if (!nameWrapper) {
			return "";
		}
		try {
			if (nameWrapper.style && nameWrapper.style.color) {
				return nameWrapper.style.color;
			}
			return getComputedStyle(nameWrapper).color || "";
		} catch (e) {
			return "";
		}
	}

	function getBadges(item) {
		var badges = [];
		try {
			var header = item.querySelector(".txt-wrap > .flex, .chat-user-name");
			if (!header) {
				return badges;
			}
			header.querySelectorAll("img[src]").forEach(function (img) {
				var src = img.src || "";
				if (!src) {
					return;
				}
				if ((img.alt || "").toLowerCase() === "gender") {
					return;
				}
				if (/\/svg\/ico_(man|woman)\.svg/i.test(src)) {
					return;
				}
				badges.push(src);
			});
		} catch (e) {}
		return badges;
	}

	function buildMeta(member) {
		var meta = {};
		if (!member || typeof member !== "object") {
			return meta;
		}
		if (typeof member.id !== "undefined") {
			meta.userId = member.id;
		}
		if (typeof member.loginId !== "undefined") {
			meta.loginId = member.loginId;
		}
		if (typeof member.channelId !== "undefined") {
			meta.channelId = member.channelId;
		}
		if (typeof member.gender !== "undefined") {
			meta.gender = member.gender;
		}
		if (typeof member.level !== "undefined") {
			meta.level = member.level;
		}
		if (typeof member.month !== "undefined") {
			meta.month = member.month;
		}
		if (typeof member.ranking !== "undefined") {
			meta.ranking = member.ranking;
		}
		if (member.role) {
			meta.role = member.role;
		}
		return meta;
	}

	function rememberMessage(signature) {
		var now = Date.now();
		recentlySeenMessages.set(signature, now);
		if (recentlySeenMessages.size > 200) {
			recentlySeenMessages.forEach(function (timestamp, key) {
				if (now - timestamp > DUPLICATE_WINDOW_MS * 2) {
					recentlySeenMessages.delete(key);
				}
			});
		}
	}

	function hasSeenMessage(signature) {
		var previousSeenAt = recentlySeenMessages.get(signature);
		return !!previousSeenAt && Date.now() - previousSeenAt < DUPLICATE_WINDOW_MS;
	}

	function markProcessed(item, signature) {
		if (!item || !item.dataset) {
			return;
		}
		item.dataset.ssnProcessed = "1";
		if (signature) {
			item.dataset.ssnLastMessageSignature = signature;
		}
	}

	function buildMessageData(item) {
		var nameEle = item.querySelector(".chat-user-name [data-member], .chat-user-name .inline-block, .chat-user-name");
		var nameWrapper = item.querySelector(".chat-user-name");
		var member = parseMember(nameEle);
		var name = "";
		var msg = "";

		if (member.nickname) {
			name = member.nickname;
		} else if (nameEle) {
			name = (nameEle.textContent || "").trim();
		}
		name = escapeHtml(name);

		var msgEle = item.querySelector(".chat");
		if (msgEle) {
			msg = getAllContentNodes(msgEle).trim();
		}

		if (!name || !msg) {
			return null;
		}

		var data = {};
		data.chatname = name;
		data.chatbadges = getBadges(item);
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = getNameColor(nameWrapper);
		data.chatmessage = msg;
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "flextv";

		if (typeof member.id !== "undefined") {
			data.userid = String(member.id);
		} else if (member.loginId) {
			data.userid = String(member.loginId);
		}

		var meta = buildMeta(member);
		if (Object.keys(meta).length) {
			data.meta = meta;
		}

		return data;
	}

	function processMessage(item, force) {
		if (!item || item.nodeType !== 1 || !item.querySelector) {
			return;
		}
		if (!force && item.dataset && item.dataset.ssnProcessed === "1") {
			return;
		}

		var data = buildMessageData(item);
		if (!data) {
			markProcessed(item);
			return;
		}

		var signature = data.userid + "::" + data.chatname + "::" + data.chatmessage;
		if (item.dataset && item.dataset.ssnLastMessageSignature === signature) {
			markProcessed(item, signature);
			return;
		}
		if (hasSeenMessage(signature)) {
			markProcessed(item, signature);
			return;
		}

		rememberMessage(signature);
		markProcessed(item, signature);
		sendToApp({ message: data });
	}

	function forEachMessageNode(node, callback) {
		if (!node || node.nodeType !== 1) {
			return;
		}
		if (node.matches && node.matches(CHAT_ITEM_SELECTOR)) {
			callback(node);
		}
		if (node.querySelectorAll) {
			node.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function (item) {
				callback(item);
			});
		}
	}

	function markExistingMessages(container) {
		try {
			container.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function (item) {
				markProcessed(item);
				var data = buildMessageData(item);
				if (data) {
					rememberMessage(data.userid + "::" + data.chatname + "::" + data.chatmessage);
				}
			});
		} catch (e) {}
	}

	function scanUnprocessedMessages(container) {
		try {
			container.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function (item) {
				processMessage(item);
			});
		} catch (e) {}
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

	function onElementInserted(target) {
		var MutationObserverRef = window.MutationObserver || window.WebKitMutationObserver;
		if (!MutationObserverRef || !target) {
			return;
		}

		observer = new MutationObserverRef(function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes && mutation.addedNodes.length) {
					for (var i = 0; i < mutation.addedNodes.length; i++) {
						try {
							forEachMessageNode(mutation.addedNodes[i], processMessage);
						} catch (e) {}
					}
				}
			});
		});

		observer.observe(target, {
			childList: true,
			subtree: true
		});
	}

	function findChatContainer() {
		var direct = document.querySelector("#chat-feed");
		if (direct) {
			return direct;
		}
		var item = document.querySelector(CHAT_ITEM_SELECTOR);
		if (item && item.parentElement) {
			return item.parentElement;
		}
		return document.querySelector(CHAT_CONTAINER_SELECTOR);
	}

	function findFocusableChatInput() {
		var selectors = [
			"[contenteditable='true'][role='textbox']",
			"[role='textbox'][contenteditable='true']",
			"textarea",
			"input[type='text']",
			"input:not([type])",
			"[contenteditable='true']",
			"[role='textbox']"
		];

		for (var i = 0; i < selectors.length; i++) {
			var matches = document.querySelectorAll(selectors[i]);
			for (var j = 0; j < matches.length; j++) {
				var el = matches[j];
				if (!el || el.disabled || el.readOnly) {
					continue;
				}
				return el;
			}
		}
		return null;
	}

	function resetForNavigation() {
		didInitialBacklogSkip = false;
		observedTarget = null;
		recentlySeenMessages.clear();
		disconnectObserver();
	}

	if (hasChromeRuntime()) {
		chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
				return;
			}
			response = response || {};
			if ("settings" in response) {
				settings = response.settings;
			}
		});

		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if (request === "getSource") {
					sendResponse("flextv");
					return;
				}
				if (request === "focusChat") {
					var input = findFocusableChatInput();
					if (input) {
						input.focus();
						sendResponse(true);
						return;
					}
				}
				if (typeof request === "object" && request && "settings" in request) {
					settings = request.settings;
					sendResponse(true);
					return;
				}
			} catch (e) {}
			sendResponse(false);
		});
	}

	console.log("social stream injected");

	setInterval(function () {
		try {
			if (location.href !== lastURL) {
				lastURL = location.href;
				resetForNavigation();
			}

			var container = findChatContainer();
			if (!container) {
				return;
			}

			if (observedTarget !== container) {
				disconnectObserver();
				observedTarget = container;
				if (!didInitialBacklogSkip) {
					markExistingMessages(container);
					didInitialBacklogSkip = true;
				}
				onElementInserted(container);
			}

			scanUnprocessedMessages(container);
		} catch (e) {}
	}, 1000);
})();
