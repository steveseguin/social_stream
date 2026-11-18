// Tower Duel: chat is split into two teams, one on each side of the screen. Every message drops a crate from that
// team's crane; first tower to reach the flag wins. The middle stays empty so a 9:16 video can sit between the towers.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage();
	var goal = Math.round(K.num('goal', 12, 5, 30)), gapOpt = K.num('gap', -1, 0, 0.8), backing = K.num('panel', 0.45, 0, 1);
	var command = K.word('command', '').replace(/^!/, '');
	var TEAM = [{ color: '#ff6b6b', dark: '#b8413f', light: '#ff9a94' }, { color: '#38c6c6', dark: '#1f8c8c', light: '#7fe0de' }];
	var u = 1, railW = 1, bh = 1, bw = 1, baseY = 0, craneY = 0, clock = 0, joined = 0, over = null;
	var rails = [0, 1].map(function (i) { return { i: i, cx: 0, blocks: [], phase: i * 1.7, wins: 0, reload: 0, crew: [], hello: null, tag: null, size: 0 }; });
	var team = {}, teamCount = 0, last = {}, lastCount = 0, falling = [];
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	st.onresize = function () {
		var gap = gapOpt >= 0 ? st.W * gapOpt : st.portrait ? 0 : Math.min(st.H * 9 / 16, st.W * 0.5);
		u = Math.min(st.W, st.H) / 1080;
		railW = (st.W - gap) / 2;
		baseY = st.H - 104 * u; craneY = 150 * u;
		bh = (baseY - craneY - 84 * u) / (goal + 1.15);
		bw = Math.min(railW * 0.4, bh * 2.4);
		rails[0].cx = railW / 2; rails[1].cx = st.W - railW / 2;
	};
	st.onresize();

	// Offsets are kept in crate widths from the middle of the rail, so a resize keeps every tower intact.
	function topOff(r) { return r.blocks.length ? r.blocks[r.blocks.length - 1].off : 0; }
	function craneOff(r) {
		var t = (r.phase / 2) % 2, tri = t < 1 ? t * 2 - 1 : 3 - t * 2, limit = Math.max(0.2, (railW / 2 - bw * 0.56) / bw);
		return K.clamp(topOff(r) * 0.6 + tri * 1.05, -limit, limit);
	}
	function join(p) {
		var t = team[p.key];
		if (t !== undefined) return rails[t];
		if (teamCount > 4000) { team = {}; teamCount = 0; rails[0].size = rails[1].size = 0; }
		t = rails[0].size === rails[1].size ? joined % 2 : rails[0].size < rails[1].size ? 0 : 1;
		team[p.key] = t; teamCount++; joined++; rails[t].size++;
		rails[t].hello = { p: p, t: 0 };
		return rails[t];
	}

	K.onChat(function (msg) {
		var p = msg.player, r;
		if (command && msg.cmd !== command) return;
		r = join(p);
		if (r.crew.indexOf(p) >= 0) r.crew.splice(r.crew.indexOf(p), 1);
		r.crew.push(p); if (r.crew.length > 8) r.crew.shift();
		if (over || r.reload > 0) return;
		if (last[p.key] !== undefined && clock - last[p.key] < 1.2) return;
		if (lastCount > 4000) { last = {}; lastCount = 0; }
		if (last[p.key] === undefined) lastCount++;
		last[p.key] = clock;
		falling.push({ r: r, p: p, off: craneOff(r), y: craneY + 44 * u + bh / 2, vy: 0, vx: 0, rot: 0, vr: 0, miss: false });
		r.reload = 0.4;
	});

	function finish(winner) {
		var loser = rails[1 - winner.i], n, b;
		winner.wins++;
		over = { winner: winner, until: clock + 6.5, next: 0 };
		for (n = 0; n < loser.blocks.length; n++) {
			b = loser.blocks[n];
			falling.push({ r: loser, p: b.p, off: b.off, y: baseY - (n + 0.5) * bh, vy: K.rand(-500, -100) * u, vx: K.rand(-1.6, 1.6), rot: 0, vr: K.rand(-5, 5), miss: true });
		}
		loser.blocks = [];
	}
	function update(dt) {
		var n, f, r, landY, d;
		clock += dt;
		for (n = 0; n < 2; n++) {
			r = rails[n];
			r.phase += dt * (1.5 + Math.min(r.blocks.length, 20) * 0.05);
			if (r.reload > 0) r.reload -= dt;
			if (r.hello) { r.hello.t += dt; if (r.hello.t > 2.2) r.hello = null; }
			if (r.tag) { r.tag.t += dt; if (r.tag.t > 1.6) r.tag = null; }
		}
		for (n = falling.length - 1; n >= 0; n--) {
			f = falling[n]; r = f.r;
			f.vy += 2600 * u * dt; f.y += f.vy * dt;
			if (f.miss) {
				f.off += f.vx * dt; f.rot += f.vr * dt;
				if (f.y > st.H + bh * 2) falling.splice(n, 1);
				continue;
			}
			landY = baseY - r.blocks.length * bh - bh / 2;
			if (f.y < landY) continue;
			d = f.off - topOff(r);
			if (over || Math.abs(d) > 0.6) {
				// Too far off the crate below: it slides off the side.
				f.miss = true; f.vx = (d > 0 ? 1 : -1) * 1.5; f.vr = (d > 0 ? 1 : -1) * 4; f.vy = -260 * u;
				continue;
			}
			if (Math.abs(d) < 0.07) { f.off = topOff(r); K.fx.burst(r.cx + f.off * bw, landY + bh / 2, '#ffe066', 12, 330 * u); }
			r.blocks.push({ p: f.p, off: f.off, at: clock });
			r.tag = { p: f.p, t: 0, row: r.blocks.length };
			falling.splice(n, 1);
			if (r.blocks.length >= goal && !over) finish(r);
		}
		if (over) {
			if (clock > over.next) { over.next = clock + 0.35; K.fx.burst(over.winner.cx + K.rand(-0.4, 0.4) * railW, K.rand(0.15, 0.6) * st.H, null, 24, 560 * u); }
			if (clock > over.until) { over = null; rails[0].blocks = []; rails[1].blocks = []; falling = []; }
		}
		K.fx.update(dt);
	}

	function crate(ctx, x, y, t, p, rot) {
		var rad = Math.min(16 * u, bh * 0.24);
		ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
		K.rr(ctx, -bw / 2, -bh / 2, bw, bh, rad); ctx.fillStyle = t.color; ctx.fill();
		K.rr(ctx, -bw / 2 + 5 * u, -bh / 2 + 5 * u, bw - 10 * u, bh * 0.34, rad * 0.7); ctx.fillStyle = t.light; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
		K.rr(ctx, -bw / 2, -bh / 2, bw, bh, rad); ctx.lineWidth = Math.max(2, 4 * u); ctx.strokeStyle = t.dark; ctx.stroke();
		if (p) K.face(ctx, p, 0, 0, bh * 0.39);
		ctx.restore();
	}
	function star(ctx, x, y, r, fill) {
		var n, a;
		ctx.beginPath();
		for (n = 0; n < 10; n++) { a = -1.5708 + n * 0.62832; ctx.lineTo(x + Math.cos(a) * (n % 2 ? r * 0.45 : r), y + Math.sin(a) * (n % 2 ? r * 0.45 : r)); }
		ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = 'rgba(10,14,24,.8)'; ctx.stroke();
	}
	function drawRail(ctx, r) {
		var t = TEAM[r.i], x0 = r.i ? st.W - railW : 0, n, b, x, y, c, flagY = baseY - goal * bh, sway, w, a;
		if (backing > 0) {
			ctx.fillStyle = 'rgba(12,16,28,' + backing + ')';
			ctx.fillRect(x0, 0, railW, st.H);
		}
		// Finish line and flag
		ctx.setLineDash([16 * u, 14 * u]); ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(255,255,255,.6)';
		ctx.beginPath(); ctx.moveTo(x0 + 24 * u, flagY); ctx.lineTo(x0 + railW - 24 * u, flagY); ctx.stroke(); ctx.setLineDash([]);
		x = r.i ? x0 + railW - 54 * u : x0 + 54 * u;
		ctx.lineWidth = 7 * u; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, flagY + 4 * u); ctx.lineTo(x, flagY - 74 * u); ctx.stroke();
		sway = Math.sin(clock * 4 + r.i) * 5 * u;
		ctx.beginPath(); ctx.moveTo(x, flagY - 74 * u); ctx.lineTo(x + (r.i ? -62 : 62) * u, flagY - 54 * u + sway); ctx.lineTo(x, flagY - 34 * u); ctx.closePath(); ctx.fillStyle = t.color; ctx.fill();
		// Ground
		K.rr(ctx, r.cx - bw * 0.9, baseY, bw * 1.8, 18 * u, 9 * u); ctx.fillStyle = '#e8edf7'; ctx.fill();
		// Tower
		for (n = 0; n < r.blocks.length; n++) {
			b = r.blocks[n]; a = K.clamp((clock - b.at) * 6, 0, 1);
			crate(ctx, r.cx + b.off * bw, baseY - (n + 0.5) * bh + (1 - a) * -8 * u * Math.sin(a * 3.14), t, b.p, 0);
		}
		// Crane: rail, trolley, cable and the next crate
		c = r.cx + craneOff(r) * bw;
		K.rr(ctx, x0 + 30 * u, craneY - 6 * u, railW - 60 * u, 12 * u, 6 * u); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
		ctx.lineWidth = 5 * u; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(c, craneY); ctx.lineTo(c, craneY + 46 * u); ctx.stroke();
		K.rr(ctx, c - 46 * u, craneY - 20 * u, 92 * u, 40 * u, 16 * u); ctx.fillStyle = '#fff'; ctx.fill();
		ctx.beginPath(); ctx.arc(c, craneY, 9 * u, 0, 6.2832); ctx.fillStyle = t.color; ctx.fill();
		if (r.reload <= 0 && !over) crate(ctx, c, craneY + 44 * u + bh / 2, t, null, 0);
		if (!r.blocks.length && !r.size && !over) K.bubble(ctx, r.cx, baseY - 26 * u, u * 0.9, clock + r.i);
		// Round wins
		for (n = 0; n < Math.min(r.wins, 5); n++) star(ctx, r.i ? x0 + railW - (44 + n * 52) * u : x0 + (44 + n * 52) * u, 44 * u, 22 * u, '#ffd43b');
		if (r.wins > 5) K.text(ctx, String(r.wins), r.i ? x0 + railW - 330 * u : x0 + 330 * u, 46 * u, 40 * u, '#ffe066');
		// Newest team member
		if (r.hello) {
			a = Math.min(1, r.hello.t * 4) * K.clamp((2.2 - r.hello.t) * 3, 0, 1);
			ctx.font = K.font(32 * u); w = ctx.measureText(K.short(r.hello.p.name, 12)).width + 120 * u; y = 96 * u + (1 - Math.min(1, r.hello.t * 4)) * -30 * u;
			ctx.globalAlpha = a;
			K.rr(ctx, r.cx - w / 2, y - 36 * u, w, 72 * u, 36 * u); ctx.fillStyle = t.color; ctx.fill();
			K.face(ctx, r.hello.p, r.cx - w / 2 + 36 * u, y, 30 * u);
			K.text(ctx, K.short(r.hello.p.name, 12), r.cx + 26 * u, y + 2 * u, 32 * u);
			ctx.globalAlpha = 1;
		}
		// Who placed the last crate
		if (r.tag && r.tag.row <= r.blocks.length) {
			ctx.globalAlpha = K.clamp((1.6 - r.tag.t) * 2.5, 0, 1);
			K.text(ctx, K.short(r.tag.p.name, 12), r.cx + topOff(r) * bw, baseY - r.tag.row * bh - 26 * u - r.tag.t * 14 * u, 30 * u);
			ctx.globalAlpha = 1;
		}
		// Recent team mates along the bottom
		for (n = 0; n < r.crew.length; n++) K.face(ctx, r.crew[n], r.cx + (n - (r.crew.length - 1) / 2) * 62 * u, st.H - 52 * u, 27 * u);
	}
	function draw() {
		var ctx = K.begin(st), n, f;
		drawRail(ctx, rails[0]); drawRail(ctx, rails[1]);
		for (n = 0; n < falling.length; n++) { f = falling[n]; crate(ctx, f.r.cx + f.off * bw, f.y, TEAM[f.r.i], f.p, f.rot); }
		if (over) star(ctx, over.winner.cx, st.H * 0.36, (110 + Math.sin(clock * 6) * 10) * u * K.ease((6.5 - (over.until - clock)) * 3), '#ffd43b');
		K.fx.draw(ctx);
	}

	if (K.demo) K.every(function () { K.say(K.pick(K.names), command ? '!' + command : 'go'); }, 150, 700);
	window.SSNTowerDuel = { state: function () { return { teams: [rails[0].size, rails[1].size], blocks: [rails[0].blocks.length, rails[1].blocks.length], wins: [rails[0].wins, rails[1].wins], falling: falling.length, over: !!over }; } };
	K.loop(function (dt) { update(dt); draw(); });
	K.start();
})();
