// Offline delivery through the production Multi-alerts iframe/WebSocket listeners.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, read } = require('./helpers/chat-security-harness.cjs');

const probe = '<img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const emoji = '\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}';
const rich = 'CHECK_MARKER <i style="color:red">reply &amp; context</i> <b>bold</b> ' +
    '<span class="emote-container" style="position:relative;display:inline-block">' +
    '<img alt="wave" width="28" height="28" src="' + pixel + '">' +
    '<img alt="overlay" style="position:absolute;left:50%;transform:translateX(-50%)" src="' + pixel + '"></span> ' +
    '<a href="https://example.invalid/clip?a=1&amp;b=2">link</a> <svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg> ' + emoji;

// Disable only the new check in an isolated positive control; never edit files.
const source = read('multi-alerts.js');
const needle = 'message.innerHTML = SocialStreamChatHTML.sanitize(model.bodyText);';
assert.equal(source.split(needle).length, 2, 'Locate the production display check');
const unsafe = source.replace(needle, 'message.innerHTML = model.bodyText;');

(async () => {
    const server = await createStaticServer();
    let browser, id = 0, checks = 0;
    try {
        browser = await chromium.launch({ headless: true });
        async function render(mode, body, options = {}) {
            const context = await browser.newContext();
            await configureContext(context, server.baseUrl);
            if (options.control) {
                await context.route('**/multi-alerts.js', route => route.fulfill({ contentType: 'text/javascript', body: unsafe }));
            }
            if (options.missing) {
                await context.route('**/' + options.missing, route => route.abort());
            }
            try {
                const page = await context.newPage();
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.goto(server.baseUrl + '/multi-alerts.html?session=LOCAL_SECURITY_CHECK' + (options.websocket ? '&server' : '') + (options.auction ? '&auctionwins' : ''));
                await page.evaluate(() => {
                    window.__displayChecks = 0;
                    if (window.SocialStreamChatHTML) {
                        const sanitize = SocialStreamChatHTML.sanitize;
                        SocialStreamChatHTML.sanitize = value => { window.__displayChecks++; return sanitize(value); };
                    }
                });
                const payload = { id: ++id, type: 'twitch', event: 'subscription', membership: 'Subscriber', chatname: 'Viewer', chatmessage: body };
                if (mode !== undefined) payload.textonly = mode;
                if (options.auction) {
                    Object.assign(payload, { type: 'whatnot', event: 'auction_update', chatmessage: '', meta: { title: body, status: 'won', winner: 'Viewer', priceText: '$5' } });
                }
                if (options.websocket) {
                    // The control bridge opens a second socket to the same URL.
                    // Deliver to the alert feed's actual production receiver.
                    await page.waitForFunction(() => state.socket && typeof state.socket.onmessage === 'function');
                    await page.evaluate(payload => state.socket.deliver(payload), payload);
                } else {
                    await deliver(page, payload);
                }
                await page.locator('.alert-message').waitFor();
                await page.waitForTimeout(150);
                assert.deepEqual(errors, [], 'No page errors');
                return await page.locator('.alert-message').evaluate(el => ({
                    hit: window.__securityExecuted, calls: window.__displayChecks,
                    text: el.textContent, html: el.innerHTML,
                    bold: el.querySelector('b')?.textContent, italic: el.querySelector('i')?.style.color,
                    images: el.querySelectorAll('img').length, width: el.querySelector('img[alt="wave"]')?.width,
                    wrapper: el.querySelector('.emote-container')?.style.position,
                    overlay: el.querySelector('img[alt="overlay"]')?.style.transform,
                    link: el.querySelector('a')?.getAttribute('href'), paths: el.querySelectorAll('svg path').length
                }));
            } finally { await context.close(); }
        }

        for (const mode of [false, undefined]) {
            for (const websocket of [false, true]) {
                const before = await render(mode, 'CHECK_MARKER ' + probe, { control: true, websocket });
                const after = await render(mode, 'CHECK_MARKER ' + probe, { websocket });
                assert.equal(before.hit, true, 'Positive control must execute');
                assert.equal(after.hit, false);
                assert.ok(after.text.includes('CHECK_MARKER'));
                assert.equal(after.calls, 1);
                checks++;
            }
            const before = await render(mode, rich, { control: true }), after = await render(mode, rich);
            assert.equal(after.calls, 1);
            delete before.html; delete after.html; delete before.calls; delete after.calls;
            assert.deepEqual(after, before, 'Supported formatting and emote presentation');
            checks++;
        }

        const plain = 'CHECK_MARKER <b>literal</b> &amp; &#128512; ' + probe + ' ' + emoji;
        for (const options of [{}, { auction: true }]) {
            const result = await render(true, plain, options);
            assert.equal(result.text, plain);
            assert.equal(result.images, 0);
            assert.equal(result.hit, false);
            assert.equal(result.calls, 0, 'Literal bodies must bypass the HTML sanitizer');
            checks++;
        }
        for (const missing of ['shared/utils/chatHtml.js', 'libs/objects.js']) {
            const result = await render(false, 'CHECK_MARKER ' + probe, { missing });
            assert.equal(result.text, 'CHECK_MARKER ' + probe);
            assert.equal(result.hit, false);
            checks++;
        }
        const unsupported = await render(false, 'CHECK_MARKER <marquee>custom scrolling</marquee>');
        assert.ok(!unsupported.html.includes('<marquee'));
        assert.ok(unsupported.text.includes('custom scrolling'));
        checks++;
        console.log('PASS ' + checks + ' Multi-alerts security and display cases');
    } finally {
        if (browser) await browser.close();
        await closeServer(server.server);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
