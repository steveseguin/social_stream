// Winners' Podium: the stream's top chatters across every game, counted in the stars the games award (see season.js).
// An end-of-show scene: the top three stand on the podium with their faces and the runners-up line up below. !stars shows a chatter their own total.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1, clock = 0, portrait = false;
	var top = Math.round(K.num('top', 8, 3, 12)), rows = [], steps = null, me = null, leader = '', cheer = 0, cheerNext = 0, demoList = [];
	var STEP = [{ h: 330, r: 112, c: ['#fff3b0', '#ffd43b', '#b9860e'] }, { h: 250, r: 90, c: ['#f4f6fc', '#c3cbdd', '#7d879e'] }, { h: 190, r: 82, c: ['#ffd8a8', '#e8964a', '#99541b'] }];
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	function baseY() { return st.H * (portrait ? 0.56 : 0.72); }
	function stepX(n) { return st.W / 2 + (n === 1 ? -1 : n === 2 ? 1 : 0) * 300 * u; }
	function target(n, count) {
		var per, row, col, inRow, cw = 250 * u, r;
		if (n < 3) { r = STEP[n].r * u; return { x: stepX(n), y: baseY() - STEP[n].h * u - r * 0.9, r: r }; }
		per = Math.max(1, Math.min(portrait ? 4 : 9, Math.floor((st.W - 40 * u) / cw)));
		row = Math.floor((n - 3) / per); col = (n - 3) % per; inRow = Math.min(per, count - 3 - row * per);
		return { x: st.W / 2 + (col - (inRow - 1) / 2) * cw - 78 * u, y: baseY() + 84 * u + row * 96 * u, r: 34 * u };
	}
	// The three blocks are painted once per window size.
	function paintSteps() {
		var w = 290 * u, pad = 20 * u, x0 = st.W / 2 - 450 * u - pad, y0 = baseY() - 330 * u - pad;
		steps = { x: x0, y: y0, w: 900 * u + pad * 2, h: 330 * u + pad * 2 + 30 * u, img: null };
		steps.img = K.layer(steps.w * st.dpr, steps.h * st.dpr, function (g) {
			var n, s, x, y, h, grad;
			g.scale(st.dpr, st.dpr); g.translate(-x0, -y0);
			for (n = 0; n < 3; n++) {
				s = STEP[n]; h = s.h * u; x = stepX(n) - w / 2; y = baseY() - h;
				grad = g.createLinearGradient(0, y, 0, y + h); grad.addColorStop(0, s.c[1]); grad.addColorStop(1, s.c[2]);
				K.rr(g, x, y, w, h + 24 * u, 18 * u); g.fillStyle = grad; g.fill();
				K.rr(g, x, y, w, 26 * u, 13 * u); g.fillStyle = s.c[0]; g.fill();
				g.save(); K.rr(g, x, y, w, h + 24 * u, 18 * u); g.clip();
				grad = g.createLinearGradient(x, 0, x + w, 0); grad.addColorStop(0, 'rgba(255,255,255,.22)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,20,.25)');
				g.fillStyle = grad; g.fillRect(x, y, w, h + 24 * u);
				g.restore();
				K.rr(g, x, y, w, h + 24 * u, 18 * u); g.lineWidth = 4 * u; g.strokeStyle = 'rgba(10,14,24,.8)'; g.stroke();
				g.font = K.font(120 * u, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(10,14,24,.22)'; g.fillText(String(n + 1), stepX(n), y + h * 0.56);
			}
		});
	}
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; portrait = st.H > st.W; paintSteps(); };
	st.onresize();

	function refresh() {
		var list = K.demo ? demoList.slice().sort(function (a, b) { return b.stars - a.stars; }).slice(0, top) : window.SSNSeason ? window.SSNSeason.list(top) : [], next = [], n, m, e, row;
		for (n = 0; n < list.length; n++) {
			e = list[n]; row = null;
			for (m = 0; m < rows.length; m++) if (rows[m].key === e.key) row = rows[m];
			if (!row) row = { key: e.key, p: null, stars: 0, shown: 0, x: st.W / 2, y: st.H + 200 * u, r: 30 * u, bump: 0 };
			row.p = K.player(e.key, e.name, e.img);
			if (e.stars > row.stars && row.stars) row.bump = 1;
			row.stars = e.stars; row.rank = n;
			next.push(row);
		}
		rows = next;
		if (rows.length && rows[0].key !== leader) { if (leader) cheer = clock + 4; leader = rows[0].key; }
	}
	if (window.SSNSeason) window.SSNSeason.onchange(refresh);

	K.onChat(function (msg) {
		var list, n, found = null;
		if (msg.cmd !== 'stars' && msg.cmd !== 'rank') return;
		list = K.demo ? demoList.slice().sort(function (a, b) { return b.stars - a.stars; }) : window.SSNSeason ? window.SSNSeason.list(400) : [];
		for (n = 0; n < list.length; n++) if (list[n].key === msg.player.key) found = { stars: list[n].stars, rank: n + 1 };
		me = { p: msg.player, stars: found ? found.stars : 0, rank: found ? found.rank : 0, at: clock };
	});

	function update(dt) {
		var n, row, t;
		clock += dt;
		for (n = 0; n < rows.length; n++) {
			row = rows[n]; t = target(row.rank, rows.length);
			row.x = K.approach(row.x, t.x, 5, dt); row.y = K.approach(row.y, t.y, 5, dt); row.r = K.approach(row.r, t.r, 6, dt);
			row.shown = K.approach(row.shown, row.stars, 6, dt);
			if (row.bump > 0) row.bump = Math.max(0, row.bump - dt * 2.5);
		}
		if (me && clock - me.at > 6) me = null;
		// A steady drift of confetti while there are winners to show, and a burst when the lead changes hands.
		if (rows.length && clock > cheerNext) {
			cheerNext = clock + (clock < cheer ? 0.25 : 1.3);
			K.fx.burst(K.rand(0.15, 0.85) * st.W, baseY() - K.rand(520, 760) * u, null, clock < cheer ? 22 : 8, 380 * u);
		}
		K.fx.update(dt);
	}

	function beam() {
		return K.sprite('podiumbeam', 256, 512, function (g) {
			var grad = g.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, 'rgba(255,244,214,.55)'); grad.addColorStop(1, 'rgba(255,244,214,0)');
			g.beginPath(); g.moveTo(108, 0); g.lineTo(148, 0); g.lineTo(256, 512); g.lineTo(0, 512); g.closePath(); g.fillStyle = grad; g.fill();
		});
	}
	function stars(ctx, count, x, y, size, align) {
		var text = String(Math.round(count)), w;
		ctx.font = K.font(size); w = ctx.measureText(text).width + size * 1.2;
		if (align === 'center') x -= w / 2;
		K.star(ctx, x + size * 0.48, y, size * 0.5, '#ffd43b', 0);
		K.text(ctx, text, x + size * 1.15, y + size * 0.04, size, '#fff', 'left');
	}

	function draw() {
		var ctx = K.begin(st), n, row, bob, r, w, y, by = baseY();
		// Stage lights from above (dropped on a struggling computer: they are the costliest thing here).
		ctx.globalCompositeOperation = 'lighter';
		for (n = 0; n < 3 && K.q > 0.75; n++) {
			ctx.save(); ctx.translate(st.W / 2 + (n - 1) * 300 * u, by - 1010 * u); ctx.rotate(Math.sin(clock * 0.5 + n * 2.1) * 0.12 + (1 - n) * 0.05);
			ctx.globalAlpha = rows.length > n ? 0.3 : 0.12; ctx.drawImage(beam(), -230 * u, 0, 460 * u, 1000 * u); ctx.restore();
		}
		ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
		K.shadow(ctx, st.W / 2, by + 26 * u, 520 * u, 46 * u, 0.5);
		ctx.drawImage(steps.img, steps.x, steps.y, steps.w, steps.h);
		for (n = rows.length - 1; n >= 0; n--) {
			row = rows[n]; r = row.r * (1 + row.bump * 0.12);
			if (row.rank < 3) {
				bob = Math.sin(clock * 2.2 + row.rank * 1.7) * 5 * u;
				K.glow(ctx, row.x, row.y + bob, r * 1.7, STEP[row.rank].c[1], 0.35, true);
				K.bigFace(ctx, row.p, row.x, row.y + bob, r);
				if (row.rank === 0) K.crown(ctx, row.x, row.y + bob - r * 0.9, r * 0.42);
				K.label(ctx, K.short(row.p.name, 13), row.x, by - STEP[row.rank].h * u + 54 * u, (row.rank ? 34 : 40) * u, '#ffffff');
				stars(ctx, row.shown, row.x, by - STEP[row.rank].h * u + 112 * u, (row.rank ? 36 : 44) * u, 'center');
			} else {
				w = 236 * u; y = row.y;
				K.panel(ctx, row.x - 44 * u, y - 40 * u, w, 80 * u, 40 * u);
				K.face(ctx, row.p, row.x, y, r);
				K.label(ctx, K.short(row.p.name, 9), row.x + 44 * u, y - 15 * u, 22 * u, '#dfe6f5', 'left');
				stars(ctx, row.shown, row.x + 44 * u, y + 17 * u, 24 * u, 'left');
			}
		}
		if (!rows.length) {
			for (n = 0; n < 3; n++) K.star(ctx, stepX(n), by - STEP[n].h * u - 70 * u + Math.sin(clock * 2 + n) * 8 * u, (n ? 34 : 44) * u, 'rgba(255,212,59,.75)', Math.sin(clock + n) * 0.3);
			K.bubble(ctx, st.W / 2, by + 150 * u, u, clock);
		}
		// !stars: the chatter's own face, total and place.
		if (me) {
			n = K.back((clock - me.at) / 0.35) * K.clamp((6 - (clock - me.at)) / 0.4, 0, 1);
			w = 470 * u * n; y = st.H - 110 * u;
			ctx.globalAlpha = Math.min(1, n);
			K.panel(ctx, st.W / 2 - w / 2, y - 62 * u * n, w, 124 * u * n, 62 * u * n);
			if (n > 0.6) {
				K.bigFace(ctx, me.p, st.W / 2 - 170 * u, y, 52 * u);
				K.label(ctx, K.short(me.p.name, 12), st.W / 2 - 100 * u, y - 24 * u, 30 * u, '#ffffff', 'left');
				stars(ctx, me.stars, st.W / 2 - 100 * u, y + 24 * u, 34 * u, 'left');
				if (me.rank) K.text(ctx, '#' + me.rank, st.W / 2 + 200 * u, y, 50 * u, '#ffe066', 'right');
			}
			ctx.globalAlpha = 1;
		}
		K.fx.draw(ctx);
	}

	if (K.demo) {
		K.names.slice(0, 12).forEach(function (name, n) { demoList.push({ key: 'demo:' + name.toLowerCase(), name: name, img: '', stars: Math.round(64 - n * 4.6 + Math.random() * 6) }); });
		K.every(function () { var e = K.pick(demoList); e.stars += K.pick([1, 2, 3, 5]); refresh(); }, 900, 2200);
		K.every(function () { if (clock > 5) K.say(K.pick(K.names.slice(0, 12)), '!stars'); }, 9000, 12000);
	}
	refresh();
	window.SSNPodium = { state: function () { return { rows: rows.map(function (r) { return { name: r.p.name, stars: r.stars }; }), showing: me ? me.p.name : null, showingStars: me ? me.stars : 0, showingRank: me ? me.rank : 0 }; } };
	K.loop(update, draw);
	K.start();
})();
