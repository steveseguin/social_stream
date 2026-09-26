// Run with local Playwright (or set PLAYWRIGHT_MODULE to its installed path).
// --serve keeps a localhost preview running after validation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.codex-tmp', 'site-translations');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
    let requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Mount the checkout at both locations to reproduce the Pages folder layout.
    if (requested === '/beta') requested = '/beta/';
    requested = requested.replace(/^\/beta\//, '/');
    let file = path.resolve(root, '.' + requested);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(requested); return; }
    res.setHeader('Content-Type', (mime[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.end(fs.readFileSync(file));
});

(async function () {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ headless: true });
    const errors = [], failed = [];
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
        await context.route('https://**', route => route.abort());
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {
            if (response.url().startsWith(origin) && response.status() >= 400) failed.push(response.status() + ' ' + response.url());
        });
        const pages = [
            ['index.html', 'Un solo chat. Todas las plataformas. Tu directo, a tu manera.'],
            ['docs/download.html', 'Descargar Social Stream Ninja'],
            ['docs/getting-started.html', 'Tu primer chat en SSN']
        ];
        for (const prefix of ['', '/beta']) {
            for (const [file, heading] of pages) {
                await page.goto(origin + prefix + '/es/' + file);
                await page.waitForFunction(() => window.SSNCopyMarkdown && document.querySelector('#copy-markdown'));
                assert.equal(await page.locator('html').getAttribute('lang'), 'es');
                assert.equal(await page.locator('h1').textContent(), heading);
                assert.equal(await page.locator('#ssn-site-nav a').first().textContent(), 'Inicio');
                assert.equal(await page.locator('#ssn-site-nav a').first().getAttribute('href'), file === 'index.html' ? 'index.html' : '../index.html');
                assert.equal(await page.locator('#copy-markdown').textContent(), 'Copiar Markdown');
                await page.locator('#copy-markdown').click();
                await page.waitForFunction(() => document.querySelector('#copy-markdown').getAttribute('data-copy-state') === 'success');
                assert.equal(await page.locator('#copy-markdown').textContent(), 'Markdown copiado');
                const copied = await page.evaluate(() => navigator.clipboard.readText());
                assert.ok(copied.includes(heading));
                assert.equal(await page.locator('#ssn-site-nav .site-language-link').getAttribute('href'), origin + prefix + '/' + file);
                const themeBefore = await page.locator('html').getAttribute('class');
                await page.locator('.site-theme').click();
                assert.notEqual(await page.locator('html').getAttribute('class'), themeBefore);
                assert.match(await page.locator('.site-theme').getAttribute('aria-label'), /^Cambiar al tema (claro|oscuro)$/);
                const selectedTheme = await page.locator('html').getAttribute('class');
                await page.reload();
                assert.equal(await page.locator('html').getAttribute('class'), selectedTheme);
                for (const width of [320, 390, 768, 1100, 1440]) {
                    await page.setViewportSize({ width, height: 900 });
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, file + ' horizontal overflow at ' + width);
                    if (width < 1051) {
                        await page.locator('.site-menu').click();
                        assert.equal(await page.locator('.site-menu').getAttribute('aria-label'), 'Cerrar el menú de navegación');
                        assert.equal(await page.locator('#ssn-site-nav .site-language-link').isVisible(), true);
                        await page.keyboard.press('Escape');
                        assert.equal(await page.locator('.site-menu').getAttribute('aria-expanded'), 'false');
                    } else {
                        assert.equal(await page.evaluate(() => {
                            const header = document.querySelector('.site-header').getBoundingClientRect();
                            return Array.from(document.querySelectorAll('#ssn-site-nav a')).every(link => {
                                const box = link.getBoundingClientRect();
                                return box.top >= header.top && box.bottom <= header.bottom && box.width > 0;
                            });
                        }), true, file + ' clipped navigation at ' + width);
                    }
                }
                // Capture both themes and a narrow viewport for manual review.
                if (prefix === '/beta') {
                    for (const dark of [false, true]) {
                        await page.evaluate(value => window.SSNSiteTheme.apply(value, true), dark);
                        // Color transitions take 200ms; inspect the settled theme.
                        await page.waitForTimeout(250);
                        const contrast = await page.locator('#copy-markdown').evaluate(button => {
                            function luminance(rgb) {
                                const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
                                    value /= 255;
                                    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
                                });
                                return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
                            }
                            const css = getComputedStyle(button);
                            const values = [luminance(css.color), luminance(css.backgroundColor)].sort((a, b) => a - b);
                            return (values[1] + 0.05) / (values[0] + 0.05);
                        });
                        assert.ok(contrast >= 4.5, file + ' copy button contrast: ' + contrast);
                        await page.screenshot({ path: path.join(output, file.replace(/[/.]/g, '-') + (dark ? '-dark' : '-light') + '.png') });
                    }
                    await page.setViewportSize({ width: 390, height: 844 });
                    await page.screenshot({ path: path.join(output, file.replace(/[/.]/g, '-') + '-mobile.png') });
                    await page.setViewportSize({ width: 1440, height: 1000 });
                }
            }
            await page.goto(origin + prefix + '/es/docs/download.html?pilot=1#extension');
            assert.equal(await page.locator('.tab-content.active').getAttribute('id'), 'extension');
            await page.locator('a[href="#manual-install"]').click();
            await page.locator('.tab-btn[data-tab="standalone"]').click();
            assert.equal(await page.locator('.tab-content.active').getAttribute('id'), 'standalone');
            await page.locator('#ssn-site-nav .site-language-link').click();
            await page.waitForURL(origin + prefix + '/docs/download.html?pilot=1#standalone');
            assert.equal(await page.locator('html').getAttribute('lang'), 'en');
            assert.equal(await page.locator('.tab-content.active').getAttribute('id'), 'standalone');
            await page.locator('#ssn-site-nav .site-language-link').click();
            await page.waitForURL(origin + prefix + '/es/docs/download.html?pilot=1#standalone');
            await page.locator('.tab-btn[data-tab="lite"]').click();
            await page.locator('.site-language-notice .site-language-link').click();
            await page.waitForURL(origin + prefix + '/docs/download.html?pilot=1#lite');
            await page.goto(origin + prefix + '/es/docs/getting-started.html');
            await page.locator('[data-choose-path="extension"]').click();
            assert.equal(await page.locator('[data-start-path="extension"]').first().isVisible(), true);
            assert.equal(await page.locator('[data-start-path="app"]').first().isVisible(), false);
            await page.locator('[data-choose-path="app"]').click();
            const image = page.locator('img[src$="beginner-service-active.png"]');
            await image.scrollIntoViewIfNeeded();
            await page.waitForFunction(() => {
                const image = document.querySelector('img[src$="beginner-service-active.png"]');
                return image.complete && image.naturalWidth > 0;
            });
            await page.locator('a[href="download.html#standalone"]').click();
            await page.waitForURL(origin + prefix + '/es/docs/download.html#standalone');
            await page.locator('#ssn-site-nav a').filter({ hasText: /^Funciones$/ }).click();
            await page.waitForURL(origin + prefix + '/docs/features.html');
            assert.equal(await page.locator('html').getAttribute('lang'), 'en');
            for (const [file] of pages) {
                await page.goto(origin + prefix + '/' + file);
                assert.equal(await page.locator('#ssn-site-nav .site-language-link').textContent(), 'Español');
                for (const width of [320, 390, 768, 1100, 1440]) {
                    await page.setViewportSize({ width, height: 900 });
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'English ' + file + ' overflow at ' + width);
                }
            }
            // Do not connect a real overlay: intercept its response while testing
            // that the existing session redirect remains at the app root.
            await context.route('**/featured.html?**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Overlay redirect fixture</h1>' }));
            for (const file of ['/index.html', '/es/index.html', '/es/']) {
                await page.goto(origin + prefix + file + '?session=PILOT_TEST&password=example');
                await page.waitForURL(origin + prefix + '/featured.html?session=PILOT_TEST&password=example');
            }
        }
        const noJs = await browser.newContext({ javaScriptEnabled: false });
        await noJs.route('https://**', route => route.abort());
        const staticPage = await noJs.newPage();
        for (const [file, heading] of pages) {
            await staticPage.goto(origin + '/beta/es/' + file);
            assert.equal(await staticPage.locator('h1').textContent(), heading);
            assert.equal(await staticPage.locator('.site-language-notice .site-language-link').textContent(), 'English');
        }
        await noJs.close();
        assert.deepEqual(errors, [], 'Browser script errors');
        assert.deepEqual(failed, [], 'Failed local requests');
        console.log('PASS: 3 Spanish pages at / and /beta/, navigation, English fallback, language switching, download tabs, guide setup paths, copy, themes, menus, 5 viewport widths, and session redirects.');
        console.log('Screenshots: ' + output);
    } finally {
        await browser.close();
        if (!process.argv.includes('--serve')) await new Promise(resolve => server.close(resolve));
    }
    if (process.argv.includes('--serve')) console.log('Preview: ' + origin + '/beta/es/');
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
