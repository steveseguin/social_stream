(function () {
    'use strict';
    var button = document.getElementById('ai-event-settings-open');
    var panel = document.getElementById('ai-event-settings-panel');
    var frame = document.getElementById('ai-event-settings-frame');
    if (!button || !panel || !frame) return;
    var localURL = new URL('aievent.html', location.href).href;
    button.addEventListener('click', function () {
        panel.showModal();
        button.setAttribute('aria-expanded', 'true');
        if (!frame.src) frame.src = localURL;
        frame.focus();
    });
    document.getElementById('ai-event-settings-close').addEventListener('click', function () {
        panel.close();
    });
    panel.addEventListener('close', function () {
        button.setAttribute('aria-expanded', 'false');
        button.focus();
    });
    window.addEventListener('message', function (event) {
        // Only this packaged settings frame may use the popup's native runtime/IPC.
        if (event.source !== frame.contentWindow || frame.src !== localURL || !event.data) return;
        try { if (frame.contentWindow.location.href !== localURL) return; } catch (_) { return; }
        if (event.data.aiEventSettingsClose) { panel.close(); return; }
        if (!event.data.aiEventSettings) return;
        var request = event.data.aiEventSettings;
        if (['getAiEventProfiles', 'saveAiEventProfile', 'generateAiEvent'].indexOf(request.action) < 0) return;
        chrome.runtime.sendMessage({ cmd: 'aiEvent', action: request.action, value: request.value, profile: request.profile, message: request.message, variation: request.variation }, function (response) {
            try { if (frame.contentWindow.location.href !== localURL) return; } catch (_) { return; }
            var link = document.getElementById('aievent');
            frame.contentWindow.postMessage({ aiEventSettingsResponse: {
                target: request.target,
                value: response && response.value,
                error: chrome.runtime.lastError ? 'SSN is unavailable.' : response && response.error || (!response || response.tryAgain ? 'SSN is loading. Try connecting again.' : ''),
                overlayBase: link && (link.raw || link.dataset.raw) || ''
            } }, '*');
        });
    });
}());
