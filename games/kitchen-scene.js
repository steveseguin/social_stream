// Crew Kitchen, drawn: chat cooks four orders together by tossing each recipe's three ingredients into the pot.
// The rules live in teamplay-engine.js and chat arrives through audience-page.js; this file only draws what the engine reports.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1, portrait = false, clock = 0;
	var DISH = { 'Midnight pizza': '\uD83C\uDF55', 'Picnic sandwich': '\uD83E\uDD6A', 'Pancake party': '\uD83E\uDD5E', 'Cozy soup': '\uD83C\uDF72' };
	var faces = {}, byName = {}, snap = { phase: 'waiting', served: 0, stock: [0, 0, 0], icons: ['', '', ''], words: ['', '', ''], dish: '', left: 0, share: 1, round: 0 };
	var chefs = [null, null, null], tosses = [], plates = [], flying = null, flipAt = -9, potPulse = 0, resultAt = -1, done = false, awarded = 0, adds = 0, counter = null;
	document.body.classList.add('ssn-scene');

	function stationX(n) { return st.W * (portrait ? [0.18, 0.5, 0.82] : [0.2, 0.5, 0.8])[n]; }
	function counterY() { return st.H * (portrait ? 0.74 : 0.7); }
	function potX() { return st.W / 2; }
	function potY() { return st.H * (portrait ? 0.43 : 0.33); }
	function plateX(n) { return st.W / 2 + (n - 1.5) * (portrait ? 150 : 170) * u; }
	function plateY() { return (portrait ? 250 : 96) * u; }
	function paintCounter() {
		var w = st.W, h = 280 * u;
		counter = K.layer(w * st.dpr, h * st.dpr, function (g) {
			var grad, x;
			g.scale(st.dpr, st.dpr);
			grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#c98d55'); grad.addColorStop(0.12, '#a86f3d'); grad.addColorStop(1, 'rgba(92,56,28,0)');
			K.rr(g, 24 * u, 0, w - 48 * u, h + 60 * u, 34 * u); g.fillStyle = grad; g.fill();
			g.fillStyle = '#e6b27a'; K.rr(g, 24 * u, 0, w - 48 * u, 20 * u, 10 * u); g.fill();
			g.fillStyle = 'rgba(60,34,14,.18)';
			for (x = 60 * u; x < w - 60 * u; x += 150 * u) g.fillRect(x, 26 * u, 3 * u, h);
		});
	}
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; portrait = st.H > st.W; paintCounter(); };
	st.onresize();

	function engineKey(m) { return String(m.type) + ':' + String(m.userid || m.username || m.chatname); }
	window.SSNScene = {
		chat: function (m) {
			if (!m || !m.type || !m.chatname) return;
			var key = engineKey(m), face = K.player(key.toLowerCase(), String(m.chatname).slice(0, 24), m.chatimg);
			faces[key] = face; byName[String(m.chatname).slice(0, 48)] = face;
		},
		sync: function (game, now) {
			var recipe = game.recipe(), n, who = game.history[0] ? byName[game.history[0].name] : null, ranked;
			if (game.round !== snap.round) { plates = []; tosses = []; chefs = [null, null, null]; flying = null; resultAt = -1; }
			else {
				// An order went out: the pot gives up a finished dish, and the next recipe's ingredients turn up.
				if (game.served > snap.served) { flying = { icon: snap.dish, t: 0, to: snap.served }; flipAt = clock; potPulse = 1; K.shake(st, 6 * u); }
				for (n = 0; n < 3; n++) if (game.stock[n] > snap.stock[n] || (game.served > snap.served && snap.stock[n] < 2)) {
					adds++;
					tosses.push({ icon: snap.icons[n], from: n, t: 0 });
					if (who) chefs[n] = { face: who, at: clock };
				}
			}
			snap = { phase: game.phase, served: game.served, stock: game.stock.slice(), icons: recipe.icons.slice(), words: recipe.ingredients.slice(), dish: DISH[recipe.name] || '\uD83C\uDF7D\uFE0F', left: game.phase === 'active' ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : 0, share: game.phase === 'active' ? K.clamp((game.deadline - now) / (game.seconds * 1000), 0, 1) : 1, round: game.round };
			if (snap.phase === 'result' && resultAt < 0) {
				resultAt = clock; done = game.served >= 4;
				if (done && awarded !== game.round) {
					awarded = game.round; ranked = [];
					game.users.forEach(function (player, key) { ranked.push({ face: faces[key] || K.player(key.toLowerCase(), player.name), count: player.count }); });
					ranked.sort(function (a, b) { return b.count - a.count; });
					K.awardRound(ranked.slice(0, 3).map(function (r) { return r.face; }), ranked.map(function (r) { return r.face; }));
				}
			}
		},
		// A livelier demo than the page's own: a full crew, each adding whatever the order still needs.
		demo: function (receive, game) {
			var names = K.names.slice(0, 18), turn = 0;
			setInterval(function () { if (game.phase !== 'result') receive({ type: 'demo', chatname: names[turn++ % names.length], chatmessage: game.previewCommand(), textonly: true }); }, 700);
		}
	};

	function update(dt) {
		var n, t;
		clock += dt;
		if (potPulse > 0) potPulse = Math.max(0, potPulse - dt * 1.8);
		for (n = tosses.length - 1; n >= 0; n--) { t = tosses[n]; t.t += dt * 1.9; if (t.t >= 1) { K.fx.spark(potX(), potY() - 30 * u, '#fff3b0', 8, 240 * u, 5 * u, 0.4); potPulse = Math.max(potPulse, 0.5); tosses.splice(n, 1); } }
		if (flying) { flying.t += dt * 1.1; if (flying.t >= 1) { plates[flying.to] = flying.icon; K.fx.burst(plateX(flying.to), plateY(), '#ffd43b', 18, 380 * u); flying = null; } }
		if (resultAt >= 0 && done && clock - resultAt < 8 && Math.random() < dt * 6) K.fx.burst(K.rand(0.1, 0.9) * st.W, K.rand(0.08, 0.5) * st.H, null, 14, 460 * u);
		K.fx.update(dt);
	}

	function emoji(ch) {
		return K.sprite('kitchenicon:' + ch, 200, 200, function (g) { g.font = '140px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 100, 110); });
	}
	// A tall white hat for whoever is cooking at a station.
	function hat(ctx, x, y, r) {
		ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.lineWidth = Math.max(2, r * 0.09); ctx.lineJoin = 'round';
		ctx.beginPath(); ctx.arc(x - r * 0.42, y - r * 1.2, r * 0.42, 0, 6.2832); ctx.arc(x + r * 0.42, y - r * 1.2, r * 0.42, 0, 6.2832); ctx.arc(x, y - r * 1.42, r * 0.5, 0, 6.2832); ctx.fill();
		K.rr(ctx, x - r * 0.62, y - r * 1.16, r * 1.24, r * 0.5, r * 0.1); ctx.fill(); ctx.stroke();
	}

	function draw() {
		var ctx = K.begin(st), cy = counterY(), px = potX(), py = potY(), n, m, x, y, k, e, t, c, flip, r = (portrait ? 84 : 96) * u, pr = (portrait ? 150 : 170) * u, since = resultAt >= 0 ? clock - resultAt : 0, tx = portrait ? st.W / 2 : st.W * 0.1, ty = (portrait ? 110 : 110) * u;
		// The four plates along the top fill as orders go out.
		for (n = 0; n < 4; n++) {
			x = plateX(n); y = plateY();
			K.shadow(ctx, x, y + 46 * u, 62 * u, 12 * u, 0.4);
			ctx.beginPath(); ctx.arc(x, y, 58 * u, 0, 6.2832); ctx.fillStyle = plates[n] ? '#fffdf5' : 'rgba(255,253,245,.22)'; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = 'rgba(10,14,24,.75)'; ctx.stroke();
			ctx.beginPath(); ctx.arc(x, y, 42 * u, 0, 6.2832); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(10,14,24,.18)'; ctx.stroke();
			if (plates[n]) ctx.drawImage(emoji(plates[n]), x - 44 * u, y - 46 * u, 88 * u, 88 * u);
		}
		// The pot: a glow underneath, steam above, and a lid that lifts when something lands in it.
		K.glow(ctx, px, py + pr * 0.62, pr * 1.1, '#ff7b3b', 0.5 + Math.sin(clock * 9) * 0.1, true);
		K.shadow(ctx, px, py + pr * 0.74, pr * 1.05, pr * 0.16, 0.5);
		for (n = 0; n < 3; n++) { e = (clock * 0.5 + n / 3) % 1; ctx.globalAlpha = (1 - e) * 0.3; ctx.beginPath(); ctx.arc(px + Math.sin(clock * 2 + n * 2) * 30 * u + (n - 1) * 50 * u, py - pr * 0.55 - e * 150 * u, (26 + e * 30) * u, 0, 6.2832); ctx.fillStyle = '#ffffff'; ctx.fill(); }
		ctx.globalAlpha = 1;
		k = 1 + potPulse * 0.06;
		ctx.save(); ctx.translate(px, py); ctx.scale(k, 2 - k);
		K.rr(ctx, -pr, -pr * 0.42, pr * 2, pr * 1.1, pr * 0.3); ctx.fillStyle = '#39445c'; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(10,14,24,.9)'; ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,.12)'; K.rr(ctx, -pr * 0.86, -pr * 0.3, pr * 0.2, pr * 0.82, pr * 0.1); ctx.fill();
		K.rr(ctx, -pr * 1.1, -pr * 0.52, pr * 2.2, pr * 0.2, pr * 0.1); ctx.fillStyle = '#566282'; ctx.fill(); ctx.stroke();
		K.rr(ctx, -pr * 1.34, -pr * 0.24, pr * 0.34, pr * 0.16, pr * 0.08); ctx.fill(); ctx.stroke(); K.rr(ctx, pr * 1.0, -pr * 0.24, pr * 0.34, pr * 0.16, pr * 0.08); ctx.fill(); ctx.stroke();
		ctx.restore();
		// What this order makes, shown on the pot.
		if (snap.dish && resultAt < 0) { ctx.globalAlpha = 0.92; ctx.drawImage(emoji(snap.dish), px - pr * 0.4, py - pr * 0.2, pr * 0.8, pr * 0.8); ctx.globalAlpha = 1; }
		ctx.drawImage(counter, 0, cy, st.W, 280 * u);
		// Each ingredient on the counter, how many of the two it still needs, and the words that add one.
		flip = K.clamp((clock - flipAt) / 0.4, 0, 1);
		for (n = 0; n < 3; n++) {
			x = stationX(n); y = cy - r * 0.78;
			K.shadow(ctx, x, cy + 8 * u, r * 0.9, r * 0.16, 0.45);
			ctx.save(); ctx.translate(x, y + Math.sin(clock * 2.4 + n * 2) * 4 * u); ctx.scale(Math.abs(Math.cos(flip * 3.1416)) * 0.999 + 0.001, 1);
			if (snap.icons[n]) ctx.drawImage(emoji(snap.icons[n]), -r, -r, r * 2, r * 2);
			ctx.restore();
			for (m = 0; m < 2; m++) {
				ctx.beginPath(); ctx.arc(x + (m - 0.5) * 46 * u, y - r - 26 * u, 17 * u, 0, 6.2832);
				ctx.fillStyle = snap.stock[n] > m ? '#69db7c' : 'rgba(12,16,28,.85)'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = snap.stock[n] > m ? '#ffffff' : 'rgba(255,255,255,.35)'; ctx.stroke();
			}
			if (snap.phase !== 'result' && snap.words[n]) K.hint(ctx, '!cook ' + snap.words[n], x, cy + 74 * u, (portrait ? 24 : 32) * u);
			c = chefs[n];
			if (c && clock - c.at < 5) {
				e = K.back((clock - c.at) / 0.3) * K.clamp((5 - (clock - c.at)) / 0.4, 0, 1); k = 36 * u * e;
				x += r * 0.95; y = cy - 44 * u - Math.abs(Math.sin((clock - c.at) * 6)) * 10 * u * K.clamp(1 - (clock - c.at), 0, 1);
				K.face(ctx, c.face, x, y, k); hat(ctx, x, y, k);
				if (e > 0.8) K.label(ctx, K.short(c.face.name, 10), x, cy + 16 * u, 21 * u, '#ffffff');
			}
		}
		// Ingredients in the air on their way to the pot, and a finished dish on its way to a plate.
		for (n = 0; n < tosses.length; n++) {
			t = tosses[n]; e = K.ease(t.t); x = K.lerp(stationX(t.from), px, e); y = K.lerp(cy - r, py - pr * 0.5, e) - Math.sin(e * 3.1416) * 220 * u; k = 56 * u * (1 - e * 0.35);
			ctx.save(); ctx.translate(x, y); ctx.rotate(t.t * 6); ctx.drawImage(emoji(t.icon), -k, -k, k * 2, k * 2); ctx.restore();
		}
		if (flying) {
			e = K.ease(flying.t); x = K.lerp(px, plateX(flying.to), e); y = K.lerp(py - pr * 0.4, plateY(), e) - Math.sin(e * 3.1416) * 120 * u; k = K.lerp(96, 46, e) * u;
			K.glow(ctx, x, y, k * 1.9, '#ffd43b', 0.6, true);
			ctx.drawImage(emoji(flying.icon), x - k, y - k, k * 2, k * 2);
		}
		if (snap.phase === 'active') {
			ctx.beginPath(); ctx.arc(tx, ty, 62 * u, 0, 6.2832); ctx.fillStyle = 'rgba(12,16,28,.9)'; ctx.fill();
			K.ring(ctx, tx, ty, 62 * u, snap.share, snap.left <= 10 ? '#ff6b6b' : '#ffffff', 9 * u);
			K.text(ctx, String(snap.left), tx, ty + 2 * u, 46 * u, snap.left <= 10 ? '#ff8787' : '#ffffff');
		} else if (snap.phase === 'waiting') K.bubble(ctx, px + pr * 1.5, py - pr * 0.3, 0.9 * u, clock);
		if (resultAt >= 0 && done) K.crown(ctx, px, py - pr * 0.9 + Math.sin(clock * 4) * 8 * u, 84 * u * K.back(since / 0.5));
		K.fx.draw(ctx);
	}

	window.SSNKitchenScene = { state: function () { return { phase: snap.phase, served: snap.served, stock: snap.stock.slice(), plates: plates.filter(Boolean).length, adds: adds, cooks: chefs.filter(function (c) { return c && clock - c.at < 5; }).length }; } };
	K.loop(update, draw);
})();
