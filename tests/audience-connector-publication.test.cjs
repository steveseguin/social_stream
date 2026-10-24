'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');
function fixture(fetch) {
 const context={crypto:webcrypto,URL,TextEncoder,AbortController,setTimeout,clearTimeout};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../shared/audience-room/connector.js'),'utf8'),context);
 const connector=new context.NCAudienceConnector({fetch,storage:{load:async()=>null,save:async()=>{}},cleanText:s=>s});
 connector.config={room:'fixture',credential:'private',sources:['youtube'],cheer:false,receipts:[]};
 connector.state='connected'; connector.session='private-session';
 return connector;
}
const message=text=>({type:'youtube',chatname:'Viewer',chatmessage:text,textonly:true});
test('503 warns without stopping subsequent uploads or retrying the uncertain message',async()=>{
 const bodies=[];
 const c=fixture(async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:bodies.length!==1,status:503,json:async()=>({status:'sent'})};});
 await c.publish(message('uncertain'));
 assert.equal(c.state,'connected');
 assert.equal(c.status().warning,'publication_unknown');
 for(let i=0;i<3;i++)await c.publish(message('next '+i));
 assert.deepEqual(bodies.map(b=>b.text),['uncertain','next 0','next 1','next 2']);
 assert.equal(new Set(bodies.map(b=>b.id)).size,4);
 c.notify('connected'); // A readiness notification must not erase the failed-message warning.
 assert.equal(c.status().warning,'publication_unknown');
 assert.equal(c.inflight,0);
});
test('network rejection retains filtering, pause, and concurrency limits',async()=>{
 let attempts=0;
 const c=fixture(async()=>{attempts++;throw Error('network');});
 await c.publish(message('fail'));
 for(const extra of [{private:true},{suppressRelay:true},{event:'cheer'},{bot:true},{type:'twitch'},{type:'socialstreamchat'}])await c.publish({...message('excluded'),...extra});
 assert.equal(attempts,1);
 c.inflight=4;await c.publish(message('at capacity'));assert.equal(attempts,1);assert.equal(c.publicationQueue.length,1);c.inflight=0;
 await c.pause();await c.publish(message('paused'));assert.equal(attempts,1);assert.equal(c.state,'paused');assert.equal(c.publicationQueue.length,0);
 await c.disconnect();assert.equal(c.status().warning,null);
});
function heldUploads() {
 const requests=[];
 let active=0,maximum=0;
 const c=fixture((url,options)=>new Promise((resolve,reject)=>{
  active++;maximum=Math.max(maximum,active);
  requests.push({url,body:JSON.parse(options.body),finish(fail=false){active--;if(fail)reject(Error('network'));else resolve({ok:true,json:async()=>({status:'sent'})});}});
 }));
 return {c,requests,maximum:()=>maximum};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('a burst drains in order with four uploads, preserving identical text as distinct messages',async()=>{
 const {c,requests,maximum}=heldUploads();
 const expected=Array.from({length:24},(_,i)=>i<2?'same text':'message '+i);
 const pending=expected.map(text=>c.publish(message(text)));
 assert.equal(requests.length,4);assert.equal(c.publicationQueue.length,20);
 for(let i=0;i<expected.length;i++){assert.ok(requests[i],'queued message starts');requests[i].finish();await tick();}
 await Promise.all(pending);
 assert.deepEqual(requests.map(r=>r.body.text),expected);
 assert.equal(new Set(requests.map(r=>r.body.id)).size,24);
 assert.equal(maximum(),4);assert.equal(c.inflight,0);assert.equal(c.publicationQueue.length,0);
 assert.equal(c.status().warning,null);
});
test('a full queue warns, and a failed upload frees its slot without retrying',async()=>{
 const {c,requests,maximum}=heldUploads();
 const pending=Array.from({length:25},(_,i)=>c.publish(message('message '+i)));
 assert.equal(c.publicationQueue.length,20);assert.equal(c.status().warning,'publication_queue_full');
 for(let i=0;i<24;i++){requests[i].finish(i===0);await tick();}
 await Promise.all(pending);
 assert.deepEqual(requests.map(r=>r.body.text),Array.from({length:24},(_,i)=>'message '+i));
 assert.equal(c.status().warning,'publication_unknown');assert.equal(maximum(),4);
 assert.equal(c.inflight,0);assert.equal(c.publicationQueue.length,0);
});
test('pause clears waiting messages and late completions cannot publish them into a new room',async()=>{
 const {c,requests,maximum}=heldUploads();
 const pending=Array.from({length:10},(_,i)=>c.publish(message('old '+i)));
 await c.pause();assert.equal(c.publicationQueue.length,0);
 c.config.room='new-room';c.config.credential='new-credential';c.session='new-session';c.paused=false;c.notify('connected');
 pending.push(c.publish(message('new room message')));
 assert.equal(requests.length,4);
 for(let i=0;i<5;i++){requests[i].finish(i===0);await tick();}
 await Promise.all(pending);
 assert.deepEqual(requests.map(r=>r.body.text),['old 0','old 1','old 2','old 3','new room message']);
 assert.ok(requests[4].url.includes('/new-room/'));
 assert.equal(c.status().warning,null);assert.equal(c.inflight,0);assert.equal(maximum(),4);
});
test('connection loss stops draining and reconnect clears the old backlog',async()=>{
 const {c,requests}=heldUploads();
 const pending=Array.from({length:10},(_,i)=>c.publish(message('before reconnect '+i)));
 c.notify('reconnecting');
 for(let i=0;i<4;i++){requests[i].finish();await tick();}
 await Promise.all(pending);assert.equal(requests.length,4);
 c.stop();c.session='reconnected-session';c.notify('connected');
 const fresh=c.publish(message('after reconnect'));
 assert.equal(requests.length,5);requests[4].finish();await fresh;
 assert.equal(requests.length,5);assert.equal(requests[4].body.text,'after reconnect');
 assert.equal(c.publicationQueue.length,0);assert.equal(c.inflight,0);
});
test('late failure cannot change a paused connection or warn a disconnected room',async()=>{
 let reject;const c=fixture(()=>new Promise((_resolve,r)=>reject=r));
 const pending=c.publish(message('in flight'));
 await c.disconnect();reject(Error('late failure'));await pending;
 assert.equal(c.state,'disconnected');assert.equal(c.status().warning,null);assert.equal(c.inflight,0);
});
test('protocol and Cheer warnings also preserve a live chat connection',async()=>{
 let uploads=0;
 const c=fixture(async url=>{if(url.endsWith('/chat'))uploads++;return {ok:true,json:async()=>({token:'session'})};});
 c.options.WebSocket=class { send() {} close() {} };
 c.options.onCheer=async()=>{throw Error('overlay unavailable');};
 c.config.cheer=true;
 await c.connect();
 c.ws.onmessage({data:JSON.stringify({type:'community_ready'})});
 c.ws.onmessage({data:'malformed-json'});
 assert.equal(c.state,'connected');assert.equal(c.status().warning,'protocol_error');
 await c.publish(message('after malformed frame'));
 c.ws.onmessage({data:JSON.stringify({type:'community_ready',requests:[{id:'a'.repeat(32),expires:Date.now()/1000+30}]})});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(c.state,'connected');assert.equal(c.status().warning,'effect_error');
 await c.publish(message('after failed effect'));
 assert.equal(uploads,2);c.stop();
});
