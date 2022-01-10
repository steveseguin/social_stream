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
	
	function processMessage(ele){
		var chatimg = "";
		var msg = "";
		var name = "";
		
		try{
			msg = ele.querySelector("converse-chat-message-body").innerText;
			if (msg){
				msg = msg.trim();
			}
		} catch(e){}
		
		var prev = ele;
		while (prev.querySelectorAll(".chat-msg--followup").length==1){
			prev = prev.previousElementSibling;
		}
		
		try{
		   chatimg = prev.querySelector("converse-avatar").querySelector("image").href.baseVal;
		   if (chatimg.startsWith("data:image/svg")){
			   chatimg = ""; // I'll just use a generic avatar instead.
		   }
		} catch(e){
			// no avatar image found
		}
		
		try{
			name = prev.querySelector(".chat-msg__author").innerText;
			if (name){
				name = name.trim();
			}
		} catch(e){}
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "peertube";
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	
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
					document.querySelector('textarea').focus();
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
							if (mutation.addedNodes[i].tagName.toLowerCase() == "converse-chat-message"){
								setTimeout(function(ele){processMessage(ele);},300, mutation.addedNodes[i]);
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

	var integrateInterval = setInterval(function(){
		if (document.querySelector(".chat-content__messages")){
			if (!document.querySelector(".chat-content__messages").marked){
				clearInterval(integrateInterval);
				document.querySelector(".chat-content__messages").marked=true;
				onElementInserted(document.querySelector(".chat-content__messages"));
			}
		}
	},1000);

})();