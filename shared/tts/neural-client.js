(function(global) {
    'use strict';
    var workerURL = new URL('./neural-worker.js', import.meta.url).href;

    function Player(volume, onStart) {
        var AudioContext = global.AudioContext || global.webkitAudioContext;
        if (!AudioContext) throw new Error('Audio playback is unavailable in this browser.');
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.connect(this.context.destination);
        this.sources = new Set();
        this.nextTime = 0;
        this.stopped = false;
        this.onStart = onStart;
        this.setVolume(volume);
    }
    Player.prototype.setVolume = function(volume) { this.gain.gain.value = Math.max(0, Math.min(1, Number(volume) || 0)); };
    Player.prototype.enqueue = async function(samples, sampleRate) {
        if (this.stopped) return;
        if (this.context.state === 'suspended') await this.context.resume();
        if (this.stopped) return;
        var buffer = this.context.createBuffer(1, samples.length, sampleRate);
        buffer.copyToChannel(samples, 0);
        var source = this.context.createBufferSource(), self = this;
        source.buffer = buffer;
        source.connect(this.gain);
        var start = Math.max(this.context.currentTime + (this.nextTime ? 0.025 : 0.15), this.nextTime);
        this.nextTime = start + buffer.duration;
        this.sources.add(source);
        source.onended = function() {
            source.disconnect(); self.sources.delete(source);
            if (!self.sources.size && self.finish) self.finish();
        };
        source.start(start);
        if (this.onStart) this.onStart({ duration: buffer.duration, volume: this.gain.gain.value, start: start });
    };
    Player.prototype.drain = function() {
        var self = this;
        return this.sources.size ? new Promise(function(resolve) { self.finish = resolve; }) : Promise.resolve();
    };
    Player.prototype.stop = function() {
        if (this.stopped) return;
        this.stopped = true;
        this.sources.forEach(function(source) { source.onended = null; try { source.stop(); } catch (_) {} source.disconnect(); });
        this.sources.clear();
        if (this.finish) this.finish();
        this.gain.disconnect();
        if (this.context.state !== 'closed') this.context.close().catch(function() {});
    };

    function Client() { this.worker = null; this.nextId = 0; this.pending = null; this.player = null; this.serial = 0; }
    Client.prototype.cancel = function() {
        this.serial++;
        if (this.worker) this.worker.terminate();
        this.worker = null;
        if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('Speech cancelled.')); this.pending = null; }
        if (this.player) this.player.stop();
        this.player = null;
    };
    Client.prototype.setVolume = function(volume) { if (this.player) this.player.setVolume(volume); };
    Client.prototype.speak = async function(options, callbacks) {
        if (this.pending || this.player) throw new Error('Speech is already playing.');
        if (typeof Worker !== 'function') throw new Error('Background speech requires a browser with Web Workers. Choose Standard processing.');
        callbacks = callbacks || {};
        var self = this, serial = ++this.serial, id = ++this.nextId;
        var playback = Promise.resolve(), playbackError = null;
        var player = options.silent ? null : new Player(options.volume, callbacks.onStart);
        this.player = player;
        try {
            if (!this.worker) {
                this.worker = new Worker(workerURL, { type: 'module' });
                this.worker.onmessage = function(event) {
                    var data = event.data, pending = self.pending;
                    if (!pending || data.id !== pending.id) return;
                    if (data.progress) { pending.progress(data.progress); return; }
                    clearTimeout(pending.timer); self.pending = null;
                    if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result);
                };
                this.worker.onerror = function() { self.cancel(); if (callbacks.onError) callbacks.onError('Background speech could not load.'); };
                this.worker.onmessageerror = function() { self.cancel(); };
            }
            var result = await new Promise(function(resolve, reject) {
                var timer = setTimeout(function() { self.cancel(); }, 300000);
                self.pending = { id: id, resolve: resolve, reject: reject, timer: timer, progress: function(progress) {
                    try {
                        if (progress.chunk && player) {
                            playback = playback.then(function() { if (serial === self.serial) return player.enqueue(progress.chunk, progress.sampleRate); }).catch(function(error) { playbackError = error; self.cancel(); });
                        } else if (callbacks.onProgress) callbacks.onProgress(progress);
                    } catch (error) { playbackError = error; self.cancel(); }
                } };
                self.worker.postMessage({ id: id, options: options });
            });
            if (serial !== this.serial) throw new Error('Speech cancelled.');
            if (!options.stream && player) {
                var decoded = await player.context.decodeAudioData(await result.blob.arrayBuffer());
                if (serial !== this.serial) throw new Error('Speech cancelled.');
                await player.enqueue(decoded.getChannelData(0), decoded.sampleRate);
            }
            await playback;
            if (playbackError) throw playbackError;
            if (player) await player.drain();
            if (serial !== this.serial) throw new Error('Speech cancelled.');
            return result;
        } finally {
            if (player) player.stop();
            if (this.player === player) this.player = null;
        }
    };
    global.SSNNeuralTTS = { Client: Client };
})(window);
