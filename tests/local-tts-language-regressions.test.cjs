const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http'),vm=require('vm');
const {chromium}=require('playwright-core');const root=path.resolve(__dirname,'..');
(async()=>{
 const piper=fs.readFileSync(path.join(root,'thirdparty/piper/piper-tts-proper.js'),'utf8');
 const ctx={window:{location:{href:'https://example.test/dock.html'}},console,setTimeout,clearTimeout,URL};vm.runInNewContext(piper,ctx);
 const engine=new ctx.window.ProperPiperTTS();engine.createPiperPhonemize=()=>{};engine.voiceConfig={espeak:{voice:'es'}};
 engine.phonemizerModule={callMain(){setTimeout(()=>{if(engine.phonemizerCallback)engine.phonemizerCallback(JSON.stringify({phoneme_ids:[1,2],phonemes:['o','l','a']}));},5);}};
 assert.deepEqual(Array.from(await engine.phonemize('hola')),[1,2]);assert.equal(await engine.phonemize('hola',true),'ola');assert.equal(engine.phonemizerBusy,false);console.log('PASS asynchronous Piper results survive until callback');
 engine.voiceConfig={phoneme_id_map:{'^':[1],'_':[0],'$':[2],'a':[4],'b':[7]}};
 assert.deepEqual(Array.from(engine.encodePhonemes({phonemes:['a','b'],phoneme_ids:[1,0,141,0,2]})),[1,0,4,0,7,0,2]);
 console.log('PASS Piper uses the selected model vocabulary, including low-quality voices');
 engine.voiceConfig={espeak:{voice:'pt'}};assert.equal(engine.respell('Hi, hello HEY bye hihi constructor'),'rai, relou rei bai hihi constructor');
 engine.voiceConfig={espeak:{voice:'es'}};assert.equal(engine.respell('hi'),'hi');
 let phonemized='';engine.phonemizerModule={callMain(args){phonemized=JSON.parse(args[3])[0].text;setTimeout(()=>engine.phonemizerCallback(JSON.stringify({phoneme_ids:[1,2],phonemes:['a']})),5);}};
 engine.voiceConfig={espeak:{voice:'pt-br'}};engine.initialized=true;engine.session={run:async()=>({output:{data:new Float32Array(2)}})};ctx.ort={Tensor:function(){}};ctx.performance={now:()=>0};
 await engine.synthesize('hi',1,true);assert.equal(phonemized,'rai');
 console.log('PASS Piper respells English greetings for Portuguese voices only');

 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Security-Policy',"script-src 'self' 'wasm-unsafe-eval'; object-src 'none'");res.end('<html><body></body></html>');return;}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',/\.m?js$/.test(f)?'text/javascript':f.endsWith('.wasm')?'application/wasm':'application/octet-stream');let body=fs.readFileSync(f);if(/kokoro-bundle.es(?:.ext)?.js$/.test(f))body=Buffer.from(body.toString()+'\nexport { Zu as testPhonemes };');res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 for(const bundle of ['kokoro-bundle.es.js','kokoro-bundle.es.ext.js']){
 const result=await page.evaluate(async bundle=>{const m=await import('/thirdparty/'+bundle);return{english:await m.testPhonemes('Hello! The price is $5.25.','a'),spanish:await m.testPhonemes('Hola, gracias por participar.','e'),portuguese:await m.testPhonemes('Olá, obrigado por participar.','p')};},bundle);
 assert.equal(result.english,'həlˈoʊ! ðə pɹˈaɪs ɪz fˈaɪv dˈɑːlɚz ænd twˈɛnti fˈaɪv sˈɛnts.');assert.equal(result.spanish, '\u02c8ola, \u0261\u027e\u02c8a\u03b8jas po\u027e p\u02cca\u027eti\u03b8ip\u02c8a\u027e.');assert.ok(result.portuguese.length>15 && result.portuguese.length<90);assert.ok(!result.portuguese.includes('?'));assert.notEqual(result.spanish,result.portuguese);console.log('PASS',bundle,'English baseline and multilingual pronunciation under extension-style CSP');
 }
 await page.addScriptTag({url:'/tts.js'});
 const switchToPiper=await page.evaluate(async()=>{const k=new ProperPiperTTS();k.init=async()=>{if(!window.ort)throw Error('Missing ONNX runtime after Kokoro phonemizer');return true;};const Original=window.ProperPiperTTS;window.ProperPiperTTS=function(){return k;};try{return await TTS.initPiper('en_US-hfc_female-medium');}finally{window.ProperPiperTTS=Original;}});
 assert.equal(switchToPiper,true);console.log('PASS Piper loads its runtime after Kokoro has loaded only the phonemizer');
 await page.close();
 const electronPage=await browser.newPage();await electronPage.goto('http://127.0.0.1:'+server.address().port);
 await electronPage.evaluate(()=>{window.process={versions:{node:'22.0.0'}};window.require=()=>{throw Error('Browser resources must not use Node filesystem');};});
 await electronPage.addScriptTag({url:'/thirdparty/piper/piper-tts-proper.js'});
 assert.ok((await electronPage.evaluate(async()=>{const e=new ProperPiperTTS();await e.loadPhonemizer();e.voiceConfig={espeak:{voice:'pt-br'}};return await e.phonemize('Ola, obrigado',true);})).length>4);
 await electronPage.close();console.log('PASS Piper browser assets load when Electron exposes Node globals');
 const ui=await browser.newPage();await ui.setContent('<select id="kokoroVoiceSelect"><option selected value="af_bella">Bella</option><option value="ef_dora">Dora</option><option value="pf_dora">Dora</option></select>');const popup=fs.readFileSync(path.join(root,'popup.js'),'utf8');await ui.addScriptTag({content:popup.slice(popup.indexOf('function getLocalTtsSample('))});const result=await ui.evaluate(()=>{const voices=document.getElementById('kokoroVoiceSelect'),filter=document.getElementById('kokoroVoiceSelectLanguage');filter.value='es';filter.dispatchEvent(new Event('change'));return{selected:voices.value,hidden:Array.from(voices.options,o=>o.hidden),es:getLocalTtsSample('kokoro','ef_dora'),pt:getLocalTtsSample('piper','', 'pt_BR-faber-medium')};});assert.equal(result.selected,'af_bella');assert.deepEqual(result.hidden,[false,false,true]);assert.match(result.es,/Hola/);assert.match(result.pt,/Olá/);console.log('PASS filters preserve saved voices and previews match the selected language');
 let loader=popup.slice(popup.indexOf('var TextSplitterStream = null;'),popup.indexOf('const PollManager ='));
 loader=loader.replace(/await import\('\.\/thirdparty\/kokoro-bundle.es(?:.ext)?\.js'\)/g,'await window.mockKokoroImport()');
 await ui.addScriptTag({content:'var ssapp=false;'+loader});
 const retry=await ui.evaluate(async()=>{let calls=0;window.mockKokoroImport=async()=>({TextSplitterStream:function(){},detectWebGPU:async()=>false,KokoroTTS:{from_pretrained:async()=>{calls++;if(calls===1)throw Error('simulated failed model download');return{ready:true};}}});return{first:await initKokoro(),second:await initKokoro(),ready:!!kokoroTtsInstance,calls};});
 assert.deepEqual(retry,{first:false,second:true,ready:true,calls:2});console.log('PASS Kokoro retries a failed initialization without clearing existing caches');
 const voicePage=await browser.newPage();await voicePage.goto('http://127.0.0.1:'+server.address().port);let downloads=0;
 await voicePage.route('**/voices/ef_dora.bin',route=>{downloads++;return route.fulfill({status:downloads===1?503:200,headers:{'access-control-allow-origin':'*'},body:downloads===1?'Unavailable':Buffer.alloc(522240)});});
 const voiceRetry=await voicePage.evaluate(async()=>{const m=await import('/thirdparty/kokoro-bundle.es.js');const instance=new m.KokoroTTS(async()=>({waveform:{data:new Float32Array([0.1,0.2])}}),()=>{});let failed=false;try{await instance.generate_from_ids({dims:[1,5]},{voice:'ef_dora'});}catch(e){failed=/503/.test(e.message);}await instance.generate_from_ids({dims:[1,5]},{voice:'ef_dora'});await instance.generate_from_ids({dims:[1,5]},{voice:'ef_dora'});return failed;});
 assert.equal(voiceRetry,true);assert.equal(downloads,2);await voicePage.close();console.log('PASS failed voice downloads are retried; successful voices are reused');
 const concurrentPage=await browser.newPage();await concurrentPage.goto('http://127.0.0.1:'+server.address().port);
 await concurrentPage.route('**/voices/ef_dora.bin',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:Buffer.alloc(522240)}));
 for(const bundle of ['kokoro-bundle.es.js','kokoro-bundle.es.ext.js']){
  const result=await concurrentPage.evaluate(async bundle=>{
   const m=await import('/thirdparty/'+bundle);let active=0,maximum=0,calls=0;
   const instance=new m.KokoroTTS(async()=>{
    active++;maximum=Math.max(maximum,active);const call=++calls;
    try{await new Promise(resolve=>setTimeout(resolve,20));if(call===1)throw Error('inference failure');return{waveform:{data:new Float32Array([.1,.2])}};}
    finally{active--;}
   },()=>{});
   const run=()=>instance.generate_from_ids({dims:[1,5]},{voice:'ef_dora'});
   const outcomes=await Promise.allSettled([run(),run()]);await run();
   return{maximum,calls,outcomes:outcomes.map(x=>x.status)};
  },bundle);
  assert.deepEqual(result,{maximum:1,calls:3,outcomes:['rejected','fulfilled']});
  console.log('PASS',bundle,'serializes replacement inference and recovers after errors');
 }
 await concurrentPage.close();
 const managerSource=popup.slice(popup.indexOf('const TTSManager ='),popup.indexOf('\n};',popup.indexOf('const TTSManager ='))+3);
 await ui.addScriptTag({content:managerSource+'\nwindow.testTtsManager=TTSManager;'});
 const cancelled=await ui.evaluate(async()=>{const m=testTtsManager;let release,syntheses=0;window.ort={};window.ProperPiperTTS=class{constructor(voice){this.voiceId=voice;}init(){return new Promise(r=>release=r);}synthesize(){syntheses++;}};m.setTestRunning=()=>{};m.showFeedback=()=>{};const pending=m.piperTTS('test',{volume:1},'');m.cancelTest('');release();await pending;return{syntheses,busy:m.piperPreviewBusy,active:m.premiumQueueActive};});
 assert.deepEqual(cancelled,{syntheses:0,busy:false,active:false});console.log('PASS cancelled Piper loading cannot start stale speech');
 const phrasePage=await browser.newPage();await phrasePage.goto('http://127.0.0.1:'+server.address().port);await phrasePage.addScriptTag({url:'/tts.js'});
 const phraseIds=await phrasePage.evaluate(()=>[['Hiii!','pt_PT-tug\u00e3o-medium'],['hello, everyone \ud83d\udc4b','es_ES-davefx-medium'],['goodnight','pt-pt'],['hi','en_US-amy-medium'],['hi','en'],['hi there friend','pt-pt'],['olá','pt-pt'],['constructor','pt-pt']].map(([text,voice])=>TTS.getPhraseClipId(text,voice)));
 assert.deepEqual(phraseIds,['hi','hello-everyone','good-night','','','','','']);
 const clipFiles=(await phrasePage.evaluate(()=>Object.keys(TTS.phraseClips))).map(id=>'audio/tts-phrases/'+id+'.ogg');assert.deepEqual(clipFiles.filter(file=>!fs.existsSync(path.join(root,file))),[]);
 const clip=await phrasePage.evaluate(async()=>{const samples=await TTS.loadPhraseClip('hi',22050);return{seconds:samples.length/22050,level:TTS.speechLevel(samples)};});
 assert.ok(clip.seconds>0.5&&clip.seconds<1.5&&clip.level>0.05,JSON.stringify(clip));console.log('PASS short English messages use packaged phrase clips for non-English voices only');
 const piperJoin=await phrasePage.evaluate(async()=>{
  const calls=[],loads=[],blobs=[];TTS.piperSettings.voice='pt_PT-tug\u00e3o-medium';TTS.piperSettings.speed=1.5;TTS.piperLoaded=true;TTS.piperActiveVoice=TTS.piperSettings.voice;
  TTS.piperInstance={voiceConfig:{audio:{sample_rate:16000}},async synthesize(text,speed,samples){calls.push([text,samples]);return samples?new Float32Array(512).fill(0.2):new Blob([text]);},async synthesizeWithPause(intro,message){calls.push([intro,message]);return new Blob([message]);}};
  TTS.loadPhraseClip=async(id,rate)=>{loads.push([id,rate]);return new Float32Array(512).fill(0.1);};TTS.playAudioBlobAndWait=async blob=>{blobs.push(blob);return true;};
  await TTS.piperTTS('afonso. Hi!!',{speechIntro:'afonso'});await TTS.piperTTS('afonso. hi, como estás?',{speechIntro:'afonso'});
  TTS.loadPhraseClip=async()=>{throw Error('offline');};await TTS.piperTTS('hello everyone');
  const wav=new DataView(await blobs[0].arrayBuffer());return{calls,loads,size:wav.byteLength,clipSample:wav.getInt16(44+(512+4800)*2,true),fallback:await blobs[2].text()};
 });
 // Sender, 0.3 s pause, then the clip raised to the sender's level; longer messages and missing clips use the voice.
 assert.deepEqual(piperJoin,{calls:[['afonso',true],['afonso','hi, como estás?'],['hello everyone',undefined]],loads:[['hi',16000]],size:44+(512+4800+512)*2,clipSample:Math.round(0.2*32767),fallback:'hello everyone'});
 const espeakJoin=await phrasePage.evaluate(async()=>{
  const spoken=[];let blob;TTS.espeakSettings.voice='pt-pt';TTS.espeakSettings.speed=140;TTS.espeakLoaded=true;
  TTS.espeakInstance={async speak(text){spoken.push(text);return TTS.samplesToWav(new Float32Array(2205).fill(0.2),22050).arrayBuffer();}};
  TTS.loadPhraseClip=async(id,rate)=>{spoken.push([id,rate]);return new Float32Array(2205).fill(0.1);};
  const createObjectURL=URL.createObjectURL;URL.createObjectURL=value=>{blob=value;return createObjectURL.call(URL,value);};HTMLMediaElement.prototype.play=()=>Promise.resolve();
  await TTS.espeakTTS('afonso. good night',{speechIntro:'afonso'});return{spoken,size:blob&&blob.size};
 });
 assert.deepEqual(espeakJoin,{spoken:[['good-night',22050],'afonso'],size:44+(2205+6615+2205)*2});
 await phrasePage.close();console.log('PASS Piper and eSpeak join the sender with the phrase clip and fall back to the voice');



 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
