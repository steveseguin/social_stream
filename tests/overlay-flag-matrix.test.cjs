'use strict';
// Maintained receivers in Chromium with controlled relay/iframe boundaries.
// This is routing/receiver coverage, not an SSApp or OBS runtime certification.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createStaticServer,closeServer,configureNetworkMocks,waitForCondition,markerCount}=require('./background-overlay-compat-matrix.test.cjs');
const root=path.resolve(__dirname,'..');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-overlay-flags-'));
const modes=[
 ['none',''],['local-only','localserver&localserverport=4567'],['server3','server3'],
 ['server','server'],['server2','server2'],['server+server2','server&server2'],
 ['server2+server3','server2&server3'],['all','server&server2&server3'],
 ['server+server3','server&server3'],
 ['local-server','server&localserver&localserverport=4567'],
 ['local-server2','server2&localserver&localserverport=4567'],
 ['local-all','server&server2&server3&localserver&localserverport=4567'],
 ['local-server3','server3&localserver&localserverport=4567'],
 ['local-server+server2','server&server2&localserver&localserverport=4567'],
 ['local-server+server3','server&server3&localserver&localserverport=4567'],
 ['local-server2+server3','server2&server3&localserver&localserverport=4567'],
 ['explicit-server2','server2=ws%3A%2F%2Fchat.fixture%2Frelay&localserver&localserverport=4567'],
 ['explicit-server','server=ws%3A%2F%2Fapi.fixture%2Frelay&server2&localserver&localserverport=4567'],
 ['two-endpoints','server=ws%3A%2F%2Fapi.fixture%2Frelay&server2=ws%3A%2F%2Fchat.fixture%2Frelay']
];
const entries=[];
for(const name of fs.readdirSync(path.join(root,'games'))){
 if(name.endsWith('.html') && /getChatRelayConfig|audience-page\.js|ambient-page\.js|src="quickcall\.js"/.test(fs.readFileSync(path.join(root,'games',name),'utf8')))entries.push({file:'games/'+name,family:'game'});
}
entries.push({file:'monetization.html',family:'game'});
entries.push({file:'games/chickenroyale.html',family:'chicken'});
entries.push({file:'games.html',family:'chicken'}); // Spam Power lives outside games/.
entries.push({file:'dock.html',family:'dock-core'},{file:'featured.html',family:'featured-core'},{file:'sampleoverlay.html',family:'sample-core'});
for(const name of fs.readdirSync(path.join(root,'themes/featured-styles'))){if(name.endsWith('.html'))entries.push({file:'themes/featured-styles/'+name,family:'featured'});}
entries.push({file:'themes/LuckyLootTube/luckyloottube.html',family:'legacy-chat'});
for(const [file,target,data] of [
 ['poll.html','poll',{settings:{pollQuestion:{textsetting:'Flag matrix'},pollEnabled:{setting:true}}}],
 ['map.html','map',{settings:{mapTitle:{textsetting:'Flag matrix'}}}],
 ['timer.html','timer',{timer:{label:'Flag matrix',currentMs:1000,durationMs:1000,running:false}}],
 ['ticker.html','ticker',{ticker:['Flag matrix']}],['spotify-overlay.html','spotify',{spotify:{track:null,isPlaying:false}}],
 ['tipjar.html','tipjar',{cmd:'resettipjar'}],['credits.html','credits',{creditsCommand:'reset'}],
 ['hype.html','hype',{hype:{youtube:2}}],['multi-alerts.html','alerts',{action:'clearAlerts'}],
 ['minecraft.html','alerts',{action:'clearAlerts'}],['bot.html','bot',{action:'clearBotOverlay'}],
 ['waitlist.html','waitlist',{drawmode:false,waitlist:[]}],['confetti.html','waitlist',{drawmode:false,waitlist:[]}],
 ['wordcloud.html','wordcloud',{state:false}],['gif.html','gif',{contentimg:''}],
 ['reactions.html','reactions',{event:'reaction',chatmessage:'❤',id:'reaction-fixture'}]
])entries.push({file,family:'control',target,data});
function expected(entry,p){
 const custom=key=>p.get(key)||(p.has('localserver')?'ws://127.0.0.1:4567':null);
 if(entry.family==='dock-core'){
  if(p.has('server'))return {input:1,output:2,url:custom('server')||'wss://io.socialstream.ninja/api'};
  const key=p.has('server2')?'server2':p.has('server3')?'server3':null;
  return key?{input:4,output:3,url:custom(key)||'wss://io.socialstream.ninja/extension'}:null;
 }
 if(entry.family==='featured-core'){
  const key=p.has('server')?'server':p.has('server2')?'server2':p.has('server3')?'server3':null;
  return key?{input:key==='server'?2:key==='server2'?4:1,output:3,url:custom(key)||'wss://io.socialstream.ninja'}:null;
 }
 if(entry.family==='sample-core')return p.has('server')||p.has('server2')?{input:4,output:3,url:p.get('server')||p.get('server2')||(p.has('localserver')?'ws://127.0.0.1:4567':'wss://io.socialstream.ninja')}:null;
 if(entry.family==='chicken'){
  if(p.has('server'))return {input:1,output:2,url:custom('server')||'wss://io.socialstream.ninja'};
  const key=p.has('server2')?'server2':p.has('server3')?'server3':null;
  return key?{input:4,output:3,url:custom(key)||'wss://io.socialstream.ninja/extension'}:null;
 }
 if(entry.family==='game'){
  const ext=p.has('server2')&&!p.get('server');
  if(!p.has('server')&&!ext)return null;
  const legacyPhrase=entry.file==='games/phraseguess.html'&&!ext&&!(p.has('localserver')&&p.has('server2'));
  return {input:ext?4:legacyPhrase?2:1,output:ext?3:legacyPhrase?1:2,url:custom(ext?'server2':'server')||(ext?'wss://io.socialstream.ninja/extension':'wss://io.socialstream.ninja')};
 }
 if(entry.family==='control'){
  const key=p.get('server')?'server':p.has('server2')?'server2':p.has('server')?'server':p.has('server3')?'server3':null;
  return key?{input:7,output:key==='server'?1:3,url:custom(key)||(key==='server'?'wss://io.socialstream.ninja/api':'wss://io.socialstream.ninja/extension')}:null;
 }
 const key=p.has('server')?'server':p.has('server2')?'server2':p.has('server3')?'server3':null;
 if(!key || entry.family==='legacy-chat'&&key==='server3')return null;
 return {input:entry.family==='featured'?(key==='server'?2:key==='server2'?4:1):(key==='server'?1:4),output:3,url:custom(key)||(key==='server'?'wss://io.socialstream.ninja/api':'wss://io.socialstream.ninja/extension')};
}
const report={output,cases:[],failures:[]};
async function runCase(context,base,entry,mode,index){
 const page=await context.newPage(),sockets=[],errors=[];
 if(entry.family==='dock-core')await page.addInitScript(()=>{Object.defineProperty(window,'eval',{value:window.eval,writable:false,configurable:false});});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.routeWebSocket('**',socket=>{
  const record={socket,url:socket.url(),sent:[]};sockets.push(record);
  socket.onMessage(raw=>{try{const data=JSON.parse(String(raw));record.sent.push(data);if(data.join)record.join=data;}catch(_){}});
 });
 const label=entry.file+' ['+mode[0]+']',params=new URLSearchParams(mode[1]),want=expected(entry,params);
 try{
  await page.goto(base+'/'+entry.file+'?session=flagsfixture&password=false&'+mode[1],{waitUntil:'domcontentloaded',timeout:15000});
  if(want){
   await waitForCondition(()=>sockets.some(s=>s.join&&Number(s.join.in)===want.input),3500,'missing input '+want.input);
   const socket=sockets.find(s=>s.join&&Number(s.join.in)===want.input);
   assert.equal(new URL(socket.url).href,new URL(want.url).href,'endpoint');assert.equal(Number(socket.join.out),want.output,'output channel');assert.equal(socket.join.join,'flagsfixture','session');
   if((entry.family==='chicken'||entry.family==='dock-core')&&params.has('server')&&(params.has('server2')||params.has('server3'))){
    await waitForCondition(()=>sockets.some(s=>s.join&&Number(s.join.in)===4),2000,'missing independent extension route');
    const extra=sockets.find(s=>s.join&&Number(s.join.in)===4),key=params.has('server2')?'server2':'server3';
    assert.equal(new URL(extra.url).href,new URL(params.get(key)||(params.has('localserver')?'ws://127.0.0.1:4567':'wss://io.socialstream.ninja/extension')).href);
   }
   if(entry.family==='control'){
    await page.evaluate(()=>{window.__flagAccept=[];const accept=SSNOverlayControl.accept;SSNOverlayControl.accept=function(data,target){const result=accept(data,target);window.__flagAccept.push({id:data&&data.ssnControl&&data.ssnControl.id,result});return result;};});
    const id='flags-'+index,packet={...entry.data,ssnControl:{id,target:entry.target,reply:want.output}};
    socket.socket.send(JSON.stringify({...packet,ssnControl:{...packet.ssnControl,target:'unrelated'}}));
    socket.socket.send(JSON.stringify(packet));socket.socket.send(JSON.stringify(packet));
    await waitForCondition(()=>socket.sent.filter(p=>p.ssnControlAck&&p.ssnControlAck.id===id).length===2,2000,'missing receipt acknowledgements');
    assert.equal(await page.evaluate(id=>window.__flagAccept.filter(x=>x.id===id&&x.result).length,id),1,'mirrored control executed twice');
   }else if(entry.family==='dock-core'&&!params.has('server')&&!params.has('server2')){
    socket.socket.send(JSON.stringify({chatname:'Fixture',chatmessage:'COMMAND_ONLY_CHAT',type:'youtube',textonly:true}));
    await page.waitForTimeout(100);
    assert.equal(await markerCount(page,'COMMAND_ONLY_CHAT'),0,'server3-only Dock consumed captured chat');
   }else if(entry.family==='featured'||entry.family==='legacy-chat'||entry.family.endsWith('-core')){
    const marker='FLAG_MESSAGE_'+index;
    if(!entry.family.endsWith('-core'))socket.socket.send(JSON.stringify({target:'unrelated',chatname:'Fixture',chatmessage:'EXCLUDED_MESSAGE',textonly:true}));
    socket.socket.send(JSON.stringify({chatname:'Fixture',chatmessage:marker,textonly:true,type:'youtube',id:index+1}));
    await waitForCondition(async()=>await markerCount(page,marker)>0,4000,'selection/chat not rendered');
    assert.equal(await markerCount(page,'EXCLUDED_MESSAGE'),0,'wrong label rendered');
    if(entry.family==='featured'||entry.family==='featured-core'){
     if(entry.family==='featured-core')await page.waitForFunction(()=>!document.getElementById('output').classList.contains(transitionType),null,{timeout:4000});
     socket.socket.send(JSON.stringify({contents:false}));
     if(entry.family==='featured-core')await page.waitForFunction(()=>document.getElementById('output').classList.contains(transitionType),null,{timeout:4000});
     else await waitForCondition(async()=>await markerCount(page,marker)===0,4000,'clear did not remove selection');
    }
   }else if(entry.file==='games/phraseguess.html'&&process.env.SSN_FLAG_GAMEPLAY==='1'){
    await page.locator('#phrasesInput').fill('transport fixture phrase');
    await page.locator('#gameToggle').click();
    await page.waitForFunction(()=>gameState.currentPhrase==='transport fixture phrase',null,{timeout:5000});
    socket.socket.send(JSON.stringify({id:index+1,chatname:'Flag winner',chatmessage:'transport fixture phrase',type:'youtube',textonly:true}));
    await page.waitForFunction(()=>gameState.winner==='Flag winner',null,{timeout:5000});
   }else socket.socket.send(JSON.stringify({id:index+1,chatname:'Fixture',chatmessage:'!join',type:'youtube',textonly:true}));
  }else{
   await page.waitForTimeout(100);
   const relevant=entry.family==='control'?sockets.filter(s=>s.join&&Number(s.join.in)===7):sockets;
   assert.equal(relevant.length,0,'disabled route subscribed');
  }
  assert.equal(errors.length,0,'uncaught page error: '+errors.join('; '));
  report.cases.push({label,passed:true,coverage:entry.file==='games/phraseguess.html'&&process.env.SSN_FLAG_GAMEPLAY==='1'?'routing and winning a round':entry.family==='game'||entry.family==='chicken'?'routing and initialization':entry.family==='control'?'routing, receiver receipt and duplicate rejection':'routing and rendering'});
 }catch(error){report.failures.push({label,error:error.stack,sockets:sockets.map(s=>({url:s.url,join:s.join})),pageErrors:errors});console.error('FAIL '+label+': '+error.message.split('\n')[0]);}
 finally{await page.close();}
}
(async()=>{
 const server=await createStaticServer(),browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:720}});await configureNetworkMocks(context);
 const filter=new RegExp(process.env.SSN_FLAG_FILTER||'');
 const modeFilter=process.env.SSN_FLAG_MODE_FILTER?new RegExp(process.env.SSN_FLAG_MODE_FILTER):null;
 const tasks=entries.filter(e=>filter.test(e.file)).flatMap(entry=>modes.filter(mode=>!modeFilter||modeFilter.test(mode[0])).map(mode=>({entry,mode})));
 let next=0,done=0;
 console.log('Testing '+tasks.length+' cases across '+entries.filter(e=>filter.test(e.file)).length+' receivers');
 try{
  await Promise.all(Array.from({length:3},async()=>{for(;;){const index=next++;if(index>=tasks.length)return;const task=tasks[index];await runCase(context,server.baseUrl,task.entry,task.mode,index);done++;if(done%25===0)console.log(done+'/'+tasks.length+' completed; '+report.failures.length+' failures');}}));
 }finally{await context.close();await browser.close();await closeServer(server.server);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({passed:report.cases.length,failed:report.failures.length,output}));
 for(const failure of report.failures)console.error(failure.label+': '+failure.error.split('\n')[0]);
 if(report.failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
