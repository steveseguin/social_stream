(function () {
	
	var cachedUserProfiles = {};
	
	
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
	
	function getAllContentNodes(element) {
		var resp = "";
		if (element.classList && element.classList.contains("ch-item-quote")){return "";}
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (settings.textonlymode){return "";}
				resp += node.outerHTML;
			}
		});
		return resp;
	}
	
	
	async function processMessage(ele){	// twitch
	
	  if (!ele){return;}

	  try {
		var chatname = ele.querySelector("[data-username]").dataset.username.trim();
	  } catch(e){
		//  warnlog(e);
		  return;}
	  
	  try {
			var chatimg = ele.querySelector(".ch-item-userpic img[src]").src || "";
	  } catch(e){
			var chatimg = "";
	  }
	  var chatmessage = "";
	  
	  try {
		chatmessage = getAllContentNodes(ele.querySelector(".ch-item-text")) || "";
	  } catch(e){
		//  warnlog(e);
	  }
	  
	  
	  chatmessage = chatmessage.trim();
	  
	  if (!chatmessage){return;}
	  
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";;
	  data.nameColor = "";;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "tradingview";
	  
	  console.log(data);
	  
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
					document.querySelector('textarea.message-input').focus();
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
	
	var lastMessage = "";
	var settings = {};
	
	
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
						if (mutation.addedNodes[i].classList && mutation.addedNodes[i].classList.contains("ch-item")){
							if (mutation.addedNodes[i].set123){continue;}
							mutation.addedNodes[i].set123 = "true";
							processMessage(mutation.addedNodes[i]);
						};
					}
				}
			});
		};
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	
	console.log("Social stream injected");
	var xxx = setInterval(function(){
		if (document.querySelector(".tv-chat-scroll-container")){
			clearInterval(xxx);
			
			var clear = document.querySelectorAll(".ch-item");
			for (var i = 0;i<clear.length;i++){
				clear[i].set123 = "true";
				processMessage(clear[i]);
			}
			onElementInserted(document.querySelector(".tv-chat-scroll-container"));
		}
	},2000);
	
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
	}

})();