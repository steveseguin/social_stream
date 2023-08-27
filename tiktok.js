(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

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
			} else if ((node.nodeType === 3) && node.textContent){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
						resp += "<img src='"+node.src+"' />";
					} else {
						resp += node.outerHTML;
					}
				}
			}
		});
		return resp;
	}


	var savedavatars = {};

	function processMessage(ele, ital=false){
		
		var chatimg="";
		try{
			chatimg = ele.children[0].querySelector("img");
			if (!chatimg){
				chatimg = "";
			} else {
				chatimg = chatimg.src;
			}
		} catch(e){}
		
		
		if (ele.querySelector("[class*='DivTopGiverContainer']")){return;}
		
		
		var chatbadges = "";
		try{
			var cb = ele.children[1].querySelectorAll("img[class*='ImgBadgeChatMessage'], img[class*='ImgCombineBadgeIcon']");
			if (cb.length){
				chatbadges = [];
				cb.forEach(cbimg =>{
					if (cbimg.src){
						chatbadges.push(cbimg.src);
					}
				});
			}
		} catch(e){}
		
		var chatname = "";
		
		
		try {
			chatname = ele.querySelector("span[data-e2e='message-owner-name']").textContent;
			chatname = escapeHtml(chatname);
		} catch(e){}
		
		try{
			if (!chatname){
				if (ele.childNodes[1].childNodes[0].children.length){
					chatname = escapeHtml(ele.childNodes[1].childNodes[0].childNodes[0].innerText);
				} else {
					chatname = escapeHtml(ele.childNodes[1].childNodes[0].innerText);
				}
			}
			
		} catch(e){}
		
		var chatmessage = "";
		try {
			chatmessage = getAllContentNodes(ele.querySelector("div[class*='-DivUserInfo'], span[data-e2e='message-owner-name']").nextSibling);
		} catch(e){}	
		
		
		try {
			if (!chatmessage){
				var eles = ele.childNodes[1].childNodes;
				if (eles.length>1){
					for (var i  = 1; i<eles.length;i++){
						if (eles[i].nodeName === "#text"){
							chatmessage = escapeHtml(eles[i].textContent);
						} else if (settings.textonlymode){
							chatmessage = escapeHtml(eles[i].textContent);
						} else {
							chatmessage = eles[i].innerHTML;
						}
					}
				} else if (eles.length==1){
					for (var i  = 1; i<eles[0].childNodes.length;i++){
						if (settings.textonlymode){
							chatmessage = escapeHtml(eles[0].childNodes[i].textContent);
						} else {
							chatmessage = eles[0].childNodes[i].innerHTML;
						}
					}
				}
			}
		} catch(e){}
		
		if (!chatmessage && !chatbadges){
			return;
		} else if (chatmessage){
			chatmessage = chatmessage.trim();
		}
		
		if (chatname && chatimg){
			savedavatars[chatname] = chatimg;
			if (savedavatars.length >100){
				var keys = Object.keys(savedavatars);
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
				delete savedavatars[keys[0]];
			}
		} else if (chatname){
			chatimg = savedavatars[chatname];
		} else if (chatmessage && (chatmessage==="----")){ // no chat name
			return;
		} 
		
		if (ital && chatmessage && (chatmessage==="joined")){ // no chat name
			return;
		}
	  
		var data = {};
		data.chatname = chatname;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "tiktok";
		data.event = ital; // if an event or actual message
		
		pushMessage(data);
	}
	
	
	function start() {
		
		var target = document.querySelector('[class*="DivChatMessageList"]');
		if (!target){
			return;
		}
		
		if (window.location.href.includes("livecenter")){
			//
		} else if ((!(window.location.pathname.includes("@") && window.location.pathname.includes("live")))){
			return;
		}
		
		if (target.set123){
			return;
		} else {
			target.set123 = true;
		}
		// class="tiktok-1dvdrb1-DivChatRoomMessage-StyledLikeMessageItem e12fsz0m0"
		console.log("STARTED SOCIAL STREAM");
		
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							
							if (mutation.addedNodes[i].dataset && (mutation.addedNodes[i].dataset.e2e == "chat-message")){
								setTimeout(function(ele2){
									processMessage(ele2)
								},500, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].dataset.e2e){
								setTimeout(function(ele2){
									processMessage(ele2, true); // event
								},500, mutation.addedNodes[i]);
							} else if (settings.captureevents){
								setTimeout(function(ele2){
									processMessage(ele2); // donation?
								},500, mutation.addedNodes[i]);
							}
						} catch(e){}
					}
				}
			});
		};
		var config = { childList: true, subtree: false };
		
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		
		///////
		
		var target2 = document.querySelector('[class*="DivBottomStickyMessageContainer');
		var onMutationsObserved2= function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							setTimeout(function(ele2){
								processMessage(ele2, true); // event
							},500, mutation.addedNodes[i], true);
						} catch(e){}
					}
				}
			});
		};
		
		var config2 = { childList: true, subtree: true };
		var observer2 = new MutationObserver(onMutationsObserved2);
		observer2.observe(target2, config2);
		
	}
	
	setInterval(start,2000);

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
					if (!document.querySelector('.public-DraftEditorPlaceholder-inner')){
						sendResponse(false);
						return;
					}
					document.querySelector(".public-DraftEditorPlaceholder-inner").focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();