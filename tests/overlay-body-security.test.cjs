// Offline browser coverage for HTML bodies delivered directly to overlays.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver, read } = require('./helpers/chat-security-harness.cjs');
const files = [
    "emotes.html",
    "events.html",
    "sampleemote.html",
    "samplefeatured.html",
    "sampleoverlay.html",
    "septapus.html",
    "themes/Windows3.1/index.html",
    "themes/compact-classic.html",
    "themes/compact-clean.html",
    "themes/compact-glass.html",
    "themes/deuks_overlay/overlay1.html",
    "themes/deuks_overlay/overlay2.html",
    "themes/events/index.html",
    "themes/featured-styles/featured-3d.html",
    "themes/featured-styles/featured-animated.html",
    "themes/featured-styles/featured-cyberpunk.html",
    "themes/featured-styles/featured-dynamic.html",
    "themes/featured-styles/featured-elegant.html",
    "themes/featured-styles/featured-gaming.html",
    "themes/featured-styles/featured-glass.html",
    "themes/featured-styles/featured-gradient.html",
    "themes/featured-styles/featured-modern.html",
    "themes/featured-styles/featured-neon.html",
    "themes/featured-styles/featured-particles.html",
    "themes/featured-styles/featured-retro.html",
    "themes/featured-styles/featured-slide.html",
    "themes/horizontal.html",
    "themes/huan-kiara/index.html",
    "themes/notimeoutmessages.html",
    "themes/overlay-bubbles.html",
    "themes/overlay-cards.html",
    "themes/overlay-comic-classic.html",
    "themes/overlay-comic-pop.html",
    "themes/overlay-credits.html",
    "themes/overlay-danmaku.html",
    "themes/overlay-neon-cyberpunk.html",
    "themes/overlay-particles.html",
    "themes/overlay-ticker-news.html",
    "themes/overlay-typewriter.html",
    "themes/overlay-xacception.html",
    "themes/rainbowpuke/index.html",
    "themes/sampleoverlay_reverse.html",
    "themes/spiritoverlay.html",
    "themes/t3nk3y/index.html"
];
const bodyCheck = /\(window\.SocialStreamChatHTML \? SocialStreamChatHTML\.sanitize\(((?:data|content)\.chatmessage(?: \|\| '')?|display\.message \|\| '')\) : fallbackEscapeHtml\(\1\)\)/g;
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const glyphs = '\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}';
const probe = '<img src="' + pixel + '" alt="body-probe" onload="window.__bodyHits++">';
const rich = 'BODY_AUDIT_RICH <i style="color:red">reply</i> <b>AUDIT_BOLD</b> &amp; ' + glyphs +
    ' <span class="emote-container" style="position:relative;display:inline-block">' +
    '<img src="' + pixel + '" alt="body-wave" width="28" height="28">' +
    '<img src="' + pixel + '" alt="body-overlay" style="position:absolute;left:50%;transform:translateX(-50%)"></span>' +
    ' <svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>';
const plain = 'BODY_AUDIT_LITERAL <b>literal</b> &amp; &#128512; ' + glyphs;
const filter = process.env.SSN_BODY_FILTER || '';

(async () => {
    const server = await createStaticServer();
    let browser, id = 791000, passed = 0;
    const failures = [];
    try {
        browser = await chromium.launch({ headless: true });
        const queue = files.filter(file => !filter || file.includes(filter));
        assert.ok(queue.length, 'At least one receiver selected');
        async function check(file) {
            const context = await browser.newContext();
            await configureContext(context, server.baseUrl);
            const walls = ['emotes.html', 'sampleemote.html'].includes(file);
            const errors = [];
            try {
                const source = read(file);
                const unsafe = source.replace(bodyCheck, '($1)');
                assert.notEqual(unsafe, source, 'Locate the new body check: ' + file);
                async function open(control, missing) {
                    const page = await context.newPage();
                    page.setDefaultTimeout(10000);
                    page.on('pageerror', error => errors.push(error.message));
                    await page.addInitScript(() => { window.__bodyHits = 0; });
                    if (control) {
                        await page.route('**/' + file + '*', route => route.fulfill({ contentType: 'text/html', body: unsafe }));
                    }
                    if (missing) await page.route('**/' + missing, route => route.abort());
                    await page.goto(server.baseUrl + '/' + file + '?session=BODY_SECURITY_OFFLINE&showtime=60000&persistent', { waitUntil: 'domcontentloaded' });
                    await page.evaluate(() => {
                        window.__bodyChecks = [];
                        if (window.SocialStreamChatHTML) {
                            const sanitize = SocialStreamChatHTML.sanitize;
                            SocialStreamChatHTML.sanitize = value => {
                                if (String(value).includes('BODY_AUDIT_')) window.__bodyChecks.push(value);
                                return sanitize(value);
                            };
                        }
                        if (typeof TYPE_SPEED !== 'undefined') { TYPE_SPEED = 0; Math.random = () => 0; }
                    });
                    return page;
                }
                async function send(page, body, mode) {
                    await page.evaluate(() => { window.__bodyHits = 0; window.__bodyChecks = []; });
                    const data = { id: ++id, type: 'twitch', chatname: 'AuditViewer', chatmessage: body, chatbadges: [], hasDonation: file.includes('deuks_overlay') ? '' : '$5', donoValue: 5 };
                    const marker = file.includes('featured-') ? ' BODY_DELIVERY_' + id : '';
                    data.chatmessage += marker;
                    if (mode !== undefined) data.textonly = mode;
                    await deliver(page, data);
                    if (marker) await page.waitForFunction(value => document.body.textContent.includes(value), marker);
                    await page.waitForTimeout(150);
                    if (file.includes('typewriter')) await page.waitForFunction(() => !document.querySelector('.text.typing'));
                    assert.deepEqual(errors, [], file + ': browser errors');
                    const result = await page.evaluate(() => ({
                        hits: window.__bodyHits, calls: window.__bodyChecks.length,
                        text: document.body.textContent, probes: document.querySelectorAll('img[alt="body-probe"]').length,
                        glyphs: Array.from(document.querySelectorAll('.emoji,.emote')).map(el => el.textContent),
                        literal: Array.from(document.querySelectorAll('.text,.hl-message,#message,.event-message')).map(el => el.textContent).filter(text => text.includes('BODY_AUDIT_LITERAL')),
                        presentation: {
                            bold: Array.from(document.querySelectorAll('b')).filter(el => el.textContent === 'AUDIT_BOLD').map(el => el.textContent),
                            italics: Array.from(document.querySelectorAll('i')).filter(el => el.textContent === 'reply').map(el => el.style.color),
                            emotes: Array.from(document.querySelectorAll('img[alt="body-wave"],img[alt="body-overlay"]')).map(el => ({
                                alt: el.alt, src: el.getAttribute('src'), width: el.getAttribute('width'), height: el.getAttribute('height'),
                                position: el.style.position, transform: el.style.transform,
                                wrapperPosition: el.parentNode.style.position
                            })),
                            paths: document.querySelectorAll('svg path[d="M0 0L10 10"]').length
                        }
                    }));
                    result.text = result.text.replace(/ BODY_DELIVERY_\d+/g, '');
                    result.literal = result.literal.map(text => text.replace(/ BODY_DELIVERY_\d+/g, ''));
                    return result;
                }
                const before = await open(true), after = await open(false);
                for (const mode of [false, undefined]) {
                    const original = await send(before, 'BODY_AUDIT_ATTACK ' + probe, mode);
                    const fixed = await send(after, 'BODY_AUDIT_ATTACK ' + probe, mode);
                    assert.ok(original.hits > 0, 'Positive control must execute, mode=' + mode);
                    assert.equal(fixed.hits, 0);
                    assert.ok(fixed.probes > 0, 'Keep the emote after removing its handler');
                    assert.ok(fixed.calls > 0, 'Check the HTML body at display time');
                    passed++;

                    const originalRich = await send(before, rich, mode), fixedRich = await send(after, rich, mode);
                    assert.deepEqual(fixedRich.presentation, originalRich.presentation, 'Formatting, images, SVG and stacking');
                    assert.deepEqual(fixedRich.glyphs, originalRich.glyphs, 'Complete Unicode emoji and flags');
                    assert.ok(fixedRich.presentation.emotes.length > 0, 'Rich emotes must render');
                    if (!walls) assert.ok(fixedRich.presentation.bold.length > 0, 'Rich text must render');
                    passed++;
                }
                const originalPlain = await send(before, plain, true), fixedPlain = await send(after, plain, true);
                assert.equal(fixedPlain.hits, 0);
                assert.equal(fixedPlain.calls, 0, 'Plain bodies bypass the HTML sanitizer');
                assert.deepEqual(fixedPlain.literal, originalPlain.literal, 'Existing text-only output');
                assert.deepEqual(fixedPlain.glyphs, originalPlain.glyphs, 'Plain emoji extraction');
                if (!walls) assert.ok(fixedPlain.text.includes('BODY_AUDIT_LITERAL'));
                passed++;

                const missingHelper = await open(false, 'shared/utils/chatHtml.js');
                const fallback = await send(missingHelper, 'BODY_AUDIT_FALLBACK ' + probe + ' ' + glyphs, false);
                assert.equal(fallback.hits, 0);
                assert.equal(fallback.probes, 0, 'Missing helper must not parse images');
                if (!walls) assert.ok(fallback.text.includes('BODY_AUDIT_FALLBACK ' + probe), 'Fallback retains literal content');
                passed++;
                console.log('PASS ' + file);
            } catch (error) {
                failures.push(file + ': ' + error.message);
                console.error('FAIL ' + file + ': ' + error.message);
            } finally { await context.close(); }
        }
        await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await check(queue.shift()); }));
        console.log(passed + ' body security/display checks passed; ' + failures.length + ' failed receivers');
        assert.deepEqual(failures, []);
    } finally {
        if (browser) await browser.close();
        await closeServer(server.server);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
