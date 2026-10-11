(function (global) {
    'use strict';
    function create(options) {
        var mode = options.mode;
        var worker = null, workerPending = null, qwen = null;
        var queue = [], running = false, closed = false, counter = 0, modelReady = false, unreviewed = 0;
        var records = new Map();
        var prefilter = new global.SSNCensorPrefilter.Detector({ maxEntries: 512 });
        function status(text) { if (!closed && options.onStatus) options.onStatus(text); }
        function failWorker(error) {
            if (workerPending) { clearTimeout(workerPending.timer); workerPending.reject(error); workerPending = null; }
            if (worker) worker.terminate();
            worker = null;
            modelReady = false;
        }
        function ibm(text) {
            if (!worker) {
                worker = new Worker(options.workerPath);
                worker.onmessage = function (event) {
                    var message = event.data || {};
                    if (message.type === 'status') { status(message.text); return; }
                    if (!workerPending || message.id !== workerPending.id) return;
                    var pending = workerPending; workerPending = null; clearTimeout(pending.timer);
                    if (message.ok) pending.resolve(message.score);
                    else {
                        worker.terminate(); worker = null; modelReady = false;
                        pending.reject(new Error(message.error));
                    }
                };
                worker.onerror = function (event) { failWorker(new Error(event.message || 'Classifier worker failed.')); };
                worker.onmessageerror = function () { failWorker(new Error('Classifier response could not be read.')); };
            }
            return new Promise(function (resolve, reject) {
                var id = ++counter;
                workerPending = { id: id, resolve: resolve, reject: reject, timer: setTimeout(function () { failWorker(new Error('Classifier timed out.')); }, 120000) };
                worker.postMessage({ id: id, text: text });
            });
        }
        async function infer(text) {
            if (mode === 'ibm') {
                var score = await ibm(text);
                if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error('Classifier returned an invalid score.');
                modelReady = true;
                return score >= 0.8;
            }
            if (!qwen) {
                qwen = global.SSNLocalBrowserLLM.createWorkerClient({
                    workerPath: options.qwenWorkerPath,
                    onStatus: function (message) { status(message.message || message.text || 'Loading Qwen 0.8B…'); },
                    onProgress: function (message) {
                        var total = Number(message.total), loaded = Number(message.loaded);
                        status(total > 0 ? 'Qwen download: ' + (loaded / 1000000).toFixed(1) + ' / ' + (total / 1000000).toFixed(1) + ' MB (' + (message.file || 'model data') + ')' : 'Downloading/loading Qwen 0.8B…');
                    }
                });
            }
            var result = await qwen.generate('localqwen', {
                prompt: options.qwenPrompt(text),
                stateless: true, moderation: true, maxNewTokens: 8, temperature: 0.15, topP: 0.9
            });
            var answer = String(result.text || '').trim().toUpperCase().replace(/[.!]$/, '');
            if (answer !== 'OK' && answer !== 'BLOCK') throw new Error('Qwen did not return a valid moderation decision.');
            modelReady = true;
            return answer === 'BLOCK';
        }
        function block(entries) {
            entries.forEach(function (entry) {
                if (!entry || entry.blocked || entry.deleted) return;
                entry.blocked = true;
                if (!entry.test && options.onBlock) options.onBlock(entry.input);
            });
        }
        async function drain() {
            if (running || closed) return;
            running = true;
            while (queue.length && !closed) {
                var job = queue.shift();
                try {
                    if (!job.entry.deleted && (!job.entry.blocked || job.entry.test)) {
                        var blocked = await infer(job.entry.input.text);
                        if (closed) throw new Error('Censor model changed.');
                        if (blocked) block([job.entry]);
                    }
                    if (modelReady) status((mode === 'ibm' ? 'IBM classifier' : 'Qwen 0.8B') + ' ready' + (unreviewed ? ' — ' + unreviewed + ' messages could not be reviewed.' : ''));
                    job.resolve({ blocked: job.entry.blocked || !!job.entry.deleted });
                } catch (error) {
                    if (!job.entry.test) unreviewed++;
                    status('Unavailable: ' + (error.message || String(error)));
                    job.reject(error);
                }
            }
            running = false;
        }
        function review(input, test) {
            if (global.location && global.location.protocol === 'moz-extension:') {
                var message = 'Local censor models are not included in the Firefox extension. Select the main AI model for censoring.';
                status('Unavailable: ' + message);
                return Promise.reject(new Error(message));
            }
            if (closed) return Promise.reject(new Error('Censor model changed.'));
            if (input.text.length > 16000) {
                if (!test) unreviewed++;
                status('Unavailable: message is too long for local moderation.');
                return Promise.reject(new Error('Message is too long for local moderation.'));
            }
            var entry = { input: input, blocked: false, test: !!test };
            if (!test) {
                records.set(input.id, entry);
                while (records.size > 2048) records.delete(records.keys().next().value);
            }
            if (mode === 'ibm') {
                var detector = test ? new global.SSNCensorPrefilter.Detector() : prefilter;
                var decision = detector.push(input);
                if (decision.route === 'block') {
                    block(decision.ids.map(function (id) { return id === input.id ? entry : records.get(id); }));
                    if (!test) return Promise.resolve({ blocked: true });
                }
                if (decision.route === 'allow' && !test) return Promise.resolve({ blocked: false });
            }
            if (queue.length >= 64) {
                if (!test) unreviewed++;
                var error = new Error('Censor queue is full. Message was not reviewed.');
                status('Unavailable: ' + error.message);
                return Promise.reject(error);
            }
            return new Promise(function (resolve, reject) { queue.push({ entry: entry, resolve: resolve, reject: reject }); drain(); });
        }
        return {
            review: review,
            forget: function (deletion) {
                var matches = [];
                var hasId = deletion.id !== undefined && deletion.id !== null && deletion.id !== '';
                records.forEach(function (entry) {
                    var message = entry.input.original;
                    if (!message || (deletion.type && message.type !== deletion.type)) return;
                    if (deletion.tid !== undefined && deletion.tid !== null && String(message.tid) !== String(deletion.tid)) return;
                    if (deletion.meta && deletion.meta.streamUsername && String(message.meta && message.meta.streamUsername).toLowerCase() !== String(deletion.meta.streamUsername).toLowerCase()) return;
                    var nativeId = deletion.meta && deletion.meta.messageId;
                    if (nativeId) {
                        if (String(message.meta && message.meta.messageId) !== String(nativeId)) return;
                    } else if (hasId) {
                        if (String(message.id) !== String(deletion.id)) return;
                    } else if (deletion.userid) {
                        if (String(message.userid) !== String(deletion.userid)) return;
                    } else if (deletion.username) {
                        if (message.username !== deletion.username) return;
                    } else if (deletion.chatname && message.chatname !== deletion.chatname) return;
                    matches.push(entry);
                });
                if (deletion.onlyLast && !hasId && !(deletion.meta && deletion.meta.messageId)) matches = matches.slice(-1);
                matches.forEach(function (entry) {
                    prefilter.forget(entry.input);
                    entry.deleted = true;
                    records.delete(entry.input.id);
                });
            },
            isBlocked: function (id) { var entry = records.get(id); return !!(entry && entry.blocked); },
            close: function () {
                closed = true; failWorker(new Error('Censor model changed.'));
                queue.splice(0).forEach(function (job) { job.reject(new Error('Censor model changed.')); });
                if (qwen) qwen.dispose().catch(function () {});
                prefilter.reset(); records.clear();
            }
        };
    }
    global.SSNCensorModels = { create: create };
}(typeof globalThis !== 'undefined' ? globalThis : this));
