(function () {
	 
	
	var isExtensionOn = true;
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

	function formatChatMessageText(unsafe){
		// Capture contract: textonly=true means a literal chatmessage string, not HTML.
		// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
		// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
		// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
		return settings.textonlymode ? (unsafe || "") : escapeHtml(unsafe);
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return formatChatMessageText(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += formatChatMessageText(node.textContent)+" ";
			} else if (node.nodeType === 1){
				// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					if (node.src && node.src.includes("/sticker/")){
						// skip
					} else {
						resp += node.outerHTML;
					}
				}
			}
		});
		return resp;
	}
	
	function rankToColor(rank, maxRank = 400) {
	  // Start and end colors in RGB
	  const startColor = { r: 197, g: 204, b: 218 }; // #4F6692
	  const midColor = { r: 100, g: 115, b: 225 };    // #2026B0
	  const endColor = { r: 81, g: 85, b: 255 };      // #0000FF

	  // Determine color stops based on rank
	  const midRank = parseInt(maxRank/2);
	  let colorStop;
	  

	  if (rank <= midRank) {
		// Calculate how far the rank is between 1 and midRank
		const ratio = (rank - 1) / (midRank - 1);
		colorStop = {
		  r: startColor.r + ratio * (midColor.r - startColor.r),
		  g: startColor.g + ratio * (midColor.g - startColor.g),
		  b: startColor.b + ratio * (midColor.b - startColor.b),
		};
	  } else {
		// Calculate how far the rank is between midRank and maxRank
		const ratio = (rank - midRank) / (maxRank - midRank);
		colorStop = {
		  r: midColor.r + ratio * (endColor.r - midColor.r),
		  g: midColor.g + ratio * (endColor.g - midColor.g),
		  b: midColor.b + ratio * (endColor.b - midColor.b),
		};
	  }

	  // Convert the RGB color stop to a hex color code
	  const hexColor = `#${Math.round(colorStop.r).toString(16).padStart(2, '0')}` +
					   `${Math.round(colorStop.g).toString(16).padStart(2, '0')}` +
					   `${Math.round(colorStop.b).toString(16).padStart(2, '0')}`;
	  return hexColor;
	}
	var lut = [];
	for (var i =1;i<=400;i++){
		lut.push(rankToColor(i,400));
	}
	
	var eventTypes = [
		"is watching",
		"I became a fan!",
		"invited \\d+ fans to this broadcast."
	];
	
	function matchesEventType(msg) {
		return eventTypes.some(eventType => {
			// Create a RegExp object from the string, treating it as a regular expression
			const pattern = new RegExp("^" + eventType + "$");
			return pattern.test(msg);
		});
	}

	function getSenderDetails(ele){
		var parent = ele.parentElement;
		while (parent && parent !== document.body && parent.id !== "root"){
			var headers = parent.querySelectorAll(".chat-sender-details");
			if (headers.length > 1){return null;}
			if (headers.length === 1){
				var headerBranch = headers[0];
				while (headerBranch.parentElement !== parent){headerBranch = headerBranch.parentElement;}
				// A header nested alongside another message belongs to that other
				// sender's group, not to this message's content wrapper.
				if (headerBranch.matches(".message") || headerBranch.querySelector(".message")){return null;}
				return headers[0];
			}
			parent = parent.parentElement;
		}
		return null;
	}

	function processMessage(ele){
		
		// console.log(ele);
		
		if (settings.customriversidestate){
			return; // manually disagbled
		}
		
		var senderDetails = getSenderDetails(ele);
		

		var chatimg = ""

		try {
			chatimg = senderDetails.querySelector(".chat-avatar img[src]").src;
		} catch(e){
		}
		
		var contentimg = "";
		
		var name = ""
		try {
			name = escapeHtml(senderDetails.querySelector('[data-automation-class="sender-name"]').textContent.trim());
		} catch(e){
		}
		
		var msg="";
		try {
			msg = getAllContentNodes(ele).trim();
		} catch(e){
		}
		

		if (!msg && !name){
			return;
		}
		
		var chatbadges = "";
		var nameColor = "";
		
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor
		data.chatmessage = msg;
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentimg;
		data.type = "riverside";
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// textonlymode capture contract: literal chatmessage string, no app-added markup; render as text, not HTML.
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("riverside");	return;	}
				if ("focusChat" == request){ 
					document.querySelector('textarea[placeholder]').focus();
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
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						var node = mutation.addedNodes[i];
						// Skip non-element nodes (like text nodes)
						if (!node.querySelectorAll || node.nodeType !== Node.ELEMENT_NODE) continue;
						
						// Check if the added node itself has the "message" class
						if (node.classList && node.classList.contains("message")) {
							node.skip = true; // Mark it to avoid re-processing
							processMessage(node);
						} else {
							// Look for a descendant node with the "message" class
							var messageNode = node.querySelector(".message");
							if (messageNode) {
								messageNode.skip = true; // Mark it to avoid re-processing
								processMessage(messageNode);
							}
						}
					}
				}
			});
		};

		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.querySelector('#root')){
				if (!document.querySelector('#root').marked){
					document.querySelector('#root').marked=true;

					console.log("CONNECTED chat detected");
					
					onElementInserted(document.querySelector('#root'));
				}
			};
		} catch(e){}
	},2000);

})();
