(function (root) {
    'use strict';
    var styles = ['glass', 'neon', 'storybook', 'minimal'];
    function profile(value) {
        value = value || {};
        return {
            id: String(value.id || 'default'),
            name: String(value.name || 'My AI overlay'),
            prompt: String(value.prompt || 'Create an animated neon celebration card with a large viewer name, their message, and an optional donation amount. Keep the background transparent.'),
            variations: String(value.variations || ''),
            model: String(value.model || ''),
            mode: ['featured', 'all', 'flow'].indexOf(value.mode) >= 0 ? value.mode : 'featured',
            style: styles.indexOf(value.style) >= 0 ? value.style : 'glass',
            autoStyle: value.autoStyle === true,
            duration: Number(value.duration) > 0 ? Number(value.duration) : 12,
            imageEnabled: value.imageEnabled === true,
            imageEndpoint: String(value.imageEndpoint || ''),
            imageKey: String(value.imageKey || ''),
            imageModel: String(value.imageModel || ''),
            imagePrompt: String(value.imagePrompt || 'Create a decorative celebration illustration, without lettering.'),
            ttsEnabled: value.ttsEnabled === true,
            ttsEndpoint: String(value.ttsEndpoint || ''),
            ttsKey: String(value.ttsKey || ''),
            ttsModel: String(value.ttsModel || ''),
            ttsVoice: String(value.ttsVoice || '')
        };
    }
    function publicProfile(value) {
        var p = profile(value);
        return { id: p.id, name: p.name, mode: p.mode, style: p.style, duration: p.duration };
    }
    function plainMessage(message) {
        var text = String(message.chatmessage || '');
        if (!message.textonly && root.document) {
            var fragment = root.document.createElement('template');
            fragment.innerHTML = text;
            Array.prototype.forEach.call(fragment.content.querySelectorAll('img'), function (img) {
                img.replaceWith(root.document.createTextNode(img.getAttribute('alt') || ''));
            });
            text = fragment.content.textContent || '';
        }
        return text;
    }
    function variation(p, value) {
        if (!value) return '';
        var choices = p.variations.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        var selected = String(value).trim();
        if (choices.indexOf(selected) < 0) throw new Error('Choose a variation saved in this overlay configuration.');
        return selected;
    }
    function prompt(p, selectedVariation) {
        return 'Create a custom HTML and CSS overlay template for an OBS Browser Source. Return only the HTML fragment and an inline <style> element.\n' +
            'Use responsive layout, a transparent background, and CSS for animation. Do not use JavaScript, external resources, links, forms, or iframes.\n' +
            'Leave viewer content empty. Use elements such as <span data-field="chatname"></span> and <p data-field="chatmessage"></p>; SSN fills them after generation.\n' +
            'Available text fields: chatname, chatmessage, hasDonation, donoValue, membership, subtitle, type, platform, event, and meta.FIELD. ' +
            'Optional generated artwork uses <img data-field="image" alt="">. Do not invent viewer names or messages.\n' +
            'Style guidance: ' + p.style + (p.autoStyle ? '. Vary the layout within the saved design instructions.' : '.') +
            '\n\nSaved design instructions:\n' + p.prompt +
            (selectedVariation ? '\n\nOperator-approved variation:\n' + selectedVariation : '');
    }
    function presentation(response, p) {
        var html = String(response == null ? '' : response).trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
        if (!/<[a-z][\s\S]*>/i.test(html)) throw new Error('The AI returned no HTML template. Try a model that can generate HTML and CSS.');
        return { template: html, duration: p.duration };
    }
    function eventMessage(payload, mode, id) {
        if (!payload || typeof payload !== 'object') return null;
        if (mode === 'flow') {
            return payload.meta && payload.meta.aiEventOverlay && payload.meta.aiEventOverlay.profile === id ? payload : null;
        }
        // The featured feed is selected by the transport. Dock sends the message
        // directly; API callers may wrap it in contents/content or action:value.
        if (mode === 'featured') {
            if (payload.contents) payload = payload.contents;
            else if (payload.content) payload = payload.content;
            else if (payload.action === 'content' && payload.value) {
                try { payload = JSON.parse(payload.value); } catch (_) { return null; }
                if (payload && payload.contents) payload = payload.contents;
            }
            if (!payload || typeof payload !== 'object') return null;
        }
        if (payload.contents || payload.action || payload.actionType) return null;
        return payload.chatname || payload.chatmessage || payload.hasDonation || payload.membership || payload.contentimg ? payload : null;
    }
    root.SSNAiEventOverlay = { profile: profile, publicProfile: publicProfile, plainMessage: plainMessage, variation: variation, prompt: prompt, presentation: presentation, eventMessage: eventMessage };
}(typeof window !== 'undefined' ? window : globalThis));
