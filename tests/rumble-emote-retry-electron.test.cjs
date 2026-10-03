'use strict';

// Real SSApp source window and relay, with local fixtures for the private API,
// catalog and images. No credentials, live channels or outgoing chat are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const sourceRoot = path.resolve(__dirname, '..');
const appRoot = process.env.SSAPP_REPO || path.resolve(sourceRoot, '../ssapp');
const { _electron } = require(require.resolve('playwright-core', { paths: [appRoot] }));
const electron = require(require.resolve('electron', { paths: [appRoot] }));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-rumble-emote-retry-'));
const profile = path.join(output, 'profile');
const apiUrl = 'https://rumble.com/-livestream-api/get-data?key=ssn-local-emote-fixture';
const popupUrl = 'https://rumble.com/chat/popup/123456789';
const imageUrl = 'https://example.com/ssn-rumble-fixture.png';
const codes = [':r+leotoast:', ':r+dancingbanana:', ':r+rumblecharge:'];
const failure = process.env.RUMBLE_EMOTE_FAILURE || 'network-error';
const mode = process.env.RUMBLE_EMOTE_MODE || 'polling';
assert.ok(['network-error', 'hung-request'].includes(failure), 'Unsupported emote failure fixture');
assert.ok(['polling', 'sse'].includes(mode), 'Unsupported Rumble chat mode');
const catalog = codes.map((code, index) => '{name:"' + code.slice(1, -1) +
    '",is_subs_only:false,position:' + index + ',file:"' + imageUrl + '"}').join(',');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9N8AAAAASUVORK5CYII=', 'base64');
const report = { failure, mode, catalogRequests: 0, sseRequests: 0 };
fs.mkdirSync(profile);
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
    streamID: 'rumble_local_test_' + Date.now(), state: true, settings: {}
}));

let app;
let sourcePage;
let pendingCatalogRoute;
let holdNextCatalog = false;
let pendingReconnectRoute;
let holdNextBatch = false;
let pendingBatch;
(async () => {
    console.log('Artifacts: ' + output);
    app = await _electron.launch({
        executablePath: electron, cwd: appRoot,
        args: ['.', '--running-from-source', '--multiinstance', '--preferlocalassets',
            '--filesource=' + pathToFileURL(sourceRoot + path.sep).href],
        env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DEBUG_LOGS: '0' },
        timeout: 60000
    });
    const main = await app.firstWindow();
    await main.waitForFunction(() => window.stateManager?.initialized && configReady, null, { timeout: 60000 });
    let background;
    for (let i = 0; i < 100; i++) {
        background = main.frames().find(frame => frame.url().includes('background.html'));
        if (background && await background.evaluate(() => typeof processIncomingMessage === 'function').catch(() => false)) break;
        await main.waitForTimeout(100);
    }
    assert.ok(background, 'SSApp background must load');
    await background.evaluate(() => {
        window.__rumbleTestMessages = [];
        const original = processIncomingMessage;
        processIncomingMessage = function (data) {
            if (data?.type === 'rumble' && data.chatname === 'Emote regression') {
                window.__rumbleTestMessages.push(JSON.parse(JSON.stringify(data)));
            }
            return original.apply(this, arguments);
        };
        // Keep the relay observation local to this isolated test instance.
        sendToDestinations = function () {};
    });
    await app.evaluate(({ ipcMain }, { apiUrl, codes }) => {
        const original = ipcMain._invokeHandlers.get('rumble-fetch-json');
        let messageId = 0;
        ipcMain.removeHandler('rumble-fetch-json');
        ipcMain.handle('rumble-fetch-json', (event, args) => {
            if (args.url !== apiUrl) return original(event, args);
            return { ok: true, status: 200, data: {
                type: 'user', followers: { num_followers: 0 }, subscribers: { num_subscribers: 0 },
                livestreams: [{ id: 123456789, title: 'Local emote fixture', is_live: true, watching_now: 0,
                    chat: { recent_messages: [{ id: ++messageId, username: 'Emote regression',
                        text: codes.join(' ') + ' \uD83D\uDC4B', badges: ['verified', 'moderator', 'whale'],
                        created_on: new Date().toISOString() }] } }]
            } };
        });
    }, { apiUrl, codes });
    await app.context().addInitScript(mode => {
        if (location.pathname.endsWith('/sources/websocket/rumble.html')) {
            localStorage.setItem('rumbleApiConfig', JSON.stringify({ useSse: mode === 'sse', replayHistory: true }));
        }
    }, mode);
    await app.context().route('https://web7.rumble.com/chat/api/chat/123456789/stream', async route => {
        const id = ++report.sseRequests;
        if (holdNextBatch) {
            holdNextBatch = false;
            pendingBatch = route;
            return;
        }
        // Pace real fetch/read cycles without replacing the source's SSE parser or timers.
        await new Promise(resolve => setTimeout(resolve, 750));
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({
            type: 'messages', data: {
                users: [{ id: 'fixture-user', username: 'Emote regression', badges: ['moderator'] }],
                messages: [{ id: String(id), user_id: 'fixture-user', text: codes.join(' ') + ' \uD83D\uDC4B',
                    time: new Date().toISOString() }]
            }
        }) + '\n\n' }).catch(() => {});
    });
    await app.context().route(popupUrl, async route => {
        report.catalogRequests++;
        if (holdNextCatalog) {
            holdNextCatalog = false;
            pendingReconnectRoute = route;
            return;
        }
        if (report.catalogRequests === 1) {
            if (failure === 'hung-request') {
                pendingCatalogRoute = route;
            } else {
                await route.abort('failed');
            }
        } else {
            await route.fulfill({ status: 200, contentType: 'text/html', body: catalog });
        }
    });
    await app.context().route(imageUrl, route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));

    const previous = new Set(app.windows());
    await main.evaluate(async apiUrl => {
        const id = stateManager.addSource({
            target: 'rumble', username: 'Rumble emote regression', url: '', videoId: '',
            connectionMode: 'websocket', isVisible: false, isMuted: true, autoActivate: false,
            supportsWSS: true, isChannel: true, rumbleApiTracker: true, rumbleApiUrl: apiUrl,
            rumbleFollowerCountMode: 'total', sourceFile: 'sources/websocket/rumble.js'
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        await activateSource(document.querySelector('[data-source-id="' + id + '"] [data-activatehtml]'));
    }, apiUrl);
    for (let i = 0; i < 150; i++) {
        sourcePage = app.windows().find(page => !previous.has(page));
        if (sourcePage) break;
        await main.waitForTimeout(100);
    }
    assert.ok(sourcePage, 'The real Rumble source window must open');
    await sourcePage.waitForFunction(() => document.getElementById('log')?.innerText.includes('Rumble emote catalog unavailable'), null, { timeout: 15000 });
    await sourcePage.waitForFunction(() => document.querySelectorAll('.feed-entry').length >= 3);
    assert.equal(await sourcePage.locator('.rumble-chat-emote').count(), 0, 'Failure initially leaves readable shortcodes');
    assert.equal(report.catalogRequests, 1, 'Chat polling must not hammer the failed catalog');
    console.log('Confirmed: chat continues with shortcodes after the first catalog request fails.');

    try {
        await sourcePage.waitForFunction(() => {
            const images = Array.from(document.querySelectorAll('.feed-entry:last-child .rumble-chat-emote'));
            return images.length === 3 && images.every(image => image.complete && image.naturalWidth > 0);
        }, null, { timeout: 45000 });
    } catch (_) {
        assert.fail('Rumble must retry the failed catalog and render new emotes without reconnecting');
    }
    assert.equal(report.catalogRequests, 2, 'One retry must recover the catalog');
    const messages = await background.evaluate(() => window.__rumbleTestMessages);
    assert.ok(messages.some(message => !message.chatmessage.includes('<img')), 'Plain fallback must reach the real relay');
    const recovered = messages.filter(message => (message.chatmessage.match(/<img /g) || []).length === 3);
    assert.ok(recovered.length, 'Recovered emote HTML must reach the real relay');
    assert.equal(recovered[0].meta.source, mode === 'sse' ? 'rumble_sse' : 'live_stream_api');
    assert.equal(recovered[0].textonly, false);
    assert.ok(recovered[0].chatmessage.endsWith(' \uD83D\uDC4B'));
    const log = await sourcePage.locator('#log').innerText();
    assert.equal((log.match(/Connecting to the Rumble Live Stream API\./g) || []).length, 1, 'Recovery must not reconnect chat');
    if (mode === 'sse') {
        assert.ok(report.sseRequests >= 3, 'Exercise repeated real SSE fetches');
        assert.ok(!log.includes('falling back'), 'SSE must recover without switching to polling');
    }
    await sourcePage.waitForTimeout(6500);
    assert.equal(report.catalogRequests, 2, 'A successful catalog stays cached over later polls');

    // Reconnect while an old catalog request is outstanding. Its late failure
    // must not erase the catalog downloaded by the replacement connection.
    holdNextCatalog = true;
    await sourcePage.locator('#disconnect').click();
    await sourcePage.locator('#connect').click();
    for (let i = 0; i < 50 && !pendingReconnectRoute; i++) await sourcePage.waitForTimeout(100);
    assert.ok(pendingReconnectRoute, 'Hold the old connection catalog request');
    await sourcePage.locator('#disconnect').click();
    await sourcePage.locator('#connect').click();
    await sourcePage.waitForFunction(() =>
        (document.getElementById('log').innerText.match(/Loaded 3 Rumble emotes/g) || []).length >= 2);
    await pendingReconnectRoute.abort('failed');
    pendingReconnectRoute = null;
    const rowCount = await sourcePage.locator('.feed-entry').count();
    await sourcePage.waitForFunction(count => document.querySelectorAll('.feed-entry').length >= count + 2,
        rowCount, { timeout: 10000 });
    assert.equal(await sourcePage.locator('.feed-entry:last-child .rumble-chat-emote').count(), 3,
        'New messages retain emotes after the old connection request fails');
    assert.equal(report.catalogRequests, 4, 'Late failures must not discard the replacement catalog');
    report.reconnectRacePassed = true;
    if (mode === 'sse') {
        holdNextBatch = true;
        for (let i = 0; i < 50 && !pendingBatch; i++) await sourcePage.waitForTimeout(100);
        assert.ok(pendingBatch, 'Hold an SSE response before disconnecting');
        await sourcePage.locator('#disconnect').click();
        await pendingBatch.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"type":"messages","data":{}}\n\n' });
        pendingBatch = null;
        await sourcePage.waitForTimeout(1500);
        assert.equal(report.catalogRequests, 4, 'A disconnected SSE response must not start another emote download');
        report.disconnectedBatchIgnored = true;
    }
    report.passed = true;
    console.log('PASS: catalog retry restores emotes; late failures cannot erase a replacement catalog.');
})().catch(error => {
    report.error = error.stack;
    console.error(error.stack);
    process.exitCode = 1;
}).finally(async () => {
    if (sourcePage) {
        report.log = await sourcePage.locator('#log').innerText().catch(() => '');
        await sourcePage.locator('#feed').screenshot({ path: path.join(output, 'feed.png') }).catch(() => {});
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    if (pendingCatalogRoute) await pendingCatalogRoute.abort().catch(() => {});
    if (pendingReconnectRoute) await pendingReconnectRoute.abort().catch(() => {});
    if (pendingBatch) await pendingBatch.abort().catch(() => {});
    if (app) await app.close();
});
