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
  // Configure both games through the same popup controls used by operators.
  await popup.locator('#giveaway-id').fill('numbers');
  await popup.locator('#giveaway-kind').selectOption('number');
  await popup.locator('#giveaway-cost').fill('0');
  await popup.locator('#giveaway-prize').fill('7');
  await popup.locator('[data-giveaway-action="startgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Entries open'));
  await manager.locator('#giveaway').fill('numbers');
  await manager.locator('#refresh').click();
  await manager.waitForFunction(()=>document.getElementById('rules').textContent.includes('!guess numbers NUMBER'));
  const secret=await background.evaluate(async()=>{const h=await getGiveawayHost();return h.transaction(async tx=>(await tx.get(tx.records.get(h.key('numbers')))).numberSecret,true);});
  await background.evaluate(async guess=>processIncomingMessage({chatname:'Number Player',type:'youtube',chatmessage:'!guess numbers '+guess,textonly:true,meta:{messageId:'fixture-guess'}}),secret);
  await manager.locator('#refresh').click();
  await manager.waitForFunction(()=>document.getElementById('status').textContent.includes('completed'));
  // The normal capture path also awards the configured one-point engagement.
  assert.equal(await background.evaluate(async()=>(await window.pointsSystem.getUserPoints('Number Player','youtube')).points),8);
  await popup.locator('#giveaway-id').fill('pot');
  await popup.locator('#giveaway-kind').selectOption('coin');
  await popup.locator('#giveaway-cost').fill('1');
  await popup.locator('#giveaway-prize').fill('0');
  await popup.locator('[data-giveaway-action="startgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Entries open'));
  await background.evaluate(async()=>{
   for(const name of ['Heads Player','Tails Player'])await window.pointsSystem.addPoints(name,'youtube',10);
   await processIncomingMessage({chatname:'Heads Player',type:'youtube',chatmessage:'!ticket pot 3 heads',textonly:true,meta:{messageId:'fixture-heads'}});
   await processIncomingMessage({chatname:'Tails Player',type:'youtube',chatmessage:'!ticket pot 5 tails',textonly:true,meta:{messageId:'fixture-tails'}});
  });
  await manager.locator('#giveaway').fill('pot');
  await manager.locator('#refresh').click();
  await manager.waitForFunction(()=>document.getElementById('rules').textContent.includes('!ticket pot COUNT heads'));
  await manager.locator('[data-action="drawgiveaway"]').click();
  await manager.waitForFunction(()=>document.getElementById('status').textContent.includes('wins.'));
  assert.equal(await background.evaluate(async()=>{let total=0;for(const name of ['Heads Player','Tails Player']){const u=await window.pointsSystem.getUserPoints(name,'youtube');if(u.pointsReserved)throw new Error('Stake remains reserved');total+=u.points-u.pointsSpent;}return total;}),22);
  await background.evaluate(async()=>{const host=await getGiveawayHost();await host.run('startgiveaway',{giveawayId:'backup-tickets',config:{ticketCost:1}});await host.run('buygiveawaytickets',{giveawayId:'backup-tickets',count:2},{chatname:'Taylor',type:'youtube'});});
  const downloaded=manager.waitForEvent('download');
  await manager.locator('#backup').click();
  const backupDownload=await downloaded;
  const backup=JSON.parse(fs.readFileSync(await backupDownload.path(),'utf8'));
  assert.equal(backup.version,2);
  assert.ok(backup.economyRecords.length);
  // Recover the downloaded file through the manager in an entirely fresh extension profile.
  const fresh=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'ssn-giveaway-recovered-')),{channel:'chromium',headless:true,args:['--load-extension='+root,'--disable-extensions-except='+root]});
  try {
   await fresh.route(/^https?:/,r=>r.abort());
   const freshWorker=fresh.serviceWorkers()[0]||await fresh.waitForEvent('serviceworker');
   const freshId=new URL(freshWorker.url()).host;
   let freshBackground;for(let n=0;n<100;n++){freshBackground=fresh.pages().find(p=>p.url().includes('/background.html'));if(freshBackground)break;await new Promise(r=>setTimeout(r,100));}
   assert(freshBackground);await freshBackground.waitForFunction(()=>window.pointsSystem&&typeof getGiveawayHost==='function');
   const recovery=await fresh.newPage();await recovery.goto('chrome-extension://'+freshId+'/giveaway-control.html?giveaway=backup-tickets');
   await recovery.waitForFunction(()=>!document.getElementById('refresh').disabled);
   await recovery.locator('#recover').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
   await recovery.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Recovered '));
   const recoveredPopup=await fresh.newPage();await recoveredPopup.goto('chrome-extension://'+freshId+'/popup.html');
   await recoveredPopup.waitForFunction(()=>window.popupStartupSettingsHydrated&&document.body.classList.contains('loaded'));
   if(await recoveredPopup.locator('#beginnerWelcomeAdvanced').isVisible())await recoveredPopup.locator('#beginnerWelcomeAdvanced').click();
   await recoveredPopup.locator('label[for="wrapper-session-options"]').click();
   const session=backup.economyRecords.find(r=>r.id.startsWith('giveaway:')).session;
   await recoveredPopup.locator('#sessionid').fill(session);await recoveredPopup.locator('#sessionid').press('Tab');
   await freshBackground.waitForFunction(session=>streamID===session,session);
   await recovery.locator('#refresh').click();
   await recovery.waitForFunction(()=>document.getElementById('status').textContent.includes('locked')&&document.getElementById('status').textContent.includes('2 tickets'));
   await recovery.locator('[data-action="cancelgiveaway"]').click();
   await recovery.waitForFunction(()=>document.getElementById('status').textContent.includes('cancelled'));
   assert.equal(await freshBackground.evaluate(async()=>(await window.pointsSystem.getUserPoints('Taylor','youtube')).pointsReserved),0);
   await recovery.locator('#history-refresh').click();
   await recovery.waitForFunction(()=>document.getElementById('history').textContent.includes('Number Player'));
  } finally {await fresh.close();}
  await manager.close();
  await popup.locator('#giveaway-id').fill('paid');
  assert.equal(await background.evaluate(async()=>{await handleGiveawayAction('closegiveaway',{giveawayId:'paid'});return (await handleGiveawayAction('startgiveaway',{giveawayId:'paid'})).giveaway.config.ticketCost;}),1);
  await popup.locator('[data-giveaway-action="cancelgiveaway"]').click();
  await popup.waitForFunction(()=>document.getElementById('giveaway-control-status').textContent.includes('Cancelled'));
  const disabled=await background.evaluate(async()=>{settings.disablehost=true;const result=await handleGiveawayAction('startgiveaway',{});settings.disablehost=false;return result;});
  assert.equal(disabled.ok,false);
  if(process.env.SSN_GIVEAWAY_PLUGIN_BUNDLE)await require('./giveaway-streamdeck-helper.cjs')(background,path.resolve(process.env.SSN_GIVEAWAY_PLUGIN_BUNDLE));
  console.log('Actual extension giveaway popup controls passed; light/dark screenshots in '+os.tmpdir());
 } finally {await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
