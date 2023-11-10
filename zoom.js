(function () {

	var lastMessage = {};
	var lastName = "";
	var lastImage = "";
	var messageHistory = [];
	
	function toDataURL(url, callback) { // not needed with Facebook I think.
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
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
			
			if (node.nodeName == "BUTTON"){
				return;
			}
			
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent.trim())+" ";
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
					if (node.nodeName == "IMG"){
						resp += " ";
					}
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele, id=false){

		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		if (!id){
			var mid = ele.querySelector("div[id][class*='chat']");
			if (!mid || !("id" in mid)){
				return;
			}
			id = mid.id;
		}
		
		if (id){
			if (messageHistory.includes(id)){
				return;
			}
			messageHistory.push(id);
		} else {
			return;
		}

		if (document.querySelector("chat-message__container")){
			if (document.querySelector("chat-message__container").marked){
				return;
			} else {
				document.querySelector("chat-message__container").marked = true;
			}
		}


		var img = false;
		var chatimg = "";
		try{
		   chatimg = ele.querySelector(".chat-item__user-avatar").src;
		   img = true;
		} catch(e){
			//
		}
		
		var name = "";
		if (ele.querySelector(".chat-item__sender")){
		  name = ele.querySelector(".chat-item__sender").innerText;
		  if (name){
			  name = name.trim();
			  name = escapeHtml(name);
		  }
		}

		if (!name){

			try {
				var prev = ele.previousElementSibling;
				for (var i=0; i<50;i++){
					if (prev.querySelector('.chat-item__sender')){
						break;
					} else {
						prev = prev.previousElementSibling;
					}
				}
				try{


				    if (prev.querySelector(".chat-item__sender")){
					    name = prev.querySelector(".chat-item__sender").innerText;
					    if (name){
						    name = name.trim();
							name = escapeHtml(name);
					    }
					    
						chatimg = prev.querySelector(".chat-item__user-avatar") || "";
						if (chatimg){
							chatimg = chatimg.src;
						}
					  }


				} catch(e){}

			} catch(e){}
		}

		var msg = "";
		try {
			msg = getAllContentNodes(ele.querySelector('.chat-rtf-box__display, .new-chat-message__text-box, .new-chat-message__text-content, .chat-message__text-content, .new-chat-message__content'));
		} catch(e){

		}
		if (msg){
			msg = msg.trim();
			if (name){
				if (msg.startsWith(name)){
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}
		
		if (name){
			lastName = name;
			lastImage = chatimg;
		} else if (lastName){
			name = lastName;
			chatimg = lastImage;
		}
		
		var ctt = ele.querySelector(".chat-image-preview-wrapper img[src]") || "";
		if (ctt){
			ctt = ctt.src;
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
		data.contentimg = ""; // ctt;
		data.textonly = settings.textonlymode || false;
		data.type = "zoom";

		if (lastMessage === JSON.stringify(data)){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastMessage = JSON.stringify(data);
		
		if (data.contentimg){
			try {
				toDataURL(data.contentimg, function(dataUrl) {
					data.contentimg = dataUrl;
					pushMessage(data);
					return;
				});
			} catch(e){
			}
		} else {
			pushMessage(data);
		}
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
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
			try{
				if ("focusChat" == request){
					document.querySelector("textarea.chat-box__chat-textarea.window-content-bottom").focus();
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
	var lastHTML = "";
	function streamPollRAW(element){
		var html = element.outerHTML;       
		var data = { html: html }; 
		data.type = "zoom_poll";
		var json = JSON.stringify(data);
		if (lastHTML === json){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastHTML = json;
		pushMessage(data);
	}
	
	var questionList = [];
	function processQuestion(ele){
		var question = getAllContentNodes(ele.querySelector(".q-a-question__question-content"));
		var name = ele.querySelector(".q-a-question__q-owner-name").innerText;
		
		var hash = name+":"+question;
		hash = hash.slice(0, 500);
		if (questionList.includes(hash)){
			return;
		} else {
			questionList.push(hash);
		}
		
		questionList = questionList.slice(-100);
		
		var chatimg = ele.querySelector(".q-a-question__avatar img[src]") || ""
		if (chatimg){
			chatimg = chatimg.src;
		}
		
		if (chatimg === "https://us02st1.zoom.us/web_client/enuunvk/image/default-avatar.png"){
			chatimg = "";
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = question;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = "";
		data.question = true;
		data.type = "zoom";
		
		pushMessage(data);
	}
	

	function onElementInserted(containerSelector) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].hasAttribute("role")){
								processMessage(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].hasAttribute("id")){
								processMessage(mutation.addedNodes[i]);
							} 
						} catch(e){
							
						}
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);

	}
	console.log("social stream injected");

	setInterval(function(){
		messageHistory = messageHistory.slice(-500);
		if (document.getElementById("chat-list-content")){
			if (!document.getElementById("chat-list-content").marked){
				lastName = "";
				lastImage = "";
				document.getElementById("chat-list-content").marked=true;
				onElementInserted("#chat-list-content");
			}
		}
		if (document.getElementById("poll__body")){
			streamPollRAW(document.getElementById("poll__body"));
		}

		if (document.getElementById('chat-list-content')) {
		    document.getElementById('chat-list-content').scrollTop = 10000; // prevent chat box from stop scrolling, which makes messages stop appearing
		}

		if (document.querySelector('[aria-label="open the chat pane"]')) { // prevent chat box from being closed after screen-share by keeping it always open
		    document.querySelector('[aria-label="open the chat pane"]').click()
		}
		
		if (document.querySelector("#q-a-container-window")){
			document.querySelectorAll("#q-a-container-window .q-a-question").forEach(ele=>{
				if (ele.ignore){return;}
				ele.ignore = true;
				processQuestion(ele);
				
			});
		}
		
	},1000);
})();
