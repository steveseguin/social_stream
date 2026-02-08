(function () {
	
	var isExtensionOn = true;
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
	
	function processMessage2(ele, skip=false){
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		var chatimg = "";
		try{
			chatimg = document.querySelector('[data-tid="me-control-avatar"], profile-picture, div [data-tid="message-avatar"]').querySelector("img").src;
		} catch(e){
			
		}
		
        var name = "";
        var nameEscaped = false;
        try {
            name = ele.querySelector("div [data-tid='threadBodyDisplayName'], div [data-tid='message-author-name']").innerText;
        } catch(e){}
		
		
		
		//console.log(chatimg);
		if (!ele.querySelector(".fui-ChatMyMessage")){
			//console.log(ele);
			chatimg = "";
			
			if (!chatimg && ele.querySelector('[data-tid="message-avatar"] img[src], profile-picture img[src]')){
				chatimg = ele.querySelector('[data-tid="message-avatar"] img[src], profile-picture img[src]').src;
			}
			
			try {
				var prev = ele;
				for (var i=0; i<50;i++){
					if (!chatimg && prev.querySelector('[data-tid="message-avatar"] img[src], profile-picture img[src]')){
						chatimg = prev.querySelector('[data-tid="message-avatar"] img[src], profile-picture img[src]').src;
					}
					if (prev.querySelector('[data-tid="message-author-name"]')){ //  ts-message-list-item
						break;
					} else {
						prev = prev.previousElementSibling;
					}
				}
				
                name = escapeHtml(prev.querySelector('[data-tid="message-author-name"]').innerText);
                nameEscaped = true;
                
            } catch(e){} 
        }
        
        if (!nameEscaped){
            try {
                name = escapeHtml(name);
                nameEscaped = true;
            } catch(e){}
        }
		
		if (name){
		  name = name.trim();
		  name = name.replace(/\s*\([^)]*\)/g, ''); // remove brackets tags.
	    }
		
		if (name){
		  name = name.trim();
	    }

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector('[id^="content-"]'));
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
		
		//console.log(data);
		
		//if (window.duplicatedTeamsMessages[name+msg]){return;}

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
					if ("getSource" == request){sendResponse("teams");	return;	}
					if ("focusChat" == request){
						try {
							var ele = document.querySelector('iframe').contentWindow.document.body.querySelector(".cke_textarea_inline[contenteditable='true'], div [role='textbox']>p[data-placeholder]");
							if (ele){
								ele.focus();
								sendResponse(true);
								return;
							} 
						} catch(e){}
						
						try {
							ele = document.body.querySelector(".cke_textarea_inline[contenteditable='true']>p, div [role='textbox']>p[data-placeholder]");
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
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
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
							    if (mutation.addedNodes[i].querySelector('[data-testid="message-wrapper"]')){  // ui-chat__item--message
								
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
			var frameDoc = null;
			try {
				if (item && item.contentWindow){
					frameDoc = item.contentWindow.document;
				}
			} catch (err) {
				// accessing cross-origin iframe throws; skip it
				frameDoc = null;
			}
			
			if (!frameDoc || !frameDoc.body){
				return;
			}
			
			var viewport = frameDoc.body.querySelector('[data-view="message-pane-list-viewport"]');
			if (viewport){
				if (!viewport.marked){
					console.log("!!!!!!!!!!!!!!!!!! ACTIVATED? in iframe");
					lastName = "";
					lastImage = "";
					viewport.marked=true;
					
					setTimeout(function(ele){
						onElementInserted(ele, processMessage);
					},1000, viewport);
					
					startListener();
				}
			}
		});
		try{
			if (document.querySelector('#chat-pane-list')){ // enterprise friendly

				if (!document.querySelector('#chat-pane-list').marked){
					console.log("!!!!!!!!!!!!!!!!!! ACTIVATED?");
					lastName = "";
					lastImage = "";
					document.querySelector('#chat-pane-list').marked=true;
					setTimeout(function(ele){
						
							document.querySelector('#chat-pane-list').childNodes.forEach(x=>{
								 x.marked = true;
							});
							
							onElementInserted(ele, processMessage2);
						},4000, document.querySelector('#chat-pane-list'));
					
					startListener();
				}
			}
		} catch(e){}
	},1000);

})();
