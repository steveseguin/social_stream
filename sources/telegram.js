(function () {
	function pushMessage(data){
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
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

	function toDataURL2(blobUrl, callback=false) {
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
		   var recoveredBlob = xhr.response;

		   var reader = new FileReader;

		   reader.onload = function() {
			   if (callback){
				callback(reader.result);
			   }
		   };

		   reader.readAsDataURL(recoveredBlob);
		};

		xhr.open('GET', blobUrl);
		xhr.send();
	};

	function errorlog(e){
		//console.error(e);
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
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
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

	function processMessage(ele, chatimg, chatname){
		
		
		var chatmessage = "";
		var contentimg = "";
		
		try{
			ele.querySelector(".text-content").childNodes.forEach(ce=>{
				if (ce.className && ce.className.includes("Reactions")){
					return
				} else if (ce.nodeName == "IMG"){
					chatmessage+= "<img src='"+ce.src+"'/>";
				} else if (ce.className && ce.className.includes("MessageMeta")){
					// skip; this is date and stuff.
				} else {
					chatmessage += escapeHtml(ce.textContent);
				}
			});
		} catch(e){errorlog(e);}
		
		
		if (ele.querySelector(".avatar-media[src]")){
			chatimg = ele.querySelector(".avatar-media[src]").src;
		}
		if (ele.querySelector(".message-title-name") && ele.querySelector(".message-title-name").textContent){
			chatname = escapeHtml(ele.querySelector(".message-title-name").textContent);
		}
		
		try{
			contentimg = ele.querySelector(".media-inner").querySelector("img").src;
			if (!contentimg){
				contentimg = ele.querySelector(".content-inner").querySelector("img").src;
			}
		} catch(e){errorlog(e);}
	  
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "telegram";
		
		if (!chatmessage && !contentimg){return;}
		
		try {
			if (data.contentimg && !data.contentimg.startsWith("https://")){ // data.contentimg
				toDataURL2(data.contentimg, function(dataUrl) {
					data.contentimg = dataUrl;
					if (data.chatimg && !data.chatimg.startsWith("https://")){
						toDataURL2(data.chatimg, function(dataUrl) {
							data.chatimg = dataUrl;
							pushMessage(data);
							return;
						});
						return;
					}
					pushMessage(data);
					return;
				});
				return;
			} else if (data.chatimg && !data.chatimg.startsWith("https://")){
				toDataURL2(data.chatimg, function(dataUrl) {
					data.chatimg = dataUrl;
					pushMessage(data);
					return;
				});
				return;
			}
			pushMessage(data);
		} catch(e){
		}
	}
	
	var lastMessageID = 0;
	var lastURL =  "";
	
	setInterval(async function(){
		var highestMessage = 0;
		var newChannel = false;
		if (lastURL !== window.location.href){
			lastURL = window.location.href;
			lastMessageID = 0;
			newChannel = true;
		} 
		
		var chatimg="";
		try{
			chatimg = document.querySelector(".ChatInfo>.Avatar>img.avatar-media").src;
			if (!chatimg){
				chatimg = "";
			} 
		} catch(e){errorlog(e);}
		
		try{
			if (!chatimg){
				chatimg = document.querySelector("#MiddleColumn").querySelector("div.Avatar>img");
			}
			if (!chatimg){
				chatimg = "";
			} 
		} catch(e){errorlog(e);}
		
		
		var chatname = "";
		try{
			chatname = escapeHtml(document.querySelector(".ChatInfo>.info>.title").innerText);
			if (chatname==="Replies"){
				chatname = "";
			}
		} catch(e){errorlog(e);}
		
		
		try {
			var xxx = document.querySelectorAll('div.message-list-item'); // messages-container
			for (var j = 0; j< xxx.length; j++){
				if (parseInt(xxx[j].dataset.messageId) && (parseInt(xxx[j].dataset.messageId)>=1) && (parseInt(xxx[j].dataset.messageId)< 1658053682710)){
					if (lastMessageID<parseInt(xxx[j].dataset.messageId)){
						highestMessage = parseInt(xxx[j].dataset.messageId);
					} else {
						continue;
					}
				}
				if (xxx[j].marked){
					continue;
				}
				xxx[j].marked = true;
				if (!newChannel){
					var posibleName = chatname;
					if (settings.mynameext && settings.mynameext.textparam1){
						posibleName = settings.mynameext.textparam1.split(",")[0];
					}
					processMessage(xxx[j],chatimg, posibleName);
					await sleep(10);
				} 
			}
			if (highestMessage>lastMessageID){
				lastMessageID = highestMessage;
			}
		} catch(e){
			 errorlog(e)
		}
	},1000);

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					if (!document.querySelector('.public-DraftEditorPlaceholder-inner')){
						sendResponse(false);
						return;
					}
					document.querySelector(".public-DraftEditorPlaceholder-inner").focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();