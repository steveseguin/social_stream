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
						node.src.startsWith('http') || (node.src = node.src + "");
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
	
	async function getAvatarImage(username){
		
		if (username in cachedUserProfiles){
			return cachedUserProfiles[username];
		} 
		cachedUserProfiles[username] = "";
		
		return await fetchWithTimeout("https://vstream.com/c/@"+encodeURIComponent(username)+"?tab=about").then(async response => {
			return await response.text().then(function (data) {
				try {
					var strip = data.split("https://user-images.vstream-cdn.com")[1].split('"')[0];
					strip = "https://user-images.vstream-cdn.com" + strip;
					cachedUserProfiles[username] = strip;
					return strip;
				} catch(e){console.error(e);}
			});
		}).catch(error => {
			console.error(error);
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
	async function processMessage(ele, skip=false){
		
		
		try {
			ele = ele.childNodes[0];
		} catch(e){
			return;
		}

		var namecolor = "";
		
		var namett="";
		try {
			var namett = ele.childNodes[0].childNodes[0].querySelectorAll("button");
			namett = namett[namett.length-1];
			namett = escapeHtml(namett.textContent.trim());
			try {
				namecolor = ele.childNodes[0].childNodes[0].querySelector("button").parentNode.style.color;
			} catch(e){
			}
		} catch(e){
			return;
		}

		var chatimg = "";
		chatimg = await getAvatarImage(namett);
		
		if (skip){return;}

		var msg="";
		try {
			msg = ele.querySelectorAll("[class*='text-body']");
			msg = getAllContentNodes(msg[1]);
		} catch(e){
			return;
		}
		
		var chatbadges = [];
		ele.childNodes[0].childNodes[0].querySelectorAll("img[src]").forEach(img=>{
			img.src.startsWith('http') || (img.src = img.src + "");
			chatbadges.push(img.src);
		});
		

		if (!msg || !namett){
			return;
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
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "vstream";
		
		//console.log(data);
		
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
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("vstream");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('form div[contenteditable="true"] > p').focus();
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
	
	
	function onElementInserted(containerSelector) {
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					
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
		
		var config = { childList: true, subtree: false }; // sub tree turned off; only children, no grand children
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
		if (document.querySelector('#root')){
			if (!document.querySelector('#root').marked){
				document.querySelector('#root').marked=true;

				console.log("CONNECTED chat detected");

				setTimeout(function(){

					document.querySelectorAll(".w-full > .max-h-full > div").forEach(ele=>{
						ele.skip=true;
						processMessage(ele, true);
					});

					onElementInserted('.w-full > .max-h-full');

				},1000);


			}
		}} catch(e){}
	},2000);

})();