(function () {
	try {
	
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
		
		if (element?.className.includes("senderName_")){return resp;}
		
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
	
	const messageHistory = [];
	const TWO_MINUTES = 2 * 60 * 1000;

	function checkMessage(message) {
		const now = Date.now();
		messageHistory.forEach((entry, index) => {
			if (now - entry.timestamp > TWO_MINUTES) {
				messageHistory.splice(index, 1);
			}
		});
		
		const isDuplicate = messageHistory.some(entry => 
			entry.content === message && now - entry.timestamp <= TWO_MINUTES
		);
		
		if (!isDuplicate) {
			messageHistory.push({ content: message, timestamp: now });
			return false;
		}
		return true;
	}
	
	async function processMessage(ele){	// twitch
	
	
		//console.log(ele);
		
		try {
			
			if (ele.nextSibling || !ele.isConnected){
				return;
			}
			
		  if (!ele.querySelector("[data-testid='message-timeWrapper']") || (ele.querySelector("[data-testid='message-timeWrapper']").textContent !== "now")){
			return;  
		  }
			
		  var chatsticker = false;
		  var chatmessage = "";
		  var nameColor = "";
		  var chatname = escapeHtml(ele.querySelector("[class^='senderName_name']").textContent);
		  
		  chatname = chatname.trim();
		  if (!chatname){return;}
		  
		  var chatbadges = [];
		  var hasDonation = '';
		  var contentimg = "";
		  
		  ele.querySelectorAll("[class^='senderName_iconWrapper'] svg").forEach(badge=>{
			try {
				if (badge && badge.nodeName == "IMG"){
					var tmp = {};
					tmp.src = badge.src;
					tmp.type = "img";
					chatbadges.push(tmp);
				} else if (badge && badge.nodeName.toLowerCase() == "svg"){
					var tmp = {};
					tmp.html = badge.outerHTML;
					tmp.type = "svg";
					chatbadges.push(tmp);
				}
			} catch(e){  }
		  });
		  
		  
		  
		  try {
			var eleContent = ele.querySelector("[class^='messageBody_textWrapper'] > p");
			chatmessage = getAllContentNodes(eleContent).trim();
		  } catch(e){ // donation?
		  }
		 
		  if (chatmessage){
			 chatmessage = chatmessage.trim();
		  }
		 
		  if (!chatmessage){
			  return;
		  }
		  
		  if (chatmessage ===  "now"){
			  return;
		  }
		 
		  var chatimg = "";
		  try {
				chatimg = ele.querySelector("img[data-testid^='avatar-'][src]")?.src || "";
		  } catch(e){}

	  } catch(e){
		  //console.log(e);
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
	  data.type = "onlinechurch";
	  
	  
	  if (checkMessage(chatname+"::"+chatmessage)){
		  return;
	  }
	 
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
					document.querySelector('#publicchat textarea[placeholder][maxlength]').focus();
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
		if (response && "settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
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
		
		var mainChat = document.querySelector("#publicchat [data-testid='feed-objectList']");
		if (mainChat){ // just in case 
			if (mainChat.set){
				return;
			}
			console.log("Social Stream Start");
			mainChat.set = true;
			
			setTimeout(()=>{
				var clear = document.querySelector("#publicchat [data-testid='feed-objectList']");
				if (clear){
					for (var i = 0;i<clear.length;i++){
						clear[i].ignore = true; // don't let already loaded messages to re-load.
						//console.log("doing what I shouldn't be doing?");
						//processMessage(clear[i]);
					}
					//console.log("Social Stream ready to go");
					onElementInserted(document.querySelector("#publicchat [data-testid='feed-objectList']"));
				}
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
	} catch(e){
		console.log(e);
	}

})();