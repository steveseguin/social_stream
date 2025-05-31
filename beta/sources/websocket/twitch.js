try{
	var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
	var redirectURI = window.location.href.split("/twitch")[0]+"/twitch.html"; //  'https://socialstream.ninja/sources/websocket/twitch.html';
	var scope = 'chat:read+chat:edit+channel:read:subscriptions+bits:read+moderator:read:followers+moderator:read:chatters';
	var ws;
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
		if (authElement) authElement.classList.remove("hidden");
		//document.querySelectorAll('.socket').forEach(ele=>ele.classList.add('hidden'))
	}
	function showSocketInterface() {
		const authElement = document.querySelector('.auth');
		document.querySelectorAll('.socket').forEach(ele=>ele.classList.remove('hidden'))
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

	async function verifyAndUseToken(token) {
		fetch('https://id.twitch.tv/oauth2/validate', {
			headers: {
				'Authorization': `OAuth ${token}`
			}
		})
		.then(response => response.json())
		.then(async data => {
			console.log("Token validation data:", data);
			if (data.login) {
				setStoredToken(token);
				username = data.login;
				localStorage.setItem("twitchChannel", channel);
				
				// Fetch user badges and store them
				const userInfo = await getUserInfo(data.login);
				if (userInfo) {
					console.log("userInfo");
					console.log(userInfo);
					// Fetch both available badges and user's specific badges
					let userBadgeString = '';
					if (channel.toLowerCase() === data.login.toLowerCase()) {
						userBadgeString = 'broadcaster/1';
					}
					localStorage.setItem('userBadges', userBadgeString);
					localStorage.setItem('userColor', userInfo.color || '');
				}
				
				updateHeaderInfo(data.login, channel);
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

	// Add new function to fetch user's specific badges
	async function fetchUserBadges(userId, token) {
		try {
			const response = await fetch(`https://api.twitch.tv/helix/chat/badges/user?user_id=${userId}`, {
				headers: {
					'Client-ID': clientId,
					'Authorization': `Bearer ${token}`
				}
			});

			if (!response.ok) {
				console.error('Failed to fetch user badges:', await response.text());
				return null;
			}

			const data = await response.json();
			return data.data.reduce((acc, badge) => {
				acc[badge.set_id] = badge.version;
				return acc;
			}, {});
		} catch (error) {
			console.error('Error fetching user badges:', error);
			return null;
		}
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
		
		if (!username){
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

	async function validateToken(token) {
		try {
			const response = await fetch('https://id.twitch.tv/oauth2/validate', {
				headers: {
					'Authorization': `OAuth ${token}`
				}
			});
			if (!response.ok) return null;
			return await response.json();
		} catch (error) {
			console.error('Token validation error:', error);
			return null;
		}
	}
	async function connect() {
		const token = getStoredToken();
		if (!token) {
			console.error('No token available');
			showAuthButton();
			return;
		}

		// Clean up existing connections
		await cleanupCurrentConnection();
		
		// Clean the channel name
		channel = channel.replace(/^#/, '');
		
		const channelInfo = await getUserInfo(channel);
		if (!channelInfo) {
			console.log('Failed to get channel info');
			return;
		}
		
		const authUser = await validateToken(token);
		if (!authUser) {
			clearStoredToken();
			showAuthButton();
			return;
		}

		// Fetch badges before setting up the chat connection
		const badgeData = await fetchBadges(channelInfo.id);
		if (badgeData) {
			globalBadges = badgeData.globalBadges;
			channelBadges = badgeData.channelBadges;
		} else {
			console.log('Failed to fetch badges');
			// Continue anyway, just won't show badges
		}

		// Set current channel ID
		currentChannelId = channelInfo.id;
		
		// Update header
		updateHeaderInfo(authUser.login, channel);

		try {
			const permissions = await checkUserPermissions(channelInfo.id, authUser.user_id);
			updateUIBasedOnPermissions(permissions);

			// Set up chat connection
			websocket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
			
			websocket.onopen = () => {
				console.log('Chat Connected');
				websocket.send(`PASS oauth:${token}`);
				websocket.send(`NICK ${username}`);
				websocket.send(`JOIN #${channel}`);
				websocket.send('CAP REQ :twitch.tv/commands');
				websocket.send('CAP REQ :twitch.tv/tags');
				
				const textarea = document.querySelector("#textarea");
				if (textarea) {
					var span = document.createElement("div");
					span.innerText = `Joined the channel: ${channel}`;
					textarea.appendChild(span);
					if (textarea.childNodes.length > 20) {
						textarea.childNodes[0].remove();
					}
				}
			};
			
			websocket.onmessage = (event) => handleWebSocketMessage(event, badges);
			websocket.onerror = (error) => !isDisconnecting && console.error('WebSocket error:', error);
			websocket.onclose = (event) => !isDisconnecting && handleWebSocketClose(event);

			// Only set up EventSub if we have permissions
			if (permissions && (permissions.canViewFollowers || permissions.isBroadcaster || permissions.isModerator)) {
				await connectEventSub();
				
				if (permissions.canViewFollowers) {
					getFollowers(channelInfo.id);
					getFollowersInterval = setInterval(() => getFollowers(channelInfo.id), 60000);
				}
			}
			console.log(channel);
			getViewerCount(channel);
			clearInterval(getViewerCountInterval);
			getViewerCountInterval = setInterval(() => getViewerCount(channel), 60000);
			
		} catch (error) {
			console.log('Error during connection setup:', error);
		}
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
			   // console.log('Unhandled command:', parsedMessage.command);
			  }
		  }
		}
	  });
	}

	async function checkChannelPermissions(token, userId, channelId) {
		try {
			// Check if user is broadcaster
			const isBroadcaster = userId === channelId;
			
			// Check if user is moderator
			const modResponse = await fetch(
				`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${channelId}&user_id=${userId}`,
				{
					headers: {
						'Authorization': `Bearer ${token}`,
						'Client-ID': clientId
					}
				}
			);
			const modData = await modResponse.json();
			const isModerator = modData.data.length > 0;
			
			// Check if channel has subscriber program
			const channelResponse = await fetch(
				`https://api.twitch.tv/helix/channels?broadcaster_id=${channelId}`,
				{
					headers: {
						'Authorization': `Bearer ${token}`,
						'Client-ID': clientId
					}
				}
			);
			const channelData = await channelResponse.json();
			const hasSubscriptionProgram = channelData.data[0]?.partner || channelData.data[0]?.affiliate;

			return {
				canViewSubscribers: isBroadcaster || isModerator,
				canViewFollowers: isBroadcaster || isModerator,
				canViewViewerCount: true, // Public information
				canSendMessages: true, // Basic chat permission
				hasSubscriptionProgram: hasSubscriptionProgram
			};
		} catch (error) {
			console.error('Error checking permissions:', error);
			return {
				canViewSubscribers: false,
				canViewFollowers: false,
				canViewViewerCount: true,
				canSendMessages: true,
				hasSubscriptionProgram: false
			};
		}
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
		localStorage.removeItem('twitchOAuthToken');
		localStorage.removeItem('twitchChannel');
		localStorage.removeItem('twitchUserAlias');
		sessionStorage.removeItem('twitchOAuthState');
		sessionStorage.removeItem('twitchOAuthToken');
		
		if (typeof websocket !== 'undefined' && websocket && websocket.readyState === WebSocket.OPEN) {
			websocket.close();
		}

		updateHeaderInfo(null, null);
		document.querySelectorAll('.socket').forEach(ele=>ele.classList.add('hidden'))
		document.querySelector('.auth').classList.remove('hidden');
		document.querySelector('#textarea').innerHTML = '';

		console.log('Signed out successfully');
	}

	function handleSendMessage(event) {
		event.preventDefault();
		const inputElement = document.querySelector('#input-text');
		if (inputElement) {
			var msg = inputElement.value.trim();
			if (msg) {
				if (sendMessage(msg)) {
					inputElement.value = "";
					let builtmsg = {};
					builtmsg.command = "PRIVMSG";
					builtmsg.params = [username];
					builtmsg.prefix = username+"!"+username+"@"+username+".tmi.twitch.tv";
					builtmsg.trailing = msg;
					
					// Get user's specific badges from localStorage
					const userBadges = localStorage.getItem('userBadges');
					builtmsg.tags = {
						badges: userBadges || '',
						color: localStorage.getItem('userColor') || ''
					};
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
			//console.log(BTTV);
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
			//console.log(SEVENTV);
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
			//console.log(FFZ);
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
			if ("getSource" == request){sendResponse("twitch");	return;	}
			if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
				document.querySelector('#sendmessage').focus();
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
	
	let globalBadges = null;
	let channelBadges = null;

	async function fetchBadges(channelId) {
		const token = getStoredToken();
		if (!token || !channelId) {
			//console.log('Missing token or channel ID for badge fetch');
			return null;
		}

		try {
			// Fetch global badges
			const globalResponse = await fetchWithTimeout(
				'https://api.twitch.tv/helix/chat/badges/global',
				5000,
				{
					'Client-ID': clientId,
					'Authorization': `Bearer ${token}`
				}
			);
			
			// Fetch channel-specific badges
			const channelResponse = await fetchWithTimeout(
				`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${channelId}`,
				5000,
				{
					'Client-ID': clientId,
					'Authorization': `Bearer ${token}`
				}
			);

			if (!globalResponse.ok) {
				console.error('Failed to fetch global badges:', await globalResponse.text());
				return null;
			}

			if (!channelResponse.ok) {
				console.error('Failed to fetch channel badges:', await channelResponse.text());
				return null;
			}

			const globalData = await globalResponse.json();
			const channelData = await channelResponse.json();

			// Process and store badges
			globalBadges = processBadgeData(globalData.data);
			channelBadges = processBadgeData(channelData.data);
			
			//console.log('Badges fetched successfully:', {
			//	globalBadgeCount: Object.keys(globalBadges).length,
			//	channelBadgeCount: Object.keys(channelBadges).length
			//});

			return {
				globalBadges,
				channelBadges
			};
		} catch (error) {
			console.error('Error fetching badges:', error);
			return null;
		}
	}

	
	function processBadgeData(badgeData) {
		if (!Array.isArray(badgeData)) {
			console.error('Invalid badge data format:', badgeData);
			return {};
		}

		const processedBadges = {};
		
		badgeData.forEach(badge => {
			if (!badge?.set_id || !Array.isArray(badge.versions)) return;

			processedBadges[badge.set_id] = {};
			badge.versions.forEach(version => {
				if (!version?.id) return;

				processedBadges[badge.set_id][version.id] = {
					image_url_1x: version.image_url_1x || '',
					image_url_2x: version.image_url_2x || '',
					image_url_4x: version.image_url_4x || '',
					title: version.title || '',
					description: version.description || ''
				};
			});
		});
		
		return processedBadges;
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
		try {
		//console.log("Processing message:", parsedMessage);
		const user = parsedMessage.prefix.split('!')[0];
		const message = parsedMessage.trailing;
		channel = parsedMessage.params[0] || channel;
		const userInfo = await getUserInfo(user); 

		// Add the message to the UI
		var span = document.createElement("div");
		span.innerText = `${(userInfo ? userInfo.display_name : user)}: ${message}`;
		document.querySelector("#textarea").appendChild(span);
		if (document.querySelector("#textarea").childNodes.length > 10) {
			document.querySelector("#textarea").childNodes[0].remove();
		}

		// Process badges before creating the data object
		const badgeHTML = parseBadges(parsedMessage);

		var data = {};
		data.chatname = userInfo ? userInfo.display_name : user;
		data.chatbadges = badgeHTML || "";  // Ensure badges are included
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
		} catch(e){
			console.error(e);
			
		}
		//console.log(data);
		pushMessage(data);
	}

	function updateStats(type, data) {
		switch(type) {
			case 'viewer_update':
				document.getElementById('viewer-count').textContent = data.meta;
				break;
			case 'follower_update':
				document.getElementById('follower-count').textContent = data.meta;
				//addEvent(`New Follower: ${data.latestFollower.chatname}`);
				break;
			case 'new_follower':
				addEvent(`New Follower: ${data.chatname}`);
				break;
			case 'new_subscriber':
				addEvent(`New Subscriber: ${data.chatname}`);
				break;
			case 'subscription_gift':
				addEvent(`${data.chatname} gifted ${data.total} subs!`);
				break;
			case 'cheer':
				addEvent(`${data.chatname} cheered ${data.hasDonation}!`);
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

	document.getElementById('connect-button').addEventListener('click', async function() {
		const channelInput = document.getElementById('channel-input');
		const channelName = channelInput.value.trim().replace(/^#/, '');
		if (channelName) {
			localStorage.setItem('twitchChannel', channelName);
			channel = channelName;
			channelInput.value = '';
			await connect();
		}
	});

	if (document.getElementById('channel-input')){
		document.getElementById('channel-input').addEventListener('keypress', async function(event) {
			// Check if the pressed key is Enter (key code 13)
			if (event.key === 'Enter' || event.keyCode === 13) {
				const channelInput = document.getElementById('channel-input');
				const channelName = channelInput.value.trim().replace(/^#/, '');
				if (channelName) {
					localStorage.setItem('twitchChannel', channelName);
					channel = channelName;
					channelInput.value = '';
					await connect();
				}
			}
		});
	}
	
	function parseBadges(parsedMessage) {
		// Early return if no valid badges data
		if (!parsedMessage?.tags?.badges || typeof parsedMessage.tags.badges !== 'string' || !globalBadges || !channelBadges) {
			return "";
		}

		// Skip empty badge strings
		if (parsedMessage.tags.badges.trim() === '') {
			return "";
		}

		try {
			const badges = parsedMessage.tags.badges.split(',');
			let badgeList = [];

			badges.forEach(badge => {
				// Skip empty badge entries
				if (!badge || badge.trim() === '') return;

				const [badgeType, badgeVersion] = badge.split('/');
				if (!badgeType || !badgeVersion) return;

				// Check channel badges first, then fall back to global badges
				const badgeData = (channelBadges?.[badgeType]?.[badgeVersion]) || 
								(globalBadges?.[badgeType]?.[badgeVersion]);
				
				if (badgeData) {
					badgeList.push(badgeData.image_url_2x);
				}
			});

			return badgeList;
		} catch (error) {
			console.error('Error parsing badges:', error);
			return "";
		}
	}

	function getBadgesFromTags(tags) {
		if (!tags || typeof tags !== 'object') return null;
		
		// If badges is a string, return it directly
		if (typeof tags.badges === 'string') return tags.badges;
		
		// If badges-raw exists (some IRC clients use this), use it instead
		if (typeof tags['badges-raw'] === 'string') return tags['badges-raw'];
		
		return null;
	}

	var settings = {};

	function pushMessage(data) {
		try {
			
			if (data.type && data.event) {
				updateStats(data.event, data);
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
		if (!response){return;}
		
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
	let lastKnownViewers = null;
	let lastKnownFollowers = null;

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
			console.log(data);
			if (data.data && data.data[0]) {
				const currentViewers = data.data[0].viewer_count;
				if (currentViewers !== lastKnownViewers) {
					lastKnownViewers = currentViewers;
					console.log({
						type: 'twitch',
						event: 'viewer_update',
						meta: lastKnownViewers
					});
					pushMessage({
						type: 'twitch',
						event: 'viewer_update',
						meta: lastKnownViewers
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
					pushMessage({
						type: 'twitch',
						event: 'follower_update',
						meta: data.total
						//chatmessage: data.data[0] + " has started following"
					});
				}
			}
		} catch (error) {
			console.error('Error fetching followers:', error);
		}
	}

	let eventSocket;
	let eventSessionId;
	let isDisconnecting = false;
	let reconnectTimeout = null;
	let currentChannelId = null;
	let activeSubscriptions = new Set();
	let eventSubRetryCount = 0;
	let MAX_RETRY_ATTEMPTS = 2;
	let hasPermissionError = [];

	async function cleanupCurrentConnection() {
		isDisconnecting = true;
		
		// Clear any existing timeouts
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}

		// Clear intervals
		if (getViewerCountInterval) {
			clearInterval(getViewerCountInterval);
			getViewerCountInterval = null;
		}
		if (getFollowersInterval) {
			clearInterval(getFollowersInterval);
			getFollowersInterval = null;
		}

		// Close WebSocket connections
		if (websocket) {
			if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
				websocket.close();
			}
			websocket = null;
		}
		
		if (eventSocket) {
			if (eventSocket.readyState === WebSocket.OPEN || eventSocket.readyState === WebSocket.CONNECTING) {
				eventSocket.close();
			}
			eventSocket = null;
		}

		// Reset states
		eventSubRetryCount = 0;
		hasPermissionError = [];
		activeSubscriptions.clear();
		currentChannelId = null;
		lastKnownViewers = null;
		lastKnownFollowers = null;
		
		document.getElementById('viewer-count').textContent = "-";
		document.getElementById('follower-count').textContent = "-";
		document.getElementById('permissions-info').innerHTML = "";
		
		// Wait a moment for connections to fully close
		await new Promise(resolve => setTimeout(resolve, 1000));
		isDisconnecting = false;
	}

	async function connectEventSub() {
		if (isDisconnecting || hasPermissionError.length) return;
		
		if (eventSocket && (eventSocket.readyState === WebSocket.OPEN || eventSocket.readyState === WebSocket.CONNECTING)) {
			return;
		}

		eventSocket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
		
		eventSocket.onopen = () => {
			console.log('EventSub WebSocket Connected');
		}; 
		
		eventSocket.onmessage = async (event) => {
			if (isDisconnecting) return;
			
			const message = JSON.parse(event.data);
			
			switch (message.metadata.message_type) {
				case 'session_welcome':
					eventSessionId = message.payload.session.id;
					console.log('EventSub session established:', eventSessionId);
					
					if (currentChannelId) {
						await createEventSubSubscriptions(currentChannelId);
					}
					break;
					
				case 'notification':
					handleEventSubNotification(message.payload);
					break;
					
				case 'session_keepalive':
					break;
					
				case 'session_reconnect':
					if (!isDisconnecting) {
						const reconnectUrl = message.payload.session.reconnect_url;
						await cleanupCurrentConnection();
						eventSocket = new WebSocket(reconnectUrl);
					}
					break;
			}
		};
		
		eventSocket.onerror = (error) => {
			if (!isDisconnecting) {
				console.error('EventSub WebSocket Error:', error);
			}
		};
		
		eventSocket.onclose = () => {
			if (isDisconnecting) return;
			
			if (!hasPermissionError.length && eventSubRetryCount < MAX_RETRY_ATTEMPTS) {
				console.log(`EventSub WebSocket Closed - Retry attempt ${eventSubRetryCount + 1} of ${MAX_RETRY_ATTEMPTS}`);
				eventSubRetryCount++;
				reconnectTimeout = setTimeout(connectEventSub, 5000);
			} else if (hasPermissionError.length) {
				console.log('EventSub connection stopped: Permission errors detected');
			}
		};
	}

	async function createEventSubSubscriptions(broadcasterId) {
		if (broadcasterId !== currentChannelId) {
			console.log('Channel changed, skipping subscription creation');
			return;
		}

		const token = getStoredToken();
		if (!token || !eventSessionId) {
			console.error("Missing token or session ID");
			return;
		}

		try {
			// Get user permissions for the channel
			const authUser = await validateToken(token);
			if (!authUser) return;

			const permissions = await checkUserPermissions(broadcasterId, authUser.user_id);
			
			// Define subscriptions based on permissions
			const subscriptionTypes = [];
			
			if (permissions.canViewFollowers && !activeSubscriptions.has('channel.follow')) {
				subscriptionTypes.push({
					type: 'channel.follow',
					version: '2',
					condition: {
						broadcaster_user_id: broadcasterId,
						moderator_user_id: broadcasterId
					}
				});
			}

			if (permissions.canViewSubscribers && permissions.hasSubscriptionProgram) {
				if (!activeSubscriptions.has('channel.subscribe')) {
					subscriptionTypes.push({
						type: 'channel.subscribe',
						version: '1',
						condition: {
							broadcaster_user_id: broadcasterId
						}
					});
				}
				if (!activeSubscriptions.has('channel.subscription.gift')) {
					subscriptionTypes.push({
						type: 'channel.subscription.gift',
						version: '1',
						condition: {
							broadcaster_user_id: broadcasterId
						}
					});
				}
			}

			if ((permissions.isBroadcaster || permissions.isModerator) && !activeSubscriptions.has('channel.cheer')) {
				subscriptionTypes.push({
					type: 'channel.cheer',
					version: '1',
					condition: {
						broadcaster_user_id: broadcasterId
					}
				});
			}

			// Create each subscription
			for (const subscription of subscriptionTypes) {
				if (hasPermissionError.includes(subscription)) { // previously failed permissions that got us kicked
					console.log("Skipping "+subscription);
					continue;
				}
				try {
					const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
						method: 'POST',
						headers: {
							'Client-ID': clientId,
							'Authorization': `Bearer ${token}`,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							...subscription,
							transport: {
								method: 'websocket',
								session_id: eventSessionId
							}
						})
					});

					const data = await response.json();
					
					if (response.status === 409) {
						// Subscription already exists, mark it as active
						activeSubscriptions.add(subscription.type);
						continue;
					}
					
					if (!response.ok) {
						if (response.status === 403) {
							hasPermissionError.push(subscription);
						}
						console.log(`Subscription failed for ${subscription.type}: ${data.message}`);
						continue;
					}
					
					activeSubscriptions.add(subscription.type);
					console.log(`Successfully subscribed to ${subscription.type}`);
				} catch (error) {
					console.error(`Error creating subscription for ${subscription.type}:`, error);
				}
			}
		} catch (error) {
			console.error('Error in createEventSubSubscriptions:', error);
		}
	}

	function handleEventSubNotification(payload) {
		const event = payload.event;
		const subscription = payload.subscription;

		switch (subscription.type) {
			case 'channel.follow':
				pushMessage({
					type: "twitch",
					event: 'new_follower',
					chatmessage: `${event.user_name} has started following`,
					chatname: event.user_name,
					userid: event.user_id,
					timestamp: event.followed_at
				});
				break;

			case 'channel.subscribe':
				pushMessage({
					type: "twitch",
					event: 'new_subscriber',
					chatmessage: `${event.user_name} has subscribed at tier ${event.tier}`,
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
					chatmessage: `${event.user_name} has gifted ${event.total} tier ${event.tier} subs!`,
					userid: event.user_id,
					total: event.total,
					tier: event.tier
				});
				break;

			case 'channel.cheer':
				pushMessage({
					type: "twitch", 
					event: 'cheer',
					chatname: event.user_name || 'Anonymous',
					userid: event.user_id,
					bits: event.bits,
					chatmessage: event.message,
					hasDonation: event.bits + " bits"
				});
				break;
			case 'channel.channel_points_custom_reward_redemption.add':
				const rewardTitle = data.reward.title;
				const rewardCost = data.reward.cost;
				const userInput = data.user_input || '';
				
				let rewardMessage = `${data.user_name} redeemed ${rewardTitle} (${rewardCost} points)`;
				if (userInput) {
					rewardMessage += `: ${userInput}`;
				}

				pushMessage({
					type: "twitch",
					event: 'channel_points',
					chatname: data.user_name,
					userid: data.user_id,
					chatmessage: rewardMessage,
					reward: {
						id: data.reward.id,
						title: rewardTitle,
						cost: rewardCost,
						prompt: data.reward.prompt,
						userInput: userInput,
						backgroundColor: data.reward.background_color,
						redemptionId: data.id,
						status: data.status
					},
					timestamp: data.redeemed_at
				});
				
				// Add to recent events
				addEvent(`Channel Points: ${data.user_name} redeemed ${rewardTitle}`);
				break;
		}
	}


	async function getModeratorStatus(broadcasterId, userId) {
		const token = getStoredToken();
		if (!token) return false;
		
		try {
			const response = await fetch(
				`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${broadcasterId}&user_id=${userId}`,
				{
					headers: {
						'Client-ID': clientId,
						'Authorization': `Bearer ${token}`
					}
				}
			);
			
			if (!response.ok) return false;
			const data = await response.json();
			return data.data.length > 0;
		} catch (error) {
			console.error('Error checking moderator status:', error);
			return false;
		}
	}

	async function getBroadcasterStatus(broadcasterId) {
		const token = getStoredToken();
		if (!token) return null;
		
		try {
			const response = await fetch(
				`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`,
				{
					headers: {
						'Client-ID': clientId,
						'Authorization': `Bearer ${token}`
					}
				}
			);
			
			if (!response.ok) return null;
			const data = await response.json();
			return data.data[0];
		} catch (error) {
			console.error('Error checking broadcaster status:', error);
			return null;
		}
	}

	async function checkUserPermissions(channelId, userId) {
		const isBroadcaster = channelId === userId;
		const isModerator = await getModeratorStatus(channelId, userId);
		const broadcasterInfo = await getBroadcasterStatus(channelId);
		
		return {
			isBroadcaster,
			isModerator,
			canViewFollowers: true, // Followers are public info
			canManageChat: isBroadcaster || isModerator,
			canBanUsers: isBroadcaster || isModerator,
			canDeleteMessages: isBroadcaster || isModerator,
			canViewSubscribers: isBroadcaster || isModerator,
			hasSubscriptionProgram: broadcasterInfo?.partner || broadcasterInfo?.broadcaster_type === 'affiliate',
			canModerate: isBroadcaster || isModerator,
			broadcasterType: broadcasterInfo?.broadcaster_type || 'none'
		};
	}

	function updateUIBasedOnPermissions(permissions) {
		// Update UI elements based on permissions
		const elements = {
			subscriberCount: document.getElementById('subscriber-count')?.parentElement,
			followerCount: document.getElementById('follower-count')?.parentElement,
			chatInput: document.querySelector('.chat-input'),
			moderationControls: document.querySelector('.moderation-controls'),
			permissionsInfo: document.getElementById('permissions-info') || createPermissionsInfo()
		};

		// Update subscriber count visibility
		if (elements.subscriberCount) {
			elements.subscriberCount.style.display = 
				(permissions.canViewSubscribers && permissions.hasSubscriptionProgram) ? 'block' : 'none';
		}

		// Update moderation controls visibility
		if (elements.moderationControls) {
			elements.moderationControls.style.display = permissions.canModerate ? 'block' : 'none';
		}

		// Update permissions info display
		updatePermissionsDisplay(permissions, elements.permissionsInfo);
	}

	function createPermissionsInfo() {
		const container = document.createElement('div');
		container.id = 'permissions-info';
		container.className = 'permissions-container';
		document.querySelector('.stats-container').appendChild(container);
		return container;
	}

	function updatePermissionsDisplay(permissions, container) {
		const permissionsList = [
			{ name: 'Channel Role', value: permissions.isBroadcaster ? 'Broadcaster' : permissions.isModerator ? 'Moderator' : 'Viewer' },
			{ name: 'Can Moderate Chat', value: permissions.canModerate ? '✓' : '✗' },
			{ name: 'Can Ban Users', value: permissions.canBanUsers ? '✓' : '✗' },
			{ name: 'Can Delete Messages', value: permissions.canDeleteMessages ? '✓' : '✗' },
			{ name: 'Can View Subscribers', value: permissions.canViewSubscribers ? '✓' : '✗' },
			{ name: 'Channel Type', value: permissions.broadcasterType === 'none' ? 'Regular' : permissions.broadcasterType }
		];

		container.innerHTML = `
			<div class="permissions-header">Channel Permissions</div>
			<div class="permissions-grid">
				${permissionsList.map(perm => `
					<div class="permission-item">
						<span class="permission-name">${perm.name}:</span>
						<span class="permission-value ${perm.value === '✓' ? 'yes' : perm.value === '✗' ? 'no' : ''}">${perm.value}</span>
					</div>
				`).join('')}
			</div>
		`;
	}

	function updateHeaderInfo(username, channelName) {
		const currentUserElement = document.getElementById('current-user');
		const currentChannelElement = document.getElementById('current-channel');
		
		if (currentUserElement) {
			currentUserElement.textContent = username || 'Not signed in';
		}
		if (currentChannelElement) {
			currentChannelElement.textContent = channelName || 'No channel';
		}
	}
} catch(e){
	console.error(e);
}