#!/usr/bin/env node
// Exercise production consumers, preserving literal text and avoiding repeated parsing.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { createDemoServer } = require('./serve-chat-security-demo.cjs');
const { configureContext, installRelay, deliver } = require('./helpers/chat-security-harness.cjs');

(async () => {
  const server = await createStaticServer();
  let browser;
  let demo;
  let checks = 0;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await configureContext(context, server.baseUrl);
    const page = await context.newPage();
    await page.goto(server.baseUrl + '/dock.html?session=LOCAL_SECONDARY_TEST');
    const cases = await page.evaluate(() => {
      const results = [];
      window.__counts = { cohost: 0, tts: 0 };
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      Object.defineProperty(Element.prototype, 'innerHTML', {
        ...descriptor,
        set(value) {
          const stack = new Error().stack;
          if (stack.includes('cohostHtmlToText')) window.__counts.cohost++;
          if (stack.includes('TTS.speechMeta')) window.__counts.tts++;
          return descriptor.set.call(this, value);
        }
      });
      const literal = 'Literal <b>text</b> &lt;i&gt; & café';
      const encode = value => {
        const node = document.createElement('span');
        node.textContent = value;
        return node.innerHTML;
      };
      // Only peer availability and outbound I/O are mocked; action processing is real.
      window.getCohostPeerSummary = () => ({ overlay: true, extension: true });
      window.sendCohostOverlayData = data => { window.__outgoing.push(data); return true; };
      window.send2Extension = data => window.__outgoing.push(data);
      for (const textonly of [true, false, undefined]) {
        for (const action of ['CohostRead', 'CohostAnswer', 'CohostRoast']) {
          window.__outgoing = [];
          window.__counts.cohost = 0;
          const row = document.createElement('div');
          row.dataset.sourceType = 'twitch';
          row.rawContents = {
            chatname: 'Viewer', chatmessage: textonly ? literal : encode(literal), textonly, type: 'twitch'
          };
          handleCohostMenuAction(action, row);
          const out = window.__outgoing[0];
          results.push({
            name: action + ' textonly=' + textonly,
            pass: !!out && (action === 'CohostRead' ? out.meta.text === literal : out.value.endsWith('Message: ' + literal)) &&
              window.__counts.cohost === (textonly ? 0 : 1),
            outgoing: out, parses: window.__counts.cohost
          });
        }
      }
      window.__outgoing = [];
      window.__counts.cohost = 0;
      const row = document.createElement('div');
      const body = document.createElement('span');
      body.className = 'hl-content';
      body.textContent = literal;
      row.appendChild(body);
      const name = document.createElement('span');
      name.className = 'hl-name';
      name.textContent = '<Viewer> &lt;Name&gt;';
      row.appendChild(name);
      handleCohostMenuAction('CohostRead', row);
      results.push({
        name: 'DOM fallback uses existing text without reparsing',
        pass: window.__outgoing[0].meta.text === literal && window.__outgoing[0].meta.name === name.textContent &&
          window.__counts.cohost === 0
      });
      window.__outgoing = [];
      window.__counts.cohost = 0;
      cohostLLMPending['offline-answer'] = { mode: 'answer', element: row, text: '', timeoutId: null };
      handleCohostLLMResponse({ target: 'offline-answer', value: '<b>Helpful</b> &amp; &lt;literal&gt;' });
      const approved = document.getElementById('cohostApprovalText').textContent;
      speakCohostApproval();
      results.push({
        name: 'AI approval text is sent exactly as previewed',
        pass: approved === 'Helpful & <literal>' && window.__outgoing[0].meta.text === approved && window.__counts.cohost === 1
      });
      TTS.ttsSpeakChatname = false;
      TTS.speak = text => window.__spoken.push(text);
      const voiceCases = [
        { name: 'plain literal', data: { chatmessage: literal, textonly: true }, expected: literal, parses: 0 },
        { name: 'textContent fallback', data: { textContent: literal }, expected: literal, parses: 0 },
        { name: 'simple legacy message', data: { chatmessage: 'Hello café' }, expected: 'Hello café', parses: 0 },
        { name: 'escaped literal', data: { chatmessage: encode(literal), textonly: false }, expected: literal, parses: 1 },
        {
          name: 'rich media removal',
          data: { chatmessage: '<b>Hello café</b> <img src="data:image/png;base64,broken" alt="wave"> &amp; friend', textonly: false },
          expected: 'Hello café & friend', parses: 1
        }
      ];
      for (const item of voiceCases) {
        window.__spoken = [];
        window.__counts.tts = 0;
        TTS.speechMeta({ ...item.data, id: 'voice-case', type: 'twitch', chatname: '' }, true);
        results.push({
          name: 'TTS ' + item.name,
          pass: window.__spoken.length === 1 && window.__spoken[0] === 'Someone says: ' + item.expected &&
            window.__counts.tts === item.parses,
          spoken: window.__spoken, parses: window.__counts.tts
        });
      }
      return results;
    });
    for (const test of cases) {
      assert.equal(test.pass, true, JSON.stringify(test));
      console.log('PASS ' + test.name);
      checks++;
    }

    const relayPage = await context.newPage();
    const relay = await installRelay(relayPage);
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const scenarios = [
      { name: 'plain', query: 'normalize', textonly: true, body: 'Café <b>literal</b> &lt;i&gt; 👋', expected: 'Cafe <b>literal</b> &lt;i&gt; 👋', parses: 0 },
      { name: 'trimmed plain', query: 'normalize&trim=8', textonly: true, body: 'Café longer message', expected: 'Cafe lon...', parses: 0 },
      { name: 'rich attributes', query: 'normalize', textonly: false, body: '<b>Café</b> <img class="emote" src="' + pixel + '" alt="café">', expected: 'Cafe ', parses: 1 },
      { name: 'stripped HTML', query: 'normalize&striphtml', textonly: false, body: '<b>Café</b> &amp; tea', expected: 'Cafe & tea', parses: 0 },
      { name: 'normalization disabled', query: '', textonly: true, body: 'Café <b>literal</b>', expected: 'Café <b>literal</b>', parses: 0 }
    ];
    for (const item of scenarios) {
      await page.goto(server.baseUrl + '/dock.html?session=LOCAL_SECONDARY_TEST&' + item.query);
      await page.evaluate(() => {
        window.__normalizeParses = 0;
        const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
          ...descriptor,
          set(value) {
            if (new Error().stack.includes('normalizeText')) window.__normalizeParses++;
            return descriptor.set.call(this, value);
          }
        });
      });
      const { payload } = await relay({ id: 443, type: 'twitch', chatname: 'Viewer', chatmessage: item.body, textonly: item.textonly });
      await deliver(page, payload);
      await page.locator('#content_443').waitFor();
      const result = await page.evaluate(() => ({
        text: document.getElementById('content_443').textContent,
        parses: window.__normalizeParses,
        alt: document.querySelector('#content_443 img')?.alt,
        raw: document.getElementById('msg_443').rawContents.chatmessage
      }));
      assert.equal(result.text, item.expected, item.name);
      assert.equal(result.parses, item.parses, item.name + ' parsing');
      if (item.name === 'rich attributes') assert.equal(result.alt, 'café', 'Normalization must leave emote attributes alone');
      if (item.textonly) assert.equal(result.raw, item.body, 'Display normalization must not overwrite original source text');
      console.log('PASS Dock ' + item.name);
      checks++;
    }

    // Exercise the normalization setting before the relay sanitizer, through the real bot-action chain.
    demo = await createDemoServer();
    for (const textonly of [true, false]) {
      const relayPage = await browser.newPage();
      await relayPage.goto(demo.baseUrl + '/__chat-security/relay.html');
      const result = await relayPage.evaluate(async textonly => {
        settings.normalizeText = true;
        const body = textonly ? 'Café <img src="data:image/png;base64,broken" onerror="window.__probeHits++">' :
          '<b>Café</b> <img src="https://test.invalid/é.png" alt="café">';
        await processIncomingMessage({ id: 778, type: 'twitch', chatname: 'Viewer', chatmessage: body, textonly },
          { tab: { id: 101, url: 'https://www.twitch.tv/audit' } });
        await new Promise(resolve => setTimeout(resolve, 100));
        return { wire: window.__demoWire, hits: window.__probeHits };
      }, textonly);
      assert.ok(result.wire, 'Message must reach the outbound relay');
      assert.equal(result.hits, 0, 'Normalization must not execute literal text');
      assert.equal(result.wire.textonly, textonly);
      if (textonly) {
        assert.equal(result.wire.chatmessage, 'Cafe <img src="data:image/png;base64,broken" onerror="window.__probeHits++">');
      } else {
        assert.ok(result.wire.chatmessage.includes('<b>Cafe</b>'), 'Rich text must stay formatted');
        assert.ok(result.wire.chatmessage.includes('alt="café"'), 'Attribute accents must remain intact');
        assert.ok(result.wire.chatmessage.includes('%C3%A9.png'), 'Image URL must retain its accented filename');
      }
      console.log('PASS background normalization textonly=' + textonly);
      checks++;
      await relayPage.close();
    }
    console.log(checks + ' secondary-processing checks passed');
  } finally {
    if (browser) await browser.close();
    if (demo) await closeServer(demo.server);
    await closeServer(server.server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
