const STORAGE_KEY = 'facebookApiConfig';
const API_VERSION = 'v20.0';
const DEFAULT_POLL_INTERVAL = 3000;
const MIN_POLL_INTERVAL = 1500;
const MAX_POLL_INTERVAL = 30000;
const MAX_DEDUPE = 500;
const VIEWER_POLL_INTERVAL = 15000;

const TAB_ID = typeof window !== 'undefined' && typeof window.__SSAPP_TAB_ID__ !== 'undefined'
  ? window.__SSAPP_TAB_ID__
  : null;

const extension = {
  available: typeof chrome !== 'undefined' && !!(chrome && chrome.runtime && chrome.runtime.id),
  settings: {},
  tabId: TAB_ID
};

const state = {
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
  videoTitle: ''
};

const els = {};

function cacheElements() {
  els.accessToken = document.getElementById('access-token');
  els.videoId = document.getElementById('video-id');
  els.pageId = document.getElementById('page-id');
  els.pollInterval = document.getElementById('poll-interval');
  els.autoConnect = document.getElementById('auto-connect');
  els.liveFilter = document.getElementById('live-filter');
  els.viewerCount = document.getElementById('viewer-count');
  els.showToken = document.getElementById('show-token');
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

function updateInputs() {
  els.accessToken.value = state.accessToken;
  els.videoId.value = state.videoId;
  els.pageId.value = state.pageId;
  els.pollInterval.value = state.pollInterval;
  els.autoConnect.checked = state.autoConnect;
  els.liveFilter.checked = state.liveFilter;
  els.viewerCount.checked = state.viewerCount;
}

function syncStateFromInputs() {
  state.accessToken = (els.accessToken.value || '').trim();
  state.videoId = normalizeVideoId(els.videoId.value || '');
  state.pageId = normalizePageId(els.pageId.value || '');
  state.pollInterval = clamp(els.pollInterval.value || DEFAULT_POLL_INTERVAL, MIN_POLL_INTERVAL, MAX_POLL_INTERVAL);
  state.autoConnect = els.autoConnect.checked;
  state.liveFilter = els.liveFilter.checked;
  state.viewerCount = els.viewerCount.checked;
  els.videoId.value = state.videoId;
  els.pageId.value = state.pageId;
  els.pollInterval.value = state.pollInterval;
}

function updateStats() {
  els.messageCount.textContent = String(state.messageCount);
  els.errorCount.textContent = String(state.errorCount);
  els.lastPoll.textContent = formatTime(state.lastPollAt);
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

function applySettings(settings) {
  state.textOnly = Boolean(settings && settings.textonlymode);
  if (!state.pageId && settings && settings.facebook_username && settings.facebook_username.textsetting) {
    state.pageId = normalizePageId(settings.facebook_username.textsetting);
    updateInputs();
  }
  if (state.autoConnect && state.accessToken && state.pageId && !state.connected) {
    connect();
  }
}

function initExtension() {
  if (!extension.available) return;
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request === 'getSource') {
        sendResponse('facebook');
        return;
      }
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
    setStatus('error', 'Access token is required to resolve live video.');
    return;
  }
  if (!state.pageId) {
    setStatus('error', 'Page ID or name is required to resolve live video.');
    return;
  }
  setStatus('connecting', 'Resolving live video...');
  try {
    const data = await graphRequest(`${encodeURIComponent(state.pageId)}/live_videos`, {
      fields: 'id,title,permalink_url,status,creation_time',
      broadcast_status: 'LIVE',
      access_token: state.accessToken
    });
    const entry = Array.isArray(data.data) && data.data.length ? data.data[0] : null;
    if (!entry || !entry.id) {
      setStatus('error', 'No live video found for this page.');
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
  if (!state.viewerCount) return;
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
      setStatus('error', 'Access token is invalid or missing permissions.');
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
    setStatus('error', 'Access token is required.');
    return;
  }
  if (!state.videoId) {
    if (state.pageId) {
      resolveLiveVideo({ connectAfter: true });
      return;
    }
    setStatus('error', 'Live video ID is required.');
    return;
  }
  state.connected = true;
  state.failureCount = 0;
  state.polling = false;
  setStatus('connecting', 'Connecting to Facebook Live...');
  els.connectBtn.disabled = true;
  els.disconnectBtn.disabled = false;
  pollOnce();
}

function disconnect() {
  state.connected = false;
  state.polling = false;
  clearTimeout(state.pollTimer);
  setStatus('disconnected', 'Disconnected.');
  els.connectBtn.disabled = false;
  els.disconnectBtn.disabled = true;
}

function bindEvents() {
  els.connectBtn.addEventListener('click', connect);
  els.disconnectBtn.addEventListener('click', disconnect);
  els.resolveBtn.addEventListener('click', () => resolveLiveVideo({ connectAfter: false }));
  els.showToken.addEventListener('change', () => {
    els.accessToken.type = els.showToken.checked ? 'text' : 'password';
  });
  [els.accessToken, els.videoId, els.pageId, els.pollInterval].forEach((input) => {
    input.addEventListener('change', () => {
      syncStateFromInputs();
      saveConfig();
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
  updateInputs();
  bindEvents();
  initExtension();
  updateStats();
  setStatus('disconnected', 'Waiting for access token and live video ID.');
  autoConnectIfReady();
}

init();
