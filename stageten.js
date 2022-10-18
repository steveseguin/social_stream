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

	function processMessage(content){
		
		var chatname="";
		try {
			chatname = content.querySelector(".display-name").textContent;
			chatname = chatname.trim();
		} catch(e){
			return;
		}
		
		var chatmessage="";
		try{
			 if (textOnlyMode){
				chatmessage = content.querySelector(".message-text").innerText;
			 } else {
				var ele2 = content.querySelector(".message-text");
				ele2.childNodes.forEach(ele3=>{
					if (ele3.nodeName == "IMG"){
						if (ele3.src){
							chatmessage += "<img src='"+ele3.src+"'/>";
						}
					} else if (ele3.nodeName == "#text"){
						chatmessage += ele3.textContent.trim();
					} else {
						chatmessage += ele3.innerText.trim();
					}
				});
			 }
		} catch(e){
			return;
		}

		var chatimg ="" ;// lame
	  

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
		data.type = "stageten";

		pushMessage(data);
	}
	
	
	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && (mutation.addedNodes[i].tagName == "LI")) {
							if (!mutation.addedNodes[i].dataset.set123){
								mutation.addedNodes[i].dataset.set123 = "true";
								callback(mutation.addedNodes[i]);
							}
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
	
	
	setInterval(function(){ // clear existing messages; just too much for a stream.
	
		if (document.querySelector("ol")){
			if (!document.querySelector("ol").set123){
				document.querySelector("ol").set123 = true;
				console.log("LOADED SocialStream EXTENSION");
				try {
					var main = document.querySelectorAll("li");
					for (var j =0;j<main.length;j++){
						try{
							if (!main[j].dataset.set123){
								main[j].dataset.set123 = "true";
								//processMessage(main[j]);
							} 
						} catch(e){}
					}
				} catch(e){ }
				
				onElementInserted(document.querySelector("ol"), function(element){
					processMessage(element, false);
				});
			}
		}
		
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
					if (!document.querySelector("form>div>input")){
						sendResponse(false);
						return;
					}
					document.querySelector("form>div>input").focus();
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