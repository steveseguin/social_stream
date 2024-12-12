(function () {
  function pushMessage(data) {
    try {
      chrome.runtime.sendMessage(
        chrome.runtime.id,
        { message: data },
        function (e) {}
      );
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

  function errorlog(e) {
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

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (element.classList.contains("offscreen")){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.classList && node.classList.contains("offscreen")){
				return;
			}
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
				}
			}
		});
		return resp;
	}
	
	
  var messageHistory = [];
  var lastMessageID = 0;
  var lastMessage = "";
  var lastChatName = "";
  
  function processMessage(ele) {
	 
    var chatimg = "";
    var chatname = "";
    var chatmessage = "";

	if (!settings.textonlymode){
		  try {
			chatmessage = getAllContentNodes(ele.querySelector('[data-qa="message-text"]'));
		  } catch(e){}
		  
	} else {
		  try{
			//var childrens = ele.querySelector('[data-qa="message-text"]').querySelectorAll("[alt]");
			//for (var i =0;i<childrens.length;i++){
			//	childrens[i].outerHTML = childrens[i].alt;
			//}
			chatmessage = escapeHtml(ele.querySelector('[data-qa="message-text"]').innerText);
		  } catch(e){}
	}
	  
      // chatmessage = getAllContentNodes(ele.querySelector('[data-qa="message-text"]'));
	  
    if (!chatmessage) {
      return;
    }

    // Get the sender  name
    try {
      chatname = getAllContentNodes(ele.querySelector('[data-qa="message_sender"]'));
    } catch (e) {
	  chatname = "";
      //console.warn(e);
    }
	var prev = false;
    if (!chatname) {
      // Sender name not found? Try in previous siblings
      prev = ele;
      var count = 0;
      while (chatname == "" && count < 500) {
        try {
          count++;
          prev = prev.previousElementSibling;
          chatname = getAllContentNodes(prev.querySelector('[data-qa="message_sender"]'));
        } catch (e) {
          chatname = "";
		  //console.warn(e);
        }
      }
	  if (!prev){
		  return;
	  }
    }
	
	
	if (ele.id){
		if (messageHistory.includes(ele.id)){
			return;
		} else if (isNaN(parseFloat(ele.id))){
			return;
		} else if (lastMessageID && (lastMessageID>parseFloat(ele.id))){
			return;
		} else if (lastMessageID && (parseFloat(ele.id) - lastMessageID<3)){
			if ((lastMessage == chatmessage) && (lastChatName == chatname)){
				return
			}
		}
		lastMessage = chatmessage;
		lastChatName = chatname;
		lastMessageID = parseFloat(ele.id);
		messageHistory.push(ele.id);
	} else {
		return;
	}
	
	messageHistory = messageHistory.slice(-500);
	
    // Get the sender avatar
    try {
      chatimg = ele.querySelector(".c-avatar").querySelector("img").src;
    } catch (e) {
      errorlog(e);
    }
    if (!chatimg && prev) {
      // Sender avatar not found? Try in previous siblings
		 try {
          chatimg = prev.querySelector(".c-avatar").querySelector("img").src;
        } catch (e) {
          chatimg = "";
        }
    }
	
	if (!chatname){
		return;
	}

    if (chatimg) {
      // Use higher resolution image by replacing last digits with 128
      chatimg = chatimg.replace(/-\d+$/g, "-128");
    }
    var data = {};
    data.chatname = chatname;
    data.chatbadges = "";
    data.backgroundColor = "";
    data.textColor = "";
    data.chatmessage = chatmessage;
    data.chatimg = chatimg;
    data.hasDonation = "";
    data.membership = "";
    data.contentimg = "";
    data.textonly = settings.textonlymode || false;
	data.type = "slack";

    pushMessage(data);
    return;
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
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					if (!document.querySelector('[contenteditable][role="textbox"]>p')){
						sendResponse(false);
						return;
					}
					document.querySelector('[contenteditable][role="textbox"]>p').focus();
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
  
	var giveItAtry = setInterval(function(){ // allow pre load
	  if (document.querySelector('[data-qa="slack_kit_list"]')){
			clearTimeout(giveItAtry);
      } else {
			return;
		} 
		setTimeout(function(){
			var xxx = document.querySelectorAll('[data-qa="virtual-list-item"]');
			for (var j = 0; j < xxx.length; j++) {
			  if (xxx[j].marked) {
				continue;
			  }
			  xxx[j].marked = true;
			}
		  setInterval(function () {
			var xxx = document.querySelectorAll('[data-qa="virtual-list-item"]');
			for (var j = 0; j < xxx.length; j++) {
			  if (xxx[j].marked) {
				continue;
			  }
			  xxx[j].marked = true;
			  processMessage(xxx[j]);
			}
		  }, 500);
	},3000);
  },1000);

  // Does not support sending messages in Slack
})();
