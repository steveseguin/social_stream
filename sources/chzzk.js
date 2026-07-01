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

	function escapeHtml(unsafe){ // success is when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}
	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.nodeType===3){
				return escapeHtml(element.textContent) || "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
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

	var CHAT_WRAPPER_SELECTOR = "[class*='live_chatting_list_wrapper__'], [class^='live_chatting_list_wrapper']";
	var CHAT_ITEM_SELECTOR = "[class*='live_chatting_list_item__'], [class^='live_chatting_list_item'], [class*='_chatting_message_'], [class*='_container_y6h6c_']";
	var CHAT_NAME_SELECTOR = "[class*='live_chatting_username_nickname__'], [class^='live_chatting_username_nickname']";
	var CHAT_TEXT_SELECTOR = "[class*='live_chatting_message_text__'], [class^='live_chatting_message_text'], [class*='live_chatting_donation_message_text__'], [class^='live_chatting_donation_message_text']";
	var CHAT_DONATION_AMOUNT_SELECTOR = "[class*='live_chatting_donation_message_money__'], [class^='live_chatting_donation_message_money']";
	var CHAT_BADGE_SELECTOR = "[class*='badge_container'] img[src], [class*='live_chatting_badge'] img[src], button[class*='_nickname_'] img[src], button[class*='_profile_button_'] img[src]";
	var DUPLICATE_WINDOW_MS = 1200;
	var INITIAL_BACKLOG_SUPPRESS_MS = 10000;
	var startupSuppressUntil = Date.now() + INITIAL_BACKLOG_SUPPRESS_MS;
	var recentlySeenMessages = new Map();
	var viewerCountInterval = null;
	var viewerCountInFlight = false;
	var lastViewerCount = null;

	function shouldSkipDuplicate(name, msg){
		var now = Date.now();
		var key = name + "::" + msg;
		var previousSeenAt = recentlySeenMessages.get(key);
		recentlySeenMessages.set(key, now);

		if (recentlySeenMessages.size > 200){
			recentlySeenMessages.forEach(function(timestamp, cacheKey){
				if ((now - timestamp) > (DUPLICATE_WINDOW_MS * 2)){
					recentlySeenMessages.delete(cacheKey);
				}
			});
		}

		return !!previousSeenAt && ((now - previousSeenAt) < DUPLICATE_WINDOW_MS);
	}

	function getNewChatMessageElement(ele){
		if (!ele || !ele.querySelector){
			return null;
		}
		if (ele.matches && ele.matches("[class*='_chatting_message_']")){
			return ele;
		}
		return ele.querySelector("[class*='_chatting_message_']");
	}

	function getNameElement(ele){
		var nameEle = ele.querySelector(CHAT_NAME_SELECTOR);
		if (!nameEle){
			var messageEle = getNewChatMessageElement(ele);
			if (messageEle){
				nameEle = messageEle.querySelector("button[class*='_nickname_']");
			}
		}
		return nameEle;
	}

	function getNameColor(nameEle){
		if (!nameEle){
			return "";
		}
		if (nameEle.style && nameEle.style.color){
			return nameEle.style.color;
		}
		try {
			var coloredName = nameEle.querySelector("[style*='color']");
			if (coloredName && coloredName.style && coloredName.style.color){
				return coloredName.style.color;
			}
		} catch(e){}
		return "";
	}

	function getNewChatMessageText(ele){
		var messageEle = getNewChatMessageElement(ele);
		if (!messageEle){
			return "";
		}
		try {
			var clone = messageEle.cloneNode(true);
			clone.querySelectorAll("button[class*='_nickname_']").forEach(function(node){
				node.remove();
			});
			return getAllContentNodes(clone);
		} catch(e){
			return "";
		}
	}

	function getCurrentDonationElement(ele){
		if (!ele || ele.nodeType !== 1 || !ele.querySelector){
			return null;
		}
		if (ele.matches && ele.matches("[class*='_container_y6h6c_']")){
			return ele;
		}
		var donationEle = ele.querySelector("[class*='_container_y6h6c_']");
		if (donationEle){
			return donationEle;
		}
		var profileButton = ele.querySelector("button[class*='_profile_button_']");
		var moneyEle = ele.querySelector("[class*='_money_']");
		if (profileButton && moneyEle){
			return ele;
		}
		return null;
	}

	function getDonationTextElement(ele, profileButton, moneyEle){
		var textNodes = ele.querySelectorAll("[class*='_text_'], p");
		for (var i = 0; i < textNodes.length; i++){
			var node = textNodes[i];
			if (!node || (profileButton && profileButton.contains(node)) || (moneyEle && moneyEle.contains(node))){
				continue;
			}
			if ((node.textContent || "").trim()){
				return node;
			}
		}
		return null;
	}

	function getDonationAmount(moneyEle){
		if (!moneyEle){
			return "";
		}
		var amountClone = moneyEle.cloneNode(true);
		try {
			amountClone.querySelectorAll(".blind, [class*='blind']").forEach(function(hiddenNode){
				hiddenNode.remove();
			});
		} catch(e){}
		var amount = (amountClone.textContent || "").replace(/\s+/g, "").replace(/[^0-9.,]/g, "").trim();
		if (!amount){
			return "";
		}
		return escapeHtml(amount + " \uCE58\uC988");
	}

	function parseCurrentDonationMessage(ele){
		var donationEle = getCurrentDonationElement(ele);
		if (!donationEle){
			return null;
		}
		var profileButton = donationEle.querySelector("button[class*='_profile_button_']");
		var moneyEle = donationEle.querySelector("[class*='_money_']");
		var name = "";
		var namecolor = "";
		var msg = "";
		var badges = [];

		if (profileButton){
			name = escapeHtml((profileButton.textContent || "").trim());
			try {
				var coloredName = profileButton.querySelector("[style*='color']");
				if (coloredName && coloredName.style && coloredName.style.color){
					namecolor = coloredName.style.color;
				}
			} catch(e){}
			try {
				profileButton.querySelectorAll("img[src]").forEach(function(badge){
					badges.push(badge.src);
				});
			} catch(e){}
		}

		var textEle = getDonationTextElement(donationEle, profileButton, moneyEle);
		if (textEle){
			msg = getAllContentNodes(textEle).trim();
		}

		var hasDonation = getDonationAmount(moneyEle);
		if (!name || (!msg && !hasDonation)){
			return null;
		}

		return {
			chatname: name,
			chatbadges: badges,
			backgroundColor: "",
			textColor: "",
			chatmessage: msg,
			nameColor: namecolor,
			chatimg: "",
			hasDonation: hasDonation,
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "chzzk"
		};
	}
	
	
	function processMessage(ele, force){
		if (!ele || ele.nodeType !== 1 || !ele.querySelector){
			return;
		}
		if (!force && ele.dataset && ele.dataset.ssnProcessed === "1"){
			return;
		}
		if (Date.now() < startupSuppressUntil){
			if (ele.dataset){
				ele.dataset.ssnProcessed = "1";
			}
			return;
		}

		var donationData = parseCurrentDonationMessage(ele);
		if (donationData){
			var donationSignature = donationData.chatname + "::" + donationData.chatmessage + "::" + donationData.hasDonation;
			if (ele.dataset && ele.dataset.ssnLastMessageSignature === donationSignature){
				ele.dataset.ssnProcessed = "1";
				return;
			}
			if (shouldSkipDuplicate(donationData.chatname, donationData.chatmessage + "::" + donationData.hasDonation)){
				if (ele.dataset){
					ele.dataset.ssnLastMessageSignature = donationSignature;
					ele.dataset.ssnProcessed = "1";
				}
				return;
			}
			if (ele.dataset){
				ele.dataset.ssnLastMessageSignature = donationSignature;
				ele.dataset.ssnProcessed = "1";
			}
			pushMessage(donationData);
			return;
		}

		var badges = [];
		try{
			 ele.querySelectorAll(CHAT_BADGE_SELECTOR).forEach(b=>{
				if (badges.indexOf(b.src) === -1){
					badges.push(b.src);
				}
			});
		} catch(e){
		}
		
		var name="";
		var namecolor = "";
		try {
			var nameEle = getNameElement(ele);
			if (!nameEle){
				return;
			}
			namecolor = getNameColor(nameEle);
			name = nameEle.textContent.trim();
			name = escapeHtml(name);
		} catch(e){
			
		}
		var msg="";
		try {
			ele.querySelectorAll(CHAT_TEXT_SELECTOR).forEach(xx=>{
				msg+= getAllContentNodes(xx);
			});
			if (!msg){
				msg = getNewChatMessageText(ele);
			}
		} catch(e){
		}
		msg = msg.trim();

		var hasDonation = "";
		try {
			var donationAmountEle = ele.querySelector(CHAT_DONATION_AMOUNT_SELECTOR);
			if (donationAmountEle){
				var donationUnit = "";
				var donationUnitEle = donationAmountEle.querySelector(".blind, [class*='blind']");
				if (donationUnitEle && donationUnitEle.textContent){
					donationUnit = donationUnitEle.textContent.trim();
				}
				var amountClone = donationAmountEle.cloneNode(true);
				amountClone.querySelectorAll(".blind, [class*='blind']").forEach(function(hiddenNode){
					hiddenNode.remove();
				});
				var donationAmount = (amountClone.textContent || "").replace(/\s+/g, "").replace(/[^0-9.,]/g, "").trim();
				if (donationAmount){
					if (!donationUnit){
						donationUnit = "치즈";
					}
					hasDonation = escapeHtml(donationAmount + " " + donationUnit);
				}
			}
		} catch(e){
		}

		if (!name || (!msg && !hasDonation)){
			return;
		}
		var messageSignature = name + "::" + msg + "::" + hasDonation;
		if (ele.dataset && ele.dataset.ssnLastMessageSignature === messageSignature){
			if (ele.dataset){
				ele.dataset.ssnProcessed = "1";
			}
			return;
		}
		if (shouldSkipDuplicate(name, msg + "::" + hasDonation)){
			if (ele.dataset){
				ele.dataset.ssnLastMessageSignature = messageSignature;
				ele.dataset.ssnProcessed = "1";
			}
			return;
		}
		if (ele.dataset){
			ele.dataset.ssnLastMessageSignature = messageSignature;
			ele.dataset.ssnProcessed = "1";
		}
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.nameColor = namecolor;
		data.chatimg = "";
		data.hasDonation = hasDonation;
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "chzzk";
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			if (!isExtensionOn){return;}
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}

	function getChannelIdFromUrl(){
		try {
			var match = window.location.pathname.match(/\/(?:iframe\/)?live\/([^\/?#]+)\/chat/);
			return match ? match[1] : "";
		} catch(e){
			return "";
		}
	}

	function sendViewerCount(count){
		var parsedCount = parseInt(count, 10);
		if (parsedCount !== parsedCount || parsedCount === lastViewerCount){
			return;
		}
		lastViewerCount = parsedCount;
		pushMessage({
			type: "chzzk",
			event: "viewer_update",
			meta: parsedCount
		});
	}

	function checkViewers(){
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode) || viewerCountInFlight){
			return;
		}
		var channelId = getChannelIdFromUrl();
		if (!channelId){
			return;
		}
		viewerCountInFlight = true;
		fetch("https://api.chzzk.naver.com/polling/v3.1/channels/" + encodeURIComponent(channelId) + "/live-status?includePlayerRecommendContent=false", {
			headers: {
				"front-client-platform-type": "PC",
				"front-client-product-type": "web",
				"if-modified-since": "Mon, 26 Jul 1997 05:00:00 GMT"
			}
		}).then(function(response){
			if (!response.ok){
				throw new Error("CHZZK viewer count HTTP " + response.status);
			}
			return response.json();
		}).then(function(response){
			if (response && response.content && typeof response.content.concurrentUserCount !== "undefined"){
				sendViewerCount(response.content.concurrentUserCount);
			}
		}).catch(function(){}).finally(function(){
			viewerCountInFlight = false;
		});
	}

	function startViewerCountInterval(){
		if (viewerCountInterval){
			return;
		}
		viewerCountInterval = setInterval(checkViewers, 60000);
		checkViewers();
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("state" in response){
			isExtensionOn = response.state;
		}
		if ("settings" in response){
			settings = response.settings;
			startViewerCountInterval();
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("chzzk");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('textarea').focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request){
						isExtensionOn = request.state;
						sendResponse(true);
						return;
					}
					if ("settings" in request){
						settings = request.settings;
						startViewerCountInterval();
						checkViewers();
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
	var observedTarget = null;
	var didInitialBacklogSkip = false;

	function forEachMessageNode(node, callback){
		if (!node || node.nodeType !== 1){
			return;
		}
		if (getCurrentDonationElement(node)){
			callback(node);
			return;
		}
		if (node.matches && node.matches(CHAT_ITEM_SELECTOR)){
			callback(node);
		}
		if (node.querySelectorAll){
			node.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function(item){
				callback(item);
			});
		}
	}

	function getMessageItemFromNode(node){
		if (!node){
			return null;
		}
		var element = null;
		if (node.nodeType === 1){
			element = node;
		} else if (node.parentElement){
			element = node.parentElement;
		}
		if (!element){
			return null;
		}
		if (element.matches && element.matches(CHAT_ITEM_SELECTOR)){
			return element;
		}
		if (element.closest){
			return element.closest(CHAT_ITEM_SELECTOR);
		}
		return null;
	}

	function markExistingMessagesProcessed(target){
		try{
			target.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function(item){
				if (item.dataset){
					item.dataset.ssnProcessed = "1";
				}
			});
		} catch(e){}
	}

	function scanUnprocessedMessages(target){
		if (!target || !target.querySelectorAll){
			return;
		}
		try{
			target.querySelectorAll(CHAT_ITEM_SELECTOR).forEach(function(item){
				processMessage(item);
			});
		} catch(e){}
	}

	function getChatWrapper(){
		var chatWrapper = document.querySelector(CHAT_WRAPPER_SELECTOR);
		if (chatWrapper){
			return chatWrapper;
		}
		try {
			var messageEle = document.querySelector("[class*='_chatting_message_']");
			if (messageEle && messageEle.closest){
				return messageEle.closest("[class*='_wrapper_']") || messageEle.parentElement;
			}
		} catch(e){}
		return null;
	}
	
	
	function onElementInserted(target) {
		if (!target){return;}
		
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							forEachMessageNode(mutation.addedNodes[i], processMessage);
						} catch(e){}
					}
				}
				if (mutation.type === "childList" || mutation.type === "characterData" || mutation.type === "attributes"){
					try {
						var mutatedMessageItem = getMessageItemFromNode(mutation.target);
						if (mutatedMessageItem){
							processMessage(mutatedMessageItem, true);
						}
					} catch(e){}
				}
			});
		};
		
		var config = {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "style"]
		};
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			var chatWrapper = getChatWrapper();
			if (!chatWrapper){
				return;
			}

			if (observedTarget !== chatWrapper){
				if (observer){
					try {
						observer.disconnect();
					} catch(e){}
				}
				observedTarget = chatWrapper;
				if (!didInitialBacklogSkip){
					markExistingMessagesProcessed(chatWrapper); // skip initial backlog only once
				}
				onElementInserted(chatWrapper);
				if (!didInitialBacklogSkip){
					didInitialBacklogSkip = true;
				}
				console.log("CONNECTED chat detected");
			}

			scanUnprocessedMessages(chatWrapper); // fallback in case a DOM update bypassed mutation delivery
		} catch(e){}
	},1500);
	
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
	
	function simulateFocus(element) {
		// Create and dispatch focusin event
		const focusInEvent = new FocusEvent('focusin', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		element.dispatchEvent(focusInEvent);

		// Create and dispatch focus event
		const focusEvent = new FocusEvent('focus', {
			view: window,
			bubbles: false,
			cancelable: true
		});
		element.dispatchEvent(focusEvent);
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
