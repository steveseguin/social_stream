(function () {
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  
	  xhr.open('GET', url, false);
	  xhr.send(null);
	  var data = stringToArrayBuffer(xhr.response);
	  
	  var reader = new FileReader();
	  reader.onloadend = function() {
		  callback(reader.result);
	  }
	  reader.readAsDataURL(new Blob([data])); // Failed to execute 'readAsDataURL' on 'FileReader': parameter 1 is not of type 'Blob'.
	  
	}
	function stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length);
		var bufView = new Uint8Array(buf);

		for (var i=0, strLen=str.length; i<strLen; i++) {
			bufView[i] = str.charCodeAt(i);
		}

		return buf;
	}
	
	function processMessage(ele){
	  
		//console.log(ele);
		
		var chatmessage = "";
		var chatname = "";
		var chatimg = "";

		try{
			chatname = ele.children[1].children[1].children[1].children[0].dataset.prePlainText
			if (chatname.split("] ").length>1){
				chatname = chatname.split("] ")[1];
			}
			chatname = chatname.split(":")[0];
			chatname = chatname.trim();
		} catch(e){
			chatname = "";
		}
		
		if (!chatname){
			try{
				
				chatname = ele.children[1].children[1].children[0].children[1].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			try{
				chatname = ele.children[1].children[0].children[1].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			} catch(e){
				chatname = "";
			}
		}
		if (!chatname){
			try{
				chatname = ele.children[1].children[0].children[0].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			if (ele.querySelector('[aria-label]')){
				chatname = ele.querySelector('[aria-label]').ariaLabel;
				chatname = chatname.split(":")[0];
			} else {
				return;
			}
		}

		if (!textOnlyMode){
			try {
				chatmessage = ele.querySelector(".selectable-text.copyable-text");
				if (chatmessage && chatmessage.tagName && (chatmessage.tagName == "IMG")){
					if (chatmessage.alt){
						chatmessage = chatmessage.alt;
					}
				} else if (chatmessage && chatmessage.querySelector("img")){
					chatmessage.querySelectorAll("img[alt]").forEach(ele=>{
						ele.outerHTML = ele.alt;
					});
				} 
				chatmessage = chatmessage.innerHTML;
			} catch(e){
				chatmessage = "";
			}
			
			if (!chatmessage){
				
				//	console.error(e);
					return;
				
			}
		} else {
			try {
				chatmessage = ele.querySelector(".selectable-text.copyable-text").innerText;
				//console.log(chatmessage);
			} catch(e){
			//	console.error(e);
				return;
			}
		}
		
		if (!chatmessage){return;}

		
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";
		data.type = "whatsapp";
		
		//console.log(data);
	  
		if (data.chatimg && avatars){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				try {
					chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
				} catch(e){}
			});
		} else {
			data.chatimg = "";
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
			} catch(e){}
		}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					try{
						document.querySelector("footer").querySelector("div[contenteditable='true'][role='textbox']").focus();
					} catch(e){
						sendResponse(false);
						return
					}
					sendResponse(true);
					return;
				} 
				if ("textOnlyMode" == request){
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request){
					textOnlyMode = false;
					sendResponse(true);
					return;
				}
				
				if ("noAvatars" == request){
					avatars = false;
					sendResponse(true);
					return;
				} else if ("sendAvatars" == request){
					avatars = true;
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);
	var avatars = true;
	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
		if ("settings" in response){
			if ("noavatars" in response.settings){
				avatars = !response.settings.noavatars;
			}
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].dataset.id) {
								//console.log(mutation.addedNodes[i]);
								if (mutation.addedNodes[i].set123){continue;}
								mutation.addedNodes[i].set123 = true;
								//console.log(mutation.addedNodes[i]);
								setTimeout(function(ele){
									callback(ele);
								}, 300, mutation.addedNodes[i]);
							} else{
								//console.warn(mutation.addedNodes[i]);
							}
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

    console.log("Social stream inserted");
	
	
	setInterval(function(){
		var ele = document.querySelector("#main");
		if (ele && !ele.started){
			ele.started = true;
			
			ele.querySelectorAll("[data-id]").forEach(ele=>{
				ele.set123 = true;
			});
			
			onElementInserted(ele, function(element){
				processMessage(element);
			});
		}
		
	},1000);

	
})();