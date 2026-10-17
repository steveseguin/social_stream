(function (root) {
    'use strict';
    var recipes = [
        {name:'Midnight pizza', ingredients:['dough','tomato','cheese'], icons:['\ud83c\udf5e','\ud83c\udf45','\ud83e\uddc0']},
        {name:'Picnic sandwich', ingredients:['bread','lettuce','cheese'], icons:['\ud83c\udf5e','\ud83e\udd6c','\ud83e\uddc0']},
        {name:'Pancake party', ingredients:['flour','milk','berries'], icons:['\ud83c\udf3e','\ud83e\udd5b','\ud83c\udf53']},
        {name:'Cozy soup', ingredients:['carrot','potato','water'], icons:['\ud83e\udd55','\ud83e\udd54','\ud83d\udca7']}
    ];
    function Game(mode, options) {
        this.mode=mode; this.teamplay=true; this.options=options||{}; this.now=this.options.now||Date.now;
        this.random=this.options.random||Math.random; this.seconds=mode==='shield'?72:90; this.reset();
    }
    Game.prototype.reset=function(){this.round=0;this.begin();};
    Game.prototype.begin=function(){
        this.round++;this.phase='waiting';this.deadline=0;this.result='';this.revision=0;
        this.users=new Map();this.votes=new Map();this.seen=new Set();this.history=[];
        this.served=0;this.recipeStart=Math.floor(this.random()*recipes.length);this.stock=[0,0,0];
        this.steps=0;this.lastPlayer=null;this.lastInput=-Infinity;
        this.wave=1;this.waveDeadline=0;this.hull=6;this.blocked=0;this.threats=[1,0,0];this.waveNote='';
    };
    Game.prototype.recipe=function(){return recipes[(this.recipeStart+this.served)%recipes.length];};
    Game.prototype.next=function(){if(this.phase==='result')this.begin();};
    Game.prototype.shiftTime=function(n){if(this.waveDeadline)this.waveDeadline+=n;};
    Game.prototype.finish=function(){
        if(this.phase!=='active')return;this.phase='result';this.revision++;
        if(this.mode==='kitchen')this.result=this.served===4?'All four orders served! A little help made a whole feast.':this.served+' of 4 orders served. The next kitchen shift starts shortly.';
        else if(this.mode==='relay')this.result=this.steps===20?'The beacon is lit! Your crew carried the light all the way home.':this.steps+' of 20 lights reached. Bring another viewer along for the next relay.';
        else this.result=this.hull>0?'Ship safe! The crew blocked '+this.blocked+' meteors across six waves.':'Shields down! You blocked '+this.blocked+' meteors. Regroup for another flight.';
    };
    Game.prototype.resolveWave=function(){
        var held=[0,0,0];this.votes.forEach(function(v){held[v]++;});var hits=0,stopped=0;
        for(var i=0;i<3;i++){stopped+=Math.min(held[i],this.threats[i]);hits+=Math.max(0,this.threats[i]-held[i]);}
        this.hull=Math.max(0,this.hull-hits);this.blocked+=stopped;
        this.waveNote='Wave '+this.wave+': '+stopped+' blocked'+(hits?', '+hits+' hit the ship.':'. No damage!');
        if(!this.hull||this.wave===6){this.finish();return;}
        this.wave++;this.votes.clear();this.threats=[0,0,0];
        var total=Math.max(1,Math.min(12,Math.ceil(this.users.size*0.6))),start=(this.wave-1)%3;
        for(var j=0;j<total;j++)this.threats[(start+j)%3]++;
        this.waveDeadline+=12000;this.revision++;
    };
    Game.prototype.tick=function(){
        if(this.phase!=='active')return;
        if(this.mode==='shield'){
            while(this.phase==='active'&&this.now()>=this.waveDeadline)this.resolveWave();
        }else if(this.now()>=this.deadline)this.finish();
    };
    Game.prototype.input=function(message){
        this.tick();
        if(!message||message.bot||message.private||message.reflection||message.event||!message.chatname||!message.type||this.phase==='result')return false;
        var text=String(message.chatmessage||'').trim().toLowerCase(),match;
        if(this.mode==='kitchen')match=text.match(/^!cook\s+([a-z]+)$/);
        else if(this.mode==='relay')match=text.match(/^!pass$/);
        else match=text.match(/^!shield\s+(red|blue|gold)$/);
        if(!match)return false;
        var key=String(message.type)+':'+String(message.userid||message.username||message.chatname),now=this.now(),player=this.users.get(key);
        if(!player&&this.users.size>=1000)return false;
        if(player&&now-player.last<(this.mode==='kitchen'?6000:this.mode==='relay'?4000:1000))return false;
        var slot=this.mode==='kitchen'?this.recipe().ingredients.indexOf(match[1]):this.mode==='shield'?['red','blue','gold'].indexOf(match[1]):-1;
        if(this.mode==='kitchen'&&(slot<0||this.stock[slot]>=2))return false;
        if(this.mode==='relay'&&(key===this.lastPlayer||now-this.lastInput<300))return false;
        var id=message.id==null?message.meta&&message.meta.messageId:message.id;
        var duplicate=id==null?null:String(message.type)+':'+String(message.tid||'')+':'+String(id);
        if(this.seen.size>=20000||duplicate&&this.seen.has(duplicate))return false;
        if(duplicate)this.seen.add(duplicate);
        if(!player){player={name:String(message.chatname).slice(0,48),last:-Infinity,count:0};this.users.set(key,player);}
        player.last=now;player.count++;this.lastInput=now;
        if(this.phase==='waiting'){this.phase='active';this.deadline=now+this.seconds*1000;if(this.mode==='shield')this.waveDeadline=now+12000;}
        var action;
        if(this.mode==='kitchen'){
            this.stock[slot]++;action='added '+match[1];
            if(this.stock.every(function(n){return n===2;})){this.served++;this.stock=[0,0,0];action='finished an order';if(this.served===4)this.finish();}
        }else if(this.mode==='relay'){
            this.steps++;this.lastPlayer=key;action='carried the light';if(this.steps===20)this.finish();
        }else{this.votes.set(key,slot);action='shielded '+match[1];}
        this.history.unshift({name:player.name,action:action});this.history=this.history.slice(0,5);this.revision++;return true;
    };
    Game.prototype.previewCommand=function(){
        if(this.mode==='relay')return '!pass';
        if(this.mode==='kitchen')return '!cook '+this.recipe().ingredients[this.stock.indexOf(Math.min.apply(null,this.stock))];
        var held=[0,0,0];this.votes.forEach(function(v){held[v]++;});
        var needed=this.threats.map(function(n,i){return n-held[i];});return '!shield '+['red','blue','gold'][needed.indexOf(Math.max.apply(null,needed))];
    };
    root.SSNAudienceGame={Game:Game};
    if(typeof module!=='undefined'&&module.exports)module.exports=root.SSNAudienceGame;
})(typeof globalThis!=='undefined'?globalThis:window);
