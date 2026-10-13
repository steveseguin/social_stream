(function () {
    'use strict';
    // Display state only. Restored/replayed rows never go back through chat or automation.
    function create(options) {
        var params = options.params, container = options.container;
        var rows = [], pending = [], paused = false, restoring = null, rotation = 0;
        var limit = options.limit, layout = params.get('layout') || 'list';
        var board = params.get('board') || 'default';
        var history = params.has('remember') && !params.has('preview') && !params.has('demo');
        var storageKey = 'ssn-event-board:' + options.kind + ':' + (params.get('session') || '') + ':' + board;
        var hours = number('historyhours', 24, 1, 168);
        var timer, toolbar, status, clearing = false;
        function number(key, fallback, min, max) {
            var raw = params.get(key), value = Number(raw);
            return raw !== null && raw !== '' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
        }
        function save() {
            if (!history || restoring) return;
            try {
                localStorage.setItem(storageKey, JSON.stringify(rows.filter(function (r) { return r.node.isConnected; }).map(function (r) {
                    return { payload: r.payload, at: r.at, pinned: r.pinned };
                })));
            } catch (error) { report('History could not be saved in this browser.'); }
        }
        function report(text) { if (status) status.textContent = text; }
        function remove(row) {
            if (!row) return;
            clearTimeout(row.timer);
            var exit = params.get('exitmotion');
            if (!clearing && !restoring && row.node.isConnected && ['fade', 'slide'].indexOf(exit) !== -1 &&
                !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
                var rect = row.node.getBoundingClientRect(), ghost = row.node.cloneNode(true);
                ghost.classList.remove('board-row'); ghost.classList.add('board-exit-ghost');
                ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
                ghost.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
                ghost.querySelectorAll('video, .board-row-actions').forEach(function (el) { el.remove(); });
                ghost.style.cssText += ';position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;margin:0;pointer-events:none;z-index:2;';
                ghost.style.setProperty('--board-speed', number('animationspeed', 350, 0, 3000) + 'ms');
                ghost.dataset.exit = exit; document.body.appendChild(ghost);
                setTimeout(function () { ghost.remove(); }, number('animationspeed', 350, 0, 3000));
            }
            row.node.querySelectorAll('video').forEach(function (video) { video.pause(); });
            row.node.remove();
            rows = rows.filter(function (r) { return r !== row; });
            if (options.removed) options.removed(row.node);
            refresh(); save();
        }
        function refresh() {
            rows = rows.filter(function (r) { return r.node.isConnected; });
            if (layout === 'marquee') {
                container.style.setProperty('--board-start', container.clientWidth + 'px');
                container.style.setProperty('--board-travel', rows.reduce(function (width, row) { return width + row.node.offsetWidth + 12; }, 0) + 'px');
            }
            rows.forEach(function (r, i) {
                r.node.classList.toggle('board-pinned', r.pinned);
                r.node.classList.toggle('board-rotation-hidden', layout === 'rotate' && i !== rotation % rows.length);
            });
            if (options.changed) options.changed(rows);
        }
        function trim() {
            while (rows.length > limit) {
                // A pin occupies a visible slot. The newest row is discarded if all slots are pinned.
                var removable = rows.find(function (r) { return !r.pinned; });
                if (!removable) break;
                remove(removable);
            }
        }
        function category(payload) {
            return options.category ? options.category(payload) : String(payload.event || 'donation');
        }
        function identity(payload) {
            if (payload.id === undefined || payload.id === null) return '';
            return [payload.platform, payload.type, payload.sourceid, payload.channel, payload.id].join('|');
        }
        function signature(payload) {
            return JSON.stringify([payload.event, payload.chatname, payload.chatmessage, payload.hasDonation, payload.membership, payload.meta]);
        }
        function duplicate(payload) {
            var key = identity(payload);
            return !!key && rows.some(function (row) { return row.node.isConnected && identity(row.payload) === key && signature(row.payload) === signature(payload); });
        }
        function register(node, payload, duration) {
            var at = restoring ? restoring.at : Date.now();
            var key = identity(payload), pinned = false;
            rows.slice().forEach(function (r) {
                if (r.node === node || (key && identity(r.payload) === key)) {
                    pinned = r.pinned; clearTimeout(r.timer);
                    if (r.node !== node) remove(r);
                    else rows = rows.filter(function (item) { return item !== r; });
                }
            });
            if (layout === 'latest') {
                rows.slice().forEach(function (r) { if (category(r.payload) === category(payload)) remove(r); });
            }
            var row = { node: node, payload: payload, at: at, pinned: pinned || !!(restoring && restoring.pinned) };
            rows.push(row);
            node.classList.add('board-row');
            node.dataset.eventId = String(payload.id == null ? '' : payload.id);
            var accentMode = params.get('accentby'), accent;
            if (accentMode === 'platform') {
                accent = { twitch: '#a970ff', youtube: '#ff5262', facebook: '#549bff', kick: '#53d56a', tiktok: '#32cbd4', streamlabs: '#47cfb5', streamelements: '#8fa4ff' }[payload.type] || '#a7b6ce';
            } else if (accentMode === 'category') {
                var key = category(payload);
                accent = /follow/.test(key) ? '#67c9ac' : /sub|member/.test(key) ? '#bc9aff' : /raid/.test(key) ? '#ffac69' : '#f2c66b';
            }
            if (accent) {
                node.style.setProperty('--feed-accent', accent);
                node.style.setProperty('--alert-accent', accent);
                node.style.setProperty('--collection-accent', accent);
                node.style.borderLeftColor = accent;
            }
            if (params.has('cardopacity')) {
                var background = node.querySelector('.alert-shell') || node;
                var rgb = getComputedStyle(background).backgroundColor.match(/[\d.]+/g);
                if (!rgb || (rgb.length > 3 && Number(rgb[3]) === 0)) rgb = [24, 28, 36];
                background.style.background = 'rgba(' + rgb.slice(0, 3).join(',') + ',' + number('cardopacity', 100, 0, 100) / 100 + ')';
            }
            if (params.get('order') === 'oldest') container.appendChild(node);
            else container.insertBefore(node, container.firstChild);
            if (params.has('operator')) {
                var actions = document.createElement('div'); actions.className = 'board-row-actions';
                button(actions, 'Pin', function () { row.pinned = !row.pinned; refresh(); save(); }, 'Pin or unpin this event');
                button(actions, 'Remove', function () { remove(row); }, 'Remove this event');
                node.appendChild(actions);
            }
            if (duration > 0) {
                var remaining = Math.max(0, duration - (Date.now() - at));
                row.timer = setTimeout(function expire() {
                    if (row.pinned || paused) { row.timer = setTimeout(expire, 500); return; }
                    remove(row);
                }, remaining);
            }
            trim(); refresh(); save();
            return row;
        }
        function button(parent, text, fn, label) {
            var el = document.createElement('button'); el.type = 'button'; el.textContent = text;
            el.setAttribute('aria-label', label || text);
            el.addEventListener('click', function (event) { event.stopPropagation(); fn(); }); parent.appendChild(el);
        }
        function command(data) {
            if (!data || data.action !== 'eventOverlayControl') return false;
            if (data.surface !== options.kind || (data.board || 'default') !== board) return true;
            var latest = rows[rows.length - 1];
            switch (data.command) {
                case 'pause': paused = true; report('Display paused'); break;
                case 'resume':
                    paused = false;
                    var waiting = pending.splice(0);
                    waiting.forEach(function (payload) { options.receive(payload); });
                    report('Display resumed'); break;
                case 'clear':
                    pending = []; clearing = true; rows.slice().forEach(remove); clearing = false;
                    document.querySelectorAll('.board-exit-ghost').forEach(function (el) { el.remove(); });
                    if (options.cleared) options.cleared();
                    save(); report('Events cleared'); break;
                case 'remove': remove(latest); break;
                case 'pin': if (latest) { latest.pinned = !latest.pinned; refresh(); save(); } break;
                case 'unpin': rows.forEach(function (r) { r.pinned = false; }); refresh(); save(); break;
                case 'replay': if (!paused && latest && options.replay) options.replay(latest.payload); break;
                default: if (options.command) options.command(data.command);
            }
            return true;
        }
        function defer(payload) {
            if (!paused || restoring) return false;
            pending.push(payload);
            if (pending.length > 500) { pending.shift(); report('Pause buffer full: oldest waiting event removed.'); }
            return true;
        }
        function restore() {
            if (!history) return;
            try {
                var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
                if (!Array.isArray(saved)) return;
                saved.slice(-limit).forEach(function (entry) {
                    if (!entry || !entry.payload || !Number.isFinite(entry.at) || Date.now() - entry.at > hours * 3600000) return;
                    restoring = entry; options.receive(entry.payload);
                });
            } catch (error) { report('Saved history could not be loaded.'); }
            finally { restoring = null; save(); }
        }
        container.classList.add('event-board');
        if (['rotate', 'latest', 'horizontal', 'marquee'].indexOf(layout) !== -1) container.classList.add('board-' + layout);
        if (params.get('order') === 'oldest') container.classList.add('board-oldest');
        if (params.get('textalign') === 'right') container.classList.add('board-text-right');
        if (params.has('nowrap')) container.classList.add('board-nowrap');
        var motion = params.has('noanimation') ? 'none' : params.get('motion');
        if (['slide', 'fade', 'none'].indexOf(motion) !== -1) container.dataset.motion = motion;
        container.style.setProperty('--board-speed', number('animationspeed', 350, 0, 3000) + 'ms');
        container.style.setProperty('--board-scroll', number('scrollspeed', 30, 5, 180) + 's');
        if (params.has('rowwidth')) container.style.setProperty('--board-width', number('rowwidth', 600, 200, 1920) + 'px');
        if (params.has('operator')) {
            toolbar = document.createElement('div'); toolbar.className = 'board-toolbar';
            ['pause', 'resume', 'pin', 'unpin', 'remove', 'clear'].forEach(function (cmd) {
                button(toolbar, cmd.charAt(0).toUpperCase() + cmd.slice(1), function () { command({ action: 'eventOverlayControl', surface: options.kind, board: board, command: cmd }); });
            });
            status = document.createElement('span'); status.setAttribute('role', 'status'); toolbar.appendChild(status);
            document.body.insertBefore(toolbar, document.body.firstChild);
        }
        if (layout === 'rotate') timer = setInterval(function () { if (!paused) { rotation++; refresh(); } }, number('rotatetime', 5, 1, 120) * 1000);
        window.addEventListener('beforeunload', function () { save(); clearInterval(timer); });
        if (layout === 'marquee') window.addEventListener('resize', refresh);
        return { register: register, remove: remove, command: command, defer: defer, restore: restore, duplicate: duplicate,
            isRestoring: function () { return !!restoring; }, rows: function () { return rows.filter(function (row) { return row.node.isConnected; }); },
            clear: function () { command({ action: 'eventOverlayControl', surface: options.kind, board: board, command: 'clear' }); } };
    }
    function samples() {
        return [
            { id: 'demo-follow', platform: 'twitch', type: 'twitch', event: 'new_follower', chatname: 'Maple', chatmessage: 'Maple followed', textonly: true },
            { id: 'demo-sub', platform: 'youtube', type: 'youtube', event: 'sponsorship', chatname: 'River', chatmessage: 'Happy to be here!', membership: 'New member', textonly: true },
            { id: 'demo-stars', platform: 'facebook', type: 'facebook', chatname: 'Juniper', chatmessage: 'Thanks for the wonderful stream!', hasDonation: '500 Stars', donoValue: 5, textonly: true }
        ];
    }
    window.SSNEventBoard = { create: create, samples: samples };
})();
