#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const IMAGE_DIR = path.join(ROOT, 'actions', 'img');
const REVIEW_DIR = path.join(ROOT, 'tmp');

const MIME = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.wav': 'audio/wav'
};

function startServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((request, response) => {
            let pathname;
            try {
                pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
            } catch (error) {
                response.writeHead(400);
                response.end('Bad request');
                return;
            }

            let filePath = path.resolve(ROOT, '.' + pathname);
            if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
                response.writeHead(403);
                response.end('Forbidden');
                return;
            }
            if (filePath === ROOT || pathname.endsWith('/')) {
                filePath = path.join(filePath, 'index.html');
            }

            fs.readFile(filePath, (error, data) => {
                if (error) {
                    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
                    response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
                    return;
                }
                response.writeHead(200, {
                    'Cache-Control': 'no-store',
                    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
                });
                response.end(data);
            });
        });
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
        });
    });
}

const OBS_STUB = `
(function () {
    window.__obsCalls = [];
    class MockOBSWebSocket {
        constructor() {
            this.handlers = Object.create(null);
            window.__obsClient = this;
        }
        on(name, handler) {
            if (!this.handlers[name]) this.handlers[name] = [];
            this.handlers[name].push(handler);
        }
        emit(name, payload) {
            (this.handlers[name] || []).forEach(function (handler) { handler(payload || {}); });
        }
        async connect(url, password) {
            window.__obsConnect = { url: url, password: password || '' };
            return { obsWebSocketVersion: '5.6.0', negotiatedRpcVersion: 1 };
        }
        async disconnect() {}
        async call(name, data) {
            window.__obsCalls.push({ name: name, data: data === undefined ? null : data });
            if (name === 'GetVersion') {
                return { obsVersion: '31.0.0', obsWebSocketVersion: '5.6.0', rpcVersion: 1 };
            }
            if (name === 'GetInputList') {
                return { inputs: [
                    { inputName: 'Counter Text', inputUuid: 'text-uuid' },
                    { inputName: 'Media Source', inputUuid: 'media-uuid' },
                    { inputName: 'Music', inputUuid: 'music-uuid' },
                    { inputName: 'Browser Source', inputUuid: 'browser-uuid' },
                    { inputName: 'Camera', inputUuid: 'camera-uuid' }
                ] };
            }
            if (name === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Main' };
            if (name === 'GetSceneList') return { scenes: [{ sceneName: 'Main' }] };
            if (name === 'GetGroupList') return { groups: [] };
            if (name === 'GetSceneItemId') return { sceneItemId: 42 };
            if (name === 'GetSceneItemEnabled') return { sceneItemEnabled: false };
            if (name === 'GetSourceFilter') return { filterEnabled: false };
            if (name === 'GetInputMute') return { inputMuted: false };
            return {};
        }
    }
    window.OBSWebSocket = MockOBSWebSocket;
})();
`;

async function waitForRequest(page, requestName, startIndex) {
    await page.waitForFunction(
        ({ name, index }) => window.__obsCalls.slice(index).some(call => call.name === name),
        { name: requestName, index: startIndex },
        { timeout: 5000 }
    );
    return page.evaluate(
        ({ name, index }) => window.__obsCalls.slice(index).filter(call => call.name === name).pop(),
        { name: requestName, index: startIndex }
    );
}

async function runAction(page, action, requestName) {
    const startIndex = await page.evaluate(() => window.__obsCalls.length);
    await page.evaluate(payload => window.testAction(payload), action);
    return waitForRequest(page, requestName, startIndex);
}

async function testFlowActions(baseUrl, browser) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.route('**/thirdparty/obs-websocket.min.js', route => route.fulfill({
        status: 200,
        contentType: 'text/javascript; charset=utf-8',
        body: OBS_STUB
    }));
    await page.route('https://vdo.ninja/**', route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><script>window.__messages=[];addEventListener("message",function(event){window.__messages.push(event.data);});</script>'
    }));
    await page.route('https://vdo.socialstream.ninja/**', route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><script>window.__messages=[];addEventListener("message",function(event){window.__messages.push(event.data);});</script>'
    }));

    await page.goto(`${baseUrl}/actions.html?session=obs-e2e&obsws=ws://mock-obs:4455&obspw=test-password`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.testAction === 'function' && typeof window.testOBSWebSocketConnection === 'function');
    const connection = await page.evaluate(() => window.testOBSWebSocketConnection());
    assert.strictEqual(connection.ok, true, 'Flow Actions did not connect to the OBS WebSocket mock');
    assert.strictEqual(connection.obsWebSocketVersion, '5.6.0');

    let call = await runAction(page, { actionType: 'obsChangeScene', sceneName: 'BRB' }, 'SetCurrentProgramScene');
    assert.deepStrictEqual(call.data, { sceneName: 'BRB' });

    call = await runAction(page, { actionType: 'obsToggleSource', sourceName: 'Camera', visible: true }, 'SetSceneItemEnabled');
    assert.deepStrictEqual(call.data, { sceneName: 'Main', sceneItemId: 42, sceneItemEnabled: true });

    call = await runAction(page, { actionType: 'obsSetText', sourceName: 'Counter Text', text: 'now 2, need 15' }, 'SetInputSettings');
    assert.deepStrictEqual(call.data, {
        inputUuid: 'text-uuid',
        inputSettings: { text: 'now 2, need 15' },
        overlay: true
    });

    const mediaActions = {
        play: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
        pause: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
        restart: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
        stop: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
        next: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
        previous: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS'
    };
    for (const [operation, expectedAction] of Object.entries(mediaActions)) {
        call = await runAction(page, { actionType: 'obsMediaControl', sourceName: 'Media Source', operation }, 'TriggerMediaInputAction');
        assert.deepStrictEqual(call.data, { inputUuid: 'media-uuid', mediaAction: expectedAction });
    }

    call = await runAction(page, { actionType: 'obsSetVolume', sourceName: 'Music', volumeDb: -18.5 }, 'SetInputVolume');
    assert.deepStrictEqual(call.data, { inputUuid: 'music-uuid', inputVolumeDb: -18.5 });

    call = await runAction(page, { actionType: 'obsSetVolume', sourceName: 'Music', volumeDb: 99 }, 'SetInputVolume');
    assert.strictEqual(call.data.inputVolumeDb, 26, 'OBS volume was not clamped to the protocol maximum');

    call = await runAction(page, { actionType: 'obsRefreshBrowser', sourceName: 'Browser Source' }, 'PressInputPropertiesButton');
    assert.deepStrictEqual(call.data, { inputUuid: 'browser-uuid', propertyName: 'refreshnocache' });

    call = await runAction(page, { actionType: 'obsSetSourceFilter', sourceName: 'Camera', filterName: 'Blur', enabled: true }, 'SetSourceFilterEnabled');
    assert.deepStrictEqual(call.data, { sourceUuid: 'camera-uuid', filterName: 'Blur', filterEnabled: true });

    call = await runAction(page, { actionType: 'obsMuteSource', sourceName: 'Music', muted: true }, 'SetInputMute');
    assert.deepStrictEqual(call.data, { inputUuid: 'music-uuid', inputMuted: true });

    const directRequests = [
        [{ actionType: 'obsStartRecording' }, 'StartRecord'],
        [{ actionType: 'obsStopRecording' }, 'StopRecord'],
        [{ actionType: 'obsStartStreaming' }, 'StartStream'],
        [{ actionType: 'obsStopStreaming' }, 'StopStream'],
        [{ actionType: 'obsReplayBufferControl', operation: 'start' }, 'StartReplayBuffer'],
        [{ actionType: 'obsReplayBufferControl', operation: 'stop' }, 'StopReplayBuffer'],
        [{ actionType: 'obsReplayBufferControl', operation: 'toggle' }, 'ToggleReplayBuffer'],
        [{ actionType: 'obsReplayBuffer' }, 'SaveReplayBuffer']
    ];
    for (const [action, requestName] of directRequests) {
        call = await runAction(page, action, requestName);
        assert.strictEqual(call.name, requestName);
    }

    const iframe = page.locator('iframe').first();
    await iframe.waitFor({ state: 'attached', timeout: 5000 });
    await page.evaluate(() => {
        const bridge = document.querySelector('iframe');
        bridge.connectedPeers = { 'social-stream-peer': 'SocialStream' };
        window.__obsClient.emit('MediaInputPlaybackEnded', {
            inputName: 'Media Source',
            inputUuid: 'media-uuid'
        });
    });
    const bridgeFrame = page.frames().find(frame => frame !== page.mainFrame());
    assert(bridgeFrame, 'Flow Actions bridge iframe was not created');
    await bridgeFrame.waitForFunction(() => window.__messages.length > 0);
    const bridgeMessage = await bridgeFrame.evaluate(() => window.__messages[0]);
    assert.strictEqual(bridgeMessage.sendData.overlayNinja.action, 'eventFlowEvent');
    assert.strictEqual(bridgeMessage.sendData.overlayNinja.value.type, 'obs');
    assert.strictEqual(bridgeMessage.sendData.overlayNinja.value.event, 'media_ended');
    assert.strictEqual(bridgeMessage.sendData.overlayNinja.value.meta.inputName, 'Media Source');
    assert.strictEqual(bridgeMessage.sendData.overlayNinja.value.meta.inputUuid, 'media-uuid');

    assert.deepStrictEqual(pageErrors, [], `Flow Actions page errors: ${pageErrors.join('; ')}`);
    await context.close();
}

async function testEditorAndCapture(baseUrl, browser) {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`${baseUrl}/actions/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.flowEditor && document.querySelector('[data-subtype="obsSetText"]'), null, { timeout: 15000 });
    await page.waitForSelector('#loading-modal', { state: 'hidden', timeout: 15000 });

    const editorContract = await page.evaluate(() => {
        const editor = window.flowEditor;
        const actionIds = editor.actionGroups.find(group => group.id === 'obs').actions.map(action => action.id);
        const triggerIds = editor.triggerGroups.find(group => group.id === 'obs-events').triggers.map(trigger => trigger.id);
        return { actionIds, triggerIds };
    });
    assert.deepStrictEqual(editorContract.actionIds, [
        'obsChangeScene', 'obsToggleSource', 'obsSetText', 'obsMediaControl', 'obsSetVolume',
        'obsRefreshBrowser', 'obsSetSourceFilter', 'obsMuteSource', 'obsStartRecording',
        'obsStopRecording', 'obsStartStreaming', 'obsStopStreaming', 'obsReplayBufferControl',
        'obsReplayBuffer'
    ]);
    assert(editorContract.triggerIds.includes('obsMediaEnded'), 'OBS Media Ended is missing from the trigger palette');

    const propertyContract = await page.evaluate(() => {
        const editor = window.flowEditor;
        const addNode = (type, subtype) => {
            editor.createNode(type, subtype, 500, 250);
            return editor.currentFlow.nodes[editor.currentFlow.nodes.length - 1];
        };
        editor.createNewFlow();

        const mediaNode = addNode('action', 'obsMediaControl');
        const mediaOperations = Array.from(document.querySelectorAll('#prop-operation option')).map(option => option.value);
        const mediaSource = document.querySelector('#prop-sourceName').value;

        const volumeNode = addNode('action', 'obsSetVolume');
        const volumeInput = document.querySelector('#prop-volumeDb');
        const volume = { value: volumeInput.value, min: volumeInput.min, max: volumeInput.max, source: document.querySelector('#prop-sourceName').value };

        const browserNode = addNode('action', 'obsRefreshBrowser');
        const browserSource = document.querySelector('#prop-sourceName').value;

        const replayNode = addNode('action', 'obsReplayBufferControl');
        const replayOperations = Array.from(document.querySelectorAll('#prop-operation option')).map(option => option.value);

        const mediaEndedNode = addNode('trigger', 'obsMediaEnded');
        const mediaEndedSource = document.querySelector('#prop-sourceName').value;

        return {
            mediaConfig: mediaNode.config,
            mediaOperations,
            mediaSource,
            volumeConfig: volumeNode.config,
            volume,
            browserConfig: browserNode.config,
            browserSource,
            replayConfig: replayNode.config,
            replayOperations,
            mediaEndedConfig: mediaEndedNode.config,
            mediaEndedSource
        };
    });
    assert.deepStrictEqual(propertyContract.mediaOperations, ['play', 'pause', 'restart', 'stop', 'next', 'previous']);
    assert.strictEqual(propertyContract.mediaConfig.operation, 'restart');
    assert.strictEqual(propertyContract.mediaSource, 'Media Source');
    assert.deepStrictEqual(propertyContract.volume, { value: '0', min: '-100', max: '26', source: 'Audio Source' });
    assert.strictEqual(propertyContract.volumeConfig.volumeDb, 0);
    assert.strictEqual(propertyContract.browserSource, 'Browser Source');
    assert.strictEqual(propertyContract.browserConfig.sourceName, 'Browser Source');
    assert.deepStrictEqual(propertyContract.replayOperations, ['start', 'stop', 'toggle']);
    assert.strictEqual(propertyContract.replayConfig.operation, 'start');
    assert.strictEqual(propertyContract.mediaEndedSource, '');
    assert.strictEqual(propertyContract.mediaEndedConfig.sourceName, '');

    await page.evaluate(() => {
        const source = document.querySelector('.action-group[data-group="obs"]');
        const clone = source.cloneNode(true);
        clone.id = 'obs-actions-capture';
        clone.querySelector('.action-group-items').style.display = 'block';
        clone.querySelector('.action-group-header').classList.remove('collapsed');
        clone.querySelector('.action-group-header').classList.add('expanded');
        clone.querySelector('.action-group-toggle').textContent = '▼';
        clone.style.width = '340px';
        clone.style.padding = '12px';
        clone.style.background = '#232631';
        clone.style.borderRadius = '12px';
        clone.style.position = 'fixed';
        clone.style.left = '24px';
        clone.style.top = '24px';
        clone.style.zIndex = '100000';
        document.body.appendChild(clone);
    });
    await page.locator('#obs-actions-capture').screenshot({ path: path.join(IMAGE_DIR, 'obs-control-actions.png') });
    await page.locator('#obs-actions-capture').evaluate(element => element.remove());

    await page.evaluate(() => {
        const editor = window.flowEditor;
        editor.createNewFlow();
        editor.createNode('action', 'obsSetText', 520, 260);
        const node = editor.currentFlow.nodes[editor.currentFlow.nodes.length - 1];
        node.config.sourceName = 'Counter Text';
        node.config.text = '{username}: now {counterValue}, need {counterTarget}';
        editor.showNodeProperties(node);
    });
    await page.waitForSelector('#prop-sourceName');
    assert.strictEqual(await page.locator('#prop-sourceName').inputValue(), 'Counter Text');
    assert.strictEqual(await page.locator('#prop-text').inputValue(), '{username}: now {counterValue}, need {counterTarget}');
    await page.locator('#node-properties').screenshot({ path: path.join(IMAGE_DIR, 'obs-set-text-properties.png') });

    assert.deepStrictEqual(pageErrors, [], `Event Flow editor errors: ${pageErrors.join('; ')}`);
    await context.close();
}

async function testGuide(baseUrl, browser) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const failures = [];
    page.on('response', response => {
        if (response.url().startsWith(baseUrl) && response.status() >= 400) {
            failures.push(`${response.status()} ${response.url()}`);
        }
    });
    await page.goto(`${baseUrl}/actions/obs-control-guide.html`, { waitUntil: 'networkidle' });
    const guideText = await page.locator('body').innerText();
    for (const required of [
        'OBS Media Ended', 'Set Text Source', 'Control Media Source', 'Set Source Volume',
        'Refresh Browser Source', 'Toggle Filter', 'Mute/Unmute Audio', 'Start Recording',
        'Stop Recording', 'Start Streaming', 'Stop Streaming', 'Control Replay Buffer',
        'Save Replay Buffer', 'Guests can use !cycle'
    ]) {
        assert(guideText.includes(required), `Guide is missing: ${required}`);
    }
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(desktopOverflow <= 1, `Guide has ${desktopOverflow}px horizontal overflow on desktop`);
    await page.screenshot({ path: path.join(REVIEW_DIR, 'obs-control-guide-review.png'), fullPage: false });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(mobileOverflow <= 1, `Guide has ${mobileOverflow}px horizontal overflow on mobile`);
    await page.screenshot({ path: path.join(REVIEW_DIR, 'obs-control-guide-mobile-review.png'), fullPage: false });
    assert.deepStrictEqual(failures, [], `Guide resource failures: ${failures.join('; ')}`);
    await context.close();
}

async function main() {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    fs.mkdirSync(REVIEW_DIR, { recursive: true });
    const { server, baseUrl } = await startServer();
    const browser = await chromium.launch({ headless: true });
    try {
        await testFlowActions(baseUrl, browser);
        console.log('PASS Flow Actions maps every OBS control to the expected WebSocket v5 request');
        await testEditorAndCapture(baseUrl, browser);
        console.log('PASS Event Flow exposes every OBS node and captured the guide screenshots');
        await testGuide(baseUrl, browser);
        console.log('PASS OBS guide loads all assets and fits desktop/mobile viewports');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => {
    console.error(error.stack || error);
    process.exit(1);
});
