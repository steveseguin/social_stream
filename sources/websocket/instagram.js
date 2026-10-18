(function () {
  'use strict';

  // Manual-token API reader. OAuth and a webhook receiver are separate services.
  // Keep capture in the page world and messaging in the extension's isolated world.
  var runtime = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id &&
    typeof chrome.runtime.sendMessage === 'function' ? chrome.runtime : null;
  var desktop = typeof window.__SSAPP_TAB_ID__ !== 'undefined' || !!window.ninjafy || !!window.__ssapp;
  if (runtime && !desktop && location.protocol !== 'chrome-extension:') {
    if (window.__ssnInstagramApiRelay) return;
    window.__ssnInstagramApiRelay = true;
    function sendSettings(request) {
      window.dispatchEvent(new CustomEvent('ssnInstagramApiSettings', { detail: request }));
    }
    function requestSettings() {
      runtime.sendMessage(runtime.id, { getSettings: true }, function (response) {
        if (!runtime.lastError && response) sendSettings(response);
      });
    }
    window.addEventListener('ssnInstagramApiRequestSettings', requestSettings);
    window.addEventListener('ssnInstagramApiMessage', function (event) {
      var message = event.detail;
      if (!message || (message.type !== 'instagram' && message.type !== 'instagramlive') ||
          typeof message.chatmessage !== 'string' || !message.meta || typeof message.meta.messageId !== 'string') return;
      runtime.sendMessage(runtime.id, { message: message }, function () {
        window.dispatchEvent(new CustomEvent('ssnInstagramApiDelivery', {
          detail: { id: message.meta.messageId, ok: !runtime.lastError }
        }));
      });
    });
    runtime.onMessage.addListener(function (request, sender, reply) {
      if (request === 'getSource') { reply('instagram'); return; }
      if (request && typeof request === 'object' && ('state' in request || 'settings' in request)) {
        sendSettings(request); reply(true); return;
      }
      reply(false);
    });
    requestSettings();
    return;
  }
  if (document.documentElement.getAttribute('data-ssn-instagram-api') === '1') return;
  document.documentElement.setAttribute('data-ssn-instagram-api', '1');

  var params = new URLSearchParams(location.search);
  var fields = {};
  ['connection-form', 'connection-fields', 'login-type', 'media-id', 'media-type', 'access-token',
    'show-token', 'poll-interval', 'permission-hint', 'connect-btn', 'disconnect-btn', 'clear-token-btn',
    'status', 'output-status', 'message-count', 'sent-count', 'last-poll', 'chat-feed'].forEach(function (id) {
    fields[id] = document.getElementById(id);
  });
  var active = null;
  var bridgeReady = false;
  var captureEnabled = false;
  var pending = new Map();
  var sent = 0;
  var MAX_PAGES = 100;
  var MAX_SEEN = 100000;

  function status(kind, text) {
    fields.status.dataset.state = kind;
    fields.status.textContent = text;
  }
  function outputStatus() {
    fields['output-status'].textContent = !bridgeReady
      ? 'Preview only — no Social Stream connection detected.'
      : !captureEnabled ? 'Preview only — Social Stream is off.' : 'Social Stream is available for new comments.';
  }
  function applySettings(response) {
    if (!response || typeof response !== 'object') return;
    if ('state' in response) captureEnabled = !!response.state;
    bridgeReady = true;
    outputStatus();
  }
  function delivered(id, ok) {
    var item = pending.get(id);
    if (!item) return;
    clearTimeout(item.timeout);
    pending.delete(id);
    if (active !== item.run) return;
    if (ok) {
      sent += 1;
      fields['sent-count'].textContent = String(sent);
    } else {
      fields['output-status'].textContent = 'A comment could not be confirmed by Social Stream. It remains in the preview; check the dock.';
    }
  }
  function forward(message, run) {
    if (!bridgeReady || !captureEnabled) return;
    var id = message.meta.messageId;
    pending.set(id, { run: run, timeout: setTimeout(function () { delivered(id, false); }, 5000) });
    try {
      if (runtime) {
        runtime.sendMessage(runtime.id, { message: message }, function () { delivered(id, !runtime.lastError); });
      } else if (window.ninjafy && typeof window.ninjafy.sendMessage === 'function') {
        window.ninjafy.sendMessage(null, { message: message }, function () { delivered(id, true); }, window.__SSAPP_TAB_ID__);
      } else {
        window.dispatchEvent(new CustomEvent('ssnInstagramApiMessage', { detail: message }));
      }
    } catch (_) { delivered(id, false); }
  }

  function render(entry, history) {
    var empty = document.getElementById('chat-empty');
    if (empty) empty.remove();
    var row = document.createElement('div');
    row.className = 'chat-line';
    row.dataset.commentId = entry.id;
    var header = document.createElement('div');
    header.className = 'chat-header';
    var name = document.createElement('strong');
    name.textContent = (entry.from && entry.from.username) || entry.username || 'Instagram user';
    var time = document.createElement('small');
    var timestamp = Date.parse(entry.timestamp);
    time.textContent = (Number.isFinite(timestamp) ? new Date(timestamp).toLocaleTimeString() : '') + (history ? ' · History' : '');
    var body = document.createElement('div');
    body.className = 'chat-text';
    body.textContent = entry.text;
    header.appendChild(name);
    header.appendChild(time);
    row.appendChild(header);
    row.appendChild(body);
    fields['chat-feed'].appendChild(row);
    while (fields['chat-feed'].children.length > 200) fields['chat-feed'].firstChild.remove();
    fields['chat-feed'].scrollTop = fields['chat-feed'].scrollHeight;
  }
  function payload(entry, run) {
    var from = entry.from || {};
    var type = run.mediaType === 'live' ? 'instagramlive' : 'instagram';
    var message = {
      platform: type, type: type,
      chatname: from.username || entry.username || 'Instagram user',
      chatmessage: entry.text,
      chatimg: '', chatbadges: '', contentimg: '', backgroundColor: '', textColor: '',
      hasDonation: '', membership: '', textonly: true,
      meta: { messageId: entry.id, mediaId: run.mediaId }
    };
    if (from.id) message.userid = String(from.id);
    var timestamp = Date.parse(entry.timestamp);
    if (Number.isFinite(timestamp)) message.timestamp = timestamp;
    return message;
  }

  async function request(run, after) {
    var url = new URL('https://' + run.host + '/v26.0/' + run.mediaId + '/comments');
    url.searchParams.set('fields', 'id,text,timestamp,from');
    url.searchParams.set('limit', '50');
    if (after) url.searchParams.set('after', after);
    var controller = new AbortController();
    run.controller = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(url.toString(), {
        headers: { Authorization: 'Bearer ' + run.token },
        credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal
      });
      var data = await response.json();
      if (!response.ok || data.error) {
        var error = new Error('Instagram API request failed.');
        error.code = data.error && Number(data.error.code);
        error.httpStatus = response.status;
        throw error;
      }
      if (!Array.isArray(data.data)) throw new Error('Instagram returned an unexpected comment response.');
      return data;
    } finally {
      clearTimeout(timeout);
      if (run.controller === controller) run.controller = null;
    }
  }
  async function poll(run) {
    try {
      var entries = new Map();
      var cursors = new Set();
      var after = '';
      var page = 0;
      do {
        var data = await request(run, after);
        if (active !== run) return;
        data.data.forEach(function (entry) {
          if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string') {
            throw new Error('A comment is missing its ID or text; capture paused.');
          }
          entries.set(entry.id, entry);
        });
        after = '';
        if (data.paging && data.paging.next) {
          // Never follow a server-provided URL with the user's token.
          after = data.paging.cursors && data.paging.cursors.after;
          if (!after || cursors.has(after)) throw new Error('Instagram returned an invalid pagination cursor.');
          cursors.add(after);
        }
        page += 1;
        if (after && page >= MAX_PAGES) throw new Error('Too many comment pages for polling. Use a smaller media thread or a webhook connection.');
      } while (after);
      if (run.seen.size + Array.from(entries.keys()).filter(function (id) { return !run.seen.has(id); }).length > MAX_SEEN) {
        throw new Error('Comment history limit reached. Reconnect to start a new capture session.');
      }
      // Commit only complete snapshots; failed pages must not advance the baseline.
      Array.from(entries.values()).reverse().forEach(function (entry) {
        if (run.seen.has(entry.id)) return;
        run.seen.add(entry.id);
        render(entry, !run.initialized);
        if (!run.initialized) return;
        run.count += 1;
        forward(payload(entry, run), run);
      });
      run.initialized = true;
      run.failures = 0;
      if (!fields['chat-feed'].children.length) {
        var empty = document.createElement('p');
        empty.id = 'chat-empty';
        empty.className = 'hint';
        empty.textContent = 'No comments yet.';
        fields['chat-feed'].appendChild(empty);
      }
      fields['message-count'].textContent = String(run.count);
      fields['last-poll'].textContent = new Date().toLocaleTimeString();
      status('connected', 'Polling Instagram comments.');
      run.timer = setTimeout(function () { poll(run); }, run.interval);
    } catch (error) {
      if (active !== run) return;
      run.failures += 1;
      var permanent = error.code === 190 || error.code === 10 || error.code === 200 || error.httpStatus === 401 || error.httpStatus === 403;
      var message = permanent ? 'Token expired or missing access. Check the token and permissions, then reconnect.'
        : error.code ? 'Instagram API error ' + error.code + '. Check the token, media ID and account permissions.'
        : error.name === 'AbortError' ? 'Instagram request timed out.'
        : error instanceof TypeError ? 'Could not reach Instagram. Check the network and whether this browser permits API requests.'
        : error.message;
      if (permanent || run.failures >= 3) {
        disconnect();
        status('error', message + ' Capture stopped.');
      } else {
        status('error', message + ' Retrying; the previous snapshot is preserved.');
        run.timer = setTimeout(function () { poll(run); }, Math.min(run.interval * Math.pow(2, run.failures), 60000));
      }
    }
  }
  function disconnect() {
    var run = active;
    active = null;
    if (run) {
      clearTimeout(run.timer);
      if (run.controller) run.controller.abort();
      run.token = '';
    }
    pending.forEach(function (item) { clearTimeout(item.timeout); });
    pending.clear();
    fields['connection-fields'].disabled = false;
    fields['connect-btn'].disabled = false;
    fields['disconnect-btn'].disabled = true;
    status('disconnected', 'Disconnected');
  }
  function connect(event) {
    if (event) event.preventDefault();
    if (active) return;
    var mediaId = fields['media-id'].value.trim();
    var token = fields['access-token'].value.trim();
    if (!/^\d+$/.test(mediaId) || !token) {
      status('error', 'Enter a numeric Instagram media ID and an access token.');
      return;
    }
    var interval = Number(fields['poll-interval'].value);
    if (!Number.isFinite(interval) || interval < 5 || interval > 60) {
      status('error', 'Choose a polling interval from 5 to 60 seconds.');
      return;
    }
    active = {
      mediaId: mediaId, token: token, mediaType: fields['media-type'].value,
      host: fields['login-type'].value === 'facebook' ? 'graph.facebook.com' : 'graph.instagram.com',
      interval: interval * 1000, seen: new Set(), initialized: false, count: 0, failures: 0
    };
    sent = 0;
    fields['message-count'].textContent = '0';
    fields['sent-count'].textContent = '0';
    fields['last-poll'].textContent = '—';
    fields['chat-feed'].textContent = '';
    fields['access-token'].type = 'password';
    fields['show-token'].checked = false;
    fields['connection-fields'].disabled = true;
    fields['connect-btn'].disabled = true;
    fields['disconnect-btn'].disabled = false;
    outputStatus();
    status('connecting', 'Loading existing comments as history…');
    poll(active);
  }
  function permissions() {
    fields['permission-hint'].textContent = fields['login-type'].value === 'facebook'
      ? 'Requires instagram_basic, instagram_manage_comments and pages_read_engagement for the linked professional account.'
      : 'Requires instagram_business_basic and instagram_business_manage_comments.';
  }
  fields['media-id'].value = params.get('mediaId') || params.get('videoId') || '';
  fields['login-type'].value = params.get('login') === 'facebook' ? 'facebook' : 'instagram';
  fields['media-type'].value = params.get('mediaType') === 'post' ? 'post' : 'live';
  fields['connection-form'].addEventListener('submit', connect);
  fields['disconnect-btn'].addEventListener('click', disconnect);
  fields['clear-token-btn'].addEventListener('click', function () {
    disconnect(); fields['access-token'].value = ''; fields['access-token'].type = 'password'; fields['show-token'].checked = false;
  });
  fields['show-token'].addEventListener('change', function () { fields['access-token'].type = this.checked ? 'text' : 'password'; });
  fields['login-type'].addEventListener('change', permissions);
  window.addEventListener('beforeunload', disconnect);
  window.addEventListener('ssnInstagramApiSettings', function (event) { applySettings(event.detail); });
  window.addEventListener('ssnInstagramApiDelivery', function (event) {
    if (event.detail) delivered(event.detail.id, event.detail.ok);
  });
  if (runtime) {
    runtime.onMessage.addListener(function (request, sender, reply) {
      if (request === 'getSource') { reply(fields['media-type'].value === 'live' ? 'instagramlive' : 'instagram'); return; }
      if (request === 'focusChat') { fields['media-id'].focus(); reply(true); return; }
      if (request && typeof request === 'object' && ('state' in request || 'settings' in request)) {
        applySettings(request); reply(true); return;
      }
      reply(false);
    });
    runtime.sendMessage(runtime.id, { getSettings: true }, function (response) {
      if (!runtime.lastError) applySettings(response);
    });
  } else if (window.ninjafy && typeof window.ninjafy.sendMessage === 'function') {
    window.ninjafy.sendMessage(null, { getSettings: true }, applySettings, window.__SSAPP_TAB_ID__);
  }
  window.addEventListener('message', function (event) {
    if (event.source === window && event.data && event.data.__ssappSendToTab) applySettings(event.data.__ssappSendToTab);
  });
  window.dispatchEvent(new CustomEvent('ssnInstagramApiRequestSettings'));
  permissions();
  outputStatus();
})();
