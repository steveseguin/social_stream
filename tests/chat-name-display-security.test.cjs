// Real receiver pages and iframe delivery, with offline transport and harmless probes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { read, configureContext, deliver } = require('./helpers/chat-security-harness.cjs');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const attack = 'Viewer<img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
const corpus = JSON.parse(read('tests/fixtures/xss-corpus.json'));
const variants = [
  ['dock.html', ''], ['dock.html', '&largeavatar'], ['dock.html', '&compact'],
  ['dock.html', '&trimname=300'], ['featured.html', ''], ['featured.html', '&stack=3']
];
const names = [
  'A & B', 'A &amp; B', "O&#039;Brien", '&lt;Viewer&gt;', '👩🏽‍💻 🇺🇸',
  '<b>Bold</b>', '<span style="color:red;">Viewer</span>',
  'Viewer <img class="regular-emote" src="' + pixel + '" alt="wave">'
];

function positiveControl(file) {
  const source = read(file);
  const checked = file === 'dock.html'
    ? 'chatname = window.SocialStreamChatHTML ? SocialStreamChatHTML.sanitize(chatname) : escapeHtml(chatname || "");'
    : 'var renderedChatName = window.SocialStreamChatHTML ? SocialStreamChatHTML.sanitize(data.chatname) : escapeHtml(data.chatname);';
  assert.equal(source.split(checked).length, 2, 'Locate the name display check');
  // Disable only the name check in an isolated served copy, never the body sanitizer.
  return source.replace(checked, file === 'dock.html' ? '' : 'var renderedChatName = data.chatname;');
}

(async () => {
  const server = await createStaticServer();
  let browser, id = 872000, comparisons = 0, securityCases = 0;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);

    async function open(file, query, control = false) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (control) {
        await page.route('**/' + file + '*', route => route.fulfill({ contentType: 'text/html', body: positiveControl(file) }));
      }
      await page.addInitScript(() => {
        window.alert = window.confirm = window.prompt = window.__markXss = () => { window.__securityExecuted = true; };
      });
      await page.goto(server.baseUrl + '/' + file + '?session=NAME_CHECK_OFFLINE&v=99.0.0' + query, { waitUntil: 'domcontentloaded' });
      return { page, errors };
    }

    async function send(target, name, textonly, extra = {}) {
      const { page, errors } = target;
      const marker = 'NAME_CHECK_' + ++id;
      await page.evaluate(() => { window.__securityExecuted = false; });
      const payload = { id, type: 'youtube', chatname: name, chatmessage: marker, chatbadges: [], ...extra };
      if (textonly !== undefined) payload.textonly = textonly;
      await deliver(page, payload);
      await page.waitForFunction(marker => Array.from(document.querySelectorAll('.hl-content, .hl-message')).some(el => el.textContent === marker), marker);
      await page.waitForTimeout(100);
      assert.deepEqual(errors, [], 'No page errors');
      const result = await page.evaluate(marker => {
        const body = Array.from(document.querySelectorAll('.hl-content, .hl-message')).find(el => el.textContent === marker);
        const row = body.closest('.highlight-chat');
        const name = row.querySelector('.hl-name');
        return {
          hit: window.__securityExecuted,
          text: name ? name.textContent : '', html: name ? name.innerHTML : '',
          handlers: name ? Array.from(name.querySelectorAll('*')).flatMap(el => Array.from(el.attributes)).filter(a => /^on/i.test(a.name)).length : 0,
          badges: row.querySelectorAll('.hl-badge').length,
          storedName: row.rawContents ? row.rawContents.chatname : null,
          identity: row.dataset.chatname === undefined ? null : row.dataset.chatname
        };
      }, marker);
      if (page.url().includes('/dock.html')) {
        assert.equal(result.storedName, name, 'Do not rewrite the stored name');
        assert.equal(result.identity, name, 'Keep the original name for Dock actions');
      }
      return result;
    }

    for (const [file, query] of variants) {
      const old = await open(file, query, true);
      const fixed = await open(file, query);
      assert.equal((await send(old, attack, true)).hit, true, file + query + ': positive control must execute');
      for (const mode of [true, false, undefined]) {
        const result = await send(fixed, attack, mode);
        assert.equal(result.hit, false, file + query);
        assert.equal(result.handlers, 0, file + query);
        securityCases++;
        for (const name of names) {
          const before = await send(old, name, mode);
          const after = await send(fixed, name, mode);
          assert.deepEqual(after, before, file + query + ': ' + name + ', flag=' + mode);
          comparisons++;
        }
      }
      const badges = { chatbadges: [pixel] };
      const before = await send(old, 'BadgeViewer', true, badges);
      const after = await send(fixed, 'BadgeViewer', true, badges);
      assert.deepEqual(after, before, 'Badge rendering alongside the name');
      assert.equal(after.badges, 1);
      const unsupported = await send(fixed, '<marquee>Viewer</marquee>', true);
      assert.ok(!unsupported.html.includes('<marquee'));
      assert.ok(unsupported.text.includes('Viewer'));

      if (query === '') {
        for (const fixture of corpus) {
          const result = await send(fixed, fixture.input, true);
          assert.equal(result.hit, false, file + ': ' + fixture.name);
          assert.equal(result.handlers, 0, file + ': ' + fixture.name);
          securityCases++;
        }
      }
      await fixed.page.evaluate(() => { delete window.SocialStreamChatHTML; });
      const fallback = await send(fixed, attack, true);
      assert.equal(fallback.hit, false);
      assert.ok(fallback.text.includes(attack), 'Missing helper must show the name as literal text');
      securityCases++;
      await old.page.close();
      await fixed.page.close();
      console.log('PASS name display: ' + file + query);
    }
    console.log('PASS ' + securityCases + ' security cases and ' + comparisons + ' name compatibility comparisons');
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
