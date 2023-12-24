(function () {
	 
	function toDataURL(url, callback) {
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
	
	function processMessage(input){
		
		//console.log(input);
		
		if (!(input.chatter && input.message)){return;}
		
		var chatimg = "https://www.vimm.tv/"+input.chatter+"/avatar";
		var msg = input.message;
		msg = escapeHtml(msg);
		
		if (!msg.length){return;}
		
		var data = {};
		data.chatname = escapeHtml(input.chatter);
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "vimm";
		
		pushMessage(data);
		//console.log(data);
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
	
	function connectWebSocket(url) {
		let socket = new WebSocket(url);

		socket.onopen = function(event) {
			console.log("WebSocket is open now.");
			socket.interval = setInterval(socket.send(JSON.stringify({channel:channel, chatter:channel, message:"", mtype:"signal"})),60000);
		};

		socket.onmessage = function(event) {
			//console.log("Message from server: ", event.data);
			processMessage(JSON.parse(event.data));
		};

		socket.onerror = function(event) {
			console.error("WebSocket error observed:", event);
			clearInterval(socket.interval);
			// Try to reconnect in 5 seconds
			setTimeout(function() { connectWebSocket(url); }, 5000);
		};

		socket.onclose = function(event) {
			console.log("WebSocket is closed now.");
			clearInterval(socket.interval);
			// Reconnect immediately if the close was not intentional
			if (!event.wasClean) {
				setTimeout(function() { connectWebSocket(url); }, 5000);
			}
		};
	}
	
	var url = window.location.href.split("/");
	var channel = url.pop();
	if (!channel){
		channel = url.pop();
	}
	
	connectWebSocket("wss://chat.vimm.tv:9001/ws/chat/"+channel+"/");

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					//document.querySelector('#chat-message-input').focus();
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
	
	
	/*

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){return;}
							mutation.addedNodes[i].skip = true;
							processMessage(mutation.addedNodes[i]);
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
		if (document.querySelector('#chat-log')){
			if (!document.querySelector('#chat-log').marked){
				document.querySelector('#chat-log').marked=true;
				onElementInserted(document.querySelector('#chat-log'));
			}
		}
	},1000); */

})();