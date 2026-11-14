(function () {
    'use strict';
    var core = window.SSNAiEventOverlay;
    var overlayBase = '';
    var pending = {};
    var serial = 0;
    function request(action, args, timeout) {
        return new Promise(function (resolve, reject) {
            if (window.parent === window || ['chrome-extension:', 'moz-extension:', 'file:'].indexOf(location.protocol) < 0) return reject(new Error('Open AI Event Overlay settings from the SSN popup.'));
            var target = ++serial;
            var timer = setTimeout(function () { delete pending[target]; reject(new Error('SSN did not respond. Try connecting again.')); }, timeout || 15000);
            pending[target] = { resolve: resolve, reject: reject, timer: timer };
            window.parent.postMessage({ aiEventSettings: Object.assign({}, args || {}, { action: action, target: target }) }, '*');
        });
    }
    window.addEventListener('message', function (event) {
        if (event.source !== window.parent || !event.data || !event.data.aiEventSettingsResponse) return;
        var response = event.data.aiEventSettingsResponse;
        var job = pending[response.target];
        if (!job) return;
        clearTimeout(job.timer); delete pending[response.target];
        overlayBase = response.overlayBase || overlayBase;
        if (response.error) job.reject(new Error(response.error));
        else job.resolve(response.value);
    });
    var profiles = {};
    var fields = Object.keys(core.profile());
    function el(id) { return document.getElementById(id); }
    function status(text) { el('status').textContent = text; }
    function variationOptions() {
        var selected = el('test-variation').value;
        var choices = el('variations').value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        el('test-variation-row').hidden = !choices.length;
        el('test-variation').textContent = '';
        [''].concat(choices).forEach(function (choice) {
            var option = document.createElement('option'); option.value = choice; option.textContent = choice || 'No variation'; el('test-variation').appendChild(option);
        });
        el('test-variation').value = choices.indexOf(selected) >= 0 ? selected : '';
    }
    function updateOptions() {
        el('mode-help').hidden = el('mode').value !== 'all';
        ['image', 'tts'].forEach(function (kind) { el(kind + 'Endpoint').required = el(kind + 'Enabled').checked; });
    }
    function busy(value) {
        el('fields').disabled = value;
        el('saved').disabled = value;
        el('test').disabled = value;
    }
    function fill(p) {
        var stored = p || {};
        p = core.profile(p);
        fields.forEach(function (key) {
            if (typeof p[key] === 'boolean') el(key).checked = p[key];
            else el(key).value = p[key];
        });
        ['image', 'tts'].forEach(function (kind) {
            el(kind + 'Key').value = '';
            el(kind + 'Key').placeholder = stored[kind + 'KeySet'] ? 'Saved. Leave blank to keep.' : 'No saved key';
            el(kind + 'ClearKey').checked = false;
        });
        variationOptions(); updateOptions();
        showURL(profiles[p.id] ? p.id : '');
    }
    function value() {
        var p = {};
        fields.forEach(function (key) { p[key] = el(key).type === 'checkbox' ? el(key).checked : el(key).value; });
        p = core.profile(p);
        ['image', 'tts'].forEach(function (kind) { p[kind + 'ClearKey'] = el(kind + 'ClearKey').checked; });
        return p;
    }
    function showURL(id) {
        el('copy').disabled = !id;
        el('open').hidden = !id;
        if (!id) { el('overlay-url').value = ''; return; }
        if (!overlayBase) { el('overlay-url').value = ''; el('copy').disabled = true; el('open').hidden = true; return; }
        var url = new URL(overlayBase);
        url.pathname = url.pathname.replace(/[^/]*$/, 'aievent-overlay.html');
        url.searchParams.set('profile', id);
        url.hash = 'aieventauth=' + encodeURIComponent(profiles[id].displayToken);
        el('overlay-url').value = url.href;
        el('open').href = url.href;
    }
    function options(selected) {
        el('saved').textContent = '';
        var first = document.createElement('option');
        first.value = ''; first.textContent = 'New overlay'; el('saved').appendChild(first);
        Object.keys(profiles).forEach(function (id) {
            var option = document.createElement('option');
            option.value = id; option.textContent = profiles[id].name + ' (' + id + ')';
            el('saved').appendChild(option);
        });
        el('saved').value = selected || '';
    }
    async function save() {
        var invalid = el('settings-form').querySelector('input:invalid, select:invalid, textarea:invalid');
        if (invalid) { var details = invalid.closest('details'); if (details) details.open = true; }
        if (!el('settings-form').reportValidity()) throw new Error('Complete the required configuration fields.');
        var p = value();
        busy(true);
        status('Saving…');
        try { p = await request('saveAiEventProfile', { value: p }); }
        finally { busy(false); }
        Object.defineProperty(profiles, p.id, { value: p, enumerable: true, configurable: true, writable: true });
        var selectedVariation = el('test-variation').value;
        options(p.id); fill(p); el('test-variation').value = selectedVariation; status('Saved.');
        return p;
    }
    el('settings-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        try { await save(); } catch (error) { status(error.message); }
    });
    el('saved').addEventListener('change', function () { fill(profiles[el('saved').value] || { id: 'overlay-' + Date.now().toString(36) }); });
    el('test').addEventListener('click', async function () {
        try {
            var p = await save();
            busy(true);
            el('preview-status').textContent = 'Generating preview…';
            var message = {
                chatname: el('test-name').value, chatmessage: el('test-message').value, hasDonation: el('test-donation').value, type: 'test', platform: 'test', textonly: true
            };
            var result = await request('generateAiEvent', { profile: p.id, message: message, variation: el('test-variation').value }, 195000);
            el('preview').textContent = '';
            el('preview-status').textContent = result.warnings.length ? result.warnings.join(' ') : 'Preview ready.';
            window.SSNAiEventRender(el('preview'), result, message, { preview: true });
        } catch (error) { el('preview-status').textContent = error.message; }
        finally { busy(false); }
    });
    el('copy').addEventListener('click', async function () {
        try { await navigator.clipboard.writeText(el('overlay-url').value); status('Overlay URL copied.'); }
        catch (_) { el('overlay-url').focus(); el('overlay-url').select(); status('Select and copy the overlay URL.'); }
    });
    async function connect() {
        el('reconnect').hidden = true;
        status('Connecting to SSN…');
        try {
            profiles = await request('getAiEventProfiles');
            var selected = Object.keys(profiles)[0] || '';
            options(selected); fill(profiles[selected]);
            el('fields').disabled = false; el('test').disabled = false;
            status('Ready.');
        } catch (error) {
            status(error.message); el('reconnect').hidden = false;
            if (window.parent === window || ['chrome-extension:', 'moz-extension:', 'file:'].indexOf(location.protocol) < 0) {
                document.querySelector('.layout').hidden = true;
                el('reconnect').hidden = true;
            }
        }
    }
    el('variations').addEventListener('input', variationOptions);
    ['mode', 'imageEnabled', 'ttsEnabled'].forEach(function (key) { el(key).addEventListener('change', updateOptions); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && window.parent !== window) window.parent.postMessage({ aiEventSettingsClose: true }, '*');
    });
    el('reconnect').addEventListener('click', connect);
    fill(); connect();
}());
