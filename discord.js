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
	
	
	function processMessage(ele){
		
		var chatimg = "";
		try{
		   chatimg = ele.querySelector("img[class*='avatar-']").src;
		   lastImage= chatimg
		} catch(e){
		  chatimg = lastImage;
		}
		
		var name="";
		if (ele.querySelector('[id^="message-username-"]')){
		  name = ele.querySelector('[id^="message-username-"]').innerText;
		  if (name){
			name = name.trim();
		  }
		   lastName = name;
		} else {
			name = lastName;
		}
		
		if (!name && !chatimg){
			var prev = ele.previousElementSibling;
			try {
				for (var i=0; i<30;i++){
					if (prev.querySelector('[id^="message-username-"]')){
						break;
					} else {
						prev = prev.previousElementSibling;
					}
				}
				try{
				    chatimg = prev.querySelector("img[class*='avatar-']").src;
				    lastImage= chatimg
				   
				    if (prev.querySelector('[id^="message-username-"]')){
					    name = prev.querySelector('[id^="message-username-"]').innerText;
					    if (name){
						    name = name.trim();
					    }
					    lastName = name;
					}
				   
				} catch(e){}
				
			} catch(e){}
		}

		var msg = "";
		try {
			console.log(ele);
			msg = ele.querySelector('[id^="message-content-"]').innerHTML;
		} catch(e){

		}
		if (msg){
			msg = msg.trim();
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
		
		console.log(data);
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
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('div[class*="slateTextArea"]').focus();
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
						if (mutation.addedNodes[i].id && !mutation.addedNodes[i].skip){
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
		if (document.querySelector('[data-list-id="chat-messages"]')){
			if (!document.querySelector('[data-list-id="chat-messages"]').marked){
				lastName = "";
				lastImage = "";
				document.querySelector('[data-list-id="chat-messages"]').marked=true;
				onElementInserted('[data-list-id="chat-messages"]');
			}
		}
	},1000);

})();