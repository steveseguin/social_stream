const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const language = process.env.SITE_LANGUAGE || 'es';
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server = http.createServer((req, res) => {
    let requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/beta\//, '/');
    let file = path.resolve(root, '.' + requested);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(requested); }
    res.setHeader('Content-Type', (mime[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.end(fs.readFileSync(file));
});
function htmlFiles(directory) {
    return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? htmlFiles(path.join(directory,entry.name)) : entry.name.endsWith('.html') ? [path.join(directory,entry.name)] : []);
}
(async function () {
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({headless:true});
    try {
        const context = await browser.newContext({viewport:{width:1440,height:1000}});
        await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        const page = await context.newPage(), errors = [], failed = [], findings = [];
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) failed.push(response.status() + ' ' + response.url()); });
        const files = htmlFiles(path.join(root,language)).filter(file => fs.readFileSync(file,'utf8').includes('name="ssn-site-translation"'));
        assert.ok(files.length, 'Build expanded translations first');
        for (const file of files) {
            const relative = path.relative(path.join(root,language),file).replace(/\\/g,'/');
            await page.goto(origin + '/beta/' + language + '/' + relative);
            await page.waitForLoadState('networkidle');
            assert.equal(await page.locator('html').getAttribute('lang'), language,relative);
            assert.equal(await page.locator('[data-site-language-picker]').count(),1,relative);
            const picker = page.locator('[data-site-language-picker]');
            if (await picker.isVisible()) {
                await picker.locator('summary').click();
                assert.equal(await picker.locator('a[lang="en"]').isVisible(), true,relative);
                assert.ok((await picker.locator('a[lang="en"]').getAttribute('href')).endsWith('/beta/' + relative));
                await page.keyboard.press('Escape');
                assert.equal(await picker.getAttribute('open'),null);
            }
            const assets = await page.locator('img').evaluateAll(images => images.filter(image => image.complete && image.naturalWidth === 0 && image.getAttribute('src') && image.getAttribute('src') !== '#').map(image => image.src));
            if (assets.length) findings.push({page:relative,brokenImages:assets});
            for (const width of [390,1100,1440]) {
                await page.setViewportSize({width,height:1000});
                if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) findings.push({page:relative,overflow:width});
            }
            if (relative === 'docs/games-gallery.html') {
                const sourcePaths = await page.locator('.game-actions a[href*="?demo"]').evaluateAll(links => links.map(link => link.pathname));
                assert.ok(sourcePaths.length > 10);
                assert.ok(sourcePaths.every(url => url.startsWith('/beta/games/') || url === '/beta/games.html'),JSON.stringify(sourcePaths));
                await page.locator('#game-connection > summary').click();
                await page.locator('#game-session').fill('translation-test');
                const target = await page.locator('.use-game').first().getAttribute('href');
                assert.match(target,/\/beta\/games\/.*session=translation-test/);
                await page.locator('#game-search').fill('luci');
                if (language === 'es') assert.equal(await page.locator('.game-card:visible').count(),1);
                if (language === 'es') assert.equal(await page.locator('#game-count').textContent(),'1 juego o interacción con el chat');
            }
            console.log('Checked ' + relative);
        }
        assert.deepEqual(errors,[],'JavaScript errors');
        assert.deepEqual(failed,[],'Missing local resources');
        fs.mkdirSync(path.join(root,'.codex-tmp/site-translations'),{recursive:true});
        fs.writeFileSync(path.join(root,'.codex-tmp/site-translations/expanded-findings.json'),JSON.stringify(findings,null,2));
        console.log(JSON.stringify({pages:files.length,findings},null,2));
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
