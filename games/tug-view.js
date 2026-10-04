(function () {
    'use strict';
    window.SSNTugView = {
        clock: function (game, now) {
            document.getElementById('prompt-clock').textContent = game.phase === 'active' ? Math.max(0, Math.ceil((game.promptDeadline - now) / 1000)) + 's' : game.phase === 'waiting' ? 'Waiting for both teams' : 'Match complete';
        },
        render: function (game, el, history) {
            document.getElementById('round').textContent = 'Match ' + game.round;
            var prompt = document.getElementById('tug-prompt');
            if (prompt.textContent !== game.prompt) { prompt.textContent = game.prompt; prompt.classList.remove('drop'); void prompt.offsetWidth; prompt.classList.add('drop'); }
            document.getElementById('prompt-kind').textContent = game.promptKind;
            document.getElementById('arena').style.setProperty('--pull', (game.position / game.goal * 27) + '%');
            document.getElementById('tug-progress').setAttribute('aria-valuenow', String(game.position));
            document.getElementById('tug-progress').setAttribute('aria-valuetext', game.position === 0 ? 'Rope centered' : Math.abs(game.position) + ' tugs toward ' + (game.position < 0 ? 'Coral' : 'Mint'));
            document.getElementById('balance').textContent = game.position === 0 ? 'Even footing' : (game.position < 0 ? 'Coral' : 'Mint') + ' leads by ' + Math.abs(game.position);
            for (var team = 0; team < 2; team++) {
                document.getElementById('team-count-' + team).textContent = game.teams[team] + (game.teams[team] === 1 ? ' player' : ' players');
                document.getElementById('team-pulls-' + team).textContent = game.pulls[team] + (game.pulls[team] === 1 ? ' tug' : ' tugs');
                var list = document.getElementById('team-roster-' + team); list.textContent = '';
                var players = []; game.users.forEach(function (player) { if (player.team === team) players.push(player); });
                players.sort(function (a, b) { return b.pulls - a.pulls; });
                players.slice(0, 8).forEach(function (player) { var row = el('li'); row.appendChild(el('span', player.name)); row.appendChild(el('b', player.pulls)); list.appendChild(row); });
                if (players.length > 8) list.appendChild(el('li', '+ ' + (players.length - 8) + ' teammates'));
            }
            if (!game.history.length) history.appendChild(el('span', 'Type !join in chat. Your name will appear on your team.', 'empty'));
            game.history.slice(0, 4).forEach(function (item) { history.appendChild(el('span', item.name + ' ' + item.action + (item.team === 0 ? ' for Coral' : ' for Mint'), 'tug-activity team-' + item.team)); });
        }
    };
})();
