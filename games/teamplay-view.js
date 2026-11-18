(function(){
    'use strict';
    window.SSNTeamplayView={
        clock:function(game,now){
            if(game.mode==='shield')document.getElementById('wave-clock').textContent=game.phase==='active'?Math.max(0,Math.ceil((game.waveDeadline-now)/1000))+'s to impact':'';
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
                var carrier = game.history[0];
                document.getElementById('scene-title').textContent = carrier ? '🏮 ' + carrier.name : 'First light';
                document.getElementById('teamplay-score').textContent = game.steps + ' / 20 lights';
                var trail = document.getElementById('beacon-trail');
                var length = trail.getTotalLength();
                for (var i = 0; i < 20; i++) {
                    var point = trail.getPointAtLength(length * i / 19);
                    var light = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    light.setAttribute('cx', point.x);
                    light.setAttribute('cy', point.y);
                    light.setAttribute('r', i === game.steps - 1 ? 8 : 4);
                    light.setAttribute('class', i < game.steps ? 'beacon lit' : 'beacon');
                    stage.appendChild(light);
                }
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
                document.getElementById('wave-note').textContent=game.waveNote||'';
            }
            if (game.mode === 'relay') return;
            game.history.slice(0, 1).forEach(function(item){var row=el('div',null,'crew-contribution');row.appendChild(el('b',item.name));row.appendChild(el('span',item.action));history.appendChild(row);});
        }
    };
})();
