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
		
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);
		
		if (document.querySelector("chat-message__container")){
			if (document.querySelector("chat-message__container").marked){
				return;
			} else {
				document.querySelector("chat-message__container").marked = true;
			}
		}
		

		var chatimg = "";
		var msg = "";
		var name = "";
		var dono = "";
		var username= "";
		try{
		   chatimg = ele.querySelector("img").src;
		   if (chatimg){
			chatimg = chatimg.replace("26x26", "150x150");
			chatimg = chatimg.replace("24x24", "150x150");
		   }
		  // name = ele.querySelector("img").alt;
		} catch(e){}
		
		if (!name){
			try {
				name = escapeHtml(ele.querySelector(".mixcloud-live-chat-row-link[href]").innerText);
			} catch(e){}
		}
		try {
			username = ele.querySelector(".mixcloud-live-chat-row-link[href]").href;
			username = username.split("/");
			username.pop();
			username = username.pop();
		}catch(e){}
		
		try{
			if (ele.querySelector(".mixcloud-live-chat-row-link")){
			  name = escapeHtml(ele.querySelector(".mixcloud-live-chat-row-link").innerText);
			  if (name){
				name = name.trim();
				name = escapeHtml(name);
			  }
			  msg = escapeHtml(ele.querySelector('.mixcloud-live-chat-row-link').parentNode.nextElementSibling.innerText);
			} 
		} catch(e){}
		
		if (!msg){
			try {
				msg = ele.querySelector("[class*='ChatSubscriptionMessageRow']").textContent || querySelector("[class*='ChatSubscriptionMessageRow']").innerText;
				msg = msg.trim();
				msg = escapeHtml(msg);
				
				try {
					dono = ele.querySelector("[class*='ChatSubscriptionMessageRow'] > p").childNodes;
					dono = dono[dono.length-1].textContent || dono[dono.length-1].innerText || "";
					dono = dono.trim();
					dono = escapeHtml(dono);
				} catch(e){
				}
			} catch(e){
			}
		} else {
			msg = msg.trim();
			if (name){
				if (msg.startsWith(name)){
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}

		var data = {};
		data.chatname = name;
		data.username = username;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.hasMembership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "mixcloud";
		
		
		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		
		pushMessage(data);
		
		/* if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		} */
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
					document.querySelector("textarea").focus();
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

	function onElementInserted(containerSelector) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					if (mutation.addedNodes[0].previousElementSibling && mutation.addedNodes[0].previousElementSibling.previousElementSibling && mutation.addedNodes[0].previousElementSibling.previousElementSibling.previousElementSibling && mutation.addedNodes[0].previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling){
						return; // don't allow old messages from loading
					}
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].classList.contains("mixcloud-live-chat-row")){
							processMessage(mutation.addedNodes[i]);
						}
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
		
	}
	console.log("social stream injected");

	setInterval(function(){
		if (document.querySelector(".mixcloud-live-chat-container")){
			if (!document.querySelector(".mixcloud-live-chat-container").marked){
				document.querySelector(".mixcloud-live-chat-container").marked=true;
				onElementInserted(".mixcloud-live-chat-container");
			}
		}
	},1000);

})();