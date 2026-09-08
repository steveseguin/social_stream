(function () {
    'use strict';
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    function preference() { try { return localStorage.getItem('darkMode'); } catch (_) { return null; } }
    function apply(dark, save) {
        document.documentElement.classList.toggle('dark-mode', dark);
        document.documentElement.classList.toggle('light-mode', !dark);
        if (document.body) document.body.classList.toggle('dark-mode', dark);
        if (save) { try { localStorage.setItem('darkMode', String(dark)); } catch (_) {} }
        document.querySelectorAll('.site-theme').forEach(function (button) {
            button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>' : '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>') + '</svg>';
            button.setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' theme');
        });
        var readerTheme = document.getElementById('themeToggle');
        if (readerTheme) { readerTheme.textContent = dark ? 'Light mode' : 'Dark mode'; readerTheme.setAttribute('aria-pressed', String(dark)); }
    }
    var saved = preference(); apply(saved === null ? media.matches : saved === 'true', false);
    window.SSNSiteTheme = { apply: apply };
    document.addEventListener('DOMContentLoaded', function () {
        apply(document.documentElement.classList.contains('dark-mode'), false);
        var toggle = document.querySelector('.site-menu'), nav = document.getElementById('ssn-site-nav');
        function open(value) {
            nav.classList.toggle('is-open', value); toggle.setAttribute('aria-expanded', String(value));
            toggle.textContent = value ? 'Close' : 'Menu';
        }
        if (toggle && nav) {
            toggle.addEventListener('click', function () { open(toggle.getAttribute('aria-expanded') !== 'true'); });
            nav.addEventListener('click', function (event) { if (event.target.closest('a')) open(false); });
            document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && nav.classList.contains('is-open')) { open(false); toggle.focus(); } });
            document.addEventListener('click', function (event) { if (!event.target.closest('.site-header')) open(false); });
            window.addEventListener('resize', function () { if (window.innerWidth > 1280) open(false); });
        }
        document.querySelectorAll('.site-theme').forEach(function (button) { button.onclick = function () { apply(!document.documentElement.classList.contains('dark-mode'), true); }; });
        var year = document.getElementById('current-year'); if (year) year.textContent = new Date().getFullYear();
    });
    function changed(event) { if (preference() === null) apply(event.matches, false); }
    if (media.addEventListener) media.addEventListener('change', changed); else if (media.addListener) media.addListener(changed);
    window.addEventListener('storage', function (event) { if (event.key === 'darkMode') apply(event.newValue === null ? media.matches : event.newValue === 'true', false); });
})();
