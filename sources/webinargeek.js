(function () {
	
	var isExtensionOn = true;
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
		
		if (!ele || !ele.isConnected){
			return;
		}
		
		ele = ele.nodeName === 'UL' ? ele.querySelector('li') || ele : ele;
		
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}

		var nameColor = "";
        var name = "";
		
		try {
			name = escapeHtml(ele.querySelector("[data-part='main'] [data-part='text']").childNodes[0].childNodes[0].childNodes[0].innerText);
			name = name.trim();
		} catch(e){
			//console.log(e);
		}
		
		var chatimg = "";
		
		try {
			chatimg = ele.querySelector("[data-part='avatar'] img[src]").src;
			if (chatimg == "https://www.gravatar.com/avatar/3a0a140f40e46bc5df94cc7ad4ae0de6?s=50&d=blank&rating=g"){
				chatimg = "";
			}
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			return;
		}

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector('[data-part="message"]'));
			msg = msg.trim();
		} catch(e){
			return;
		}
		
		//data.sourceImg = brandedImageURL;
		

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "webinargeek";
		data.sourceImg = "";
		
		
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
				if ("getSource" == request){sendResponse("webinargeek");	return;	}
				if ("focusChat" == request){ 
					document.querySelector('textarea').focus();
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
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				//console.log(mutation);
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							setTimeout(function(ele){
								if (ele.dataset.index){
									if (historyMsg.has(ele.dataset.index)){
										return;
									}
									historyMsg.add(ele.dataset.index);
								}
								processMessage(ele);
							},300, mutation.addedNodes[i]);
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


	var historyMsg = new Set();
	
	setInterval(function(){
		try {
			if (document.querySelector("#widget-sp,#streamingPage_webinargeek").shadowRoot.getElementById("sidebar").querySelector("#sect-chats:not([hidden]) [aria-label='Message list'], ul[class^='ChatList']")){
				setTimeout(function(){
					if (!document.querySelector("#widget-sp,#streamingPage_webinargeek").shadowRoot.getElementById("sidebar").querySelector("#sect-chats:not([hidden]) [aria-label='Message list'], uul[class^='ChatList']").marked){
						document.querySelector("#widget-sp,#streamingPage_webinargeek").shadowRoot.getElementById("sidebar").querySelector("#sect-chats:not([hidden]) [aria-label='Message list'], uul[class^='ChatList']").marked=true;
						console.log("starting..");
						document.querySelector("#widget-sp,#streamingPage_webinargeek").shadowRoot.getElementById("sidebar").querySelector("#sect-chats:not([hidden]) [aria-label='Message list'], uul[class^='ChatList']").childNodes.forEach(x=>{
							x.marked = true;
							if (x.dataset.index){
								historyMsg.add(x.dataset.index);
							}
						});
						onElementInserted(document.querySelector("#widget-sp,#streamingPage_webinargeek").shadowRoot.getElementById("sidebar").querySelector("#sect-chats:not([hidden]) [aria-label='Message list'], uul[class^='ChatList']"));
					}
				},1000);
			}
		} catch(e){}
	},2000);

})();
