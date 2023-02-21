(function () {
	
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
	
	
	function processMessage(ele){	// twitch
	
	  if (!ele){return;}
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	 
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  
	  console.log(ele);
	  
	  var cloned =  ele.cloneNode(true);
	  if (cloned.children[0].classList.contains("inline-block")){
		  
		  try {
			  
			  ele.children[0].querySelectorAll("[class*='badge'] img[src], .LevelNumber svg, [class*='group/role'] svg, [class*='group/role'] img[src]").forEach(badge=>{
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
	  
	  
			name = ele.children[0].querySelector("span[style]");
			chatname = name.innerText;
			try {
				nameColor = name.style.color;
			} catch(e){}
		  } catch(e){return;}
		  cloned.children[0].outerHTML = "";
	  } else if (cloned.children[1].classList.contains("inline-block")){
		  
		   ele.children[1].querySelectorAll("[class*='badge'] img[src], .LevelNumber svg, [class*='group/role'] svg, [class*='group/role'] img[src]").forEach(badge=>{
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
			name = ele.children[1].querySelector("span[style]");
			chatname = name.innerText;
			try {
				nameColor = name.style.color;
			} catch(e){}
		  } catch(e){return;}
		  cloned.children[1].outerHTML = "";
	  } else {
		  try {
			name = ele.querySelector("span[style]");
			chatname = name.innerText;
			try {
				nameColor = name.style.color;
			} catch(e){}
		  } catch(e){return;}
	  }
	  for (var i=cloned.children.length-1;i>=0;i--){
		  if (cloned.children[i].nodeName.toLowerCase() === "div"){
			  cloned.children[i].outerHTML = "";
		  }
	  }
	  
	  if (!settings.textonlymode){
		  try {
			chatmessage = getAllContentNodes(cloned);
		  } catch(e){}
		  
	  } else {
		  try{
			var childrens = cloned.querySelectorAll("[alt]");
			for (var i =0;i<childrens.length;i++){
				childrens[i].outerHTML = childrens[i].alt;
			}
			chatmessage = cloned.innerText;
		  } catch(e){}
	  }
	  
	  
	  var donations = 0;
	  try {
		// var elements = ele.querySelectorAll('.chat-line__message--cheer-amount'); // FFZ support
		
		// for (var i=0;i<elements.length;i++){
			// donations += parseInt(elements[i].innerText);
		// }
		// if (donations==1){
			// donations += " bit";
		// } else if (donations>1){
			// donations += " bits";
		// }
	  } catch(e){}

	  var hasDonation = '';
	  if (donations) {
		  hasDonation = donations;
	  }
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	 
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = "";
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
						if (mutation.addedNodes[i].id && mutation.addedNodes[i].id.startsWith("message-temp")){continue;}
						if (pastMessages.includes(mutation.addedNodes[i].id)){continue;}
						try {
							pastMessages.push(mutation.addedNodes[i].id)
							pastMessages = pastMessages.slice(-200);
							processMessage(mutation.addedNodes[i].childNodes[0].childNodes[0].childNodes[0].childNodes[0]);
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