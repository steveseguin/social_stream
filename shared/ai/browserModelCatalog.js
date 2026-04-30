(function (global) {
    'use strict';

    var DEFAULT_REMOTE_HOST = 'https://largefiles.socialstream.ninja/';

    var LOCAL_BROWSER_MODELS = {
        localgemma: {
            key: 'localgemma',
            label: 'Local Gemma 4 E2B (Browser)',
            providerLabel: 'Local Gemma 4 (Browser)',
            modelId: 'gemma4-e2b-it-onnx',
            localPath: 'thirdparty/models/gemma4-e2b-it-onnx',
            remoteHost: DEFAULT_REMOTE_HOST,
            remotePathTemplate: '{model}/',
            runtime: {
                modelClass: 'Gemma4ForConditionalGeneration',
                dtype: {
                    model: 'q4',
                    decoder_model_merged: 'q4',
                    vision_encoder: 'q4',
                    audio_encoder: 'q4'
                }
            },
            supportsVision: true,
            prefersCaptureSelection: true,
            requiresApiKey: false,
            defaultPrompt: 'You are a concise, friendly social chat co-host. You can reference visible context when it helps, but do not narrate the scene unless asked.'
        },
        localqwen: {
            key: 'localqwen',
            label: 'Local Qwen 3.5 (Browser)',
            providerLabel: 'Local Qwen 3.5 (Browser)',
            modelId: 'qwen3.5-0.8b-onnx',
            localPath: 'thirdparty/models/qwen3.5-0.8b-onnx',
            remoteHost: DEFAULT_REMOTE_HOST,
            remotePathTemplate: '{model}/',
            runtime: {
                modelClass: 'Qwen3_5ForCausalLM',
                dtype: {
                    embed_tokens: 'q4',
                    decoder_model_merged: 'q4',
                    model: 'q4'
                }
            },
            supportsVision: false,
            prefersCaptureSelection: false,
            requiresApiKey: false,
            defaultPrompt: 'You are a concise, friendly social chat co-host. Keep answers short, natural, and practical.'
        }
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeRemoteHost(remoteHost) {
        var value = String(remoteHost || DEFAULT_REMOTE_HOST).trim();
        if (!value) {
            value = DEFAULT_REMOTE_HOST;
        }
        return value.endsWith('/') ? value : (value + '/');
    }

    function getLocalBrowserModelConfig(key) {
        var config = LOCAL_BROWSER_MODELS[key];
        return config ? clone(config) : null;
    }

    function getLocalBrowserProviderOptions() {
        return Object.keys(LOCAL_BROWSER_MODELS).map(function (key) {
            var config = LOCAL_BROWSER_MODELS[key];
            return {
                id: config.key,
                label: config.label
            };
        });
    }

    function buildWorkerInit(key, overrides) {
        var config = getLocalBrowserModelConfig(key);
        var runtime;
        var modelId;
        var remoteHost;
        var remotePathTemplate;

        if (!config) {
            throw new Error('Unknown local browser model key: ' + key);
        }

        overrides = overrides || {};
        runtime = clone(config.runtime || {});
        if (overrides.dtype) {
            runtime.dtype = clone(overrides.dtype);
        }

        modelId = String(
            overrides.modelId ||
            overrides.modelOverride ||
            config.modelId ||
            ''
        ).trim();
        remoteHost = normalizeRemoteHost(overrides.remoteHost || config.remoteHost || DEFAULT_REMOTE_HOST);
        remotePathTemplate = String(overrides.remotePathTemplate || config.remotePathTemplate || '{model}/').trim() || '{model}/';

        return {
            providerKey: key,
            providerLabel: config.providerLabel || config.label,
            modelId: modelId,
            localPath: config.localPath || '',
            device: overrides.device || '',
            remoteHost: remoteHost,
            remotePathTemplate: remotePathTemplate,
            runtime: runtime
        };
    }

    var api = {
        DEFAULT_REMOTE_HOST: DEFAULT_REMOTE_HOST,
        MODELS: clone(LOCAL_BROWSER_MODELS),
        normalizeRemoteHost: normalizeRemoteHost,
        getLocalBrowserModelConfig: getLocalBrowserModelConfig,
        getLocalBrowserProviderOptions: getLocalBrowserProviderOptions,
        buildWorkerInit: buildWorkerInit
    };

    global.SSNBrowserModelCatalog = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
