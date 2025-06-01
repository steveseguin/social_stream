(function () {
	 
	
	var isExtensionOn = true;
async function toDataURL(url) {
	  return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.onload = function() {
		  const blob = xhr.response;
		  
		  if (blob.size > (25 * 1024)) {
			resolve(url); // Image size is larger than 25kb.
			return;
		  }
		  
		  const reader = new FileReader();
		  reader.onloadend = function() {
			resolve(reader.result);
		  };
		  reader.onerror = reject;
		  reader.readAsDataURL(blob);
		};
		xhr.onerror = reject;
		xhr.open('GET', url);
		xhr.responseType = 'blob';
		xhr.send();
	  });
	}

	var lastMessage = "";
	
	
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

	async function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		for (let i = 0; i < element.childNodes.length; i++) {
		  const node = element.childNodes[i];
		  
		  // Check if the node is an element and if it's visible
		  if (!settings.textonlymode && (node.nodeType === 1)) {
			const style = window.getComputedStyle(node);
			if (style.display === 'none') {
			  continue; // Skip this node and move to the next iteration
			}
		  }

		  if (node.childNodes.length) {
			resp += await getAllContentNodes(node);
		  } else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
			resp += escapeHtml(node.textContent);
		  } else if (node.nodeType === 1) {
			if (!settings.textonlymode) {
			  if ((node.nodeName == "IMG") && node.src) {
				node.src = await toDataURL(node.src);
			  }
			  resp += node.outerHTML;
			}
		  }
		}
		return resp;
	}
	
	
	async function processMessage(ele){
		
	
		var chatimg = "";
		
		var name="";
		try {
			name = ele.querySelector(".user-name").innerText.trim();
			name = escapeHtml(name);
		} catch(e){
		}
		
		name = name.split(":")[0].trim();
		
		var msg = "";
		try {
			msg = await getAllContentNodes(ele.querySelector(".danmaku-item-right"));
		} catch(e){
		}
		
		
		var contentimg = "";
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "bilibili";
		
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
			try {
				if ("getSource" == request){sendResponse("bilibilicom");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('textarea.comment-sender_input').focus();
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

	var observer = null;
	
	
	function onElementInserted(target) {
		if (!target){return;}
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].skip){continue;}
						mutation.addedNodes[i].skip = true;
						processMessage(mutation.addedNodes[i]);
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.querySelector('#chat-items').children.length){
				if (!document.querySelector('#chat-items').marked){
					document.querySelector('#chat-items').marked=true;
					onElementInserted(document.querySelector('#chat-items'));
				}
			} else if (document.querySelector("iframe").contentWindow.document.body.querySelector('#chat-items').children.length){
				if (!document.querySelector("iframe").contentWindow.document.body.querySelector('#chat-items')){
					document.querySelector("iframe").contentWindow.document.body.querySelector('#chat-items')=true;
					onElementInserted(document.querySelector("iframe").contentWindow.document.body.querySelector('#chat-items'));
				}
			}

		} catch(e){}
	},2000);

})();