import {
    env,
    AutoProcessor,
    Qwen3_5ForConditionalGeneration,
    TextStreamer
} from './thirdparty/transformersjs/transformers.min.js';

const DEFAULT_MODEL_ID = 'thirdparty/models/qwen3.5-0.8b-onnx';
const DEFAULT_DTYPE = {
    embed_tokens: 'q4',
    decoder_model_merged: 'q4',
    model: 'q4',
    vision_encoder: 'q4'
};
const DEFAULT_GENERATION = {
    maxNewTokens: 220,
    temperature: 0.65,
    topP: 0.92
};
const MAX_TURNS = 12;

let model = null;
let processor = null;
let initializedModelId = '';
let initializedDevice = '';
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

function configureEnvironment() {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = './';
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
    const modelId = (message.modelId || DEFAULT_MODEL_ID).trim();
    const dtype = message.dtype || DEFAULT_DTYPE;
    const requestedDevice = message.device || 'auto';

    if (model && processor && initializedModelId === modelId) {
        return { modelId, device: initializedDevice || 'wasm' };
    }
    if (initializingPromise) {
        await initializingPromise;
        return {
            modelId: initializedModelId || modelId,
            device: initializedDevice || 'wasm'
        };
    }
    if (model && processor && initializedModelId && initializedModelId !== modelId) {
        await disposeModel();
    }

    configureEnvironment();

    initializingPromise = (async () => {
        let device = await resolveRequestedDevice(requestedDevice);

        postStatus('loading', `Loading local model: ${modelId}`);

        processor = await AutoProcessor.from_pretrained(modelId, {
            local_files_only: true,
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
                local_files_only: true,
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
                local_files_only: true,
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

    const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (chunk) => {
            if (!chunk || message.requestId !== activeRequestId) {
                return;
            }
            streamedText += chunk;
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
        do_sample: true,
        temperature: Number.isFinite(message.temperature)
            ? message.temperature
            : DEFAULT_GENERATION.temperature,
        top_p: Number.isFinite(message.topP)
            ? message.topP
            : DEFAULT_GENERATION.topP,
        streamer
    });

    let responseText = streamedText.trim();
    if (!responseText) {
        const decoded = processor.batch_decode(output, {
            skip_special_tokens: true
        })[0] || '';
        responseText = decoded.slice(promptText.length).trim() || decoded.trim();
    }

    conversation.push({ role: 'user', content: prompt });
    conversation.push({ role: 'assistant', content: responseText });
    trimConversation();

    return responseText;
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
                const text = await generateReply(message);
                activeRequestId = null;
                self.postMessage({
                    type: 'response',
                    requestId,
                    ok: true,
                    text
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
