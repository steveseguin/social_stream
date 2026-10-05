(function () {
    "use strict";

    var main = document.getElementById("event-reference");
    var index = document.getElementById("reference-index");
    var search = document.getElementById("reference-search");
    var status = document.getElementById("reference-search-status");
    var groups = index.querySelectorAll(".reference-index-group");
    var entries = [];

    index.querySelectorAll('a[href^="#"]').forEach(function (link) {
        var target = document.getElementById(link.hash.slice(1));
        if (!target) return;
        // The coverage heading groups all platforms; do not match every child's text.
        var content = target.id === "platform-coverage" ? "" : target.textContent;
        entries.push({
            link: link,
            text: (link.textContent + " " + content).toLowerCase().replace(/\s+/g, " ")
        });
    });

    function filterIndex() {
        var query = search.value.trim().toLowerCase();
        var words = query.split(/\s+/);
        var count = 0;
        entries.forEach(function (entry) {
            var match = !query || words.every(function (word) {
                return entry.text.indexOf(word) !== -1;
            });
            entry.link.parentNode.hidden = !match;
            if (match) count++;
        });
        groups.forEach(function (group) {
            group.hidden = !group.querySelector("li:not([hidden])");
        });
        status.textContent = query
            ? (count ? count + " matching " + (count === 1 ? "section" : "sections") : "No matching sections. Try another term or clear the search.")
            : "Browse all " + entries.length + " sections, or search their contents.";
    }

    search.parentNode.parentNode.hidden = false;
    search.addEventListener("input", filterIndex);
    document.getElementById("reference-search-clear").addEventListener("click", function () {
        search.value = "";
        filterIndex();
        search.focus();
    });
    filterIndex();

    index.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            index.open = false;
            index.querySelector("summary").focus();
        }
    });
    document.addEventListener("click", function (event) {
        if (!index.contains(event.target)) index.open = false;
    });

    // Keep native hash/history navigation and account for this page's sticky tools.
    // The shared docs click handler otherwise scrolls without updating the URL.
    document.addEventListener("click", function (event) {
        var link = event.target.closest('a[href^="#"]');
        if (!link || (!main.contains(link) && !link.classList.contains("skip-link"))) return;
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        var target = document.getElementById(link.hash.slice(1));
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        index.open = false;
        if (window.location.hash !== link.hash) history.pushState(null, "", link.hash);
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });
    }, true);

    var tables = [];
    main.querySelectorAll(".table-scroll").forEach(function (wrapper) {
        var hint = document.createElement("p");
        hint.className = "table-scroll-hint";
        hint.setAttribute("data-copy-markdown-ignore", "");
        hint.textContent = "Scroll horizontally to see all columns. Keyboard: focus the table, then use the arrow keys.";
        wrapper.parentNode.insertBefore(hint, wrapper);
        tables.push({ wrapper: wrapper, hint: hint });
    });
    function updateTableHints() {
        tables.forEach(function (table) {
            var overflows = table.wrapper.scrollWidth > table.wrapper.clientWidth + 1;
            table.hint.hidden = !overflows;
            table.wrapper.tabIndex = overflows ? 0 : -1;
        });
    }
    updateTableHints();
    window.addEventListener("resize", updateTableHints);
    window.addEventListener("load", updateTableHints);
})();
