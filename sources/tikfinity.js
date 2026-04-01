(function () {
	if (window.location.pathname.indexOf("/widget/vite/src/activity-feed/") === -1) {
		return;
	}

	console.log("Social stream injected");

	var settings = {};
	var isExtensionOn = true;
	var observer = null;
	var observedTarget = null;
	var rawTransportActive = false;
	var lastRawMessageAt = 0;
	var initialDomScanDone = false;
	var RAW_TRANSPORT_IDLE_MS = 15000;
	var supportedRawTypes = {
		chat: true,
		gift: true,
		follow: true,
		share: true,
		subscribe: true,
		member: true,
		join: true,
		envelope: true
	};

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

	function normalizeText(value) {
		return (value || "").replace(/\s+/g, " ").trim();
	}

	function getAllContentNodes(element) {
		var resp = "";
		if (!element) {
			return resp;
		}
		if (!element.childNodes || !element.childNodes.length) {
			return escapeHtml(element.textContent || "");
		}
		for (var i = 0; i < element.childNodes.length; i++) {
			var node = element.childNodes[i];
			if (!settings.textonlymode && node.nodeType === 1) {
				try {
					var style = window.getComputedStyle(node);
					if (style.display === "none") {
						continue;
					}
				} catch (e) {}
			}
			if (node.childNodes && node.childNodes.length) {
				resp += getAllContentNodes(node);
			} else if (node.nodeType === 3) {
				if (node.textContent && node.textContent.trim().length) {
					resp += escapeHtml(node.textContent);
				}
			} else if (node.nodeType === 1) {
				if (settings.textonlymode) {
					if (node.alt) {
						resp += escapeHtml(node.alt);
					}
				} else {
					resp += node.outerHTML || "";
				}
			}
		}
		return resp;
	}

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {
				if (chrome.runtime && chrome.runtime.lastError) {
					return;
				}
			});
		} catch (e) {}
	}

	function normalizeRawType(rawType) {
		rawType = normalizeText(rawType).toLowerCase();
		if (rawType === "join") {
			return "member";
		}
		return rawType;
	}

	function isSupportedRawEvent(rawType, payload) {
		if (!supportedRawTypes[rawType]) {
			return false;
		}
		if (!payload || typeof payload !== "object") {
			return false;
		}
		if (rawType === "chat") {
			return !!(payload.comment || payload.nickname || payload.uniqueId);
		}
		if ((rawType === "gift") && !(payload.giftName || payload.giftId || payload.giftPictureUrl)) {
			return false;
		}
		return true;
	}

	function enableRawTransport() {
		rawTransportActive = true;
		lastRawMessageAt = Date.now();
		if (observer) {
			observer.disconnect();
			observer = null;
			observedTarget = null;
		}
	}

	function shouldUseRawTransport() {
		if (!rawTransportActive) {
			return false;
		}
		if (!lastRawMessageAt) {
			return false;
		}
		if ((Date.now() - lastRawMessageAt) <= RAW_TRANSPORT_IDLE_MS) {
			return true;
		}
		rawTransportActive = false;
		lastRawMessageAt = 0;
		return false;
	}

	function getProfileUrl(uniqueId, href) {
		var profileUrl = "";
		try {
			if (href && href !== "#" && href !== "javascript:void(0)") {
				profileUrl = new URL(href, window.location.href).href;
			}
		} catch (e) {}
		if (!profileUrl && uniqueId) {
			profileUrl = "https://tiktok.com/@" + encodeURIComponent((uniqueId + "").replace(/^@/, ""));
		}
		return profileUrl;
	}

	function getBadgesFromElement(root) {
		var badges = [];
		if (!root || !root.querySelectorAll) {
			return badges;
		}
		root.querySelectorAll(".message__user-badge[src]").forEach(function (badge) {
			if (badge && badge.src) {
				badges.push(badge.src + "");
			}
		});
		return badges;
	}

	function getBadgesFromPayload(payload) {
		var badges = [];
		if (!payload || !payload.userBadges || !payload.userBadges.length) {
			return badges;
		}
		for (var i = 0; i < payload.userBadges.length; i++) {
			var badge = payload.userBadges[i];
			if (badge && badge.type === "image" && badge.url) {
				badges.push(badge.url + "");
			}
		}
		return badges;
	}

	function getPlainSenderName(sender) {
		if (!sender) {
			return "";
		}
		try {
			var clone = sender.cloneNode(true);
			clone.querySelectorAll("img, svg").forEach(function (node) {
				node.remove();
			});
			return normalizeText(clone.textContent || "");
		} catch (e) {
			return normalizeText(sender.textContent || "");
		}
	}

	function formatCoins(value) {
		value = parseInt(value, 10) || 0;
		return value === 1 ? "1 coin" : value.toLocaleString() + " coins";
	}

	function formatChatMessageFromPayload(comment, emotes) {
		comment = comment || "";
		if (settings.textonlymode || !emotes || !emotes.length) {
			return escapeHtml(comment);
		}
		var pieces = [];
		var grouped = {};
		for (var i = 0; i < emotes.length; i++) {
			var emote = emotes[i];
			var position = parseInt(emote && emote.placeInComment, 10);
			if (!isFinite(position)) {
				position = comment.length;
			}
			if (!grouped[position]) {
				grouped[position] = [];
			}
			grouped[position].push(emote);
		}
		for (var j = 0; j < comment.length; j++) {
			if (grouped[j]) {
				for (var g = 0; g < grouped[j].length; g++) {
					var groupedEmote = grouped[j][g];
					if (groupedEmote && groupedEmote.emoteImageUrl) {
						pieces.push('<img class="tikfinity-emote" src="' + escapeHtml(groupedEmote.emoteImageUrl) + '" alt="' + escapeHtml(groupedEmote.emoteId || "emote") + '">');
					}
				}
			}
			pieces.push(escapeHtml(comment.charAt(j)));
		}
		if (grouped[comment.length]) {
			for (var k = 0; k < grouped[comment.length].length; k++) {
				var tailEmote = grouped[comment.length][k];
				if (tailEmote && tailEmote.emoteImageUrl) {
					pieces.push('<img class="tikfinity-emote" src="' + escapeHtml(tailEmote.emoteImageUrl) + '" alt="' + escapeHtml(tailEmote.emoteId || "emote") + '">');
				}
			}
		}
		return pieces.join("");
	}

	function shouldSkipEvent(eventName) {
		if (eventName === "joined" && !settings.capturejoinedevent) {
			return true;
		}
		if (eventName === "gift" && settings.notiktokdonations && !settings.tiktokdonations) {
			return true;
		}
		if (eventName && eventName !== "gift" && eventName !== "joined" && settings.captureevents === false) {
			return true;
		}
		return false;
	}

	function createBaseData(chatname, chatimg, badges) {
		return {
			chatname: escapeHtml(chatname || ""),
			chatbadges: badges || [],
			backgroundColor: "",
			textColor: "",
			nameColor: "",
			chatmessage: "",
			chatimg: chatimg || "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "tiktok"
		};
	}

	function finalizeAndPush(data, meta) {
		if (!data.chatname && !data.chatmessage && !data.hasDonation) {
			return;
		}
		if (meta && Object.keys(meta).length) {
			data.meta = meta;
		}
		pushMessage(data);
	}

	function processPayloadMessage(rawType, payload) {
		if (!payload || typeof payload !== "object" || !isExtensionOn) {
			return;
		}
		rawType = normalizeRawType(rawType);
		if (!isSupportedRawEvent(rawType, payload)) {
			return;
		}
		enableRawTransport();

		var chatname = normalizeText(payload.nickname || payload.uniqueId || "");
		var data = createBaseData(chatname, payload.profilePictureUrl || "", getBadgesFromPayload(payload));
		var meta = {};
		var profileUrl = getProfileUrl(payload.uniqueId || "", payload.profileUrl || "");
		if (payload.uniqueId) {
			meta.uniqueId = payload.uniqueId;
		}
		if (payload.userId !== undefined) {
			meta.userId = payload.userId;
		}
		if (profileUrl) {
			meta.profile = profileUrl;
		}
		if (payload.createTime) {
			try {
				meta.timestamp = new Date(parseInt(payload.createTime, 10)).toISOString();
			} catch (e) {}
		}

		if (rawType === "chat") {
			data.chatmessage = formatChatMessageFromPayload(payload.comment || "", payload.emotes || []);
		} else if (rawType === "gift") {
			data.event = "gift";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			var repeatCount = parseInt(payload.repeatCount, 10) || 1;
			var diamondCount = parseInt(payload.diamondCount, 10) || 0;
			data.chatmessage = escapeHtml((payload.giftName || "Gift") + (repeatCount > 1 ? " x" + repeatCount : ""));
			data.hasDonation = formatCoins(diamondCount * repeatCount);
			data.contentimg = payload.giftPictureUrl || "";
			meta.giftId = payload.giftId;
			meta.giftName = payload.giftName || "";
			meta.repeatCount = repeatCount;
			meta.diamondCount = diamondCount;
			if (payload.groupId) {
				meta.groupId = payload.groupId;
			}
			if (payload.giftType !== undefined) {
				meta.streakable = payload.giftType === 1;
			}
			if (payload.repeatEnd !== undefined) {
				meta.repeatEnd = !!payload.repeatEnd;
			}
		} else if (rawType === "follow") {
			data.event = "followed";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = "Started following!";
		} else if (rawType === "share") {
			data.event = "shared";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = "Shared the stream!";
		} else if (rawType === "subscribe") {
			data.event = "subscribe";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = "Subscribed!";
			data.membership = "SUBSCRIBER";
		} else if (rawType === "member") {
			data.event = "joined";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = "Joined!";
		} else if (rawType === "envelope") {
			data.event = "envelope";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			var coins = parseInt(payload.coins, 10) || 0;
			var canOpen = parseInt(payload.canOpen, 10) || 0;
			data.chatmessage = "Sent a treasure chest with " + coins + " coins for " + canOpen + " people";
			meta.coins = coins;
			meta.canOpen = canOpen;
		} else {
			return;
		}

		finalizeAndPush(data, meta);
	}

	function processDomMessage(messageElement) {
		if (!messageElement || !messageElement.isConnected || messageElement.dataset.ssProcessed) {
			return;
		}
		if (shouldUseRawTransport() || !isExtensionOn) {
			return;
		}
		messageElement.dataset.ssProcessed = "1";

		var rawType = (messageElement.getAttribute("data-type") || "").toLowerCase();
		if (!rawType) {
			return;
		}

		var avatar = messageElement.querySelector(".message__pfp");
		var sender = messageElement.querySelector(".message__sender");
		var uniqueId = avatar && avatar.getAttribute("alt") ? avatar.getAttribute("alt") : "";
		var chatname = getPlainSenderName(sender) || uniqueId;
		var data = createBaseData(chatname, avatar && avatar.src ? avatar.src : "", getBadgesFromElement(messageElement));
		var meta = {};
		var profileUrl = getProfileUrl(uniqueId, sender && sender.getAttribute ? sender.getAttribute("href") : "");
		if (uniqueId) {
			meta.uniqueId = uniqueId;
		}
		if (profileUrl) {
			meta.profile = profileUrl;
		}

		if (rawType === "chat") {
			var textWrap = messageElement.querySelector(".message__text");
			var textBody = textWrap ? textWrap.querySelector("span") : null;
			data.chatmessage = getAllContentNodes(textBody);
			if (textWrap && textWrap.getAttribute("title")) {
				meta.timestamp = textWrap.getAttribute("title");
			}
		} else if (rawType === "gift") {
			data.event = "gift";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			var giftNameElement = messageElement.querySelector(".gift-name");
			var giftName = "";
			if (giftNameElement) {
				try {
					var giftClone = giftNameElement.cloneNode(true);
					giftClone.querySelectorAll(".gift-id").forEach(function (node) {
						node.remove();
					});
					giftName = normalizeText(giftClone.textContent || "");
				} catch (e) {
					giftName = normalizeText(giftNameElement.textContent || "");
				}
			}
			var streakText = normalizeText((messageElement.querySelector(".gift-streak") || {}).textContent || "");
			data.chatmessage = escapeHtml(giftName + (streakText ? " " + streakText : ""));
			data.hasDonation = normalizeText((messageElement.querySelector(".gift-cost") || {}).textContent || "");
			data.contentimg = ((messageElement.querySelector(".gift-icon") || {}).src) || "";
			var giftIdText = normalizeText((messageElement.querySelector(".gift-id") || {}).textContent || "");
			if (giftIdText) {
				meta.giftId = giftIdText.replace(/[^\d]/g, "");
			}
			if (giftName) {
				meta.giftName = giftName;
			}
			if (streakText) {
				meta.repeatText = streakText;
			}
		} else if (rawType === "follow") {
			data.event = "followed";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = normalizeText((messageElement.querySelector(".follow-text") || {}).textContent || "Started following!");
		} else if (rawType === "share") {
			data.event = "shared";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = normalizeText((messageElement.querySelector(".share-text") || {}).textContent || "Shared the stream!");
		} else if (rawType === "subscribe") {
			data.event = "subscribe";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = normalizeText((messageElement.querySelector(".subscribe-text") || {}).textContent || "Subscribed!");
			data.membership = "SUBSCRIBER";
		} else if (rawType === "join") {
			data.event = "joined";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = normalizeText((messageElement.querySelector(".join-text") || {}).textContent || "Joined!");
		} else if (rawType === "envelope") {
			data.event = "envelope";
			if (shouldSkipEvent(data.event)) {
				return;
			}
			data.chatmessage = normalizeText((messageElement.querySelector(".envelope-text") || {}).textContent || "");
			var envelopeMatch = data.chatmessage.match(/with\s+([\d,]+)\s+coins?\s+for\s+([\d,]+)\s+people/i);
			if (envelopeMatch) {
				meta.coins = parseInt((envelopeMatch[1] || "0").replace(/,/g, ""), 10) || 0;
				meta.canOpen = parseInt((envelopeMatch[2] || "0").replace(/,/g, ""), 10) || 0;
			}
		} else {
			return;
		}

		finalizeAndPush(data, meta);
	}

	function observeFeed(target) {
		if (!target || shouldUseRawTransport()) {
			return;
		}
		if (observedTarget === target && observer) {
			return;
		}
		if (observer) {
			observer.disconnect();
			observer = null;
			observedTarget = null;
		}
		if (!initialDomScanDone) {
			target.querySelectorAll(".message").forEach(function (messageElement) {
				messageElement.dataset.ssProcessed = "1";
			});
			initialDomScanDone = true;
		} else {
			target.querySelectorAll(".message").forEach(processDomMessage);
		}
		observer = new MutationObserver(function (mutations) {
			if (shouldUseRawTransport() || !isExtensionOn) {
				return;
			}
			mutations.forEach(function (mutation) {
				if (!mutation.addedNodes || !mutation.addedNodes.length) {
					return;
				}
				for (var i = 0; i < mutation.addedNodes.length; i++) {
					var node = mutation.addedNodes[i];
					if (!node || node.nodeType !== 1) {
						continue;
					}
					if (node.classList && node.classList.contains("message")) {
						processDomMessage(node);
					} else if (node.querySelectorAll) {
						node.querySelectorAll(".message").forEach(processDomMessage);
					}
				}
			});
		});
		observer.observe(target, { childList: true, subtree: false });
		observedTarget = target;
	}

	function startDomFallback() {
		if (shouldUseRawTransport() || !isExtensionOn) {
			return;
		}
		var target = document.querySelector(".activity-feed__content");
		if (target) {
			observeFeed(target);
		}
	}

	function handleWindowMessage(event) {
		if (!event || !event.data || typeof event.data !== "object") {
			return;
		}
		if (!event.data.type || !("payload" in event.data)) {
			return;
		}
		processPayloadMessage(event.data.type + "", event.data.payload);
	}

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if (request === "getSource") {
				sendResponse("tikfinity");
				return;
			}
			if (request === "focusChat") {
				sendResponse(false);
				return;
			}
			if (request && typeof request === "object") {
				if ("settings" in request) {
					settings = request.settings || {};
					sendResponse(true);
					return;
				}
				if ("state" in request) {
					isExtensionOn = request.state !== false;
					sendResponse(true);
					return;
				}
			}
		} catch (e) {}
		sendResponse(false);
	});

	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
			return;
		}
		response = response || {};
		if ("settings" in response) {
			settings = response.settings || {};
		}
		if ("state" in response) {
			isExtensionOn = response.state !== false;
		}
	});

	window.addEventListener("message", handleWindowMessage, false);
	setInterval(startDomFallback, 2000);
	startDomFallback();

	window.addEventListener("beforeunload", function () {
		if (observer) {
			observer.disconnect();
			observer = null;
			observedTarget = null;
		}
		window.removeEventListener("message", handleWindowMessage, false);
	});
})();
