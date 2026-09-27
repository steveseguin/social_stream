(function () {
    'use strict';
    var client = window.SSNAiEventClient;
    var core = window.SSNAiEventOverlay;
    var id = client.params.get('profile') || 'default';
    var stage = document.getElementById('ai-event-stage');
    var queue = Promise.resolve();
    var scale = Number(client.params.get('scale'));
    if (scale > 0) stage.style.zoom = scale;
    if (client.params.get('css')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = client.params.get('css'); document.head.appendChild(link);
    }
    if (client.params.get('b64css')) {
        try {
            var style = document.createElement('style');
            style.textContent = atob(client.params.get('b64css'));
            document.head.appendChild(style);
        } catch (error) { console.error('Invalid b64css:', error.message); }
    }
    function allowed(message) {
        var only = client.params.get('onlytype');
        var hide = client.params.get('hidetype');
        return (!only || only.split(',').indexOf(message.type) >= 0) && (!hide || hide.split(',').indexOf(message.type) < 0);
    }
    client.load(false).then(function (profiles) {
        var profile = profiles[id];
        if (!profile) throw new Error('Save configuration "' + id + '" in AI Event Overlay setup first.');
        client.subscribe(profile, function (payload) {
            var message = core.eventMessage(payload, profile.mode, id);
            if (!message || !allowed(message)) return;
            queue = queue.then(async function () {
                var result = await client.request('generateAiEvent', { profile: id, message: message }, 195000);
                if (result.warnings.length) console.warn('AI Event Overlay:', result.warnings.join(' '));
                await client.render(stage, result);
            }).catch(function (error) { console.error('AI Event Overlay:', error.message); });
        });
    }).catch(function (error) { console.error('AI Event Overlay:', error.message); });
}());
