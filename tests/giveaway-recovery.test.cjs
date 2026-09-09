'use strict';
// Real persistent Chromium profiles; only this test's child process tree is killed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {fork, spawnSync} = require('node:child_process');
const {chromium} = require('playwright');

async function worker(profile, phase) {
 const context = await chromium.launchPersistentContext(profile, {headless:true});
 const page = await context.newPage();
 await page.route('http://recovery.test/**', r => r.fulfill({body:'<!doctype html><title>Isolated recovery test</title>'}));
 await page.goto('http://recovery.test/');
 const source = fs.readFileSync(path.join(__dirname,'../points.js'),'utf8');
 await page.addScriptTag({content:'const POINTS_MS_PER_MINUTE=60000,POINTS_MS_PER_HOUR=3600000;' + source.slice(source.indexOf('class PointsSystem {'),source.indexOf('\nconst configuredPointsPerEngagement')) + ';window.PointsSystem=PointsSystem;'});
 await page.addScriptTag({path:path.join(__dirname,'../shared/giveaway/service.js')});
 await page.exposeFunction('readyToCrash', () => process.send({ready:true}));
 await page.evaluate(async phase => {
  const points = new PointsSystem({dbName:'crash-economy'}), host = new SSNGiveawayService(points,'crash-fixture');
  const actor = {chatname:'Recovery Player',type:'youtube',userid:'fixture'};
  const check = (value,message) => {if(!value)throw new Error(message);};
  await points.ensureDB();
  await host.recoverRounds();
  if(phase===0) {
   await points.addPoints(actor.chatname,actor.type,20);
   await host.run('startgiveaway',{giveawayId:'tickets',config:{ticketCost:2}});
   await host.run('buygiveawaytickets',{giveawayId:'tickets',count:3,operationId:'purchase'},actor);
  } else if(phase===1) {
   const round=(await host.run('getgiveawaystate',{giveawayId:'tickets'})).giveaway;
   check(!round.open && round.ticketCount===3,'Restart lost or reopened committed tickets');
   check((await host.run('buygiveawaytickets',{giveawayId:'tickets',count:3,operationId:'purchase'},actor)).duplicate,'Purchase receipt lost after crash');
   await host.run('cancelgiveaway',{giveawayId:'tickets',operationId:'cancel'});
   check((await points.getUserPoints(actor.chatname,actor.type)).pointsSpent===0,'Restart refund failed');
   await host.run('startgiveaway',{giveawayId:'prize',config:{prizePoints:7}});
   await host.run('entergiveaway',{giveawayId:'prize'},actor);
   await host.run('drawgiveaway',{giveawayId:'prize',operationId:'award'});
  } else if(phase===2) {
   check((await host.run('drawgiveaway',{giveawayId:'prize',operationId:'award'})).duplicate,'Payout receipt lost after crash');
   check((await points.getUserPoints(actor.chatname,actor.type)).points===27,'Restart duplicated prize');
   await host.run('startgiveaway',{giveawayId:'interrupted',config:{ticketCost:1,prizePoints:9}});
   await host.run('buygiveawaytickets',{giveawayId:'interrupted',count:2,operationId:'reserved'},actor);
   // Hold the actual draw transaction open after it queues its round and wallet writes.
   const put = IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put = function(value) {
    const request=put.apply(this,arguments);
    if(this.name==='economyRecords' && value.id===host.key('interrupted') && value.status==='completed') {
     const store=this;
     function keepAlive(){store.get('__test_keepalive__').onsuccess=keepAlive;}
     keepAlive();
     request.onsuccess=()=>window.readyToCrash();
    }
    return request;
   };
   await host.run('drawgiveaway',{giveawayId:'interrupted',operationId:'interrupted-award'});
   throw new Error('Held draw unexpectedly committed');
  } else {
   const user=await points.getUserPoints(actor.chatname,actor.type);
   check(user.points===27 && user.pointsSpent===2 && user.pointsReserved===2,'Crash left a partial payout or settlement');
   const round=(await host.run('getgiveawaystate',{giveawayId:'interrupted'})).giveaway;
   check(round.winners.length===0 && round.ticketCount===2 && !round.open,'Uncommitted draw survived crash');
   const result=await host.run('drawgiveaway',{giveawayId:'interrupted',operationId:'interrupted-award'});
   check(!result.duplicate,'Aborted receipt survived crash');
   const final=await points.getUserPoints(actor.chatname,actor.type);
   check(final.points===36 && final.pointsSpent===2 && final.pointsReserved===0,'Retry did not settle once');
  }
 },phase);
 if(phase===3) {await context.close();process.send({done:true});}
 else process.send({ready:true});
}

async function main() {
 assert.equal(process.platform,'win32','Hard-termination harness currently targets Windows');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-giveaway-crash-'));
 for(let phase=0;phase<4;phase++) {
  await new Promise((resolve,reject)=>{
   const child=fork(__filename,['--worker',profile,String(phase)],{stdio:['ignore','pipe','pipe','ipc']});
   let output='',finished=false;
   child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
   const stop=()=>spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});
   const timer=setTimeout(()=>{stop();reject(new Error('Crash phase timed out: '+phase+' '+output));},45000);
   child.on('message',message=>{
    if(!message.ready && !message.done)return;
    finished=true;clearTimeout(timer);
    if(message.ready){const killed=stop();if(killed.status!==0)return reject(new Error('Unable to terminate isolated browser tree'));}
    resolve();
   });
   child.on('exit',code=>{if(!finished){clearTimeout(timer);reject(new Error('Crash phase '+phase+' exited '+code+': '+output));}});
  });
 }
 console.log('Forced browser termination: purchase recovery/refund, committed prize replay, interrupted draw rollback and retry passed.');
}
if(process.argv[2]==='--worker')worker(process.argv[3],Number(process.argv[4])).catch(error=>{console.error(error);process.exit(1);});
else main().catch(error=>{console.error(error);process.exitCode=1;});
