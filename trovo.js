(function () {
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		var reader = new FileReader();
		reader.onloadend = function() {
		  callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	  };
	  xhr.open('GET', url);
	  xhr.responseType = 'blob';
	  xhr.send();
	}

	function processMessage(ele){
	  
	  var chatmessage = "";
	  var chatname = "";
	  var chatimg = "";
	  var nameColor = "";
	  
	  try{
		chatname = ele.querySelector(".nick-name").innerText;
	  } catch(e){}
	  
	  
	  
	  if (!settings.nosubcolor){
		  try{
			nameColor = getComputedStyle(ele.querySelector(".nick-name")).color;
		  }catch(e){}
	  }
		
	  if (!settings.textonlymode){
		  try{
			chatmessage = ele.querySelector(".content").innerHTML;
		  } catch(e){return;}
	  } else {
		  try{
			chatmessage = ele.querySelector(".content").innerText;
		  } catch(e){
			  return;
		  }
	  }
	  
	  try{
		chatimg = ele.querySelector('div.avatar').querySelector('img.img-face[src]').src;
	  } catch(e){}
	  
	  var chatdonation = "";
	  var chatmembership = "";
	  var chatsticker = "";
	  var chatbadges = "";
	  var hasDonation = '';
	  var hasMembership = '';
	  var backgroundColor = "";
	  var textColor = "";
	

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.backgroundColor = backgroundColor;
      data.textColor = textColor;
	  data.chatmessage = chatmessage;
	  data.nameColor = nameColor;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.hasMembership = hasMembership;
	  data.type = "trovo";
	  
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
						var target = document.querySelector(".input-box>.editor");
						if (target){
							target.innerHTML = "";
							target.focus();
						} else {
							sendResponse(false);
							return
						}
					} catch(e){
						sendResponse(false);
						return
					}
					sendResponse(true);
					setTimeout(function(){
						var target = document.querySelector(".input-box>.editor");
						if (target){
							target.innerHTML = "";
						}
					},50);
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

	var started = false;
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && mutation.addedNodes[i].classList && mutation.addedNodes[i].classList.contains("message-comp")) {
							if (mutation.addedNodes[i].set123){continue;}
							mutation.addedNodes[i].set123 = true;
							processMessage(mutation.addedNodes[i]);
						} 
					}
				}
			});
		};
		if (!target){return;}
		started = true;
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

    console.log("Social stream inserted");
	
	document.querySelectorAll(".message-comp").forEach(ele=>{
		ele.set123 = true;
	});
	
	setTimeout(function(){
		if (!started){
			var ele = document.querySelector(".chat-list"); 
			if (ele){
				onElementInserted(ele);
			}
		}
	},4000);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function(e){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				remoteConnection.datachannel.send("KEEPALIVE")
			}, 1000);
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
	
	
	
	try {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.visibilityState = "visible";
		document.mozHidden = false;
		document.webkitHidden = false;
	} catch(e){	}

	try {
		document.hasFocus = function () {return true;};
		window.onFocus = function () {return true;};
		
		Object.defineProperty(document, "mozHidden", { value : false});
		Object.defineProperty(document, "msHidden", { value : false});
		Object.defineProperty(document, "webkitHidden", { value : false});
		Object.defineProperty(document, 'visibilityState', { get: function () { return "visible"; }, value: 'visible', writable: true});
		Object.defineProperty(document, 'hidden', {value: false, writable: true});
		
		setInterval(function(){
			console.log("set visibility");
			window.onblur = null;
			window.blurred = false;
			document.hidden = false;
			document.visibilityState = "visible";
			document.mozHidden = false;
			document.webkitHidden = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},200);
	} catch(e){	}

	try {
		document.onvisibilitychange = function(){
			window.onFocus = function () {return true;};
			
		};
	} catch(e){	}

	try {
		for (event_name of ["visibilitychange",
			"webkitvisibilitychange",
			"blur", // may cause issues on some websites
			"mozvisibilitychange",
			"msvisibilitychange"]) {
				try{
					window.addEventListener(event_name, function(event) {
						event.stopImmediatePropagation();
						event.preventDefault();
					}, true);
				} catch(e){}
		}
	} catch(e){	} 
	
	
	
	
})();