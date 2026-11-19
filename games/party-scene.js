// Rock Paper Showdown and Minority Club, drawn: three big choices, and every chatter's face gathers under the one they picked.
// The rules live in party-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), mode = document.body.dataset.game, u = 1, portrait = false, clock = 0;
	var CHOICES = {
		showdown: [{ icon: '\u270A', color: '#ff8a65', cmd: '!throw rock' }, { icon: '\u270B', color: '#4dabf7', cmd: '!throw paper' }, { icon: '\u270C\uFE0F', color: '#b197fc', cmd: '!throw scissors' }],
		minority: [{ icon: '\u2600\uFE0F', color: '#ffd43b', cmd: '!pick sun' }, { icon: '\uD83C\uDF19', color: '#91a7ff', cmd: '!pick moon' }, { icon: '\u2B50', color: '#f783ac', cmd: '!pick star' }]
	}, choices = CHOICES[mode] || CHOICES.minority;
	var faces = {}, voters = {}, groups = [[], [], []], snap = { phase: 'waiting', left: 0, share: 1, round: 0, secret: 0 }, status = [0, 0, 0], lift = [0, 0, 0], resultAt = -1, awarded = 0;
	document.body.classList.add('ssn-scene');
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; portrait = st.H > st.W; };
	st.onresize();

	function colX(n) { return st.W * (portrait ? [0.18, 0.5, 0.82] : [0.2, 0.5, 0.8])[n]; }
	function iconY() { return st.H * (portrait ? 0.38 : 0.43); }
	function iconR() { return (portrait ? 108 : 140) * u; }
	function perRow() { return portrait ? 5 : 6; }
	function rows() { return portrait ? 10 : 4; }
	function faceR() { return (portrait ? 30 : 38) * u; }
	function slot(col, n) {
		var per = perRow(), r = faceR(), gap = r * 2.2, row = Math.floor(n / per), inRow = Math.min(per, Math.min(groups[col].length, per * rows()) - row * per);
		return { x: colX(col) + ((n % per) - (inRow - 1) / 2) * gap, y: iconY() + iconR() + 150 * u + row * gap + lift[col] };
	}
	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	function judge(game) {
		var counts = groups.map(function (g) { return g.length; }), smallest, tied;
		if (mode === 'showdown') return [0, 1, 2].map(function (n) { return n === (game.secret + 1) % 3 ? 1 : n === game.secret ? 0 : -1; });
		smallest = Math.min.apply(null, counts.filter(function (n) { return n > 0; }).concat(1e9));
		tied = counts.filter(function (n) { return n === smallest; }).length;
		return counts.map(function (n) { return tied === 1 ? (n === smallest ? 1 : -1) : 0; });
	}
	window.SSNScene = {
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m);
			faces[key] = K.player(key.toLowerCase(), String(m.chatname).slice(0, 24), m.chatimg);
		},
		sync: function (game, now) {
			var changed = false, seen = {}, n, m;
			if (game.round !== snap.round) { voters = {}; changed = true; resultAt = -1; status = [0, 0, 0]; }
			game.votes.forEach(function (choice, key) {
				var v = voters[key];
				seen[key] = 1;
				if (!v) { v = voters[key] = { face: faces[key] || K.player(key.toLowerCase(), key.split(':').slice(1).join(':')), choice: choice, x: colX(choice) + K.rand(-60, 60) * u, y: -80 * u, at: clock, hop: 0 }; changed = true; }
				else if (v.choice !== choice) { v.choice = choice; v.hop = 1; v.at = clock; changed = true; }
			});
			Object.keys(voters).forEach(function (key) { if (!seen[key]) { delete voters[key]; changed = true; } });
			if (changed) {
				groups = [[], [], []];
				Object.keys(voters).forEach(function (key) { groups[voters[key].choice].push(voters[key]); });
				// Earliest in, nearest the top; a newcomer or a switcher joins the back of their group.
				for (n = 0; n < 3; n++) { groups[n].sort(function (a, b) { return a.at - b.at; }); for (m = 0; m < groups[n].length; m++) groups[n][m].n = m; }
			}
			snap = { phase: game.phase, left: game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : 0, share: game.phase === 'active' ? K.clamp((game.deadline - now) / (game.seconds * 1000), 0, 1) : 1, round: game.round, secret: game.secret };
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock; status = judge(game);
				K.shake(st, 8 * u);
				if (awarded !== game.round) {
					awarded = game.round;
					for (n = 0; n < 3; n++) if (status[n] === 1) groups[n].slice(0, 200).forEach(function (v) { K.award(v.face, 2, true); });
				}
			}
		},
		// A livelier demo than the page's own: a couple of dozen chatters choose, and a few change their minds.
		demo: function (receive, game) {
			var names = K.names, words = choices.map(function (c) { return c.cmd; });
			setInterval(function () {
				if (game.phase === 'result') return;
				receive({ type: 'demo', chatname: K.pick(names), chatmessage: words[Math.floor(Math.pow(Math.random(), 1.4) * 3)], textonly: true });
			}, 420);
		}
	};

	function update(dt) {
		var key, v, t, n, want;
		clock += dt;
		for (n = 0; n < 3; n++) { want = resultAt >= 0 ? (status[n] > 0 ? -30 : status[n] < 0 ? 22 : 0) * u : 0; lift[n] = K.approach(lift[n], want, 5, dt); }
		for (key in voters) {
			v = voters[key]; t = slot(v.choice, Math.min(v.n, perRow() * rows() - 1));
			v.x = K.approach(v.x, t.x, 7, dt); v.y = K.approach(v.y, t.y, 7, dt);
			if (v.hop > 0) v.hop = Math.max(0, v.hop - dt * 2.4);
		}
		if (resultAt >= 0 && clock - resultAt < 7 && Math.random() < dt * 4) for (n = 0; n < 3; n++) if (status[n] === 1) K.fx.burst(colX(n) + K.rand(-160, 160) * u, iconY() - K.rand(60, 260) * u, n % 2 ? '#ffd43b' : choices[n].color, 12, 420 * u);
		K.fx.update(dt);
	}

	function icon(ch) {
		return K.sprite('partyicon:' + ch, 256, 256, function (g) { g.font = '176px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 128, 140); });
	}
	function plate(color) {
		return K.sprite('partyplate:' + color, 320, 320, function (g) {
			var grad = g.createRadialGradient(130, 110, 20, 160, 160, 160); grad.addColorStop(0, '#2b3558'); grad.addColorStop(1, '#0d1122');
			g.beginPath(); g.arc(160, 160, 146, 0, 6.2832); g.fillStyle = grad; g.fill();
			g.lineWidth = 16; g.strokeStyle = color; g.stroke();
			g.beginPath(); g.arc(160, 160, 155, 3.6, 5.3); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
			g.beginPath(); g.arc(160, 160, 137, 0, 6.2832); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
		});
	}

	function draw() {
		var ctx = K.begin(st), n, m, c, x, y, r = iconR(), fr = faceR(), cap = perRow() * rows(), list, v, since = resultAt >= 0 ? clock - resultAt : 0, k, bob, a, ty = st.H * (portrait ? 0.19 : 0.13), tr = (portrait ? 92 : 88) * u, total = groups[0].length + groups[1].length + groups[2].length;
		for (n = 0; n < 3; n++) {
			c = choices[n]; x = colX(n); y = iconY() + lift[n]; list = groups[n];
			a = resultAt >= 0 && status[n] < 0 ? K.lerp(1, 0.36, K.clamp(since * 2, 0, 1)) : 1;
			ctx.globalAlpha = a;
			K.shadow(ctx, x, y + r * 1.05, r * 1.05, r * 0.2, 0.5);
			if (resultAt >= 0 && status[n] > 0) K.glow(ctx, x, y, r * 2.4, '#ffd43b', 0.55 + Math.sin(clock * 6) * 0.15, true);
			bob = Math.sin(clock * 2 + n * 2.1) * 5 * u;
			ctx.drawImage(plate(c.color), x - r * 1.1, y - r * 1.1 + bob, r * 2.2, r * 2.2);
			ctx.drawImage(icon(c.icon), x - r * 0.8, y - r * 0.8 + bob, r * 1.6, r * 1.6);
			if (resultAt >= 0 && status[n] > 0) K.crown(ctx, x, y - r * 1.06 + bob, r * 0.42 * K.back(since / 0.5));
			// How many chose it, the words to type, then the faces themselves.
			if (list.length) {
				ctx.beginPath(); ctx.arc(x + r * 0.92, y - r * 0.82, 40 * u, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.92)'; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = c.color; ctx.stroke();
				K.text(ctx, String(list.length), x + r * 0.92, y - r * 0.8, (list.length > 99 ? 30 : 42) * u, '#fff', 'center', false);
			}
			if (resultAt < 0) K.hint(ctx, c.cmd, x, y + r + 66 * u, (portrait ? 25 : 36) * u);
			for (m = 0; m < list.length && m < cap; m++) {
				v = list[m]; k = v.hop > 0 ? Math.sin((1 - v.hop) * 3.1416) * 70 * u : 0;
				if (resultAt >= 0 && status[n] > 0) k += Math.abs(Math.sin(since * 7 + m)) * 16 * u;
				K.shadow(ctx, v.x, v.y + fr * 0.95, fr * 0.9, fr * 0.24, 0.35);
				K.face(ctx, v.face, v.x, v.y - k, fr);
				if (clock - v.at < 3.5 && resultAt < 0) K.label(ctx, K.short(v.face.name, 10), v.x, v.y - k - fr - 15 * u, 21 * u, '#ffffff');
			}
			if (list.length > cap) K.text(ctx, '+' + (list.length - cap), x, slot(n, cap - 1).y + fr * 2.4, 34 * u, c.color);
			ctx.globalAlpha = 1;
		}
		// Top centre: the clock, and in the showdown the house's hand, hidden behind a blur of all three until time is up.
		if (mode === 'showdown' || resultAt < 0) {
			K.shadow(ctx, st.W / 2, ty + tr * 1.25, tr, tr * 0.2, 0.4);
			ctx.beginPath(); ctx.arc(st.W / 2, ty, tr, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
		}
		if (resultAt < 0) K.ring(ctx, st.W / 2, ty, tr, snap.share, snap.left <= 5 && snap.phase === 'active' ? '#ff6b6b' : '#ffffff', 11 * u);
		if (mode === 'showdown') {
			if (resultAt >= 0) { k = K.back(since / 0.35); ctx.drawImage(icon(choices[snap.secret].icon), st.W / 2 - tr * 0.82 * k, ty - tr * 0.82 * k, tr * 1.64 * k, tr * 1.64 * k); }
			else if (snap.phase === 'active') { ctx.globalAlpha = 0.85; ctx.drawImage(icon(choices[Math.floor(clock * 9) % 3].icon), st.W / 2 - tr * 0.62, ty - tr * 0.62 + Math.sin(clock * 18) * 6 * u, tr * 1.24, tr * 1.24); ctx.globalAlpha = 1; }
			if (snap.phase === 'active') K.text(ctx, String(snap.left), st.W / 2 + tr * 1.5, ty, 54 * u, snap.left <= 5 ? '#ff8787' : '#ffffff', 'left');
		} else if (snap.phase === 'active') K.text(ctx, String(snap.left), st.W / 2, ty + 2 * u, 62 * u, snap.left <= 5 ? '#ff8787' : '#ffffff');
		if (snap.phase === 'waiting' && !total) K.bubble(ctx, st.W / 2 + tr * 1.7, ty + tr * 0.9, 0.8 * u, clock);
		K.fx.draw(ctx);
	}

	window.SSNPartyScene = { state: function () { return { mode: mode, phase: snap.phase, groups: groups.map(function (g) { return g.length; }), status: status.slice(), left: snap.left }; } };
	K.loop(update, draw);
})();
