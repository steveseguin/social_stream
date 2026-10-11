(function (root) {
    'use strict';
    // Fast, explicit word matches complement the contextual classifier.
    var words = ['fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'cunt', 'nigger', 'faggot', 'kys'];
    var substitutions = { a: '[a@4]', c: '[cç]', e: '[e3]', f: 'f', g: '[g9]', h: 'h', i: '[i1!íìï]', k: 'k', l: '[l1]', m: 'm', n: 'n', o: '[o0ö]', r: 'r', s: '[s$5]', t: '[t7]', u: '[uüúùυ]', y: 'y' };
    var gap = '[\\s._\\-\\u200b-\\u200d\\u2060\\ufeff]{0,3}';
    var patterns = words.map(function (word) {
        var body = word.split('').map(function (c, i) {
            // Masked letters only in the interior; do not match arbitrary punctuation.
            var piece = substitutions[c] || c;
            if (i > 0 && i < word.length - 1) piece = '(?:' + piece + '|\\*)';
            return piece + '{1,8}';
        }).join(gap);
        return { word: word, re: new RegExp('(^|[^\\p{L}\\p{N}])(' + body + ')(?=$|[^\\p{L}\\p{N}])', 'iu') };
    });
    var safe = new Set(['hi','hello','hey','lol','gg','gg!','good game!','thanks','thank you','nice','welcome','good morning','good night','brb','ok','okay','yes','no','???','👍','😂','❤️']);
    function normalized(text) { return String(text || '').normalize('NFKC').toLowerCase(); }
    function match(text) {
        text = normalized(text);
        for (var i = 0; i < patterns.length; i++) if (patterns[i].re.test(text)) return patterns[i].word;
        return null;
    }
    function fragment(text) {
        var s = normalized(text).replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
        // Only entire short fragments enter the history. Never pluck letters out of sentences.
        if (!/^[a-z0-9@!$üúùυç._\-\s]{1,16}$/.test(s)) return null;
        s = s.replace(/[._\-\s]/g, '').replace(/[üúùυ]/g,'u').replace(/ç/g,'c')
            .replace(/0/g,'o').replace(/[1!]/g,'i').replace(/3/g,'e').replace(/4|@/g,'a').replace(/5|\$/g,'s').replace(/7/g,'t');
        return /^[a-z]{1,8}$/.test(s) ? s : null;
    }
    function isPrefix(s) { return words.some(function (w) { return w.length > s.length && w.indexOf(s) === 0; }); }
    function Detector(options) {
        this.options = Object.assign({ gapMs: 1500, totalMs: 8000, maxEntries: 4096 }, options || {});
        this.states = new Map();
        this.seen = new Map();
    }
    Detector.prototype.reset = function () { this.states.clear(); this.seen.clear(); };
    Detector.prototype.forget = function (e) {
        var sourceKey = e.scope && e.platform ? JSON.stringify([e.scope,e.platform]) : null;
        if (!sourceKey || e.id === undefined) return;
        this.seen.delete(JSON.stringify([sourceKey,String(e.id)]));
        this.states.forEach(function (entries,key) {
            if (JSON.parse(key)[1] !== sourceKey) return;
            // An edit/delete invalidates the spelling run; do not splice unrelated pieces together.
            if (entries.some(function(x){return String(x.id)===String(e.id);})) this.states.delete(key);
        },this);
    };
    Detector.prototype.push = function (e) {
        var now = e.time;
        if (!Number.isFinite(now)) throw new Error('Monotonic arrival time required');
        var sourceKey = e.scope && e.platform ? JSON.stringify([e.scope,e.platform]) : null;
        var stableId = e.userid !== undefined && e.userid !== null && String(e.userid) !== '' ? String(e.userid) : null;
        var eventKey = sourceKey && e.id !== undefined ? JSON.stringify([sourceKey,String(e.id)]) : null;
        var signature = JSON.stringify([stableId,String(e.text || '')]);
        if (eventKey && this.seen.has(eventKey)) {
            var seen = this.seen.get(eventKey);
            if (seen.signature === signature) return Object.assign({},seen.result,{ replay:true });
            this.forget(e);
        }
        var s = fragment(e.text), matches = [], pendingIds = [];
        var keys = [];
        if (sourceKey && stableId !== null) keys.push(JSON.stringify(['user',sourceKey,stableId]));
        for (var ki = 0; ki < keys.length; ki++) {
            var key = keys[ki];
            var previous = this.states.get(key) || [];
            var invalidRun = !!previous.invalidRun;
            var last = previous[previous.length - 1];
            if (last && (now < last.time || now - last.time > this.options.gapMs)) { previous = []; invalidRun = false; }
            previous = previous.filter(function (x) { return now - x.time <= this.options.totalMs; },this);
            if (!previous.length) invalidRun = false;
            if (invalidRun && s && s.length === 1) {
                previous.push({ id:e.id, text:s, time:now, userid:stableId });
                previous = previous.slice(-12); previous.invalidRun = true;
                this.states.delete(key); this.states.set(key,previous); continue;
            }
            if (invalidRun) previous = [];
            if (!s) previous = [];
            else previous.push({ id:e.id, text:s, time:now, userid:stableId });
            if (previous.length > 12) previous = previous.slice(-12);
            var keep = [];
            var found = false;
            for (var start = 0; start < previous.length; start++) {
                // A suffix inside a spelled innocent word is not a new word boundary.
                if (start > 0 && previous.every(function(x){ return x.text.length === 1; })) continue;
                var suffix = previous.slice(start), joined = suffix.map(function (x) { return x.text; }).join('');
                if (suffix.length > 1 && words.indexOf(joined) !== -1) {
                    matches.push({ word:joined, ids:suffix.map(function(x){return x.id;}), scope:'user' });
                    keep = []; found = true; break;
                }
                if (isPrefix(joined) && !keep.length) keep = suffix;
            }
            if (keep.length) {
                this.states.delete(key); this.states.set(key,keep);
                pendingIds = pendingIds.concat(keep.map(function(x){return x.id;}));
            } else if (!found && previous.length > 1 && previous.every(function(x){ return x.text.length === 1; })) {
                previous.invalidRun = true; this.states.delete(key); this.states.set(key,previous);
            } else this.states.delete(key);
        }
        // Strict cap: eviction forgets context, never invents a rejection.
        while (this.states.size > this.options.maxEntries) this.states.delete(this.states.keys().next().value);
        var direct = match(e.text), split = matches.length ? matches[0] : null;
        var result = { id:e.id, route: direct || split ? 'block' : safe.has(normalized(e.text).trim()) ? 'allow' : 'review', reason:direct?'word':split?'split':safe.has(normalized(e.text).trim())?'known-safe':'model', word:direct || (split && split.word), ids:split?split.ids:[e.id], splitScope:split?split.scope:null, pendingIds:Array.from(new Set(pendingIds)) };
        if (eventKey) {
            this.seen.set(eventKey,{signature:signature,result:result});
            while (this.seen.size > this.options.maxEntries * 2) this.seen.delete(this.seen.keys().next().value);
        }
        return result;
    };
    root.SSNCensorPrefilter = { Detector:Detector, match:match, fragment:fragment, words:words.slice() };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.SSNCensorPrefilter;
}(typeof globalThis !== 'undefined' ? globalThis : this));
