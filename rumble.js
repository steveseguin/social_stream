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
	
	function processMessage(ele){
		
		var chatimg = "";
		if (ele.querySelector('img.chat-history--user-avatar[src]')){
			try {
				chatimg = ele.querySelector('img.chat-history--user-avatar[src]').src;
			} catch(e){
				chatimg = "";
			}
		}
		
		var name="";
		if (ele.querySelector('.chat-history--username')){
		  name = ele.querySelector('.chat-history--username').innerText;
		  if (name){
			name = name.trim();
			name = escapeHtml(name);
		  }
		} else if (ele.querySelector('.chat-history--rant-username')){
		  name = ele.querySelector('.chat-history--rant-username').innerText;
		  if (name){
			name = name.trim();
			name = escapeHtml(name);
		  }
		}
		
		var nameColor = ele.querySelector('.chat-history--username > a[style]').style.color || "";

		var msg = "";
		
		if (ele.querySelector('.chat-history--message')){
			if (settings.textonlymode){
				try {
					msg = escapeHtml(ele.querySelector('.chat-history--message').innerText);
				} catch(e){}
			} else {
				try {
					msg = ele.querySelector('.chat-history--message').innerHTML;
				} catch(e){}
			}
		} else if (ele.querySelector('.chat-history--rant-text')){
			if (settings.textonlymode){
				try {
					msg = escapeHtml(ele.querySelector('.chat-history--rant-text').innerText);
				} catch(e){}
			} else {
				try {
					msg = ele.querySelector('.chat-history--rant-text').innerHTML;
				} catch(e){}
			}
		}
		
		var dono = "";
		if (ele.querySelector('.chat-history--rant-price')){
			dono = escapeHtml(ele.querySelector('.chat-history--rant-price').innerText);
		}
		
		if (msg){
			msg = msg.trim();
		}
		
		var brandedImg = document.querySelector(".media-by-wrap .user-image");
		if (brandedImg){
			try {
				brandedImg = getComputedStyle(document.querySelector(".media-by-wrap .user-image")).backgroundImage
				brandedImg = "https://"+brandedImg.split("https://")[1];
				brandedImg = brandedImg.split('")')[0];
			} catch(e){
				console.error(e);
				brandedImg = "";
			}
		}

		var badges = [];
		ele.querySelectorAll(".chat-history--user-badge[src]").forEach(badge=>{
			badges.push(badge.src);
		});
		

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "rumble";
		
		if (brandedImg){
			data.sourceImg = brandedImg;
			toDataURL(data.sourceImg, function(dataUrl) {
				data.sourceImg = dataUrl;
				if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl) {
						data.chatimg = dataUrl;
						pushMessage(data);
					});
				} else {
					pushMessage(data);
				}
			});
		} else {
			if (data.chatimg){
				toDataURL(data.chatimg, function(dataUrl) {
					data.chatimg = dataUrl;
					pushMessage(data);
				});
			} else {
				pushMessage(data);
			}
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
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('#chat-message-text-input').focus();
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
						try {
							if (mutation.addedNodes[i].skip){return;}
							mutation.addedNodes[i].skip = true;
							if (mutation.addedNodes[i] && mutation.addedNodes[i].className && mutation.addedNodes[i].className.includes("chat-history--rant-sticky")){return;}
							processMessage(mutation.addedNodes[i]);
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
		if (document.querySelector('.chat--height')){
			if (!document.querySelector('.chat--height').marked){
				document.querySelector('.chat--height').marked=true;
				onElementInserted(document.querySelector('.chat--height'));
			}
		}
	},1000);

})();