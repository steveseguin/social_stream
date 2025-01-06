(function () {
	
	
	async function fetchWithTimeout(URL, timeout=8000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			errorlog(e);
			return await fetch(URL); // iOS 11.x/12.0
		}
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
				resp += escapeHtml(node.textContent.trim())+" ";
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
	
	
	var lastMessage = "";
	var lastUser  = "";
	
	async function processMessage(ele){	// twitch
	
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	  try {
		  try {
			var nameEle = ele.querySelector("div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1)");
			var chatname = escapeHtml(nameEle.innerText);
		  } catch(e){
			 return;
		  }
	 } catch(e){
		try {
			var nameEle = ele.querySelector("div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1)");
			var chatname = escapeHtml(nameEle.innerText);
		  } catch(e){
			return;
		  }
	  }
	  
	  chatname = chatname.trim();
	  if (!chatname){return;}
	  
	  var chatbadges = [];
	  var hasDonation = '';
	  var contentimg = "";
	  
	  try {
		var eleContent = ele.querySelector("span[class]:not([role])");
		chatmessage = getAllContentNodes(eleContent).trim();
	  } catch(e){ // donation?
	  }
	  
	  if (!chatmessage){
		  try {
			contentimg = ele.querySelector("button>img[src][alt='stickers']").src;
		  } catch(e){
		  }
	  }
	  
	 if (chatmessage){
		 chatmessage = chatmessage.trim();
	 }
	 
	  if (chatmessage && chatmessage.startsWith("[Message ")){
		  return; // I'm assuming this is a deleted message
	  }
	 
	 if (chatmessage && (lastMessage === chatmessage) && (lastUser === chatname)){
		  lastMessage = "";
		  chatname = "";
		  return;
	  } else {
		lastMessage = chatmessage;
		lastUser = chatname;
	  }
	  
	  
	  var chatimg = "";
	  try {
			chatimg =  ele.querySelector("div:nth-of-type(1) > span>img[src]").src;
			
			 if (chatimg.startsWith("data:")){
				  try {
					 await new Promise(r => setTimeout(r, 50));
					 chatimg =  ele.querySelector("div:nth-of-type(1) > span>img[src]").src;
					  if (chatimg.startsWith("data:")){
						  await new Promise(r => setTimeout(r, 100));
						  chatimg =  ele.querySelector("div:nth-of-type(1) > span>img[src]").src;
						  if (chatimg.startsWith("data:")){
								await new Promise(r => setTimeout(r, 200));
								chatimg =  ele.querySelector("div:nth-of-type(1) > span>img[src]").src;
								if (chatimg.startsWith("data:")){
									chatimg = ""; // and I give up if it still isn't loaded.
								}
						  }
					  }
				  } catch(e){
					  chatimg = "";
				  }
			  }
	  
			
			if (chatimg && !chatimg.startsWith("https://loco.gg/")){
				chatimg = "https://loco.gg" + chatimg;
			}
			chatimg = chatimg.replace(".jpg&w=48&q=25", ".jpg&w=128&q=80");
	  } catch(e){}

	  
	 
	  if (!chatmessage && !hasDonation && !contentimg){
		return;
	  }

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.contentimg = contentimg;
	  data.hasDonation = hasDonation;
	  data.membership = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "loco";
	  
	 
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
	  } catch(e){
		  //
	  }
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('div>div>input[placeholder][type="text"]').focus();
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
				// twitch doesn't capture avatars already.
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].nodeName.toLowerCase() !== "div"){continue;}
							if (mutation.addedNodes[i].ignore){continue;}
							mutation.addedNodes[i].ignore=true;
							processMessage(mutation.addedNodes[i]);
								
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("Social Stream injected");
	
	var checkReady = setInterval(function(){
		
		if (!window.location.pathname.startsWith("/streamers/")){return;}
		
		var mainChat = document.querySelector(".chat-elements-list");
		if (mainChat){ // just in case 
			console.log("Social Stream Start");
			clearInterval(checkReady);
			
			setTimeout(function(){
				var clear = mainChat.childNodes;
				for (var i = 0;i<clear.length;i++){
					clear[i].ignore = true; // don't let already loaded messages to re-load.
					//processMessage(clear[i]);
				}
				console.log("Social Stream ready to go");
				onElementInserted(mainChat);
			},1000);
		} 
	},500);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(e){
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