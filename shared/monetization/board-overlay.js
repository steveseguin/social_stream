(function () {
    'use strict';
    var params = new URLSearchParams(location.search), demo = params.has('demo'), view = params.get('view') || 'board';
    var display = document.getElementById('commerce-display'), grid = document.getElementById('board-grid'), lastAt = 0, signature = '';
    var limit = Math.max(1, Math.min(24, Number(params.get('limit')) || (view === 'ticker' ? 3 : view === 'wall' ? 6 : 5)));
    var filters = (params.get('onlytype') || '').split(',').filter(Boolean);
    function matchesSource(sale) { return !filters.length || filters.indexOf(sale.platform || sale.source) !== -1; }
    function text(id, value) { document.getElementById(id).textContent = value; }
    function element(tag, value, className) { var e = document.createElement(tag); e.textContent = value; if (className) e.className = className; return e; }
    function render(raw) {
        if (!raw || typeof raw !== 'object') return;
        lastAt = Date.now(); var state = SSNCommerceBoards.publicState(raw), b = state.board;
        var next = JSON.stringify(view === 'board' ? b : [state.salesVisible, state.sales]); if (signature === next) { display.hidden = view === 'board' ? !b.visible || !b.spots.length : !state.salesVisible || !state.sales.some(matchesSource); return; } signature = next;
        display.className = '';
        if (view === 'board') {
            display.hidden = !b.visible || !b.spots.length; display.classList.add(b.style);
            display.style.setProperty('--columns', b.columns); display.style.setProperty('--mobile-columns', Math.min(b.columns, b.style === 'teams' ? 2 : 5));
            text('eyebrow', b.style === 'teams' ? 'Team board' : 'Spot board'); text('board-title', b.title);
            var available = b.spots.filter(function (s) { return s.status === 'available'; }).length;
            text('board-count', available + ' / ' + b.spots.length + ' available');
            b.spots.forEach(function (s, i) {
                var stamp = JSON.stringify(s), previous = grid.children[i];
                if (previous && previous.spotStamp === stamp) return;
                var tile = element('div', '', 'spot ' + s.status); tile.spotStamp = stamp; tile.appendChild(element('strong', s.label));
                if (s.status === 'revealed' && s.result) tile.appendChild(element('small', s.result, 'result'));
                tile.appendChild(element('small', s.status === 'available' ? 'Available' : s.status === 'claimed' ? '✓ Claimed' : '◆ Revealed'));
                if (previous) grid.replaceChild(tile, previous); else grid.appendChild(tile);
            });
            while (grid.children.length > b.spots.length) grid.removeChild(grid.lastChild);
            text('board-legend', 'Available  /  ✓ Claimed  /  ◆ Revealed');
        } else {
            grid.textContent = '';
            display.classList.add('sales'); if (view === 'wall' || view === 'ticker') display.classList.add(view);
            var sales = state.sales.filter(matchesSource).slice(0, limit);
            display.hidden = !state.salesVisible || !sales.length;
            text('eyebrow', 'From the show'); text('board-title', params.get('label') || 'Recently sold'); text('board-count', ''); text('board-legend', '');
            sales.forEach(function (s) { var tile = element('article', '', 'sale'), info = element('div', '');
                info.appendChild(element('strong', s.title)); info.appendChild(element('small', (s.quantity > 1 ? 'Qty ' + s.quantity + (s.amount !== null ? ' · Price is total · ' : ' · ') : '') + (s.source === 'Host confirmed' ? (s.platform ? (s.platform === 'whatnot' ? 'Whatnot' : s.platform === 'ebay' ? 'eBay Live' : s.platform) + ' · ' : '') + 'Host confirmed' : 'Purchase · ' + s.source))); tile.appendChild(info);
                if (params.get('prices') !== '0' && s.amount !== null && s.currency) { var money; try { money = new Intl.NumberFormat(undefined,{style:'currency',currency:s.currency}).format(s.amount); } catch (_) { money = s.currency + ' ' + s.amount.toFixed(2); } tile.appendChild(element('span', money, 'price')); }
                grid.appendChild(tile); });
        }
    }
    function receive(payload) {
        (Array.isArray(payload) ? payload.slice(0,100) : [payload]).forEach(function (d) {
            if (d && d.content) d = d.content;
            if (!d || d.private === true || d.isTest === true || d.testMode === true || d.event !== 'monetization_update') return;
            if (d.meta && d.meta.monetization && d.meta.monetization.boards) render(d.meta.monetization.boards);
        });
    }
    if (demo) {
        document.body.classList.add('demo'); document.getElementById('demo-label').hidden = false;
        var teams = params.get('style') === 'teams';
        var state = SSNCommerceBoards.apply({}, 'boardSave', {title:teams ? 'Saturday team break' : 'Choose your next reveal', style:teams ? 'teams' : 'spots', count:120, columns:teams ? 6 : 20,
            labels:teams ? 'Atlanta\nBoston\nBrooklyn\nCharlotte\nChicago\nCleveland\nDallas\nDenver\nDetroit\nGolden State\nHouston\nIndiana\nLA Clippers\nLA Lakers\nMemphis\nMiami\nMilwaukee\nMinnesota\nNew Orleans\nNew York\nOklahoma City\nOrlando\nPhiladelphia\nPhoenix\nPortland\nSacramento\nSan Antonio\nToronto\nUtah\nWashington' : ''});
        state.board.spots.forEach(function (s, i) { if (i % 7 === 0) { s.status = 'revealed'; s.result = teams ? 'Opened' : 'Card'; } else if (i % 3 === 0) s.status = 'claimed'; });
        ['Holographic collector card','Sealed booster pack','Signed rookie card','Vintage team jersey','Collector display case','Limited art print'].forEach(function (title, i) { state = SSNCommerceBoards.apply(state, 'saleAdd', {title:title, amount:[38,24,65,85,32,18][i], currency:'USD'}, Date.now()+i); });
        state.salesVisible = true; render(state); return;
    }
    var session = params.get('session'); if (!session) return;
    setInterval(function () { if (lastAt && Date.now() - lastAt > 35000) display.hidden = true; }, 1000);
    var relay = SocialStreamLocalServer.getChatRelayConfig(params);
    if (relay.enabled) {
        var socket, stopped = false, retry;
        function connect() {
            if (stopped) return;
            try { socket = new WebSocket(relay.url); } catch (_) { return; }
            socket.onopen = function () { socket.send(JSON.stringify({join:session.split(',')[0], out:relay.out, in:relay.in})); };
            socket.onmessage = function (e) { if (typeof e.data === 'string' && e.data.length < 256000) try { receive(JSON.parse(e.data)); } catch (_) {} };
            socket.onclose = function () { if (!stopped) retry = setTimeout(connect, 3000); }; socket.onerror = function () { socket.close(); };
        }
        window.addEventListener('beforeunload',function () { stopped = true; clearTimeout(retry); if (socket) socket.close(); }); connect(); return;
    }
    var bridge = document.createElement('iframe'); bridge.title = 'SSN connection'; bridge.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-100px;top:-100px';
    bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(session) + '&novideo&noaudio&label=dock&cleanoutput&room=' + encodeURIComponent(session);
    window.addEventListener('message', function (e) { if (e.source === bridge.contentWindow && e.data && e.data.dataReceived) receive(e.data.dataReceived.overlayNinja); }); document.body.appendChild(bridge);
})();
