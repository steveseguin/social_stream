(function () {
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  
	  xhr.open('GET', url, false);
	  xhr.send(null);
	  var data = stringToArrayBuffer(xhr.response);
	  
	  var reader = new FileReader();
	  reader.onloadend = function() {
		  callback(reader.result);
	  }
	  reader.readAsDataURL(new Blob([data])); // Failed to execute 'readAsDataURL' on 'FileReader': parameter 1 is not of type 'Blob'.
	  
	}
	function stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length);
		var bufView = new Uint8Array(buf);

		for (var i=0, strLen=str.length; i<strLen; i++) {
			bufView[i] = str.charCodeAt(i);
		}

		return buf;
	}
	
	function processMessage(ele){
	  
		//console.log(ele);
		
		var chatmessage = "";
		var chatname = "";
		var chatimg = "";

		try{
			chatname = ele.children[1].children[1].children[0].children[0].textContent;
			if (chatname.split("] ").length>1){
				chatname = chatname.split("] ")[1];
			}
			chatname = chatname.split(":")[0];
			chatname = chatname.trim();
		} catch(e){
			chatname = "";
		}
		
		if (!chatname){
			try{
				
				chatname = ele.children[1].children[1].children[0].children[1].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			try{
				chatname = ele.children[1].children[0].children[1].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			} catch(e){
				chatname = "";
			}
		}
		if (!chatname){
			try{
				chatname = ele.children[1].children[0].children[0].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			if (ele.querySelector('[aria-label]')){
				chatname = ele.querySelector('[aria-label]').ariaLabel;
				chatname = chatname.split(":")[0];
			} else {
				return;
			}
		}


		try{
			if (!chatname){
				chatname = ele.children[1].children[1].children[0].children[0].textContent;
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			}
		} catch(e){
			chatname = "";
		}
		
		if (!settings.textonlymode){
			try {
				chatmessage = ele.querySelector(".selectable-text.copyable-text");
				if (chatmessage && chatmessage.tagName && (chatmessage.tagName == "IMG")){
					if (chatmessage.alt){
						chatmessage = chatmessage.alt;
					}
				} else if (chatmessage && chatmessage.querySelector("img")){
					chatmessage.querySelectorAll("img[alt]").forEach(ele=>{
						ele.outerHTML = ele.alt;
					});
				} 
				chatmessage = chatmessage.innerHTML;
			} catch(e){
				chatmessage = "";
			}
			
			if (!chatmessage){
				
				//	console.error(e);
					return;
				
			}
		} else {
			try {
				chatmessage = ele.querySelector(".selectable-text.copyable-text").innerText;
			} catch(e){
			}
		}
		
		if (!chatmessage){return;}

		
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";
		data.type = "whatsapp";
		
		console.log(data);
	  
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				try {
					chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
				} catch(e){}
			});
		} else {
			data.chatimg = "";
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
			} catch(e){}
		}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					try{
						document.querySelector("footer").querySelector("div[contenteditable='true'][role='textbox']").focus();
					} catch(e){
						sendResponse(false);
						return
					}
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

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					document.querySelector("#main").querySelectorAll("[data-id]:not([data-set123])").forEach((xx)=>{
						xx.dataset.set123 = true;
						console.log(xx);
						setTimeout(function(ele){
							callback(ele);
						}, 300, xx); // give it time to load fully
					});
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

    console.log("Social stream inserted");
	
	
	setInterval(function(){
		var ele = document.querySelector("#main");
		if (ele && !ele.started){
			ele.started = true;
			
			setTimeout(function(ele){
				if (ele){
					document.querySelector("#main").querySelectorAll("[data-id]:not([data-set123])").forEach((xx)=>{
						xx.dataset.set123 = true;
					});
					onElementInserted(ele, function(element){
						processMessage(element);
					});
				}
			}, 2000, ele);
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
		console.log(e);
	}
	
})();