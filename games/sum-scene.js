// Sum Squad, drawn: chat drops numbered blocks into a glass tube to land exactly on each target line, three targets in a row.
// The rules live in puzzle-party-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	// Everything is drawn in design units: a 1080-high (wide window) or 1080-wide (tall window) box fitted into the browser source.
	var K = window.SSNArcade, st = K.stage(), box = null, W = 1920, H = 1080, px = 1, ox = 0, oy = 0, portrait = false, clock = 0;
	var TARGETS = [20, 30, 40], EXAMPLES = [5, 8, 3, 9, 6, 2, 7, 4], GOLD = '#ffd43b', RED = '#ff6b6b', EDGE = 'rgba(10,14,24,.9)', NAVY = '#1b2233', FALL = 2600;
	// Shading of a block, as [start, width, colour] in shares of its width.
	var BANDS = [[0.012, 0.07, 'rgba(255,255,255,.36)'], [0.082, 0.16, 'rgba(255,255,255,.12)'], [0.7, 0.19, 'rgba(0,0,40,.11)'], [0.89, 0.11, 'rgba(0,0,40,.3)']];
	var faces = {}, byName = {}, seen = { round: 0, stage: 0, total: 0 }, adder = null;
	var snap = { phase: 'waiting', stage: 0, total: 0, target: 20, left: 90, share: 1, round: 0, last: '' };
	var tower = [], queue = [], locked = null, scale = 20, ghost = 5, shown = 0, shownTarget = 20, totalPop = 0, targetPop = 0;
	var callouts = [null, null], side = 0, reject = null, medalAt = [-9, -9, -9], resultAt = -1, won = false, awarded = 0, leaders = [];
	var L = {}, capArt = null, baseArt = null, slabs = {}, stamps = {};
	document.body.classList.add('ssn-scene');

	function body(g, x, y, w, h, r) {
		var grad = g.createLinearGradient(0, y, 0, y + h);
		grad.addColorStop(0, '#4a5780'); grad.addColorStop(0.5, '#2b3454'); grad.addColorStop(1, '#171c32');
		K.rr(g, x, y, w, h, r); g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.strokeStyle = EDGE; g.stroke();
		g.fillStyle = 'rgba(255,255,255,.2)'; K.rr(g, x + 16, y + 6, w - 32, 5, 3); g.fill();
	}
	function layout() {
		var m;
		portrait = st.H > st.W;
		if (portrait) { W = 1080; H = K.clamp(st.H / st.W * 1080, 1600, 2400); } else { H = 1080; W = K.clamp(st.W / st.H * 1080, 1500, 2500); }
		box = K.fit(st, W, H); px = st.k * box.s; ox = st.k * box.x; oy = st.k * box.y;
		L.cx = W / 2; L.tw = portrait ? 460 : 400; L.x0 = L.cx - L.tw / 2;
		L.cap = portrait ? 70 : 50; L.rim = L.cap + 54; L.line = L.rim + 64; L.bot = H - (portrait ? 290 : 140);
		if (portrait) {
			m = (L.x0 - 24) / 2;
			L.side = [m, W - m]; L.sideTop = 900;
			L.readX = m; L.totalY = 450; L.totalS = 190; L.targetY = 616; L.targetS = 96;
			L.ringX = m; L.ringY = 196; L.ringR = 96;
			L.medalX = W - m; L.medalY = 530; L.medalGap = 158;
			L.chipX = W / 2; L.chipY = H - 112; L.chipS = 64;
			L.pod = [[m, 470, 96], [m, 700, 68], [m, 890, 68]];
		} else {
			L.side = [L.x0 - 136, L.x0 + L.tw + 136]; L.sideTop = L.line + 156;
			L.readX = W * 0.165; L.totalY = 400; L.totalS = W < 1760 ? 200 : 250; L.targetY = 650; L.targetS = 124;
			L.ringX = W * 0.835; L.ringY = 250; L.ringR = 116;
			L.medalX = L.ringX; L.medalY = 545; L.medalGap = 140;
			L.chipX = L.ringX; L.chipY = 800; L.chipS = 58;
			L.pod = [[L.readX, 390, 112], [L.readX - 132, 650, 76], [L.readX + 132, 650, 76]];
		}
		slabs = {};
		// The dispenser the blocks drop out of, and the plinth the tube stands on.
		capArt = K.layer((L.tw + 96) * px, (L.rim - L.cap + 8) * px, function (g) {
			g.scale(px, px); body(g, 4, 4, L.tw + 88, L.rim - L.cap, 18);
			g.fillStyle = 'rgba(4,6,14,.85)'; K.rr(g, 64, L.rim - L.cap - 9, L.tw - 32, 9, 4); g.fill();
		});
		baseArt = K.layer((L.tw + 128) * px, 68 * px, function (g) { g.scale(px, px); body(g, 4, 4, L.tw + 120, 60, 18); });
	}
	st.onresize = layout;
	layout();

	// Big pictures are placed on whole screen pixels and drawn at their own size whenever they are not being scaled:
	// without a GPU that is a plain copy, where a fractional position or scale is a slow resample.
	function sx(v) { return (Math.round(v * px + ox) - ox) / px; }
	function sy(v) { return (Math.round(v * px + oy) - oy) / px; }
	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	function clean(name) { return K.short(String(name).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '?', 24); }
	function faceFor(key, name) { return faces[key] || (faces[key] = K.player(key.toLowerCase(), clean(name || key.split(':').slice(1).join(':')))); }
	function current() { return locked && !locked.final ? queue : tower; }
	function size(list) { var n, s = 0; for (n = 0; n < list.length; n++) s += list[n].n; return s; }
	function unit() { return (L.bot - L.line) / scale; }
	// A number that fits right now: exactly what is missing once that is nine or less, otherwise a changing example.
	function example() { var room = snap.target - snap.total; return room <= 9 ? Math.max(1, room) : EXAMPLES[Math.floor(clock / 2.4) % EXAMPLES.length]; }
	function add(n, face) {
		var b = { n: n, face: face || null, color: face ? face.color : K.colors[(tower.length + queue.length) % K.colors.length], at: clock, y: -1e4, h: 0, rest: 0, landed: false, land: 0, called: false };
		if (locked && !locked.final) queue.push(b); else tower.push(b);
	}
	// The finished tower has left: the blocks of the next target, held back until now, start to fall.
	function settle() {
		var n;
		tower = queue; queue = []; locked = null;
		for (n = 0; n < tower.length; n++) tower[n].at = clock + 0.1 + n * 0.16;
	}

	window.SSNScene = {
		chat: function (m, game) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m), face = faces[key] = K.player(key.toLowerCase(), clean(m.chatname), m.chatimg), hit;
			byName[String(m.chatname).slice(0, 48)] = face;
			if (!game) return;
			if (game.round !== seen.round || game.stage !== seen.stage || game.total !== seen.total) { adder = face; seen = { round: game.round, stage: game.stage, total: game.total }; return; }
			// A number that would pass the line is refused by the engine: show it not fitting.
			hit = /^!add\s+([1-9])$/.exec(String(m.chatmessage || '').trim().toLowerCase());
			if (hit && game.phase !== 'result' && !m.bot && !m.private && !m.reflection && !m.event && game.total + (+hit[1]) > game.target && !reject && !locked) {
				reject = { n: +hit[1], at: clock };
				callouts[side ^= 1] = { face: face, text: hit[1], at: clock, b: null, color: RED, bad: true };
				K.shake(st, 5);
			}
		},
		sync: function (game, now) {
			var who = adder, have, ranked;
			adder = null;
			if (!who) who = game.lastPlayer ? faceFor(game.lastPlayer) : game.history[0] ? byName[game.history[0].name] : null;
			if (game.round !== snap.round) {
				// A new match: whatever is still standing drops out of the tube.
				if (tower.length) { if (!locked) locked = { target: snap.target, hit: true, at: -9, plain: true }; locked.final = false; locked.pop = clock; }
				queue = []; resultAt = -1; won = false; medalAt = [-9, -9, -9]; leaders = [];
			} else if (game.stage > snap.stage) {
				// A target was hit exactly: the last block completes the tower, and the tower locks.
				if (locked) settle();
				have = size(tower);
				if (snap.target > have) add(snap.target - have, who);
				locked = { target: snap.target, final: game.stage >= 3, hit: false, at: 0, pop: Infinity, plain: false };
			}
			have = size(current());
			if (game.total > have) add(game.total - have, who);
			seen = { round: game.round, stage: game.stage, total: game.total };
			snap = {
				phase: game.phase, stage: game.stage, total: game.total, target: game.target, round: game.round, last: game.lastPlayer ? String(game.lastPlayer).toLowerCase() : '',
				left: game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : game.phase === 'waiting' ? game.seconds : snap.left,
				share: game.phase === 'active' ? K.clamp((game.deadline - now) / (game.seconds * 1000), 0, 1) : game.phase === 'waiting' ? 1 : snap.share
			};
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock; won = game.stage >= 3; ranked = [];
				game.users.forEach(function (p, key) { ranked.push({ face: faceFor(key, p.name), score: p.score }); });
				ranked.sort(function (a, b) { return b.score - a.score; });
				leaders = won ? ranked.slice(0, 3) : [];
				if (won && awarded !== game.round) {
					awarded = game.round;
					K.awardRound(leaders.map(function (r) { return r.face; }), ranked.map(function (r) { return r.face; }));
				}
			}
		},
		// A livelier demo than the page's own: a squad that mostly adds what fits, sometimes overshoots, and lands each target.
		demo: function (receive, game) {
			var names = K.names.slice(0, 14), turn = 0;
			setInterval(function () {
				var room = game.target - game.total, n;
				if (game.phase === 'result' || locked) return;
				if (room <= 9) n = Math.random() < 0.6 ? room : Math.min(9, room + 1 + Math.floor(Math.random() * 3));
				else n = Math.random() < 0.3 ? +game.previewCommand().slice(5) : 2 + Math.floor(Math.random() * 7);
				receive({ type: 'demo', chatname: names[turn++ % names.length], chatmessage: '!add ' + n, textonly: true });
			}, 640);
		}
	};

	function update(dt) {
		var want = locked ? locked.target : snap.target, n, b, base = 0, un, t, y, landed = 0;
		clock += dt;
		scale = Math.abs(scale - want) < 0.03 ? want : K.approach(scale, want, 9, dt);
		ghost = K.approach(ghost, example(), 12, dt);
		un = unit();
		for (n = 0; n < tower.length; n++) {
			b = tower[n]; b.h = b.n * un; b.rest = L.bot - (base + b.n) * un; base += b.n;
			if (b.landed) { b.y = b.rest; landed += b.n; continue; }
			t = clock - b.at;
			if (t < 0) continue;
			if (!b.called) { b.called = true; if (b.face) callouts[side ^= 1] = { face: b.face, text: '+' + b.n, at: clock, b: b, color: b.color, bad: false }; }
			y = L.rim - b.h + FALL * t * t;
			if (y < b.rest) { b.y = y; continue; }
			// Landed: a thud, a puff at both corners, and the total ticks up.
			b.y = b.rest; b.landed = true; b.land = clock; landed += b.n; totalPop = 1;
			K.shake(st, 3 + b.n * 0.5);
			K.fx.spark(L.x0 + 34, b.rest + b.h, '#ffffff', 5, 240, 4, 0.35); K.fx.spark(L.x0 + L.tw - 34, b.rest + b.h, '#ffffff', 5, 240, 4, 0.35);
		}
		shown = landed;
		if (want !== shownTarget && Math.abs(scale - want) < 3) { shownTarget = want; targetPop = 1; }
		if (locked && !locked.hit && (!tower.length || tower[tower.length - 1].landed)) {
			locked.hit = true; locked.at = clock;
			if (!locked.final) locked.pop = clock + 1;
			medalAt[TARGETS.indexOf(locked.target)] = clock;
			K.shake(st, 13);
			K.fx.spark(L.cx, L.line, GOLD, 44, 760, 7, 0.8); K.fx.spark(L.cx, L.line, '#ffffff', 16, 520, 5, 0.5);
			for (n = 0; n < 3; n++) K.fx.burst(L.x0 + L.tw * (0.15 + n * 0.35), L.line + 30, null, 18, 560);
		}
		if (locked && clock - locked.pop > 0.5) settle();
		if (reject && clock - reject.at > 0.9) reject = null;
		if (totalPop > 0) totalPop = Math.max(0, totalPop - dt * 3.2);
		if (targetPop > 0) targetPop = Math.max(0, targetPop - dt * 2.4);
		if (resultAt >= 0 && won && clock - resultAt < 7 && Math.random() < dt * 6) K.fx.burst(K.rand(0.12, 0.88) * W, K.rand(0.08, 0.5) * H, null, 14, 480);
		K.fx.update(dt);
	}

	function tint(g, size, color) { g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, size, size); g.globalCompositeOperation = 'source-over'; }
	function paintBeam(g) { var grad = g.createLinearGradient(0, 0, 0, 64); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,.75)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64); }
	function paintGoldBeam(g) { paintBeam(g); tint(g, 64, GOLD); }
	function paintRedBeam(g) { paintBeam(g); tint(g, 64, RED); }
	function paintBullseye(g) {
		[[60, RED], [43, '#ffffff'], [27, RED], [10, '#ffffff']].forEach(function (ring, i) {
			g.beginPath(); g.arc(64, 64, ring[0], 0, 6.2832); g.fillStyle = ring[1]; g.fill();
			if (!i) { g.lineWidth = 7; g.strokeStyle = EDGE; g.stroke(); }
		});
	}
	function paintMedal(g, light, mid, dark) {
		var grad = g.createRadialGradient(50, 44, 6, 64, 64, 62);
		grad.addColorStop(0, light); grad.addColorStop(0.55, mid); grad.addColorStop(1, dark);
		g.beginPath(); g.arc(64, 64, 58, 0, 6.2832); g.fillStyle = grad; g.fill(); g.lineWidth = 6; g.strokeStyle = EDGE; g.stroke();
		g.beginPath(); g.arc(64, 64, 49, 0, 6.2832); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.3)'; g.stroke();
	}
	function paintGoldMedal(g) { paintMedal(g, '#fff6c4', '#ffd43b', '#e39b00'); }
	function paintDarkMedal(g) { paintMedal(g, '#35416a', '#1c2440', '#0d1122'); }
	// One block: its chatter's colour with flat bands of light and shade down the sides. The round-cornered ends come from a small
	// picture; the body between them is plain rectangles in the same bands, which cost far less than stretching a picture.
	function slabSprite(color) {
		var s = slabs[color];
		if (s) return s;
		s = slabs[color] = K.layer((L.tw - 12) * px, 96 * px, function (g, cw, ch) {
			var m = 2 * px, n;
			K.rr(g, m, m, cw - m * 2, ch - m * 2, 20 * px); g.fillStyle = color; g.fill();
			g.save(); g.clip();
			for (n = 0; n < BANDS.length; n++) { g.fillStyle = BANDS[n][2]; g.fillRect(Math.round(BANDS[n][0] * cw), 0, Math.round(BANDS[n][1] * cw), ch); }
			g.fillStyle = 'rgba(255,255,255,.34)'; g.fillRect(0, m, cw, 8 * px);
			g.fillStyle = 'rgba(0,0,40,.26)'; g.fillRect(0, ch - 13 * px, cw, 13 * px);
			g.restore();
			K.rr(g, m, m, cw - m * 2, ch - m * 2, 20 * px); g.lineWidth = 4 * px; g.strokeStyle = EDGE; g.stroke();
		});
		return s;
	}
	function slab(ctx, color, y, h) {
		// The pieces meet on whole screen pixels, so there is neither a gap nor an overlap between them.
		var s = slabSprite(color), x = sx(L.x0 + 6), w = s.width / px, top = sy(y), bottom = sy(y + h), cap = Math.min(Math.round(30 * px) / px, Math.floor((bottom - top) * px / 2) / px), sc = Math.round(30 * px), mid = bottom - top - cap * 2, n;
		ctx.drawImage(s, 0, 0, s.width, sc, x, top, w, cap);
		ctx.drawImage(s, 0, s.height - sc, s.width, sc, x, bottom - cap, w, cap);
		if (mid <= 0) return;
		ctx.fillStyle = color; ctx.fillRect(x + 2, top + cap, w - 4, mid);
		for (n = 0; n < BANDS.length; n++) { ctx.fillStyle = BANDS[n][2]; ctx.fillRect(x + Math.round(BANDS[n][0] * s.width) / px, top + cap, Math.round(BANDS[n][1] * s.width) / px, mid); }
		ctx.fillStyle = EDGE; ctx.fillRect(x, top + cap, 4, mid); ctx.fillRect(x + w - 4, top + cap, 4, mid);
	}
	// Large digits: a slimmer outline than K.text, set twice for a little thickness.
	function big(ctx, str, x, y, size, color) {
		ctx.font = K.font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.1; ctx.strokeStyle = EDGE;
		ctx.strokeText(str, x, y + size * 0.04); ctx.strokeText(str, x, y);
		ctx.fillStyle = color; ctx.fillText(str, x, y);
	}
	// Stroking big glyphs every frame is slow without a GPU, so each large number is set once into its own small canvas
	// and drawn from there until it changes. k scales it for a pop.
	function numeral(ctx, slot, str, x, y, size, color, k) {
		var s = stamps[slot] || (stamps[slot] = { c: document.createElement('canvas'), str: null, color: '', size: 0, px: 0, w: 1, h: 1 }), g;
		if (s.str !== str || s.color !== color || s.size !== size || s.px !== px) {
			s.str = str; s.color = color; s.size = size; s.px = px; g = s.c.getContext('2d');
			g.font = K.font(size); s.w = Math.ceil(g.measureText(str).width + size * 0.3); s.h = Math.ceil(size * 1.3);
			s.c.width = Math.max(1, Math.ceil(s.w * px)); s.c.height = Math.max(1, Math.ceil(s.h * px));
			g.setTransform(px, 0, 0, px, 0, 0);
			big(g, str, s.w / 2, s.h / 2, size, color);
		}
		if (k === 1) ctx.drawImage(s.c, sx(x - s.w / 2), sy(y - s.h / 2), s.c.width / px, s.c.height / px);
		else ctx.drawImage(s.c, x - s.w * k / 2, y - s.h * k / 2, s.w * k, s.h * k);
	}
	function padlock(ctx, x, y, s) {
		ctx.lineWidth = s * 0.3; ctx.strokeStyle = EDGE; ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.42, 3.1416, 0); ctx.stroke();
		ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#dfe6f5'; ctx.stroke();
		K.rr(ctx, x - s * 0.72, y - s * 0.3, s * 1.44, s * 1.1, s * 0.22); ctx.fillStyle = '#dfe6f5'; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.14); ctx.strokeStyle = EDGE; ctx.stroke();
	}
	function badge(ctx, x, y, r, text) {
		ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = EDGE; ctx.stroke();
		K.text(ctx, text, x, y + r * 0.06, r * 1.25, NAVY, 'center', false);
	}

	function draw() {
		var ctx = K.begin(st, box), un = unit(), since = resultAt >= 0 ? clock - resultAt : -1, fail = since >= 0 && !won, room = snap.target - snap.total;
		var n, b, y, h, e, k, r, x, w, c, gold, drop, hot, low, done, cur, top, pulse = 0.5 + Math.sin(clock * 5) * 0.5, x1 = L.x0 + L.tw, last = tower.length - 1, tall = L.bot - L.rim + 6;
		K.shadow(ctx, L.cx, L.bot + 64, L.tw * 0.8, 28, 0.5);
		ctx.fillStyle = 'rgba(14,21,42,.76)'; ctx.fillRect(L.x0, L.rim - 6, L.tw, tall);

		// Inside the glass: the scale on the wall, a few bubbles, then the tower.
		ctx.save(); ctx.beginPath(); ctx.rect(L.x0, L.rim, L.tw, L.bot - L.rim); ctx.clip();
		ctx.beginPath();
		for (n = 1; n <= 44; n++) { y = L.bot - n * un; if (y < L.line - 2) break; k = n % 10 === 0 ? 34 : n % 5 === 0 ? 22 : 12; ctx.moveTo(x1 - k, y); ctx.lineTo(x1, y); }
		ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.stroke();
		ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.16)';
		for (n = 0; n < 7; n++) {
			e = (clock * (0.05 + n * 0.011) + n * 0.37) % 1;
			ctx.beginPath(); ctx.arc(L.x0 + 50 + (n * 0.618 % 1) * (L.tw - 100) + Math.sin(clock * 1.3 + n * 2) * 10, L.bot - e * (L.bot - L.rim), 5 + n % 3 * 3, 0, 6.2832); ctx.stroke();
		}
		gold = locked && locked.hit && !locked.plain ? K.clamp((clock - locked.at) / 0.25, 0, 1) : 0;
		drop = locked && clock > locked.pop ? 3600 * (clock - locked.pop) * (clock - locked.pop) : 0;
		for (n = 0; n < tower.length; n++) {
			b = tower[n];
			if (b.y < -9000) continue;
			// A landed block squashes and springs back.
			e = b.landed ? 0.22 * (1 - K.elastic((clock - b.land) / 0.6)) : 0;
			b.dh = b.h * (1 - e); b.dy = b.y + b.h - b.dh + drop;
			slab(ctx, gold >= 1 ? GOLD : b.color, b.dy, b.dh);
			if (gold > 0 && gold < 1) { k = ctx.globalAlpha; ctx.globalAlpha = k * gold; slab(ctx, GOLD, b.dy, b.dh); ctx.globalAlpha = k; }
		}
		for (n = 0; n < tower.length; n++) {
			b = tower[n];
			if (b.y < -9000) continue;
			y = b.dy + b.dh / 2; r = K.clamp(b.dh / 2 - 6, 15, 46);
			K.label(ctx, String(b.n), L.cx, y + 1, K.clamp(b.dh * 0.6, 18, 70), '#ffffff');
			if (!b.face) continue;
			x = n % 2 ? x1 - 30 - r : L.x0 + 36 + r;
			K.face(ctx, b.face, x, y, r);
			// The last chatter to add must wait for someone else to go.
			if (n === last && b.landed && !locked && snap.phase === 'active' && b.face.key === snap.last) padlock(ctx, x + r * 0.78, y + r * 0.62, Math.max(9, r * 0.42));
		}
		// Out of time: the lights go down on whatever was built.
		if (fail) { ctx.globalAlpha = K.clamp(since / 0.8, 0, 1) * 0.62; ctx.fillStyle = '#0e152a'; ctx.fillRect(L.x0, L.rim, L.tw, L.bot - L.rim); }
		ctx.globalAlpha = 1;
		// Where the next block would sit: the same number the chip suggests, drawn to scale under the line.
		if (!locked && snap.phase !== 'result' && room > 0 && !reject) {
			h = ghost * un; top = L.bot - (size(tower) + ghost) * un; c = room <= 9 ? GOLD : '#ffffff';
			ctx.globalAlpha = 0.34 + pulse * 0.3;
			K.rr(ctx, L.x0 + 12, top + 5, L.tw - 24, Math.max(6, h - 10), 16); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
			ctx.setLineDash([16, 11]); ctx.lineDashOffset = -clock * 34; ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.stroke(); ctx.setLineDash([]);
			K.label(ctx, String(example()), L.cx, top + h / 2 + 1, K.clamp(h * 0.6, 18, 70), c);
			ctx.globalAlpha = 1;
		}
		if (reject) {
			e = clock - reject.at; h = reject.n * un; top = L.bot - (size(tower) + reject.n) * un; x = Math.sin(e * 46) * 8 * K.clamp(1 - e / 0.7, 0, 1);
			ctx.globalAlpha = (0.45 + Math.abs(Math.sin(e * 14)) * 0.4) * K.clamp((0.9 - e) / 0.2, 0, 1);
			K.rr(ctx, L.x0 + 12 + x, top + 5, L.tw - 24, h - 10, 16); ctx.fillStyle = 'rgba(255,107,107,.5)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = RED; ctx.stroke();
			K.label(ctx, String(reject.n), L.cx + x, (Math.max(top, L.rim) + top + h) / 2, K.clamp(h * 0.6, 22, 70), '#ffffff');
			ctx.globalAlpha = 1;
		}
		if (locked && locked.hit && !locked.plain && !K.calm && clock - locked.at < 0.4) { ctx.globalAlpha = (1 - (clock - locked.at) / 0.4) * 0.75; ctx.fillStyle = '#ffffff'; ctx.fillRect(L.x0, L.rim, L.tw, L.bot - L.rim); ctx.globalAlpha = 1; }
		// The target line: a beam across the tube that flares when a tower lands on it and turns red when a number will not fit.
		hot = locked && locked.hit && !locked.plain ? Math.max(won ? 0.45 + Math.sin(clock * 5) * 0.25 : 0, 1 - (clock - locked.at) / 0.7) : 0;
		c = reject ? RED : GOLD;
		ctx.drawImage(reject ? K.sprite('sumbeam:r', 64, 64, paintRedBeam) : K.sprite('sumbeam:g', 64, 64, paintGoldBeam), L.x0, L.line - 30 - hot * 26, L.tw, 60 + hot * 52);
		ctx.restore();
		ctx.fillStyle = c; ctx.fillRect(L.x0 - 12, L.line - 3.5, L.tw + 24, 7);
		ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(L.x0 - 12, L.line - 1 - hot * 2, L.tw + 24, 2 + hot * 4);
		// The glass itself: two walls and a long highlight, drawn as plain rectangles because they cover a lot of pixels.
		ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(L.x0 + 12, L.rim + 30, 9, tall - 86);
		ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(L.x0 + 28, L.rim + 30, 5, tall * 0.5); ctx.fillRect(x1 - 20, L.rim + 60, 6, tall * 0.4);
		ctx.fillStyle = 'rgba(206,228,255,.34)'; ctx.fillRect(L.x0 - 12, L.rim - 6, 12, tall); ctx.fillRect(x1, L.rim - 6, 12, tall);
		ctx.lineWidth = 3; ctx.strokeStyle = EDGE; ctx.strokeRect(L.x0 - 12, L.rim - 6, L.tw + 24, tall);
		ctx.drawImage(capArt, sx(L.x0 - 48), sy(L.cap - 4), capArt.width / px, capArt.height / px);
		ctx.drawImage(baseArt, sx(L.x0 - 64), sy(L.bot - 4), baseArt.width / px, baseArt.height / px);
		for (n = 10; n < shownTarget; n += 10) { y = L.bot - n * un; if (y > L.line + 40) K.label(ctx, String(n), L.x0 - 24, y, 24, '#aab8d8', 'right'); }
		// The target, flagged right on its line.
		k = 1 + targetPop * 0.3;
		ctx.save(); ctx.translate(x1 + 18, L.line); ctx.scale(k, k);
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -30); ctx.lineTo(118, -30); ctx.lineTo(118, 30); ctx.lineTo(24, 30); ctx.closePath();
		ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = EDGE; ctx.stroke(); ctx.fillStyle = reject ? RED : GOLD; ctx.fill();
		K.text(ctx, String(shownTarget), 70, 2, 46, NAVY, 'center', false);
		ctx.restore();

		// Whoever just added (or was refused) pops up beside their block.
		for (n = 0; n < 2; n++) {
			c = callouts[n];
			if (!c) continue;
			e = clock - c.at;
			if (e > 2.8 || (won && since > 0.3)) { callouts[n] = null; continue; }
			k = K.back(e / 0.3) * K.clamp((2.8 - e) / 0.25, 0, 1); r = 58 * k;
			x = L.side[n] + (c.bad ? Math.sin(e * 40) * 7 * K.clamp(1 - e / 0.6, 0, 1) : 0);
			y = K.clamp(c.b ? c.b.rest + c.b.h / 2 : L.sideTop, L.sideTop, L.bot - 80) - Math.abs(Math.sin(e * 7)) * 14 * K.clamp(1 - e, 0, 1);
			K.shadow(ctx, x, y + r * 1.04, r * 0.9, r * 0.22, 0.4);
			K.face(ctx, c.face, x, y, r);
			if (k > 0.8) {
				K.label(ctx, K.short(c.face.name, 11), x, y + r + 24, 25, '#ffffff');
				K.label(ctx, c.text, x, y - r - 30, 50, c.color);
				if (c.bad) { ctx.lineCap = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = RED; ctx.beginPath(); ctx.moveTo(x - 26, y - r - 14); ctx.lineTo(x + 26, y - r - 46); ctx.stroke(); ctx.lineCap = 'butt'; }
			}
		}

		// The running total over the target.
		if (!(since >= 0 && won)) {
			numeral(ctx, 'total', String(shown), L.readX, L.totalY, L.totalS, fail ? '#ff8787' : '#ffffff', 1 + totalPop * 0.2);
			y = (L.totalY + L.targetY) / 2 + L.totalS * 0.12;
			K.rr(ctx, L.readX - L.targetS * 0.9, y - 6, L.targetS * 1.8, 12, 6); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = EDGE; ctx.stroke();
			ctx.font = K.font(L.targetS); w = ctx.measureText(String(shownTarget)).width; r = L.targetS * 0.34;
			x = L.readX - (w + r * 2 + 16) / 2;
			ctx.drawImage(K.sprite('sumbullseye', 128, 128, paintBullseye), x, L.targetY - r, r * 2, r * 2);
			numeral(ctx, 'target', String(shownTarget), x + r * 2 + 16 + w / 2, L.targetY, L.targetS, GOLD, 1 + targetPop * 0.25);
		} else {
			for (n = 0; n < leaders.length; n++) {
				c = leaders[n]; k = K.back((since - 0.5 - n * 0.22) / 0.45);
				if (k <= 0) continue;
				x = L.pod[n][0]; r = L.pod[n][2] * k; y = L.pod[n][1] - Math.abs(Math.sin(since * 5 + n * 1.3)) * 16;
				K.shadow(ctx, x, L.pod[n][1] + r * 1.05, r * 0.9, r * 0.2, 0.4);
				K.bigFace(ctx, c.face, x, y, r);
				if (!n) K.crown(ctx, x, y - r * 0.92, r * 0.5);
				badge(ctx, x + r * 0.74, y + r * 0.7, r * 0.34, String(c.score));
				K.label(ctx, K.short(c.face.name, 11), x, L.pod[n][1] + r + 30, n ? 25 : 30, '#ffffff');
			}
		}

		// Time left in the match.
		low = snap.phase === 'active' && snap.left <= 10;
		K.shadow(ctx, L.ringX, L.ringY + L.ringR * 1.22, L.ringR, L.ringR * 0.2, 0.4);
		ctx.beginPath(); ctx.arc(L.ringX, L.ringY, L.ringR, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
		K.ring(ctx, L.ringX, L.ringY, L.ringR, fail ? 0 : snap.share, low || fail ? RED : won ? GOLD : '#ffffff', L.ringR * 0.15);
		ctx.globalAlpha = snap.phase === 'waiting' ? 0.6 : 1;
		numeral(ctx, 'clock', String(fail ? 0 : snap.left), L.ringX, L.ringY + 3, L.ringR * 0.8, low || fail ? '#ff8787' : '#ffffff', low ? 1 + pulse * 0.08 : 1);
		ctx.globalAlpha = 1;

		// The three targets: gold once landed, ringed while it is the one being built.
		ctx.lineCap = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(12,16,28,.8)';
		ctx.beginPath(); ctx.moveTo(L.medalX - (portrait ? 0 : L.medalGap), L.medalY - (portrait ? L.medalGap : 0)); ctx.lineTo(L.medalX + (portrait ? 0 : L.medalGap), L.medalY + (portrait ? L.medalGap : 0)); ctx.stroke(); ctx.lineCap = 'butt';
		for (n = 0; n < 3; n++) {
			x = L.medalX + (portrait ? 0 : (n - 1) * L.medalGap); y = L.medalY + (portrait ? (n - 1) * L.medalGap : 0);
			done = medalAt[n] >= 0; cur = !done && snap.phase !== 'result' && TARGETS[n] === shownTarget;
			r = 56 * (done ? 0.6 + 0.4 * K.back((clock - medalAt[n]) / 0.5) : 1);
			K.shadow(ctx, x, y + 62, 50, 11, 0.4);
			if (done && clock - medalAt[n] < 1.2) K.glow(ctx, x, y, 150, GOLD, 0.8 * (1 - (clock - medalAt[n]) / 1.2), true);
			ctx.drawImage(done ? K.sprite('summedal:g', 128, 128, paintGoldMedal) : K.sprite('summedal:d', 128, 128, paintDarkMedal), x - r * 1.14, y - r * 1.14, r * 2.28, r * 2.28);
			if (cur) { ctx.globalAlpha = 0.45 + pulse * 0.5; ctx.beginPath(); ctx.arc(x, y, 64 + pulse * 5, 0, 6.2832); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.globalAlpha = 1; }
			if (done) K.text(ctx, String(TARGETS[n]), x, y + 2, 46 * r / 56, NAVY, 'center', false);
			else K.label(ctx, String(TARGETS[n]), x, y + 2, 46, cur ? '#ffffff' : '#8795b6');
		}

		// The one thing to type.
		if (snap.phase !== 'result') {
			K.hint(ctx, '!add ' + example(), L.chipX, L.chipY, L.chipS);
			if (snap.phase === 'waiting') K.bubble(ctx, L.chipX + L.chipS * 2.4, L.chipY - L.chipS * 0.8, 0.8, clock);
		}
		K.fx.draw(ctx);
	}

	window.SSNSumScene = { state: function () { return { phase: snap.phase, stage: snap.stage, total: snap.total, target: snap.target, blocks: current().length }; } };
	K.loop(update, draw);
})();
