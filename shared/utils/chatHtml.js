// Classic-script final display check. Load libs/objects.js first.
// This policy is separate from relay sanitization: retain supported presentation
// from older/custom senders without changing the capture or wire format.
(function (root) {
    "use strict";
    var displayFilter = null;

    function getDisplayFilter() {
        if (displayFilter) return displayFilter;
        var base = root.getSSNXSSFilter();
        var xss = root.ssnXSSLibrary;
        if (!base || !xss) return null;
        var options = Object.assign({}, base.options);
        var whiteList = {};
        Object.keys(base.options.whiteList).forEach(function (tag) {
            whiteList[tag] = base.options.whiteList[tag].slice();
        });
        // Ordinary chat formatting and emote wrappers; never allow executable
        // containers, embedded documents, event handlers, or arbitrary attributes.
        ["div", "p", "blockquote", "pre", "del", "sup", "sub", "mark", "ruby", "rt", "rp", "wbr", "hr"].forEach(function (tag) {
            whiteList[tag] = ["class"];
        });
        Object.keys(whiteList).forEach(function (tag) {
            whiteList[tag] = whiteList[tag].concat(["style", "title", "dir", "aria-label", "aria-hidden"]);
        });
        whiteList.a = whiteList.a.concat(["class", "rel"]);
        whiteList.img = whiteList.img.concat(["width", "height"]);
        options.whiteList = whiteList;

        // Use the packaged CSS parser, including its value checks. Add the
        // presentation properties used by stacked emotes and inline SVG.
        var cssWhiteList = xss.getDefaultCSSWhiteList();
        ["position", "top", "right", "bottom", "left", "transform", "transform-origin",
            "vertical-align", "opacity", "object-fit", "object-position", "white-space",
            "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
            "stroke-linecap", "stroke-linejoin", "display", "gap", "align-items", "justify-content"].forEach(function (property) {
            cssWhiteList[property] = true;
        });
        options.css = { whiteList: cssWhiteList };
        options.onTagAttr = function (tag, name, value, isWhiteAttr) {
            if (!isWhiteAttr) return "";
            if (name === "style") {
                var css = xss.safeAttrValue(tag, name, value, displayFilter.cssFilter);
                return css ? 'style="' + css + '"' : "";
            }
            if (name === "dir") return /^(?:ltr|rtl|auto)$/i.test(value) ? 'dir="' + value + '"' : "";
            if (name === "aria-hidden") return /^(?:true|false)$/i.test(value) ? 'aria-hidden="' + value + '"' : "";
            if (name === "aria-label" || name === "title") return name + '="' + xss.escapeAttrValue(value) + '"';
            if (name === "rel") return 'rel="noopener noreferrer"';
            return base.options.onTagAttr(tag, name, value, isWhiteAttr);
        };
        displayFilter = new xss.FilterXSS(options);
        return displayFilter;
    }

    function sanitize(html) {
        // Use local display copies of HTML-mode bodies or legacy names with
        // entities/emotes. textonly applies only to chatmessage: those bodies
        // use textContent or one template escape, never this HTML parser.
        var value = String(html == null ? "" : html);
        if (!value) return "";
        try {
            var filter = getDisplayFilter();
            if (filter) return filter.process(value);
        } catch (_) {}
        // A missing dependency must not expose raw HTML or drop the message.
        return value.replace(/[&<>"']/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
        });
    }

    root.SocialStreamChatHTML = { sanitize: sanitize };
})(window);
