(function () {
    'use strict';
    if (window.name === 'ssn-game-rotation' && window.parent !== window) document.documentElement.style.colorScheme = 'normal';
    var params = new URLSearchParams(location.search), mode = document.body.dataset.game;
    var chatRelay = SocialStreamLocalServer.getChatRelayConfig(params);
    // Only the explicitly managed Number Hunt variant uses the authoritative host.
    // Other games and legacy Number Hunt keep their existing local behavior.
    if(mode==='number' && params.has('managed')){
        var managedUrl=new URL('../giveaway.html',location.href);managedUrl.search=params.toString();managedUrl.searchParams.set('managed','');
        if(!params.has('title'))managedUrl.searchParams.set('title','Number Hunt');
        location.replace(managedUrl.href);return;
    }
    var demo = params.has('demo'), session = params.get('session') || params.get('room') || params.get('s') || params.get('id');
    var game = new SSNAudienceGame.Game(mode), nextAt = 0, lastRender = '';
    var history = document.getElementById('history');
    function el(tag, text, className) { var node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
    if (params.has('chroma')) document.body.classList.add('chroma');
    /* A page with a drawn scene (window.SSNScene) keeps this card for screen readers only, so it is not fitted to the window. */ if (!window.SSNScene) SSNFitCard(document.querySelector('.shell'), params);
    if (params.has('transparent')) document.body.classList.add('transparent');
    function render() { if (window.SSNScene) window.SSNScene.sync(game, Date.now());
        var remaining = game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - Date.now()) / 1000)) : game.seconds;
        document.getElementById('clock-value').textContent = game.phase === 'active' ? remaining + 's' : '';
        if (game.tug) SSNTugView.clock(game, Date.now());
        if (game.teamplay) SSNTeamplayView.clock(game, Date.now());
        if (window.SSNGameView) SSNGameView.clock(game, Date.now());
        var key = JSON.stringify([game.phase, game.round, game.history, Array.from(game.votes), game.supplies, game.discoveries, game.scrambled, game.revision]);
        if (key === lastRender) return;
        lastRender = key;
        document.body.dataset.phase = game.phase;
        var result = document.getElementById('result'); result.hidden = game.phase !== 'result'; result.textContent = game.result;
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
            if (game.card.labels.length) {
                var totals = [0, 0, 0]; game.votes.forEach(function (v) { totals[v]++; });
                game.card.labels.forEach(function (label, index) {
                    var row = el('div', null, 'pick-option');
                    var symbols = mode === 'showdown' ? ['✊', '✋', '✌'] : ['☀', '☾', '★'];
                    row.appendChild(el('span', symbols[index], 'choice-symbol'));
                    row.appendChild(el('code', (mode === 'showdown' ? '!throw ' : '!pick ') + label));
                    if (game.phase === 'result') row.appendChild(el('b', totals[index] + ' picked'));
                    history.appendChild(row);
                });
            } else {
                var art = document.getElementById('party-art');
                if (game.phase === 'result') art.textContent = String(game.secret).toUpperCase();
                else art.textContent = mode === 'number' ? game.low + '–' + game.high : game.scrambled.toUpperCase();
                game.history.slice(0, 3).forEach(function (item) {
                    var row = el('div', null, 'guess'), left = el('div'); left.appendChild(el('code', item.code)); left.appendChild(el('small', item.name));
                    row.appendChild(left);
                    if (mode === 'number') row.appendChild(el('b', item.feedback));
                    history.appendChild(row);
                });
            }
        } else if (mode === 'signal') {
            document.getElementById('round').textContent = 'Transmission ' + String(game.round).padStart(2, '0');
            document.querySelectorAll('.digit').forEach(function (digit, index) { digit.textContent = game.phase === 'result' ? game.secret[index] : '?'; });
            game.history.forEach(function (item) {
                var row = el('div', null, 'guess'), left = el('div'), right = el('div', null, 'feedback');
                left.appendChild(el('code', item.code)); left.appendChild(el('small', item.name));
                right.appendChild(el('b', item.exact + ' exact')); right.appendChild(el('div', item.misplaced + ' misplaced'));
                row.appendChild(left); row.appendChild(right); history.appendChild(row);
            });
        } else {
            var chapter = SSNAudienceGame.chapters[game.stage], counts = [0, 0, 0]; game.votes.forEach(function (v) { counts[v]++; });
            document.getElementById('round').textContent = 'Chapter ' + (game.stage + 1) + ' of 5';
            document.getElementById('scene-title').textContent = chapter.title;
            document.getElementById('supplies').textContent = game.supplies;
            document.getElementById('discoveries').textContent = game.discoveries;
            document.querySelectorAll('.progress span').forEach(function (part, i) { part.className = i <= game.stage ? 'done' : ''; });
            chapter.choices.forEach(function (choice, index) {
                var unavailable = game.supplies + choice[2] < 0, card = el('div', null, 'choice' + (unavailable ? ' unavailable' : ''));
                var bar = el('div', null, 'choice-bar'); bar.style.width = (game.votes.size ? counts[index] / game.votes.size * 100 : 0) + '%'; card.appendChild(bar);
                var body = el('div'); body.appendChild(el('span', counts[index], 'votes'));
                body.appendChild(el('code', '!vote ' + (index + 1))); body.appendChild(el('h3', choice[0]));
                body.appendChild(el('p', unavailable ? '🔒' : [choice[2] ? '📦 ' + (choice[2] > 0 ? '+' : '') + choice[2] : '', choice[3] ? '💎 +' + choice[3] : ''].filter(Boolean).join('   '))); card.appendChild(body); history.appendChild(card);
            });
            if (game.phase === 'result' && game.stage === 4) result.textContent += ' · ' + game.discoveries + ' discoveries';
        }
    }
    var membersOnly = (params.has('membersonly') || params.has('showonlymembers') || params.has('subsonly'));
    function receive(payload) {
        var changed = false;
        var batch = Array.isArray(payload) ? payload.slice(0, 100) : [payload];
        batch.forEach(function (message) {
            if (message && message.content) message = message.content;
            // Captions are the host's own speech shown as text. They are not chat to take part with.
            if (message && message.type === 'captions') return;
            // &membersonly: only members and subscribers (and paid messages) take part.
            if (membersOnly && message && !message.membership && !message.hasDonation && message.type !== 'demo') return;
            if (!message || typeof message.chatmessage !== 'string' || message.chatmessage.length > 2000) return;
            var copy = Object.assign({}, message);
            // Preserve the chatmessage format: textonly=true is literal text, without HTML parsing/filtering; false/missing permits HTML checked at its ingress boundary.
            if (!copy.textonly) {
                var template = document.createElement('template'); template.innerHTML = copy.chatmessage;
                copy.chatmessage = template.content.textContent || '';
            }
            if (game.input(copy)) changed = true; if (window.SSNScene) window.SSNScene.chat(copy, game);
        });
        if (changed) render();
    }
    render();
    setInterval(function () {
        game.tick(); if (nextAt && Date.now() >= nextAt) { game.next(); nextAt = 0; } render();
    }, 250);
    if (demo) {
        if (window.SSNScene && window.SSNScene.demo) { window.SSNScene.demo(receive, game); return; } var counter = 0;
        setInterval(function () {
            counter++;
            receive({ type: 'demo', chatname: ['Juniper', 'CosmicCat', 'River', 'Milo', 'Nova'][counter % 5], /* textonly=true declares a literal chatmessage string, not HTML; preserve its characters and keep display formatting out of the payload. */ textonly: true, id: counter,
                chatmessage: typeof game.previewCommand === 'function' ? game.previewCommand(counter) : mode === 'signal' ? '!code ' + (counter % 7 === 0 ? game.secret : Array.from({ length: 4 }, function () { return 1 + Math.floor(Math.random() * 6); }).join('')) : '!vote ' + (1 + counter % 3) });
        }, 2000);
        return; // Demo never opens a session or sends messages.
    }
    if (!session) return;
    if (chatRelay.enabled) {
        var endpoint = chatRelay.url, socket, retry;
        try { var parsed = new URL(endpoint); if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') throw new Error(); }
        catch (_) { return; }
        function connect() {
            try { socket = new WebSocket(endpoint); } catch (_) { return; }
            socket.onopen = function () { socket.send(JSON.stringify({ join: session.split(',')[0], out: chatRelay.out, in: chatRelay.in })); };
            socket.onmessage = function (event) { if (typeof event.data !== 'string' || event.data.length > 256000) return; try { receive(JSON.parse(event.data)); } catch (_) {} };
            socket.onerror = function () { socket.close(); };
            socket.onclose = function () { clearTimeout(retry); retry = setTimeout(connect, 5000); };
        }
        connect(); return;
    }
    var bridge = document.createElement('iframe'); bridge.title = 'SSN chat connection';
    bridge.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-100px;top:-100px';
    bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(session) + '&novideo&noaudio&label=dock&cleanoutput&room=' + encodeURIComponent(session);
    window.addEventListener('message', function (event) {
        if (event.source !== bridge.contentWindow) return;
        var data = event.data && event.data.dataReceived; if (data && data.overlayNinja) receive(data.overlayNinja);
    });
    document.body.appendChild(bridge);
})();
