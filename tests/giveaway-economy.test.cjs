'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.route('http://economy.test/**',r=>r.fulfill({body:'<!doctype html><title>Isolated economy tests</title>',contentType:'text/html'}));
  await page.goto('http://economy.test/');
  const source=fs.readFileSync('points.js','utf8');
  await page.addScriptTag({content:'const POINTS_MS_PER_MINUTE=60000,POINTS_MS_PER_HOUR=3600000;'+source.slice(source.indexOf('class PointsSystem {'),source.indexOf('\nconst configuredPointsPerEngagement'))+';window.PointsSystem=PointsSystem;'});
  await page.addScriptTag({content:fs.readFileSync('shared/giveaway/service.js','utf8')});
  const result=await page.evaluate(async()=>{
   const a=new PointsSystem({dbName:'isolated-economy'}),b=new PointsSystem({dbName:'isolated-economy'});
   await Promise.all([a.ensureDB(),b.ensureDB()]);
   await a.addPoints('Avery','youtube',10);
   await b.getUserPoints('Avery','youtube'); // deliberately seed a stale cache
   const one=new SSNGiveawayService(a,'fixture'),two=new SSNGiveawayService(b,'fixture');
   const actor={chatname:'Avery',type:'youtube',userid:'1'};
   await one.run('startgiveaway',{giveawayId:'one',config:{ticketCost:1}});
   await one.run('startgiveaway',{giveawayId:'two',config:{ticketCost:1}});
   const purchases=await Promise.allSettled([
    one.run('buygiveawaytickets',{giveawayId:'one',count:6,operationId:'buy-one'},actor),
    two.run('buygiveawaytickets',{giveawayId:'two',count:6,operationId:'buy-two'},actor),
    b.spendPoints('Avery','youtube',6)
   ]);
   const balance=await a.getUserPoints('Avery','youtube');
   if(balance.pointsSpent!==6) throw new Error('Concurrent operations overspent or overwrote a debit');
   const rounds=await one.list();
   const active=rounds.find(r=>r.ticketCount);
   const replay=await one.run('buygiveawaytickets',{giveawayId:active.giveawayId,count:6,operationId:'buy-'+active.giveawayId},actor);
   if(!replay.duplicate || (await a.getUserPoints('Avery','youtube')).pointsSpent!==6) throw new Error('Retry duplicated purchase');
   let resetBlocked=false;
   try {await a.resetAllPoints();}catch(_){resetBlocked=true;}
   if(!resetBlocked) throw new Error('Reset discarded reserved funds');
   await two.run('cancelgiveaway',{giveawayId:active.giveawayId,operationId:'refund'});
   await one.run('cancelgiveaway',{giveawayId:active.giveawayId,operationId:'refund'});
   if((await a.getUserPoints('Avery','youtube')).pointsSpent!==0) throw new Error('Refund mismatch');
   await one.run('startgiveaway',{giveawayId:'prize',config:{prizePoints:20}});
   await one.run('entergiveaway',{giveawayId:'prize'},actor);
   await one.run('drawgiveaway',{giveawayId:'prize',operationId:'draw'});
   await two.run('drawgiveaway',{giveawayId:'prize',operationId:'draw'});
   if((await a.getUserPoints('Avery','youtube')).points!==30) throw new Error('Payout repeated or lost');
   let conflicts=0;
   try {await one.run('drawgiveaway',{giveawayId:'other',operationId:'draw'});}catch(_){conflicts++;}
   await one.run('startgiveaway',{giveawayId:'coin',config:{kind:'coin',ticketCost:1}});
   await a.addPoints('Morgan','twitch',10);
   await one.run('buygiveawaytickets',{giveawayId:'coin',count:3,side:'heads'},actor);
   await one.run('buygiveawaytickets',{giveawayId:'coin',count:5,side:'tails'},{chatname:'Morgan',type:'twitch'});
   const coin=await one.run('drawgiveaway',{giveawayId:'coin',operationId:'coin-draw'});
   const left=await a.getUserPoints('Avery','youtube'),right=await a.getUserPoints('Morgan','twitch');
   if(left.points-left.pointsSpent+right.points-right.pointsSpent!==40 || left.pointsReserved || right.pointsReserved) throw new Error('Pot did not conserve balances');
   // A synchronous exception after a queued write must roll the entire transaction back.
   try {await one.transaction(async tx=>{const u=await tx.get(tx.users.get(actor.chatname+':youtube'));u.points=999;tx.users.put(u);throw new Error('Injected abort');});}catch(_){}
   if((await a.getUserPoints('Avery','youtube')).points===999) throw new Error('Aborted write committed');
   a.db.close(); b.db.close();
   const restarted=new PointsSystem({dbName:'isolated-economy'}), restored=new SSNGiveawayService(restarted,'fixture');
   if((await restored.run('getgiveawaystate',{giveawayId:'coin'})).giveaway.outcome!==coin.giveaway.outcome) throw new Error('Restart lost outcome');
   if((await restored.history()).length<4) throw new Error('History missing');
   await restarted.addPoints('Fraction','test',1.5);
   if((await restarted.spendPoints('Fraction','test',0.5)).remaining!==1) throw new Error('Legacy fractions regressed');
   const otherSession=new SSNGiveawayService(restarted,'other-session');
   if((await otherSession.list()).length || (await otherSession.history()).length)throw new Error('Session data leaked');
   await restored.run('startgiveaway',{giveawayId:'number',config:{kind:'number',prizePoints:7}});
   const secret=await restored.transaction(async tx=>(await tx.get(tx.records.get(restored.key('number')))).numberSecret,true);
   const publicState=(await restored.run('getgiveawaystate',{giveawayId:'number'})).giveaway;
   if('numberSecret' in publicState || JSON.stringify(publicState).includes('numberSecret'))throw new Error('Number Hunt answer leaked');
   const previous=(await restarted.getUserPoints('Avery','youtube')).points;
   await restored.run('guessgiveaway',{giveawayId:'number',guess:secret,operationId:'solve'},actor);
   await restored.run('guessgiveaway',{giveawayId:'number',guess:secret,operationId:'solve'},actor);
   if((await restarted.getUserPoints('Avery','youtube')).points!==previous+7)throw new Error('Number Hunt payout repeated');
   await restored.run('startgiveaway',{giveawayId:'recovery',config:{ticketCost:1}});
   await restored.run('buygiveawaytickets',{giveawayId:'recovery',count:1},actor);
   const backup=await restarted.exportAllPoints();
   const recovered=new PointsSystem({dbName:'fresh-recovery'});
   await recovered.recoverEconomyBackup(backup);
   const recoveredHost=new SSNGiveawayService(recovered,'fixture');
   if((await recoveredHost.run('getgiveawaystate',{giveawayId:'recovery'})).giveaway.open)throw new Error('Recovery reopened a paid round');
   await recoveredHost.run('cancelgiveaway',{giveawayId:'recovery'});
   if((await recovered.getUserPoints('Avery','youtube')).pointsReserved)throw new Error('Recovered refund failed');
   let blocked=false;try{await recovered.recoverEconomyBackup(backup);}catch(_){blocked=true;}if(!blocked)throw new Error('Recovery overwrote an existing wallet');
   await restarted.spendPoints('Avery','youtube',1,'sticker-test');
   await restarted.refundPoints('Avery','youtube',1,'sticker-test');
   await restarted.refundPoints('Avery','youtube',1,'sticker-test');
   if((await restarted.spendPoints('Avery','youtube',1,'sticker-test')).success)throw new Error('Sticker replay charged twice');
   return {conflicts,successfulPurchases:purchases.filter(p=>p.status==='fulfilled' && p.value.ok).length,outcome:coin.giveaway.outcome};
  });
  assert.equal(result.conflicts,1);
  assert.equal(result.successfulPurchases,1);
  console.log('Real IndexedDB economy: concurrency, replay, refund, prize, pot conservation, abort, restart and fractional balance checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
