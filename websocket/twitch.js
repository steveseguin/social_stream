var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
var redirectURI = 'https://socialstream.ninja/websocket/twitch.html';
var scope = 'chat%3Aread+chat%3Aedit';
var ws;
var token = "";

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

const username = "SocialStreamNinja"; // Not supported at the moment
var channel = urlParams.get("channel") || urlParams.get("username") || '';

function parseFragment(hash) {
	var hashMatch = function(expr) {
	  var match = hash.match(expr);
	  return match ? match[1] : null;
	};
	var state = hashMatch(/state=(\w+)/);
	if (hashMatch(/@(\w+)/)){
		channel = hashMatch(/@(\w+)/);
	} else if (hashMatch(/%40(\w+)/)){
		channel = hashMatch(/%40(\w+)/);
	}
	token = hashMatch(/access_token=(\w+)/);
	if (sessionStorage.twitchOAuthState == state)
		sessionStorage.twitchOAuthToken = hashMatch(/access_token=(\w+)/);
	return
};

function authUrl() {
	sessionStorage.twitchOAuthState = nonce(15);
	var url = 'https://id.twitch.tv/oauth2/authorize' +
		'?response_type=token' +
		'&client_id=' + clientId + 
		'&redirect_uri=' + redirectURI +
		'&scope=' + scope +
		'&state=' + sessionStorage.twitchOAuthState + "@"+(channel||"");
		
	return url
}

// Source: https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
function nonce(length) {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}


const wsUri = 'wss://irc-ws.chat.twitch.tv:443';

let websocket;

function connect() {
  websocket = new WebSocket(wsUri);

  websocket.onopen = () => {
	console.log('Connected');
	// Authenticate and join a channel
	
	websocket.send(`PASS oauth:${sessionStorage.twitchOAuthToken || token}`);
	websocket.send(`NICK ${username}`); // 
	websocket.send(`JOIN #${channel}`); 
	
	
	var span = document.createElement("div");
	span.innerText += "Joined the channel: "+channel;
	document.querySelector("#textarea").appendChild(span);
	if (document.querySelector("#textarea").childNodes.length>10){
		document.querySelector("#textarea").childNodes[0].remove();
	}
  };

  websocket.onmessage = (event) => {
	const messages = event.data.split(/\r?\n/);
	messages.forEach((rawMessage) => {
		if (rawMessage) {
			const parsedMessage = parseMessage(rawMessage);
			if (parsedMessage.command === 'PING') {
				websocket.send('PONG :tmi.twitch.tv');
			} else if (parsedMessage.command === 'PRIVMSG') {
				processMessage(parsedMessage);
			} else {
				console.log(rawMessage);
			}
		}
	  });
	};
		

  websocket.onerror = (event) => {
	console.error('WebSocket error:', event);
  };

  websocket.onclose = (event) => {
	console.log('Disconnected:', event);
	console.log('Attempting to reconnect...');
	setTimeout(connect, 10000); // Reconnect after 10 seconds
  };
}

var BTTV = false;
var SEVENTV = false;
	
chrome.runtime.onMessage.addListener(
	function (request, sender, sendResponse) {
		try{
			if ("focusChat" == request){
				sendResponse(true);
				return;
			} 
			if (typeof request === "object"){
				if ("settings" in request){
					settings = request.settings;
					sendResponse(true);
					if (settings.bttv && !BTTV){
						chrome.runtime.sendMessage(chrome.runtime.id, { "getBTTV": true }, function(response){});
					}
					if (settings.seventv && !SEVENTV){
						chrome.runtime.sendMessage(chrome.runtime.id, { "getSEVENTV": true }, function(response){});
					}
					return;
				} 
				if ("BTTV" in request){
					BTTV = request.BTTV;
					console.log(BTTV);
					sendResponse(true);
					return;
				}
				if ("SEVENTV" in request){
					SEVENTV = request.SEVENTV;
					console.log(SEVENTV);
					sendResponse(true);
					return;
				}
			}
			
			
		} catch(e){}
		sendResponse(false);
	}
);

function parseMessage(rawMessage) {
  const parsedMessage = {
	prefix: null,
	command: null,
	params: [],
	trailing: null
  };

  // Split the message into prefix, command/params, and trailing parts
  const match = rawMessage.match(/^:([^ ]+) +([^ :]+)(?: +([^ :]+))*(?: +:(.*))?$/);
  
  if (match) {
	parsedMessage.prefix = match[1];
	parsedMessage.command = match[2];
	if (match[3]) {
	  parsedMessage.params = match[3].split(' ');
	} 
	if (match[4]){
		parsedMessage.trailing = match[4];
	}
  } else if (rawMessage == "PING :tmi.twitch.tv"){
	 parsedMessage.command = "PING";
  } else {
	// If the regex does not match, the message might be a simple command or malformed.
	console.error('Failed to parse message:', rawMessage);
  }

  return parsedMessage;
}


function sendMessage(message) {
	if (websocket.readyState === WebSocket.OPEN) {
		websocket.send(`PRIVMSG #${channel} :${message}`);
	} else {
		console.error('WebSocket is not open.');
	}
}




if (!channel){
	var urlParams = new URLSearchParams(window.location.hash);
	channel = urlParams.get("channel") || urlParams.get("username") || '';
}

if (document.location.hash.match(/access_token=(\w+)/)){
	parseFragment(document.location.hash);
}
if (sessionStorage.twitchOAuthToken || token) {
	
	if (!channel && (typeof electronApi !== "undefined")){ // twitch.html#
		//channel = prompt("What is the channel you wish to join?");
		if (!channel){
			channel = 'vdoninja';
		}
		try {
			//if (document.location.href.includes("?")){
			//	document.location.href += "&username="+channel;
			//} else {
			//	document.location.href += "?username="+channel;
			//}
		} catch(e){
			console.log("ERROR setting document.location.href");
		}
	}

	console.log("Channel: "+channel);

	connect();
	document.querySelector('.socket').classList.remove("hidden");
	
} else {
	var url = authUrl()
	document.querySelector('#auth-link').href = url;
	document.querySelector('.auth').classList.remove("hidden");
	
	
}

document.querySelector('button').onclick = function(){
	var msg = document.querySelector('#input-text').value.trim();;
	if (msg){
		sendMessage(msg);
		document.querySelector('#input-text').value = "";
	}
}
	

function replaceEmotesWithImages2(message, emotesMap, zw = false) {
	const emotePattern = new RegExp(`(?<![\\w\\d!?.])(\\b${Object.keys(emotesMap).join("\\b|\\b")}\\b)(?!\\w|\\d|[!?.])`, "g");
	return message.replace(emotePattern, match => {
		const emote = emotesMap[match];
		if (!zw || typeof emote === "string") {
			return `<img src="${emote}" alt="${match}" class='zero-width-friendly'/>`;
		} else if (emote.url) {
			return `<span class="zero-width-span"><img src="${emote.url}" alt="${match}" class="zero-width-emote" />`;
		}
	});
}

function replaceEmotesWithImages(text) {
	if (BTTV) {
		if (settings.bttv) {
			try {
				if (BTTV.channelEmotes) {
					text = replaceEmotesWithImages2(text, BTTV.channelEmotes, false);
				}
				if (BTTV.sharedEmotes) {
					text = replaceEmotesWithImages2(text, BTTV.sharedEmotes, false);
				}
			} catch (e) {}
		}
	}
	if (SEVENTV) {
		if (settings.seventv) {
			try {
				if (SEVENTV.channelEmotes) {
					text = replaceEmotesWithImages2(text, SEVENTV.channelEmotes, true);
				}
			} catch (e) {}
		}
	}
	return text;
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


async function fetchWithTimeout(URL, timeout = 8000) { // ref: https://dmitripavlutin.com/timeout-fetch-request/
	try {
		const controller = new AbortController();
		const timeout_id = setTimeout(() => controller.abort(), timeout);
		const response = await fetch(URL, {
			...{
				timeout: timeout
			},
			signal: controller.signal
		});
		clearTimeout(timeout_id);
		return response;
	} catch (e) {
		errorlog(e);
		return await fetch(URL); // iOS 11.x/12.0
	}
}

var channels = {};
function getTwitchAvatarImage(username) {
	if (!username || channels[username]){return;}
	fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(username)).then(response => {
		response.text().then(function(text) {
			if (text.startsWith("https://")) {
				channels[username] = text;
			}
		});
	}).catch(error => {
		//console.log("Couldn't get avatar image URL. API service down?");
	});
}



function processMessage(parsedMessage){
	console.log(parsedMessage);
	var chan = parsedMessage.params[0];
	
	getTwitchAvatarImage(chan);
	
	console.log("channel: "+chan);
	const message = parsedMessage.trailing;
	const user = parsedMessage.prefix.split('!')[0];
	
	console.log(`Message from ${user} in ${chan}: ${message}`);
	var span = document.createElement("div");
	span.innerText += user+": "+message;
	document.querySelector("#textarea").appendChild(span);
	if (document.querySelector("#textarea").childNodes.length>10){
		document.querySelector("#textarea").childNodes[0].remove();
	}
	
	var data = {};
	data.chatname = user;
	data.chatbadges = "";
	data.backgroundColor = "";
	data.textColor = "";
	data.chatmessage = replaceEmotesWithImages(message);
	
	try {
		data.chatimg = "https://api.socialstream.ninja/twitch/?username=" + encodeURIComponent(user);
	} catch (e) {
		data.chatimg = "";
	}
	data.hasDonation = "";
	data.membership = "";;
	if (chan && channels[chan]){
		data.sourceImg = channels[chan];
	}
	data.textonly = settings.textonlymode || false;
	data.type = "twitch";
	
	console.log(data);
	pushMessage(data);
}

var settings = {};

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
	if (settings && settings.bttv && !BTTV){
		chrome.runtime.sendMessage(chrome.runtime.id, { "getBTTV": true }, function(response){});
	}
});


console.log("INJECTED");