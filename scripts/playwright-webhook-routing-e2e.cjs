const { chromium } = require('playwright');
const { startStaticServer } = require('./playwright-static-server.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = 4181;
const PROVIDERS = ['stripe', 'kofi', 'bmac', 'fourthwall'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function installRuntimeStubs(page) {
  await page.addInitScript(() => {
    const nativeEval = window.eval;
    Object.defineProperty(window, 'eval', {
      configurable: false,
      get: () => nativeEval,
      set: () => {}
    });

    class FakeWebSocket extends EventTarget {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        setTimeout(() => {
          this.readyState = FakeWebSocket.OPEN;
          if (typeof this.onopen === 'function') this.onopen(new Event('open'));
          this.dispatchEvent(new Event('open'));
        }, 0);
      }

      send() {}

      close() {
        this.readyState = FakeWebSocket.CLOSED;
      }
    }

    FakeWebSocket.CONNECTING = 0;
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSING = 2;
    FakeWebSocket.CLOSED = 3;
    window.WebSocket = FakeWebSocket;
    window.alert = () => {};
    window.confirm = () => true;
    HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
}

async function waitForFunction(page, functionName) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.evaluate((name) => typeof window[name] === 'function', functionName)) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`${functionName} did not initialize`);
}

async function runDockRouteCase(page, url, caseName, includeWebhookId) {
  page.on('pageerror', (error) => console.error(`${caseName} Dock error:`, error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForFunction(page, 'processInput');

  const counts = await page.evaluate(async ({ providers, includeStableId }) => {
    document.getElementById('output').innerHTML = '';
    providers.forEach((provider, index) => {
      const webhookId = `${provider}-${includeStableId ? 'stable' : 'legacy'}-${index}`;
      const messageId = 2000000 + index;
      const raw = window.__makeRawWebhook(provider, webhookId);
      const normalized = window.__makeNormalizedWebhook(provider, webhookId, messageId, includeStableId);
      window.processInput(raw);
      window.processInput(normalized);
      window.processInput(normalized);
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const output = {};
    providers.forEach((provider) => {
      output[provider] = document.querySelectorAll(`[data-source-type="${provider}"]`).length;
    });
    return output;
  }, { providers: PROVIDERS, includeStableId: includeWebhookId });

  for (const provider of PROVIDERS) {
    assert(counts[provider] === 1, `${caseName} rendered ${counts[provider]} ${provider} messages`);
  }
}

async function exposeFixtureBuilders(page) {
  await page.addInitScript(() => {
    window.__makeRawWebhook = function(provider, webhookId) {
      if (provider === 'stripe') {
        return { stripe: { id: webhookId, type: 'checkout.session.completed', data: { object: { id: `checkout-${webhookId}`, custom_fields: [{ key: 'displayname', text: { value: 'Jo Stripe' } }, { key: 'message', text: { value: 'Stripe support' } }], amount_total: 300, currency: 'usd' } } } };
      }
      if (provider === 'kofi') {
        return { kofi: { data: encodeURIComponent(JSON.stringify({ type: 'Donation', is_public: true, from_name: 'Jo Ko-fi', message: 'Ko-fi support', amount: '3.00', currency: 'USD', message_id: webhookId })) } };
      }
      if (provider === 'bmac') {
        return { bmac: { event_id: webhookId, type: 'donation.created', data: { supporter_name: 'Jo BMAC', message: 'BMAC support', support_note: '', amount: '3.00', currency: 'USD' } } };
      }
      return { fourthwall: { id: webhookId, webhookId: `configuration-${webhookId}`, type: 'ORDER_PLACED', data: { id: `order-${webhookId}`, username: 'Jo Fourthwall', message: 'Fourthwall support', amounts: { total: { value: 3, currency: 'USD' } }, offers: [] } } };
    };
    window.__makeNormalizedWebhook = function(provider, webhookId, messageId, includeWebhookId) {
      const message = { chatname: `Jo ${provider}`, chatmessage: `${provider} support`, hasDonation: '$3.00 USD', id: messageId, chatbadges: '', backgroundColor: '', textColor: '', nameColor: '', chatimg: '', membership: '', contentimg: '', textonly: false, type: provider };
      if (includeWebhookId) message.meta = { webhookId };
      return message;
    };
  });
}

async function runModernDirectFallbackCase(page, url) {
  page.on('pageerror', (error) => console.error('Modern direct fallback Dock error:', error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForFunction(page, 'processInput');

  const counts = await page.evaluate(async (providers) => {
    document.getElementById('output').innerHTML = '';
    providers.forEach((provider, index) => {
      const raw = window.__makeRawWebhook(provider, `fallback-${provider}-${index}`);
      window.processInput(raw);
      window.processInput(raw);
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const output = {};
    providers.forEach((provider) => {
      output[provider] = document.querySelectorAll(`[data-source-type="${provider}"]`).length;
    });
    return output;
  }, PROVIDERS);

  for (const provider of PROVIDERS) {
    assert(counts[provider] === 1, `modern direct fallback rendered ${counts[provider]} ${provider} messages`);
  }
}

async function runCustomRawFallbackCase(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForFunction(page, 'processInput');
  const counts = await page.evaluate((providers) => {
    const output = {};
    providers.forEach((provider, index) => {
      document.getElementById('output').innerHTML = '';
      window.processInput(window.__makeRawWebhook(provider, `custom-${provider}-${index}`));
      output[provider] = document.querySelectorAll(`[data-source-type="${provider}"]`).length;
    });
    return output;
  }, PROVIDERS);
  for (const provider of PROVIDERS) {
    assert(counts[provider] === 1, `modern non-server custom route dropped ${provider}`);
  }
}

async function runTipJarCase(page, url) {
  page.on('pageerror', (error) => console.error('Tip Jar error:', error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForFunction(page, 'processData');

  const result = await page.evaluate((providers) => {
    providers.forEach((provider, index) => {
      const message = window.__makeNormalizedWebhook(provider, `tipjar-${provider}`, 3000000 + index, true);
      window.processData(message);
      window.processData(message);
    });

    const firstDistinct = window.__makeNormalizedWebhook('kofi', 'tipjar-kofi-distinct-a', 3999999, true);
    const secondDistinct = window.__makeNormalizedWebhook('kofi', 'tipjar-kofi-distinct-b', 3999999, true);
    window.processData(firstDistinct);
    window.processData(secondDistinct);

    const firstIdless = window.__makeNormalizedWebhook('kofi', '', undefined, false);
    const secondIdless = Object.assign({}, firstIdless);
    delete firstIdless.id;
    delete secondIdless.id;
    window.processData(firstIdless);
    window.processData(secondIdless);

    return {
      recentTips: document.querySelectorAll('#recent-tips .tip-item').length,
      meterText: document.getElementById('meter-text').textContent
    };
  }, PROVIDERS);

  assert(result.recentTips === 5, `Tip Jar recent-tip cap rendered ${result.recentTips} rows instead of 5`);
  assert(/\$24(?:\.00)?\s*\/\s*\$100/.test(result.meterText), `Tip Jar total was ${result.meterText}`);
}

async function runMultiAlertsCase(page, url) {
  page.on('pageerror', (error) => console.error('Multi Alerts error:', error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__multiAlertsOverlay && window.__multiAlertsOverlay.sendPayload));

  const state = await page.evaluate(() => {
    const first = window.__makeNormalizedWebhook('kofi', 'alert-kofi-a', 5000001, true);
    const duplicate = Object.assign({}, first, { id: 5000002 });
    const distinct = window.__makeNormalizedWebhook('kofi', 'alert-kofi-b', 5000002, true);
    window.__multiAlertsOverlay.sendPayload(first);
    window.__multiAlertsOverlay.sendPayload(duplicate);
    const afterDuplicate = window.__multiAlertsOverlay.getState();
    window.__multiAlertsOverlay.sendPayload(distinct);
    const afterDistinct = window.__multiAlertsOverlay.getState();
    return { afterDuplicate, afterDistinct };
  });

  assert(state.afterDuplicate.hasAlert, 'Multi Alerts did not display the first webhook');
  assert(state.afterDuplicate.queueLength === 0, `Multi Alerts queued ${state.afterDuplicate.queueLength} duplicate webhooks`);
  assert(state.afterDistinct.queueLength === 1, 'Multi Alerts collapsed a distinct webhook ID');
}

(async () => {
  const server = await startStaticServer({ root: ROOT, host: HOST, port: PORT });
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isLocal = requestUrl.hostname === HOST || requestUrl.hostname === 'localhost';
      if ((requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:') && !isLocal) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const modernPage = await context.newPage();
    await installRuntimeStubs(modernPage);
    await exposeFixtureBuilders(modernPage);
    await runDockRouteCase(
      modernPage,
      `http://${HOST}:${PORT}/dock.html?session=testsession&v=3.50.5&server&server2&server3`,
      'modern mixed transport',
      true
    );

    const modernOldBackgroundPage = await context.newPage();
    await installRuntimeStubs(modernOldBackgroundPage);
    await exposeFixtureBuilders(modernOldBackgroundPage);
    await runDockRouteCase(
      modernOldBackgroundPage,
      `http://${HOST}:${PORT}/dock.html?session=testsession&v=3.50.5&server&server2&server3`,
      'modern Dock with old background',
      false
    );

    const modernDirectFallbackPage = await context.newPage();
    await installRuntimeStubs(modernDirectFallbackPage);
    await exposeFixtureBuilders(modernDirectFallbackPage);
    await runModernDirectFallbackCase(
      modernDirectFallbackPage,
      `http://${HOST}:${PORT}/dock.html?session=testsession&v=3.50.5&server`
    );

    const legacyPage = await context.newPage();
    await installRuntimeStubs(legacyPage);
    await exposeFixtureBuilders(legacyPage);
    await runDockRouteCase(
      legacyPage,
      `http://${HOST}:${PORT}/dock.html?session=testsession&server&server2&server3`,
      'legacy mixed transport',
      true
    );

    const customPage = await context.newPage();
    await installRuntimeStubs(customPage);
    await exposeFixtureBuilders(customPage);
    await runCustomRawFallbackCase(
      customPage,
      `http://${HOST}:${PORT}/dock.html?session=testsession&v=3.50.5`
    );

    const tipJarPage = await context.newPage();
    await installRuntimeStubs(tipJarPage);
    await exposeFixtureBuilders(tipJarPage);
    await runTipJarCase(
      tipJarPage,
      `http://${HOST}:${PORT}/tipjar.html?session=testsession&style=meter&goal=100`
    );

    const multiAlertsPage = await context.newPage();
    await installRuntimeStubs(multiAlertsPage);
    await exposeFixtureBuilders(multiAlertsPage);
    await runMultiAlertsCase(
      multiAlertsPage,
      `http://${HOST}:${PORT}/multi-alerts.html?session=testsession&preview=1&embedded=1&queue&showtime=10000`
    );

    console.log('PASS all payment webhooks render once, preserve custom fallback, and dedupe Tip Jar/Multi Alerts');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
