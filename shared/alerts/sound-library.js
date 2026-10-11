(function (global) {
    'use strict';
    var base = new URL('../../', document.currentScript.src).href;
    var active = null;
    var widgets = [];
    var catalogPromise = null;
    var browserClose = null;
    var starterCount = 17;
    var sounds = [
        ['applause', 'Applause', 'Effects'], ['drumroll', 'Drumroll', 'Effects'],
        ['whoosh', 'Whoosh', 'Effects'], ['cash-register', 'Cash register', 'Effects'],
        ['boing', 'Boing', 'Effects'], ['record-scratch', 'Record scratch', 'Effects'],
        ['pop', 'Pop', 'Effects'], ['camera', 'Camera shutter', 'Effects'],
        ['voice-thank-you', 'Thanks for watching!', 'Voiced phrases'],
        ['voice-welcome', 'Welcome to the stream!', 'Voiced phrases'],
        ['voice-lets-go', "Let’s go!", 'Voiced phrases'],
        ['voice-hype-train', 'All aboard the hype train!', 'Voiced phrases']
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
    function loadCatalog() {
        if (!catalogPromise) catalogPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = new URL('shared/alerts/audio-catalog.js', base).href;
            script.onload = function () {
                if (!Array.isArray(global.SSNAudioCatalog)) { catalogPromise = null; reject(new Error('Sound catalog is unavailable.')); return; }
                global.SSNAudioCatalog.forEach(function (sound) {
                    if (!sounds.some(function (entry) { return entry.url === sound.url; })) sounds.push(sound);
                });
                resolve(global.SSNAudioCatalog);
            };
            script.onerror = function () { script.remove(); catalogPromise = null; reject(new Error('Could not load the sound catalog. Try again.')); };
            document.head.appendChild(script);
        });
        return catalogPromise;
    }
    function browse(options, opener, status) {
        stop();
        if (browserClose) browserClose();
        var tokenBytes = new Uint32Array(4);
        global.crypto.getRandomValues(tokenBytes);
        var token = Array.from(tokenBytes).join('-');
        var url = new URL('audio-library.html', base);
        url.searchParams.set('picker', token);
        url.searchParams.set('selected', options.getValue() || '');
        if (options.setChoices) {
            url.searchParams.set('multiple', '1');
            url.searchParams.set('choices', JSON.stringify(options.getChoices ? options.getChoices().slice(0, 20) : []));
        }
        var computed = getComputedStyle(document.body);
        var channels = computed.color.match(/[\d.]+/g);
        var dark = channels ? (Number(channels[0]) * .2126 + Number(channels[1]) * .7152 + Number(channels[2]) * .0722 > 150) : false;
        if (document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode')) dark = true;
        url.searchParams.set('theme', dark ? 'dark' : 'light');
        var volume = Number(options.getVolume());
        url.searchParams.set('volume', Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.35);
        var backdrop = document.createElement('div'); backdrop.className = 'ssn-audio-dialog';
        backdrop.setAttribute('role', 'dialog'); backdrop.setAttribute('aria-modal', 'true'); backdrop.setAttribute('aria-label', 'Choose a sound');
        var frame = document.createElement('iframe'); frame.title = 'Browse and choose a sound'; frame.src = url.href;
        var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'ssn-audio-dialog-cancel'; cancel.textContent = 'Close sound browser';
        var hidden = [];
        Array.from(document.body.children).forEach(function (child) {
            if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') return;
            hidden.push([child, child.getAttribute('aria-hidden')]); child.setAttribute('aria-hidden', 'true');
        });
        var overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
        backdrop.appendChild(cancel); backdrop.appendChild(frame); document.body.appendChild(backdrop); cancel.focus();
        var closed = false;
        function close() {
            if (closed) return; closed = true;
            global.removeEventListener('message', receive); document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', contain, true);
            backdrop.remove(); document.body.style.overflow = overflow;
            hidden.forEach(function (entry) { if (entry[1] === null) entry[0].removeAttribute('aria-hidden'); else entry[0].setAttribute('aria-hidden', entry[1]); });
            browserClose = null;
            var focusTarget = opener.isConnected ? opener : document.getElementById(opener.id);
            if (focusTarget) focusTarget.focus();
        }
        function receive(event) {
            var data = event.data;
            if (event.source !== frame.contentWindow || event.origin !== url.origin || !data || data.token !== token) return;
            if (data.type === 'ssn-audio-close') close();
            if (data.type === 'ssn-audio-ready') { cancel.hidden = true; frame.focus(); }
            if (data.type !== 'ssn-audio-select' && data.type !== 'ssn-audio-choices') return;
            loadCatalog().then(function (catalog) {
                if (closed || !opener.isConnected) return;
                if (data.type === 'ssn-audio-choices') {
                    if (!options.setChoices || !Array.isArray(data.ids) || data.ids.length < 2 || data.ids.length > 20) return;
                    var choices = data.ids.map(function (id) { return catalog.find(function (entry) { return entry.id === id; }); });
                    if (choices.some(function (entry) { return !entry; }) || new Set(data.ids).size !== data.ids.length) return;
                    options.setChoices(choices.map(function (entry) { return entry.url; })); syncAll(); close();
                    status.textContent = 'One of ' + choices.length + ' selected sounds will play at random.';
                    return;
                }
                if (typeof data.id !== 'string') return;
                var sound = catalog.find(function (entry) { return entry.id === data.id; });
                if (!sound) return;
                options.setValue(sound.url); syncAll(); close();
                status.textContent = (sound.text || sound.name) + ' selected.';
            }).catch(function (error) { close(); status.textContent = error.message; });
        }
        function keydown(event) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } else if (event.key === 'Tab' && document.activeElement === cancel) { event.preventDefault(); frame.focus(); } }
        function contain(event) { if (!backdrop.contains(event.target)) frame.focus(); }
        cancel.addEventListener('click', close);
        backdrop.addEventListener('click', function (event) { if (event.target === backdrop) close(); });
        global.addEventListener('message', receive); document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', contain, true);
        browserClose = close;
    }
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
        sounds.slice(0, starterCount).forEach(function (sound) {
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
        var browseButton = document.createElement('button');
        browseButton.type = 'button'; browseButton.textContent = 'Browse sounds'; browseButton.id = options.id + '-browse';
        browseButton.addEventListener('click', function () { browse(options, browseButton, status); });
        function sync() {
            var value = options.getValue() || '';
            var selectedSound = sounds.find(function (sound) { return sound.url === value; });
            if (selectedSound && !Array.from(select.options).some(function (option) { return option.value === value; })) {
                var option = document.createElement('option'); option.value = value; option.textContent = selectedSound.text || selectedSound.name; select.appendChild(option);
            }
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
        row.appendChild(label); row.appendChild(select); row.appendChild(browseButton); row.appendChild(button); row.appendChild(status);
        options.container.appendChild(row);
        sync();
        widgets.push({element: row, sync: sync});
        if (String(options.getValue() || '').indexOf('./audio/catalog/') === 0) loadCatalog().then(syncAll).catch(function () {});
        if (options.input) {
            var changed = function () { if (active && active.row === row) stop(); sync(); };
            options.input.addEventListener('input', changed);
            options.input.addEventListener('change', changed);
        }
        return {element: row, sync: sync};
    }
    global.addEventListener('pagehide', function () { stop(); if (browserClose) browserClose(); });
    function syncAll() {
        widgets = widgets.filter(function (widget) {return widget.element.isConnected;});
        widgets.forEach(function (widget) {widget.sync();});
    }
    document.addEventListener('toggle', syncAll, true);
    global.SSNSoundLibrary = { sounds: sounds, attach: attach, stop: stop, syncAll: syncAll };
})(window);
