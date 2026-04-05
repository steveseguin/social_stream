(function () {
const guardRoot = typeof document !== 'undefined' ? document.documentElement : null;
const guardAttr = 'data-ssn-facebook-ws-loaded';

try {
  if (guardRoot && guardRoot.getAttribute(guardAttr) === '1') {
    return;
  }
  if (guardRoot) {
    guardRoot.setAttribute(guardAttr, '1');
  }
} catch (err) {}

const STORAGE_KEY = 'facebookApiConfig';
const AUTH_STORAGE_KEY = 'facebookApiAuth';
const API_VERSION = 'v20.0';
const DEFAULT_POLL_INTERVAL = 3000;
const MIN_POLL_INTERVAL = 1500;
const MAX_POLL_INTERVAL = 30000;
const MAX_DEDUPE = 500;
const VIEWER_POLL_INTERVAL = 15000;
const DEFAULT_OAUTH_BASE = 'https://auth.socialstream.ninja/auth/facebook/pages';
const AUTH_MESSAGE_SUCCESS = 'ssn-facebook-auth-success';
const AUTH_MESSAGE_ERROR = 'ssn-facebook-auth-error';
const AUTH_RESULT_KEY = 'facebook_auth_result';
const AUTH_ERROR_KEY = 'facebook_auth_error';
const FACEBOOK_AUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content'
];

const TAB_ID = typeof window !== 'undefined' && typeof window.__SSAPP_TAB_ID__ !== 'undefined'
  ? window.__SSAPP_TAB_ID__
  : null;

const extension = {
  available: typeof chrome !== 'undefined' && !!(chrome && chrome.runtime && chrome.runtime.id),
  settings: {},
  tabId: TAB_ID
};

const state = {
  oauthBase: DEFAULT_OAUTH_BASE,
  accessToken: '',
  pageId: '',
  videoId: '',
  pollInterval: DEFAULT_POLL_INTERVAL,
  autoConnect: false,
  liveFilter: true,
  viewerCount: false,
  connected: false,
  polling: false,
  pollTimer: null,
  lastPollAt: null,
  lastViewerAt: 0,
  lastTimestamp: null,
  failureCount: 0,
  messageCount: 0,
  errorCount: 0,
  seenIds: new Set(),
  seenQueue: [],
  textOnly: false,
  viewerValue: null,
  videoTitle: '',
  authUser: null,
  authPages: [],
  selectedPageId: '',
  authPopup: null
};

const els = {};

function cacheElements() {
  els.oauthBase = document.getElementById('oauth-base');
  els.pageSelect = document.getElementById('page-select');
  els.pageSelectHint = document.getElementById('page-select-hint');
  els.accessToken = document.getElementById('access-token');
  els.videoId = document.getElementById('video-id');
  els.pageId = document.getElementById('page-id');
  els.pollInterval = document.getElementById('poll-interval');
  els.autoConnect = document.getElementById('auto-connect');
  els.liveFilter = document.getElementById('live-filter');
  els.viewerCount = document.getElementById('viewer-count');
  els.showToken = document.getElementById('show-token');
  els.signinBtn = document.getElementById('signin-btn');
  els.clearAuthBtn = document.getElementById('clear-auth-btn');
  els.connectBtn = document.getElementById('connect-btn');
  els.disconnectBtn = document.getElementById('disconnect-btn');
  els.resolveBtn = document.getElementById('resolve-btn');
  els.statusChip = document.getElementById('status-chip');
  els.statusText = document.getElementById('status-text');
  els.statusDetail = document.getElementById('status-detail');
  els.messageCount = document.getElementById('message-count');
  els.errorCount = document.getElementById('error-count');
  els.lastPoll = document.getElementById('last-poll');
  els.chatFeed = document.getElementById('chat-feed');
  els.chatEmpty = document.getElementById('chat-empty');
}

function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clamp(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(Math.max(num, min), max);
}

function parseCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return Number.isFinite(num) ? num : null;
}

function hasAccessToken() {
  return !!String(state.accessToken || '').trim();
}

function canResolveLiveVideo() {
  return hasAccessToken() && !!String(state.pageId || '').trim();
}

function canConnectNow() {
  return hasAccessToken() && (!!String(state.videoId || '').trim() || !!String(state.pageId || '').trim());
}

function updateActionButtons() {
  if (!els.connectBtn || !els.disconnectBtn || !els.resolveBtn) return;
  els.connectBtn.disabled = state.connected || !canConnectNow();
  els.disconnectBtn.disabled = !state.connected;
  els.resolveBtn.disabled = !canResolveLiveVideo();
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch (err) {
    return '-';
  }
}

function normalizeVideoId(value) {
  if (!value) return '';
  const trimmed = value.trim();
  const match = trimmed.match(/\/videos\/(\d+)/) || trimmed.match(/video_id=(\d+)/);
  if (match) return match[1];
  return trimmed;
}

function normalizePageId(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.includes('facebook.com')) return trimmed;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length) return parts[0];
  } catch (err) {
    return trimmed;
  }
  return trimmed;
}

function normalizeOauthBase(value) {
  const raw = (value || '').trim();
  if (!raw) return DEFAULT_OAUTH_BASE;
  return raw.replace(/\/+$/, '');
}

function getRuntimeOrigin() {
  try {
    if (window.location && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
  } catch (err) {}
  return '*';
}

function getOauthOrigin() {
  try {
    return new URL(state.oauthBase).origin;
  } catch (err) {
    return '';
  }
}

function getAuthReturnTo() {
  try {
    return String(window.location.href || '').split('#')[0];
  } catch (err) {
    return '';
  }
}

function getAuthStartUrl() {
  const url = new URL(`${state.oauthBase}/start`);
  url.searchParams.set('return_to', getAuthReturnTo());
  url.searchParams.set('origin', getRuntimeOrigin());
  return url.toString();
}

function base64UrlToJson(value) {
  if (!value) return null;
  try {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

function getPageById(pageId) {
  if (!pageId) return null;
  for (let i = 0; i < state.authPages.length; i += 1) {
    if (String(state.authPages[i].id || '') === String(pageId)) {
      return state.authPages[i];
    }
  }
  return null;
}

function getUrlParam(key) {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return search.get(key) || hash.get(key);
}

function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (err) {
    saved = {};
  }

  const urlToken = getUrlParam('access_token') || getUrlParam('token');
  const urlVideo = getUrlParam('videoId') || getUrlParam('video_id');
  const urlPage = getUrlParam('pageId') || getUrlParam('page_id') || getUrlParam('channel');
  const urlInterval = getUrlParam('poll');
  const urlAuto = getUrlParam('autoconnect');
  const urlLiveFilter = getUrlParam('live_filter');
  const urlOauthBase = getUrlParam('oauthBase') || getUrlParam('oauth_base');

  state.oauthBase = normalizeOauthBase(urlOauthBase || saved.oauthBase || DEFAULT_OAUTH_BASE);
  state.accessToken = urlToken || saved.accessToken || '';
  state.videoId = normalizeVideoId(urlVideo || saved.videoId || '');
  state.pageId = normalizePageId(urlPage || saved.pageId || '');
  state.pollInterval = clamp(urlInterval || saved.pollInterval || DEFAULT_POLL_INTERVAL, MIN_POLL_INTERVAL, MAX_POLL_INTERVAL);
  if (urlAuto !== null) {
    state.autoConnect = urlAuto === '1' || urlAuto === 'true';
  } else {
    state.autoConnect = saved.autoConnect || false;
  }
  state.liveFilter = urlLiveFilter
    ? urlLiveFilter !== '0' && urlLiveFilter !== 'false'
    : saved.liveFilter !== undefined
      ? Boolean(saved.liveFilter)
      : true;
  state.viewerCount = saved.viewerCount || false;
}

function saveConfig() {
  const payload = {
    oauthBase: state.oauthBase,
    accessToken: state.accessToken,
    videoId: state.videoId,
    pageId: state.pageId,
    pollInterval: state.pollInterval,
    autoConnect: state.autoConnect,
    liveFilter: state.liveFilter,
    viewerCount: state.viewerCount
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save Facebook config', err);
  }
}

function saveAuthState() {
  const payload = {
    oauthBase: state.oauthBase,
    authUser: state.authUser,
    authPages: state.authPages,
    selectedPageId: state.selectedPageId
  };
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save Facebook auth state', err);
  }
}

function loadAuthState() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
  } catch (err) {
    saved = {};
  }
  state.oauthBase = normalizeOauthBase(saved.oauthBase || state.oauthBase || DEFAULT_OAUTH_BASE);
  state.authUser = saved.authUser || null;
  state.authPages = Array.isArray(saved.authPages) ? saved.authPages.filter((page) => page && page.id && page.accessToken) : [];
  state.selectedPageId = saved.selectedPageId || (state.pageId && getPageById(state.pageId) ? state.pageId : '');
  if (state.selectedPageId) {
    const selectedPage = getPageById(state.selectedPageId);
    if (selectedPage) {
      state.pageId = String(selectedPage.id || state.pageId || '');
      if (!getUrlParam('access_token') && !getUrlParam('token')) {
        state.accessToken = String(selectedPage.accessToken || state.accessToken || '');
      }
    }
  }
}

function clearAuthState() {
  state.authUser = null;
  state.authPages = [];
  state.selectedPageId = '';
  state.accessToken = '';
  if (!getUrlParam('pageId') && !getUrlParam('page_id') && !getUrlParam('channel')) {
    state.pageId = '';
  }
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear Facebook auth state', err);
  }
}

function updateInputs() {
  if (els.oauthBase) els.oauthBase.value = state.oauthBase;
  updatePageOptions();
  if (els.accessToken) els.accessToken.value = state.accessToken;
  if (els.videoId) els.videoId.value = state.videoId;
  if (els.pageId) els.pageId.value = state.pageId;
  if (els.pollInterval) els.pollInterval.value = state.pollInterval;
  if (els.autoConnect) els.autoConnect.checked = state.autoConnect;
  if (els.liveFilter) els.liveFilter.checked = state.liveFilter;
  if (els.viewerCount) els.viewerCount.checked = state.viewerCount;
  updateActionButtons();
}

function syncStateFromInputs() {
  state.oauthBase = normalizeOauthBase((els.oauthBase && els.oauthBase.value) || DEFAULT_OAUTH_BASE);
  state.accessToken = ((els.accessToken && els.accessToken.value) || '').trim();
  state.videoId = normalizeVideoId((els.videoId && els.videoId.value) || '');
  state.pageId = normalizePageId((els.pageId && els.pageId.value) || '');
  state.pollInterval = clamp((els.pollInterval && els.pollInterval.value) || DEFAULT_POLL_INTERVAL, MIN_POLL_INTERVAL, MAX_POLL_INTERVAL);
  state.autoConnect = !!(els.autoConnect && els.autoConnect.checked);
  state.liveFilter = !!(els.liveFilter && els.liveFilter.checked);
  state.viewerCount = !!(els.viewerCount && els.viewerCount.checked);
  if (els.pageSelect && els.pageSelect.value) {
    state.selectedPageId = els.pageSelect.value;
  }
  if (els.oauthBase) els.oauthBase.value = state.oauthBase;
  if (els.videoId) els.videoId.value = state.videoId;
  if (els.pageId) els.pageId.value = state.pageId;
  if (els.pollInterval) els.pollInterval.value = state.pollInterval;
  updateActionButtons();
}

function updatePageOptions() {
  if (!els.pageSelect) return;
  const currentValue = state.selectedPageId || '';
  els.pageSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = state.authPages.length ? 'Choose a managed Page' : 'Sign in to load your Pages';
  els.pageSelect.appendChild(placeholder);
  for (let i = 0; i < state.authPages.length; i += 1) {
    const page = state.authPages[i];
    const option = document.createElement('option');
    option.value = String(page.id);
    option.textContent = page.name ? `${page.name} (${page.id})` : String(page.id);
    if (String(page.id) === String(currentValue)) {
      option.selected = true;
    }
    els.pageSelect.appendChild(option);
  }
  if (!currentValue) {
    els.pageSelect.value = '';
  }
  if (els.pageSelectHint) {
    if (state.authPages.length) {
      const userName = state.authUser && state.authUser.name ? `Signed in as ${state.authUser.name}. ` : '';
      els.pageSelectHint.textContent = `${userName}Choose the Facebook Page to use for chat capture.`;
    } else {
      els.pageSelectHint.textContent = 'After sign-in, choose the Facebook Page to use for chat capture.';
    }
  }
}

function applySelectedPage(pageId) {
  const page = getPageById(pageId);
  if (!page) return false;
  state.selectedPageId = String(page.id || '');
  state.pageId = String(page.id || '');
  state.accessToken = String(page.accessToken || '');
  if (els.pageSelect) {
    els.pageSelect.value = state.selectedPageId;
  }
  updateInputs();
  saveConfig();
  saveAuthState();
  return true;
}

function isViewerTrackingEnabled(settingsOverride) {
  const activeSettings = settingsOverride && typeof settingsOverride === 'object'
    ? settingsOverride
    : extension.settings && typeof extension.settings === 'object'
      ? extension.settings
      : {};
  return Boolean(activeSettings.showviewercount || activeSettings.hypemode);
}

function handleAuthSuccess(payload) {
  const pages = Array.isArray(payload && payload.pages) ? payload.pages : [];
  state.authUser = payload && payload.user ? payload.user : null;
  state.authPages = pages
    .filter((page) => page && page.id && page.accessToken)
    .map((page) => ({
      id: String(page.id),
      name: page.name || '',
      accessToken: String(page.accessToken || ''),
      category: page.category || '',
      tasks: Array.isArray(page.tasks) ? page.tasks : []
    }));
  if (!state.authPages.length) {
    updatePageOptions();
    saveAuthState();
    setStatus('error', 'Facebook sign-in succeeded, but no managed Pages were returned for this account.');
    return;
  }

  const preferredPage = getPageById(state.selectedPageId) || state.authPages[0];
  applySelectedPage(preferredPage.id);
  updatePageOptions();
  const authName = state.authUser && state.authUser.name ? ` as ${state.authUser.name}` : '';
  setStatus('connected', `Signed in${authName}. Selected Page ${preferredPage.name || preferredPage.id}.`);
}

function handleAuthError(payload) {
  const message = payload && payload.message ? payload.message : 'Facebook sign-in failed.';
  setStatus('error', message);
}

function updateStats() {
  els.messageCount.textContent = String(state.messageCount);
  els.errorCount.textContent = String(state.errorCount);
  els.lastPoll.textContent = formatTime(state.lastPollAt);
  updateActionButtons();
}

function setStatus(status, message) {
  const statusText = status === 'connected'
    ? 'Connected'
    : status === 'connecting'
      ? 'Connecting'
      : status === 'error'
        ? 'Error'
        : 'Disconnected';
  els.statusChip.textContent = statusText;
  els.statusText.textContent = statusText;
  els.statusChip.classList.remove('connected', 'connecting', 'error');
  if (status === 'connected') els.statusChip.classList.add('connected');
  if (status === 'connecting') els.statusChip.classList.add('connecting');
  if (status === 'error') els.statusChip.classList.add('error');
  if (message) {
    els.statusDetail.textContent = message;
  }
}

function handleAuthPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.type === AUTH_MESSAGE_SUCCESS) {
    handleAuthSuccess(payload);
    return true;
  }
  if (payload.type === AUTH_MESSAGE_ERROR) {
    handleAuthError(payload);
    return true;
  }
  return false;
}

function consumeAuthResultFromHash() {
  let changed = false;
  try {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const encodedResult = hash.get(AUTH_RESULT_KEY);
    const encodedError = hash.get(AUTH_ERROR_KEY);
    if (encodedResult) {
      const payload = base64UrlToJson(encodedResult);
      if (payload) {
        handleAuthPayload(payload);
      }
      hash.delete(AUTH_RESULT_KEY);
      changed = true;
    }
    if (encodedError) {
      const payload = base64UrlToJson(encodedError);
      if (payload) {
        handleAuthPayload(payload);
      }
      hash.delete(AUTH_ERROR_KEY);
      changed = true;
    }
    if (changed) {
      const cleanUrl = `${window.location.pathname}${window.location.search}${hash.toString() ? `#${hash.toString()}` : ''}`;
      history.replaceState({}, document.title, cleanUrl);
    }
  } catch (err) {
    console.warn('Failed to consume Facebook auth callback payload', err);
  }
}

function getExpectedAuthMessageOrigin() {
  const origin = getOauthOrigin();
  return origin || '';
}

function getFacebookOAuthBridge() {
  if (
    window.ninjafy &&
    typeof window.ninjafy.startFacebookOAuth === 'function' &&
    typeof window.ninjafy.exchangeFacebookOAuthCode === 'function'
  ) {
    return window.ninjafy;
  }
  if (
    window.__ssapp &&
    typeof window.__ssapp.startFacebookOAuth === 'function' &&
    typeof window.__ssapp.exchangeFacebookOAuthCode === 'function'
  ) {
    return window.__ssapp;
  }
  return null;
}

function isElectronFacebookContext() {
  return !!getFacebookOAuthBridge();
}

function generateAuthNonce(length) {
  const size = Number(length) > 0 ? Number(length) : 24;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < size; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

async function startExternalFacebookAuthFlow() {
  const bridge = getFacebookOAuthBridge();
  if (!bridge || typeof bridge.startFacebookOAuth !== 'function' || typeof bridge.exchangeFacebookOAuthCode !== 'function') {
    throw new Error('Restart the desktop app to load Facebook sign-in support.');
  }

  syncStateFromInputs();
  saveConfig();
  saveAuthState();

  const stateValue = generateAuthNonce(24);
  setStatus('connecting', 'Opening Facebook sign-in in your default browser...');

  const result = await bridge.startFacebookOAuth({
    authBase: state.oauthBase,
    state: stateValue,
    scopes: FACEBOOK_AUTH_SCOPES,
    apiVersion: API_VERSION
  });

  if (!result || !result.code) {
    throw new Error('Facebook OAuth did not return an authorization code.');
  }

  const payload = await bridge.exchangeFacebookOAuthCode({
    authBase: state.oauthBase,
    code: result.code,
    redirectUri: result.redirectUri,
    apiVersion: API_VERSION
  });

  if (!handleAuthPayload(payload)) {
    throw new Error('Facebook OAuth exchange returned an unexpected response.');
  }
}

function openAuthPopup() {
  if (isElectronFacebookContext()) {
    startExternalFacebookAuthFlow().catch((err) => {
      setStatus('error', `Facebook sign-in failed: ${err.message || err}`);
    });
    return;
  }
  try {
    syncStateFromInputs();
    saveConfig();
    saveAuthState();
    const authUrl = getAuthStartUrl();
    const popup = window.open(authUrl, 'facebookAuth', 'width=560,height=760');
    if (!popup) {
      setStatus('error', 'Popup blocked. Allow popups for this site and try again.');
      return;
    }
    state.authPopup = popup;
    setStatus('connecting', 'Opening Facebook sign-in...');
  } catch (err) {
    setStatus('error', `Facebook sign-in failed to start: ${err.message || err}`);
  }
}

function clearAuthSelection() {
  disconnect();
  clearAuthState();
  updateInputs();
  updatePageOptions();
  saveConfig();
  setStatus('disconnected', 'Facebook sign-in cleared. Paste a Page token manually or sign in again.');
  updateActionButtons();
}

function bindAuthMessages() {
  window.addEventListener('message', (event) => {
    const expectedOrigin = getExpectedAuthMessageOrigin();
    if (expectedOrigin && event.origin !== expectedOrigin) {
      return;
    }
    if (handleAuthPayload(event.data)) {
      if (state.authPopup && !state.authPopup.closed) {
        try {
          state.authPopup.close();
        } catch (err) {}
      }
      state.authPopup = null;
    }
  });
}

function applySettings(settings) {
  extension.settings = settings && typeof settings === 'object' ? settings : {};
  state.textOnly = Boolean(settings && settings.textonlymode);
  state.viewerCount = isViewerTrackingEnabled(settings);
  if (!state.pageId && settings && settings.facebook_username && settings.facebook_username.textsetting) {
    state.pageId = normalizePageId(settings.facebook_username.textsetting);
  }
  updateInputs();
  if (state.autoConnect && state.accessToken && state.pageId && !state.connected) {
    connect();
  }
}

function initExtension() {
  if (!extension.available) return;
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && typeof request === 'object' && request.settings) {
        extension.settings = request.settings;
        applySettings(request.settings);
        sendResponse(true);
        return;
      }
      sendResponse(false);
    });

    chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.settings) {
        extension.settings = response.settings;
        applySettings(response.settings);
      }
    });
  } catch (err) {
    console.warn('Failed to init extension bridge', err);
  }
}

function relayPayload(payload) {
  try {
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
      window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, () => {});
      return;
    }
    if (window.ninjafy && typeof window.ninjafy.sendMessage === 'function') {
      window.ninjafy.sendMessage(null, payload, null, extension.tabId);
      return;
    }
    const fallback = { ...payload };
    if (extension.tabId !== null) {
      fallback.__tabID__ = extension.tabId;
    }
    window.postMessage(fallback, '*');
  } catch (err) {
    console.warn('Failed to relay payload', err);
  }
}

async function graphRequest(path, params) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, value);
  });
  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = data && data.error ? data.error : {};
    const message = err.message || `HTTP ${response.status}`;
    const code = err.code || response.status;
    const type = err.type || 'api_error';
    const details = { message, code, type };
    const error = new Error(message);
    error.details = details;
    throw error;
  }
  return data;
}

async function resolveLiveVideo({ connectAfter = false } = {}) {
  syncStateFromInputs();
  if (!state.accessToken) {
    setStatus('error', 'A Page access token is required to resolve live video.');
    return;
  }
  if (!state.pageId) {
    setStatus('error', 'Page ID or name is required to resolve live video.');
    return;
  }
  setStatus('connecting', 'Resolving Page live video...');
  try {
    const data = await graphRequest(`${encodeURIComponent(state.pageId)}/live_videos`, {
      fields: 'id,title,permalink_url,status,creation_time',
      broadcast_status: 'LIVE',
      access_token: state.accessToken
    });
    const entry = Array.isArray(data.data) && data.data.length ? data.data[0] : null;
    if (!entry || !entry.id) {
      setStatus('error', 'No live video found for this Page.');
      return;
    }
    state.videoId = String(entry.id);
    state.videoTitle = entry.title || '';
    updateInputs();
    saveConfig();
    setStatus('connected', `Resolved live video ${state.videoId}.`);
    if (connectAfter) {
      connect();
    }
  } catch (err) {
    const details = err && err.details ? err.details : null;
    const msg = details && details.message ? details.message : 'Failed to resolve live video.';
    setStatus('error', msg);
    state.errorCount += 1;
    updateStats();
  }
}

function schedulePoll(delayOverride) {
  if (!state.connected) return;
  const delay = typeof delayOverride === 'number' ? delayOverride : state.pollInterval;
  clearTimeout(state.pollTimer);
  state.pollTimer = setTimeout(pollOnce, delay);
}

function getViewerCountValue(data) {
  if (!data || typeof data !== 'object') return null;
  const liveViews = parseCount(data.live_views);
  if (liveViews !== null) return liveViews;
  const liveViewsCount = parseCount(data.live_views_count);
  if (liveViewsCount !== null) return liveViewsCount;
  const viewCount = parseCount(data.view_count);
  if (viewCount !== null) return viewCount;
  return null;
}

async function pollViewerCount() {
  if (!isViewerTrackingEnabled()) return;
  const now = Date.now();
  if (now - state.lastViewerAt < VIEWER_POLL_INTERVAL) return;
  state.lastViewerAt = now;
  try {
    const data = await graphRequest(`${encodeURIComponent(state.videoId)}`, {
      fields: 'live_views,live_views_count,view_count',
      access_token: state.accessToken
    });
    const viewerValue = getViewerCountValue(data);
    if (viewerValue !== null && viewerValue !== state.viewerValue) {
      state.viewerValue = viewerValue;
      relayPayload({
        message: {
          platform: 'facebook',
          type: 'facebook',
          event: 'viewer_update',
          meta: viewerValue,
          chatname: '',
          chatmessage: '',
          chatimg: '',
          chatbadges: '',
          backgroundColor: '',
          textColor: '',
          hasDonation: '',
          membership: '',
          textonly: true
        }
      });
    }
  } catch (err) {
    state.errorCount += 1;
    updateStats();
  }
}

function buildCommentsParams() {
  const params = {
    access_token: state.accessToken,
    limit: 50,
    fields: 'id,from{name,id},message,created_time,permalink_url,attachment'
  };
  if (state.liveFilter) {
    params.live_filter = 'stream';
  } else {
    params.order = 'chronological';
  }
  if (state.lastTimestamp) {
    params.since = Math.max(Math.floor(state.lastTimestamp / 1000) - 1, 0);
  }
  return params;
}

function createMessagePayload(entry) {
  const from = entry.from || {};
  const messageText = entry.message || (entry.attachment && (entry.attachment.title || entry.attachment.description)) || '';
  const cleanMessage = escapeHtml(messageText || '[Attachment]');
  const createdAt = entry.created_time ? new Date(entry.created_time) : null;
  const chatimg = from.id ? `https://graph.facebook.com/${encodeURIComponent(from.id)}/picture?type=normal` : '';
  const meta = {
    commentId: entry.id || '',
    fromId: from.id || '',
    fromName: from.name || '',
    createdTime: entry.created_time || '',
    permalink: entry.permalink_url || '',
    videoId: state.videoId || '',
    pageId: state.pageId || ''
  };
  if (entry.attachment) {
    meta.attachment = entry.attachment;
  }

  return {
    platform: 'facebook',
    type: 'facebook',
    chatname: from.name || 'Facebook User',
    chatmessage: cleanMessage,
    chatimg,
    chatbadges: '',
    backgroundColor: '',
    textColor: '',
    hasDonation: '',
    membership: '',
    textonly: state.textOnly,
    timestamp: createdAt ? createdAt.getTime() : undefined,
    meta
  };
}

function renderMessage(payload) {
  if (!payload) return;
  if (els.chatEmpty) {
    els.chatEmpty.remove();
    els.chatEmpty = null;
  }
  const line = document.createElement('div');
  line.className = 'chat-line';
  const header = document.createElement('div');
  header.className = 'chat-header';
  const name = document.createElement('span');
  name.textContent = payload.chatname || 'Facebook User';
  const time = document.createElement('span');
  time.className = 'chat-time';
  time.textContent = payload.timestamp ? formatTime(payload.timestamp) : '';
  header.appendChild(name);
  header.appendChild(time);
  const text = document.createElement('div');
  text.className = 'chat-text';
  text.innerHTML = payload.chatmessage || '';
  line.appendChild(header);
  line.appendChild(text);
  els.chatFeed.appendChild(line);

  while (els.chatFeed.children.length > 200) {
    els.chatFeed.removeChild(els.chatFeed.firstChild);
  }
  els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
}

function updateLastTimestamp(entry) {
  if (!entry || !entry.created_time) return;
  const time = Date.parse(entry.created_time);
  if (Number.isNaN(time)) return;
  if (!state.lastTimestamp || time > state.lastTimestamp) {
    state.lastTimestamp = time;
  }
}

function trackSeenId(id) {
  if (!id) return false;
  if (state.seenIds.has(id)) return false;
  state.seenIds.add(id);
  state.seenQueue.push(id);
  if (state.seenQueue.length > MAX_DEDUPE) {
    const oldest = state.seenQueue.shift();
    if (oldest) state.seenIds.delete(oldest);
  }
  return true;
}

function handleComments(entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const outgoing = [];
  entries.forEach((entry) => {
    if (!entry || !entry.id) return;
    if (!trackSeenId(entry.id)) return;
    updateLastTimestamp(entry);
    const payload = createMessagePayload(entry);
    if (!payload.chatmessage) return;
    outgoing.push(payload);
    renderMessage(payload);
  });

  if (!outgoing.length) return;
  state.messageCount += outgoing.length;
  updateStats();
  const relay = outgoing.length === 1 ? { message: outgoing[0] } : { messages: outgoing };
  relayPayload(relay);
}

async function pollOnce() {
  if (!state.connected || state.polling) return;
  state.polling = true;
  try {
    const data = await graphRequest(`${encodeURIComponent(state.videoId)}/comments`, buildCommentsParams());
    handleComments(data && data.data ? data.data : []);
    await pollViewerCount();
    state.failureCount = 0;
    state.lastPollAt = Date.now();
    updateStats();
    setStatus('connected', 'Connected to Facebook Live comments.');
    schedulePoll();
  } catch (err) {
    state.failureCount += 1;
    state.errorCount += 1;
    state.lastPollAt = Date.now();
    updateStats();
    const details = err && err.details ? err.details : null;
    const msg = details && details.message ? details.message : 'Polling error.';
    const code = details && details.code ? Number(details.code) : null;
    if (code === 190 || code === 10) {
      state.connected = false;
      clearTimeout(state.pollTimer);
      els.connectBtn.disabled = false;
      els.disconnectBtn.disabled = true;
      setStatus('error', 'Page access token is invalid or missing permissions.');
      return;
    }
    if (state.liveFilter && msg && msg.toLowerCase().includes('live_filter')) {
      state.liveFilter = false;
      updateInputs();
      saveConfig();
      setStatus('error', 'Live filter not supported. Switched to chronological polling.');
      schedulePoll(state.pollInterval);
      return;
    }
    setStatus('error', msg);
    const backoff = Math.min(state.pollInterval * Math.pow(2, Math.min(state.failureCount, 4)), 60000);
    schedulePoll(backoff);
  } finally {
    state.polling = false;
  }
}

function connect() {
  syncStateFromInputs();
  saveConfig();
  if (state.connected) {
    disconnect();
  }
  if (!state.accessToken) {
    setStatus('error', 'Sign in with Facebook first.');
    updateActionButtons();
    return;
  }
  if (!state.videoId) {
    if (state.pageId) {
      resolveLiveVideo({ connectAfter: true });
      return;
    }
    setStatus('error', 'Live video ID is required.');
    updateActionButtons();
    return;
  }
  state.connected = true;
  state.failureCount = 0;
  state.polling = false;
  setStatus('connecting', 'Connecting to Facebook Page live chat...');
  updateActionButtons();
  pollOnce();
}

function disconnect() {
  state.connected = false;
  state.polling = false;
  clearTimeout(state.pollTimer);
  setStatus('disconnected', 'Disconnected.');
  updateActionButtons();
}

function bindEvents() {
  els.signinBtn.addEventListener('click', openAuthPopup);
  els.clearAuthBtn.addEventListener('click', clearAuthSelection);
  els.connectBtn.addEventListener('click', connect);
  els.disconnectBtn.addEventListener('click', disconnect);
  els.resolveBtn.addEventListener('click', () => resolveLiveVideo({ connectAfter: false }));
  els.pageSelect.addEventListener('change', () => {
    const selectedPageId = els.pageSelect.value || '';
    if (!selectedPageId) return;
    if (applySelectedPage(selectedPageId)) {
      setStatus('connected', `Selected Page ${getPageById(selectedPageId)?.name || selectedPageId}.`);
    }
  });
  els.showToken.addEventListener('change', () => {
    els.accessToken.type = els.showToken.checked ? 'text' : 'password';
  });
  [els.oauthBase, els.accessToken, els.videoId, els.pageId, els.pollInterval].forEach((input) => {
    input.addEventListener('change', () => {
      syncStateFromInputs();
      saveConfig();
      saveAuthState();
      if (state.connected) {
        schedulePoll();
      }
    });
  });
  [els.autoConnect, els.liveFilter, els.viewerCount].forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      syncStateFromInputs();
      saveConfig();
      if (state.connected && checkbox === els.viewerCount) {
        state.lastViewerAt = 0;
      }
    });
  });
}

function autoConnectIfReady() {
  if (!state.autoConnect) return;
  if (state.accessToken && (state.videoId || state.pageId)) {
    connect();
  }
}

function init() {
  cacheElements();
  loadConfig();
  loadAuthState();
  updateInputs();
  consumeAuthResultFromHash();
  bindEvents();
  bindAuthMessages();
  initExtension();
  updateStats();
  if (!state.authPages.length && !state.accessToken) {
    setStatus('disconnected', 'Sign in with Facebook to load your Page.');
  } else if (state.authPages.length && !state.connected) {
    const selectedPage = getPageById(state.selectedPageId);
    setStatus('connected', `Facebook Pages loaded. ${selectedPage ? `Selected Page ${selectedPage.name || selectedPage.id}. ` : ''}Resolve or connect when ready.`);
  } else if (!state.connected) {
    setStatus('disconnected', 'Facebook Page token loaded. Resolve or connect when ready.');
  }
  updateActionButtons();
  autoConnectIfReady();
}

init();
})();
