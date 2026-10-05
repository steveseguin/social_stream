// Isolated SSApp runtime; fictional messages through its overlay iframe, no live channels.
const {_electron}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ssapp=process.env.SSAPP_REPO||path.resolve(root,'../ssapp');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-featured-art-'));
const themes=['cat','dog','halloween','christmas','music','forest','space','dragon'];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const wrapper=path.join(output,'bootstrap.cjs');
 fs.writeFileSync(path.join(output,'savedSync.json'),JSON.stringify({streamID:'artqa'+Date.now(),password:'false',state:false,settings:{},wsServer:false}));
 fs.writeFileSync(wrapper,`const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:true})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
 const app=await _electron.launch({executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'),args:[wrapper,'--running-from-source','--multiinstance','--ssapp-headless-control','--filesource','file:///'+root.replace(/\\/g,'/')+'/','--no-hwa'],cwd:ssapp,env:{...process.env,SSAPP_USER_DATA_DIR:output,SSAPP_DIAGNOSTICS_SAFE_GPU:'1'}});
 try {

 const main=await app.firstWindow();main.setDefaultTimeout(25000);
 await main.waitForFunction(()=>document.querySelector('#frame2'));
 await main.locator('[data-page=streams]').click();
 const popup=main.frames().find(f=>/popup\.html/.test(f.url()));
 await popup.waitForFunction(()=>document.getElementById('overlay').raw);
 await popup.evaluate(()=>applyPopupBeginnerMode(false));
 for(const theme of (process.argv.includes('--motion-only')?[]:themes)){
  await popup.locator('#overlay-preset-select').selectOption('themes/compact-clean.html?style=art-'+theme);
  const chatURL=await popup.evaluate(()=>document.getElementById('chatoverlaytemplate').raw);
  assert.equal(new URL(chatURL).searchParams.get('style'),'art-'+theme);
  assert(new URL(chatURL).searchParams.get('session').startsWith('artqa'));
  // Expand the native collapsible controls without contacting a platform.
  await popup.locator('[data-optionparam25="donostyle"]').evaluate(el=>{let p=el.parentElement;while(p){const toggle=p.querySelector(':scope > .collapsible-input');if(toggle)toggle.checked=true;p=p.parentElement;}});
  await popup.locator('[data-optionparam25="donostyle"]').selectOption('art-'+theme);
 }
 for(const n of [2,25,30]){
  const control=popup.locator('[data-param'+n+'="staticart"]');
  assert.equal(await control.count(),1);
  await control.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  const id={2:'overlay',25:'multialerts',30:'chatoverlaytemplate'}[n];
  assert(new URL(await popup.evaluate(id=>document.getElementById(id).raw,id)).searchParams.has('staticart'),'Still control updates '+id);
 }
 console.log('PASS chat/alert preset menus and three still-character controls');
 const promised=app.waitForEvent('window');
 await app.evaluate(({BrowserWindow})=>new BrowserWindow({show:false,width:960,height:760,webPreferences:{offscreen:true,backgroundThrottling:false}}).loadURL('about:blank'));
 const page=await promised;page.setDefaultTimeout(15000);
 const base='file:///'+root.replace(/\\/g,'/')+'/';
 const sample={id:1,chatname:'Juniper',chatmessage:'Good music, great company!',textonly:true,type:'youtube'};
 async function resize(w,h){await app.evaluate(({BrowserWindow},{url,w,h})=>BrowserWindow.getAllWindows().find(win=>win.webContents.getURL()===url).setContentSize(w,h),{url:page.url(),w,h});}
 async function chatBridge(){await page.locator('iframe').evaluate(el=>{el.src='about:blank';});await delay(150);}
 async function send(data){await page.frames().find(f=>f!==page.mainFrame()).evaluate(data=>parent.postMessage({dataReceived:{overlayNinja:data}},'*'),data);}
 async function art(selector,pseudo){return page.locator(selector).last().evaluate(async(el,pseudo)=>{const css=getComputedStyle(el,pseudo);const src=css.backgroundImage.slice(5,-2);const loaded=await new Promise(resolve=>{let im=new Image;im.onload=()=>resolve(im.naturalWidth>0);im.onerror=()=>resolve(false);im.src=src;});return {loaded,animation:css.animationName};},pseudo);}
 for(const theme of (process.argv.includes('--motion-only')?[]:themes)){
  await page.goto(base+'themes/compact-clean.html?session=artqa&style=art-'+theme+'&showtime=0&limit=3');await chatBridge();
  for(let i=1;i<=4;i++)await send({...sample,id:i,chatname:['Juniper','Maple','River','Luna'][i-1]});
  await delay(1600);
  assert.equal(await page.locator('.message:not(.hidden)').count(),3);
  let state=await art('.message:not(.hidden)','::after');assert(state.loaded);assert.equal(state.animation,'art-mascot-bob');
  assert.equal(await page.locator('.message:not(.hidden)').first().evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  await page.screenshot({path:path.join(output,'chat-'+theme+'.png'),omitBackground:true});
  await resize(340,760);await send({...sample,id:10,chatmessage:'<b>Plain</b> '+'longword'.repeat(18)});await delay(700);
  assert.equal(await page.locator('.message b').count(),0);
  assert(await page.locator('.message').last().evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:path.join(output,'chat-'+theme+'-narrow.png'),omitBackground:true});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal((await art('.message','::after')).animation,'none');await page.emulateMedia({reducedMotion:'no-preference'});
  await resize(960,760);
  await page.goto(base+'multi-alerts.html?session=artqa&previewonly&donostyle=art-'+theme+'&showtime=60000');
  await page.evaluate(data=>window.__multiAlertsOverlay.sendPayload(data),{...sample,event:'superchat',hasDonation:'$5.00',donoValue:5});
  await page.locator('.art-alert').waitFor();await delay(600);
  state=await art('.art-alert','::after');assert(state.loaded);assert.equal(state.animation,'art-mascot-bob');
  assert((await page.locator('.alert-shell').innerText()).includes('Juniper'));
  await page.screenshot({path:path.join(output,'alerts-'+theme+'.png'),omitBackground:true});
  await resize(340,760);await delay(200);
  assert(await page.locator('.alert-shell').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}));
  assert(await page.locator('.art-alert').evaluate(el=>{const c=getComputedStyle(el,'::after');return parseFloat(c.top)+parseFloat(c.height)<=el.querySelector('.alert-header').offsetTop;}),'Mascot clears alert heading');
  await page.screenshot({path:path.join(output,'alerts-'+theme+'-narrow.png'),omitBackground:true});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal((await art('.art-alert','::after')).animation,'none');await page.emulateMedia({reducedMotion:'no-preference'});
  await resize(960,760);
  console.log('PASS '+theme+' chat limits, wrapping, alert rendering, artwork and reduced motion');
 }
 for(const surface of ['chat','featured','alerts']){
  const url=surface==='chat'?'themes/compact-clean.html?style=art-cat&reverse':surface==='featured'?'themes/featured-styles/featured-modern.html?style=art-cat':'multi-alerts.html?previewonly&donostyle=art-cat';
  await page.goto(base+url+'&session=artqa&staticart&showtime=60000');
  if(surface==='alerts')await page.evaluate(data=>window.__multiAlertsOverlay.sendPayload(data),{...sample,event:'superchat',hasDonation:'$5.00'});
  else {await chatBridge();await send(sample);}
  const selector=surface==='alerts'?'.art-alert':surface==='featured'?'.message-wrapper':'.message';
  await page.locator(selector).waitFor();await delay(450);
  assert.equal((await art(selector,surface==='featured'?'::before':'::after')).animation,'none');
 }

 await page.goto(base+'themes/compact-clean.html?session=artqa&style=art-cat&reverse&showtime=0');await chatBridge();
 await send({...sample,id:20});await send({...sample,id:21,nameColor:'#123456'});await delay(500);
 assert.equal(await page.locator('.message').first().evaluate(el=>getComputedStyle(el,'::after').animationName),'art-mascot-bob');
 assert.equal(await page.locator('.message').last().evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
 assert.equal(await page.locator('.message .name').first().evaluate(el=>getComputedStyle(el).color),'rgb(18, 52, 86)');
 const before=await page.locator('.message').first().evaluate(el=>getComputedStyle(el,'::after').transform);
 await delay(9900);
 const during=await page.locator('.message').first().evaluate(el=>getComputedStyle(el,'::after').transform);
 assert.notEqual(before,during,'Character actually moves during its bob cycle');
 await page.goto(base+'multi-alerts.html?session=artqa&previewonly&donostyle=art-cat&compact&accent=abcdef&cardbg=112233&textcolor=ffffff');
 await page.evaluate(data=>window.__multiAlertsOverlay.sendPayload(data),{...sample,event:'superchat',hasDonation:'$5.00'});await page.locator('.art-alert').waitFor();await resize(340,760);await delay(500);
 assert.equal(await page.locator('.alert-shell').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 34, 51)');
 assert.equal(await page.locator('.alert-shell').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(171, 205, 239)');
 assert(await page.locator('.art-alert').evaluate(el=>{const c=getComputedStyle(el,'::after');return parseFloat(c.top)+parseFloat(c.height)<=el.querySelector('.alert-header').offsetTop;}));
 console.log('PASS staticart, reverse newest-only motion, actual bob animation, custom name/alert colors and compact layout. Screenshots: '+output);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
