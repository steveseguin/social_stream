const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
function catalog(){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'games/catalog.js'),'utf8'),c);return c.window.SSNGamesCatalog;}
test('Gallery includes every popup game exactly once with a packaged screenshot',()=>{
 const games=catalog(),popup=fs.readFileSync(path.join(root,'popup.html'),'utf8');
 const selector=popup.match(/<select id="games-preset-select"[\s\S]*?<\/select>/)[0];
 const paths=Array.from(selector.matchAll(/<option value="([^"]+)"/g),m=>m[1]);
 assert.deepEqual(Array.from(games,g=>g.path).sort(),paths.sort());assert.equal(new Set(games.map(g=>g.id)).size,games.length);
 for(const g of games){assert(fs.existsSync(path.join(root,g.path)));const bytes=fs.readFileSync(path.join(root,'docs',g.image));assert.equal(bytes.readUInt16BE(0),0xffd8);assert(bytes.length>1000);}
});
test('Pet Race and Emoji Tower safely ignore malformed payloads and still accept real commands',()=>{
 for(const id of ['petrace','emojitower']){
  const source=fs.readFileSync(path.join(root,'games',id+'.html'),'utf8'),start=source.indexOf('    function processData(data)'),end=source.indexOf('\n    }',start)+6,calls=[];
  const c={stripHtml:s=>s.replace(/<[^>]*>/g,''),processJoinRace:(...v)=>calls.push(v),dropEmoji:(...v)=>calls.push(v)};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
  for(const data of [null,undefined,42,{}, {content:[]},{chatmessage:42,chatname:'Test',textonly:true},{chatmessage:'!drop',chatname:{}}])assert.doesNotThrow(()=>c.processData(data));
  c.processData({content:{chatname:'Viewer',chatmessage:id==='petrace'?'!join dog':'!drop',textonly:true}});assert.equal(calls.length,1);assert.equal(calls[0][0],'Viewer');
 }
});
test('All advertised demos stay offline even when a session and server are supplied',async()=>{
 const browser=await require('playwright').chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.route(/https?:\/\//,r=>r.abort());
  await page.addInitScript(()=>{window.socketAttempts=[];window.WebSocket=function(url){window.socketAttempts.push(url);};});
  for(const g of catalog().filter(g=>g.demo)){
   await page.goto(pathToFileURL(path.join(root,g.path)).href+'?demo&server&session=must-not-connect');
   assert.equal(await page.locator('iframe').count(),0,g.id);assert.deepEqual(await page.evaluate(()=>window.socketAttempts),[],g.id);
  }
 }finally{await browser.close();}
});
test('Legacy WebSocket games use one transport and still handle chat',async()=>{
 const {wsServer:WebSocketServer}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
 const server=new WebSocketServer({port:0});await new Promise(r=>server.on('listening',r));const browser=await require('playwright').chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.route('https://**',r=>r.abort());
  const cases={colorwars:['!red','teams.red.players.size'],dancingparade:['!join','dancers.size'],wordchain:[null,'scores.size'],treasurehunt:['!dig A1','revealedCells.size'],emojitower:['!drop','contributors.size'],emojirain:[String.fromCodePoint(0x1f308),'gameState.totalDrops'],chatwars:['!red','gameState.teams.red.players.size'],wordstorm:['community','gameState.words.size'],chaosmode:['hello','document.querySelectorAll(".message-item").length'],colorsymphony:['red','gameState.notesPlayed'],chatgarden:['flower','gameState.totalPlants'],pixelbattle:['red 3 4','gameState.pixelsPainted'],memorylane:['childhood','gameState.memoryCount'],rhythmpulse:['kick','gameState.beatCount']};
  for(const id of Object.keys(cases)){
   let socket;const join=new Promise(resolve=>server.once('connection',s=>{socket=s;s.once('message',v=>resolve(JSON.parse(v)));}));
   await page.goto(pathToFileURL(path.join(root,'games',id+'.html')).href+'?session=local-fixture&server='+encodeURIComponent('ws://127.0.0.1:'+server.address().port));
   assert.deepEqual(await join,{join:'local-fixture',out:2,in:1});assert.equal(await page.locator('iframe').count(),0);
   const command=id==='wordchain'?await page.evaluate(()=>currentWord.slice(-1)+'ELLO'):cases[id][0];
   socket.send(JSON.stringify({content:{chatname:'Test Viewer',chatmessage:command,textonly:true,type:'youtube'}}));
   await page.waitForFunction(cases[id][1]+'>0');
  }
 }finally{await browser.close();for(const c of server.clients)c.terminate();await new Promise(r=>server.close(r));}
});
test('Phrase Guessing hides answers during play and fits a phone viewport',async()=>{
 const browser=await require('playwright').chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(pathToFileURL(path.join(root,'games/phraseguess.html')).href+'?demo');
  assert(await page.locator('#phrasesInput').isVisible());await page.locator('#gameToggle').click();assert.equal(await page.locator('#phrasesInput').isVisible(),false);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#gameToggle').click();await page.locator('summary').click();assert(await page.locator('#phrasesInput').isVisible());
 }finally{await browser.close();}
});
const {test:galleryTest}=require('node:test');
galleryTest('Gallery filters, safe previews, private session links and clipboard work together',async()=>{
 const browser=await require('playwright').chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.addInitScript(()=>{window.copiedLink='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copiedLink=value;}}});});
  await page.goto(pathToFileURL(path.join(root,'docs/games-gallery.html')).href+'?session=private-fixture&password=a%26b');
  assert(!page.url().includes('password'));assert.equal(await page.locator('.game-card').count(),catalog().length);
  await page.locator('.game-card').first().getByRole('button',{name:'Copy OBS link'}).click();const copied=new URL(await page.evaluate(()=>window.copiedLink));assert.equal(copied.searchParams.get('session'),'private-fixture');assert.equal(copied.searchParams.get('password'),'a&b');
  const preview=await page.locator('.game-card').first().getByRole('link',{name:'Preview',exact:true}).getAttribute('href');assert.equal(new URL(preview,page.url()).search,'?demo');
  await page.locator('#game-search').fill('tug');assert.equal(await page.locator('.game-card:visible').count(),1);await page.locator('#game-search').fill('nonexistent game');assert(await page.locator('#game-empty').isVisible());await page.locator('#game-search').fill('');
  await page.locator('[data-category="Teams"]').click();assert.equal(await page.locator('.game-card:visible').count(),catalog().filter(g=>g.category==='Teams').length);await page.locator('[data-category="all"]').click();
  await page.locator('.game-shot').first().click();assert(await page.locator('#game-preview').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#game-preview').isVisible(),false);
  await page.locator('#game-connection').evaluate(el=>el.open=true);await page.locator('#game-session').fill('');await page.locator('.use-game').first().click();assert.equal(await page.evaluate(()=>document.activeElement.id),'game-session');
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 }finally{await browser.close();}
});
test('Favorites persist locally, combine with filters, and can be removed',async()=>{
 const browser=await require('playwright').chromium.launch({headless:true});try{
  const page=await browser.newPage();const url=pathToFileURL(path.join(root,'docs/games-gallery.html')).href;
  await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.locator('.game-favorite').first().click();assert.equal(await page.locator('.game-favorite').first().getAttribute('aria-pressed'),'true');
  await page.reload();assert.equal(await page.locator('.game-favorite').first().getAttribute('aria-pressed'),'true');
  await page.locator('#favorites-only').click();assert.equal(await page.locator('.game-card:visible').count(),1);
  await page.locator('#game-search').fill('tug');assert.equal(await page.locator('.game-card:visible').count(),0);await page.locator('#game-search').fill('');
  await page.locator('.game-favorite:visible').click();assert.equal(await page.locator('.game-card:visible').count(),0);assert.match(await page.locator('#game-empty').textContent(),/No favorites yet/);
  assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('ssn-game-favorites'))),[]);
  await page.locator('#favorites-only').click();assert.equal(await page.locator('.game-card:visible').count(),catalog().length);
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 }finally{await browser.close();}
});
test('Invalid or unavailable favorites storage does not break the gallery',async()=>{
 const browser=await require('playwright').chromium.launch({headless:true});try{
  const page=await browser.newPage(),url=pathToFileURL(path.join(root,'docs/games-gallery.html')).href;await page.goto(url);
  for(const value of ['broken','{}','["missing-game",null,123]']){await page.evaluate(value=>localStorage.setItem('ssn-game-favorites',value),value);await page.reload();assert.equal(await page.locator('.game-favorite[aria-pressed="true"]').count(),0);}
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}}));await page.reload();await page.locator('.game-favorite').first().click();await page.locator('#favorites-only').click();assert.equal(await page.locator('.game-card:visible').count(),1);assert.match(await page.locator('#favorite-status').textContent(),/could not save/);
 }finally{await browser.close();}
});
