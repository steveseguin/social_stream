const fs = require('fs');
const path = require('path');

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
    const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
    const cohostHtml = fs.readFileSync(path.join(__dirname, '..', 'cohost.html'), 'utf8');
    const workerJs = fs.readFileSync(path.join(__dirname, '..', 'local-browser-model-worker.js'), 'utf8');
    const clientJs = fs.readFileSync(path.join(__dirname, '..', 'shared', 'ai', 'localBrowserLLM.js'), 'utf8');

    assert(!!localGemma, 'localgemma config exists');
    assert(!!localQwen, 'localqwen config exists');
    assert(localGemma.supportsVision === true, 'localgemma is marked vision-capable');
    assert(localGemma.runtime?.modelClass === 'Gemma4ForConditionalGeneration', 'localgemma uses Gemma4 runtime');
    assert(localGemma.runtime?.dtype?.model === 'q4', 'localgemma defaults to q4 quantization');
    assert(String(localGemma.remoteHost || '').includes('socialstream.ninja'), 'localgemma default host is self-hosted');
    assert(localQwen.supportsVision === false, 'localqwen is marked text-only');
    assert(localQwen.runtime?.modelClass === 'Qwen3_5ForCausalLM', 'localqwen uses Qwen 3.5 runtime');
    assert(localQwen.runtime?.dtype?.embed_tokens === 'q4', 'localqwen defaults to q4 quantization');
    assert(String(localQwen.remoteHost || '').includes('socialstream.ninja'), 'localqwen default host is self-hosted');
    assert(!/huggingface/i.test(JSON.stringify(catalog.MODELS)), 'catalog does not reference Hugging Face');

    const workerInit = catalog.buildWorkerInit('localgemma', {
        remoteHost: 'https://assets.example.com/models'
    });
    assert(workerInit.remoteHost === 'https://assets.example.com/models/', 'worker init normalizes remote host');
    assert(workerInit.runtime?.modelClass === 'Gemma4ForConditionalGeneration', 'worker init preserves Gemma4 runtime');
    const qwenInit = catalog.buildWorkerInit('localqwen', {});
    assert(qwenInit.runtime?.modelClass === 'Qwen3_5ForCausalLM', 'worker init preserves Qwen runtime');
    assert(qwenInit.runtime?.dtype?.embed_tokens === 'q4', 'worker init preserves Qwen q4 defaults');
    const wasmInit = catalog.buildWorkerInit('localqwen', { device: 'wasm' });
    assert(wasmInit.device === 'wasm', 'worker init preserves explicit device override');

    assert(popupHtml.includes('value="localgemma"'), 'popup exposes localgemma provider');
    assert(popupHtml.includes('value="localqwen"'), 'popup exposes localqwen provider');
    assert(cohostHtml.includes('value="localgemma"'), 'cohost exposes localgemma provider');
    assert(cohostHtml.includes('value="localqwen"'), 'cohost exposes localqwen provider');
    assert(fs.existsSync(path.join(__dirname, '..', 'local-browser-model-worker.js')), 'generic local browser worker exists');
    assert(workerJs.includes("if (providerKey === 'localqwen')"), 'worker preserves localqwen legacy class inference');
    assert(workerJs.includes("embed_tokens: 'q4'"), 'worker preserves localqwen legacy q4 defaults');
    assert(workerJs.includes('function shouldRetryGenerationOnWasm(error, message)'), 'worker can detect recoverable WebGPU generation failures');
    assert(workerJs.includes("WebGPU generation failed, retrying on wasm"), 'worker retries on wasm when WebGPU generation fails');
    assert(workerJs.includes('preserveConversation: !stateless'), 'wasm retry preserves normal conversation state');
    assert(clientJs.includes('function isRecoverableWebGPUError(error)'), 'client can detect recoverable WebGPU failures');
    assert(clientJs.includes("device: 'wasm'"), 'client can reconnect local workers on wasm after WebGPU failure');
} catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
}

if (process.exitCode) {
    process.exit(process.exitCode);
}
