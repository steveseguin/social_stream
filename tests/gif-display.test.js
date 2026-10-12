const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
let videoFixture;
const requests = [];
const pending = new Map();

function serveImage(req, res) {
    const name = new URL(req.url, 'http://fixture').pathname;
    requests.push({ name, mode: req.headers['sec-fetch-mode'] });
    if (name.includes('stall') || name.includes('deferred')) return;
    if (name === '/clip.webm') { res.setHeader('Content-Type', 'video/webm'); res.end(videoFixture); return; }
    if (name === '/sound.wav') { res.setHeader('Content-Type', 'audio/wav'); res.end(fs.readFileSync(path.join(root, 'audio/alerts/pop.wav'))); return; }
    if (name.includes('delayed')) {
        pending.set(name, () => { res.writeHead(200, { 'Content-Type': 'image/gif' }); res.end(gif); });
        return;
    }
    if (name.includes('allowed')) res.setHeader('Access-Control-Allow-Origin', '*');
    if (name.includes('missing')) { res.writeHead(404); res.end('Missing'); return; }
    res.setHeader('Content-Type', 'image/gif');
    res.end(name.includes('invalid') ? 'Not a GIF' : gif);
}

const assets = http.createServer(serveImage);
const site = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://fixture').pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    fs.createReadStream(file).pipe(res);
});

function listen(server) {
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
}

(async () => {
    const siteUrl = await listen(site);
    const assetUrl = await listen(assets);
    let browser;
    try {
        browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
        const context = await browser.newContext();
        context.setDefaultTimeout(5000);
        await context.route(/^https?:/, route => {
            const url = new URL(route.request().url());
            if (url.hostname === '127.0.0.1') return route.continue();
            if (url.hostname === 'vdo.socialstream.ninja') return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
            return route.abort();
        });

        const page = await context.newPage();
        await page.addInitScript(() => {
            // Exercise the actual timeout paths without waiting ten seconds per fixture.
            const timeout = window.setTimeout;
            window.setTimeout = function (fn, delay, ...args) {
                return timeout(fn, delay === 10000 ? 800 : delay === 4000 ? 250 : delay, ...args);
            };
            window.shownMedia = [];
            window.createdBlobs = 0;
            window.revokedBlobs = 0;
            const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
            URL.createObjectURL = blob => { window.createdBlobs++; return create(blob); };
            URL.revokeObjectURL = url => { window.revokedBlobs++; revoke(url); };
            document.addEventListener('DOMContentLoaded', () => {
                new MutationObserver(() => {
                    const container = document.getElementById('mediaContainer');
                    if (container.style.opacity === '1') window.shownMedia.push(container.querySelector('img,video').getAttribute('src'));
                }).observe(document.getElementById('mediaContainer'), { attributes: true, attributeFilter: ['style'] });
            });
        });
        await page.goto(siteUrl + '/gif.html?showtime=150&muted');
        await page.evaluate(base => {
            processData({ contentimg: base + '/cors.gif' });
            processData({ contentimg: base + '/allowed.gif' });
        }, assetUrl);
        await page.waitForFunction(() => shownMedia.length >= 2 && !isPlaying);
        const initial = await page.evaluate(() => ({ shown: shownMedia, created: createdBlobs, revoked: revokedBlobs }));
        assert.equal(initial.shown[0], assetUrl + '/cors.gif', 'CORS denial must fall back to ordinary image display');
        assert.ok(initial.shown[1].startsWith('blob:'), 'CORS-enabled images should retain byte/duration analysis');
        assert.deepEqual(requests.filter(r => r.name === '/cors.gif').map(r => r.mode), ['cors', 'no-cors']);
        assert.equal(initial.created, initial.revoked, 'Object URLs must be released after playback');

        await page.evaluate(base => {
            shownMedia.length = 0;
            processData({ contentimg: base + '/missing.gif' });
            processData({ contentimg: base + '/invalid-allowed.gif' });
            processData({ contentimg: base + '/stall.gif' });
            processData({ contentimg: base + '/after-failures.gif' });
        }, assetUrl);
        await page.waitForFunction(() => shownMedia.length === 1 && !isPlaying);
        assert.deepEqual(await page.evaluate(() => shownMedia), [assetUrl + '/after-failures.gif'], 'Failures and timeouts must advance without displaying broken images');
        assert.equal(await page.locator('#mediaContainer').evaluate(el => el.style.opacity), '0');

        // A late fetch that ignores abort must not replace a newer queue item.
        await page.evaluate(base => {
            shownMedia.length = 0;
            const fetchOriginal = window.fetch;
            window.fetch = (url, options) => String(url).includes('/deferred.gif') ? new Promise(resolve => {
                window.releaseLateFetch = () => resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/gif' } }));
            }) : fetchOriginal(url, options);
            processData({ contentimg: base + '/deferred.gif' });
            processData({ contentimg: base + '/current.gif' });
        }, assetUrl);
        await page.waitForFunction(() => shownMedia.length === 1 && !isPlaying);
        const countBefore = await page.evaluate(() => createdBlobs);
        await page.evaluate(async () => { releaseLateFetch(); await Promise.resolve(); await Promise.resolve(); });
        assert.equal(await page.evaluate(() => createdBlobs), countBefore, 'Late fetch results must be discarded');
        assert.deepEqual(await page.evaluate(() => shownMedia), [assetUrl + '/current.gif']);

        videoFixture = Buffer.from(await page.evaluate(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 16;
            const stream = canvas.captureStream(10);
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            const chunks = [];
            recorder.ondataavailable = event => chunks.push(event.data);
            const completed = new Promise(resolve => { recorder.onstop = resolve; });
            recorder.start();
            canvas.getContext('2d').fillRect(0, 0, 16, 16);
            await new Promise(resolve => setTimeout(resolve, 200));
            recorder.stop();
            await completed;
            stream.getTracks().forEach(track => track.stop());
            return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
        }));
        await page.evaluate(base => {
            shownMedia.length = 0;
            window.videoEvents = [];
            const createElement = document.createElement.bind(document);
            document.createElement = function (tag, options) {
                const element = createElement(tag, options);
                if (tag === 'video') for (const event of ['loadedmetadata', 'canplay', 'playing', 'error']) {
                    element.addEventListener(event, () => videoEvents.push({ event, src: element.getAttribute('src'), error: element.error && element.error.message, duration: element.duration }));
                }
                return element;
            };
            for (const file of ['clip.webm', 'missing-video.mp4', 'stall-video.mp4', 'sound.wav', 'stall-audio.wav', 'after-media.gif']) {
                processData({ contentimg: base + '/' + file });
            }
        }, assetUrl);
        await page.waitForFunction(() => shownMedia.length === 3 && !isPlaying).catch(async error => {
            console.error(await page.evaluate(() => ({ shownMedia, isPlaying, mediaQueue, videoEvents, content: mediaContainer.innerHTML })));
            throw error;
        });
        assert.deepEqual(await page.evaluate(() => shownMedia), [assetUrl + '/clip.webm', null, assetUrl + '/after-media.gif'], 'Video/audio completion and load failures must also advance the queue');
        await page.close();

        for (const surface of ['dock', 'featured']) {
            const display = await context.newPage();
            await display.addInitScript(() => {
                const timeout = window.setTimeout;
                window.setTimeout = function (fn, delay, ...args) { return timeout(fn, delay === 10000 ? 500 : delay, ...args); };
                document.addEventListener('DOMContentLoaded', () => document.body.classList.add('OBS'));
            });
            await display.goto(siteUrl + '/' + surface + '.html?session=local-gif-test');
            await display.locator('iframe').first().waitFor({ state: 'attached' });
            const frame = display.locator('iframe').first().contentFrame();
            const send = async (id, filename, hide, html) => {
                const url = assetUrl + '/' + filename;
                await frame.locator('body').waitFor({ state: 'attached' });
                await frame.locator('body').evaluate((_, data) => parent.postMessage({ dataReceived: { overlayNinja: data } }, '*'), {
                    id, type: 'youtube', chatname: 'Viewer_' + id, contentimg: url,
                    chatmessage: html ? 'Keep <b>this</b> <a href="' + url + '">GIF</a> and https://example.com/other.gif' : 'Keep this ' + url + ' and https://example.com/other.gif',
                    textonly: !html, meta: hide ? { hideExternalGifUrl: true } : {}
                });
                const message = surface === 'dock' ? display.locator('#content_' + id) : display.locator('#message');
                await message.waitFor({ state: 'attached' });
                if (surface === 'featured') await display.locator('#nameDIV').filter({ hasText: 'Viewer_' + id }).waitFor({ state: 'attached' });
                const container = surface === 'dock' ? display.locator('#msg_' + id) : display.locator('#newmessage');
                return { url, message, container, image: container.locator('.hl-imgContent img'), attachment: container.locator('.hl-imgContent') };
            };

            let item = await send('default', 'normal.gif?filename=clip.mp4', false, false);
            await item.image.waitFor({ state: 'visible' });
            assert.ok((await item.message.textContent()).includes(item.url), surface + ': hiding must be off by default');

            item = await send('delayed', surface + '-delayed.gif', true, true);
            await item.image.waitFor({ state: 'attached' });
            assert.equal(await item.image.isVisible(), false, surface + ': image remains hidden while loading');
            assert.equal(await item.message.locator('a').count(), 1, surface + ': link remains before image success');
            const releaseKey = '/' + surface + '-delayed.gif';
            const deadline = Date.now() + 3000;
            while (!pending.has(releaseKey) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
            assert.ok(pending.has(releaseKey), 'Delayed image request must reach the fixture');
            pending.get(releaseKey)();
            await item.image.waitFor({ state: 'visible' });
            assert.equal(await item.message.locator('a').count(), 0, surface + ': matching link is hidden after success');
            assert.equal(await item.message.locator('b').textContent(), 'this');
            assert.ok((await item.message.textContent()).includes('https://example.com/other.gif'));

            item = await send('plain', 'plain.gif', true, false);
            await item.image.waitFor({ state: 'visible' });
            assert.equal((await item.message.textContent()).includes(item.url), false, surface + ': plain-text link hidden after success');
            assert.ok((await item.message.textContent()).includes('Keep this'));

            for (const filename of ['missing.gif', 'invalid.gif', 'stall.gif']) {
                item = await send(filename.split('.')[0], filename, true, false);
                // Failure cleanup removes src only after error/timeout, not while still loading.
                await display.waitForTimeout(filename === 'stall.gif' ? 650 : 150);
                assert.equal(await item.image.getAttribute('src'), null, surface + ': failure cleanup for ' + filename);
                assert.equal(await item.attachment.isVisible(), false, surface + ': entire failed attachment collapses');
                assert.ok((await item.message.textContent()).includes(item.url), surface + ': failed image keeps its link');
            }
            await display.close();
        }
        console.log('PASS: CORS fallback, timeout/late-result queue handling, and real dock/featured image and link behavior.');
    } finally {
        if (browser) await browser.close();
        for (const server of [site, assets]) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
