        // ------------------------------------------------------------------
        // URL parameters
        // ------------------------------------------------------------------
        var urlParams = new URLSearchParams(window.location.search);
        var giveawayDebug = urlParams.has('debug');
        function dbg() {
            if (giveawayDebug) {
                console.log.apply(console, arguments);
            }
        }

        var roomID = "test";
        var password = "false";

        if (urlParams.has("session")) {
            roomID = urlParams.get("session");
        } else if (urlParams.has("s")) {
            roomID = urlParams.get("s");
        } else if (urlParams.has("id")) {
            roomID = urlParams.get("id");
        }
        if (urlParams.has("password")) {
            password = urlParams.get("password") || "false";
        }
        if (urlParams.get('obs') === 'true') {
            document.body.classList.add('obs-mode');
        }

        // ------------------------------------------------------------------
        // Themes (wheel palettes shared with giveaway-obs-entries.html — keep in sync)
        // ------------------------------------------------------------------
        var GIVEAWAY_THEMES = {
            classic: {
                usePlatformColors: true,
                palette: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#38bdf8'],
                rim: '#ffffff',
                segmentStroke: 'rgba(255,255,255,0.8)',
                labelColor: '#ffffff',
                pointer: ['#ff6b6b', '#ff5252', '#f44336'],
                hub: ['#ffffff', '#f8f9fa', '#e9ecef'],
                accent: '#FFD700'
            },
            midnight: {
                usePlatformColors: false,
                palette: ['#312e81', '#1e3a8a', '#4338ca', '#1e40af', '#3730a3', '#172554'],
                rim: '#0f172a',
                segmentStroke: 'rgba(148,163,184,0.35)',
                labelColor: '#e2e8f0',
                pointer: ['#7dd3fc', '#38bdf8', '#0284c7'],
                hub: ['#334155', '#1e293b', '#0f172a'],
                accent: '#38bdf8'
            },
            neon: {
                usePlatformColors: false,
                palette: ['#9b5de5', '#f15bb5', '#fee440', '#00bbf9', '#00f5d4'],
                rim: '#0a0a0f',
                segmentStroke: 'rgba(255,255,255,0.25)',
                labelColor: '#ffffff',
                pointer: ['#fff7ae', '#fee440', '#facc15'],
                hub: ['#1c1c28', '#10101a', '#050508'],
                accent: '#00f5d4'
            },
            sunset: {
                usePlatformColors: false,
                palette: ['#f83600', '#fe8c00', '#ffd452', '#ff6a88', '#ff9a8b', '#c2410c'],
                rim: '#fff7ed',
                segmentStroke: 'rgba(255,255,255,0.6)',
                labelColor: '#ffffff',
                pointer: ['#fde68a', '#f59e0b', '#b45309'],
                hub: ['#fff7ed', '#ffedd5', '#fed7aa'],
                accent: '#fb923c'
            },
            casino: {
                usePlatformColors: false,
                palette: ['#b91c1c', '#18181b'],
                rim: '#d4af37',
                segmentStroke: 'rgba(212,175,55,0.9)',
                labelColor: '#ffffff',
                pointer: ['#fde68a', '#d4af37', '#92700c'],
                hub: ['#3f3f46', '#27272a', '#18181b'],
                accent: '#d4af37'
            },
            mono: {
                usePlatformColors: false,
                palette: ['#1f1f1f', '#3d3d3d', '#5b5b5b', '#787878'],
                rim: '#fafafa',
                segmentStroke: 'rgba(255,255,255,0.5)',
                labelColor: '#ffffff',
                pointer: ['#fafafa', '#d4d4d4', '#a3a3a3'],
                hub: ['#e5e5e5', '#d4d4d4', '#a3a3a3'],
                accent: '#fafafa'
            }
        };

        function resolveTheme(name) {
            return GIVEAWAY_THEMES[String(name || '').toLowerCase()] || GIVEAWAY_THEMES.classic;
        }

        // ------------------------------------------------------------------
        // Cached wheel renderer (shared design with giveaway-obs-entries.html
        // — keep in sync). The wheel base is drawn once into an offscreen
        // canvas whenever entrants or theme change (debounced); each frame is
        // then a single rotated drawImage plus pointer/hub, so spin cost is
        // O(1) regardless of entrant count and idle cost is zero.
        // ------------------------------------------------------------------
        var WHEEL_LABEL_LIMIT = 60;     // labels + icons drawn up to this many entrants
        var WHEEL_MAX_SEGMENTS = 240;   // visual segments are capped at this

        var WHEEL_PLATFORM_COLORS = {
            'twitch': '#9146ff',
            'youtube': '#ff0000',
            'facebook': '#1877f2',
            'instagram': '#e4405f',
            'tiktok': '#444444',
            'discord': '#5865f2',
            'kick': '#53fc18'
        };

        function shadeColor(hex, percent) {
            var num = parseInt(hex.slice(1), 16);
            if (isNaN(num)) {
                return hex;
            }
            var r = (num >> 16) & 255;
            var g = (num >> 8) & 255;
            var b = num & 255;
            var t = percent < 0 ? 0 : 255;
            var p = Math.abs(percent) / 100;
            r = Math.round((t - r) * p) + r;
            g = Math.round((t - g) * p) + g;
            b = Math.round((t - b) * p) + b;
            return 'rgb(' + r + ',' + g + ',' + b + ')';
        }

        function createWheelRenderer(canvas, options) {
            var ctx = canvas.getContext('2d');
            var cache = document.createElement('canvas');
            var cctx = cache.getContext('2d');
            var rotation = 0;
            var theme = options.theme || resolveTheme('classic');
            var rebuildTimer = null;
            var dirty = true;
            var hasContent = false;
            var spinning = false;
            var iconCache = {};
            var iconPending = {};

            function loadIcon(platform) {
                var key = String(platform || '').toLowerCase();
                if (!key || (key in iconCache) || iconPending[key]) {
                    return;
                }
                iconPending[key] = true;
                var img = new Image();
                img.onload = function () {
                    iconCache[key] = img;
                    delete iconPending[key];
                    markDirty(150);
                };
                img.onerror = function () {
                    iconCache[key] = null;
                    delete iconPending[key];
                };
                img.src = './sources/images/' + key + '.png';
            }

            function segmentColor(platform, index) {
                if (theme.usePlatformColors && platform) {
                    var c = WHEEL_PLATFORM_COLORS[String(platform).toLowerCase()];
                    if (c) {
                        return c;
                    }
                }
                return theme.palette[index % theme.palette.length];
            }

            function rebuildNow() {
                dirty = false;
                var w = canvas.width;
                var h = canvas.height;
                if (cache.width !== w || cache.height !== h) {
                    cache.width = w;
                    cache.height = h;
                }
                cctx.clearRect(0, 0, w, h);

                var list = options.getEntrants();
                var total = list.length;
                hasContent = total > 0;
                if (!hasContent) {
                    render();
                    return;
                }

                var cx = w / 2;
                var cy = h / 2;
                var radius = Math.min(cx, cy) - 20;
                var segments = Math.min(total, WHEEL_MAX_SEGMENTS);
                var detailed = total <= WHEEL_LABEL_LIMIT;
                var angle = (2 * Math.PI) / segments;

                // Base disc with a symmetric soft shadow (rotation-invariant,
                // so it can be baked into the cached bitmap).
                cctx.save();
                cctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                cctx.shadowBlur = 18;
                cctx.beginPath();
                cctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                cctx.fillStyle = theme.rim;
                cctx.fill();
                cctx.restore();

                for (var i = 0; i < segments; i++) {
                    var entrant = list[i];
                    var startAngle = i * angle;
                    var endAngle = startAngle + angle;
                    var color = segmentColor(entrant ? entrant.platform : null, i);

                    cctx.beginPath();
                    cctx.moveTo(cx, cy);
                    cctx.arc(cx, cy, radius, startAngle, endAngle);
                    cctx.closePath();

                    if (detailed) {
                        var midAngle = startAngle + angle / 2;
                        var gx = cx + Math.cos(midAngle) * radius * 0.3;
                        var gy = cy + Math.sin(midAngle) * radius * 0.3;
                        var gradient = cctx.createRadialGradient(gx, gy, 0, cx, cy, radius);
                        gradient.addColorStop(0, shadeColor(color, 18));
                        gradient.addColorStop(0.7, color);
                        gradient.addColorStop(1, shadeColor(color, -18));
                        cctx.fillStyle = gradient;
                    } else {
                        cctx.fillStyle = color;
                    }
                    cctx.fill();
                    cctx.strokeStyle = theme.segmentStroke;
                    cctx.lineWidth = detailed ? 3 : 1;
                    cctx.stroke();
                }

                if (detailed) {
                    cctx.textAlign = 'center';
                    cctx.textBaseline = 'middle';
                    var maxTextWidth = radius * 0.5;
                    for (var j = 0; j < segments; j++) {
                        var person = list[j];
                        if (!person) {
                            continue;
                        }
                        cctx.save();
                        cctx.translate(cx, cy);
                        cctx.rotate(j * angle + angle / 2);

                        var textX = radius - 60;
                        cctx.fillStyle = theme.labelColor;
                        cctx.font = '600 ' + Math.max(12, Math.min(20, Math.round(360 / segments) + 8)) + 'px "Segoe UI", system-ui, sans-serif';
                        cctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                        cctx.shadowBlur = 6;
                        cctx.shadowOffsetY = 2;

                        var displayText = person.name || 'Anonymous';
                        if (cctx.measureText(displayText).width > maxTextWidth) {
                            while (displayText.length > 1 && cctx.measureText(displayText + '…').width > maxTextWidth) {
                                displayText = displayText.slice(0, -1);
                            }
                            displayText += '…';
                        }
                        cctx.fillText(displayText, textX, segments > 24 ? 0 : -15);

                        if (segments <= 24 && person.platform) {
                            var icon = iconCache[String(person.platform).toLowerCase()];
                            if (icon) {
                                var iconSize = 24;
                                cctx.shadowColor = 'transparent';
                                cctx.beginPath();
                                cctx.arc(textX, 8 + iconSize / 2, iconSize / 2 + 4, 0, 2 * Math.PI);
                                cctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                                cctx.fill();
                                cctx.drawImage(icon, textX - iconSize / 2, 8, iconSize, iconSize);
                            }
                        }
                        cctx.restore();
                    }
                }

                render();
            }

            function markDirty(delay) {
                dirty = true;
                if (spinning) {
                    return; // rebuilt once the spin finishes
                }
                if (rebuildTimer) {
                    return;
                }
                rebuildTimer = setTimeout(function () {
                    rebuildTimer = null;
                    if (dirty && !spinning) {
                        rebuildNow();
                    }
                }, typeof delay === 'number' ? delay : 250);
            }

            function drawHub(c, cx, cy) {
                var hubRadius = Math.max(16, canvas.width * 0.0625);
                var hubGradient = c.createRadialGradient(cx, cy - 5, 0, cx, cy, hubRadius);
                hubGradient.addColorStop(0, theme.hub[0]);
                hubGradient.addColorStop(0.7, theme.hub[1]);
                hubGradient.addColorStop(1, theme.hub[2]);
                c.beginPath();
                c.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
                c.fillStyle = hubGradient;
                c.fill();
                c.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                c.lineWidth = 2;
                c.stroke();
            }

            function drawPointer(c, cx, cy, radius) {
                var pointerLength = Math.max(26, canvas.width * 0.1);
                var pointerWidth = pointerLength / 2;
                c.beginPath();
                c.moveTo(cx + radius - 5, cy);
                c.lineTo(cx + radius - pointerLength, cy - pointerWidth / 2);
                c.lineTo(cx + radius - pointerLength, cy + pointerWidth / 2);
                c.closePath();
                var grad = c.createLinearGradient(cx + radius - pointerLength, cy, cx + radius - 5, cy);
                grad.addColorStop(0, theme.pointer[0]);
                grad.addColorStop(0.5, theme.pointer[1]);
                grad.addColorStop(1, theme.pointer[2]);
                c.fillStyle = grad;
                c.fill();
                c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                c.lineWidth = 2;
                c.stroke();
            }

            function render() {
                var w = canvas.width;
                var h = canvas.height;
                ctx.clearRect(0, 0, w, h);
                if (options.onEmptyChange) {
                    options.onEmptyChange(!hasContent);
                }
                if (!hasContent) {
                    return;
                }
                var cx = w / 2;
                var cy = h / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rotation);
                ctx.translate(-cx, -cy);
                ctx.drawImage(cache, 0, 0);
                ctx.restore();
                drawHub(ctx, cx, cy);
                drawPointer(ctx, cx, cy, Math.min(cx, cy) - 20);
            }

            return {
                invalidate: markDirty,
                rebuildNow: rebuildNow,
                render: render,
                ensureIcon: loadIcon,
                setTheme: function (nextTheme) {
                    theme = nextTheme;
                    markDirty(0);
                },
                setRotation: function (radians) {
                    rotation = radians;
                },
                getRotation: function () {
                    return rotation;
                },
                beginSpin: function () {
                    spinning = true;
                },
                endSpin: function () {
                    spinning = false;
                    if (dirty) {
                        markDirty(0);
                    }
                }
            };
        }

        function runSpinAnimation(renderer, spec, onDone) {
            var startTime = spec.startTime || Date.now();
            var duration = spec.duration || 4000;
            var fromDeg = spec.fromDeg || 0;
            var toDeg = spec.toDeg || 0;
            var delay = Math.max(0, startTime - Date.now());
            setTimeout(function () {
                renderer.beginSpin();
                var finished = false;
                function finish() {
                    if (finished) {
                        return;
                    }
                    finished = true;
                    renderer.setRotation((toDeg * Math.PI) / 180);
                    renderer.render();
                    renderer.endSpin();
                    if (onDone) {
                        onDone();
                    }
                }
                function step() {
                    if (finished) {
                        return;
                    }
                    var progress = Math.min((Date.now() - startTime) / duration, 1);
                    var eased = 1 - Math.pow(1 - progress, 3);
                    renderer.setRotation(((fromDeg + (toDeg - fromDeg) * eased) * Math.PI) / 180);
                    renderer.render();
                    if (progress < 1) {
                        requestAnimationFrame(step);
                    } else {
                        finish();
                    }
                }
                requestAnimationFrame(step);
                // rAF pauses in background tabs; guarantee completion regardless
                setTimeout(finish, duration + 150);
            }, delay);
        }

        // Confetti via the Web Animations API (compositor-only transform and
        // opacity; nodes remove themselves when finished).
        function launchConfetti(colors) {
            var count = 90;
            var fragment = document.createDocumentFragment();
            var height = window.innerHeight + 60;
            for (var i = 0; i < count; i++) {
                var el = document.createElement('div');
                el.className = 'confetti';
                var size = 6 + Math.random() * 8;
                el.style.width = size + 'px';
                el.style.height = (size * 0.6) + 'px';
                el.style.background = colors[i % colors.length];
                el.style.left = (Math.random() * 100) + 'vw';
                el.style.top = '-20px';
                if (i % 3 === 0) {
                    el.style.borderRadius = '50%';
                }
                fragment.appendChild(el);
                (function (node) {
                    var drift = (Math.random() * 2 - 1) * 160;
                    var rot = 360 + Math.random() * 720;
                    var anim = node.animate([
                        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
                        { transform: 'translate(' + drift + 'px, ' + height + 'px) rotate(' + rot + 'deg)', opacity: 0 }
                    ], {
                        duration: 2200 + Math.random() * 2200,
                        easing: 'cubic-bezier(0.2, 0.5, 0.4, 1)'
                    });
                    anim.onfinish = function () {
                        node.remove();
                    };
                })(el);
            }
            document.body.appendChild(fragment);
        }

        // ------------------------------------------------------------------
        // Dashboard state
        // ------------------------------------------------------------------
        var entrants = new Map();           // id -> { name, platform, timestamp }
        var winners = [];                   // latest first, capped
        var isSpinning = false;
        var currentKeyword = 'ENTER';
        var keywordLower = 'enter';
        var keywordRegex = null;
        var settings = {
            theme: 'classic',
            exactMatch: false,
            removeWinner: false,
            spinDuration: 4000
        };

        var MAX_RENDERED_ENTRANTS = 250;
        var MAX_WINNER_HISTORY = 50;
        var UI_TICK_DELAY = 150;
        var BROADCAST_DELAY = 200;
        var SAVE_DELAY = 2000;

        // Batching queues — keeps 500 msg/s ingestion off the DOM/layout path
        var pendingRows = [];               // ids added since last UI tick
        var pendingBroadcast = {};          // id -> entrant awaiting broadcast
        var pendingBroadcastCount = 0;
        var needsListRebuild = false;
        var uiTimer = null;
        var broadcastTimer = null;
        var saveTimer = null;
        var renderedRowCount = 0;

        // Entry-rate tracking: 60 one-second buckets
        var rateBuckets = new Array(60);
        var rateLastSec = Math.floor(Date.now() / 1000);
        for (var rb = 0; rb < 60; rb++) {
            rateBuckets[rb] = 0;
        }
        function advanceRateBuckets() {
            var sec = Math.floor(Date.now() / 1000);
            if (sec !== rateLastSec) {
                var gap = Math.min(60, sec - rateLastSec);
                for (var i = 1; i <= gap; i++) {
                    rateBuckets[(rateLastSec + i) % 60] = 0;
                }
                rateLastSec = sec;
            }
        }
        function ratePerMinute() {
            advanceRateBuckets();
            var sum = 0;
            for (var i = 0; i < 60; i++) {
                sum += rateBuckets[i];
            }
            return sum;
        }

        var canvas = document.getElementById('wheel-canvas');
        var wheelBox = document.getElementById('wheel-box');
        var wheelEmptyEl = document.getElementById('wheel-empty');
        var entrantsContainer = document.getElementById('entrants-container');
        var entrantsSummary = document.getElementById('entrants-summary');

        var wheel = createWheelRenderer(canvas, {
            theme: resolveTheme(settings.theme),
            getEntrants: function () {
                return Array.from(entrants.values());
            },
            onEmptyChange: function (isEmpty) {
                wheelEmptyEl.style.display = isEmpty ? 'flex' : 'none';
            }
        });

        function syncCanvasSize() {
            var size = Math.round(wheelBox.clientWidth) || 400;
            if (canvas.width !== size) {
                canvas.width = size;
                canvas.height = size;
                return true;
            }
            return false;
        }

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            if (resizeTimer) {
                clearTimeout(resizeTimer);
            }
            resizeTimer = setTimeout(function () {
                resizeTimer = null;
                if (syncCanvasSize()) {
                    wheel.rebuildNow();
                }
            }, 200);
        });

        function entrantRebuildDelay() {
            return entrants.size > 1000 ? 1000 : 300;
        }

        // ------------------------------------------------------------------
        // Keyword
        // ------------------------------------------------------------------
        function escapeRegExp(s) {
            return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function compileKeyword() {
            keywordLower = currentKeyword.toLowerCase();
            try {
                keywordRegex = new RegExp('(?:^|[^\\w])' + escapeRegExp(keywordLower) + '(?:$|[^\\w])');
            } catch (e) {
                keywordRegex = null;
            }
        }

        function setKeyword() {
            var input = document.getElementById('keyword-input');
            var next = input.value.trim().toUpperCase();
            if (!next) {
                return;
            }
            currentKeyword = next;
            compileKeyword();
            document.getElementById('current-keyword').textContent = currentKeyword;
            try {
                localStorage.setItem('giveaway_keyword_' + JSON.stringify([roomID, password]), currentKeyword);
            } catch (e) {}
            sendGiveawayMessage({ action: 'keyword_update', keyword: currentKeyword, timestamp: Date.now() });
            input.value = '';
        }

        function handleKeywordUpdate(keyword) {
            if (keyword) {
                currentKeyword = keyword;
                compileKeyword();
                document.getElementById('current-keyword').textContent = currentKeyword;
                try {
                    localStorage.setItem('giveaway_keyword_' + JSON.stringify([roomID, password]), currentKeyword);
                } catch (e) {}
            }
        }

        // ------------------------------------------------------------------
        // Message ingestion — hot path; designed for hundreds of messages/sec
        // ------------------------------------------------------------------
        function processGiveawayMessage(data) {
            if (!data || typeof data !== 'object') {
                return;
            }
            if (data.bot || data.reflection || data.replay || data.history || data.reload || data.private || data.event || isSpinning) return;
            var msg = data.chatmessage;
            if (typeof msg !== 'string' || !msg) {
                return;
            }
            var lower = msg.toLowerCase();
            if (settings.exactMatch && keywordRegex) {
                if (lower.trim() !== keywordLower) {
                    return;
                }
            } else if (lower.indexOf(keywordLower) === -1) {
                return;
            }
            var name = data.chatname || 'Unknown User';
            var platform = data.type || 'unknown';
            var id = JSON.stringify([platform, String(data.userid || data.username || name).toLowerCase()]);
            if (entrants.has(id)) {
                return;
            }
            var entrant = { name: name, platform: platform, timestamp: Date.now() };
            addLocalEntrant(id, entrant);
        }

        function addLocalEntrant(id, entrant) {
            entrants.set(id, entrant);
            if (entrants.size <= WHEEL_LABEL_LIMIT) {
                wheel.ensureIcon(entrant.platform);
            }
            advanceRateBuckets();
            rateBuckets[rateLastSec % 60]++;
            pendingRows.push(id);
            pendingBroadcast[id] = entrant;
            pendingBroadcastCount++;
            scheduleUiTick();
            scheduleBroadcast();
            scheduleSave();
            wheel.invalidate(entrantRebuildDelay());
        }

        function addRemoteEntrants(obj) {
            if (!obj) {
                return;
            }
            var keys = Object.keys(obj);
            var changed = false;
            for (var i = 0; i < keys.length; i++) {
                var id = keys[i];
                if (!entrants.has(id) && obj[id]) {
                    entrants.set(id, obj[id]);
                    if (entrants.size <= WHEEL_LABEL_LIMIT) {
                        wheel.ensureIcon(obj[id].platform);
                    }
                    pendingRows.push(id);
                    changed = true;
                }
            }
            if (changed) {
                scheduleUiTick();
                scheduleSave();
                wheel.invalidate(entrantRebuildDelay());
            }
        }

        // ------------------------------------------------------------------
        // Batched UI updates
        // ------------------------------------------------------------------
        function scheduleUiTick() {
            if (uiTimer) {
                return;
            }
            uiTimer = setTimeout(uiTick, UI_TICK_DELAY);
        }

        function uiTick() {
            uiTimer = null;
            updateStats();
            if (needsListRebuild) {
                needsListRebuild = false;
                pendingRows.length = 0;
                rebuildEntrantList();
            } else if (pendingRows.length) {
                appendPendingRows();
            }
            // Keep the rate display decaying after the flood stops
            if (!uiTimer && ratePerMinute() > 0) {
                uiTimer = setTimeout(uiTick, 1000);
            }
        }

        function updateStats() {
            document.getElementById('entrant-count').textContent = entrants.size;
            document.getElementById('stats-total').textContent = entrants.size;
            document.getElementById('stats-rate').textContent = ratePerMinute();
        }

        function buildRow(id, entrant) {
            var row = document.createElement('div');
            row.className = 'entrant-row';
            row.setAttribute('data-id', id);
            var info = document.createElement('span');
            info.className = 'entrant-info';
            var nameSpan = document.createElement('span');
            nameSpan.className = 'entrant-name';
            nameSpan.textContent = entrant.name;
            var badge = document.createElement('span');
            badge.className = 'entrant-platform';
            badge.textContent = String(entrant.platform || '').toUpperCase();
            info.appendChild(nameSpan);
            info.appendChild(badge);
            var btn = document.createElement('button');
            btn.className = 'entrant-remove';
            btn.textContent = 'Remove';
            btn.onclick = function () {
                removeEntrant(id);
            };
            row.appendChild(info);
            row.appendChild(btn);
            return row;
        }

        function updateSummaryLine() {
            var hidden = entrants.size - renderedRowCount;
            if (hidden > 0) {
                entrantsSummary.textContent = 'Showing latest ' + renderedRowCount + ' of ' + entrants.size + ' participants';
                entrantsSummary.style.display = 'block';
            } else {
                entrantsSummary.style.display = 'none';
            }
        }

        function appendPendingRows() {
            var ids = pendingRows;
            pendingRows = [];
            // If far more arrived than we can show, skip straight to a rebuild
            if (ids.length > MAX_RENDERED_ENTRANTS) {
                rebuildEntrantList();
                return;
            }
            var fragment = document.createDocumentFragment();
            for (var i = 0; i < ids.length; i++) {
                var entrant = entrants.get(ids[i]);
                if (entrant) {
                    fragment.appendChild(buildRow(ids[i], entrant));
                    renderedRowCount++;
                }
            }
            entrantsContainer.appendChild(fragment);
            while (renderedRowCount > MAX_RENDERED_ENTRANTS && entrantsContainer.firstChild) {
                entrantsContainer.removeChild(entrantsContainer.firstChild);
                renderedRowCount--;
            }
            updateSummaryLine();
        }

        function rebuildEntrantList() {
            entrantsContainer.textContent = '';
            renderedRowCount = 0;
            var ids = Array.from(entrants.keys());
            var start = Math.max(0, ids.length - MAX_RENDERED_ENTRANTS);
            var fragment = document.createDocumentFragment();
            for (var i = start; i < ids.length; i++) {
                var entrant = entrants.get(ids[i]);
                if (entrant) {
                    fragment.appendChild(buildRow(ids[i], entrant));
                    renderedRowCount++;
                }
            }
            entrantsContainer.appendChild(fragment);
            updateSummaryLine();
            updateStats();
        }

        // ------------------------------------------------------------------
        // Broadcast batching + persistence
        // ------------------------------------------------------------------
        function scheduleBroadcast() {
            if (broadcastTimer) {
                return;
            }
            broadcastTimer = setTimeout(flushBroadcast, BROADCAST_DELAY);
        }

        function flushBroadcast() {
            if (broadcastTimer) {
                clearTimeout(broadcastTimer);
                broadcastTimer = null;
            }
            if (!pendingBroadcastCount) {
                return;
            }
            var batch = pendingBroadcast;
            pendingBroadcast = {};
            pendingBroadcastCount = 0;
            sendGiveawayMessage({
                action: 'entrants_update',
                data: { entrants: batch },
                timestamp: Date.now()
            });
        }

        function scheduleSave() {
            if (saveTimer) {
                return;
            }
            saveTimer = setTimeout(saveNow, SAVE_DELAY);
        }

        function saveNow() {
            if (saveTimer) {
                clearTimeout(saveTimer);
                saveTimer = null;
            }
            try {
                localStorage.setItem('giveawayWheelState_' + JSON.stringify([roomID, password]), JSON.stringify({ entrants: buildEntrantsObject(), timestamp: Date.now() }));
            } catch (e) {
                dbg('saveNow failed', e);
            }
        }

        function buildEntrantsObject() {
            var obj = {};
            entrants.forEach(function (value, key) {
                obj[key] = value;
            });
            return obj;
        }

        function setEntrantsFromObject(obj) {
            entrants = new Map();
            if (obj) {
                var keys = Object.keys(obj);
                for (var i = 0; i < keys.length; i++) {
                    if (obj[keys[i]]) {
                        entrants.set(keys[i], obj[keys[i]]);
                        if (entrants.size <= WHEEL_LABEL_LIMIT) {
                            wheel.ensureIcon(obj[keys[i]].platform);
                        }
                    }
                }
            }
        }

        function broadcastFullGiveawayState() {
            sendGiveawayMessage({
                action: 'giveaway_update',
                data: { entrants: buildEntrantsObject(), timestamp: Date.now() },
                timestamp: Date.now()
            });
            sendGiveawayMessage({ action: 'keyword_update', keyword: currentKeyword, timestamp: Date.now() });
            sendGiveawayMessage({ action: 'style_update', style: settings.theme, timestamp: Date.now() });
        }

        function flushPendingWork() {
            if (uiTimer) {
                clearTimeout(uiTimer);
                uiTimer = null;
            }
            updateStats();
            if (needsListRebuild) {
                needsListRebuild = false;
                pendingRows.length = 0;
                rebuildEntrantList();
            } else if (pendingRows.length) {
                appendPendingRows();
            }
            flushBroadcast();
            saveNow();
            wheel.rebuildNow();
        }

        // ------------------------------------------------------------------
        // Transports: BroadcastChannel, VDO.Ninja iframe bridge, WebSocket
        // ------------------------------------------------------------------
        var iframe = null;
        var giveawayChannel = null;
        var socketserver = null;
        var socketRetries = 1;

        function handleGiveawayPayload(data) {
            if (!data || typeof data !== 'object') {
                return;
            }
            if (data.action === 'giveaway_update') {
                handleGiveawayUpdate(data.data);
            } else if (data.action === 'entrants_update') {
                if (data.data) {
                    addRemoteEntrants(data.data.entrants);
                }
            } else if (data.action === 'entrant_remove') {
                if (data.data && data.data.ids) {
                    handleRemoteRemove(data.data.ids);
                }
            } else if (data.action === 'keyword_update') {
                handleKeywordUpdate(data.keyword);
            } else if (data.action === 'spin_update') {
                handleSpinUpdate(data.data);
            } else if (data.action === 'winner_update') {
                handleWinnerUpdate(data.data);
            } else if (data.action === 'style_update') {
                // Sent by this page; ignore on receive
            } else if (data.action === 'giveaway_state_request') {
                broadcastFullGiveawayState();
            } else {
                processGiveawayMessage(data);
            }
        }

        function setupLocalCommunication() {
            if (typeof BroadcastChannel !== 'undefined') {
                giveawayChannel = new BroadcastChannel('giveaway_' + JSON.stringify([roomID, password]));
                giveawayChannel.addEventListener('message', function (event) {
                    handleGiveawayPayload(event.data);
                });
            } else {
                window.addEventListener('storage', function (e) {
                    if (e.key === 'giveaway_broadcast_' + JSON.stringify([roomID, password]) && e.newValue) {
                        try {
                            handleGiveawayPayload(JSON.parse(e.newValue));
                        } catch (error) {}
                    }
                });
            }
        }

        function setupWebRTCConnection() {
            setupLocalCommunication();
            if (!roomID || roomID === "test") {
                dbg("Test session - local communication only");
                return;
            }
            iframe = document.createElement('iframe');
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.position = "fixed";
            iframe.style.left = "-100px";
            iframe.style.top = "-100px";
            iframe.id = "frame1";
            iframe.allow = "midi;microphone;";
            iframe.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + encodeURIComponent(password) + "&push&label=dock&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=" + roomID;
            document.body.appendChild(iframe);

            window.addEventListener("message", function (e) {
                if (e.source !== iframe.contentWindow) {
                    return;
                }
                var d = e.data;
                if (d && typeof d === "object") {
                    if (d.dataReceived && typeof d.dataReceived === "object" && "overlayNinja" in d.dataReceived) {
                        handleGiveawayPayload(d.dataReceived.overlayNinja);
                    } else if (d.overlayNinja) {
                        handleGiveawayPayload(d.overlayNinja);
                    }
                }
            });
        }

        function setupSocket() {
            var serverURL = urlParams.has("localserver")
                ? SocialStreamLocalServer.getWebSocketUrl()
                : (urlParams.get("server") || "wss://io.socialstream.ninja/api");

            function connect() {
                socketserver = new WebSocket(serverURL);
                socketserver.onopen = function () {
                    socketRetries = 1;
                    // Giveaway communication: out 5, in 6
                    socketserver.send(JSON.stringify({ join: roomID.split(",")[0], out: 5, in: 6 }));
                };
                socketserver.onclose = function () {
                    socketRetries += 1;
                    setTimeout(connect, Math.min(100 * socketRetries, 5000));
                };
                socketserver.onerror = function () {
                    try {
                        socketserver.close();
                    } catch (e) {}
                };
                socketserver.addEventListener("message", function (event) {
                    if (event.data) {
                        try {
                            handleGiveawayPayload(JSON.parse(event.data));
                        } catch (e) {}
                    }
                });
            }
            connect();
        }

        function sendGiveawayMessage(message) {
            if (giveawayChannel) {
                giveawayChannel.postMessage(message);
            } else {
                try {
                    var key = 'giveaway_broadcast_' + JSON.stringify([roomID, password]);
                    localStorage.setItem(key, JSON.stringify(message));
                    setTimeout(function () {
                        localStorage.removeItem(key);
                    }, 100);
                } catch (e) {}
            }
            if (socketserver && socketserver.readyState === WebSocket.OPEN) {
                socketserver.send(JSON.stringify(message));
            }
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.postMessage({
                        sendData: { overlayNinja: message },
                        type: "rpcs"
                    }, '*');
                } catch (e) {}
            }
        }

        // ------------------------------------------------------------------
        // Entrant management
        // ------------------------------------------------------------------
        function addEntrant() {
            var nameInput = document.getElementById('entrant-name');
            var platformSelect = document.getElementById('platform-select');
            var name = nameInput.value.trim();
            if (!name) {
                alert('Please enter a participant name');
                return;
            }
            var id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            addLocalEntrant(id, { name: name, platform: platformSelect.value, timestamp: Date.now() });
            nameInput.value = '';
            flushPendingWork();
        }

        function addTestData() {
            var testEntrants = [
                { name: 'Alice', platform: 'twitch' },
                { name: 'Bob', platform: 'youtube' },
                { name: 'Charlie', platform: 'facebook' },
                { name: 'Diana', platform: 'instagram' },
                { name: 'Eve', platform: 'tiktok' },
                { name: 'Frank', platform: 'discord' },
                { name: 'Grace', platform: 'kick' }
            ];
            for (var i = 0; i < testEntrants.length; i++) {
                var id = 'test_' + Date.now() + '_' + i;
                testEntrants[i].timestamp = Date.now();
                addLocalEntrant(id, testEntrants[i]);
            }
            flushPendingWork();
        }

        function removeEntrant(id) {
            if (!entrants.delete(id)) {
                return;
            }
            var row = entrantsContainer.querySelector('[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')) + '"]');
            if (row) {
                row.remove();
                renderedRowCount--;
            }
            delete pendingBroadcast[id];
            updateSummaryLine();
            updateStats();
            wheel.invalidate(0);
            sendGiveawayMessage({ action: 'entrant_remove', data: { ids: [id] }, timestamp: Date.now() });
            scheduleSave();
        }

        function handleRemoteRemove(ids) {
            var changed = false;
            for (var i = 0; i < ids.length; i++) {
                if (entrants.delete(ids[i])) {
                    changed = true;
                }
            }
            if (changed) {
                needsListRebuild = true;
                scheduleUiTick();
                scheduleSave();
                wheel.invalidate(0);
            }
        }

        function clearEntrants() {
            if (!entrants.size) {
                return;
            }
            if (!confirm('Are you sure you want to clear all participants?')) {
                return;
            }
            clearAllEntries();
        }

        function clearAllEntries() {
            entrants = new Map();
            pendingRows.length = 0;
            pendingBroadcast = {};
            pendingBroadcastCount = 0;
            rebuildEntrantList();
            wheel.invalidate(0);
            sendGiveawayMessage({ action: 'giveaway_update', data: { entrants: {}, timestamp: Date.now() }, timestamp: Date.now() });
            saveNow();
        }

        function handleGiveawayUpdate(data) {
            if (data && data.entrants) {
                setEntrantsFromObject(data.entrants);
                pendingRows.length = 0;
                needsListRebuild = true;
                scheduleUiTick();
                scheduleSave();
                wheel.invalidate(entrantRebuildDelay());
            }
        }

        // ------------------------------------------------------------------
        // Spin + winners
        // ------------------------------------------------------------------
        function setSpinButtonBusy(busy) {
            var spinBtn = document.getElementById('spin-btn');
            spinBtn.disabled = busy;
            spinBtn.textContent = busy ? '🌀 Spinning...' : '🎯 Spin the Wheel!';
        }

        function spinWheel() {
            if (isSpinning) {
                return;
            }
            flushPendingWork();
            if (!entrants.size) {
                alert('Please add some participants first!');
                return;
            }
            var ids = Array.from(entrants.keys());
            var randomValue = new Uint32Array(1);
            var randomLimit = 4294967296 - (4294967296 % ids.length);
            do { window.crypto.getRandomValues(randomValue); } while (randomValue[0] >= randomLimit);
            var winnerIndex = randomValue[0] % ids.length;
            var winnerId = ids[winnerIndex];
            var winner = entrants.get(winnerId);
            if (!winner) {
                return;
            }

            isSpinning = true;
            setSpinButtonBusy(true);
            document.getElementById('winner-display').style.display = 'none';

            var visualCount = Math.min(ids.length, WHEEL_MAX_SEGMENTS);
            var visualWinnerIndex = winnerIndex % visualCount;
            var segmentAngle = 360 / visualCount;
            var winnerSegmentCenter = visualWinnerIndex * segmentAngle + segmentAngle / 2;
            var totalRotation = 360 * 5 + (360 - winnerSegmentCenter);
            var duration = settings.spinDuration || 4000;
            var startTime = Date.now() + 200;

            wheel.setRotation(0);
            wheel.render();

            sendGiveawayMessage({
                action: 'spin_update',
                data: {
                    isSpinning: true,
                    targetRotation: (totalRotation * Math.PI) / 180,
                    targetRotationDegrees: totalRotation,
                    duration: duration,
                    winnerIndex: winnerIndex,
                    startTime: startTime,
                    initialRotation: 0,
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            });

            runSpinAnimation(wheel, {
                startTime: startTime,
                duration: duration,
                fromDeg: 0,
                toDeg: totalRotation
            }, function () {
                isSpinning = false;
                setSpinButtonBusy(false);
                announceWinner(winnerId, winner);
                sendGiveawayMessage({ action: 'spin_update', data: { isSpinning: false, timestamp: Date.now() }, timestamp: Date.now() });
            });
        }

        function announceWinner(winnerId, winner) {
            var winnerDisplay = document.getElementById('winner-display');
            winnerDisplay.textContent = '';
            var label = document.createElement('span');
            label.textContent = '🎉 Winner: ' + winner.name;
            winnerDisplay.appendChild(label);
            if (winner.platform) {
                var badge = document.createElement('span');
                badge.className = 'winner-platform';
                badge.style.marginLeft = '10px';
                badge.textContent = String(winner.platform).toUpperCase();
                winnerDisplay.appendChild(badge);
            }
            winnerDisplay.style.display = 'block';

            launchConfetti(resolveTheme(settings.theme).palette);

            sendGiveawayMessage({
                action: 'winner_update',
                data: { name: winner.name, platform: winner.platform, timestamp: Date.now() },
                timestamp: Date.now()
            });

            addWinnerToHistory(winner);

            if (settings.removeWinner && winnerId) {
                removeEntrant(winnerId);
            }
            saveNow();
        }

        function handleSpinUpdate(spinData) {
            if (!spinData || !spinData.isSpinning || isSpinning || !entrants.size) {
                return;
            }
            isSpinning = true;
            setSpinButtonBusy(true);
            var initialDeg = spinData.initialRotation || 0;
            var targetDeg = (spinData.targetRotationDegrees !== undefined && spinData.targetRotationDegrees !== null)
                ? spinData.targetRotationDegrees
                : ((spinData.targetRotation || 0) * 180 / Math.PI);
            wheel.setRotation((initialDeg * Math.PI) / 180);
            wheel.render();
            runSpinAnimation(wheel, {
                startTime: spinData.startTime,
                duration: spinData.duration || 4000,
                fromDeg: initialDeg,
                toDeg: targetDeg
            }, function () {
                isSpinning = false;
                setSpinButtonBusy(false);
            });
        }

        function handleWinnerUpdate(winnerData) {
            if (!winnerData || !winnerData.name) {
                return;
            }
            var winnerDisplay = document.getElementById('winner-display');
            winnerDisplay.textContent = '🎉 Winner: ' + winnerData.name;
            winnerDisplay.style.display = 'block';
            launchConfetti(resolveTheme(settings.theme).palette);
        }

        function addWinnerToHistory(winner) {
            winners.unshift({ name: winner.name, platform: winner.platform, time: Date.now() });
            if (winners.length > MAX_WINNER_HISTORY) {
                winners.length = MAX_WINNER_HISTORY;
            }
            renderWinners();
            try {
                localStorage.setItem('giveaway_winners_' + JSON.stringify([roomID, password]), JSON.stringify(winners));
            } catch (e) {}
        }

        function renderWinners() {
            var container = document.getElementById('winners-container');
            container.textContent = '';
            var fragment = document.createDocumentFragment();
            for (var i = 0; i < winners.length; i++) {
                var row = document.createElement('div');
                row.className = 'winner-row';
                var info = document.createElement('span');
                info.className = 'entrant-info';
                var nameSpan = document.createElement('span');
                nameSpan.className = 'winner-name';
                nameSpan.textContent = winners[i].name;
                info.appendChild(nameSpan);
                if (winners[i].platform) {
                    var badge = document.createElement('span');
                    badge.className = 'winner-platform';
                    badge.textContent = String(winners[i].platform).toUpperCase();
                    info.appendChild(badge);
                }
                var time = document.createElement('span');
                time.className = 'winner-time';
                time.textContent = new Date(winners[i].time).toLocaleTimeString();
                row.appendChild(info);
                row.appendChild(time);
                fragment.appendChild(row);
            }
            container.appendChild(fragment);
        }

        function clearWinners() {
            winners = [];
            renderWinners();
            try {
                localStorage.removeItem('giveaway_winners_' + JSON.stringify([roomID, password]));
            } catch (e) {}
        }

        // ------------------------------------------------------------------
        // Theme + settings
        // ------------------------------------------------------------------
        function setTheme(name) {
            settings.theme = GIVEAWAY_THEMES[name] ? name : 'classic';
            document.body.setAttribute('data-theme', settings.theme);
            document.getElementById('theme-select').value = settings.theme;
            wheel.setTheme(resolveTheme(settings.theme));
            saveSettings();
            sendGiveawayMessage({ action: 'style_update', style: settings.theme, timestamp: Date.now() });
        }

        function saveSettings() {
            settings.exactMatch = document.getElementById('exact-match').checked;
            settings.removeWinner = document.getElementById('remove-winner').checked;
            settings.spinDuration = parseInt(document.getElementById('spin-duration').value, 10) || 4000;
            try {
                localStorage.setItem('giveaway_settings_' + JSON.stringify([roomID, password]), JSON.stringify(settings));
            } catch (e) {}
        }

        function loadSettings() {
            try {
                var saved = localStorage.getItem('giveaway_settings_' + JSON.stringify([roomID, password]));
                if (saved) {
                    var parsed = JSON.parse(saved);
                    if (parsed && typeof parsed === 'object') {
                        settings.theme = GIVEAWAY_THEMES[parsed.theme] ? parsed.theme : 'classic';
                        settings.exactMatch = !!parsed.exactMatch;
                        settings.removeWinner = !!parsed.removeWinner;
                        settings.spinDuration = parseInt(parsed.spinDuration, 10) || 4000;
                    }
                }
            } catch (e) {}
            document.body.setAttribute('data-theme', settings.theme);
            document.getElementById('theme-select').value = settings.theme;
            document.getElementById('exact-match').checked = settings.exactMatch;
            document.getElementById('remove-winner').checked = settings.removeWinner;
            document.getElementById('spin-duration').value = String(settings.spinDuration);
            wheel.setTheme(resolveTheme(settings.theme));
        }

        // ------------------------------------------------------------------
        // OBS widget launcher
        // ------------------------------------------------------------------
        function openOBSWidget() {
            var obsUrl = window.location.origin + window.location.pathname.replace('giveaway.html', 'giveaway-obs-entries.html')
                + '?session=' + encodeURIComponent(roomID)
                + '&password=' + encodeURIComponent(password)
                + '&style=' + encodeURIComponent(settings.theme);
            window.open(obsUrl, '_blank', 'width=800,height=600');

            // Give the widget a moment to attach its listeners, then sync state
            setTimeout(function () {
                broadcastFullGiveawayState();
            }, 1000);
        }

        // ------------------------------------------------------------------
        // Testing helpers
        // ------------------------------------------------------------------
        function testSocialStreamMessage() {
            var testPlatforms = ['twitch', 'youtube', 'discord', 'kick', 'facebook'];
            var testUsers = ['TestUser1', 'TestUser2', 'StreamViewer', 'ChatFan', 'GiveawayLover'];
            processGiveawayMessage({
                chatname: testUsers[Math.floor(Math.random() * testUsers.length)] + Date.now(),
                chatmessage: currentKeyword + ' please! I want to win!',
                type: testPlatforms[Math.floor(Math.random() * testPlatforms.length)],
                id: Date.now(),
                timestamp: Date.now()
            });
        }

        // Synthetic load generator: giveawayStressTest(500, 10) injects
        // 500 messages/second for 10 seconds from the console.
        window.giveawayStressTest = function (rate, seconds) {
            rate = rate || 500;
            seconds = seconds || 10;
            var platforms = ['twitch', 'youtube', 'kick', 'discord', 'facebook'];
            var total = rate * seconds;
            var perTick = Math.max(1, Math.round(rate / 20));
            var sent = 0;
            var started = performance.now();
            var timer = setInterval(function () {
                for (var i = 0; i < perTick && sent < total; i++, sent++) {
                    processGiveawayMessage({
                        chatname: 'stress_' + sent,
                        chatmessage: (sent % 3 === 0 ? currentKeyword + ' let me win!' : 'just chatting away here'),
                        type: platforms[sent % platforms.length]
                    });
                }
                if (sent >= total) {
                    clearInterval(timer);
                    console.warn('giveawayStressTest: injected ' + sent + ' messages in ' + Math.round(performance.now() - started) + 'ms; entrants=' + entrants.size);
                }
            }, 50);
        };

        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                testSocialStreamMessage();
            }
        });

        document.getElementById('entrant-name').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                addEntrant();
            }
        });

        document.getElementById('keyword-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                setKeyword();
            }
        });

        // ------------------------------------------------------------------
        // Init
        // ------------------------------------------------------------------
        (function init() {
            if (urlParams.has("managed")) { startManagedGiveaway(); return; }
            loadSettings();
            try {
                var savedKeyword = localStorage.getItem('giveaway_keyword_' + JSON.stringify([roomID, password]));
                if (savedKeyword) {
                    currentKeyword = savedKeyword;
                    document.getElementById('current-keyword').textContent = currentKeyword;
                }
            } catch (e) {}
            compileKeyword();

            try {
                var savedState = localStorage.getItem('giveawayWheelState_' + JSON.stringify([roomID, password]));
                if (savedState) {
                    var state = JSON.parse(savedState);
                    if (state && state.entrants) {
                        setEntrantsFromObject(state.entrants);
                    }
                }
            } catch (e) {}

            try {
                var savedWinners = localStorage.getItem('giveaway_winners_' + JSON.stringify([roomID, password]));
                if (savedWinners) {
                    var parsedWinners = JSON.parse(savedWinners);
                    if (Array.isArray(parsedWinners)) {
                        winners = parsedWinners.slice(0, MAX_WINNER_HISTORY);
                    }
                }
            } catch (e) {}

            syncCanvasSize();
            rebuildEntrantList();
            renderWinners();
            wheel.rebuildNow();

            setupWebRTCConnection();
            if (urlParams.has("server") || urlParams.has("localserver")) {
                setupSocket();
            }
        })();
