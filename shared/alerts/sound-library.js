(function (global) {
    'use strict';
    var base = new URL('../../', document.currentScript.src).href;
    var active = null;
    var widgets = [];
    var sounds = [
        ['applause', 'Applause', 'Effects'], ['drumroll', 'Drumroll', 'Effects'],
        ['whoosh', 'Whoosh', 'Effects'], ['cash-register', 'Cash register', 'Effects'],
        ['boing', 'Boing', 'Effects'], ['record-scratch', 'Record scratch', 'Effects'],
        ['pop', 'Pop', 'Effects'], ['camera', 'Camera shutter', 'Effects'],
        ['voice-thank-you', 'Thank you!', 'Voiced phrases (synthetic)'],
        ['voice-welcome', 'Welcome to the stream!', 'Voiced phrases (synthetic)'],
        ['voice-lets-go', "Let’s go!", 'Voiced phrases (synthetic)'],
        ['voice-hype-train', 'All aboard the hype train!', 'Voiced phrases (synthetic)']
    ].map(function (entry) {
        return { name: entry[1], group: entry[2], url: './audio/alerts/' + entry[0] + '.wav' };
    }).concat([
        { name: 'Bell', group: 'Simple sounds', url: './audio/bell.wav' },
        { name: 'Chime', group: 'Simple sounds', url: './audio/chime.wav' },
        { name: 'Join', group: 'Simple sounds', url: './audio/join.wav' },
        { name: 'Leave', group: 'Simple sounds', url: './audio/leave.wav' },
        { name: 'Tone', group: 'Simple sounds', url: './audio/tone.mp3' }
    ]);
    function stop() { if (active) active.stop(); }
    function attach(options) {
        var row = document.createElement('div');
        row.className = 'ssn-sound-picker';
        var label = document.createElement('label');
        var select = document.createElement('select');
        select.id = options.id + '-library';
        label.htmlFor = select.id;
        label.textContent = options.label || 'Play this sound';
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose a sound…';
        select.appendChild(placeholder);
        var groups = {};
        sounds.forEach(function (sound) {
            if (!groups[sound.group]) {
                groups[sound.group] = document.createElement('optgroup');
                groups[sound.group].label = sound.group;
                select.appendChild(groups[sound.group]);
            }
            var option = document.createElement('option');
            option.value = sound.url;
            option.textContent = sound.name;
            groups[sound.group].appendChild(option);
        });
        var button = document.createElement('button');
        button.type = 'button';
        button.id = options.id + '-listen';
        button.textContent = 'Listen';
        button.setAttribute('aria-label', 'Listen to selected sound locally');
        var status = document.createElement('span');
        status.id = options.id + '-sound-status';
        status.className = 'ssn-sound-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        select.setAttribute('aria-describedby', status.id);
        function sync() {
            var value = options.getValue() || '';
            select.value = sounds.some(function (s) {return s.url === value;}) ? value : '';
            placeholder.textContent = value && !select.value ? 'Custom sound selected' : 'Choose a sound…';
        }
        select.addEventListener('change', function () {
            if (!select.value) return;
            stop();
            var value = select.value;
            options.setValue(value);
            status.textContent = value.indexOf('/voice-') !== -1 ? 'Synthetic voice clip selected.' : 'Sound selected.';
        });
        button.addEventListener('click', function () {
            var wasPlaying = active && active.row === row;
            stop();
            if (wasPlaying) return;
            var value = String(options.getValue() || '').trim();
            if (!value) { status.textContent = 'Choose a sound or add your own first.'; return; }
            var url;
            try {url = new URL(value, base).href;} catch (_) {status.textContent = 'Enter a valid sound URL.';return;}
            var audio = new Audio(url);
            var volume = Number(options.getVolume());
            audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.35;
            var audition = { row: row, stop: function () {
                audio.pause();
                button.textContent = 'Listen';
                button.setAttribute('aria-label', 'Listen to selected sound locally');
                status.textContent = 'Preview stopped.';
                if (active === audition) active = null;
            }};
            active = audition;
            function finish(message) {
                if (active !== audition) return;
                audition.stop();
                status.textContent = message;
            }
            audio.onended = function () {finish('Preview finished.');};
            audio.onerror = function () {finish('Could not load this sound. Check the URL.');};
            button.textContent = 'Stop';
            button.setAttribute('aria-label', 'Stop local sound preview');
            status.textContent = 'Playing locally at ' + Math.round(audio.volume * 100) + '% volume.';
            audio.play().catch(function () {finish('Could not play this sound. Check the URL and browser audio permissions.');});
        });
        row.appendChild(label); row.appendChild(select); row.appendChild(button); row.appendChild(status);
        options.container.appendChild(row);
        sync();
        widgets.push({element: row, sync: sync});
        if (options.input) {
            var changed = function () { if (active && active.row === row) stop(); sync(); };
            options.input.addEventListener('input', changed);
            options.input.addEventListener('change', changed);
        }
        return {element: row, sync: sync};
    }
    global.addEventListener('pagehide', stop);
    function syncAll() {
        widgets = widgets.filter(function (widget) {return widget.element.isConnected;});
        widgets.forEach(function (widget) {widget.sync();});
    }
    document.addEventListener('toggle', syncAll, true);
    global.SSNSoundLibrary = { sounds: sounds, attach: attach, stop: stop, syncAll: syncAll };
})(window);
