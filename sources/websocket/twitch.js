var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
var redirectURI = window.location.href.split("/twitch.html")[0]+"/twitch.html"; //  'https://socialstream.ninja/sources/websocket/twitch.html';
var scope = 'chat:read+chat:edit+channel:read:subscriptions+bits:read+moderator:read:followers+moderator:read:chatters';
var ws;
var token = "";
var channel = '';
var username = "SocialStreamNinja"; // Not supported at the moment
let websocket;
var BTTV = false;
var SEVENTV = false;
var FFZ = false;
var EMOTELIST = false;
var settings = {};

var urlParams = new URLSearchParams(window.location.search);
var hashParams = new URLSearchParams(window.location.hash.slice(1));
channel = urlParams.get("channel") || urlParams.get("username") || hashParams.get("channel") || localStorage.getItem("twitchChannel") || "";
	
	
// At the beginning of the script, add:
function getStoredToken() {
    return localStorage.getItem('twitchOAuthToken');
}
function setStoredToken(token) {
    localStorage.setItem('twitchOAuthToken', token);
}
function clearStoredToken() {
    localStorage.removeItem('twitchOAuthToken');
    localStorage.removeItem('twitchChannel');
}
function showAuthButton() {
    const authElement = document.querySelector('.auth');
    const socketElement = document.querySelector('.socket');
    if (authElement) authElement.classList.remove("hidden");
    if (socketElement) socketElement.classList.add("hidden");
}
function showSocketInterface() {
    const authElement = document.querySelector('.auth');
    const socketElement = document.querySelector('.socket');
    if (socketElement) socketElement.classList.remove("hidden");
    if (authElement) authElement.classList.add("hidden");
}
function initializePage() {
    urlParams = new URLSearchParams(window.location.search);
    hashParams = new URLSearchParams(window.location.hash.slice(1));
    channel = urlParams.get("channel") || urlParams.get("username") || hashParams.get("channel") || localStorage.getItem("twitchChannel") || channel;
	
    // Set up event listeners
    const signOutButton = document.getElementById('sign-out-button');
    if (signOutButton) {
        signOutButton.addEventListener('click', signOut);
    }

    const authLink = document.getElementById('auth-link');
    if (authLink) {
        authLink.addEventListener('click', function(e) {
            e.preventDefault();
            const authURL = authUrl();
            window.location.href = authURL;
        });
    }

    const sendButton = document.querySelector('#sendmessage');
    if (sendButton) {
        sendButton.onclick = handleSendMessage;
    }

    const inputText = document.querySelector('#input-text');
    if (inputText) {
        inputText.addEventListener('keypress', handleEnterKey);
    }

    // Load and set up alias
    const savedAlias = localStorage.getItem('twitchUserAlias');
    const aliasInput = document.getElementById('alias-input');
    if (savedAlias && aliasInput) {
        aliasInput.value = savedAlias;
    }
    if (aliasInput) {
        aliasInput.addEventListener('change', function() {
            localStorage.setItem('twitchUserAlias', this.value);
        });
    }

    // Check authentication state
    const storedToken = getStoredToken();
    if (storedToken) {
        verifyAndUseToken(storedToken);
    } else if (window.location.hash) {
        parseFragment(window.location.hash);
    } else {
        showAuthButton();
    }
}
function verifyAndUseToken(token) {
    fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
            'Authorization': `OAuth ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Token validation data:", data); // Add this line
        if (data.login) {
            setStoredToken(token);
            username = data.login;
            localStorage.setItem("twitchChannel", channel);
            connect();
            showSocketInterface();
        } else {
            clearStoredToken();
            showAuthButton();
        }
    })
    .catch(error => {
        console.error('Error validating token:', error);
        clearStoredToken();
        showAuthButton();
    });
}

function parseFragment(hash) {
    var hashMatch = function(expr) {
        var match = hash.match(expr);
        return match ? match[1] : null;
    };
    var state = hashMatch(/state=(\w+)/);
    if (hashMatch(/@(\w+)/)){
        channel = hashMatch(/@(\w+)/) || channel;
    } else if (hashMatch(/%40(\w+)/)){
        channel = hashMatch(/%40(\w+)/) || channel;
    }
    token = hashMatch(/access_token=(\w+)/);
    if (sessionStorage.twitchOAuthState == state) {
        verifyAndUseToken(token);
    } else {
        console.error('OAuth state mismatch');
        showAuthButton();
    }
}

var userDetails = {};

async function getUserInfo(username) {
	
	if (userDetails[username]){
		return userDetails[username];
	}
	
    const token = getStoredToken();
    if (!token) {
        console.error('No token available');
        return null;
    }
	
	if (username){
		console.log("username: "+username);
	} else {
		return null;
	}

    try {
        const response = await fetchWithTimeout(`https://api.twitch.tv/helix/users?login=${username}`, 5000, {'Client-ID': clientId, 'Authorization': `Bearer ${token}`});
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const deets = data.data[0];
		userDetails[username] = deets;
		return deets;
    } catch (error) {
        console.error('Error fetching user info:', error);
        return null;
    }
}

async function getChatBadges(channelId) {
    const token = getStoredToken();
    if (!token) {
        console.error('No token available');
        return null;
    }

    try {
        const globalResponse = await fetchWithTimeout('https://api.twitch.tv/helix/chat/badges/global', 5000, {'Client-ID': clientId, 'Authorization': `Bearer ${token}`});
        const channelResponse = await fetchWithTimeout(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${channelId}`, 5000, {'Client-ID': clientId, 'Authorization': `Bearer ${token}`});

        if (!globalResponse.ok || !channelResponse.ok) {
            throw new Error(`HTTP error! status: ${globalResponse.status} ${channelResponse.status}`);
        }

        const globalBadges = await globalResponse.json();
        const channelBadges = await channelResponse.json();

        return { globalBadges: globalBadges.data, channelBadges: channelBadges.data };
    } catch (error) {
        console.error('Error fetching chat badges:', error);
        return null;
    }
}

let getViewerCountInterval = null;
let getFollowersInterval = null;
let badges = null;

async function connect() {

	const token = getStoredToken();
	if (!token) {
		console.error('No token available');
		showAuthButton();
		return;
	}
	
	const channelInfo = await getUserInfo(channel);
	if (!channelInfo) {
		console.error('Failed to get channel info');
		return;
	}
	
	clearInterval(getFollowersInterval);
    getFollowersInterval = setInterval(() => getFollowers(channelInfo.id), 60000); // Every minute
	
	const channelId = channelInfo.id;
	badges = await getChatBadges(channelId);

    websocket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    websocket.onopen = async () => {
        console.log('Connected');

        
        channel = channel || username;
        
        websocket.send(`PASS oauth:${token}`);
        websocket.send(`NICK ${username}`);
        websocket.send(`JOIN #${channel}`);
        websocket.send('CAP REQ :twitch.tv/commands');
        websocket.send('CAP REQ :twitch.tv/tags');
		
		connectEventSub();
		
		clearInterval(getViewerCountInterval);
		getViewerCountInterval = setInterval(() => getViewerCount(channelInfo.login), 30000);
		
        
        const textarea = document.querySelector("#textarea");
        if (textarea) {
            var span = document.createElement("div");
            span.innerText = `Joined the channel: ${channel}`;
            textarea.appendChild(span);
            if (textarea.childNodes.length > 10){
                textarea.childNodes[0].remove();
            }
        }
		if (channel){
			if (settings.bttv) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, type:"twitch", channel:channel }, function (response) {});
			}
			if (settings.seventv) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, type:"twitch", channel:channel }, function (response) {});
			}
			if (settings.ffz) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, type:"twitch", channel:channel }, function (response) {});
			}
		}
    };

    websocket.onmessage = (event) => handleWebSocketMessage(event, badges);
    websocket.onerror = (event) => console.error('WebSocket error:', event);
    websocket.onclose = handleWebSocketClose;
}

function handleWebSocketMessage(event) {
  const messages = event.data.split('\r\n');
  messages.forEach((rawMessage) => {
    if (rawMessage) {
      //console.log('Raw message:', rawMessage);
      const parsedMessage = parseMessage(rawMessage);
     // console.log('Parsed message:', parsedMessage);

      switch (parsedMessage.command) {
        case 'PING':
          websocket.send('PONG :tmi.twitch.tv');
          break;
        case 'PRIVMSG':
          processMessage(parsedMessage);
          break;
        case '366': // End of NAMES list
        case 'CAP': // Capability acknowledgment
        case '001': // Welcome message
        case '002': // Your host
        case '003': // Server info
        case '004': // Server version
        case '375': // MOTD start
        case '372': // MOTD
        case '376': // MOTD end
          // These are normal connection messages, we can safely ignore them
          break;
        default:
          if (parsedMessage.type) {
            handleEventSubNotification(parsedMessage);
          } else {
            console.log('Unhandled command:', parsedMessage.command);
          }
      }
    }
  });
}

function checkAuthStatus() {
    const token = getStoredToken();
    if (!token) {
        console.error('No authentication token found');
        showAuthButton();
        return false;
    }
    return true;
}


function handleWebSocketClose(event) {
   // console.log('Disconnected:', event);
    console.log('Attempting to reconnect...');
    setTimeout(connect, 10000); // Reconnect after 10 seconds
}
function signOut() {
    clearStoredToken();
    sessionStorage.removeItem('twitchOAuthState');
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }

    showAuthButton();

    const textarea = document.querySelector('#textarea');
    if (textarea) textarea.innerHTML = '';

    console.log('Signed out successfully');
}
function handleSendMessage(event) {
    event.preventDefault();
    const inputElement = document.querySelector('#input-text');
    if (inputElement) {
        var msg = inputElement.value.trim();
        if (msg) {
            if (sendMessage(msg)){
				inputElement.value = "";
				let builtmsg = {};
				builtmsg.command = "PRIVMSG";
				builtmsg.params = [username];
				builtmsg.prefix = username+"!"+username+"@"+username+".tmi.twitch.tv";
				builtmsg.trailing = msg;
				processMessage(builtmsg);
			}
        }
    }
}
function handleEnterKey(event) {
    if (event.key === 'Enter') {
		handleSendMessage(event);
    }
}

function deepMerge(target, source) {
  for (let key in source) {
	if (source.hasOwnProperty(key)) {
	  if (typeof source[key] === 'object' && source[key] !== null) {
		target[key] = target[key] || {};
		deepMerge(target[key], source[key]);
	  } else {
		target[key] = source[key];
	  }
	}
  }
  return target;
}
	
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
	if (FFZ) {
		console.log(FFZ);
		if (settings.ffz) {
			try {
				if (FFZ.channelEmotes) {
					EMOTELIST = deepMerge(FFZ.channelEmotes, EMOTELIST);
				}
			} catch (e) {}
			try {
				if (FFZ.globalEmotes) {
					EMOTELIST = deepMerge(FFZ.globalEmotes, EMOTELIST);
				}
			} catch (e) {}
		}
	}
	
	// for testing.
	//EMOTELIST = deepMerge({
	//	 "ASSEMBLE0":{url:"https://cdn.7tv.app/emote/641f651b04bb57ba4db57e1d/2x.webp","zw":true},
	//	 "oEDM": {url:"https://cdn.7tv.app/emote/62127910041f77b2480365f4/2x.webp","zw":true},
	//	 "widepeepoHappy": "https://cdn.7tv.app/emote/634493ce05c2b2cd864d5f0d/2x.webp"
	// }, EMOTELIST);
	//console.log(EMOTELIST);
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    try {
        if ("focusChat" == request) {
            sendResponse(true);
            return;
        } 
        if (typeof request === "object") {
			if ("state" in request) {
				isExtensionOn = request.state;
			}
			if ("settings" in request) {
				settings = request.settings;
				sendResponse(true);
				
				if (channel){
					if (settings.bttv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, type:"twitch", channel:channel }, function (response) {});
					}
					if (settings.seventv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, type:"twitch", channel:channel }, function (response) {});
					}
					if (settings.ffz) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, type:"twitch", channel:channel }, function (response) {});
					}
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
			if ("FFZ" in request) {
				FFZ = request.FFZ;
				//console.log(FFZ);
				sendResponse(true);
				mergeEmotes();
				return;
			}
		}
    } catch(e) {
        console.error('Error handling Chrome message:', e);
    }
    sendResponse(false);
});

function authUrl() {
    sessionStorage.twitchOAuthState = nonce(15);
    var url = 'https://id.twitch.tv/oauth2/authorize' +
        '?response_type=token' +
        '&client_id=' + clientId + 
        '&redirect_uri=' + redirectURI +
        '&scope=' + scope +
        '&state=' + sessionStorage.twitchOAuthState + "@" + (username || "");
    
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


function parseMessage(rawMessage) {
  let parsedMessage = {
    tags: {},
    prefix: null,
    command: null,
    params: [],
    trailing: null
  };

  // Parse tags
  if (rawMessage.startsWith('@')) {
    const tagsEnd = rawMessage.indexOf(' ');
    const tagsPart = rawMessage.slice(1, tagsEnd);
    rawMessage = rawMessage.slice(tagsEnd + 1);
    
    tagsPart.split(';').forEach(tag => {
      const [key, value] = tag.split('=');
      parsedMessage.tags[key] = value || true;
    });
  }

  // Parse prefix
  if (rawMessage.startsWith(':')) {
    const prefixEnd = rawMessage.indexOf(' ');
    parsedMessage.prefix = rawMessage.slice(1, prefixEnd);
    rawMessage = rawMessage.slice(prefixEnd + 1);
  }

  // Parse command and params
  const parts = rawMessage.split(' ');
  parsedMessage.command = parts.shift().toUpperCase();

  // Parse trailing
  const trailingStart = rawMessage.indexOf(' :');
  if (trailingStart !== -1) {
    parsedMessage.trailing = rawMessage.slice(trailingStart + 2);
    parts.pop(); // Remove trailing from parts
  }

  parsedMessage.params = parts;

  return parsedMessage;
}

function sendMessage(message) {
	if (checkAuthStatus()){
		if (websocket.readyState === WebSocket.OPEN) {
			const command = `PRIVMSG #${channel} :${message}`;
			//console.log('Sending message:', command);
			websocket.send(command);
			return true;
		} else {
			console.error('WebSocket is not open.');
		}
	}
    return false;
}
function replaceEmotesWithImages(text) {
	if (!EMOTELIST) {
		return text;
	}
	
	return text.replace(/(?<=^|\s)(\S+?)(?=$|\s)/g, (match, emoteMatch) => {
		const emote = EMOTELIST[emoteMatch];
		if (emote) {
			const escapedMatch = escapeHtml(emoteMatch);
			const isZeroWidth = typeof emote !== "string" && emote.zw;
			return `<img src="${typeof emote === 'string' ? emote : emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="${isZeroWidth ? 'zero-width-emote-centered' : 'regular-emote'}"/>`;
		}
		return match;
	});
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

async function fetchWithTimeout(URL, timeout = 8000, headers=false) {
    try {
        const controller = new AbortController();
        const timeout_id = setTimeout(() => controller.abort(), timeout);
		if (!headers) {
			const response = await fetch(URL, {
				timeout: timeout,
				signal: controller.signal
			});
			clearTimeout(timeout_id);
			return response;
		} else {
			const response = await fetch(URL, {
				timeout: timeout,
				signal: controller.signal,
				headers: headers
			});
			clearTimeout(timeout_id);
			return response;
		}
        
    } catch (e) {
        console.error(e); // Changed from errorlog to console.error
        return await fetch(URL); // iOS 11.x/12.0
    }
}

var channels = {};
function getTwitchAvatarImage(usernome) {
	if (!usernome || channels[usernome]){return;}
	fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(usernome.replace("@",""))).then(response => {
		response.text().then(function(text) {
			if (text.startsWith("https://")) {
				channels[usernome] = text;
			}
		});
	}).catch(error => {
		//console.log("Couldn't get avatar image URL. API service down?");
	});
}


async function processMessage(parsedMessage) {
	const user = parsedMessage.prefix.split('!')[0];
	const message = parsedMessage.trailing;
	channel = parsedMessage.params[0] || channel;
	const userInfo = await getUserInfo(user);
	//console.log(`${user} in ${channel}: ${message}`);

	// Add the message to the UI
	var span = document.createElement("div");
	span.innerText = `${(userInfo ? userInfo.display_name : user)}: ${message}`;
	document.querySelector("#textarea").appendChild(span);
	if (document.querySelector("#textarea").childNodes.length > 10) {
		document.querySelector("#textarea").childNodes[0].remove();
	}

    var data = {};
    data.chatname = userInfo ? userInfo.display_name : user;
    data.chatbadges = parseBadges(parsedMessage, badges);
    data.backgroundColor = "";
    data.textColor = userInfo ? userInfo.color : "";
    data.chatmessage = replaceEmotesWithImages(message);

    try {
        data.chatimg = userInfo ? userInfo.profile_image_url : "https://api.socialstream.ninja/twitch/?username=" + encodeURIComponent(user);
    } catch (e) {
        data.chatimg = "";
    }
    data.hasDonation = "";
    data.membership = "";
    if (channel) {
        data.sourceImg = getTwitchAvatarImage(channel);
    }
    data.textonly = settings.textonlymode || false;
    data.type = "twitch";

    pushMessage(data);
}

function updateStats(type, data) {
	switch(type) {
		case 'viewer_update':
			document.getElementById('viewer-count').textContent = data.viewers;
			break;
		case 'follower_update':
			document.getElementById('follower-count').textContent = data.followerCount;
			addEvent(`New Follower: ${data.latestFollower.user_name}`);
			break;
		case 'new_subscriber':
			addEvent(`New Subscriber: ${data.user}`);
			break;
		case 'subscription_gift':
			addEvent(`${data.user} gifted ${data.total} subs!`);
			break;
		case 'cheer':
			addEvent(`${data.user} cheered ${data.bits} bits!`);
			break;
	}
}

function addEvent(text) {
	const eventslist = document.getElementById('events-list');
	const event = document.createElement('div');
	event.className = 'event-item';
	event.textContent = text;
	eventslist.insertBefore(event, eventslist.firstChild);
	
	// Keep only last 10 events
	while (eventslist.children.length > 10) {
		eventslist.removeChild(eventslist.lastChild);
	}
}

// Add channel connection handling
document.getElementById('connect-button').addEventListener('click', function() {
	const channelInput = document.getElementById('channel-input');
	const channelName = channelInput.value.trim();
	if (channelName) {
		// Store the channel name
		localStorage.setItem('twitchChannel', channelName);
		// Reconnect with new channel
		connect();
	}
});

function parseBadges(parsedMessage, badges) {
	//console.log(parsedMessage, badges);
	
    // This function needs to be implemented to parse the badges from the message
    // and match them with the badge info fetched earlier
    // For now, we'll return an empty string
    return "";
}

var settings = {};

function pushMessage(data) {
    try {
		
		if (data.type && data.type !== 'twitch') {
			updateStats(data.type, data);
		}
				
        // Send message to Chrome extension
        chrome.runtime.sendMessage(chrome.runtime.id, { 
            "message": data 
        }, function(response) {
            // Handle response if needed
        });
    } catch(e) {
        console.error('Error sending message to socialstream:', e);
    }
}

chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
	if ("settings" in response) {
		settings = response.settings;
		
		if (channel){
			if (settings.bttv && !BTTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, type:"twitch", channel:channel  }, function (response) {
					//	console.log(response);
				});
			}
			if (settings.seventv && !SEVENTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, type:"twitch", channel:channel  }, function (response) {
					//	console.log(response);
				});
			}
			if (settings.ffz && !FFZ) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, type:"twitch", channel:channel  }, function (response) {
					//	console.log(response);
				});
			}
		}
	}
	if ("state" in response) {
		isExtensionOn = response.state;
	}
	initializePage();
});

console.log("INJECTED WEBSOCKETS");


//////////////

// FOLLOWER EVENT STUFF

// Store the last known values
let lastKnownViewers = 0;
let lastKnownFollowers = 0;

// Function to fetch current viewer count
async function getViewerCount(channelName) {
    const token = getStoredToken();
    if (!token) return;
    
    try {
        const response = await fetchWithTimeout(
            `https://api.twitch.tv/helix/streams?user_login=${channelName}`,
            5000,
            {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        );
        
        const data = await response.json();
        if (data.data && data.data[0]) {
            const currentViewers = data.data[0].viewer_count;
            if (currentViewers !== lastKnownViewers) {
                lastKnownViewers = currentViewers;
                pushMessage({
					type: 'twitch',
                    event: 'viewer_update',
                    meta: currentViewers
                });
            }
        }
    } catch (error) {
        console.error('Error fetching viewer count:', error);
    }
}

// Function to fetch followers
async function getFollowers(broadcasterId) {
    const token = getStoredToken();
    if (!token) return;
    
    try {
        const response = await fetchWithTimeout(
            `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`,
            5000,
            {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        );
        
        const data = await response.json();
        if (data.total !== lastKnownFollowers) {
            lastKnownFollowers = data.total;
            if (data.data && data.data[0]) {
               // pushMessage({
				//	type: 'twitch',
              //      event: 'follower_update',
              //      meta: data.total,
              //      chatmessage: data.data[0] + " has started following"
              //  });
            }
        }
    } catch (error) {
        console.error('Error fetching followers:', error);
    }
}

let eventSocket;
let eventSessionId;

async function connectEventSub() {
    // Connect to Twitch EventSub WebSocket
    eventSocket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
    
    eventSocket.onopen = () => {
        console.log('EventSub WebSocket Connected');
    };
    
    eventSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.metadata.message_type) {
            case 'session_welcome':
                // Save the session ID - we need this for subscriptions
                eventSessionId = message.payload.session.id;
                console.log('EventSub session established:', eventSessionId);
                
                // Now that we have a session, create our subscriptions
                const channelInfo = await getUserInfo(channel);
                if (channelInfo) {
                    await createEventSubSubscriptions(channelInfo.id);
                }
                break;
                
            case 'notification':
                handleEventSubNotification(message.payload.event);
                break;
                
            case 'session_keepalive':
                // Optional: Log or handle keepalive
                break;
                
            case 'revocation':
                console.log('Subscription revoked:', message.payload);
                break;
        }
    };
    
    eventSocket.onerror = (error) => {
        console.error('EventSub WebSocket Error:', error);
    };
    
    eventSocket.onclose = () => {
        console.log('EventSub WebSocket Closed - Reconnecting in 5s...');
        setTimeout(connectEventSub, 5000);
    };
}


// Separate function to create all subscriptions
async function createEventSubSubscriptions(broadcasterId) {
    const token = getStoredToken();
    if (!token || !eventSessionId) {
        console.error("Missing token or session ID");
        return;
    }
    
    console.log("Creating subscriptions for broadcaster:", broadcasterId);
    console.log("Using session ID:", eventSessionId);
    
    // Let's try just one subscription first to debug
    const subscription = {
        type: 'channel.follow',
        version: '2',
        condition: {
            broadcaster_user_id: broadcasterId,
            moderator_user_id: broadcasterId
        },
        transport: {
            method: 'websocket',
            session_id: eventSessionId
        }
    };
    
    try {
        console.log("Sending subscription request:", subscription);
        
        const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
        });
        
        const data = await response.json();
        console.log("Subscription response:", data);
        
        if (!response.ok) {
            throw new Error(JSON.stringify(data));
        }
    } catch (error) {
        console.error(`Error creating subscription:`, error);
        
        // Let's check the token scopes
        try {
            const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${token}`
                }
            });
            const validateData = await validateResponse.json();
            console.log("Token validation data:", validateData);
        } catch (e) {
            console.error("Error validating token:", e);
        }
    }
}

// Function to handle EventSub notifications
function handleEventSubNotification(event) {
    switch (event.subscription.type) {
        case 'channel.follow':
            pushMessage({
				type: "twitch",
                event: 'new_follower',
				chatmessage: event.user_name + " has starting following",
                chatname: event.user_name,
                userid: event.user_id,
                timestamp: event.followed_at
            });
            break;
            
        case 'channel.subscribe':
            pushMessage({
				type: "twitch",
                event: 'new_subscriber',
				chatmessage: event.user_name + " has subscribed at tier " +event.tier,
                chatname: event.user_name,
                userid: event.user_id,
                tier: event.tier,
                isGift: event.is_gift
            });
            break;
            
        case 'channel.subscription.gift':
            pushMessage({
				type: "twitch",
                event: 'subscription_gift',
                chatname: event.user_name,
				chatmessage: event.user_name + " has gifted "+event.total+" tier "+event.tier+" subs!",
                userid: event.user_id,
                total: event.total,
                tier: event.tier
            });
            break;
            
        //case 'channel.cheer':
       //     pushMessage({
		//		type: "twitch",
       //         chatname: event.user_name,
        //        userid: event.user_id,
        //        bits: event.bits,
        //        chatmessage: event.message,
		//		hasDonation: event.bits+" bits"
        //    });
        //    break;
    }
}