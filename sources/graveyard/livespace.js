(function () {
	 
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
				resp += escapeHtml(node.textContent)+" ";
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
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	var channelName = "";
	
	function processMessage(ele){
		
		try {
			if (settings.customlivespacestate){
				channelName = document.querySelector(".main-content h3").childNodes[0].textContent;
			}
		} catch(e){
			channelName = window.location.href.split("/").pop();
		}
		
	
		if (channelName && settings.customlivespacestate){
		  //
		if (settings.customlivespaceaccount && settings.customlivespaceaccount.textsetting && (settings.customlivespaceaccount.textsetting.toLowerCase() !== channelName.toLowerCase())){
			return;
		} else if (!settings.customlivespaceaccount){
			return;
		}
		}


		var chatimg = ""

		try {
			chatimg = ele.querySelector(".chat-userIco img").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".chat-wrapper a strong").textContent.trim());
		} catch(e){
		}

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".chat-msg-body")).trim();
		} catch(e){
		}
		

		if (!msg || !name){
			return;
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
		data.textonly = settings.textonlymode || false;
		data.type = "livespace";
		
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
				
					try {
						if (settings.customlivespacestate){
							channelName = document.querySelector(".main-content h3").childNodes[0].textContent;
						}
					} catch(e){
						channelName = window.location.href.split("/").pop();
					}
		
					if (channelName && settings.customlivespacestate){
					  //
					if (settings.customlivespaceaccount && settings.customlivespaceaccount.textsetting && (settings.customlivespaceaccount.textsetting.toLowerCase() !== channelName.toLowerCase())){
						sendResponse(false);
						return;
					} else if (!settings.customlivespaceaccount){
						sendResponse(false);
						return;
					}
				  }
				
					document.querySelector('#type-a-message').focus();
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

							if (mutation.addedNodes[i].nodeName == "LI"){
								processMessage(mutation.addedNodes[i]); 
							} else if (mutation.addedNodes[i].nodeName == "UL"){
								processMessage(mutation.addedNodes[i]); 
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
			channelName = document.querySelector(".main-content h3").childNodes[0].textContent;
		} catch(e){
			channelName = window.location.href.split("/").pop();
		}
		
		try {
			document.querySelectorAll('#messages').forEach(container=>{ // more than one #message .. tsk ;)
				if (!container.marked){
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){

						container.querySelectorAll("li").forEach(ele=>{
							ele.skip=true;
							//processMessage(ele);
						});
						onElementInserted(container);

					},1000);
				}
			});
		} catch(e){}
	},2000);

})();