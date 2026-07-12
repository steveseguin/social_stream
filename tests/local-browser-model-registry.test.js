const fs = require('fs');
const path = require('path');
const vm = require('vm');

const catalog = require(path.join(__dirname, '..', 'shared', 'ai', 'browserModelCatalog.js'));

function assert(condition, label) {
    if (condition) {
        console.log(`  PASS  ${label}`);
        return;
    }
    console.error(`  FAIL  ${label}`);
    process.exitCode = 1;
}

try {
    const localGemma = catalog.getLocalBrowserModelConfig('localgemma');
    const localQwen = catalog.getLocalBrowserModelConfig('localqwen');
    const localQwen2b = catalog.getLocalBrowserModelConfig('localqwen2b');
    const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
    const cohostHtml = fs.readFileSync(path.join(__dirname, '..', 'cohost.html'), 'utf8');
    const workerJs = fs.readFileSync(path.join(__dirname, '..', 'local-browser-model-worker.js'), 'utf8');
    const clientJs = fs.readFileSync(path.join(__dirname, '..', 'shared', 'ai', 'localBrowserLLM.js'), 'utf8');

    assert(!!localGemma, 'localgemma config exists');
    assert(!!localQwen, 'localqwen config exists');
    assert(!!localQwen2b, 'localqwen2b config exists');
    assert(localGemma.supportsVision === true, 'localgemma is marked vision-capable');
    assert(localGemma.runtime?.modelClass === 'Gemma4ForConditionalGeneration', 'localgemma uses Gemma4 runtime');
    assert(localGemma.runtime?.dtype?.model === 'q4', 'localgemma defaults to q4 quantization');
    assert(String(localGemma.remoteHost || '').includes('socialstream.ninja'), 'localgemma default host is self-hosted');
    assert(localQwen.supportsVision === true, 'localqwen is marked vision-capable');
    assert(localQwen.runtime?.modelClass === 'Qwen3_5ForConditionalGeneration', 'localqwen uses the multimodal Qwen 3.5 runtime');
    assert(localQwen.runtime?.dtype?.embed_tokens === 'q4', 'localqwen defaults to q4 quantization');
    assert(localQwen.runtime?.dtype?.vision_encoder === 'q4', 'localqwen loads its q4 vision encoder');
    assert(localQwen.runtime?.requiresWebGPU === true, 'localqwen declares its WebGPU requirement');
    assert(localQwen.runtime?.generation?.vision?.topK === 20, 'localqwen carries vision generation defaults');
    assert(localQwen.modelId === 'qwen3.5-0.8b-onnx-opt', 'localqwen defaults to the optimized self-hosted export');
    assert(String(localQwen.remoteHost || '').includes('socialstream.ninja'), 'localqwen default host is self-hosted');
    assert(localQwen2b.modelId === 'qwen3.5-2b-onnx-opt', 'localqwen2b defaults to the optimized self-hosted export');
    assert(localQwen2b.supportsVision === true, 'localqwen2b is marked vision-capable');
    assert(localQwen2b.runtime?.dtype?.vision_encoder === 'q4', 'localqwen2b loads its q4 vision encoder');
    assert(localQwen2b.runtime?.generation?.text?.doSample === false, 'localqwen2b uses deterministic text generation');
    assert(localQwen2b.runtime?.generation?.text?.repetitionPenalty === 1, 'localqwen2b preserves exact prompt tokens');
    assert(!/huggingface/i.test(JSON.stringify(catalog.MODELS)), 'catalog does not reference Hugging Face');

    const workerInit = catalog.buildWorkerInit('localgemma', {
        remoteHost: 'https://assets.example.com/models'
    });
    assert(workerInit.remoteHost === 'https://assets.example.com/models/', 'worker init normalizes remote host');
    assert(workerInit.runtime?.modelClass === 'Gemma4ForConditionalGeneration', 'worker init preserves Gemma4 runtime');
    const qwenInit = catalog.buildWorkerInit('localqwen', {});
    assert(qwenInit.runtime?.modelClass === 'Qwen3_5ForConditionalGeneration', 'worker init preserves Qwen runtime');
    assert(qwenInit.runtime?.dtype?.embed_tokens === 'q4', 'worker init preserves Qwen q4 defaults');
    const wasmInit = catalog.buildWorkerInit('localqwen', { device: 'wasm' });
    assert(wasmInit.device === 'wasm', 'worker init preserves explicit device override');

    assert(popupHtml.includes('value="localgemma"'), 'popup exposes localgemma provider');
    assert(popupHtml.includes('value="localqwen"'), 'popup exposes localqwen provider');
    assert(popupHtml.includes('value="localqwen2b"'), 'popup exposes localqwen2b provider');
    assert(cohostHtml.includes('value="localgemma"'), 'cohost exposes localgemma provider');
    assert(cohostHtml.includes('value="localqwen"'), 'cohost exposes localqwen provider');
    assert(cohostHtml.includes('value="localqwen2b"'), 'cohost exposes localqwen2b provider');
    assert(fs.existsSync(path.join(__dirname, '..', 'local-browser-model-worker.js')), 'generic local browser worker exists');
    assert(workerJs.includes("if (providerKey.startsWith('localqwen'))"), 'worker preserves Qwen provider class inference');
    assert(workerJs.includes("embed_tokens: 'q4'"), 'worker preserves localqwen q4 defaults');
    assert(workerJs.includes('const MAX_TURNS = 24;'), 'worker retains 24 recent conversation turns');
    assert(workerJs.includes('const MAX_HISTORY_CHARACTERS = 12000;'), 'worker bounds recent conversation by size');
    assert(workerJs.includes('Older user statements retained from this conversation:'), 'worker compacts older user facts into bounded memory');
    assert(workerJs.includes('rememberExplicitConversationFact'), 'worker stores explicit exact user facts');
    assert(workerJs.includes("finishReason: 'memory'"), 'worker answers direct fact recall without lossy regeneration');
    assert(workerJs.includes('Treat this as one ongoing conversation.'), 'worker adds continuity guidance');
    assert(workerJs.includes('Never use a generic readiness response'), 'worker rejects generic restart responses');
    assert(workerJs.includes('repetition_penalty:'), 'worker configures prompt-token repetition behavior');
    assert(workerJs.includes('no_repeat_ngram_size:'), 'worker blocks repeated generated phrases');
    assert(workerJs.indexOf("userContent.push({ type: 'image' })") < workerJs.indexOf("userContent.push({ type: 'text', text: prompt })"), 'worker places the user instruction after image context');
    assert(workerJs.includes("env.useBrowserCache = typeof caches !== 'undefined';"), 'worker enables persistent model caching whenever Cache Storage is available');
    assert(workerJs.includes('function isRecoverableWebGPUExecutionError(error)'), 'worker detects fatal WebGPU execution failures');
    assert(workerJs.includes('WebGPU execution failed, rebuilding the local model session'), 'worker rebuilds a poisoned WebGPU session once');
    assert(cohostHtml.includes('this.pendingSpeechPrompt = prompt;'), 'cohost collapses queued speech to the latest transcript');
    assert(cohostHtml.includes('this.recentSpeechPrompts = new Map();'), 'cohost suppresses recurring speech transcripts within a rolling window');
    assert(cohostHtml.includes('shouldAttachCapturedFrame(prompt)'), 'cohost avoids resending unchanged passive camera frames');
    const inlineScripts = [...cohostHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(source => source.trim());
    for (const [index, source] of inlineScripts.entries()) {
        new vm.Script(source, { filename: `cohost-inline-${index}.js` });
    }
    assert(inlineScripts.length > 0, 'cohost inline scripts parse successfully');
    assert(workerJs.includes('function shouldRetryGenerationOnWasm(error, message)'), 'worker can detect recoverable WebGPU generation failures');
    assert(workerJs.includes('initializedRequiresWebGPU'), 'worker blocks unsupported WASM fallback for WebGPU-only models');
    assert(clientJs.includes('function isRecoverableWebGPUError(error)'), 'client can detect recoverable WebGPU failures');
    assert(clientJs.includes('configRequiresWebGPU'), 'client preserves WebGPU-only model failures');
} catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
}

if (process.exitCode) {
    process.exit(process.exitCode);
}
