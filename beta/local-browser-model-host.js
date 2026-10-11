(function () {
    'use strict';
    // SSApp runs GPU workers here, in a renderer separate from its UI/background.
    var bridge = window.ssnLocalModelHost;
    if (!bridge) return;
    var workers = new Map();
    bridge.onCommand(function (command) {
        var id = command.id;
        var worker = workers.get(id);
        try {
            if (command.op === 'create') {
                if (worker) worker.terminate();
                worker = new Worker('local-browser-model-worker.js' + location.search, { type: 'module' });
                workers.set(id, worker);
                worker.onmessage = function (event) { bridge.send({ id: id, data: event.data }); };
                worker.onerror = function (event) {
                    bridge.send({ id: id, error: event.message || 'Local AI worker failed.' });
                };
                worker.onmessageerror = function () {
                    bridge.send({ id: id, error: 'Local AI worker message could not be read.' });
                };
            } else if (command.op === 'post' && worker) {
                worker.postMessage(command.data);
            } else if (command.op === 'terminate' && worker) {
                worker.terminate();
                workers.delete(id);
            }
        } catch (error) {
            bridge.send({ id: id, error: error.message || String(error) });
        }
    });
    // A worker's native GPU deadlock also blocks renderer IPC. Monitor that from
    // the main process, which remains able to replace this isolated renderer.
    setInterval(function () { bridge.send({ heartbeat: true }); }, 1000);
    bridge.send({ ready: true });
})();
