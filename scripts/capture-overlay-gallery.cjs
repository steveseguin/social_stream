'use strict';
// Run with ssapp's Electron binary. All traffic stays local; screenshots use fictional chat.
const {app,BrowserWindow,session} = require('electron');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/data/overlay-gallery.json'),'utf8'));
const output=path.join(root,'docs/images/overlay-gallery');
fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'ssn-gallery-profile-')));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const active=new Map();
const avatar=(color,letter)=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="${color}"/><text x="40" y="53" text-anchor="middle" fill="white" font-family="Arial" font-size="38">${letter}</text></svg>`).toString('base64');
const names=['Maple','Juniper','River','Luna','Robin'];
const lines=['Hello everyone! Lovely to be here.','This is my favorite part of the stream.','That was incredible. One more round?','Thanks for making this such a welcoming place!','Good music, great company. Let\'s go!'];
const fixtures=names.map((name,i)=>({id:'gallery-'+i,chatname:name,chatmessage:lines[i],type:['twitch','youtube','kick','twitch','youtube'][i],textonly:true,chatbadges:[],chatimg:avatar(['#a252be','#387fba','#398d71','#b65378','#a67830'][i],name[0])}));
let base;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/bridge') {
    const featured=url.searchParams.get('category')==='featured';
    const payloads=featured?[fixtures[1]]:url.searchParams.get('category')==='alerts'?[{...fixtures[1],event:'superchat',hasDonation:'$10.00'}]:fixtures;
    res.setHeader('Content-Type','text/html');
    return res.end('<script>const fixtures='+JSON.stringify(payloads)+'; fixtures.forEach((data,i)=>setTimeout(()=>parent.postMessage({dataReceived:{overlayNinja:data}},"*"),300+i*500));</script>');
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function capture(entry) {
  const win=new BrowserWindow({show:false,useContentSize:true,width:entry.path==='themes/Neutron/stream.html'?1920:960,height:entry.path==='themes/Neutron/stream.html'?1080:640,backgroundColor:'#172131',webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  active.set(win.webContents.id,entry);
  try {
    const url=new URL('/'+entry.path,base);
    url.searchParams.set('session','gallery-preview-'+entry.category);
    url.searchParams.set('showtime','60000');
    if(entry.path.startsWith('multi-alerts'))url.searchParams.set('previewonly','');
    await win.loadURL(url.href);
    if(entry.path.indexOf('themes/Neutron/')===0) {
      // A fixed fixture clock keeps screenshots deterministic without loading the remote clock library.
      await win.webContents.executeJavaScript('window.dayjs=function(){return {format:function(){return "PM 10:42:00";}}}; void 0;');
    }
    if(entry.path.startsWith('multi-alerts')) {
      await win.webContents.executeJavaScript('window.__multiAlertsOverlay.sendPayload('+JSON.stringify({...fixtures[1],event:'superchat',hasDonation:'$10.00',donoValue:10,chatmessage:'Thanks for the wonderful stream!'})+')');
    } else if(entry.path==='themes/events/index.html') {
      await delay(800);
      await win.webContents.executeJavaScript('document.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({...fixtures[1],event:'superchat',hasDonation:'$10.00'})+',"*")');
    }
    await delay(entry.path.includes('typewriter')?7500:entry.category==='chat'?5500:3500);
    var text='';
    for(const frame of win.webContents.mainFrame.framesInSubtree) {
      try { text+=' '+await frame.executeJavaScript('document.body.innerText'); } catch(error) {}
    }
    if(!/Maple|Juniper|River|Luna|Robin/i.test(text))throw new Error('No fixture text rendered');
    fs.writeFileSync(path.join(output,entry.id+'.png'),(await win.webContents.capturePage()).toPNG());
    console.log('PASS '+entry.id);
    return null;
  } catch(error) {console.error('FAIL '+entry.id+': '+error.message);return {id:entry.id,error:error.message};}
  finally{active.delete(win.webContents.id);win.destroy();}
}
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
    if(details.url.startsWith(base)||/^(data|about):/.test(details.url))return callback({});
    const url=new URL(details.url);
    const entry=active.get(details.webContentsId);
    if(url.hostname==='vdo.socialstream.ninja'||url.hostname==='vdo.ninja')return callback({redirectURL:base+'/bridge?category='+encodeURIComponent(entry?entry.category:'chat')});
    if(url.hostname==='socialstream.ninja') {
      const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(target.startsWith(root+path.sep)&&fs.existsSync(target)&&fs.statSync(target).isFile())return callback({redirectURL:base+url.pathname+url.search});
    }
    callback({cancel:true});
  });
  const requested=process.argv.slice(2);
  const retry=requested.includes('--retry');
  const ids=retry?JSON.parse(fs.readFileSync(path.join(output,'capture-results.json'),'utf8')).failures.map(e=>e.id):requested;
  const entries=ids.length?catalog.filter(e=>ids.includes(e.id)):(retry?[]:catalog);
  const failures=[];
  for(let i=0;i<entries.length;i+=3) {
    const results=await Promise.all(entries.slice(i,i+3).map(capture));
    results.filter(Boolean).forEach(result=>failures.push(result));
  }
  fs.writeFileSync(path.join(output,'capture-results.json'),JSON.stringify({count:entries.length,failures},null,2));
  server.close();app.exit(failures.length?1:0);
}).catch(error=>{console.error(error);app.exit(1);});
