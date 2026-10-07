(function () {
    'use strict';

    // The numbers are the popup's saved-setting namespaces (getTargetMap).
    var pages = {
        'dock.html': 1, 'featured.html': 2, 'emotes.html': 3, 'hype.html': 4,
        'waitlist.html': 5, 'ticker.html': 6, 'wordcloud.html': 7, 'gif.html': 9,
        'bot.html': 10, 'cohost.html': 11, 'tipjar.html': 12, 'credits.html': 13,
        'giveaway.html': 14, 'chatbot.html': 15, 'poll.html': 16, 'events.html': 17,
        'actions.html': 18, 'leaderboard.html': 19, 'games.html': 20, 'battle.html': 20,
        'scoreboard.html': 21, 'spotify-overlay.html': 22, 'map.html': 23,
        'meta.html': 24, 'multi-alerts.html': 25, 'timer.html': 26, 'reactions.html': 27,
        'cohost-overlay.html': 28, 'aiprompt.html': 31, 'aievent.html': 32
    };
    var base = 'https://socialstream.ninja/';
    var cssAliases = ['cssb64', 'base64css', 'b64css', 'cssbase64'];
    var connectionKeys = ['session', 'room', 'password', 'v'];

    function own(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function createSchema(html) {
        // Read controls as inert markup: never run the popup or load its resources.
        var template = document.createElement('template');
        template.innerHTML = html;
        var root = template.content;
        var groups = Object.create(null);
        root.querySelectorAll('input, textarea, select').forEach(function (element) {
            Array.prototype.forEach.call(element.attributes, function (attr) {
                var match = attr.name.match(/^data-(param|textparam|optionparam|numbersetting)(\d*)$/);
                if (!match || (!match[2] && match[1] !== 'numbersetting')) return;
                var number = Number(match[2] || 1);
                if (!groups[number]) groups[number] = [];
                groups[number].push({ key: attr.value, type: attr.name.slice(5), element: element });
            });
        });
        var presets = [];
        [['overlay-preset-select', 30, 'overlayPreset'], ['featured-preset-select', 2, 'featuredOverlayStyle'],
            ['games-preset-select', 20, null]].forEach(function (entry) {
            var select = root.getElementById(entry[0]);
            if (!select) return;
            Array.prototype.forEach.call(select.options, function (option) {
                if (!option.value || option.value.indexOf('.html') === -1) return;
                presets.push({ url: new URL(option.value, base), value: option.value,
                    group: entry[1], setting: entry[2] });
            });
        });
        return { groups: groups, presets: presets, root: root };
    }

    function normalizeUrl(raw, queryPage) {
        var text = raw.trim().replace(/^<([\s\S]*)>$/, '$1').replace(/^\[[^\]]*\]\((.*)\)$/, '$1');
        text = text.replace(/&amp;/g, '&');
        if (!text) throw new Error('Paste at least one link.');
        var url;
        if (/^[a-z]:[\\/]/i.test(text)) {
            url = new URL('file:///' + text.replace(/\\/g, '/'));
        } else if (/^(\?|(?:session|room)=)/.test(text)) {
            url = new URL(queryPage + (text.charAt(0) === '?' ? text : '?' + text), base);
        } else if (/^(?:\.?\.?\/|[\w-]+\.html(?:\?|$)|themes\/|games\/)/i.test(text)) {
            url = new URL(text, base);
        } else {
            url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) && !/^[\w.-]+:\d+\//.test(text) ? text : 'https://' + text);
        }
        if (['https:', 'http:', 'file:', 'chrome-extension:', 'moz-extension:'].indexOf(url.protocol) === -1) {
            throw new Error('Use a web, local file, or extension link.');
        }
        return url;
    }

    function identify(url, schema) {
        var path = decodeURIComponent(url.pathname).replace(/\\/g, '/');
        var candidates = schema.presets.filter(function (preset) {
            if (!path.endsWith(preset.url.pathname)) return false;
            var matches = true;
            preset.url.searchParams.forEach(function (value, key) {
                if (url.searchParams.get(key) !== value) matches = false;
            });
            return matches;
        });
        candidates.sort(function (a, b) { return b.url.search.length - a.url.search.length; });
        if (candidates.length) return candidates[0];
        var file = path.split('/').pop();
        var group = own(pages, file) ? pages[file] : null;
        if (file === 'meta.html' && url.searchParams.has('hype')) group = 29;
        return { group: group, value: file, setting: file === 'featured.html' ? 'featuredOverlayStyle' : null };
    }

    function recover(text, schema, queryPage, linkTypes) {
        var settings = Object.create(null);
        var groups = Object.create(null);
        var warnings = [];
        var links = [];
        var linkParams = [];
        var session = null;
        var password = null;
        function warn(message) {
            if (warnings.indexOf(message) === -1) warnings.push(message);
        }
        function put(key, type, value) {
            if (['__proto__', 'constructor', 'prototype'].indexOf(key) !== -1) throw new Error('Unsafe setting name.');
            if (!own(settings, key)) settings[key] = Object.create(null);
            if (own(settings[key], type) && settings[key][type] !== value) {
                throw new Error('Conflicting values for "' + key + '". Keep one value per overlay.');
            }
            settings[key][type] = value;
        }
        var lines = text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        if (!lines.length) throw new Error('Paste at least one link.');
        lines.forEach(function (line, index) {
            var prefix = 'Link ' + (index + 1) + ': ';
            var url;
            try { url = normalizeUrl(line, queryPage || 'dock.html'); }
            catch (error) { throw new Error(prefix + 'Enter a complete link or a query string. ' + error.message); }
            var params = url.searchParams;
            linkParams.push(params);
            ['session', 'room'].forEach(function (key) {
                params.getAll(key).forEach(function (value) {
                    if (!value) return;
                    if (session !== null && session !== value) throw new Error(prefix + 'These links use different session IDs. Recover each session separately.');
                    session = value;
                });
            });
            // A missing password means no password, not an unknown password.
            var passwords = params.has('password') ? params.getAll('password') : [''];
            passwords.forEach(function (value) {
                if (password !== null && password !== value) throw new Error(prefix + 'These links use different passwords. Use links from the same session and password.');
                password = value;
            });
            var target = identify(url, schema);
            if (target.group === 29) {
                if (linkTypes && linkTypes[index] === '24') target.group = 24;
                else if (!linkTypes || !linkTypes[index]) {
                    var metaOnly = (schema.groups[24] || []).some(function (control) {
                        return control.key !== 'hype' && params.has(control.key.split('=')[0]) &&
                            !(schema.groups[29] || []).some(function (other) { return other.key === control.key; });
                    });
                    if (metaOnly) target.group = 24;
                    warn(prefix + 'This meta.html link can be used for a meta bar or a hype train. Check its link type above.');
                }
            }
            links.push({ name: target.value, group: target.group });
            if (!target.group) warn(prefix + 'No popup settings mapping for ' + target.value + '. Only the session and password can be recovered from this page.');
            if (url.hash) warn(prefix + 'The URL fragment is not part of the settings backup. Keep the original link if it provides private access or other page options.');
            var id = target.group || 'unknown-' + index;
            if (!groups[id]) groups[id] = { params: new URLSearchParams(), target: target, prefix: prefix };
            if (target.setting) {
                put(target.setting, 'optionsetting', target.value === 'featured.html' ? '' : target.value);
            } else if (target.group === 20 && target.value !== 'games.html') {
                warn(prefix + 'After importing, select ' + target.value + ' in the Games menu; the game selection is not stored in settings backups.');
            }
            params.forEach(function (value, key) {
                if (connectionKeys.indexOf(key) !== -1) return;
                var canonical = cssAliases.indexOf(key) !== -1 ? 'cssb64' :
                    ['base64js', 'b64js', 'jsbase64'].indexOf(key) !== -1 ? 'jsb64' : key;
                var combined = groups[id].params;
                if (combined.has(canonical) && combined.get(canonical) !== value) {
                    throw new Error(prefix + 'Conflicting values for "' + canonical + '". Keep one value per overlay.');
                }
                combined.set(canonical, value);
            });
        });
        if (!session) throw new Error('No session ID found. Include a link with ?session=YOUR_ID.');
        // Match the importer's session rules without silently changing the connection.
        if (!/^[a-zA-Z0-9_]{2,80}$/.test(session) || /^_+$/.test(session) ||
            ['undefined', 'null', 'false', 'true', 'nan', 'default', 'room', 'lobby', 'test', 'nothing', 'none'].indexOf(session.toLowerCase()) !== -1) {
            throw new Error('This session ID cannot be imported unchanged. Use a link with a valid Social Stream session ID.');
        }
        Object.keys(groups).forEach(function (id) {
            var group = groups[id];
            var number = group.target.group;
            var params = group.params;
            var controls = schema.groups[number] || [];
            var used = new Set();
            if (group.target.url) group.target.url.searchParams.forEach(function (value, key) { used.add(key); });
            if (number === 29) used.add('hype');
            if (number === 14) used.add('managed');
            function saveControl(control, value) {
                put(control.key, control.type, value);
                // Provider menus also save their UI selection alongside the URL option.
                if (control.type.indexOf('optionparam') === 0) {
                    ['optionsetting', 'optionsetting' + number].forEach(function (type) {
                        var key = control.element.getAttribute('data-' + type);
                        if (key) put(key, type, value);
                    });
                }
            }
            function importControls(list) {
                list.forEach(function (control) {
                    var key = control.key;
                    var type = control.type;
                    var parts = key.split('=');
                    var rawKey = parts.shift();
                    var paramKey = rawKey === 'chromaalpha' ? 'chroma' : rawKey;
                    if (!params.has(paramKey)) return;
                    var value = params.get(paramKey);
                    if (rawKey === 'chromaalpha') {
                        // The slider emits black chroma with a four-digit alpha component.
                        if (!/^#?000[0-9a-f]$/i.test(value)) return;
                        saveControl(control, type.indexOf('param') === 0 ? true : String(Math.round(parseInt(value.slice(-1), 16) * 100 / 15)));
                        used.add(paramKey);
                        return;
                    }
                    if (type.indexOf('param') === 0) {
                        if (parts.length) {
                            if (parts.join('=') !== value) return;
                        } else {
                            var fixedMatch = list.some(function (other) {
                                return other.type === type && other.key === key + '=' + value;
                            });
                            if (fixedMatch || (key === 'chroma' && /^#?000[0-9a-f]$/i.test(value))) return;
                            if (value && !list.some(function (other) { return other.key === key && other.type.indexOf('param') !== 0; })) {
                                warn(group.prefix + key + ': recovered the on/off toggle only. Keep the original link for its custom value.');
                            }
                        }
                        saveControl(control, true);
                    } else if (type.indexOf('numbersetting') === 0) {
                        // Unnumbered number inputs also include unrelated bot/app settings.
                        if (type === 'numbersetting' && !list.some(function (other) {
                            return other.type === 'param1' && (other.key === key ||
                                (other.element.getAttribute('data-related-settings1') || '').split(',').indexOf(key) !== -1);
                        })) return;
                        if (!value || !isFinite(Number(value))) {
                            warn(group.prefix + 'Invalid number for ' + key + '; keep or correct the original link.');
                            return;
                        }
                        saveControl(control, value);
                    } else if (key === 'cssb64') {
                        try { saveControl(control, decodeURIComponent(atob(value.replace(/ /g, '+')))); }
                        catch (error) { throw new Error(group.prefix + 'The embedded CSS is invalid. Correct cssb64 or remove it from the link.'); }
                    } else if (type.indexOf('optionparam') === 0 && /lang$/.test(key)) {
                        var voiceKey = key === 'lang' || key === 'systemlang' ? 'voice' : 'voice' + key.slice(0, -4);
                        if (params.has(voiceKey)) {
                            saveControl(control, 'lang=' + encodeURIComponent(value) + '&voice=' + encodeURIComponent(params.get(voiceKey)));
                            used.add(voiceKey);
                        } else saveControl(control, value);
                    } else {
                        saveControl(control, value);
                    }
                    used.add(paramKey);
                });
            }
            importControls(controls);
            if (number === 30) {
                // Template links inherit main-chat options when built by the popup.
                importControls((schema.groups[1] || []).filter(function (control) {
                    var key = control.key.split('=')[0];
                    return !used.has(key === 'chromaalpha' ? 'chroma' : key);
                }));
            }
            if (number === 28 || number === 11) {
                var aiFields = number === 28 ? {
                    label: ['aiOverlayLabel', 'textsetting'], name: ['aiOverlayName', 'textsetting'],
                    avatar: ['aiOverlayAvatar', 'textsetting'], position: ['aiOverlayPosition', 'optionsetting'],
                    scale: ['aiOverlayScale', 'numbersetting'], tts: ['aiOverlayTts', 'setting']
                } : { aioverlay: ['aiOverlayLabel', 'textsetting'] };
                Object.keys(aiFields).forEach(function (key) {
                    if (!params.has(key)) return;
                    var field = aiFields[key];
                    put(field[0], field[1], field[1] === 'setting' ? true : params.get(key));
                    used.add(key);
                });
            }
            params.forEach(function (value, key) {
                if (used.has(key)) return;
                var both = Array.prototype.find.call(schema.root.querySelectorAll('[data-both]'), function (element) {
                    return element.getAttribute('data-both') === key;
                });
                if (both && value === '') {
                    put(key, 'both', true);
                    used.add(key);
                    if (linkParams.some(function (other) { return !other.has(key); })) {
                        warn(key + ' is shared across overlays. Your links differ; review this connection setting after importing.');
                    }
                } else {
                    warn(group.prefix + 'Not recovered: ' + key + '. Keep the original link for this option.');
                }
            });
        });
        return { data: { streamID: session, password: password || '', state: true, settings: settings },
            warnings: warnings, links: links };
    }

    window.SSNSettingsRecovery = { createSchema: createSchema, recover: recover };
    var input = document.getElementById('recoveryUrls');
    var output = document.getElementById('output');
    var errorBox = document.getElementById('error');
    var status = document.getElementById('status');
    var download = document.getElementById('downloadBtn');
    var copy = document.getElementById('copyBtn');
    var generate = document.getElementById('generateBtn');
    var schema = null;
    function readLinkTypes(source) {
        var container = document.getElementById('linkTypes');
        var previous = Object.create(null);
        container.querySelectorAll('select').forEach(function (select) { previous[select.dataset.source] = select.value; });
        container.textContent = '';
        var types = Object.create(null);
        source.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).forEach(function (line, index) {
            var url;
            try { url = normalizeUrl(line, document.getElementById('queryPage').value); } catch (error) { return; }
            if (!url.pathname.endsWith('/meta.html') || !url.searchParams.has('hype')) return;
            var label = document.createElement('label');
            label.textContent = 'Link ' + (index + 1) + ' — meta.html with hype';
            var select = document.createElement('select');
            select.dataset.source = index + ':' + line;
            select.id = 'linkType' + index;
            label.htmlFor = select.id;
            [['', 'Detect automatically'], ['24', 'Meta bar'], ['29', 'Hype train']].forEach(function (entry) {
                var option = document.createElement('option');
                option.value = entry[0]; option.textContent = entry[1]; select.appendChild(option);
            });
            select.value = previous[select.dataset.source] || '';
            types[index] = select.value;
            select.addEventListener('change', build);
            container.appendChild(label); container.appendChild(select);
        });
        return types;
    }
    function clearResult() {
        output.value = '';
        document.getElementById('summary').textContent = '';
        document.getElementById('warnings').textContent = '';
        document.getElementById('result').hidden = true;
        errorBox.textContent = '';
        status.textContent = '';
        download.disabled = copy.disabled = true;
    }
    async function build() {
        if (generate.disabled) return;
        clearResult();
        var source = input.value;
        generate.disabled = true;
        status.textContent = 'Reading settings controls…';
        try {
            if (!schema) {
                var response = await fetch('popup.html');
                if (!response.ok) throw new Error('Could not load popup.html. Open this tool from the extension or the Social Stream website and try again.');
                schema = createSchema(await response.text());
                if (!schema.groups[1] || !schema.groups[2]) throw new Error('The settings controls could not be read. Reload this page and try again.');
            }
            if (input.value !== source) return;
            var result = recover(source, schema, document.getElementById('queryPage').value, readLinkTypes(source));
            output.value = JSON.stringify(result.data, null, 2);
            document.getElementById('summary').textContent = result.links.length + ' link(s) combined · ' +
                Object.keys(result.data.settings).length + ' settings entries · Session: ' + result.data.streamID;
            result.warnings.forEach(function (message) {
                var item = document.createElement('li');
                item.textContent = message;
                document.getElementById('warnings').appendChild(item);
            });
            document.getElementById('result').hidden = false;
            download.disabled = copy.disabled = false;
            status.textContent = result.warnings.length ? 'Generated with notes. Review the options listed below before importing.' : 'Settings file ready to download.';
        } catch (error) {
            errorBox.textContent = error.message || 'Could not generate settings. Check the links and try again.';
        } finally {
            generate.disabled = false;
            if (!output.value) status.textContent = '';
        }
    }
    generate.addEventListener('click', build);
    input.addEventListener('input', function () {
        clearResult();
        document.getElementById('linkTypes').textContent = '';
    });
    document.getElementById('queryPage').addEventListener('change', clearResult);
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); build(); }
    });
    download.addEventListener('click', function () {
        if (!output.value) return;
        var url = URL.createObjectURL(new Blob([output.value], { type: 'application/json' }));
        var link = document.createElement('a');
        link.href = url;
        link.download = 'socialstream-settings.data';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    copy.addEventListener('click', async function () {
        if (!output.value) return;
        try { await navigator.clipboard.writeText(output.value); status.textContent = 'JSON copied.'; }
        catch (error) {
            document.getElementById('jsonDetails').open = true;
            output.focus();
            output.select();
            status.textContent = 'Copy is unavailable here. The JSON is selected; press Ctrl+C or Command+C.';
        }
    });
})();
