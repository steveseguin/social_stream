const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, read } = require('./helpers/chat-security-harness.cjs');
const files = ['overlay-bubbles', 'overlay-cards', 'overlay-neon-cyberpunk', 'overlay-particles', 'overlay-xacception'].map(name => 'themes/' + name + '.html');
// Isolate the old entity-decoding behavior without modifying production files.
const needle = "data.chatmessage ? fallbackEscapeHtml(data.chatmessage) : ''";
const legacy = "data.chatmessage ? data.chatmessage.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''";
const glyphs = '\u{1f600} \u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8} \u{1f1e8}\u{1f1e6} \u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const samples = ['&#128512;', '&amp; &lt;b&gt; &quot; &#39;', 'A & B < 3 > 1', '<b>literal</b>', glyphs, '&amp;#128512;', '"quotes" and \'apostrophes\'', '<img src="' + pixel + '" onload="window.__hits++">'];
const rich = '<i style="color:red">reply</i> <b>bold</b> &amp; ' + glyphs + '<img alt="wave" src="' + pixel + '">';
(async () => {
 const server = await createStaticServer(); let browser, id = 820000, checks = 0;
 try {
  browser = await chromium.launch({ headless: true });
  for (const file of files) {
   const source = read(file); assert.equal(source.split(needle).length, 2);
   const control = source.replace(needle, legacy);
   const context = await browser.newContext(); await configureContext(context, server.baseUrl);
   const errors = [];
   try {
    async function open(fixed) {
     const page = await context.newPage(); page.setDefaultTimeout(5000);
     page.on('pageerror', error => errors.push(error.message));
     await page.addInitScript(() => { window.__hits = 0; });
     if (!fixed) await page.route('**/' + file + '*', route => route.fulfill({ contentType: 'text/html', body: control }));
     await page.goto(server.baseUrl + '/' + file + '?session=TEXT_AUDIT&persistent'); return page;
    }
    const before = await open(false), after = await open(true);
    async function send(page, body, mode) {
     const marker = 'TEXT_CASE_' + (++id) + ' ';
     const data = {id, type:'twitch', chatname:'Viewer', chatmessage:marker + body, chatbadges:[]};
     if (mode !== undefined) data.textonly = mode;
     await deliver(page, data);
     const node = page.locator('.message .text').filter({ hasText: marker });
     await node.waitFor({ state:'attached' }); await page.waitForTimeout(50);
     assert.deepEqual(errors, []);
     return node.evaluate((el, marker) => ({text:el.textContent.slice(marker.length), images:el.querySelectorAll('img').length, bold:el.querySelector('b')?.textContent, italic:el.querySelector('i')?.style.color, hits:window.__hits}), marker);
    }
    assert.equal((await send(before, '&#128512;', true)).text, '\u{1f600}', 'Reproduce unintended decoding');
    for (const sample of samples) {
     const result = await send(after, sample, true);
     assert.equal(result.text, sample); assert.equal(result.images, 0); assert.equal(result.bold, undefined); assert.equal(result.hits, 0); checks++;
    }
    for (const mode of [false, undefined]) {
     assert.deepEqual(await send(after, rich, mode), await send(before, rich, mode)); checks++;
    }
    console.log('PASS ' + file);
   } finally { await context.close(); }
  }
  console.log('PASS '+checks+' browser checks; historical decoding reproduced in all five controls');
 } finally { if (browser) await browser.close(); await closeServer(server.server); }
})().catch(error => { console.error(error); process.exitCode=1; });
