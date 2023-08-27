(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
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
	
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}


	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
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

	async function processMessage(ele){
		try {
		  var chatdonation = false;
		  var chatmembership = false;
		  var chatsticker = false;
		  
		  var chatname = escapeHtml(ele.querySelector(".username").innerText);
		  
		  var chatmessage = escapeHtml(ele.querySelector(".message-content").innerText);
		  
		  if (!chatmessage){
			   return;
		  }
		  var chatimg = ele.parentNode.querySelector(".profile-logo > img").src;
		  var chatbadges = "";
		  var hasDonation = '';
		  var hasMembership = '';
		  var backgroundColor = "";
		  var textColor = "";

		  var data = {};
		  data.chatname = chatname;
		  data.chatbadges = chatbadges;
		  data.backgroundColor = backgroundColor;
		  data.textColor = textColor;
		  data.chatmessage = chatmessage;
		  data.chatimg = chatimg;
		  data.hasDonation = hasDonation;
		  data.hasMembership = hasMembership;
		  data.textonly = settings.textonlymode || false;
		  data.type = "mobcrush";
		  
		  pushMessage(data);
		} catch(e){
		}
	}
	
	
	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (!mutation.addedNodes[i].children || !mutation.addedNodes[i].children.length){continue;}
						
						var ttt = mutation.addedNodes[i].querySelector(".trovo");
						if (!ttt){
							ttt = mutation.addedNodes[i];
						}
						try {
							if (!ttt.children || !ttt.children.length){continue;}
							if (ttt.dataset.set123){continue;}
							ttt.dataset.set123 = "true";
							callback(ttt);
							
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	if (window.location === window.parent.location ) {
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("focusChat" == request){
						if (!document.querySelector("textarea[placeholder]")){
							sendResponse(false);
							return;
						}
						document.querySelector("textarea[placeholder]").focus();
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
				} catch(e){	}
				
				sendResponse(false);
			}
		);
		
		setTimeout(function(){
			chrome.runtime.sendMessage(chrome.runtime.id, { "inject": "mobcrush" });
		},4000);
		
		return;
	} else if (document.body.id !== "app"){
		return;
	}

	console.log("social stream injected");
	
	try {
		onElementInserted(document.body, function(element){
			processMessage(element);
		});
	} catch(e){}
	

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	
})();