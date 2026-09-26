// Offline browser benchmark. The candidate guard exists ONLY in this harness.
// Run: node tests/chat-sanitizer-benchmark.cjs --output=PATH.json
// --quick runs a short smoke test; full runs alternate baseline/guard order.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, read } = require('./helpers/chat-security-harness.cjs');
const quick = process.argv.includes('--quick');
const arg = (key, fallback) => {
  const value = process.argv.find(value => value.startsWith('--' + key + '='));
  return value ? value.slice(key.length + 3) : fallback;
};
const duration = Number(arg('duration', quick ? 2 : 8));
const rounds = Number(arg('rounds', quick ? 1 : 3));
const rate = Number(arg('rate', 500));
const output = arg('output', path.join(os.tmpdir(), 'ssn-chat-sanitizer-benchmark.json'));
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const emote = `<img class="emote" alt="wave" src="${pixel}">`;
const ordinary = 'Hello chat! This is a normal message with a few words, symbols &amp; a question. Looking good today!';
const rich = `<i><small>Viewer: previous reply &amp; context</small></i> <b>Thanks!</b> ${ordinary} ${emote} ${emote} <a href="https://example.invalid/clip">clip</a>`;
const heavy = ordinary + ' ' + Array.from({ length: 20 }, () => emote).join(' ');
const svg = `<svg viewBox="0 0 100 100" width="24" height="24">${Array.from({length:40},(_,i)=>`<path fill="#abc" d="M${i} 0 L100 100 L0 100 Z"/>`).join('')}</svg>`;
const fixtures = { ordinary, rich, heavy, svg };
const result = {
  timestamp: new Date().toISOString(), hardware: { cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length, ramGiB: os.totalmem()/2**30 },
  configuration: { duration, rounds, rate, headless: true, viewport: '1280x720', dockRows: 200, network: 'local static assets and data-URI images only', fixtureBytes: Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,Buffer.byteLength(v)])) },
  micro: [], runs: [], policy: null
};
const quantile = (values, q) => { const a=values.slice().sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*q))]||0; };
function cpuByType(processes) {
  const totals = {};
  for (const proc of processes) totals[proc.type] = (totals[proc.type] || 0) + proc.cpuTime;
  return totals;
}
function metricMap(metrics) { return Object.fromEntries(metrics.map(m=>[m.name,m.value])); }

(async()=>{
  const server = await createStaticServer();
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    result.browser = browser.version();
    const rootCDP = await browser.newBrowserCDPSession();
    const context = await browser.newContext({viewport:{width:1280,height:720}});
    await configureContext(context,server.baseUrl);
    const microPage = await context.newPage();
    await microPage.goto(server.baseUrl+'/sample_wss_source.html?session=BENCH_OFFLINE');
    await microPage.addScriptTag({content:read('libs/objects.js')});
    await microPage.addScriptTag({content:read('shared/utils/chatHtml.js')});
    result.policy = await microPage.evaluate(() => ({
      inlineStyleBefore: '<i style="color:red">reply</i>',
      inlineStyleAfter: SocialStreamChatHTML.sanitize('<i style="color:red">reply</i>'),
      unsafeAfter: SocialStreamChatHTML.sanitize('<img src="https://example.invalid/x" onerror="window.__benchmarkProbe=true"><script>window.__benchmarkProbe=true</script>'),
      note: 'Production display policy; baseline bypasses it only inside this offline benchmark.'
    }));
    const prepared = await microPage.evaluate(fixtures => Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,filterXSS(v)])),fixtures);
    const microCases = [
      {name:'plain_bypass',body:'Hello <i>literal</i> &amp; text',textonly:true},
      ...Object.entries(prepared).map(([name,body])=>({name,body,textonly:false})),
      {name:'legacy_styled_html',body:'<i style="color:red">reply</i><span style="position:relative;vertical-align:middle">' + prepared.rich + '</span>',textonly:false},
      {name:'long_text_16k',body:'ordinary text &amp; '.repeat(850),textonly:false}
    ];
    for (const fixture of microCases) {
      const sample = await microPage.evaluate(({fixture,quick})=>{
        let checksum=0;
        const candidate = () => fixture.textonly ? fixture.body : SocialStreamChatHTML.sanitize(fixture.body);
        for(let i=0;i<500;i++)checksum+=candidate().length;
        const samples=[];
        for(let round=0;round<(quick?3:7);round++) {
          let n=0;const started=performance.now();let elapsed=0;
          do {for(let i=0;i<100;i++){checksum+=candidate().length;n++;}elapsed=performance.now()-started;}while(elapsed<(quick?60:180));
          samples.push(elapsed/n);
        }
        return {samples,checksum,chars:fixture.body.length,stable:candidate()===fixture.body};
      },{fixture,quick});
      assert.ok(sample.checksum>0);
      result.micro.push({name:fixture.name,...sample,medianMs:quantile(sample.samples,.5),p95BatchMeanMs:quantile(sample.samples,.95)});
      console.log('MICRO '+fixture.name+' '+(quantile(sample.samples,.5)*1000).toFixed(2)+' us/message');
    }
    await microPage.close();
    const workloads = arg('workload','') ? [arg('workload','')] : quick ? ['html_mix'] : ['plain','html_mix','emote_heavy'];
    const surfaces = arg('surface','') ? [arg('surface','')] : ['dock.html','featured.html'];
    for(let round=0;round<rounds;round++)for(const surface of surfaces)for(const workload of workloads) {
      for(const guard of round%2?[true,false]:[false,true]) {
        const page=await context.newPage();const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        try {
          await page.goto(server.baseUrl+'/'+surface+'?session=BENCH_OFFLINE&limit=200',{waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>typeof processData==='function');
          await page.waitForTimeout(250);
          const cdp=await context.newCDPSession(page);
          await cdp.send('Performance.enable');
          await page.evaluate(({prepared,workload,guard,pixel,surface})=>{
            window.__bench={count:0,filterCalls:0,filterMs:0,syncMs:0,lag:[],batches:[],frames:[],longTasks:[],prepared,workload,guard};
            let previousFrame=0;
            const frame=t=>{if(previousFrame&&__bench.running)__bench.frames.push(t-previousFrame);previousFrame=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);
            try{new PerformanceObserver(list=>{if(__bench.running)for(const item of list.getEntries())__bench.longTasks.push(item.duration);}).observe({entryTypes:['longtask']});}catch(_){}
            const sanitize=SocialStreamChatHTML.sanitize;
            // Both variants use the real call sites. Baseline disables only this
            // final body check; it does not change payloads or badge processing.
            SocialStreamChatHTML.sanitize=html=>{if(!guard)return html;const t=performance.now();const result=sanitize(html);__bench.filterMs+=performance.now()-t;__bench.filterCalls++;return result;};
            window.__renderBenchMessage=i=>{
              const body=workload==='plain'?'Literal <i>text</i> &amp; test':workload==='emote_heavy'?prepared.heavy:(i%10<7?prepared.ordinary:prepared.rich);
              const data={id:100000+i,chatname:'BenchViewer'+(i%20),chatmessage:body+' BENCH_'+i,textonly:workload==='plain',type:'twitch',chatbadges:[],chatimg:pixel};
              processData({contents:data});
            };
            for(let i=0;i<30;i++)__renderBenchMessage(-100+i);
            __bench.filterMs=0;__bench.filterCalls=0;
          },{prepared,workload,guard,pixel,surface});
          await page.waitForTimeout(650);
          await page.evaluate(()=>{__bench.filterMs=0;__bench.filterCalls=0;});
          const beforeMetrics=metricMap((await cdp.send('Performance.getMetrics')).metrics);
          const beforeCPU=cpuByType((await rootCDP.send('SystemInfo.getProcessInfo')).processInfo);
          const bench=await page.evaluate(async({rate,duration})=>{
            const b=__bench;b.running=true;
            const started=performance.now(),total=Math.round(rate*duration),batchSize=Math.max(1,Math.round(rate*.02));
            while(b.count<total){
              const due=started+b.count*1000/rate,wait=due-performance.now();
              if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
              b.lag.push(Math.max(0,performance.now()-due));
              const t=performance.now(),end=Math.min(total,b.count+batchSize);
              while(b.count<end){__renderBenchMessage(b.count);b.count++;}
              const work=performance.now()-t;b.syncMs+=work;b.batches.push(work);
              // Always yield to rendering and timers, including an overloaded page.
              if(performance.now()>started+b.count*1000/rate)await new Promise(resolve=>setTimeout(resolve,0));
            }
            const finishAt=started+duration*1000;
            if(performance.now()<finishAt)await new Promise(resolve=>setTimeout(resolve,finishAt-performance.now()));
            const deliveryMs=performance.now()-started;
            const drainDeadline=performance.now()+2000;
            while(!document.body.textContent.includes('BENCH_'+(b.count-1))&&performance.now()<drainDeadline)await new Promise(resolve=>setTimeout(resolve,10));
            const elapsedMs=performance.now()-started;b.running=false;
            return {count:b.count,elapsedMs,deliveryMs,filterCalls:b.filterCalls,filterMs:b.filterMs,syncMs:b.syncMs,lag:b.lag,batches:b.batches,frames:b.frames,longTasks:b.longTasks,
              lastVisible:document.body.textContent.includes('BENCH_'+(b.count-1)),domNodes:document.querySelectorAll('*').length};
          },{rate,duration});
          const afterCPU=cpuByType((await rootCDP.send('SystemInfo.getProcessInfo')).processInfo);
          const afterMetrics=metricMap((await cdp.send('Performance.getMetrics')).metrics);
          assert.equal(bench.count,Math.round(rate*duration));
          assert.equal(bench.lastVisible,true,'Last message must actually render');
          assert.deepEqual(errors,[],'No production errors allowed');
          if(!guard||workload==='plain')assert.equal(bench.filterCalls,0);
          else if(surface==='dock.html')assert.equal(bench.filterCalls,bench.count);
          else assert.ok(bench.filterCalls>0&&bench.filterCalls<=bench.count);
          const cpuSeconds=Object.fromEntries(Object.keys(afterCPU).map(type=>[type,afterCPU[type]-(beforeCPU[type]||0)]));
          const seconds=bench.elapsedMs/1000,totalCPU=Object.values(cpuSeconds).reduce((a,b)=>a+b,0);
          const row={round,surface,workload,guard,count:bench.count,elapsedMs:bench.elapsedMs,deliveryMs:bench.deliveryMs,actualRate:bench.count/(bench.deliveryMs/1000),filterCalls:bench.filterCalls,filterMs:bench.filterMs,syncMs:bench.syncMs,
            mainThreadBusyPct:(afterMetrics.TaskDuration-beforeMetrics.TaskDuration)/seconds*100,
            browserCPUCorePct:totalCPU/seconds*100,browserMachinePct:totalCPU/seconds*100/os.cpus().length,cpuSeconds,
            scriptSeconds:afterMetrics.ScriptDuration-beforeMetrics.ScriptDuration,layoutSeconds:afterMetrics.LayoutDuration-beforeMetrics.LayoutDuration,
            recalcSeconds:afterMetrics.RecalcStyleDuration-beforeMetrics.RecalcStyleDuration,heapStartMiB:beforeMetrics.JSHeapUsedSize/2**20,heapEndMiB:afterMetrics.JSHeapUsedSize/2**20,
            lagP95Ms:quantile(bench.lag,.95),lagMaxMs:Math.max(...bench.lag),batchP95Ms:quantile(bench.batches,.95),frameP95Ms:quantile(bench.frames,.95),longTasks:bench.longTasks.length,domNodes:bench.domNodes};
          if(process.argv.includes('--collect-garbage')) {
            // Outside the timed/CPU sample: distinguish allocation timing from retained heap.
            await cdp.send('HeapProfiler.collectGarbage');
            row.heapAfterGCMiB=metricMap((await cdp.send('Performance.getMetrics')).metrics).JSHeapUsedSize/2**20;
          }
          result.runs.push(row);
          fs.writeFileSync(output,JSON.stringify(result,null,2));
          console.log('RUN '+JSON.stringify({round,surface,workload,guard,rate:row.actualRate.toFixed(0),filterMs:row.filterMs.toFixed(1),main:row.mainThreadBusyPct.toFixed(1),cpu:row.browserCPUCorePct.toFixed(1),lagP95:row.lagP95Ms.toFixed(1)}));
        }finally{await page.close();}
      }
    }
  }finally{if(browser)await browser.close();await closeServer(server.server);fs.writeFileSync(output,JSON.stringify(result,null,2));}
  console.log('Saved '+output);
})().catch(error=>{console.error(error);process.exitCode=1;});
