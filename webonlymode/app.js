import { DockMessenger } from './utils/dockMessenger.js';
import { storage } from './utils/storage.js';
import { randomSessionId, formatTime, safeHtml } from './utils/helpers.js';
import { YoutubePlugin } from './plugins/youtubePlugin.js';
import { TwitchPlugin } from './plugins/twitchPlugin.js';

const elements = {
  sessionInput: document.getElementById('session-id'),
  sessionApply: document.getElementById('session-apply'),
  sessionCopy: document.getElementById('session-copy'),
  sessionStatus: document.getElementById('session-status'),
  sourceList: document.getElementById('source-list'),
  activityLog: document.getElementById('activity-log'),
  activityClear: document.getElementById('activity-clear'),
  dockFrame: document.getElementById('dock-relay')
};

const sessionKey = 'session.currentId';
const activityLimit = 80;

const messenger = new DockMessenger(elements.dockFrame);
const activity = [];
let plugins = [];

function updateSessionStatus(message, tone = 'info', { html = false } = {}) {
  if (!elements.sessionStatus) return;
  if (html) {
    elements.sessionStatus.innerHTML = message;
  } else {
    elements.sessionStatus.textContent = message;
  }
  elements.sessionStatus.dataset.tone = tone;
}

function sessionUrl(sessionId) {
  const url = new URL('../dock.html', window.location.href);
  url.searchParams.set('session', sessionId);
  return url.toString();
}

function startSession(sessionId) {
  let value = (sessionId || elements.sessionInput.value || '').trim();
  if (!value) {
    value = randomSessionId();
    if (elements.sessionInput) {
      elements.sessionInput.value = value;
    }
  }

  const previous = messenger.getSessionId();

  storage.set(sessionKey, value);
  messenger.setSessionId(value);

  const dockLink = sessionUrl(value);
  const safeLink = safeHtml(dockLink);
  updateSessionStatus(
    `Active session: <strong>${safeHtml(value)}</strong> | <a href="${safeLink}" target="_blank" rel="noopener">Open dock</a> (relay loading... keep this page open)`,
    'info',
    { html: true }
  );

  const sessionChanged = !previous || previous !== value;

  if (sessionChanged) {
    addActivity({
      plugin: 'system',
      message: `Session set to ${safeHtml(value)}`,
      timestamp: Date.now()
    });
  }

  if (sessionChanged) {
    notifyPluginsOfSession(value);
  }
}

function handleCopyLink() {
  const sessionId = messenger.getSessionId() || (elements.sessionInput.value || '').trim();
  if (!sessionId) {
    updateSessionStatus('Start a session before copying the dock link.', 'warn');
    return;
  }
  const url = sessionUrl(sessionId);
  const safeLink = safeHtml(url);
  const safeId = safeHtml(sessionId);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => {
        updateSessionStatus(
          `Dock link copied to clipboard. <a href="${safeLink}" target="_blank" rel="noopener">Open dock</a> (session ${safeId}).`,
          'success',
          { html: true }
        );
      })
      .catch(() => {
        updateSessionStatus(
          `Clipboard copy failed. Use this link instead: <a href="${safeLink}" target="_blank" rel="noopener">${safeLink}</a>`,
          'warn',
          { html: true }
        );
      });
  } else {
    updateSessionStatus(
      `Copy this link manually: <a href="${safeLink}" target="_blank" rel="noopener">${safeLink}</a>`,
      'info',
      { html: true }
    );
  }
}

function addActivity(entry) {
  if (!entry) return;
  activity.unshift(entry);
  if (activity.length > activityLimit) {
    activity.length = activityLimit;
  }
  renderActivity();
}

function renderActivity() {
  if (!elements.activityLog) return;
  elements.activityLog.innerHTML = '';
  activity.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'activity-entry';

    const meta = document.createElement('div');
    meta.className = 'activity-entry__meta';
    meta.textContent = `${formatTime(item.timestamp)} - ${item.plugin || 'system'}`;

    const message = document.createElement('p');
    message.className = 'activity-entry__message';
    message.innerHTML = safeHtml(item.message || '');

    row.append(meta, message);

    if (item.detail) {
      const detail = document.createElement('pre');
      detail.className = 'activity-entry__detail';
      detail.textContent = typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail, null, 2);
      row.appendChild(detail);
    }

    elements.activityLog.appendChild(row);
  });
}

function clearActivity() {
  activity.length = 0;
  renderActivity();
}

function notifyPluginsOfSession(sessionId) {
  plugins.forEach((plugin) => {
    if (typeof plugin.handleSessionStarted === 'function') {
      plugin.handleSessionStarted(sessionId);
    }
  });
}

function processOAuthCallback(pluginMap) {
  if (!window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has('access_token')) return;

  const state = params.get('state') || '';
  const provider = state.split(':')[0];
  const plugin = pluginMap.get(provider);

  if (!plugin) {
    updateSessionStatus('Received OAuth response for unknown provider.', 'warn');
    return;
  }

  try {
    plugin.handleOAuthCallback(params);
    addActivity({
      plugin: provider,
      message: 'OAuth authorization completed.',
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('OAuth handling failed', err);
    updateSessionStatus(err.message || 'OAuth handling failed.', 'warn');
  } finally {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function init() {
  elements.dockFrame.addEventListener('load', () => {
    if (messenger.getSessionId()) {
      const sessionId = messenger.getSessionId();
      const dockLink = sessionUrl(sessionId);
      const safeLink = safeHtml(dockLink);
      updateSessionStatus(
        `Active session: <strong>${safeHtml(sessionId)}</strong> | <a href="${safeLink}" target="_blank" rel="noopener">Open dock</a> (relay ready - keep this page open)`,
        'success',
        { html: true }
      );
    }
  });

  elements.sessionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startSession();
    }
  });

  elements.sessionInput.addEventListener('change', () => startSession());
  elements.sessionApply.addEventListener('click', () => startSession());
  elements.sessionCopy.addEventListener('click', () => handleCopyLink());
  elements.activityClear.addEventListener('click', clearActivity);

  const storedSession = storage.get(sessionKey, '');
  if (storedSession) {
    elements.sessionInput.value = storedSession;
  }

  plugins = [
    new YoutubePlugin({
      messenger,
      onActivity: addActivity,
      onStatus: ({ plugin, state }) => addActivity({ plugin, message: `Status changed: ${state}`, timestamp: Date.now() }),
      autoConnect: true,
      controls: { connect: false, disconnect: true }
    }),
    new TwitchPlugin({
      messenger,
      onActivity: addActivity,
      onStatus: ({ plugin, state }) => addActivity({ plugin, message: `Status changed: ${state}`, timestamp: Date.now() }),
      autoConnect: true,
      controls: { connect: false, disconnect: true }
    })
  ];

  const pluginMap = new Map();
  plugins.forEach((plugin) => {
    pluginMap.set(plugin.id, plugin);
    plugin.mount(elements.sourceList);
  });

  startSession(storedSession);
  processOAuthCallback(pluginMap);
}

init();
