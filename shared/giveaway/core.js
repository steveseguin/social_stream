(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SSNGiveaway = api;
})(typeof window !== 'undefined' ? window : this, function() {
    'use strict';
    function create(options) {
        options = options || {};
        var epoch = String(Date.now()) + '-' + String(options.epoch || 'host');
        var entries = new Map(), wonIds = new Set(), winners = [], open = false, revision = 0, draw = 0;
        var config = { keyword: '!enter', match: 'exact', membersOnly: false, removeWinner: true };
        function snapshot() {
            return { epoch: epoch, revision: revision, draw: draw, open: open, keyword: config.keyword,
                count: entries.size, entrants: Array.from(entries.values()).slice(0, 120),
                winners: winners.slice(0, 20), config: Object.assign({}, config) };
        }
        function configure(next) {
            next = next || {};
            var previous = config;
            config = Object.assign({}, config);
            try {
                if (Object.prototype.hasOwnProperty.call(next, 'keyword')) {
                    var keyword = String(next.keyword || '').trim();
                    if (!keyword || keyword.length > 80) throw new Error('Enter a keyword between 1 and 80 characters.');
                    config.keyword = keyword;
                }
                if (next.match !== undefined) {
                    if (['exact', 'word'].indexOf(next.match) === -1) throw new Error('Choose exact or word matching.');
                    config.match = next.match;
                }
                ['membersOnly', 'removeWinner'].forEach(function(key) {
                    if (next[key] !== undefined) {
                        if (typeof next[key] !== 'boolean') throw new Error(key + ' must be true or false.');
                        config[key] = next[key];
                    }
                });
            } catch (error) { config = previous; throw error; }
        }
        function ingest(data) {
            if (!open || !data || data.event || data.bot || data.reflection || data.replay || data.history || data.reload || data.private) return false;
            if (typeof data.chatname !== 'string' || !data.chatname.trim() || typeof data.chatmessage !== 'string') return false;
            if (config.membersOnly && !(data.membership || data.hasMembership)) return false;
            var message = data.chatmessage.trim().toLowerCase();
            var keyword = config.keyword.toLowerCase();
            if (config.match === 'exact' ? message !== keyword : message.split(/\s+/).indexOf(keyword) === -1) return false;
            var platform = String(data.type || data.platform || 'unknown').toLowerCase();
            var identity = String(data.userid || data.username || data.chatname).trim().toLowerCase();
            var id = JSON.stringify([platform, identity]);
            if (entries.has(id) || entries.size >= 10000) return false;
            if (config.removeWinner && wonIds.has(id)) return false;
            entries.set(id, { id: id, name: data.chatname.slice(0, 160), platform: platform.slice(0, 40) });
            revision++;
            return true;
        }
        function randomIndex(count) {
            // Rejection sampling avoids modulo bias; never silently fall back to Math.random.
            var cryptoApi = options.crypto;
            if (!cryptoApi || !cryptoApi.getRandomValues) throw new Error('Secure random selection is unavailable.');
            var buffer = new Uint32Array(1), limit = 4294967296 - (4294967296 % count);
            do { cryptoApi.getRandomValues(buffer); } while (buffer[0] >= limit);
            return buffer[0] % count;
        }
        function command(action, value) {
            if (action === 'getgiveawaystate') return snapshot();
            if (action === 'startgiveaway') { configure(value); open = true; }
            else if (action === 'closegiveaway') open = false;
            else if (action === 'resetgiveaway') { entries.clear(); wonIds.clear(); winners = []; open = false; draw = 0; }
            else if (action === 'drawgiveaway') {
                if (!entries.size) throw new Error('There are no eligible entries.');
                var pool = Array.from(entries.values());
                var winner = Object.assign({}, pool[randomIndex(pool.length)], { drawnAt: Date.now() });
                open = false;
                winners.unshift(winner);
                winners = winners.slice(0, 20);
                wonIds.add(winner.id);
                // Keep all winning IDs until reset to prevent winners from re-entering.
                if (config.removeWinner) entries.delete(winner.id);
                draw++;
            } else throw new Error('Unknown giveaway command.');
            revision++;
            return snapshot();
        }
        return { ingest: ingest, command: command, snapshot: snapshot, isOpen: function() { return open; } };
    }
    return { create: create };
});
