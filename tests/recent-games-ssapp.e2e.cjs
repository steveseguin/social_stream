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
 await page.addInitScript(()=>{const original=Date.now;window.qaOffset=0;Date.now=()=>original()+window.qaOffset;Math.random=()=>0;});
 const cases=[['signallock','!code 1234'],['crowdquest','!vote 1'],['minorityclub','!pick sun'],['tugofwar','!join'],['crewkitchen','!cook dough'],['beaconrelay','!pass'],['meteorshield','!shield red'],['memoryparade','!ready'],['oddoneout','!odd 1'],['sumsquad','!add 5'],['rockpapershowdown','!throw rock'],['wordshuffle','!solve garden'],['numberhunt','!guess 50']];
 for(const [slug,command] of cases){
  let client;const joined=new Promise(resolve=>relay.once('connection',s=>{client=s;s.once('message',v=>resolve(JSON.parse(v)));}));
  await page.goto('file:///'+root.replace(/\\/g,'/')+'/games/'+slug+'.html?session=recent-private-qa&server');assert.deepEqual(await joined,{join:'recent-private-qa',out:2,in:1});
  const send=(name,text,extra)=>client.send(JSON.stringify({content:{type:'youtube',chatname:name,chatmessage:text,textonly:true,...extra}}));
  send('Ignored',command,{private:true});await delay(100);assert.equal(await page.locator('#participants').textContent(),'0');
  send('Juniper',command,{id:'one'});await page.waitForFunction(()=>document.getElementById('participants').textContent==='1');await delay(350);send('Milo',slug==='numberhunt'?'!guess 25':command,{id:'two'});
  // Signal rejects repeated code guesses even from another account.
  if(slug!=='signallock')await page.waitForFunction(()=>document.getElementById('participants').textContent==='2');
  if(slug==='memoryparade'){const sequence=(await page.locator('.memory-tile').allTextContents()).join('');await page.evaluate(()=>qaOffset+=5100);await page.waitForFunction(()=>document.getElementById('play-command').textContent.includes('!mem'));assert((await page.locator('.memory-tile').allTextContents()).every(t=>t==='?'));send('Juniper','!mem '+sequence);send('Milo','!remember '+sequence);}
  if(slug==='tugofwar'){send('Juniper','rocket');await delay(150);assert.match(await page.locator('#history').textContent(),/pulled/);}
  if(slug==='numberhunt')assert.equal(await page.locator('.command code').textContent(),'!guess 12');
  if(slug==='wordshuffle')assert.equal(await page.locator('.command code').textContent(),'!solve');
  await page.screenshot({path:path.join(output,slug+'-desktop.png'),omitBackground:true});
  await page.locator('#pause').click();const count=await page.locator('#participants').textContent();send('Paused viewer',command);await page.evaluate(()=>qaOffset+=5000);await delay(300);assert.equal(await page.locator('#participants').textContent(),count);assert.match(await page.locator('#clock-value').textContent(),/Paused/);await page.locator('#pause').click();
  await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(390,900),page.url());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),slug+' no horizontal overflow');await page.screenshot({path:path.join(output,slug+'-mobile.png'),fullPage:true});
  await page.evaluate(()=>qaOffset+=200000);await page.waitForFunction(()=>!document.getElementById('result').hidden);assert((await page.locator('#result').textContent()).length>0);
  await page.locator('#next').click();await page.waitForFunction(()=>document.getElementById('result').hidden);await page.locator('#restart').click();assert.equal(await page.locator('#participants').textContent(),'0');
  await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(1100,820),page.url());console.log('PASS '+slug+' relay, input, pause, result, next, reset and layouts');
 }
 assert.deepEqual(errors,[]);console.log('Screenshots: '+output);
 }finally{await app.close();for(const c of relay.clients)c.terminate();await new Promise(r=>relay.close(r));await new Promise(r=>avatarServer.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
