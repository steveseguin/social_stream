// Odd One Out, drawn: a question on a banner, three numbered tiles, and every chatter's face gathers by the tile they picked.
// The rules live in puzzle-party-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	// Everything is drawn in design units: a 1080-high (wide window) or 1080-wide (tall window) box fitted into the browser source.
	var K = window.SSNArcade, st = K.stage(), box = null, W = 1920, H = 1080, px = 1, ox = 0, oy = 0, portrait = false, clock = 0;
	var COLORS = ['#ff8a65', '#4dabf7', '#b197fc'], GOLD = '#ffd43b', EDGE = 'rgba(10,14,24,.9)', NAVY = '#1b2233', REVEAL = 2.4, FLIP = 0.45, DEPTH = 26;
	var faces = {}, voters = {}, voterCount = 0, groups = [[], [], []], leaving = [], top = {}, ranked = [], spot = { x: 0, y: 0 };
	var snap = { phase: 'waiting', stage: 0, round: 0, left: 12, share: 1, q: null };
	var shownQ = null, flipTo = null, flipAt = -1, introAt = 0, banner = null, tiles = [null, null, null], stamps = {};
	var reveal = null, correct = -1, lift = [0, 0, 0], grow = [1, 1, 1], dim = [1, 1, 1], bump = [0, 0, 0], board = 1, column = null, resultAt = -1, podiumAt = -1, leaders = [], crowd = [], awarded = 0;
	var L = {};
	document.body.classList.add('ssn-scene');

	function wrap(g, list, width) {
		var lines = [], line = '', n, test;
		for (n = 0; n < list.length; n++) {
			test = line ? line + ' ' + list[n] : list[n];
			if (line && g.measureText(test).width > width) { lines.push(line); line = list[n]; } else line = test;
			if (g.measureText(line).width > width) return null;
		}
		lines.push(line);
		return lines;
	}
	// Words are wrapped and shrunk until they fit the box, then set with evenly filled lines.
	function fitText(g, text, cx, cy, maxW, maxH, size, maxLines, color, outline) {
		var list = String(text).split(/\s+/), lines = null, even, n, f;
		for (n = 0; n < 40; n++, size *= 0.94) {
			g.font = K.font(size); lines = wrap(g, list, maxW);
			if (lines && lines.length <= maxLines && lines.length * size * 1.14 <= maxH) break;
		}
		if (!lines) lines = [String(text)];
		for (f = 0.5; f < 1 && lines.length > 1; f += 0.05) { even = wrap(g, list, maxW * f); if (even && even.length <= lines.length) { lines = even; break; } }
		g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
		for (n = 0; n < lines.length; n++) {
			f = cy + (n - (lines.length - 1) / 2) * size * 1.14;
			if (outline) { g.lineWidth = size * 0.15; g.strokeStyle = EDGE; g.strokeText(lines[n], cx, f + size * 0.03); g.strokeText(lines[n], cx, f); }
			g.fillStyle = color; g.fillText(lines[n], cx, f);
		}
	}
	// A tile: a coloured slab with a darker side under it, so it reads as a thick button, with its word set on top.
	function tile(color, text) {
		return K.layer((L.tw + 12) * px, (L.th + DEPTH + 12) * px, function (g) {
			var grad = g.createLinearGradient(0, 0, 0, L.th);
			g.scale(px, px); g.translate(6, 6);
			K.rr(g, 0, DEPTH, L.tw, L.th, 40); g.fillStyle = color; g.fill(); g.fillStyle = 'rgba(8,10,44,.5)'; g.fill(); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
			K.rr(g, 0, 0, L.tw, L.th, 40); g.fillStyle = color; g.fill();
			g.save(); g.clip();
			grad.addColorStop(0, 'rgba(255,255,255,.3)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,40,.24)');
			g.fillStyle = grad; g.fillRect(0, 0, L.tw, L.th);
			g.fillStyle = 'rgba(255,255,255,.13)'; g.beginPath(); g.ellipse(L.tw * 0.5, -L.th * 0.2, L.tw * 0.78, L.th * 0.62, 0, 0, 6.2832); g.fill();
			g.restore();
			K.rr(g, 0, 0, L.tw, L.th, 40); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
			K.rr(g, 8, 8, L.tw - 16, L.th - 16, 33); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.32)'; g.stroke();
			fitText(g, text, L.tw / 2, L.th / 2 + 18, L.tw - 64, L.th - 90, portrait ? 88 : 104, 2, '#ffffff', true);
		});
	}
	// The question and the three option words are laid out once per question, not every frame.
	function paintQ() {
		var q = shownQ, n;
		if (!q) return;
		banner = K.layer((L.bw + 12) * px, (L.bh + 26) * px, function (g) {
			g.scale(px, px); g.translate(6, 6);
			K.rr(g, 0, 14, L.bw, L.bh, 38); g.fillStyle = '#cdbf9f'; g.fill(); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
			K.rr(g, 0, 0, L.bw, L.bh, 38); g.fillStyle = '#fff8e7'; g.fill(); g.stroke();
			g.fillStyle = 'rgba(255,255,255,.9)'; K.rr(g, 22, 9, L.bw - 44, 7, 4); g.fill();
			fitText(g, q[0], L.bw / 2, L.bh / 2 + 3, L.bw - 120, L.bh - 50, portrait ? 80 : 72, portrait ? 3 : 2, NAVY, false);
		});
		for (n = 0; n < 3; n++) tiles[n] = tile(COLORS[n], q[1][n]);
	}
	function layout() {
		var n;
		portrait = st.H > st.W;
		if (portrait) { W = 1080; H = K.clamp(st.H / st.W * 1080, 1600, 2400); } else { H = 1080; W = K.clamp(st.W / st.H * 1080, 1500, 2500); }
		box = K.fit(st, W, H); px = st.k * box.s; ox = st.k * box.x; oy = st.k * box.y;
		if (portrait) {
			L.ringX = 132; L.ringY = 136; L.ringR = 82; L.pipX = W - 150; L.pipY = 136; L.pipGap = 44;
			L.bw = W - 80; L.bh = 262; L.bx = 40; L.by = 252;
			L.tw = 460; L.th = 226; L.row0 = 590; L.rowH = (H - 50 - L.row0) / 3;
			L.per = 5; L.gap = 98; L.fr = 43; L.rows = Math.max(1, Math.floor((L.rowH - 70) / L.gap)); L.chip = 38;
			L.podW = 330; L.podBase = H * 0.62; L.podH = [360, 260, 190]; L.podR = [150, 112, 112];
			L.crowdY = L.podBase + 130; L.crowdPer = 9; L.crowdGap = 108; L.crowdR = 44;
		} else {
			L.ringX = 150; L.ringY = 134; L.ringR = 88; L.pipX = W - 150; L.pipY = 134; L.pipGap = 44;
			L.bw = Math.min(1300, W - 600); L.bh = 176; L.bx = (W - L.bw) / 2; L.by = 36;
			L.tw = Math.min(540, W / 3 - 70); L.th = 290; L.tileY = 434;
			L.per = 6; L.gap = 96; L.fr = 44; L.rows = 3; L.chip = 42;
			L.podW = 320; L.podBase = 800; L.podH = [300, 215, 160]; L.podR = [150, 112, 112];
			L.crowdY = 905; L.crowdPer = Math.floor((W - 200) / 96); L.crowdGap = 96; L.crowdR = 38;
		}
		// One podium block, tall enough for first place; the shorter ones show only its top part.
		column = K.layer(L.podW * px, (L.podH[0] + 8) * px, function (g) {
			var grad = g.createLinearGradient(0, 0, 0, L.podH[0]);
			g.scale(px, px);
			grad.addColorStop(0, '#46527a'); grad.addColorStop(0.2, '#2b3454'); grad.addColorStop(1, '#171c32');
			K.rr(g, 7, 3, L.podW - 14, L.podH[0] + 40, 22); g.fillStyle = grad; g.fill(); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
			g.fillStyle = 'rgba(255,255,255,.2)'; K.rr(g, 26, 12, L.podW - 52, 6, 3); g.fill();
		});
		paintQ();
	}
	st.onresize = layout;
	layout();

	// Big pictures are placed on whole screen pixels and drawn at their own size whenever they are not being scaled:
	// without a GPU that is a plain copy, where a fractional position or scale is a slow resample.
	function sx(v) { return (Math.round(v * px + ox) - ox) / px; }
	function sy(v) { return (Math.round(v * px + oy) - oy) / px; }
	function tileX(n) { return portrait ? 40 + L.tw / 2 : W * [0.2, 0.5, 0.8][n]; }
	function tileY(n) { return portrait ? L.row0 + n * L.rowH + 46 + L.th / 2 : L.tileY; }
	function chipY(n) { return tileY(n) + L.th / 2 + DEPTH + 58; }
	// Where the nth face of a tile's group stands: beside the tile in a tall window, under it in a wide one.
	function slot(col, n) {
		var per = L.per, row = Math.floor(n / per), inRow;
		if (portrait) { spot.x = 590 + (n % per) * L.gap; spot.y = L.row0 + col * L.rowH + 86 + row * L.gap; return spot; }
		inRow = Math.min(per, Math.min(groups[col].length, per * L.rows) - row * per);
		spot.x = tileX(col) + ((n % per) - (inRow - 1) / 2) * L.gap; spot.y = chipY(col) + 122 + row * L.gap;
		return spot;
	}
	// Scores only change when the engine settles a question, so the standings are worked out then and kept.
	function rank(game) {
		var n;
		ranked = []; top = {};
		game.users.forEach(function (p, key) { if (p.score > 0) ranked.push({ key: key, face: faceFor(key, p.name), score: String(p.score), points: p.score }); });
		ranked.sort(function (a, b) { return b.points - a.points; });
		for (n = 0; n < ranked.length; n++) top[ranked[n].key] = ranked[n].score;
	}
	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	function clean(name) { return K.short(String(name).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '?', 24); }
	function faceFor(key, name) { return faces[key] || (faces[key] = K.player(key.toLowerCase(), clean(name || key.split(':').slice(1).join(':')))); }
	function regroup() {
		var n, m;
		groups = [[], [], []];
		Object.keys(voters).forEach(function (key) { groups[voters[key].choice].push(voters[key]); });
		// Earliest in, nearest the tile; a newcomer or a switcher joins the back of their group.
		for (n = 0; n < 3; n++) { groups[n].sort(function (a, b) { return a.at - b.at; }); for (m = 0; m < groups[n].length; m++) groups[n][m].n = m; }
	}
	// Faces of a finished question shrink away where they stand.
	function clearVoters() {
		var n, m, cap = L.per * L.rows;
		for (n = 0; n < 3; n++) for (m = 0; m < groups[n].length && m < cap && leaving.length < 80; m++) leaving.push({ face: groups[n][m].face, x: groups[n][m].x, y: groups[n][m].y, t: 0 });
		voters = {}; voterCount = 0; groups = [[], [], []];
	}

	window.SSNScene = {
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m);
			faces[key] = K.player(key.toLowerCase(), clean(m.chatname), m.chatimg);
		},
		sync: function (game, now) {
			var changed = false, all = [], pops = 0, cap = L.per * L.rows;
			if (game.round !== snap.round) {
				clearVoters(); reveal = null; correct = -1; resultAt = -1; podiumAt = -1; leaders = []; crowd = []; ranked = []; top = {};
			} else if (game.stage > snap.stage && snap.q) {
				// The engine has scored this question: show which tile was right, and who was on it, before moving on.
				reveal = { q: snap.q, at: clock, final: game.phase === 'result' };
				correct = snap.q[2];
				K.shake(st, 7);
				K.fx.spark(tileX(correct), tileY(correct), GOLD, 36, 620, 7, 0.8);
				K.fx.burst(tileX(correct), tileY(correct) - L.th / 2, null, 22, 520);
				groups[correct].forEach(function (v) { if (v.n < cap && pops++ < 8) K.fx.pop('+1', v.x, v.y - L.fr - 30, GOLD, 40); });
				rank(game);
			}
			// While a result is being shown the faces stay where they voted; the next question's votes are picked up after it.
			if (!reveal && game.phase !== 'result') {
				game.votes.forEach(function (text, key) {
					var choice = +text - 1, v = voters[key];
					if (!v) { v = voters[key] = { key: key, face: faceFor(key, (game.users.get(key) || {}).name), choice: choice, x: tileX(choice) + K.rand(-60, 60), y: portrait ? tileY(choice) : -80, at: clock, hop: 0, n: 0 }; if (portrait) v.x = W + 80; voterCount++; bump[choice] = 1; changed = true; }
					else if (v.choice !== choice) { v.choice = choice; v.hop = 1; v.at = clock; bump[choice] = 1; changed = true; }
				});
				// Votes only vanish when the engine clears them for a new question.
				if (voterCount !== game.votes.size) { Object.keys(voters).forEach(function (key) { if (!game.votes.has(key)) { delete voters[key]; voterCount--; changed = true; } }); }
				if (changed) regroup();
			}
			snap = {
				phase: game.phase, stage: game.stage, round: game.round, q: game.phase === 'result' ? null : game.question(),
				left: game.phase === 'active' ? Math.max(0, Math.ceil((game.waveDeadline - now) / 1000)) : 12,
				share: game.phase === 'active' ? K.clamp((game.waveDeadline - now) / 12000, 0, 1) : 1
			};
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock; leaders = ranked.slice(0, 3); crowd = [];
				game.users.forEach(function (p, key) { all.push(faceFor(key, p.name)); });
				crowd = all.filter(function (face) { return !leaders.some(function (r) { return r.face === face; }); }).slice(0, 60);
				if (awarded !== game.round) {
					awarded = game.round;
					K.awardRound(leaders.map(function (r) { return r.face; }), all);
				}
			}
		},
		// A livelier demo than the page's own: a crowd that mostly knows the answer, with a few guessers and mind-changers.
		demo: function (receive, game) {
			var names = K.names;
			setInterval(function () {
				if (game.phase === 'result' || reveal || flipAt >= 0) return;
				receive({ type: 'demo', chatname: K.pick(names), chatmessage: Math.random() < 0.5 ? game.previewCommand() : '!odd ' + (1 + Math.floor(Math.random() * 3)), textonly: true });
			}, 400);
		}
	};

	function update(dt) {
		var key, v, t, n, right, want = snap.q, cap = L.per * L.rows;
		clock += dt;
		if (reveal && clock - reveal.at > REVEAL) {
			if (reveal.final) podiumAt = clock;
			reveal = null; clearVoters();
		}
		// Swap in the next question with a flip, once the last one has been settled.
		if (!reveal && flipAt < 0 && want !== shownQ) {
			if (!want) { if (board < 0.03) shownQ = null; }
			else if (!shownQ) { shownQ = want; paintQ(); introAt = clock; }
			else { flipAt = clock; flipTo = want; }
		}
		if (flipAt >= 0) {
			if (clock - flipAt >= FLIP / 2 && shownQ !== flipTo) { shownQ = flipTo; paintQ(); }
			if (clock - flipAt >= FLIP) flipAt = -1;
		}
		for (n = 0; n < 3; n++) {
			right = reveal ? n === reveal.q[2] : null;
			lift[n] = K.approach(lift[n], right === null ? 0 : right ? -22 : 16, 7, dt);
			grow[n] = K.approach(grow[n], right === null ? 1 : right ? 1.07 : 0.93, 7, dt);
			dim[n] = K.approach(dim[n], right === false ? 0.38 : 1, 7, dt);
			if (right === null && Math.abs(grow[n] - 1) < 0.003) grow[n] = 1;
			if (right !== false && dim[n] > 0.99) dim[n] = 1;
			if (bump[n] > 0) bump[n] = Math.max(0, bump[n] - dt * 5);
		}
		board = K.approach(board, podiumAt >= 0 ? 0 : 1, 6, dt);
		for (key in voters) {
			v = voters[key]; t = slot(v.choice, Math.min(v.n, cap - 1));
			v.x = K.approach(v.x, t.x, 7, dt); v.y = K.approach(v.y, t.y + (portrait ? 0 : lift[v.choice] * 0.4), 7, dt);
			if (v.hop > 0) v.hop = Math.max(0, v.hop - dt * 2.4);
		}
		for (n = leaving.length - 1; n >= 0; n--) { leaving[n].t += dt * 3.2; if (leaving[n].t >= 1) { leaving[n] = leaving[leaving.length - 1]; leaving.pop(); } }
		if (podiumAt >= 0 && leaders.length && clock - podiumAt < 7 && Math.random() < dt * 6) K.fx.burst(K.rand(0.12, 0.88) * W, K.rand(0.06, 0.45) * H, null, 14, 480);
		K.fx.update(dt);
	}

	function badge(ctx, x, y, r, text) {
		ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = EDGE; ctx.stroke();
		K.text(ctx, text, x, y + r * 0.06, r * 1.25, NAVY, 'center', false);
	}
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
	function tick(ctx, x, y, s) {
		ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.3; ctx.strokeStyle = NAVY;
		ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.02); ctx.lineTo(x - s * 0.12, y + s * 0.4); ctx.lineTo(x + s * 0.55, y - s * 0.36); ctx.stroke(); ctx.lineCap = 'butt';
	}

	function draw() {
		var ctx = K.begin(st, box), n, m, x, y, k, v, list, right, a, fr = L.fr, cap = L.per * L.rows, shownRight = reveal ? reveal.q[2] : -1;
		var since = reveal ? clock - reveal.at : 0, flip = flipAt >= 0 ? Math.abs(Math.cos((clock - flipAt) / FLIP * 3.1416)) : 1, intro, low = snap.phase === 'active' && snap.left <= 3, pulse = 0.5 + Math.sin(clock * 5) * 0.5, voted = groups[0].length + groups[1].length + groups[2].length, p, r, done;

		if (board > 0.02 && shownQ) {
			// The question.
			intro = K.back((clock - introAt) / 0.45);
			ctx.globalAlpha = board;
			K.shadow(ctx, L.bx + L.bw / 2, L.by + L.bh + 30, L.bw * 0.5, 22, 0.4);
			if (intro === 1 && flip === 1) ctx.drawImage(banner, sx(L.bx - 6), sy(L.by - 6 - (1 - board) * 200), banner.width / px, banner.height / px);
			else {
				ctx.save(); ctx.translate(L.bx + L.bw / 2, L.by + L.bh / 2 - (1 - board) * 200); ctx.scale(intro, flip * intro + 0.001);
				ctx.drawImage(banner, -L.bw / 2 - 6, -L.bh / 2 - 6, L.bw + 12, L.bh + 26);
				ctx.restore();
			}
			// The three options.
			for (n = 0; n < 3; n++) {
				x = tileX(n); y = tileY(n); right = n === shownRight; a = dim[n] * board;
				intro = K.back((clock - introAt - 0.08 - n * 0.07) / 0.45);
				if (intro <= 0) continue;
				ctx.globalAlpha = a;
				K.shadow(ctx, x, y + L.th / 2 + DEPTH + 16, L.tw * 0.52 * grow[n], 22, 0.45);
				// The right answer gets a gold halo (two plain outlines: a soft glow this size would be costly without a GPU).
				if (right) {
					K.rr(ctx, x - L.tw * grow[n] / 2 - 8, y + lift[n] - L.th * grow[n] / 2 - 8, L.tw * grow[n] + 16, L.th * grow[n] + DEPTH + 16, 50); ctx.strokeStyle = GOLD;
					ctx.globalAlpha = a * (0.22 + pulse * 0.16); ctx.lineWidth = 40; ctx.stroke(); ctx.globalAlpha = a * 0.95; ctx.lineWidth = 14; ctx.stroke(); ctx.globalAlpha = a;
				}
				k = grow[n] * intro * (1 - Math.sin(bump[n] * 3.1416) * 0.035);
				ctx.save(); ctx.translate(sx(x - L.tw / 2 - 6) + L.tw / 2 + 6, sy(y + lift[n] + Math.sin(clock * 1.7 + n * 2.1) * 4 + Math.sin(bump[n] * 3.1416) * 7 - L.th / 2 - 6) + L.th / 2 + 6);
				if (k !== 1 || flip !== 1) ctx.scale(k * (flip + 0.001), k);
				ctx.drawImage(tiles[n], -L.tw / 2 - 6, -L.th / 2 - 6, tiles[n].width / px, tiles[n].height / px);
				// Its number, on a button at the top edge.
				ctx.beginPath(); ctx.arc(0, -L.th / 2 + 4, 44, 0, 6.2832); ctx.fillStyle = right ? GOLD : '#141a30'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = right ? EDGE : '#ffffff'; ctx.stroke();
				if (right) K.text(ctx, String(n + 1), 0, -L.th / 2 + 7, 56, NAVY, 'center', false); else K.label(ctx, String(n + 1), 0, -L.th / 2 + 7, 56, '#ffffff');
				if (right) { k = K.back((since - 0.15) / 0.4); if (k > 0) { ctx.beginPath(); ctx.arc(L.tw / 2 - 26, -L.th / 2 + 22, 40 * k, 0, 6.2832); ctx.fillStyle = '#69db7c'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = EDGE; ctx.stroke(); tick(ctx, L.tw / 2 - 26, -L.th / 2 + 22, 40 * k); } }
				ctx.restore();
				ctx.globalAlpha = 1;
				if (snap.phase !== 'result' && !reveal && flipAt < 0 && intro >= 1) K.hint(ctx, '!odd ' + (n + 1), x, chipY(n), L.chip);
			}
		}
		ctx.globalAlpha = 1;

		// Everyone stands by the tile they chose; the ones who were right bounce.
		for (n = 0; n < 3; n++) {
			list = groups[n]; right = n === shownRight;
			ctx.globalAlpha = reveal && !right ? 0.42 : 1;
			for (m = 0; m < list.length && m < cap; m++) {
				v = list[m]; k = v.hop > 0 ? Math.sin((1 - v.hop) * 3.1416) * 64 : 0;
				if (right) k += Math.abs(Math.sin(since * 8 + m * 0.9)) * 26;
				K.shadow(ctx, v.x, v.y + fr * 0.95, fr * 0.9, fr * 0.24, 0.35);
				K.face(ctx, v.face, v.x, v.y - k, fr);
				if (top[v.key]) badge(ctx, v.x + fr * 0.72, v.y - k + fr * 0.7, fr * 0.4, top[v.key]);
				if (!reveal && clock - v.at < 3.5 && m >= list.length - 3) K.label(ctx, K.short(v.face.name, 9), v.x, v.y - k - fr - 13 - (m % 2) * 17, 21, '#ffffff');
			}
			if (list.length > cap) { p = slot(n, cap - 1); K.text(ctx, '+' + (list.length - cap), portrait ? W - 60 : tileX(n), portrait ? p.y + fr + 26 : p.y + fr + 34, 32, COLORS[n]); }
		}
		ctx.globalAlpha = 1;
		for (n = 0; n < leaving.length; n++) { v = leaving[n]; ctx.globalAlpha = 1 - v.t; K.face(ctx, v.face, v.x, v.y - v.t * 30, fr * (1 - v.t * 0.6)); }
		ctx.globalAlpha = 1;

		// The match result: the best scores take the stage, everyone else cheers below.
		if (podiumAt >= 0) {
			since = clock - podiumAt;
			for (n = 0; n < crowd.length; n++) {
				k = K.back((since - 0.5 - n * 0.03) / 0.35);
				if (k <= 0) continue;
				m = Math.floor(n / L.crowdPer); a = Math.min(L.crowdPer, crowd.length - m * L.crowdPer);
				x = W / 2 + ((n % L.crowdPer) - (a - 1) / 2) * L.crowdGap; y = L.crowdY + m * L.crowdGap;
				if (y > H - L.crowdR - 20) break;
				K.shadow(ctx, x, y + L.crowdR, L.crowdR * 0.9, L.crowdR * 0.22, 0.35);
				K.face(ctx, crowd[n], x, y - Math.abs(Math.sin(since * 5 + n * 1.7)) * 14, L.crowdR * k);
			}
			if (leaders.length) K.shadow(ctx, W / 2, L.podBase + 6, L.podW * 1.7, 30, 0.5);
			for (n = leaders.length - 1; n >= 0; n--) {
				// Third place rises first, the winner last.
				p = leaders[n]; k = K.out((since - 0.1 - (2 - n) * 0.22) / 0.55);
				if (k <= 0) continue;
				x = W / 2 + [0, -1, 1][n] * L.podW; m = L.podH[n] * k; y = L.podBase - m; r = L.podR[n];
				ctx.drawImage(column, 0, 0, column.width, Math.max(1, m * px), x - L.podW / 2, y, L.podW, m);
				if (k > 0.9) {
					K.label(ctx, K.short(p.face.name, 12), x, y + 46, n ? 30 : 36, '#ffffff');
					numeral(ctx, n, p.score, x, y + (n ? 106 : 132), n ? 74 : 104, GOLD, 1);
				}
				y -= r + 8 + Math.abs(Math.sin(since * 4.5 + n * 1.3)) * 18 * (k >= 1 ? 1 : 0);
				if (!n && k >= 1) { ctx.beginPath(); ctx.arc(x, y, r + 16, 0, 6.2832); ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.2 + pulse * 0.14; ctx.lineWidth = 44; ctx.stroke(); ctx.globalAlpha = 0.9; ctx.lineWidth = 12; ctx.stroke(); ctx.globalAlpha = 1; }
				K.bigFace(ctx, p.face, x, y, r * K.back((since - 0.1 - (2 - n) * 0.22) / 0.4));
				if (!n && k >= 1) K.crown(ctx, x, y - r * 0.92, r * 0.5);
			}
		}

		// Time left on this question, and which of the five it is.
		if (podiumAt < 0) {
			K.shadow(ctx, L.ringX, L.ringY + L.ringR * 1.22, L.ringR, L.ringR * 0.2, 0.4);
			ctx.beginPath(); ctx.arc(L.ringX, L.ringY, L.ringR, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
			K.ring(ctx, L.ringX, L.ringY, L.ringR, snap.phase === 'result' ? 0 : snap.share, low ? '#ff6b6b' : '#ffffff', L.ringR * 0.15);
			ctx.globalAlpha = snap.phase === 'waiting' ? 0.6 : 1;
			if (snap.phase !== 'result') numeral(ctx, 'clock', String(snap.left), L.ringX, L.ringY + 3, L.ringR * 0.86, low ? '#ff8787' : '#ffffff', low ? 1 + pulse * 0.1 : 1);
			ctx.globalAlpha = 1;
		}
		done = snap.phase === 'result' ? 5 : snap.stage;
		K.rr(ctx, L.pipX - L.pipGap * 2 - 30, L.pipY - 30, L.pipGap * 4 + 60, 60, 30); ctx.fillStyle = 'rgba(12,16,28,.86)'; ctx.fill();
		for (n = 0; n < 5; n++) {
			x = L.pipX + (n - 2) * L.pipGap; r = n === done ? 13 + pulse * 3 : 12;
			ctx.beginPath(); ctx.arc(x, L.pipY, r, 0, 6.2832); ctx.fillStyle = n < done ? GOLD : n === done ? '#ffffff' : 'rgba(255,255,255,.22)'; ctx.fill();
		}
		if (snap.phase === 'waiting' && !voted && shownQ) { p = portrait ? { x: 800, y: L.row0 + L.rowH + 200 } : { x: tileX(1), y: chipY(1) + 250 }; K.bubble(ctx, p.x, p.y, 0.9, clock); }
		K.fx.draw(ctx);
	}

	window.SSNOddScene = { state: function () { return { phase: snap.phase, stage: snap.stage, groups: groups.map(function (g) { return g.length; }), correct: correct }; } };
	K.loop(update, draw);
})();
