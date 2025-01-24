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
	
	var historySet = new Set();

	function processMessage(ele){
		
		if (!ele || !ele.isConnected){return;}
		console.log(ele);
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		const id = ele.querySelector("[id]")?.id;
		if (!id || !id.includes("-")) return;
		if (historySet.has(id)) return;
		historySet.add(id);
		
		//console.log(ele);

		var nameColor = "";
        var name = "";
		
		try {
			name = escapeHtml(ele.querySelector('[class^="_message-username_"]').innerText);
			name = name.trim();
			nameColor = ele.querySelector('button[class^="_message-username_"]').style.color;
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			return;
		}

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector('[class^="_message-content_"]'));
			msg = msg.trim();
		} catch(e){
			return;
		}
		var chatimg = "";
		try {
			chatimg = ele.querySelector("picture[class^='_picture-wrapper'] img[src]").src;
		} catch(e){
		}
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "noice";
		
		
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
					document.querySelector('[role="textbox"], [contenteditable="true"]').focus();
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
			var lettt = document.querySelector('[class^="_chat-container_"]>div');
			if (lettt){
				if (!lettt.marked){
					lettt.marked=true;
					setTimeout(function(lettt){
						onElementInserted(lettt);
					},2000,lettt);
				}
			}
		} catch(e){}
	},2000);

})();
