(function () {
    'use strict';
    var client = window.SSNAiEventClient;
    var core = window.SSNAiEventOverlay;
    var profiles = {};
    var fields = Object.keys(core.profile());
    function el(id) { return document.getElementById(id); }
    function status(text) { el('status').textContent = text; }
    function fill(p) {
        p = core.profile(p);
        fields.forEach(function (key) {
            if (typeof p[key] === 'boolean') el(key).checked = p[key];
            else el(key).value = p[key];
        });
        showURL(profiles[p.id] ? p.id : '');
    }
    function value() {
        var p = {};
        fields.forEach(function (key) { p[key] = el(key).type === 'checkbox' ? el(key).checked : el(key).value; });
        return core.profile(p);
    }
    function showURL(id) {
        el('copy').disabled = !id;
        el('open').hidden = !id;
        if (!id) { el('overlay-url').value = ''; return; }
        var url = new URL('aievent-overlay.html', location.href);
        url.search = location.search;
        url.searchParams.set('profile', id);
        el('overlay-url').value = url.href;
        el('open').href = url.href;
    }
    function options(selected) {
        el('saved').textContent = '';
        var first = document.createElement('option');
        first.value = ''; first.textContent = 'New configuration'; el('saved').appendChild(first);
        Object.keys(profiles).forEach(function (id) {
            var option = document.createElement('option');
            option.value = id; option.textContent = profiles[id].name + ' (' + id + ')';
            el('saved').appendChild(option);
        });
        el('saved').value = selected || '';
    }
    async function save() {
        if (!el('settings-form').reportValidity()) throw new Error('Complete the required configuration fields.');
        var p = value();
        status('Saving…');
        await client.request('saveAiEventProfile', { value: p });
        Object.defineProperty(profiles, p.id, { value: p, enumerable: true, configurable: true, writable: true });
        options(p.id); showURL(p.id); status('Saved. Reload the OBS source to use these settings.');
        return p;
    }
    el('settings-form').addEventListener('submit', async function (event) {
        event.preventDefault(); el('save').disabled = true;
        try { await save(); } catch (error) { status(error.message); }
        finally { el('save').disabled = false; }
    });
    el('saved').addEventListener('change', function () { fill(profiles[el('saved').value] || { id: 'overlay-' + Date.now().toString(36) }); });
    el('test').addEventListener('click', async function () {
        el('test').disabled = true;
        try {
            var p = await save();
            status('Generating preview…');
            var result = await client.request('generateAiEvent', { profile: p.id, message: {
                chatname: el('test-name').value, chatmessage: el('test-message').value, hasDonation: el('test-donation').value, type: 'test', platform: 'test', textonly: true
            } }, 195000);
            el('preview').textContent = '';
            status(result.warnings.length ? 'Generated text. ' + result.warnings.join(' ') : 'Preview ready.');
            await client.render(el('preview'), result);
        } catch (error) { status(error.message); }
        finally { el('test').disabled = false; }
    });
    el('copy').addEventListener('click', async function () {
        try { await navigator.clipboard.writeText(el('overlay-url').value); status('Overlay URL copied.'); }
        catch (_) { el('overlay-url').focus(); el('overlay-url').select(); status('Select and copy the overlay URL.'); }
    });
    async function connect() {
        el('reconnect').hidden = true;
        status('Connecting to SSN…');
        try {
            profiles = await client.load(true);
            var selected = client.params.get('profile') || Object.keys(profiles)[0] || '';
            options(selected); fill(profiles[selected]);
            el('fields').disabled = false; el('test').disabled = false;
            status('Connected. Configure an overlay, then save and test it.');
        } catch (error) { status(error.message); el('reconnect').hidden = false; }
    }
    el('reconnect').addEventListener('click', connect);
    fill(); connect();
}());
