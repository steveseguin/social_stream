const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { read, configureContext, deliver, installRelay } = require('./helpers/chat-security-harness.cjs');
const source = read('leaderboard.html');
const unsafe = source
  .replaceAll('${escapeLeaderboardName(user.name)}', '${user.name}')
  .replaceAll('${renderLeaderboardName(user.name)}', '${user.name}')
  .replaceAll('${escapeLeaderboardAttribute(user.avatarUrl)}', '${user.avatarUrl}')
  .replaceAll('${escapeLeaderboardAttribute(user.type)}', '${user.type}');
assert.notEqual(unsafe, source, 'Locate the display checks for the isolated positive control');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const attributeAttack = '" onload="alert(1)" x="';
const nameAttack = '<img src="data:image/png;base64,broken" onerror="alert(1)">';
(async () => {
  const server = await createStaticServer();
  let browser, id = 523000, pageId = 0;
  const results = [];
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);
    const relay = await installRelay(await context.newPage());
    async function open(query, fixed) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.__hits = 0; window.__received = 0;
        window.alert = window.confirm = window.prompt = () => window.__hits++;
      });
      if (!fixed) await page.route('**/leaderboard.html*', route => route.fulfill({ contentType: 'text/html', body: unsafe }));
      await page.goto(server.baseUrl + '/leaderboard.html?session=LEADERBOARD_OFFLINE_' + ++pageId + '&persistdata&donations&showscore&showrank&showavatar&showsource' + query, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        const original = processData;
        processData = function (data) { window.__received++; const before = JSON.stringify(data); const result = original(data); if (before !== JSON.stringify(data)) throw Error('Renderer changed input payload'); return result; };
      });
      return { page, errors };
    }
    async function send(target, name, direct = false, textonly = true, extra = {}, keepState = false) {
      const { page, errors } = target;
      const received = await page.evaluate(keepState => {
        if (!keepState) users.clear();
        document.getElementById('leaderboard-content').textContent = '';
        const ticker = document.querySelector('.ticker-wrapper');
        if (ticker) ticker.remove();
        tickerInitialized = false; lastTickerUpdate = 0;
        window.__hits = 0;
        return window.__received;
      }, keepState);
      let payload = { id: ++id, type: 'discord', chatname: name, chatimg: pixel, chatmessage: 'hello', hasDonation: '$1.00', donoValue: 1, textonly, ...extra };
      if (!direct) payload = (await relay(payload)).payload;
      await deliver(page, payload);
      await page.waitForFunction(count => window.__received > count, received);
      await page.waitForTimeout(100);
      assert.deepEqual(errors, [], 'Page errors');
      const state = await page.evaluate(() => ({
        hits: window.__hits,
        keys: Array.from(users.keys()),
        stored: JSON.parse(localStorage.getItem(getStorageKey())).users.map(user => ({ name:user.name, type:user.type, avatarUrl:user.avatarUrl, messageCount:user.messageCount })),
        names: Array.from(document.querySelectorAll('.user-name, .ticker-name')).map(el => el.textContent.trim()),
        scores: Array.from(document.querySelectorAll('.score-number, .ticker-score')).map(el => el.textContent.trim()),
        avatars: Array.from(document.querySelectorAll('.user-avatar')).map(el => ({ src: el.getAttribute('src'), alt: el.alt, onload: el.getAttribute('onload') })),
        nameImages: document.querySelectorAll('.user-name img:not(.source-icon), .ticker-name img').length,
        nameHandlers: document.querySelectorAll('.user-name [onerror]:not(.source-icon), .ticker-name [onerror], .user-name [onload], .ticker-name [onload]').length,
        users: Array.from(users.values()).map(user => ({ name: user.name, messages: user.messageCount, donations: user.donations }))
      }));
      assert.ok(state.users.some(user => user.name === payload.chatname));
      assert.ok(state.keys.includes(payload.chatname + '-' + payload.type));
      assert.ok(state.stored.some(user => user.name === payload.chatname && user.type === payload.type && user.avatarUrl === payload.chatimg));
      return state;
    }
    for (const query of ['', '&layout=bar', '&layout=topbar', '&layout=full', '&layout=topbar&tickerscroll']) {
      const old = await open(query, false), fixed = await open(query, true);
      const ticker = query.includes('tickerscroll');
      const probe = ticker ? nameAttack : attributeAttack;
      const before = await send(old, probe, ticker);
      const after = await send(fixed, probe, ticker);
      assert.ok(before.hits > 0, query + ': positive control');
      assert.equal(after.hits, 0, query + ': candidate');
      assert.ok(after.names.length > 0, 'Name must render');
      assert.equal(after.nameHandlers, 0);
      const direct = await send(fixed, nameAttack, true);
      assert.equal(direct.hits, 0); assert.equal(direct.nameHandlers, 0);
      assert.ok(direct.names.every(name => name === ''));
      for (const name of ['Alice', 'A &amp; B', "O&#039;Brien", '👩🏽‍💻 🇺🇸', '&lt;b&gt;Viewer&lt;/b&gt;']) {
        for (const textonly of [true, false]) {
          assert.deepEqual(await send(fixed, name, false, textonly), await send(old, name, false, textonly), query + ': ' + name);
        }
      }
      const bold = await send(fixed, '<b>Viewer</b>', true);
      assert.ok(bold.names.every(name => name === 'Viewer'));
      const emoteName = 'Viewer <img class="regular-emote" src="' + pixel + '" alt="wave">';
      const emote = await send(fixed, emoteName, true);
      const oldEmote = await send(old, emoteName, true);
      assert.deepEqual(emote.names, oldEmote.names, 'Preserve text alongside name emotes');
      assert.equal(emote.nameImages, oldEmote.nameImages, 'Preserve name emotes');
      assert.ok(emote.nameImages > 0);
      const quote = await send(fixed, 'Alice "Ace"');
      if (!ticker) assert.equal(quote.avatars[0].alt, 'Alice "Ace"');
      for (const probe of ['</textarea><img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;', '<svg onload=alert(1)>']) {
        const result = await send(fixed, probe, true);
        assert.equal(result.hits, 0); assert.equal(result.nameHandlers, 0);
      }
      for (const extra of [
        { chatimg: 'x" onerror="alert(1)" x="' },
        { type: 'discord" onerror="alert(1)" x="' }
      ]) {
        if (ticker && extra.chatimg) continue;
        const oldResult = await send(old, 'Attribute probe', true, true, extra);
        assert.ok(oldResult.hits > 0, 'Attribute positive control');
        const fixedResult = await send(fixed, 'Attribute probe', true, true, extra);
        assert.equal(fixedResult.hits, 0, 'Attribute candidate');
      }
      // Names are identity keys, including literal entities and markup. Rendering
      // must not change aggregation, the persisted record, or the next update.
      const rawName = 'Alice "Ace" &amp; <b>Viewer</b> \u{1f1fa}\u{1f1f8}';
      await send(fixed, rawName, true);
      const twice = await send(fixed, rawName, true, true, {}, true);
      assert.deepEqual(twice.users, [{ name:rawName, messages:2, donations:2 }]);
      assert.deepEqual(twice.keys, [rawName + '-discord']);
      await fixed.page.reload({waitUntil:'domcontentloaded'});
      const restored = await fixed.page.evaluate(() => ({
        keys:Array.from(users.keys()), names:Array.from(users.values()).map(user => user.name),
        counts:Array.from(users.values()).map(user => user.messageCount), hits:window.__hits
      }));
      assert.deepEqual(restored, {keys:[rawName + '-discord'], names:[rawName], counts:[2], hits:0});
      await fixed.page.evaluate(() => {
        const original = processData;
        processData = function(data) { window.__received++; return original(data); };
      });
      const third = await send(fixed, rawName, true, true, {}, true);
      assert.deepEqual(third.users, [{ name:rawName, messages:3, donations:3 }]);
      results.push({ layout: query || 'corner', reproduced: true, candidateSafe: true, compatibility: 10, customHtmlName: bold.names[0] });
      await old.page.close(); await fixed.page.close();
      console.log('PASS ' + (query || 'corner'));
    }
    console.log('PASS leaderboard security, name compatibility, raw keys, persistence, reload and repeated updates');
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
