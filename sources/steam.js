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
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			return await fetch(URL);
		}
	}
	
	var cachedUserProfiles = {};
	async function getAvatarImage(miniprofile){
		
		if (miniprofile in cachedUserProfiles){
			return cachedUserProfiles[miniprofile];
		} 
		cachedUserProfiles[miniprofile] = "";
		
		return await fetchWithTimeout("https://steamcommunity.com/miniprofile/"+miniprofile+"?origin=https%3A%2F%2Fsteamcommunity.com").then(async response => {
			return await response.text().then(function (data) {
				if (data){
					try {
						var avatar = data.split("https://avatars.akamai.steamstatic.com/")[1].split('.jpg')[0];
						avatar = "https://avatars.akamai.steamstatic.com/"+avatar+".jpg";
						cachedUserProfiles[miniprofile] = avatar;
						return avatar;
					} catch(e){
						return "";
					}
				}
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
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
	
	
	async function processMessage(ele){
		
		//console.log(ele);

		var chatimg = ""

		try {
			var miniprofile = ele.querySelector("[data-miniprofile]").dataset.miniprofile;
			chatimg = await getAvatarImage(miniprofile) || "";
		} catch(e){
			//console.error(e);
		}
		
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".ChatName").textContent.trim());
		} catch(e){
			//console.error(e);
		}

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".tmplChatMessage")).trim();
		} catch(e){
			//console.error(e);
		}
		

		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.type = "steam";
		
		
		if (!msg || !name){
			return;
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
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("steam");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.getElementById("ChatOnly").contentWindow.document.querySelector('textarea').focus();
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
						try {
							if (mutation.addedNodes[i].skip){continue;}

							mutation.addedNodes[i].skip = true;

							processMessage(mutation.addedNodes[i]); 
							
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.getElementById("ChatOnly").contentWindow.document.body.querySelector('#ChatMessages')){
				if (!document.getElementById("ChatOnly").contentWindow.document.body.querySelector('#ChatMessages').marked){
					document.getElementById("ChatOnly").contentWindow.document.body.querySelector('#ChatMessages').marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){

						[...document.getElementById("ChatOnly").contentWindow.document.body.querySelector('#ChatMessages').childNodes].forEach(ele=>{
							ele.skip=true;
						//	processMessage(ele);
						});
						onElementInserted(document.getElementById("ChatOnly").contentWindow.document.body.querySelector('#ChatMessages'));

					},1000);
				}
			};
		} catch(e){}
	},2000);

})();