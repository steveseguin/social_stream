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


	function getTwitchAvatarImage(username){
		fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username="+encodeURIComponent(username)).then(response => {
			response.text().then(function (text) {
				if (text.startsWith("https://")){
					brandedImageURL = text;
				} 
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	var channelName = "";
	var brandedImageURL = "";
	var xx = window.location.pathname.split("/");
	var index = xx.indexOf("chat");
	if (index > -1) {
	  xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("u");
	if (index > -1) {
	  xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("moderator");
	if (index > -1) {
	  xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("dashboard");
	if (index > -1) {
	  xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("");
	if (index > -1) {
	  xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("popout");
	if (index > -1) {
	  xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	if (xx[0]){
		channelName = xx[0];
		getTwitchAvatarImage(xx[0]);
	}
	
	function getAllContentNodes(element) {
		var resp = "";
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && (node.textContent.trim().length > 0)){
				if (settings.textonlymode){
					resp += node.textContent.trim()+" ";
				} else {
					resp += node.textContent.trim()+" ";
				}
			} else if (node.nodeType === 1){
				if (settings.textonlymode){
					if ("alt" in node){
						resp += node.alt.trim()+" ";
					}
				} else {
					resp += node.outerHTML;
				}
			} 
		});
		return resp;
	}
	
	var lastMessage = "";
	var lastUser  = "";
	
	function processMessage(ele){	// twitch
	
	  
	
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	  
	  try {
		var nameEle = ele.querySelector(".chat-author__display-name");
		var chatname = nameEle.innerText;
		try {
			nameColor = nameEle.style.color;
		} catch(e){}
	  } catch(e){
	  }
	  
	  var chatbadges = [];
	  try {
		  ele.querySelectorAll("img.chat-badge[src]").forEach(badge=>{
			chatbadges.push(badge.src);
		  });
		  
	  } catch(e){}
	  
	  try {
		var BTT = ele.querySelectorAll('.bttv-tooltip');
		for (var i=0;i<BTT.length;i++){
			BTT[i].outerHTML = "";
		}
	  } catch(e){}
	  
	  try {
		var eleContent = ele.querySelector(".seventv-message-context") || ele.querySelector('*[data-test-selector="chat-line-message-body"]');
		chatmessage = getAllContentNodes(eleContent);
	  } catch(e){}
	 
	  if (!chatmessage){
		  try {
			var eleContent = ele.querySelector('span.message');
			
			chatmessage = getAllContentNodes(eleContent);
		  } catch(e){}
	  }
	  
	  if (!chatmessage){
		  try {
			var eleContent = ele.querySelector(".chat-line__message-container .chat-line__username-container").nextElementSibling.nextElementSibling;
			chatmessage = getAllContentNodes(eleContent);
			
			eleContent = eleContent.nextElementSibling;
			var count = 0;
			while (eleContent){
				count++;
				chatmessage += getAllContentNodes(eleContent);
				eleContent = eleContent.nextElementSibling;
				if (count>20){
					break
				}
			}
		  } catch(e){}
	  }
		  
	 if (chatmessage){
		 chatmessage = chatmessage.trim();
	 }
	 
	 if ((lastMessage === chatmessage) && (lastUser === chatname)){
		  lastMessage = "";
		  chatname = "";
		  return;
	  } else {
		lastMessage = chatmessage;
		lastUser = chatname;
	  }
	  
	  if (channelName && settings.customtwitchstate){
		if (settings.customtwitchaccount && settings.customtwitchaccount.textsetting && (settings.customtwitchaccount.textsetting.toLowerCase() !== channelName.toLowerCase())){
			return;
		} else if (!settings.customtwitchaccount){
			return;
		}
	  }
	  
	  var donations = 0;
	  try {
		var elements = ele.querySelectorAll('.chat-line__message--cheer-amount'); // FFZ support
		
		for (var i=0;i<elements.length;i++){
			donations += parseInt(elements[i].innerText);
		}
		if (donations==1){
			donations += " bit";
		} else if (donations>1){
			donations += " bits";
		}
	  } catch(e){}

	  var hasDonation = '';
	  if (donations) {
		hasDonation = donations;
	  }
	  
	  if (!chatmessage && !hasDonation && !chatname){
		return;
	  }

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  try {
		data.chatimg = "https://api.socialstream.ninja/twitch/?username="+encodeURIComponent(chatname); // this is CORS restricted to socialstream, but this is to ensure reliability for all
	  } catch(e){
		  data.chatimg = "";
	  }
	  data.hasDonation = hasDonation;
	  data.hasMembership = "";
	  data.type = "twitch";
	  
	 // console.log(data);
	  
	  if (brandedImageURL){
		data.sourceImg = brandedImageURL;
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
					document.querySelector('[data-a-target="chat-input"]').focus();
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
	// settings.streamevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInsertedTwitch(target, className, callback) {
		var onMutationsObserved = function(mutations) {
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							
							
							if (mutation.addedNodes[i].ignore){continue;}
							mutation.addedNodes[i].ignore=true;
							
							
							if (mutation.addedNodes[i].className && mutation.addedNodes[i].classList.contains(className)) {
								callback(mutation.addedNodes[i]);
								mutation.addedNodes[i].ignore=true;
							} else {
								try{
									var childEle = mutation.addedNodes[i].querySelector("."+className);
									if (childEle){
										if (childEle.ignore){continue;}
										callback(childEle);
										mutation.addedNodes[i].ignore=true;
										childEle.ignore=true;
									}
								} catch(e){}
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
	
	console.log("Social Stream injected");
	
	var checkReady = setInterval(function(){
		var target = document.querySelector(".chat-scrollable-area__message-container");
		if (target){
			console.log("Social Stream Start");
			clearInterval(checkReady);
			var clear = document.querySelectorAll(".chat-line__message");
			for (var i = 0;i<clear.length;i++){
				clear[i].ignore = true; // don't let already loaded messages to re-load.
			}
			onElementInsertedTwitch(target, "chat-line__message", function(element){
			  setTimeout(function(element){processMessage(element);},20, element); // 20ms to give it time to load the message, rather than just the container
			});
		} else if (document.querySelector(".chat-line__message")){ // just in case 
			var target = document.querySelector(".chat-line__message");
			if (target && target.parentNode){
				console.log("Social Stream Start");
				clearInterval(checkReady);
				var clear = document.querySelectorAll(".chat-line__message");
				for (var i = 0;i<clear.length;i++){
					clear[i].ignore = true; // don't let already loaded messages to re-load.
				}
				onElementInsertedTwitch(target.parentNode, "chat-line__message", function(element){
				  setTimeout(function(element){processMessage(element);},20, element); // 20ms to give it time to load the message, rather than just the container
				});
			}
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
		console.log(e);
	}

})();