// Offline, real Dock/Featured delivery. Run with Playwright available.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, read } = require('./helpers/chat-security-harness.cjs');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const probe = '<img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
const literal = 'CHECK_MARKER <i>literal</i> &amp; &lt;b&gt; café 👋 ' + probe;
const rich = '<i style="color:red">reply &amp; context</i> <b>CHECK_MARKER</b> &lt;literal&gt; ' +
  '<span class="emote-container" style="position:relative;display:inline-block;vertical-align:middle">' +
  '<img class="regular-emote" alt="wave" width="28" height="28" src="' + pixel + '">' +
  '<img class="zero-width-emote-centered" alt="overlay" style="position:absolute;left:50%;transform:translateX(-50%);opacity:0.8" src="' + pixel + '"></span> ' +
  '<a class="chat-link" href="https://example.invalid/clip?a=1&amp;b=2" title="clip">link</a> ' +
  '<svg viewBox="0 0 10 10" style="fill:red;width:20px;height:20px"><path d="M0 0L10 10"/></svg>';
const variants = [
  ['dock.html', ''], ['dock.html', '&trim=200'], ['dock.html', '&normalize'],
  ['featured.html', ''], ['featured.html', '&stack=3']
];

(async () => {
  const server = await createStaticServer();
  let browser, passed = 0;
  const failures = [];
  async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failures.push(name + ': ' + error.message); console.error('FAIL ' + name + ': ' + error.message); }
  }
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);
    let id = 71000;
    async function withPage(file, query, action) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        // Even a claimed new URL version must not bypass the body check.
        await page.goto(server.baseUrl + '/' + file + '?session=FINAL_CHECK_OFFLINE&v=99.0.0' + query);
        await page.evaluate(() => {
          window.__bodyChecks = [];
          if (window.SocialStreamChatHTML) {
            const original = SocialStreamChatHTML.sanitize;
            SocialStreamChatHTML.sanitize = html => { __bodyChecks.push(html); return original(html); };
          }
        });
        await action(page);
        assert.deepEqual(errors, [], 'Page errors');
      } finally { await page.close(); }
    }
    async function send(page, mode, body, extra = {}) {
      const payload = { id: ++id, type: 'youtube', chatname: 'CheckViewer', chatbadges: [], chatmessage: body, ...extra };
      if (mode !== undefined) payload.textonly = mode;
      await deliver(page, payload);
      await page.waitForFunction(() => document.querySelector('.hl-content, .hl-message')?.textContent.includes('CHECK_MARKER'));
      await page.waitForTimeout(100);
      return page.evaluate(() => {
        const element = document.querySelector('.hl-content, .hl-message');
        return { text: element.textContent, html: element.innerHTML, hit: window.__securityExecuted, checks: __bodyChecks.length };
      });
    }
    for (const [file, query] of variants) {
      await check(file + query + ': direct legacy HTML injection is inert', () => withPage(file, query, async page => {
        const result = await send(page, undefined, '<b>CHECK_MARKER</b> ' + probe);
        assert.equal(result.hit, false, 'Old/custom HTML must not execute');
        assert.ok(result.html.includes('<b>CHECK_MARKER</b>'), 'Useful HTML must remain');
        assert.ok(!result.html.includes('onerror='));
        assert.equal(result.checks, 1, 'One final HTML check');
        if (file === 'dock.html') {
          assert.ok((await page.locator('.highlight-chat').first().evaluate(el => el.rawContents.chatmessage)).includes('onerror='), 'Only the local display copy is filtered');
        }
      }));
      if (process.argv.includes('--security-only')) continue;
      await check(file + query + ': plain body stays literal and bypasses filter', () => withPage(file, query, async page => {
        const result = await send(page, true, literal);
        assert.equal(result.hit, false);
        // Trimming is still a requested display transformation.
        assert.ok(result.text.startsWith('CHECK_MARKER <i>literal</i> &amp; &lt;b&gt; ' + (query.includes('normalize') ? 'cafe' : 'café') + ' 👋'));
        assert.ok(!/<(?:i|img|b)[\s>]/.test(result.html));
        assert.equal(result.checks, 0);
      }));
      for (const mode of [false, undefined]) {
        await check(file + query + ': replies, colors, emotes, links and SVG; flag=' + mode, () => withPage(file, query, async page => {
          const result = await send(page, mode, rich);
          assert.equal(result.hit, false);
          assert.equal(result.checks, 1);
          const view = await page.evaluate(() => {
            const el = document.querySelector('.hl-content, .hl-message');
            return {
              italic: el.querySelector('i')?.style.color, bold: el.querySelector('b')?.textContent,
              wrapper: el.querySelector('.emote-container')?.style.position,
              overlay: el.querySelector('.zero-width-emote-centered')?.style.transform,
              link: el.querySelector('a')?.getAttribute('href'),
              fill: el.querySelector('svg')?.style.fill, paths: el.querySelectorAll('svg path').length,
              images: el.querySelectorAll('img').length
            };
          });
          assert.equal(view.italic, 'red'); assert.equal(view.bold, 'CHECK_MARKER');
          assert.equal(view.wrapper, 'relative'); assert.equal(view.overlay, 'translateX(-50%)');
          assert.equal(view.link, 'https://example.invalid/clip?a=1&b=2');
          assert.equal(view.fill, 'red'); assert.equal(view.paths, 1); assert.equal(view.images, 2);
          assert.ok(result.text.includes('<literal>'));
        }));
      }
    }
    if (!process.argv.includes('--security-only')) {
      for (const mode of [true, false, undefined]) {
        await check('Dock history: flag=' + mode, () => withPage('dock.html', '', async page => {
          const body = mode ? literal : rich + probe;
          await deliver(page, { userHistory: [{ id: ++id, chatname: 'HistoryViewer', type: 'twitch', timestamp: Date.now(), chatmessage: body, textonly: mode }] });
          await page.waitForFunction(() => document.getElementById('messagesList')?.textContent.includes('CHECK_MARKER'));
          await page.waitForTimeout(100);
          assert.equal(await page.evaluate(() => __securityExecuted), false);
          assert.equal(await page.evaluate(() => __bodyChecks.length), mode ? 0 : 1);
          if (mode) assert.ok((await page.locator('#messagesList').textContent()).includes(literal));
          else assert.equal(await page.locator('#messagesList i').first().evaluate(el => el.style.color), 'red');
        }));
      }
      for (const file of ['dock.html', 'featured.html']) {
        await check(file + ': missing display helper falls back to literal text', () => withPage(file, '', async page => {
          await page.evaluate(() => { delete window.SocialStreamChatHTML; });
          const body = '<b>CHECK_MARKER</b> ' + probe;
          const result = await send(page, false, body);
          assert.equal(result.hit, false); assert.equal(result.text, body);
          assert.equal(result.checks, 0);
        }));
      }
      await check('Featured: canceled messages are not checked or displayed', () => withPage('featured.html', '', async page => {
        await page.evaluate(({ rich, probe }) => {
          for (let i = 0; i < 100; i++) processData({ contents: { id: 90000 + i, type: 'twitch', chatname: 'BurstViewer', chatbadges: [], textonly: false, chatmessage: rich + probe } });
          processData({ contents: { id: 90100, type: 'twitch', chatname: 'LastViewer', chatbadges: [], textonly: false, chatmessage: '<b>CHECK_MARKER final</b>' } });
        }, { rich, probe });
        await page.waitForFunction(() => document.getElementById('message')?.textContent === 'CHECK_MARKER final');
        assert.equal(await page.evaluate(() => __bodyChecks.length), 1);
        assert.equal(await page.evaluate(() => __securityExecuted), false);
      }));
      for (const mode of [true, false]) for (const extension of ['png', 'mp4']) {
        await check('Featured: generated attachment retained, flag=' + mode + ', ' + extension, () => withPage('featured.html', '', async page => {
          await deliver(page, { id: ++id, type: 'youtube', chatname: 'Attachment', chatbadges: [], textonly: mode, chatmessage: '', contentimg: '/fixture.' + extension });
          await page.waitForSelector('#message [data-content-image]', { state: 'attached' });
          assert.equal(await page.locator('#message [data-content-image]').evaluate(el => el.localName), extension === 'mp4' ? 'video' : 'img');
          assert.equal(await page.evaluate(() => __bodyChecks.length), 0, 'Generated attachment is not chat HTML');
        }));
      }
      await check('Sanitizer: safe formatting is stable; relay policy remains unchanged', () => withPage('featured.html', '', async page => {
        const result = await page.evaluate(rich => {
          const once = SocialStreamChatHTML.sanitize(rich);
          return { once, twice: SocialStreamChatHTML.sanitize(once), relay: filterXSS('<i style="color:red">reply</i>') };
        }, rich);
        assert.equal(result.once, result.twice);
        assert.equal(result.relay, '<i>reply</i>');
      }));
      const corpus = JSON.parse(read('tests/fixtures/xss-corpus.json'));
      corpus.push(
        { name: 'CSS expression', input: '<i style="color:red;width:expression(alert(1))">reply</i>', expectedText: 'reply' },
        { name: 'CSS encoded javascript URL', input: '<span style="background:url(&#106;avascript:alert(1))">reply</span>', expectedText: 'reply' },
        { name: 'attribute breakout in a safe style', input: '<i style="color:red;&quot; onmouseover=&quot;alert(1)">reply</i>', expectedText: 'reply' },
        { name: 'encoded safe style remains styled', input: '<i style="color:&#114;ed">reply</i>', mustContain: ['style="color:red;"'], expectedText: 'reply' },
        { name: 'malformed SVG style nesting', input: '<svg><p><style><img src=x onerror=alert(1)></style></p></svg>' },
        { name: 'noscript attribute breakout', input: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">' },
        { name: 'MathML nesting', input: '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">' }
      );
      await withPage('featured.html', '', async page => {
        for (const fixture of corpus) await check('Display sanitizer corpus: ' + fixture.name, async () => {
          const result = await page.evaluate(async fixture => {
            window.__xssHit = false;
            window.alert = window.confirm = window.prompt = window.__markXss = () => { window.__xssHit = true; };
            const sink = document.createElement('div'); document.body.appendChild(sink);
            sink.innerHTML = SocialStreamChatHTML.sanitize(fixture.input);
            await new Promise(resolve => setTimeout(resolve, 60));
            const unsafe = [];
            for (const node of sink.querySelectorAll('*')) {
              if (/^(script|style|iframe|object|embed|math|form|input|textarea|link|meta|foreignobject|animate|set|use|image)$/.test(node.localName)) unsafe.push(node.localName);
              for (const attr of node.attributes) {
                if (/^on/i.test(attr.name) || attr.name === 'srcdoc') unsafe.push(attr.name);
                if (/^(href|src)$/.test(attr.name) && /^\s*(?:javascript:|vbscript:|data:text\/html)/i.test(attr.value)) unsafe.push(attr.value);
                if (/^(srcset|style|fill|stroke)$/.test(attr.name) && /(?:javascript:|vbscript:|expression\s*\(|data:text\/html)/i.test(attr.value)) unsafe.push(attr.value);
              }
            }
            const result = { hit: __xssHit, html: sink.innerHTML, text: sink.textContent, unsafe };
            sink.remove(); return result;
          }, fixture);
          assert.equal(result.hit, false); assert.deepEqual(result.unsafe, []);
          if (fixture.expectedText !== undefined) assert.equal(result.text, fixture.expectedText);
          for (const snippet of fixture.mustContain || []) assert.ok(result.html.includes(snippet), snippet);
        });
      });
    }
  } finally { if (browser) await browser.close(); await closeServer(server.server); }
  console.log(passed + ' passed; ' + failures.length + ' failed');
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
