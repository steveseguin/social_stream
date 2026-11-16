(function () {
	 
	
	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (25 * 1024)) {
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

	function escapeHtml(unsafe){ // success is when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}
	function getAllContentNodes(element) {
		if (!element){return "";}
		if (settings.textonlymode){return element.textContent || "";}
		var resp = "";
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.nodeType===3){
				return escapeHtml(element.textContent) || "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				// Capture contract: textonly=true means a literal chatmessage string, not HTML.
				// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
				// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
				// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
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
	
	
	var seenRows = new WeakSet();
	var seenMessages = new Set();
	function getMessageData(ele){
		try {
			var key = Object.keys(ele).find(key=>key.startsWith("__reactFiber$"));
			var fiber = key && ele[key];
			for (var depth = 0; fiber && depth < 8; depth++, fiber = fiber.return){
				var message = fiber.memoizedProps && fiber.memoizedProps.message;
				if (message && typeof message.id === "string" && /^\d{1,22}$/.test(message.id) && message.user && typeof message.user.name === "string" && typeof message.text === "string"){
					return message;
				}
			}
		} catch(e){}
		return null;
	}
	function processMessage(ele){
		if (!ele){return;}
		var message = getMessageData(ele);
		var stream = location.pathname.match(/^\/live\/chat\/([a-f0-9]{32})\/?$/);
		var messageId = message && "rutube:" + (stream ? stream[1] : location.pathname) + ":" + message.id;
		if (messageId ? seenMessages.has(messageId) : seenRows.has(ele)){return;}
		//console.log(ele);
		var chatimg = "";
		
		var nameColor = "";
		
		var name="";
		try {
			name = message ? message.user.name : ele.querySelector(".bull-message-module__authorName, .bull-author-module__name").textContent.trim();
		} catch(e){
		//	console.warn(e);
		}
		
		
		var msg="";
		try {
			var author = ele.querySelector(".bull-message-module__authorName, .bull-author-module__name");
			var content = ele.querySelector(".bull-message-module__textMsg") || (author && author.nextElementSibling);
			msg = message && settings.textonlymode ? message.text : getAllContentNodes(content);
		} catch(e){
		//	console.warn(e);
		}
		
		if (!name || !msg){
			return;
		}
		
		
		
		try {
			c
		} catch(e){
		//	console.warn(e);
		}
		
		try {
			chatimg = ele.querySelector("img.bull-message-module__image[src]").src;
		} catch(e){
		//	console.warn(e);
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
		data.membership = "";;
		data.contentimg = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "rutube";
		if (messageId){
			data.id = messageId;
			data.userid = String(message.user.id);
		}
		
	//	console.log(data);
		
		seenRows.add(ele);
		if (messageId){seenMessages.add(messageId);}
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// textonlymode capture contract: literal chatmessage string, no app-added markup; render as text, not HTML.
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
				if ("getSource" == request){sendResponse("rutube");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
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

	var lastURL =  "";
	var observer = null;
	
	
	function onElementInserted(target) {
		if (!target){return;}
		
		function collect(node, rows, descendants){
			var element = node.nodeType === 1 ? node : node.parentElement;
			if (!element || !target.contains(element)){return;}
			var row = element.closest(".bull-message-module__message");
			if (row && target.contains(row)){rows.add(row);}
			if (descendants){
				element.querySelectorAll(".bull-message-module__message").forEach(row=>rows.add(row));
				if (!row && !element.querySelector(".bull-message-module__message") && element.querySelector(".bull-message-module__authorName")){rows.add(element);}
			}
		}
		var onMutationsObserved = function(mutations) {
			var rows = new Set();
			mutations.forEach(function(mutation) {
				collect(mutation.target, rows, false);
				mutation.addedNodes.forEach(node=>collect(node, rows, true));
			});
			rows.forEach(row=>{try{processMessage(row);}catch(e){}});
		};
		
		var config = { childList: true, subtree: true, characterData: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			let mm = document.querySelector('.bull-chat-module__messages') || document.querySelector("iframe").contentWindow.document.body.querySelector('.bull-chat-module__messages');
			if (mm){
				if (!mm.marked){
					mm.marked=true;
					console.log("CONNECTED chat detected");
					onElementInserted(mm);
				}
			}
		} catch(e){}
	},2000);

})();
