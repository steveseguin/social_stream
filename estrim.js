(function () {
	 
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

	var lastMessage = {};
	
	function processMessage(ele){
		
		if (!ele || !ele.querySelector){return;}
		// console.log(ele);
		var chatimg = "";
		var msg = "";
		var name =  "";
		
		try{
			if (ele.querySelector("span.username")){
			  name = ele.querySelector("span.username").innerText;
			  name = name.split(":")[0];
			  name = escapeHtml(name);
			  if (name){
				name = name.trim();
			  }
			  
			} 
		} catch(e){}
		
		if (!name){
			// console.log("NO NAM<E");
			return; // this might be a duplicate. 
		}
		
		try{
		   chatimg = ele.querySelector("img[thumbnail][src]").src;
		} catch(e){}
		
		try{
			if (ele.querySelector("span.msg")){
			  msg = getAllContentNodes(ele.querySelector("span.msg"));
			  if (msg){
					msg = msg.trim();
			  }
			  
			} 
		} catch(e){
		}
		
		
		var chatbadges = [];
		try {
		  ele.querySelectorAll("img.badge[src]").forEach(badge=>{
			 if (!chatbadges.includes(badge.src)){
				chatbadges.push(badge.src);
			 }
		  });
		} catch(e){} 
		
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "estrim";
		
		// console.log(data);
	
		pushMessage(data);
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
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
				if ("focusChat" == request){
					document.querySelector('textarea.native-textarea').focus();
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

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try{
							if (!mutation.addedNodes[i].skip){
								mutation.addedNodes[i].skip = true;
								setTimeout(function(ee){
									processMessage(ee);
								},200, mutation.addedNodes[i]);
							}
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		
	}
	console.log("social stream injected");

	setInterval(function(){
		if (document.querySelector(".chat-container > .messages")){
			if (!document.querySelector(".chat-container > .messages").marked){
				// console.log(document.querySelector(".chat-container > .messages"));
				document.querySelector(".chat-container > .messages").marked=true;
				document.querySelector(".chat-container > .messages").childNodes.forEach(ele =>{
					ele.skip = true;
					processMessage(ele);
				});
				// console.log("INIT");
				onElementInserted(document.querySelector(".chat-container > .messages"));
			}
		}
	},1000);

})();