
var isExtensionOn = true;

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

function escapeHtml(unsafe) {
	try {
		// Unescape the text
		var tempDiv = document.createElement('div');
		tempDiv.innerHTML = unsafe;
		var unescapedText = tempDiv.textContent || tempDiv.innerText || "";
		
		if (settings.textonlymode) {
			return unescapedText;
		}

		// Re-escape the text
		return unescapedText
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;") || "";
	} catch (e) {
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
					node.src.startsWith('http') || (node.src = node.src + "");
				}
				resp += node.outerHTML;
			}
		}
	});
	return resp;
}

function processMessage(input){
	
	if (!(input.chatter && input.message)){return;}
	
	var chatimg = "https://www.vimm.tv/"+input.chatter+"/avatar";
	var msg = input.message;
	msg = escapeHtml(msg);
	if (!msg.length){return;}
	
	if (!settings.textonlymode){
		msg = msg.replace(/:([a-zA-Z0-9]+):/g, '<img src="https://www.vimm.tv/media/emotes/$1.png">');
	}
	var data = {};
	data.chatname = escapeHtml(input.chatter);
	
	if (data.chatname.toLowerCase() == "vimm"){
		return; // ignore this message
	}
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


console.log("LOADED");
var settings = {};

(function (w) {
	w.URLSearchParams = w.URLSearchParams || function (searchString) {
		var self = this;
		self.searchString = searchString;
		self.get = function (name) {
			var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(self.searchString);
			if (results == null) {
				return null;
			} else {
				return decodeURI(results[1]) || 0;
			}
		};
	};

})(window);

var urlParams = new URLSearchParams(window.location.search);

function connectWebSocket(url) {
	let socket = new WebSocket(url);

	socket.onopen = function(event) {
		console.log("WebSocket is open now.");
		socket.interval = setInterval(socket.send(JSON.stringify({channel:channel, chatter:channel, message:"", mtype:"signal"})),60000);
	};

	socket.onmessage = function(event) {
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


var channel = urlParams.get("username");

if (channel){
	channel = channel.split("%")[0];
	if (channel){
		connectWebSocket("wss://chat.vimm.tv:9001/ws/chat/"+channel+"/");
	}
}

function pushMessage(data){
	try{
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
	} catch(e){
	}
}

chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
	if ("settings" in response){
		settings = response.settings;
	}
});

chrome.runtime.onMessage.addListener(
	function (request, sender, sendResponse) {
		try{
			if ("getSource" == request){sendResponse("vimm");	return;	}
				if ("focusChat" == request){
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