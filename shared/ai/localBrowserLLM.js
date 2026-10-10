(function (global) {
    'use strict';

    function safeClone(value) {
        return value ? JSON.parse(JSON.stringify(value)) : value;
    }

    function createAppWorker(bridge) {
        var id = null;
        var stopped = false;
        var worker = { onmessage: null, onerror: null, onmessageerror: null };
        function fail(error) {
            if (!stopped && worker.onerror) worker.onerror({ message: error.message || String(error) });
        }
        var unsubscribe = bridge.onMessage(function (message) {
            if (stopped || message.id !== id) return;
            if (message.error) fail(new Error(message.error));
            else if (worker.onmessage) worker.onmessage({ data: message.data });
        });
        var ready = bridge.create().then(function (value) {
            id = value;
            if (stopped) return bridge.terminate(id);
        });
        ready.catch(fail);
        worker.postMessage = function (message) {
            ready.then(function () {
                if (!stopped) return bridge.post(id, message);
            }).catch(fail);
        };
        worker.terminate = function () {
            stopped = true;
            unsubscribe();
            if (id !== null) bridge.terminate(id).catch(function () {});
        };
        return worker;
    }

    function createWorkerClient(options) {
        var settings = options || {};
        var workerPath = settings.workerPath || 'local-browser-model-worker.js';
        var initTimeoutMs = Number.isFinite(settings.initTimeoutMs) ? settings.initTimeoutMs : 1800000;
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
        var lifecycleVersion = 0;

        function isRecoverableWebGPUError(error) {
            var message = String((error && error.message) || error || '').toLowerCase();
            return message.includes('webgpu') || message.includes('no available backend found');
        }

        function configRequiresWebGPU(config) {
            return !!(config && config.runtime && config.runtime.requiresWebGPU);
        }

        function createWorker() {
            var appBridge = global.ssappLocalModel;
            worker = appBridge
                ? createAppWorker(appBridge)
                : new Worker(workerPath, { type: 'module' });
            var currentWorker = worker;
            worker.onmessage = function (event) {
                if (worker === currentWorker) handleMessage(event);
            };
            worker.onerror = function (event) {
                if (worker !== currentWorker) return;
                var errorMessage = (event && event.message) || 'Local browser model worker error';
                onError(new Error(errorMessage));
                terminateWorker(appBridge && errorMessage);
            };
            worker.onmessageerror = function () {
                if (worker !== currentWorker) return;
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

        function terminateWorker(errorMessage) {
            if (worker) {
                worker.onmessage = null;
                worker.onerror = null;
                worker.onmessageerror = null;
                try {
                    worker.terminate();
                } catch (_error) {}
            }
            worker = null;
            rejectPending(errorMessage || 'Local browser model worker was terminated.');
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
                    // A stalled GPU request cannot handle reset/dispose messages.
                    // Recreate the worker on the next request instead of leaving it busy.
                    terminateWorker();
                }, timeoutMs);

                pending.set(requestId, {
                    resolve: resolve,
                    reject: reject,
                    timeoutId: timeoutId
                });

                try {
                    worker.postMessage(Object.assign({
                        type: type,
                        requestId: requestId
                    }, payload || {}));
                } catch (error) {
                    clearTimeout(timeoutId);
                    pending.delete(requestId);
                    reject(error);
                }
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

            var version = ++lifecycleVersion;
            if (worker) {
                terminateWorker();
            }

            createWorker();
            try {
                await request('init', initPayload, initTimeoutMs);
            } catch (error) {
                if (version !== lifecycleVersion) throw error;
                if (configRequiresWebGPU(initPayload) || String(initPayload.device || '').toLowerCase() === 'wasm' || !isRecoverableWebGPUError(error)) {
                    terminateWorker();
                    throw error;
                }

                terminateWorker();
                initPayload = catalog.buildWorkerInit(providerKey, Object.assign({}, requestedOverrides, { device: 'wasm' }));
                initKey = JSON.stringify(initPayload);
                createWorker();
                await request('init', initPayload, initTimeoutMs);
            }
            if (version !== lifecycleVersion) throw new Error('Local browser model connection was replaced.');
            connected = true;
            activeInitKey = initKey;
            activeConfig = initPayload;

            return safeClone(activeConfig);
        }

        async function generate(providerKey, payload, overrides) {
            var requestPayload = payload || {};
            var requestOverrides = overrides || {};
            var currentDevice;

            var connection = connect(providerKey, requestOverrides);
            var version = lifecycleVersion;
            var config = await connection;
            if (version !== lifecycleVersion) throw new Error('Local browser model connection was replaced.');
            // Every generation, including retries, needs the initialized model and source.
            requestPayload = Object.assign({}, config, requestPayload, { providerKey: providerKey });
            try {
                var result = await request('generate', requestPayload, generateTimeoutMs);
                if (version !== lifecycleVersion) throw new Error('Local browser model connection was replaced.');
                return result;
            } catch (error) {
                if (version !== lifecycleVersion) throw error;
                currentDevice = String(config.device || requestPayload.device || requestOverrides.device || '').toLowerCase();
                if (configRequiresWebGPU(config) || currentDevice === 'wasm' || !isRecoverableWebGPUError(error)) {
                    throw error;
                }

                connection = connect(providerKey, Object.assign({}, requestOverrides, { device: 'wasm' }));
                version = lifecycleVersion;
                await connection;
                if (version !== lifecycleVersion) throw new Error('Local browser model connection was replaced.');
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
            var version = ++lifecycleVersion;
            connected = false;
            if (!worker) {
                clearState();
                return;
            }

            try {
                await request('dispose', {}, disposeTimeoutMs);
            } catch (_error) {
                // Best effort cleanup.
            }

            if (version === lifecycleVersion) terminateWorker();
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
        createAppWorker: createAppWorker,
        createWorkerClient: createWorkerClient
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.SSNLocalBrowserLLM;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
