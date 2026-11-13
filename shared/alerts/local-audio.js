(function (root) {
    'use strict';
    var cache = new Map(), pending = new Map(), cacheSize = 0;
    var maxBytes = 16 * 1024 * 1024, maxCache = 48 * 1024 * 1024;
    var counter = 0;

    function valid(info) {
        return info && typeof info.id === 'string' && info.id.length <= 100 &&
            /^[a-f0-9]{64}$/.test(info.hash) && /^audio\/[a-z0-9.+-]+$/i.test(info.mime) &&
            Number.isSafeInteger(info.size) && info.size > 0 && info.size <= maxBytes;
    }
    function finish(job, error, url) {
        if (pending.get(job.key) !== job) return;
        clearTimeout(job.timer);
        pending.delete(job.key);
        job.chunks.length = 0;
        if (error) {
            try { job.send({ action: 'localAudioRead', id: job.info.id, requestId: job.requestId, cancel: true }, job.peer); } catch (_) {}
            job.reject(error);
        }
        else job.resolve(url);
    }
    function request(job) {
        clearTimeout(job.timer);
        job.timer = setTimeout(function () { finish(job, new Error('Local sound transfer timed out. Try again, or use Upload.')); }, 10000);
        if (Date.now() - job.started > 120000 || !job.send({ action: 'localAudioRead', id: job.info.id,
            requestId: job.requestId, offset: job.offset }, job.peer)) {
            finish(job, new Error('Local sounds need a WebRTC connection, Upload, or the Local Flow Actions URL.'));
        }
    }
    function get(info, peer, send) {
        if (!valid(info)) return Promise.reject(new Error('Use Upload or the Local Flow Actions URL for this sound.'));
        var key = info.hash + ':' + info.mime;
        if (cache.has(key)) {
            var cached = cache.get(key);
            cache.delete(key); cache.set(key, cached);
            return Promise.resolve(cached);
        }
        if (pending.has(key)) return pending.get(key).promise;
        if (!peer) return Promise.reject(new Error('Use Upload or the Local Flow Actions URL for this sound.'));
        if (pending.size >= 4) return Promise.reject(new Error('Too many local sounds are loading.'));
        var job = { key: key, info: info, peer: peer, send: send, offset: 0, chunks: [], started: Date.now(),
            requestId: 'audio_' + Date.now().toString(36) + '_' + (++counter), timer: null };
        job.promise = new Promise(function (resolve, reject) { job.resolve = resolve; job.reject = reject; });
        pending.set(key, job);
        request(job);
        return job.promise;
    }
    async function receive(packet, peer) {
        if (!packet || packet.actionType !== 'local_audio_chunk') return false;
        var job;
        pending.forEach(function (candidate) {
            if (candidate.requestId === packet.requestId && candidate.info.id === packet.id && candidate.peer === peer) job = candidate;
        });
        if (!job || packet.offset !== job.offset || job.verifying) return true;
        var expected = Math.min(16384, Math.ceil(job.info.size / 3) * 4 - job.offset);
        if (typeof packet.data !== 'string' || packet.data.length !== expected || !/^[A-Za-z0-9+/]*={0,2}$/.test(packet.data)) {
            finish(job, new Error('Invalid local sound transfer.'));
            return true;
        }
        job.chunks.push(packet.data);
        job.offset += packet.data.length;
        if (job.offset < Math.ceil(job.info.size / 3) * 4) { request(job); return true; }
        job.verifying = true;
        clearTimeout(job.timer);
        try {
            var base64 = job.chunks.join(''), decoded = atob(base64), bytes = new Uint8Array(decoded.length);
            for (var i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
            if (bytes.length !== job.info.size) throw new Error('Incomplete local sound transfer.');
            var digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
            var hash = Array.from(digest, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
            if (hash !== job.info.hash) throw new Error('Local sound verification failed. Trigger it again.');
            if (pending.get(job.key) !== job) return true;
            // Data URLs remain valid for already playing/queued clips when an
            // older cache entry is evicted. Nothing is uploaded or stored on disk.
            var url = 'data:' + job.info.mime + ';base64,' + base64;
            cache.set(job.key, url); cacheSize += url.length;
            while (cacheSize > maxCache || cache.size > 32) {
                var oldest = cache.keys().next().value;
                cacheSize -= cache.get(oldest).length; cache.delete(oldest);
            }
            finish(job, null, url);
        } catch (error) { finish(job, error); }
        return true;
    }
    function cancel() {
        pending.forEach(function (job) { finish(job, new Error('Local sound transfer cancelled.')); });
    }
    root.addEventListener('pagehide', function () { cancel(); cache.clear(); cacheSize = 0; });
    root.SSNLocalAudio = { get: get, receive: receive, cancel: cancel };
})(window);
