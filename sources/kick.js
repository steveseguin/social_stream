(function () {
	
	var cachedUserProfiles = {};
	
	const TimeoutShim = {
		audioCtx: null,
		currentOscillatorId: 0,
		oscillatorActive: false,
		queue: [],
		activeIntervals: new Set(),
		MIN_OSCILLATOR_TIME: 200,
		
		addToQueue(item) {
			if (item.isInterval) {
				this.activeIntervals.add(item.id);
			}
			
			const index = this.queue.findIndex(existing => existing.executeTime > item.executeTime);
			if (index === -1) {
				this.queue.push(item);
			} else {
				this.queue.splice(index, 0, item);
			}

			if (!this.oscillatorActive || (this.queue[0] === item)) {
				this.restartOscillator();
			}
		},

		createTimedOscillator() {
			if (!this.queue.length) {
				this.oscillatorActive = false;
				return;
			}

			const oscillatorId = ++this.currentOscillatorId;
			
			try {
				if (!this.audioCtx) {
					this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
				}

				// Check if audio context is suspended
				if (this.audioCtx.state === 'suspended') {
					// Fall back to regular setTimeout for this execution
					const item = this.queue[0];
					const delay = Math.max(0, item.executeTime - performance.now());
					this.originalSetTimeout(() => {
						if (this.currentOscillatorId === oscillatorId) {
							this.processQueue(item.executeTime + this.MIN_OSCILLATOR_TIME);
						}
					}, delay);
					this.oscillatorActive = true;
					return;
				}

				const oscillator = this.audioCtx.createOscillator();
				const silence = this.audioCtx.createGain();
				silence.gain.value = 0;
				oscillator.connect(silence);
				silence.connect(this.audioCtx.destination);

				const timeStart = this.audioCtx.currentTime;
				const now = performance.now();
				const nextExecuteTime = this.queue[0].executeTime;
				const batchEndTime = nextExecuteTime + this.MIN_OSCILLATOR_TIME;
				const eventsInWindow = this.queue.filter(item => item.executeTime <= batchEndTime);
				const lastEventTime = eventsInWindow.length > 0 ? 
					eventsInWindow[eventsInWindow.length - 1].executeTime : 
					nextExecuteTime;
				
				const waitTime = Math.max(
					this.MIN_OSCILLATOR_TIME,
					lastEventTime - now
				) / 1000;

				oscillator.onended = () => {
					oscillator.disconnect();
					silence.disconnect();
					
					if (this.currentOscillatorId === oscillatorId) {
						this.processQueue(batchEndTime);
					}
				};

				this.oscillatorActive = true;
				oscillator.start(timeStart);
				oscillator.stop(timeStart + waitTime);
				
			} catch (e) {
				console.log('Error in audio timing, falling back:', e);
				// Fall back to regular setTimeout
				const item = this.queue[0];
				const delay = Math.max(0, item.executeTime - performance.now());
				this.originalSetTimeout(() => {
					if (this.currentOscillatorId === oscillatorId) {
						this.processQueue(item.executeTime + this.MIN_OSCILLATOR_TIME);
					}
				}, delay);
				this.oscillatorActive = true;
			}
		},

		processQueue(batchEndTime) {
			const now = performance.now();
			
			while (this.queue.length && this.queue[0].executeTime <= batchEndTime) {
				const item = this.queue.shift();
				
				if (item.isInterval && !this.activeIntervals.has(item.id)) {
					continue;
				}
				
				try {
					item.callback();
				} catch (e) {
					console.log('Error in timer callback:', e);
				}

				if (item.isInterval && this.activeIntervals.has(item.id)) {
					this.addToQueue({
						id: item.id,
						callback: item.callback,
						executeTime: now + item.delay,
						isInterval: true,
						delay: item.delay
					});
				}
			}

			if (this.queue.length) {
				this.restartOscillator();
			} else {
				this.oscillatorActive = false;
			}
		},

		restartOscillator() {
			this.currentOscillatorId++;
			this.createTimedOscillator();
		},

		setTimeout(callback, delay, ...args) {
			if (!callback || typeof callback !== 'function') return;
			const timeoutId = Math.random();
			
			this.addToQueue({
				id: timeoutId,
				callback: () => callback.apply(null, args),
				executeTime: performance.now() + delay,
				isInterval: false
			});
			
			return timeoutId;
		},

		setInterval(callback, delay, ...args) {
			if (!callback || typeof callback !== 'function') return;
			const intervalId = Math.random();
			
			this.addToQueue({
				id: intervalId,
				callback: () => callback.apply(null, args),
				executeTime: performance.now() + delay,
				isInterval: true,
				delay: delay
			});
			
			return intervalId;
		},

		clearInterval(id) {
			this.activeIntervals.delete(id);
			this.queue = this.queue.filter(item => item.id !== id);
			
			if (this.queue.length === 0) {
				this.currentOscillatorId++;
				this.oscillatorActive = false;
			}
			
			return true;
		},

		clearTimeout(id) {
			return this.clearInterval(id);
		},

		initialize() {
			this.originalSetTimeout = window.setTimeout;
			this.originalSetInterval = window.setInterval;
			this.originalClearTimeout = window.clearTimeout;
			this.originalClearInterval = window.clearInterval;

			window.setTimeout = this.setTimeout.bind(this);
			window.setInterval = this.setInterval.bind(this);
			window.clearTimeout = this.clearTimeout.bind(this);
			window.clearInterval = this.clearInterval.bind(this);
			
			return this;
		}
	};

	console.log("About to initialize TimeoutShim");
	const initializedTimeoutShim = TimeoutShim.initialize();
	
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
	
	
	function getAllContentNodes(element) {
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
				if (node.classList && node.classList.contains("seventv-painted-content")){
					resp += node.outerHTML;
				} else {
					resp += getAllContentNodes(node)
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (node && node.classList && node.classList.contains("zero-width-emote")){
					resp += "<span class='zero-width-parent'>"+node.outerHTML+"</span>";
				} else {
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			errorlog(e);
			return await fetch(URL);
		}
	}
	
	async function getKickAvatarImage(username, channelname){
		
		if (username in cachedUserProfiles){
			return cachedUserProfiles[username];
		} 
		cachedUserProfiles[username] = "";
		
		return await fetchWithTimeout("https://kick.com/channels/"+encodeURIComponent(channelname)+"/"+encodeURIComponent(username)).then(async response => {
			return await response.json().then(function (data) {
				if (data && data.profilepic){
					cachedUserProfiles[username] = data.profilepic;
					return data.profilepic;
				}
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	async function processMessage(ele){	// twitch
	
	
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	
	  if (!ele){return;}
	  
	  if (!ele.isConnected){return;}
	  
	  if (settings.customkickstate) {
		return;
	  }
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  try {
		chatname = escapeHtml(ele.querySelector(".chat-entry-username").innerText);
		
	  } catch(e){
		  return;
	  }
	  try {
		nameColor = ele.querySelector(".chat-entry-username").style.color;
	  } catch(e){}
	  
	  
	  
	  if (!settings.textonlymode){
		  try {
			var chatNodes = ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
			if (!chatNodes.length){
				chatNodes = ele.querySelectorAll(".chat-entry-content, .chat-emote-container, .break-all");
			} else {
				chatNodes = ele.querySelectorAll("seventv-container, .chat-emote-container, .seventv-painted-content"); // 7tv support, as of june 20th
				
			}
			for (var i=0;i<chatNodes.length;i++){
				chatmessage += getAllContentNodes(chatNodes[i])+" ";
			}
			chatmessage = chatmessage.trim();
		  } catch(e){
		  }
	  } else {
		  try{
			chatmessage = escapeHtml(ele.querySelector(".chat-entry-content").innerText);
		  } catch(e){}
	  }
	  
	  if (!chatmessage){return;}
	  
	  
	  ele.querySelector(".chat-message-identity").querySelectorAll(".badge-tooltip img[src], .badge-tooltip svg, .base-badge img[src], .base-badge svg, .badge img[src], .badge svg").forEach(badge=>{
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


	  var hasDonation = '';
	
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
	  var chatimg = "";
	  var channelName = window.location.pathname.split("/")[1];
	  
	  if (channelName && chatname){
		  chatimg = await getKickAvatarImage(chatname, channelName) || "";
	  }
	  
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.membership = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "kick";
	  
	  if (!chatmessage && !hasDonation){
		return;
	  }
	  
	  //if (brandedImageURL){
	  //  data.sourceImg = brandedImageURL;
	  //}
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
	  } catch(e){
		  //
	  }
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('#message-input').focus();
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
	
	var lastMessage = "";
	var settings = {};
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0; i < mutation.addedNodes.length; i++) {
						try {
							if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.chatEntry){
								if (pastMessages.includes(mutation.addedNodes[i].dataset.chatEntry)){continue;}
							
								pastMessages.push(mutation.addedNodes[i].dataset.chatEntry)
								pastMessages = pastMessages.slice(-300);
								
								if (SevenTV){
									setTimeout(function(ele){
										processMessage(ele);
									}, 300, mutation.addedNodes[i]); // give seventv time to load, before parsing the message
								} else {
									processMessage(mutation.addedNodes[i]);
								}
								
							} else if (mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner")){
								let ele = mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner");
								
								processMessage(ele);
							}
						} catch(e){}
					}
				}
			});
		};
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	var pastMessages = [];
	var SevenTV = false;
	
	console.log("Social stream injected - old");
	var xxx = setInterval(function(){
		if (document.getElementById("chatroom")){
			clearInterval(xxx);
			setTimeout(function(){
				if (document.getElementById("seventv-extension")){
					SevenTV = true;
				}
				var clear = document.querySelectorAll("div[data-chat-entry]");
				for (var i = 0;i<clear.length;i++){
					pastMessages.push(clear[i].dataset.chatEntry);
				}
				onElementInserted(document.getElementById("chatroom"));
			},3000);
		}
	},1000);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(e){
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
	}

})();