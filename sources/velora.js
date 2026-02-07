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
	
	var channelName = "";
	
	function processMessage(ele){
		console.log(ele);
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
		
		if (ele.skip){
			return;
		}

		var chatimg = ""
		

		var name="";
		try {
			name = escapeHtml(ele.querySelector("[title^='View profile for'], [class*='border-amber'] .text-sm.font-semibold.leading-tight.text-white").textContent);
		} catch(e){
		}
		
		var namecolor="";
		
		var badges=[];
		try {
			ele.querySelectorAll("img[src^='https://assets.velora.tv/badges'], img[src*='/velora-badges/']").forEach(badge=>{
				badge.src = badge.src + "";
				badges.push(badge.src);
			});
			
			
		} catch(e){
		} 

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector("div > div > div.text-sm.break-words.text-white, [class*='border-amber'] > div > div > p")).trim();
		} catch(e){
		}
		
		
		var donation = "";
		try {
			donation = escapeHtml(ele.querySelector(".flex-1.space-y-2 svg>path[d='m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z']").parentNode.nextSibling.textContent);
			if (msg){
				msg = msg.replaceAll('“',"").replaceAll('”',"").trim(); 
			}
		} catch(e){
		}
		
		if (!name || (!msg && !donation)){
	//		console.log("no name");
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
		data.hasDonation = donation;
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "velora";
		
		
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
				
				
				if (window.location.href === "https://velora.tv/dashboard/stream/popout?panels=chat"){
					var viewerSpan = document.querySelector(".min-w-0 > .mt-1").childNodes[0];
				} else {
					var viewerSpan = document.querySelector(".inline-flex.items-center.gap-2.rounded-full > .tracking-normal.text-white.font-semibold").parentNode.nextElementSibling.childNodes[1];
				}
				
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
					let cc = document.querySelectorAll('[aria-label="Chat message input"][contenteditable="true"][data-placeholder][spellcheck="false"][role="textbox"]');
					if(cc.length){
						cc[cc.length-1].focus();
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
								processMessage(addedNode);
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
				var container = document.querySelector(".duration-300.rounded-none > .flex-1.overflow-y-auto.p-4.space-y-3.min-h-0");
				if (!container && window.location.href.startsWith("https://velora.tv/dashboard/stream/popout?")){
					container = document.querySelector("body");
				} 
				
				if (!container.marked){
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){
						dataIndex = 0;
						if (window.location.href.startsWith("https://velora.tv/dashboard/stream/popout?")){
							onElementInserted(container, true);
						} else {
							onElementInserted(container);
						}
					},2000);
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
