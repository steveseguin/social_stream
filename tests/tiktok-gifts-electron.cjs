'use strict';

// Functional Standard-mode capture and credits test in the sibling SSApp runtime.
// Run: node tests/tiktok-gifts-electron.cjs (requires SSApp dependencies installed).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const net = require('net');
const { pathToFileURL } = require('url');
const sourceRoot = path.resolve(__dirname, '..');
const appRoot = process.env.SSAPP_REPO || path.resolve(sourceRoot, '..', 'ssapp');
const { _electron } = require(path.join(appRoot, 'node_modules/playwright-core'));
const WebSocket = require(path.join(appRoot, 'node_modules/ws'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const s = net.createServer();
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}
async function until(check, label, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await check();
    if (value) return value;
    await pause(100);
  }
  throw new Error('Timed out: ' + label);
}

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<div class="live-room-container"><div id="chat"><div data-index="0"></div></div>' +
      '<div class="DivBottomStickyMessageContainer" id="events"></div></div>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fixtureUrl = `http://127.0.0.1:${server.address().port}/@gift-fixture/live`;
  const relayPort = await freePort();
  const controlPort = await freePort();
  const room = 'gift_test_' + Date.now();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-gift-compat-'));
  fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
    streamID: room, password: 'false', state: true, wsServer: true,
    settings: { server2: { setting: true }, triggermode: { optionparam13: 'background' },
      textonlymode: { setting: process.env.GIFT_TEXTONLY === '1' },
      notiktokdonations: { setting: process.env.GIFT_DONATIONS === '0' } }
  }));
  let app, socket;
  const captures = [];
  try {
    app = await _electron.launch({ executablePath: require(path.join(appRoot, 'node_modules/electron')),
      args: ['.', '--running-from-source', '--multiinstance', '--filesource', pathToFileURL(sourceRoot + path.sep).href,
        '--ssapp-headless-control', '--ssapp-control-api', `--ssapp-control-port=${controlPort}`,
        `--ssapp-local-server-port=${relayPort}`, '--no-hwa'], cwd: appRoot,
      env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' }, timeout: 60000 });
    const main = await until(() => app.windows().find(p => p.url().includes('/index.html')), 'main window');
    console.log('Main window ready');
    await main.waitForFunction(() => window.stateManager && stateManager.initialized && typeof configReady !== 'undefined' && configReady, { timeout: 60000 });
    socket = new WebSocket(`ws://127.0.0.1:${relayPort}`);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.send(JSON.stringify({ join: room, out: 3, in: 4 }));
    socket.on('message', raw => { try { const m = JSON.parse(raw); if (m.type === 'tiktok') captures.push(m); } catch (_) {} });
    await main.evaluate(async url => {
      const element = await newOtherSource('tiktok', url, false, { username: 'gift-fixture',
        sourceFile: 'sources/tiktok.js', connectionMode: 'classic', autoActivate: false, isVisible: false, isMuted: true });
      await createWindow(element.querySelector('[data-activatehtml]'));
    }, fixtureUrl);
    console.log('Source created');
    // Source windows use WebContentsView; obtain their Page through the actual app context.
    const source = await until(() => app.context().pages().find(p => p.url() === fixtureUrl), 'Standard source');
    await source.waitForFunction(() => window.chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function');
    await source.evaluate(() => {
      window.giftTestMessages = [];
      const original = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = function(...args) {
        const payload = args.length > 1 ? args[1] : args[0];
        if (payload && payload.message && payload.message.type === 'tiktok') window.giftTestMessages.push(payload.message);
        return original.apply(this, args);
      };
    });
    await pause(6500);
    console.log('Source injection ready');
    assert.strictEqual(await source.evaluate(() => typeof window.__ssnReadTikTokGift), 'function', 'TikTok native gift helper loaded through SSApp');
    const creditsUrl = pathToFileURL(path.join(sourceRoot, 'credits.html')).href +
      `?session=${room}&server2=ws://127.0.0.1:${relayPort}&loop&persistcredits&onlydonors&showamounts`;
    await app.evaluate(({ BrowserWindow }, url) => { const w = new BrowserWindow({ show: false }); w.loadURL(url); }, creditsUrl);
    const credits = await until(() => app.windows().find(p => p.url().includes('/credits.html')), 'credits overlay');
    await credits.waitForFunction(() => typeof processData === 'function');
    await pause(1000);
    async function gift(name, count, variant = 'current', hash = 'eba3a9bb85c33e017f3648eaf88d7189', sign = '×') {
      await source.evaluate(({ name, count, variant, hash, sign }) => {
        const row = document.createElement('div');
        row.dataset.index = 'shared-event-slot';
        row.className = variant === 'legacy' ? 'DivGiftMessage' : 'flex items-center';
        row.innerHTML = '<div><span data-e2e="message-owner-name"></span></div><div><span>sent Rose </span>' +
          '<img src="https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/' + hash + '~tplv-obj.png">' +
          '<span class="' + (variant === 'count-class' ? 'SpanGiftCount' : '') + '">' + sign + ' ' + count + '</span></div>';
        row.querySelector('[data-e2e]').textContent = name;
        if (variant === 'chat') {
          row.dataset.e2e = 'chat-message';
          row.innerHTML = '<div></div><div><span data-e2e="message-owner-name"></span><div class="break-words align-middle">' + row.lastElementChild.innerHTML + '</div></div>';
          row.querySelector('[data-e2e]').textContent = name;
        }
        document.getElementById(variant === 'chat' ? 'chat' : 'events').append(row);
      }, { name, count, variant, hash, sign });
      await pause(600);
    }
    await gift('Streak Donor', 1);
    await gift('Streak Donor', 2);
    await gift('Streak Donor', 3);
    await until(() => captures.filter(m => m.chatname === 'Streak Donor').length === 3, 'three cumulative updates');
    const streak = captures.filter(m => m.chatname === 'Streak Donor');
    if (process.env.GIFT_DONATIONS === '0') {
      assert(streak.every(m => !m.hasDonation));
      console.log('Donation setting respected');
      return;
    }
    assert.deepStrictEqual(streak.map(m => m.hasDonation), ['1 coin', '2 coins', '3 coins']);
    assert(streak.every(m => m.event === 'gift'));
    if (process.env.GIFT_TEXTONLY === '1') assert(streak.every(m => m.textonly && !m.chatmessage.includes('<img')));
    assert.strictEqual(new Set(streak.map(m => m.meta.tiktokGiftStreakId)).size, 1);
    await until(() => credits.evaluate(() => [...users.values()].some(u => u.name === 'Streak Donor')), 'donor in credits');
    async function donor(name) { return credits.evaluate(name => [...users.values()].find(u => u.name === name), name); }
    assert(Math.abs((await donor('Streak Donor')).donations - 0.03) < 1e-9, 'credits must count 3, not 1+2+3');
    await gift('Other Donor', 1, 'legacy');
    await gift('Count Class', 1, 'count-class');
    await gift('Finger Heart', 2, 'current', 'a4c4dc437fd3a6632aba149769491f49');
    await gift('Unknown Donor', 1, 'current', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await until(() => captures.some(m => m.chatname === 'Unknown Donor'), 'unknown gift');
    assert.strictEqual(captures.find(m => m.chatname === 'Finger Heart').hasDonation, '10 coins');
    assert.notStrictEqual(captures.find(m => m.chatname === 'Other Donor').meta.tiktokGiftStreakId, streak[0].meta.tiktokGiftStreakId);
    assert.strictEqual(captures.find(m => m.chatname === 'Unknown Donor').hasDonation, '1 gift');
    await until(() => donor('Unknown Donor'), 'unknown donor presence');
    assert.strictEqual((await donor('Unknown Donor')).donations, 0);
    await gift('Ascii Count', 2, 'current', 'eba3a9bb85c33e017f3648eaf88d7189', 'x');
    await until(() => captures.some(m => m.chatname === 'Ascii Count'), 'ASCII count gift');
    assert.strictEqual(captures.find(m => m.chatname === 'Ascii Count').hasDonation, '2 coins');
    await gift('Chat Gift', 2, 'chat');
    await gift('Composed Gift', 2, 'chat', 'composed.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await until(() => captures.some(m => m.chatname === 'Composed Gift'), 'chat variants');
    assert.strictEqual(captures.find(m => m.chatname === 'Chat Gift').hasDonation, '2 coins');
    assert.strictEqual(captures.find(m => m.chatname === 'Chat Gift').event, 'gift');
    assert.strictEqual(captures.find(m => m.chatname === 'Composed Gift').hasDonation, '2 gifts');
    await gift('Chat Gift', 1, 'chat');
    await gift('Chat Gift', 2, 'chat');
    await until(() => captures.filter(m => m.chatname === 'Chat Gift').length === 3, 'reused chat slot in a new streak');
    // Overlay reload restores the last cumulative totals as well as donor presence.
    await credits.evaluate(() => flushPersistedCredits());
    await credits.reload();
    await credits.waitForFunction(() => typeof processData === 'function');
    await pause(1000);
    assert(Math.abs((await donor('Streak Donor')).donations - 0.03) < 1e-9);
    for (let count = 1; count <= 120; count++) {
      await gift('Long Streak', count);
      if (count === 30) { await credits.evaluate(() => flushPersistedCredits()); await credits.reload(); }
    }
    await until(() => captures.filter(m => m.chatname === 'Long Streak').length === 120, 'long streak delivery');
    const long = captures.filter(m => m.chatname === 'Long Streak');
    assert.strictEqual(new Set(long.map(m => m.meta.tiktokGiftStreakId)).size, 1);
    assert(Math.abs((await donor('Long Streak')).donations - 1.2) < 1e-9);
    await gift('Long Streak', 120); // replay within the same streak
    assert.strictEqual(captures.filter(m => m.chatname === 'Long Streak').length, 120);
    await gift('Long Streak', 1); // a new streak resets the cumulative count
    await until(() => captures.filter(m => m.chatname === 'Long Streak').length === 121, 'new streak');
    assert(Math.abs((await donor('Long Streak')).donations - 1.21) < 1e-9);
    const background = app.context().pages().flatMap(p => p.frames()).find(p => p.url().includes('/background.html'));
    assert(background, 'real background page available');
    const snapshot = await background.evaluate(() => getBackgroundCreditsSnapshot());
    assert(Math.abs(snapshot.find(u => u.name === 'Long Streak').donations - 1.21) < 1e-9);
    await source.evaluate(() => {
      const row = document.createElement('div');
      row.dataset.e2e = 'chat-message';
      row.dataset.index = 'plain-chat';
      row.innerHTML = '<div></div><div><span data-e2e="message-owner-name">Plain Chat</span><div class="break-words align-middle"></div></div>';
      row.querySelector('.break-words').textContent = 'sent Rose x 2 <b>literal</b> & text';
      document.getElementById('chat').append(row);
    });
    await until(() => captures.some(m => m.chatname === 'Plain Chat'), 'ordinary chat');
    const plain = captures.find(m => m.chatname === 'Plain Chat');
    assert(!plain.hasDonation, 'text alone must not become a gift');
    if (process.env.GIFT_TEXTONLY === '1') assert.strictEqual(plain.chatmessage, 'sent Rose x 2 <b>literal</b> & text');
    await until(() => credits.locator('#credits-content').textContent().then(text => text.includes('Long Streak')), 'visible credits donor');
    await credits.screenshot({ path: path.join(profile, 'credits.png') });
    for (const nativeId of ['native-one', 'native-one', 'native-two']) {
      await source.evaluate(nativeId => {
        const row = document.createElement('div');
        row.dataset.index = '199';
        row.innerHTML = '<div><span data-e2e="message-owner-name">Native Donor</span></div><div>sent Rose <img src="https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png"> x1</div>';
        row.firstElementChild.__reactFiberFixture = { memoizedProps: { message: {
          messageType: 'GiftMessage', msgId: nativeId, payload: {
            group_id: nativeId, gift_id: '5655', repeat_count: '1', repeat_end: 1,
            gift: { name: 'Rose', type: 1 }, user: { id: 'native-donor-id' }
          }
        } } };
        document.getElementById('events').append(row);
      }, nativeId);
      await pause(250);
    }
    await until(() => captures.filter(m => m.chatname === 'Native Donor').length === 2, 'distinct native gifts on a recycled row');
    const nativeGifts = captures.filter(m => m.chatname === 'Native Donor');
    assert.deepStrictEqual(nativeGifts.map(m => m.meta.tiktokGiftMessageId), ['native-one', 'native-two']);
    assert(nativeGifts.every(m => m.meta.giftName === 'Rose' && m.meta.repeatEnd));
    console.log(JSON.stringify({ passed: true, gifts: captures.length, profile }));
  } finally {
    if (socket) socket.close();
    if (app) await app.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
