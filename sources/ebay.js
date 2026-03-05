(function () {
	 
	 
	var checking = false;
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

		var reader = new FileReader();
		
		
		reader.onloadend = function() {
		  callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	  };
	  xhr.open('GET', url);
	  xhr.responseType = 'blob';
	  xhr.send();
	}

	function escapeHtml(unsafe){ // when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent)+" ";
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	var dataIndex = -5;
	
	var channelName = "";
	
	function processMessage(ele){
	//	console.log(ele);
		if (!ele || !ele.isConnected){
		//	console.log("no connected");
			return;
		}
		
		if (ele.dataset.knownSize){
			if (!parseInt(ele.dataset.knownSize)){
		//		console.log("no knownSize");
				return;
			}
		}
		
		if (ele.skip){
			return;
		}

		
		var chatimg = ""

		try {
			chatimg = ele.querySelector("img.aspect-square[src]").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".user-name, [class*='_username_']").textContent);
		} catch(e){
		}
		
		var namecolor="";
		
		var badges=[];
		/* try {
			ele.querySelectorAll("img[class^='ChatBadge_image_'][src]").forEach(badge=>{
				badges.push(badge.src);
			});
		} catch(e){
		} */

		var msg="";
		try {
			if (ele.querySelector(".message-content")){
				msg = getAllContentNodes(ele.querySelector(".message-content")).trim();
			} else {
				msg = getAllContentNodes(ele).trim();
				msg = msg.replace(name,"").trim();
			}
		} catch(e){
			
		}
		
		
		if (!msg || !name){
	//		console.log("no name");
			return;
		}
		
		if (ele.dataset.index){
			let indexx = parseInt(ele.dataset.index);
			if (indexx>dataIndex){
				dataIndex = indexx;
			} else {
				//console.log("bad dataIndex");
				return;
			}
		}
		
		ele.skip = true;
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "ebay";
		
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	var lastViewerCount = null;
	var lastAuctionSnapshot = "";
	var lastCommerceSnapshot = "";

	function normalizeText(value) {
		return (value || "").replace(/\s+/g, " ").trim();
	}

	function parseCompactNumber(value) {
		if (value === null || typeof value === "undefined") {
			return null;
		}
		var raw = normalizeText(String(value)).replace(/,/g, "").toUpperCase();
		if (!raw) {
			return null;
		}
		var match = raw.match(/(-?\d+(?:\.\d+)?)([KMB])?/);
		if (!match || !match[1]) {
			return null;
		}
		var numeric = parseFloat(match[1]);
		if (!Number.isFinite(numeric)) {
			return null;
		}
		var suffix = match[2] || "";
		if (suffix === "K") {
			numeric *= 1000;
		} else if (suffix === "M") {
			numeric *= 1000000;
		} else if (suffix === "B") {
			numeric *= 1000000000;
		}
		return Math.round(numeric);
	}

	function parseIntegerValue(value) {
		var raw = normalizeText(value).replace(/,/g, "");
		var match = raw.match(/-?\d+/);
		if (!match || !match[0]) {
			return null;
		}
		var parsed = parseInt(match[0], 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function parseCurrencyValue(value) {
		var raw = normalizeText(value).replace(/,/g, "");
		var match = raw.match(/-?\d+(?:\.\d+)?/);
		if (!match || !match[0]) {
			return null;
		}
		var parsed = parseFloat(match[0]);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function parseWatchingCountFromText(value) {
		var raw = normalizeText(value);
		if (!raw) {
			return null;
		}
		var watchingMatch = raw.match(/([\d.,]+\s*[KMB]?)\s*(watching|viewers?)/i);
		if (watchingMatch && watchingMatch[1]) {
			return parseCompactNumber(watchingMatch[1]);
		}
		if (/^[\d.,]+\s*[KMB]?$/i.test(raw)) {
			return parseCompactNumber(raw);
		}
		return null;
	}

	function textFrom(root, selector) {
		if (!root) {
			return "";
		}
		var node = root.querySelector(selector);
		return normalizeText(node ? node.textContent : "");
	}

	function toAbsoluteUrl(value) {
		var raw = normalizeText(value);
		if (!raw) {
			return "";
		}
		try {
			return new URL(raw, window.location.origin).href;
		} catch (e) {
			return raw;
		}
	}

	function normalizePath(value) {
		var raw = normalizeText(value || "");
		if (!raw) {
			return "";
		}
		return raw.toLowerCase().replace(/\/+$/, "");
	}

	function parseEventTags(section) {
		if (!section) {
			return [];
		}
		var nodes = Array.from(section.querySelectorAll("[class*='_tags_'] li, li[class*='_tag_']"));
		var seen = {};
		var tags = [];
		for (var i = 0; i < nodes.length; i++) {
			var value = normalizeText(nodes[i].textContent);
			if (!value) {
				continue;
			}
			if (seen[value]) {
				continue;
			}
			seen[value] = true;
			tags.push(value);
		}
		return tags;
	}

	function parseSectionEvent(section, index) {
		if (!section) {
			return null;
		}

		var titleNode = section.querySelector("[data-testid='a-event-card'] h3, [class*='_title_']");
		var linkNode = section.querySelector("[data-testid='a-event-card']");
		var sellerNode = section.querySelector("[data-testid='a-seller-link']");
		var previewImage = section.querySelector("[data-testid='clickable-media-event-card'] img, [data-testid='clickable-media-event-card'] source");
		var pillNode = section.querySelector("[data-testid='event-item-pill']");
		var countNode = section.querySelector("[data-testid='event-item-pill'] [aria-label*='watching' i], [data-testid='event-item-pill'] [aria-label*='viewer' i], [data-testid='event-item-pill'] [aria-label*='viewers' i]");
		var triggerNode = section.querySelector("[data-testid='trigger']");

		var title = normalizeText(titleNode ? titleNode.textContent : "");
		if (!title && linkNode) {
			title = normalizeText(linkNode.getAttribute("aria-label") || linkNode.textContent);
		}
		if (!title) {
			return null;
		}

		var href = toAbsoluteUrl(linkNode ? linkNode.getAttribute("href") : "");
		var sellerName = textFrom(section, "[data-testid='a-seller-link'] [class*='_username_'], [data-testid='a-seller-link']");
		var sellerUrl = toAbsoluteUrl(sellerNode ? sellerNode.getAttribute("href") : "");

		var liveText = normalizeText(pillNode ? pillNode.textContent : "");
		var viewerCount = null;
		if (countNode) {
			viewerCount = parseWatchingCountFromText(countNode.getAttribute("aria-label"));
			if (viewerCount === null) {
				viewerCount = parseCompactNumber(countNode.textContent);
			}
		}
		if (viewerCount === null && liveText) {
			var liveMatch = liveText.match(/LIVE\s*[·•]?\s*([\d.,]+\s*[KMB]?)/i);
			if (liveMatch && liveMatch[1]) {
				viewerCount = parseCompactNumber(liveMatch[1]);
			}
		}

		var scheduleText = textFrom(section, "[data-testid='trigger'] [class*='_text_']");
		if (!scheduleText && triggerNode) {
			scheduleText = normalizeText(triggerNode.textContent);
		}

		var reminderLabel = normalizeText(triggerNode ? triggerNode.getAttribute("aria-label") : "");
		var tags = parseEventTags(section);
		var imageUrl = normalizeText(previewImage ? (previewImage.currentSrc || previewImage.src) : "");
		var isLive = !!(pillNode && /live/i.test(liveText || ""));

		return {
			index: index,
			title: title,
			href: href,
			sellerName: sellerName,
			sellerUrl: sellerUrl,
			isLive: isLive,
			liveText: liveText,
			viewerCount: viewerCount,
			scheduleText: scheduleText,
			reminderLabel: reminderLabel,
			tags: tags,
			image: imageUrl
		};
	}

	function parseEventSections(selector, predicate) {
		var sections = Array.from(document.querySelectorAll(selector));
		if (!sections.length) {
			return [];
		}
		var events = [];
		var seen = {};
		for (var i = 0; i < sections.length; i++) {
			var section = sections[i];
			if (typeof predicate === "function" && !predicate(section)) {
				continue;
			}
			var parsed = parseSectionEvent(section, events.length);
			if (!parsed) {
				continue;
			}
			var key = (parsed.href || "") + "|" + parsed.title;
			if (seen[key]) {
				continue;
			}
			seen[key] = true;
			parsed.index = events.length;
			events.push(parsed);
		}
		return events;
	}

	function summarizeEvents(items) {
		if (!Array.isArray(items) || !items.length) {
			return null;
		}
		var watchingTotal = 0;
		var liveCount = 0;
		for (var i = 0; i < items.length; i++) {
			var row = items[i];
			if (typeof row.viewerCount === "number" && Number.isFinite(row.viewerCount)) {
				watchingTotal += row.viewerCount;
			}
			if (row.isLive) {
				liveCount += 1;
			}
		}
		return {
			total: items.length,
			liveCount: liveCount,
			watchingTotal: watchingTotal,
			items: items
		};
	}

	function parseLivePreviewSnapshot() {
		var items = parseEventSections(
			"section",
			function (section) {
				return !!section.querySelector("[data-testid='a-event-card']") &&
					!!section.querySelector("[data-testid='event-item-pill']");
			}
		);
		if (!items.length) {
			items = parseEventSections(
				"section",
				function (section) {
					return !!section.querySelector("[data-testid='a-event-card']") &&
						!!section.querySelector("[aria-label*='watching' i], [aria-label*='viewer' i], [aria-label*='viewers' i]");
				}
			);
		}
		if (!items.length) {
			return null;
		}
		var summary = summarizeEvents(items);
		if (!summary) {
			return null;
		}
		var currentPath = normalizePath(window.location.pathname);
		var currentEvent = items.find(function (item) {
			try {
				return normalizePath(new URL(item.href, window.location.origin).pathname) === currentPath;
			} catch (e) {
				return false;
			}
		}) || items[0];
		summary.current = currentEvent || null;
		return summary;
	}

	function parseUpcomingEventsSnapshot() {
		var items = parseEventSections(
			"section",
			function (section) {
				return !!section.querySelector("[data-testid='a-event-card']") &&
					!!section.querySelector("[data-testid='trigger']") &&
					!section.querySelector("[data-testid='event-item-pill']");
			}
		);
		if (!items.length) {
			return null;
		}
		return {
			total: items.length,
			items: items
		};
	}

	function getViewerCountFromDom() {
		var labelNodes = document.querySelectorAll(
			"[class*='_viewCount_'][aria-label], [class*='viewCount_'][aria-label], [aria-label*='watching'], [aria-label*='viewers']"
		);
		for (var i = 0; i < labelNodes.length; i++) {
			var countFromLabel = parseWatchingCountFromText(labelNodes[i].getAttribute("aria-label"));
			if (countFromLabel !== null) {
				return countFromLabel;
			}
		}

		var countNode = document.querySelector(
			"[class*='_viewCount_'] [class*='_count_'], [class*='viewCount_'] [class*='count_']"
		);
		if (countNode && countNode.textContent) {
			var countFromNode = parseCompactNumber(countNode.textContent);
			if (countFromNode !== null) {
				return countFromNode;
			}
		}

		var previewSnapshot = parseLivePreviewSnapshot();
		if (previewSnapshot && previewSnapshot.current && typeof previewSnapshot.current.viewerCount === "number") {
			return previewSnapshot.current.viewerCount;
		}

		return null;
	}

	function parseNavigationSnapshot() {
		var snapshot = {};
		var previewSnapshot = parseLivePreviewSnapshot();
		var viewerCount = getViewerCountFromDom();
		if (viewerCount !== null) {
			snapshot.viewerCount = viewerCount;
		}

		var viewerText = textFrom(document, "[class*='_viewCount_'] [class*='_count_']");
		if (viewerText) {
			snapshot.viewerCountText = viewerText;
		}

		var itemsLabel = textFrom(document, "[data-testid='items-button'] [class*='_label_'], [data-testid='items-button']");
		if (itemsLabel) {
			snapshot.itemsButtonLabel = itemsLabel;
		}
		var walletLabel = textFrom(document, "[data-testid='wallet-button'] [class*='_label_'], [data-testid='wallet-button']");
		if (walletLabel) {
			snapshot.walletButtonLabel = walletLabel;
		}
		var moreLabel = textFrom(document, "[data-testid='more-button'] [class*='_label_'], [data-testid='more-button']");
		if (moreLabel) {
			snapshot.moreButtonLabel = moreLabel;
		}

		if (document.querySelector("[data-testid='items-button'] [class*='_flashBadge_']")) {
			snapshot.itemsHasAttention = true;
		}
		if (document.querySelector("[data-testid='wallet-button'] [class*='_badge_']")) {
			snapshot.walletHasBadge = true;
		}

		if (previewSnapshot) {
			snapshot.livePreviewCount = previewSnapshot.total;
			if (typeof previewSnapshot.watchingTotal === "number") {
				snapshot.livePreviewWatchingTotal = previewSnapshot.watchingTotal;
			}
			if (previewSnapshot.current) {
				snapshot.currentEventTitle = previewSnapshot.current.title;
				snapshot.currentEventSeller = previewSnapshot.current.sellerName;
			}
		}

		return Object.keys(snapshot).length ? snapshot : null;
	}

	function parsePlayerCard(card, index) {
		if (!card) {
			return null;
		}
		var item = {};
		item.index = index;
		item.title = textFrom(card, "[data-testid='player-card-title'], [class*='_title_']");
		if (!item.title) {
			return null;
		}

		item.currentPriceText = textFrom(card, "[data-testid='player-card-current-price']");
		item.currentPrice = parseCurrencyValue(item.currentPriceText);
		item.shippingPriceText = textFrom(card, "[data-testid='player-card-shipping-price']");
		item.shippingPrice = parseCurrencyValue(item.shippingPriceText);
		item.winnerIcon = textFrom(card, "[data-testid='player-card-winner-icon']");
		item.winnerName = textFrom(card, "[data-testid='player-card-winner-name']");
		item.timer = textFrom(card, "[data-testid='player-card-timer']");

		var primaryButton = card.querySelector("[data-testid='player-card-primary-cta']");
		if (primaryButton) {
			item.primaryActionText = normalizeText(primaryButton.textContent);
			item.primaryActionDisabled = !!primaryButton.disabled;
		}

		var maxBidButton = card.querySelector("[data-testid='player-card-max-bid']");
		if (maxBidButton) {
			item.maxBidText = normalizeText(maxBidButton.textContent);
			item.maxBidDisabled = !!maxBidButton.disabled;
		}

		var cardText = normalizeText(card.textContent);
		var bidsMatch = cardText.match(/([\d,]+)\s+bids?/i);
		if (bidsMatch && bidsMatch[1]) {
			item.bids = parseIntegerValue(bidsMatch[1]);
			item.bidsText = bidsMatch[1] + " bids";
		}

		var nextBidMatch = (item.primaryActionText || "").match(/bid\s+\$?\s*([\d,.]+)/i);
		if (nextBidMatch && nextBidMatch[1]) {
			item.nextBid = parseCurrencyValue(nextBidMatch[1]);
			item.nextBidText = "$" + nextBidMatch[1];
		}

		var lowerAction = normalizeText(item.primaryActionText).toLowerCase();
		var lowerWinner = normalizeText(item.winnerName).toLowerCase();
		item.status = "active";
		if (/sold/.test(lowerAction) || /sold/.test(cardText.toLowerCase())) {
			item.status = "sold";
		} else if (/winning/.test(lowerWinner) || item.winnerIcon === "💸") {
			item.status = "winning";
		} else if (item.winnerIcon === "🏆") {
			item.status = "won";
		} else if (item.timer === "00:00" && item.winnerName) {
			item.status = "won";
		}
		item.statusText = item.status;

		return item;
	}

	function parsePlayerCardsSnapshot() {
		var cards = Array.from(document.querySelectorAll("[data-testid='player-card'], [class*='_itemCard_'][data-testid='player-card']"));
		if (!cards.length) {
			return null;
		}

		var items = [];
		var sold = 0;
		var winning = 0;
		for (var i = 0; i < cards.length; i++) {
			var parsed = parsePlayerCard(cards[i], i);
			if (!parsed) {
				continue;
			}
			if (parsed.status === "sold") {
				sold += 1;
			} else if (parsed.status === "winning") {
				winning += 1;
			}
			items.push(parsed);
		}

		if (!items.length) {
			return null;
		}

		return {
			total: items.length,
			sold: sold,
			winning: winning,
			active: Math.max(0, items.length - sold),
			items: items
		};
	}

	function parseLiveEventCardsSnapshot() {
		var previewSnapshot = parseLivePreviewSnapshot();
		if (previewSnapshot) {
			return {
				total: previewSnapshot.total,
				watchingTotal: previewSnapshot.watchingTotal,
				current: previewSnapshot.current || null,
				items: previewSnapshot.items
			};
		}

		var cards = Array.from(document.querySelectorAll("[data-testid='a-event-card']"));
		if (!cards.length) {
			return null;
		}

		var items = [];
		var seen = {};
		for (var i = 0; i < cards.length; i++) {
			var card = cards[i];
			var href = toAbsoluteUrl(card.getAttribute("href"));
			var title = textFrom(card, "h3, [class*='_title_']");
			if (!title) {
				title = normalizeText(card.textContent);
			}
			if (!title) {
				continue;
			}
			var key = (href || "") + "|" + title;
			if (seen[key]) {
				continue;
			}
			seen[key] = true;
			items.push({
				index: items.length,
				title: title,
				href: href
			});
		}

		if (!items.length) {
			return null;
		}

		return {
			total: items.length,
			watchingTotal: 0,
			current: items[0],
			items: items
		};
	}

	function createAuctionSnapshot() {
		var cards = parsePlayerCardsSnapshot();
		var navigation = parseNavigationSnapshot();
		var previewSnapshot = parseLivePreviewSnapshot();
		var snapshot = null;

		if (cards && cards.items && cards.items.length) {
			var primary = cards.items.find(function (item) {
				return item && item.status === "winning";
			}) || cards.items[0];
			if (!primary) {
				return null;
			}

			snapshot = {
				title: primary.title,
				status: primary.status,
				statusText: primary.statusText,
				timer: primary.timer,
				bidder: primary.winnerName,
				winnerName: primary.winnerName,
				winnerIcon: primary.winnerIcon,
				currentPrice: primary.currentPrice,
				currentPriceText: primary.currentPriceText,
				price: primary.currentPrice,
				priceText: primary.currentPriceText,
				shippingPrice: primary.shippingPrice,
				shippingPriceText: primary.shippingPriceText,
				shipping: primary.shippingPriceText,
				primaryActionText: primary.primaryActionText,
				primaryActionDisabled: primary.primaryActionDisabled,
				maxBidText: primary.maxBidText,
				maxBidDisabled: primary.maxBidDisabled,
				nextBid: primary.nextBid,
				nextBidText: primary.nextBidText,
				bids: primary.bids,
				bidsText: primary.bidsText,
				cardCount: cards.total,
				sourceMode: "player_card"
			};
		} else if (previewSnapshot && previewSnapshot.current) {
			var current = previewSnapshot.current;
			snapshot = {
				title: current.title,
				status: current.isLive ? "live" : "scheduled",
				statusText: current.isLive ? "Live" : "Scheduled",
				timer: "",
				bidder: "",
				winnerName: "",
				winnerIcon: current.isLive ? "🔴" : "",
				currentPrice: null,
				currentPriceText: "",
				price: null,
				priceText: "",
				shippingPrice: null,
				shippingPriceText: "",
				shipping: "",
				primaryActionText: "",
				primaryActionDisabled: false,
				maxBidText: "",
				maxBidDisabled: false,
				nextBid: null,
				nextBidText: "",
				bids: null,
				bidsText: "",
				cardCount: 0,
				viewerCount: current.viewerCount,
				watchingText: current.liveText,
				sellerName: current.sellerName,
				sellerUrl: current.sellerUrl,
				href: current.href,
				scheduleText: current.scheduleText,
				tags: current.tags,
				sourceMode: "event_card"
			};
		}

		if (!snapshot) {
			return null;
		}

		if (navigation && navigation.viewerCount !== null && typeof navigation.viewerCount !== "undefined") {
			snapshot.viewerCount = navigation.viewerCount;
		}
		if (navigation && navigation.itemsButtonLabel) {
			snapshot.itemsButtonLabel = navigation.itemsButtonLabel;
		}
		if (previewSnapshot && previewSnapshot.current) {
			if (!snapshot.sellerName) {
				snapshot.sellerName = previewSnapshot.current.sellerName;
			}
			if (!snapshot.tags || !snapshot.tags.length) {
				snapshot.tags = previewSnapshot.current.tags;
			}
		}

		return snapshot;
	}

	function createCommerceSnapshot() {
		var snapshot = {};
		var navigation = parseNavigationSnapshot();
		var cards = parsePlayerCardsSnapshot();
		var events = parseLiveEventCardsSnapshot();
		var previewSnapshot = parseLivePreviewSnapshot();
		var upcomingEvents = parseUpcomingEventsSnapshot();

		if (navigation) {
			snapshot.navigation = navigation;
		}
		if (cards) {
			snapshot.playerCards = cards;
		}
		if (events) {
			snapshot.liveEvents = events;
		}
		if (previewSnapshot) {
			snapshot.livePreview = previewSnapshot;
			if (previewSnapshot.current) {
				snapshot.currentEvent = previewSnapshot.current;
			}
		}
		if (upcomingEvents) {
			snapshot.upcomingEvents = upcomingEvents;
		}

		return Object.keys(snapshot).length ? snapshot : null;
	}

	function sendMetaEvent(eventName, meta) {
		if (!eventName || !meta) {
			return;
		}
		pushMessage({
			type: "ebay",
			event: eventName,
			meta: meta
		});
	}

	function checkAuctionUpdates() {
		if (!isExtensionOn || settings.captureevents === false) {
			return;
		}
		var snapshot = createAuctionSnapshot();
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
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				var views = getViewerCountFromDom();
				if (views === null || views === lastViewerCount) {
					return;
				}
				lastViewerCount = views;
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: 'ebay',
							event: 'viewer_update',
							meta: views
						}
					}),
					function (e) {}
				);
			} catch (e) {
			}
		}
	}


	// OnlineViewers_root_orkvv
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
		if (!checking){
			startCheck();
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				
				if (!checking){
					startCheck();
				}
				
				if ("getSource" == request){sendResponse("ebay");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('textarea.msg-content').focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
						
						if (!checking){
							startCheck();
						}
					
					}
					
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
				
				
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL =  "";
	var observer = null;
	
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
				//	console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							const addedNode = mutation.addedNodes[i];
							if (addedNode.nodeType !== 1) continue; // Only process element nodes

							if (addedNode.skip){continue;}

							setTimeout(()=>{
									processMessage(addedNode);
							},300);

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");


	function startCheck(){
		if (isExtensionOn && checking){return;}

		clearInterval(checking);
		checking = false;
		if (!isExtensionOn){
			return;
		}
		
		
		checking = setInterval(function(){
			try {
				var container = document.querySelector("#chatting-container, [data-testid='chat-messages-container']");
				if (container && !container.marked){
					container.marked=true;

					setTimeout(function(){
						dataIndex = 0;
						onElementInserted(container);
					},2000);
				}

				checkViewers();
				checkAuctionUpdates();
				checkCommerceUpdates();
			} catch(e){}
		},2000);
	}
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				remoteConnection.datachannel.send("KEEPALIVE");
			}, 1000);
		};
		var errorHandle = function (e) {};
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = e => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = e => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function (e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function (e) {};
		localConnection.sendChannel.onmessage = function (e) {};
		localConnection
			.createOffer()
			.then(offer => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then(answer => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}
	
	
	function preventBackgroundThrottling() {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.mozHidden = false;
		document.webkitHidden = false;
		
		document.hasFocus = () => true;
		window.onFocus = () => true;

		Object.defineProperties(document, {
			mozHidden: { value: false, configurable: true },
			msHidden: { value: false, configurable: true },
			webkitHidden: { value: false, configurable: true },
			hidden: { value: false, configurable: true, writable: true },
			visibilityState: { 
				get: () => "visible",
				configurable: true
			}
		});
	}

	const events = [
		"visibilitychange",
		"webkitvisibilitychange",
		"blur",
		"mozvisibilitychange",
		"msvisibilitychange"
	];

	events.forEach(event => {
		window.addEventListener(event, (e) => {
			e.stopImmediatePropagation();
			e.preventDefault();
		}, true);
	});

	setInterval(preventBackgroundThrottling, 200);

})();
