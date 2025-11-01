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

	function processMessage(ele){
		
		// console.log(ele);
		
		if (settings.customriversidestate){
			return; // manually disagbled
		}
		
		var senderDetails = ele.parentNode;
		
		for (var i=0;i<6;i++){
			if (senderDetails.parentNode.querySelector(".chat-sender-details")){
				senderDetails = senderDetails.parentNode.querySelector(".chat-sender-details")
				break;
			} else {
				senderDetails = senderDetails.parentNode;
			}
		}
		

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
		
		if (!name){
			name = escapeHtml(document.title.split("|")[1].split("'")[0].trim());
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