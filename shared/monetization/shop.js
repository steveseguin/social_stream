(function () {
    'use strict';
    var params = new URLSearchParams(location.search), id = params.get('id'), state = null, rendered = '', busy = false;
    var status = document.getElementById('shop-status'), items = document.getElementById('shop-items');
    document.documentElement.classList.toggle('dark-mode', !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    function tr(key, fallback) { return window.SSNPageI18n ? SSNPageI18n.t(key, fallback) : fallback; }
    function draw() {
        if (!state) return;
        var c = SSNMonetization.commerce(state.commerce); c.live = state.commerce.live;
        var current = SSNMonetization.commerceCurrent(c, Date.now()), key = JSON.stringify([c, current && current.url]);
        if (key === rendered) return;
        rendered = key; items.textContent = '';
        c.items.forEach(function (item) {
            var card = document.createElement('article'), badge = document.createElement('p'), title = document.createElement('h2'), link = document.createElement('a');
            card.className = 'shop-item' + (current && current.url === item.url ? ' featured' : '');
            badge.className = 'shop-badge'; badge.textContent = current && current.url === item.url ? tr('commerce-featured', 'Featured') : tr('commerce-' + (item.purpose === 'membership' ? 'join' : item.purpose), { shop: 'Shop', gift: 'Gift', support: 'Support', membership: 'Join' }[item.purpose]);
            card.appendChild(badge);
            if (item.image) { var image = document.createElement('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.onerror = function () { this.hidden = true; }; card.appendChild(image); }
            title.textContent = item.name; card.appendChild(title);
            if (item.amount != null) { var price = document.createElement('p'); price.textContent = SSNMonetization.money(item.amount, item.currency); card.appendChild(price); }
            link.href = item.url; link.rel = 'noopener noreferrer'; link.textContent = tr('commerce-open-site', 'Open on') + ' ' + new URL(item.url).hostname; link.setAttribute('aria-label', item.name + ': ' + link.textContent); card.appendChild(link);
            items.appendChild(card);
        });
    }
    async function refresh() {
        if (busy || !/^[a-f0-9]{64}$/.test(id || '')) { if (!id || !/^[a-f0-9]{64}$/.test(id)) status.textContent = tr('commerce-page-missing', 'This viewer link is incomplete. Ask the creator for their public shop link.'); return; }
        busy = true;
        var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 12000);
        try {
            var response = await fetch('https://api.socialstream.ninja/v1/shop/' + id, { credentials: 'omit', cache: 'no-store', signal: controller.signal });
            if (response.status === 404) { state = null; rendered = ''; items.textContent = ''; status.textContent = tr('commerce-page-removed', 'This page is not published.'); return; }
            if (!response.ok) throw new Error('unavailable');
            state = await response.json();
            status.textContent = tr('commerce-page-updated', 'Creator links last saved:') + ' ' + new Date(state.updated).toLocaleString();
            draw();
        } catch (_) { status.textContent = tr(state ? 'commerce-page-stale' : 'commerce-page-error', state ? 'Updates unavailable. Showing the last loaded links.' : 'Could not load this page. Retrying shortly.'); }
        finally { clearTimeout(timer); busy = false; }
    }
    window.addEventListener('ssn-page-language-changed', function () { rendered = ''; draw(); refresh(); });
    refresh(); setInterval(refresh, 15000); setInterval(draw, 1000);
})();
