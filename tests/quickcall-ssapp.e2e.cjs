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
 let client;const joined=new Promise(resolve=>relay.once('connection',s=>{client=s;s.once('message',v=>resolve(JSON.parse(v)));}));
 await page.goto('file:///'+root.replace(/\\/g,'/')+'/games/quickcall.html?session=quick-private-qa&server');
 assert.deepEqual(await joined,{join:'quick-private-qa',out:2,in:1});
 const send=(name,text,extra)=>client.send(JSON.stringify({content:{type:'youtube',chatname:name,chatmessage:text,textonly:true,...extra}}));
 send('Juniper','!quick');send('Cosmic Cat','!quick');send('<img src=x onerror=alert(1)>','!quick');send('River','!quick');
 await page.waitForFunction(()=>document.querySelectorAll('.call').length===3);
 assert.equal(await page.locator('.call img').count(),0);assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 const codes=await page.locator('.code').allTextContents();send('River',codes[0]);await delay(600);assert.equal(await page.locator('.done').count(),0);
 await page.screenshot({path:path.join(output,'quickcall-desktop.png'),omitBackground:true});
 await page.locator('#pause').click();send('Juniper',codes[0]);await delay(600);assert.equal(await page.locator('.done').count(),0);await page.locator('#pause').click();
 send('Juniper',codes[0]);send('Cosmic Cat',codes[1]);send('<img src=x onerror=alert(1)>',codes[2]);await page.waitForFunction(()=>document.querySelectorAll('.done').length===3);assert.equal(await page.locator('#leaders li').count(),3);
 await page.waitForFunction(()=>document.querySelector('.name').textContent==='River');
 await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(390,700),page.url());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'quickcall-mobile.png'),omitBackground:true});
 await page.locator('#restart').click();assert.equal(await page.locator('.call').count(),0);assert.match(await page.locator('#leaders').textContent(),/first correct/);
 send('Solo','!quick');await page.waitForFunction(()=>document.querySelectorAll('.call').length===1);
 await page.waitForFunction(()=>document.querySelector('.outcome').textContent.includes('Missed'),{},{timeout:35000});
 assert.equal(await page.evaluate(()=>scrollY),0);await page.screenshot({path:path.join(output,'quickcall-missed.png'),omitBackground:true});
 await page.waitForFunction(()=>document.querySelectorAll('.call').length===0,{},{timeout:10000});assert.match(await page.locator('#round').textContent(),/Waiting/);
 await page.reload();assert.equal(await page.locator('.call').count(),0);
 await page.goto('file:///'+root.replace(/\\/g,'/')+'/games/quickcall.html?demo&session=unused&server&clean');assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('#controls').isVisible(),false);await page.waitForFunction(()=>document.querySelectorAll('.call').length===3);
 await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).setContentSize(1100,720),page.url());
 await delay(1500);await page.screenshot({path:path.join(output,'quickcall-gallery.png'),omitBackground:true});
 console.log('PASS Quick Call SSApp relay, eligibility, scoring, rotation, pause, reset, resize and isolated demo');
 assert.deepEqual(errors,[]);console.log('Screenshots: '+output);
 }finally{await app.close();for(const c of relay.clients)c.terminate();await new Promise(r=>relay.close(r));await new Promise(r=>avatarServer.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
