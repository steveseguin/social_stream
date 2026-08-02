(function () {
	
	var isExtensionOn = true;
function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

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
	
	function digInto(eles){
		var chatmessage = "";
		eles.forEach(ele2=>{
			try {
				if (ele2.nodeType == Node.TEXT_NODE){
					chatmessage += escapeHtml(ele2.textContent);
				} else if (ele2 && ele2.querySelector && ele2.querySelector("img[src]")){
					chatmessage += "<img src='"+ele2.querySelector("img[src]").src+"'/>";
				} else {
					chatmessage += digInto(ele2.childNodes);
				}
			} catch(e){}
		});
		return chatmessage;
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
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	async function processMessage(content){
		var messageElement = null;
		try {
			if (content.matches && content.matches("[id^='Message_']")) {
				messageElement = content;
			} else {
				messageElement = content.querySelector("[id^='Message_']");
			}
		} catch(e){}
		if (!messageElement){return;}

		var messageGroup = messageElement;
		var buttons = [];
		try {
			while (messageGroup && messageGroup !== document.body) {
				buttons = messageGroup.querySelectorAll("button");
				if (buttons.length > 1 && buttons[0].querySelector("img")){
					break;
				}
				messageGroup = messageGroup.parentElement;
			}
		} catch(e){}
		
		var chatname="";
		try{
			chatname = escapeHtml(buttons[1].textContent);
		} catch(e){
			chatname = "";
		}
		
		var chatimg="";
		try{
			chatimg = buttons[0].querySelector("img").src;
		} catch(e){
			chatimg = "";
		}
		
		var chatmessage="";
		try{
			 if (settings.textonlymode){
				chatmessage = escapeHtml(messageElement.textContent);
			 } else {
				chatmessage = digInto(messageElement.childNodes)
			 }
		} catch(e){
			return;
		}

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.membership = "";;
	  data.contentimg = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "piczel";
	  
	  
	  
	  if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
			
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].nodeType !== 1){continue;}
							var messages = [];
							if (mutation.addedNodes[i].matches("[id^='Message_']")){
								messages.push(mutation.addedNodes[i]);
							}
							mutation.addedNodes[i].querySelectorAll("[id^='Message_']").forEach(function(message){
								messages.push(message);
							});
							messages.forEach(function(message){
								if (message.dataset.set123){return;}
								message.dataset.set123 = "true";
								callback(message);
							});
						} catch(e){}
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
		if (document.querySelector("#PiczelChat") && !document.querySelector("#PiczelChat").marked){
			document.querySelector("#PiczelChat").marked = true;
			console.log("LOADED SocialStream EXTENSION");
			
			try{
				if (location.pathname.startsWith("/chat/")){
					document.querySelectorAll("nav button").forEach(ele=>{
						ele.disabled = true;
					});
				}
			} catch(e){}
			
			try {
				document.querySelectorAll("#PiczelChat [id^='Message_']").forEach(function(message){
					message.dataset.set123 = "true";
				});
			} catch(e){ }
			
			onElementInserted("#PiczelChat", function(first){
				processMessage(first);
			});
		}
		
	},2000);

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("piczel");	return;	}
				if ("focusChat" == request){
					if (!document.querySelector("[class='cm-line']")){
						sendResponse(false);
						return;
					}
					document.querySelector("[class='cm-line']").focus();
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
