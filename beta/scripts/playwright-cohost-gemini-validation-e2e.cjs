const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4178;

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
    await page.selectOption('#providerSelect', 'gemini');
    await page.fill('#apiKey', '');
    await page.click('#startButton');

    await page.waitForFunction(() => {
      const errorEl = document.getElementById('error');
      return errorEl && /api key/i.test(errorEl.textContent || '');
    });

    const state = await page.evaluate(() => ({
      started: document.getElementById('startButton').dataset.started,
      errorText: document.getElementById('error').textContent.trim(),
      diagError: document.getElementById('diagError').textContent.trim(),
      focusedElementId: document.activeElement ? document.activeElement.id : ''
    }));

    assert(state.started !== 'true', 'Gemini should not start without an API key.');
    assert(/api key/i.test(state.errorText), 'Gemini missing-key feedback was not shown.');
    assert(/api key/i.test(state.diagError), 'Gemini diagnostics did not report missing API key.');
    assert(state.focusedElementId === 'apiKey', 'Gemini missing-key validation did not focus the API key field.');
    assert(blockedExternalRequests.length === 0, `External requests were attempted: ${blockedExternalRequests.join(', ')}`);

    console.log('PASS cohost gemini validation e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
