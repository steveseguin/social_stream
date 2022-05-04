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
	var lastName = "";
	var lastImage = "";
	var messageHistory = [];

	function processMessage(ele){

		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		var id = ele.querySelector("div[id][class*='chat']");
		if (id && id.id){
			if (messageHistory.includes(id.id)){
				return;
			}
			messageHistory.push(id.id);
		} else {
			return;
		}

		if (document.querySelector("chat-message__container")){
			if (document.querySelector("chat-message__container").marked){
				return;
			} else {
				document.querySelector("chat-message__container").marked = true;
			}
		}


		var img = false;
		var chatimg = "";
		try{
		   chatimg = ele.querySelector(".chat-item__chat-info-msg-avatar").src;
		   img = true;
		} catch(e){
			//
		}
    var name = "";
		if (ele.querySelector(".chat-item__sender")){
		  name = ele.querySelector(".chat-item__sender").innerText;
		  if (name){
			  name = name.trim();
		  }
		}

		if (!name){

			try {
				var prev = ele.previousElementSibling;
				for (var i=0; i<50;i++){
					if (prev.querySelector('.chat-item__sender')){
						break;
					} else {
						prev = prev.previousElementSibling;
					}
				}
				try{


				    if (prev.querySelector(".chat-item__sender")){
					    name = prev.querySelector(".chat-item__sender").innerText;
					    if (name){
						    name = name.trim();
					    }
					    
						chatimg = prev.querySelector(".chat-item__user-avatar").querySelector("img").src;
					    //lastImage = chatimg
					  }


				} catch(e){}

			} catch(e){}
		}

		var msg = "";
		try {
			msg = ele.querySelector('.chat-message__text-content').innerText;
		} catch(e){

		}
		if (msg){
			msg = msg.trim();
			if (name){
				if (msg.startsWith(name)){
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}
		
		if (name){
			lastName = name;
			lastImage = chatimg;
		} else if (lastName){
			name = lastName;
			chatimg = lastImage;
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
		data.type = "zoom";

		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);

		if (data.chatimg && img){
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
					document.querySelector("textarea.chat-box__chat-textarea.window-content-bottom").focus();
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
	var lastHTML = "";
	function streamPollRAW(element){
		var html = element.outerHTML;       
		var data = { html: html }; 
		data.type = "zoom_poll";
		var json = JSON.stringify(data);
		if (lastHTML === json){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastHTML = json;
		pushMessage(data);
	}
	

	function onElementInserted(containerSelector) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].hasAttribute("role")){
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
		messageHistory = messageHistory.slice(-500);
		if (document.getElementById("chat-list-content")){
			if (!document.getElementById("chat-list-content").marked){
				lastName = "";
				lastImage = "";
				document.getElementById("chat-list-content").marked=true;
				onElementInserted("#chat-list-content");
			}
		}
		if (document.getElementById("poll__body")){
			streamPollRAW(document.getElementById("poll__body"));
		}
	},1000);

})();
