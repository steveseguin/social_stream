(function () {
    'use strict';
    var link = document.getElementById('hosted-help');
    if (!link) return;
    var target = new URL(link.href);
    if (target.origin !== 'https://socialstream.ninja') return;
    // Preserve the requested help section, without forwarding session credentials.
    if (window.location.hash) target.hash = window.location.hash;
    link.href = target.href;
    window.location.replace(target.href);
})();
