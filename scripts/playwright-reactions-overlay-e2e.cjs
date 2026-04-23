const { chromium } = require('playwright');
const path = require('path');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4177;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function addPopupInitScript(page, baseOrigin) {
  await page.addInitScript((origin) => {
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
        return `${origin}/${String(path || '').replace(/^\/+/, '')}`;
      },
      getManifest() {
        return { version: '0.0.0-test' };
      },
      sendMessage(message, callback) {
        messages.push(clone(message));
        if (message && message.cmd === 'getSettings') {
          asyncCallback(callback, {
            streamID: 'testsession',
            password: 'pw',
            settings: {}
          });
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
          return `${origin}/${String(path || '').replace(/^\/+/, '')}`;
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
  }, baseOrigin);
}

async function addSocketSpyInitScript(page) {
  await page.addInitScript(() => {
    window.__socketEvents = [];

    function FakeWebSocket(url) {
      this.url = url;
      this.readyState = 1;
      this.sent = [];
      window.__socketEvents.push({
        url,
        sent: this.sent
      });
      setTimeout(() => {
        if (typeof this.onopen === 'function') {
          this.onopen();
        }
      }, 0);
    }

    FakeWebSocket.prototype.send = function (message) {
      this.sent.push(message);
    };

    FakeWebSocket.prototype.close = function () {
      this.readyState = 3;
    };

    FakeWebSocket.prototype.addEventListener = function (eventName, listener) {
      if (eventName === 'message') {
        this._messageListener = listener;
      }
    };

    FakeWebSocket.prototype.removeEventListener = function () {};

    window.WebSocket = FakeWebSocket;
  });
}

async function addTikTokSourceInitScript(page, captureLikeEvent) {
  await page.addInitScript((allowMainLikeEvents) => {
    const messages = [];
    const runtimeListeners = [];

    function clone(value) {
      return value ? JSON.parse(JSON.stringify(value)) : value;
    }

    function asyncCallback(callback, value) {
      if (typeof callback === 'function') {
        setTimeout(() => callback(value), 0);
      }
    }

    const runtime = {
      id: 'playwright-test',
      lastError: null,
      getURL(srcPath) {
        return String(srcPath || '');
      },
      sendMessage() {
        const args = Array.prototype.slice.call(arguments);
        const callback = args.find((arg) => typeof arg === 'function');
        const message = args.find((arg) => arg && typeof arg === 'object' && typeof arg !== 'function');

        if (message && message.getSettings) {
          asyncCallback(callback, {
            state: true,
            settings: {
              capturelikeevent: !!allowMainLikeEvents,
              capturejoinedevent: true
            }
          });
          return;
        }

        if (message && message.message) {
          messages.push(clone(message));
        }

        asyncCallback(callback, {});
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        },
        removeListener(listener) {
          const index = runtimeListeners.indexOf(listener);
          if (index !== -1) {
            runtimeListeners.splice(index, 1);
          }
        }
      }
    };

    window.chrome = { runtime };
    window.__chromeMessages = messages;
    window.__runtimeListeners = runtimeListeners;
  }, captureLikeEvent);
}

async function setControlValue(page, selector, value, events) {
  await page.locator(selector).evaluate((element, details) => {
    element.value = details.value;
    details.events.forEach((eventName) => {
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  }, { value, events });
}

async function setCheckboxValue(page, selector, checked) {
  await page.locator(selector).evaluate((element, nextChecked) => {
    element.checked = nextChecked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, checked);
}

async function getOverlaySnapshot(page, payload, waitMs) {
  return page.evaluate(async ({ payload, waitMs }) => {
    var overlay = window.__reactionsOverlay;
    overlay.clearStage();
    overlay.processPayload(payload);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return {
      count: overlay.getStageCount(),
      history: overlay.getHistory(),
      background: getComputedStyle(document.body).backgroundColor,
      config: overlay.getConfig()
    };
  }, { payload, waitMs });
}

async function loadOverlay(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__reactionsOverlay && window.__reactionsOverlay.getConfig));
}

async function runTikTokSourceLikeCaptureCheck(context, captureLikeEvent, expectedTarget) {
  const page = await context.newPage();

  await addTikTokSourceInitScript(page, captureLikeEvent);
  await page.route('https://www.tiktok.com/@playwright/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!DOCTYPE html><html><head><title>TikTok fixture</title></head><body><div data-e2e="chat-room"></div></body></html>'
    });
  });

  await page.goto('https://www.tiktok.com/@playwright/live', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: path.join(ROOT, 'sources', 'tiktok.js') });
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    const chatRoom = document.querySelector('[data-e2e="chat-room"]');
    const card = document.createElement('div');
    const message = document.createElement('span');

    card.dataset.e2e = 'social-message';
    card.dataset.index = '808';
    message.textContent = 'liked the LIVE';
    card.appendChild(message);
    chatRoom.appendChild(card);
  });

  await page.waitForFunction(() => {
    return window.__chromeMessages.some((entry) => entry.message && entry.message.event === 'liked');
  }, null, { timeout: 5000 });

  const likedMessages = await page.evaluate(() => {
    return window.__chromeMessages
      .filter((entry) => entry.message && entry.message.event === 'liked')
      .map((entry) => Object.assign({ target: entry.target || '' }, entry.message));
  });

  assert(likedMessages.length === 1, 'TikTok source did not emit the anonymous liked event.');
  assert((likedMessages[0].target || '') === (expectedTarget || ''), 'TikTok liked event used the wrong delivery target.');
  assert(likedMessages[0].type === 'tiktok', 'TikTok liked event has the wrong source type.');
  assert(likedMessages[0].chatname === '', 'Anonymous TikTok liked events should keep chatname empty.');
  assert(likedMessages[0].chatmessage === 'liked the LIVE', 'TikTok liked event message text changed unexpectedly.');

  await page.close();
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

    const popupPage = await context.newPage();
    await addPopupInitScript(popupPage, `http://${HOST}:${PORT}`);
    await popupPage.goto(`http://${HOST}:${PORT}/popup.html`, { waitUntil: 'domcontentloaded' });
    await popupPage.waitForFunction(() => {
      var link = document.getElementById('reactionslink');
      return !!(link && link.href && link.href.indexOf('reactions.html?session=testsession') !== -1);
    });

    await setCheckboxValue(popupPage, "[data-param27='align']", true);
    await setControlValue(popupPage, '#reactions-align-select', 'right', ['change']);
    await setCheckboxValue(popupPage, "[data-param27='layout']", true);
    await setControlValue(popupPage, '#reactions-layout-select', 'fountain', ['change']);
    await setCheckboxValue(popupPage, '#reactions-triple-toggle', true);
    await setCheckboxValue(popupPage, "[data-param27='scale']", true);
    await setControlValue(popupPage, '#reactions-scale-range', '1.35', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param27='speed']", true);
    await setControlValue(popupPage, '#reactions-speed-range', '1.25', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param27='burst']", true);
    await setControlValue(popupPage, '#reactionBurst', '7', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param27='limit']", true);
    await setControlValue(popupPage, '#reactionLimit', '90', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param27='pagebg']", true);
    await setControlValue(popupPage, '#reactions_pagebg', '#123456', ['input', 'change']);

    const popupHref = await popupPage.getAttribute('#reactionslink', 'href');
    const popupUrl = new URL(popupHref);

    assert(popupUrl.searchParams.get('session') === 'testsession', 'Reactions popup link is missing the session id.');
    assert(popupUrl.searchParams.get('password') === 'pw', 'Reactions popup link is missing the password.');
    assert(popupUrl.searchParams.get('align') === 'right', 'Reactions popup link is missing align=right.');
    assert(popupUrl.searchParams.get('layout') === 'fountain', 'Reactions popup link is missing layout=fountain.');
    assert(popupUrl.searchParams.get('scale') === '1.35', 'Reactions popup link is missing scale=1.35.');
    assert(popupUrl.searchParams.get('speed') === '1.25', 'Reactions popup link is missing speed=1.25.');
    assert(popupUrl.searchParams.get('burst') === '7', 'Reactions popup link is missing burst=7.');
    assert(popupUrl.searchParams.get('limit') === '90', 'Reactions popup link is missing limit=90.');
    assert(popupUrl.searchParams.get('pagebg') === '#123456', 'Reactions popup link is missing pagebg=#123456.');
    assert(popupUrl.searchParams.has('triple'), 'Reactions popup link is missing the triple flag.');

    const overlayPage = await context.newPage();
    await addSocketSpyInitScript(overlayPage);
    await loadOverlay(overlayPage, popupUrl.toString());

    const overlayConfig = await overlayPage.evaluate(() => window.__reactionsOverlay.getConfig());
    assert(overlayConfig.align === 'right', 'Reactions page did not parse align=right.');
    assert(overlayConfig.layout === 'fountain', 'Reactions page did not parse layout=fountain.');
    assert(overlayConfig.scale === 1.35, 'Reactions page did not parse scale=1.35.');
    assert(overlayConfig.speed === 1.25, 'Reactions page did not parse speed=1.25.');
    assert(overlayConfig.burst === 7, 'Reactions page did not parse burst=7.');
    assert(overlayConfig.limit === 90, 'Reactions page did not parse limit=90.');
    assert(overlayConfig.pageBackground === '#123456', 'Reactions page did not parse pagebg=#123456.');
    assert(overlayConfig.triple === true, 'Reactions page did not parse the triple flag.');

    const bridgeSnapshot = await overlayPage.evaluate(async () => {
      const overlay = window.__reactionsOverlay;
      const iframe = document.querySelector('iframe[src*="vdo.socialstream.ninja"]');

      overlay.clearStage();
      if (!iframe || !iframe.contentWindow) {
        return {
          hasIframe: false,
          count: 0,
          history: []
        };
      }

      window.dispatchEvent(new MessageEvent('message', {
        source: iframe.contentWindow,
        data: {
          dataReceived: {
            overlayNinja: {
              event: 'liked',
              type: 'tiktok',
              chatmessage: 'liked the LIVE'
            }
          }
        }
      }));

      await new Promise((resolve) => setTimeout(resolve, 2400));
      return {
        hasIframe: true,
        count: overlay.getStageCount(),
        history: overlay.getHistory()
      };
    });

    assert(bridgeSnapshot.hasIframe, 'Reactions page did not create the VDO bridge iframe.');
    assert(bridgeSnapshot.count > 0, 'Reactions page did not render an anonymous TikTok like from the VDO bridge.');
    assert(bridgeSnapshot.history.every((item) => item.event === 'liked'), 'VDO bridge like burst created non-like reactions.');

    const fountainSnapshot = await getOverlaySnapshot(overlayPage, {
      event: 'reaction',
      type: 'zoom',
      chatname: 'Tester',
      chatmessage: '<span>👍</span>'
    }, 450);

    assert(fountainSnapshot.count === 3, 'Triple reaction mode should release three reaction items.');
    assert(fountainSnapshot.history.length === 3, 'Triple reaction mode did not create three recorded items.');
    assert(fountainSnapshot.background === 'rgb(18, 52, 86)', 'Page background setting was not applied.');
    fountainSnapshot.history.forEach((item) => {
      assert(item.align === 'right', 'Recorded reaction item lost the right alignment setting.');
      assert(item.layout === 'fountain', 'Recorded reaction item lost the fountain layout setting.');
      assert(item.left >= 64 && item.left <= 94, 'Right-aligned reactions spawned outside the right-side lane.');
      assert(item.drift >= -24 && item.drift <= 4, 'Fountain layout drift is outside the expected right-side range.');
      assert(item.size >= 51.2 && item.size <= 97.3, 'Scale setting did not affect reaction size as expected.');
      assert(item.duration >= 2.3 && item.duration <= 3.9, 'Speed setting did not affect reaction duration as expected.');
    });

    const imageScaleSnapshot = await overlayPage.evaluate(async () => {
      const overlay = window.__reactionsOverlay;
      const imageMarkup = '<img alt="reaction" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" style="width:12px;height:12px;max-width:12px;max-height:12px;">';

      overlay.clearStage();
      overlay.processPayload({
        event: 'reaction',
        type: 'zoom',
        id: 'inline-image-scale',
        chatmessage: imageMarkup
      });

      await new Promise((resolve) => setTimeout(resolve, 120));

      const item = document.querySelector('.reaction');
      const image = item && item.querySelector('img');
      return {
        itemWidth: item ? parseFloat(item.style.width) : 0,
        imageWidth: image ? parseFloat(getComputedStyle(image).width) : 0,
        imageHeight: image ? parseFloat(getComputedStyle(image).height) : 0
      };
    });

    assert(imageScaleSnapshot.itemWidth >= 51.2 && imageScaleSnapshot.itemWidth <= 97.3, 'Image reaction did not receive the scale-adjusted wrapper size.');
    assert(Math.abs(imageScaleSnapshot.imageWidth - imageScaleSnapshot.itemWidth) <= 0.75, 'Inline image width ignored the scale-adjusted wrapper size.');
    assert(Math.abs(imageScaleSnapshot.imageHeight - imageScaleSnapshot.itemWidth) <= 0.75, 'Inline image height ignored the scale-adjusted wrapper size.');

    const likeSnapshot = await getOverlaySnapshot(overlayPage, {
      event: 'liked',
      type: 'tiktok',
      chatname: 'Viewer',
      chatmessage: 'liked'
    }, 2400);

    assert(likeSnapshot.count === 21, 'Burst and triple settings should release 21 like hearts.');
    assert(likeSnapshot.history.length === 21, 'Like burst history length did not match the expected 21 items.');
    likeSnapshot.history.forEach((item) => {
      assert(item.event === 'liked', 'Like burst item should be marked as liked.');
    });

    const limitUrl = new URL(popupUrl.toString());
    limitUrl.searchParams.set('layout', 'spread');
    limitUrl.searchParams.set('burst', '4');
    limitUrl.searchParams.set('limit', '10');
    await loadOverlay(overlayPage, limitUrl.toString());
    const limitSnapshot = await getOverlaySnapshot(overlayPage, {
      event: 'liked',
      type: 'tiktok',
      chatname: 'Viewer',
      chatmessage: 'liked'
    }, 1500);

    assert(limitSnapshot.config.limit === 10, 'Limit override was not parsed by reactions.html.');
    assert(limitSnapshot.count === 10, 'Limit setting should cap visible reactions at ten items.');

    const alignRanges = {
      left: { min: 6, max: 36 },
      center: { min: 32, max: 68 },
      right: { min: 64, max: 94 }
    };

    for (const align of Object.keys(alignRanges)) {
      const alignUrl = new URL(popupUrl.toString());
      alignUrl.searchParams.set('align', align);
      alignUrl.searchParams.set('layout', 'column');
      alignUrl.searchParams.delete('triple');
      await loadOverlay(overlayPage, alignUrl.toString());
      const alignSnapshot = await getOverlaySnapshot(overlayPage, {
        event: 'reaction',
        type: 'zoom',
        chatname: 'Tester',
        chatmessage: '<span>🔥</span>'
      }, 250);

      assert(alignSnapshot.count === 1, `Column layout should emit one reaction without triple mode for ${align}.`);
      assert(alignSnapshot.history[0].layout === 'column', `Column layout was not applied for ${align}.`);
      assert(
        alignSnapshot.history[0].left >= alignRanges[align].min && alignSnapshot.history[0].left <= alignRanges[align].max,
        `Column layout spawned outside the ${align} lane.`
      );
      assert(
        Math.abs(alignSnapshot.history[0].drift) <= 4.1,
        `Column layout drift exceeded the expected narrow range for ${align}.`
      );
    }

    const spreadUrl = new URL(popupUrl.toString());
    spreadUrl.searchParams.set('align', 'center');
    spreadUrl.searchParams.set('layout', 'spread');
    spreadUrl.searchParams.delete('triple');
    await loadOverlay(overlayPage, spreadUrl.toString());
    const spreadSnapshot = await getOverlaySnapshot(overlayPage, {
      event: 'reaction',
      type: 'zoom',
      chatname: 'Tester',
      chatmessage: '<span>✨</span>'
    }, 250);

    assert(spreadSnapshot.count === 1, 'Spread layout should emit one reaction without triple mode.');
    assert(spreadSnapshot.history[0].layout === 'spread', 'Spread layout was not applied.');
    assert(spreadSnapshot.history[0].left >= 32 && spreadSnapshot.history[0].left <= 68, 'Spread layout escaped the centered lane.');
    assert(Math.abs(spreadSnapshot.history[0].drift) <= 16.1, 'Spread layout drift exceeded the expected range.');

    const serverModeChecks = [
      {
        url: `http://${HOST}:${PORT}/reactions.html?session=testsession&server`,
        expectedUrl: 'wss://io.socialstream.ninja/api',
        expectedOut: 3,
        expectedIn: 4
      },
      {
        url: `http://${HOST}:${PORT}/reactions.html?session=testsession&server2`,
        expectedUrl: 'wss://io.socialstream.ninja/extension',
        expectedOut: 3,
        expectedIn: 4
      },
      {
        url: `http://${HOST}:${PORT}/reactions.html?session=testsession&server3&out=9&in=10`,
        expectedUrl: 'wss://io.socialstream.ninja/extension',
        expectedOut: 9,
        expectedIn: 10
      },
      {
        url: `http://${HOST}:${PORT}/reactions.html?session=testsession&server&server2&server3`,
        expectedUrl: 'wss://io.socialstream.ninja/api',
        expectedOut: 3,
        expectedIn: 4
      },
      {
        url: `http://${HOST}:${PORT}/reactions.html?session=testsession&localserver&server2&server3`,
        expectedUrl: 'ws://127.0.0.1:3000',
        expectedOut: 3,
        expectedIn: 4
      },
      {
        url: `http://${HOST}:${PORT}/reactions.html?session=testsession&localserver`,
        expectedUrl: 'ws://127.0.0.1:3000',
        expectedOut: 3,
        expectedIn: 4
      }
    ];

    for (const check of serverModeChecks) {
      await loadOverlay(overlayPage, check.url);
      await overlayPage.waitForTimeout(40);
      const socketInfo = await overlayPage.evaluate(() => window.__socketEvents.slice());
      assert(socketInfo.length === 1, `Expected one socket connection for ${check.url}.`);
      assert(socketInfo[0].url === check.expectedUrl, `Wrong socket endpoint for ${check.url}.`);
      assert(socketInfo[0].sent.length >= 1, `Socket join payload missing for ${check.url}.`);
      const joinPayload = JSON.parse(socketInfo[0].sent[0]);
      assert(joinPayload.join === 'testsession', `Socket join room missing for ${check.url}.`);
      assert(joinPayload.out === check.expectedOut, `Socket out channel mismatch for ${check.url}.`);
      assert(joinPayload.in === check.expectedIn, `Socket in channel mismatch for ${check.url}.`);
    }

    await runTikTokSourceLikeCaptureCheck(context, false, 'reactions');
    await runTikTokSourceLikeCaptureCheck(context, true, '');

    await browser.close();

    if (blockedExternalRequests.length === 0) {
      console.log('Reactions overlay test passed.');
    } else {
      console.log(`Reactions overlay test passed with ${blockedExternalRequests.length} blocked external request(s).`);
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
})();
