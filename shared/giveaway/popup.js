(function() {
    'use strict';
    document.addEventListener('DOMContentLoaded', function() {
        var status = document.getElementById('giveaway-control-status');
        document.querySelectorAll('[data-giveaway-action]').forEach(function(button) {
            button.addEventListener('click', function() {
                var action = button.dataset.giveawayAction;
                var value;
                if (action === 'startgiveaway') value = {
                    keyword: document.getElementById('giveaway-keyword').value,
                    match: document.getElementById('giveaway-match').value,
                    membersOnly: document.querySelector('[data-setting="giveawayMembersOnly"]').checked,
                    removeWinner: !document.querySelector('[data-setting="giveawayRepeatWinners"]').checked
                };
                button.disabled = true;
                chrome.runtime.sendMessage({cmd:action, value:value}, function(response) {
                    button.disabled = false;
                    if (!response || !response.ok) { status.textContent = response && response.error || 'Giveaway host is unavailable.'; return; }
                    var state = response.giveaway;
                    status.textContent = (state.open ? 'Entries open' : 'Entries closed') + ' - ' + state.count + ' eligible entries.' + (state.winners.length ? ' Latest winner: ' + state.winners[0].name : '');
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
            window.open(preview.href, '_blank', 'noopener');
        });
    });
})();
