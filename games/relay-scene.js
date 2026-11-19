// Beacon Relay, drawn: chat carries a flame up a mountain path, one lantern per pass, to light the beacon at the top.
// The rules live in teamplay-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1, portrait = false, clock = 0, STEPS = 20;
	var faces = {}, keepers = [], runner = null, snap = { phase: 'waiting', steps: 0, left: 0, share: 1, round: 0, last: '' }, shownLit = 0, resultAt = -1, lit = false, awarded = 0, backdrop = null, pts = [];
	document.body.classList.add('ssn-scene');

	// The path: twenty lanterns from the bottom to the beacon. It climbs left to right in a wide window and zigzags up a tall one.
	function point(t) {
		if (portrait) return { x: st.W / 2 + Math.sin(t * 3.1416 * 3.1) * st.W * 0.3, y: st.H * 0.88 - t * st.H * 0.58 };
		return { x: st.W * (0.09 + t * 0.76), y: st.H * 0.86 - t * st.H * 0.46 + Math.sin(t * 3.1416 * 3) * st.H * 0.055 };
	}
	function paint() {
		var n;
		pts = [];
		for (n = 0; n <= STEPS; n++) pts.push(point(n / STEPS));
		backdrop = K.layer(st.W * st.dpr, st.H * st.dpr, function (g) {
			var grad, x, p, top = pts[STEPS];
			g.scale(st.dpr, st.dpr);
			// Two soft ridges behind the path, see-through so the stream shows beyond them.
			[[0.34, 'rgba(38,52,86,.5)', 0.9], [0.2, 'rgba(24,34,60,.62)', 1.6]].forEach(function (ridge, i) {
				g.beginPath(); g.moveTo(0, st.H);
				for (x = 0; x <= st.W; x += st.W / 60) g.lineTo(x, st.H * (1 - ridge[0]) - Math.sin(x / st.W * 3.1416 * ridge[2] + i) * st.H * 0.12 - Math.sin(x / st.W * 17 + i * 3) * st.H * 0.02 - (portrait ? 0 : x / st.W * st.H * 0.2));
				g.lineTo(st.W, st.H); g.closePath();
				grad = g.createLinearGradient(0, st.H * 0.3, 0, st.H); grad.addColorStop(0, ridge[1]); grad.addColorStop(1, 'rgba(12,16,30,0)');
				g.fillStyle = grad; g.fill();
			});
			// The trail itself.
			g.lineCap = 'round'; g.lineJoin = 'round';
			g.beginPath(); for (x = 0; x <= 200; x++) { p = point(x / 200); g.lineTo(p.x, p.y + 30 * u); }
			g.lineWidth = 26 * u; g.strokeStyle = 'rgba(10,14,24,.55)'; g.stroke();
			g.lineWidth = 16 * u; g.strokeStyle = 'rgba(214,196,160,.5)'; g.stroke();
			// The beacon tower at the end of it.
			g.fillStyle = '#39445c'; g.strokeStyle = 'rgba(10,14,24,.9)'; g.lineWidth = 4 * u;
			g.beginPath(); g.moveTo(top.x - 34 * u, top.y + 30 * u); g.lineTo(top.x - 22 * u, top.y - 96 * u); g.lineTo(top.x + 22 * u, top.y - 96 * u); g.lineTo(top.x + 34 * u, top.y + 30 * u); g.closePath(); g.fill(); g.stroke();
			K.rr(g, top.x - 44 * u, top.y - 112 * u, 88 * u, 20 * u, 6 * u); g.fill(); g.stroke();
		});
	}
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; portrait = st.H > st.W; paint(); };
	st.onresize();

	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	window.SSNScene = {
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m);
			faces[key] = K.player(key.toLowerCase(), String(m.chatname).slice(0, 24), m.chatimg);
		},
		sync: function (game, now) {
			var n, face, ranked;
			if (game.round !== snap.round) { keepers = []; runner = null; resultAt = -1; shownLit = 0; }
			// Each new step is one chatter carrying the flame from the last lantern to the next.
			for (n = Math.max(snap.round === game.round ? snap.steps : 0, keepers.length); n < game.steps; n++) {
				face = n === game.steps - 1 && game.lastPlayer ? faces[game.lastPlayer] || K.player(game.lastPlayer.toLowerCase(), game.lastPlayer.split(':').slice(1).join(':')) : null;
				keepers.push({ face: face, at: clock });
				if (face) runner = { face: face, from: n, t: 0 };
			}
			snap = { phase: game.phase, steps: game.steps, left: game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : 0, share: game.phase === 'active' ? K.clamp((game.deadline - now) / (game.seconds * 1000), 0, 1) : 1, round: game.round, last: game.lastPlayer || '' };
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock; lit = game.steps >= STEPS;
				if (lit && awarded !== game.round) {
					awarded = game.round; ranked = [];
					game.users.forEach(function (player, key) { ranked.push({ face: faces[key] || K.player(key.toLowerCase(), player.name), count: player.count }); });
					ranked.sort(function (a, b) { return b.count - a.count; });
					K.awardRound(ranked.slice(0, 3).map(function (r) { return r.face; }), ranked.map(function (r) { return r.face; }));
				}
			}
		},
		// A livelier demo than the page's own: a dozen chatters handing the flame along.
		demo: function (receive, game) {
			var names = K.names.slice(0, 12);
			setInterval(function () { if (game.phase !== 'result') receive({ type: 'demo', chatname: K.pick(names), chatmessage: '!pass', textonly: true }); }, 520);
		}
	};

	function update(dt) {
		clock += dt;
		shownLit = K.approach(shownLit, snap.steps, 9, dt);
		if (runner) { runner.t += dt * 2.4; if (runner.t >= 1) { K.fx.spark(pts[runner.from + 1].x, pts[runner.from + 1].y - 40 * u, '#ffb347', 14, 300 * u, 5 * u, 0.5); runner = null; } }
		if (resultAt >= 0 && lit && clock - resultAt < 8 && Math.random() < dt * 6) K.fx.burst(pts[STEPS].x + K.rand(-380, 380) * u, pts[STEPS].y - K.rand(140, 520) * u, K.pick(['#ffd43b', '#ffb347', '#fff3b0']), 16, 480 * u);
		K.fx.update(dt);
	}

	function lantern(ctx, p, on, pulse) {
		var s = u;
		ctx.fillStyle = 'rgba(10,14,24,.9)'; ctx.fillRect(p.x - 3 * s, p.y - 34 * s, 6 * s, 64 * s);
		if (on) K.glow(ctx, p.x, p.y - 46 * s, (62 + pulse * 10) * s, '#ffb347', 0.75, true);
		K.rr(ctx, p.x - 13 * s, p.y - 62 * s, 26 * s, 32 * s, 7 * s); ctx.fillStyle = on ? '#ffe9a8' : '#2a334a'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(10,14,24,.9)'; ctx.stroke();
		if (on) { ctx.beginPath(); ctx.ellipse(p.x, p.y - 44 * s, 5 * s, (9 + pulse * 2) * s, 0, 0, 6.2832); ctx.fillStyle = '#ff9f1a'; ctx.fill(); }
	}

	function draw() {
		var ctx = K.begin(st), n, p, q, k, e, x, y, top = pts[STEPS], since = resultAt >= 0 ? clock - resultAt : 0, done = snap.steps, fail = resultAt >= 0 && !lit, front, tx = portrait ? st.W / 2 : st.W * 0.14, ty = (portrait ? 130 : 120) * u, glow;
		ctx.drawImage(backdrop, 0, 0, st.W, st.H);
		for (n = 0; n < STEPS; n++) {
			p = pts[n + 1];
			if (n === STEPS - 1) continue;
			lantern(ctx, p, n < done && !(runner && runner.from === n) && !fail, Math.sin(clock * 7 + n));
		}
		// The beacon: dark until the last pass, then the brightest thing on screen.
		glow = lit ? K.back(since / 0.6) : 0;
		if (glow > 0) {
			K.glow(ctx, top.x, top.y - 130 * u, 420 * u * glow, '#ffb347', 0.8, true);
			K.glow(ctx, top.x, top.y - 130 * u, 170 * u * glow, '#fff3b0', 1, true);
			for (n = 0; n < 8; n++) { e = clock * 0.5 + n * 0.7854; ctx.beginPath(); ctx.moveTo(top.x + Math.cos(e) * 90 * u, top.y - 130 * u + Math.sin(e) * 90 * u); ctx.lineTo(top.x + Math.cos(e) * 300 * u * glow, top.y - 130 * u + Math.sin(e) * 300 * u * glow); ctx.lineWidth = 9 * u; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,220,130,.5)'; ctx.stroke(); }
		}
		ctx.beginPath(); ctx.arc(top.x, top.y - 130 * u, 30 * u, 0, 6.2832); ctx.fillStyle = lit ? '#fff3b0' : '#2a334a'; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = 'rgba(10,14,24,.9)'; ctx.stroke();
		// Whoever lit each lantern stays beside it.
		for (n = 0; n < keepers.length && n < STEPS; n++) {
			k = keepers[n]; p = pts[n + 1];
			if (!k.face || (runner && runner.from === n)) continue;
			e = K.back((clock - k.at - 0.4) / 0.3);
			if (e <= 0) continue;
			ctx.globalAlpha = fail ? 0.4 : 1;
			K.face(ctx, k.face, p.x + 34 * u, p.y - 2 * u + Math.sin(clock * 3 + n) * 2 * u, 25 * u * e);
			if (n >= done - 2 && !fail) K.label(ctx, K.short(k.face.name, 10), p.x + 34 * u, p.y + 40 * u, 20 * u, '#ffffff');
			ctx.globalAlpha = 1;
		}
		// The flame on its way to the next lantern, in its carrier's hands.
		if (runner) {
			p = pts[runner.from]; q = pts[runner.from + 1]; e = K.ease(runner.t);
			x = K.lerp(p.x, q.x, e); y = K.lerp(p.y, q.y, e) - Math.sin(e * 3.1416) * 70 * u;
			K.glow(ctx, x, y - 20 * u, 90 * u, '#ffb347', 0.9, true);
			K.face(ctx, runner.face, x, y - 16 * u, 34 * u);
		}
		// Where the flame is waiting: the next lantern asks to be lit.
		if (snap.phase !== 'result' && done < STEPS && !runner) {
			front = pts[done + 1];
			K.bubble(ctx, front.x, front.y - 74 * u, 0.62 * u, clock);
		}
		if (snap.phase === 'active') {
			ctx.beginPath(); ctx.arc(tx, ty, 62 * u, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
			K.ring(ctx, tx, ty, 62 * u, snap.share, snap.left <= 10 ? '#ff6b6b' : '#ffffff', 9 * u);
			K.text(ctx, String(snap.left), tx, ty + 2 * u, 46 * u, snap.left <= 10 ? '#ff8787' : '#ffffff');
		}
		if (snap.phase !== 'result') {
			K.text(ctx, Math.round(shownLit) + ' / ' + STEPS, tx + (snap.phase === 'active' ? 150 * u : 0), ty, 54 * u, '#ffe066', snap.phase === 'active' ? 'left' : 'center');
			K.hint(ctx, '!pass', portrait ? st.W / 2 : st.W * 0.14, ty + 120 * u, 44 * u);
		}
		if (lit) K.crown(ctx, top.x, top.y - 230 * u + Math.sin(clock * 4) * 6 * u, 60 * u * K.back(since / 0.5));
		K.fx.draw(ctx);
	}

	window.SSNRelayScene = { state: function () { return { phase: snap.phase, steps: snap.steps, keepers: keepers.filter(function (k) { return k.face; }).length, running: !!runner, lit: resultAt >= 0 ? lit : null }; } };
	K.loop(update, draw);
})();
