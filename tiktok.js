(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
			console.log(data);
		} catch(e){console.error(e);}
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
		} catch(e){}
		var chatname = "";
		var chatmessage = "";
		
		try{
			chatname = ele.childNodes[1].childNodes[0].innerText;
			chatmessage = ele.childNodes[1].childNodes[1].innerHTML;
		} catch(e){}
	  
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
	
	
	setTimeout(function(){
		console.log("STARTED SOCIAL STREAM");
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.testid && (mutation.addedNodes[i].dataset.testid=="chat-message")){  // ui-chat__item--message
								processMessage(mutation.addedNodes[i])
							}
						} catch(e){}
					}
				}
			});
		};
		var target = document.querySelector('[data-testid="chat-room"]');
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	},1000);

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