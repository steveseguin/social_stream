(function (root) {
    'use strict';
    var chapters = [
        { title: 'A little further from home.', story: 'The beacon is beyond the blue moon. Chat, choose our first stop.', choices: [
            ['Moon market', 'Recover two supplies', 2, 0], ['Crystal field', 'Spend one supply, find two discoveries', -1, 2], ['Quiet orbit', 'Find one discovery', 0, 1] ] },
        { title: 'Something in the static.', story: 'A faint melody drifts through the radio. Where should we look?', choices: [
            ['Follow the music', 'Spend two supplies, find three discoveries', -2, 3], ['Scan from here', 'Find one discovery', 0, 1], ['Repair the antenna', 'Recover one supply', 1, 0] ] },
        { title: 'The floating greenhouse.', story: 'An abandoned garden circles a tiny sun. There is still life inside.', choices: [
            ['Gather starfruit', 'Recover two supplies', 2, 0], ['Map the gardens', 'Spend one supply, find two discoveries', -1, 2], ['Leave a seed', 'Find one discovery', 0, 1] ] },
        { title: 'Through the meteor shower.', story: 'The final stretch glitters with moving stars. Pick our passage.', choices: [
            ['Take the shortcut', 'Spend two supplies, find three discoveries', -2, 3], ['Trace the long arc', 'Find one discovery', 0, 1], ['Dock and recharge', 'Recover two supplies', 2, 0] ] },
        { title: 'A light to bring home.', story: 'We reached the beacon. What will our crew remember?', choices: [
            ['Record its song', 'Spend one supply, find two discoveries', -1, 2], ['Sketch the skyline', 'Find one discovery', 0, 1], ['Light a new beacon', 'Spend two supplies, find three discoveries', -2, 3] ] }
    ];
    function clue(secret, guess) {
        var exact = 0, remaining = [], other = [];
        for (var i = 0; i < 4; i++) {
            if (secret[i] === guess[i]) exact++;
            else { remaining.push(secret[i]); other.push(guess[i]); }
        }
        var misplaced = 0;
        other.forEach(function (digit) { var at = remaining.indexOf(digit); if (at >= 0) { misplaced++; remaining.splice(at, 1); } });
        return { exact: exact, misplaced: misplaced };
    }
    function Game(mode, options) {
        this.mode = mode; this.options = options || {}; this.now = this.options.now || Date.now;
        this.random = this.options.random || Math.random; this.seconds = mode === 'signal' ? 90 : 30;
        this.reset();
    }
    Game.prototype.reset = function () {
        this.stage = 0; this.supplies = 4; this.discoveries = 0; this.round = 0;
        this.result = ''; this.begin();
    };
    Game.prototype.begin = function () {
        this.round++; this.phase = 'waiting'; this.deadline = 0; this.history = [];
        this.users = new Map(); this.votes = new Map(); this.seen = new Set(); this.guesses = new Set(); this.lastInput = -Infinity;
        this.secret = Array.from({ length: 4 }, function () { return String(1 + Math.floor(this.random() * 6)); }, this).join('');
    };
    Game.prototype.tick = function () {
        if (this.phase === 'active' && this.now() >= this.deadline) this.finish();
    };
    Game.prototype.finish = function (winner) {
        if (this.phase !== 'active') return;
        this.phase = 'result';
        if (this.mode === 'signal') {
            this.result = winner ? winner + ' opened the signal. Nice teamwork.' : 'Signal closed. The code was ' + this.secret + '.';
        } else {
            var counts = [0, 0, 0]; this.votes.forEach(function (v) { counts[v]++; });
            var best = Math.max.apply(null, counts), tied = [];
            counts.forEach(function (n, i) { if (n === best) tied.push(i); });
            var selected = tied[Math.floor(this.random() * tied.length)], choice = chapters[this.stage].choices[selected];
            this.supplies += choice[2]; this.discoveries += choice[3];
            this.result = choice[0] + '. ' + choice[1] + (tied.length > 1 ? '. Tie: route chosen at random.' : '.');
        }
    };
    Game.prototype.next = function () {
        if (this.phase !== 'result') return;
        if (this.mode === 'quest') {
            if (this.stage === chapters.length - 1) { this.reset(); return; }
            this.stage++;
        }
        this.begin();
    };
    Game.prototype.input = function (message) {
        this.tick();
        if (!message || message.bot || message.private || message.reflection || message.event || !message.chatname || !message.type || this.phase === 'result') return false;
        var text = String(message.chatmessage || '').trim();
        var match = text.match(this.mode === 'signal' ? /^!code\s+([1-6]{4})$/i : /^!vote\s+([123])$/i);
        if (!match) return false;
        var now = this.now(), key = String(message.type) + ':' + String(message.userid || message.username || message.chatname);
        if (!this.users.has(key) && this.users.size >= 1000) return false;
        if (this.users.has(key) && now - this.users.get(key) < (this.mode === 'signal' ? 5000 : 1000)) return false;
        if (this.mode === 'signal' && (now - this.lastInput < 250 || this.guesses.has(match[1]))) return false;
        var id = message.id || message.meta && message.meta.messageId;
        var duplicate = id == null ? null : String(message.type) + ':' + String(message.tid || '') + ':' + String(id);
        if (duplicate && this.seen.has(duplicate)) return false;
        if (this.seen.size >= 2000) return false;
        var vote = Number(match[1]) - 1;
        if (this.mode === 'quest' && this.supplies + chapters[this.stage].choices[vote][2] < 0) return false;
        if (duplicate) this.seen.add(duplicate);
        this.users.set(key, now); this.lastInput = now;
        if (this.phase === 'waiting') { this.phase = 'active'; this.deadline = now + this.seconds * 1000; }
        if (this.mode === 'quest') this.votes.set(key, vote);
        else {
            var feedback = clue(this.secret, match[1]);
            this.guesses.add(match[1]);
            this.history.unshift({ name: String(message.chatname).slice(0, 48), code: match[1], exact: feedback.exact, misplaced: feedback.misplaced });
            this.history = this.history.slice(0, 6);
            if (feedback.exact === 4) this.finish(String(message.chatname).slice(0, 48));
        }
        return true;
    };
    root.SSNAudienceGame = { Game: Game, clue: clue, chapters: chapters };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.SSNAudienceGame;
})(typeof globalThis !== 'undefined' ? globalThis : window);
