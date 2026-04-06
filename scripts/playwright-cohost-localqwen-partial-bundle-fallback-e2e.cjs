const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4213;

const FAKE_LOCAL_BROWSER_WORKER = `
function reply(requestId, payload) {
  self.postMessage(Object.assign({ type: 'response', requestId, ok: true }, payload || {}));
}

self.onmessage = (event) => {
  const message = event.data || {};

  if (message.type === 'init') {
    self.postMessage({ type: 'status', state: 'loading', message: 'Fake local model loading' });
    self.postMessage({ type: 'status', state: 'ready', message: 'Fake local model ready' });
    reply(message.requestId, {
      device: 'wasm',
      modelId: message.modelId || ''
    });
    return;
  }

  if (message.type === 'generate') {
    const text = 'AI ready';
    self.postMessage({ type: 'token', requestId: message.requestId, text });
    reply(message.requestId, {
      text,
      finishReason: 'stop'
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

    if (requestUrl.pathname.endsWith('/thirdparty/models/qwen3.5-0.8b-onnx/onnx/embed_tokens_q4.onnx_data')) {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain; charset=utf-8',
        body: 'missing'
      });
      return;
    }

    if (isHttp && !isLocal && requestUrl.hostname !== 'largefiles.socialstream.ninja') {
      await route.abort();
      return;
    }

    await route.continue();
  });
}

async function addInitScript(page) {
  await page.addInitScript(() => {
    function sanitize(value, depth = 0) {
      if (depth > 5) return '[max-depth]';
      if (typeof value === 'string') {
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

    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.addEventListener('message', (event) => {
          window.__ssnWorkerLog.push({
            event: 'message',
            data: sanitize(event.data)
          });
        });
      }

      postMessage(message, transfer) {
        window.__ssnWorkerLog.push({
          event: 'postMessage',
          data: sanitize(message)
        });
        return super.postMessage(message, transfer);
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

    class FakeSpeechRecognition {
      constructor() {
        this.continuous = true;
        this.interimResults = true;
        this.maxAlternatives = 1;
        this.lang = 'en-US';
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
        this.onresult = null;
      }
      start() {
        setTimeout(() => this.onstart && this.onstart(), 0);
      }
      stop() {
        setTimeout(() => this.onend && this.onend(), 0);
      }
    }

    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  });
}

function findWorkerMessages(log, type) {
  return log.filter((entry) => entry.event === 'postMessage' && entry.data && entry.data.type === type);
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await setupContext(context);
    const page = await context.newPage();

    await addInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#providerSelect');
    await page.selectOption('#providerSelect', 'localqwen');
    await page.selectOption('#videoSource', 'fake-camera');
    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true');

    const workerLog = await page.evaluate(() => window.__ssnWorkerLog.slice());
    const initMessage = findWorkerMessages(workerLog, 'init')[0];
    assert(!!initMessage, 'Local Qwen init was not sent.');
    assert(initMessage.data.modelId === 'qwen3.5-0.8b-onnx', `Local Qwen should fall back to the self-hosted model id when the bundled files are incomplete, received: ${initMessage.data.modelId}`);

    console.log('PASS cohost local qwen partial bundle fallback e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
