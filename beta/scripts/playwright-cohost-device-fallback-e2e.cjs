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
    const attemptLog = [];

    function buildVideoStream() {
      const stream = new MediaStream();
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#122033';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('Fallback Camera', 150, 170);
      const canvasStream = canvas.captureStream ? canvas.captureStream(2) : new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => stream.addTrack(track));
      return stream;
    }

    function buildAudioStream() {
      const stream = new MediaStream();
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
      return stream;
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        async enumerateDevices() {
          return [
            { deviceId: 'broken-camera-id', kind: 'videoinput', label: 'Broken Camera', groupId: 'video-1' },
            { deviceId: 'working-camera-id', kind: 'videoinput', label: 'Fallback Camera', groupId: 'video-2' },
            { deviceId: 'broken-mic-id', kind: 'audioinput', label: 'Broken Microphone', groupId: 'audio-1' },
            { deviceId: 'working-mic-id', kind: 'audioinput', label: 'Working Microphone', groupId: 'audio-2' }
          ];
        },
        async getUserMedia(constraints = {}) {
          attemptLog.push(JSON.parse(JSON.stringify(constraints || {})));
          if (constraints.video && constraints.video.deviceId && constraints.video.deviceId.exact) {
            throw new DOMException('Requested camera is no longer available.', 'OverconstrainedError');
          }
          if (constraints.audio && constraints.audio.deviceId && constraints.audio.deviceId.exact) {
            throw new DOMException('Requested microphone is no longer available.', 'OverconstrainedError');
          }
          if (constraints.video) {
            return buildVideoStream();
          }
          if (constraints.audio) {
            return buildAudioStream();
          }
          return new MediaStream();
        },
        async getDisplayMedia() {
          return buildVideoStream();
        },
        addEventListener() {},
        removeEventListener() {}
      }
    });

    window.__deviceAttemptLog = attemptLog;
  });
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
    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#providerSelect');

    await page.evaluate(() => {
      localStorage.setItem('selectedVideoId', 'broken-camera-id');
      localStorage.setItem('selectedAudioId', 'broken-mic-id');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#providerSelect');

    await page.evaluate(() => {
      const fakePublisher = {
        connected: false,
        startCalls: 0,
        stream: null,
        start() {
          this.startCalls += 1;
          this.connected = true;
          return Promise.resolve();
        },
        stop() {
          this.connected = false;
        },
        isConnected() {
          return this.connected;
        },
        sendPrompt() {
          return Promise.resolve();
        }
      };
      window.__fakePublisher = fakePublisher;
      window.createPublisherForProvider = function createFakePublisher(_providerName, activeStream) {
        fakePublisher.stream = activeStream;
        return fakePublisher;
      };
    });

    await page.selectOption('#providerSelect', 'customopenai');
    await page.fill('#customEndpoint', 'http://127.0.0.1:1234/v1');
    await page.dispatchEvent('#customEndpoint', 'input');
    await page.selectOption('#videoSource', 'broken-camera-id');
    await page.selectOption('#audioSource', 'broken-mic-id');

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });

    const state = await page.evaluate(() => ({
      videoValue: document.getElementById('videoSource').value,
      audioValue: document.getElementById('audioSource').value,
      previewTracks: document.getElementById('preview').srcObject ? document.getElementById('preview').srcObject.getTracks().map((track) => ({
        kind: track.kind,
        label: track.label
      })) : [],
      errorsVisible: document.getElementById('error').textContent.trim(),
      attemptLog: window.__deviceAttemptLog.slice(),
      publisherStartCalls: window.__fakePublisher.startCalls
    }));

    assert(state.publisherStartCalls === 1, 'Fallback device flow should still start the publisher once.');
    assert(state.videoValue !== 'none', 'Video selection should not fall back to none when generic camera fallback succeeds.');
    assert(state.audioValue !== 'none', 'Audio selection should not fall back to none when generic mic fallback succeeds.');
    assert(state.previewTracks.some((track) => track.kind === 'video'), 'Preview should contain a video track after camera fallback.');
    assert(state.previewTracks.some((track) => track.kind === 'audio'), 'Preview should contain an audio track after mic fallback.');
    assert(!/No audio or video selected/i.test(state.errorsVisible), 'UI should not surface the dummy no-device state after successful fallback.');
    assert(state.attemptLog.some((entry) => entry.video && entry.video.deviceId && entry.video.deviceId.exact === 'broken-camera-id'), 'Test should exercise the broken exact camera path.');
    assert(state.attemptLog.some((entry) => entry.video === true), 'Test should exercise the generic camera fallback path.');
    assert(state.attemptLog.some((entry) => entry.audio && entry.audio.deviceId && entry.audio.deviceId.exact === 'broken-mic-id'), 'Test should exercise the broken exact mic path.');
    assert(state.attemptLog.some((entry) => entry.audio && !entry.audio.deviceId), 'Test should exercise the generic mic fallback path.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);

    console.log('PASS cohost device fallback e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
