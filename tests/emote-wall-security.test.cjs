const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, installRelay } = require('./helpers/chat-security-harness.cjs');

const root = path.resolve(__dirname, '..');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image = '<img src="' + pixel + '" alt="Wave" class="regular-emote">';
const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>';
const probe = '<img src="' + pixel + '" onload="window.__wallHits++">';
const glyphs = [
  '😀', '🇺🇸', '🇨🇦', '🇯🇵', '🇬🇧', '👋🏽', '👩🏽‍💻', '👨‍👩‍👧‍👦',
  '👩🏽‍❤️‍👨🏻', '👩🏻‍❤️‍💋‍👩🏽', '🏳️‍🌈', '❤️‍🔥', '1️⃣', '#️⃣',
  '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' // England flag
];
const samples = [
  { name: 'ordinary text', body: 'Hello & "quotes" 123 # *', expected: [] },
  { name: 'Unicode sequences', body: glyphs.join(' '), expected: glyphs },
  { name: 'adjacent Unicode sequences', body: glyphs.join(''), expected: glyphs },
  { name: 'duplicate emoji', body: '😀 😀', expected: ['😀', '😀'] },
  { name: 'typed HTML around emoji', body: '<b>😀</b>', expected: ['😀'] },
  { name: 'image emote', body: image, expected: [] },
  { name: 'SVG emote', body: svg, expected: [] },
  { name: 'mixed emotes', body: '😀 ' + image + ' ' + svg, expected: ['😀'] },
  { name: 'overlapping emote', body: image + '<img src="' + pixel + '" alt="Overlay" class="zero-width-emote">', expected: [] },
  { name: 'literal entities', body: '&#128512; &#x1f44b; &#127482;&#127480; &amp;', expected: [] },
  { name: 'emoji in typed attribute', body: '<span title="😀">hello</span>', expected: ['😀'] },
  { name: 'emoji in typed comment', body: '<!-- 😀 -->', expected: ['😀'] },
  { name: 'emoji in typed image alt', body: '<img src="' + pixel + '" alt="😀">', expected: ['😀'] }
];

async function testEmoteWall(browser, baseUrl) {
  const context = await browser.newContext();
  try {
    await configureContext(context, baseUrl);
    const relay = await installRelay(await context.newPage());
    const source = fs.readFileSync(path.join(root, 'emotes.html'), 'utf8');
    // Isolated positive control: restore only the vulnerable conversion in a served copy.
    const guard = /if \(data\.textonly === true\) \{\s*tmp\.textContent = data\.chatmessage;\s*\} else \{\s*tmp\.innerHTML = data\.chatmessage;\s*\}/;
    assert.ok(guard.test(source), 'Locate the production text-only guard');
    const unsafe = source.replace(guard, 'tmp.innerHTML = data.chatmessage;');
    const pageErrors = [];
    let id = 720000;

    async function open(html, suffix = '') {
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push(error.message));
      if (html) {
        await page.route('**/emotes.html*', route => route.fulfill({ contentType: 'text/html', body: html }));
      }
      await page.addInitScript(() => {
        window.__wallHits = 0;
        window.__wallReceived = 0;
        window.__wallErrors = [];
        window.alert = window.confirm = window.prompt = () => window.__wallHits++;
        console.error = (...args) => window.__wallErrors.push(args.map(String).join(' '));
      });
      await page.goto(baseUrl + '/emotes.html?session=EMOTE_WALL_OFFLINE&showtime=0' + suffix, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        const original = processData;
        processData = function (data) {
          window.__wallReceived++;
          return original(data);
        };
      });
      return page;
    }

    async function run(page, body, textonly, options = {}) {
      await page.evaluate(options => {
        // The output is the document body; retain its scripts and bridge iframe.
        mainOutputWindow.querySelectorAll('.emoji').forEach(node => node.remove());
        window.__wallHits = 0;
        window.__wallErrors = [];
        showdupes = options.showdupes !== false;
        emoteBurstSize = options.burst || 0;
        maxShow = options.limit || false;
      }, options);
      const received = await page.evaluate(() => window.__wallReceived);
      const message = { id: ++id, type: 'twitch', chatname: 'Viewer', chatmessage: body };
      if (textonly !== undefined) message.textonly = textonly;
      const { payload } = await relay(message);
      await deliver(page, payload);
      await page.waitForFunction(previous => window.__wallReceived > previous, received);
      await page.waitForTimeout(80);
      const result = await page.evaluate(() => ({
        hits: window.__wallHits,
        errors: window.__wallErrors,
        glyphs: Array.from(mainOutputWindow.querySelectorAll('.emoji')).map(node => node.textContent),
        images: Array.from(mainOutputWindow.querySelectorAll('img')).map(img => ({ src: img.src, alt: img.alt, className: img.className })),
        svgs: mainOutputWindow.querySelectorAll('svg').length,
        stackedImages: mainOutputWindow.querySelectorAll('.zero-width-parent img').length
      }));
      assert.deepEqual(result.errors, [], 'No swallowed production errors');
      assert.deepEqual(pageErrors, [], 'No browser errors');
      return result;
    }

    const baseline = await open(unsafe);
    const fixed = await open();
    assert.ok((await run(baseline, probe, true)).hits > 0, 'Exploit must execute in the positive control');
    assert.equal((await run(fixed, probe, true)).hits, 0, 'Text-only image handler must not execute');

    for (const sample of samples) {
      const result = await run(fixed, sample.body, true);
      assert.equal(result.hits, 0, sample.name);
      assert.deepEqual(result.images, [], sample.name);
      assert.equal(result.svgs, 0, sample.name);
      assert.deepEqual(result.glyphs, sample.expected, sample.name + ': preserve each complete emoji');
    }

    // False and absent flags retain rich emotes, attributes, stacking and entity decoding.
    for (const mode of [false, undefined]) {
      for (const sample of samples) {
        const before = await run(baseline, sample.body, mode);
        const after = await run(fixed, sample.body, mode);
        assert.deepEqual(after, before, sample.name + ' textonly=' + mode);
      }
      assert.equal((await run(fixed, image, mode)).images.length, 1);
      assert.equal((await run(fixed, svg, mode)).svgs, 1);
      assert.deepEqual((await run(fixed, glyphs.join(' '), mode)).glyphs, glyphs);
      assert.deepEqual((await run(fixed, '&#128512;', mode)).glyphs, ['😀']);
    }

    for (const options of [{ showdupes: false }, { burst: 3 }, { burst: 5, limit: 2 }]) {
      for (const mode of [true, false]) {
        const body = mode ? '😀 😀' : '😀 ' + image + ' ' + image;
        assert.deepEqual(await run(fixed, body, mode, options), await run(baseline, body, mode, options));
      }
    }

    const blocked = await open(undefined, '&bademotes=' + encodeURIComponent(glyphs[8] + ' ' + glyphs[1]));
    for (const mode of [true, false, undefined]) {
      const result = await run(blocked, [glyphs[0], glyphs[8], glyphs[1], glyphs[9]].join(' '), mode);
      assert.deepEqual(result.glyphs, [glyphs[0], glyphs[9]], 'Block complete emoji without blocking unrelated joined sequences');
    }

    const corpus = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/xss-corpus.json'), 'utf8'));
    corpus.push({ name: 'image load handler', input: probe });
    for (const fixture of corpus) {
      const result = await run(fixed, fixture.input, true);
      assert.equal(result.hits, 0, fixture.name);
      assert.deepEqual(result.images, [], fixture.name);
      assert.equal(result.svgs, 0, fixture.name);
      assert.equal(await fixed.evaluate(() => window.__securityExecuted), false, fixture.name);
    }
    console.log('PASS Emote Wall: ' + corpus.length + ' security cases, literal entities, complete Unicode emoji, rich emotes and wall options');
  } finally {
    await context.close();
  }
}

async function main() {
  const server = await createStaticServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await testEmoteWall(browser, server.baseUrl);
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
}

module.exports = { testEmoteWall };
if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
