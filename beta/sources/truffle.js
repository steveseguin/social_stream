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
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			console.log(e);
			return await fetch(URL);
		}
	}
	
	var cachedUserProfiles = {};


	function getTwitchAvatarImage(username) {
		fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(username)).then(response => {
			response.text().then(function(text) {
				if (text.startsWith("https://")) {
					brandedImageURL = text;
				}
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
	async function processMessage(ele){
	
		var namecolor = "";
		var namett="";
		
		try {
			var namett = escapeHtml(ele.querySelector(".name").innerText.trim());
			try {
				namecolor = ele.querySelector(".name").style.color;
			} catch(e){
			}
		} catch(e){
			return;
		}

		
		var contentImg = "";
		
		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".c-chat-message-body")).trim();
		} catch(e){
			return;
		}
		
		var chatbadges = [];
		
		try {
			ele.querySelectorAll(".badges > *").forEach(badge => {
				try {
					var computed = getComputedStyle(badge);
					if (computed.backgroundImage) {
						computed = computed.backgroundImage.split('"')[1].split('"')[0];
						if (computed) {
							chatbadges.push(computed);
						}
					}
				} catch (e) {}
			});

		} catch (e) {}

		if (!namett || (!contentImg && !msg)){
			return;
		}
		
		var platform = "truffle";
		if (ele.querySelector(".platform[src]")){
			if (ele.querySelector(".platform[src]").src.endsWith("twitch.svg")){
				platform = "twitch";
			} else if (ele.querySelector(".platform[src]").src.includes("youtube.svg")){
				platform = "youtube";
			} else if (ele.querySelector(".platform[src]").src.includes("twitch")){
				platform = "twitch";
			} else if (ele.querySelector(".platform[src]").src.includes("youtube")){
				platform = "youtube";
			}
		}
		
		var chatimg = "";
		
		if (platform=="twitch"){
			try {
				chatimg = getTwitchAvatarImage(namett);
			} catch(e){
				errorlog(e);
			}
		}
		
		var data = {};
		data.chatname = namett;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentImg;
		data.textonly = settings.textonlymode || false;
		data.type = platform;
		
		if (lastMessages[namett] && (lastMessages[namett] == msg)){
			return;
		}
		
		lastMessages[namett] = msg;
		
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
				if ("getSource" == request){sendResponse("truffle");	return;	}
				if ("focusChat" == request){
					document.querySelector('.input[contenteditable="true"]').focus();
					
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

	var observer = null;
	
	var lastMessages = {};
	
	
	
	function onElementInserted(target) {
		if (!target){return;}
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try{
							processMessage(mutation.addedNodes[i]);
						} catch(e){}
					}
				}
			});
		};
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected - truffle powered");

	setInterval(function(){
		try {
		if (document.querySelector(".c-chat_c-chat-messages-batch")){
			if (!document.querySelector(".c-chat_c-chat-messages-batch").marked){
				document.querySelector(".c-chat_c-chat-messages-batch").marked=true;
				document.querySelectorAll(".c-chat-message").forEach(ele=>{
					processMessage(ele);
				});

				console.log("CONNECTED chat detected");

				setTimeout(function(){
					
					onElementInserted(document.querySelector(".c-chat_c-chat-messages-batch"));

				},1000);


			}
		}} catch(e){
			console.error(e);
		}
	},2000);

})();