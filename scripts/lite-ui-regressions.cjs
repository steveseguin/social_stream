const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

(async () => {
  const server = await startStaticServer({ root: process.cwd(), port: 4249 });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.route('**/*', route => {
      if (route.request().url().startsWith('http://127.0.0.1:4249/')) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4249/lite/index.html');
    await page.locator('.source-card').nth(3).waitFor({ state: 'attached' });
    assert.equal(await page.locator('.source-card').count(), 4);
    assert.equal(await page.locator('#quick-start').getAttribute('open'), '');
    assert.equal(await page.locator('.source-options:visible').count(), 3);
    assert.equal(await page.locator('[data-plugin-id="tiktok"]').isVisible(), false);
    await page.getByRole('button', { name: 'YouTube options', exact: true }).click();
    assert.equal(await page.getByLabel('Live Chat ID or Video ID (optional)', { exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'YouTube options', exact: true }).click();
    await page.getByRole('button', { name: 'Twitch options', exact: true }).click();
    assert.equal(await page.getByLabel('Channel (optional)', { exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Twitch options', exact: true }).click();
    const initial = new URL(await page.locator('#session-url').inputValue());
    assert.ok(initial.searchParams.get('session'));
    assert.equal(await page.locator('#session-open').getAttribute('href'), initial.href);
    await page.locator('#session-options-toggle').click();
    await page.locator('#session-id').fill('fixture-session');
    await page.locator('#session-id').blur();
    assert.equal(await page.locator('#session-url').inputValue(), initial.href, 'Blur must not switch an active session');
    await page.locator('#session-apply').click();
    assert.equal(new URL(await page.locator('#session-url').inputValue()).searchParams.get('session'), 'fixture-session');
    await page.locator('#session-opt-transparent').check();
    const updated = new URL(await page.locator('#session-url').inputValue());
    assert.ok(updated.searchParams.has('transparent'));
    assert.ok(updated.searchParams.has('compact'));
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
    await page.locator('#session-copy').click();
    await page.waitForFunction(() => document.activeElement.id === 'session-url');
    assert.equal(await page.locator('#session-url').evaluate(el => el.selectionEnd - el.selectionStart), updated.href.length);
    await page.locator('#session-test').click();
    assert.match(await page.locator('#session-status').textContent(), /Check|check/);
    await page.locator('#quick-start summary').click();
    await page.waitForFunction(() => localStorage.getItem('ssn-lite::guide.quickStartOpen') === 'false');
    await page.reload();
    await page.locator('.source-card').nth(3).waitFor({ state: 'attached' });
    assert.equal(await page.locator('#quick-start').getAttribute('open'), null);
    assert.equal(new URL(await page.locator('#session-url').inputValue()).searchParams.get('session'), 'fixture-session');

    await page.locator('#activity-filter-donations').check();
    assert.match(await page.locator('.activity-empty').textContent(), /Turn off Donations only/);
    await page.locator('#activity-filter-donations').uncheck();
    await page.locator('#quick-start summary').click();
    // Exercise actual mounted provider controls without authorizing or contacting a provider.
    const reconnect = await page.evaluate(async () => {
      const { YoutubePlugin } = await import('/lite/plugins/youtubePlugin.js');
      const { TwitchPlugin } = await import('/lite/plugins/twitchPlugin.js');
      const results = [];
      for (const Plugin of [YoutubePlugin, TwitchPlugin]) {
        const host = document.createElement('div');
        document.body.append(host);
        const plugin = new Plugin({ messenger: { getSessionId: () => 'fixture' } });
        plugin.mount(host);
        const signedOutHidden = plugin.connectBtn.hidden;
        plugin.token = { accessToken: 'fixture', expiresAt: Date.now() + 60000 };
        plugin.setState('connected');
        plugin.handleDisconnect();
        const reconnectVisible = !plugin.connectBtn.hidden && !plugin.connectBtn.disabled;
        let attempts = 0;
        plugin.enable = () => { attempts++; plugin.setState('connected'); };
        plugin.connectBtn.click();
        results.push({ signedOutHidden, reconnectVisible, attempts, connected: plugin.state === 'connected' });
        plugin.handleDisconnect();
        host.remove();
      }
      return results;
    });
    for (const result of reconnect) assert.deepEqual(result, { signedOutHidden: true, reconnectVisible: true, attempts: 1, connected: true });
    fs.mkdirSync('artifacts/lite-review', { recursive: true });
    await page.screenshot({ path: 'artifacts/lite-review/desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout must not overflow');
    await page.screenshot({ path: 'artifacts/lite-review/mobile.png', fullPage: true });
    await page.goto('http://127.0.0.1:4249/lite/guide.html');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Guide must fit mobile');
    assert.equal(await page.locator('h1').textContent(), 'Get chat into your overlay');
    await page.screenshot({ path: 'artifacts/lite-review/guide-mobile.png', fullPage: true });
    await page.goto('http://127.0.0.1:4249/lite/index.html?view=activity');
    await page.waitForFunction(() => document.body.classList.contains('activity-popout'));
    assert.equal(await page.locator('#session').isVisible(), false);
    assert.equal(await page.locator('.source-card').count(), 0);
    const obs = await context.newPage();
    await obs.addInitScript(() => { window.obsstudio = {}; });
    await obs.goto('http://127.0.0.1:4249/lite/index.html');
    await obs.locator('.source-card').nth(3).waitFor({ state: 'attached' });
    assert.equal(await obs.locator('#quick-start').isVisible(), false);
    assert.equal(await obs.locator('#session-test').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('Lite UI: onboarding, session save, URL options, clipboard fallback, reconnect, mobile, guide, popout and OBS layout pass');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
