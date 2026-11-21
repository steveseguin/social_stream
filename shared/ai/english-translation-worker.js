'use strict';

// The model remains a separate, unchanged CC BY-SA 3.0 asset.
// Runtime and model attribution: ../../thirdparty/fasttext/NOTICE.txt.
var classifier = null;
var loading = null;

function loadLanguageClassifier() {
    if (!loading) {
        loading = (async function () {
            importScripts('../../thirdparty/fasttext/fasttext.js');
            var base = new URL('../../thirdparty/fasttext/', self.location.href).href;
            var runtime = await FastTextModule({
                locateFile: function (file) { return base + file; }
            });
            var response = await fetch(base + 'lid.176.ftz');
            if (!response.ok) throw new Error('Language model could not be loaded.');
            runtime.FS.writeFile('/lid.176.ftz', new Uint8Array(await response.arrayBuffer()));
            classifier = new runtime.FastText();
            classifier.loadModel('/lid.176.ftz');
            runtime.FS.unlink('/lid.176.ftz');
        }());
    }
    return loading;
}

async function needsEnglishTranslation(text) {
    // Clean only the detection copy, never the original chat message.
    text = String(text || '').replace(/https?:\/\/\S+|www\.\S+|@[\p{L}\p{N}_]+/gu, ' ').replace(/\s+/g, ' ').trim();
    var letters = text.match(/\p{L}/gu) || [];
    if (text.length > 16000 || letters.length < 2) return false;
    // Short alphabetic chat is often slang or a name. CJK text can convey an
    // entire message in just a few characters.
    if (letters.length < 8 && !letters.every(function (letter) {
        return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(letter);
    })) return false;

    await loadLanguageClassifier();
    var predictions = classifier.predict(text, 2, 0);
    try {
        if (!predictions.size()) return false;
        var first = predictions.get(0);
        var second = predictions.size() > 1 ? predictions.get(1) : [0, ''];
        return first[1] !== '__label__en' && first[0] >= 0.95 && first[0] - second[0] >= 0.2;
    } finally {
        predictions.delete();
    }
}

self.onmessage = async function (event) {
    var message = event.data || {};
    try {
        var translate = await needsEnglishTranslation(message.text);
        self.postMessage({ id: message.id, translate: translate });
    } catch (error) {
        self.postMessage({ id: message.id, error: String(error.message || error) });
    }
};
