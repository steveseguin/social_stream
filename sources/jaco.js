(function () {
	
	
	
	var isExtensionOn = true;
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
				 .replace(/&/g, "&amp;") // i guess this counts as html
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
					if (node && node.classList && node.classList.contains("zero-width-emote")){
						resp += "<span class='zero-width-parent'>"+node.outerHTML+"</span>";
					} else {
						resp += node.outerHTML;
					}
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
	  
	  console.log(ele);
	  try {
		  try {
			var chatname = escapeHtml(ele.childNodes[0].textContent.trim())
			chatname = chatname.trim();
		  } catch(e){
			 return;
		  }
	 } catch(e){
		return;
	  }
	 
	  if (!chatname){return;}
	  
	  try {
		chatmessage = getAllContentNodes(ele.childNodes[1]);
		chatmessage = chatmessage.trim();
	  } catch(e){
		  
	  }
	  
	  if (!chatmessage){
		  return; // I'm assuming this is a deleted message
	  }
	 
	 if ((lastMessage === chatmessage) && (lastUser === chatname)){
		  lastMessage = "";
		  chatname = "";
		  return;
	  } else {
		lastMessage = chatmessage;
		lastUser = chatname;
	  }
	  
	  var hasDonation = '';
	  var chatimg = "";
	  var chatbadges= [];
	 
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.membership = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "jaco";
	  
	//  console.log(data);
	  
	 
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
	  } catch(e){
		  //
	  }
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("jaco");	return;	}
				if ("focusChat" == request){
					document.querySelector('input[type="text"][placeholder]').focus();
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
					console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].nodeName.toLowerCase() !== "p"){continue;}
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
		
		var mainChat = document.querySelector(".chat-box");
		if (mainChat){ // just in case 
			console.log("Social Stream Start");
			clearInterval(checkReady);
			
			setTimeout(function(){
				var clear = document.querySelectorAll(".chat-box>p");
				for (var i = 0;i<clear.length;i++){
					clear[i].ignore = true; // don't let already loaded messages to re-load.
				}
				console.log("Social Stream ready to go");
				onElementInserted( document.querySelector(".chat-box"));
			},500);
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