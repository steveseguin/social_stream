// Actual SSApp, local signed receiver and isolated catalog fixtures. No live stores or payments.
const { _electron } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..').replace(/\\/g, '/'), ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-product-controls-'));
const Database = require(path.join(root, 'monetization-server/node_modules/better-sqlite3'));
const { WebSocketServer } = require(path.join(ssapp, 'node_modules/ws'));
const shop = 'fixture-store.myshopify.com', secret = 'fixture-webhook-signing-secret-32';
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'shopifyqa', password: 'false', state: false, settings: {}, wsServer: false }));
(async () => {
 const { createServer } = await import(pathToFileURL(path.join(root, 'monetization-server/server.js')).href);
 const key = crypto.randomBytes(32), dbFile = path.join(profile, 'receiver.db');
 let receiver, db, port = 0, app;
 async function start() { db = new Database(dbFile); receiver = await createServer({ publicShop: { db } }); await receiver.listen({ host: '127.0.0.1', port }); port = receiver.server.address().port; }
 await start();
 const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await new Promise(r => relay.once('listening', r));
 relay.on('connection', client => client.on('message', raw => { let data; try { data=JSON.parse(String(raw)); } catch (_) { return; } if(data.join && data.out===1 && data.in===2) client.isControlDock=true; if(data.action || data.callback) relay.clients.forEach(other => { if(other!==client && other.readyState===1) other.send(String(raw)); }); }));
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
   const realFetch = window.fetch;
   window.productSnapshots = [];
   window.sendDataP2P = data => productSnapshots.push(data);
   window.fetch = (url, options) => {
    if (String(url).startsWith('https://api.socialstream.ninja/v1/shop')) return realFetch(String(url).replace('https://api.socialstream.ninja', 'http://127.0.0.1:' + port), options);
    if (String(url) === 'https://creator.gumroad.com/l/print') return Promise.resolve(new Response('<title>Fallback</title><meta property="og:title" content="Studio &amp; art print"><meta property="og:image" content="https://example.com/print.png"><script>window.importExecuted=true</script>', { headers: { 'Content-Type': 'text/html' } }));
    return realFetch(url, options);
   };
  }, port);
  await main.locator('[data-page=streams]').click();
  await popup.evaluate(() => { document.getElementById('monetization-settings').open = true; applyPopupBeginnerMode(false); });
  await popup.waitForFunction(() => document.getElementById('money-current').textContent.includes('Load your wishlist'));
  await popup.locator('#money-commerce-panel > summary').click();
  await popup.locator('#money-commerce-url').fill('https://creator.gumroad.com/l/print');
  await popup.locator('#money-product-import').click();
  await popup.waitForFunction(() => document.getElementById('money-commerce-name').value === 'Studio & art print');
  assert.equal(await popup.locator('#money-commerce-price').inputValue(), '');
  assert.equal(await bg.evaluate(() => !!window.importExecuted), false);
  assert.equal(await popup.locator('#money-commerce-image').inputValue(), 'https://example.com/print.png');
  await popup.locator('#money-commerce-image').fill('');
  await popup.locator('#money-commerce-price').fill('25');
  await popup.locator('#money-commerce-add').click();
  await popup.locator('#money-commerce-name').fill('Support the show');
  await popup.locator('#money-commerce-url').fill('https://ninjabacker.com/example');
  await popup.locator('#money-commerce-purpose').selectOption('support');
  await popup.locator('#money-commerce-add').click();
  assert(await popup.locator('#money-commerce-items button').filter({hasText:'Show now'}).first().isDisabled());
  assert((await popup.locator('#money-commerce-items').textContent()).includes('Unsaved'));
  await popup.locator('label[for=money-commerce-enabled]').click();
  await request({cmd:'setOnOffState',data:{value:true}});
  await popup.locator('#money-save').click();
  await popup.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.');
  await popup.locator('#money-commerce-live > summary').click();
  const show = popup.locator('#money-commerce-items button').filter({hasText:'Show now'});
  await show.first().click();
  await popup.waitForFunction(() => document.getElementById('money-commerce-live-status').textContent.includes('Selected product'));
  let config = await request({cmd:'monetization',action:'get'}); assert.equal(config.commerceLive.url, 'https://creator.gumroad.com/l/print');
  await capture('#money-commerce-controls', 'product-controls.png');
  await capture('#money-commerce-controls', 'product-controls-dark.png','dark');
  await main.emulateMedia({colorScheme:'light'});
  async function page(url, width=800, height=600) {
   const wait=app.waitForEvent('window');
   await app.evaluate(({BrowserWindow},o)=>new BrowserWindow({show:false,width:o.width,height:o.height,webPreferences:{backgroundThrottling:false}}).loadURL(o.url),{url,width,height});
   const p=await wait; await p.waitForLoadState(); p.setDefaultTimeout(15000); return p;
  }
  const overlay=await page('file:///'+root+'/monetization.html?session=productqa&mode=commerce&view=both&server=ws://127.0.0.1:'+relay.address().port);
  await overlay.waitForTimeout(350);
  async function snapshot() {const snap=await bg.evaluate(()=>productSnapshots.filter(d=>d.event==='monetization_update').pop());send(snap);return snap;}
  await snapshot(); await overlay.waitForFunction(()=>document.getElementById('title').textContent==='Studio & art print');
  await popup.locator('#money-commerce-next').click();
  await bg.waitForFunction(async()=>(await handleMonetizationRequest({action:'get'})).commerceLive.url==='https://ninjabacker.com/example');
  await snapshot(); await overlay.waitForFunction(()=>document.getElementById('title').textContent==='Support the show');
  await popup.locator('#money-commerce-hide').click();
  await bg.waitForFunction(async()=>(await handleMonetizationRequest({action:'get'})).commerceLive.mode==='hide');
  await snapshot(); await overlay.locator('#support-card').waitFor({state:'hidden'});
  send({type:'fourthwall',platform:'fourthwall',event:'purchase',id:'fixture-purchase',chatname:'Jess',subtitle:'Studio print'});
  await overlay.waitForFunction(()=>document.getElementById('title').textContent.includes('Purchase: Jess'));
  assert(await overlay.locator('#qr').isHidden());
  const keyReply = await bg.evaluate(()=>routeStreamDeckRemoteRequest({protocol:2,action:'commerceShow',value:'https://creator.gumroad.com/l/print',get:'commerce-key-1'},{transport:'websocket'}));
  const readState = await bg.evaluate(()=>routeStreamDeckRemoteRequest({protocol:2,action:'getCommerceState',get:'state-key'},{transport:'websocket'}));
  assert.equal(readState.result.payload.commerce.selected.name,'Studio & art print');
  assert.equal(readState.result.payload.commerce.items.length,2);
  assert.equal(keyReply.result.ok,true); assert.equal(keyReply.result.payload.command,'show');
  const invalidReply = await bg.evaluate(()=>routeStreamDeckRemoteRequest({protocol:2,action:'commerceNext',value:-1,get:'commerce-key-invalid'},{transport:'websocket'}));
  assert.equal(invalidReply.result.ok,false);
  await bg.waitForFunction(()=>!!window.eventFlowSystem);
  await bg.evaluate(()=>eventFlowSystem.executeAction({actionType:'commerceControl',config:{command:'show',url:'https://creator.gumroad.com/l/print',seconds:1}},{}));
  config=await request({cmd:'monetization',action:'get'}); assert(config.commerceLive.until>Date.now()-1500);
  await bg.evaluate(port=>{settings.socketserver=true;serverURL='ws://127.0.0.1:'+port;setupSocket();},relay.address().port);
  await bg.waitForFunction(()=>socketserver && socketserver.readyState===1);
  const controlDock=await page('file:///'+root+'/obs-control-dock.html?session=shopifyqa&commerce&server=ws://127.0.0.1:'+relay.address().port,390,850);
  await controlDock.waitForFunction(()=>document.querySelectorAll('#commerce-product option').length===2);
  assert.equal(await controlDock.locator('body > details:not([hidden])').count(),1);
  await controlDock.locator('#commerce-product').selectOption('https://ninjabacker.com/example');
  await controlDock.locator('[data-commerce=show]').click();
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Selected product: Support the show'));
  await controlDock.locator('[data-commerce=next]').click();
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Selected product: Studio & art print'));
  await controlDock.locator('[data-commerce=hide]').click();
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent==='Products hidden');
  await controlDock.locator('[data-commerce=resume]').click();
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Scheduled product'));
  await controlDock.locator('#commerce-product').selectOption('https://creator.gumroad.com/l/print');
  await controlDock.locator('[data-commerce=show]').click();
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Selected product: Studio & art print'));
  assert(await controlDock.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.SSN_GUIDE_SCREENSHOTS) {
   await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).showInactive(),controlDock.url());
   await controlDock.waitForTimeout(350);
   const box=await controlDock.locator('#commerce-controls').boundingBox();
   const png=await app.evaluate(async({BrowserWindow},o)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===o.url);return(await w.webContents.capturePage({x:Math.floor(o.box.x),y:Math.floor(o.box.y),width:Math.ceil(o.box.width),height:Math.ceil(o.box.height)})).toPNG().toString('base64');},{url:controlDock.url(),box});
   fs.writeFileSync(path.join(root,'docs/images/monetization/obs-product-controls.png'),Buffer.from(png,'base64'));
  }
  await controlDock.locator('#commerce-duration').fill('1');
  await controlDock.locator('[data-commerce=hide]').click();
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('remaining'));
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Scheduled product'));
  relay.clients.forEach(client=>{if(client.isControlDock)client.terminate();});
  await controlDock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Disconnected'));
  assert(await controlDock.locator('[data-commerce=show]').isDisabled());
  await controlDock.waitForFunction(()=>!document.querySelector('[data-commerce=show]').disabled);
  await controlDock.close();
  send({action:'commerceControl',command:'hide'});
  await bg.waitForFunction(async()=>(await handleMonetizationRequest({action:'get'})).commerceLive.mode==='hide');
  send({action:'commerceControl',command:'show',url:'https://creator.gumroad.com/l/print'});
  await bg.waitForFunction(async()=>(await handleMonetizationRequest({action:'get'})).commerceLive.mode==='show');
  await popup.locator('#money-public-shop').evaluate(e=>{for(let p=e;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
  await popup.locator('#money-shop-publish').click();
  await popup.waitForFunction(()=>document.getElementById('money-shop-url').value.includes('/shop.html?id='));
  const publicURL=await popup.locator('#money-shop-url').inputValue(), id=new URL(publicURL).searchParams.get('id');
  assert(!publicURL.includes('shopifyqa')); assert(!publicURL.includes('session'));
  await capture('#money-public-shop','public-shop-setup.png');
  const clean=await request({cmd:'monetization',action:'get'}); assert(!JSON.stringify(clean).includes('"key"'));
  const viewer=await page('file:///'+root+'/shop.html?id='+id,390,844);
  await viewer.evaluate(port=>{const f=fetch;window.fetch=(url,o)=>f(String(url).replace('https://api.socialstream.ninja','http://127.0.0.1:'+port),o);},port);
  await viewer.evaluate(()=>window.dispatchEvent(new CustomEvent('ssn-page-language-changed')));
  await viewer.locator('.shop-item').first().waitFor(); assert.equal(await viewer.locator('.shop-item').count(),2);
  assert.equal(await viewer.locator('.featured h2').textContent(),'Studio & art print');
  assert(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.SSN_GUIDE_SCREENSHOTS) {
   await app.evaluate(({BrowserWindow},url)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url);w.showInactive();},viewer.url());
   await viewer.waitForTimeout(500);
   const crop=await viewer.locator('.viewer-shop').boundingBox();
   const png=await app.evaluate(async({BrowserWindow},o)=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===o.url).webContents.capturePage({x:0,y:0,width:390,height:Math.min(844,Math.ceil(o.crop.y+o.crop.height+16))})).toPNG().toString('base64'),{url:viewer.url(),crop});
   fs.writeFileSync(path.join(root,'docs/images/monetization/viewer-shop.png'),Buffer.from(png,'base64'));
  }
  const promo=await page('file:///'+root+'/monetization.html?session=productqa&mode=commerce&view=showcase&server=ws://127.0.0.1:'+relay.address().port);
  await promo.waitForTimeout(350);await snapshot();await promo.locator('#qr').waitFor();assert.equal(await promo.locator('#qr').getAttribute('title'),publicURL);
  await popup.locator('#money-commerce-hide').click();await bg.waitForFunction(async()=>(await handleMonetizationRequest({action:'get'})).commerceLive.mode==='hide');
  await viewer.evaluate(()=>window.dispatchEvent(new CustomEvent('ssn-page-language-changed')));
  await viewer.waitForFunction(()=>!document.querySelector('.featured'));assert.equal(await viewer.locator('.shop-item').count(),2);
  await popup.locator('#money-shop-remove').click();await popup.waitForFunction(()=>!document.getElementById('money-shop-url').value).catch(async error=>{console.log('Unpublish UI:',await popup.locator('#money-shop-status').textContent(), 'State:', (await request({cmd:'monetization',action:'get'})).publicShop);throw error;});
  await viewer.evaluate(()=>window.dispatchEvent(new CustomEvent('ssn-page-language-changed')));
  await viewer.waitForFunction(()=>!document.querySelector('.shop-item'));
  assert.equal((await fetch('http://127.0.0.1:'+port+'/v1/shop/'+id)).status,404);
  console.log('PASS: actual SSApp public import, live controls, Event Flow, remote API, independent alerts, stable viewer QR, public page, unpublish, light/dark screenshots. Profile:',profile);
 } finally {
  if(app)await app.close();if(receiver)await receiver.close();if(db.open)db.close();relay.clients.forEach(c=>c.terminate());await new Promise(r=>relay.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
