#!/usr/bin/env node
// Real Twitch capture -> production relay -> real Dock action handler, with offline outbound I/O.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, captureTwitch, installRelay, deliver } = require('./helpers/chat-security-harness.cjs');
const probe = 'DOCK_ACTION_PROBE <img src="data:image/png;base64,broken" onerror="window.__securityExecuted=true">';

(async () => {
  const server = await createStaticServer();
  let browser;
  let checks = 0;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);
    const relayPage = await context.newPage();
    const relay = await installRelay(relayPage);
    for (const textonly of [true, false]) {
      const [captured] = await captureTwitch(context, textonly, [probe]);
      assert.ok(captured, 'Actual source must capture the message');
      const { payload } = await relay({ ...captured, id: 9871 });
      assert.equal(payload.textonly, textonly);
      assert.equal(payload.chatmessage, textonly ? probe : captured.chatmessage);
      if (!textonly) assert.ok(payload.chatmessage.includes('&lt;img'));
      for (const action of ['CohostRead', 'CohostAnswer', 'CohostRoast', 'TTS']) {
        const page = await context.newPage();
        try {
          await page.goto(server.baseUrl + '/dock.html?session=LOCAL_ACTION_TEST');
          await deliver(page, payload);
          await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-mid]')).some(e => e.rawContents?.id === 9871));
          await page.waitForTimeout(120);
          assert.equal(await page.evaluate(() => window.__securityExecuted), false, 'Default renderer must be safe');
          const prepared = await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll('[data-mid]')).find(e => e.rawContents?.id === 9871);
            return { body: row.rawContents.chatmessage, textonly: row.rawContents.textonly, visible: row.textContent };
          });
          assert.equal(prepared.body, payload.chatmessage);
          assert.equal(prepared.textonly, textonly);
          assert.ok(prepared.visible.includes(probe), 'Default rendering must retain literal viewer text');
          await page.evaluate(action => {
            const row = Array.from(document.querySelectorAll('[data-mid]')).find(e => e.rawContents?.id === 9871);
            // Model connected peers and capture output without sending messages or playing audio.
            window.getCohostPeerSummary = () => ({ overlay: true, extension: true });
            window.__outgoing = [];
            window.sendCohostOverlayData = data => { window.__outgoing.push(data); return true; };
            window.send2Extension = data => window.__outgoing.push(data);
            TTS.speak = text => window.__outgoing.push({ spoken: text });
            window.__parses = [];
            const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
            Object.defineProperty(Element.prototype, 'innerHTML', {
              ...descriptor,
              set(value) {
                if (String(value).includes('DOCK_ACTION_PROBE')) {
                  window.__parses.push({ raw: String(value).includes('<img'), stack: new Error().stack });
                }
                return descriptor.set.call(this, value);
              }
            });
            if (action === 'TTS') TTS.speechMeta(row.rawContents, true);
            else if (!handleCohostMenuAction(action, row)) throw Error('Action not handled');
          }, action);
          await page.waitForTimeout(250);
          const result = await page.evaluate(() => ({
            executed: window.__securityExecuted, outgoing: window.__outgoing, rawParses: window.__parses.filter(p => p.raw)
          }));
          const label = action + ' textonly=' + textonly;
          assert.ok(result.outgoing.length, label + ': action must complete through outbound I/O');
          assert.equal(result.executed, false, label + ': viewer text must not execute');
          assert.deepEqual(result.rawParses, [], label + ': literal probe must not be parsed as HTML');
          if (action === 'CohostRead') assert.equal(result.outgoing[0].meta.text, probe, label);
          else if (action === 'TTS') assert.ok(result.outgoing[0].spoken.includes('DOCK ACTION PROBE'), label);
          else assert.ok(result.outgoing[0].value.endsWith('Message: ' + probe), label);
          console.log('PASS ' + label);
          checks++;
        } finally {
          await page.close();
        }
      }
    }
    console.log(checks + ' source-to-Dock action checks passed');
  } finally {
    if (browser) await browser.close();
    await closeServer(server.server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
