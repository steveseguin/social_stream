const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sources/joystick.js'), 'utf8');
// Disable only the inert allocation in an isolated positive control.
const needle = 'var div = template.content.appendChild(document.createElement("div"));';
assert.equal(source.split(needle).length, 2, 'Locate the production parser fix');
const unsafe = source.replace(needle, 'var div = document.createElement("div");');
const probe = '<img src="data:image/png;base64,broken" onerror="window.__joystickHits++">';
const marker = 'https://joystick.tv/u/offline-review/chat';
const policies = [
 ['none', ''],
 ['allows-inline', "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:"],
 ['blocks-handlers', "default-src 'self'; script-src 'self'; script-src-attr 'none'; img-src 'self' data:"]
];
const names = ['PlainViewer', 'A &amp; B', 'A "Ace"', '\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}', '<b>Viewer</b>'];
const samples = ['Hello world', 'A & B < 3 > 1', 'A &amp; B &#128512;', '<b>hello</b>', 'one<br>two<br/>three', ' \tA\u00a0 B\n C ', '\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}', 'hi <img src="/emote.png" alt=":wave:"> there', '<table><tr><td>hello</td></tr></table>', '<tr><td>hello</td></tr>', '<template>hidden</template>visible', '<span class="newAccountBadge">NEW</span> Viewer'];
(async () => {
 const browser = await chromium.launch({headless:true}); let id=0; const results=[];
 try {
  async function open(fixed, textonly, policy='') {
   const context=await browser.newContext();
   await context.route('**/*', route => route.request().url()===marker ? route.fulfill({contentType:'text/html',headers:policy?{'content-security-policy':policy}:{},body:'<!doctype html><div id="chat-messages"></div><input placeholder="Write in chat">'}) : route.abort());
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(marker);
   await page.evaluate(()=>{window.__joystickHits=0;window.__violations=[];document.addEventListener('securitypolicyviolation',e=>window.__violations.push(e.effectiveDirective));});
   const cdp=await context.newCDPSession(page);const {frameTree}=await cdp.send('Page.getFrameTree');
   const {executionContextId}=await cdp.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'ssn-content-script-test'});
   async function isolated(expression){const result=await cdp.send('Runtime.evaluate',{expression,contextId:executionContextId,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
   await isolated(`window.__captured=[];window.chrome={runtime:{id:'offline-test',onMessage:{addListener:function(){}},sendMessage:function(id,payload,cb){if(payload.getSettings){cb({settings:{textonlymode:${textonly}},state:true});return;}window.__captured.push(JSON.parse(JSON.stringify(payload)));if(cb)cb({});}}};`);
   await isolated(fixed?source:unsafe);
   return {context,page,isolated,errors};
  }
  async function send(target,text,author={username:'alice',nickname:'Alice',usernameColor:'#123456'},extra={}){
   const messageId='probe-'+ ++id;
   await target.page.evaluate(()=>window.__joystickHits=0);
   await target.page.evaluate(({text,author,messageId,extra})=>window.postMessage({source:'joystick-ws-interceptor',type:'receive',data:JSON.stringify({identifier:JSON.stringify({channel:'ChatChannel',stream_id:'offline-review'}),message:{event:'ChatMessage',type:'new_message',messageId,text,author,...extra}})},'*'),{text,author,messageId,extra});
   for(let i=0;i<20;i++) { if(await target.isolated(`window.__captured.some(x=>x.message && x.message.id===${JSON.stringify(messageId)})`)) break; await target.page.waitForTimeout(30); }
   await target.page.waitForTimeout(80);
   const payload=await target.isolated(`window.__captured.filter(x=>x.message && x.message.id===${JSON.stringify(messageId)}).map(x=>x.message)`);
   assert.equal(payload.length,1,'Actual receiver must emit the message');assert.deepEqual(target.errors,[]);
   return {payload:payload[0],...await target.page.evaluate(()=>({hits:window.__joystickHits,violations:window.__violations}))};
  }
  for(const [policyName,policy] of policies){
   for(const textonly of [false,true]){
    const old=await open(false,textonly,policy),fixed=await open(true,textonly,policy);
    const before=await send(old,'Viewer text '+probe),after=await send(fixed,'Viewer text '+probe);
    assert.equal(before.hits>0,policyName!=='blocks-handlers');assert.equal(after.hits,0);
    if(policyName==='blocks-handlers')assert.ok(before.violations.includes('script-src-attr'));
    results.push({policy:policyName,textonly,oldHits:before.hits,fixedHits:after.hits});
    await old.context.close();await fixed.context.close();
   }
  }
  let compatibility=0;
  for(const textonly of [false,true]){
   const old=await open(false,textonly),fixed=await open(true,textonly);
   for(const text of samples){
    const a=(await send(old,text)).payload,b=(await send(fixed,text)).payload;delete a.id;delete b.id;delete a.meta.messageId;delete b.meta.messageId;
    assert.deepEqual(b,a,'Message compatibility: '+text);compatibility++;
   }
   for(const name of names){
    const author={username:name,nickname:name,displayNameWithFlair:'<b>'+name+'</b>',usernameColor:'#123456'};
    const a=(await send(old,'hello',author)).payload,b=(await send(fixed,'hello',author)).payload;delete a.id;delete b.id;delete a.meta.messageId;delete b.meta.messageId;
    assert.deepEqual(b,a,'Identity compatibility: '+name);compatibility++;
   }
   const oldName=await send(old,'name probe',{username:'alice',displayNameWithFlair:probe+'Alice'});
   const fixedName=await send(fixed,'name probe',{username:'alice',displayNameWithFlair:probe+'Alice'});
   assert.ok(oldName.hits);assert.equal(fixedName.hits,0);
   const changed=(await send(old,'<noscript><b>Viewer</b></noscript>')).payload.chatmessage;
   const newValue=(await send(fixed,'<noscript><b>Viewer</b></noscript>')).payload.chatmessage;
   results.push({textonly,edgeCase:'raw noscript',before:changed,after:newValue});
   await old.context.close();await fixed.context.close();
  }
  for(const textonly of [false,true]){
   for(const fixed of [false,true]){
    const target=await open(fixed,textonly);
    // The platform displays literal text safely; only SSN's subsequent cache
    // fingerprinting reparses it. Never pre-inject executable markup into the DOM.
    await target.page.evaluate(probe=>{
     const row=document.createElement('div');row.className='chat-message';
     const name=document.createElement('span');name.className='username';name.textContent='Viewer:';
     const body=document.createElement('span');body.className='content';body.textContent='Literal '+probe;
     row.append(name,body);document.getElementById('chat-messages').appendChild(row);
    },probe);
    await target.page.waitForTimeout(250);
    const emitted=await target.isolated('window.__captured.filter(x=>x.message).map(x=>x.message)');assert.equal(emitted.length,1);
    const hits=await target.page.evaluate(()=>window.__joystickHits);
    assert.equal(hits>0,!fixed&&textonly);
    results.push({path:'DOM fallback',textonly,fixed,hits});await target.context.close();
   }
  }
  console.log(JSON.stringify({results,compatibility},null,2));
  console.log('PASS Joystick WebSocket/DOM parsing, page-policy controls, names and '+compatibility+' compatibility comparisons');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
