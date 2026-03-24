'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function sendToBackground(msg, cb) {
  try {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        // Background page may not be ready yet — caller handles retry
        if (cb) cb(null);
        return;
      }
      if (cb) cb(response || null);
    });
  } catch (e) {
    if (cb) cb(null);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for contexts where the async API is unavailable
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

function flashCopied(feedbackEl) {
  if (!feedbackEl) return;
  feedbackEl.classList.add('visible');
  setTimeout(() => feedbackEl.classList.remove('visible'), 1400);
}

// ── State ─────────────────────────────────────────────────────────────────────

let currentSessionId = '';
let currentState = false;

// ── UI update ─────────────────────────────────────────────────────────────────

function applyState(state, streamID) {
  currentState = !!state;
  currentSessionId = streamID || '';

  const toggle = $('ext-toggle');
  const statusDot = $('status-dot');
  const statusLabel = $('status-label');

  if (toggle) {
    toggle.checked = currentState;
    toggle.disabled = false;
  }

  if (statusDot) {
    statusDot.classList.toggle('active', currentState);
  }

  if (statusLabel) {
    statusLabel.textContent = currentState ? 'Active' : 'Inactive';
  }

  const hasSession = !!currentSessionId;
  const chatURL  = hasSession ? chrome.runtime.getURL('sampleoverlay.html') + '?session=' + currentSessionId : '';
  const alertURL = hasSession ? chrome.runtime.getURL('multi-alerts.html')  + '?session=' + currentSessionId : '';

  const sessionIdEl = $('session-id');
  if (sessionIdEl) sessionIdEl.textContent = currentSessionId || '—';

  const chatUrlEl = $('chat-url');
  if (chatUrlEl) chatUrlEl.textContent = chatURL || '—';

  const alertsUrlEl = $('alerts-url');
  if (alertsUrlEl) alertsUrlEl.textContent = alertURL || '—';

  // Enable/disable buttons based on whether we have a session
  ['btn-copy-session', 'btn-copy-chat', 'btn-open-chat', 'btn-copy-alerts', 'btn-open-alerts'].forEach((id) => {
    const btn = $(id);
    if (btn) btn.disabled = !hasSession;
  });
}

// ── Initialization ────────────────────────────────────────────────────────────

function loadSettings(attempt) {
  sendToBackground({ cmd: 'getSettings' }, (response) => {
    if (response && response.streamID) {
      applyState(response.state, response.streamID);
      return;
    }
    // Background page may not be ready on first install — retry briefly
    if ((attempt || 0) < 5) {
      setTimeout(() => loadSettings((attempt || 0) + 1), 500);
    }
  });
}

function init() {
  loadSettings(0);

  // Enable/disable toggle
  const toggle = $('ext-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      sendToBackground({ cmd: 'setOnOffState', data: { value: toggle.checked } }, (response) => {
        if (response) applyState(response.state, currentSessionId);
      });
    });
  }

  // Copy session ID
  const btnCopySession = $('btn-copy-session');
  if (btnCopySession) {
    btnCopySession.addEventListener('click', () => {
      if (!currentSessionId) return;
      copyToClipboard(currentSessionId).then(() => flashCopied($('session-copy-feedback')));
    });
  }

  // Copy chat overlay URL
  const btnCopyChat = $('btn-copy-chat');
  if (btnCopyChat) {
    btnCopyChat.addEventListener('click', () => {
      const url = $('chat-url').textContent;
      if (!url || url === '—') return;
      copyToClipboard(url).then(() => flashCopied($('chat-copy-feedback')));
    });
  }

  // Open chat overlay
  const btnOpenChat = $('btn-open-chat');
  if (btnOpenChat) {
    btnOpenChat.addEventListener('click', () => {
      const url = $('chat-url').textContent;
      if (!url || url === '—') return;
      chrome.tabs.create({ url });
    });
  }

  // Copy alerts overlay URL
  const btnCopyAlerts = $('btn-copy-alerts');
  if (btnCopyAlerts) {
    btnCopyAlerts.addEventListener('click', () => {
      const url = $('alerts-url').textContent;
      if (!url || url === '—') return;
      copyToClipboard(url).then(() => flashCopied($('alerts-copy-feedback')));
    });
  }

  // Open alerts overlay
  const btnOpenAlerts = $('btn-open-alerts');
  if (btnOpenAlerts) {
    btnOpenAlerts.addEventListener('click', () => {
      const url = $('alerts-url').textContent;
      if (!url || url === '—') return;
      chrome.tabs.create({ url });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
