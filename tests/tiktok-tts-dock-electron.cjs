'use strict';

// End-to-end duplicate-source and streak TTS test through the actual SSApp dock.
// Run: node tests/tiktok-tts-dock-electron.cjs (requires SSApp dependencies installed).
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
    const secondUrl = fixtureUrl + '?copy=2';
    await main.evaluate(async url => {
      const element = await newOtherSource('tiktok', url, false, { username: 'gift-fixture-copy', sourceFile: 'sources/tiktok.js', connectionMode: 'classic', autoActivate: false, isVisible: false, isMuted: true });
      await createWindow(element.querySelector('[data-activatehtml]'));
    }, secondUrl);
    const second = await until(() => app.context().pages().find(p => p.url() === secondUrl), 'second source');
    await second.waitForFunction(() => typeof window.__ssnReadTikTokGift === 'function');
    await pause(6500);
    const dockUrl = pathToFileURL(path.join(sourceRoot, 'dock.html')).href + `?session=${room}&server2=ws://127.0.0.1:${relayPort}&ttsdonos`;
    await app.evaluate(({ BrowserWindow }, url) => { const w = new BrowserWindow({ show:false }); w.loadURL(url); }, dockUrl);
    const dock = await until(() => app.windows().find(p => p.url().includes('/dock.html')), 'actual dock');
    // Dock intentionally disables window.eval; CDP avoids changing that protection.
    const dockCDP = await app.context().newCDPSession(dock);
    const dockEval = async expression => {
      const result = await dockCDP.send('Runtime.evaluate', {expression,returnByValue:true,awaitPromise:true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await until(() => dockEval("typeof TTS !== 'undefined' && typeof TTS.speechMeta === 'function'"), 'dock TTS loaded');
    await dockEval(`(function() {
      window.spokenGifts=[];window.ttsInputs=[];
      TTS.speech=true;TTS.readDonos=true;TTS.English=true;TTS.ttsSpeakChatname=true;
      TTS.speak=text=>spokenGifts.push(text);
      const original=TTS.speechMeta;
      TTS.speechMeta=function(data,allow){ttsInputs.push(JSON.parse(JSON.stringify(data)));return original(data,allow);};
    })()`);
    await pause(2000);
    async function gift(target, id, group, count, end=true) {
      await target.evaluate(({id,group,count,end})=>{
        const row=document.createElement('div');row.dataset.index='199';
        row.innerHTML='<div><span data-e2e="message-owner-name">John</span></div><div>sent Rose <img src="https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png"> x'+count+'</div>';
        row.firstElementChild.__reactFiberTest={memoizedProps:{message:{messageType:'GiftMessage',msgId:id,payload:{group_id:group,gift_id:'5655',repeat_count:String(count),repeat_end:end?1:0,gift:{name:'Rose',type:1},user:{id:'12345'}}}}};
        document.getElementById('events').append(row);
      },{id,group,count,end});
      await pause(100);
    }
    if (!process.env.TIKTOK_TOGGLE_ONLY) {
    await gift(source,'purchase1','group1',1);
    await gift(second,'purchase1','group1',1);
    await until(()=>dockEval('spokenGifts.length===1'),'one announcement from two actual sources');
    assert.deepStrictEqual(await dockEval('spokenGifts'),['john sent 1 Rose']);
    assert.strictEqual(captures.filter(m=>m.meta&&m.meta.tiktokGiftMessageId==='purchase1').length,2,'both source copies reached background');
    await pause(5000);
    await gift(second,'purchase1','group1',1);
    await pause(5000);
    assert.strictEqual(await dockEval('spokenGifts.length'),1,'late repeated native gift must remain silent');
    await gift(source,'purchase2','group2',1);
    await until(()=>dockEval('spokenGifts.length===2'),'separate purchase survives');
    // Thirty cumulative updates over more than the old quiet window, from both sources.
    for(let count=1;count<=30;count++) {
      await gift(source,'streak-'+count,'long-group',count,false);
      await gift(second,'streak-'+count,'long-group',count,false);
      await pause(100);
    }
    assert.strictEqual(await dockEval('spokenGifts.length'),2,'ongoing streak does not announce partial totals');
    await gift(source,'streak-final','long-group',30,true);
    await gift(second,'streak-final','long-group',30,true);
    await until(()=>dockEval('spokenGifts.length===3'),'one final streak total');
    assert.deepStrictEqual(await dockEval('spokenGifts'),['john sent 1 Rose','john sent 1 Rose','john sent 30 Rose']);
    }
    const beforeToggle = await dockEval('spokenGifts.length');
    async function toggleDonations(value) {
      await source.evaluate(value => new Promise(resolve => chrome.runtime.sendMessage(chrome.runtime.id, {
        cmd:'saveSetting',type:'setting',setting:'notiktokdonations',value
      }, resolve)), value);
      await pause(500);
    }
    await toggleDonations(true);
    await gift(source,'toggle-disabled','toggle-disabled',1);
    await until(()=>captures.some(m=>m.meta&&m.meta.tiktokGiftMessageId==='toggle-disabled'),'gift after disabling donations');
    assert(!captures.find(m=>m.meta&&m.meta.tiktokGiftMessageId==='toggle-disabled').hasDonation,'live source receives setting update without a reload');
    await pause(5000);
    assert.strictEqual(await dockEval('spokenGifts.length'),beforeToggle,'donation-only dock stays silent with the toggle enabled');
    await toggleDonations(false);
    await gift(source,'toggle-enabled','toggle-enabled',1);
    await until(()=>dockEval('spokenGifts.length').then(n=>n===beforeToggle+1),'speech resumes after toggling donations back on');
    const report={passed:true,captures:captures.length,spoken:await dockEval('spokenGifts')};
    console.log(JSON.stringify(report));
  } finally {
    if(socket)socket.close();
    if(app)await app.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
