(function () {
	
	
	var isExtensionOn = true;
	function resolveSourceImageUrl(src) {
		if (!src) {
			return "";
		}
		var str = (src + "").trim();
		if (!str) {
			return "";
		}
		if (/^[a-z][a-z0-9+.-]*:/i.test(str) || str.startsWith("//")) {
			return str;
		}
		var cleaned = str.replace(/^\.\/+/, "").replace(/^\/+/, "");
		var lowerCleaned = cleaned.toLowerCase();
		var prefix = "sources/images/";
		if (!lowerCleaned.startsWith(prefix)) {
			cleaned = prefix + cleaned;
		}
		return "./" + cleaned;
	}
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
					if (node && node.nodeName && (node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	const getNextElement = node => {
		let sibling = node.nextSibling;
		while (sibling && sibling.nodeType !== 1) {
			sibling = sibling.nextSibling;
		}
		return sibling;
	}
	
	function processMessage(ele){
		console.log(ele);
		if (!ele){return;}
		if (!ele.isConnected){return;}
		if (!ele.querySelector){return;}
		
		try {
		var name="";
		var nameEle = ele.querySelector('[property="sender.name"]');
		
		try {
			name = nameEle.innerText || "";
			name = escapeHtml(name);
		} catch(e){
			return;
		}
		
		var msg = getAllContentNodes(ele.querySelector('[property="body"]')) || "";
		console.log("..");
		var contentimg = "";
		try {
			let images1 = getNextElement(nameEle);
			//console.log(images1.nodeName, images1);
			if ((images1?.nodeName == "IMG") && images1.src){
				contentimg = images1.src;
				
			} else if ((images1?.nodeName == "VIDEO")){
				
				if (images1.querySelector("source[type='video/webm'][src]")?.src.endsWith(".webm")){
					contentimg = images1.querySelector("source[type='video/webm'][src]").src;
				} else {
					contentimg = images1.getAttribute("poster");
				}
			} else if (!msg){
				while (nameEle?.nextSibling){
					nameEle = nameEle.nextSibling;
					msg += getAllContentNodes(nameEle) + " ";
				}
			}
			
		}catch(e){
		//	console.log(e);
			return;
		}
		
		//console.log(contentimg);
		
		msg = msg.trim();
		if (!msg && !contentimg){return;}
		
		
		var chatimg = '';
		try {
			chatimg = ele.querySelector('[property="sender.avatar"][src]')?.src || "";
			
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
		
		
		var source = ele.querySelector('[property="service"]')?.getAttribute("value") || "";
		if (source){
			if (settings.ignorealternatives){
				return;
			}
			var sourceImg = "./sources/images/"+source+".png";
			var normalizedSourceImg = resolveSourceImageUrl(sourceImg);
			var typeIconUrl = resolveSourceImageUrl("./sources/images/" + data.type + ".png");
			var finalSourceImg = normalizedSourceImg;
			if (finalSourceImg && typeIconUrl && finalSourceImg.toLowerCase() === typeIconUrl.toLowerCase()) {
				finalSourceImg = "";
			}
			if (finalSourceImg) {
				data.sourceImg = finalSourceImg;
			}
		}
		
		//console.log(data);
		
		pushMessage(data);
		} catch(e){
		//	console.error(e);
		}
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
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("beamstream");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('input[type="text"][placeholder][id]').focus();
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
								
								console.log(nodes[i])
								
								setTimeout(function(ele){
									processMessage(ele);
								},400,nodes[i]);
								
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
				
				//document.querySelector('[typeof="ChatMessage"]').parentNode.childNodes.forEach(processMessage);
				chatContainer.marked=true;
				setTimeout(()=>{
					onElementInserted(chatContainer);
				},3000);
			}
		}
	},1000);

})();
