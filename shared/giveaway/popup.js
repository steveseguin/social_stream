(function() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function() {
        var status = document.getElementById('giveaway-control-status');
        var state = null, busy = false;
        function giveawayId() { return document.getElementById('giveaway-id').value.trim() || 'default'; }
        function show(response) {
            if (!response || !response.ok) { status.textContent = response && response.error || 'Giveaway host is unavailable. Refresh before retrying.'; return; }
            if (response.giveaway.giveawayId !== giveawayId()) return;
            state = response.giveaway;
            status.textContent = (state.open ? 'Entries open' : 'Entries closed') + ' - ' + state.count + ' eligible entries.' +
                (state.ticketCount ? ' ' + state.ticketCount + ' tickets.' : '') + (state.winners.length ? ' Latest winner: ' + state.winners[0].name : '') +
                (state.status === 'cancelled' ? ' Cancelled; reserved points refunded.' : '');
        }
        document.querySelectorAll('[data-giveaway-action]').forEach(function(button) {
            button.addEventListener('click', function() {
                var action = button.dataset.giveawayAction;
                if (busy) return;
                var value = {giveawayId:giveawayId(), operationId:Date.now().toString(36) + '-' + Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')};
                if (state && state.giveawayId === value.giveawayId) value.roundId = state.roundId;
                if (action === 'startgiveaway') value.config = {
                    keyword: document.getElementById('giveaway-keyword').value,
                    match: document.getElementById('giveaway-match').value,
                    membersOnly: document.querySelector('[data-setting="giveawayMembersOnly"]').checked,
                    removeWinner: !document.querySelector('[data-setting="giveawayRepeatWinners"]').checked,
                    ticketCost:Number(document.getElementById('giveaway-cost').value), maxTickets:Number(document.getElementById('giveaway-limit').value),
                    prizePoints:Number(document.getElementById('giveaway-prize').value), winnerCount:Number(document.getElementById('giveaway-winners').value),
                    kind:document.getElementById('giveaway-kind').value
                };
                busy = true;
                document.querySelectorAll('[data-giveaway-action]').forEach(function(b) {b.disabled=true;});
                chrome.runtime.sendMessage({cmd:action, value:value}, function(response) {
                    busy = false;
                    document.querySelectorAll('[data-giveaway-action]').forEach(function(b) {b.disabled=false;});
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
                var source=new URL(raw);
                ['session','password','localserver','localserverport'].forEach(function(key){
                    if(source.searchParams.has(key))url.searchParams.set(key,source.searchParams.get(key));
                });
                if(['localserver','server','server2','server3'].some(function(key){return source.searchParams.has(key);})) {
                    var relay=source.searchParams.get('server') || source.searchParams.get('server2') || source.searchParams.get('server3') || '';
                    url.searchParams.set('server',relay);
                }
            }catch(_) {}}
            window.open(url.href,'_blank','noopener');
        });
        document.getElementById('giveaway-id').addEventListener('input',function() {state=null;status.textContent='Refresh to inspect this giveaway.';});
    });
})();
