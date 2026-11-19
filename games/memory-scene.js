// Memory Parade, drawn: four numbered pads play a sequence, it is covered, and chat types it back from memory.
// The rules live in puzzle-party-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	// Everything is drawn in design units: a 1080-high (wide window) or 1080-wide (tall window) box fitted into the browser source.
	var K = window.SSNArcade, st = K.stage(), box = null, W = 1920, H = 1080, px = 1, ox = 0, oy = 0, portrait = false, clock = 0;
	var COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c'], GOLD = '#ffd43b', GREEN = '#69db7c', EDGE = 'rgba(10,14,24,.9)', NAVY = '#1b2233', DEPTH = 30, VERDICT = 2.6;
	var faces = {}, people = {}, count = 0, waiting = [], tray = [], waitGrid = null, trayGrid = null;
	var snap = { phase: 'waiting', stage: 0, round: 0, revealed: false, seq: '111', left: 5, share: 1 };
	var showAt = -99, hideAt = -99, lead = 0.7, beat = -1, playing = -1, pulse = -1, lit = [0, 0, 0, 0], hit = [0, 0, 0, 0], trayGlow = 0, board = 1;
	var verdict = null, resultAt = -1, podiumAt = -1, leaders = [], awarded = 0;
	var L = {}, sides = [], rests = [], offs = [], ons = [], fronts = [], back = null, column = null, stamps = {};
	document.body.classList.add('ssn-scene');

	function shade(g, w, h, r) {
		var grad = g.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, 'rgba(255,255,255,.34)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,40,.26)');
		g.fillStyle = grad; g.fillRect(0, 0, w, h);
		g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(w / 2, -h * 0.18, w * 0.8, h * 0.6, 0, 0, 6.2832); g.fill();
	}
	function digit(g, text, x, y, size, color) {
		g.font = K.font(size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size * 0.13; g.strokeStyle = 'rgb(10,14,24)';
		g.strokeText(text, x, y + size * 0.04); g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
	}
	// A pad is a thick button: a dark side, and a top that is drawn dim or lit and sinks a little while it plays.
	function padSide(color) {
		return K.layer((L.pw + 12) * px, (L.ph + 12) * px, function (g) {
			g.scale(px, px); g.translate(6, 6);
			K.rr(g, 0, 0, L.pw, L.ph, 52); g.fillStyle = color; g.fill(); g.fillStyle = 'rgba(8,10,44,.55)'; g.fill(); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
		});
	}
	// The top of a pad, dim or lit; with whole set, the side is painted under it so a resting pad is a single picture.
	function padTop(color, text, bright, whole) {
		return K.layer((L.pw + 12) * px, (L.ph + (whole ? DEPTH + 12 : 12)) * px, function (g) {
			var glow;
			g.scale(px, px); g.translate(6, 6);
			if (whole) { K.rr(g, 0, DEPTH, L.pw, L.ph, 52); g.fillStyle = color; g.fill(); g.fillStyle = 'rgba(8,10,44,.55)'; g.fill(); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke(); }
			K.rr(g, 0, 0, L.pw, L.ph, 52); g.fillStyle = color; g.fill();
			g.save(); g.clip();
			shade(g, L.pw, L.ph);
			if (bright) {
				glow = g.createRadialGradient(L.pw / 2, L.ph / 2, 10, L.pw / 2, L.ph / 2, L.pw * 0.62);
				glow.addColorStop(0, 'rgba(255,255,255,.6)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
				g.fillStyle = glow; g.fillRect(0, 0, L.pw, L.ph);
			} else { g.fillStyle = 'rgba(10,14,44,.4)'; g.fillRect(0, 0, L.pw, L.ph); }
			g.restore();
			K.rr(g, 0, 0, L.pw, L.ph, 52); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
			K.rr(g, 9, 9, L.pw - 18, L.ph - 18, 44); g.lineWidth = 4; g.strokeStyle = bright ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.2)'; g.stroke();
			digit(g, text, L.pw / 2, L.ph / 2 + 6, L.ph * 0.58, bright ? '#ffffff' : '#d5dcee');
		});
	}
	// The small tiles of the sequence row: a coloured face per digit, and one plain back that covers them.
	function tile(color, text) {
		return K.layer((L.tw + 8) * px, (L.th + 16) * px, function (g) {
			g.scale(px, px); g.translate(4, 4);
			K.rr(g, 0, 8, L.tw, L.th, 24); g.fillStyle = color || '#2b3454'; g.fill(); g.fillStyle = 'rgba(8,10,44,.5)'; g.fill(); g.lineWidth = 4; g.strokeStyle = EDGE; g.stroke();
			K.rr(g, 0, 0, L.tw, L.th, 24); g.fillStyle = color || '#2f3a5e'; g.fill();
			g.save(); g.clip(); shade(g, L.tw, L.th); g.restore();
			K.rr(g, 0, 0, L.tw, L.th, 24); g.lineWidth = 4; g.strokeStyle = EDGE; g.stroke();
			if (color) digit(g, text, L.tw / 2, L.th / 2 + 4, L.th * 0.62, '#ffffff');
			else { g.font = K.font(L.th * 0.56); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8795b6'; g.fillText(text, L.tw / 2, L.th / 2 + 4); }
		});
	}
	function layout() {
		var n, mid;
		portrait = st.H > st.W;
		if (portrait) { W = 1080; H = K.clamp(st.H / st.W * 1080, 1600, 2400); } else { H = 1080; W = K.clamp(st.W / st.H * 1080, 1500, 2500); }
		box = K.fit(st, W, H); px = st.k * box.s; ox = st.k * box.x; oy = st.k * box.y;
		L.pad = [];
		if (portrait) {
			L.ringX = 132; L.ringY = 136; L.ringR = 82; L.pipX = W - 132; L.pipY = 136;
			L.rowY = 336; L.tw = 128; L.th = 146; L.tgap = 14;
			L.trayX = 40; L.trayW = W - 80; L.trayH = 256; L.trayY = H - 44 - L.trayH;
			L.waitX = 50; L.waitW = W - 100; L.waitY = L.trayY - 250;
			L.chipY = L.waitY - 140; L.chip = 58;
			L.pw = 440; L.ph = Math.min(330, (L.chipY - 70 - (L.rowY + L.th / 2 + 40) - 36 - DEPTH * 2) / 2);
			mid = (L.rowY + L.th / 2 + 40 + L.chipY - 70) / 2;
			for (n = 0; n < 4; n++) L.pad.push([W / 2 + (n % 2 ? 1 : -1) * (L.pw + 36) / 2, mid + (n < 2 ? -1 : 1) * (L.ph + DEPTH + 36) / 2 - DEPTH / 2]);
			L.podW = 330; L.podBase = H * 0.62; L.podH = [360, 260, 190]; L.podR = [150, 112, 112];
			L.crowdY = L.podBase + 130; L.crowdPer = 9; L.crowdGap = 108; L.crowdR = 44;
		} else {
			L.ringX = 150; L.ringY = 134; L.ringR = 88; L.pipX = W - 150; L.pipY = 134;
			L.rowY = 130; L.tw = 128; L.th = 146; L.tgap = 16;
			L.pw = Math.min(330, (W - 330) / 4); L.ph = 286;
			for (n = 0; n < 4; n++) L.pad.push([W / 2 + (n - 1.5) * (L.pw + 42), 424]);
			L.chipY = 672; L.chip = 52;
			L.waitX = 60; L.waitW = W * 0.6 - 90; L.waitY = 846;
			L.trayX = W * 0.6; L.trayW = W * 0.4 - 60; L.trayY = 758; L.trayH = 282;
			L.podW = 320; L.podBase = 770; L.podH = [290, 205, 150]; L.podR = [140, 106, 106];
			L.crowdY = 880; L.crowdPer = Math.floor((W - 200) / 96); L.crowdGap = 96; L.crowdR = 38;
		}
		// Faces stand in two rows; a bigger crowd is drawn smaller and three rows deep.
		L.wait = [{ per: Math.max(1, Math.floor(L.waitW / 110)), gap: 110, row: 106, r: 49, rows: 2 }, { per: Math.max(1, Math.floor(L.waitW / 80)), gap: 80, row: 78, r: 35, rows: 3 }];
		L.tray = [{ per: Math.max(1, Math.floor((L.trayW - 110) / 96)), gap: 96, row: 96, r: 42, rows: 2 }, { per: Math.max(1, Math.floor((L.trayW - 110) / 72)), gap: 72, row: 72, r: 31, rows: 3 }];
		waitGrid = waitGrid && waitGrid.rows === 3 ? L.wait[1] : L.wait[0]; trayGrid = trayGrid && trayGrid.rows === 3 ? L.tray[1] : L.tray[0];
		for (n = 0; n < 4; n++) { sides[n] = padSide(COLORS[n]); rests[n] = padTop(COLORS[n], String(n + 1), false, true); offs[n] = padTop(COLORS[n], String(n + 1), false, false); ons[n] = padTop(COLORS[n], String(n + 1), true, false); fronts[n] = tile(COLORS[n], String(n + 1)); }
		back = tile('', '?');
		// One podium block, tall enough for first place; the shorter ones show only its top part.
		column = K.layer(L.podW * px, (L.podH[0] + 8) * px, function (g) {
			var grad = g.createLinearGradient(0, 0, 0, L.podH[0]);
			g.scale(px, px);
			grad.addColorStop(0, '#46527a'); grad.addColorStop(0.2, '#2b3454'); grad.addColorStop(1, '#171c32');
			K.rr(g, 7, 3, L.podW - 14, L.podH[0] + 40, 22); g.fillStyle = grad; g.fill(); g.lineWidth = 5; g.strokeStyle = EDGE; g.stroke();
			g.fillStyle = 'rgba(255,255,255,.2)'; K.rr(g, 26, 12, L.podW - 52, 6, 3); g.fill();
		});
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
	// Where a face stands: in the waiting rows, in the answered tray, or (at the end) in the crowd under the podium.
	function place(q, out) {
		var per, row, inRow, n = q.n, total, g;
		if (podiumAt >= 0) {
			per = L.crowdPer; total = waiting.length; row = Math.floor(n / per); inRow = Math.min(per, total - row * per);
			out.x = W / 2 + ((n % per) - (inRow - 1) / 2) * L.crowdGap; out.y = L.crowdY + row * L.crowdGap; out.r = L.crowdR; out.hide = out.y > H - L.crowdR - 16;
		} else if (q.answered) {
			g = trayGrid; per = g.per; total = seats(); row = Math.floor(n / per); inRow = Math.min(per, total - row * per);
			out.x = L.trayX + L.trayW / 2 + 22 + ((n % per) - (inRow - 1) / 2) * g.gap; out.y = L.trayY + L.trayH / 2 + 6 + (row - (Math.ceil(total / per) - 1) / 2) * g.row; out.r = g.r; out.hide = n >= per * g.rows;
		} else {
			g = waitGrid; per = g.per; total = Math.min(waiting.length, per * g.rows); row = Math.floor(n / per); inRow = Math.min(per, total - row * per);
			out.x = L.waitX + L.waitW / 2 + ((n % per) - (inRow - 1) / 2) * g.gap; out.y = L.waitY + 52 + (row - (Math.ceil(total / per) - 1) / 2) * g.row; out.r = g.r; out.hide = n >= per * g.rows;
		}
		return out;
	}
	// The tray has a seat for everyone who has joined (two rows at most), so it is plain how many answers are still out.
	function seats() { return K.clamp(count, 3, trayGrid.per * trayGrid.rows); }
	function regroup() {
		var key, q, n;
		waiting = []; tray = [];
		for (key in people) { q = people[key]; if (podiumAt >= 0 && q.lead) continue; (q.answered && podiumAt < 0 ? tray : waiting).push(q); }
		waiting.sort(function (a, b) { return a.at - b.at; }); tray.sort(function (a, b) { return a.ansAt - b.ansAt; });
		waitGrid = L.wait[waiting.length > L.wait[0].per * 2 ? 1 : 0]; trayGrid = L.tray[count > L.tray[0].per * 2 ? 1 : 0];
		for (n = 0; n < waiting.length; n++) waiting[n].n = n;
		for (n = 0; n < tray.length; n++) tray[n].n = n;
	}
	// A neutral pattern of the right length to show how an answer is typed; never the sequence itself.
	function pattern() { var p = '123412'.slice(0, snap.seq.length); return p === snap.seq ? '432143'.slice(0, snap.seq.length) : p; }

	window.SSNScene = {
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m);
			faces[key] = K.player(key.toLowerCase(), clean(m.chatname), m.chatimg);
		},
		sync: function (game, now) {
			var changed = false, open = game.phase === 'active' && game.revealed, ranked = [], all = [], pops = 0;
			if (game.round !== snap.round) {
				people = {}; count = 0; changed = true; verdict = null; resultAt = -1; podiumAt = -1; leaders = []; showAt = -99; hideAt = -99; lead = 0.7;
			} else if (game.stage > snap.stage) {
				// The engine has scored the answers: whoever gained a point was right.
				// The next sequence starts a moment later than the first did, so the eye can take in who was right.
				verdict = { seq: snap.seq, at: clock, final: game.phase === 'result' }; lead = 1.1;
				game.users.forEach(function (p, key) {
					var q = people[key];
					if (!q || !q.answered) return;
					q.mark = p.score > q.points ? 1 : -1;
					if (q.mark > 0 && pops++ < 12) K.fx.spark(q.x, q.y, GOLD, 9, 320, 5, 0.5);
				});
				if (pops) K.shake(st, 6);
			}
			game.users.forEach(function (p, key) {
				var q = people[key];
				if (!q) { q = people[key] = { key: key, face: faceFor(key, p.name), at: clock, ansAt: 0, answered: false, mark: 0, hop: 0, n: 0, x: count % 2 && portrait ? W + 90 : -90, y: L.waitY + 50, points: 0, score: '', lead: false }; count++; changed = true; }
				if (open && !q.answered && game.votes.has(key)) { q.answered = true; q.ansAt = clock; q.hop = 1; trayGlow = 1; changed = true; }
				if (q.points !== p.score) { q.points = p.score; q.score = p.score > 0 ? String(p.score) : ''; }
			});
			if (changed) regroup();
			// The engine's own clocks say how long the sequence has been showing and how long answers stay open.
			if (game.phase === 'active' && !game.revealed) showAt = clock - (5000 - (game.showUntil - now)) / 1000;
			if (open && !snap.revealed) { hideAt = clock; beat = -1; playing = -1; pulse = -1; }
			snap = {
				phase: game.phase, stage: game.stage, round: game.round, revealed: !!game.revealed, seq: String(game.sequence),
				left: game.phase !== 'active' ? 5 : Math.max(0, Math.ceil(((game.revealed ? game.waveDeadline : game.showUntil) - now) / 1000)),
				share: game.phase !== 'active' ? 1 : game.revealed ? K.clamp((game.waveDeadline - now) / 10000, 0, 1) : K.clamp((game.showUntil - now) / 5000, 0, 1)
			};
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock;
				game.users.forEach(function (p, key) { all.push(faceFor(key, p.name)); if (p.score > 0) ranked.push({ key: key, face: faceFor(key, p.name), score: String(p.score), points: p.score }); });
				ranked.sort(function (a, b) { return b.points - a.points; });
				leaders = ranked.slice(0, 3);
				if (awarded !== game.round) { awarded = game.round; K.awardRound(leaders.map(function (r) { return r.face; }), all); }
			}
		},
		// A livelier demo than the page's own: a crew joins, and each wave most of them remember the sequence and a few do not.
		demo: function (receive, game) {
			var names = K.names.slice(0, 14), joined = 0, wave = '', done = {};
			function say(name, text) { receive({ type: 'demo', chatname: name, chatmessage: text, textonly: true }); }
			setInterval(function () {
				var name, guess = '', n;
				if (game.phase === 'result') { joined = 0; return; }
				if (!game.users.size) joined = 0;
				if (joined < names.length && (joined < 8 || Math.random() < 0.12)) { say(names[joined++], '!ready'); return; }
				if (game.phase !== 'active' || !game.revealed) return;
				if (wave !== game.round + ':' + game.stage) { wave = game.round + ':' + game.stage; done = {}; }
				name = names[Math.floor(Math.random() * joined)];
				if (done[name] || Math.random() < 0.35) return;
				done[name] = 1;
				for (n = 0; n < game.sequence.length; n++) guess += 1 + Math.floor(Math.random() * 4);
				say(name, Math.random() < 0.62 ? game.previewCommand() : '!mem ' + guess);
			}, 300);
		}
	};

	var spot = { x: 0, y: 0, r: 0, hide: false }, seat = { n: 0, answered: true };
	function update(dt) {
		var key, q, n, e, len, passes, slots, step, b, pos, now = -1;
		clock += dt;
		if (verdict && clock - verdict.at > VERDICT) {
			if (verdict.final) { podiumAt = clock; for (n = 0; n < leaders.length; n++) if (people[leaders[n].key]) people[leaders[n].key].lead = true; }
			verdict = null;
			for (key in people) { q = people[key]; if (q.answered) q.hop = 1; q.answered = false; q.mark = 0; }
			regroup();
		}
		// While the sequence is open the pads play it in order, twice over when it is short.
		playing = -1; pulse = -1;
		if (snap.phase === 'active' && !snap.revealed) {
			e = clock - showAt; len = snap.seq.length; passes = (4.85 - lead) / (len * 2 + 1) >= 0.5 ? 2 : 1; slots = len * passes + passes - 1;
			step = Math.min(0.72, (4.85 - lead) / slots); b = (e - lead) / step; pos = Math.floor(b) % (len + 1);
			if (b >= 0 && b < slots && pos < len) { pulse = pos; if (b - Math.floor(b) < 0.72) { playing = +snap.seq.charAt(pos) - 1; now = Math.floor(b); } }
		} else if (snap.phase === 'waiting') {
			// Idle: a slow light rolls across the pads.
			for (n = 0; n < 4; n++) lit[n] = K.approach(lit[n], 0.5 * Math.pow(Math.max(0, Math.sin(clock * 2.2 - n * 1.5708)), 3), 10, dt);
		}
		if (now !== beat) { beat = now; if (now >= 0 && playing >= 0) { hit[playing] = 1; K.fx.spark(L.pad[playing][0], L.pad[playing][1], COLORS[playing], 10, 420, 6, 0.5); } }
		for (n = 0; n < 4; n++) {
			if (snap.phase !== 'waiting') lit[n] = K.approach(lit[n], n === playing ? 1 : 0, n === playing ? 40 : 11, dt);
			if (hit[n] > 0) hit[n] = Math.max(0, hit[n] - dt * 2.6);
		}
		if (trayGlow > 0) trayGlow = Math.max(0, trayGlow - dt * 2);
		board = K.approach(board, podiumAt >= 0 ? 0 : 1, 6, dt);
		for (key in people) {
			q = people[key]; place(q, spot);
			q.x = K.approach(q.x, spot.x, 7, dt); q.y = K.approach(q.y, spot.y, 7, dt);
			if (q.hop > 0) q.hop = Math.max(0, q.hop - dt * 2.2);
		}
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
	function tick(ctx, x, y, s, color) {
		ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.3; ctx.strokeStyle = color;
		ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.02); ctx.lineTo(x - s * 0.12, y + s * 0.4); ctx.lineTo(x + s * 0.55, y - s * 0.36); ctx.stroke(); ctx.lineCap = 'butt';
	}
	function person(ctx, q) {
		var x = q.x, y = q.y, a = 1, e, r;
		place(q, spot);
		if (spot.hide) return;
		r = spot.r;
		if (q.hop > 0) y -= Math.sin((1 - q.hop) * 3.1416) * 80;
		if (verdict && q.mark) {
			e = clock - verdict.at;
			if (q.mark > 0) y -= Math.abs(Math.sin(e * 8 + q.n)) * 34 * K.clamp(2.2 - e, 0, 1);
			else { x += Math.sin(e * 40) * 7 * K.clamp(1 - e / 0.6, 0, 1); a = 0.45; }
		} else if (podiumAt >= 0) y -= Math.abs(Math.sin((clock - podiumAt) * 5 + q.n * 1.7)) * 14;
		K.shadow(ctx, x, q.y + r * 0.96, r * 0.9, r * 0.24, 0.35);
		ctx.globalAlpha = a;
		K.face(ctx, q.face, x, y, r);
		ctx.globalAlpha = 1;
		// The score sits by the face; it swells for a moment when a point is added.
		if (q.score) badge(ctx, x + r * 0.72, y + r * 0.7, r * 0.4 * (verdict && q.mark > 0 ? 1 + 0.9 * K.clamp(1 - (clock - verdict.at) / 0.9, 0, 1) : 1), q.score);
		// A name shows for a moment when someone joins (only the latest few, so a raid does not paper the screen).
		if (podiumAt < 0 && !q.answered && clock - q.at < 3.5 && q.n >= waiting.length - 4) K.label(ctx, K.short(q.face.name, 9), x, y - r - 13 - (q.n % 2) * 17, 21, '#ffffff');
	}

	function draw() {
		var ctx = K.begin(st, box), n, m, x, y, k, e, p, r, s, seq, len, front, flip, low, beatPulse = 0.5 + Math.sin(clock * 5) * 0.5;
		var open = snap.phase === 'active' && snap.revealed, showing = snap.phase === 'active' && !snap.revealed, since, press, extra;

		if (board > 0.02) {
			// The sequence row: open while it plays, covered while chat answers, opened one last time when the match ends.
			seq = snap.seq; len = seq.length;
			ctx.globalAlpha = board;
			for (n = 0; n < len; n++) {
				x = W / 2 + (n - (len - 1) / 2) * (L.tw + L.tgap); y = L.rowY; k = 1; flip = 1; front = false;
				if (showing) { k = K.back((clock - showAt - 0.05 - n * 0.05) / 0.35) * (n === pulse ? 1.14 : 1); front = true; }
				else if (open) { e = (clock - hideAt - n * 0.04) / 0.28; k = e < 0 ? 1.18 : 1 + 0.18 * (1 - K.out(e)); }
				else if (snap.phase === 'result') { e = K.clamp((clock - resultAt - n * 0.07) / 0.34, 0, 1); front = e >= 0.5; flip = Math.abs(Math.cos(e * 3.1416)); }
				else y += Math.sin(clock * 2 + n * 0.9) * 5;
				if (k <= 0) continue;
				if (front && n === pulse) K.glow(ctx, x, y, L.tw * 1.1, COLORS[+seq.charAt(n) - 1], 0.7, true);
				s = front ? fronts[+seq.charAt(n) - 1] : back;
				if (k === 1 && flip === 1) ctx.drawImage(s, sx(x - L.tw / 2 - 4), sy(y - L.th / 2 - 4), s.width / px, s.height / px);
				else { ctx.save(); ctx.translate(x, y); ctx.scale(k * (flip + 0.001), k); ctx.drawImage(s, -L.tw / 2 - 4, -L.th / 2 - 4, L.tw + 8, L.th + 16); ctx.restore(); }
			}
			// The four pads.
			for (n = 0; n < 4; n++) {
				x = L.pad[n][0]; y = L.pad[n][1]; press = lit[n] * 13;
				K.shadow(ctx, x, y + L.ph / 2 + DEPTH + 16, L.pw * 0.54, 24, 0.45);
				// The playing pad gets a halo in its colour (two plain outlines: a soft glow this size would be costly without a GPU).
				if (lit[n] > 0.02) {
					K.rr(ctx, x - L.pw / 2 - 8, y - L.ph / 2 - 8 + press, L.pw + 16, L.ph + DEPTH + 16 - press, 58); ctx.strokeStyle = COLORS[n];
					ctx.globalAlpha = board * lit[n] * 0.3; ctx.lineWidth = 44; ctx.stroke(); ctx.globalAlpha = board * Math.min(1, lit[n]) * 0.9; ctx.lineWidth = 14; ctx.stroke(); ctx.globalAlpha = board;
				}
				// At rest a pad is one picture. While it plays, its top sinks a little into the side and the lit top fades in over the dim one.
				if (lit[n] <= 0.02) ctx.drawImage(rests[n], sx(x - L.pw / 2 - 6), sy(y - L.ph / 2 - 6), rests[n].width / px, rests[n].height / px);
				else {
					ctx.drawImage(sides[n], sx(x - L.pw / 2 - 6), sy(y - L.ph / 2 - 6 + DEPTH), sides[n].width / px, sides[n].height / px);
					if (lit[n] < 0.97) ctx.drawImage(offs[n], sx(x - L.pw / 2 - 6), sy(y - L.ph / 2 - 6 + press), offs[n].width / px, offs[n].height / px);
					ctx.globalAlpha = board * Math.min(1, lit[n] * 1.04); ctx.drawImage(ons[n], sx(x - L.pw / 2 - 6), sy(y - L.ph / 2 - 6 + press), ons[n].width / px, ons[n].height / px); ctx.globalAlpha = board;
				}
				if (hit[n] > 0 && !K.calm) {
					extra = (1 - hit[n]) * 46;
					ctx.globalAlpha = board * hit[n] * 0.9; ctx.lineWidth = 9 * hit[n] + 2; ctx.strokeStyle = '#ffffff';
					K.rr(ctx, x - L.pw / 2 - extra, y - L.ph / 2 - extra + press, L.pw + extra * 2, L.ph + extra * 2, 52 + extra); ctx.stroke(); ctx.globalAlpha = board;
				}
			}
			ctx.globalAlpha = 1;
			// The one thing to type: join while waiting, answer while the row is covered.
			if (snap.phase === 'waiting') { K.hint(ctx, '!ready', W / 2, L.chipY, L.chip); if (!count) K.bubble(ctx, L.waitX + L.waitW / 2, L.waitY + 90, 0.9, clock); }
			else if (open) K.hint(ctx, '!mem ' + pattern(), W / 2, L.chipY, L.chip);

			// The tray for chatters who have answered; what they typed stays hidden.
			ctx.globalAlpha = board;
			K.panel(ctx, L.trayX, L.trayY, L.trayW, L.trayH, 34, 'rgba(14,20,40,.74)');
			ctx.setLineDash([10, 9]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.3)';
			for (n = tray.length, m = seats(); n < m; n++) { seat.n = n; place(seat, spot); ctx.beginPath(); ctx.arc(spot.x, spot.y, spot.r - 4, 0, 6.2832); ctx.stroke(); }
			ctx.setLineDash([]);
			if (trayGlow > 0) { ctx.globalAlpha = board * trayGlow * 0.6; K.rr(ctx, L.trayX, L.trayY, L.trayW, L.trayH, 34); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.globalAlpha = board; }
			ctx.beginPath(); ctx.arc(L.trayX + 40, L.trayY + 6, 34, 0, 6.2832); ctx.fillStyle = tray.length ? GREEN : '#2b3454'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = EDGE; ctx.stroke();
			tick(ctx, L.trayX + 40, L.trayY + 6, 34, tray.length ? NAVY : '#8795b6');
			// When a wave is scored, the right answer shows on the tray's edge while its faces find out.
			if (verdict && !verdict.final) {
				len = verdict.seq.length; since = clock - verdict.at;
				for (n = 0; n < len; n++) {
					k = K.back((since - n * 0.05) / 0.3) * K.clamp((VERDICT - since) / 0.25, 0, 1) * 0.52;
					if (k > 0) { x = L.trayX + 118 + n * (L.tw + L.tgap) * 0.52; ctx.save(); ctx.translate(x, L.trayY - 34); ctx.scale(k, k); ctx.drawImage(fronts[+verdict.seq.charAt(n) - 1], -L.tw / 2 - 4, -L.th / 2 - 4, L.tw + 8, L.th + 16); ctx.restore(); }
				}
			}
			ctx.globalAlpha = 1;
			if (waiting.length > waitGrid.per * waitGrid.rows) K.text(ctx, '+' + (waiting.length - waitGrid.per * waitGrid.rows), L.waitX + L.waitW / 2, L.waitY - 96, 32, '#ffffff');
			if (tray.length > trayGrid.per * trayGrid.rows) K.text(ctx, '+' + (tray.length - trayGrid.per * trayGrid.rows), L.trayX + L.trayW - 70, L.trayY - 26, 32, '#ffffff');
		}
		for (n = 0; n < waiting.length; n++) person(ctx, waiting[n]);
		for (n = 0; n < tray.length; n++) person(ctx, tray[n]);

		// The match result: the best memories take the podium, everyone else cheers below.
		if (podiumAt >= 0) {
			since = clock - podiumAt;
			if (leaders.length) K.shadow(ctx, W / 2, L.podBase + 6, L.podW * 1.7, 30, 0.5);
			for (n = leaders.length - 1; n >= 0; n--) {
				p = leaders[n]; k = K.out((since - 0.1 - (2 - n) * 0.22) / 0.55);
				if (k <= 0) continue;
				x = W / 2 + [0, -1, 1][n] * L.podW; m = L.podH[n] * k; y = L.podBase - m; r = L.podR[n];
				ctx.drawImage(column, 0, 0, column.width, Math.max(1, m * px), x - L.podW / 2, y, L.podW, m);
				if (k > 0.9) {
					K.label(ctx, K.short(p.face.name, 12), x, y + 46, n ? 30 : 36, '#ffffff');
					numeral(ctx, n, p.score, x, y + (n ? 106 : 132), n ? 74 : 104, GOLD, 1);
				}
				y -= r + 8 + (k >= 1 ? Math.abs(Math.sin(since * 4.5 + n * 1.3)) * 18 : 0);
				if (!n && k >= 1) { ctx.beginPath(); ctx.arc(x, y, r + 16, 0, 6.2832); ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.2 + beatPulse * 0.14; ctx.lineWidth = 44; ctx.stroke(); ctx.globalAlpha = 0.9; ctx.lineWidth = 12; ctx.stroke(); ctx.globalAlpha = 1; }
				K.bigFace(ctx, p.face, x, y, r * K.back((since - 0.1 - (2 - n) * 0.22) / 0.4));
				if (!n && k >= 1) K.crown(ctx, x, y - r * 0.92, r * 0.5);
			}
		}

		// Time left to watch (green) or to answer (white), and which of the four sequences this is.
		if (podiumAt < 0) {
			low = open && snap.left <= 3;
			K.shadow(ctx, L.ringX, L.ringY + L.ringR * 1.22, L.ringR, L.ringR * 0.2, 0.4);
			ctx.beginPath(); ctx.arc(L.ringX, L.ringY, L.ringR, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
			K.ring(ctx, L.ringX, L.ringY, L.ringR, snap.phase === 'result' ? 0 : snap.share, low ? '#ff6b6b' : showing ? '#8ce99a' : '#ffffff', L.ringR * 0.15);
			ctx.globalAlpha = snap.phase === 'waiting' ? 0.6 : 1;
			if (snap.phase !== 'result') numeral(ctx, 'clock', String(snap.left), L.ringX, L.ringY + 3, L.ringR * 0.86, low ? '#ff8787' : showing ? '#b2f2bb' : '#ffffff', low ? 1 + beatPulse * 0.1 : 1);
			ctx.globalAlpha = 1;
		}
		m = snap.phase === 'result' ? 4 : snap.stage;
		K.rr(ctx, L.pipX - 96, L.pipY - 30, 192, 60, 30); ctx.fillStyle = 'rgba(12,16,28,.86)'; ctx.fill();
		for (n = 0; n < 4; n++) {
			ctx.beginPath(); ctx.arc(L.pipX + (n - 1.5) * 44, L.pipY, n === m ? 13 + beatPulse * 3 : 12, 0, 6.2832);
			ctx.fillStyle = n < m ? GOLD : n === m ? '#ffffff' : 'rgba(255,255,255,.22)'; ctx.fill();
		}
		K.fx.draw(ctx);
	}

	window.SSNMemoryScene = { state: function () { return { phase: snap.phase, stage: snap.stage, showing: snap.phase === 'active' && !snap.revealed, joined: count, answered: tray.length }; } };
	K.loop(update, draw);
})();
