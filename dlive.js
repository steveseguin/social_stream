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

	function processMessage(ele){
		var content = ele.childNodes[0].childNodes[0];
		
		var chatname="";
		try {
			chatname = content.querySelector(".dlive-name__text").textContent;
			chatname = chatname.replace(":","");
			chatname = chatname.trim();
		} catch(e){
			return;
		}
		
		var chatmessage="";
		try{
			 if (textOnlyMode){
				chatmessage = content.querySelector(".chatrow-inner").querySelector("span.linkify").innerText;
			 } else {
				chatmessage = ""
				content.querySelectorAll("span.linkify>span").forEach(ele2=>{
					if (ele2.querySelector("img")){
						chatmessage += "<img src='"+ele2.querySelector("img").src+"'/>";
					} else {
						chatmessage += ele2.innerText;
					}
				});
			 }
		} catch(e){
			return;
		}

		var chatimg="";
		try{
			chatimg = content.querySelector("img.sender-avatar,img.avatar-img").src;
			chatimg = chatimg.replace("25x25","200x200");
		} catch(e){
			chatimg = "";
		}
	  

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";;
	  data.contentimg = "";
	  data.type = "dlive";
	  
	  pushMessage(data);
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && mutation.addedNodes[i].className && mutation.addedNodes[i].classList.contains("chat-row-wrap")) {
							if (!mutation.addedNodes[i].dataset.set123){
								mutation.addedNodes[i].dataset.set123 = "true";
								callback(mutation.addedNodes[i]);
							}
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
	
	
	setTimeout(function(){ // clear existing messages; just too much for a stream.
		console.log("LOADED SocialStream EXTENSION");
		try {
			var main = document.querySelectorAll(".chat-row-wrap");
			for (var j =0;j<main.length;j++){
				try{
					if (!main[j].dataset.set123){
						main[j].dataset.set123 = "true";
						//processMessage(main[j]);
					} 
				} catch(e){}
			}
		} catch(e){ }
		
		onElementInserted("#chat-body", function(element){
		  processMessage(element, false);
		});
		
	},1500);

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

	
})();