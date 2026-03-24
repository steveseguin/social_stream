'use strict';

const $ = (id) => document.getElementById(id);

// When running inside the SSNApp Electron window there is no Chrome extension
// runtime. Shim the two APIs popup.js uses (sendMessage, tabs.create) so the
// rest of the file works without any Electron-specific branching.
if (typeof require !== 'undefined') {
  const { ipcRenderer, shell } = require('electron');

  if (typeof chrome === 'undefined') window.chrome = {};
  if (!chrome.runtime) chrome.runtime = {};
  if (!chrome.tabs)    chrome.tabs    = {};

  const pending = new Map();
  let seq = 0;

  chrome.runtime.sendMessage = function (msg, cb) {
    if (typeof cb !== 'function') { ipcRenderer.send('fromPopup', msg); return; }
    const id    = ++seq;
    const timer = setTimeout(() => { pending.delete(id); cb(null); }, 3000);
    pending.set(id, { cb, timer });
    ipcRenderer.send('fromPopup', { ...msg, callbackId: id });
  };

  function resolveIpc(data) {
    if (!data || !pending.has(data.callbackId)) return;
    const { cb, timer } = pending.get(data.callbackId);
    clearTimeout(timer);
    pending.delete(data.callbackId);
    cb(data);
  }

  ipcRenderer.on('fromMain',       (_e, data) => resolveIpc(data));
  ipcRenderer.on('fromBackground', (_e, data) => resolveIpc(data));

  chrome.tabs.create = ({ url }) => shell.openExternal(url);
}

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

function overlayUrl(file) {
  return currentSessionId ? 'https://socialstream.ninja/' + file + '?session=' + currentSessionId : '';
}

function applyState(state, streamID) {
  currentSessionId = streamID || '';
  const isOn       = !!state;
  const hasSession = !!currentSessionId;

  $('ext-toggle').checked  = isOn;
  $('ext-toggle').disabled = false;
  $('status-dot').classList.toggle('active', isOn);
  $('status-label').textContent = isOn ? 'Active' : 'Inactive';

  $('session-id').textContent = currentSessionId || '—';
  $('chat-url').textContent   = overlayUrl('sampleoverlay.html') || '—';
  $('alerts-url').textContent = overlayUrl('multi-alerts.html')  || '—';

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

  wireOverlay(() => overlayUrl('sampleoverlay.html'), 'btn-copy-chat',   'chat-copy-feedback',   'btn-open-chat');
  wireOverlay(() => overlayUrl('multi-alerts.html'),  'btn-copy-alerts', 'alerts-copy-feedback', 'btn-open-alerts');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
