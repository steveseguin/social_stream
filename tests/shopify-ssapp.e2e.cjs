// Actual SSApp, local signed receiver and isolated catalog fixtures. No live stores or payments.
const { _electron } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..').replace(/\\/g, '/'), ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-shopify-'));
const Database = require(path.join(root, 'monetization-server/node_modules/better-sqlite3'));
const { WebSocketServer } = require(path.join(ssapp, 'node_modules/ws'));
const shop = 'fixture-store.myshopify.com', secret = 'fixture-webhook-signing-secret-32';
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'shopifyqa', password: 'false', state: false, settings: {}, wsServer: false }));
(async () => {
 const { createServer } = await import(pathToFileURL(path.join(root, 'monetization-server/server.js')).href);
 const key = crypto.randomBytes(32), dbFile = path.join(profile, 'receiver.db');
 let receiver, db, port = 0, app;
 async function start() { db = new Database(dbFile); receiver = await createServer({ shopify: { db, masterKey: key } }); await receiver.listen({ host: '127.0.0.1', port }); port = receiver.server.address().port; }
 await start();
 const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await new Promise(r => relay.once('listening', r));
 const send = data => relay.clients.forEach(c => c.send(JSON.stringify(data)));
 const wrapper = path.join(profile, 'bootstrap.cjs');
 fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
 try {
  app = await _electron.launch({ executablePath: path.join(ssapp, 'node_modules/electron/dist/electron.exe'), args: [wrapper, '--running-from-source', '--multiinstance', '--ssapp-headless-control', '--filesource', 'file:///' + root + '/', '--no-hwa'].filter(a => !process.env.SSN_GUIDE_SCREENSHOTS || a !== '--ssapp-headless-control'), cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
  const main = await app.firstWindow(); main.setDefaultTimeout(25000);
  await main.waitForFunction(() => document.querySelector('#frame2')?.contentWindow?.handleMonetizationRequest);
  const bg = main.frames().find(f => /background\.html/.test(f.url())), popup = main.frames().find(f => /popup\.html/.test(f.url()));
  async function capture(selector, filename, theme = 'light') {
   if (!process.env.SSN_GUIDE_SCREENSHOTS) return;
   const dir = path.join(root, 'docs/images/monetization'); fs.mkdirSync(dir, { recursive: true });
   await main.emulateMedia({ colorScheme: theme });
   await app.evaluate(({ BrowserWindow }, url) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url); w.setSize(1584, 1800); w.showInactive(); }, main.url());
   await popup.locator(selector).evaluate(e => e.scrollIntoView({ block: 'center' })); await popup.evaluate(() => window.scrollBy(0, -100)); await main.waitForTimeout(500);
   const box = await popup.locator(selector).boundingBox();
   const png = await app.evaluate(async ({ BrowserWindow }, args) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === args.url); return (await w.webContents.capturePage({ x: Math.floor(args.box.x), y: Math.floor(args.box.y), width: Math.ceil(args.box.width), height: Math.ceil(args.box.height) })).toPNG().toString('base64'); }, { url: main.url(), box });
   fs.writeFileSync(path.join(dir, filename), Buffer.from(png, 'base64'));
  }
  const request = data => popup.evaluate(data => new Promise(r => chrome.runtime.sendMessage(data, r)), data);
  await bg.evaluate(port => {
   const originalFetch = fetch, originalProcess = processIncomingMessage;
   settings.noduplicates = true;
   window.shopifyHandled = []; window.shopifyOutput = []; window.shopifyRequests = [];
   window.fetch = (url, options) => {
    const u = new URL(url);
    if (u.hostname === 'api.socialstream.ninja' && u.pathname.startsWith('/v1/shopify/')) return originalFetch('http://127.0.0.1:' + port + u.pathname, options);
    if (u.hostname === 'fixture-store.myshopify.com') {
     shopifyRequests.push({ url: String(url), options });
     return Promise.resolve({ ok: true, text: async () => JSON.stringify({ data: { product: { title: 'Creator T-shirt', availableForSale: true, onlineStoreUrl: 'https://example.com/products/creator-shirt', featuredImage: { url: 'https://cdn.shopify.com/s/files/1/0001/creator-shirt.png' }, priceRange: { minVariantPrice: { amount: '25.00', currencyCode: 'USD' }, maxVariantPrice: { amount: '25.00', currencyCode: 'USD' } } } } }) });
    }
    return originalFetch(url, options);
   };
   window.processIncomingMessage = data => { if (data.type === 'shopify') shopifyHandled.push(data); return originalProcess(data); };
   window.sendDataP2P = data => shopifyOutput.push(data);
  }, port);
  await main.locator('[data-page=streams]').click();
  await popup.evaluate(() => { document.getElementById('monetization-settings').open = true; applyPopupBeginnerMode(false); });
  await popup.waitForFunction(() => document.getElementById('money-current').textContent.includes('Load your wishlist'));
  await popup.locator('#money-shopify-panel > summary').click();
  await popup.locator('#money-shopify-shop').fill(shop);
  await popup.locator('#money-shopify-secret').fill(secret);
  await popup.locator('label[for=money-shopify-enabled]').click();
  await popup.locator('#money-save').click();
  await popup.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.');
  assert.equal(await popup.locator('#money-shopify-secret').inputValue(), '');
  const hook = new URL(await popup.locator('#money-shopify-webhook').inputValue()).pathname;
  const settings = await request({ cmd: 'monetization', action: 'get' }); assert(settings.config.shopify.enabled);
  assert(!JSON.stringify(settings).includes(secret));
  const order = (id, test = false) => ({ id, test, updated_at: new Date().toISOString(), financial_status: 'paid', total_price: '25.00', currency: 'USD', line_items: [{ product_id: 5, title: 'Creator T-shirt', quantity: 1 }], customer: { first_name: 'PRIVATE', email: 'private@example.invalid' }, note: 'PRIVATE' });
  const deliver = async (data, invalid) => { const body = JSON.stringify(data); return fetch('http://127.0.0.1:' + port + hook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Topic': 'orders/paid', 'X-Shopify-Shop-Domain': shop, 'X-Shopify-Hmac-Sha256': invalid ? 'x'.repeat(43) + '=' : crypto.createHmac('sha256', secret).update(body).digest('base64') }, body }); };
  assert.equal((await deliver(order(1), true)).status, 401);
  await deliver(order(2, true)); assert.equal(db.prepare('SELECT count(*) n FROM shopify_deliveries').get().n, 0);
  await deliver(order(1)); await deliver(order(1));
  assert.equal(await bg.evaluate(() => shopifyHandled.length), 0);
  await receiver.close(); db.close(); await start();
  await request({ cmd: 'setOnOffState', data: { value: true } });
  await bg.waitForFunction(() => shopifyHandled.length === 1);
  const event = await bg.evaluate(() => shopifyHandled[0]); assert.equal(event.event, 'purchase'); assert.match(event.id, /^shopify:[a-f0-9]{64}$/); assert.equal(event.hasDonation, undefined); assert(!JSON.stringify(event).includes('PRIVATE'));
  await bg.waitForFunction(() => shopifyOutput.some(e => e.type === 'shopify'));
  // Import through the actual popup into the common product editor, independently of alerts.
  await popup.locator('#money-shopify-import-panel > summary').click();
  await popup.locator('#money-shopify-product').fill('https://example.com/products/creator-shirt');
  await popup.locator('#money-shopify-import').click();
  await popup.waitForFunction(() => document.getElementById('money-commerce-name').value === 'Creator T-shirt');
  assert.equal(await popup.locator('#money-commerce-price').inputValue(), '25');
  const imports = await bg.evaluate(() => shopifyRequests); assert.equal(imports.length, 1); assert(!imports[0].options.headers['X-Shopify-Storefront-Access-Token']); assert.equal(JSON.parse(imports[0].options.body).variables.handle, 'creator-shirt');
  assert.equal(await popup.locator('#money-commerce-image').inputValue(), 'https://cdn.shopify.com/s/files/1/0001/creator-shirt.png');
  await capture('#money-commerce-panel', 'shopify-import.png');
  await popup.locator('#money-commerce-add').click();
  await popup.locator('label[for=money-commerce-enabled]').click();
  await popup.locator('#money-save').click(); await popup.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.');
  const updated = await request({ cmd: 'monetization', action: 'get' }); assert.equal(updated.config.commerce.items.length, 1);
  const snapshot = await bg.evaluate(() => shopifyOutput.filter(e => e.event === 'monetization_update').pop());
  const waiting = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { backgroundThrottling: false } }).loadURL(url), 'file:///' + root + '/monetization.html?session=shopifyqa&mode=commerce&view=alerts&onlytype=shopify&server=ws://127.0.0.1:' + relay.address().port);
  const overlay = await waiting; await overlay.waitForLoadState(); await overlay.waitForTimeout(400); send(snapshot); send(event);
  await overlay.waitForFunction(() => document.getElementById('title').textContent.includes('Purchase: Anonymous'));
  assert(await overlay.locator('#qr').isHidden());
  if (process.env.SSN_GUIDE_SCREENSHOTS) {
   const dir = path.join(root, 'docs/images/monetization'); fs.mkdirSync(dir, { recursive: true });
   await overlay.locator('#support-card').screenshot({ path: path.join(dir, 'shopify-purchase.png') });
   await popup.locator('#money-shopify-import-panel > summary').click();
   await capture('#money-shopify-section', 'shopify-setup.png');
   await capture('#money-shopify-section', 'shopify-setup-dark.png', 'dark');
   await main.emulateMedia({ colorScheme: 'light' });
  }
  // Popup reload must not lose the receiver; disabling stops local processing without deleting queued work.
  await Promise.all([popup.waitForNavigation({ waitUntil: 'domcontentloaded' }), popup.evaluate(() => location.reload())]); await popup.waitForFunction(() => document.getElementById('money-shopify-webhook')?.value.includes('/v1/shopify/webhook/'));
  await request({ cmd: 'setOnOffState', data: { value: false } });
  await deliver(order(3)); await main.waitForTimeout(1500); assert.equal(await bg.evaluate(() => shopifyHandled.length), 1);
  await request({ cmd: 'setOnOffState', data: { value: true } }); await bg.waitForFunction(() => shopifyHandled.length === 2); await bg.waitForFunction(() => shopifyOutput.filter(e => e.type === 'shopify').length === 2);
  await deliver(order(1)); await main.waitForTimeout(5500); assert.equal(await bg.evaluate(() => shopifyHandled.length), 2);
  const disconnected = await request({ cmd: 'monetization', action: 'shopifyDisconnect' }); assert.equal(disconnected.config.shopify.enabled, false); assert.equal(db.prepare('SELECT count(*) n FROM shopify_receivers').get().n, 0);
  console.log('PASS: Shopify signed queue -> actual SSApp -> purchase overlay, privacy, test isolation, restart, dedupe, product import, persistence and disconnect. Profile:', profile);
 } finally {
  if (app) await app.close(); if (receiver) await receiver.close(); if (db.open) db.close(); relay.clients.forEach(c => c.terminate()); await new Promise(r => relay.close(r));
 }
})().catch(e => { console.error(e); process.exitCode = 1; });
