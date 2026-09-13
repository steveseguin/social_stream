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
						var image = node.cloneNode(false);
						image.removeAttribute("style");
						image.removeAttribute("class");
						resp += image.outerHTML;
					}
					// resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	var chatStates = new Map();
	var activeState = null;
	var activeKey = "";
	var container = null;
	var observer = null;
	var scanTimer = null;
	var messageSelector = '[data-tag="chat-message"][data-id]';

	function rememberMessage(state, id) {
		state.seen.add(id);
		if (state.seen.size > 5000) state.seen.delete(state.seen.values().next().value);
	}

	function processMessage(message, state, skip) {
		var id = message.getAttribute("data-id");
		if (!id || state.seen.has(id)) return;
		if (skip || !isExtensionOn) {
			rememberMessage(state, id);
			return;
		}

		var text = message.querySelector('[data-tag="chat-message-text-content"]');
		var msg = text ? (settings.textonlymode ? text.textContent : getAllContentNodes(text)).trim() : "";
		var postedImage = message.querySelector('picture img[src][alt="User posted image"]');
		if (!msg && !postedImage) return; // Retry rows whose content has not hydrated yet.

		var avatar = message.querySelector('picture img[src]:not([alt="User posted image"])');
		var header = message.querySelector('[class*="messageBubbleTopHeader"] strong');
		var name = header ? header.textContent.trim() : "";
		// Consecutive messages often omit the header, but retain the author's avatar.
		if (!name && avatar) {
			var alt = avatar.getAttribute("alt") || "";
			if (/'s profile picture$/.test(alt)) name = alt.replace(/'s profile picture$/, "").trim();
		}
		if (!name && avatar) name = state.authors.get(avatar.src) || "";
		if (!name) return; // Never attribute a new author to the previous sender.
		if (avatar) state.authors.set(avatar.src, name);
		if (state.authors.size > 1000) state.authors.delete(state.authors.keys().next().value);

		rememberMessage(state, id);
		pushMessage({
			chatname: name,
			chatbadges: [],
			chatmessage: msg,
			chatimg: avatar ? avatar.src : "",
			hasDonation: "",
			membership: "",
			contentimg: postedImage ? postedImage.src : "",
			textonly: settings.textonlymode || false,
			type: "patreon"
		});
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				let viewerSpan = [...document.querySelectorAll("number-flow-react.tabular-nums[role='img']")].pop().ariaLabel;
				if (viewerSpan){
					let views = viewerSpan.toUpperCase();
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
									type: 'patreon',
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
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("patreon");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('div.tiptap[contenteditable]>p[data-placeholder]').focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
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

	function scanChat() {
		if (scanTimer) clearTimeout(scanTimer);
		scanTimer = null;
		// Event identity ignores tracking parameters; community-chat query routing is preserved.
		var key = location.pathname + (/\/events\/[^/]+/.test(location.pathname) ? "" : location.search);
		if (key !== activeKey) {
			activeKey = key;
			if (!chatStates.has(key)) chatStates.set(key, { seen: new Set(), authors: new Map(), initialized: false });
			activeState = chatStates.get(key);
			if (chatStates.size > 10) chatStates.delete(chatStates.keys().next().value);
		}

		var first = document.querySelector(messageSelector);
		var nextContainer = first && (first.closest('[data-testid="virtuoso-list"]') ||
			(first.closest('[data-index]') && first.closest('[data-index]').parentElement));
		if (!nextContainer) nextContainer = document.querySelector('[data-testid="virtuoso-list"]');
		if (nextContainer !== container) {
			if (observer) observer.disconnect();
			container = nextContainer;
			if (container) {
				observer = new MutationObserver(function () {
					if (!scanTimer) scanTimer = setTimeout(scanChat, 150);
				});
				observer.observe(container, { childList: true, subtree: true, characterData: true,
					attributes: true, attributeFilter: ["data-id", "src", "alt"] });
			}
		}
		if (!container || !activeState) return;

		var composer = document.querySelector('#send-message');
		var closed = composer && (composer.disabled || composer.getAttribute("aria-disabled") === "true") &&
			/this chat has closed/i.test((composer.getAttribute("placeholder") || "") + " " +
				(composer.getAttribute("aria-label") || ""));
		// Attach without replaying the visible history. A remount in the same chat retains IDs.
		var skip = !activeState.initialized || closed;
		container.querySelectorAll(messageSelector).forEach(function (message) {
			processMessage(message, activeState, skip);
		});
		activeState.initialized = true;
	}

	console.log("social stream injected");
	// Polling also discovers a replacement panel, an initially empty chat, or SPA navigation.
	setInterval(scanChat, 1000);
	scanChat();
})();
