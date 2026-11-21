(function () {
    'use strict';

    var local = /^(chrome-extension:|moz-extension:|file:)$/.test(window.location.protocol);
    var script = document.currentScript;
    var docsRoot = new URL('../../docs/', script.src).href;

    // ZIP installs omit the guides, but keep the CSS and scripts shared by local pages.
    window.SSNDocumentationURL = function (value) {
        if (!local) return value;
        try {
            var url = new URL(value, document.baseURI);
            if (url.href.indexOf(docsRoot) === 0 && /\.(html|md)$/.test(url.pathname)) {
                return 'https://socialstream.ninja/docs/' + url.href.slice(docsRoot.length);
            }
        } catch (_) {}
        return value;
    };

    var redirect = script.getAttribute('data-documentation-redirect');
    if (redirect) {
        window.location.replace(window.SSNDocumentationURL(redirect));
        return;
    }
    if (!local) return;

    function updateLink(link) {
        var original = link.getAttribute('href');
        var target = window.SSNDocumentationURL(original);
        if (target !== original) link.setAttribute('href', target);
    }

    function updateLinks(root) {
        if (root.nodeType !== 1) return;
        if (root.matches('a[href]')) updateLink(root);
        root.querySelectorAll('a[href]').forEach(updateLink);
    }

    updateLinks(document.documentElement);
    new MutationObserver(function (changes) {
        changes.forEach(function (change) {
            if (change.type === 'attributes') {
                if (change.target.matches('a[href]')) updateLink(change.target);
            } else {
                change.addedNodes.forEach(updateLinks);
            }
        });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
}());
