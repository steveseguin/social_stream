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


	var lastMessage = {};
	
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
	
	function processMessage(ele, initial=false){
		var chatimg = "";
		var msg = "";
		var name = "";
		
		if (ele.marked){
			return;
		}
		
		name = escapeHtml(ele.querySelector("h6, .interaction-qna-item-preview-author-name").textContent);
		
		if (name){
			
			name = name.split("(me)")[0];
			name = name.trim();
		} 
		
		msg = getAllContentNodes(ele.querySelector(".interaction-chat-message-content, .interaction-qna-item-preview-text"));
		
		if (msg){
			msg = msg.trim();
		} 
		
		chatimg = ele.querySelector("img[class*='author-avatar'][src]");
		if (chatimg) {
			chatimg = chatimg.src;
		} else {
			chatimg = "";
		}
		
		if (!msg){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "vimeo";
		
		if (ele.querySelector(".interaction-qna-item-preview")){
			ele.marked = true;
			data.question = true;
		} else if (initial || ele.marked){
			ele.marked = true;
			return;
		}
		
		
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('#interaction-chat-input-field').focus();
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

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try{
							if (mutation.addedNodes[i].tagName == "LI"){
								processMessage(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].classList && mutation.addedNodes[i].classList.contains("interaction-sidebar-item-content-item")){
								processMessage(mutation.addedNodes[i]);
							} else {
								mutation.addedNodes[i].querySelectorAll(".interaction-sidebar-item-content-item").forEach(ele=>{
									processMessage(ele);
								});
								
							}
						} catch(e){}
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

	var initialsetup = setInterval(function(){
		if (document.querySelector("#interaction-widget-auto-sidebar-content")){
			if (!document.querySelector("#interaction-widget-auto-sidebar-content").marked){
				document.querySelector("#interaction-widget-auto-sidebar-content").marked=true;
				var eles = document.querySelectorAll("#live-chat-app li, #interaction-chat-history li, #interaction-widget-auto-sidebar-item-content-qna-questions-list-columns .interaction-sidebar-item-content-item");
				for (var i=0; i < eles.length; i++) {
					try{
						processMessage(eles[i], true);
					} catch(e){}
				}
				onElementInserted(document.querySelector("#interaction-widget-auto-sidebar-content"));
				clearInterval(initialsetup);
			}
		}
	},1000);

})();