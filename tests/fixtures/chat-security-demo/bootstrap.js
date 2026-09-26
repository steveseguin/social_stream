(function () {
  'use strict';
  var role = document.currentScript.getAttribute('data-role');
  var params = new URLSearchParams(location.search);
  var run = params.get('run');
  var origin = location.origin;
  window.__probeHits = 0;
  var errors = [];
  var spoken = [];
  var parses = [];
  function send(kind, detail) {
    parent.postMessage({ chatSecurityDemo: true, run: run, role: role, kind: kind, detail: detail }, origin);
  }
  function accepted(event) { return event.source === parent && event.origin === origin && event.data && event.data.chatSecurityDemo && event.data.run === run; }
  function fail(error) { send('error', String(error && error.message || error)); }
  function waitFor(check, timeout) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function () {
        try {
          var value = check();
          if (value) { clearInterval(timer); resolve(value); }
          else if (Date.now() - start > timeout) { clearInterval(timer); reject(Error(role + ' did not become ready')); }
        } catch (error) { clearInterval(timer); reject(error); }
      }, 40);
    });
  }
  if (role === 'bridge') {
    window.addEventListener('message', function (event) {
      if (event.source === parent && event.origin === origin && event.data.demoBridge) {
        parent.postMessage({ dataReceived: { overlayNinja: event.data.payload } }, origin);
      }
    });
    return;
  }

  // Offline transports. External script/fetch/frame requests are also blocked by
  // the server's CSP. No real session, Twitch connection, or OBS exploit is used.
  function OfflineSocket() { this.readyState = 0; }
  OfflineSocket.prototype.send = OfflineSocket.prototype.close = OfflineSocket.prototype.addEventListener = OfflineSocket.prototype.removeEventListener = function () {};
  OfflineSocket.OPEN = 1; OfflineSocket.CLOSED = 3; OfflineSocket.CONNECTING = 0;
  window.WebSocket = OfflineSocket;

  if (role === 'source') {
    var mode = params.get('textonly') === 'true';
    var settingListeners = [];
    window.fetch = async function () { return { text: async function () { return ''; } }; };
    window.RTCPeerConnection = function () {
      this.addIceCandidate = async function () {};
      this.createDataChannel = function () { return { send: function () {} }; };
      this.createOffer = this.createAnswer = async function () { return {}; };
      this.setLocalDescription = async function (description) { this.localDescription = description; };
      this.setRemoteDescription = async function (description) { this.remoteDescription = description; };
    };
    window.chrome = { runtime: {
      id: 'local-security-demo', lastError: null, onMessage: { addListener: function (listener) { settingListeners.push(listener); } },
      sendMessage: function (id, request, callback) {
        if (request.getSettings) return callback({ state: true, settings: { textonlymode: mode } });
        if (request.message) {
          send('captured', { payload: request.message, hits: window.__probeHits, sourceHTML: document.querySelector('[data-test-selector="chat-line-message-body"]').innerHTML });
        }
        if (callback) callback({ id: 1 });
      }
    } };
    window.addEventListener('message', function (event) {
      if (event.source === window && event.origin === origin && event.data && event.data.chatSecurityDemo && event.data.kind === 'configure') {
        run = event.data.run;
        mode = event.data.detail;
        settingListeners.forEach(function (listener) { listener({ settings: { textonlymode: mode }, state: true }, {}, function () {}); });
        waitFor(function () { return document.getElementById('backlog').dataset.ignore === 'true'; }, 8000).then(function () { send('ready'); }).catch(fail);
        return;
      }
      if (!accepted(event) || event.data.kind !== 'inject') return;
      Array.from(document.getElementById('messages').children).forEach(function (child) { if (child.id !== 'backlog') child.remove(); });
      var row = document.createElement('div');
      row.className = 'chat-line__message';
      row.innerHTML = '<span class="chat-author__display-name">LocalDemoViewer</span><span data-test-selector="chat-line-message-body"></span>';
      row.querySelector('.chat-author__display-name').textContent = 'LocalDemoViewer-' + run.slice(-6);
      // Literal user text in a text node, exactly as escaped site text is exposed
      // by the browser. No payload is inserted as executable source DOM.
      row.querySelector('[data-test-selector]').textContent = event.data.detail;
      document.getElementById('messages').appendChild(row);
    });
    return;
  }

  if (role === 'relay') {
    ['error', 'warn'].forEach(function (method) {
      var original = console[method];
      console[method] = function () {
        errors.push(Array.prototype.map.call(arguments, String).join(' '));
        original.apply(console, arguments);
      };
    });
    window.addEventListener('DOMContentLoaded', function () { send('ready'); });
    window.addEventListener('message', async function (event) {
      if (!accepted(event) || event.data.kind !== 'relay') return;
      try {
        await processIncomingMessage(event.data.detail, { tab: { id: 101, url: 'https://www.twitch.tv/local-demo' } });
        if (errors.length) throw Error('Relay processing failed: ' + errors.join('; '));
        if (!window.__demoWire) throw Error('Production relay did not emit a message');
        send('relayed', { payload: window.__demoWire, hits: window.__probeHits, sanitizerCalls: window.__demoSanitizerCalls });
      } catch (error) { fail(error); }
    });
    return;
  }

  // Preserve browser evaluation for automated inspection; Dock replaces eval.
  if (/\/dock\.html$/.test(location.pathname)) Object.defineProperty(window, 'eval', { value: window.eval, configurable: false, writable: false });
  var src = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
    configurable: true, get: src.get,
    set: function (value) {
      if (/^https:\/\/vdo\.socialstream\.ninja\//.test(value)) value = '/__chat-security/bridge.html?run=' + encodeURIComponent(run);
      src.set.call(this, value);
    }
  });
  var html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true, get: html.get,
    set: function (value) {
      if (typeof value === 'string' && value.indexOf('SSN_LOCAL_PROBE') !== -1) parses.push({ rawProbe: value.indexOf('<img id="local-chat-probe"') !== -1, stack: new Error('HTML assignment').stack });
      html.set.call(this, value);
    }
  });
  window.addEventListener('DOMContentLoaded', function () {
    waitFor(function () { return document.querySelector('iframe[src*="/__chat-security/bridge.html"]'); }, 8000).then(function () {
      if (params.has('tts')) {
        if (!window.TTS || !TTS.speech) throw Error('Production TTS was not enabled');
        // Mute only audio output; speechMeta and all text processing remain real.
        TTS.speak = function (text) { spoken.push(text); };
      }
      send('ready');
    }).catch(fail);
  });
  window.addEventListener('message', async function (event) {
    if (!accepted(event) || event.data.kind !== 'deliver') return;
    try {
      var bridge = document.querySelector('iframe[src*="/__chat-security/bridge.html"]');
      await waitFor(function () { return bridge.contentDocument && bridge.contentDocument.readyState === 'complete'; }, 5000);
      bridge.contentWindow.postMessage({ demoBridge: true, payload: event.data.detail }, origin);
      await waitFor(function () { return document.body.textContent.indexOf('SSN_LOCAL_PROBE') !== -1 && (!params.has('tts') || spoken.length); }, 7000);
      setTimeout(function () {
        send('result', { hits: window.__probeHits, rendered: true, literalDisplayed: document.body.textContent.indexOf(event.data.detail.chatmessage) !== -1, spoken: spoken, parses: parses });
      }, 350);
    } catch (error) { fail(error); }
  });
})();
