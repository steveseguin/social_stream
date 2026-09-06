(function () {
	 
	
	var isExtensionOn = true;
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
				if (!node.classList.contains("comment-see-more")){
					resp += getAllContentNodes(node)
				}
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
	
	
	
	function getMainDomain(url) {
	  const knownTlds = ['co.uk', 'com.au', 'co.jp'];
	  const parts = url.split('.');
	  
	  for (const tld of knownTlds) {
		if (url.endsWith(tld)) {
		  return parts[parts.length - 3];
		}
	  }
	  
	  return parts[parts.length - 2];
	}
	
	var mainDomain = getMainDomain(window.location.href) || "uscreen";
	
	
	function processMessage(ele){
		
		if (!ele.dataset.lcMessage){return;}
		
		try {
			var chatimg = "";
			try{
			   chatimg =  ele.querySelector("img.rounded-full[src]").src;
			} catch(e){
				//console.log(e);
			}
			
			var name="";
			try {
				name = escapeHtml(ele.querySelector("div > div.font-bold>span").textContent.trim());
			} catch(e){
				//console.log(e);
				return;
			}
			
			var msg="";
			try {
				msg = getAllContentNodes(ele.querySelector(".break-words")).trim();
			} catch(e){
				//onsole.log(e);
				return;
			}
			
			
			if (!msg && !name){return;}
			
			var data = {};
			data.chatname = name;
			data.chatbadges = "";
			data.backgroundColor = "";
			data.textColor = "";
			
			data.chatmessage = msg;
			data.chatimg = chatimg;
			data.hasDonation = "";
			data.membership = "";;
			data.textonly = settings.textonlymode || false;
			data.type = mainDomain || "uscreen";
			
			pushMessage(data);
		} catch(e){
			//console.log(e);
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
				if ("getSource" == request){sendResponse("uscreen");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector("ds-text-editor").shadowRoot.querySelector('div[contenteditable="true"],p[data-placeholder]>p, p[data-placeholder],').focus();
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
	
	console.log("social stream injected: "+mainDomain);

	setInterval(function(){
		try {
		if (document.querySelector('[data-program-target="sidebar"] .scroll-container .w-full.lc-scroll').children.length){
			if (!document.querySelector('[data-program-target="sidebar"] .scroll-container .w-full.lc-scroll').marked){
				document.querySelector('[data-program-target="sidebar"] .scroll-container .w-full.lc-scroll').marked=true;
				onElementInserted(document.querySelector('[data-program-target="sidebar"] .scroll-container .w-full.lc-scroll'));
			}
		}} catch(e){}
	},2000);

})();