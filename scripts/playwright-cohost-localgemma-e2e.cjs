const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4175;

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
    const text = 'AI:' + prompt + (images.length ? ' [vision:' + images.length + ']' : '');
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

async function addCohostInitScript(page) {
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

      if (constraints.audio) {
        try {
          const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
          const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
          if (audioContext) {
            const destination = audioContext.createMediaStreamDestination();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            gain.gain.value = 0.0001;
            oscillator.connect(gain);
            gain.connect(destination);
            oscillator.start();
            destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
          }
        } catch (_error) {}
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

    const noop = () => {};
    window.speechSynthesis = {
      speak(utterance) {
        setTimeout(() => utterance?.onstart && utterance.onstart(), 0);
        setTimeout(() => utterance?.onend && utterance.onend(), 20);
      },
      cancel: noop,
      pause: noop,
      resume: noop,
      getVoices() {
        return [];
      },
      speaking: false,
      pending: false
    };
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
      this.text = text;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    };

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

    await addCohostInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#providerSelect');
    await page.evaluate(() => {
      localStorage.setItem('responseType_localgemma', 'text');
      localStorage.setItem('responseType_localqwen', 'text');
    });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#providerSelect option')).some((option) => option.value === 'localgemma'));
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#videoSource option')).some((option) => option.value === 'fake-camera'));

    await page.selectOption('#providerSelect', 'localgemma');
    await page.selectOption('#responseType', 'text');
    await page.selectOption('#videoSource', 'fake-camera');
    await page.waitForFunction(() => !document.getElementById('videoSource').disabled);
    await page.waitForFunction(() => document.getElementById('apiKey').disabled === true);

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true');
    await page.waitForFunction(() => document.getElementById('diagProvider').textContent.toLowerCase().includes('gemma'));
    await page.waitForFunction(() => document.getElementById('responses').textContent.includes('AI:Hi, introduce yourself in a sentence for me. Be friendly to me.'));
    await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send');

    await page.fill('.message-input', 'Describe the visible scene briefly.');
    await page.press('.message-input', 'Enter');
    await page.waitForFunction(() => document.getElementById('responses').textContent.includes('AI:Describe the visible scene briefly.'));

    const gemmaState = await page.evaluate(() => ({
      workerLog: window.__ssnWorkerLog.slice(),
      diagProvider: document.getElementById('diagProvider').textContent.trim(),
      diagEvent: document.getElementById('diagEvent').textContent.trim(),
      responses: document.getElementById('responses').textContent
    }));

    const gemmaInit = findWorkerMessages(gemmaState.workerLog, 'init', (entry) => entry.data.modelId === 'gemma4-e2b-it-onnx')[0];
    assert(!!gemmaInit, 'Local Gemma init was not sent to the worker.');
    assert(gemmaInit.data.runtime && gemmaInit.data.runtime.modelClass === 'Gemma4ForConditionalGeneration', 'Local Gemma init did not use Gemma4 runtime.');
    assert(gemmaInit.data.remoteHost === 'https://largefiles.socialstream.ninja/', 'Local Gemma init did not use the self-hosted default origin.');

    const gemmaManualGenerate = findWorkerMessages(gemmaState.workerLog, 'generate', (entry) => entry.data.prompt === 'Describe the visible scene briefly.')[0];
    assert(!!gemmaManualGenerate, 'Local Gemma manual generate was not sent.');
    assert(Array.isArray(gemmaManualGenerate.data.images) && gemmaManualGenerate.data.images.length === 1, 'Local Gemma did not attach a vision frame.');
    assert(gemmaState.diagProvider.toLowerCase().includes('gemma'), 'Diagnostics did not report Local Gemma.');
    assert(gemmaState.diagEvent.includes('generate.done'), 'Local Gemma diagnostics did not report completion.');
    assert(gemmaState.responses.includes('[vision:1]'), 'Local Gemma response did not complete through the UI.');

    await page.selectOption('#providerSelect', 'localqwen');
    await page.waitForFunction(() => document.getElementById('videoSource').disabled === false);
    await page.waitForFunction(() => document.getElementById('diagProvider').textContent.toLowerCase().includes('qwen'));

    await page.fill('.message-input', 'Confirm local qwen is active.');
    await page.press('.message-input', 'Enter');
    await page.waitForFunction(() => document.getElementById('responses').textContent.includes('AI:Confirm local qwen is active.'));

    const qwenState = await page.evaluate(() => ({
      workerLog: window.__ssnWorkerLog.slice(),
      diagProvider: document.getElementById('diagProvider').textContent.trim(),
      diagEvent: document.getElementById('diagEvent').textContent.trim(),
      responses: document.getElementById('responses').textContent
    }));

    const terminateEvents = qwenState.workerLog.filter((entry) => entry.event === 'terminate');
    assert(terminateEvents.length >= 1, 'Switching away from Local Gemma did not terminate the old worker.');

    const qwenInit = findWorkerMessages(qwenState.workerLog, 'init', (entry) => String(entry.data.modelId || '').includes('qwen3.5-0.8b-onnx')).slice(-1)[0];
    assert(!!qwenInit, 'Local Qwen init was not sent after switching providers.');
    assert(qwenInit.data.runtime && qwenInit.data.runtime.modelClass === 'Qwen3_5ForConditionalGeneration', 'Local Qwen init did not use the Qwen runtime.');

    const qwenManualGenerate = findWorkerMessages(qwenState.workerLog, 'generate', (entry) => entry.data.prompt === 'Confirm local qwen is active.')[0];
    assert(!!qwenManualGenerate, 'Local Qwen manual generate was not sent.');
    assert(qwenManualGenerate.data.providerKey === 'localqwen', 'Local Qwen generate did not preserve the provider key.');
    assert(String(qwenManualGenerate.data.modelId || '').includes('qwen3.5-0.8b-onnx'), 'Local Qwen generate did not preserve the model id.');
    assert(Array.isArray(qwenManualGenerate.data.images) && qwenManualGenerate.data.images.length === 0, 'Local Qwen should not attach vision frames.');
    assert(await page.$eval('#videoSource', (element) => !element.disabled && element.value === 'fake-camera'), 'Switching to Local Qwen should keep the selected camera available for the stream.');
    assert(qwenState.diagProvider.toLowerCase().includes('qwen'), 'Diagnostics did not report Local Qwen.');
    assert(qwenState.diagEvent.includes('generate.done'), 'Local Qwen diagnostics did not report completion.');

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'false');

    const finalWorkerLog = await page.evaluate(() => window.__ssnWorkerLog.slice());
    const finalTerminateCount = finalWorkerLog.filter((entry) => entry.event === 'terminate').length;
    assert(finalTerminateCount >= 2, 'Stopping the stream did not terminate the active local worker.');
    assert(blockedExternalRequests.length === 0, `External requests were attempted: ${blockedExternalRequests.join(', ')}`);

    console.log('PASS cohost local gemma/qwen e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
