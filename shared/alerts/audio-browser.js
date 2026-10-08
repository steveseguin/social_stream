(function () {
    'use strict';
    var params = new URLSearchParams(location.search);
    var token = params.get('picker');
    var embedded = !!token && parent !== window;
    var multiple = embedded && params.get('multiple') === '1';
    var choices = [];
    var sounds = window.SSNAudioCatalog || [];
    var selected = params.get('selected') || '';
    try { var storedChoices = JSON.parse(params.get('choices')); if (Array.isArray(storedChoices)) choices = sounds.filter(function (s) { return storedChoices.indexOf(s.url) !== -1; }).slice(0, 20).map(function (s) { return s.id; }); } catch (_) {}
    var favorites = readList('ssn-audio-favorites');
    var recent = readList('ssn-audio-recent');
    var limit = 36, active = null, activeId = '', serial = 0;
    var fields = ['search', 'collection', 'category', 'event', 'language', 'style', 'duration'];
    var languages = { en: 'English', es: 'Español', 'pt-BR': 'Português (Brasil)' };
    var styles = { friendly: 'Friendly', upbeat: 'Upbeat', dry: 'Dry' };
    var volume = document.getElementById('preview-volume');
    var theme = params.get('theme');
    if (theme === 'light' || (!theme && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches)) document.documentElement.classList.add('light');
    var initialVolume = Number(params.get('volume'));
    if (params.has('volume') && Number.isFinite(initialVolume)) volume.value = Math.round(Math.max(0, Math.min(1, initialVolume)) * 100);
    document.getElementById('volume-label').textContent = volume.value + '%';
    function readList(key) { try { var value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value.filter(function (id) { return typeof id === 'string'; }).slice(0, 500) : []; } catch (_) { return []; } }
    function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
    function send(type, id) { if (embedded) parent.postMessage({ type: type, token: token, id: id }, location.origin === 'null' ? '*' : location.origin); }
    function make(tag, text, className) { var el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
    function button(text, label, fn, className) { var el = make('button', text, className); el.type = 'button'; el.setAttribute('aria-label', label); el.addEventListener('click', fn); return el; }
    function normalize(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    function value(id) { return document.getElementById(id).value; }
    function paintChoices() { var use = document.getElementById('use-choices'); use.hidden = !multiple; use.disabled = choices.length < 2; use.textContent = 'Use random set (' + choices.length + ')'; }
    function status(text) { document.getElementById('play-status').textContent = text; }
    function paintPlayback() {
        document.querySelectorAll('[data-preview]').forEach(function (el) {
            var playing = el.getAttribute('data-preview') === activeId;
            el.textContent = playing ? 'Stop' : 'Listen';
            el.setAttribute('aria-label', (playing ? 'Stop preview of ' : 'Preview ') + el.getAttribute('data-name'));
            el.setAttribute('aria-pressed', String(playing));
            el.closest('.sound-card').classList.toggle('is-playing', playing);
        });
        document.getElementById('stop').disabled = !active;
    }
    function stop() { serial++; if (active) { active.pause(); active.removeAttribute('src'); active.load(); } active = null; activeId = ''; paintPlayback(); }
    function preview(sound) {
        var wasPlaying = activeId === sound.id;
        stop();
        if (wasPlaying) { status('Preview stopped.'); return; }
        var current = serial;
        var player = new Audio(new URL(sound.url, location.href).href);
        active = player; activeId = sound.id; player.volume = Number(volume.value) / 100;
        document.getElementById('playing').textContent = sound.text || sound.name;
        status('Loading preview…'); paintPlayback();
        player.onended = function () { if (current === serial) { stop(); status('Preview finished.'); } };
        player.onerror = function () { if (current === serial) { stop(); status('Could not load this sound. Try again.'); } };
        player.play().then(function () { if (current === serial) status('Playing locally. Your stream is unchanged.'); }).catch(function () { if (current === serial) { stop(); status('Could not play. Check browser audio permissions.'); } });
    }
    function use(sound) {
        stop(); recent = [sound.id].concat(recent.filter(function (id) { return id !== sound.id; })).slice(0, 30); save('ssn-audio-recent', recent);
        if (embedded) { send('ssn-audio-select', sound.id); return; }
        var url = new URL(sound.url, location.href).href;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { status('Sound URL copied. Paste it into an audio URL field.'); }, function () { showURL(url); });
        else showURL(url);
    }
    function showURL(url) { window.prompt('Copy this sound URL', url); }
    function render() {
        var words = normalize(value('search')).split(/\s+/).filter(Boolean);
        var collection = value('collection'), category = value('category'), language = value('language'), style = value('style'), event = value('event'), duration = Number(value('duration'));
        var filtered = sounds.filter(function (sound) {
            if (collection === 'recommended' && !sound.recommended) return false;
            if (collection === 'favorites' && favorites.indexOf(sound.id) === -1) return false;
            if (collection === 'recent' && recent.indexOf(sound.id) === -1) return false;
            if (collection === 'new' && sound.legacy) return false;
            if (category && sound.category !== category) return false;
            if (language && (sound.language || 'none') !== language) return false;
            if (style && sound.style !== style) return false;
            if (event && (sound.tags || []).indexOf(event) === -1) return false;
            if (duration && sound.duration > duration) return false;
            var haystack = normalize([sound.name, sound.text, sound.description, sound.category].concat(sound.tags || []).join(' '));
            return words.every(function (word) { return haystack.indexOf(word) !== -1; });
        });
        if (collection === 'recent') filtered.sort(function (a, b) { return recent.indexOf(a.id) - recent.indexOf(b.id); });
        var grid = document.getElementById('sounds'); grid.textContent = '';
        filtered.slice(0, limit).forEach(function (sound) {
            var card = make('article', '', 'sound-card'); card.classList.toggle('is-selected', selected === sound.url);
            var top = make('div', '', 'card-top'), art = make('div', '', 'sound-art'); art.setAttribute('aria-hidden', 'true');
            var tile = sound.art || 0; art.style.backgroundPosition = (tile % 3 * 50) + '% ' + (Math.floor(tile / 3) * 50) + '%';
            var title = make('div'); title.appendChild(make('h2', sound.text || sound.name));
            title.appendChild(make('p', [sound.duration ? sound.duration.toFixed(1) + 's' : '', languages[sound.language] || sound.category, styles[sound.style]].filter(Boolean).join(' · '), 'sound-meta'));
            top.appendChild(art); top.appendChild(title); card.appendChild(top);
            card.appendChild(make('p', sound.language ? sound.name + ' · Synthetic voice' : sound.description, 'sound-description'));
            var controls = make('div', '', 'card-actions');
            var listen = button('Listen', 'Preview ' + (sound.text || sound.name), function () { preview(sound); }); listen.setAttribute('data-preview', sound.id); listen.setAttribute('data-name', sound.text || sound.name); controls.appendChild(listen);
            controls.appendChild(button(embedded ? 'Use sound' : 'Copy URL', (embedded ? 'Use ' : 'Copy URL for ') + (sound.text || sound.name), function () { use(sound); }, 'use-sound'));
            if (multiple) {
                var add = button(choices.indexOf(sound.id) === -1 ? '+' : '✓', 'Include in random set: ' + (sound.text || sound.name), function () {
                    var at = choices.indexOf(sound.id);
                    if (at === -1) { if (choices.length >= 20) { status('Choose up to 20 sounds for a random set.'); return; } choices.push(sound.id); } else choices.splice(at, 1);
                    add.textContent = at === -1 ? '✓' : '+'; add.setAttribute('aria-pressed', String(at === -1)); paintChoices();
                });
                add.setAttribute('aria-pressed', String(choices.indexOf(sound.id) !== -1)); controls.appendChild(add);
            }
            var fav = button(favorites.indexOf(sound.id) !== -1 ? '★' : '☆', 'Favorite ' + (sound.text || sound.name), function () {
                var at = favorites.indexOf(sound.id); if (at === -1) favorites.push(sound.id); else favorites.splice(at, 1);
                save('ssn-audio-favorites', favorites); fav.textContent = at === -1 ? '★' : '☆'; fav.setAttribute('aria-pressed', String(at === -1));
                if (collection === 'favorites') { render(); document.getElementById('collection').focus(); }
            }, 'favorite'); fav.setAttribute('aria-pressed', String(favorites.indexOf(sound.id) !== -1)); controls.appendChild(fav);
            card.appendChild(controls); grid.appendChild(card);
        });
        document.getElementById('count').textContent = filtered.length + ' sounds' + (filtered.length > limit ? ' · showing ' + limit : '');
        document.getElementById('empty').hidden = !!filtered.length;
        document.getElementById('more').hidden = filtered.length <= limit;
        paintPlayback();
    }
    Array.from(new Set(sounds.map(function (s) { return s.category; }))).sort().forEach(function (category) { var opt = make('option', category); opt.value = category; document.getElementById('category').appendChild(opt); });
    fields.forEach(function (id) { document.getElementById(id).addEventListener(id === 'search' ? 'input' : 'change', function () { if (id !== 'collection' && value('collection') === 'recommended') document.getElementById('collection').value = ''; limit = 36; render(); }); });
    document.getElementById('reset').addEventListener('click', function () { fields.forEach(function (id) { document.getElementById(id).value = ''; }); limit = 36; render(); document.getElementById('search').focus(); });
    document.getElementById('more').addEventListener('click', function () { limit += 36; render(); });
    document.getElementById('stop').addEventListener('click', function () { stop(); status('Preview stopped.'); });
    document.getElementById('use-choices').addEventListener('click', function () { if (choices.length < 2) return; stop(); parent.postMessage({ type: 'ssn-audio-choices', token: token, ids: choices }, location.origin === 'null' ? '*' : location.origin); });
    volume.addEventListener('input', function () { document.getElementById('volume-label').textContent = volume.value + '%'; if (active) active.volume = Number(volume.value) / 100; });
    document.getElementById('close-browser').hidden = !embedded;
    document.getElementById('random-help').hidden = !multiple;
    document.getElementById('close-browser').addEventListener('click', function () { stop(); send('ssn-audio-close'); });
    if (embedded) document.querySelector('.brand').removeAttribute('href');
    document.addEventListener('keydown', function (event) {
        if (!embedded) return;
        if (event.key === 'Escape') { stop(); send('ssn-audio-close'); }
        if (event.key === 'Tab') {
            var controls = Array.from(document.querySelectorAll('button:not([disabled]),input,select,a[href]')).filter(function (el) { return !el.hidden && el.offsetParent !== null; });
            var first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
    render();
    paintChoices();
    if (embedded) { document.getElementById('search').focus(); send('ssn-audio-ready'); }
})();
