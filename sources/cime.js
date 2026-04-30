(function () {
	var isExtensionOn = true;
	var settings = {};
	var observer = null;
	var observedTarget = null;
	var lastURL = location.href;
	var didInitialBacklogSkip = false;
	var recentlySeenMessages = new Map();
	var lastViewerCount = null;
	var DUPLICATE_WINDOW_MS = 1500;
	var INITIAL_BACKLOG_SUPPRESS_MS = 4000;
	var startupSuppressUntil = Date.now() + INITIAL_BACKLOG_SUPPRESS_MS;

	var CHAT_LIST_SELECTOR = "[data-rune='MessageListView']";
	var CHAT_ITEM_SELECTOR = "[data-rune='MessageItemView']";
	var VIEWER_COUNT_SELECTOR = "[class*='viewer_count_value__'], .viewer_count span";

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
		} catch (e) {}
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
			if (element.nodeType === 3) {
				return escapeHtml(element.textContent || "");
			}
			if (element.textContent) {
				return escapeHtml(element.textContent);
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

	function markProcessed(ele, signature) {
		if (!ele || !ele.dataset) {
			return;
		}
		ele.dataset.ssnProcessed = "1";
		if (signature) {
			ele.dataset.ssnLastMessageSignature = signature;
		}
	}

	function shouldSkipDuplicate(signature) {
		var now = Date.now();
		var previousSeenAt = recentlySeenMessages.get(signature);
		recentlySeenMessages.set(signature, now);

		if (recentlySeenMessages.size > 200) {
			recentlySeenMessages.forEach(function (timestamp, key) {
				if (now - timestamp > DUPLICATE_WINDOW_MS * 2) {
					recentlySeenMessages.delete(key);
				}
			});
		}

		return !!previousSeenAt && now - previousSeenAt < DUPLICATE_WINDOW_MS;
	}

	function getNameColor(nameEle) {
		if (!nameEle) {
			return "";
		}
		if (nameEle.style && nameEle.style.color) {
			return nameEle.style.color;
		}
		try {
			var computed = getComputedStyle(nameEle).color || "";
			if (computed && computed !== "rgba(0, 0, 0, 0)" && computed !== "transparent") {
				return computed;
			}
		} catch (e) {}
		return "";
	}

	function extractBadges(ele) {
		var badges = [];
		try {
			ele.querySelectorAll("[class*='badge_wrapper'] img[src]").forEach(function (img) {
				if (img.src) {
					badges.push(img.src);
				}
			});
		} catch (e) {}
		return badges;
	}

	function extractDonationAmount(ele) {
		try {
			var donationEle = ele.querySelector("[class*='beam__']");
			if (!donationEle) {
				return "";
			}

			var unit = "";
			var unitImg = donationEle.querySelector("img[alt]");
			if (unitImg && unitImg.alt) {
				unit = unitImg.alt.trim();
			}

			var clone = donationEle.cloneNode(true);
			clone.querySelectorAll("img").forEach(function (img) {
				img.remove();
			});

			var amount = (clone.textContent || "").replace(/\s+/g, " ").trim();
			if (!amount) {
				return "";
			}
			if (!unit) {
				unit = "Beam";
			}
			if (amount.toLowerCase().endsWith(unit.toLowerCase())) {
				return escapeHtml(amount);
			}
			return escapeHtml(amount + " " + unit);
		} catch (e) {
			return "";
		}
	}

	function parseViewerCount(raw) {
		if (raw === null || typeof raw === "undefined") {
			return null;
		}

		var text = (raw + "").trim().replace(/\s+/g, "");
		if (!text) {
			return null;
		}

		var multiplier = 1;
		var suffixMap = {
			K: 1000,
			M: 1000000,
			B: 1000000000,
			"천": 1000,
			"만": 10000,
			"억": 100000000
		};
		var suffix = text.slice(-1).toUpperCase();
		if (suffixMap[suffix]) {
			multiplier = suffixMap[suffix];
			text = text.slice(0, -1);
		}

		text = text.replace(/[^0-9.,]/g, "");
		if (!text) {
			return null;
		}

		if ((text.match(/\./g) || []).length > 1) {
			text = text.replace(/\./g, "");
		}
		if ((text.match(/,/g) || []).length > 1) {
			text = text.replace(/,/g, "");
		}
		if (text.includes(",") && !text.includes(".")) {
			text = text.replace(/,/g, "");
		} else {
			text = text.replace(/,/g, ".");
		}

		var parsed = parseFloat(text);
		if (!isFinite(parsed)) {
			return null;
		}
		return Math.max(0, Math.round(parsed * multiplier));
	}

	function emitViewerCount(viewerCount) {
		try {
			if (!isFinite(viewerCount)) {
				return;
			}
			viewerCount = Math.max(0, Math.round(viewerCount));
			if (lastViewerCount === viewerCount) {
				return;
			}
			lastViewerCount = viewerCount;
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: {
						type: "cime",
						event: "viewer_update",
						meta: viewerCount
					}
				},
				function () {}
			);
		} catch (e) {}
	}

	function checkViewers(force) {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}

		try {
			var viewerNode = document.querySelector(VIEWER_COUNT_SELECTOR);
			if (!viewerNode || !viewerNode.textContent) {
				return;
			}
			var viewerCount = parseViewerCount(viewerNode.textContent);
			if (viewerCount === null) {
				return;
			}
			if (force) {
				lastViewerCount = null;
			}
			emitViewerCount(viewerCount);
		} catch (e) {}
	}

	function findFocusableChatInput() {
		var selectors = [
			"[contenteditable='true'][role='textbox']",
			"[contenteditable='plaintext-only'][role='textbox']",
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
				if (!el) {
					continue;
				}
				if (el.disabled || el.readOnly) {
					continue;
				}
				if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") {
					continue;
				}
				return el;
			}
		}

		return null;
	}

	function buildMessageData(ele) {
		if (!ele || !ele.getAttribute) {
			return null;
		}

		var messageType = ele.getAttribute("data-type") || "";
		if (!messageType || messageType === "SYSTEM") {
			return null;
		}

		var name = "";
		var msg = "";
		var nameColor = "";
		var badges = [];
		var hasDonation = "";

		if (messageType === "DONATION_CHAT") {
			var donationRoot = ele.querySelector("[data-rune='DonationMessageChatView']");
			if (!donationRoot) {
				return null;
			}

			var donationNameEle = donationRoot.querySelector("[class*='name__']");
			if (donationNameEle) {
				name = escapeHtml((donationNameEle.textContent || "").trim());
			}

			var donationMsgEle = donationRoot.querySelector("[class*='msg__']");
			if (donationMsgEle) {
				msg = getAllContentNodes(donationMsgEle).trim();
			}

			hasDonation = extractDonationAmount(donationRoot);
		} else {
			var nameEle = ele.querySelector(".user");
			if (nameEle) {
				name = escapeHtml((nameEle.textContent || "").trim());
				nameColor = getNameColor(nameEle);
			}

			var msgEle = ele.querySelector("span[class*='text__']");
			if (msgEle) {
				msg = getAllContentNodes(msgEle).trim();
			}

			badges = extractBadges(ele);
		}

		if (!name || (!msg && !hasDonation)) {
			return null;
		}

		return {
			chatname: name,
			chatbadges: badges,
			backgroundColor: "",
			textColor: "",
			chatmessage: msg,
			nameColor: nameColor,
			chatimg: "",
			hasDonation: hasDonation,
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "cime"
		};
	}

	function processMessage(ele, force) {
		if (!ele || ele.nodeType !== 1 || !ele.querySelector) {
			return;
		}
		if (!force && ele.dataset && ele.dataset.ssnProcessed === "1") {
			return;
		}
		if (Date.now() < startupSuppressUntil) {
			markProcessed(ele);
			return;
		}

		var data = buildMessageData(ele);
		if (!data) {
			markProcessed(ele);
			return;
		}

		var signature = data.chatname + "::" + data.chatmessage + "::" + data.hasDonation;
		if (ele.dataset && ele.dataset.ssnLastMessageSignature === signature) {
			markProcessed(ele, signature);
			return;
		}
		if (shouldSkipDuplicate(signature)) {
			markProcessed(ele, signature);
			return;
		}

		markProcessed(ele, signature);
		pushMessage(data);
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

	function getMessageItemFromNode(node) {
		var element = null;

		if (!node) {
			return null;
		}
		if (node.nodeType === 1) {
			element = node;
		} else if (node.parentElement) {
			element = node.parentElement;
		}
		if (!element) {
			return null;
		}
		if (element.matches && element.matches(CHAT_ITEM_SELECTOR)) {
			return element;
		}
		if (element.closest) {
			return element.closest(CHAT_ITEM_SELECTOR);
		}
		return null;
	}

	function markExistingMessagesProcessed(target) {
		try {
			target.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function (item) {
				markProcessed(item);
			});
		} catch (e) {}
	}

	function scanUnprocessedMessages(target) {
		try {
			target.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function (item) {
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
		if (!target) {
			return;
		}

		var MutationObserverRef = window.MutationObserver || window.WebKitMutationObserver;
		if (!MutationObserverRef) {
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

				if (mutation.type === "childList" || mutation.type === "characterData" || mutation.type === "attributes") {
					try {
						var messageItem = getMessageItemFromNode(mutation.target);
						if (messageItem) {
							processMessage(messageItem, true);
						}
					} catch (e) {}
				}
			});
		});

		observer.observe(target, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "style"]
		});
	}

	function resetStateForNavigation() {
		didInitialBacklogSkip = false;
		startupSuppressUntil = Date.now() + INITIAL_BACKLOG_SUPPRESS_MS;
		recentlySeenMessages.clear();
		lastViewerCount = null;
		observedTarget = null;
		disconnectObserver();
	}

	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
			return;
		}
		response = response || {};
		if ("settings" in response) {
			settings = response.settings;
		}
		if ("state" in response) {
			isExtensionOn = response.state;
		}
		checkViewers(true);
	});

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if (request === "getSource") {
				sendResponse("cime");
				return;
			}
			if (request === "focusChat") {
				var input = findFocusableChatInput();
				if (input) {
					if (typeof input.click === "function") {
						input.click();
					}
					input.focus();
					sendResponse(true);
					return;
				}

				var loginButton = document.querySelector("button[class*='editor_login_txt__']");
				if (loginButton) {
					loginButton.click();
					sendResponse(true);
					return;
				}
			}
			if (typeof request === "object" && request && "settings" in request) {
				settings = request.settings;
				checkViewers(true);
				sendResponse(true);
				return;
			}
			if (typeof request === "object" && request && "state" in request) {
				isExtensionOn = request.state;
				checkViewers(true);
				sendResponse(true);
				return;
			}
		} catch (e) {}
		sendResponse(false);
	});

	console.log("social stream injected");

	setInterval(function () {
		try {
			if (location.href !== lastURL) {
				lastURL = location.href;
				resetStateForNavigation();
			}

			var chatList = document.querySelector(CHAT_LIST_SELECTOR);
			if (!chatList) {
				return;
			}

			if (observedTarget !== chatList) {
				disconnectObserver();
				observedTarget = chatList;
				if (!didInitialBacklogSkip) {
					// Skip the already-rendered history when we first attach.
					markExistingMessagesProcessed(chatList);
					didInitialBacklogSkip = true;
				}
				onElementInserted(chatList);
			}

			checkViewers(false);
			scanUnprocessedMessages(chatList);
		} catch (e) {}
	}, 1000);
})();
