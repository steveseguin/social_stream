// Local executable dependencies and model data are packaged with the app.
var classifier = null;
var tokenizer = null;
var TensorClass = null;
var loading = null;

async function loadClassifier() {
    if (classifier) return;
    if (loading) return loading;
    loading = (async function () {
        postMessage({ type: 'status', text: 'Loading IBM classifier…' });
        var runtime = await import('../../thirdparty/transformersjs/transformers.web.min.js');
        var env = runtime.env;
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.localModelPath = new URL('../../thirdparty/models/', self.location.href).href;
        env.useFSCache = false;
        // Match the local LLM worker: load packaged WASM modules directly under extension CSP.
        env.useWasmCache = false;
        // Keep model assets below the site's per-file deployment limit.
        env.useBrowserCache = false;
        env.useCustomCache = true;
        env.customCache = {
            match: async function (request) {
                var url = typeof request === 'string' ? request : request.url;
                if (!url.endsWith('/onnx/model_quantized.onnx')) return undefined;
                var modelBase = env.localModelPath + 'granite-guardian-hap-38m/onnx/';
                var manifestResponse = await fetch(modelBase + 'model-parts.json');
                if (!manifestResponse.ok) throw new Error('IBM model manifest is unavailable.');
                var parts = await manifestResponse.json();
                var buffers = [];
                for (var index = 0; index < parts.length; index++) {
                    var part = parts[index];
                    var response = await fetch(modelBase + part.file);
                    if (!response.ok) throw new Error('IBM model data is unavailable: ' + part.file);
                    var buffer = await response.arrayBuffer();
                    var digest = await crypto.subtle.digest('SHA-256', buffer);
                    var hash = Array.from(new Uint8Array(digest)).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
                    if (buffer.byteLength !== part.bytes || hash !== part.sha256) throw new Error('IBM model data failed its integrity check.');
                    buffers.push(buffer);
                }
                return new Response(new Blob(buffers), { headers: { 'Content-Type': 'application/octet-stream' } });
            },
            put: async function () {}
        };
        var base = new URL('../../thirdparty/transformersjs/ort/', self.location.href).href;
        env.backends.onnx.wasm.wasmPaths = { wasm: base + 'ort-wasm-simd-threaded.asyncify.wasm', mjs: base + 'ort-wasm-simd-threaded.asyncify.mjs' };
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.proxy = false;
        TensorClass = runtime.Tensor;
        tokenizer = await runtime.AutoTokenizer.from_pretrained('granite-guardian-hap-38m');
        classifier = await runtime.AutoModelForSequenceClassification.from_pretrained('granite-guardian-hap-38m', { device: 'wasm', dtype: 'q8' });
        postMessage({ type: 'status', text: 'IBM classifier ready' });
    }());
    try { await loading; } finally { loading = null; }
}

async function classify(text) {
    await loadClassifier();
    // Refuse excessive work explicitly instead of approving a truncated message.
    if (text.length > 16000) throw new Error('Message is too long for local moderation.');
    var tokens = tokenizer(text, { truncation: false, padding: true });
    var data = Array.from(tokens.input_ids.data);
    var score = 0;
    if (data.length > 4096) throw new Error('Message exceeds the local moderation token limit.');
    async function scoreInputs(inputs) {
        var result = await classifier(inputs);
        var logits = result.logits.data;
        return 1 / (1 + Math.exp(logits[0] - logits[1]));
    }
    if (data.length <= 128) return scoreInputs(tokens);
    var content = data.slice(1, -1);
    for (var start = 0; start < content.length; start += 94) {
        var ids = [data[0]].concat(content.slice(start, start + 126), [data[data.length - 1]]);
        score = Math.max(score, await scoreInputs({
            input_ids: new TensorClass('int64', BigInt64Array.from(ids), [1, ids.length]),
            attention_mask: new TensorClass('int64', new BigInt64Array(ids.length).fill(BigInt(1)), [1, ids.length])
        }));
    }
    return score;
}

self.onmessage = async function (event) {
    var request = event.data || {};
    try {
        var score = await classify(String(request.text || ''));
        postMessage({ id: request.id, ok: true, score: score });
    } catch (error) {
        postMessage({ id: request.id, ok: false, error: error.message || String(error) });
    }
};
