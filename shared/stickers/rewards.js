(function (root) {
    'use strict';
    function StickerRewards(options) {
        this.options = options;
        this.busy = false;
        this.nextAt = 0;
        this.users = new Map();
        this.stickers = new Map();
        this.seen = new Map();
    }
    StickerRewards.prototype.process = async function (message) {
        var options = this.options, catalog = root.SSNStickers;
        var config = catalog.config(options.settings());
        if (!config.enabled || !options.pointsEnabled() || !message || message.bot || message.private || message.reflection || message.event || !message.chatname || !message.type) return null;
        var match = String(message.chatmessage || '').trim().match(/^!(stickers|sticker)(?:\s+([a-z0-9-]+))?\s*$/i);
        if (!match) return null;
        var now = Date.now(), self = this;
        [this.users, this.stickers, this.seen].forEach(function (map) {
            map.forEach(function (until, key) { if (until <= now) map.delete(key); });
        });
        var identity = message.type + ':' + (message.userid || message.username || message.chatname);
        var sourceId = message.id || message.meta && message.meta.messageId;
        var key = sourceId ? message.type + ':' + String(message.tid || '') + ':' + sourceId : null;
        if (key && this.seen.has(key)) return null;
        if (key) {
            if (this.seen.size >= 500) this.seen.delete(this.seen.keys().next().value);
            this.seen.set(key, now + 600000);
        }
        var rewards = catalog.rewards(config);
        if (match[1].toLowerCase() === 'stickers' || !match[2]) {
            // Keep source-chat replies below common message limits, even with custom packs.
            var pages = [''];
            rewards.forEach(function (reward) {
                var entry = reward.id + ' (' + reward.cost + ')';
                if (pages[pages.length - 1].length + entry.length > 350) pages.push('');
                pages[pages.length - 1] += (pages[pages.length - 1] ? ', ' : '') + entry;
            });
            var page = catalog.number(match[2], 1, 1, pages.length);
            var listKey = 'list:' + identity + ':' + page;
            if (this.users.get(listKey) > now) return null;
            this.users.set(listKey, now + 15000);
            return { success: true, message: rewards.length ? 'Use !sticker CODE. Rewards (points): ' + pages[page - 1] +
                (page < pages.length ? '. More: !stickers ' + (page + 1) : '') : 'No sticker packs are enabled yet.' };
        }
        var reward = rewards.find(function (r) { return r.id === match[2].toLowerCase(); });
        if (!reward) return { success: false, message: 'That sticker is not enabled. Type !stickers for the list.' };
        if (this.busy || this.nextAt > now || this.users.get(identity) > now || this.stickers.get(reward.id) > now) {
            return { success: false, message: 'Sticker cooldown active. Try again shortly; no points spent.' };
        }
        if (!options.hasReceiver()) return { success: false, message: 'The sticker overlay is offline; no points spent.' };
        this.busy = true;
        var spent = false, delivered = false, system;
        try {
            var url = reward.url || options.assetUrl(reward.image);
            await options.prepare(url);
            system = await options.points();
            // The host may disable rewards while a remote GIF is loading.
            var current = catalog.config(options.settings());
            if (!current.enabled || !options.pointsEnabled() || !options.hasReceiver() ||
                !catalog.rewards(current).some(function (r) { return r.id === reward.id && r.cost === reward.cost && r.url === reward.url; })) {
                return { success: false, message: 'Sticker settings changed; no points spent. Please try again.' };
            }
            // Use the existing points ledger's account key; do not create a second balance system.
            var debit = await system.spendPoints(message.chatname, message.type, reward.cost);
            if (!debit.success) return { success: false, message: 'Not enough points for ' + reward.name + ' (' + reward.cost + ' points).' };
            spent = true;
            var redemptionId = 'sticker-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
            delivered = await options.send({ platform: message.type, type: message.type, event: 'sticker',
                chatname: message.chatname, chatmessage: '', textonly: true, contentimg: reward.url || 'media/stickers/' + reward.image,
                meta: { sticker: { id: reward.id, pack: reward.pack, name: reward.name, cost: reward.cost,
                    duration: reward.duration, motion: reward.motion, redemptionId: redemptionId, expiresAt: Date.now() + 20000 } } });
            if (!delivered) throw new Error('Sticker display was not confirmed');
            this.users.set(identity, Date.now() + config.userCooldown * 1000);
            this.stickers.set(reward.id, Date.now() + config.stickerCooldown * 1000);
            this.nextAt = Date.now() + (reward.duration + config.gap) * 1000;
            if (options.changed) { try { options.changed(); } catch (_) {} }
            return { success: true, message: reward.name + ' redeemed for ' + reward.cost + ' points. ' + debit.remaining + ' remaining.' };
        } catch (error) {
            if (spent && !delivered && system) {
                try {
                    await system.refundPoints(message.chatname, message.type, reward.cost);
                    return { success: false, message: 'Sticker delivery failed; your points were returned.' };
                } catch (refundError) {
                    console.error('Sticker refund failed', refundError);
                    return { success: false, message: 'Sticker delivery and point refund failed. Ask the host to return ' + reward.cost + ' points.' };
                }
            }
            return { success: false, message: 'Sticker unavailable; no points spent.' };
        } finally {
            self.busy = false;
        }
    };
    root.SSNStickerRewards = StickerRewards;
    if (typeof module !== 'undefined' && module.exports) module.exports = StickerRewards;
})(typeof globalThis !== 'undefined' ? globalThis : window);
