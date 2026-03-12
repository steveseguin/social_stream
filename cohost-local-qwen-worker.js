import {
    env,
    AutoProcessor,
    Qwen3_5ForConditionalGeneration,
    TextStreamer,
    InterruptableStoppingCriteria
} from './thirdparty/transformersjs/transformers.min.js';

const DEFAULT_MODEL_ID = 'qwen3.5-0.8b-onnx';
const DEFAULT_REMOTE_HOST = 'https://largefiles.socialstream.ninja/';
const DEFAULT_REMOTE_PATH_TEMPLATE = '{model}/';
const DEFAULT_DTYPE = {
    embed_tokens: 'q4',
    decoder_model_merged: 'q4',
    model: 'q4',
    vision_encoder: 'q4'
};
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

let model = null;
let processor = null;
let initializedModelId = '';
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

function buildWasmPaths() {
    const base = new URL('./thirdparty/transformersjs/ort/', self.location.href).href;
    return {
        wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
        mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`
    };
}

function normalizeRemoteHost(remoteHost) {
    if (!remoteHost) return DEFAULT_REMOTE_HOST;
    return remoteHost.endsWith('/') ? remoteHost : `${remoteHost}/`;
}

function isLikelyLocalModelId(modelId) {
    return /^(?:\.{1,2}\/|\/|[a-zA-Z]:[\\/]|thirdparty\/)/.test(modelId || '');
}

function resolveModelSource(modelId, requestedRemoteHost = '') {
    const isLocalModel = isLikelyLocalModelId(modelId);
    const remoteHost = normalizeRemoteHost(requestedRemoteHost || DEFAULT_REMOTE_HOST);
    return {
        isLocalModel,
        localFilesOnly: isLocalModel,
        remoteHost,
        sourceSignature: `${isLocalModel ? 'local' : 'remote'}|${remoteHost}`
    };
}

function configureEnvironment(source) {
    env.allowRemoteModels = !source.isLocalModel;
    env.allowLocalModels = true;
    env.localModelPath = './';
    env.remoteHost = source.remoteHost;
    env.remotePathTemplate = DEFAULT_REMOTE_PATH_TEMPLATE;
    env.useBrowserCache = true;
    env.useFSCache = false;

    if (!env.backends.onnx) {
        env.backends.onnx = {};
    }
    if (!env.backends.onnx.wasm) {
        env.backends.onnx.wasm = {};
    }

    env.backends.onnx.wasm.wasmPaths = buildWasmPaths();
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

function buildMessages(systemPrompt, prompt) {
    const messages = [];
    const systemText = (systemPrompt || '').trim();
    if (systemText) {
        messages.push({
            role: 'system',
            content: normalizeMessageContent(systemText)
        });
    }
    for (const entry of conversation) {
        messages.push({
            role: entry.role,
            content: normalizeMessageContent(entry.content)
        });
    }
    messages.push({
        role: 'user',
        content: [{ type: 'text', text: prompt }]
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
        // Drop the incomplete trailing fragment if the guard cut a word in half.
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
                    return 'wasm';
                }
            } catch (_error) {
                return 'wasm';
            }
        }
        return requestedDevice;
    }

    if (navigator.gpu?.requestAdapter) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                return 'webgpu';
            }
        } catch (_error) {
            // Ignore and fall back to wasm.
        }
    }

    return 'wasm';
}

async function initModel(message) {
    const modelId = (message.modelId || initializedModelId || DEFAULT_MODEL_ID).trim();
    const dtype = message.dtype || DEFAULT_DTYPE;
    const requestedDevice = message.device || 'auto';
    const source = resolveModelSource(modelId, message.remoteHost);

    if (
        model &&
        processor &&
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
            initializedModelId !== modelId ||
            initializedSourceSignature !== source.sourceSignature
        )
    ) {
        await disposeModel();
    }

    configureEnvironment(source);

    initializingPromise = (async () => {
        let device = await resolveRequestedDevice(requestedDevice);

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
            model = await Qwen3_5ForConditionalGeneration.from_pretrained(modelId, {
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
            model = await Qwen3_5ForConditionalGeneration.from_pretrained(modelId, {
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

async function generateReply(message) {
    const prompt = (message.prompt || '').trim();
    if (!prompt) {
        throw new Error('Prompt is empty.');
    }
    if (activeRequestId) {
        throw new Error('A local generation is already in progress.');
    }

    await initModel(message);

    activeRequestId = message.requestId;
    const messages = buildMessages(message.systemPrompt, prompt);
    const promptText = processor.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true
    });

    let inputs;
    try {
        inputs = await processor(null, promptText);
    } catch (_error) {
        inputs = await processor(promptText);
    }

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

    const output = await model.generate({
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

    conversation.push({ role: 'user', content: prompt });
    conversation.push({ role: 'assistant', content: responseText });
    trimConversation();

    return {
        text: responseText,
        finishReason: guardedStop ? 'repetition_guard' : 'stop',
        guardReason: guardedStop?.reason || ''
    };
}

async function disposeModel() {
    activeRequestId = null;
    conversation = [];

    if (model && typeof model.dispose === 'function') {
        try {
            await model.dispose();
        } catch (_error) {
            // Best effort cleanup.
        }
    }

    model = null;
    processor = null;
    initializedModelId = '';
    initializedDevice = '';
    initializedSourceSignature = '';
    initializingPromise = null;
    postStatus('stopped', 'Local model worker stopped');
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
                activeRequestId = null;
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
