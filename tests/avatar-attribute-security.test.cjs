const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver } = require('./helpers/chat-security-harness.cjs');
const { routePositiveControl } = require('./helpers/name-security-controls.cjs');
const files = [
    'sampleoverlay.html', 'samplefeatured.html', 'septapus.html', 'bot.html', 'waitlist.html', 'chathistory.html',
    'themes/Windows3.1/index.html', 'themes/compact-clean.html', 'themes/deuks_overlay/overlay1.html',
    'themes/huan-kiara/index.html', 'themes/horizontal.html', 'themes/notimeoutmessages.html',
    'themes/overlay-bubbles.html', 'themes/overlay-cards.html', 'themes/overlay-comic-classic.html',
    'themes/overlay-comic-pop.html', 'themes/overlay-credits.html', 'themes/overlay-danmaku.html',
    'themes/overlay-neon-cyberpunk.html', 'themes/overlay-particles.html', 'themes/overlay-xacception.html',
    'themes/rainbowpuke/index.html', 'themes/sampleoverlay_reverse.html', 'themes/spiritoverlay.html', 'themes/t3nk3y/index.html'
];
const attacks = [
    'x\"\'><img src="data:image/png;base64,broken" onerror="window.__nameHits++"><span x="',
    'x" onmouseover=window.__nameHits++ x="', "x' onfocus=window.__nameHits++ x='"
];
const urls = ['https://avatars.invalid/a.png', 'https://avatars.invalid/a.png?one=1&two=2', './media/user1.jpg'];
(async () => {
    const server = await createStaticServer(); let browser, id = 372000;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext(); await configureContext(context, server.baseUrl);
        await context.route('https://avatars.invalid/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }));
        async function open(file, control) {
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => { window.__nameHits = 0; });
            if (control) await routePositiveControl(page, file);
            await page.goto(server.baseUrl + '/' + file + '?session=AVATAR_CHECK&ssappSnapshot=1', { waitUntil: 'domcontentloaded' });
            return { page, file, errors };
        }
        async function send(target, chatimg, extra = {}) {
            const { page, file } = target;
            await page.evaluate(() => { window.__nameHits = 0; });
            const data = { id: ++id, type: 'youtube', chatname: 'AvatarCheck', chatimg, chatmessage: 'AvatarTest', textonly: true, timestamp: Date.now(), ...extra };
            if (file === 'chathistory.html') {
                await page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { source: window, data: {
                    type: 'ssapp-chat-history-snapshot', snapshot: { messages: [data] }
                } })), data);
            } else await deliver(page, file === 'waitlist.html' ? { waitlist: [data] } : data);
            await page.waitForTimeout(file === 'bot.html' ? 550 : 70);
            return page.evaluate(() => {
                document.querySelectorAll('[onmouseover],[onfocus]').forEach(el => {
                    el.dispatchEvent(new Event('mouseover')); el.dispatchEvent(new Event('focus'));
                });
                return { hits: window.__nameHits, avatars: Array.from(document.querySelectorAll('.avatar, .hl-profile-pic, #author-photo, .guestListHolder > img')).map(el => ({ src: el.getAttribute('src'), background: el.style.backgroundImage })) };
            });
        }
        for (const file of files) {
            // Fresh pages keep a successful positive-control handler from firing
            // again during compatibility checks on retained overlay rows.
            let reproduced = false;
            for (const attack of attacks) {
                const old = await open(file, true), fixed = await open(file, false);
                reproduced = (await send(old, attack)).hits > 0 || reproduced;
                assert.equal((await send(fixed, attack)).hits, 0, file + ': attribute injection');
                assert.deepEqual(fixed.errors, [], file + ': page errors');
                await old.page.close(); await fixed.page.close();
            }
            assert.ok(reproduced, file + ': positive control must execute');
            const old = await open(file, true), fixed = await open(file, false);
            for (const url of urls) {
                const before = await send(old, url), after = await send(fixed, url);
                assert.ok(after.avatars.length, file + ': exercised avatar branch');
                assert.deepEqual(after, before, file + ': avatar URL ' + url);
            }
            if (file === 'bot.html' || file === 'samplefeatured.html') {
                for (const field of ['backupChatimg', 'id']) {
                    assert.ok((await send(old, urls[0], { [field]: attacks[0] })).hits, file + ': ' + field + ' control');
                    assert.equal((await send(fixed, urls[0], { [field]: attacks[0] })).hits, 0, file + ': ' + field);
                }
            }
            if (file === 'samplefeatured.html') {
                await fixed.page.route('https://api.socialstream.ninja/twitch/large*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }));
                const data = { id: 'avatar-"-&amp;-lookup', chatname: 'A &amp; B', type: 'twitch' };
                await send(fixed, '', data);
                await fixed.page.waitForFunction(data => {
                    const avatar = document.getElementById('img_' + data.id);
                    return avatar && avatar.src === 'https://api.socialstream.ninja/twitch/large?username=' + encodeURIComponent(data.chatname);
                }, data);
            }
            await old.page.close(); await fixed.page.close(); console.log('PASS avatar attributes: ' + file);
        }
    } finally { if (browser) await browser.close(); await closeServer(server.server); }
})().catch(error => { console.error(error); process.exitCode = 1; });
