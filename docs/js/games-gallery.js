(function(){
    'use strict';
    var grid=document.getElementById('game-grid'),search=document.getElementById('game-search'),category='all';
    var session=document.getElementById('game-session'),password=document.getElementById('game-password'),params=new URLSearchParams(location.search);
    session.value=params.get('session')||'';password.value=params.get('password')||'';
    // Keep session credentials out of screenshots, copied gallery URLs, and outgoing referrers.
    if(params.has('session')||params.has('password')){try{history.replaceState(null,'',location.pathname);}catch(_){}}
    function el(tag,text,cls){var n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
    function liveURL(game){var u=new URL('../'+game.path,location.href);u.searchParams.set('session',session.value.trim());if(password.value)u.searchParams.set('password',password.value);return u.href;}
    var cards=[],favorites=new Set(),favoritesOnly=false,favoriteKey='ssn-game-favorites';
    try {
        var saved=JSON.parse(localStorage.getItem(favoriteKey)||'[]');
        if(Array.isArray(saved))window.SSNGamesCatalog.forEach(function(game){if(saved.indexOf(game.id)!==-1)favorites.add(game.id);});
    } catch(_) {}
    function saveFavorites(){
        try {localStorage.setItem(favoriteKey,JSON.stringify(Array.from(favorites)));}
        catch(_) {document.getElementById('favorite-status').hidden=false;document.getElementById('favorite-status').textContent='Favorites work for this visit, but this browser could not save them.';}
    }

    window.SSNGamesCatalog.forEach(function(game){
        var card=el('article',null,'game-card'),shot=el('button',null,'game-shot'),img=el('img');shot.type='button';shot.setAttribute('aria-label','Enlarge '+game.title+' screenshot');
        img.src=game.image;img.alt=game.title+' in Social Stream Ninja';img.loading='lazy';img.width=1280;img.height=800;shot.appendChild(img);card.appendChild(shot);
        shot.onclick=function(){var dialog=document.getElementById('game-preview');document.getElementById('preview-image').src=game.image;document.getElementById('preview-image').alt=img.alt;document.getElementById('preview-caption').textContent=game.title+' — '+game.description;if(dialog.showModal)dialog.showModal();else window.open(game.image,'_blank','noopener');};
        var copy=el('div',null,'game-copy');copy.appendChild(el('span',game.category,'game-type'));copy.appendChild(el('h2',game.title));copy.appendChild(el('span',game.audience,'game-audience'));copy.appendChild(el('p',game.description));
        var favorite=el('button',null,'game-favorite');favorite.type='button';
        function favoriteState(){var selected=favorites.has(game.id);favorite.textContent=selected?'\u2605':'\u2606';favorite.setAttribute('aria-label','Favorite '+game.title);favorite.setAttribute('aria-pressed',String(selected));favorite.title=selected?'Remove from favorites':'Save to favorites';}
        favoriteState();favorite.onclick=function(){if(favorites.has(game.id))favorites.delete(game.id);else favorites.add(game.id);favoriteState();saveFavorites();filter();};card.appendChild(favorite);
        var actions=el('div',null,'game-actions');
        if(game.demo){var preview=el('a','Preview');preview.href='../'+game.path+'?demo';preview.target='_blank';preview.rel='noopener noreferrer';actions.appendChild(preview);}
        var use=el('a','Use game','use-game');use.target='_blank';use.rel='noopener noreferrer';
        use.onclick=function(e){if(!session.value.trim()){e.preventDefault();document.getElementById('game-connection').open=true;session.focus();}else use.href=liveURL(game);};actions.appendChild(use);
        var copyLink=el('button','Copy OBS link');copyLink.type='button';copyLink.onclick=function(){if(!session.value.trim()){document.getElementById('game-connection').open=true;session.focus();return;}var url=liveURL(game);function fallback(){window.prompt('Copy this OBS browser-source link',url);}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){copyLink.textContent='Copied';setTimeout(function(){copyLink.textContent='Copy OBS link';},1800);},fallback);else fallback();};actions.appendChild(copyLink);
        copy.appendChild(actions);card.appendChild(copy);grid.appendChild(card);cards.push({node:card,game:game,use:use});
    });
    function links(){cards.forEach(function(c){c.use.href=session.value.trim()?liveURL(c.game):'#game-connection';});}session.addEventListener('input',links);password.addEventListener('input',links);links();
    function filter(){var q=search.value.toLowerCase().trim(),count=0;cards.forEach(function(c){var visible=(!favoritesOnly||favorites.has(c.game.id))&&(category==='all'||c.game.category===category)&&(c.game.title+' '+c.game.description+' '+c.game.command).toLowerCase().indexOf(q)>=0;c.node.hidden=!visible;if(visible)count++;});document.getElementById('game-count').textContent=count===1?'1 game or chat interaction':count+' games & chat interactions';document.getElementById('game-empty').hidden=!!count;document.getElementById('game-empty').textContent=favoritesOnly&&!favorites.size?'No favorites yet. Turn off Favorites and star a game to save it here.':'No matches. Try another word or category.';}
    document.getElementById('favorites-only').onclick=function(){favoritesOnly=!favoritesOnly;this.setAttribute('aria-pressed',String(favoritesOnly));filter();};
    search.addEventListener('input',filter);document.querySelectorAll('[data-category]').forEach(function(b){b.onclick=function(){category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});filter();};});filter();
    document.getElementById('close-preview').onclick=function(){document.getElementById('game-preview').close();};
})();
