const {test}=require('node:test'),assert=require('node:assert/strict'),{Game}=require('../games/ambient-engine.js');
const msg=(chatmessage,name='River',extra={})=>Object.assign({chatmessage,chatname:name,type:'youtube',textonly:true},extra);
const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*10);i++)g.tick(.1);};
function random(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
test('Maze exploration and pursuit stay inside corridors, credit a winner, and reset',()=>{
 for(let seed=1;seed<=5;seed++){
  const g=new Game('maze',{random:random(seed)});g.input(msg('Hello maze'));const firstMap=g.map;
  for(let i=0;i<3000&&g.phase!=='result';i++){g.tick(.1);for(const p of [g.explorer,...g.enemies])assert.equal(g.map[Math.floor(p.y)][Math.floor(p.x)],0);}
  assert.equal(g.phase,'result');assert.equal(g.hp,0);assert.equal(g.winner.name,'River');assert.equal(g.input(msg('too late','Other')),false);advance(g,8.2);assert.equal(g.round,2);assert.equal(g.hp,100);assert.equal(g.enemies.length,0);assert.equal(g.users.size,0);assert.notEqual(g.map,firstMap);
 }
});
test('Maze final hit belongs to the attacker, with bounded enemies and safe avatar schemes',()=>{
 const g=new Game('maze',{random:random(1)});g.input(msg('hello','First',{chatimg:'javascript:alert(1)'}));g.input(msg('hello','Last',{chatimg:'https://example.test/avatar.png'}));assert.equal(g.enemies[0].avatar,'');assert.equal(g.enemies[1].avatar,'https://example.test/avatar.png');g.enemies[0].x=13.5;g.enemies[0].y=13.5;g.enemies[1].x=g.explorer.x;g.enemies[1].y=g.explorer.y;g.hp=5;g.tick(.1);assert.equal(g.winner.name,'Last');
 const busy=new Game('maze');for(let n=0;n<2000;n++)busy.input(msg('hi','User'+n));assert.equal(busy.enemies.length,40);assert.equal(busy.users.size,40);advance(busy,3.1);assert(busy.input(msg('again','User0')));assert.equal(busy.enemies.length,40);
});
test('Overlay games ignore non-chat, duplicate deliveries, and overly large input',()=>{
 for(const mode of ['maze','catch','rally']){const g=new Game(mode);const command=mode==='catch'?'!catch':mode==='rally'?'!boost':'hi';for(const extra of [{bot:true},{private:true},{reflection:true},{event:'donation'},{chatmessage:42},{chatmessage:'x'.repeat(2001)}])assert.equal(g.input(msg(command,'A',extra)),false);assert(g.input(msg(command,'A',{id:'one'})));assert.equal(g.input(msg(command,'B',{id:'one'})),false);}
});
test('Comet teams balance, keep membership, rate-limit boosts, and finish automatically',()=>{
 const g=new Game('rally');assert(g.input(msg('!boost','A')));assert.equal(g.input(msg('!boost','A')),false);assert(g.input(msg('!boost','B')));assert.deepEqual(g.counts,[1,1]);for(let i=1;i<20;i++){advance(g,3.1);g.input(msg('!boost','A'));}assert.equal(g.phase,'result');assert.match(g.result,/Coral/);advance(g,8.2);assert.equal(g.phase,'waiting');assert.deepEqual(g.points,[0,0]);
 const tie=new Game('rally');tie.input(msg('!boost','A'));tie.input(msg('!boost','B'));advance(tie,60.1);assert.match(tie.result,/tied/);
});
test('Fireflies score timing once per account per flight and end after six flights',()=>{
 const g=new Game('catch');g.input(msg('!catch','Starter'));advance(g,4);assert(g.input(msg('!catch','Winner')));assert.equal(g.users.get(JSON.stringify(['youtube','Winner'])).score,3);assert.equal(g.input(msg('!catch','Winner')),false);advance(g,8);assert(g.input(msg('!catch','Winner')));assert.equal(g.users.get(JSON.stringify(['youtube','Winner'])).score,6);advance(g,36.1);assert.equal(g.phase,'result');assert.equal(g.winner.name,'Winner');advance(g,8.2);assert.equal(g.phase,'waiting');
});
test('Pages isolate demo traffic, render transparent layers, receive their bridge, and pause',async()=>{
 const {chromium}=require('playwright'),{pathToFileURL}=require('node:url'),path=require('node:path');const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://vdo.socialstream.ninja/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>Bridge'}));
  for(const [slug,command] of [['mazeraid','hi'],['fireflycatch','!catch'],['cometrally','!boost']]){
   const url=pathToFileURL(path.join(__dirname,'../games',slug+'.html')).href;
   await page.goto(url+'?demo&server&session=never-connect');assert.equal(page.frames().length,1);
   await page.goto(url+'?session=fixture&clean');assert.equal(await page.locator('#controls').isVisible(),false);assert.equal(await page.locator('#connection').isVisible(),false);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
   await page.evaluate(m=>postMessage({dataReceived:{overlayNinja:m}},'*'),msg(command));assert.match(await page.locator('#players').textContent(),/^0 /);
   const bridge=page.frames().find(f=>f!==page.mainFrame());await bridge.waitForLoadState();await bridge.evaluate(m=>parent.postMessage({dataReceived:{overlayNinja:m}},'*'),msg(command,'<img src=x onerror=alert(1)>'));
   await page.waitForFunction(()=>document.getElementById('players').textContent.startsWith('1 '));assert.equal(await page.locator('#layer img').count(),0);
   await page.evaluate(()=>document.getElementById('pause').click());await bridge.evaluate(m=>parent.postMessage({dataReceived:{overlayNinja:m}},'*'),msg(command,'Other'));assert.match(await page.locator('#players').textContent(),/^1 /);assert.equal(await page.locator('#meter').textContent(),'Paused');
   await page.evaluate(()=>document.getElementById('restart').click());assert.match(await page.locator('#players').textContent(),/^0 /);
   for(const width of [390,1280]){await page.setViewportSize({width,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('New overlays retain the relay join protocol and receive WebSocket chat without a second transport',async()=>{
 const path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
 const {wsServer:Server}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));const server=new Server({port:0});await new Promise(r=>server.on('listening',r));const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();for(const [slug,command] of [['mazeraid','hello'],['fireflycatch','!catch'],['cometrally','!boost']]){
  let client;const joined=new Promise(r=>server.once('connection',s=>{client=s;s.once('message',v=>r(JSON.parse(v)));}));await page.goto(pathToFileURL(path.join(__dirname,'../games',slug+'.html')).href+'?session=fixture&server='+encodeURIComponent('ws://127.0.0.1:'+server.address().port));assert.deepEqual(await joined,{join:'fixture',out:2,in:1});assert.equal(page.frames().length,1);client.send(JSON.stringify({content:msg(command)}));await page.waitForFunction(()=>document.getElementById('players').textContent.startsWith('1 '));
 }}finally{await browser.close();for(const c of server.clients)c.terminate();await new Promise(r=>server.close(r));}
});
