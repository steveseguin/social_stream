importScripts('ragSemanticCache.js');
var tokenizer, encoder;
var passages = [];
var task = Promise.resolve();
var CACHE_VERSION = 'minilm-751bff3-q8-passages-v1';

async function loadModel() {
    if (encoder) return;
    var runtime = await import('../../thirdparty/transformersjs/transformers.web.min.js');
    var env = runtime.env;
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = new URL('../../thirdparty/models/', self.location.href).href;
    env.useFSCache = false;
    env.useWasmCache = false;
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = {
        match: async function (request) {
            var url = typeof request === 'string' ? request : request.url;
            if (!url.startsWith(env.localModelPath + 'all-MiniLM-L6-v2/')) return undefined;
            var response = await fetch(url);
            return response.ok ? response : undefined;
        },
        put: async function () {}
    };
    var base = new URL('../../thirdparty/transformersjs/ort/', self.location.href).href;
    env.backends.onnx.wasm.wasmPaths = { wasm: base + 'ort-wasm-simd-threaded.asyncify.wasm', mjs: base + 'ort-wasm-simd-threaded.asyncify.mjs' };
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    tokenizer = await runtime.AutoTokenizer.from_pretrained('all-MiniLM-L6-v2');
    encoder = await runtime.AutoModel.from_pretrained('all-MiniLM-L6-v2', { device: 'wasm', dtype: 'q8' });
}

async function embed(inputs) {
    var result = await encoder(inputs), hidden = result.last_hidden_state;
    var vector = new Float32Array(hidden.dims[2]), count = 0, norm = 0;
    for (var i = 0; i < hidden.dims[1]; i++) {
        if (!Number(inputs.attention_mask.data[i])) continue;
        count++;
        for (var j = 0; j < vector.length; j++) vector[j] += hidden.data[i * vector.length + j];
    }
    for (var k = 0; k < vector.length; k++) { vector[k] /= Math.max(1, count); norm += vector[k] * vector[k]; }
    norm = Math.sqrt(norm) || 1;
    for (var n = 0; n < vector.length; n++) vector[n] /= norm;
    return vector;
}

async function build(records, id) {
    postMessage({ type: 'status', id: id, text: 'Loading local search model…' });
    await loadModel();
    var cached = new Map(), cacheAvailable = true;
    try { (await SSNRagCache.read()).forEach(function (entry) { cached.set(entry.ref, entry); }); }
    catch (error) { cacheAvailable = false; }
    var next = [], computed = 0, reused = 0;
    for (var r = 0; r < records.length; r++) {
        var record = records[r];
        var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(CACHE_VERSION + '\n' + record.title + '\n' + record.content));
        var hash = Array.from(new Uint8Array(digest)).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
        var entry = cached.get(record.ref);
        if (entry && entry.hash === hash && Array.isArray(entry.passages) && entry.passages.length && entry.passages.every(function (p) {
            return p && Number.isInteger(p.start) && Number.isInteger(p.end) && p.start >= 0 && p.end > p.start && p.end <= record.content.length &&
                p.vector instanceof Float32Array && p.vector.length === 384 && p.vector.every(Number.isFinite);
        })) {
            reused += entry.passages.length;
        } else {
            entry = { ref: record.ref, docId: record.docId, hash: hash, passages: [] };
            var content = record.content, heading = record.title.slice(0, 160) + '\n';
            for (var start = 0; start < content.length;) {
                if (next.length + entry.passages.length >= 10000) throw new Error('Knowledge base is too large for local semantic search. Use keyword search or fewer files.');
                var end = Math.min(content.length, start + 900);
                var inputs = tokenizer(heading + content.slice(start, end), { truncation: false, padding: true });
                // Count actual tokens so dense text and long identifiers are not silently truncated.
                while (inputs.input_ids.data.length > 256 && end - start > 1) {
                    end = start + Math.max(1, Math.floor((end - start) * 0.75));
                    inputs = tokenizer(heading + content.slice(start, end), { truncation: false, padding: true });
                }
                if (inputs.input_ids.data.length > 256) throw new Error('A document heading exceeds the local search limit.');
                entry.passages.push({ start: start, end: end, vector: await embed(inputs) });
                computed++;
                if (end === content.length) break;
                start = end - Math.min(120, Math.floor((end - start) / 5));
                if (computed % 8 === 0) await new Promise(function (resolve) { setTimeout(resolve, 20); });
            }
            if (cacheAvailable) {
                try { await SSNRagCache.put(entry); } catch (error) { cacheAvailable = false; }
            }
        }
        entry.passages.forEach(function (passage) { next.push({ ref: record.ref, start: passage.start, end: passage.end, vector: passage.vector }); });
        if (next.length > 10000) throw new Error('Knowledge base is too large for local semantic search. Use keyword search or fewer files.');
        postMessage({ type: 'status', id: id, text: 'Preparing local search: ' + (r + 1) + '/' + records.length + ' sections. Keyword search is available.' });
    }
    if (cacheAvailable) {
        try { await SSNRagCache.prune(records.map(function (record) { return record.ref; })); } catch (error) {}
    }
    passages = next;
    return { count: passages.length, computed: computed, reused: reused };
}

async function search(query) {
    var vector = await embed(tokenizer(query.slice(0, 2000), { truncation: true, max_length: 256, padding: true }));
    var best = new Map();
    passages.forEach(function (passage) {
        var score = 0;
        for (var i = 0; i < vector.length; i++) score += vector[i] * passage.vector[i];
        var previous = best.get(passage.ref);
        if (!previous || score > previous.score) best.set(passage.ref, { ref: passage.ref, score: score, semantic: true, start: passage.start, end: passage.end });
    });
    return Array.from(best.values()).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
}

self.onmessage = function (event) {
    var request = event.data;
    task = task.then(async function () {
        try {
            var result = request.type === 'build' ? await build(request.records, request.id) : await search(String(request.query || ''));
            postMessage({ id: request.id, ok: true, result: result });
        } catch (error) { postMessage({ id: request.id, ok: false, error: error.message || String(error) }); }
    });
};
