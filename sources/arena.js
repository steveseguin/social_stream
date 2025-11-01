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
	//	console.log(ele);
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

		try {
			chatimg = ele.querySelector("img.aspect-square[src]").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".flex-grow.text-sm > [class][style][role]").textContent);
		} catch(e){
		}
		
		var namecolor="";
		try {
			namecolor = ele.querySelector(".flex-grow.text-sm > [class][style][role]").style.color;
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
			msg = getAllContentNodes(ele.querySelector(".flex-grow.text-sm > div.inline > span, .flex-grow.text-sm > div.mt-1 > span")).trim();
		} catch(e){
		}
		
		
		if (!msg || !name){
	//		console.log("no name");
			return;
		}
		
		if (ele.dataset.index){
			let indexx = parseInt(ele.dataset.index);
			if (indexx>dataIndex){
				dataIndex = indexx;
			} else {
				//console.log("bad dataIndex");
				return;
			}
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
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "arenasocial";
		
		
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
				let viewerSpan = document.querySelector("svg > path[d='M15 12a3 3 0 11-6 0 3 3 0 016 0z']").parentNode.nextElementSibling;
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
									type: 'arenasocial',
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
				
				if ("getSource" == request){sendResponse("arenasocial");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('#type-a-message').focus();
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
		
		var config = { childList: true, subtree: false };
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
				if (!window.location.href.startsWith("https://arena.social/live/")){return;}
				var container = document.querySelector("[data-testid='virtuoso-item-list']");
				if (!container.marked){
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){
						dataIndex = 0;
						onElementInserted(container);
					},2000);
				}
				checkViewers();
			} catch(e){}
		},2000);
	}
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (e) {
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
