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
		
		var chatimg = "";
		var msg = "";
		
		try{
		   chatimg = ele.querySelector(".commenter_avatar_wrapper").querySelector("img").src;
		} catch(e){}
		
		try{
			if (ele.querySelector(".commenter_name_wrapper")){
			  var name = ele.querySelector(".commenter_name_wrapper").innerText;
			  if (name){
				name = name.trim();
			  }
			  
			  msg = ele.querySelector('.commenter_content').innerText;
			} 
		} catch(e){}
		
		if (!name){
			return; // this might be a duplicate. 
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
		data.type = "livestream";
		
		
		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		
		pushMessage(data);
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('#liveChatContainer').contentWindow.document.body.querySelector('textarea[ng-switch-when="message"]').focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
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
							if (mutation.addedNodes[i].classList.contains("comment")){
								processMessage(mutation.addedNodes[i]);
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

	setInterval(function(){
		if (document.querySelector(".chat_container")){
			if (!document.querySelector(".chat_container").marked){
				document.querySelector(".chat_container").marked=true;
				onElementInserted(document.querySelector(".chat_container"));
			}
		}
		//document.querySelectorAll('iframe').forEach( item =>{
			if (document.querySelector('#liveChatContainer').contentWindow.document.body.querySelector(".chat_container")){
				if (!document.querySelector('#liveChatContainer').contentWindow.document.body.querySelector(".chat_container").marked){
					document.querySelector('#liveChatContainer').contentWindow.document.body.querySelector(".chat_container").marked=true;
					onElementInserted(document.querySelector('#liveChatContainer').contentWindow.document.body.querySelector(".chat_container"));
				}
			}
		//});
	},1000);

})();