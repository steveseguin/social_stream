(function () {
    'use strict';
    var search = document.getElementById('template-search-input');
    var filters = document.querySelectorAll('.filter-tag');
    var cards = document.querySelectorAll('.template-card');
    var activeFilter = 'all';
    function filterTemplates() {
        var query = search.value.trim().toLowerCase();
        var count = 0;
        cards.forEach(function (card) {
            var tags = card.getAttribute('data-tags') || '';
            var matches = (activeFilter === 'all' || tags.split(' ').indexOf(activeFilter) !== -1) &&
                (card.textContent + ' ' + tags).toLowerCase().indexOf(query) !== -1;
            card.style.display = matches ? 'flex' : 'none';
            if (matches) count++;
        });
        document.querySelectorAll('.template-category').forEach(function (category) {
            var visible = Array.prototype.some.call(category.querySelectorAll('.template-card'), function (card) {
                return card.style.display !== 'none';
            });
            category.hidden = !visible;
        });
        document.getElementById('template-results').textContent = count ? count + ' templates shown' : 'No matches. Try another search or choose All Templates.';
    }
    filters.forEach(function (button) {
        button.addEventListener('click', function () {
            activeFilter = button.getAttribute('data-filter');
            filters.forEach(function (other) {
                other.classList.toggle('active', other === button);
                other.setAttribute('aria-pressed', String(other === button));
            });
            filterTemplates();
        });
    });
    search.addEventListener('input', filterTemplates);
    filterTemplates();
    document.querySelectorAll('[data-copy-prompt]').forEach(function (button) {
        button.addEventListener('click', function () {
            var input = document.getElementById(button.getAttribute('data-copy-prompt'));
            var status = document.getElementById('prompt-copy-status');
            function fallback() {
                input.focus();
                input.select();
                var copied = false;
                try { copied = document.execCommand('copy'); } catch (error) {}
                status.textContent = copied ? 'Prompt copied.' : 'Prompt selected. Press Ctrl+C (Command+C on Mac) to copy.';
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(input.value).then(function () {
                    status.textContent = 'Prompt copied.';
                }, fallback);
            } else fallback();
        });
    });
}());
