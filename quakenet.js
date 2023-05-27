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
			
			var msgEle = ele.querySelector('.hyperlink-whois');
			
			if (!msgEle){return;}
			console.log(msgEle);
			var name = msgEle.innerText;
			if (name){
				name = name.trim();
			} else {
				return;
			}
			
			console.log(msgEle.parentNode);
			
			if (msgEle.nextNode){
				var  msg = msgEle.nextNode().textContent;
			} else if (msgEle.nextSibling && msgEle.nextSibling.textContent){
				var msg = msgEle.nextSibling.textContent;
			} else {
				try{
					var msg = msgEle.parentNode.nextSibling.textContent;
				} catch(e){
					console.log(e);
					return;
				}
			} 
			console.log(msg);
			msg = msg.replace("> ", "");
			
			msg = msg.trim();
		} catch(e){
			console.log(e);
			return;
		}
		
		if (!msg.length){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = "";
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "quakenet";
		
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
	// settings.captureevents
	
	
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
		if (document.querySelector('.ircwindow')){
			if (!document.querySelector('.ircwindow').marked){
				document.querySelector('.ircwindow').marked=true;
				onElementInserted(document.querySelector('.ircwindow'));
			}
		}
	},1000);

})();