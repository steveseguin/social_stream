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
let sendTwitchMessageFromSsn = null;
let chatSendInFlight = false;
let chatSendStatusTimer = null;
let twitchChatWriteAuthorized = false;
let twitchChatEchoBatchSequence = 0;
const twitchChatEchoBatches = new Map();
const twitchChatEchoBatchById = new Map();
const recentTwitchChatEchoIds = new Map();
const TWITCH_CHAT_SEND_TIMEOUT_MS = Number(globalThis.__SSAPP_TWITCH_CHAT_SEND_TIMEOUT_MS__) || 15000;
const TWITCH_CHAT_ECHO_TIMEOUT_MS = Number(globalThis.__SSAPP_TWITCH_CHAT_ECHO_TIMEOUT_MS__) || 10000;
const twitchDisplayNameByLogin = new Map();
const TWITCH_DELAYTWITCH_MS = 3000;
const TWITCH_DELETE_DELAY_BUFFER_MS = 50;
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
    if (!rawMessage) {
      return;
    }
    try {
      if (typeof rawMessage === 'string') {
        const colonIndex = rawMessage.indexOf(' :');
        const payload = colonIndex >= 0 ? rawMessage.slice(colonIndex + 2) : rawMessage;
        const sendPromise = sendTwitchMessageFromSsn
          ? sendTwitchMessageFromSsn(payload)
          : chatClient?.sendMessage(payload, channel);
        if (!sendPromise) {
          return;
        }
        Promise.resolve(sendPromise).catch((err) => {
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

function isTwitchChatConnected() {
  if (websocketProxy.readyState !== WEBSOCKET_READY_STATE.OPEN || !chatClient) {
    return false;
  }
  try {
    const state = typeof chatClient.getState === 'function' ? chatClient.getState() : null;
    return state?.status === 'connected' && state?.joined === true;
  } catch (_) {
    return false;
  }
}

function pruneRecentTwitchChatEchoIds(now = Date.now()) {
  for (const [messageId, receivedAt] of recentTwitchChatEchoIds) {
    if (now - receivedAt <= 30000 && recentTwitchChatEchoIds.size <= 100) break;
    recentTwitchChatEchoIds.delete(messageId);
  }
}

function finishTwitchChatEchoBatch(batch, received) {
  if (!batch || !twitchChatEchoBatches.has(batch.id)) return;
  clearTimeout(batch.timer);
  twitchChatEchoBatches.delete(batch.id);
  for (const messageId of batch.messageIds) {
    if (twitchChatEchoBatchById.get(messageId) === batch) {
      twitchChatEchoBatchById.delete(messageId);
    }
  }
  const statusElement = document.getElementById('send-status');
  if (statusElement?.dataset.source !== batch.source) return;
  if (received) {
    setChatSendStatus('Sent and received from Twitch.', 'success', 3000, batch.source);
  } else {
    setChatSendStatus(
      'Accepted by Twitch, but the chat echo was not received locally.',
      'warning',
      7000,
      batch.source
    );
  }
}

function trackAcceptedTwitchChatMessages(messageIds) {
  const uniqueMessageIds = [...new Set((messageIds || []).filter(Boolean).map(String))];
  if (!uniqueMessageIds.length) return;
  pruneRecentTwitchChatEchoIds();
  const batch = {
    id: ++twitchChatEchoBatchSequence,
    source: `send-echo-${twitchChatEchoBatchSequence}`,
    messageIds: uniqueMessageIds,
    pendingIds: new Set(uniqueMessageIds.filter(messageId => !recentTwitchChatEchoIds.has(messageId))),
    timer: null
  };
  if (!batch.pendingIds.size) {
    setChatSendStatus('Sent and received from Twitch.', 'success', 3000, batch.source);
    return;
  }
  twitchChatEchoBatches.set(batch.id, batch);
  for (const messageId of batch.pendingIds) {
    twitchChatEchoBatchById.set(messageId, batch);
  }
  setChatSendStatus('Accepted by Twitch; waiting for chat echo…', '', 0, batch.source);
  batch.timer = setTimeout(() => finishTwitchChatEchoBatch(batch, false), TWITCH_CHAT_ECHO_TIMEOUT_MS);
}

function noteTwitchChatEcho(messageId) {
  if (!messageId) return;
  const normalizedId = String(messageId);
  recentTwitchChatEchoIds.set(normalizedId, Date.now());
  pruneRecentTwitchChatEchoIds();
  const batch = twitchChatEchoBatchById.get(normalizedId);
  if (!batch) return;
  batch.pendingIds.delete(normalizedId);
  twitchChatEchoBatchById.delete(normalizedId);
  if (!batch.pendingIds.size) {
    finishTwitchChatEchoBatch(batch, true);
  }
}

function clearPendingTwitchChatEchoes() {
  for (const batch of twitchChatEchoBatches.values()) {
    clearTimeout(batch.timer);
  }
  twitchChatEchoBatches.clear();
  twitchChatEchoBatchById.clear();
  recentTwitchChatEchoIds.clear();
}

function setChatSendStatus(message, state = '', clearAfterMs = 0, source = 'send') {
  if (chatSendStatusTimer) {
    clearTimeout(chatSendStatusTimer);
    chatSendStatusTimer = null;
  }
  const statusElement = document.getElementById('send-status');
  if (!statusElement) return;
  statusElement.textContent = message || '';
  if (state) {
    statusElement.dataset.state = state;
  } else {
    delete statusElement.dataset.state;
  }
  if (message) {
    statusElement.dataset.source = source;
  } else {
    delete statusElement.dataset.source;
  }
  if (message && clearAfterMs > 0) {
    chatSendStatusTimer = setTimeout(() => {
      if (statusElement.textContent !== message || statusElement.dataset.source !== source) return;
      statusElement.textContent = '';
      delete statusElement.dataset.state;
      delete statusElement.dataset.source;
      chatSendStatusTimer = null;
    }, clearAfterMs);
  }
}

function updateChatComposerState() {
  const sendButton = document.getElementById('sendmessage');
  const inputElement = document.getElementById('input-text');
  const connected = isTwitchChatConnected();
  if (sendButton) {
    sendButton.disabled = !connected || !twitchChatWriteAuthorized || chatSendInFlight;
    sendButton.textContent = chatSendInFlight ? 'Sending…' : 'Send';
    sendButton.setAttribute('aria-busy', chatSendInFlight ? 'true' : 'false');
    sendButton.dataset.chatConnected = connected ? 'true' : 'false';
    sendButton.dataset.chatAuthorized = twitchChatWriteAuthorized ? 'true' : 'false';
  }
  if (inputElement) {
    inputElement.readOnly = chatSendInFlight;
    inputElement.setAttribute('aria-busy', chatSendInFlight ? 'true' : 'false');
  }
}

function updateChatConnectionStatus(status) {
  updateChatComposerState();
  if (chatSendInFlight) return;
  const statusElement = document.getElementById('send-status');
  switch (status) {
    case 'connecting':
      setChatSendStatus('Connecting to Twitch chat…', '', 0, 'connection');
      break;
    case 'connected':
      if (!isTwitchChatConnected()) {
        setChatSendStatus('Joining Twitch chat — sending unavailable.', 'warning', 0, 'connection');
      } else if (!twitchChatWriteAuthorized) {
        setChatSendStatus(
          'Twitch sign-in is missing chat permission. Sign out and sign in again.',
          'error',
          0,
          'connection'
        );
      } else if (statusElement?.dataset.source === 'connection') {
        setChatSendStatus('', '', 0, 'connection');
      }
      break;
    case 'disconnected':
      setChatSendStatus('Reconnecting — sending unavailable.', 'warning', 0, 'connection');
      break;
    case 'error':
      setChatSendStatus('Twitch chat is unavailable. Reconnecting…', 'error', 0, 'connection');
      break;
    default:
      break;
  }
}

try{
	window.websocket = websocketProxy;
	var isExtensionOn = true;
	var clientId = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k'; 
	var hostedClientId = 'ysbszgkt7uh5kn7qjed822dd89722n';
	var redirectURI = window.location.href.split("/twitch")[0]+"/twitch.html"; //  'https://socialstream.ninja/sources/websocket/twitch.html';
	var scope = [
		'chat:read',
		'chat:edit',
		'user:write:chat',
		'channel:bot',
		'bits:read',
		'moderator:read:followers',
		'moderator:read:chatters',
		'channel:read:subscriptions',
		'channel:read:hype_train',
		'channel:moderate',
		// New scopes for moderation, ads, and redemptions
		'moderator:manage:banned_users',
		'moderator:manage:chat_messages',
		'channel:manage:broadcast',
		'channel:read:ads',
		'channel:manage:ads',
		'channel:read:redemptions'
	].join('+');
	var channel = '';
	var channelFromUrl = false;
	var username = "SocialStreamNinja"; // Not supported at the moment
	var BTTV = false;
	var SEVENTV = false;
	var FFZ = false;
	var EMOTELIST = false;
	var settings = {};
	var TWITCH_HOSTED_AUTH_BASE_URL = 'https://sso.socialstream.ninja/auth/twitch';
	var TWITCH_SSO_HEALTH_URL = 'https://sso.socialstream.ninja/health';
	var TWITCH_AUTH_RESULT_KEY = 'twitch_auth_result';
	var TWITCH_AUTH_ERROR_KEY = 'twitch_auth_error';
	var TWITCH_REFRESH_TOKEN_KEY = 'twitchOAuthRefreshToken';
	var TWITCH_TOKEN_EXPIRY_KEY = 'twitchOAuthExpiry';
	var TWITCH_TOKEN_SCOPE_KEY = 'twitchOAuthScope';
	var TWITCH_TOKEN_CLIENT_ID_KEY = 'twitchOAuthClientId';
	var TWITCH_BOT_TOKEN_KEY = 'twitchBotOAuthToken';
	var TWITCH_BOT_REFRESH_TOKEN_KEY = 'twitchBotOAuthRefreshToken';
	var TWITCH_BOT_TOKEN_EXPIRY_KEY = 'twitchBotOAuthExpiry';
	var TWITCH_BOT_TOKEN_SCOPE_KEY = 'twitchBotOAuthScope';
	var TWITCH_BOT_TOKEN_CLIENT_ID_KEY = 'twitchBotOAuthClientId';
	var TWITCH_BOT_USER_ID_KEY = 'twitchBotUserId';
	var TWITCH_BOT_LOGIN_KEY = 'twitchBotLogin';
	var TWITCH_BOT_REQUIRED_SCOPES = ['user:write:chat', 'user:bot'];
	var TWITCH_BOT_SEND_URL = TWITCH_HOSTED_AUTH_BASE_URL + '/chat/messages';
	var TWITCH_HOSTED_AUTH_STORAGE_KEY = 'twitchUseHostedOAuth';
	var TWITCH_TOKEN_VALIDATION_TRANSIENT_ERROR = 'transient_validation_error';
	var TWITCH_TOKEN_REFRESH_RETRY_BASE_MS = 30000;
	var TWITCH_TOKEN_REFRESH_RETRY_MAX_MS = 300000;
	var TWITCH_TOKEN_REFRESH_TIMEOUT_MS = 10000;
	var tokenRefreshTimer = null;
	var tokenRefreshPromise = null;
	var tokenRefreshRetryCount = 0;
	var lastTokenRefreshFailure = null;
	var tokenRefreshResumePending = false;
	var botTokenRefreshTimer = null;
	var botTokenRefreshPromise = null;
	var lastBotSendAuthorizationError = '';
	let currentChannelId = null;
	let currentAuthUser = null;

	function createTransientTokenValidationError(status, message) {
		return {
			type: TWITCH_TOKEN_VALIDATION_TRANSIENT_ERROR,
			status: status || null,
			message: message || 'Twitch token validation is temporarily unavailable'
		};
	}

	function isTransientTokenValidationError(value) {
		return !!(value && value.type === TWITCH_TOKEN_VALIDATION_TRANSIENT_ERROR);
	}

	function keepStoredTokenAfterTransientValidationFailure(context, details) {
		console.warn(
			`Twitch token validation temporarily failed${context ? ` during ${context}` : ''}; keeping stored credentials for retry.`,
			details && (details.message || details.status) ? (details.message || details.status) : details
		);
		showAuthButton();
	}

	function syncThirdPartyEmotesForChannel(force = false) {
		const activeChannel = (channel || "").replace(/^#/, "").trim();
		if (!activeChannel) {
			return;
		}
		if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
			return;
		}
		if (settings.bttv && (force || !BTTV)) {
			chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, type:"twitch", channel: activeChannel }, function () {});
		}
		if (settings.seventv && (force || !SEVENTV)) {
			chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, type:"twitch", channel: activeChannel }, function () {});
		}
		if (settings.ffz && (force || !FFZ)) {
			chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, type:"twitch", channel: activeChannel }, function () {});
		}
	}

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

	function formatTranslation(key, fallback, values = {}) {
		let template = getTranslation(key, fallback);
		Object.keys(values).forEach(function(valueKey) {
			const replacement = values[valueKey] == null ? '' : String(values[valueKey]);
			template = template.replace(new RegExp("\\{" + valueKey + "\\}", "g"), function() {
				return replacement;
			});
		});
		return template;
	}

	function getSubscriberLabel() {
		return getTranslation('twitch-subscriber-label', 'Subscriber');
	}

	function formatBitAmount(bits) {
		const amount = parseInt(bits, 10);
		if (amount === 1) {
			return amount + " " + getTranslation('twitch-bit-singular', 'bit');
		}
		return amount + " " + getTranslation('twitch-bit-plural', 'bits');
	}

	const TWITCH_ADVANCED_CONTROLS_STORAGE_KEY = 'twitchWsAdvancedControls';

	function getAdvancedControlSettings() {
		try {
			const parsed = JSON.parse(localStorage.getItem(TWITCH_ADVANCED_CONTROLS_STORAGE_KEY) || '{}');
			return {
				syncDeleteMessages: parsed.syncDeleteMessages !== false,
				syncBlockUsers: !!parsed.syncBlockUsers
			};
		} catch (_) {
			return {
				syncDeleteMessages: true,
				syncBlockUsers: false
			};
		}
	}

	function isAdvancedControlEnabled(key) {
		const controlSettings = getAdvancedControlSettings();
		return !!controlSettings[key];
	}

	function notifyPage(action, payload) {
		try {
			window.postMessage({ source: 'twitch-ws-script', action, payload }, '*');
		} catch (_) {}
	}

	function normalizeSourceControlPlatform(type) {
		type = (type || '').toLowerCase();
		if (type === 'youtubeshorts') {
			return 'youtube';
		}
		return type;
	}

	function pickSourceControlMessageId(...candidates) {
		for (const candidate of candidates) {
			if (candidate === undefined || candidate === null) {
				continue;
			}
			const normalized = String(candidate).trim();
			if (normalized) {
				return normalized;
			}
		}
		return '';
	}

	function isValidTwitchMessageId(value) {
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
	}

	function resolveTwitchDeleteMessageId(payload = {}) {
		const explicitMessageId = pickSourceControlMessageId(
			payload.messageId,
			payload.message_id,
			payload.nativeMessageId,
			payload.native_message_id
		);
		if (explicitMessageId && isValidTwitchMessageId(explicitMessageId)) {
			return explicitMessageId;
		}
		const fallbackMessageId = pickSourceControlMessageId(payload.id);
		return isValidTwitchMessageId(fallbackMessageId) ? fallbackMessageId : '';
	}


	var urlParams = new URLSearchParams(window.location.search);
	var hashParams = new URLSearchParams(window.location.hash.slice(1));
	channelFromUrl = !!(urlParams.get("channel") || urlParams.get("username") || hashParams.get("channel"));
	channel = urlParams.get("channel") || urlParams.get("username") || hashParams.get("channel") || localStorage.getItem("twitchChannel") || "";
		
		
	// At the beginning of the script, add:
	function getStoredToken() {
		return localStorage.getItem('twitchOAuthToken');
	}
	function getStoredRefreshToken() {
		return localStorage.getItem(TWITCH_REFRESH_TOKEN_KEY);
	}
	function getStoredTokenExpiry() {
		const value = parseInt(localStorage.getItem(TWITCH_TOKEN_EXPIRY_KEY) || '', 10);
		return Number.isFinite(value) ? value : 0;
	}
	function getStoredTokenClientId() {
		return localStorage.getItem(TWITCH_TOKEN_CLIENT_ID_KEY) || clientId;
	}
	function getTwitchApiClientId() {
		return getStoredTokenClientId();
	}
	function getStoredBotToken() {
		return localStorage.getItem(TWITCH_BOT_TOKEN_KEY);
	}
	function getStoredBotRefreshToken() {
		return localStorage.getItem(TWITCH_BOT_REFRESH_TOKEN_KEY);
	}
	function getStoredBotTokenExpiry() {
		const value = parseInt(localStorage.getItem(TWITCH_BOT_TOKEN_EXPIRY_KEY) || '', 10);
		return Number.isFinite(value) ? value : 0;
	}
	function getMainBotAuthorizationStatus() {
		const validatedScopes = Array.isArray(currentAuthUser?.scopes) ? currentAuthUser.scopes : [];
		const storedScopes = String(localStorage.getItem(TWITCH_TOKEN_SCOPE_KEY) || '')
			.split(/[,\s]+/)
			.filter(Boolean);
		const scopes = validatedScopes.length ? validatedScopes : storedScopes;
		const mainHasChannelBotScope = scopes.length ? scopes.includes('channel:bot') : null;
		const tokenClientId = String(currentAuthUser?.client_id || localStorage.getItem(TWITCH_TOKEN_CLIENT_ID_KEY) || '');
		const mainUsesHostedApp = tokenClientId ? tokenClientId === hostedClientId : null;
		const mainAccountIsBroadcaster = currentAuthUser?.user_id && currentChannelId
			? String(currentAuthUser.user_id) === String(currentChannelId)
			: null;
		let mainBotAuthorizationReady = null;
		if (mainHasChannelBotScope === true && mainUsesHostedApp === true && mainAccountIsBroadcaster === true) {
			mainBotAuthorizationReady = true;
		} else if (mainHasChannelBotScope === false || mainUsesHostedApp === false || mainAccountIsBroadcaster === false) {
			mainBotAuthorizationReady = false;
		}

		return {
			mainHasChannelBotScope,
			mainBotAuthorizationReady,
			mainAccountIsBroadcaster,
			mainAccountLogin: currentAuthUser?.login || ''
		};
	}
	function getStoredBotAccountStatus(extra = {}) {
		const login = localStorage.getItem(TWITCH_BOT_LOGIN_KEY) || '';
		const userId = localStorage.getItem(TWITCH_BOT_USER_ID_KEY) || '';
		return {
			connected: !!getStoredBotToken(),
			login,
			userId,
			error: lastBotSendAuthorizationError || null,
			requiresMainReauthorization: !!lastBotSendAuthorizationError,
			...getMainBotAuthorizationStatus(),
			...extra
		};
	}
	function notifyBotAccountStatus(extra = {}) {
		const status = getStoredBotAccountStatus(extra);
		try {
			if (typeof window.ssWssNotifyTwitch === 'function') {
				window.ssWssNotifyTwitch('bot_account', status.error || '', { botAccount: status });
			}
		} catch (_) {}
		return status;
	}
	function setStoredBotToken(token, expiresIn, refreshToken, tokenScope, tokenClientId, identity = {}) {
		if (token) {
			localStorage.setItem(TWITCH_BOT_TOKEN_KEY, token);
		}
		const expiresInSeconds = Number(expiresIn);
		if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
			localStorage.setItem(TWITCH_BOT_TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
		}
		if (refreshToken) {
			localStorage.setItem(TWITCH_BOT_REFRESH_TOKEN_KEY, refreshToken);
		}
		if (Array.isArray(tokenScope)) {
			localStorage.setItem(TWITCH_BOT_TOKEN_SCOPE_KEY, tokenScope.join(' '));
		} else if (tokenScope) {
			localStorage.setItem(TWITCH_BOT_TOKEN_SCOPE_KEY, String(tokenScope));
		}
		if (tokenClientId) {
			localStorage.setItem(TWITCH_BOT_TOKEN_CLIENT_ID_KEY, String(tokenClientId));
		}
		if (identity.user_id) {
			localStorage.setItem(TWITCH_BOT_USER_ID_KEY, String(identity.user_id));
		}
		if (identity.login) {
			localStorage.setItem(TWITCH_BOT_LOGIN_KEY, String(identity.login));
		}
		scheduleStoredBotTokenRefresh();
	}
	function clearStoredBotToken() {
		if (botTokenRefreshTimer) {
			clearTimeout(botTokenRefreshTimer);
			botTokenRefreshTimer = null;
		}
		[
			TWITCH_BOT_TOKEN_KEY,
			TWITCH_BOT_REFRESH_TOKEN_KEY,
			TWITCH_BOT_TOKEN_EXPIRY_KEY,
			TWITCH_BOT_TOKEN_SCOPE_KEY,
			TWITCH_BOT_TOKEN_CLIENT_ID_KEY,
			TWITCH_BOT_USER_ID_KEY,
			TWITCH_BOT_LOGIN_KEY
		].forEach(function(key) {
			localStorage.removeItem(key);
		});
	}
	function scheduleStoredBotTokenRefresh(delayOverride = null) {
		if (botTokenRefreshTimer) {
			clearTimeout(botTokenRefreshTimer);
			botTokenRefreshTimer = null;
		}
		if (!getStoredBotRefreshToken()) {
			return;
		}
		const expiresAt = getStoredBotTokenExpiry();
		const delay = Number.isFinite(delayOverride)
			? Math.max(0, delayOverride)
			: (expiresAt ? Math.max(0, expiresAt - Date.now() - 60000) : TWITCH_TOKEN_REFRESH_RETRY_BASE_MS);
		botTokenRefreshTimer = setTimeout(function() {
			botTokenRefreshTimer = null;
			refreshBotAccessToken({ reason: 'scheduled' }).catch(function(error) {
				console.warn('Scheduled Twitch bot token refresh failed:', error);
			});
		}, delay);
	}
	function setStoredToken(token, expiresIn, refreshToken, tokenScope, tokenClientId) {
		if (token) {
			localStorage.setItem('twitchOAuthToken', token);
			sessionStorage.setItem('twitchOAuthToken', token);
		}
		const expiresInSeconds = Number(expiresIn);
		if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
			localStorage.setItem(TWITCH_TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
		}
		if (refreshToken) {
			localStorage.setItem(TWITCH_REFRESH_TOKEN_KEY, refreshToken);
			tokenRefreshRetryCount = 0;
			lastTokenRefreshFailure = null;
		}
		if (Array.isArray(tokenScope)) {
			localStorage.setItem(TWITCH_TOKEN_SCOPE_KEY, tokenScope.join(' '));
		} else if (tokenScope) {
			localStorage.setItem(TWITCH_TOKEN_SCOPE_KEY, String(tokenScope));
		}
		if (tokenClientId) {
			localStorage.setItem(TWITCH_TOKEN_CLIENT_ID_KEY, String(tokenClientId));
		}
		scheduleStoredTokenRefresh();
	}
	function clearStoredToken() {
		if (tokenRefreshTimer) {
			clearTimeout(tokenRefreshTimer);
			tokenRefreshTimer = null;
		}
		tokenRefreshRetryCount = 0;
		lastTokenRefreshFailure = null;
		tokenRefreshResumePending = false;
		localStorage.removeItem('twitchOAuthToken');
		localStorage.removeItem(TWITCH_REFRESH_TOKEN_KEY);
		localStorage.removeItem(TWITCH_TOKEN_EXPIRY_KEY);
		localStorage.removeItem(TWITCH_TOKEN_SCOPE_KEY);
		localStorage.removeItem(TWITCH_TOKEN_CLIENT_ID_KEY);
		localStorage.removeItem('twitchChannel');
		twitchChatWriteAuthorized = false;
		clearPendingTwitchChatEchoes();
		updateChatComposerState();
	}
	function updateStoredTokenExpiry(expiresIn) {
		const expiresInSeconds = Number(expiresIn);
		if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
			return;
		}
		localStorage.setItem(TWITCH_TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
		scheduleStoredTokenRefresh();
	}
	function scheduleStoredTokenRefresh() {
		if (tokenRefreshTimer) {
			clearTimeout(tokenRefreshTimer);
			tokenRefreshTimer = null;
		}
		if (!getStoredRefreshToken()) {
			return;
		}
		const expiresAt = getStoredTokenExpiry();
		if (!expiresAt) {
			return;
		}
		const delay = Math.max(0, expiresAt - Date.now() - 60000);
		tokenRefreshTimer = setTimeout(function() {
			tokenRefreshTimer = null;
			refreshAccessToken({ reason: 'scheduled' }).catch(function(error) {
				console.warn('Scheduled Twitch token refresh failed:', error);
			});
		}, delay);
	}
	function scheduleTokenRefreshRetry() {
		if (!getStoredRefreshToken()) {
			return;
		}
		if (tokenRefreshTimer) {
			clearTimeout(tokenRefreshTimer);
		}
		tokenRefreshRetryCount += 1;
		const delay = Math.min(
			TWITCH_TOKEN_REFRESH_RETRY_MAX_MS,
			TWITCH_TOKEN_REFRESH_RETRY_BASE_MS * (2 ** Math.min(tokenRefreshRetryCount - 1, 4))
		);
		console.warn(`Retrying Twitch token refresh in ${Math.round(delay / 1000)} seconds.`);
		tokenRefreshTimer = setTimeout(function() {
			tokenRefreshTimer = null;
			refreshAccessToken({ reason: 'retry' })
				.then(function(refreshedToken) {
					if (!refreshedToken || !tokenRefreshResumePending) {
						return;
					}
					tokenRefreshResumePending = false;
					if (!isExtensionOn || isDisconnecting ||
						websocketProxy.readyState === WEBSOCKET_READY_STATE.OPEN ||
						websocketProxy.readyState === WEBSOCKET_READY_STATE.CONNECTING) {
						return;
					}
					verifyAndUseToken(refreshedToken);
				})
				.catch(function(error) {
					console.warn('Retrying Twitch token refresh failed:', error);
				});
		}, delay);
	}
	function isPermanentTokenRefreshFailure(error) {
		return error && (error.status === 400 || error.status === 401);
	}
	function base64UrlToJson(value) {
		try {
			const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
			const padded = normalized + '==='.slice((normalized.length + 3) % 4);
			const binary = atob(padded);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			let text = '';
			try {
				text = new TextDecoder().decode(bytes);
			} catch (_) {
				text = decodeURIComponent(escape(binary));
			}
			return JSON.parse(text);
		} catch (error) {
			console.error('Failed to parse Twitch hosted OAuth payload:', error);
			return null;
		}
	}
	function cleanHostedAuthHash() {
		try {
			const url = new URL(window.location.href);
			const hash = new URLSearchParams(url.hash.slice(1));
			[
				TWITCH_AUTH_RESULT_KEY,
				TWITCH_AUTH_ERROR_KEY,
				'access_token',
				'token_type',
				'expires_in',
				'scope',
				'state',
				'error',
				'error_description'
			].forEach(function(key) {
				hash.delete(key);
			});
			const nextHash = hash.toString();
			url.hash = nextHash ? nextHash : '';
			window.history.replaceState({}, document.title, url.toString());
		} catch (error) {
			console.warn('Unable to clean Twitch auth data from URL:', error);
		}
	}
	function buildHostedReturnToUrl() {
		const url = new URL(window.location.href);
		const hash = new URLSearchParams(url.hash.slice(1));
		[
			TWITCH_AUTH_RESULT_KEY,
			TWITCH_AUTH_ERROR_KEY,
			'access_token',
			'token_type',
			'expires_in',
			'scope',
			'state',
			'error',
			'error_description'
		].forEach(function(key) {
			hash.delete(key);
		});
		url.hash = hash.toString();
		return url.toString();
	}
	function buildHostedAuthUrl() {
		const url = new URL(TWITCH_HOSTED_AUTH_BASE_URL + '/start');
		url.searchParams.set('return_to', buildHostedReturnToUrl());
		return url.toString();
	}
	function parseHostedAuthFlag(value) {
		value = String(value || '').trim().toLowerCase();
		if (['1', 'true', 'yes', 'hosted', 'worker'].includes(value)) return true;
		if (['0', 'false', 'no', 'legacy', 'off'].includes(value)) return false;
		return null;
	}
	function updateHostedAuthPreferenceFromUrl() {
		const queryValue = urlParams.get('twitchHostedOAuth');
		const hashValue = hashParams.get('twitchHostedOAuth');
		const parsed = parseHostedAuthFlag(queryValue != null ? queryValue : hashValue);
		if (parsed === true) {
			localStorage.setItem(TWITCH_HOSTED_AUTH_STORAGE_KEY, 'true');
		} else if (parsed === false) {
			localStorage.setItem(TWITCH_HOSTED_AUTH_STORAGE_KEY, 'false');
		}
	}
	function isHostedTwitchAuthEnabled() {
		updateHostedAuthPreferenceFromUrl();
		return localStorage.getItem(TWITCH_HOSTED_AUTH_STORAGE_KEY) !== 'false';
	}
	async function canStartHostedTwitchAuth() {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(function() {
				controller.abort();
			}, 5000);
			const response = await fetch(TWITCH_SSO_HEALTH_URL, {
				cache: 'no-store',
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			const data = await response.json().catch(function() { return {}; });
			return !!(response.ok && Array.isArray(data.providers) && data.providers.includes('twitch'));
		} catch (error) {
			console.warn('Twitch hosted OAuth is unavailable; falling back to legacy auth.', error);
			return false;
		}
	}
	async function startHostedTwitchAuthFlow() {
		if (!(await canStartHostedTwitchAuth())) {
			return false;
		}
		window.location.href = buildHostedAuthUrl();
		return true;
	}
	function handleHostedAuthCallback() {
		const resultPayload = hashParams.get(TWITCH_AUTH_RESULT_KEY);
		const errorPayload = hashParams.get(TWITCH_AUTH_ERROR_KEY);
		if (errorPayload) {
			const errorData = base64UrlToJson(errorPayload) || {};
			console.error('Twitch hosted OAuth failed:', errorData.message || errorData.error || errorData);
			cleanHostedAuthHash();
			showAuthButton();
			return true;
		}
		if (!resultPayload) {
			return false;
		}
		const result = base64UrlToJson(resultPayload);
		const tokens = result && (result.tokens || result);
		if (!tokens || !tokens.access_token) {
			console.error('Twitch hosted OAuth did not return an access token.');
			cleanHostedAuthHash();
			showAuthButton();
			return true;
		}
		setStoredToken(tokens.access_token, tokens.expires_in, tokens.refresh_token, tokens.scope, tokens.client_id || hostedClientId);
		cleanHostedAuthHash();
		verifyAndUseToken(tokens.access_token);
		return true;
	}
	async function refreshAccessToken(options = {}) {
		if (tokenRefreshPromise) {
			return tokenRefreshPromise;
		}
		const refreshToken = getStoredRefreshToken();
		if (!refreshToken) {
			lastTokenRefreshFailure = {
				permanent: true,
				status: null,
				message: 'No Twitch refresh token is available.'
			};
			return null;
		}
		tokenRefreshPromise = (async function() {
			const controller = new AbortController();
			const timeoutId = setTimeout(function() {
				controller.abort();
			}, TWITCH_TOKEN_REFRESH_TIMEOUT_MS);
			try {
				const response = await fetch(TWITCH_HOSTED_AUTH_BASE_URL + '/refresh', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ refresh_token: refreshToken }),
					signal: controller.signal
				});
				const data = await response.json().catch(function() { return {}; });
				if (!response.ok) {
					const message = data.error_description || data.error || data.message || `HTTP ${response.status}`;
					const error = new Error(message);
					error.status = response.status;
					throw error;
				}
				if (!data.access_token) {
					throw new Error('Twitch refresh response did not include an access token.');
				}
				tokenRefreshRetryCount = 0;
				lastTokenRefreshFailure = null;
				setStoredToken(data.access_token, data.expires_in, data.refresh_token || refreshToken, data.scope, data.client_id || hostedClientId);
				console.log('Twitch access token refreshed' + (options.reason ? ` (${options.reason})` : ''));
				return data.access_token;
			} catch (error) {
				const currentRefreshToken = getStoredRefreshToken();
				if (currentRefreshToken && currentRefreshToken !== refreshToken) {
					console.log('Twitch token was refreshed by another source window; using the newer stored token.');
					tokenRefreshRetryCount = 0;
					lastTokenRefreshFailure = null;
					scheduleStoredTokenRefresh();
					return getStoredToken();
				}
				const permanent = isPermanentTokenRefreshFailure(error);
				lastTokenRefreshFailure = {
					permanent,
					status: error && error.status ? error.status : null,
					message: error && error.message ? error.message : String(error)
				};
				console.warn('Unable to refresh Twitch access token:', error);
				if (!permanent) {
					scheduleTokenRefreshRetry();
				}
				return null;
			} finally {
				clearTimeout(timeoutId);
			}
		})().finally(function() {
			tokenRefreshPromise = null;
		});
		return tokenRefreshPromise;
	}

	async function validateTwitchBotToken(token) {
		const response = await fetch('https://id.twitch.tv/oauth2/validate', {
			headers: {
				'Authorization': `OAuth ${token}`
			}
		});
		const data = await response.json().catch(function() { return {}; });
		if (!response.ok) {
			const error = new Error(data.message || `Twitch bot token validation failed (HTTP ${response.status}).`);
			error.status = response.status;
			throw error;
		}
		if (data.client_id !== hostedClientId) {
			const error = new Error('This Twitch bot account was authorized for a different application.');
			error.status = 403;
			throw error;
		}
		const scopes = Array.isArray(data.scopes) ? data.scopes : [];
		const missingScopes = TWITCH_BOT_REQUIRED_SCOPES.filter(function(requiredScope) {
			return !scopes.includes(requiredScope);
		});
		if (missingScopes.length) {
			const error = new Error(`Twitch bot permission missing: ${missingScopes.join(', ')}.`);
			error.status = 403;
			throw error;
		}
		if (!data.user_id || !data.login) {
			const error = new Error('Twitch did not identify the bot account.');
			error.status = 403;
			throw error;
		}
		if (currentAuthUser?.user_id && String(currentAuthUser.user_id) === String(data.user_id)) {
			const error = new Error('Choose a different Twitch account. The bot account cannot be the main account.');
			error.status = 409;
			throw error;
		}
		return data;
	}

	async function refreshBotAccessToken(options = {}) {
		if (botTokenRefreshPromise) {
			return botTokenRefreshPromise;
		}
		const refreshToken = getStoredBotRefreshToken();
		if (!refreshToken) {
			return null;
		}
		botTokenRefreshPromise = (async function() {
			const controller = new AbortController();
			const timeoutId = setTimeout(function() {
				controller.abort();
			}, TWITCH_TOKEN_REFRESH_TIMEOUT_MS);
			try {
				const response = await fetch(TWITCH_HOSTED_AUTH_BASE_URL + '/refresh', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ refresh_token: refreshToken }),
					signal: controller.signal
				});
				const data = await response.json().catch(function() { return {}; });
				if (!response.ok || !data.access_token) {
					const error = new Error(data.error_description || data.error || data.message || `HTTP ${response.status}`);
					error.status = response.status;
					throw error;
				}
				const identity = await validateTwitchBotToken(data.access_token);
				setStoredBotToken(
					data.access_token,
					data.expires_in,
					data.refresh_token || refreshToken,
					data.scope || identity.scopes,
					data.client_id || identity.client_id,
					identity
				);
				console.log('Twitch bot token refreshed' + (options.reason ? ` (${options.reason})` : ''));
				return data.access_token;
			} catch (error) {
				if (error && (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 409)) {
					clearStoredBotToken();
					notifyBotAccountStatus({ event: 'error', error: error.message || 'Bot account authorization expired.' });
				} else {
					scheduleStoredBotTokenRefresh(TWITCH_TOKEN_REFRESH_RETRY_BASE_MS);
				}
				console.warn('Unable to refresh Twitch bot token:', error);
				return null;
			} finally {
				clearTimeout(timeoutId);
			}
		})().finally(function() {
			botTokenRefreshPromise = null;
		});
		return botTokenRefreshPromise;
	}

	async function validateStoredBotAccount() {
		let token = getStoredBotToken();
		if (!token) {
			return notifyBotAccountStatus({ event: 'status' });
		}
		try {
			let identity;
			try {
				identity = await validateTwitchBotToken(token);
			} catch (error) {
				if ((error.status === 401 || error.status === 403) && getStoredBotRefreshToken()) {
					token = await refreshBotAccessToken({ reason: 'validation' });
					if (!token) {
						return getStoredBotAccountStatus({ event: 'error', error: error.message });
					}
					identity = await validateTwitchBotToken(token);
				} else {
					throw error;
				}
			}
			setStoredBotToken(
				token,
				identity.expires_in,
				getStoredBotRefreshToken(),
				identity.scopes,
				identity.client_id,
				identity
			);
			return notifyBotAccountStatus({ event: 'status' });
		} catch (error) {
			if (error && (error.status === 401 || error.status === 403 || error.status === 409)) {
				clearStoredBotToken();
			}
			return notifyBotAccountStatus({ event: 'error', error: error?.message || 'Unable to validate the bot account.' });
		}
	}

	async function connectTwitchBotAccount() {
		const startOAuthFn = (window.ninjafy && typeof window.ninjafy.startTwitchOAuth === 'function')
			? window.ninjafy.startTwitchOAuth
			: (window.__ssapp && typeof window.__ssapp.startTwitchOAuth === 'function')
				? window.__ssapp.startTwitchOAuth
				: null;
		if (!startOAuthFn) {
			const error = 'A separate Twitch bot account can only be connected from SSApp WebSocket mode.';
			return notifyBotAccountStatus({ event: 'error', error });
		}

		lastBotSendAuthorizationError = '';
		notifyBotAccountStatus({ event: 'connecting', connecting: true });
		try {
			const state = nonce(15) + '@bot';
			const result = await startOAuthFn({
				clientId: hostedClientId,
				scopes: TWITCH_BOT_REQUIRED_SCOPES,
				state,
				authBase: TWITCH_HOSTED_AUTH_BASE_URL,
				authMode: 'hosted',
				purpose: 'bot'
			});
			if (!result || !result.access_token) {
				throw new Error('Twitch did not return a bot account authorization.');
			}
			const identity = await validateTwitchBotToken(result.access_token);
			setStoredBotToken(
				result.access_token,
				result.expires_in || identity.expires_in,
				result.refresh_token,
				result.scope || identity.scopes,
				result.client_id || identity.client_id,
				identity
			);
			return notifyBotAccountStatus({ event: 'connected' });
		} catch (error) {
			console.error('Twitch bot account OAuth failed:', error);
			return notifyBotAccountStatus({ event: 'error', error: error?.message || 'Unable to connect the bot account.' });
		}
	}

	function disconnectTwitchBotAccount() {
		lastBotSendAuthorizationError = '';
		clearStoredBotToken();
		return notifyBotAccountStatus({ event: 'disconnected' });
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
		chatSendInFlight = false;
		updateChatComposerState();
		setChatSendStatus('Authentication expired. Sign in again to send messages.', 'error', 0, 'connection');
		clearEventSubKeepaliveTimer();
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
		const eventSockets = new Set([eventSocket, eventSubPreviousSocket].filter(Boolean));
		setEventSubSocket(null);
		eventSubPreviousSocket = null;
		eventSessionId = null;
		eventSubReconnectInProgress = false;
		eventSockets.forEach(function(socket) {
			try {
				socket.close();
			} catch (_) {}
		});
		
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
		updateChatComposerState();
	}
	function initializePage() {
		urlParams = new URLSearchParams(window.location.search);
		hashParams = new URLSearchParams(window.location.hash.slice(1));
		updateHostedAuthPreferenceFromUrl();
		const urlChannel = urlParams.get("channel") || urlParams.get("username") || hashParams.get("channel");
		channelFromUrl = !!urlChannel;
		channel = urlChannel || localStorage.getItem("twitchChannel") || channel;
		syncThirdPartyEmotesForChannel(true);
		
		// Set up event listeners
		const signOutButton = document.getElementById('sign-out-button');
		if (signOutButton) {
			signOutButton.addEventListener('click', signOut);
		}

		// Auth method selector setup
		const authMethodSelector = document.getElementById('auth-method-selector');
		const isElectron = isElectronEnvironment();
		if (authMethodSelector && isElectron) {
			authMethodSelector.classList.remove('hidden');
			// Load saved preference
			const savedMethod = localStorage.getItem('twitchAuthMethod') || 'external';
			const radios = authMethodSelector.querySelectorAll('input[name="twitch-auth-method"]');
			radios.forEach(radio => {
				radio.checked = radio.value === savedMethod;
				radio.addEventListener('change', function() {
					localStorage.setItem('twitchAuthMethod', this.value);
				});
			});
		}

		const authLink = document.getElementById('auth-link');
		if (authLink) {
			authLink.addEventListener('click', async function(e) {
				e.preventDefault();
				if (isElectron) {
					const authMethod = localStorage.getItem('twitchAuthMethod') || 'external';
					if (authMethod === 'external') {
						await startExternalTwitchAuthFlow();
						return;
					}
					if (isHostedTwitchAuthEnabled()) {
						const startedHostedAuth = await startHostedTwitchAuthFlow();
						if (startedHostedAuth) {
							return;
						}
					}
					window.location.href = authUrl();
				} else {
					if (isHostedTwitchAuthEnabled()) {
						const startedHostedAuth = await startHostedTwitchAuthFlow();
						if (startedHostedAuth) {
							return;
						}
					}
					window.location.href = authUrl();
				}
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
			inputText.addEventListener('keydown', handleEnterKey);
		}
		updateChatComposerState();

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
		scheduleStoredTokenRefresh();
		scheduleStoredBotTokenRefresh();
		setTimeout(function() {
			validateStoredBotAccount().catch(function(error) {
				console.warn('Unable to restore Twitch bot account:', error);
			});
		}, 50);
		if (handleHostedAuthCallback()) {
			return;
		}
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
		try {
			const data = await validateToken(token);
			if (isTransientTokenValidationError(data)) {
				tokenRefreshResumePending = true;
				keepStoredTokenAfterTransientValidationFailure('startup', data);
				return;
			}
			console.log("Token validation data:", data);
			if (data && data.login) {
				tokenRefreshResumePending = false;
				setStoredToken(getStoredToken() || token);
				username = data.login;
				if (!channel) { channel = data.login; channelFromUrl = false; }
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
		} catch (error) {
			console.error('Error validating token:', error);
			clearStoredToken();
			showAuthButton();
		}
	}

	// Add new function to fetch user's specific badges
	async function fetchUserBadges(userId, token) {
		try {
			const response = await fetch(`https://api.twitch.tv/helix/chat/badges/user?user_id=${userId}`, {
				headers: {
					'Client-ID': getTwitchApiClientId(),
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
		syncThirdPartyEmotesForChannel(true);
		token = hashMatch(/access_token=(\w+)/);
		if (token) {
			cleanHostedAuthHash();
		}
		if (sessionStorage.twitchOAuthState == state) {
			verifyAndUseToken(token);
		} else {
			console.error('OAuth state mismatch');
			showAuthButton();
		}
	}

	var userDetails = {};
	var userDetailsById = {};

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
			const response = await fetchWithTimeout(`https://api.twitch.tv/helix/users?login=${username}`, 5000, {'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}`});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			const deets = data.data[0];
			userDetails[username] = deets;
			if (deets && deets.id) {
				userDetailsById[deets.id] = deets;
			}
			return deets;
		} catch (error) {
			console.error('Error fetching user info:', error);
			return null;
		}
	}

	async function getUserInfoById(userId) {
		if (!userId) {
			return null;
		}
		if (userDetailsById[userId]) {
			return userDetailsById[userId];
		}
		
		const token = getStoredToken();
		if (!token) {
			console.error('No token available');
			return null;
		}

		try {
			const response = await fetchWithTimeout(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`, 5000, {'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}`});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			const deets = data.data[0];
			userDetailsById[userId] = deets;
			if (deets && deets.login) {
				userDetails[deets.login] = deets;
			}
			return deets;
		} catch (error) {
			console.error('Error fetching user info by id:', error);
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
			const globalResponse = await fetchWithTimeout('https://api.twitch.tv/helix/chat/badges/global', 5000, {'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}`});
			const channelResponse = await fetchWithTimeout(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${channelId}`, 5000, {'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}`});

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
const TWITCH_VIEWER_POLL_INTERVAL_MS = 30000;
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
		const baseFactory = createTmiClientFactory(() => ensureTmiClient());
		tmiClientFactory = async (options) => {
			const client = await baseFactory(options);
			attachTmiModerationDeleteHandlers(client);
			return client;
		};
	}
	return tmiClientFactory;
}

	function normalizeTwitchLogin(value) {
		return (value || '').toString().replace(/^@/, '').trim().toLowerCase();
	}

	function rememberTwitchDisplayName(login, displayName) {
		const normalized = normalizeTwitchLogin(login);
		if (!normalized || !displayName) {
			return;
		}
		twitchDisplayNameByLogin.set(normalized, displayName);
		if (twitchDisplayNameByLogin.size > 500) {
			const oldest = twitchDisplayNameByLogin.keys().next().value;
			twitchDisplayNameByLogin.delete(oldest);
		}
	}

	function getRememberedTwitchDisplayName(login) {
		const normalized = normalizeTwitchLogin(login);
		return (normalized && twitchDisplayNameByLogin.get(normalized)) || login || '';
	}

	function normalizeTwitchBanDurationSeconds(value) {
		if (value === undefined || value === null || value === '') {
			return null;
		}
		const parsed = parseInt(value, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}

	function getTwitchProfileUrl(login) {
		const normalized = normalizeTwitchLogin(login);
		return normalized ? `https://www.twitch.tv/${normalized}` : '';
	}

	async function pushTwitchBanMetaEvent(details = {}) {
		const login = normalizeTwitchLogin(details.username || details.login || details.userLogin || '');
		const displayName = details.displayName || getRememberedTwitchDisplayName(login) || login;
		let durationSeconds = normalizeTwitchBanDurationSeconds(details.durationSeconds);
		if (!durationSeconds && details.bannedAt && details.endsAt) {
			const startMs = new Date(details.bannedAt).getTime();
			const endMs = new Date(details.endsAt).getTime();
			if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
				durationSeconds = Math.round((endMs - startMs) / 1000);
			}
		}
		const permanent = details.permanent === true || (!durationSeconds && !details.endsAt);
		const meta = {
			platform: 'twitch',
			action: durationSeconds || details.endsAt ? 'timeout' : 'ban',
			username: login,
			displayName: displayName || login,
			userId: details.userId || '',
			avatarUrl: details.avatarUrl || '',
			profileUrl: details.profileUrl || getTwitchProfileUrl(login),
			moderator: details.moderator || '',
			moderatorId: details.moderatorId || '',
			reason: details.reason || '',
			durationSeconds,
			permanent,
			bannedAt: details.bannedAt || '',
			endsAt: details.endsAt || ''
		};

		if (login && !meta.avatarUrl) {
			try {
				const userInfo = await getUserInfo(login);
				if (userInfo) {
					meta.userId = meta.userId || userInfo.id || '';
					meta.avatarUrl = userInfo.profile_image_url || '';
					meta.displayName = details.displayName || userInfo.display_name || meta.displayName;
				}
			} catch (error) {
				console.warn('Twitch ban profile lookup failed', error);
			}
		}

		pushMessage({
			type: 'twitch',
			event: 'user_banned',
			meta
		});
	}

	/*
	AI/overlay contract for Twitch moderation:
	Twitch moderation events are controls, not chat messages. Send them as
	{ delete: ... } so dock.html and custom overlays can remove existing DOM nodes
	before trying to render a new message.
	- { delete: { type:"twitch", id:"..." } } removes one matching message.
	- { delete: { type:"twitch", chatname:"..." } } removes all Twitch messages from that user.
	- { delete: { type:"twitch" } } removes all Twitch messages.
	Custom overlays should handle delete payloads before their normal add-message path.
	*/
	function sendDeleteMessage(data) {
		if (!data || typeof data !== 'object') {
			return;
		}
		try {
			if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					"delete": data
				}, function(response) {
					// Handle response if needed
				});
				return;
			}
			if (window.ninjafy && window.ninjafy.sendMessage) {
				window.ninjafy.sendMessage(null, {
					"delete": data
				}, null, window.__SSAPP_TAB_ID__);
				return;
			}
			if (window.parent && window.parent !== window) {
				window.parent.postMessage({
					"delete": data
				}, '*');
				return;
			}
			window.postMessage({
				"delete": data
			}, '*');
		} catch(e) {
			console.error('Error sending Twitch moderation delete to socialstream:', e);
		}
	}

	function pushDeleteMessage(data) {
		sendDeleteMessage(data);
		if (settings && settings.delaytwitch) {
			setTimeout(function() {
				sendDeleteMessage(data);
			}, TWITCH_DELAYTWITCH_MS + TWITCH_DELETE_DELAY_BUFFER_MS);
		}
	}

	function attachTmiModerationDeleteHandlers(client) {
		if (!client || typeof client.on !== 'function' || client.__ssnTwitchModerationDeleteHandlers) {
			return;
		}
		client.__ssnTwitchModerationDeleteHandlers = true;

		client.on('messagedeleted', function(chan, username, deletedMessage, tags) {
			const deletePayload = { type: 'twitch' };
			const messageId = pickSourceControlMessageId(tags && tags['target-msg-id']);
			if (messageId) {
				deletePayload.id = messageId;
			} else if (settings.pluralmind && username) {
				deletePayload.username = username;
				deletePayload.meta = { pluralmind: true };
			}
			const chatname = getRememberedTwitchDisplayName(username);
			if (chatname) {
				deletePayload.chatname = chatname;
			}
			if (!deletePayload.id && !deletePayload.username && !deletePayload.chatname) {
				return;
			}
			if (!deletePayload.id) {
				deletePayload.onlyLast = true;
			}
			pushDeleteMessage(deletePayload);
		});

		client.on('ban', function(chan, username) {
			const chatname = getRememberedTwitchDisplayName(username);
			if (chatname || (settings.pluralmind && username)) {
				const deletePayload = { type: 'twitch', chatname: chatname };
				if (settings.pluralmind && username) {
					deletePayload.username = username;
					deletePayload.meta = { pluralmind: true };
				}
				pushDeleteMessage(deletePayload);
			}
		});

		client.on('timeout', function(chan, username) {
			const chatname = getRememberedTwitchDisplayName(username);
			if (chatname || (settings.pluralmind && username)) {
				const deletePayload = { type: 'twitch', chatname: chatname };
				if (settings.pluralmind && username) {
					deletePayload.username = username;
					deletePayload.meta = { pluralmind: true };
				}
				pushDeleteMessage(deletePayload);
			}
		});
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
			logger: console,
			tokenProvider: async () => getStoredToken()
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
		add(TWITCH_CHAT_EVENTS.WATCH_STREAK, (payload) => {
			handleNormalizedWatchStreak(payload).catch((err) => {
				console.error('Twitch watch streak handler failed', err);
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

	async function validateStoredTokenWithoutSideEffects(token) {
		if (!token) {
			return false;
		}
		try {
			const response = await fetch('https://id.twitch.tv/oauth2/validate', {
				headers: {
					'Authorization': `OAuth ${token}`
				}
			});
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					return false;
				}
				console.warn('Unable to confirm Twitch token after API auth error; keeping current sign-in for retry.', response.status);
				return true;
			}
			return true;
		} catch (error) {
			console.warn('Unable to validate Twitch token after API auth error; keeping current sign-in for retry.', error);
			return true;
		}
	}

	async function validateToken(token, options = {}) {
		try {
			const response = await fetch('https://id.twitch.tv/oauth2/validate', {
				headers: {
					'Authorization': `OAuth ${token}`
				}
			});
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					if (options.allowRefresh !== false) {
						const refreshedToken = await refreshAccessToken({ reason: 'validation' });
						if (refreshedToken) {
							return validateToken(refreshedToken, { allowRefresh: false });
						}
						if (lastTokenRefreshFailure && !lastTokenRefreshFailure.permanent) {
							return createTransientTokenValidationError(
								lastTokenRefreshFailure.status,
								lastTokenRefreshFailure.message
							);
						}
					}
					handleTokenExpiration();
					return null;
				}
				return createTransientTokenValidationError(response.status, `HTTP ${response.status}`);
			}
			const data = await response.json();
			if (data.client_id) {
				localStorage.setItem(TWITCH_TOKEN_CLIENT_ID_KEY, data.client_id);
			}
			if (data.expires_in) {
				updateStoredTokenExpiry(data.expires_in);
				if (data.expires_in < 300 && options.allowRefresh !== false && getStoredRefreshToken()) {
					const refreshedToken = await refreshAccessToken({ reason: 'near-expiry' });
					if (refreshedToken && refreshedToken !== token) {
						return validateToken(refreshedToken, { allowRefresh: false });
					}
				}
			}
			
			const hasRefreshToken = !!getStoredRefreshToken();

			// Update auth status indicator
			const authStatus = document.getElementById('auth-status');
			if (authStatus) {
				if (data.expires_in && data.expires_in < 3600) {
					if (hasRefreshToken) {
						authStatus.innerHTML = '<span style="color: green; font-size: 12px;">Auto-refresh enabled</span>';
						authStatus.title = 'Authentication refreshes automatically before it expires';
					} else {
						authStatus.innerHTML = `⚠️ <span style="color: orange; font-size: 12px;">Expires in ${Math.floor(data.expires_in / 60)}m</span>`;
						authStatus.title = `Authentication expires in ${Math.floor(data.expires_in / 60)} minutes`;
					}
				} else if (data.expires_in) {
					// Token is valid
					authStatus.innerHTML = `✅ <span style="color: green; font-size: 12px;">Valid</span>`;
					authStatus.title = `Authentication valid for ${Math.floor(data.expires_in / 3600)} hours`;
				}
			}
			
			// Only prompt for re-authentication when automatic refresh is unavailable.
			const existingExpiryWarning = document.querySelector('.token-expiry-warning');
			if (!data.expires_in || data.expires_in >= 3600 || hasRefreshToken) {
				existingExpiryWarning?.remove();
			} else {
				console.warn(`Token expires in ${Math.floor(data.expires_in / 60)} minutes`);
				// Show warning in UI
				const textarea = document.querySelector("#textarea");
				if (textarea && !existingExpiryWarning) {
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
			return createTransientTokenValidationError(null, error && error.message ? error.message : String(error));
		}
	}
	async function connect() {
		let token = getStoredToken();
		if (!token) {
			console.error('No token available');
			showAuthButton();
			return;
		}

		await modulesReady;
		await cleanupCurrentConnection();

		channel = channel.replace(/^#/, '');

		const authUser = await validateToken(token);
		if (isTransientTokenValidationError(authUser)) {
			tokenRefreshResumePending = true;
			keepStoredTokenAfterTransientValidationFailure('connect', authUser);
			return;
		}
		if (!authUser) {
			clearStoredToken();
			showAuthButton();
			return;
		}
		tokenRefreshResumePending = false;
		currentAuthUser = authUser;
		twitchChatWriteAuthorized = hasTwitchScope(authUser, 'user:write:chat');
		token = getStoredToken() || token;

		if (!channel && authUser.login) { channel = authUser.login; }
		const channelInfo = await getUserInfo(channel);
		if (!channelInfo) {
			console.log('Failed to get channel info');
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
			updateChatConnectionStatus('connecting');

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

			const joined = chat.getState?.().joined === true;
			setWebsocketReadyState(joined ? WEBSOCKET_READY_STATE.OPEN : WEBSOCKET_READY_STATE.CONNECTING);
			updateChatConnectionStatus('connected');
			showSocketInterface();
			refreshChannelInformation().catch((error) => {
				console.warn('Unable to refresh Twitch channel information', error);
			});

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
			getViewerCountInterval = setInterval(() => getViewerCount(channel), TWITCH_VIEWER_POLL_INTERVAL_MS);

			clearInterval(tokenValidationInterval);
			tokenValidationInterval = setInterval(async () => {
				const refreshedToken = getStoredToken();
				if (refreshedToken) {
					const validationResult = await validateToken(refreshedToken);
					if (isTransientTokenValidationError(validationResult)) {
						console.log('Token validation temporarily failed during periodic check; keeping stored credentials');
					} else if (!validationResult) {
						console.log('Token validation failed during periodic check');
					}
				}
			}, 300000);
			
		} catch (error) {
			console.log('Error during connection setup:', error);
			setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
			updateChatConnectionStatus('error');
		}
	}

	function handleChatStatusEvent({ status, meta = {} }) {
		switch (status) {
			case TWITCH_CHAT_STATUS.CONNECTING:
				setWebsocketReadyState(WEBSOCKET_READY_STATE.CONNECTING);
				updateChatConnectionStatus('connecting');
				break;
			case TWITCH_CHAT_STATUS.CONNECTED: {
				const joined = chatClient?.getState?.().joined === true;
				setWebsocketReadyState(joined ? WEBSOCKET_READY_STATE.OPEN : WEBSOCKET_READY_STATE.CONNECTING);
				isDisconnecting = false;
				updateChatConnectionStatus('connected');
				if (!joined) {
					break;
				}
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
				updateChatConnectionStatus('disconnected');
				if (!isDisconnecting) {
					console.log('Twitch chat disconnected', meta?.reason || '');
				}
				break;
			case TWITCH_CHAT_STATUS.ERROR:
				setWebsocketReadyState(WEBSOCKET_READY_STATE.CLOSED);
				updateChatConnectionStatus('error');
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
		noteTwitchChatEcho(payload.id);
		const legacy = convertChatPayloadToLegacyMessage(payload);
		await processMessage(legacy);
	}

	async function handleNormalizedWatchStreak(payload) {
		if (!payload || !settings.showtwitchwatchstreaks || settings.hideevents) {
			return;
		}
		await handleNormalizedChatMessage(payload);
	}

	async function handleNormalizedMembership(payload) {
		if (!payload) {
			return;
		}

		// Skip events that EventSub is already handling to prevent duplicates
		if (payload.event === 'cheer' && (activeSubscriptions.has('channel.cheer') || activeSubscriptions.has('channel.bits.use'))) {
			return;
		}
		if (payload.event === 'new_subscriber' && activeSubscriptions.has('channel.subscribe')) {
			return;
		}
		if (payload.event === 'subscription_gift'
			&& activeSubscriptions.has('channel.subscription.gift')) {
			return;
		}
		if (payload.event === 'resub' && activeSubscriptions.has('channel.subscription.message')) {
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
		if (settings.hideevents) {
			return;
		}
		const notice = convertMembershipPayloadToUserNotice(payload);
		await processUserNotice(notice);
	}

	async function handleNormalizedRaid(payload) {
		if (!payload || settings.hideevents) {
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
		if (payload.user) {
			const chatname = getRememberedTwitchDisplayName(payload.user);
			if (chatname || settings.pluralmind) {
				const deletePayload = { type: 'twitch', chatname: chatname };
				if (settings.pluralmind) {
					deletePayload.username = payload.user;
					deletePayload.meta = { pluralmind: true };
				}
				pushDeleteMessage(deletePayload);
			}
			if (!activeSubscriptions.has('channel.ban')) {
				pushTwitchBanMetaEvent({
					username: payload.user,
					displayName: chatname,
					durationSeconds: payload.duration,
					permanent: !payload.duration
				});
			}
			return;
		}
		pushDeleteMessage({ type: 'twitch' });
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
		updateChatConnectionStatus('error');
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
			} else if (action === 'update_channel_info') {
				const ok = await updateChannelInformation(payload || {});
				if (!ok) console.warn('Channel update failed');
			} else if (action === 'refresh_channel_info') {
				await refreshChannelInformation();
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
						'Client-ID': getTwitchApiClientId()
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
						'Client-ID': getTwitchApiClientId()
					}
				}
			);
			const channelData = await channelResponse.json();
			const hasSubscriptionProgram = channelData.data[0]?.partner || channelData.data[0]?.affiliate;

			return {
				canViewSubscribers: isBroadcaster,
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
		clearStoredToken();
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
		chatSendInFlight = false;
		updateChatComposerState();
		setChatSendStatus('', '', 0, 'connection');

		updateHeaderInfo(null, null);
		document.querySelectorAll('.socket').forEach(ele=>ele.classList.add('hidden'))
		document.querySelector('.auth').classList.remove('hidden');
		document.querySelector('#textarea').innerHTML = '';

		console.log('Signed out successfully');
	}

	async function handleSendMessage(event) {
		event?.preventDefault();
		const inputElement = document.querySelector('#input-text');
		const sendButton = document.querySelector('#sendmessage');
		if (inputElement) {
			var msg = inputElement.value.trim();
			if (msg) {
				const activeElement = document.activeElement;
				const restoreComposerFocus = activeElement === inputElement || activeElement === sendButton;
				const result = await sendMessage(msg);
				if (result?.ok) {
					inputElement.value = "";
					// Server echo will display the message via handleNormalizedChatMessage
				} else if (typeof result?.remainingMessage === 'string') {
					inputElement.value = result.remainingMessage;
				}
				if (restoreComposerFocus && (
					document.activeElement === inputElement
						|| document.activeElement === sendButton
						|| document.activeElement === document.body
				)) {
					inputElement.focus();
				}
			}
		}
	}
	function handleEnterKey(event) {
		if (event.key === 'Enter') {
			if (event.isComposing || event.keyCode === 229) return;
			event.preventDefault();
			if (event.repeat) return;
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
			if (request && request.__ssappSendToTab) {
				request = request.__ssappSendToTab;
			}
			if (typeof request === "object") {
				if ("state" in request) {
					isExtensionOn = request.state;
				}
				if (request.type === 'TWITCH_BOT_ACCOUNT_STATUS') {
					sendResponse(getStoredBotAccountStatus({ event: 'status' }));
					return;
				}
				if (request.type === 'TWITCH_BOT_ACCOUNT_CONNECT') {
					connectTwitchBotAccount().catch(function(error) {
						console.error('Twitch bot account connection failed', error);
					});
					sendResponse({ ok: true, pending: true });
					return;
				}
				if (request.type === 'TWITCH_BOT_ACCOUNT_DISCONNECT') {
					sendResponse(disconnectTwitchBotAccount());
					return;
				}
				if (request.type === 'SOURCE_CONTROL') {
					handleSourceControlRequest(request)
						.then((result) => sendResponse(result))
						.catch((err) => {
							console.error('Twitch SOURCE_CONTROL failed', err);
							sendResponse(false);
						});
					return true;
				}
				if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
					sendMessage(request.message, { messageOrigin: request.messageOrigin })
						.then((result) => sendResponse(result?.ok === true))
						.catch((err) => {
							console.error('Twitch extension SEND_MESSAGE failed', err);
							sendResponse(false);
						});
					return true;
				}
				if ("settings" in request) {
					settings = request.settings;
					sendResponse(true);
					syncThirdPartyEmotesForChannel(false);
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

	async function handleSourceControlRequest(request) {
		const payload = request?.payload || {};
		if (normalizeSourceControlPlatform(request?.platform || payload?.type) !== 'twitch') {
			return false;
		}
		if (request.control === 'deleteMessage') {
			if (!isAdvancedControlEnabled('syncDeleteMessages')) {
				return false;
			}
			const messageId = resolveTwitchDeleteMessageId(payload);
			if (!messageId) {
				addEvent('Skipped dock delete: missing native Twitch message ID');
				return false;
			}
			const ok = await deleteChatMessage(messageId);
			if (ok) {
				addEvent('Synced dock delete to Twitch');
			}
			return ok;
		}
		if (request.control === 'blockUser') {
			if (!isAdvancedControlEnabled('syncBlockUsers')) {
				return false;
			}
			const userId = payload.userid || '';
			const login = (payload.chatname || payload.username || '').replace(/^@/, '').trim();
			const ok = userId
				? await banUserById(userId, 0, 'Blocked from Social Stream Ninja')
				: login
					? await banUser(login, 0, 'Blocked from Social Stream Ninja')
					: false;
			if (ok) {
				addEvent(`Synced dock block to Twitch: ${login || userId}`);
			}
			return ok;
		}
		return false;
	}


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

	function isElectronEnvironment() {
		// Check for ssapp URL parameter (set by ssapp when creating WSS windows)
		// This is backwards compatible - older ssapp versions won't set the param,
		// but will still work via the ninjafy check for full preload scenarios
		const urlParams = new URLSearchParams(window.location.search);
		const hashParams = new URLSearchParams(window.location.hash.slice(1));
		const isSsappViaParam = urlParams.has('ssapp') || hashParams.has('ssapp');
		const hasNinjafyOAuth = window.ninjafy && typeof window.ninjafy.startTwitchOAuth === 'function';
		const hasSsappOAuth = window.__ssapp && typeof window.__ssapp.startTwitchOAuth === 'function';
		return isSsappViaParam || hasNinjafyOAuth || hasSsappOAuth;
	}

	async function startExternalTwitchAuthFlow() {
		// Try ninjafy first (full preload), then __ssapp (mock preload), then fallback to redirect
		const startOAuthFn = (window.ninjafy && typeof window.ninjafy.startTwitchOAuth === 'function')
			? window.ninjafy.startTwitchOAuth
			: (window.__ssapp && typeof window.__ssapp.startTwitchOAuth === 'function')
				? window.__ssapp.startTwitchOAuth
				: null;
		
		if (!startOAuthFn) {
			window.location.href = authUrl();
			return;
		}
		const state = nonce(15) + "@" + (username || "");
		sessionStorage.twitchOAuthState = state.split("@")[0];
		try {
			const result = await startOAuthFn({
				clientId,
				scopes: scope.split('+'),
				state,
				authBase: TWITCH_HOSTED_AUTH_BASE_URL,
				authMode: isHostedTwitchAuthEnabled() ? 'hosted' : 'legacy'
			});
			if (!result || !result.access_token) {
				console.error('Twitch OAuth did not return an access_token.');
				showAuthButton();
				return;
			}
			// Process the token as if it came from the hash fragment
			setStoredToken(
				result.access_token,
				result.expires_in,
				result.refresh_token,
				result.scope,
				result.client_id || result.clientId
			);
			verifyAndUseToken(result.access_token);
		} catch (error) {
			console.error('External Twitch OAuth failed:', error);
			showAuthButton();
		}
	}

	// Expose for remote control trigger
	try {
		window.__SSAPP_START_TWITCH_AUTH__ = startExternalTwitchAuthFlow;
	} catch (_) {}

	function buildTwitchMessageTextPlan(message, maxLength) {
		const parts = [];
		let remaining = Array.from(String(message || ''));
		while (remaining.length > maxLength) {
			let splitAt = remaining.slice(0, maxLength).lastIndexOf(' ');
			if (splitAt <= 0) {
				splitAt = maxLength;
			}
			const chunk = remaining.slice(0, splitAt).join('');
			remaining = remaining.slice(splitAt + (remaining[splitAt] === ' ' ? 1 : 0));
			parts.push({ message: chunk, remainingText: remaining.join('') });
		}
		if (remaining.length) {
			parts.push({ message: remaining.join(''), remainingText: '' });
		}
		return parts;
	}

	function buildTwitchChatSendPlan(message, maxLength = 500) {
		const normalizedMessage = String(message || '');
		const actionMatch = normalizedMessage.match(/^\/me(?:\s+|$)([\s\S]*)$/i);
		if (!actionMatch || !actionMatch[1]) {
			return buildTwitchMessageTextPlan(normalizedMessage, maxLength);
		}

		const actionPrefix = '/me ';
		const actionBodyLimit = maxLength - Array.from(actionPrefix).length;
		if (actionBodyLimit < 1) {
			return buildTwitchMessageTextPlan(normalizedMessage, maxLength);
		}
		return buildTwitchMessageTextPlan(actionMatch[1], actionBodyLimit)
			.map(part => ({
				message: actionPrefix + part.message,
				remainingText: part.remainingText ? actionPrefix + part.remainingText : ''
			}));
	}

	function hasTwitchScope(authUser, requiredScope) {
		return Array.isArray(authUser?.scopes) && authUser.scopes.includes(requiredScope);
	}

	async function sendTwitchMainChatChunk(message, allowTokenRetry = true) {
		if (!isTwitchChatConnected()) {
			throw new Error('Twitch chat is reconnecting. Message not sent.');
		}
		const token = getStoredToken();
		const senderId = currentAuthUser?.user_id;
		if (!token || !currentChannelId || !senderId) {
			throw new Error('Twitch chat is not connected.');
		}
		if (!hasTwitchScope(currentAuthUser, 'user:write:chat')) {
			throw new Error('Twitch sign-in is missing user:write:chat. Sign out and sign in again.');
		}

		const endpoint = 'https://api.twitch.tv/helix/chat/messages';
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TWITCH_CHAT_SEND_TIMEOUT_MS);
		let response;
		try {
			response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Client-ID': getTwitchApiClientId(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					broadcaster_id: currentChannelId,
					sender_id: senderId,
					message: message
				}),
				signal: controller.signal
			});
		} catch (error) {
			const sendError = new Error(
				controller.signal.aborted
					? 'Twitch did not confirm the send before it timed out. Delivery is unknown; check chat before retrying.'
					: 'The Twitch send connection failed. Delivery is unknown; check chat before retrying.'
			);
			sendError.code = controller.signal.aborted ? 'TWITCH_CHAT_SEND_TIMEOUT' : 'TWITCH_CHAT_SEND_NETWORK';
			sendError.deliveryUnknown = true;
			sendError.cause = error;
			throw sendError;
		} finally {
			clearTimeout(timeoutId);
		}

		if (response.status === 401 && allowTokenRetry) {
			const refreshedToken = await refreshAccessToken({ reason: 'chat-send' });
			if (refreshedToken && refreshedToken !== token) {
				return sendTwitchMainChatChunk(message, false);
			}
		}

		const responseData = await response.json().catch(() => ({}));
		if (!response.ok) {
			await handleTwitchApiAuthError(response, endpoint);
			throw new Error(responseData.message || `Twitch chat send failed (HTTP ${response.status}).`);
		}

		const result = Array.isArray(responseData.data) ? responseData.data[0] : null;
		if (!result?.is_sent || !result.message_id) {
			const dropMessage = result?.drop_reason?.message || 'Twitch did not accept the chat message.';
			throw new Error(dropMessage);
		}
		return result.message_id;
	}

	async function sendTwitchBotChatChunk(message, allowTokenRetry = true) {
		const token = getStoredBotToken();
		if (!token || !currentChannelId) {
			throw new Error('The Twitch automatic reply account is not connected.');
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TWITCH_CHAT_SEND_TIMEOUT_MS);
		let response;
		try {
			response = await fetch(TWITCH_BOT_SEND_URL, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					broadcaster_id: currentChannelId,
					message
				}),
				signal: controller.signal
			});
		} catch (error) {
			const sendError = new Error(
				controller.signal.aborted
					? 'Twitch did not confirm the bot reply before it timed out. Delivery is unknown; check chat before retrying.'
					: 'The Twitch bot reply connection failed. Delivery is unknown; check chat before retrying.'
			);
			sendError.code = controller.signal.aborted ? 'TWITCH_BOT_SEND_TIMEOUT' : 'TWITCH_BOT_SEND_NETWORK';
			sendError.deliveryUnknown = true;
			sendError.cause = error;
			throw sendError;
		} finally {
			clearTimeout(timeoutId);
		}

		if (response.status === 401 && allowTokenRetry) {
			const refreshedToken = await refreshBotAccessToken({ reason: 'chat-send' });
			if (refreshedToken && refreshedToken !== token) {
				return sendTwitchBotChatChunk(message, false);
			}
		}

		const responseData = await response.json().catch(() => ({}));
		if (!response.ok) {
			const botLogin = localStorage.getItem(TWITCH_BOT_LOGIN_KEY) || '';
			const botLabel = botLogin ? `@${botLogin}` : 'the bot account';
			const errorMessage = response.status === 403
				? `Twitch blocked automatic replies from ${botLabel}. Reconnect this WebSocket source's main Twitch account using the channel owner, or make ${botLabel} a moderator in this channel.`
				: responseData.message || responseData.error || `Twitch bot reply failed (HTTP ${response.status}).`;
			if (response.status === 403 && lastBotSendAuthorizationError !== errorMessage) {
				lastBotSendAuthorizationError = errorMessage;
				notifyBotAccountStatus({
					event: 'error',
					error: errorMessage,
					requiresMainReauthorization: true
				});
			}
			throw new Error(errorMessage);
		}

		const result = Array.isArray(responseData.data) ? responseData.data[0] : null;
		if (!result?.is_sent || !result.message_id) {
			const dropMessage = result?.drop_reason?.message || 'Twitch did not accept the bot reply.';
			throw new Error(dropMessage);
		}
		if (lastBotSendAuthorizationError) {
			lastBotSendAuthorizationError = '';
			notifyBotAccountStatus({ event: 'status', error: null, requiresMainReauthorization: false });
		}
		return result.message_id;
	}

	async function sendTwitchChatChunk(message, options = {}) {
		if (options.useBotAccount) {
			return sendTwitchBotChatChunk(message);
		}
		return sendTwitchMainChatChunk(message);
	}

	async function sendMessage(message, options = {}) {
		await modulesReady;
		const normalizedMessage = String(message || '');
		const useBotAccount = options.messageOrigin === 'chatbot' && !!getStoredBotToken();
		const unsentResult = {
			ok: false,
			acceptedChunks: 0,
			totalChunks: 0,
			remainingMessage: normalizedMessage
		};
		if (!checkAuthStatus()) {
			return unsentResult;
		}
		if (chatSendInFlight) {
			console.warn('Twitch chat send ignored because another send is already in progress.');
			return unsentResult;
		}
		if (!isTwitchChatConnected()) {
			const socketConnected = chatClient?.getState?.().status === 'connected';
			const unavailableMessage = socketConnected
				? 'Joining Twitch chat — sending unavailable.'
				: 'Reconnecting — sending unavailable.';
			setChatSendStatus(unavailableMessage, 'warning', 0, 'connection');
			updateChatComposerState();
			addEvent(unavailableMessage);
			return unsentResult;
		}
		if (!useBotAccount && !twitchChatWriteAuthorized) {
			const missingPermissionMessage = 'Twitch sign-in is missing chat permission. Sign out and sign in again.';
			setChatSendStatus(missingPermissionMessage, 'error', 0, 'connection');
			updateChatComposerState();
			addEvent(missingPermissionMessage);
			return unsentResult;
		}

		chatSendInFlight = true;
		updateChatComposerState();
		setChatSendStatus('Sending…', '', 0, 'send');
		const plan = buildTwitchChatSendPlan(normalizedMessage);
		const acceptedMessageIds = [];
		let acceptedChunks = 0;
		try {
			for (let index = 0; index < plan.length; index += 1) {
				const messageId = await sendTwitchChatChunk(plan[index].message, { useBotAccount });
				acceptedMessageIds.push(messageId);
				acceptedChunks += 1;
				if (index < plan.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 350));
				}
			}
			if (!plan.length) {
				setChatSendStatus('', '', 0, 'send');
				return unsentResult;
			}
			trackAcceptedTwitchChatMessages(acceptedMessageIds);
			return {
				ok: true,
				acceptedChunks,
				totalChunks: plan.length,
				remainingMessage: '',
				messageIds: acceptedMessageIds
			};
		} catch (error) {
			console.error('Failed to send Twitch chat message', error);
			const remainingMessage = acceptedChunks > 0
				? plan[acceptedChunks - 1]?.remainingText || ''
				: normalizedMessage;
			const errorMessage = error?.message || 'Failed to send Twitch chat message';
			let failureMessage = errorMessage;
			if (acceptedChunks > 0) {
				const acceptedSummary = `${acceptedChunks} of ${plan.length} ${plan.length === 1 ? 'part' : 'parts'} ${acceptedChunks === 1 ? 'was' : 'were'} accepted`;
				failureMessage = error?.deliveryUnknown
					? `${acceptedSummary}. Delivery of the next part is unknown; check Twitch before retrying the remaining draft.`
					: `${acceptedSummary} by Twitch. Only the unsent remainder was kept. ${errorMessage}`;
			}
			setChatSendStatus(failureMessage, error?.deliveryUnknown || acceptedChunks > 0 ? 'warning' : 'error', 0, 'send');
			addEvent(failureMessage);
			return {
				ok: false,
				acceptedChunks,
				totalChunks: plan.length,
				remainingMessage,
				messageIds: acceptedMessageIds,
				deliveryUnknown: error?.deliveryUnknown === true
			};
		} finally {
			chatSendInFlight = false;
			updateChatComposerState();
		}
	}
	sendTwitchMessageFromSsn = sendMessage;
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
					textIsSafe: false
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
					'Client-ID': getTwitchApiClientId(),
					'Authorization': `Bearer ${token}`
				}
			);
			
			// Fetch channel-specific badges
			const channelResponse = await fetchWithTimeout(
				`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${channelId}`,
				5000,
				{
					'Client-ID': getTwitchApiClientId(),
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

	function isTwitchHelixUrl(value) {
		try {
			return new URL(String(value || '')).hostname === 'api.twitch.tv';
		} catch (_) {
			return false;
		}
	}

	async function handleTwitchApiAuthError(response, requestUrl) {
		if (!response || !isTwitchHelixUrl(requestUrl)) {
			return;
		}
		if (response.status === 403) {
			console.warn('Twitch API permission denied; keeping OAuth token for other Twitch features.');
			return;
		}
		if (response.status !== 401) {
			return;
		}
		const token = getStoredToken();
		const stillValid = await validateStoredTokenWithoutSideEffects(token);
		if (stillValid) {
			console.warn('Twitch API rejected this request, but OAuth token is still valid; keeping sign-in.');
			return;
		}
		const refreshedToken = await refreshAccessToken({ reason: 'api-401' });
		if (refreshedToken) {
			console.warn('Twitch API rejected the previous token; refreshed OAuth token and kept sign-in.');
			return;
		}
		if (lastTokenRefreshFailure && !lastTokenRefreshFailure.permanent) {
			console.warn('Twitch token refresh temporarily failed after an API auth error; keeping credentials for retry.');
			return;
		}
		console.error('Twitch OAuth token failed validation after API auth error; clearing credentials.');
		handleTokenExpiration();
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
			
			await handleTwitchApiAuthError(response, URL);
			
			return response;
		} catch (e) {
			console.error(e); // Changed from errorlog to console.error
			return await fetch(URL); // iOS 11.x/12.0
		}
	}

	var channels = {};
	function getTwitchAvatarImage(usernome) {
		if (!usernome){return "";}
		if (channels[usernome]){return channels[usernome];}
		fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(usernome.replace("@",""))).then(response => {
			response.text().then(function(text) {
				if (text.startsWith("https://")) {
					channels[usernome] = text;
				}
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
		return "";
	}

	async function getTwitchMessageSourceInfo(tags, fallbackChannel) {
		const roomId = tags && tags['room-id'] ? String(tags['room-id']) : "";
		const sourceRoomId = tags && tags['source-room-id'] ? String(tags['source-room-id']) : "";
		let sourceInfo = null;

		if (sourceRoomId && sourceRoomId !== roomId) {
			sourceInfo = await getUserInfoById(sourceRoomId);
		}
		if (!sourceInfo && fallbackChannel) {
			sourceInfo = await getUserInfo(fallbackChannel);
		}

		return {
			name: sourceInfo?.login || sourceInfo?.display_name || fallbackChannel || "",
			image: sourceInfo?.profile_image_url || getTwitchAvatarImage(fallbackChannel)
		};
	}


	async function processMessage(parsedMessage) {
		try {
		//console.log("Processing message:", parsedMessage);
		const normalizedPayload = parsedMessage.__normalizedPayload || null;
		const normalizedEventType = normalizedPayload?.event;
		const normalizedEventTypeLower =
			typeof normalizedEventType === 'string' ? normalizedEventType.toLowerCase() : '';
		const user = parsedMessage.prefix.split('!')[0];
		let message = normalizedPayload?.rawMessage ?? parsedMessage.trailing;
		// Clean channel name from params (remove # prefix)
		if (parsedMessage.params[0]) {
			channel = parsedMessage.params[0].replace(/^#/, '');
		}
		const userInfo = await getUserInfo(user);
		const sourceInfo = await getTwitchMessageSourceInfo(parsedMessage.tags, channel);
		
		// Parse subscriber info from badge tags
		let subscriber = "";
		let subtitle = "";
		let mod = normalizedPayload?.isModerator === true
			|| normalizedPayload?.isOwner === true
			|| parsedMessage.tags?.mod === true
			|| parsedMessage.tags?.mod === 1
			|| parsedMessage.tags?.mod === '1'
			|| parsedMessage.tags?.mod === 'true';
		const badgeList = parseBadges(parsedMessage);
		
		if (parsedMessage.tags) {
			const badgeSources = [];
			if (typeof parsedMessage.tags.badges === 'string') {
				badgeSources.push(parsedMessage.tags.badges);
			}
			if (typeof parsedMessage.tags['source-badges'] === 'string') {
				badgeSources.push(parsedMessage.tags['source-badges']);
			}
			badgeSources.forEach(badgeSource => {
				badgeSource.split(',').forEach(badge => {
					if (!subscriber && badge.startsWith('subscriber/')) {
						subscriber = getSubscriberLabel();
						const months = badge.split('/')[1];
						if (months && months !== "0") {
							subtitle = months + (months === "1" ? "-Month" : "-Months");
						}
					} else if (badge.startsWith('moderator/') || badge.startsWith('broadcaster/')) {
						mod = true;
					}
				});
			});

			if (!subscriber && (parsedMessage.tags.subscriber === true || parsedMessage.tags.subscriber === '1' || parsedMessage.tags.subscriber === 'true' || normalizedPayload?.isSubscriber)) {
				subscriber = getSubscriberLabel();
				const badgeInfo = parsedMessage.tags['badge-info'] || parsedMessage.tags['source-badge-info'] || '';
				const subscriberInfo = typeof badgeInfo === 'string' ? badgeInfo.match(/(?:^|,)subscriber\/([^,]+)/) : null;
				const months = subscriberInfo && subscriberInfo[1];
				if (months && months !== "0") {
					subtitle = months + (months === "1" ? "-Month" : "-Months");
				}
			}
		}
		
		const isSubscriptionNoticeContext =
			normalizedEventTypeLower === 'resub' ||
			normalizedEventTypeLower === 'new_subscriber' ||
			normalizedEventTypeLower === 'subscription_gift' ||
			normalizedEventTypeLower === 'sub' ||
			normalizedEventTypeLower === 'subscribe' ||
			normalizedEventTypeLower === 'subgift' ||
			normalizedEventTypeLower === 'submysterygift' ||
			normalizedEventTypeLower === 'anonsubmysterygift' ||
			normalizedEventTypeLower === 'anonsubgift';
		const markSubscriberAsMembership = !!subscriber && (!settings.limitedtwitchmemberchat || isSubscriptionNoticeContext);

		// Apply member chat only filter if enabled
		if (settings.memberchatonly && !markSubscriberAsMembership) {
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
			await new Promise(resolve => setTimeout(resolve, TWITCH_DELAYTWITCH_MS));
		}
		
		// Parse bits/cheers from message
		let hasDonation = "";
		if (parsedMessage.tags && parsedMessage.tags.bits) {
			const bits = parseInt(parsedMessage.tags.bits);
			if (bits > 0) {
				hasDonation = formatBitAmount(bits);
			}
		}
		
		const sourceDisplayName = normalizedPayload?.chatname || (userInfo ? userInfo.display_name : user);
		let resolvedDisplayName = sourceDisplayName;
		let pluralmindResult = null;
		const pluralmindEligibleEvent = !normalizedEventTypeLower || ['message', 'chat', 'action', 'bits'].includes(normalizedEventTypeLower);
		if (settings.pluralmind && pluralmindEligibleEvent && message && !normalizedPayload?.contentimg && globalThis.SSNPluralmindIntegration) {
			// Render native emotes against the original offsets before stripping proxy text.
			pluralmindResult = await globalThis.SSNPluralmindIntegration.resolveRenderedMessage({
				userId: normalizedPayload?.userId || parsedMessage.tags?.['user-id'],
				username: user,
				message: replaceEmotesWithImages(message, parsedMessage.tags?.emotes, !!parsedMessage.tags?.bits),
				textOnly: !!settings.textonlymode
			});
			if (pluralmindResult) {
				resolvedDisplayName = pluralmindResult.name;
				message = pluralmindResult.body;
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
		
		rememberTwitchDisplayName(user, sourceDisplayName);
		span.innerHTML = `${badgeHtml}${escapeHtml(resolvedDisplayName)}: ${displayMessage}`;
		document.querySelector("#textarea").appendChild(span);
		if (document.querySelector("#textarea").childNodes.length > 10) {
			document.querySelector("#textarea").childNodes[0].remove();
		}

		var data = {};
		// Chat messages must never set data.event; reserve it for true system events (raids, cheers, /me actions, etc.).
		if (normalizedEventType && normalizedEventTypeLower !== 'message' && normalizedEventTypeLower !== 'chat') {
			data.event = normalizedEventType;
		}
		data.chatname = resolvedDisplayName;
		data.username = user;
		if (normalizedPayload?.userId) {
			data.userid = normalizedPayload.userId;
		}
		data.contentimg = normalizedPayload?.contentimg || "";
		const normalizedMeta = normalizedPayload && normalizedPayload.meta;
		if (normalizedMeta && typeof normalizedMeta === "object" && !Array.isArray(normalizedMeta)) {
			data.meta = Object.assign({}, normalizedMeta);
		}
		
		// Convert badge URLs to badge objects
		data.chatbadges = badgeList.map(url => ({ type: "img", src: url }));
		if (pluralmindResult) {
			const pluralmindPronounBadge = globalThis.SSNPluralmindIntegration.createPronounBadge(pluralmindResult.pronouns);
			if (pluralmindPronounBadge) {
				data.chatbadges.push(pluralmindPronounBadge);
			}
		}
		
		data.backgroundColor = "";
		data.textColor = parsedMessage.tags?.color || "";
		data.nameColor = pluralmindResult?.color || parsedMessage.tags?.color || "";
		
		// Parse Twitch emotes from tags
		const twitchEmotes =
			parsedMessage?.tags && parsedMessage.tags.emotes
				? parsedMessage.tags.emotes
				: null;
		
		// Check if this is a bit message
		const isBitMessage = !!(parsedMessage.tags && parsedMessage.tags.bits);
		const renderedMessage = pluralmindResult ? pluralmindResult.cleanedMessage : replaceEmotesWithImages(message, twitchEmotes, isBitMessage);
		
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
				data.chatmessage = replyMessage + ": " + renderedMessage;
			} else {
				data.chatmessage = "<i><small>" + escapeHtml(replyMessage) + ":&nbsp;</small></i> " + renderedMessage;
			}
		} else {
			data.chatmessage = renderedMessage;
		}
		if (data.contentimg) {
			data.chatmessage = "";
			data.meta = data.meta || {};
			if (!("gifLabel" in data.meta)) {
				data.meta.gifLabel = message || "";
			}
		}
		
		data.membership = markSubscriberAsMembership ? subscriber : "";
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
		if (sourceInfo.image) {
			data.sourceImg = sourceInfo.image;
		}
		if (sourceInfo.name) {
			data.sourceName = sourceInfo.name;
		}
		data.textonly = settings.textonlymode || false;
		data.type = "twitch";
		
		if (hasDonation) {
			data.title = getTranslation("cheers", "CHEERS");
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
		const normalizedPayload = parsedMessage.__normalizedPayload || null;
		const useTranslatedNoticeText = !!(normalizedPayload && settings.translation);
		
		let eventData = {
			type: "twitch",
			event: true,
			textonly: settings.textonlymode || false
		};
		
		switch(msgId) {
			case 'raid':
				const raidViewerCount = parsedMessage.tags['msg-param-viewerCount'] || '0';
				const raidMessage = formatTranslation('twitch-raid-with-viewers', '{name} is raiding with {viewers} viewers!', {
					name: displayName,
					viewers: raidViewerCount
				});
				eventData.chatmessage = useTranslatedNoticeText ? raidMessage : (systemMsg || raidMessage);
				eventData.event = 'raid';
				addEvent(`Raid: ${displayName} with ${raidViewerCount} viewers`);
				break;
				
			case 'sub':
			case 'resub':
				const subscriptionMessage = msgId === 'sub'
					? formatTranslation('twitch-subscribed-message', '{name} has subscribed', { name: displayName })
					: formatTranslation('twitch-resubscribed-message', '{name} resubscribed', { name: displayName });
				eventData.chatmessage = useTranslatedNoticeText ? subscriptionMessage : (systemMsg || subscriptionMessage);
				eventData.event = msgId === 'sub' ? 'new_subscriber' : 'resub';
				eventData.membership = getSubscriberLabel();
				if (parsedMessage.trailing) {
					eventData.chatmessage += " - " + parsedMessage.trailing;
				}
				addEvent(`${msgId === 'sub' ? 'Subscribe' : 'Resub'}: ${displayName}`);
				break;
				
			case 'subgift':
			case 'anonsubgift':
			case 'submysterygift':
			case 'anonsubmysterygift':
				const giftRecipient = parsedMessage.tags['msg-param-recipient-display-name'] ||
					parsedMessage.tags['msg-param-recipient-user-name'] ||
					(normalizedPayload && normalizedPayload.raw && normalizedPayload.raw.recipient) ||
					(normalizedPayload && normalizedPayload.recipient) ||
					'';
				const giftMessage = formatTranslation('twitch-gifted-a-sub-message', '{name} gifted a sub', {
					name: displayName || getTranslation('someone', 'Someone')
				});
				const giftMessageWithRecipient = giftRecipient
					? giftMessage + ' ' + getTranslation('membership-to-word', 'to') + ' ' + giftRecipient
					: giftMessage;
				eventData.chatmessage = useTranslatedNoticeText ? giftMessageWithRecipient : (systemMsg || giftMessageWithRecipient);
				eventData.event = 'subscription_gift';
				eventData.membership = getSubscriberLabel();
				addEvent(`Gift Sub: ${displayName || 'Anonymous'}`);
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
		const channelName = channelInput.value.trim().replace(/^#/, '') || username;
		if (channelName) {
			localStorage.setItem('twitchChannel', channelName);
			channel = channelName;
			channelFromUrl = false;
			syncThirdPartyEmotesForChannel(true);
			channelInput.value = '';
			await connect();
		}
	});

	if (document.getElementById('channel-input')){
		document.getElementById('channel-input').addEventListener('keypress', async function(event) {
			// Check if the pressed key is Enter (key code 13)
			if (event.key === 'Enter' || event.keyCode === 13) {
				const channelInput = document.getElementById('channel-input');
				const channelName = channelInput.value.trim().replace(/^#/, '') || username;
				if (channelName) {
					localStorage.setItem('twitchChannel', channelName);
					channel = channelName;
					channelFromUrl = false;
					syncThirdPartyEmotesForChannel(true);
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
			if (data.type && data.event) {
				updateStats(data.event, data);
			}

			// Keep local UI stats updated, but only relay viewer updates when enabled.
			const viewerGateOpen = Boolean(
				settings &&
				typeof settings === 'object' &&
				(settings.showviewercount || settings.hypemode)
			);
			if (data.event === 'viewer_update' && !viewerGateOpen) {
				return;
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
		
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response) {
			settings = response.settings;
			syncThirdPartyEmotesForChannel(false);
		}
		if ("state" in response) {
			isExtensionOn = response.state;
		}
		initializePage();
	});

	console.log("INJECTED WEBSOCKETS");

	// Handle messages from preload-mock.js which uses window.postMessage instead of chrome.runtime
	// This is needed when chrome.runtime is deleted for Kasada bypass
	window.addEventListener('message', function(event) {
		if (!event.data || typeof event.data !== 'object') return;
		if (!event.data.__ssappSendToTab) return;

		var request = event.data.__ssappSendToTab;
		if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
			sendMessage(request.message, { messageOrigin: request.messageOrigin }).catch(function(err) {
				console.error('Twitch SEND_MESSAGE via postMessage failed', err);
			});
		} else if (request.type === 'TWITCH_BOT_ACCOUNT_CONNECT') {
			connectTwitchBotAccount().catch(function(err) {
				console.error('Twitch bot account connection via postMessage failed', err);
			});
		} else if (request.type === 'TWITCH_BOT_ACCOUNT_DISCONNECT') {
			disconnectTwitchBotAccount();
		}
	});

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
					'Client-ID': getTwitchApiClientId(),
					'Authorization': `Bearer ${token}`
				}
			);

			const data = await response.json();
			if (data.data && data.data[0]) {
				lastKnownViewers = data.data[0].viewer_count;
			} else if (lastKnownViewers === null) {
				lastKnownViewers = 0;
			}
		} catch (error) {
			console.error('Error fetching viewer count:', error);
			if (lastKnownViewers === null) {
				lastKnownViewers = 0;
			}
		}
		pushMessage({
			type: 'twitch',
			event: 'viewer_update',
			meta: lastKnownViewers
		});
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
					'Client-ID': getTwitchApiClientId(),
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
					'Client-ID': getTwitchApiClientId(),
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
	let activeSubscriptions = new Set();
	let eventSubRetryCount = 0;
	let hasPermissionError = [];
	let eventSubReconnectInProgress = false;
	let eventSubPreviousSocket = null;
	let eventSubKeepaliveTimer = null;
	let eventSubKeepaliveTimeoutSeconds = 10;
	const EVENTSUB_RECONNECT_BASE_DELAY_MS = 1000;
	const EVENTSUB_RECONNECT_MAX_DELAY_MS = 30000;
	const EVENTSUB_KEEPALIVE_GRACE_MS = 5000;
	const EVENTSUB_WELCOME_TIMEOUT_MS = 15000;

	function setEventSubSocket(socket) {
		eventSocket = socket || null;
		try {
			window.eventSocket = eventSocket;
		} catch (_) {}
	}

	function clearEventSubKeepaliveTimer() {
		if (eventSubKeepaliveTimer) {
			clearTimeout(eventSubKeepaliveTimer);
			eventSubKeepaliveTimer = null;
		}
	}

	function armEventSubKeepaliveWatchdog(socket) {
		clearEventSubKeepaliveTimer();
		const timeoutSeconds = Number(eventSubKeepaliveTimeoutSeconds);
		if (!socket || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
			return;
		}
		eventSubKeepaliveTimer = setTimeout(function() {
			if (isDisconnecting || socket !== eventSocket) {
				return;
			}
			console.warn('EventSub keepalive timed out; reconnecting.');
			setEventSubSocket(null);
			eventSessionId = null;
			eventSubReconnectInProgress = false;
			activeSubscriptions.clear();
			try {
				socket.close();
			} catch (_) {}
			scheduleEventSubReconnect('keepalive timeout');
		}, timeoutSeconds * 1000 + EVENTSUB_KEEPALIVE_GRACE_MS);
	}

	function scheduleEventSubReconnect(reason) {
		if (isDisconnecting || reconnectTimeout) {
			return;
		}
		const delay = Math.min(
			EVENTSUB_RECONNECT_MAX_DELAY_MS,
			EVENTSUB_RECONNECT_BASE_DELAY_MS * (2 ** Math.min(eventSubRetryCount, 5))
		);
		eventSubRetryCount += 1;
		console.log(`EventSub reconnect scheduled in ${Math.round(delay / 1000)} seconds${reason ? ` (${reason})` : ''}.`);
		reconnectTimeout = setTimeout(function() {
			reconnectTimeout = null;
			connectEventSub().catch(function(error) {
				console.error('EventSub reconnect failed:', error);
				scheduleEventSubReconnect('connection failed');
			});
		}, delay);
	}

async function cleanupCurrentConnection() {
	isDisconnecting = true;
		
		// Clear any existing timeouts
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
		clearEventSubKeepaliveTimer();

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
		
		const socketsToClose = new Set([eventSocket, eventSubPreviousSocket].filter(Boolean));
		socketsToClose.forEach(function(socket) {
			if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
				try {
					socket.close();
				} catch (_) {}
			}
		});
		setEventSubSocket(null);
		eventSubPreviousSocket = null;
		eventSessionId = null;
		eventSubReconnectInProgress = false;

		// Reset states
		eventSubRetryCount = 0;
		hasPermissionError = [];
		activeSubscriptions.clear();
		currentChannelId = null;
		currentAuthUser = null;
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

	function initializeEventSubSocket(url, options = {}) {
		const previousSocket = options.previousSocket || null;
		const socket = new WebSocket(url);
		let receivedWelcome = false;
		const welcomeTimer = setTimeout(function() {
			if (receivedWelcome || isDisconnecting || socket !== eventSocket) {
				return;
			}
			console.warn('EventSub did not send a welcome message in time.');
			if (previousSocket && previousSocket.readyState === WebSocket.OPEN) {
				setEventSubSocket(previousSocket);
				eventSubPreviousSocket = null;
				eventSubReconnectInProgress = false;
				armEventSubKeepaliveWatchdog(previousSocket);
				try {
					socket.close();
				} catch (_) {}
				return;
			}
			setEventSubSocket(null);
			eventSessionId = null;
			eventSubReconnectInProgress = false;
			activeSubscriptions.clear();
			try {
				socket.close();
			} catch (_) {}
			scheduleEventSubReconnect('welcome timeout');
		}, EVENTSUB_WELCOME_TIMEOUT_MS);

		socket.onopen = () => {
			console.log('EventSub WebSocket Connected');
		};

		socket.onmessage = async (event) => {
			if (isDisconnecting) return;

			let message;
			try {
				message = JSON.parse(event.data);
			} catch (error) {
				console.warn('Ignoring malformed EventSub message:', error);
				return;
			}

			if (socket === eventSocket && receivedWelcome) {
				armEventSubKeepaliveWatchdog(socket);
			}

			switch (message.metadata?.message_type) {
				case 'session_welcome': {
					if (socket !== eventSocket) return;
					receivedWelcome = true;
					clearTimeout(welcomeTimer);
					eventSessionId = message.payload.session.id;
					const keepaliveSeconds = Number(message.payload.session.keepalive_timeout_seconds);
					if (Number.isFinite(keepaliveSeconds) && keepaliveSeconds > 0) {
						eventSubKeepaliveTimeoutSeconds = keepaliveSeconds;
					}
					armEventSubKeepaliveWatchdog(socket);
					eventSubRetryCount = 0;
					eventSubReconnectInProgress = false;
					console.log('EventSub session established:', eventSessionId);

					if (previousSocket) {
						if (eventSubPreviousSocket === previousSocket) {
							eventSubPreviousSocket = null;
						}
						try {
							previousSocket.onopen = previousSocket.onmessage = previousSocket.onerror = previousSocket.onclose = null;
							previousSocket.close();
						} catch (_) {}
					} else {
						activeSubscriptions.clear();
						if (currentChannelId) {
							await createEventSubSubscriptions(currentChannelId);
						}
					}
					break;
				}

				case 'notification':
					handleEventSubNotification(message.payload);
					break;

				case 'session_keepalive':
					break;

				case 'session_reconnect': {
					if (socket !== eventSocket || eventSubReconnectInProgress) return;
					const reconnectUrl = message.payload?.session?.reconnect_url;
					if (!reconnectUrl) {
						console.warn('EventSub provided no reconnect URL; staying on current socket.');
						return;
					}
					console.log('EventSub requested reconnect. Opening the replacement socket...');
					eventSubReconnectInProgress = true;
					eventSubPreviousSocket = socket;
					clearEventSubKeepaliveTimer();
					try {
						setEventSubSocket(initializeEventSubSocket(reconnectUrl, { previousSocket: socket }));
					} catch (error) {
						console.error('Unable to open EventSub replacement socket:', error);
						eventSubPreviousSocket = null;
						eventSubReconnectInProgress = false;
						armEventSubKeepaliveWatchdog(socket);
					}
					break;
				}
			}
		};

		socket.onerror = (error) => {
			if (!isDisconnecting) {
				console.error('EventSub WebSocket Error:', error);
			}
		};

		socket.onclose = () => {
			clearTimeout(welcomeTimer);
			if (isDisconnecting) return;

			if (socket !== eventSocket) {
				if (socket === eventSubPreviousSocket) {
					eventSubPreviousSocket = null;
				}
				return;
			}

			clearEventSubKeepaliveTimer();
			if (previousSocket && previousSocket.readyState === WebSocket.OPEN) {
				console.warn('EventSub replacement socket closed before hand-off; keeping the original socket.');
				setEventSubSocket(previousSocket);
				eventSubPreviousSocket = null;
				eventSubReconnectInProgress = false;
				armEventSubKeepaliveWatchdog(previousSocket);
				return;
			}

			setEventSubSocket(null);
			eventSessionId = null;
			eventSubReconnectInProgress = false;
			activeSubscriptions.clear();
			scheduleEventSubReconnect('socket closed');
		};

		return socket;
	}

	async function connectEventSub() {
		if (isDisconnecting) return;

		if (eventSocket && (eventSocket.readyState === WebSocket.OPEN || eventSocket.readyState === WebSocket.CONNECTING)) {
			return;
		}

		eventSessionId = null;
		activeSubscriptions.clear();
		setEventSubSocket(initializeEventSubSocket('wss://eventsub.wss.twitch.tv/ws'));
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
			if (isTransientTokenValidationError(authUser)) return;
			if (!authUser) return;

			const permissions = await checkUserPermissions(broadcasterId, authUser.user_id);
			
			// Define subscriptions based on permissions
			const subscriptionTypes = [];
			
			if (permissions.canViewFollowers && permissions.hasFollowerReadScope && !activeSubscriptions.has('channel.follow')) {
				subscriptionTypes.push({
					type: 'channel.follow',
					version: '2',
					condition: {
						broadcaster_user_id: broadcasterId,
						moderator_user_id: authUser.user_id
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

			// Cheers and Power-ups
			if (permissions.isBroadcaster && permissions.canReadBits && !activeSubscriptions.has('channel.bits.use')) {
				subscriptionTypes.push({
					type: 'channel.bits.use',
					version: '1',
					condition: {
						broadcaster_user_id: broadcasterId
					}
				});
			}

			if (permissions.canModerate && permissions.hasChannelModerateScope && !activeSubscriptions.has('channel.ban')) {
				subscriptionTypes.push({
					type: 'channel.ban',
					version: '1',
					condition: {
						broadcaster_user_id: broadcasterId
					}
				});
			}

			// Channel points redemptions
			if (permissions.isBroadcaster && permissions.canReadRedemptions && !activeSubscriptions.has('channel.channel_points_custom_reward_redemption.add')) {
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
			if (permissions.isBroadcaster && (permissions.canReadAds || permissions.canManageAds) && !activeSubscriptions.has('channel.ad_break.begin')) {
				subscriptionTypes.push({
					type: 'channel.ad_break.begin',
					version: '1',
					condition: { broadcaster_user_id: broadcasterId }
				});
			}

			if (permissions.canReadHypeTrain) {
				for (const t of ['channel.hype_train.begin', 'channel.hype_train.progress', 'channel.hype_train.end']) {
					if (!activeSubscriptions.has(t)) {
						subscriptionTypes.push({
							type: t,
							version: '2',
							condition: { broadcaster_user_id: broadcasterId }
						});
					}
				}
			}

			// Create each subscription
			for (const subscription of subscriptionTypes) {
				if (hasPermissionError.includes(subscription.type)) { // previously failed permissions that got us kicked
					console.log("Skipping "+subscription.type);
					continue;
				}
				try {
					const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
						method: 'POST',
						headers: {
							'Client-ID': getTwitchApiClientId(),
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
							hasPermissionError.push(subscription.type);
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

	function normalizeHypeTrainNumber(value) {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : null;
	}

	function normalizeHypeTrainContribution(contribution) {
		if (!contribution || typeof contribution !== 'object') return null;
		return {
			userId: contribution.user_id || '',
			userLogin: contribution.user_login || '',
			userName: contribution.user_name || '',
			type: contribution.type || '',
			total: normalizeHypeTrainNumber(contribution.total)
		};
	}

	function normalizeHypeTrainContributions(contributions) {
		if (!Array.isArray(contributions)) return [];
		return contributions
			.map(normalizeHypeTrainContribution)
			.filter(Boolean);
	}

	function buildHypeTrainMeta(event, eventSubType) {
		const phase = eventSubType === 'channel.hype_train.begin'
			? 'begin'
			: eventSubType === 'channel.hype_train.end'
				? 'end'
				: 'progress';
		return {
			phase,
			id: event.id || '',
			broadcasterUserId: event.broadcaster_user_id || '',
			broadcasterUserLogin: event.broadcaster_user_login || '',
			broadcasterUserName: event.broadcaster_user_name || '',
			total: normalizeHypeTrainNumber(event.total),
			progress: normalizeHypeTrainNumber(event.progress),
			goal: normalizeHypeTrainNumber(event.goal),
			level: normalizeHypeTrainNumber(event.level),
			topContributions: normalizeHypeTrainContributions(event.top_contributions),
			lastContribution: normalizeHypeTrainContribution(event.last_contribution),
			sharedTrainParticipants: Array.isArray(event.shared_train_participants) ? event.shared_train_participants : [],
			startedAt: event.started_at || '',
			expiresAt: event.expires_at || '',
			endedAt: event.ended_at || '',
			cooldownEndsAt: event.cooldown_ends_at || '',
			isSharedTrain: event.is_shared_train === true,
			trainType: event.type || 'regular',
			allTimeHighLevel: normalizeHypeTrainNumber(event.all_time_high_level),
			allTimeHighTotal: normalizeHypeTrainNumber(event.all_time_high_total),
			eventSubType
		};
	}

	function getEventSubMessageText(message) {
		if (typeof message === 'string') {
			return message;
		}
		if (message && typeof message.text === 'string') {
			return message.text;
		}
		return '';
	}

	function getEventSubUserAvatarUrl(event) {
		if (!event || event.is_anonymous === true) {
			return '';
		}
		const login = event.user_login || event.user_name || '';
		return login
			? `https://api.socialstream.ninja/twitch/large?username=${encodeURIComponent(login)}`
			: '';
	}

	function forwardEventSubCheer(event) {
		pushMessage({
			type: "twitch",
			event: 'cheer',
			chatname: event.user_name || 'Anonymous',
			chatimg: getEventSubUserAvatarUrl(event),
			userid: event.user_id,
			bits: event.bits,
			chatmessage: getEventSubMessageText(event.message),
			hasDonation: formatBitAmount(event.bits),
			meta: { userId: event.user_id, bits: event.bits },
			title: getTranslation("cheers", "CHEERS"),
			textonly: settings.textonlymode || false
		});
		addEvent(`Cheer: ${event.user_name || 'Anonymous'} cheered ${event.bits} bits`);
	}

	function buildPowerUpMeta(event) {
		const powerUp = {
			type: event.type || 'power_up'
		};
		let title = '';

		if (event.custom_power_up) {
			title = event.custom_power_up.title || '';
			powerUp.title = title;
			powerUp.rewardId = event.custom_power_up.reward_id || '';
		} else if (event.power_up) {
			const powerUpType = event.power_up.type || '';
			const labels = {
				message_effect: 'Message Effect',
				celebration: 'On-Screen Celebration',
				gigantify_an_emote: 'Gigantify an Emote'
			};
			title = labels[powerUpType] || 'Power-up';
			powerUp.powerUpType = powerUpType;
			if (event.power_up.emote) {
				powerUp.emote = {
					id: event.power_up.emote.id || '',
					name: event.power_up.emote.name || ''
				};
			}
			if (event.power_up.message_effect_id) {
				powerUp.messageEffectId = event.power_up.message_effect_id;
			}
		}

		const messageText = getEventSubMessageText(event.message);
		if (messageText) {
			powerUp.messageText = messageText;
		}

		return {
			title: title || 'Power-up',
			powerUp
		};
	}

	function forwardEventSubPowerUp(event) {
		const details = buildPowerUpMeta(event);
		const userName = event.user_name || 'Someone';
		const bits = parseInt(event.bits, 10) || 0;
		pushMessage({
			type: 'twitch',
			event: 'powerup',
			chatname: userName,
			userid: event.user_id,
			chatmessage: '',
			meta: {
				userId: event.user_id,
				userLogin: event.user_login || '',
				bits,
				powerUp: details.powerUp
			},
			textonly: settings.textonlymode || false
		});
		addEvent(`Power-up: ${userName} used ${details.title} (${formatBitAmount(bits)})`);
	}

	function handleEventSubNotification(payload) {
		const event = payload.event;
		const subscription = payload.subscription;
		
		// Skip non-donation events if hideevents is enabled.
		const isDonationEvent = subscription && (
			subscription.type === 'channel.cheer' ||
			(subscription.type === 'channel.bits.use' && event && event.type === 'cheer')
		);
		if (settings.hideevents && !isDonationEvent) {
			return;
		}

		switch (subscription.type) {
		case 'channel.follow':
			const followMessage = formatTranslation('twitch-started-following-message', '{name} has started following', {
				name: event.user_name
			});
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
			const subscribeMessage = event.tier
				? formatTranslation('twitch-subscribed-at-tier-message', '{name} has subscribed at tier {tier}', {
					name: event.user_name,
					tier: event.tier
				})
				: formatTranslation('twitch-subscribed-message', '{name} has subscribed', {
					name: event.user_name
				});
			pushMessage({
				type: "twitch",
				event: 'new_subscriber',
				membership: getSubscriberLabel(),
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
					membership: getSubscriberLabel(),
					chatname: event.user_name,
					userid: event.user_id,
					chatmessage: event.message?.text || formatTranslation('twitch-resubscribed-message', '{name} resubscribed', {
						name: event.user_name
					}),
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
					membership: getSubscriberLabel(),
					chatname: event.user_name,
					chatmessage: formatTranslation('twitch-gifted-subs-message', '{name} has gifted {total} tier {tier} subs!', {
						name: event.user_name,
						total: event.total,
						tier: event.tier
					}),
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
				forwardEventSubCheer(event);
				break;
			case 'channel.bits.use':
				if (event.type === 'cheer') {
					forwardEventSubCheer(event);
				} else if (event.type === 'power_up' || event.type === 'custom_power_up') {
					forwardEventSubPowerUp(event);
				}
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
					event: 'reward',
					chatname: event.user_name,
					userid: event.user_id,
					chatmessage: rewardMessage,
					timestamp: event.redeemed_at,
					meta: {
						userId: event.user_id,
						rewardId: event.reward.id,
						rewardTitle: rewardTitle,
						cost: rewardCost,
						prompt: event.reward.prompt,
						userInput: userInput,
						backgroundColor: event.reward.background_color,
						redemptionId: event.id,
						status: event.status,
						alias: 'channel_points'
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
					chatmessage: formatTranslation('twitch-raiding-with-viewers', 'Raiding with {viewers} viewers!', {
						viewers: event.viewers
					}),
					meta: {
						fromId: event.from_broadcaster_user_id,
						fromLogin: event.from_broadcaster_user_login,
						viewers: event.viewers
					},
					textonly: settings.textonlymode || false
				});
				addEvent(`Raid: ${event.from_broadcaster_user_name} with ${event.viewers} viewers`);
				break;

			case 'channel.ban':
				const deletePayload = { type: 'twitch', chatname: event.user_name || event.user_login };
				if (settings.pluralmind) {
					deletePayload.userid = event.user_id;
					deletePayload.username = event.user_login;
					deletePayload.meta = { pluralmind: true };
				}
				pushDeleteMessage(deletePayload);
				pushTwitchBanMetaEvent({
					username: event.user_login,
					displayName: event.user_name,
					userId: event.user_id,
					moderator: event.moderator_user_name || event.moderator_user_login,
					moderatorId: event.moderator_user_id,
					reason: event.reason,
					bannedAt: event.banned_at,
					endsAt: event.ends_at,
					permanent: event.is_permanent === true
				});
				addEvent(`Ban: ${event.user_name || event.user_login}`);
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

			case 'channel.hype_train.begin':
			case 'channel.hype_train.progress':
			case 'channel.hype_train.end':
				const hypeTrainMeta = buildHypeTrainMeta(event, subscription.type);
				pushMessage({
					type: 'twitch',
					event: 'hype_train',
					meta: hypeTrainMeta
				});
				if (hypeTrainMeta.phase !== 'progress') {
					addEvent(`Hype Train ${hypeTrainMeta.phase}: Level ${hypeTrainMeta.level || 0}`);
				}
				break;
		}
	}

	// --- Moderation & Ads (stubs + API wiring) ---
	async function getUserIdByLogin(login) {
		const info = await getUserInfo(login);
		return info?.id || null;
	}

	async function getCurrentModerator() {
		const token = getStoredToken();
		if (!token || !currentChannelId) {
			return null;
		}
		const moderator = await validateToken(token);
		return isTransientTokenValidationError(moderator) ? null : moderator;
	}

	async function getCurrentChannelInformation() {
		const token = getStoredToken();
		if (!token || !currentChannelId) {
			return null;
		}
		try {
			const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${currentChannelId}`, {
				headers: {
					'Client-ID': getTwitchApiClientId(),
					'Authorization': `Bearer ${token}`
				}
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				console.error('getCurrentChannelInformation failed', data);
				return null;
			}
			return data?.data?.[0] || null;
		} catch (error) {
			console.error('getCurrentChannelInformation error', error);
			return null;
		}
	}

	async function resolveGameId(category) {
		const query = (category || '').trim();
		if (!query) {
			return null;
		}
		if (/^\d+$/.test(query)) {
			return query;
		}
		const token = getStoredToken();
		if (!token) {
			return null;
		}
		try {
			const response = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}`, {
				headers: {
					'Client-ID': getTwitchApiClientId(),
					'Authorization': `Bearer ${token}`
				}
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				console.error('resolveGameId failed', data);
				return null;
			}
			const items = Array.isArray(data?.data) ? data.data : [];
			const exactMatch = items.find((item) => (item?.name || '').toLowerCase() === query.toLowerCase());
			return (exactMatch || items[0] || {}).id || null;
		} catch (error) {
			console.error('resolveGameId error', error);
			return null;
		}
	}

	async function refreshChannelInformation() {
		const channelInfo = await getCurrentChannelInformation();
		if (!channelInfo) {
			return null;
		}
		const payload = {
			title: channelInfo.title || '',
			category: channelInfo.game_name || '',
			categoryId: channelInfo.game_id || ''
		};
		notifyPage('channel_info', payload);
		return payload;
	}

	async function updateChannelInformation(payload = {}) {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId) return false;
			const requestBody = {};
			const title = (payload?.title || '').trim();
			const category = (payload?.category || '').trim();
			if (title) {
				requestBody.title = title;
			}
			if (category) {
				const gameId = await resolveGameId(category);
				if (!gameId) {
					addEvent(`Category lookup failed: ${category}`);
					return false;
				}
				requestBody.game_id = gameId;
			}
			if (!Object.keys(requestBody).length) {
				return false;
			}
			const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${currentChannelId}`, {
				method: 'PATCH',
				headers: {
					'Client-ID': getTwitchApiClientId(),
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('updateChannelInformation failed', errorData);
				addEvent('Stream title/category update failed');
				return false;
			}
			await refreshChannelInformation();
			addEvent('Stream title/category updated');
			return true;
		} catch (error) {
			console.error('updateChannelInformation error', error);
			addEvent('Stream title/category update failed');
			return false;
		}
	}

	async function deleteChatMessage(messageId) {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId || !messageId) return false;
			const moderator = await getCurrentModerator();
			if (!moderator?.user_id) {
				return false;
			}
			const response = await fetch(`https://api.twitch.tv/helix/moderation/chat?broadcaster_id=${currentChannelId}&moderator_id=${moderator.user_id}&message_id=${encodeURIComponent(messageId)}`, {
				method: 'DELETE',
				headers: {
					'Client-ID': getTwitchApiClientId(),
					'Authorization': `Bearer ${token}`
				}
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('deleteChatMessage failed', errorData);
				return false;
			}
			return true;
		} catch (error) {
			console.error('deleteChatMessage error', error);
			return false;
		}
	}

	async function banUserById(userId, duration = 0, reason = '') {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId || !userId) return false;
			const moderator = await getCurrentModerator();
			if (!moderator?.user_id) {
				return false;
			}
			const res = await fetch(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${currentChannelId}&moderator_id=${moderator.user_id}`,
				{
					method: 'POST',
					headers: { 'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: { user_id: String(userId), duration: duration || undefined, reason: reason || undefined } })
				}
			);
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				console.error('banUserById failed', errorData);
			}
			return res.ok;
		} catch(e) { console.error('banUserById error', e); return false; }
	}

	async function banUser(login, duration = 0, reason = '') {
		try {
			const userId = await getUserIdByLogin(login);
			if (!userId) return false;
			return banUserById(userId, duration, reason);
		} catch(e) { console.error('banUser error', e); return false; }
	}

	async function unbanUser(login) {
		try {
			const token = getStoredToken();
			if (!token || !currentChannelId) return false;
			const moderator = await validateToken(token);
			if (!moderator || isTransientTokenValidationError(moderator)) return false;
			const userId = await getUserIdByLogin(login);
			if (!userId) return false;
			const res = await fetch(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${currentChannelId}&moderator_id=${moderator.user_id}&user_id=${userId}`,
				{ method: 'DELETE', headers: { 'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}` } }
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
				headers: { 'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
				headers: { 'Client-ID': getTwitchApiClientId(), 'Authorization': `Bearer ${token}` }
			});
			const data = await res.json();
			if (res.ok) {
				addEvent('Ad Schedule updated');
				pushMessage({ type: 'twitch', event: 'ad_schedule', meta: data?.data?.[0] || data });
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
						'Client-ID': getTwitchApiClientId(),
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
						'Client-ID': getTwitchApiClientId(),
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
			canViewFollowers: isBroadcaster || isModerator,
			hasFollowerReadScope: !!scopes['moderator:read:followers'],
			canManageChat: (isBroadcaster || isModerator) && (scopes['moderator:manage:chat_messages'] || isBroadcaster),
			canBanUsers: (isBroadcaster || isModerator) && (scopes['moderator:manage:banned_users'] || isBroadcaster),
			canDeleteMessages: (isBroadcaster || isModerator) && (scopes['moderator:manage:chat_messages'] || isBroadcaster),
			canViewSubscribers: isBroadcaster && !!scopes['channel:read:subscriptions'],
			hasSubscriptionProgram: broadcasterInfo?.partner || broadcasterInfo?.broadcaster_type === 'affiliate',
			canModerate: isBroadcaster || isModerator,
			hasChannelModerateScope: !!scopes['channel:moderate'],
			canManageBroadcast: isBroadcaster && !!scopes['channel:manage:broadcast'],
			canManageAds: !!scopes['channel:manage:ads'],
			canReadAds: !!scopes['channel:read:ads'],
			canReadBits: !!scopes['bits:read'],
			canReadRedemptions: !!scopes['channel:read:redemptions'],
			canReadHypeTrain: isBroadcaster && !!scopes['channel:read:hype_train'],
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
			moderationRequirements: document.getElementById('moderation-requirements'),
			permissionsInfo: document.getElementById('permissions-info') || createPermissionsInfo()
		};

		// Update subscriber count visibility
		if (elements.subscriberCount) {
			elements.subscriberCount.style.display = 
				(permissions.canViewSubscribers && permissions.hasSubscriptionProgram) ? 'block' : 'none';
		}

		// Keep controls visible so users can see what exists, then explain missing access.
		if (elements.moderationControls) {
			elements.moderationControls.style.display = 'block';
		}
		updateModerationRequirements(permissions, elements.moderationRequirements);

		// Update permissions info display
		updatePermissionsDisplay(permissions, elements.permissionsInfo);
	}

	function updateModerationRequirements(permissions, container) {
		if (!container) {
			return;
		}
		if (!permissions) {
			container.textContent = 'Sign in and connect to a channel to use moderation, ads, and channel controls.';
			return;
		}

		const notes = [];
		if (!permissions.isBroadcaster && !permissions.isModerator) {
			notes.push('Moderation actions require broadcaster or moderator access for this channel.');
		}
		if (!permissions.canBanUsers || !permissions.canDeleteMessages) {
			notes.push('Ban, timeout, and delete sync actions require Twitch moderation scopes.');
		}
		if (!permissions.canManageAds) {
			notes.push('Starting ads requires channel:manage:ads.');
		}
		if (!permissions.canReadAds) {
			notes.push('Fetching ad schedule requires channel:read:ads.');
		}
		if (!permissions.canManageBroadcast) {
			notes.push('Title/category editing requires broadcaster access and channel:manage:broadcast.');
		}

		container.textContent = notes.length ? notes.join(' ') : 'Your current sign-in has access to these channel controls.';
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
		const channelSourceElement = document.getElementById('channel-source');
		
		if (currentUserElement) {
			currentUserElement.textContent = username || 'Not signed in';
		}
		if (currentChannelElement) {
			currentChannelElement.textContent = channelName || 'No channel';
		}
		if (channelSourceElement) {
			let hint = '';
			if (channelName) {
				if (channelFromUrl) {
					hint = '\u00b7 from link';
				} else if (username && channelName.toLowerCase() !== username.toLowerCase()) {
					hint = '\u00b7 viewing';
				}
			}
			channelSourceElement.textContent = hint;
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

    function __tw_notifyApp(status, message, details){
      try {
        var statusPayload = Object.assign(
          { platform: 'twitch', status: status, message: message },
          details && typeof details === 'object' ? details : {}
        );
        var payload = { wssStatus: statusPayload };
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

    function __tw_hasPendingAuthAttempt(){
      try {
        return !!sessionStorage.getItem('twitchOAuthState');
      } catch(_){
        return false;
      }
    }

    function __tw_hasRefreshableAuth(){
      try {
        return !!localStorage.getItem('twitchOAuthRefreshToken');
      } catch(_){
        return false;
      }
    }

    function __tw_shouldEmitSigninRequired(options){
      try {
        var ignoreAccessToken = !!(options && options.ignoreAccessToken);
        var hasToken = !ignoreAccessToken && !!localStorage.getItem('twitchOAuthToken');
        return !hasToken && !__tw_hasRefreshableAuth() && !__tw_hasPendingAuthAttempt();
      } catch(_){
        return false;
      }
    }

    function __tw_maybeNotifySigninRequired(message, options){
      if (__tw_shouldEmitSigninRequired(options)) {
        __tw_notifyApp('signin_required', message || 'Please sign in');
      }
    }

    // 1) Initial sign-in check
    function __tw_initialCheck(){
      try {
        __tw_maybeNotifySigninRequired('Please sign in');
      } catch(_){ }
    }

    // 2) Patch showAuthButton to emit signin_required only after refresh/auth attempts are exhausted.
    try {
      if (typeof showAuthButton === 'function') {
        var __tw_origShowAuth = showAuthButton;
        showAuthButton = function(){
          var result = __tw_origShowAuth.apply(this, arguments);
          try { __tw_maybeNotifySigninRequired('Please sign in'); } catch(_){ }
          return result;
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
                  // - Optional Helix/EventSub 401/403 => log only; chat can still be connected
                  // - Other Helix/GQL 401/403 => non-scary optional feature warning
                  // - Otherwise, generic error
                  var isOAuth = url.indexOf('id.twitch.tv') !== -1;
                  var isHelixOrGql = url.indexOf('api.twitch.tv') !== -1 || url.indexOf('gql.twitch.tv') !== -1;
                  var isEventSubSubscription = url.indexOf('api.twitch.tv/helix/eventsub/subscriptions') !== -1;
                  if (isOAuth && res.status === 401) {
                    __tw_maybeNotifySigninRequired('Twitch auth expired', { ignoreAccessToken: true });
                  } else if (isEventSubSubscription && (res.status === 401 || res.status === 403)) {
                    console.warn('Optional Twitch EventSub feature unavailable:', msg);
                  } else if (isHelixOrGql && (res.status === 401 || res.status === 403)) {
                    emit('warn', 'Optional Twitch API feature unavailable');
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
