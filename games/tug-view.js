(function () {
    'use strict';
    window.SSNTugView = {
        clock: function (game, now) {
            document.getElementById('prompt-clock').textContent = game.phase === 'active' ? Math.max(0, Math.ceil((game.promptDeadline - now) / 1000)) + 's' : '';
        },
        render: function (game, el, history) {
            document.getElementById('round').textContent = 'Match ' + game.round;
            document.getElementById('join-hint').hidden = game.phase !== 'active';
            document.getElementById('prompt-card').hidden = game.phase === 'result';
            document.getElementById('prompt-action').textContent = game.phase === 'waiting' ? 'Chat' : game.promptKind === 'Type this word' ? 'Type in chat' : 'Answer in chat';
            var prompt = document.getElementById('tug-prompt');
            if (prompt.textContent !== game.prompt) { prompt.textContent = game.prompt; prompt.classList.remove('drop'); void prompt.offsetWidth; prompt.classList.add('drop'); }
            document.getElementById('arena').style.setProperty('--pull', (game.position / game.goal * 15) + '%');
            document.getElementById('tug-progress').setAttribute('aria-valuenow', String(game.position));
            document.getElementById('tug-progress').setAttribute('aria-valuetext', game.position === 0 ? 'Rope centered' : Math.abs(game.position) + ' tugs toward ' + (game.position < 0 ? 'Coral' : 'Mint'));
            for (var team = 0; team < 2; team++) {
                document.getElementById('team-pulls-' + team).textContent = game.pulls[team];
                var list = document.getElementById('team-roster-' + team); list.textContent = '';
                var players = []; game.users.forEach(function (player) { if (player.team === team) players.push(player); });
                players.sort(function (a, b) { return b.pulls - a.pulls; });
                var latest = game.history[0];
                players.slice(0, 8).forEach(function (player) {
                    var row = el('li');
                    if (latest && latest.name === player.name && latest.team === team) row.className = 'last-player';
                    row.appendChild(el('span', player.name));
                    row.appendChild(el('b', player.pulls));
                    list.appendChild(row);
                });
                if (players.length > 8) list.appendChild(el('li', '+ ' + (players.length - 8) + ' teammates'));
            }
            game.history.slice(0, 4).forEach(function (item) { history.appendChild(el('span', item.name + ' ' + item.action + (item.team === 0 ? ' for Coral' : ' for Mint'), 'tug-activity team-' + item.team)); });
        }
    };
})();
