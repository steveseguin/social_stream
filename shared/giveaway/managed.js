(function() {
    'use strict';
    window.startManagedGiveaway = function() {
        document.body.classList.add('managed-giveaway');
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
        var lastDraw = null, lastRevision = -1, lastEpoch = null, animation = null, finishTimer = null, wheelFrame = null;
        function cancelReveal() {
            clearInterval(animation); clearTimeout(finishTimer);
            if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
            wheelFrame = null; wheel.endSpin();
            animation = null; finishTimer = null;
        }
        function receive(payload) {
            var state = payload && payload.event === 'giveaway_state' && payload.meta && payload.meta.giveaway;
            if (!state || !Array.isArray(state.entrants) || !Array.isArray(state.winners)) return;
            if (state.epoch !== lastEpoch) { lastEpoch = state.epoch; lastRevision = -1; lastDraw = null; }
            if (state.revision <= lastRevision) return;
            lastRevision = state.revision;
            stateLabel.textContent = state.open ? 'Type ' + state.keyword + ' to enter' : 'Entries closed';
            count.textContent = state.count + (state.count === 1 ? ' eligible entry' : ' eligible entries');
            var winner = state.winners[0];
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
                var visible = state.entrants.filter(function(entry) { return !winner || entry.id !== winner.id; }).slice(0, 119);
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
        if (roomID !== 'test') document.body.appendChild(iframe);
        if (urlParams.has('preview')) {
            receive({event:'giveaway_state', meta:{giveaway:{epoch:'preview', revision:1, draw:0, open:true, keyword:'!enter', count:3,
                entrants:[{id:'1',name:'Avery',platform:'youtube'},{id:'2',name:'Morgan',platform:'twitch'},{id:'3',name:'Sam',platform:'kick'}], winners:[]}}});
        }
        syncCanvasSize();
        // An optional websocket follows the normal overlay receive channel.
        if ((urlParams.has('server') || urlParams.has('localserver')) && roomID !== 'test') {
            var socket;
            var stopped = false;
            function connect() {
                var server = urlParams.has('localserver') ? SocialStreamLocalServer.getWebSocketUrl() : (urlParams.get('server') || 'wss://io.socialstream.ninja/api');
                socket = new WebSocket(server);
                socket.onopen = function() { socket.send(JSON.stringify({join:roomID.split(',')[0], out:2, in:1})); };
                socket.onmessage = function(event) { try { receive(JSON.parse(event.data)); } catch (error) {} };
                socket.onclose = function() { if (!stopped) setTimeout(connect, 2000); };
            }
            connect();
            window.addEventListener('beforeunload', function() { stopped = true; socket.close(); cancelReveal(); });
        }
    };
})();
