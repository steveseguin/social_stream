// Optional visual regression audit in actual SSApp; isolated profile, local relay, fictional data.
// Screenshots and a machine-readable report are saved in the printed temporary directory.
const {_electron}=require('playwright');
const fs=require('fs'),os=require('os'),path=require('path');
const root=path.resolve(__dirname,'..').replace(/\\/g,'/'),ssapp=process.env.SSAPP_REPO || path.resolve(root,'../ssapp');
const {WebSocketServer}=require(path.join(ssapp,'node_modules/ws'));
const B=require('../shared/monetization/boards.js');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-commerce-visual-'));
const profile=path.join(out,'profile');fs.mkdirSync(profile);
fs.writeFileSync(path.join(profile,'savedSync.json'),JSON.stringify({streamID:'isolated-visual',password:'false',state:false,settings:{},wsServer:false}));
const wrapper=path.join(out,'bootstrap.cjs');
fs.writeFileSync(wrapper,`const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
(async()=>{
 let app,bg;const report={out,checks:[],errors:[],shots:[]};
 const relay=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>relay.once('listening',r));
 relay.on('connection',c=>c.on('message',async raw=>{try {const d=JSON.parse(String(raw));if(d.join)c.room=d.join;
 if(d.action&&bg){const result=await bg.evaluate(d=>handleStreamDeckBackgroundRequest(d),d);c.send(JSON.stringify({callback:{get:d.get,result}}));}
 }catch(e){report.errors.push('Relay: '+e.message);}}));
 const check=(name,ok,details)=>report.checks.push({name,ok,details});
 const send=s=>{for(const c of relay.clients)if(c.readyState===1)c.send(JSON.stringify({event:'monetization_update',meta:{monetization:{boards:s}}}));};
 try {
 app=await _electron.launch({executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'),args:[wrapper,'--running-from-source','--multiinstance','--filesource','file:///'+root+'/','--no-hwa'],cwd:ssapp,env:{...process.env,SSAPP_USER_DATA_DIR:profile,SSAPP_DIAGNOSTICS_SAFE_GPU:'1'}});
 const main=await app.firstWindow();main.setDefaultTimeout(15000);await main.waitForFunction(()=>document.querySelector('#frame2')?.contentWindow?.handleMonetizationRequest);
 bg=main.frames().find(f=>/background\.html/.test(f.url()));const popup=main.frames().find(f=>/popup\.html/.test(f.url()));
 await bg.evaluate(()=>{isExtensionOn=true;});
 const request=(command,data)=>bg.evaluate(o=>handleMonetizationRequest({action:'commerceControl',command:o.command,data:o.data}),{command,data});
 await request('boardSave',{title:'Choose your spot',count:120,columns:20});await request('boardSpot',{id:'120',status:'revealed',result:'Holographic card'});
 for(const title of ['Signed rookie card','Collector jersey','Limited art print'])await request('saleAdd',{title,amount:38,currency:'USD'});
 await request('salesSettings',{visible:true,automatic:true});
 async function page(file,w=1280,h=900){const wait=app.waitForEvent('window');await app.evaluate(({BrowserWindow},o)=>{const win=new BrowserWindow({show:false,width:o.w,height:o.h,webPreferences:{sandbox:false,backgroundThrottling:false}});win.loadURL(o.url);win.showInactive();},{w,h,url:'file:///'+root+'/'+file});const p=await wait;await p.waitForLoadState();p.setDefaultTimeout(12000);p.on('pageerror',e=>report.errors.push(e.message));await p.setViewportSize({width:w,height:h});return p;}
 async function shot(p,name,selector){const loc=selector?p.locator(selector):null;const viewport=p.viewportSize();let expanded=false;if(loc){const box=await loc.boundingBox();if(box&&box.height>viewport.height){await p.setViewportSize({width:viewport.width,height:Math.ceil(box.height)+100});expanded=true;}await loc.scrollIntoViewIfNeeded();}await p.waitForTimeout(80);const file=path.join(out,name+'.png');if(loc)await loc.screenshot({path:file,scale:'css'});else await p.screenshot({path:file,scale:'css'});if(expanded)await p.setViewportSize(viewport);report.shots.push(file);}
 for(const name of ['monetization','commerce-boards']){
  const p=await page('docs/'+name+'.html');await p.evaluate(()=>Promise.all(Array.from(document.images).map(i=>{i.loading='eager';return i.decode().catch(()=>{});}))); 
  for(const theme of ['light','dark']){
   await p.evaluate(t=>{document.documentElement.classList.toggle('dark-mode',t==='dark');document.documentElement.classList.toggle('light-mode',t==='light');},theme);
   await p.setViewportSize({width:1280,height:900});await p.evaluate(()=>scrollTo(0,0));await shot(p,name+'-'+theme+'-top');
   const ids=name==='monetization'?['choose','setup','products-support-links','connections','commerce-automation']:['spots','teams','live-selling','sales','obs','formats','automation'];
   if(theme==='dark')for(const id of ids)await shot(p,name+'-'+id,'#'+id);
   await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await shot(p,name+'-'+theme+'-mobile');
  }
  await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
  for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});check(name+' expanded fits '+width,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await shot(p,name+'-expanded-options',name==='monetization'?'#connections':'#automation');
  await p.evaluate(()=>document.documentElement.style.fontSize='200%');await p.setViewportSize({width:1280,height:900});check(name+' 200% text fits',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.close();
 }
 for(const [name,query,width,height] of [['spots','',1920,1080],['teams','&style=teams',1280,900],['list','&view=sales',800,600],['wall','&view=wall',1280,720],['strip','&view=ticker',1280,400]]){
  const p=await page('commerce-board.html?demo'+query,width,height);await shot(p,'overlay-'+name);
  check(name+' complete display fits recommended viewport',await p.locator('#commerce-display').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));
  await p.setViewportSize({width:390,height:844});await shot(p,'overlay-'+name+'-mobile');check(name+' mobile width',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.close();
 }
 const long=B.apply({},'boardSave',{labels:Array(30).fill('San Francisco collectors team').join('\n'),columns:6,style:'teams',title:'Saturday championship card break'});long.board.spots.forEach((s,i)=>{s.status=i%2?'revealed':'claimed';s.result='Signed limited edition championship rookie card';});
 for(let i=0;i<6;i++){long.sales.unshift({id:'x'+i,title:('Limited edition collector '+i+' ').repeat(5),amount:999999.99,currency:i%2?'CAD':'USD',source:'Host confirmed',quantity:2});}long.salesVisible=true;
 for(const view of ['board','sales','wall','ticker']){
  const p=await page('commerce-board.html?session=isolated-visual&server=ws://127.0.0.1:'+relay.address().port+'&view='+view,800,900);await p.waitForTimeout(100);send(long);await p.locator('#commerce-display').waitFor();await shot(p,'long-'+view);
  check('long '+view+' width',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.setViewportSize({width:390,height:844});check('long '+view+' mobile width',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot(p,'long-'+view+'-mobile');await p.close();
 }
 await main.locator('[data-page=streams]').click();await popup.evaluate(()=>{document.getElementById('monetization-settings').open=true;applyPopupBeginnerMode(false);document.querySelector('.commerce-board-controls').open=true;});
 const panel=popup.locator('.commerce-board-controls');await panel.locator('.cb-spots button').nth(119).waitFor();
 await app.evaluate(({BrowserWindow},url)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url);w.setSize(1584,1800);},main.url());
 for(const theme of ['light','dark']){
  await main.emulateMedia({colorScheme:theme});
  for(const [name,index] of [['setup',0],['sales',1]]){
   const section=panel.locator('details').nth(index);await section.evaluate(e=>e.open=true);await section.scrollIntoViewIfNeeded();
   const file=path.join(out,'popup-'+theme+'-'+name+'.png');await section.screenshot({path:file,scale:'css'});report.shots.push(file);
  }
 }
 await panel.locator('.cb-spots button').nth(119).focus();await panel.locator('.cb-spots').evaluate(e=>e.scrollTop=e.scrollHeight);const before=await panel.locator('.cb-spots').evaluate(e=>e.scrollTop);
 await request('saleAdd',{title:'Fresh purchase'});await main.waitForTimeout(5200);
 check('new purchase preserves board keyboard focus',await popup.evaluate(()=>document.activeElement.matches('.cb-spots button')));check('new purchase preserves board scroll',await panel.locator('.cb-spots').evaluate((e,b)=>e.scrollTop===b,before));
 const dock=await page('obs-control-dock.html?commerce&session=isolated-visual&server=ws://127.0.0.1:'+relay.address().port,390,900);
 await dock.locator('.commerce-board-controls').evaluate(e=>e.open=true);const dp=dock.locator('.commerce-board-controls');await dp.locator('.cb-spots button').nth(119).waitFor();await shot(dock,'obs-dock-board');
 await dp.locator('details').first().evaluate(e=>e.open=true);await shot(dock,'obs-dock-setup','.commerce-board-controls details:first-of-type');
 await shot(dock,'obs-dock-spots','.cb-spots');
 await dp.locator('details').last().evaluate(e=>e.open=true);await shot(dock,'obs-dock-sales','.commerce-board-controls details:last-of-type');
 const salesFit=await dp.locator('details').last().evaluate(e=>{const edge=e.getBoundingClientRect().right;return {width:e.clientWidth,content:e.scrollWidth,clipped:Array.from(e.querySelectorAll('label,p,input,select,button')).filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().right>edge+1).map(n=>n.getAttribute('data-field')||n.textContent)};});check('OBS sales content fits panel',salesFit.content<=salesFit.width+1&&!salesFit.clipped.length,salesFit);
 const checkbox=await dp.locator('[data-field=visible]').boundingBox();check('OBS sales checkbox compact',checkbox.width<=50&&checkbox.height<=50,checkbox);
 await dp.locator('[data-field=sale-title]').fill('Sold from OBS dock');await dp.locator('[data-action=sale]').click();await dp.locator('.cb-sales').filter({hasText:'Sold from OBS dock'}).waitFor();check('OBS dock controls shared backend',(await bg.evaluate(()=>handleMonetizationRequest({action:'getCommerceState'}))).commerce.boards.sales[0].title==='Sold from OBS dock');
 check('OBS dock fits 390',await dock.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // A click during a slow status refresh must execute, and its result must win over that stale read.
 const race=await dock.evaluate(async boards=>{
  const test=document.createElement('details');document.body.appendChild(test);
  let current={boards},release,hold=false,calls=0;
  SSNCommerceBoardControls(test,(action,data)=>{
   if(action==='getCommerceState')return hold?new Promise(resolve=>{release=resolve;}):Promise.resolve({commerce:current});
   calls++;current=JSON.parse(JSON.stringify(current));current.boards.board.visible=data.data.visible;
   return Promise.resolve({commerce:current});
  },()=>location.href);
  test.open=true;await new Promise(r=>setTimeout(r,30));
  const previous=JSON.parse(JSON.stringify(current));hold=true;
  test.querySelector('[data-action=refresh]').click();test.querySelector('[data-action=visibility]').click();
  await new Promise(r=>setTimeout(r,30));
  const during=calls===1 && test.querySelector('[data-board-status]').textContent.includes('Board hidden');
  release({commerce:previous});await new Promise(r=>setTimeout(r,30));
  const after=test.querySelector('[data-board-status]').textContent.includes('Board hidden');test.remove();return {during,after};
 },B.apply({},'boardSave',{count:3,columns:3}));
 check('controls accept clicks during a pending refresh',race.during);check('stale refresh cannot overwrite a command result',race.after);
 await dock.close();
 const flowPage=await page('actions/index.html?session=isolated-visual',1280,900);
 await flowPage.waitForFunction(()=>window.flowEditor);
 await flowPage.evaluate(()=>flowEditor.createNode('action','commerceControl',100,100));
 await flowPage.locator('#prop-command').selectOption('boardSpot');
 check('Event Flow hides product fields for board commands',await flowPage.locator('#commerce-product-fields').isHidden());
 await flowPage.locator('#prop-data').fill('{"id":"12","status":"claimed"}');
 check('Event Flow saves board fields',await flowPage.evaluate(()=>JSON.parse(flowEditor.currentFlow.nodes.find(n=>n.actionType==='commerceControl').config.data).id==='12'));
 await shot(flowPage,'event-flow-board','#node-properties-content');
 await flowPage.locator('#prop-command').selectOption('show');
 check('Event Flow keeps product controls unchanged',await flowPage.locator('#commerce-board-fields').isHidden() && await flowPage.locator('#prop-url').isVisible());
 await flowPage.close();
 }catch(e){report.errors.push(e.stack);console.error(e);}finally{
  const failed=report.checks.filter(c=>!c.ok);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({out,passed:report.checks.length-failed.length,failed,errors:report.errors,screenshots:report.shots.length}));
  if(failed.length || report.errors.length)process.exitCode=1;
  if(app)await app.close();for(const c of relay.clients)c.terminate();await new Promise(r=>relay.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
