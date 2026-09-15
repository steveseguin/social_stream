'use strict';

// Real SSApp source windows, saved AI overlay HTML and live P2P signaling in a
// unique test room. No source channels or existing user profiles are opened.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const social = path.resolve(__dirname, '..');
const ssapp = process.env.SSAPP_REPO || path.resolve(social, '../ssapp');
const { _electron } = require(path.join(ssapp, 'node_modules/playwright-core'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-transport-lifecycle-'));
const room = 'lifecycle' + Date.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let app;
const errors = [];

async function run() {
    fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
        streamID: room, password: 'false', state: false, settings: { sdk: { setting: true } }, wsServer: false
    }));
    app = await _electron.launch({
        executablePath: require(path.join(ssapp, 'node_modules/electron')), cwd: ssapp,
        args: [path.join(ssapp, 'bootstrap.js'), '--running-from-source', '--multiinstance',
            '--filesource', pathToFileURL(social + path.sep).href],
        env: { ...process.env, SSAPP_USER_DATA_DIR: profile, UV_THREADPOOL_SIZE: '2' }, timeout: 60000
    });
    app.process().stdout.on('data', data => fs.appendFileSync(path.join(profile, 'stdout.log'), data));
    app.process().stderr.on('data', data => fs.appendFileSync(path.join(profile, 'stderr.log'), data));
    const main = await app.firstWindow();
    main.on('pageerror', error => errors.push(error.message));
    await main.waitForFunction(() => typeof document.getElementById('frame2')?.contentWindow?.saveAiPromptOverlays === 'function', null, { timeout: 60000 });
    await delay(6500);
    const bg = main.frames().find(frame => frame.url().includes('/background.html'));
    const popup = main.frames().find(frame => frame.url().includes('/popup.html'));
    assert(bg && popup);
    const setOn = value => main.evaluate(value => ipcRenderer.sendSync('fromPopup', { cmd: 'setOnOffState', data: { value } }), value);
    const settled = () => bg.waitForFunction(() => !transportTask, null, { timeout: 60000 });
    const alive = () => bg.evaluate(() => diagBridges.filter(bridge => bridge.diagSdk?.signaling?.readyState < 2).length);

    await popup.waitForFunction(() => document.getElementById('disableButtonText').textContent.includes('Disabled'));
    await popup.evaluate(() => applyPopupTranslationLanguageImmediately('en-uk'));
    await popup.waitForFunction(() => appliedImmediateTranslationLanguage === 'en-uk');
    assert.deepEqual(await popup.evaluate(() => ({
        checked: document.getElementById('extensionState').checked,
        text: document.getElementById('disableButtonText').textContent
    })), { checked: false, text: '🔌 Service Disabled' });
    console.log('PASS disabled status survives asynchronous translation');

    await bg.evaluate(async () => {
        await ensureNinjaSDKLoaded();
        window.diagBridges = [];
        const Original = NinjaBridge;
        window.NinjaBridge = class extends Original {
            constructor(options) { super(options); diagBridges.push(this); }
            init(options) {
                const result = super.init(options);
                this.diagSdk = this.vdo;
                return result;
            }
        };
        await saveAiPromptOverlays({ version: 1, activeOverlay: 'fixture', order: ['fixture'], overlays: {
            fixture: { html: '<!doctype html><html><body>Lifecycle overlay ready<script>window.received=[];window.addEventListener("message",function(e){var p=e.data&&e.data.dataReceived&&e.data.dataReceived.overlayNinja;if(p&&p.chatname)window.received.push(p);});</script><!--' + 'chunked-overlay-fixture '.repeat(1500) + '--></body></html>' }
        } });
    });
    const pendingWindow = app.waitForEvent('window');
    await main.evaluate(url => ipcRenderer.sendSync('createWindow', { url, visible: true, size: { width: 850, height: 650 } }),
        pathToFileURL(path.join(social, 'aioverlay.html')).href + '?session=' + room + '&overlay=fixture');
    const overlay = await pendingWindow;
    overlay.on('pageerror', error => errors.push(error.message));
    const loaded = () => overlay.waitForFunction(() => document.getElementById('overlayFrame')?.contentDocument?.body?.textContent.includes('Lifecycle overlay ready'), null, { timeout: 60000 });
    const fake = async () => {
        await overlay.evaluate(() => { document.getElementById('overlayFrame').contentWindow.received = []; });
        await main.evaluate(() => ipcRenderer.sendSync('fromPopup', { cmd: 'fakemsg' }));
        await overlay.waitForFunction(() => document.getElementById('overlayFrame').contentWindow.received.length > 0, null, { timeout: 15000 });
        await delay(1000);
        assert.equal(await overlay.evaluate(() => document.getElementById('overlayFrame').contentWindow.received.length), 1, 'One fake message, with no duplicate delivery');
    };

    await main.evaluate(() => {
        ipcRenderer.sendSync('fromPopup', { cmd: 'setOnOffState', data: { value: true } });
        ipcRenderer.sendSync('fromPopup', { cmd: 'setOnOffState', data: { value: true } });
    });
    await settled();
    await loaded();
    assert.equal(await alive(), 1);
    await fake();
    for (let i = 0; i < 2; i++) {
        await overlay.reload();
        await loaded();
        await fake();
    }
    console.log('PASS overlapping starts, chunked saved overlay loading, repeated reloads and fake messages');

    // Stop after the SDK has actually begun connecting, not just before the
    // initial delay. Let the real network operations finish and check disposal.
    await setOn(false);
    await settled();
    const before = await bg.evaluate(() => diagBridges.length);
    await setOn(true);
    await bg.waitForFunction(count => diagBridges.length > count && !diagBridges[diagBridges.length - 1].connected, before);
    await setOn(false);
    await settled();
    await delay(1500);
    assert.equal(await alive(), 0);
    assert.deepEqual(await bg.evaluate(() => ({ on: isExtensionOn, bridge: !!ninjaBridge, iframe: !!iframe })), { on: false, bridge: false, iframe: false });
    console.log('PASS stopping during SDK connection leaves no live transport');

    const starts = await bg.evaluate(() => diagBridges.length);
    await setOn(true);
    await bg.waitForFunction(count => diagBridges.length > count && !diagBridges[diagBridges.length - 1].connected, starts);
    await setOn(true);
    await settled();
    await overlay.reload();
    await loaded();
    assert.equal(await alive(), 1);
    await fake();
    console.log('PASS a new start supersedes an in-flight connection without abandoning it');

    // Switch transport while SDK startup is pending; only the latest mode wins.
    await setOn(false);
    await settled();
    await setOn(true);
    await main.evaluate(() => ipcRenderer.sendSync('fromPopup', { cmd: 'saveSetting', setting: 'sdk', type: 'setting', value: false }));
    await bg.waitForFunction(() => !useNinjaSDK);
    await settled();
    await overlay.reload();
    await loaded();
    assert.equal(await alive(), 0);
    assert.deepEqual(await bg.evaluate(() => ({ sdk: useNinjaSDK, bridge: !!ninjaBridge, iframe: !!iframe })), { sdk: false, bridge: false, iframe: true });
    await fake();
    console.log('PASS switching to iframe mode during startup retains overlay and chat delivery');

    await setOn(false);
    await settled();
    await main.evaluate(() => ipcRenderer.sendSync('fromPopup', { cmd: 'saveSetting', setting: 'sdk', type: 'setting', value: true }));
    await bg.waitForFunction(() => settings.sdk?.setting === true);
    await setOn(true);
    await settled();
    await overlay.reload();
    await loaded();
    await fake();
    await delay(10000);
    assert.equal(await alive(), 1);
    await main.evaluate(streamID => ipcRenderer.sendSync('fromPopup', { cmd: 'sidUpdated', streamID, state: false }), room + 'b');
    await bg.waitForFunction(stream => streamID === stream && !isExtensionOn, room + 'b');
    await settled();
    await delay(1500);
    assert.equal(await alive(), 0, 'A session update with state:false also stops the SDK');
    await main.evaluate(streamID => ipcRenderer.sendSync('fromPopup', { cmd: 'sidUpdated', streamID, state: true }), room);
    await bg.waitForFunction(stream => streamID === stream && isExtensionOn, room);
    await settled();
    await overlay.reload();
    await loaded();
    await fake();
    console.log('PASS session updates dispose the previous SDK and can reclaim the original room');
    await setOn(false);
    await settled();
    await delay(1500);
    assert.equal(await alive(), 0);
    assert.deepEqual(errors, [], 'No uncaught page errors');
    console.log('PASS switching back to SDK, sustained delivery and final teardown');
    console.log('Artifacts: ' + profile);
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    fs.writeFileSync(path.join(profile, 'page-errors.json'), JSON.stringify(errors, null, 2));
    if (app) await app.close();
});
