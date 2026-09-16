'use strict';

// Local layout fixtures only: no accounts, OAuth, channels, or external requests.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const sources = ['kick', 'twitch', 'youtube', 'rumble', 'facebook', 'joystick', 'vpzone', 'velora', 'bilibili', 'irc', 'nostr', 'stageten', 'socialstreamchat', 'streamlabs'];

async function checkYouTubeStreaming() {
    const html = fs.readFileSync(path.join(root, 'sources/websocket/youtube.html'), 'utf8');
    const start = html.indexOf('async function readLiveChatStream(');
    const end = html.indexOf('async function startLiveChatStream(', start);
    for (const mode of ['empty', 'error', 'stale']) {
        const attributes = {};
        const controller = { signal: { aborted: false } };
        const context = vm.createContext({
            TextDecoder,
            document: { getElementById: () => ({ setAttribute: (key, value) => { attributes[key] = value; } }) },
            buildLiveChatStreamUrl: () => 'local-fixture',
            fetch: async () => ({ ok: mode !== 'error', body: { getReader: () => ({ read: async () => ({ done: true }) }) } }),
            buildLiveChatStreamHttpError: async () => new Error('fixture failure'),
            liveChatStreamAbortController: mode === 'stale' ? {} : controller,
            liveChatStreamStopping: true, liveChatStreamActive: true, liveChatStreamReadBuffer: '',
            processLiveChatStreamBuffer: async () => {}
        });
        vm.runInContext(html.slice(start, end), context);
        await context.readLiveChatStream(controller, 'fixture-token');
        assert.equal(attributes['data-connected'], mode === 'empty' ? 'true' : undefined,
            `YouTube ${mode}: only a successful current stream opens chat, even without messages`);
    }
}

async function connection(page, source, connected) {
    await page.evaluate(({ source, connected }) => {
        const q = selector => document.querySelector(selector);
        const chip = (selector, className) => q(selector).classList.toggle(className, connected);
        if (source === 'kick') window.__compactKickTest(connected);
        else if (source === 'twitch') q('#sendmessage').dataset.chatConnected = String(connected);
        else if (source === 'youtube') q('#textarea').dataset.connected = String(connected);
        else if (source === 'facebook') q('#chat-feed').dataset.connected = String(connected);
        else if (['rumble', 'joystick', 'vpzone'].includes(source)) chip('#socket-chip', 'good');
        else if (source === 'velora') chip('#socket-state', 'connected');
        else if (source === 'bilibili') q('#disconnectBtn').disabled = !connected;
        else if (source === 'irc') q('#status').dataset.connected = String(connected);
        else if (source === 'nostr') {
            q('#streamInfo').classList.toggle('hidden', !connected);
            q('#relayStatus').innerHTML = connected ? '<span class="relay-badge connected">Local fixture</span>' : '';
        } else if (source === 'stageten') chip('#channel-status', 'status-connected');
        else if (source === 'socialstreamchat') chip('#room-status', 'status-connected');
        else if (source === 'streamlabs') chip('#connection-chip', 'connected');
    }, { source, connected });
}

(async () => {
    await checkYouTubeStreaming();
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + pathname);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404).end(); return;
        }
        let body = fs.readFileSync(file);
        const ext = path.extname(file);
        if (ext === '.html') {
            // Isolate layout from provider startup; keep the real page and styles.
            body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag =>
                /(?:compactSourceLayout|kick-layout)\.js/.test(tag) ? tag : '');
        }
        res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css' : 'application/javascript' });
        res.end(body);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'websocket-compact-review-'));
    const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
    try {
        for (const source of sources) {
            const page = await browser.newPage({ viewport: { width: 360, height: 650 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
            await page.goto(`${origin}/sources/websocket/${source}.html`);
            if (source === 'kick') {
                await page.evaluate(() => { window.__kickWsBootstrapped = true; });
                await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'sources/websocket/kick.js'), 'utf8') });
                await page.evaluate(() => {
                    applyKickCoreFallbacks();
                    initElements();
                    window.__compactKickTest = connected => {
                        state.socket.pusherStatus = connected ? 'connected' : 'disconnected';
                        updateCompactChatState();
                    };
                    state.tokens = { access_token: 'fixture-token' };
                    state.bridge.status = 'connected';
                    state.bridge.chatDisabled = true;
                    updateCompactChatState();
                    if (document.getElementById('socket-state').getAttribute('data-connected') !== 'false') {
                        throw new Error('OAuth and an alerts-only bridge must not dismiss setup');
                    }
                    state.bridge.status = 'disconnected';
                });
            }
            const menu = page.locator(source === 'kick' ? '#compact-menu-toggle' : '.ss-compact-toolbar button');
            const feed = page.locator(source === 'kick' ? '#chat-feed' : '.ss-chat-feed');
            await menu.waitFor({ state: 'visible' });
            assert.equal(await menu.getAttribute('aria-expanded'), 'true', `${source}: initial setup`);
            assert.equal(await feed.isVisible(), false, `${source}: setup hides feed`);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${source}: setup has no horizontal overflow`);
            // Failed initial connection must leave setup available.
            await connection(page, source, false);
            assert.equal(await menu.getAttribute('aria-expanded'), 'true', `${source}: initial failure`);
            await page.screenshot({ path: path.join(output, `${source}-setup.png`) });
            await page.evaluate(() => {
                const auth = document.querySelector('.auth');
                if (auth) auth.classList.add('hidden');
                document.querySelectorAll('.socket').forEach(node => node.classList.remove('hidden'));
                const dashboard = document.querySelector('#dashboard');
                if (dashboard) dashboard.hidden = false;
            });
            // Authorizing alone must not dismiss the setup form.
            assert.equal(await menu.getAttribute('aria-expanded'), 'true', `${source}: authorization alone`);
            await connection(page, source, true);
            await feed.waitFor({ state: 'visible' });
            assert.equal(await menu.getAttribute('aria-expanded'), 'false', `${source}: first connection closes setup`);
            await feed.evaluate(node => {
                node.innerHTML = '';
                for (let i = 0; i < 12; i++) {
                    const row = document.createElement('div');
                    row.style.padding = '8px';
                    row.innerHTML = '<strong>Sample viewer ' + (i + 1) + '</strong><br>A chat preview with a longer message to check wrapping.';
                    node.appendChild(row);
                }
            });
            for (const width of [580, 360, 320]) {
                await page.setViewportSize({ width, height: width === 320 ? 420 : 650 });
                const metrics = await feed.evaluate(node => ({
                    width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
                    scrollHeight: document.documentElement.scrollHeight, feed: node.getBoundingClientRect().toJSON()
                }));
                if (metrics.scrollWidth > metrics.width) console.log(await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(node => node.getBoundingClientRect().right > innerWidth).map(node => ({ tag: node.tagName, id: node.id, class: node.className, right: node.getBoundingClientRect().right }))));
                assert(metrics.scrollWidth <= metrics.width, `${source}: horizontal overflow ${JSON.stringify(metrics)}`);
                assert(metrics.scrollHeight <= metrics.height + 1, `${source}: page overflow ${JSON.stringify(metrics)}`);
                if (metrics.feed.height < metrics.height - 240) console.log(await page.locator('.ss-chat-path, .ss-chat-compose').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, class: node.className, height: node.getBoundingClientRect().height, flex: getComputedStyle(node).flex }))));
                assert(metrics.feed.height >= metrics.height - 240, `${source}: feed too short ${JSON.stringify(metrics)}`);
                await page.screenshot({ path: path.join(output, `${source}-${width}.png`) });
            }
            await page.setViewportSize({ width: 360, height: 650 });
            await page.emulateMedia({ colorScheme: 'dark' });
            await page.screenshot({ path: path.join(output, `${source}-dark.png`) });
            await connection(page, source, false);
            assert.equal(await menu.getAttribute('aria-expanded'), 'false', `${source}: disconnect keeps chat`);
            await menu.click();
            await connection(page, source, true);
            assert.equal(await menu.getAttribute('aria-expanded'), 'true', `${source}: reconnect respects open menu`);
            await page.keyboard.press('Escape');
            assert.equal(await menu.getAttribute('aria-expanded'), 'false', `${source}: Escape closes setup`);
            assert(await menu.evaluate(node => node === document.activeElement), `${source}: Escape focus`);
            for (const width of [581, 1280]) {
                await page.setViewportSize({ width, height: 900 });
                await menu.waitFor({ state: 'hidden' });
                assert(await feed.isVisible(), `${source}: desktop feed`);
                await page.screenshot({ path: path.join(output, `${source}-${width}.png`) });
            }
            await page.setViewportSize({ width: 360, height: 650 });
            await menu.waitFor({ state: 'visible' });
            assert.equal(await menu.getAttribute('aria-expanded'), 'false', `${source}: resize preserves chat`);
            if (['twitch', 'youtube', 'stageten', 'socialstreamchat', 'velora'].includes(source)) {
                await connection(page, source, false);
                await page.evaluate(() => {
                    const auth = document.querySelector('.auth');
                    if (auth) auth.classList.remove('hidden');
                    document.querySelectorAll('.socket').forEach(node => node.classList.add('hidden'));
                    const dashboard = document.querySelector('#dashboard');
                    if (dashboard) dashboard.hidden = true;
                });
                await page.waitForFunction(() => document.body.classList.contains('ss-setup-open'));
                assert.equal(await menu.getAttribute('aria-expanded'), 'true', `${source}: sign-out exposes setup`);
            }
            assert.deepStrictEqual(errors, [], `${source}: browser errors`);
            if (source === 'kick') {
                await page.reload();
                await page.evaluate(() => { document.getElementById('socket-state').className = 'status-chip'; });
                await feed.waitFor({ state: 'visible' });
                assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Older Kick capture scripts also dismiss setup');
            }
            await page.close();
            console.log(`${source}: compact layout and setup lifecycle passed`);
        }
        console.log('Visual review screenshots:', output);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
