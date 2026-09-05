(function () {
	 
	
	var isExtensionOn = true;
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
	
	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
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
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.length > 0)){
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

	var messageSelector = "[data-testid='chatline'], .mixcloud-live-chat-row";
	var chatContainerSelector = ".mixcloud-live-chat-container, .mixcloud-live-chat-chat-window";

	function getMessageElement(ele){
		if (!ele || ele.nodeType !== 1){return null;}
		if (ele.matches && ele.matches(messageSelector)){
			return ele;
		}
		if (ele.closest){
			var parentMessage = ele.closest(messageSelector);
			if (parentMessage){
				return parentMessage;
			}
		}
		if (ele.querySelector){
			return ele.querySelector(messageSelector);
		}
		return null;
	}

	function getChatContainerFromRow(row){
		if (!row || !row.parentElement){return null;}
		var parent = row.parentElement;
		while (parent && parent !== document.body){
			try {
				if (parent.querySelectorAll(messageSelector).length > 1){
					return parent;
				}
			} catch(e){}
			parent = parent.parentElement;
		}
		return row.parentElement;
	}

	function getProfileLink(ele){
		var links = ele.querySelectorAll("a[href]");
		for (var i = 0; i < links.length; i++){
			var link = links[i];
			var href = link.getAttribute("href") || "";
			if (link.closest && link.closest("p")){continue;}
			if (link.getAttribute("aria-label")){continue;}
			if (href.indexOf("/pro/") !== -1){continue;}
			if ((link.textContent || "").trim()){
				return link;
			}
		}
		return null;
	}

	function getUsernameFromLink(link){
		if (!link){return "";}
		var href = link.href || link.getAttribute("href") || "";
		href = href.split("?")[0].split("#")[0];
		var parts = href.split("/");
		for (var i = parts.length - 1; i >= 0; i--){
			if (parts[i]){
				return parts[i];
			}
		}
		return "";
	}

	function getNameFromImage(img){
		if (!img){return "";}
		var alt = img.getAttribute("alt") || "";
		alt = alt.replace(/'s profile picture$/i, "");
		return alt.trim();
	}


	var lastMessage = {};
	
	function processMessage(ele){
		ele = getMessageElement(ele);
		if (!ele){return;}
		
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);
		
		if (document.querySelector("chat-message__container")){
			if (document.querySelector("chat-message__container").marked){
				return;
			} else {
				document.querySelector("chat-message__container").marked = true;
			}
		}
		

		var chatimg = "";
		var msg = "";
		var name = "";
		var dono = "";
		var username= "";
		try{
		   chatimg = ele.querySelector("img").src;
		   if (chatimg){
			chatimg = chatimg.replace("26x26", "150x150");
			chatimg = chatimg.replace("24x24", "150x150");
		   }
		  // name = ele.querySelector("img").alt;
		} catch(e){}

		try {
			if (ele.getAttribute("data-testid") === "chatline"){
				var profileLink = getProfileLink(ele);
				var msgNode = ele.querySelector("p");
				if (profileLink){
					name = escapeHtml((profileLink.textContent || profileLink.innerText || "").trim());
					username = getUsernameFromLink(profileLink);
				}
				if (!name){
					name = escapeHtml(getNameFromImage(ele.querySelector("img[alt]")));
				}
				if (msgNode){
					msg = getAllContentNodes(msgNode).trim();
				}
			}
		} catch(e){}
		
		if (!name){
			try {
				name = escapeHtml(ele.querySelector(".mixcloud-live-chat-row-link[href]").innerText);
			} catch(e){}
		}
		try {
			username = ele.querySelector(".mixcloud-live-chat-row-link[href]").href;
			username = username.split("/");
			username.pop();
			username = username.pop();
		}catch(e){}
		
		try{
			if (ele.querySelector(".mixcloud-live-chat-row-link")){
			  name = escapeHtml(ele.querySelector(".mixcloud-live-chat-row-link").innerText);
			  if (name){
				name = name.trim();
				name = escapeHtml(name);
			  }
			  msg = escapeHtml(ele.querySelector('.mixcloud-live-chat-row-link').parentNode.nextElementSibling.innerText);
			} 
		} catch(e){}
		
		if (!msg){
			try {
				msg = ele.querySelector("[class*='ChatSubscriptionMessageRow']").textContent || querySelector("[class*='ChatSubscriptionMessageRow']").innerText;
				msg = msg.trim();
				msg = escapeHtml(msg);
				
				try {
					dono = ele.querySelector("[class*='ChatSubscriptionMessageRow'] > p").childNodes;
					dono = dono[dono.length-1].textContent || dono[dono.length-1].innerText || "";
					dono = dono.trim();
					dono = escapeHtml(dono);
				} catch(e){
				}
			} catch(e){
			}
		} else {
			msg = msg.trim();
			if (name){
				if (msg.startsWith(name)){
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}

		var data = {};
		data.chatname = name;
		data.username = username;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "mixcloud";
		
		
		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		
		pushMessage(data);
		
		/* if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		} */
	}

	function pushMessage(data){
		
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}

	function simulateFocus(element) {
		if (!element) {
			return;
		}
		try {
			element.dispatchEvent(new FocusEvent("focusin", {
				view: window,
				bubbles: true,
				cancelable: true
			}));
		} catch (e) {}
		try {
			element.dispatchEvent(new FocusEvent("focus", {
				view: window,
				bubbles: false,
				cancelable: true
			}));
		} catch (e) {}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){
					sendResponse("mixcloud");
					return;
				}
				if ("focusChat" == request){
					var input = document.querySelector("textarea[placeholder='Send a message'], textarea");
					if (input){
						try {
							input.scrollIntoView({ block: "center", inline: "nearest" });
						} catch(e){}
						try {
							input.click();
						} catch(e){}
						try {
							input.focus({ preventScroll: true });
						} catch(e){
							try {
								input.focus();
							} catch (err) {}
						}
						simulateFocus(input);
						try {
							input.setSelectionRange(input.value.length, input.value.length);
						} catch(e){}
						sendResponse(true);
						return;
					}
					sendResponse(false);
					return;
				}
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
			} catch(e){
				console.error(e);
			}
			sendResponse(false);
		}
	);

	function handleAddedNode(node) {
		if (!node || node.nodeType !== 1){return;}
		if (getMessageElement(node)){
			processMessage(node);
		}
		if (node.querySelectorAll){
			var rows = node.querySelectorAll(messageSelector);
			for (var j = 0; j < rows.length; j++){
				processMessage(rows[j]);
			}
		}
	}

	function observeChatContainer(target) {
		if (!target || target.marked){return;}
		target.marked = true;

		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						handleAddedNode(mutation.addedNodes[i]);
					}
				}
			});
		};
		var existingRows = target.querySelectorAll(messageSelector);
		for (var i = 0; i < existingRows.length; i++){
			existingRows[i].marked = true;
		}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		
	}

	function onElementInserted(containerSelector) {
		var targets = document.querySelectorAll(containerSelector);
		for (var i = 0; i < targets.length; i++){
			observeChatContainer(targets[i]);
		}
	}

	function observeDiscoveredChatContainers() {
		var rows = document.querySelectorAll(messageSelector);
		for (var i = 0; i < rows.length; i++){
			observeChatContainer(getChatContainerFromRow(rows[i]));
		}
	}
	console.log("social stream injected");

	setInterval(function(){
		onElementInserted(chatContainerSelector);
		observeDiscoveredChatContainers();
	},1000);

})();
