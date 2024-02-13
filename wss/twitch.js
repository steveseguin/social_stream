	var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
	var redirectURI = 'https://socialstream.ninja/wss/twitch.html';
	var scope = 'chat%3Aread+chat%3Aedit';
	var ws;
	var token = "";

	function parseFragment(hash) {
		var hashMatch = function(expr) {
		  var match = hash.match(expr);
		  return match ? match[1] : null;
		};
		var state = hashMatch(/state=(\w+)/);
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
			'&state=' + sessionStorage.twitchOAuthState +
			'&scope=' + scope;
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

	
	const username = "SocialStreamNinja"; // Not supported at the moment
	const channel = 'vdoninja'; // Replace with the channel you want to join

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

	
	if (document.location.hash.match(/access_token=(\w+)/))
		parseFragment(document.location.hash);
	if (sessionStorage.twitchOAuthToken || token) {
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
	

	////////
	
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

var brandedImageURL = "";
function getTwitchAvatarImage(username) {
	fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(username)).then(response => {
		response.text().then(function(text) {
			if (text.startsWith("https://")) {
				brandedImageURL = text;
			}
		});
	}).catch(error => {
		//console.log("Couldn't get avatar image URL. API service down?");
	});
}

getTwitchAvatarImage(channel);


function processMessage(parsedMessage){
	
	const channel = parsedMessage.params[0];
	const message = parsedMessage.trailing;
	const user = parsedMessage.prefix.split('!')[0];
	
	console.log(`Message from ${user} in ${channel}: ${message}`);
	document.querySelector("textarea").innerHTML += user+": "+message+"\n";
	document.querySelector("textarea").value = document.querySelector("textarea").value.substring(document.querySelector("textarea").value.length - 500);
	
	var data = {};
	data.chatname = user;
	data.chatbadges = "";
	data.backgroundColor = "";
	data.textColor = "";
	data.chatmessage = message;
	try {
		data.chatimg = "https://api.socialstream.ninja/twitch/?username=" + encodeURIComponent(user);
	} catch (e) {
		data.chatimg = "";
	}
	data.hasDonation = "";
	data.membership = "";;
	data.sourceImg = brandedImageURL;
	data.textonly = settings.textonlymode || false;
	data.type = "twitch";
	
	console.log(data);
	pushMessage(data);
}

var settings = {};

function pushMessage(data){
	console.log("new");
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

console.log("INJECTED");