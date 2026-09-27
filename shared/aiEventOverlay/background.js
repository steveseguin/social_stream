(function () {
    'use strict';
    var core = window.SSNAiEventOverlay;
    function read() {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get(['aiEventProfiles'], function (result) {
                if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
                resolve(result.aiEventProfiles || {});
            });
        });
    }
    function write(profiles) {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.set({ aiEventProfiles: profiles }, function () {
                if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
                resolve();
            });
        });
    }
    function endpoint(value) {
        var url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Use an HTTP or HTTPS endpoint.');
        return url.href;
    }
    function dataURL(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('Unable to read generated media.')); };
            reader.readAsDataURL(blob);
        });
    }
    async function media(p, kind, text, message) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 90000);
        try {
            var body = kind === 'image' ? { prompt: p.imagePrompt + '\n' + text + '\nViewer: ' + (message.chatname || ''), n: 1 } : { input: text };
            if (p[kind + 'Model']) body.model = p[kind + 'Model'];
            if (kind === 'tts' && p.ttsVoice) body.voice = p.ttsVoice;
            var headers = { 'Content-Type': 'application/json' };
            if (p[kind + 'Key']) headers.Authorization = 'Bearer ' + p[kind + 'Key'];
            var response = await fetch(endpoint(p[kind + 'Endpoint']), { method: 'POST', headers: headers, body: JSON.stringify(body), signal: controller.signal });
            if (!response.ok) throw new Error(kind + ' endpoint returned HTTP ' + response.status);
            var contentType = response.headers.get('content-type') || '';
            if (contentType.indexOf('application/json') >= 0) {
                var value = await response.json();
                var item = value.data && value.data[0] || value;
                if (kind === 'image' && item.b64_json) return 'data:image/png;base64,' + item.b64_json;
                if (item.url) return endpoint(item.url);
                throw new Error(kind + ' endpoint returned no media URL.');
            }
            if (contentType.indexOf(kind === 'image' ? 'image/' : 'audio/') !== 0) throw new Error(kind + ' endpoint returned an unsupported content type.');
            return await dataURL(await response.blob());
        } finally { clearTimeout(timer); }
    }
    async function generate(p, message) {
        if (!isExtensionOn || !settings.allowChatBot) throw new Error('Enable SSN and the private chat bot option in Chat Bots and AI services.');
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 90000);
        var response;
        try {
            response = await callLLMAPI(core.prompt(p, message), p.model || null, null, controller);
        } finally { clearTimeout(timer); }
        if (response && typeof response === 'object') response = response.response || response.value || '';
        var result = core.presentation(response, p);
        result.name = String(message.chatname || '');
        result.donation = String(message.hasDonation || '');
        result.duration = p.duration;
        result.warnings = [];
        await Promise.all(['image', 'tts'].map(async function (kind) {
            if (!p[kind + 'Enabled']) return;
            try { result[kind === 'tts' ? 'audio' : 'image'] = await media(p, kind, result.text, message); }
            catch (error) { result.warnings.push(error.message || 'Media generation failed.'); }
        }));
        return result;
    }
    // Serialize profile writes so saving different configurations cannot overwrite one another.
    var saving = Promise.resolve();
    window.SSNAiEventBackground = {
        handle: async function (request) {
            if (request.action === 'saveAiEventProfile') {
                var p = core.profile(request.value);
                if (!/^[a-zA-Z0-9_-]+$/.test(p.id)) throw new Error('Configuration ID must use letters, numbers, underscores or hyphens.');
                if (p.imageEnabled) endpoint(p.imageEndpoint);
                if (p.ttsEnabled) endpoint(p.ttsEndpoint);
                var task = saving.then(async function () {
                    var profiles = await read();
                    Object.defineProperty(profiles, p.id, { value: p, enumerable: true, writable: true, configurable: true });
                    await write(profiles);
                    return core.publicProfile(p);
                });
                saving = task.catch(function () {});
                return task;
            }
            var profiles = await read();
            if (request.action === 'getAiEventProfiles') {
                if (request.edit) return profiles;
                var visible = {};
                Object.keys(profiles).forEach(function (id) { Object.defineProperty(visible, id, { value: core.publicProfile(profiles[id]), enumerable: true }); });
                return visible;
            }
            if (request.action === 'generateAiEvent') {
                if (!Object.prototype.hasOwnProperty.call(profiles, request.profile)) throw new Error('Save this overlay configuration first.');
                return generate(core.profile(profiles[request.profile]), request.message || {});
            }
            throw new Error('Unknown AI overlay action.');
        }
    };
}());
