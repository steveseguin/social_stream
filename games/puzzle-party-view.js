(function(){
    'use strict';
    window.SSNGameView={
        clock:function(g,now){document.getElementById('puzzle-timing').textContent=g.phase!=='active'?'':g.mode==='sum'?'Take turns to hit the target':g.mode==='memory'&&!g.revealed?'Memorize · '+Math.max(0,Math.ceil((g.showUntil-now)/1000))+'s':'Answer · '+Math.max(0,Math.ceil((g.waveDeadline-now)/1000))+'s';},
        render:function(g,el,history){
            document.getElementById('round').textContent='Match '+g.round;
            document.getElementById('player-word').textContent=g.users.size===1?'player':'players';
            var board=document.getElementById('puzzle-board');board.textContent='';
            document.getElementById('puzzle-note').textContent=g.note;
            if(g.mode==='memory'){
                var command=document.getElementById('play-command');command.textContent='';
                if(g.phase==='waiting'){command.appendChild(el('span','Type '));command.appendChild(el('code','!ready'));command.appendChild(el('span',' in chat'));}
                else if(g.phase==='result')command.textContent='A fresh match starts shortly.';
                else if(!g.revealed)command.textContent='Memorize now. Answer when the numbers disappear.';
                else{command.appendChild(el('span','Type '));command.appendChild(el('code','!remember '+ '123412'.slice(0,g.sequence.length)));command.appendChild(el('span',' with the numbers you saw.'));}
                document.getElementById('puzzle-title').textContent=g.phase==='waiting'?'Ready for a little brain stretch?':g.revealed?'What was the sequence?':'Watch the parade.';
                document.getElementById('puzzle-score').textContent='Sequence '+Math.min(4,g.stage+1)+' / 4';
                (g.revealed||g.phase==='waiting'||g.phase==='result'?'?'.repeat(g.sequence.length):g.sequence).split('').forEach(function(n){board.appendChild(el('span',n,'memory-tile tile-'+n));});
            }else if(g.mode==='odd'){
                var q=g.question();document.getElementById('puzzle-title').textContent=g.phase==='result'?'Well spotted, everyone!':q[0];document.getElementById('puzzle-score').textContent='Question '+Math.min(5,g.stage+1)+' / 5';
                if(q&&g.phase!=='result')q[1].forEach(function(word,i){var card=el('div',null,'odd-card');card.appendChild(el('span',String(i+1),'odd-number'));card.appendChild(el('h3',word));card.appendChild(el('code','!odd '+(i+1)));board.appendChild(card);});
            }else{
                document.getElementById('puzzle-title').textContent=g.stage===3?'Every contribution counted.':'Build the number together.';document.getElementById('puzzle-score').textContent=Math.min(3,g.stage)+' / 3 targets';
                var current=el('div',null,'sum-current');current.appendChild(el('small','YOUR TOTAL'));current.appendChild(el('b',String(g.total)));board.appendChild(current);
                var target=el('div',null,'sum-target');target.appendChild(el('small','TARGET'));target.appendChild(el('b',String(g.target)));board.appendChild(target);
                document.getElementById('puzzle-note').textContent=g.stage===3?'All targets reached.':(g.target-g.total)+' to go. Add 1–9; leave room for a teammate.';
            }
            if(g.mode!=='sum'){
                var scores=document.getElementById('puzzle-leaders');scores.textContent='';
                Array.from(g.users.values()).sort(function(a,b){return b.score-a.score;}).slice(0,5).forEach(function(p){var row=el('span',p.name+' · '+p.score);scores.appendChild(row);});
            }
            if(!g.history.length)history.appendChild(el('p','Join in using the command below.','empty'));
            g.history.forEach(function(item){var row=el('div',null,'crew-contribution');row.appendChild(el('b',item.name));row.appendChild(el('span',item.action));history.appendChild(row);});
        }
    };
})();
