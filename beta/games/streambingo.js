// Stream Bingo: one shared card of stream moments for the whole chat. Type a square's number when it happens; enough callers stamp it.
// A full row, column or diagonal is a bingo. The card is a boxed, nearly square stage: park it with &align= and &scale=.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage({ w: 1000, h: 1100 });
	var T = 172, PITCH = 182, GX = 50, GY = 152, TP = 12, CX = 22, CY = 56, CW = 956, CH = 1018, DECK_Y = 104;
	var VOTES = Math.round(K.num('votes', 3, 1, 20)), LINES = Math.round(K.num('lines', 1, 1, 5)), HOLD = K.demo ? 6 : 10;
	var FLY = 0.75, SET = 0.95, OUT = 1.05, IN = 1.15, INK = '#e2364c', NAVY = '#1c2542', EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif';
	// Stream moments, as pictures: laughing, a pet appears, a drink, the phone rings, a sneeze, a jump scare, a win, a fail, singing...
	var MOMENTS = [
		'\uD83D\uDE02', '\uD83D\uDC31', '\uD83D\uDC36', '\u2615', '\uD83D\uDCF1', '\uD83E\uDD27', '\uD83D\uDE31', '\uD83C\uDFC6', '\uD83D\uDCA5', '\uD83C\uDFA4',
		'\uD83D\uDD14', '\uD83D\uDD0C', '\uD83C\uDF55', '\uD83D\uDC83', '\uD83E\uDD26', '\uD83D\uDE34', '\uD83C\uDF81', '\uD83D\uDCB8', '\uD83D\uDD07', '\uD83D\uDEBD',
		'\uD83D\uDE2D', '\uD83D\uDE4A', '\uD83D\uDC4B', '\uD83C\uDF89', '\uD83D\uDC1B', '\uD83D\uDC80', '\uD83D\uDD25', '\uD83D\uDC40', '\uD83C\uDFA7', '\uD83D\uDEA8',
		'\uD83C\uDF7F', '\uD83C\uDFAE', '\uD83D\uDE21', '\uD83E\uDD14', '\uD83D\uDC4F', '\uD83D\uDCA1', '\uD83D\uDCE6', '\uD83C\uDFB8', '\uD83D\uDC26', '\uD83D\uDE97',
		'\uD83D\uDC7B', '\uD83C\uDF6A', '\uD83D\uDE48', '\u23F0', '\uD83D\uDCA4', '\uD83D\uDC76', '\uD83D\uDCBB', '\uD83D\uDD0A', '\u26A1', '\uD83C\uDFAF',
		'\uD83D\uDE0E', '\uD83D\uDCAC', '\uD83D\uDC96', '\uD83E\uDD23', '\uD83E\uDD64', '\uD83D\uDCF8', '\uD83C\uDF08', '\uD83D\uDE80'
	];
	// &squares=text|text|... : the host's own squares, as plain text. The built-in pictures fill any gap up to 24.
	var custom = (K.params.get('squares') || '').split('|').map(function (s) { return K.short(s.replace(/[\u0000-\u001F\u007F\s]+/g, ' ').trim(), 18); }).filter(Boolean).slice(0, 200);
	var ROWS = [];
	(function () {
		var n, i, a, b;
		for (n = 0; n < 5; n++) { a = []; b = []; for (i = 0; i < 5; i++) { a.push(n * 5 + i); b.push(i * 5 + n); } ROWS.push(a, b); }
		ROWS.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
	})();
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	var squares = [], done = [], cardNo = 0, bingos = 0, starsOn = 0, phase = 'deal', dealT = OUT, swapped = true, holdT = 0, clock = 0, lastCall = 0, nextConfetti = 0;
	var last = {}, lastCount = 0, tags = [], fxLines = [], starPop = [0, 0, 0, 0, 0], target = -1, demoLast = {};
	var rs = 1, back = null, atlas = null, flat = null, AC = 1, dirtyBack = true, dirtyAtlas = true, dirtyFlat = true;
	st.onresize = function () { rs = K.clamp(st.k, 0.25, 2); dirtyBack = dirtyAtlas = dirtyFlat = true; };
	st.onresize();

	function shuffle(a) { for (var i = a.length - 1, j, t; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
	function newCard() {
		var pool = shuffle(custom.slice()).slice(0, 24), extra = shuffle(MOMENTS.slice()), n, i = 0, text;
		while (pool.length < 24) pool.push(extra[i++]);
		shuffle(pool);
		squares = [];
		// The centre is a free star, stamped from the start.
		for (n = 0; n < 25; n++) {
			text = n === 12 ? '' : pool[n < 12 ? n : n - 1];
			squares.push({
				n: n + 1, text: text, words: Array.from(text).length > 2, free: n === 12, stamped: n === 12, age: 99, hit: true, calls: [], by: null,
				line: false, hop: 0, bump: 0, v: Math.floor(Math.random() * 3), set: false, baked: false, lit: false
			});
		}
		done = []; bingos = 0; starsOn = 0; cardNo++; tags.length = 0; fxLines.length = 0; target = -1; dirtyAtlas = dirtyFlat = true;
	}

	// ---- Painted once: the card, its tiles, the number chips, the pictures and the ink stamp ----
	var splitWord = false;
	function wrap(g, text, maxW) {
		var words = text.split(' '), lines = [], line = '', n, test, chars, i;
		splitWord = false;
		for (n = 0; n < words.length; n++) {
			test = line ? line + ' ' + words[n] : words[n];
			if (g.measureText(test).width <= maxW) { line = test; continue; }
			if (line) lines.push(line);
			line = words[n];
			while (g.measureText(line).width > maxW && line.length > 1) {
				chars = Array.from(line);
				for (i = chars.length - 1; i > 1 && g.measureText(chars.slice(0, i).join('')).width > maxW; i--) {}
				lines.push(chars.slice(0, i).join('')); line = chars.slice(i).join(''); splitWord = true;
			}
		}
		if (line) lines.push(line);
		return lines;
	}
	function chip(n) {
		return K.sprite('bingo:chip' + n, 136, 136, function (g) {
			g.beginPath(); g.arc(68, 72, 58, 0, 6.2832); g.fillStyle = 'rgba(10,14,24,.28)'; g.fill();
			g.beginPath(); g.arc(68, 66, 58, 0, 6.2832); g.fillStyle = NAVY; g.fill();
			g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
			g.font = K.font(n > 9 ? 62 : 70, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(n), 68, 70);
		});
	}
	// A picture (or a very short word) drawn large, once.
	function glyph(text) {
		return K.sprite('bingo:glyph:' + text, 176, 176, function (g) {
			var size = 124, w;
			g.font = '800 ' + size + 'px ' + EMOJI; w = g.measureText(text).width;
			if (w > 164) { size = Math.floor(size * 164 / w); g.font = '800 ' + size + 'px ' + EMOJI; }
			g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = NAVY; g.fillText(text, 88, 94);
		});
	}
	function starPath(g, x, y, r) {
		var n, a;
		g.beginPath();
		for (n = 0; n < 10; n++) { a = -1.5708 + n * 0.62832; g.lineTo(x + Math.cos(a) * (n % 2 ? r * 0.47 : r), y + Math.sin(a) * (n % 2 ? r * 0.47 : r)); }
		g.closePath();
	}
	function paintTile(g, sq) {
		var fh = T - 8, grad = g.createLinearGradient(0, 0, 0, fh), size, lines, n, y;
		g.save(); g.shadowColor = 'rgba(3,6,16,.6)'; g.shadowBlur = 8 * rs; g.shadowOffsetY = 4 * rs;
		K.rr(g, 0, 8, T, fh, 24); g.fillStyle = sq.free ? '#c38a17' : '#c5b99d'; g.fill(); g.restore();
		grad.addColorStop(0, sq.free ? '#fff1ad' : '#fffdf7'); grad.addColorStop(1, sq.free ? '#ffc93f' : '#efe5cf');
		K.rr(g, 0, 0, T, fh, 24); g.fillStyle = grad; g.fill();
		K.rr(g, 2.5, 2.5, T - 5, fh - 5, 21.5); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke();
		if (sq.free) {
			g.lineJoin = 'round';
			starPath(g, T / 2, fh / 2 + 9, 58); g.fillStyle = 'rgba(160,104,8,.35)'; g.fill();
			starPath(g, T / 2, fh / 2 + 3, 58); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#d99a1c'; g.stroke();
			return;
		}
		if (!sq.words) g.drawImage(glyph(sq.text), 44, 40, 108, 108);
		else {
			// The host's own words: wrapped and shrunk to fit under the number. A word is split only if it cannot fit at the smallest size.
			for (size = 38; ; size -= 2) {
				g.font = K.font(size); lines = wrap(g, sq.text, T - 26);
				if ((lines.length * size * 1.14 <= 96 && !splitWord) || size <= 15) break;
			}
			g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = NAVY;
			for (n = 0, y = 112 - (lines.length - 1) * size * 0.57; n < lines.length; n++, y += size * 1.14) g.fillText(lines[n], T / 2, y);
		}
		g.drawImage(chip(sq.n), 3, 1, 62, 62);
	}
	function buildBack() {
		dirtyBack = false; dirtyFlat = true;
		back = K.layer(st.canvas.width, st.canvas.height, function (g) {
			var grad = g.createLinearGradient(0, CY, 0, CY + CH), n;
			g.scale(st.k, st.k);
			grad.addColorStop(0, '#2c3962'); grad.addColorStop(1, '#161d36');
			g.save(); g.shadowColor = 'rgba(2,5,14,.6)'; g.shadowBlur = 20 * st.k; g.shadowOffsetY = 7 * st.k;
			K.rr(g, CX, CY, CW, CH, 46); g.fillStyle = grad; g.fill(); g.restore();
			K.rr(g, CX + 2, CY + 2, CW - 4, CH - 4, 44); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.16)'; g.stroke();
			// A shallow well under every tile, seen while a card is being dealt.
			for (n = 0; n < 25; n++) { K.rr(g, GX + (n % 5) * PITCH - 3, GY + Math.floor(n / 5) * PITCH - 2, T + 6, T + 6, 27); g.fillStyle = 'rgba(6,9,20,.5)'; g.fill(); }
		});
	}
	function buildAtlas() {
		dirtyAtlas = false; dirtyFlat = true;
		AC = Math.ceil((T + TP * 2) * rs);
		atlas = K.layer(AC * 5, AC * 5, function (g) {
			for (var n = 0; n < 25; n++) { g.setTransform(rs, 0, 0, rs, (n % 5) * AC + TP * rs, Math.floor(n / 5) * AC + TP * rs); paintTile(g, squares[n]); }
		});
	}
	function stampSprite(v) {
		return K.sprite('bingo:stamp' + v, 312, 312, function (g) {
			var n, a, r;
			g.translate(156, 156); g.rotate([-0.24, 0.14, -0.05][v]);
			g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
			g.lineWidth = 20; g.beginPath(); g.arc(0, 0, 122, 0, 6.2832); g.stroke();
			g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 98, 0, 6.2832); g.stroke();
			g.lineWidth = 30; g.beginPath(); g.moveTo(-52, 4); g.lineTo(-16, 40); g.lineTo(56, -40); g.stroke();
			// Worn ink: specks where the stamp did not take.
			g.globalCompositeOperation = 'destination-out';
			for (n = 0; n < 170; n++) {
				a = K.hash('a' + v + n) * 6.2832; r = K.hash('r' + v + n) * 138;
				g.globalAlpha = 0.3 + K.hash('o' + v + n) * 0.6; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 1 + K.hash('s' + v + n) * 3.2, 0, 6.2832); g.fill();
			}
			// A pale wash under the ink so the mark reads over any picture.
			g.globalCompositeOperation = 'destination-over'; g.globalAlpha = 1;
			g.beginPath(); g.arc(0, 0, 120, 0, 6.2832); g.fillStyle = 'rgba(255,248,240,.66)'; g.fill();
		});
	}
	function slot() {
		return K.sprite('bingo:slot', 96, 96, function (g) {
			g.lineJoin = 'round'; starPath(g, 48, 50, 38); g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.3)'; g.stroke();
		});
	}

	// ---- Rules ----
	function prune(sq, now) { while (sq.calls.length && now - sq.calls[0].at >= 60000) sq.calls.shift(); }
	function bingo(n) {
		var line = ROWS[n], seen = [], k, sq;
		done[n] = true; bingos++;
		for (k = 0; k < 5; k++) {
			sq = squares[line[k]];
			if (sq.by && seen.indexOf(sq.by) < 0) { seen.push(sq.by); K.award(sq.by, 3, true); }
		}
		// The celebration waits a beat so the last stamp lands first.
		fxLines.push({ cells: line, t: -0.45, star: Math.min(bingos, LINES) - 1 });
		if (bingos >= LINES) { phase = 'hold'; holdT = 0; }
	}
	function stamp(i) {
		var sq = squares[i], name = K.short(sq.calls[0].p.name, 14), n, k;
		sq.stamped = true; sq.age = 0; sq.hit = false; sq.by = sq.calls[0].p; sq.calls.length = 0;
		st.ctx.font = K.font(44);
		if (tags.length >= 8) tags.shift();
		tags.push({ i: i, name: name, w: st.ctx.measureText(name).width * 28 / 44, t: 0 });
		for (n = 0; n < ROWS.length; n++) {
			if (done[n] || ROWS[n].indexOf(i) < 0) continue;
			for (k = 0; k < 5 && squares[ROWS[n][k]].stamped; k++) {}
			if (k === 5) bingo(n);
		}
	}
	K.onChat(function (msg) {
		var word = msg.words.length === 1 ? msg.cmd : msg.words.length === 2 && msg.cmd === 'bingo' ? msg.arg : '', p = msg.player, now = Date.now(), sq, k;
		if (phase !== 'play' || !/^\d{1,2}$/.test(word) || +word < 1 || +word > 25) return;
		sq = squares[+word - 1];
		if (sq.stamped) return;
		// One call every five seconds per chatter; a moderator is trusted to call freely.
		if (!msg.mod && last[p.key] !== undefined && now - last[p.key] < 5000) return;
		prune(sq, now);
		for (k = 0; k < sq.calls.length; k++) if (sq.calls[k].p.key === p.key) return;
		if (lastCount > 3000) { last = {}; lastCount = 0; }
		if (last[p.key] === undefined) lastCount++;
		last[p.key] = now;
		sq.calls.push({ p: p, at: now, born: clock });
		sq.bump = 1; lastCall = clock;
		if (msg.mod || sq.calls.length >= VOTES) stamp(+word - 1);
	});

	function update(dt) {
		var now = Date.now(), n, k, sq, f, was, x, y, g;
		clock += dt;
		if (phase === 'deal') {
			dealT += dt;
			for (n = 0; n < 25; n++) {
				sq = squares[n];
				// A tile leaves the resting layer as it starts to fall, and joins it as it lands.
				if (!swapped && sq.set && dealT >= n * 0.03) place(n, false);
				else if (swapped && !sq.set && dealT >= IN + n * 0.055 + 0.36) place(n, true);
			}
			if (!swapped && dealT >= OUT) { swapped = true; newCard(); }
			if (swapped && dealT >= IN + 1.75) { phase = 'play'; lastCall = clock; }
		} else if (phase === 'hold') {
			holdT += dt;
			if (holdT > 0.6 && holdT < 4 && clock > nextConfetti) { nextConfetti = clock + 0.4; K.fx.burst(K.rand(140, 860), K.rand(220, 640), null, 14, 480); }
			if (holdT >= HOLD) { phase = 'deal'; dealT = 0; swapped = false; }
		}
		for (n = 0; n < 25; n++) {
			sq = squares[n]; sq.hop = 0;
			if (sq.bump > 0) sq.bump = Math.max(0, sq.bump - dt * 4);
			if (sq.calls.length) prune(sq, now);
			x = GX + (n % 5) * PITCH; y = GY + Math.floor(n / 5) * PITCH;
			if (sq.age < 5) {
				was = sq.age; sq.age += dt;
				if (!sq.hit && sq.age >= 0.14) {
					sq.hit = true;
					K.fx.spark(x + T / 2, y + T / 2, '#ffd9de', 12, 330, 6, 0.42);
					K.shake(st, 6);
				}
				// Once the stamp has settled it is inked into the resting card.
				if (was < SET && sq.age >= SET && sq.stamped && !sq.free && sq.set && flat && !dirtyFlat) { g = flat.getContext('2d'); g.setTransform(st.k, 0, 0, st.k, 0, 0); ink(g, sq, x, y, 1, 1, 1); sq.baked = true; }
			}
			if (sq.line && !sq.lit && sq.set && (sq.baked || sq.free) && flat && !dirtyFlat) { g = flat.getContext('2d'); g.setTransform(st.k, 0, 0, st.k, 0, 0); light(g, sq, x, y); sq.lit = true; }
		}
		for (n = fxLines.length - 1; n >= 0; n--) {
			f = fxLines[n]; was = f.t; f.t += dt;
			if (was < 0 && f.t >= 0) {
				for (k = 0; k < 5; k++) {
					squares[f.cells[k]].line = true;
					K.fx.burst(GX + (f.cells[k] % 5) * PITCH + T / 2, GY + Math.floor(f.cells[k] / 5) * PITCH + T / 2, null, 18, 600);
				}
				K.shake(st, 13);
			}
			// A star flies from the line up to its place at the top of the card.
			if (was < FLY && f.t >= FLY) {
				starsOn = Math.max(starsOn, f.star + 1); starPop[f.star] = 1;
				K.fx.spark(500 + (f.star - (LINES - 1) / 2) * 76, DECK_Y, '#ffe9b0', 18, 440, 7, 0.6);
			}
			// The faces on a winning line hop, one after the other.
			if (f.t > 0 && f.t < 3.4) for (k = 0; k < 5; k++) { sq = squares[f.cells[k]]; sq.hop = Math.max(sq.hop, Math.abs(Math.sin(Math.max(0, f.t - k * 0.09) * 7.5)) * 28 * (1 - f.t / 3.4)); }
			if (f.t > 4) fxLines.splice(n, 1);
		}
		for (n = tags.length - 1; n >= 0; n--) { tags[n].t += dt; if (tags[n].t > 2.8) tags.splice(n, 1); }
		for (n = 0; n < 5; n++) if (starPop[n] > 0) starPop[n] = Math.max(0, starPop[n] - dt * 1.6);
		K.fx.update(dt);
	}

	// The ink mark and, on top of it, the number.
	function ink(ctx, sq, x, y, sx, sy, press) {
		var cx = x + T / 2 + 5, cy = y + T / 2 - 1, R = 74;
		ctx.drawImage(stampSprite(sq.v), cx - R * sx, cy - R * sy, R * 2 * sx, R * 2 * sy);
		ctx.drawImage(chip(sq.n), x + T / 2 - (T / 2 - 3) * press, y + T / 2 - (T / 2 - 1) * press, 62 * press, 62 * press);
	}
	function light(g, sq, x, y) {
		K.glow(g, x + T / 2, y + T / 2 - 4, 124, '#ffd43b', 0.36, true);
		K.rr(g, x + 3.5, y + 3.5, T - 7, T - 15, 21); g.lineWidth = 7; g.strokeStyle = '#ffc928'; g.stroke();
		if (!sq.free) g.drawImage(chip(sq.n), x + 3, y + 1, 62, 62);
	}
	// The resting card in one layer: the back, every tile, and each stamp once it has settled. Only what moves is drawn on top.
	function buildFlat() {
		dirtyFlat = false;
		flat = K.layer(back.width, back.height, function (g) {
			var n, sq, x, y, w = AC / rs;
			g.drawImage(back, 0, 0);
			g.scale(st.k, st.k);
			for (n = 0; n < 25; n++) {
				sq = squares[n]; x = GX + (n % 5) * PITCH; y = GY + Math.floor(n / 5) * PITCH;
				if (!sq.set) { sq.baked = false; continue; }
				g.drawImage(atlas, (n % 5) * AC, Math.floor(n / 5) * AC, AC, AC, x - TP, y - TP, w, w);
				sq.baked = sq.stamped && !sq.free && sq.age >= SET;
				if (sq.baked) ink(g, sq, x, y, 1, 1, 1);
				sq.lit = sq.line && (sq.baked || sq.free);
				if (sq.lit) light(g, sq, x, y);
			}
		});
	}
	// Puts one tile into the resting layer, or takes it out again (back to the bare card).
	function place(n, on) {
		var sq = squares[n], x = GX + (n % 5) * PITCH, y = GY + Math.floor(n / 5) * PITCH, g, w = AC / rs;
		sq.set = on; sq.baked = sq.lit = false;
		if (!flat || dirtyFlat) return;
		g = flat.getContext('2d'); g.setTransform(st.k, 0, 0, st.k, 0, 0);
		if (on) g.drawImage(atlas, (n % 5) * AC, Math.floor(n / 5) * AC, AC, AC, x - TP, y - TP, w, w);
		else g.drawImage(back, (x - 6) * st.k, (y - 6) * st.k, (T + 12) * st.k, (T + 12) * st.k, x - 6, y - 6, T + 12, T + 12);
	}
	// One square: its tile (when it is moving, or the whole card is), the winning light, the ink stamp and the face of whoever called it first.
	function square(ctx, n, sq, x, y, loose) {
		var cx = x + T / 2, cy = y + T / 2 - 4, b = sq.age - 0.14, ga = ctx.globalAlpha, press = 1, w = AC / rs, e, s;
		if (sq.stamped && !sq.free && b > 0 && b < 0.7) press = 1 - 0.07 * Math.exp(-7 * b) * Math.cos(b * 22);
		else if (sq.bump > 0) press = 1 + 0.05 * sq.bump;
		if (loose || press !== 1) {
			// A tile that is being pressed is redrawn over a clean patch of the card.
			if (!loose) ctx.drawImage(back, (x - 5) * st.k, (y - 5) * st.k, (T + 10) * st.k, (T + 10) * st.k, x - 5, y - 5, T + 10, T + 10);
			ctx.drawImage(atlas, (n % 5) * AC, Math.floor(n / 5) * AC, AC, AC, x + T / 2 - (TP + T / 2) * press, y + T / 2 - (TP + T / 2) * press, w * press, w * press);
		}
		if (sq.free) K.glow(ctx, cx, cy, 78, '#ffffff', 0.2 + (K.calm ? 0 : 0.16 * Math.sin(clock * 2.4)), true);
		if (sq.stamped && !sq.free && !sq.baked) {
			if (b < 0) {
				// The stamp comes down fast from above the card.
				e = sq.age / 0.14; s = 2.6 - 1.6 * e * e;
				ctx.globalAlpha = ga * e; ctx.drawImage(stampSprite(sq.v), cx + 5 - 74 * s, cy + 3 - 74 * s, 148 * s, 148 * s); ctx.globalAlpha = ga;
				return;
			}
			// It lands with a squash, and a puff ring spreads from under it.
			s = b < 0.6 ? 0.13 * Math.exp(-9 * b) * Math.cos(b * 24) : 0;
			ink(ctx, sq, x, y, 1 + s, 1 - s, press);
			if (b < 0.35) {
				e = b / 0.35; ctx.globalAlpha = ga * (1 - e) * 0.7;
				ctx.beginPath(); ctx.arc(cx + 5, cy + 3, 72 + e * 54, 0, 6.2832); ctx.lineWidth = 12 * (1 - e) + 1; ctx.strokeStyle = '#fff'; ctx.stroke();
				ctx.globalAlpha = ga;
			}
		}
		if (sq.line) {
			// A winning square is lit gold: painted into the resting card once its stamp is, with a shimmer on the frame.
			if (!sq.lit) light(ctx, sq, x, y);
			else if (!K.calm) { ctx.globalAlpha = ga * (0.3 + 0.3 * Math.sin(clock * 5 + n)); K.rr(ctx, x + 3.5, y + 3.5, T - 7, T - 15, 21); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = ga; }
		}
		if (sq.by && b > 0.1) K.face(ctx, sq.by, x + T - 38, y + T - 46 - sq.hop, 35 * K.back(K.clamp((b - 0.1) / 0.3, 0, 1)));
	}
	function draw() {
		var ctx = K.begin(st), now = Date.now(), n, k, sq, x, y, cx, cy, e, o, s, w, left, top, count, c, pop, idle, u, f, g, rem, m;
		if (dirtyBack) buildBack();
		if (dirtyAtlas) buildAtlas();
		if (dirtyFlat) buildFlat();
		// Copied pixel for pixel (a scaled copy of a layer this size is the costly part on a slow machine); a shake still moves it.
		if (ctx.getTransform) { m = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, Math.round(m.e), Math.round(m.f)); ctx.drawImage(flat, 0, 0); ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); }
		else ctx.drawImage(flat, 0, 0, 1000, 1100);
		// One star per line the card needs; each fills when a line is made.
		for (n = 0; n < LINES; n++) {
			x = 500 + (n - (LINES - 1) / 2) * 76; pop = starPop[n];
			if (n < starsOn) { K.glow(ctx, x, DECK_Y, 58, '#ffd43b', 0.45, true); K.star(ctx, x, DECK_Y + 1, 30 * (1 + pop * 0.6), '#ffd43b', pop * pop * 2.2); }
			else ctx.drawImage(slot(), x - 34, DECK_Y - 35, 68, 68);
		}
		for (n = 0; n < 25; n++) {
			sq = squares[n]; x = GX + (n % 5) * PITCH; y = GY + Math.floor(n / 5) * PITCH; cx = x + T / 2; cy = y + T / 2;
			if (sq.set) { if (sq.stamped || sq.bump > 0) square(ctx, n, sq, x, y, false); continue; }
			if (!swapped) {
				// The old card falls away, a tile at a time.
				e = K.clamp((dealT - n * 0.03) / 0.3, 0, 1);
				if (e >= 1) continue;
				ctx.globalAlpha = 1 - e * e;
				ctx.save(); ctx.translate(cx, cy + e * e * 520); ctx.rotate(e * (n % 2 ? 0.5 : -0.5)); ctx.translate(-cx, -cy);
			} else {
				// The new one is dealt out from the top, a tile at a time.
				e = K.clamp((dealT - IN - n * 0.055) / 0.36, 0, 1);
				if (e <= 0) continue;
				o = K.out(e); s = 0.3 + 0.7 * K.back(e);
				ctx.globalAlpha = Math.min(1, e * 4);
				ctx.save(); ctx.translate(K.lerp(500, cx, o), K.lerp(DECK_Y, cy, o)); ctx.rotate((1 - o) * (n % 2 ? 0.7 : -0.7)); ctx.scale(s, s); ctx.translate(-cx, -cy);
			}
			square(ctx, n, sq, x, y, true);
			ctx.restore(); ctx.globalAlpha = 1;
		}
		if (phase !== 'deal') {
			// Calls waiting on a square: a little tray that fills with callers until there are enough to stamp it.
			for (n = 0; n < 25; n++) {
				sq = squares[n]; count = sq.calls.length;
				if (!count || sq.stamped) continue;
				x = GX + (n % 5) * PITCH; y = GY + Math.floor(n / 5) * PITCH;
				// Under a picture; beside the number on a square of words, so the words stay readable.
				if (VOTES > 5) { if (sq.words) K.bar(ctx, x + 72, y + 16, T - 84, 22, count / VOTES, '#ffd43b', 'rgba(20,27,50,.94)'); else K.bar(ctx, x + 18, y + T - 44, T - 36, 24, count / VOTES, '#ffd43b', 'rgba(20,27,50,.94)'); continue; }
				o = sq.words ? Math.min(30, (T - 84) / VOTES) : Math.min(42, (T - 14) / VOTES); w = VOTES * o + 8;
				left = sq.words ? x + T - 8 - w : x + T / 2 - w / 2; top = sq.words ? y + 27 - o / 2 - 2 : y + T - 16 - o;
				K.rr(ctx, left, top, w, o + 4, o / 2 + 2); ctx.fillStyle = 'rgba(20,27,50,.94)'; ctx.fill();
				for (k = 0; k < VOTES; k++) {
					cx = left + 4 + o / 2 + k * o; cy = top + 2 + o / 2;
					if (k < count) {
						c = sq.calls[k]; rem = 60000 - (now - c.at);
						ctx.globalAlpha = rem < 8000 ? Math.max(0.25, rem / 8000) : 1;
						K.face(ctx, c.p, cx, cy, (o / 2 - 2.5) * K.back(K.clamp((clock - c.born) / 0.3, 0, 1)));
						ctx.globalAlpha = 1;
					} else { ctx.beginPath(); ctx.arc(cx, cy, o * 0.17, 0, 6.2832); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill(); }
				}
			}
			// A quiet card: the number chips pop in turn, since the numbers are what chat types.
			idle = clock - lastCall;
			if (phase === 'play' && idle > 6) {
				u = (idle - 6) % 6 * 16;
				for (n = Math.max(0, Math.ceil(u - 3)); n <= u && n < 25; n++) {
					sq = squares[n];
					if (sq.stamped) continue;
					s = 62 * (1 + 0.42 * Math.sin((u - n) / 3 * 3.1416));
					ctx.drawImage(chip(sq.n), GX + (n % 5) * PITCH + 34 - s / 2, GY + Math.floor(n / 5) * PITCH + 32 - s / 2, s, s);
				}
			}
			// A bingo: light runs along the line.
			if (!K.calm) for (n = 0; n < fxLines.length; n++) {
				f = fxLines[n];
				if (f.t <= 0 || f.t > 0.9) continue;
				for (k = 0; k < 5; k++) {
					u = f.t * 9 - k;
					if (u <= 0 || u >= 2) continue;
					ctx.globalAlpha = Math.sin(u / 2 * 3.1416) * 0.8;
					K.rr(ctx, GX + (f.cells[k] % 5) * PITCH, GY + Math.floor(f.cells[k] / 5) * PITCH, T, T - 8, 24); ctx.fillStyle = '#fff'; ctx.fill();
				}
				ctx.globalAlpha = 1;
			}
			for (n = 0; n < fxLines.length; n++) {
				f = fxLines[n];
				if (f.t <= 0 || f.t >= FLY) continue;
				e = K.ease(f.t / FLY); s = Math.sin(e * 3.1416);
				x = K.lerp(GX + (f.cells[2] % 5) * PITCH + T / 2, 500 + (f.star - (LINES - 1) / 2) * 76, e);
				y = K.lerp(GY + Math.floor(f.cells[2] / 5) * PITCH + T / 2, DECK_Y, e) - s * 70;
				K.glow(ctx, x, y, 80 + s * 60, '#ffd43b', 0.6, true);
				K.star(ctx, x, y, 30 + s * 44, '#ffd43b', e * 6.2832);
			}
			// Who stamped it, shown for a moment above the square.
			for (n = 0; n < tags.length; n++) {
				g = tags[n];
				if (g.t < 0.3) continue;
				w = g.w + 40; e = K.back(K.clamp((g.t - 0.3) * 4, 0, 1));
				x = K.clamp(GX + (g.i % 5) * PITCH + T / 2, w / 2 + 8, 992 - w / 2); y = GY + Math.floor(g.i / 5) * PITCH - 12;
				ctx.globalAlpha = K.clamp((g.t - 0.3) * 5, 0, 1) * K.clamp((2.8 - g.t) * 3, 0, 1);
				ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
				K.panel(ctx, -w / 2, -24, w, 48, 24, 'rgba(12,16,28,.95)');
				K.label(ctx, g.name, 0, 0, 28);
				ctx.restore();
			}
			ctx.globalAlpha = 1;
		}
		K.fx.draw(ctx);
	}

	// Demo chat works toward one line, with the odd stray call, so squares fill, stamp and make a bingo.
	if (K.demo) K.every(function () {
		var now = Date.now(), open = [], rest = [], n, i, k, name, tries, busy;
		if (phase !== 'play') return;
		while (target < 0 || done[target]) target = Math.floor(Math.random() * ROWS.length);
		for (n = 0; n < 5; n++) if (!squares[ROWS[target][n]].stamped) open.push(ROWS[target][n]);
		for (n = 0; n < 25; n++) if (!squares[n].stamped) rest.push(n);
		i = open.length && Math.random() < 0.8 ? open[0] : K.pick(rest);
		for (tries = 0; tries < 10; tries++) {
			name = K.pick(K.names); busy = now - (demoLast[name] || 0) < 5200;
			for (k = 0; k < squares[i].calls.length; k++) if (squares[i].calls[k].p.name === name) busy = true;
			if (!busy) break;
		}
		demoLast[name] = now;
		K.say(name, Math.random() < 0.15 ? '!bingo ' + (i + 1) : String(i + 1));
	}, 260, 620);

	newCard();
	window.SSNStreamBingo = {
		state: function () {
			var stamped = [], pending = {};
			squares.forEach(function (sq) { if (sq.stamped) stamped.push(sq.n); else if (sq.calls.length) pending[sq.n] = sq.calls.length; });
			return { card: cardNo, stamped: stamped, pending: pending, bingos: bingos, dealing: phase === 'deal' };
		}
	};
	K.loop(update, draw);
	K.start();
})();
