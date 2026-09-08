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

 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Security-Policy',"script-src 'self' 'wasm-unsafe-eval'; object-src 'none'");res.end('<html><body></body></html>');return;}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.wasm')?'application/wasm':'application/octet-stream');let body=fs.readFileSync(f);if(/kokoro-bundle.es(?:.ext)?.js$/.test(f))body=Buffer.from(body.toString()+'\nexport { Zu as testPhonemes };');res.end(body);});
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
 const managerSource=popup.slice(popup.indexOf('const TTSManager ='),popup.indexOf('\n};',popup.indexOf('const TTSManager ='))+3);
 await ui.addScriptTag({content:managerSource+'\nwindow.testTtsManager=TTSManager;'});
 const cancelled=await ui.evaluate(async()=>{const m=testTtsManager;let release,syntheses=0;window.ort={};window.ProperPiperTTS=class{constructor(voice){this.voiceId=voice;}init(){return new Promise(r=>release=r);}synthesize(){syntheses++;}};m.setTestRunning=()=>{};m.showFeedback=()=>{};const pending=m.piperTTS('test',{volume:1},'');m.cancelTest('');release();await pending;return{syntheses,busy:m.piperPreviewBusy,active:m.premiumQueueActive};});
 assert.deepEqual(cancelled,{syntheses:0,busy:false,active:false});console.log('PASS cancelled Piper loading cannot start stale speech');



 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
