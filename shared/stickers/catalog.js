(function (root) {
    'use strict';
    var packs = [
        { id: 'arcade', name: 'Arcade Hype', image: 'rocket.webp', color: '#c9f658', cost: 100, description: 'Launch the good moments into orbit.', rewards: [
            { id: 'rocket', name: 'Mission accomplished', motion: 'still' },
            { id: 'launch', name: 'Chat takes off', motion: 'rise' },
            { id: 'orbit', name: 'Out of this world', motion: 'wiggle' }
        ] },
        { id: 'cozy', name: 'Cozy Club', image: 'cat.webp', color: '#ffad86', cost: 75, description: 'A little comfort, courtesy of chat.', rewards: [
            { id: 'coffee', name: 'A cup of good vibes', motion: 'still' },
            { id: 'cozy', name: 'Cozy check-in', motion: 'bounce' },
            { id: 'catnap', name: 'Take a tiny break', motion: 'float' }
        ] },
        { id: 'chaos', name: 'Friendly Chaos', image: 'goose.webp', color: '#86dcff', cost: 125, description: 'A very important goose has entered the stream.', rewards: [
            { id: 'goose', name: 'Unscheduled goose', motion: 'still' },
            { id: 'honk', name: 'Respectfully, HONK', motion: 'wiggle' },
            { id: 'party', name: 'The goose approves', motion: 'bounce' }
        ] }
    ];
    packs.push(
        { id: 'studio', name: 'Studio Sessions', image: 'studio.svg', color: '#b6a4ff', cost: 100, description: 'For the song that deserves an encore.', rewards: [
            { id: 'listen', name: 'In the groove', motion: 'still' }, { id: 'encore', name: 'One more song', motion: 'bounce' }, { id: 'vibes', name: 'Feeling this one', motion: 'float' }
        ] },
        { id: 'maker', name: 'Made Together', image: 'maker.svg', color: '#84dcca', cost: 75, description: 'Celebrate the process, not just the finish.', rewards: [
            { id: 'inspired', name: 'An idea worth keeping', motion: 'still' }, { id: 'creative', name: 'Creative spark', motion: 'wiggle' }, { id: 'nailedit', name: 'Look what you made', motion: 'bounce' }
        ] },
        { id: 'support', name: 'Good Company', image: 'support.svg', color: '#ffa5b1', cost: 75, description: 'A little appreciation goes a long way.', rewards: [
            { id: 'love', name: 'Sending some love', motion: 'still' }, { id: 'thanks', name: 'You made a difference', motion: 'float' }, { id: 'cheer', name: 'We are cheering for you', motion: 'bounce' }
        ] }
    );
    var motions = ['still', 'bounce', 'float', 'rise', 'wiggle'];
    function number(value, fallback, min, max) {
        var n = Number(value);
        return value !== '' && value != null && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
    }
    function mediaUrl(value) {
        try {
            var url = new URL(String(value || ''));
            if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2048) return '';
            // Accept direct media links, not an HTML GIPHY page or executable content.
            if (!/\.(png|jpe?g|gif|webp|avif)(?:$)/i.test(url.pathname)) return '';
            return url.href;
        } catch (_) { return ''; }
    }
    function config(raw) {
        raw = raw && (raw.object || raw) || {};
        var prices = {};
        packs.forEach(function (pack) { prices[pack.id] = number(raw.prices && raw.prices[pack.id], pack.cost, 1, 1000000); });
        return {
            enabled: raw.enabled === true,
            reply: raw.reply !== false,
            packs: Array.isArray(raw.packs) ? raw.packs.filter(function (id) { return packs.some(function (p) { return p.id === id; }); }) : [],
            prices: prices,
            userCooldown: number(raw.userCooldown, 60, 5, 3600),
            stickerCooldown: number(raw.stickerCooldown, 20, 5, 3600),
            gap: number(raw.gap, 3, 1, 60),
            duration: number(raw.duration, 6, 2, 15),
            custom: Array.isArray(raw.custom) ? raw.custom.slice(0, 12).filter(function (item) {
                return item && /^custom-[a-z0-9-]{1,32}$/.test(item.id) && mediaUrl(item.url);
            }).map(function (item) {
                return { id: item.id, name: String(item.name || item.id).slice(0, 60), url: mediaUrl(item.url),
                    cost: number(item.cost, 100, 1, 1000000), motion: motions.indexOf(item.motion) >= 0 ? item.motion : 'still' };
            }) : []
        };
    }
    function rewards(raw) {
        var settings = config(raw), items = [];
        packs.forEach(function (pack) {
            if (settings.packs.indexOf(pack.id) < 0) return;
            pack.rewards.forEach(function (reward) {
                items.push(Object.assign({}, reward, { pack: pack.id, image: pack.image,
                    cost: number(settings.prices[pack.id], pack.cost, 1, 1000000), duration: settings.duration }));
            });
        });
        settings.custom.forEach(function (reward) { items.push(Object.assign({}, reward, { pack: 'custom', duration: settings.duration })); });
        return items;
    }
    var catalog = { packs: packs, motions: motions, config: config, rewards: rewards, mediaUrl: mediaUrl, number: number };
    root.SSNStickers = catalog;
    if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : window);
