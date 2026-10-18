'use strict';
// Run with SSApp's Electron: electron tests/overlay-payload-safety.e2e.cjs [id-substring ...] [--shots]
// Sends hostile and ordinary payloads through each gallery overlay's real transports
// (VDO.Ninja iframe bridge, and a local WebSocket for &server), then checks that no
// payload field ran script, escaped its attribute, or broke rendering.
const {app,BrowserWindow,session}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const root=path.resolve(__dirname,'..');
const {WebSocketServer}=require(require.resolve('ws',{paths:[process.env.SSAPP_REPO||path.resolve(root,'../ssapp'),root]}));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/data/overlay-gallery.json'),'utf8'));
const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const shots=process.argv.includes('--shots');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'ssn-payload-safety-'));
app.setPath('userData',path.join(output,'profile'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Every hostile value records a numbered hit if it ever executes.
const hit=n=>'(top.__x=top.__x||[]).push('+n+')';
const labels={};
const mark=(n,label)=>{labels[n]=label;return hit(n);};
let base;
function payloads() {
  const asset=p=>base+p;
  const avatar=asset('/media/user1.jpg');
  const ordinary=[
    {id:'r1',chatname:'Maple',chatmessage:'Literal <b>tags</b> & 5 < 6 stay text',textonly:true,type:'twitch',chatimg:avatar,firsttime:true},
    {id:'r2',chatname:'Juniper',chatmessage:'Formatted <b>bold</b> emote <img class="emote" src="'+asset('/icons/bot.png')+'">',textonly:false,type:'youtube',chatimg:avatar,nameColor:'#ff4fa3',chatbadges:[asset('/icons/announcement.png'),{type:'text',text:'VIP',rawText:'VIP'}],firsttime:true},
    {id:'r3',chatname:'River',chatmessage:'Thanks for the stream!',textonly:true,type:'kick',chatimg:avatar,hasDonation:'$25.00',donoValue:25,firsttime:true},
    {id:'r4',chatname:'Luna',chatmessage:'Glad to be here',textonly:true,type:'youtube',membership:'Member',subtitle:'12 months',firsttime:true},
    {id:'r5',chatname:'Robin',chatmessage:'Look at this',textonly:true,type:'twitch',chatimg:avatar,contentimg:asset('/media/customization.png'),firsttime:true},
    {id:'r6',chatname:'Maple with a much longer display name here',chatmessage:'مرحبا بالجميع and a long message that should wrap neatly across several lines without overflowing the card edges at all.',textonly:true,type:'tiktok',firsttime:true}
  ];
  const hostile=[
    {id:'h1',chatname:'Maple<img src=x onerror="'+mark(1,'chatname')+'">',chatmessage:'name test',textonly:true,type:'twitch',firsttime:true},
    {id:'h2',chatname:'Juniper',chatmessage:'<img src=x onerror="'+mark(2,'chatmessage img onerror')+'"><svg onload="'+mark(3,'chatmessage svg onload')+'"></svg><a href="javascript:'+mark(4,'chatmessage javascript href')+'">link</a><iframe srcdoc="<script>'+mark(5,'chatmessage iframe srcdoc')+'</script>"></iframe><script>'+mark(6,'chatmessage script')+'</script>html test',textonly:false,type:'youtube',firsttime:true},
    {id:'h3',chatname:'River',chatmessage:'<img src=x onerror="'+mark(7,'textonly body')+'"> literal',textonly:true,type:'kick',firsttime:true},
    {id:'h4',chatname:'Luna',chatmessage:'fields test',textonly:true,type:'twitch',membership:'<img src=x onerror="'+mark(8,'membership')+'">',subtitle:'<img src=x onerror="'+mark(9,'subtitle')+'">',hasDonation:'<img src=x onerror="'+mark(10,'hasDonation')+'">$5',firsttime:true},
    {id:'h5',chatname:'Robin',chatmessage:'color test',textonly:true,type:'twitch',nameColor:'red;background-image:url(http://evil.test/namecolor-css)',firsttime:true},
    {id:'h6',chatname:'Maple',chatmessage:'color test 2',textonly:true,type:'twitch',nameColor:'"><img src=x onerror="'+mark(11,'nameColor')+'">',firsttime:true},
    {id:'h7',chatname:'Juniper',chatmessage:'avatar test',textonly:true,type:'youtube',chatimg:'x" onerror="'+mark(12,'chatimg double quote')+'" a="',firsttime:true},
    {id:'h8',chatname:'River',chatmessage:'avatar test 2',textonly:true,type:'kick',chatimg:"x' onerror='"+mark(13,'chatimg single quote')+"' a='",firsttime:true},
    {id:'h9',chatname:'Luna',chatmessage:'avatar test 3',textonly:true,type:'twitch',chatimg:"http://evil.test/a.png'); background-image:url(http://evil.test/chatimg-css",firsttime:true},
    {id:'h10',chatname:'Robin',chatmessage:'media test',textonly:true,type:'twitch',contentimg:"x' onerror='"+mark(14,'contentimg single quote')+"' a='",firsttime:true},
    {id:'h11',chatname:'Maple',chatmessage:'media test 2',textonly:true,type:'twitch',contentimg:'x" onerror="'+mark(15,'contentimg double quote')+'" a="',firsttime:true},
    {id:'h12',chatname:'Juniper',chatmessage:'media test 3',textonly:true,type:'twitch',contentimg:'javascript:'+mark(16,'contentimg javascript url'),firsttime:true},
    {id:'h13',chatname:'River',chatmessage:'type test',textonly:true,type:'twitch"><img src=x onerror="'+mark(17,'type')+'">',firsttime:true},
    {id:'h14',chatname:'Luna',chatmessage:'badge test',textonly:true,type:'twitch',chatbadges:[{type:'svg',html:'<svg onload="'+mark(18,'badge svg')+'"></svg>'},{type:'img',src:'x" onerror="'+mark(19,'badge img src')+'" a="'},{type:'text',text:'<img src=x onerror="'+mark(20,'badge text')+'">'},'x" onerror="'+mark(21,'badge string')+'" a="'],firsttime:true},
    {id:'h15',chatname:'Robin',chatmessage:'event test',textonly:true,type:'twitch',event:'<img src=x onerror="'+mark(22,'event')+'">',firsttime:true},
    {id:'h16',chatname:'Maple',chatmessage:'legacy donation',textonly:true,type:'twitch',donation:'<img src=x onerror="'+mark(23,'donation')+'">',firsttime:true},
    // Single-quoted attributes need their own break-out attempts.
    {id:'h17',chatname:'Juniper',chatmessage:'color test 3',textonly:true,type:'twitch',nameColor:"red' onclick='"+mark(24,'nameColor single quote')+"' a='",firsttime:true},
    {id:'h18',chatname:'River',chatmessage:'type test 2',textonly:true,type:"twitch' onerror='"+mark(25,'type single quote')+"' a='",firsttime:true},
    {id:'h19',chatname:'Luna',chatmessage:'media test 4',textonly:true,type:'twitch',contentimg:"https://evil.test/x.png' onerror='"+mark(26,'contentimg url single quote')+"' a='",chatimg:'https://evil.test/y.png" onerror="'+mark(27,'chatimg url double quote')+'" a="',firsttime:true},
    {id:'h20',chatname:"Robin' onmouseover='"+mark(28,'chatname single quote')+"' a='",chatmessage:'name test 2',textonly:true,type:'twitch',membership:"x' onclick='"+mark(29,'membership single quote')+"' a='",firsttime:true}
  ];
  return {ordinary,hostile};
}

function kindOf(entry) {
  const page=entry.path.split('?')[0];
  if(page==='multi-alerts.html')return 'multialerts';
  if(entry.category==='featured')return 'featured';
  if(entry.category==='widgets')return 'widget';
  return 'chat';
}

let current=new Map();
const blocked=new Map();
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/bridge') {
    const job=current.get(url.searchParams.get('job'))||{feed:[],gap:400};
    res.setHeader('Content-Type','text/html');
    // Escape "<" so hostile "</script>" text cannot end the bridge's own script.
    return res.end('<script>var feed='+JSON.stringify(job.feed).replace(/</g,'\\u003c')+';feed.forEach(function(data,i){setTimeout(function(){parent.postMessage({dataReceived:{overlayNinja:data}},"*");},400+i*'+job.gap+');});</script>');
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

// Collect the evidence: executed canaries, live handlers or javascript: URLs in rendered
// payload markup, and attempts to reach the hostile host.
const auditScript=`(() => {
  const found=[];
  const all=document.querySelectorAll('*');
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      const name=attr.name.toLowerCase(), value=String(attr.value);
      // Case-insensitive: some pages upper-case fields, which breaks the canary but not the injection.
      if (name.startsWith('on') && value.toLowerCase().indexOf('__x')!==-1) found.push('handler '+el.tagName+' '+name);
      if ((name==='href'||name==='src'||name==='xlink:href'||name==='action'||name==='formaction') && /^\\s*javascript:/i.test(value)) found.push('javascript url '+el.tagName+' '+name);
      if (name==='srcdoc') found.push('srcdoc '+el.tagName);
    }
    if (el.tagName==='SCRIPT' && el.textContent.toLowerCase().indexOf('__x')!==-1) found.push('script element');
  }
  return {hits:(top.__x||[]).slice(), dom:found, text:document.body?document.body.innerText:''};
})()`;

async function runJob(entry,mode,only) {
  const kind=kindOf(entry);
  const {ordinary,hostile}=payloads();
  const list=only?ordinary.filter(p=>p.id===only):mode==='hostile'?hostile:ordinary;
  const job=String(Math.random()).slice(2);
  // Featured overlays show one message at a time; give each time to render.
  const gap=kind==='featured'?900:350;
  current.set(job,{feed:kind==='multialerts'?[]:list,gap});
  const win=new BrowserWindow({show:false,useContentSize:true,width:entry.width||960,height:entry.height||720,backgroundColor:'#172131',webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  win.webContents.on('console-message',()=>{});
  blocked.set(win.webContents.id,{job,evil:[]});
  try {
    const url=new URL('/'+entry.path,base);
    url.searchParams.set('session','payload-safety');
    url.searchParams.set('showtime','120000');
    if(kind==='multialerts')url.searchParams.set('previewonly','');
    await win.loadURL(url.href);
    if(kind==='multialerts') {
      for(const data of list){await win.webContents.executeJavaScript('window.__multiAlertsOverlay.sendPayload('+JSON.stringify({...data,event:data.event||'superchat',hasDonation:data.hasDonation||'$10.00'})+')').catch(()=>{});await delay(250);}
    }
    await delay(800+list.length*gap+(kind==='featured'?600:1200));
    const frames=win.webContents.mainFrame.framesInSubtree;
    const result={hits:[],dom:[],text:''};
    for(const frame of frames) {
      if(frame.url.indexOf('/bridge')!==-1)continue;
      try {const r=await frame.executeJavaScript(auditScript);result.hits.push(...r.hits);result.dom.push(...r.dom);if(frame===win.webContents.mainFrame)result.text=r.text;} catch(e) {}
    }
    result.evil=blocked.get(win.webContents.id).evil;
    if(shots||mode==='ordinary') {
      const file=path.join(output,entry.id+'-'+(only||mode)+'.png');
      fs.writeFileSync(file,(await win.webContents.capturePage()).toPNG());
      result.shot=file;
    }
    return result;
  } finally {current.delete(job);blocked.delete(win.webContents.id);win.destroy();}
}

// Server mode: the same message over WebSocket and the bridge must render once.
async function runServerJob(entry,wss,port) {
  const job=String(Math.random()).slice(2);
  const message={id:'srv-1',chatname:'Maple',chatmessage:'Delivered over both transports',textonly:true,type:'twitch',firsttime:true};
  current.set(job,{feed:[message],gap:300});
  wss.nextFeed=[message];
  const win=new BrowserWindow({show:false,useContentSize:true,width:entry.width||960,height:entry.height||720,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true}});
  blocked.set(win.webContents.id,{job,evil:[]});
  try {
    const url=new URL('/'+entry.path,base);
    url.searchParams.set('session','payload-safety');
    url.searchParams.set('server','ws://127.0.0.1:'+port);
    url.searchParams.set('showtime','120000');
    await win.loadURL(url.href);
    await delay(3000);
    const count=await win.webContents.executeJavaScript('(document.body.innerText.match(/Delivered over both transports/g)||[]).length');
    return {count,joined:wss.joined.splice(0)};
  } finally {current.delete(job);blocked.delete(win.webContents.id);win.destroy();}
}

app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
  const wss=new WebSocketServer({port:0,host:'127.0.0.1'});
  await new Promise(resolve=>wss.on('listening',resolve));
  wss.joined=[];wss.nextFeed=[];
  wss.on('connection',socket=>socket.on('message',raw=>{
    let data;try{data=JSON.parse(String(raw));}catch(e){return;}
    if(data.join){wss.joined.push(data);const feed=wss.nextFeed;setTimeout(()=>feed.forEach(m=>socket.send(JSON.stringify(m))),500);}
  }));
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
    if(details.url.startsWith(base)||/^(data|about|blob|ws):/.test(details.url))return callback({});
    const url=new URL(details.url);
    const record=blocked.get(details.webContentsId);
    if(url.hostname==='evil.test'){if(record)record.evil.push(url.pathname);return callback({cancel:true});}
    if((url.hostname==='vdo.socialstream.ninja'||url.hostname==='vdo.ninja')&&record)return callback({redirectURL:base+'/bridge?job='+record.job});
    if(url.hostname==='socialstream.ninja') {
      const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(target.startsWith(root+path.sep)&&fs.existsSync(target))return callback({redirectURL:base+url.pathname+url.search});
    }
    callback({cancel:true});
  });
  const extra=[
    {id:'vertical-chat-light',path:'themes/vertical-chat.html?light',category:'chat',width:540,height:960},
    {id:'vertical-chat-lunar',path:'themes/vertical-chat.html?style=lunar',category:'chat',width:540,height:960},
    {id:'first-chatters-spring',path:'themes/first-chatters.html?style=spring',category:'alerts'},
    // Chat-driven pages outside the gallery.
    ...['baretempate.html','cohost-overlay.html','content.html','emotes.html','gif.html','reactions.html','septapus.html','map.html'].map(p=>({id:'page-'+p.replace(/\W+/g,'-'),path:p,category:'chat'}))
  ];
  const entries=catalog.concat(extra).filter(e=>!args.length||args.some(a=>e.id.includes(a)||e.path.includes(a)));
  const report=[];
  for(let i=0;i<entries.length;i+=3) {
    await Promise.all(entries.slice(i,i+3).map(async entry=>{
      const row={id:entry.id,path:entry.path,kind:kindOf(entry)};
      try {
        const hostile=await runJob(entry,'hostile');
        row.hits=[...new Set(hostile.hits)].map(n=>labels[n]||n);
        row.dom=[...new Set(hostile.dom)];
        row.evil=[...new Set(hostile.evil)];
        const ordinary=await runJob(entry,'ordinary');
        row.shot=ordinary.shot;
        row.textonlyLiteral=/Literal <b>tags<\/b> & 5 < 6/.test(ordinary.text);
        row.ordinaryEvil=ordinary.evil;
        // One-at-a-time overlays (featured, welcome cards, alerts) get a capture per scenario.
        if(process.argv.includes('--scenarios')&&row.kind!=='chat'||process.argv.includes('--scenarios')&&/first-chatters/.test(entry.path)) {
          for(const id of ['r1','r2','r3','r4','r5','r6'])await runJob(entry,'ordinary',id);
        }
      } catch(error) {row.error=error.message;}
      report.push(row);
      // A request for a bare marker path means CSS escaped its declaration; a remote avatar
      // URL that merely contains the text is an ordinary image load.
      row.cssEscape=(row.evil||[]).filter(p=>p==='/namecolor-css'||p==='/chatimg-css');
      const bad=(row.hits&&row.hits.length)||(row.dom&&row.dom.length)||row.cssEscape.length||row.error;
      console.log((bad?'FAIL ':'ok   ')+row.id+(row.hits&&row.hits.length?' hits='+row.hits.join('|'):'')+(row.dom&&row.dom.length?' dom='+row.dom.join('|'):'')+(row.cssEscape&&row.cssEscape.length?' css-escape='+row.cssEscape.join('|'):'')+(row.error?' error='+row.error:''));
    }));
  }
  const serverTargets=entries.filter(e=>/vertical-chat\.html$|first-chatters\.html$|compact-clean\.html$/.test(e.path.split('?')[0])&&!e.path.includes('?'));
  for(const entry of serverTargets) {
    const r=await runServerJob(entry,wss,wss.address().port);
    console.log((r.count===1&&r.joined.length?'ok   ':'FAIL ')+'server '+entry.id+' rendered='+r.count+' joined='+JSON.stringify(r.joined[0]||null));
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('Report: '+path.join(output,'report.json'));
  wss.close();server.close();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
