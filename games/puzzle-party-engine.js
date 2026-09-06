(function(root){
    'use strict';
    var questions=[
        ['Which one is not a fruit?',['Apple','Carrot','Pear'],1],
        ['Which one is not a mammal?',['Dolphin','Bat','Penguin'],2],
        ['Which number is not even?',['12','17','24'],1],
        ['Which shape has no corners?',['Circle','Triangle','Square'],0],
        ['Which one is not a planet?',['Mars','Moon','Venus'],1],
        ['Which one is not a musical instrument?',['Violin','Trumpet','Telescope'],2],
        ['Which animal has no wings?',['Owl','Fox','Sparrow'],1],
        ['Which unit measures time?',['Minute','Meter','Liter'],0],
        ['Which one is not a season?',['Autumn','August','Winter'],1],
        ['Which number is not a multiple of three?',['9','14','21'],1],
        ['Which one is not a primary color of light?',['Red','Green','Yellow'],2],
        ['Which one is not a metal?',['Copper','Silver','Cotton'],2]
    ];
    function Game(mode,options){this.mode=mode;this.options=options||{};this.now=this.options.now||Date.now;this.random=this.options.random||Math.random;this.seconds=mode==='sum'?90:60;this.reset();}
    Game.prototype.reset=function(){this.round=0;this.begin();};
    Game.prototype.begin=function(){
        this.round++;this.phase='waiting';this.deadline=0;this.waveDeadline=0;this.showUntil=0;this.revision=0;this.result='';
        this.users=new Map();this.votes=new Map();this.seen=new Set();this.history=[];this.stage=0;this.total=0;this.lastPlayer=null;this.lastInput=-Infinity;
        this.note='';this.revealed=false;this.order=questions.map(function(_,i){return i;});
        for(var i=this.order.length-1;i>0;i--){var j=Math.floor(this.random()*(i+1)),x=this.order[i];this.order[i]=this.order[j];this.order[j]=x;}
        this.makePrompt();
    };
    Game.prototype.makePrompt=function(){
        this.votes.clear();this.revealed=false;this.total=0;this.lastPlayer=null;
        this.target=[20,30,40][this.stage]||40;
        this.sequence=Array.from({length:3+this.stage},function(){return String(1+Math.floor(this.random()*4));},this).join('');this.revision++;
    };
    Game.prototype.question=function(){return questions[this.order[this.stage]];};
    Game.prototype.shiftTime=function(n){if(this.waveDeadline)this.waveDeadline+=n;if(this.showUntil)this.showUntil+=n;};
    Game.prototype.next=function(){if(this.phase==='result')this.begin();};
    Game.prototype.finish=function(){
        if(this.phase!=='active')return;this.phase='result';this.revision++;
        if(this.mode==='sum'){this.result=this.stage===3?'Three targets, one brilliant crew. You did it!':this.stage+' of 3 targets reached. Try another team effort.';return;}
        var best=0,names=[];this.users.forEach(function(p){if(p.score>best){best=p.score;names=[p.name];}else if(p.score===best&&best)names.push(p.name);});
        this.result=best?'Top score: '+best+' / '+(this.mode==='memory'?4:5)+' — '+names.slice(0,3).join(', ')+(names.length>3?' and '+(names.length-3)+' more':'')+'.':'Thanks for playing! A fresh challenge starts shortly.';
    };
    Game.prototype.resolve=function(){
        var answer=this.mode==='memory'?this.sequence:String(this.question()[2]+1),correct=0,self=this;
        this.votes.forEach(function(value,key){if(value===answer){self.users.get(key).score++;correct++;}});
        this.note='Last answer: '+(this.mode==='memory'?answer.split('').join(' '):this.question()[1][+answer-1])+'. '+correct+' correct.';
        this.stage++;
        if(this.stage===(this.mode==='memory'?4:5)){this.finish();return;}
        this.makePrompt();this.waveDeadline+=this.mode==='memory'?15000:12000;this.showUntil=this.waveDeadline-10000;
    };
    Game.prototype.tick=function(){
        if(this.phase!=='active')return;
        if(this.mode==='sum'){if(this.now()>=this.deadline)this.finish();return;}
        while(this.phase==='active'&&this.now()>=this.waveDeadline)this.resolve();
        if(this.mode==='memory'&&this.phase==='active'&&!this.revealed&&this.now()>=this.showUntil){this.revealed=true;this.revision++;}
    };
    Game.prototype.input=function(m){
        this.tick();if(!m||m.bot||m.private||m.reflection||m.event||!m.type||!m.chatname||this.phase==='result')return false;
        var text=String(m.chatmessage||'').trim().toLowerCase(),ready=this.mode==='memory'&&text==='!ready',match=text.match(this.mode==='memory'?/^!remember\s+([1-4]{3,6})$/:this.mode==='odd'?/^!odd\s+([123])$/:/^!add\s+([1-9])$/);
        if(!ready&&!match)return false;
        if(this.mode==='memory'&&!ready&&(this.phase==='waiting'||!this.revealed||match[1].length!==this.sequence.length))return false;
        var key=String(m.type)+':'+String(m.userid||m.username||m.chatname),p=this.users.get(key),now=this.now();
        if(!p&&this.users.size>=1000)return false;
        if(ready&&p)return false;
        if(p&&now-p.last<(this.mode==='sum'?3000:1000))return false;
        if(this.mode==='memory'&&!ready&&this.votes.has(key))return false;
        if(this.mode==='sum'&&(this.total+Number(match[1])>this.target||key===this.lastPlayer||now-this.lastInput<300))return false;
        var id=m.id==null?m.meta&&m.meta.messageId:m.id,dup=id==null?null:String(m.type)+':'+String(m.tid||'')+':'+String(id);
        if(this.seen.size>=20000||dup&&this.seen.has(dup))return false;if(dup)this.seen.add(dup);
        if(!p){p={name:String(m.chatname).slice(0,48),last:-Infinity,score:0};this.users.set(key,p);}p.last=now;
        if(this.phase==='waiting'){this.phase='active';this.deadline=now+this.seconds*1000;this.waveDeadline=now+(this.mode==='memory'?15000:12000);this.showUntil=now+5000;}
        var action=ready?'joined the memory crew':this.mode==='sum'?'added '+match[1]:'locked in an answer';
        if(!ready){
            if(this.mode==='sum'){this.total+=Number(match[1]);this.lastPlayer=key;this.lastInput=now;p.score++;if(this.total===this.target){this.stage++;action='completed a target';if(this.stage===3)this.finish();else this.makePrompt();}}
            else this.votes.set(key,match[1]);
        }
        this.history.unshift({name:p.name,action:action});this.history=this.history.slice(0,5);this.revision++;return true;
    };
    Game.prototype.previewCommand=function(){return this.mode==='memory'?(this.phase==='waiting'||!this.revealed?'!ready':'!remember '+this.sequence):this.mode==='odd'?'!odd '+(this.question()[2]+1):'!add '+Math.min(9,this.target-this.total);};
    root.SSNAudienceGame={Game:Game};if(typeof module!=='undefined'&&module.exports)module.exports=root.SSNAudienceGame;
})(typeof globalThis!=='undefined'?globalThis:window);
