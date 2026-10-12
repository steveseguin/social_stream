// Explicitly opt-in actual SSApp check; no live accounts, provider requests or payments.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
const ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const { _electron } = require('playwright');
(async function () {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-money-locales-'));
    fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'isolated-money-locales', password: 'false', state: false, settings: {}, wsServer: false }));
    const wrapper = path.join(profile, 'bootstrap.cjs');
    fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
    const app = await _electron.launch({ executablePath: path.join(ssapp, 'node_modules/electron/dist/electron.exe'), args: [wrapper, '--running-from-source', '--multiinstance', '--ssapp-headless-control', '--filesource', 'file:///' + root + '/', '--no-hwa'].filter(arg => !process.env.SSN_GUIDE_SCREENSHOTS || arg !== '--ssapp-headless-control'), cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
    try {
        const main = await app.firstWindow(); main.setDefaultTimeout(25000);
        await main.waitForFunction(() => document.querySelector('#frame2')?.contentWindow?.handleMonetizationRequest);
        const popup = main.frames().find(f => /popup\.html/.test(f.url()));
        await main.locator('[data-page=streams]').click();
        await popup.evaluate(() => { applyPopupBeginnerMode(false); document.getElementById('monetization-settings').open = true; document.getElementById('money-commerce-panel').open = true; });
        await popup.waitForFunction(() => document.getElementById('money-current').textContent.includes('Load your wishlist'));
        await popup.locator('#money-commerce-name').fill('Sample studio mug');
        await popup.locator('#money-commerce-url').fill('https://example.com/studio-mug');
        await popup.locator('#money-commerce-add').click();
        await popup.locator('#money-commerce-name').fill('Unfinished item stays here');
        const controlIds = await popup.evaluate(() => [...document.querySelectorAll('#monetization-settings input, #monetization-settings select, #monetization-settings button')].map(e => e.id).sort());
        const languages = ['ar', 'cs', 'de', 'es', 'fr', 'pt-br', 'th', 'tr', 'uk', 'zh-CN', 'zh-TW'];
        const records = [];
        for (const language of languages) {
            const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'translations', language + '.json'), 'utf8'));
            for (const key of ['save-setup-to-generate', 'your-username', 'from-your-ninjabacker-dashboard', 'generate-in-the-ninjabacker-dashboard', 'your-throne-username', 'enable-and-save-to-create-your-connection', 'optional']) {
                assert(!dictionary.placeholders[key].includes('?'), language + ': corrupted placeholder ' + key);
            }
            await popup.evaluate(({ language, dictionary }) => {
                translation = dictionary;
                document.querySelector('select[data-optionsetting="translationlanguage"]').value = language;
                applyPopupTextDirection(language);
                miniTranslate(document.body);
                const panel = document.getElementById('monetization-settings');
                panel.style.width = '560px'; panel.style.maxWidth = '100%'; panel.style.boxSizing = 'border-box';
                panel.querySelectorAll('details').forEach(e => { e.open = true; });
            }, { language, dictionary });
            assert.equal(await popup.locator('#money-commerce-name').inputValue(), 'Unfinished item stays here', language + ': language change lost draft');
            assert.equal(await popup.locator('#money-commerce-items .money-item').count(), 1);
            assert.deepEqual(await popup.evaluate(() => [...document.querySelectorAll('#monetization-settings input, #monetization-settings select, #monetization-settings button')].map(e => e.id).sort()), controlIds, language + ': translation replaced a control');
            assert((await popup.locator('#money-save').textContent()).includes(dictionary.innerHTML['money-save-setup']));
            assert((await popup.locator('#money-save').textContent()).includes(dictionary.innerHTML['commerce-draft']));
            assert.equal(await popup.locator('#money-current').textContent(), dictionary.innerHTML['money-load-your-wishlist-or-add-its-items-below']);
            assert.equal(await popup.locator('#money-ebay-connect').textContent(), dictionary.innerHTML['money-connect-ebay']);
            assert.equal(await popup.locator('#money-ninja-username').getAttribute('placeholder'), dictionary.placeholders['your-username']);
            assert.equal(await popup.evaluate(() => document.documentElement.dir), language === 'ar' ? 'rtl' : 'ltr');
            const dimensions = await popup.evaluate(() => { const p = document.getElementById('monetization-settings'); return { client: p.clientWidth, scroll: p.scrollWidth }; });
            assert(dimensions.scroll <= dimensions.client + 1, language + ': panel horizontal overflow ' + JSON.stringify(dimensions));
            for (const theme of ['light', 'dark']) {
                await main.emulateMedia({ colorScheme: theme });
                for (const provider of ['wishlist', 'ninja', 'ebay', 'throne']) {
                    const box = await popup.locator('#money-' + provider + '-panel').boundingBox();
                    assert(box && box.width > 100 && box.height > 100, language + ': empty provider panel');
                }
                records.push({ language, theme, width: dimensions.client });
                if (process.env.SSN_GUIDE_SCREENSHOTS && ['ar', 'de', 'zh-CN'].includes(language)) {
                    await app.evaluate(({ BrowserWindow }, url) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url); w.setSize(1584, 1400); w.webContents.setBackgroundThrottling(false); }, main.url());
                    for (const provider of ['wishlist', 'ninja', 'ebay', 'throne']) {
                        await popup.locator('#money-' + provider + '-panel').evaluate(e => e.scrollIntoView({ block: 'start' }));
                        await main.waitForTimeout(150);
                        const png = await app.evaluate(async ({ BrowserWindow }, url) => (await BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url).webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'), main.url());
                        fs.writeFileSync(path.join(profile, `${language}-${theme}-${provider}.png`), Buffer.from(png, 'base64'));
                    }
                }
            }
        }
        let overlayLayouts = 0;
        for (const mode of ['commerce', 'wishlist', 'ninja', 'ebay', 'throne']) {
            const opened = app.waitForEvent('window');
            await app.evaluate(async ({ BrowserWindow }, options) => { const w = new BrowserWindow({ show: false, width: 390, height: 650, webPreferences: { backgroundThrottling: false } }); await w.loadURL(options.url); if (options.capture) w.showInactive(); }, { url: 'file:///' + root + '/monetization.html?demo&mode=' + mode, capture: !!process.env.SSN_GUIDE_SCREENSHOTS });
            const overlay = await opened; overlay.setDefaultTimeout(12000);
            const errors = []; overlay.on('pageerror', error => errors.push(error.message));
            await overlay.locator('#support-card').waitFor();
            await overlay.setViewportSize({ width: 390, height: 650 });
            for (const language of languages) {
                await overlay.evaluate(language => SSNPageI18n.setLanguage(language), language);
                assert.equal(await overlay.evaluate(() => document.documentElement.dir), language === 'ar' ? 'rtl' : 'ltr');
                const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'translations', language + '.json'), 'utf8'));
                await overlay.waitForFunction(expected => document.getElementById('overlay-status').textContent === expected, dictionary.innerHTML['money-overlay-preview']);
                for (const theme of ['light', 'dark']) {
                    await overlay.emulateMedia({ colorScheme: theme });
                    const box = await overlay.locator('#support-card').evaluate(e => { const b = e.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: innerWidth, height: innerHeight, scroll: e.scrollWidth, client: e.clientWidth, text: e.textContent }; });
                    assert(box.left >= -1 && box.top >= -1 && box.right <= box.width + 1 && box.bottom <= box.height + 1 && box.scroll <= box.client + 1, `${mode}/${language}/${theme}: translated overlay overflow ${JSON.stringify(box)}`);
                    assert(!/\{(?:rank|count|name|hours|minutes|seconds|amount|item)\}/.test(box.text), `${mode}/${language}: untranslated placeholder`);
                    overlayLayouts++;
                    if (process.env.SSN_GUIDE_SCREENSHOTS && ['ar', 'de', 'zh-CN'].includes(language) && theme === 'dark') {
                        await overlay.waitForTimeout(200);
                        await overlay.screenshot({ path: path.join(profile, `overlay-${mode}-${language}.png`) });
                    }
                }
            }
            assert.deepEqual(errors, [], mode + ': overlay exception');
            await overlay.close();
        }
        fs.writeFileSync(path.join(profile, 'results.json'), JSON.stringify(records, null, 2));
        console.log('PASS: 11 popup locales, 22 theme layouts, 88 provider panels, ' + overlayLayouts + ' translated overlay layouts, draft/control preservation and dynamic labels.');
        console.log(profile);
    } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
