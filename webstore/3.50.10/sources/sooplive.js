(function () {
	 
	
	var isExtensionOn = true;
	function isSSAppContext() {
		return !!(
			window.ninjafy ||
			window.electronApi ||
			window.__ssapp ||
			typeof window.__SSAPP_TAB_ID__ !== "undefined"
		);
	}

	function normalizeSoopLiveUrl() {
		if (!isSSAppContext()) {
			return false;
		}

		try {
			var url = new URL(window.location.href);
			if (url.hostname === "www.sooplive.com" && url.pathname.indexOf("/chat/") === 0) {
				var username = url.pathname.replace(/^\/chat\/+/, "").split("/")[0];
				if (username) {
					window.location.replace("https://play.sooplive.com/" + username + "/");
					return true;
				}
			}

			if (url.hostname === "play.sooplive.com" && url.pathname.length > 1 && url.searchParams.get("vtype") !== "chat") {
				url.searchParams.set("vtype", "chat");
				window.location.replace(url.toString());
				return true;
			}
		} catch (e) {}

		return false;
	}

	if (normalizeSoopLiveUrl()) {
		return;
	}
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
		var resp = "";
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.nodeType===3){
				return escapeHtml(element.textContent) || "";
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
	
	
	function processMessage(ele){
		//console.log(ele);
		var chatimg = "";
		
		var nameColor = "";
		var name="";
		try {
			var nameEle = ele.querySelector(".channel-text");
			if (nameEle){
				name = nameEle.textContent.trim();
				name = escapeHtml(name);
				
				var style = getComputedStyle(nameEle);
				nameColor = style.color;
			} else {
				nameEle = ele.querySelector(".username [user_nick]");
				if (nameEle){
					name = nameEle.getAttribute("user_nick") || nameEle.textContent.trim();
					name = escapeHtml(name);
					var colorEle = ele.querySelector(".username .author[data-color]");
					if (colorEle && colorEle.dataset && colorEle.dataset.color){
						nameColor = "#" + colorEle.dataset.color;
					} else if (nameEle.dataset && nameEle.dataset.color){
						nameColor = "#" + nameEle.dataset.color;
					}
				}
			}
		} catch(e){
		//	console.warn(e);
		}
		
		
		var msg="";
		try {
			var msgEle = ele.querySelector("span[type^='body'][color='label/labelSecondary']");
			if (!msgEle){
				msgEle = ele.querySelector(".message-text");
			}
			msg = getAllContentNodes(msgEle);
		} catch(e){
		//	console.warn(e);
		}
		
		if (!name || !msg){
			return;
		}
		
		var data = {};
		data.chatname = name;
		data.nameColor = nameColor;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "sooplive";
		
	//	console.log(data);
		
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
				if ("getSource" == request){sendResponse("sooplive");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('[contenteditable="true"],textarea').focus();
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
	
	
	function onElementInserted(containerSelector) {
		var target = document.body;
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
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setTimeout(function(){
		onElementInserted(document.body);
	},3000);

})();
