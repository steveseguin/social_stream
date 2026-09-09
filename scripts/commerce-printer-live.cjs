// Opt-in physical test: node scripts/commerce-printer-live.cjs --printer=POS-58 --print-three
// Sends exactly three synthetic receipts through an isolated SSApp Event Flow runtime.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { _electron } = require('playwright');
const printer = (process.argv.find(a => a.startsWith('--printer=')) || '').slice(10);
if (!printer || !process.argv.includes('--print-three')) throw new Error('Explicit --printer=NAME and --print-three are required; this sends physical print jobs.');
const root = path.resolve(__dirname, '..'), ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-commerce-printer-'));
const report = { printer, started: new Date().toISOString(), samples: [], physicalOutput: 'Awaiting user confirmation' };
function jobs() {
 const script = "@(Get-PrintJob -PrinterName '" + printer.replace(/'/g, "''") + "' -ErrorAction Stop | Select-Object ID,DocumentName,JobStatus,PagesPrinted,TotalPages) | ConvertTo-Json -Compress";
 const reply = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding:'utf8', windowsHide:true });
 assert.equal(reply.status, 0, reply.stderr);
 const value = reply.stdout.trim() ? JSON.parse(reply.stdout) : [];
 return Array.isArray(value) ? value : [value];
}
(async () => {
 let app;
 try {
  report.initialJobs = jobs();
  assert.equal(report.initialJobs.length, 0, 'Printer already has queued jobs; inspect it before adding samples.');
  fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ state:false, streamID:'physical-print-fixture', password:'false', settings:{}, wsServer:false }));
  const wrapper = path.join(profile, 'bootstrap.cjs');
  fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:true})));require(${JSON.stringify(path.join(ssapp,'bootstrap.js'))});`);
  app = await _electron.launch({ executablePath:path.join(ssapp,'node_modules/electron/dist/electron.exe'), args:[wrapper,'--running-from-source','--multiinstance','--ssapp-headless-control','--filesource','file:///'+root.replace(/\\/g,'/')+'/', '--no-hwa'], cwd:ssapp, env:{...process.env, SSAPP_USER_DATA_DIR:profile, SSAPP_DIAGNOSTICS_SAFE_GPU:'1'} });
  const main = await app.firstWindow(); main.setDefaultTimeout(30000);
  await main.waitForFunction(() => !!document.querySelector('#frame2')?.contentWindow?.eventFlowSystem);
  const background = main.frames().find(f => /background\.html/.test(f.url()));
  const popup = main.frames().find(f => /popup\.html/.test(f.url()));
  await popup.waitForFunction(() => typeof refreshThermalPrinterList === 'function');
  report.discoveredPrinters = await popup.evaluate(async () => (await refreshThermalPrinterList()).map(p=>p.name));
  assert(report.discoveredPrinters.includes(printer), 'Selected physical printer was not discovered by the popup.');
  const samples = [
   { label:'SSN TEST 1 - SALE', type:'ebay', event:'purchase', chatname:'Test Buyer', subtitle:'Studio mug x2', chatmessage:'Synthetic purchase', meta:{commerce:{quantity:2}}, text:'**SSN TEST 1 - SALE**\n{username}\n{subtitle}\nQuantity: {meta.commerce.quantity}\nTEST ONLY - NO PAYMENT' },
   { label:'SSN TEST 2 - TIP', type:'kofi', chatname:'Test Supporter', chatmessage:'Thanks for the show!', hasDonation:'$5.00 USD', donoValue:5, text:'**SSN TEST 2 - TIP**\n{username}\n{donation}\n{message}\nTEST ONLY - NO PAYMENT' },
   { label:'SSN TEST 3 - GIFT', type:'fourthwall', event:'gift', chatname:'Test Gifter', subtitle:'Mug for Test Recipient', chatmessage:'Re-gift sample', meta:{commerce:{recipient:'other'}}, text:'**SSN TEST 3 - GIFT**\n{username}\n{subtitle}\nRecipient: {meta.commerce.recipient}\nTEST ONLY - NO PAYMENT' }
  ];
  for (const sample of samples) {
   const result = await background.evaluate(async ({sample, printer}) => {
    const message = {...sample, platform:sample.type, textonly:true, id:sample.label}; delete message.text; delete message.label;
    const trigger = {id:'trigger',type:'trigger',triggerType:sample.event?'eventType':'eventDonation',config:sample.event?{eventType:sample.event}:{minAmount:1}};
    const action = {id:'print',type:'action',actionType:'printThermal',config:{text:sample.text,printerName:printer,fontSize:12,fontWeight:'selected',textAlign:'left',lineHeight:1.15,copies:1}};
    const flow = {id:'physical-commerce-test',name:sample.label,active:true,nodes:[trigger,action],connections:[{from:'trigger',to:'print'}]};
    eventFlowSystem.flows = [flow];
    const result = await eventFlowSystem.processMessage(message);
    return { callback:result?.meta?.thermalPrintResult, originalHasCallback:!!message.meta?.thermalPrintResult };
   }, {sample,printer});
   report.samples.push({label:sample.label,...result,queuedJobs:jobs()});
   fs.writeFileSync(path.join(profile,'results.json'), JSON.stringify(report,null,2));
   assert.equal(result.callback?.success,true,JSON.stringify(result));
   assert.equal(result.callback.printerName,printer);
   assert.equal(result.originalHasCallback,false);
   await main.waitForTimeout(1500);
  }
  const deadline = Date.now()+30000;
  do { report.finalJobs=jobs(); if (!report.finalJobs.length) break; await main.waitForTimeout(1000); } while(Date.now()<deadline);
  assert.equal(report.finalJobs.length,0,'Some submitted jobs remain queued; do not retry until inspected.');
  report.passed = true;
 } catch(error) { report.error = error.stack; process.exitCode=1; }
 finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(profile,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,reportPath:path.join(profile,'results.json')},null,2));
  if(app) await app.close();
 }
})();
