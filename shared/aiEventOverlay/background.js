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
    async function media(p, kind, selectedVariation, message) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 90000);
        try {
            var body = kind === 'image' ? { prompt: p.imagePrompt + (selectedVariation ? '\n' + selectedVariation : ''), n: 1 } : { input: core.plainMessage(message) };
            if (p[kind + 'Model']) body.model = p[kind + 'Model'];
            if (kind === 'tts' && p.ttsVoice) body.voice = p.ttsVoice;
            var headers = { 'Content-Type': 'application/json' };
            if (p[kind + 'Key']) headers.Authorization = 'Bearer ' + p[kind + 'Key'];
            var response = await fetch(endpoint(p[kind + 'Endpoint']), { method: 'POST', headers: headers, body: JSON.stringify(body), signal: controller.signal, redirect: 'error', credentials: 'omit' });
            if (!response.ok) throw new Error(kind + ' endpoint returned HTTP ' + response.status);
            var contentType = response.headers.get('content-type') || '';
            if (contentType.indexOf('application/json') >= 0) {
                var value = await response.json();
                var item = value.data && value.data[0] || value;
                if (kind === 'image' && item.b64_json) return 'data:image/png;base64,' + item.b64_json;
                if (!item.url) throw new Error(kind + ' endpoint returned no media URL.');
                // Download media without provider credentials; display pages receive bytes only.
                response = await fetch(endpoint(item.url), { signal: controller.signal, credentials: 'omit', redirect: 'error' });
                if (!response.ok) throw new Error('Media download failed.');
                contentType = response.headers.get('content-type') || '';
            }
            if (contentType.indexOf(kind === 'image' ? 'image/' : 'audio/') !== 0) throw new Error(kind + ' endpoint returned an unsupported content type.');
            return await dataURL(await response.blob());
        } finally { clearTimeout(timer); }
    }
    async function generate(p, request) {
        if (!isExtensionOn || !settings.allowChatBot) throw new Error('Enable SSN and the private chat bot option in Chat Bots and AI services.');
        var selectedVariation = core.variation(p, request.variation);
        var message = request.message || {};
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 90000);
        var response;
        try {
            response = await callLLMAPI(core.prompt(p, selectedVariation), p.model || null, null, controller, null, null, { strictEndpoint: true, localBrowserStateless: true });
        } catch (_) {
            // Provider errors may include request details. Never forward them to an overlay.
            throw new Error('Overlay generation failed. Check the configured AI service in SSN.');
        } finally { clearTimeout(timer); }
        if (response && typeof response === 'object') response = response.response || response.value || '';
        var result = core.presentation(response, p);
        result.warnings = [];
        await Promise.all(['image', 'tts'].map(async function (kind) {
            if (!p[kind + 'Enabled']) return;
            try { result[kind === 'tts' ? 'audio' : 'image'] = await media(p, kind, selectedVariation, message); }
            catch (_) { result.warnings.push(kind === 'image' ? 'Image generation failed.' : 'Speech generation failed.'); }
        }));
        return result;
    }
    // Serialize profile writes so saving different configurations cannot overwrite one another.
    var saving = Promise.resolve();
    function token() {
        return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(32)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    function editable(p) {
        var result = core.profile(p);
        ['image', 'tts'].forEach(function (kind) {
            result[kind + 'KeySet'] = !!result[kind + 'Key'];
            result[kind + 'Key'] = '';
        });
        result.displayToken = p.displayToken;
        return result;
    }
    function serialize(work) {
        var task = saving.then(work);
        saving = task.catch(function () {});
        return task;
    }
    var relays = Object.create(null);
    var deliveries = Object.create(null);
    async function deliver(profile, payload) {
        var text = JSON.stringify(payload);
        var sent;
        if (text.length <= 12000) sent = await sendTargetP2P(payload, 'aievent-' + profile, { retry: false });
        else {
            var chunkId = 'ai-event-' + token(), total = Math.ceil(text.length / 12000);
            for (var index = 0; index < total; index++) {
                sent = await sendTargetP2P({ action: 'ssnBridgeChunk', chunkId: chunkId, index: index, total: total, value: text.slice(index * 12000, (index + 1) * 12000) }, 'aievent-' + profile, { retry: false });
                if (!sent) break;
            }
        }
        var relay = relays[profile];
        if (relay && Date.now() - relay.seen < 30000) sent = relay.connection.send({ aiEventMessage: payload }) || sent;
        return sent;
    }
    var relayRevision = 0;
    async function syncRelay() {
        if (!window.SSNAiEventRelay) return;
        var revision = ++relayRevision;
        try {
            var profiles = await read();
            if (revision !== relayRevision) return;
            var session = typeof streamID === 'string' && isExtensionOn ? streamID : '';
            var url = typeof urlParams !== 'undefined' && urlParams.has('localserver') ? SocialStreamLocalServer.getWebSocketUrl(urlParams) : 'wss://io.socialstream.ninja/api';
            Object.keys(relays).forEach(function (id) {
                var p = profiles[id];
                if (!session || !p || relays[id].url !== url || relays[id].room !== window.SSNAiEventRelay.room(session, p.displayToken)) { relays[id].connection.close(); delete relays[id]; }
            });
            if (!session) return;
            Object.keys(profiles).forEach(function (id) {
                var p = profiles[id];
                if (!p.displayToken || relays[id]) return;
                var state = { room: window.SSNAiEventRelay.room(session, p.displayToken), url: url, seen: 0 };
                state.connection = window.SSNAiEventRelay.connect(url, state.room, true, async function (data) {
                    if (data.aiEventReady === p.displayToken) { state.seen = Date.now(); return; }
                    var request = data.aiEventRequest;
                    if (!request || request.profile !== id) return;
                    try {
                        var value = await window.SSNAiEventBackground.handle(request);
                        state.connection.send({ aiEventResponse: { target: request.target, value: value } });
                    } catch (error) { state.connection.send({ aiEventResponse: { target: request.target, error: error.message || 'AI overlay request failed.' } }); }
                });
                relays[id] = state;
            });
        } catch (_) { console.warn('AI overlay relay could not load its saved configurations.'); }
    }
    window.SSNAiEventBackground = {
        syncRelay: syncRelay,
        choices: async function () {
            await saving;
            var profiles = await read();
            return Object.keys(profiles).map(function (id) {
                var p = core.profile(profiles[id]);
                return { id: p.id, name: p.name, mode: p.mode, variations: p.variations.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean) };
            });
        },
        trigger: async function (request) {
            if (settings.disablehost) throw new Error('Host controls are disabled.');
            await saving;
            var profiles = await read();
            if (!Object.prototype.hasOwnProperty.call(profiles, request.profile)) throw new Error('Choose a saved AI overlay.');
            var p = core.profile(profiles[request.profile]);
            if (p.mode !== 'flow') throw new Error('Set this overlay’s trigger to Event Flow in overlay settings.');
            var selectedVariation = core.variation(p, request.variation);
            var message = request.message || {};
            if (request.prepare === true) {
                // Paid flow rewards wait for generation and confirmed receipt of the template.
                var expiresAt = request.expiresAt || Date.now() + 240000;
                var result = await generate(p, request);
                if (Date.now() >= expiresAt) throw new Error('AI overlay reward timed out.');
                var id = token();
                var confirmation = new Promise(function (resolve, reject) {
                    deliveries[id] = { profile: p.id, resolve: resolve, timer: setTimeout(function () { reject(new Error('AI overlay delivery was not confirmed.')); }, expiresAt - Date.now()) };
                });
                try {
                    if (!await deliver(p.id, { aiEventPresentation: { id: id, profile: p.id, expiresAt: expiresAt, result: result, message: message } })) throw new Error('AI overlay is not connected. Open its Browser Source URL first.');
                    await confirmation;
                    return { sent: true };
                } finally { clearTimeout(deliveries[id].timer); delete deliveries[id]; }
            }
            var meta = message.meta && typeof message.meta === 'object' && !Array.isArray(message.meta) ? Object.assign({}, message.meta) : (message.meta !== undefined ? { value: message.meta } : {});
            meta.aiEventOverlay = { profile: p.id };
            if (selectedVariation) meta.aiEventOverlay.variation = selectedVariation;
            var payload = Object.assign({}, message, { meta: meta });
            if (!await deliver(p.id, payload)) throw new Error('AI overlay is not connected. Open its Browser Source URL first.');
            return { sent: true };
        },
        handleFlow: async function (request, sender) {
            var senderURL = sender && sender.url && sender.url.split(/[?#]/)[0];
            if (!senderURL || senderURL !== chrome.runtime.getURL('actions/index.html')) throw new Error('Open the local Event Flow editor.');
            if (request.action === 'list') return this.choices();
            if (request.action === 'show') return this.trigger(request);
            throw new Error('Unknown AI overlay flow action.');
        },
        // Called only by the attested local popup/settings runtime route.
        handleSettings: async function (request, sender) {
            var localPopup = typeof isSSAPP !== 'undefined' && isSSAPP && sender && sender.aiEventLocalPopup === true;
            var senderURL = sender && sender.url && sender.url.split(/[?#]/)[0];
            var packagedPage = senderURL && ['popup.html', 'aievent.html'].some(function (page) { return senderURL === chrome.runtime.getURL(page); });
            if (!localPopup && !packagedPage) throw new Error('Open AI Event Overlay settings from the SSN popup.');
            if (request.action === 'saveAiEventProfile') {
                var p = core.profile(request.value);
                if (!/^[a-zA-Z0-9_-]+$/.test(p.id)) throw new Error('Configuration ID must use letters, numbers, underscores or hyphens.');
                if (p.imageEnabled) endpoint(p.imageEndpoint);
                if (p.ttsEnabled) endpoint(p.ttsEndpoint);
                return serialize(async function () {
                    var profiles = await read();
                    var previous = Object.prototype.hasOwnProperty.call(profiles, p.id) ? profiles[p.id] : {};
                    ['image', 'tts'].forEach(function (kind) {
                        var key = kind + 'Key';
                        if (request.value[kind + 'ClearKey'] === true) p[key] = '';
                        else if (!p[key] && previous[key]) {
                            if (p[kind + 'Endpoint'] !== previous[kind + 'Endpoint']) throw new Error('Enter or remove the saved API key when changing its endpoint.');
                            p[key] = previous[key];
                        }
                    });
                    p.displayToken = previous.displayToken || token();
                    Object.defineProperty(profiles, p.id, { value: p, enumerable: true, writable: true, configurable: true });
                    await write(profiles);
                    syncRelay();
                    return editable(p);
                });
            }
            if (request.action === 'getAiEventProfiles') {
                return serialize(async function () {
                    var profiles = await read();
                    var visible = {};
                    var changed = false;
                    Object.keys(profiles).forEach(function (id) {
                        if (!profiles[id].displayToken) { profiles[id].displayToken = token(); changed = true; }
                        Object.defineProperty(visible, id, { value: editable(profiles[id]), enumerable: true });
                    });
                    if (changed) { await write(profiles); syncRelay(); }
                    return visible;
                });
            }
            await saving;
            var profiles = await read();
            if (request.action === 'generateAiEvent') {
                if (!Object.prototype.hasOwnProperty.call(profiles, request.profile)) throw new Error('Save this overlay configuration first.');
                return generate(core.profile(profiles[request.profile]), request);
            }
            throw new Error('Unknown AI overlay action.');
        },
        handle: async function (request) {
            if (settings.disablehost) throw new Error('Host controls are disabled.');
            if (request.edit || ['getAiEventProfiles', 'generateAiEvent', 'aiEventDelivered'].indexOf(request.action) < 0) throw new Error('Settings are available only in the SSN popup.');
            await saving;
            var profiles = await read();
            var p = Object.prototype.hasOwnProperty.call(profiles, request.profile) && profiles[request.profile];
            if (!p || !p.displayToken || request.displayToken !== p.displayToken) throw new Error('Copy a new overlay URL from AI Event Overlay settings in SSN.');
            if (request.action === 'aiEventDelivered') {
                var delivery = deliveries[request.delivery];
                if (!delivery || delivery.profile !== p.id) throw new Error('AI overlay delivery is no longer pending.');
                delivery.resolve();
                return { received: true };
            }
            if (request.action === 'getAiEventProfiles') {
                var visible = {};
                Object.defineProperty(visible, p.id, { value: core.publicProfile(p), enumerable: true });
                return visible;
            }
            return generate(core.profile(p), request);
        }
    };
    syncRelay();
}());
