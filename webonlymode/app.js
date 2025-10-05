import { DockMessenger } from './utils/dockMessenger.js';
import { storage } from './utils/storage.js';
import { randomSessionId, formatTime, safeHtml } from './utils/helpers.js';
import { YoutubePlugin } from './plugins/youtubePlugin.js';
import { TwitchPlugin } from './plugins/twitchPlugin.js';

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
  activityLog: document.getElementById('activity-log'),
  activityClear: document.getElementById('activity-clear'),
  dockFrame: document.getElementById('dock-relay'),
  mobileNavButtons: Array.from(document.querySelectorAll('[data-mobile-nav-target]'))
};

const sessionKey = 'session.currentId';
const activityLimit = 80;
const debugStorageKey = 'debug.enabled';

const url = new URL(window.location.href);
const debugParam = url.searchParams.get('debug');
let debugEnabled = storage.get(debugStorageKey, false);
if (debugParam !== null) {
  const normalized = (debugParam || '').toLowerCase();
  debugEnabled = normalized === '' || (!['0', 'false', 'off', 'no'].includes(normalized));
  storage.set(debugStorageKey, debugEnabled);
}
if (debugEnabled) {
  console.info('Social Stream Lite debug logging enabled. Add ?debug=0 to the URL to disable.');
} else {
  console.info('Social Stream Lite debug logging disabled. Add ?debug=1 to the URL to enable.');
}

const messenger = new DockMessenger(elements.dockFrame, {
  debug: debugEnabled,
  onDebug: debugEnabled ? addActivity : null
});
const activity = [];
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

function sessionUrl(sessionId) {
  const url = new URL('../dock.html', window.location.href);
  url.searchParams.set('session', sessionId);
  return url.toString();
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

  const dockLink = sessionUrl(value);
  if (elements.sessionOpen) {
    elements.sessionOpen.href = dockLink;
    elements.sessionOpen.dataset.sessionId = value;
  }

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
  elements.dockFrame.addEventListener('load', () => {
    if (messenger.getSessionId()) {
      const sessionId = messenger.getSessionId();
      const dockLink = sessionUrl(sessionId);
      setSessionIndicator('connected', 'Relay active');
      updateSessionStatus('');
      if (elements.sessionOpen) {
        elements.sessionOpen.href = dockLink;
      }
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

  plugins = [
    new YoutubePlugin({
      messenger,
      icon: '../sources/images/youtube.png',
      debug: debugEnabled,
      onActivity: addActivity,
      onStatus: ({ plugin, state }) => addActivity({ plugin, message: `Status changed: ${state}`, timestamp: Date.now() }),
      autoConnect: true,
      controls: { connect: false, disconnect: true }
    }),
    new TwitchPlugin({
      messenger,
      icon: '../sources/images/twitch.png',
      debug: debugEnabled,
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
  initMobileNav();
}

init();
