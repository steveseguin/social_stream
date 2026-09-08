(function(){
'use strict';
var params=new URLSearchParams(location.search),mode=document.body.dataset.game,game=new SSNOverlayGame.Game(mode),demo=params.has('demo'),paused=false;
var canvas=document.getElementById('playfield'),ctx=canvas.getContext('2d'),connection=document.getElementById('connection'),result=document.getElementById('result'),images=new Map(),last=performance.now(),lastDraw=0;
function resize(){if(mode!=='maze'){canvas.width=Math.min(1600,window.innerWidth);return;}var scale=Math.min(1,640/window.innerWidth,480/window.innerHeight);canvas.width=Math.max(1,Math.round(window.innerWidth*scale));canvas.height=Math.max(1,Math.round(window.innerHeight*scale));}
window.addEventListener('resize',resize);resize();
if(demo)document.body.classList.add('demo');if(params.has('clean')){document.getElementById('controls').hidden=true;connection.hidden=true;}if(params.has('fullscreen'))document.body.classList.add('fullscreen');
if(params.has('chroma'))document.body.classList.add('chroma');
function receive(payload){if(paused)return;var batch=Array.isArray(payload)?payload.slice(0,100):[payload];batch.forEach(function(m){if(m&&m.content)m=m.content;if(!m||typeof m.chatmessage!=='string'||m.chatmessage.length>2000)return;var copy=Object.assign({},m);if(!copy.textonly){var t=document.createElement('template');t.innerHTML=copy.chatmessage;copy.chatmessage=t.content.textContent||'';}if(game.input(copy)&&!demo)connection.textContent='Chat connected';});}
function text(value,x,y,size,color,align){ctx.font='600 '+size+(mode==='maze'?'px monospace':'px system-ui, sans-serif');ctx.textAlign=align||'left';ctx.fillStyle=color||'#fff';ctx.fillText(value,x,y);}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function star(x,y,r,color){ctx.beginPath();for(var i=0;i<10;i++){var a=i*Math.PI/5-Math.PI/2,d=i%2?r*0.45:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function drawAmbient(){var w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);var left=w*0.13,right=w*0.87,width=right-left;
 if(mode==='catch'){
  var t=game.phase==='waiting'?0:game.time%8,ready=t>=3&&t<=5,x=left+width*t/8,y=110-Math.sin(t/8*Math.PI)*42;
  ctx.strokeStyle='#b3ddd366';ctx.lineWidth=2;ctx.setLineDash([3,8]);ctx.beginPath();ctx.moveTo(left,110);ctx.lineTo(right,110);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=ready?'#ceffa8':'#cce2db';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(w/2,100,Math.max(30,width/8),42,0,0,Math.PI*2);ctx.stroke();
  var glow=ctx.createRadialGradient(x,y,0,x,y,35);glow.addColorStop(0,'#f3ffd6cc');glow.addColorStop(1,'#d5ff8c00');ctx.fillStyle=glow;ctx.fillRect(x-35,y-35,70,70);star(x,y,12,'#edffc7');
  text(game.phase==='waiting'?'Type !catch to wake the fireflies':ready?'CATCH NOW!':'Wait for the ring...',w/2,174,w<600?13:18,ready?'#dcffb2':'#eef8f3','center');
  game.effects.forEach(function(e,i){var age=game.time-e.at;text(e.name.slice(0,14)+(e.score?' +'+e.score:' - too early / late'),left+(i%4)*width/4,135-age*20,12,e.score?'#e2ffc1':'#c2c8cf');});
 }else{
  ['#ffa3a3','#9deedc'].forEach(function(color,team){var y=65+team*70,progress=game.points[team]/20,x=left+width*progress;ctx.fillStyle='#18263899';roundRect(left,y-5,width,10,5);ctx.fill();var glow=ctx.createLinearGradient(Math.max(left,x-100),0,x+1,0);glow.addColorStop(0,color+'00');glow.addColorStop(1,color);ctx.fillStyle=glow;ctx.fillRect(Math.max(left,x-100),y-4,Math.min(100,x-left),8);star(x,y,18,color);text(team?'MINT':'CORAL',left,y-24,12,color);text(game.points[team]+' / 20',right,y-24,12,color,'right');});
  ctx.strokeStyle='#e8f1ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(right+18,36);ctx.lineTo(right+18,155);ctx.stroke();text('Type !boost - Your first boost assigns your team',w/2,188,w<600?10:16,'#f4f7ff','center');
  game.effects.forEach(function(e,i){text(e.name.slice(0,14)+' +1',left+(i%5)*width/5,65+e.team*70-(game.time-e.at)*15,12,e.team?'#9deedc':'#ffa3a3');});
 }
}
// Six tiny cached pixel textures; no downloaded artwork or per-frame texture creation.
var mazeTextures=mode==='maze'?makeMazeTextures():[];
function makeMazeTextures(){
 var textures=[];
 for(var kind=0;kind<6;kind++){
  var tile=document.createElement('canvas');tile.width=tile.height=64;var t=tile.getContext('2d');
  var brick=kind===0||kind===1||kind===4;
  t.fillStyle=brick?'#25272a':'#354351';t.fillRect(0,0,64,64);
  for(var y=0;y<64;y+=brick?16:32)for(var x=-16;x<64;x+=32){
   var xx=x+(brick&&(y/16)%2?16:0),colors=kind===0?['#986447','#80553e','#ab7851']:kind===1?['#637e9c','#536983','#7b93a6']:['#747875','#5c6467','#8b918b'];
   t.fillStyle=colors[(Math.abs(x+y)/16)%3|0];t.fillRect(xx+1,y+1,30,brick?14:30);
   t.fillStyle='#ffffff20';t.fillRect(xx+1,y+1,30,1);t.fillStyle='#00000038';t.fillRect(xx+1,y+(brick?14:30),30,1);
  }
  if(!brick){for(var n=4;n<64;n+=28){t.fillStyle='#151e28';t.fillRect(n,4,3,3);t.fillRect(n,57,3,3);}}
  if(kind===2||kind===4){t.fillStyle='#18273f';t.fillRect(5,14,54,35);t.strokeStyle='#d8ba65';t.strokeRect(5.5,14.5,53,34);t.fillStyle='#ffe1a0';t.font='bold 17px monospace';t.textAlign='center';t.fillText('SSN',32,33);t.font='bold 6px monospace';t.fillText(kind===2?'NINJA BASE':'CHAT RAID',32,43);}
  if(kind===3){t.fillStyle='#192633';t.fillRect(12,12,40,40);for(var slat=17;slat<49;slat+=5){t.fillStyle='#070f19';t.fillRect(16,slat,32,2);t.fillStyle='#94aaa2';t.fillRect(16,slat+2,32,1);}}
  if(kind===5){t.fillStyle='#1e252b';t.fillRect(0,44,64,12);for(var stripe=-12;stripe<64;stripe+=16){t.fillStyle='#dab753';t.beginPath();t.moveTo(stripe,56);t.lineTo(stripe+12,44);t.lineTo(stripe+20,44);t.lineTo(stripe+8,56);t.fill();}t.fillStyle='#97e1bd';t.fillRect(12,13,40,5);t.fillStyle='#fff';t.fillRect(15,14,34,1);}
  textures.push(tile);
 }
 return textures;
}
function makeRaiderSprite(enemy,record){
 var sprite=document.createElement('canvas');sprite.width=64;sprite.height=80;var t=sprite.getContext('2d');t.imageSmoothingEnabled=false;
 var armor=enemy.color?'#74aa94':'#ad7957';
 t.fillStyle='#172130';t.fillRect(8,68,18,12);t.fillRect(38,68,18,12);t.fillRect(3,40,58,24);
 t.fillStyle=armor;t.fillRect(9,39,46,30);t.fillRect(0,44,10,17);t.fillRect(54,44,10,17);
 t.fillStyle='#ced5c4';t.fillRect(12,0,40,43);t.fillStyle='#162537';t.fillRect(15,4,34,34);
 if(record.ready)t.drawImage(record.img,15,4,34,34);else{t.fillStyle='#d6f2c2';t.font='bold 18px monospace';t.textAlign='center';t.fillText(enemy.name.slice(0,2).toUpperCase(),32,28);}
 t.fillStyle='#273747';t.fillRect(21,46,22,13);t.fillStyle='#f5cf68';t.fillRect(25,49,4,4);t.fillRect(35,49,4,4);
 return sprite;
}
function drawMaze(){
 var w=canvas.width,h=canvas.height,p=game.explorer,map=game.map,fov=2*Math.atan(w/(h*1.6)),rays=320,strip=w/rays,z=[];
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#252338';ctx.fillRect(0,0,w,h/2);ctx.fillStyle='#454343';ctx.fillRect(0,h/2,w,h/2);
 var plane=Math.tan(fov/2),fx=Math.cos(p.angle),fy=Math.sin(p.angle);
 for(var row=h/2+3;row<h;row+=3){
  var depth=h*.4/(row-h/2),shade=Math.max(.2,1/(1+depth*.14));
  for(var column=0;column<w;column+=4){var across=(column/w*2-1)*plane;
   var wx=p.x+depth*(fx-fy*across),wy=p.y+depth*(fy+fx*across),tile=(Math.floor(wx*2)+Math.floor(wy*2))&1;
   var c=Math.floor((tile?103:70)*shade);ctx.fillStyle='rgb('+c+','+c+','+Math.floor(c*.94)+')';ctx.fillRect(column,row,4,3);
  }
 }
 for(var i=0;i<rays;i++){
  var angle=p.angle+Math.atan((i/rays*2-1)*Math.tan(fov/2)),dx=Math.cos(angle),dy=Math.sin(angle),mx=Math.floor(p.x),my=Math.floor(p.y),ddx=Math.abs(1/dx),ddy=Math.abs(1/dy),sx=dx<0?-1:1,sy=dy<0?-1:1,tx=(dx<0?p.x-mx:mx+1-p.x)*ddx,ty=(dy<0?p.y-my:my+1-p.y)*ddy,side=0;
  for(var k=0;k<40;k++){if(tx<ty){tx+=ddx;mx+=sx;side=0;}else{ty+=ddy;my+=sy;side=1;}if(!map[my]||map[my][mx]!==0)break;}
  var raw=side?ty-ddy:tx-ddx,dist=Math.max(0.05,raw*Math.cos(angle-p.angle)),wall=h*0.8/dist,top=(h-wall)/2,hit=side?p.x+raw*dx:p.y+raw*dy,u=hit-Math.floor(hit),light=Math.max(0.16,1/(1+dist*0.17))*(side?0.74:1),panel=(mx+my)%4===0;
  z[i]=dist;
  var texture=mazeTextures[Math.abs(mx*3+my*7)%mazeTextures.length],column=Math.min(63,Math.floor(u*64));
  if((!side&&dx<0)||(side&&dy>0))column=63-column;
  ctx.drawImage(texture,column,0,1,64,i*strip,top,strip+1,wall);
  ctx.fillStyle='rgba(0,0,0,'+(1-light)+')';ctx.fillRect(i*strip,top,strip+1,wall);

 }
 // Paint far enemies first, and clip every sprite strip against the wall depth.
 var sprites=game.enemies.map(function(e){var dx=e.x-p.x,dy=e.y-p.y;return {e:e,forward:dx*Math.cos(p.angle)+dy*Math.sin(p.angle),across:-dx*Math.sin(p.angle)+dy*Math.cos(p.angle)};}).filter(function(s){return s.forward>0.1;}).sort(function(a,b){return b.forward-a.forward;});
 var labels=[];
 sprites.forEach(function(s){var e=s.e,projection=w/(2*Math.tan(fov/2)),size=Math.min(h*0.48,h*0.48/s.forward),x=w/2+s.across/s.forward*projection-size/2,y=h/2+Math.min(h*.43,h*.4/s.forward)-size*1.25,record=images.get(e.key);
  if(!record){record={img:null,ready:false};record.sprite=makeRaiderSprite(e,record);images.set(e.key,record);if(e.avatar){var img=new Image();img.referrerPolicy='no-referrer';img.onload=function(){record.ready=img.naturalWidth>0;record.sprite=makeRaiderSprite(e,record);};img.onerror=function(){record.ready=false;};img.src=e.avatar;record.img=img;}}
  if(x>w||x+size<0)return;var visible=false;
  for(var col=Math.max(0,Math.floor(x/strip));col<Math.min(rays,Math.ceil((x+size)/strip));col++){if(s.forward>=z[col])continue;visible=true;ctx.save();ctx.beginPath();ctx.rect(col*strip,0,strip+0.5,h);ctx.clip();
   ctx.drawImage(record.sprite,x,y,size,size*1.25);
   ctx.restore();}
  if(visible&&s.forward<7)labels.push({name:e.name,x:x+size/2,y:Math.max(42,y-9),size:Math.max(10,Math.min(18,size*.16))});
 });
 // Nearest names take priority; overlapping raiders must not stack unreadable labels.
 var occupied=[];labels.reverse().forEach(function(label){
  ctx.font='600 '+label.size+'px monospace';var width=ctx.measureText(label.name).width;
  var box={left:label.x-width/2,right:label.x+width/2,top:label.y-label.size,bottom:label.y+3};
  if(occupied.some(function(b){return box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top;}))return;
  occupied.push(box);text(label.name,label.x,label.y,label.size,'#fff','center');
 });
 var shade=ctx.createRadialGradient(w/2,h/2,h*0.2,w/2,h/2,w*0.65);shade.addColorStop(0,'#0000');shade.addColorStop(1,'#03081744');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
 if(game.hitFlash){ctx.fillStyle='rgba(244,83,104,'+(game.hitFlash*1.1)+')';ctx.fillRect(0,0,w,h);}
 // Original retro explorer visor, with a quiet compass and floor-level movement cue.
 ctx.strokeStyle='#b7e2d766';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w/2-6,h/2);ctx.lineTo(w/2+6,h/2);ctx.moveTo(w/2,h/2-6);ctx.lineTo(w/2,h/2+6);ctx.stroke();
 var heading=((p.angle*180/Math.PI)%360+360)%360;text(['E','S','W','N'][Math.round(heading/90)%4]+' / '+Math.round(heading)+'\u00b0',w/2,(window.innerWidth<600?56:24),12,'#c0d8d6','center');
}
function render(){document.body.dataset.phase=game.phase;document.getElementById('round').textContent='Round '+game.round;document.getElementById('players').textContent=game.users.size+(mode==='maze'?' raiders':' players');
 document.getElementById('meter').textContent=paused?'Paused':mode==='maze'?game.hp+' HP':game.phase==='waiting'?'Starts with chat':mode==='catch'?'Flight '+Math.min(6,game.flight+1)+' / 6':Math.max(0,Math.ceil(60-game.time))+'s';
 result.hidden=game.phase!=='result';result.textContent=game.result+(game.phase==='result'?' - Next round in '+Math.max(0,Math.ceil(game.endAt-game.time))+'s':'');
 if(mode==='maze'){document.getElementById('health').style.width=game.hp+'%';drawMaze();}else drawAmbient();
 if(images.size&&!game.enemies.length)images.clear();
}
document.getElementById('pause').onclick=function(){paused=!paused;this.textContent=paused?'Resume':'Pause';render();};document.getElementById('restart').onclick=function(){game.begin();images.clear();render();};
function frame(now){var dt=(now-last)/1000;last=now;if(!paused)game.tick(dt);if(now-lastDraw>=33){render();lastDraw=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);render();
if(demo){connection.textContent='Preview - simulated chat';var n=0;setInterval(function(){n++;receive({id:'demo-'+n,type:'demo',chatname:['Nova','Milo','Juniper','River','Ava','CosmicCat'][n%6],chatmessage:mode==='maze'?'Hello maze!':mode==='catch'?'!catch':'!boost',textonly:true});},mode==='catch'?650:1500);return;}
var session=params.get('session')||params.get('room')||params.get('s')||params.get('id');if(!session){connection.textContent='Add your SSN session to connect';return;}
if(params.has('server')){var endpoint=params.get('server')||'wss://io.socialstream.ninja',socket,retry,closed=false;try{var parsed=new URL(endpoint);if(parsed.protocol!=='ws:'&&parsed.protocol!=='wss:')throw new Error();}catch(_){connection.textContent='Invalid relay address';return;}
 function connect(){if(closed)return;connection.textContent='Connecting to chat';try{socket=new WebSocket(endpoint);}catch(_){connection.textContent='Could not connect';return;}socket.onopen=function(){socket.send(JSON.stringify({join:session.split(',')[0],out:2,in:1}));connection.textContent='Relay connected - waiting for chat';};socket.onmessage=function(event){if(typeof event.data!=='string'||event.data.length>256000)return;try{receive(JSON.parse(event.data));}catch(_){}};socket.onerror=function(){socket.close();};socket.onclose=function(){if(!closed){connection.textContent='Reconnecting';retry=setTimeout(connect,5000);}};}
 window.addEventListener('beforeunload',function(){closed=true;clearTimeout(retry);if(socket)socket.close();});connect();return;
}
var bridge=document.createElement('iframe');bridge.title='SSN chat connection';bridge.style.cssText='position:fixed;width:0;height:0;border:0;left:-100px;top:-100px';bridge.src='https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password='+encodeURIComponent(params.get('password')||'false')+'&solo&view='+encodeURIComponent(session)+'&novideo&noaudio&label=dock&cleanoutput&room='+encodeURIComponent(session);
window.addEventListener('message',function(event){if(event.source!==bridge.contentWindow)return;var data=event.data&&event.data.dataReceived;if(data&&data.overlayNinja)receive(data.overlayNinja);});document.body.appendChild(bridge);
})();
