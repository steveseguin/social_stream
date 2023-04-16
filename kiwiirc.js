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
		
		
		
		try {
			var name = ele.querySelector('[data-nick]').dataset.nick;
			if (name){
				name = name.trim();
			} else {
				return;
			}
			
			if (settings.textonlymode){
				var msg = ele.querySelector('.kiwi-messagelist-body').textContent;
			} else {
				var msg = ele.querySelector('.kiwi-messagelist-body').innerHTML;
			}
			
			msg = msg.trim();
		} catch(e){
			return;
		}
		var isEvent=false;
		if (ele.querySelector(".kiwi-messagelist-message-traffic")){
			if (!settings.streamevents){return;}
			isEvent=true;
			chatmessage = "<i>"+chatmessage+"</i>";
		}
		
		var chatimg = ele.querySelector('.kiwi-avatar img[src]') || "";
		if (chatimg){
			chatimg = chatimg.src || "";
		}
		
		if (!msg.length){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "kiwiirc";
		data.event = isEvent;
	
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.streamevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('.keyboard-input').focus();
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
						try {
							if (!mutation.addedNodes[i].classList || !mutation.addedNodes[i].classList.contains("kiwi-messagelist-item")){return;}
							if (mutation.addedNodes[i].skip){return;}
							mutation.addedNodes[i].skip = true;
							processMessage(mutation.addedNodes[i]);
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
		if (document.querySelector('.kiwi-messagelist')){
			if (!document.querySelector('.kiwi-messagelist').marked){
				document.querySelector('.kiwi-messagelist').marked=true;
				onElementInserted(document.querySelector('.kiwi-messagelist'));
			}
		}
	},1000);

})();