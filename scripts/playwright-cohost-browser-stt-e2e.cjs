const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4194;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function installBrowserFakes(page, speechSupported) {
  await page.addInitScript(({ speechSupported }) => {
    window.__fakeAudioResources = [];
    const enumerateDevices = async () => ([
      { deviceId: 'fake-mic', kind: 'audioinput', label: 'Fake Browser Microphone', groupId: 'fake-audio' }
    ]);
    const getUserMedia = async (constraints = {}) => {
      const stream = new MediaStream();
      if (constraints.audio) {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        window.__fakeAudioResources.push({ context, destination });
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
      return stream;
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices,
        getUserMedia,
        getDisplayMedia: getUserMedia,
        addEventListener() {},
        removeEventListener() {}
      }
    });

    if (speechSupported) {
      class FakeSpeechRecognition {
        constructor() {
          this.continuous = true;
          this.interimResults = true;
          this.maxAlternatives = 1;
          this.lang = 'en-US';
          this.onstart = null;
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          this.running = false;
          this.emitted = false;
        }
        start() {
          if (this.running) {
            const error = new Error('Recognition is already running.');
            error.name = 'InvalidStateError';
            throw error;
          }
          this.running = true;
          setTimeout(() => {
            if (this.running && typeof this.onstart === 'function') this.onstart();
          }, 0);
          if (!this.emitted) {
            this.emitted = true;
            setTimeout(() => {
              if (!this.running || typeof this.onresult !== 'function') return;
              const alternative = { transcript: 'Chrome browser voice works', confidence: 0.98 };
              const result = [alternative];
              result.isFinal = true;
              this.onresult({ resultIndex: 0, results: [result] });
            }, 300);
          }
        }
        stop() {
          if (!this.running) return;
          this.running = false;
          setTimeout(() => {
            if (typeof this.onend === 'function') this.onend();
          }, 0);
        }
        abort() {
          this.stop();
        }
      }
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeSpeechRecognition });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeSpeechRecognition });
    } else {
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
    }
  }, { speechSupported });
}

async function configurePage(page, session) {
  await page.goto(`http://${HOST}:${PORT}/cohost.html?session=${session}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const audio = document.getElementById('audioSource');
    return audio && Array.from(audio.options).some(option => option.value !== 'none');
  });
  await page.evaluate(() => {
    window.__browserSttPrompts = [];
    probeConfiguredLLMBridge = function () { return Promise.resolve(); };
    requestConfiguredLLM = async function (prompt) {
      window.__browserSttPrompts.push(String(prompt || ''));
      return { text: 'Browser speech bridge response.' };
    };
    const provider = document.getElementById('providerSelect');
    provider.value = 'configuredllm';
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    const responseType = document.getElementById('responseType');
    responseType.value = 'text';
    responseType.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('videoSource').value = 'none';
    const audio = document.getElementById('audioSource');
    audio.value = Array.from(audio.options).find(option => option.value !== 'none').value;
  });
}

(async () => {
  const popupHtml = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
  assert(/SSN Desktop uses local Whisper/i.test(popupHtml), 'Extension popup should identify Desktop Whisper support.');
  assert(/Chrome extension link opens the hosted co-host page/i.test(popupHtml), 'Extension popup should explain where Chrome voice recognition runs.');
  assert(/system-default microphone/i.test(popupHtml) && /may require internet/i.test(popupHtml), 'Extension popup should disclose Chrome microphone and network behavior.');
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const browser = await chromium.launch({ headless: true });
  try {
    const supportedPage = await browser.newPage();
    const pageErrors = [];
    supportedPage.on('pageerror', error => pageErrors.push(error.message));
    await installBrowserFakes(supportedPage, true);
    await configurePage(supportedPage, 'browser-stt-supported');
    await supportedPage.click('#startButton');
    await supportedPage.waitForFunction(() => (window.__browserSttPrompts || []).some(prompt => /Chrome browser voice works/i.test(prompt)), null, { timeout: 30000 });
    let state = await supportedPage.evaluate(() => ({
      inputMode: document.getElementById('voiceInputMode')?.textContent || '',
      inputState: document.getElementById('voiceInputState')?.textContent || '',
      heard: document.getElementById('voiceHeardSummary')?.textContent || '',
      notice: document.getElementById('realtime-device-notice')?.textContent || '',
      error: document.getElementById('error')?.textContent || '',
      desktopBridge: !!(window.ninjafy && window.ninjafy.transcribeAudio)
    }));
    assert(/Browser STT/i.test(state.inputMode), `Chrome path should identify Browser STT: ${state.inputMode}`);
    assert(/Chrome Speech Recognition/i.test(state.notice), `Chrome path should explain its speech engine: ${state.notice}`);
    assert(/system-default microphone/i.test(state.notice), `Chrome path should explain microphone selection: ${state.notice}`);
    assert(/internet/i.test(state.notice), `Chrome path should disclose its network dependency: ${state.notice}`);
    assert(!/Whisper/i.test(state.inputMode + state.notice), `Browser path incorrectly advertised Whisper: ${state.inputMode} ${state.notice}`);
    assert(/Chrome browser voice works/i.test(state.heard), `Browser transcript did not reach diagnostics: ${state.heard}`);
    assert(!state.desktopBridge, 'Hosted browser page unexpectedly exposed the Desktop STT bridge.');
    assert(!state.error, `Supported Chrome path showed an error: ${state.error}`);
    await supportedPage.click('#startButton');
    await supportedPage.close();

    const unsupportedPage = await browser.newPage();
    await installBrowserFakes(unsupportedPage, false);
    await configurePage(unsupportedPage, 'browser-stt-unsupported');
    await unsupportedPage.click('#startButton');
    await unsupportedPage.waitForFunction(() => /not supported/i.test(document.getElementById('error')?.textContent || ''), null, { timeout: 30000 });
    state = await unsupportedPage.evaluate(() => ({
      notice: document.getElementById('realtime-device-notice')?.textContent || '',
      error: document.getElementById('error')?.textContent || ''
    }));
    assert(/Voice input is unavailable/i.test(state.notice) && /typed chat/i.test(state.notice), `Unsupported-browser notice is unclear: ${state.notice}`);
    assert(/not supported/i.test(state.error) && /Chrome/i.test(state.error), `Unsupported-browser error is unclear: ${state.error}`);
    await unsupportedPage.click('#startButton');
    await unsupportedPage.close();

    assert(pageErrors.length === 0, `Unexpected supported-browser page errors: ${pageErrors.join(' | ')}`);
    console.log('PASS cohost browser STT support and fallback messaging');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
