// Trivia: a quiz show for chat. A question and four lettered answers appear; chat types a, b, c or d and fast right answers score most.
// Fills any window with its own wide and tall layouts. Questions come from trivia-packs.js, or from a host's own file with &questions=.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage();
	var SECS = K.num('time', K.demo ? 7 : 20, 8, 60), ROUNDS = Math.round(K.num('rounds', K.demo ? 4 : 10, 3, 30));
	var PAD = 26, GLOW = 84, DROP = 0.95, SINK = 8, LIFT = 1.05, INTRO = 1.1, TRAY_MAX = 60, FLY_MAX = 22, PODIUM = K.demo ? 8.5 : 12;
	var KEYS = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 }, LETTERS = 'abcd';
	var TILE = [
		{ top: '#ff8a8a', bot: '#ee4f5c', lip: '#ad3344', glow: '#ff9c9c' },
		{ top: '#68beff', bot: '#3a8fe8', lip: '#2763ac', glow: '#8accff' },
		{ top: '#ffc24d', bot: '#f0920c', lip: '#b06806', glow: '#ffd988' },
		{ top: '#78e08b', bot: '#3cb65a', lip: '#25803c', glow: '#9af2aa' }
	];
	// The podium in its own units, 1100 wide: one set of blocks for a wide window and a taller set for a tall one.
	var POD_WIDE = [{ x: 370, w: 360, top: 420, r: 140, name: 84, score: 166, size: 70 }, { x: 30, w: 340, top: 500, r: 104, name: 68, score: 136, size: 54 }, { x: 730, w: 340, top: 560, r: 96, name: 56, score: 114, size: 46 }];
	var POD_TALL = [{ x: 370, w: 360, top: 470, r: 165, name: 96, score: 196, size: 84 }, { x: 30, w: 340, top: 590, r: 138, name: 80, score: 160, size: 62 }, { x: 730, w: 340, top: 680, r: 128, name: 70, score: 140, size: 54 }];
	var POD = POD_WIDE;
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	// ---- Layout: a design box per shape, placed in the comfortable middle of the window ----
	var L = { W: 1600, H: 900, wide: true, top: {}, q: {}, tray: {}, ring: {}, tiles: [{}, {}, {}, {}], ps: 1, pox: 0, poy: 0, pb: 720 };
	var box = { x: 0, y: 0, s: 1 }, rs = 1, dirty = true, spr = { q: null, glow: null, win: null, top: null, tile: [], dim: [] }, topSeen = [];
	function rect(r, x, y, w, h) { r.x = x; r.y = y; r.w = w; r.h = h; }
	st.onresize = function () {
		var wide = st.W >= st.H, m = Math.min(st.W, st.H) * 0.03, a = K.align, fit, s, n;
		L.wide = wide; L.W = wide ? 1600 : 1000; L.H = wide ? 900 : 1560;
		fit = Math.min((st.W - m * 2) / L.W, (st.H - m * 2) / L.H);
		s = box.s = Math.min(fit, fit * (wide ? 0.74 : 0.84) * K.scale);
		box.x = a.indexOf('left') >= 0 ? m : a.indexOf('right') >= 0 ? st.W - L.W * s - m : (st.W - L.W * s) / 2;
		box.y = a.indexOf('top') >= 0 ? m : a.indexOf('bottom') >= 0 ? st.H - L.H * s - m : (st.H - L.H * s) / 2;
		if (wide) {
			rect(L.top, 290, 0, 1020, 92); rect(L.q, 0, 112, 1600, 262); rect(L.tray, 60, 392, 1480, 64);
			for (n = 0; n < 4; n++) rect(L.tiles[n], (n % 2) * 812, 476 + Math.floor(n / 2) * 216, 788, 200);
			L.ring.x = 800; L.ring.y = 684; L.ring.r = 58;
		} else {
			rect(L.top, 0, 0, 1000, 92); rect(L.q, 0, 112, 1000, 400); rect(L.tray, 150, 546, 850, 72);
			for (n = 0; n < 4; n++) rect(L.tiles[n], 0, 652 + n * 228, 1000, 208);
			L.ring.x = 64; L.ring.y = 582; L.ring.r = 50;
		}
		POD = wide ? POD_WIDE : POD_TALL; L.pb = wide ? 720 : 940;
		L.ps = Math.min(L.W / 1100, L.H / (L.pb + 40)); L.pox = (L.W - 1100 * L.ps) / 2; L.poy = (L.H - (L.pb + 40) * L.ps) / 2 + 20 * L.ps;
		rs = K.clamp(st.k * s, 0.25, 2);
		dirty = true;
	};

	// ---- Text fitting: wrap, then shrink until the lines fit the box. A word is only split when it cannot fit at the smallest size. ----
	var splitWord = false;
	function wrap(g, text, maxW) {
		var words = text.split(' '), lines = [], line = '', n, test, chars, i;
		splitWord = false;
		for (n = 0; n < words.length; n++) {
			test = line ? line + ' ' + words[n] : words[n];
			if (g.measureText(test).width <= maxW) { line = test; continue; }
			if (line) lines.push(line);
			line = words[n];
			// A single word wider than the box is broken between characters.
			while (g.measureText(line).width > maxW && line.length > 1) {
				chars = Array.from(line);
				for (i = chars.length - 1; i > 1 && g.measureText(chars.slice(0, i).join('')).width > maxW; i--) {}
				lines.push(chars.slice(0, i).join('')); line = chars.slice(i).join(''); splitWord = true;
			}
		}
		if (line) lines.push(line);
		return lines;
	}
	function fitText(g, text, maxW, maxH, big, small) {
		var size = big, lines;
		for (;;) {
			g.font = K.font(size);
			lines = wrap(g, text, maxW);
			if ((lines.length * size * 1.2 <= maxH && !splitWord) || size <= small) return { size: size, lines: lines };
			size = Math.max(small, size - Math.max(1, Math.round(size * 0.06)));
		}
	}
	function drawLines(g, fit, x, cy, align, stroke) {
		var n, y = cy - (fit.lines.length - 1) * fit.size * 0.6;
		g.font = K.font(fit.size); g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
		for (n = 0; n < fit.lines.length; n++, y += fit.size * 1.2) {
			if (stroke) { g.fillStyle = stroke; g.fillText(fit.lines[n], x, y + Math.max(2, fit.size * 0.07)); }
			g.fillStyle = '#fff'; g.fillText(fit.lines[n], x, y);
		}
	}

	// ---- Painted once per question: the question card and the four answer tiles (plain and dimmed) ----
	function paintTile(g, w, h, n, text) {
		var c = TILE[n], lip = 12, fh = h - lip, r = 30, cr = Math.min(56, fh * 0.31), cx = 32 + cr, cy = fh / 2, grad, tx;
		g.save(); g.shadowColor = 'rgba(4,8,20,.5)'; g.shadowBlur = 16 * rs; g.shadowOffsetY = 6 * rs;
		K.rr(g, 0, lip, w, fh, r); g.fillStyle = c.lip; g.fill(); g.restore();
		grad = g.createLinearGradient(0, 0, 0, fh); grad.addColorStop(0, c.top); grad.addColorStop(1, c.bot);
		K.rr(g, 0, 0, w, fh, r); g.fillStyle = grad; g.fill();
		g.save(); K.rr(g, 0, 0, w, fh, r); g.clip();
		grad = g.createLinearGradient(0, 0, 0, fh * 0.55); grad.addColorStop(0, 'rgba(255,255,255,.3)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = grad; g.fillRect(0, 0, w, fh * 0.55);
		g.restore();
		K.rr(g, 1.5, 1.5, w - 3, fh - 3, r - 1.5); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke();
		g.beginPath(); g.arc(cx, cy + 5, cr, 0, 6.2832); g.fillStyle = 'rgba(10,14,24,.24)'; g.fill();
		g.beginPath(); g.arc(cx, cy, cr, 0, 6.2832); g.fillStyle = '#fff'; g.fill();
		g.font = K.font(cr * 1.22, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c.lip; g.fillText('ABCD'.charAt(n), cx, cy + cr * 0.07);
		tx = cx + cr + 28;
		drawLines(g, fitText(g, text, w - tx - (L.wide ? 56 : 40), fh - 34, 58, 20), tx, cy, 'left', 'rgba(10,14,24,.34)');
	}
	function paintQuestion(g, w, h) {
		var grad = g.createLinearGradient(0, 0, 0, h), gap = Math.min(26, (w - 160) / ROUNDS), x = w / 2 - gap * (ROUNDS - 1) / 2, n;
		grad.addColorStop(0, 'rgba(27,35,60,.95)'); grad.addColorStop(1, 'rgba(11,15,28,.95)');
		g.save(); g.shadowColor = 'rgba(4,8,20,.45)'; g.shadowBlur = 18 * rs; g.shadowOffsetY = 8 * rs;
		K.rr(g, 0, 0, w, h, 38); g.fillStyle = grad; g.fill(); g.restore();
		K.rr(g, 1, 1, w - 2, h - 2, 37); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.14)'; g.stroke();
		// One dot per question in the game; the gold one is this question.
		for (n = 0; n < ROUNDS; n++) {
			g.beginPath(); g.arc(x + n * gap, 32, n + 1 === number ? 8 : 5, 0, 6.2832);
			g.fillStyle = n + 1 === number ? '#ffd43b' : n + 1 < number ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.2)'; g.fill();
		}
		drawLines(g, fitText(g, cur.text, w - 110, h - 92, L.wide ? 68 : 62, 22), w / 2, h / 2 + 18, 'center', '');
	}
	function layer(r, paint) {
		return K.layer((r.w + PAD * 2) * rs, (r.h + PAD * 2) * rs, function (g) { g.scale(rs, rs); g.translate(PAD, PAD); paint(g, r.w, r.h); });
	}
	function build() {
		var n;
		dirty = false;
		if (!cur) return;
		spr.q = layer(L.q, paintQuestion);
		// A halo the shape of a tile, shown behind the right answer. Painted at the size the tile lifts to.
		spr.glow = K.layer((L.tiles[0].w + GLOW * 2) * rs * LIFT, (L.tiles[0].h + GLOW * 2) * rs * LIFT, function (g) {
			g.scale(rs * LIFT, rs * LIFT); g.translate(GLOW, GLOW);
			g.shadowColor = g.fillStyle = TILE[cur.correct].glow; g.shadowBlur = 44 * rs;
			K.rr(g, 8, 8, L.tiles[0].w - 16, L.tiles[0].h - 22, 30); g.fill(); g.fill();
		});
		for (n = 0; n < 4; n++) {
			spr.tile[n] = layer(L.tiles[n], function (g, w, h) { paintTile(g, w, h, n, cur.options[n]); });
			// The dimmed copy for a wrong answer: the same tile under a wash of dark glass, already dropped back to its resting size.
			spr.dim[n] = K.layer(spr.tile[n].width, spr.tile[n].height, function (g, w, h) {
				g.drawImage(spr.tile[n], w * (1 - DROP) / 2, h * (1 - DROP) / 2 + SINK * rs, w * DROP, h * DROP);
				g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(13,18,32,.7)'; g.fillRect(0, 0, w, h);
			});
		}
		spr.win = K.layer(spr.tile[cur.correct].width * LIFT, spr.tile[cur.correct].height * LIFT, function (g, w, h) { g.drawImage(spr.tile[cur.correct], 0, 0, w, h); });
		spr.top = null;
	}
	function chip(n) {
		return K.sprite('trivia:chip' + n, 348, 348, function (g) {
			var c = TILE[n], grad = g.createLinearGradient(0, 24, 0, 300);
			g.save(); g.shadowColor = 'rgba(4,8,20,.45)'; g.shadowBlur = 20; g.shadowOffsetY = 8;
			K.rr(g, 24, 44, 300, 280, 64); g.fillStyle = c.lip; g.fill(); g.restore();
			grad.addColorStop(0, c.top); grad.addColorStop(1, c.bot);
			K.rr(g, 24, 24, 300, 276, 64); g.fillStyle = grad; g.fill();
			g.save(); K.rr(g, 24, 24, 300, 276, 64); g.clip();
			grad = g.createLinearGradient(0, 24, 0, 170); grad.addColorStop(0, 'rgba(255,255,255,.34)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = grad; g.fillRect(24, 24, 300, 150); g.restore();
			K.rr(g, 27, 27, 294, 270, 61); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke();
			g.font = K.font(190, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
			g.lineWidth = 22; g.strokeStyle = 'rgba(10,14,24,.3)'; g.strokeText('ABCD'.charAt(n), 174, 176);
			g.fillStyle = '#fff'; g.fillText('ABCD'.charAt(n), 174, 172);
		});
	}
	function rays() {
		return K.sprite('trivia:rays', 512, 512, function (g) {
			var grad = g.createRadialGradient(256, 256, 30, 256, 256, 256), n;
			grad.addColorStop(0, 'rgba(255,224,102,.5)'); grad.addColorStop(1, 'rgba(255,224,102,0)');
			g.fillStyle = grad;
			for (n = 0; n < 12; n++) { g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 256, n * 0.5236, n * 0.5236 + 0.2618); g.closePath(); g.fill(); }
		});
	}

	// ---- Questions ----
	var deck = [], deckAt = 0, lastAsked = null;
	function shuffle(a) { for (var i = a.length - 1, j, t; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
	function builtIn() {
		var packs = window.SSNTriviaPacks || {}, has = Object.prototype.hasOwnProperty, out = [];
		var want = (K.params.get('pack') || '').toLowerCase().split(',').map(function (v) { return v.trim(); }).filter(function (v) { return has.call(packs, v) && Array.isArray(packs[v]); });
		if (!want.length) want = Object.keys(packs).filter(function (v) { return Array.isArray(packs[v]); });
		want.forEach(function (name) { packs[name].forEach(function (q) { out.push({ q: q, pack: name }); }); });
		return out;
	}
	function tidy(text, max) { return K.short(text.replace(/[\u0000-\u001F\u007F\s]+/g, ' ').trim(), max); }
	// A host's own file: only rows of five strings are kept, as plain text, trimmed to what the tiles can show.
	function clean(data) {
		var out = [], n, i, row, q;
		if (!Array.isArray(data)) return out;
		for (n = 0; n < data.length && n < 5000 && out.length < 500; n++) {
			q = data[n];
			if (!Array.isArray(q) || q.length !== 5) continue;
			for (row = [], i = 0; i < 5 && typeof q[i] === 'string' && q[i].length <= 2000; i++) row.push(tidy(q[i], i ? 40 : 140));
			if (row.length < 5 || row.indexOf('') >= 0) continue;
			for (i = 2; i < 5 && row[i].toLowerCase() !== row[1].toLowerCase(); i++) {}
			if (i === 5) out.push({ q: row, pack: 'custom' });
		}
		return out;
	}
	function load(url, done) {
		var ctl = window.AbortController ? new AbortController() : null, finished = false, timer;
		function finish(list) { if (finished) return; finished = true; clearTimeout(timer); done(list); }
		timer = setTimeout(function () { finish([]); if (ctl) ctl.abort(); }, 6000);
		try {
			fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
				.then(function (r) { if (!r.ok) throw new Error('status'); return r.text(); })
				.then(function (text) { if (text.length > 600000) throw new Error('size'); finish(clean(JSON.parse(text))); })
				.catch(function () { finish([]); });
		} catch (_) { finish([]); }
	}
	function nextQuestion() {
		var t;
		if (deckAt >= deck.length) {
			shuffle(deck); deckAt = 0;
			if (deck.length > 1 && deck[0] === lastAsked) { t = deck[0]; deck[0] = deck[deck.length - 1]; deck[deck.length - 1] = t; }
		}
		return (lastAsked = deck[deckAt++]);
	}

	// ---- The show ----
	var phase = 'load', phaseT = 0, clock = 0, number = 0, quiet = 0, askStart = 0, deadline = 0, revealLen = 0, lastLand = 0;
	var cur = null, answers = [], byKey = {}, fliers = [], script = [];
	var scores = {}, scoreCount = 0, shown = [], topPop = 0, ranked = false, podium = null, nextConfetti = 0;
	var M = null, PX = 0, PY = 0, PR = 0, popEvery = 1, tagName = '', tagW = 0, nextSpark = 0, podShift = 0;

	function rank() {
		shown = Object.keys(scores).map(function (k) { return scores[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 3).map(function (s) { return { p: s.p, total: s.total }; });
		spr.top = null;
	}
	// Demo chat: a believable spread of answers, mostly right on the easier questions.
	function plan() {
		var names = shuffle(K.names.slice()), count = Math.round(K.rand(9, 16)), ease = K.rand(0.5, 0.92), n, pick;
		script.length = 0;
		for (n = 0; n < count; n++) {
			pick = Math.random() < ease ? cur.correct : (cur.correct + 1 + Math.floor(Math.random() * 3)) % 4;
			script.push({ at: askStart + 300 + Math.pow(Math.random(), 1.4) * (SECS * 1000 - 800), name: names[n], text: Math.random() < 0.2 ? String(pick + 1) : LETTERS.charAt(pick) });
		}
		script.sort(function (a, b) { return b.at - a.at; });
	}
	function ask() {
		var item = nextQuestion(), order = shuffle([0, 1, 2, 3]), n;
		number++;
		cur = { text: item.q[0], options: [], correct: order.indexOf(0), pack: item.pack };
		for (n = 0; n < 4; n++) cur.options.push(item.q[1 + order[n]]);
		answers = []; byKey = {}; fliers.length = 0;
		phase = 'ask'; phaseT = 0; dirty = true;
		askStart = Date.now() + INTRO * 1000; deadline = askStart + SECS * 1000;
		if (K.demo) plan();
	}
	function newGame() {
		scores = {}; scoreCount = 0; shown = []; number = 0; quiet = 0; podium = null;
		ask();
	}
	function rest() {
		scores = {}; scoreCount = 0; shown = []; number = 0; cur = null; answers = []; byKey = {}; fliers.length = 0; podium = null;
		phase = 'idle'; phaseT = 0;
	}
	function trayStep(count) { return count > 1 ? Math.min(58, (L.tray.w - 150) / (count - 1)) : 58; }
	// Where the nth fastest right answer lands: along the top edge of the correct tile, the fastest first and largest.
	function perch(n) {
		var T = L.tiles[cur.correct], first = 50, r = 31, x0 = T.x + 40 + first, x1 = x0 + first + tagW + 64 + r, step;
		if (n === 0) { PX = x0; PY = T.y - first * 0.42; PR = first; return; }
		step = fliers.length > 2 ? Math.min(r * 2 + 8, (T.x + T.w - 36 - r - x1) / (fliers.length - 2)) : 0;
		PX = x1 + (n - 1) * step; PY = T.y - r * 0.42; PR = r;
	}
	function reveal() {
		var T = L.tiles[cur.correct], tr = L.tray, step = trayStep(Math.min(answers.length, TRAY_MAX)), right = [], n, a, s, room;
		phase = 'reveal'; phaseT = 0; ranked = false;
		quiet = answers.length ? 0 : quiet + 1;
		for (n = 0; n < answers.length; n++) {
			a = answers[n];
			if (a.pick !== cur.correct) continue;
			s = scores[a.p.key];
			if (!s) { if (scoreCount >= 4000) continue; s = scores[a.p.key] = { p: a.p, total: 0 }; scoreCount++; }
			a.pts = 100 + Math.round(100 * K.clamp(1 - a.t / SECS, 0, 1));
			s.p = a.p; s.total += a.pts;
			if (right.length < FLY_MAX) { a.i = n; right.push(a); }
		}
		popEvery = 1; lastLand = 0;
		if (right.length) {
			// Answers arrive in time order, so the first right one is the fastest: it gets the crown and its name beside it.
			tagName = K.short(right[0].p.name, 16);
			st.ctx.font = K.font(44); tagW = st.ctx.measureText(tagName).width * 34 / 44;
			// Then as many more faces as sit comfortably along the rest of the tile's top edge.
			room = Math.max(1, 2 + Math.floor((T.w - 302 - tagW) / 46));
			for (n = 0; n < right.length && n < room; n++) {
				a = right[n]; a.fly = true;
				fliers.push({ a: a, sx: a.i < TRAY_MAX ? tr.x + 118 + a.i * step : tr.x + tr.w / 2, sy: tr.y + tr.h / 2, sr: tr.h / 2 - 7, t0: 0.7 + n * 0.11, land: 1.2 + n * 0.11, landed: false });
			}
			lastLand = fliers[fliers.length - 1].land;
			// Points float up from each face; a crowded row shows them for every few faces so they stay readable.
			if (fliers.length > 2) { perch(1); n = PX; perch(2); popEvery = Math.max(1, Math.ceil(64 / Math.max(1, PX - n))); }
		}
		revealLen = Math.max(K.demo ? 5.4 : 6.5, lastLand + (K.demo ? 2.9 : 3.4));
		for (n = 0; n < 5; n++) K.fx.spark(T.x + T.w * (0.1 + n * 0.2), n % 2 ? T.y + T.h - 12 : T.y, n % 2 ? '#fff3c4' : TILE[cur.correct].glow, 14, 620, 9, 0.8);
		K.shake(st, 8);
	}
	function startPodium() {
		var all = Object.keys(scores).map(function (k) { return scores[k]; }).filter(function (s) { return s.total > 0; }).sort(function (a, b) { return b.total - a.total; }), n, e, w;
		if (!all.length) return false;
		podium = all.slice(0, 3).map(function (s) { return { s: s, name: K.short(s.p.name, 14), size: 40, at: 0, hit: false }; });
		st.ctx.font = K.font(44);
		for (n = 0; n < podium.length; n++) {
			e = podium[n]; e.at = 0.3 + (podium.length - 1 - n) * 0.75;
			w = st.ctx.measureText(e.name).width;
			e.size = Math.min(n ? 34 : 40, 44 * (POD[n].w - 50) / Math.max(1, w));
		}
		K.awardRound(podium.map(function (e) { return e.s.p; }), all.map(function (s) { return s.p; }));
		phase = 'podium'; phaseT = 0; nextConfetti = 0; podShift = podium.length === 2 ? 170 : 0;
		return true;
	}
	function advance() {
		if (number >= ROUNDS && startPodium()) return;
		if (quiet >= 2) rest(); else if (number >= ROUNDS) newGame(); else ask();
	}

	K.onChat(function (msg) {
		var p = msg.player, a;
		if (phase === 'idle') { if (deck.length) newGame(); return; }
		if (phase !== 'ask' || msg.words.length !== 1 || !KEYS.hasOwnProperty(msg.cmd)) return;
		// A chatter's first answer is the one that counts.
		if (byKey[p.key] || answers.length >= 3000) return;
		a = byKey[p.key] = { p: p, pick: KEYS[msg.cmd], t: Math.max(0, (Date.now() - askStart) / 1000), at: clock, pts: 0, fly: false };
		answers.push(a);
	});

	function update(dt) {
		var now = Date.now(), n, f, e, P, s, T;
		clock += dt; phaseT += dt;
		topPop = K.approach(topPop, 0, 5, dt);
		while (script.length && now >= script[script.length - 1].at) { s = script.pop(); K.say(s.name, s.text); }
		if (phase === 'ask') {
			if (now >= deadline) reveal();
		} else if (phase === 'reveal') {
			for (n = 0; n < fliers.length; n++) {
				f = fliers[n];
				if (f.landed || phaseT < f.land) continue;
				f.landed = true; perch(n);
				K.fx.spark(PX, PY + PR * 0.6, TILE[cur.correct].glow, 6, 240, 5, 0.4);
				if (n === 0 || (n - 1) % popEvery === 0) K.fx.pop('+' + f.a.pts, PX, PY - PR - 8, '#ffe066', n ? 24 : 38);
			}
			if (phaseT < 2.8 && clock > nextSpark) {
				nextSpark = clock + 0.2; T = L.tiles[cur.correct];
				K.fx.spark(T.x + K.rand(0.03, 0.97) * T.w, Math.random() < 0.5 ? T.y : T.y + T.h - 12, '#fff3c4', 3, 260, 5, 0.5);
			}
			if (!ranked && phaseT >= Math.max(2.2, lastLand + 0.5)) { ranked = true; rank(); topPop = 1; }
			if (phaseT >= revealLen) advance();
		} else if (phase === 'podium') {
			for (n = 0; n < podium.length; n++) {
				e = podium[n]; P = POD[n];
				if (e.hit || phaseT < e.at + 0.56) continue;
				e.hit = true;
				K.fx.spark(L.pox + (podShift + P.x + P.w / 2) * L.ps, L.poy + P.top * L.ps, '#ffe9b0', 14, 420, 7, 0.6);
				if (n === 0) { K.shake(st, 10); K.fx.burst(L.pox + (podShift + 550) * L.ps, L.poy + (P.top - P.r) * L.ps, null, 70, 760); nextConfetti = phaseT + 0.4; }
			}
			if (nextConfetti && phaseT > nextConfetti && phaseT < PODIUM - 2.2) { nextConfetti = phaseT + 0.42; K.fx.burst(L.pox + K.rand(120, 980) * L.ps, L.poy + K.rand(40, 300) * L.ps, null, 18, 460); }
			if (phaseT >= PODIUM) { if (quiet >= 2) rest(); else newGame(); }
		}
		K.fx.update(dt);
	}

	// Draws a layer centred on a point. At its own size it is copied pixel for pixel: a scaled copy costs far more where the
	// canvas is drawn by the processor, and the show is at rest most of the time.
	function put(ctx, c, cx, cy, sc) {
		var w = c.width / rs * sc, h = c.height / rs * sc;
		if (M && sc > 0.999999 && sc < 1.000001) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(c, Math.round(M.a * cx + M.e - c.width / 2), Math.round(M.d * cy + M.f - c.height / 2));
			ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);
		} else ctx.drawImage(c, cx - w / 2, cy - h / 2, w, h);
	}
	function blit(ctx, c, r, sc, dy) { put(ctx, c, r.x + r.w / 2, r.y + r.h / 2 + dy, sc); }
	// The live top three, kept as a layer and repainted when the order, a score or a face changes.
	function drawLeaders(ctx) {
		var T = L.top, w = (T.w - 36) / 3, n, stale = !spr.top;
		if (!shown.length) return;
		for (n = 0; n < shown.length; n++) if (topSeen[n * 2] !== shown[n].p.photo || topSeen[n * 2 + 1] !== shown[n].p.name) stale = true;
		if (stale) {
			for (n = 0; n < shown.length; n++) { topSeen[n * 2] = shown[n].p.photo; topSeen[n * 2 + 1] = shown[n].p.name; }
			spr.top = K.layer(T.w * rs, 112 * rs, function (g) { g.scale(rs, rs); K.top3(g, shown, (3 - shown.length) * (w + 18) / 2, 16, T.w); });
		}
		ctx.globalAlpha = 1;
		put(ctx, spr.top, T.x + T.w / 2, T.y + 40, 1 + topPop * 0.07);
	}
	function drawShow(ctx) {
		var now = Date.now(), asking = phase === 'ask', out = asking ? 0 : K.ease((phaseT - revealLen + 0.45) / 0.45), fade = 1 - out;
		var tr = L.tray, R = L.ring, n, T, e, g, d, sc, a, r, x, y, step, left, urgent, beat, f, count;
		M = ctx.getTransform ? ctx.getTransform() : null;
		if (M && Math.abs(M.a - rs) > 1e-6) M = null;
		drawLeaders(ctx);
		e = asking ? K.clamp(phaseT / 0.45, 0, 1) : 1;
		ctx.globalAlpha = Math.min(1, e * 2.5) * fade;
		blit(ctx, spr.q, L.q, (0.92 + 0.08 * K.back(e)) * (1 - out * 0.04), (K.out(e) - 1) * 40);
		for (n = 0; n < 4; n++) {
			T = L.tiles[n];
			e = asking ? K.clamp((phaseT - 0.3 - n * 0.09) / 0.4, 0, 1) : 1;
			if (e <= 0) continue;
			if (asking) {
				ctx.globalAlpha = Math.min(1, e * 3);
				blit(ctx, spr.tile[n], T, 0.7 + 0.3 * K.back(e), 0);
			} else if (n === cur.correct) {
				// The right answer lifts and glows.
				g = K.back(K.clamp(phaseT / 0.35, 0, 1));
				sc = (1 + (LIFT - 1) * g) / LIFT * (1 - out * 0.04);
				ctx.globalAlpha = K.clamp((0.74 + (K.calm ? 0 : 0.22 * Math.sin(clock * 5))) * g, 0, 1) * fade;
				put(ctx, spr.glow, T.x + T.w / 2, T.y + T.h / 2, sc);
				ctx.globalAlpha = fade;
				put(ctx, spr.win, T.x + T.w / 2, T.y + T.h / 2, sc);
				if (!K.calm && phaseT < 0.3) { ctx.globalAlpha = (1 - phaseT / 0.3) * 0.75; K.rr(ctx, T.x, T.y, T.w, T.h - 12, 30); ctx.fillStyle = '#fff'; ctx.fill(); }
			} else {
				// A wrong answer drops back and goes dark.
				d = K.ease(phaseT / 0.4); sc = (1 - (1 - DROP) * d) * (1 - out * 0.04);
				if (d < 1) { ctx.globalAlpha = fade; blit(ctx, spr.tile[n], T, sc, SINK * d); }
				ctx.globalAlpha = fade * d; blit(ctx, spr.dim[n], T, sc / DROP, SINK * d - SINK * sc / DROP);
			}
		}
		// The tray: everyone who has answered, in one neutral row so nobody can copy a colour.
		e = asking ? K.clamp((phaseT - 0.55) / 0.35, 0, 1) : 1 - K.clamp(phaseT / 0.45, 0, 1);
		if (e > 0) {
			ctx.globalAlpha = e;
			K.rr(ctx, tr.x, tr.y, tr.w, tr.h, tr.h / 2); ctx.fillStyle = 'rgba(12,16,28,.62)'; ctx.fill();
			ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
			K.bubble(ctx, tr.x + 56, tr.y + tr.h - 7, (tr.h - 14) / 132, clock);
		}
		count = Math.min(answers.length, TRAY_MAX); step = trayStep(count); r = tr.h / 2 - 7; y = tr.y + tr.h / 2;
		if (asking) {
			for (n = 0; n < count; n++) {
				a = answers[n]; e = K.clamp((clock - a.at) / 0.32, 0, 1);
				ctx.globalAlpha = Math.min(1, e * 3);
				K.face(ctx, a.p, tr.x + 118 + n * step, y - (1 - K.out(e)) * 40, r * K.back(e));
			}
		} else if (phaseT < 0.7) {
			d = K.clamp((phaseT - 0.1) / 0.5, 0, 1); ctx.globalAlpha = 1 - d;
			for (n = 0; n < count; n++) if (!answers[n].fly) K.face(ctx, answers[n].p, tr.x + 118 + n * step, y + d * d * 44, r);
		}
		// The countdown.
		if (asking) {
			e = K.clamp((phaseT - 0.7) / 0.35, 0, 1);
			if (e > 0.12) {
				left = Math.max(0, (deadline - now) / 1000); urgent = left <= 5 && now >= askStart;
				beat = urgent && !K.calm ? Math.exp(-7 * (1 - left % 1)) : 0;
				r = R.r * K.back(e) * (1 + beat * 0.12);
				ctx.globalAlpha = 1;
				if (beat > 0.02) K.glow(ctx, R.x, R.y, r * 2.3, '#ff6b6b', beat * 0.6, true);
				ctx.beginPath(); ctx.arc(R.x, R.y, r + 12, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.95)'; ctx.fill();
				ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.stroke();
				K.ring(ctx, R.x, R.y, r - 3, Math.min(1, left / SECS), urgent ? '#ff6b6b' : '#ffffff', r * 0.2);
				K.text(ctx, String(Math.ceil(Math.min(left, SECS))), R.x, R.y + 2, r * 0.84, urgent ? '#ffc9c9' : '#fff', 'center', false);
			}
		} else if (phaseT < 0.25) {
			r = R.r * (1 - phaseT / 0.25);
			ctx.globalAlpha = 1;
			ctx.beginPath(); ctx.arc(R.x, R.y, r + 12 * (1 - phaseT / 0.25), 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.95)'; ctx.fill();
		}
		// Right answers fly to the correct tile, fastest first.
		if (!asking) {
			ctx.globalAlpha = fade;
			for (n = fliers.length - 1; n >= 0; n--) {
				f = fliers[n]; perch(n);
				e = (phaseT - f.t0) / 0.5;
				if (e <= 0) { x = f.sx; y = f.sy; r = f.sr; }
				else if (e < 1) { d = K.ease(e); x = K.lerp(f.sx, PX, d); y = K.lerp(f.sy, PY, d) - Math.sin(d * 3.1416) * 90; r = K.lerp(f.sr, PR, d); }
				else { d = phaseT - f.land; x = PX; y = PY - Math.abs(Math.sin(d * 10)) * 24 * Math.exp(-5 * d); r = PR; }
				K.face(ctx, f.a.p, x, y, r);
				if (n === 0 && e > 0) K.crown(ctx, x, y - r + 7, r * 0.55);
			}
			if (fliers.length && phaseT > fliers[0].land + 0.1) {
				// The fastest one's name, on a tag beside the crowned face.
				perch(0); e = K.back(K.clamp((phaseT - fliers[0].land - 0.1) / 0.3, 0, 1));
				ctx.globalAlpha = Math.min(1, e * 2) * fade;
				ctx.save(); ctx.translate(PX + PR + 10 + tagW / 2 + 22, PY + 4); ctx.scale(e, e);
				K.panel(ctx, -tagW / 2 - 22, -27, tagW + 44, 54, 27, 'rgba(12,16,28,.95)');
				K.label(ctx, tagName, 0, 0, 34);
				ctx.restore();
			}
		}
		ctx.globalAlpha = 1;
	}
	function drawIdle(ctx) {
		var cx = L.W / 2, cy = L.H / 2 + 60, s = 174, gap = 30, n, x, bob;
		for (n = 0; n < 4; n++) {
			x = cx + (n - 1.5) * (150 + gap); bob = Math.sin(clock * 1.7 - n * 0.8) * 12;
			K.shadow(ctx, x, cy + 108, 66 - bob * 0.8, 13, 0.4);
			ctx.drawImage(chip(n), x - s / 2, cy - s / 2 + bob, s, s);
		}
		K.bubble(ctx, cx, cy - 104, 1.15, clock);
	}
	function bounce(t) {
		if (t < 0.3636) return 7.5625 * t * t;
		if (t < 0.7273) { t -= 0.5455; return 7.5625 * t * t + 0.75; }
		if (t < 0.9091) { t -= 0.8182; return 7.5625 * t * t + 0.9375; }
		t -= 0.9545; return 7.5625 * t * t + 0.984375;
	}
	function pedestal(n) {
		var P = POD[n], h = L.pb - P.top + 12;
		return K.sprite('trivia:block' + n + (L.wide ? 'w' : 't'), P.w * 1.5, h * 1.5, function (g) {
			var grad = g.createLinearGradient(0, 0, 0, h);
			g.scale(1.5, 1.5);
			grad.addColorStop(0, 'rgba(36,46,78,.97)'); grad.addColorStop(1, 'rgba(11,15,28,.97)');
			K.rr(g, 7, 10, P.w - 14, h - 11, 20); g.fillStyle = grad; g.fill();
			g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.1)'; g.stroke();
			// The place, as a faint numeral where the block is tall enough to have room under the score.
			if (!L.wide) { g.font = K.font(Math.min(h * 0.42, 170), 900); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(255,255,255,.055)'; g.fillText(String(n + 1), P.w / 2, h - 18); }
			grad = g.createLinearGradient(0, 0, 0, 30); grad.addColorStop(0, '#7785b4'); grad.addColorStop(0.45, '#4c5a84'); grad.addColorStop(1, '#343f62');
			K.rr(g, 0, 0, P.w, 30, 15); g.fillStyle = grad; g.fill();
		});
	}
	function drawPodium(ctx) {
		var out = K.ease((phaseT - PODIUM + 0.5) / 0.5), n, e, P, t, cx, vis, h, c, fy, drop, land;
		ctx.save(); ctx.translate(L.pox + podShift * L.ps, L.poy); ctx.scale(L.ps, L.ps);
		// Light behind the winner, under everything else.
		P = POD[0]; t = phaseT - podium[0].at;
		if (t > 0.8) {
			cx = P.x + P.w / 2; fy = P.top - P.r + 12;
			ctx.globalAlpha = K.clamp((t - 0.8) / 0.5, 0, 1) * (1 - out);
			ctx.save(); ctx.translate(cx, fy); ctx.rotate(clock * 0.3); ctx.drawImage(rays(), -P.r * 2.7, -P.r * 2.7, P.r * 5.4, P.r * 5.4); ctx.restore();
			K.glow(ctx, cx, fy, P.r * 1.9, '#ffd43b', 0.55, true);
		}
		for (n = podium.length - 1; n >= 0; n--) {
			e = podium[n]; P = POD[n]; t = phaseT - e.at;
			if (t <= 0) continue;
			// The block rises out of the floor line.
			cx = P.x + P.w / 2; vis = K.out(t / 0.5); h = L.pb - P.top + 12; c = pedestal(n);
			ctx.globalAlpha = 1 - out;
			ctx.drawImage(c, 0, 0, c.width, c.height * vis, P.x, L.pb + 12 - h * vis, P.w, h * vis);
			drop = K.clamp((t - 0.3) / 0.7, 0, 1);
			if (drop <= 0) continue;
			land = bounce(drop); fy = P.top - P.r + 12 - (1 - land) * 460;
			ctx.globalAlpha = Math.min(1, drop * 5) * (1 - out);
			K.shadow(ctx, cx, P.top + 8, P.r * 0.85 * land, 16, 0.55);
			K.bigFace(ctx, e.s.p, cx, fy, P.r);
			if (n === 0 && t > 0.75) K.crown(ctx, cx, fy - P.r + 18, 62 * K.back((t - 0.75) / 0.3));
			if (t > 0.5) {
				ctx.globalAlpha = K.clamp((t - 0.5) / 0.3, 0, 1) * (1 - out);
				K.label(ctx, e.name, cx, P.top + P.name, e.size);
				K.text(ctx, String(Math.round(e.s.total * K.out((t - 0.6) / 0.9))), cx, P.top + P.score, P.size, '#ffe066');
			}
		}
		ctx.restore();
		ctx.globalAlpha = 1;
	}
	function draw() {
		var ctx = K.begin(st, box);
		if (dirty) build();
		if (phase === 'podium') drawPodium(ctx);
		else if (cur && (phase === 'ask' || phase === 'reveal')) drawShow(ctx);
		else drawIdle(ctx);
		K.fx.draw(ctx);
	}

	function begin(list) {
		deck = shuffle(list);
		if (deck.length) newGame(); else phase = 'idle';
	}
	st.onresize();
	(function () {
		var url = K.params.get('questions') || '';
		// The one request this page makes, and only to the address the host typed. Demo stays offline.
		if (!K.demo && /^https:\/\//i.test(url) && url.length <= 2000 && window.fetch) load(url, function (list) { begin(list.length ? list : builtIn()); });
		else begin(builtIn());
	})();

	window.SSNTrivia = {
		state: function () {
			var totals = {};
			Object.keys(scores).forEach(function (k) { totals[scores[k].p.name] = scores[k].total; });
			return { phase: phase === 'load' ? 'idle' : phase, number: number, of: ROUNDS, answered: answers.length, correct: phase === 'reveal' && cur ? LETTERS.charAt(cur.correct) : '', scores: totals, pack: cur ? cur.pack : '' };
		}
	};
	K.loop(update, draw);
	K.start();
})();
