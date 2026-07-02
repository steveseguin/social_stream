(function () {
	
	
	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

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

	function getAllContentNodes(element) { // takes an element.
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
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}

	function processMessage(ele){
		
	  var chatmessage = "";
	  var chatname = "";
	  var chatimg = "";
	  var nameColor = "";
	  
	  try{
		chatname = escapeHtml(ele.querySelector(".nick-name").innerText);
	  } catch(e){}
	  
	  
	  
	  if (!settings.nosubcolor){
		  try{
			nameColor = getComputedStyle(ele.querySelector(".nick-name")).color;
		  }catch(e){}
	  }
		
	  chatmessage = getAllContentNodes(ele.querySelector(".content"))
	 
	  try{
			chatimg = ele.querySelector('div.avatar').querySelector('img.img-face[src]').src;
	  } catch(e){}
	  
	  var chatdonation = "";
	  var chatmembership = "";
	  var chatsticker = "";
	  var chatbadges = [];
	  
	  ele.querySelectorAll(".badge img[src]").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src;
				tmp.type = "img";
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });
	  
	  var hasDonation = '';
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
	  data.membership = '';
	  data.textonly = settings.textonlymode || false;
	  data.type = "trovo";
	  
	  
	  data.chatimg = data.chatimg.replaceAll("/webp|", "/jpg|").replace("/w/64/", "/w/200").replace("/h/64/", "/h/200");
	  
	  
	  chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
	  
	  return;;
	  
	  // the code below is obsoloete now.
		
	  
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				console.log(dataUrl.length);
				if (dataUrl.length < 50000){
					data.chatimg = dataUrl;
				}
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
				if ("getSource" == request){sendResponse("trovo");	return;	}
				if ("focusChat" == request){
					try{
						var target = document.querySelector("[class='editor'][contenteditable='true']");
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
						var target = document.querySelector("[class='editor'][contenteditable='true']");
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
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
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
	
	var checker = setTimeout(function(){
		if (!started){
			document.querySelectorAll(".message-comp").forEach(ele=>{
				ele.set123 = true;
				// processMessage(ele);
			});
			var ele = document.querySelector(".chat-list"); 
			if (ele){
				onElementInserted(ele);
			}
			
		} else {
			clearTimeout(checker);
		}
	},4000);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function(event){
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
