(function () {
	 
	 
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
	
	function isColorVeryDark(color) {
		const rgb = color.match(/\d+/g).map(Number);

		const R = rgb[0] / 255;
		const G = rgb[1] / 255;
		const B = rgb[2] / 255;

		const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;

		const darkThreshold = 0.2; 

		return luminance < darkThreshold;
	}
	
	function processMessage(ele){
		
		//console.log(ele);
		
		if (ele.skip){return;}
		ele.skip = true;
		
		var chatname="";
		var msg="";
		var chatimg = "";
		var username = "";
		//console.log(ele);
		var badges = [];
		var nameElement = "";
		try {
			nameElement = ele.querySelector("span[style*='color']");
			chatname = escapeHtml(nameElement.textContent.trim());
			chatname = chatname.split(":")[0];
			if (!chatname){
			//	console.warn("no name");
				return;
			}
		} catch(e){
		//	console.warn(e);
			return;
		}
		
		//console.log(ele);
		
		try {
			username = escapeHtml(nameElement.parentNode.parentNode.nextSibling.textContent.trim());
			if (username.startsWith("@")){
				username = username.replace("@","");
			} else {
				username = "";
			}
		} catch(e){	
		//console.warn(e);
		}
		
		try {
			if (ele.childNodes.length>1){
				var node = ele.childNodes[1];
			} else {
				var node = ele.querySelector("button");
			}
			msg = getAllContentNodes(node);
			if (!msg){
				msg = getAllContentNodes([...ele.querySelectorAll("span")].pop());
			}
			msg = msg.trim();
		} catch(e){
		//	console.warn(e);
			return;
		}
		
		try {
			chatimg = ele.querySelector("a[href] img[alt][src]").src;
		} catch(e){
			chatimg = "";
		}
		
		
		var nameColor = "";
		try {
			nameColor = getComputedStyle(nameElement.querySelector("div>span>span>span").parentNode.parentNode).color;
			if (nameColor){
				 if (isColorVeryDark(nameColor)){ // we want to exclude very dark names.
					 nameColor = "";
				 }
			}
		} catch(e){
		//	console.warn(e);
		}
		if (chatname.startsWith("This broadcast has ended")){
			return;
		}

		//console.log(msg);
		//console.log(chatname);
		if (!msg || !chatname){
		//	console.warn("no name or message");
			return;
		}
		
		if (messageHistory.includes((username || chatname)+"_"+msg)) {
			console.log("Message already exists");
			return;
		} else {
			messageHistory.push((username || chatname)+"_"+msg);
			messageHistory = messageHistory.slice(-10);
		}
		
		var data = {};
		data.chatname = chatname;
		if (username){
			data.username = username;
		}
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		
		//console.log(data);
		
		if (settings.detweet){
			data.type = "twitter";
		} else {
			data.type = "x";
		}
		if (isExtensionOn){
			pushMessage(data);
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
	
	window.addEventListener('beforeunload', (e) => {
		if (isExtensionOn) {
			//e.preventDefault();
			//e.returnValue = '';
			localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
			localStorage.setItem('messageHistoryTimestamp', Date.now());
		}
	});
	
	
	var isExtensionOn = true;
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if (isExtensionOn){
					if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
						document.querySelector('textarea').focus();
						sendResponse(true);
						return;
					}
				}
				if (typeof request === "object"){
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
	
	var messageHistory = (() => {
		const stored = localStorage.getItem('messageHistory');
		const timestamp = localStorage.getItem('messageHistoryTimestamp');
		if (stored && timestamp && (Date.now() - timestamp) < 10000) {
			return JSON.parse(stored);
		}
		return [];
	})();
	
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					try {
						for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
							//console.log(mutation.addedNodes[i]);
							if (mutation.addedNodes[i].tagName && (mutation.addedNodes[i].tagName == "DIV")){
								setTimeout(function(ele){
									processMessage(ele);
								},500,mutation.addedNodes[i]);
							}
						}
					} catch(e){}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	function findElementByAttributeAndChildren(parentQuery, childAttrs) {
	  const potentialParents = document.querySelectorAll(parentQuery);
	  for (let parent of potentialParents) {
		let allChildrenMatch = true;
		for (let attr of childAttrs) {
		  if (!parent.querySelector(attr)) {
			allChildrenMatch = false;
			break;
		  }
		}
		if (allChildrenMatch) {
		  return parent;
		}
	  }
	  return null;
	}
	
	try {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.visibilityState = "visible";
		document.mozHidden = false;
		document.webkitHidden = false;
	} catch(e){	}

	try {
		document.hasFocus = function () {return true;};
		window.onFocus = function () {return true;};
		
		Object.defineProperty(document, "mozHidden", { value : false});
		Object.defineProperty(document, "msHidden", { value : false});
		Object.defineProperty(document, "webkitHidden", { value : false});
		Object.defineProperty(document, 'visibilityState', { get: function () { return "visible"; }, value: 'visible', writable: true});
		Object.defineProperty(document, 'hidden', {value: false, writable: true});
		
		setInterval(function(){
			console.log("set visibility");
			window.onblur = null;
			window.blurred = false;
			document.hidden = false;
			document.visibilityState = "visible";
			document.mozHidden = false;
			document.webkitHidden = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},200);
	} catch(e){	}

	try {
		document.onvisibilitychange = function(){
			window.onFocus = function () {return true;};
			
		};
	} catch(e){	}

	try {
		for (event_name of ["visibilitychange",
			"webkitvisibilitychange",
			"blur", // may cause issues on some websites
			"mozvisibilitychange",
			"msvisibilitychange"]) {
				try{
					window.addEventListener(event_name, function(event) {
						event.stopImmediatePropagation();
						event.preventDefault();
					}, true);
				} catch(e){}
		}
	} catch(e){	}

	setInterval(function(){
		try {
			if (document.querySelector('[data-testid="chatContainer"]')){
				//console.log("found it");
				var container = document.querySelector('[data-testid="chatContainer"]');
				if (!container.marked){
					container.marked=true;
					setTimeout(function(container){
						console.log("Social Stream started");
						if (container){
							onElementInserted(container);
						}

					},3000, container);
				}
			} else {
				var container = findElementByAttributeAndChildren("[tabIndex='0']",["textarea[inputmode='text']"]);
				if (!container.marked){
					container.marked=true;
					setTimeout(function(container){
						console.log("Social Stream started");
						if (container){
							onElementInserted(container);
						}

					},3000, container);
				}
			}
		} catch(e){
			//console.warn(e);
		}
	},2000);
})();