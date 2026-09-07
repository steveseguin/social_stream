// Original procedural effects and synthetic eSpeak phrases; no sampled recordings.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const {startStaticServer} = require('./playwright-static-server.cjs');
const output = path.resolve(__dirname, '../audio/alerts');
fs.mkdirSync(output, {recursive:true});
const rate=22050;
let seed=1729;
function noise(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;}
function write(name, length, render){
  const data=new Float64Array(Math.floor(length*rate));
  render(data);
  let peak=0; for(const value of data)peak=Math.max(peak,Math.abs(value));
  const buffer=Buffer.alloc(44+data.length*2);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(data.length*2,40);
  for(let i=0;i<data.length;i++){
    const fade=Math.min(1,i/100,(data.length-1-i)/200);
    buffer.writeInt16LE(Math.round(data[i]/Math.max(peak,1)*.7*fade*32767),44+i*2);
  }
  fs.writeFileSync(path.join(output,name+'.wav'),buffer);
}
function burst(data,start,duration,amp){
  for(let i=Math.floor(start*rate);i<Math.min(data.length,(start+duration)*rate);i++){
    const t=i/rate-start;data[i]+=noise()*Math.exp(-t/duration*7)*amp;
  }
}
write('applause',2.3,data=>{for(let j=0;j<105;j++)burst(data,.03+j*.019+Math.abs(noise())*.035,.11,.35+Math.abs(noise())*.35);});
write('drumroll',1.9,data=>{for(let t=0;t<1.65;t+=.035)burst(data,t,.07,.15+t*.4);burst(data,1.68,.22,1);});
write('whoosh',1,data=>{let low=0;for(let i=0;i<data.length;i++){const t=i/rate;low=low*.8+noise()*.2;data[i]=low*Math.pow(Math.sin(Math.PI*t),2)*2;}});
write('cash-register',1.5,data=>{burst(data,0,.09,.7);burst(data,.13,.07,.6);for(let i=Math.floor(.23*rate);i<data.length;i++){const t=i/rate-.23;data[i]+=(Math.sin(2*Math.PI*1800*t)+.4*Math.sin(2*Math.PI*2780*t))*Math.exp(-t*5)*.4;}});
write('boing',1.2,data=>{let phase=0;for(let i=0;i<data.length;i++){const t=i/rate;phase+=2*Math.PI*(180+480*Math.exp(-t*7)+35*Math.sin(t*35))/rate;data[i]=Math.sin(phase)*Math.exp(-t*4);}});
write('record-scratch',.8,data=>{let phase=0;for(let i=0;i<data.length;i++){const t=i/rate;phase+=2*Math.PI*(200+1400*Math.abs(Math.sin(t*10)))/rate;data[i]=(Math.sin(phase)*.6+noise()*.4)*Math.sin(Math.PI*t/.8);}});
write('pop',.2,data=>{for(let i=0;i<data.length;i++){const t=i/rate;data[i]=Math.sin(2*Math.PI*(700*t-1200*t*t))*Math.exp(-t*35);}});
write('camera',.45,data=>{burst(data,.01,.07,1);burst(data,.11,.04,.7);burst(data,.19,.14,.35);});
const phrases={'voice-thank-you':'Thank you!', 'voice-welcome':'Welcome to the stream!', 'voice-lets-go':"Let's go!", 'voice-hype-train':'All aboard the hype train!'};
(async()=>{
  let browser;
  const server=await startStaticServer({root:path.resolve(__dirname,'..'),port:4189});
  try{
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage();
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    await page.goto('http://127.0.0.1:4189/multi-alerts.html?preview');
    await page.addScriptTag({url:'/thirdparty/espeak-ng-real.js'});
    await page.evaluate(async()=>{window.generator=new RealESpeakTTS();await generator.init();});
    for(const [name,text]of Object.entries(phrases)){
      const bytes=await page.evaluate(async text=>Array.from(new Uint8Array(await generator.speak(text,{voice:'en',speed:155,pitch:48,amplitude:75}))),text);
      fs.writeFileSync(path.join(output,name+'.wav'),Buffer.from(bytes));
    }
    console.log('Generated eight original effects and four synthetic voice clips.');
  }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
