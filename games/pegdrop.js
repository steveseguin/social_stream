// Peg Drop: chat types !drop, their ball falls from the moving chute through the pegs into a scoring slot.
// Built for portrait (9:16). In a wide window the board keeps its shape; place it with &align=left|center|right.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage({ w: 720, h: 1280 });
	var DW = 720, DH = 1280, L = 30, R = 690, SLOTS = 7, SW = (R - L) / SLOTS;
	var VALUES = [10, 30, 5, 100, 5, 30, 10], TILE = { 100: '#ff6b6b', 30: '#4dabf7', 10: '#38d9a9', 5: '#66728f' };
	var PEG_R = 9, BALL_R = 26, TOP = 330, ROW = 62, ROWS = 11, WALL_TOP = 1020, FLOOR = 1190, RAIL = 215;
	var roundSecs = K.num('round', 180, 0, 3600), command = K.word('command', 'drop').replace(/^!/, '');
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	var pegs = [], r, i;
	for (r = 0; r < ROWS; r++) {
		// Even rows sit on the slot dividers, odd rows over the slot centres. The outer lanes stay open so nothing can wedge on a wall.
		if (r % 2 === 0) for (i = 1; i < SLOTS; i++) pegs.push({ x: L + SW * i, y: TOP + r * ROW, hit: 0 });
		else for (i = 1; i < SLOTS - 1; i++) pegs.push({ x: L + SW * (i + 0.5), y: TOP + r * ROW, hit: 0 });
	}
	for (i = 1; i < SLOTS; i++) pegs.push({ x: L + SW * i, y: WALL_TOP, hit: 0, cap: true });

	var balls = [], scores = {}, top = [], flash = [0, 0, 0, 0, 0, 0, 0];
	var gold = 1, goldAt = 0, roundEnd = 0, cheer = null, clock = 0, chuteX = DW / 2, chuteV = 0;

	function rank() {
		top = Object.keys(scores).map(function (k) { return scores[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
	}
	function land(b) {
		var value = VALUES[b.slot] * (b.slot === gold ? 3 : 1), s = scores[b.p.key] || (scores[b.p.key] = { p: b.p, total: 0 });
		s.total += value;
		b.done = 1;
		flash[b.slot] = 1;
		K.fx.pop('+' + value, b.x, FLOOR - 90, value >= 90 ? '#ffe066' : '#fff', value >= 90 ? 58 : 42);
		if (value >= 90) { K.fx.burst(b.x, FLOOR - 60, null, 26, 520); K.fx.spark(b.x, FLOOR - 40, '#ffd43b', 22, 480, 6, 0.6); K.shake(st, 7); }
		rank();
	}
	function stepBall(b, dt) {
		var n, p, dx, dy, d2, d, min = BALL_R + PEG_R, nx, ny, vn, left, right;
		b.vy += 1500 * dt;
		b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vx * dt / BALL_R;
		if (b.x < L + BALL_R) { b.x = L + BALL_R; b.vx = Math.abs(b.vx) * 0.5; }
		if (b.x > R - BALL_R) { b.x = R - BALL_R; b.vx = -Math.abs(b.vx) * 0.5; }
		for (n = 0; n < pegs.length; n++) {
			p = pegs[n]; dy = b.y - p.y;
			if (dy > 40 || dy < -40) continue;
			dx = b.x - p.x; d2 = dx * dx + dy * dy;
			if (d2 >= min * min) continue;
			d = Math.sqrt(d2) || 0.01; nx = dx / d; ny = dy / d;
			b.x = p.x + nx * min; b.y = p.y + ny * min;
			vn = b.vx * nx + b.vy * ny;
			if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; b.vx += K.rand(-45, 45); if (p.hit < 0.3 && vn < -260) K.fx.spark(p.x, p.y, '#ffe9b0', 4, 200, 4, 0.3); p.hit = 1; }
		}
		if (b.y > WALL_TOP) {
			if (b.slot < 0) b.slot = K.clamp(Math.floor((b.x - L) / SW), 0, SLOTS - 1);
			left = L + b.slot * SW + BALL_R + 5; right = L + (b.slot + 1) * SW - BALL_R - 5;
			if (b.x < left) { b.x = left; b.vx = Math.abs(b.vx) * 0.3; }
			if (b.x > right) { b.x = right; b.vx = -Math.abs(b.vx) * 0.3; }
		}
		if (b.y > FLOOR - BALL_R) { b.y = FLOOR - BALL_R; land(b); }
	}

	K.onChat(function (msg) {
		if (msg.cmd !== command || cheer) return;
		if (balls.length >= 40) return;
		for (var n = 0; n < balls.length; n++) if (balls[n].p === msg.player && !balls[n].done) return;
		if (!roundEnd && roundSecs) roundEnd = Date.now() + roundSecs * 1000;
		balls.push({ p: msg.player, x: chuteX, y: RAIL + 50, vx: chuteV * 0.12, vy: 0, slot: -1, done: 0, rot: 0 });
	});

	function update(dt) {
		var n, b, sub;
		clock += dt;
		var px = chuteX; chuteX = DW / 2 + Math.sin(clock * 0.85) * 255; chuteV = dt ? (chuteX - px) / dt : 0;
		if (clock > goldAt) { goldAt = clock + 20; do { n = Math.floor(Math.random() * SLOTS); } while (n === gold || n === 3); gold = n; }
		for (n = balls.length - 1; n >= 0; n--) {
			b = balls[n];
			if (b.done) { b.done += dt * 1.6; if (b.done > 2) balls.splice(n, 1); continue; }
			for (sub = 0; sub < 3 && !b.done; sub++) stepBall(b, dt / 3);
		}
		for (n = 0; n < pegs.length; n++) if (pegs[n].hit > 0) pegs[n].hit = Math.max(0, pegs[n].hit - dt * 4);
		for (n = 0; n < SLOTS; n++) if (flash[n] > 0) flash[n] = Math.max(0, flash[n] - dt * 2.5);
		if (roundEnd && !cheer && Date.now() >= roundEnd) {
			roundEnd = 0;
			if (top.length) { cheer = { s: top[0], until: clock + 7, next: 0 }; K.awardRound(top.map(function (s) { return s.p; }), Object.keys(scores).map(function (k) { return scores[k].p; })); } else { scores = {}; top = []; }
		}
		if (cheer) {
			if (clock > cheer.next) { cheer.next = clock + 0.45; K.fx.burst(K.rand(160, 560), K.rand(360, 640), null, 22, 520); }
			if (clock > cheer.until) { cheer = null; scores = {}; top = []; balls = []; }
		}
		K.fx.update(dt);
	}

	function draw() {
		var ctx = K.begin(st), n, p, b, x, value, isGold, a;
		K.top3(ctx, top, L, 40, R - L);
		// Board
		K.panel(ctx, L, 150, R - L, 1100, 40, 'rgba(14,19,33,.8)');
		if (roundEnd) {
			a = K.clamp((roundEnd - Date.now()) / (roundSecs * 1000), 0, 1);
			K.rr(ctx, L + 40, 168, R - L - 80, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
			K.rr(ctx, L + 40, 168, (R - L - 80) * a, 8, 4); ctx.fillStyle = a < 0.15 ? '#ff6b6b' : '#fff'; ctx.fill();
		}
		// Chute on its rail
		K.rr(ctx, L + 50, RAIL - 5, R - L - 100, 10, 5); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
		ctx.beginPath(); ctx.moveTo(chuteX - 34, RAIL + 12); ctx.lineTo(chuteX + 34, RAIL + 12); ctx.lineTo(chuteX + 20, RAIL + 44); ctx.lineTo(chuteX - 20, RAIL + 44); ctx.closePath(); ctx.fillStyle = '#c9d3ea'; ctx.fill();
		K.rr(ctx, chuteX - 52, RAIL - 24, 104, 44, 20); ctx.fillStyle = '#fff'; ctx.fill();
		ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(chuteX, RAIL - 2, 9, 0, 6.2832); ctx.fill();
		// Slots
		for (n = 0; n < SLOTS; n++) {
			isGold = n === gold; value = VALUES[n] * (isGold ? 3 : 1); x = L + n * SW;
			K.rr(ctx, x + 7, WALL_TOP + 22, SW - 14, FLOOR - WALL_TOP - 22, 16);
			ctx.fillStyle = isGold ? '#ffd43b' : TILE[VALUES[n]]; ctx.globalAlpha = 0.5 + flash[n] * 0.5 + (isGold ? 0.35 + Math.sin(clock * 5) * 0.12 : 0); ctx.fill(); ctx.globalAlpha = 1;
			K.text(ctx, String(value), x + SW / 2, FLOOR - 44, value >= 100 ? 36 : 40, isGold ? '#fff7cc' : '#fff');
		}
		for (n = 1; n < SLOTS; n++) { K.rr(ctx, L + n * SW - 5, WALL_TOP, 10, FLOOR - WALL_TOP + 4, 5); ctx.fillStyle = '#c9d3ea'; ctx.fill(); }
		// Pegs
		for (n = 0; n < pegs.length; n++) {
			p = pegs[n]; if (p.cap) continue;
			if (p.hit > 0.05) K.glow(ctx, p.x, p.y, 16 + p.hit * 30, '#ffe066', p.hit, true);
			ctx.beginPath(); ctx.arc(p.x, p.y, PEG_R + p.hit * 5, 0, 6.2832); ctx.fillStyle = p.hit > 0.05 ? '#ffe066' : '#dfe6f5'; ctx.fill();
			K.gloss(ctx, p.x, p.y, PEG_R + p.hit * 5);
		}
		// Balls
		for (n = 0; n < balls.length; n++) {
			b = balls[n];
			if (b.done) { ctx.globalAlpha = K.clamp(2 - b.done, 0, 1); }
			K.ball(ctx, b.p, b.x, b.y, BALL_R, b.rot);
			ctx.globalAlpha = 1;
		}
		K.hint(ctx, '!' + command, DW / 2, 1238, 30);
		if (cheer) {
			K.rr(ctx, L, 150, R - L, 1100, 40); ctx.fillStyle = 'rgba(8,10,20,.66)'; ctx.fill();
			a = K.ease((7 - (cheer.until - clock)) * 2.5);
			K.face(ctx, cheer.s.p, DW / 2, 600, 150 * a);
			K.crown(ctx, DW / 2, 600 - 150 * a + 8, 60 * a);
			K.text(ctx, K.short(cheer.s.p.name, 16), DW / 2, 810, 58);
			K.text(ctx, String(cheer.s.total), DW / 2, 900, 84, '#ffe066');
		}
		K.fx.draw(ctx);
	}

	if (K.demo) K.every(function () { K.say(K.pick(K.names), '!' + command); }, 500, 1500);
	window.SSNPegDrop = { state: function () { var totals = {}; Object.keys(scores).forEach(function (k) { totals[scores[k].p.name] = scores[k].total; }); return { balls: balls.filter(function (b) { return !b.done; }).length, totals: totals, cheering: !!cheer }; } };
	K.loop(update, draw);
	K.start();
})();
