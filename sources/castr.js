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
						node.src = node.src+"";
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
		
		try {
			name = escapeHtml(ele.querySelector(".chat__message__username").innerText);
			name = name.trim();
			nameColor = ele.querySelector(".chat__message__username").style.color;
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			return;
		}

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector('.chat__message__message'));
			msg = msg.trim();
		} catch(e){
			return;
		}
		
		//data.sourceImg = brandedImageURL;
		
		var sourceImg = "castr.png";
		try {
			var source = ele.className.split("chat__message--");
			if (source.length){
				source = source[1].split(" ")[0];
				sourceImg = source+".png";
			}
		} catch(e){}
		

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "castr";
		var sourceImgPath = "./sources/images/"+sourceImg;
		var normalizedSourceImg = resolveSourceImageUrl(sourceImgPath);
		var typeIconUrl = resolveSourceImageUrl("./sources/images/" + data.type + ".png");
		var finalSourceImg = normalizedSourceImg;
		if (finalSourceImg && typeIconUrl && finalSourceImg.toLowerCase() === typeIconUrl.toLowerCase()) {
			finalSourceImg = "";
		}
		if (finalSourceImg) {
			data.sourceImg = finalSourceImg;
		}
		
		
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
				if ("getSource" == request){sendResponse("castr");	return;	}
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
							if (mutation.addedNodes[i].classList.contains("chat__message")){
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
			if (document.querySelector('.chat')){
				if (!document.querySelector('.chat').marked){
					document.querySelector('.chat').marked=true;
					onElementInserted(document.querySelector('.chat'));
				}
			}
		} catch(e){}
	},2000);

})();
