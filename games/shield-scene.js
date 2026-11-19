// Meteor Shield, drawn: meteors fall in three coloured lanes and chatters power the matching shield to save the ship.
// The rules live in teamplay-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1, portrait = false, clock = 0;
	var LANES = [{ color: '#ff6b6b', cmd: '!shield red' }, { color: '#4dabf7', cmd: '!shield blue' }, { color: '#ffd43b', cmd: '!shield gold' }];
	var faces = {}, holders = {}, lanes = [[], [], []], snap = { phase: 'waiting', wave: 1, hull: 6, threats: [1, 0, 0], held: [0, 0, 0], left: 0, share: 1, round: 0 };
	var rocks = [], flash = [0, 0, 0], hurt = 0, shownHull = 6, resultAt = -1, safe = false, awarded = 0, blasts = 0, ship = null;
	document.body.classList.add('ssn-scene');

	function laneX(n) { return st.W * (portrait ? [0.18, 0.5, 0.82] : [0.2, 0.5, 0.8])[n]; }
	function hullTop() { return st.H - (portrait ? 330 : 270) * u; }
	function shieldY() { return hullTop() - 150 * u; }
	function paintShip() {
		var w = st.W, h = 230 * u;
		ship = K.layer(w * st.dpr, h * st.dpr, function (g) {
			var grad, n, x, top = 34 * u;
			g.scale(st.dpr, st.dpr);
			grad = g.createLinearGradient(0, top, 0, h); grad.addColorStop(0, '#4a5a82'); grad.addColorStop(0.35, '#2c3653'); grad.addColorStop(1, '#151a2e');
			K.rr(g, 30 * u, top, w - 60 * u, h - top - 16 * u, 70 * u); g.fillStyle = grad; g.fill();
			g.lineWidth = 4 * u; g.strokeStyle = 'rgba(10,14,24,.9)'; g.stroke();
			g.save(); K.rr(g, 30 * u, top, w - 60 * u, h - top - 16 * u, 70 * u); g.clip();
			g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, top, w, 9 * u);
			g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, top + 96 * u, w, 5 * u);
			g.restore();
			// One emitter dome per lane.
			for (n = 0; n < 3; n++) {
				x = laneX(n);
				g.beginPath(); g.arc(x, top + 4 * u, 52 * u, 3.1416, 0); g.closePath(); g.fillStyle = '#1a2036'; g.fill(); g.lineWidth = 4 * u; g.strokeStyle = 'rgba(10,14,24,.9)'; g.stroke();
				grad = g.createRadialGradient(x - 10 * u, top - 22 * u, 2 * u, x, top - 6 * u, 40 * u); grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, LANES[n].color); grad.addColorStop(1, 'rgba(0,0,0,0)');
				g.beginPath(); g.arc(x, top + 2 * u, 36 * u, 3.1416, 0); g.closePath(); g.fillStyle = grad; g.fill();
			}
		});
	}
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; portrait = st.H > st.W; paintShip(); };
	st.onresize();

	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	// The wave that just ended: every held shield stops one meteor in its lane, the rest reach the ship.
	function resolve(threats, held) {
		var n, list, m, stopped;
		for (n = 0; n < 3; n++) {
			list = rocks.filter(function (r) { return r.lane === n && !r.gone; });
			stopped = Math.min(held[n], threats[n]);
			for (m = 0; m < list.length; m++) { list[m].gone = m < stopped ? 'blocked' : 'through'; list[m].t = 0; }
			if (stopped) flash[n] = 1;
		}
	}
	function spawn(threats) {
		var n, m;
		rocks = rocks.filter(function (r) { return r.gone; });
		for (n = 0; n < 3; n++) for (m = 0; m < threats[n] && m < 12; m++) rocks.push({ lane: n, n: m, of: threats[n], spin: K.rand(-1.5, 1.5), rot: Math.random() * 6, seed: Math.random() * 6, x: 0, y: -120 * u, gone: '', t: 0 });
	}
	window.SSNScene = {
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m);
			faces[key] = K.player(key.toLowerCase(), String(m.chatname).slice(0, 24), m.chatimg);
		},
		sync: function (game, now) {
			var held = [0, 0, 0], changed = false, seen = {}, n, m, ranked;
			game.votes.forEach(function (lane, key) {
				var h = holders[key];
				held[lane]++; seen[key] = 1;
				if (!h) { h = holders[key] = { face: faces[key] || K.player(key.toLowerCase(), key.split(':').slice(1).join(':')), lane: lane, x: laneX(lane), y: st.H + 60 * u, at: clock }; changed = true; }
				else if (h.lane !== lane) { h.lane = lane; h.at = clock; changed = true; }
			});
			if (game.round !== snap.round) { rocks = []; resultAt = -1; shownHull = game.hull; holders = {}; changed = true; spawn(game.threats); }
			else if (game.wave !== snap.wave || (game.phase === 'result' && snap.phase === 'active')) {
				resolve(snap.threats, snap.held);
				if (game.hull < snap.hull) hurt = 1;
				if (game.phase === 'active') spawn(game.threats);
			} else if (snap.phase === 'waiting' && game.phase === 'active' && !rocks.length) spawn(game.threats);
			Object.keys(holders).forEach(function (key) { if (!seen[key]) { delete holders[key]; changed = true; } });
			if (changed) {
				lanes = [[], [], []];
				Object.keys(holders).forEach(function (key) { lanes[holders[key].lane].push(holders[key]); });
				for (n = 0; n < 3; n++) { lanes[n].sort(function (a, b) { return a.at - b.at; }); for (m = 0; m < lanes[n].length; m++) lanes[n][m].n = m; }
			}
			snap = { phase: game.phase, wave: game.wave, hull: game.hull, threats: game.threats.slice(), held: held, left: game.phase === 'active' ? Math.max(0, Math.ceil((game.waveDeadline - now) / 1000)) : 0, share: game.phase === 'active' ? K.clamp((game.waveDeadline - now) / 12000, 0, 1) : 1, round: game.round };
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock; safe = game.hull > 0;
				if (awarded !== game.round && safe) {
					awarded = game.round; ranked = [];
					game.users.forEach(function (player, key) { ranked.push({ face: faces[key] || K.player(key.toLowerCase(), player.name), count: player.count }); });
					ranked.sort(function (a, b) { return b.count - a.count; });
					K.awardRound(ranked.slice(0, 3).map(function (r) { return r.face; }), ranked.map(function (r) { return r.face; }));
				}
			}
		},
		// A livelier demo than the page's own: a crew that mostly covers the right lanes, and sometimes does not.
		demo: function (receive, game) {
			var names = K.names.slice(0, 16), colors = ['red', 'blue', 'gold'];
			setInterval(function () {
				if (game.phase === 'result') return;
				receive({ type: 'demo', chatname: K.pick(names), chatmessage: Math.random() < 0.7 ? game.previewCommand() : '!shield ' + K.pick(colors), textonly: true });
			}, 380);
		}
	};

	function update(dt) {
		var n, r, key, h, per = portrait ? 4 : 5, gap = 62 * u, row, col, inRow, prog = K.out(1 - snap.share), tx, ty, lane;
		clock += dt;
		shownHull = K.approach(shownHull, snap.hull, 8, dt);
		if (hurt > 0) hurt = Math.max(0, hurt - dt * 1.6);
		for (n = 0; n < 3; n++) if (flash[n] > 0) flash[n] = Math.max(0, flash[n] - dt * 2.2);
		for (n = rocks.length - 1; n >= 0; n--) {
			r = rocks[n]; r.rot += r.spin * dt;
			if (!r.gone) {
				// Each lane's meteors fall as a loose cluster and arrive just above the shield as the wave ends.
				tx = laneX(r.lane) + ((r.n % 3) - (Math.min(3, r.of - Math.floor(r.n / 3) * 3) - 1) / 2) * 84 * u + Math.sin(clock * 1.3 + r.seed) * 8 * u;
				ty = K.lerp(-100 * u, shieldY() - 96 * u, prog) - Math.floor(r.n / 3) * 82 * u;
				r.x = tx; r.y = snap.phase === 'active' ? K.approach(r.y, ty, 6, dt) : r.y;
			} else {
				r.t += dt;
				if (r.gone === 'blocked') {
					if (r.t < 0.12) r.y += 500 * u * dt;
					else { blasts++; K.fx.spark(r.x, r.y, LANES[r.lane].color, 22, 460 * u, 6 * u, 0.6); K.fx.spark(r.x, r.y, '#ffffff', 8, 300 * u, 4 * u, 0.4); rocks.splice(n, 1); }
				} else {
					r.y += 1500 * u * dt;
					if (r.y > hullTop() + 20 * u) { blasts++; K.fx.spark(r.x, hullTop() + 10 * u, '#ff9f43', 34, 620 * u, 8 * u, 0.8); K.shake(st, 13 * u); rocks.splice(n, 1); }
				}
			}
		}
		for (key in holders) {
			h = holders[key]; lane = lanes[h.lane];
			row = Math.floor(Math.min(h.n, per * 2 - 1) / per); col = Math.min(h.n, per * 2 - 1) % per; inRow = Math.min(per, Math.min(lane.length, per * 2) - row * per);
			h.x = K.approach(h.x, laneX(h.lane) + (col - (inRow - 1) / 2) * gap, 8, dt);
			h.y = K.approach(h.y, hullTop() - 44 * u - row * gap, 8, dt);
		}
		if (resultAt >= 0 && safe && clock - resultAt < 7 && Math.random() < dt * 5) K.fx.burst(K.rand(0.1, 0.9) * st.W, K.rand(0.1, 0.5) * st.H, null, 14, 460 * u);
		if (resultAt >= 0 && !safe && Math.random() < dt * 9) K.fx.spark(K.rand(0.1, 0.9) * st.W, hullTop() + K.rand(0, 60) * u, '#ff7b3b', 5, 260 * u, 6 * u, 0.7);
		K.fx.update(dt);
	}

	function meteor(color) {
		return K.sprite('meteor:' + color, 128, 128, function (g) {
			var grad, n, a, pts = [50, 44, 54, 40, 52, 46, 55, 42, 50, 45, 53, 41];
			g.beginPath();
			for (n = 0; n < pts.length; n++) { a = n / pts.length * 6.2832; g.lineTo(64 + Math.cos(a) * pts[n], 64 + Math.sin(a) * pts[n]); }
			g.closePath();
			grad = g.createRadialGradient(46, 42, 6, 64, 64, 60); grad.addColorStop(0, '#9a8f8a'); grad.addColorStop(0.55, '#5d5450'); grad.addColorStop(1, '#2f2a2a');
			g.lineWidth = 16; g.lineJoin = 'round'; g.strokeStyle = 'rgba(10,14,24,.85)'; g.stroke();
			g.lineWidth = 10; g.strokeStyle = color; g.stroke();
			g.fillStyle = grad; g.fill();
			g.fillStyle = 'rgba(20,16,18,.45)';
			[[48, 52, 11], [78, 66, 8], [62, 86, 6], [80, 44, 5]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 6.2832); g.fill(); });
		});
	}

	function draw() {
		var ctx = K.begin(st), top = hullTop(), sy = shieldY(), n, m, r, x, list, h, held, need, ok, k, sr = (portrait ? 150 : 190) * u, lift = 0, tilt = 0, since = resultAt >= 0 ? clock - resultAt : 0, ty = (portrait ? 150 : 104) * u, per = portrait ? 4 : 5;
		if (resultAt >= 0) { if (safe) lift = -K.ease(since / 2.5) * 60 * u; else { lift = K.ease(since / 3) * 46 * u; tilt = K.ease(since / 3) * 0.03; } }
		// Meteors, each trailing fire in its lane's colour.
		for (n = 0; n < rocks.length; n++) {
			r = rocks[n]; k = 46 * u;
			K.glow(ctx, r.x, r.y - k * 2.6, k * 1.1, LANES[r.lane].color, 0.4, true); K.glow(ctx, r.x, r.y - k * 1.3, k * 1.5, LANES[r.lane].color, 0.6, true);
			ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot); ctx.drawImage(meteor(LANES[r.lane].color), -k, -k, k * 2, k * 2); ctx.restore();
		}
		ctx.save();
		ctx.translate(st.W / 2, top + lift); ctx.rotate(tilt); ctx.translate(-st.W / 2, -top);
		if (hurt > 0 || (resultAt >= 0 && !safe)) K.glow(ctx, st.W / 2, top + 80 * u, st.W * 0.5, '#ff3b3b', Math.max(hurt, resultAt >= 0 && !safe ? 0.5 + Math.sin(clock * 9) * 0.2 : 0) * 0.6, true);
		if (resultAt >= 0 && safe) for (n = 0; n < 3; n++) K.glow(ctx, laneX(n), top + 230 * u, 150 * u, '#8ce3ff', 0.7 + Math.sin(clock * 22 + n) * 0.2, true);
		ctx.drawImage(ship, 0, top - 34 * u, st.W, 230 * u);
		for (n = 0; n < 3; n++) {
			x = laneX(n); list = lanes[n]; held = snap.held[n]; need = snap.threats[n]; ok = held >= need;
			// The shield: an arc of light that thickens with every chatter holding it.
			if (resultAt < 0 || safe) {
				k = Math.min(1, held / Math.max(1, need));
				K.glow(ctx, x, sy + 40 * u, sr * (0.9 + flash[n] * 0.5), LANES[n].color, 0.12 + k * 0.3 + flash[n] * 0.5, true);
				ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, sy + sr * 0.82, sr, 3.1416 * 1.2, 3.1416 * 1.8);
				ctx.lineWidth = (6 + Math.min(held, 8) * 2.4 + flash[n] * 10) * u; ctx.strokeStyle = LANES[n].color; ctx.globalAlpha = held ? 0.95 : 0.3; ctx.stroke();
				ctx.lineWidth = 3 * u; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = held ? 0.8 : 0.2; ctx.stroke(); ctx.globalAlpha = 1;
			}
			for (m = 0; m < list.length && m < per * 2; m++) {
				h = list[m];
				K.face(ctx, h.face, h.x, h.y + Math.sin(clock * 4 + m) * 3 * u, 28 * u);
				if (clock - h.at < 3.5) K.label(ctx, K.short(h.face.name, 10), h.x, h.y - 44 * u, 20 * u, '#ffffff');
			}
			if (list.length > per * 2) K.text(ctx, '+' + (list.length - per * 2), x + (per / 2 + 0.4) * 62 * u, top - 44 * u, 30 * u, LANES[n].color);
			// On the hull under each lane: shields held against meteors coming, and the words that hold one.
			if (snap.phase !== 'result') {
				K.text(ctx, held + ' / ' + need, x, top + 56 * u, 46 * u, !need ? '#aab4cc' : ok ? '#8ce99a' : '#ff8787');
				K.hint(ctx, LANES[n].cmd, x, top + 122 * u, (portrait ? 24 : 30) * u);
			}
		}
		// Hull strength: six cells along the keel.
		for (n = 0; n < 6; n++) {
			x = st.W / 2 + (n - 2.5) * 54 * u;
			K.rr(ctx, x - 21 * u, top + 168 * u, 42 * u, 16 * u, 8 * u); ctx.fillStyle = n < Math.round(shownHull) ? (snap.hull <= 2 ? '#ff6b6b' : '#69db7c') : 'rgba(8,10,20,.8)'; ctx.fill();
			ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
		}
		ctx.restore();
		// Top centre: time left in this wave, and which of the six waves it is.
		if (snap.phase === 'active') {
			ctx.beginPath(); ctx.arc(st.W / 2, ty, 62 * u, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
			K.ring(ctx, st.W / 2, ty, 62 * u, snap.share, snap.left <= 3 ? '#ff6b6b' : '#ffffff', 9 * u);
			K.text(ctx, String(snap.left), st.W / 2, ty + 2 * u, 50 * u, snap.left <= 3 ? '#ff8787' : '#ffffff');
			for (n = 0; n < 6; n++) { ctx.beginPath(); ctx.arc(st.W / 2 + (n - 2.5) * 30 * u, ty + 92 * u, (n + 1 === snap.wave ? 10 : 7) * u, 0, 6.2832); ctx.fillStyle = n + 1 < snap.wave ? '#69db7c' : n + 1 === snap.wave ? '#ffffff' : 'rgba(255,255,255,.28)'; ctx.fill(); }
		} else if (snap.phase === 'waiting') K.bubble(ctx, st.W / 2, ty + 90 * u, u, clock);
		if (resultAt >= 0 && safe) K.crown(ctx, st.W / 2, top - 250 * u + lift + Math.sin(clock * 4) * 8 * u, 90 * u * K.back(since / 0.5));
		K.fx.draw(ctx);
	}

	window.SSNShieldScene = { state: function () { return { phase: snap.phase, wave: snap.wave, hull: snap.hull, held: snap.held.slice(), threats: snap.threats.slice(), meteors: rocks.filter(function (r) { return !r.gone; }).length, blasts: blasts, safe: resultAt >= 0 ? safe : null }; } };
	K.loop(update, draw);
})();
