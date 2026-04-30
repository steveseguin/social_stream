(function (global) {
    'use strict';

    function safeClone(value) {
        return value ? JSON.parse(JSON.stringify(value)) : value;
    }

    function createWorkerClient(options) {
        var settings = options || {};
        var workerPath = settings.workerPath || 'local-browser-model-worker.js';
        var initTimeoutMs = Number.isFinite(settings.initTimeoutMs) ? settings.initTimeoutMs : 420000;
        var generateTimeoutMs = Number.isFinite(settings.generateTimeoutMs) ? settings.generateTimeoutMs : 300000;
        var disposeTimeoutMs = Number.isFinite(settings.disposeTimeoutMs) ? settings.disposeTimeoutMs : 120000;
        var onStatus = typeof settings.onStatus === 'function' ? settings.onStatus : function () {};
        var onProgress = typeof settings.onProgress === 'function' ? settings.onProgress : function () {};
        var onToken = typeof settings.onToken === 'function' ? settings.onToken : function () {};
        var onError = typeof settings.onError === 'function' ? settings.onError : function () {};
        var worker = null;
        var pending = new Map();
        var requestCounter = 0;
        var connected = false;
        var activeInitKey = '';
        var activeConfig = null;

        function isRecoverableWebGPUError(error) {
            var message = String((error && error.message) || error || '').toLowerCase();
            return message.includes('webgpu') || message.includes('no available backend found');
        }

        function createWorker() {
            worker = new Worker(workerPath, { type: 'module' });
            worker.onmessage = handleMessage;
            worker.onerror = function (event) {
                var errorMessage = (event && event.message) || 'Local browser model worker error';
                onError(new Error(errorMessage));
                terminateWorker();
            };
            worker.onmessageerror = function () {
                onError(new Error('Local browser model worker message error'));
                terminateWorker();
            };
        }

        function clearState() {
            connected = false;
            activeInitKey = '';
            activeConfig = null;
        }

        function rejectPending(errorMessage) {
            pending.forEach(function (entry, requestId) {
                clearTimeout(entry.timeoutId);
                entry.reject(new Error(errorMessage || 'Local browser worker request failed.'));
                pending.delete(requestId);
            });
        }

        function terminateWorker() {
            if (worker) {
                try {
                    worker.terminate();
                } catch (_error) {}
            }
            worker = null;
            rejectPending('Local browser model worker was terminated.');
            clearState();
        }

        function handleMessage(event) {
            var message = event && event.data ? event.data : {};
            var entry;

            if (!message || typeof message !== 'object') {
                return;
            }
            if (message.type === 'status') {
                onStatus(message);
                return;
            }
            if (message.type === 'progress') {
                onProgress(message);
                return;
            }
            if (message.type === 'token') {
                onToken(message);
                return;
            }
            if (message.type !== 'response' || !message.requestId) {
                return;
            }

            entry = pending.get(message.requestId);
            if (!entry) {
                return;
            }

            clearTimeout(entry.timeoutId);
            pending.delete(message.requestId);

            if (message.ok) {
                entry.resolve(message);
            } else {
                entry.reject(new Error(message.error || 'Local browser worker request failed.'));
            }
        }

        function request(type, payload, timeoutMs) {
            var requestId;

            if (!worker) {
                return Promise.reject(new Error('Local browser model worker is not available.'));
            }

            requestId = 'local-browser-' + Date.now() + '-' + (++requestCounter);

            return new Promise(function (resolve, reject) {
                var timeoutId = setTimeout(function () {
                    pending.delete(requestId);
                    reject(new Error(type + ' timed out.'));
                }, timeoutMs);

                pending.set(requestId, {
                    resolve: resolve,
                    reject: reject,
                    timeoutId: timeoutId
                });

                worker.postMessage(Object.assign({
                    type: type,
                    requestId: requestId
                }, payload || {}));
            });
        }

        async function connect(providerKey, overrides) {
            var catalog = global.SSNBrowserModelCatalog;
            var initPayload;
            var initKey;
            var requestedOverrides;

            if (!catalog || typeof catalog.buildWorkerInit !== 'function') {
                throw new Error('Local browser model catalog is not available.');
            }

            requestedOverrides = overrides || {};
            initPayload = catalog.buildWorkerInit(providerKey, requestedOverrides);
            initKey = JSON.stringify(initPayload);

            if (worker && connected && activeInitKey === initKey) {
                return safeClone(activeConfig);
            }

            if (worker) {
                terminateWorker();
            }

            createWorker();
            try {
                await request('init', initPayload, initTimeoutMs);
            } catch (error) {
                if (String(initPayload.device || '').toLowerCase() === 'wasm' || !isRecoverableWebGPUError(error)) {
                    terminateWorker();
                    throw error;
                }

                terminateWorker();
                initPayload = catalog.buildWorkerInit(providerKey, Object.assign({}, requestedOverrides, { device: 'wasm' }));
                initKey = JSON.stringify(initPayload);
                createWorker();
                await request('init', initPayload, initTimeoutMs);
            }
            connected = true;
            activeInitKey = initKey;
            activeConfig = initPayload;

            return safeClone(activeConfig);
        }

        async function generate(providerKey, payload, overrides) {
            var requestPayload = payload || {};
            var requestOverrides = overrides || {};
            var currentDevice;

            await connect(providerKey, requestOverrides);
            try {
                return await request('generate', requestPayload, generateTimeoutMs);
            } catch (error) {
                currentDevice = String((activeConfig && activeConfig.device) || requestPayload.device || requestOverrides.device || '').toLowerCase();
                if (currentDevice === 'wasm' || !isRecoverableWebGPUError(error)) {
                    throw error;
                }

                await connect(providerKey, Object.assign({}, requestOverrides, { device: 'wasm' }));
                return request('generate', Object.assign({}, requestPayload, { device: 'wasm' }), generateTimeoutMs);
            }
        }

        async function reset() {
            if (!worker) {
                return;
            }
            await request('reset', {}, disposeTimeoutMs);
        }

        async function dispose() {
            if (!worker) {
                clearState();
                return;
            }

            try {
                await request('dispose', {}, disposeTimeoutMs);
            } catch (_error) {
                // Best effort cleanup.
            }

            terminateWorker();
        }

        return {
            connect: connect,
            generate: generate,
            reset: reset,
            dispose: dispose,
            isConnected: function () {
                return connected && !!worker;
            },
            getActiveConfig: function () {
                return safeClone(activeConfig);
            }
        };
    }

    global.SSNLocalBrowserLLM = {
        createWorkerClient: createWorkerClient
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.SSNLocalBrowserLLM;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
