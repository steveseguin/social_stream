"use strict";

// Bergamot API usage adapted from Mozilla Translate (MPL 2.0).
// Runtime, models and license: ../../thirdparty/bergamot/NOTICE.txt.
var modelRoot = "https://storage.googleapis.com/bergamot-models-sandbox/0.3.4/";
var runtimeBase = new URL("../../thirdparty/bergamot/", self.location.href).href;
var registry;
var service;
var models = new Map();
var initialization;
var queue = [];
var processing = false;
var retryAfter = 0;
var Module;
var modernEngine = false;
var classifier;
var classifierLoading;

function loadLanguageClassifier() {
    if (!classifierLoading) {
        classifierLoading = (async function () {
            importScripts("../../thirdparty/fasttext/fasttext.js");
            var base = new URL("../../thirdparty/fasttext/", self.location.href).href;
            var buffer = await download("language-identification", {
                url: "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin",
                size: 131266198,
                expectedSha256Hash: "7e69ec5451bc261cc7844e49e4792a85d7f09c06789ec800fc4a44aec362764e"
            });
            var runtime = await FastTextModule({ locateFile: function (file) { return base + file; } });
            runtime.FS.writeFile("/lid.176.bin", new Uint8Array(buffer));
            try {
                classifier = new runtime.FastText();
                classifier.loadModel("/lid.176.bin");
            } finally { runtime.FS.unlink("/lid.176.bin"); }
        }()).catch(function (error) {
            classifierLoading = null;
            throw error;
        });
    }
    return classifierLoading;
}

function initialize() {
    if (!initialization) {
        initialization = Promise.resolve().then(function () {
            importScripts(runtimeBase + "runtime-loader.js");
            return loadBergamotRuntime(runtimeBase + "v0.6.0/", runtimeBase);
        }).then(async function (engine) {
            Module = engine.module;
            modernEngine = engine.modern;
            var response = await fetch(runtimeBase + "registry.json");
            if (!response.ok) throw new Error("Translation language list could not be loaded.");
            registry = await response.json();
            service = new Module.BlockingService(modernEngine ? { cacheSize: 0 } : {});
        });
    }
    return initialization;
}

async function download(pair, asset) {
    var url = asset.url || modelRoot + pair + "/" + asset.name;
    var cache = null;
    var response;
    var downloaded = false;
    try {
        cache = await caches.open("ssn-translation-models-v1");
        response = await cache.match(url);
    } catch (_) {}
    if (!response) {
        downloaded = true;
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 120000);
        try {
            response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error("Translation language download failed: " + response.status);
            // Read the body before clearing the download timeout.
            response = new Response(await response.arrayBuffer());
        } finally { clearTimeout(timer); }
    }
    var buffer = await response.arrayBuffer();
    if (downloaded && asset.compression === "gzip") {
        if (typeof pako === "undefined") importScripts("../../thirdparty/pako.min.js");
        buffer = pako.ungzip(new Uint8Array(buffer)).buffer;
    }
    if (buffer.byteLength !== asset.size) {
        if (cache) await cache.delete(url);
        throw new Error("Translation language file has an unexpected size.");
    }
    var digest = await crypto.subtle.digest("SHA-256", buffer);
    var hash = Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    if (hash !== asset.expectedSha256Hash) {
        if (cache) await cache.delete(url);
        throw new Error("Translation language file failed verification.");
    }
    if (cache && downloaded) {
        try { await cache.put(url, new Response(buffer)); } catch (_) {}
    }
    return buffer;
}

function aligned(buffer, alignment) {
    var memory = new Module.AlignedMemory(buffer.byteLength, alignment);
    memory.getByteArrayView().set(new Uint8Array(buffer));
    return memory;
}

async function loadModel(pair) {
    if (models.has(pair)) return models.get(pair).model;
    var entry = registry[pair];
    var owned = [];
    var list;
    try {
        var model = aligned(await download(pair, entry.model), 256);
        owned.push(model);
        var lex = aligned(await download(pair, entry.lex), 64);
        owned.push(lex);
        list = new Module.AlignedMemoryList();
        var vocab = aligned(await download(pair, entry.vocab || entry.srcvocab), 64);
        owned.push(vocab);
        list.push_back(vocab);
        if (entry.trgvocab) {
            vocab = aligned(await download(pair, entry.trgvocab), 64);
            owned.push(vocab);
            list.push_back(vocab);
        }
        var config = "beam-size: 1\nnormalize: 1.0\nword-penalty: 0\nmax-length-break: 128\nmini-batch-words: 1024\nworkspace: 128\nmax-length-factor: 2.0\nskip-cost: true\ncpu-threads: 0\nquiet: true\nquiet-translation: true\ngemm-precision: int8shiftAll\n";
        var from = pair.slice(0, 2);
        var to = pair.slice(2);
        var translationModel = modernEngine
            ? new Module.TranslationModel(from, to, config, model, lex, list, null)
            : new Module.TranslationModel(config, model, lex, list);
        models.set(pair, { model: translationModel, owned: owned, list: list });
        return translationModel;
    } catch (error) {
        if (list) list.delete();
        owned.forEach(function (memory) { memory.delete(); });
        throw error;
    }
}

function releaseUnusedModels(pairs) {
    models.forEach(function (entry, pair) {
        if (pairs.indexOf(pair) !== -1) return;
        entry.model.delete();
        entry.list.delete();
        entry.owned.forEach(function (memory) { memory.delete(); });
        models.delete(pair);
    });
}

function translateParts(pair, texts) {
    var input = new Module.VectorString();
    var options = modernEngine ? new Module.VectorResponseOptions() : new Module.ResponseOptions();
    var output;
    try {
        texts.forEach(function (text) {
            input.push_back(text);
            if (modernEngine) options.push_back({ qualityScores: false, alignment: false, html: false });
        });
        output = service.translate(models.get(pair).model, input, options);
        var translated = [];
        for (var i = 0; i < output.size(); i++) {
            var response = output.get(i);
            try { translated.push(response.getTranslatedText()); }
            finally { response.delete(); }
        }
        return translated;
    } finally {
        if (output) output.delete();
        input.delete();
        options.delete();
    }
}

async function detectLanguage(text) {
    text = text.replace(/https?:\/\/\S+|www\.\S+|@[\p{L}\p{N}_]+/gu, " ").replace(/\s+/g, " ").trim();
    // Short shared words (for example English "die" / German "die") are ambiguous.
    var letters = text.match(/\p{L}/gu) || [];
    if (letters.length < 8) return "";
    await loadLanguageClassifier();
    var predictions = classifier.predict(text, 2, 0);
    try {
        if (!predictions.size()) return "";
        var best = predictions.get(0);
        var second = predictions.size() > 1 ? predictions.get(1) : [0, ""];
        if (best[0] < 0.7 || best[0] - second[0] < 0.2) return "";
        var language = best[1].replace("__label__", "");
        return language === "no" ? "nb" : language;
    } finally { predictions.delete(); }
}

async function processRequest(message) {
    if (Date.now() > message.deadline) return null;
    var texts = message.texts;
    if (!Array.isArray(texts) || !texts.length || texts.length > 64 || texts.some(function (text) { return typeof text !== "string" || !text.trim(); }) || texts.join(" ").length > 16000) return null;
    var to = message.to;
    var parts = [];
    var groups = new Map();
    // HTML can split a sentence into short text nodes around formatting/emotes.
    var contextLanguage = !message.from && texts.length > 1 ? await detectLanguage(texts.join(" ")) : "";
    var segmenter = !message.from && typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "sentence" }) : null;
    for (var i = 0; i < texts.length; i++) {
        var sentences = message.from ? [texts[i]] : segmenter
            ? Array.from(segmenter.segment(texts[i]), function (entry) { return entry.segment; })
            : texts[i].match(/[^.!?\n]+[.!?]*(?:\s+|$)|[\s\S]/g);
        for (var j = 0; j < sentences.length; j++) {
            var sentence = sentences[j];
            var part = { index: i, text: sentence };
            parts.push(part);
            var from = message.from || await detectLanguage(sentence) || contextLanguage;
            if (!from || from === to) continue;
            if (!groups.has(from)) groups.set(from, []);
            groups.get(from).push(part);
        }
    }
    if (!groups.size) return texts;
    if (Date.now() < retryAfter) return null;
    await initialize();
    for (var entry of groups) {
        var source = entry[0];
        var group = entry[1];
        var pairs = source === "en" || to === "en" ? [source + to] : [source + "en", "en" + to];
        if (pairs.some(function (pair) { return !registry[pair]; })) return null;
        releaseUnusedModels(pairs);
        try {
            for (var k = 0; k < pairs.length; k++) await loadModel(pairs[k]);
        } catch (error) {
            retryAfter = Date.now() + 60000;
            throw error;
        }
        // Keep completed downloads even when this message's deadline has passed.
        if (Date.now() > message.deadline) return null;
        var translated = group.map(function (part) { return part.text.trim(); });
        for (var n = 0; n < pairs.length; n++) translated = translateParts(pairs[n], translated);
        group.forEach(function (part, index) {
            part.text = part.text.match(/^\s*/)[0] + translated[index] + part.text.match(/\s*$/)[0];
        });
    }
    var result = texts.map(function () { return ""; });
    parts.forEach(function (part) { result[part.index] += part.text; });
    return result;
}

async function drain() {
    if (processing) return;
    processing = true;
    try {
        while (queue.length) {
            var message = queue.shift();
            try { self.postMessage({ id: message.id, translations: await processRequest(message) }); }
            catch (error) { self.postMessage({ id: message.id, error: String(error.message || error) }); }
        }
    } finally { processing = false; }
}

self.onmessage = function (event) {
    var message = event.data || {};
    if (message.action === "prepare") {
        Promise.all([initialize(), message.detect ? loadLanguageClassifier() : Promise.resolve()]).catch(function (error) {
            self.postMessage({ error: String(error.message || error) });
        });
        return;
    }
    if (queue.length >= 16) {
        self.postMessage({ id: message.id, translations: null });
        return;
    }
    queue.push(message);
    drain();
};
