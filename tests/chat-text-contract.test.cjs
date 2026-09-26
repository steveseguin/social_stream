// Run with Playwright installed: node tests/chat-text-contract.test.cjs
// Real capture/relay/receivers; network and authenticated services stay offline.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { read, section, configureContext, captureTwitch, installRelay, deliver, providerMessage } = require('./helpers/chat-security-harness.cjs');
const root = path.resolve(__dirname, '..');
const literal = 'CONTRACT_MARKER <i>literal</i> &amp; &lt;b&gt; café 👋';
const metadata = 'META_MARKER &amp;lt;tag&amp;gt; <img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const bodyOverlays = ['themes/events/index.html', 'themes/horizontal.html', 'themes/notimeoutmessages.html',
  'themes/overlay-comic-classic.html', 'themes/overlay-comic-pop.html', 'themes/rainbowpuke/index.html',
  'themes/sampleoverlay_reverse.html', 'themes/spiritoverlay.html', 'themes/t3nk3y/index.html', 'themes/Windows3.1/index.html', 'septapus.html'];
const metadataOverlays = [...new Set(['dock.html', 'featured.html', 'bot.html', 'sampleoverlay.html', 'samplefeatured.html', 'events.html',
  ...bodyOverlays, 'themes/overlay-bubbles.html', 'themes/overlay-cards.html', 'themes/overlay-neon-cyberpunk.html',
  'themes/overlay-particles.html', 'themes/overlay-xacception.html', 'themes/overlay-typewriter.html',
  ...fs.readdirSync(path.join(root, 'themes/featured-styles')).filter(name => name.endsWith('.html')).map(name => 'themes/featured-styles/' + name)])];

(async () => {
  const server = await createStaticServer();
  let browser, count = 0;
  const failures = [];
  async function test(name, action) {
    try { await action(); count++; console.log('PASS ' + name); }
    catch (error) { failures.push(name + ': ' + error.message); console.error('FAIL ' + name + ': ' + error.message.split('\n')[0]); }
  }
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);
    const relayPage = await context.newPage();
    const relay = await installRelay(relayPage);
    const captured = {};
    for (const mode of [true, false]) [captured[mode]] = await captureTwitch(context, mode, [literal]);
    const base = { id: 9910, type: 'youtube', chatname: 'Viewer', chatbadges: [], chatmessage: 'CONTRACT_MARKER', textonly: true, donoValue: 0 };
    async function withPage(file, query, action) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(server.baseUrl + '/' + file + '?session=LOCAL_TEXT_CONTRACT' + (query || ''), { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => { if (typeof TYPE_SPEED !== 'undefined') { TYPE_SPEED = 0; Math.random = () => 0; } });
        await action(page);
        assert.deepEqual(errors, [], 'Page must load and run without errors');
      } finally { await page.close(); }
    }
    async function shown(page, marker = 'CONTRACT_MARKER') {
      await page.waitForFunction(marker => document.body.textContent.includes(marker), marker, { timeout: 7000 });
      await page.waitForFunction(() => !document.querySelector('.text.typing'), null, { timeout: 7000 });
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(() => window.__securityExecuted), false, 'Literal data executed JavaScript');
    }

    for (const mode of [true, false]) {
      await test('relay repeated processing preserves literal body and metadata, textonly=' + mode, async () => {
        await relayPage.evaluate(() => {
          window.__filterCalls = [];
          if (!window.__originalFilter) window.__originalFilter = window.filterXSS;
          window.filterXSS = value => { window.__filterCalls.push(value); return window.__originalFilter(value); };
        });
        let payload = { ...base, ...captured[mode], subtitle: metadata, membership: 'Member <literal> &amp;',
          title: metadata, hasDonation: '$5 &amp;', chatbadges: [{ type: 'text', text: 'R&D &amp; <literal>' }] };
        const originalBody = payload.chatmessage;
        let previous;
        for (let pass = 0; pass < 3; pass++) {
          await relayPage.evaluate(() => { window.__filterCalls = []; });
          ({ payload } = await relay(payload));
          assert.equal(payload.chatmessage, originalBody);
          assert.equal(payload.subtitle, metadata);
          assert.equal(payload.membership, 'Member <literal> &amp;');
          assert.equal(payload.title, metadata);
          assert.equal(payload.hasDonation, '$5 &amp;');
          assert.equal(payload.chatbadges[0].rawText, 'R&D &amp; <literal>');
          if (previous) assert.deepEqual(payload.chatbadges, previous);
          previous = payload.chatbadges;
          const filters = await relayPage.evaluate(body => window.__filterCalls.filter(input => input === body).length, originalBody);
          assert.equal(filters, mode ? 0 : 1, 'Plain bodies must bypass the HTML filter');
        }
        for (const file of ['dock.html', 'featured.html']) await withPage(file, '', async page => {
          await deliver(page, { ...payload, hasDonation: '' });
          await shown(page);
          if (file === 'dock.html') {
            assert.equal(await page.evaluate(id => document.getElementById('msg_' + id).rawContents.subtitle, payload.id), metadata, 'Stored subtitle changed');
          } else {
            assert.equal(await page.locator('.subtitle').first().textContent(), metadata, 'Subtitle changed');
          }
          assert.equal(await page.locator('.textbadge').first().textContent(), 'R&D &amp; <literal>');
        });
      });
    }

    for (const mode of [true, false, undefined]) for (const strip of [false, true]) for (const event of ['', 'action']) {
      await test('Dock plain/event/striphtml contract ' + JSON.stringify({ mode, strip, event }), () => withPage('dock.html', strip ? '&striphtml' : '', async page => {
        const input = { ...base, ...captured[mode === true], event, textonly: mode };
        if (mode === undefined) delete input.textonly;
        const wire = await relay(input);
        await deliver(page, wire.payload);
        await shown(page);
        const result = await page.evaluate(id => {
          const row = document.getElementById('msg_' + id);
          const body = row.querySelector('.hl-content');
          return { text: body.textContent, raw: row.rawContents, italic: getComputedStyle(body).fontStyle };
        }, wire.payload.id);
        assert.equal(result.text, literal, 'Display must preserve source literal text');
        assert.equal(result.raw.chatmessage, strip ? literal : wire.payload.chatmessage, 'Event formatting must not modify the message');
        if (strip) assert.equal(result.raw.textonly, true, 'HTML converted to text must carry the matching flag');
        assert.equal(result.italic, event && !strip ? 'italic' : 'normal');
      }));
    }

    for (const fixture of [
      { query: '&hidenumbers', text: '<b>123</b>' },
      { query: '&hideallcaps', text: '<lowercase>UPPER</lowercase>' },
      { query: '&hideshortmessages=5', text: '<literal>' },
      { query: '&noemojisonly', text: '<literal>' }
    ]) await test('Dock filters keep literal tags: ' + fixture.query, () => withPage('dock.html', fixture.query, async page => {
      const wire = await relay({ ...base, chatmessage: fixture.text });
      await deliver(page, wire.payload);
      await shown(page, fixture.text);
      assert.equal(await page.locator('#content_' + wire.payload.id).textContent(), fixture.text);
    }));

    for (const mode of [true, false]) for (const kind of ['reply', 'event pill']) {
      await test('Twitch DOM ' + kind + ' preserves literal text, textonly=' + mode, async () => {
        const label = 'LABEL &lt;b&gt; <i>literal</i> <img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
        const options = kind === 'reply' ? { replyText: label } : { eventPill: label };
        const [message] = await captureTwitch(context, mode, ['CONTRACT_MARKER'], { ...options, assertSafe: true });
        assert.equal(message.textonly, mode);
        if (mode) assert.equal(message.chatmessage, label + (kind === 'reply' ? ': ' : '  ') + 'CONTRACT_MARKER');
        else {
          assert.ok(message.chatmessage.includes('&lt;i&gt;literal&lt;/i&gt;'));
          assert.ok(message.chatmessage.startsWith('<i'));
        }
      });
    }

    for (const mode of [true, false]) for (const kind of ['member', 'member gift', 'gift', 'sticker']) {
      await test('YouTube comments capture never adds HTML in plain mode: ' + kind + ', ' + mode, async () => {
        const page = await context.newPage();
        try {
          await page.setContent('<div id="row"><span id="author-name">Viewer</span></div>');
          await page.evaluate(({ mode, kind, pixel }) => {
            window.settings = { textonlymode: mode }; window.messageHistory = []; window.__sent = [];
            window.chrome = { runtime: { id: 'local', sendMessage: (id, request) => window.__sent.push(request.message) } };
            const row = document.getElementById('row');
            if (kind.includes('member')) {
              const member = document.createElement('div');
              member.className = 'yt-live-chat-membership-item-renderer';
              member.innerHTML = '<span id="header-subtext"><b></b></span>';
              member.querySelector('b').textContent = 'Member <literal> &amp;';
              row.appendChild(member);
            }
            if (kind.includes('gift')) {
              const gift = document.createElement('div');
              gift.id = 'primary-text'; gift.className = 'ytd-sponsorships-live-chat-header-renderer';
              gift.innerHTML = '<b></b>'; gift.firstChild.textContent = 'Gift <literal> &amp;';
              row.appendChild(gift);
            }
            if (kind === 'sticker') {
              const sticker = document.createElement('div');
              sticker.className = 'yt-live-chat-paid-sticker-renderer';
              sticker.innerHTML = '<div id="sticker"><img id="img"></div><span id="purchase-amount-chip">$5</span>';
              sticker.querySelector('img').src = pixel; sticker.querySelector('img').alt = 'Sticker <literal> &amp;';
              row.appendChild(sticker);
            }
          }, { mode, kind, pixel });
          await page.addScriptTag({ content: section('sources/youtube_comments.js', '\tfunction escapeHtml(', '\tchrome.runtime.onMessage.addListener(') });
          await page.evaluate(() => processMessage(document.getElementById('row')));
          const sent = await page.evaluate(() => window.__sent);
          assert.equal(sent.length, 1);
          assert.equal(sent[0].textonly, mode);
          const expected = (kind.includes('gift') ? 'Gift' : kind === 'sticker' ? 'Sticker' : 'Member') + ' <literal> &amp;';
          if (mode) assert.equal(sent[0].chatmessage, expected);
          else assert.ok(sent[0].chatmessage.startsWith(kind === 'sticker' ? '<img class="supersticker"' : '<i>'));
        } finally { await page.close(); }
      });
    }

    for (const file of bodyOverlays) for (const mode of [true, false, undefined]) {
      await test(file + ': body and donation retained, textonly=' + mode, () => withPage(file, '', async page => {
        const payload = { ...base, textonly: mode, hasDonation: '$5.00',
          chatmessage: mode ? literal : `CONTRACT_MARKER <b>rich</b> &amp; friend <img class="emote" alt="wave" src="${pixel}">` };
        if (mode === undefined) delete payload.textonly;
        if (file === 'themes/events/index.html') payload.event = 'subscription';
        const wire = await relay(payload);
        await deliver(page, wire.payload);
        await shown(page);
        const text = await page.locator('body').textContent();
        assert.ok(text.includes('$5.00'), 'Donation child lost');
        if (mode) assert.ok(text.includes(literal), 'Literal text changed');
        else {
          assert.ok(await page.locator('b').filter({ hasText: 'rich' }).count(), 'Formatting lost');
          assert.ok(await page.locator('img.emote[alt="wave"]').count(), 'Emote lost');
          assert.ok(text.includes('& friend'), 'Entities escaped twice');
        }
      }));
    }

    for (const file of metadataOverlays) {
      await test(file + ': plain donation metadata is literal and safe', () => withPage(file, '', async page => {
        const wire = await relay({ ...base, hasDonation: '$5 ' + metadata, title: 'Donation', event: 'subscription' });
        await deliver(page, wire.payload);
        await shown(page);
        // The 3D cube has never displayed donation/membership labels.
        if (!file.endsWith('featured-3d.html')) assert.ok((await page.locator('body').textContent()).includes(metadata), 'Plain metadata was decoded or stripped');
        assert.equal(await page.locator('[onerror*="__securityExecuted"]').count(), 0);
      }));
    }

    for (const mode of [true, false, undefined]) {
      await test('Events distinguishes generated plain summaries from HTML chat, textonly=' + mode, () => withPage('events.html', '', async page => {
        const wire = await relay({ ...base, event: 'gift', chatmessage: '', subtitle: metadata, textonly: mode });
        await deliver(page, wire.payload);
        await shown(page, 'META_MARKER');
        assert.ok((await page.locator('.text').first().textContent()).includes(metadata));
        assert.equal(await page.locator('[onerror*="__securityExecuted"]').count(), 0);
        await deliver(page, { ...wire.payload, id: 9911, chatmessage: mode ? literal : 'CONTRACT_MARKER <b>rich</b>' });
        await shown(page);
        if (mode) assert.ok((await page.locator('body').textContent()).includes(literal));
        else assert.equal(await page.locator('.text b').textContent(), 'rich');
      }));

      await test('Tip jar keeps plain donation labels in recent tips and history, textonly=' + mode, () => withPage('tipjar.html', '&style=meter&goalmetric=count&tipjarevent=superchat&controls', async page => {
        const wire = await relay({ ...base, event: 'superchat', hasDonation: '$5 ' + metadata, textonly: mode });
        await deliver(page, wire.payload);
        await shown(page, 'META_MARKER');
        assert.ok((await page.locator('.tip-amount').textContent()).includes(metadata));
        await page.click('#toggle-history');
        assert.ok((await page.locator('#history-list').textContent()).includes(metadata));
        await page.click('#close-history');
        await page.click('#toggle-leaderboard');
        assert.ok((await page.locator('#leaderboard-list').textContent()).includes(metadata));
        await page.waitForTimeout(80);
        assert.equal(await page.evaluate(() => window.__securityExecuted), false);
        assert.equal(await page.locator('[onerror*="__securityExecuted"]').count(), 0);
      }));
    }

    for (const file of ['dock.html', 'featured.html', 'bot.html']) for (const mode of [true, false]) {
      await test(file + ': legacy styles cannot create HTML, textonly=' + mode, () => withPage(file, '', async page => {
        // Bypass the newer relay: model an older sender with unchecked fields.
        const style = 'red\'"><img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
        await deliver(page, { ...base, textonly: mode, nameColor: style, backgroundColor: style,
          textColor: style, backgroundNameColor: style, textNameColor: style });
        await shown(page);
        assert.equal(await page.locator('[onerror*="__securityExecuted"]').count(), 0);
      }));
    }
    await test('Featured retains legacy color declarations', () => withPage('featured.html', '', async page => {
      await deliver(page, { ...base, textColor: 'color:rgb(12, 34, 56);', backgroundColor: 'background-color:rgb(65, 43, 21);' });
      await shown(page);
      const styles = await page.locator('#message').evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
      assert.deepEqual(styles, { color: 'rgb(12, 34, 56)', background: 'rgb(65, 43, 21)' });
    }));

    await test('outgoing-text helper preserves literal tags and only parses HTML input', async () => {
      const page = await context.newPage();
      try {
        await page.addScriptTag({ content: section('background.js', 'function sanitizeRelay(', '// Build the same reflection key') });
        const result = await page.evaluate(literal => {
          const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
          let parses = 0;
          Object.defineProperty(Element.prototype, 'innerHTML', { ...descriptor, set(value) { parses++; return descriptor.set.call(this, value); } });
          const plain = sanitizeRelay(literal, true);
          const plainParses = parses;
          const html = sanitizeRelay('<b>Hello</b> &amp; &lt;literal&gt; <img alt="👋" src="x">', false);
          return { plain, plainParses, html };
        }, literal);
        assert.equal(result.plain, literal);
        assert.equal(result.plainParses, 0);
        assert.equal(result.html, 'Hello & <literal> 👋');
      } finally { await page.close(); }
    });

    // Real adapter functions, including native and third-party emote rendering.
    for (const mode of [true, false]) for (const native of [true, false]) {
      await test('Twitch WebSocket preview/body/reply/emotes ' + JSON.stringify({ mode, native }), async () => {
        const page = await context.newPage();
        try {
          await page.goto(server.baseUrl + '/sampleoverlay.html?session=LOCAL_ADAPTER');
          const raw = 'WEB_MARKER &lt;b&gt; <i>literal</i> Kappa <3 Cheer100 <img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
          const input = await providerMessage(page, raw);
          input.raw.tags = { ...(input.raw.tags || {}), emotes: '25:' + raw.indexOf('Kappa') + '-' + (raw.indexOf('Kappa') + 4), 'reply-parent-msg-body': 'Reply <b>literal</b> &amp;' };
          await page.evaluate(async ({ mode, native, pixel }) => {
            document.body.innerHTML = '<div id="textarea"></div><div id="body"></div>';
            window.settings = { textonlymode: mode }; window.channel = 'audit'; window.__sent = []; window.__errors = [];
            window.EMOTELIST = { '<3': pixel }; window.getUserInfo = async () => ({ display_name: 'Viewer' });
            window.getTwitchMessageSourceInfo = async () => ({}); window.parseBadges = () => [];
            window.rememberTwitchDisplayName = () => {}; window.pushMessage = data => window.__sent.push(data);
            window.console.error = error => window.__errors.push(String(error));
            const helpers = await import('/shared/utils/twitchEmotes.js');
            window.renderTwitchNativeEmotes = native ? helpers.renderTwitchNativeEmotes : null;
            window.parseTwitchEmotes = helpers.parseTwitchEmotes;
          }, { mode, native, pixel });
          await page.addScriptTag({ content: [
            section('sources/websocket/twitch.js', '\t\tfunction convertChatPayloadToLegacyMessage(payload)', '\tfunction convertMembershipPayloadToUserNotice('),
            section('sources/websocket/twitch.js', '\tfunction replaceEmotesWithImages(', '\tlet globalBadges'),
            section('sources/websocket/twitch.js', '\tasync function processMessage(parsedMessage)', '\tfunction addEvent(description)')
          ].join('\n') });
          await page.evaluate(async input => processMessage(convertChatPayloadToLegacyMessage(input)), input);
          assert.deepEqual(await page.evaluate(() => window.__errors), []);
          const sent = await page.evaluate(() => window.__sent);
          assert.equal(sent.length, 1);
          assert.equal(sent[0].textonly, mode);
          assert.ok((await page.locator('#textarea').textContent()).includes(raw), 'Preview decoded literal input');
          await page.evaluate(data => {
            if (data.textonly) document.getElementById('body').textContent = data.chatmessage;
            else document.getElementById('body').innerHTML = data.chatmessage;
          }, sent[0]);
          assert.equal(await page.evaluate(() => window.__securityExecuted), false);
          assert.ok((await page.locator('#body').textContent()).includes('Reply <b>literal</b> &amp;'));
          if (mode) {
            assert.equal(sent[0].chatmessage, 'Reply <b>literal</b> &amp;: ' + raw);
            assert.equal(await page.locator('#body img, #body i, #body b').count(), 0);
          } else {
            assert.equal(await page.locator('#body img').count(), 2, 'Native/third-party emotes missing');
            assert.ok(await page.locator('#body i small').count(), 'Reply formatting missing');
            assert.ok((await page.locator('#body').textContent()).includes('WEB_MARKER &lt;b&gt; <i>literal</i>'), 'Body decoded literal input');
          }
          const fallback = await page.evaluate(mode => {
            const body = 'Fallback <literal> &amp;';
            const escaped = 'Fallback &lt;literal&gt; &amp;amp;';
            return { raw: getTwitchMessageText({ rawMessage: body }, ''),
              plain: getTwitchMessageText({ chatmessage: body, textonly: true }, ''),
              html: getTwitchMessageText({ chatmessage: escaped + '<img alt=" wave" src="x">', textonly: false }, '') };
          }, mode);
          assert.deepEqual(fallback, { raw: 'Fallback <literal> &amp;', plain: 'Fallback <literal> &amp;', html: 'Fallback <literal> &amp; wave' });
          await page.evaluate(() => {
            const rendered = replaceEmotesWithImages('Cheer100 Kappa &amp;', null, true);
            const node = document.getElementById('body');
            if (settings.textonlymode) node.textContent = rendered; else node.innerHTML = rendered;
          });
          if (mode) assert.equal(await page.locator('#body').textContent(), 'Cheer 100 Kappa &amp;');
          else {
            assert.equal(await page.locator('#body img').count(), 1);
            assert.equal(await page.locator('#body strong').textContent(), '100');
            assert.ok((await page.locator('#body').textContent()).includes('&amp;'));
          }
        } finally { await page.close(); }
      });
    }
  } finally { if (browser) await browser.close(); await closeServer(server.server); }
  console.log(count + ' text-contract checks passed; ' + failures.length + ' failed.');
  assert.deepEqual(failures, []);
})().catch(error => { console.error(error); process.exitCode = 1; });
