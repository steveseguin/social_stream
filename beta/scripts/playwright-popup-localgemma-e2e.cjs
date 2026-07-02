const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4176;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function addPopupInitScript(page) {
  await page.addInitScript(() => {
    const messages = [];
    const storageData = {};

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
        list.forEach((key) => {
          delete storageData[key];
        });
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
        return path;
      },
      getManifest() {
        return { version: '0.0.0-test' };
      },
      sendMessage(message, callback) {
        messages.push(clone(message));
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
          return path;
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
        setBadgeBackgroundColor() {}
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

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const blockedExternalRequests = [];

  try {
    const browser = await chromium.launch({ headless: true });
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

    const page = await context.newPage();
    page.on('console', (msg) => {
      console.log('PAGE_CONSOLE:', msg.type(), msg.text());
    });
    page.on('pageerror', (error) => {
      console.log('PAGE_ERROR:', error.message);
    });

    await addPopupInitScript(page);
    await page.goto(`http://${HOST}:${PORT}/popup.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#aiProvider');

    const initialState = await page.evaluate(() => ({
      hasLocalGemmaOption: Array.from(document.querySelectorAll('#aiProvider option')).some((option) => option.value === 'localgemma'),
      hasLocalQwenOption: Array.from(document.querySelectorAll('#aiProvider option')).some((option) => option.value === 'localqwen'),
      hostHidden: document.getElementById('localgemmahost').classList.contains('hidden'),
      helpHidden: document.getElementById('localbrowserhelp').classList.contains('hidden'),
      gemmaModelHidden: document.getElementById('localgemmamodel').classList.contains('hidden'),
      qwenModelHidden: document.getElementById('localqwenmodel').classList.contains('hidden')
    }));

    assert(initialState.hasLocalGemmaOption, 'Popup AI provider list is missing Local Gemma.');
    assert(initialState.hasLocalQwenOption, 'Popup AI provider list is missing Local Qwen.');
    assert(
      initialState.hostHidden && initialState.helpHidden && initialState.gemmaModelHidden && initialState.qwenModelHidden,
      'Local browser model settings should be hidden before selection.'
    );

    await page.selectOption('#aiProvider', 'localgemma');
    await page.waitForFunction(() => !document.getElementById('localgemmahost').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('localbrowserhelp').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('localgemmamodel').classList.contains('hidden'));
    await page.waitForFunction(() => document.getElementById('localqwenmodel').classList.contains('hidden'));

    await page.fill("[data-textsetting='localgemmahost']", 'https://assets.example.com/models/');
    await page.dispatchEvent("[data-textsetting='localgemmahost']", 'change');
    await page.fill("[data-textsetting='localgemmamodel']", 'gemma4-e2b-it-onnx');
    await page.dispatchEvent("[data-textsetting='localgemmamodel']", 'change');

    await page.selectOption('#aiProvider', 'localqwen');
    await page.waitForFunction(() => !document.getElementById('localgemmahost').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('localbrowserhelp').classList.contains('hidden'));
    await page.waitForFunction(() => document.getElementById('localgemmamodel').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('localqwenmodel').classList.contains('hidden'));

    await page.fill("[data-textsetting='localqwenmodel']", 'qwen3.5-0.8b-onnx');
    await page.dispatchEvent("[data-textsetting='localqwenmodel']", 'change');

    await page.selectOption('#aiProvider', 'custom');
    await page.waitForFunction(() => document.getElementById('localgemmahost').classList.contains('hidden'));
    await page.waitForFunction(() => document.getElementById('localbrowserhelp').classList.contains('hidden'));
    await page.waitForFunction(() => document.getElementById('localqwenmodel').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('customAIEndpoint').classList.contains('hidden'));

    await page.selectOption('#aiProvider', 'localqwen');
    await page.waitForFunction(() => !document.getElementById('localgemmahost').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('localbrowserhelp').classList.contains('hidden'));
    await page.waitForFunction(() => !document.getElementById('localqwenmodel').classList.contains('hidden'));

    const finalState = await page.evaluate(() => ({
      hostVisible: !document.getElementById('localgemmahost').classList.contains('hidden'),
      helpVisible: !document.getElementById('localbrowserhelp').classList.contains('hidden'),
      gemmaModelHidden: document.getElementById('localgemmamodel').classList.contains('hidden'),
      qwenModelVisible: !document.getElementById('localqwenmodel').classList.contains('hidden'),
      customHidden: document.getElementById('customAIEndpoint').classList.contains('hidden'),
      hostValue: document.querySelector("[data-textsetting='localgemmahost']").value,
      gemmaModelValue: document.querySelector("[data-textsetting='localgemmamodel']").value,
      qwenModelValue: document.querySelector("[data-textsetting='localqwenmodel']").value,
      messages: window.__chromeMessages.slice()
    }));

    assert(finalState.hostVisible && finalState.helpVisible && finalState.qwenModelVisible, 'Popup did not show Local Qwen settings after selection.');
    assert(finalState.gemmaModelHidden, 'Popup did not hide the Local Gemma model field when Local Qwen was selected.');
    assert(finalState.customHidden, 'Popup did not hide Custom API settings when switching back to a local browser provider.');
    assert(finalState.hostValue === 'https://assets.example.com/models/', 'Popup did not preserve the shared local browser host value.');
    assert(finalState.gemmaModelValue === 'gemma4-e2b-it-onnx', 'Popup did not preserve the Local Gemma model value.');
    assert(finalState.qwenModelValue === 'qwen3.5-0.8b-onnx', 'Popup did not preserve the Local Qwen model value.');

    const aiProviderSaves = finalState.messages.filter((message) => message && message.cmd === 'saveSetting' && message.setting === 'aiProvider');
    const hostSaves = finalState.messages.filter((message) => message && message.cmd === 'saveSetting' && message.setting === 'localgemmahost');
    const gemmaModelSaves = finalState.messages.filter((message) => message && message.setting === 'localgemmamodel');
    const qwenModelSaves = finalState.messages.filter((message) => message && message.setting === 'localqwenmodel');

    assert(aiProviderSaves.some((message) => message.value === 'localgemma'), 'Popup did not save the Local Gemma provider selection.');
    assert(aiProviderSaves.some((message) => message.value === 'localqwen'), 'Popup did not save the Local Qwen provider selection.');
    assert(hostSaves.some((message) => message.value === 'https://assets.example.com/models/'), 'Popup did not save the Local Gemma host value.');
    assert(gemmaModelSaves.some((message) => message.value === 'gemma4-e2b-it-onnx'), 'Popup did not save the Local Gemma model value.');
    assert(qwenModelSaves.some((message) => message.value === 'qwen3.5-0.8b-onnx'), 'Popup did not save the Local Qwen model value.');
    assert(blockedExternalRequests.length === 0, `External requests were attempted: ${blockedExternalRequests.join(', ')}`);

    console.log('PASS popup local browser model settings e2e');
    await browser.close();
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
