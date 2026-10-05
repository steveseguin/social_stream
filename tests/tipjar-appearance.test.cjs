'use strict';

// Run: node tests/tipjar-appearance.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startServer, makeContext, openTipJar } = require('./tipjar-count-goals.test.cjs');
const legacyCss = fs.readFileSync(path.join(__dirname, 'fixtures/tipjar-legacy.css'), 'utf8');

async function testLegacyAppearance(browser, baseUrl) {
    const context = await makeContext(browser);
    const page = await context.newPage();
    try {
        for (const viewport of [{ width: 900, height: 600 }, { width: 390, height: 600 }]) {
            await page.setViewportSize(viewport);
            for (const style of ['jar', 'meter', 'bar', 'compact', 'vertical', 'minimal', 'text']) {
                for (const theme of ['default', 'neon', 'gold']) {
                    await page.goto(baseUrl + '/tipjar.html?preview&style=' + style + '&theme=' + theme + '&startamount=63.5&goal=100');
                    await page.evaluate(() => document.fonts.ready);
                    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
                    const current = await page.screenshot({ animations: 'disabled' });
                    await page.locator('style').first().evaluate((el, css) => { el.textContent = css; }, legacyCss);
                    const legacy = await page.screenshot({ animations: 'disabled' });
                    assert(current.equals(legacy), 'Legacy appearance changed: ' + style + '/' + theme + '/' + viewport.width);
                    if (['bar', 'compact', 'vertical'].includes(style)) {
                        assert.deepStrictEqual(await page.evaluate(() => [fillStartColor, fillEndColor]), ['#2196F3', '#f44336']);
                    }
                }
            }
        }
        // Custom fill, dimensions and jar images retain their old CSS rendering too.
        for (const params of [
            'style=bar&theme=gold&fillstart=%23123456&fillend=%23654321&fillmode=gradient&barheight=34&barradius=0&bartextsize=16&baronly',
            'style=jar&jarimage=./media/logo.png&title=Custom%20jar',
            'style=meter&theme=neon&fillstart=%23123456&fillend=%23654321'
        ]) {
            await page.goto(baseUrl + '/tipjar.html?preview&startamount=35&goal=100&' + params);
            await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
            const current = await page.screenshot({ animations: 'disabled' });
            await page.locator('style').first().evaluate((el, css) => { el.textContent = css; }, legacyCss);
            assert(current.equals(await page.screenshot({ animations: 'disabled' })), 'Custom appearance changed: ' + params);
        }
        await page.goto(baseUrl + '/tipjar.html?preview&style=jar&refresh');
        assert.strictEqual(await page.locator('#tip-text').evaluate(el => getComputedStyle(el).fontSize), '22px');
        await page.goto(baseUrl + '/tipjar.html?preview&style=jar');
        assert.strictEqual(await page.locator('#tip-text').evaluate(el => getComputedStyle(el).fontSize), '24px');
    } finally { await context.close(); }
}

async function testPreviewIsolation(browser, baseUrl) {
    const context = await browser.newContext();
    const forbidden = [];
    await context.route('**/*', route => {
        if (route.request().url().startsWith(baseUrl + '/')) return route.continue();
        forbidden.push(route.request().url());
        return route.abort();
    });
    await context.addInitScript(() => {
        window.previewStorageAccesses = 0;
        window.WebSocket = function () { throw new Error('Preview opened a socket'); };
        ['getItem', 'setItem', 'removeItem'].forEach(method => {
            Storage.prototype[method] = function () { window.previewStorageAccesses++; throw new Error('Preview accessed storage'); };
        });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: value => { window.copiedLink = value; return Promise.resolve(); } } });
    });
    try {
        const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&persistent&server&localserver&sound&style=card&startamount=25');
        await page.evaluate(() => processData({ type: 'youtube', chatname: 'Sample', hasDonation: '$5' }));
        assert.strictEqual(await page.textContent('#summary-amount'), '$30.00');
        assert.strictEqual(await page.locator('iframe').count(), 0);
        assert.strictEqual(await page.evaluate(() => window.previewStorageAccesses), 0);
        assert.deepStrictEqual(errors, []);
        await page.goto(baseUrl + '/tipjar-preview.html');
        await page.waitForFunction(() => document.querySelectorAll('iframe').length === 27);
        for (const frameEl of await page.locator('iframe').elementHandles()) {
            const frame = await frameEl.contentFrame();
            await frame.waitForFunction(() => typeof processData === 'function');
            assert.strictEqual(await frame.locator('#frame1').count(), 0);
            assert.strictEqual(await frame.evaluate(() => window.previewStorageAccesses), 0);
        }
        await page.fill('#overlay-link', baseUrl + '/tipjar.html?session=KEEP&password=secret&goal=750&persistent&tipjarsource=youtube&goalmetric=count&levelsize=10');
        await page.fill('#panelopacity', '0.5');
        await page.fill('#amountsize', '28');
        await page.check('#hidepercent');
        await page.check('#refresh');
        await page.getByRole('button', { name: 'Copy Progress Ring link', exact: true }).click();
        const copied = new URL(await page.evaluate(() => window.copiedLink));
        ['session', 'password', 'goal', 'persistent', 'tipjarsource', 'goalmetric', 'levelsize'].forEach(key => {
            assert.strictEqual(copied.searchParams.get(key), new URL(baseUrl + '/tipjar.html?session=KEEP&password=secret&goal=750&persistent&tipjarsource=youtube&goalmetric=count&levelsize=10').searchParams.get(key));
        });
        assert.strictEqual(copied.searchParams.get('style'), 'ring');
        assert.strictEqual(copied.searchParams.get('panelopacity'), '0.5');
        assert.strictEqual(copied.searchParams.get('amountsize'), '28');
        assert(copied.searchParams.has('hidepercent'));
        assert(copied.searchParams.has('refresh'));
        assert(!copied.searchParams.has('preview'));
        assert(!copied.searchParams.has('startamount'));
        assert.deepStrictEqual(forbidden, []);
        assert.deepStrictEqual(errors, []);
        if (process.env.TIPJAR_SCREENSHOTS) {
            fs.mkdirSync(process.env.TIPJAR_SCREENSHOTS, { recursive: true });
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.screenshot({ path: path.join(process.env.TIPJAR_SCREENSHOTS, 'tipjar-preview.png'), fullPage: true });
        }
    } finally { await context.close(); }
}

// The physical jars share one renderer, so check the shared geometry,
// the readouts, and the donation feedback on each of them.
async function testPhysicalStyles(browser, baseUrl) {
    const context = await makeContext(browser);
    try {
        for (const style of ['glassjar', 'beermug', 'coffeemug', 'potion', 'piggybank', 'chest', 'thermometer']) {
            const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=' + style + '&goal=100&startamount=25&title=Studio');
            const fill = await page.evaluate(() => ({
                range: activeVessel.bottom - activeVessel.top,
                transform: document.getElementById('vessel-liquid').style.transform
            }));
            assert.strictEqual(parseFloat(fill.transform.replace(/[^0-9.-]/g, '')), Number((fill.range * 0.75).toFixed(2)), style + ' liquid level');
            assert.strictEqual(await page.textContent('#vessel-amount'), '$25.00 / $100');
            assert.strictEqual(await page.textContent('#vessel-title'), 'Studio');
            const drops = await page.evaluate(() => {
                processData({ type: 'youtube', chatname: 'Donor', hasDonation: '$25' });
                return document.querySelectorAll('.vessel-drop').length;
            });
            assert.strictEqual(drops, 1, style + ' drops an item on a donation');
            assert.strictEqual(await page.textContent('#vessel-percent'), '50%');
            assert.deepStrictEqual(errors, []);
            await page.close();
        }
        // The 3D jar fills a CSS cylinder instead of an SVG clip, and an
        // empty one shows no liquid surface at all.
        const spinner = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=jar3d&goal=100&startamount=40');
        assert.strictEqual(await spinner.page.locator('#jar3d-liquid').evaluate(el => el.style.height), '40%');
        assert.strictEqual(await spinner.page.locator('.jar3d-surface').isVisible(), true);
        assert.deepStrictEqual(spinner.errors, []);
        await spinner.page.close();
        const drained = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=jar3d&goal=100');
        assert.strictEqual(await drained.page.locator('.jar3d-surface').isVisible(), false);
        await drained.page.close();
        // dropitem swaps the classic jar's falling sprite for a generated one.
        const jar = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=jar&dropitem=coins&goal=100');
        const textures = await jar.page.evaluate(() => {
            addHeart(10);
            return Matter.Composite.allBodies(world).filter(body => !body.isStatic).map(body => body.render.sprite.texture.slice(0, 15));
        });
        assert.deepStrictEqual(textures, ['data:image/png;'], 'dropitem sprite');
        assert.deepStrictEqual(jar.errors, []);
        await jar.page.close();
    } finally { await context.close(); }
}

// The goal bars share a second renderer: fill width, readouts and the
// donation flash come from the same stage.
async function testGoalBars(browser, baseUrl) {
    const context = await makeContext(browser);
    try {
        for (const style of ['battery', 'xpbar', 'healthbar', 'pixelbar', 'neonbar', 'terminal', 'milestones', 'gauge']) {
            const { page, errors } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=' + style + '&goal=100&startamount=40&title=Studio');
            assert.strictEqual(await page.textContent('#kit-amount'), '$40.00 / $100', style + ' readout');
            assert.strictEqual(await page.textContent('#kit-title'), 'Studio');
            if (style !== 'terminal' && style !== 'gauge') {
                assert.strictEqual(await page.locator('#kit-fill').evaluate(el => el.style.width), '40%', style + ' fill width');
            }
            const pulsed = await page.evaluate(() => {
                processData({ type: 'youtube', chatname: 'Donor', hasDonation: '$20' });
                return document.getElementById('kit-stage').classList.contains('is-pulse');
            });
            assert.strictEqual(pulsed, true, style + ' flashes on a donation');
            assert.strictEqual(await page.textContent('#kit-percent, .kit-inline, #kit-gauge-value'), '60%', style + ' percentage');
            assert.deepStrictEqual(errors, []);
            await page.close();
        }
        // An empty dial must not leave a round line cap sitting on the arc.
        const empty = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=gauge&goal=100');
        assert.strictEqual(await empty.page.locator('#kit-gauge-fill').evaluate(el => el.style.strokeOpacity), '0');
        await empty.page.close();
        // Style-specific parts: the dial needle, the terminal bar and the milestone pins.
        const dial = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=gauge&goal=100&startamount=50');
        assert.strictEqual(await dial.page.locator('#kit-needle').evaluate(el => el.style.transform), 'rotate(0deg)');
        await dial.page.close();
        const term = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=terminal&goal=100&startamount=25');
        assert.strictEqual(await term.page.textContent('#kit-bar'), '[' + '█'.repeat(6) + '░'.repeat(18) + ']');
        await term.page.close();
        const pins = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=milestones&goal=100&startamount=55');
        assert.deepStrictEqual(
            await pins.page.evaluate(() => [0, 1, 2, 3, 4].map(i => document.getElementById('kit-pin-' + i).classList.contains('on'))),
            [true, true, true, false, false]
        );
        assert.strictEqual(await pins.page.textContent('#kit-pin-label-2'), '$50');
        await pins.page.close();
        // Count goals keep the pins numeric; the unit stays in the readout.
        const counted = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=milestones&goal=20&goalmetric=count&startamount=13');
        assert.strictEqual(await counted.page.textContent('#kit-pin-label-4'), '20');
        assert.strictEqual(await counted.page.textContent('#kit-amount'), '13 / 20 donations');
        await counted.page.close();
    } finally { await context.close(); }
}

async function testPanelControls(browser, baseUrl) {
    const context = await makeContext(browser);
    try {
        for (const style of ['card', 'ring', 'lowerthird', 'segmented']) {
            const { page } = await openTipJar(context, baseUrl + '/tipjar.html?preview&style=' + style + '&panelopacity=0.5&accent=%23ffcc88&amountsize=28&hidepercent&startamount=50&goal=100');
            assert.strictEqual(await page.locator('.summary-panel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(18, 24, 34, 0.5)');
            assert.strictEqual(await page.locator('#summary-amount').evaluate(el => getComputedStyle(el).fontSize), '28px');
            assert.strictEqual(await page.locator('#summary-ring-fill').evaluate(el => getComputedStyle(el).stroke), 'rgb(255, 204, 136)');
            assert.strictEqual(await page.locator('#summary-percent').isVisible(), false);
            assert.strictEqual(await page.locator('#summary-ring-percent').isVisible(), false);
            await page.close();
        }
    } finally { await context.close(); }
}

async function testVesselColors(browser, baseUrl) {
    const context = await makeContext(browser);
    const page = await context.newPage();
    const styles = ['glassjar', 'beermug', 'coffeemug', 'potion', 'piggybank', 'chest', 'thermometer', 'jar3d'];
    try {
        // Both SVG and HTML attribute breakouts used to reach the jar markup.
        for (const style of styles) {
            for (const key of ['fillstart', 'fillend', 'barcolorstart', 'barcolorend']) {
                const params = new URLSearchParams({ preview: '', style, goal: '100', startamount: '50' });
                params.set(key, '"><img src="missing-color-probe" onerror="window.colorProbe=1"><svg onload="window.colorProbe=1">');
                await page.goto(baseUrl + '/tipjar.html?' + params);
                assert.strictEqual(await page.locator('[onerror], [onload], [src="missing-color-probe"]').count(), 0, style + '/' + key + ' injected markup');
                assert.strictEqual(await page.evaluate(() => window.colorProbe), undefined, style + '/' + key + ' executed code');
                assert.strictEqual(await page.textContent('#vessel-amount'), '$50.00 / $100');
            }
        }
        for (const style of styles) {
            for (const mode of ['solid', 'progress', 'gradient']) {
                const params = new URLSearchParams({ preview: '', style, goal: '100', startamount: '25', fillstart: 'red', fillend: 'rgb(0, 0, 255)', fillmode: mode });
                await page.goto(baseUrl + '/tipjar.html?' + params);
                for (const amount of [25, 75, 0, 100]) {
                    await page.evaluate(value => processData(value === 0 ? { cmd: 'resettipjar' } : { cmd: 'settipjaramount', value }), amount);
                    const current = mode === 'solid' ? 'rgb(255, 0, 0)' : `rgb(${Math.round(255 * (1 - amount / 100))}, 0, ${Math.round(255 * amount / 100)})`;
                    const expected = mode === 'gradient' ? ['rgb(255, 0, 0)', 'rgb(0, 0, 255)'] : [current, current];
                    if (style === 'jar3d') {
                        const paint = await page.locator('#jar3d-liquid > .jar3d-slat').first().evaluate(el => getComputedStyle(el).backgroundImage);
                        assert.ok(paint.includes('linear-gradient(to top, ' + expected.join(', ') + ')'), style + '/' + mode + '/' + amount);
                        const surface = await page.locator('.jar3d-surface').evaluate(el => getComputedStyle(el).backgroundImage);
                        assert.ok(surface.includes(current), '3D surface follows the fill color');
                    } else {
                        const paint = await page.locator('#vsl-liquid').evaluate(el => Array.from(el.children, child => getComputedStyle(child).stopColor));
                        assert.deepStrictEqual(paint, expected, style + '/' + mode + '/' + amount);
                        if (mode === 'gradient') {
                            const ends = await page.evaluate(() => {
                                const gradient = document.getElementById('vsl-liquid');
                                const offset = parseFloat(document.getElementById('vessel-liquid').style.transform.replace(/[^0-9.-]/g, ''));
                                return [Number(gradient.getAttribute('y1')) + offset - activeVessel.bottom,
                                    Number(gradient.getAttribute('y2')) + offset - activeVessel.top];
                            });
                            assert.ok(ends.every(value => Math.abs(value) < 0.01), 'Gradient remains anchored as liquid rises');
                        }
                    }
                }
            }
        }
    } finally { await context.close(); }
}

async function testPixelBarPaint(browser, baseUrl) {
    const context = await makeContext(browser);
    const page = await context.newPage();
    try {
        await page.goto(baseUrl + '/tipjar.html?preview&style=pixelbar&goal=100&fillstart=%2300ff00&fillmode=solid');
        await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
        for (const width of [640, 390]) {
            await page.setViewportSize({ width, height: 200 });
            for (const amount of [5, 20, 50, 100, 0]) {
                await page.evaluate(value => processData(value === 0 ? { cmd: 'resettipjar' } : { cmd: 'settipjaramount', value }), amount);
                const shot = await page.locator('.kit-pixel-inner').screenshot();
                // Count actual painted green blocks, rather than only checking CSS width.
                const blocks = await page.evaluate(async data => {
                    const img = new Image();
                    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = data; });
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const row = ctx.getImageData(0, Math.floor(img.height / 2), img.width, 1).data;
                    let runs = 0, previous = false;
                    for (let x = 0; x < img.width; x++) {
                        const green = row[x * 4] < 30 && row[x * 4 + 1] > 150 && row[x * 4 + 2] < 30;
                        if (green && !previous) runs++;
                        previous = green;
                    }
                    return runs;
                }, 'data:image/png;base64,' + shot.toString('base64'));
                assert.strictEqual(blocks, amount / 5, width + 'px at ' + amount + '%');
            }
        }
    } finally { await context.close(); }
}

(async function () {
    const { server, baseUrl } = await startServer();
    const browser = await chromium.launch({ headless: true });
    try {
        await testLegacyAppearance(browser, baseUrl);
        console.log('PASS Legacy styles match original CSS pixels across themes, sizes, and custom settings');
        await testPreviewIsolation(browser, baseUrl);
        console.log('PASS Preview is isolated and copied links preserve connection and goal settings');
        await testPanelControls(browser, baseUrl);
        console.log('PASS New panel controls apply opacity, accent, text size, and percentage visibility');
        await testPhysicalStyles(browser, baseUrl);
        console.log('PASS Physical jars fill, read out, and react to donations');
        await testGoalBars(browser, baseUrl);
        console.log('PASS Goal bars fill, read out, and flash on donations');
        await testVesselColors(browser, baseUrl);
        console.log('PASS Jar colors reject markup and honor solid, progress, and fixed gradient modes');
        await testPixelBarPaint(browser, baseUrl);
        console.log('PASS Pixel Bar paints the correct number of blocks at desktop and narrow widths');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
