const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4193;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function addInitScript(page) {
  await page.addInitScript(() => {
    const fakeEnumerateDevices = async () => ([
      { deviceId: 'fake-camera', kind: 'videoinput', label: 'Fake Camera', groupId: 'fake-video' },
      { deviceId: 'fake-mic', kind: 'audioinput', label: 'Fake Microphone', groupId: 'fake-audio' }
    ]);

    const fakeGetUserMedia = async (constraints = {}) => {
      const stream = new MediaStream();
      if (constraints.video) {
        const canvas = document.createElement('canvas');
        canvas.width = 768;
        canvas.height = 432;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#122033';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.fillText('SSN CONFIGURED LLM TEST', 70, 150);
        const canvasStream = canvas.captureStream ? canvas.captureStream(2) : new MediaStream();
        canvasStream.getVideoTracks().forEach((track) => stream.addTrack(track));
      }
      return stream;
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: fakeEnumerateDevices,
        getUserMedia: fakeGetUserMedia,
        getDisplayMedia: fakeGetUserMedia,
        addEventListener() {},
        removeEventListener() {}
      }
    });

    window.speechSynthesis = {
      speak() {},
      cancel() {},
      pause() {},
      resume() {},
      getVoices() {
        return [];
      },
      speaking: false,
      pending: false
    };
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
      this.text = text;
    };

    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      get() {
        return srcDescriptor.get.call(this);
      },
      set(value) {
        if (String(value || '').indexOf('vdo.socialstream.ninja') >= 0) {
          this.srcdoc = `
            <!DOCTYPE html><html><body><script>
            (function () {
              var chunks = {};
              function send(payload) {
                parent.postMessage({ dataReceived: { overlayNinja: payload } }, '*');
              }
              function reply(request) {
                var target = request.target;
                var hasImage = !!(request.images && request.images.length);
                var prompt = String(request.value || '');
                var response = hasImage
                  ? 'Configured LLM bridge received text plus image.'
                  : 'Configured LLM bridge received text only.';
                if (/visible|camera|image/i.test(prompt) && hasImage) {
                  response = 'I can use the attached camera frame.';
                } else if (/introduce yourself/i.test(prompt)) {
                  response = 'Hi, I am your SSN configured LLM co-host.';
                }
                send({ chatbotChunk: { target: target, value: response.slice(0, 18) } });
                send({ chatbotChunk: { target: target, value: response.slice(18) } });
                send({ chatbotResponse: { target: target, value: '' } });
              }
              window.addEventListener('message', function (event) {
                var payload = event.data && event.data.sendData && event.data.sendData.overlayNinja;
                if (!payload) return;
                if (payload.action === 'ssnBridgeChunk') {
                  var entry = chunks[payload.chunkId] || { total: payload.total, parts: [], count: 0 };
                  if (typeof entry.parts[payload.index] === 'undefined') entry.count++;
                  entry.parts[payload.index] = payload.value || '';
                  chunks[payload.chunkId] = entry;
                  if (entry.count < entry.total) return;
                  delete chunks[payload.chunkId];
                  try {
                    reply(JSON.parse(entry.parts.join('')));
                  } catch (e) {
                    send({ chatbotResponse: { target: 'unknown', value: JSON.stringify({ error: { message: e.message } }) } });
                  }
                  return;
                }
                if (payload.action === 'getAiPromptOverlays') {
                  send({ aiPromptOverlays: { target: payload.target, value: { version: 1, activeOverlay: '', order: [], overlays: {} } } });
                  return;
                }
                if (payload.action === 'chatbot') reply(payload);
              });
            }());
            <\/script></body></html>`;
          return;
        }
        srcDescriptor.set.call(this, value);
      }
    });
  });
}

async function waitForAssistantCount(page, count, timeout = 120000) {
  await page.waitForFunction((expectedCount) => {
    const nodes = document.querySelectorAll('#responses .assistant-message');
    return nodes.length >= expectedCount && nodes[nodes.length - 1].textContent.trim().length > 0;
  }, count, { timeout });
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await addInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/cohost.html?session=playwright-configured-llm`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#providerSelect');
    await page.selectOption('#providerSelect', 'configuredllm');

    let state = await page.evaluate(() => ({
      info: document.getElementById('configuredLLMInfo').textContent.trim(),
      testVisible: getComputedStyle(document.getElementById('configuredLLMTestContainer')).display !== 'none',
      apiDisabled: document.getElementById('apiKey').disabled,
      endpointVisible: getComputedStyle(document.getElementById('customEndpointContainer')).display !== 'none'
    }));
    assert(state.testVisible, 'Configured LLM test button should be visible.');
    assert(state.apiDisabled, 'Configured LLM should not ask for a separate API key.');
    assert(!state.endpointVisible, 'Configured LLM should not show custom endpoint controls.');
    assert(state.info.includes('playwright-configured-llm'), 'Configured LLM info should include the session id.');

    await page.click('#configuredLLMTest');
    await page.waitForFunction(() => document.getElementById('configuredLLMInfo').textContent.includes('Text request worked'), null, { timeout: 120000 });

    await page.selectOption('#audioSource', 'none');
    await page.selectOption('#videoSource', 'fake-camera');
    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });
    await waitForAssistantCount(page, 1);

    await page.click('#configuredLLMTest');
    await page.waitForFunction(() => document.getElementById('configuredLLMInfo').textContent.includes('Text + image request worked'), null, { timeout: 120000 });

    const beforePromptCount = await page.evaluate(() => document.querySelectorAll('#responses .assistant-message').length);
    await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send', null, { timeout: 30000 });
    await page.fill('.message-input', 'What can you do with the visible camera frame?');
    await page.evaluate(() => document.getElementById('sendButton').click());
    await waitForAssistantCount(page, beforePromptCount + 1);

    state = await page.evaluate(() => ({
      latestAssistant: Array.from(document.querySelectorAll('#responses .assistant-message')).pop().textContent.trim(),
      imageSupport: localStorage.getItem('configuredLLMImageSupport'),
      diagProvider: document.getElementById('diagProvider').textContent.trim(),
      diagState: document.getElementById('diagState').textContent.trim(),
      diagError: document.getElementById('diagError').textContent.trim()
    }));
    assert(/attached camera frame/i.test(state.latestAssistant), `Configured LLM prompt should send the active frame after image probe passes; got: ${state.latestAssistant}`);
    assert(state.imageSupport === 'supported', 'Image probe should persist supported state.');
    assert(state.diagProvider === 'SSN Configured LLM', 'Diagnostics should show SSN Configured LLM.');
    assert(state.diagState === 'connected', 'Configured LLM should remain connected.');
    assert(state.diagError === '-', 'Configured LLM should not show a diagnostic error.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);

    console.log('PASS cohost configured LLM e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
