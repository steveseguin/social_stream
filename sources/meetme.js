(function () {


	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {

		var blob = xhr.response;

		if (blob.size > (25 * 1024)) {
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
		if (unsafe === undefined || unsafe === null){return "";}
		return (unsafe+"")
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}
	function getAllContentNodes(element) { // takes an element.
		var resp = "";

		if (!element) {return resp;}

		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return settings.textonlymode ? element.textContent : (escapeHtml(element.textContent) || "");
			} else {
				return "";
			}
		}

		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
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

	function getText(ele){
		try {
			return (ele && ele.textContent ? ele.textContent.trim() : "");
		} catch(e){
			return "";
		}
	}

	function getClassName(ele){
		try {
			return ele.getAttribute("class") || "";
		} catch(e){
			return "";
		}
	}

	function getMessageRow(ele){
		if (!ele || ele.nodeType !== 1){return null;}
		try {
			if (ele.id && ele.id.indexOf("ChatMessage_") === 0){
				return ele;
			}
			if (ele.matches && ele.matches(".tmg-live-video-chat-message-item") && ele.querySelector(".title-cell-name-holder")){
				return ele;
			}
			var closestRow = ele.closest ? ele.closest("[id^='ChatMessage_'], .tmg-live-video-chat-message-item") : null;
			if (closestRow && closestRow.querySelector(".title-cell-name-holder")){
				return closestRow;
			}
			return ele.querySelector("[id^='ChatMessage_']");
		} catch(e){
			return null;
		}
	}

	function getRoomId(row){
		try {
			var container = row.closest("[id^='ChatHistoryContainer_']");
			if (container && container.id){
				return container.id.replace("ChatHistoryContainer_", "");
			}
		} catch(e){}
		try {
			var match = window.location.pathname.match(/\/live\/view\/([^\/?#]+)/);
			if (match && match[1]){
				return match[1];
			}
		} catch(e){}
		return "";
	}

	function getRank(row){
		var className = getClassName(row);
		var match = className.match(/(?:^|\s)rank-([^\s]+)/);
		return match && match[1] ? match[1] : "";
	}

	function addUnique(list, item){
		if (!item){return;}
		if (list.indexOf(item) === -1){
			list.push(item);
		}
	}

	function getImageSrc(img){
		if (!img){return "";}
		var src = "";
		try {
			if (!img.hasAttribute || !img.hasAttribute("src")){
				return "";
			}
			src = img.getAttribute("src") || "";
		} catch(e){}
		if (!src || src.indexOf("no_photo.svg") !== -1){
			return "";
		}
		if (/^(https?:|data:|blob:)/i.test(src)){
			return src;
		}
		try {
			var resolved = new URL(src, window.location.href).href;
			return resolved === window.location.href ? "" : resolved;
		} catch(e){
			return src;
		}
	}

	function getBadges(row){
		var badges = [];
		var textBadges = [];
		var badgeLabels = [];
		var badgeSrcs = [];
		var badgeClasses = [];
		try {
			row.querySelectorAll("[class*='badges-container'] > span, [class*='badges-container'] > img").forEach(function(badge){
				var img = badge.nodeName === "IMG" ? badge : (badge.querySelector ? badge.querySelector("img[src]") : null);
				var src = img && img.src ? img.src : "";
				var className = getClassName(badge).replace(/\s+/g, " ").trim();
				var label = badge.getAttribute("aria-label") || badge.getAttribute("title") || (img ? img.alt : "") || "";
				if (!label && className.indexOf("top-streamer") !== -1){label = "Top Streamer";}
				if (!label && className.indexOf("bouncer") !== -1){label = "Bouncer";}
				if (!label && className){label = className;}
				if (src){
					addUnique(badges, src);
				} else if (label && textBadges.indexOf(label) === -1){
					textBadges.push(label);
					badges.push({html: escapeHtml(label)});
				}
				addUnique(badgeLabels, label);
				addUnique(badgeSrcs, src);
				addUnique(badgeClasses, className);
			});
		} catch(e){}
		return {
			badges: badges,
			badgeLabels: badgeLabels,
			badgeSrcs: badgeSrcs,
			badgeClasses: badgeClasses
		};
	}

	var wsRequestClasses = {};
	var wsParticipants = {};
	var wsSeenEvents = {};
	var wsSeenEventOrder = [];
	var wsMessageObjectIds = {};
	var wsCaptureActive = false;
	var meetMeWsStartedAt = Date.now();
	var meetmeProfileImages = {};
	var lastSeenDomViewerCount = null;
	var lastSeenWsViewerCount = null;
	var lastWsViewerCount = null;
	var lastWsFollowerCount = null;
	var lastWsViewerCountAt = 0;
	var lastWsFollowerCountAt = 0;
	var MEETME_VIEWER_HEARTBEAT_INTERVAL_MS = 30000;
	var MEETME_FOLLOWER_UPDATE_MIN_INTERVAL_MS = 60000;

	function emitViewerUpdate(count, force, source) {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode) || !Number.isFinite(count)) {
			return;
		}
		if (source === "websocket" && Number.isFinite(lastSeenDomViewerCount)) {
			return;
		}
		var now = Date.now();
		if (!force && count === lastWsViewerCount) {
			return;
		}
		if (force && lastWsViewerCountAt && now - lastWsViewerCountAt < MEETME_VIEWER_HEARTBEAT_INTERVAL_MS) {
			return;
		}
		lastWsViewerCount = count;
		lastWsViewerCountAt = now;
		pushMessage({
			type: "meetme",
			event: "viewer_update",
			meta: count
		});
	}

	function getPreferredViewerCount() {
		return Number.isFinite(lastSeenDomViewerCount) ? lastSeenDomViewerCount : lastSeenWsViewerCount;
	}

	function normalizeWsData(rawData) {
		if (typeof rawData === "string") {
			return rawData;
		}
		try {
			if (rawData instanceof ArrayBuffer || ArrayBuffer.isView(rawData)) {
				return new TextDecoder().decode(rawData);
			}
			return typeof rawData === "object" ? JSON.stringify(rawData) : String(rawData);
		} catch (e) {
			return "";
		}
	}

	function normalizeProfileName(name){
		return getPlainText(name).toLowerCase();
	}

	function rememberProfileImage(name, src){
		var key = normalizeProfileName(name);
		if (key && src) {
			meetmeProfileImages[key] = src;
		}
	}

	function getRememberedProfileImage(name){
		return meetmeProfileImages[normalizeProfileName(name)] || "";
	}

	function hasDomChatHistory(){
		try {
			return !!document.querySelector("[id*=ChatHistoryContainer_]");
		} catch(e){
			return false;
		}
	}

	function parseWsJson(rawData) {
		var text = normalizeWsData(rawData);
		if (!text) {
			return null;
		}
		try {
			return JSON.parse(text);
		} catch (e) {
			return null;
		}
	}

	function getFirstValue(obj, keys) {
		if (!obj || typeof obj !== "object") {
			return "";
		}
		for (var i = 0; i < keys.length; i++) {
			if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== "") {
				return obj[keys[i]];
			}
		}
		return "";
	}

	function getPlainText(value) {
		if (value === undefined || value === null) {
			return "";
		}
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			return String(value).trim();
		}
		try {
			return JSON.stringify(value);
		} catch (e) {
			return "";
		}
	}

	function getTranslation(key, value) {
		try {
			if (settings.translation && settings.translation.innerHTML && key in settings.translation.innerHTML) {
				return settings.translation.innerHTML[key];
			}
			if (settings.translation && settings.translation.miscellaneous && key in settings.translation.miscellaneous) {
				return settings.translation.miscellaneous[key];
			}
		} catch (e) {}
		if (value !== undefined && value !== null && value !== "") {
			return value;
		}
		return key.replace(/-/g, " ");
	}

	function formatTranslation(key, fallback, values) {
		var template = getTranslation(key, fallback);
		values = values || {};
		Object.keys(values).forEach(function(valueKey) {
			var replacement = values[valueKey] == null ? "" : String(values[valueKey]);
			template = template.replace(new RegExp("\\{" + valueKey + "\\}", "g"), replacement);
		});
		return template;
	}

	function formatOutputText(value) {
		var text = getPlainText(value);
		return settings.textonlymode ? text : escapeHtml(text);
	}

	function formatMeetMeDiamonds(amount) {
		if (Number.isFinite(amount) && amount > 0) {
			var unit = amount === 1 ? getTranslation("meetme-diamond-singular", "diamond") : getTranslation("meetme-diamond-plural", "diamonds");
			return amount + " " + unit;
		}
		return getTranslation("meetme-diamond-plural", "diamonds");
	}

	function parseFirstNumber(value) {
		var match = String(value || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
		return match ? parseFloat(match[1]) : 0;
	}

	function parseMeetMeCount(value) {
		var text = getPlainText(value).replace(/,/g, "").trim();
		var match = text.match(/(\d+(?:\.\d+)?)\s*([kKmMbB])?/);
		if (!match) {
			return NaN;
		}
		var count = parseFloat(match[1]);
		var suffix = (match[2] || "").toLowerCase();
		if (suffix === "k") {
			count *= 1000;
		} else if (suffix === "m") {
			count *= 1000000;
		} else if (suffix === "b") {
			count *= 1000000000;
		}
		return Math.round(count);
	}

	function getDomViewerCount() {
		var selectors = [
			".swiper-slide-active [class*='viewers-count'] span",
			".swiper-slide-active [class*='viewers-count']",
			"[class*='viewers-count'] span",
			".viewers-count___KREgV span",
			"[class*='viewers-count']"
		];
		for (var i = 0; i < selectors.length; i++) {
			try {
				var nodes = document.querySelectorAll(selectors[i]);
				for (var j = 0; j < nodes.length; j++) {
					var count = parseMeetMeCount(nodes[j].textContent);
					if (Number.isFinite(count)) {
						return count;
					}
				}
			} catch(e){}
		}
		return NaN;
	}

	function pollDomViewerCount() {
		var count = getDomViewerCount();
		if (Number.isFinite(count)) {
			lastSeenDomViewerCount = count;
			emitViewerUpdate(count, false, "dom");
		}
	}

	function getPointerId(pointer) {
		if (!pointer || typeof pointer !== "object") {
			return "";
		}
		return pointer.objectId || pointer.id || pointer.userId || "";
	}

	function getWsObjectId(obj) {
		return obj && typeof obj === "object" ? (obj.objectId || obj.id || "") : "";
	}

	function getWsUserId(obj) {
		if (!obj || typeof obj !== "object") {
			return "";
		}
		return getPointerId(obj.user) || getPointerId(obj.userDetails) || getPointerId(obj.sender) || getPointerId(obj.fromUser) || obj.userId || obj.memberId || "";
	}

	function getWsPointerObjectId(obj, key) {
		if (!obj || typeof obj !== "object" || !obj[key] || typeof obj[key] !== "object") {
			return "";
		}
		return getPointerId(obj[key]);
	}

	function getNestedUserObject(obj) {
		if (!obj || typeof obj !== "object") {
			return {};
		}
		return obj.userDetails || obj.sender || obj.fromUser || obj.user || obj.profile || obj.actor || {};
	}

	function getWsName(obj) {
		var nested = getNestedUserObject(obj);
		return getPlainText(
			getFirstValue(obj, ["firstName", "displayName", "name", "username", "userName", "senderName", "fromName"]) ||
			getFirstValue(nested, ["firstName", "displayName", "name", "username", "userName"]) ||
			getWsUserId(obj)
		);
	}

	function getWsImage(obj) {
		if (!obj || typeof obj !== "object") {
			return "";
		}
		var nested = getNestedUserObject(obj);
		var profilePic = obj.profilePic || obj.profilePicture || nested.profilePic || nested.profilePicture || {};
		var image = getPlainText(
			getFirstValue(profilePic, ["square", "thumb", "large", "url", "src"]) ||
			getFirstValue(obj, ["chatimg", "avatar", "avatarUrl", "profileImage", "profileImageUrl"]) ||
			getFirstValue(nested, ["chatimg", "avatar", "avatarUrl", "profileImage", "profileImageUrl"])
		);
		return image || getRememberedProfileImage(getWsName(obj));
	}

	function getWsMessageText(obj) {
		return getPlainText(getFirstValue(obj, ["message", "chatMessage", "messageText", "body", "text", "comment", "content", "caption"]));
	}

	function getWsClassName(frame) {
		if (!frame || typeof frame !== "object") {
			return "";
		}
		if (frame.object && frame.object.className) {
			return frame.object.className;
		}
		if (frame.className) {
			return frame.className;
		}
		if (frame.requestId !== undefined && frame.requestId !== null) {
			return wsRequestClasses[String(frame.requestId)] || "";
		}
		return "";
	}

	function getWsDateMs(value) {
		try {
			if (!value) {
				return 0;
			}
			if (typeof value === "object" && value.iso) {
				return new Date(value.iso).getTime() || 0;
			}
			return new Date(value).getTime() || 0;
		} catch (e) {
			return 0;
		}
	}

	function isInitialWsBacklog(obj, op) {
		if (op !== "create") {
			return false;
		}
		var createdAt = getWsDateMs(obj && obj.createdAt);
		return createdAt && createdAt < meetMeWsStartedAt - 15000;
	}

	function rememberWsEvent(key) {
		if (!key) {
			return false;
		}
		if (wsSeenEvents[key]) {
			return true;
		}
		wsSeenEvents[key] = Date.now();
		wsSeenEventOrder.push(key);
		if (wsSeenEventOrder.length > 500) {
			var old = wsSeenEventOrder.shift();
			delete wsSeenEvents[old];
		}
		return false;
	}

	function buildBaseData() {
		return {
			chatname: "",
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			nameColor: "",
			chatmessage: "",
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "meetme"
		};
	}

	function cleanMeta(meta) {
		var out = {};
		for (var key in meta) {
			if (Array.isArray(meta[key]) && !meta[key].length) {
				continue;
			}
			if (meta[key] !== undefined && meta[key] !== null && meta[key] !== "") {
				out[key] = meta[key];
			}
		}
		return out;
	}

	function buildWsMeta(frame, className, obj) {
		return cleanMeta({
			source: "websocket",
			rawEventType: className,
			operation: frame.op || "",
			requestId: frame.requestId,
			objectId: getWsObjectId(obj),
			chatName: obj && obj.chatName,
			userId: getWsUserId(obj),
			createdAt: obj && obj.createdAt && (obj.createdAt.iso || obj.createdAt),
			updatedAt: obj && obj.updatedAt && (obj.updatedAt.iso || obj.updatedAt),
			viewerLevelId: obj && obj.viewerLevelId,
			isBouncer: obj && obj.isBouncer,
			liveAdmin: obj && obj.liveAdmin,
			isSubscriber: obj && obj.isSubscriber,
			isNewViewer: obj && obj.isNewViewer
		});
	}

	function shouldEmitEvent(eventName, isDonationEvent) {
		if (!isExtensionOn) {
			return false;
		}
		if (settings.hideevents && !isDonationEvent) {
			return false;
		}
		if ((eventName === "joined" || eventName === "rejoined") && settings.capturejoinedevent === false) {
			return false;
		}
		return true;
	}

	function getEventTarget(eventName) {
		if ((eventName === "liked" || eventName === "like" || eventName === "reaction") && settings.capturelikeevent === false) {
			return "reactions";
		}
		return "";
	}

	function emitWsData(data, target) {
		var base = buildBaseData();
		for (var key in data) {
			base[key] = data[key];
		}
		pushMessage(base, target || getEventTarget(base.event));
	}

	function handleWsChatMessage(frame, className, obj) {
		if (!obj || isInitialWsBacklog(obj, frame.op)) {
			return;
		}
		if (hasDomChatHistory()) {
			return;
		}
		var objectId = getWsObjectId(obj);
		if (rememberWsEvent(className + "|" + (frame.op || "") + "|" + objectId + "|" + getWsDateMs(obj.createdAt))) {
			return;
		}
		var name = getWsName(obj);
		var msg = getWsMessageText(obj);
		if (!name || !msg) {
			return;
		}
		wsCaptureActive = true;
		if (objectId) {
			wsMessageObjectIds[objectId] = Date.now();
		}
		var data = {
			chatname: formatOutputText(name),
			chatmessage: formatOutputText(msg),
			chatimg: getWsImage(obj),
			meta: buildWsMeta(frame, className, obj)
		};
		emitWsData(data);
	}

	function handleWsParticipant(frame, className, obj) {
		if (!obj) {
			return;
		}
		var objectId = getWsObjectId(obj);
		if (objectId) {
			wsParticipants[objectId] = obj;
		}
		var cached = objectId && wsParticipants[objectId] ? wsParticipants[objectId] : obj;
		if (isInitialWsBacklog(obj, frame.op)) {
			return;
		}
		if (rememberWsEvent(className + "|" + (frame.op || "") + "|" + objectId + "|" + getWsDateMs(obj.createdAt || obj.updatedAt))) {
			return;
		}
		var name = getWsName(cached);
		if (!name) {
			return;
		}
		var eventName = "joined";
		var message = getTranslation("meetme-joined-live-message", "joined the live");
		if (frame.op === "delete") {
			eventName = "left";
			message = getTranslation("meetme-left-live-message", "left the live");
		} else if (obj.isNewViewer === false) {
			eventName = "rejoined";
			message = getTranslation("meetme-rejoined-live-message", "rejoined the live");
		}
		if (!shouldEmitEvent(eventName, false)) {
			return;
		}
		emitWsData({
			chatname: formatOutputText(name),
			chatmessage: formatOutputText(message),
			chatimg: getWsImage(cached),
			event: eventName,
			membership: obj.isSubscriber ? "Subscriber" : "",
			meta: buildWsMeta(frame, className, obj)
		});
	}

	function getGiftDetails(obj) {
		var gift = (obj && (obj.gift || obj.product || obj.item || obj.virtualGift || obj.giftInfo)) || {};
		var name = getPlainText(
			getFirstValue(obj, ["giftName", "productName", "itemName", "name"]) ||
			getFirstValue(gift, ["giftName", "productName", "itemName", "name", "title"])
		);
		var count = parseInt(getFirstValue(obj, ["quantity", "count", "amount", "giftCount"]), 10) || 1;
		var image = getPlainText(
			getFirstValue(obj, ["giftImage", "giftImageUrl", "imageUrl", "image", "contentimg"]) ||
			getFirstValue(gift, ["imageUrl", "image", "icon", "iconUrl", "url", "src"])
		);
		var diamonds = parseInt(getFirstValue(obj, ["diamondAmount", "diamonds", "value", "credits", "price"]), 10) || 0;
		return {
			name: name || "gift",
			count: count,
			image: image,
			diamonds: diamonds
		};
	}

	function handleWsGift(frame, className, obj) {
		if (!obj || isInitialWsBacklog(obj, frame.op)) {
			return;
		}
		var objectId = getWsObjectId(obj);
		if (rememberWsEvent(className + "|" + (frame.op || "") + "|" + objectId + "|" + getWsDateMs(obj.createdAt))) {
			return;
		}
		var name = getWsName(obj);
		var gift = getGiftDetails(obj);
		var hasUsefulGiftDetails = !!(name || gift.image || gift.diamonds || gift.name !== "gift" || gift.count > 1);
		if (!hasUsefulGiftDetails) {
			return;
		}
		var giftLabel = (gift.count > 1 ? gift.count + "x " : "") + gift.name;
		var meta = buildWsMeta(frame, className, obj);
		meta.giftName = gift.name;
		meta.giftCount = gift.count;
		if (gift.diamonds) {
			meta.amount = gift.diamonds;
			meta.currency = "diamonds";
		}
		if (!shouldEmitEvent("gift", true)) {
			return;
		}
		var donationLabel = gift.diamonds ? formatMeetMeDiamonds(gift.diamonds) : giftLabel;
		emitWsData({
			chatname: formatOutputText(name || "MeetMe User"),
			chatmessage: formatOutputText(formatTranslation("alert-sent-amount", "sent {amount}", {
				amount: giftLabel
			})),
			chatimg: getWsImage(obj),
			contentimg: gift.image,
			hasDonation: formatOutputText(donationLabel),
			event: "gift",
			meta: cleanMeta(meta)
		});
	}

	function handleWsLike(frame, className, obj) {
		if (!obj || isInitialWsBacklog(obj, frame.op)) {
			return;
		}
		var objectId = getWsObjectId(obj);
		var totalLikes = parseInt(getFirstValue(obj, ["totalLikes", "likes", "likeCount"]), 10);
		var subscriberLikes = parseInt(getFirstValue(obj, ["subscriberLikes"]), 10);
		var likeKey = className + "|" + (frame.op || "") + "|" + objectId + "|" + getWsDateMs(obj.createdAt) + "|" + (Number.isFinite(totalLikes) ? totalLikes : "") + "|" + (Number.isFinite(subscriberLikes) ? subscriberLikes : "");
		if (rememberWsEvent(likeKey)) {
			return;
		}
		var meta = buildWsMeta(frame, className, obj);
		meta.reactionType = "heart";
		if (Number.isFinite(totalLikes)) {
			meta.totalLikes = totalLikes;
		}
		if (Number.isFinite(subscriberLikes)) {
			meta.subscriberLikes = subscriberLikes;
		}
		var name = getWsName(obj);
		if (!name) {
			if (!shouldEmitEvent("reaction", false)) {
				return;
			}
			emitWsData({
				chatname: "MeetMe",
				chatmessage: "",
				event: "reaction",
				meta: cleanMeta(meta)
			}, "reactions");
			return;
		}
		if (!shouldEmitEvent("liked", false)) {
			return;
		}
		emitWsData({
			chatname: formatOutputText(name),
			chatmessage: formatOutputText(getTranslation("meetme-sent-heart-message", "sent a heart")),
			chatimg: getWsImage(obj),
			event: "liked",
			meta: cleanMeta(meta)
		});
	}

	function handleWsDiamond(frame, className, obj) {
		if (!obj || isInitialWsBacklog(obj, frame.op)) {
			return;
		}
		var objectId = getWsObjectId(obj);
		if (rememberWsEvent(className + "|" + (frame.op || "") + "|" + objectId + "|" + getWsDateMs(obj.createdAt))) {
			return;
		}
		var amount = parseInt(getFirstValue(obj, ["diamonds", "diamondAmount", "amount", "value"]), 10) || 0;
		var name = getWsName(obj);
		if (!amount && !name) {
			return;
		}
		if (!shouldEmitEvent("donation", true)) {
			return;
		}
		var label = formatMeetMeDiamonds(amount);
		var meta = buildWsMeta(frame, className, obj);
		if (amount) {
			meta.amount = amount;
			meta.currency = "diamonds";
		}
		var data = {
			chatname: formatOutputText(name || "MeetMe User"),
			chatmessage: formatOutputText(label),
			chatimg: getWsImage(obj),
			hasDonation: formatOutputText(label),
			event: "donation",
			meta: cleanMeta(meta)
		};
		if (amount) {
			data.donoValue = amount;
		}
		emitWsData(data);
	}

	function handleWsVideo(frame, className, obj) {
		if (!obj || !isExtensionOn) {
			return;
		}
		var now = Date.now();
		var count = parseInt(getFirstValue(obj, ["currentViewers", "totalViewers", "viewerCount", "viewers"]), 10);
		var domCount = getDomViewerCount();
		if (Number.isFinite(domCount)) {
			lastSeenDomViewerCount = domCount;
			emitViewerUpdate(domCount, false, "dom");
		}
		if (Number.isFinite(count)) {
			lastSeenWsViewerCount = count;
			emitViewerUpdate(count, false, "websocket");
		}
		var followerCount = parseInt(getFirstValue(obj, ["lifetimeFollowers", "totalFollowers", "followers"]), 10);
		if (
			Number.isFinite(followerCount) &&
			followerCount !== lastWsFollowerCount &&
			(!lastWsFollowerCountAt || now - lastWsFollowerCountAt >= MEETME_FOLLOWER_UPDATE_MIN_INTERVAL_MS) &&
			shouldEmitEvent("follower_update", false)
		) {
			lastWsFollowerCount = followerCount;
			lastWsFollowerCountAt = now;
			pushMessage({
				type: "meetme",
				event: "follower_update",
				meta: followerCount
			});
		}
	}

	function handleWsGuestBroadcast(frame, className, obj) {
		if (!obj || isInitialWsBacklog(obj, frame.op)) {
			return;
		}
		var objectId = getWsObjectId(obj);
		var status = getPlainText(obj.status);
		var key = className + "|" + (frame.op || "") + "|" + objectId + "|" + getWsDateMs(obj.updatedAt || obj.createdAt) + "|" + status + "|" + getPlainText(obj.position) + "|" + getPlainText(obj.total);
		if (rememberWsEvent(key) || !shouldEmitEvent("guest_update", false)) {
			return;
		}
		var meta = buildWsMeta(frame, className, obj);
		meta.guestBroadcastId = objectId;
		meta.status = status;
		meta.position = parseInt(obj.position, 10) || "";
		meta.totalGuests = parseInt(obj.total, 10) || "";
		meta.isMuted = obj.isMuted;
		meta.streamClientId = obj.streamClientId;
		meta.requestedAt = obj.requestedAt && (obj.requestedAt.iso || obj.requestedAt);
		meta.videoViewerId = getWsPointerObjectId(obj, "videoViewer");
		meta.broadcastId = getWsPointerObjectId(obj, "broadcast");
		pushMessage({
			type: "meetme",
			event: "guest_update",
			meta: cleanMeta(meta)
		});
	}

	function handleMeetMeWsSent(rawData) {
		var frame = parseWsJson(rawData);
		if (!frame || frame.op !== "subscribe" || !frame.query || frame.requestId === undefined || frame.requestId === null) {
			return;
		}
		if (frame.query.className) {
			wsRequestClasses[String(frame.requestId)] = frame.query.className;
		}
	}

	function handleMeetMeWsReceived(rawData) {
		var frame = parseWsJson(rawData);
		if (!frame || typeof frame !== "object") {
			return;
		}
		if (frame.op !== "create" && frame.op !== "update" && frame.op !== "delete") {
			return;
		}
		var className = getWsClassName(frame);
		var obj = frame.object || {};
		switch (className) {
			case "SNSChatMessage":
				handleWsChatMessage(frame, className, obj);
				break;
			case "SNSChatParticipant":
				handleWsParticipant(frame, className, obj);
				break;
			case "SNSGiftMessage":
				handleWsGift(frame, className, obj);
				break;
			case "SNSLike":
				handleWsLike(frame, className, obj);
				break;
			case "SNSDiamond":
				handleWsDiamond(frame, className, obj);
				break;
			case "SNSVideo":
				handleWsVideo(frame, className, obj);
				break;
			case "SNSVideoGuestBroadcast":
				handleWsGuestBroadcast(frame, className, obj);
				break;
		}
	}

	function handleMeetMeWindowMessage(event) {
		if (!event || event.source !== window || !event.data || event.data.source !== "meetme-ws-interceptor") {
			return;
		}
		if (event.data.type === "send") {
			handleMeetMeWsSent(event.data.data);
		} else if (event.data.type === "receive") {
			handleMeetMeWsReceived(event.data.data);
		}
	}

	window.addEventListener("message", handleMeetMeWindowMessage);


	function processMessage(ele){
		var row = getMessageRow(ele);
		if (!row || row.ssnProcessed){return;}
		if (!row.id || row.id.indexOf("ChatMessage_") !== 0){return;}

		var messageId = row.id.replace("ChatMessage_", "");
		var rowClassName = getClassName(row).replace(/\s+/g, " ").trim();
		var chatimg = "";
		var avatarAlt = "";
		try {
			var avatar = row.querySelector(".chat-avatar-img-holder img[src], .tmg-live-video-react-chat-message-image[src], .tmg-live-video-chat-message-image[src]");
			if (avatar){
				chatimg = getImageSrc(avatar);
				avatarAlt = avatar.alt || "";
				if (/^(user avatar|stream avatar|avatar)$/i.test(avatarAlt.trim())){
					avatarAlt = "";
				}
			}
		} catch(e){
		}

		var name="";
		var rawName = "";
		var displayTitle = "";
		try {
			var nameNode = row.querySelector(".title-cell-name-holder");
			var titleNode = row.querySelector(".tmg-live-video-react-user-name, .tmg-live-video-user-name");
			var favoriteNodeForName = row.querySelector(".tmg-live-video-favorite-message");
			var favoriteActorNode = favoriteNodeForName ? favoriteNodeForName.querySelector(".title-cell-name-holder, [role='button'], .tmg-live-video-react-clickable") : null;
			displayTitle = titleNode ? (titleNode.getAttribute("title") || "") : "";
			rawName = getText(nameNode) || displayTitle || getText(favoriteActorNode) || avatarAlt;
			name = formatOutputText(rawName);
			rememberProfileImage(rawName, chatimg);
		} catch(e){
		}

		var msg="";
		var msgNode = null;
		try {
			msgNode = row.querySelector(".tmg-live-video-react-chat-message, .tmg-live-video-chat-message");
			msg = getAllContentNodes(msgNode);
		} catch(e){
		}

		var contentimg = "";
		var hasDonation = "";
		var eventName = "";
		var giftText = "";
		var favoriteText = "";
		var favoriteTarget = "";
		try {
			var joinNode = row.querySelector(".tmg-live-video-user-joined, .join-cell .tmg-live-video-user-joined");
			if (joinNode || rowClassName.split(" ").indexOf("join-cell") !== -1) {
				eventName = "joined";
				msg = formatOutputText(getTranslation("meetme-joined-live-message", "joined the stream"));
			}
		} catch(e){}
		try {
			var favoriteNode = row.querySelector(".tmg-live-video-favorite-message");
			if (favoriteNode) {
				eventName = "new_follower";
				favoriteText = getText(favoriteNode).replace(/\s+/g, " ").trim();
				var afterName = favoriteText;
				if (rawName && afterName.indexOf(rawName) === 0) {
					afterName = afterName.slice(rawName.length).trim();
				}
				favoriteTarget = afterName.replace(/^Favorited\s+/i, "").trim();
				msg = formatOutputText(getTranslation("alert-just-followed", "just followed"));
			}
		} catch(e){}
		try {
			var giftImg = row.querySelector(".tmg-live-video-gift-thumb-img[src], img[src*='/gifts/']");
			if (giftImg && giftImg.getAttribute("src")) {
				contentimg = getImageSrc(giftImg);
				giftText = getText(msgNode).replace(/\s+/g, " ").trim();
				hasDonation = formatOutputText(giftText || "Gift");
				eventName = "gift";
			}
		} catch(e){}

		if (eventName && !shouldEmitEvent(eventName, !!hasDonation)) {
			return;
		}
		if (!msg || !name)	{
			return;
		}
		if (!eventName && messageId && wsMessageObjectIds[messageId]) {
			row.ssnProcessed = true;
			return;
		}
		row.ssnProcessed = true;

		var level = "";
		var levelColor = "";
		try {
			var levelNode = row.querySelector(".level-number");
			level = getText(levelNode);
			if (levelNode){
				levelColor = levelNode.style.backgroundColor || "";
			}
			var levelColorNode = row.querySelector("[style*='--levels-group-current-color']");
			if (levelColorNode && levelColorNode.style.getPropertyValue("--levels-group-current-color")){
				levelColor = levelColorNode.style.getPropertyValue("--levels-group-current-color");
			}
		} catch(e){}

		var badgeData = getBadges(row);
		var rank = getRank(row);
		var isBouncer = false;
		var isTopStreamer = false;
		var isBestOfTheWeek = false;
		try {
			isBouncer = !!row.querySelector(".tmg-live-video-user-bouncer, .tmg-live-video-user-icon.bouncer");
			isTopStreamer = !!row.querySelector(".top-streamer");
			isBestOfTheWeek = rowClassName.split(" ").indexOf("botw") !== -1;
		} catch(e){}

		var data = {};
		data.chatname = name;
		data.chatbadges = badgeData.badges.length ? badgeData.badges : "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "meetme";
		if (eventName) {
			data.event = eventName;
		}
		var giftAmount = parseFirstNumber(giftText);
		data.meta = cleanMeta({
			source: "dom",
			messageId: messageId,
			roomId: getRoomId(row),
			displayTitle: displayTitle,
			avatarAlt: avatarAlt,
			level: level,
			levelColor: levelColor,
			badgeLabels: badgeData.badgeLabels,
			badgeSrcs: badgeData.badgeSrcs,
			badgeClasses: badgeData.badgeClasses,
			isBouncer: isBouncer,
			isTopStreamer: isTopStreamer,
			isBestOfTheWeek: isBestOfTheWeek,
			rank: rank,
			rowClassName: rowClassName,
			favoriteText: favoriteText,
			targetName: favoriteTarget,
			giftText: giftText,
			amount: giftAmount || "",
			currency: giftAmount ? "credits" : ""
		});
		if (giftAmount) {
			data.donoValue = giftAmount;
		}

		pushMessage(data, getEventTarget(data.event));
	}

	function pushMessage(data, target){
		try{
			var request = { "message": data };
			if (target) {
				request.target = target;
			}
			chrome.runtime.sendMessage(chrome.runtime.id, request, function(e){});
		} catch(e){
		}
	}

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	// settings.hideevents
	// settings.capturejoinedevent
	// settings.capturelikeevent


	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("meetme");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector("#TMGChatMessagesActionBar_TextInput").focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
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


	function onElementInserted(containerSelector) {
		var target = document.querySelector(containerSelector);
		if (!target){return;}


		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {

					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							processMessage(mutation.addedNodes[i]);
							if (mutation.addedNodes[i].querySelectorAll) {
								mutation.addedNodes[i].querySelectorAll("[id^='ChatMessage_']").forEach(function(row){
									processMessage(row);
								});
							}
						} catch(e){}
					}
				}
			});
		};

		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	console.log("social stream injected");

	setInterval(function(){
		try {
		pollDomViewerCount();
		if (document.querySelector("[id*=ChatHistoryContainer_]")){
			if (!document.querySelector("[id*=ChatHistoryContainer_]").marked){
				document.querySelector("[id*=ChatHistoryContainer_]").marked=true;

				console.log("CONNECTED chat detected");

				setTimeout(function(){
					document.querySelectorAll("[id*=ChatHistoryContainer_] [id^='ChatMessage_']").forEach(function(ele){
						ele.ssnProcessed=true;
						//processMessage(ele); //Debug Only; will load all old messages
					});
					onElementInserted("[id*=ChatHistoryContainer_]");
				},1000);
			}
		}} catch(e){}
	},2000);

	setInterval(function(){
		try {
			pollDomViewerCount();
			emitViewerUpdate(getPreferredViewerCount(), true, Number.isFinite(lastSeenDomViewerCount) ? "dom" : "websocket");
		} catch(e){}
	}, MEETME_VIEWER_HEARTBEAT_INTERVAL_MS);

})();
