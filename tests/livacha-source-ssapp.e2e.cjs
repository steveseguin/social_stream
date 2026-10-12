'use strict';
// node tests/livacha-source-ssapp.e2e.cjs [--live]
// Real SSApp source windows, isolated profile, local DOM fixtures. --live reads public chat only.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..');
const appRoot = process.env.SSAPP_REPO || ['ssapp', 'ssn_app'].map(name => path.resolve(root, '..', name)).find(p => fs.existsSync(path.join(p, 'node_modules/electron')));
const { _electron } = require(require.resolve('playwright-core', { paths: [appRoot, root] }));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-livacha-test-'));
const profile = path.join(out, 'profile'); fs.mkdirSync(profile);
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'livacha_test_' + Date.now(), state: true, settings: {} }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixtureUrl = 'https://livacha.com/chat/ssn-fixture';
const html = `<!doctype html><meta charset="utf-8"><div class="chatik"><div class="messages-container"></div></div>
<script>
window.addRow=function(id,name,body,avatar){
 const row=document.createElement('div');row.className='message';row.id='mess-'+id;row.dataset.id=id;
 row.innerHTML='<div class="message-inner"><div class="col-ava"><div class="ava"><img></div></div><div class="message-content"><div class="header"><span class="dotted-hover text-muted" style="color:rgb(60,246,96)"></span></div><div class="content"><div class="text-end float-end"><small title="25 сент. 2026 18:04:46">минуту</small></div><span class="html"></span></div><div class="dropdown"><button>Menu</button><div class="reaction"><img src="/smile/menu.webp"></div>Copy Report</div></div></div>';
 row.querySelector('.dotted-hover').textContent=name;row.querySelector('.html').innerHTML=body;
 if(avatar)row.querySelector('.ava img').setAttribute('src',avatar);else row.querySelector('.col-ava').remove();
 document.querySelector('.messages-container').appendChild(row);return row;
};
addRow('history','History','<p>Old message</p>');
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
   window.livachaReceived = []; window.livachaDelivered = [];
   const ingest = processIncomingMessage, deliver = sendToDestinations;
   processIncomingMessage = function (data) { if (data?.type === 'livacha') livachaReceived.push(JSON.parse(JSON.stringify(data))); return ingest.apply(this, arguments); };
   sendToDestinations = function (data) { if (data?.type === 'livacha') livachaDelivered.push(JSON.parse(JSON.stringify(data))); return deliver.apply(this, arguments); };
  });
  await main.context().route(fixtureUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  async function openSource(url) {
   const previous = new Set(app.windows());
   await main.locator('[data-source-type="other"]').click();
   await main.locator('#source-setup-input').fill(url);
   await main.locator('#source-setup-form button[type="submit"]').click();
   await main.waitForFunction(url => stateManager.getSources().some(s => s.url === url), url);
   const source = await main.evaluate(url => stateManager.getSources().find(s => s.url === url), url);
   assert.equal(source.target, 'livacha', 'The channel URL must select Livacha automatically');
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
   await page.waitForFunction(() => window.__SSN_LIVACHA_ACTIVE__ && document.querySelector('.chatik .messages-container'), null, { timeout: 60000 });
   return { page, source, cdp };
  }
  const { page, source } = await openSource(fixtureUrl);
  const messages = () => bg.evaluate(() => livachaReceived);
  const flush = () => delay(300);
  const add = (id, name, body, avatar) => page.evaluate(args => { addRow(...args); }, [id, name, body, avatar]);
  await flush(); await add('history-2', 'History', 'Staged initial history');
  await delay(1200); assert.equal((await messages()).length, 0, 'Skip initial history, including staged renders');
  await add('one', 'Semen & Семёнович', '<p>Так наша Волга идёт дальше,&nbsp; через Камское устье.</p><p>Next &lt;b&gt; line<br>after break</p>', '/upload/user/ava/avatar.jpg');
  await flush(); let rows = await messages(); assert.equal(rows.length, 1);
  assert.equal(rows[0].chatname, 'Semen & Семёнович');
  assert.equal(rows[0].chatmessage, 'Так наша Волга идёт дальше, через Камское устье. Next &lt;b&gt; line after break');
  assert.equal(rows[0].chatimg, 'https://livacha.com/upload/user/ava/avatar.jpg');
  assert.equal(rows[0].nameColor, 'rgb(60, 246, 96)');
  assert.equal(rows[0].platform, 'livacha'); assert.equal(rows[0].textonly, false);
  assert.ok(!rows[0].chatmessage.includes('минуту') && !rows[0].chatmessage.includes('menu.webp'), 'Do not capture timestamp or reaction menu');
  await add('image', 'Image', '<p>Hello <img src="/smile/test.webp" alt="Smile" onerror="bad()"><img src="https://example.com/test.gif"><img src="javascript:bad()"><script>bad()</script><button>UI</button><a href="javascript:bad()">link</a></p>', 'javascript:bad()');
  await flush(); rows = await messages();
  assert.equal(rows.at(-1).chatmessage, 'Hello <img src="https://livacha.com/smile/test.webp" alt="Smile"><img src="https://example.com/test.gif" alt="">link');
  assert.equal(rows.at(-1).chatimg, '');
  await add('list', 'List', '<ul><li>First</li><li>Second</li></ul>'); await flush();
  assert.equal((await messages()).at(-1).chatmessage, 'First; Second;');
  await bg.evaluate(() => { settings.textonlymode = true; pushSettingChange(); }); await flush();
  await add('plain', 'Plain', '<p>&lt;b&gt; <img src="/smile/test.webp" alt="Smile"> <img src="/image.gif"></p>'); await flush();
  assert.equal((await messages()).at(-1).chatmessage, '<b> Smile [image]');
  assert.equal((await messages()).at(-1).textonly, true);
  await bg.evaluate(() => { settings.textonlymode = false; pushSettingChange(); }); await flush();
  let count = (await messages()).length;
  await page.evaluate(() => {
   const row = document.getElementById('mess-one'); row.querySelector('.html').textContent = 'Edited';
   row.querySelector('small').textContent = '2 minutes';
   document.querySelector('.messages-container').appendChild(row.cloneNode(true));
  }); await flush(); assert.equal((await messages()).length, count, 'Edits, timestamp changes and remounts must not resend chat');
  await add('repeat-1', 'Repeat', 'Same'); await add('repeat-2', 'Repeat', 'Same'); await flush();
  assert.equal((await messages()).length, count + 2, 'Different message IDs must preserve identical text');
  count = (await messages()).length;
  await page.evaluate(() => {
   const row = addRow('older', 'Old history', 'Prepended older chat');
   document.querySelector('.messages-container').prepend(row);
  }); await flush(); assert.equal((await messages()).length, count, 'Loading older history must not capture it');
  await add('partial', 'Partial', ''); await flush();
  await add('later', 'Later', 'Arrives first'); await flush();
  await page.evaluate(() => { document.getElementById('mess-partial').querySelector('.html').textContent = 'Now populated'; }); await flush();
  assert.equal((await messages()).length, count + 2, 'A partially populated row must still capture after a later row');
  assert.equal((await messages()).at(-1).chatmessage, 'Now populated');
  await page.evaluate(() => {
   const row = document.getElementById('mess-later'); row.dataset.id = 'recycled'; row.querySelector('.html').textContent = 'Recycled DOM';
  }); await flush(); assert.equal((await messages()).at(-1).chatmessage, 'Recycled DOM');
  count = (await messages()).length;
  await bg.evaluate(() => { isExtensionOn = false; pushSettingChange(); }); await flush();
  await add('disabled', 'Disabled', 'Skip'); await flush();
  await bg.evaluate(() => { isExtensionOn = true; pushSettingChange(); }); await flush();
  await add('enabled', 'Enabled', 'Resume'); await flush();
  assert.equal((await messages()).length, count + 1, 'Disabled messages must not replay');
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'sources/livacha.js'), 'utf8') });
  await add('once', 'Once', 'Reinjection'); await flush();
  assert.equal((await messages()).length, count + 2, 'Reinjection must not duplicate capture');
  count = (await messages()).length;
  await page.evaluate(() => {
   const panel = document.querySelector('.messages-container'); panel.replaceWith(panel.cloneNode(true));
  }); await delay(1200);
  assert.equal((await messages()).length, count, 'Replacing the chat panel must not replay history');
  await add('replacement', 'Replacement', 'Still connected'); await flush();
  assert.equal((await messages()).length, count + 1);
  await page.evaluate(() => {
   history.pushState({}, '', '/chat/second-room'); document.querySelector('.messages-container').innerHTML = '';
   addRow('history', 'History', 'Other room');
  }); await delay(2300);
  await add('one', 'New room', 'Same ID, different room'); await flush();
  assert.equal((await messages()).length, count + 2); assert.equal((await messages()).at(-1).chatname, 'New room');
  count = (await messages()).length;
  await page.evaluate(() => history.pushState({}, '', '/outside-chat')); await delay(1200);
  await add('outside', 'Outside', 'Ignore non-chat pages'); await flush();
  assert.equal((await messages()).length, count, 'Capture must stop when navigating away from a chat-room URL');
  assert.ok(await bg.evaluate(() => livachaDelivered.length > 0), 'Captured chat must reach the normal destination pipeline');
  console.log('PASS names, Cyrillic, avatars, images, text-only, flat lists, menus, history, IDs, edits, partial rows, state, navigation and app delivery');
  await main.locator('[data-source-id="' + source.id + '"] [data-stophtml]').click();

  if (process.argv.includes('--live')) {
   await bg.evaluate(() => { livachaReceived.length = 0; livachaDelivered.length = 0; });
   const live = await openSource('https://livacha.com/chat/germany');
   await live.page.waitForFunction(() => document.querySelector('.messages-container > .message[data-id]'), null, { timeout: 60000 });
   await delay(3000);
   await bg.evaluate(() => { livachaReceived.length = 0; livachaDelivered.length = 0; });
   const initialIds = await live.page.locator('.messages-container > .message[data-id]').evaluateAll(rows => rows.map(row => row.dataset.id));
   let freshIds = [];
   for (let i = 0; i < 6; i++) {
    await delay(15000);
    const ids = await live.page.locator('.messages-container > .message[data-id]').evaluateAll(rows => rows.map(row => row.dataset.id));
    freshIds = ids.filter(id => !initialIds.includes(id));
    console.log('LIVE ' + (i + 1) * 15 + 's: ' + (await messages()).length + ' captured; ' + freshIds.length + ' new site rows');
    if (await bg.evaluate(() => livachaDelivered.length >= 2)) break;
   }
   const received = await messages();
   fs.writeFileSync(path.join(out, 'live-messages.json'), JSON.stringify(received, null, 2));
   fs.writeFileSync(path.join(out, 'live-chat.html'), await live.page.locator('.messages-container').first().evaluate(node => node.outerHTML));
   const shot = await live.cdp.send('Page.captureScreenshot'); fs.writeFileSync(path.join(out, 'live-source.png'), Buffer.from(shot.data, 'base64'));
   assert.ok(freshIds.length > 0 && received.length > 0 && await bg.evaluate(() => livachaDelivered.length > 0), 'Fresh live messages must be captured and delivered');
   console.log('PASS live Livacha chat: ' + received.length + ' messages captured and delivered');
  }
  console.log('All Livacha source checks passed.');
 } finally { if (app) await app.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
