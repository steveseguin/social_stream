(function () {
    'use strict';
    var core = window.SSNAiEventOverlay;
    var tags = 'style div span p article section header footer main aside h1 h2 h3 h4 h5 h6 b strong em i small br hr ul ol li dl dt dd blockquote pre code img svg g path circle ellipse rect line polyline polygon text tspan defs linearGradient radialGradient stop clipPath mask title desc'.toLowerCase().split(' ');
    var attributes = 'class id style role aria-label aria-hidden data-field viewbox d x y x1 x2 y1 y2 cx cy r rx ry width height fill stroke stroke-width stroke-linecap stroke-linejoin opacity fill-opacity stroke-opacity points transform offset stop-color stop-opacity preserveaspectratio xmlns'.split(' ');
    var fields = 'chatname chatmessage hasDonation donoValue membership subtitle type platform event'.split(' ');
    function fieldValue(name, message) {
        if (name === 'chatmessage') return core.plainMessage(message);
        var value;
        if (fields.indexOf(name) >= 0 && Object.prototype.hasOwnProperty.call(message, name)) value = message[name];
        else if (name.indexOf('meta.') === 0 && message.meta && Object.prototype.hasOwnProperty.call(message.meta, name.slice(5))) value = message.meta[name.slice(5)];
        return ['string', 'number', 'boolean'].indexOf(typeof value) >= 0 ? String(value) : '';
    }
    function render(container, result, message, options) {
        message = message || {};
        options = options || {};
        if (container.aiEventStop) container.aiEventStop();
        // Parse inertly, keep visual markup, and fill fields without parsing viewer text.
        var template = document.createElement('template');
        template.innerHTML = result.template;
        Array.prototype.forEach.call(template.content.querySelectorAll('*'), function (node) {
            if (tags.indexOf(node.localName.toLowerCase()) < 0) { node.remove(); return; }
            Array.prototype.slice.call(node.attributes).forEach(function (attribute) {
                if (attributes.indexOf(attribute.name.toLowerCase()) < 0) node.removeAttribute(attribute.name);
            });
            var field = node.getAttribute('data-field');
            if (node.localName === 'img') {
                if (field !== 'image' || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(result.image || '')) { node.remove(); return; }
                node.src = result.image;
                node.alt = 'Generated illustration';
            } else if (field && node.localName !== 'style') node.textContent = fieldValue(field, message);
        });
        var frame = document.createElement('iframe');
        frame.className = 'ai-event-template';
        frame.title = 'Generated event overlay';
        frame.setAttribute('sandbox', '');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'"><style>html,body{margin:0;width:100%;min-height:100%;background:transparent;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}</style></head><body>' + template.innerHTML + '</body></html>';
        container.appendChild(frame);
        var audio = null;
        if (/^data:audio\//i.test(result.audio || '')) {
            audio = new Audio(result.audio);
            audio.play().catch(function () { console.warn('AI overlay audio could not play.'); });
        }
        return new Promise(function (resolve) {
            var timer = setTimeout(function () {
                if (audio) audio.pause();
                if (!options.preview) frame.remove();
                resolve();
            }, (result.duration || 12) * 1000);
            container.aiEventStop = function () { clearTimeout(timer); if (audio) audio.pause(); frame.remove(); resolve(); };
            if (options.preview) resolve();
        });
    }
    window.SSNAiEventRender = render;
}());
