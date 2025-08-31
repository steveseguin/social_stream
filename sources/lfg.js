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
	
	// Usage: node.srcset = rewriteSrcset(node.srcset, "https://domain/");
	function rewriteSrcset(srcset, base) {
	  if (!srcset || !base) { return srcset; }
	  return srcset
		.split(",")
		.map((part) => {
		  const trimmed = part.trim();
		  if (!trimmed) { return ""; }

		  // Split "URL descriptor" -> ["URL", " 300w"/" 2x"/""]
		  const match = trimmed.match(/^(\S+)(\s+.+)?$/);
		  const url = match ? match[1] : trimmed;
		  const desc = match && match[2] ? match[2] : "";

		  // Leave absolute and protocol-relative URLs alone
		  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) || url.startsWith("//")) {
			return url + desc;
		  }

		  try {
			return new URL(url, base).toString() + desc;
		  } catch {
			return url + desc; // fallback unchanged
		  }
		})
		.filter(Boolean)
		.join(", ");
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
						if (node.srcset) {node.srcset = rewriteSrcset(node.srcset, "https://lfg.tv/");}
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
	
	function processMessage(ele, send=true){
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
			chatimg = ele.querySelector("img.rounded-full[src][alt]").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector("span.font-medium.text-sm.cursor-pointer").textContent);
		} catch(e){
		}
		
		var namecolor="";
		try {
			namecolor = ele.querySelector("span.font-medium.text-sm.cursor-pointer").style.color;
		} catch(e){
		}
		
		var badges=[];
		try {
			ele.querySelectorAll("img[alt*='badge'][src]").forEach(badge=>{
				badges.push(badge.src);
			});
		} catch(e){
		} 

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector("div.text-gray-200.text-base[style]")).trim();
		} catch(e){
		}
		
		
		if (!msg.trim() || !name){
	//		console.log("no name");
			return;
		}
		
		
		var originalMessage = "";
		var replyMessage = "";
		  
		  
		  // <div class="mb-2 pl-2 border-l-2 border-gray-600 bg-gray-800/30 rounded-r px-2 py-1"><div class="flex items-center gap-1 text-xs text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-reply w-3 h-3" aria-hidden="true"><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path><path d="m9 17-5-5 5-5"></path></svg><span>Reply to <span class="text-white font-medium">Renegade_Tigers</span></span></div><div class="text-xs text-gray-300 mt-1 truncate max-w-sm">@chchris_yoos_gt500 @sususyprieto70 @sousoundstixx what's up fam gtsy again, Happy Saturday</div></div>
		  if (settings.replyingto){
			  if (ele.querySelector(".text-xs.text-gray-300.mt-1.truncate.max-w-sm") && ele.querySelector(".text-white.font-medium")){
				let reply = ele.querySelector(".text-xs.text-gray-300.mt-1.truncate.max-w-sm");
				if (reply?.parentNode.querySelector(".text-white.font-medium")){
					reply = escapeHtml(reply.parentNode.querySelector(".text-white.font-medium").textContent +": "+ele.querySelector(".text-xs.text-gray-300.mt-1.truncate.max-w-sm").textContent);
					
					if (reply.trim()){
						replyMessage = reply;
						originalMessage = msg;
						if (settings.textonlymode) {
							msg = reply + ": " + msg;
						} else {
							msg = "<i><small>"+reply + ":&nbsp;</small></i> " + msg;
						}
					}
				}
			  }
		  }
		
		/* if (ele.dataset.index){
			let indexx = parseInt(ele.dataset.index);
			if (indexx>dataIndex){
				dataIndex = indexx;
			} else {
				//console.log("bad dataIndex");
				return;
			}
		} */
		
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
		data.type = "lfg";
		
		 if (replyMessage){
			data.initial = replyMessage;
		}
	    if (originalMessage){
			data.reply = originalMessage;
		}
		
		pushMessageIfNew(data, ele, send);
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
				let viewerSpan = document.querySelector(".items-center > svg > path[d='M20 21a8 8 0 0 0-16 0']").parentNode.nextElementSibling;
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
									type: 'lfg',
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
				
				if ("getSource" == request){sendResponse("lfg");	return;	}
				
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('div.tiptap.ProseMirror[contenteditable="true"]').focus();
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
	
	function pushMessageIfNew(data, ele, send=true) {
	  try {
		const { isNew } = messageTracker.markIfNew(data, ele);
		if (!isNew) { return; } // swallow duplicates
		if (send){
			pushMessage(data);      // send only once
		}
	  } catch (e) { /* no-op */ }
	}

	
	// ======== MESSAGE DE-DUPE (fingerprint + timed LRU) ========
	const messageTracker = (() => {
	  // key => firstSeenTs
	  const seen = new Map();
	  let sweepCount = 0;

	  // Defaults; can be overridden via settings:
	  // settings.dedupeWindowMs  : repeat window (same message treated as duplicate)
	  // settings.dedupeKeepMs    : how long we keep keys around for GC
	  // settings.dedupeMax       : max keys stored before trimming oldest
	  const DEFAULT_WINDOW = 2 * 60 * 1000;   // 2 minutes
	  const DEFAULT_KEEP   = 10 * 60 * 1000;  // 10 minutes
	  const DEFAULT_MAX    = 5000;            // cap map size

	  const decodeEntities = (s) => (s || "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'");

	  // Convert any HTML into a stable text form (emotes/images keep ALT text)
	  const htmlToText = (html) => {
		if (!html) return "";
		let s = html;
		s = s.replace(/<img [^>]*alt="([^"]*)"[^>]*>/gi, " $1 ");  // keep ALT as text
		s = s.replace(/<[^>]+>/g, " ");                            // strip tags
		s = decodeEntities(s);
		return s.replace(/\s+/g, " ").trim();
	  };

	  const normalize = (s) => htmlToText(String(s || "")).toLowerCase();

	  // Tiny fast hash (djb2 xor variant)
	  const hash = (str) => {
		let h = 5381;
		for (let i = 0; i < str.length; i++) {
		  h = ((h << 5) + h) ^ str.charCodeAt(i);
		}
		return (h >>> 0).toString(36);
	  };

	  const keyFrom = (data, ele) => {
		let domId = "";
		try {
		  domId =
			(ele && (ele.id || ele.dataset?.messageId || ele.dataset?.id || ele.dataset?.index)) || "";
		} catch {}
		const name  = normalize(data.chatname);
		const text  = normalize(data.chatmessage);
		const init  = normalize(data.initial);
		const reply = normalize(data.reply);
		const chan  = normalize(typeof channelName === "string" ? channelName : "");
		// Include DOM id if present + channel + sender + content + reply context
		return hash([domId, chan, name, text, init, reply].join("|"));
	  };

	  const prune = (now, keepMs, maxKeys) => {
		// Time-based pruning
		for (const [k, ts] of seen) {
		  if (now - ts > keepMs) seen.delete(k);
		}
		// Size-based pruning (Map keeps insertion order)
		while (seen.size > maxKeys) {
		  const oldestKey = seen.keys().next().value;
		  seen.delete(oldestKey);
		}
	  };

	  const markIfNew = (data, ele) => {
		const now   = Date.now();
		const ttl   = Math.max(500, Number(settings?.dedupeWindowMs) || DEFAULT_WINDOW);
		const keep  = Math.max(ttl, Number(settings?.dedupeKeepMs)   || DEFAULT_KEEP);
		const limit = Math.max(100, Number(settings?.dedupeMax)       || DEFAULT_MAX);

		const key = keyFrom(data, ele);
		const ts  = seen.get(key);

		if (ts && (now - ts) < ttl) {
		  // duplicate within window
		  return { isNew: false, key };
		}

		// mark / refresh
		seen.set(key, now);

		// periodic cleanup
		if ((++sweepCount % 250) === 0) prune(now, keep, limit);

		return { isNew: true, key };
	  };

	  return { markIfNew };
	})();
	
	function startCheck(){
		if (isExtensionOn && checking){return;}

		clearInterval(checking);
		checking = false;
		if (!isExtensionOn){
			return;
		}
		checking = setInterval(function(){
			try {
				var container = document.querySelector(".right-0 .bg-sidebar [style*='scrollbar-width']");
				if (!container.marked){
					container.marked=true;
					
					console.log("CONNECTED chat detected");

					setTimeout(()=>{
						
						container.childNodes.forEach(node=>{
							processMessage(node, false);
						});
						
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
