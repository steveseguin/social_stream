const assert=require('assert');
const path=require('path');
const os=require('os');
const {chromium}=require('playwright');
const {startStaticServer}=require('./playwright-static-server.cjs');
(async()=>{
 const server=await startStaticServer({root:path.resolve(__dirname,'..'),port:4191});
 const browser=await chromium.launch({headless:true});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1000}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.confirm=()=>true;});
  await page.goto('http://127.0.0.1:4191/actions/index.html');
  await page.waitForFunction(()=>window.flowEditor && window.SSNSoundLibrary);
  await page.waitForSelector('#loading-modal',{state:'hidden'});
  await page.selectOption('#template-select','donation-celebration');
  await page.waitForFunction(()=>flowEditor.currentFlow.name==='Donation: celebration + voice');
  assert(await page.locator('#flow-output-help').textContent().then(t=>t.includes('Flow Actions')&&t.includes('Multi-Alerts')));
  assert.strictEqual(await page.locator('#flow-active').isChecked(),false,'Templates must start disabled');
  const soundNode=page.getByRole('button',{name:/Play Audio Clip.*Press Enter/});
  await soundNode.focus();await page.keyboard.press('Enter');
  assert(await page.locator('#eventflow-audio-library').evaluate(e=>e.labels.length>0));
  assert.strictEqual(await page.locator('#eventflow-audio-library option[value]:not([value=""])').count(),17);
  await page.selectOption('#eventflow-audio-library','./audio/alerts/voice-welcome.wav');
  await page.locator('#prop-volume').fill('0.25');
  assert.strictEqual(await page.evaluate(()=>flowEditor.currentFlow.nodes.find(n=>n.actionType==='playAudioClip').config.audioUrl),'./audio/alerts/voice-welcome.wav');
  // Observe real media events rather than replacing playback.
  await page.evaluate(()=>{
   window.__played=[];
   const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>window.__played.push({src:this.src,volume:this.volume}),{once:true});return play.call(this);};
  });
  await page.click('#eventflow-audio-listen');
  await page.waitForFunction(()=>window.__played.length>0);
  assert.strictEqual(await page.evaluate(()=>__played[0].volume),.25);
  await page.screenshot({path:path.join(os.tmpdir(),'ssn-eventflow-sound-picker.png')});
  await page.click('#eventflow-audio-listen');
  assert.strictEqual(await page.locator('#eventflow-audio-listen').textContent(),'Listen');
  // Switching away from an app-local asset must clear its stale reference.
  await page.evaluate(()=>{
   const node=flowEditor.currentFlow.nodes.find(n=>n.actionType==='playAudioClip');
   Object.assign(node.config,{sourceType:'local',localAssetId:'test-only',localAssetName:'Test recording',localMediaType:'audio'});
   flowEditor.showNodeProperties(node);
  });
  await page.selectOption('#eventflow-audio-library','./audio/alerts/voice-thank-you.wav');
  assert(await page.evaluate(()=>{const n=flowEditor.currentFlow.nodes.find(n=>n.actionType==='playAudioClip');return n.config.sourceType==='url'&&!n.config.localAssetId&&document.activeElement.id==='eventflow-audio-library';}));
  await page.click('#save-flow-btn');
  const flowId=await page.evaluate(()=>flowEditor.currentFlow.id);
  await page.reload();await page.waitForFunction(()=>window.flowEditor);
  await page.evaluate(id=>flowEditor.loadFlow(id),flowId);
  assert.strictEqual(await page.evaluate(()=>flowEditor.currentFlow.nodes.find(n=>n.actionType==='playAudioClip').config.audioUrl),'./audio/alerts/voice-thank-you.wav');
  // The normal Test action must run a disabled template without enabling it.
  await page.evaluate(()=>{
   window.__sent=[];flowEditor.eventFlowSystem.sendTargetP2P=(payload,target)=>__sent.push({payload,target});
   flowEditor.runTestFlow({platform:'youtube',type:'youtube',chatname:'Local test',chatmessage:'Thanks',textonly:true,hasDonation:'$100 USD'});
  });
  await page.waitForFunction(()=>window.__sent.length===2);
  const sent=await page.evaluate(()=>__sent);
  assert(sent.every(item=>item.target==='actions'));
  assert(sent.some(item=>item.payload.overlayNinja.actionType==='play_audio'));
  assert.strictEqual(await page.evaluate(()=>flowEditor.currentFlow.active),false);
  const overlay=await context.newPage();overlay.on('pageerror',e=>errors.push(e.message));
  await overlay.addInitScript(()=>{
   window.__played=[];const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>__played.push({src:this.src,volume:this.volume}),{once:true});return play.call(this);};
  });
  await overlay.goto('http://127.0.0.1:4191/actions.html?session=alert-library-local-test');
  await overlay.click('body',{position:{x:10,y:10}});
  await overlay.evaluate(items=>items.forEach(item=>processInput(item.payload.overlayNinja)),sent);
  await overlay.waitForFunction(()=>__played.some(item=>item.src.endsWith('/audio/alerts/voice-thank-you.wav')));
  assert(await overlay.locator('img[src="./media/alerts/celebration.svg"]').count()>0);
  await overlay.screenshot({path:path.join(os.tmpdir(),'ssn-flow-celebration.png')});
  await page.selectOption('#template-select','donation-obs-effect');
  await page.waitForFunction(()=>flowEditor.currentFlow.name.includes('OBS filter'));
  assert.strictEqual(await page.locator('#flow-active').isChecked(),false);
  // Test the advanced sequence with captured output only; never connect to OBS.
  await page.evaluate(()=>{
   __sent=[];
   flowEditor.currentFlow.nodes.forEach(n=>{if(n.actionType==='obsSetSourceFilter'){n.config.sourceName='Test source';n.config.filterName='Test filter';}if(n.actionType==='delay')n.config.delayMs=10;});
   flowEditor.runTestFlow({type:'youtube',chatname:'Local test',hasDonation:'$100 USD'});
  });
  await page.waitForFunction(()=>__sent.filter(x=>x.payload.overlayNinja.actionType==='obsSetSourceFilter').length===2);
  const filterStates=await page.evaluate(()=>__sent.filter(x=>x.payload.overlayNinja.actionType==='obsSetSourceFilter').map(x=>x.payload.overlayNinja.enabled));
  assert.deepStrictEqual(filterStates,['true','false']);
  assert.deepStrictEqual(errors,[]);
  console.log('PASS shared sound picker, keyboard editing, 17 choices, real voice playback, saved settings, local-file replacement, disabled-template previews, Flow Actions output and advanced OBS sequence.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
