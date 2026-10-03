const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const extensionRoot = path.resolve(process.env.SSN_EXTENSION_ROOT || path.resolve(__dirname, ".."));
const tempRoot = process.env.SSN_SMOKE_TMP || os.tmpdir();
const profileDir = fs.mkdtempSync(path.join(tempRoot, "ssn-webstore-smoke-"));
const youtubeFixture = '<yt-live-chat-app><div id="items" class="yt-live-chat-item-list-renderer"></div></yt-live-chat-app>';

(async () => {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`
    ]
  });

  try {
    const pluralmindRequests = [];
    await context.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url());
      if (['www.youtube.com', 'youtube.com', 'studio.youtube.com'].includes(url.hostname) && ['/live_chat', '/live_chat_replay'].includes(url.pathname)) {
        return route.fulfill({ contentType: 'text/html', body: youtubeFixture });
      }
      if (url.hostname === 'studio.youtube.com' && url.pathname.startsWith('/video/')) {
        return route.fulfill({ contentType: 'text/html', body: '<iframe id="chatframe" src="https://studio.youtube.com/live_chat?v=ssnstudio02"></iframe>' });
      }
      if (url.hostname === 'www.youtube.com' && url.pathname === '/watch') {
        const chatPath = url.searchParams.has('replay') ? 'live_chat_replay' : 'live_chat';
        const body = url.searchParams.has('socialstream') ? youtubeFixture : `<div id="container"><div id="buttons"></div></div><ytd-comment-thread-renderer><div id="content-text">Ordinary video comment</div></ytd-comment-thread-renderer><iframe id="chatframe" src="https://www.youtube.com/${chatPath}?v=ssnwatch001"></iframe>`;
        return route.fulfill({ contentType: 'text/html', body });
      }
      if (url.hostname === 'api.socialstream.ninja' && url.pathname.startsWith('/youtube/')) {
        return route.fulfill({ json: { channelName: 'Offline Fixture', channelThumbnail: '' } });
      }
      if (url.hostname === 'www.twitch.tv' && url.pathname === '/popout/ssn_webstore_fixture/chat') {
        return route.fulfill({ contentType: 'text/html', body: '<div class="chat-list--default"><div id="fixture-messages"></div></div>' });
      }
      if (url.hostname === 'kick.com' && /\/(?:popout\/ssn_webstore_fixture\/chat|ssn_webstore_fixture\/chatroom)$/.test(url.pathname)) {
        return route.fulfill({ contentType: 'text/html', body: '<div id="chatroom-messages"><div id="fixture-messages"></div></div>' });
      }
      if (url.hostname === 'kick.com' && url.pathname.startsWith('/channels/')) {
        return route.fulfill({ json: { profilepic: '' } });
      }
      if (url.hostname === 'discord.com' && url.pathname === '/channels/ssnfixture/source') {
        return route.fulfill({ contentType: 'text/html', body: '<main>Offline Discord fixture; no video or media capture.</main>' });
      }
      if (url.hostname === 'pluralmind.chat' && url.pathname.startsWith('/api/v2/system/')) {
        pluralmindRequests.push(url.pathname);
        return route.fulfill({ json: { id: 'system-fixture', members: [{ id: 'member-fixture', name: 'Fixture Member', color: '#123456', pronouns: 'they/them', require_space: true, case_sensitive: false, proxies: [{ text: 'L:', type: 1 }] }] } });
      }
      if (url.hostname === 'socialstream.ninja') {
        const file = path.resolve(extensionRoot, '.' + decodeURIComponent(url.pathname));
        if (file.startsWith(extensionRoot + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
          return route.fulfill({ path: file });
        }
      }
      return route.abort();
    });
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;
    assert.ok(extensionId, "extension service worker did not expose an extension id");

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error && error.message ? error.message : error)));
    await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#searchInput", { state: "visible" });

    assert.equal(await page.locator("#trovo_username").count(), 0);
    assert.equal(await page.locator("#dlive_username").count(), 0);

    await page.locator("#searchInput").click();
    await page.locator("#searchInput").fill("twitch");
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#searchInput").isVisible(), true, "popup search input did not open");
    assert.equal(await page.evaluate(() => document.body.classList.contains("popup-searching")), true, "popup search did not run");
    assert.equal(page.isClosed(), false, "popup closed while opening search");

    const relevantErrors = pageErrors.filter((message) => !/ResizeObserver loop/i.test(message));
    assert.deepEqual(relevantErrors, [], `popup emitted runtime errors: ${relevantErrors.join(" | ")}`);

    const background = context.pages().find((candidate) => candidate.url().includes('/background.html')) || await context.newPage();
    const backgroundErrors = [];
    const missingFiles = [];
    background.on('pageerror', error => backgroundErrors.push(error.message));
    background.on('requestfailed', request => {
      if (request.url().startsWith(`chrome-extension://${extensionId}/`) && !/\/(badwords\.txt|goodwords\.txt|settings\.json)$/.test(request.url())) missingFiles.push(request.url());
    });
    if (!background.url().includes('/background.html')) {
      await background.goto(`chrome-extension://${extensionId}/background.html`, { waitUntil: 'domcontentloaded' });
    }
    await background.waitForFunction(() => window.ssappBackgroundLoadState && window.ssappBackgroundLoadState.status !== 'loading', { timeout: 30000 });
    assert.deepEqual(await background.evaluate(() => window.ssappBackgroundLoadState.failures), []);
    assert.deepEqual(backgroundErrors, []);
    assert.deepEqual(missingFiles, []);
    console.log('Background dependencies loaded without script failures.');

    await background.evaluate(() => {
      isExtensionOn = true;
      settings = {};
      window.__captured = [];
      sendDataP2P = data => window.__captured.push(JSON.parse(JSON.stringify(data)));
    });
    const youtube = await context.newPage();
    const twitch = await context.newPage();
    const kick = await context.newPage();
    const discord = await context.newPage();
    const discordLogs = [];
    discord.on('console', message => discordLogs.push(message.text()));
    const youtubeCases = [
      { name: 'YouTube', page: youtube, url: 'https://www.youtube.com/live_chat?v=ssnfixture1', expected: 1 },
      { name: 'YouTube bare-domain', url: 'https://youtube.com/live_chat?v=ssnfixture2', expected: 1 },
      { name: 'YouTube Studio popout', url: 'https://studio.youtube.com/live_chat?v=ssnstudio01', expected: 1 },
      { name: 'YouTube Studio embedded', url: 'https://studio.youtube.com/video/ssnstudio02/livestreaming', embedded: true, expected: 1 },
      { name: 'YouTube opted-in watch', url: 'https://www.youtube.com/watch?v=ssnoptin001&socialstream', expected: 1 },
      { name: 'Unrelated YouTube live', url: 'https://www.youtube.com/watch?v=ssnwatch001', embedded: true, expected: 0 },
      { name: 'Unrelated YouTube replay', url: 'https://www.youtube.com/watch?v=ssnwatch002&replay=1', embedded: true, expected: 0 }
    ];
    for (const testCase of youtubeCases) {
      testCase.page = testCase.page || await context.newPage();
      testCase.injections = 0;
      testCase.page.on('console', message => {
        if (message.text() === 'Social stream inserted') testCase.injections++;
      });
      await testCase.page.goto(testCase.url);
      testCase.frame = testCase.embedded ? testCase.page.frames().find(frame => frame.url().includes('/live_chat')) : testCase.page.mainFrame();
      assert.ok(testCase.frame, `${testCase.name}: fixture frame missing`);
    }
    await twitch.goto('https://www.twitch.tv/popout/ssn_webstore_fixture/chat');
    await kick.goto('https://kick.com/popout/ssn_webstore_fixture/chat');
    await discord.goto('https://discord.com/channels/ssnfixture/source');
    await youtube.waitForTimeout(6000);
    for (const [index, testCase] of youtubeCases.entries()) {
      await testCase.frame.evaluate(({ name, index }) => {
        document.querySelector('#items').insertAdjacentHTML('beforeend', `<yt-live-chat-text-message-renderer id="ssn-youtube-fixture-message-00000000000000${index}"><span id="author-name">${name} Fixture</span><span id="message">${name} capture check</span></yt-live-chat-text-message-renderer>`);
      }, { name: testCase.name, index });
    }
    await twitch.evaluate(() => {
      document.querySelector('#fixture-messages').insertAdjacentHTML('beforeend', '<div class="chat-line__message" data-id="ssn-twitch-1"><span class="chat-author__display-name">Twitch Fixture</span><span data-test-selector="chat-line-message-body">Twitch capture check</span></div>');
    });
    await kick.evaluate(() => document.querySelector('#fixture-messages').insertAdjacentHTML('beforeend', '<div data-index="1"><button title="Kick Fixture" class="inline font-bold" data-prevent-expand="true">Kick Fixture</button><span class="font-normal">Kick capture check</span></div>'));
    await background.waitForFunction(() => ['youtube', 'twitch', 'kick'].every(type => window.__captured.some(message => message.type === type && message.chatmessage && message.chatmessage.includes('capture check'))), null, { timeout: 20000 }).catch(async error => {
      console.log('Capture diagnostic:', await background.evaluate(() => ({ state: isExtensionOn, messages: window.__captured, settings })));
      throw error;
    });
    await youtube.waitForTimeout(1000);
    const captured = await background.evaluate(() => window.__captured.filter(message => message.chatmessage && message.chatmessage.includes('capture check')));
    const youtubeResults = youtubeCases.map(testCase => ({
      name: testCase.name,
      injections: testCase.injections,
      captured: captured.filter(message => message.chatmessage === `${testCase.name} capture check`).length
    }));
    console.log('YouTube routing:', JSON.stringify(youtubeResults));
    assert.deepEqual(youtubeResults, youtubeCases.map(testCase => ({ name: testCase.name, injections: testCase.expected, captured: testCase.expected })));
    assert.equal(await background.evaluate(() => window.__captured.some(message => message.chatmessage === 'Ordinary video comment')), false);
    assert.ok(discordLogs.includes('VDO.Ninja Discord integration is disabled'), 'Discord capture did not initialize with its packaged SDK');
    assert.ok(!discordLogs.some(message => message.includes('VDONinjaSDK not found')), 'Discord SDK dependency is missing');
    assert.deepEqual(pluralmindRequests, [], 'Disabled PluralMind must not make API requests');
    const proxied = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.twitch.tv/popout/ssn_webstore_fixture/chat' });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: async () => {
          if (!globalThis.SSNPluralmindIntegration) return { missing: true };
          return globalThis.SSNPluralmindIntegration.resolveMessage({ userId: 'fixture1234', message: 'L: packaged helper check' });
        }
      });
      return results[0].result;
    });
    assert.equal(proxied.name, 'Fixture Member', 'Twitch manifest did not load working PluralMind helpers');
    assert.equal(proxied.cleanedMessage, 'packaged helper check');
    assert.deepEqual(pluralmindRequests, ['/api/v2/system/fixture1234']);
    const dock = await context.newPage();
    const dockErrors = [];
    dock.on('pageerror', error => dockErrors.push(error.message));
    await dock.addInitScript(messages => {
      if (window !== window.top) return;
      window.addEventListener('load', () => setTimeout(() => {
        const bridge = document.querySelector('iframe[id^="frame_"]');
        messages.forEach(message => window.dispatchEvent(new MessageEvent('message', {
          source: bridge.contentWindow,
          data: { dataReceived: { overlayNinja: message } }
        })));
      }, 250));
    }, captured);
    await dock.goto('https://socialstream.ninja/dock.html?session=webstorefixture');
    await dock.getByText('YouTube capture check', { exact: true }).first().waitFor();
    await dock.getByText('Twitch capture check', { exact: true }).first().waitFor();
    await dock.getByText('Kick capture check', { exact: true }).first().waitFor();
    assert.deepEqual(dockErrors, []);
    console.log('Packaged YouTube, Twitch and Kick scripts captured through the extension background and rendered in the dashboard; Studio, frame exclusions, PluralMind dependencies and Discord SDK initialization passed.');

    // Exercise the actual popup controls Google previously reported as
    // nonfunctional, including re-enable and isolation from other services.
    let fixtureSequence = 100;
    async function appendFixture(type, message) {
      const target = { youtube, twitch, kick }[type];
      await target.evaluate(({ type, message, sequence }) => {
        if (type === 'youtube') {
          document.querySelector('#items').insertAdjacentHTML('beforeend', `<yt-live-chat-text-message-renderer id="ssn-review-toggle-message-0000000000000${sequence}"><span id="author-name">Toggle Fixture</span><span id="message">${message}</span></yt-live-chat-text-message-renderer>`);
        } else if (type === 'twitch') {
          document.querySelector('#fixture-messages').insertAdjacentHTML('beforeend', `<div class="chat-line__message" data-id="ssn-review-${sequence}"><span class="chat-author__display-name">Toggle Fixture</span><span data-test-selector="chat-line-message-body">${message}</span></div>`);
        } else {
          document.querySelector('#fixture-messages').insertAdjacentHTML('beforeend', `<div data-index="${sequence}"><button title="Toggle Fixture" class="inline font-bold" data-prevent-expand="true">Toggle Fixture</button><span class="font-normal">${message}</span></div>`);
        }
      }, { type, message, sequence: ++fixtureSequence });
    }
    async function setServiceDisabled(type, disabled) {
      const setting = `custom${type}state`;
      await page.evaluate(({ setting, disabled }) => {
        const checkbox = document.querySelector(`input[data-setting="${setting}"]`);
        checkbox.checked = disabled;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }, { setting, disabled });
      await background.waitForFunction(({ setting, disabled }) => Boolean(settings[setting]) === disabled, { setting, disabled });
      await page.waitForTimeout(500); // Allow the real background setting broadcast to reach content scripts.
    }
    for (const type of ['youtube', 'twitch', 'kick']) {
      await setServiceDisabled(type, true);
      const blocked = `${type} popup disabled check`;
      const unaffected = `${type} other service still captures`;
      await appendFixture(type, blocked);
      await appendFixture(type === 'kick' ? 'twitch' : 'kick', unaffected);
      await background.waitForFunction(message => window.__captured.some(item => item.chatmessage === message), unaffected);
      await page.waitForTimeout(1000);
      assert.equal(await background.evaluate(message => window.__captured.some(item => item.chatmessage === message), blocked), false, `${type} popup disable failed`);
      await setServiceDisabled(type, false);
      const resumed = `${type} popup reenabled check`;
      await appendFixture(type, resumed);
      await background.waitForFunction(message => window.__captured.some(item => item.chatmessage === message), resumed);
    }
    console.log('Popup service controls disable and re-enable YouTube, Twitch and Kick capture without disabling an unrelated service.');

    const soundCount = await background.evaluate(async () => {
      const audioContext = new AudioContext();
      try {
        for (const sound of SSNSoundLibrary.sounds) {
          const response = await fetch(sound.url);
          if (!response.ok) throw new Error('Missing sound: ' + sound.url);
          const decoded = await audioContext.decodeAudioData(await response.arrayBuffer());
          if (!(decoded.duration > 0)) throw new Error('Invalid sound: ' + sound.url);
        }
        return SSNSoundLibrary.sounds.length;
      } finally { await audioContext.close(); }
    });
    await background.addScriptTag({ url: `chrome-extension://${extensionId}/tts.js` });
    const speech = await background.evaluate(() => {
      const calls = [];
      const originalSpeak = speechSynthesis.speak;
      speechSynthesis.speak = utterance => calls.push({ text: utterance.text, volume: utterance.volume });
      try {
        TTS.voices = [];
        TTS.TTSProvider = 'system';
        TTS.volume = 0.25;
        TTS.pitch = 1;
        TTS.speak('Speech volume check', true);
        TTS.disableTTS = true;
        TTS.speak('Muted speech check', true);
        return calls;
      } finally { speechSynthesis.speak = originalSpeak; }
    });
    assert.deepEqual(speech, [{ text: 'Speech volume check', volume: 0.25 }]);
    console.log(`${soundCount} decoded packaged sounds and system TTS volume/mute passed (speech output stubbed).`);

    await page.close();
    console.log(`Web Store extension smoke passed (${extensionId}).`);
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
