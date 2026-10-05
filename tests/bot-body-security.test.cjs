const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, read } = require('./helpers/chat-security-harness.cjs');
// Disable only the body check in a served positive control. Production stays untouched.
const source = read('bot.html');
const needle = 'renderedChatMessage = window.SocialStreamChatHTML ? SocialStreamChatHTML.sanitize(renderedChatMessage) : fallbackEscapeHtml(renderedChatMessage);';
assert.equal(source.split(needle).length, 2);
const original = source.replace(needle, '/* Historical unchecked body. */');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const probe = '<img src="' + pixel + '" onload="window.__securityExecuted=true">';
const emoji = '\u{1f1fa}\u{1f1f8} \u{1f469}\u{1f3fd}\u200d\u{1f4bb}';
const rich = 'CHECK_MARKER <i style="color:red">reply &amp; context</i> <b>bold</b> ' +
  '<span class="emote-container" style="position:relative;display:inline-block"><img alt="wave" width="28" height="28" src="' + pixel + '">' +
  '<img alt="overlay" style="position:absolute;left:50%;transform:translateX(-50%)" src="' + pixel + '"></span> ' + emoji;
(async () => {
  const server = await createStaticServer();
  let browser, checks = 0, id = 0;
  try {
    browser = await chromium.launch({ headless: true });
    const fixturePage = await browser.newPage();
    const video = Buffer.from(await fixturePage.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const stream = canvas.captureStream(10);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const parts = [];
      const done = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.ondataavailable = e => parts.push(e.data);
      recorder.start();
      canvas.getContext('2d').fillRect(0, 0, 32, 32);
      await new Promise(resolve => setTimeout(resolve, 200));
      recorder.stop(); await done;
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
    }));
    await fixturePage.close();
    assert.ok(video.length > 100);
    async function render(body, mode, options = {}) {
      const context = await browser.newContext();
      await configureContext(context, server.baseUrl);
      await context.route('**/probe.webm', route => route.fulfill({ contentType: 'video/webm', body: video }));
      if (options.original) await context.route('**/bot.html*', route => route.fulfill({ contentType: 'text/html', body: original }));
      if (options.missing) await context.route('**/shared/utils/chatHtml.js', route => route.abort());
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(server.baseUrl + '/bot.html?session=LOCAL_SECURITY_CHECK' + (options.stack ? '&stack=3' : '') + (options.websocket ? '&server' : ''));
        await page.evaluate(sideEffects => {
          window.__checks = [];
          window.__speechInputs = []; window.__spoken = []; window.__writes = [];
          if (sideEffects) {
            // Run the actual speech preparation and disk serialization; mock their I/O.
            TTS.speak = (text, allow) => window.__spoken.push({ text, allow });
            const speechMeta = TTS.speechMeta;
            TTS.speechMeta = (data, allow) => {
              window.__speechInputs.push({ body: data.chatmessage, name: data.chatname, allow });
              return speechMeta(data, allow);
            };
            newFileHandle = { createWritable: async () => ({
              write: async text => window.__writes.push(JSON.parse(text)), close: async () => {}
            }) };
          }
          if (window.SocialStreamChatHTML) {
            const sanitize = SocialStreamChatHTML.sanitize;
            SocialStreamChatHTML.sanitize = value => { window.__checks.push(value); return sanitize(value); };
          }
        }, !!options.sideEffects);
        const payload = { id: ++id, type: 'twitch', chatname: 'Viewer', chatmessage: body, tts: !!options.sideEffects };
        if (mode !== undefined) payload.textonly = mode;
        if (options.attachment) payload.contentimg = options.attachment;
        async function send(data) {
          if (options.websocket) {
            await page.waitForFunction(() => socketserver && typeof socketserver.deliver === 'function');
            await page.evaluate(data => socketserver.deliver(data), data);
          } else await deliver(page, data);
          await page.waitForTimeout(550);
        }
        await send(payload);
        if (options.followup) {
          await page.waitForTimeout(100);
          await send({ ...payload, id: ++id, chatmessage: options.followup, textonly: true });
        }
        await page.locator('#message').waitFor({ state: 'attached' });
        await page.waitForTimeout(180);
        if (options.attachment && options.attachment.endsWith('.webm')) {
          await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        }
        assert.deepEqual(errors, [], 'No page errors');
        return await page.locator('#message').evaluate(el => ({
          hit: window.__securityExecuted, checked: window.__checks,
          spoken: window.__spoken, speechInputs: window.__speechInputs,
          writes: window.__writes.map(data => ({ body: data.chatmessage, name: data.chatname })),
          rows: Array.from(document.querySelectorAll('#output .hl-message')).map(node => ({ text: node.textContent, images: node.querySelectorAll('img').length })),
          text: el.textContent, html: el.innerHTML,
          bold: el.querySelector('b')?.textContent, italic: el.querySelector('i')?.style.color,
          images: el.querySelectorAll('img').length, width: el.querySelector('img[alt="wave"]')?.width,
          wrapper: el.querySelector('.emote-container')?.style.position,
          overlay: el.querySelector('img[alt="overlay"]')?.style.transform,
          large: el.classList.contains('largeImage'),
          attachment: document.querySelector('#img') && {
            tag: document.querySelector('#img').tagName,
            src: document.querySelector('#img').getAttribute('src'),
            loaded: document.querySelector('#img').tagName === 'VIDEO' ? document.querySelector('#img').readyState >= 2 : document.querySelector('#img').naturalWidth > 0
          }
        }));
      } finally { await context.close(); }
    }
    function appearance(result) {
      const copy = { ...result }; delete copy.html; delete copy.checked; return copy;
    }
    for (const stack of [false, true]) {
      for (const mode of [false, undefined]) {
        const before = await render('CHECK_MARKER ' + probe, mode, { stack, original: true });
        const after = await render('CHECK_MARKER ' + probe, mode, { stack });
        assert.equal(before.hit, true, 'Original must execute the harmless marker: ' + JSON.stringify(before));
        assert.equal(after.hit, false);
        assert.ok(after.text.includes('CHECK_MARKER'));
        assert.ok(after.checked.includes('CHECK_MARKER ' + probe)); checks++;
        const richBefore = await render(rich, mode, { stack, original: true });
        const richAfter = await render(rich, mode, { stack });
        assert.equal(richAfter.images, 2);
        assert.deepEqual(appearance(richAfter), appearance(richBefore)); checks++;
      }
      const literal = 'CHECK_MARKER <b>literal</b> &amp; &#128512; ' + probe + ' ' + emoji;
      const plain = await render(literal, true, { stack });
      assert.equal(plain.text, literal); assert.equal(plain.images, 0); assert.equal(plain.hit, false);
      assert.ok(!plain.checked.includes(literal)); checks++;
      const missing = await render('CHECK_MARKER ' + probe, false, { stack, missing: true });
      assert.equal(missing.text, 'CHECK_MARKER ' + probe); assert.equal(missing.hit, false); checks++;
      for (const attachment of [pixel, server.baseUrl + '/probe.webm']) {
        for (const mode of [true, false]) {
          for (const body of ['', 'CHECK_MARKER']) {
            const before = await render(body, mode, { stack, attachment, original: true });
            const after = await render(body, mode, { stack, attachment });
            assert.deepEqual(appearance(after), appearance(before));
            assert.equal(after.attachment.loaded, true);
            assert.ok(!after.checked.some(value => /^<(img|video) /.test(value))); checks++;
          }
        }
      }
      const custom = await render('CHECK_MARKER <marquee>custom scrolling</marquee>', false, { stack });
      assert.ok(custom.text.includes('custom scrolling')); assert.ok(!custom.html.includes('<marquee')); checks++;
      const followup = 'NEXT <b>literal</b> &#128512; ' + emoji;
      const sequenceBefore = await render(rich, false, { stack, followup, original: true });
      const sequenceAfter = await render(rich, false, { stack, followup });
      assert.deepEqual(appearance(sequenceAfter), appearance(sequenceBefore));
      assert.equal(sequenceAfter.rows.length, stack ? 2 : 1);
      assert.equal(sequenceAfter.rows.at(-1).text, followup); checks++;
      for (const mode of [true, false, undefined]) {
        const speechBody = 'CHECK_MARKER <b>Hello</b> &amp; &#128512; ' + emoji;
        const before = await render(speechBody, mode, { stack, sideEffects: true, original: true });
        const after = await render(speechBody, mode, { stack, sideEffects: true });
        assert.deepEqual(after.speechInputs, [{ body: speechBody, name: 'Viewer', allow: true }]);
        assert.deepEqual(after.writes, [{ body: speechBody, name: 'Viewer' }]);
        assert.equal(after.spoken.length, 1, 'Speech must actually be prepared');
        assert.ok(after.spoken[0].text.includes('Hello'), 'Prepared speech includes message text: ' + JSON.stringify(after.spoken));
        assert.deepEqual(appearance(after), appearance(before)); checks++;
      }
    }
    for (const mode of [false, undefined]) {
      const before = await render('CHECK_MARKER ' + probe, mode, { websocket: true, original: true });
      const after = await render('CHECK_MARKER ' + probe, mode, { websocket: true });
      assert.equal(before.hit, true); assert.equal(after.hit, false);
      assert.ok(after.text.includes('CHECK_MARKER')); checks++;
    }
    console.log('PASS ' + checks + ' Bot security and compatibility cases');
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
