(function () {
    // Presentation only: the existing overlay continues to own every source/count node.
    window.SSNHypeLayout = function (options) {
        var params = options.params;
        var parent = options.parent;
        var track = options.track;
        var title = options.title;
        var design = params.get("style") || "default";
        var designs = ["micro", "pills", "glass", "neon", "outline", "broadcast", "cards", "scoreboard", "vertical", "grid", "autofit", "ticker", "rotate"];
        var isNew = designs.indexOf(design) !== -1;
        var layout = params.get("viewerlayout");
        var layouts = ["fixed", "fit", "wrap", "grid", "vertical", "ticker", "rotate"];
        var hasLayout = layouts.indexOf(layout) !== -1;
        if (!parent || !track || (!isNew && !hasLayout)) return;

        if (!hasLayout) {
            layout = design === "cards" ? "grid" : design;
            if (layouts.indexOf(layout) === -1) layout = "fit";
        }
        if (isNew) parent.classList.add("viewer-design");
        if (isNew && params.has("lightmode") && !params.has("darkmode")) parent.classList.add("viewer-light");
        parent.classList.add("viewer-layout-active");
        var accent = params.get("vieweraccent");
        if (accent && /^[0-9a-f]{3,8}$/i.test(accent)) accent = "#" + accent;
        if (accent && window.CSS && CSS.supports("color", accent)) parent.style.setProperty("--viewer-accent", accent);
        var gaps = { tight: "2px", normal: "6px", airy: "12px" };
        if (Object.prototype.hasOwnProperty.call(gaps, params.get("viewerspacing"))) {
            parent.style.setProperty("--viewer-gap", gaps[params.get("viewerspacing")]);
        }
        var pace = params.get("viewermotion");
        var speed = pace === "slow" ? 22 : pace === "fast" ? 70 : 40;
        var interval = pace === "slow" ? 10000 : pace === "fast" ? 3000 : 6000;
        var columns = parseInt(params.get("viewercolumns"), 10);
        columns = isFinite(columns) && columns > 0 ? Math.min(columns, 12) : 0;
        var baseScale = options.scale > 0 && isFinite(options.scale) ? options.scale : 1;
        var alignment = options.alignment || (design === "topbar" ? "right" : "left");
        var viewport = document.createElement("div");
        viewport.className = "viewer-viewport";
        parent.insertBefore(viewport, track);
        viewport.appendChild(track);
        var titleViewport = null;
        if (title) {
            titleViewport = document.createElement("div");
            titleViewport.className = "viewer-title-viewport";
            parent.insertBefore(titleViewport, title);
            titleViewport.appendChild(title);
        }
        var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        var activeType = "";
        var rotationAt = 0;
        var offset = 0;
        var direction = 1;
        var pauseUntil = 0;
        var lastTime = 0;
        var frame = 0;
        var queued = 0;
        var overflow = 0;
        var fit = 1;
        var left = 0;
        var mode = layout;

        function items() { return Array.prototype.slice.call(track.children); }
        function transform() {
            track.style.transform = "translateX(" + (left - offset) + "px) scale(" + fit + ")";
        }
        function schedule() {
            if (!queued) queued = requestAnimationFrame(update);
        }
        function update() {
            queued = 0;
            mode = reducedMotion.matches && (layout === "ticker" || layout === "rotate") ? "grid" : layout;
            var nodes = items();
            nodes.forEach(function (node) {
                var icon = node.querySelector("img");
                if (icon) icon.alt = node.dataset.type || "";
                var viewers = node.querySelector("[data-viewers]");
                var chatters = node.querySelector("[data-chatters]");
                if (viewers) viewers.setAttribute("aria-label", viewers.textContent + " viewers");
                if (chatters) chatters.setAttribute("aria-label", chatters.textContent + " active chatters");
            });
            var availableWidth = Math.max(1, window.innerWidth / baseScale);
            // The title stays outside the moving row and is included in the height budget.
            var naturalScale = baseScale * fit;
            var titleHeight = title ? title.getBoundingClientRect().height / naturalScale : 0;
            var availableHeight = Math.max(1, window.innerHeight / baseScale);
            track.classList.toggle("viewer-grid", mode === "grid");
            track.classList.toggle("viewer-wrap", mode === "wrap");
            track.classList.toggle("viewer-column", mode === "vertical");
            track.classList.toggle("viewer-rotating", mode === "rotate");
            if (mode === "rotate") {
                if (!nodes.some(function (node) { return node.dataset.type === activeType; })) {
                    activeType = nodes.length ? nodes[0].dataset.type : "";
                }
                nodes.forEach(function (node) {
                    if (node.dataset.type === activeType) node.setAttribute("data-viewer-active", "");
                    else node.removeAttribute("data-viewer-active");
                });
            }
            track.style.width = mode === "wrap" ? availableWidth + "px" : "max-content";
            if (mode === "grid") {
                // Measure actual tiles so large counts and custom fonts still fit each column.
                track.style.gridTemplateColumns = "none";
                var tileWidth = 1;
                var tileHeight = 1;
                nodes.forEach(function (node) {
                    tileWidth = Math.max(tileWidth, node.offsetWidth);
                    tileHeight = Math.max(tileHeight, node.offsetHeight);
                });
                var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
                var count = columns || Math.max(1, Math.floor((availableWidth + gap) / (tileWidth + gap)));
                count = Math.max(1, Math.min(count, nodes.length || 1));
                if (!columns && nodes.length) {
                    // Prefer the usual full-width grid, but use more/fewer columns
                    // when that keeps tiles larger in a short or narrow source.
                    function gridFit(cols) {
                        var rows = Math.ceil(nodes.length / cols);
                        return Math.min(1, availableWidth / (cols * tileWidth + (cols - 1) * gap),
                            availableHeight / (rows * tileHeight + (rows - 1) * gap + titleHeight));
                    }
                    var bestFit = gridFit(count);
                    for (var candidate = 1; candidate <= nodes.length; candidate++) {
                        var candidateFit = gridFit(candidate);
                        if (candidateFit > bestFit + 0.001) {
                            count = candidate;
                            bestFit = candidateFit;
                        }
                    }
                }
                track.style.gridTemplateColumns = "repeat(" + count + ", max-content)";
            }
            var trackBounds = track.getBoundingClientRect();
            var width = Math.max(trackBounds.width / naturalScale, track.scrollWidth);
            var height = trackBounds.height / naturalScale;
            // Wrapped tiles can exceed the track, and integer offset sizes can
            // round down fractional borders/text before the user's scale is applied.
            nodes.forEach(function (node) {
                var bounds = node.getBoundingClientRect();
                if (!bounds.width || !bounds.height) return;
                width = Math.max(width, (bounds.right - trackBounds.left) / naturalScale);
                height = Math.max(height, (bounds.bottom - trackBounds.top) / naturalScale);
            });
            fit = mode === "fixed" ? 1 : Math.min(1, availableHeight / Math.max(1, height + titleHeight));
            if (mode !== "fixed" && mode !== "ticker") fit = Math.min(fit, availableWidth / Math.max(1, width));
            overflow = mode === "ticker" ? Math.max(0, width * fit - availableWidth) : 0;
            offset = Math.min(offset, overflow);
            var spare = Math.max(0, availableWidth - width * fit);
            left = alignment === "right" ? spare : alignment === "center" ? spare / 2 : 0;
            viewport.style.height = (height * fit) + "px";
            if (titleViewport) {
                titleViewport.style.height = (titleHeight * fit) + "px";
                title.style.transform = "scale(" + fit + ")";
            }
            transform();
            var animated = (mode === "ticker" && overflow > 0) || (mode === "rotate" && nodes.length > 1);
            if (animated && !frame) {
                lastTime = 0;
                frame = requestAnimationFrame(animate);
            } else if (!animated && frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
        }
        function animate(now) {
            var elapsed = lastTime ? Math.min(now - lastTime, 100) : 0;
            lastTime = now;
            if (!document.hidden && !parent.classList.contains("hidden")) {
                if (mode === "ticker" && now >= pauseUntil) {
                    offset += direction * speed * elapsed / 1000;
                    if (offset >= overflow || offset <= 0) {
                        offset = Math.max(0, Math.min(offset, overflow));
                        direction = offset === 0 ? 1 : -1;
                        pauseUntil = now + 1500;
                    }
                    transform();
                } else if (mode === "rotate") {
                    if (!rotationAt) rotationAt = now;
                    if (now - rotationAt >= interval) {
                        var nodes = items();
                        var index = nodes.findIndex(function (node) { return node.dataset.type === activeType; });
                        if (nodes.length) activeType = nodes[(index + 1) % nodes.length].dataset.type;
                        rotationAt = now;
                        schedule();
                    }
                }
            }
            frame = requestAnimationFrame(animate);
        }
        new MutationObserver(schedule).observe(track, { childList: true, subtree: true, characterData: true });
        if (title) new MutationObserver(schedule).observe(title, { childList: true, subtree: true, characterData: true });
        // Source updates reveal the parent after modifying its children.
        new MutationObserver(schedule).observe(parent, { attributes: true, attributeFilter: ["class"] });
        track.addEventListener("load", schedule, true);
        window.addEventListener("resize", schedule);
        reducedMotion.addListener(schedule);
        if (window.ResizeObserver) new ResizeObserver(schedule).observe(track);
        if (document.fonts) {
            if (document.fonts.ready) document.fonts.ready.then(schedule);
            if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", schedule);
        }
        schedule();
    };
}());
