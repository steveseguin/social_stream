(function () {
	
	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes || !element.childNodes.length){
			return element.textContent || "";
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && (node.textContent.trim().length > 0)){
				resp += node.textContent;
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele){	// twitch
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	  
	  try {
		var nameEle = ele.querySelector("[class^='ChatMessage_name_']");
		var chatname = nameEle.childNodes[0].textContent;;
		try {
			nameColor = nameEle.style.color;
		} catch(e){}
	  } catch(e){return;}
	  
	  var chatbadges = [];
	  
	  ele.querySelectorAll("img[class^='ChatBadge_image'][src]").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src;
				tmp.type = "img";
				chatbadges.push(tmp);
			} else {
				var tmp = {};
				tmp.html = badge.outerHTML;
				tmp.type = "svg";
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });
	  
	  
	  try {
		 
		var tttt = ele.querySelector('[class^="ChatMessage_text_"] > [class^="BlockRenderer"]');
		chatmessage = getAllContentNodes(tttt);
	
	  } catch(e){}
	  
	  
	  var chatimg = "";
	  try {
			chatimg = ele.querySelector('.ant-avatar img').src;
	  } catch(e){
		  
	  }
	  
	  
	  var hasDonation = '';
	  try {
		var tip = ele.querySelector('.ant-space-item mark'); // FFZ support
		if (tip){
			if (tip.innerText.includes("Tipped")){
				hasDonation = tip.innerText.replace("Tipped ","");
			}
		}
	  } catch(e){}

	 
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.hasMembership = "";
	  data.type = "vklive";
	  
	  
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
					document.querySelector('.ce-block__content > [contenteditable="true"]').focus();
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
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(containerSelector, className) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if ( mutation.addedNodes[i] && mutation.addedNodes[i].querySelector){
							var ele = mutation.addedNodes[i].querySelector("[class^='ChatBoxBase_message']");
							if (ele){
								if (ele.ignore){continue;}
								ele.ignore=true;
								processMessage(ele);
							}
							
						}
					}
				}
			});
		};
		var target = document.querySelectorAll(containerSelector)[0];
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	setTimeout(function(){
		var clear = document.querySelectorAll("div.ReactVirtualized__Grid__innerScrollContainer > div");
		for (var i = 0;i<clear.length;i++){
			clear[i].ignore = true; // don't let already loaded messages to re-load.
			
			processMessage(clear[i])
		}
		onElementInserted("#root");
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