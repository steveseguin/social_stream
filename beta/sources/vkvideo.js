(function () {
	if (window.__ssnVkVideoCapture) return;
	window.__ssnVkVideoCapture = true;
	 
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

	function getMessageContent(node, authorPanel) {
		if (node === authorPanel) return "";
		if (node.nodeType === 3) {
			return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		}
		if (node.nodeName === "IMG") {
			if (node.matches("img[class^='ChatBadge_image_']")) return "";
			return settings.textonlymode ? node.alt : node.outerHTML;
		}
		if (node.nodeName === "BR") return "\n";

		var text = "";
		node.childNodes.forEach(function(child) {
			text += getMessageContent(child, authorPanel);
		});
		return text;
	}

	var settings = {};
	var messageSelector = "[data-role='messageContainer'], [class*='ChatMessage_root_']";
	var authorSelector = "[class*='ChatMessageAuthorPanel_name']";
	var recentIds = new Set();
	var processedRows = new WeakMap();
	var historyThrough = 0;

	function rememberRow(row, id) {
		processedRows.set(row, id);
		if (!id || recentIds.has(id)) return;
		recentIds.add(id);
		if (recentIds.size > 2048) {
			var oldest = recentIds.values().next().value;
			recentIds.delete(oldest);
			// VK issues increasing numeric IDs. Keep old scrollback out after its entries expire.
			historyThrough = Math.max(historyThrough, Number(oldest) || 0);
		}
	}

	function processMessageElement(ele) {
		var id = ele.getAttribute("data-message-id");
		if (processedRows.get(ele) === id || recentIds.has(id) || (id && Number(id) <= historyThrough)) return;

		var content = ele.querySelector("[data-role='messageMainContent']");
		if (!content) return;
		var author = content.querySelector(authorSelector) || ele.querySelector(authorSelector);
		if (!author) return;
		var authorPanel = author.closest("[data-role='messageAuthor']");
		var name = author.textContent.trim().replace(/:$/, "").trim();
		var msg = getMessageContent(content, authorPanel || author).trim();
		if (!name || !msg) return;
		rememberRow(ele, id);

		var badges = [];
		(authorPanel || ele).querySelectorAll("img[class^='ChatBadge_image_'][src]").forEach(function(badge) {
			badges.push(badge.src);
		});

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = author.style.color;
		data.chatmessage = msg;
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "vkvideo";
		
		
		pushMessage(data);
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
				let viewerSpan = document.querySelector("[class*='OnlineViewers_root']");
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
									type: 'vkvideo',
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
				if ("getSource" == request){sendResponse("vkvideo");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
				
					document.querySelector('#type-a-message').focus();
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

	var container = null;
	var chatPath = "";
	var containerSelector = "[data-test-id='chatContainer'], [class^='Chat_root']";

	function getPageHistoryEnd() {
		// The popout can receive live rows before SSApp finishes loading the source.
		try {
			var state = JSON.parse(document.getElementById("initial-state").textContent).stream;
			if (state.stream.data.stream.blogUrl !== location.pathname.split("/")[1]) return null;
			var chat = state.streamChat;
			if (!chat.meta.networkStatus.isFetched || !Array.isArray(chat.data.data)) return null;
			var end = 0;
			for (var i = 0; i < chat.data.data.length; i++) {
				var id = Number(chat.data.data[i].id);
				if (!Number.isSafeInteger(id) || id <= 0) return null;
				end = Math.max(end, id);
			}
			return end;
		} catch (e) {
			return null;
		}
	}

	function observeChat(mutations) {
		if (!container || !container.isConnected || chatPath !== location.pathname) {
			container = document.querySelector(containerSelector);
			if (!container) return;
			console.log("CONNECTED chat detected");
			var initialHistory = chatPath !== location.pathname;
			var pageHistoryEnd = chatPath === "" ? getPageHistoryEnd() : null;
			if (initialHistory) {
				chatPath = location.pathname;
				historyThrough = pageHistoryEnd || 0;
				recentIds.clear();
				processedRows = new WeakMap();
			}
			container.querySelectorAll(messageSelector).forEach(function(row) {
				var id = row.getAttribute("data-message-id");
				if (initialHistory && (pageHistoryEnd === null || !id || Number(id) <= pageHistoryEnd)) {
					historyThrough = Math.max(historyThrough, Number(id) || 0);
					rememberRow(row, id);
				} else {
					processMessageElement(row);
				}
			});
			return;
		}

		mutations.forEach(function(mutation) {
			if (!container.contains(mutation.target)) return;
			var target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
			var row = target.closest(messageSelector);
			if (row) {
				processMessageElement(row);
				return;
			}
			mutation.addedNodes.forEach(function(node) {
				if (node.nodeType !== 1 || !container.contains(node)) return;
				if (node.matches(messageSelector)) processMessageElement(node);
				else node.querySelectorAll(messageSelector).forEach(processMessageElement);
			});
		});
	}

	console.log("social stream injected");
	observeChat([]);
	new MutationObserver(observeChat).observe(document, { childList: true, subtree: true, characterData: true });
	setInterval(checkViewers, 2000);

})();
