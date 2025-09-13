(function() {
  "use strict";

  // Minimal settings placeholder (kept for parity with other sources)
  var settings = {};
  var isExtensionOn = true;
  var channel = '';
  var connected = false;
  var viewerCount = 0;
  var lastEventId = 0;

  // UI bindings
  const els = {};
  function bindUI() {
    els.channelInput = document.getElementById('channel-input');
    els.connectButton = document.getElementById('connect-button');
    els.simulateButton = document.getElementById('simulate-button');
    els.resetButton = document.getElementById('change-button');
    els.textarea = document.getElementById('textarea');
    els.userAvatar = document.getElementById('user-avatar');
    els.currentUser = document.getElementById('current-user');
    els.currentChannel = document.getElementById('current-channel');
    els.followerCount = document.getElementById('follower-count');
    els.subscriberCount = document.getElementById('subscriber-count');
    els.viewerCount = document.getElementById('viewer-count');
    els.captureFollows = document.getElementById('capture-follows');
    els.captureSubs = document.getElementById('capture-subs');
    els.captureGifts = document.getElementById('capture-gifts');
    els.captureLikes = document.getElementById('capture-likes');
    els.captureJoins = document.getElementById('capture-joins');
    els.captureShares = document.getElementById('capture-shares');
    els.sendButton = document.getElementById('sendmessage');
    els.inputText = document.getElementById('input-text');
  }

  function showAuth() {
    document.querySelector('.auth')?.classList.remove('hidden');
    document.querySelectorAll('.socket').forEach(ele => ele.classList.add('hidden'));
  }
  function showSocket() {
    document.querySelector('.auth')?.classList.add('hidden');
    document.querySelectorAll('.socket').forEach(ele => ele.classList.remove('hidden'));
  }

  function updateHeaderInfo(user, targetChannel) {
    if (els.currentUser) els.currentUser.textContent = user || 'Logged in (browser session)';
    if (els.currentChannel) els.currentChannel.textContent = targetChannel || '—';
    if (els.userAvatar) {
      els.userAvatar.style.backgroundImage = '';
      els.userAvatar.style.backgroundSize = 'cover';
    }
  }

  function addEventRow(text) {
    const list = document.getElementById('events-list');
    if (!list) return;
    const row = document.createElement('div');
    row.textContent = text;
    list.prepend(row);
    while (list.children.length > 100) list.removeChild(list.lastChild);
  }

  function writeLine(obj) {
    if (!els.textarea) return;
    const line = document.createElement('div');
    const ts = new Date().toLocaleTimeString();
    line.textContent = `[${ts}] ${JSON.stringify(obj)}`;
    els.textarea.appendChild(line);
    els.textarea.scrollTop = els.textarea.scrollHeight;
  }

  function pushMessage(data) {
    try {
      // Ensure type is set
      data.type = 'tiktok';
      chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function() {
        // ignore callback errors
      });
      writeLine(data);
    } catch (e) {
      // in standalone debug this may fail; still show
      writeLine({ error: 'send-failed', detail: String(e), data });
    }
  }

  function normalizeHandle(input) {
    if (!input) return '';
    let v = input.trim();
    if (!v) return '';
    if (!v.startsWith('@')) v = '@' + v;
    return v;
  }

  // --- Simulation helpers (until real API/webcast wired) ---
  function simulateAll() {
    const name = 'demo_user_' + (++lastEventId);
    if (els.captureFollows?.checked) {
      pushMessage({
        event: 'new_follower',
        chatname: name,
        chatimg: '',
        chatmessage: `${name} started following`,
        meta: { source: 'simulate', kind: 'follow' }
      });
      addEventRow(`New Follower: ${name}`);
    }
    if (els.captureSubs?.checked) {
      pushMessage({
        event: 'new_subscriber',
        chatname: name,
        membership: 'SUBSCRIBER',
        chatmessage: `${name} subscribed!`,
        meta: { source: 'simulate', kind: 'subscription' }
      });
      addEventRow(`New Subscriber: ${name}`);
    }
    if (els.captureGifts?.checked) {
      pushMessage({
        event: 'gift',
        chatname: name,
        hasDonation: '10 coins',
        chatmessage: `${name} sent x10 Rose`,
        meta: { source: 'simulate', kind: 'gift', gift: { name: 'Rose', coins: 1, qty: 10 } }
      });
      addEventRow(`Gift: ${name} sent 10 Rose`);
    }
    if (els.captureLikes?.checked) {
      pushMessage({
        event: 'like',
        chatname: name,
        chatmessage: `${name} liked the stream`,
        meta: { source: 'simulate', kind: 'like', likes: 1 }
      });
      addEventRow(`Like: ${name}`);
    }
    if (els.captureJoins?.checked) {
      pushMessage({
        event: 'joined',
        chatname: name,
        chatmessage: `${name} joined`,
        meta: { source: 'simulate', kind: 'member' }
      });
      addEventRow(`Join: ${name}`);
    }
    if (els.captureShares?.checked) {
      pushMessage({
        event: 'share',
        chatname: name,
        chatmessage: `${name} shared the live`,
        meta: { source: 'simulate', kind: 'share' }
      });
      addEventRow(`Share: ${name}`);
    }
    // viewer update meta (already used in sources/tiktok.js DOM scraper)
    viewerCount += Math.floor(Math.random() * 3);
    if (els.viewerCount) els.viewerCount.textContent = String(viewerCount);
    pushMessage({ event: 'viewer_update', meta: viewerCount });
  }

  // --- Connection lifecycle (stubs for now) ---
  async function connectToChannel(handle) {
    channel = normalizeHandle(handle);
    if (!channel) return;
    // For now we just show the interface and fake a connection
    showSocket();
    updateHeaderInfo(null, channel);
    connected = true;
    // TODO: Resolve room info and begin polling webcast endpoint using logged-in cookies
    // TODO: Map webcast event types -> unified messages below
  }

  function resetConnection() {
    connected = false;
    channel = '';
    showAuth();
    updateHeaderInfo(null, null);
  }

  // --- Event mappers (to be used when wiring the webcast feed) ---
  function sendChatMessage({ chatname, chatimg, chatmessage, badges, color }) {
    pushMessage({
      event: false,
      chatname: chatname || '',
      chatimg: chatimg || '',
      chatbadges: badges || [],
      nameColor: color || '',
      chatmessage: chatmessage || '',
      textonly: false
    });
  }
  function sendFollow({ username, userId }) {
    if (!els.captureFollows?.checked) return;
    pushMessage({
      event: 'new_follower',
      chatname: username,
      chatmessage: `${username} started following`,
      meta: { userId }
    });
    addEventRow(`New Follower: ${username}`);
  }
  function sendSubscription({ username, months }) {
    if (!els.captureSubs?.checked) return;
    pushMessage({
      event: 'new_subscriber',
      chatname: username,
      membership: 'SUBSCRIBER',
      chatmessage: `${username} subscribed${months ? ` (${months} months)` : ''}`,
      meta: { months: months || 1 }
    });
    addEventRow(`New Subscriber: ${username}`);
  }
  function sendGift({ username, giftName, coins, qty, image }) {
    if (!els.captureGifts?.checked) return;
    const hasDonation = coins && qty ? `${coins * qty} coins` : (coins ? `${coins} coins` : `${qty || 1} ${giftName}`);
    pushMessage({
      event: 'gift',
      chatname: username,
      chatmessage: `${username} sent ${qty || 1} ${giftName}`,
      hasDonation,
      contentimg: image || '',
      meta: { gift: { name: giftName, coins: coins || null, qty: qty || 1 } }
    });
    addEventRow(`Gift: ${username} → ${qty || 1} ${giftName}`);
  }
  function sendLike({ username, likes }) {
    if (!els.captureLikes?.checked) return;
    pushMessage({ event: 'like', chatname: username, chatmessage: `${username} liked`, meta: { likes: likes || 1 } });
  }
  function sendJoin({ username }) {
    if (!els.captureJoins?.checked) return;
    pushMessage({ event: 'joined', chatname: username, chatmessage: `${username} joined`, meta: {} });
  }
  function sendShare({ username }) {
    if (!els.captureShares?.checked) return;
    pushMessage({ event: 'share', chatname: username, chatmessage: `${username} shared the live`, meta: {} });
  }
  function sendViewerUpdate(count) {
    viewerCount = count;
    if (els.viewerCount) els.viewerCount.textContent = String(count);
    pushMessage({ event: 'viewer_update', meta: count });
  }

  // --- Moderate (stubs) ---
  async function banUser(username, durationSec = 0) {
    // TODO: Implement TikTok moderation endpoint call using logged-in session
    addEventRow(`(stub) Ban ${username} ${durationSec ? `for ${durationSec}s` : 'permanently'}`);
    return false;
  }
  async function unbanUser(username) {
    addEventRow(`(stub) Unban ${username}`);
    return false;
  }
  async function sendMessage(text) {
    // TODO: Implement TikTok chat post using internal endpoint
    addEventRow(`(stub) Send message: ${text}`);
    return false;
  }

  // --- Bootstrap ---
  function init() {
    bindUI();
    showAuth();
    updateHeaderInfo(null, null);

    els.connectButton?.addEventListener('click', () => {
      connectToChannel(els.channelInput?.value || '');
    });
    els.simulateButton?.addEventListener('click', simulateAll);
    els.resetButton?.addEventListener('click', resetConnection);
    els.sendButton?.addEventListener('click', () => {
      const msg = (els.inputText?.value || '').trim();
      if (!msg) return;
      // Echo locally as a normal chat for now (stub)
      sendChatMessage({ chatname: 'you', chatmessage: msg });
      sendMessage(msg);
      els.inputText.value = '';
    });
  }

  try { init(); } catch (e) { console.error(e); }
})();

