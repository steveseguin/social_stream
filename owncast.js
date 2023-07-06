(function () {
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
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
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;");
	}
	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes.length || !element.childNodes){
			return element.textContent || "";
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && (node.textContent.trim().length > 0)){
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
	
	

	function processMessage(ele, wss=true){

	  if(ele.hasAttribute("is-deleted")) {
		return;
	  }
	  
	  var chatname = "";
	  try{
		chatname = ele.querySelector(".message-author, [class^='ChatUserMessage_user'] > :not([class^='ChatUserMessage_userBadges'])").textContent;
	  } catch(e){}
	  
	  var chatmessage = "";
	  try{
		  chatmessage = getAllContentNodes(ele.querySelector("[class^='ChatUserMessage_message__']"));
	  } catch(e){}
	  
	  var chatimg = "";
	  var chatdonation = "";
	  var chatmembership = "";
	  var chatsticker = "";
	  var hasDonation = '';
	  var hasMembership = '';
	  
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
	  data.chatname = encodeURI(chatname);
	  data.chatbadges = chatbadges;
	  data.chatmessage = chatmessage;
	  data.chatimg = ""; // Doesn't seem to be an avatar image for owncast
	  data.hasDonation = hasDonation;
	  data.hasMembership = hasMembership;
	  data.type = "owncast";
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
	  } catch(e){}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("div#message-input").focus();
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

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && mutation.addedNodes[i].querySelector && mutation.addedNodes[i].querySelectorAll(".chat-message_user").length==1) {
							callback(mutation.addedNodes[i].querySelector(".chat-message_user"));
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
			
			//document.querySelectorAll(".chat-message_user").forEach(ele=>{
			//	processMessage(ele, false);
			//});
			
			onElementInserted(target, function(element){
			  processMessage(element, false);
			});
		}
	},1000);
	
	
})();