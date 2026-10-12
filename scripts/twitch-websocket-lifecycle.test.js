#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..');

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relativePath = pathname.replace(/^\/+/, '') || 'sources/websocket/twitch.html';
      const filePath = path.resolve(repoRoot, relativePath);
      if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(404).end('Not found');
          return;
        }
        const extension = path.extname(filePath);
        const contentType = extension === '.html'
          ? 'text/html; charset=utf-8'
          : extension === '.js'
            ? 'text/javascript; charset=utf-8'
            : 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        response.end(data);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function emitTmiEcho(page, responseIndex, message, event = 'chat') {
  await page.evaluate(({ responseIndex, message, event }) => {
    const harness = window.__twitchHarness;
    const client = harness.tmiClients[harness.tmiClients.length - 1];
    client.emit(
      event,
      '#tester',
      {
        ...client.userstate['#tester'],
        id: harness.chatSendResponses[responseIndex].messageId,
        'message-type': event,
        'tmi-sent-ts': String(Date.now())
      },
      message,
      false
    );
  }, { responseIndex, message, event });
}

async function run() {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  const pageLogs = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => pageLogs.push(`${message.type()}: ${message.text()}`));

  try {
    await page.addInitScript(() => {
      const harness = {
        eventSockets: [],
        tmiClients: [],
        refreshCalls: 0,
        refreshMode: 'network-once',
        validateExpiresIn: 3600,
        subscriptionCalls: 0,
        subscriptionTypes: [],
        chatSendRequests: [],
        chatSendResponses: [],
        deferChatSend: false,
        rejectNextChatSend: false,
        rejectChatSendAtRequest: 0,
        hangNextChatSend: false,
        pendingChatSendResolvers: [],
        deferNextJoin: true,
        pendingJoinClients: [],
        tmiSayCalls: 0,
        runtimeMessages: [],
        runtimeDeletes: [],
        runtimeMessageListeners: [],
        failFirstSubscription: true
      };
      window.__twitchHarness = harness;
      window.__SSAPP_TWITCH_CHAT_SEND_TIMEOUT_MS__ = 150;
      window.__SSAPP_TWITCH_CHAT_ECHO_TIMEOUT_MS__ = 250;

      const nativeSetInterval = window.setInterval.bind(window);
      window.setInterval = (handler, delay, ...args) => {
        return nativeSetInterval(handler, delay === 300000 ? 50 : delay, ...args);
      };
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (handler, delay, ...args) => {
        return nativeSetTimeout(handler, delay === 30000 ? 75 : delay, ...args);
      };

      class FakeTmiClient {
        constructor() {
          this.handlers = new Map();
          this.joinedChannels = [];
          this.userstate = {
            '#tester': {
              username: 'tester',
              'display-name': 'Tester',
              color: '#9146FF',
              badges: { broadcaster: '1' }
            }
          };
          harness.tmiClients.push(this);
        }

        on(event, handler) {
          if (!this.handlers.has(event)) this.handlers.set(event, new Set());
          this.handlers.get(event).add(handler);
        }

        removeListener(event, handler) {
          this.handlers.get(event)?.delete(handler);
        }

        removeAllListeners() {
          this.handlers.clear();
        }

        emit(event, ...args) {
          for (const handler of this.handlers.get(event) || []) handler(...args);
        }

        completeJoin() {
          if (this.joinedChannels.includes('#tester')) return;
          this.joinedChannels.push('#tester');
          this.emit('join', '#tester', 'tester', true);
        }

        getChannels() {
          return [...this.joinedChannels];
        }

        async connect() {
          this.emit('connected', 'irc.test', 443);
          if (harness.deferNextJoin) {
            harness.deferNextJoin = false;
            harness.pendingJoinClients.push(this);
          } else {
            this.completeJoin();
          }
          return true;
        }

        async disconnect() {
          this.joinedChannels = [];
          return true;
        }

        async say() {
          harness.tmiSayCalls += 1;
          return true;
        }
      }

      window.tmi = { Client: FakeTmiClient };

      class FakeWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url) {
          this.url = String(url);
          this.readyState = FakeWebSocket.CONNECTING;
          this.closeCalls = 0;
          harness.eventSockets.push(this);
          queueMicrotask(() => {
            if (this.readyState !== FakeWebSocket.CONNECTING) return;
            this.readyState = FakeWebSocket.OPEN;
            this.onopen?.({ target: this });
          });
        }

        send() {}

        close() {
          if (this.readyState === FakeWebSocket.CLOSED) return;
          this.closeCalls += 1;
          this.readyState = FakeWebSocket.CLOSED;
          queueMicrotask(() => this.onclose?.({ target: this }));
        }

        emitMessage(message) {
          this.onmessage?.({ data: JSON.stringify(message), target: this });
        }
      }

      window.WebSocket = FakeWebSocket;

      function json(body, status = 200) {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      window.fetch = async (input, init = {}) => {
        const url = String(typeof input === 'string' ? input : input?.url || '');
        if (url.includes('id.twitch.tv/oauth2/validate')) {
          const authorization = new Headers(init.headers || {}).get('Authorization') || '';
          if (authorization.includes('expired-token')) return json({ status: 401 }, 401);
          return json({
            client_id: 'test-client',
            login: 'tester',
            user_id: '1',
            expires_in: harness.validateExpiresIn,
            scopes: [
              'chat:read',
              'chat:edit',
              'user:write:chat',
              'bits:read',
              'moderator:read:followers',
              'channel:read:subscriptions',
              'channel:read:hype_train',
              'channel:moderate',
              'channel:read:ads',
              'channel:manage:ads',
              'channel:read:redemptions'
            ]
          });
        }
        if (url.includes('sso.socialstream.ninja/auth/twitch/refresh')) {
          harness.refreshCalls += 1;
          if (harness.refreshMode === 'network' || (harness.refreshMode === 'network-once' && harness.refreshCalls === 1)) {
            throw new TypeError('simulated network failure');
          }
          return json({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            scope: ['chat:read', 'chat:edit', 'user:write:chat'],
            client_id: 'test-client'
          });
        }
        if (url.includes('/helix/users?')) {
          return json({ data: [{ id: '1', login: 'tester', display_name: 'Tester', profile_image_url: '' }] });
        }
        if (url.includes('/helix/moderation/moderators')) return json({ data: [] });
        if (url.includes('/helix/channels?')) return json({ data: [{ broadcaster_type: 'affiliate' }] });
        if (url.includes('/helix/chat/badges')) return json({ data: [] });
        if (url.includes('/helix/chat/messages')) {
          const body = JSON.parse(init.body || '{}');
          harness.chatSendRequests.push(body);
          const requestNumber = harness.chatSendRequests.length;
          const messageId = requestNumber === 1
            ? '11111111-2222-4333-8444-555555555555'
            : `11111111-2222-4333-8444-${String(requestNumber).padStart(12, '0')}`;
          harness.chatSendResponses.push({ messageId });
          if (harness.hangNextChatSend) {
            harness.hangNextChatSend = false;
            return await new Promise((resolve, reject) => {
              const signal = init.signal;
              const abort = () => reject(new DOMException('Aborted', 'AbortError'));
              if (signal?.aborted) abort();
              else signal?.addEventListener('abort', abort, { once: true });
            });
          }
          if (harness.rejectNextChatSend || harness.rejectChatSendAtRequest === requestNumber) {
            harness.rejectNextChatSend = false;
            harness.rejectChatSendAtRequest = 0;
            return json({ message: 'simulated Twitch rejection' }, 400);
          }
          if (harness.deferChatSend) {
            await new Promise((resolve) => harness.pendingChatSendResolvers.push(resolve));
          }
          return json({
            data: [{
              message_id: messageId,
              is_sent: true,
              drop_reason: null
            }]
          });
        }
        if (url.includes('/helix/eventsub/subscriptions')) {
          harness.subscriptionCalls += 1;
          const subscription = JSON.parse(init.body || '{}');
          harness.subscriptionTypes.push(subscription.type || '');
          if (harness.failFirstSubscription) {
            harness.failFirstSubscription = false;
            return json({ message: 'missing optional permission' }, 403);
          }
          return json({ data: [{ id: `subscription-${harness.subscriptionCalls}` }] }, 202);
        }
        if (url.includes('/helix/channels/followers')) return json({ data: [], total: 0 });
        if (url.includes('/helix/subscriptions')) return json({ data: [], total: 0 });
        if (url.includes('/helix/streams')) return json({ data: [] });
        return json({ data: [] });
      };

      const runtime = {
        id: 'twitch-lifecycle-test',
        lastError: null,
        onMessage: {
          addListener(listener) {
            harness.runtimeMessageListeners.push(listener);
          }
        },
        sendMessage(...args) {
          const message = args.find((value) => value && typeof value === 'object');
          const callback = [...args].reverse().find((value) => typeof value === 'function');
          if (message?.message) harness.runtimeMessages.push(message.message);
          if (message?.delete) harness.runtimeDeletes.push(message.delete);
          queueMicrotask(() => {
            if (message?.getSettings) callback?.({ settings: {}, state: true });
            else callback?.({});
          });
        }
      };
      try {
        Object.defineProperty(window.chrome, 'runtime', { value: runtime, configurable: true });
      } catch (_) {
        window.chrome = { runtime };
      }
    });

    await page.goto(`${origin}/sources/websocket/twitch.html?channel=tester`);
    await page.evaluate(() => {
      localStorage.setItem('twitchOAuthToken', 'expired-token');
      localStorage.setItem('twitchOAuthRefreshToken', 'original-refresh-token');
      localStorage.setItem('twitchOAuthExpiry', String(Date.now() + 3600000));
      localStorage.setItem('twitchChannel', 'tester');
    });
    await page.addScriptTag({ url: `${origin}/sources/websocket/twitch.js` });

    await page.waitForFunction(() => window.__twitchHarness.pendingJoinClients.length === 1);
    assert.deepStrictEqual(
      await page.evaluate(() => ({
        readyState: window.websocket.readyState,
        buttonDisabled: document.getElementById('sendmessage').disabled,
        connected: document.getElementById('sendmessage').dataset.chatConnected,
        status: document.getElementById('send-status').textContent
      })),
      {
        readyState: 0,
        buttonDisabled: true,
        connected: 'false',
        status: 'Joining Twitch chat — sending unavailable.'
      },
      'Twitch composer became available before the IRC channel JOIN completed'
    );
    await page.evaluate(() => {
      window.__twitchHarness.pendingJoinClients.shift().completeJoin();
    });
    await page.waitForFunction(() => (
      window.websocket.readyState === 1
      && !document.getElementById('sendmessage').disabled
      && document.getElementById('sendmessage').dataset.chatConnected === 'true'
    ));

    try {
      await page.waitForFunction(() => window.__twitchHarness.eventSockets.length === 1, null, { timeout: 10000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        eventSockets: window.__twitchHarness.eventSockets.length,
        tmiClients: window.__twitchHarness.tmiClients.length,
        storedToken: localStorage.getItem('twitchOAuthToken'),
        authVisible: !document.querySelector('.auth')?.classList.contains('hidden'),
        socketVisible: !document.querySelector('.socket')?.classList.contains('hidden')
      }));
      throw new Error(`${error.message}\nState: ${JSON.stringify(state)}\nLogs:\n${pageLogs.join('\n')}`);
    }
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.refreshCalls),
      2,
      'Twitch startup did not retry a transient token refresh failure'
    );
    assert.strictEqual(
      await page.evaluate(() => localStorage.getItem('twitchOAuthToken')),
      'new-access-token',
      'Twitch startup retry did not persist the refreshed access token'
    );
    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[0].emitMessage({
        metadata: { message_type: 'session_welcome' },
        payload: { session: { id: 'session-1', keepalive_timeout_seconds: 10 } }
      });
    });
    await page.waitForFunction(() => window.__twitchHarness.subscriptionCalls > 0);
    await page.waitForFunction(() => window.__twitchHarness.subscriptionTypes.includes('channel.bits.use'));
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.subscriptionTypes.includes('channel.cheer')),
      false,
      'EventSub should use channel.bits.use instead of the duplicate channel.cheer subscription'
    );

    assert.deepStrictEqual(
      await page.evaluate(() => ({
        logRole: document.getElementById('textarea').getAttribute('role'),
        logLive: document.getElementById('textarea').getAttribute('aria-live'),
        inputLabel: document.querySelector('label[for="input-text"]')?.textContent,
        inputDescription: document.getElementById('input-text').getAttribute('aria-describedby'),
        buttonType: document.getElementById('sendmessage').getAttribute('type'),
        statusRole: document.getElementById('send-status').getAttribute('role'),
        statusLive: document.getElementById('send-status').getAttribute('aria-live')
      })),
      {
        logRole: 'log',
        logLive: 'polite',
        inputLabel: 'Chat message',
        inputDescription: 'send-status',
        buttonType: 'button',
        statusRole: 'status',
        statusLive: 'polite'
      },
      'Twitch chat composer accessibility metadata is incomplete'
    );

    const imeStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', 'unfinished IME composition');
    await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        cancelable: true,
        bubbles: true
      });
      document.getElementById('input-text').dispatchEvent(event);
      window.__twitchHarness.imeEnterDefaultPrevented = event.defaultPrevented;
    });
    await page.waitForTimeout(100);
    assert.deepStrictEqual(
      await page.evaluate(() => ({
        requests: window.__twitchHarness.chatSendRequests.length,
        draft: document.getElementById('input-text').value,
        defaultPrevented: window.__twitchHarness.imeEnterDefaultPrevented
      })),
      { requests: imeStart, draft: 'unfinished IME composition', defaultPrevented: false },
      'Enter sent a Twitch message while an IME composition was active'
    );

    await page.fill('#input-text', 'sent through SSN');
    await page.click('#sendmessage');
    await page.waitForFunction(() => window.__twitchHarness.chatSendResponses.length > 0);
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.runtimeMessages.filter(
        (message) => message.chatmessage === 'sent through SSN'
      ).length),
      0,
      'SSN created a local chat copy before Twitch echoed the accepted message'
    );
    await emitTmiEcho(page, 0, 'sent through SSN');
    await page.waitForFunction(() => (
      window.__twitchHarness.runtimeMessages.some(
        (message) => message.id === '11111111-2222-4333-8444-555555555555'
      )
    ));
    await page.waitForTimeout(250);
    const sentChatResult = await page.evaluate(() => ({
      request: window.__twitchHarness.chatSendRequests[0],
      message: window.__twitchHarness.runtimeMessages.find(
        (item) => item.id === '11111111-2222-4333-8444-555555555555'
      ),
      matchingMessages: window.__twitchHarness.runtimeMessages.filter(
        (item) => item.id === '11111111-2222-4333-8444-555555555555'
      ).length,
      matchingRows: [...document.querySelectorAll('#textarea > div')].filter(
        (row) => row.textContent.includes('Tester: sent through SSN')
      ).length,
      tmiSayCalls: window.__twitchHarness.tmiSayCalls
    }));
    assert.deepStrictEqual(sentChatResult.request, {
      broadcaster_id: '1',
      sender_id: '1',
      message: 'sent through SSN'
    });
    assert.strictEqual(sentChatResult.message.chatname, 'Tester');
    assert.strictEqual(sentChatResult.message.chatmessage, 'sent through SSN');
    assert.strictEqual(sentChatResult.matchingMessages, 1, 'Twitch socket echo was relayed more than once');
    assert.strictEqual(sentChatResult.matchingRows, 1, 'Twitch socket echo was rendered more than once');
    assert.strictEqual(sentChatResult.tmiSayCalls, 0, 'SSN sent Twitch chat through IRC instead of Helix');

    const inFlightStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.evaluate(() => {
      window.__twitchHarness.deferChatSend = true;
    });
    await page.fill('#input-text', 'single in-flight send');
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendRequests.length > minimum,
      inFlightStart
    );
    assert.deepStrictEqual(
      await page.evaluate(() => ({
        buttonDisabled: document.getElementById('sendmessage').disabled,
        buttonText: document.getElementById('sendmessage').textContent,
        inputReadOnly: document.getElementById('input-text').readOnly,
        status: document.getElementById('send-status').textContent
      })),
      {
        buttonDisabled: true,
        buttonText: 'Sending…',
        inputReadOnly: true,
        status: 'Sending…'
      },
      'Twitch composer did not expose and lock the in-flight send state'
    );
    await page.evaluate(() => {
      document.getElementById('input-text').dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      }));
    });
    await page.waitForTimeout(100);
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.chatSendRequests.length),
      inFlightStart + 1,
      'A second Enter keypress created an overlapping Twitch send'
    );
    await page.evaluate(() => {
      const harness = window.__twitchHarness;
      harness.deferChatSend = false;
      harness.pendingChatSendResolvers.splice(0).forEach(resolve => resolve());
    });
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendResponses.length > minimum,
      inFlightStart
    );
    await emitTmiEcho(page, inFlightStart, 'single in-flight send');
    await page.waitForFunction(() => (
      !document.getElementById('sendmessage').disabled
      && document.activeElement === document.getElementById('input-text')
      && document.getElementById('send-status').textContent === 'Sent and received from Twitch.'
    ));

    const rejectedStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.evaluate(() => {
      window.__twitchHarness.rejectNextChatSend = true;
    });
    await page.fill('#input-text', 'keep this failed draft');
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => (
        window.__twitchHarness.chatSendRequests.length > minimum
        && document.getElementById('send-status').dataset.state === 'error'
        && !document.getElementById('sendmessage').disabled
      ),
      rejectedStart
    );
    assert.deepStrictEqual(
      await page.evaluate(() => ({
        draft: document.getElementById('input-text').value,
        focused: document.activeElement === document.getElementById('input-text'),
        status: document.getElementById('send-status').textContent,
        matchingMessages: window.__twitchHarness.runtimeMessages.filter(
          message => message.chatmessage === 'keep this failed draft'
        ).length
      })),
      {
        draft: 'keep this failed draft',
        focused: true,
        status: 'simulated Twitch rejection',
        matchingMessages: 0
      },
      'A failed Twitch send did not preserve the draft and expose the error'
    );

    const partialMessage = 'q'.repeat(500) + 'r'.repeat(10);
    const partialStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.evaluate((rejectedRequestNumber) => {
      window.__twitchHarness.rejectChatSendAtRequest = rejectedRequestNumber;
    }, partialStart + 2);
    await page.fill('#input-text', partialMessage);
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => (
        window.__twitchHarness.chatSendRequests.length >= minimum + 2
        && document.getElementById('send-status').dataset.state === 'warning'
        && !document.getElementById('sendmessage').disabled
      ),
      partialStart
    );
    assert.deepStrictEqual(
      await page.evaluate((firstResponseIndex) => ({
        draft: document.getElementById('input-text').value,
        status: document.getElementById('send-status').textContent,
        firstChunkLocalCopies: window.__twitchHarness.runtimeMessages.filter(
          message => message.id === window.__twitchHarness.chatSendResponses[firstResponseIndex].messageId
        ).length
      }), partialStart),
      {
        draft: 'r'.repeat(10),
        status: '1 of 2 parts was accepted by Twitch. Only the unsent remainder was kept. simulated Twitch rejection',
        firstChunkLocalCopies: 0
      },
      'A partial Twitch send did not retain only the unsent remainder'
    );
    await emitTmiEcho(page, partialStart, 'q'.repeat(500));
    await page.waitForFunction((responseIndex) => {
      const id = window.__twitchHarness.chatSendResponses[responseIndex].messageId;
      return window.__twitchHarness.runtimeMessages.filter(message => message.id === id).length === 1;
    }, partialStart);

    const timeoutMessage = 'keep this unknown-delivery draft';
    const timeoutStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.evaluate(() => {
      window.__twitchHarness.hangNextChatSend = true;
    });
    await page.fill('#input-text', timeoutMessage);
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => (
        window.__twitchHarness.chatSendRequests.length > minimum
        && document.getElementById('send-status').dataset.state === 'warning'
        && document.getElementById('send-status').textContent.includes('Delivery is unknown')
        && !document.getElementById('sendmessage').disabled
      ),
      timeoutStart
    );
    assert.deepStrictEqual(
      await page.evaluate((text) => ({
        draft: document.getElementById('input-text').value,
        matchingMessages: window.__twitchHarness.runtimeMessages.filter(
          message => message.chatmessage === text
        ).length
      }), timeoutMessage),
      { draft: timeoutMessage, matchingMessages: 0 },
      'An unconfirmed Twitch send did not preserve the draft with unknown-delivery guidance'
    );

    const repeatedMessage = 'repeat this exact message';
    const repeatedStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    for (let index = 0; index < 2; index += 1) {
      const responseIndex = repeatedStart + index;
      await page.fill('#input-text', repeatedMessage);
      await page.click('#sendmessage');
      await page.waitForFunction(
        (minimum) => window.__twitchHarness.chatSendResponses.length > minimum,
        responseIndex
      );
      await page.waitForFunction(() => !document.getElementById('sendmessage').disabled);
      await emitTmiEcho(page, responseIndex, repeatedMessage);
    }
    await page.waitForFunction(
      ({ start, expected }) => window.__twitchHarness.chatSendResponses
        .slice(start, start + expected)
        .every(response => window.__twitchHarness.runtimeMessages.some(
          message => message.id === response.messageId
        )),
      { start: repeatedStart, expected: 2 }
    );
    await page.waitForTimeout(250);
    assert.deepStrictEqual(
      await page.evaluate(({ start, text }) => {
        const ids = window.__twitchHarness.chatSendResponses.slice(start, start + 2).map(item => item.messageId);
        return {
          matchingMessages: window.__twitchHarness.runtimeMessages.filter(message => ids.includes(message.id)).length,
          matchingRows: [...document.querySelectorAll('#textarea > div')].filter(
            row => row.textContent.includes(`Tester: ${text}`)
          ).length
        };
      }, { start: repeatedStart, text: repeatedMessage }),
      { matchingMessages: 2, matchingRows: 2 },
      'Two legitimate identical Twitch messages were collapsed or duplicated'
    );

    const unicodeBoundaryMessage = 'a'.repeat(499) + '😀';
    const unicodeBoundaryStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', unicodeBoundaryMessage);
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendRequests.length >= minimum,
      unicodeBoundaryStart + 1
    );
    await page.waitForTimeout(500);
    assert.deepStrictEqual(
      await page.evaluate((start) => (
        window.__twitchHarness.chatSendRequests.slice(start).map((request) => request.message)
      ), unicodeBoundaryStart),
      [unicodeBoundaryMessage],
      'A valid 500-character Twitch message was split at an emoji boundary'
    );

    const overLimitMessage = 'b'.repeat(500) + '😀';
    const overLimitChunks = ['b'.repeat(500), '😀'];
    const overLimitStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', overLimitMessage);
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendRequests.length >= minimum,
      overLimitStart + 2
    );
    assert.deepStrictEqual(
      await page.evaluate((start) => (
        window.__twitchHarness.chatSendRequests.slice(start).map((request) => request.message)
      ), overLimitStart),
      overLimitChunks,
      'Twitch message splitting corrupted the emoji after the 500-character boundary'
    );
    for (let index = 0; index < overLimitChunks.length; index += 1) {
      await emitTmiEcho(page, overLimitStart + index, overLimitChunks[index]);
    }
    await page.waitForFunction(
      ({ start, expected }) => window.__twitchHarness.chatSendResponses
        .slice(start, start + expected)
        .every(response => window.__twitchHarness.runtimeMessages.some(
          message => message.id === response.messageId
        )),
      { start: overLimitStart, expected: overLimitChunks.length }
    );
    await page.waitForTimeout(250);
    assert.strictEqual(
      await page.evaluate(({ start, expected }) => {
        const ids = window.__twitchHarness.chatSendResponses.slice(start, start + expected).map(item => item.messageId);
        return window.__twitchHarness.runtimeMessages.filter(message => ids.includes(message.id)).length;
      }, { start: overLimitStart, expected: overLimitChunks.length }),
      overLimitChunks.length,
      'A split Twitch message chunk was relayed more than once'
    );

    const actionStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', '/me waves');
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendResponses.length > minimum,
      actionStart
    );
    await emitTmiEcho(page, actionStart, 'waves', 'action');
    await page.waitForFunction(() => (
      window.__twitchHarness.runtimeMessages.some(
        (message) => message.event === 'action' && message.chatmessage === 'waves'
      )
    ));
    await page.waitForTimeout(250);
    const actionResult = await page.evaluate((start) => ({
      request: window.__twitchHarness.chatSendRequests[start],
      message: window.__twitchHarness.runtimeMessages.find(
        (item) => item.event === 'action' && item.chatmessage === 'waves'
      ),
      matchingMessages: window.__twitchHarness.runtimeMessages.filter(
        (item) => item.id === window.__twitchHarness.chatSendResponses[start].messageId
      ).length
    }), actionStart);
    assert.strictEqual(actionResult.request.message, '/me waves');
    assert.strictEqual(actionResult.message.chatmessage, 'waves');
    assert.strictEqual(actionResult.message.event, 'action');
    assert.strictEqual(actionResult.matchingMessages, 1, 'Twitch /me echo was relayed more than once');

    const longActionBody = 'z'.repeat(700);
    const longActionChunks = [
      '/me ' + 'z'.repeat(496),
      '/me ' + 'z'.repeat(204)
    ];
    const longActionStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', '/me ' + longActionBody);
    await page.click('#sendmessage');
    await page.waitForFunction(
      ({ start, expected }) => window.__twitchHarness.chatSendRequests.length >= start + expected,
      { start: longActionStart, expected: longActionChunks.length }
    );
    assert.deepStrictEqual(
      await page.evaluate((start) => (
        window.__twitchHarness.chatSendRequests.slice(start).map(request => request.message)
      ), longActionStart),
      longActionChunks,
      'Long Twitch /me action chunks did not each retain action semantics'
    );
    assert.ok(
      longActionChunks.every(chunk => Array.from(chunk).length <= 500),
      'Long Twitch /me action chunk exceeded the 500-character limit'
    );
    for (let index = 0; index < longActionChunks.length; index += 1) {
      await emitTmiEcho(page, longActionStart + index, longActionChunks[index].slice(4), 'action');
    }
    await page.waitForFunction(
      ({ start, expected }) => window.__twitchHarness.chatSendResponses
        .slice(start, start + expected)
        .every(response => window.__twitchHarness.runtimeMessages.some(
          message => message.id === response.messageId && message.event === 'action'
        )),
      { start: longActionStart, expected: longActionChunks.length }
    );
    await page.waitForTimeout(250);
    assert.strictEqual(
      await page.evaluate(({ start, expected }) => {
        const ids = window.__twitchHarness.chatSendResponses.slice(start, start + expected).map(item => item.messageId);
        return window.__twitchHarness.runtimeMessages.filter(
          message => ids.includes(message.id) && message.event === 'action'
        ).length;
      }, { start: longActionStart, expected: longActionChunks.length }),
      longActionChunks.length,
      'A split Twitch /me echo was relayed more than once'
    );

    await page.evaluate(() => {
      window.__twitchHarness.tmiClients[0].emit(
        'messagedeleted',
        '#tester',
        'tester',
        'sent through SSN',
        { 'target-msg-id': '11111111-2222-4333-8444-555555555555' }
      );
    });
    await page.waitForFunction(() => window.__twitchHarness.runtimeDeletes.length > 0);
    assert.deepStrictEqual(
      await page.evaluate(() => window.__twitchHarness.runtimeDeletes[0]),
      {
        type: 'twitch',
        id: '11111111-2222-4333-8444-555555555555',
        chatname: 'Tester'
      },
      'Twitch delete did not reuse the native ID assigned to the SSN-sent message'
    );

    const chatClientsBeforeReconnect = await page.evaluate(() => window.__twitchHarness.tmiClients.length);
    await page.evaluate(() => {
      const harness = window.__twitchHarness;
      harness.deferChatSend = true;
      harness.deferNextJoin = true;
    });
    const inFlightDisconnectStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', 'accepted while IRC disconnects');
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendRequests.length > minimum,
      inFlightDisconnectStart
    );
    await page.evaluate(() => {
      const harness = window.__twitchHarness;
      harness.tmiClients[harness.tmiClients.length - 1].emit('disconnected', 'simulated reconnect');
      harness.deferChatSend = false;
      harness.pendingChatSendResolvers.splice(0).forEach(resolve => resolve());
    });
    await page.waitForFunction(() => (
      document.getElementById('sendmessage').disabled
      && document.getElementById('send-status').textContent === 'Accepted by Twitch; waiting for chat echo…'
    ));
    assert.strictEqual(
      await page.evaluate((text) => window.__twitchHarness.runtimeMessages.filter(
        message => message.chatmessage === text
      ).length, 'accepted while IRC disconnects'),
      0,
      'An accepted message created a local copy after IRC disconnected in flight'
    );
    await page.waitForFunction(() => (
      document.getElementById('send-status').textContent
        === 'Accepted by Twitch, but the chat echo was not received locally.'
    ));

    await page.waitForFunction(
      (minimum) => (
        window.__twitchHarness.tmiClients.length > minimum
        && window.__twitchHarness.pendingJoinClients.length === 1
        && document.getElementById('sendmessage').disabled
        && document.getElementById('send-status').textContent.includes('Joining Twitch chat')
      ),
      chatClientsBeforeReconnect,
      { timeout: 5000 }
    );
    const requestsBeforeDisconnectSend = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    const disconnectedRuntimeAck = await page.evaluate(async () => {
      const harness = window.__twitchHarness;
      const listener = harness.runtimeMessageListeners[0];
      return await new Promise(resolve => {
        listener({ type: 'SEND_MESSAGE', message: 'runtime send must fail while joining' }, {}, resolve);
      });
    });
    await page.evaluate(() => {
      window.websocket.send('PRIVMSG #tester :must not send while disconnected');
    });
    await page.waitForTimeout(250);
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.chatSendRequests.length),
      requestsBeforeDisconnectSend,
      'Twitch accepted a send while its chat receive socket was disconnected'
    );
    assert.strictEqual(
      disconnectedRuntimeAck,
      false,
      'Runtime SEND_MESSAGE acknowledged a message that was blocked while IRC was joining'
    );
    await page.evaluate(() => {
      window.__twitchHarness.pendingJoinClients.shift().completeJoin();
    });
    await page.waitForFunction(() => !document.getElementById('sendmessage').disabled);

    const postReconnectStart = await page.evaluate(() => window.__twitchHarness.chatSendRequests.length);
    await page.fill('#input-text', 'sent after reconnect');
    await page.click('#sendmessage');
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.chatSendResponses.length > minimum,
      postReconnectStart
    );
    await page.waitForFunction(() => !document.getElementById('sendmessage').disabled);
    await emitTmiEcho(page, postReconnectStart, 'sent after reconnect');
    await page.waitForFunction(
      (responseIndex) => {
        const id = window.__twitchHarness.chatSendResponses[responseIndex].messageId;
        return window.__twitchHarness.runtimeMessages.some(message => message.id === id);
      },
      postReconnectStart
    );
    await page.waitForTimeout(250);
    assert.strictEqual(
      await page.evaluate((responseIndex) => {
        const id = window.__twitchHarness.chatSendResponses[responseIndex].messageId;
        return window.__twitchHarness.runtimeMessages.filter(message => message.id === id).length;
      }, postReconnectStart),
      1,
      'The first Twitch message after reconnect was not relayed exactly once'
    );

    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[0].emitMessage({
        metadata: { message_type: 'notification' },
        payload: {
          subscription: { type: 'channel.bits.use' },
          event: {
            broadcaster_user_id: '1',
            broadcaster_user_login: 'tester',
            broadcaster_user_name: 'Tester',
            user_id: '2',
            user_login: 'kibathebarbarian',
            user_name: 'KibaTheBarbarian',
            bits: 150,
            type: 'custom_power_up',
            message: { text: 'extra hot please', fragments: [] },
            custom_power_up: {
              title: 'Additional Hot Beans',
              reward_id: 'power-up-1'
            }
          }
        }
      });
    });
    await page.waitForFunction(() => window.__twitchHarness.runtimeMessages.some((message) => message.event === 'powerup'));
    const powerUpResult = await page.evaluate(() => {
      const message = window.__twitchHarness.runtimeMessages.find((item) => item.event === 'powerup');
      return {
        message,
        recentEvent: document.querySelector('#events-list .event-item')?.textContent || '',
        localChat: document.querySelector('#textarea')?.textContent || ''
      };
    });
    assert.strictEqual(powerUpResult.message.chatmessage, '');
    assert.strictEqual('hasDonation' in powerUpResult.message, false);
    assert.strictEqual(powerUpResult.message.meta.bits, 150);
    assert.strictEqual(powerUpResult.message.meta.powerUp.type, 'custom_power_up');
    assert.strictEqual(powerUpResult.message.meta.powerUp.title, 'Additional Hot Beans');
    assert.strictEqual(powerUpResult.message.meta.powerUp.rewardId, 'power-up-1');
    assert.strictEqual(powerUpResult.message.meta.powerUp.messageText, 'extra hot please');
    assert.strictEqual(powerUpResult.recentEvent, 'Power-up: KibaTheBarbarian used Additional Hot Beans (150 bits)');
    assert.strictEqual(powerUpResult.localChat.includes('Additional Hot Beans'), false);

    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[0].emitMessage({
        metadata: { message_type: 'notification' },
        payload: {
          subscription: { type: 'channel.bits.use' },
          event: {
            user_id: '2',
            user_login: 'kibathebarbarian',
            user_name: 'KibaTheBarbarian',
            bits: 100,
            type: 'cheer',
            message: { text: 'Cheer100 nice', fragments: [] }
          }
        }
      });
    });
    await page.waitForFunction(() => window.__twitchHarness.runtimeMessages.some((message) => message.event === 'cheer'));
    const cheerResult = await page.evaluate(() => window.__twitchHarness.runtimeMessages.find((message) => message.event === 'cheer'));
    assert.strictEqual(cheerResult.chatmessage, 'Cheer100 nice');
    assert.strictEqual(cheerResult.hasDonation, '100 bits');
    assert.strictEqual(
      cheerResult.chatimg,
      'https://api.socialstream.ninja/twitch/large?username=kibathebarbarian',
      'Twitch EventSub cheer did not include the cheering user avatar'
    );

    await page.evaluate(() => window.__twitchHarness.eventSockets[0].close());
    await page.waitForFunction(() => window.__twitchHarness.eventSockets.length === 2, null, { timeout: 4000 });

    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[1].emitMessage({
        metadata: { message_type: 'session_welcome' },
        payload: { session: { id: 'session-2', keepalive_timeout_seconds: 10 } }
      });
    });
    await page.waitForTimeout(100);
    const subscriptionsBeforeTransfer = await page.evaluate(() => window.__twitchHarness.subscriptionCalls);

    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[1].emitMessage({
        metadata: { message_type: 'session_reconnect' },
        payload: { session: { reconnect_url: 'wss://eventsub.test/reconnect' } }
      });
    });
    await page.waitForFunction(() => window.__twitchHarness.eventSockets.length === 3);
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.eventSockets[1].closeCalls),
      0,
      'EventSub closed the original socket before the replacement welcome'
    );

    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[2].emitMessage({
        metadata: { message_type: 'session_welcome' },
        payload: { session: { id: 'session-3', keepalive_timeout_seconds: 0.05 } }
      });
    });
    await page.waitForFunction(() => window.__twitchHarness.eventSockets[1].closeCalls === 1);
    await page.waitForTimeout(100);
    assert.strictEqual(
      await page.evaluate(() => window.__twitchHarness.subscriptionCalls),
      subscriptionsBeforeTransfer,
      'EventSub recreated subscriptions during a Twitch-requested hand-off'
    );

    await page.waitForFunction(() => window.__twitchHarness.eventSockets.length === 4, null, { timeout: 8000 });
    await page.evaluate(() => {
      window.__twitchHarness.eventSockets[3].emitMessage({
        metadata: { message_type: 'session_welcome' },
        payload: { session: { id: 'session-4', keepalive_timeout_seconds: 10 } }
      });
    });
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.subscriptionCalls > minimum,
      subscriptionsBeforeTransfer
    );

    const refreshCallsBeforeFailure = await page.evaluate(() => window.__twitchHarness.refreshCalls);
    const connectionsBeforeActiveRefresh = await page.evaluate(() => ({
      tmiClients: window.__twitchHarness.tmiClients.length,
      eventSockets: window.__twitchHarness.eventSockets.length
    }));
    await page.evaluate(() => {
      window.__twitchHarness.refreshMode = 'network';
      localStorage.setItem('twitchOAuthToken', 'expired-token');
      sessionStorage.setItem('twitchOAuthToken', 'expired-token');
    });
    await page.waitForFunction(
      (minimum) => window.__twitchHarness.refreshCalls > minimum,
      refreshCallsBeforeFailure
    );
    const retained = await page.evaluate(() => ({
      accessToken: localStorage.getItem('twitchOAuthToken'),
      refreshToken: localStorage.getItem('twitchOAuthRefreshToken')
    }));
    assert.strictEqual(retained.accessToken, 'expired-token');
    assert.strictEqual(retained.refreshToken, 'new-refresh-token');

    await page.evaluate(() => {
      window.__twitchHarness.refreshMode = 'success';
    });
    await page.waitForFunction(() => localStorage.getItem('twitchOAuthToken') === 'new-access-token');
    await page.waitForTimeout(100);
    assert.deepStrictEqual(
      await page.evaluate(() => ({
        tmiClients: window.__twitchHarness.tmiClients.length,
        eventSockets: window.__twitchHarness.eventSockets.length
      })),
      connectionsBeforeActiveRefresh,
      'A successful token retry must not restart an already active Twitch connection'
    );

    await page.evaluate(() => {
      window.__twitchHarness.validateExpiresIn = 1200;
    });
    await page.waitForFunction(() => document.getElementById('auth-status')?.textContent.includes('Auto-refresh enabled'));
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('.token-expiry-warning')),
      null,
      'Refreshable Twitch auth should not prompt the user to sign in again'
    );

    await page.evaluate(() => {
      localStorage.removeItem('twitchOAuthRefreshToken');
    });
    await page.waitForFunction(() => document.querySelector('.token-expiry-warning'));
    assert.match(
      await page.evaluate(() => document.querySelector('.token-expiry-warning').textContent),
      /Please re-authenticate soon/,
      'Non-refreshable Twitch auth should retain the expiry warning'
    );
    assert.deepStrictEqual(pageErrors, [], `Browser errors: ${pageErrors.join('; ')}`);

    console.log('twitch-websocket-lifecycle.test.js passed');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
