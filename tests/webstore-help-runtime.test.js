const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));
// Execute the actual provider link handler with and without the Store flag.
// This shared script must retain relative links in the other delivery targets.
const providerSource = fs.readFileSync(path.join(root, 'shared/monetization/popup.js'), 'utf8');
const providerStart = providerSource.indexOf('function providerLinks()');
const providerEnd = providerSource.indexOf('function providerStatus(', providerStart);
assert.ok(providerStart >= 0 && providerEnd > providerStart);
for (const storeMode of [true, false, undefined]) {
    const elements = {};
    const context = {
        URL, URLSearchParams, Date, providerSnapshot: {},
        location: { href: 'file:///app/popup.html', search: '' },
        by: id => elements[id] || (elements[id] = { value: id === 'provider' ? 'fourthwall' : '' }),
        setStatus() {}, tr: (key, fallback) => fallback
    };
    if (storeMode !== undefined) context.WEBSTORE_CONSERVATIVE_RELEASE = storeMode;
    vm.runInNewContext(providerSource.slice(providerStart, providerEnd) + '\nproviderLinks();', context);
    assert.equal(elements['provider-guide'].href,
        (storeMode ? 'https://socialstream.ninja/' : '') + 'docs/creator-store-setup.html#fourthwall');
}
(async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium', headless: true,
        args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
    });
    try {
        const hostedRequests = [];
        await context.route(/^https?:\/\//, route => {
            const url = new URL(route.request().url());
            if (url.origin === 'https://socialstream.ninja' && (url.pathname.startsWith('/docs/') || url.pathname === '/')) {
                hostedRequests.push(url.href);
                return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline hosted guide fixture</title><p id="guide">Hosted guide reached</p>' });
            }
            return route.abort();
        });
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
        const origin = `chrome-extension://${new URL(worker.url()).host}`;
        const popup = await context.newPage();
        await popup.goto(`${origin}/popup.html`);
        await popup.locator('body.loaded').waitFor();
        await popup.waitForSelector('#searchInput');
        await popup.waitForFunction(() => typeof applyWebStoreConservativeReleaseGates === 'function');
        await popup.waitForTimeout(500);
        const gates = await popup.evaluate(() => ({
            disabledOptions: Array.from(document.querySelectorAll('select option')).filter(option => ['kokoro', 'kitten', 'espeak', 'piper', 'localgemma', 'localqwen', 'localqwen2b'].includes(option.value)).map(option => option.value),
            tts: ['kokoro', 'kitten', 'espeak', 'piper'].map(normalizeWebStoreTtsProvider),
            ai: ['localgemma', 'localqwen', 'localqwen2b'].map(normalizeWebStoreAiProvider),
            external: [normalizeWebStoreTtsProvider('openai'), normalizeWebStoreAiProvider('ollama')],
            help: Array.from(document.querySelectorAll('a[href]')).map(link => link.href).filter(href => href.includes('/docs/'))
        }));
        assert.deepEqual(gates.disabledOptions, []);
        assert.deepEqual(gates.tts, ['system', 'system', 'system', 'system']);
        assert.deepEqual(gates.ai, ['ollama', 'ollama', 'ollama']);
        assert.deepEqual(gates.external, ['openai', 'ollama']);
        assert.ok(gates.help.length > 10);
        assert.ok(gates.help.every(url => url.startsWith('https://socialstream.ninja/')), 'Popup help must open hosted documentation');

        // Exercise the real Event Flow editor's guide resolver, without running flows.
        const editor = await context.newPage();
        await editor.goto(`${origin}/actions/index.html`);
        await editor.waitForFunction(() => typeof EventFlowEditor === 'function');
        const eventGuide = await editor.evaluate(() => EventFlowEditor.prototype.resolveGuideTarget.call(Object.create(EventFlowEditor.prototype), 'event-reference-cross-platform'));
        assert.equal(eventGuide, 'https://socialstream.ninja/docs/event-reference.html#cross-platform');
        // Docs are hosted in this edition; do not recreate excluded local pages.
        const cases = [[eventGuide, eventGuide]];
        for (const provider of ['fourthwall', 'kofi', 'bmac']) {
            await popup.evaluate(provider => {
                const select = document.getElementById('money-provider');
                select.value = provider;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }, provider);
            const expected = `https://socialstream.ninja/docs/creator-store-setup.html#${provider}`;
            const href = await popup.locator('#money-provider-guide').getAttribute('href');
            assert.equal(href, expected, 'Provider changes must not replace hosted help with an excluded local file');
            cases.push([href, expected]);
        }
        for (const [local, expected] of cases) {
            const page = await context.newPage();
            const violations = [];
            page.on('console', message => { if (/violates.*Content Security Policy|Refused to execute inline/i.test(message.text())) violations.push(message.text()); });
            await page.goto(local, { waitUntil: 'domcontentloaded' });
            await page.waitForURL(expected);
            assert.equal(await page.locator('#guide').textContent(), 'Hosted guide reached');
            assert.deepEqual(violations, [], `Help navigation hit extension CSP: ${local}`);
            await page.close();
        }
        assert.ok(hostedRequests.every(url => !url.includes('PRIVATE_FIXTURE')), 'Help navigation leaked extension session parameters');
        console.log('Actual extension help and feature gates passed: hosted popup/Event Flow guides, all Creator Store providers, CSP and credential isolation.');
    } finally {
        await context.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
