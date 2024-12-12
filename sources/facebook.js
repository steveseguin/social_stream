(function() {
	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {});
		} catch (e) {}
	}
	
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

	// Add this at the top of your script, outside any function
	const imageCache = new Map();

	function getImageInfo(imgOrUrl) {
		return new Promise((resolve, reject) => {
			let url;
			if (imgOrUrl instanceof SVGImageElement) {
				url = imgOrUrl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
			} else if (typeof imgOrUrl === 'string') {
				url = imgOrUrl;
			} else {
				return reject(new Error('Invalid input'));
			}

			// Check if the image URL is already in the cache
			if (imageCache.has(url)) {
				return resolve(imageCache.get(url));
			}

			const checkImage = (blob, img) => {
				const isGeneric = img.naturalWidth === 32 && img.naturalHeight === 32 && blob.size >= 800 && blob.size <= 900;
				imageCache.set(url, isGeneric); // Cache the result
				resolve(isGeneric);
			};

			const fetchImage = (url) => {
				fetch(url)
					.then(response => response.blob())
					.then(blob => {
						const img = new Image();
						img.onload = () => checkImage(blob, img);
						img.onerror = () => {
							imageCache.set(url, false); // Cache as non-generic on error
							reject(new Error('Failed to load image'));
						};
						img.src = URL.createObjectURL(blob);
					})
					.catch(() => {
						imageCache.set(url, false); // Cache as non-generic on fetch error
						reject(new Error('Failed to fetch image'));
					});
			};

			fetchImage(url);
		});
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


	function isEmoji(char) {
		const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
		return emojiRegex.test(char);
	}
	
	function getAllContentNodes(element, textonly=false) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		if (element.ariaLabel){return "";} // this implies we're on the wrong path.
		
		if (element.skip){return "";}
		
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node, textonly)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				node.skip = true; // facebook specific need
				if (!settings.textonlymode && !textonly){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
						node.removeAttribute("width");
						node.removeAttribute("height");
					}
					resp += node.outerHTML;
				} else if (node.nodeName == "IMG"){
					if (node.alt && isEmoji(node.alt)){
						resp += escapeHtml(node.alt);
					}
				}
			}
		});
		return resp;
	}
	
	var dupCheck2 = [];
	var isExtensionOn = true;
	
	function sleep(ms) {
	  return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function processMessage(ele) {
		if (ele == window) {
			return;
		}
		
		var chatimg = "";
		
		var test = ele.querySelectorAll("div[dir='auto'] > div[role='button'][tabindex='0']")
		if (test.length ===1){
			try {
				test[0].click();
				await sleep(100);
			}catch(e){}
		}
		if (!ele.isConnected){
			delete ele.dataset.set123;
			//console.log("1");
			return;}
		try {
			var imgele = ele.childNodes[0].querySelector("image");//.href.baseVal; // xlink:href
			imgele.skip = true;
			
			chatimg = imgele.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
			if (chatimg.includes("32x32")) {
				try {
					let isGeneric = await getImageInfo(chatimg);
					if (!ele.isConnected){
						delete ele.dataset.set123;
						//console.log("2");
						return;}
					if (isGeneric){
						await sleep(200);
						if (!ele.isConnected){
							//console.log("3");
							delete ele.dataset.set123;
							return;}
						await sleep(200);
						if (!ele.isConnected){
							//console.log("4");
							delete ele.dataset.set123;
							return;}
						var imgele = ele.childNodes[0].querySelector("image");
						chatimg = imgele.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					}
				} catch(e){
					//console.log(e);
				}
			}
		} catch (e) {
		}
		var name = "";
		try {
			var nameElement = ele.childNodes[1].childNodes[0].querySelectorAll('span[dir="auto"]')[0];
			nameElement.skip = true;
			name = escapeHtml(nameElement.innerText);
			
		} catch (e) {
			try {
				name = escapeHtml(ele.childNodes[1].childNodes[0].querySelector('a[role="link"]').innerText);
			} catch (e) {
				return;
			}
		}


		var msg = "";
		
		var msgElement = "";
		
		try {
			msgElement = ele.childNodes[1].childNodes[0].querySelectorAll('span[dir="auto"]');
			msgElement = msgElement[msgElement.length -1];
			msg = getAllContentNodes(msgElement);
		} catch(e){}


		if (!msg){
			if (!settings.textonlymode){
				try {
					msgElement = ele.querySelector("ul > li").parentNode.parentNode;
					msgElement.skip = true;
					if (msgElement.nextSibling){msgElement.nextSibling.skip = true;}
					msg = getAllContentNodes(msgElement.parentNode);
				}catch(e){}
			}
		}
		
		if (msg) {
			msg = msg.trim();
			if (name) {
				if (msg.startsWith(name)) {
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}
		
		var dupMessage = msg; // I dont want to include original replies in the dup check; just the message.
		
		try {
			if (settings.replyingto && msg && ele.previousSibling) {
				try {
					//console.log(ele);
					var replyMessage = getAllContentNodes(ele.previousSibling.querySelector("div>div>span>span"), true);
					if (replyMessage) {
						if (settings.textonlymode) {
							msg = replyMessage + ": " + msg;
						} else {
							msg = "<i><small>" + replyMessage + ":&nbsp;</small></i> " + msg;
						}
					}
				} catch (e) {
					//console.error(e);
				}
			}
		} catch (e) {}
		
		var contentimg = "";
		if (!msg){
			try {
				contentimg = ele.querySelector('div>div>div>div>div>div>div>img[draggable="false"][width][height][class][src]').src;
				//msg = "<img src='"+msg+"' />";
			} catch(e){
				//console.log("5");
				return;
			}
		}
		
		if (!msg && !contentimg){return;}

		var badges = [];	// we do badges last, as we have already marked images as used in the msg step, so less likely of confusing baddges with images
		try {
			ele.childNodes[1].childNodes[0].querySelectorAll('div[aria-label] img[src][alt]').forEach(img=>{
				if (img.skip){return;}
				if (msgElement.contains(img)){return;} // just in case skip fails
				if (!img.src.startsWith("data:image/svg+xml,")){
					badges.push(img.src);
					img.skip = true;
				}
			});
		} catch (e) {
		}

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		
		if (window.location.href.includes("workplace.com")){
			data.type = "workplace";
		} else {
			data.type = "facebook";
		}
		
		
		var entry = data.chatname + "+" + data.hasDonation + "+" + dupMessage;
		var entryString = JSON.stringify(entry);

		if (!dupCheck2.includes(entryString)) {
			dupCheck2.push(entryString);
			
			setTimeout(() => {
				const index = dupCheck2.indexOf(entryString);
				if (index > -1) {
					dupCheck2.splice(index, 1);
				}
			}, 15000);

			//console.log(data);
		} else {
			return;
		}
	//	console.log([...dupCheck2]);
		
		//console.warn(data);
		pushMessage(data);
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			try {
				if ("focusChat" == request) {
					
					if (document.querySelectorAll('div[role="textbox"][contenteditable="true"] p').length){
						var eles = document.querySelectorAll('div[role="textbox"][contenteditable="true"] > p');
					} else {
						var eles = document.querySelectorAll('div[contenteditable="true"] div[data-editor]>div[data-offset-key]');
					}
					if (eles.length) {
						var i = eles.length-1;
						while (i>=0){
							try {
								eles[i].focus();
								eles[i].focus();
								eles[i].click();
								eles[i].focus();
								break;
							} catch (e) {}
							i--;
						}
					} else if (document.querySelector('div.notranslate[contenteditable="true"] > p')){
						document.querySelector('div.notranslate[contenteditable="true"] > p').focus();
						document.querySelector('div.notranslate[contenteditable="true"] > p').focus();
						document.querySelector('div.notranslate[contenteditable="true"] > p').click();
						document.querySelector('div.notranslate[contenteditable="true"] > p').focus();
					} else if (document.querySelector("div[data-editor]>[data-offset-key]")) {
						document.querySelector("div[data-editor]>[data-offset-key]").focus();
						document.querySelector("div[data-editor]>[data-offset-key]").focus();
						document.querySelector("div[data-editor]>[data-offset-key]").click();
						document.querySelector("div[data-editor]>[data-offset-key]").focus();
					} else {
						sendResponse(true);
						return;
					}
					sendResponse(true);
					return;
				}
				
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
					}
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
			} catch (e) {}

			sendResponse(false);
		}
	);

	var dupCheck = [];
	
	
	var lastURL = "";
	var processed = 0;
	
	console.log("LOADED SocialStream EXTENSION");
	
	var eles = document.querySelectorAll('div[contenteditable="true"] div[data-editor]>div[data-offset-key]');
	if (eles.length) {
		var i = eles.length-1;
		while (i>=0){
			try {
				eles[i].focus();
			} catch (e) {}
			i--;
		}
	}
	
	var counter=0;
	
	var ttt = setInterval(function() {
		dupCheck = dupCheck.slice(-60); // facebook seems to keep around 40 messages, so this is overkill?
		
		if (lastURL !== window.location.href){
			lastURL = window.location.href;
			processed = 0;
		}  else {
			processed += 1;
		}
		try {
			if (window.location.href.includes("/live/producer/") || window.location.href.endsWith("/videos") || window.location.href.includes("/videos/") || window.location.href.includes("?v=") || window.location.href.includes("/watch/live/")) {
				var main = document.querySelectorAll("[role='article']");
				for (var j = 0; j < main.length; j++) {
					try {
						if (!main[j].dataset.set123) {
							main[j].dataset.set123 = "true";
							if (main[j].id){
								if (main[j].id.startsWith("client:")) {
									continue;
								}
								if (dupCheck.includes(main[j].id)) {
									continue;
								}
								dupCheck.push(main[j].id);
								if (processed>3){
									processMessage(main[j]);
								}
							} else if (main[j].parentNode && main[j].parentNode.id) {
								if (dupCheck.includes(main[j].parentNode.id)){
									continue;
								}
								if (main[j].parentNode.id.startsWith("client:")) {
									continue;
								}
								dupCheck.push(main[j].parentNode.id);
								if (processed>3){
									processMessage(main[j]);
								}
							} else if (main[j].parentNode && !main[j].id && !main[j].parentNode.id) {
								var id = main[j].querySelector("[id]"); // an archived video
								if (id && !(dupCheck.includes(id))) {
									dupCheck.push(id);
									if (processed>3){
										processMessage(main[j]);
									}
								}
							}
						}
					} catch (e) {}
				}
			}
		} catch (e) {console.error(e);}
		
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			
			if (counter%10==0){
				try {
					
					var viewerCount = document.querySelector("[data-instancekey] [role='img'][aria-label]>span[dir='auto']:not([hidden]):not(:has([hidden])):not(:is([hidden] *))");
					
					if (viewerCount && viewerCount.textContent){
						if (viewerCount.textContent == parseInt(viewerCount.textContent)){
							
							chrome.runtime.sendMessage(
								chrome.runtime.id,
								({message:{
										type: 'facebook',
										event: 'viewer_update',
										meta: parseInt(viewerCount.textContent)
									}
								}),
								function (e) {}
							);
						}
					}
				} catch(e){}
			}
			counter+=1;
		}

	}, 800);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(e) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e) {};;
			remoteConnection.datachannel.onopen = function(e) {};;
			remoteConnection.datachannel.onclose = function(e) {};;
			setInterval(function() {
				if (document.hidden) { // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e) {}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function(e) {};
		localConnection.sendChannel.onmessage = function(e) {};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}


})();