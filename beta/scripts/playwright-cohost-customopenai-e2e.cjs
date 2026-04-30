const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4191;
const CUSTOM_ENDPOINT = 'http://custom-endpoint.test/v1';
const MODEL_ID = 'Qwen3.5-27B-UD-Q6_K_XL.gguf';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractPromptText(content) {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content.map((part) => {
    if (!part) return '';
    if (typeof part === 'string') return part;
    if (typeof part.text === 'string') return part.text;
    return '';
  }).join(' ').replace(/\s+/g, ' ').trim();
}

function hasImagePart(content) {
  return Array.isArray(content) && content.some((part) => {
    if (!part || typeof part !== 'object') return false;
    return part.type === 'image_url' && !!part.image_url?.url;
  });
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

function responseForPrompt(prompt, imageAttached) {
  if (/^Hi, introduce yourself in a sentence/i.test(prompt)) {
    return 'Hi there! I\'m your friendly co-host here to keep the chat lively, practical, and fun.';
  }
  if (/welcome late viewers/i.test(prompt)) {
    return 'Welcome everyone joining late to Social Stream Test on Cam 7.';
  }
  if (/where they are watching from/i.test(prompt)) {
    return 'Where are you watching from today?';
  }
  if (/what text do you see in the camera frame/i.test(prompt)) {
    return imageAttached ? 'SOCIAL STREAM TEST CAM 7' : 'NO IMAGE ATTACHED';
  }
  return `ACK:${prompt}`;
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const requestLog = [];
    const unexpectedRequests = [];
    const page = await context.newPage();

    await context.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';

      if (requestUrl.origin === 'http://custom-endpoint.test') {
        if (requestUrl.pathname === '/v1/models') {
          await new Promise((resolve) => setTimeout(resolve, 200));
          await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              object: 'list',
              data: [{ id: MODEL_ID }]
            })
          });
          return;
        }

        if (requestUrl.pathname === '/v1/chat/completions') {
          const bodyText = route.request().postData() || '{}';
          const body = JSON.parse(bodyText);
          const lastUserMessage = [...(body.messages || [])].reverse().find((entry) => entry.role === 'user') || {};
          const prompt = extractPromptText(lastUserMessage.content);
          const imageAttached = hasImagePart(lastUserMessage.content);
          requestLog.push({
            url: route.request().url(),
            prompt,
            imageAttached,
            body
          });
          await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              object: 'chat.completion',
              model: body.model || MODEL_ID,
              choices: [{
                index: 0,
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: responseForPrompt(prompt, imageAttached)
                }
              }]
            })
          });
          return;
        }
      }

      if (!isLocal) {
        unexpectedRequests.push(route.request().url());
        await route.abort();
        return;
      }

      await route.continue();
    });

    const pageErrors = [];
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

    const initialState = await page.evaluate(() => ({
      info: document.getElementById('customEndpointInfo').textContent.trim(),
      diagModel: document.getElementById('diagModel').textContent.trim(),
      sendDisabled: document.getElementById('sendButton').disabled
    }));

    assert(initialState.info.includes('Set your OpenAI-compatible endpoint'), 'Custom provider should guide the user before endpoint entry.');
    assert(initialState.diagModel === 'server default', 'Custom provider should default diagnostics to server default.');
    assert(initialState.sendDisabled, 'Send should be disabled before start.');

    await page.fill('#customEndpoint', CUSTOM_ENDPOINT);
    await page.dispatchEvent('#customEndpoint', 'change');
    await page.selectOption('#audioSource', 'none');
    await page.selectOption('#videoSource', 'fake-camera');
    await page.click('#startButton');

    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });
    await waitForAssistantCount(page, 1, 120000);

    const greetingRequests = requestLog.filter((entry) => /^Hi, introduce yourself in a sentence/i.test(entry.prompt));
    assert(greetingRequests.length === 1, 'Starting immediately after endpoint entry should only send one greeting request.');

    await page.waitForFunction(() => document.getElementById('customEndpointInfo').textContent.includes('Loaded 1 model(s) from endpoint'), null, { timeout: 20000 });
    const loadedState = await page.evaluate(() => ({
      info: document.getElementById('customEndpointInfo').textContent.trim(),
      modelOverride: document.getElementById('modelOverride').value.trim(),
      diagModel: document.getElementById('diagModel').textContent.trim(),
      customModelOptions: Array.from(document.getElementById('customModelSelect').options).map((option) => option.value)
    }));
    assert(loadedState.modelOverride === MODEL_ID, 'Custom provider should auto-select the single endpoint model.');
    assert(loadedState.diagModel === MODEL_ID, 'Diagnostics should reflect the auto-selected custom model.');
    assert(loadedState.customModelOptions.includes(MODEL_ID), 'Custom model picker should expose the endpoint model.');

    await page.fill('.message-input', 'In one short sentence, welcome late viewers joining now.');
    await page.press('.message-input', 'Enter');
    await waitForAssistantCount(page, 2, 120000);
    let latestRequest = requestLog[requestLog.length - 1];
    assert(latestRequest.prompt === 'In one short sentence, welcome late viewers joining now.', 'Enter should send the typed welcome prompt.');
    assert(latestRequest.imageAttached, 'Welcome prompt with an active camera should include an image frame.');

    await page.fill('.message-input', 'Now in one short sentence ask them where they are watching from.');
    await page.evaluate(() => document.getElementById('sendButton').click());
    await waitForAssistantCount(page, 3, 120000);
    latestRequest = requestLog[requestLog.length - 1];
    assert(latestRequest.prompt === 'Now in one short sentence ask them where they are watching from.', 'Send button should send the typed follow-up prompt.');
    assert(latestRequest.imageAttached, 'Follow-up prompt with active camera should include an image frame.');

    await page.fill('.message-input', 'What text do you see in the camera frame? Reply with only the visible text.');
    await page.evaluate(() => document.getElementById('sendButton').click());
    await waitForAssistantCount(page, 4, 180000);
    latestRequest = requestLog[requestLog.length - 1];
    assert(latestRequest.prompt === 'What text do you see in the camera frame? Reply with only the visible text.', 'OCR prompt should reach the custom endpoint.');
    assert(latestRequest.imageAttached, 'OCR prompt should include a vision frame.');

    const fuzzPrompts = [
      '   Keep it snappy.   ',
      'A/B test: Toronto or Tokyo?',
      'No emojis; 5 words max.'
    ];

    for (let index = 0; index < fuzzPrompts.length; index += 1) {
      const rawPrompt = fuzzPrompts[index];
      const expectedPrompt = rawPrompt.trim();
      await page.fill('.message-input', rawPrompt);
      if (index % 2 === 0) {
        await page.press('.message-input', 'Enter');
      } else {
        await page.evaluate(() => document.getElementById('sendButton').click());
      }
      await waitForAssistantCount(page, 5 + index, 120000);
      latestRequest = requestLog[requestLog.length - 1];
      assert(latestRequest.prompt === expectedPrompt, `Fuzz prompt ${index + 1} should preserve the trimmed input text.`);
    }

    const finalState = await page.evaluate(() => ({
      sendDisabled: document.getElementById('sendButton').disabled,
      diagProvider: document.getElementById('diagProvider').textContent.trim(),
      diagModel: document.getElementById('diagModel').textContent.trim(),
      diagState: document.getElementById('diagState').textContent.trim(),
      diagEvent: document.getElementById('diagEvent').textContent.trim(),
      diagError: document.getElementById('diagError').textContent.trim(),
      messages: Array.from(document.querySelectorAll('#responses .message')).map((node) => ({
        text: node.textContent.trim(),
        role: node.classList.contains('assistant-message') ? 'assistant' : 'user'
      }))
    }));

    assert(finalState.diagProvider === 'OpenAI-Compatible (Custom)', 'Diagnostics should show the custom provider.');
    assert(finalState.diagModel === MODEL_ID, 'Diagnostics should keep the endpoint model selected.');
    assert(finalState.diagState === 'connected', 'Custom provider should remain connected.');
    assert(finalState.diagEvent === 'custom.generate.done', 'Custom provider should complete the final generation.');
    assert(finalState.diagError === '-', 'Custom provider should not report an error.');
    assert(finalState.messages.some((entry) => entry.text === 'SOCIAL STREAM TEST CAM 7'), 'Vision OCR response should complete through the UI.');
    assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(' | ')}`);
    assert(unexpectedRequests.length === 0, `Unexpected external requests: ${unexpectedRequests.join(', ')}`);

    await page.click('#startButton');
    await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'false', null, { timeout: 30000 });

    console.log('PASS cohost custom openai e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
