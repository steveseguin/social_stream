(function () {
	
	
	var isExtensionOn = true;
window.addEventListener('unhandledrejection', (event) => {
	  console.error('Unhandled promise rejection:', event.reason);
	});
	 
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
		
		var chatimg = "";
		try{
		   chatimg = ele.querySelector("img[src^='https://gcdn.favorited.app/profile-images']").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = ele.querySelector("main>button>div>p.font-bold").textContent.trim();
			name = escapeHtml(name);
		} catch(e){
		}
		
		var chatbadges = [];
		try {
			ele.querySelectorAll("[data-sentry-component='UserInlineWithBadges'] svg, [data-sentry-component='UserInlineWithBadges'] img, img[src*='/badges/']").forEach(badge => {
				if (badge.srcset) {
					let bb = badge.srcset.split("https://").pop();
					if (bb) {
						bb = "https://" + bb.split(" ")[0];
						if (!chatbadges.includes(bb)) {
							chatbadges.push(bb);
						}
					}
				} else if (badge && badge.nodeName == "IMG"){
					var tmp = {};
					tmp.src = badge.src+"";
					tmp.type = "img";
					chatbadges.push(tmp);
				} else if (badge && badge.nodeName.toLowerCase() == "svg"){
					var tmp = {};
					tmp.html = badge.outerHTML;
					tmp.type = "svg";
					chatbadges.push(tmp);
				}
			});
		} catch (e) {}
		
		var msg="";
		try {
			msg = getAllContentNodes(ele.children[ele.children.length-1]);
		} catch(e){
		}
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "favorited";
		
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
				if ("getSource" == request){sendResponse("favorited");	return;	}
				if ("focusChat" == request){ 
					document.querySelector('input[placeholder]').focus();
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
							if (mutation.addedNodes[i].dataset.sentryComponent){
								setTimeout(function(ele){
									processMessage(ele);
								},400,mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].classList.contains("w-full")){
								setTimeout(function(ele){
									processMessage(ele);
								},400,mutation.addedNodes[i]);
							}
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

	setInterval(function(){
		try {
			if (!document.querySelector('body').marked){
				document.querySelector('body').marked=true;
				console.log("CONNECTED chat detected");
				setTimeout(function(){
					document.querySelectorAll('main.w-full, [data-sentry-component="ChatMessageUser"]').forEach(ele=>{
						ele.skip=true;
					});
					onElementInserted(document.querySelector('body'));
				},1000);
			}
		} catch(e){}
	},2000);

})();