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

	function processMessage(ele, wss=true){

	  if(ele.hasAttribute("is-deleted")) {
		return;
	  }
	  
	  var chatname = "";
	  try{
		chatname = ele.querySelector(".message-author").innerText;
	  } catch(e){}
	  
	  var chatmessage = "";
	  try{
		chatmessage = ele.querySelector(".message-text").innerHTML;
	  } catch(e){}
	  
	  if (textOnlyMode){
		   try{
				chatmessage = ele.querySelector(".message-text").innerText;
		   } catch(e){}
	  }
	  
	  if (!chatmessage && !hasDonation){return;}
	  
	  var chatimg = "";
	  var chatdonation = "";
	  var chatmembership = "";
	  var chatsticker = "";
	  var chatbadges = "";
	  var hasDonation = '';
	  var hasMembership = '';

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.chatmessage = chatmessage;
	  data.chatimg = ""; // Doesn't seem to be an avatar image for owncast
	  data.hasDonation = hasDonation;
	  data.hasMembership = hasMembership;
	  data.type = "owncast";
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
	  } catch(e){}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("div#message-input").focus();
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

	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});  /////

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && mutation.addedNodes[i].className && mutation.addedNodes[i].classList.contains("message")) {
							callback(mutation.addedNodes[i]);
						}
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
		var target = document.querySelector("#messages-only, #messages-container");
		if (target && !target.set123){
			target.set123 = true;
			onElementInserted(target, function(element){
			  processMessage(element, false);
			});
		}
	},1000);
	
	
})();