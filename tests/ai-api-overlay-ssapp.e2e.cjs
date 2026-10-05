'use strict';

// Real SSApp/background and bot renderer; local API, provider and bridge fixtures.
// No public relay, paid AI service, or live channel is used.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const { WebSocketServer } = require(path.join(ssapp, 'node_modules/ws'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-api-bot-'));
  const requests = [], packets = [];
  let failNextRequest = false;
  let relay, app;
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.end();
    if (req.url === '/bridge') {
      res.setHeader('Content-Type', 'text/html');
      return res.end(`<script>const ws=new WebSocket('ws://127.0.0.1:${relay.address().port}');window.addEventListener('message',e=>{if(e.data.sendData)ws.send(JSON.stringify({fixturePacket:e.data.sendData.overlayNinja}));});</script>`);
    }
    let body = '';
    req.on('data', data => { body += data; });
    req.on('end', () => {
      requests.push({ url: req.url, body: JSON.parse(body || '{}') });
      if (failNextRequest) {
        failNextRequest = false;
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: 'Deliberate provider failure' }));
      }
      res.setHeader('Content-Type', 'application/x-ndjson');
      // Delay allows the concurrent-request limiter to be exercised.
      setTimeout(() => res.end(JSON.stringify({ response: 'Fixture reply number ' + requests.length, done: true }) + '\n'), 150);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  relay = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => relay.once('listening', resolve));
  relay.on('connection', socket => socket.on('message', raw => {
    const data = JSON.parse(raw);
    if (data.join) socket.channel = data.in;
    if (data.fixturePacket) {
      packets.push(data.fixturePacket);
      for (const peer of relay.clients) if (peer.channel === 12) peer.send(JSON.stringify(data.fixturePacket));
    }
  }));
  const endpoint = 'http://127.0.0.1:' + server.address().port;
  fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'api_bot_fixture', password: 'false', state: false, settings: {}, wsServer: false }));
  const wrapper = path.join(profile, 'bootstrap.cjs');
  fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:new URL(d.url).hostname!=='127.0.0.1'})));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
  try {
    app = await _electron.launch({ executablePath: require(path.join(ssapp, 'node_modules/electron')), cwd: ssapp,
      args: [wrapper, '--running-from-source', '--multiinstance', '--filesource', pathToFileURL(root + path.sep).href, '--no-hwa'],
      env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
    const main = await app.firstWindow();
    await main.waitForFunction(() => typeof document.getElementById('frame2')?.contentWindow?.processMessageWithOllama === 'function', null, { timeout: 60000 });
    const bg = main.frames().find(frame => frame.url().includes('background.html'));
    assert(bg, 'Actual background frame exists');
    // Let the app's asynchronous saved-settings initialization finish first.
    await delay(6000);
    await bg.evaluate(async ({ endpoint, port }) => {
      settings = { aiChatbotEnabled: true, ollamaoverlayonly: true, aiProvider: { optionsetting: 'ollama' },
        ollamaendpoint: { textsetting: endpoint }, ollamamodel: { textsetting: 'fixture' },
        alwaysRespondLLM: true, nollmcontext: true, ollamatts: true };
      isExtensionOn = true;
      window.__platformCalls = [];
      const originalSend = sendMessageToTabs;
      sendMessageToTabs = function (data, ...args) { window.__platformCalls.push(data); return originalSend(data, ...args); };
      if (ninjaBridge) { try { ninjaBridge.destroy?.(); } catch (_) {} }
      ninjaBridge = null;
      iframe = document.createElement('iframe');
      const loaded = new Promise(resolve => iframe.onload = resolve);
      iframe.src = endpoint + '/bridge';
      document.body.appendChild(iframe);
      await loaded;
      connectedPeers = { fixture: 'bot' };
      serverURL = 'ws://127.0.0.1:' + port;
      settings.socketserver = true;
      setupSocket();
    }, { endpoint, port: relay.address().port });
    const created = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: true, width: 900, height: 650, webPreferences: { backgroundThrottling: false } }).loadURL(url),
      pathToFileURL(path.join(root, 'bot.html')).href + '?session=api_bot_fixture&server&localserver&localserverport=' + relay.address().port);
    const bot = await created;
    await bot.waitForLoadState('domcontentloaded');
    await delay(1500);
    const send = async (message, fields = {}) => {
      const payload = { action: 'extContent', value: JSON.stringify({ chatname: 'Fixture User', chatmessage: message, type: 'generic', ...fields }) };
      const api = [...relay.clients].find(peer => peer.channel === 1);
      assert(api, 'Real API WebSocket joined channel 1');
      api.send(JSON.stringify(payload));
      await delay(700);
    };
    // Prove the old guard rejects the same API request, then restore the patched function.
    await bg.evaluate(() => {
      window.__patchedBot = processMessageWithOllama;
      const patched = processMessageWithOllama;
      processMessageWithOllama = function (data, ...args) { if (!data.tid) return; return patched(data, ...args); };
    });
    await send('Explain the weather today');
    assert.equal(requests.length, 0, 'Original guard skips source-less API input');
    await bg.evaluate(() => { processMessageWithOllama = window.__patchedBot; });
    await send('Describe the mountain scenery');
    assert.equal(requests.length, 1);
    await bot.waitForFunction(() => document.body.innerText.includes('Fixture reply number 1'));
    assert.equal(packets.length, 1);
    assert.equal(packets[0].tts, true, 'Read-aloud request survives routing');
    assert.equal(await bg.evaluate(() => window.__platformCalls.length), 0);
    console.log('PASS original rejection, API -> provider HTTP -> bot overlay rendering, TTS flag, no platform send');
    for (const fields of [{ bot: true }, { chatbotReflection: true }, { reflection: true }]) await send('Should be ignored entirely', fields);
    assert.equal(requests.length, 1, 'Bot/reflection protections remain active');
    await bg.evaluate(() => { settings.bottriggerwords = { textsetting: '!fixture' }; });
    await send('No matching trigger in this sentence');
    assert.equal(requests.length, 1);
    await bg.evaluate(() => { delete settings.bottriggerwords; settings.modLLMonly = true; });
    await send('Unprivileged request');
    assert.equal(requests.length, 1);
    await bg.evaluate(() => { delete settings.modLLMonly; settings.ollamaoverlayonly = false; settings.botreplyaccountroles = { textsetting: 'bot' }; });
    for (const tid of [undefined, null, false, 0, '']) await send('No platform target', { tid });
    assert.equal(requests.length, 1);
    assert.equal(await bg.evaluate(() => window.__platformCalls.length), 0, 'No target cannot reach account-role routing');
    console.log('PASS bot/reflection, trigger, moderator and missing-target protections');
    await bg.evaluate(() => { delete settings.botreplyaccountroles; settings.ollamaRateLimitPerTab = { numbersetting: 60000 }; });
    await send('Describe the planets orbiting the sun', { tid: 990001 });
    assert.equal(requests.length, 2);
    assert.equal(await bg.evaluate(() => window.__platformCalls[0].tid), 990001);
    await send('Describe a completely different topic', { tid: 990001 });
    assert.equal(requests.length, 2, 'Existing per-source rate limit remains active');
    await bg.evaluate(() => { settings.ollamaoverlayonly = true; });
    await send('Explain the history of railways');
    assert.equal(requests.length, 3);
    await bot.waitForFunction(() => document.body.innerText.includes('Fixture reply number 3'));
    assert.equal(await bg.evaluate(() => window.__platformCalls.length), 1);
    await Promise.all([send('Tell us about alpine forests'), send('Tell us about the ocean floor')]);
    assert.equal(requests.length, 4, 'Concurrent API messages still obey the response-slot limit');
    await delay(5000);
    assert.equal(requests.length, 4, 'No autonomous reply loop');
    assert.equal(await bg.evaluate(() => activeBotResponseCount), 0, 'Response slots released');
    await bot.screenshot({ path: path.join(profile, 'bot-overlay.png') });
    console.log('PASS existing target and rate-limit behavior, repeated API replies, concurrency limit, no reply loop');
    let before = requests.length;
    await bg.evaluate(() => { settings.aiChatbotEnabled = false; });
    await send('The disabled bot must stay quiet');
    assert.equal(requests.length, before);
    await bg.evaluate(() => { settings.aiChatbotEnabled = true; });
    await send('');
    await send('   ');
    assert.equal(requests.length, before, 'Empty API messages do not consume AI requests');
    failNextRequest = true;
    await send('Exercise a failed provider call');
    assert.equal(await bg.evaluate(() => activeBotResponseCount), 0);
    const afterFailure = requests.length;
    await send('Recover with a fresh successful request');
    assert.equal(requests.length, afterFailure + 1);
    await bot.waitForFunction(text => document.body.innerText.includes(text), 'Fixture reply number ' + requests.length);
    await bg.evaluate(() => {
      settings.aiOverlayFromChatBot = true;
      settings.aiOverlayTts = true;
      settings.ollamatts = false;
      window.__aiOverlayCommands = [];
      const original = sendAiOverlayCommand;
      sendAiOverlayCommand = function (...args) { const result = original(...args); window.__aiOverlayCommands.push(result); return result; };
    });
    await send('Try the optional cohost overlay output');
    const aiOutput = await bg.evaluate(() => window.__aiOverlayCommands);
    assert.equal(aiOutput.length, 1);
    assert.equal(aiOutput[0].target, 'cohost-overlay');
    assert.equal(aiOutput[0].meta.tts, true);
    assert.equal(packets[packets.length - 1].tts, false, 'Regular bot TTS can be disabled independently');
    assert.equal(await bg.evaluate(() => window.__platformCalls.length), 1);
    // The flattened API intentionally has no retry deduplication. Record that cost/volume risk.
    before = requests.length;
    await send('Duplicate API input from a retry');
    await send('Duplicate API input from a retry');
    assert.equal(requests.length, before + 2, 'Sequential duplicate API calls can each generate a reply');
    console.log('PASS disabled bot, empty input, provider failure recovery, optional AI overlay routing and independent TTS flags');
    console.log('CONFIRMED risk: sequential API retries can generate duplicate AI replies in overlay-only mode');
    await bg.evaluate(() => new Promise(resolve => {
      settings.socketserver = false;
      chrome.storage.local.set({ settings }, resolve);
    }));
    await bg.goto(bg.url());
    await bg.waitForFunction(() => typeof processMessageWithOllama === 'function' && settings.ollamaoverlayonly === true, null, { timeout: 30000 });
    assert.equal(await bg.evaluate(() => settings.aiChatbotEnabled), true);
    console.log('PASS overlay-only and AI enable settings survive background reload');
    console.log('Artifacts: ' + profile);
  } finally {
    if (app) await app.close();
    for (const socket of relay.clients) socket.terminate();
    await new Promise(resolve => relay.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
