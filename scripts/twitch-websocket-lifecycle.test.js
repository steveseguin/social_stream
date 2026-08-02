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
        tmiSayCalls: 0,
        runtimeMessages: [],
        runtimeDeletes: [],
        failFirstSubscription: true
      };
      window.__twitchHarness = harness;

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

        async connect() {
          this.emit('connected', 'irc.test', 443);
          return true;
        }

        async disconnect() {
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
          return json({
            data: [{
              message_id: '11111111-2222-4333-8444-555555555555',
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
          addListener() {}
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

    await page.fill('#input-text', 'sent through SSN');
    await page.click('#sendmessage');
    await page.waitForFunction(() => (
      window.__twitchHarness.runtimeMessages.some(
        (message) => message.id === '11111111-2222-4333-8444-555555555555'
      )
    ));
    const sentChatResult = await page.evaluate(() => ({
      request: window.__twitchHarness.chatSendRequests[0],
      message: window.__twitchHarness.runtimeMessages.find(
        (item) => item.id === '11111111-2222-4333-8444-555555555555'
      ),
      tmiSayCalls: window.__twitchHarness.tmiSayCalls
    }));
    assert.deepStrictEqual(sentChatResult.request, {
      broadcaster_id: '1',
      sender_id: '1',
      message: 'sent through SSN'
    });
    assert.strictEqual(sentChatResult.message.chatname, 'Tester');
    assert.strictEqual(sentChatResult.message.chatmessage, 'sent through SSN');
    assert.strictEqual(sentChatResult.tmiSayCalls, 0, 'SSN sent Twitch chat through IRC instead of Helix');

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
      ['b'.repeat(500), '😀'],
      'Twitch message splitting corrupted the emoji after the 500-character boundary'
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
