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


	var lastMessage = {};
	
	function processMessage(ele){
		
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);
		
		if (document.querySelector("chat-message__container")){
			if (document.querySelector("chat-message__container").marked){
				return;
			} else {
				document.querySelector("chat-message__container").marked = true;
			}
		}
		

		var chatimg = "";
		var msg = "";
		var name = "";
		var dono = "";
		var username= "";
		try{
		   chatimg = ele.querySelector("img").src;
		   if (chatimg){
			chatimg = chatimg.replace("26x26", "150x150");
			chatimg = chatimg.replace("24x24", "150x150");
		   }
		   name = ele.querySelector("img").alt;
		} catch(e){}
		
		if (!name){
			try {
				name = ele.querySelector(".mixcloud-live-chat-row-link[href]").innerText;
			} catch(e){}
		}
		try {
			username = ele.querySelector(".mixcloud-live-chat-row-link[href]").href;
			username = username.split("/");
			username.pop();
			username = username.pop();
		}catch(e){}
		
		try{
			if (ele.querySelector(".mixcloud-live-chat-row-link")){
			  name = ele.querySelector(".mixcloud-live-chat-row-link").innerText;
			  if (name){
				name = name.trim();
			  }
			  msg = ele.querySelector('.mixcloud-live-chat-row-link').parentNode.nextElementSibling.innerText;
			} 
		} catch(e){}
		
		if (!msg){
			try {
				msg = ele.querySelector("[class*='ChatSubscriptionMessageRow']").textContent || querySelector("[class*='ChatSubscriptionMessageRow']").innerText;
				msg = msg.trim();
				try {
					dono = ele.querySelector("[class*='ChatSubscriptionMessageRow'] > p").childNodes;
					dono = dono[dono.length-1].textContent || dono[dono.length-1].innerText || "";
					dono = dono.trim();
				} catch(e){
				}
			} catch(e){
			}
		} else {
			msg = msg.trim();
			if (name){
				if (msg.startsWith(name)){
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}

		var data = {};
		data.chatname = name;
		data.username = username;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "mixcloud";
		
		
		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		
		pushMessage(data);
		
		/* if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		} */
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
					document.querySelector("textarea").focus();
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

	function onElementInserted(containerSelector) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					if (mutation.addedNodes[0].previousElementSibling && mutation.addedNodes[0].previousElementSibling.previousElementSibling && mutation.addedNodes[0].previousElementSibling.previousElementSibling.previousElementSibling && mutation.addedNodes[0].previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling){
						return; // don't allow old messages from loading
					}
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].classList.contains("mixcloud-live-chat-row")){
							processMessage(mutation.addedNodes[i]);
						}
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		
	}
	console.log("social stream injected");

	setInterval(function(){
		if (document.querySelector(".mixcloud-live-chat-container")){
			if (!document.querySelector(".mixcloud-live-chat-container").marked){
				document.querySelector(".mixcloud-live-chat-container").marked=true;
				onElementInserted(".mixcloud-live-chat-container");
			}
		}
	},1000);

})();