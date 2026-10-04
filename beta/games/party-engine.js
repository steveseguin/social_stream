(function (root) {
    'use strict';
    var words = ('lantern garden planet melody puzzle rocket velvet picnic sunset forest candle winter summer spring autumn marble copper silver ribbon pocket pillow dragon castle island ocean meadow blossom thunder rainbow feather notebook compass telescope cinnamon butterfly waterfall sunflower snowflake starlight firefly').split(' ');
    var cards = {
        number: { title: 'Number Hunt', subtitle: 'Follow the clues together', command: '!guess 50', seconds: 90, hint: 'Find the secret number from 1 to 100. Each guess narrows the range.', labels: [] },
        shuffle: { title: 'Word Shuffle', subtitle: 'A little wordplay for the room', command: '!solve lantern', seconds: 60, hint: 'Unscramble the letters. Every round uses one English word.', labels: [] },
        showdown: { title: 'Rock Paper Showdown', subtitle: 'Make your move', command: '!throw rock', seconds: 30, hint: 'Choose rock, paper, or scissors. Beat the hidden house move when time runs out.', labels: ['rock', 'paper', 'scissors'] },
        minority: { title: 'Minority Club', subtitle: 'Think differently, together', command: '!pick sun', seconds: 30, hint: 'Pick sun, moon, or star. The smallest non-empty group wins. A tie for smallest is a draw.', labels: ['sun', 'moon', 'star'] }
    };
    function Game(mode, options) {
        this.mode = mode; this.card = cards[mode]; this.options = options || {};
        this.now = this.options.now || Date.now; this.random = this.options.random || Math.random;
        this.seconds = this.card.seconds; this.reset();
    }
    Game.prototype.reset = function () { this.round = 0; this.begin(); };
    Game.prototype.begin = function () {
        this.round++; this.phase = 'waiting'; this.deadline = 0; this.result = ''; this.history = [];
        this.users = new Map(); this.votes = new Map(); this.seen = new Set(); this.low = 1; this.high = 100;
        this.secret = this.mode === 'number' ? 1 + Math.floor(this.random() * 100) : this.mode === 'shuffle' ? words[Math.floor(this.random() * words.length)] : Math.floor(this.random() * 3);
        var letters = String(this.secret).split('');
        for (var i = letters.length - 1; i > 0; i--) { var j = Math.floor(this.random() * (i + 1)), swap = letters[i]; letters[i] = letters[j]; letters[j] = swap; }
        this.scrambled = letters.join('');
        if (this.scrambled === this.secret) this.scrambled = letters.slice(1).concat(letters[0]).join('');
    };
    Game.prototype.tick = function () { if (this.phase === 'active' && this.now() >= this.deadline) this.finish(); };
    Game.prototype.next = function () { if (this.phase === 'result') this.begin(); };
    Game.prototype.finish = function (winner) {
        if (this.phase !== 'active') return;
        this.phase = 'result';
        if (this.mode === 'number' || this.mode === 'shuffle') {
            this.result = (winner ? winner + ' solved it! ' : 'Time is up. ') + 'The answer was ' + this.secret + '.'; return;
        }
        var counts = [0, 0, 0]; this.votes.forEach(function (v) { counts[v]++; });
        if (this.mode === 'showdown') {
            var won = counts[(this.secret + 1) % 3];
            this.result = 'House played ' + this.card.labels[this.secret] + '. ' + won + ' won, ' + counts[this.secret] + ' drew, ' + counts[(this.secret + 2) % 3] + ' lost.';
        } else {
            var smallest = Math.min.apply(null, counts.filter(function (n) { return n > 0; }));
            var winners = counts.map(function (n, i) { return n === smallest ? i : -1; }).filter(function (i) { return i >= 0; });
            this.result = winners.length === 1 ? this.card.labels[winners[0]] + ' wins with ' + smallest + (smallest === 1 ? ' viewer.' : ' viewers.') : 'Draw! The smallest groups tied.';
        }
    };
    Game.prototype.input = function (message) {
        this.tick();
        if (!message || message.bot || message.private || message.reflection || message.event || !message.chatname || !message.type || this.phase === 'result') return false;
        var patterns = { number: /^!guess\s+([1-9]\d?|100)$/i, shuffle: /^!solve\s+([a-z]{3,20})$/i, showdown: /^!throw\s+(rock|paper|scissors)$/i, minority: /^!pick\s+(sun|moon|star)$/i };
        var match = String(message.chatmessage || '').trim().match(patterns[this.mode]); if (!match) return false;
        var value = match[1].toLowerCase(), now = this.now(), key = String(message.type) + ':' + String(message.userid || message.username || message.chatname);
        if (!this.users.has(key) && this.users.size >= 1000) return false;
        if (this.users.has(key) && now - this.users.get(key) < (this.card.labels.length ? 1000 : 5000)) return false;
        if (this.mode === 'number' && (+value < this.low || +value > this.high)) return false;
        var id = message.id == null ? message.meta && message.meta.messageId : message.id;
        var duplicate = id == null ? null : String(message.type) + ':' + String(message.tid || '') + ':' + String(id);
        if (this.seen.size >= 2000 || duplicate && this.seen.has(duplicate)) return false;
        if (duplicate) this.seen.add(duplicate);
        this.users.set(key, now);
        if (this.phase === 'waiting') { this.phase = 'active'; this.deadline = now + this.seconds * 1000; }
        var name = String(message.chatname).slice(0, 48), feedback;
        if (this.card.labels.length) { this.votes.set(key, this.card.labels.indexOf(value)); return true; }
        if (this.mode === 'number') {
            feedback = +value === this.secret ? 'Found it!' : +value < this.secret ? 'Go higher' : 'Go lower';
            if (+value < this.secret) this.low = +value + 1; else if (+value > this.secret) this.high = +value - 1;
        } else feedback = value === this.secret ? 'Solved!' : 'Keep shuffling';
        this.history.unshift({ name: name, code: value, feedback: feedback }); this.history = this.history.slice(0, 6);
        if (String(this.secret) === value) this.finish(name);
        return true;
    };
    Game.prototype.previewCommand = function (counter) {
        if (this.mode === 'number') return '!guess ' + (counter % 5 === 0 ? this.secret : Math.floor((this.low + this.high) / 2));
        if (this.mode === 'shuffle') return '!solve ' + (counter % 5 === 0 ? this.secret : words[counter % words.length]);
        return (this.mode === 'showdown' ? '!throw ' : '!pick ') + this.card.labels[counter % 3];
    };
    root.SSNAudienceGame = { Game: Game, cards: cards };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.SSNAudienceGame;
})(typeof globalThis !== 'undefined' ? globalThis : window);
