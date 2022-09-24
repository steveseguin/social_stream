(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

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
	
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}


	async function processMessage(ele){
		try {
		  var chatdonation = false;
		  var chatmembership = false;
		  var chatsticker = false;
		  
		  var chatname = ele.querySelector(".username").innerText;
		  
		  var chatmessage = ele.querySelector(".message-content").innerText;
		  
		  if (!chatmessage){
			   return;
		  }
		  var chatimg = ele.parentNode.querySelector(".profile-logo > img").src;
		  var chatbadges = "";
		  var hasDonation = '';
		  var hasMembership = '';
		  var backgroundColor = "";
		  var textColor = "";

		  var data = {};
		  data.chatname = chatname;
		  data.chatbadges = chatbadges;
		  data.backgroundColor = backgroundColor;
		  data.textColor = textColor;
		  data.chatmessage = chatmessage;
		  data.chatimg = chatimg;
		  data.hasDonation = hasDonation;
		  data.hasMembership = hasMembership;
		  data.type = "mobcrush";
		  
		  pushMessage(data);
		} catch(e){
		}
	}
	
	
	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (!mutation.addedNodes[i].children || !mutation.addedNodes[i].children.length){continue;}
						
						var ttt = mutation.addedNodes[i].querySelector(".trovo");
						if (!ttt){
							ttt = mutation.addedNodes[i];
						}
						try {
							if (!ttt.children || !ttt.children.length){continue;}
							if (ttt.dataset.set123){continue;}
							ttt.dataset.set123 = "true";
							callback(ttt);
							
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
	if (window.location === window.parent.location ) {
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("focusChat" == request){
						if (!document.querySelector("textarea[placeholder]")){
							sendResponse(false);
							return;
						}
						document.querySelector("textarea[placeholder]").focus();
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
				} catch(e){	}
				
				sendResponse(false);
			}
		);
		
		setTimeout(function(){
			chrome.runtime.sendMessage(chrome.runtime.id, { "inject": "mobcrush" });
		},4000);
		
		return;
	} else if (document.body.id !== "app"){
		return;
	}

	console.log("social stream injected");
	
	try {
		onElementInserted(document.body, function(element){
			processMessage(element);
		});
	} catch(e){}
	

	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});

	

	
})();