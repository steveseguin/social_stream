(function (root) {
    'use strict';
    // Running stream totals, tally counters and a subathon clock for overlays.
    // No DOM access: storage, the clock and USD conversion are passed in so this stays testable.
    var GIFT_EVENTS = ['subscription_gift', 'giftpurchase', 'gift_subscription'];
    var SUB_EVENTS = ['new_subscriber', 'subscribe', 'subscribed', 'sponsorship', 'subscription', 'newmember', 'new_member', 'resub', 'membershiprenewal', 'renewed_member', 'membermilestone', 'member_milestone'];
    var FOLLOW_EVENTS = ['new_follower', 'follow', 'followed'];
    var DEDUPE_MS = 8000;
    var VIEWER_ADD_COOLDOWN_MS = 5000;
    var MAX_TALLY_NAMES = 300;
    var MAX_COUNT = 1e12;

    function localDay(ms) {
        var date = new Date(ms);
        return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    }
    function total(value) {
        var number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : 0;
    }
    // Some sources spell these with hyphens, such as StreamElements' new-subscriber.
    function eventOf(data) {
        return data.event ? String(data.event).toLowerCase().replace(/-/g, '_') : '';
    }
    function metaOf(data) {
        return data.meta && typeof data.meta === 'object' ? data.meta : {};
    }
    function readJson(storage, key) {
        try {
            return (storage && JSON.parse(storage.getItem(key) || 'null')) || null;
        } catch (error) {
            return null;
        }
    }
    function writeJson(storage, key, value) {
        if (!storage) return;
        try { storage.setItem(key, JSON.stringify(value)); } catch (error) {}
    }
    function giftCount(data, meta) {
        var direct = [data.total, data.count, data.quantity, data.giftCount, data.totalGifted,
            meta.total, meta.count, meta.quantity, meta.giftCount, meta.totalGifted].map(total).filter(Boolean)[0];
        if (direct) return Math.round(direct);
        var text = [data.hasDonation, data.chatmessage, data.subtitle].filter(Boolean).join(' ');
        // Twitch IRC follows a mass-gift notice with one notice per recipient, and those are what get counted.
        if (/\bis gifting\s+\d+/i.test(text)) return 0;
        // Digits in a name ("Bob2000 gifted"), a sub tier, or the gifter's lifetime total say nothing about this gift.
        var name = String(data.chatname || '');
        if (name) text = text.split(name).join(' ');
        text = text.replace(/\bthey(?:'ve| have)\b[^.!]*[.!]?/ig, ' ').replace(/\btier\s*\d+/ig, ' ');
        var match = text.match(/\b(?:gifted|sent|bought|purchased)\s+(\d+)\b/i) ||
            text.match(/\b(\d+)\s*(?:x|gifted|gifts|gift|subs|memberships|members)\b/i);
        return match && parseInt(match[1], 10) > 0 ? parseInt(match[1], 10) : 1;
    }
    function raiderCount(data, meta) {
        var direct = total(meta.viewers || meta.numRaiders || data.viewers);
        if (direct) return direct;
        // Twitch IRC only states the size in its notice text.
        var match = String(data.chatmessage || '').match(/\b(\d[\d,]*)\s+(?:viewers|raiders)\b/i);
        return match ? total(match[1].replace(/,/g, '')) : 0;
    }
    function bitCount(data, meta) {
        var direct = total(meta.bits);
        if (direct) return Math.round(direct);
        var match = String(data.hasDonation || '').match(/(\d[\d,.]*)\s*bits?\b/i);
        return match ? Math.round(total(match[1].replace(/,/g, ''))) : 0;
    }
    function tierOf(data, meta) {
        var raw = String(data.tier || meta.tier || '').toLowerCase();
        if (/^(3|3000|tier ?3)$/.test(raw)) return 3;
        if (/^(2|2000|tier ?2)$/.test(raw)) return 2;
        if (!raw) {
            // Twitch IRC only states the tier in its notice text.
            var notice = String(data.chatmessage || '').match(/\btier\s*([23])\b/i);
            if (notice) return Number(notice[1]);
        }
        return 1;
    }
    // What a payload is worth, whichever overlay feature is asking.
    function classify(data) {
        var meta = metaOf(data), event = eventOf(data);
        var membership = String(data.membership || '').toLowerCase();
        var result = {
            event: event, meta: meta, subs: 0, gifted: 0, bits: bitCount(data, meta), follow: FOLLOW_EVENTS.indexOf(event) !== -1, label: '', tier: tierOf(data, meta),
            raid: event === 'raid', raiders: raiderCount(data, meta)
        };
        // A gift counts once, on the purchase. Twitch EventSub also sends a notice for each recipient.
        var isRecipient = event === 'giftredemption' || membership === 'gift_recipient' || data.isGift === true || meta.isGift === true;
        if (!isRecipient) {
            if (GIFT_EVENTS.indexOf(event) !== -1 || membership === 'gift_giver') result.gifted = giftCount(data, meta);
            else if (SUB_EVENTS.indexOf(event) !== -1 || (event === 'true' && membership)) result.subs = 1;
        }
        var label = data.hasDonation || data.donation || data.donationAmount || '';
        // Channel points, reward redemptions and gift counts are in the donation field but are not money.
        var notMoney = event === 'giftpurchase' || event === 'giftredemption' || event === 'channel_points' || event === 'reward' ||
            !!data.reward || /\b(?:points?|gifted)\b/i.test(String(label));
        if (!notMoney) result.label = label;
        return result;
    }
    // Replayed history must not count again, and control packets are not stream events.
    function isCountable(data) {
        return !!data && typeof data === 'object' && !data.history && !data.replay && !data.action && !data.cmd && !data.callback && data.type !== 'obs';
    }

    function blankStats(day, previous) {
        return {
            day: day, subs: 0, bits: 0, donations: 0, follows: 0, biggest: null, gifters: Object.create(null), cheerers: Object.create(null),
            // "Latest" and platform totals describe the channel, not the day, so they survive the midnight reset.
            latest: previous ? previous.latest : { follow: null, sub: null, tip: null, bits: null, raid: null },
            platformSubs: previous ? previous.platformSubs : Object.create(null),
            platformFollows: previous ? previous.platformFollows : Object.create(null)
        };
    }
    function cleanPerson(entry) {
        return entry && typeof entry === 'object' && entry.name ? { name: String(entry.name), amount: String(entry.amount || '') } : null;
    }
    function cleanTally(map) {
        var clean = Object.create(null);
        if (map && typeof map === 'object') {
            Object.keys(map).slice(0, MAX_TALLY_NAMES).forEach(function (name) {
                if (total(map[name])) clean[name] = total(map[name]);
            });
        }
        return clean;
    }
    function bump(map, name, amount) {
        map[name] = (map[name] || 0) + amount;
        var names = Object.keys(map);
        if (names.length <= MAX_TALLY_NAMES) return;
        var smallest = names.reduce(function (low, next) { return map[next] < map[low] ? next : low; }, names[0]);
        delete map[smallest];
    }
    function leader(map) {
        var names = Object.keys(map);
        if (!names.length) return null;
        var best = names.reduce(function (high, next) { return map[next] > map[high] ? next : high; }, names[0]);
        return { name: best, count: map[best] };
    }
    function sumValues(map) {
        return Object.keys(map).reduce(function (sum, key) { return sum + total(map[key]); }, 0);
    }

    function create(options) {
        var storage = options.storage, key = options.key, daily = options.daily !== false;
        var getUSD = options.getUSD, now = options.now || Date.now;
        var recent = {}, state = load();

        function load() {
            var today = localDay(now());
            var saved = readJson(storage, key);
            if (!saved || typeof saved !== 'object') return blankStats(today);
            var loaded = blankStats(saved.day || today);
            var latest = saved.latest && typeof saved.latest === 'object' ? saved.latest : {};
            loaded.latest = { follow: cleanPerson(latest.follow), sub: cleanPerson(latest.sub), tip: cleanPerson(latest.tip), bits: cleanPerson(latest.bits), raid: cleanPerson(latest.raid) };
            loaded.platformSubs = cleanTally(saved.platformSubs);
            loaded.platformFollows = cleanTally(saved.platformFollows);
            if (daily && saved.day !== today) return blankStats(today, loaded);
            ['subs', 'bits', 'donations', 'follows'].forEach(function (field) { loaded[field] = total(saved[field]); });
            loaded.gifters = cleanTally(saved.gifters);
            loaded.cheerers = cleanTally(saved.cheerers);
            if (saved.biggest && total(saved.biggest.usd)) {
                loaded.biggest = { name: String(saved.biggest.name || ''), amount: String(saved.biggest.amount || ''), usd: total(saved.biggest.usd) };
            }
            return loaded;
        }
        function save() {
            writeJson(storage, key, state);
        }
        function rollover() {
            var today = localDay(now());
            if (!daily || state.day === today) return false;
            state = blankStats(today, state);
            save();
            return true;
        }
        // Only an explicit id proves a repeat: two identical tips in a row are both real.
        function isRepeat(data, meta) {
            var id = meta.webhookId || data.id || meta.messageId || meta.eventId;
            if (id === undefined || id === null || id === '') return false;
            var time = now(), repeatKey = String(data.type || '') + ':' + id;
            Object.keys(recent).forEach(function (seen) {
                if (time - recent[seen] > DEDUPE_MS) delete recent[seen];
            });
            if (recent[repeatKey]) return true;
            recent[repeatKey] = time;
            return false;
        }
        function recordPlatformTotal(data, event) {
            var field = event === 'subscriber_update' ? 'platformSubs' : (event === 'follower_update' ? 'platformFollows' : '');
            if (!field || data.meta === null || typeof data.meta === 'object' || data.meta === '') return false;
            var count = Number(String(data.meta).replace(/,/g, ''));
            if (!(count >= 0)) return false;
            state[field][String(data.type || 'unknown')] = count;
            save();
            return true;
        }
        // Returns what this payload was worth, or null when it adds nothing or was already counted.
        function record(data) {
            if (!isCountable(data)) return null;
            rollover();
            var event = eventOf(data);
            if (recordPlatformTotal(data, event)) return { changedOnly: true };
            var worth = classify(data);
            if ((!worth.subs && !worth.gifted && !worth.bits && !worth.follow && !worth.raid && !worth.label) || isRepeat(data, worth.meta)) return null;
            var name = String(data.chatname || 'Anonymous');
            state.subs += worth.subs + worth.gifted;
            state.bits += worth.bits;
            if (worth.follow) {
                state.follows += 1;
                state.latest.follow = { name: name, amount: '' };
            }
            if (worth.raid) state.latest.raid = { name: name, amount: worth.raiders ? String(worth.raiders) : '' };
            if (worth.subs || worth.gifted) state.latest.sub = { name: name, amount: worth.gifted > 1 ? 'x' + worth.gifted : '' };
            if (worth.gifted) bump(state.gifters, name, worth.gifted);
            if (worth.bits) {
                bump(state.cheerers, name, worth.bits);
                state.latest.bits = { name: name, amount: String(worth.bits) };
            }
            worth.usd = worth.label ? total(getUSD(data)) : 0;
            if (worth.label && !worth.bits) state.latest.tip = { name: name, amount: String(worth.label) };
            if (worth.usd) {
                state.donations += worth.usd;
                if (!state.biggest || worth.usd > state.biggest.usd) {
                    state.biggest = { name: name, amount: String(worth.label), usd: worth.usd };
                }
            }
            save();
            return worth;
        }
        function reset() {
            var kept = { latest: blankStats('').latest, platformSubs: state.platformSubs, platformFollows: state.platformFollows };
            state = blankStats(localDay(now()), kept);
            save();
        }
        function read() {
            return {
                subs: state.subs, bits: state.bits, donations: state.donations, follows: state.follows, biggest: state.biggest,
                latest: state.latest, topGifter: leader(state.gifters), topBits: leader(state.cheerers),
                totalSubs: sumValues(state.platformSubs), totalFollows: sumValues(state.platformFollows)
            };
        }
        return { record: record, rollover: rollover, reset: reset, read: read };
    }

    // "6h", "90m", "45s", "1:30:00", "90:00" or a bare number of minutes.
    function parseDuration(value) {
        var text = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
        if (!text) return 0;
        if (/:/.test(text)) {
            var parts = text.split(':').map(Number);
            if (parts.some(function (part) { return !Number.isFinite(part) || part < 0; })) return 0;
            return parts.reduce(function (seconds, part) { return seconds * 60 + part; }, 0) * 1000;
        }
        var match = text.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)?$/);
        if (!match) return 0;
        var unit = (match[2] || 'm').charAt(0);
        return Number(match[1]) * (unit === 'h' ? 3600000 : unit === 's' ? 1000 : 60000);
    }

    // "Deaths|!death,Sub Goal|!subgoal|sub:1|goal:25|daily:1" -> [{label, command, rules, goal, daily}]
    function parseCounters(text) {
        return String(text || '').split(',').map(function (entry) {
            var parts = entry.split('|').map(function (part) { return part.trim(); });
            var rules = {}, goal = 0, daily = false;
            parts.slice(2).forEach(function (rule) {
                var pair = rule.split(':');
                var amount = Number(pair[1]);
                if (!Number.isFinite(amount)) return;
                if (pair[0] === 'goal') goal = Math.max(0, amount);
                else if (pair[0] === 'daily') daily = amount > 0;
                else if (['sub', 'gift', 'bits', 'tip', 'follow', 'raid'].indexOf(pair[0]) !== -1) rules[pair[0]] = amount;
            });
            var command = String(parts[1] || '').toLowerCase();
            if (command && command.charAt(0) !== '!') command = '!' + command;
            return { label: parts[0], command: command, rules: rules, goal: goal, daily: daily };
        }).filter(function (counter) { return counter.label; });
    }
    function eventAmount(rules, worth) {
        var amount = 0;
        if (rules.sub !== undefined) amount += rules.sub * (worth.subs + (rules.gift === undefined ? worth.gifted : 0));
        if (rules.gift !== undefined) amount += rules.gift * worth.gifted;
        if (rules.bits !== undefined) amount += rules.bits * worth.bits / 100;
        if (rules.tip !== undefined && !worth.bits) amount += rules.tip * (worth.usd || 0);
        if (rules.follow !== undefined && worth.follow) amount += rules.follow;
        if (rules.raid !== undefined && worth.raid) amount += rules.raid;
        return amount;
    }
    function clampCount(value) {
        return Math.max(-MAX_COUNT, Math.min(MAX_COUNT, value));
    }
    // Counters only reset when told to: a death count or owed pushups outlives the day. daily:1 opts in.
    function createCounters(options) {
        var storage = options.storage, key = options.key, defs = options.counters, now = options.now || Date.now;
        var saved = readJson(storage, key) || {};
        var savedValues = saved.values && typeof saved.values === 'object' ? saved.values : {};
        var savedDays = saved.days && typeof saved.days === 'object' ? saved.days : {};
        var days = Object.create(null);
        var values = Object.create(null);
        defs.forEach(function (def) {
            var value = Number(savedValues[def.label]);
            values[def.label] = Number.isFinite(value) ? clampCount(value) : 0;
            if (Object.prototype.hasOwnProperty.call(savedDays, def.label)) days[def.label] = savedDays[def.label];
        });
        // Other sources may keep different counters under this key, so add to the record rather than replace it.
        function save() {
            var current = readJson(storage, key) || {};
            writeJson(storage, key, { values: Object.assign({}, current.values, values), days: Object.assign({}, current.days, days) });
        }
        // True when a daily counter just started a new day, including one that was closed at midnight.
        function rollover() {
            var today = localDay(now()), reset = false, touched = false;
            defs.forEach(function (def) {
                if (!def.daily || days[def.label] === today) return;
                if (days[def.label]) { values[def.label] = 0; reset = true; }
                days[def.label] = today;
                touched = true;
            });
            if (touched) save();
            return reset;
        }
        rollover();
        function change(def, action) {
            rollover();
            var text = String(action === undefined || action === null ? '' : action).trim().toLowerCase();
            var current = values[def.label];
            if (!text) current += 1;
            else if (text === 'reset') current = 0;
            else if (/^=-?\d+(\.\d+)?$/.test(text)) current = Number(text.slice(1));
            else if (/^[+-]\d+(\.\d+)?$/.test(text)) current += Number(text);
            else if (/^\d+(\.\d+)?$/.test(text)) current += Number(text);
            else if (text === '+') current += 1;
            else if (text === '-') current -= 1;
            else return false;
            values[def.label] = clampCount(current);
            save();
            return true;
        }
        function find(label) {
            var wanted = String(label || '').trim().toLowerCase();
            return defs.filter(function (def) { return def.label.toLowerCase() === wanted; })[0] || null;
        }
        // Handles "!death", "!death -1", "!death =5", "!death reset". Returns false for anything else.
        function command(text) {
            var message = String(text || '').trim();
            var lower = message.toLowerCase();
            for (var i = 0; i < defs.length; i++) {
                var name = defs[i].command;
                if (!name || lower.indexOf(name) !== 0) continue;
                var rest = message.slice(name.length);
                if (rest && !/^\s*[+\-=\d]|^\s+\S/.test(rest)) continue;
                return change(defs[i], rest.trim());
            }
            return false;
        }
        // For &counterall: a viewer gets the bare command only, so nobody can reset a count or jump it by a million.
        var viewerTimes = {};
        function viewerAdd(text, who) {
            var lower = String(text || '').trim().toLowerCase();
            var def = defs.filter(function (item) { return item.command && item.command === lower; })[0];
            if (!def) return false;
            var time = now(), person = String(who || '').toLowerCase() + '|' + def.label;
            Object.keys(viewerTimes).forEach(function (seen) {
                if (time - viewerTimes[seen] > VIEWER_ADD_COOLDOWN_MS) delete viewerTimes[seen];
            });
            // A person spamming the command is still treated as handled, so it stays off the chat line.
            if (viewerTimes[person]) return true;
            viewerTimes[person] = time;
            return change(def, '');
        }
        function onEvent(worth) {
            var changed = rollover();
            defs.forEach(function (def) {
                var amount = eventAmount(def.rules, worth);
                if (amount) {
                    values[def.label] = clampCount(values[def.label] + amount);
                    changed = true;
                }
            });
            if (changed) save();
            return changed;
        }
        return {
            list: function () {
                return defs.map(function (def) {
                    var onlyTips = Object.keys(def.rules).length === 1 && def.rules.tip !== undefined;
                    return { label: def.label, value: values[def.label], goal: def.goal, money: onlyTips };
                });
            },
            command: command, viewerAdd: viewerAdd, onEvent: onEvent, rollover: rollover,
            control: function (label, action) { var def = find(label); return def ? change(def, action) : false; }
        };
    }

    // A countdown that subs, bits and tips push back. It keeps running against the wall clock across reloads.
    function createSubathon(options) {
        var storage = options.storage, key = options.key, now = options.now || Date.now;
        var startMs = options.durationMs, maxMs = options.maxMs || 0;
        var perSub = options.perSubMinutes || [], perBits = options.perBitsMinutes || 0;
        var perTip = options.perTipMinutes || 0, perFollow = options.perFollowMinutes || 0, perRaid = options.perRaidMinutes || 0;
        var state = load();
        if (!readJson(storage, key)) save();

        function load() {
            var saved = readJson(storage, key);
            if (saved && typeof saved === 'object' && Number.isFinite(saved.remainingMs)) {
                return { remainingMs: Math.max(0, saved.remainingMs), endsAt: Number(saved.endsAt) || 0, running: !!saved.running, ended: !!saved.ended };
            }
            return { remainingMs: startMs, endsAt: options.autostart ? now() + startMs : 0, running: !!options.autostart, ended: false };
        }
        function save() { writeJson(storage, key, state); }
        function remaining() {
            return state.running ? Math.max(0, state.endsAt - now()) : state.remainingMs;
        }
        function setRemaining(ms) {
            var next = Math.max(0, ms);
            state.remainingMs = next;
            if (state.running) state.endsAt = now() + next;
            save();
        }
        // Call once a second. Returns true at the moment the clock reaches zero.
        function tick() {
            if (!state.running || remaining() > 0) return false;
            state.running = false;
            state.ended = true;
            state.remainingMs = 0;
            save();
            return true;
        }
        function start() {
            if (state.running) return false;
            if (state.ended && state.remainingMs <= 0) return false;
            state.running = true;
            state.ended = false;
            state.endsAt = now() + state.remainingMs;
            save();
            return true;
        }
        function pause() {
            if (!state.running) return false;
            state.remainingMs = remaining();
            state.running = false;
            save();
            return true;
        }
        function add(ms) {
            if (!ms) return false;
            setRemaining(remaining() + ms);
            // A manual top-up can revive a finished clock; it stays stopped until started again.
            if (state.remainingMs > 0) state.ended = false;
            save();
            return true;
        }
        function set(ms) {
            state.ended = false;
            setRemaining(ms);
            return true;
        }
        function reset() {
            state = { remainingMs: startMs, endsAt: 0, running: false, ended: false };
            save();
            return true;
        }
        function minutesFor(worth) {
            var subMinutes = perSub.length ? (perSub[Math.min(worth.tier, perSub.length) - 1] || 0) : 0;
            var minutes = (worth.subs + worth.gifted) * subMinutes + worth.bits / 100 * perBits;
            if (!worth.bits) minutes += (worth.usd || 0) * perTip;
            if (worth.follow) minutes += perFollow;
            if (worth.raid) minutes += perRaid;
            return minutes;
        }
        // Supporters extend a clock that is still going; once it has ended only a mod can bring it back.
        function onEvent(worth) {
            tick();
            if (state.ended) return false;
            var minutes = minutesFor(worth);
            if (!minutes) return false;
            // The cap limits what support can add. A mod can still set the clock higher, and support never shrinks it.
            var current = remaining(), next = current + minutes * 60000;
            if (maxMs) next = Math.min(next, Math.max(maxMs, current));
            setRemaining(next);
            return true;
        }
        // Handles start, pause, resume, reset, "add 30m", "remove 10m", "set 6h".
        function control(text) {
            tick();
            var parts = String(text || '').trim().toLowerCase().split(/\s+/);
            var word = parts[0], amount = parseDuration(parts.slice(1).join(' '));
            if (word === 'start' || word === 'resume') return start();
            if (word === 'pause' || word === 'stop') return pause();
            if (word === 'reset') return reset();
            if (word === 'add') return add(amount);
            if (word === 'remove') return add(-amount);
            if (word === 'set' && amount) return set(amount);
            return false;
        }
        function rules() {
            var lines = [];
            function minutes(value) { return (value >= 1 ? Math.round(value * 100) / 100 + ' min' : Math.round(value * 60) + ' sec'); }
            if (perSub.length === 1 && perSub[0]) lines.push('1 Sub = +' + minutes(perSub[0]));
            if (perSub.length > 1) perSub.forEach(function (value, index) { if (value) lines.push('Tier ' + (index + 1) + ' = +' + minutes(value)); });
            if (perBits) lines.push('100 Bits = +' + minutes(perBits));
            if (perTip) lines.push('$1 = +' + minutes(perTip));
            if (perFollow) lines.push('Follow = +' + minutes(perFollow));
            if (perRaid) lines.push('Raid = +' + minutes(perRaid));
            return lines.join(' \u00b7 ');
        }
        return {
            remaining: remaining, tick: tick, control: control, onEvent: onEvent, rules: rules,
            isRunning: function () { return state.running; },
            isEnded: function () { return state.ended; }
        };
    }
    function formatClock(ms) {
        var seconds = Math.ceil(Math.max(0, ms) / 1000);
        var hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
        function pad(value) { return (value < 10 ? '0' : '') + value; }
        return pad(hours) + ':' + pad(minutes) + ':' + pad(rest);
    }

    var api = {
        create: create, classify: classify, isCountable: isCountable, parseDuration: parseDuration,
        parseCounters: parseCounters, createCounters: createCounters, createSubathon: createSubathon, formatClock: formatClock
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.SSNSessionStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
