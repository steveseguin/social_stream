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
	window.__mediaRequests = 0;
	if (navigator.mediaDevices) {
		Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
			configurable: true,
			value: async () => {
				window.__mediaRequests += 1;
				throw new Error('The OBS overlay must not request media.');
			}
		});
	}
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

async function addCohostInitScript(page, mockBridge = true) {
  await page.addInitScript((mockBridgeEnabled) => {
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

	if (!mockBridgeEnabled) return;

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
  }, mockBridge);
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
	const controlMessageState = await page.evaluate(() => ({
		accepted: window.__aiStageOverlay.processPayload({ action: 'stream-id-detected', value: 'transport-control' }),
		lastPayload: window.__aiStageOverlay.getState().lastPayload
	}));
	assert(controlMessageState.accepted === false && controlMessageState.lastPayload === null, 'Overlay treated a transport control message as stage content.');

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

	const chunkPayload = JSON.stringify({
		action: 'aiOverlay',
		target: 'stage',
		meta: { command: 'say', text: 'Reassembled chunk response.', emotion: 'thinking', final: true }
	});
	const chunkState = await page.evaluate(({ first, second }) => {
		const firstResult = window.__aiStageOverlay.processPayload({ action: 'ssnBridgeChunk', chunkId: 'overlay-test', index: 0, total: 2, value: first });
		const secondResult = window.__aiStageOverlay.processPayload({ action: 'ssnBridgeChunk', chunkId: 'overlay-test', index: 1, total: 2, value: second });
		return { firstResult, secondResult, state: window.__aiStageOverlay.getState() };
	}, { first: chunkPayload.slice(0, 47), second: chunkPayload.slice(47) });
	assert(chunkState.firstResult === false && chunkState.secondResult === true, 'Overlay chunk reassembly returned the wrong completion state.');
	assert(chunkState.state.text === 'Reassembled chunk response.', 'Overlay did not render a reassembled command.');

	const maliciousText = '<img src=x onerror="window.__overlayXss=true"> & unsafe-looking text';
	const safeTextState = await page.evaluate((text) => {
		window.__aiStageOverlay.processPayload({ action: 'aiOverlay', target: 'stage', meta: { command: 'say', text } });
		return {
			text: document.getElementById('speechText').textContent,
			html: document.getElementById('speechText').innerHTML,
			xss: window.__overlayXss === true,
			position: document.body.getAttribute('data-position'),
			scale: getComputedStyle(document.documentElement).getPropertyValue('--overlay-scale').trim()
		};
	}, maliciousText);
	assert(safeTextState.text === maliciousText && safeTextState.html.indexOf('<img') === -1 && !safeTextState.xss, 'Overlay rendered response text as unsafe HTML.');
	assert(safeTextState.position === 'bottom-left' && safeTextState.scale === '1.25', 'Overlay did not apply its OBS layout parameters.');

  await page.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'stage',
    meta: { command: 'clear' }
  }));
  state = await page.evaluate(() => window.__aiStageOverlay.getState());
  assert(state.text === '' && state.visible === false, 'Overlay clear command did not hide idle overlay text.');
	const unattendedState = await page.evaluate(() => ({
		mediaRequests: window.__mediaRequests,
		interactiveElements: document.querySelectorAll('button,input,select,textarea,video,audio').length
	}));
	assert(unattendedState.mediaRequests === 0, 'Overlay requested microphone or camera access.');
	assert(unattendedState.interactiveElements === 0, 'Overlay unexpectedly exposes interactive controls or media elements.');
  assert(errors.length === 0, `Overlay page errors: ${errors.join(' | ')}`);
  await page.close();

  const ttsPage = await context.newPage();
  await addSpeechStub(ttsPage);
  await ttsPage.goto(`${baseUrl}/cohost-overlay.html?preview=1&label=stage&tts&hideidle`, { waitUntil: 'domcontentloaded' });
  await ttsPage.waitForFunction(() => !!window.__aiStageOverlay);
  await ttsPage.evaluate(() => window.__aiStageOverlay.processPayload({
    action: 'aiOverlay',
    target: 'stage',
	meta: { command: 'say', text: 'Do not speak the partial line.', tts: false, final: false }
  }));
	await ttsPage.waitForTimeout(50);
	assert((await ttsPage.evaluate(() => window.__spoken.length)) === 0, 'Overlay spoke a streaming partial response.');
	await ttsPage.evaluate(() => window.__aiStageOverlay.processPayload({
		action: 'aiOverlay',
		target: 'stage',
		meta: { command: 'say', text: 'Speak this line.', tts: true, final: true }
	}));
  await ttsPage.waitForFunction(() => window.__spoken && window.__spoken.includes('Speak this line.'));
  await ttsPage.close();

	const timerPage = await context.newPage();
	await timerPage.goto(`${baseUrl}/cohost-overlay.html?preview=1&label=stage&hideidle&hideafter=60`, { waitUntil: 'domcontentloaded' });
	await timerPage.waitForFunction(() => !!window.__aiStageOverlay);
	await timerPage.evaluate(() => window.__aiStageOverlay.processPayload({
		action: 'aiOverlay',
		target: 'stage',
		meta: { command: 'say', text: 'Short-lived line.' }
	}));
	await timerPage.waitForFunction(() => window.__aiStageOverlay.getState().visible === false && window.__aiStageOverlay.getState().text === '', null, { timeout: 3000 });
	await timerPage.close();
}

async function addBridgeRelayRedirect(page, baseUrl) {
	await page.addInitScript((relayBaseUrl) => {
		const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
		Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
			configurable: true,
			get() {
				return srcDescriptor.get.call(this);
			},
			set(value) {
				const text = String(value || '');
				if (text.indexOf('https://vdo.socialstream.ninja/') === 0) {
					const original = new URL(text);
					srcDescriptor.set.call(this, relayBaseUrl + '/scripts/fixtures/ai-stage-bridge-relay.html' + original.search);
					return;
				}
				srcDescriptor.set.call(this, value);
			}
		});
	}, baseUrl);
}

async function runPairedPageTest(context, baseUrl) {
	const overlay = await context.newPage();
	const cohost = await context.newPage();
	const errors = [];
	for (const page of [overlay, cohost]) {
		page.on('pageerror', (error) => errors.push(error.message));
	}
	await addSpeechStub(overlay);
	await addCohostInitScript(cohost, false);
	await addBridgeRelayRedirect(overlay, baseUrl);
	await addBridgeRelayRedirect(cohost, baseUrl);
	await overlay.goto(`${baseUrl}/cohost-overlay.html?session=playwright-ai-stage-pair&label=paired-stage&tts&hideidle&status`, { waitUntil: 'domcontentloaded' });
	await overlay.waitForFunction(() => !!window.__aiStageOverlay);
	await cohost.goto(`${baseUrl}/cohost.html?session=playwright-ai-stage-pair&aioverlay=paired-stage`, { waitUntil: 'domcontentloaded' });
	await cohost.waitForSelector('#providerSelect');
	await cohost.selectOption('#providerSelect', 'configuredllm');
	await cohost.selectOption('#audioSource', 'none');
	await cohost.selectOption('#videoSource', 'fake-camera');
	await cohost.click('#startButton');
	try {
		await cohost.waitForFunction(() => document.getElementById('startButton').dataset.started === 'true', null, { timeout: 30000 });
	} catch (error) {
		const diagnostics = await cohost.evaluate(() => ({
			buttonText: document.getElementById('startButton')?.textContent || '',
			started: document.getElementById('startButton')?.dataset?.started || '',
			bridgeInfo: document.getElementById('configuredLLMInfo')?.textContent || '',
			errorText: document.getElementById('error')?.textContent || document.querySelector('.error-message')?.textContent || '',
			frames: Array.from(document.querySelectorAll('iframe')).map((frame) => frame.src || 'srcdoc')
		}));
		const frameStates = await Promise.all(cohost.frames().slice(1).map(async (frame) => {
			try {
				return await frame.evaluate(() => ({ url: location.href, ready: document.readyState, body: document.body?.innerText || '' }));
			} catch (frameError) {
				return { url: frame.url(), error: frameError.message };
			}
		}));
		throw new Error(`Paired cohost did not start: ${JSON.stringify(diagnostics)} frameStates=${JSON.stringify(frameStates)} pageErrors=${errors.join(' | ')}`);
	}
	await overlay.waitForFunction(() => window.__aiStageOverlay.getState().text === 'Paired bridge response for the OBS stage.', null, { timeout: 120000 });
	await overlay.waitForFunction(() => window.__spoken.includes('Paired bridge response for the OBS stage.'), null, { timeout: 30000 });
	const state = await overlay.evaluate(() => ({
		overlay: window.__aiStageOverlay.getState(),
		spoken: window.__spoken.slice(),
		mediaRequests: window.__mediaRequests,
		visible: document.body.classList.contains('visible')
	}));
	assert(state.visible, 'Paired overlay did not become visible.');
	assert(state.overlay.lastPayload && state.overlay.lastPayload.target === 'paired-stage', 'Paired overlay received the wrong target.');
	assert(state.spoken.filter((text) => text === state.overlay.text).length === 1, 'Paired overlay did not speak the final answer exactly once.');
	assert(state.mediaRequests === 0, 'Paired OBS overlay requested microphone or camera access.');
	assert(errors.length === 0, `Paired page errors: ${errors.join(' | ')}`);
	await cohost.close();
	await overlay.close();
}

async function runPopupLinkTest(context, baseUrl) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await addPopupInitScript(page);
  await page.goto(`${baseUrl}/popup.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#aioverlaylink', { state: 'attached' });
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

  await page.evaluate(() => {
    const input = document.getElementById('aiOverlayLabel');
    input.value = 'stage-two';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
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
	const finalPayloads = state.overlayPayloads.filter((payload) => payload.meta && payload.meta.command === 'say' && payload.meta.final === true);
	assert(finalPayloads.length === 1, 'Cohost did not emit exactly one final overlay answer.');
	assert(finalPayloads[0].meta.tts === true, 'Cohost final overlay answer was not marked for TTS.');
	assert(state.overlayPayloads.every((payload) => payload.meta && payload.meta.command), 'Cohost emitted an empty overlay command.');
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
	await runPairedPageTest(context, baseUrl);

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
