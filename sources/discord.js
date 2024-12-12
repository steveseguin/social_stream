(function () {
	 
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (25 * 1024)) {
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
	
	function escapeHtml(unsafe) {
		try {
			unsafe = unsafe.replace("\n", " ");
			unsafe = unsafe.replace("\t", " ");
			unsafe = unsafe.replace("\r", " ");
			if (settings.textonlymode) { // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				.replace(/&/g, "&amp;") // i guess this counts as html
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;") || "";
		} catch (e) {
			return "";
		}
	}


	function getAllContentNodes(element) { // takes an element.
		var resp = "";

		if (!element) {
			return resp;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.textContent) {
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}

		element.childNodes.forEach(node => {
			if (node.childNodes.length) {
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
				resp += escapeHtml(node.textContent) + "";
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
					if (node && node.classList && node.classList.contains("zero-width-emote")) {
						resp += "<span class='zero-width-parent'>" + node.outerHTML + "</span>";
					} else if (node && node.tagName && (node.tagName == "IMG") && node.src) {
						node.src = node.src + "";
						resp += node.outerHTML;
					} else {
						resp += node.outerHTML;
					}
				}
			}
		});
		return resp;
	}



	var lastMessage = "";
	var textSettingsArray = [];
	
	function processMessage(ele){
		// console.log(ele);
		
		var mid = ele.id.split("chat-messages-");
		if (mid.length==2){
			mid = mid[1];
		} else {
			return;;
		}
		
		if (!settings.discord && !window.electronApi){
			// discord isn't allowed via settings
			return;
		}
		
		if (textSettingsArray.length) {
			var channel = document.location.pathname.split("/").pop();
			if (!textSettingsArray.includes(channel)) {
				return;
			}
		}
		
		mid = mid.split("-");
		if (mid.length==2){
			mid = mid[1];
		} else {
			mid = mid[0];
		}
	
		var chatimg = "";
		try{
		   chatimg = ele.querySelector("img[class*='avatar-'],img[class*='avatar_']").src+"";
		} catch(e){
		}
		var bot = false;
		var name="";
		try {
			name = getAllContentNodes(ele.querySelector("#message-username-"+mid+" [class^='username']")).trim();
			
			if (ele.querySelector("#message-username-"+mid+" [class^='botTag_']")){
				bot = true;
			}
		} catch(e){
		}
		
		
		var msg = "";
		
		try {
			msg = getAllContentNodes(ele.querySelector("#message-content-"+mid)).trim();
		} catch(e){}
		
		if (!msg){
			try {
				msg = getAllContentNodes(ele.querySelector("#message-accessories-"+mid+" [class^='embedDescription']")).trim();
			} catch(e){}
		}
		
		var contentimg = "";
		try {
			contentimg = ele.querySelector("div[class^='imageContent'] img[src], div[class^='imageContent'] video[src]").src+"";
		} catch(e){
			try {
				contentimg = ele.querySelector("img[data-type='sticker']").src+"";
			} catch(e){
			}
		}
		
		
		if (!name && !chatimg){
			for (var i=0; i<50;i++){
				try {
					ele = ele.previousElementSibling;
				} catch(e){
					break;
				}
				try {
					if (!name){
						name = getAllContentNodes(ele.querySelector("[id^='message-username-']")).trim();
					}
				} catch(e){
				}
				try {
					if (!chatimg){
						chatimg = ele.querySelector("img[class*='avatar-'],img[class*='avatar_']").src +"";
					}
				} catch(e){
				}
				if (name){break;}
			}
		}
		

		var data = {};
		data.id = mid;
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		if (bot){
			data.bot = true;
		}
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "discord";
		
		console.log(data);
		
		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		if (data.contentimg){
			toDataURL(data.contentimg, function(dataUrl) {
				data.contentimg = dataUrl;
				if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl2) {
						data.chatimg = dataUrl2;
						pushMessage(data);
					});
				} else {
					pushMessage(data);
				}
			});
		} else {
			if (data.chatimg){
				toDataURL(data.chatimg, function(dataUrl) {
					data.chatimg = dataUrl;
					pushMessage(data);
				});
			} else {
				pushMessage(data);
			}
		}
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
			if (settings.customdiscordchannel.textsetting) {
				textSettingsArray = settings.customdiscordchannel.textsetting
					.split(",")
					.map(value => {
						value = value.trim();
						return value.split("/").pop();
					})
					.filter(value => value);
			} else {
				textSettingsArray = [];
			}
		}
	});
	
	
	
	(function() {
		var css = '.hidden123{display:none!important;} .unstyle123{inset:0 0 0 0!important;}',
			head = document.head || document.getElementsByTagName('head')[0],
			style = document.createElement('style');

		style.type = 'text/css';
		if (style.styleSheet) {
			// This is required for IE8 and below.
			style.styleSheet.cssText = css;
		} else {
			style.appendChild(document.createTextNode(css));
		}

		head.appendChild(style);

		// Function to handle the visibility toggle
		function toggleVisibility(hide) {
			document.querySelectorAll("*:not(video):not([class^='overlayTitleText'])").forEach(x => {
				if (x.querySelector && !x.querySelector("video,[class^='overlayTitleText']")) {
					x.classList.toggle("hidden123", hide);
				}
				if (x.style && x.style.includes && x.style.includes("inset")) {
					x.classList.toggle("unstyle123", hide);
				}
			});
		}

		// Add keydown event listener
		document.addEventListener('keydown', function(event) {
			if (event.ctrlKey && event.shiftKey) {
				if (event.key === '<') {
					console.log('CTRL + SHIFT + < pressed');
					toggleVisibility(true);
				} else if (event.key === '>') {
					console.log('CTRL + SHIFT + > pressed');
					toggleVisibility(false);
				}
			}
		});

		// MutationObserver to handle dynamically added elements
		var observer = new MutationObserver(function(mutationsList) {
			for (const mutation of mutationsList) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					toggleVisibility(document.querySelector('.hidden123') !== null);
				}
			}
		});

		// Observe the entire body for changes
		observer.observe(document.body, { childList: true, subtree: true });

	})();

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
				
					if (textSettingsArray.length) {
						var channel = document.location.pathname.split("/").pop();
						if (!textSettingsArray.includes(channel)) {
							sendResponse(false);
							return;
						}
					}
				
					document.querySelector('div[class*="slateTextArea"]').focus();
					sendResponse(true);
					return;
				}
				
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						if (settings.customdiscordchannel.textsetting) {
							textSettingsArray = settings.customdiscordchannel.textsetting
								.split(",")
								.map(value => {
									value = value.trim();
									return value.split("/").pop();
								})
								.filter(value => value);
						} else {
							textSettingsArray = [];
						}
						
						return;
					}
				}
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL =  "";
	var lastMessageID = 0;
	var observer = null;
	
	function onElementInserted(containerSelector) {
		if (observer){
			try {
				observer.disconnect();
			} catch(e){}
			observer = null;
		}
		var onMutationsObserved = function(mutations) {
			var highestMessage = 0;
			if (lastURL !== window.location.href){
				lastURL = window.location.href;
				lastMessageID = 0;
			}
			if (!window.location.href.includes("/channels/")){
				if (observer){
					try {
						observer.disconnect();
					} catch(e){}
					observer = null;
				}
				return;
			}
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].id && !mutation.addedNodes[i].skip){
							var mid = mutation.addedNodes[i].id.split("chat-messages-");
							if (mid.length==2){
								mid = parseInt(mid[1]);
							} else {
								continue;
							}
							if (highestMessage<mid){
								highestMessage = mid;
							} else {
								continue;
							}
							setTimeout(function(id){
								try{
									if (document.getElementById(id).skip){return;}
									document.getElementById(id).skip = true;
									if (!document.getElementById(id).childNodes.length){return;}
									processMessage(document.getElementById(id));
								} catch(e){}
							},500, mutation.addedNodes[i].id);
						}
					}
					if (highestMessage>lastMessageID){
						lastMessageID = highestMessage;
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected -- MUST BE ENABLED VIA SETTING TOGGLE AS WELL TO USE!!!");

	setInterval(function(){
		if (!window.location.href.includes("/channels/")){return;}
		if (document.querySelector('[data-list-id="chat-messages"]')){
			if (!document.querySelector('[data-list-id="chat-messages"]').marked){
				document.querySelector('[data-list-id="chat-messages"]').marked=true;
				onElementInserted('[data-list-id="chat-messages"]');
			}
		}
	},1000);

})();