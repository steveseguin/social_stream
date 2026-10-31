(function () {
    'use strict';
    function siteText(label, values) {
        if (window.SSNSiteTranslate) return window.SSNSiteTranslate(label, values);
        return label.replace(/\{(\d+)\}/g, function (match, index) { return values && index < values.length ? values[index] : match; });
    }
    function sourceURL(value) { return window.SSNSiteSourceURL ? window.SSNSiteSourceURL(value) : new URL(value, location.href).href; }

    var search = document.getElementById('idea-search');
    var category = document.getElementById('idea-category');
    function filter() {
        var query = search.value.trim().toLowerCase(), count = 0;
        document.querySelectorAll('.idea-section').forEach(function (section) {
            var visible = 0;
            section.querySelectorAll('.idea').forEach(function (idea) {
                idea.hidden = (category.value !== 'all' && category.value !== section.dataset.category) || idea.textContent.toLowerCase().indexOf(query) < 0;
                if (!idea.hidden) visible++;
            });
            section.hidden = visible === 0; count += visible;
        });
        document.getElementById('idea-count').textContent = count ? siteText(count === 1 ? '{0} idea to make your own.' : '{0} ideas to make your own.', [count]) : 'No matching ideas. Try another word or choose all directions.';
    }
    search.addEventListener('input', filter); category.addEventListener('change', filter);
    document.querySelectorAll('[data-direction]').forEach(function (link) {
        link.addEventListener('click', function () { search.value = ''; category.value = link.dataset.direction; filter(); });
    });
})();
