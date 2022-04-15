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

	function processMessage(ele){
		
		
		var chatimg="";
		try{
			chatimg = ele.childNodes[0].querySelector("img");
			if (!chatimg){
				chatimg = "";
			} else {
				chatimg = chatimg.src;
			}
		} catch(e){console.error(e);}
		var chatname = "";
		var chatmessage = "";
		
		try{
			if (ele.childNodes[1].childNodes[0].children.length){
				chatname = ele.childNodes[1].childNodes[0].childNodes[0].innerText;
			} else {
				chatname = ele.childNodes[1].childNodes[0].innerText;
			}
			if (ele.childNodes[1].lastChild.children.length>1){
				chatmessage = ele.childNodes[1].lastChild.childNodes[1].innerHTML;
			} else {
				chatmessage = ele.childNodes[1].lastChild.innerHTML;
			}
			
		} catch(e){console.error(e);}
	  
	  
	    if (!chatmessage){return;}
	  
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "tiktok";
	  
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			data.chatimg = "";
			pushMessage(data);
		}
	}
	
	
	function start() {
		console.log("STARTED SOCIAL STREAM");
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				console.log(mutation.addedNodes);
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].className.indexOf("ChatMessageItem")>-1){
								processMessage(mutation.addedNodes[i])
							}
						} catch(e){}
					}
				}
			});
		};
		var target = document.querySelector('[class*="DivChatRoomContainer"]');
		if (!target){
			setTimeout(start,2000);
			return;
		}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	setTimeout(start,2000);

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