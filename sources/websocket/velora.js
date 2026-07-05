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
		try {
			unsafe = unsafe == null ? "" : String(unsafe);
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
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
				if (!isTextOnlyMode()){
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
	
	var processedMessages = new Set();
	var processedEvents = new Set();
	var historyPollTimer = null;
	var currentHistoryChannel = "";
	var historyFallbackMisses = 0;
	var historyPublishedMessages = false;
	var historyPollStartedAt = 0;
	var recentMessageContent = {};
	var historyChannelCache = {};
	var historyChannelPending = {};

	function isTextOnlyMode(){
		var setting = settings.textonlymode;
		if (setting && typeof setting === "object"){
			return setting.setting === true;
		}
		return setting === true;
	}

	function rememberMessageKey(key){
		key = String(key || "").replace(/\s+/g, " ").trim();
		if (!key || processedMessages.has(key)){
			return false;
		}
		processedMessages.add(key);
		if (processedMessages.size > 300){
			processedMessages.delete(processedMessages.values().next().value);
		}
		return true;
	}

	function normalizeMessageTextForKey(value){
		value = String(value || "");
		value = value.replace(/<[^>]*>/g, " ");
		value = value.replace(/&nbsp;/gi, " ");
		value = value.replace(/&amp;/gi, "&");
		value = value.replace(/&lt;/gi, "<");
		value = value.replace(/&gt;/gi, ">");
		value = value.replace(/&quot;/gi, '"');
		value = value.replace(/&#039;/g, "'");
		return value.replace(/\s+/g, " ").trim().toLowerCase();
	}

	function getMessageContentKey(channel, name, text){
		name = normalizeMessageTextForKey(name);
		text = normalizeMessageTextForKey(text);
		channel = normalizeVeloraChannel(channel || currentHistoryChannel || getVeloraHistoryChannel());
		if (!name || !text){
			return "";
		}
		return "content|\u00b6|" + channel + "|\u00b6|" + name + "|\u00b6|" + text;
	}

	function getApiMessageKey(msg, channel){
		return msg.id
			? "api-id|\u00b6|" + channel + "|\u00b6|" + msg.id
			: "api-chat|\u00b6|" + channel + "|\u00b6|" + msg.timestamp + "|\u00b6|" + msg.name + "|\u00b6|" + msg.text;
	}

	function rememberRecentMessageContent(key){
		var now = Date.now();
		var keys;
		var i;
		key = String(key || "");
		if (!key){
			return true;
		}
		keys = Object.keys(recentMessageContent);
		for (i = 0; i < keys.length; i++){
			if ((now - recentMessageContent[keys[i]]) > 12000){
				delete recentMessageContent[keys[i]];
			}
		}
		if (recentMessageContent[key]){
			return false;
		}
		recentMessageContent[key] = now;
		keys = Object.keys(recentMessageContent);
		while (keys.length > 300){
			delete recentMessageContent[keys.shift()];
		}
		return true;
	}

	function normalizeVeloraChannel(value){
		value = String(value || "").trim().replace(/^@+/, "").replace(/^\/+|\/+$/g, "");
		if (!value || /^(dashboard|developer|directory|login|logout|settings|support|terms|privacy)$/i.test(value)){
			return "";
		}
		return value;
	}

	function looksLikeVeloraId(value){
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
	}

	function getVeloraChannelIdFromResponse(data){
		if (!data || typeof data !== "object"){
			return "";
		}
		return getObjectValue(data, ["id", "userId", "user_id", "channelId", "channel_id"]) ||
			getObjectValue(data.user || data.channel || {}, ["id", "userId", "user_id", "channelId", "channel_id"]) ||
			getObjectValue(data.data || {}, ["id", "userId", "user_id", "channelId", "channel_id"]);
	}

	function fetchVeloraJson(url){
		return fetch(url, {
			cache: "no-store",
			headers: {
				"Accept": "application/json"
			}
		}).then(function(response){
			if (!response.ok){
				throw new Error("HTTP " + response.status);
			}
			return response.json();
		});
	}

	function resolveVeloraHistoryChannel(channel){
		var cacheKey = normalizeVeloraChannel(channel).toLowerCase();
		if (!cacheKey){
			return Promise.resolve("");
		}
		if (looksLikeVeloraId(cacheKey)){
			return Promise.resolve(cacheKey);
		}
		if (historyChannelCache[cacheKey]){
			return Promise.resolve(historyChannelCache[cacheKey]);
		}
		if (historyChannelPending[cacheKey]){
			return historyChannelPending[cacheKey];
		}
		historyChannelPending[cacheKey] = fetchVeloraJson("https://api.velora.tv/api/users/" + encodeURIComponent(channel))
			.then(function(data){
				return getVeloraChannelIdFromResponse(data) || "";
			}).catch(function(){
				return fetchVeloraJson("https://api.velora.tv/api/streams/user/" + encodeURIComponent(channel))
					.then(function(data){
						return getVeloraChannelIdFromResponse(data) || "";
					});
			}).then(function(resolved){
				historyChannelCache[cacheKey] = normalizeVeloraChannel(resolved) || channel;
				delete historyChannelPending[cacheKey];
				return historyChannelCache[cacheKey];
			}).catch(function(){
				delete historyChannelPending[cacheKey];
				return channel;
			});
		return historyChannelPending[cacheKey];
	}

	function getRuntimeParam(key){
		try {
			var search = new URLSearchParams(window.location.search || "");
			var hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
			return search.get(key) || hash.get(key) || "";
		} catch(e){
		}
		return "";
	}

	function getVeloraHistoryChannel(){
		var channel = normalizeVeloraChannel(getRuntimeParam("channel") || getRuntimeParam("username") || getRuntimeParam("user"));
		if (channel){
			return channel;
		}
		try {
			var parts = (window.location.pathname || "").split("/").filter(Boolean);
			if (parts[0] === "dashboard" && parts[1] === "stream" && parts[2] === "popout"){
				return normalizeVeloraChannel(parts[3] || "");
			}
			return normalizeVeloraChannel(parts[0] || "");
		} catch(e){
		}
		return "";
	}

	function getObjectValue(obj, keys){
		if (!obj){ return ""; }
		for (var i = 0; i < keys.length; i++){
			var key = keys[i];
			if (obj[key] !== undefined && obj[key] !== null && obj[key] !== ""){
				return obj[key];
			}
		}
		return "";
	}

	function normalizeVeloraBadges(badges){
		var badgeList = [];
		if (!Array.isArray(badges)){
			return badgeList;
		}
		badges.forEach(function(badge){
			var badgeUrl = "";
			if (!badge){ return; }
			if (typeof badge === "string"){
				if (/^https?:\/\//i.test(badge)){
					badgeUrl = badge;
				}
			} else if (typeof badge === "object"){
				badgeUrl = getObjectValue(badge, ["url", "imageUrl", "imageURL", "image", "icon", "src", "badgeUrl", "staticAssetUrl"]);
			}
			if (badgeUrl){
				badgeList.push(String(badgeUrl));
			}
		});
		return badgeList;
	}

	function getVeloraMessageText(raw){
		var text = getObjectValue(raw, ["text", "message", "content", "body"]);
		if (text && typeof text === "object"){
			text = getObjectValue(text, ["text", "message", "content", "body"]);
		}
		return text === undefined || text === null ? "" : String(text);
	}

	function normalizeVeloraApiMessage(raw, channel){
		var user;
		var card;
		var text;
		var cardName;
		if (!raw || typeof raw !== "object"){
			return null;
		}
		user = raw.user || raw.sender || {};
		card = raw.card || null;
		text = getVeloraMessageText(raw);
		cardName = card ? getObjectValue(card, ["name", "title"]) : "";
		if (raw.isSystem && !text && !cardName){
			return null;
		}
		return {
			id: getObjectValue(raw, ["messageId", "message_id", "id", "_id", "uuid"]),
			name: getObjectValue(raw, ["displayName", "display_name", "username", "name"]) || getObjectValue(user, ["displayName", "display_name", "username", "name"]),
			userId: getObjectValue(raw, ["userId", "user_id"]) || getObjectValue(user, ["id", "userId", "user_id"]),
			text: text || (cardName ? "[" + cardName + "]" : ""),
			timestamp: getObjectValue(raw, ["timestamp", "createdAt", "created_at", "sentAt", "sent_at"]),
			badges: normalizeVeloraBadges(raw.badges || user.badges || []),
			avatar: getObjectValue(raw, ["avatarUrl", "avatar_url", "profileImageUrl"]) || getObjectValue(user, ["avatarUrl", "avatar_url", "profileImageUrl", "image"]),
			color: getObjectValue(raw, ["color", "accentColor", "accent_color"]) || getObjectValue(user, ["color", "accentColor", "accent_color"]),
			card: card,
			isSubscriber: !!(raw.isSubscriber || raw.is_subscriber || user.isSubscriber || user.is_subscriber),
			subscriberMonths: getObjectValue(raw, ["subscriberMonths", "subscriber_months"]) || getObjectValue(user, ["subscriberMonths", "subscriber_months"]),
			channel: channel
		};
	}

	function getHistoryMessagesFromResponse(data){
		if (Array.isArray(data)){
			return data;
		}
		if (!data || typeof data !== "object"){
			return [];
		}
		if (Array.isArray(data.messages)){
			return data.messages;
		}
		if (Array.isArray(data.data)){
			return data.data;
		}
		if (data.message && typeof data.message === "object"){
			return [data.message];
		}
		return [];
	}

	function getVeloraTimestampValue(message){
		try {
			var stamp = getObjectValue(message, ["timestamp", "createdAt", "created_at", "sentAt", "sent_at"]);
			var value = Date.parse(stamp);
			return isNaN(value) ? 0 : value;
		} catch(e){
		}
		return 0;
	}

	function processApiMessage(raw, channel){
		var msg = normalizeVeloraApiMessage(raw, channel);
		var msgKey;
		var contentKey;
		var data;
		var textOnly = isTextOnlyMode();
		if (!msg || !msg.name || !msg.text){
			return;
		}
		msgKey = getApiMessageKey(msg, channel);
		if (!rememberMessageKey(msgKey)){
			return;
		}
		contentKey = getMessageContentKey(channel, msg.name, msg.text);
		if (contentKey && !rememberRecentMessageContent(contentKey)){
			return;
		}
		data = makeBaseData();
		data.chatname = escapeHtml(msg.name);
		data.chatbadges = msg.badges;
		data.nameColor = msg.color || "";
		data.chatmessage = textOnly ? msg.text : escapeHtml(msg.text);
		data.chatimg = msg.avatar || "";
		data.membership = msg.isSubscriber ? (msg.subscriberMonths ? msg.subscriberMonths + " month subscriber" : "Subscriber") : "";
		data.textonly = textOnly;
		if (msg.card){
			data.contentimg = getObjectValue(msg.card, ["imageUrl", "thumbnailUrl", "image", "thumbnail"]) || "";
		}
		pushMessage(data);
		historyPublishedMessages = true;
	}

	function seedApiMessage(raw, channel){
		var msg = normalizeVeloraApiMessage(raw, channel);
		var contentKey;
		if (!msg || !msg.name || !msg.text){
			return;
		}
		rememberMessageKey(getApiMessageKey(msg, channel));
		contentKey = getMessageContentKey(channel, msg.name, msg.text);
		if (contentKey){
			rememberRecentMessageContent(contentKey);
		}
	}

	function pollVeloraChatHistory(){
		var channel;
		if (!isExtensionOn){
			return;
		}
		channel = getVeloraHistoryChannel();
		if (!channel){
			return;
		}
		if (channel !== currentHistoryChannel){
			currentHistoryChannel = channel;
			historyPublishedMessages = false;
			historyPollStartedAt = Date.now();
		}
		resolveVeloraHistoryChannel(channel).then(function(resolvedChannel){
			var pollChannel = resolvedChannel || channel;
			return fetchVeloraJson("https://api.velora.tv/api/chat/channels/" + encodeURIComponent(pollChannel) + "/history?limit=50").then(function(data){
				var messages = getHistoryMessagesFromResponse(data).slice();
				var initialBatch = !historyPublishedMessages;
				if (messages.length > 1 && getVeloraTimestampValue(messages[0]) > getVeloraTimestampValue(messages[messages.length - 1])){
					messages.reverse();
				}
				messages.forEach(function(message){
					var timestampValue = getVeloraTimestampValue(message);
					if ((timestampValue && timestampValue < historyPollStartedAt) || (initialBatch && !timestampValue)){
						seedApiMessage(message, channel);
						return;
					}
					processApiMessage(message, channel);
				});
				if (initialBatch){
					historyPublishedMessages = true;
				}
			});
		}).catch(function(){
		});
	}

	function startHistoryPolling(){
		if (historyPollTimer){
			return;
		}
		historyPublishedMessages = false;
		historyPollStartedAt = Date.now();
		pollVeloraChatHistory();
		historyPollTimer = setInterval(pollVeloraChatHistory, 3000);
	}

	function stopHistoryPolling(){
		if (historyPollTimer){
			clearInterval(historyPollTimer);
			historyPollTimer = null;
		}
		historyPollStartedAt = 0;
	}

	function getChatInput(){
		try {
			var selectors = [
				'[aria-label="Chat message input"][contenteditable="true"][role="textbox"]',
				'[aria-label="Chat message input"][contenteditable="true"]',
				'[role="textbox"][contenteditable="true"][data-placeholder]'
			];
			for (var i = 0; i < selectors.length; i++){
				var inputs = document.querySelectorAll(selectors[i]);
				if (inputs && inputs.length){
					return inputs[inputs.length - 1];
				}
			}
		} catch(e){
		}
		return null;
	}

	function getChatMessageRoot(ele){
		if (!ele || !ele.isConnected || !ele.querySelector){ return null; }
		if (ele.classList && ele.classList.contains("chat-message-content")){
			return ele;
		}
		return ele.querySelector(".chat-message-content");
	}

	function getChatMessageRow(ele){
		var root = getChatMessageRoot(ele);
		if (!root){ return null; }
		if (root.closest){
			var row = root.closest(".group");
			if (row){ return row; }
		}
		return root.parentNode || root;
	}
	
	function processMessage(ele){
		var row = getChatMessageRow(ele);
		var root = getChatMessageRoot(ele);
		if (!row || !root){
			return;
		}
		
		if (row.skip || root.skip){
			return;
		}

		var inlineEl = null;
		try {
			inlineEl = root.querySelector("span.inline");
		} catch(e){
		}
		if (!inlineEl){
			return;
		}
		
		var chatimg = "";
		
		var name="";
		var nameEl = null;
		try {
			nameEl = inlineEl.querySelector("button");
			if (nameEl) {
				name = escapeHtml(nameEl.textContent.replace(/:\s*$/, "").trim());
			}
		} catch(e){
		}
		
		var namecolor="";
		try {
			if (nameEl){
				namecolor = nameEl.style.color || "";
				if (!namecolor && window.getComputedStyle){
					namecolor = window.getComputedStyle(nameEl).color || "";
				}
			}
		} catch(e){
		}
		
		var badges=[];
		try {
			for (var i = 0; i < inlineEl.childNodes.length; i++){
				var badge = inlineEl.childNodes[i];
				if (badge === nameEl){
					break;
				}
				if ((badge.nodeType === 1) && (badge.nodeName === "IMG") && badge.src){
					badges.push(badge.src + "");
				}
			}
		} catch(e){
		} 

		var timeText = "";
		try {
			for (var j = 0; j < inlineEl.childNodes.length; j++){
				var timeNode = inlineEl.childNodes[j];
				if (timeNode === nameEl){
					break;
				}
				if ((timeNode.nodeType === 1) && (timeNode.nodeName === "SPAN") && timeNode.textContent){
					timeText = timeNode.textContent.trim();
					if (timeText){
						break;
					}
				}
			}
		} catch(e){
		}

		var msg="";
		try {
			var msgEl = nameEl ? nameEl.nextElementSibling : null;
			if (!msgEl && nameEl && nameEl.parentNode && nameEl.parentNode.querySelector){
				msgEl = nameEl.parentNode.querySelector("button + span");
			}
			if (msgEl) {
				msg = getAllContentNodes(msgEl).trim();
			}
		} catch(e){
		}
		
		
		var donation = "";
		try {
			donation = escapeHtml(row.querySelector(".flex-1.space-y-2 svg>path[d='m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z']").parentNode.nextSibling.textContent);
			if (msg){
				msg = msg.replaceAll('“',"").replaceAll('”',"").trim(); 
			}
		} catch(e){
		}
		
		if (!name || (!msg && !donation)){
	//		console.log("no name");
			return;
		}
		
		var msgKey = "chat|\u00b6|" + timeText + "|\u00b6|" + name + "|\u00b6|" + msg;
		var contentKey = getMessageContentKey(getVeloraHistoryChannel(), name, msg);
		if (!rememberMessageKey(msgKey)){
			row.skip = true;
			root.skip = true;
			return;
		}
		if (contentKey && !rememberRecentMessageContent(contentKey)){
			row.skip = true;
			root.skip = true;
			return;
		}
		
		row.skip = true;
		root.skip = true;
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = donation;
		data.membership = "";
		data.contentimg = "";
		data.textonly = isTextOnlyMode();
		data.type = "velora";
		
		
		pushMessage(data);
	}

	function makeBaseData(){
		return {
			chatbadges: [],
			backgroundColor: "",
			textColor: "",
			nameColor: "",
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: isTextOnlyMode(),
			type: "velora"
		};
	}

	function rememberEvent(key, row){
		key = String(key || "").replace(/\s+/g, " ").trim();
		if (!key || processedEvents.has(key)){
			if (row){ row.skip = true; }
			return false;
		}
		processedEvents.add(key);
		if (processedEvents.size > 200){
			processedEvents.delete(processedEvents.values().next().value);
		}
		if (row){ row.skip = true; }
		return true;
	}

	function nearestVeloraEventRow(ele){
		if (!ele || !ele.closest){ return null; }
		return ele.closest(".mx-1.my-1\\.5") || ele.closest("[class*='mx-1'][class*='my-1.5']") || ele.closest(".group") || ele;
	}

	function parseVoltsEvent(row){
		var amountNode = null;
		var nameNode = null;
		try {
			var spans = Array.from(row.querySelectorAll("span"));
			amountNode = spans.find(function(span){
				return /\b\d[\d,.]*\s*V(?:olts?)?\b/i.test((span.textContent || "").trim());
			}) || null;
			if (!amountNode){ return null; }
			nameNode = spans.find(function(span){
				var text = (span.textContent || "").trim();
				return text && span !== amountNode && !/\b\d[\d,.]*\s*V(?:olts?)?\b/i.test(text);
			}) || null;
		} catch(e){
			return null;
		}
		var amountText = amountNode ? (amountNode.textContent || "").trim() : "";
		var name = nameNode ? (nameNode.textContent || "").trim() : "";
		if (!name || !amountText){ return null; }
		var data = makeBaseData();
		data.chatname = escapeHtml(name);
		data.chatmessage = "";
		data.hasDonation = escapeHtml(amountText.replace(/\bV\b/i, "Volts"));
		data.event = "volts";
		data.meta = {
			amountText: amountText,
			source: "dom"
		};
		return data;
	}

	function parseChannelPointsEvent(row){
		var labelNode = null;
		var valueNode = null;
		try {
			var divs = Array.from(row.querySelectorAll("div"));
			labelNode = divs.find(function(div){
				return /\bsays\b/i.test((div.textContent || "").trim()) && (div.textContent || "").trim().length < 80;
			}) || null;
			if (!labelNode){ return null; }
			valueNode = labelNode.parentElement ? Array.from(labelNode.parentElement.querySelectorAll("span")).find(function(span){
				return (span.textContent || "").trim();
			}) : null;
		} catch(e){
			return null;
		}
		var label = labelNode ? (labelNode.textContent || "").trim() : "";
		var match = label.match(/^(.+?)\s+says$/i);
		var name = match && match[1] ? match[1].trim() : "";
		var message = valueNode ? getAllContentNodes(valueNode).trim() : "";
		if (!name || !message){ return null; }
		var data = makeBaseData();
		data.chatname = escapeHtml(name);
		data.chatmessage = message;
		data.event = "channel_points";
		data.meta = {
			rewardTitle: "Says",
			source: "dom"
		};
		return data;
	}

	function parseSimpleActivityEvent(row){
		var text = (row && row.textContent || "").replace(/\s+/g, " ").trim();
		var match;
		var data;
		if (!text){ return null; }
		match = text.match(/^(.+?)\s+just became a\s+(.+?)!?$/i);
		if (!match){ return null; }
		data = makeBaseData();
		data.chatname = escapeHtml(match[1].trim());
		data.chatmessage = escapeHtml("became a " + match[2].trim());
		data.membership = escapeHtml(match[2].trim());
		data.event = "subscription";
		data.meta = { source: "dom" };
		return data;
	}

	function processEventNode(ele){
		var row = nearestVeloraEventRow(ele);
		var data;
		if (!row || row.skip || getChatMessageRoot(row)){ return; }
		data = parseVoltsEvent(row) || parseChannelPointsEvent(row) || parseSimpleActivityEvent(row);
		if (!data){ return; }
		if (!rememberEvent("event|\u00b6|" + (data.event || "") + "|\u00b6|" + (data.chatname || "") + "|\u00b6|" + (data.chatmessage || "") + "|\u00b6|" + (data.hasDonation || "") + "|\u00b6|" + (row.textContent || ""), row)){
			return;
		}
		pushMessage(data);
	}

	function scanExistingChat(container){
		if (!container || !container.querySelectorAll){ return; }
		try {
			container.querySelectorAll(".chat-message-content").forEach(function(chatNode){
				processMessage(chatNode);
			});
		} catch(e){
		}
		try {
			container.querySelectorAll(".mx-1.my-1\\.5, [class*='mx-1'][class*='my-1.5'], .flex.items-baseline").forEach(function(eventNode){
				processEventNode(eventNode);
			});
		} catch(e){
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	var cachedViewerEl = null;
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				
				
				if (!cachedViewerEl || !cachedViewerEl.isConnected){
					cachedViewerEl = null;
					var els = document.querySelectorAll("div, span");
					for (var i = 0; i < els.length; i++){
						var el = els[i];
						if (!el.childElementCount && /^[\d,.]+[km]?\s+viewers?$/i.test(el.textContent.trim())){
							cachedViewerEl = el;
							break;
						}
					}
				}
				
				if (cachedViewerEl && cachedViewerEl.textContent){
					let views = cachedViewerEl.textContent.toUpperCase();
					let multiplier = 1;
					if (views.includes("K")){
						multiplier = 1000;
						views = views.replace("K","");
					} else if (views.includes("M")){
						multiplier = 1000000;
						views = views.replace("M","");
					}
					views = views.split(" ")[0];
					if (views == parseFloat(views)){
						views = parseFloat(views) * multiplier;
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: 'velora',
									event: 'viewer_update',
									meta: views
								}
							}),
							function (e) {}
						);
					}
				}
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
				
				if ("getSource" == request){sendResponse("velora");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					var chatInput = getChatInput();
					if(chatInput && chatInput.focus){
						chatInput.focus();
					}
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
						startCheck();
					
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
	var observerTarget = null;
	
	
	function onElementInserted(target, subtree=false) {
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
								if (getChatMessageRoot(addedNode)){
									processMessage(addedNode);
								} else if (addedNode.querySelectorAll){
									addedNode.querySelectorAll(".chat-message-content").forEach(function(chatNode){
										processMessage(chatNode);
									});
								}
								processEventNode(addedNode);
								if (addedNode.querySelectorAll){
									addedNode.querySelectorAll(".mx-1.my-1\\.5, [class*='mx-1'][class*='my-1.5'], .flex.items-baseline").forEach(function(eventNode){
										processEventNode(eventNode);
									});
								}
							},300);

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: subtree };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
		}
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	function isVeloraPopoutRoute(){
		try {
			return /\/dashboard\/stream\/popout(?:\/|$)/i.test(window.location.pathname || "");
		} catch(e){
		}
		return false;
	}

	function findPopoutChatScroller(){
		if (!isVeloraPopoutRoute()){
			return null;
		}
		try {
			var containers = document.querySelectorAll(".overflow-y-auto, [class*='overflow-y-auto']");
			var best = null;
			var bestScore = 0;
			for (var i = 0; i < containers.length; i++){
				var container = containers[i];
				var score = 0;
				var text = "";
				var className = "";
				try {
					text = (container.textContent || "").replace(/\s+/g, " ").trim();
					className = String(container.className || "");
				} catch(e){
				}
				if (container.querySelector && container.querySelector(".chat-message-content")){ score += 100; }
				if (/No messages yet|Connecting to chat|New messages/i.test(text)){ score += 45; }
				if (/Activity will appear here|transactions|followers|subscribers/i.test(text)){ score -= 30; }
				if (className.indexOf("px-1") !== -1 && className.indexOf("pb-1") !== -1){ score += 30; }
				if (className.indexOf("scrollbar-thumb-white/10") !== -1){ score += 25; }
				if (className.indexOf("scrollbar-thin") !== -1){ score += 5; }
				if (score > bestScore){
					bestScore = score;
					best = container;
				}
			}
			if (best && bestScore > 0){
				return best;
			}
			return document.body || null;
		} catch(e){
		}
		return null;
	}

	function findScrollerNearInput(input){
		if (!input){ return null; }
		var node = input;
		var fallback = null;
		var depth = 0;
		while (node && depth < 10){
			try {
				if (node.querySelectorAll){
					var containers = node.querySelectorAll(".overflow-y-auto, [class*='overflow-y-auto']");
					for (var i = 0; i < containers.length; i++){
						var container = containers[i];
						if (!container || container === input){ continue; }
						if (container.contains && container.contains(input)){ continue; }
						if (!fallback){ fallback = container; }
						var text = (container.textContent || "").replace(/\s+/g, " ").trim();
						var className = "";
						try {
							className = String(container.className || "");
						} catch(e){
						}
						if (container.querySelector(".chat-message-content") || /No messages yet|Connecting to chat|New messages/i.test(text) || className.indexOf("scrollbar-thin") !== -1){
							return container;
						}
					}
				}
			} catch(e){
			}
			node = node.parentElement;
			depth++;
		}
		return fallback;
	}

	function findChatContainer(){
		try {
			var root = document.querySelector(".chat-message-content");
			if (root && root.closest){
				var container = root.closest(".overflow-y-auto");
				if (container){
					return container;
				}
			}
		} catch(e){
		}
		try {
			var input = getChatInput();
			var inputContainer = findScrollerNearInput(input);
			if (inputContainer){
				return inputContainer;
			}
		} catch(e){
		}
		try {
			var popoutContainer = findPopoutChatScroller();
			if (popoutContainer){
				return popoutContainer;
			}
		} catch(e){
		}
		return null;
	}


	function startCheck(){
		if (isExtensionOn && checking){return;}

		clearInterval(checking);
		checking = false;
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
			observer = null;
			observerTarget = null;
		}
		if (!isExtensionOn){
			stopHistoryPolling();
			return;
		}
		historyFallbackMisses = 0;
		startHistoryPolling();
		checking = setInterval(function(){
			try {
				var container = findChatContainer();
				
				if (!container){
					historyFallbackMisses++;
					return;
				}
				var skipInitialScan = false;
				historyFallbackMisses = 0;
				
				if (observerTarget !== container){
					observerTarget = container;
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(skipScan){
						dataIndex = 0;
						onElementInserted(container, true);
						if (!skipScan){
							scanExistingChat(container);
						}
					},1000, skipInitialScan);
				}
				checkViewers();
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
