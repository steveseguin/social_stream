(function (root) {
    'use strict';
    var commands = ['boardSave', 'boardSpot', 'boardVisibility', 'saleAdd', 'saleRemove', 'salesClear', 'salesSettings'];
    function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
    function integer(value, min, max, fallback) { var n = Number(value); return Number.isInteger(n) && n >= min && n <= max ? n : fallback; }
    function sale(value) {
        value = value || {};
        var amount = value.amount === '' || value.amount == null ? null : Number(value.amount);
        return { id: text(value.id, 180), title: text(value.title, 180), amount: Number.isFinite(amount) && amount >= 0 && amount < 10000000 ? amount : null,
            currency: /^[A-Z]{3}$/.test(value.currency || '') ? value.currency : '', quantity: integer(value.quantity, 1, 100000, 1),
            source: text(value.source, 30), platform:['whatnot','ebay','shopify','fourthwall','kofi','bmac'].indexOf(value.platform || value.source)!==-1 ? (value.platform || value.source) : '', at: Number(value.at) || 0, boardId:text(value.boardId, 80), spotId:text(value.spotId, 4) };
    }
    function normalize(raw) {
        raw = raw || {}; var b = raw.board || {};
        return { board: { id:text(b.id,80) || (Array.isArray(b.spots) && b.spots.length ? 'legacy-board' : ''), title: text(b.title, 80) || 'Pick your spot', style: b.style === 'teams' ? 'teams' : 'spots',
            columns: integer(b.columns, 1, 20, 10), visible: b.visible === true,
            spots: (Array.isArray(b.spots) ? b.spots : []).slice(0, 120).map(function (s, i) { s = s || {}; return { id: String(i + 1), label: text(s.label, 60) || String(i + 1), status: ['available', 'claimed', 'revealed'].indexOf(s.status) !== -1 ? s.status : 'available', result: s.status === 'revealed' ? text(s.result, 100) : '' }; }) },
            sales: (Array.isArray(raw.sales) ? raw.sales : []).slice(0, 100).map(sale).filter(function (s) { return s.id && s.title; }),
            automatic: raw.automatic === true, salesVisible: raw.salesVisible === true, auctionSource:['whatnot','ebay'].indexOf(raw.auctionSource)!==-1 ? raw.auctionSource : '',
            seen: (Array.isArray(raw.seen) ? raw.seen : []).filter(function (id) { return typeof id === 'string'; }).slice(-2000), revision: Number(raw.revision) || 0 };
    }
    function apply(raw, command, data, now) {
        var s = normalize(raw); data = data || {}; now = now || Date.now();
        if (command === 'boardSave') {
            var labels = text(data.labels, 8000).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
            var count = labels.length || integer(data.count, 1, 120, 0), columns = integer(data.columns, 1, 20, 0);
            if (!count || count > 120 || !columns) throw new Error('Use 1–120 spots and 1–20 columns.');
            s.board = { id:String(now)+'-'+(s.revision+1), title: text(data.title, 80) || 'Pick your spot', style: data.style === 'teams' ? 'teams' : 'spots', columns: columns, visible: true,
                spots: Array.from({length:count}, function (_, i) { return { id:String(i + 1), label: text(labels[i], 60) || String(i + 1), status:'available', result:'' }; }) };
        } else if (command === 'boardSpot') {
            var spot = s.board.spots.filter(function (x) { return x.id === String(data.id); })[0];
            if (!spot || ['available', 'claimed', 'revealed'].indexOf(data.status) === -1) throw new Error('Choose a saved spot and its status.');
            spot.status = data.status; spot.result = data.status === 'revealed' ? text(data.result, 100) : '';
        } else if (command === 'boardVisibility') s.board.visible = data.visible === true;
        else if (command === 'saleAdd') {
            if (data.quantity !== undefined && !integer(data.quantity, 1, 100000, 0)) throw new Error('Use a quantity from 1 to 100000.');
            if (data.amount != null && typeof data.amount !== 'number' && typeof data.amount !== 'string') throw new Error('Enter a numeric price.');
            var item = sale(Object.assign({}, data, {id:'manual-' + now + '-' + (s.revision + 1), source:'Host confirmed', at:now}));
            if (!item.title || (data.amount !== '' && data.amount != null && (item.amount === null || !item.currency))) throw new Error('Enter an item name and, optionally, a valid price and three-letter currency.');
            item.boardId = ''; item.spotId = '';
            if (data.spotId) {
                var linked = s.board.spots.filter(function (spot) { return spot.id === String(data.spotId); })[0];
                if (!linked || !s.board.id || data.boardId !== s.board.id) throw new Error('The board changed. Select the spot again.');
                if (s.sales.some(function (sale) { return sale.boardId === s.board.id && sale.spotId === linked.id; })) throw new Error('This spot already has a recorded sale. Remove that sale before recording it again.');
                item.boardId = s.board.id; item.spotId = linked.id;
                if (linked.status === 'available') linked.status = 'claimed';
            }
            s.sales.unshift(item); s.sales = s.sales.slice(0, 100);
        } else if (command === 'saleRemove') {
            var removed = s.sales.filter(function (item) { return item.id === data.id; })[0];
            if (data.reopenSpot && removed && removed.boardId && removed.boardId === s.board.id) {
                var reopen = s.board.spots.filter(function (spot) { return spot.id === removed.spotId; })[0];
                if (reopen) { reopen.status = 'available'; reopen.result = ''; }
            }
            s.sales = s.sales.filter(function (item) { return item.id !== data.id; });
        }
        else if (command === 'salesClear') s.sales = []; // Keep delivery IDs so reconnects cannot refill a cleared wall.
        else if (command === 'salesSettings') { s.automatic = data.automatic === true; s.salesVisible = data.visible === true; if (data.auctionSource !== undefined) s.auctionSource = ['whatnot','ebay'].indexOf(data.auctionSource)!==-1 ? data.auctionSource : ''; }
        else throw new Error('Unknown commerce board command.');
        s.revision++; return s;
    }
    function purchase(raw, event, now) {
        if (!raw || !raw.automatic || !event || event.event !== 'purchase' || event.private === true || event.isTest === true || event.testMode === true) return null;
        if (['shopify', 'ebay', 'fourthwall', 'kofi', 'bmac'].indexOf(event.type) === -1 || /sandbox/i.test(event.chatname || '')) return null;
        if ((typeof event.id !== 'string' && typeof event.id !== 'number') || !String(event.id) || String(event.id).length > 150) return null;
        var s = normalize(raw), id = event.type + ':' + event.id;
        if (s.seen.indexOf(id) !== -1) return null;
        var meta = event.meta || {}, title = text(event.subtitle, 180) || text(meta.ebayPurchase && meta.ebayPurchase.itemName, 180);
        if (!title) title = 'Store purchase';
        // Purchase feeds do not consistently expose item prices. Never substitute a listing bid, tip, or order total.
        s.sales.unshift(sale({id:id, title:title, source:event.type, quantity:(meta.commerce && meta.commerce.quantity) || (meta.ebayPurchase && meta.ebayPurchase.quantity), at:now || Date.now()}));
        s.sales = s.sales.slice(0, 100); s.seen.push(id); s.seen = s.seen.slice(-2000); s.revision++; return s;
    }
    function controlState(raw) { var s = normalize(raw); delete s.seen; return s; }
    function publicState(raw) { var s = controlState(raw); delete s.auctionSource; s.sales.forEach(function (sale) { delete sale.boardId; delete sale.spotId; }); return s; }
    // Operator-only draft data. A captured auction status never proves payment.
    function auction(event, now) {
        if (!event || event.event !== 'auction_update' || ['whatnot','ebay'].indexOf(event.type) === -1 || event.private || event.isTest || event.testMode || event.history || event.replay) return null;
        var m = event.meta; if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
        return {source:event.type, title:text(m.title,180), priceText:text(m.priceText || m.currentPriceText,60), status:text(m.status,30), at:now || Date.now()};
    }
    var api = { commands:commands, normalize:normalize, apply:apply, purchase:purchase, publicState:publicState, controlState:controlState, auction:auction };
    root.SSNCommerceBoards = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
