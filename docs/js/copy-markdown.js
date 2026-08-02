(function () {
    "use strict";

    if (window.SSNCopyMarkdown) {
        return;
    }

    var BUTTON_ID = "copy-markdown";
    var EXTRA_SELECTOR = "[data-copy-markdown-extra]";
    var IGNORE_SELECTOR = [
        "script",
        "style",
        "noscript",
        "header",
        "footer",
        "nav",
        "aside",
        "button",
        "svg",
        ".toolbar",
        ".header-controls",
        ".mobile-nav-toggle",
        ".ssn-copy-markdown-wrap",
        ".ssn-copy-markdown-floating",
        "[data-copy-markdown-ignore]",
        EXTRA_SELECTOR
    ].join(",");

    function text(value) {
        return String(value || "").replace(/\u00a0/g, " ");
    }

    function inlineText(value) {
        return text(value).replace(/\s+/g, " ");
    }

    function absoluteUrl(value) {
        if (!value || /^(javascript|data):/i.test(value)) {
            return "";
        }
        try {
            return new URL(value, document.baseURI).href;
        } catch (_) {
            return value;
        }
    }

    function markdownCode(value) {
        var content = text(value).trim();
        var fence = content.indexOf("`") === -1 ? "`" : "``";
        return fence + content + fence;
    }

    function serializeChildren(node, context) {
        var output = "";
        var child = node.firstChild;
        while (child) {
            output += serializeNode(child, context || {});
            child = child.nextSibling;
        }
        return output;
    }

    function directChildrenByTag(node, tagName) {
        var matches = [];
        var child = node.firstElementChild;
        var expected = tagName.toUpperCase();
        while (child) {
            if (child.tagName === expected) {
                matches.push(child);
            }
            child = child.nextElementSibling;
        }
        return matches;
    }

    function serializeList(node, ordered, context) {
        var items = directChildrenByTag(node, "li");
        var depth = (context && context.listDepth) || 0;
        var output = "";

        items.forEach(function (item, index) {
            var primary = "";
            var nested = "";
            var child = item.firstChild;

            while (child) {
                if (
                    child.nodeType === 1 &&
                    (child.tagName === "UL" || child.tagName === "OL")
                ) {
                    nested += serializeList(child, child.tagName === "OL", {
                        listDepth: depth + 1
                    });
                } else {
                    primary += serializeNode(child, { listDepth: depth });
                }
                child = child.nextSibling;
            }

            primary = tidyMarkdown(primary).replace(/\n+/g, " ").trim();
            var prefix = ordered ? String(index + 1) + ". " : "- ";
            output += prefix + primary + "\n";

            if (nested.trim()) {
                output += nested
                    .trim()
                    .split("\n")
                    .map(function (line) {
                        return "  " + line;
                    })
                    .join("\n") + "\n";
            }
        });

        return "\n" + output + "\n";
    }

    function serializeTable(node) {
        var rows = Array.prototype.slice.call(node.querySelectorAll("tr"));
        if (!rows.length) {
            return "";
        }

        var matrix = rows.map(function (row) {
            return Array.prototype.slice.call(row.children)
                .filter(function (cell) {
                    return cell.tagName === "TH" || cell.tagName === "TD";
                })
                .map(function (cell) {
                    return tidyMarkdown(serializeChildren(cell, {}))
                        .replace(/\n+/g, "<br>")
                        .replace(/\|/g, "\\|")
                        .trim();
                });
        }).filter(function (row) {
            return row.length;
        });

        if (!matrix.length) {
            return "";
        }

        var columnCount = matrix.reduce(function (largest, row) {
            return Math.max(largest, row.length);
        }, 0);

        matrix.forEach(function (row) {
            while (row.length < columnCount) {
                row.push("");
            }
        });

        var output = "\n\n| " + matrix[0].join(" | ") + " |\n";
        output += "| " + matrix[0].map(function () {
            return "---";
        }).join(" | ") + " |\n";

        matrix.slice(1).forEach(function (row) {
            output += "| " + row.join(" | ") + " |\n";
        });

        return output + "\n";
    }

    function serializePre(node) {
        var codeNode = node.querySelector("code");
        var content = text(codeNode ? codeNode.textContent : node.textContent)
            .replace(/^\n+|\n+$/g, "");
        var language = "";
        var className = codeNode ? codeNode.className : "";
        var languageMatch = String(className || "").match(/(?:^|\s)language-([a-z0-9_-]+)/i);
        if (languageMatch) {
            language = languageMatch[1];
        }
        var fence = content.indexOf("```") === -1 ? "```" : "````";
        return "\n\n" + fence + language + "\n" + content + "\n" + fence + "\n\n";
    }

    function serializeNode(node, context) {
        if (node.nodeType === 3) {
            return inlineText(node.nodeValue);
        }
        if (node.nodeType !== 1) {
            return "";
        }

        var tag = node.tagName.toLowerCase();
        if (node.matches && node.matches(IGNORE_SELECTOR)) {
            return "";
        }

        if (/^h[1-6]$/.test(tag)) {
            var level = Number(tag.slice(1));
            return "\n\n" + new Array(level + 1).join("#") + " " +
                tidyMarkdown(serializeChildren(node, context)).replace(/\n+/g, " ").trim() +
                "\n\n";
        }
        if (tag === "p") {
            return "\n\n" + serializeChildren(node, context).trim() + "\n\n";
        }
        if (tag === "br") {
            return "  \n";
        }
        if (tag === "hr") {
            return "\n\n---\n\n";
        }
        if (tag === "strong" || tag === "b") {
            return "**" + serializeChildren(node, context).trim() + "**";
        }
        if (tag === "em" || tag === "i") {
            return "*" + serializeChildren(node, context).trim() + "*";
        }
        if (tag === "del" || tag === "s") {
            return "~~" + serializeChildren(node, context).trim() + "~~";
        }
        if (tag === "code") {
            if (node.parentElement && node.parentElement.tagName === "PRE") {
                return "";
            }
            return markdownCode(node.textContent);
        }
        if (tag === "pre") {
            return serializePre(node);
        }
        if (tag === "a") {
            var href = absoluteUrl(node.getAttribute("href"));
            var label = tidyMarkdown(serializeChildren(node, context))
                .replace(/\n+/g, " ")
                .trim();
            if (!href || href === window.location.href + "#") {
                return label;
            }
            return "[" + (label || href) + "](" + href + ")";
        }
        if (tag === "img") {
            var imageUrl = absoluteUrl(node.getAttribute("src"));
            if (!imageUrl) {
                return text(node.getAttribute("alt"));
            }
            return "![" + text(node.getAttribute("alt") || "Image").trim() + "](" + imageUrl + ")";
        }
        if (tag === "iframe") {
            var frameUrl = absoluteUrl(node.getAttribute("src"));
            var frameTitle = text(node.getAttribute("title") || "Embedded resource").trim();
            return frameUrl ? "\n\n[" + frameTitle + "](" + frameUrl + ")\n\n" : "";
        }
        if (tag === "video" || tag === "audio") {
            var mediaSource = node.getAttribute("src");
            if (!mediaSource) {
                var sourceNode = node.querySelector("source[src]");
                mediaSource = sourceNode ? sourceNode.getAttribute("src") : "";
            }
            var mediaUrl = absoluteUrl(mediaSource);
            return mediaUrl ? "\n\n[" + (tag === "video" ? "Video" : "Audio") + "](" + mediaUrl + ")\n\n" : "";
        }
        if (tag === "ul" || tag === "ol") {
            return serializeList(node, tag === "ol", context);
        }
        if (tag === "li") {
            return serializeChildren(node, context);
        }
        if (tag === "table") {
            return serializeTable(node);
        }
        if (tag === "blockquote") {
            var quote = tidyMarkdown(serializeChildren(node, context));
            return "\n\n" + quote.split("\n").map(function (line) {
                return "> " + line;
            }).join("\n") + "\n\n";
        }
        if (tag === "details") {
            var summary = node.querySelector("summary");
            var detailsClone = node.cloneNode(true);
            var clonedSummary = detailsClone.querySelector("summary");
            if (clonedSummary) {
                clonedSummary.parentNode.removeChild(clonedSummary);
            }
            return "\n\n**" + (summary ? text(summary.textContent).trim() : "Details") + "**\n\n" +
                serializeChildren(detailsClone, context) + "\n\n";
        }
        if (tag === "dt") {
            return "\n\n**" + serializeChildren(node, context).trim() + "**\n\n";
        }
        if (tag === "dd") {
            return serializeChildren(node, context) + "\n\n";
        }
        if (
            tag === "div" ||
            tag === "section" ||
            tag === "article" ||
            tag === "main" ||
            tag === "figure" ||
            tag === "figcaption" ||
            tag === "dl"
        ) {
            return "\n\n" + serializeChildren(node, context) + "\n\n";
        }
        if (tag === "input" || tag === "select" || tag === "textarea" || tag === "form") {
            return "";
        }

        return serializeChildren(node, context);
    }

    function tidyMarkdown(markdown) {
        return text(markdown)
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n[ \t]+\n/g, "\n\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    function captureContainer() {
        var holder = document.createElement("div");
        var explicitRoots = document.querySelectorAll("[data-copy-markdown-root]");
        var main = document.querySelector("main");
        var hero = document.querySelector(".page-hero");

        if (explicitRoots.length) {
            Array.prototype.forEach.call(explicitRoots, function (root) {
                holder.appendChild(root.cloneNode(true));
            });
        } else if (main) {
            if (hero && !main.contains(hero)) {
                holder.appendChild(hero.cloneNode(true));
            }
            holder.appendChild(main.cloneNode(true));
        } else if (document.body) {
            holder.appendChild(document.body.cloneNode(true));
        }

        Array.prototype.forEach.call(holder.querySelectorAll(IGNORE_SELECTOR), function (element) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        return holder;
    }

    function defaultTitle() {
        var heading = document.querySelector(
            "[data-copy-markdown-title], main h1, .page-hero h1, h1"
        );
        return text(
            heading ? heading.textContent : document.title
        ).replace(/\s+/g, " ").trim();
    }

    function pageDescription() {
        var description = document.querySelector('meta[name="description"]');
        return description ? text(description.getAttribute("content")).trim() : "";
    }

    function extraMarkdown() {
        var extras = [];
        Array.prototype.forEach.call(document.querySelectorAll(EXTRA_SELECTOR), function (element) {
            var value = "";
            if (element.tagName === "TEMPLATE") {
                value = element.content ? element.content.textContent : element.textContent;
            } else if (
                element.tagName === "SCRIPT" ||
                element.getAttribute("data-copy-markdown-format") === "markdown"
            ) {
                value = element.textContent;
            } else {
                value = serializeNode(element.cloneNode(true), {});
            }
            value = tidyMarkdown(value);
            if (value) {
                extras.push(value);
            }
        });
        return extras.join("\n\n");
    }

    function providedSource() {
        var provider = window.SSN_COPY_MARKDOWN_SOURCE;
        if (!provider) {
            return {};
        }
        try {
            var value = typeof provider === "function" ? provider() : provider;
            if (typeof value === "string") {
                return { markdown: value };
            }
            return value || {};
        } catch (_) {
            return {};
        }
    }

    function yamlValue(value) {
        return JSON.stringify(text(value).replace(/\s+/g, " ").trim());
    }

    function buildDocumentMarkdown() {
        var provided = providedSource();
        var title = provided.title || defaultTitle() || "Social Stream Ninja Documentation";
        var description = provided.description || pageDescription();
        var sourceUrl = provided.source || window.location.href.split("#")[0];
        var content = provided.markdown;
        var extras = [];

        if (typeof content !== "string" || !content.trim()) {
            content = serializeChildren(captureContainer(), {});
        }
        content = tidyMarkdown(content);

        var pageExtras = extraMarkdown();
        if (pageExtras) {
            extras.push(pageExtras);
        }
        if (provided.extraMarkdown) {
            extras.push(tidyMarkdown(provided.extraMarkdown));
        }

        var frontMatter = [
            "---",
            "product: " + yamlValue("Social Stream Ninja"),
            "title: " + yamlValue(title),
            "source: " + yamlValue(sourceUrl)
        ];

        if (description) {
            frontMatter.push("description: " + yamlValue(description));
        }
        if (provided.documentPath) {
            frontMatter.push("document_path: " + yamlValue(provided.documentPath));
        }
        frontMatter.push("exported_for: " + yamlValue("LLM context"));
        frontMatter.push("---");

        var assistantContext = [
            "## Context for AI assistants",
            "",
            "Use this as Social Stream Ninja product documentation. Preserve literal URL parameters, field names, commands, and code. Distinguish documented behavior from assumptions, and do not assume the browser extension, desktop app, and Lite surfaces behave identically unless the document says so.",
            "",
            "This export can include content hidden behind page tabs or modes, full link and embedded-resource destinations, and additional maintainer-supplied LLM context."
        ].join("\n");

        var output = frontMatter.join("\n") + "\n\n" + assistantContext +
            "\n\n## Documentation content\n\n" + content;

        if (extras.length) {
            output += "\n\n## Additional LLM context\n\n" + extras.join("\n\n");
        }

        return tidyMarkdown(output) + "\n";
    }

    function fallbackCopy(markdown) {
        return new Promise(function (resolve, reject) {
            var textarea = document.createElement("textarea");
            textarea.value = markdown;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            textarea.style.top = "0";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                var copied = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (copied) {
                    resolve();
                } else {
                    reject(new Error("Copy command was rejected"));
                }
            } catch (error) {
                document.body.removeChild(textarea);
                reject(error);
            }
        });
    }

    function writeClipboard(markdown) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(markdown).catch(function () {
                return fallbackCopy(markdown);
            });
        }
        return fallbackCopy(markdown);
    }

    function setButtonStatus(button, label, stateName) {
        button.textContent = label;
        button.setAttribute("data-copy-state", stateName || "");
    }

    function copyDocumentMarkdown(button) {
        var markdown = buildDocumentMarkdown();
        var originalLabel = "Copy Markdown";
        button.disabled = true;
        setButtonStatus(button, "Copying…", "working");

        return writeClipboard(markdown).then(function () {
            setButtonStatus(button, "Markdown copied", "success");
        }).catch(function () {
            setButtonStatus(button, "Copy failed", "error");
        }).then(function () {
            window.setTimeout(function () {
                button.disabled = false;
                setButtonStatus(button, originalLabel, "");
            }, 1600);
            return markdown;
        });
    }

    function injectStyles() {
        if (document.getElementById("ssn-copy-markdown-styles")) {
            return;
        }
        var style = document.createElement("style");
        style.id = "ssn-copy-markdown-styles";
        style.textContent = [
            ".ssn-copy-markdown-wrap{display:flex;justify-content:center;margin-top:1.8rem}",
            ".ssn-copy-markdown-floating{position:fixed;right:1rem;bottom:1rem;z-index:10000}",
            ".ssn-copy-markdown-button{appearance:none;border:1px solid var(--border-color,rgba(127,127,127,.45));border-radius:8px;background:var(--background-card,#fff);color:var(--text-primary,#1f2937);font:600 14px/1.2 system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;padding:10px 14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12);transition:background-color .2s,border-color .2s,transform .2s}",
            ".ssn-copy-markdown-button:hover{border-color:var(--primary-color,#7c3aed);transform:translateY(-1px)}",
            ".ssn-copy-markdown-button:focus-visible{outline:2px solid var(--primary-color,#7c3aed);outline-offset:2px}",
            ".ssn-copy-markdown-button:disabled{cursor:wait;opacity:.82;transform:none}",
            ".ssn-copy-markdown-button[data-copy-state=success]{border-color:var(--success-color,#16a34a)}",
            ".ssn-copy-markdown-button[data-copy-state=error]{border-color:var(--error-color,#dc2626)}",
            ".dark-mode .ssn-copy-markdown-button,body.dark-mode .ssn-copy-markdown-button{background:var(--background-card,#1b1e27);color:var(--text-primary,#e9edf5)}",
            ".toolbar-buttons .ssn-copy-markdown-button{box-shadow:none}",
            "@media(max-width:700px){.ssn-copy-markdown-floating{right:.75rem;bottom:.75rem}.ssn-copy-markdown-button{padding:9px 11px;font-size:13px}}"
        ].join("");
        document.head.appendChild(style);
    }

    function installButton() {
        if (!document.body || document.getElementById(BUTTON_ID)) {
            return;
        }

        injectStyles();

        var button = document.createElement("button");
        button.id = BUTTON_ID;
        button.className = "ssn-copy-markdown-button";
        button.type = "button";
        button.textContent = "Copy Markdown";
        button.title = "Copy comprehensive Markdown for an AI assistant";
        button.setAttribute("aria-label", "Copy this documentation page as Markdown for an AI assistant");
        button.addEventListener("click", function () {
            copyDocumentMarkdown(button);
        });

        var actionHost = document.querySelector("[data-copy-markdown-actions], .toolbar-buttons");
        var heroContainer = document.querySelector(".page-hero .container");
        var wrapper = document.createElement("div");

        if (actionHost) {
            actionHost.appendChild(button);
        } else if (heroContainer) {
            wrapper.className = "ssn-copy-markdown-wrap";
            wrapper.appendChild(button);
            heroContainer.appendChild(wrapper);
        } else {
            wrapper.className = "ssn-copy-markdown-floating";
            wrapper.appendChild(button);
            document.body.appendChild(wrapper);
        }
    }

    window.SSNCopyMarkdown = {
        build: buildDocumentMarkdown,
        copy: function () {
            var button = document.getElementById(BUTTON_ID);
            return button ? copyDocumentMarkdown(button) : Promise.reject(new Error("Copy Markdown button is unavailable"));
        },
        install: installButton
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installButton);
    } else {
        installButton();
    }
})();
