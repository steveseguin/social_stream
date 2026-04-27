const { chromium } = require('playwright');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4199;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addInitScript(() => {
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      get() {
        return srcDescriptor.get.call(this);
      },
      set(value) {
        if (String(value).includes('vdo.socialstream.ninja')) {
          srcDescriptor.set.call(this, 'about:blank');
          const frame = this;
          setTimeout(() => {
            const doc = frame.contentDocument;
            doc.open();
            doc.write(`<!DOCTYPE html><html><body><script>
              var chunks = {};
              function sendPayload(payload) {
                parent.postMessage({ dataReceived: { overlayNinja: payload } }, '*');
              }
              function sendMaybeChunked(payload) {
                var text = JSON.stringify(payload);
                var size = 800;
                if (text.length <= size) {
                  sendPayload(payload);
                  return;
                }
                var chunkId = 'mock-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
                var total = Math.ceil(text.length / size);
                for (var i = 0; i < total; i++) {
                  sendPayload({
                    action: 'ssnBridgeChunk',
                    chunkId: chunkId,
                    index: i,
                    total: total,
                    value: text.slice(i * size, (i + 1) * size)
                  });
                }
              }
              window.addEventListener('message', function (event) {
                var payload = event.data && event.data.sendData && event.data.sendData.overlayNinja;
                if (payload && payload.action === 'ssnBridgeChunk') {
                  var key = payload.chunkId;
                  var entry = chunks[key] || { total: payload.total, parts: [], received: 0 };
                  if (typeof entry.parts[payload.index] === 'undefined') entry.received++;
                  entry.parts[payload.index] = payload.value || '';
                  chunks[key] = entry;
                  if (entry.received < entry.total) return;
                  delete chunks[key];
                  payload = JSON.parse(entry.parts.join(''));
                }
                if (!payload) return;
                if (payload.action === 'saveAiPromptOverlays') {
                  parent.__ssnAiPromptMockSaveActions = (parent.__ssnAiPromptMockSaveActions || 0) + 1;
                  parent.__ssnAiPromptMockStore = payload.value || parent.__ssnAiPromptMockStore || null;
                  try { parent.localStorage.setItem('__ssnAiPromptMockStore', JSON.stringify(parent.__ssnAiPromptMockStore)); } catch (e) {}
                  return;
                }
                if (payload.action === 'getAiPromptOverlays') {
                  var mockStore = parent.__ssnAiPromptMockStore || null;
                  try { mockStore = mockStore || JSON.parse(parent.localStorage.getItem('__ssnAiPromptMockStore') || 'null'); } catch (e) {}
                  sendMaybeChunked({
                    aiPromptOverlays: {
                      target: payload.target || null,
                      value: mockStore || { version: 1, activeOverlay: '', order: [], overlays: {} }
                    }
                  });
                  return;
                }
                if (payload.action !== 'chatbot') return;
                function send(kind, value, delay) {
                  setTimeout(function () {
                    var out = {};
                    out[kind] = { target: payload.target, value: value };
                    sendPayload(out);
                  }, delay);
                }
                send('chatbotChunk', '<!DOCTYPE html>\\\\n<html>\\\\n<body>\\\\n', 50);
                send('chatbotChunk', '<div id="stream-smoke-ok">from streamed html</div>\\\\n', 150);
                send('chatbotResponse', '<!DOCTYPE html><html><body><div id="stream-smoke-ok">done</div></body></html>', 500);
              });
            <\/script></body></html>`);
            doc.close();
            if (typeof frame.onload === 'function') frame.onload(new Event('load'));
          }, 0);
          return;
        }
        srcDescriptor.set.call(this, value);
      }
    });
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const url = `http://${HOST}:${PORT}/aiprompt.html?session=test-room`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for core UI
  await page.waitForSelector('#pageList .page-tab');
  await page.waitForSelector('#previewFrame');
  await page.waitForFunction(() => window.__ssnAiPromptMockSaveActions === 1, null, { timeout: 3000 });
  const startupStore = await page.evaluate(() => window.__ssnAiPromptMockStore);
  assert(startupStore && startupStore.overlays && startupStore.overlays['chat-overlay'], 'Empty remote sync should publish the local active overlay once sync settles');

  // The app seeds with Chat overlay template. Ensure editor has HTML.
  const htmlLen = await page.$eval('#htmlEditor', el => el.value.length);
  assert(htmlLen > 200, `Editor should have template HTML (got length ${htmlLen})`);

  // Templates modal opens and lists entries.
  await page.click('#openTemplates');
  await page.waitForSelector('#templatesModal.visible');
  const templateCount = await page.$$eval('#templateGrid .template-card', els => els.length);
  assert(templateCount >= 6, `Expected >=6 templates, got ${templateCount}`);
  await page.click('#closeTemplates');

  // Tab switching works.
  await page.click('.tab[data-tab="code"]');
  const codeActive = await page.$eval('.tab-panel[data-tab="code"]', el => el.classList.contains('active'));
  assert(codeActive, 'Code tab should be active');
  await page.click('.tab[data-tab="preview"]');

  // Simulated event delivery: default seeded template is the Chat overlay.
  // Wait for the preview iframe to have its message listener attached (window.handleOverlayPayload is assigned once the template script runs).
  await page.waitForFunction(() => {
    const f = document.getElementById('previewFrame');
    return !!(f && f.contentWindow && typeof f.contentWindow.handleOverlayPayload === 'function');
  }, null, { timeout: 5000 });

  // Chat event: should produce a .row in the iframe's #feed.
  await page.click('.event-buttons button[data-event="chat"]');
  await page.waitForFunction(() => {
    const f = document.getElementById('previewFrame');
    const feed = f && f.contentWindow && f.contentWindow.document.getElementById('feed');
    return feed && feed.querySelectorAll('.row').length >= 1;
  }, null, { timeout: 3000 });

  // Follow event: the chat template ignores event-flagged messages (by design), so wrap handleOverlayPayload
  // to record everything it receives. The builder's postMessage still reaches the window listener in the iframe
  // — we'll install a secondary listener to verify delivery.
  await page.evaluate(() => {
    const f = document.getElementById('previewFrame');
    f.contentWindow.__lastPayloads = [];
    f.contentWindow.addEventListener('message', (e) => {
      const p = e.data && e.data.dataReceived && e.data.dataReceived.overlayNinja;
      if (p) f.contentWindow.__lastPayloads.push(p);
    });
  });
  await page.click('.event-buttons button[data-event="follow"]');
  await page.click('.event-buttons button[data-event="viewer_updates"]');
  await page.waitForTimeout(200);
  const received = await page.evaluate(() => {
    const f = document.getElementById('previewFrame');
    return f.contentWindow.__lastPayloads || [];
  });
  assert(received.length >= 2, `Simulated events should reach preview iframe, got ${received.length}`);
  const kinds = received.map(r => r.event).filter(Boolean);
  assert(kinds.indexOf('new_follower') >= 0, 'Follow payload should carry event=new_follower');
  assert(kinds.indexOf('viewer_updates') >= 0, 'Viewer payload should carry event=viewer_updates');

  // AI streaming: fake the VDO bridge and confirm chunks are visible before final response applies.
  await page.fill('#userRequest', 'Return a tiny HTML page for the streaming smoke test.');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => {
    const preview = Array.from(document.querySelectorAll('.msg.assistant .stream-preview')).pop();
    return preview && preview.textContent.includes('from streamed html');
  }, null, { timeout: 3000 });
  const streamMeta = await page.$eval('.msg.assistant:last-child .stream-meta', el => el.textContent);
  assert(/chunks/.test(streamMeta), `Streaming meta should show chunk count, got: ${streamMeta}`);
  await page.waitForFunction(() => document.getElementById('htmlEditor').value.includes('stream-smoke-ok'), null, { timeout: 3000 });
  const finalStatus = await page.$eval('#connectionStatus', el => el.textContent);
  assert(finalStatus === 'HTML update applied.', `Expected final AI status, got: ${finalStatus}`);

  // Error reporter: inject a broken template and confirm the console bar surfaces the error.
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><head></head><body><script>throw new Error("boom-test-error");<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#refreshPreview');
  await page.waitForSelector('#consoleBar.visible', { timeout: 3000 });
  const fixDisabled = await page.$eval('#fixError', el => el.disabled);
  assert(!fixDisabled, 'Fix last error button should become enabled after iframe error');

  // Copy URL button: override both clipboard and prompt so whichever path runs writes to a canary.
  await page.evaluate(() => {
    window.__copiedUrl = null;
    window.prompt = (_label, value) => { window.__copiedUrl = value; return value; };
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (t) => { window.__copiedUrl = t; return Promise.resolve(); } }
      });
    } catch (e) { /* fallback to prompt path */ }
  });
  await page.click('#copyOverlayUrl');
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => window.__copiedUrl);
  assert(copied, `Copy URL should have produced a value, got: ${copied}`);
  assert(copied.indexOf('aiprompt.html') === -1, `Copied URL should be the overlay, not the builder itself: ${copied}`);
  assert(/\.html/.test(copied), `Copied URL should point at an .html file: ${copied}`);
  assert(/[?&]label=dock(?:&|$)/.test(copied), `Copied named overlay URL should use label=dock: ${copied}`);

  // aioverlay should load same-browser local overlays even when ?session= is present.
  await page.evaluate(() => {
    localStorage.setItem('ssnAiPromptPagesV2', JSON.stringify({
      version: 2,
      activeId: 'page-local',
      pages: [{
        id: 'page-local',
        name: 'chat-overlay',
        html: '<!DOCTYPE html><html><body><div id="aioverlay-local-regression">local overlay loaded</div><script>window.addEventListener("message",function(e){var p=e.data&&e.data.dataReceived&&e.data.dataReceived.overlayNinja;if(p&&p.chatname){document.body.setAttribute("data-last-chat",p.chatname);}});<\/script></body></html>',
        updatedAt: Date.now()
      }]
    }));
  });
  const overlayPage = await context.newPage();
  await overlayPage.goto(`http://${HOST}:${PORT}/aioverlay.html?session=test-room&overlay=chat-overlay`, { waitUntil: 'domcontentloaded' });
  await overlayPage.waitForSelector('#overlayFrame', { timeout: 3000 });
  const overlayBridgeLabel = await overlayPage.$eval('#bridgeFrame', el => el.getAttribute('data-bridge-label'));
  assert(overlayBridgeLabel === 'dock', `Named aioverlay should connect its wrapper bridge as label=dock: ${overlayBridgeLabel}`);
  const overlayFrameHandle = await overlayPage.$('#overlayFrame');
  const overlayInnerFrame = await overlayFrameHandle.contentFrame();
  await overlayInnerFrame.waitForSelector('#aioverlay-local-regression', { timeout: 3000 });
  const overlayBridgeFrame = await (await overlayPage.$('#bridgeFrame')).contentFrame();
  await overlayBridgeFrame.evaluate(() => {
    parent.postMessage({ dataReceived: { overlayNinja: { chatname: 'WrapperTester', chatmessage: 'hello', type: 'youtube' } } }, '*');
  });
  await overlayInnerFrame.waitForSelector('body[data-last-chat="WrapperTester"]', { timeout: 3000 });
  await overlayPage.close();

  const activeOverlayPage = await context.newPage();
  await activeOverlayPage.goto(`http://${HOST}:${PORT}/aioverlay.html?session=test-room`, { waitUntil: 'domcontentloaded' });
  await activeOverlayPage.waitForSelector('#overlayFrame', { timeout: 3000 });
  const activeOverlayBridgeLabel = await activeOverlayPage.$eval('#bridgeFrame', el => el.getAttribute('data-bridge-label'));
  assert(activeOverlayBridgeLabel === 'dock', `Active aioverlay should connect its wrapper bridge as label=dock: ${activeOverlayBridgeLabel}`);
  const activeInnerFrame = await (await activeOverlayPage.$('#overlayFrame')).contentFrame();
  await activeInnerFrame.waitForSelector('#aioverlay-local-regression', { timeout: 3000 });
  await activeOverlayPage.close();

  // Remote extension responses can exceed bridge message size; aioverlay should reassemble chunked stores.
  const remoteChunkPage = await context.newPage();
  const largeRemoteStore = {
    version: 1,
    activeOverlay: 'remote-overlay',
    order: ['remote-overlay'],
    overlays: {
      'remote-overlay': {
        id: 'remote-overlay',
        name: 'remote-overlay',
        slug: 'remote-overlay',
        html: '<!DOCTYPE html><html><body><div id="aioverlay-remote-chunk">remote chunk loaded</div><pre>' + 'x'.repeat(5000) + '</pre></body></html>',
        updatedAt: Date.now()
      }
    }
  };
  await remoteChunkPage.addInitScript(store => {
    localStorage.removeItem('ssnAiPromptPagesV2');
    localStorage.removeItem('ssnAiPromptPagesV1');
    localStorage.setItem('__ssnAiPromptMockStore', JSON.stringify(store));
    window.__ssnAiPromptMockStore = store;
  }, largeRemoteStore);
  await remoteChunkPage.goto(`http://${HOST}:${PORT}/aioverlay.html?session=test-room&overlay=remote-overlay`, { waitUntil: 'domcontentloaded' });
  try {
    await remoteChunkPage.waitForSelector('#overlayFrame', { timeout: 3000 });
    const remoteInnerFrame = await (await remoteChunkPage.$('#overlayFrame')).contentFrame();
    await remoteInnerFrame.waitForSelector('#aioverlay-remote-chunk', { timeout: 3000 });
  } catch (error) {
    const debug = await remoteChunkPage.evaluate(() => ({
      iframes: Array.prototype.slice.call(document.querySelectorAll('iframe')).map(frame => frame.src),
      mockStore: !!window.__ssnAiPromptMockStore,
      mockLocalLength: (localStorage.getItem('__ssnAiPromptMockStore') || '').length,
      errorText: (document.getElementById('error') && document.getElementById('error').textContent) || '',
      bodyStart: ((document.body && document.body.innerHTML) || '').slice(0, 300)
    }));
    throw new Error('Chunked remote overlay did not load. Debug: ' + JSON.stringify(debug).slice(0, 2500));
  }
  await remoteChunkPage.close();

  const xssPage = await context.newPage();
  await xssPage.addInitScript(() => {
    localStorage.removeItem('ssnAiPromptPagesV2');
    localStorage.removeItem('ssnAiPromptPagesV1');
    localStorage.setItem('__ssnAiPromptMockStore', JSON.stringify({ version: 1, activeOverlay: '', order: [], overlays: {} }));
    window.__ssnAiPromptMockStore = { version: 1, activeOverlay: '', order: [], overlays: {} };
    window.__aioverlayXssHit = false;
  });
  const maliciousOverlay = encodeURIComponent('<img src=x onerror="window.__aioverlayXssHit=true">');
  await xssPage.goto(`http://${HOST}:${PORT}/aioverlay.html?session=test-room&overlay=${maliciousOverlay}`, { waitUntil: 'domcontentloaded' });
  await xssPage.waitForFunction(() => {
    const error = document.getElementById('error');
    return error && /No saved AI overlay found/.test(error.textContent || '');
  }, null, { timeout: 3000 });
  const xssHit = await xssPage.evaluate(() => window.__aioverlayXssHit);
  assert(!xssHit, 'aioverlay error should escape overlay query HTML');
  await xssPage.close();

  // No unexpected console or page errors from our own scripts (ignore iframe boom-test-error which is expected).
  const unexpected = [].concat(
    consoleErrors.filter(t => t.indexOf('boom-test-error') === -1 && t.indexOf('VDO.Ninja') === -1),
    pageErrors.filter(t => t.indexOf('boom-test-error') === -1)
  );
  // Allow errors from the VDO bridge iframe trying to load (no network to vdo.ninja in headless)
  const strictlyUnexpected = unexpected.filter(t => !/vdo\.ninja|Failed to fetch|net::ERR/i.test(t));
  if (strictlyUnexpected.length) {
    console.error('Unexpected errors:', strictlyUnexpected);
    throw new Error('Unexpected console/page errors from aiprompt.html');
  }

  console.log('aiprompt.html smoke test passed.');
  await browser.close();
  server.close();
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
