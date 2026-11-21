// Tug of War, drawn: two teams of chatters, each with their own face, haul a rope across a mud pit.
// The rules live in tug-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1, cs = 1, portrait = false, clock = 0;
	var TEAM = [{ color: '#ff7b7b', dark: '#b84a52' }, { color: '#5fe0c5', dark: '#2f9d88' }];
	var faces = K.recentFaces(), people = {}, order = [[], []], snap = { phase: 'waiting', position: 0, goal: 20, pulls: [0, 0], prompt: '', promptLeft: 0, left: 0, round: 0, count: [0, 0] };
	var shown = 0, promptAt = 0, lastPrompt = '', resultAt = -1, awarded = 0, heaves = 0, wobble = 0, ground = null;
	document.body.classList.add('ssn-scene');

	function cap() { return portrait ? 4 : 6; }
	function groundY() { return st.H * (portrait ? 0.66 : 0.76); }
	function range() { return portrait ? st.W * 0.12 : Math.min(st.W * 0.16, 320 * u); }
	function spacing() { var gap0 = 150 * cs; return K.clamp((st.W / 2 - range() - gap0 - 50 * u) / (cap() - 1), 58 * cs, 122 * cs); }
	function paintGround() {
		var w = st.W, h = 150 * u;
		ground = K.layer(w * st.dpr, h * st.dpr, function (g) {
			var grad, cx = w / 2, n;
			g.scale(st.dpr, st.dpr);
			grad = g.createLinearGradient(0, 22 * u, 0, h); grad.addColorStop(0, '#4fa56f'); grad.addColorStop(0.5, '#34805a'); grad.addColorStop(1, 'rgba(34,96,70,0)');
			K.rr(g, 24 * u, 22 * u, w - 48 * u, h, 40 * u); g.fillStyle = grad; g.fill();
			g.fillStyle = 'rgba(255,255,255,.14)'; K.rr(g, 44 * u, 26 * u, w - 88 * u, 8 * u, 4 * u); g.fill();
			// The mud pit in the middle and the two lines a team must drag the flag past.
			grad = g.createRadialGradient(cx, 56 * u, 10 * u, cx, 56 * u, 150 * u); grad.addColorStop(0, '#5a3d27'); grad.addColorStop(0.75, '#7b5636'); grad.addColorStop(1, '#8c6642');
			g.beginPath(); g.ellipse(cx, 58 * u, Math.min(150 * u, range() * 0.8), 30 * u, 0, 0, 6.2832); g.fillStyle = grad; g.fill();
			g.lineWidth = 3 * u; g.strokeStyle = 'rgba(40,22,10,.5)'; g.stroke();
			for (n = 0; n < 2; n++) { g.fillStyle = TEAM[n].color; K.rr(g, cx + (n ? 1 : -1) * range() - 5 * u, 18 * u, 10 * u, 64 * u, 5 * u); g.fill(); g.lineWidth = 2 * u; g.strokeStyle = 'rgba(10,14,24,.7)'; g.stroke(); }
		});
	}
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; portrait = st.H > st.W; cs = (portrait ? 0.74 : 1) * u; paintGround(); };
	st.onresize();

	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	function rebuild() {
		var t, list;
		order = [[], []];
		Object.keys(people).forEach(function (k) { order[people[k].team].push(people[k]); });
		// The hardest pullers stand nearest the flag.
		for (t = 0; t < 2; t++) { list = order[t]; list.sort(function (a, b) { return b.pulls - a.pulls || a.joined - b.joined; }); list.forEach(function (p, n) { p.slot = n; }); }
	}
	window.SSNScene = {
		// Remember each chatter's picture as their messages go by.
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m);
			faces.player(key, String(m.chatname).slice(0, 24), m.chatimg);
		},
		sync: function (game, now) {
			var changed = false, seen = {}, winners, all;
			if (game.round !== snap.round) { people = {}; changed = true; resultAt = -1; }
			game.users.forEach(function (user, key) {
				var p = people[key];
				seen[key] = 1;
				if (!p) {
					p = people[key] = { face: faces.get(key) || faces.player(key, user.name), team: user.team, pulls: user.pulls, joined: clock, slot: 0, x: 0, drop: 1, heave: 0, shown: clock };
					changed = true;
				}
				if (user.pulls > p.pulls) { p.heave = 1; p.shown = clock; heaves++; wobble = 1; changed = true; K.fx.pop('+1', p.x, groundY() - 190 * cs, TEAM[p.team].color, 34 * u); }
				p.pulls = user.pulls;
			});
			Object.keys(people).forEach(function (key) { if (!seen[key]) { delete people[key]; changed = true; } });
			if (changed) rebuild();
			snap = { phase: game.phase, position: game.position, goal: game.goal, pulls: game.pulls.slice(), prompt: game.phase === 'active' ? game.prompt : '', promptLeft: game.phase === 'active' ? Math.max(0, (game.promptDeadline - now) / 12000) : 0, left: game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : 0, round: game.round, count: game.teams.slice() };
			if (snap.prompt !== lastPrompt) { lastPrompt = snap.prompt; promptAt = clock; }
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock;
				if (awarded !== game.round && snap.position !== 0) {
					awarded = game.round; winners = order[snap.position < 0 ? 0 : 1]; all = order[0].concat(order[1]);
					K.awardRound(winners.slice(0, 3).map(function (p) { return p.face; }), all.map(function (p) { return p.face; }));
				}
			}
		},
		// A livelier demo than the page's own: two full teams, with Coral a little quicker so a match is decided on screen.
		demo: function (receive, game) {
			var names = K.names.slice(0, 16), joined = 0;
			function say(name, text) { receive({ type: 'demo', chatname: name, chatmessage: text, textonly: true }); }
			setInterval(function () {
				var name, user;
				if (game.phase === 'result') { joined = 0; return; }
				if (game.users.size === 0) joined = 0;
				if (joined < names.length) { say(names[joined++], '!join'); return; }
				name = K.pick(names); user = game.users.get('demo:' + name);
				if (user && game.phase === 'active' && Math.random() < (user.team === 0 ? 1 : 0.3)) say(name, game.answer);
			}, 260);
		}
	};

	function update(dt) {
		var t, n, p, list, dir, target, flag, sp = spacing(), gap0 = 150 * cs, lost;
		clock += dt;
		shown = K.approach(shown, snap.position, 6, dt);
		if (wobble > 0) wobble = Math.max(0, wobble - dt * 2.5);
		flag = st.W / 2 + shown / snap.goal * range();
		for (t = 0; t < 2; t++) {
			list = order[t]; dir = t ? 1 : -1;
			for (n = 0; n < list.length; n++) {
				p = list[n]; target = flag + dir * (gap0 + Math.min(p.slot, cap() - 1) * sp);
				p.x = p.x ? K.approach(p.x, target, 7, dt) : target;
				if (p.drop > 0) p.drop = Math.max(0, p.drop - dt * 2.2);
				if (p.heave > 0) { if (p.heave > 0.9) K.fx.spark(p.x + dir * 20 * cs, groundY(), '#d9c7a8', 5, 150 * u, 4 * u, 0.4); p.heave = Math.max(0, p.heave - dt * 2.6); }
			}
		}
		if (resultAt >= 0 && snap.position !== 0 && clock - resultAt < 8 && Math.random() < dt * 5) {
			lost = snap.position < 0 ? 1 : 0;
			K.fx.burst(st.W / 2 + (lost ? -1 : 1) * K.rand(0.1, 0.42) * st.W, groundY() - K.rand(300, 620) * u, TEAM[1 - lost].color, 14, 460 * u);
		}
		K.fx.update(dt);
	}

	function body(color) {
		return K.sprite('tugbody:' + color, 96, 96, function (g) {
			var grad;
			K.rr(g, 14, 8, 68, 80, 30); g.fillStyle = color; g.fill();
			g.save(); K.rr(g, 14, 8, 68, 80, 30); g.clip();
			grad = g.createLinearGradient(14, 0, 82, 0); grad.addColorStop(0, 'rgba(255,255,255,.28)'); grad.addColorStop(0.45, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,30,.34)');
			g.fillStyle = grad; g.fillRect(0, 0, 96, 96);
			g.restore();
			K.rr(g, 14, 8, 68, 80, 30); g.lineWidth = 5; g.strokeStyle = 'rgba(10,14,24,.85)'; g.stroke();
		});
	}
	function limb(ctx, x0, y0, x1, y1, w, color, edge) {
		ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = w + edge; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
	}
	function person(ctx, p, ropeY) {
		var t = TEAM[p.team], dir = p.team ? 1 : -1, gy = groundY(), won = resultAt >= 0 && snap.position !== 0 && (snap.position < 0 ? 0 : 1) === p.team, lost = resultAt >= 0 && snap.position !== 0 && !won;
		var since = resultAt >= 0 ? clock - resultAt : 0, lean = dir * (0.2 + p.heave * 0.22 + Math.sin(clock * 9 + p.joined) * 0.012), slide = dir * p.heave * 14 * cs, y = gy, x = p.x + slide, hop = 0, sx, sy, c, s;
		if (p.drop > 0) y -= p.drop * p.drop * 700 * u;
		if (won) { hop = Math.abs(Math.sin(since * 6 + p.slot)) * 46 * cs; lean = Math.sin(since * 6 + p.slot) * 0.12; }
		// The losers topple toward the mud.
		if (lost) { lean = -dir * Math.min(1.45, since * 3.2); x -= dir * Math.min(1, since * 1.6) * 46 * cs; }
		K.shadow(ctx, x, gy + 4 * cs, 42 * cs, 11 * cs, 0.4);
		c = Math.cos(lean); s = Math.sin(lean);
		ctx.save(); ctx.translate(x, y - hop); ctx.rotate(lean); ctx.scale(cs, cs);
		limb(ctx, -11, -24, -15 - dir * 4, -2, 11, '#2b3350', 5);
		limb(ctx, 11, -24, 15 - dir * 10, -2, 11, '#2b3350', 5);
		ctx.drawImage(body(t.color), -30, -80, 60, 60);
		K.face(ctx, p.face, 0, -104, 36);
		ctx.restore();
		// Arms reach from the shoulders to the rope (or up in the air for the winners).
		sx = x + (0 * c + 62 * cs * s); sy = y - hop - 62 * cs * c;
		if (won) { limb(ctx, sx - 22 * cs, sy, sx - 40 * cs, sy - 44 * cs, 9 * cs, t.color, 5 * cs); limb(ctx, sx + 22 * cs, sy, sx + 40 * cs, sy - 44 * cs, 9 * cs, t.color, 5 * cs); }
		else if (!lost) { limb(ctx, sx - dir * 6 * cs, sy + 4 * cs, x - dir * 46 * cs, ropeY, 9 * cs, t.color, 5 * cs); limb(ctx, sx - dir * 16 * cs, sy + 10 * cs, x - dir * 30 * cs, ropeY, 9 * cs, t.color, 5 * cs); }
		if (p.slot < 3 || clock - p.shown < 5 || clock - p.joined < 5) K.label(ctx, K.short(p.face.name, 11), x, gy + 30 * cs + (p.slot % 2) * 20 * cs, (portrait ? 23 : 20) * cs, '#ffffff');
	}

	function draw() {
		var ctx = K.begin(st), gy = groundY(), ropeY = gy - 84 * cs + Math.sin(clock * 40) * wobble * 3 * u, flag = st.W / 2 + shown / snap.goal * range(), sp = spacing(), gap0 = 150 * cs;
		var t, n, list, x0, x1, w, y, k, size, extra, sway, signY = Math.max(150 * u, gy - (portrait ? 620 : 560) * u);
		ctx.drawImage(ground, 0, gy - 40 * u, st.W, 150 * u);
		// The rope: a dark core, a tan body and lighter twists that travel as it moves.
		x0 = flag - gap0 - Math.max(0, Math.min(order[0].length, cap()) - 1) * sp - 46 * cs; x1 = flag + gap0 + Math.max(0, Math.min(order[1].length, cap()) - 1) * sp + 46 * cs;
		ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(x0, ropeY); ctx.lineTo(x1, ropeY); ctx.lineWidth = 19 * cs; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
		ctx.lineWidth = 13 * cs; ctx.strokeStyle = '#c9a26b'; ctx.stroke();
		ctx.setLineDash([9 * cs, 13 * cs]); ctx.lineDashOffset = -flag; ctx.lineWidth = 6 * cs; ctx.strokeStyle = '#ecd2a4'; ctx.stroke(); ctx.setLineDash([]);
		// The flag tied at the middle of the rope.
		sway = Math.sin(clock * 5) * 5 * cs - (snap.position - shown) * 6 * cs;
		ctx.beginPath(); ctx.moveTo(flag - 13 * cs, ropeY + 4 * cs); ctx.lineTo(flag + 13 * cs, ropeY + 4 * cs); ctx.lineTo(flag + 13 * cs + sway, ropeY + 66 * cs); ctx.lineTo(flag + sway, ropeY + 50 * cs); ctx.lineTo(flag - 13 * cs + sway, ropeY + 66 * cs); ctx.closePath();
		ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.lineWidth = 4 * cs; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
		for (t = 0; t < 2; t++) {
			list = order[t];
			for (n = Math.min(list.length, cap()) - 1; n >= 0; n--) person(ctx, list[n], ropeY);
			// Anyone past the last place on the rope is counted behind it.
			extra = list.length - cap();
			if (extra > 0) K.text(ctx, '+' + extra, flag + (t ? 1 : -1) * (gap0 + (cap() - 1) * sp + 96 * cs), ropeY - 60 * cs, 38 * cs, TEAM[t].color);
			// Each team's pulls, large, on its own side.
			size = (portrait ? 96 : 120) * u;
			K.text(ctx, String(snap.pulls[t]), st.W * (t ? 0.86 : 0.14), signY + 10 * u, size, TEAM[t].color);
		}
		if (snap.phase === 'active' && snap.prompt) {
			// The thing to type, on a board that drops in with each new prompt, and how long it stays.
			k = K.back((clock - promptAt) / 0.4);
			size = (portrait ? 84 : 104) * u;
			ctx.font = K.font(size); w = Math.max(360 * u, ctx.measureText(snap.prompt).width + 110 * u); y = signY - (1 - k) * 220 * u;
			K.shadow(ctx, st.W / 2, y + 96 * u, w * 0.5, 22 * u, 0.4);
			K.rr(ctx, st.W / 2 - w / 2, y - 76 * u, w, 152 * u, 34 * u); ctx.fillStyle = '#fff8e7'; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
			K.text(ctx, snap.prompt, st.W / 2, y - 6 * u, size, '#1b2233', 'center', false);
			K.bar(ctx, st.W / 2 - w / 2 + 34 * u, y + 46 * u, w - 68 * u, 14 * u, snap.promptLeft, snap.promptLeft < 0.25 ? '#ff6b6b' : '#4dabf7', 'rgba(27,34,51,.25)');
			K.text(ctx, Math.floor(snap.left / 60) + ':' + ('0' + snap.left % 60).slice(-2), st.W / 2, y - 118 * u, 40 * u, snap.left <= 15 ? '#ff8787' : '#ffffff');
		}
		if (snap.phase === 'waiting') {
			K.bubble(ctx, st.W / 2, signY + 20 * u, 1.1 * u, clock);
			K.hint(ctx, '!join', st.W / 2, signY + 100 * u, 54 * u);
		} else if (snap.phase === 'active') K.hint(ctx, '!join', st.W / 2, Math.min(st.H - 40 * u, gy + 120 * u), 28 * u);
		if (resultAt >= 0 && snap.position !== 0) {
			t = snap.position < 0 ? 0 : 1; k = K.back((clock - resultAt) / 0.5);
			K.glow(ctx, st.W * (t ? 0.75 : 0.25), signY + 40 * u, 300 * u * k, TEAM[t].color, 0.5, true);
			K.crown(ctx, st.W * (t ? 0.75 : 0.25), signY + 90 * u + Math.sin(clock * 4) * 8 * u, 86 * u * k);
		}
		K.fx.draw(ctx);
	}

	window.SSNTugScene = { state: function () { return { phase: snap.phase, flag: snap.position, teams: [order[0].length, order[1].length], heaves: heaves, prompt: snap.prompt }; } };
	K.loop(update, draw);
})();
