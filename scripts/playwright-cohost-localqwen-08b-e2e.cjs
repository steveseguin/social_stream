const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4177;

const FAKE_LOCAL_BROWSER_WORKER = `
let initCount = 0;

function reply(requestId, payload) {
  self.postMessage(Object.assign({ type: 'response', requestId, ok: true }, payload || {}));
}

self.onmessage = (event) => {
  const message = event.data || {};

  if (message.type === 'init') {
    initCount += 1;
    self.postMessage({ type: 'status', state: 'loading', message: 'Fake local model loading' });
    self.postMessage({ type: 'status', state: 'ready', message: 'Fake local model ready' });
    reply(message.requestId, {
      device: 'wasm',
      modelId: message.modelId || '',
      initCount
    });
    return;
  }

  if (message.type === 'generate') {
    const prompt = String(message.prompt || '').trim();
    const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];
    const text = 'AI:' + prompt + ' [images:' + images.length + ']';
    self.postMessage({ type: 'token', requestId: message.requestId, text });
    reply(message.requestId, {
      text,
      finishReason: 'stop',
      imageCount: images.length
    });
    return;
  }

  if (message.type === 'reset' || message.type === 'dispose') {
    reply(message.requestId, {});
  }
};
`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function setupContext(context) {
  const blockedExternalRequests = [];

  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const isHttp = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
    const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';

    if (requestUrl.pathname.endsWith('/local-browser-model-worker.js')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/javascript; charset=utf-8',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'same-origin'
        },
        body: FAKE_LOCAL_BROWSER_WORKER
      });
      return;
    }

    if (isHttp && !isLocal) {
      blockedExternalRequests.push(route.request().url());
      await route.abort();
      return;
    }

    await route.continue();
  });

  return blockedExternalRequests;
}

async function addInitScript(page) {
  await page.addInitScript(() => {
    function sanitize(value, depth = 0) {
      if (depth > 5) return '[max-depth]';
      if (typeof value === 'string') {
        if (value.startsWith('data:')) {
          return {
            kind: 'data-url',
            length: value.length,
            prefix: value.slice(0, 24)
          };
        }
        return value.length > 300 ? value.slice(0, 300) : value;
      }
      if (Array.isArray(value)) {
        return value.map((entry) => sanitize(entry, depth + 1));
      }
      if (value && typeof value === 'object') {
        const output = {};
        Object.keys(value).forEach((key) => {
          output[key] = sanitize(value[key], depth + 1);
        });
        return output;
      }
      return value;
    }

    window.__ssnWorkerLog = [];
    window.__ssnWorkerIds = 0;

    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.__workerId = ++window.__ssnWorkerIds;
        window.__ssnWorkerLog.push({
          event: 'construct',
          workerId: this.__workerId,
          url: String(url)
        });
        this.addEventListener('message', (event) => {
          window.__ssnWorkerLog.push({
            event: 'message',
            workerId: this.__workerId,
            data: sanitize(event.data)
          });
        });
      }

      postMessage(message, transfer) {
        window.__ssnWorkerLog.push({
          event: 'postMessage',
          workerId: this.__workerId,
          data: sanitize(message)
        });
        return super.postMessage(message, transfer);
      }

      terminate() {
        window.__ssnWorkerLog.push({
          event: 'terminate',
          workerId: this.__workerId
        });
        return super.terminate();
      }
    };

    const fakeEnumerateDevices = async () => ([
      { deviceId: 'fake-camera', kind: 'videoinput', label: 'Fake Camera', groupId: 'fake-video' },
      { deviceId: 'fake-mic', kind: 'audioinput', label: 'Fake Microphone', groupId: 'fake-audio' }
    ]);

    const fakeGetUserMedia = async (constraints = {}) => {
      const stream = new MediaStream();

      if (constraints.video) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#122033';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '28px sans-serif';
        ctx.fillText('Fake Camera', 24, 56);
        const canvasStream = canvas.captureStream ? canvas.captureStream(4) : new MediaStream();
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
  });
}

function findWorkerMessages(log, type, predicate) {
  return log.filter((entry) => {
    if (entry.event !== 'postMessage') return false;
    if (!entry.data || entry.data.type !== type) return false;
    return typeof predicate === 'function' ? predicate(entry) : true;
  });
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const blockedExternalRequests = await setupContext(context);
    const page = await context.newPage();

    page.on('console', (msg) => {
      console.log('PAGE_CONSOLE:', msg.type(), msg.text());
    });
    page.on('pageerror', (error) => {
      console.log('PAGE_ERROR:', error.message);
    });

    await addInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#providerSelect');
    await page.evaluate(() => {
      localStorage.setItem('responseType_localqwen', 'text');
    });
    await page.selectOption('#providerSelect', 'localqwen');
    await page.waitForFunction(() => document.getElementById('videoSource').disabled === true);
    await page.waitForFunction(() => document.getElementById('audioSource').disabled === true);
    await page.waitForFunction(() => document.getElementById('apiKey').disabled === true);

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true');
    await page.waitForFunction(() => document.getElementById('responses').textContent.includes('AI:Hi, introduce yourself in a sentence for me. Be friendly to me. [images:0]'));

    await page.fill('.message-input', 'Confirm the local qwen 0.8B model is active.');
    await page.press('.message-input', 'Enter');
    await page.waitForFunction(() => document.getElementById('responses').textContent.includes('AI:Confirm the local qwen 0.8B model is active. [images:0]'));

    const state = await page.evaluate(() => ({
      workerLog: window.__ssnWorkerLog.slice(),
      diagProvider: document.getElementById('diagProvider').textContent.trim(),
      diagEvent: document.getElementById('diagEvent').textContent.trim(),
      responses: document.getElementById('responses').textContent,
      videoDisabled: document.getElementById('videoSource').disabled,
      audioDisabled: document.getElementById('audioSource').disabled
    }));

    const initMessage = findWorkerMessages(state.workerLog, 'init', (entry) => entry.data.modelId === 'qwen3.5-0.8b-onnx')[0];
    assert(!!initMessage, 'Local Qwen 0.8B init was not sent.');
    assert(initMessage.data.runtime && initMessage.data.runtime.modelClass === 'Qwen3_5ForConditionalGeneration', 'Local Qwen 0.8B init did not use the Qwen runtime.');
    assert(initMessage.data.runtime && initMessage.data.runtime.dtype && initMessage.data.runtime.dtype.embed_tokens === 'q4', 'Local Qwen 0.8B init did not use the q4 runtime.');

    const generateMessages = findWorkerMessages(state.workerLog, 'generate');
    assert(generateMessages.length >= 2, 'Local Qwen 0.8B did not generate for greeting and manual prompt.');
    assert(generateMessages.every((entry) => Array.isArray(entry.data.images) && entry.data.images.length === 0), 'Local Qwen 0.8B should not attach vision frames.');
    assert(state.videoDisabled && state.audioDisabled, 'Local Qwen 0.8B should keep capture selectors disabled.');
    assert(state.diagProvider.toLowerCase().includes('qwen'), 'Diagnostics did not report Local Qwen.');
    assert(state.diagEvent.includes('generate.done'), 'Local Qwen 0.8B diagnostics did not report completion.');
    assert(state.responses.includes('[images:0]'), 'Local Qwen 0.8B response did not complete through the UI.');

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'false');

    const finalWorkerLog = await page.evaluate(() => window.__ssnWorkerLog.slice());
    const terminateCount = finalWorkerLog.filter((entry) => entry.event === 'terminate').length;
    assert(terminateCount >= 1, 'Stopping Local Qwen 0.8B did not terminate the worker.');
    assert(blockedExternalRequests.length === 0, `External requests were attempted: ${blockedExternalRequests.join(', ')}`);

    console.log('PASS cohost local qwen 0.8b e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
