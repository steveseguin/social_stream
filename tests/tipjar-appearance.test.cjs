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
        await page.waitForFunction(() => document.querySelectorAll('iframe').length === 11);
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
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
