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
		
		
		var chatbadges = "";
		try{
			var cb = ele.children[1].querySelectorAll("img[class*='ImgBadgeChatMessage']");
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
		var chatmessage = "";
		try{
			if (ele.childNodes[1].childNodes[0].children.length){
				chatname = ele.childNodes[1].childNodes[0].childNodes[0].innerText;
			} else {
				chatname = ele.childNodes[1].childNodes[0].innerText;
			}
			var eles = ele.childNodes[1].childNodes;
			if (eles.length>1){
				for (var i  = 1; i<eles.length;i++){
					if (eles[i].nodeName === "#text"){
						chatmessage = eles[i].textContent;
					} else if (settings.textonlymode){
						chatmessage = eles[i].textContent;
					} else {
						chatmessage = eles[i].innerHTML;
					}
				}
			} else if (eles.length==1){
				for (var i  = 1; i<eles[0].childNodes.length;i++){
					if (settings.textonlymode){
						chatmessage = eles[0].childNodes[i].textContent;
					} else {
						chatmessage = eles[0].childNodes[i].innerHTML;
					}
				}
			}
			
		} catch(e){}
	  
	  
	    if (!chatmessage){
			try{
				if (settings.textonlymode){
					chatmessage = ele.childNodes[1].textContent;
				} else {
					chatmessage = ele.childNodes[1].innerHTML;
				}
			} catch(e){}
		}
		
		if (!chatmessage && !chatbadges){
			return;
		}
		
		if (ital && chatmessage){
			chatmessage = "<i>"+chatmessage+"</i>";
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
		data.type = "tiktok";
		data.event = ital; // if an event or actual message
		
		pushMessage(data);
	}
	
	
	function start() {
		
		var target = document.querySelector('[class*="DivChatRoomContainer"]');
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
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].dataset.e2e){
								var ele = mutation.addedNodes[i];
							} else {
								var ele = mutation.addedNodes[i].querySelector("[data-e2e]");
							}
							
							if (!ele){return;}
							
							if (ele.dataset.e2e == "chat-message"){
								setTimeout(function(ele2){
									processMessage(ele2)
								},500, ele);
							} else if (settings.captureevents){
								processMessage(ele, true)
							}
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
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