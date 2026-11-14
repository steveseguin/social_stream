(function() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function() {
        var status = document.getElementById('giveaway-control-status');
        var state = null, busy = false, refreshing = false, actionVersion = 0, statusError = false;
        function giveawayId() { return document.getElementById('giveaway-id').value.trim() || 'default'; }
        function updateButtons() {
            var current = state && state.giveawayId === giveawayId() ? state : null;
            var labels = {
                startgiveaway: [current && current.open, '\u25b6 Open entries', '\u25cf Entries open'],
                closegiveaway: [current && current.status === 'locked', '\u23f8 Close entries', '\u23f8 Entries closed'],
                drawgiveaway: [current && current.status === 'completed', '\ud83c\udfc6 Draw winner', '\u2713 Draw complete'],
                cancelgiveaway: [current && current.status === 'cancelled', '\u25a0 Cancel and refund', '\u25a0 Cancelled']
            };
            document.querySelectorAll('[data-giveaway-action]').forEach(function(button) {
                var label = labels[button.dataset.giveawayAction];
                button.disabled = busy;
                button.classList.toggle('giveaway-current', !!(label && label[0]));
                if (label) button.textContent = label[label[0] ? 2 : 1];
            });
            status.setAttribute('aria-busy', String(busy));
        }
        function updateFields() {
            var kind = document.getElementById('giveaway-kind').value;
            document.getElementById('giveaway-trivia-options').hidden = kind !== 'trivia';
            document.getElementById('giveaway-keyword').parentElement.style.display = kind === 'trivia' ? 'none' : '';
            document.getElementById('giveaway-match').parentElement.style.display = kind === 'trivia' ? 'none' : '';
            document.getElementById('giveaway-duration').parentElement.style.display = kind !== 'giveaway' && kind !== 'trivia' ? 'none' : '';
        }
        document.getElementById('giveaway-kind').addEventListener('change', updateFields);
        updateFields();
        function show(response) {
            if (!response || !response.ok) { statusError = true; status.textContent = response && response.error || 'Giveaway host is unavailable. Refresh before retrying.'; return; }
            if (response.giveaway.giveawayId !== giveawayId()) return;
            state = response.giveaway;
            updateButtons();
            statusError = false;
            status.textContent = (state.open ? 'Entries open' : 'Entries closed') + ' - ' + state.count + ' eligible entries.' +
                (state.ticketCount ? ' ' + state.ticketCount + ' tickets.' : '') + (state.winners.length ? ' Latest winner: ' + state.winners[0].name : '') +
                (state.status === 'cancelled' ? ' Cancelled; reserved points refunded.' : '');
            if (state.open && state.endsAt) status.textContent += ' Draw in ' + Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) + 's.';
        }
        function refreshStatus() {
            updateFields();
            if (busy || refreshing || document.hidden || !status.getClientRects().length) return;
            if (!statusError && state && state.open && state.endsAt) show({ok:true,giveaway:state});
            var requestedId = giveawayId(), version = actionVersion;
            refreshing = true;
            chrome.runtime.sendMessage({cmd:'listgiveaways'}, function(response) {
                refreshing = false;
                if (busy || version !== actionVersion || requestedId !== giveawayId() || !response || !response.ok) return;
                var current = response.giveaways.find(function(round) { return round.giveawayId === requestedId; });
                if (current && (!state || state.roundId !== current.roundId || state.revision !== current.revision)) show({ok:true,giveaway:current});
            });
        }
        var refreshTimer = setInterval(refreshStatus, 1000);
        document.addEventListener('visibilitychange', refreshStatus);
        window.addEventListener('beforeunload', function() { clearInterval(refreshTimer); });
        document.querySelectorAll('[data-giveaway-action]').forEach(function(button) {
            button.addEventListener('click', function() {
                var action = button.dataset.giveawayAction;
                if (busy) return;
                actionVersion++;
                var value = {giveawayId:giveawayId(), operationId:Date.now().toString(36) + '-' + Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')};
                if (state && state.giveawayId === value.giveawayId) value.roundId = state.roundId;
                if (action === 'startgiveaway') value.config = {
                    keyword: document.getElementById('giveaway-keyword').value,
                    match: document.getElementById('giveaway-match').value,
                    membersOnly: document.querySelector('[data-setting="giveawayMembersOnly"]').checked,
                    removeWinner: !document.querySelector('[data-setting="giveawayRepeatWinners"]').checked,
                    ticketCost:Number(document.getElementById('giveaway-cost').value), maxTickets:Number(document.getElementById('giveaway-limit').value),
                    prizePoints:Number(document.getElementById('giveaway-prize').value), winnerCount:Number(document.getElementById('giveaway-winners').value),
                    kind:document.getElementById('giveaway-kind').value,
                    durationSeconds:['giveaway','trivia'].indexOf(document.getElementById('giveaway-kind').value) !== -1 ? Number(document.getElementById('giveaway-duration').value) : 0,
                    triviaQuestion:document.getElementById('giveaway-question').value,
                    triviaAnswer:document.getElementById('giveaway-answer').value
                };
                busy = true;
                updateButtons();
                chrome.runtime.sendMessage({cmd:action, value:value}, function(response) {
                    busy = false;
                    updateButtons();
                    show(response);
                });
            });
        });
        document.getElementById('giveaway-preview').addEventListener('click', function() {
            var preview = new URL('giveaway.html', location.href);
            preview.searchParams.set('session', 'test');
            preview.searchParams.set('managed', '');
            preview.searchParams.set('preview', '');
            preview.searchParams.set('presentation', document.getElementById('giveaway-presentation').value);
            preview.searchParams.set('theme', document.getElementById('giveaway-theme').value);
            preview.searchParams.set('title', document.getElementById('giveaway-title').value || 'Giveaway');
            preview.searchParams.set('backdrop', document.getElementById('giveaway-backdrop').value);
            window.open(preview.href, '_blank', 'noopener');
        });
        document.getElementById('giveaway-manage').addEventListener('click',function() {
            var url = new URL('giveaway-control.html',location.href); url.searchParams.set('giveaway',giveawayId());
            var raw=document.getElementById('giveaway').raw;
            if(raw){try{
                var dock = document.getElementById('dock');
                var source=new URL(dock && dock.raw || raw);
                ['session','password','localserver','localserverport','server','server2','server3'].forEach(function(key){
                    if(source.searchParams.has(key))url.searchParams.set(key,source.searchParams.get(key));
                });
                // The audience's server flag does not grant host API permission.
                url.searchParams.delete('server');
                if (typeof lastResponse !== 'undefined' && lastResponse && lastResponse.password) url.searchParams.set('password', lastResponse.password);
            }catch(_) {}}
            window.open(url.href,'_blank','noopener');
        });
        document.getElementById('giveaway-id').addEventListener('input',function() {actionVersion++;state=null;updateButtons();status.textContent='Refresh to inspect this giveaway.';refreshStatus();});
    });
})();
