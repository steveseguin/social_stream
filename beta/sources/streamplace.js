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
		return String(unsafe || "")
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";

		if (!element){return resp;}
		if (element.nodeType === 3){
			return element.textContent ? escapeHtml(element.textContent) : "";
		}
		if (element.nodeType === 1){
			if (settings.textonlymode){
				return element.textContent ? escapeHtml(element.textContent) : "";
			}
			if (element.nodeName == "A" && element.href){
				return " <a href='" + escapeHtml(element.href) + "' target='_blank'>" + escapeHtml(element.textContent || element.href) + "</a> ";
			}
			if (element.nodeName == "IMG" && element.src){
				return element.outerHTML;
			}
		}

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
	var processedMessageNodes = new WeakSet();
	var initialBacklogSkipped = false;
	var CHAT_TEXT_SELECTOR = ".css-1jxf684";
	var lastViewerCount = null;

	function getCleanText(ele){
		return ((ele && ele.textContent) ? ele.textContent : "").replace(/\s+/g, " ").trim();
	}

	function stripHtmlContent(html){
		var temp = document.createElement("div");
		temp.innerHTML = html || "";
		return (temp.textContent || temp.innerText || "").replace(/\s+/g, " ").trim();
	}

	function isTimestampText(text){
		return /^\d{1,2}:\d{2}$/.test((text || "").trim());
	}

	function getTimestampNodes(ele){
		var resp = [];
		if (!ele || !ele.querySelectorAll){
			return resp;
		}
		try {
			ele.querySelectorAll("div,span").forEach(function(node){
				if (isTimestampText(node.textContent || "")){
					resp.push(node);
				}
			});
		} catch(e){}
		return resp;
	}

	function isMessageRoot(ele){
		return !!(ele && ele.querySelector && ele.querySelector(CHAT_TEXT_SELECTOR) && getTimestampNodes(ele).length === 1);
	}

	function findMessageRoot(ele){
		if (!ele || ele.nodeType !== 1){
			return null;
		}

		var current = ele;
		for (var i = 0; current && i < 10; i++){
			if (isMessageRoot(current)){
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	function collectMessageNodes(node){
		var resp = [];

		function addMessageRoot(ele){
			var root = findMessageRoot(ele);
			if (root && resp.indexOf(root) === -1){
				resp.push(root);
			}
		}

		if (!node || node.nodeType !== 1){
			return resp;
		}

		addMessageRoot(node);

		try {
			node.querySelectorAll(CHAT_TEXT_SELECTOR).forEach(function(ele){
				addMessageRoot(ele);
			});
		} catch(e){}

		return resp;
	}

	function markMessageProcessed(ele){
		if (!ele){
			return;
		}
		processedMessageNodes.add(ele);
		ele.skip = true;
	}

	function markExistingMessagesProcessed(target){
		collectMessageNodes(target).forEach(function(ele){
			markMessageProcessed(ele);
		});
	}

	function getAuthorNode(ele){
		var nodes = [];
		try {
			nodes = ele.querySelectorAll(CHAT_TEXT_SELECTOR);
		} catch(e){
			return null;
		}

		for (var i = 0; i < nodes.length; i++){
			var text = getCleanText(nodes[i]);
			if (text.charAt(0) === "@"){
				return nodes[i];
			}
		}
		return null;
	}

	function getInlineColor(ele){
		var current = ele;
		for (var i = 0; current && i < 5; i++){
			if (current.style && current.style.color){
				return current.style.color;
			}
			current = current.parentElement;
		}
		return "";
	}

	function getChildContaining(parent, child){
		var current = child;
		while (current && current.parentElement && current.parentElement !== parent){
			current = current.parentElement;
		}
		return (current && current.parentElement === parent) ? current : null;
	}

	function getMessageBodyContainer(root, authorNode){
		if (!root || !authorNode || !root.children){
			return null;
		}
		for (var i = 0; i < root.children.length; i++){
			if (root.children[i].contains(authorNode)){
				return root.children[i];
			}
		}
		return null;
	}

	function getBadges(root, authorNode){
		var badges = [];
		var bodyContainer = getMessageBodyContainer(root, authorNode);
		var authorChild = getChildContaining(bodyContainer, authorNode);
		if (!authorChild || !authorChild.querySelectorAll){
			return badges;
		}
		try {
			authorChild.querySelectorAll("img[src]").forEach(function(badge){
				if (badge.src && badges.indexOf(badge.src) === -1){
					badges.push(badge.src);
				}
			});
		} catch(e){}
		return badges;
	}

	function getMessageAfterAuthor(root, authorNode){
		var bodyContainer = getMessageBodyContainer(root, authorNode);
		var authorChild = getChildContaining(bodyContainer, authorNode);
		var parts = [];
		var foundAuthor = false;

		if (!bodyContainer || !authorChild){
			return "";
		}

		for (var i = 0; i < bodyContainer.childNodes.length; i++){
			var child = bodyContainer.childNodes[i];
			if (child === authorChild){
				foundAuthor = true;
				continue;
			}
			if (!foundAuthor){
				continue;
			}
			if ((child.textContent || "").trim() === ":"){
				continue;
			}

			var part = getAllContentNodes(child).trim();
			if (part){
				parts.push(part);
			}
		}

		return parts.join(" ").replace(/\s+/g, " ").trim();
	}

	function getReplyDetails(root, authorNode){
		var bodyContainer = getMessageBodyContainer(root, authorNode);
		var authorChild = getChildContaining(bodyContainer, authorNode);
		var replyParts = [];

		if (!bodyContainer || !authorChild){
			return null;
		}

		for (var i = 0; i < bodyContainer.childNodes.length; i++){
			var child = bodyContainer.childNodes[i];
			if (child === authorChild){
				break;
			}
			var text = getCleanText(child);
			if (!text || isTimestampText(text)){
				continue;
			}
			if (/^\s*system message\s*$/i.test(text)){
				continue;
			}
			replyParts.push(getAllContentNodes(child).trim());
		}

		if (!replyParts.length){
			try {
				var replyNode = null;
				root.querySelectorAll("[aria-label], [title], [data-testid], [id], [class]").forEach(function(node){
					if (replyNode){
						return;
					}
					var marker = [
						node.getAttribute("aria-label") || "",
						node.getAttribute("title") || "",
						node.getAttribute("data-testid") || "",
						node.id || "",
						node.className || ""
					].join(" ");
					if (/reply/i.test(marker) && node !== authorNode && !node.contains(authorNode)){
						var text = getCleanText(node);
						if (text && stripHtmlContent(getMessageAfterAuthor(root, authorNode)).indexOf(text) === -1){
							replyNode = node;
						}
					}
				});
				if (replyNode){
					replyParts.push(getAllContentNodes(replyNode).trim());
				}
			} catch(e){}
		}

		var label = replyParts.join(" ").replace(/\s+/g, " ").trim();
		if (!label){
			return null;
		}
		if (!/^reply/i.test(stripHtmlContent(label))){
			label = "Replying to " + label;
		}
		return {
			label: label,
			text: stripHtmlContent(label)
		};
	}

	function parseRelayName(message){
		var match = (message || "").match(/^([^:@]{1,80}\s+\(([A-Za-z][A-Za-z0-9 _-]{1,30})\)):\s+([\s\S]+)$/);
		if (!match){
			return null;
		}
		return {
			name: match[1].trim(),
			message: match[3].trim()
		};
	}

	function processMessage(ele){
		//console.log(ele);
		if (!ele || !ele.isConnected){
		//	console.log("no connected");
			return;
		}

		var messageRoot = findMessageRoot(ele) || ele;

		if (processedMessageNodes.has(messageRoot) || messageRoot.skip){
			return;
		}


		var chatimg = ""

		try {
			chatimg = messageRoot.querySelector("img.aspect-square[src]").src;
		} catch(e){
		}

		var name="";
		var authorNode = getAuthorNode(messageRoot);
		if (!authorNode){
			return;
		}
		try {
			name = escapeHtml(getCleanText(authorNode));
		} catch(e){
			return;
		}

		var namecolor="";
		try {
			namecolor = getInlineColor(authorNode);
		} catch(e){
		}

		var badges = getBadges(messageRoot, authorNode);

		var msg="";
		try {
			msg = getMessageAfterAuthor(messageRoot, authorNode);
		} catch(e){
			return;
		}

		var relayMessage = parseRelayName(msg);
		var originalName = name;
		if (relayMessage){
			name = escapeHtml(relayMessage.name);
			msg = relayMessage.message;
			namecolor = "";
			badges = [];
		}

		if (!msg || !name){
	//		console.log("no name");
			return;
		}

		markMessageProcessed(messageRoot);

		var replyDetails = null;
		var originalMessage = "";
		if (!settings.excludeReplyingTo){
			replyDetails = getReplyDetails(messageRoot, authorNode);
			if (replyDetails && replyDetails.label){
				originalMessage = msg;
				if (settings.textonlymode){
					msg = replyDetails.text + ": " + msg;
				} else {
					msg = "<i><small>" + replyDetails.label + ":&nbsp;</small></i> " + msg;
				}
			}
		}


		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "streamplace";
		if (replyDetails && replyDetails.label){
			data.initial = replyDetails.label;
			data.reply = originalMessage;
			data.meta = {
				reply: {
					text: replyDetails.text
				}
			};
		}
		if (relayMessage){
			data.meta = data.meta || {};
			data.meta.bridgeAuthor = stripHtmlContent(originalName);
		}


		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;

	function parseCompactNumber(text){
		var value = (text || "").toUpperCase().replace(/,/g, "").trim();
		var multiplier = 1;
		if (value.indexOf("K") !== -1){
			multiplier = 1000;
			value = value.replace("K","");
		} else if (value.indexOf("M") !== -1){
			multiplier = 1000000;
			value = value.replace("M","");
		}
		value = value.split(" ")[0].replace(/[^0-9.]/g, "");
		if (!value || value != parseFloat(value)){
			return null;
		}
		return Math.round(parseFloat(value) * multiplier);
	}

	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				var viewerSpan = null;
				var viewerPath = document.querySelector("svg > path[d^='M2.062 12.348'], svg > path[d^='M15 12a3']");
				if (viewerPath && viewerPath.parentNode){
					viewerSpan = viewerPath.parentNode.nextElementSibling;
				}
				if (viewerSpan && viewerSpan.textContent){
					var views = parseCompactNumber(viewerSpan.textContent);
					if (views !== null && views !== lastViewerCount){
						lastViewerCount = views;
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: 'streamplace',
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

				if ("getSource" == request){sendResponse("streamplace");	return;	}
				if ("focusChat" == request){
					document.querySelector('#type-a-message,textarea,input[type="text"]').focus();
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


	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					//console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							const addedNode = mutation.addedNodes[i];
							if (addedNode.nodeType !== 1) continue; // Only process element nodes

							if (addedNode.skip){continue;}

							var messageNodes = collectMessageNodes(addedNode);
							for (var j = 0; j < messageNodes.length; j++){
								setTimeout(function(ele){
										processMessage(ele);
								},300,messageNodes[j]);
							}

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};

		var config = { childList: true, subtree: true };
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

		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		observerTarget = target;
	}

	console.log("social stream injected");


	function startCheck(){
		if (isExtensionOn && checking){return;}

		clearInterval(checking);
		checking = false;
		if (!isExtensionOn){
			return;
		}
		checking = setInterval(function(){
			try {
				var container = document.querySelector("#root");
				if (lastURL !== window.location.href){
					lastURL = window.location.href;
					processedMessageNodes = new WeakSet();
					initialBacklogSkipped = false;
					if (container){
						container.marked = false;
					}
				}
				if (container && (!container.marked || !observer || observerTarget !== container || !container.isConnected)){
					container.marked=true;
					if (!initialBacklogSkipped){
						markExistingMessagesProcessed(container);
						initialBacklogSkipped = true;
					}

					console.log("CONNECTED");

					onElementInserted(container);
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
