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

	function escapeHtml(unsafe){ // success is when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}
	function getAllContentNodes(element) {
		var resp = " ";
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.nodeType===3){
				return escapeHtml(element.textContent) || " ";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				if (!node.classList.contains("comment-see-more")){
					resp += getAllContentNodes(node)
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent+ " ");
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML+" ";
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele, event=false){
		
		console.log(ele);
		
		var chatimg = "";
		try {
			chatimg = ele.querySelector(".info-chat-comment-item-avatar>img[src]").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".info-chat-comment-item-user-box-name, .info-feed-list-item-name")?.textContent.trim());
		} catch(e){
		}
		
		
		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".info-chat-comment-item-comment, .info-feed-list-item-content")).trim();
		} catch(e){
		}
		
		var hasDonation = "";
		
		var eventType = "";
		
		
		if (event && msg){
			if (msg.includes("just joined")){
				eventType = "joined";
				if (!settings.captureevents){
					return;
				}
			} else if (ele.querySelector(".gift-img")){
				hasDonation = msg.split("x");
				hasDonation = hasDonation[hasDonation.length-1];
				hasDonation = parseInt(hasDonation);
				if (hasDonation===1){
					hasDonation = hasDonation+" gift";
				} else if (hasDonation>1){
					hasDonation = hasDonation +" gifts";
				} else {
					hasDonation = false;
				}
			} else {
				if (!settings.captureevents){
					return;
				}
			}
		}
		
		var contentimg = "";
		
		
		if (!msg){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "kwai";
		
		if (eventType){
			data.event = eventType;
		}
		
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
		// Service worker can be cold; guard undefined/lastError so we don't crash before injecting.
		if (chrome.runtime && chrome.runtime.lastError) {
			return;
		}
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
	});
	
	var isExtensionOn = true;
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if (!isExtensionOn){
					sendResponse(false);
					return;
				}
				if ("getSource" == request){
					sendResponse("kwai");
					return;
				}
				if ("focusChat" == request){ 
					sendResponse(false);
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
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL = window.location.href;
	var chatObserver = null;
	var feedObserver = null;

	function onElementInserted(target, events=false) {
		if (!target) {
			return;
		}

		// Determine which observer to use based on events flag
		var existingObserver = events ? feedObserver : chatObserver;

		// If already observing this target, skip
		if (existingObserver) {
			return;
		}

		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){continue;}
							mutation.addedNodes[i].skip = true;
							processMessage(mutation.addedNodes[i], events);
						} catch(e){}
					}
				}
			});
		};

		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

		var newObserver = new MutationObserver(onMutationsObserved);
		try {
			newObserver.observe(target, config);
			if (events) {
				feedObserver = newObserver;
			} else {
				chatObserver = newObserver;
			}
		} catch (e) {
		}
	}
	
	console.log("social stream injected");
	

	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				let viewerSpan = document.querySelectorAll("[class*='viewerCountContainer'] button")[1];
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
									type: 'kwai',
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

	setInterval(function(){
		try {
			// Set up chat observer if not already watching
			if (!chatObserver){
				var chatContainer = document.querySelector("[class='info-chat-comment']");
				if (chatContainer){
					onElementInserted(chatContainer, false);
				}
			}
			// Set up feed/events observer if not already watching
			if (!feedObserver){
				var feedContainer = document.querySelector("[class='info-feed-list']");
				if (feedContainer){
					onElementInserted(feedContainer, true);
				}
			}

			if (chatObserver || feedObserver){
				checkViewers();
			}
		} catch(e){}
	},2000);

})();
