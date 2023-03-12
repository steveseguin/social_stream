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
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	  
	  try {
		var nameEle = ele.querySelector(".ant-comment-content-author-name");
		var chatname = nameEle.innerText;
		try {
			nameColor = nameEle.style.color;
		} catch(e){}
	  } catch(e){return;}
	  
	  var chatbadges = [];
	  
	  ele.querySelectorAll("[class*='badge'] img[src], .LevelNumber svg").forEach(badge=>{
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
	  
	  
	  if (!settings.textonlymode){
		  if (!chatmessage){
			  try {
				var eleContent = ele.querySelector('.ant-comment-content-detail');
				chatmessage = getAllContentNodes(eleContent);
			  } catch(e){}
		  }
		  
		  if (!chatmessage){
			  try {
				chatmessage = ele.textContent;
			  } catch(e){}
		  }
	  } else {
		  try{
			var cloned = ele.querySelector('.ant-comment-content-detail').cloneNode(true);
			//var children = cloned.querySelectorAll("[alt]");
			//for (var i =0;i<children.length;i++){
			//	children[i].outerHTML = children[i].alt;
			//}
			chatmessage = cloned.innerText;
		  } catch(e){}
	  }
	  
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
	  data.type = "rokfin";
	  
	  
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
					document.querySelector('#comment-form_comment').focus();
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
	// settings.streamevents
	
	
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
						console.log(mutation.addedNodes[i]);
						if ( mutation.addedNodes[i] && mutation.addedNodes[i].querySelector){
							if (mutation.addedNodes[i].classList.contains("ant-comment")){
								if (mutation.addedNodes[i].ignore){continue;}
								mutation.addedNodes[i].ignore=true;
								processMessage(mutation.addedNodes[i]);
							} else {
								var ele = mutation.addedNodes[i].querySelector(".ant-comment");
								if (ele){
									if (ele.ignore){continue;}
									ele.ignore=true;
									processMessage(ele);
								}
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
		var clear = document.querySelectorAll(".ant-comment");
		for (var i = 0;i<clear.length;i++){
			clear[i].ignore = true; // don't let already loaded messages to re-load.
			//processMessage(clear[i])
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