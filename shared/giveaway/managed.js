(function() {
    'use strict';
    window.startManagedGiveaway = function() {
        document.body.classList.add('managed-giveaway');
        document.body.setAttribute('data-backdrop',urlParams.get('backdrop') === 'panel' ? 'panel' : 'transparent');
        var giveawayId = urlParams.get('giveaway') || 'default';
        var mode = urlParams.get('presentation') || 'card';
        if (['card', 'reel', 'wheel'].indexOf(mode) === -1) mode = 'card';
        document.body.setAttribute('data-presentation', mode);
        settings.theme = urlParams.get('theme') || 'midnight';
        if (!GIVEAWAY_THEMES[settings.theme]) settings.theme = 'midnight';
        document.body.setAttribute('data-theme', settings.theme);
        wheel.setTheme(resolveTheme(settings.theme));
        var stage = document.createElement('section');
        stage.className = 'giveaway-stage';
        stage.setAttribute('aria-live', 'polite');
        var title = document.createElement('h1');
        title.textContent = urlParams.get('title') || 'Giveaway';
        var stateLabel = document.createElement('p');
        stateLabel.textContent = 'Waiting for giveaway';
        var result = document.createElement('div');
        result.className = 'giveaway-result';
        result.textContent = 'Good luck!';
        var count = document.createElement('p');
        stage.appendChild(title); stage.appendChild(stateLabel); stage.appendChild(result); stage.appendChild(count);
        document.querySelector('.col-left').insertBefore(stage, document.querySelector('.col-left').firstChild);
        function fitWheel() {
            if (mode !== 'wheel') return;
            var card = document.querySelector('.col-left > .card');
            var cardStyle = getComputedStyle(card);
            var available = window.innerHeight - card.getBoundingClientRect().top -
                parseFloat(cardStyle.paddingTop) - parseFloat(cardStyle.paddingBottom) -
                parseFloat(cardStyle.marginBottom) - parseFloat(getComputedStyle(document.body).paddingBottom) - 4;
            var size = Math.max(0, Math.min(460, card.clientWidth -
                parseFloat(cardStyle.paddingLeft) - parseFloat(cardStyle.paddingRight), available));
            wheelBox.style.width = size + 'px';
            wheelBox.style.height = size + 'px';
            if (syncCanvasSize()) wheel.rebuildNow();
        }
        window.addEventListener('resize', fitWheel);
        var lastDraw = null, lastRevision = -1, lastEpoch = null, lastGeneration = -1, animation = null, finishTimer = null, wheelFrame = null;
        function cancelReveal() {
            clearInterval(animation); clearTimeout(finishTimer);
            if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
            wheelFrame = null; wheel.endSpin();
            animation = null; finishTimer = null;
        }
        function receive(payload) {
            var state = payload && payload.event === 'giveaway_state' && payload.meta && payload.meta.giveaway;
            if (!state || !Array.isArray(state.entrants) || !Array.isArray(state.winners)) return;
            if ((state.giveawayId || 'default') !== giveawayId) return;
            if (Number.isFinite(state.generation)) {if(state.generation < lastGeneration)return;lastGeneration=state.generation;}
            if (state.epoch !== lastEpoch) { lastEpoch = state.epoch; lastRevision = -1; lastDraw = null; }
            if (state.revision <= lastRevision) return;
            lastRevision = state.revision;
            stateLabel.textContent = state.open ? (state.config && state.config.ticketCost ? 'Enter: !ticket ' + giveawayId + ' 1' + (state.config.kind === 'coin' ? ' heads (or tails)' : '') : 'Type ' + state.keyword + ' to enter') : 'Entries closed';
            count.textContent = state.count + (state.count === 1 ? ' eligible entry' : ' eligible entries');
            if(state.number){stateLabel.textContent=state.open?'Guess '+state.number.low+'–'+state.number.high+': !guess '+giveawayId+' NUMBER':'Round closed';count.textContent=state.number.guesses.map(function(g){return g.name+': '+g.guess+' ('+g.hint+')';}).join(' · ') || 'One guess per viewer every 5 seconds.';}
            var winner = state.winners[0];
            if (state.outcome) winner = {id:state.outcome,name:state.outcome.charAt(0).toUpperCase()+state.outcome.slice(1)};
            var newDraw = lastDraw !== null && state.draw !== lastDraw && winner;
            if (state.draw !== lastDraw) {
                cancelReveal();
                lastDraw = state.draw;
                if (!winner) result.textContent = 'Good luck!';
                else if (!newDraw || mode === 'card' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) result.textContent = winner.name + ' wins!';
                else {
                    result.textContent = 'Drawing...';
                    var names = state.entrants.map(function(entry) { return entry.name; });
                    names.push(winner.name);
                    var index = 0;
                    if (mode === 'reel') animation = setInterval(function() { result.textContent = names[(index++) % names.length]; }, 85);
                    finishTimer = setTimeout(function() { cancelReveal(); result.textContent = winner.name + ' wins!'; }, 3200);
                }
            }
            if (mode === 'wheel') {
                fitWheel();
                var visible = state.entrants.filter(function(entry) { return !winner || entry.id !== winner.id; }).slice(0, 119);
                if(state.config && state.config.kind==='coin')visible=[{id:'heads',name:'Heads'},{id:'tails',name:'Tails'}].filter(function(e){return !winner || e.id!==winner.id;});
                if (winner) visible.push(winner);
                entrants.clear();
                visible.forEach(function(entry) { entrants.set(entry.id, entry); });
                wheel.rebuildNow();
                if (newDraw && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    var angle = 360 / Math.max(1, visible.length);
                    var started = Date.now();
                    var destination = 2160 - ((visible.length - 0.5) * angle);
                    wheel.beginSpin();
                    function spin() {
                        var progress = Math.min(1, (Date.now() - started) / 3000);
                        wheel.setRotation(destination * (1 - Math.pow(1 - progress, 3)) * Math.PI / 180);
                        wheel.render();
                        if (progress < 1) wheelFrame = requestAnimationFrame(spin);
                        else { wheelFrame = null; wheel.endSpin(); }
                    }
                    spin();
                }
            }
        }
        // This is an audience-only view. The host owns entries, randomness, and controls.
        iframe = document.createElement('iframe');
        iframe.hidden = true;
        iframe.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=' + encodeURIComponent(password) + '&solo&view=' + encodeURIComponent(roomID) + '&novideo&noaudio&label=giveaway&cleanoutput&room=' + encodeURIComponent(roomID);
        window.addEventListener('message', function(event) {
            if (event.source !== iframe.contentWindow) return;
            receive(event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja);
        });
        if (roomID !== 'test' && !urlParams.has('preview')) document.body.appendChild(iframe);
        if (urlParams.has('preview')) {
            receive({event:'giveaway_state', meta:{giveaway:{epoch:'preview', revision:1, draw:0, open:true, keyword:'!enter', count:3,
                entrants:[{id:'1',name:'Avery',platform:'youtube'},{id:'2',name:'Morgan',platform:'twitch'},{id:'3',name:'Sam',platform:'kick'}], winners:[]}}});
        }
        syncCanvasSize();
        // An optional websocket follows the normal overlay receive channel.
        if ((urlParams.has('server') || urlParams.has('server2') || urlParams.has('localserver')) && roomID !== 'test' && !urlParams.has('preview')) {
            var socket;
            var stopped = false;
            function connect() {
                var displayFeed = urlParams.has('server2') && !(urlParams.has('localserver') && urlParams.get('server'));
                var server = urlParams.has('localserver') ? SocialStreamLocalServer.getRelayUrl(urlParams, displayFeed ? 'server2' : 'server', '') : (urlParams.get('server') || 'wss://io.socialstream.ninja/api');
                socket = new WebSocket(server);
                socket.onopen = function() {
                    socket.send(JSON.stringify({join:roomID.split(',')[0], out:displayFeed ? 3 : 1, in:displayFeed ? 4 : 2}));
                    socket.send(JSON.stringify({action:'getgiveawaystate'}));
                };
                socket.onmessage = function(event) { try { receive(JSON.parse(event.data)); } catch (error) {} };
                socket.onclose = function() { if (!stopped) setTimeout(connect, 2000); };
            }
            connect();
            window.addEventListener('beforeunload', function() { stopped = true; socket.close(); cancelReveal(); });
        }
    };
})();
