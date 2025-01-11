(function () {
	const messageHistory = new Set();
	var lastName = "";
	var lastchatimg = "";
	var newest = 0;
	
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
	  
	  
	    if (messageHistory.has(ele.id)) return;
		messageHistory.add(ele.id);
		if (messageHistory.size > 300) { // 250 seems to be Youtube's max?
			const iterator = messageHistory.values();
			messageHistory.delete(iterator.next().value);	  
		}
		
		ele.dataset.old = newest++;
	  
	  var chatimg = "";
	  try{
		   chatimg = ele.querySelector(".md-avatar-wrapper img[src]").src;
		   if (chatimg.startsWith("data:image/gif;base64")){
			   chatimg="";
		   }
	  } catch(e){ }
	 
	  var name = ele.querySelector(".sender-name")
	  if (name && name.innerText){
		  name = name.innerText ;
		if (name.startsWith("from ")){
			name = name.replace("from ","");
			name = name.replace(" to Everyone","");
		} else if (name == "You"){
			try {
				name = document.querySelector('[data-type="body-secondary"]').textContent.split(" ")[0];
			} catch(e){}
		}
		name = name.trim();
		name = escapeHtml(name);
	  } else {
		  name = "";
	  }
	if (name){
		lastName = name;
		lastchatimg = chatimg;
	} else {
		name = lastName;
		chatimg = lastchatimg;
	}
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('.activity-item-message').innerText;
		msg = msg.trim();
		msg = escapeHtml(msg);
	  } catch(e){
		
	  }
	  
	  if (!msg){return;}
	  var data = {};
	  data.chatname = name;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = msg;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.membership = "";;
	  data.contentimg = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "webex";
	  
	  if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	  
	}

	function pushMessage(data){
		try {
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
					document.querySelector("div[class^='style-text-container-']>textarea").focus();
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

	function onElementInserted(target, callback) {
		const onMutationsObserved = function(mutations) {
			target.querySelectorAll(`
				li[tabindex]:not([data-old]):not([id^='act-web-client']), 
				li[tabindex]:not([id^='act-web-client'])[data-old="${newest - 1}"]
			`).forEach(ele => {
				callback(ele);
			});
		};

		if (!target || !callback) {
			return;
		}

		const config = { 
			childList: true, 
			subtree: true 
		};

		const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		const observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);

		return () => observer.disconnect();
	}
	console.log("social stream injected");
	

	setInterval(function(){
		let ele = document.querySelector('#meeting-panel-container');
		if (ele && !ele.marked){
			ele.marked=true;
			console.log("activating");
			onElementInserted(ele, function(element){
			   processMessage(element);
			});
		}
	},3000);

})();