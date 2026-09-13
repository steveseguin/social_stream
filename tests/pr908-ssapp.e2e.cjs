// Isolated SSApp renderer checks; all remote traffic is blocked and relay/peer messages are fixtures.
'use strict';
const {_electron}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ssapp=process.env.SSAPP_REPO||path.resolve(root,'../ssapp');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-pr908-'));
const file=relative=>'file:///'+root.replace(/\\/g,'/')+'/'+relative;
(async()=>{
 const wrapper=path.join(profile,'bootstrap.cjs');
 fs.writeFileSync(path.join(profile,'savedSync.json'),JSON.stringify({streamID:'pr908fixture',password:'false',state:false,settings:{},wsServer:false}));
 fs.writeFileSync(wrapper,`const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:true})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
 const app=await _electron.launch({executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'),args:[wrapper,'--running-from-source','--multiinstance','--ssapp-headless-control','--filesource',file(''),'--no-hwa'],cwd:ssapp,env:{...process.env,SSAPP_USER_DATA_DIR:profile,SSAPP_DIAGNOSTICS_SAFE_GPU:'1'}});
 try {
  const main=await app.firstWindow();await main.waitForFunction(()=>document.querySelector('#frame2'));
  const pending=app.waitForEvent('window');
  await app.evaluate(({BrowserWindow})=>new BrowserWindow({show:false,width:1100,height:800,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:false}}).loadURL('about:blank'));
  const page=await pending;page.setDefaultTimeout(15000);
  let sockets=[];
  await page.routeWebSocket('**',socket=>{const record={socket,url:socket.url()};sockets.push(record);socket.onMessage(raw=>{const data=JSON.parse(String(raw));if(data.join)record.join=data;});});
  for(const [query,endpoint,channel] of [['server','wss://io.socialstream.ninja/',2],['server&autoshow','wss://io.socialstream.ninja/api',1],['server2&autoshow','wss://io.socialstream.ninja/extension',4]]) {
   sockets=[];await page.goto(file('themes/featured-styles/featured-modern.html?session=pr908fixture&showtime=0&'+query));
   for(let i=0;i<100&&!sockets.some(s=>s.join);i++)await page.waitForTimeout(50);
   const s=sockets.find(s=>s.join);assert(s,query);assert.equal(new URL(s.url).href,endpoint);assert.equal(s.join.in,channel);
   assert.equal(await page.locator('#frame1').count(),0);
   const message={chatname:'Fixture',chatmessage:'PR908 relay message',type:'youtube',textonly:true};
   s.socket.send(JSON.stringify(query.includes('autoshow')?Object.assign({target:'dock'},message):{content:message}));
   await page.locator('.message-wrapper.show').waitFor();assert(await page.locator('body').innerText().then(t=>t.includes(message.chatmessage)));
   s.socket.send(JSON.stringify({overlayNinja:false}));await page.locator('.message-wrapper').waitFor({state:'detached'});
   console.log('PASS SSApp Featured',query);
  }
  sockets=[];await page.goto(file('themes/featured-styles/featured-modern.html?session=pr908fixture&server3&showtime=0'));
  await page.locator('#frame1').waitFor({state:'attached'});assert.equal(sockets.length,0);
  await page.locator('#frame1').evaluate(el=>el.src='about:blank');
  await page.waitForTimeout(100);const iframe=page.frames().find(f=>f!==page.mainFrame());
  await iframe.evaluate(()=>parent.postMessage({dataReceived:{overlayNinja:{chatname:'Fixture',chatmessage:'P2P still works',textonly:true}}},'*'));
  await page.locator('.message-wrapper.show').waitFor();console.log('PASS SSApp command-only Featured P2P');
  sockets=[];await page.goto(file('actions.html?session=pr908fixture&server'));
  for(let i=0;i<100&&!sockets.some(s=>s.join);i++)await page.waitForTimeout(50);
  assert(sockets.some(s=>new URL(s.url).pathname==='/api'&&s.join&&s.join.in===6));console.log('PASS SSApp API-only Flow Actions');
  sockets=[];await page.goto(file('giveaway-control.html?session=pr908fixture&server2'));
  await page.locator('iframe').waitFor({state:'attached'});assert.equal(sockets.length,0);
  await page.locator('iframe').evaluate(el=>el.src='about:blank');await page.waitForTimeout(100);
  await page.frames().find(f=>f!==page.mainFrame()).evaluate(()=>{
   addEventListener('message',e=>{const r=e.data.sendData&&e.data.sendData.overlayNinja;if(!r)return;
    const reply=r.action==='listgiveaways'?{ok:true,giveaways:[]}:{ok:true,giveaway:{giveawayId:'default',status:'open',count:2,ticketCount:2,keyword:'!join',config:{kind:'keyword',ticketCost:0,prizePoints:0}}};
    parent.postMessage({dataReceived:{overlayNinja:Object.assign({get:r.get},reply)}},'*');
   });
   parent.postMessage({action:'push-connection-info',value:{label:'SocialStream'},UUID:'fixture'},'*');
  });
  await page.locator('#status').filter({hasText:'2 viewers'}).waitFor();await page.locator('#refresh').click();
  await page.locator('#refresh').waitFor({state:'visible'});console.log('PASS SSApp Giveaway Manager P2P requests and replies');
  await page.addInitScript(()=>{if(location.pathname.endsWith('/chickenroyale.html'))localStorage.setItem('chickenRoyaleDinners',JSON.stringify({alice:12,'["twitch","alice"]':2}));});
  await page.goto(file('games/chickenroyale.html?session=pr908fixture&server2'));
  await page.locator('#legacy-wins-list').filter({hasText:'alice: 12 wins'}).waitFor();
  assert.equal(await page.locator('#legacy-wins-list > div').count(),1);
  await page.screenshot({path:path.join(profile,'legacy-wins.png')});
  console.log('PASS SSApp legacy wins display; screenshot '+path.join(profile,'legacy-wins.png'));
  await page.close();
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
