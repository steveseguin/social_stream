const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));

(async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium', headless: true,
        args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
    });
    try {
        await context.route(/^https?:\/\//, route => {
            const url = new URL(route.request().url());
            if (url.hostname === 'ssn-review.invalid') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline injection fixture</title><main>Local test</main>' });
            if (url.origin === 'https://socialstream.ninja') {
                const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
                if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
            }
            return route.abort();
        });
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
        const origin = `chrome-extension://${new URL(worker.url()).host}`;
        const popup = await context.newPage();
        await popup.goto(`${origin}/popup.html`);
        await popup.waitForSelector('#searchInput');
        await popup.waitForTimeout(500);

        // Use the same runtime request as the source picker. No test-side script injection.
        const fixture = await context.newPage();
        let injections = 0;
        fixture.on('console', message => { if (message.text() === 'Enhanced social stream chat scraper injected') injections++; });
        await fixture.goto('https://ssn-review.invalid/');
        assert.equal(injections, 0);
        const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'https://ssn-review.invalid/' }))[0].id);
        await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: 'injectCustomSource', source: 'generic', tabId }).catch(() => {}), tabId);
        await fixture.waitForTimeout(500);
        assert.equal(injections, 1, 'The retained scripting permission did not inject a packaged source');

        const volumes = [];
        for (const value of [25, 0, 75]) {
            await popup.evaluate(value => {
                const checkbox = document.querySelector('input[data-param1="beepvolume"]');
                if (!checkbox.checked) { checkbox.checked = true; checkbox.dispatchEvent(new Event('change', { bubbles: true })); }
                const range = document.getElementById('dock-beep-volume-range');
                range.value = String(value);
                range.dispatchEvent(new Event('input', { bubbles: true }));
                range.dispatchEvent(new Event('change', { bubbles: true }));
            }, value);
            await popup.waitForFunction(value => {
                const raw = document.getElementById('dock').raw;
                return raw && new URL(raw).searchParams.get('beepvolume') === String(value);
            }, value);
            const url = await popup.evaluate(() => document.getElementById('dock').raw);
            const dock = await context.newPage();
            await dock.goto(url, { waitUntil: 'domcontentloaded' });
            // Dock intentionally replaces window.eval. Read through DevTools,
            // preserving that protection instead of changing it for Playwright.
            const cdp = await context.newCDPSession(dock);
            const result = await cdp.send('Runtime.evaluate', { expression: "document.getElementById('testtone').volume", returnByValue: true });
            assert.ok(!result.exceptionDetails, 'Could not inspect dock sound volume');
            const volume = result.result.value;
            assert.equal(volume, value / 100, `Popup sound volume ${value}% did not reach the dock audio element`);
            volumes.push(volume);
            await dock.close();
        }
        console.log(`Reviewer functionality passed: scripting injects the packaged generic source; popup sound volume reaches dock audio at ${volumes.join(', ')} (audible output not measured).`);
    } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
