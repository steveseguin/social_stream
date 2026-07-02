(function () {
    'use strict';

    var output = document.getElementById('output');
    var state = {
        done: false,
        success: false,
        logs: [],
        statuses: [],
        progressCount: 0,
        text: '',
        error: ''
    };

    function render() {
        output.textContent = JSON.stringify(state, null, 2);
        window.__SSN_LOCAL_BROWSER_MODEL_SMOKE__ = state;
    }

    function pushLog(kind, value) {
        state.logs.push({
            kind: kind,
            value: String(value || '')
        });
        render();
    }

    window.addEventListener('error', function (event) {
        state.error = event.message || 'window error';
        pushLog('window-error', state.error);
    });

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event && event.reason;
        state.error = reason && reason.message ? reason.message : String(reason || 'Unhandled rejection');
        pushLog('unhandledrejection', state.error);
    });

    async function run() {
        var api = window.SSNLocalBrowserLLM;
        var client;
        var result;

        if (!api || typeof api.createWorkerClient !== 'function') {
            throw new Error('SSNLocalBrowserLLM is not available.');
        }

        client = api.createWorkerClient({
            workerPath: '../local-browser-model-worker.js',
            initTimeoutMs: 900000,
            generateTimeoutMs: 900000,
            onStatus: function (message) {
                state.statuses.push(message);
                render();
            },
            onProgress: function (_message) {
                state.progressCount += 1;
                render();
            },
            onToken: function (message) {
                state.text += message.text || '';
                render();
            },
            onError: function (error) {
                pushLog('worker-error', error && error.message ? error.message : error);
            }
        });

        try {
            await client.connect('localqwen', {
                modelOverride: 'qwen3.5-0.8b-onnx',
                remoteHost: 'https://largefiles.socialstream.ninja/'
            });
            pushLog('connect', 'ok');

            result = await client.generate('localqwen', {
                prompt: 'Reply with exactly OK.',
                systemPrompt: '',
                maxNewTokens: 12,
                maxTime: 30,
                temperature: 0.1,
                topP: 0.9,
                images: []
            }, {
                modelOverride: 'qwen3.5-0.8b-onnx',
                remoteHost: 'https://largefiles.socialstream.ninja/'
            });

            state.success = true;
            state.text = result && result.text ? result.text : state.text;
            pushLog('generate', 'ok');
        } finally {
            state.done = true;
            render();
            try {
                await client.dispose();
            } catch (disposeError) {
                pushLog('dispose-error', disposeError && disposeError.message ? disposeError.message : disposeError);
            }
        }
    }

    render();
    run().catch(function (error) {
        state.done = true;
        state.success = false;
        state.error = error && error.message ? error.message : String(error || 'Unknown smoke test error');
        pushLog('fatal', state.error);
    });
})();
