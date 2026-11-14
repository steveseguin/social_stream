(function () {
    'use strict';
    function start() {
        document.querySelectorAll('[data-site-language-picker] a').forEach(function (link) {
            var url = new URL(link.href, location.href);
            function update() { url.search = location.search; url.hash = location.hash; link.href = url.href; }
            update();
            link.addEventListener('click', update);
        });
        document.querySelectorAll('[data-site-language-picker]').forEach(function (picker) {
            document.addEventListener('click', function (event) { if (!picker.contains(event.target)) picker.open = false; });
            picker.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') { picker.open = false; picker.querySelector('summary').focus(); }
            });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
