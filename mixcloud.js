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
		
		if (document.querySelector("chat-message__container")){
			if (document.querySelector("chat-message__container").marked){
				return;
			} else {
				document.querySelector("chat-message__container").marked = true;
			}
		}
		

		var chatimg = "";
		var msg = "";
		
		try{
		   chatimg = ele.querySelector("img").src;
		} catch(e){}
		try{
			if (ele.querySelector(".mixcloud-live-chat-row-link")){
			  var name = ele.querySelector(".mixcloud-live-chat-row-link").innerText;
			  if (name){
				name = name.trim();
			  }
			  
			  msg = ele.querySelector('.mixcloud-live-chat-row-link').parentNode.nextElementSibling.innerText;
			} 
		} catch(e){}
		if (msg){
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
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "mixcloud";
		
		
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
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("textarea").focus();
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