const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

(async () => {
  const server = await startStaticServer({ root: process.cwd(), port: 4250 });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
    const external = [];
    await context.route('**/*', route => {
      const url = route.request().url();
      if (!url.startsWith('http://127.0.0.1:4250/')) { external.push(url); return route.abort(); }
      if (url.endsWith('/lite/plugins/kickPlugin.js')) {
        // Replace only the provider connection boundary; keep actual mounting,
        // settings, auto-connect, publish, rendering, and transport selection.
        return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('lite/plugins/kickPlugin.js', 'utf8') + `
          KickPlugin.prototype.enable = function() {
            window.fixtureStarts = (window.fixtureStarts || 0) + 1;
            this.setState('connected');
            this.publish({ id: 'kick-fixture', type: 'kick', chatname: 'OBS fixture', chatmessage: 'Captured inside this source', textonly: true });
            window.fixtureDelete = () => this.messenger.sendDelete({ type: 'kick', id: 'kick-fixture' });
          };` });
      }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4250/lite/index.html?view=overlay');
    await page.locator('#overlay-show').waitFor();
    assert.equal(await page.locator('#session').isVisible(), false);
    await page.getByRole('button', { name: 'Kick options', exact: true }).click();
    await page.locator('[data-obs-kick-auto]').check();
    await page.evaluate(() => localStorage.setItem('ssn-lite::kick.channel', JSON.stringify('fixture')));
    await page.locator('[data-plugin-id="kick"]').getByRole('button', { name: 'Connect', exact: true }).click();
    assert.equal(await page.getByText('Captured inside this source', { exact: true }).count(), 1);
    await page.locator('#overlay-show').click();
    assert.equal(await page.locator('#sources').isVisible(), false);
    assert.equal(await page.locator('#overlay-setup-bar').isVisible(), false);
    assert.equal(await page.locator('#activity .card__header').isVisible(), false);
    assert.equal(await page.locator('#dock-relay').getAttribute('src'), null);
    assert.deepEqual(external, [], 'Standalone capture must not create a relay or need a separate page');
    await page.reload();
    await page.getByText('Captured inside this source', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.fixtureStarts), 1);
    assert.equal(await page.locator('#overlay-setup-bar').isVisible(), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#overlay-setup-bar').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#overlay-setup-bar').isVisible(), false);
    await page.evaluate(() => window.fixtureDelete());
    assert.equal(await page.getByText('Captured inside this source', { exact: true }).count(), 0);
    await page.evaluate(() => localStorage.setItem('ssn-lite::obs.kickAutoConnect', 'false'));
    await page.reload();
    await page.locator('[data-plugin-id="kick"]').waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => window.fixtureStarts || 0), 0);
    await page.keyboard.press('Escape');
    await page.locator('#overlay-test').click();
    await page.locator('#overlay-show').click();
    fs.mkdirSync('artifacts/lite-review', { recursive: true });
    await page.screenshot({ path: 'artifacts/lite-review/standalone.png', omitBackground: true });

    // A callback restores the view without changing the registered redirect URL.
    await page.goto('http://127.0.0.1:4250/lite/index.html?code=fixture&state=unknown:fixture');
    await page.waitForFunction(() => document.body.classList.contains('standalone-overlay'));
    assert.equal(new URL(page.url()).searchParams.get('view'), 'overlay');
    await page.goto('http://127.0.0.1:4250/lite/index.html?view=dock');
    await page.getByRole('button', { name: 'Kick options', exact: true }).click();
    assert.equal(await page.locator('[data-plugin-id="kick"] .source-card__settings').isVisible(), true);
    await page.locator('#session-options-toggle').click();
    assert.equal(await page.locator('#session-id').isVisible(), true);
    assert.equal(new URL(await page.locator('#obs-overlay-url').inputValue()).searchParams.get('view'), 'overlay');
    assert.ok(await page.locator('#dock-relay').getAttribute('src'), 'Dock retains the existing relay');
    assert.deepEqual(errors, []);
    console.log('OBS modes: independent capture/display, no standalone relay, deduplication, deletion, reload, opt-in reconnect, Escape setup, OAuth return and dock settings pass');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
