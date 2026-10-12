'use strict';
// node tests/gosh-source-ssapp.e2e.cjs [--live]
// Real SSApp source windows, isolated profile, local DOM fixtures. --live reads public chat only.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..');
const appRoot = process.env.SSAPP_REPO || ['ssapp', 'ssn_app'].map(name => path.resolve(root, '..', name)).find(p => fs.existsSync(path.join(p, 'node_modules/electron')));
const { _electron } = require(require.resolve('playwright-core', { paths: [appRoot, root] }));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-gosh-test-'));
const profile = path.join(out, 'profile'); fs.mkdirSync(profile);
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'gosh_test_' + Date.now(), state: true, settings: {} }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixtureUrl = 'https://gosh.com/ssn-fixture';
const html = `<!doctype html><meta charset="utf-8"><style>section{height:600px;overflow:auto}.chat-message-container{min-height:32px}</style>
<section class="pc-chat-panel-main"></section><div class="rich-message-editor" contenteditable="true"></div>
<script>
window.addRow = function(index,name,body){
 const outer=document.createElement('div');outer.setAttribute('data-index',index);
 outer.innerHTML='<div class="chat-message-container"><div class="chat-message-line"><div class="chat-message-author"><span aria-haspopup="dialog" style="color:rgb(60,246,96)"></span></div><span class="chat-message-body"><span type="button"><span></span></span></span></div></div>';
 if(name)outer.querySelector('.chat-message-author span').textContent=name+':\\u00a0';else outer.querySelector('.chat-message-author').remove();
 outer.querySelector('.chat-message-body span span').innerHTML=body;
 document.querySelector('section').appendChild(outer);return outer;
};
window.setRows=function(rows){document.querySelector('section').innerHTML='';rows.forEach(row=>addRow(...row));};
addRow(0,'History','Old chat');
</script>`;
let app;

(async () => {
 console.log('Artifacts: ' + out);
 try {
  app = await _electron.launch({ executablePath: require(path.join(appRoot, 'node_modules/electron')), cwd: appRoot,
   args: ['.', '--multiinstance', '--preferlocalassets', '--filesource=' + root],
   env: { ...process.env, SSAPP_USER_DATA_DIR: profile }, timeout: 60000 });
  const main = await app.firstWindow(); main.setDefaultTimeout(20000);
  await main.waitForFunction(() => window.stateManager?.initialized && configReady, null, { timeout: 60000 });
  await main.waitForFunction(() => typeof document.getElementById('frame2')?.contentWindow?.processIncomingMessage === 'function');
  const bg = main.frames().find(frame => frame.url().includes('background.html'));
  await bg.evaluate(() => {
   window.goshReceived = []; window.goshDelivered = [];
   const ingest = processIncomingMessage, deliver = sendToDestinations;
   processIncomingMessage = function (data) { if (data?.type === 'gosh') goshReceived.push(JSON.parse(JSON.stringify(data))); return ingest.apply(this, arguments); };
   sendToDestinations = function (data) { if (data?.type === 'gosh') goshDelivered.push(JSON.parse(JSON.stringify(data))); return deliver.apply(this, arguments); };
  });
  await main.context().route(fixtureUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  async function openSource(url) {
   const previous = new Set(app.windows());
   await main.locator('[data-source-type="other"]').click();
   await main.locator('#source-setup-input').fill(url);
   await main.locator('#source-setup-form button[type="submit"]').click();
   await main.waitForFunction(url => stateManager.getSources().some(s => s.url === url), url);
   const source = await main.evaluate(url => stateManager.getSources().find(s => s.url === url), url);
   assert.equal(source.target, 'gosh', 'The channel URL must select Gosh automatically');
   await main.locator('[data-source-id="' + source.id + '"] [data-activatehtml]').press('Enter');
   let page;
   for (let n = 0; n < 150; n++) { page = app.windows().find(p => !previous.has(p)); if (page) break; await delay(100); }
   assert.ok(page, 'Source window must open');
   const cdp = await main.context().newCDPSession(page);
   // Resume an initial debugger pause caused by attaching the test runner to a new window.
   await cdp.send('Debugger.enable');
   await cdp.send('Debugger.setSkipAllPauses', { skip: true });
   await cdp.send('Runtime.runIfWaitingForDebugger');
   await cdp.send('Debugger.resume').catch(() => {});
   page.setDefaultTimeout(20000);
   await page.waitForFunction(() => window.__SSN_GOSH_ACTIVE__ && document.querySelector('.pc-chat-panel-main'), null, { timeout: 60000 });
   return { page, source, cdp };
  }
  const { page, source } = await openSource(fixtureUrl);
  const messages = () => bg.evaluate(() => goshReceived);
  const flush = () => delay(300);
  const add = (index, name, body) => page.evaluate(args => { addRow(...args); }, [index, name, body]);
  await flush();
  await add(1, 'History', 'History finishing its initial render');
  await delay(1100); assert.equal((await messages()).length, 0, 'Skip initial history');
  await page.evaluate(() => { history.pushState({}, '', '/ssn-fixture-ready'); setRows([[0,'History','Old chat']]); });
  await delay(2300);
  await add(1, 'A & B', 'Hi &lt;b&gt; <img src="/emote.gif" alt="Smile" onerror="void 0"><script>bad()</script><a href="javascript:bad()">link</a>');
  await flush();
  let rows = await messages(); assert.equal(rows.length, 1);
  assert.equal(rows[0].chatname, 'A & B');
  assert.equal(rows[0].chatmessage, 'Hi &lt;b&gt; <img src="https://gosh.com/emote.gif" alt="Smile">link');
  assert.equal(rows[0].nameColor, 'rgb(60, 246, 96)');
  assert.equal(rows[0].platform, 'gosh'); assert.equal(rows[0].textonly, false);
  await add(2, '', 'Someone followed the streamer');
  await page.evaluate(() => document.querySelector('section').appendChild(document.querySelector('[data-index="1"]').cloneNode(true)));
  await flush(); assert.equal((await messages()).length, 1, 'Ignore notices and remounted old rows');
  await add(3, 'Repeat', 'Same text'); await add(4, 'Repeat', 'Same text');
  await flush(); assert.equal((await messages()).length, 3, 'Distinct repeated messages must both be captured');
  await page.evaluate(() => {
   const row = document.querySelector('[data-index="4"]'); row.dataset.index = '5';
   row.querySelector('.chat-message-body').textContent = 'Recycled row';
  });
  await flush(); assert.equal((await messages()).at(-1).chatmessage, 'Recycled row');
  await bg.evaluate(() => { settings.textonlymode = true; pushSettingChange(); }); await flush();
  await add(6, 'Text', '&lt;b&gt;<br><img src="/emote.png" alt="Smile"><img src="/picture.gif"><img src="javascript:bad()">');
  await flush(); rows = await messages(); assert.equal(rows.at(-1).chatmessage, '<b> Smile[image]'); assert.equal(rows.at(-1).textonly, true);
  await bg.evaluate(() => { settings.textonlymode = false; pushSettingChange(); }); await flush();
  await add(7, 'Image', '<img src="https://meee.com.tw/g6ObS1Z.gif" alt="">'); await flush();
  assert.match((await messages()).at(-1).chatmessage, /^<img src="https:\/\/meee.com.tw\/g6ObS1Z.gif" alt="">$/);
  await add(8, 'List', '<ul><li>First</li><li>Second</li></ul>'); await flush();
  assert.equal((await messages()).at(-1).chatmessage, 'First; Second;');
  console.log('PASS chat, colors, escaping, GIFs, text-only, lists, notices, repeated text and recycled rows');
  await page.evaluate(() => setRows([[40,'A','one'],[41,'B','two'],[42,'C','three']])); await flush();
  let count = (await messages()).length;
  await page.evaluate(() => setRows([[40,'B','two'],[41,'C','three'],[42,'D','four']])); await flush();
  assert.equal((await messages()).length, count + 1, 'A capped buffer shift must capture only the appended message');
  assert.equal((await messages()).at(-1).chatname, 'D');
  count = (await messages()).length;
  await page.evaluate(() => { document.querySelector('[data-index="42"] .chat-message-body').textContent = 'Edited'; }); await flush();
  assert.equal((await messages()).length, count, 'Edits must not resend a message');
  await bg.evaluate(() => { isExtensionOn = false; pushSettingChange(); }); await flush();
  await add(43, 'Disabled', 'Skip'); await flush();
  await bg.evaluate(() => { isExtensionOn = true; pushSettingChange(); }); await flush();
  await add(44, 'Enabled', 'Resume'); await flush();
  assert.equal((await messages()).length, count + 1, 'Disabled messages must not replay');
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'sources/gosh.js'), 'utf8') });
  await add(45, 'Once', 'Reinjection'); await flush(); assert.equal((await messages()).length, count + 2);
  await page.evaluate(() => { history.pushState({}, '', '/ssn-second-channel'); setRows([[0,'History','Other channel history']]); });
  await delay(2300); await add(1, 'New channel', 'New chat'); await flush();
  assert.equal((await messages()).length, count + 3); assert.equal((await messages()).at(-1).chatname, 'New channel');
  count = (await messages()).length;
  await page.evaluate(() => setRows([[0,'History','Other channel history']])); await flush();
  await page.evaluate(() => setRows([[0,'History','Other channel history'],[1,'New channel','New chat']])); await flush();
  assert.equal((await messages()).length, count, 'A temporarily shortened viewport must not replay messages');
  await page.evaluate(() => {
   const panel = document.querySelector('section'); panel.style.height = '32px';
   addRow(2, 'Next', 'Before scrolling'); panel.scrollTop = panel.scrollHeight;
   panel.dispatchEvent(new Event('scroll'));
  }); await flush(); count = (await messages()).length;
  await page.evaluate(() => {
   document.querySelector('section').style.height = '10px';
   setRows([[0,'History','Other channel history'],[1,'New channel','New chat'],[2,'Next','Before scrolling'],[3,'Next','While scrolling'],[4,'Next','Still scrolling']]);
   const panel = document.querySelector('section'); panel.scrollTop = 0; panel.dispatchEvent(new Event('scroll'));
  }); await flush();
  assert.equal((await messages()).length, count, 'Scrolling away from the newest messages must pause capture');
  await page.evaluate(() => {
   const panel = document.querySelector('section'); panel.scrollTop = panel.scrollHeight; panel.dispatchEvent(new Event('scroll'));
   addRow(5, 'Next', 'Back at the bottom');
  }); await flush();
  assert.equal((await messages()).length, count + 3, 'Returning to the bottom must capture unseen rows without replaying history');
  count = (await messages()).length;
  await page.evaluate(() => {
   const panel = document.querySelector('section'); const replacement = panel.cloneNode(true);
   replacement.style.height = '600px'; panel.replaceWith(replacement);
  }); await delay(1200);
  assert.equal((await messages()).length, count, 'Replacing the chat panel must not replay history');
  await add(6, 'Replacement', 'Still connected'); await flush();
  assert.equal((await messages()).length, count + 1, 'Capture must survive a replaced chat panel');
  assert.ok(await bg.evaluate(() => goshDelivered.length > 0), 'Captured chat must reach the normal destination pipeline');
  console.log('PASS bounded buffer, edits, disabled state, reinjection, navigation, scrolling, panel replacement and app delivery');
  await main.locator('[data-source-id="' + source.id + '"] [data-stophtml]').click();

  if (process.argv.includes('--live')) {
   await bg.evaluate(() => { goshReceived.length = 0; goshDelivered.length = 0; });
   const live = await openSource('https://gosh.com/gopso1');
   const initial = await live.page.locator('.pc-chat-panel-main').evaluate(panel => ({ top: panel.scrollTop, height: panel.scrollHeight, viewport: panel.clientHeight, rows: panel.querySelectorAll('.chat-message-container').length }));
   console.log('LIVE ready ' + JSON.stringify(initial));
   await delay(5000);
   await bg.evaluate(() => { goshReceived.length = 0; goshDelivered.length = 0; });
   for (let i = 0; i < 6; i++) {
    await delay(15000);
    const status = await live.page.locator('.pc-chat-panel-main').evaluate(panel => ({ top: panel.scrollTop, height: panel.scrollHeight, viewport: panel.clientHeight, lastIndex: [...panel.querySelectorAll('[data-index]')].at(-1)?.dataset.index }));
    console.log('LIVE ' + (i + 1) * 15 + 's: ' + (await messages()).length + ' captured; ' + JSON.stringify(status));
    if (await bg.evaluate(() => goshDelivered.length >= 3)) break;
   }
   const received = await messages();
   fs.writeFileSync(path.join(out, 'live-messages.json'), JSON.stringify(received, null, 2));
   const shot = await live.cdp.send('Page.captureScreenshot'); fs.writeFileSync(path.join(out, 'live-source.png'), Buffer.from(shot.data, 'base64'));
   assert.ok(received.length > 0 && await bg.evaluate(() => goshDelivered.length > 0), 'Live messages must be captured and delivered');
   console.log('PASS live Gosh chat: ' + received.length + ' messages captured and delivered');
  }
  console.log('All Gosh source checks passed.');
 } finally { if (app) await app.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
