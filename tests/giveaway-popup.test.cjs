'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'ssn-giveaway-extension-')),{
  channel:'chromium',headless:true,args:['--load-extension='+root,'--disable-extensions-except='+root],viewport:{width:700,height:1000}
 });
 try {
  await context.route(/^https?:/,route=>route.abort());
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId=new URL(worker.url()).host;
  let background;
  for(let attempt=0;attempt<100;attempt++) {
   background=context.pages().find(p=>p.url().includes('/background.html'));
   if(background) break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(background,'Isolated extension background is open');
  await background.waitForFunction(()=>typeof handleGiveawayAction==='function' && typeof SSNGiveaway!=='undefined');
  await background.evaluate(()=>{window.__giveawayPackets=[];sendTargetP2P=async function(payload,target){window.__giveawayPackets.push({payload,target});return true;};});
  const popup=await context.newPage();
  await popup.goto('chrome-extension://'+extensionId+'/popup.html');
  await popup.waitForFunction(()=>window.popupStartupSettingsHydrated && document.body.classList.contains('loaded'));
  if (await popup.locator('#beginnerWelcomeAdvanced').isVisible()) await popup.locator('#beginnerWelcomeAdvanced').click();
  await popup.locator('label[for="wrapper-giveaway-options"]').click();
  await popup.locator('#giveaway-keyword').fill('!raffle');
  await popup.locator('[data-giveaway-action="startgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Entries open'));
  await background.evaluate(()=>processGiveawayEntry({chatname:'Avery',type:'youtube',chatmessage:'!raffle',textonly:true}));
  await popup.locator('[data-giveaway-action="drawgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Avery'));
  assert.equal(await background.evaluate(async()=>(await (await getGiveawayHost()).run('getgiveawaystate',{})).giveaway.open),false);
  assert.ok(await popup.evaluate(()=>document.getElementById('giveaway').raw.includes('managed')));
  await popup.locator('#giveaway-presentation').selectOption('reel');
  await popup.waitForFunction(()=>document.getElementById('giveaway').raw.includes('presentation=reel'));
  for(const colorScheme of ['light','dark']) {
   await popup.emulateMedia({colorScheme});
   await popup.waitForTimeout(400);
   const panel=popup.locator('#wrapper-giveaway-options').locator('..');
   await panel.screenshot({path:path.join(os.tmpdir(),'ssn-giveaway-popup-'+colorScheme+'.png')});
   const colors=await popup.locator('#giveaway-keyword').evaluate(el=>({text:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
   assert.notEqual(colors.text,colors.bg);
  }
  await popup.locator('[data-giveaway-action="resetgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent==='Entries closed - 0 eligible entries.');
  const api = await background.evaluate(async()=>{
   const opened=await handleStreamDeckBackgroundRequest({action:'startgiveaway',protocol:2,get:'giveaway-open',value:{keyword:'!api'}});
   await processGiveawayEntry({chatname:'Morgan',type:'twitch',chatmessage:'!api',textonly:true});
   const drawn=await handleStreamDeckBackgroundRequest({action:'drawgiveaway',protocol:2,get:'giveaway-draw'});
   return {opened,drawn,packets:window.__giveawayPackets.filter(p=>p.target==='giveaway').length};
  });
  assert.equal(api.opened.ok,true);
  assert.equal(api.drawn.ok,true);
  assert.ok(api.packets>0);
  await background.evaluate(async()=>{settings.enablePointsSystem={setting:true};await window.pointsSystem.addPoints('Taylor','youtube',10);});
  await popup.locator('#giveaway-id').fill('paid');
  await popup.locator('summary').filter({hasText:'Tickets and point prizes'}).click();
  await popup.locator('#giveaway-cost').fill('1');
  await popup.locator('[data-giveaway-action="startgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Entries open'));
  await background.evaluate(async()=>{await processIncomingMessage({chatname:'Taylor',type:'youtube',chatmessage:'!ticket paid 3',textonly:true,meta:{messageId:'fixture-purchase'}});});
  await popup.locator('[data-giveaway-action="getgiveawaystate"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('3 tickets'));
  const managerPromise=context.waitForEvent('page');
  await popup.locator('#giveaway-manage').click();
  const manager=await managerPromise;await manager.waitForLoadState();
  await manager.waitForFunction(()=>document.getElementById('status').textContent.includes('3 tickets'));
  await manager.locator('#entries-refresh').click();
  await manager.getByRole('button',{name:'Remove and refund',exact:true}).click();
  await manager.waitForFunction(()=>document.getElementById('status').textContent.includes('0 viewers'));
  assert.equal(await background.evaluate(async()=>{const u=await window.pointsSystem.getUserPoints('Taylor','youtube');return u.pointsReserved;}),0);
  await manager.locator('#history-refresh').click();
  await manager.waitForFunction(()=>document.getElementById('history').textContent.includes('Morgan'));
  for(const colorScheme of ['light','dark']){await manager.emulateMedia({colorScheme});await manager.screenshot({path:path.join(os.tmpdir(),'ssn-giveaway-manager-'+colorScheme+'.png'),fullPage:true});}
  await manager.close();
  await popup.locator('[data-giveaway-action="cancelgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Cancelled'));
  const disabled=await background.evaluate(async()=>{settings.disablehost=true;const result=await handleGiveawayAction('startgiveaway',{});settings.disablehost=false;return result;});
  assert.equal(disabled.ok,false);
  console.log('Actual extension giveaway popup controls passed; light/dark screenshots in '+os.tmpdir());
 } finally {await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
