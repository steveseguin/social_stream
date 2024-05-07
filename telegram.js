(function () {
	function pushMessage(data){
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}

	function toDataURL2(blobUrl, callback=false) {
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
		   var recoveredBlob = xhr.response;

		   var reader = new FileReader;

		   reader.onload = function() {
			   if (callback){
				callback(reader.result);
			   }
		   };

		   reader.readAsDataURL(recoveredBlob);
		};

		xhr.open('GET', blobUrl);
		xhr.send();
	};

	function errorlog(e){
		//console.error(e);
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

	function processMessage(ele, chatimg, chatname){
		
		
		var chatmessage = "";
		var contentimg = "";
		
		try{
			ele.querySelector(".text-content").childNodes.forEach(ce=>{
				if (ce.className && ce.className.includes("Reactions")){
					return
				} else if (ce.nodeName == "IMG"){
					chatmessage+= "<img src='"+ce.src+"'/>";
				} else if (ce.className && ce.className.includes("MessageMeta")){
					// skip; this is date and stuff.
				} else {
					chatmessage += escapeHtml(ce.textContent);
				}
			});
		} catch(e){errorlog(e);}
		
		
		if (ele.querySelector(".avatar-media[src]")){
			chatimg = ele.querySelector(".avatar-media[src]").src;
		}
		if (ele.querySelector(".message-title-name") && ele.querySelector(".message-title-name").textContent){
			chatname = escapeHtml(ele.querySelector(".message-title-name").textContent);
		}
		
		try{
			contentimg = ele.querySelector(".media-inner").querySelector("img").src;
			if (!contentimg){
				contentimg = ele.querySelector(".content-inner").querySelector("img").src;
			}
		} catch(e){errorlog(e);}
	  
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "telegram";
		
		if (!chatmessage && !contentimg){return;}
		
		try {
			if (data.contentimg && !data.contentimg.startsWith("https://")){ // data.contentimg
				toDataURL2(data.contentimg, function(dataUrl) {
					data.contentimg = dataUrl;
					if (data.chatimg && !data.chatimg.startsWith("https://")){
						toDataURL2(data.chatimg, function(dataUrl) {
							data.chatimg = dataUrl;
							pushMessage(data);
							return;
						});
						return;
					}
					pushMessage(data);
					return;
				});
				return;
			} else if (data.chatimg && !data.chatimg.startsWith("https://")){
				toDataURL2(data.chatimg, function(dataUrl) {
					data.chatimg = dataUrl;
					pushMessage(data);
					return;
				});
				return;
			}
			pushMessage(data);
		} catch(e){
		}
	}
	
	var lastMessageID = 0;
	var lastURL =  "";
	
	setInterval(async function(){
		var highestMessage = 0;
		var newChannel = false;
		if (lastURL !== window.location.href){
			lastURL = window.location.href;
			lastMessageID = 0;
			newChannel = true;
		} 
		
		var chatimg="";
		try{
			chatimg = document.querySelector(".ChatInfo>.Avatar>img.avatar-media").src;
			if (!chatimg){
				chatimg = "";
			} 
		} catch(e){errorlog(e);}
		
		try{
			if (!chatimg){
				chatimg = document.querySelector("#MiddleColumn").querySelector("div.Avatar>img");
			}
			if (!chatimg){
				chatimg = "";
			} 
		} catch(e){errorlog(e);}
		
		
		var chatname = "";
		try{
			chatname = escapeHtml(document.querySelector(".ChatInfo>.info>.title").innerText);
			if (chatname==="Replies"){
				chatname = "";
			}
		} catch(e){errorlog(e);}
		
		
		try {
			var xxx = document.querySelectorAll('div.message-list-item'); // messages-container
			for (var j = 0; j< xxx.length; j++){
				if (parseInt(xxx[j].dataset.messageId) && (parseInt(xxx[j].dataset.messageId)>=1) && (parseInt(xxx[j].dataset.messageId)< 1658053682710)){
					if (lastMessageID<parseInt(xxx[j].dataset.messageId)){
						highestMessage = parseInt(xxx[j].dataset.messageId);
					} else {
						continue;
					}
				}
				if (xxx[j].marked){
					continue;
				}
				xxx[j].marked = true;
				if (!newChannel){
					var posibleName = chatname;
					if (settings.myname && settings.myname.textparam1){
						posibleName = settings.myname.textparam1.split(",")[0];
					}
					processMessage(xxx[j],chatimg, posibleName);
					await sleep(10);
				} 
			}
			if (highestMessage>lastMessageID){
				lastMessageID = highestMessage;
			}
		} catch(e){
			 errorlog(e)
		}
	},1000);

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
					if (!document.querySelector('.public-DraftEditorPlaceholder-inner')){
						sendResponse(false);
						return;
					}
					document.querySelector(".public-DraftEditorPlaceholder-inner").focus();
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

	
})();