(function () {
    'use strict';
    var params = new URLSearchParams(location.search), mode = document.body.dataset.game;
    // Only the explicitly managed Number Hunt variant uses the authoritative host.
    // Other games and legacy Number Hunt keep their existing local behavior.
    if(mode==='number' && params.has('managed')){
        var managedUrl=new URL('../giveaway.html',location.href);managedUrl.search=params.toString();managedUrl.searchParams.set('managed','');
        if(!params.has('title'))managedUrl.searchParams.set('title','Number Hunt');
        location.replace(managedUrl.href);return;
    }
    var demo = params.has('demo'), session = params.get('session') || params.get('room') || params.get('s') || params.get('id');
    var game = new SSNAudienceGame.Game(mode), paused = false, pausedAt = 0, nextAt = 0, lastRender = '';
    var status = document.getElementById('connection'), history = document.getElementById('history');
    function el(tag, text, className) { var node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
    if (params.has('chroma')) document.body.classList.add('chroma');
    if (params.has('transparent')) document.body.classList.add('transparent');
    if (params.has('clean')) document.getElementById('host-controls').hidden = true;
    function render() {
        var remaining = game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - (paused ? pausedAt : Date.now())) / 1000)) : game.seconds;
        document.getElementById('clock-value').textContent = paused ? 'Paused' : game.phase === 'result' ? 'Complete' : remaining + 's';
        document.getElementById('clock-label').textContent = game.phase === 'waiting' ? 'Starts with chat' : game.phase === 'result' ? 'Next round shortly' : 'Remaining';
        if (game.tug) { SSNTugView.clock(game, paused ? pausedAt : Date.now()); if (game.phase === 'waiting') document.getElementById('clock-label').textContent = 'Join both teams to start'; }
        if (game.teamplay) SSNTeamplayView.clock(game, paused ? pausedAt : Date.now());
        if (window.SSNGameView) SSNGameView.clock(game, paused ? pausedAt : Date.now());
        var key = JSON.stringify([game.phase, game.round, game.history, Array.from(game.votes), game.supplies, game.discoveries, game.scrambled, game.revision]);
        if (key === lastRender) return;
        lastRender = key;
        var result = document.getElementById('result'); result.hidden = game.phase !== 'result'; result.textContent = game.result;
        document.getElementById('next').hidden = game.phase !== 'result';
        document.getElementById('participants').textContent = game.users.size;
        if (game.phase === 'result' && !nextAt) nextAt = Date.now() + 10000;
        history.textContent = '';
        if (window.SSNGameView) {
            SSNGameView.render(game, el, history);
        } else if (game.teamplay) {
            SSNTeamplayView.render(game, el, history);
        } else if (game.tug) {
            SSNTugView.render(game, el, history);
        } else if (game.card) {
            document.getElementById('round').textContent = 'Round ' + String(game.round).padStart(2, '0');
            if (mode === 'number') document.querySelector('.command code').textContent = '!guess ' + Math.floor((game.low + game.high) / 2);
            var art = document.getElementById('party-art');
            art.textContent = mode === 'number' ? game.low + '\u2013' + game.high : mode === 'shuffle' ? game.scrambled.toUpperCase() : game.phase === 'result' && mode === 'showdown' ? game.card.labels[game.secret].toUpperCase() : mode === 'showdown' ? '\u270a \u270b \u270c' : '\u2600 \u263e \u2606';
            if (game.card.labels.length) {
                var totals = [0, 0, 0]; game.votes.forEach(function (v) { totals[v]++; });
                game.card.labels.forEach(function (label, index) {
                    var row = el('div', null, 'guess'); row.appendChild(el('code', (mode === 'showdown' ? '!throw ' : '!pick ') + label));
                    row.appendChild(el('b', game.phase === 'result' ? totals[index] + ' picked' : 'Hidden until reveal')); history.appendChild(row);
                });
            } else {
                if (!game.history.length) history.appendChild(el('p', 'The first guess starts the clock. Your whole chat can join in.', 'empty'));
                game.history.forEach(function (item) {
                    var row = el('div', null, 'guess'), left = el('div'); left.appendChild(el('code', item.code)); left.appendChild(el('small', item.name));
                    row.appendChild(left); row.appendChild(el('b', item.feedback)); history.appendChild(row);
                });
            }
        } else if (mode === 'signal') {
            document.getElementById('round').textContent = 'Transmission ' + String(game.round).padStart(2, '0');
            document.querySelectorAll('.digit').forEach(function (digit, index) { digit.textContent = game.phase === 'result' ? game.secret[index] : '?'; });
            if (!game.history.length) history.appendChild(el('p', 'The first guess starts the clock. Every clue helps the whole chat.', 'empty'));
            game.history.forEach(function (item) {
                var row = el('div', null, 'guess'), left = el('div'), right = el('div', null, 'feedback');
                left.appendChild(el('code', item.code)); left.appendChild(el('small', item.name));
                right.appendChild(el('b', item.exact + ' exact')); right.appendChild(el('div', item.misplaced + ' right digit, wrong place'));
                row.appendChild(left); row.appendChild(right); history.appendChild(row);
            });
        } else {
            var chapter = SSNAudienceGame.chapters[game.stage], counts = [0, 0, 0]; game.votes.forEach(function (v) { counts[v]++; });
            document.getElementById('round').textContent = 'Chapter ' + (game.stage + 1) + ' of 5';
            document.getElementById('scene-title').textContent = chapter.title;
            document.getElementById('story').textContent = chapter.story;
            document.getElementById('supplies').textContent = game.supplies;
            document.getElementById('discoveries').textContent = game.discoveries;
            document.querySelectorAll('.progress span').forEach(function (part, i) { part.className = i <= game.stage ? 'done' : ''; });
            chapter.choices.forEach(function (choice, index) {
                var unavailable = game.supplies + choice[2] < 0, card = el('div', null, 'choice' + (unavailable ? ' unavailable' : ''));
                var bar = el('div', null, 'choice-bar'); bar.style.width = (game.votes.size ? counts[index] / game.votes.size * 100 : 0) + '%'; card.appendChild(bar);
                var body = el('div'); body.appendChild(el('span', counts[index] + (counts[index] === 1 ? ' vote' : ' votes'), 'votes'));
                body.appendChild(el('code', '!vote ' + (index + 1))); body.appendChild(el('h3', choice[0]));
                body.appendChild(el('p', unavailable ? 'Not enough supplies for this route' : choice[1])); card.appendChild(body); history.appendChild(card);
            });
            if (game.phase === 'result' && game.stage === 4) result.textContent += ' Expedition complete: ' + game.discoveries + ' discoveries. A new voyage starts shortly.';
        }
    }
    function receive(payload) {
        if (paused) return;
        var changed = false;
        var batch = Array.isArray(payload) ? payload.slice(0, 100) : [payload];
        batch.forEach(function (message) {
            if (message && message.content) message = message.content;
            if (!message || typeof message.chatmessage !== 'string' || message.chatmessage.length > 2000) return;
            var copy = Object.assign({}, message);
            if (!copy.textonly) {
                var template = document.createElement('template'); template.innerHTML = copy.chatmessage;
                copy.chatmessage = template.content.textContent || '';
            }
            if (game.input(copy)) changed = true;
        });
        if (changed) { if (!demo) status.textContent = 'Chat received'; render(); }
    }
    document.getElementById('pause').onclick = function () {
        paused = !paused;
        if (paused) pausedAt = Date.now();
        else { var elapsed = Date.now() - pausedAt; if (game.deadline) game.deadline += elapsed; if (nextAt) nextAt += elapsed; if (game.shiftTime) game.shiftTime(elapsed); }
        document.body.classList.toggle('game-paused', paused);
        this.textContent = paused ? 'Resume' : 'Pause'; render();
    };
    document.getElementById('next').onclick = function () { if (!paused) { game.next(); nextAt = 0; render(); } };
    document.getElementById('restart').onclick = function () { game.reset(); nextAt = 0; lastRender = ''; render(); };
    render();
    setInterval(function () {
        if (paused) return;
        game.tick(); if (nextAt && Date.now() >= nextAt) { game.next(); nextAt = 0; } render();
    }, 250);
    if (demo) {
        status.textContent = 'Preview · simulated chat';
        var counter = 0;
        setInterval(function () {
            counter++;
            receive({ type: 'demo', chatname: ['Juniper', 'CosmicCat', 'River', 'Milo', 'Nova'][counter % 5], textonly: true, id: counter,
                chatmessage: typeof game.previewCommand === 'function' ? game.previewCommand(counter) : mode === 'signal' ? '!code ' + (counter % 7 === 0 ? game.secret : Array.from({ length: 4 }, function () { return 1 + Math.floor(Math.random() * 6); }).join('')) : '!vote ' + (1 + counter % 3) });
        }, 2000);
        return; // Demo never opens a session or sends messages.
    }
    if (!session) { status.textContent = 'Add your SSN session link to connect'; return; }
    if (params.has('server')) {
        var endpoint = params.get('server') || 'wss://io.socialstream.ninja', socket, retry;
        try { var parsed = new URL(endpoint); if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') throw new Error(); }
        catch (_) { status.textContent = 'Invalid WebSocket address'; return; }
        function connect() {
            status.textContent = 'Connecting to chat…';
            try { socket = new WebSocket(endpoint); } catch (_) { status.textContent = 'Could not open chat connection'; return; }
            socket.onopen = function () { socket.send(JSON.stringify({ join: session.split(',')[0], out: 2, in: 1 })); status.textContent = 'Relay connected · waiting for chat'; };
            socket.onmessage = function (event) { if (typeof event.data !== 'string' || event.data.length > 256000) return; try { receive(JSON.parse(event.data)); } catch (_) {} };
            socket.onerror = function () { socket.close(); };
            socket.onclose = function () { status.textContent = 'Reconnecting to chat…'; clearTimeout(retry); retry = setTimeout(connect, 5000); };
        }
        connect(); return;
    }
    status.textContent = 'Waiting for chat';
    var bridge = document.createElement('iframe'); bridge.title = 'SSN chat connection';
    bridge.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-100px;top:-100px';
    bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(session) + '&novideo&noaudio&label=dock&cleanoutput&room=' + encodeURIComponent(session);
    window.addEventListener('message', function (event) {
        if (event.source !== bridge.contentWindow) return;
        var data = event.data && event.data.dataReceived; if (data && data.overlayNinja) receive(data.overlayNinja);
    });
    document.body.appendChild(bridge);
})();
