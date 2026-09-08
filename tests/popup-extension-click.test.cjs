const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Real unpacked extension, isolated from the user's browser profile and channels.
(async () => {
    const root = path.resolve(__dirname, '..');
    const context = await chromium.launchPersistentContext(
        fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-popup-click-')),
        {
            channel: 'chromium', headless: false,
            args: ['--load-extension=' + root, '--disable-extensions-except=' + root],
            viewport: { width: 600, height: 600 }
        }
    );
    try {
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const page = await context.newPage();
        await page.goto('chrome-extension://' + new URL(worker.url()).host + '/popup.html');
        await page.waitForFunction(() => document.getElementById('multialertslink')?.href);
        await page.evaluate(() => {
            const translated = Array.from(document.querySelectorAll('[data-translate]')).find(element =>
                element.parentElement.querySelector(':scope > .popup-control-icon'));
            if (!translated) throw new Error('No translated icon label found');
            const parent = translated.parentElement;
            const icon = parent.querySelector('.popup-control-icon');
            const text = translated.innerHTML;
            miniTranslate(parent, translated.dataset.translate, 'Translation preview');
            if (!icon.isConnected || icon.getAttribute('aria-hidden') !== 'true') throw new Error('Translation removed the decorative icon');
            translated.innerHTML = text;
        });
        for (const theme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: theme });
            for (const width of [400, 600]) {
                await page.setViewportSize({ width, height: 600 });
                for (const key of ['types', 'sound', 'effect']) {
                    const id = 'wrapper-multi-alert-' + key + '-options';
                    const label = page.locator('label[for="' + id + '"]');
                    // Click the label, not an assigned checked value: the native focus
                    // transfer is what previously scrolled the outer document blank.
                    await label.click();
                    await page.waitForTimeout(350);
                    const check = async () => {
                        assert.equal(await page.evaluate(() => window.scrollY), 0, 'Outer document scrolled out of view');
                        assert(await label.isVisible(), 'Section label disappeared');
                    };
                    await check();
                    await page.locator('#' + id).press('Space');
                    await page.waitForTimeout(350);
                    await check();
                }
            }
        }
        console.log('Extension section clicks and keyboard toggles passed in both themes and popup widths.');
    } finally {
        await context.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
