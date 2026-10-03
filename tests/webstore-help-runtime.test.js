const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(process.env.SSN_EXTENSION_ROOT || path.join(__dirname, '..'));
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
        assert.equal(eventGuide, `${origin}/docs/event-reference.html#cross-platform`);
        const cases = [
            [eventGuide, 'https://socialstream.ninja/docs/event-reference.html#cross-platform'],
            [`${origin}/docs/youtube-project-setup.html?session=PRIVATE_FIXTURE&password=PRIVATE_FIXTURE#oauth`, 'https://socialstream.ninja/docs/youtube-project-setup.html#oauth'],
            [`${origin}/index.html`, 'https://socialstream.ninja/'],
            [`${origin}/landing.html`, 'https://socialstream.ninja/']
        ];
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
        console.log('Actual extension help and feature gates passed: hosted popup links, Event Flow/YouTube guide redirects, CSP and credential isolation.');
    } finally {
        await context.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
