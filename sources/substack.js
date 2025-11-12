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
	
	function processMessage(ele){
		
		console.log(ele);
		
		let eventType = "";
		if (ele.querySelector("[class*='joinedText']")){
			eventType = "joined";
		}
		
		var chatimg = "";
		try{
		   chatimg = ele.querySelector(".pc-borderRadius-full source")?.srcset.split(" ")[0].replace("w_24,h_24","w_144,h_144") || "";
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector("div > span a[href^='https://substack.com/@']")?.textContent.trim());
		} catch(e){
		}
		
		
		var msg="";
		try {
			if (eventType){
				msg = getAllContentNodes(ele.querySelector(".pencraft.pc-opacity-90")).trim();
				if (msg!="joined"){
					msg = getAllContentNodes(ele).trim();
				}
			} else {
				msg = getAllContentNodes(ele.querySelector(".pencraft.pc-opacity-90")).trim();
			}
		} catch(e){
		}
		
		var contentimg = "";
		
		
		if (!msg && !contentimg){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "substack";
		
		if(eventType){
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
					sendResponse("substack");
					return;
				}
				if (!isLiveStreamPage(window.location.href)){
					sendResponse(false);
					return;
				}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('input[class^="input-"], textarea, input[type="text"]').focus();
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
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL = window.location.href;
	var observer = null;
	var isWatching = false;
	
	function isLiveStreamPage(url) {
		if (!url) {
			return false;
		}
		try {
			return /(?:liveStream=|\/live-stream\/)/i.test(url);
		} catch (e) {
			return false;
		}
	}
	
	function resetObserver() {
		if (observer) {
			try {
				observer.disconnect();
			} catch (e) {}
			observer = null;
		}
		isWatching = false;
	}
	
	
	function onElementInserted(target) {
		if (!target) {
			return;
		}
		
		resetObserver();
		
		console.log(target);
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){continue;}
							mutation.addedNodes[i].skip = true;
							processMessage(mutation.addedNodes[i]);
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		try {
			observer.observe(target, config);
			console.log("OBSERVING");
			isWatching = true;
		} catch (e) {
			observer = null;
			isWatching = false;
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
									type: 'substack',
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
		if (lastURL !== window.location.href){
			lastURL = window.location.href;
			resetObserver();
		}
		if (!isLiveStreamPage(window.location.href)){
			return;
		}
		if (!isWatching){
			console.log("searching");
			var header = document.querySelector("[class*='overflow-auto']");
			if (header){
				console.log("loading?");
				onElementInserted(header);
			}
		}
		
		if (isWatching){
			checkViewers();
		}} catch(e){}
		
		
	},2000);

})();
