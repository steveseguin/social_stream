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
		try {
			unsafe = unsafe == null ? "" : String(unsafe);
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
				resp += escapeHtml(node.textContent)+" ";
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
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	var dataIndex = -5;
	
	var channelName = "";
	
	var processedMessages = new Set();
	var processedEvents = new Set();

	function getChatInput(){
		try {
			var selectors = [
				'[aria-label="Chat message input"][contenteditable="true"][role="textbox"]',
				'[aria-label="Chat message input"][contenteditable="true"]',
				'[role="textbox"][contenteditable="true"][data-placeholder]'
			];
			for (var i = 0; i < selectors.length; i++){
				var inputs = document.querySelectorAll(selectors[i]);
				if (inputs && inputs.length){
					return inputs[inputs.length - 1];
				}
			}
		} catch(e){
		}
		return null;
	}

	function getChatMessageRoot(ele){
		if (!ele || !ele.isConnected || !ele.querySelector){ return null; }
		if (ele.classList && ele.classList.contains("chat-message-content")){
			return ele;
		}
		return ele.querySelector(".chat-message-content");
	}

	function getChatMessageRow(ele){
		var root = getChatMessageRoot(ele);
		if (!root){ return null; }
		if (root.closest){
			var row = root.closest(".group");
			if (row){ return row; }
		}
		return root.parentNode || root;
	}
	
	function processMessage(ele){
		var row = getChatMessageRow(ele);
		var root = getChatMessageRoot(ele);
		if (!row || !root){
			return;
		}
		
		if (row.skip || root.skip){
			return;
		}

		var inlineEl = null;
		try {
			inlineEl = root.querySelector("span.inline");
		} catch(e){
		}
		if (!inlineEl){
			return;
		}
		
		var chatimg = "";
		
		var name="";
		var nameEl = null;
		try {
			nameEl = inlineEl.querySelector("button");
			if (nameEl) {
				name = escapeHtml(nameEl.textContent.replace(/:\s*$/, "").trim());
			}
		} catch(e){
		}
		
		var namecolor="";
		try {
			if (nameEl){
				namecolor = nameEl.style.color || "";
				if (!namecolor && window.getComputedStyle){
					namecolor = window.getComputedStyle(nameEl).color || "";
				}
			}
		} catch(e){
		}
		
		var badges=[];
		try {
			for (var i = 0; i < inlineEl.childNodes.length; i++){
				var badge = inlineEl.childNodes[i];
				if (badge === nameEl){
					break;
				}
				if ((badge.nodeType === 1) && (badge.nodeName === "IMG") && badge.src){
					badges.push(badge.src + "");
				}
			}
		} catch(e){
		} 

		var timeText = "";
		try {
			for (var j = 0; j < inlineEl.childNodes.length; j++){
				var timeNode = inlineEl.childNodes[j];
				if (timeNode === nameEl){
					break;
				}
				if ((timeNode.nodeType === 1) && (timeNode.nodeName === "SPAN") && timeNode.textContent){
					timeText = timeNode.textContent.trim();
					if (timeText){
						break;
					}
				}
			}
		} catch(e){
		}

		var msg="";
		try {
			var msgEl = nameEl ? nameEl.nextElementSibling : null;
			if (!msgEl && nameEl && nameEl.parentNode && nameEl.parentNode.querySelector){
				msgEl = nameEl.parentNode.querySelector("button + span");
			}
			if (msgEl) {
				msg = getAllContentNodes(msgEl).trim();
			}
		} catch(e){
		}
		
		
		var donation = "";
		try {
			donation = escapeHtml(row.querySelector(".flex-1.space-y-2 svg>path[d='m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z']").parentNode.nextSibling.textContent);
			if (msg){
				msg = msg.replaceAll('“',"").replaceAll('”',"").trim(); 
			}
		} catch(e){
		}
		
		if (!name || (!msg && !donation)){
	//		console.log("no name");
			return;
		}
		
		var msgKey = "chat|\u00b6|" + timeText + "|\u00b6|" + name + "|\u00b6|" + msg;
		if (processedMessages.has(msgKey)){
			row.skip = true;
			root.skip = true;
			return;
		}
		processedMessages.add(msgKey);
		if (processedMessages.size > 200){
			processedMessages.delete(processedMessages.values().next().value);
		}
		
		row.skip = true;
		root.skip = true;
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = donation;
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "velora";
		
		
		pushMessage(data);
	}

	function makeBaseData(){
		return {
			chatbadges: [],
			backgroundColor: "",
			textColor: "",
			nameColor: "",
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "velora"
		};
	}

	function rememberEvent(key, row){
		key = String(key || "").replace(/\s+/g, " ").trim();
		if (!key || processedEvents.has(key)){
			if (row){ row.skip = true; }
			return false;
		}
		processedEvents.add(key);
		if (processedEvents.size > 200){
			processedEvents.delete(processedEvents.values().next().value);
		}
		if (row){ row.skip = true; }
		return true;
	}

	function nearestVeloraEventRow(ele){
		if (!ele || !ele.closest){ return null; }
		return ele.closest(".mx-1.my-1\\.5") || ele.closest("[class*='mx-1'][class*='my-1.5']") || ele.closest(".group") || ele;
	}

	function parseVoltsEvent(row){
		var amountNode = null;
		var nameNode = null;
		try {
			var spans = Array.from(row.querySelectorAll("span"));
			amountNode = spans.find(function(span){
				return /\b\d[\d,.]*\s*V(?:olts?)?\b/i.test((span.textContent || "").trim());
			}) || null;
			if (!amountNode){ return null; }
			nameNode = spans.find(function(span){
				var text = (span.textContent || "").trim();
				return text && span !== amountNode && !/\b\d[\d,.]*\s*V(?:olts?)?\b/i.test(text);
			}) || null;
		} catch(e){
			return null;
		}
		var amountText = amountNode ? (amountNode.textContent || "").trim() : "";
		var name = nameNode ? (nameNode.textContent || "").trim() : "";
		if (!name || !amountText){ return null; }
		var data = makeBaseData();
		data.chatname = escapeHtml(name);
		data.chatmessage = "";
		data.hasDonation = escapeHtml(amountText.replace(/\bV\b/i, "Volts"));
		data.event = "volts";
		data.meta = {
			amountText: amountText,
			source: "dom"
		};
		return data;
	}

	function parseChannelPointsEvent(row){
		var labelNode = null;
		var valueNode = null;
		try {
			var divs = Array.from(row.querySelectorAll("div"));
			labelNode = divs.find(function(div){
				return /\bsays\b/i.test((div.textContent || "").trim()) && (div.textContent || "").trim().length < 80;
			}) || null;
			if (!labelNode){ return null; }
			valueNode = labelNode.parentElement ? Array.from(labelNode.parentElement.querySelectorAll("span")).find(function(span){
				return (span.textContent || "").trim();
			}) : null;
		} catch(e){
			return null;
		}
		var label = labelNode ? (labelNode.textContent || "").trim() : "";
		var match = label.match(/^(.+?)\s+says$/i);
		var name = match && match[1] ? match[1].trim() : "";
		var message = valueNode ? getAllContentNodes(valueNode).trim() : "";
		if (!name || !message){ return null; }
		var data = makeBaseData();
		data.chatname = escapeHtml(name);
		data.chatmessage = message;
		data.event = "channel_points";
		data.meta = {
			rewardTitle: "Says",
			source: "dom"
		};
		return data;
	}

	function parseSimpleActivityEvent(row){
		var text = (row && row.textContent || "").replace(/\s+/g, " ").trim();
		var match;
		var data;
		if (!text){ return null; }
		match = text.match(/^(.+?)\s+just became a\s+(.+?)!?$/i);
		if (!match){ return null; }
		data = makeBaseData();
		data.chatname = escapeHtml(match[1].trim());
		data.chatmessage = escapeHtml("became a " + match[2].trim());
		data.membership = escapeHtml(match[2].trim());
		data.event = "subscription";
		data.meta = { source: "dom" };
		return data;
	}

	function processEventNode(ele){
		var row = nearestVeloraEventRow(ele);
		var data;
		if (!row || row.skip || getChatMessageRoot(row)){ return; }
		data = parseVoltsEvent(row) || parseChannelPointsEvent(row) || parseSimpleActivityEvent(row);
		if (!data){ return; }
		if (!rememberEvent("event|\u00b6|" + (data.event || "") + "|\u00b6|" + (data.chatname || "") + "|\u00b6|" + (data.chatmessage || "") + "|\u00b6|" + (data.hasDonation || "") + "|\u00b6|" + (row.textContent || ""), row)){
			return;
		}
		pushMessage(data);
	}

	function scanExistingChat(container){
		if (!container || !container.querySelectorAll){ return; }
		try {
			container.querySelectorAll(".chat-message-content").forEach(function(chatNode){
				processMessage(chatNode);
			});
		} catch(e){
		}
		try {
			container.querySelectorAll(".mx-1.my-1\\.5, [class*='mx-1'][class*='my-1.5'], .flex.items-baseline").forEach(function(eventNode){
				processEventNode(eventNode);
			});
		} catch(e){
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	var cachedViewerEl = null;
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				
				
				if (!cachedViewerEl || !cachedViewerEl.isConnected){
					cachedViewerEl = null;
					var els = document.querySelectorAll("div, span");
					for (var i = 0; i < els.length; i++){
						var el = els[i];
						if (!el.childElementCount && /^[\d,.]+[km]?\s+viewers?$/i.test(el.textContent.trim())){
							cachedViewerEl = el;
							break;
						}
					}
				}
				
				if (cachedViewerEl && cachedViewerEl.textContent){
					let views = cachedViewerEl.textContent.toUpperCase();
					let multiplier = 1;
					if (views.includes("K")){
						multiplier = 1000;
						views = views.replace("K","");
					} else if (views.includes("M")){
						multiplier = 1000000;
						views = views.replace("M","");
					}
					views = views.split(" ")[0];
					if (views == parseFloat(views)){
						views = parseFloat(views) * multiplier;
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: 'velora',
									event: 'viewer_update',
									meta: views
								}
							}),
							function (e) {}
						);
					}
				}
			} catch (e) {
			}
		}
	}


	// OnlineViewers_root_orkvv
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
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
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				
				if (!checking){
					startCheck();
				}
				
				if ("getSource" == request){sendResponse("velora");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					var chatInput = getChatInput();
					if(chatInput && chatInput.focus){
						chatInput.focus();
					}
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
						
						if (!checking){
							startCheck();
						}
					
					}
					
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

	var lastURL =  "";
	var observer = null;
	var observerTarget = null;
	
	
	function onElementInserted(target, subtree=false) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
				//	console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							const addedNode = mutation.addedNodes[i];
							if (addedNode.nodeType !== 1) continue; // Only process element nodes

							if (addedNode.skip){continue;}

							setTimeout(()=>{
								if (getChatMessageRoot(addedNode)){
									processMessage(addedNode);
								} else if (addedNode.querySelectorAll){
									addedNode.querySelectorAll(".chat-message-content").forEach(function(chatNode){
										processMessage(chatNode);
									});
								}
								processEventNode(addedNode);
								if (addedNode.querySelectorAll){
									addedNode.querySelectorAll(".mx-1.my-1\\.5, [class*='mx-1'][class*='my-1.5'], .flex.items-baseline").forEach(function(eventNode){
										processEventNode(eventNode);
									});
								}
							},300);

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: subtree };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
		}
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	function isVeloraPopoutRoute(){
		try {
			return /\/dashboard\/stream\/popout(?:\/|$)/i.test(window.location.pathname || "");
		} catch(e){
		}
		return false;
	}

	function findPopoutChatScroller(){
		if (!isVeloraPopoutRoute()){
			return null;
		}
		try {
			var containers = document.querySelectorAll(".overflow-y-auto, [class*='overflow-y-auto']");
			var best = null;
			var bestScore = 0;
			for (var i = 0; i < containers.length; i++){
				var container = containers[i];
				var score = 0;
				var text = "";
				var className = "";
				try {
					text = (container.textContent || "").replace(/\s+/g, " ").trim();
					className = String(container.className || "");
				} catch(e){
				}
				if (container.querySelector && container.querySelector(".chat-message-content")){ score += 100; }
				if (/No messages yet|Connecting to chat|New messages/i.test(text)){ score += 45; }
				if (/Activity will appear here|transactions|followers|subscribers/i.test(text)){ score -= 30; }
				if (className.indexOf("px-1") !== -1 && className.indexOf("pb-1") !== -1){ score += 30; }
				if (className.indexOf("scrollbar-thumb-white/10") !== -1){ score += 25; }
				if (className.indexOf("scrollbar-thin") !== -1){ score += 5; }
				if (score > bestScore){
					bestScore = score;
					best = container;
				}
			}
			if (best && bestScore > 0){
				return best;
			}
			return document.body || null;
		} catch(e){
		}
		return null;
	}

	function findScrollerNearInput(input){
		if (!input){ return null; }
		var node = input;
		var fallback = null;
		var depth = 0;
		while (node && depth < 10){
			try {
				if (node.querySelectorAll){
					var containers = node.querySelectorAll(".overflow-y-auto, [class*='overflow-y-auto']");
					for (var i = 0; i < containers.length; i++){
						var container = containers[i];
						if (!container || container === input){ continue; }
						if (container.contains && container.contains(input)){ continue; }
						if (!fallback){ fallback = container; }
						var text = (container.textContent || "").replace(/\s+/g, " ").trim();
						var className = "";
						try {
							className = String(container.className || "");
						} catch(e){
						}
						if (container.querySelector(".chat-message-content") || /No messages yet|Connecting to chat|New messages/i.test(text) || className.indexOf("scrollbar-thin") !== -1){
							return container;
						}
					}
				}
			} catch(e){
			}
			node = node.parentElement;
			depth++;
		}
		return fallback;
	}

	function findChatContainer(){
		try {
			var root = document.querySelector(".chat-message-content");
			if (root && root.closest){
				var container = root.closest(".overflow-y-auto");
				if (container){
					return container;
				}
			}
		} catch(e){
		}
		try {
			var input = getChatInput();
			var inputContainer = findScrollerNearInput(input);
			if (inputContainer){
				return inputContainer;
			}
		} catch(e){
		}
		try {
			var popoutContainer = findPopoutChatScroller();
			if (popoutContainer){
				return popoutContainer;
			}
		} catch(e){
		}
		return null;
	}


	function startCheck(){
		if (isExtensionOn && checking){return;}

		clearInterval(checking);
		checking = false;
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
			observer = null;
			observerTarget = null;
		}
		if (!isExtensionOn){
			return;
		}
		checking = setInterval(function(){
			try {
				var container = findChatContainer();
				
				if (!container){ return; }
				
				if (observerTarget !== container){
					observerTarget = container;
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){
						dataIndex = 0;
						onElementInserted(container, true);
						scanExistingChat(container);
					},1000);
				}
				checkViewers();
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
