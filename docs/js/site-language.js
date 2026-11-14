(function () {
    'use strict';
    var configElement = document.getElementById('ssn-site-language');
    if (!configElement) return;
    var config;
    try { config = JSON.parse(configElement.textContent); } catch (_) { return; }
    if (!config.language || !config.page) return;
    var strings = config.strings || {}, ui = config.ui || {};
    var sourceRoot = new URL(document.documentElement.getAttribute('data-site-root'), location.href);
    var sourcePage = new URL(config.page, sourceRoot);
    var own = Object.prototype.hasOwnProperty;
    var patterns = Object.keys(strings).filter(function (key) { return /\{\d+\}/.test(key); }).map(function (key) {
        var indexes = [];
        var expression = key.split(/(\{\d+\})/).map(function (part) {
            if (/^\{\d+\}$/.test(part)) { indexes.push(part.slice(1, -1)); return '(.+?)'; }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
        return {expression: new RegExp('^' + expression + '$'), indexes: indexes, value: strings[key]};
    });
    function normalize(value) { return String(value).replace(/\s+/g, ' ').trim(); }
    function translate(value, values) {
        var key = normalize(value);
        var result = own.call(ui, key) ? ui[key] : own.call(strings, key) ? strings[key] : value;
        if (!values && result === value) {
            patterns.some(function (pattern) {
                var match = key.match(pattern.expression);
                if (!match) return false;
                result = pattern.value.replace(/\{(\d+)\}/g, function (token, index) {
                    var position = pattern.indexes.indexOf(index);
                    return position === -1 ? token : match[position + 1];
                });
                return true;
            });
        }
        if (values) result = result.replace(/\{(\d+)\}/g, function (match, index) {
            return index < values.length ? String(values[index]) : match;
        });
        return result;
    }
    window.SSNSiteTranslate = translate;
    window.SSNSiteLanguage = config;
    window.SSNSiteSourceURL = function (value) { return new URL(value, sourcePage).href; };
    window.SSNSitePageURL = function (value) {
        var url = new URL(value, sourcePage);
        if (url.origin === sourceRoot.origin && url.pathname.indexOf(sourceRoot.pathname) === 0) {
            var path = url.pathname.slice(sourceRoot.pathname.length);
            if (path.slice(-1) === '/') path += 'index.html';
            if (config.pages.indexOf(path) !== -1 && !(path === 'docs/index.html' && url.searchParams.has('file'))) {
                url.pathname = sourceRoot.pathname + config.language + '/' + path;
            }
        }
        return url.href;
    };
    // Only saved, authored website text is translated. Never change code,
    // editable content, form values or marked user submissions.
    var skip = 'script,style,code,pre,svg,textarea,.code,.code-js,.url-example,[contenteditable],[translate="no"],[data-site-language-picker]';
    var seen = new WeakMap();
    function textNode(node) {
        if (!node.parentElement || node.parentElement.closest(skip)) return;
        var value = node.nodeValue;
        if (seen.get(node) === value) return;
        var translated = translate(value);
        if (translated !== value) {
            translated = value.match(/^\s*/)[0] + translated + value.match(/\s*$/)[0];
            node.nodeValue = translated;
        }
        seen.set(node, node.nodeValue);
    }
    function attributes(element) {
        if (element.closest(skip)) return;
        var names = ['alt', 'title', 'aria-label', 'placeholder'];
        if (element.tagName === 'TD') names.push('data-label');
        names.forEach(function (name) {
            if (!element.hasAttribute(name)) return;
            var value = element.getAttribute(name), key = name + ':' + value;
            var record = seen.get(element) || {};
            if (record[name] === key) return;
            var translated = translate(value);
            if (translated !== value) element.setAttribute(name, translated);
            record[name] = name + ':' + translated;
            seen.set(element, record);
        });
    }
    function visit(node) {
        if (node.nodeType === 3) return textNode(node);
        if (node.nodeType !== 1 || node.closest(skip)) return;
        attributes(node);
        var walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        var child;
        while ((child = walker.nextNode())) {
            if (child.nodeType === 3) textNode(child); else attributes(child);
        }
    }
    function start() {
        visit(document.body);
        new MutationObserver(function (records) {
            records.forEach(function (record) {
                if (record.type === 'childList') record.addedNodes.forEach(visit);
                else if (record.type === 'attributes') attributes(record.target);
                else textNode(record.target);
            });
        }).observe(document.body, {subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['alt', 'title', 'aria-label', 'placeholder', 'data-label']});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
