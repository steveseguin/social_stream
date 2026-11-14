(function () {
  'use strict';

  // OAuth is handled by the SSO service; access tokens stay in this page only.
  // Keep capture in the page world and messaging in the extension's isolated world.
  var runtime = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id &&
    typeof chrome.runtime.sendMessage === 'function' ? chrome.runtime : null;
  var desktop = typeof window.__SSAPP_TAB_ID__ !== 'undefined' || !!window.ninjafy || !!window.__ssapp;
  function accepted(response) {
    return response !== false && !(response && (response.error || response.ok === false || response.state === false));
  }
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
      runtime.sendMessage(runtime.id, { message: message }, function (response) {
        window.dispatchEvent(new CustomEvent('ssnInstagramApiDelivery', {
          detail: { id: message.meta.messageId, ok: !runtime.lastError && accepted(response) }
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
    'status', 'output-status', 'message-count', 'sent-count', 'last-poll', 'chat-feed',
    'load-accounts-btn', 'account-select', 'media-select', 'refresh-media-btn', 'more-media-btn',
    'discovery-status', 'manual-media-settings', 'manual-account-id', 'load-account-id-btn',
    'signin-btn', 'signin-status', 'manual-token-settings'].forEach(function (id) {
    fields[id] = document.getElementById(id);
  });
  var active = null;
  var bridgeReady = false;
  var captureEnabled = false;
  var pending = new Map();
  var sent = 0;
  var MAX_PAGES = 100;
  var MAX_SEEN = 100000;
  var discovery = null;
  var accounts = [];
  var media = [];
  var mediaCursor = '';
  var mediaCursors = new Set();
  var authAttempt = null;
  var AUTH_START = 'https://sso.socialstream.ninja/auth/instagram/start';
  var AUTH_STATE_KEY = 'ssnInstagramOAuthState';
  var AUTH_STATE_PARAM = 'ssn_instagram_state';

  function authBridge() {
    if (window.ninjafy && typeof window.ninjafy.startInstagramOAuth === 'function') return window.ninjafy;
    if (window.__ssapp && typeof window.__ssapp.startInstagramOAuth === 'function') return window.__ssapp;
    return null;
  }
  function cancelSignIn() {
    var attempt = authAttempt;
    authAttempt = null;
    if (attempt && attempt.bridge && typeof attempt.bridge.cancelInstagramOAuth === 'function') {
      attempt.bridge.cancelInstagramOAuth().catch(function () {});
    }
    try { sessionStorage.removeItem(AUTH_STATE_KEY); } catch (_) {}
    fields['signin-btn'].disabled = false;
  }
  function applySignIn(result) {
    if (result && result.type === 'ssn-instagram-auth-error') {
      throw new Error(typeof result.message === 'string' ? result.message : 'Sign-in was not completed.');
    }
    if (!result || result.type !== 'ssn-instagram-auth-success' || result.login !== 'facebook' ||
        typeof result.accessToken !== 'string' || !result.accessToken.trim()) {
      throw new Error('Sign-in returned an unexpected response.');
    }
    disconnect();
    clearAccounts();
    fields['login-type'].value = 'facebook';
    fields['access-token'].value = result.accessToken.trim();
    fields['access-token'].type = 'password';
    fields['show-token'].checked = false;
    fields['manual-token-settings'].open = false;
    var name = result.user && typeof result.user.name === 'string' ? result.user.name : '';
    fields['signin-status'].textContent = name ? 'Signed in as ' + name + '. Access clears when this page closes.' : 'Signed in. Access clears when this page closes.';
    permissions();
    loadAccounts(false);
  }
  async function signIn() {
    if (authAttempt || active) return;
    cancelDiscovery();
    var attempt = { bridge: authBridge() };
    authAttempt = attempt;
    fields['signin-btn'].disabled = true;
    try {
      if (attempt.bridge) {
        status('connecting', 'Complete Facebook sign-in in your browser.');
        var result = await attempt.bridge.startInstagramOAuth();
        if (authAttempt !== attempt) return;
        applySignIn(result);
      } else {
        if (desktop) throw new Error('Update Social Stream to use Instagram sign-in, or enter a token manually.');
        if (location.protocol !== 'https:' && location.protocol !== 'http:') {
          throw new Error('Open the hosted Instagram source page to sign in, or enter a token manually.');
        }
        var bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        var nonce = Array.prototype.map.call(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join('');
        var returnTo = new URL(location.href);
        returnTo.hash = '';
        returnTo.searchParams.delete('access_token');
        returnTo.searchParams.delete('token');
        returnTo.searchParams.set(AUTH_STATE_PARAM, nonce);
        // Only a short-lived request nonce is stored, never the token or identity.
        sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify({ nonce: nonce, createdAt: Date.now() }));
        var startUrl = new URL(AUTH_START);
        startUrl.searchParams.set('return_to', returnTo.toString());
        location.assign(startUrl.toString());
      }
    } catch (error) {
      status('error', error.message || 'Could not start sign-in.');
    } finally {
      if (authAttempt === attempt) {
        authAttempt = null;
        fields['signin-btn'].disabled = false;
      }
    }
  }
  function consumeSignIn() {
    var hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    var encoded = hash.get('instagram_auth_result') || hash.get('instagram_auth_error');
    if (!encoded && !params.has(AUTH_STATE_PARAM)) return;
    var nonce = params.get(AUTH_STATE_PARAM);
    try {
      var cleanUrl = new URL(location.href);
      cleanUrl.hash = '';
      cleanUrl.searchParams.delete(AUTH_STATE_PARAM);
      history.replaceState(null, '', cleanUrl.toString());
      var pendingAuth = JSON.parse(sessionStorage.getItem(AUTH_STATE_KEY) || 'null');
      sessionStorage.removeItem(AUTH_STATE_KEY);
      var age = pendingAuth ? Date.now() - pendingAuth.createdAt : -1;
      if (!pendingAuth || pendingAuth.nonce !== nonce || age < 0 || age > 10 * 60 * 1000 || !encoded) {
        throw new Error('This sign-in request expired or belongs to another page. Please sign in again.');
      }
      var binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      applySignIn(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      status('error', error.message || 'Could not complete sign-in.');
    }
  }

  function resetOptions(select, prompt) {
    select.textContent = '';
    var option = document.createElement('option');
    option.value = '';
    option.textContent = prompt;
    select.appendChild(option);
    select.value = '';
    select.disabled = true;
  }
  function cancelDiscovery() {
    if (discovery) {
      if (discovery.controller) discovery.controller.abort();
      discovery.token = '';
      discovery = null;
    }
    fields['load-accounts-btn'].disabled = false;
    fields['load-account-id-btn'].disabled = false;
    fields['refresh-media-btn'].disabled = !fields['account-select'].value;
    fields['more-media-btn'].disabled = false;
  }
  function clearMedia() {
    media = [];
    mediaCursor = '';
    mediaCursors.clear();
    fields['media-id'].value = '';
    fields['more-media-btn'].hidden = true;
    resetOptions(fields['media-select'], 'Choose an Instagram account first');
  }
  function clearAccounts() {
    cancelDiscovery();
    accounts = [];
    resetOptions(fields['account-select'], 'Load your accounts first');
    clearMedia();
    fields['refresh-media-btn'].disabled = true;
    fields['discovery-status'].textContent = 'Load your accounts to find a live video or post.';
  }
  function startDiscovery() {
    cancelDiscovery();
    var token = fields['access-token'].value.trim();
    if (!token) {
      fields['discovery-status'].textContent = 'Sign in or enter an access token first.';
      return null;
    }
    discovery = {
      token: token,
      host: fields['login-type'].value === 'facebook' ? 'graph.facebook.com' : 'graph.instagram.com'
    };
    fields['load-accounts-btn'].disabled = true;
    fields['load-account-id-btn'].disabled = true;
    fields['refresh-media-btn'].disabled = true;
    fields['more-media-btn'].disabled = true;
    return discovery;
  }
  async function discoverRequest(run, path, requestedFields, after) {
    var url = new URL('https://' + run.host + '/v26.0/' + path);
    url.searchParams.set('fields', requestedFields);
    url.searchParams.set('limit', '50');
    if (after) url.searchParams.set('after', after);
    var controller = new AbortController();
    run.controller = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(url.toString(), {
        headers: { Authorization: 'Bearer ' + run.token },
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal
      });
      var data = await response.json();
      if (!response.ok || data.error) {
        var error = new Error('Instagram could not load the account or media list.');
        error.code = data.error && Number(data.error.code);
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timeout);
      if (run.controller === controller) run.controller = null;
    }
  }
  function nextCursor(data, seen) {
    if (!data.paging || !data.paging.next) return '';
    var cursor = data.paging.cursors && data.paging.cursors.after;
    if (typeof cursor !== 'string' || !cursor || seen.has(cursor)) {
      throw new Error('Instagram returned an invalid pagination cursor. Refresh the list to try again.');
    }
    return cursor;
  }
  function discoveryError(error) {
    return error.code === 190 ? 'The token expired. Sign in again or enter a new token.'
      : error.code === 10 || error.code === 200 ? 'Account access is missing. Check the token permissions and which Instagram accounts were selected.'
      : error.code ? 'Instagram API error ' + error.code + '. Check the token and account permissions.'
      : error.name === 'AbortError' ? 'The request timed out. Try loading the list again.'
      : error instanceof TypeError ? 'Could not reach Instagram. Check your connection and try again.' : error.message;
  }
  async function loadAccounts(manual) {
    if (active) return;
    var accountId = manual === true ? fields['manual-account-id'].value.trim() : '';
    if (manual === true && !/^\d+$/.test(accountId)) {
      fields['discovery-status'].textContent = 'Enter a numeric Instagram professional account ID.';
      return;
    }
    clearAccounts();
    var run = startDiscovery();
    if (!run) return;
    fields['discovery-status'].textContent = 'Loading Instagram accounts…';
    try {
      var found = new Map();
      if (accountId) {
        var specified = await discoverRequest(run, accountId, 'id,username');
        if (discovery !== run) return;
        if (String(specified.id || '') !== accountId || !specified.username) throw new Error('The ID did not return an Instagram account. Check its ID and permissions.');
        found.set(accountId, { id: accountId, username: specified.username, name: '' });
      } else if (run.host === 'graph.facebook.com') {
        var after = '';
        var cursors = new Set();
        do {
          var data = await discoverRequest(run, 'me/accounts', 'id,name,instagram_business_account{id,username,name}', after);
          if (discovery !== run) return;
          if (!Array.isArray(data.data)) throw new Error('Instagram returned an unexpected account list.');
          data.data.forEach(function (page) {
            var account = page && page.instagram_business_account;
            if (account && /^\d+$/.test(String(account.id || ''))) {
              found.set(String(account.id), { id: String(account.id), username: account.username || '', name: account.name || page.name || '' });
            }
          });
          after = nextCursor(data, cursors);
          if (after) cursors.add(after);
          if (after && cursors.size >= MAX_PAGES) throw new Error('Too many account pages. Limit the accounts selected during sign-in.');
        } while (after);
      } else {
        var profile = await discoverRequest(run, 'me', 'user_id,username');
        if (discovery !== run) return;
        if (!/^\d+$/.test(String(profile.user_id || ''))) throw new Error('Instagram did not return a professional account ID.');
        found.set(String(profile.user_id), { id: String(profile.user_id), username: profile.username || '', name: '' });
      }
      accounts = Array.from(found.values());
      resetOptions(fields['account-select'], accounts.length ? 'Choose an Instagram account' : 'No linked Instagram accounts found');
      accounts.forEach(function (account) {
        var option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.username ? '@' + account.username : account.name || account.id;
        fields['account-select'].appendChild(option);
      });
      fields['account-select'].disabled = !accounts.length;
      fields['discovery-status'].textContent = accounts.length ? 'Choose an account and media type.'
        : 'Meta did not list a linked Instagram account. Refresh your sign-in with its Facebook Page selected, or use “Account missing from the list?” above.';
      cancelDiscovery();
      if (accounts.length === 1) {
        fields['account-select'].value = accounts[0].id;
        loadMedia(false);
      }
    } catch (error) {
      if (discovery !== run) return;
      fields['discovery-status'].textContent = discoveryError(error);
    } finally {
      if (discovery === run) cancelDiscovery();
    }
  }
  async function loadMedia(more) {
    if (active) return;
    cancelDiscovery();
    if (!more) clearMedia();
    var accountId = fields['account-select'].value;
    if (!accounts.some(function (account) { return account.id === accountId; })) return;
    var run = startDiscovery();
    if (!run) return;
    var kind = fields['media-type'].value;
    fields['discovery-status'].textContent = kind === 'live' ? 'Looking for live videos…' : 'Loading posts and Reels…';
    try {
      var data = await discoverRequest(run, accountId + (kind === 'live' ? '/live_media' : '/media'),
        kind === 'live' ? 'id,timestamp' : 'id,caption,media_type,timestamp', more ? mediaCursor : '');
      if (discovery !== run) return;
      if (!Array.isArray(data.data)) throw new Error('Instagram returned an unexpected media list.');
      var cursor = nextCursor(data, mediaCursors);
      if (cursor && mediaCursors.size >= MAX_PAGES) throw new Error('Too many media pages. Enter an older media ID manually.');
      var previous = fields['media-select'].value;
      var seen = new Set(media.map(function (entry) { return entry.id; }));
      data.data.forEach(function (entry) {
        if (!entry || !/^\d+$/.test(String(entry.id || ''))) throw new Error('Instagram returned a media item without an ID.');
      });
      data.data.forEach(function (entry) {
        entry.id = String(entry.id);
        if (!seen.has(entry.id)) { media.push(entry); seen.add(entry.id); }
      });
      mediaCursor = cursor;
      if (cursor) mediaCursors.add(cursor);
      resetOptions(fields['media-select'], media.length ? 'Choose a video or post' : kind === 'live' ? 'No active live video' : 'No posts or Reels found');
      media.forEach(function (entry) {
        var option = document.createElement('option');
        option.value = entry.id;
        var time = Date.parse(entry.timestamp);
        var label = kind === 'live' ? 'Live video' : entry.media_type === 'VIDEO' ? 'Video / Reel' : entry.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Post';
        option.textContent = label + (Number.isFinite(time) ? ' · ' + new Date(time).toLocaleString() : '') +
          (entry.caption ? ' · ' + String(entry.caption).replace(/\s+/g, ' ').slice(0, 100) : ' · ' + entry.id);
        fields['media-select'].appendChild(option);
      });
      fields['media-select'].disabled = !media.length;
      fields['media-select'].value = media.some(function (entry) { return entry.id === previous; }) ? previous : media.length === 1 ? media[0].id : '';
      fields['media-id'].value = fields['media-select'].value;
      fields['more-media-btn'].hidden = !cursor;
      fields['discovery-status'].textContent = media.length ? 'Choose the video or post, then click Connect.'
        : kind === 'live' ? 'No active live video was returned. Start a broadcast and refresh, or choose Post or Reel.' : 'Publish a post or Reel on this account, then refresh.';
    } catch (error) {
      if (discovery !== run) return;
      fields['discovery-status'].textContent = discoveryError(error);
    } finally {
      if (discovery === run) cancelDiscovery();
    }
  }

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
        runtime.sendMessage(runtime.id, { message: message }, function (response) { delivered(id, !runtime.lastError && accepted(response)); });
      } else if (window.ninjafy && typeof window.ninjafy.sendMessage === 'function') {
        window.ninjafy.sendMessage(null, { message: message }, function (response) { delivered(id, accepted(response)); }, window.__SSAPP_TAB_ID__);
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
    url.searchParams.set('fields', 'id,text,timestamp,from,hidden');
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
        if (entry.hidden === true) return;
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
    if (authAttempt) { status('error', 'Finish signing in or clear sign-in before connecting.'); return; }
    var mediaId = fields['media-id'].value.trim();
    var token = fields['access-token'].value.trim();
    if (!/^\d+$/.test(mediaId) || !token) {
      status('error', !token ? 'Sign in or enter an access token first.' : 'Choose a video or post, or enter its numeric media ID manually.');
      return;
    }
    var interval = Number(fields['poll-interval'].value);
    if (!Number.isFinite(interval) || interval < 5 || interval > 60) {
      status('error', 'Choose a polling interval from 5 to 60 seconds.');
      return;
    }
    cancelDiscovery();
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
      ? 'Use a user access token with instagram_basic, instagram_manage_comments, pages_read_engagement and pages_show_list to load your linked accounts.'
      : 'Requires instagram_business_basic and instagram_business_manage_comments.';
  }
  fields['media-id'].value = params.get('mediaId') || params.get('videoId') || '';
  fields['login-type'].value = params.get('login') === 'instagram' ? 'instagram' : 'facebook';
  fields['media-type'].value = params.get('mediaType') === 'post' ? 'post' : 'live';
  fields['manual-media-settings'].open = !!fields['media-id'].value;
  fields['connection-form'].addEventListener('submit', connect);
  fields['signin-btn'].addEventListener('click', signIn);
  fields['disconnect-btn'].addEventListener('click', disconnect);
  fields['clear-token-btn'].addEventListener('click', function () {
    cancelSignIn();
    disconnect(); fields['access-token'].value = ''; fields['access-token'].type = 'password'; fields['show-token'].checked = false;
    fields['signin-status'].textContent = 'Sign-in cleared. Sign in again or enter a token manually.';
    clearAccounts();
  });
  fields['show-token'].addEventListener('change', function () { fields['access-token'].type = this.checked ? 'text' : 'password'; });
  fields['login-type'].addEventListener('change', function () { cancelSignIn(); clearAccounts(); permissions(); });
  fields['access-token'].addEventListener('input', function () {
    cancelSignIn();
    fields['signin-status'].textContent = 'Using a manual access token. It clears when this page closes.';
    var manualId = fields['media-select'].value ? '' : fields['media-id'].value;
    clearAccounts();
    fields['media-id'].value = manualId;
  });
  fields['load-accounts-btn'].addEventListener('click', function () { loadAccounts(false); });
  fields['load-account-id-btn'].addEventListener('click', function () { loadAccounts(true); });
  fields['account-select'].addEventListener('change', function () { loadMedia(false); });
  fields['media-type'].addEventListener('change', function () { loadMedia(false); });
  fields['refresh-media-btn'].addEventListener('click', function () { loadMedia(false); });
  fields['more-media-btn'].addEventListener('click', function () { if (mediaCursor) loadMedia(true); });
  fields['media-select'].addEventListener('change', function () { fields['media-id'].value = this.value; });
  fields['media-id'].addEventListener('input', function () { fields['media-select'].value = ''; });
  window.addEventListener('beforeunload', function () {
    if (authAttempt && authAttempt.bridge) cancelSignIn();
    cancelDiscovery(); disconnect();
  });
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
  consumeSignIn();
})();
