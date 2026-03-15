(function () {
	var isExtensionOn = true;
	var settings = {};
	var observer = null;
	var observedList = null;
	var processedMessageNodes = new WeakSet();
	var lastDataIndex = -1;
	var lastViewerCount = null;
	var lastAuctionSnapshot = "";
	var lastCommerceSnapshot = "";
	var lastWebSocketChatAt = 0;
	var lastWebSocketViewerAt = 0;
	var recentWebSocketMessageIds = [];
	var recentWebSocketMessageLookup = Object.create(null);
	var recentWebSocketActivityIds = [];
	var recentWebSocketActivityLookup = Object.create(null);
	var webSocketActivityWindowMs = 30000;
	var lastWebSocketLivestreamState = "";
	var lastWebSocketGiveawayState = "";
	var webSocketSnapshotRefreshTimer = null;

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

	function extractLargestSrc(srcset) {
		try {
			var sources = (srcset || "").split(",").map(function (src) {
				var parts = src.trim().split(" ");
				return {
					url: parts[0] || "",
					size: parseInt(parts[1], 10) || 0
				};
			}).filter(function (entry) {
				return entry.url;
			});
			if (!sources.length) {
				return "";
			}
			return sources.reduce(function (largest, current) {
				return current.size > largest.size ? current : largest;
			}, sources[0]).url;
		} catch (e) {
			return "";
		}
	}

	function getImageUrl(imageElement) {
		if (!imageElement) {
			return "";
		}
		try {
			if (imageElement.srcset) {
				var largest = extractLargestSrc(imageElement.srcset);
				if (largest) {
					return largest;
				}
			}
			return imageElement.src || "";
		} catch (e) {
			return "";
		}
	}

	function getAllContentNodes(element) {
		var response = "";
		if (!element) {
			return response;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (!element.textContent) {
				return "";
			}
			return settings.textonlymode ? element.textContent : escapeHtml(element.textContent);
		}

		element.childNodes.forEach(function (node) {
			if (node.nodeType === 3) {
				if (!node.textContent || !node.textContent.trim().length) {
					return;
				}
				response += settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
				return;
			}

			if (node.nodeType !== 1) {
				return;
			}

			if (settings.textonlymode) {
				response += getAllContentNodes(node);
				return;
			}

			if (node.nodeName === "IMG" && node.outerHTML) {
				response += node.outerHTML;
				return;
			}

			if (node.childNodes && node.childNodes.length) {
				response += getAllContentNodes(node);
				return;
			}

			if (node.outerHTML) {
				response += node.outerHTML;
			}
		});

		return response;
	}

	function getMessageIndex(messageElement) {
		try {
			var indexedNode = messageElement.closest("[data-index]");
			if (!indexedNode || !indexedNode.dataset || typeof indexedNode.dataset.index === "undefined") {
				return null;
			}
			var parsed = parseInt(indexedNode.dataset.index, 10);
			return Number.isFinite(parsed) ? parsed : null;
		} catch (e) {
			return null;
		}
	}

	function getMessageContentContainer(messageElement) {
		if (!messageElement) {
			return null;
		}
		var directDivChildren = Array.from(messageElement.children || []).filter(function (child) {
			return child && child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === "div";
		});
		if (directDivChildren.length) {
			return directDivChildren[directDivChildren.length - 1];
		}
		var linked = messageElement.querySelector("a + div");
		return linked || null;
	}

	function getNameFromMessage(messageElement, contentContainer) {
		var name = "";
		try {
			if (contentContainer) {
				var topRow = contentContainer.firstElementChild;
				if (topRow) {
					var topStrong = topRow.querySelector("strong");
					if (topStrong && topStrong.textContent) {
						name = topStrong.textContent.trim();
					}
				}

				if (!name) {
					var strongs = contentContainer.querySelectorAll("strong");
					if (strongs.length && strongs[0].textContent) {
						name = strongs[0].textContent.trim();
					}
				}
			}

			if (!name) {
				var userLink = messageElement.querySelector("a[href*='/user/']");
				if (userLink) {
					var href = userLink.getAttribute("href") || "";
					var match = href.match(/\/user\/([^/?#]+)/i);
					if (match && match[1]) {
						name = decodeURIComponent(match[1]).trim();
					}
				}
			}
		} catch (e) {}
		return name;
	}

	function getMessageBodyFromContainer(contentContainer, chatName) {
		if (!contentContainer) {
			return "";
		}

		var message = "";
		var children = Array.from(contentContainer.children || []);
		if (children.length > 1) {
			var parts = [];
			for (var i = 1; i < children.length; i++) {
				var sectionText = getAllContentNodes(children[i]).trim();
				if (sectionText) {
					parts.push(sectionText);
				}
			}
			message = parts.join(" ").trim();
		}

		if (!message) {
			var strongs = contentContainer.querySelectorAll("strong");
			if (strongs.length > 1) {
				message = getAllContentNodes(strongs[strongs.length - 1]).trim();
			} else if (strongs.length === 1) {
				var singleStrongText = (strongs[0].textContent || "").trim();
				if (!chatName || singleStrongText !== chatName) {
					message = getAllContentNodes(strongs[0]).trim();
				}
			}
		}

		return message;
	}

	function isUserImageUrl(url) {
		return /\/users(?:%2F|\/)/i.test(url || "");
	}

	function getAvatarFromMessage(messageElement) {
		var images = Array.from(messageElement.querySelectorAll("img[src], img[srcset]"));
		if (!images.length) {
			return "";
		}

		var selected = "";
		for (var i = 0; i < images.length; i++) {
			var candidate = getImageUrl(images[i]);
			if (!candidate) {
				continue;
			}
			if (isUserImageUrl(candidate)) {
				return candidate;
			}
			if (!selected) {
				selected = candidate;
			}
		}
		return selected;
	}

	function getBadgesFromMessage(contentContainer, chatimg) {
		var badges = [];
		try {
			var badgeContainer = contentContainer && contentContainer.firstElementChild ? contentContainer.firstElementChild : null;
			if (!badgeContainer) {
				return badges;
			}
			var badgeImages = badgeContainer.querySelectorAll("img[src], img[srcset]");
			badgeImages.forEach(function (image) {
				var src = getImageUrl(image);
				if (!src) {
					return;
				}
				if (chatimg && src === chatimg) {
					return;
				}
				if (isUserImageUrl(src)) {
					return;
				}
				if (!badges.includes(src)) {
					badges.push(src);
				}
			});
		} catch (e) {}
		return badges;
	}

	function parseViewerCount(value) {
		if (!value && value !== 0) {
			return null;
		}
		var raw = String(value).replace(/,/g, "").trim().toUpperCase();
		if (!raw) {
			return null;
		}

		var multiplier = 1;
		if (raw.endsWith("K")) {
			multiplier = 1000;
			raw = raw.slice(0, -1);
		} else if (raw.endsWith("M")) {
			multiplier = 1000000;
			raw = raw.slice(0, -1);
		} else if (raw.endsWith("B")) {
			multiplier = 1000000000;
			raw = raw.slice(0, -1);
		}

		raw = raw.replace(/[^\d.]/g, "");
		if (!raw) {
			return null;
		}

		var parsed = parseFloat(raw);
		if (!Number.isFinite(parsed)) {
			return null;
		}
		return Math.round(parsed * multiplier);
	}

	function getViewerCountFromDom() {
		var candidates = document.querySelectorAll("header strong.tabular-nums, section strong.tabular-nums, strong.tabular-nums");
		for (var i = 0; i < candidates.length; i++) {
			var parsed = parseViewerCount(candidates[i].textContent);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
		return null;
	}

	function sendViewerCount(count) {
		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				({
					message: {
						type: "whatnot",
						event: "viewer_update",
						meta: count
					}
				}),
				function () {}
			);
		} catch (e) {}
	}

	function checkViewers(forceUpdate) {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}
		if (hasRecentWebSocketViewer()) {
			return;
		}

		var count = getViewerCountFromDom();
		if (count === null) {
			count = 0;
		}

		if (forceUpdate || lastViewerCount !== count) {
			lastViewerCount = count;
			sendViewerCount(count);
		}
	}

	function normalizeText(value) {
		return (value || "").replace(/\s+/g, " ").trim();
	}

	function parseHeadingCount(textValue) {
		var match = normalizeText(textValue).match(/\(([\d,]+)\)/);
		if (!match || !match[1]) {
			return null;
		}
		var parsed = parseInt(match[1].replace(/,/g, ""), 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function parseIntegerValue(textValue) {
		var match = normalizeText(textValue).replace(/,/g, "").match(/-?\d+/);
		if (!match || !match[0]) {
			return null;
		}
		var parsed = parseInt(match[0], 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function parseCurrencyValue(textValue) {
		var match = normalizeText(textValue).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
		if (!match || !match[0]) {
			return null;
		}
		var parsed = parseFloat(match[0]);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function parseAuctionSnapshot() {
		var footer = document.querySelector("footer.LivePlayer_livePlayerFooter__UDpaa");
		if (!footer) {
			return null;
		}

		var meta = {};
		var statusNode = footer.querySelector("[data-testid='show-winning-status']");
		var statusText = normalizeText(statusNode ? statusNode.textContent : "");
		if (statusText) {
			meta.statusText = statusText;
		}

		var winnerMatch = statusText.match(/^(.+?)\s+(?:is\s+)?(Winning!?|won!?)(?:\s*|$)/i);
		if (winnerMatch && winnerMatch[1]) {
			meta.bidder = normalizeText(winnerMatch[1]);
		}
		if (winnerMatch && winnerMatch[2]) {
			var statusValue = winnerMatch[2].toLowerCase();
			if (statusValue.indexOf("winning") > -1) {
				meta.status = "winning";
			} else if (statusValue.indexOf("won") > -1) {
				meta.status = "won";
			}
		}

		var titleNode = footer.querySelector("[data-testid='show-product-title']");
		var titleText = normalizeText(titleNode ? titleNode.textContent : "");
		if (titleText) {
			meta.title = titleText;
		}

		var categoryNode = titleNode && titleNode.parentElement ? titleNode.parentElement.querySelector("button strong") : null;
		var categoryText = normalizeText(categoryNode ? categoryNode.textContent : "");
		if (categoryText) {
			meta.category = categoryText;
		}

		var shippingNode = footer.querySelector("[data-testid='show-shipping-info'] strong");
		var shippingText = normalizeText(shippingNode ? shippingNode.textContent : "");
		if (shippingText) {
			meta.shipping = shippingText;
		}

		var strongNodes = footer.querySelectorAll("strong");
		for (var i = 0; i < strongNodes.length; i++) {
			var value = normalizeText(strongNodes[i].textContent);
			if (!value) {
				continue;
			}
			if (!meta.bidsText && /\b[\d,]+\s+Bids?\b/i.test(value)) {
				meta.bidsText = value;
				meta.bids = parseIntegerValue(value);
			}
			if (!meta.priceText && /\$\s*[\d,.]+/.test(value)) {
				meta.priceText = value;
				meta.price = parseCurrencyValue(value);
			}
			if (!meta.status && /^sold$/i.test(value)) {
				meta.status = "sold";
				meta.statusText = value;
			}
		}

		var timerNode = footer.querySelector("[data-testid='show-timer']");
		var timerText = normalizeText(timerNode ? timerNode.textContent : "");
		if (!timerText) {
			var timerMatch = normalizeText(footer.textContent).match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/);
			timerText = timerMatch && timerMatch[0] ? timerMatch[0] : "";
		}
		if (timerText) {
			meta.timer = timerText;
		}

		if (!meta.status) {
			if (/winning/i.test(statusText)) {
				meta.status = "winning";
			} else if (/won/i.test(statusText)) {
				meta.status = "won";
			}
		}

		if (!Object.keys(meta).length) {
			return null;
		}
		return meta;
	}

	function findSectionByHeading(pattern) {
		var headings = document.querySelectorAll("header strong");
		for (var i = 0; i < headings.length; i++) {
			var text = normalizeText(headings[i].textContent);
			if (!text || !pattern.test(text)) {
				continue;
			}
			var section = headings[i].closest("section");
			if (section) {
				return section;
			}
		}
		return null;
	}

	function parseCatalogCard(cardElement) {
		if (!cardElement) {
			return null;
		}

		var titleNode = cardElement.querySelector("strong[title]");
		var titleText = normalizeText(titleNode ? titleNode.textContent : "");
		if (!titleText) {
			return null;
		}

		var item = {
			title: titleText
		};

		var imageNode = cardElement.querySelector("img[src], img[srcset]");
		var image = getImageUrl(imageNode);
		if (image) {
			item.image = image;
		}

		var listingId = normalizeText(imageNode ? imageNode.getAttribute("alt") : "");
		if (listingId) {
			item.listingId = listingId;
		}

		var strongNodes = cardElement.querySelectorAll("strong");
		for (var i = 0; i < strongNodes.length; i++) {
			var node = strongNodes[i];
			var value = normalizeText(node.textContent);
			if (!value) {
				continue;
			}
			if (!item.priceText && /\$\s*[\d,.]+/.test(value) && !/line-through/i.test(node.className || "")) {
				item.priceText = value;
				item.price = parseCurrencyValue(value);
			}
			if (!item.bidsText && /\b[\d,]+\s+bids?\b/i.test(value)) {
				item.bidsText = value;
				item.bids = parseIntegerValue(value);
			}
			if (!item.quantityText && /^Qty\.\s*[\d,]+$/i.test(value)) {
				item.quantityText = value;
				item.quantity = parseIntegerValue(value);
			}
		}

		var buttonNodes = cardElement.querySelectorAll("button");
		for (var j = buttonNodes.length - 1; j >= 0; j--) {
			var buttonText = normalizeText(buttonNodes[j].textContent);
			if (!buttonText || buttonText === "Bookmark this show") {
				continue;
			}
			item.action = buttonText;
			break;
		}

		if (typeof item.quantity === "number") {
			item.availability = item.quantity;
		}

		if (!item.priceText && !item.bidsText && !item.quantityText && !item.action) {
			return null;
		}

		return item;
	}

	function collectCatalogCards(scopeElement, collection, seenKeys) {
		if (!scopeElement) {
			return;
		}
		var cards = scopeElement.querySelectorAll("div[class*='@container/card'] section, section.relative.z-base");
		for (var i = 0; i < cards.length; i++) {
			var parsed = parseCatalogCard(cards[i]);
			if (!parsed) {
				continue;
			}
			var key = [
				parsed.title || "",
				parsed.priceText || "",
				parsed.bidsText || "",
				parsed.quantityText || "",
				parsed.action || ""
			].join("|");
			if (seenKeys.indexOf(key) > -1) {
				continue;
			}
			seenKeys.push(key);
			collection.push(parsed);
		}
	}

	function parseProductsSnapshot() {
		var section = findSectionByHeading(/^Products\s*\(/i);
		if (!section) {
			return null;
		}

		var headingNode = section.querySelector("header strong");
		var summary = {
			total: parseHeadingCount(headingNode ? headingNode.textContent : "")
		};

		var items = [];
		var seen = [];
		var sibling = section.nextElementSibling;
		while (sibling) {
			var siblingHeading = sibling.querySelector("header strong");
			if (siblingHeading) {
				var siblingHeadingText = normalizeText(siblingHeading.textContent);
				if (/^Upcoming Giveaways\s*\(/i.test(siblingHeadingText) || /^Surprise Sets\s*\(/i.test(siblingHeadingText)) {
					break;
				}
			}

			collectCatalogCards(sibling, items, seen);
			sibling = sibling.nextElementSibling;
		}

		summary.items = items;
		return summary;
	}

	function parseSurpriseSetsSnapshot() {
		var section = findSectionByHeading(/^Surprise Sets\s*\(/i);
		if (!section) {
			return null;
		}

		var headingNode = section.querySelector("header strong");
		var summary = {
			total: parseHeadingCount(headingNode ? headingNode.textContent : "")
		};

		var cards = section.querySelectorAll("div[class*='@container/card'] section");
		var items = [];
		for (var i = 0; i < cards.length; i++) {
			var titleNode = cards[i].querySelector("strong[title]");
			var titleText = normalizeText(titleNode ? titleNode.textContent : "");
			if (!titleText) {
				continue;
			}

			var item = { title: titleText };
			var progressNode = cards[i].querySelector("[role='progressbar']");
			if (progressNode) {
				var percent = parseIntegerValue(progressNode.getAttribute("aria-valuenow") || "");
				if (percent !== null) {
					item.progress = percent;
				}
			}

			var statusNodes = cards[i].querySelectorAll("strong");
			for (var j = 0; j < statusNodes.length; j++) {
				var value = normalizeText(statusNodes[j].textContent);
				if (!value) {
					continue;
				}
				if (!item.statusText && /Surprise Set/i.test(value)) {
					item.statusText = value;
				}
				if (!item.remainingText && /\b[\d,]+\s+of\s+[\d,]+\s+left\b/i.test(value)) {
					item.remainingText = value;
					var remainingMatch = value.match(/([\d,]+)\s+of\s+([\d,]+)\s+left/i);
					if (remainingMatch && remainingMatch[1]) {
						item.remaining = parseInt(remainingMatch[1].replace(/,/g, ""), 10);
					}
					if (remainingMatch && remainingMatch[2]) {
						item.totalSpots = parseInt(remainingMatch[2].replace(/,/g, ""), 10);
					}
				}
			}
			items.push(item);
		}

		summary.items = items;
		return summary;
	}

	function parseUpcomingGiveawaysSnapshot() {
		var section = findSectionByHeading(/^Upcoming Giveaways\s*\(/i);
		if (!section) {
			return null;
		}

		var headingNode = section.querySelector("header strong");
		var summary = {
			total: parseHeadingCount(headingNode ? headingNode.textContent : "")
		};

		var items = [];
		var seen = [];
		collectCatalogCards(section, items, seen);

		for (var i = 0; i < items.length; i++) {
			delete items[i].priceText;
			delete items[i].price;
			delete items[i].bidsText;
			delete items[i].bids;
		}

		summary.items = items;
		return summary;
	}

	function createCommerceSnapshot() {
		var snapshot = {};
		var products = parseProductsSnapshot();
		var surpriseSets = parseSurpriseSetsSnapshot();
		var upcomingGiveaways = parseUpcomingGiveawaysSnapshot();

		if (products) {
			snapshot.products = products;
		}
		if (surpriseSets) {
			snapshot.surpriseSets = surpriseSets;
		}
		if (upcomingGiveaways) {
			snapshot.upcomingGiveaways = upcomingGiveaways;
		}

		if (!Object.keys(snapshot).length) {
			return null;
		}

		return snapshot;
	}

	function hasRecentWebSocketChat() {
		return lastWebSocketChatAt && (Date.now() - lastWebSocketChatAt < webSocketActivityWindowMs);
	}

	function hasRecentWebSocketViewer() {
		return lastWebSocketViewerAt && (Date.now() - lastWebSocketViewerAt < webSocketActivityWindowMs);
	}

	function rememberRecentWebSocketId(collection, lookup, itemId, maxSize) {
		if (!itemId) {
			return false;
		}
		if (lookup[itemId]) {
			return true;
		}
		collection.push(itemId);
		lookup[itemId] = true;
		if (collection.length > maxSize) {
			var removedId = collection.shift();
			if (removedId) {
				delete lookup[removedId];
			}
		}
		return false;
	}

	function rememberWebSocketMessageId(messageId) {
		return rememberRecentWebSocketId(recentWebSocketMessageIds, recentWebSocketMessageLookup, messageId, 250);
	}

	function rememberWebSocketActivityId(activityId) {
		return rememberRecentWebSocketId(recentWebSocketActivityIds, recentWebSocketActivityLookup, activityId, 500);
	}

	function normalizeWebSocketData(data) {
		try {
			if (typeof data === "string") {
				return data;
			}
			if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
				return new TextDecoder().decode(new Uint8Array(data));
			}
			if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(data)) {
				return new TextDecoder().decode(data);
			}
		} catch (e) {}
		return String(data || "");
	}

	function formatWebSocketMessageText(value) {
		var text = value == null ? "" : String(value);
		return settings.textonlymode ? text : escapeHtml(text);
	}

	function getMoneyDetails(value, magnitude) {
		var amount = null;
		var currency = "";
		if (typeof value === "number") {
			amount = value;
		} else if (value && typeof value === "object") {
			if (typeof value.amount === "number") {
				amount = value.amount;
			}
			currency = value.currency || value.currencyCode || "";
		}
		if (!Number.isFinite(amount)) {
			return null;
		}
		return {
			amount: amount * (Number.isFinite(magnitude) ? magnitude : 0.01),
			currency: currency
		};
	}

	function formatMoneyValue(value, magnitude) {
		var money = getMoneyDetails(value, magnitude);
		if (!money) {
			return "";
		}
		if (money.currency) {
			try {
				return new Intl.NumberFormat(undefined, {
					style: "currency",
					currency: money.currency
				}).format(money.amount) + " " + money.currency;
			} catch (e) {
				return money.amount.toFixed(2) + " " + money.currency;
			}
		}
		return String(money.amount);
	}

	function getShopStateTotalCount(shopState) {
		if (!shopState || typeof shopState !== "object") {
			return "";
		}
		if (typeof shopState.totalCount !== "undefined") {
			return shopState.totalCount;
		}
		if (typeof shopState.total_count !== "undefined") {
			return shopState.total_count;
		}
		return "";
	}

	function buildWebSocketMeta(wsChannel, eventType, payload, user) {
		var meta = {
			transport: "websocket",
			websocketEvent: eventType
		};
		var topic = payload && payload.topic ? payload.topic : wsChannel;
		if (topic) {
			meta.topic = topic;
		}
		if (payload && payload.id) {
			meta.messageId = payload.id;
		}
		if (payload && payload.type) {
			meta.messageType = payload.type;
		}
		if (payload && payload.eventName) {
			meta.activityEvent = payload.eventName;
		}
		if (payload && typeof payload.timestamp === "number") {
			meta.timestamp = payload.timestamp;
		}
		if (payload && payload.livestreamId) {
			meta.livestreamId = payload.livestreamId;
		}
		if (payload && Array.isArray(payload.taggedUsers) && payload.taggedUsers.length) {
			meta.taggedUsers = payload.taggedUsers.map(function (taggedUser) {
				return {
					id: taggedUser && taggedUser.id ? taggedUser.id : "",
					username: taggedUser && taggedUser.username ? taggedUser.username : ""
				};
			});
		}
		if (user && typeof user.daysSinceCreated === "number") {
			meta.daysSinceCreated = user.daysSinceCreated;
		}
		if (user && user.username) {
			meta.profile = "/user/" + encodeURIComponent(user.username);
		}
		if (user && user.isHost) {
			meta.host = true;
		}
		if (user && user.isCohost) {
			meta.cohost = true;
		}
		if (user && user.isTopBuyer) {
			meta.topBuyer = true;
		}
		if (user && user.isNewUser) {
			meta.newUser = true;
		}
		if (user && user.isBooster) {
			meta.booster = true;
		}
		return meta;
	}

	function createWebSocketChatData(user, messageText) {
		var data = {};
		data.chatname = escapeHtml(user && user.username ? user.username : "");
		data.chatbadges = [];
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = formatWebSocketMessageText(messageText);
		data.chatimg = user && user.profileImage && user.profileImage.url ? user.profileImage.url : "";
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.type = "whatnot";
		if (user && user.id) {
			data.userid = user.id;
		}
		if (user && user.loyaltyVisibilityStatusEnabled && user.loyaltyTierForSeller && user.loyaltyTierForSeller !== "NO_TIER") {
			data.membership = user.loyaltyTierForSeller;
		}
		if (user && user.isNominatedModerator) {
			data.moderator = true;
		}
		if (user && (user.isModerator || user.isEmployee)) {
			data.admin = true;
		}
		return data;
	}

	function sendWebSocketViewerCount(count) {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}
		var parsed = parseInt(count, 10);
		if (!Number.isFinite(parsed)) {
			return;
		}
		lastWebSocketViewerAt = Date.now();
		if (lastViewerCount !== parsed) {
			lastViewerCount = parsed;
			sendViewerCount(parsed);
		}
	}

	function scheduleWebSocketSnapshotRefresh() {
		if (webSocketSnapshotRefreshTimer) {
			clearTimeout(webSocketSnapshotRefreshTimer);
		}
		webSocketSnapshotRefreshTimer = setTimeout(function () {
			webSocketSnapshotRefreshTimer = null;
			checkAuctionUpdates();
			checkCommerceUpdates();
		}, 200);
	}

	function handleWebSocketLivestreamUpdate(payload) {
		if (!payload || typeof payload !== "object") {
			return;
		}
		if (typeof payload.activeViewers !== "undefined") {
			sendWebSocketViewerCount(payload.activeViewers);
		}
		var snapshotKey = JSON.stringify({
			status: payload.status || "",
			title: payload.title || "",
			pinnedProductId: payload.pinnedProductId || "",
			activeGiveawayLiveProductId: payload.activeGiveawayLiveProductId || "",
			totalCount: getShopStateTotalCount(payload.shopState),
			shareCounts: typeof payload.shareCounts === "number" ? payload.shareCounts : ""
		});
		if (!snapshotKey || snapshotKey === lastWebSocketLivestreamState) {
			return;
		}
		lastWebSocketLivestreamState = snapshotKey;
		scheduleWebSocketSnapshotRefresh();
	}

	function handleWebSocketGiveawayEntryUpdate(payload) {
		if (!payload || typeof payload !== "object") {
			return;
		}
		var snapshotKey = JSON.stringify({
			productId: payload.productId || "",
			entryCount: typeof payload.entryCount === "number" ? payload.entryCount : payload.entryCount || ""
		});
		if (!snapshotKey || snapshotKey === lastWebSocketGiveawayState) {
			return;
		}
		lastWebSocketGiveawayState = snapshotKey;
		scheduleWebSocketSnapshotRefresh();
	}

	function createWebSocketActivityId(activity) {
		var user = activity && activity.activityPerformingUser ? activity.activityPerformingUser : null;
		var livestreamProduct = activity && activity.eventSpecificInfo && activity.eventSpecificInfo.livestreamProduct
			? activity.eventSpecificInfo.livestreamProduct
			: null;
		return [
			activity && activity.eventName ? activity.eventName : "",
			activity && typeof activity.timestamp === "number" ? activity.timestamp : "",
			activity && activity.livestreamId ? activity.livestreamId : "",
			user && user.id ? user.id : "",
			livestreamProduct && livestreamProduct.id ? livestreamProduct.id : ""
		].join("|");
	}

	function handleWebSocketSnapshotPayload(payload) {
		if (!payload || typeof payload !== "object") {
			return;
		}
		if (payload.livestream && typeof payload.livestream === "object") {
			handleWebSocketLivestreamUpdate(payload.livestream);
		}
		scheduleWebSocketSnapshotRefresh();
	}

	function handleWebSocketBoostContribution(activity, wsChannel) {
		if (!activity || typeof activity !== "object") {
			return;
		}
		var info = activity.eventSpecificInfo || {};
		var user = activity.activityPerformingUser || {};
		var messageText = info.contributionMessage || "Community boost";
		var data = createWebSocketChatData(user, messageText);
		var money = getMoneyDetails(info.contributionMoney);
		data.event = "donation";
		data.hasDonation = formatMoneyValue(info.contributionMoney);
		if (money) {
			data.donoValue = money.amount;
		}
		var meta = buildWebSocketMeta(wsChannel, activity.eventName || "COMMUNITY_BOOST_CONTRIBUTION_PURCHASED", activity, user);
		meta.boost = true;
		if (info.contributionMessage) {
			meta.contributionMessage = info.contributionMessage;
		}
		if (money && money.currency) {
			meta.currency = money.currency;
		}
		data.meta = meta;
		if (settings.captureevents === false) {
			return;
		}
		pushMessage(data);
	}

	function handleWebSocketActivityEvent(activity, wsChannel) {
		if (!activity || typeof activity !== "object" || !activity.eventName) {
			return false;
		}
		var activityId = createWebSocketActivityId(activity);
		if (rememberWebSocketActivityId(activityId)) {
			return false;
		}

		switch (activity.eventName) {
			case "STREAM_HAS_BEEN_RAIDED":
				handleWebSocketRaidEvent(activity, wsChannel, activity.eventName);
				break;
			case "COMMUNITY_BOOST_CONTRIBUTION_PURCHASED":
				handleWebSocketBoostContribution(activity, wsChannel);
				break;
		}
		return true;
	}

	function handleWebSocketPhxReply(payload, wsChannel) {
		if (!payload || typeof payload !== "object" || payload.status !== "ok") {
			return;
		}
		var response = payload.response;
		if (!response || typeof response !== "object") {
			return;
		}
		if (response.livestream && typeof response.livestream === "object") {
			handleWebSocketLivestreamUpdate(response.livestream);
		}
		if (!Array.isArray(response.latestLiveActivityEvents) || !response.latestLiveActivityEvents.length) {
			return;
		}
		var shouldRefreshSnapshots = false;
		for (var i = 0; i < response.latestLiveActivityEvents.length; i++) {
			if (handleWebSocketActivityEvent(response.latestLiveActivityEvents[i], wsChannel)) {
				shouldRefreshSnapshots = true;
			}
		}
		if (shouldRefreshSnapshots) {
			scheduleWebSocketSnapshotRefresh();
		}
	}

	function handleWebSocketChatMessage(payload, wsChannel) {
		if (!payload || typeof payload !== "object") {
			return;
		}
		if (rememberWebSocketMessageId(payload.id || "")) {
			return;
		}
		var user = payload.user || {};
		var messageText = payload.message == null ? "" : String(payload.message);
		if (!user.username && !messageText) {
			return;
		}
		lastWebSocketChatAt = Date.now();
		var data = createWebSocketChatData(user, messageText);
		var normalizedMessage = normalizeText(messageText);
		data.event = /^joined\b/i.test(normalizedMessage) ? "joined" : false;
		if (!data.event && messageText.indexOf("?") > -1) {
			data.question = true;
		}
		if (payload.properties && payload.properties.adscb) {
			data.hasDonation = formatMoneyValue(payload.properties.adscb);
		}
		var meta = buildWebSocketMeta(wsChannel, "new_msg", payload, user);
		if (payload.type === "announcement") {
			meta.announcement = true;
		}
		if (payload.properties && Object.keys(payload.properties).length) {
			meta.properties = payload.properties;
		}
		data.meta = meta;
		if (data.event && settings.captureevents === false) {
			return;
		}
		pushMessage(data);
	}

	function handleWebSocketTipSent(payload, wsChannel) {
		var tip = payload && payload.tip ? payload.tip : null;
		if (!tip) {
			return;
		}
		var user = tip.senderUser || {};
		var data = createWebSocketChatData(user, tip.message || "");
		data.event = "donation";
		data.hasDonation = formatMoneyValue(tip.tipValue, tip.magnitude);
		var money = getMoneyDetails(tip.tipValue, tip.magnitude);
		if (money) {
			data.donoValue = money.amount;
		}
		data.meta = buildWebSocketMeta(wsChannel, "tip_sent", payload, user);
		if (settings.captureevents === false) {
			return;
		}
		pushMessage(data);
	}

	function handleWebSocketLoyaltyLevelUp(payload, wsChannel) {
		var user = payload && payload.user ? payload.user : null;
		if (!user || !user.username) {
			return;
		}
		var tier = user.loyaltyTierForSeller || "";
		var data = createWebSocketChatData(user, "leveled up to " + tier + " loyalty");
		data.event = "member";
		data.membership = tier;
		data.meta = buildWebSocketMeta(wsChannel, "user_loyalty_tier_level_up", payload, user);
		if (settings.captureevents === false) {
			return;
		}
		pushMessage(data);
	}

	function handleWebSocketRaidEvent(payload, wsChannel, eventType) {
		var user = payload && payload.fromUser ? payload.fromUser : (payload && payload.activityPerformingUser ? payload.activityPerformingUser : null);
		if (!user || !user.username) {
			return;
		}
		var numRaiders = payload && payload.eventSpecificInfo && typeof payload.eventSpecificInfo.numRaiders === "number"
			? payload.eventSpecificInfo.numRaiders
			: (payload && typeof payload.numRaiders === "number" ? payload.numRaiders
			: (payload && typeof payload.numUsers === "number" ? payload.numUsers : 0));
		var messageText = (eventType === "has_been_raided" || eventType === "STREAM_HAS_BEEN_RAIDED")
			? "is raiding with a party of " + numRaiders
			: (eventType === "raid_started" ? "is raiding with " + numRaiders + " viewers" : "has started a raid");
		var data = createWebSocketChatData(user, messageText);
		data.event = "raid";
		var meta = buildWebSocketMeta(wsChannel, eventType, payload, user);
		if (typeof numRaiders === "number") {
			meta.numRaiders = numRaiders;
		}
		data.meta = meta;
		if (settings.captureevents === false) {
			return;
		}
		pushMessage(data);
	}

	function handleWhatnotWebSocketFrame(rawData) {
		var payloadText = normalizeWebSocketData(rawData);
		if (!payloadText) {
			return;
		}
		var parsedArray = null;
		try {
			parsedArray = JSON.parse(payloadText);
		} catch (e) {
			return;
		}
		if (!Array.isArray(parsedArray) || parsedArray.length < 5) {
			return;
		}
		var wsChannel = parsedArray[2] || "";
		var eventType = parsedArray[3] || "";
		var payload = parsedArray[4] || {};

		switch (eventType) {
			case "new_msg":
				handleWebSocketChatMessage(payload, wsChannel);
				return;
			case "tip_sent":
				handleWebSocketTipSent(payload, wsChannel);
				return;
			case "raid_selected":
			case "has_been_raided":
			case "raid_started":
				handleWebSocketRaidEvent(payload, wsChannel, eventType);
				return;
			case "user_loyalty_tier_level_up":
				handleWebSocketLoyaltyLevelUp(payload, wsChannel);
				return;
			case "livestream_view_count_updated":
				sendWebSocketViewerCount(payload && payload.viewCount);
				return;
			case "livestream_update":
				handleWebSocketLivestreamUpdate(payload);
				return;
			case "giveaway_entry_count_updated":
				handleWebSocketGiveawayEntryUpdate(payload);
				return;
			case "product_created":
			case "product_updated":
			case "product_deleted":
			case "giveaway_started":
			case "giveaway_won":
			case "payment_failed":
			case "user_joined":
				handleWebSocketSnapshotPayload(payload);
				return;
			case "phx_reply":
				handleWebSocketPhxReply(payload, wsChannel);
				return;
		}
	}

	function handleWhatnotWindowMessage(event) {
		if (!event || event.source !== window || !event.data || event.data.source !== "whatnot-ws-interceptor") {
			return;
		}
		if (event.data.type !== "receive") {
			return;
		}
		handleWhatnotWebSocketFrame(event.data.data);
	}

	function registerElectronWebSocketListener() {
		try {
			if (!window.ninjafy || !window.ninjafy.onWebSocketMessage) {
				return;
			}
			window.ninjafy.onWebSocketMessage(function (payload) {
				if (!payload || payload.type !== "message") {
					return;
				}
				handleWhatnotWebSocketFrame(payload.data);
			});
		} catch (e) {}
	}

	function sendMetaEvent(eventName, meta) {
		if (!eventName || !meta) {
			return;
		}
		pushMessage({
			type: "whatnot",
			event: eventName,
			meta: meta
		});
	}

	function checkAuctionUpdates() {
		if (!isExtensionOn || settings.captureevents === false) {
			return;
		}
		var snapshot = parseAuctionSnapshot();
		if (!snapshot) {
			return;
		}
		var serialized = JSON.stringify(snapshot);
		if (serialized === lastAuctionSnapshot) {
			return;
		}
		lastAuctionSnapshot = serialized;
		sendMetaEvent("auction_update", snapshot);
	}

	function checkCommerceUpdates() {
		if (!isExtensionOn || settings.captureevents === false) {
			return;
		}
		var snapshot = createCommerceSnapshot();
		if (!snapshot) {
			return;
		}
		var serialized = JSON.stringify(snapshot);
		if (serialized === lastCommerceSnapshot) {
			return;
		}
		lastCommerceSnapshot = serialized;
		sendMetaEvent("commerce_update", snapshot);
	}

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
		} catch (e) {}
	}

	function processMessage(messageElement) {
		if (hasRecentWebSocketChat() || !messageElement || processedMessageNodes.has(messageElement)) {
			return;
		}

		processedMessageNodes.add(messageElement);

		var messageIndex = getMessageIndex(messageElement);
		if (messageIndex !== null) {
			if (messageIndex <= lastDataIndex) {
				return;
			}
			lastDataIndex = messageIndex;
		}

		var contentContainer = getMessageContentContainer(messageElement);
		var chatNameRaw = getNameFromMessage(messageElement, contentContainer);
		var messageBody = getMessageBodyFromContainer(contentContainer, chatNameRaw);
		var chatimg = getAvatarFromMessage(messageElement);
		var chatbadges = getBadgesFromMessage(contentContainer, chatimg);

		if (!chatNameRaw && !messageBody) {
			return;
		}

		var data = {};
		data.chatname = escapeHtml(chatNameRaw);
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = messageBody;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.type = "whatnot";

		var normalizedMessage = (messageBody || "").replace(/\s+/g, " ").trim();
		data.event = /^joined\b/i.test(normalizedMessage) ? "joined" : false;

		if (data.event && settings.captureevents === false) {
			return;
		}

		var meta = {};
		if (messageIndex !== null) {
			meta.index = messageIndex;
		}
		var profileLink = messageElement.querySelector("a[href*='/user/']");
		if (profileLink) {
			meta.profile = profileLink.getAttribute("href") || "";
		}
		if (messageElement.querySelector(".text-system-orange-opaque-darker")) {
			meta.highlighted = true;
		}
		if (Object.keys(meta).length) {
			data.meta = meta;
		}

		pushMessage(data);
	}

	function collectMessageNodes(node) {
		var matches = [];
		if (!node || node.nodeType !== 1) {
			return matches;
		}
		if (node.matches && node.matches("[data-testid='chat-message']")) {
			matches.push(node);
		}
		if (node.querySelectorAll) {
			node.querySelectorAll("[data-testid='chat-message']").forEach(function (found) {
				matches.push(found);
			});
		}
		return matches;
	}

	function onMutationsObserved(mutations) {
		mutations.forEach(function (mutation) {
			if (!mutation.addedNodes || !mutation.addedNodes.length) {
				return;
			}
			for (var i = 0; i < mutation.addedNodes.length; i++) {
				var addedNode = mutation.addedNodes[i];
				var messageNodes = collectMessageNodes(addedNode);
				for (var j = 0; j < messageNodes.length; j++) {
					processMessage(messageNodes[j]);
				}
			}
		});
	}

	function observeChatList(listElement) {
		if (!listElement) {
			return;
		}

		if (observer) {
			observer.disconnect();
			observer = null;
		}

		observedList = listElement;
		processedMessageNodes = new WeakSet();
		lastDataIndex = -1;

		var mutationConfig = { childList: true, subtree: true };
		var MutationObserverImpl = window.MutationObserver || window.WebKitMutationObserver;
		observer = new MutationObserverImpl(onMutationsObserved);
		observer.observe(listElement, mutationConfig);

		var existing = listElement.querySelectorAll("[data-testid='chat-message']");
		var maxExistingIndex = -1;
		for (var i = 0; i < existing.length; i++) {
			processedMessageNodes.add(existing[i]);
			var existingIndex = getMessageIndex(existing[i]);
			if (existingIndex !== null && existingIndex > maxExistingIndex) {
				maxExistingIndex = existingIndex;
			}
		}
		if (maxExistingIndex > -1) {
			lastDataIndex = maxExistingIndex;
		}
	}

	function watchForChatList() {
		var listElement = document.querySelector("[data-testid='virtuoso-item-list']");
		if (!listElement) {
			var fallbackMessage = document.querySelector("[data-testid='chat-message']");
			if (fallbackMessage && fallbackMessage.parentElement) {
				listElement = fallbackMessage.parentElement;
			}
		}
		if (!listElement || listElement === observedList) {
			return;
		}
		observeChatList(listElement);
		checkViewers(true);
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
			checkViewers(true);
			checkAuctionUpdates();
			checkCommerceUpdates();
		});

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if (request === "getSource") {
				sendResponse("whatnot");
				return;
			}

			if (request === "focusChat") {
				var input = document.querySelector("[data-testid='chat-input'], .chatInput, textarea");
				if (input) {
					input.focus();
					sendResponse(true);
					return;
				}
			}

			if (typeof request === "object" && request) {
					if ("settings" in request) {
						settings = request.settings || {};
						checkViewers(true);
						checkAuctionUpdates();
						checkCommerceUpdates();
						sendResponse(true);
						return;
					}
					if ("state" in request) {
						isExtensionOn = request.state;
						checkViewers(true);
						checkAuctionUpdates();
						checkCommerceUpdates();
						sendResponse(true);
						return;
					}
			}
		} catch (e) {}

		sendResponse(false);
	});

	window.addEventListener("message", handleWhatnotWindowMessage);
	registerElectronWebSocketListener();

	console.log("social stream injected");

	watchForChatList();
	checkAuctionUpdates();
	checkCommerceUpdates();
	setInterval(watchForChatList, 1500);
	setInterval(checkAuctionUpdates, 1200);
	setInterval(checkCommerceUpdates, 5000);
	setInterval(function () {
		checkViewers(false);
	}, 15000);
})();
