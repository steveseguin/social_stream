(function () {
    'use strict';
    var styles = [
        ['card', 'Goal Card', 'A large total and a slim progress bar.', '460 × 300'],
        ['ring', 'Progress Ring', 'A circular percentage above the total.', '340 × 420'],
        ['lowerthird', 'Lower Third', 'A low, wide panel for the bottom of your scene.', '880 × 180'],
        ['segmented', 'Segmented Bar', 'Twenty segments for easy-to-read progress.', '600 × 300'],
        ['jar', 'Classic Jar', 'The original cup with falling donation items.', '400 × 600'],
        ['meter', 'Goal Meter', 'A progress meter with recent supporters.', '800 × 400'],
        ['bar', 'Fluid Goal Bar', 'A wide animated bar with the total inside.', '900 × 200'],
        ['compact', 'Compact Bar', 'A small bar suited to a corner.', '460 × 120'],
        ['vertical', 'Vertical Bar', 'A thermometer for a side column.', '300 × 500'],
        ['minimal', 'Minimal', 'Large totals and a percentage without a panel.', '400 × 300'],
        ['text', 'Text Only', 'A simple one-line goal readout.', '900 × 100']
    ];
    var frames = [];
    function el(id) { return document.getElementById(id); }
    function fitPreviews() {
        frames.forEach(function (entry) {
            var scale = Math.min(1, entry.frame.parentNode.clientWidth / entry.width, 420 / entry.height);
            entry.frame.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
        });
    }
    function styleParams(style) {
        var params = new URLSearchParams();
        params.set('style', style);
        params.set('theme', el('theme').value);
        if (el('refresh').checked) params.set('refresh', '');
        if (['card', 'ring', 'lowerthird', 'segmented'].indexOf(style) !== -1) {
            if (el('panelopacity').value !== '') params.set('panelopacity', String(Math.max(0, Math.min(1, Number(el('panelopacity').value)))));
            if (el('amountsize').value !== '') params.set('amountsize', String(Math.max(12, Math.min(96, Number(el('amountsize').value)))));
            if (el('customaccent').checked) params.set('accent', el('accent').value);
            if (el('hidepercent').checked) params.set('hidepercent', '');
        }
        return params;
    }
    function render() {
        document.body.classList.toggle('light', el('light').checked);
        frames.forEach(function (entry) {
            var params = styleParams(entry.style);
            params.set('preview', '');
            params.set('goal', '1000');
            params.set('startamount', String(Number(el('progress').value) * 10));
            params.set('title', 'Community studio fund');
            params.set('celebration', 'none');
            entry.frame.src = './tipjar.html?' + params.toString();
        });
    }
    function copyStyle(style) {
        var url;
        try {
            url = new URL(el('overlay-link').value);
            if (!/^(https?:|file:|chrome-extension:)$/.test(url.protocol) || !/\/tipjar\.html$/.test(url.pathname)) throw new Error('Invalid link');
        } catch (_) {
            el('status').textContent = 'Paste your existing tip jar link above, then choose Copy styled link.';
            el('overlay-link').focus();
            return;
        }
        // Preserve session, scoring, filters, and saved-total settings. Change appearance only.
        ['style', 'theme', 'refresh', 'panelopacity', 'accent', 'amountsize', 'hidepercent', 'preview'].forEach(function (key) { url.searchParams.delete(key); });
        styleParams(style).forEach(function (value, key) { url.searchParams.set(key, value); });
        var value = url.href;
        function fallback() {
            el('overlay-link').value = value;
            el('overlay-link').select();
            el('status').textContent = 'Your styled link is selected above. Copy it and use it in OBS.';
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(function () {
                el('status').textContent = 'Styled link copied. Your current overlay stays unchanged until you replace its link.';
            }).catch(fallback);
        } else fallback();
    }
    styles.forEach(function (style) {
        var card = document.createElement('article');
        var caption = document.createElement('div');
        caption.className = 'caption';
        var title = document.createElement('h2');
        title.textContent = style[1];
        var text = document.createElement('p');
        text.textContent = style[2] + ' Suggested OBS size: ' + style[3] + '.';
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Copy styled link';
        button.setAttribute('aria-label', 'Copy ' + style[1] + ' link');
        button.addEventListener('click', function () { copyStyle(style[0]); });
        caption.appendChild(title);
        caption.appendChild(text);
        caption.appendChild(button);
        var sample = document.createElement('div');
        sample.className = 'sample';
        var frame = document.createElement('iframe');
        frame.title = style[1] + ' sample';
        frame.tabIndex = -1;
        var size = style[3].split(' × ').map(Number);
        frame.style.width = size[0] + 'px';
        frame.style.height = size[1] + 'px';
        sample.appendChild(frame);
        card.appendChild(caption);
        card.appendChild(sample);
        el('gallery').appendChild(card);
        frames.push({ style: style[0], frame: frame, width: size[0], height: size[1] });
    });
    document.querySelectorAll('.controls input, .controls select').forEach(function (input) { input.addEventListener('change', render); });
    render();
    fitPreviews();
    window.addEventListener('resize', fitPreviews);
})();
