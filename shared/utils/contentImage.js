(function (root) {
    'use strict';

    function gifUrl(value) {
        try {
            var url = new URL(value);
            return /^https?:$/.test(url.protocol) && /\.gif$/i.test(url.pathname) ? url.href : '';
        } catch (_) { return ''; }
    }

    function hideGifLink(message, source) {
        var target = gifUrl(source);
        if (!message || !target) return;
        message.querySelectorAll('a[href]').forEach(function (link) {
            if (gifUrl(link.getAttribute('href')) === target) link.remove();
        });
        var walker = document.createTreeWalker(message, NodeFilter.SHOW_TEXT);
        var nodes = [], node;
        while ((node = walker.nextNode())) nodes.push(node);
        nodes.forEach(function (text) {
            text.nodeValue = text.nodeValue.replace(/(^|[\s([{<>"'\u0060\u2018\u201c])(https?:\/\/[^\s<>"'\u0060\u2018\u2019\u201c\u201d]+)/gi, function (match, before, url) {
                if (gifUrl(url) === target) return before;
                var trimmed = url.replace(/[.,!?;:)\]}]+$/, '');
                return gifUrl(trimmed) === target ? before + url.slice(trimmed.length) : match;
            });
        });
    }

    function watch(container, data, message) {
        if (!container) return;
        container.querySelectorAll('.hl-imgContent > img, .hl-imgContent > video, img[data-content-image], video[data-content-image]').forEach(function (media) {
            var wrapper = media.closest('.hl-imgContent') || media;
            var display = wrapper.style.display;
            var source = media.getAttribute('src');
            var eventName = media.tagName === 'VIDEO' ? 'loadeddata' : 'load';
            var settled = false;
            var timer;
            wrapper.style.display = 'none';

            function finish(success) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                media.removeEventListener(eventName, loaded);
                media.removeEventListener('error', failed);
                if (!container.contains(media) || media.getAttribute('src') !== source) return;
                if (success) {
                    wrapper.style.display = display;
                    if (data.meta && data.meta.hideExternalGifUrl === true) hideGifLink(message, data.contentimg);
                } else {
                    // Collapse the whole attachment, retaining the original message/link.
                    wrapper.style.display = 'none';
                    media.removeAttribute('src');
                    if (media.tagName === 'VIDEO') { media.pause(); media.load(); }
                }
            }
            function loaded() { finish(true); }
            function failed() { finish(false); }
            media.addEventListener(eventName, loaded);
            media.addEventListener('error', failed);
            timer = setTimeout(failed, 10000);
            if (media.tagName === 'IMG' && media.complete) finish(media.naturalWidth > 0);
            else if (media.tagName === 'VIDEO' && media.readyState >= 2) loaded();
        });
    }

    root.SSNContentImage = { watch: watch };
})(typeof window !== 'undefined' ? window : this);
