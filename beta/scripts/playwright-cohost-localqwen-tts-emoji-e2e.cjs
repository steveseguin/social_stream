const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4211;

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
    const text = 'Hey there ' + String.fromCodePoint(0x1F60A) + String.fromCodePoint(0x2728);
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
    window.__spokenTexts = [];

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
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(utterance) {
          window.__spokenTexts.push(utterance.text);
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
      }
    });
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

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const blockedExternalRequests = await setupContext(context);
    const page = await context.newPage();

    await addInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#providerSelect');
    await page.waitForFunction(() => !!window.avatar);
    await page.evaluate(() => {
      window.__avatarEmotionLog = [];
      const originalSetEmotion = window.avatar.setEmotion.bind(window.avatar);
      const originalPulseEmotion = window.avatar.pulseEmotion.bind(window.avatar);
      window.avatar.setEmotion = function patchedSetEmotion(emotion, talking) {
        window.__avatarEmotionLog.push({ type: 'set', emotion, talking: !!talking });
        return originalSetEmotion(emotion, talking);
      };
      window.avatar.pulseEmotion = function patchedPulseEmotion(emotion, duration, talking) {
        window.__avatarEmotionLog.push({ type: 'pulse', emotion, talking: !!talking });
        return originalPulseEmotion(emotion, duration, talking);
      };
      localStorage.setItem('responseType_localqwen', 'audio');
    });

    await page.selectOption('#providerSelect', 'localqwen');
    await page.selectOption('#responseType', 'audio');
    await page.selectOption('#videoSource', 'fake-camera');
    await page.selectOption('#audioSource', 'fake-mic');

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true');
    await page.waitForFunction(() => document.querySelectorAll('#responses .assistant-message').length >= 1);
    await page.waitForFunction(() => window.__spokenTexts.length >= 1);

    const state = await page.evaluate(() => ({
      spokenTexts: window.__spokenTexts.slice(),
      avatarEmotionLog: window.__avatarEmotionLog.slice(),
      replyText: document.querySelector('#responses .assistant-message')?.textContent.trim() || '',
      voiceStatus: document.getElementById('voiceStatusLine').textContent.trim(),
      voiceOutputPreview: document.getElementById('voiceOutputPreview').textContent.trim()
    }));

    assert(/[\u{1F60A}\u2728]/u.test(state.replyText), 'The assistant reply should still include emoji in the chat transcript.');
    assert(state.spokenTexts.length >= 1, 'Browser TTS did not speak any sanitized text.');
    assert(state.spokenTexts.every((text) => !/[\u{1F60A}\u2728]/u.test(text)), `Browser TTS should not include emoji: ${state.spokenTexts.join(' | ')}`);
    assert(state.spokenTexts.some((text) => /Hey there/i.test(text)), 'Browser TTS did not preserve the spoken words.');
    assert(state.avatarEmotionLog.some((entry) => entry.emotion === 'celebrating' && entry.type === 'set'), 'Avatar did not switch to an emoji-driven emotion for TTS.');
    assert(!/😊|✨/u.test(state.voiceOutputPreview), 'Voice output preview should reflect sanitized speech text.');
    assert(blockedExternalRequests.length === 0, `External requests were attempted: ${blockedExternalRequests.join(', ')}`);

    console.log('PASS cohost local qwen tts emoji e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
