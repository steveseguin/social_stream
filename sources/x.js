(function () {
	 
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
	
	function isColorVeryDark(color) {
		const rgb = color.match(/\d+/g).map(Number);

		const R = rgb[0] / 255;
		const G = rgb[1] / 255;
		const B = rgb[2] / 255;

		const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;

		const darkThreshold = 0.2; 

		return luminance < darkThreshold;
	}

	const MESSAGE_KEY_TTL = 5 * 60 * 1000;
	const MAX_MESSAGE_KEYS = 500;
	var seenMessageKeys = new Map();
	var pendingMessageNodes = new WeakSet();
	var messageRetryCounts = new WeakMap();
	var observedContainer = null;

	function pruneSeenMessageKeys() {
		const cutoff = Date.now() - MESSAGE_KEY_TTL;
		seenMessageKeys.forEach(function(timestamp, key){
			if (!timestamp || (timestamp < cutoff)) {
				seenMessageKeys.delete(key);
			}
		});
		while (seenMessageKeys.size > MAX_MESSAGE_KEYS) {
			const oldestKey = seenMessageKeys.keys().next().value;
			if (typeof oldestKey === "undefined") {
				break;
			}
			seenMessageKeys.delete(oldestKey);
		}
	}

	function normalizeMessageKey(value) {
		return String(value || "").replace(/\s+/g, " ").trim();
	}

	function isLikelyTimeLabel(value) {
		const text = normalizeMessageKey(value).toLowerCase();
		if (!text) {
			return false;
		}
		return /^\d{1,2}:\d{2}\s?(am|pm)$/.test(text);
	}

	function rememberMessageKey(key) {
		if (!key) {
			return;
		}
		if (seenMessageKeys.has(key)) {
			seenMessageKeys.delete(key);
		}
		seenMessageKeys.set(key, Date.now());
		pruneSeenMessageKeys();
	}

	function hasSeenMessageKey(key) {
		if (!key) {
			return false;
		}
		pruneSeenMessageKeys();
		if (!seenMessageKeys.has(key)) {
			return false;
		}
		rememberMessageKey(key);
		return true;
	}

	function getAvatarContainer(ele) {
		if (!ele || (ele.nodeType !== 1)) {
			return null;
		}
		if (ele.matches && ele.matches("[data-testid^='UserAvatar-Container-']")) {
			return ele;
		}
		try {
			return ele.querySelector("[data-testid^='UserAvatar-Container-']");
		} catch(e) {
			return null;
		}
	}

	function getChatComposer(root) {
		const scope = root && root.querySelector ? root : document;
		try {
			return scope.querySelector("textarea[aria-label='Send a message'], textarea[placeholder='Send a message'], textarea[inputmode='text']");
		} catch(e) {
			return null;
		}
	}

	function getAvatarContainers(root) {
		if (!root || !root.querySelectorAll) {
			return [];
		}
		try {
			return root.querySelectorAll("[data-testid^='UserAvatar-Container-']");
		} catch(e) {
			return [];
		}
	}

	function getLegacyDisplayNameElement(ele) {
		if (!ele || !ele.querySelector) {
			return null;
		}
		try {
			return ele.querySelector("span[style*='color']");
		} catch(e) {
			return null;
		}
	}

	function getDisplayNameElement(ele) {
		if (!ele || !ele.querySelectorAll) {
			return getLegacyDisplayNameElement(ele);
		}
		try {
			const candidates = ele.querySelectorAll("a[href^='/'] span");
			for (let i = 0; i < candidates.length; i++) {
				const candidate = candidates[i];
				const text = (candidate.textContent || "").trim();
				if (!text || text.startsWith("@")) {
					continue;
				}
				if (candidate.closest("[data-testid^='UserAvatar-Container-']")) {
					continue;
				}
				return candidate;
			}
		} catch(e) {}
		return getLegacyDisplayNameElement(ele);
	}

	function getLegacyMessageContentNode(ele) {
		if (!ele) {
			return null;
		}
		try {
			if (ele.childNodes && (ele.childNodes.length > 1) && ele.childNodes[1]) {
				return ele.childNodes[1];
			}
		} catch(e) {}
		try {
			const button = ele.querySelector ? ele.querySelector("button") : null;
			if (button) {
				return button;
			}
		} catch(e) {}
		try {
			if (ele.querySelectorAll) {
				const spans = ele.querySelectorAll("span");
				if (spans.length) {
					return spans[spans.length - 1];
				}
			}
		} catch(e) {}
		return null;
	}

	function getMessageContentNode(ele) {
		if (!ele || !ele.querySelectorAll) {
			return getLegacyMessageContentNode(ele);
		}
		try {
			const spans = ele.querySelectorAll("span");
			let candidate = null;
			let bestScore = 0;
			for (let i = 0; i < spans.length; i++) {
				const span = spans[i];
				if (span.closest("a[href^='/']")) {
					continue;
				}
				if (span.closest("[data-testid^='UserAvatar-Container-']")) {
					continue;
				}
				if (span.closest("button")) {
					continue;
				}
				if (span.querySelector("[data-testid='icon-verified']")) {
					continue;
				}
				const hasImage = !!span.querySelector("img[src]");
				const text = (span.textContent || "").trim();
				if (!text && !hasImage) {
					continue;
				}
				const content = normalizeMessageKey(getAllContentNodes(span));
				const score = content.length + (hasImage ? 25 : 0);
				if ((score >= bestScore) || !candidate) {
					bestScore = score;
					candidate = span;
				}
			}
			if (candidate) {
				return candidate;
			}
		} catch(e) {}
		return getLegacyMessageContentNode(ele);
	}

	function isLikelyLegacyMessageRow(ele) {
		if (!ele || (ele.nodeType !== 1)) {
			return false;
		}
		try {
			if (!getLegacyDisplayNameElement(ele)) {
				return false;
			}
			const messageNode = getLegacyMessageContentNode(ele);
			if (!messageNode) {
				return false;
			}
			const messageText = normalizeMessageKey(getAllContentNodes(messageNode));
			return !!messageText;
		} catch(e) {}
		return false;
	}

	function isLikelyMessageRow(ele) {
		if (!ele || (ele.nodeType !== 1) || !ele.querySelectorAll) {
			return false;
		}
		try {
			if (ele.querySelectorAll("[data-testid^='UserAvatar-Container-']").length !== 1) {
				return false;
			}
			if (!getDisplayNameElement(ele)) {
				return false;
			}
			if (!getMessageContentNode(ele)) {
				return false;
			}
			return true;
		} catch(e) {}
		return false;
	}

	function findLegacyMessageRow(ele) {
		let current = ele;
		while (current && (current.nodeType === 1)) {
			if (isLikelyLegacyMessageRow(current)) {
				return current;
			}
			const parent = current.parentElement;
			if (!parent || (parent === document.body)) {
				break;
			}
			if (getChatComposer(parent)) {
				break;
			}
			current = parent;
		}
		return isLikelyLegacyMessageRow(ele) ? ele : null;
	}

	function getMessageRow(ele) {
		const avatar = getAvatarContainer(ele);
		if (!avatar) {
			return findLegacyMessageRow(ele);
		}
		let current = avatar;
		let lastMatch = null;
		while (current && (current.nodeType === 1)) {
			if (isLikelyMessageRow(current)) {
				lastMatch = current;
			}
			const parent = current.parentElement;
			if (!parent) {
				break;
			}
			try {
				if (parent.querySelectorAll("[data-testid^='UserAvatar-Container-']").length > 1) {
					break;
				}
			} catch(e) {}
			if (parent.matches && parent.matches('[data-testid="chatContainer"]')) {
				break;
			}
			if (getChatComposer(parent)) {
				break;
			}
			current = parent;
		}
		return lastMatch;
	}

	function getUsernameFromRow(row) {
		if (!row || !row.querySelectorAll) {
			return "";
		}
		try {
			const explicitLinks = row.querySelectorAll("a[href^='/'] span");
			for (let i = 0; i < explicitLinks.length; i++) {
				const text = (explicitLinks[i].textContent || "").trim();
				if (text.startsWith("@")) {
					return escapeHtml(text.replace(/^@+/, ""));
				}
			}
		} catch(e) {}
		try {
			const avatar = getAvatarContainer(row);
			if (!avatar) {
				throw new Error("Missing avatar container");
			}
			const avatarId = avatar.getAttribute("data-testid") || "";
			if (avatarId.startsWith("UserAvatar-Container-")) {
				return escapeHtml(avatarId.replace("UserAvatar-Container-", ""));
			}
		} catch(e) {}
		try {
			const nameElement = getDisplayNameElement(row);
			if (nameElement && nameElement.parentNode && nameElement.parentNode.parentNode && nameElement.parentNode.parentNode.nextSibling) {
				const fallbackUsername = escapeHtml(nameElement.parentNode.parentNode.nextSibling.textContent.trim());
				if (fallbackUsername.startsWith("@")) {
					return fallbackUsername.replace(/^@+/, "");
				}
			}
		} catch(e) {}
		return "";
	}

	function buildMessageKey(row, username, chatname, msg) {
		let avatarKey = "";
		try {
			const avatar = getAvatarContainer(row);
			if (avatar) {
				avatarKey = avatar.getAttribute("data-testid") || "";
			}
		} catch(e) {}
		return [
			avatarKey,
			String(username || chatname || "").toLowerCase(),
			normalizeMessageKey(msg)
		].join("|");
	}

	function buildMessageKeyFromRow(row) {
		try {
			if (!row || !row.querySelectorAll) {
				return "";
			}
			const nameElement = getDisplayNameElement(row);
			const messageNode = getMessageContentNode(row);
			if (!nameElement || !messageNode) {
				return "";
			}
			const chatname = escapeHtml((nameElement.textContent || "").trim().split(":")[0] || "");
			const msg = normalizeMessageKey(getAllContentNodes(messageNode));
			if (!chatname || !msg) {
				return "";
			}
			const username = getUsernameFromRow(row);
			return buildMessageKey(row, username, chatname, msg);
		} catch(e) {
			return "";
		}
	}

	function scheduleProcessMessage(ele, delay) {
		const row = getMessageRow(ele);
		if (!row || row.skip || pendingMessageNodes.has(row)) {
			return;
		}
		pendingMessageNodes.add(row);
		setTimeout(function() {
			pendingMessageNodes.delete(row);
			if (!row || !row.isConnected || row.skip) {
				return;
			}
			processMessage(row);
		}, typeof delay === "number" ? delay : 350);
	}

	function markExistingMessagesAsSkipped(container) {
		if (!container || !container.querySelectorAll) {
			return;
		}
		const avatars = getAvatarContainers(container);
		const seenRows = new WeakSet();
		for (let i = 0; i < avatars.length; i++) {
			const row = getMessageRow(avatars[i]);
			if (!row || seenRows.has(row)) {
				continue;
			}
			seenRows.add(row);
			const rowKey = buildMessageKeyFromRow(row);
			if (rowKey) {
				rememberMessageKey(rowKey);
			}
			row.skip = true;
			try {
				pendingMessageNodes.delete(row);
			} catch(e) {}
			try {
				messageRetryCounts.delete(row);
			} catch(e) {}
		}
	}

	function resolveChatContainer() {
		try {
			const direct = document.querySelector('[data-testid="chatContainer"]');
			if (direct) {
				return direct;
			}
		} catch(e) {}

		try {
			const composer = getChatComposer(document);
			if (composer) {
				const semanticContainer = composer.closest('[data-testid="chatContainer"]');
				if (semanticContainer) {
					return semanticContainer;
				}
				let current = composer.parentElement;
				let bestMatch = null;
				while (current && (current !== document.body)) {
					const avatarCount = getAvatarContainers(current).length;
					if (avatarCount) {
						bestMatch = current;
						if (avatarCount > 1) {
							return current;
						}
					}
					current = current.parentElement;
				}
				if (bestMatch) {
					return bestMatch;
				}
			}
		} catch(e) {}

		try {
			const avatar = document.querySelector("[data-testid^='UserAvatar-Container-']");
			if (avatar) {
				const row = getMessageRow(avatar);
				if (row) {
					const semanticContainer = row.closest('[data-testid="chatContainer"]');
					if (semanticContainer) {
						return semanticContainer;
					}
					let current = row.parentElement;
					let bestMatch = row.parentElement || row;
					while (current && (current !== document.body)) {
						const avatarCount = getAvatarContainers(current).length;
						if (avatarCount) {
							bestMatch = current;
						}
						if (avatarCount > 1 && getChatComposer(current)) {
							return current;
						}
						current = current.parentElement;
					}
					return bestMatch;
				}
			}
		} catch(e) {}

		return null;
	}
	
	function processMessage(ele){
		
		const row = getMessageRow(ele) || ele;
		if (!row || row.skip){
			return;
		}
		
		var chatname="";
		var msg="";
		var chatimg = "";
		var username = "";
		var nameElement = "";
		try {
			nameElement = getDisplayNameElement(row);
			if (!nameElement){
				throw new Error("Missing display name");
			}
			chatname = escapeHtml(nameElement.textContent.trim());
			chatname = chatname.split(":")[0];
			if (!chatname){
				throw new Error("Missing chat name");
			}
		} catch(e){
			let attempts = (messageRetryCounts.get(row) || 0) + 1;
			if (attempts <= 4){
				messageRetryCounts.set(row, attempts);
				scheduleProcessMessage(row, 250 * attempts);
				return;
			}
			row.skip = true;
			return;
		}
		
		username = getUsernameFromRow(row);
		
		try {
			var node = getMessageContentNode(row);
			if (!node){
				throw new Error("Missing message node");
			}
			msg = getAllContentNodes(node);
			msg = msg.trim();
		} catch(e){
			let attempts = (messageRetryCounts.get(row) || 0) + 1;
			if (attempts <= 4){
				messageRetryCounts.set(row, attempts);
				scheduleProcessMessage(row, 250 * attempts);
				return;
			}
			row.skip = true;
			return;
		}
		
		try {
			const avatarImage = row.querySelector("[data-testid^='UserAvatar-Container-'] img[src], a[href] img[alt][src]");
			chatimg = avatarImage ? avatarImage.src : "";
		} catch(e){
			chatimg = "";
		}
		
		
		var nameColor = "";
		try {
			nameColor = getComputedStyle(nameElement).color;
			if (nameColor){
				 if (isColorVeryDark(nameColor)){ // we want to exclude very dark names.
					 nameColor = "";
				 }
			}
		} catch(e){
		//	console.warn(e);
		}
		if (chatname.startsWith("This broadcast has ended")){
			return;
		}

		//console.log(msg);
		//console.log(chatname);
		if (!msg || !chatname){
			let attempts = (messageRetryCounts.get(row) || 0) + 1;
			if (attempts <= 4){
				messageRetryCounts.set(row, attempts);
				scheduleProcessMessage(row, 250 * attempts);
				return;
			}
			row.skip = true;
			return;
		}

		if (isLikelyTimeLabel(msg)) {
			row.skip = true;
			return;
		}
		
		const currentMsg = buildMessageKey(row, username, chatname, msg);
		if (hasSeenMessageKey(currentMsg)) {
			row.skip = true;
			return;
		}
		rememberMessageKey(currentMsg);
		messageRetryCounts.delete(row);
		row.skip = true;
		
		var data = {};
		data.chatname = chatname;
		if (username){
			data.username = username;
		}
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		
		//console.log(data);
		
		if (settings.detweet){
			data.type = "twitter";
		} else {
			data.type = "x";
		}
		if (isExtensionOn){
			pushMessage(data);
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	var isExtensionOn = true;
	
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
				if (isExtensionOn){
					if ("getSource" == request){
						
						if (settings.detweet) {
							sendResponse("twitter");
						} else {
							sendResponse("x");
						}
						return;	
						
					}
					if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
						let composer = getChatComposer(document);
						if (composer && composer.focus){
							composer.focus();
							sendResponse(true);
							return;
						}
					}
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
	
	
	function findViewerSpan() {
	  const spans = document.querySelectorAll('span');
	  return Array.from(spans).find(span => {
		const text = span.textContent.trim();
		return text.includes('view') && !text.includes('LIVE') && /\d+\s*view/.test(text);
	  });
	}
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				let viewerSpan = findViewerSpan();
				if (viewerSpan && viewerSpan.textContent){
					let views = viewerSpan.textContent.toUpperCase();
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
									type: 'x',
									event: 'viewer_update',
									meta: views
								}
							}),
							function (e) {}
						);
					}
				}
			} catch (e) {
				console.log(e);
			}
		}
	}
	
	setTimeout(function(){checkViewers();},2000);
	setInterval(function(){checkViewers()},5000);
	
	
	function onElementInserted(target) {
		if (!target) {
			return;
		}
		if (observer) {
			try {
				observer.disconnect();
			} catch(e) {}
		}
		observedContainer = target;
		markExistingMessagesAsSkipped(target);

		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					try {
						for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
							const addedNode = mutation.addedNodes[i];
							if (!addedNode || (addedNode.nodeType !== 1)) {
								continue;
							}
							scheduleProcessMessage(addedNode, 350);
							if (addedNode.querySelectorAll) {
								const avatars = addedNode.querySelectorAll("[data-testid^='UserAvatar-Container-']");
								for (let j = 0; j < avatars.length; j++) {
									scheduleProcessMessage(avatars[j], 350);
								}
							}
						}
					} catch(e){}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	function findElementByAttributeAndChildren(parentQuery, childAttrs) {
	  const potentialParents = document.querySelectorAll(parentQuery);
	  for (let parent of potentialParents) {
		let allChildrenMatch = true;
		for (let attr of childAttrs) {
		  if (!parent.querySelector(attr)) {
			allChildrenMatch = false;
			break;
		  }
		}
		if (allChildrenMatch) {
		  return parent;
		}
	  }
	  return null;
	}
	
	try {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.visibilityState = "visible";
		document.mozHidden = false;
		document.webkitHidden = false;
	} catch(e){	}

	try {
		document.hasFocus = function () {return true;};
		window.onFocus = function () {return true;};
		
		Object.defineProperty(document, "mozHidden", { value : false});
		Object.defineProperty(document, "msHidden", { value : false});
		Object.defineProperty(document, "webkitHidden", { value : false});
		Object.defineProperty(document, 'visibilityState', { get: function () { return "visible"; }, value: 'visible', writable: true});
		Object.defineProperty(document, 'hidden', {value: false, writable: true});
		
		setInterval(function(){
			console.log("set visibility");
			window.onblur = null;
			window.blurred = false;
			document.hidden = false;
			document.visibilityState = "visible";
			document.mozHidden = false;
			document.webkitHidden = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},200);
	} catch(e){	}

	try {
		document.onvisibilitychange = function(){
			window.onFocus = function () {return true;};
			
		};
	} catch(e){	}

	try {
		for (event_name of ["visibilitychange",
			"webkitvisibilitychange",
			"blur", // may cause issues on some websites
			"mozvisibilitychange",
			"msvisibilitychange"]) {
				try{
					window.addEventListener(event_name, function(event) {
						event.stopImmediatePropagation();
						event.preventDefault();
					}, true);
				} catch(e){}
		}
	} catch(e){	}

	setInterval(function(){
		try {
			if (observedContainer && !observedContainer.isConnected) {
				try {
					if (observer) {
						observer.disconnect();
					}
				} catch(e) {}
				observedContainer = null;
			}
			var container = resolveChatContainer();
			if (!container) {
				container = findElementByAttributeAndChildren("[tabIndex='0']",["textarea[inputmode='text']"]);
			}
			if (container && !container.marked){
				container.marked=true;
				setTimeout(function(container){
					console.log("Social Stream started");
					if (container && (observedContainer !== container)){
						onElementInserted(container);
					}

				},1000, container);
			}
		} catch(e){
			//console.warn(e);
		}
	},2000);
})();
