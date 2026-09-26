const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// Execute production functions unchanged, without starting authenticated services.
// Anchors deliberately fail loudly if the source layout changes.
function section(file, start, end) {
  const source = read(file);
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing source anchors: ${file}: ${start}`);
  return source.slice(from, to);
}

async function installRelay(page) {
  await page.addScriptTag({ content: read('libs/objects.js') });
  await page.evaluate(() => {
    window.settings = { server2: true };
    window.__wire = [];
    window.__stored = [];
    window.__targets = [];
    window.__relayErrors = [];
    console.error = (...args) => window.__relayErrors.push(args.map(String).join(' '));
    // Mock I/O and disabled optional services; sanitization and serialization are real.
    window.socketserverDock = { readyState: 1, send: text => window.__wire.push(JSON.parse(text)) };
    window.sendDataToStreamDeckPeersP2P = () => false;
    window.getSettingFlag = key => !!window.settings[key];
    window.captureLiveStatsFromMessage = window.captureBackgroundCreditsMessage = () => {};
    window.isEventBlockedByCustomFilter = () => false;
    window.routeIndividualLikeEvent = () => ({ stop: false });
    window.normalizeEventName = data => String(data.event || '').toLowerCase();
    window.hasTargetedMetaPayload = () => false;
    window.giveawayHost = null;
    window.sendTargetP2P = (data, target) => window.__targets.push({ target, data: JSON.parse(JSON.stringify(data)) });
    window.sendToDisk = window.sendToH2R = window.sendToPost = window.sendToDiscord = window.sendToStreamerBot = () => {};
    window.MS_PER_DAY = 86400000;
    window.addMessageDB = async data => {
      const record = window.__recordFactory.createMessageRecord(data, false);
      record.id = window.__stored.length + 1;
      window.__stored.push(JSON.parse(JSON.stringify(record)));
      return record.id;
    };
  });
  await page.addScriptTag({ content: [
    'window.__recordFactory = { daysToKeep: 30,\n' +
      section('db.js', '    createMessageRecord(', '    async addMigratedMessages(') + '\n};',
    section('background.js', 'function getUserDisplayAliasEntries()', 'function getCommandAliases('),
    section('background.js', 'function sendDataP2P(', 'var users = {};'),
    section('background.js', 'async function sendToDestinations(', 'async function replayMessagesFromTimestamp(')
  ].join('\n') });
  return async payload => {
    const result = await page.evaluate(async payload => {
      window.__wire = []; window.__stored = []; window.__targets = []; window.__relayErrors = [];
      await sendToDestinations(payload);
      return { wire: window.__wire, stored: window.__stored, targets: window.__targets, errors: window.__relayErrors };
    }, payload);
    assert.deepEqual(result.errors, [], 'Relay harness must not swallow production errors');
    assert.equal(result.wire.length, 1, 'Message must actually cross the relay');
    return { payload: result.wire[0], stored: result.stored[0], targets: result.targets };
  };
}

async function captureTwitch(context, textonly, messages) {
  const page = await context.newPage();
  try {
    await page.setContent('<div class="chat-room__content"><div id="messages"><div id="backlog" class="chat-line__message"></div></div></div>');
    await page.evaluate(textonly => {
      window.__captured = [];
      window.fetch = async () => ({ text: async () => '' });
      window.RTCPeerConnection = function () {
        this.addIceCandidate = async () => {};
        this.createDataChannel = () => ({ send() {} });
        this.createOffer = this.createAnswer = async () => ({});
        this.setLocalDescription = async description => { this.localDescription = description; };
        this.setRemoteDescription = async description => { this.remoteDescription = description; };
      };
      window.chrome = { runtime: {
        id: 'security-fixture', lastError: null, onMessage: { addListener() {} },
        sendMessage(id, request, callback) {
          if (request.getSettings) return callback({ state: true, settings: { textonlymode: textonly } });
          if (request.message) window.__captured.push(request.message);
          if (callback) callback({ id: window.__captured.length });
        }
      } };
    }, textonly);
    await page.addScriptTag({ content: read('sources/twitch.js') });
    await page.waitForFunction(() => document.getElementById('backlog').dataset.ignore === 'true', null, { timeout: 6000 });
    for (const [index, message] of messages.entries()) {
      await page.evaluate(message => {
        const row = document.createElement('div');
        row.className = 'chat-line__message';
        row.innerHTML = '<span class="chat-author__display-name">AuditViewer</span><span data-test-selector="chat-line-message-body"></span>';
        row.querySelector('[data-test-selector]').textContent = message;
        document.getElementById('messages').appendChild(row);
      }, message);
      await page.waitForFunction(count => window.__captured.length === count, index + 1, { timeout: 6000 });
    }
    return await page.evaluate(() => window.__captured);
  } finally {
    await page.close();
  }
}

async function configureContext(context, baseUrl) {
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(baseUrl + '/')) return route.continue();
    if (/^https:\/\/vdo\.socialstream\.ninja\//.test(url)) {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local bridge fixture</title>' });
    }
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__securityExecuted = false;
    window.__spoken = [];
    window.__sockets = [];
    // Dock deliberately replaces eval; retain Playwright's evaluation mechanism.
    if (/\/dock\.html$/.test(location.pathname)) {
      Object.defineProperty(window, 'eval', { value: window.eval, configurable: false, writable: false });
    }
    function OfflineSocket(url) {
      this.readyState = 0;
      this.url = url;
      const listeners = [];
      this.send = this.close = this.removeEventListener = function () {};
      this.addEventListener = (event, listener) => { if (event === 'message') listeners.push(listener); };
      this.deliver = payload => {
        const event = { data: JSON.stringify(payload) };
        for (const listener of listeners) listener(event);
        if (this.onmessage) this.onmessage(event);
      };
      window.__sockets.push(this);
    }
    OfflineSocket.OPEN = 1; OfflineSocket.CLOSED = 3; OfflineSocket.CONNECTING = 0;
    window.WebSocket = OfflineSocket;
  });
}

async function providerMessage(page, message, emotes) {
  return page.evaluate(async ({ message, emotes }) => {
    const { createTwitchChatClient, TWITCH_CHAT_EVENTS } = await import('/providers/twitch/chatClient.js');
    const handlers = new Map();
    const client = {
      on(event, handler) { if (!handlers.has(event)) handlers.set(event, []); handlers.get(event).push(handler); },
      removeListener() {}, connect: async () => true, disconnect: async () => true
    };
    const provider = createTwitchChatClient({ channel: 'audit', clientFactory: async () => client, logger: null });
    const messages = [];
    provider.on(TWITCH_CHAT_EVENTS.MESSAGE, payload => messages.push(payload));
    await provider.connect();
    for (const handler of handlers.get('chat') || []) {
      handler('#audit', { username: 'auditviewer', 'display-name': 'AuditViewer', id: 'provider-fixture', emotes }, message, false);
    }
    await provider.disconnect();
    if (messages.length !== 1) throw Error('Real Twitch provider did not emit exactly one message');
    return messages[0];
  }, { message, emotes });
}

async function captureAuction(page, title) {
  await page.evaluate(title => {
    document.body.innerHTML = '<footer class="LivePlayer_livePlayerFooter__UDpaa"><span data-testid="show-winning-status">AuditViewer won!</span><span data-testid="show-product-title"></span><strong>$10.00</strong></footer>';
    document.querySelector('[data-testid="show-product-title"]').textContent = title;
    window.__auctionEvents = [];
    window.pushMessage = data => window.__auctionEvents.push(data);
    window.isExtensionOn = true;
    window.lastAuctionSnapshot = '';
  }, title);
  await page.addScriptTag({ content: [
    section('sources/whatnot.js', '\tfunction normalizeText(value)', '\tfunction findSectionByHeading('),
    section('sources/whatnot.js', '\tfunction sendMetaEvent(eventName, meta)', '\tfunction checkCommerceUpdates(')
  ].join('\n') });
  return page.evaluate(() => { checkAuctionUpdates(); return window.__auctionEvents[0]; });
}

async function deliver(page, payload) {
  const iframe = page.locator('iframe[src*="vdo.socialstream.ninja"]').first();
  await iframe.waitFor({ state: 'attached', timeout: 5000 });
  const handle = await iframe.elementHandle();
  const frame = await handle.contentFrame();
  assert.ok(frame, 'Receiver bridge frame must load');
  await frame.waitForLoadState('domcontentloaded');
  // Real postMessage from the expected window, through the production listener.
  await frame.evaluate(payload => parent.postMessage({ dataReceived: { overlayNinja: payload } }, '*'), payload);
}

module.exports = { read, section, installRelay, captureTwitch, captureAuction, providerMessage, configureContext, deliver };
