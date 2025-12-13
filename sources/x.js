(function () {
	 
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
		
		const currentMsg = (username || chatname)+"_"+msg;
		const existingIndex = messageHistory.findIndex(entry => {
			let storedMsg, storedTime;
			
			if (typeof entry === 'string') {
				storedMsg = entry;
				storedTime = 0; // Default for legacy format
			} else {
				storedMsg = entry.msg;
				storedTime = entry.time;
			}
			
			// Check if message exists and isn't older than 30 minutes (1800000 ms)
			return storedMsg === currentMsg && (Date.now() - storedTime) < 1800000;
		});

		if (existingIndex >= 0) {
			console.log("Message already exists within the last 30 minutes - updating timestamp");
			// Update the timestamp of the existing entry
			if (typeof messageHistory[existingIndex] === 'string') {
				// Convert string format to object format
				messageHistory[existingIndex] = {
					msg: messageHistory[existingIndex],
					time: Date.now()
				};
			} else {
				// Update timestamp of existing object
				messageHistory[existingIndex].time = Date.now();
			}
			return;
		} else {
			// Store as object with timestamp
			messageHistory.push({
				msg: (username || chatname)+"_"+msg,
				time: Date.now()
			});
			// Keep last 50 messages instead of just 10
			messageHistory = messageHistory.slice(-100);
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
			localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
			localStorage.setItem('messageHistoryTimestamp', Date.now());
		}
	});
	
	var isExtensionOn = true;
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
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
					if ("getSource" == request){
						
						if (settings.detweet) {
							sendResponse("twitter");
						} else {
							sendResponse("x");
						}
						return;	
						
					}
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
		// Check if stored data exists and is less than 24 hours old (24 * 60 * 60 * 1000 = 86400000 ms)
		if (stored && timestamp && (Date.now() - timestamp) < 86400000) {
			return JSON.parse(stored);
		}
		return [];
	})();
	
	
	function findViewerSpan() {
	  const spans = document.querySelectorAll('span');
	  return Array.from(spans).find(span => {
		const text = span.textContent.trim();
		return text.includes('view') && !text.includes('LIVE') && /\d+\s*view/.test(text);
	  });
	}
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				let viewerSpan = findViewerSpan();
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
									type: 'x',
									event: 'viewer_update',
									meta: views
								}
							}),
							function (e) {}
						);
					}
				}
			} catch (e) {
				console.log(e);
			}
		}
	}
	
	setTimeout(function(){checkViewers();},2000);
	setInterval(function(){checkViewers()},5000);
	
	
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
			if (document.querySelector('[data-testid="chatContainer"], main > div > div > div:nth-child(2)')){
				//console.log("found it");
				var container = document.querySelector('[data-testid="chatContainer"], main > div > div > div:nth-child(2)');
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