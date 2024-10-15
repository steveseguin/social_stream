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

	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src.startsWith('http') || (node.src = node.src + "");
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}

	function processMessage(content){
		
		var chatname="";
		try {
			chatname = content.querySelector("span.sender-name").textContent;
			chatname = chatname.trim();
			chatname = escapeHtml(chatname);
		} catch(e){
			return;
		}
		
		var chatmessage="";
		try{
			 if (settings.textonlymode){
				chatmessage = escapeHtml(content.querySelector("div[class^='msgBody__message']").innerText);
			 } else {
				content.querySelectorAll("div[class^='msg-body__message']").forEach(ele2=>{
					ele2.childNodes.forEach(ele3=>{
						if (ele3.nodeName == "IMG"){
							if (ele3.src){
								chatmessage += "<img src='"+ele3.src+"'/>";
							}
						} else if (ele3.nodeName == "#text"){
							chatmessage += escapeHtml(ele3.textContent.trim());
						} else {
							chatmessage += escapeHtml(ele3.innerText.trim());
						}
					});
				});
			 }
		} catch(e){
			return;
		}

		var chatimg="";
		try{
			chatimg = content.querySelector("[class^='user-image']").style.backgroundImage;
			chatimg = chatimg.split('url("')[1];
			chatimg = chatimg.split('"')[0];
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
	  data.textonly = settings.textonlymode || false;
	  data.type = "omlet";
	  
	  pushMessage(data);
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && mutation.addedNodes[i].className && mutation.addedNodes[i].className.includes("msg-container")) {
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
	
	
	setInterval(function(){ // clear existing messages; just too much for a stream.
	
		if (document.querySelector(".chatContainer")){
			if (!document.querySelector(".chatContainer").set123){
				document.querySelector(".chatContainer").set123 = true;
				console.log("LOADED SocialStream EXTENSION");
				setTimeout(function(){
					try {
						var main = document.querySelectorAll("[class^='msg-container']");
						for (var j =0;j<main.length;j++){
							try{
								if (!main[j].dataset.set123){
									main[j].dataset.set123 = "true";
									//processMessage(main[j]);
								} 
							} catch(e){}
						}
					} catch(e){ }
					
					onElementInserted(".chatContainer", function(element){
						processMessage(element, false);
					});
				},1500);
			}
		}
		
	},1500);

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
					if (!document.querySelector("div[class^='textarea__chat-input-bar']")){
						sendResponse(false);
						return;
					}
					document.querySelector("div[class^='textarea__chat-input-bar']").focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();