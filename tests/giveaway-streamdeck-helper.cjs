'use strict';
// Called only by the isolated extension test with an explicit packaged plugin path.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {wsServer:WebSocketServer}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
module.exports=async function(background,bundle){
 const cleanup=[],events=[],replies=[];
 const wait=async(predicate,label)=>{for(let i=0;i<150;i++){const result=predicate();if(result)return result;await new Promise(r=>setTimeout(r,100));}throw new Error('Plugin timed out: '+label);};
 try{
  const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-giveaway-plugin-'));
  const plugin=path.join(isolated,'ninja.socialstream.streamdeck.sdPlugin');
  fs.cpSync(bundle,plugin,{recursive:true,filter:source=>!source.split(path.sep).includes('logs')});
  const relay=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>relay.once('listening',r));
  cleanup.push(()=>{for(const c of relay.clients)c.terminate();relay.close();});
  relay.on('connection',socket=>socket.on('message',async raw=>{
   const message=JSON.parse(raw);if(!message.action)return;
   try{const result=await background.evaluate(async message=>{const routed=await routeStreamDeckRemoteRequest(message,{transport:'websocket'});return routed&&routed.result;},message);replies.push({message,result});if(message.get)socket.send(JSON.stringify({callback:{get:message.get,result}}));}
   catch(error){replies.push({message,error:error.message});}
  }));
  const deck=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>deck.once('listening',r));
  cleanup.push(()=>{for(const c of deck.clients)c.terminate();deck.close();});
  let socket;
  const globals={sessionId:'giveaway-plugin-fixture',transport:'websocket',apiHost:'127.0.0.1:'+relay.address().port,useTls:false,httpFallback:false,inChannel:2,outChannel:1,requestTimeoutMs:5000};
  deck.on('connection',client=>{socket=client;client.on('message',raw=>{const message=JSON.parse(raw);events.push(message);if(message.event==='getGlobalSettings')client.send(JSON.stringify({event:'didReceiveGlobalSettings',context:message.context,payload:{settings:globals}}));});});
  const info={application:{font:'Segoe UI',language:'en',platform:'windows',platformVersion:'10.0.0',version:'7.5.0'},colors:{},devicePixelRatio:2,devices:[{id:'qa-device',name:'Isolated QA Deck',size:{columns:5,rows:3},type:0}],plugin:{uuid:'ninja.socialstream.streamdeck',version:'0.2.4.0'}};
  const child=spawn(process.execPath,[path.join(plugin,'bin/plugin.js'),'-port',String(deck.address().port),'-pluginUUID','qa-plugin','-registerEvent','registerPlugin','-info',JSON.stringify(info)],{cwd:plugin,stdio:['ignore','pipe','pipe'],windowsHide:true});
  cleanup.push(()=>child.kill());
  await wait(()=>events.find(e=>e.event==='registerPlugin'),'registration');
  await wait(()=>replies.find(e=>e.message.action==='getCapabilities'),'real extension capabilities');
  socket.send(JSON.stringify({event:'willAppear',action:'ninja.socialstream.streamdeck.connection',context:'qa-connection',device:'qa-device',payload:{controller:'Keypad',coordinates:{column:0,row:0},isInMultiAction:false,resources:{},settings:{},state:0}}));
  await wait(()=>events.find(e=>e.context==='qa-connection'&&e.event==='setState'&&e.payload.state===1),'connected state');
  let index=0;
  async function press(command,value){
   const context='qa-key-'+(++index),settings={command,value:JSON.stringify(value),awaitResponse:true};
   const payload={controller:'Keypad',coordinates:{column:0,row:0},isInMultiAction:false,resources:{},settings,state:0};
   const event={action:'ninja.socialstream.streamdeck.command',context,device:'qa-device',payload};
   socket.send(JSON.stringify({...event,event:'willAppear'}));
   await wait(()=>events.find(e=>e.context===context&&e.event==='setTitle'),'key render');
   socket.send(JSON.stringify({...event,event:'keyDown'}));
   const feedback=await wait(()=>events.find(e=>e.context===context&&['showOk','showAlert'].includes(e.event)),command+' feedback');
   assert.equal(feedback.event,'showOk',command+' acknowledged by actual extension');
   return context;
  }
  const value={giveawayId:'deck',config:{keyword:'!deck',prizePoints:4}};
  await press('startgiveaway',value);
  await background.evaluate(()=>processIncomingMessage({chatname:'Deck Player',type:'youtube',chatmessage:'!deck',textonly:true,meta:{messageId:'deck-entry'}}));
  const query=await press('getgiveawaystate',{giveawayId:'deck'});
  await wait(()=>events.find(e=>e.context===query&&e.event==='setTitle'&&e.payload.title.includes('OPEN\n1')),'live count on query key');
  await press('closegiveaway',{giveawayId:'deck'});
  await press('drawgiveaway',{giveawayId:'deck',operationId:'deck-draw'});
  await press('drawgiveaway',{giveawayId:'deck',operationId:'deck-draw'});
  assert.equal(await background.evaluate(async()=>(await window.pointsSystem.getUserPoints('Deck Player','youtube')).points),5,'One prize plus normal engagement; retried key did not pay twice');
  await press('resetgiveaway',{giveawayId:'deck'});
  await press('startgiveaway',{giveawayId:'deck',config:{keyword:'!deck',ticketCost:1}});
  await background.evaluate(()=>processIncomingMessage({chatname:'Deck Player',type:'youtube',chatmessage:'!ticket deck 2',textonly:true,meta:{messageId:'deck-purchase'}}));
  await press('cancelgiveaway',{giveawayId:'deck'});
  assert.equal(await background.evaluate(async()=>(await window.pointsSystem.getUserPoints('Deck Player','youtube')).pointsReserved),0);
  assert.equal(await background.evaluate(async()=>(await window.pointsSystem.getUserPoints('Deck Player','youtube')).pointsSpent),0);
  console.log('Packaged Stream Deck plugin -> real extension: all six presets, count feedback, prize retry and paid refund passed.');
 }finally{for(const fn of cleanup.reverse())await fn();}
};
