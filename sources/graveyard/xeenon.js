(function () {
	function toDataURL(blobUrl, callback) {
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
		   var recoveredBlob = xhr.response;

		   var reader = new FileReader;

		   reader.onload = function() {
			 callback(reader.result);
		   };

		   reader.readAsDataURL(recoveredBlob);
		};
		
		xhr.onerror = function() {callback(blobUrl);}

		xhr.open('GET', blobUrl);
		xhr.send();
	};

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
						node.src.startsWith('http') || (node.src = node.src + "");
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele){
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);

		var nameColor = "";
        var name = "";
		var chatimg = "";
		
		try {
			name = ele.querySelector("[class^='chat-message_profileName']").innerText;
			name = name.split(":")[0];
			name = name.trim();
			name = escapeHtml(name);
			
			//nameColor = ele.querySelector(".chat__message__username").style.color;
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			return;
		}
		
		try {
			chatimg = ele.querySelector("img[class^='profile-image_profile__']").src;
		} catch(e){
			//console.log(e);
		}
		

		var msg = "";
		try {
			var content = ele.querySelectorAll("[class^='chat-message_message'] div")[1];
			msg = getAllContentNodes(content);
			msg = msg.trim();
			
		} catch(e){
			//console.log(e);
			return;
		}
		var hasDono = "";
		
		if (msg){
			try {
				if (content.querySelector("[class^='chat-message_highlight__']")){
					var dono = msg.split("Credits")[0];
					dono = dono.split("Sent")[1];
					dono = parseFloat(dono);
					if (dono){
						hasDono = dono+" credits";
					}
				}
			} catch(e){
				//console.log(e);
			}
		} else {
			try {
				msg = ele.querySelector("[class^='chat-message_attachment__']>img").outerHTML;
			} catch(e){
				
			}
		}
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDono;
		data.hasMembership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "xeenon";
		data.sourceImg = "";
		
		console.log(data);
		
		pushMessage(data);
		
	}
	
	
	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){
			//console.log(e);
		}
	}
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // doesn't support/have chat
					sendResponse(false);
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
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].className.startsWith("chat-message_container__")){
								processMessage(mutation.addedNodes[i]);
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
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.querySelector('[class^="messages_messages__"]')){
				if (!document.querySelector('[class^="messages_messages__"]').marked){
					document.querySelector('[class^="messages_messages__"]').marked=true;
					
					document.querySelectorAll("[class^='chat-message_container__']").forEach(ele =>{
						processMessage(ele);
					});
					onElementInserted(document.querySelector('[class^="messages_messages__"]'));
				}
			}
		} catch(e){}
	},2000);

})();
