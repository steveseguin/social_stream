(function () {
	
	var isExtensionOn = true;
function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
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

	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (25 * 1024)) {
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

	function processMessage(ele){
		
		//console.warn(ele);
		
		var chatname="";
		try {
			chatname = ele.querySelector(".dlive-name__text, .dlive-name, .sender-name").textContent;
			chatname = chatname.replace(":","");
			chatname = chatname.trim();
			chatname = escapeHtml(chatname);
			console.log(chatname);
		} catch(e){
			return;
		}
		var eventType = false;
		var chatmessage="";
		try{
			 if (settings.textonlymode){
				chatmessage = escapeHtml(ele.querySelector(".chatrow-inner").querySelector("span.linkify").innerText);
			 } else {
				chatmessage = ""
				ele.querySelectorAll("span.linkify>span").forEach(ele2=>{
					if (ele2.querySelector("img")){
						chatmessage += "<img src='"+ele2.querySelector("img").src+"'/>";
					} else {
						chatmessage += escapeHtml(ele2.innerText);
					}
				});
			 }
		//	 console.warn(chatmessage);
		} catch(e){
		//	console.error(e);
			
		}
		if (!chatmessage){
			try {
				chatmessage = getAllContentNodes(ele.querySelector(".chatrow-link").nextSibling);
			//	console.warn(chatmessage);
				eventType = true;
				if (chatmessage.includes("followed!")){
					eventType = "followed";
				}
			} catch (e){
			//	console.error(e);
				return;
			}
		}
		
		chatmessage = chatmessage.trim();

		var chatimg="";
		try{
			chatimg = ele.querySelector("img.sender-avatar,img.avatar-img").src;
			chatimg = chatimg.replace("25x25","200x200");
		} catch(e){
			chatimg = "";
		}
	// console.warn(chatimg);

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
	  data.type = "dlive";
	  data.event = eventType;
	  
	 // console.log(data);
	  pushMessage(data);
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i]) {
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
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	console.log("social stream injected");
	
	
	setTimeout(function(){ // clear existing messages; just too much for a stream.
		console.log("LOADED SocialStream EXTENSION");
		try {
			var main = document.querySelector("#chat-body > .chatbody").childNodes;
			for (var j =0;j<main.length;j++){
				try{
					if (!main[j].dataset.set123){
						main[j].dataset.set123 = "true";
					//	processMessage(main[j]);
					} 
				} catch(e){}
			}
		} catch(e){ }
	},1900);
	
	
	setInterval(function(){ // lets just see if the chat has been updated or something
	
		//if (window.location.pathname.startsWith("/c/")){
			if (document.querySelector("#chat-body > .chatbody")){
				if (!document.querySelector("#chat-body > .chatbody").dataset.set123){
					console.log("SocialStream Active");
					document.querySelector("#chat-body > .chatbody").dataset.set123 = "true";
					onElementInserted("#chat-body > .chatbody", function(element){
					  processMessage(element, false);
					});
				}
			}
	//	}
	}, 2000);

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
				if ("getSource" == request){sendResponse("dlive");	return;	}
				if ("focusChat" == request){
					if (!document.querySelector("textarea[placeholder]")){
						sendResponse(false);
						return;
					}
					document.querySelector("textarea[placeholder]").focus();
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
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(event){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				if (document.hidden){ // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e){}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate ||	remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e){localConnection.sendChannel.send("CONNECTED");};
		localConnection.sendChannel.onclose =  function(e){};
		localConnection.sendChannel.onmessage = function(e){};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() =>	{
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch(e){
		console.log(e);
	}

	
})();
