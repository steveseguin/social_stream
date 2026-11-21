(function (root) {
	'use strict';

	// Hype games react to how excited chat is, measured against what is normal
	// for this channel, so a five-person chat and a five-thousand-person chat
	// both get a fair game. Pure logic only: no DOM, so it also runs in Node.

	var TAU = 3; // seconds the live rate takes to follow chat
	var BASE_TAU = 120; // seconds "normal for this channel" takes to follow
	var SENSITIVITY = {
		low: { floor: 0.9, curve: 2.8, trigger: 2.6, minBurst: 6 },
		medium: { floor: 0.5, curve: 2.2, trigger: 2.0, minBurst: 4 },
		high: { floor: 0.25, curve: 1.6, trigger: 1.6, minBurst: 3 }
	};
	// Stream events count as bigger jolts than a chat line. Events that are not
	// listed (viewer counts, track changes, ...) are not excitement and are ignored.
	var EVENT_WEIGHT = {
		message: 1, membermilestone: 1,
		donation: 5, superchat: 5, jeweldonation: 5, thankyou: 5, gift: 5, purchase: 5,
		sticker: 4, supersticker: 4, cheer: 4, bits: 4, raid: 8, redirect: 8,
		new_subscriber: 4, subscriber: 4, resub: 4, new_member: 4, membership: 4, sponsorship: 4,
		subscription_gift: 5, giftpurchase: 5, giftredemption: 4,
		new_follower: 2, follow: 2, reward: 2
	};
	var STOP = ' the and that this with for you your are was were have has had not but its just like from they them what when who how why can will all out get got one too very there here then than our his her she him yeah yes lol lmao omg wtf ';
	var MISSIONS = ['Cloud Deck', 'Edge of Space', 'Low Orbit', 'The Moon', 'Mars', 'Asteroid Belt', 'Jupiter', 'Saturn', 'Deep Space'];
	var STAGES = ['Embers', 'Kindling', 'Campfire', 'Bonfire', 'Inferno'];

	function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }
	function own(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

	function words(text) {
		var out = [], parts = String(text).toLowerCase().split(/[\s!-\/:-@\[-`{-~]+/);
		for (var i = 0; i < parts.length && out.length < 24; i++) {
			var word = parts[i].replace(/(.)\1{2,}/g, '$1$1$1').slice(0, 24);
			if (word.length < 3 || STOP.indexOf(' ' + word + ' ') >= 0) continue;
			out.push(word);
		}
		return out;
	}

	function magnitude(peakRatio, chatters) {
		var value = 1 + 2.4 * Math.log(1 + peakRatio) / Math.LN10 + 0.8 * Math.log(1 + chatters) / Math.LN10;
		return Math.round(clamp(value, 1, 9.9) * 10) / 10;
	}

	// ---- Meter: turns a stream of chat into a 0..1 excitement level ----
	function Meter(options) {
		options = options || {};
		var preset = SENSITIVITY[options.sensitivity] || SENSITIVITY.medium;
		this.floor = preset.floor;
		this.curve = preset.curve;
		this.trigger = preset.trigger;
		this.minBurst = preset.minBurst;
		this.warmup = options.warmup == null ? 15 : options.warmup;
		this.reset();
	}
	Meter.prototype.reset = function () {
		this.t = 0;
		this.rate = 0;
		this.base = 0;
		this.ref = this.floor;
		this.ratio = 0;
		this.level = 0;
		this.recent = [];
		this.users = new Map();
		this.seen = new Set();
		this.chatters = 0;
		this.countedAt = 0;
		this.total = 0;
		this.burst = null;
		this.ended = null;
		this.bursts = 0;
		this.calmFor = 0;
		this.cooldownUntil = 0;
	};
	Meter.prototype.measure = function () {
		this.ref = Math.max(this.base, this.floor);
		this.ratio = this.rate / this.ref;
		this.level = 1 - Math.exp(-this.ratio / this.curve);
	};
	Meter.prototype.advance = function (t) {
		var dt = t - this.t;
		if (!(dt > 0)) return;
		this.t = t;
		this.rate *= Math.exp(-dt / TAU);
		if (!this.burst) {
			// A burst must not become the new normal while it is still happening,
			// and a fresh page learns its channel quickly before settling down.
			var tau = Math.min(BASE_TAU, 5 + t / 2);
			this.base += (this.rate - this.base) * (1 - Math.exp(-dt / tau));
		}
		while (this.recent.length && this.recent[0].t < t - 5) this.recent.shift();
		this.measure();
		if (t - this.countedAt >= 1) this.count();
		var burst = this.burst;
		if (burst) {
			this.peak();
			// Over once chat is back near normal, or has fallen well off its own peak.
			this.calmFor = this.ratio < 1.15 || this.rate < burst.peakRate * 0.4 ? this.calmFor + dt : 0;
			var timedOut = t - burst.start >= 90;
			if (this.calmFor >= 3 || timedOut) {
				burst.end = t;
				burst.seconds = t - burst.start;
				// Ninety seconds of it is no longer a burst: it is the new normal.
				if (timedOut) this.base = Math.max(this.base, this.rate * 0.7);
				this.ended = burst;
				this.burst = null;
				this.cooldownUntil = t + 4;
				this.measure();
			}
		} else this.begin();
	};
	Meter.prototype.count = function () {
		var self = this, live = 0, stale = [];
		this.countedAt = this.t;
		this.users.forEach(function (user, key) {
			if (user.last < self.t - 120) stale.push(key);
			else if (user.last >= self.t - 60) live++;
		});
		stale.forEach(function (key) { self.users.delete(key); });
		this.chatters = live;
	};
	Meter.prototype.begin = function () {
		if (this.burst || this.t < this.warmup || this.t < this.cooldownUntil || this.ratio < this.trigger) return;
		var sum = 0, i;
		for (i = 0; i < this.recent.length; i++) sum += this.recent[i].w;
		if (sum < this.minBurst) return;
		this.burst = { id: ++this.bursts, start: this.recent.length ? this.recent[0].t : this.t, end: null, seconds: 0, peakRatio: 0, peakRate: 0, messages: 0, chatters: 0, magnitude: 1, word: '', users: new Set(), words: new Map() };
		this.calmFor = 0;
		// The messages that set it off belong to it.
		for (i = 0; i < this.recent.length; i++) this.join(this.recent[i]);
		this.peak();
	};
	Meter.prototype.join = function (entry) {
		var burst = this.burst;
		burst.messages++;
		burst.users.add(entry.key);
		burst.chatters = burst.users.size;
		if (!entry.text || entry.text.charAt(0) === '!') return;
		var list = words(entry.text), best = burst.words.get(burst.word) || 0;
		for (var i = 0; i < list.length; i++) {
			if (!burst.words.has(list[i]) && burst.words.size >= 300) continue;
			var count = (burst.words.get(list[i]) || 0) + 1;
			burst.words.set(list[i], count);
			if (count >= 2 && count > best) { best = count; burst.word = list[i]; }
		}
	};
	Meter.prototype.peak = function () {
		var burst = this.burst;
		burst.peakRatio = Math.max(burst.peakRatio, this.ratio);
		burst.peakRate = Math.max(burst.peakRate, this.rate);
		burst.magnitude = magnitude(burst.peakRatio, burst.chatters);
	};
	// Returns the weight a payload counted for, or 0 when it was ignored.
	Meter.prototype.message = function (m, t) {
		if (!m || typeof m !== 'object' || m.bot || m.private || m.reflection || typeof m.type !== 'string' || !m.type) return 0;
		var hasMessage = typeof m.chatmessage === 'string';
		if (hasMessage && m.chatmessage.length > 2000) return 0;
		var text = hasMessage ? m.chatmessage.trim() : '', weight = 0, isEvent = false;
		if (typeof m.event === 'string' && m.event) {
			var name = m.event.toLowerCase();
			if (!own(EVENT_WEIGHT, name)) return 0;
			weight = EVENT_WEIGHT[name];
			isEvent = weight > 1;
		} else if (m.event) { weight = 2; isEvent = true; }
		else if (text) weight = 1;
		if (m.hasDonation) { weight = Math.max(weight, 5); isEvent = true; }
		if (!weight) return 0;
		var chatname = typeof m.chatname === 'string' ? m.chatname.trim().slice(0, 40) : '';
		if (!chatname && !isEvent) return 0;
		var type = String(m.type).slice(0, 40);
		var key = JSON.stringify([type, String(m.userid || m.username || chatname || 'event').slice(0, 200)]);
		var id = m.id == null ? null : JSON.stringify([type, String(m.id).slice(0, 200)]);
		if (id) {
			if (this.seen.has(id)) return 0;
			this.seen.add(id);
			if (this.seen.size > 5000) this.seen.delete(this.seen.values().next().value);
		}
		this.advance(t);
		var user = this.users.get(key);
		if (!user) {
			if (this.users.size >= 5000) this.users.delete(this.users.keys().next().value);
			user = { last: -10, name: chatname };
			this.users.set(key, user);
		}
		// One person mashing the keyboard is not a crowd getting excited.
		if (!isEvent && t - user.last < 2) weight *= 0.25;
		user.last = t;
		this.total++;
		this.rate += weight / TAU;
		var entry = { t: t, w: weight, key: key, text: text };
		this.recent.push(entry);
		if (this.recent.length > 400) this.recent.shift();
		this.measure();
		if (this.burst) { this.join(entry); this.peak(); }
		else this.begin();
		return weight;
	};
	// Seconds between messages at this channel's usual pace. A game that pays out
	// "per message" multiplies by this so every chat earns at about the same speed.
	Meter.prototype.share = function () {
		return 1 / Math.max(this.base, this.rate * 0.6, 0.12);
	};
	Meter.prototype.tick = function (t) {
		this.advance(t);
		var ended = this.ended;
		this.ended = null;
		return { rate: this.rate, base: this.base, ref: this.ref, ratio: this.ratio, level: this.level, burst: this.burst, ended: ended, chatters: this.chatters };
	};

	// ---- Games: each one is a different way of spending that excitement ----
	var MODES = {};

	MODES.seismo = {
		begin: function (g) { g.state = { quakes: [], record: null, count: 0 }; },
		tick: function (g, s) {
			if (!s.ended) return;
			var st = g.state, b = s.ended;
			var quake = { id: b.id, start: b.start, end: b.end, seconds: b.seconds, magnitude: b.magnitude, word: b.word, messages: b.messages, chatters: b.chatters };
			st.quakes.push(quake);
			if (st.quakes.length > 8) st.quakes.shift();
			st.count++;
			var record = !st.record || quake.magnitude > st.record.magnitude;
			if (record) st.record = quake;
			g.effect('quake', { quake: quake, record: record });
		}
	};

	function toughness(level) { return Math.pow(1.35, Math.min(level, 30) - 1); }
	function shuffled(n, random) {
		var order = [], i, j, swap;
		for (i = 0; i < n; i++) order.push(i);
		for (i = n - 1; i > 0; i--) { j = Math.floor(random() * (i + 1)); swap = order[i]; order[i] = order[j]; order[j] = swap; }
		return order;
	}
	MODES.city = {
		begin: function (g) {
			var n = clamp(Math.round(g.options.buildings || 16), 6, 40), order = shuffled(n, g.random);
			var st = g.state = { level: 1, integrity: 1, knockdowns: 0, phase: 'standing', phaseAt: 0, shake: 0, buildings: [] };
			for (var i = 0; i < n; i++) st.buildings.push({ floors: 3 + Math.floor(g.random() * 6), width: 0.7 + g.random() * 0.3, style: Math.floor(g.random() * 4), seed: g.random(), breakAt: (order[i] + 0.5) / n, down: false, moved: -99 });
		},
		message: function (g, weight) {
			var st = g.state;
			// Every message is a small tremor, so even a steady chat wears the city down.
			if (st.phase === 'standing') st.integrity -= 0.0006 * weight * g.meter.share() / toughness(st.level);
		},
		tick: function (g, s, dt) {
			var st = g.state, i, b;
			if (st.phase === 'rubble') {
				st.shake = 0;
				if (g.time - st.phaseAt < 3) return;
				// Rebuilt taller and tougher: the next knockdown needs more chat.
				st.level++;
				st.phase = 'rebuilding';
				st.phaseAt = g.time;
				var order = shuffled(st.buildings.length, g.random);
				for (i = 0; i < st.buildings.length; i++) {
					b = st.buildings[i];
					b.floors = Math.min(22, b.floors + (g.random() < 0.6 ? 1 : 2));
					b.breakAt = (order[i] + 0.5) / st.buildings.length;
					b.down = false;
					b.moved = g.time + b.seed * 2.5;
				}
				g.effect('rebuild', { level: st.level });
				return;
			}
			if (st.phase === 'rebuilding') {
				st.integrity = clamp((g.time - st.phaseAt) / 5, 0, 1);
				if (g.time - st.phaseAt >= 5) { st.phase = 'standing'; st.integrity = 1; }
				return;
			}
			// Ordinary chatter does not shake buildings; excitement above normal does.
			var over = s.level - 0.4;
			if (over > 0) st.integrity -= over * 0.1 * (s.burst ? 1.5 : 1) / toughness(st.level) * dt;
			else if (s.level < 0.03 && st.integrity < 1) st.integrity = Math.min(1, st.integrity + 0.0008 * dt);
			st.shake = clamp(over / 0.5, 0, 1);
			if (st.integrity <= 0) {
				st.integrity = 0;
				st.phase = 'rubble';
				st.phaseAt = g.time;
				st.knockdowns++;
				for (i = 0; i < st.buildings.length; i++) {
					b = st.buildings[i];
					if (!b.down) { b.down = true; b.moved = g.time; g.effect('collapse', { index: i }); }
				}
				g.effect('knockdown', { level: st.level });
				return;
			}
			for (i = 0; i < st.buildings.length; i++) {
				b = st.buildings[i];
				if (!b.down && st.integrity <= b.breakAt) { b.down = true; b.moved = g.time; g.effect('collapse', { index: i }); }
				else if (b.down && st.integrity > b.breakAt + 0.03) { b.down = false; b.moved = g.time; g.effect('repair', { index: i }); }
			}
		}
	};

	var BIRD_X = 0.22;
	function altitude(level) { return 0.04 + 0.9 * Math.min(1, level / 0.85); }
	MODES.flight = {
		begin: function (g) { g.state = { phase: 'resting', alt: 0, lift: 0, usual: 0, streak: 0, best: 0, total: 0, gates: [], nextGate: 0, quiet: 0, stun: 0, flaps: 0, flapAt: -10 }; },
		message: function (g) {
			var st = g.state;
			st.flaps++;
			st.flapAt = g.time;
			st.quiet = 0;
			if (st.phase === 'resting') { st.phase = 'flying'; st.usual = g.meter.level; st.nextGate = g.time + 2.5; g.effect('takeoff'); }
		},
		tick: function (g, s, dt) {
			var st = g.state, i, gate, target = 0;
			st.stun = Math.max(0, st.stun - dt);
			// Lift lingers after each message, so a slow chat glides instead of dropping.
			st.lift = Math.max(s.level, st.lift * Math.exp(-dt / 5));
			if (st.phase === 'flying') {
				target = altitude(st.lift);
				st.usual += (s.level - st.usual) * (1 - Math.exp(-dt / 25));
				st.quiet = s.level < 0.04 ? st.quiet + dt : 0;
				if (st.quiet < 10 && g.time >= st.nextGate) {
					// Easy on purpose: wide gaps, set around where this chat usually flies.
					// A long streak spreads them out, so it takes a real push to keep it.
					var hard = Math.min(1, st.streak / 20), gap = 0.46 - 0.08 * hard;
					var center = altitude(st.usual) + 0.04 + (g.random() - 0.5) * (0.1 + 0.34 * hard);
					var low = clamp(center - gap / 2, 0.02, 0.5);
					st.gates.push({ x: 1.15, low: low, top: low + gap, passed: false, hit: false });
					st.nextGate = g.time + 2.6;
				}
				if (st.quiet >= 10 && !st.gates.length) { st.phase = 'resting'; st.streak = 0; g.effect('land'); }
			}
			for (i = 0; i < st.gates.length; i++) {
				gate = st.gates[i];
				gate.x -= 0.16 * dt;
				// Too much hype never hurts: the bird ducks under the top by itself.
				if (!gate.passed && gate.x - BIRD_X < 0.22) target = Math.min(target, gate.top - 0.09);
			}
			st.alt += (target - st.alt) * (1 - Math.exp(-dt / 0.45));
			for (i = 0; i < st.gates.length; i++) {
				gate = st.gates[i];
				if (gate.passed || gate.x > BIRD_X) continue;
				gate.passed = true;
				if (st.stun > 0) continue;
				if (st.alt < gate.low + 0.02 || st.alt > gate.top - 0.02) {
					gate.hit = true;
					st.streak = 0;
					st.stun = 1.2;
					g.effect('bonk');
				} else {
					st.streak++;
					st.total++;
					st.best = Math.max(st.best, st.streak);
					g.effect('gate', { streak: st.streak });
				}
			}
			while (st.gates.length && st.gates[0].x < -0.15) st.gates.shift();
		}
	};

	MODES.volcano = {
		begin: function (g) { g.state = { phase: 'building', phaseAt: 0, pressure: 0, size: 1, eruptions: 0, longest: 0, power: 0 }; },
		need: function (st) { return Math.pow(1.3, Math.min(st.size, 12) - 1); },
		message: function (g, weight) {
			var st = g.state;
			if (st.phase === 'building') st.pressure += 0.0008 * weight * g.meter.share() / MODES.volcano.need(st);
		},
		tick: function (g, s, dt) {
			var st = g.state, elapsed = g.time - st.phaseAt;
			if (st.phase === 'building') {
				st.power = 0;
				if (s.level < 0.05) st.pressure = Math.max(0, st.pressure - 0.0015 * dt);
				else st.pressure += Math.max(0, s.level - 0.15) * 0.07 * (s.burst ? 1.5 : 1) / MODES.volcano.need(st) * dt;
				if (st.pressure >= 1) { st.pressure = 1; st.phase = 'erupting'; st.phaseAt = g.time; g.effect('erupt', { size: st.size }); }
			} else if (st.phase === 'erupting') {
				// Chat decides how long it lasts: it keeps going while the hype does.
				st.power = 0.45 + 0.55 * s.level;
				if (elapsed >= 25 || (elapsed >= 5 && s.level < 0.35)) {
					st.eruptions++;
					st.longest = Math.max(st.longest, elapsed);
					st.phase = 'cooling';
					st.phaseAt = g.time;
					g.effect('cool', { seconds: elapsed });
				}
			} else {
				st.power = 0;
				st.pressure = Math.max(0, 1 - elapsed / 4);
				// A bigger mountain each time, which takes more chat to blow.
				if (elapsed >= 4) { st.phase = 'building'; st.phaseAt = g.time; st.pressure = 0; st.size++; }
			}
		}
	};

	function destination(mission) {
		return mission < MISSIONS.length ? MISSIONS[mission] : MISSIONS[MISSIONS.length - 1] + ' ' + (mission - MISSIONS.length + 2);
	}
	MODES.rocket = {
		begin: function (g) { g.state = { phase: 'flying', phaseAt: 0, progress: 0, mission: 0, completed: 0, thrust: 0, destination: destination(0) }; },
		need: function (st) { return Math.pow(1.35, Math.min(st.mission, 12)); },
		message: function (g, weight) {
			var st = g.state;
			if (st.phase === 'flying') st.progress += 0.001 * weight * g.meter.share() / MODES.rocket.need(st);
		},
		tick: function (g, s, dt) {
			var st = g.state;
			if (st.phase === 'arrived') {
				st.thrust = 0;
				if (g.time - st.phaseAt < 5) return;
				// Every destination is farther than the last.
				st.mission++;
				st.destination = destination(st.mission);
				st.progress = 0;
				st.phase = 'flying';
				st.phaseAt = g.time;
				g.effect('launch', { destination: st.destination });
				return;
			}
			st.thrust = clamp((s.level - 0.2) / 0.6, 0, 1);
			if (s.level > 0.2) st.progress += (s.level - 0.2) * 0.11 * (s.burst ? 1.4 : 1) / MODES.rocket.need(st) * dt;
			else if (s.level < 0.03) st.progress = Math.max(0, st.progress - 0.002 * dt);
			if (st.progress >= 1) {
				st.progress = 1;
				st.completed++;
				st.phase = 'arrived';
				st.phaseAt = g.time;
				g.effect('arrive', { destination: st.destination });
			}
		}
	};

	MODES.campfire = {
		begin: function (g) { g.state = { fuel: 0, stage: 0, lit: false, burning: 0, best: 0, logs: 0 }; },
		message: function (g, weight, name) {
			var st = g.state;
			// Each message is a log on the fire. A chat keeping its usual pace holds a
			// steady campfire, whether that pace is one message a second or one in ten.
			st.fuel = Math.min(1, st.fuel + 0.009 * weight * g.meter.share());
			st.logs++;
			g.effect('log', { name: name });
		},
		tick: function (g, s, dt) {
			var st = g.state;
			// A bigger fire eats wood faster, so it always needs feeding.
			st.fuel = clamp(st.fuel + (0.008 * s.level - (0.0015 + 0.02 * st.fuel)) * dt, 0, 1);
			st.stage = st.fuel < 0.06 ? 0 : st.fuel < 0.3 ? 1 : st.fuel < 0.6 ? 2 : st.fuel < 0.85 ? 3 : 4;
			if (st.stage >= 1) {
				if (!st.lit) { st.lit = true; st.burning = 0; g.effect('lit'); }
				st.burning += dt;
				st.best = Math.max(st.best, st.burning);
			} else if (st.lit && st.fuel < 0.03) { st.lit = false; g.effect('out', { seconds: st.burning }); }
		}
	};

	function Game(mode, options) {
		if (!own(MODES, mode)) throw new Error('Unknown hype game: ' + mode);
		this.mode = mode;
		this.options = options || {};
		this.random = this.options.random || Math.random;
		this.begin();
	}
	Game.prototype.begin = function () {
		this.meter = new Meter(this.options);
		this.time = 0;
		this.effects = [];
		this.inputs = 0;
		this.lastName = '';
		this.burstId = 0;
		this.hype = this.meter.tick(0);
		MODES[this.mode].begin(this);
	};
	Game.prototype.effect = function (type, data) {
		this.effects.push({ type: type, at: this.time, data: data || {} });
		if (this.effects.length > 80) this.effects.shift();
	};
	Game.prototype.takeEffects = function () {
		var list = this.effects;
		this.effects = [];
		return list;
	};
	// Returns true when the payload counted as excitement.
	Game.prototype.input = function (m) {
		var weight = this.meter.message(m, this.time);
		if (!weight) return false;
		var mode = MODES[this.mode];
		this.inputs++;
		this.lastName = typeof m.chatname === 'string' ? m.chatname.trim().slice(0, 40) : '';
		if (mode.message) mode.message(this, weight, this.lastName);
		return true;
	};
	Game.prototype.tick = function (dt) {
		dt = clamp(dt || 0, 0, 0.25);
		this.time += dt;
		var s = this.hype = this.meter.tick(this.time);
		if (s.burst && s.burst.id !== this.burstId) { this.burstId = s.burst.id; this.effect('burst', { id: s.burst.id, start: s.burst.start }); }
		MODES[this.mode].tick(this, s, dt);
	};

	var api = { Game: Game, Meter: Meter, MISSIONS: MISSIONS, STAGES: STAGES, SENSITIVITY: SENSITIVITY, BIRD_X: BIRD_X, magnitude: magnitude, words: words };
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SSNHypeGame = api;
})(typeof window !== 'undefined' ? window : this);
