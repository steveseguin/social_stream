(function () {
	
	var isExtensionOn = true;
try {
	
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
		
		if (element?.className.includes("senderName_")){return resp;}
		
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
				resp += escapeHtml(node.textContent.trim())+" ";
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
	
	const messageHistory = [];
	const TWO_MINUTES = 2 * 60 * 1000;
	const MESSAGE_SELECTOR = "[data-testid='messageContainer'], [data-testid='chat-message-container']";
	var activeObserver = null;
	var observedChatRoot = null;

	function checkMessage(message) {
		const now = Date.now();
		for (let i = messageHistory.length - 1; i >= 0; i--) {
			if (now - messageHistory[i].timestamp > TWO_MINUTES) {
				messageHistory.splice(i, 1);
			}
		}
		
		const isDuplicate = messageHistory.some(entry => 
			entry.content === message && now - entry.timestamp <= TWO_MINUTES
		);
		
		if (!isDuplicate) {
			messageHistory.push({ content: message, timestamp: now });
			return false;
		}
		return true;
	}

	function normalizeMessageElement(element){
		if (!element || element.nodeType !== 1){
			return null;
		}
		if (element.matches?.("[data-testid='messageContainer']")){
			return element;
		}
		if (element.matches?.("[data-testid='chat-message-container']")){
			return element.closest("[data-testid='messageContainer']") || element;
		}
		var direct = element.querySelector?.("[data-testid='messageContainer']");
		if (direct){
			return direct;
		}
		var nested = element.querySelector?.("[data-testid='chat-message-container']");
		if (nested){
			return nested.closest("[data-testid='messageContainer']") || nested;
		}
		return null;
	}

	function getMessageElementsFromNode(node){
		var results = [];
		var seen = new Set();
		var pushIfValid = function(element){
			var normalized = normalizeMessageElement(element);
			if (!normalized || seen.has(normalized)){
				return;
			}
			seen.add(normalized);
			results.push(normalized);
		};
		pushIfValid(node);
		if (node && node.nodeType === 1 && node.querySelectorAll){
			node.querySelectorAll(MESSAGE_SELECTOR).forEach(pushIfValid);
		}
		return results;
	}

	function markExistingMessages(target){
		if (!target || !target.querySelectorAll){
			return;
		}
		target.querySelectorAll(MESSAGE_SELECTOR).forEach(function(element){
			var normalized = normalizeMessageElement(element);
			if (normalized){
				normalized.ignore = true;
			}
		});
	}

	function getChatName(ele){
		var selectors = [
			"[data-testid='chat-message-container'] .flex.items-center p span:not([data-testid])",
			"[data-testid='chat-message-container'] .flex.items-center p > span:first-child",
			"[class^='senderName_name']"
		];
		for (var i = 0; i < selectors.length; i++){
			try {
				var node = ele.querySelector(selectors[i]);
				var value = escapeHtml(node?.textContent || "").trim();
				if (value){
					return value;
				}
			} catch(e){}
		}
		return "";
	}

	function isTimeLabel(text){
		if (!text){
			return false;
		}
		return /^(just now|now|\d+\s*[smhdw])$/i.test(text.trim());
	}

	function getChatMessage(ele, chatname){
		var selector = "[data-testid='chat-message-container'] p, [class^='messageBody_textWrapper'] > p";
		var nodes = [];
		try {
			nodes = ele.querySelectorAll(selector);
		} catch(e){}
		for (var i = 0; i < nodes.length; i++){
			try {
				var node = nodes[i];
				if (!node){
					continue;
				}
				if (node.querySelector?.("[data-testid='senderName-label']")){
					continue;
				}
				var text = getAllContentNodes(node).trim();
				if (!text){
					continue;
				}
				if ((chatname && text === chatname) || isTimeLabel(text)){
					continue;
				}
				return text;
			} catch(e){}
		}
		return "";
	}
	
	async function processMessage(ele){	// twitch
	
	
		//console.log(ele);
		
		try {
			ele = normalizeMessageElement(ele);
			if (!ele || !ele.isConnected){
				return;
			}
			
		  var chatsticker = false;
		  var chatmessage = "";
		  var nameColor = "";
		  var chatname = getChatName(ele);
		  
		  chatname = chatname.trim();
		  if (!chatname){return;}
		  
		  var chatbadges = [];
		  var hasDonation = '';
		  var contentimg = "";
		  var membership = "";
		  
		  ele.querySelectorAll("[class^='senderName_iconWrapper'] svg").forEach(badge=>{
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
			membership = escapeHtml(ele.querySelector("[data-testid='senderName-label']")?.textContent || "").trim();
		  } catch(e){}
		  
		  
		  
		  chatmessage = getChatMessage(ele, chatname);
		 
		  if (chatmessage){
			 chatmessage = chatmessage.trim();
		  }
		 
		  if (!chatmessage){
			  return;
		  }
		  
		  if (chatmessage ===  "now"){
			  return;
		  }
		 
		  var chatimg = "";
		  try {
				chatimg = ele.querySelector("img[data-testid^='avatar-'][src]")?.src || "";
		  } catch(e){}

	  } catch(e){
		  //console.log(e);
		 return;
	  }
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.contentimg = contentimg;
	  data.hasDonation = hasDonation;
	  data.membership = membership;
	  data.textonly = settings.textonlymode || false;
	  data.type = "onlinechurch";
	  
	  
	  if (checkMessage(chatname+"::"+chatmessage)){
		  return;
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
				if ("getSource" == request){sendResponse("onlinechurch");	return;	}
				if ("focusChat" == request){
					document.querySelector('#publicchat textarea[placeholder][maxlength]').focus();
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
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (response && "settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							var messages = getMessageElementsFromNode(mutation.addedNodes[i]);
							if (!messages.length){continue;}
							if (messages.length > 1 && !mutation.addedNodes[i].matches?.(MESSAGE_SELECTOR)){
								messages.forEach(function(message){
									message.ignore = true;
								});
								continue;
							}
							messages.forEach(function(message){
								if (message.ignore){return;}
								message.ignore = true;
								processMessage(message);
							});
								
						} catch(e){}
					}
				}
			});
		};
		
		markExistingMessages(target);
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		if (activeObserver){
			try {
				activeObserver.disconnect();
			} catch(e){}
		}
		activeObserver = new MutationObserver(onMutationsObserved);
		activeObserver.observe(target, config);
	}
	
	console.log("Social Stream injected");
	
	var checkReady = setInterval(function(){
		
		var mainChat = document.querySelector("#publicchat");
		if (mainChat){ // just in case 
			if (observedChatRoot === mainChat && activeObserver && mainChat.isConnected){
				return;
			}
			console.log("Social Stream Start");
			observedChatRoot = mainChat;
			onElementInserted(mainChat);
		} 
	},500);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(event){
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
	} catch(e){
		console.log(e);
	}

})();
