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

async function addMultiAlertsInitScript(page) {
  await page.addInitScript(() => {
    window.__audioEvents = [];

    HTMLMediaElement.prototype.load = function () {
      this.dispatchEvent(new Event('canplaythrough'));
    };

    HTMLMediaElement.prototype.play = function () {
      window.__audioEvents.push({
        src: this.src || this.currentSrc || '',
        volume: this.volume
      });
      return Promise.resolve();
    };
  });
}

async function waitForPreviewFrame(page) {
  await page.waitForFunction(() => {
    const frame = document.getElementById('multi-alerts-preview-frame');
    return !!(frame && frame.src && frame.src.indexOf('multi-alerts.html') !== -1);
  });

  const handle = await page.$('#multi-alerts-preview-frame');
  let frame = null;
  let attempts = 0;

  while (!frame && attempts < 20) {
    frame = handle ? await handle.contentFrame() : null;
    if (!frame) {
      await page.waitForTimeout(50);
    }
    attempts += 1;
  }

  assert(frame, 'Preview iframe did not attach.');
  await frame.waitForFunction(() => !!(window.__multiAlertsOverlay && window.__multiAlertsOverlay.getSettings));
  return frame;
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

async function clickElement(page, selector) {
  await page.locator(selector).evaluate((element) => {
    element.click();
  });
}

async function loadOverlay(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__multiAlertsOverlay && window.__multiAlertsOverlay.getSettings));
}

async function getOverlaySnapshot(page, descriptor, waitMs = 160, options) {
  return page.evaluate(async ({ descriptor, waitMs, options }) => {
    window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
    await new Promise((resolve) => setTimeout(resolve, 80));
    window.__audioEvents.length = 0;
    window.__multiAlertsOverlay.preview(descriptor, options || undefined);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const article = document.querySelector('.alert-card');
    const rootStyles = getComputedStyle(document.documentElement);
    const bodyStyles = getComputedStyle(document.body);
    return {
      hasAlert: !!article,
      articleClass: article ? article.className : '',
      titleText: document.querySelector('.alert-title') ? document.querySelector('.alert-title').textContent : '',
      bodyAlign: document.body.dataset.align || '',
      bodyBg: bodyStyles.backgroundColor,
      compactMode: document.body.classList.contains('compact-mode'),
      sourceVisible: !!document.querySelector('.source-badge'),
      avatarVisible: !!document.querySelector('.alert-avatar'),
      subtitleVisible: !!document.querySelector('.alert-subtitle'),
      amountVisible: !!document.querySelector('.alert-amount'),
      mediaVisible: !!document.querySelector('.alert-media'),
      scale: rootStyles.getPropertyValue('--overlay-scale').trim(),
      mediaScale: rootStyles.getPropertyValue('--media-scale').trim(),
      headlineScale: rootStyles.getPropertyValue('--headline-scale').trim(),
      detailScale: rootStyles.getPropertyValue('--detail-scale').trim(),
      audioEvents: window.__audioEvents.slice(),
      state: window.__multiAlertsOverlay.getState()
    };
  }, { descriptor, waitMs, options });
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  const blockedExternalRequests = [];
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
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
      const link = document.getElementById('multialertslink');
      return !!(link && link.href && link.href.indexOf('multi-alerts.html?session=testsession') !== -1);
    });

    await setCheckboxValue(popupPage, "[data-param25='disablefollows']", true);
    await setCheckboxValue(popupPage, "[data-param25='disablesubs']", true);
    await setCheckboxValue(popupPage, "[data-param25='disabledonos']", true);
    await setCheckboxValue(popupPage, "[data-param25='disablebits']", true);
    await setCheckboxValue(popupPage, "[data-param25='disableraids']", true);

    let popupUrl = new URL(await popupPage.getAttribute('#multialertslink', 'href'));
    ['disablefollows', 'disablesubs', 'disabledonos', 'disablebits', 'disableraids'].forEach((param) => {
      assert(popupUrl.searchParams.has(param), `Popup did not add ${param}.`);
    });

    await setCheckboxValue(popupPage, "[data-param25='disablefollows']", false);
    await setCheckboxValue(popupPage, "[data-param25='disablesubs']", false);
    await setCheckboxValue(popupPage, "[data-param25='disabledonos']", false);
    await setCheckboxValue(popupPage, "[data-param25='disablebits']", false);
    await setCheckboxValue(popupPage, "[data-param25='disableraids']", false);

    await setControlValue(popupPage, "[data-optionparam25='followstyle']", 'classic', ['change']);
    await setControlValue(popupPage, "[data-optionparam25='substyle']", 'minimal', ['change']);
    await setControlValue(popupPage, "[data-optionparam25='donostyle']", 'twitch', ['change']);
    await setControlValue(popupPage, "[data-optionparam25='bitsstyle']", 'classic', ['change']);
    await setControlValue(popupPage, "[data-optionparam25='raidstyle']", 'minimal', ['change']);
    await setControlValue(popupPage, '#multialertsources', 'twitch,youtube', ['input', 'change']);
    await setControlValue(popupPage, '#multialerthidesources', 'kick', ['input', 'change']);
    await setControlValue(popupPage, '#multialertmindonation', '5', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='compact']", true);
    await setCheckboxValue(popupPage, "[data-param25='align=center']", true);

    popupUrl = new URL(await popupPage.getAttribute('#multialertslink', 'href'));
    assert(popupUrl.searchParams.get('align') === 'center', 'Popup did not add align=center.');

    await setCheckboxValue(popupPage, "[data-param25='align=center']", false);
    await setCheckboxValue(popupPage, "[data-param25='alignright']", true);
    popupUrl = new URL(await popupPage.getAttribute('#multialertslink', 'href'));
    assert(popupUrl.searchParams.has('alignright'), 'Popup did not add alignright.');

    await setCheckboxValue(popupPage, "[data-param25='alignright']", false);
    await setCheckboxValue(popupPage, "[data-param25='align=center']", true);

    await setCheckboxValue(popupPage, "[data-param25='scale']", true);
    await setControlValue(popupPage, "[data-numbersetting25='scale']", '1.25', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='headlinescale']", true);
    await setControlValue(popupPage, "[data-numbersetting25='headlinescale']", '1.4', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='detailscale']", true);
    await setControlValue(popupPage, "[data-numbersetting25='detailscale']", '1.2', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='mediascale']", true);
    await setControlValue(popupPage, "[data-numbersetting25='mediascale']", '1.3', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='hideavatar']", true);
    await setCheckboxValue(popupPage, "[data-param25='hidemedia']", true);
    await setCheckboxValue(popupPage, "[data-param25='hidesource']", true);
    await setCheckboxValue(popupPage, "[data-param25='hidesubtitle']", true);
    await setCheckboxValue(popupPage, "[data-param25='hideamount']", true);
    await setCheckboxValue(popupPage, "[data-param25='chroma=00ff00']", true);
    popupUrl = new URL(await popupPage.getAttribute('#multialertslink', 'href'));
    assert(popupUrl.searchParams.get('chroma') === '00ff00', 'Popup did not add chroma=00ff00.');
    await setCheckboxValue(popupPage, "[data-param25='chroma=00ff00']", false);

    await setCheckboxValue(popupPage, "[data-param25='beep']", true);
    await setCheckboxValue(popupPage, "[data-param25='beepvolume']", true);
    await setControlValue(popupPage, "[data-numbersetting25='beepvolume']", '80', ['input', 'change']);
    await setControlValue(popupPage, "[data-textparam25='custombeep']", `http://${HOST}:${PORT}/audio/custom.wav`, ['input', 'change']);
    await setControlValue(popupPage, "[data-textparam25='followsound']", `http://${HOST}:${PORT}/audio/follow.wav`, ['input', 'change']);
    await setControlValue(popupPage, "[data-textparam25='subsound']", `http://${HOST}:${PORT}/audio/sub.wav`, ['input', 'change']);
    await setControlValue(popupPage, "[data-textparam25='donosound']", `http://${HOST}:${PORT}/audio/dono.wav`, ['input', 'change']);
    await setControlValue(popupPage, "[data-textparam25='bitssound']", `http://${HOST}:${PORT}/audio/bits.wav`, ['input', 'change']);
    await setControlValue(popupPage, "[data-textparam25='raidsound']", `http://${HOST}:${PORT}/audio/raid.wav`, ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='showtime']", true);
    await setControlValue(popupPage, "[data-numbersetting25='showtime']", '2200', ['change']);
    await setCheckboxValue(popupPage, "[data-param25='cooldown']", true);
    await setControlValue(popupPage, "[data-numbersetting25='cooldown']", '300', ['change']);
    await setCheckboxValue(popupPage, "[data-param25='queue']", true);
    await setCheckboxValue(popupPage, "[data-param25='debug']", true);
    await setControlValue(popupPage, "[data-textparam25='pagebg']", '#112233', ['input', 'change']);
    await setCheckboxValue(popupPage, "[data-param25='pagebg']", true);
    await setCheckboxValue(popupPage, "[data-param25='chroma=00ff00']", true);
    let popupUrlWithChroma = new URL(await popupPage.getAttribute('#multialertslink', 'href'));
    assert(popupUrlWithChroma.searchParams.get('pagebg') === '#112233', 'Popup should keep pagebg when chroma is enabled.');
    assert(popupUrlWithChroma.searchParams.get('chroma') === '00ff00', 'Popup did not re-add chroma=00ff00.');
    await setCheckboxValue(popupPage, "[data-param25='chroma=00ff00']", false);

    popupUrl = new URL(await popupPage.getAttribute('#multialertslink', 'href'));
    assert(popupUrl.searchParams.get('followstyle') === 'classic', 'Popup did not add followstyle=classic.');
    assert(popupUrl.searchParams.get('substyle') === 'minimal', 'Popup did not add substyle=minimal.');
    assert(popupUrl.searchParams.get('donostyle') === 'twitch', 'Popup did not add donostyle=twitch.');
    assert(popupUrl.searchParams.get('bitsstyle') === 'classic', 'Popup did not add bitsstyle=classic.');
    assert(popupUrl.searchParams.get('raidstyle') === 'minimal', 'Popup did not add raidstyle=minimal.');
    assert(popupUrl.searchParams.get('sources') === 'twitch,youtube', 'Popup did not add sources filter.');
    assert(popupUrl.searchParams.get('hidesources') === 'kick', 'Popup did not add hidesources filter.');
    assert(popupUrl.searchParams.get('mindonation') === '5', 'Popup did not add mindonation=5.');
    assert(popupUrl.searchParams.has('compact'), 'Popup did not add compact.');
    assert(popupUrl.searchParams.get('align') === 'center', 'Popup did not restore align=center.');
    assert(popupUrl.searchParams.get('scale') === '1.25', 'Popup did not add scale=1.25.');
    assert(popupUrl.searchParams.get('headlinescale') === '1.4', 'Popup did not add headlinescale=1.4.');
    assert(popupUrl.searchParams.get('detailscale') === '1.2', 'Popup did not add detailscale=1.2.');
    assert(popupUrl.searchParams.get('mediascale') === '1.3', 'Popup did not add mediascale=1.3.');
    ['hideavatar', 'hidemedia', 'hidesource', 'hidesubtitle', 'hideamount'].forEach((param) => {
      assert(popupUrl.searchParams.has(param), `Popup did not add ${param}.`);
    });
    assert(popupUrl.searchParams.get('pagebg') === '#112233', 'Popup did not add pagebg=#112233.');
    assert(popupUrl.searchParams.has('beep'), 'Popup did not add beep.');
    assert(popupUrl.searchParams.get('beepvolume') === '80', 'Popup did not add beepvolume=80.');
    assert(popupUrl.searchParams.get('custombeep') === `http://${HOST}:${PORT}/audio/custom.wav`, 'Popup did not add custombeep.');
    assert(popupUrl.searchParams.get('followsound') === `http://${HOST}:${PORT}/audio/follow.wav`, 'Popup did not add followsound.');
    assert(popupUrl.searchParams.get('subsound') === `http://${HOST}:${PORT}/audio/sub.wav`, 'Popup did not add subsound.');
    assert(popupUrl.searchParams.get('donosound') === `http://${HOST}:${PORT}/audio/dono.wav`, 'Popup did not add donosound.');
    assert(popupUrl.searchParams.get('bitssound') === `http://${HOST}:${PORT}/audio/bits.wav`, 'Popup did not add bitssound.');
    assert(popupUrl.searchParams.get('raidsound') === `http://${HOST}:${PORT}/audio/raid.wav`, 'Popup did not add raidsound.');
    assert(popupUrl.searchParams.get('showtime') === '2200', 'Popup did not add showtime=2200.');
    assert(popupUrl.searchParams.get('cooldown') === '300', 'Popup did not add cooldown=300.');
    assert(popupUrl.searchParams.has('queue'), 'Popup did not add queue.');
    assert(popupUrl.searchParams.has('debug'), 'Popup did not add debug.');

    await popupPage.waitForFunction(() => {
      const frame = document.getElementById('multi-alerts-preview-frame');
      return !!(
        frame &&
        frame.src &&
        frame.src.indexOf('preview=1') !== -1 &&
        frame.src.indexOf('embedded=1') !== -1 &&
        frame.src.indexOf('followstyle=classic') !== -1 &&
        frame.src.indexOf('pagebg=%23112233') !== -1
      );
    });

    let previewFrame = await waitForPreviewFrame(popupPage);
    const previewFrameSrc = await popupPage.getAttribute('#multi-alerts-preview-frame', 'src');
    const previewUrl = new URL(previewFrameSrc);
    assert(previewUrl.searchParams.get('preview') === '1', 'Preview iframe URL is missing preview=1.');
    assert(previewUrl.searchParams.get('embedded') === '1', 'Preview iframe URL is missing embedded=1.');
    assert(previewUrl.searchParams.get('align') === 'center', 'Preview iframe URL lost align=center.');
    assert(previewUrl.searchParams.get('pagebg') === '#112233', 'Preview iframe URL lost pagebg=#112233.');
    assert(previewUrl.searchParams.get('followstyle') === 'classic', 'Preview iframe URL lost followstyle=classic.');
    assert(previewUrl.searchParams.get('sources') === 'twitch,youtube', 'Preview iframe URL lost the sources filter.');
    assert(previewUrl.searchParams.get('mindonation') === '5', 'Preview iframe URL lost mindonation=5.');

    await setControlValue(popupPage, '#multi-alert-preview-platform', 'twitch', ['change']);
    previewFrame = await waitForPreviewFrame(popupPage);
    await clickElement(popupPage, '#multi-alert-preview-follow');
    await previewFrame.waitForFunction(() => !!document.querySelector('.alert-card'));
    let previewSnapshot = await previewFrame.evaluate(() => ({
      articleClass: document.querySelector('.alert-card') ? document.querySelector('.alert-card').className : '',
      bodyAlign: document.body.dataset.align || '',
      bodyBg: getComputedStyle(document.body).backgroundColor,
      titleText: document.querySelector('.alert-title') ? document.querySelector('.alert-title').textContent : '',
      hasSource: !!document.querySelector('.source-badge'),
      hasAvatar: !!document.querySelector('.alert-avatar'),
      hasSubtitle: !!document.querySelector('.alert-subtitle'),
      hasAmount: !!document.querySelector('.alert-amount'),
      hasMedia: !!document.querySelector('.alert-media'),
      state: window.__multiAlertsOverlay.getState()
    }));
    assert(previewSnapshot.articleClass.includes('theme-classic'), 'Preview iframe did not apply the follow theme.');
    assert(previewSnapshot.bodyAlign === 'center', 'Preview iframe did not apply center alignment.');
    assert(previewSnapshot.bodyBg === 'rgb(17, 34, 51)', 'Preview iframe did not apply pagebg=#112233.');
    assert(previewSnapshot.titleText === 'NEW FOLLOWER', 'Preview follow button did not render a follow alert.');
    assert(previewSnapshot.hasSource === false, 'Preview iframe did not hide the source badge.');
    assert(previewSnapshot.hasAvatar === false, 'Preview iframe did not hide the avatar.');
    assert(previewSnapshot.hasSubtitle === false, 'Preview iframe did not hide the subtitle.');
    assert(previewSnapshot.hasAmount === false, 'Preview iframe did not hide the amount.');
    assert(previewSnapshot.hasMedia === false, 'Preview iframe did not hide media.');

    await setControlValue(popupPage, '#multi-alert-preview-platform', 'kick', ['change']);
    previewFrame = await waitForPreviewFrame(popupPage);
    await clickElement(popupPage, '#multi-alert-preview-follow');
    await previewFrame.waitForTimeout(180);
    previewSnapshot = await previewFrame.evaluate(() => ({
      hasAlert: !!document.querySelector('.alert-card'),
      state: window.__multiAlertsOverlay.getState()
    }));
    assert(previewSnapshot.hasAlert === false, 'Kick preview should be filtered out by the sources allow-list.');
    assert(previewSnapshot.state.statusText.toLowerCase().includes('filtered out'), 'Filtered preview did not report a filtered status.');

    await setControlValue(popupPage, '#multi-alert-preview-platform', 'youtube', ['change']);
    previewFrame = await waitForPreviewFrame(popupPage);
    await clickElement(popupPage, '#multi-alert-preview-dono');
    await previewFrame.waitForFunction(() => {
      const card = document.querySelector('.alert-card');
      return !!(card && card.className.indexOf('theme-twitch') !== -1);
    });
    previewSnapshot = await previewFrame.evaluate(() => ({
      articleClass: document.querySelector('.alert-card') ? document.querySelector('.alert-card').className : '',
      titleText: document.querySelector('.alert-title') ? document.querySelector('.alert-title').textContent : '',
      state: window.__multiAlertsOverlay.getState()
    }));
    assert(previewSnapshot.articleClass.includes('theme-twitch'), 'Preview donation button did not apply the donation theme.');
    assert(previewSnapshot.titleText === 'NEW DONATION', 'Preview donation button did not render a donation alert.');

    await clickElement(popupPage, '#multi-alert-preview-clear');
    await previewFrame.waitForFunction(() => !document.querySelector('.alert-card'));
    previewSnapshot = await previewFrame.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(previewSnapshot.hasAlert === false, 'Preview clear button did not clear the iframe alert.');
    assert(previewSnapshot.statusText === 'Preview cleared', 'Preview clear button did not update the status text.');

    const overlayPage = await context.newPage();
    await addMultiAlertsInitScript(overlayPage);
    await loadOverlay(overlayPage, popupUrl.toString());

    const baseSettings = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getSettings());
    assert(baseSettings.align === 'center', 'Multi-alert overlay did not parse align=center.');
    assert(baseSettings.scale === 1.25, 'Multi-alert overlay did not parse scale=1.25.');
    assert(baseSettings.headlineScale === 1.4, 'Multi-alert overlay did not parse headlinescale=1.4.');
    assert(baseSettings.detailScale === 1.2, 'Multi-alert overlay did not parse detailscale=1.2.');
    assert(baseSettings.mediaScale === 1.3, 'Multi-alert overlay did not parse mediascale=1.3.');
    assert(baseSettings.pageBg === '#112233', 'Multi-alert overlay did not parse pagebg=#112233.');
    assert(baseSettings.beep === true, 'Multi-alert overlay did not parse beep.');
    assert(baseSettings.beepVolume === 0.8, 'Multi-alert overlay did not parse beepvolume=80%.');
    assert(baseSettings.customBeep === `http://${HOST}:${PORT}/audio/custom.wav`, 'Multi-alert overlay did not parse custombeep.');
    assert(baseSettings.styles.follow === 'classic', 'Follow style preset did not parse.');
    assert(baseSettings.styles.subscription === 'minimal', 'Sub style preset did not parse.');
    assert(baseSettings.styles.donation === 'twitch', 'Donation style preset did not parse.');
    assert(baseSettings.styles.bits === 'classic', 'Bits style preset did not parse.');
    assert(baseSettings.styles.raid === 'minimal', 'Raid style preset did not parse.');
    assert(baseSettings.includeSources.join(',') === 'twitch,youtube', 'Sources filter did not parse.');
    assert(baseSettings.excludeSources.join(',') === 'kick', 'Hidesources filter did not parse.');
    assert(baseSettings.minDonationValue === 5, 'Minimum donation value did not parse.');

    const followSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'follow',
      overrides: {
        type: 'twitch',
        platform: 'twitch',
        subtitle: 'Welcome in'
      }
    });
    assert(followSnapshot.hasAlert, 'Follow preview did not render.');
    assert(followSnapshot.articleClass.includes('theme-classic'), 'Follow preset is not applying the classic theme.');
    assert(followSnapshot.articleClass.includes('compact'), 'Compact mode did not apply to follow alerts.');
    assert(followSnapshot.bodyAlign === 'center', 'Center alignment did not apply.');
    assert(followSnapshot.bodyBg === 'rgb(17, 34, 51)', 'Page background color did not apply.');
    assert(followSnapshot.compactMode === true, 'Compact body class is missing.');
    assert(followSnapshot.sourceVisible === false, 'Hide source did not hide the source badge.');
    assert(followSnapshot.avatarVisible === false, 'Hide avatar did not hide the avatar.');
    assert(followSnapshot.subtitleVisible === false, 'Hide subtitle did not hide the subtitle.');
    assert(followSnapshot.amountVisible === false, 'Hide amount did not hide the amount.');
    assert(followSnapshot.mediaVisible === false, 'Hide media did not hide the media panel.');
    assert(followSnapshot.scale === '1.25', 'Overlay scale CSS variable did not apply.');
    assert(followSnapshot.mediaScale === '1.3', 'Media scale CSS variable did not apply.');
    assert(followSnapshot.headlineScale === '1.4', 'Headline scale CSS variable did not apply.');
    assert(followSnapshot.detailScale === '1.2', 'Detail scale CSS variable did not apply.');
    assert(followSnapshot.audioEvents.length === 1, 'Follow preview did not trigger audio.');
    assert(followSnapshot.audioEvents[0].src === `http://${HOST}:${PORT}/audio/follow.wav`, 'Follow preview did not use the follow sound override.');
    assert(Math.abs(followSnapshot.audioEvents[0].volume - 0.8) < 0.0001, 'Follow preview did not apply the audio volume.');

    const subSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'subscription',
      overrides: {
        type: 'youtube',
        platform: 'youtube'
      }
    });
    assert(subSnapshot.articleClass.includes('theme-minimal'), 'Subscription preset is not applying the minimal theme.');
    assert(subSnapshot.audioEvents[0].src === `http://${HOST}:${PORT}/audio/sub.wav`, 'Subscription preview did not use the subscription sound override.');

    const donationSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'donation',
      overrides: {
        type: 'twitch',
        platform: 'twitch'
      }
    });
    assert(donationSnapshot.articleClass.includes('theme-twitch'), 'Donation preset is not applying the twitch theme.');
    assert(donationSnapshot.audioEvents[0].src === `http://${HOST}:${PORT}/audio/dono.wav`, 'Donation preview did not use the donation sound override.');

    const bitsSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'bits',
      overrides: {
        type: 'twitch',
        platform: 'twitch'
      }
    });
    assert(bitsSnapshot.articleClass.includes('theme-classic'), 'Bits preset is not applying the classic theme.');
    assert(bitsSnapshot.audioEvents[0].src === `http://${HOST}:${PORT}/audio/bits.wav`, 'Bits preview did not use the bits sound override.');

    const raidSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'raid',
      overrides: {
        type: 'youtube',
        platform: 'youtube'
      }
    });
    assert(raidSnapshot.articleClass.includes('theme-minimal'), 'Raid preset is not applying the minimal theme.');
    assert(raidSnapshot.audioEvents[0].src === `http://${HOST}:${PORT}/audio/raid.wav`, 'Raid preview did not use the raid sound override.');

    const filteredSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'follow',
      overrides: {
        type: 'kick',
        platform: 'kick'
      }
    });
    assert(filteredSnapshot.hasAlert === false, 'Filtered kick source should not render an alert.');
    assert(filteredSnapshot.state.statusText.toLowerCase().includes('filtered out'), 'Filtered source did not report a filtered status.');

    const disabledBitsUrl = new URL(popupUrl.toString());
    disabledBitsUrl.searchParams.set('disablebits', '');
    await loadOverlay(overlayPage, disabledBitsUrl.toString());
    const disabledBitsSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'bits',
      overrides: {
        type: 'twitch',
        platform: 'twitch'
      }
    });
    assert(disabledBitsSnapshot.hasAlert === false, 'Disabled bits alerts should not render.');
    assert(disabledBitsSnapshot.state.statusText.toLowerCase().includes('disabled'), 'Disabled bits alerts did not report a disabled status.');

    const rightChromaUrl = new URL(popupUrl.toString());
    rightChromaUrl.searchParams.delete('align');
    rightChromaUrl.searchParams.set('alignright', '');
    rightChromaUrl.searchParams.set('chroma', '00ff00');
    await loadOverlay(overlayPage, rightChromaUrl.toString());
    const rightSettings = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getSettings());
    assert(rightSettings.align === 'right', 'Right alignment did not parse.');
    const rightSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'follow',
      overrides: {
        type: 'twitch',
        platform: 'twitch'
      }
    });
    assert(rightSnapshot.bodyAlign === 'right', 'Right alignment did not apply.');
    assert(rightSnapshot.bodyBg === 'rgb(0, 255, 0)', 'Chroma background did not apply.');

    const queueUrl = new URL(popupUrl.toString());
    queueUrl.searchParams.set('showtime', '1800');
    queueUrl.searchParams.set('cooldown', '100');
    queueUrl.searchParams.set('queue', '');
    await loadOverlay(overlayPage, queueUrl.toString());
    await overlayPage.evaluate(() => {
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload({
        event: 'donation',
        type: 'twitch',
        platform: 'twitch',
        chatname: 'Alpha',
        chatimg: './media/user1.jpg',
        chatmessage: 'Alpha support',
        hasDonation: '$5'
      });
      window.__multiAlertsOverlay.sendPayload({
        event: 'new_follower',
        type: 'twitch',
        platform: 'twitch',
        chatname: 'Beta',
        chatimg: './media/user2.jpg',
        chatmessage: 'Beta followed'
      });
    });
    await overlayPage.waitForTimeout(120);
    let queueState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(queueState.currentCategory === 'donation', 'First queued alert should render immediately.');
    assert(queueState.queueLength === 1, 'Second alert should have been queued.');
    await overlayPage.waitForTimeout(2050);
    queueState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(queueState.currentCategory === 'follow', 'Queued follow alert did not display after the first alert.');
    assert(queueState.queueLength === 0, 'Queue should be empty after the queued alert is promoted.');

    const noQueueUrl = new URL(queueUrl.toString());
    noQueueUrl.searchParams.delete('queue');
    await loadOverlay(overlayPage, noQueueUrl.toString());
    await overlayPage.evaluate(() => {
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload({
        event: 'donation',
        type: 'twitch',
        platform: 'twitch',
        chatname: 'Alpha',
        chatimg: './media/user1.jpg',
        chatmessage: 'Alpha support',
        hasDonation: '$5'
      });
      window.__multiAlertsOverlay.sendPayload({
        event: 'new_follower',
        type: 'twitch',
        platform: 'twitch',
        chatname: 'Beta',
        chatimg: './media/user2.jpg',
        chatmessage: 'Beta followed'
      });
    });
    await overlayPage.waitForTimeout(120);
    let noQueueState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(noQueueState.currentCategory === 'donation', 'No-queue mode should still show the first alert.');
    assert(noQueueState.queueLength === 0, 'No-queue mode should not accumulate queued alerts.');
    await overlayPage.waitForTimeout(2050);
    noQueueState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(noQueueState.currentCategory !== 'follow', 'No-queue mode should not display the dropped second alert.');

    await loadOverlay(overlayPage, queueUrl.toString());
    await overlayPage.evaluate(() => {
      const payload = {
        event: 'donation',
        type: 'twitch',
        platform: 'twitch',
        chatname: 'DupTester',
        chatimg: './media/user1.jpg',
        chatmessage: 'Duplicate payload',
        hasDonation: '$8'
      };
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload(payload);
      window.__multiAlertsOverlay.sendPayload(payload);
    });
    await overlayPage.waitForTimeout(120);
    const duplicateState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(duplicateState.currentCategory === 'donation', 'Duplicate test should still show the original alert.');
    assert(duplicateState.queueLength === 0, 'Duplicate alert payload should not be queued a second time.');

    await overlayPage.evaluate(() => {
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload({
        type: 'twitch',
        chatname: 'DonationOnlyTester',
        chatmessage: 'Thanks!',
        donation: '$12.34'
      });
    });
    await overlayPage.waitForTimeout(120);
    const donationOnlyState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(donationOnlyState.currentCategory === 'donation', 'Donation field without event should render as a donation alert.');

    await overlayPage.evaluate(() => {
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload({
        event: 'cheer',
        type: 'twitch',
        platform: 'twitch',
        chatname: 'TinyBitsTester',
        chatmessage: '100 bits should stay quiet',
        hasDonation: '100 bits'
      });
    });
    await overlayPage.waitForTimeout(120);
    const lowValueState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(lowValueState.hasAlert === false, 'Low cash-value bits should not trigger an alert.');

    await overlayPage.evaluate(() => {
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload({
        dataReceived: {
          overlayNinja: {
            event: 'channel.subscription.gifts',
            type: 'twitch',
            platform: 'twitch',
            chatname: 'AliasTester',
            chatmessage: 'AliasTester gifted 3 subs!'
          }
        }
      });
    });
    await overlayPage.waitForTimeout(120);
    const wrappedAliasState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(wrappedAliasState.currentCategory === 'subscription', 'Wrapped websocket alias event should render as a subscription alert.');

    await overlayPage.evaluate(() => {
      window.__multiAlertsOverlay.clear({ clearQueue: true, preserveCooldown: false });
      window.__multiAlertsOverlay.sendPayload({
        message: {
          event: true,
          type: 'twitch',
          platform: 'twitch',
          chatname: 'GenericEventTester',
          chatmessage: 'GenericEventTester gifted 5 Subs!'
        }
      });
    });
    await overlayPage.waitForTimeout(120);
    const genericEventState = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getState());
    assert(genericEventState.currentCategory === 'subscription', 'Generic event=true subscription text should render as a subscription alert.');

    const customBeepUrl = new URL(popupUrl.toString());
    customBeepUrl.searchParams.delete('followsound');
    await loadOverlay(overlayPage, customBeepUrl.toString());
    const customBeepSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'follow',
      overrides: {
        type: 'twitch',
        platform: 'twitch'
      }
    });
    assert(customBeepSnapshot.audioEvents[0].src === `http://${HOST}:${PORT}/audio/custom.wav`, 'Custom beep fallback did not apply when the follow override was removed.');

    const muteUrl = new URL(customBeepUrl.toString());
    muteUrl.searchParams.delete('beep');
    await loadOverlay(overlayPage, muteUrl.toString());
    const muteSnapshot = await getOverlaySnapshot(overlayPage, {
      category: 'follow',
      overrides: {
        type: 'twitch',
        platform: 'twitch'
      }
    });
    assert(muteSnapshot.audioEvents.length === 0, 'Muted alert overlay should not play audio.');

    const server2PreviewUrl = `http://${HOST}:${PORT}/multi-alerts.html?session=testsession&server2&preview`;
    await loadOverlay(overlayPage, server2PreviewUrl);
    let serverSettings = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getSettings());
    assert(serverSettings.serverURL === 'wss://io.socialstream.ninja/extension', 'Bare server2 should default to the extension websocket endpoint.');

    const server3PreviewUrl = `http://${HOST}:${PORT}/multi-alerts.html?session=testsession&server3&preview`;
    await loadOverlay(overlayPage, server3PreviewUrl);
    serverSettings = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getSettings());
    assert(serverSettings.serverURL === 'wss://io.socialstream.ninja/extension', 'Bare server3 should default to the extension websocket endpoint.');

    const serverPreviewUrl = `http://${HOST}:${PORT}/multi-alerts.html?session=testsession&server&preview`;
    await loadOverlay(overlayPage, serverPreviewUrl);
    serverSettings = await overlayPage.evaluate(() => window.__multiAlertsOverlay.getSettings());
    assert(serverSettings.serverURL === 'wss://io.socialstream.ninja/api', 'Bare server should default to the API websocket endpoint.');

    await browser.close();
    browser = null;

    if (blockedExternalRequests.length === 0) {
      console.log('Multi-alert overlay test passed.');
    } else {
      console.log(`Multi-alert overlay test passed with ${blockedExternalRequests.length} blocked external request(s).`);
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
  }
})();
