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
      status: 'disconnected'
    };
    this.elements = {};
    this.contextResolver = null;
    this.clientId = DEFAULT_CLIENT_ID;
    this.apiKey = null;
  }

  async init() {
    await modulesReady;
    this.cacheElements();
    this.bindEvents();
    this.applyClientOverrides();
    await this.processOAuthResponse();
    await this.hydrateStoredToken();
    this.restoreFromParams();
    await this.fetchCurrentUser().catch(() => {});
    this.updateAuthUi();
    this.updateStatusText('Disconnected', 'disconnected');
    window.youtubeStreamingApp = this;
  }

  cacheElements() {
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
      return this.streamClient;
    }
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

  async connect() {
    if (!this.state.token || !this.state.token.accessToken) {
      this.beginAuthFlow();
      return;
    }

    const inputValue = this.elements.channelInput ? this.elements.channelInput.value : '';
    if (!inputValue && !this.state.liveChatId && !this.state.videoId && !this.state.channel) {
      this.updateStatusText('Provide a Live Chat ID, video ID, or channel handle.', 'error');
      return;
    }

    try {
      const resolved = await this.resolveLiveChatContext({
        explicitInput: inputValue || null,
        requireLiveChat: true
      });
      if (!resolved.liveChatId) {
        if (resolved.status === 'upcoming') {
          this.updateStatusText('Stream is upcoming; chat not yet available.', 'warning');
          return;
        }
        this.updateStatusText('No live chat available for this target.', 'error');
        return;
      }
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

    const client = this.ensureStreamClient();
    client.stop({ suppressStatus: true });
    this.updateStatusText('Connecting…', 'connecting');

    try {
      await client.start({
        chatId: this.state.liveChatId,
        token: this.state.token
      });
      this.toggleConnectedView(true);
      this.updateStatusText('Streaming', 'connected');
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
      return false;
    }
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
      return true;
    } catch (error) {
      console.error('YouTube token refresh failed', error);
      this.clearStoredToken();
      this.state.token = null;
      this.state.refreshToken = null;
      this.state.tokenExpiry = null;
      this.updateAuthUi();
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
    if (this.elements.connectButton) {
      this.elements.connectButton.textContent = hasToken ? 'Connect' : 'Sign in with YouTube';
    }
    if (this.elements.disconnectButton) {
      this.elements.disconnectButton.disabled = !hasToken;
    }
    if (this.elements.signOutButton) {
      this.elements.signOutButton.disabled = !hasToken;
    }
    if (this.elements.inputText) {
      this.elements.inputText.disabled = !hasToken;
    }
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !hasToken;
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
    if (options.force && this.state.refreshToken) {
      await this.refreshAccessToken(this.state.refreshToken);
      return Boolean(this.state.token?.accessToken);
    }
    if (!this.state.token?.accessToken) {
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
    this.state.status = status;
    if (status === YOUTUBE_LIVE_CHAT_STATUS.RUNNING) {
      this.updateStatusText('Streaming', 'connected');
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.STARTING) {
      this.updateStatusText('Connecting…', 'connecting');
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.ERROR) {
      this.updateStatusText(
        meta?.error?.message || 'Streaming error encountered.',
        'error'
      );
    } else if (status === YOUTUBE_LIVE_CHAT_STATUS.IDLE) {
      this.updateStatusText('Idle', 'idle');
    }
  }

  handleStreamError(error) {
    const message = error?.message || 'Failed to start YouTube streaming.';
    this.updateStatusText(message, 'error');
    console.error('YouTube streaming error', error);
  }

  handleStreamChat(chat) {
    if (!chat?.raw) {
      return;
    }
    try {
      const payload = this.buildMessagePayload(chat.raw);
      if (!payload) {
        return;
      }
      enqueueRelayMessage(payload);
      this.renderChatMessage(payload);
    } catch (error) {
      console.warn('Failed to normalise YouTube streaming chat item', error);
    }
  }

  buildMessagePayload(item) {
    const normalized = normalizeYouTubeLiveChatItem(item, {
      transport: 'youtube_streaming_api',
      includeRaw: true
    });
    return normalized?.message || null;
  }

  renderChatMessage(message) {
    if (!this.elements.chatLog) {
      return;
    }
    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    const name = document.createElement('strong');
    name.textContent = message.chatname || 'YouTube User';
    const text = document.createElement('span');
    text.className = 'chat-entry__message';
    text.textContent = message.chatmessage || '';
    entry.append(name, document.createTextNode(': '), text);
    this.elements.chatLog.prepend(entry);
    const maxEntries = 200;
    while (this.elements.chatLog.childElementCount > maxEntries) {
      this.elements.chatLog.removeChild(this.elements.chatLog.lastElementChild);
    }
  }

  updateStatusText(text, state) {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.dataset.state = state || 'idle';
    }
  }

  toggleConnectedView(isConnected) {
    if (this.elements.authSection && this.elements.streamSection) {
      if (isConnected) {
        this.elements.authSection.classList.add('hidden');
        this.elements.streamSection.classList.remove('hidden');
      } else {
        this.elements.authSection.classList.remove('hidden');
        this.elements.streamSection.classList.add('hidden');
      }
    }
    if (this.elements.connectButton) {
      this.elements.connectButton.disabled = isConnected;
    }
    if (this.elements.disconnectButton) {
      this.elements.disconnectButton.disabled = !isConnected;
    }
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !isConnected;
    }
    if (this.elements.inputText) {
      this.elements.inputText.disabled = !isConnected;
    }
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
