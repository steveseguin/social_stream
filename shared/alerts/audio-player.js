(function (global) {
    'use strict';
    // Opt-in playback for Event Flow clips. Legacy overlap playback stays separate.
    var pending = [], current = null;
    function blocked(value) { if (typeof global.SSNFlowAudio.onBlocked === 'function') global.SSNFlowAudio.onBlocked(value); }
    function stop() {
        pending.length = 0;
        if (current) { var item = current; current = null; clearTimeout(item.timer); item.audio.pause(); item.audio.removeAttribute('src'); item.audio.load(); }
        blocked(false);
    }
    function next() {
        if (current || !pending.length) return;
        var job = pending.shift(), audio = new Audio(job.url);
        var item = { audio: audio, timer: null, blocked: false, start: null }; current = item;
        audio.volume = Math.max(0, Math.min(1, Number.isFinite(Number(job.volume)) ? Number(job.volume) : .35));
        function finish(error) {
            if (current !== item) return;
            clearTimeout(item.timer); audio.pause(); current = null; blocked(false);
            if (error) console.warn('Audio clip failed:', error.message || error);
            next();
        }
        audio.onended = function () { finish(); };
        audio.onerror = function () { finish(new Error('The selected sound could not load.')); };
        item.timer = setTimeout(function () { finish(new Error('Audio clip timed out.')); }, 120000);
        item.start = function () {
            item.blocked = false;
            audio.play().then(function () { if (current === item) blocked(false); }).catch(function (error) {
                if (current !== item) return;
                if (error && error.name === 'NotAllowedError') { item.blocked = true; blocked(true); }
                else finish(error);
            });
        };
        item.start();
    }
    function play(url, volume, mode) {
        if (mode === 'interrupt') stop();
        if (pending.length >= 30) { console.warn('Audio queue is full.'); return false; }
        pending.push({ url: url, volume: volume }); next(); return true;
    }
    global.addEventListener('pagehide', stop);
    global.SSNFlowAudio = { play: play, stop: stop, retry: function () { if (!current || !current.blocked) return false; current.start(); return true; } };
})(window);
