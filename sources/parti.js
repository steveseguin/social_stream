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
			name = escapeHtml(ele.querySelector("span.username > h6").innerText);
			name = name.trim();
			nameColor = ele.querySelector("span.username > h6").style.color;
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			return;
		}

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector("span.username").nextSibling);
			msg = msg.trim();
		} catch(e){
			return;
		}
		
		
		var chatimg = "";
		try {
			chatimg = ele.querySelector("img.q-img__image[src]:not([src^='data:image/svg'])").src;
		} catch(e){}
		//data.sourceImg = brandedImageURL;
		
		var chatbadge = "";
		try {
			if (ele.querySelector("img.q-img__image[src^='data:image/svg']")){
				chatbadge = [];
				chatbadge.push(ele.querySelector("img.q-img__image[src^='data:image/svg']").src);
			}
		} catch(e){}

		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadge;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "parti";
		
		
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
				if ("focusChat" == request) {
                        document.querySelector('.chat-input input[placeholder][type="text"]').focus();
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
							processMessage(mutation.addedNodes[i]);
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);

	}
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.querySelector('#q-app main > div > div[class]')){
				if (!document.querySelector('#q-app main > div > div[class]').marked){
					document.querySelector('#q-app main > div > div[class]').marked=true;
					document.querySelectorAll('#q-app main > div > div[class]>div').forEach(ele=>{
						try {
							//processMessage(ele);
							ele.marked = true;
						} catch(e){}
					});
					
					onElementInserted(document.querySelector('#q-app main > div > div[class]'));
				}
			}
		} catch(e){}
	},2000);

})();
