(function () {
	function toDataURL(blobUrl, callback, maxSizeKB = 10) {
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
			var recoveredBlob = xhr.response;

			if (recoveredBlob.size / 1024 > maxSizeKB) { // Check if image size is greater than maxSizeKB
				var img = new Image();

				img.onload = function() {
					var canvas = document.createElement('canvas');
					var ctx = canvas.getContext('2d');
					
					// Resize logic (example: 250x250)
					var maxSideSize = 250;
					var ratio = Math.min(maxSideSize / img.width, maxSideSize / img.height);
					canvas.width = img.width * ratio;
					canvas.height = img.height * ratio;

					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

					// Convert to base64, can choose format and quality
					var newDataUrl = canvas.toDataURL('image/jpeg', 0.7);
					callback(newDataUrl);
				};

				var urlCreator = window.URL || window.webkitURL;
				img.src = urlCreator.createObjectURL(recoveredBlob);
			} else {
				// If image is not too large, use original
				var reader = new FileReader();

				reader.onload = function() {
					callback(reader.result);
				};

				reader.readAsDataURL(recoveredBlob);
			}
		};

		xhr.open('GET', blobUrl);
		xhr.send();
	}

	var lastMessage = {};
	var lastName = "";
	var lastImage = "";
	
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
					if ((node.nodeName == "IMG") && node.alt){
						resp += node.alt;
					}
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

		var chatimg = "";
		try{
			chatimg = ele.querySelector('[data-tid="message-avatar"]').querySelector("img").src;
		} catch(e){
			
			if (!chatimg){
				try {
					chatimg = document.querySelector("profile-picture>.user-picture").src;
				} catch(e){
					//console.error(e);
				}
			}
				
		}
		
		
        var name = "";
		if (ele.querySelector(".ui-chat__message__author")){
			name = escapeHtml(ele.querySelector(".ui-chat__message__author").innerText);
		} 

		if (!chatimg){
			try {
				var prev = ele;
				for (var i=0; i<50;i++){
					if (prev.querySelector('.ui-chat__message__timestamp')){
						if (window.getComputedStyle(prev.querySelector('.ui-chat__message__timestamp')).width != "1px"){
							break;
						} else {
							prev = prev.previousElementSibling;
						}
					} else {
						prev = prev.previousElementSibling;
					}
				}
				chatimg = prev.querySelector('[data-tid="message-avatar"]').querySelector("img").src
				name = escapeHtml(prev.querySelector(".ui-chat__message__author").innerText);
				
			} catch(e){} 
		}
		
		if (name){
		  name = name.trim();
		  name = name.replace(/\s*\([^)]*\)/g, ''); // remove brackets tags.
	    }

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector('.ui-chat__message__content, .ui-chat__messagecontent'));
		} catch(e){}
		
		if (msg){
			msg = msg.trim();
		}

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
		data.type = "teams";

		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	}
	
	function processMessage2(mainEle){
		if (mainEle && mainEle.marked){
		  return;
		} else {
		  mainEle.marked = true;
		}
		
		var chatimg = "";
		try{
			chatimg = mainEle.querySelector('profile-picture, div[data-tid="message-avatar"]').querySelector("img").src;
		} catch(e){
			
		}
		
		var ele = mainEle.querySelector('.message-body') || mainEle;
		
        var name = "";
		try {
			name = ele.querySelector("div[data-tid='threadBodyDisplayName'], div[data-tid='message-author-name']").innerText;
		} catch(e){}
		
		if (name){
		  name = name.trim();
		  name = name.replace(/\s*\([^)]*\)/g, ''); // remove brackets tags.
	    }
		
		try {
			name = escapeHtml(name);
		} catch(e){}
		
		

		if (!chatimg){
			try {
				var prev = mainEle;
				for (var i=0; i<50;i++){
					if (prev.querySelector('.timestamp-column')){ //  ts-message-list-item
						if (window.getComputedStyle(prev.querySelector('.timestamp-column')).width != "1px"){
							break;
						} else {
							prev = prev.previousElementSibling;
						}
					} else {
						prev = prev.previousElementSibling;
					}
				}
				chatimg = prev.querySelector('profile-picture').querySelector("img").src
				name = escapeHtml(prev.querySelector("div[data-tid='threadBodyDisplayName']").innerText);
				
			} catch(e){} 
		}
		
		if (name){
		  name = name.replace("(Guest)","");
		  name = name.trim();
	    }

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector("div[data-tid='messageBodyContent'], [data-tid='chat-pane-message']"));
		} catch(e){}
		
		if (msg){
			msg = msg.trim();
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
		data.type = "teams";

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
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	var listener = false;
	
	function startListener(){
		if (listener){return;}
		listener = true;
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("focusChat" == request){
						try {
							var ele = document.querySelector('iframe').contentWindow.document.body.querySelector(".cke_textarea_inline[contenteditable='true'], div[role='textbox']>p[data-placeholder]");
							if (ele){
								ele.focus();
								sendResponse(true);
								return;
							} 
						} catch(e){}
						
						try {
							ele = document.body.querySelector(".cke_textarea_inline[contenteditable='true']>p, div[role='textbox']>p[data-placeholder]");
							if (ele){
								ele.focus();
								sendResponse(true);
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

	window.duplicatedTeamsMessages = {}

  setInterval(() => { window.duplicatedTeamsMessages = {} }, 10000)

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
              if (window.duplicatedTeamsMessages[mutation.addedNodes[i].textContent]) {
                console.log('duplicated')
                return
              } else if (mutation.addedNodes[i].classList.contains("ui-chat__item--message")){  // ui-chat__item--message
								setTimeout(function(eee){callback(eee);},300, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].classList.contains("ts-message-list-item")){  // ui-chat__item--message
								setTimeout(function(eee){callback(eee);},300, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].dataset.tid && (mutation.addedNodes[i].dataset.tid=="chat-pane-item")){  // enterprise chat?
								setTimeout(function(eee){callback(eee);},300, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].children[0].attributes['data-tid'].nodeValue === 'chat-pane-item') {
                window.duplicatedTeamsMessages[mutation.addedNodes[i].textContent] = true
                setTimeout(function(eee){callback(eee);},300, mutation.addedNodes[i]);
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
		
		document.querySelectorAll('iframe').forEach( item =>{
			if (item && item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]')){
				if (!item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]').marked){
					console.log("!!!!!!!!!!!!!!!!!! ACTIVATED? in iframe");
					lastName = "";
					lastImage = "";
					item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]').marked=true;
					
					setTimeout(function(ele){
						onElementInserted(ele, processMessage);
					},1000, item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]'));
					
					startListener();
				}
			}
		});
		try{
			if (document.querySelector('context-message-pane, [data-tid="message-pane-body"]')){ // enterprise friendly

				if (!document.querySelector('context-message-pane, [data-tid="message-pane-body"]').marked){
					console.log("!!!!!!!!!!!!!!!!!! ACTIVATED?");
					lastName = "";
					lastImage = "";
					document.querySelector('context-message-pane, [data-tid="message-pane-body"]').marked=true;
					setTimeout(function(ele){onElementInserted(ele, processMessage2);},1000, document.querySelector('context-message-pane, [data-tid="message-pane-body"]'));
					
					startListener();
				}
			}
		} catch(e){}
	},1000);

})();
