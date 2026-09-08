// Actual SSApp runtime, isolated settings and a local-only relay; no live source accounts.
const { _electron } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
const ssapp = process.env.SSN_TEST_SSAPP_ROOT || path.resolve(root, '../ssapp');
const { WebSocketServer } = require(path.join(ssapp, 'node_modules/ws'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-commerce-'));
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'commerceqa', password: 'false', state: false, settings: {}, wsServer: false }));
(async () => {
 const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 });
 await new Promise(resolve => relay.once('listening', resolve));
 const send = data => relay.clients.forEach(client => client.send(JSON.stringify(data)));
 const wrapper = path.join(profile, 'bootstrap.cjs');
 fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>{cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)});}));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
 let app;
 try {
  app = await _electron.launch({ executablePath: path.join(ssapp, 'node_modules/electron/dist/electron.exe'), args: [wrapper, '--running-from-source', '--multiinstance', '--ssapp-headless-control', '--filesource', 'file:///' + root + '/', '--no-hwa'].filter(arg => !process.env.SSN_GUIDE_SCREENSHOTS || arg !== '--ssapp-headless-control'), cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
  const main = await app.firstWindow(); main.setDefaultTimeout(25000);
  await main.waitForFunction(() => document.querySelector('#frame2')?.contentWindow?.handleMonetizationRequest);
  const bg = main.frames().find(f => /background\.html/.test(f.url()));
  const popup = main.frames().find(f => /popup\.html/.test(f.url()));
  await main.locator('[data-page=streams]').click();
  await popup.evaluate(() => { document.getElementById('monetization-settings').open = true; applyPopupBeginnerMode(false); });
  await popup.waitForFunction(() => document.getElementById('money-current').textContent.includes('Load your wishlist'));
  await popup.locator('#money-commerce-panel > summary').click();
  await popup.locator('label[for=money-commerce-enabled]').click();
  async function add(name, url, purpose) {
   await popup.locator('#money-commerce-name').fill(name);
   await popup.locator('#money-commerce-url').fill(url);
   await popup.locator('#money-commerce-purpose').selectOption(purpose);
   await popup.locator('#money-commerce-add').click();
  }
  await popup.locator('#money-provider-panel > summary').click();
  assert.match(await popup.locator('#money-provider-status').textContent(), /Receiver off/);
  for (const provider of ['fourthwall', 'kofi', 'bmac']) {
   await popup.locator('#money-provider').selectOption(provider);
   assert.equal(await popup.locator('#money-provider-url').inputValue(), 'https://io.socialstream.ninja/commerceqa/' + provider);
   const preview = new URL(await popup.locator('#money-provider-preview').getAttribute('href'));
   assert(preview.searchParams.has('demo')); assert(!preview.searchParams.has('session')); assert.equal(preview.searchParams.get('provider'), provider);
  }
  await popup.locator('#money-provider').selectOption('fourthwall');
  await popup.locator('#money-provider-setting').click();
  assert(await popup.locator('#wrapper-global-connections-integrations-options').isChecked());
  assert(await popup.locator('input[data-setting="socketserver"]').evaluate(e => e.closest('div').getBoundingClientRect().height > 0));
  await bg.evaluate(() => { window.importOriginalFetch = fetch; window.fetch = (url, options) => String(url).startsWith('https://storefront-api.fourthwall.com/') ? Promise.resolve({ ok: true, text: async () => JSON.stringify({ name: 'Studio print', slug: 'print', type: 'PRODUCT', state: { type: 'AVAILABLE' }, access: { type: 'PUBLIC' }, images: [], variants: [{ unitPrice: { value: 25, currency: 'USD' } }] }) }) : importOriginalFetch(url, options); });
  await popup.locator('#money-fourthwall-import-panel > summary').click();
  await popup.locator('#money-fourthwall-url').fill('https://example.com/products/print');
  await popup.locator('#money-fourthwall-token').fill('isolated-test-token');
  await popup.locator('#money-fourthwall-import').click();
  await popup.waitForFunction(() => document.getElementById('money-fourthwall-status').textContent.includes('Details loaded'));
  assert.equal(await popup.locator('#money-commerce-name').inputValue(), 'Studio print');
  assert.equal(await popup.locator('#money-fourthwall-token').inputValue(), '');
  const guideDir = path.join(root, 'docs/images/monetization');
  async function capturePanel(selector, filename) {
   if (!process.env.SSN_GUIDE_SCREENSHOTS) return;
   fs.mkdirSync(guideDir, { recursive: true });
   await app.evaluate(({ BrowserWindow }, url) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url); w.setSize(1584, 1800); w.showInactive(); }, main.url());
   await popup.locator(selector).evaluate(e => e.scrollIntoView({ block: 'center' }));
   await popup.evaluate(() => window.scrollBy(0, -100));
   await main.waitForTimeout(500);
   const box = await popup.locator(selector).boundingBox();
   assert(box && box.width > 100 && box.height > 50);
   const png = await app.evaluate(async ({ BrowserWindow }, args) => {
    const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === args.url);
    const rect = { x: Math.floor(args.box.x), y: Math.floor(args.box.y), width: Math.ceil(args.box.width), height: Math.ceil(args.box.height) };
    const image = await w.webContents.capturePage(rect, { stayHidden: true, stayAwake: true });
    return image.toPNG().toString('base64');
   }, { url: main.url(), box });
   fs.writeFileSync(path.join(guideDir, filename), Buffer.from(png, 'base64'));
  }
  await capturePanel('#money-provider-section', 'provider-setup.png');
  await capturePanel('#money-commerce-panel', 'fourthwall-import.png');
  await popup.locator('#money-commerce-add').click();
  await bg.evaluate(() => { window.fetch = importOriginalFetch; });
  await add('Support the show', 'https://example.com/support', 'support');
  await popup.locator('#money-mode').selectOption('commerce');
  await popup.locator('#money-view').evaluate(e => { e.closest('details').open = true; });
  await popup.locator('#money-view').selectOption('showcase');
  await popup.locator('#money-style').selectOption('compact');
  await bg.evaluate(() => { window.commerceSnapshots = []; window.sendDataP2P = data => commerceSnapshots.push(data); });
  await popup.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ cmd: 'setOnOffState', data: { value: true } }, resolve)));
  await popup.locator('#money-save').click();
  await popup.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.');
  const saved = await bg.evaluate(() => handleMonetizationRequest({ action: 'get' }));
  assert.equal(saved.config.commerce.items.length, 2); assert.equal(saved.config.presentation.view, 'showcase');
  assert.equal(saved.config.commerce.items[0].amount, 25);
  const link = await popup.locator('#money-overlay').getAttribute('href');
  assert.equal(new URL(link).searchParams.get('mode'), 'commerce');
  assert.equal(new URL(link).searchParams.get('style'), 'compact');
  let snapshot = await bg.evaluate(() => commerceSnapshots.filter(d => d.event === 'monetization_update').pop());
  assert(snapshot.meta.monetization.commerce.enabled);
  async function overlay(view, extra = '') {
   const wait = app.waitForEvent('window');
   const url = 'file:///' + root + '/monetization.html?session=commerceqa&mode=commerce&view=' + view + '&server=ws://127.0.0.1:' + relay.address().port + extra;
   await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { backgroundThrottling: false } }).loadURL(url), url);
   const page = await wait; page.setDefaultTimeout(15000); await page.waitForLoadState();
   // Wait for the overlay's actual relay join before sending snapshots.
   await page.waitForTimeout(300); send(snapshot); return page;
  }
  const showcase = await overlay('showcase', '&style=compact');
  await showcase.locator('#support-card').waitFor({ state: 'visible' });
  const first = await showcase.locator('#qr').getAttribute('title');
  assert(['https://example.com/products/print', 'https://example.com/support'].includes(first));
  assert.equal(await showcase.locator('#support-link').getAttribute('href'), first);
  await showcase.evaluate(() => { window.savedNow = Date.now; Date.now = () => 0; }); send(snapshot);
  await showcase.waitForFunction(() => document.getElementById('title').textContent === 'Studio print');
  await showcase.evaluate(() => { Date.now = () => 30000; }); send(snapshot);
  await showcase.waitForFunction(() => document.getElementById('title').textContent === 'Support the show');
  assert.equal(await showcase.locator('#qr').getAttribute('title'), 'https://example.com/support');
  await showcase.evaluate(() => { Date.now = savedNow; });
  snapshot.meta.monetization.commerce.display = 'first'; send(snapshot);
  await showcase.waitForFunction(() => document.getElementById('title').textContent === 'Studio print');
  assert.equal(await showcase.locator('#qr').getAttribute('title'), 'https://example.com/products/print');
  const alerts = await overlay('alerts', '&onlytype=fourthwall');
  assert(await alerts.locator('#support-card').isHidden());
  send({ type: 'kofi', id: 'excluded', event: 'purchase', chatname: 'Excluded' });
  await alerts.waitForTimeout(350); assert(await alerts.locator('#support-card').isHidden());
  send({ type: 'fourthwall', id: 'sale', event: 'purchase', chatname: 'Jess', subtitle: 'Studio print' });
  await alerts.waitForFunction(() => document.getElementById('title').textContent === 'Purchase: Jess');
  assert(await alerts.locator('#qr').isHidden()); // No QR pointing to an unrelated rotating item.
  assert.equal(await showcase.locator('#title').textContent(), 'Studio print');
  const previewWait = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, width: 800, height: 600 }).loadURL(url), 'file:///' + root + '/monetization.html?demo&mode=commerce&view=alerts&provider=bmac');
  const previewPage = await previewWait;
  await previewPage.waitForFunction(() => document.getElementById('title').textContent.includes('Juniper'));
  assert.match(await previewPage.locator('#detail').textContent(), /Buy Me a Coffee/);
  const card = await overlay('card', '&ln=test');
  await card.waitForFunction(() => document.getElementById('badge').textContent.includes('[TEST]'));
  assert(await card.locator('#item-image').isHidden());
  async function capture(page, name) {
   const png=await app.evaluate(async({BrowserWindow},url)=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'),page.url());
   fs.writeFileSync(path.join(profile,name),Buffer.from(png,'base64'));
  }
  await capture(showcase, 'showcase.png');
  if (process.env.SSN_GUIDE_SCREENSHOTS) await showcase.locator('#support-card').screenshot({ path: path.join(guideDir, 'product-showcase.png') });
  await capture(alerts, 'alert.png');
  await app.evaluate(({ BrowserWindow }, url) => { const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url); win.setSize(1584, 1600); }, main.url());
  await main.waitForTimeout(500);
  const geometry = await popup.locator('#money-commerce-panel').evaluate(e => ({ width: e.clientWidth, content: e.scrollWidth, input: document.getElementById('money-commerce-url').getBoundingClientRect().width }));
  assert(geometry.width > 0 && geometry.content <= geometry.width + 2 && geometry.input >= 120, JSON.stringify(geometry));
  await popup.evaluate(() => location.reload());
  await popup.waitForFunction(() => document.querySelectorAll('#money-commerce-items .money-item').length === 2);
  assert.equal(await popup.locator('#money-view').inputValue(), 'showcase');
  console.log('PASS: SSApp product setup, persistence, public links, QR destinations, pinning, independent alerts, source filter, translation and screenshots:', profile);
 } finally {
  if (app) await app.close(); relay.clients.forEach(client => client.terminate()); await new Promise(resolve => relay.close(resolve));
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
