const YT_CORE_EXTENSION_PATH = 'providers/youtube/liveChat.js';
const YT_CORE_RELATIVE_PATH = '../../providers/youtube/liveChat.js';
const YT_CONTEXT_RESOLVER_EXTENSION_PATH = 'providers/youtube/contextResolver.js';
const YT_CONTEXT_RESOLVER_RELATIVE_PATH = '../../providers/youtube/contextResolver.js';
const YT_NORMALIZER_EXTENSION_PATH = 'providers/youtube/messageNormalizer.js';
const YT_NORMALIZER_RELATIVE_PATH = '../../providers/youtube/messageNormalizer.js';

let createYouTubeLiveChat;
let YOUTUBE_LIVE_CHAT_EVENTS;
let YOUTUBE_LIVE_CHAT_STATUS;
let createYouTubeLiveChatContextResolver;
let normalizeYouTubeLiveChatItem;

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
  const [coreModule, resolverModule, normalizerModule] = await Promise.all([
    importWithFallback(YT_CORE_EXTENSION_PATH, YT_CORE_RELATIVE_PATH),
    importWithFallback(
      YT_CONTEXT_RESOLVER_EXTENSION_PATH,
      YT_CONTEXT_RESOLVER_RELATIVE_PATH
    ),
    importWithFallback(YT_NORMALIZER_EXTENSION_PATH, YT_NORMALIZER_RELATIVE_PATH)
  ]);
  ({
    createYouTubeLiveChat,
    YOUTUBE_LIVE_CHAT_EVENTS,
    YOUTUBE_LIVE_CHAT_STATUS
  } = coreModule);
  ({ createYouTubeLiveChatContextResolver } = resolverModule);
  ({ normalizeYouTubeLiveChatItem } = normalizerModule);
})();

modulesReady.catch((error) => {
  console.error('Failed to load YouTube live chat streaming core', error);
});

const STREAMING_MAX_CHAT_ENTRIES = 50;
var settings = typeof settings !== 'undefined' ? settings : {};
let BTTV = false;
let SEVENTV = false;
let FFZ = false;
let EMOTELIST = false;
let emojiAssetsReady = false;
const shortcutMap = new Map();
const unicodeMap = new Map();
let emojiData = [];
let customEmoteData = [];

function strictEscapeHtml(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/[&<>"']/g, (match) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[match];
  });
}

function describeEmojiCodepoints(emojiString) {
  if (!emojiString) {
    return 'emoji';
  }
  try {
    const codepoints = Array.from(emojiString)
      .map((char) => {
        const code = char.codePointAt(0);
        return code !== undefined ? `U+${code.toString(16).toUpperCase()}` : '';
      })
      .filter(Boolean);
    return codepoints.length ? `emoji ${codepoints.join(' ')}` : 'emoji';
  } catch (error) {
    console.warn('Failed to describe emoji codepoints', error);
    return 'emoji';
  }
}

function getAsciiLabel(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.replace(/[^\x20-\x7E]/g, '').trim();
}

function buildEmojiAltText(emoji) {
  if (!emoji) {
    return 'emoji';
  }
  const shortcutLabel = Array.isArray(emoji.shortcuts)
    ? emoji.shortcuts.map(getAsciiLabel).find(Boolean)
    : '';
  if (shortcutLabel) {
    return shortcutLabel;
  }
  const searchTermLabel = Array.isArray(emoji.searchTerms)
    ? emoji.searchTerms.map(getAsciiLabel).find(Boolean)
    : '';
  if (searchTermLabel) {
    return searchTermLabel;
  }
  return describeEmojiCodepoints(emoji.emojiId || '');
}

function resolveEmojiAltAttribute(emojiInfo, fallback) {
  const candidate =
    (emojiInfo && getAsciiLabel(emojiInfo.alt)) ||
    (emojiInfo && emojiInfo.id ? describeEmojiCodepoints(emojiInfo.id) : '') ||
    getAsciiLabel(fallback) ||
    'emoji';
  return strictEscapeHtml(candidate);
}

function shouldStickToBottom(element, threshold = 120) {
  if (!element) {
    return false;
  }
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function replaceEmotesWithImages(text) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }
  if (!EMOTELIST) {
    return text;
  }

  let replaced = 0;
  const result = text.replace(/(?<=^|\s)(\S+?)(?=$|\s)/g, (match, candidate) => {
    const emote = EMOTELIST[candidate];
    if (!emote) {
      return match;
    }
    replaced += 1;
    const escaped = strictEscapeHtml(candidate);
    if (typeof emote === 'string') {
      return `<img src="${emote}" alt="${escaped}" title="${escaped}" class="regular-emote"/>`;
    }
    const src = emote.url || '';
    const cls = emote.zw ? 'zero-width-emote-centered' : 'regular-emote';
    return `<img src="${src}" alt="${escaped}" title="${escaped}" class="${cls}"/>`;
  });

  if (replaced > 0) {
    try {
      console.debug('Replaced emotes in YouTube streaming message', { replaced });
    } catch (_) {
      // ignore debug failures
    }
  }

  return result;
}

function replaceEmojis(message) {
  if (!message || typeof message !== 'string') {
    return message || '';
  }

  let result = strictEscapeHtml(message);

  if (EMOTELIST) {
    result = replaceEmotesWithImages(result);
  }

  if (!shortcutMap.size && !unicodeMap.size) {
    return result;
  }

  const shortcutRegex = /:([\w_-]+):/g;
  result = result.replace(shortcutRegex, (match) => {
    const emojiInfo = shortcutMap.get(match);
    if (!emojiInfo) {
      return match;
    }
    if (settings.textonlymode) {
      if (emojiInfo.isCustom) {
        return '';
      }
      return emojiInfo.id;
    }
    const altText = resolveEmojiAltAttribute(emojiInfo, match);
    return `<img src="${emojiInfo.url}" alt="${altText}" class="chat-emoji" title="${altText}"/>`;
  });

  if (settings.textonlymode) {
    return result;
  }

  const processEmojiSequence = (text) =>
    text.replace(/([\u{1F000}-\u{1FFFF}])([\u{1F3FB}-\u{1F3FF}])/gu, (match, baseEmoji, skinTone) => {
      if (!unicodeMap.has(baseEmoji)) {
        return match;
      }
      const baseInfo = unicodeMap.get(baseEmoji);
      const baseUrl = baseInfo.url;
      const urlMatch = baseUrl.match(/\/([^/]+)\/\d+\.png$/);
      if (!urlMatch) {
        return match;
      }
      const baseCode = urlMatch[1];
      const skinCode = skinTone.codePointAt(0).toString(16);
      const combinedUrl = baseUrl.replace(`/${baseCode}/`, `/${baseCode}_${skinCode}/`);
      const altText = resolveEmojiAltAttribute(baseInfo, describeEmojiCodepoints(match));
      return `<img class="regular-emote" src="${combinedUrl}" alt="${altText}" title="${altText}"/>`;
    });

  result = processEmojiSequence(result);

  unicodeMap.forEach((emojiInfo, unicodeChar) => {
    if (!result.includes(unicodeChar)) {
      return;
    }
    const altText = resolveEmojiAltAttribute(emojiInfo, describeEmojiCodepoints(unicodeChar));
    const imgTag = `<img src="${emojiInfo.url}" alt="${altText}" class="chat-emoji" title="${altText}"/>`;
    result = result.replace(new RegExp(unicodeChar, 'g'), imgTag);
  });

  return result;
}

function deepMerge(target, source) {
  if (!target || typeof target !== 'object') {
    return source;
  }
  if (!source || typeof source !== 'object') {
    return target;
  }
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key]) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  });
  return target;
}

function mergeEmotes() {
  const merged = {};
  if (BTTV && typeof BTTV === 'object') {
    if (BTTV.channelEmotes) {
      deepMerge(merged, BTTV.channelEmotes);
    }
    if (BTTV.sharedEmotes) {
      deepMerge(merged, BTTV.sharedEmotes);
    }
    if (BTTV.globalEmotes) {
      deepMerge(merged, BTTV.globalEmotes);
    }
  }
  if (SEVENTV && typeof SEVENTV === 'object') {
    if (SEVENTV.channelEmotes) {
      deepMerge(merged, SEVENTV.channelEmotes);
    }
    if (SEVENTV.globalEmotes) {
      deepMerge(merged, SEVENTV.globalEmotes);
    }
  }
  if (FFZ && typeof FFZ === 'object') {
    if (FFZ.channelEmotes) {
      deepMerge(merged, FFZ.channelEmotes);
    }
    if (FFZ.globalEmotes) {
      deepMerge(merged, FFZ.globalEmotes);
    }
  }
  EMOTELIST = Object.keys(merged).length ? merged : false;
  if (EMOTELIST) {
    window.dispatchEvent(
      new CustomEvent('settingsChanged', {
        detail: { EMOTELIST },
        bubbles: true
      })
    );
  }
}

function processEmojiData(data) {
  emojiData = data || [];
  shortcutMap.clear();
  unicodeMap.clear();
  emojiData.forEach((emoji) => {
    if (
      !emoji.emojiId ||
      !emoji.image ||
      !emoji.image.thumbnails ||
      !emoji.image.thumbnails[0] ||
      !emoji.image.thumbnails[0].url
    ) {
      return;
    }
    const altText = buildEmojiAltText(emoji);
    unicodeMap.set(emoji.emojiId, {
      url: emoji.image.thumbnails[0].url,
      id: emoji.emojiId,
      alt: altText
    });
    if (Array.isArray(emoji.shortcuts)) {
      emoji.shortcuts.forEach((shortcut) => {
        shortcutMap.set(shortcut, {
          url: emoji.image.thumbnails[0].url,
          id: emoji.emojiId,
          alt: altText
        });
      });
    }
  });
}

function processCustomEmoteData(data) {
  customEmoteData = data || [];
  customEmoteData.forEach((emote) => {
    const name = Array.isArray(emote) ? emote[0] : null;
    const url = Array.isArray(emote) ? emote[1] : null;
    if (!name || !url) {
      return;
    }
    const emoteName = `:${name}:`;
    const label = getAsciiLabel(name) || 'custom emoji';
    shortcutMap.set(emoteName, {
      url,
      id: '',
      isCustom: true,
      alt: `custom ${label}`
    });
  });
}

function markEmojiAssetsReady() {
  if (emojiAssetsReady) {
    return;
  }
  emojiAssetsReady = true;
  window.dispatchEvent(
    new CustomEvent('youtubeEmojisReady', {
      detail: { success: true },
      bubbles: true
    })
  );
}

async function loadEmojiData() {
  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cachedDataStr = localStorage.getItem('emojiData');
  const cachedTimeStr = localStorage.getItem('emojiDataTime');
  const cachedCustomStr = localStorage.getItem('customEmoteData');
  const cachedCustomTimeStr = localStorage.getItem('customEmoteDataTime');

  const promises = [];

  if (
    cachedDataStr &&
    cachedTimeStr &&
    Number.isFinite(Number(cachedTimeStr)) &&
    now - Number(cachedTimeStr) < CACHE_DURATION
  ) {
    try {
      const cachedData = JSON.parse(cachedDataStr);
      processEmojiData(cachedData);
      emojiAssetsReady = true;
    } catch (error) {
      console.warn('Failed to parse cached emoji data', error);
    }
  }

  if (
    cachedCustomStr &&
    cachedCustomTimeStr &&
    Number.isFinite(Number(cachedCustomTimeStr)) &&
    now - Number(cachedCustomTimeStr) < CACHE_DURATION
  ) {
    try {
      const cachedCustom = JSON.parse(cachedCustomStr);
      processCustomEmoteData(cachedCustom);
    } catch (error) {
      console.warn('Failed to parse cached custom emote data', error);
    }
  }

  promises.push(
    fetch('emotes.json', {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Emoji fetch failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        try {
          localStorage.setItem('emojiData', JSON.stringify(data));
          localStorage.setItem('emojiDataTime', String(now));
        } catch (error) {
          console.warn('Failed to cache emoji data', error);
        }
        processEmojiData(data);
        return data;
      })
      .catch((error) => {
        console.error('Failed to load emoji data', error);
      })
  );

  promises.push(
    fetch('custom_emotes.json', {
      mode: 'cors',
      headers: { Accept: 'application/json' }
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Custom emote fetch failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        try {
          localStorage.setItem('customEmoteData', JSON.stringify(data));
          localStorage.setItem('customEmoteDataTime', String(now));
        } catch (error) {
          console.warn('Failed to cache custom emote data', error);
        }
        processCustomEmoteData(data);
        return data;
      })
      .catch((error) => {
        console.error('Failed to load custom emote data', error);
      })
  );

  await Promise.all(promises);
  markEmojiAssetsReady();
}

function stripHtmlContent(value) {
  if (!value) {
    return '';
  }
  const temp = document.createElement('div');
  temp.innerHTML = value;
  return (temp.textContent || temp.innerText || '').trim();
}

function rememberChatMessage(messageId, context) {
  if (messageId === undefined || messageId === null) {
    return;
  }
  try {
    const cacheKey = `ytChat:${messageId}`;
    sessionStorage.setItem(cacheKey, JSON.stringify(context));
  } catch (error) {
    console.warn('Failed to cache YouTube message context', error);
  }
}

function requestEmotesForVideo(videoId, channelId) {
  if (!videoId) {
    return;
  }
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }
  const payloadBase = {
    url: `https://youtube.com/?v=${videoId}`,
    videoId,
    channelId,
    type: 'youtube'
  };

  chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, ...payloadBase }, () => {
    if (chrome.runtime.lastError) {
      console.log('BTTV request error:', chrome.runtime.lastError.message);
    }
  });
  if (settings.seventv) {
    chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, ...payloadBase }, () => {
      if (chrome.runtime.lastError) {
        console.log('7TV request error:', chrome.runtime.lastError.message);
      }
    });
  }
  if (settings.ffz) {
    chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, ...payloadBase }, () => {
      if (chrome.runtime.lastError) {
        console.log('FFZ request error:', chrome.runtime.lastError.message);
      }
    });
  }
}

function refreshStreamingEmoteContext() {
  try {
    const app = window.youtubeStreamingApp;
    if (!app || !app.state) {
      return;
    }
    if (app.state.videoId || app.state.channel) {
      requestEmotesForVideo(app.state.videoId, app.state.channel);
    }
  } catch (error) {
    console.warn('Failed to refresh YouTube streaming emote context', error);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('youtubeVideoChanged', (event) => {
    try {
      const detail = event?.detail;
      if (detail && (detail.videoId || detail.channelId)) {
        requestEmotesForVideo(detail.videoId || null, detail.channelId || null);
      }
    } catch (error) {
      console.warn('Failed to process youtubeVideoChanged event for streaming page', error);
    }
  });
}

function handleExtensionMessage(request, sender, sendResponse) {
  try {
    if (request === 'getSource') {
      sendResponse('youtube_streaming');
      return true;
    }
    if (request === 'focusChat') {
      document.querySelector('#input-text')?.focus();
      sendResponse(true);
      return true;
    }
    if (request && typeof request === 'object') {
      if ('settings' in request) {
        settings = request.settings || {};
        window.dispatchEvent(
          new CustomEvent('settingsChanged', {
            detail: { settings },
            bubbles: true
          })
        );
        mergeEmotes();
        refreshStreamingEmoteContext();
        sendResponse(true);
        return true;
      }
      if ('BTTV' in request) {
        BTTV = request.BTTV || false;
        mergeEmotes();
        refreshStreamingEmoteContext();
        sendResponse(true);
        return true;
      }
      if ('SEVENTV' in request) {
        SEVENTV = request.SEVENTV || false;
        mergeEmotes();
        refreshStreamingEmoteContext();
        sendResponse(true);
        return true;
      }
      if ('FFZ' in request) {
        FFZ = request.FFZ || false;
        mergeEmotes();
        refreshStreamingEmoteContext();
        sendResponse(true);
        return true;
      }
    }
  } catch (error) {
    console.error('YouTube streaming settings bridge error', error);
  }
  return false;
}

function requestInitialSettings() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }
  try {
    chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('YouTube streaming getSettings error:', chrome.runtime.lastError.message);
        return;
      }
      if (!response) {
        return;
      }
      if ('settings' in response) {
        settings = response.settings || {};
        window.dispatchEvent(
          new CustomEvent('settingsChanged', {
            detail: { settings },
            bubbles: true
          })
        );
      }
      if ('state' in response) {
        window.dispatchEvent(
          new CustomEvent('youtubeStreamingState', {
            detail: { state: response.state },
            bubbles: true
          })
        );
      }
      mergeEmotes();
      refreshStreamingEmoteContext();
    });
  } catch (error) {
    console.error('Failed to request YouTube streaming settings', error);
  }
}

if (typeof window !== 'undefined' && !window.__YT_STREAMING_EXTENSION_BRIDGE__) {
  window.__YT_STREAMING_EXTENSION_BRIDGE__ = true;
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.onMessage?.addListener === 'function') {
    chrome.runtime.onMessage.addListener(handleExtensionMessage);
    requestInitialSettings();
  }
}

const extensionRelayQueue = [];
let isProcessingExtensionQueue = false;
const RELAY_BATCH_SIZE = 5;
const RELAY_BATCH_DELAY = 100;

function enqueueRelayMessage(message) {
  if (!message) {
    return;
  }
  extensionRelayQueue.push(message);
  if (!isProcessingExtensionQueue) {
    setTimeout(processExtensionQueue, 10);
  }
}

function processExtensionQueue() {
  if (isProcessingExtensionQueue || extensionRelayQueue.length === 0) {
    return;
  }

  isProcessingExtensionQueue = true;
  const batch = extensionRelayQueue.splice(0, RELAY_BATCH_SIZE);
  const payload = batch.length === 1 ? { message: batch[0] } : { messages: batch };

  try {
    if (window.chrome?.runtime?.id) {
      chrome.runtime.sendMessage(chrome.runtime.id, payload, () => {
        if (chrome.runtime.lastError) {
          console.warn('YouTube streaming relay error:', chrome.runtime.lastError.message);
        }
        finalizeRelayBatch();
      });
      return;
    }
    if (window.ninjafy?.sendMessage) {
      window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__ || null);
      finalizeRelayBatch();
      return;
    }
    window.postMessage(payload, '*');
    finalizeRelayBatch();
  } catch (error) {
    console.error('Failed to relay YouTube streaming batch', error);
    finalizeRelayBatch();
  }
}

function finalizeRelayBatch() {
  isProcessingExtensionQueue = false;
  if (extensionRelayQueue.length) {
    setTimeout(processExtensionQueue, RELAY_BATCH_DELAY);
  }
}

class YoutubeStreamingApp {
  constructor() {
    this.streamClient = null;
    this.streamDisposers = [];
    this.state = {
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      scope: null,
      liveChatId: null,
      videoId: null,
      channel: null,
      username: null,
      channelTitle: null,
      videoTitle: null,
      status: 'disconnected',
      autoConnectAttempted: false
    };
    this.elements = {};
    this.contextResolver = null;
    this.clientId = DEFAULT_CLIENT_ID;
    this.apiKey = null;
  }

  async init() {
    console.debug('[YT Streaming] Initialising app');
    await modulesReady;
    this.cacheElements();
    this.bindEvents();
    this.applyClientOverrides();
    loadEmojiData().catch((error) => console.warn('Failed to preload emoji data', error));
    console.debug('[YT Streaming] Processing OAuth response');
    await this.processOAuthResponse();
    console.debug('[YT Streaming] Hydrating stored token');
    await this.hydrateStoredToken();
    console.debug('[YT Streaming] Restoring context from URL parameters');
    this.restoreFromParams();
    await this.fetchCurrentUser().catch(() => {});
    console.debug('[YT Streaming] Current app state after init', {
      hasToken: Boolean(this.state.token?.accessToken),
      liveChatId: this.state.liveChatId,
      videoId: this.state.videoId,
      channel: this.state.channel
    });
    this.updateAuthUi();
    this.updateStatusText('Disconnected', 'disconnected');
    await this.maybeAutoConnectFromState('init');
    window.youtubeStreamingApp = this;
    console.debug('[YT Streaming] App initialised');
  }

  cacheElements() {
    console.debug('[YT Streaming] Caching DOM elements');
    this.elements = {
      authSection: document.getElementById('auth-section'),
      streamSection: document.getElementById('stream-section'),
      connectButton: document.getElementById('connect-button'),
      disconnectButton: document.getElementById('disconnect-button'),
      signOutButton: document.getElementById('sign-out-button'),
      userAvatar: document.getElementById('user-avatar'),
      channelInput: document.getElementById('channel-input'),
      resolveButton: document.getElementById('channel-resolve-button'),
      statusIndicator: document.getElementById('stream-status-indicator'),
      statusText: document.getElementById('stream-status-text'),
      chatLog: document.getElementById('chat-log'),
      inputText: document.getElementById('input-text'),
      sendButton: document.getElementById('sendmessage'),
      clearButton: document.getElementById('clear-chat'),
      currentUser: document.getElementById('current-user'),
      currentChannel: document.getElementById('current-channel'),
      latencyIndicator: document.getElementById('latency-indicator')
    };
  }

  bindEvents() {
    console.debug('[YT Streaming] Binding UI events');
    if (this.elements.connectButton) {
      this.elements.connectButton.addEventListener('click', () => this.connect());
    }
    if (this.elements.disconnectButton) {
      this.elements.disconnectButton.addEventListener('click', () => this.disconnect());
    }
    if (this.elements.signOutButton) {
      this.elements.signOutButton.addEventListener('click', () => this.signOut());
    }
    if (this.elements.clearButton) {
      this.elements.clearButton.addEventListener('click', () => this.clearChatLog());
    }
    if (this.elements.sendButton) {
      this.elements.sendButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.handleSendMessage();
      });
    }
    if (this.elements.resolveButton) {
      this.elements.resolveButton.addEventListener('click', () => this.resolveChannelContext());
    }
  }

  applyClientOverrides() {
    try {
      console.debug('[YT Streaming] Applying client overrides (if any)');
      const storedId = localStorage.getItem('ytClientIdOverride');
      const storedKey = localStorage.getItem('ytApiKeyOverride');
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const urlClientId = searchParams.get('client_id') || hashParams.get('client_id');
      const urlApiKey = searchParams.get('api_key') || hashParams.get('api_key');

      this.clientId = urlClientId || storedId || DEFAULT_CLIENT_ID;
      this.apiKey = urlApiKey || storedKey || null;
    } catch (error) {
      console.warn('Failed to apply YouTube client overrides', error);
      this.clientId = DEFAULT_CLIENT_ID;
      this.apiKey = null;
    }
  }

  getRedirectUri() {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch (error) {
      console.warn('Failed to build redirect URI', error);
      return `${window.location.origin}${window.location.pathname}`;
    }
  }

  buildAuthUrl() {
    const state = this.generateState(16);
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
    } catch (error) {
      console.warn('Failed to persist OAuth state', error);
    }
    const params = new URLSearchParams({
      client_id: this.clientId || DEFAULT_CLIENT_ID,
      redirect_uri: this.getRedirectUri(),
      scope: YT_SCOPES.join(' '),
      state
    });
    return `${AUTH_BASE_URL}/auth?${params.toString()}`;
  }

  beginAuthFlow() {
    const authUrl = this.buildAuthUrl();
    window.location.href = authUrl;
  }

  generateState(length = 12) {
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
    }
    return Math.random().toString(36).slice(2, 2 + length);
  }

  clearOAuthState() {
    try {
      sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch (_) {
      // ignore
    }
  }

  replaceUrlWithoutAuthParams() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.hash = '';
      window.history.replaceState({}, document.title, url.toString());
    } catch (error) {
      console.warn('Failed to clean OAuth redirect parameters', error);
    }
  }

  restoreFromParams() {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || params.get('access_token');
    if (tokenParam) {
      try {
        this.storeTokenResponse({ access_token: tokenParam, expires_in: 3600 });
      } catch (error) {
        console.warn('Failed to apply token from URL parameters', error);
      }
    }

    this.state.liveChatId =
      params.get('liveChatId') || params.get('chatId') || params.get('live_chat_id') || null;
    this.state.videoId = params.get('videoId') || params.get('v') || null;
    this.state.channel =
      params.get('channel') || params.get('username') || params.get('handle') || null;

    if (params.get('displayName')) {
      this.state.username = params.get('displayName');
    }

    if (this.elements.channelInput) {
      this.elements.channelInput.value =
        this.state.liveChatId || this.state.videoId || this.state.channel || '';
    }

    if (this.elements.currentUser && this.state.username) {
      this.elements.currentUser.textContent = this.state.username;
    }
    if (this.elements.currentChannel && this.state.channel) {
      this.elements.currentChannel.textContent = this.state.channel;
    }
  }

  ensureStreamClient() {
    if (this.streamClient) {
      console.debug('[YT Streaming] Reusing existing stream client', {
        chatId: this.state.liveChatId,
        videoId: this.state.videoId
      });
      return this.streamClient;
    }
    console.debug('[YT Streaming] Creating new stream client', {
      chatId: this.state.liveChatId,
      videoId: this.state.videoId
    });
    const client = createYouTubeLiveChat({
      mode: 'stream',
      logger: console,
      tokenProvider: async () => {
        await this.ensureValidToken();
        return this.state.token;
      },
      chatIdResolver: async () => this.state.liveChatId,
      fetchImplementation: (...args) => fetch(...args),
      abortControllerFactory: () => new AbortController()
    });

    this.streamDisposers.push(
      client.on(YOUTUBE_LIVE_CHAT_EVENTS.STATUS, ({ status, meta }) =>
        this.handleStreamStatus(status, meta)
      )
    );
    this.streamDisposers.push(
      client.on(YOUTUBE_LIVE_CHAT_EVENTS.ERROR, (error) => this.handleStreamError(error))
    );
    this.streamDisposers.push(
      client.on(YOUTUBE_LIVE_CHAT_EVENTS.CHAT, (chat) => this.handleStreamChat(chat))
    );

    this.streamClient = client;
    return this.streamClient;
  }

  ensureContextResolver() {
    if (this.contextResolver) {
      return this.contextResolver;
    }
    this.contextResolver = createYouTubeLiveChatContextResolver({
      fetchImplementation: (...args) => fetch(...args),
      logger: console
    });
    return this.contextResolver;
  }

  parseTargetInput(rawValue) {
    const value = (rawValue || '').trim();
    if (!value) {
      return { liveChatId: null, videoId: null, channel: null };
    }

    const result = { liveChatId: null, videoId: null, channel: null };

    const liveChatPattern = /^[A-Za-z0-9_-]{20,}$/;
    const videoPattern = /^[A-Za-z0-9_-]{11}$/;

    try {
      const url = new URL(value);
      if (url.searchParams.has('v')) {
        const candidate = url.searchParams.get('v');
        if (candidate && videoPattern.test(candidate)) {
          result.videoId = candidate;
          return result;
        }
      }
      if (url.pathname.includes('/live_chat')) {
        const candidate = url.searchParams.get('continuation') || url.searchParams.get('lc');
        if (candidate && liveChatPattern.test(candidate)) {
          result.liveChatId = candidate;
          return result;
        }
      }
      if (url.pathname.includes('/channel/')) {
        const pieces = url.pathname.split('/');
        const channelId = pieces.find((segment) => segment && segment.startsWith('UC'));
        if (channelId) {
          result.channel = channelId;
          return result;
        }
      }
      if (url.pathname.startsWith('/@')) {
        result.channel = url.pathname;
        return result;
      }
      if (url.hostname.includes('youtube.com') && url.pathname.startsWith('/c/')) {
        const parts = url.pathname.split('/');
        const handle = parts.filter(Boolean).pop();
        if (handle) {
          result.channel = handle;
          return result;
        }
      }
    } catch (_) {
      // not a URL
    }

    if (liveChatPattern.test(value)) {
      result.liveChatId = value;
      return result;
    }

    if (videoPattern.test(value)) {
      result.videoId = value;
      return result;
    }

    result.channel = value;
    return result;
  }

  async maybeAutoConnectFromState(reason = 'state') {
    if (this.state.autoConnectAttempted) {
      return;
    }
    const hasToken = Boolean(this.state.token?.accessToken);
    const hasTarget = Boolean(this.state.liveChatId || this.state.videoId || this.state.channel);
    if (!hasToken || !hasTarget) {
      return;
    }
    console.debug('[YT Streaming] Attempting auto-connect', {
      reason,
      liveChatId: this.state.liveChatId,
      videoId: this.state.videoId,
      channel: this.state.channel
    });
    try {
      this.state.autoConnectAttempted = true;
      await this.connect({ reason: 'auto_connect', allowEmptyInput: true });
    } catch (error) {
      console.warn('YouTube streaming auto-connect failed', error);
      this.state.autoConnectAttempted = false;
    }
  }

  applyResolvedContext(resolved) {
    if (!resolved) {
      return;
    }
    if (resolved.liveChatId) {
      this.state.liveChatId = resolved.liveChatId;
    }
    if (resolved.video?.id) {
      this.state.videoId = resolved.video.id;
      this.state.videoTitle = resolved.video.title || null;
    }
    if (resolved.channel?.id) {
      this.state.channel = resolved.channel.id;
      this.state.channelTitle = resolved.channel.title || null;
    }
    this.state.status = resolved.status || this.state.status;

    if (this.elements.currentChannel) {
      const channelLabel =
        resolved.channel?.title ||
        resolved.video?.channelTitle ||
        this.state.channel ||
        'No target';
      this.elements.currentChannel.textContent = channelLabel;
    }
    if (this.elements.channelInput && resolved.video?.id) {
      this.elements.channelInput.value = resolved.video.id;
    } else if (this.elements.channelInput && resolved.channel?.id) {
      this.elements.channelInput.value = '';
    }

    if (this.state.videoId || this.state.channel) {
      requestEmotesForVideo(this.state.videoId, this.state.channel);
    }
  }

  async resolveLiveChatContext(options = {}) {
    const { explicitInput = null, requireLiveChat = false } = options;
    const hasToken = await this.ensureValidToken();
    if (!hasToken) {
      const authError = new Error('YouTube authentication required.');
      authError.code = 'MISSING_TOKEN';
      throw authError;
    }

    const resolver = this.ensureContextResolver();
    const input =
      explicitInput !== null
        ? explicitInput
        : this.elements.channelInput
        ? this.elements.channelInput.value
        : '';
    const parsed = this.parseTargetInput(input);
    const context = {
      token: this.state.token,
      liveChatId: parsed.liveChatId || this.state.liveChatId || null,
      videoId: parsed.videoId || this.state.videoId || null,
      channel: parsed.channel || this.state.channel || null
    };

    const resolved = await resolver.resolve(context);
    this.applyResolvedContext(resolved);
    if (requireLiveChat && !resolved.liveChatId) {
      const reason = resolved.reason || 'NO_LIVE_CHAT';
      const error = new Error('No active live chat available for the selected target.');
      error.code = reason;
      error.resolved = resolved;
      throw error;
    }
    return resolved;
  }

  async connect(options = {}) {
    const { resolvedContext = null, reason = 'manual', allowEmptyInput = false } = options;

    if (!this.state.token || !this.state.token.accessToken) {
      console.warn('[YT Streaming] Connect requested without access token – starting auth flow');
      this.beginAuthFlow();
      return;
    }

    const inputValue = this.elements.channelInput ? this.elements.channelInput.value : '';
    if (
      !allowEmptyInput &&
      !inputValue &&
      !this.state.liveChatId &&
      !this.state.videoId &&
      !this.state.channel
    ) {
      this.updateStatusText('Provide a Live Chat ID, video ID, or channel handle.', 'error');
      console.warn('[YT Streaming] Connect aborted – no target provided');
      return;
    }

    let resolved = resolvedContext || null;

    if (resolved) {
      console.debug('[YT Streaming] Using provided live chat context', resolved);
    } else {
      try {
        resolved = await this.resolveLiveChatContext({
          explicitInput: inputValue || null,
          requireLiveChat: true
        });
        console.debug('[YT Streaming] Live chat context resolved', resolved);
      } catch (error) {
        const message =
          error?.resolved?.reason === 'CHAT_NOT_READY'
            ? 'Stream is upcoming; chat not yet available.'
            : error?.message || 'Failed to resolve YouTube live chat.';
        const state = error?.resolved?.reason === 'CHAT_NOT_READY' ? 'warning' : 'error';
        this.updateStatusText(message, state);
        console.error('YouTube streaming connection resolution failed', error);
        return;
      }
    }

    if (!resolved?.liveChatId) {
      if (resolved?.status === 'upcoming') {
        this.updateStatusText('Stream is upcoming; chat not yet available.', 'warning');
        return;
      }
      this.updateStatusText('No live chat available for this target.', 'error');
      return;
    }

    const client = this.ensureStreamClient();
    client.stop({ suppressStatus: true });
    this.clearChatLog();
    this.updateStatusText('Connecting…', 'connecting');
    console.debug('[YT Streaming] Starting streaming client', {
      liveChatId: this.state.liveChatId,
      videoId: this.state.videoId,
      reason
    });

    try {
      client
        .start({
          chatId: this.state.liveChatId,
          token: this.state.token
        })
        .then(() => {
          console.debug('[YT Streaming] Streaming client completed');
        })
        .catch((error) => {
          this.handleStreamError(error);
        });
    } catch (error) {
      this.handleStreamError(error);
    }
  }

  disconnect() {
    if (this.streamClient) {
      try {
        this.streamClient.stop({ suppressStatus: true });
      } catch (error) {
        console.warn('Failed to stop YouTube streaming client', error);
      }
    }
    this.updateStatusText('Disconnected', 'disconnected');
    this.toggleConnectedView(false);
    this.state.autoConnectAttempted = false;
    this.updateAuthUi();
  }

  signOut() {
    this.clearStoredToken();
    this.state.token = null;
    this.state.refreshToken = null;
    this.state.tokenExpiry = null;
    this.disconnect();
    if (this.elements.currentUser) {
      this.elements.currentUser.textContent = 'Not signed in';
    }
    if (this.elements.userAvatar) {
      this.elements.userAvatar.style.backgroundImage = '';
    }
    this.updateAuthUi();
    this.updateStatusText('Signed out', 'warning');
  }

  clearChatLog() {
    if (this.elements.chatLog) {
      console.debug('[YT Streaming] Clearing chat log');
      this.elements.chatLog.innerHTML = '';
    }
  }

  async hydrateStoredToken() {
    const stored = this.readStoredToken();
    if (!stored) {
      this.state.token = null;
      this.state.refreshToken = null;
      this.state.tokenExpiry = null;
      return;
    }

    if (stored.expiry && Date.now() >= stored.expiry) {
      if (stored.refreshToken) {
        const refreshed = await this.refreshAccessToken(stored.refreshToken).catch((error) => {
          console.warn('Failed to refresh YouTube token', error);
          return false;
        });
        if (refreshed) {
          return;
        }
      }
      this.clearStoredToken();
      this.state.token = null;
      this.state.refreshToken = null;
      this.state.tokenExpiry = null;
      return;
    }

    this.state.token = { accessToken: stored.accessToken, scope: stored.scope || null };
    this.state.refreshToken = stored.refreshToken || null;
    this.state.tokenExpiry = stored.expiry || null;
  }

  readStoredToken() {
    try {
      const accessToken = localStorage.getItem('youtubeOAuthToken');
      if (!accessToken) {
        return null;
      }
      const expiryRaw = localStorage.getItem('youtubeOAuthExpiry');
      const refreshToken = localStorage.getItem('youtubeRefreshToken');
      const scope = localStorage.getItem('youtubeOAuthScope');
      const expiry = expiryRaw ? parseInt(expiryRaw, 10) : null;
      return {
        accessToken,
        refreshToken,
        scope,
        expiry: Number.isFinite(expiry) ? expiry : null
      };
    } catch (error) {
      console.warn('Failed to read stored YouTube token', error);
      return null;
    }
  }

  saveTokenToStorage({ accessToken, expiresIn, refreshToken, scope }) {
    try {
      if (accessToken) {
        localStorage.setItem('youtubeOAuthToken', accessToken);
      }
      const expires =
        typeof expiresIn === 'number' ? Date.now() + expiresIn * 1000 : Date.now() + 3600 * 1000;
      localStorage.setItem('youtubeOAuthExpiry', String(expires));
      if (refreshToken) {
        localStorage.setItem('youtubeRefreshToken', refreshToken);
      }
      if (scope) {
        localStorage.setItem('youtubeOAuthScope', scope);
      }
    } catch (error) {
      console.warn('Failed to save YouTube token to storage', error);
    }
  }

  clearStoredToken() {
    try {
      localStorage.removeItem('youtubeOAuthToken');
      localStorage.removeItem('youtubeOAuthExpiry');
      localStorage.removeItem('youtubeRefreshToken');
      localStorage.removeItem('youtubeOAuthScope');
    } catch (error) {
      console.warn('Failed to clear stored YouTube token', error);
    }
  }

  storeTokenResponse(payload, options = {}) {
    if (!payload) {
      return;
    }
    const accessToken = payload.access_token || payload.accessToken || null;
    const refreshToken = payload.refresh_token || payload.refreshToken || options.refreshToken || null;
    const expiresIn = Number(payload.expires_in || payload.expiresIn || 3600);
    const scope = Array.isArray(payload.scope) ? payload.scope.join(' ') : payload.scope || null;

    if (!accessToken) {
      throw new Error('YouTube token response missing access token.');
    }

    this.saveTokenToStorage({ accessToken, expiresIn, refreshToken, scope });
    this.state.token = { accessToken, scope };
    this.state.refreshToken = refreshToken;
    this.state.tokenExpiry = Date.now() + expiresIn * 1000;
    this.updateAuthUi();
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      console.warn('[YT Streaming] Refresh requested without refresh token');
      return false;
    }
    console.debug('[YT Streaming] Refreshing access token');
    try {
      const res = await fetch(`${AUTH_BASE_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!res.ok) {
        throw new Error(`YouTube token refresh failed (${res.status})`);
      }
      const data = await res.json();
      this.storeTokenResponse(data, { refreshToken });
      console.debug('[YT Streaming] Access token refreshed');
      return true;
    } catch (error) {
      console.error('YouTube token refresh failed', error);
      this.clearStoredToken();
      this.state.token = null;
      this.state.refreshToken = null;
      this.state.tokenExpiry = null;
      this.updateAuthUi();
      console.warn('[YT Streaming] Cleared token after refresh failure');
      return false;
    }
  }

  async processOAuthResponse() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const expectedState = (() => {
      try {
        return sessionStorage.getItem(OAUTH_STATE_KEY);
      } catch (_) {
        return null;
      }
    })();
    let handled = false;

    if (searchParams.has('code')) {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      if (!expectedState || state !== expectedState) {
        console.warn('OAuth state mismatch for YouTube streaming auth');
      } else {
        await this.exchangeAuthorizationCode(code).catch((error) => {
          console.error('Failed to exchange YouTube auth code', error);
        });
        handled = true;
      }
    } else if (hashParams.has('access_token')) {
      const state = hashParams.get('state');
      if (!expectedState || state !== expectedState) {
        console.warn('OAuth state mismatch for YouTube streaming implicit flow');
      } else {
        const accessToken = hashParams.get('access_token');
        const expiresIn = Number(hashParams.get('expires_in') || 3600);
        const scope = hashParams.get('scope') || '';
        this.storeTokenResponse({ access_token: accessToken, expires_in: expiresIn, scope });
        handled = true;
      }
    }

    if (handled) {
      this.clearOAuthState();
      this.replaceUrlWithoutAuthParams();
      await this.fetchCurrentUser().catch(() => {});
      this.updateAuthUi();
    }
  }

  async exchangeAuthorizationCode(code) {
    if (!code) {
      return;
    }
    const payload = {
      code,
      redirect_uri: this.getRedirectUri()
    };
    const res = await fetch(`${AUTH_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const error = new Error(
        `YouTube OAuth token exchange failed (${res.status}${res.statusText ? ` ${res.statusText}` : ''})`
      );
      error.detail = detail;
      throw error;
    }
    const data = await res.json();
    this.storeTokenResponse(data);
  }

  updateAuthUi() {
    const hasToken = Boolean(this.state.token?.accessToken);
    const isConnected = this.state.status === YOUTUBE_LIVE_CHAT_STATUS.RUNNING;
    if (this.elements.connectButton) {
      this.elements.connectButton.textContent = hasToken ? 'Connect' : 'Sign in with YouTube';
      this.elements.connectButton.disabled = isConnected && hasToken;
    }
    if (this.elements.disconnectButton) {
      this.elements.disconnectButton.disabled = !hasToken || !isConnected;
    }
    if (this.elements.signOutButton) {
      this.elements.signOutButton.disabled = !hasToken;
    }
    if (this.elements.inputText) {
      this.elements.inputText.disabled = !hasToken || !isConnected;
    }
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !hasToken || !isConnected;
    }
    if (this.elements.streamSection) {
      const shouldShowStreamSection =
        hasToken || Boolean(this.state.liveChatId || this.state.videoId || this.state.channel);
      this.elements.streamSection.classList.toggle('hidden', !shouldShowStreamSection);
    }
    if (this.elements.authSection) {
      this.elements.authSection.classList.toggle('has-token', hasToken);
    }
  }

  async fetchCurrentUser() {
    if (!this.state.token?.accessToken) {
      return;
    }
    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: {
          Authorization: `Bearer ${this.state.token.accessToken}`,
          Accept: 'application/json'
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          await this.refreshAccessToken(this.state.refreshToken);
        }
        return;
      }
      const data = await res.json();
      const channel = Array.isArray(data.items) && data.items.length ? data.items[0] : null;
      if (channel?.snippet?.title) {
        this.state.username = channel.snippet.title;
        if (this.elements.currentUser) {
          this.elements.currentUser.textContent = channel.snippet.title;
        }
      }
      if (channel?.snippet?.thumbnails?.default?.url && this.elements.userAvatar) {
        this.elements.userAvatar.style.backgroundImage = `url(${channel.snippet.thumbnails.default.url})`;
      }
    } catch (error) {
      console.warn('Failed to fetch current YouTube user', error);
    }
  }

  async ensureValidToken(options = {}) {
    console.debug('[YT Streaming] Validating token', {
      force: Boolean(options.force),
      hasAccessToken: Boolean(this.state.token?.accessToken),
      hasRefreshToken: Boolean(this.state.refreshToken)
    });
    if (options.force && this.state.refreshToken) {
      await this.refreshAccessToken(this.state.refreshToken);
      return Boolean(this.state.token?.accessToken);
    }
    if (!this.state.token?.accessToken) {
      console.warn('[YT Streaming] No access token available during validation');
      return false;
    }
    if (this.state.tokenExpiry) {
      const threshold = this.state.tokenExpiry - 5000;
      if (Date.now() < threshold) {
        return true;
      }
      if (this.state.refreshToken) {
        return this.refreshAccessToken(this.state.refreshToken);
      }
      this.clearStoredToken();
      this.state.token = null;
      this.state.refreshToken = null;
      this.state.tokenExpiry = null;
      this.updateAuthUi();
      return false;
    }
    return true;
  }

  handleSendMessage() {
    if (!this.elements.inputText) {
      return;
    }
    this.elements.inputText.value = '';
  }

  async resolveChannelContext() {
    try {
      const inputValue = this.elements.channelInput ? this.elements.channelInput.value : '';
      const resolved = await this.resolveLiveChatContext({ explicitInput: inputValue });
      if (resolved.liveChatId && resolved.status === 'live') {
        this.updateStatusText('Live chat ID resolved.', 'connected');
        if (this.state.token?.accessToken) {
          console.debug('[YT Streaming] Auto-connecting after resolve button', {
            liveChatId: resolved.liveChatId
          });
          this.connect({
            resolvedContext: resolved,
            reason: 'resolve_button',
            allowEmptyInput: true
          }).catch((error) => {
            console.error('YouTube streaming auto-connect after resolve button failed', error);
          });
        }
      } else if (resolved.status === 'upcoming') {
        this.updateStatusText('Stream is upcoming. Chat may not be available yet.', 'warning');
      } else if (resolved.status === 'offline') {
        this.updateStatusText('No active live stream found for this channel.', 'warning');
      } else {
        this.updateStatusText('Live chat ID not available for this target.', 'warning');
      }
    } catch (error) {
      const message = error?.message || 'Failed to resolve channel information.';
      this.updateStatusText(message, 'error');
      console.error('YouTube streaming resolution error', error);
    }
  }

  handleStreamStatus(status, meta) {
    console.debug('[YT Streaming] Status event', { status, meta });
    this.state.status = status;
    if (status === YOUTUBE_LIVE_CHAT_STATUS.RUNNING) {
      this.updateStatusText('Streaming', 'connected');
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.STARTING) {
      this.updateStatusText('Connecting…', 'connecting');
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.STOPPING) {
      this.updateStatusText('Disconnecting…', 'warning');
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.ERROR) {
      this.updateStatusText(
        meta?.error?.message || 'Streaming error encountered.',
        'error'
      );
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.IDLE) {
      this.updateStatusText('Idle', 'idle');
    }
    const isConnected = status === YOUTUBE_LIVE_CHAT_STATUS.RUNNING;
    this.toggleConnectedView(isConnected);
    this.updateAuthUi();
  }

  handleStreamError(error) {
    const message = error?.message || 'Failed to start YouTube streaming.';
    this.updateStatusText(message, 'error');
    console.error('YouTube streaming error', error);
  }

  handleStreamChat(chat) {
    console.debug('YouTube streaming chat event', chat);
    const rawItem = this.resolveChatRaw(chat);
    if (!rawItem) {
      console.debug('YouTube streaming received chat without raw payload', chat);
      return;
    }
    try {
      const payload = this.buildMessagePayload(rawItem);
      if (!payload) {
        return;
      }
      enqueueRelayMessage(payload);
      this.renderChatMessage(payload);
    } catch (error) {
      console.warn('Failed to normalise YouTube streaming chat item', error);
    }
  }

  resolveChatRaw(chat) {
    if (!chat) {
      console.debug('[YT Streaming] resolveChatRaw called without chat payload');
      return null;
    }
    if (chat.raw && chat.raw.snippet) {
      console.debug('[YT Streaming] Using chat.raw for normalization', {
        id: chat.raw.id,
        hasSnippet: Boolean(chat.raw.snippet),
        hasAuthor: Boolean(chat.raw.authorDetails)
      });
      return chat.raw;
    }
    if (chat.rawChunk && chat.rawChunk.snippet && chat.rawChunk.authorDetails) {
      console.debug('[YT Streaming] Building payload from rawChunk');
      return {
        ...chat.rawChunk,
        snippet: chat.rawChunk.snippet,
        authorDetails: chat.rawChunk.authorDetails
      };
    }
    if (chat.snippet && (chat.author || chat.rawChunk?.authorDetails)) {
      console.debug('[YT Streaming] Building payload from snippet/author fallbacks', {
        id: chat.id || chat.rawChunk?.id || null,
        hasAuthor: Boolean(chat.author || chat.rawChunk?.authorDetails)
      });
      return {
        kind: 'youtube#liveChatMessage',
        id: chat.id || chat.rawChunk?.id || null,
        snippet: chat.snippet,
        authorDetails: chat.author || chat.rawChunk?.authorDetails || null
      };
    }
    console.warn('[YT Streaming] Unable to resolve chat raw payload', chat);
    return null;
  }

  buildMessagePayload(item) {
    const normalized = normalizeYouTubeLiveChatItem(item, {
      transport: 'youtube_streaming_api',
      includeRaw: true
    });
    if (!normalized?.message) {
      console.warn('[YT Streaming] Normalizer returned empty message', {
        item,
        normalized
      });
      return null;
    }
    const message = { ...normalized.message };
    const baseHtml = message.chatmessage || '';
    const plainText = stripHtmlContent(baseHtml) || message.previewText || '';
    const isTextOnly = Boolean(settings.textonlymode);
    const finalChatMessage = isTextOnly ? plainText : replaceEmojis(baseHtml);

    message.chatmessage = finalChatMessage;
    message.textonly = isTextOnly;
    if (plainText && !message.previewText) {
      message.previewText = plainText;
    }
    if (this.state.videoId && !message.videoid) {
      message.videoid = this.state.videoId;
    }
    if (!settings?.nosubcolor) {
      if (message.isModerator) {
        message.nameColor = '#5e84f1';
      } else if (message.isMember && !message.nameColor) {
        message.nameColor = '#107516';
      }
    }
    if (message.sourceId) {
      rememberChatMessage(message.sourceId, {
        html: isTextOnly ? strictEscapeHtml(plainText) : finalChatMessage,
        plainText,
        authorName: message.chatname || '',
        channelId: message.userid || null
      });
    }
    console.debug('[YT Streaming] Built message payload', {
      sourceId: message.sourceId,
      chatname: message.chatname,
      previewText: message.previewText,
      badges: message.chatbadges ? message.chatbadges.length : 0
    });
    return message;
  }

  renderChatMessage(message) {
    if (!this.elements.chatLog) {
      return;
    }
    console.debug('[YT Streaming] Rendering chat message', {
      sourceId: message.sourceId,
      chatname: message.chatname
    });
    const shouldStick = shouldStickToBottom(this.elements.chatLog);
    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    const badgesHtml = this.buildBadgeHtml(message);
    const nameColor = message.nameColor || '';
    const safeName = strictEscapeHtml(message.chatname || 'YouTube User');
    const nameHtml = nameColor
      ? `<strong style="color:${nameColor}">${safeName}</strong>`
      : `<strong>${safeName}</strong>`;
    const chatHtml = message.textonly
      ? strictEscapeHtml(message.chatmessage || '')
      : message.chatmessage || '';
    entry.innerHTML = `${badgesHtml}${nameHtml}: <span class="chat-entry__message">${chatHtml}</span>`;
    this.elements.chatLog.appendChild(entry);
    while (this.elements.chatLog.childElementCount > STREAMING_MAX_CHAT_ENTRIES) {
      this.elements.chatLog.removeChild(this.elements.chatLog.firstElementChild);
    }
    if (shouldStick) {
      this.elements.chatLog.scrollTop = this.elements.chatLog.scrollHeight;
    }
  }

  buildBadgeHtml(message) {
    const badgeHtml = [];
    if (Array.isArray(message.chatbadges) && message.chatbadges.length) {
      message.chatbadges.forEach((badge) => {
        if (!badge) {
          return;
        }
        if (badge.type === 'img' && badge.src) {
          const title = badge.alt || badge.title || 'badge';
          badgeHtml.push(
            `<span class="chat-badge"><img src="${badge.src}" alt="${strictEscapeHtml(
              title
            )}" title="${strictEscapeHtml(title)}"/></span>`
          );
        } else if (badge.type === 'text' && badge.text) {
          badgeHtml.push(
            `<span class="chat-badge" title="${strictEscapeHtml(badge.title || 'badge')}">${strictEscapeHtml(
              badge.text
            )}</span>`
          );
        }
      });
    } else {
      if (message.isOwner) {
        badgeHtml.push('<span class="chat-badge" title="Channel Owner">👑</span>');
      }
      if (message.isModerator) {
        badgeHtml.push('<span class="chat-badge" title="Moderator">🛡️</span>');
      }
      if (message.isMember) {
        badgeHtml.push('<span class="chat-badge" title="Member">⭐</span>');
      }
    }
    return badgeHtml.join('');
  }

  updateStatusText(text, state) {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.dataset.state = state || 'idle';
    }
    console.debug('[YT Streaming] Status text updated', { text, state });
  }

  toggleConnectedView(isConnected) {
    if (this.elements.streamSection) {
      const hasToken = Boolean(this.state.token?.accessToken);
      this.elements.streamSection.classList.toggle('hidden', !hasToken);
      this.elements.streamSection.classList.toggle('is-connected', Boolean(isConnected));
    }
    if (this.elements.authSection) {
      this.elements.authSection.classList.toggle('is-connected', Boolean(isConnected));
    }
    if (this.elements.connectButton) {
      this.elements.connectButton.disabled = Boolean(isConnected);
    }
    if (this.elements.disconnectButton) {
      const hasToken = Boolean(this.state.token?.accessToken);
      this.elements.disconnectButton.disabled = !hasToken || !Boolean(isConnected);
    }
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !isConnected;
    }
    if (this.elements.inputText) {
      this.elements.inputText.disabled = !isConnected;
    }
    console.debug('[YT Streaming] Updated connected view', { isConnected });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  modulesReady
    .then(() => {
      const app = new YoutubeStreamingApp();
      app.init().catch((error) => console.error('Failed to initialise YouTube streaming app', error));
    })
    .catch((error) => {
      console.error('YouTube streaming bootstrap failed', error);
    });
});
const DEFAULT_CLIENT_ID = '689627108309-isbjas8fmbc7sucmbm7gkqjapk7btbsi.apps.googleusercontent.com';
const AUTH_BASE_URL = 'https://ytauth.socialstream.ninja';
const OAUTH_STATE_KEY = 'youtubeStreamingOAuthState';
const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtube.channel-memberships.creator'
];
