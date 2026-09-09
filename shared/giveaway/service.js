/* Host-only domain service. No DOM, transport, or server dependency.
 * Schema v1: one IndexedDB transaction owns wallet changes, rounds and receipts.
 * Reserved funds are already included in pointsSpent; never subtract them twice.
 */
(function (root) {
    'use strict';
    var LIMIT = 1000000;
    function fail(message) { throw new Error(message); }
    function integer(value, min, max, name) {
        if (!Number.isSafeInteger(value) || value < min || value > max)
            fail(name + ' must be a whole number from ' + min + ' to ' + max + '.');
        return value;
    }
    function identifier(value) {
        value = String(value || 'default');
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value))
            fail('Use a giveaway ID with letters, numbers, - or _ (up to 64 characters).');
        return value;
    }
    function request(req) {
        return new Promise(function (resolve, reject) { req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); }; });
    }
    function unique() {
        var values = new Uint32Array(4);
        if (!root.crypto || !root.crypto.getRandomValues)
            fail('Secure random selection is unavailable.');
        root.crypto.getRandomValues(values);
        return Array.from(values).map(function (v) { return v.toString(16); }).join('-');
    }
    function random(count) {
        integer(count, 1, LIMIT, 'Ticket total');
        var array = new Uint32Array(1), limit = 4294967296 - 4294967296 % count;
        if (!root.crypto || !root.crypto.getRandomValues)
            fail('Secure random selection is unavailable.');
        do {
            root.crypto.getRandomValues(array);
        } while (array[0] >= limit);
        return array[0] % count;
    }
    function config(value) {
        value = value || {};
        var keyword = String(value.keyword === undefined ? '!enter' : value.keyword || '').trim();
        if (!keyword || keyword.length > 80)
            fail('Enter a keyword between 1 and 80 characters.');
        var match = value.match || 'exact';
        if (['exact', 'word'].indexOf(match) < 0)
            fail('Choose exact or word matching.');
        var kind = value.kind || 'giveaway';
        ['membersOnly','removeWinner'].forEach(function(key){if(value[key]!==undefined && typeof value[key]!=='boolean')fail(key+' must be true or false.');});
        if (['giveaway', 'coin', 'number'].indexOf(kind) < 0)
            fail('Unknown game type.');
        return { keyword: keyword, match: match, membersOnly: value.membersOnly === true, removeWinner: value.removeWinner !== false,
            title: String(value.title || 'Giveaway').slice(0, 160), ticketCost: integer(value.ticketCost === undefined ? 0 : value.ticketCost, 0, 10000, 'Ticket cost'),
            maxTickets: integer(value.maxTickets === undefined ? 100 : value.maxTickets, 1, 10000, 'Ticket limit'),
            prizePoints: integer(value.prizePoints === undefined ? 0 : value.prizePoints, 0, LIMIT, 'Point prize'),
            winnerCount: integer(value.winnerCount === undefined ? 1 : value.winnerCount, 1, 20, 'Winner count'), kind: kind };
    }
    function snapshot(round) {
        return { version: 2, giveawayId: round.giveawayId, roundId: round.roundId, epoch: round.roundId, generation:round.generation || (round.roundId ? 1 : 0),
            revision: round.revision, draw: round.winners.length, open: round.status === 'open', status: round.status,
            keyword: round.config.keyword, count: round.entries.length, ticketCount: round.entries.reduce(function (n, e) { return n + e.tickets; }, 0),
            config: round.config, entrants: round.entries.slice(0, 120).map(function (e) { return { id: e.id, name: e.name, platform: e.platform, tickets: e.tickets }; }),
            winners: round.winners.slice().reverse().slice(0, 20), outcome: round.outcome || null,
            number: round.config.kind === 'number' ? { low: round.low || 1, high: round.high || 100, guesses: round.guesses || [] } : null };
    }
    function Service(points, session) { this.points = points; this.session = String(session || ''); }
    function summary(round) { var state = snapshot(round); state.entrants = []; return { id: 'summary:' + round.id, state: state }; }
    Service.prototype.transaction = async function (work, readonly) {
        var system = this.points, db = await system.ensureDB();
        return new Promise(function (resolve, reject) {
            var tx = db.transaction([system.storeName, 'economyRecords'], readonly ? 'readonly' : 'readwrite');
            var error, result;
            var context = { records: tx.objectStore('economyRecords'), users: tx.objectStore(system.storeName), get: request };
            tx.oncomplete = function () { system.cache.clear(); resolve(result); };
            tx.onabort = function () { system.cache.clear(); reject(error || tx.error || new Error('Economy transaction aborted; no changes committed.')); };
            tx.onerror = function () { }; // abort is the authoritative failure callback
            Promise.resolve().then(function () { return work(context); }).then(function (value) { result = value; }, function (e) { error = e; try {
                tx.abort();
            }
            catch (_) {
                reject(e);
            } });
        });
    };
    Service.prototype.key = function (id) { return 'giveaway:' + JSON.stringify([this.session, identifier(id)]); };
    Service.prototype.account = async function (tx, entry) {
        var account = await tx.get(tx.users.get(entry.accountKey));
        if (!account)
            account = this.points.createDefaultUserData(entry.name, entry.platform);
        if (account.userKey !== entry.accountKey)
            fail('Account identity is ambiguous.');
        return account;
    };
    Service.prototype.saveAccount = function (tx, user) {
        if (!Number.isFinite(user.points) || !Number.isFinite(user.pointsSpent) || Math.abs(user.points) > Number.MAX_SAFE_INTEGER ||
            user.pointsSpent < 0 || user.pointsSpent > Number.MAX_SAFE_INTEGER || (user.pointsReserved || 0) < 0)
            fail('Invalid points balance.');
        user.revision = (user.revision || 0) + 1;
        tx.users.put(user);
    };
    Service.prototype.run = async function (action, value, actor) {
        value = value || {};
        var self = this, id = identifier(value.giveawayId), key = this.key(id);
        var operationId = String(value.operationId || unique());
        if (operationId.length > 400)
            fail('Operation ID is too long.');
        var receiptKey = 'operation:' + JSON.stringify([this.session, operationId]);
        var fingerprint = JSON.stringify([action, id, value.roundId || null, value.config || null, value.count || null, value.side || null, value.guess === undefined ? null : value.guess, value.entryId || null,
            actor ? [actor.type, actor.userid || actor.username || actor.chatname, actor.chatname] : null]);
        return this.transaction(async function (tx) {
            var prior = await tx.get(tx.records.get(receiptKey));
            if (prior) {
                if (prior.fingerprint !== fingerprint)
                    fail('This operation ID was already used for a different action.');
                var previousRound = await tx.get(tx.records.get(prior.roundKey));
                if (!previousRound || previousRound.roundId !== prior.roundId)
                    previousRound = await tx.get(tx.records.get('archive:' + prior.roundId));
                return { ok: true, operationId: operationId, duplicate: true, giveaway: previousRound ? snapshot(previousRound) : null };
            }
            var round = await tx.get(tx.records.get(key));
            if (!round && action === 'getgiveawaystate')
                return { ok: true, giveaway: snapshot({ giveawayId: id, roundId: '', revision: 0, status: 'draft', config: config(), entries: [], winners: [] }) };
            if (!round)
                round = { id: key, session: self.session, version: 1, giveawayId: id, roundId: unique(), revision: 0, config: config(), entries: [], winners: [], won: [], status: 'draft', createdAt: Date.now() };
            if (value.roundId && value.roundId !== round.roundId)
                fail('The round changed. Refresh before trying again.');
            if (action === 'getgiveawaystate')
                return { ok: true, giveaway: snapshot(round) };
            if (action === 'startgiveaway') {
                if (['completed', 'cancelled'].indexOf(round.status) >= 0 || round.winners.length)
                    fail('Create a new round before opening entries again.');
                var next = config(value.config || round.config);
                if (round.entries.length && JSON.stringify(next) !== JSON.stringify(round.config))
                    fail('Entry rules are locked. Cancel this round or keep its existing rules.');
                if (next.kind === 'coin' && (next.ticketCost !== 1 || next.prizePoints || next.winnerCount !== 1))
                    fail('Coin Flip Pot uses one point per stake, no extra prize, and one outcome.');
                if (next.kind === 'number' && (next.ticketCost || next.winnerCount !== 1))
                    fail('Number Hunt is free to enter and has one winner.');
                if (next.kind === 'number' && !round.numberSecret) {
                    round.numberSecret = random(100) + 1;
                    round.low = 1;
                    round.high = 100;
                    round.guesses = [];
                }
                round.config = next;
                round.status = 'open';
            }
            else if (action === 'closegiveaway') {
                if (round.status === 'open')
                    round.status = 'locked';
            }
            else if (action === 'resetgiveaway') {
                if (round.entries.some(function (e) { return e.reserved > 0; }))
                    fail('Cancel and refund this paid round before creating a new one.');
                tx.records.put(Object.assign({}, round, { id: 'archive:' + round.roundId }));
                round = { id: key, session: self.session, version: 1, giveawayId: id, roundId: unique(), generation:(round.generation || 1)+1, revision: 0, config: round.config, entries: [], winners: [], won: [], status: 'draft', createdAt: Date.now() };
            }
            else if (action === 'removegiveawayentry') {
                if (round.winners.length || !['open', 'locked'].includes(round.status))
                    fail('Entries can only be removed before a result is committed.');
                var removed = round.entries.find(function (e) { return e.id === value.entryId; });
                if (!removed)
                    fail('That entry is no longer present. Refresh the list.');
                if (removed.reserved) {
                    var removedAccount = await self.account(tx, removed);
                    removedAccount.pointsSpent -= removed.reserved;
                    removedAccount.pointsReserved = (removedAccount.pointsReserved || 0) - removed.reserved;
                    self.saveAccount(tx, removedAccount);
                }
                round.entries = round.entries.filter(function (e) { return e.id !== value.entryId; });
            }
            else if (action === 'cancelgiveaway') {
                if (round.winners.length || round.status === 'completed')
                    fail('The result is committed. A completed draw cannot be cancelled.');
                for (var e of round.entries) {
                    if (e.reserved) {
                        var refund = await self.account(tx, e);
                        refund.pointsSpent -= e.reserved;
                        refund.pointsReserved = (refund.pointsReserved || 0) - e.reserved;
                        self.saveAccount(tx, refund);
                        e.refunded = (e.refunded || 0) + e.reserved;
                        e.reserved = 0;
                    }
                }
                round.status = 'cancelled';
            }
            else if (action === 'entergiveaway' || action === 'buygiveawaytickets' || action === 'grantgiveawaytickets' || action === 'guessgiveaway') {
                if (round.status !== 'open')
                    fail('Entries are closed.');
                if (!actor || typeof actor.chatname !== 'string' || !actor.chatname.trim() || !actor.type)
                    fail('A captured viewer identity is required.');
                if (actor.bot || actor.private || actor.history || actor.replay || actor.reflection || actor.reload || actor.meta && actor.meta.economyTest)
                    fail('Test, replay, private, and bot messages cannot enter this round.');
                if (typeof actor.type !== 'string' || actor.type.length > 80 || actor.chatname.length > 160)
                    fail('Invalid viewer identity.');
                if (round.config.membersOnly && !(actor.membership || actor.hasMembership))
                    fail('This giveaway is for members only.');
                var identity = JSON.stringify([actor.type, String(actor.userid || actor.username || actor.chatname)]);
                var walletKey = self.points.getUserKey(actor.chatname, actor.type);
                var entry = round.entries.find(function (e) { return e.id === identity; });
                if (entry && entry.accountKey !== walletKey)
                    fail('Your account name changed during this round. Ask the host to review it.');
                if (round.entries.some(function (e) { return e.id !== identity && e.accountKey === walletKey; }))
                    fail('More than one source identity matches this wallet. Ask the host to review it.');
                if (round.config.removeWinner && round.won.indexOf(identity) >= 0)
                    fail('This viewer already won in this round.');
                var count = integer(value.count === undefined ? 1 : value.count, 1, 10000, 'Ticket count');
                if (round.config.kind === 'number' && action !== 'guessgiveaway')
                    fail('Enter Number Hunt with a guess.');
                if (action === 'guessgiveaway') {
                    if (round.config.kind !== 'number')
                        fail('This is not a Number Hunt round.');
                    integer(value.guess, round.low, round.high, 'Guess');
                    if (entry && Date.now() - entry.lastGuessAt < 5000)
                        fail('Wait 5 seconds between guesses.');
                    count = entry ? 0 : 1;
                }
                if (action === 'entergiveaway') {
                    if (round.config.ticketCost)
                        fail('This round requires tickets. Use Buy tickets.');
                    if (entry)
                        return { ok: true, giveaway: snapshot(round), duplicate: true };
                    count = 1;
                }
                if (round.entries.length >= 10000 && !entry)
                    fail('The participant limit has been reached.');
                if ((entry ? entry.tickets : 0) + count > round.config.maxTickets)
                    fail('That exceeds the per-viewer ticket limit.');
                if (round.entries.reduce(function (n, e) { return n + e.tickets; }, 0) + count > LIMIT)
                    fail('The total ticket limit has been reached.');
                var cost = action === 'grantgiveawaytickets' ? 0 : count * round.config.ticketCost;
                if (round.config.kind === 'coin' && (cost !== count || ['heads', 'tails'].indexOf(value.side) < 0))
                    fail('Choose heads or tails and pay one point per stake.');
                if (entry && entry.side !== (value.side || null))
                    fail('You cannot change sides after entering.');
                if (!entry) {
                    entry = { id: identity, name: actor.chatname, platform: actor.type, accountKey: walletKey, tickets: 0, reserved: 0, side: value.side || null };
                    round.entries.push(entry);
                }
                if (cost) {
                    var user = await self.account(tx, entry);
                    if (user.points - user.pointsSpent < cost)
                        fail('Not enough points. This purchase needs ' + cost + ' points.');
                    user.pointsSpent += cost;
                    user.pointsReserved = (user.pointsReserved || 0) + cost;
                    self.saveAccount(tx, user);
                    entry.reserved += cost;
                }
                entry.tickets += count;
                if (action === 'guessgiveaway') {
                    entry.lastGuessAt = Date.now();
                    var answer = value.guess === round.numberSecret;
                    round.guesses.unshift({ name: entry.name, guess: value.guess, hint: answer ? 'Correct' : value.guess < round.numberSecret ? 'Higher' : 'Lower' });
                    round.guesses = round.guesses.slice(0, 6);
                    if (answer) {
                        if (round.config.prizePoints) {
                            var solver = await self.account(tx, entry);
                            solver.points += round.config.prizePoints;
                            self.saveAccount(tx, solver);
                        }
                        round.winners.push({ id: entry.id, name: entry.name, platform: entry.platform, drawnAt: Date.now(), points: round.config.prizePoints });
                        round.status = 'completed';
                    }
                    else if (value.guess < round.numberSecret)
                        round.low = value.guess + 1;
                    else
                        round.high = value.guess - 1;
                }
            }
            else if (action === 'drawgiveaway') {
                if (round.config.kind === 'number')
                    fail('Number Hunt awards its prize automatically to the first correct guess.');
                if (round.status !== 'open' && round.status !== 'locked')
                    fail('This round is not ready to draw.');
                if (!round.entries.length)
                    fail('There are no eligible entries.');
                if (round.config.kind === 'coin') {
                    var heads = round.entries.filter(function (e) { return e.side === 'heads'; }), tails = round.entries.filter(function (e) { return e.side === 'tails'; });
                    if (!heads.length || !tails.length)
                        fail('Both sides need a participant. Cancel to refund the stakes.');
                    round.outcome = random(2) ? 'heads' : 'tails';
                    var victors = round.outcome === 'heads' ? heads : tails;
                    var pot = round.entries.reduce(function (n, e) { return n + e.reserved; }, 0), stake = victors.reduce(function (n, e) { return n + e.reserved; }, 0);
                    var allocations = victors.map(function (e, i) { var exact = (pot - stake) * e.reserved; return { entry: e, extra: Math.floor(exact / stake), remainder: exact % stake, order: i }; });
                    var left = pot - stake - allocations.reduce(function (n, a) { return n + a.extra; }, 0);
                    allocations.slice().sort(function (a, b) { return b.remainder - a.remainder || a.order - b.order; }).slice(0, left).forEach(function (a) { a.extra++; });
                    for (var a of allocations) {
                        var winnerAccount = await self.account(tx, a.entry);
                        winnerAccount.pointsSpent -= a.entry.reserved;
                        winnerAccount.points += a.extra;
                        self.saveAccount(tx, winnerAccount);
                        round.winners.push({ id: a.entry.id, name: a.entry.name, platform: a.entry.platform, drawnAt: Date.now(), points: a.entry.reserved + a.extra });
                    }
                    round.status = 'completed';
                }
                else {
                    var total = round.entries.reduce(function (n, e) { return n + e.tickets; }, 0), choice = random(total), selected;
                    for (var candidate of round.entries) {
                        choice -= candidate.tickets;
                        if (choice < 0) {
                            selected = candidate;
                            break;
                        }
                    }
                    if (round.config.prizePoints) {
                        var payee = await self.account(tx, selected);
                        payee.points += round.config.prizePoints;
                        self.saveAccount(tx, payee);
                    }
                    round.winners.push({ id: selected.id, name: selected.name, platform: selected.platform, drawnAt: Date.now(), points: round.config.prizePoints });
                    round.won.push(selected.id);
                    round.status = round.winners.length >= round.config.winnerCount ? 'completed' : 'locked';
                }
                for (var participant of round.entries) {
                    if (participant.reserved) {
                        var settled = await self.account(tx, participant);
                        settled.pointsReserved = (settled.pointsReserved || 0) - participant.reserved;
                        self.saveAccount(tx, settled);
                        participant.paid = (participant.paid || 0) + participant.reserved;
                        participant.reserved = 0;
                    }
                }
                if (selected && round.config.removeWinner)
                    round.entries = round.entries.filter(function (e) { return e.id !== selected.id; });
            }
            else
                fail('Unknown giveaway action.');
            round.revision++;
            round.updatedAt = Date.now();
            tx.records.put(round);
            tx.records.put(summary(round));
            var result = { ok: true, operationId: operationId, giveaway: snapshot(round) };
            tx.records.put({ id: receiptKey, version: 1, fingerprint: fingerprint, roundKey: key, roundId: round.roundId, createdAt: Date.now() });
            return result;
        });
    };
    Service.prototype.list = function (full) {
        var prefix = (full ? '' : 'summary:') + 'giveaway:' + JSON.stringify([this.session]).slice(0, -1) + ',';
        return this.transaction(async function (tx) {
            var records = await tx.get(tx.records.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff')));
            return full ? records.map(snapshot) : records.map(function (r) { return r.state; });
        }, true);
    };
    Service.prototype.recoverRounds = function () {
        var prefix = 'giveaway:' + JSON.stringify([this.session]).slice(0, -1) + ',';
        return this.transaction(async function (tx) { var rounds = await tx.get(tx.records.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'))); rounds.forEach(function (r) { if (r.status === 'open') {
            r.status = 'locked';
            r.revision++;
            tx.records.put(r);
        } tx.records.put(summary(r)); }); });
    };
    Service.prototype.entries = function (id, page) {
        var key = this.key(id);
        page = integer(page || 1, 1, 10000, 'Page');
        return this.transaction(async function (tx) { var round = await tx.get(tx.records.get(key)); return { ok: true, roundId: round ? round.roundId : '', page: page, total: round ? round.entries.length : 0, entries: round ? round.entries.slice((page - 1) * 100, page * 100).map(function (e) { return { id: e.id, name: e.name, platform: e.platform, tickets: e.tickets, reserved: e.reserved }; }) : [] }; }, true);
    };
    Service.prototype.history = function () {
        var selfSession = this.session;
        var prefix = 'giveaway:' + JSON.stringify([this.session]).slice(0, -1) + ',';
        return this.transaction(async function (tx) {
            var records = await tx.get(tx.records.getAll(IDBKeyRange.bound('archive:', 'archive:\uffff')));
            records = records.concat(await tx.get(tx.records.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'))));
            return records.filter(function (r) { return (r.id.indexOf(prefix) === 0 || r.id.indexOf('archive:') === 0 && r.session === selfSession) && r.winners; }).map(function (r) { return { giveawayId: r.giveawayId, roundId: r.roundId, status: r.status, winners: r.winners, updatedAt: r.updatedAt }; });
        }, true);
    };
    root.SSNGiveawayService = Service;
    root.SSNGiveawayService.operationId = unique;
})(typeof window !== 'undefined' ? window : globalThis);
