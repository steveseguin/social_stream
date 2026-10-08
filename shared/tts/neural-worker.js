// Local neural speech. Executable dependencies are packaged; remote requests are model data only.
import { ort, env, AutoTokenizer, phonemize, phonemizeKokoro } from '../../thirdparty/neural-tts/runtime.js';
import { splitText, chunksToWav } from './pcm.js';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL('../../thirdparty/neural-tts/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = ort.env.wasm.wasmPaths;
env.allowLocalModels = false;
const kokoroBase = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/';
let session, tokenizer, modelKey, device, dtype, kittenConfig, busy = false;
const voices = new Map();
let languageModule, languageResult;

async function asset(url, progress) {
    let cache;
    try {
        cache = await caches.open('ssn-neural-tts-v1');
        const stored = await cache.match(url);
        if (stored) return stored.arrayBuffer();
    } catch (_) {}
    progress({ message: 'Downloading speech model or voice…' });
    const response = await fetch(url);
    if (!response.ok) throw new Error('Speech download failed (' + response.status + '). Try again.');
    // Cache concurrently with the reader; a full or unavailable cache cannot prevent speech.
    if (cache) cache.put(url, response.clone()).catch(() => {});
    return response.arrayBuffer();
}

async function initialize(options, progress) {
    const key = [options.engine, options.model, options.device, options.dtype, !!options.mac].join(':');
    if (session && modelKey === key) return;
    if (session) await session.release();
    session = null;
    modelKey = null;
    voices.clear();
    device = 'wasm';
    dtype = 'q8';
    if (options.engine === 'kokoro') {
        let adapter;
        if (options.device !== 'wasm' && !(options.mac && options.device === 'auto')) {
            try { adapter = navigator.gpu && await navigator.gpu.requestAdapter(); } catch (_) {}
        }
        if (options.device === 'webgpu' && !adapter) throw new Error('GPU speech is unavailable. Choose Automatic or CPU.');
        if (adapter) device = 'webgpu';
        dtype = options.dtype === 'auto' ? (device === 'webgpu' ? (adapter.features.has('shader-f16') ? 'fp16' : 'fp32') : 'q8') : options.dtype;
        if (device === 'webgpu' && dtype === 'fp16' && !adapter.features.has('shader-f16')) {
            throw new Error('This GPU cannot use FP16. Choose Automatic or Full quality.');
        }
        if (!tokenizer) tokenizer = await AutoTokenizer.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { revision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231' });
        const load = async () => {
            const name = dtype === 'fp32' ? 'model.onnx' : dtype === 'fp16' ? 'model_fp16.onnx' : 'model_quantized.onnx';
            const bytes = await asset(kokoroBase + 'onnx/' + name, progress);
            return ort.InferenceSession.create(bytes, { executionProviders: [device], graphOptimizationLevel: 'all' });
        };
        try { session = await load(); }
        catch (error) {
            if (device !== 'webgpu' || options.device === 'webgpu') throw error;
            device = 'wasm';
            dtype = options.dtype === 'auto' ? 'q8' : options.dtype;
            progress({ message: 'GPU unavailable; loading the CPU voice…' });
            session = await load();
        }
    } else {
        const response = await fetch(new URL('../../thirdparty/neural-tts/kitten-models.json', import.meta.url));
        if (!response.ok) throw new Error('Kitten model list could not load.');
        const models = await response.json();
        kittenConfig = models[options.model] || models.nano;
        dtype = options.model === 'nano' ? 'int8' : 'fp32';
        const bytes = await asset(kittenConfig.base + kittenConfig.config.model_file, progress);
        session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    }
    modelKey = key;
    progress({ device, dtype, message: 'Ready: ' + (device === 'webgpu' ? 'GPU' : 'CPU') + ' (' + dtype + ').' });
}

async function multilingualPhonemes(text, language) {
    if (!languageModule) {
        const { createPiperPhonemize } = await import('../../thirdparty/piper/piper-o91UDS6e.js');
        languageModule = await createPiperPhonemize({
            locateFile: name => new URL('../../thirdparty/piper/' + name, import.meta.url).href,
            print: line => { if (languageResult) languageResult(line); },
            printErr: line => console.warn(line)
        });
    }
    const phonemes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { languageResult = null; reject(new Error('Speech pronunciation timed out.')); }, 15000);
        languageResult = line => {
            try {
                const value = JSON.parse(line);
                if (!Array.isArray(value.phonemes)) return;
                clearTimeout(timer); languageResult = null; resolve(value.phonemes.join(''));
            } catch (_) {}
        };
        try { languageModule.callMain(['-l', language === 'e' ? 'es' : 'pt-br', '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']); }
        catch (error) { clearTimeout(timer); languageResult = null; reject(error); }
    });
    return phonemes.replace(/d\u0292/g, '\u02a4').replace(/t\u0283/g, '\u02a7').replace(/dz/g, '\u02a3').replace(/ts/g, '\u02a6').replace(/-/g, '').trim();
}

async function synthesize(text, options, progress) {
    let ids, style, feeds, output;
    if (options.engine === 'kokoro') {
        const voice = options.voice || 'af_aoede';
        if (!/^[abep][fm]_[a-z]+$/.test(voice)) throw new Error('Choose a valid Kokoro voice.');
        const phonemes = /^[ep]/.test(voice) ? await multilingualPhonemes(text, voice[0]) : await phonemizeKokoro(text, voice[0]);
        const encoded = tokenizer(phonemes, { truncation: false }).input_ids;
        if (encoded.dims[encoded.dims.length - 1] > 510) return null;
        ids = new ort.Tensor('int64', encoded.data, encoded.dims);
        if (!voices.has(voice)) voices.set(voice, new Float32Array(await asset(kokoroBase + 'voices/' + voice + '.bin', progress)));
        const offset = 256 * Math.min(Math.max(encoded.dims[1] - 2, 0), 509);
        style = voices.get(voice).slice(offset, offset + 256);
        feeds = { input_ids: ids, style: new ort.Tensor('float32', style, [1, 256]), speed: new ort.Tensor('float32', [options.speed], [1]) };
    } else {
        const voice = kittenConfig.config.voice_aliases[options.voice] || options.voice;
        const table = kittenConfig.voices[voice];
        if (!table) throw new Error('Choose a valid Kitten voice.');
        if (!voices.has(voice)) voices.set(voice, new Float32Array(await asset(new URL('../../thirdparty/neural-tts/' + table.file, import.meta.url).href, progress)));
        const symbols = '$' + ';:,.!?¡¿—…"«»"" ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' + "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";
        const dictionary = new Map(Array.from(symbols, (symbol, index) => [symbol, index]));
        const phonemes = (await phonemize(text, 'en-us')).join(' ');
        const normalized = (phonemes.match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu) || []).join(' ');
        const tokens = [0].concat(Array.from(normalized).filter(char => dictionary.has(char)).map(char => dictionary.get(char)), [10, 0]);
        const width = table.shape[table.shape.length - 1], row = Math.min(Array.from(text).length, table.shape[0] - 1);
        feeds = { input_ids: new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length]),
            style: new ort.Tensor('float32', voices.get(voice).slice(row * width, (row + 1) * width), [1, width]),
            speed: new ort.Tensor('float32', [options.speed * (kittenConfig.config.speed_priors[voice] || 1)], [1]) };
    }
    try {
        output = await session.run(feeds);
        const samples = output[session.outputNames[0]].data;
        return Float32Array.from(options.engine === 'kitten' ? samples.slice(0, Math.max(1, samples.length - 5000)) : samples);
    } finally {
        Object.values(feeds).forEach(tensor => tensor.dispose());
        if (output) Object.values(output).forEach(tensor => tensor.dispose());
    }
}

self.onmessage = async function(event) {
    const { id, options } = event.data;
    if (busy) { self.postMessage({ id, error: 'Speech is already generating.' }); return; }
    busy = true;
    const progress = data => self.postMessage({ id, progress: data }, data.chunk ? [data.chunk.buffer] : []);
    try {
        await initialize(options, progress);
        const parts = splitText(options.text, options.stream ? 120 : 240), chunks = [];
        for (let i = 0; i < parts.length; i++) {
            progress({ message: 'Generating speech ' + (i + 1) + '/' + parts.length + '…' });
            const samples = await synthesize(parts[i], options, progress);
            if (!samples) {
                const length = Array.from(parts[i]).length;
                if (length < 2) throw new Error('Speech cannot fit in the model.');
                parts.splice(i, 1, ...splitText(parts[i], Math.floor(length / 2))); i--; continue;
            }
            if (!samples.length || samples.some(value => !Number.isFinite(value))) throw new Error('Speech model returned invalid audio.');
            chunks.push(samples);
            if (options.stream) progress({ chunk: samples.slice(), sampleRate: 24000, index: i });
        }
        if (!chunks.length) throw new Error('No speech was generated.');
        self.postMessage({ id, result: { blob: chunksToWav(chunks, 24000), device, dtype, chunks: chunks.length } });
    } catch (error) { self.postMessage({ id, error: error.message || String(error) }); }
    finally { busy = false; }
};
