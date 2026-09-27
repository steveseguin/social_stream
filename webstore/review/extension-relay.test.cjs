'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('../../../ssn_app/node_modules/playwright-core');
const { WebSocketServer } = require('../../../ssn_app/node_modules/ws');
const root = path.resolve(__dirname, '../candidate');
require('./use-candidate.cjs');
const { createStaticServer, closeServer } = require('../../tests/background-overlay-compat-matrix.test.cjs');

(async () => {
    const server = await createStaticServer();
    let context;
    const errors = [], peers = new Set(), forwarded = [];
    const relay = new WebSocketServer({host: '127.0.0.1', port: 0});
    await new Promise(resolve => relay.once('listening', resolve));
    const relayUrl = 'ws://127.0.0.1:' + relay.address().port;
    relay.on('connection', socket => {
        const peer = {socket, join:null}; peers.add(peer);
        socket.on('close', () => peers.delete(peer));
        socket.on('message', bytes => {
            const text = bytes.toString(); let data;
            try { data = JSON.parse(text); } catch (_) { return; }
            if (data.join) { peer.join = data; return; }
            if (!peer.join) return;
            for (const target of peers) {
                if (target !== peer && target.join && target.join.join === peer.join.join && target.join.in === peer.join.out) {
                    target.socket.send(text); forwarded.push(data);
                }
            }
        });
    });
    try {
        context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-webstore-review-')), {
            channel: 'chromium', headless: true,
            args: ['--load-extension=' + root, '--disable-extensions-except=' + root]
        });
        await context.route('**/*', route => {
            const url = route.request().url();
            if (url.startsWith('chrome-extension:') || url.startsWith(server.baseUrl)) return route.continue();
            return route.abort();
        });
        // Keep native localhost sockets. Block public signaling without the
        // Playwright WebSocket shim, which requires the eval that Dock disables.
        await context.addInitScript(relayUrl => {
            const NativeWebSocket = window.WebSocket;
            function LocalSocket(url, protocols) {
                if (String(url) === relayUrl) return protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);
                const blocked = new EventTarget();
                blocked.readyState = 3; blocked.send = blocked.close = function () {};
                return blocked;
            }
            LocalSocket.prototype = NativeWebSocket.prototype;
            for (const name of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) LocalSocket[name] = NativeWebSocket[name];
            window.WebSocket = LocalSocket;
        }, relayUrl);
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const id = new URL(worker.url()).host;
        let background = context.pages().find(page => page.url().includes('/background.html'));
        if (!background) { background = await context.newPage(); await background.goto('chrome-extension://' + id + '/background.html'); }
        background.on('pageerror', error => errors.push('background: ' + error.message));
        background.on('requestfailed', request => { if (request.url().startsWith('chrome-extension:')) console.log('Packaged resource unavailable:', new URL(request.url()).pathname); });
        await background.reload();
        console.log('Loaded isolated extension background');
        await background.waitForFunction(() => typeof settings === 'object' && typeof sendToDestinations === 'function' && typeof streamID === 'string' && streamID.length > 0);
        await background.evaluate(async relayUrl => {
            isExtensionOn = true; streamID = 'WEBSTORE_OFFLINE_FIXTURE'; password = false;
            if (socketserverDock) { socketserverDock.onclose = null; socketserverDock.close(); socketserverDock = false; }
            serverURLDock = relayUrl; serverURL = relayUrl;
            settings.server = false; settings.server2 = false; settings.server3 = false;
            await chrome.storage.local.set({ settings, streamID, password, isExtensionOn: true });
        }, relayUrl);
        const popup = await context.newPage();
        popup.on('pageerror', error => errors.push('popup: ' + error.message));
        popup.on('console', message => { if (message.type() === 'error') console.log('POPUP:', message.text().slice(0, 200)); });
        const openPopup = async () => {
            await popup.goto('chrome-extension://' + id + '/popup.html');
            await popup.waitForFunction(() => document.getElementById('dock')?.raw && typeof document.getElementById('server2')?.onchange === 'function');
        };
        await openPopup();
        for (const key of ['server', 'server2', 'server3']) {
            await popup.evaluate(key => { const el = document.querySelector('input[data-both="' + key + '"]'); if (!el.checked) el.click(); }, key);
            await background.waitForFunction(key => settings[key] === true || settings[key]?.both === true, key, {timeout: 8000}).catch(async error => {
                console.log('Switch state', key, await background.evaluate(key => ({value:settings[key],on:isExtensionOn}), key), errors);
                throw error;
            });
            const href = await popup.locator('#docklink').getAttribute('href');
            assert(new URL(href).searchParams.has(key), key + ' appears on clickable Dock URL');
        }
        await openPopup();
        const href = await popup.locator('#docklink').getAttribute('href');
        for (const key of ['server', 'server2', 'server3']) {
            assert(new URL(href).searchParams.has(key), key + ' persists after reopening');
            assert(await popup.locator('input[data-both="' + key + '"]').isChecked());
        }
        console.log('PASS real extension startup, all three server switches, storage and regenerated URLs');
        const dock = await context.newPage();
        dock.on('pageerror', error => errors.push('dock: ' + error.message));
        const dockUrl = new URL(server.baseUrl + '/dock.html' + new URL(href).search);
        dockUrl.searchParams.set('server2', relayUrl);
        dockUrl.searchParams.set('server', relayUrl);
        await dock.goto(dockUrl.href);
        const dockCdp = await context.newCDPSession(dock);
        async function waitDock(expression) {
            const deadline = Date.now() + 10000;
            while (Date.now() < deadline) {
                const result = await dockCdp.send('Runtime.evaluate', { expression, returnByValue: true });
                if (result.result?.value) return;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log('Dock debug', await dockCdp.send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,ws:typeof socketserverExtension,server2:typeof server2,body:document.body.innerText.slice(0,100)})', returnByValue: true }), errors, [...peers].map(peer => peer.join));
            throw Error('Dock condition timed out: ' + expression);
        }
        await waitDock('socketserverExtension && socketserverExtension.readyState === 1');
        await background.waitForFunction(() => socketserverDock && socketserverDock.readyState === 1);
        const joinDeadline = Date.now() + 5000;
        while (![...peers].some(peer => peer.join?.in === 4) || ![...peers].some(peer => peer.join?.out === 4)) {
            assert(Date.now() < joinDeadline, 'Background and Dock joined the test relay');
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        await popup.locator('[data-action="fakemsg"]').click();
        await waitDock('!!document.querySelector(".highlight-chat .hl-content")');
        console.log('PASS fake test button → background → isolated server relay → actual Dock');
        await background.evaluate(async () => {
            await sendToDestinations({ id: 912300, type: 'whatsapp', chatname: 'Offline fixture', chatmessage: 'WEBSTORE_WHATSAPP_CAPTURE <literal>', textonly: true });
        });
        await waitDock('document.body.textContent.includes("WEBSTORE_WHATSAPP_CAPTURE <literal>")');
        console.log('PASS captured-message-shaped payload → actual Dock with literal text preserved');
        for (const key of ['server', 'server2', 'server3']) {
            await popup.evaluate(key => document.querySelector('input[data-both="' + key + '"]').click(), key);
            await background.waitForFunction(key => !settings[key], key);
            assert(!new URL(await popup.locator('#docklink').getAttribute('href')).searchParams.has(key));
        }
        await openPopup();
        for (const key of ['server', 'server2', 'server3']) assert(!await popup.locator('input[data-both="' + key + '"]').isChecked());
        console.log('PASS switches disable cleanly and remain disabled after reopening');
        const capability = await background.evaluate(() => getOpenAIRealtimeCohostCapability());
        assert(/^[a-f0-9]{64}$/.test(capability));
        const cohostLink = new URL(await popup.locator('#cohostlink').getAttribute('href'));
        assert.equal(new URLSearchParams(cohostLink.hash.slice(1)).get('cohostauth'), capability);
        const urls = await popup.evaluate(() => {
            const original = document.getElementById('cohost').raw;
            const added = updateURL('server2', original);
            return {added, removed: removeQueryParamWithValue(added, 'server2')};
        });
        assert(new URL(urls.added).searchParams.has('server2'));
        assert.equal(new URL(urls.added).hash, cohostLink.hash);
        assert.equal(new URL(urls.removed).hash, cohostLink.hash);
        assert(!new URL(urls.removed).searchParams.has('server2'));
        const authorization = await background.evaluate(async capability => {
            const originalSend = sendDataP2P, originalTool = handleCohostToolRequest;
            const replies = []; let calls = 0;
            sendDataP2P = payload => replies.push(payload);
            handleCohostToolRequest = async () => { calls++; return {success:true}; };
            try {
                await processIncomingRequest({action:'cohostTool',tool:'spotify',target:'missing'}, 'fixture-peer');
                await processIncomingRequest({action:'cohostTool',tool:'spotify',target:'wrong',capability:'incorrect'}, 'fixture-peer');
                await processIncomingRequest({action:'cohostTool',tool:'spotify',target:'valid',capability}, 'fixture-peer');
                await processIncomingRequest({action:'cohostToolStatus',target:'status-denied'}, 'fixture-peer');
                return {calls, replies};
            } finally { sendDataP2P = originalSend; handleCohostToolRequest = originalTool; }
        }, capability);
        assert.equal(authorization.calls, 1);
        assert.equal(authorization.replies[0].cohostToolResponse.success, false);
        assert.equal(authorization.replies[1].cohostToolResponse.success, false);
        assert.equal(authorization.replies[2].cohostToolResponse.success, true);
        assert.match(authorization.replies[3].cohostToolStatus.error, /access denied/);
        console.log('PASS co-host private links, fragment preservation and tool authorization');
        await popup.locator('#searchIcon').click();
        await popup.locator('#searchInput').fill('watch streak');
        await popup.waitForFunction(() => document.body.classList.contains('popup-searching'));
        assert.equal(await popup.locator('input[data-setting="showtwitchwatchstreaks"]').count(), 1);
        assert(await popup.locator('input[data-setting="showtwitchwatchstreaks"]').evaluate(input => !input.closest('.popup-search-hidden')));
        await popup.locator('#searchInput').evaluate(input => input.dispatchEvent(new KeyboardEvent('keyup', {key:'Escape'})));
        assert(!await popup.locator('body').evaluate(body => body.classList.contains('popup-searching')));
        console.log('PASS shipped popup search finds the new Watch Streak control and clears');
        assert.deepEqual(errors, []);
        assert(forwarded.length > 0);
        console.log('PASS no popup/background/Dock page exceptions');
    } finally {
        if (context) await context.close();
        for (const peer of peers) peer.socket.terminate();
        await new Promise(resolve => relay.close(resolve));
        await closeServer(server.server);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
