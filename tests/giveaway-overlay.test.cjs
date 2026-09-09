'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const presentation of ['card','reel','wheel']) {
   const page=await browser.newPage({viewport:{width:1000,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(/^https?:/,route=>route.abort());
   await page.goto(pathToFileURL(path.resolve('giveaway.html')).href+'?session=test&managed&preview&presentation='+presentation+'&theme=midnight');
   await page.waitForSelector('.giveaway-stage');
   assert.equal(await page.locator('.giveaway-stage').textContent(),'GiveawayType !enter to enterGood luck!3 eligible entries');
   assert.equal(await page.locator('#spin-btn').isVisible(),false);
   assert.equal(await page.locator('#keyword-input').isVisible(),false);
   await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{source:iframe.contentWindow,data:{dataReceived:{overlayNinja:{event:'giveaway_state',meta:{giveaway:{epoch:'preview',revision:2,draw:1,open:false,keyword:'!enter',count:2,entrants:[{id:'2',name:'Morgan',platform:'twitch'},{id:'3',name:'Sam',platform:'kick'}],winners:[{id:'1',name:'<img src=x onerror=alert(1)>',platform:'youtube'}]}}}}}})));
   await page.waitForFunction(()=>document.querySelector('.giveaway-result').textContent.endsWith(' wins!'));
   assert.equal(await page.locator('.giveaway-result img').count(),0);
   await page.screenshot({path:path.join(os.tmpdir(),'ssn-giveaway-'+presentation+'.png')});
   assert.deepEqual(errors,[],presentation);
   if(presentation==='wheel') {
    await page.setViewportSize({width:1280,height:720});
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'Managed wheel fits a 720p source');
    assert.equal(await page.locator('#wheel-canvas').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true,'Entire wheel remains visible');
   }
   // Reset during a reveal must not let a stale timer announce the old winner.
   await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{source:iframe.contentWindow,data:{dataReceived:{overlayNinja:{event:'giveaway_state',meta:{giveaway:{epoch:'preview',revision:3,draw:0,open:false,keyword:'!enter',count:0,entrants:[],winners:[]}}}}}})));
   assert.equal(await page.locator('.giveaway-result').textContent(),'Good luck!');
   await page.close();
  }
  // Exercise both supported websocket channel pairs with a local relay only.
  const {wsServer:WebSocketServer}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
  for(const displayFeed of [false,true]) {
   const relay=new WebSocketServer({port:0,host:'127.0.0.1'});
   await new Promise(resolve=>relay.once('listening',resolve));
   const packet={event:'giveaway_state',meta:{giveaway:{epoch:'relay',revision:1,draw:1,open:false,keyword:'!enter',count:0,entrants:[],winners:[{id:'1',name:'Morgan',platform:'twitch'}]}}};
   let requested=false;
   relay.on('connection',socket=>socket.on('message',raw=>{
    const value=JSON.parse(raw);
    if(value.join) { assert.equal(value.out,displayFeed?3:1);assert.equal(value.in,displayFeed?4:2); }
    if(value.action==='getgiveawaystate') {requested=true;socket.send(JSON.stringify(packet));}
   }));
   const page=await browser.newPage();
   await page.route(/^https?:/,route=>route.abort());
   await page.goto(pathToFileURL(path.resolve('giveaway.html')).href+'?session=local-giveaway-test&managed&server='+encodeURIComponent('ws://127.0.0.1:'+relay.address().port)+(displayFeed?'&server2':''));
   await page.waitForFunction(()=>document.querySelector('.giveaway-result').textContent==='Morgan wins!');
   assert.equal(requested,true);
   await page.close();
   for(const socket of relay.clients) socket.terminate();
   await new Promise(resolve=>relay.close(resolve));
  }
  console.log('Giveaway audience display tests passed; screenshots in '+os.tmpdir());
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
