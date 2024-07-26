var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
var redirectURI = 'https://socialstream.ninja/sources/websocket/twitch.html';
var scope = 'chat%3Aread+chat%3Aedit';
var ws;
var token = "";
console.log("Injected");
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
var hashParams = new URLSearchParams(window.location.hash.slice(1));

const username = "SocialStreamNinja"; // Not supported at the moment

var channel = urlParams.get("channel") || urlParams.get("username") || hashParams.get("channel") || localStorage.getItem("twitchChannel") || '';
let userAlias = '';

// Add this function to update the alias
function updateAlias() {
    userAlias = document.querySelector('#alias-input').value.trim();
    localStorage.setItem('twitchUserAlias', userAlias);
}

function fetchUserInfo() {
    fetch('https://api.twitch.tv/helix/users', {
        headers: {
            'Authorization': 'Bearer ' + sessionStorage.twitchOAuthToken,
            'Client-Id': clientId
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.data && data.data[0]) {
            const username = data.data[0].login;
            if (!channel) {
                channel = username;
                localStorage.setItem("twitchChannel", channel);
            }
            connect();
        }
    })
    .catch(error => console.error('Error fetching user info:', error));
}

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
        sessionStorage.twitchOAuthToken = token;

	if (sessionStorage.twitchOAuthState == state) {
        sessionStorage.twitchOAuthToken = token;
        fetchUserInfo(); // Fetch user info after authentication
    }
    return;
}

function authUrl() {
    sessionStorage.twitchOAuthState = nonce(15);
    var url = 'https://id.twitch.tv/oauth2/authorize' +
        '?response_type=token' +
        '&client_id=' + clientId + 
        '&redirect_uri=' + redirectURI +
        '&scope=' + scope +
        '&state=' + sessionStorage.twitchOAuthState + "@" + (channel || "");
    
    return url;

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
        websocket.send(`NICK ${username}`);
        websocket.send(`JOIN #${channel}`);
        
        var span = document.createElement("div");
        span.innerText += `Joined the channel: ${channel}`;
        if (userAlias) {
            span.innerText += ` (as ${userAlias})`;
        }
        document.querySelector("#textarea").appendChild(span);
        if (document.querySelector("#textarea").childNodes.length > 10){
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
				if ("SEVENTV" in request) {
					SEVENTV = request.SEVENTV;
					//console.log(SEVENTV);
					sendResponse(true);
					mergeEmotes();
					return;
				}
				if ("BTTV" in request) {
					BTTV = request.BTTV;
					//console.log(BTTV);
					sendResponse(true);
					mergeEmotes();
					return;
				}
			}
			
			
		} catch(e){}
		sendResponse(false);
	}
);

var EMOTELIST = false;
function mergeEmotes(){ // BTTV takes priority over 7TV in this all.
	
	EMOTELIST = {};
	
	if (BTTV) {
		console.log(BTTV);
		if (settings.bttv) {
			try {
				if (BTTV.channelEmotes) {
					EMOTELIST = BTTV.channelEmotes;
				}
				if (BTTV.sharedEmotes) {
					EMOTELIST = deepMerge(BTTV.sharedEmotes, EMOTELIST);
				}
				if (BTTV.globalEmotes) {
					EMOTELIST = deepMerge(BTTV.globalEmotes, EMOTELIST);
				}
				// for testing.
				EMOTELIST = deepMerge({"ASSEMBLE0":{url:"https://cdn.7tv.app/emote/641f651b04bb57ba4db57e1d/2x.webp","zw":true}}, EMOTELIST);
				
			} catch (e) {}
		}
	}
	if (SEVENTV) {
		console.log(SEVENTV);
		if (settings.seventv) {
			try {
				if (SEVENTV.channelEmotes) {
					EMOTELIST = deepMerge(SEVENTV.channelEmotes, EMOTELIST);
				}
			} catch (e) {}
			try {
				if (SEVENTV.globalEmotes) {
					EMOTELIST = deepMerge(SEVENTV.globalEmotes, EMOTELIST);
				}
			} catch (e) {}
		}
	}
	console.log(EMOTELIST);
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
        
        // Display the message locally with the alias
        var span = document.createElement("div");
        span.innerText = `${userAlias || username}: ${message}`;
        document.querySelector("#textarea").appendChild(span);
        if (document.querySelector("#textarea").childNodes.length > 10){
            document.querySelector("#textarea").childNodes[0].remove();
        }
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
    if (!channel) {
        fetchUserInfo();
    } else {
        localStorage.setItem("twitchChannel", channel);
        connect();
    }
    document.querySelector('.socket').classList.remove("hidden");
} else {
    var url = authUrl();
    document.querySelector('#auth-link').href = url;
    document.querySelector('.auth').classList.remove("hidden");
}

// Modify the button click handler
document.querySelector('button').onclick = function(event){
    event.preventDefault(); // Prevent form submission
    updateAlias(); // Update the alias before sending the message
    var msg = document.querySelector('#input-text').value.trim();
    if (msg){
        sendMessage(msg);
        document.querySelector('#input-text').value = "";
    }
};

// Load saved alias on page load
window.addEventListener('load', () => {
    const savedAlias = localStorage.getItem('twitchUserAlias');
    if (savedAlias) {
        document.querySelector('#alias-input').value = savedAlias;
        userAlias = savedAlias;
    }
});

// Prevent form submission on Enter key press
document.querySelector('#input-text').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        document.querySelector('button').click();
    }
});

const emoteRegex = /(?<=^|\s)(\S+?)(?=$|\s)/g;
	
function replaceEmotesWithImages(message) {
  //console.log(EMOTELIST);
  if (!EMOTELIST) {
	return message;
  }
  
  let result = '';
  let lastEmote = null;
  let lastIndex = 0;
  
  message.replace(emoteRegex, (match, emoteMatch, offset) => {
	// Add any text before this emote
	result += message.slice(lastIndex, offset);
	lastIndex = offset + match.length;

	const emote = EMOTELIST[emoteMatch];
	if (emote) {
	  const escapedMatch = escapeHtml(match);
	  const isZeroWidth = typeof emote !== "string" && emote.zw;
	  
	  if (!isZeroWidth) {
		// Regular emote
		if (lastEmote) {
		  result += lastEmote;
		}
		lastEmote = `<img src="${typeof emote === 'string' ? emote : emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="regular-emote"/>`;
	  } else if (lastEmote) {
		// Zero-width emote with a preceding emote
		const zeroWidthEmote = `<img src="${emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="zero-width-emote-centered"/>`;
		result += `<span class="emote-container">${lastEmote}${zeroWidthEmote}</span>`;
		lastEmote = null;
	  } else {
		// Zero-width emote without a preceding emote
		result += `<img src="${emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="zero-width-emote-centered"/>`;
	  }
	} else {
	  if (lastEmote) {
		result += lastEmote;
	  }
	  result += match;
	  lastEmote = null;
	}
  });
  
  // Add any remaining text after the last emote
  result += message.slice(lastIndex);

  // Add any remaining lastEmote
  if (lastEmote) {
	result += lastEmote;
  }
  
  return result;
}

/* function replaceEmotesWithImages2(message, emotesMap, zw = false) {
	const emotePattern = new RegExp(`(?<![\\w\\d!?.])(\\b${Object.keys(emotesMap).join("\\b|\\b")}\\b)(?!\\w|\\d|[!?.])`, "g");
	return message.replace(emotePattern, match => {
		const emote = emotesMap[match];
		if (!zw || typeof emote === "string") {
			return `<img src="${emote}" alt="${match}" class='zero-width-friendly'/>`;
		} else if (emote.url) {
			return `<span class="zero-width-span"><img src="${emote.url}" alt="${match}" class="zero-width-emote" />`;
		}
	});
} */

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
	//console.log(parsedMessage);
	var chan = parsedMessage.params[0];
	
	getTwitchAvatarImage(chan);
	
	//console.log("channel: "+chan);
	const message = parsedMessage.trailing;
	const user = parsedMessage.prefix.split('!')[0];
	
	//console.log(`Message from ${user} in ${chan}: ${message}`);
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
	
	//console.log(data);
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