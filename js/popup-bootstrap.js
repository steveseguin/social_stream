// Chrome measures toolbar popups while parsing. Wait for the complete menu before
// laying it out, rather than repeatedly sizing a partially constructed document.
(function () {
    if (location.protocol !== 'chrome-extension:') return;
    var root = document.documentElement;
    root.classList.add('popup-initializing');
    function reveal() {
        root.classList.remove('popup-initializing');
        clearTimeout(fallback);
    }
    // Independent of popup.js: a failed script must not leave the menu hidden.
    var fallback = setTimeout(reveal, 1500);
    document.addEventListener('DOMContentLoaded', function () {
        // Let the synchronous setup handlers finish before the first layout.
        setTimeout(reveal, 0);
    }, { once: true });
}());
