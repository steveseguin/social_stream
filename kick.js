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
	
	  console.log(ele)
	  if (!ele){return;}
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	 
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  var cloned =  ele.cloneNode(true);
	  var chat_message_identity = cloned.querySelectorAll("[class*='chat-message-identity']")[0];
	  var author = chat_message_identity.querySelector("span .chat-entry-username");
	  chatname = author.innerText;
	  nameColor = author.style.color;
	  badges = chat_message_identity.children[0].querySelectorAll("svg, img[src]");

	if (badges.length > 0) {
		badges.forEach( (badge) => {
			var tmp = {};
			switch(badge.nodeName.toLowerCase()) {
				case 'img':
					tmp = {
						src: badge.src,
						type: "img"
					}
					chatbadges.push(tmp);
					break;
				case 'svg':
					tmp = {
						html: badge.outerHTML,
						type: "svg",
					}
					chatbadges.push(tmp);
					break;
			}
		});
	}

	chatmessage = settings.textonlymode ? cloned.innerText : getAllContentNodes(cloned);

	// console.log(chatbadges)
	// console.log(chatname)
	// console.log(nameColor)
	// console.log(chatmessage)
	// console.log("========================")

	//   =====================================

	//   if (cloned.children[0] && cloned.children[0].classList.contains("inline-block")){
		  
	// 	  try {
			  
	// 		  ele.children[0].querySelectorAll("[class*='badge'] img[src], .LevelNumber svg, [class*='group/role'] svg, [class*='group/role'] img[src]").forEach(badge=>{
	// 			try {
	// 				if (badge && badge.nodeName == "IMG"){
	// 					var tmp = {};
	// 					tmp.src = badge.src;
	// 					tmp.type = "img";
	// 					chatbadges.push(tmp);
	// 				} else if (badge && badge.nodeName.toLowerCase() == "svg"){
	// 					var tmp = {};
	// 					tmp.html = badge.outerHTML;
	// 					tmp.type = "svg";
	// 					chatbadges.push(tmp);
	// 				}
	// 			} catch(e){  }
	// 		  });
	  
	  
	// 		name = ele.children[0].querySelector("span[style]");
	// 		chatname = name.innerText;
	// 		try {
	// 			nameColor = name.style.color;
	// 		} catch(e){}
	// 	  } catch(e){return;}
	// 	  cloned.children[0].outerHTML = "";
	//   } else if (cloned.children[1] && cloned.children[1].classList.contains("inline-block")){
		  
	// 	   ele.children[1].querySelectorAll("[class*='badge'] img[src], .LevelNumber svg, [class*='group/role'] svg, [class*='group/role'] img[src]").forEach(badge=>{
	// 			try {
	// 				if (badge && badge.nodeName == "IMG"){
	// 					var tmp = {};
	// 					tmp.src = badge.src;
	// 					tmp.type = "img";
	// 					chatbadges.push(tmp);
	// 				} else if (badge && badge.nodeName.toLowerCase() == "svg"){
	// 					var tmp = {};
	// 					tmp.html = badge.outerHTML;
	// 					tmp.type = "svg";
	// 					chatbadges.push(tmp);
	// 				}
	// 			} catch(e){  }
	// 		  });
			  
			  
	// 	  try {
	// 		name = ele.children[1].querySelector("span[style]");
	// 		chatname = name.innerText;
	// 		try {
	// 			nameColor = name.style.color;
	// 		} catch(e){}
	// 	  } catch(e){return;}
	// 	  cloned.children[1].outerHTML = ""
	//   } else {
	// 	  try {
	// 		name = ele.querySelector("span[style]");
	// 		chatname = name.innerText;
	// 		try {
	// 			nameColor = name.style.color;
	// 		} catch(e){}
	// 	  } catch(e){return;}
	//   }
	//   for (var i=cloned.children.length-1;i>=0;i--){
	// 	  if (cloned.children[i].nodeName.toLowerCase() === "div"){
	// 		  cloned.children[i].outerHTML = "";
	// 	  }
	//   }
	  
	//   if (!settings.textonlymode){
	// 	  try {
	// 		chatmessage = getAllContentNodes(cloned);
	// 	  } catch(e){}
		  
	//   } else {
	// 	  try{
	// 		//var childrens = cloned.querySelectorAll("[alt]");
	// 		//for (var i =0;i<childrens.length;i++){
	// 		//	childrens[i].outerHTML = childrens[i].alt;
	// 		//}
	// 		chatmessage = cloned.innerText;
	// 	  } catch(e){}
	//   }
	  
	  
	//   var donations = 0;
	//   try {
	// 	// var elements = ele.querySelectorAll('.chat-line__message--cheer-amount'); // FFZ support
		
	// 	// for (var i=0;i<elements.length;i++){
	// 		// donations += parseInt(elements[i].innerText);
	// 	// }
	// 	// if (donations==1){
	// 		// donations += " bit";
	// 	// } else if (donations>1){
	// 		// donations += " bits";
	// 	// }
	//   } catch(e){}

	//   var hasDonation = '';
	//   if (donations) {
	// 	  hasDonation = donations;
	//   }
	  
	//   chatname = chatname.replace("Channel Host", "");
	//   chatname = chatname.replace(":", "");
	//   chatname = chatname.trim();
	  
	  
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
	//   data.hasDonation = hasDonation; // <==== I'm not fix this
	  data.hasDonation = "";
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
						//if (mutation.addedNodes[i].id && mutation.addedNodes[i].id.startsWith("message-temp")){continue;}
						if (pastMessages.includes(mutation.addedNodes[i].id)){continue;}
						try {
							// pastMessages.push(mutation.addedNodes[i].id) <==== id is not work
							// pastMessages = pastMessages.slice(-200);
							processMessage(mutation.addedNodes[i].childNodes[0]);
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
		if (document.getElementById("app")){
			clearInterval(xxx);
			
			var clear = document.querySelectorAll(".message > [id*='message-']");
			for (var i = 0;i<clear.length;i++){
				pastMessages.push(clear[i].id);
			}
			onElementInserted(document.getElementById("app"));
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