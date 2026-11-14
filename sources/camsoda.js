(function () {
	 
	 
	var checking = false;
	
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

	function escapeHtml(unsafe){ // when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) {
		if (!element) return "";
		if (element.nodeType === 3) {
			return settings.textonlymode ? element.textContent : escapeHtml(element.textContent);
		}
		if (element.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|BUTTON)$/.test(element.tagName)) return "";
		if (element.tagName === "IMG") {
			var alt = element.getAttribute("alt") || element.getAttribute("data-token") || "";
			if (settings.textonlymode) return alt;
			var src = element.src || "";
			return /^(https?:|data:image\/|blob:)/i.test(src) ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		if (element.tagName === "BR") return settings.textonlymode ? "\n" : "<br>";
		var text = "";
		for (var i = 0; i < element.childNodes.length; i++) {
			text += getAllContentNodes(element.childNodes[i]);
		}
		return text;
	}

	var settings = {};
	// textonlymode capture contract: literal chatmessage string, no app-added markup; render as text, not HTML.
	// settings.captureevents
	
	
	var dataIndex = -5;
	
	var channelName = "";
	
	function processMessage(ele){
		//console.log(ele);
		if (!ele || !ele.isConnected){
		//	console.log("no connected");
			return;
		}
		
		if (ele.skip){
			return;
		}

		
		if (!isExtensionOn) { ele.skip = true; return; }

		var chatimg = ""

		try {
			chatimg = ele.querySelector("img[class^='chat-user-module__userAvatar'][src]").src;
		} catch(e){
			//console.error(e);
		}
		
		var name="";
		var author = ele.querySelector("[class*='chat-user-module__user--']");
		var tip = null;
		try {
			if (author){
				name = author.textContent;
			} else {
				var tipLine = ele.querySelector("span");
				var tipParts = tipLine && tipLine.querySelectorAll("b");
				if (!tipParts || tipParts.length !== 2 || !/ tipped \d+ tokens?$/i.test(tipLine.textContent.trim())){return;}
				name = tipParts[0].textContent;
				tip = tipParts[1].textContent.trim() + " tokens";
			}
			name = name.split(":")[0];
			name = name.trim();
		} catch(e){
		//	console.error(e);
			return;
		}
		
		var namecolor="";
		try {
			//namecolor = ele.querySelector(".css-1jxf684").style.color;
		} catch(e){
		}
		
		var badges=[];
		/* try {
			ele.querySelectorAll("img[class^='ChatBadge_image_'][src]").forEach(badge=>{
				badges.push(badge.src);
			});
		} catch(e){
		} */
		var hasDonation = tip || '';
		
		var msg="";
		
		
			
			
		try {
			var content = ele.querySelector("p.break-words");
			if (!content && author){
				var next = author.nextElementSibling;
				while (next && next.matches("[class*='badge-module__badge--']")){
					next = next.nextElementSibling;
				}
				if (next && next.tagName === "SPAN"){content = next;}
			}
			msg = getAllContentNodes(content).trim();
		} catch(e){
			
		}
		
		if (!msg){
			try {
				msg = getAllContentNodes(ele.querySelector("a p.text-xs.font-semibold")).trim();
				if (msg.startsWith("Tipped")){
					hasDonation = msg.split(" ")[1] + " " + msg.split(" ")[2];
				}
			} catch(e){
			//	console.error(e);
			}
		}
		
		if ((!msg && !hasDonation) || !name){
			//console.log("no name", msg, name);
			return;
		}
		
		ele.skip = true;
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";
		data.contentimg = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "camsoda";
		
		//console.log(data);
		pushMessage(data);
	}

	var lastViewerCount = null;
	var viewerRoom = location.pathname;
	function checkViewers() {
		if (viewerRoom !== location.pathname) {
			viewerRoom = location.pathname;
			lastViewerCount = null;
		}
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			lastViewerCount = null;
			return;
		}
		var element = document.querySelector("[class*=\"chat-module__usersCount--\"]");
		if (!element) return;
		var match = element.textContent.trim().match(/^(\d+(?:[,\s]\d{3})*(?:\.\d+)?)([KM])?(?:\s|$)/i);
		if (!match) return;
		var count = Number(match[1].replace(/[,\s]/g, ""));
		if (match[2]) count *= match[2].toUpperCase() === "K" ? 1000 : 1000000;
		if (!isFinite(count) || count < 0 || Math.floor(count) !== count || count === lastViewerCount) return;
		lastViewerCount = count;
		pushMessage({ type: "camsoda", event: "viewer_update", meta: count });
	}
	setInterval(checkViewers, 10000);

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response={}){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
		if (!checking){
			startCheck();
		}
		checkViewers();
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				
				if (!checking){
					startCheck();
				}
				
				if ("getSource" == request){sendResponse("camsoda");	return;	}
				if ("focusChat" == request){
					var inputs = document.querySelectorAll('input[class*="chat-input-module__input--"], .comments-section textarea, .comments-section input[type="text"]');
					for (var i = 0; i < inputs.length; i++){
						var input = inputs[i];
						if (input.disabled || input.readOnly || !input.getClientRects().length){continue;}
						input.focus();
						if (document.activeElement === input){
							sendResponse(true);
							return;
						}
					}
					sendResponse(false);
					return;
				}
				if (request && typeof request === "object") {
					if ("state" in request) { isExtensionOn = request.state; }
					if ("settings" in request) { settings = request.settings || {}; }
					lastViewerCount = null;
					checkViewers();
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL =  "";
	var observer = null;
	var observerTarget = null;
	
	function queueMessage(row) {
		if (!row || row.skip || row.ssnPending){return;}
		if (!isExtensionOn) { row.skip = true; return; }
		row.ssnPending = true;
		setTimeout(function(){
			row.ssnPending = false;
			processMessage(row);
		},300);
	}
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				var changed = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
				var row = changed && changed.closest("[class*='message-module__wrapper--']");
				if (row && target.contains(row)){queueMessage(row);}
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							const addedNode = mutation.addedNodes[i];
							if (addedNode.nodeType !== 1) continue; // Only process element nodes

							if (addedNode.matches("[class*='message-module__wrapper--']")){
								queueMessage(addedNode);
							} else {
								var nested = addedNode.querySelectorAll("[class*='message-module__wrapper--']");
								nested.forEach(queueMessage);
								if (!nested.length && addedNode.parentElement === target){queueMessage(addedNode);}
							}

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: true, characterData: true };
		if (!target){return;}
		if (observer && observerTarget === target && target.isConnected) {
			return;
		}
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
		}
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		// Rows already present when chat connects are history, not new messages.
		Array.from(target.children).forEach(function(row){row.skip = true;});
		target.querySelectorAll("[class*='message-module__wrapper--']").forEach(function(row){row.skip = true;});
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		observerTarget = target;
	}
	
	console.log("social stream injected");


	function startCheck(){
		if (checking){return;}

		clearInterval(checking);
		checking = false;
		checking = setInterval(function(){
			try {
				var container = document.querySelector("div[class*='chat-module__wrapper--']");
				if (container && (!container.marked || !observer || observerTarget !== container || !container.isConnected)){
					container.marked=true;

					console.log("CONNECTED");

					onElementInserted(container);
				}

			} catch(e){}
		},2000);
	}
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				remoteConnection.datachannel.send("KEEPALIVE");
			}, 1000);
		};
		var errorHandle = function (e) {};
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = e => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = e => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function (e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function (e) {};
		localConnection.sendChannel.onmessage = function (e) {};
		localConnection
			.createOffer()
			.then(offer => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then(answer => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}
	
	
	function preventBackgroundThrottling() {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.mozHidden = false;
		document.webkitHidden = false;
		
		document.hasFocus = () => true;
		window.onFocus = () => true;

		Object.defineProperties(document, {
			mozHidden: { value: false, configurable: true },
			msHidden: { value: false, configurable: true },
			webkitHidden: { value: false, configurable: true },
			hidden: { value: false, configurable: true, writable: true },
			visibilityState: { 
				get: () => "visible",
				configurable: true
			}
		});
	}

	const events = [
		"visibilitychange",
		"webkitvisibilitychange",
		"blur",
		"mozvisibilitychange",
		"msvisibilitychange"
	];

	events.forEach(event => {
		window.addEventListener(event, (e) => {
			e.stopImmediatePropagation();
			e.preventDefault();
		}, true);
	});

	setInterval(preventBackgroundThrottling, 200);

})();
