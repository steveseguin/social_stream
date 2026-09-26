#!/usr/bin/env node
// See tests/chat-security-boundaries.md for scope, trust boundaries, and known red tests.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { section, installRelay, captureTwitch, captureAuction, providerMessage, configureContext, deliver } = require('./helpers/chat-security-harness.cjs');

const group = process.argv.find(arg => arg.startsWith('--group='))?.slice(8) || 'all';
assert.ok(['all', 'compatibility', 'security'].includes(group), 'Use --group=all|compatibility|security');
const raw = 'BOUNDARY_MARKER <img id="security-probe" src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
const literal = 'BOUNDARY_MARKER <b>literal</b> &lt;i&gt; & "\' 👋 café';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const rich = `BOUNDARY_MARKER <i><small>Reply:&nbsp;</small></i> <b>Hello</b> &amp; friend <span class="zero-width-parent"><img class="emote" src="${pixel}" alt="wave"></span>`;
const overlays = [
  'sampleoverlay.html', 'samplefeatured.html', 'themes/overlay-typewriter.html',
  'themes/events/index.html', 'themes/horizontal.html', 'themes/notimeoutmessages.html',
  'themes/overlay-comic-classic.html', 'themes/overlay-comic-pop.html', 'themes/rainbowpuke/index.html',
  'themes/sampleoverlay_reverse.html', 'themes/spiritoverlay.html', 'themes/t3nk3y/index.html',
  'themes/Windows3.1/index.html', 'septapus.html'
];

async function run() {
  const server = await createStaticServer();
  let browser;
  const results = [];
  async function test(kind, name, action) {
    if (group !== 'all' && group !== kind) return;
    try {
      await action();
      results.push({ kind, name, pass: true });
      console.log(`PASS [${kind}] ${name}`);
    } catch (error) {
      // A harness/route failure is never counted as proof of safety or as an XSS reproduction.
      const status = error.code === 'ERR_ASSERTION' ? 'FAIL' : 'ERROR';
      results.push({ kind, name, pass: false, status });
      console.error(`${status} [${kind}] ${name}: ${error.message.split('\n')[0]}`);
    }
  }
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);
    const relayPage = await context.newPage();
    const relay = await installRelay(relayPage);
    // Literal viewer input is put into Twitch's DOM with textContent. This is not
    // a synthetic malicious DOM node or a payload injected after sanitization.
    const [plainAttack, plainLiteral] = await captureTwitch(context, true, [raw, literal]);
    const [htmlAttack] = await captureTwitch(context, false, [raw]);
    const base = { id: 8001, chatname: 'AuditViewer', chatbadges: [], type: 'twitch', timestamp: Date.now() };
    const plainWire = await relay({ ...base, ...plainAttack });
    const literalWire = await relay({ ...base, ...plainLiteral });
    const sourceHtmlWire = await relay({ ...base, ...htmlAttack });
    const richWire = await relay({ ...base, textonly: false, chatmessage: rich, hasDonation: '$5.00', donoValue: 0 });
    // Models an HTML-producing integration, through the SAME real relay sanitizer.
    const sanitizedWire = await relay({ ...base, textonly: false, chatmessage: raw });

    async function withPage(file, params, action) {
      const page = await context.newPage();
      try {
        await page.goto(`${server.baseUrl}/${file}?session=LOCAL_SECURITY_ONLY${params || ''}`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
          if (typeof TYPE_SPEED !== 'undefined') { TYPE_SPEED = 0; Math.random = () => 0; }
        });
        await action(page);
      } finally { await page.close(); }
    }
    async function rendered(page) {
      await page.waitForFunction(() => document.body.textContent.includes('BOUNDARY_MARKER'), null, { timeout: 5000 });
      await page.waitForFunction(() => !document.querySelector('.text.typing'), null, { timeout: 5000 });
      // Let failed-image events fire, including detached parsing in TTS/previews.
      await page.waitForTimeout(150);
    }
    async function assertSafe(page) {
      assert.equal(await page.evaluate(() => window.__securityExecuted), false, 'Viewer text executed JavaScript');
    }
    function eventPayload(file, payload) {
      return file === 'themes/events/index.html'
        ? { ...payload, event: 'subscription', membership: 'Subscriber' } : payload;
    }

    await test('compatibility', 'real Twitch capture and relay preserve the text/HTML contract', async () => {
      assert.equal(plainAttack.textonly, true);
      assert.equal(plainWire.payload.chatmessage, raw);
      assert.equal(plainWire.stored.chatmessage, raw);
      assert.equal(literalWire.payload.chatmessage, literal);
      assert.equal(htmlAttack.textonly, false);
      assert.ok(sourceHtmlWire.payload.chatmessage.includes('&lt;img'));
      assert.ok(!sanitizedWire.payload.chatmessage.includes('onerror='));
      assert.equal(richWire.payload.donoValue, 0);
      assert.equal(richWire.payload.hasDonation, '$5.00');
      assert.equal(richWire.payload.chatmessage, rich, 'Already permitted HTML must survive the relay unchanged');
      await assertSafe(relayPage);
    });

    for (const file of overlays) {
      await test('compatibility', `${file}: upstream sanitization neutralizes HTML-mode probe`, () => withPage(file, '', async page => {
        await deliver(page, eventPayload(file, sanitizedWire.payload));
        await rendered(page);
        await assertSafe(page);
        assert.equal(await page.locator('[onerror*="__securityExecuted"]').count(), 0, 'Sanitized message must not acquire executable attributes');
      }));
      await test('compatibility', `${file}: rich replies and emotes still render`, () => withPage(file, '', async page => {
        await deliver(page, eventPayload(file, { ...richWire.payload, hasDonation: '' }));
        await rendered(page);
        assert.ok(await page.locator('b').filter({ hasText: 'Hello' }).count(), 'Bold chat formatting lost');
        assert.ok(await page.locator('i small').filter({ hasText: 'Reply:' }).count(), 'Reply formatting lost');
        assert.ok(await page.locator('img.emote[alt="wave"]').count(), 'Emote image lost');
        assert.ok(await page.locator('.zero-width-parent').count(), 'Emote stacking wrapper lost');
        assert.ok((await page.locator('body').textContent()).includes('& friend'), 'HTML entities double escaped');
        await assertSafe(page);
      }));
      await test('security', `${file}: text-only source → relay → iframe receiver`, () => withPage(file, '', async page => {
        await deliver(page, eventPayload(file, plainWire.payload));
        await rendered(page);
        await assertSafe(page);
        assert.equal(await page.locator('#security-probe').count(), 0, 'Text-only message became an HTML element');
        assert.ok((await page.locator('body').textContent()).includes(raw), 'Literal message changed');
      }));
    }

    for (const file of overlays.slice(0, 3)) {
      await test('compatibility', `${file}: literal symbols, entities, Unicode and legacy HTML`, () => withPage(file, '', async page => {
        await deliver(page, literalWire.payload);
        await rendered(page);
        assert.ok((await page.locator('body').textContent()).includes(literal), 'Literal text was decoded or escaped twice');
        const legacy = { ...richWire.payload, id: 9002, hasDonation: '' };
        delete legacy.textonly;
        await deliver(page, legacy);
        await page.waitForFunction(() => !!document.querySelector('img.emote[alt="wave"]'));
      }));
    }

    for (const file of ['sampleoverlay.html', 'themes/horizontal.html']) {
      for (const attack of [false, true]) {
        await test(attack ? 'security' : 'compatibility', `${file}: WebSocket ${attack ? 'text-only' : 'sanitized HTML'} delivery`, () => withPage(file, '&server', async page => {
          await page.evaluate(payload => {
            const socket = window.__sockets.find(socket => socket.url === 'wss://io.socialstream.ninja');
            if (!socket) throw Error('Production WebSocket listener was not installed');
            socket.deliver(payload);
          }, attack ? plainWire.payload : sanitizedWire.payload);
          await rendered(page);
          await assertSafe(page);
          if (attack) assert.ok((await page.locator('body').textContent()).includes(raw));
        }));
      }
    }

    for (const file of ['dock.html', 'featured.html']) {
      await test('compatibility', `${file}: default text-only display stays literal`, () => withPage(file, '', async page => {
        await deliver(page, plainWire.payload);
        await rendered(page);
        await assertSafe(page);
        assert.equal(await page.locator('#security-probe').count(), 0);
        assert.ok((await page.locator('body').textContent()).includes(raw));
      }));
      await test('compatibility', `${file}: sanitized HTML still becomes spoken text`, () => withPage(file, '&tts', async page => {
        await page.evaluate(() => { TTS.speak = text => window.__spoken.push(text); });
        await deliver(page, { ...richWire.payload, hasDonation: '' });
        await page.waitForFunction(() => window.__spoken.length > 0);
        const spoken = await page.evaluate(() => window.__spoken.join(' '));
        assert.ok(spoken.includes('Hello') && spoken.includes('friend'), 'Spoken message lost');
        assert.ok(!spoken.includes('<b>'), 'TTS reads HTML markup');
        await assertSafe(page);
      }));
      await test('security', `${file}: TTS must not execute text-only chat`, () => withPage(file, '&tts', async page => {
        await page.evaluate(() => { TTS.speak = text => window.__spoken.push(text); });
        await deliver(page, plainWire.payload);
        await rendered(page);
        await page.waitForFunction(() => window.__spoken.length > 0);
        await assertSafe(page);
        assert.ok((await page.evaluate(() => window.__spoken.join(' '))).includes('BOUNDARY_MARKER'), 'Text-only speech must not be discarded');
      }));
    }

    await test('security', 'Dock normalize: text-only source survives normalization without HTML parsing', () => withPage('dock.html', '&normalize', async page => {
      await deliver(page, plainWire.payload);
      await rendered(page);
      await assertSafe(page);
      assert.ok((await page.locator('body').textContent()).includes(raw));
    }));
    await test('compatibility', 'Dock normalize: accents normalize and emotes survive', () => withPage('dock.html', '&normalize', async page => {
      const message = await relay({ ...base, textonly: false, chatmessage: rich + ' café' });
      await deliver(page, message.payload);
      await rendered(page);
      const text = await page.locator('.hl-content').textContent();
      assert.ok(text.includes('cafe'), `Accent normalization lost: ${text}`);
      assert.ok(await page.locator('.hl-content img[alt="wave"]').count(), 'Normalized HTML lost its emote');
      assert.ok(await page.locator('.hl-content .zero-width-parent').count(), 'Normalized HTML lost emote stacking');
    }));

    for (const attack of [false, true]) {
      await test(attack ? 'security' : 'compatibility', `Multi-alerts subscription: ${attack ? 'text-only stays literal' : 'formatted body retained'}`, () => withPage('multi-alerts.html', '', async page => {
        const input = attack ? plainWire.payload : richWire.payload;
        const message = await relay({ ...input, event: 'subscription', membership: 'Subscriber', hasDonation: '' });
        assert.ok(message.targets.some(entry => entry.target === 'alerts'), 'Relay must actually route this to alerts');
        await deliver(page, message.payload);
        await rendered(page);
        await assertSafe(page);
        if (attack) assert.ok((await page.locator('body').textContent()).includes(raw));
        else assert.ok(await page.locator('img.emote').count());
      }));
    }
    await test('security', 'Multi-alerts auction wins: plain meta.title is not HTML', () => withPage('multi-alerts.html', '&auctionwins', async page => {
      const source = await context.newPage();
      let auction;
      try { auction = await captureAuction(source, raw); } finally { await source.close(); }
      const message = await relay(auction);
      assert.equal(message.payload.meta.title, raw, 'Meta is plain text, not an HTML-sanitized field');
      assert.ok(message.targets.some(entry => entry.target === 'alerts'));
      await deliver(page, message.payload);
      await rendered(page);
      await assertSafe(page);
      assert.ok((await page.locator('body').textContent()).includes(raw), 'Auction title must remain visible as text');
    }));

    for (const attack of [false, true]) {
      const record = attack ? plainWire.stored : richWire.stored;
      await test(attack ? 'security' : 'compatibility', `Dock stored user history: ${attack ? 'text-only stays literal' : 'rich content retained'}`, () => withPage('dock.html', '', async page => {
        await deliver(page, { userHistory: [record] });
        await rendered(page);
        await assertSafe(page);
        if (attack) assert.ok((await page.locator('body').textContent()).includes(raw));
        else assert.ok(await page.locator('img.emote').count());
      }));
      await test(attack ? 'security' : 'compatibility', `HTML history export: ${attack ? 'opening text-only export is safe' : 'formatting and donation preserved'}`, async () => {
        let html;
        await withPage('chathistory.html', '&ssappSnapshot=1', async page => {
          await page.evaluate(record => {
            window.dispatchEvent(new MessageEvent('message', { source: window, data: {
              type: 'ssapp-chat-history-snapshot', snapshot: { messages: [record] }
            } }));
            const create = URL.createObjectURL.bind(URL);
            URL.createObjectURL = blob => { window.__exportBlob = blob; return create(blob); };
            HTMLAnchorElement.prototype.click = function () {};
            exportMessages('html');
          }, record);
          await page.waitForFunction(() => !!window.__exportBlob);
          html = await page.evaluate(() => window.__exportBlob.text());
          await assertSafe(page); // Live history already respects textonly.
        });
        const exported = await context.newPage();
        try {
          await exported.goto(server.baseUrl + '/tests/fixtures/__security_export__');
          await exported.setContent(html, { waitUntil: 'domcontentloaded' });
          await rendered(exported);
          await assertSafe(exported);
          if (attack) assert.ok((await exported.locator('body').textContent()).includes(raw));
          else {
            assert.ok(await exported.locator('img.emote').count());
            assert.ok((await exported.locator('body').textContent()).includes('$5.00'));
          }
        } finally { await exported.close(); }
      });
    }

    // Lite bypasses background.js. Exercise its real handler, decorations, preview,
    // and BasePlugin.publish, with only the outgoing messenger and logs mocked.
    for (const attack of [false, true]) {
      await test(attack ? 'security' : 'compatibility', `Lite Twitch handler: ${attack ? 'raw preview cannot execute' : 'native emotes and preview preserved'}`, () => withPage('sampleoverlay.html', '', async page => {
        const input = await providerMessage(page, attack ? raw : 'Kappa Hello friend', attack ? undefined : { 25: ['0-4'] });
        if (attack) {
          assert.ok(input.chatmessage.includes('&lt;img'), 'Provider already escapes HTML');
          assert.equal(input.rawMessage, raw, 'Preview uses the separately retained raw text');
        }
        const result = await page.evaluate(async input => {
          const { TwitchPlugin } = await import('/lite/plugins/twitchPlugin.js');
          const plugin = Object.create(TwitchPlugin.prototype);
          const sent = [], logs = [];
          Object.assign(plugin, {
            id: 'twitch', channelName: 'audit', emotes: null,
            debugLog: text => logs.push(text), onActivity() {},
            messenger: { send: payload => sent.push(JSON.parse(JSON.stringify(payload))) },
            reportError: error => { throw error; }
          });
          await plugin.handleChatMessage(input);
          return { sent, logs };
        }, input);
        assert.equal(result.sent.length, 1, 'Handler must publish');
        await page.waitForTimeout(150);
        await assertSafe(page);
        if (attack) assert.ok(result.logs.includes('AuditViewer: ' + raw), 'Raw preview should retain literal text');
        else {
          assert.ok(result.sent[0].chatmessage.includes('native-emote'), 'Native emote lost');
          assert.ok(result.logs.includes('AuditViewer: Kappa Hello friend'), 'Preview changed');
        }
      }));
    }

    // Actual WebSocket adapter processing, with auth/profile/emote services mocked.
    // This models the web/Electron DOM path, not an extension CSP bypass.
    await test('security', 'Twitch WebSocket adapter parses rawMessage before the relay', () => withPage('sampleoverlay.html', '', async page => {
      const input = await providerMessage(page, raw);
      assert.ok(input.chatmessage.includes('&lt;img'), 'Provider already escapes HTML');
      await page.evaluate(() => {
        document.body.innerHTML = '<div id="textarea"></div>';
        window.settings = {}; window.channel = 'audit'; window.__adapterSent = []; window.__adapterErrors = [];
        console.error = error => window.__adapterErrors.push(String(error));
        window.getUserInfo = async () => ({ display_name: 'AuditViewer' });
        window.getTwitchMessageSourceInfo = async () => ({});
        window.parseBadges = () => [];
        window.rememberTwitchDisplayName = () => {};
        window.replaceEmotesWithImages = text => text; // No emote tags in this fixture.
        window.pushMessage = data => window.__adapterSent.push(data);
      });
      await page.addScriptTag({ content: [
        section('sources/websocket/twitch.js', '\t\tfunction convertChatPayloadToLegacyMessage(payload)', '\tfunction convertMembershipPayloadToUserNotice('),
        section('sources/websocket/twitch.js', '\tfunction escapeHtml(unsafe)', '\tlet globalBadges'),
        section('sources/websocket/twitch.js', '\tasync function processMessage(parsedMessage)', '\tfunction addEvent(description)')
      ].join('\n') });
      await page.evaluate(async input => processMessage(convertChatPayloadToLegacyMessage(input)), input);
      assert.deepEqual(await page.evaluate(() => window.__adapterErrors), []);
      assert.equal(await page.evaluate(() => window.__adapterSent.length), 1);
      await rendered(page);
      await assertSafe(page);
      assert.ok((await page.locator('#textarea').textContent()).includes(raw), 'Adapter preview should retain literal text');
    }));
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
  const failed = results.filter(result => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed; ${failed.length} failed. No expected-failure exemptions.`);
  if (failed.length) process.exitCode = 1;
}

run().catch(error => { console.error(error); process.exitCode = 1; });
