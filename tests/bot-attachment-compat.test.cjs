// Offline compatibility validation using ordinary media and URL characters.
// No executable injection payloads or live endpoints.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, read } = require('./helpers/chat-security-harness.cjs');
const source = read('bot.html');
const needle = "' + escapeContentImageUrl(data.contentimg) + '";
assert.equal(source.split(needle).length - 1, 4, 'Four attachment URL interpolations');
// Compare ordinary media with a served historical copy; never edit production.
const original = source.split(needle).join("' + data.contentimg + '");
const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const pixel = 'data:image/png;base64,' + pixelBase64;
(async () => {
  const server = await createStaticServer(); let browser, id = 0, checks = 0;
  try {
    browser = await chromium.launch({ headless: true });
    const fixture = await browser.newPage();
    const video = Buffer.from(await fixture.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const stream = canvas.captureStream(10), parts = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const done = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.ondataavailable = event => parts.push(event.data);
      recorder.start(); canvas.getContext('2d').fillRect(0, 0, 32, 32);
      await new Promise(resolve => setTimeout(resolve, 200)); recorder.stop(); await done;
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
    }));
    await fixture.close(); assert.ok(video.length > 100);
    async function render(url, body, mode, options = {}) {
      const context = await browser.newContext();
      await configureContext(context, server.baseUrl);
      await context.route('**/fixture.png*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(pixelBase64, 'base64') }));
      await context.route('**/fixture.webm*', route => route.fulfill({ contentType: 'video/webm', body: video }));
      if (options.original) await context.route('**/bot.html*', route => route.fulfill({ contentType: 'text/html', body: original }));
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(server.baseUrl + '/bot.html?session=LOCAL_ATTACHMENT_CHECK' + (options.stack ? '&stack' : '') + (options.websocket ? '&server' : ''));
        await page.evaluate(() => {
          window.__diskRows = [];
          window.__spoken = [];
          // Exercise production speech preparation without an audio service.
          TTS.speak = (text, allow) => window.__spoken.push({ text, allow });
          newFileHandle = { createWritable: async () => ({
            write: async text => window.__diskRows.push(JSON.parse(text)), close: async () => {}
          }) };
        });
        const payload = { id: ++id, type: 'youtube', chatname: 'Viewer', chatimg: pixel, chatmessage: body, contentimg: url, tts: !!options.tts };
        if (mode !== undefined) payload.textonly = mode;
        async function send(data) {
          if (options.websocket) {
            await page.waitForFunction(() => socketserver && typeof socketserver.deliver === 'function');
            await page.evaluate(data => socketserver.deliver(data), data);
          } else await deliver(page, data);
          await page.waitForTimeout(550);
        }
        await send(payload);
        await page.waitForFunction(() => {
          const el = document.getElementById('img');
          return el && (el.tagName === 'VIDEO' ? el.readyState >= 2 : el.naturalWidth > 0);
        });
        if (options.followup) {
          await send({ ...payload, id: ++id, contentimg: '', chatmessage: options.followup, textonly: true, tts: false });
        }
        const state = await page.evaluate(() => {
          const el = document.getElementById('img');
          return {
            src: el.getAttribute('src'), tag: el.tagName,
            body: document.getElementById('message').textContent,
            bodyImages: document.querySelectorAll('#message img').length,
            bold: document.querySelector('#message b')?.textContent,
            spoken: window.__spoken,
            rows: document.querySelectorAll('#output .hl-message').length,
            large: document.getElementById('message').classList.contains('largeImage'),
            attachments: document.querySelectorAll('#img').length,
            attributes: el.getAttributeNames().sort(),
            videoOptions: el.tagName === 'VIDEO' ? [el.autoplay, el.muted, el.loop] : null,
            disk: window.__diskRows.map(data => ({ contentimg: data.contentimg, name: data.chatname, body: data.chatmessage }))
          };
        });
        assert.deepEqual(errors, [], 'No page errors');
        assert.equal(state.attachments, 1);
        const expectedDisk = [{ contentimg: url, name: 'Viewer', body }];
        if (options.followup) expectedDisk.push({ contentimg: '', name: 'Viewer', body: options.followup });
        assert.deepEqual(state.disk, expectedDisk, 'Raw URL/name/body retained in saved JSON');
        return state;
      } finally { await context.close(); }
    }
    for (const stack of [false, true]) {
      for (const url of ['./fixture.png?one=1&two=2', './fixture.webm?one=1&two=2', pixel]) {
        for (const body of ['', 'ATTACHMENT_CHECK']) {
          for (const mode of [true, false, undefined]) {
            const before = await render(url, body, mode, { stack, original: true });
            const after = await render(url, body, mode, { stack });
            assert.deepEqual(after, before, 'Attachment compatibility');
            assert.equal(after.src, url); checks++;
          }
        }
      }
    }
    // Literal delimiters remain URL data; retain the historical single entity decode.
    for (const file of ['fixture.png', 'fixture.webm']) {
      const url = './' + file + '?label="Viewer\'s <clip>"&part=2&literal=&copy;';
      for (const body of ['', 'ATTACHMENT_CHECK']) {
        const result = await render(url, body, true);
        assert.equal(result.src, url.replace('&copy;', '\u00a9'));
        assert.deepEqual(result.attributes, file.endsWith('.png') ? ['id', 'onerror', 'src'] : ['autoplay', 'id', 'loop', 'muted', 'onerror', 'src']);
        checks++;
      }
    }
    const legacyQueries = [
      ['?one=1&amp;two=2', '?one=1&two=2'],
      ['?one=1&#38;two=2', '?one=1&two=2'],
      ['?one=1&#x26;two=2', '?one=1&two=2'],
      ['?nested=&amp;amp;', '?nested=&amp;'],
      ['?label=&quot;Viewer&#39;s&lt;clip&gt;&quot;', '?label="Viewer\'s<clip>"'],
      ['?one=1&notit=2&copy=3&copy;', '?one=1&notit=2&copy=3\u00a9']
    ];
    for (const file of ['fixture.png', 'fixture.webm']) {
      for (const [query, decoded] of legacyQueries) {
        const url = './' + file + query;
        const before = await render(url, '', false, { original: true });
        const after = await render(url, '', false);
        assert.deepEqual(after, before, 'Legacy URL display and file output');
        assert.equal(after.src, './' + file + decoded); checks++;
      }
    }
    const emoji = '\u{1f1fa}\u{1f1f8} \u{1f469}\u{1f3fd}\u200d\u{1f4bb}';
    for (const mode of [true, false, undefined]) {
      const body = 'Hello <b>Viewer</b> &amp; &#128512; ' + emoji;
      const url = './fixture.png?one=1&amp;two=2';
      const before = await render(url, body, mode, { original: true, tts: true });
      const after = await render(url, body, mode, { tts: true });
      assert.deepEqual(after, before);
      assert.equal(after.spoken.length, 1);
      assert.ok(after.spoken[0].text.includes('Hello'));
      if (mode) assert.equal(after.body, body);
      else assert.equal(after.bold, 'Viewer');
      assert.ok(after.body.includes(emoji)); checks++;
    }
    for (const url of ['./fixture.png?one=1&amp;two=2', './fixture.webm?one=1&#38;two=2']) {
      const followup = 'Next <b>literal</b> &#128512; ' + emoji;
      const before = await render(url, '', false, { original: true, stack: true, followup });
      const after = await render(url, '', false, { stack: true, followup });
      assert.deepEqual(after, before);
      assert.equal(after.rows, 2); assert.equal(after.body, followup); checks++;
      const viaSocket = await render(url, 'Socket message', true, { websocket: true });
      const viaFrame = await render(url, 'Socket message', true);
      assert.deepEqual(viaSocket, viaFrame); checks++;
    }
    console.log('PASS ' + checks + ' Bot attachment and message compatibility cases');
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
