import {
    env,
    AutoProcessor,
    Gemma4ForConditionalGeneration,
    Qwen3_5ForCausalLM,
    Qwen3_5ForConditionalGeneration,
    RawImage,
    TextStreamer,
    InterruptableStoppingCriteria
} from './thirdparty/transformersjs/transformers.min.js';

const DEFAULT_REMOTE_HOST = 'https://largefiles.socialstream.ninja/';
const DEFAULT_REMOTE_PATH_TEMPLATE = '{model}/';
const DEFAULT_GENERATION = {
    maxNewTokens: 220,
    temperature: 0.65,
    topP: 0.92,
    maxTime: 25
};
const MAX_TURNS = 12;
const DEGENERATE_CHAR_RUN_LENGTH = 12;
const DEGENERATE_TAIL_PATTERN_REPEATS = 6;
const DEGENERATE_TAIL_PATTERN_MAX_UNIT = 4;
const MODEL_CLASS_MAP = {
    Gemma4ForConditionalGeneration,
    Qwen3_5ForCausalLM,
    Qwen3_5ForConditionalGeneration
};
const LEGACY_RUNTIME_DEFAULTS = {
    Gemma4ForConditionalGeneration: {
        dtype: {
            model: 'q4',
            decoder_model_merged: 'q4',
            vision_encoder: 'q4',
            audio_encoder: 'q4'
        }
    },
    Qwen3_5ForCausalLM: {
        dtype: {
            embed_tokens: 'q4',
            decoder_model_merged: 'q4',
            model: 'q4'
        }
    }
};

let model = null;
let processor = null;
let modelClass = null;
let initializedModelId = '';
let initializedModelClass = '';
let initializedDevice = '';
let initializedSourceSignature = '';
let initializingPromise = null;
let conversation = [];
let activeRequestId = null;

function toErrorMessage(error) {
    if (!error) return 'Unknown local model error';
    if (typeof error === 'string') return error;
    return error.message || String(error);
}

function postStatus(state, message = '') {
    self.postMessage({
        type: 'status',
        state,
        message
    });
}

function buildWasmPaths(modelClassName = '') {
    const base = new URL('./thirdparty/transformersjs/ort/', self.location.href).href;
    const useJsep = modelClassName === 'Qwen3_5ForCausalLM';
    return {
        wasm: `${base}ort-wasm-simd-threaded.${useJsep ? 'jsep' : 'asyncify'}.wasm`,
        mjs: `${base}ort-wasm-simd-threaded.${useJsep ? 'jsep' : 'asyncify'}.mjs`
    };
}

function isExtensionRuntime() {
    const protocol = String(self?.location?.protocol || '').toLowerCase();
    return protocol === 'chrome-extension:' || protocol === 'moz-extension:';
}

function normalizeRemoteHost(remoteHost) {
    if (!remoteHost) return DEFAULT_REMOTE_HOST;
    return remoteHost.endsWith('/') ? remoteHost : `${remoteHost}/`;
}

function isLikelyLocalModelId(modelId) {
    return /^(?:\.{1,2}\/|\/|[a-zA-Z]:[\\/]|thirdparty\/)/.test(modelId || '');
}

function resolveModelSource(modelId, requestedRemoteHost = '', remotePathTemplate = DEFAULT_REMOTE_PATH_TEMPLATE) {
    const isLocalModel = isLikelyLocalModelId(modelId);
    const remoteHost = normalizeRemoteHost(requestedRemoteHost || DEFAULT_REMOTE_HOST);
    return {
        isLocalModel,
        localFilesOnly: isLocalModel,
        remoteHost,
        remotePathTemplate: remotePathTemplate || DEFAULT_REMOTE_PATH_TEMPLATE,
        sourceSignature: `${isLocalModel ? 'local' : 'remote'}|${remoteHost}|${remotePathTemplate}`
    };
}

function configureEnvironment(source, runtime = {}) {
    const extensionRuntime = isExtensionRuntime();
    const modelClassName = String(runtime.modelClass || '').trim();

    env.allowRemoteModels = !source.isLocalModel;
    env.allowLocalModels = source.isLocalModel;
    env.localModelPath = './';
    env.remoteHost = source.remoteHost;
    env.remotePathTemplate = source.remotePathTemplate || DEFAULT_REMOTE_PATH_TEMPLATE;
    env.useBrowserCache = !extensionRuntime;
    env.useFSCache = false;
    env.useWasmCache = !extensionRuntime;

    if (!env.backends.onnx) {
        env.backends.onnx = {};
    }
    if (!env.backends.onnx.wasm) {
        env.backends.onnx.wasm = {};
    }

    env.backends.onnx.wasm.wasmPaths = buildWasmPaths(modelClassName);
    env.backends.onnx.wasm.proxy = false;
    env.backends.onnx.wasm.numThreads = 1;
}

function normalizeMessageContent(content) {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    if (Array.isArray(content)) {
        return content;
    }
    return [{ type: 'text', text: String(content || '') }];
}

function trimConversation() {
    const maxEntries = MAX_TURNS * 2;
    if (conversation.length > maxEntries) {
        conversation = conversation.slice(conversation.length - maxEntries);
    }
}

function buildMessages(systemPrompt, prompt, imageCount = 0, includeConversation = true) {
    const messages = [];
    const systemText = (systemPrompt || '').trim();

    if (systemText) {
        messages.push({
            role: 'system',
            content: normalizeMessageContent(systemText)
        });
    }

    if (includeConversation) {
        for (const entry of conversation) {
            messages.push({
                role: entry.role,
                content: normalizeMessageContent(entry.content)
            });
        }
    }

    const userContent = [{ type: 'text', text: prompt }];
    for (let index = 0; index < imageCount; index += 1) {
        userContent.push({ type: 'image' });
    }

    messages.push({
        role: 'user',
        content: userContent
    });

    return messages;
}

function detectDegenerateTail(text) {
    const candidate = String(text || '');
    if (!candidate) {
        return null;
    }
    const repeatedChar = new RegExp(`([^\\s])\\1{${DEGENERATE_CHAR_RUN_LENGTH - 1},}$`).exec(candidate);
    if (repeatedChar) {
        return {
            type: 'char_run',
            startIndex: repeatedChar.index,
            reason: `repeated "${repeatedChar[1]}" tail`
        };
    }
    for (let unitLength = 2; unitLength <= DEGENERATE_TAIL_PATTERN_MAX_UNIT; unitLength += 1) {
        const minTailLength = unitLength * DEGENERATE_TAIL_PATTERN_REPEATS;
        if (candidate.length < minTailLength) {
            continue;
        }
        const unit = candidate.slice(-unitLength);
        if (!unit.trim() || !/[^a-z]/i.test(unit)) {
            continue;
        }
        let matches = 1;
        let cursor = candidate.length - (unitLength * 2);
        while (cursor >= 0 && candidate.slice(cursor, cursor + unitLength) === unit) {
            matches += 1;
            cursor -= unitLength;
        }
        if (matches >= DEGENERATE_TAIL_PATTERN_REPEATS) {
            return {
                type: 'tail_pattern',
                startIndex: candidate.length - (matches * unitLength),
                reason: `repeated ${JSON.stringify(unit)} tail`
            };
        }
    }
    return null;
}

function sanitizeGuardedText(text, guard = null) {
    let value = String(text || '');
    if (guard && Number.isInteger(guard.startIndex) && guard.startIndex >= 0 && guard.startIndex < value.length) {
        value = value.slice(0, guard.startIndex);
        value = value.replace(/[^\s.,!?;:)\]"'}\]]+$/, '');
    }
    return value
        .replace(/[ \t]+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function resolveRequestedDevice(requestedDevice) {
    if (requestedDevice === 'webgpu' || requestedDevice === 'wasm') {
        if (requestedDevice === 'webgpu' && navigator.gpu?.requestAdapter) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    return {
                        device: 'wasm',
                        reason: 'WebGPU adapter unavailable, falling back to wasm'
                    };
                }
            } catch (_error) {
                return {
                    device: 'wasm',
                    reason: 'WebGPU probe failed, falling back to wasm'
                };
            }
        }
        return {
            device: requestedDevice,
            reason: ''
        };
    }

    if (navigator.gpu?.requestAdapter) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                return {
                    device: 'webgpu',
                    reason: ''
                };
            }
        } catch (_error) {
            // Ignore and fall back to wasm.
        }
    }

    return {
        device: 'wasm',
        reason: 'WebGPU not supported, falling back to wasm'
    };
}

function resolveModelClass(className) {
    const resolved = MODEL_CLASS_MAP[className];
    if (!resolved) {
        throw new Error(`Unsupported local browser model class: ${className}`);
    }
    return resolved;
}

function inferModelClassName(message, runtime = {}) {
    const explicit = String(runtime.modelClass || initializedModelClass || '').trim();
    if (explicit) {
        return explicit;
    }

    const providerKey = String(message.providerKey || '').trim().toLowerCase();
    if (providerKey === 'localgemma') {
        return 'Gemma4ForConditionalGeneration';
    }
    if (providerKey === 'localqwen') {
        return 'Qwen3_5ForCausalLM';
    }

    const modelId = String(message.modelId || initializedModelId || '').trim().toLowerCase();
    if (modelId.includes('gemma')) {
        return 'Gemma4ForConditionalGeneration';
    }
    if (modelId.includes('qwen')) {
        return 'Qwen3_5ForCausalLM';
    }

    return '';
}

function buildRuntimeDefaults(modelClassName) {
    const defaults = LEGACY_RUNTIME_DEFAULTS[modelClassName];
    if (!defaults) {
        return {
            modelClass: modelClassName,
            dtype: null
        };
    }

    return {
        modelClass: modelClassName,
        dtype: defaults.dtype ? JSON.parse(JSON.stringify(defaults.dtype)) : null
    };
}

function resolveRuntimeConfig(message, runtime = {}) {
    const modelClassName = inferModelClassName(message, runtime);
    const defaults = buildRuntimeDefaults(modelClassName);
    const resolved = Object.assign({}, defaults, runtime || {});

    if (runtime && runtime.dtype) {
        resolved.dtype = runtime.dtype;
    }

    return resolved;
}

async function initModel(message) {
    const runtime = resolveRuntimeConfig(message, message.runtime || {});
    const requestedModelClass = runtime.modelClass || '';
    const requestedClass = resolveModelClass(requestedModelClass);
    const modelId = (message.modelId || initializedModelId || '').trim();
    const dtype = runtime.dtype || message.dtype || null;
    const requestedDevice = message.device || 'auto';
    const source = resolveModelSource(modelId, message.remoteHost, message.remotePathTemplate);

    if (!modelId) {
        throw new Error('Model id is missing.');
    }

    if (
        model &&
        processor &&
        modelClass === requestedClass &&
        initializedModelId === modelId &&
        initializedSourceSignature === source.sourceSignature
    ) {
        return { modelId, device: initializedDevice || 'wasm' };
    }
    if (initializingPromise) {
        await initializingPromise;
        return {
            modelId: initializedModelId || modelId,
            device: initializedDevice || 'wasm'
        };
    }
    if (
        model &&
        processor &&
        initializedModelId &&
        (
            modelClass !== requestedClass ||
            initializedModelId !== modelId ||
            initializedSourceSignature !== source.sourceSignature
        )
    ) {
        await disposeModel();
    }

    configureEnvironment(source, runtime);

    initializingPromise = (async () => {
        const resolvedDevice = await resolveRequestedDevice(requestedDevice);
        let device = resolvedDevice.device;

        if (resolvedDevice.reason) {
            postStatus('loading', resolvedDevice.reason);
        }

        postStatus('loading', `Loading local model: ${modelId}`);

        processor = await AutoProcessor.from_pretrained(modelId, {
            local_files_only: source.localFilesOnly,
            progress_callback: (info = {}) => {
                self.postMessage({
                    type: 'progress',
                    phase: 'processor',
                    ...info
                });
            }
        });

        try {
            model = await requestedClass.from_pretrained(modelId, {
                local_files_only: source.localFilesOnly,
                device,
                dtype,
                progress_callback: (info = {}) => {
                    self.postMessage({
                        type: 'progress',
                        phase: 'model',
                        ...info
                    });
                }
            });
        } catch (error) {
            if (device !== 'webgpu') {
                throw error;
            }
            postStatus('loading', 'WebGPU unavailable, falling back to wasm');
            model = await requestedClass.from_pretrained(modelId, {
                local_files_only: source.localFilesOnly,
                device: 'wasm',
                dtype,
                progress_callback: (info = {}) => {
                    self.postMessage({
                        type: 'progress',
                        phase: 'model',
                        ...info
                    });
                }
            });
            device = 'wasm';
        }

        modelClass = requestedClass;
        initializedModelClass = requestedModelClass;
        initializedModelId = modelId;
        initializedDevice = device;
        initializedSourceSignature = source.sourceSignature;
        postStatus('ready', `Loaded local model on ${device}`);
    })();

    try {
        await initializingPromise;
    } finally {
        initializingPromise = null;
    }

    return {
        modelId: initializedModelId,
        device: initializedDevice || 'wasm'
    };
}

function normalizeImageSource(imageSource) {
    const value = String(imageSource || '').trim();
    if (!value) {
        return '';
    }
    if (/^(?:data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(value)) {
        return value;
    }
    return `data:image/jpeg;base64,${value}`;
}

async function toRawImage(imageSource) {
    const normalized = normalizeImageSource(imageSource);
    if (!normalized) {
        return null;
    }
    if (normalized.startsWith('data:')) {
        const response = await fetch(normalized);
        return RawImage.fromBlob(await response.blob());
    }
    return RawImage.read(normalized);
}

async function prepareImages(images) {
    const sources = Array.isArray(images) ? images : (images ? [images] : []);
    const prepared = [];

    for (const imageSource of sources) {
        const image = await toRawImage(imageSource);
        if (image) {
            prepared.push(image);
        }
    }

    return prepared;
}

function shouldRetryGenerationOnWasm(error, message) {
    const requestedDevice = String(message?.device || 'auto').trim().toLowerCase();
    const partialText = String(error?.partialText || '').trim();
    const errorMessage = toErrorMessage(error).toLowerCase();

    if (initializedDevice !== 'webgpu' || requestedDevice === 'wasm' || partialText) {
        return false;
    }

    return errorMessage.includes('webgpu') || errorMessage.includes('no available backend found');
}

async function runGenerationPass(message, prompt, stateless) {
    const rawImages = await prepareImages(message.images);
    const messages = buildMessages(message.systemPrompt, prompt, rawImages.length, !stateless);
    const promptText = processor.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true
    });
    const inputs = rawImages.length
        ? await processor(promptText, rawImages)
        : await processor(promptText);

    let streamedText = '';
    let guardedStop = null;
    const interruptableStop = new InterruptableStoppingCriteria();
    const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (chunk) => {
            if (!chunk || message.requestId !== activeRequestId) {
                return;
            }
            const nextText = streamedText + chunk;
            const guard = detectDegenerateTail(nextText);
            if (guard) {
                guardedStop = guard;
                streamedText = sanitizeGuardedText(nextText, guard);
                interruptableStop.interrupt();
                return;
            }
            streamedText = nextText;
            self.postMessage({
                type: 'token',
                requestId: message.requestId,
                text: chunk
            });
        }
    });

    let output;
    try {
        output = await model.generate({
            ...inputs,
            max_new_tokens: Number.isFinite(message.maxNewTokens)
                ? message.maxNewTokens
                : DEFAULT_GENERATION.maxNewTokens,
            max_time: Number.isFinite(message.maxTime)
                ? message.maxTime
                : DEFAULT_GENERATION.maxTime,
            do_sample: true,
            temperature: Number.isFinite(message.temperature)
                ? message.temperature
                : DEFAULT_GENERATION.temperature,
            top_p: Number.isFinite(message.topP)
                ? message.topP
                : DEFAULT_GENERATION.topP,
            repetition_penalty: 1.12,
            no_repeat_ngram_size: 4,
            stopping_criteria: [interruptableStop],
            streamer
        });
    } catch (error) {
        error.partialText = streamedText;
        throw error;
    }

    let responseText = sanitizeGuardedText(streamedText, guardedStop);
    if (!responseText) {
        const decoded = processor.batch_decode(output, {
            skip_special_tokens: true
        })[0] || '';
        responseText = sanitizeGuardedText(
            decoded.slice(promptText.length).trim() || decoded.trim(),
            guardedStop
        );
    }

    if (!stateless) {
        conversation.push({ role: 'user', content: prompt });
        conversation.push({ role: 'assistant', content: responseText });
        trimConversation();
    }

    return {
        text: responseText,
        finishReason: guardedStop ? 'repetition_guard' : 'stop',
        guardReason: guardedStop?.reason || ''
    };
}

async function generateReply(message) {
    const prompt = (message.prompt || '').trim();
    const stateless = !!message.stateless;

    if (!prompt) {
        throw new Error('Prompt is empty.');
    }
    if (activeRequestId) {
        throw new Error('A local generation is already in progress.');
    }

    activeRequestId = message.requestId;
    try {
        await initModel(message);
        try {
            return await runGenerationPass(message, prompt, stateless);
        } catch (error) {
            if (!shouldRetryGenerationOnWasm(error, message)) {
                throw error;
            }

            postStatus('loading', 'WebGPU generation failed, retrying on wasm');
            await disposeModel({
                preserveConversation: !stateless,
                preserveActiveRequestId: true,
                suppressStatus: true
            });

            const retryMessage = {
                ...message,
                device: 'wasm'
            };
            await initModel(retryMessage);
            return await runGenerationPass(retryMessage, prompt, stateless);
        }
    } finally {
        if (activeRequestId === message.requestId) {
            activeRequestId = null;
        }
    }
}

async function disposeModel(options = {}) {
    const preserveActiveRequestId = !!options.preserveActiveRequestId;
    const preserveConversation = !!options.preserveConversation;
    const suppressStatus = !!options.suppressStatus;

    if (!preserveActiveRequestId) {
        activeRequestId = null;
    }
    if (!preserveConversation) {
        conversation = [];
    }

    if (model && typeof model.dispose === 'function') {
        try {
            await model.dispose();
        } catch (_error) {
            // Best effort cleanup.
        }
    }

    model = null;
    processor = null;
    modelClass = null;
    initializedModelClass = '';
    initializedModelId = '';
    initializedDevice = '';
    initializedSourceSignature = '';
    initializingPromise = null;
    if (!suppressStatus) {
        postStatus('stopped', 'Local model worker stopped');
    }
}

self.addEventListener('message', async (event) => {
    const message = event.data || {};
    const requestId = message.requestId;

    try {
        switch (message.type) {
            case 'init': {
                const result = await initModel(message);
                self.postMessage({
                    type: 'response',
                    requestId,
                    ok: true,
                    ...result
                });
                return;
            }
            case 'generate': {
                const result = await generateReply(message);
                self.postMessage({
                    type: 'response',
                    requestId,
                    ok: true,
                    ...result
                });
                return;
            }
            case 'reset': {
                conversation = [];
                self.postMessage({
                    type: 'response',
                    requestId,
                    ok: true
                });
                return;
            }
            case 'dispose': {
                await disposeModel();
                self.postMessage({
                    type: 'response',
                    requestId,
                    ok: true
                });
                return;
            }
            default:
                self.postMessage({
                    type: 'response',
                    requestId,
                    ok: false,
                    error: `Unsupported message type: ${message.type}`
                });
        }
    } catch (error) {
        activeRequestId = null;
        const errorMessage = toErrorMessage(error);
        postStatus('error', errorMessage);
        self.postMessage({
            type: 'response',
            requestId,
            ok: false,
            error: errorMessage
        });
    }
});
