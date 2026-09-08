// Opt-in native OBS/CEF check. Uses a new portable profile and local fixture API only.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), net = require('net'), crypto = require('crypto'), assert = require('assert');
const { spawn } = require('child_process');
const { WebSocketServer, WebSocket } = require(require.resolve('ws', { paths: [path.resolve(__dirname, '../../ssapp')] }));
const M = require('../shared/monetization/core.js');
const repo = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function port() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function until(fn) { for (let i = 0; i < 100; i++) { try { const v = await fn(); if (v) return v; } catch (_) {} await sleep(300); } throw new Error('Timed out waiting for OBS'); }
(async () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-commerce-obs-'));
 const installed = process.env.OBS_INSTALL_ROOT || 'C:/Program Files/obs-studio';
 assert(fs.existsSync(path.join(installed, 'bin/64bit/obs64.exe')));
 for (const dir of ['bin','data','obs-plugins']) fs.symlinkSync(path.join(installed, dir), path.join(root, dir), 'junction');
 const obsPort = await port(), cdpPort = await port(), password = crypto.randomBytes(24).toString('hex');
 let live = null, processObs, browser, obs, heartbeat;
 const items = [{name:'Studio art print',url:'https://example.com/print',purpose:'shop',amount:25,currency:'USD'}, {name:'Support the show',url:'https://ninjabacker.com/example',purpose:'support'}];
 const commerce = () => ({enabled:true,qr:true,position:'br',display:'first',seconds:15,items,live});
 function state() { if (live && live.until && live.until < Date.now()) live = null; const c = commerce(), selected = M.commerceCurrent(c, Date.now()); return {hostOn:true,enabled:true,mode:live ? live.mode === 'hide' ? 'hidden' : 'pinned' : 'scheduled',selected,items,remainingSeconds:live && live.until ? Math.ceil((live.until-Date.now())/1000) : null}; }
 const server = http.createServer((req,res) => {
  const file = path.resolve(repo, '.' + decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if (!file.startsWith(repo + path.sep)) {res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*; frame-src 'none'"});res.end(bytes);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base='http://127.0.0.1:'+server.address().port;
 const relay = new WebSocketServer({server});
 function broadcast() { state(); const data=JSON.stringify({event:'monetization_update',meta:{monetization:{commerce:commerce()}}}); relay.clients.forEach(c=>{if(c.readyState===1)c.send(data);}); }
 relay.on('connection',socket=>socket.on('message',raw=>{
  const data=JSON.parse(String(raw)); if(data.join){socket.operator=data.out===1 && data.in===2; broadcast();return;}
  if(!data.action)return;
  if(data.action==='commerceControl') { const v=data.value, c=commerce(); const selected=M.commerceCurrent(c,Date.now()); const index=items.findIndex(i=>selected && i.url===selected.url); const item=v.command==='next'?items[(index+1)%items.length]:items.find(i=>i.url===v.url)||items[0]; live=v.command==='resume'?null:{mode:v.command==='hide'?'hide':'show',url:item.url,until:v.seconds?Date.now()+v.seconds*1000:0}; }
  socket.send(JSON.stringify({callback:{get:data.get,result:{ok:true,payload:{commerce:state()}}}}));broadcast();
 }));
 const dockUrl=base+'/obs-control-dock.html?session=obs-commerce-fixture&commerce&server=ws://127.0.0.1:'+server.address().port;
 const cfg=path.join(root,'config/obs-studio');fs.mkdirSync(path.join(cfg,'plugin_config/obs-websocket'),{recursive:true});fs.mkdirSync(path.join(cfg,'basic/profiles/CommerceTest'),{recursive:true});fs.mkdirSync(path.join(cfg,'basic/scenes'),{recursive:true});
 const ini='[General]\nFirstRun=true\nLastVersion=537001986\nEnableAutoUpdates=false\n[Basic]\nProfile=CommerceTest\nProfileDir=CommerceTest\nSceneCollection=CommerceTest\nSceneCollectionFile=CommerceTest\n[BasicWindow]\nsysTrayEnabled=true\nExtraBrowserDocks='+JSON.stringify([{title:'Product Controls',url:dockUrl,uuid:crypto.randomUUID()}])+'\n';
 fs.writeFileSync(path.join(cfg,'global.ini'),ini);fs.writeFileSync(path.join(cfg,'user.ini'),ini);
 fs.writeFileSync(path.join(cfg,'basic/profiles/CommerceTest/basic.ini'),'[General]\nName=CommerceTest\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n');
 fs.writeFileSync(path.join(cfg,'basic/scenes/CommerceTest.json'),JSON.stringify({name:'CommerceTest',sources:[{name:'CommerceTest',id:'scene',settings:{items:[]}}],groups:[],scene_order:[{name:'CommerceTest'}],current_scene:'CommerceTest',current_program_scene:'CommerceTest'}));
 fs.writeFileSync(path.join(cfg,'plugin_config/obs-websocket/config.json'),JSON.stringify({server_enabled:true,server_port:obsPort,auth_required:true,server_password:password,alerts_enabled:false}));
 const pending=new Map();let seq=0;
 const request=(requestType,requestData={})=>new Promise((resolve,reject)=>{const id=String(++seq);const timer=setTimeout(()=>{pending.delete(id);reject(new Error(requestType+' timeout'));},10000);pending.set(id,{resolve,reject,timer});obs.send(JSON.stringify({op:6,d:{requestId:id,requestType,requestData}}));});
 try {
  processObs=spawn(path.join(root,'bin/64bit/obs64.exe'),['--portable','--multi','--disable-updater','--only-bundled-plugins','--disable-missing-files-check','--minimize-to-tray','--remote-debugging-port='+cdpPort],{cwd:path.join(root,'bin/64bit'),windowsHide:true,stdio:'ignore'});
  console.log('Isolated OBS:',root);
  await until(()=>new Promise(resolve=>{const s=net.connect(obsPort,'127.0.0.1');s.on('connect',()=>{s.destroy();resolve(true);});s.on('error',()=>resolve(false));}));
  obs=new WebSocket('ws://127.0.0.1:'+obsPort);
  await new Promise((resolve,reject)=>{obs.on('error',reject);obs.on('message',raw=>{const m=JSON.parse(String(raw)),d=m.d;if(m.op===0){const hash=s=>crypto.createHash('sha256').update(s).digest('base64');obs.send(JSON.stringify({op:1,d:{rpcVersion:1,authentication:hash(hash(password+d.authentication.salt)+d.authentication.challenge)}}));}else if(m.op===2)resolve();else if(m.op===7){const p=pending.get(d.requestId);if(p){clearTimeout(p.timer);pending.delete(d.requestId);d.requestStatus.result?p.resolve(d.responseData||{}):p.reject(new Error(JSON.stringify(d.requestStatus)));}}});});
  await until(async()=> (await request('GetSceneList')).scenes.length);
  assert(!(await request('GetStreamStatus')).outputActive);assert(!(await request('GetRecordStatus')).outputActive);
  const overlayUrl=base+'/monetization.html?session=obs-commerce-fixture&mode=commerce&view=showcase&server=ws://127.0.0.1:'+server.address().port;
  await request('CreateInput',{sceneName:'CommerceTest',inputName:'Products',inputKind:'browser_source',inputSettings:{url:overlayUrl,width:1280,height:720,shutdown:true,restart_when_active:true},sceneItemEnabled:true});
  heartbeat=setInterval(broadcast,1000);
  await until(async()=> (await fetch('http://127.0.0.1:'+cdpPort+'/json/version')).ok);
  const cdpSockets=[];browser={close:async()=>cdpSockets.forEach(s=>s.close())};
  async function findPage(part) {
   const target=await until(async()=> (await (await fetch('http://127.0.0.1:'+cdpPort+'/json/list')).json()).find(p=>p.url.includes(part)));
   const ws=new WebSocket(target.webSocketDebuggerUrl);cdpSockets.push(ws);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
   let id=0;const calls=new Map();ws.on('message',raw=>{const m=JSON.parse(String(raw)),p=calls.get(m.id);if(p){calls.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
   const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;calls.set(n,{resolve,reject,timer:setTimeout(()=>{calls.delete(n);reject(new Error(method+' timed out'));},10000)});ws.send(JSON.stringify({id:n,method,params}));});
   const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
   return {setDefaultTimeout:()=>{},waitForFunction:fn=>until(()=>evaluate('('+fn.toString()+')()')),locator:selector=>({
    selectOption:value=>evaluate('(function(){var e=document.querySelector('+JSON.stringify(selector)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()'),
    click:()=>until(async()=>{if(await evaluate('document.querySelector('+JSON.stringify(selector)+').disabled'))return false;await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');return true;}),
    isDisabled:()=>evaluate('document.querySelector('+JSON.stringify(selector)+').disabled'),
    screenshot:async o=>{const b=await evaluate('JSON.parse(JSON.stringify(document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect()))');const shot=await call('Page.captureScreenshot',{format:'png',clip:{x:b.x,y:b.y,width:b.width,height:b.height,scale:1}});fs.writeFileSync(o.path,Buffer.from(shot.data,'base64'));}
   })};
  }
  const dock=await findPage('obs-control-dock.html');dock.setDefaultTimeout(15000);
  let overlay=await findPage('monetization.html');overlay.setDefaultTimeout(15000);
  await dock.waitForFunction(()=>document.querySelectorAll('#commerce-product option').length===2);
  await dock.locator('#commerce-product').selectOption(items[1].url);await dock.locator('[data-commerce=show]').click();
  await overlay.waitForFunction(()=>document.getElementById('title').textContent==='Support the show');
  await dock.locator('[data-commerce=next]').click();await overlay.waitForFunction(()=>document.getElementById('title').textContent==='Studio art print');
  await request('SaveSourceScreenshot',{sourceName:'Products',imageFormat:'png',imageFilePath:path.join(root,'product-overlay.png')});
  await dock.locator('[data-commerce=hide]').click();await overlay.waitForFunction(()=>document.querySelector('aside').hidden);
  await dock.locator('[data-commerce=resume]').click();await overlay.waitForFunction(()=>!document.querySelector('aside').hidden);
  await request('CreateScene',{sceneName:'Away'});await request('SetCurrentProgramScene',{sceneName:'Away'});await sleep(1200);
  await dock.locator('#commerce-product').selectOption(items[1].url);await dock.locator('[data-commerce=show]').click();
  await dock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Support the show'));
  await request('SetCurrentProgramScene',{sceneName:'CommerceTest'});overlay=await findPage('monetization.html');await overlay.waitForFunction(()=>document.getElementById('title').textContent==='Support the show');
  relay.clients.forEach(c=>{if(c.operator)c.terminate();});await dock.waitForFunction(()=>document.getElementById('commerce-state').textContent.includes('Disconnected'));assert(await dock.locator('[data-commerce=show]').isDisabled());await dock.waitForFunction(()=>!document.querySelector('[data-commerce=show]').disabled);
  await dock.locator('#commerce-controls').screenshot({path:path.join(root,'product-dock.png')});
  fs.writeFileSync(path.join(root,'results.json'),JSON.stringify({passed:true,checks:['native OBS custom dock','Show/Next/Hide/Resume','Browser Source QR rendering','scene unload/reload','dock reconnect'],obsVersion:(await request('GetVersion')).obsVersion},null,2));
  console.log('PASS native OBS commerce controls, scene changes and reconnect:',root);
 } finally {
  clearInterval(heartbeat);if(browser)await browser.close();if(obs)obs.close();
  if(processObs && processObs.exitCode===null)processObs.kill();
  relay.clients.forEach(c=>c.terminate());await new Promise(r=>relay.close(r));await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
