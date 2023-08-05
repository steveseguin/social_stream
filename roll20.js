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


	var lastMessage = "";
	
	function escapeHtml(unsafe){
		try {
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
		try{
		   chatimg = ele.querySelector(".avatar img").src;
		} catch(e){
		}
		
		var name="";
		try {
			name = ele.querySelector(".by").innerText.trim();
			name = escapeHtml(name);
		} catch(e){
		}
		
		var msg = "";
		for (var i=0;i<ele.childNodes.length;i++){
			if (ele.childNodes[i].nodeName == "#text"){
				msg += escapeHtml(ele.childNodes[i].textContent.trim());
			} 
		}
		
		var contentimg = "";
		
		
		if (!name){
			for (var i=0; i<50;i++){
				try {
					ele = ele.previousElementSibling;
				} catch(e){
					break;
				}
				try {
					if (!name){
						name = escapeHtml(ele.querySelector("span.by").innerText.trim());
					}
				} catch(e){
				}
				try {
					if (!chatimg){
						chatimg = ele.querySelector(".avatar img").src;
					}
				} catch(e){
				}
				if (name){break;}
			}
		}
		if (name){
			name = name.replace(":","");
			name = name.trim();
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = contentimg;
		data.type = "roll20";
		
		
		if (data.contentimg){
			toDataURL(data.contentimg, function(dataUrl) {
				data.contentimg = dataUrl;
				if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl2) {
						data.chatimg = dataUrl2;
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
					document.querySelector('#textchat-input textarea').focus();
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
	var lastMessageID = 0;
	var observer = null;
	
	
	function onElementInserted(containerSelector) {
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		
		target.querySelectorAll("[data-messageid]").forEach(ele=>{
			try{
				ele.skip = true;
			} catch(e){}
		});
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].dataset.messageid){
							try{
								if (mutation.addedNodes[i].skip){continue;}
								mutation.addedNodes[i].skip = true;
								processMessage(mutation.addedNodes[i]);
							} catch(e){}
						}
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
		if (document.querySelector('#textchat .content').children.length){
			if (!document.querySelector('#textchat').marked){
				document.querySelector('#textchat').marked=true;
				onElementInserted('#textchat');
			}
		}} catch(e){}
	},2000);

})();