(function (root) {
    'use strict';
    var words = 'rocket bubble pickle comet waffles noodle sparkle jellybean dinosaur marshmallow pumpkin banana rainbow popcorn cupcake dragon snowball lantern cactus penguin'.split(' ');
    function Game(mode, options) {
        this.options = options || {}; this.now = this.options.now || Date.now; this.random = this.options.random || Math.random;
        this.seconds = 180; this.goal = 20; this.tug = true; this.reset();
    }
    Game.prototype.reset = function () { this.round = 0; this.begin(); };
    Game.prototype.begin = function () {
        this.round++; this.phase = 'waiting'; this.deadline = 0; this.promptDeadline = 0; this.position = 0;
        this.users = new Map(); this.votes = new Map(); this.seen = new Set(); this.answered = new Set();
        this.teams = [0, 0]; this.pulls = [0, 0]; this.history = []; this.result = ''; this.promptNumber = 0;
        this.prompt = 'Two teams. One rope.'; this.answer = ''; this.promptKind = 'Join the game'; this.revision = 0;
    };
    Game.prototype.newPrompt = function () {
        var previous = this.answer;
        this.promptNumber++; this.answered.clear();
        if (this.promptNumber % 2) {
            var index = Math.floor(this.random() * words.length);
            if (words[index] === previous) index = (index + 1) % words.length;
            this.answer = words[index]; this.prompt = this.answer.toUpperCase(); this.promptKind = 'Type this word';
        } else {
            var a = 2 + Math.floor(this.random() * 10), b = 2 + Math.floor(this.random() * 10);
            var multiply = this.random() > 0.5;
            this.answer = String(multiply ? a * b : a + b);
            this.prompt = a + (multiply ? ' \u00d7 ' : ' + ') + b + ' = ?'; this.promptKind = 'What is the answer?';
        }
        this.promptDeadline = this.now() + 12000; this.revision++;
    };
    Game.prototype.tick = function () {
        if (this.phase !== 'active') return;
        if (this.now() >= this.deadline) { this.finish(); return; }
        if (this.now() >= this.promptDeadline) this.newPrompt();
    };
    Game.prototype.shiftTime = function (elapsed) { if (this.promptDeadline) this.promptDeadline += elapsed; };
    Game.prototype.finish = function () {
        if (this.phase !== 'active') return;
        this.phase = 'result'; this.revision++;
        this.result = this.position === 0 ? 'A perfect standoff! Both teams share the draw.' : (this.position < 0 ? 'Team Coral' : 'Team Mint') + ' wins! ' + (Math.abs(this.position) >= this.goal ? 'Over the line!' : 'Ahead when the clock ran out.');
    };
    Game.prototype.next = function () { if (this.phase === 'result') this.begin(); };
    Game.prototype.input = function (message) {
        this.tick();
        if (!message || message.bot || message.private || message.reflection || message.event || !message.type || !message.chatname || this.phase === 'result') return false;
        var text = String(message.chatmessage || '').trim().toLowerCase();
        var key = String(message.type) + ':' + String(message.userid || message.username || message.chatname);
        var player = this.users.get(key), join = text === '!join';
        if (!join && (!player || this.phase !== 'active' || this.answered.has(key) || text.replace(/^!answer\s+/, '') !== this.answer)) return false;
        if (join && (player || this.users.size >= 1000)) return false;
        var id = message.id == null ? message.meta && message.meta.messageId : message.id;
        var duplicate = id == null ? null : String(message.type) + ':' + String(message.tid || '') + ':' + String(id);
        if (duplicate && this.seen.has(duplicate) || this.seen.size >= 20000) return false;
        if (duplicate) this.seen.add(duplicate);
        if (join) {
            var team = this.teams[0] === this.teams[1] ? Math.floor(this.random() * 2) : this.teams[0] < this.teams[1] ? 0 : 1;
            player = { name: String(message.chatname).slice(0, 48), team: team, pulls: 0 };
            this.users.set(key, player); this.teams[team]++;
            this.history.unshift({name:player.name, team:team, action:'joined'});
            if (this.phase === 'waiting' && this.teams[0] && this.teams[1]) {
                this.phase = 'active'; this.deadline = this.now() + this.seconds * 1000; this.newPrompt();
            }
        } else {
            this.answered.add(key); this.position += player.team === 0 ? -1 : 1; this.pulls[player.team]++; player.pulls++;
            this.history.unshift({name:player.name, team:player.team, action:'pulled'});
            if (Math.abs(this.position) >= this.goal) this.finish();
        }
        this.history = this.history.slice(0, 6); this.revision++; return true;
    };
    Game.prototype.previewCommand = function (counter) { return counter <= 8 || this.phase === 'waiting' ? '!join' : this.answer; };
    root.SSNAudienceGame = {Game:Game};
    if (typeof module !== 'undefined' && module.exports) module.exports = root.SSNAudienceGame;
})(typeof globalThis !== 'undefined' ? globalThis : window);
