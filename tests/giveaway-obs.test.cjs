'use strict';
// Optional: requires an already-running OBS with its loopback WebSocket enabled.
// Never starts OBS, SSApp, a stream, or a recording; only owns a uniquely named scene.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {chromium}=require('playwright');
const {ws:WebSocket,wsServer:WebSocketServer}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 if(process.env.SSN_OBS_GIVEAWAY_TEST!=='1')throw new Error('Explicit OBS test opt-in required: SSN_OBS_GIVEAWAY_TEST=1');
 const root=path.resolve(__dirname,'..'),cleanup=[];
 try {
  const obs=new WebSocket('ws://127.0.0.1:4455'),pending=new Map();let sequence=0;
  cleanup.push(()=>obs.close());
  await new Promise((resolve,reject)=>{
   obs.on('error',reject);
   obs.on('message',raw=>{const packet=JSON.parse(raw);
    if(packet.op===0){if(packet.d.authentication)return reject(new Error('This optional harness needs an existing unauthenticated loopback OBS endpoint; it does not change OBS settings.'));obs.send(JSON.stringify({op:1,d:{rpcVersion:1,eventSubscriptions:0}}));}
    if(packet.op===2)resolve();
    if(packet.op===7){const callback=pending.get(packet.d.requestId);if(callback){pending.delete(packet.d.requestId);callback(packet.d);}}
   });
  });
  const call=(requestType,requestData={})=>new Promise((resolve,reject)=>{
   const requestId=String(++sequence),timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(requestType+' timed out'));},10000);
   pending.set(requestId,reply=>{clearTimeout(timer);reply.requestStatus.result?resolve(reply.responseData||{}):reject(new Error(requestType+': '+reply.requestStatus.comment));});
   obs.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}));
  });
  assert.equal((await call('GetStreamStatus')).outputActive,false,'Refusing to modify a scene while streaming');
  assert.equal((await call('GetRecordStatus')).outputActive,false,'Refusing to modify a scene while recording');
  const sceneName='SSN Giveaway QA '+Date.now();
  await call('CreateScene',{sceneName});cleanup.push(()=>call('RemoveScene',{sceneName}));
  const server=http.createServer((req,res)=>{
   const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));cleanup.push(()=>new Promise(resolve=>server.close(resolve)));
  const relay=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(resolve=>relay.once('listening',resolve));
  cleanup.push(()=>{for(const client of relay.clients)client.terminate();return new Promise(resolve=>relay.close(resolve));});
  let latest=null,requests=0;
  relay.on('connection',socket=>socket.on('message',raw=>{const message=JSON.parse(raw);if(message.action==='getgiveawaystate'){requests++;if(latest)socket.send(JSON.stringify(latest));}}));
  const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'ssn-obs-extension-')),{channel:'chromium',headless:true,args:['--load-extension='+root,'--disable-extensions-except='+root]});
  cleanup.push(()=>context.close());await context.route(/^https?:/,r=>r.abort());
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).host;
  let background;for(let n=0;n<100;n++){background=context.pages().find(p=>p.url().includes('/background.html'));if(background)break;await sleep(100);}
  assert(background);await background.waitForFunction(()=>typeof getGiveawayHost==='function');
  await background.exposeFunction('qaBroadcast',payload=>{latest=payload;for(const socket of relay.clients)if(socket.readyState===1)socket.send(JSON.stringify(payload));});
  await background.evaluate(()=>{sendTargetP2P=async(payload,target)=>{if(target==='giveaway')await window.qaBroadcast(payload);return true;};});
  const popup=await context.newPage();await popup.goto('chrome-extension://'+extensionId+'/popup.html');
  await popup.waitForFunction(()=>window.popupStartupSettingsHydrated&&document.body.classList.contains('loaded'));
  if(await popup.locator('#beginnerWelcomeAdvanced').isVisible())await popup.locator('#beginnerWelcomeAdvanced').click();
  await popup.locator('label[for="wrapper-giveaway-options"]').click();
  const imagePage=await context.newPage();
  const base='http://127.0.0.1:'+server.address().port+'/giveaway.html?session=obs-qa&managed&server='+encodeURIComponent('ws://127.0.0.1:'+relay.address().port);
  const inputName=sceneName+' browser';
  await call('CreateInput',{sceneName,inputName,inputKind:'browser_source',inputSettings:{url:base,width:1280,height:720,shutdown:false,css:''}});
  cleanup.push(()=>call('RemoveInput',{inputName}));
  const originalScene=(await call('GetCurrentProgramScene')).sceneName;
  await call('SetCurrentProgramScene',{sceneName});
  cleanup.push(()=>call('SetCurrentProgramScene',{sceneName:originalScene}));
  for(const presentation of ['card','reel','wheel']){
   if(presentation!=='card')await popup.locator('[data-giveaway-action="resetgiveaway"]').click();
   await popup.locator('[data-giveaway-action="startgiveaway"]').click();
   await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Entries open'));
   const before=requests;
   await call('SetInputSettings',{inputName,inputSettings:{url:base+'&presentation='+presentation},overlay:true});
   for(let n=0;n<100&&requests===before;n++)await sleep(100);
   assert.ok(requests>before,'OBS browser source requested host state');
   await background.evaluate(()=>processIncomingMessage({chatname:'OBS Test Winner',type:'youtube',chatmessage:'!enter',textonly:true,meta:{messageId:'obs-'+Date.now()}}));
   await popup.locator('[data-giveaway-action="drawgiveaway"]').click();
   await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('OBS Test Winner'));
   await sleep(3600);
   const shot=(await call('GetSourceScreenshot',{sourceName:inputName,imageFormat:'png'})).imageData;
   fs.writeFileSync(path.join(os.tmpdir(),'ssn-obs-giveaway-'+presentation+'.png'),Buffer.from(shot.split(',')[1],'base64'));
   const pixels=await imagePage.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height).data;let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;return {cornerAlpha:pixels[3],visible};},shot);
   assert.equal(pixels.cornerAlpha,0,presentation+' has native transparent corners with no OBS custom CSS');assert.ok(pixels.visible>100,presentation+' rendered content');
   console.log('OBS '+presentation+': popup draw rendered; native alpha verified.');
  }
  // Recreate the connection without changing the host's committed result.
  const before=requests;await call('PressInputPropertiesButton',{inputName,propertyName:'refreshnocache'});
  for(let n=0;n<100&&requests===before;n++)await sleep(100);
  assert.ok(requests>before,'Reconnected OBS browser queried saved state');
  let shot,visible=0;
  for(let n=0;n<20;n++){
   await sleep(500);
   shot=(await call('GetSourceScreenshot',{sourceName:inputName,imageFormat:'png'})).imageData;
   visible=await imagePage.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data.some((v,i)=>i%4===3&&v>0);},shot);
   if(visible)break;
  }
  assert.ok(visible,'Reconnected OBS source actually rendered saved state');
  fs.writeFileSync(path.join(os.tmpdir(),'ssn-obs-giveaway-reconnected.png'),Buffer.from(shot.split(',')[1],'base64'));
  console.log('OBS reconnect received saved result. Screenshots: '+os.tmpdir());
 }finally{for(const fn of cleanup.reverse())try{await fn();}catch(error){console.error('Cleanup:',error.message);}}
})().catch(error=>{console.error(error);process.exitCode=1;});
