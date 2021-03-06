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


	var lastMessage = "";
	
	
	function processMessage(ele2){
		var ele = ele2.querySelectorAll("[class^='contents-']")[this.length];
		var chatimg = "";
		try{
		   chatimg = ele.querySelector("img[class*='avatar-']").src;
		} catch(e){
		}
		
		var name="";
		if (ele.querySelector('[id^="message-username-"]')){
		  name = ele.querySelector('[id^="message-username-"]').innerText;
		  if (name){
			name = name.trim();
		  }
		  
		} 
		
		var msg = "";
		if (textOnlyMode){
			try {
				msg = ele.querySelector('[id^="message-content-"]').innerText;
			} catch(e){}
		} else {
			try {
				msg = ele.querySelector('[id^="message-content-"]').innerHTML;
			} catch(e){}
		}
		if (msg){
			msg = msg.trim();
		}
		
		if (!name && !chatimg){
			ele2 = ele2.previousElementSibling;
			var ele = ele2.querySelectorAll("[class^='contents-']")[this.length];
			try {
				for (var i=0; i<50;i++){
					if (ele.querySelector('[id^="message-username-"]')){
						break;
					} else {
						ele2 = ele2.previousElementSibling;
						ele = ele2.querySelectorAll("[class^='contents-']")[this.length];
					}
				}
				try{
				    chatimg = ele.querySelector("img[class*='avatar-']").src;
				   
				    if (ele.querySelector('[id^="message-username-"]')){
					    name = ele.querySelector('[id^="message-username-"]').innerText;
					    if (name){
						    name = name.trim();
					    }
					}
				} catch(e){}
			} catch(e){}
		}
		

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
		data.type = "discord";
		
		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		
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
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
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
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('div[class*="slateTextArea"]').focus();
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

	var lastURL =  "";
	var lastMessageID = 0;
	var observer = null;
	
	function onElementInserted(containerSelector) {
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
			observer = null;
		}
		var onMutationsObserved = function(mutations) {
			var highestMessage = 0;
			if (lastURL !== window.location.href){
				lastURL = window.location.href;
				lastMessageID = 0;
			}
			if (!window.location.href.includes("/channels/")){
				if (observer){
					try {
						observer.disconnect();
					} catch(e){}
					observer = null;
				}
				return;
			}
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].id && !mutation.addedNodes[i].skip){
							var mid = mutation.addedNodes[i].id.split("chat-messages-");
							if (mid.length==2){
								mid = parseInt(mid[1]);
							} else {
								continue;
							}
							if (highestMessage<mid){
								highestMessage = mid;
							} else {
								continue;
							}
							setTimeout(function(id){
								try{
									if (document.getElementById(id).skip){return;}
									document.getElementById(id).skip = true;
									if (!document.getElementById(id).childNodes.length){return;}
									processMessage(document.getElementById(id));
								} catch(e){}
							},500, mutation.addedNodes[i].id);
						}
					}
					if (highestMessage>lastMessageID){
						lastMessageID = highestMessage;
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected -- MUST BE ENABLED VIA SETTING TOGGLE AS WELL TO USE!!!");

	setInterval(function(){
		if (!window.location.href.includes("/channels/")){return;}
		if (document.querySelector('[data-list-id="chat-messages"]')){
			if (!document.querySelector('[data-list-id="chat-messages"]').marked){
				document.querySelector('[data-list-id="chat-messages"]').marked=true;
				onElementInserted('[data-list-id="chat-messages"]');
			}
		}
	},1000);

})();