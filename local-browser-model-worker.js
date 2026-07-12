import {
    env,
    AutoProcessor,
    Gemma4ForCausalLM,
    Gemma4ForConditionalGeneration,
    Qwen3_5ForCausalLM,
    Qwen3_5ForConditionalGeneration,
    RawImage,
    TextStreamer,
    InterruptableStoppingCriteria
} from './thirdparty/transformersjs/transformers.web.min.js';

const DEFAULT_REMOTE_HOST = 'https://largefiles.socialstream.ninja/';
const DEFAULT_REMOTE_PATH_TEMPLATE = '{model}/';
const OPFS_CACHE_DIRECTORY = 'ssn-transformers-cache-v1';
const DEFAULT_GENERATION = {
    maxNewTokens: 220,
    temperature: 0.6,
    topP: 0.95,
    topK: 20,
    repetitionPenalty: 1.0,
    noRepeatNgramSize: 4,
    maxTime: 25
};
const MAX_TURNS = 24;
const MAX_HISTORY_CHARACTERS = 12000;
const MAX_MEMORY_CHARACTERS = 3000;
const MAX_CONVERSATION_FACTS = 32;
const CONVERSATION_GUIDANCE =
    'Treat this as one ongoing conversation. Use the recent conversation to answer the latest user message directly. Follow constraints in the latest request exactly. Do not greet the user again, restart the conversation, repeatedly ask what they want to discuss, or end every reply with a question. Never use a generic readiness response such as asking what they want to discuss. If the latest speech is short or unclear, briefly acknowledge its specific words instead of greeting or asking a generic question. Avoid repeating earlier replies. A camera image is passive background context: ignore it when it is unrelated, and only mention or describe it when the user asks about it or it is directly relevant.';
const DEGENERATE_CHAR_RUN_LENGTH = 12;
const DEGENERATE_TAIL_PATTERN_REPEATS = 6;
const DEGENERATE_TAIL_PATTERN_MAX_UNIT = 4;
const MODEL_CLASS_MAP = {
    Gemma4ForCausalLM,
    Gemma4ForConditionalGeneration,
    Qwen3_5ForCausalLM,
    Qwen3_5ForConditionalGeneration
};
const LEGACY_RUNTIME_DEFAULTS = {
    Gemma4ForCausalLM: {
        requiresWebGPU: true,
        dtype: {
            embed_tokens: 'q4',
            decoder_model_merged: 'q4'
        },
        generation: {
            text: { temperature: 1.0, topP: 0.95, topK: 64 }
        }
    },
    Gemma4ForConditionalGeneration: {
        requiresWebGPU: true,
        dtype: {
            model: 'q4',
            decoder_model_merged: 'q4',
            vision_encoder: 'q4',
            audio_encoder: 'q4'
        },
        generation: {
            text: { temperature: 1.0, topP: 0.95, topK: 64 },
            vision: { temperature: 1.0, topP: 0.95, topK: 64 }
        }
    },
    Qwen3_5ForCausalLM: {
        requiresWebGPU: true,
        dtype: {
            embed_tokens: 'q4',
            decoder_model_merged: 'q4',
            model: 'q4'
        },
        generation: {
            text: { temperature: 0.6, topP: 0.95, topK: 20 }
        }
    },
    Qwen3_5ForConditionalGeneration: {
        requiresWebGPU: true,
        dtype: {
            embed_tokens: 'q4',
            decoder_model_merged: 'q4',
            model: 'q4',
            vision_encoder: 'q4'
        },
        generation: {
            text: { temperature: 0.6, topP: 0.95, topK: 20 },
            vision: { temperature: 0.7, topP: 0.8, topK: 20 }
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
let initializedGenerationConfig = null;
let initializedRequiresWebGPU = false;
let initializingPromise = null;
let conversation = [];
let conversationMemory = '';
let conversationFacts = [];
let activeRequestId = null;
let opfsCacheRootPromise = null;

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
    const base = new URL('./thirdparty/transformersjs/ort/', import.meta.url).href;
    return {
        wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
        mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`
    };
}

function isExtensionRuntime() {
    const protocol = String(self?.location?.protocol || '').toLowerCase();
    return protocol === 'chrome-extension:' || protocol === 'moz-extension:';
}

function getOpfsCacheRoot() {
    if (!opfsCacheRootPromise) {
        opfsCacheRootPromise = navigator.storage.getDirectory().then(root => root.getDirectoryHandle(OPFS_CACHE_DIRECTORY, { create: true }));
        navigator.storage.persist?.().catch(() => {});
    }
    return opfsCacheRootPromise;
}

async function getOpfsCacheNames(request) {
    const key = String(request?.url || request || '');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return {
        data: `${hash}.bin`,
        metadata: `${hash}.json`
    };
}

function createOpfsTransformersCache() {
    if (!navigator?.storage?.getDirectory || !crypto?.subtle) return null;

    return {
        async match(request) {
            try {
                const root = await getOpfsCacheRoot();
                const names = await getOpfsCacheNames(request);
                const metadataHandle = await root.getFileHandle(names.metadata);
                const dataHandle = await root.getFileHandle(names.data);
                const metadata = JSON.parse(await (await metadataHandle.getFile()).text());
                const file = await dataHandle.getFile();
                if (Number(metadata.size) !== file.size) return undefined;
                return new Response(file, {
                    status: Number(metadata.status) || 200,
                    statusText: metadata.statusText || '',
                    headers: metadata.headers || {}
                });
            } catch (_) {
                return undefined;
            }
        },
        async put(request, response) {
            const root = await getOpfsCacheRoot();
            const names = await getOpfsCacheNames(request);
            const dataHandle = await root.getFileHandle(names.data, { create: true });
            const metadataHandle = await root.getFileHandle(names.metadata, { create: true });

            try {
                const dataWriter = await dataHandle.createWritable({ keepExistingData: false });
                if (response.body) {
                    await response.body.pipeTo(dataWriter);
                } else {
                    await dataWriter.close();
                }

                const file = await dataHandle.getFile();
                const metadata = {
                    size: file.size,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                };
                const metadataWriter = await metadataHandle.createWritable({ keepExistingData: false });
                await metadataWriter.write(JSON.stringify(metadata));
                await metadataWriter.close();
            } catch (error) {
                await root.removeEntry(names.metadata).catch(() => {});
                await root.removeEntry(names.data).catch(() => {});
                throw error;
            }
        }
    };
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

function configureEnvironment(source) {
    const extensionRuntime = isExtensionRuntime();
    const opfsCache = createOpfsTransformersCache();

    env.allowRemoteModels = !source.isLocalModel;
    env.allowLocalModels = source.isLocalModel;
    env.localModelPath = './';
    env.remoteHost = source.remoteHost;
    env.remotePathTemplate = source.remotePathTemplate || DEFAULT_REMOTE_PATH_TEMPLATE;
    env.useCustomCache = !!opfsCache;
    env.customCache = opfsCache;
    env.useBrowserCache = !opfsCache && typeof caches !== 'undefined';
    env.useFSCache = false;
    env.useWasmCache = !extensionRuntime;

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

function rememberExplicitConversationFact(prompt) {
    const match = String(prompt || '').match(/^(?:please\s+)?remember(?:\s+exactly)?\s*:?\s*(?:that\s+)?(?:my\s+)?(.{2,80}?)\s+(?:is|=)\s+([^.!?\n]{1,160})/i);
    if (!match) return null;

    const key = match[1].replace(/\s+/g, ' ').trim().toLowerCase();
    const value = match[2].replace(/\s+/g, ' ').trim();
    if (!key || !value) return null;

    const existingIndex = conversationFacts.findIndex(fact => fact.key === key);
    const fact = { key, value };
    if (existingIndex >= 0) {
        conversationFacts.splice(existingIndex, 1);
    }
    conversationFacts.push(fact);
    if (conversationFacts.length > MAX_CONVERSATION_FACTS) {
        conversationFacts.splice(0, conversationFacts.length - MAX_CONVERSATION_FACTS);
    }
    return fact;
}

function findRequestedConversationFact(prompt) {
    const text = String(prompt || '').toLowerCase();
    if (!conversationFacts.length || !/(?:what|which|recall|remember|remind|tell me)/i.test(text)) return null;

    const ignoredWords = new Set([
        'answer',
        'did',
        'earlier',
        'exactly',
        'i',
        'is',
        'just',
        'me',
        'my',
        'only',
        'please',
        'recall',
        'remember',
        'remind',
        'tell',
        'the',
        'was',
        'what',
        'which',
        'with',
        'you'
    ]);
    let bestFact = null;
    let bestScore = 0;
    for (const fact of conversationFacts) {
        const words = fact.key.match(/[a-z0-9]+/g) || [];
        const meaningfulWords = words.filter(word => word.length > 2 && !ignoredWords.has(word));
        const score = meaningfulWords.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0);
        if (score > bestScore) {
            bestFact = fact;
            bestScore = score;
        }
    }
    return bestScore > 0 ? bestFact : null;
}

function respondWithConversationFact(message, prompt, fact) {
    return respondWithDirectText(message, prompt, fact.value, 'memory');
}

function respondWithDirectText(message, prompt, responseText, finishReason = 'stop') {
    self.postMessage({
        type: 'token',
        requestId: message.requestId,
        text: responseText
    });
    conversation.push({ role: 'user', content: prompt });
    conversation.push({ role: 'assistant', content: responseText });
    trimConversation();
    return {
        text: responseText,
        finishReason,
        guardReason: ''
    };
}

function trimConversation() {
    const maxEntries = MAX_TURNS * 2;
    const conversationCharacters = () => conversation.reduce((total, entry) => total + String(entry.content || '').length, 0);
    const compactedUserStatements = [];

    while (conversation.length > maxEntries || conversationCharacters() > MAX_HISTORY_CHARACTERS) {
        const removed = conversation.splice(0, Math.min(2, conversation.length));
        const userEntry = removed.find(entry => entry.role === 'user');
        const userText = String(userEntry?.content || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (userText) compactedUserStatements.push(userText.slice(0, 500));
    }

    if (compactedUserStatements.length) {
        conversationMemory = [conversationMemory, ...compactedUserStatements.map(text => `- ${text}`)].filter(Boolean).join('\n').slice(-MAX_MEMORY_CHARACTERS);
    }
}

function buildMessages(systemPrompt, prompt, imageCount = 0, includeConversation = true) {
    const messages = [];
    const memoryText = conversationMemory ? `Older user statements retained from this conversation:\n${conversationMemory}` : '';
    const factsText = conversationFacts.length
        ? `Exact user facts retained from this conversation; copy their values verbatim when recalled:\n${conversationFacts.map(fact => `- ${fact.key}: ${fact.value}`).join('\n')}`
        : '';
    const systemText = [(systemPrompt || '').trim(), CONVERSATION_GUIDANCE, factsText, memoryText].filter(Boolean).join('\n\n');

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

    const userContent = [];
    for (let index = 0; index < imageCount; index += 1) {
        userContent.push({ type: 'image' });
    }
    userContent.push({ type: 'text', text: prompt });

    messages.push({
        role: 'user',
        content: userContent
    });

    return messages;
}

function renderGemma4Prompt(messages) {
    let prompt = '<bos>';

    for (const message of messages) {
        const role = message.role === 'assistant' ? 'model' : message.role;
        const parts = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }];
        let content = '';

        for (const part of parts) {
            if (part?.type === 'image') {
                content += '<|image|>';
            } else if (part?.type === 'audio') {
                content += '<|audio|>';
            } else {
                content += String(part?.text ?? part ?? '').trim();
            }
        }

        prompt += `<|turn>${role}\n${content}<turn|>\n`;
    }

    return `${prompt}<|turn>model\n`;
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
        let cursor = candidate.length - unitLength * 2;
        while (cursor >= 0 && candidate.slice(cursor, cursor + unitLength) === unit) {
            matches += 1;
            cursor -= unitLength;
        }
        if (matches >= DEGENERATE_TAIL_PATTERN_REPEATS) {
            return {
                type: 'tail_pattern',
                startIndex: candidate.length - matches * unitLength,
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

function isOfficialMicroModelProvider(providerKey) {
    return providerKey === 'localqwen' || providerKey === 'localqwen2b' || providerKey === 'localgemma';
}

function sanitizeOfficialMicroModelResponse(text, prompt = '') {
    let value = String(text || '').trim();
    const genericQuestionPatterns = [
        /\s*(?:do|would) you (?:want|like) to (?:discuss|talk about)(?:\s+the details of)?[^?\n]{0,100}\?\s*$/i,
        /\s*what (?:do you want|would you like) to (?:discuss|talk about)(?:\s+today)?\?\s*$/i,
        /\s*what(?:'s| is) on your mind(?:\s+to discuss)?(?:\s+today)?(?:,?\s+[a-z][\w-]*)?\?\s*$/i,
        /\s*what are we discussing(?:\s+today)?\?\s*$/i,
        /\s*(?:are you )?ready to (?:keep|continue|get started|start|chat|talk|discuss|go)[^?\n]{0,80}\?\s*$/i
    ];

    let previousValue;
    do {
        previousValue = value;
        for (const pattern of genericQuestionPatterns) {
            value = value.replace(pattern, '').trim();
        }
    } while (value !== previousValue);

    if (/(?:without asking(?: me)? (?:a|any) questions?|do not ask(?: me)? (?:a|any) questions?|don['’]t ask(?: me)? (?:a|any) questions?)/i.test(prompt)) {
        value = value.replace(/(?:^|\s+)[^.!?\n]*\?\s*$/, '').trim();
    }
    value = value.replace(/\s+(?:what|what(?:'s| is)|do you|would you)\s*$/i, '').trim();
    return value;
}

async function resolveRequestedDevice(requestedDevice, requiresWebGPU = false) {
    if (requiresWebGPU && requestedDevice === 'wasm') {
        throw new Error('This local browser model requires WebGPU; its quantized operators cannot run with the WASM backend.');
    }
    if (requiresWebGPU && requestedDevice === 'webgpu' && !navigator.gpu?.requestAdapter) {
        throw new Error('This local browser model requires WebGPU, which is not available in this browser or app runtime.');
    }
    if (requestedDevice === 'webgpu' || requestedDevice === 'wasm') {
        if (requestedDevice === 'webgpu' && navigator.gpu?.requestAdapter) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    if (requiresWebGPU) {
                        throw new Error('This local browser model requires WebGPU, but no WebGPU adapter is available.');
                    }
                    return {
                        device: 'wasm',
                        reason: 'WebGPU adapter unavailable, falling back to wasm'
                    };
                }
            } catch (error) {
                if (requiresWebGPU) {
                    throw error;
                }
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

    if (requiresWebGPU) {
        throw new Error('This local browser model requires WebGPU, which is not available in this browser or app runtime.');
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

    const providerKey = String(message.providerKey || '')
        .trim()
        .toLowerCase();
    if (providerKey === 'localgemma') {
        return 'Gemma4ForCausalLM';
    }
    if (providerKey.startsWith('localqwen')) {
        return 'Qwen3_5ForConditionalGeneration';
    }

    const modelId = String(message.modelId || initializedModelId || '')
        .trim()
        .toLowerCase();
    if (modelId.includes('gemma')) {
        return 'Gemma4ForCausalLM';
    }
    if (modelId.includes('qwen')) {
        return 'Qwen3_5ForConditionalGeneration';
    }

    return '';
}

function buildRuntimeDefaults(modelClassName) {
    const defaults = LEGACY_RUNTIME_DEFAULTS[modelClassName];
    if (!defaults) {
        return {
            modelClass: modelClassName,
            dtype: null,
            requiresWebGPU: false,
            generation: null
        };
    }

    return {
        modelClass: modelClassName,
        dtype: defaults.dtype ? JSON.parse(JSON.stringify(defaults.dtype)) : null,
        requiresWebGPU: !!defaults.requiresWebGPU,
        generation: defaults.generation ? JSON.parse(JSON.stringify(defaults.generation)) : null
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
    const requiresWebGPU = !!runtime.requiresWebGPU;
    const requestedDevice = message.device || 'auto';
    const source = resolveModelSource(modelId, message.remoteHost, message.remotePathTemplate);

    if (!modelId) {
        throw new Error('Model id is missing.');
    }

    if (model && processor && modelClass === requestedClass && initializedModelId === modelId && initializedSourceSignature === source.sourceSignature) {
        return { modelId, device: initializedDevice || 'wasm' };
    }
    if (initializingPromise) {
        await initializingPromise;
        return {
            modelId: initializedModelId || modelId,
            device: initializedDevice || 'wasm'
        };
    }
    if (model && processor && initializedModelId && (modelClass !== requestedClass || initializedModelId !== modelId || initializedSourceSignature !== source.sourceSignature)) {
        await disposeModel();
    }

    configureEnvironment(source);

    initializingPromise = (async () => {
        const resolvedDevice = await resolveRequestedDevice(requestedDevice, requiresWebGPU);
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
            if (device !== 'webgpu' || requiresWebGPU) {
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
        initializedGenerationConfig = runtime.generation ? JSON.parse(JSON.stringify(runtime.generation)) : null;
        initializedRequiresWebGPU = requiresWebGPU;
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
    const sources = Array.isArray(images) ? images : images ? [images] : [];
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
    const requestedDevice = String(message?.device || 'auto')
        .trim()
        .toLowerCase();
    const partialText = String(error?.partialText || '').trim();
    const errorMessage = toErrorMessage(error).toLowerCase();

    if (initializedRequiresWebGPU || initializedDevice !== 'webgpu' || requestedDevice === 'wasm' || partialText) {
        return false;
    }

    return errorMessage.includes('webgpu') || errorMessage.includes('no available backend found');
}

function isRecoverableWebGPUExecutionError(error) {
    const partialText = String(error?.partialText || '').trim();
    const errorMessage = toErrorMessage(error).toLowerCase();

    if (partialText || initializedDevice !== 'webgpu') {
        return false;
    }

    return errorMessage.includes('ortrun') || errorMessage.includes('invalid buffer') || errorMessage.includes('mapasync') || errorMessage.includes('device lost') || errorMessage.includes('webgpu');
}

async function runGenerationPass(message, prompt, stateless) {
    const rawImages = await prepareImages(message.images);
    const generationProfiles = message.runtime?.generation || initializedGenerationConfig || {};
    const generationDefaults = (rawImages.length ? generationProfiles.vision : generationProfiles.text) || {};
    const messages = buildMessages(message.systemPrompt, prompt, rawImages.length, !stateless);
    const promptText = initializedModelClass.startsWith('Gemma4')
        ? renderGemma4Prompt(messages)
        : processor.apply_chat_template(messages, {
              tokenize: false,
              add_generation_prompt: true
          });
    const inputs = rawImages.length ? await processor(promptText, rawImages) : await processor(promptText);

    let streamedText = '';
    let guardedStop = null;
    const interruptableStop = new InterruptableStoppingCriteria();
    const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: chunk => {
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
            if (!isOfficialMicroModelProvider(message.providerKey)) {
                self.postMessage({
                    type: 'token',
                    requestId: message.requestId,
                    text: chunk
                });
            }
        }
    });

    let output;
    try {
        output = await model.generate({
            ...inputs,
            max_new_tokens: Number.isFinite(message.maxNewTokens) ? message.maxNewTokens : DEFAULT_GENERATION.maxNewTokens,
            max_time: Number.isFinite(message.maxTime) ? message.maxTime : DEFAULT_GENERATION.maxTime,
            do_sample: typeof message.doSample === 'boolean' ? message.doSample : typeof generationDefaults.doSample === 'boolean' ? generationDefaults.doSample : true,
            temperature: Number.isFinite(message.temperature) ? message.temperature : Number.isFinite(generationDefaults.temperature) ? generationDefaults.temperature : DEFAULT_GENERATION.temperature,
            top_p: Number.isFinite(message.topP) ? message.topP : Number.isFinite(generationDefaults.topP) ? generationDefaults.topP : DEFAULT_GENERATION.topP,
            top_k: Number.isFinite(message.topK) ? message.topK : Number.isFinite(generationDefaults.topK) ? generationDefaults.topK : DEFAULT_GENERATION.topK,
            repetition_penalty: Number.isFinite(message.repetitionPenalty)
                ? message.repetitionPenalty
                : Number.isFinite(generationDefaults.repetitionPenalty)
                  ? generationDefaults.repetitionPenalty
                  : DEFAULT_GENERATION.repetitionPenalty,
            no_repeat_ngram_size: Number.isFinite(message.noRepeatNgramSize)
                ? message.noRepeatNgramSize
                : Number.isFinite(generationDefaults.noRepeatNgramSize)
                  ? generationDefaults.noRepeatNgramSize
                  : DEFAULT_GENERATION.noRepeatNgramSize,
            stopping_criteria: [interruptableStop],
            streamer
        });
    } catch (error) {
        error.partialText = streamedText;
        throw error;
    }

    let responseText = sanitizeGuardedText(streamedText, guardedStop);
    if (!responseText) {
        const decoded =
            processor.batch_decode(output, {
                skip_special_tokens: true
            })[0] || '';
        responseText = sanitizeGuardedText(decoded.slice(promptText.length).trim() || decoded.trim(), guardedStop);
    }
    if (isOfficialMicroModelProvider(message.providerKey)) {
        responseText = sanitizeOfficialMicroModelResponse(responseText, prompt);
        if (responseText) {
            self.postMessage({
                type: 'token',
                requestId: message.requestId,
                text: responseText
            });
        }
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
        if (!stateless) {
            const rememberedFact = rememberExplicitConversationFact(prompt);
            if (rememberedFact && isOfficialMicroModelProvider(message.providerKey) && /reply\s+only\s+with\s*:?\s*remembered\b/i.test(prompt)) {
                return respondWithDirectText(message, prompt, 'remembered', 'memory');
            }
            const requestedFact = rememberedFact ? null : findRequestedConversationFact(prompt);
            if (requestedFact) {
                return respondWithConversationFact(message, prompt, requestedFact);
            }
        }
        await initModel(message);
        try {
            return await runGenerationPass(message, prompt, stateless);
        } catch (error) {
            if (!message.webgpuRecoveryAttempt && isRecoverableWebGPUExecutionError(error)) {
                postStatus('loading', 'WebGPU execution failed, rebuilding the local model session');
                await disposeModel({
                    preserveConversation: !stateless,
                    preserveActiveRequestId: true,
                    suppressStatus: true
                });
                const retryMessage = {
                    ...message,
                    webgpuRecoveryAttempt: true
                };
                await initModel(retryMessage);
                return await runGenerationPass(retryMessage, prompt, stateless);
            }
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
        conversationMemory = '';
        conversationFacts = [];
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
    initializedGenerationConfig = null;
    initializedRequiresWebGPU = false;
    initializingPromise = null;
    if (!suppressStatus) {
        postStatus('stopped', 'Local model worker stopped');
    }
}

self.addEventListener('message', async event => {
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
                conversationMemory = '';
                conversationFacts = [];
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
