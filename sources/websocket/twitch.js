const TWITCH_CORE_EXTENSION_PATH = 'providers/twitch/chatClient.js';
const TWITCH_CORE_RELATIVE_PATH = '../../providers/twitch/chatClient.js';
const SCRIPT_LOADER_EXTENSION_PATH = 'shared/utils/scriptLoader.js';
const SCRIPT_LOADER_RELATIVE_PATH = '../../shared/utils/scriptLoader.js';
const TWITCH_EMOTE_UTILS_EXTENSION_PATH = 'shared/utils/twitchEmotes.js';
const TWITCH_EMOTE_UTILS_RELATIVE_PATH = '../../shared/utils/twitchEmotes.js';

let createTwitchChatClient;
let createTmiClientFactory;
let TWITCH_CHAT_EVENTS;
let TWITCH_CHAT_STATUS;
let loadScriptSequential;
let renderTwitchNativeEmotes;
let parseTwitchEmotes;
let stringifyTwitchEmotes;

async function importWithFallback(extensionPath, relativePath) {
  if (
    typeof chrome !== 'undefined' &&
    chrome?.runtime &&
    typeof chrome.runtime.getURL === 'function'
  ) {
    try {
      const specifier = chrome.runtime.getURL(extensionPath);
      return await import(specifier);
    } catch (error) {
      console.warn(`Failed to import ${extensionPath} via chrome.runtime.getURL`, error);
    }
  }
  return import(relativePath);
}

const modulesReady = (async () => {
  const twitchModule = await importWithFallback(
    TWITCH_CORE_EXTENSION_PATH,
    TWITCH_CORE_RELATIVE_PATH
  );
  const utilsModule = await importWithFallback(
    SCRIPT_LOADER_EXTENSION_PATH,
    SCRIPT_LOADER_RELATIVE_PATH
  );
  const twitchEmoteModule = await importWithFallback(
    TWITCH_EMOTE_UTILS_EXTENSION_PATH,
    TWITCH_EMOTE_UTILS_RELATIVE_PATH
  );
  ({
    createTwitchChatClient,
    createTmiClientFactory,
    TWITCH_CHAT_EVENTS,
    TWITCH_CHAT_STATUS
  } = twitchModule);
  ({ loadScriptSequential } = utilsModule);
  ({
    renderTwitchNativeEmotes,
    parseTwitchEmotes,
    stringifyTwitchEmotes
  } = twitchEmoteModule);
})();

modulesReady.catch((error) => {
  console.error('Failed to load Twitch shared modules', error);
});

const TMI_MODULE_EXTENSION_PATH = 'shared/vendor/tmi.module.js';
const TMI_MODULE_RELATIVE_PATH = '../../shared/vendor/tmi.module.js';
const TMI_SCRIPT_EXTENSION_PATH = 'shared/vendor/tmi.js';
const TMI_SCRIPT_RELATIVE_PATH = '../../shared/vendor/tmi.js';

function isExtensionRuntime() {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome?.runtime &&
    typeof chrome.runtime.getURL === 'function'
  );
}

function resolveAssetUrl(path) {
  if (!path) {
    return null;
  }
  try {
    if (typeof document !== 'undefined' && typeof document.baseURI === 'string') {
      return new URL(path, document.baseURI).href;
    }
  } catch (error) {
    console.warn('Failed to resolve asset URL relative to document.baseURI', error);
  }
  return path;
}

function shouldUseDocumentRelativeSharedAssets() {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return true;
  }
  const { protocol, host } = window.location;
  if (protocol === 'file:') {
    return true;
  }
  return /(?:localhost(?::\d+)?|(?:^|\.)socialstream\.ninja)$/i.test(host || '');
}

function clearGlobalTmi() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    delete window.tmi;
  } catch (error) {
    window.tmi = undefined;
  }
}

function resolveTmiModuleSpecifiers() {
  const specifiers = [];
  if (isExtensionRuntime()) {
    try {
      specifiers.push(chrome.runtime.getURL(TMI_MODULE_EXTENSION_PATH));
    } catch (error) {
      console.warn('Failed to resolve tmi module via chrome.runtime.getURL', error);
    }
  }
  if (!isExtensionRuntime() || shouldUseDocumentRelativeSharedAssets()) {
    const resolvedRelative = resolveAssetUrl(TMI_MODULE_RELATIVE_PATH);
    if (resolvedRelative && resolvedRelative !== TMI_MODULE_RELATIVE_PATH) {
      specifiers.push(resolvedRelative);
    }
    specifiers.push(TMI_MODULE_RELATIVE_PATH);
  }
  return Array.from(
    specifiers.filter(Boolean).reduce((set, entry) => {
      set.add(entry);
      return set;
    }, new Set())
  );
}

function resolveTmiScriptSources() {
  const sources = [];
  if (isExtensionRuntime()) {
    try {
      sources.push(chrome.runtime.getURL(TMI_SCRIPT_EXTENSION_PATH));
    } catch (error) {
      console.warn('Failed to resolve tmi.js via chrome.runtime.getURL', error);
    }
  }
  if (!isExtensionRuntime() || shouldUseDocumentRelativeSharedAssets()) {
    sources.push(TMI_SCRIPT_RELATIVE_PATH);
    const resolvedRelative = resolveAssetUrl(TMI_SCRIPT_RELATIVE_PATH);
    if (resolvedRelative && resolvedRelative !== TMI_SCRIPT_RELATIVE_PATH) {
      sources.push(resolvedRelative);
    }
  }
  return Array.from(
    sources.filter(Boolean).reduce((set, entry) => {
      set.add(entry);
      return set;
    }, new Set())
  );
}

function fallbackStringifyParsedEmotes(parsed) {
  if (!Array.isArray(parsed) || !parsed.length) {
    return '';
  }
  return parsed
    .map(({ id, positions }) => {
      if (!Array.isArray(positions) || !positions.length) {
        return null;
      }
      const serialized = positions
        .map((entry) => {
          if (!entry) {
            return null;
          }
          const start = Number.parseInt(entry.start ?? entry[0], 10);
          const end = Number.parseInt(entry.end ?? entry[1], 10);
          if (!Number.isFinite(start) || !Number.isFinite(end)) {
            return null;
          }
          const safeStart = Math.max(0, start);
          const safeEnd = Math.max(safeStart, end);
          return `${safeStart}-${safeEnd}`;
        })
        .filter(Boolean)
        .join(',');
      if (!serialized) {
        return null;
      }
      return `${id}:${serialized}`;
    })
    .filter(Boolean)
    .join('/');
}

function serializeTwitchEmotesForLegacy(emotes) {
  if (!emotes) {
    return '';
  }
  if (typeof emotes === 'string') {
    return emotes;
  }
  if (typeof stringifyTwitchEmotes === 'function') {
    const serialized = stringifyTwitchEmotes(emotes);
    if (serialized) {
      return serialized;
    }
  }
  const parsed =
    typeof parseTwitchEmotes === 'function' ? parseTwitchEmotes(emotes) : [];
  if (!parsed.length) {
    return '';
  }
  return fallbackStringifyParsedEmotes(parsed);
}

async function evaluateScriptAtUrl(url) {
  const targetUrl = resolveAssetUrl(url);
  if (!targetUrl) {
    throw new Error('Invalid tmi.js source path');
  }

  try {
    await loadScriptSequential([targetUrl], { timeout: 20000 });
  } catch (error) {
    const message =
      error && typeof error.message === 'string' ? error.message : String(error || '');
    throw new Error(`Failed to load tmi.js from ${targetUrl}: ${message}`);
  }
  return targetUrl;
}

async function importTmiModule(specifier) {
  if (!specifier) {
    return null;
  }
  try {
    const module = await import(specifier);
    const library =
      (module?.default && typeof module.default.Client === 'function' && module.default) ||
      (module && typeof module.Client === 'function' && module);
    if (library?.Client) {
      if (typeof window !== 'undefined') {
        window.tmi = library;
      }
      return library;
    }
    console.warn(`tmi module at ${specifier} did not expose a Client constructor.`);
  } catch (error) {
    console.warn(`Failed to import tmi module from ${specifier}`, error);
  }
  return null;
}

async function tryLoadTmiViaModule() {
  for (const specifier of TMI_MODULE_SPECIFIERS) {
    const library = await importTmiModule(specifier);
    if (library?.Client) {
      console.debug('Loaded tmi.js via module import', specifier);
      return library;
    }
    clearGlobalTmi();
  }
  return null;
}

const TMI_MODULE_SPECIFIERS = resolveTmiModuleSpecifiers();
const TMI_SCRIPT_SOURCES = resolveTmiScriptSources();

let tmiLoaderPromise = null;
let chatClient = null;
let chatClientOffHandlers = [];
let tmiClientFactory = null;
const WEBSOCKET_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};
const websocketProxy = {
  readyState: 3,
  close: () => {
    if (chatClient) {
      chatClient.disconnect();
    }
  },
  send: (rawMessage) => {
    if (!chatClient || !rawMessage) {
      return;
    }
    try {
      if (typeof rawMessage === 'string') {
        const colonIndex = rawMessage.indexOf(' :');
        const payload = colonIndex >= 0 ? rawMessage.slice(colonIndex + 2) : rawMessage;
        chatClient.sendMessage(payload, channel).catch((err) => {
          console.warn('Twitch chat proxy send failed', err);
        });
      }
    } catch (err) {
      console.warn('Twitch chat proxy send error', err);
    }
  }
};

function setWebsocketReadyState(state) {
  websocketProxy.readyState = state;
}

try{
	window.websocket = websocketProxy;
	var isExtensionOn = true;
	var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
	var redirectURI = window.location.href.split("/twitch")[0]+"/twitch.html"; //  'https://socialstream.ninja/sources/websocket/twitch.html';
	var scope = [
		'chat:read',
		'chat:edit',
		'bits:read',
		'moderator:read:followers',
		'moderator:read:chatters',
		'channel:read:subscriptions',
		// New scopes for moderation, ads, and redemptions
		'moderator:manage:banned_users',
		'moderator:manage:chat_messages',
		'channel:read:ads',
		'channel:manage:ads',
		'channel:read:redemptions'
	].join('+');
	var channel = '';
	var username = "SocialStreamNinja"; // Not supported at the moment
	var BTTV = false;
	var SEVENTV = false;
	var FFZ = false;
	var EMOTELIST = false;
	var settings = {};
	function getTranslation(key, value = '') {
		try {
			if (settings.translation && settings.translation.innerHTML && key in settings.translation.innerHTML) {
				return settings.translation.innerHTML[key];
			}
			if (settings.translation && settings.translation.miscellaneous && key in settings.translation.miscellaneous) {
				return settings.translation.miscellaneous[key];
			}
		} catch (e) {
			console.warn('Translation lookup failed:', e);
		}
		if (value !== undefined && value !== null && value !== '') {
			return value;
		}
		return key.replaceAll('-', ' ');
	}


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
	
	let tokenExpirationHandled = false;
	function handleTokenExpiration() {
		// Prevent multiple simultaneous expiration handlers
		if (tokenExpirationHandled) return;
		tokenExpirationHandled = true;
		
		console.log('Token expired - clearing credentials and prompting for re-authentication');
		
		// Clear stored credentials
		clearStoredToken();
		localStorage.removeItem('twitchUserAlias');
		sessionStorage.removeItem('twitchOAuthState');
		sessionStorage.removeItem('twitchOAuthToken');
		
		// Clean up connections
		if (chatClient) {
			try {
				chatClient.disconnect();
			} catch (err) {
				console.warn('Failed to disconnect Twitch chat client on token expiration', err);
			}
			setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
		}
		if (eventSocket && eventSocket.readyState === WebSocket.OPEN) {
			eventSocket.close();
		}
		
		// Update UI
		updateHeaderInfo(null, null);
		document.querySelectorAll('.socket').forEach(ele => ele.classList.add('hidden'));
		document.querySelector('.auth').classList.remove('hidden');
		
		// Show notification
		const textarea = document.querySelector("#textarea");
		if (textarea) {
			textarea.innerHTML = '<div style="color: red; font-weight: bold;">Authentication expired. Please sign in again.</div>';
		}
		
		// Reset flag after a delay
		setTimeout(() => {
			tokenExpirationHandled = false;
		}, 5000);
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
			sendButton.onclick = (event) => {
				handleSendMessage(event).catch((err) => console.error('Twitch send button handler failed', err));
			};
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
let getSubscribersInterval = null;
let tokenValidationInterval = null;
let badges = null;

	async function ensureTmiClient() {
		try {
			if (window.tmi?.Client) {
				return window.tmi;
			}
			if (!tmiLoaderPromise) {
				tmiLoaderPromise = (async () => {
					const moduleLibrary = await tryLoadTmiViaModule();
					if (moduleLibrary?.Client) {
						return moduleLibrary;
					}
					let lastError = null;
					for (const source of TMI_SCRIPT_SOURCES) {
						try {
							const loadedFrom = await evaluateScriptAtUrl(source);
							if (window.tmi?.Client) {
								console.debug('Loaded tmi.js from source', loadedFrom);
								return window.tmi;
							}
							lastError = new Error(
								`tmi.js loaded from ${loadedFrom} but Twitch client constructor is unavailable.`
							);
							clearGlobalTmi();
						} catch (error) {
							lastError = error;
							clearGlobalTmi();
						}
					}
					throw lastError || new Error('Unable to load tmi.js from available sources.');
				})().catch((err) => {
					tmiLoaderPromise = null;
					throw err;
				});
			}
			const library = await tmiLoaderPromise;
			if (!library || typeof library.Client !== 'function') {
				throw new Error('tmi.js loaded but Twitch client is unavailable.');
			}
			return library;
		} catch (error) {
			console.error('Failed to load tmi.js library', error);
			throw error;
		}
	}

function ensureClientFactory() {
	if (!tmiClientFactory) {
		tmiClientFactory = createTmiClientFactory(() => ensureTmiClient());
	}
	return tmiClientFactory;
}

function resetChatClientHandlers() {
	if (Array.isArray(chatClientOffHandlers) && chatClientOffHandlers.length) {
		chatClientOffHandlers.forEach((off) => {
			try {
				off();
			} catch (err) {
				console.warn('Failed to remove Twitch chat listener', err);
			}
		});
	}
	chatClientOffHandlers = [];
}

async function ensureChatClientInstance() {
	if (!chatClient) {
		await modulesReady;
		chatClient = createTwitchChatClient({
			logger: console
		});
		resetChatClientHandlers();
		const add = (event, handler) => {
			const off = chatClient.on(event, handler);
			chatClientOffHandlers.push(off);
		};

		add(TWITCH_CHAT_EVENTS.STATUS, handleChatStatusEvent);
		add(TWITCH_CHAT_EVENTS.MESSAGE, (payload) => {
			handleNormalizedChatMessage(payload).catch((err) => {
				console.error('Twitch normalized chat handler failed', err);
			});
		});
		add(TWITCH_CHAT_EVENTS.MEMBERSHIP, (payload) => {
			handleNormalizedMembership(payload).catch((err) => {
				console.error('Twitch membership handler failed', err);
			});
		});
		add(TWITCH_CHAT_EVENTS.RAID, (payload) => {
			handleNormalizedRaid(payload).catch((err) => {
				console.error('Twitch raid handler failed', err);
			});
		});
		add(TWITCH_CHAT_EVENTS.NOTICE, (payload) => handleNormalizedNotice(payload));
		add(TWITCH_CHAT_EVENTS.CLEAR_CHAT, (payload) => handleNormalizedClear(payload));
		add(TWITCH_CHAT_EVENTS.WHISPER, (payload) => handleNormalizedWhisper(payload));
		add(TWITCH_CHAT_EVENTS.ERROR, (error) => handleNormalizedError(error));
	}
	return chatClient;
}

	async function validateToken(token) {
		try {
			const response = await fetch('https://id.twitch.tv/oauth2/validate', {
				headers: {
					'Authorization': `OAuth ${token}`
				}
			});
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					handleTokenExpiration();
				}
				return null;
			}
			const data = await response.json();
			
			// Update auth status indicator
			const authStatus = document.getElementById('auth-status');
			if (authStatus) {
				if (data.expires_in && data.expires_in < 3600) {
					// Token expires soon
					authStatus.innerHTML = `⚠️ <span style="color: orange; font-size: 12px;">Expires in ${Math.floor(data.expires_in / 60)}m</span>`;
					authStatus.title = `Authentication expires in ${Math.floor(data.expires_in / 60)} minutes`;
				} else if (data.expires_in) {
					// Token is valid
					authStatus.innerHTML = `✅ <span style="color: green; font-size: 12px;">Valid</span>`;
					authStatus.title = `Authentication valid for ${Math.floor(data.expires_in / 3600)} hours`;
				}
			}
			
			// Check if token will expire soon (within 1 hour)
			if (data.expires_in && data.expires_in < 3600) {
				console.warn(`Token expires in ${Math.floor(data.expires_in / 60)} minutes`);
				// Show warning in UI
				const textarea = document.querySelector("#textarea");
				if (textarea && !document.querySelector('.token-expiry-warning')) {
					const warning = document.createElement("div");
					warning.className = 'token-expiry-warning';
					warning.style.cssText = 'color: orange; font-weight: bold; padding: 5px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; margin: 5px 0;';
					warning.innerHTML = `⚠️ Authentication expires in ${Math.floor(data.expires_in / 60)} minutes. Please re-authenticate soon.`;
					textarea.insertBefore(warning, textarea.firstChild);
				}
			}
			
			return data;
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

		await modulesReady;
		await cleanupCurrentConnection();

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

		username = authUser.login || username;

		const badgeData = await fetchBadges(channelInfo.id);
		if (badgeData) {
			globalBadges = badgeData.globalBadges;
			channelBadges = badgeData.channelBadges;
		} else {
			console.log('Failed to fetch badges');
		}

		currentChannelId = channelInfo.id;
		updateHeaderInfo(authUser.login, channel);

		try {
			const permissions = await checkUserPermissions(channelInfo.id, authUser.user_id);
			updateUIBasedOnPermissions(permissions);

			const chat = await ensureChatClientInstance();
			const clientFactory = ensureClientFactory();

			setWebsocketReadyState(WEBSOCKET_READY_STATE.CONNECTING);

			await chat.connect({
				channel,
				credentials: {
					token,
					identity: {
						login: authUser.login,
						userId: authUser.user_id
					}
				},
				clientFactory
			});

			setWebsocketReadyState(WEBSOCKET_READY_STATE.OPEN);
			showSocketInterface();

			if (permissions && (permissions.canViewFollowers || permissions.isBroadcaster || permissions.isModerator)) {
				await connectEventSub();
				
				if (permissions.canViewFollowers) {
					getFollowers(channelInfo.id);
					getFollowersInterval = setInterval(() => getFollowers(channelInfo.id), 60000);
				}
				if (permissions.canViewSubscribers && permissions.hasSubscriptionProgram) {
					getSubscribers(channelInfo.id);
					clearInterval(getSubscribersInterval);
					getSubscribersInterval = setInterval(() => getSubscribers(channelInfo.id), 60000);
				}
			}

			getViewerCount(channel);
			clearInterval(getViewerCountInterval);
			getViewerCountInterval = setInterval(() => getViewerCount(channel), 60000);

			clearInterval(tokenValidationInterval);
			tokenValidationInterval = setInterval(async () => {
				const refreshedToken = getStoredToken();
				if (refreshedToken) {
					const validationResult = await validateToken(refreshedToken);
					if (!validationResult) {
						console.log('Token validation failed during periodic check');
					}
				}
			}, 300000);
			
		} catch (error) {
			console.log('Error during connection setup:', error);
			setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
		}
	}

	function handleChatStatusEvent({ status, meta = {} }) {
		switch (status) {
			case TWITCH_CHAT_STATUS.CONNECTING:
				setWebsocketReadyState(WEBSOCKET_READY_STATE.CONNECTING);
				break;
			case TWITCH_CHAT_STATUS.CONNECTED: {
				setWebsocketReadyState(WEBSOCKET_READY_STATE.OPEN);
				isDisconnecting = false;
				const textarea = document.querySelector("#textarea");
				const joinedChannel = meta.channel || channel;
				if (textarea && joinedChannel) {
					const span = document.createElement("div");
					span.innerText = `Joined the channel: ${joinedChannel}`;
					textarea.appendChild(span);
					if (textarea.childNodes.length > 20) {
						textarea.childNodes[0].remove();
					}
				}
				break;
			}
			case TWITCH_CHAT_STATUS.DISCONNECTED:
				setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
				if (!isDisconnecting) {
					console.log('Twitch chat disconnected', meta?.reason || '');
				}
				break;
			case TWITCH_CHAT_STATUS.ERROR:
				setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
				if (meta?.error) {
					console.error('Twitch chat error', meta.error);
				}
				break;
			default:
				break;
		}
	}

	function badgesToString(badges) {
		if (!badges) return '';
		if (typeof badges === 'string') return badges;
		if (Array.isArray(badges)) return badges.join(',');
		return Object.entries(badges)
			.filter(([key, value]) => key && value !== undefined && value !== null)
			.map(([key, value]) => `${key}/${value}`)
			.join(',');
	}

		function convertChatPayloadToLegacyMessage(payload) {
			const raw = payload.raw || {};
			const tags = {};
			const sourceTags = [raw.userstate, raw.tags];
			for (let i = 0; i < sourceTags.length; i += 1) {
				const source = sourceTags[i];
				if (!source || typeof source !== 'object') {
					continue;
				}
				Object.assign(tags, source);
			}
			if (tags.badges && typeof tags.badges === 'object') {
				tags.badges = badgesToString(tags.badges);
			}
			if (tags.emotes && typeof tags.emotes !== 'string') {
				const legacyEmotes = serializeTwitchEmotesForLegacy(tags.emotes);
				if (legacyEmotes) {
					tags.emotes = legacyEmotes;
				} else if (typeof tags.emotes !== 'string') {
					delete tags.emotes;
				}
			}
			if (payload.bits && !tags.bits) {
				tags.bits = payload.bits;
			}
		if (!tags['tmi-sent-ts'] && payload.timestamp) {
			tags['tmi-sent-ts'] = payload.timestamp;
		}
		const channelName = (raw.channel || payload.channel || channel || '').replace(/^#/, '');
		const login = (tags.username || payload.username || payload.chatname || 'twitchuser').toLowerCase();
		const trailing = payload.rawMessage ?? payload.chatmessage ?? '';

		return {
			tags,
			prefix: `${login}!${login}@${login}.tmi.twitch.tv`,
			command: 'PRIVMSG',
			params: [`#${channelName}`],
			trailing,
			raw,
			__normalizedPayload: payload
		};
	}

	function convertMembershipPayloadToUserNotice(payload) {
		const tags = { ...(payload.raw?.userstate || {}) };
		if (!tags['display-name']) {
			tags['display-name'] = payload.chatname || tags.username || '';
		}
		if (!tags['msg-id']) {
			tags['msg-id'] = payload.event || 'notification';
		}
		if (!tags['system-msg'] && payload.chatmessage) {
			tags['system-msg'] = payload.chatmessage;
		}
		if (payload.viewers && !tags['msg-param-viewerCount']) {
			tags['msg-param-viewerCount'] = payload.viewers;
		}
		return {
			tags,
			trailing: payload.rawMessage || payload.chatmessage || '',
			__normalizedPayload: payload
		};
	}

	async function handleNormalizedChatMessage(payload) {
		if (!payload) {
			return;
		}
		const legacy = convertChatPayloadToLegacyMessage(payload);
		await processMessage(legacy);
	}

	async function handleNormalizedMembership(payload) {
		if (!payload) {
			return;
		}
		if (payload.event === 'cheer') {
			await handleNormalizedChatMessage({
				...payload,
				raw: payload.raw,
				rawMessage: payload.rawMessage ?? payload.chatmessage ?? ''
			});
			return;
		}
		if (!settings.captureevents) {
			return;
		}
		const notice = convertMembershipPayloadToUserNotice(payload);
		await processUserNotice(notice);
	}

	async function handleNormalizedRaid(payload) {
		if (!payload || !settings.captureevents) {
			return;
		}
		const tags = {
			'display-name': payload.chatname || '',
			'system-msg': payload.chatmessage || '',
			'msg-id': payload.event || 'raid',
			'msg-param-viewerCount': payload.viewers || ''
		};
		const notice = {
			tags,
			trailing: payload.rawMessage || payload.chatmessage || '',
			__normalizedPayload: payload
		};
		await processUserNotice(notice);
	}

	function handleNormalizedNotice(payload) {
		if (!payload) {
			return;
		}
		console.log('Twitch notice', payload);
	}

	function handleNormalizedClear(payload) {
		if (!payload) {
			return;
		}
		console.log('Twitch chat cleared', payload);
	}

	function handleNormalizedWhisper(payload) {
		if (!payload) {
			return;
		}
		console.log('Twitch whisper', payload);
	}

	function handleNormalizedError(error) {
		if (!error) {
			return;
		}
		console.error('Twitch chat client error', error);
		setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
	}

	// Listen for UI moderation/ad requests from twitch.html
	window.addEventListener('message', async (ev) => {
		if (!ev?.data || ev.data.source !== 'twitch-ws-ui') return;
		const { action, payload } = ev.data;
		try {
			if (action === 'ban') {
				const ok = await banUser(payload?.login, payload?.seconds || 0, payload?.reason || '');
				if (!ok) console.warn('Ban/timeout failed');
			} else if (action === 'unban') {
				const ok = await unbanUser(payload?.login);
				if (!ok) console.warn('Unban failed');
			} else if (action === 'ad') {
				const ok = await startAdBreak(payload?.length || 60);
				if (!ok) console.warn('Ad request failed');
			} else if (action === 'ad_schedule') {
				await fetchAdSchedule();
			}
		} catch (e) {
			console.error('UI action error', e);
		}
	});

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


	function signOut() {
		localStorage.removeItem('twitchOAuthToken');
		localStorage.removeItem('twitchChannel');
		localStorage.removeItem('twitchUserAlias');
		sessionStorage.removeItem('twitchOAuthState');
		sessionStorage.removeItem('twitchOAuthToken');
		
		if (chatClient) {
			try {
				chatClient.disconnect();
			} catch (err) {
				console.warn('Failed to disconnect Twitch chat client on sign out', err);
			}
			setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
		}

		updateHeaderInfo(null, null);
		document.querySelectorAll('.socket').forEach(ele=>ele.classList.add('hidden'))
		document.querySelector('.auth').classList.remove('hidden');
		document.querySelector('#textarea').innerHTML = '';

		console.log('Signed out successfully');
	}

	async function handleSendMessage(event) {
		event.preventDefault();
		const inputElement = document.querySelector('#input-text');
		if (inputElement) {
			var msg = inputElement.value.trim();
			if (msg) {
				const sent = await sendMessage(msg);
				if (sent) {
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
					await processMessage(builtmsg);
				}
			}
		}
	}
	function handleEnterKey(event) {
		if (event.key === 'Enter') {
			handleSendMessage(event).catch((err) => console.error('Twitch handleSendMessage failed', err));
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

	async function sendMessage(message) {
		await modulesReady;
		if (!checkAuthStatus()) {
			return false;
		}
		const client = await ensureChatClientInstance();
		try {
			await client.sendMessage(message, channel);
			return true;
		} catch (error) {
			console.error('Failed to send Twitch chat message', error);
			return false;
		}
	}
	function replaceEmotesWithImages(text, twitchEmotes = null, isBitMessage = false) {
		let workingText = typeof text === 'string' ? text : '';
		if (workingText && twitchEmotes) {
			workingText = renderNativeEmotesWithFallback(
				workingText,
				twitchEmotes,
				Boolean(settings.textonlymode)
			);
		}
		
		// Handle cheermotes (bit emotes) if this is a bit message
		if (isBitMessage) {
			// Common cheermote patterns - includes standard and custom cheermotes
			// Matches patterns like: Cheer100, 4Head100, Kappa1000, etc.
			const cheermoteRegex = /\b(Cheer|Kappa|Kreygasm|SwiftRage|4Head|PJSalt|MrDestructoid|TriHard|NotLikeThis|FailFish|VoHiYo|PogChamp|FrankerZ|HeyGuys|DansGame|EleGiggle|BibleThump|Jebaited|SeemsGood|LUL|VoteYea|VoteNay|HotPokket|OpieOP|FutureMan|FBCatch|TBAngel|PeteZaroll|TwitchUnity|CoolStoryBob|PopCorn|KAPOW|PowerUpR|PowerUpL|DarkMode|HSCheers|PurpleStar|FBPass|FBRun|FBChallenge|RedCoat|GreenTeam|PurpleTeam|HolidayCheer|BitBoss|Streamlabs)(\d+)\b/gi;
			
			workingText = workingText.replace(cheermoteRegex, (match, emoteName, bitAmount) => {
				const amount = parseInt(bitAmount);
				
				if (settings.textonlymode) {
					// In text-only mode, just show the cheermote as text with a space before the number
					return emoteName + ' ' + amount;
				}
				
				// Determine tier based on bit amount
				let tier = 1;
				if (amount >= 10000) tier = 10000;
				else if (amount >= 5000) tier = 5000;
				else if (amount >= 1000) tier = 1000;
				else if (amount >= 100) tier = 100;
				
				// Determine color based on tier
				let color = '#9c3ee8'; // purple (100-999)
				if (tier >= 10000) color = '#f43021'; // red
				else if (tier >= 5000) color = '#1db2a5'; // blue/teal
				else if (tier >= 1000) color = '#0eba26'; // green
				else if (tier < 100) color = '#979797'; // gray
				
				// Build the cheermote URL
				const cheermoteUrl = `https://d3aqoihi2n8ty8.cloudfront.net/actions/${emoteName.toLowerCase()}/dark/animated/${tier}/1.gif`;
				
				// Return the cheermote image with the bit amount displayed after it
				return `<img src="${cheermoteUrl}" alt="${escapeHtml(emoteName + ' ' + amount)}" title="${escapeHtml(emoteName + ' ' + amount)}" class="regular-emote"/><strong style="color: ${color}; margin-left: 2px;">${amount}</strong>`;
			});
		}
		
		// Then handle third-party emotes (BTTV, 7TV, FFZ)
		if (!EMOTELIST) {
			return workingText;
		}
		
		return workingText.replace(/(?<=^|\s)(\S+?)(?=$|\s)/g, (match, emoteMatch) => {
			const emote = EMOTELIST[emoteMatch];
			if (emote) {
				if (settings.textonlymode) {
					// In text-only mode, just return the emote text
					return emoteMatch;
				}
				const escapedMatch = escapeHtml(emoteMatch);
				const isZeroWidth = typeof emote !== "string" && emote.zw;
				return `<img src="${typeof emote === 'string' ? emote : emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="${isZeroWidth ? 'zero-width-emote-centered' : 'regular-emote'}"/>`;
			}
			return match;
		});
	}

	function fallbackParseTwitchEmotes(source) {
		if (!source) {
			return [];
		}
		if (typeof parseTwitchEmotes === 'function') {
			return parseTwitchEmotes(source);
		}
		if (typeof source === 'string') {
			return source
				.split('/')
				.map((part) => {
					const [id, positions] = part.split(':');
					if (!id || !positions) {
						return null;
					}
					return {
						id,
						positions: positions.split(',').map((range) => {
							const [start, end] = range.split('-');
							return { start, end };
						})
					};
				})
				.filter(Boolean);
		}
		if (source && typeof source === 'object') {
			return Object.entries(source)
				.map(([id, positions]) => ({ id, positions }))
				.filter(Boolean);
		}
		return [];
	}

	function legacyRenderNativeEmotes(text, emotesSource, textOnlyMode) {
		const parsed = fallbackParseTwitchEmotes(emotesSource);
		if (!parsed.length) {
			return text;
		}
		const flattened = parsed
			.flatMap(({ id, positions }) =>
				Array.isArray(positions)
					? positions.map((pos) => ({
							emoteId: id,
							start: Number.parseInt(pos.start ?? pos[0], 10),
							end: Number.parseInt(pos.end ?? pos[1], 10)
						}))
					: []
			)
			.filter(
				(entry) =>
					Number.isFinite(entry.start) &&
					Number.isFinite(entry.end) &&
					entry.end >= entry.start
			)
			.sort((a, b) => b.start - a.start);
		if (!flattened.length) {
			return text;
		}
		let result = text;
		flattened.forEach(({ emoteId, start, end }) => {
			const emoteName = text.substring(start, end + 1);
			if (textOnlyMode) {
				result = result.substring(0, start) + emoteName + result.substring(end + 1);
			} else {
				const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/2.0`;
				const emoteImg = `<img src="${emoteUrl}" alt="${escapeHtml(emoteName)}" title="${escapeHtml(emoteName)}" class="regular-emote"/>`;
				result = result.substring(0, start) + emoteImg + result.substring(end + 1);
			}
		});
		return result;
	}

	function renderNativeEmotesWithFallback(text, emoteSource, textOnlyMode) {
		if (!text || !emoteSource) {
			return text;
		}
		if (typeof renderTwitchNativeEmotes === 'function') {
			try {
				return renderTwitchNativeEmotes(text, emoteSource, {
					textOnly: textOnlyMode,
					escapeHtml,
					imageClassName: 'regular-emote',
					textIsSafe: true
				});
			} catch (error) {
				console.warn('Falling back to legacy Twitch emote renderer', error);
			}
		}
		return legacyRenderNativeEmotes(text, emoteSource, textOnlyMode);
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
			let response;
			if (!headers) {
				response = await fetch(URL, {
					timeout: timeout,
					signal: controller.signal
				});
			} else {
				response = await fetch(URL, {
					timeout: timeout,
					signal: controller.signal,
					headers: headers
				});
			}
			clearTimeout(timeout_id);
			
			// Check for 401/403 errors which indicate expired token
			if (response.status === 401 || response.status === 403) {
				console.error('Authentication error - token may be expired');
				handleTokenExpiration();
			}
			
			return response;
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
		const normalizedPayload = parsedMessage.__normalizedPayload || null;
		const user = parsedMessage.prefix.split('!')[0];
		const message = normalizedPayload?.rawMessage ?? parsedMessage.trailing;
		// Clean channel name from params (remove # prefix)
		if (parsedMessage.params[0]) {
			channel = parsedMessage.params[0].replace(/^#/, '');
		}
		const userInfo = await getUserInfo(user);
		
		// Parse subscriber info from badge tags
		let subscriber = "";
		let subtitle = "";
		let mod = false;
		const badgeList = parseBadges(parsedMessage);
		
		if (parsedMessage.tags && parsedMessage.tags.badges && typeof parsedMessage.tags.badges === 'string') {
			const badges = parsedMessage.tags.badges.split(',');
			badges.forEach(badge => {
				if (badge.startsWith('subscriber/')) {
					subscriber = "Subscriber";
					const months = badge.split('/')[1];
					if (months && months !== "0") {
						subtitle = months + (months === "1" ? "-Month" : "-Months");
					}
				} else if (badge.startsWith('moderator/') || badge.startsWith('broadcaster/')) {
					mod = true;
				}
			});
		}
		
		// Apply member chat only filter if enabled
		if (settings.memberchatonly && !subscriber) {
			return;
		}
		
		// Apply custom twitch state filter if enabled
		if (channel && settings.customtwitchstate) {
			if (settings.customtwitchaccount && settings.customtwitchaccount.textsetting && 
				settings.customtwitchaccount.textsetting.toLowerCase() !== channel.toLowerCase()) {
				return;
			} else if (!settings.customtwitchaccount) {
				return;
			}
		}
		
		// Apply delay if enabled
		if (settings.delaytwitch) {
			await new Promise(resolve => setTimeout(resolve, 3000));
		}
		
		// Parse bits/cheers from message
		let hasDonation = "";
		if (parsedMessage.tags && parsedMessage.tags.bits) {
			const bits = parseInt(parsedMessage.tags.bits);
			if (bits === 1) {
				hasDonation = bits + " bit";
			} else if (bits > 1) {
				hasDonation = bits + " bits";
			}
		}
		
		// Parse reply if enabled
		let replyMessage = "";
		let originalMessage = "";
		if (!settings.excludeReplyingTo && parsedMessage.tags && parsedMessage.tags['reply-parent-msg-body']) {
			replyMessage = parsedMessage.tags['reply-parent-msg-body'];
			originalMessage = message;
		}

		// Add the message to the UI
		var span = document.createElement("div");
		let badgeHtml = '';
		badgeList.forEach(badgeUrl => {
			badgeHtml += `<img class="chat-badge" src="${badgeUrl}" alt="">`;
		});
		
		let displayMessage = escapeHtml(message);
		if (replyMessage) {
			displayMessage = `<i><small>${escapeHtml(replyMessage)}:</small></i> ${displayMessage}`;
		}
		
		const resolvedDisplayName = normalizedPayload?.chatname || (userInfo ? userInfo.display_name : user);
		span.innerHTML = `${badgeHtml}${escapeHtml(resolvedDisplayName)}: ${displayMessage}`;
		document.querySelector("#textarea").appendChild(span);
		if (document.querySelector("#textarea").childNodes.length > 10) {
			document.querySelector("#textarea").childNodes[0].remove();
		}

		var data = {};
		const normalizedEventType = normalizedPayload?.event;
		const normalizedEventTypeLower =
			typeof normalizedEventType === 'string' ? normalizedEventType.toLowerCase() : '';
		// Chat messages must never set data.event; reserve it for true system events (raids, cheers, /me actions, etc.).
		if (normalizedEventType && normalizedEventTypeLower !== 'message' && normalizedEventTypeLower !== 'chat') {
			data.event = normalizedEventType;
		}
		data.chatname = resolvedDisplayName;
		data.username = user;
		
		// Convert badge URLs to badge objects
		data.chatbadges = badgeList.map(url => ({ type: "img", src: url }));
		
		data.backgroundColor = "";
		data.textColor = parsedMessage.tags?.color || "";
		data.nameColor = parsedMessage.tags?.color || "";
		
		// Parse Twitch emotes from tags
		const twitchEmotes =
			parsedMessage?.tags && parsedMessage.tags.emotes
				? parsedMessage.tags.emotes
				: null;
		
		// Check if this is a bit message
		const isBitMessage = !!(parsedMessage.tags && parsedMessage.tags.bits);
		
		// Debug logging for bit messages
		if (isBitMessage) {
			console.log("Bit message detected!");
			console.log("Original message:", message);
			console.log("Bit amount:", parsedMessage.tags.bits);
			console.log("Emotes in message:", parsedMessage.tags.emotes);
		}
		
		// Handle reply messages
		if (replyMessage) {
			data.initial = replyMessage;
			data.reply = originalMessage;
			if (settings.textonlymode) {
				data.chatmessage = replyMessage + ": " + replaceEmotesWithImages(message, twitchEmotes, isBitMessage);
			} else {
				data.chatmessage = "<i><small>" + escapeHtml(replyMessage) + ":&nbsp;</small></i> " + replaceEmotesWithImages(message, twitchEmotes, isBitMessage);
			}
		} else {
			data.chatmessage = replaceEmotesWithImages(message, twitchEmotes, isBitMessage);
		}
		
		data.membership = subscriber;
		data.subtitle = subtitle;
		data.mod = mod;

		try {
			if (userInfo && userInfo.profile_image_url) {
				data.chatimg = userInfo.profile_image_url;
			} else if (normalizedPayload?.chatimg) {
				data.chatimg = normalizedPayload.chatimg;
			} else {
				data.chatimg = "https://api.socialstream.ninja/twitch/?username=" + encodeURIComponent(user);
			}
		} catch (e) {
			data.chatimg = normalizedPayload?.chatimg || "";
		}
		if (normalizedPayload?.timestamp) {
			data.timestamp = normalizedPayload.timestamp;
		}
		data.hasDonation = hasDonation;
		if (channel) {
			data.sourceImg = getTwitchAvatarImage(channel);
			data.sourceName = channel;
		}
		data.textonly = settings.textonlymode || false;
		data.type = "twitch";
		
		if (hasDonation) {
			data.title = "CHEERS";
		}
		
		// Message ID for deduplication
		if (parsedMessage.tags && parsedMessage.tags.id) {
			data.id = parsedMessage.tags.id;
		}
		
		} catch(e){
			console.error(e);
		}
		//console.log(data);
		pushMessage(data);
	}

	function addEvent(description) {
		const eventsList = document.getElementById('events-list');
		if (!eventsList) return;
		
		const eventItem = document.createElement('div');
		eventItem.className = 'event-item';
		eventItem.textContent = description;
		
		// Add to top of list
		eventsList.insertBefore(eventItem, eventsList.firstChild);
		
		// Keep only last 10 events
		while (eventsList.children.length > 10) {
			eventsList.removeChild(eventsList.lastChild);
		}
	}
	
	function processUserNotice(parsedMessage) {
		// Handle various USERNOTICE types (raids, subs, etc)
		const msgId = parsedMessage.tags['msg-id'];
		const displayName = parsedMessage.tags['display-name'] || '';
		const systemMsg = parsedMessage.tags['system-msg'] || '';
		
		let eventData = {
			type: "twitch",
			event: true,
			textonly: settings.textonlymode || false
		};
		
		switch(msgId) {
			case 'raid':
				const raidViewerCount = parsedMessage.tags['msg-param-viewerCount'] || '0';
				eventData.chatmessage = systemMsg || `${displayName} is raiding with ${raidViewerCount} viewers!`;
				eventData.event = 'raid';
				addEvent(`Raid: ${displayName} with ${raidViewerCount} viewers`);
				break;
				
			case 'sub':
			case 'resub':
				eventData.chatmessage = systemMsg;
				eventData.event = msgId === 'sub' ? 'new_subscriber' : 'resub';
				if (parsedMessage.trailing) {
					eventData.chatmessage += " - " + parsedMessage.trailing;
				}
				addEvent(`${msgId === 'sub' ? 'Subscribe' : 'Resub'}: ${displayName}`);
				break;
				
			case 'subgift':
				eventData.chatmessage = systemMsg;
				eventData.event = 'subscription_gift';
				addEvent(`Gift Sub: ${displayName}`);
				break;
				
			default:
				// Generic event message
				eventData.chatmessage = systemMsg || parsedMessage.trailing || '';
				eventData.event = msgId || 'notification';
				if (msgId) {
					addEvent(`${msgId}: ${displayName}`);
				}
		}
		
		eventData.chatname = displayName;
		
		// Add to UI
		if (eventData.chatmessage) {
			var span = document.createElement("div");
			span.style.fontStyle = "italic";
			span.innerHTML = escapeHtml(eventData.chatmessage);
			document.querySelector("#textarea").appendChild(span);
			if (document.querySelector("#textarea").childNodes.length > 10) {
				document.querySelector("#textarea").childNodes[0].remove();
			}
			
			pushMessage(eventData);
		}
	}
	
	function updateStats(type, data) {
		switch(type) {
			case 'viewer_update':
				document.getElementById('viewer-count').textContent = data.meta;
				break;
			case 'follower_update':
				document.getElementById('follower-count').textContent = data.meta;
				break;
			case 'subscriber_update':
				document.getElementById('subscriber-count').textContent = data.meta;
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
		if (!parsedMessage?.tags?.badges || typeof parsedMessage.tags.badges !== 'string') {
			return [];
		}

		// Skip empty badge strings
		if (parsedMessage.tags.badges.trim() === '') {
			return [];
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
				if (globalBadges && channelBadges) {
					const badgeData = (channelBadges?.[badgeType]?.[badgeVersion]) || 
									(globalBadges?.[badgeType]?.[badgeVersion]);
					
					if (badgeData && badgeData.image_url_2x) {
						badgeList.push(badgeData.image_url_2x);
					}
				}
			});

			return badgeList;
		} catch (error) {
			console.error('Error parsing badges:', error);
			return [];
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
			// Show viewer count updates if enabled
			if (data.event === 'viewer_update' && !(settings.showviewercount || settings.hypemode)) {
				return; // Skip viewer updates if not enabled
			}
			
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
	let lastKnownSubscribers = null;

	// Function to fetch current viewer count
	async function getViewerCount(channelName) {
		const token = getStoredToken();
		if (!token) return;
		
		// Clean channel name (remove # if present)
		channelName = channelName.replace(/^#/, '');
		
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

	// Function to fetch subscribers
	async function getSubscribers(broadcasterId) {
		const token = getStoredToken();
		if (!token) return;
		try {
			const response = await fetchWithTimeout(
				`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`,
				5000,
				{
					'Client-ID': clientId,
					'Authorization': `Bearer ${token}`
				}
			);
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					console.warn('Subscriber lookup not permitted - missing scope or broadcaster rights');
				}
				return;
			}
			const data = await response.json();
			if (typeof data.total === 'number' && data.total !== lastKnownSubscribers) {
				lastKnownSubscribers = data.total;
				pushMessage({ type: 'twitch', event: 'subscriber_update', meta: data.total });
			}
		} catch (error) {
			console.error('Error fetching subscriber count:', error);
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
let eventSubReconnectInProgress = false;

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
		if (getSubscribersInterval) {
			clearInterval(getSubscribersInterval);
			getSubscribersInterval = null;
		}
		if (tokenValidationInterval) {
			clearInterval(tokenValidationInterval);
			tokenValidationInterval = null;
		}

		// Close chat connection
		if (chatClient) {
			try {
				chatClient.disconnect();
			} catch (err) {
				console.warn('Failed to disconnect Twitch chat client during cleanup', err);
			}
			setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
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
		lastKnownSubscribers = null;
		
		document.getElementById('viewer-count').textContent = "-";
		document.getElementById('follower-count').textContent = "-";
		document.getElementById('subscriber-count').textContent = "-";
		const permissionsInfo = document.getElementById('permissions-info');
		if (permissionsInfo) {
			permissionsInfo.innerHTML = "";
		}
		
	// Wait a moment for connections to fully close
	await new Promise(resolve => setTimeout(resolve, 1000));
	isDisconnecting = false;
}

	function initializeEventSubSocket(url) {
		const socket = new WebSocket(url);

		socket.onopen = () => {
			console.log('EventSub WebSocket Connected');
			eventSubRetryCount = 0;
			eventSubReconnectInProgress = false;
		};

		socket.onmessage = async (event) => {
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
						const reconnectUrl = message.payload?.session?.reconnect_url;
						if (reconnectUrl) {
							console.log('EventSub requested reconnect. Switching sockets...');
							activeSubscriptions.clear();
							hasPermissionError = [];
							eventSessionId = null;
							eventSubReconnectInProgress = true;
							const previousSocket = eventSocket;
							if (previousSocket && (previousSocket.readyState === WebSocket.OPEN || previousSocket.readyState === WebSocket.CONNECTING)) {
								try {
									previousSocket.onopen = previousSocket.onmessage = previousSocket.onerror = previousSocket.onclose = null;
								} catch (e) {}
								try {
									previousSocket.close();
								} catch (e) {}
							}
							eventSocket = initializeEventSubSocket(reconnectUrl);
						} else {
							console.warn('EventSub provided no reconnect URL; staying on current socket.');
						}
					}
					break;
			}
		};

		socket.onerror = (error) => {
			if (!isDisconnecting) {
				console.error('EventSub WebSocket Error:', error);
			}
		};

		socket.onclose = () => {
			if (isDisconnecting) return;

			// Ignore closes from superseded sockets created during a reconnect hand-off.
			if (socket !== eventSocket) {
				return;
			}

			if (eventSubReconnectInProgress) {
				// The reconnection attempt did not succeed (new socket closed before handshake).
				console.warn('EventSub reconnect attempt failed; falling back to fresh connection.');
				eventSubReconnectInProgress = false;
				if (reconnectTimeout) {
					clearTimeout(reconnectTimeout);
					reconnectTimeout = null;
				}
				eventSocket = null;
				reconnectTimeout = setTimeout(connectEventSub, 5000);
				return;
			}

			if (!hasPermissionError.length && eventSubRetryCount < MAX_RETRY_ATTEMPTS) {
				console.log(`EventSub WebSocket Closed - Retry attempt ${eventSubRetryCount + 1} of ${MAX_RETRY_ATTEMPTS}`);
				eventSubRetryCount++;
				reconnectTimeout = setTimeout(connectEventSub, 5000);
			} else if (hasPermissionError.length) {
				console.log('EventSub connection stopped: Permission errors detected');
			}
		};

		return socket;
	}

	async function connectEventSub() {
		if (isDisconnecting || hasPermissionError.length) return;

		if (eventSocket && (eventSocket.readyState === WebSocket.OPEN || eventSocket.readyState === WebSocket.CONNECTING)) {
			return;
		}

		eventSocket = initializeEventSubSocket('wss://eventsub.wss.twitch.tv/ws');
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

			// Resubscription message (months, streak)
			if (permissions.canViewSubscribers && permissions.hasSubscriptionProgram && !activeSubscriptions.has('channel.subscription.message')) {
				subscriptionTypes.push({
					type: 'channel.subscription.message',
					version: '1',
					condition: {
						broadcaster_user_id: broadcasterId
					}
				});
			}

			// Cheering
			if ((permissions.isBroadcaster || permissions.isModerator) && !activeSubscriptions.has('channel.cheer')) {
				subscriptionTypes.push({
					type: 'channel.cheer',
					version: '1',
					condition: {
						broadcaster_user_id: broadcasterId
					}
				});
			}

			// Channel points redemptions
			if (!activeSubscriptions.has('channel.channel_points_custom_reward_redemption.add')) {
				subscriptionTypes.push({
					type: 'channel.channel_points_custom_reward_redemption.add',
					version: '1',
					condition: {
						broadcaster_user_id: broadcasterId
					}
				});
			}

			// Raids to this channel
			if (!activeSubscriptions.has('channel.raid')) {
				subscriptionTypes.push({
					type: 'channel.raid',
					version: '1',
					condition: {
						to_broadcaster_user_id: broadcasterId
					}
				});
			}

			// Stream status
			for (const t of ['stream.online', 'stream.offline']) {
				if (!activeSubscriptions.has(t)) {
					subscriptionTypes.push({
						type: t,
						version: '1',
						condition: { broadcaster_user_id: broadcasterId }
					});
				}
			}

			// Ad break begin
			if (!activeSubscriptions.has('channel.ad_break.begin')) {
				subscriptionTypes.push({
					type: 'channel.ad_break.begin',
					version: '1',
					condition: { broadcaster_user_id: broadcasterId }
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
		
		// Skip if captureevents is disabled
		if (!settings.captureevents) {
			return;
		}

		switch (subscription.type) {
		case 'channel.follow':
			const followSuffix = getTranslation('has-started-following', 'has started following');
			const followMessage = `${event.user_name} ${followSuffix}`.trim();
			pushMessage({
				type: "twitch",
				event: 'new_follower',
				chatmessage: followMessage,
				chatname: event.user_name,
				userid: event.user_id,
				timestamp: event.followed_at,
				meta: { userId: event.user_id, followedAt: event.followed_at },
				textonly: settings.textonlymode || false
			});
			if (typeof lastKnownFollowers === 'number') {
				lastKnownFollowers += 1;
				pushMessage({ type: 'twitch', event: 'follower_update', meta: lastKnownFollowers });
			}
			// Add to recent events
			addEvent(`Follow: ${event.user_name}`);
			break;

		case 'channel.subscribe':
			const subscribeSuffix = getTranslation('has-subscribed', 'has subscribed');
			const tierLabel = event.tier ? ` ${getTranslation('at-tier', 'at tier')} ${event.tier}` : '';
			const subscribeMessage = `${event.user_name} ${subscribeSuffix}${tierLabel}`.trim();
			pushMessage({
				type: "twitch",
				event: 'new_subscriber',
				chatmessage: subscribeMessage,
				chatname: event.user_name,
				userid: event.user_id,
				tier: event.tier,
				isGift: event.is_gift,
				meta: { userId: event.user_id, tier: event.tier, isGift: event.is_gift },
				textonly: settings.textonlymode || false
			});
			if (typeof lastKnownSubscribers === 'number') {
				lastKnownSubscribers += 1;
				pushMessage({ type: 'twitch', event: 'subscriber_update', meta: lastKnownSubscribers });
			}
			// Add to recent events
			addEvent(`Subscribe: ${event.user_name} (Tier ${event.tier})`);
			break;

			case 'channel.subscription.message':
				pushMessage({
					type: 'twitch',
					event: 'resub',
					chatname: event.user_name,
					userid: event.user_id,
					chatmessage: event.message?.text || `${event.user_name} resubscribed`,
					meta: {
						userId: event.user_id,
						tier: event.tier,
						streakMonths: event.streak_months,
						cumulativeMonths: event.cumulative_months
					},
					textonly: settings.textonlymode || false
				});
				addEvent(`Resub: ${event.user_name} (${event.cumulative_months} months)`);
				break;

			case 'channel.subscription.gift':
				pushMessage({
					type: "twitch",
					event: 'subscription_gift',
					chatname: event.user_name,
					chatmessage: `${event.user_name} has gifted ${event.total} tier ${event.tier} subs!`,
					userid: event.user_id,
					total: event.total,
					tier: event.tier,
					meta: { userId: event.user_id, total: event.total, tier: event.tier },
					textonly: settings.textonlymode || false
				});
				// Add to recent events
				addEvent(`Gift Subs: ${event.user_name} gifted ${event.total} subs`);
				break;

			case 'channel.cheer':
				pushMessage({
					type: "twitch", 
					event: 'cheer',
					chatname: event.user_name || 'Anonymous',
					userid: event.user_id,
					bits: event.bits,
					chatmessage: event.message,
					hasDonation: event.bits + " bits",
					meta: { userId: event.user_id, bits: event.bits },
					title: "CHEERS",
					textonly: settings.textonlymode || false
				});
				// Add to recent events
				addEvent(`Cheer: ${event.user_name || 'Anonymous'} cheered ${event.bits} bits`);
				break;
			case 'channel.channel_points_custom_reward_redemption.add':
				const rewardTitle = event.reward.title;
				const rewardCost = event.reward.cost;
				const userInput = event.user_input || '';
				
				let rewardMessage = `${event.user_name} redeemed ${rewardTitle} (${rewardCost} points)`;
				if (userInput) {
					rewardMessage += `: ${userInput}`;
				}

				pushMessage({
					type: "twitch",
					event: 'channel_points',
					chatname: event.user_name,
					userid: event.user_id,
					chatmessage: rewardMessage,
					reward: {
						id: event.reward.id,
						title: rewardTitle,
						cost: rewardCost,
						prompt: event.reward.prompt,
						userInput: userInput,
						backgroundColor: event.reward.background_color,
						redemptionId: event.id,
						status: event.status
					},
					timestamp: event.redeemed_at,
					meta: {
						userId: event.user_id,
						rewardId: event.reward.id,
						cost: rewardCost,
						alias: 'reward'
					},
					textonly: settings.textonlymode || false
				});
				
				// Add to recent events
				addEvent(`Channel Points: ${event.user_name} redeemed ${rewardTitle}`);
				break;

			case 'channel.raid':
				pushMessage({
					type: 'twitch',
					event: 'raid',
					chatname: event.from_broadcaster_user_name,
					userid: event.from_broadcaster_user_id,
					chatmessage: `Raiding with ${event.viewers} viewers!`,
					meta: {
						fromId: event.from_broadcaster_user_id,
						fromLogin: event.from_broadcaster_user_login,
						viewers: event.viewers
					},
					textonly: settings.textonlymode || false
				});
				addEvent(`Raid: ${event.from_broadcaster_user_name} with ${event.viewers} viewers`);
				break;

			case 'stream.online':
				pushMessage({ type: 'twitch', event: 'stream_online', meta: { startedAt: event.started_at } });
				addEvent('Stream Online');
				break;
			case 'stream.offline':
				pushMessage({ type: 'twitch', event: 'stream_offline', meta: {} });
				addEvent('Stream Offline');
				break;

			case 'channel.ad_break.begin':
				pushMessage({
					type: 'twitch',
					event: 'ad_break',
					chatmessage: `Ad break started (${event.duration_seconds}s)`,
					meta: {
						duration: event.duration_seconds,
						isAutomatic: event.is_automatic,
						requester: event.requester_login
					}
				});
				addEvent(`Ad Break: ${event.duration_seconds}s`);
				break;
		}
	}

	// --- Moderation & Ads (stubs + API wiring) ---
	async function getUserIdByLogin(login) {
		const info = await getUserInfo(login);
		return info?.id || null;
	}

	async function banUser(login, duration = 0, reason = '') {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId) return false;
			const moderator = await validateToken(token);
			const userId = await getUserIdByLogin(login);
			if (!userId) return false;
			const res = await fetch(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${currentChannelId}&moderator_id=${moderator.user_id}`,
				{
					method: 'POST',
					headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: { user_id: userId, duration: duration || undefined, reason: reason || undefined } })
				}
			);
			return res.ok;
		} catch(e) { console.error('banUser error', e); return false; }
	}

	async function unbanUser(login) {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId) return false;
			const moderator = await validateToken(token);
			const userId = await getUserIdByLogin(login);
			if (!userId) return false;
			const res = await fetch(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${currentChannelId}&moderator_id=${moderator.user_id}&user_id=${userId}`,
				{ method: 'DELETE', headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` } }
			);
			return res.ok;
		} catch(e) { console.error('unbanUser error', e); return false; }
	}

	async function startAdBreak(duration = 60) {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId) return false;
			const res = await fetch('https://api.twitch.tv/helix/channels/ads', {
				method: 'POST',
				headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ broadcaster_id: currentChannelId, length: duration })
			});
			const data = await res.json().catch(()=>({}));
			if (res.ok) {
				addEvent(`Ad Break requested: ${duration}s`);
				pushMessage({ type: 'twitch', event: 'ad_request', meta: data?.data?.[0] || { length: duration } });
				return true;
			}
			console.error('startAdBreak failed', data);
			return false;
		} catch(e) { console.error('startAdBreak error', e); return false; }
	}

	async function fetchAdSchedule() {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId) return null;
			const res = await fetch(`https://api.twitch.tv/helix/channels/ads?broadcaster_id=${currentChannelId}`, {
				headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` }
			});
			const data = await res.json();
			if (res.ok) {
				pushMessage({ type: 'twitch', event: 'ad_schedule', meta: data?.data?.[0] || data });
				addEvent('Ad Schedule updated');
				return data;
			}
			console.error('fetchAdSchedule failed', data);
			return null;
		} catch(e) { console.error('fetchAdSchedule error', e); return null; }
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
		const tokenInfo = await validateToken(getStoredToken());
		const scopes = (tokenInfo?.scopes || []).reduce((acc, s) => { acc[s] = true; return acc; }, {});
		
		return {
			isBroadcaster,
			isModerator,
			canViewFollowers: true, // Followers are public info
			canManageChat: (isBroadcaster || isModerator) && (scopes['moderator:manage:chat_messages'] || isBroadcaster),
			canBanUsers: (isBroadcaster || isModerator) && (scopes['moderator:manage:banned_users'] || isBroadcaster),
			canDeleteMessages: (isBroadcaster || isModerator) && (scopes['moderator:manage:chat_messages'] || isBroadcaster),
			canViewSubscribers: isBroadcaster || isModerator,
			hasSubscriptionProgram: broadcasterInfo?.partner || broadcasterInfo?.broadcaster_type === 'affiliate',
			canModerate: isBroadcaster || isModerator,
			canManageAds: !!scopes['channel:manage:ads'],
			canReadAds: !!scopes['channel:read:ads'],
			canReadRedemptions: !!scopes['channel:read:redemptions'],
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
			{ name: 'Can Manage Ads', value: permissions.canManageAds ? '✓' : '✗' },
			{ name: 'Can Read Ads', value: permissions.canReadAds ? '✓' : '✗' },
			{ name: 'Can Read Redemptions', value: permissions.canReadRedemptions ? '✓' : '✗' },
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

// --- APPEND-ONLY: Twitch WSS status hooks (non-invasive) ---
(function(){
  try {
    if (window.__TWITCH_WSS_STATUS_PATCH__) return; // idempotent
    window.__TWITCH_WSS_STATUS_PATCH__ = true;

    var TAB_ID = (typeof window.__SSAPP_TAB_ID__ !== 'undefined') ? window.__SSAPP_TAB_ID__ : null;

    function __tw_notifyApp(status, message){
      try {
        var payload = { wssStatus: { platform: 'twitch', status: status, message: message } };
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
          window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, function(){});
        } else if (window.ninjafy && window.ninjafy.sendMessage) {
          window.ninjafy.sendMessage(null, payload, null, TAB_ID);
        } else {
          var data = Object.assign({}, payload);
          if (TAB_ID !== null) data.__tabID__ = TAB_ID;
          window.postMessage(data, '*');
        }
      } catch(e){}
    }

    // Expose for optional upstream use
    window.ssWssNotifyTwitch = __tw_notifyApp;

    // 1) Initial sign-in check
    function __tw_initialCheck(){
      try {
        var hasToken = !!localStorage.getItem('twitchOAuthToken');
        if (!hasToken) __tw_notifyApp('signin_required','Please sign in');
      } catch(_){ }
    }

    // 2) Patch showAuthButton to emit signin_required whenever UI shows auth prompt
    try {
      if (typeof showAuthButton === 'function') {
        var __tw_origShowAuth = showAuthButton;
        showAuthButton = function(){
          try { __tw_notifyApp('signin_required','Please sign in'); } catch(_){ }
          return __tw_origShowAuth.apply(this, arguments);
        };
      }
    } catch(_){ }

    // 3) Watch WebSocket(s) for connected/disconnected
    try {
      var __tw_prevAnyOpen = false;
      setInterval(function(){
        try {
          var ws = (typeof window.websocket !== 'undefined') ? window.websocket : null;
          var ev = (typeof window.eventSocket !== 'undefined') ? window.eventSocket : null;
          var isOpen = !!(ws && ws.readyState === 1);
          var isEvOpen = !!(ev && ev.readyState === 1);
          var anyOpen = isOpen || isEvOpen;
          if (anyOpen && !__tw_prevAnyOpen) __tw_notifyApp('connected','Connected to Twitch');
          if (!anyOpen && __tw_prevAnyOpen) __tw_notifyApp('disconnected','Disconnected from Twitch');
          __tw_prevAnyOpen = anyOpen;
        } catch(_){ }
      }, 1500);
    } catch(_){ }

    // 4) Intercept Twitch API errors and forward as status updates
    try {
      if (!window.__tw_fetch_patched__) {
        window.__tw_fetch_patched__ = true;
        var _origFetch = window.fetch;
        if (typeof _origFetch === 'function') {
          var lastAt = 0;
          var throttle = 3000;
          var emit = function(status, msg){
            var now = Date.now();
            if (now - lastAt > throttle) {
              __tw_notifyApp(status, msg);
              lastAt = now;
            }
          };
          window.fetch = async function(input, init){
            try {
              var res = await _origFetch(input, init);
              var url = (typeof input === 'string') ? input : (input && input.url) || '';
              if (url.indexOf('api.twitch.tv') !== -1 || url.indexOf('id.twitch.tv') !== -1 || url.indexOf('gql.twitch.tv') !== -1) {
                if (!res.ok) {
                  var msg = 'Twitch API ' + res.status;
                  try {
                    var body = await res.clone().json().catch(function(){ return null; });
                    if (body) {
                      if (body.message) msg = body.message; // Helix common
                      if (body.error_description) msg = body.error_description; // OAuth common
                      else if (body.error && typeof body.error === 'string') msg = body.error;
                    }
                  } catch(_){ }
                  // Classification:
                  // - OAuth (id.twitch.tv) 401 => auth expired / sign-in required
                  // - Helix/GQL (api.twitch.tv / gql.twitch.tv) 401/403 => warn: insufficient scope/role
                  // - Otherwise, generic error
                  var isOAuth = url.indexOf('id.twitch.tv') !== -1;
                  var isHelixOrGql = url.indexOf('api.twitch.tv') !== -1 || url.indexOf('gql.twitch.tv') !== -1;
                  if (isOAuth && res.status === 401) {
                    emit('signin_required', 'Twitch auth expired');
                  } else if (isHelixOrGql && (res.status === 401 || res.status === 403)) {
                    emit('warn', 'insufficient_scope');
                  } else {
                    emit('error', msg);
                  }
                }
              }
              return res;
            } catch(e) {
              emit('error', e && e.message ? e.message : 'Network error');
              throw e;
            }
          };
        }
      }
    } catch(_){ }

    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(__tw_initialCheck, 0);
    else document.addEventListener('DOMContentLoaded', function(){ setTimeout(__tw_initialCheck, 0); });
  } catch(e){}
})();
// --- END APPEND-ONLY BLOCK ---
