(function (root) {
    'use strict';
    var beta = 'https://beta.socialstream.ninja';
    var mirror = 'https://cache.socialstream.ninja/beta';

    root.SSNHostedAssetURL = function (path, base) {
        var url = new URL(path, base || root.location.href);
        return root.location.origin === beta && url.origin === beta
            ? mirror + url.pathname + url.search + url.hash
            : url.href;
    };

    if (root.location.origin !== beta || typeof document === 'undefined') return;
    var script = document.currentScript;
    if (!script) return;
    if (script.hasAttribute('data-asset-stylesheet')) {
        // Relative images in this stylesheet resolve against the stylesheet's URL.
        var sheet = script.previousElementSibling;
        sheet.href = root.SSNHostedAssetURL(sheet.href);
    }
    if (script.hasAttribute('data-doc-media')) {
        function updateMedia() {
            document.querySelectorAll('img[src], a[href], option[data-image]').forEach(function (element) {
                var attr = element.tagName === 'IMG' ? 'src' : element.tagName === 'A' ? 'href' : 'data-image';
                var value = element.getAttribute(attr);
                if (!/\.webp(?:[?#]|$)/i.test(value)) return;
                var url = new URL(value, document.baseURI);
                if (url.origin === beta && /^\/(?:docs\/images|media\/(?:site|stickers))\//.test(url.pathname)) {
                    element.setAttribute(attr, root.SSNHostedAssetURL(url));
                }
            });
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateMedia);
        else updateMedia();
    }
})(self);
