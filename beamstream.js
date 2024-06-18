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
						resp += `<img src='${node.src}' />`;
					} else {
						resp += node.outerHTML;
					}
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele){
	//	console.log(ele);
		var name="";
		var nameEle = false;
		
		var root = ele.childNodes[0];
		
		try {
			nameEle = root.nextSibling.childNodes[0];
			name = escapeHtml(nameEle.innerText);
		} catch(e){
		//	console.log(e);
			return;
		}
		
		var msg = "";
		var contentimg = "";
		try {
			if (nameEle.nextSibling){
			
				if ((nameEle.nextSibling.nodeName == "IMG") && nameEle.nextSibling.src){
					contentimg = nameEle.nextSibling.src;
				} else {
					while (nameEle.nextSibling){
						nameEle = nameEle.nextSibling;
						msg += getAllContentNodes(nameEle) + " ";
					}
				}
			
			}
		}catch(e){
		//	console.log(e);
			return;
		}
		msg = msg.trim();
		msg = escapeHtml(msg);
		if (!msg){return;}
		
		
		var chatimg = '';
		try {
			if ((root.nodeName == "IMG") && root.src){
				chatimg = root.src;
			} else {
				chatimg = root.querySelector("img[src]").src;
			}
		} catch(e){
			//console.log(e);
			chatimg = "";
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "beamstream";
		//console.log(data);
		pushMessage(data);
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
			console.error(e);
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
					document.querySelector('#input_3').focus();
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

	var mid  = 1;
	var previousNode = null;
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(mutation=>{
				var nodes = mutation.addedNodes;
				for (var i=0;i<nodes.length;i++){
					try {
						if (nodes[i] && nodes[i].nodeName && nodes[i].nodeName == "DIV"){
							if (nodes[i].parentNode && nodes[i].parentNode.classList.contains("scroll")){
								if (nodes[i].dataset.mid){
									continue;
								}
								// do not reprocess flag + id, if needed.
								nodes[i].dataset.mid = mid++;
								
								// an easy way to avoid duplicates caused by react/vue quirks.
								if (nodes[i].isConnected && previousNode && !previousNode.isConnected){
									previousNode = nodes[i];
									continue;
								}
								previousNode = nodes[i];
								
								processMessage(nodes[i]);
								
							}
						}
					}catch(e){console.error(e)}
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
		var chatContainer = document.querySelector('body')
		if (chatContainer){
			if (!chatContainer.marked){
				chatContainer.marked=true;
				setTimeout(()=>{
					onElementInserted(chatContainer);
				},3000);
			}
		}
	},1000);

})();
