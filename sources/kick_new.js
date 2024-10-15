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
				if (node.classList && node.classList.contains("seventv-painted-content")){
					resp += node.outerHTML;
				} else if (node && (node.tagName == "A")){
					resp += " " + getAllContentNodes(node).trim() + " ";
				} else {
					resp += getAllContentNodes(node)
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (node && node.classList && node.classList.contains("zero-width-emote")){
					resp += "<span class='zero-width-parent'>"+node.outerHTML+"</span>";
				} else if (node && (node.tagName == "A")){
					resp += " " + node.outerHTML.trim() + " ";
				} else {
					resp += node.outerHTML;
				}
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
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	async function processMessage(ele){	// twitch
	
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	
	  if (!ele){return;}
	  
	  if (!ele.isConnected){return;}
	  
	  
	  if (settings.customkickstate) {
		return;
	  }
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  try {
		chatname = escapeHtml(ele.querySelector("button[title]").innerText);
		
	  } catch(e){
		  return;
	  }
	  try {
		nameColor = ele.querySelector("button[title]").style.color;
	  } catch(e){}
	  
	  
	  
	  if (!settings.textonlymode){
		  try {
			var chatNodes = ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
			if (!chatNodes.length){
				chatNodes = ele.querySelectorAll(".chat-entry-content, .chat-emote-container, .break-all");
			} else {
				chatNodes = ele.querySelectorAll("seventv-container, .chat-emote-container, .seventv-painted-content"); // 7tv support, as of june 20th
			}
			
			if (!chatNodes.length){
				let tmp = ele.querySelector("div span[class^='font-normal']");
				if (tmp){
					chatmessage = getAllContentNodes(tmp);
					chatmessage = chatmessage.trim();
				}
			} 
		  } catch(e){
		  }
	  } else {
		  if (!chatNodes.length){
			let tmp = ele.querySelector("div span[class^='font-normal']");
			if (tmp){
				chatmessage = getAllContentNodes(tmp);
				chatmessage = chatmessage.trim();
			}
		  }
	  }
	  
	  if (!chatmessage){return;}
	  
	  
	  ele.querySelectorAll("div > div > div > div > div > div[data-state] img[src], div > div > div > div > div > div[data-state] svg").forEach(badge=>{
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
	  data.membership = "";
	  data.textonly = settings.textonlymode || false;
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

	function onElementInserted(target, subtree=false) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0; i < mutation.addedNodes.length; i++) {
						try {
							if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.index){
								if (pastMessages.includes(mutation.addedNodes[i].dataset.index)){continue;}
							
								pastMessages.push(mutation.addedNodes[i].dataset.index)
								pastMessages = pastMessages.slice(-300);
								
								if (SevenTV){
									setTimeout(function(ele){
										processMessage(ele);
									}, 300, mutation.addedNodes[i]); // give seventv time to load, before parsing the message
								} else {
									processMessage(mutation.addedNodes[i]);
								}
								
							} else if (mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner")){
								let ele = mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner");
								
								processMessage(ele);
							}
						} catch(e){}
					}
				}
			});
		};
		var config = { childList: true, subtree: subtree };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	var pastMessages = [];
	var SevenTV = false;
	
	console.log("Social stream injected");
	var xxx = setInterval(function(){
		if (document.querySelectorAll("#chatroom-messages > div").length){
			clearInterval(xxx);
			setTimeout(function(){
				if (document.getElementById("seventv-extension")){
					SevenTV = true;
				}
				var clear = document.querySelectorAll("div[data-chat-entry]");
				for (var i = 0;i<clear.length;i++){
					pastMessages.push(clear[i].dataset.chatEntry);
				}
				onElementInserted(document.querySelectorAll("#chatroom-messages > div")[0], false);
				if (document.querySelectorAll("#chatroom-messages > div").length>1){
					onElementInserted(document.querySelectorAll("#chatroom-messages > div")[1], true);
				}
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