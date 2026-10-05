// Isolated actual SSApp, local relay and fictional commerce data. No live sources/accounts.
const {_electron} = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('node:assert/strict');
const B = require('../shared/monetization/boards.js');
const root = path.resolve(__dirname,'..').replace(/\\/g,'/'), ssapp = process.env.SSAPP_REPO || path.resolve(root,'../ssapp');
const {WebSocketServer} = require(path.join(ssapp,'node_modules/ws'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(),'ssn-commerce-boards-'));
const screenshots = process.env.SSN_GUIDE_SCREENSHOTS === '1';
fs.writeFileSync(path.join(profile,'savedSync.json'),JSON.stringify({streamID:'isolated-board-fixture',password:'false',state:false,settings:{},wsServer:false}));
const wrapper=path.join(profile,'bootstrap.cjs');
fs.writeFileSync(wrapper,`const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
(async()=>{
 let app, latestPublished; const relay=new WebSocketServer({host:'127.0.0.1',port:0}); await new Promise(r=>relay.once('listening',r));
  relay.on('connection',c=>c.on('message',r=>{const d=JSON.parse(String(r));if(d.join){c.room=d.join;if(latestPublished)c.send(latestPublished);}}));
 const send=state=>{latestPublished=JSON.stringify({event:'monetization_update',meta:{monetization:{boards:B.publicState(state)}}});for(const c of relay.clients)if(c.readyState===1)c.send(latestPublished);};
 try {
  app=await _electron.launch({executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'),args:[wrapper,'--running-from-source','--multiinstance','--filesource','file:///'+root+'/','--no-hwa'],cwd:ssapp,env:{...process.env,SSAPP_USER_DATA_DIR:profile,SSAPP_DIAGNOSTICS_SAFE_GPU:'1'}});
  app.process().stderr.on('data',d=>{ if (/crash|fatal|memory|error/i.test(String(d))) process.stderr.write(d); });
  await app.evaluate(({app})=>app.on('web-contents-created',(_,c)=>c.on('render-process-gone',(_,details)=>console.error('RENDER GONE',JSON.stringify(details)))));
  const main=await app.firstWindow();main.setDefaultTimeout(20000);
  main.on('pageerror',e=>console.error('STARTUP PAGE',e.message));
  main.on('console',m=>{if(m.type()==='error' && !m.text().includes('ERR_BLOCKED_BY_CLIENT'))console.error('APP CONSOLE',m.text().slice(0,400));});
  try {
   await main.waitForFunction(()=>Array.from(document.querySelectorAll('iframe')).some(f=>f.src.includes('background.html')),null,{timeout:45000});
   for(let i=0;i<90&&!main.frames().some(f=>/background\.html/.test(f.url()));i++)await main.waitForTimeout(500);
   await main.frames().find(f=>/background\.html/.test(f.url())).waitForFunction(()=>typeof handleMonetizationRequest==='function',null,{timeout:45000});
  }
  catch(error) { console.error('STARTUP FRAMES',main.url(),main.frames().map(f=>f.url()));await main.screenshot({path:path.join(profile,'startup-failure.png')});throw error; }
  const bg=main.frames().find(f=>/background\.html/.test(f.url())),popup=main.frames().find(f=>/popup\.html/.test(f.url()));
  const request=data=>bg.evaluate(d=>handleMonetizationRequest(d),data);
  await bg.evaluate(()=>{isExtensionOn=true;});
  const errors=[]; main.on('pageerror',e=>errors.push(e.message));
  await main.locator('[data-page=streams]').click();
  await popup.evaluate(()=>{document.getElementById('monetization-settings').open=true;applyPopupBeginnerMode(false);document.querySelector('.commerce-board-controls').open=true;});
  const panel=popup.locator('.commerce-board-controls');
  await panel.locator('[data-board-status]').filter({hasText:'0 spots'}).waitFor();
  await panel.locator('details').first().locator('summary').click();
  await panel.locator('[data-action=save]').click();
  await panel.locator('.cb-spots button').nth(119).waitFor();
  await panel.locator('.cb-spots button').nth(11).click();
  await panel.locator('[data-action=claimed]').click();
  await panel.locator('[data-selected]').filter({hasText:'claimed'}).waitFor();
  await panel.locator('[data-field=result]').fill('Holographic card');
  await panel.locator('[data-action=revealed]').click();
  await panel.locator('[data-selected]').filter({hasText:'revealed'}).waitFor();
  let state=(await request({action:'getCommerceState'})).commerce.boards;
  assert.equal(state.board.spots[11].result,'Holographic card');assert.equal(state.sales.length,0);
  await panel.locator('[data-action=copy]').click();
  assert.match(await panel.locator('[data-field=link]').inputValue(),/commerce-board\.html\?.*session=/);
  assert(!(await panel.locator('[data-field=link]').inputValue()).includes('demo'));
  const manual=await request({action:'commerceControl',command:'saleAdd',data:{title:'Signed rookie card',amount:38,currency:'USD'}});assert(!manual.error);
  await request({action:'commerceControl',command:'salesSettings',data:{automatic:true,visible:true}});
  const fixture={type:'shopify',platform:'shopify',event:'purchase',id:'shopify:'+'a'.repeat(64),subtitle:'Collector jersey',chatname:'Shopify buyer',chatmessage:'Purchased Collector jersey',textonly:true,meta:{commerce:{quantity:2}}};
  await bg.evaluate(async d=>{await processIncomingMessage(d);await new Promise(r=>setTimeout(r,100));},fixture);
  await bg.evaluate(async d=>{await processIncomingMessage(d);await new Promise(r=>setTimeout(r,100));},fixture);
  state=(await request({action:'getCommerceState'})).commerce.boards;
  assert.equal(state.sales.length,2); assert.equal(state.sales[0].title,'Collector jersey');assert.equal(state.sales[0].amount,null);
  await bg.evaluate(async()=>{await recordCommercePurchase({type:'whatnot',event:'auction_update',id:'bid',subtitle:'Not sold'});await recordCommercePurchase({type:'ebay',event:'purchase',id:'test',subtitle:'Not sold',chatname:'eBay Sandbox buyer'});});
  assert.equal((await request({action:'getCommerceState'})).commerce.boards.sales.length,2);
  // Seller workflow uses actual source-shaped snapshots through the application's intake.
  await panel.locator('details').last().evaluate(e=>e.open=true);
  for(const type of ['whatnot','ebay']) {
   await panel.locator('[data-field=auction-source]').selectOption(type);
   if(!await panel.locator('[data-field=visible]').isChecked())await panel.locator('.cb-toggle').nth(0).click();
   if(!await panel.locator('[data-field=automatic]').isChecked())await panel.locator('.cb-toggle').nth(1).click();
   await panel.locator('[data-action=settings]').click();
   const title=type+' live fixture item';
   await bg.evaluate(async d=>processIncomingMessage(d),{type,event:'auction_update',meta:{title,status:'won',price:42,priceText:'$42',winnerName:'Private winner',bidder:'Private bidder'}});
   await panel.locator('[data-action=refresh]').click();await panel.locator('[data-auction]').filter({hasText:title}).waitFor();
   assert.equal((await request({action:'getCommerceState'})).commerce.boards.sales.length,2);
   await panel.locator('[data-action=auction]').click();assert.equal(await panel.locator('[data-field=sale-title]').inputValue(),title);
   assert.equal(await panel.locator('[data-field=amount]').inputValue(),'');
   await bg.evaluate(async d=>processIncomingMessage(d),{type,event:'auction_update',meta:{title:'Next item',status:'active',price:5,priceText:'$5'}});
   await panel.locator('[data-action=refresh]').click();await panel.locator('[data-auction]').filter({hasText:'Next item'}).waitFor();
   assert.equal(await panel.locator('[data-field=sale-title]').inputValue(),title,'incoming auctions preserve the seller draft');
   await panel.locator('[data-field=sale-title]').fill('');
  }
  await bg.evaluate(async()=>processIncomingMessage({type:'ebay',event:'auction_update',meta:{title:'Sealed booster pack',status:'sold',priceText:'$42'}}));
  await panel.locator('[data-action=refresh]').click();await panel.locator('[data-auction]').filter({hasText:'Sealed booster pack'}).waitFor();
  await panel.locator('.cb-spots button').nth(1).click();await panel.locator('[data-action=spot-sale]').click();
  main.once('dialog',dialog=>dialog.accept());await panel.locator('[data-action=auction]').click();
  await panel.locator('[data-field=amount]').fill('42');
  if(screenshots) {
   await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setSize(1584,1800),main.url());
   const start=panel.locator('[data-auction-helper]'), end=panel.locator('[data-action=sale]');await start.scrollIntoViewIfNeeded();
   await start.evaluate(e=>e.scrollIntoView({block:'center'}));await main.waitForTimeout(100);
   const a=await start.boundingBox(),b=await end.boundingBox();
   await main.screenshot({path:path.join(root,'docs/images/monetization/live-sale-controls.png'),clip:{x:a.x,y:a.y,width:a.width,height:b.y+b.height-a.y},scale:'css'});
  }
  await panel.locator('[data-action=sale]').click();
  await panel.locator('.cb-sales').filter({hasText:'42.00 total'}).waitFor();
  let linked=(await request({action:'getCommerceState'})).commerce.boards;
  assert.equal(linked.board.spots[1].status,'claimed');assert.equal(linked.sales.length,3);assert.equal(linked.sales[0].spotId,'2');assert.equal(linked.sales[0].platform,'ebay');
  const audience=await page('commerce-board.html?session=isolated-board-fixture&server=ws://127.0.0.1:'+relay.address().port+'&view=sales&onlytype=ebay',800,600);
  await audience.waitForTimeout(100);send(linked);await audience.locator('.sale').waitFor();
  assert.equal(await audience.locator('.sale').count(),1);assert.match(await audience.locator('.sale').innerText(),/eBay Live · Host confirmed/);
  assert(!(await audience.locator('body').innerText()).includes('Private winner'));
  await panel.locator('[data-field=result]').fill('Revealed card');await panel.locator('[data-action=revealed]').click();
  await panel.locator('[data-selected]').filter({hasText:'revealed'}).waitFor();
  const read=await request({action:'getCommerceState'});assert.equal(read.commerce.boards.board.spots[1].result,'Revealed card');
  main.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'Remove sale and reopen spot:',exact:false}).click();
  await panel.locator('[data-selected]').filter({hasText:'available'}).waitFor();
  linked=(await request({action:'getCommerceState'})).commerce.boards;
  assert.equal(linked.sales.length,2);assert.equal(linked.board.spots[1].result,'');
  send(linked);await audience.locator('#commerce-display').waitFor({state:'hidden'});await audience.close();
  // Match SSApp's local utility-window renderer (main.js), including its existing sandbox setting.
  async function page(relative,width=1280,height=900){const wait=app.waitForEvent('window');await app.evaluate(({BrowserWindow},o)=>{const w=new BrowserWindow({show:false,width:o.width,height:o.height,webPreferences:{backgroundThrottling:false,sandbox:false}});w.loadURL(o.url).catch(e=>console.error('Board test load',e));w.showInactive();},{url:'file:///'+root+'/'+relative,width,height});const p=await wait;await p.waitForLoadState();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));return p;}
  const live=await page('commerce-board.html?session=isolated-board-fixture&server=ws://127.0.0.1:'+relay.address().port,1920,1080);
  for(let i=0;i<50&&!Array.from(relay.clients).some(c=>c.room);i++)await main.waitForTimeout(50);
  send(state);await live.locator('.spot.revealed').waitFor();assert.equal(await live.locator('.spot').count(),120);
  assert.equal(await live.locator('button,input,textarea,select').count(),0);
  // An unrelated sale or another spot changing must not replay an existing reveal.
  await live.evaluate(()=>{window.revealedTile=document.querySelector('.spot.revealed');window.firstTile=document.querySelector('.spot');});
  state.sales.push({id:'visual-sale',title:'Another sale',source:'Host confirmed',quantity:1,amount:null,currency:''});send(state);
  state.board.spots[0].status='claimed';send(state);await live.locator('.spot.claimed').first().waitFor();
  assert(await live.evaluate(()=>window.revealedTile===document.querySelector('.spot.revealed')));
  assert(await live.evaluate(()=>window.firstTile!==document.querySelector('.spot')));
  state.board.visible=false;send(state);await live.locator('#commerce-display').waitFor({state:'hidden'});
  state.board.visible=true;send(state);await live.locator('#commerce-display').waitFor();
  await live.evaluate(()=>{const now=Date.now;Date.now=()=>now()+36000;});await live.locator('#commerce-display').waitFor({state:'hidden'});
  send(state);await live.locator('#commerce-display').waitFor();await live.close();
  const artifactDir=path.join(root,'docs/images/monetization');
  for(const [name,query] of [['spot-board',''],['team-board','&style=teams'],['sales-wall','&view=wall']]){
   const p=await page('commerce-board.html?demo'+query,1600,1000);await p.locator('#commerce-display').waitFor();
   if(screenshots)await p.locator('#commerce-display').screenshot({path:path.join(artifactDir,name+'.png')});
   for(const width of [1920,390]) {await p.setViewportSize({width,height:1080});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' fits '+width);}
   await p.close();
  }
  // Capture actual popup content at native resolution, including its enclosing SSApp frame.
  if(screenshots){
   await app.evaluate(({BrowserWindow},url)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url);w.setSize(1584,1800);w.showInactive();},main.url());
   await panel.locator('details').first().evaluate(e=>e.open=false);
   await panel.locator('[data-field=link]').evaluate(e=>{e.parentElement.hidden=true;});
   await panel.evaluate(e=>e.scrollIntoView({block:'center'}));await main.waitForTimeout(300);
   const box=await panel.boundingBox();const png=await app.evaluate(async({BrowserWindow},o)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===o.url);return (await w.webContents.capturePage({x:Math.floor(o.box.x),y:Math.floor(o.box.y),width:Math.ceil(o.box.width),height:Math.ceil(o.box.height)})).toPNG().toString('base64');},{url:main.url(),box});fs.writeFileSync(path.join(artifactDir,'board-controls.png'),Buffer.from(png,'base64'));
  }
  for(const name of ['monetization','commerce-boards']){
   const p=await page('docs/'+name+'.html');
   for(const width of [1280,390]) {await p.setViewportSize({width,height:900});await p.evaluate(()=>Promise.all(Array.from(document.images).map(i=>{i.loading='eager';return i.decode().catch(()=>{});})));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' fits '+width);assert.equal(await p.locator('img').evaluateAll(images=>images.filter(i=>!i.naturalWidth).length),0);await p.screenshot({path:path.join(profile,name+'-'+width+'.png'),fullPage:true});}
   await p.close();
  }
  for(const theme of ['light','dark']) {
   await main.emulateMedia({colorScheme:theme});
   const colors=await panel.locator('[data-field=result]').evaluate(e=>{const s=getComputedStyle(e);return {fg:s.color,bg:s.backgroundColor};});
   function luminance(color){const a=color.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);});return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
   const a=luminance(colors.fg),b=luminance(colors.bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,theme+' field contrast '+JSON.stringify(colors));
  }
  const stored=await bg.evaluate(()=>new Promise(r=>chrome.storage.local.get(['monetizationPrivate'],r)));
  assert.equal(stored.monetizationPrivate.boards.sales.length,2);assert.equal(stored.monetizationPrivate.boards.board.spots[11].status,'revealed');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({ok:true,profile,checks:'popup create/claim/reveal; purchase hook/dedup; privacy; local relay hide/reconnect; persistence; desktop/mobile guides; screenshots'}));
 } finally {if(app)await app.close();for(const c of relay.clients)c.terminate();await new Promise(r=>relay.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
