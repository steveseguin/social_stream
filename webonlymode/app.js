import { DockMessenger } from './utils/dockMessenger.js';
import { storage } from './utils/storage.js';
import { randomSessionId, formatTime, safeHtml } from './utils/helpers.js';
import { EmoteManager } from './utils/emoteManager.js';
import { YoutubePlugin } from './plugins/youtubePlugin.js';
import { TwitchPlugin } from './plugins/twitchPlugin.js';
import { TikTokPlugin } from './plugins/tiktokPlugin.js';
import { KickPlugin } from './plugins/kickPlugin.js';

const overlayToggleDefs = [
  { key: 'transparent', id: 'session-opt-transparent', params: ['transparent'] },
  { key: 'noavatar', id: 'session-opt-noavatar', params: ['noavatar'] },
  { key: 'reverse', id: 'session-opt-reverse', params: ['reverse'] }
];

const elements = {
  sessionInput: document.getElementById('session-id'),
  sessionApply: document.getElementById('session-apply'),
  sessionCopy: document.getElementById('session-copy'),
  sessionTest: document.getElementById('session-test'),
  sessionToggle: document.getElementById('session-options-toggle'),
  sessionAdvanced: document.getElementById('session-advanced'),
  sessionIndicator: document.getElementById('session-indicator'),
  sessionOpen: document.getElementById('session-open'),
  sessionStatus: document.getElementById('session-status'),
  sourceList: document.getElementById('source-list'),
  activitySection: document.getElementById('activity'),
  activityLog: document.getElementById('activity-log'),
  activityClear: document.getElementById('activity-clear'),
  activityFullscreen: document.getElementById('activity-fullscreen'),
  activityFilterDonations: document.getElementById('activity-filter-donations'),
  activityToggleTts: document.getElementById('activity-toggle-tts'),
  activityMenuToggle: document.getElementById('activity-menu-toggle'),
  activityMenu: document.getElementById('activity-menu'),
  activityPopout: document.getElementById('activity-popout'),
  dockFrame: document.getElementById('dock-relay'),
  mobileNavButtons: Array.from(document.querySelectorAll('[data-mobile-nav-target]'))
};

const overlayToggleInputs = overlayToggleDefs.reduce((acc, def) => {
  acc[def.key] = document.getElementById(def.id);
  return acc;
}, {});

const sessionKey = 'session.currentId';
const overlayToggleStorageKey = 'session.overlayOptions';
const activityLimit = 80;

const overlayToggleDefaults = overlayToggleDefs.reduce((acc, def) => {
  acc[def.key] = false;
  return acc;
}, {});

let overlayToggleState = { ...overlayToggleDefaults };
const storedOverlayToggleState = storage.get(overlayToggleStorageKey, null);
if (storedOverlayToggleState && typeof storedOverlayToggleState === 'object' && !Array.isArray(storedOverlayToggleState)) {
  overlayToggleState = { ...overlayToggleState, ...storedOverlayToggleState };
}

const url = new URL(window.location.href);
const debugParam = url.searchParams.get('debug');
const debugEnabled = (() => {
  if (debugParam === null) {
    return false;
  }
  const normalized = (debugParam || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return !['0', 'false', 'off', 'no'].includes(normalized);
})();
if (debugEnabled) {
  console.info('Social Stream Lite debug logging enabled. Add ?debug=0 to the URL to disable.');
} else {
  console.info('Social Stream Lite debug logging disabled. Add ?debug=1 to the URL to enable.');
}

const messenger = new DockMessenger(elements.dockFrame, {
  debug: debugEnabled,
  onDebug: debugEnabled ? addActivity : null,
  onMessage: ({ message }) => handleRelayMessage(message)
});
const emotes = new EmoteManager();
let plugins = [];
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const testMessagePresets = [
  () => ({
    type: 'youtube',
    chatname: 'John Doe',
    chatmessage: 'Looking good! 😘😘😊 This is a test message. 🎶🎵🔨',
    chatimg: '',
    chatbadges: []
  }),
  () => ({
    type: 'youtube',
    chatname: 'Bob',
    chatmessage: 'Appreciate the stream! Have a coffee on me ☕',
    chatimg: '',
    hasDonation: '$5.00',
    donationAmount: '$5.00',
    donationCurrency: 'USD'
  }),
  () => ({
    type: 'twitch',
    chatname: 'BobTheBuilder',
    chatmessage: 'Thanks for the stream! Here are some bits ✨',
    chatimg: 'https://static-cdn.jtvnw.net/jtv_user_pictures/52f459a5-7f13-4430-8684-b6b43d1e6bba-profile_image-50x50.png',
    badges: { moderator: '1' },
    chatbadges: ['https://socialstream.ninja/icons/announcement.png'],
    bits: 500,
    isModerator: true
  }),
  () => ({
    type: 'discord',
    chatname: 'Sir Drinks-a-lot',
    chatmessage: '☕☕☕ COFFEE!',
    chatimg: 'https://socialstream.ninja/media/sampleavatar.png',
    membership: 'Coffee Addiction',
    highlightColor: 'pink',
    nameColor: '#9C27B0',
    private: true
  }),
  () => ({
    type: 'youtubeshorts',
    chatname: `Lucy_${Math.floor(Math.random() * 999)}`,
    chatmessage: 'Short and sweet! ✨',
    chatimg: Math.random() > 0.5 ? 'https://socialstream.ninja/media/sampleavatar.png' : ''
  }),
  () => ({
    type: 'facebook',
    chatname: `Steve_${Math.floor(Math.random() * 9000)}`,
    chatmessage: '!join The only way to do great work is to love what you do. ❤️',
    chatimg: 'https://socialstream.ninja/media/sampleavatar.png',
    nameColor: '#107516',
    membership: 'SPONSORSHIP'
  }),
  () => ({
    type: 'zoom',
    chatname: 'Nich Lass',
    question: true,
    chatmessage: 'Is this a test question?  🤓🤓🤓',
    chatimg: 'https://yt4.ggpht.com/ytc/AL5GRJVWK__Edij5fA9Gh-aD7wSBCe_zZOI4jjZ1RQ=s32-c-k-c0x00ffffff-no-rj'
  }),
  () => ({
    type: 'twitch',
    chatname: 'VDO.Ninja',
    chatmessage: '<img src="https://github.com/steveseguin/social_stream/raw/main/icons/icon-128.png" alt="icon"> 😁 🇨🇦 https://vdo.ninja/',
    chatimg: 'https://socialstream.ninja/media/sampleavatar.png',
    vip: true,
    chatbadges: ['https://socialstream.ninja/icons/bot.png', 'https://socialstream.ninja/icons/announcement.png']
  }),
  () => ({
    type: 'youtube',
    chatname: 'ChannelBot',
    chatmessage: '',
    contentimg: 'https://socialstream.ninja/media/logo.png',
    chatimg: 'https://socialstream.ninja/media/user1.jpg'
  })
];

let lastTestMessageSignature = null;

const PLATFORM_ICON_MAP = {
  youtube: '../sources/images/youtube.png',
  youtubeshorts: '../sources/images/youtubeshorts.png',
  twitch: '../sources/images/twitch.png',
  tiktok: '../sources/images/tiktok.png',
  kick: '../sources/images/kick.png',
  discord: '../sources/images/discord.png',
  facebook: '../sources/images/facebook.png',
  zoom: '../sources/images/zoom.png',
  slack: '../sources/images/slack.png',
  default: '../sources/images/default.png'
};

const PLATFORM_LABEL_MAP = {
  youtube: 'YouTube',
  youtubeshorts: 'YouTube Shorts',
  twitch: 'Twitch',
  tiktok: 'TikTok',
  kick: 'Kick',
  discord: 'Discord',
  facebook: 'Facebook',
  zoom: 'Zoom',
  slack: 'Slack'
};

const BADGE_FLAG_LABELS = {
  moderator: 'Moderator',
  mod: 'Moderator',
  vip: 'VIP',
  subscriber: 'Subscriber',
  founder: 'Founder',
  broadcaster: 'Host',
  staff: 'Staff'
};

const activityEntries = [];
const activityById = new Map();

const activityState = {
  filters: {
    donationsOnly: false
  },
  ttsEnabled: false,
  fallbackFullscreen: false,
  lastSpokenId: null
};

const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const donationsFilterKey = 'activity.filter.donationsOnly';
const ttsEnabledKey = 'activity.tts.enabled';

function updateSessionStatus(message, tone = 'info', { html = false } = {}) {
  const target = elements.sessionStatus;
  if (!target) return;
  if (!message) {
    target.hidden = true;
    target.removeAttribute('data-tone');
    target.innerHTML = '';
    return;
  }

  target.hidden = false;
  if (html) {
    target.innerHTML = message;
  } else {
    target.textContent = message;
  }
  target.dataset.tone = tone;
}

function sessionUrl(sessionId, toggleState = overlayToggleState) {
  if (!sessionId) {
    return '#';
  }
  const url = new URL('../dock.html', window.location.href);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('compact', "");
  url.searchParams.set('hidemenu', "");
  url.searchParams.set('hideshadow', "");
  url.searchParams.set('nomemberhighlight', "");
  url.searchParams.set('unhighlight', "");
  url.searchParams.set('nodonohighlight', "");
  url.searchParams.set('notime', "");
  url.searchParams.set('color', "");
  if (toggleState) {
    overlayToggleDefs.forEach(({ key, params }) => {
      if (toggleState[key]) {
        params.forEach((entry) => {
          if (!entry) {
            return;
          }
          const [name, value = ''] = entry.split('=');
          url.searchParams.set(name, value);
        });
      }
    });
  }
  return url.toString();
}

function updateSessionLink(sessionId) {
  if (!elements.sessionOpen) {
    return;
  }
  const effectiveSession = sessionId || messenger.getSessionId() || (elements.sessionInput?.value || '').trim();
  if (!effectiveSession) {
    elements.sessionOpen.href = '#';
    delete elements.sessionOpen.dataset.sessionId;
    return;
  }
  const dockLink = sessionUrl(effectiveSession);
  elements.sessionOpen.href = dockLink;
  elements.sessionOpen.dataset.sessionId = effectiveSession;
}

function handleOverlayToggleChange(key, checked) {
  overlayToggleState = { ...overlayToggleState, [key]: Boolean(checked) };
  storage.set(overlayToggleStorageKey, overlayToggleState);
  updateSessionLink();
}

function initOverlayToggleControls() {
  overlayToggleDefs.forEach(({ key }) => {
    const input = overlayToggleInputs[key];
    if (!input) {
      return;
    }
    input.checked = Boolean(overlayToggleState[key]);
    input.addEventListener('change', (event) => {
      handleOverlayToggleChange(key, event?.target?.checked);
    });
  });
}

function setSessionIndicator(state, label) {
  const indicator = elements.sessionIndicator;
  if (!indicator) return;
  indicator.dataset.state = state || 'idle';
  const sr = indicator.querySelector('.sr-only');
  if (sr) {
    sr.textContent = label || `Session ${state || 'idle'}`;
  }
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

  if (elements.sessionTest) {
    elements.sessionTest.disabled = !value;
  }

  updateSessionLink(value);

  setSessionIndicator('ready', 'Overlay link ready');
  updateSessionStatus('');

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
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => {
        updateSessionStatus(
          `Dock link copied. <a href="${safeLink}" target="_blank" rel="noopener">Open dock overlay</a>.`,
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
  const normalized = normalizeActivityEntry(entry);
  if (!normalized) {
    return;
  }

  if (normalized.id && activityById.has(normalized.id)) {
    const existingIndex = activityEntries.findIndex((item) => item.id === normalized.id);
    if (existingIndex >= 0) {
      activityEntries.splice(existingIndex, 1);
    }
  }

  activityEntries.unshift(normalized);
  if (normalized.id) {
    activityById.set(normalized.id, normalized);
  }

  while (activityEntries.length > activityLimit) {
    const removed = activityEntries.pop();
    if (removed && removed.id) {
      activityById.delete(removed.id);
    }
  }

  renderActivity();

  if (normalized.kind === 'event') {
    maybeSpeak(normalized);
  }
}

function normalizeActivityEntry(entry) {
  if (!entry) {
    return null;
  }

  const timestamp = entry.timestamp || Date.now();
  const kind = entry.kind || inferEntryKind(entry);

  if (kind === 'event') {
    const payload = entry.payload || entry.messageData || entry.detail || entry;
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    if (!debugEnabled && !isDisplayableMessage(payload)) {
      return null;
    }

    const id = entry.id || payload.id || `event-${timestamp}-${Math.floor(Math.random() * 1000)}`;
    const normalizedPayload = { ...payload };
    if (!normalizedPayload.timestamp) {
      normalizedPayload.timestamp = timestamp;
    }

    return {
      id,
      kind: 'event',
      plugin: normalizePlugin(entry.plugin, normalizedPayload.type),
      timestamp,
      payload: normalizedPayload
    };
  }

  const message = entry.message || '';
  const detail = entry.detail;
  const isDebugEntry = kind === 'debug' || (message && message.includes('[debug]'));

  const entryKind = isDebugEntry ? 'debug' : (kind === 'error' ? 'error' : 'status');

  if (!debugEnabled && entryKind === 'debug') {
    return null;
  }
  if (!debugEnabled && entryKind === 'status') {
    return null;
  }

  const id = entry.id || `log-${timestamp}-${Math.floor(Math.random() * 1000)}`;
  return {
    id,
    kind: entryKind,
    plugin: entry.plugin || 'system',
    timestamp,
    message,
    detail
  };
}

function inferEntryKind(entry) {
  if (!entry) {
    return 'status';
  }
  if (entry.kind) {
    return entry.kind;
  }
  if (entry.payload || entry.messageData) {
    return 'event';
  }
  if (entry.message && entry.message.includes('[debug]')) {
    return 'debug';
  }
  return 'status';
}

function normalizePlugin(plugin, type) {
  if (plugin) {
    return plugin;
  }
  if (type) {
    return String(type).toLowerCase();
  }
  return 'system';
}

function shouldDisplayEntry(entry) {
  if (!entry) {
    return false;
  }
  if (entry.kind === 'event') {
    if (activityState.filters.donationsOnly && !eventHasDonation(entry.payload)) {
      return false;
    }
    return true;
  }
  if (entry.kind === 'error') {
    return true;
  }
  return debugEnabled;
}

function renderActivity() {
  if (!elements.activityLog) return;
  elements.activityLog.innerHTML = '';

  const visibleEntries = activityEntries.filter(shouldDisplayEntry);

  if (!visibleEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'activity-empty';
    empty.textContent = 'No activity yet.';
    elements.activityLog.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleEntries.forEach((entry) => {
    if (entry.kind === 'event') {
      fragment.appendChild(buildActivityNode(entry));
    } else {
      fragment.appendChild(buildStatusNode(entry));
    }
  });

  elements.activityLog.appendChild(fragment);
}

function buildActivityNode(entry) {
  const payload = entry.payload || {};
  const platformIcon = getPlatformIcon(payload.type);
  const platformLabel = getPlatformLabel(payload.type);

  const card = document.createElement('article');
  card.className = 'activity-item';
  card.dataset.platform = (payload.type || 'unknown').toLowerCase();
  card.dataset.eventType = (payload.event || 'message').toLowerCase();

  if (payload.highlightColor) {
    card.style.setProperty('--activity-accent', payload.highlightColor);
  }

  const avatar = createAvatarNode(payload, platformIcon);
  card.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'activity-item__body';

  const meta = document.createElement('div');
  meta.className = 'activity-item__meta';

  const iconImg = document.createElement('img');
  iconImg.className = 'activity-item__platform-icon';
  iconImg.src = platformIcon;
  iconImg.alt = `${platformLabel} icon`;
  iconImg.loading = 'lazy';
  iconImg.decoding = 'async';
  meta.appendChild(iconImg);

  const platformSpan = document.createElement('span');
  platformSpan.className = 'activity-item__platform';
  platformSpan.textContent = platformLabel;
  meta.appendChild(platformSpan);

  const timeSpan = document.createElement('time');
  timeSpan.className = 'activity-item__time';
  timeSpan.dateTime = new Date(entry.timestamp).toISOString();
  timeSpan.textContent = formatTime(entry.timestamp);
  meta.appendChild(timeSpan);

  body.appendChild(meta);

  const headline = document.createElement('div');
  headline.className = 'activity-item__headline';

  const name = document.createElement('span');
  name.className = 'activity-item__name';
  name.textContent = payload.chatname || 'Unknown';
  if (payload.nameColor) {
    name.style.color = payload.nameColor;
  }
  headline.appendChild(name);

  const badgeContainer = renderBadgeElements(payload);
  if (badgeContainer) {
    headline.appendChild(badgeContainer);
  }

  body.appendChild(headline);

  if (payload.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'activity-item__subtitle';
    subtitle.textContent = payload.subtitle;
    body.appendChild(subtitle);
  }

  const chips = buildChipRow(payload);
  if (chips) {
    body.appendChild(chips);
  }

  if (payload.chatmessage) {
    const messageEl = document.createElement('div');
    messageEl.className = 'activity-item__message';
    if (payload.textColor) {
      messageEl.style.color = payload.textColor;
    }
    if (payload.backgroundColor) {
      messageEl.style.background = payload.backgroundColor;
    }
    messageEl.innerHTML = payload.chatmessage;
    body.appendChild(messageEl);
  }

  if (payload.contentimg) {
    const media = document.createElement('img');
    media.className = 'activity-item__media';
    media.src = payload.contentimg;
    media.alt = payload.chatname ? `${payload.chatname} shared content` : 'Shared content';
    media.loading = 'lazy';
    media.decoding = 'async';
    body.appendChild(media);
  }

  card.appendChild(body);
  return card;
}

function buildStatusNode(entry) {
  const row = document.createElement('div');
  const classes = ['activity-status'];
  if (entry.kind === 'error') {
    classes.push('activity-status--error');
    row.setAttribute('role', 'alert');
  } else if (entry.kind === 'debug') {
    classes.push('activity-status--debug');
  }
  row.className = classes.join(' ');

  const meta = document.createElement('div');
  meta.className = 'activity-status__meta';
  meta.textContent = `${formatTime(entry.timestamp)} · ${entry.plugin || 'system'}`;
  row.appendChild(meta);

  const message = document.createElement('div');
  message.className = 'activity-status__message';
  message.textContent = entry.message || '';
  row.appendChild(message);

  if (entry.detail !== undefined) {
    const detail = document.createElement('pre');
    detail.className = 'activity-status__detail';
    detail.textContent = typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail, null, 2);
    row.appendChild(detail);
  }

  return row;
}

function createAvatarNode(payload, fallbackIcon) {
  const wrapper = document.createElement('div');
  wrapper.className = 'activity-item__avatar';

  if (payload.chatimg) {
    const img = document.createElement('img');
    img.src = payload.chatimg;
    img.alt = payload.chatname ? `${payload.chatname} avatar` : 'Avatar';
    img.loading = 'lazy';
    img.decoding = 'async';
    wrapper.appendChild(img);
    return wrapper;
  }

  const name = (payload.chatname || '').trim();
  if (name) {
    const initial = document.createElement('span');
    initial.className = 'activity-item__avatar-initial';
    initial.textContent = name[0].toUpperCase();
    wrapper.appendChild(initial);
    return wrapper;
  }

  const icon = document.createElement('img');
  icon.src = fallbackIcon;
  icon.alt = 'Platform';
  icon.loading = 'lazy';
  icon.decoding = 'async';
  wrapper.classList.add('activity-item__avatar--fallback');
  wrapper.appendChild(icon);
  return wrapper;
}

function renderBadgeElements(payload) {
  const nodes = [];

  if (Array.isArray(payload.chatbadges)) {
    payload.chatbadges.forEach((badge) => {
      const node = createBadgeNode(badge);
      if (node) {
        nodes.push(node);
      }
    });
  }

  const flags = [];
  if (payload.badges && typeof payload.badges === 'object') {
    Object.keys(payload.badges).forEach((flag) => flags.push(flag));
  }
  if (payload.vip) {
    flags.push('vip');
  }

  const uniqueFlags = Array.from(new Set(flags));
  uniqueFlags.forEach((flag) => {
    const label = BADGE_FLAG_LABELS[flag];
    if (label) {
      const flagChip = document.createElement('span');
      flagChip.className = 'activity-item__badge-flag';
      flagChip.textContent = label;
      nodes.push(flagChip);
    }
  });

  if (!nodes.length) {
    return null;
  }

  const container = document.createElement('div');
  container.className = 'activity-item__badges';
  nodes.forEach((node) => container.appendChild(node));
  return container;
}

function createBadgeNode(badge) {
  if (!badge) {
    return null;
  }

  if (typeof badge === 'string') {
    const img = document.createElement('img');
    img.className = 'activity-item__badge';
    img.src = badge;
    img.alt = 'Badge';
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  }

  if (typeof badge === 'object') {
    if (badge.url || badge.image) {
      const img = document.createElement('img');
      img.className = 'activity-item__badge';
      img.src = badge.url || badge.image;
      img.alt = badge.alt || 'Badge';
      img.loading = 'lazy';
      img.decoding = 'async';
      return img;
    }
    if (badge.type === 'svg' && badge.html) {
      const span = document.createElement('span');
      span.className = 'activity-item__badge activity-item__badge--svg';
      span.innerHTML = badge.html;
      return span;
    }
  }

  return null;
}

function buildChipRow(payload) {
  const chips = [];

  if (payload.hasDonation) {
    chips.push({ className: 'activity-chip activity-chip--donation', label: payload.hasDonation });
  } else if (payload.donationAmount) {
    const amount = payload.donationCurrency ? `${payload.donationAmount} ${payload.donationCurrency}` : payload.donationAmount;
    chips.push({ className: 'activity-chip activity-chip--donation', label: amount });
  }

  if (payload.bits) {
    chips.push({ className: 'activity-chip activity-chip--bits', label: `${payload.bits} bits` });
  }

  if (payload.membership) {
    chips.push({ className: 'activity-chip activity-chip--membership', label: payload.membership });
  }

  const eventLabel = formatEventLabel(payload.event);
  if (eventLabel && eventLabel !== 'Message' && !chips.some((chip) => chip.label === eventLabel)) {
    chips.push({ className: 'activity-chip activity-chip--event', label: eventLabel });
  }

  if (payload.question) {
    chips.push({ className: 'activity-chip activity-chip--flag', label: 'Question' });
  }

  if (payload.private) {
    chips.push({ className: 'activity-chip activity-chip--flag', label: 'Private' });
  }

  if (payload.vip && !chips.some((chip) => chip.label === 'VIP')) {
    chips.push({ className: 'activity-chip activity-chip--flag', label: 'VIP' });
  }

  if (payload.badges && typeof payload.badges === 'object') {
    Object.keys(payload.badges).forEach((flag) => {
      const label = BADGE_FLAG_LABELS[flag];
      if (label && !chips.some((chip) => chip.label === label)) {
        chips.push({ className: 'activity-chip activity-chip--flag', label });
      }
    });
  }

  if (!chips.length) {
    return null;
  }

  const container = document.createElement('div');
  container.className = 'activity-item__chips';
  chips.forEach(({ className, label }) => {
    const span = document.createElement('span');
    span.className = className || 'activity-chip';
    span.textContent = label;
    container.appendChild(span);
  });
  return container;
}

function eventHasDonation(payload) {
  if (!payload) {
    return false;
  }
  if (payload.hasDonation && String(payload.hasDonation).trim()) {
    return true;
  }
  if (payload.donationAmount && String(payload.donationAmount).trim()) {
    return true;
  }
  if (payload.donationCurrency && String(payload.donationCurrency).trim()) {
    return true;
  }
  const bits = Number(payload.bits || 0);
  if (!Number.isNaN(bits) && bits > 0) {
    return true;
  }
  if (payload.membership && String(payload.membership).trim()) {
    return true;
  }
  return false;
}

function isDisplayableMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  return Boolean(
    (payload.chatname && payload.chatname.toString().trim()) ||
    (payload.chatmessage && payload.chatmessage.toString().trim()) ||
    (payload.contentimg && payload.contentimg.toString().trim()) ||
    eventHasDonation(payload) ||
    (payload.subtitle && payload.subtitle.toString().trim()) ||
    (payload.question === true) ||
    (payload.vip === true)
  );
}

function formatEventLabel(value) {
  if (!value) {
    return '';
  }
  const normalized = String(value).toLowerCase();
  const map = {
    donation: 'Donation',
    bits: 'Cheer',
    cheer: 'Cheer',
    raid: 'Raid',
    host: 'Host',
    follow: 'Follow',
    subscription: 'Subscription',
    resubscription: 'Resub',
    gifted: 'Gift',
    gift: 'Gift',
    like: 'Like',
    join: 'Join',
    test: 'Test',
    message: 'Message'
  };
  if (map[normalized]) {
    return map[normalized];
  }
  return normalized.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPlatformIcon(type) {
  const key = String(type || '').toLowerCase();
  return PLATFORM_ICON_MAP[key] || PLATFORM_ICON_MAP.default;
}

function getPlatformLabel(type) {
  const key = String(type || '').toLowerCase();
  if (PLATFORM_LABEL_MAP[key]) {
    return PLATFORM_LABEL_MAP[key];
  }
  if (!key) {
    return 'Unknown';
  }
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function toPlainText(value) {
  if (!value) {
    return '';
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  return div.textContent || div.innerText || '';
}

function maybeSpeak(entry) {
  if (!activityState.ttsEnabled || !speechSupported) {
    return;
  }
  if (!entry || entry.kind !== 'event') {
    return;
  }
  if (activityState.lastSpokenId === entry.id) {
    return;
  }

  const text = buildSpeechText(entry.payload);
  if (!text) {
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    activityState.lastSpokenId = entry.id;
  } catch (err) {
    console.warn('Speech synthesis failed', err);
  }
}

function buildSpeechText(payload) {
  if (!payload) {
    return '';
  }
  const name = payload.chatname || 'Someone';
  if (payload.hasDonation) {
    return `${name} sent a donation: ${payload.hasDonation}.`;
  }
  if (payload.donationAmount) {
    const amount = payload.donationCurrency ? `${payload.donationAmount} ${payload.donationCurrency}` : payload.donationAmount;
    return `${name} sent a donation of ${amount}.`;
  }
  const bits = Number(payload.bits || 0);
  if (!Number.isNaN(bits) && bits > 0) {
    return `${name} cheered ${bits} bits.`;
  }
  if (payload.membership) {
    return `${name} membership: ${payload.membership}.`;
  }
  if (payload.chatmessage) {
    const message = toPlainText(payload.chatmessage).trim();
    if (message) {
      return `${name} said: ${message}`;
    }
  }
  if (payload.contentimg) {
    return `${name} shared an image.`;
  }
  const eventLabel = formatEventLabel(payload.event);
  if (eventLabel && eventLabel !== 'Message') {
    return `${name} triggered ${eventLabel}.`;
  }
  return '';
}

function clearActivity() {
  activityEntries.length = 0;
  activityById.clear();
  activityState.lastSpokenId = null;
  if (speechSupported) {
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn('Failed to cancel speech synthesis', err);
    }
  }
  renderActivity();
}

function setDonationsOnly(enabled, { persist = true } = {}) {
  activityState.filters.donationsOnly = Boolean(enabled);
  if (persist) {
    storage.set(donationsFilterKey, activityState.filters.donationsOnly);
  }
  if (elements.activityFilterDonations) {
    elements.activityFilterDonations.checked = activityState.filters.donationsOnly;
  }
  renderActivity();
}

function setTtsEnabled(enabled, { persist = true } = {}) {
  const intended = Boolean(enabled);
  if (!speechSupported) {
    activityState.ttsEnabled = false;
    if (elements.activityToggleTts) {
      elements.activityToggleTts.checked = false;
      elements.activityToggleTts.disabled = true;
    }
    if (persist) {
      storage.set(ttsEnabledKey, false);
    }
    return;
  }

  activityState.ttsEnabled = intended;
  if (!activityState.ttsEnabled) {
    activityState.lastSpokenId = null;
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn('Speech synthesis cancel failed', err);
    }
  }
  if (elements.activityToggleTts) {
    elements.activityToggleTts.checked = activityState.ttsEnabled;
  }
  if (persist) {
    storage.set(ttsEnabledKey, activityState.ttsEnabled);
  }
}

function toggleActivityMenu(forceState) {
  if (!elements.activityMenuToggle || !elements.activityMenu) {
    return;
  }
  const expanded = elements.activityMenuToggle.getAttribute('aria-expanded') === 'true';
  const next = typeof forceState === 'boolean' ? forceState : !expanded;
  elements.activityMenuToggle.setAttribute('aria-expanded', String(next));
  elements.activityMenu.hidden = !next;

  if (next) {
    document.addEventListener('mousedown', handleGlobalMenuClose, { capture: true });
    document.addEventListener('keydown', handleMenuKeydown);
    const firstItem = elements.activityMenu.querySelector('[role="menuitem"]');
    const focusTarget = firstItem || elements.activityMenu;
    focusTarget?.focus({ preventScroll: true });
  } else {
    document.removeEventListener('mousedown', handleGlobalMenuClose, { capture: true });
    document.removeEventListener('keydown', handleMenuKeydown);
  }
}

function handleGlobalMenuClose(event) {
  if (!elements.activityMenu || !elements.activityMenuToggle) {
    return;
  }
  if (elements.activityMenu.contains(event.target) || elements.activityMenuToggle.contains(event.target)) {
    return;
  }
  toggleActivityMenu(false);
}

function handleMenuKeydown(event) {
  if (event.key === 'Escape' && elements.activityMenuToggle?.getAttribute('aria-expanded') === 'true') {
    event.preventDefault();
    toggleActivityMenu(false);
    elements.activityMenuToggle?.focus({ preventScroll: true });
  }
}

function isFullscreenActive() {
  if (document.fullscreenElement) {
    return document.fullscreenElement === elements.activitySection;
  }
  return Boolean(activityState.fallbackFullscreen);
}

function updateFullscreenControl() {
  const target = elements.activityFullscreen;
  if (!target) {
    return;
  }
  const active = isFullscreenActive();
  target.setAttribute('aria-pressed', String(active));
  target.dataset.state = active ? 'exit' : 'enter';
  target.textContent = active ? 'Exit full screen' : 'Full screen';
}

async function toggleActivityFullscreen() {
  const section = elements.activitySection;
  if (!section) {
    return;
  }

  if (document.fullscreenElement === section) {
    try {
      await document.exitFullscreen();
    } catch (err) {
      console.warn('Exit fullscreen failed', err);
    }
    return;
  }

  if (!document.fullscreenElement && section.requestFullscreen) {
    try {
      await section.requestFullscreen({ navigationUI: 'hide' });
      return;
    } catch (err) {
      console.warn('Fullscreen request failed', err);
    }
  }

  activityState.fallbackFullscreen = !activityState.fallbackFullscreen;
  section.classList.toggle('activity--expanded', activityState.fallbackFullscreen);
  document.body.classList.toggle('activity-fallback-fullscreen', activityState.fallbackFullscreen);
  updateFullscreenControl();
}

function handleFullscreenChange() {
  if (!elements.activitySection) {
    return;
  }

  if (document.fullscreenElement === elements.activitySection) {
    activityState.fallbackFullscreen = false;
    document.body.classList.remove('activity-fallback-fullscreen');
    elements.activitySection.classList.add('activity--expanded');
  } else if (!document.fullscreenElement) {
    activityState.fallbackFullscreen = false;
    document.body.classList.remove('activity-fallback-fullscreen');
    elements.activitySection.classList.remove('activity--expanded');
  }
  updateFullscreenControl();
}

function openActivityPopout() {
  try {
    const popupUrl = new URL(window.location.href);
    popupUrl.searchParams.set('focus', 'activity');
    window.open(popupUrl.toString(), '_blank', 'width=480,height=720,resizable=yes,scrollbars=yes');
  } catch (err) {
    console.warn('Unable to open activity pop-out', err);
  }
  toggleActivityMenu(false);
}

function pickRandom(list) {
  if (!Array.isArray(list) || !list.length) {
    return null;
  }
  return list[Math.floor(Math.random() * list.length)];
}

function createTestMessage() {
  const now = Date.now();
  let attempts = 0;
  let candidate = null;
  do {
    const presetFactory = pickRandom(testMessagePresets);
    candidate = typeof presetFactory === 'function' ? presetFactory() : null;
    attempts += 1;
  } while (
    attempts < 4 &&
    candidate &&
    lastTestMessageSignature === `${candidate.type || candidate.platform || 'twitch'}|${candidate.chatname}|${candidate.chatmessage || candidate.contentimg || ''}`
  );

  if (!candidate) {
    candidate = {
      type: 'twitch',
      chatname: 'Test User',
      chatmessage: 'Hello from Social Stream test message!',
      event: 'message'
    };
  }
  const type = candidate.type || candidate.platform || 'twitch';
  lastTestMessageSignature = `${type}|${candidate.chatname}|${candidate.chatmessage || candidate.contentimg || ''}`;

  const bits = candidate.bits ? Number(candidate.bits) : 0;
  const donationText =
    typeof candidate.hasDonation === 'string'
      ? candidate.hasDonation
      : candidate.hasDonation
        ? candidate.donationAmount || ''
        : '';
  const event = candidate.event || (bits ? 'bits' : donationText ? 'donation' : 'message');

  const message = {
    id: `test-${now}-${Math.floor(Math.random() * 1000)}`,
    type,
    chatname: candidate.chatname || 'Test User',
    chatmessage: candidate.chatmessage || '',
    chatimg: candidate.chatimg || '',
    timestamp: now,
    event,
    textonly: Boolean(candidate.textonly),
    raw: { test: true }
  };

  if (bits) {
    message.bits = bits;
  }
  if (donationText) {
    message.hasDonation = donationText;
  }
  if (candidate.donationAmount) {
    message.donationAmount = candidate.donationAmount;
  }
  if (candidate.donationCurrency) {
    message.donationCurrency = candidate.donationCurrency;
  }
  if (candidate.membership) {
    message.membership = candidate.membership;
  }
  if (candidate.badges && typeof candidate.badges === 'object') {
    message.badges = candidate.badges;
  }
  if (Array.isArray(candidate.chatbadges) && candidate.chatbadges.length) {
    message.chatbadges = candidate.chatbadges;
  }
  if (candidate.nameColor) {
    message.nameColor = candidate.nameColor;
  }
  if (candidate.backgroundColor) {
    message.backgroundColor = candidate.backgroundColor;
  }
  if (candidate.highlightColor) {
    message.highlightColor = candidate.highlightColor;
  }
  if (candidate.subtitle) {
    message.subtitle = candidate.subtitle;
  }
  if (candidate.contentimg) {
    message.contentimg = candidate.contentimg;
  }
  if (candidate.private) {
    message.private = true;
  }
  if (candidate.question) {
    message.question = true;
  }
  if (candidate.vip) {
    message.vip = true;
  }
  if (candidate.isModerator) {
    message.isModerator = true;
  }

  return message;
}

function collectRelayPayloads(input) {
  if (input === null || input === undefined) {
    return [];
  }
  if (Array.isArray(input)) {
    const merged = [];
    input.forEach((item) => {
      const results = collectRelayPayloads(item);
      if (results && results.length) {
        merged.push(...results);
      }
    });
    return merged;
  }
  if (typeof input !== 'object') {
    return [];
  }

  if ('overlayNinja' in input) {
    return collectRelayPayloads(input.overlayNinja);
  }
  if ('dataReceived' in input) {
    return collectRelayPayloads(input.dataReceived);
  }
  if ('contents' in input) {
    return collectRelayPayloads(input.contents);
  }
  if ('detail' in input) {
    const detailPayloads = collectRelayPayloads(input.detail);
    if (detailPayloads.length) {
      return detailPayloads;
    }
  }

  return [input];
}

function handleRelayMessage(message) {
  const payloads = collectRelayPayloads(message);
  if (!payloads.length) {
    return;
  }

  payloads.forEach((payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    addActivity({
      kind: 'event',
      plugin: payload.type || payload.platform || 'system',
      payload,
      timestamp: payload.timestamp || Date.now(),
      id: payload.id
    });
  });
}

function handleSendTestMessage() {
  if (!messenger.getSessionId()) {
    updateSessionStatus('Start a session before sending a test message.', 'warn');
    return;
  }

  const message = createTestMessage();
  messenger.send(message);

  addActivity({
    plugin: 'system',
    message: `Sent test message (${message.type || 'test'})`,
    detail: message,
    timestamp: Date.now()
  });

  updateSessionStatus('Test message sent to dock overlay.', 'success');
}

function notifyPluginsOfSession(sessionId) {
  plugins.forEach((plugin) => {
    if (typeof plugin.handleSessionStarted === 'function') {
      plugin.handleSessionStarted(sessionId);
    }
  });
}

function initMobileNav() {
  const buttons = elements.mobileNavButtons || [];
  if (!buttons.length) return;

  const sections = new Map();
  let activeId = null;

  const setActive = (id) => {
    if (!id || activeId === id) return;
    activeId = id;
    buttons.forEach((button) => {
      const match = button.dataset.mobileNavTarget === id;
      button.classList.toggle('is-active', match);
      button.setAttribute('aria-pressed', String(match));
      if (match) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  };

  buttons.forEach((button) => {
    const targetId = button.dataset.mobileNavTarget;
    if (!targetId) return;
    const section = document.getElementById(targetId);
    if (!section) return;
    sections.set(targetId, section);

    button.addEventListener('click', () => {
      setActive(targetId);
      section.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  });

  if (!sections.size) return;

  const defaultTarget = buttons.find((button) => sections.has(button.dataset.mobileNavTarget));
  if (defaultTarget) {
    setActive(defaultTarget.dataset.mobileNavTarget);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.id) {
          setActive(entry.target.id);
        }
      });
    }, {
      rootMargin: '-20% 0px -55% 0px',
      threshold: 0.25
    });

    sections.forEach((section) => observer.observe(section));
  }
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
  setSessionIndicator('idle', 'Session idle');
  initOverlayToggleControls();
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  elements.dockFrame.addEventListener('load', () => {
    if (messenger.getSessionId()) {
      const sessionId = messenger.getSessionId();
      setSessionIndicator('connected', 'Relay active');
      updateSessionStatus('');
      updateSessionLink(sessionId);
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
  elements.sessionTest?.addEventListener('click', () => handleSendTestMessage());
  elements.activityClear.addEventListener('click', clearActivity);
  elements.activityFilterDonations?.addEventListener('change', (event) => {
    const target = event.target;
    setDonationsOnly(Boolean(target && target.checked));
  });
  elements.activityToggleTts?.addEventListener('change', (event) => {
    const target = event.target;
    setTtsEnabled(Boolean(target && target.checked));
  });
  elements.activityFullscreen?.addEventListener('click', () => toggleActivityFullscreen());
  elements.activityMenuToggle?.addEventListener('click', () => toggleActivityMenu());
  elements.activityPopout?.addEventListener('click', openActivityPopout);

  if (elements.sessionToggle && elements.sessionAdvanced) {
    elements.sessionToggle.addEventListener('click', () => {
      const expanded = elements.sessionToggle.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      elements.sessionToggle.setAttribute('aria-expanded', String(next));
      elements.sessionAdvanced.hidden = !next;
      if (next && elements.sessionInput) {
        window.requestAnimationFrame(() => {
          elements.sessionInput.focus();
          elements.sessionInput.select();
        });
      }
    });
  }

  const storedSession = storage.get(sessionKey, '');
  if (storedSession) {
    elements.sessionInput.value = storedSession;
  }

  if (elements.sessionTest) {
    elements.sessionTest.disabled = !storedSession;
  }

  const storedDonationsOnly = storage.get(donationsFilterKey, false);
  setDonationsOnly(Boolean(storedDonationsOnly), { persist: false });

  const storedTtsEnabled = storage.get(ttsEnabledKey, false);
  setTtsEnabled(Boolean(storedTtsEnabled), { persist: false });
  if (!speechSupported && elements.activityToggleTts) {
    elements.activityToggleTts.title = 'Text-to-speech is not supported in this browser.';
  }

  updateFullscreenControl();

  plugins = [
    new YoutubePlugin({
      messenger,
      emotes,
      icon: '../sources/images/youtube.png',
      debug: debugEnabled,
      onActivity: addActivity,
      onStatus: ({ plugin, state }) => addActivity({ kind: 'debug', plugin, message: `Status changed: ${state}`, timestamp: Date.now() }),
      autoConnect: true,
      controls: { connect: false, disconnect: true }
    }),
    new TwitchPlugin({
      messenger,
      emotes,
      icon: '../sources/images/twitch.png',
      debug: debugEnabled,
      onActivity: addActivity,
      onStatus: ({ kind = 'debug', plugin, state }) => addActivity({ kind, plugin, message: `Status changed: ${state}`, timestamp: Date.now() }),
      autoConnect: true,
      controls: { connect: false, disconnect: true }
    }),
    new KickPlugin({
      messenger,
      emotes,
      icon: '../sources/images/kick.png',
      debug: debugEnabled,
      onActivity: addActivity,
      onStatus: ({ plugin, state }) => addActivity({ kind: 'debug', plugin, message: `Status changed: ${state}`, timestamp: Date.now() })
    }),
    new TikTokPlugin({
      messenger,
      icon: '../sources/images/tiktok.png',
      debug: debugEnabled,
      onActivity: addActivity,
      onStatus: ({ plugin, state }) => addActivity({ kind: 'debug', plugin, message: `Status changed: ${state}`, timestamp: Date.now() })
    })
  ];

  const pluginMap = new Map();
  plugins.forEach((plugin) => {
    pluginMap.set(plugin.id, plugin);
    plugin.mount(elements.sourceList);
  });

  startSession(storedSession);
  processOAuthCallback(pluginMap);
  initMobileNav();

  if (url.searchParams.get('focus') === 'activity' && elements.activitySection) {
    window.setTimeout(() => {
      elements.activitySection.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    }, 150);
  }
}

init();
