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
		//console.log(ele);
		
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
					chatmessage = eles[i].innerHTML;
				}
			} else if (eles.length==1){
				for (var i  = 1; i<eles[0].childNodes.length;i++){
					chatmessage = eles[0].childNodes[i].innerHTML;
				}
			}
			
		} catch(e){}
	  
	  
	    if (!chatmessage){
			try{
				chatmessage = ele.childNodes[1].innerHTML;
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
		
	//	console.log(data);
		
		pushMessage(data);
	}
	
	
	function start() {
		
		var target = document.querySelector('[class*="DivChatRoomContainer"]');
		if (!target){
			return;
		}
		
		if (!
		if ((!(window.location.pathname.includes("@") && window.location.pathname.includes("live"))) || window.location.pathname.includes("livecenter")){ 
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
							if (mutation.addedNodes[i].className.indexOf("ChatMessageItem")>-1){
								setTimeout(function(ele){
									processMessage(ele)
								},500, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].className.indexOf("ivChatRoomMessage-StyledLikeMessageItem")>-1){
								setTimeout(function(ele){
									processMessage(ele, true)
								},500, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].className.indexOf("DivChatRoomMessage")>-1){
								setTimeout(function(ele){
									processMessage(ele, true)
								},500, mutation.addedNodes[i]);
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

	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
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
				if ("textOnlyMode" == request){
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request){
					textOnlyMode = false;
					sendResponse(true);
					return;
				}
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();