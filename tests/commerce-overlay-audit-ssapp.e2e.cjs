// Manual actual-SSApp visual, QR, malformed-input and bounded-throughput audit.
// Isolated profile/local relay; no live source channels, providers or payments.
const { _electron } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..').replace(/\\/g, '/'), ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const { WebSocketServer } = require(path.join(ssapp, 'node_modules/ws'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-overlay-audit-'));
const report = { failures: [], checks: [], metrics: [], artifacts: profile };
function check(ok, label, details) { (ok ? report.checks : report.failures).push({ label, details }); }
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: 'isolated-overlay-audit', password: 'false', state: false, settings: {}, wsServer: false }));
(async () => {
 const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await new Promise(r => relay.once('listening', r));
 const rooms = new Map();
 relay.on('connection', c => c.on('message', raw => { const d = JSON.parse(String(raw)); if (d.join) { c.room = d.join; if (rooms.has(c.room)) c.send(JSON.stringify(rooms.get(c.room))); } }));
 function send(room, payload) { for (const c of relay.clients) if (c.room === room && c.readyState === 1) c.send(JSON.stringify(payload)); }
 function snapshot(room, state) { const payload = { event: 'monetization_update', meta: { monetization: state } }; rooms.set(room, payload); send(room, payload); }
 const wrapper = path.join(profile, 'bootstrap.cjs');
 fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
 let app;
 try {
  app = await _electron.launch({ executablePath: path.join(ssapp, 'node_modules/electron/dist/electron.exe'), args: [wrapper, '--running-from-source', '--multiinstance', '--filesource', 'file:///' + root + '/', '--no-hwa'], cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
  await app.firstWindow();
  const urls = { commerce: 'https://example.com/products/art-print?variant=blue', ebay: 'https://www.ebay.com/itm/123456789012', throne: 'https://throne.com/fixture', ninja: 'https://ninjabacker.com/fixture', wishlist: 'https://www.amazon.com/hz/wishlist/ls/FIXTURE123?ref_=wl_share' };
  function stateFor(mode, long) {
   const name = long ? 'A very detailed product description '.repeat(5).slice(0,180) : 'Studio art print';
   const item = { id: '123456789012', name, url: urls[mode], amount: 25, currency: 'USD', purpose: 'shop', auction: true, endsAt: Date.now()+3600000, updatedAt: Date.now(), available: true, bought: false };
   return { [mode]: { enabled: true, qr: true, position: 'br', username: 'fixture', rank: 2, total: 3, gifts: 1, url: urls[mode], item, items: [item], display: 'first', seconds: 15, environment: 'sandbox' } };
  }
  async function page(mode, view = 'both') {
   const room = mode + '-' + view;
   snapshot(room, stateFor(mode, false));
   const wait = app.waitForEvent('window');
   await app.evaluate(async ({ BrowserWindow }, o) => { const w = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { backgroundThrottling: false } }); await w.loadURL(o.url); w.showInactive(); }, { url: 'file:///' + root + '/monetization.html?session=' + room + '&mode=' + mode + '&view=' + view + '&server=ws://127.0.0.1:' + relay.address().port });
   const p = await wait; p.setDefaultTimeout(12000); await p.waitForLoadState();
   for(let attempt=0;attempt<100 && !Array.from(relay.clients).some(c=>c.room===room);attempt++)await p.waitForTimeout(50);
   assert(Array.from(relay.clients).some(c=>c.room===room),'overlay relay joined '+room);
   const errors = []; p.on('pageerror', e => errors.push(e.message));
   return { p, room, errors };
  }
  for (const guide of ['monetization','product-controls','thermal-printer-guide']) {
   const waiting=app.waitForEvent('window');
   await app.evaluate(async({BrowserWindow},url)=>{const w=new BrowserWindow({show:false,width:1280,height:900});await w.loadURL(url);w.showInactive();},'file:///'+root+'/docs/'+guide+'.html');
   const guidePage=await waiting;await guidePage.waitForLoadState();
   for(const width of [1280,390]){
    await app.evaluate(({BrowserWindow},o)=>{BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===o.url).setContentSize(o.width,900);},{url:guidePage.url(),width});await guidePage.waitForTimeout(150);
    const dim=await guidePage.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));check(dim.scroll<=dim.width+1,guide+' guide fits '+width,dim);
    await guidePage.screenshot({path:path.join(profile,guide+'-'+width+'.png')});
   }
   await guidePage.close();
  }
  const qrFiles = [];
  for (const mode of Object.keys(urls)) {
   const { p, room, errors } = await page(mode);
   await p.locator('#qr').waitFor();
   const qrPath = path.join(profile, 'qr-' + mode + '.png'); await p.screenshot({ path: qrPath, clip: await p.locator('#qr').boundingBox() }); qrFiles.push({ path: qrPath, expected: urls[mode] });
   if(mode==='commerce'){
    const published=stateFor(mode,false);published.commerce.viewerURL='https://socialstream.ninja/shop.html?id='+'a'.repeat(64);snapshot(room,published);
    await p.waitForFunction(url=>document.getElementById('qr').title===url,published.commerce.viewerURL);
    const publicQR=path.join(profile,'qr-public-viewer.png');await p.screenshot({path:publicQR,clip:await p.locator('#qr').boundingBox()});qrFiles.push({path:publicQR,expected:published.commerce.viewerURL});
   }
   for (const long of [false, true]) {
    snapshot(room, stateFor(mode, long));
    for (const width of [1920, 390, 320]) {
     await p.setViewportSize({ width, height: width===1920?1080:568 });
     for (const scale of [0.5, 1, 2]) {
      await p.evaluate(scale => document.getElementById('support-card').style.setProperty('--monetization-scale', scale), scale);
      await p.waitForTimeout(300);
      const box = await p.locator('#support-card').evaluate(e => { const b = e.getBoundingClientRect(); return { left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:innerWidth,height:innerHeight,scroll:e.scrollWidth,client:e.clientWidth }; });
      check(box.left>=-1 && box.top>=-1 && box.right<=box.width+1 && box.bottom<=box.height+1 && box.scroll<=box.client+1, `${mode} layout width=${width} scale=${scale} long=${long}`, box);
      if (width===390 && scale===1) await p.screenshot({ path:path.join(profile,`${mode}-${long?'long':'short'}.png`), omitBackground:true });
     }
    }
   }
   snapshot(room,stateFor(mode,false));
   await p.evaluate(()=>{const now=Date.now;Date.now=()=>now()+40000;});await p.waitForTimeout(400);
   check(await p.locator('#support-card').isHidden(),mode+' stale card hides');
   check(await p.locator('#overlay-status').isHidden(),mode+' stale overlay contains no operator status');
   await p.close(); check(!errors.length,mode+' no browser exceptions',errors);
  }
  for(const mode of Object.keys(urls)) for(const view of ['showcase','card','alerts']){
   const {p,room,errors}=await page(mode,view);await p.waitForTimeout(400);
   check(view==='alerts'?await p.locator('#support-card').isHidden():await p.locator('#support-card').isVisible(),mode+' '+view+' initial visibility');
   const previous=await p.locator('#title').textContent();
   let event={id:'view-fixture',type:mode==='commerce'?'fourthwall':mode==='ninja'?'ninjabacker':mode,event:mode==='throne'?'gift':'purchase',chatname:'Juniper',hasDonation:mode==='ninja'?'$5.00':undefined,subtitle:'Studio art print',meta:{ebayPurchase:{itemName:'Studio art print',quantity:1}}};
   if(mode==='wishlist'){event={event:'monetization_update',meta:{monetization:stateFor(mode,false),wishlistPurchase:{id:'view-fixture',name:'Studio art print',supporter:'Juniper',at:Date.now()}}};}
   send(room,event);await p.waitForTimeout(400);
   check(view==='alerts'?await p.locator('#support-card').isVisible():(await p.locator('#title').textContent())===previous,mode+' '+view+' separates promotions and receipts');
   if(view==='alerts'&&(mode==='commerce'||mode==='ebay'))check(await p.locator('#qr').isHidden(),mode+' receipt has no unrelated QR');
   const disabled=stateFor(mode,false);disabled[mode].enabled=false;snapshot(room,disabled);await p.waitForTimeout(300);check(await p.locator('#support-card').isHidden(),mode+' '+view+' respects disable');
   check(!errors.length,mode+' '+view+' no exceptions',errors);await p.close();
  }
  const qr = spawnSync('python', ['-c', 'import cv2,json,sys; q=cv2.QRCodeDetector(); rows=json.loads(sys.argv[1]); print(json.dumps([{**r,"decoded":q.detectAndDecode(cv2.imread(r["path"]))[0]} for r in rows]))', JSON.stringify(qrFiles)], { encoding:'utf8' });
  check(qr.status===0,'QR decoder available',qr.stderr);
  if(qr.status===0) for(const row of JSON.parse(qr.stdout)) check(row.decoded===row.expected,'decoded QR '+path.basename(row.path),row.decoded);
  const {p,room,errors}=await page('commerce','alerts');
  await p.waitForTimeout(400);
  const privateEvent={type:'kofi',event:'gift',id:'private-fixture',chatname:'PRIVATE SHOULD NOT DISPLAY',private:true};
  send(room,privateEvent);await p.waitForTimeout(400);check(await p.locator('#support-card').isHidden(),'private commerce event is not displayed');
  send(room,{type:'kofi',event:'gift',id:'test-fixture',chatname:'TEST SHOULD NOT DISPLAY',isTest:true});await p.waitForTimeout(300);check(await p.locator('#support-card').isHidden(),'test commerce event is not counted as paid activity');
  send(room,{type:'kofi',event:'gift',id:'html-fixture',chatname:'Jess',textonly:false,chatmessage:'<b>Thank you</b> <img src="https://example.invalid/emote.png" alt="Kappa"><script>window.evil=true</script>'});
  await p.waitForFunction(()=>document.getElementById('title').textContent.includes('Jess'));
  check(await p.locator('#detail').textContent()==='Thank you Kappa','rich chat is readable plain text in commerce alerts');
  check(await p.evaluate(()=>!window.evil),'rich chat never executes embedded scripts');
  await p.close();
  for (const tipMode of ['ninja','commerce']) {
   const tipPage=await page(tipMode,'alerts');
   const tip=require('../shared/monetization/core.js').tip({type:'tip',amount:5,currency:'USD',timestamp:Date.now(),fromLabel:'Long note donor',message:'x'.repeat(500)});
   check(tip.id.length>256,tipMode+' long canonical fallback ID fixture');
   send(tipPage.room,tip);await tipPage.p.waitForFunction(()=>document.getElementById('title').textContent.includes('Long note donor'));
   check(await tipPage.p.locator('#support-card').isVisible(),tipMode+' long-note tip remains visible');await tipPage.p.close();
  }
  const fuzz=await page('commerce','showcase');
  await fuzz.p.locator('#qr').waitFor();
  const session=await fuzz.p.context().newCDPSession(fuzz.p);await session.send('Performance.enable');await session.send('HeapProfiler.collectGarbage');
  const before=await session.send('Performance.getMetrics');
  const started=Date.now();
  const malformed=[null,[],{},true,2,'oops',{commerce:null},{commerce:true},{commerce:{enabled:true,items:[null,{},'bad']}},{commerce:{enabled:true,items:{}}}];
  for(let batch=0;batch<100;batch++) {
   send(fuzz.room,Array.from({length:100},(_,i)=>({event:'monetization_update',meta:{monetization:malformed[(batch+i)%malformed.length]}})));
   if(batch%10===0)await fuzz.p.waitForTimeout(30);
  }
  await fuzz.p.waitForTimeout(500);snapshot(fuzz.room,stateFor('commerce',false));await fuzz.p.locator('#qr').waitFor();
  await session.send('HeapProfiler.collectGarbage');const after=await session.send('Performance.getMetrics');
  const metric=(r,n)=>r.metrics.find(m=>m.name===n)?.value;
  report.metrics.push({label:'10,000 malformed snapshots + recovery',elapsedMs:Date.now()-started,heapBefore:metric(before,'JSHeapUsedSize'),heapAfter:metric(after,'JSHeapUsedSize'),taskDurationDelta:metric(after,'TaskDuration')-metric(before,'TaskDuration')});
  check(!fuzz.errors.length,'malformed snapshots do not cause browser exceptions',fuzz.errors.slice(0,10));await fuzz.p.close();
 } finally { if(app)await app.close(); for(const c of relay.clients)c.terminate(); await new Promise(r=>relay.close(r)); }
 fs.writeFileSync(path.join(profile,'results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,metrics:report.metrics,artifacts:profile},null,2));
 assert.equal(report.failures.length,0,'See audit report for visual/input failures');
})().catch(error=>{fs.writeFileSync(path.join(profile,'results.json'),JSON.stringify({...report,error:error.stack},null,2));console.error(error);console.log('Artifacts:',profile);process.exitCode=1});
