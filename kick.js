(function () {
	
	var cachedUserProfiles = {};
	
	function getAllContentNodes(element) {
		var resp = "";
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && (node.textContent.trim().length > 0)){
				resp += node.textContent;
			} else if (node.nodeType === 1){
				resp += node.outerHTML;
			}
		});
		return resp;
	}
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			errorlog(e);
			return await fetch(URL);
		}
	}
	
	async function getKickAvatarImage(username, channelname){
		
		if (username in cachedUserProfiles){
			return cachedUserProfiles[username];
		} 
		cachedUserProfiles[username] = "";
		
		return await fetchWithTimeout("https://kick.com/channels/"+encodeURIComponent(channelname)+"/"+encodeURIComponent(username)).then(async response => {
			return await response.json().then(function (data) {
				if (data && data.profilepic){
					cachedUserProfiles[username] = data.profilepic;
					return data.profilepic;
				}
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
	async function processMessage(ele){	// twitch
	
	  if (!ele){return;}
	  
	  
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  try {
		chatname = ele.querySelector(".chat-entry-username").innerText;
		
	  } catch(e){
		  return;
	  }
	  try {
		nameColor = ele.querySelector(".chat-entry-username").style.color;
	  } catch(e){}
	  
	  if (!settings.textonlymode){
		  try {
			var chatNodes = ele.querySelectorAll(".chat-entry-content, .chat-emote-container");
			for (var i=0;i<chatNodes.length;i++){
				chatmessage += getAllContentNodes(chatNodes[i]);
			}
		  } catch(e){
			  //console.log(chatmessage);
		  }
	  } else {
		  try{
			chatmessage = ele.querySelector(".chat-entry-content").innerText;
		  } catch(e){}
	  }
	  
	  if (!chatmessage){return;}
	  
	  ele.querySelector(".chat-message-identity").querySelectorAll(".badge img[src], .badge svg").forEach(badge=>{
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


	  var hasDonation = '';
	
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
	  var chatimg = "";
	  var channelName = window.location.pathname.split("/")[1];
	  
	  if (channelName && chatname){
		  chatimg = await getKickAvatarImage(chatname, channelName) || "";
	  }
	  
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.hasMembership = "";
	  data.type = "kick";
	  
	  if (!chatmessage && !hasDonation){
		return;
	  }
	  
	  //if (brandedImageURL){
	  //  data.sourceImg = brandedImageURL;
	  //}
	  
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
					document.querySelector('#message-input').focus();
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
						try {
							if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.chatEntry){
								if (pastMessages.includes(mutation.addedNodes[i].dataset.chatEntry)){continue;}
							
								pastMessages.push(mutation.addedNodes[i].dataset.chatEntry)
								pastMessages = pastMessages.slice(-300);
								processMessage(mutation.addedNodes[i]);
								
							} else if (mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner")){
								let ele = mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner");
								console.log(ele.cloneNode(true));
								processMessage(ele);
							}
						} catch(e){}
					}
				}
			});
		};
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	var pastMessages = [];
	
	console.log("Social stream injected");
	var xxx = setInterval(function(){
		if (document.getElementById("chatroom")){
			clearInterval(xxx);
			setTimeout(function(){
				var clear = document.querySelectorAll("div[data-chat-entry]");
				for (var i = 0;i<clear.length;i++){
					pastMessages.push(clear[i].dataset.chatEntry);
				}
				onElementInserted(document.getElementById("chatroom"));
			},3000);
		}
	},1000);
	
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