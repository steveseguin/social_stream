#!/usr/bin/env node
// Validates the human-facing demo, including safe controls, not just a sink helper.
// All formerly vulnerable configurations must now stay safe in both capture modes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createDemoServer } = require('./serve-chat-security-demo.cjs');

(async () => {
  const { server, baseUrl } = await createDemoServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await page.goto(baseUrl + '/tests/chat-security-demo.html');
    await page.getByRole('button', { name: 'Run all 8 comparisons' }).click();
    await page.waitForFunction(() => window.demoError || window.demoResults.length === 8, null, { timeout: 120000 });
    const { results, error } = await page.evaluate(() => ({ results: window.demoResults, error: window.demoError }));
    assert.equal(error, null, error || 'Demo must not report an error');
    assert.equal(results.length, 8);
    for (const result of results) {
      const label = result.target + ' textonly=' + result.textonly;
      assert.equal(result.source.hits, 0, label + ': source must not execute');
      assert.equal(result.source.hitsAfterDelivery, 0, label + ': source must stay safe after its acknowledgement callback');
      assert.equal(result.relay.hits, 0, label + ': relay must not execute');
      assert.equal(result.source.payload.textonly, result.textonly, label);
      assert.equal(result.relay.payload.textonly, result.textonly, label);
      assert.equal(result.source.payload.chatmessage, result.relay.payload.chatmessage, label + ': no synthetic replacement after capture');
      assert.ok(result.source.sourceHTML.includes('&lt;img'), label + ': source DOM must contain escaped literal text');
      assert.equal(result.relay.sanitizerCalls, result.textonly ? 0 : 1, label + ': actual body sanitizer calls');
      assert.equal(result.receiver.rendered, true, label);
      assert.equal(result.receiver.hits, 0, label + ': receiver must not execute viewer text');
      assert.ok(!result.receiver.parses.some(parse => parse.rawProbe), label + ': literal probe must not be parsed as HTML');
      if (result.target.includes('tts')) {
        assert.ok(result.receiver.spoken.length, label + ': real TTS processing must complete');
        assert.ok(result.receiver.spoken.join(' ').includes('SSN LOCAL PROBE'), label + ': speech must retain the message');
      }
      console.log('PASS ' + label + ': rendered safely');
    }
    if (process.env.SSN_DEMO_SCREENSHOT) await page.screenshot({ path: process.env.SSN_DEMO_SCREENSHOT, fullPage: true });
    console.log('PASS: all 8 source-to-receiver comparisons render safely.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
