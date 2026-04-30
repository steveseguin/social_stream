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
	function escapeHtml(unsafe) {
		try {
			if (settings.textonlymode) { // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				.replace(/&/g, "&amp;") // i guess this counts as html
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;") || "";
		} catch (e) {
			return "";
		}
	}
	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element){
			return "";
		}
		
		if (!element.childNodes || !element.childNodes.length){
			return element.textContent || "";
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

	function querySelectorAny(root, selectors) {
		if (!root || !selectors || !selectors.length){
			return null;
		}
		for (var i = 0; i < selectors.length; i++){
			try {
				var match = root.querySelector(selectors[i]);
				if (match){
					return match;
				}
			} catch(e){}
		}
		return null;
	}

	function getChatName(ele) {
		var chatname = "";
		try{
			var chatnameNode = querySelectorAny(ele, [
				".message-author",
				"[class^='ChatUserMessage_userName__']",
				"[class^='ChatUserMessage_repeatUser__'] [class^='ChatUserMessage_userName__']",
				"[class^='ChatUserMessage_user__'] > :not([class^='ChatUserMessage_userBadges'])"
			]);
			if (chatnameNode){
				chatname = escapeHtml((chatnameNode.textContent || "").trim());
			}
		} catch(e){}
		return chatname;
	}

	function getChatMessage(ele) {
		var chatmessage = "";
		try{
			var messageNode = querySelectorAny(ele, [
				"[class^='ChatUserMessage_message__']",
				".ChatUserMessage_message__JJiP9",
				".message-text"
			]);
			if (messageNode){
				chatmessage = getAllContentNodes(messageNode);
			}
		} catch(e){}
		return chatmessage;
	}

	function getChatInput() {
		return querySelectorAny(document, [
			"#chat-input-content-editable",
			"#chat-input [role='textbox'][contenteditable='true']",
			"[aria-label='Chat text input'][contenteditable='true']",
			"[contenteditable='true'][placeholder='Send a message to chat']",
			"[class^='ChatTextField_inputWrap__'] [contenteditable='true']",
			"div#message-input",
			"#message-input"
		]);
	}

	function focusChatInput() {
		var input = getChatInput();
		if (!input){
			return false;
		}
		try {
			if (input.scrollIntoView){
				input.scrollIntoView({ block: "nearest" });
			}
		} catch(e){}
		try {
			if (input.focus){
				input.focus();
			}
			if (input.isContentEditable && window.getSelection && document.createRange){
				var selection = window.getSelection();
				var range = document.createRange();
				range.selectNodeContents(input);
				range.collapse(false);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		} catch(e){}
		return true;
	}
	

	function processMessage(ele, wss=true){

	  if(ele.hasAttribute("is-deleted")) {
		return;
	  }
	  
	  if (ele.alreadyRead){
		  return;
	  }
	  
	  ele.alreadyRead = true;
	  
	  var chatname = getChatName(ele);
	  
	  var chatmessage = getChatMessage(ele);
	  
	  var chatimg = "";
	  var chatdonation = "";
	  var chatmembership = "";
	  var chatsticker = "";
	  var hasDonation = '';
	  
	  if (!chatmessage && !hasDonation){return;}
	  
	  var chatbadges = [];
	  
	  ele.querySelectorAll("[class^='ChatUserMessage_userBadges'] svg, [class^='ChatUserMessage_userBadges'] img").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src+"";
				tmp.type = "img";
				chatbadges.push(tmp);
			} else {
				var tmp = {};
				tmp.html = badge.outerHTML;
				tmp.type = "svg";
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.chatmessage = chatmessage;
	  data.chatimg = ""; // Doesn't seem to be an avatar image for owncast
	  data.hasDonation = hasDonation;
	  data.membership = '';
	  data.textonly = settings.textonlymode || false;
	  data.type = "owncast";
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
	  } catch(e){}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("owncast");	return;	}
				if ("focusChat" == request){
					sendResponse(focusChatInput());
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


	var dataIndex = -1;
	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (!mutation.addedNodes[i]){continue;}
						var addedNode = mutation.addedNodes[i];
						
						if (addedNode.dataset && addedNode.dataset.index){
							if ( parseInt(addedNode.dataset.index) > dataIndex){
								dataIndex = parseInt(addedNode.dataset.index);
							} else {
								continue;
							}
						}
						
						if (addedNode && addedNode.matches && addedNode.matches(".chat-message_user")) {
							callback(addedNode);
							continue;
						}
						
						if (addedNode && addedNode.querySelectorAll) {
							addedNode.querySelectorAll(".chat-message_user").forEach(node=>{
								callback(node);
							});
						}
					}
				}
			});
		};
		
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	console.log("social stream injected");
	
	var timer = setInterval(function(){
		var target = document.querySelector("#chat-container");
		if (target && !target.set123){
			target.set123 = true;
			
			document.querySelectorAll(".chat-message_user").forEach(ele=>{
				if (ele.parentNode.dataset && (ele.parentNode.dataset.index > dataIndex)){
					dataIndex = parseInt(ele.parentNode.dataset.index);
				} else if (ele.parentNode.parentNode.dataset && (ele.parentNode.parentNode.dataset.index > dataIndex)){
					dataIndex = parseInt(ele.parentNode.parentNode.dataset.index);
				} else if (ele.parentNode.parentNode.dataset && (ele.dataset.index > dataIndex)){
					dataIndex = parseInt(ele.dataset.index);
				}
				//console.log(dataIndex);
				//processMessage(ele, false);
			});
			
			onElementInserted(target, function(element){
			  processMessage(element, false);
			});
		}
	},1000);
	
	
})();
