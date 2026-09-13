(function(){
    'use strict';
    window.SSNTeamplayView={
        clock:function(game,now){
            if(game.mode==='shield')document.getElementById('wave-clock').textContent=game.phase==='active'?Math.max(0,Math.ceil((game.waveDeadline-now)/1000))+'s to impact':'12 seconds per wave';
        },
        render:function(game,el,history){
            document.getElementById('round').textContent='Round '+game.round;
            var stage=document.getElementById('teamplay-stage');stage.textContent='';
            if(game.mode==='kitchen'){
                document.getElementById('scene-title').textContent=game.served===4?'Service complete!':game.recipe().name;
                document.getElementById('teamplay-score').textContent=game.served+' / 4 orders';
                if(game.served<4)game.recipe().ingredients.forEach(function(ingredient,i){
                    var card=el('div',null,'supply-card'+(game.stock[i]===2?' complete':''));
                    card.appendChild(el('span',game.recipe().icons[i],'supply-icon'));card.appendChild(el('code','!cook '+ingredient));
                    card.appendChild(el('b',game.stock[i]+' / 2'));stage.appendChild(card);
                });
                else stage.appendChild(el('div','\ud83c\udf55  \ud83e\udd6a  \ud83e\udd5e  \ud83c\udf72','feast'));
            }else if(game.mode==='relay'){
                document.getElementById('scene-title').textContent=game.steps===20?'Welcome home, little light.':'Carry the light together.';
                document.getElementById('teamplay-score').textContent=game.steps+' / 20 lights';
                for(var i=0;i<20;i++){var light=el('span',String(i+1),'relay-light'+(i<game.steps?' lit':''));light.setAttribute('aria-label','Light '+(i+1)+(i<game.steps?' lit':' waiting'));stage.appendChild(light);}
                document.getElementById('relay-holder').textContent=game.history.length?game.history[0].name+' passed it. Someone else, take the next turn!':'The first !pass starts the journey.';
            }else{
                document.getElementById('scene-title').textContent='Wave '+game.wave+' of 6';
                document.getElementById('teamplay-score').textContent=game.hull+' / 6 hull';
                var held=[0,0,0];game.votes.forEach(function(v){held[v]++;});
                ['red','blue','gold'].forEach(function(color,i){
                    var card=el('div',null,'shield-lane lane-'+color+(held[i]>=game.threats[i]?' covered':''));
                    var meteors=el('div',null,'meteor-field');for(var j=0;j<game.threats[i];j++)meteors.appendChild(el('span','\u2604','meteor'));
                    card.appendChild(meteors);card.appendChild(el('code','!shield '+color));card.appendChild(el('b',game.threats[i]?held[i]+' shields / '+game.threats[i]+(game.threats[i]===1?' meteor':' meteors'):'Clear lane'));stage.appendChild(card);
                });
                document.getElementById('ship-hull').textContent=Array.from({length:6},function(_,i){return i<game.hull?'\u25cf':'\u25cb';}).join(' ');
                document.getElementById('wave-note').textContent=game.waveNote||'One viewer protects one lane. Switch to where the crew needs you.';
            }
            if(!game.history.length)history.appendChild(el('p','Your name appears here when you help.','empty'));
            game.history.forEach(function(item){var row=el('div',null,'crew-contribution');row.appendChild(el('b',item.name));row.appendChild(el('span',item.action));history.appendChild(row);});
        }
    };
})();
