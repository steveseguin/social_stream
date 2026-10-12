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
 await popup.evaluate(()=>{applyPopupBeginnerMode(false);let el=document.getElementById('featured-preset-select');while(el){if(el.tagName==='DETAILS')el.open=true;el=el.parentElement;}});
 for(const theme of themes){
  await popup.locator('#featured-preset-select').selectOption('themes/featured-styles/featured-modern.html?style=art-'+theme);
  const url=new URL(await popup.evaluate(()=>document.getElementById('overlay').raw));
  assert.equal(url.searchParams.get('style'),'art-'+theme);
  assert(url.searchParams.get('session').startsWith('artqa'));
 }
 await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setSize(1584,1600),main.url());
 await popup.locator('#featured-preset-select').evaluate(el=>el.scrollIntoView({block:'center'}));
 await delay(600);
 const popupCapture=await app.evaluate(async({BrowserWindow},url)=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url);return (await win.webContents.capturePage()).toPNG().toString('base64');},main.url());
 fs.writeFileSync(path.join(output,'popup.png'),Buffer.from(popupCapture,'base64'));
 console.log('PASS popup selections preserve session and selected artwork');
 if(process.argv.includes('--popup-only')){console.log('Screenshots: '+output);return;}
 const promised=app.waitForEvent('window');
 await app.evaluate(({BrowserWindow})=>new BrowserWindow({show:false,width:960,height:640,webPreferences:{offscreen:true,backgroundThrottling:false}}).loadURL('about:blank'));
 const page=await promised;
 async function send(payload) {
  const frame=page.frames().find(f=>f!==page.mainFrame());assert(frame,'Overlay iframe exists');
  await frame.evaluate(data=>parent.postMessage({dataReceived:{overlayNinja:data}},'*'),payload);
 }
 const sample={chatname:'Juniper',chatmessage:'Good music, great company. Happy to be here!',textonly:true,type:'twitch',hasDonation:'$5.00'};
 for(const theme of themes){
  await page.goto('file:///'+root.replace(/\\/g,'/')+'/themes/featured-styles/featured-modern.html?session=artqa&password=qa%26pass&style=art-'+theme+'&showtime=0');
  await page.locator('#frame1').evaluate(el=>{el.src='about:blank';});
  await delay(150);
  assert((await page.locator('#frame1').count())===1);
  await send(sample);
  await page.locator('.message-wrapper.show').waitFor();
  await delay(400);
  const imageOK=await page.evaluate(async()=>{const src=getComputedStyle(document.querySelector('.message-wrapper'),'::before').backgroundImage.slice(5,-2);return new Promise(resolve=>{const i=new Image;i.onload=()=>resolve(i.naturalWidth>100);i.onerror=()=>resolve(false);i.src=src;});});
  assert(imageOK,theme+' mascot loads');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.donation-info').innerText(),'$5.00');
  await page.screenshot({path:path.join(output,theme+'.png'),omitBackground:true});
  await app.evaluate(({BrowserWindow},url)=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url);win.setContentSize(360,760);},page.url());
  await send({...sample,chatname:'A'.repeat(70),chatmessage:'<b>Plain text stays plain</b>\n'+'longword'.repeat(25)});
  await delay(1200);
  assert.equal(await page.locator('.text b').count(),0);
  assert(await page.evaluate(()=>{const r=document.querySelector('.message').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),theme+' narrow card fits');
  await page.screenshot({path:path.join(output,theme+'-narrow.png'),omitBackground:true});
  await send(false);await delay(900);assert.equal(await page.locator('.message-wrapper').count(),0);
  await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(960,640),page.url());
  console.log('PASS '+theme+' artwork, payload, narrow wrapping, transparency, clear');
 }
 await page.goto('file:///'+root.replace(/\\/g,'/')+'/themes/featured-styles/featured-modern.html?session=artqa&style=art-cat&showtime=100');
 await page.locator('#frame1').evaluate(el=>{el.src='about:blank';});await delay(150);await send(sample);await delay(1100);
 assert.equal(await page.locator('.message-wrapper').count(),0);
 console.log('PASS auto-hide');
 await page.goto('file:///'+root.replace(/\\/g,'/')+'/themes/featured-styles/featured-modern.html?session=artqa&style=art-cat&showtime=0');
 await page.locator('#frame1').evaluate(el=>{el.src='about:blank';});await delay(150);
 const asset='file:///'+root.replace(/\\/g,'/')+'/themes/featured-styles/artwork/cat.webp';
 await send({...sample,chatimg:asset,contentimg:asset,chatbadges:[asset]});await delay(500);
 assert.equal(await page.locator('.avatar,.badge,.content-image').count(),3);
 assert(await page.locator('.content-image').evaluate(i=>i.complete&&i.naturalWidth>0));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.message-wrapper').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 console.log('PASS avatars, badges, content images, reduced motion. Screenshots: '+output);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
