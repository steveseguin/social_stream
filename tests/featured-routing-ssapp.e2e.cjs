'use strict';
// Sequential, isolated SSApp test using fictional chat and a loopback relay.
const { _electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const { WebSocketServer } = require(require.resolve('ws', { paths: [ssapp] }));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-featured-routing-'));
const room = 'featureqa' + Date.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise(resolve => relay.once('listening', resolve));
    const port = relay.address().port;
    function deliver(channel, data) {
        for (const socket of relay.clients) {
            if (socket.readyState === 1 && socket.join && socket.join.join === room && socket.join.in === channel) socket.send(JSON.stringify(data));
        }
    }
    relay.on('connection', socket => socket.on('message', raw => {
        const data = JSON.parse(raw.toString());
        if (data && data.join) socket.join = data;
        else if (socket.join && !(data && data.callback)) deliver(socket.join.out, data);
    }));
    const wrapper = path.join(output, 'bootstrap.cjs');
    fs.writeFileSync(path.join(output, 'savedSync.json'), JSON.stringify({ streamID: room, password: 'false', state: false, settings: {}, wsServer: false }));
    fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:new URL(d.url).hostname!=='127.0.0.1'})));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
    let app;
    try {
        app = await _electron.launch({ executablePath: path.join(ssapp, 'node_modules/electron/dist/electron.exe'),
            args: [wrapper, '--running-from-source', '--multiinstance', '--ssapp-headless-control', '--filesource', pathToFileURL(root + path.sep).href, '--no-hwa'],
            cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: output, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
        const main = await app.firstWindow();
        main.setDefaultTimeout(20000);
        await main.waitForFunction(() => document.querySelector('#frame2'));
        await main.locator('[data-page=streams]').click();
        const popup = main.frames().find(frame => /popup\.html/.test(frame.url()));
        assert(popup);
        await popup.waitForFunction(() => document.getElementById('overlay').raw && typeof refreshLinks === 'function');
        // Exercise the real popup settings handlers and final displayed hrefs.
        await popup.evaluate(() => {
            for (const key of ['server2', 'server3']) {
                const input = document.getElementById(key); input.checked = true; updateSettings(input, true);
            }
        });
        const generated = await popup.evaluate(() => ({ dock: document.getElementById('docklink').href, overlay: document.getElementById('overlaylink').href }));
        for (const url of Object.values(generated)) assert(new URL(url).searchParams.has('server'), 'generated selection route: ' + url);
        async function newPage() {
            const pending = app.waitForEvent('window');
            await app.evaluate(({ BrowserWindow }) => new BrowserWindow({ show: false, width: 1000, height: 720,
                webPreferences: { offscreen: true, backgroundThrottling: false } }).loadURL('about:blank'));
            const page = await pending; page.setDefaultTimeout(10000); return page;
        }
        const dockPage = await newPage(), featuredPage = await newPage();
        // Dock replaces eval; keep Playwright's evaluation bridge usable in this test window.
        await dockPage.addInitScript(() => Object.defineProperty(window, 'eval', { value: window.eval, writable: false, configurable: false }));
        function localUrl(raw, auto) {
            const url = new URL(raw);
            const file = url.pathname.includes('featured-styles') ? 'themes/featured-styles/featured-modern.html' : url.pathname.endsWith('dock.html') ? 'dock.html' : 'featured.html';
            const local = new URL(pathToFileURL(path.join(root, file)));
            local.search = url.search;
            local.searchParams.set('session', room);
            local.searchParams.set('localserver', '');
            local.searchParams.set('localserverport', String(port));
            local.searchParams.set('showtime', '0');
            if (auto) local.searchParams.set('autoshow', '');
            return local.href;
        }
        await dockPage.goto(localUrl(generated.dock));
        await dockPage.waitForFunction(() => socketserver && socketserver.readyState === 1 && socketserverExtension && socketserverExtension.readyState === 1);
        for (const preset of ['', 'themes/featured-styles/featured-modern.html']) {
            await popup.evaluate(preset => applyFeaturedOverlayPreset(preset), preset);
            const url = await popup.evaluate(() => document.getElementById('overlaylink').href);
            assert(new URL(url).searchParams.has('server'));
            await featuredPage.goto(localUrl(url));
            await delay(500);
            const id = preset ? 102 : 101;
            const message = { id, chatname: 'Fixture Viewer', chatmessage: 'Manual fixture ' + id, type: 'youtube', textonly: true };
            deliver(4, message);
            await dockPage.locator('[data-mid="' + id + '"]').waitFor();
            await delay(200);
            assert(!(await featuredPage.locator('body').innerText()).includes(message.chatmessage), 'raw chat must remain hidden');
            await dockPage.locator('[data-mid="' + id + '"]').click();
            await featuredPage.waitForFunction(text => document.body.innerText.includes(text), message.chatmessage);
            if (!preset) await featuredPage.waitForFunction(() => !document.getElementById('output').classList.contains(transitionType));
            await dockPage.locator('#clear_overlay').click();
            if (preset) await featuredPage.waitForFunction(() => !document.querySelector('.message-wrapper'));
            else await featuredPage.waitForFunction(() => document.getElementById('output').classList.contains(transitionType));
            console.log('PASS manual raw-chat exclusion, actual Dock click and clear: ' + (preset || 'classic'));
            await popup.evaluate(() => {
                const input = document.querySelector('input[data-param2="autoshow"]'); input.checked = true; updateSettings(input, true);
            });
            const autoUrl = await popup.evaluate(() => document.getElementById('overlaylink').href);
            assert(!new URL(autoUrl).searchParams.has('server'), 'auto-show keeps captured chat');
            await featuredPage.goto(localUrl(autoUrl, true));
            await delay(500);
            deliver(4, { ...message, id: id + 1000, chatmessage: 'Automatic fixture ' + id });
            await featuredPage.waitForFunction(text => document.body.innerText.includes(text), 'Automatic fixture ' + id);
            await popup.evaluate(() => {
                const input = document.querySelector('input[data-param2="autoshow"]'); input.checked = false; updateSettings(input, true);
            });
            assert(new URL(await popup.evaluate(() => document.getElementById('overlaylink').href)).searchParams.has('server'));
            console.log('PASS explicit auto-show and return to manual: ' + (preset || 'classic'));
        }
        console.log('PASS SSApp generated links and local relay. Isolated profile: ' + output);
    } finally {
        if (app) await app.close();
        for (const socket of relay.clients) socket.terminate();
        await new Promise(resolve => relay.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
