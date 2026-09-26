// Run with Playwright installed: node tests/chat-command-forwarding.test.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createDemoServer } = require('./serve-chat-security-demo.cjs');

(async () => {
  const { server, baseUrl } = await createDemoServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl + '/__chat-security/relay.html');
    await page.evaluate(() => {
      settings.forwardcommands2kick = true;
      window.__forwarded = [];
      window.sendMessageToTabs = msg => __forwarded.push(msg);
      window.checkExactDuplicateAlreadyRelayed = () => false;
      window.__parses = 0;
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      Object.defineProperty(Element.prototype, 'innerHTML', { ...descriptor, set(value) {
        if (String(value).includes('!test')) __parses++;
        return descriptor.set.call(this, value);
      } });
    });
    const fixtures = [
      { textonly: true, body: '!test <hello> &amp; café 👋', expected: '!test <hello> &amp; café 👋' },
      { textonly: false, body: '!test <i>reply</i> &lt;hello&gt; &amp;amp; café 👋', expected: '!test reply <hello> &amp; café 👋' },
      { body: '!test <b>legacy</b> &amp; hello', expected: '!test legacy & hello' },
      { textonly: true, body: '!test #tag @user a.bc a.b', expected: '!test tag user a bc a.b' },
      { textonly: false, body: '!test #tag @user a.bc a.b', expected: '!test tag user a bc a.b' },
      { textonly: false, body: '!test <img src=x onerror="window.__probeHits++">safe<script>bad()</script>', expected: '!test safe' }
    ];
    for (const fixture of fixtures) {
      const result = await page.evaluate(async fixture => {
        __forwarded.length = 0; __parses = 0;
        const data = { id: 'command-fixture', type: 'twitch', chatname: 'Viewer', tid: 7, chatmessage: fixture.body };
        if ('textonly' in fixture) data.textonly = fixture.textonly;
        await applyBotActions(data, { id: 7, url: 'https://example.invalid/fixture' });
        return { sent: __forwarded, parses: __parses, body: data.chatmessage, hits: __probeHits };
      }, fixture);
      assert.equal(result.sent.length, 1, 'Command must actually be forwarded');
      assert.equal(result.sent[0].destination, 'kick');
      assert.equal(result.sent[0].response, fixture.expected);
      assert.equal(result.body, fixture.body, 'Forwarding must not mutate the captured message');
      assert.equal(result.hits, 0);
      assert.equal(result.parses, fixture.textonly ? 0 : 1, 'Only HTML commands need one conversion');
      console.log('PASS forwarding ' + fixture.textonly + ': ' + fixture.expected);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
