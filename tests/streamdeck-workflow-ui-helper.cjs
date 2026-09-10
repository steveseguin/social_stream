'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
module.exports = async function (app, bundle, output, capabilities, triggers) {
    const created = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow }) => {
        global.workflowGuideWindow = new BrowserWindow({ show: false, width: 1020, height: 900, webPreferences: { backgroundThrottling: false, offscreen: true } });
        return global.workflowGuideWindow.loadURL('about:blank');
    });
    const page = await created;
    async function screenshot(name) {
        const size = page.viewportSize();
        if (size) await app.evaluate((_electron, size) => global.workflowGuideWindow.setContentSize(size.width, size.height), size);
        await page.waitForTimeout(200);
        const png = await app.evaluate(async () => (await global.workflowGuideWindow.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
        fs.writeFileSync(path.join(output, name), Buffer.from(png, 'base64'));
    }
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, '../docs/streamdeck-event-flow.html')).href);
    await page.setViewportSize({ width: 360, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Public workflow guide fits narrow viewport');
    await screenshot('public-workflow-guide-narrow.png');
    assert.equal(await page.locator('#palette details').count(), 19);
    await page.setViewportSize({ width: 1020, height: 900 });
    await page.goto(pathToFileURL(path.join(bundle, 'ui/guide.html')).href);
    await page.locator('img').evaluateAll(images => images.forEach(image => image.loading = 'eager'));
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    assert.equal(await page.locator('.catalog tbody tr').count(), 77);
    assert.equal(await page.evaluate(() => [...document.images].filter(image => !image.naturalWidth).length), 0, 'All guide icons load');
    for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme });
        await page.locator('#timer').scrollIntoViewIfNeeded();
        await screenshot('guide-timer-' + colorScheme + '.png');
    }
    await page.setViewportSize({ width: 360, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Guide fits narrow viewport');
    await page.locator('#workflow').scrollIntoViewIfNeeded();
    await screenshot('guide-workflow-narrow.png');
    // The real shipped property-inspector HTML, rendered inside hidden Electron.
    await page.goto(pathToFileURL(path.join(bundle, 'ui/action-settings.html')).href);
    await page.evaluate(({ capabilities, triggers }) => {
        actionUuid = 'ninja.socialstream.streamdeck.command';
        actionSettings = { command: 'triggerWorkflow', value: JSON.stringify({ trigger: triggers[0].trigger, flowId: triggers[0].flowId, data: { label: 'preserved' } }) };
        setLocale('en');
        handlePluginMessage({ type: 'capabilities', capabilities });
        handlePluginMessage({ type: 'workflows', result: { ok: true, payload: { triggers } } });
    }, { capabilities, triggers });
    assert.equal(await page.locator('#workflowTrigger option').count(), triggers.length + 1);
    assert((await page.locator('#workflowTrigger').inputValue()).includes(triggers[0].flowId));
    const saved = await page.locator('#value').inputValue();
    await page.evaluate(() => handlePluginMessage({ type: 'workflows', result: { ok: true, payload: { triggers: [] } } }));
    assert.equal(await page.locator('#value').inputValue(), saved, 'Unavailable workflow retains its stored target and data');
    assert((await page.locator('#workflowStatus').innerText()).includes('preserved'));
    await page.evaluate(triggers => handlePluginMessage({ type: 'workflows', result: { ok: true, payload: { triggers } } }), triggers);
    await page.locator('#workflowTrigger').selectOption({ index: 1 });
    assert.equal(JSON.parse(await page.locator('#value').inputValue()).data.label, 'preserved');
    for (const locale of ['en', 'de', 'es', 'fr', 'ja', 'ko', 'zh_CN', 'zh_TW']) {
        await page.evaluate(locale => { setLocale(locale); renderActionSettings(); }, locale);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), locale + ' property inspector width');
    }
    await page.evaluate(() => { setLocale('en'); renderActionSettings(); });
    for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme });
        await page.locator('#workflowControls').scrollIntoViewIfNeeded();
        await screenshot('workflow-picker-' + colorScheme + '.png');
    }
    assert.deepEqual(errors, [], 'Guide and inspector have no script errors');
    fs.writeFileSync(path.join(output, 'ui-result.json'), JSON.stringify({ icons: 77, locales: 8, themes: 2, width: 360, preserved: true }));
    console.log('PASS guide icons, narrow/light/dark layouts, workflow picker, unavailable selection/data persistence and eight inspector locales');
    await page.close();
};
