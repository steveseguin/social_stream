(function () {
	if (window.__socialStreamTikfinityInjected) {
		return;
	}
	if (window.location.pathname.indexOf("/widget/vite/src/activity-feed/") === -1) {
		return;
	}
	window.__socialStreamTikfinityInjected = true;

	console.log("Social stream injected");

	var settings = {};
	var isExtensionOn = true;
	var RECENT_EVENT_WINDOW_MS = 2500;
	var recentEventMap = new Map();

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

	function cleanupRecentEvents(now) {
		recentEventMap.forEach(function (timestamp, key) {
			if ((now - timestamp) > RECENT_EVENT_WINDOW_MS) {
				recentEventMap.delete(key);
			}
		});
	}

	function normalizeMessageForKey(message) {
		message = message || "";
		message = message.replace(/<img[^>]+alt=(["'])(.*?)\1[^>]*>/gi, " $2 ");
		message = message.replace(/<img[^>]+src=(["'])(.*?)\1[^>]*>/gi, function (match, quote, src) {
			return " [img:" + normalizeText((src || "").split("?")[0].toLowerCase()) + "] ";
		});
		message = message.replace(/<[^>]+>/g, " ");
		return normalizeText(message);
	}

	function buildRecentEventKey(data, meta) {
		return [
			normalizeText(data && data.event ? data.event : "chat"),
			normalizeText(meta && meta.groupId ? String(meta.groupId) : ""),
			normalizeText(meta && meta.giftId ? String(meta.giftId) : ""),
			normalizeText(meta && meta.userId !== undefined ? String(meta.userId) : ""),
			normalizeText(meta && meta.uniqueId ? meta.uniqueId : ""),
			normalizeText(data && data.chatname ? data.chatname : ""),
			normalizeMessageForKey(data && data.chatmessage ? data.chatmessage : ""),
			normalizeText(data && data.hasDonation ? data.hasDonation : ""),
			normalizeText(data && data.membership ? data.membership : ""),
			normalizeText(data && data.contentimg ? data.contentimg : ""),
			normalizeText(meta && meta.repeatCount !== undefined ? String(meta.repeatCount) : ""),
			normalizeText(meta && meta.repeatText ? meta.repeatText : "")
		].join("|");
	}

	function shouldEmitEvent(data, meta) {
		var now = Date.now();
		var key = buildRecentEventKey(data, meta);
		cleanupRecentEvents(now);
		if (!key) {
			return true;
		}
		if (recentEventMap.has(key)) {
			return false;
		}
		recentEventMap.set(key, now);
		return true;
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
		if (!shouldEmitEvent(data, meta)) {
			return;
		}
		pushMessage(data);
	}

	function processPayloadMessage(rawType, payload) {
		if (!payload || typeof payload !== "object" || !isExtensionOn) {
			return;
		}

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

	function handleWindowMessage(event) {
		if (!event || !event.data || typeof event.data !== "object") {
			return;
		}
		if (!event.data.type || !("payload" in event.data)) {
			return;
		}
		processPayloadMessage((event.data.type + "").toLowerCase(), event.data.payload);
	}

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if (request === "getSource") {
				// TikFinity is read-only for outbound chat, so keep it out of relay targets.
				sendResponse(false);
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

	window.addEventListener("beforeunload", function () {
		window.removeEventListener("message", handleWindowMessage, false);
	});
})();
