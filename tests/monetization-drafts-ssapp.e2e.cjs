// Manual actual SSApp regression check; isolated profile, no external network or payments.
const fs=require('fs'),os=require('os'),path=require('path');
const root=path.resolve(__dirname,'..').replace(/\\/g,'/'),ssapp=process.env.SSAPP_REPO||path.resolve(root,'../ssapp');
const assert=require('assert');
const req=require('module').createRequire(path.join(root,'tests/product-controls-ssapp.e2e.cjs'));
const {_electron}=req('playwright');
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-commerce-ux-'));
 fs.writeFileSync(path.join(profile,'savedSync.json'),JSON.stringify({streamID:'isolated-commerce-ux',password:'false',state:false,settings:{},wsServer:false}));
 const wrapper=path.join(profile,'bootstrap.cjs');
 fs.writeFileSync(wrapper,`const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!['localhost','127.0.0.1'].includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
 const app=await _electron.launch({executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'),args:[wrapper,'--running-from-source','--multiinstance','--ssapp-headless-control','--filesource','file:///'+root+'/','--no-hwa'].filter(arg=>!process.env.SSN_GUIDE_SCREENSHOTS||arg!=='--ssapp-headless-control'),cwd:ssapp,env:{...process.env,SSAPP_USER_DATA_DIR:profile,SSAPP_DIAGNOSTICS_SAFE_GPU:'1'}});
 try{
  const main=await app.firstWindow();main.setDefaultTimeout(25000);
  await main.waitForFunction(()=>document.querySelector('#frame2')?.contentWindow?.handleMonetizationRequest);
  const popup=main.frames().find(f=>/popup\.html/.test(f.url()));
  await main.locator('[data-page=streams]').click();
  await popup.evaluate(()=>{document.getElementById('monetization-settings').open=true;applyPopupBeginnerMode(false)});
  await popup.waitForFunction(()=>document.getElementById('money-current').textContent.includes('Load your wishlist'));
  const buttons=()=>popup.evaluate(()=>Object.fromEntries(['shop-copy','shop-remove','shopify-copy','shopify-disconnect'].map(id=>[id,document.getElementById('money-'+id).disabled])));
  const before=await buttons();
  await popup.evaluate(()=>{const p=document.getElementById('monetization-settings');new MutationObserver(()=>{if(!p.hasAttribute('aria-busy'))window.afterSaveButtons=Object.fromEntries(['shop-copy','shop-remove','shopify-copy','shopify-disconnect'].map(id=>[id,document.getElementById('money-'+id).disabled]));}).observe(p,{attributes:true,attributeFilter:['aria-busy']});});
  await popup.locator('#money-save').click();
  await popup.waitForFunction(()=>document.getElementById('money-status').textContent==='Saved.'&&!document.getElementById('monetization-settings').hasAttribute('aria-busy'));
  const after=await popup.evaluate(()=>window.afterSaveButtons);
  assert.deepStrictEqual(after,before,'Unavailable actions must remain disabled immediately after Save');
  assert(!(await popup.locator('#money-save').textContent()).includes('Unsaved'));
  await popup.locator('#money-commerce-panel > summary').click();
  await popup.locator('#money-commerce-name').fill('Unsaved audit product');
  await popup.locator('#money-commerce-url').fill('https://example.com/audit');
  await popup.locator('#money-commerce-add').click();
  const draftBefore=await popup.locator('#money-commerce-items .money-item').count();
  assert((await popup.locator('#money-save').textContent()).includes('Unsaved'));
  await popup.locator('#money-commerce-name').fill('Partially edited product');
  await popup.locator('#money-ebay-panel > summary').click();
  await popup.locator('#money-ebay-environment').selectOption('sandbox');
  await popup.waitForFunction(()=>document.getElementById('money-status').textContent.startsWith('Environment changed.')&&!document.getElementById('monetization-settings').hasAttribute('aria-busy'));
  const draftAfter=await popup.locator('#money-commerce-items .money-item').count();
  assert.equal(draftAfter,draftBefore,'An unrelated provider action must preserve draft products');
  assert.equal(await popup.locator('#money-commerce-name').inputValue(),'Partially edited product');
  assert((await popup.locator('#money-save').textContent()).includes('Unsaved'));
  assert(!(await popup.locator('#money-ebay-enabled').isChecked()));
  assert((await popup.locator('#money-ebay-status').textContent()).startsWith('Environment changed.'));
  await popup.locator('#money-save').click();
  await popup.waitForFunction(()=>!document.getElementById('monetization-settings').hasAttribute('aria-busy'));
  assert(!(await popup.locator('#money-save').textContent()).includes('Unsaved'));
  const config=await popup.evaluate(()=>new Promise(r=>chrome.runtime.sendMessage({cmd:'monetization',action:'get'},r)));
  assert.equal(config.config.commerce.items[0].name,'Unsaved audit product');
  // Delay only the reply, after the real background has saved the submitted setup.
  await popup.evaluate(()=>{
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=function(request,callback){
    if(request.cmd==='monetization'&&request.action==='save') original(request,reply=>{window.releaseSave=()=>{chrome.runtime.sendMessage=original;callback(reply);};});
    else original(request,callback);
   };
  });
  await popup.locator('#money-save').click();
  await popup.waitForFunction(()=>typeof window.releaseSave==='function');
  await popup.locator('#money-commerce-seconds').evaluate(e=>{e.value='37';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await popup.evaluate(()=>window.releaseSave());
  await popup.waitForFunction(()=>!document.getElementById('monetization-settings').hasAttribute('aria-busy'));
  assert.equal(await popup.locator('#money-commerce-seconds').inputValue(),'37');
  assert((await popup.locator('#money-save').textContent()).includes('Unsaved'),'Edits made during Save must remain unsaved');
  await popup.locator('#money-ebay-url').fill('invalid');
  await popup.locator('#money-ebay-add').click();
  await popup.waitForFunction(()=>!document.getElementById('monetization-settings').hasAttribute('aria-busy')&&document.getElementById('money-status').textContent!=='Saved.');
  const error=await popup.locator('#money-status').textContent();
  assert.equal(await popup.locator('#money-ebay-status').textContent(),error);
  await main.waitForTimeout(5200);
  assert.equal(await popup.locator('#money-ebay-status').textContent(),error,'Polling must leave action feedback readable');
  assert.equal(await popup.locator('#money-commerce-seconds').inputValue(),'37');
  assert.deepStrictEqual(await buttons(),before);
  if(process.env.SSN_GUIDE_SCREENSHOTS){
  await app.evaluate(({BrowserWindow},url)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url);w.webContents.setBackgroundThrottling(false);w.setSize(1584,1400);w.showInactive();},main.url());
  for(const theme of ['light','dark']){
   await main.emulateMedia({colorScheme:theme});
   await popup.locator('#money-save').evaluate(e=>e.scrollIntoView({block:'center'}));
   await main.waitForTimeout(500);
   const box=await popup.locator('#money-save').evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
   assert(box.width>0);
   const png=await app.evaluate(async({BrowserWindow},url)=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'),main.url());
   fs.writeFileSync(path.join(profile,'setup-'+theme+'.png'),Buffer.from(png,'base64'));
  }
  }
  await popup.locator('#money-save').click();
  await popup.waitForFunction(()=>!document.getElementById('monetization-settings').hasAttribute('aria-busy'));
  assert(!(await popup.locator('#money-save').textContent()).includes('Unsaved'));
  console.log('PASS: actual SSApp preserves drafts and in-flight edits, reports local errors, and restores action availability without a polling delay.');
  const result={beforeSaveDisabled:before,afterSaveDisabled:after,draftBeforeEnvironmentSwitch:draftBefore,draftAfterEnvironmentSwitch:draftAfter};
  console.log(JSON.stringify(result,null,2));fs.writeFileSync(path.join(profile,'results.json'),JSON.stringify(result,null,2));console.log(profile);
 }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

