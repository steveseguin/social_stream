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
		

		var img = false;
		var chatimg = "";
		try{
		   chatimg = ele.querySelector(".chat-item__user-avatar").querySelector("img").src;
		   img = true;
		} catch(e){

		}

		if (ele.querySelector(".chat-item__sender")){
		  var name = ele.querySelector(".chat-item__sender").innerText;
		  if (name){
			name = name.trim();
		  }
		} else {
		  var sibling = ele;
		  while (sibling.previousSibling && (sibling.previousSibling.role == "alert")){
			sibling = sibling.previousSibling;
			if (sibling.querySelector(".chat-item__sender")){
				var name = sibling.querySelector(".chat-item__sender").innerText;
				if (name){
					name = name.trim();
					break;
				}
			}
		  }
		}

		var msg = "";
		try {
			console.log(ele);
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

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("textarea.chat-box__chat-textarea.window-content-bottom").focus();
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
		if (document.getElementById("chat-list-content")){
			if (!document.getElementById("chat-list-content").marked){
				document.getElementById("chat-list-content").marked=true;
				onElementInserted("#chat-list-content");
			}
		}
	},1000);

})();