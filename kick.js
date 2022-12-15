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
	  
	  
	  var tmp = ele.children;
	  var children = []
	  children.push(tmp[tmp.length-1]);
	  children.push(tmp[tmp.length-2]);
	  
	  try {
		var chatname = children[1].innerText;
		try {
			nameColor = children[1].style.color;
		} catch(e){}
	  } catch(e){return;}
	  
	  var chatbadges = [];
	  
	  children[1].querySelectorAll("[class*='badge'] img[src], .LevelNumber svg").forEach(badge=>{
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
	  
	  
	  if (!textOnlyMode){
		  if (!chatmessage){
			  try {
				chatmessage = getAllContentNodes(children[0]);
			  } catch(e){}
		  }
		  
		  if (!chatmessage){
			  try {
				chatmessage = children[0].textContent;
			  } catch(e){}
		  }
	  } else {
		  try{
			var cloned = children[0].cloneNode(true);
			var childrens = cloned.querySelectorAll("[alt]");
			for (var i =0;i<childrens.length;i++){
				childrens[i].outerHTML = childrens[i].alt;
			}
			chatmessage = children[0].innerText;
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
					document.querySelector('.chat-input-wrapper > textarea').focus();
					sendResponse(true);
					return;
				}
				if ("textOnlyMode" == request){
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request){
					textOnlyMode = false;
					sendResponse(true);
					return;
				}
				// twitch doesn't capture avatars already.
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var lastMessage = "";
	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});  /////

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].ignore){continue;}
						try {
							mutation.addedNodes[i].ignore=true;
							callback(mutation.addedNodes[i].childNodes[0].childNodes[0].childNodes[0].childNodes[0]);
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
	console.log("Social stream injected");
	var xxx = setInterval(function(){
		
		if (document.getElementById("app")){
			clearInterval(xxx);
			var clear = document.querySelectorAll(".message > [id*='message-']");
			for (var i = 0;i<clear.length;i++){
				clear[i].ignore = true; // don't let already loaded messages to re-load.
			}
			onElementInserted(document.getElementById("app"), function(element){
			  setTimeout(function(element){processMessage(element);},10, element);
			});
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