(function(){
    'use strict';
    window.SSNGameView={
        clock:function(g,now){document.getElementById('puzzle-timing').textContent=g.phase!=='active'?'':g.mode==='sum'?'':g.mode==='memory'&&!g.revealed?Math.max(0,Math.ceil((g.showUntil-now)/1000))+'s':Math.max(0,Math.ceil((g.waveDeadline-now)/1000))+'s';},
        render:function(g,el,history){
            document.getElementById('round').textContent='Match '+g.round;
            document.getElementById('player-word').textContent=g.users.size===1?'player':'players';
            var board=document.getElementById('puzzle-board');board.textContent='';
            document.getElementById('puzzle-note').textContent=g.note;
            if(g.mode==='memory'){
                var command=document.getElementById('play-command');command.textContent='';
                if(g.phase==='waiting'){command.appendChild(el('code','!ready'));}
                else if(g.phase==='active' && g.revealed){command.appendChild(el('code','!mem '+ '123412'.slice(0,g.sequence.length)));}
                document.getElementById('puzzle-title').textContent='';
                document.getElementById('puzzle-score').textContent=Math.min(4,g.stage+1)+' / 4';
                (g.revealed||g.phase==='waiting'||g.phase==='result'?'?'.repeat(g.sequence.length):g.sequence).split('').forEach(function(n){board.appendChild(el('span',n,'memory-tile tile-'+n));});
            }else if(g.mode==='odd'){
                var q=g.question();document.getElementById('puzzle-title').textContent=g.phase==='result'?'':q[0];document.getElementById('puzzle-score').textContent=Math.min(5,g.stage+1)+' / 5';
                if(q&&g.phase!=='result')q[1].forEach(function(word,i){var card=el('div',null,'odd-card');card.appendChild(el('h3',word));card.appendChild(el('code','!odd '+(i+1)));board.appendChild(card);});
            }else{
                document.getElementById('puzzle-title').textContent='';document.getElementById('puzzle-score').textContent=Math.min(3,g.stage)+' / 3';
                var current=el('div',null,'sum-current');current.appendChild(el('b',String(g.total)));board.appendChild(current);
                var target=el('div',null,'sum-target');target.appendChild(el('small','🎯'));target.appendChild(el('b',String(g.target)));board.appendChild(target);
                document.getElementById('puzzle-note').textContent='';
            }
            if(g.mode!=='sum'){
                var scores=document.getElementById('puzzle-leaders');scores.textContent='';
                Array.from(g.users.values()).filter(function(p){return p.score > 0;}).sort(function(a,b){return b.score-a.score;}).slice(0,5).forEach(function(p){var row=el('span',p.name+' · '+p.score);scores.appendChild(row);});
            }
            g.history.slice(0, 1).forEach(function(item){var row=el('div',null,'crew-contribution');row.appendChild(el('b',item.name));row.appendChild(el('span',item.action));history.appendChild(row);});
        }
    };
})();
