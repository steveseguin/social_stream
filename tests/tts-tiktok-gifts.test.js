const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
(async function() {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const page = await browser.newPage();
  const source = fs.readFileSync(path.join(__dirname, '../tts.js'), 'utf8');
  const start = source.indexOf('TTS.speechMeta = function');
  const speechSource = source.slice(start, source.indexOf('\n};', start) + 3);
  const result = await page.evaluate(speechSource => {
   function run(samples, flags) {
    var now=0, sequence=0, timers=new Map(), spoken=[];
    var TTS=Object.assign({pendingTikTokGiftSpeech:new Map(),English:true,ttsSpeakChatname:true,doNotReadEvents:true,speak:text=>spoken.push(text)},flags);
    function timer(fn,delay){var id=++sequence;timers.set(id,{fn,at:now+delay});return id;}
    Function('TTS','document','setTimeout','clearTimeout','Date',speechSource)(TTS,document,timer,id=>timers.delete(id),{now:()=>now});
    function advance(to){while(true){var t=[...timers].filter(x=>x[1].at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!t)break;timers.delete(t[0]);now=t[1].at;t[1].fn();}now=to;}
    samples.forEach(x=>{advance(x.at);TTS.speechMeta(x.data,x.allow||false);});advance(now+130000);return spoken;
   }
   function gift(meta,extras){return Object.assign({type:'tiktok',event:'gift',chatname:'John',chatmessage:'sent Rose <img src="a"> × 1',hasDonation:'1 coin',meta:meta||{}},extras);}
   var native={tiktokGiftMessageId:'123',groupId:'111',giftId:'5655',tiktokGiftSenderId:'u1',giftName:'Rose',tiktokGiftCount:1,repeatEnd:true};
   var dom=gift(Object.assign({},native,{tiktokGiftStreakId:'tab-A'}));
   var ws=gift(Object.assign({},native,{tiktokGiftStreakId:'tab-B'}),{chatmessage:'Sent Rose x1',hasDonation:'1 💎',title:'Rose'});
   return {
    duplicate:run([{at:0,data:dom},{at:350,data:ws},{at:15000,data:dom}]),
    spanish:run([{at:0,data:gift(Object.assign({},native,{giftName:'Rosa',tiktokGiftCount:10}),{chatname:'Juan'})}],{speechLang:'es-MX',English:false}),
    spanishFirstVoice:run([{at:0,data:dom}],{speechLang:'en-US',voice:{lang:'es-ES'},English:true}),
    googleSpanish:run([{at:0,data:dom}],{speechLang:'en-US',TTSProvider:'google',googleSettings:{lang:'es-US'}}),
    french:run([{at:0,data:dom}],{speechLang:'fr-CA',English:false}),
    unknownLanguage:run([{at:0,data:dom}],{speechLang:'ja-JP',English:true}),
    simpleSpanish:run([{at:0,data:dom}],{speechLang:'es',English:false,simpleGiftSpeech:true}),
    noNameSpanish:run([{at:0,data:dom}],{speechLang:'es',English:false,ttsSpeakChatname:false}),
    groupAliases:run([{at:0,data:dom},{at:350,data:gift(Object.assign({},native,{tiktokGiftMessageId:'different-update'}))},{at:15000,data:gift(Object.assign({},native,{tiktokGiftMessageId:'late-final'}))}]),
    differentSenders:run([{at:0,data:dom},{at:100,data:gift(Object.assign({},native,{tiktokGiftSenderId:'u2',tiktokGiftMessageId:'sender2'}),{chatname:'Jane'})}]),
    unidentifiable:run([{at:0,data:gift({})},{at:500,data:gift({})}]),
    eventsExcluded:run([{at:0,data:gift({}, {hasDonation:''})}]),
    separate:run([{at:0,data:dom},{at:100,data:gift(Object.assign({},native,{tiktokGiftMessageId:'124',groupId:'112'}))}]),
    streak:run([{at:0,data:gift(Object.assign({},native,{repeatEnd:false,streakable:true}))},{at:10000,data:gift(Object.assign({},native,{tiktokGiftCount:10,repeatEnd:false,streakable:true}))},{at:25000,data:gift(Object.assign({},native,{tiktokGiftCount:10,repeatEnd:true,streakable:true}))}]),
    oldWs:run([{at:0,data:gift({count:10,giftId:'7934'},{chatmessage:'Sent Heart Me x10',title:'Heart Me',msgId:'old-ws'})}]),
    tikfinity:run([{at:0,data:gift({giftName:'Heart Me',repeatCount:1},{chatmessage:'Heart Me'})}]),
    normal:run([{at:0,data:{type:'tiktok',chatname:'John',chatmessage:'I sent Rose x1'}}]),
    youtube:run([{at:0,data:{type:'youtube',chatname:'John',hasDonation:'$5',chatmessage:'Hello'}}]),
    noNames:run([{at:0,data:dom}],{ttsSpeakChatname:false}),
    filters:run([{at:0,data:gift({}, {hasDonation:''})}],{readDonos:true}),
    manual:run([{at:0,data:dom},{at:6000,data:dom,allow:true}]),
    nonEnglish:run([{at:0,data:dom}],{English:false}),
    legacyDuplicate:run([{at:0,data:gift({tiktokGiftStreakId:'legacy',tiktokGiftCount:1})},{at:5000,data:gift({tiktokGiftStreakId:'legacy',tiktokGiftCount:1})}])
   };
  },speechSource);
  assert.deepStrictEqual(result.duplicate,['john sent 1 Rose']);
  assert.deepStrictEqual(result.spanish,['juan envi\u00f3 10 Rosa']);
  assert.deepStrictEqual(result.spanishFirstVoice,['john envi\u00f3 1 Rose']);
  assert.deepStrictEqual(result.googleSpanish,['john envi\u00f3 1 Rose']);
  assert.deepStrictEqual(result.french,['john a envoy\u00e9 1 Rose']);
  assert.deepStrictEqual(result.unknownLanguage,['john. 1 Rose']);
  assert.deepStrictEqual(result.simpleSpanish,['john. 1 Rose']);
  assert.deepStrictEqual(result.noNameSpanish,['Envi\u00f3 1 Rose']);
  assert.deepStrictEqual(result.groupAliases,['john sent 1 Rose']);
  assert.deepStrictEqual(result.differentSenders,['john sent 1 Rose','jane sent 1 Rose']);
  assert.deepStrictEqual(result.unidentifiable,['john sent 1 Rose','john sent 1 Rose']);
  assert.deepStrictEqual(result.eventsExcluded,[]);
  assert.deepStrictEqual(result.separate,['john sent 1 Rose','john sent 1 Rose']);
  assert.deepStrictEqual(result.streak,['john sent 10 Rose']);
  assert.deepStrictEqual(result.oldWs,['john sent 10 Heart Me']);
  assert.deepStrictEqual(result.tikfinity,['john sent 1 Heart Me']);
  assert.deepStrictEqual(result.normal,['john says: I sent Rose x1']);
  assert.deepStrictEqual(result.youtube,['john has donated $5 and says Hello']);
  assert.deepStrictEqual(result.noNames,['Sent 1 Rose']);
  assert.deepStrictEqual(result.filters,[]);
  assert.deepStrictEqual(result.manual,['john sent 1 Rose','john sent 1 Rose']);
  assert.deepStrictEqual(result.nonEnglish,['john. 1 Rose']);
  assert.deepStrictEqual(result.legacyDuplicate,['john sent 1 Rose']);
  await page.addScriptTag({path:path.join(__dirname,'../sources/inject/tiktok-gift.js')});
  const bridge=await page.evaluate(()=>{
   var row=document.createElement('div');row.dataset.index='199';row.innerHTML='<div></div>';document.body.appendChild(row);
   row.firstElementChild.__reactFiberFixture={memoizedProps:{},return:{memoizedProps:{message:{messageType:'GiftMessage',msgId:'7684837112987618055',payload:{group_id:'1789265571166',gift_id:'5655',repeat_count:'1',repeat_end:1,user:{id:'u1'},gift:{type:1,name:'Rose'}}}}}};
   row.dispatchEvent(new CustomEvent('ssn-read-tiktok-gift',{bubbles:true}));
   return JSON.parse(row.getAttribute('data-ssn-tiktok-gift'));
  });
  assert.strictEqual(bridge.tiktokGiftMessageId,'7684837112987618055');assert.strictEqual(bridge.giftName,'Rose');assert.strictEqual(bridge.repeatEnd,true);
  const cdp = await page.context().newCDPSession(page);
  const tree = await cdp.send('Page.getFrameTree');
  const isolated = await cdp.send('Page.createIsolatedWorld', {frameId:tree.frameTree.frame.id,worldName:'gift-content-test'});
  const bridged = await cdp.send('Runtime.evaluate', {contextId:isolated.executionContextId,returnByValue:true,
   expression: `(function(){var row=document.querySelector('[data-index]');row.removeAttribute('data-ssn-tiktok-gift');row.dispatchEvent(new CustomEvent('ssn-read-tiktok-gift',{bubbles:true}));return {reader:typeof window.__ssnReadTikTokGift,meta:JSON.parse(row.getAttribute('data-ssn-tiktok-gift'))};})()`});
  assert.strictEqual(bridged.result.value.reader,'undefined');
  assert.strictEqual(bridged.result.value.meta.tiktokGiftMessageId,'7684837112987618055');
  const captureSource = fs.readFileSync(path.join(__dirname, '../sources/tiktok.js'), 'utf8');
  const trackerSource = captureSource.slice(captureSource.indexOf('var trackedTikTokGiftStreaks ='), captureSource.indexOf('function sendMetaEvent'));
  const transitions = await page.evaluate(trackerSource => {
   var mark = Function('normalizeTikTokNameKey', trackerSource + ';return markTikTokGiftUpdate;')(value => value.toLowerCase());
   var row = document.querySelector('[data-index]');
   var native = row.firstElementChild.__reactFiberFixture.return.memoizedProps.message;
   function payload(){return {type:'tiktok',event:'gift',chatname:'John',hasDonation:'1 coin',chatmessage:'sent Rose <img src="https://p16-webcast.tiktokcdn.com/img/eba3a9bb85c33e017f3648eaf88d7189.png"> x1'};}
   native.payload.repeat_end = 0; var first=payload();var acceptedFirst=mark(first,row);
   native.payload.repeat_end = 1; var final=payload();var acceptedFinal=mark(final,row);
   var acceptedDuplicate=mark(payload(),row);
   native.msgId='separate-native';native.payload.group_id='separate-group';var separate=payload();var acceptedSeparate=mark(separate,row);
   return {acceptedFirst,acceptedFinal,acceptedDuplicate,acceptedSeparate,sameStreak:first.meta.tiktokGiftStreakId===final.meta.tiktokGiftStreakId};
  },trackerSource);
  assert.deepStrictEqual(transitions,{acceptedFirst:true,acceptedFinal:true,acceptedDuplicate:false,acceptedSeparate:true,sameStreak:true});
  console.log('TikTok TTS: 23 speech cases, isolated-world bridge and native completion transitions passed');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
