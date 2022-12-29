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
			var name="";
			try {
				name = ele.querySelector('.author').innerText;
				name = name.trim();
			} catch(e){
				name = "";
			}
			
			var msg = "";
			ele.querySelectorAll('.chatmessage > div').forEach(ee=>{
				if (ee.nodeType == Node.TEXT_NODE){
					msg += ee.textContent;
					msg = msg.trim();
				} else if (!settings.textonlymode && (ee.nodeName  == "IMG")){
					msg += "<img src='"+ee.src+"' />";
					msg = msg.trim();
				}  else {
					msg += ee.textContent;
					msg = msg.trim();
				}
			});
			
			if (!msg.length){return;}
			
			
			var data = {};
			data.chatname = name;
			data.chatbadges = "";
			data.backgroundColor = "";
			data.textColor = "";
			data.chatmessage = msg;
			data.chatimg = "";
			data.hasDonation = "";
			data.hasMembership = "";
			data.contentimg = "";
			data.type = "quickchannel";
			
			pushMessage(data);
		} catch(e){
			console.error(e);
		}
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
					document.querySelector('textarea').focus();
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

	var timer = setInterval(function(){
		if (document.querySelector('.chat-messages-container')){
			if (!document.querySelector('.chat-messages-container').marked){
				document.querySelector('.chat-messages-container').marked=true;
				clearInterval(timer);
				onElementInserted(document.querySelector('.chat-messages-container'));
			}
		}
	},3000);

})();