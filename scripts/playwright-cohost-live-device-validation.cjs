const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4210;
const CUSTOM_ENDPOINT = process.env.SSN_CUSTOM_OAI_ENDPOINT || 'https://llm.socialstream.ninja/v1';
const CUSTOM_API_KEY = process.env.SSN_CUSTOM_OAI_API_KEY || (CUSTOM_ENDPOINT.includes('llm.socialstream.ninja') ? 'test_token' : '');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getDeviceSelection(page) {
  const devices = await page.evaluate(() => ({
    videoOptions: Array.from(document.querySelectorAll('#videoSource option')).map((option) => ({
      value: option.value,
      text: option.text
    })),
    audioOptions: Array.from(document.querySelectorAll('#audioSource option')).map((option) => ({
      value: option.value,
      text: option.text
    }))
  }));

  const video = devices.videoOptions.find((option) => /cam link/i.test(option.text))
    || devices.videoOptions.find((option) => option.value !== 'none' && option.value !== 'screen')
    || null;
  const audio = devices.audioOptions.find((option) => /digital audio interface.*cam link/i.test(option.text) && option.value !== 'default' && option.value !== 'communications')
    || devices.audioOptions.find((option) => /digital audio interface.*cam link/i.test(option.text))
    || devices.audioOptions.find((option) => option.value !== 'none')
    || null;

  return {
    video,
    audio,
    videoOptions: devices.videoOptions,
    audioOptions: devices.audioOptions
  };
}

async function applyDeviceSelection(page, selection) {
  if (selection.video) {
    await page.selectOption('#videoSource', selection.video.value);
  }
  if (selection.audio) {
    await page.selectOption('#audioSource', selection.audio.value);
  }
}

async function stopIfRunning(page) {
  const isRunning = await page.evaluate(() => document.getElementById('startButton').dataset.started === 'true');
  if (!isRunning) {
    return;
  }
  await page.click('#startButton');
  await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'false', null, { timeout: 120000 });
}

async function ensureMuted(page, buttonId, expectedMuted) {
  const isMuted = await page.$eval(`#${buttonId}`, (button) => button.classList.contains('muted'));
  if (Boolean(isMuted) !== Boolean(expectedMuted)) {
    await page.click(`#${buttonId}`);
  }
}

async function waitForPreview(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const preview = document.getElementById('preview');
    return preview && preview.videoWidth > 0 && preview.videoHeight > 0 && !!preview.srcObject;
  }, null, { timeout });
}

async function validateGeminiMissingKey(page) {
  await stopIfRunning(page);
  await page.selectOption('#providerSelect', 'gemini');
  await page.fill('#apiKey', '');
  await page.click('#startButton');
  await page.waitForFunction(() => document.getElementById('diagState').textContent.trim().toLowerCase() === 'error', null, { timeout: 10000 });
  const state = await page.evaluate(() => ({
    actionLine: document.getElementById('actionStatusLine').textContent.trim(),
    actionDetail: document.getElementById('actionStatusDetail').textContent.trim(),
    diagError: document.getElementById('diagError').textContent.trim()
  }));
  assert(/api key/i.test(state.actionDetail), 'Gemini should explain that an API key is required.');
  return state;
}

async function validateLocalQwen(page, selection) {
  await stopIfRunning(page);
  await page.selectOption('#providerSelect', 'localqwen');
  await applyDeviceSelection(page, selection);
  await page.click('#startButton');
  await page.waitForTimeout(1500);

  const earlyState = await page.evaluate(() => ({
    startText: document.getElementById('startButton').textContent.trim(),
    actionLine: document.getElementById('actionStatusLine').textContent.trim(),
    actionDetail: document.getElementById('actionStatusDetail').textContent.trim()
  }));
  assert(
    earlyState.startText === 'Starting...' || earlyState.actionLine !== 'Idle',
    'Local Qwen should show visible start feedback immediately.'
  );

  await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 240000 });
  await waitForPreview(page, 30000);
  await ensureMuted(page, 'muteMic', true);
  await page.waitForFunction(() => document.querySelectorAll('#responses .assistant-message').length >= 1, null, { timeout: 240000 });
  await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send', null, { timeout: 240000 });

  await page.fill('.message-input', 'Say hello in one short sentence.');
  await page.click('#sendButton');
  await page.waitForTimeout(750);
  const sendingState = await page.evaluate(() => ({
    sendText: document.getElementById('sendButton').textContent.trim(),
    sendDisabled: document.getElementById('sendButton').disabled,
    actionLine: document.getElementById('actionStatusLine').textContent.trim()
  }));
  assert(sendingState.sendText === 'Sending...' && sendingState.sendDisabled, 'Local Qwen should show send feedback while generating.');
  await page.waitForFunction(() => document.querySelectorAll('#responses .assistant-message').length >= 2, null, { timeout: 240000 });
  await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send', null, { timeout: 240000 });

  const finalState = await page.evaluate(() => ({
    previewWidth: document.getElementById('preview').videoWidth,
    previewHeight: document.getElementById('preview').videoHeight,
    diagState: document.getElementById('diagState').textContent.trim(),
    diagEvent: document.getElementById('diagEvent').textContent.trim(),
    diagError: document.getElementById('diagError').textContent.trim(),
    voiceStatus: document.getElementById('voiceStatusLine').textContent.trim(),
    replies: Array.from(document.querySelectorAll('#responses .assistant-message')).map((node) => node.textContent.trim()).slice(-2)
  }));

  assert(finalState.previewWidth > 0 && finalState.previewHeight > 0, 'Local Qwen should keep the camera preview live.');
  assert(finalState.diagError === '-', 'Local Qwen should not report a diagnostic error.');
  assert(finalState.replies.length >= 2, 'Local Qwen should answer both the greeting and the manual prompt.');
  assert(finalState.replies.every((reply) => !/ChatGPT|Alibaba Cloud/i.test(reply)), 'Local Qwen should identify itself as the local AI co-host.');
  assert(finalState.replies.every((reply) => !/(?:what would you like to chat about|how about that|how can I (?:help you|be of service)(?: today| further| with (?:that|this))?)\?\s*$/i.test(reply)), 'Local Qwen should remove generic trailing questions.');
  assert(finalState.replies.every((reply) => !/\bmy name is (?!co-?host\b)/i.test(reply) && !/\?\s*$/.test(reply)), 'Local Qwen introductions should not invent a name or end with a question.');
  return {
    earlyState,
    sendingState,
    finalState
  };
}

async function validateLocalGemma(page, selection) {
  await stopIfRunning(page);
  await page.selectOption('#providerSelect', 'localgemma');
  await applyDeviceSelection(page, selection);
  await page.evaluate(() => {
    window.__liveGemmaGeneratePayloads = [];
    const originalRequestWorker = LocalBrowserPublisher.prototype.requestWorker;
    LocalBrowserPublisher.prototype.requestWorker = function (type, payload) {
      if (type === 'generate') {
        window.__liveGemmaGeneratePayloads.push({
          prompt: String(payload?.prompt || ''),
          imageCount: Array.isArray(payload?.images) ? payload.images.length : 0
        });
      }
      return originalRequestWorker.apply(this, arguments);
    };
  });
  await page.click('#startButton');
  await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 240000 });
  await waitForPreview(page, 30000);
  await ensureMuted(page, 'muteMic', true);
  await page.waitForFunction(() => document.querySelectorAll('#responses .assistant-message').length >= 1, null, { timeout: 240000 });
  await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send', null, { timeout: 240000 });

  const assistantCount = await page.locator('#responses .assistant-message').count();
  await page.fill('.message-input', 'Confirm in one short sentence that text-only Gemma is active.');
  await page.click('#sendButton');
  await page.waitForFunction((count) => document.querySelectorAll('#responses .assistant-message').length > count, assistantCount, { timeout: 240000 });
  await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send', null, { timeout: 240000 });
  await page.waitForFunction(() => document.getElementById('diagEvent').textContent.includes('localbrowser.localgemma.generate.done'), null, { timeout: 240000 });

  const state = await page.evaluate(() => ({
    started: document.getElementById('startButton').dataset.started,
    actionLine: document.getElementById('actionStatusLine').textContent.trim(),
    actionDetail: document.getElementById('actionStatusDetail').textContent.trim(),
    diagState: document.getElementById('diagState').textContent.trim(),
    diagEvent: document.getElementById('diagEvent').textContent.trim(),
    diagError: document.getElementById('diagError').textContent.trim(),
    previewWidth: document.getElementById('preview').videoWidth,
    previewHeight: document.getElementById('preview').videoHeight,
    generatePayloads: window.__liveGemmaGeneratePayloads || [],
    replies: Array.from(document.querySelectorAll('#responses .assistant-message')).map((node) => node.textContent.trim()).slice(-2)
  }));

  assert(state.diagState.toLowerCase() === 'connected', 'Local Gemma should stay connected after generation.');
  assert(state.diagError === '-', 'Local Gemma should not report a diagnostic error.');
  assert(state.previewWidth > 0 && state.previewHeight > 0, 'Local Gemma should keep the selected camera preview available.');
  assert(state.generatePayloads.length >= 2, 'Local Gemma should generate both greeting and manual responses.');
  assert(state.generatePayloads.every((payload) => payload.imageCount === 0), 'Text-only Local Gemma should never attach a camera frame.');
  assert(state.replies.length >= 2, 'Local Gemma should answer both the greeting and the manual prompt.');
  return { mode: 'text-only', state };
}

async function validateCustomOpenAI(page, selection) {
  await stopIfRunning(page);
  await page.selectOption('#providerSelect', 'customopenai');
  await page.fill('#apiKey', CUSTOM_API_KEY);
  await page.dispatchEvent('#apiKey', 'input');
  await page.fill('#customEndpoint', CUSTOM_ENDPOINT);
  await page.dispatchEvent('#customEndpoint', 'change');
  await page.waitForFunction(() => document.getElementById('customEndpointInfo').textContent.includes('Loaded'), null, { timeout: 60000 });
  await applyDeviceSelection(page, selection);
  await page.click('#startButton');
  await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 120000 });
  await waitForPreview(page, 30000);
  await ensureMuted(page, 'muteMic', true);
  await page.waitForFunction(() => document.querySelectorAll('#responses .assistant-message').length >= 1, null, { timeout: 240000 });
  await page.waitForFunction(() => !document.getElementById('sendButton').disabled && document.getElementById('sendButton').textContent.trim() === 'Send', null, { timeout: 240000 });

  await page.fill('.message-input', 'In one short sentence, welcome people joining the stream.');
  await page.click('#sendButton');
  await page.waitForFunction(() => document.querySelectorAll('#responses .assistant-message').length >= 2, null, { timeout: 240000 });

  const state = await page.evaluate(() => ({
    endpointInfo: document.getElementById('customEndpointInfo').textContent.trim(),
    previewWidth: document.getElementById('preview').videoWidth,
    previewHeight: document.getElementById('preview').videoHeight,
    diagState: document.getElementById('diagState').textContent.trim(),
    diagEvent: document.getElementById('diagEvent').textContent.trim(),
    diagError: document.getElementById('diagError').textContent.trim(),
    voiceStatus: document.getElementById('voiceStatusLine').textContent.trim(),
    replies: Array.from(document.querySelectorAll('#responses .assistant-message')).map((node) => node.textContent.trim()).slice(-2)
  }));

  assert(state.previewWidth > 0 && state.previewHeight > 0, 'Custom API should keep the camera preview live.');
  assert(state.diagError === '-', 'Custom API should not report a diagnostic error.');
  assert(state.replies.length >= 2, 'Custom API should answer both the greeting and the manual prompt.');
  return state;
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const selection = await getDeviceSelection(page);
    assert(selection.video, 'No usable video device was found for live validation.');
    assert(selection.audio, 'No usable audio device was found for live validation.');

    const gemini = await validateGeminiMissingKey(page);
    const localQwen = await validateLocalQwen(page, selection);
    const localGemma = await validateLocalGemma(page, selection);
    const customOpenAI = process.env.SSN_SKIP_CUSTOM_OAI === '1'
      ? { mode: 'skipped', reason: 'SSN_SKIP_CUSTOM_OAI=1' }
      : await validateCustomOpenAI(page, selection);

    console.log(JSON.stringify({
      devices: {
        video: selection.video,
        audio: selection.audio
      },
      gemini,
      localQwen,
      localGemma,
      customOpenAI
    }, null, 2));

    await browser.close();
    console.log('PASS cohost live device validation');
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
