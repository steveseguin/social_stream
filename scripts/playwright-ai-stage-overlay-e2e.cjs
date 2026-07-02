const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4198;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function removeChromiumDebugLog() {
  const debugLogPath = path.join(ROOT, 'debug.log');
  try {
    if (fs.existsSync(debugLogPath)) {
      fs.rmSync(debugLogPath);
    }
  } catch (_error) {}
}

async function addSpeechStub(page) {
  await page.addInitScript(() => {
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
      speak(utterance) {
        window.__spoken.push(utterance && utterance.text ? utterance.text : '');
        if (utterance && typeof utterance.onend === 'function') {
          setTimeout(() => utterance.onend(), 0);
        }
      },
      cancel() {},
      pause() {},
      resume() {},
      getVoices() {
        return [];
      },
      speaking: false,
      pending: false
      }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: function SpeechSynthesisUtterance(text) {
        this.text = text;
      }
    });
  });
}

async function addPopupInitScript(page) {
  await page.addInitScript(() => {
    const messages = [];
    const storageData = {};
    const settingsResponse = {
      streamID: 'playwright-ai-stage',
      password: 'pw123',
      state: true,
      settings: {
        aiOverlayFromChatBot: { setting: true },
        aiOverlayTts: { setting: true },
        aiOverlayLabel: { textsetting: 'stage' },
        aiOverlayName: { textsetting: 'NinjaBot' },
        aiOverlayAvatar: { textsetting: 'https://example.com/avatar.png' },
        aiOverlayPosition: { optionsetting: 'bottom-left' },
        aiOverlayScale: { numbersetting: '1.35' }
      }
    };

    function clone(value) {
      return value ? JSON.parse(JSON.stringify(value)) : value;
    }

    function asyncCallback(callback, value) {
      if (typeof callback === 'function') {
        setTimeout(() => callback(value), 0);
      }
    }

    const storageArea = {
      get(keys, callback) {
        let response = {};
        if (Array.isArray(keys)) {
          keys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(storageData, key)) {
              response[key] = storageData[key];
            }
          });
        } else if (keys && typeof keys === 'object') {
          response = Object.assign({}, keys, storageData);
        } else if (typeof keys === 'string') {
          if (Object.prototype.hasOwnProperty.call(storageData, keys)) {
            response[keys] = storageData[keys];
          }
        } else {
          response = Object.assign({}, storageData);
        }
        asyncCallback(callback, response);
      },
      set(items, callback) {
        Object.assign(storageData, items || {});
        asyncCallback(callback);
      },
      remove(keys, callback) {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => delete storageData[key]);
        asyncCallback(callback);
      },
      clear(callback) {
        Object.keys(storageData).forEach((key) => delete storageData[key]);
        asyncCallback(callback);
      }
    };

    const runtime = {
      id: 'playwright-test',
      lastError: null,
      getURL(path) {
        return `${window.location.origin}/${String(path || '').replace(/^\/+/, '')}`;
      },
      getManifest() {
        return { version: '0.0.0-test' };
      },
      sendMessage(message, callback) {
        messages.push(clone(message));
        if (message && message.cmd === 'getSettings') {
          asyncCallback(callback, clone(settingsResponse));
          return;
        }
        asyncCallback(callback, {});
      },
      connect() {
        return {
          postMessage() {},
          disconnect() {},
          onMessage: { addListener() {}, removeListener() {} },
          onDisconnect: { addListener() {}, removeListener() {} }
        };
      },
      onMessage: { addListener() {}, removeListener() {} },
      onInstalled: { addListener() {}, removeListener() {} }
    };

    const chromeStub = {
      runtime,
      extension: {
        getURL(path) {
          return `${window.location.origin}/${String(path || '').replace(/^\/+/, '')}`;
        }
      },
      storage: {
        sync: storageArea,
        local: storageArea
      },
      tabs: {
        create() {},
        query(_queryInfo, callback) {
          asyncCallback(callback, []);
        },
        sendMessage(_tabId, message, callback) {
          messages.push(clone(message));
          asyncCallback(callback, {});
        },
        captureVisibleTab(_windowId, _options, callback) {
          asyncCallback(callback, 'data:image/png;base64,');
        }
      },
      windows: {
        create() {},
        getCurrent(callback) {
          asyncCallback(callback, { id: 1 });
        }
      },
      permissions: {
        request(_permissions, callback) {
          asyncCallback(callback, true);
        },
        contains(_permissions, callback) {
          asyncCallback(callback, false);
        }
      },
      downloads: {
        download(_options, callback) {
          asyncCallback(callback, 1);
        },
        search(_options, callback) {
          asyncCallback(callback, []);
        },
        onChanged: { addListener() {}, removeListener() {} }
      },
      action: {
        setBadgeText() {},
        setBadgeBackgroundColor() {}
      },
      browserAction: {
        setBadgeText() {},
        setBadgeBackgroundColor() {},
        setIcon() {}
      },
      notifications: {
        create(_id, _options, callback) {
          asyncCallback(callback, '1');
        }
      },
      i18n: {
        getMessage(key) {
          return key;
        }
      }
    };

    window.chrome = chromeStub;
    window.browser = chromeStub;
    window.__chromeMessages = messages;
    window.confirm = () => true;
    window.alert = () => {};
    window.prompt = (_message, fallbackValue = '') => fallbackValue;
  });
}

async function addCohostInitScript(page) {
  await page.addInitScript(() => {
    window.__aiOverlayPayloads = [];

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => ([
          { deviceId: 'fake-camera', kind: 'videoinput', label: 'Fake Camera', groupId: 'fake-video' },
          { deviceId: 'fake-mic', kind: 'audioinput', label: 'Fake Microphone', groupId: 'fake-audio' }
        ]),
        getUserMedia: async (constraints = {}) => {
          const stream = new MediaStream();
          if (constraints.video) {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#122033';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('AI STAGE TEST', 80, 150);
            if (canvas.captureStream) {
              canvas.captureStream(2).getVideoTracks().forEach((track) => stream.addTrack(track));
            }
          }
          return stream;
        },
        getDisplayMedia: async () => new MediaStream(),
        addEventListener() {},
        removeEventListener() {}
      }
    });

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak() {},
        cancel() {},
        pause() {},
        resume() {},
        getVoices() {
          return [];
        },
        speaking: false,
        pending: false
      }
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: function SpeechSynthesisUtterance(text) {
        this.text = text;
      }
    });

    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      get() {
        return srcDescriptor.get.call(this);
      },
      set(value) {
        if (String(value || '').indexOf('vdo.socialstream.ninja') >= 0) {
          this.srcdoc = `
            <!DOCTYPE html><html><body><script>
            (function () {
              var chunks = {};
              function send(payload) {
                parent.postMessage({ dataReceived: { overlayNinja: payload } }, '*');
              }
              function clone(value) {
                return JSON.parse(JSON.stringify(value));
              }
              function reply(request) {
                var target = request.target;
                var response = 'Hi, I am your SSN configured LLM co-host.';
                send({ chatbotChunk: { target: target, value: response.slice(0, 18) } });
                send({ chatbotChunk: { target: target, value: response.slice(18) } });
                send({ chatbotResponse: { target: target, value: '' } });
              }
              window.addEventListener('message', function (event) {
                var payload = event.data && event.data.sendData && event.data.sendData.overlayNinja;
                var entry;
                if (!payload) return;
                if (payload.action === 'aiOverlay') {
                  parent.__aiOverlayPayloads = parent.__aiOverlayPayloads || [];
                  parent.__aiOverlayPayloads.push(clone(payload));
                  return;
                }
                if (payload.action === 'ssnBridgeChunk') {
                  entry = chunks[payload.chunkId] || { total: payload.total, parts: [], count: 0 };
                  if (typeof entry.parts[payload.index] === 'undefined') entry.count++;
                  entry.parts[payload.index] = payload.value || '';
                  chunks[payload.chunkId] = entry;
                  if (entry.count < entry.total) return;
                  delete chunks[payload.chunkId];
                  try {
                    reply(JSON.parse(entry.parts.join('')));
                  } catch (e) {
                    send({ chatbotResponse: { target: 'unknown', value: JSON.stringify({ error: { message: e.message } }) } });
                  }
                  return;
                }
                if (payload.action === 'getAiPromptOverlays') {
                  send({ aiPromptOverlays: { target: payload.target, value: { version: 1, activeOverlay: '', order: [], overlays: {} } } });
                  return;
                }
                if (payload.action === 'cohostToolStatus') {
                  send({ cohostToolStatus: { target: payload.target, value: { tools: {} }, tools: {} } });
                  return;
                }
                if (payload.action === 'chatbot') reply(payload);
              });
            }());
            <\/script></body></html>`;
          return;
        }
        srcDescriptor.set.call(this, value);
      }
    });
  });
}

async function runOverlayPageTest(context, baseUrl) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await addSpeechStub(page);
  await page.goto(`${baseUrl}/cohost-overlay.html?preview=1&label=stage&name=NinjaBot&position=bottom-left&scale=1.25&hideidle`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__aiStageOverlay);

  const wrongTargetAccepted = await page.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'wrong-stage',
    meta: { command: 'say', text: 'Wrong target' }
  }));
  assert(wrongTargetAccepted === false, 'Overlay accepted a command for the wrong target.');

  await page.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'stage',
    meta: { command: 'say', text: 'Hello from the AI stage.', name: 'NinjaBot', emotion: 'excited', talking: true }
  }));

  let state = await page.evaluate(() => ({
    overlay: window.__aiStageOverlay.getState(),
    visible: document.body.classList.contains('visible'),
    hasText: document.body.classList.contains('has-text'),
    text: document.getElementById('speechText').textContent,
    name: document.getElementById('speakerName').textContent,
    puppetClass: document.getElementById('puppet').className
  }));
  assert(state.visible && state.hasText, 'Overlay did not become visible with text.');
  assert(state.text === 'Hello from the AI stage.', 'Overlay speech text did not update.');
  assert(state.name === 'NinjaBot', 'Overlay speaker name did not update.');
  assert(/excited/.test(state.puppetClass) && /talking/.test(state.puppetClass), 'Overlay avatar did not enter the requested state.');

  await page.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'stage',
    meta: { command: 'setavatar', avatar: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22%3E%3Crect width=%2220%22 height=%2220%22 fill=%22%2343d9ad%22/%3E%3C/svg%3E' }
  }));
  state = await page.evaluate(() => ({
    avatar: window.__aiStageOverlay.getState().avatar,
    hasImage: document.body.classList.contains('has-image')
  }));
  assert(state.avatar.indexOf('data:image/svg+xml') === 0 && state.hasImage, 'Overlay avatar image command did not apply.');

  await page.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'stage',
    meta: { command: 'clear' }
  }));
  state = await page.evaluate(() => window.__aiStageOverlay.getState());
  assert(state.text === '' && state.visible === false, 'Overlay clear command did not hide idle overlay text.');
  assert(errors.length === 0, `Overlay page errors: ${errors.join(' | ')}`);
  await page.close();

  const ttsPage = await context.newPage();
  await addSpeechStub(ttsPage);
  await ttsPage.goto(`${baseUrl}/cohost-overlay.html?preview=1&label=stage&tts&hideidle`, { waitUntil: 'domcontentloaded' });
  await ttsPage.waitForFunction(() => !!window.__aiStageOverlay);
  await ttsPage.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'stage',
    meta: { command: 'say', text: 'Speak this line.', tts: true }
  }));
  await ttsPage.waitForFunction(() => window.__spoken && window.__spoken.includes('Speak this line.'));
  await ttsPage.close();
}

async function runPopupLinkTest(context, baseUrl) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await addPopupInitScript(page);
  await page.goto(`${baseUrl}/popup.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#aioverlaylink');
  try {
    await page.waitForFunction(() => document.getElementById('aioverlaylink').href.indexOf('label=stage') >= 0);
  } catch (error) {
    const debugState = await page.evaluate(() => ({
      href: document.getElementById('aioverlaylink')?.href || '',
      label: document.getElementById('aiOverlayLabel')?.value || '',
      name: document.getElementById('aiOverlayName')?.value || '',
      avatar: document.getElementById('aiOverlayAvatar')?.value || '',
      position: document.getElementById('aiOverlayPosition')?.value || '',
      scale: document.querySelector("[data-numbersetting='aiOverlayScale']")?.value || '',
      tts: !!document.getElementById('aiOverlayTts')?.checked
    }));
    throw new Error(`Popup overlay link did not hydrate saved settings. state=${JSON.stringify(debugState)} errors=${errors.join(' | ')}`);
  }

  let state = await page.evaluate(() => {
    const overlay = new URL(document.getElementById('aioverlaylink').href);
    const cohost = new URL(document.getElementById('cohostlink').href);
    return {
      path: overlay.pathname,
      session: overlay.searchParams.get('session'),
      password: overlay.searchParams.get('password'),
      label: overlay.searchParams.get('label'),
      name: overlay.searchParams.get('name'),
      avatar: overlay.searchParams.get('avatar'),
      position: overlay.searchParams.get('position'),
      scale: overlay.searchParams.get('scale'),
      hasTts: overlay.searchParams.has('tts'),
      cohostOverlay: cohost.searchParams.get('aioverlay'),
      fromChatBotChecked: document.getElementById('aiOverlayFromChatBot').checked,
      overlayTtsChecked: document.getElementById('aiOverlayTts').checked
    };
  });
  assert(state.path.endsWith('/cohost-overlay.html'), 'Popup overlay link points at the wrong page.');
  assert(state.session === 'playwright-ai-stage', 'Popup overlay link is missing the session.');
  assert(state.password === 'pw123', 'Popup overlay link is missing the password.');
  assert(state.label === 'stage', 'Popup overlay link did not use the saved label.');
  assert(state.name === 'NinjaBot', 'Popup overlay link did not use the saved display name.');
  assert(state.avatar === 'https://example.com/avatar.png', 'Popup overlay link did not use the saved avatar URL.');
  assert(state.position === 'bottom-left', 'Popup overlay link did not use the saved position.');
  assert(state.scale === '1.35', 'Popup overlay link did not use the saved scale.');
  assert(state.hasTts, 'Popup overlay link did not include TTS when enabled.');
  assert(state.cohostOverlay === 'stage', 'Popup cohost link did not target the overlay label.');
  assert(state.fromChatBotChecked && state.overlayTtsChecked, 'Popup did not hydrate the AI overlay toggles.');

  await page.fill('#aiOverlayLabel', 'stage-two');
  await page.dispatchEvent('#aiOverlayLabel', 'change');
  await page.waitForFunction(() => document.getElementById('aioverlaylink').href.indexOf('label=stage-two') >= 0);
  await page.evaluate(() => {
    const input = document.getElementById('aiOverlayTts');
    input.checked = false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => new URL(document.getElementById('aioverlaylink').href).searchParams.has('tts') === false);

  state = await page.evaluate(() => ({
    overlayLabel: new URL(document.getElementById('aioverlaylink').href).searchParams.get('label'),
    cohostOverlay: new URL(document.getElementById('cohostlink').href).searchParams.get('aioverlay'),
    messages: window.__chromeMessages.slice()
  }));
  assert(state.overlayLabel === 'stage-two' && state.cohostOverlay === 'stage-two', 'Popup did not refresh overlay/cohost links after editing the label.');
  assert(state.messages.some((message) => message && message.cmd === 'saveSetting' && message.setting === 'aiOverlayLabel' && message.value === 'stage-two'), 'Popup did not save the edited overlay label.');
  assert(state.messages.some((message) => message && message.cmd === 'saveSetting' && message.setting === 'aiOverlayTts' && message.value === false), 'Popup did not save the edited overlay TTS toggle.');
  assert(errors.length === 0, `Popup page errors: ${errors.join(' | ')}`);
  await page.close();
}

async function runCohostBridgeTest(context, baseUrl) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await addCohostInitScript(page);
  await page.goto(`${baseUrl}/cohost.html?session=playwright-ai-stage&aioverlay=stage`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#providerSelect');
  await page.selectOption('#providerSelect', 'configuredllm');
  await page.selectOption('#audioSource', 'none');
  await page.selectOption('#videoSource', 'fake-camera');
  await page.click('#startButton');
  await page.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });
  await page.waitForFunction(() => {
    return (window.__aiOverlayPayloads || []).some((payload) => {
      return payload &&
        payload.action === 'aiOverlay' &&
        payload.target === 'stage' &&
        payload.meta &&
        payload.meta.command === 'say' &&
        /SSN configured LLM co-host/i.test(payload.meta.text || '');
    });
  }, null, { timeout: 120000 });

  const state = await page.evaluate(() => ({
    latestAssistant: Array.from(document.querySelectorAll('#responses .assistant-message')).pop()?.textContent.trim() || '',
    overlayPayloads: window.__aiOverlayPayloads || []
  }));
  assert(/SSN configured LLM co-host/i.test(state.latestAssistant), 'Cohost did not render the configured LLM response.');
  assert(state.overlayPayloads.some((payload) => payload.meta && payload.meta.source === 'cohost'), 'Cohost overlay payload did not mark source=cohost.');
  assert(errors.length === 0, `Cohost page errors: ${errors.join(' | ')}`);
  await page.close();
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const baseUrl = `http://${HOST}:${PORT}`;
  const blockedExternalRequests = [];

  try {
    const browser = await chromium.launch({
      headless: true,
      env: Object.assign({}, process.env, { CHROME_LOG_FILE: 'NUL' }),
      args: ['--disable-logging', '--log-level=3']
    });
    const context = await browser.newContext();

    await context.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isHttp = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
      const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';

      if (requestUrl.href === 'https://socialstream.ninja/manifest.json') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ version: '0.0.0-test' })
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

    await runOverlayPageTest(context, baseUrl);
    await runPopupLinkTest(context, baseUrl);
    await runCohostBridgeTest(context, baseUrl);

    assert(blockedExternalRequests.length === 0, `External requests were attempted: ${blockedExternalRequests.join(', ')}`);
    console.log('PASS ai stage overlay e2e');
    await browser.close();
  } finally {
    server.close();
    removeChromiumDebugLog();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
