// Isolated SSApp runtime; fictional messages through a private relay, no live channels.
const {_electron}=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ssapp=process.env.SSAPP_REPO||path.resolve(root,'../ssapp');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-maze-qa-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const wrapper=path.join(output,'bootstrap.cjs');
 fs.writeFileSync(path.join(output,'savedSync.json'),JSON.stringify({streamID:'artqa'+Date.now(),password:'false',state:false,settings:{},wsServer:false}));
 fs.writeFileSync(wrapper,`const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:new URL(d.url).hostname!=='127.0.0.1'})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
 const {wsServer:Server}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
 const relay=new Server({port:0});await new Promise(r=>relay.once('listening',r));
 const http=require('http');let avatarRequests=0;const avatarServer=http.createServer((req,res)=>{avatarRequests++;res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#246d99"/><circle cx="32" cy="23" r="13" fill="#ffdcab"/><path d="M8 64V53a24 24 0 0 1 48 0v11" fill="#efad47"/></svg>');});await new Promise(r=>avatarServer.listen(0,'127.0.0.1',r));
 const app=await _electron.launch({executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'),args:[wrapper,'--running-from-source','--multiinstance','--ssapp-headless-control','--filesource','file:///'+root.replace(/\\/g,'/')+'/','--no-hwa'],cwd:ssapp,env:{...process.env,SSAPP_USER_DATA_DIR:output,SSAPP_DIAGNOSTICS_SAFE_GPU:'1'}});
 try {

 const main=await app.firstWindow();main.setDefaultTimeout(20000);await main.waitForFunction(()=>document.querySelector('#frame2'));
 const created=app.waitForEvent('window');await app.evaluate(({BrowserWindow})=>new BrowserWindow({show:false,width:1100,height:820,webPreferences:{offscreen:true,backgroundThrottling:false}}).loadURL('about:blank'));
 const page=await created;page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(port=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){super(url==='wss://io.socialstream.ninja'?'ws://127.0.0.1:'+port:url,protocols);}};let seed=123;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);},relay.address().port);
 for(const [slug,message] of [['fireflycatch','!catch'],['cometrally','!boost']]){
  let client;const joined=new Promise(resolve=>relay.once('connection',s=>{client=s;s.once('message',v=>resolve(JSON.parse(v)));}));
  await page.goto('file:///'+root.replace(/\\/g,'/')+'/games/'+slug+'.html?session=maze-private-qa&v=3.50.9&server');
  assert.deepEqual(await joined,{join:'maze-private-qa',out:2,in:1});assert.equal(page.frames().length,1);
  client.send(JSON.stringify({content:{id:'one',chatname:'Juniper',chatimg:'http://127.0.0.1:'+avatarServer.address().port+'/avatar.svg',chatmessage:message,type:'youtube',textonly:true}}));
  await page.waitForFunction(()=>document.getElementById('players').textContent.startsWith('1 '));
  if(slug==='mazeraid'){
   await page.evaluate(()=>document.body.classList.add('fullscreen'));
   assert(await page.locator('#playfield').evaluate(c=>{let r=c.getBoundingClientRect();return r.left===0&&r.top===0&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1;}));
   await page.evaluate(()=>document.body.classList.remove('fullscreen'));
   assert.equal(await page.locator('#round').evaluate(e=>getComputedStyle(e).color),'rgb(239, 248, 250)');
   await delay(2200);await page.screenshot({path:path.join(output,'maze-retro.png'),omitBackground:true});
   const fps=await page.evaluate(()=>new Promise(resolve=>{const times=[];let prev=performance.now();function step(now){times.push(now-prev);prev=now;if(times.length>=90)resolve(1000/(times.reduce((a,b)=>a+b,0)/times.length));else requestAnimationFrame(step);}requestAnimationFrame(step);}));
   console.log('Maze frame callbacks per second: '+fps.toFixed(1));assert(fps>20,'Maze stays interactive');
   for(let n=0;n<10;n++)client.send(JSON.stringify({chatname:'Raider '+n,chatmessage:'hi',type:'youtube',textonly:true,id:'raid'+n}));
   await page.waitForFunction(()=>document.getElementById('players').textContent.startsWith('11 '));await delay(2500);await page.screenshot({path:path.join(output,'maze-raiders.png'),omitBackground:true});
   assert(avatarRequests>0,'Avatar requested by the renderer');
   if(process.argv.includes('--visual-only')){console.log('Screenshots: '+output);return;}
   await page.waitForFunction(()=>!document.getElementById('result').hidden,{},{timeout:45000});
   assert((await page.locator('#result').innerText()).includes('conquered the maze'));await page.screenshot({path:path.join(output,'maze-winner.png'),omitBackground:true});
   await page.waitForFunction(()=>document.getElementById('round').textContent==='Round 2',{},{timeout:12000});
   assert.equal(await page.locator('#players').textContent(),'0 raiders');
  }
  if(slug==='fireflycatch'){await delay(4000);client.send(JSON.stringify({type:'youtube',chatname:'Milo',chatmessage:'!catch',textonly:true}));}
  else{for(let n=0;n<40;n++){client.send(JSON.stringify({type:'youtube',chatname:'Booster '+n,chatmessage:'!boost',textonly:true}));await delay(310);if(await page.locator('#result').isVisible())break;}}
  await page.screenshot({path:path.join(output,slug+'-desktop.png'),omitBackground:true});
  await page.waitForFunction(()=>!document.getElementById('result').hidden,{},{timeout:65000});assert((await page.locator('#result').textContent()).length>0);await page.screenshot({path:path.join(output,slug+'-result.png'),omitBackground:true});
  await page.waitForFunction(()=>document.getElementById('round').textContent==='Round 2',{},{timeout:12000});
  await page.locator('#pause').click();assert.equal(await page.locator('#meter').textContent(),'Paused');
  await page.locator('#restart').click();assert((await page.locator('#players').innerText()).startsWith('0 '));
  await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(390,700),page.url());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(slug==='mazeraid')assert(await page.locator('#playfield').evaluate(c=>Math.abs(c.width/c.height-innerWidth/innerHeight)<.01));
  await page.screenshot({path:path.join(output,slug+'-mobile.png'),omitBackground:true});
  await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(1100,820),page.url());
  console.log('PASS '+slug+' relay, chat, pause, reset and narrow layout');
 }
 assert.deepEqual(errors,[]);console.log('Screenshots: '+output);
 }finally{await app.close();for(const c of relay.clients)c.terminate();await new Promise(r=>relay.close(r));await new Promise(r=>avatarServer.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
