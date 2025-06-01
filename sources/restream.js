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

	var lastMessage = "";
	var lastImg = "";
	var lastTimestamp = Date.now();
	
	
	function walkTheDOM(node, func) {
	  func(node);
	  node = node.firstChild;
	  while (node) {
		  walkTheDOM(node, func);
		  node = node.nextSibling;
	  }
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
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);

		var chatimg = "";
		try {
			chatimg = ele.children[0].children[0].children[0].querySelector("img.MuiAvatar-img:last-child:not([src^='https://restream.io/img/api/platforms/'])").src;
		} catch(e){
			//console.log(e);
		}
		
		if (chatimg && (chatimg === "https://chat.restream.io/assets/icon-platform/restream-icon-white.svg")){
			chatimg = "";
		}
		var nameColor = "";
        var name = "";
		
		try {
			name = ele.children[0].children[0].children[1].innerText;
			name = name.trim();
			name = escapeHtml(name);
			nameColor = ele.children[0].children[0].children[1].children[0].style.color;
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			try {
				name = ele.querySelector(".MuiTypography-subtitle2").innerText;
				name = name.trim();
				name = escapeHtml(name);
				nameColor = ele.querySelector(".MuiTypography-subtitle2").style.color;
				} catch(e){
				//console.log(e);
			}
		}

		var msg = "";
		try {
			//msg = ele.querySelector('.chat-text-normal').innerText;
			
			walkTheDOM(ele.querySelector('.chat-text-normal'), function(node) {
				if (node.nodeName === "#text") {
					var text = node.data;
					if (text.length) {
						msg += escapeHtml(text);
					}
				} else if (node.nodeName == "IMG") {
					if (settings.textonlymode){
						if (node.alt){
							msg += node.alt;
						}
					} else {
						msg += node.outerHTML;
					}
				}
			});
			
		} catch(e){
			//console.log(e);
		}
		
		if (msg){
			msg = msg.trim();
		}
		
		//data.sourceImg = brandedImageURL;
		
		var sourceImg = "./sources/images/restream.png";
		try {
			sourceImg = ele.querySelector("img:last-child[src^='https://restream.io/img/api/platforms/']").src;
			
			if (settings.ignorealternatives && sourceImg!=="restream"){
				return;
			}
			
		} catch(e){}
		
		
		

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
		data.type = "restream";
		data.sourceImg = sourceImg;
		
		
		if (data.lastMessage === lastMessage){
			if (data.chatimg != lastImg){
				if (Date.now() - lastTimestamp<1000){
					lastMessage = data.lastMessage;
					lastImg = data.chatimg;
					lastTimestamp = Date.now();
					return;
				}
			}
		}
		
		lastMessage = data.lastMessage;
		lastImg = data.chatimg;
		lastTimestamp = Date.now();
		
		
		pushMessage(data);
		
	}
	
	
	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){
			//console.log(e);
		}
	}
	var listener = false;
	
	function startListener(){
		if (listener){return;}
		listener = true;
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("getSource" == request){sendResponse("restream");	return;	}
					if ("focusChat" == request){
						try {
							ele = document.querySelector("input");
							if (ele){
								ele.focus();
								sendResponse(false);
								return;
							}
						} catch(e){}
						
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
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].tagName == "DIV"){
								setTimeout(function(cb, ele){cb(ele);},1000, callback, mutation.addedNodes[i]);
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


	startListener();
	
	setInterval(function(){
		try {
			if (document.querySelector('#root')){
				if (!document.querySelector('#root').marked){
					document.querySelector('#root').marked=true;
					
					onElementInserted(document.querySelector('#root'), processMessage);
					
				}
			}
		} catch(e){}
	},2000);

})();
