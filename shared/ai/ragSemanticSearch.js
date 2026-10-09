(function (global) {
    'use strict';
    function create(options) {
        var worker = null, ready = false, building = null, closed = false;
        var pending = new Map(), counter = 0, idleTimer, retryAt = 0;
        function status(text) { if (!closed) options.onStatus(text); }
        function stop() {
            clearTimeout(idleTimer);
            if (worker) worker.terminate();
            worker = null; ready = false;
            pending.forEach(function (p) { clearTimeout(p.timer); p.reject(new Error('Local search stopped.')); });
            pending.clear();
        }
        function idle() {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(function () { stop(); status('Local search is resting; keyword search is available while it resumes.'); }, 120000);
        }
        function request(type, value) {
            if (closed || pending.size >= 8) return Promise.reject(new Error('Local search is busy.'));
            if (!worker) {
                worker = new Worker(options.workerPath);
                var current = worker;
                worker.onmessage = function (event) {
                    if (worker !== current || closed) return;
                    var message = event.data, p = pending.get(message.id);
                    if (!p) return;
                    if (message.type === 'status') { status(message.text); return; }
                    pending.delete(message.id); clearTimeout(p.timer);
                    if (message.ok) p.resolve(message.result);
                    else p.reject(new Error(message.error));
                };
                worker.onerror = worker.onmessageerror = function () { if (worker === current) stop(); };
            }
            return new Promise(function (resolve, reject) {
                var id = ++counter;
                pending.set(id, { resolve: resolve, reject: reject, timer: setTimeout(function () { stop(); }, type === 'build' ? 300000 : 5000) });
                worker.postMessage(Object.assign({ id: id, type: type }, value));
            });
        }
        function warm() {
            if (closed || ready || building || Date.now() < retryAt) return building;
            building = (async function () {
                try {
                    var records = await options.getRecords();
                    if (closed) return;
                    if (!records.length) { status('Add files to use local search.'); return; }
                    var result = await request('build', { records: records });
                    if (closed) return;
                    ready = true;
                    status('Local search ready (' + result.count + ' passages).');
                    idle();
                    return result;
                } catch (error) {
                    if (!closed) {
                        retryAt = Date.now() + 60000; stop();
                        status('Using keyword search. ' + error.message);
                    }
                } finally { building = null; }
            }());
            return building;
        }
        return {
            warm: warm,
            search: async function (query) {
                if (closed) return null;
                if (!ready) { warm(); return null; }
                clearTimeout(idleTimer);
                try { return await request('search', { query: query }); }
                catch (error) { stop(); retryAt = Date.now() + 60000; status('Using keyword search. ' + error.message); return null; }
                finally { if (!closed && worker) idle(); }
            },
            close: function () { closed = true; stop(); }
        };
    }
    global.SSNRagSemanticSearch = { create: create };
}(typeof self !== 'undefined' ? self : globalThis));
