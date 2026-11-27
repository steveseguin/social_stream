(function() {
    function getPreferredDarkMode() {
        var savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'true') return true;
        if (savedDarkMode === 'false') return false;

        var savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;

        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function updateToggleText(isDark) {
        var themeText = document.querySelector('.theme-text');
        if (themeText) {
            themeText.textContent = isDark ? 'Toggle Light Mode' : 'Toggle Dark Mode';
        }
    }

    function applyTheme(isDark, savePreference) {
        var root = document.documentElement;
        var body = document.body;

        if (isDark) {
            root.setAttribute('data-theme', 'dark');
            root.classList.add('dark-mode');
            if (body) {
                body.setAttribute('data-theme', 'dark');
                body.classList.add('dark-mode');
            }
        } else {
            root.removeAttribute('data-theme');
            root.classList.remove('dark-mode');
            if (body) {
                body.removeAttribute('data-theme');
                body.classList.remove('dark-mode');
            }
        }

        if (savePreference) {
            localStorage.setItem('darkMode', isDark ? 'true' : 'false');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }

        updateToggleText(isDark);
    }

    applyTheme(getPreferredDarkMode(), false);

    document.addEventListener('DOMContentLoaded', function() {
        applyTheme(getPreferredDarkMode(), false);

        var themeToggle = document.querySelector('[data-theme-toggle]');
        if (themeToggle) {
            themeToggle.addEventListener('click', function(event) {
                event.preventDefault();
                applyTheme(!document.documentElement.hasAttribute('data-theme'), true);
            });
        }
    });
})();
