'use strict';

const $ = (id) => document.getElementById(id);

function sendToBackground(msg, cb) {
  try {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
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
  feedbackEl.classList.add('visible');
  setTimeout(() => feedbackEl.classList.remove('visible'), 1400);
}

let currentSessionId = '';
let currentChatURL   = '';
let currentAlertURL  = '';

function applyState(state, streamID) {
  currentSessionId = streamID || '';
  const isOn       = !!state;
  const hasSession = !!currentSessionId;

  $('ext-toggle').checked  = isOn;
  $('ext-toggle').disabled = false;
  $('status-dot').classList.toggle('active', isOn);
  $('status-label').textContent = isOn ? 'Active' : 'Inactive';

  currentChatURL  = hasSession ? chrome.runtime.getURL('sampleoverlay.html') + '?session=' + currentSessionId : '';
  currentAlertURL = hasSession ? chrome.runtime.getURL('multi-alerts.html')  + '?session=' + currentSessionId : '';

  $('session-id').textContent = currentSessionId || '—';
  $('chat-url').textContent   = currentChatURL   || '—';
  $('alerts-url').textContent = currentAlertURL  || '—';

  ['btn-copy-session', 'btn-copy-chat', 'btn-open-chat', 'btn-copy-alerts', 'btn-open-alerts'].forEach((id) => {
    $(id).disabled = !hasSession;
  });
}

function loadSettings(attempt = 0) {
  sendToBackground({ cmd: 'getSettings' }, (response) => {
    if (response && response.streamID) {
      applyState(response.state, response.streamID);
      return;
    }
    if (attempt < 5) {
      setTimeout(() => loadSettings(attempt + 1), 500);
    } else {
      $('status-label').textContent = 'Unavailable';
    }
  });
}

function wireOverlay(getUrl, copyBtnId, feedbackId, openBtnId) {
  $(copyBtnId).addEventListener('click', () => {
    const url = getUrl();
    if (!url) return;
    copyToClipboard(url).then(() => flashCopied($(feedbackId)));
  });
  $(openBtnId).addEventListener('click', () => {
    const url = getUrl();
    if (!url) return;
    chrome.tabs.create({ url });
  });
}

function init() {
  loadSettings();

  $('ext-toggle').addEventListener('change', () => {
    sendToBackground({ cmd: 'setOnOffState', data: { value: $('ext-toggle').checked } }, (response) => {
      if (response) applyState(response.state, currentSessionId);
    });
  });

  $('btn-copy-session').addEventListener('click', () => {
    if (!currentSessionId) return;
    copyToClipboard(currentSessionId).then(() => flashCopied($('session-copy-feedback')));
  });

  wireOverlay(() => currentChatURL,  'btn-copy-chat',   'chat-copy-feedback',   'btn-open-chat');
  wireOverlay(() => currentAlertURL, 'btn-copy-alerts', 'alerts-copy-feedback', 'btn-open-alerts');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
