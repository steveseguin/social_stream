(function () {
    'use strict';
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
        document.getElementById('idea-count').textContent = count ? count + (count === 1 ? ' idea' : ' ideas') + ' to make your own.' : 'No matching ideas. Try another word or choose all directions.';
    }
    search.addEventListener('input', filter); category.addEventListener('change', filter);
    document.querySelectorAll('[data-direction]').forEach(function (link) {
        link.addEventListener('click', function () { search.value = ''; category.value = link.dataset.direction; filter(); });
    });
})();
