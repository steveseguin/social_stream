const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4192;
const CUSTOM_ENDPOINT = process.env.SSN_CUSTOM_OAI_ENDPOINT || 'http://10.0.0.36:11434/v1';
const EXPECTED_MODEL = process.env.SSN_CUSTOM_OAI_MODEL || 'Qwen3.5-27B-UD-Q6_K_XL.gguf';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function cohostLikeWelcome(text) {
  return /\b(welcome|glad|great|joining|joined|hey)\b/i.test(text);
}

function cohostLikeFollowUp(text) {
  return /\b(where|watch|watching|tuning|from)\b/i.test(text) || /\?$/.test(text.trim());
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
        ctx.fillText('SOCIAL STREAM TEST', 70, 150);
        ctx.font = 'bold 50px Arial';
        ctx.fillText('CAM 7', 260, 240);
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
  });
}

async function waitForAssistantCount(page, count, timeout = 180000) {
  await page.waitForFunction((expectedCount) => {
    const nodes = document.querySelectorAll('#responses .assistant-message');
    return nodes.length >= expectedCount && nodes[nodes.length - 1].textContent.trim().length > 0;
  }, count, { timeout });
}

async function latestAssistantText(page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('#responses .assistant-message');
    return nodes.length ? nodes[nodes.length - 1].textContent.trim() : '';
  });
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const unexpectedRequests = [];
    const pageErrors = [];

    await context.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';
      const isCustomEndpoint = requestUrl.origin === new URL(CUSTOM_ENDPOINT).origin;

      if (!isLocal && !isCustomEndpoint) {
        unexpectedRequests.push(route.request().url());
        await route.abort();
        return;
      }

      await route.continue();
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await addInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/cohost.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#providerSelect');
    await page.evaluate(() => {
      localStorage.setItem('responseType_customopenai', 'text');
    });
    await page.selectOption('#providerSelect', 'customopenai');

    const initialInfo = await page.evaluate(() => document.getElementById('customEndpointInfo').textContent.trim());
    assert(initialInfo.includes('Set your OpenAI-compatible endpoint'), 'Custom provider should explain the endpoint step before connection.');

    await page.fill('#customEndpoint', CUSTOM_ENDPOINT);
    await page.dispatchEvent('#customEndpoint', 'change');
    await page.waitForFunction(() => document.getElementById('customEndpointInfo').textContent.includes('Loaded'), null, { timeout: 30000 });

    const loadedState = await page.evaluate(() => ({
      info: document.getElementById('customEndpointInfo').textContent.trim(),
      modelOverride: document.getElementById('modelOverride').value.trim(),
      diagModel: document.getElementById('diagModel').textContent.trim()
    }));
    assert(loadedState.info.includes('Loaded'), 'Custom endpoint should load at least one model.');
    assert(loadedState.modelOverride === EXPECTED_MODEL, 'Custom endpoint should select the expected model from llama.cpp.');

    await page.selectOption('#audioSource', 'none');
    await page.selectOption('#videoSource', 'none');
    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });

    await waitForAssistantCount(page, 1, 180000);
    const greeting = await latestAssistantText(page);
    assert(greeting.length > 20 && greeting.length < 220, 'Greeting should be short enough for a co-host.');

    await page.fill('.message-input', 'In one short sentence, welcome late viewers joining now.');
    await page.press('.message-input', 'Enter');
    await waitForAssistantCount(page, 2, 180000);
    const welcome = await latestAssistantText(page);
    assert(cohostLikeWelcome(welcome), `Welcome reply is not cohost-like enough: ${welcome}`);

    await page.fill('.message-input', 'Now in one short sentence ask them where they are watching from.');
    await page.evaluate(() => document.getElementById('sendButton').click());
    await waitForAssistantCount(page, 3, 180000);
    const followUp = await latestAssistantText(page);
    assert(cohostLikeFollowUp(followUp), `Follow-up reply is not cohost-like enough: ${followUp}`);

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'false', null, { timeout: 30000 });

    await page.selectOption('#videoSource', 'fake-camera');
    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });
    await waitForAssistantCount(page, 4, 180000);

    await page.fill('.message-input', 'What text do you see in the camera frame? Reply with only the visible text.');
    await page.evaluate(() => document.getElementById('sendButton').click());
    await waitForAssistantCount(page, 5, 240000);
    const vision = await latestAssistantText(page);
    assert(/SOCIAL STREAM TEST/i.test(vision), `Vision reply did not identify the scene text: ${vision}`);
    assert(/CAM 7/i.test(vision), `Vision reply did not identify the camera label: ${vision}`);

    const finalState = await page.evaluate(() => ({
      diagProvider: document.getElementById('diagProvider').textContent.trim(),
      diagModel: document.getElementById('diagModel').textContent.trim(),
      diagState: document.getElementById('diagState').textContent.trim(),
      diagEvent: document.getElementById('diagEvent').textContent.trim(),
      diagError: document.getElementById('diagError').textContent.trim(),
      sendDisabled: document.getElementById('sendButton').disabled,
      messages: Array.from(document.querySelectorAll('#responses .message')).map((node) => ({
        text: node.textContent.trim(),
        role: node.classList.contains('assistant-message') ? 'assistant' : 'user'
      }))
    }));

    assert(finalState.diagProvider === 'OpenAI-Compatible (Custom)', 'Diagnostics should show the live custom provider.');
    assert(finalState.diagModel === EXPECTED_MODEL, 'Diagnostics should show the live llama.cpp model.');
    assert(finalState.diagState === 'connected', 'Live custom provider should remain connected.');
    assert(finalState.diagEvent === 'custom.generate.done', 'Live custom provider should complete the final request.');
    assert(finalState.diagError === '-', 'Live custom provider should not show a diagnostic error.');
    assert(finalState.sendDisabled === false, 'Send should remain enabled while the stream is running.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    assert(unexpectedRequests.length === 0, `Unexpected external requests: ${unexpectedRequests.join(', ')}`);

    console.log(JSON.stringify({
      greeting,
      welcome,
      followUp,
      vision
    }, null, 2));
    console.log('PASS cohost custom openai live e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
