(function () {
    'use strict';
    // One navigation definition for the homepage, documentation, and galleries.
    var siteRoot = new URL('../../', document.currentScript.src);
    var translated = document.documentElement.hasAttribute('data-site-language');
    var translations;
    function t(label) {
        if (!translations) {
            var config = document.getElementById('ssn-site-language');
            if (config) {
                try { translations = JSON.parse(config.textContent); } catch (_) { translations = {}; }
            }
        }
        return translations && Object.prototype.hasOwnProperty.call(translations, label) ? translations[label] : label;
    }
    window.SSNSiteTranslate = t;
    var navigation = [
        ['Home', 'index.html'], ['Features', 'docs/features.html'],
        ['Inspiration', 'docs/inspiration.html', 'inspiration'],
        ['Download', 'docs/download.html'], ['Guides', 'docs/guides.html'],
        ['Commands & API', 'docs/commands.html'], ['Supported Sites', 'docs/supported-sites.html'],
        ['Overlay Gallery', 'docs/overlay-gallery.html', 'gallery'],
        ['Hire', 'docs/services.html', 'hire'], ['Support', 'docs/support.html']
    ];
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    function preference() { try { return localStorage.getItem('darkMode'); } catch (_) { return null; } }
    function apply(dark, save) {
        document.documentElement.classList.toggle('dark-mode', dark);
        document.documentElement.classList.toggle('light-mode', !dark);
        if (document.body) document.body.classList.toggle('dark-mode', dark);
        if (save) { try { localStorage.setItem('darkMode', String(dark)); } catch (_) {} }
        document.querySelectorAll('.site-theme').forEach(function (button) {
            button.setAttribute('aria-label', t(dark ? 'Switch to light theme' : 'Switch to dark theme'));
        });
        var readerTheme = document.getElementById('themeToggle');
        if (readerTheme) { readerTheme.textContent = t(dark ? 'Light mode' : 'Dark mode'); readerTheme.setAttribute('aria-pressed', String(dark)); }
    }
    var saved = preference(); apply(saved === null ? media.matches : saved === 'true', false);
    window.SSNSiteTheme = { apply: apply };
    document.addEventListener('DOMContentLoaded', function () {
        var navigationElement = document.getElementById('ssn-site-nav');
        // Generated translations already contain localized navigation and URLs.
        if (navigationElement && !translated) {
            navigationElement.textContent = '';
            navigation.forEach(function (item) {
                var link = document.createElement('a');
                link.href = new URL(item[1], siteRoot).href;
                link.textContent = item[0];
                if (item[2]) link.className = 'site-priority-' + item[2];
                if (location.pathname === new URL(link.href).pathname ||
                    (item[1] === 'index.html' && location.pathname === siteRoot.pathname)) link.setAttribute('aria-current', 'page');
                navigationElement.appendChild(link);
            });
        }
        var alternate = document.querySelector('meta[name="ssn-language-alternate"]');
        if (navigationElement && alternate) {
            var languageLink = document.createElement('a');
            languageLink.href = new URL(alternate.content, location.href).href;
            languageLink.className = 'site-language-link';
            languageLink.lang = alternate.getAttribute('data-lang');
            languageLink.hreflang = languageLink.lang;
            languageLink.textContent = alternate.getAttribute('data-label');
            navigationElement.appendChild(languageLink);
        }
        document.querySelectorAll('.site-language-link').forEach(function (languageLink) {
            var languageUrl = new URL(languageLink.href, location.href);
            function updateLanguageUrl() {
                languageUrl.search = location.search;
                languageUrl.hash = location.hash;
                languageLink.href = languageUrl.href;
            }
            updateLanguageUrl();
            // Download tabs change the hash without firing hashchange.
            languageLink.addEventListener('click', updateLanguageUrl);
        });
        apply(document.documentElement.classList.contains('dark-mode'), false);
        var toggle = document.querySelector('.site-menu'), nav = document.getElementById('ssn-site-nav');
        function open(value) {
            nav.classList.toggle('is-open', value); toggle.setAttribute('aria-expanded', String(value));
            toggle.setAttribute('aria-label', t(value ? 'Close navigation menu' : 'Open navigation menu'));
            toggle.querySelector('span').textContent = value ? '\u2715' : '\u2630';
        }
        if (toggle && nav) {
            toggle.addEventListener('click', function () { open(toggle.getAttribute('aria-expanded') !== 'true'); });
            nav.addEventListener('click', function (event) { if (event.target.closest('a')) open(false); });
            document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && nav.classList.contains('is-open')) { open(false); toggle.focus(); } });
            document.addEventListener('click', function (event) { if (!event.target.closest('.site-header')) open(false); });
            window.addEventListener('resize', function () { if (window.innerWidth > 1050) open(false); });
        }
        document.querySelectorAll('.site-theme').forEach(function (button) { button.onclick = function () { apply(!document.documentElement.classList.contains('dark-mode'), true); }; });
        var year = document.getElementById('current-year'); if (year) year.textContent = new Date().getFullYear();
    });
    function changed(event) { if (preference() === null) apply(event.matches, false); }
    if (media.addEventListener) media.addEventListener('change', changed); else if (media.addListener) media.addListener(changed);
    window.addEventListener('storage', function (event) { if (event.key === 'darkMode') apply(event.newValue === null ? media.matches : event.newValue === 'true', false); });
})();
