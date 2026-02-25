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

	function getMessageIndex(ele) {
		if (!ele || !ele.dataset) {
			return NaN;
		}
		var rawIndex = ele.dataset.itemIndex || ele.dataset.index;
		if (typeof rawIndex === "undefined") {
			return NaN;
		}
		var parsed = parseInt(rawIndex, 10);
		return Number.isFinite(parsed) ? parsed : NaN;
	}
	
	var channelName = "";
	
	function processMessage(ele){
		//console.log(ele);
		if (!ele || !ele.isConnected){
		//	console.log("no connected");
			return;
		}
		
		if (ele.dataset.knownSize){
			if (!parseInt(ele.dataset.knownSize)){
		//		console.log("no knownSize");
				return;
			}
		}
		
		var messageIndex = getMessageIndex(ele);
		if (!Number.isNaN(messageIndex) && (messageIndex <= dataIndex)) {
			return;
		}

		
		var chatimg = ""

		try {
			chatimg = ele.querySelector("img[src^='https://cdn.blaze.stream/uploads/avatar/']").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector("button[title='User actions'],button[title].truncate.text-sm.font-semibold.text-white").textContent.split(":")[0]);
		} catch(e){
		}
		
		var namecolor="";
		try {
			namecolor = getComputedStyle(ele.querySelector("button[title='User actions']")).color;
		} catch(e){
		}
		
		var badges=[];
		/* try {
			ele.querySelectorAll("img[class^='ChatBadge_image_'][src]").forEach(badge=>{
				badges.push(badge.src);
			});
		} catch(e){
		} */

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".text-text.pl-1.font-normal, span.block.min-w-0.break-words")).trim();
		} catch(e){
		}
		
		var dono="";
		try {
			dono = getAllContentNodes(ele.querySelector("div.flex.flex-none.items-center.gap-2>span.rounded-full")).trim();
		} catch(e){
		}
		
		
		
		if (!msg || !name){
	//		console.log("no name");
			return;
		}
		
		if (!Number.isNaN(messageIndex) && (messageIndex > dataIndex)) {
			dataIndex = messageIndex;
		}
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "blaze";
		
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				let viewerSpan = document.querySelector("svg > path[d^='M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0']").parentNode.nextSibling;
				if (viewerSpan && viewerSpan.textContent){
					let views = viewerSpan.textContent.toUpperCase();
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
									type: 'blaze',
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
				
				if ("getSource" == request){sendResponse("blaze");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('div[contenteditable="true"][data-placeholder].editable').focus();
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
	
	
	function onElementInserted(target) {
		var scheduleProcess = function(node) {
			try {
				if (!node || node.nodeType !== 1) {
					return;
				}
				if (node.matches && node.matches("[data-item-index],[data-index]")) {
					setTimeout(function() {
						processMessage(node);
					}, 200);
				}
				if (node.querySelectorAll) {
					node.querySelectorAll("[data-item-index],[data-index]").forEach(function(item) {
						setTimeout(function() {
							processMessage(item);
						}, 200);
					});
				}
			} catch (e) {
				console.error("Error scheduling blaze node:", e);
			}
		};

		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.type === "attributes") {
					scheduleProcess(mutation.target);
					return;
				}
				if (mutation.addedNodes.length) {
					//console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							const addedNode = mutation.addedNodes[i];
							scheduleProcess(addedNode);

						} catch(e){
							console.error("Error processing added node:", e);
						}
					}
				}
			});
		};
		
		var config = {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-index", "data-item-index", "data-known-size"]
		};
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
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
				var container = document.querySelector("[data-testid='virtuoso-item-list']");
				if (!container.marked){
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){
						dataIndex = -1;
						container.querySelectorAll("[data-item-index],[data-index]").forEach(function(item){
							var indexx = getMessageIndex(item);
							if (!Number.isNaN(indexx) && (indexx > dataIndex)) {
								dataIndex = indexx;
							}
						});
						onElementInserted(container);
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
