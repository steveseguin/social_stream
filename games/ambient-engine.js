(function(root){
'use strict';
function Game(mode,options){this.mode=mode;this.options=options||{};this.random=this.options.random||Math.random;this.round=0;this.begin();}
Game.prototype.begin=function(){this.round++;this.time=0;this.phase=this.mode==='maze'?'active':'waiting';this.result='';this.winner=null;this.endAt=0;this.users=new Map();this.seen=new Set();this.effects=[];this.points=[0,0];this.counts=[0,0];this.flight=0;this.hp=100;this.enemies=[];this.lastHit=-10;this.hitFlash=0;if(this.mode==='maze')this.makeMaze();};
Game.prototype.makeMaze=function(){
 var size=15,map=Array.from({length:size},function(){return Array(size).fill(1);}),stack=[[1,1]],dirs=[[2,0],[-2,0],[0,2],[0,-2]];map[1][1]=0;
 while(stack.length){var cell=stack[stack.length-1],choices=dirs.filter(function(d){var x=cell[0]+d[0],y=cell[1]+d[1];return x>0&&y>0&&x<size-1&&y<size-1&&map[y][x];});if(!choices.length){stack.pop();continue;}var d=choices[Math.floor(this.random()*choices.length)],x=cell[0]+d[0],y=cell[1]+d[1];map[cell[1]+d[1]/2][cell[0]+d[0]/2]=0;map[y][x]=0;stack.push([x,y]);}
 this.map=map;this.cells=[];for(var y=0;y<size;y++)for(var x=0;x<size;x++)if(!map[y][x])this.cells.push({x:x+0.5,y:y+0.5});
 this.explorer={x:1.5,y:1.5,angle:0,target:null,previous:null};this.visits={};this.visits['1,1']=1;this.pathAt=-1;this.distances=[];
};
Game.prototype.neighbors=function(x,y){var map=this.map;return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(function(c){return map[c[1]]&&map[c[1]][c[0]]===0;});};
Game.prototype.pathMap=function(){var p=this.explorer,x=Math.floor(p.x),y=Math.floor(p.y),dist=this.map.map(function(row){return row.map(function(){return 999;});}),queue=[[x,y]];dist[y][x]=0;for(var i=0;i<queue.length;i++){var c=queue[i];this.neighbors(c[0],c[1]).forEach(function(n){if(dist[n[1]][n[0]]===999){dist[n[1]][n[0]]=dist[c[1]][c[0]]+1;queue.push(n);}});}this.distances=dist;};
function move(actor,target,speed,dt){var dx=target.x-actor.x,dy=target.y-actor.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);if(d){actor.x+=dx/d*step;actor.y+=dy/d*step;}return d<=speed*dt+0.001;}
Game.prototype.walk=function(dt){
 var p=this.explorer,self=this;
 if(!p.target){var x=Math.floor(p.x),y=Math.floor(p.y),choices=this.neighbors(x,y);choices.sort(function(a,b){return (self.visits[a.join(',')]||0)-(self.visits[b.join(',')]||0);});var n=choices[0];p.target={x:n[0]+0.5,y:n[1]+0.5};this.visits[n.join(',')]=(this.visits[n.join(',')]||0)+1;}
 var looking=p.lookAt&&this.time<p.lookAt.until,look=looking?p.lookAt:p.target;
 var angle=Math.atan2(look.y-p.y,look.x-p.x),delta=Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle));p.angle+=Math.max(-dt*(looking?5:2),Math.min(dt*(looking?5:2),delta));
 if(!looking&&Math.abs(delta)<0.3&&move(p,p.target,0.72,dt))p.target=null;
 if(this.time-this.pathAt>0.4){this.pathMap();this.pathAt=this.time;}
 this.enemies.forEach(function(e){
  var distance=Math.hypot(e.x-p.x,e.y-p.y);
  if(distance<0.85&&Math.abs(Math.floor(e.x)-Math.floor(p.x))+Math.abs(Math.floor(e.y)-Math.floor(p.y))<=1){if(self.time-e.attackAt>=2.5&&self.time-self.lastHit>=0.35&&self.phase==='active'){e.attackAt=self.time;self.lastHit=self.time;self.hitFlash=0.25;p.lookAt={x:e.x,y:e.y,until:self.time+1.2};self.hp=Math.max(0,self.hp-5);if(!self.hp)self.finish(e.name+' conquered the maze!',e);}return;}
  if(!e.target){var ns=self.neighbors(Math.floor(e.x),Math.floor(e.y));ns.sort(function(a,b){return self.distances[a[1]][a[0]]-self.distances[b[1]][b[0]];});if(ns.length)e.target={x:ns[0][0]+0.5,y:ns[0][1]+0.5};}
  if(e.target&&move(e,e.target,1.12,dt))e.target=null;
 });
};
Game.prototype.finish=function(text,winner){if(this.phase==='result')return;this.phase='result';this.result=text;this.winner=winner?{name:winner.name,key:winner.key}:null;this.endAt=this.time+8;};
Game.prototype.input=function(m){
 if(!m||m.bot||m.private||m.reflection||m.event||typeof m.chatmessage!=='string'||!m.chatmessage.trim()||m.chatmessage.length>2000||typeof m.chatname!=='string'||!m.chatname.trim()||!m.type||this.phase==='result')return false;
 var command=m.chatmessage.trim().toLowerCase();if(this.mode==='catch'&&command!=='!catch'||this.mode==='rally'&&command!=='!boost')return false;
 var key=JSON.stringify([String(m.type).slice(0,40),String(m.userid||m.username||m.chatname).slice(0,200)]),id=m.id==null?null:JSON.stringify([m.type,String(m.id).slice(0,200)]);
 if(id&&this.seen.has(id))return false;var user=this.users.get(key);if(!user&&this.users.size>=1000)return false;
 if(user&&this.mode!=='catch'&&this.time-user.last<3)return false;
 if(this.mode==='maze'&&!user&&this.enemies.length>=40)return false;
 if(!user){user={key:key,name:m.chatname.slice(0,40),score:0,last:-10,flight:-1,team:this.counts[0]<=this.counts[1]?0:1};this.users.set(key,user);this.counts[user.team]++;}
 if(this.mode==='catch'&&user.flight===this.flight&&this.phase!=='waiting')return false;
 if(id){this.seen.add(id);if(this.seen.size>5000)this.seen.delete(this.seen.values().next().value);}
 if(this.phase==='waiting'){this.phase='active';this.time=0;}
 user.last=this.time;
 if(this.mode==='maze'){
  var existing=this.enemies.find(function(e){return e.key===key;});if(existing)return true;
  var p=this.explorer,choices=this.cells.filter(function(c){var d=Math.hypot(c.x-p.x,c.y-p.y);return d>=3&&d<=7;}),cell=choices[Math.floor(this.random()*choices.length)]||this.cells[this.cells.length-1];
  var avatar=typeof m.chatimg==='string'&&/^https?:\/\//i.test(m.chatimg)&&m.chatimg.length<2048?m.chatimg:'';
  this.enemies.push({key:key,name:user.name,x:cell.x,y:cell.y,target:null,attackAt:-10,avatar:avatar,color:user.team});
 }else if(this.mode==='rally'){
  this.points[user.team]++;this.effects.push({name:user.name,team:user.team,at:this.time});if(this.points[user.team]>=20)this.finish((user.team===0?'Coral':'Mint')+' comets win!',user);
 }else{
  user.flight=this.flight;var timing=this.time%8;var score=timing>=3&&timing<=5?(Math.abs(timing-4)<0.4?3:1):0;user.score+=score;this.effects.push({name:user.name,score:score,at:this.time});
 }
 if(this.effects.length>18)this.effects.shift();return true;
};
Game.prototype.tick=function(dt){dt=Math.max(0,Math.min(0.1,dt||0));if(this.phase==='waiting')return;this.time+=dt;this.hitFlash=Math.max(0,this.hitFlash-dt);
 if(this.phase==='result'){if(this.time>=this.endAt)this.begin();return;}
 if(this.mode==='maze')this.walk(dt);
 else if(this.mode==='rally'&&this.time>=60)this.finish(this.points[0]===this.points[1]?'The comets tied!':(this.points[0]>this.points[1]?'Coral':'Mint')+' comets win!');
 else if(this.mode==='catch'){this.flight=Math.floor(this.time/8);if(this.flight>=6){var best=null;this.users.forEach(function(u){if(!best||u.score>best.score)best=u;});var tied=[];if(best)this.users.forEach(function(u){if(u.score===best.score)tied.push(u);});this.finish(!best||!best.score?'The fireflies escaped!':tied.length>1?tied.length+' catchers tie with '+best.score+' points!':best.name+' wins with '+best.score+' points!',tied.length===1?best:null);}}
 this.effects=this.effects.filter(function(e){return this.time-e.at<3;},this);
};
var api={Game:Game};if(typeof module==='object'&&module.exports)module.exports=api;else root.SSNOverlayGame=api;
})(typeof window!=='undefined'?window:this);
