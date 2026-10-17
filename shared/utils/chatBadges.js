// Classic-script badge renderer. Load libs/objects.js first for the packaged
// HTML/SVG sanitizer; never rely on the sending extension's version.
(function (root) {
    "use strict";

    function toArray(value) {
        if (Array.isArray(value)) return value.slice();
        if (typeof value === "string" && value.trim()) return [value];
        if (value && typeof value === "object") return [value];
        return [];
    }

    function escapeAttribute(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
        });
    }

    function renderHtml(html, className) {
        // Sanitize BEFORE parsing, and use an inert template even for the safe
        // result. Detached divs can still load images and execute handlers.
        var template = document.createElement("template");
        template.innerHTML = root.filterXSS(html);
        var children = Array.prototype.slice.call(template.content.childNodes);
        children.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.localName === "svg") {
                var wrapper = document.createElement("span");
                wrapper.className = className + " svg ssn-badge-svg";
                node.parentNode.insertBefore(wrapper, node);
                wrapper.appendChild(node);
            } else {
                className.split(" ").forEach(function (name) { node.classList.add(name); });
                if (node.querySelector("svg")) node.classList.add("ssn-badge-svg");
            }
        });
        return template.innerHTML;
    }

    function renderOne(badge, className) {
        if (typeof badge === "string") {
            if (badge.indexOf("<") !== -1) return renderHtml(badge, className);
            badge = { type: "img", src: badge };
        }
        if (!badge || typeof badge !== "object" || Array.isArray(badge)) return "";
        if (badge.type === "svg" && typeof badge.html === "string") {
            return renderHtml(badge.html, className);
        }
        if ((badge.type === "text" || badge.type === "badge") && typeof badge.text === "string") {
			if (typeof badge.rawText === "string") {
				return '<span class="' + className + ' textbadge">' + escapeAttribute(badge.rawText) + '</span>';
			}
            // Older relays already escape text badges. Sanitizing here retains
            // those entities without double-escaping them.
            return '<span class="' + className + ' textbadge">' + root.filterXSS(badge.text) + '</span>';
        }
        if (typeof badge.src !== "string") return "";
        var src = root.sanitizeRelayUrl(badge.src, true);
        if (!src) return "";
        var background = root.sanitizeRelayCssColor(badge.bgcolor);
        var style = background ? ' style="background-color:' + escapeAttribute(background) + '"' : "";
        return '<img class="' + className + '" src="' + escapeAttribute(src) + '" alt="badge"' + style + '>';
    }

    function render(value, options) {
        // If the sanitizer failed to load, omit badges rather than render raw
        // input or interrupt the message containing them.
        if (typeof root.filterXSS !== "function" || typeof root.sanitizeRelayUrl !== "function" ||
                typeof root.sanitizeRelayCssColor !== "function") return "";
        options = options || {};
        var className = String(options.className || "badge").split(/\s+/).filter(function (name) {
            return /^[a-zA-Z0-9_-]+$/.test(name);
        }).join(" ") || "badge";
        var badges = toArray(value);
        if (typeof options.limit === "number" && isFinite(options.limit)) {
            badges = badges.slice(0, Math.max(0, Math.floor(options.limit)));
        }
        return badges.map(function (badge) {
            try { return renderOne(badge, className); } catch (_) { return ""; }
        }).join("");
    }

    root.SocialStreamBadges = { render: render, toArray: toArray };
})(typeof window !== "undefined" ? window : globalThis);
