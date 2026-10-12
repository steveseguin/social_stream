#!/usr/bin/env node
// Offline API/socket -> real Lite handlers -> publish. CSP deliberately permits
// handlers so security assertions cannot pass merely because CSP blocked them.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createDemoServer } = require('./serve-chat-security-demo.cjs');
const { providerMessage } = require('./helpers/chat-security-harness.cjs');

const probe = 'PREVIEW_PROBE <img src="data:image/png;base64,broken" onerror="window.__probeHits++">';
const literal = 'Hello <b>literal</b> &lt;em&gt; & "chat" 👋 café';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

(async () => {
  const { server, baseUrl } = await createDemoServer();
  let browser;
  const results = [];
  async function check(name, action) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.route('**/*', route => {
        const url = route.request().url();
        if (url === baseUrl + '/__preview-test.html') return route.fulfill({
          contentType: 'text/html', body: '<!doctype html><title>Offline preview test</title>'
        });
        if (url.startsWith(baseUrl + '/')) return route.continue();
        return route.abort();
      });
      await page.goto(baseUrl + '/__preview-test.html');
      await page.evaluate(() => {
        window.__probeHits = 0;
        window.__rawParses = [];
        const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
          ...descriptor,
          set(value) {
            if (String(value).includes('PREVIEW_PROBE') && String(value).includes('<img')) {
              window.__rawParses.push(this.tagName);
            }
            return descriptor.set.call(this, value);
          }
        });
      });
      await action(page);
      await page.waitForTimeout(150); // Detached failed-image handlers are asynchronous.
      assert.equal(await page.evaluate(() => window.__probeHits), 0, 'Preview executed JavaScript');
      assert.deepEqual(errors, [], 'Production handler must not fail silently');
      results.push(true);
      console.log('PASS ' + name);
    } catch (error) {
      results.push(false);
      console.error('FAIL ' + name + ': ' + error.message);
    } finally {
      await page.close();
    }
  }
  try {
    browser = await chromium.launch({ headless: true });
    for (const provider of ['youtube', 'kick', 'twitch']) {
      for (const kind of ['probe', 'literal', 'emote']) {
        await check(provider + ': ' + kind + ' through source handler and preview', async page => {
          const input = kind === 'probe' ? probe : kind === 'literal' ? literal
            : provider === 'kick' ? '[emote:25:Kappa] Hello' : 'Kappa Hello';
          const source = provider === 'twitch'
            ? await providerMessage(page, input, kind === 'emote' ? { 25: ['0-4'] } : undefined)
            : null;
          const result = await page.evaluate(async ({ provider, kind, input, source, pixel }) => {
            const module = await import('/lite/plugins/' + provider + 'Plugin.js');
            const Plugin = module.YoutubePlugin || module.KickPlugin || module.TwitchPlugin;
            const sent = [], logs = [], activities = [], emoteInputs = [];
            const plugin = new Plugin({
              messenger: { send: payload => sent.push(JSON.parse(JSON.stringify(payload))) },
              onActivity: activity => activities.push(activity), debug: false,
              emotes: provider === 'youtube' && kind === 'emote' ? {
                render: async html => {
                  emoteInputs.push(html);
                  return html.replace('Kappa', '<img class="emote" alt="Kappa" src="' + pixel + '">');
                }
              } : null
            });
            const debugLog = plugin.debugLog.bind(plugin);
            plugin.debugLog = (message, detail) => { logs.push({ message, detail }); debugLog(message, detail); };
            if (provider === 'youtube') {
              plugin.state = 'connected';
              plugin.liveChatId = 'offline-chat';
              plugin.token = { accessToken: 'offline-placeholder', expiresAt: Date.now() + 60000 };
              window.fetch = async url => {
                if (!String(url).startsWith('https://www.googleapis.com/youtube/v3/liveChat/messages?')) {
                  throw Error('Unexpected API call: ' + url);
                }
                return { ok: true, status: 200, json: async () => ({ pollingIntervalMillis: 60000, items: [{
                  id: 'offline-message', snippet: { type: 'textMessageEvent', displayMessage: input },
                  authorDetails: { displayName: 'Test viewer', channelId: 'offline-viewer' }
                }] }) };
              };
              await plugin.pollChat();
              plugin.stopListening();
            } else if (provider === 'kick') {
              plugin.resolveSenderDetails = async () => ({}); // Only profile network enrichment is mocked.
              plugin.handleWsMessage({ data: JSON.stringify({ event: 'App\\Events\\ChatMessageEvent', data: JSON.stringify({
                id: 'offline-message', type: 'message', content: input, sender: { username: 'Test viewer' }
              }) }) });
            } else {
              await plugin.handleChatMessage(source);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            const display = document.createElement('div');
            display.innerHTML = sent[0] && sent[0].chatmessage;
            document.body.appendChild(display);
            return {
              sent, logs, emoteInputs, text: display.textContent,
              emotes: display.querySelectorAll('img').length,
              errors: activities.filter(activity => activity.kind === 'error'),
              rawParses: window.__rawParses, hits: window.__probeHits
            };
          }, { provider, kind, input, source, pixel });
          assert.equal(result.sent.length, 1, 'Handler must actually publish');
          assert.deepEqual(result.errors, []);
          assert.equal(result.hits, 0, 'Preview executed JavaScript');
          const expectedPreview = kind === 'emote' ? (provider === 'kick' ? ':Kappa: Hello' : 'Kappa Hello') : input;
          assert.equal(result.sent[0].previewText, expectedPreview, 'Raw preview changed');
          if (provider === 'kick') {
            assert.ok(result.logs.some(log => log.detail?.preview === expectedPreview.slice(0, 80)), 'Base preview lost literal text');
          } else {
            const name = provider === 'twitch' ? 'AuditViewer' : 'Test viewer';
            assert.ok(result.logs.some(log => log.message === name + ': ' + expectedPreview), 'Formatted preview lost literal text');
          }
          if (kind === 'emote') {
            assert.equal(result.emotes, 1, 'Emote HTML was lost');
            if (provider === 'youtube') assert.deepEqual(result.emoteInputs, ['Kappa Hello']);
          } else {
            assert.equal(result.text, input, 'Outgoing chat was double escaped or otherwise changed');
            assert.equal(result.emotes, 0, 'Literal text became HTML');
            assert.deepEqual(result.rawParses, [], 'Plain preview must not be parsed as HTML');
          }
        });
      }
    }

    for (const textonly of [true, false, undefined]) for (const rawMessage of [literal, probe, '']) {
      await check('Twitch missing-body fallback preserves its flag: ' + textonly + ', raw=' + rawMessage.length, async page => {
        const result = await page.evaluate(async ({ textonly, rawMessage }) => {
          const { TwitchPlugin } = await import('/lite/plugins/twitchPlugin.js');
          const sent = [];
          const plugin = new TwitchPlugin({ messenger: { send: payload => sent.push(payload) } });
          plugin.debugLog = () => {};
          await plugin.publishWithDecorations({ chatname: 'Viewer', chatmessage: '', textonly }, { rawMessage });
          const message = sent[0];
          const display = document.createElement('div');
          if (message.textonly) display.textContent = message.chatmessage;
          else display.innerHTML = message.chatmessage;
          document.body.appendChild(display);
          return { sent, text: display.textContent, elements: display.children.length, rawParses: window.__rawParses };
        }, { textonly, rawMessage });
        assert.equal(result.sent.length, 1);
        assert.equal(result.sent[0].textonly, textonly);
        assert.equal(result.text, rawMessage);
        assert.equal(result.elements, 0, 'Literal fallback became HTML');
        if (textonly) assert.equal(result.sent[0].chatmessage, rawMessage);
        assert.deepEqual(result.rawParses, [], 'Raw fallback must never be HTML-parsed');
      });
    }

    await check('HTML conversion is inert and preserves text/entity semantics', async page => {
      const result = await page.evaluate(async ({ probe, pixel }) => {
        const { htmlToText, safeHtml } = await import('/shared/utils/html.js');
        return {
          attack: htmlToText(probe),
          rich: htmlToText('<b>Hello</b> &amp; café <img alt="wave" src="' + pixel + '">'),
          encoded: htmlToText('&lt;b&gt;literal&lt;/b&gt; &amp;lt;i&amp;gt;'),
          roundTrip: htmlToText(safeHtml(probe)),
          empty: htmlToText(null)
        };
      }, { probe, pixel });
      assert.deepEqual(result, { attack: 'PREVIEW_PROBE ', rich: 'Hello & café ', encoded: '<b>literal</b> &lt;i&gt;', roundTrip: probe, empty: '' });
    });

    for (const provider of ['youtube', 'kick', 'twitch']) {
      for (const textonly of [true, false]) {
        await check(provider + ': missing preview fallback, textonly=' + textonly, async page => {
          const result = await page.evaluate(async ({ provider, textonly, probe, pixel }) => {
            const module = await import('/lite/plugins/' + provider + 'Plugin.js');
            const Plugin = module.YoutubePlugin || module.KickPlugin || module.TwitchPlugin;
            const sent = [], logs = [];
            const plugin = new Plugin({ messenger: { send: payload => sent.push(payload) } });
            plugin.debugLog = (message, detail) => logs.push({ message, detail });
            const payload = { chatname: 'Viewer', chatmessage: textonly ? probe : '<b>Hello</b> &amp; café <img src="' + pixel + '">', textonly };
            if (provider === 'twitch') await plugin.publishWithDecorations(payload);
            else await plugin.publishWithEmotes(payload);
            return { sent, logs, rawParses: window.__rawParses };
          }, { provider, textonly, probe, pixel });
          assert.equal(result.sent.length, 1);
          assert.equal(result.sent[0].previewText, textonly ? probe : 'Hello & café ');
          assert.equal(result.sent[0].chatmessage, textonly ? probe : '<b>Hello</b> &amp; café <img src="' + pixel + '">', 'Preview generation must not alter the outgoing body');
          assert.deepEqual(result.rawParses, [], 'Text-only body must not be parsed');
        });
      }
    }

    await check('Base preview fallback respects text-only and existing rich HTML', async page => {
      const result = await page.evaluate(async probe => {
        const { BasePlugin } = await import('/lite/plugins/basePlugin.js');
        const logs = [], sent = [];
        const plugin = new BasePlugin({ id: 'audit', messenger: { send: payload => sent.push(payload) } });
        plugin.debugLog = (message, detail) => { if (message === 'Message relayed') logs.push(detail.preview); };
        plugin.publish({ chatmessage: probe, textonly: true });
        plugin.publish({ chatmessage: '<b>Hello</b> &amp; café', textonly: false });
        plugin.publish({ chatmessage: '<b>Hello</b> &amp; café' });
        plugin.publish({ chatmessage: '<b>fallback</b>', previewText: '' });
        return { logs, sent, rawParses: window.__rawParses };
      }, probe);
      assert.equal(result.sent.length, 4);
      assert.deepEqual(result.logs, [probe.slice(0, 80), 'Hello & café', 'Hello & café', '']);
      assert.deepEqual(result.rawParses, []);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(results.filter(Boolean).length + '/' + results.length + ' preview checks passed');
  if (results.includes(false)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
