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
          this.setAttribute('data-mock-original-src', String(value));
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
                  sendPayload({ aiPromptOverlaysSaved: { target: payload.target || null, ok: true, updatedAt: Date.now() } });
                  return;
                }
                if (payload.action === 'getAiPromptOverlays') {
                  parent.__ssnAiPromptMockGetAttempts = (parent.__ssnAiPromptMockGetAttempts || 0) + 1;
                  if (parent.__ssnAiPromptMockGetAttempts <= (parent.__ssnAiPromptMockDropOverlayGets || 0)) return;
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
                var response;
                if (parent.__ssnAiPromptMockChatbotResponses && parent.__ssnAiPromptMockChatbotResponses.length) {
                  response = parent.__ssnAiPromptMockChatbotResponses.shift();
                } else {
                  response = parent.__ssnAiPromptMockChatbotResponse || '<!DOCTYPE html><html><body><div id="stream-smoke-ok">from streamed html</div></body></html>';
                }
                var finalDelay = typeof parent.__ssnAiPromptMockFinalDelay === 'number' ? parent.__ssnAiPromptMockFinalDelay : 500;
                if (!parent.__ssnAiPromptMockNoChunks) {
                  var chunkA = response.slice(0, Math.max(1, Math.floor(response.length / 2)));
                  var chunkB = response.slice(chunkA.length);
                  send('chatbotChunk', chunkA, 50);
                  send('chatbotChunk', chunkB || '<div id="stream-smoke-ok">from streamed html</div>', 150);
                }
                if (!parent.__ssnAiPromptMockNoFinal) {
                  send('chatbotResponse', response, finalDelay);
                  if (parent.__ssnAiPromptMockDuplicateFinal) send('chatbotResponse', response, finalDelay + 120);
                }
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

  const url = `http://${HOST}:${PORT}/aiprompt.html?session=test-room&aitimeout=1000`;
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
  const promptText = await page.$eval('#default-system-prompt', el => el.value);
  assert(promptText.includes('var label = params.get("label") || "dock";'), 'AI prompt bridge guidance should default live overlays to label=dock');
  assert(/ssnpatch[\s\S]{0,220}valid JSON/i.test(promptText), 'AI prompt should say ssnpatch blocks must be valid JSON');
  assert(/escape backslashes/i.test(promptText), 'AI prompt should tell the model to escape backslashes in ssnpatch JSON');
  const customLiveFeedTemplateLabels = await page.$$eval('textarea[id^="tmpl-"]', els => els
    .filter(el => /vdo\.socialstream\.ninja/.test(el.value) && /params\.get\("label"\)\s*\|\|\s*"(?!dock")/.test(el.value))
    .map(el => el.id));
  assert(customLiveFeedTemplateLabels.length === 0, `Template bridge labels should default to dock: ${customLiveFeedTemplateLabels.join(', ')}`);

  // Templates modal opens and lists entries.
  await page.click('#openTemplates');
  await page.waitForSelector('#templatesModal.visible');
  const templateCount = await page.$$eval('#templateGrid .template-card', els => els.length);
  assert(templateCount >= 6, `Expected >=6 templates, got ${templateCount}`);
  await page.click('#closeTemplates');

  // New pages from the same template should get stable unique overlay names.
  await page.click('#newPage');
  await page.click('#newPage');
  const pageNames = await page.$$eval('#pageList .page-tab', els => els.map(el => el.textContent.trim()));
  assert(new Set(pageNames).size === pageNames.length, `Overlay names should be unique: ${pageNames.join(', ')}`);
  assert(pageNames.includes('blank-canvas'), `Expected blank-canvas page, got: ${pageNames.join(', ')}`);
  assert(pageNames.includes('blank-canvas-2'), `Expected blank-canvas-2 page, got: ${pageNames.join(', ')}`);
  page.once('dialog', dialog => dialog.accept());
  await page.click('#deletePage');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'userRequest', null, { timeout: 3000 });
  await page.keyboard.type('delete-focus-ok');
  const deleteFocusValue = await page.$eval('#userRequest', el => el.value);
  assert(deleteFocusValue.includes('delete-focus-ok'), 'Deleting an overlay should leave the AI prompt textbox focusable');
  await page.$$eval('#pageList .page-tab', els => {
    const chat = els.find(el => el.textContent.trim() === 'chat-overlay');
    if (chat) chat.click();
  });
  await page.waitForFunction(() => document.getElementById('pageName').value === 'chat-overlay');

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
  await page.evaluate(() => {
    const f = document.getElementById('previewFrame');
    f.contentWindow.postMessage({
      dataReceived: {
        overlayNinja: {
          chatname: 'EmoteUser',
          chatmessage: 'hello <img id="emote-render-smoke" class="emote" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="emote">',
          textonly: false,
          type: 'youtube'
        }
      }
    }, '*');
  });
  await page.waitForFunction(() => {
    const f = document.getElementById('previewFrame');
    const feed = f && f.contentWindow && f.contentWindow.document.getElementById('feed');
    return !!(feed && feed.querySelector('#emote-render-smoke'));
  }, null, { timeout: 3000 });
  await page.evaluate(() => {
    const f = document.getElementById('previewFrame');
    f.contentWindow.postMessage({
      dataReceived: {
        overlayNinja: {
          chatname: 'TextOnlyUser',
          chatmessage: '<b id="textonly-should-not-render">literal</b>',
          textonly: true,
          type: 'youtube'
        }
      }
    }, '*');
  });
  await page.waitForFunction(() => {
    const f = document.getElementById('previewFrame');
    const feed = f && f.contentWindow && f.contentWindow.document.getElementById('feed');
    return !!(feed && feed.textContent.includes('<b id="textonly-should-not-render">literal</b>'));
  }, null, { timeout: 3000 });
  const textOnlyRendered = await page.evaluate(() => {
    const f = document.getElementById('previewFrame');
    const feed = f && f.contentWindow && f.contentWindow.document.getElementById('feed');
    return !!(feed && feed.querySelector('#textonly-should-not-render'));
  });
  assert(!textOnlyRendered, 'textonly chatmessage should not render as HTML');

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
  assert(/^HTML update applied/.test(finalStatus), `Expected final AI status, got: ${finalStatus}`);

  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      'Changing just the label.',
      '',
      '```ssnpatch',
      JSON.stringify({
        reply: 'Changed the label without rebuilding the file.',
        edits: [{
          find: '<div id="patch-target">Original label</div>',
          replace: '<div id="patch-target">Patched label</div>'
        }]
      }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: rename the label');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /^Patch update applied/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const patchedHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(patchedHtml.includes('Patched label'), 'ssnpatch should update the matched block');
  assert(patchedHtml.includes('window.handleOverlayPayload'), 'ssnpatch should preserve unrelated code');

  await page.evaluate(() => {
    document.getElementById('autoFixErrors').checked = false;
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      'Trying a malformed patch.',
      '',
      '```ssnpatch',
      '{"reply":"Bad patch","edits":[{"find":"<div id=\\"patch-target\\">Original label</div>","replace":"<div id=\\"patch-target\\">Patched \\ label</div>"}]}',
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: malformed json regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /Patch could not be applied/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const malformedPatchState = await page.evaluate(() => {
    const last = Array.from(document.querySelectorAll('.msg.assistant')).pop();
    return {
      status: document.getElementById('connectionStatus').textContent || '',
      message: last ? last.textContent || '' : '',
      html: document.getElementById('htmlEditor').value || ''
    };
  });
  assert(/Invalid patch JSON/.test(malformedPatchState.message), 'Malformed ssnpatch should surface a parse error');
  assert(malformedPatchState.message.indexOf('```ssnpatch') < 0, 'Malformed ssnpatch should not be shown raw to the user');
  assert(malformedPatchState.status.indexOf('AI response received') < 0, 'Malformed ssnpatch should not fall through as a normal AI response');
  assert(malformedPatchState.html.includes('Original label'), 'Malformed ssnpatch should not alter HTML');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```json',
      '{"reply":"Bad json patch","edits":[{"find":"<div id=\\"patch-target\\">Original label</div>","replace":"<div id=\\"patch-target\\">Patched \\ label</div>"}]}',
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: malformed json fence regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /Invalid patch JSON/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const malformedJsonFenceMessage = await page.evaluate(() => Array.from(document.querySelectorAll('.msg.assistant')).pop().textContent || '');
  assert(malformedJsonFenceMessage.indexOf('```json') < 0, 'Malformed patch-shaped json fence should not be shown raw');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```',
      '{"reply":"Bad unlabeled patch","edits":[{"find":"<div id=\\"patch-target\\">Original label</div>","replace":"<div id=\\"patch-target\\">Patched \\ label</div>"}]}',
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: malformed unlabeled fence regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /Invalid patch JSON/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const malformedBareFenceMessage = await page.evaluate(() => Array.from(document.querySelectorAll('.msg.assistant')).pop().textContent || '');
  assert(malformedBareFenceMessage.indexOf('```') < 0, 'Malformed unlabeled patch fence should not be shown raw');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div class="dupe">Same</div><div class="dupe">Same</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```ssnpatch',
      JSON.stringify({ reply: 'Duplicate find', edits: [{ find: '<div class="dupe">Same</div>', replace: '<div class="dupe">Changed</div>' }] }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: duplicate find regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /matched 2 times/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const duplicatePatchHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(!duplicatePatchHtml.includes('Changed'), 'Duplicate find patch should not partially apply');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```html',
      '<!DOCTYPE html><html><body><div id="patch-target">Wrong full rebuild</div></body></html>',
      '```',
      '```ssnpatch',
      JSON.stringify({ reply: 'Mixed output', edits: [{ find: '<div id="patch-target">Original label</div>', replace: '<div id="patch-target">Patched label</div>' }] }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: mixed html and patch regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /both ssnpatch and full HTML/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const mixedPatchHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(mixedPatchHtml.includes('Original label'), 'Mixed HTML+patch response should not apply');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = '<!DOCTYPE html><html><body><div id="patch-target">Wrong full rebuild</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
  });
  await page.fill('#userRequest', 'patch only: do not rebuild the file');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /patch-only output, but the AI returned full HTML/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const patchOnlyHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(patchOnlyHtml.includes('Original label'), 'patch-only requests should not apply full HTML responses');
  assert(!patchOnlyHtml.includes('Wrong full rebuild'), 'patch-only full HTML response should be rejected');
  await page.evaluate(() => {
    window.__ssnAiPromptMockChatbotResponse = [
      '```json',
      JSON.stringify({ answer: 'json is fine when it is not a patch' }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'Answer only, no HTML: return a small json example');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /^AI response received/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const plainJsonMessage = await page.evaluate(() => Array.from(document.querySelectorAll('.msg.assistant')).pop().textContent || '');
  assert(plainJsonMessage.includes('json is fine when it is not a patch'), 'Non-patch json answers should display normally');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = '```ssnpatch\n{"reply":"Truncated","edits":[{"find":"<div id=\\"patch-target\\">Original label</div>","replace":"<div id=\\"patch-target\\">Broken';
  });
  await page.fill('#userRequest', 'patch only: truncated patch regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /Invalid patch JSON/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const truncatedMessage = await page.evaluate(() => Array.from(document.querySelectorAll('.msg.assistant')).pop().textContent || '');
  assert(truncatedMessage.indexOf('```ssnpatch') < 0, 'Truncated patch-shaped response should not be shown raw');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```ssnpatch',
      '{"reply":"Bad first","edits":[{"find":"<div id=\\"patch-target\\">Original label</div>","replace":"<div id=\\"patch-target\\">Broken \\ label</div>"}]}',
      '```',
      '```ssnpatch',
      JSON.stringify({ reply: 'Valid second', edits: [{ find: '<div id="patch-target">Original label</div>', replace: '<div id="patch-target">Should not apply</div>' }] }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: invalid first valid second regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /Invalid patch JSON/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const twoFenceHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(!twoFenceHtml.includes('Should not apply'), 'Invalid first patch fence should fail closed before later valid fences');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```ssnpatch',
      JSON.stringify({
        reply: 'Remove handler',
        edits: [{
          find: '<script>window.handleOverlayPayload=function(){};</script>',
          replace: '<script>console.log("handler removed");</script>'
        }]
      }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: remove handler regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /removed window\.handleOverlayPayload/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const removeHandlerHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(removeHandlerHtml.includes('window.handleOverlayPayload'), 'Patch removing handler should not apply');
  await page.evaluate(() => {
    const source = '<!DOCTYPE html><html><body><script>function handlePayload(data){document.body.dataset.first="1";}window.handleOverlayPayload=handlePayload;<\/script></body></html>';
    const ta = document.getElementById('htmlEditor');
    ta.value = source;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockChatbotResponse = [
      '```ssnpatch',
      JSON.stringify({
        reply: 'Duplicate handler',
        edits: [{
          find: 'window.handleOverlayPayload=handlePayload;',
          replace: 'function handlePayload(data){document.body.dataset.second="1";}window.handleOverlayPayload=handlePayload;'
        }]
      }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: duplicate handler regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /duplicate handlePayload function/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const duplicateHandlerHtml = await page.$eval('#htmlEditor', el => el.value);
  assert((duplicateHandlerHtml.match(/function handlePayload/g) || []).length === 1, 'Duplicate handlePayload patch should not apply');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockNoChunks = true;
    window.__ssnAiPromptMockDuplicateFinal = true;
    window.__ssnAiPromptMockFinalDelay = 100;
    window.__ssnAiPromptMockChatbotResponse = [
      '```ssnpatch',
      JSON.stringify({ reply: 'Duplicate final', edits: [{ find: '<div id="patch-target">Original label</div>', replace: '<div id="patch-target">Duplicate final patched</div>' }] }, null, 2),
      '```'
    ].join('\n');
  });
  await page.fill('#userRequest', 'patch only: duplicate final regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /^Patch update applied/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  await page.waitForTimeout(350);
  const duplicateFinalHtml = await page.$eval('#htmlEditor', el => el.value);
  assert((duplicateFinalHtml.match(/Duplicate final patched/g) || []).length === 1, 'Duplicate final response should apply once only');
  await page.evaluate(() => {
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ssnAiPromptMockDuplicateFinal = false;
    window.__ssnAiPromptMockNoChunks = true;
    window.__ssnAiPromptMockFinalDelay = 1500;
    window.__ssnAiPromptMockChatbotResponse = '<!DOCTYPE html><html><body><div id="patch-target">Late response applied</div></body></html>';
  });
  await page.fill('#userRequest', 'return late html after timeout regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /^AI request timed out/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  await page.waitForTimeout(900);
  const lateResponseHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(!lateResponseHtml.includes('Late response applied'), 'Late response after timeout should be ignored');
  await page.evaluate(() => {
    const badPatch = [
      '```ssnpatch',
      '{"reply":"Still bad","edits":[{"find":"<div id=\\"patch-target\\">Original label</div>","replace":"<div id=\\"patch-target\\">Broken \\ label</div>"}]}',
      '```'
    ].join('\n');
    const ta = document.getElementById('htmlEditor');
    ta.value = '<!DOCTYPE html><html><body><div id="patch-target">Original label</div><script>window.handleOverlayPayload=function(){};<\/script></body></html>';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('autoFixErrors').checked = true;
    window.__ssnAiPromptMockNoChunks = true;
    window.__ssnAiPromptMockFinalDelay = 100;
    window.__ssnAiPromptMockChatbotResponses = [badPatch, badPatch, badPatch, badPatch];
  });
  const beforeAutoFixAssistants = await page.$$eval('.msg.assistant', els => els.length);
  await page.fill('#userRequest', 'patch only: auto fix exhaustion regression');
  await page.click('#sendPrompt');
  await page.waitForFunction(before => {
    const status = document.getElementById('connectionStatus').textContent || '';
    return /Invalid patch JSON/.test(status) && document.querySelectorAll('.msg.assistant').length >= before + 3;
  }, beforeAutoFixAssistants, { timeout: 8000 });
  const exhaustedCount = await page.$$eval('.msg.assistant', els => els.length);
  await page.waitForTimeout(1200);
  const exhaustedCountLater = await page.$$eval('.msg.assistant', els => els.length);
  assert(exhaustedCountLater === exhaustedCount, 'Auto-fix should stop after the retry budget is exhausted');
  await page.evaluate(() => {
    document.getElementById('autoFixErrors').checked = true;
    window.__ssnAiPromptMockChatbotResponses = null;
    window.__ssnAiPromptMockNoChunks = false;
    window.__ssnAiPromptMockNoFinal = false;
    window.__ssnAiPromptMockDuplicateFinal = false;
    window.__ssnAiPromptMockFinalDelay = 500;
    window.__ssnAiPromptMockChatbotResponse = '<!DOCTYPE html><html><body><div id="stream-smoke-ok">from streamed html</div></body></html>';
  });

  await page.evaluate(() => {
    window.__ssnAiPromptMockChatbotResponse = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="UTF-8"><title>Bad Label</title></head><body>',
      '<div id="auction-container"></div><iframe id="ssn_bridge" style="display:none;"></iframe>',
      '<script>(function(){',
      'var params = new URLSearchParams(location.search);',
      'var roomID = params.get("session") || "";',
      'var password = params.get("password") || "false";',
      'var label = params.get("label") || "smooth_auction_" + Date.now();',
      'var bridge = document.getElementById("ssn_bridge");',
      'if (roomID) bridge.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + encodeURIComponent(password) + "&view=" + encodeURIComponent(roomID) + "&label=" + encodeURIComponent(label) + "&noaudio&novideo&cleanoutput&room=" + encodeURIComponent(roomID);',
      'function handlePayload(data){ document.getElementById("auction-container").textContent = data && data.event || ""; }',
      'window.handleOverlayPayload = handlePayload;',
      'window.addEventListener("message", function(event){ var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja; if (payload) handlePayload(payload); });',
      '}());<\/script></body></html>'
    ].join('');
  });
  await page.fill('#userRequest', 'make an auction overlay');
  await page.click('#sendPrompt');
  await page.waitForFunction(() => /^HTML update applied/.test(document.getElementById('connectionStatus').textContent || ''), null, { timeout: 5000 });
  const reviewedHtml = await page.$eval('#htmlEditor', el => el.value);
  assert(/params\.get\("label"\)\s*\|\|\s*"meta"/.test(reviewedHtml), 'Generated HTML review should force auction overlays to label=meta');
  assert(!/smooth_auction/.test(reviewedHtml), 'Generated HTML review should remove random live overlay labels');

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
  assert(/[?&]label=aioverlay(?:&|$)/.test(copied), `Copied named overlay URL should use label=aioverlay: ${copied}`);

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
  assert(overlayBridgeLabel === 'aioverlay', `Named aioverlay should connect its wrapper bridge as label=aioverlay: ${overlayBridgeLabel}`);
  const overlayFrameSrc = await overlayPage.$eval('#overlayFrame', el => el.getAttribute('src') || el.src);
  assert(!/aioverlay\.html/i.test(overlayFrameSrc), `aioverlay should not load itself inside overlayFrame: ${overlayFrameSrc}`);
  const overlayFrameHandle = await overlayPage.$('#overlayFrame');
  const overlayInnerFrame = await overlayFrameHandle.contentFrame();
  await overlayInnerFrame.waitForSelector('#aioverlay-local-regression', { timeout: 3000 });
  const nestedVdoFrames = await overlayInnerFrame.$$eval('iframe', els => els.filter(el => /vdo\.socialstream\.ninja/i.test(el.getAttribute('data-mock-original-src') || el.src || '')).length);
  assert(nestedVdoFrames === 0, `Generated overlay iframe should not create its own VDO bridge inside aioverlay; got ${nestedVdoFrames}`);
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
  assert(activeOverlayBridgeLabel === 'aioverlay', `Active aioverlay should connect its wrapper bridge as label=aioverlay: ${activeOverlayBridgeLabel}`);
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

  // aioverlay should retry the remote package request if the bridge drops the first send before peers connect.
  const retryRemoteStore = {
    version: 1,
    activeOverlay: 'retry-overlay',
    order: ['retry-overlay'],
    overlays: {
      'retry-overlay': {
        id: 'retry-overlay',
        name: 'retry-overlay',
        slug: 'retry-overlay',
        html: '<!DOCTYPE html><html><body><div id="aioverlay-retry-regression">retry overlay loaded</div></body></html>',
        updatedAt: Date.now()
      }
    }
  };
  const retryPage = await context.newPage();
  await retryPage.addInitScript(store => {
    localStorage.removeItem('ssnAiPromptPagesV2');
    localStorage.removeItem('ssnAiPromptPagesV1');
    localStorage.setItem('__ssnAiPromptMockStore', JSON.stringify(store));
    window.__ssnAiPromptMockStore = store;
    window.__ssnAiPromptMockDropOverlayGets = 1;
    window.__ssnAiPromptMockGetAttempts = 0;
  }, retryRemoteStore);
  await retryPage.goto(`http://${HOST}:${PORT}/aioverlay.html?session=test-room&overlay=retry-overlay`, { waitUntil: 'domcontentloaded' });
  await retryPage.waitForSelector('#overlayFrame', { timeout: 5000 });
  const retryInnerFrame = await (await retryPage.$('#overlayFrame')).contentFrame();
  await retryInnerFrame.waitForSelector('#aioverlay-retry-regression', { timeout: 5000 });
  const retryAttempts = await retryPage.evaluate(() => window.__ssnAiPromptMockGetAttempts || 0);
  assert(retryAttempts >= 2, `aioverlay should retry dropped overlay package requests, got ${retryAttempts}`);
  const retryBridgeSrc = await retryPage.$eval('#bridgeFrame', el => el.getAttribute('data-mock-original-src') || el.src);
  assert(retryBridgeSrc.indexOf('&solo') >= 0 && retryBridgeSrc.indexOf('&notmobile') >= 0, `aioverlay bridge should use normal view-only params: ${retryBridgeSrc}`);
  assert(retryBridgeSrc.indexOf('&scene') === -1, `aioverlay bridge should not use scene mode for view-only overlay loading: ${retryBridgeSrc}`);
  await retryPage.close();

  const xssPage = await context.newPage();
  const xssConsoleErrors = [];
  xssPage.on('console', msg => { if (msg.type() === 'error') xssConsoleErrors.push(msg.text()); });
  await xssPage.addInitScript(() => {
    localStorage.removeItem('ssnAiPromptPagesV2');
    localStorage.removeItem('ssnAiPromptPagesV1');
    localStorage.setItem('__ssnAiPromptMockStore', JSON.stringify({ version: 1, activeOverlay: '', order: [], overlays: {} }));
    window.__ssnAiPromptMockStore = { version: 1, activeOverlay: '', order: [], overlays: {} };
    window.__aioverlayXssHit = false;
  });
  const maliciousOverlay = encodeURIComponent('<img src=x onerror="window.__aioverlayXssHit=true">');
  await xssPage.goto(`http://${HOST}:${PORT}/aioverlay.html?session=test-room&overlay=${maliciousOverlay}`, { waitUntil: 'domcontentloaded' });
  await xssPage.waitForFunction(() => window.__aioverlayXssHit === false, null, { timeout: 3000 });
  for (let i = 0; i < 50 && !xssConsoleErrors.some(text => /No saved AI overlay found/.test(text)); i++) {
    await xssPage.waitForTimeout(250);
  }
  assert(xssConsoleErrors.some(text => /No saved AI overlay found/.test(text)), 'aioverlay missing overlay should log to console');
  const xssHit = await xssPage.evaluate(() => window.__aioverlayXssHit);
  assert(!xssHit, 'aioverlay error should escape overlay query HTML');
  await xssPage.close();

  // No unexpected console or page errors from our own scripts (ignore iframe boom-test-error which is expected).
  const unexpected = [].concat(
    consoleErrors.filter(t => t.indexOf('boom-test-error') === -1 &&
      t.indexOf('VDO.Ninja') === -1 &&
      t.indexOf('Invalid patch JSON') === -1 &&
      t.indexOf('matched 2 times') === -1 &&
      t.indexOf('both ssnpatch and full HTML') === -1 &&
      t.indexOf('removed window.handleOverlayPayload') === -1 &&
      t.indexOf('duplicate handlePayload function') === -1 &&
      t.indexOf('AI request timed out') === -1 &&
      t.indexOf('No AI response arrived') === -1 &&
      t.indexOf('patch-only output') === -1),
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
