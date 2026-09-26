const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {createStaticServer,closeServer} = require('./background-overlay-compat-matrix.test.cjs');
const {configureContext,deliver} = require('./helpers/chat-security-harness.cjs');
const {routePositiveControl}=require('./helpers/name-security-controls.cjs');
const files=[
  "themes/overlay-bubbles.html",
  "themes/horizontal.html",
  "themes/notimeoutmessages.html",
  "themes/overlay-neon-cyberpunk.html",
  "themes/overlay-credits.html",
  "themes/overlay-comic-pop.html",
  "themes/overlay-comic-classic.html",
  "themes/overlay-cards.html",
  "themes/overlay-particles.html",
  "themes/Windows3.1/index.html",
  "themes/sampleoverlay_reverse.html",
  "themes/spiritoverlay.html",
  "themes/rainbowpuke/index.html",
  "themes/t3nk3y/index.html",
  "themes/overlay-xacception.html",
  "themes/overlay-typewriter.html",
  "sampleoverlay.html",
  "samplefeatured.html",
  "septapus.html",
  "tipjar.html",
  "bot.html",
  "waitlist.html",
  "themes/events/index.html",
  "themes/deuks_overlay/overlay2.html",
  "chathistory.html"
];
const attack = 'NAME_PROBE<img src="data:image/png;base64,broken" onerror="window.__nameHits++">';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const selector='.name,.hl-name,#author-name,.user-name,.username,.tip-name,.waitlist-entry-text,.username-box > span,.event-message';
const names = ['A & B','A &amp; B',"O&#039;Brien",'&lt;Viewer&gt;','\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}','<b>Bold</b>','Viewer <img class="regular-emote" src="'+pixel+'" alt="wave">'];
(async()=>{
 const server=await createStaticServer();let browser,id=943100;
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext();await configureContext(context,server.baseUrl);
  async function open(file,control){
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.__nameHits=0;window.alert=window.confirm=window.prompt=()=>window.__nameHits++;});
   if(control) await routePositiveControl(page,file);
   await page.goto(server.baseUrl+'/'+file+'?session=SWEEP_CHECK&style=meter&ssappSnapshot=1&persistent',{waitUntil:'domcontentloaded'});
   return {page,errors,file};
  }
  async function send(target,name,extra={},mode=true){
   const {page,file,errors}=target;await page.evaluate(()=>{window.__nameHits=0;});
   const data={id:++id,chatname:name,chatmessage:'TEST_BODY_'+id,type:'youtube',textonly:mode,hasDonation:'$5.00',donoValue:5,event:'subscription',timestamp:Date.now(),...extra};
   if(mode===null)delete data.textonly;
   if(file==='chathistory.html')await page.evaluate(data=>{
    window.dispatchEvent(new MessageEvent('message',{source:window,data:{type:'ssapp-chat-history-snapshot',snapshot:{messages:[data]}}}));
    resetAndLoadMessages();
   },data);
   else await deliver(page,file==='waitlist.html'?{waitlist:[data]}:data);
   await page.waitForTimeout(file==='bot.html'?550:60);
   const state=await page.evaluate(selector=>({hits:window.__nameHits,names:Array.from(document.querySelectorAll(selector)).map(n=>n.textContent),emotes:document.querySelectorAll('img.regular-emote').length}),selector);
   assert.deepEqual(errors,[],file+' page errors');return state;
  }
  for(const file of files){
   const old=await open(file,true),fixed=await open(file,false);
   const extra=file==='themes/deuks_overlay/overlay2.html'?{type:'follow'}:{};
   const before=await send(old,attack,extra),after=await send(fixed,attack,extra);
   assert.ok(before.hits>0,'Positive control: '+file);assert.equal(after.hits,0,'Fixed: '+file);
   for(const name of names){
    const a=await send(old,name,extra),b=await send(fixed,name,extra);
    // Ignore the deliberately malicious first row retained by list overlays.
    assert.deepEqual(b.names.filter(n=>!n.includes('NAME_PROBE')),a.names.filter(n=>!n.includes('NAME_PROBE')),file+' name '+name);
    assert.equal(b.emotes,a.emotes,file+' name emotes');
   }
   for(const mode of [false,null])assert.equal((await send(fixed,attack,extra,mode)).hits,0,file+' mode '+mode);
   await fixed.page.evaluate(()=>{delete window.SocialStreamChatHTML;});
   assert.equal((await send(fixed,attack,extra)).hits,0,file+' missing helper');
   await old.page.close();await fixed.page.close();console.log('PASS '+file);
  }
 }finally{if(browser)await browser.close();await closeServer(server.server);}
})().catch(e=>{console.error(e);process.exitCode=1;});
