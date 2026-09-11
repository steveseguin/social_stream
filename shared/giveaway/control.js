(function () {
    'use strict';
    var params = new URLSearchParams(location.search), field = document.getElementById('giveaway'), status = document.getElementById('status');
    field.value = params.get('giveaway') || 'default';
    var native = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage, bridge, peer, pending = new Map(), state = null, history = [], entryPage = 1;
    var relayMode = params.has('localserver') || params.has('server') || params.has('server2') || params.has('server3'), socket, retry, refreshRetry, stopped = false;
    function id() { return Date.now().toString(36) + '-' + Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'); }
    function call(action, value) {
        return new Promise(function (resolve, reject) {
            var key = id(), timer = setTimeout(function () { pending.delete(key); reject(new Error('Host did not answer. ' + (relayMode && !native ? 'Enable remote API control of extension in the SSN popup. ' : '') + 'Refresh to check whether the action committed.')); }, 10000);
            function done(reply) { clearTimeout(timer); pending.delete(key); if (!reply || !reply.ok)
                reject(new Error(reply && (reply.error && reply.error.message || reply.error) || 'Host unavailable.'));
            else
                resolve(reply); }
            if (native) {
                chrome.runtime.sendMessage({ cmd: action, value: value }, done);
                return;
            }
            if (relayMode) {
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    done({ ok: false, error: 'Waiting for the relay connection. Check the server address and connection settings.' });
                    return;
                }
                pending.set(key, done);
                socket.send(JSON.stringify({ protocol: 2, action: action, value: value, get: key, replyFormat: 'commandResult' }));
                return;
            }
            if (!peer) {
                clearTimeout(timer);
                reject(new Error('Waiting for your SSN host. Open the controller from the popup.'));
                return;
            }
            pending.set(key, done);
            bridge.contentWindow.postMessage({ sendData: { overlayNinja: { protocol: 2, action: action, value: value, get: key } }, type: 'rpcs', UUID: peer }, '*');
        });
    }
    function describe(s) {
        state = s;
        status.textContent = s.giveawayId + ': ' + s.status + ' — ' + s.count + ' viewers, ' + s.ticketCount + ' tickets.' + (s.outcome ? ' ' + s.outcome + ' wins.' : '');
        document.getElementById('rules').textContent = s.config.kind === 'number' ? '!guess ' + s.giveawayId + ' NUMBER — guess ' + (s.number ? s.number.low + '–' + s.number.high : '1–100') + '; one guess per viewer every 5 seconds; ' + s.config.prizePoints + ' point prize. The first correct guess wins automatically.' :
            s.config.kind === 'coin' ? '!ticket ' + s.giveawayId + ' COUNT heads (or tails) — 1 point per stake. Winners split the pot.' :
            s.config.ticketCost ? '!ticket ' + s.giveawayId + ' COUNT — ' + s.config.ticketCost + ' points per ticket; maximum ' + s.config.maxTickets + ' per viewer; ' + s.config.prizePoints + ' point prize per winner.' :
                s.keyword + ' — one free entry per viewer; ' + s.config.prizePoints + ' point prize per winner.';
    }
    async function refresh() {
        describe((await call('getgiveawaystate', { giveawayId: field.value })).giveaway);
        var rounds = (await call('listgiveaways', {})).giveaways, area = document.getElementById('rounds');
        area.textContent = '';
        rounds.forEach(function (r) { var b = document.createElement('button'); b.textContent = r.giveawayId + ' · ' + r.status; b.onclick = function () { field.value = r.giveawayId; run(refresh); }; area.appendChild(b); });
    }
    async function loadHistory() {
        history = (await call('getgiveawayhistory', {})).history;
        var target = document.getElementById('history');
        target.textContent = '';
        var table = document.createElement('table'), head = document.createElement('tr');
        ['Giveaway', 'Winner', 'Platform', 'Points', 'Drawn'].forEach(function (s) { var th = document.createElement('th'); th.textContent = s; head.appendChild(th); });
        table.appendChild(head);
        history.slice().reverse().forEach(function (round) { round.winners.forEach(function (w) { var row = document.createElement('tr'); [round.giveawayId, w.name, w.platform, w.points || 0, new Date(w.drawnAt).toLocaleString()].forEach(function (s) { var td = document.createElement('td'); td.textContent = s; row.appendChild(td); }); table.appendChild(row); }); });
        target.appendChild(table);
    }
    async function loadEntries() {
        var reply = await call('getgiveawayentries', { giveawayId: field.value, page: entryPage }), area = document.getElementById('entries');
        area.textContent = 'Page ' + entryPage + ' · ' + reply.total + ' participants';
        var list = document.createElement('ul');
        reply.entries.forEach(function (e) { var item = document.createElement('li'); item.textContent = e.name + ' (' + e.platform + ') — ' + e.tickets + ' tickets, ' + e.reserved + ' points reserved. '; var remove = document.createElement('button'); remove.textContent = 'Remove and refund'; remove.onclick = function () { run(async function () { await call('removegiveawayentry', { giveawayId: field.value, roundId: reply.roundId, entryId: e.id, operationId: id() }); await loadEntries(); await refresh(); }); }; item.appendChild(remove); list.appendChild(item); });
        area.appendChild(list);
    }
    function download(name, text) { var url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); }
    async function run(work) { document.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); try {
        await work();
    }
    catch (e) {
        status.textContent = e.message;
    }
    finally {
        document.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    } }
    document.getElementById('refresh').onclick = function () { run(refresh); };
    document.getElementById('entries-refresh').onclick = function () { entryPage = 1; run(loadEntries); };
    document.getElementById('entries-prev').onclick = function () { entryPage = Math.max(1, entryPage - 1); run(loadEntries); };
    document.getElementById('entries-next').onclick = function () { entryPage++; run(loadEntries); };
    document.getElementById('history-refresh').onclick = function () { run(loadHistory); };
    document.getElementById('export').onclick = function () { run(async function () { await loadHistory(); download('ssn-giveaway-winners.json', JSON.stringify({ version: 1, exportedAt: Date.now(), history: history }, null, 2)); }); };
    document.getElementById('backup').onclick = function () {
        if (!native) {
            document.getElementById('backup-status').textContent = 'Use the popup Points section on the host to export a complete backup.';
            return;
        }
        chrome.runtime.sendMessage({ cmd: 'exportPointsData' }, function (reply) { if (reply && reply.success && reply.data) {
            download('ssn-economy-backup.json', reply.data);
            document.getElementById('backup-status').textContent = 'Backup saved.';
        }
        else
            document.getElementById('backup-status').textContent = reply && reply.error || 'Backup unavailable.'; });
    };
    document.querySelectorAll('[data-action]').forEach(function (b) { b.onclick = function () { run(async function () { var value = { giveawayId: field.value, operationId: id() }; if (state && state.giveawayId === field.value)
        value.roundId = state.roundId; if (b.dataset.action === 'startgiveaway' && state)
        value.config = state.config; describe((await call(b.dataset.action, value)).giveaway); await loadHistory(); }); }; });
    field.oninput = function () { state = null; status.textContent = 'Refresh to inspect this giveaway.'; };
    document.getElementById('recover').onchange = function (event) { var file = event.target.files[0]; if (!file)
        return; if (!native) {
        status.textContent = 'Complete recovery must run on the host.';
        return;
    } run(async function () { var data = await file.text(); var reply = await new Promise(function (resolve) { chrome.runtime.sendMessage({ cmd: 'recoverEconomyBackup', data: data }, resolve); }); if (!reply || !reply.success)
        throw new Error(reply && reply.error || 'Recovery failed.'); status.textContent = 'Recovered ' + reply.users + ' accounts. Review closed rounds before reopening. Set the popup stream ID to the original backup session: ' + (reply.sessions || []).join(', '); }); };
    if (native) {
        run(refresh);
        return;
    }
    if (!params.get('session')) {
        status.textContent = 'Open this controller from the SSN popup to connect to your host.';
        return;
    }
    if (relayMode) {
        // The relay can accept connections before the host has rejoined after
        // a restart. Retry only reads; never replay an unconfirmed control.
        function refreshRelay() {
            run(async function () {
                try { await refresh(); }
                catch (error) {
                    if (!stopped && socket.readyState === WebSocket.OPEN) refreshRetry = setTimeout(refreshRelay, 2000);
                    throw error;
                }
            });
        }
        function connect() {
            if (stopped) return;
            try { socket = new WebSocket(SocialStreamLocalServer.getRelayUrl(params, params.has('server') ? 'server' : params.has('server2') ? 'server2' : 'server3', 'wss://io.socialstream.ninja/api')); }
            catch (error) { status.textContent = 'Invalid relay address.'; return; }
            socket.onopen = function () {
                socket.send(JSON.stringify({ join: params.get('session').split(',')[0], out: 1, in: 2 }));
                clearTimeout(refreshRetry);
                refreshRelay();
            };
            socket.onmessage = function (event) {
                try {
                    var packet = JSON.parse(event.data);
                    var callback = packet.callback || (packet.type === 'commandResult' && packet.result
                        ? { get: packet.result.request, result: packet.result } : null);
                    if (callback && pending.has(callback.get)) {
                        var reply = callback.result;
                        // Other display pages can acknowledge the same API token.
                        // Only a structured host result can resolve a giveaway request.
                        if (!reply || typeof reply !== 'object' || typeof reply.ok !== 'boolean') return;
                        pending.get(callback.get)(reply && reply.payload || reply);
                    }
                } catch (error) { console.warn('[Giveaway] Invalid host reply', error); }
            };
            socket.onerror = function () { socket.close(); };
            socket.onclose = function () {
                clearTimeout(refreshRetry);
                pending.forEach(function (done) { done({ ok: false, error: 'Relay connection lost. Refresh after reconnecting to check whether the action committed.' }); });
                if (!stopped) {
                    status.textContent = 'Relay disconnected. Reconnecting...';
                    retry = setTimeout(connect, 2000);
                }
            };
        }
        window.addEventListener('beforeunload', function () {
            stopped = true;
            clearTimeout(retry);
            clearTimeout(refreshRetry);
            if (socket) socket.close();
        });
        connect();
        return;
    }
    bridge = document.createElement('iframe');
    bridge.hidden = true;
    bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=' + encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(params.get('session')) + '&novideo&noaudio&label=giveaway&cleanoutput&room=' + encodeURIComponent(params.get('session'));
    window.addEventListener('message', function (event) {
        if (event.source !== bridge.contentWindow)
            return;
        var data = event.data || {};
        if ((data.action === 'push-connection-info' || data.action === 'view-connection-info') && data.value && data.value.label === 'SocialStream') {
            peer = data.UUID;
            run(refresh);
        }
        var reply = data.dataReceived && data.dataReceived.overlayNinja;
        if (reply && reply.get && pending.has(reply.get))
            pending.get(reply.get)(reply.payload || reply);
    });
    document.body.appendChild(bridge);
})();
