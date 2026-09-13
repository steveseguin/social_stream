(function () {
    'use strict';
    function t(key, fallback, values) { return window.SSNPageI18n ? window.SSNPageI18n.t('commerce-dock-' + key, fallback, values) : fallback; }
    window.SSNCommerceDock = function (request, status) {
        var section = document.getElementById('commerce-controls');
        var select = document.getElementById('commerce-product');
        var stateText = document.getElementById('commerce-state');
        var buttons = section.querySelectorAll('[data-commerce]');
        var state = null, busy = false, flight = null, generation = 0;
        if (new URLSearchParams(location.search).has('commerce')) {
            document.querySelectorAll('body > details').forEach(function (el) { el.hidden = el !== section; });
            document.querySelector('h1').setAttribute('data-page-translate', 'commerce-dock-title');
            document.querySelector('h1').textContent = t('title', 'Product Controls');
        }
        function controls() {
            select.disabled = !state || busy;
            buttons.forEach(function (button) {
                var needsProduct = /^(show|next)$/.test(button.dataset.commerce);
                button.disabled = busy || !state || !state.hostOn || (needsProduct && (!state.enabled || !state.items.length || (button.dataset.commerce === 'show' && !state.items.some(function (item) { return item.url === select.value; }))));
            });
        }
        function unavailable(message) { state = null; stateText.textContent = message; controls(); }
        function render(next) {
            if (!next || !Array.isArray(next.items)) throw new Error(t('unknown', 'Product state unavailable. Update Social Stream.'));
            var selected = select.value || (next.selected && next.selected.url) || (next.items[0] && next.items[0].url) || '';
            select.textContent = '';
            next.items.forEach(function (item) { var option = document.createElement('option'); option.value = item.url; option.textContent = item.name || item.url; select.appendChild(option); });
            if (!next.items.some(function (item) { return item.url === selected; })) {
                var missing = document.createElement('option'); missing.value = selected; missing.textContent = selected ? t('removed', 'Previously selected product is unavailable') : t('empty', 'No saved products'); select.appendChild(missing);
            }
            select.value = selected;
            state = next;
            var labels = {offline:'Social Stream is off', disabled:'Products are disabled', hidden:'Products hidden', pinned:'Selected product', scheduled:'Scheduled product'};
            stateText.textContent = t(next.mode, labels[next.mode] || 'Product state unavailable') + ((next.mode === 'pinned' || next.mode === 'scheduled') && next.selected ? ': ' + next.selected.name : '') + (next.remainingSeconds > 0 ? t('remaining', ' ({seconds}s remaining)', {seconds:next.remainingSeconds}) : '');
            controls();
        }
        function result(reply) { if (!reply || reply.ok === false) throw new Error(reply && reply.error && reply.error.message || 'Product command failed'); return reply.payload || reply; }
        function refresh() {
            if (flight || busy || !section.open) return flight;
            var epoch = generation;
            flight = request('getCommerceState').then(function (reply) { if (epoch === generation) render(result(reply).commerce); }).catch(function (error) { if (epoch === generation) unavailable(error.message); }).then(function () { flight = null; });
            return flight;
        }
        buttons.forEach(function (button) { button.addEventListener('click', function () {
            var seconds = Number(document.getElementById('commerce-duration').value);
            if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) { status(t('invalid-duration', 'Use a duration from 0 to 3600 seconds.'), 'error'); return; }
            var command = button.dataset.commerce;
            busy = true; generation++; controls();
            request('commerceControl', {command:command, url:command === 'show' ? select.value : undefined, seconds:seconds}).then(function (reply) {
                result(reply); status(t('completed', 'Product command completed: {command}', {command:t(command, command)}), 'success');
            }).catch(function (error) { status(error.message, 'error'); }).then(function () { busy = false; controls(); if (flight) flight.then(refresh); else refresh(); });
        }); });
        window.addEventListener('ssn-page-language-changed', function () { if (state) render(state); });
        select.addEventListener('change', controls);
        document.getElementById('commerce-refresh').addEventListener('click', refresh);
        section.addEventListener('toggle', refresh);
        var timer = setInterval(refresh, 5000);
        window.addEventListener('beforeunload', function () { clearInterval(timer); });
        return {refresh:refresh, disconnected:function () { generation++; unavailable(t('disconnected', 'Disconnected; product state is unknown.')); }};
    };
})();
