// Cliff Climb: every chatter is a climber on one of two rock walls at the sides of the screen. Each message is a hop up,
// and the first to the summit flag wins. The middle stays empty so a 9:16 video can sit between the walls.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage();
	var goal = Math.round(K.num('goal', 20, 8, 60)), gapOpt = K.num('gap', -1, 0, 0.8), command = K.word('command', '').replace(/^!/, '');
	var COOL = 0.8, SHOW = 10, CHEER = 6.5, GRACE = 8, MEDAL = ['#ffd43b', '#cfd8ea', '#e8a56b'], INK = 'rgba(10,14,28,.9)';
	// All wall drawing is in "wall units": x runs from 0 at the screen edge to wallW at the gap, for both walls.
	var u = 1, wallW = 1, topY = 0, baseY = 0, hop = 1, cr = 30, zoneL = 0, zoneW = 1, flagX = 0, labelSize = 22;
	var walls = [0, 1].map(function (i) { return { i: i, list: [], show: [], minor: [], bits: [], snow: [], layer: null, shake: 0, dirty: true, up: 0 }; });
	var climbers = {}, count = 0, joined = 0, clock = 0, round = 1, summit = [], firstAt = 0, over = null, rock = null, nextRock = 8, pickT = 0, boxes = [];
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	st.onresize = function () {
		var gap = gapOpt >= 0 ? st.W * gapOpt : st.portrait ? st.W * 0.4 : Math.min(st.H * 9 / 16, st.W * 0.5);
		u = Math.min(st.W, st.H) / 1080;
		wallW = Math.max(8, Math.floor((st.W - gap) / 2));
		cr = K.clamp(wallW * 0.088, 20 * u, 34 * u) * K.clamp(K.scale, 0.6, 1.25);
		topY = Math.round((st.portrait ? 300 : 252) * u); baseY = Math.round(st.H - 92 * u);
		hop = (baseY - topY) / goal;
		zoneL = cr * 1.7 + 4 * u; zoneW = Math.max(1, wallW - cr * 3.4 - 40 * u); flagX = wallW * 0.5;
		labelSize = Math.max(24 * u, cr * 0.8);
		walls[0].layer = walls[1].layer = null;
	};
	st.onresize();

	function rng(seed) {
		var s = seed >>> 0;
		return function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	}
	function sx(w, x) { return w.i ? st.W - x : x; }
	function zx(c) { return zoneL + c.x * zoneW; }
	function headY(c) { return baseY - 2.6 * cr - c.h * hop; }

	// ---- The rock face, painted once per wall ----
	function ridge(x) { var f = x / wallW; return topY + (20 * Math.abs(f - 0.5) + 2.5 * Math.sin(f * 17)) * u; }
	function poly(g, pts) { g.beginPath(); for (var n = 0; n < pts.length; n += 2) g.lineTo(pts[n], pts[n + 1]); g.closePath(); }
	function paintWall(w) {
		var k = st.k, W = wallW, H = st.H, rnd = rng(w.i ? 9127 : 4391), pw = Math.ceil(W * k);
		w.layer = K.layer(pw, Math.ceil(H * k), function (g) {
			var edge = [], inner = [], grid = [], span = baseY - topY, n, r, c, x, y, grad, cell, cols, rows, a, b, d, e, lw, kind, i, flip, shade;
			g.scale(k, k);
			if (w.i) { g.translate(pw / k, 0); g.scale(-1, 1); }
			// Outline: the ridge along the top, then the broken edge that faces the gap
			for (n = 0; n <= 8; n++) { x = (W - 30 * u) * n / 8; edge.push(x, ridge(x)); }
			inner.push(W - 12 * u, topY + 30 * u);
			for (y = topY + 84 * u; y < H; y += (46 + rnd() * 50) * u) inner.push(W - (4 + rnd() * rnd() * 46) * u, y);
			inner.push(W - 8 * u, H + 4);
			edge = edge.concat(inner); edge.push(-4, H + 4, -4, ridge(0));
			poly(g, edge);
			grad = g.createLinearGradient(0, topY, 0, H); grad.addColorStop(0, '#7886b6'); grad.addColorStop(0.45, '#525f8e'); grad.addColorStop(1, '#2f385c');
			g.fillStyle = grad; g.fill();
			g.save(); g.clip();
			// Facets: a loose mesh of triangles, lit from the gap side
			cell = 86 * u; cols = Math.ceil(W / cell) + 2; rows = Math.ceil((H - topY) / cell) + 2;
			for (r = 0; r <= rows; r++) for (c = 0; c <= cols; c++) grid.push((c - 0.6) * cell + (rnd() - 0.5) * cell * 0.72, topY + (r - 0.6) * cell + (rnd() - 0.5) * cell * 0.72);
			for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
				a = (r * (cols + 1) + c) * 2; b = a + 2; d = a + (cols + 1) * 2; e = d + 2; flip = rnd() < 0.5;
				for (i = 0; i < 2; i++) {
					shade = (flip ? (i ? -0.3 : 0.3) : (i ? -0.9 : 0.9)) * (0.55 + rnd() * 0.75);
					g.beginPath();
					if (flip) { if (i) { g.moveTo(grid[b], grid[b + 1]); g.lineTo(grid[e], grid[e + 1]); g.lineTo(grid[d], grid[d + 1]); } else { g.moveTo(grid[a], grid[a + 1]); g.lineTo(grid[b], grid[b + 1]); g.lineTo(grid[d], grid[d + 1]); } }
					else if (i) { g.moveTo(grid[a], grid[a + 1]); g.lineTo(grid[e], grid[e + 1]); g.lineTo(grid[d], grid[d + 1]); } else { g.moveTo(grid[a], grid[a + 1]); g.lineTo(grid[b], grid[b + 1]); g.lineTo(grid[e], grid[e + 1]); }
					g.closePath();
					g.fillStyle = shade > 0 ? 'rgba(255,255,255,' + (shade * 0.1).toFixed(3) + ')' : 'rgba(8,12,44,' + (-shade * 0.13).toFixed(3) + ')';
					g.fill();
				}
			}
			// Strata: darker bands that wander across the face
			for (n = 0; n < 7; n++) {
				y = topY + span * (n + 0.3 + rnd() * 0.5) / 7; lw = (10 + rnd() * 18) * u; a = rnd() * 6; b = (6 + rnd() * 10) * u;
				g.beginPath();
				for (x = -10; x <= W + 10; x += 40 * u) g.lineTo(x, y + Math.sin(x / (120 * u) + a) * b);
				for (x = W + 10; x >= -10; x -= 40 * u) g.lineTo(x, y + lw + Math.sin(x / (120 * u) + a + 0.5) * b);
				g.closePath(); g.fillStyle = 'rgba(10,14,48,.13)'; g.fill();
			}
			// Frost toward the summit, moss toward the ground, shade toward the screen edge and light along the gap
			grad = g.createLinearGradient(0, topY, 0, topY + span * 0.36); grad.addColorStop(0, 'rgba(236,243,255,.2)'); grad.addColorStop(1, 'rgba(236,243,255,0)');
			g.fillStyle = grad; g.fillRect(0, 0, W, topY + span * 0.36);
			grad = g.createLinearGradient(0, baseY - span * 0.3, 0, baseY); grad.addColorStop(0, 'rgba(70,160,115,0)'); grad.addColorStop(1, 'rgba(70,160,115,.22)');
			g.fillStyle = grad; g.fillRect(0, baseY - span * 0.3, W, span * 0.3 + 4);
			grad = g.createLinearGradient(0, 0, W * 0.6, 0); grad.addColorStop(0, 'rgba(6,9,30,.4)'); grad.addColorStop(1, 'rgba(6,9,30,0)');
			g.fillStyle = grad; g.fillRect(0, 0, W * 0.6, H);
			grad = g.createLinearGradient(W, 0, W * 0.62, 0); grad.addColorStop(0, 'rgba(255,255,255,.14)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = grad; g.fillRect(W * 0.62, 0, W * 0.38, H);
			// Cracks
			g.lineCap = 'round'; g.lineJoin = 'round';
			for (n = 0; n < 8; n++) {
				x = rnd() * W; y = topY + (0.06 + rnd() * 0.8) * span; a = [x, y];
				for (i = 0; i < 4; i++) { x += (rnd() - 0.5) * 60 * u; y += (20 + rnd() * 44) * u; a.push(x, y); }
				g.beginPath(); for (i = 0; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
				g.strokeStyle = 'rgba(6,10,36,.38)'; g.lineWidth = 2.6 * u; g.stroke();
				g.beginPath(); for (i = 0; i < a.length; i += 2) g.lineTo(a[i] + 2 * u, a[i + 1] + 0.6 * u);
				g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1.2 * u; g.stroke();
			}
			// Ledges: a lit top, a dark lip and the shade beneath. Snowy near the summit, grassy near the ground.
			rows = Math.max(4, Math.round(span / (96 * u)));
			for (n = 0; n < rows; n++) {
				y = topY + span * (n + 0.35 + rnd() * 0.5) / rows; lw = Math.min(W * 0.5, (64 + rnd() * 84) * u); x = lw / 2 + 6 * u + rnd() * Math.max(1, W - lw - 40 * u);
				kind = (y - topY) / span; a = x - lw / 2; b = x + lw / 2;
				poly(g, [a + 8 * u, y + 6 * u, b - 4 * u, y + 5 * u, b - 22 * u, y + 40 * u, a + 30 * u, y + 34 * u]); g.fillStyle = 'rgba(6,10,36,.3)'; g.fill();
				poly(g, [a, y, b, y - 3 * u, b - 9 * u, y + 10 * u, a + 11 * u, y + 11 * u]); g.fillStyle = '#39446c'; g.fill();
				poly(g, [a, y, a + 12 * u, y - 9 * u, b - 10 * u, y - 11 * u, b, y - 3 * u]); g.fillStyle = kind < 0.34 ? '#f4f8ff' : kind > 0.62 ? '#62c283' : '#b9c5ea'; g.fill();
				if (kind < 0.34) {
					// Snow hangs over the lip
					g.beginPath(); g.moveTo(a + 2 * u, y - 1 * u);
					for (i = a + 2 * u; i < b - 6 * u; i += 15 * u) g.quadraticCurveTo(i + 7.5 * u, y + (5 + rnd() * 9) * u, i + 15 * u, y - 2 * u);
					g.closePath(); g.fillStyle = '#f4f8ff'; g.fill();
				} else if (kind > 0.62) {
					g.beginPath();
					for (i = a + 12 * u; i < b - 14 * u; i += 9 * u) { g.moveTo(i, y - 8 * u); g.lineTo(i + 3 * u + rnd() * 3 * u, y - (17 + rnd() * 9) * u); g.lineTo(i + 7 * u, y - 8 * u); }
					g.fillStyle = '#83dc9d'; g.fill();
					if (rnd() < 0.6) { g.fillStyle = '#3f9a6b'; g.beginPath(); g.arc(x, y - 17 * u, 13 * u, 0, 6.2832); g.arc(x + 15 * u, y - 13 * u, 10 * u, 0, 6.2832); g.arc(x - 14 * u, y - 12 * u, 9 * u, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(x + 3 * u, y - 21 * u, 6 * u, 0, 6.2832); g.fill(); }
				}
			}
			// Ground: a grassy bank, a tent and a pine at the foot of the wall
			y = baseY + 2 * u;
			grad = g.createLinearGradient(0, y - 14 * u, 0, H); grad.addColorStop(0, '#4fae78'); grad.addColorStop(0.3, '#2f7d5b'); grad.addColorStop(1, '#173f38');
			g.beginPath(); g.moveTo(-4, H + 4); g.lineTo(-4, y);
			for (x = 0; x < W + 12 * u; x += 11 * u) { g.lineTo(x + 4 * u, y - (7 + rnd() * 9) * u); g.lineTo(x + 8 * u, y + rnd() * 3 * u); }
			g.lineTo(W + 8, H + 4); g.closePath(); g.fillStyle = grad; g.fill();
			g.fillStyle = 'rgba(6,10,36,.22)'; g.fillRect(0, y + 22 * u, W, 5 * u);
			x = W * 0.74;
			poly(g, [x - 44 * u, y + 6 * u, x, y - 50 * u, x + 44 * u, y + 6 * u]); g.fillStyle = '#ff9f43'; g.fill();
			poly(g, [x, y - 50 * u, x + 44 * u, y + 6 * u, x + 12 * u, y + 6 * u]); g.fillStyle = '#e8721c'; g.fill();
			poly(g, [x - 13 * u, y + 6 * u, x, y - 26 * u, x + 12 * u, y + 6 * u]); g.fillStyle = '#2b2033'; g.fill();
			x = 34 * u;
			g.fillStyle = '#3b2a26'; g.fillRect(x - 5 * u, y - 26 * u, 10 * u, 34 * u);
			for (i = 0; i < 4; i++) { poly(g, [x - (46 - i * 8) * u, y - (22 + i * 34) * u, x, y - (84 + i * 34) * u, x + (46 - i * 8) * u, y - (22 + i * 34) * u]); g.fillStyle = i % 2 ? '#2f8a62' : '#27724f'; g.fill(); }
			poly(g, [x - 14 * u, y - 124 * u, x, y - 186 * u, x + 14 * u, y - 124 * u]); g.fillStyle = '#f4f8ff'; g.fill();
			grad = g.createLinearGradient(0, H - 150 * u, 0, H); grad.addColorStop(0, 'rgba(6,9,30,0)'); grad.addColorStop(1, 'rgba(6,9,30,.4)');
			g.fillStyle = grad; g.fillRect(0, H - 150 * u, W, 150 * u);
			// Snow along the ridge, a cairn for the flag and a row of anchor bolts
			g.beginPath(); g.moveTo(-4, ridge(0) - 3 * u);
			for (x = 0; x <= W; x += 20 * u) g.lineTo(x, ridge(x) - 3 * u);
			for (x = W; x >= -20 * u; x -= 22 * u) g.quadraticCurveTo(x - 11 * u, ridge(x) + (22 + rnd() * 20) * u, x - 22 * u, ridge(x) + (9 + rnd() * 5) * u);
			g.closePath(); g.fillStyle = '#f6f9ff'; g.fill();
			g.fillStyle = 'rgba(120,150,225,.3)';
			for (x = 12 * u; x < W - 30 * u; x += (30 + rnd() * 50) * u) { g.beginPath(); g.ellipse(x, ridge(x) + 7 * u, (10 + rnd() * 12) * u, 2.6 * u, 0, 0, 6.2832); g.fill(); }
			for (i = -1; i <= 1; i++) { x = flagX + i * 15 * u; y = ridge(flagX) - (i ? 3 : 11) * u; poly(g, [x - 13 * u, y + 8 * u, x - 8 * u, y - 5 * u, x + 7 * u, y - 7 * u, x + 13 * u, y + 8 * u]); g.fillStyle = i ? '#6f7ba6' : '#8e9ac4'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = INK; g.stroke(); }
			// Rim: light where the rock meets the gap, then a dark outline to hold the shape against any video
			g.beginPath(); for (n = 0; n < inner.length; n += 2) g.lineTo(inner[n], inner[n + 1]);
			g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = 9 * u; g.stroke();
			g.restore();
			poly(g, edge); g.strokeStyle = INK; g.lineWidth = 3 * u; g.stroke();
		});
	}
	function boulder() {
		return K.sprite('cc:boulder', 128, 128, function (g) {
			poly(g, [22, 40, 52, 10, 92, 14, 118, 50, 108, 96, 70, 120, 30, 108, 8, 72]); g.fillStyle = '#7a86b2'; g.fill();
			poly(g, [52, 10, 92, 14, 118, 50, 78, 54, 50, 40]); g.fillStyle = '#a9b5dd'; g.fill();
			poly(g, [8, 72, 22, 40, 50, 40, 44, 82, 30, 108]); g.fillStyle = '#5c6894'; g.fill();
			poly(g, [44, 82, 78, 54, 118, 50, 108, 96, 70, 120, 30, 108]); g.fillStyle = '#6a76a3'; g.fill();
			poly(g, [22, 40, 52, 10, 92, 14, 118, 50, 108, 96, 70, 120, 30, 108, 8, 72]); g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
		});
	}

	// ---- Climbers ----
	function nearest(w, lx) { for (var n = Math.max(0, w.list.length - 40), d = 1; n < w.list.length; n++) d = Math.min(d, Math.abs(w.list[n].lx - lx)); return d; }
	function join(p) {
		var w, c, n, lx, d, best = 0.5, bestD = -1;
		if (count >= 600) return null;
		// The wall with fewer climbers, and a spot on it away from the others.
		w = walls[0].list.length === walls[1].list.length ? walls[joined % 2] : walls[0].list.length < walls[1].list.length ? walls[0] : walls[1];
		for (n = 0; n < 7; n++) { lx = Math.random(); d = nearest(w, lx); if (d > bestD) { bestD = d; best = lx; } }
		c = climbers[p.key] = { p: p, w: w, id: joined, lx: best, x: best, ax: best, hops: 0, h: 0, h0: 0, t: 1, fall: 0, turn: 1, last: -9, moved: -9, born: clock, arm: joined % 2, place: 0, active: false, name: K.short(p.name, 9), nw: 0 };
		st.ctx.font = K.font(44); c.nw = st.ctx.measureText(c.name).width / 44;
		w.list.push(c); w.dirty = true; count++; joined++;
		return c;
	}
	function bit(w, x, y, vx, vy, life, size, kind, color) { if (w.bits.length < 130) w.bits.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, kind: kind, color: color, rot: Math.random() * 6, spin: K.rand(-9, 9) }); }
	function puff(w, x, y, n) {
		for (var i = Math.ceil(n * K.q); i > 0; i--) bit(w, x + K.rand(-8, 8) * u, y, K.rand(-70, 70) * u, K.rand(-40, 120) * u, K.rand(0.5, 0.9), K.rand(3, 6.5) * u, 0, K.pick(['#aab5d8', '#7a86b2', '#dfe6f8']));
		bit(w, x, y, K.rand(-12, 12) * u, -14 * u, 0.55, cr * 0.9, 1, '#e8eefc');
	}
	function climb(c) {
		var w = c.w, n, o, dx, room = cr * 2.3 / zoneW;
		c.hops++; c.h0 = c.h; c.t = 0; c.fall = 0; c.arm = 1 - c.arm; c.moved = clock; c.active = true; w.dirty = true;
		// Sidestep anyone already hanging at that height.
		for (n = 0; n < w.show.length; n++) {
			o = w.show[n];
			if (o === c || o.place || Math.abs(o.hops - c.hops) * hop > cr * 3.3) continue;
			dx = c.lx - o.lx;
			if (Math.abs(dx) < room) c.lx = K.clamp(c.lx + (dx > 0 || (dx === 0 && c.id > o.id) ? 1 : -1) * (room - Math.abs(dx)) * 0.7, 0, 1);
		}
		puff(w, zx(c) + (c.arm ? 1 : -1) * cr, headY(c) - cr * 1.2 - hop, 4);
		if (c.hops >= goal) {
			c.place = summit.length + 1; summit.push(c);
			// A place on the ridge beside the flag
			n = 0; for (o = 0; o < summit.length - 1; o++) if (summit[o].w === w) n++;
			c.lx = (flagX + [-2.5, 2.4, -4.7][n] * cr - zoneL) / zoneW;
			if (c.place === 1) firstAt = clock;
			for (n = 0; n < 26 * K.q; n++) bit(w, flagX + K.rand(-20, 20) * u, topY - 60 * u, K.rand(-260, 260) * u, K.rand(-520, -120) * u, K.rand(1.1, 1.9), K.rand(7, 12) * u, 2, c.place === 1 ? K.pick(['#ffd43b', '#fff3bf', '#ff9f43']) : K.pick(K.colors));
		}
	}
	// The highest climber still on a wall (the earlier one, if two are level); with no wall given, on either.
	function ahead(a, b) { return !a ? b : !b ? a : b.hops > a.hops || (b.hops === a.hops && b.moved < a.moved) ? b : a; }
	function leader(w) {
		var best = null, n, c;
		if (!w) return ahead(leader(walls[0]), leader(walls[1]));
		for (n = 0; n < w.list.length; n++) { c = w.list[n]; if (!c.place && c.hops > 0) best = ahead(best, c); }
		return best;
	}
	function byHeight(a, b) { return (b.place ? 1000 - b.place : b.hops) - (a.place ? 1000 - a.place : a.hops) || a.id - b.id; }
	// Who is drawn in full: the three on the ridge, the highest ten and anyone who has just moved. The rest are small faces.
	function pick(w) {
		var list = w.list, n, i, c, o, dx, push, top = 0, extra = 0, room = cr * 2.3 / zoneW;
		list.sort(byHeight);
		w.show.length = 0; w.minor.length = 0;
		for (n = 0; n < list.length; n++) {
			c = list[n];
			if (c.place || top < SHOW) { w.show.push(c); if (!c.place) top++; }
			else if (clock - c.moved < 2 && extra < 4) { w.show.push(c); extra++; }
			else {
				if (w.minor.length < 50) w.minor.push(c);
				if (c.spr) { c.spr.width = c.spr.height = 0; c.spr = null; c.sprCr = 0; }
			}
		}
		// Climbers hanging at the same height ease apart, a little each time.
		for (n = 0; n < w.show.length; n++) for (i = n + 1; i < w.show.length; i++) {
			c = w.show[n]; o = w.show[i];
			if (c.place || o.place || Math.abs(c.hops - o.hops) * hop > cr * 3.2) continue;
			dx = c.lx - o.lx;
			if (Math.abs(dx) < room) { push = (room - Math.abs(dx)) * 0.3 * (dx > 0 || (dx === 0 && c.id > o.id) ? 1 : -1); c.lx = K.clamp(c.lx + push, 0, 1); o.lx = K.clamp(o.lx - push, 0, 1); }
		}
		w.dirty = false;
	}

	K.onChat(function (msg) {
		var c;
		if (command && msg.cmd !== command) return;
		c = climbers[msg.player.key] || join(msg.player);
		// Once three stand on the ridge the round is decided, even before the next frame says so.
		if (!c || over || summit.length >= 3 || c.place || clock - c.last < COOL) return;
		c.last = clock;
		climb(c);
	});

	// ---- Rockfall: now and then a boulder works loose above one wall's leader, in plain sight, and knocks them down ----
	function startRock() {
		var a = leader(walls[0]), b = leader(walls[1]), c;
		nextRock = clock + K.rand(9, 14);
		c = a && b ? ((a.hops >= b.hops) === (Math.random() < 0.7) ? a : b) : a || b;
		if (!c || c.hops < 4) return;
		rock = { c: c, t: 0, x: zx(c), y: 0, vy: 0, falling: false, rot: 0, drip: 0 };
	}
	function crumble(w, x, y) {
		for (var n = Math.ceil(9 * K.q); n > 0; n--) bit(w, x, y, K.rand(-300, 300) * u, K.rand(-380, 60) * u, K.rand(0.8, 1.3), K.rand(8, 15) * u, 3, K.pick(['#7a86b2', '#a9b5dd', '#5c6894']));
		puff(w, x, y, 8);
	}
	function updateRock(dt) {
		var r = rock, c = r.c, w = c.w, hits;
		r.t += dt;
		if (!r.falling) {
			r.x = zx(c);
			r.drip -= dt;
			if (r.drip <= 0) { r.drip = 0.11; bit(w, r.x + K.rand(-0.8, 0.8) * cr, ridge(r.x) + 6 * u, K.rand(-20, 20) * u, K.rand(60, 200) * u, K.rand(0.6, 1), K.rand(2.5, 5) * u, 0, '#c9d3f0'); }
			if (r.t > 2.3) { r.falling = true; r.y = ridge(r.x) - cr; }
			return;
		}
		r.vy += 2300 * u * dt; r.y += r.vy * dt; r.rot += dt * 8; r.x = K.approach(r.x, zx(c), 8, dt);
		hits = !c.place && r.y >= headY(c) - cr * 1.7;
		if (hits) {
			// Caught by the rope a couple of hops lower.
			c.hops = Math.max(0, c.hops - (Math.random() < 0.35 ? 3 : 2)); c.h0 = c.h; c.t = 0; c.fall = 1; c.turn = Math.random() < 0.5 ? 1 : -1; c.moved = clock; w.dirty = true;
			if (!K.calm) w.shake = 16 * u;
		}
		if (hits || r.y > baseY - cr) { crumble(w, r.x, r.y); rock = null; }
	}

	function newRound() {
		var n, i, w, c, keep;
		for (i = 0; i < 2; i++) {
			w = walls[i]; keep = [];
			for (n = 0; n < w.list.length; n++) {
				c = w.list[n];
				// Anyone who sat the whole round out leaves the wall; they rejoin with their next message.
				if (!c.active) { delete climbers[c.p.key]; count--; if (c.spr) c.spr.width = c.spr.height = 0; continue; }
				c.hops = 0; c.h0 = c.h; c.t = 0; c.fall = 2; c.place = 0; c.active = false; c.lx = c.ax;
				keep.push(c);
			}
			w.list = keep; w.dirty = true;
		}
		summit = []; over = null; rock = null; firstAt = 0; nextRock = clock + K.rand(7, 10); round++;
	}
	function caught(t) { return t < 0.45 ? (t / 0.45) * (t / 0.45) : 1 + 0.3 * Math.exp(-6 * (t - 0.45) / 0.55) * Math.sin((t - 0.45) / 0.55 * 9.42); }
	function update(dt) {
		var i, n, w, c, b, f, all;
		clock += dt;
		pickT -= dt;
		for (i = 0; i < 2; i++) {
			w = walls[i];
			if (w.shake > 0) w.shake = w.shake < 0.4 ? 0 : w.shake * Math.exp(-9 * dt);
			for (n = 0; n < w.list.length; n++) {
				c = w.list[n];
				if (c.t < 1) {
					c.t = Math.min(1, c.t + dt / (c.fall === 1 ? 0.85 : c.fall === 2 ? 1.1 : 0.38));
					c.h = c.h0 + (c.hops - c.h0) * (c.fall === 1 ? caught(c.t) : c.fall === 2 ? K.ease(c.t) : K.back(c.t));
				}
				if (c.x !== c.lx) c.x = Math.abs(c.x - c.lx) < 0.001 ? c.lx : K.approach(c.x, c.lx, 6, dt);
			}
			if (w.dirty || pickT <= 0) pick(w);
			for (n = w.bits.length - 1; n >= 0; n--) {
				b = w.bits[n]; b.life -= dt;
				if (b.life <= 0) { w.bits[n] = w.bits[w.bits.length - 1]; w.bits.pop(); continue; }
				if (b.kind !== 1) b.vy += (b.kind === 2 ? 620 : 1500) * u * dt;
				if (b.kind === 2) { b.vx *= 1 - 1.4 * dt; b.vy *= 1 - 1.4 * dt; }
				b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt;
			}
			// A little snow drifts past the summit, always.
			if (!w.snow.length) for (n = 0; n < 12; n++) w.snow.push({ x: Math.random(), y: Math.random(), v: K.rand(0.5, 1), s: K.rand(2, 4.2), p: Math.random() * 6 });
			for (n = 0; n < w.snow.length; n++) { f = w.snow[n]; f.y += f.v * dt * 0.09; if (f.y > 1) { f.y -= 1; f.x = Math.random(); } }
		}
		if (pickT <= 0) pickT = 0.3;
		if (rock) updateRock(dt);
		else if (!over && clock > nextRock) startRock();
		if (!over && summit.length && (summit.length >= Math.min(3, count) || clock > firstAt + GRACE)) {
			over = { until: clock + CHEER, next: 0 }; rock = null;
			all = [];
			for (i = 0; i < 2; i++) for (n = 0; n < walls[i].list.length; n++) if (walls[i].list[n].active) all.push(walls[i].list[n].p);
			K.awardRound(summit.map(function (s) { return s.p; }), all);
		}
		if (over) {
			if (clock > over.next) {
				over.next = clock + 0.3; w = summit[Math.floor(Math.random() * summit.length)].w;
				for (n = 0; n < 12 * K.q; n++) bit(w, flagX + K.rand(-0.4, 0.4) * wallW, topY - K.rand(40, 150) * u, K.rand(-240, 240) * u, K.rand(-460, -80) * u, K.rand(1.1, 1.9), K.rand(7, 12) * u, 2, K.pick(K.colors));
			}
			if (clock > over.until) newRound();
		}
	}

	// ---- Drawing. Each wall is drawn inside its own column, so nothing can ever reach the gap. ----
	function drawClimber(ctx, c, x, y, s, t) {
		var col = c.p.color, stand = c.place > 0 && c.t > 0.7, fall = c.fall === 1 && c.t < 0.55, pull = !c.fall && c.t < 1 ? Math.sin(c.t * 3.1416) : 0;
		var hi = c.arm ? 1 : -1, hx1, hy1, hx2, hy2, fx1, fy1, fx2, fy2, wave;
		if (stand) {
			wave = Math.sin(t * 9 + c.id); hx1 = -1.25 * s; hy1 = (-0.9 + wave * 0.28) * s; hx2 = 1.25 * s; hy2 = (-0.9 - wave * 0.28) * s;
			fx1 = -0.42 * s; fx2 = 0.42 * s; fy1 = fy2 = 2.75 * s;
		} else if (fall) {
			hx1 = -1.5 * s; hy1 = -0.1 * s; hx2 = 1.5 * s; hy2 = 0.2 * s; fx1 = -0.95 * s; fy1 = 2.6 * s; fx2 = 0.9 * s; fy2 = 2.7 * s;
		} else {
			// One hand high, one low; the high hand reaches further and the body lifts as it pulls.
			hx1 = hi * 1.02 * s; hy1 = (-1.12 - pull * 0.42) * s; hx2 = -hi * 1.0 * s; hy2 = (-0.12 + pull * 0.25) * s;
			fx1 = hi * 0.72 * s; fy1 = (2.72 - pull * 0.5) * s; fx2 = -hi * 0.7 * s; fy2 = 2.58 * s;
		}
		ctx.save(); ctx.translate(x, y);
		if (fall) ctx.rotate(c.turn * Math.sin(c.t / 0.55 * 3.1416) * 0.55);
		ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		ctx.strokeStyle = '#1d2443'; ctx.lineWidth = s * 0.46;
		ctx.beginPath(); ctx.moveTo(-0.3 * s, 1.9 * s); ctx.lineTo(fx1 < fx2 ? fx1 : fx2, fx1 < fx2 ? fy1 : fy2); ctx.moveTo(0.3 * s, 1.9 * s); ctx.lineTo(fx1 < fx2 ? fx2 : fx1, fx1 < fx2 ? fy2 : fy1); ctx.stroke();
		ctx.fillStyle = '#c9773c'; ctx.beginPath(); ctx.ellipse(fx1, fy1, s * 0.34, s * 0.23, 0, 0, 6.2832); ctx.ellipse(fx2, fy2, s * 0.34, s * 0.23, 0, 0, 6.2832); ctx.fill();
		ctx.strokeStyle = INK; ctx.lineWidth = s * 0.56;
		ctx.beginPath(); ctx.moveTo(-0.52 * s, 0.98 * s); ctx.lineTo(hx1 < hx2 ? hx1 : hx2, hx1 < hx2 ? hy1 : hy2); ctx.moveTo(0.52 * s, 0.98 * s); ctx.lineTo(hx1 < hx2 ? hx2 : hx1, hx1 < hx2 ? hy2 : hy1); ctx.stroke();
		ctx.strokeStyle = col; ctx.lineWidth = s * 0.38; ctx.stroke();
		ctx.fillStyle = '#ffe8cc'; ctx.beginPath(); ctx.arc(hx1, hy1, s * 0.24, 0, 6.2832); ctx.arc(hx2, hy2, s * 0.24, 0, 6.2832); ctx.fill();
		K.rr(ctx, -0.68 * s, 0.7 * s, 1.36 * s, (1.42 + pull * 0.12) * s, 0.44 * s); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = s * 0.1; ctx.strokeStyle = INK; ctx.stroke();
		ctx.fillStyle = '#1d2443'; ctx.fillRect(-0.66 * s, 1.52 * s, 1.32 * s, 0.2 * s);
		ctx.fillStyle = '#ffd43b'; ctx.fillRect(-0.13 * s, 1.5 * s, 0.26 * s, 0.24 * s);
		if (s > cr * 1.15) K.bigFace(ctx, c.p, 0, 0, s); else K.face(ctx, c.p, 0, 0, s);
		// Helmet with a lamp
		ctx.beginPath(); ctx.arc(0, 0, s * 1.04, 3.707, 5.718); ctx.closePath(); ctx.fillStyle = '#f4f6fb'; ctx.fill(); ctx.lineWidth = s * 0.09; ctx.strokeStyle = INK; ctx.stroke();
		ctx.beginPath(); ctx.arc(0, -0.8 * s, s * 0.14, 0, 6.2832); ctx.fillStyle = '#ffd43b'; ctx.fill();
		ctx.restore();
	}
	// A climber hanging still is most of what is on screen, so that pose (with its shadow) is kept as a picture and
	// repainted only when the climber has moved a hand, the face has loaded or the window has changed.
	function resting(c) {
		var k = st.k, pw = Math.ceil(cr * 3.8 * k), ph = Math.ceil(cr * 5.5 * k), g;
		if (!c.spr) c.spr = document.createElement('canvas');
		if (c.sprArm !== c.arm || c.sprPhoto !== c.p.photo || c.sprCr !== cr || c.spr.width !== pw || c.spr.height !== ph) {
			c.spr.width = pw; c.spr.height = ph;
			g = c.spr.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
			K.shadow(g, cr * 1.9 + 5 * u, cr * 3.15, cr * 1.5, cr * 2.1, 0.34);
			drawClimber(g, c, cr * 1.9, cr * 1.9, cr, 0);
			c.sprArm = c.arm; c.sprPhoto = c.p.photo; c.sprCr = cr;
		}
		return c.spr;
	}
	function drawWall(ctx, w, t, best) {
		var k = st.k, x0 = w.i ? st.W - wallW : 0, mid = sx(w, flagX), dir = w.i ? -1 : 1, shake = w.shake ? Math.round((Math.random() - 0.5) * 2 * w.shake) : 0;
		var n, c, x, y, s, a, b, f, top, len, hgt, half, cheer = over ? K.clamp((clock - (over.until - CHEER)) * 2, 0, 1) : 0;
		if (!w.layer) paintWall(w);
		ctx.save();
		ctx.beginPath(); ctx.rect(x0, 0, wallW, st.H); ctx.clip();
		// The wall itself, pixel for pixel
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(w.layer, w.i ? st.canvas.width - w.layer.width : 0, Math.round(shake * k));
		ctx.setTransform(k, 0, 0, k, 0, shake * k);
		// Snow in the air around the summit
		ctx.fillStyle = '#ffffff';
		for (n = 0; n < w.snow.length; n++) {
			f = w.snow[n]; ctx.globalAlpha = 0.75 * Math.min(1, f.y * 6, (1 - f.y) * 4);
			ctx.beginPath(); ctx.arc(x0 + ((f.x + Math.sin(t * 0.7 + f.p) * 0.05 + 1) % 1) * wallW, f.y * (topY + (baseY - topY) * 0.45), f.s * u, 0, 6.2832); ctx.fill();
		}
		ctx.globalAlpha = 1;
		// Summit flag
		top = ridge(flagX) - 140 * u; len = Math.min(84 * u, wallW * 0.34); hgt = 50 * u;
		ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		ctx.strokeStyle = INK; ctx.lineWidth = 10 * u; ctx.beginPath(); ctx.moveTo(mid, ridge(flagX) - 6 * u); ctx.lineTo(mid, top); ctx.stroke();
		ctx.strokeStyle = '#eef2fb'; ctx.lineWidth = 5.5 * u; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(mid, top + 5 * u);
		for (n = 1; n <= 6; n++) ctx.lineTo(mid + dir * len * n / 6, top + 5 * u + (Math.sin(t * 5.5 - n * 0.95 + w.i) * 6 + n * 0.8) * u * n / 6);
		for (n = 6; n >= 0; n--) ctx.lineTo(mid + dir * len * n / 6, top + 5 * u + hgt * (1 - 0.1 * n / 6) + (Math.sin(t * 5.5 - n * 0.95 - 0.5 + w.i) * 6 + n * 0.8) * u * n / 6);
		ctx.closePath(); ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.lineWidth = 3.5 * u; ctx.strokeStyle = INK; ctx.stroke();
		K.star(ctx, mid + dir * len * 0.42, top + 5 * u + hgt * 0.5 + Math.sin(t * 5.5 - 2.4 + w.i) * 3 * u, 12 * u, '#fff3bf');
		ctx.beginPath(); ctx.arc(mid, top - 3 * u, 7 * u, 0, 6.2832); ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = INK; ctx.stroke();
		// Ropes from the anchors on the ridge, and the anchors themselves
		ctx.lineWidth = 2.6 * u; ctx.strokeStyle = 'rgba(244,247,255,.62)'; ctx.beginPath();
		for (n = 0; n < w.show.length; n++) {
			c = w.show[n]; if (c.place) continue;
			f = zx(c) + (c.ax - c.x) * zoneW * 0.25; a = sx(w, f); x = sx(w, zx(c)); y = headY(c);
			ctx.moveTo(a, ridge(f) + 9 * u); ctx.quadraticCurveTo((a + x) / 2 + Math.sin(t * 1.3 + c.id) * 5 * u, (topY + y) / 2, x, y + 1.5 * cr);
		}
		ctx.stroke();
		ctx.fillStyle = '#eef2fb'; ctx.beginPath();
		for (n = 0; n < w.show.length; n++) { c = w.show[n]; if (c.place) continue; f = zx(c) + (c.ax - c.x) * zoneW * 0.25; a = sx(w, f); y = ridge(f) + 9 * u; ctx.moveTo(a + 4.5 * u, y); ctx.arc(a, y, 4.5 * u, 0, 6.2832); }
		ctx.fill();
		// The telegraph: a loose boulder rocking on the ridge and a dashed line down to the climber it will hit
		if (rock && rock.c.w === w) {
			c = rock.c; x = sx(w, rock.x); y = headY(c);
			if (!rock.falling) {
				a = 0.5 + 0.5 * Math.sin(rock.t * 12);
				ctx.setLineDash([10 * u, 12 * u]); ctx.lineDashOffset = -rock.t * 60 * u; ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(255,107,107,' + (0.55 + a * 0.4).toFixed(2) + ')';
				ctx.beginPath(); ctx.moveTo(x, ridge(rock.x) + cr * 0.4); ctx.lineTo(x, y - cr * 1.5); ctx.stroke(); ctx.setLineDash([]);
				ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(x, y, cr * (1.55 + a * 0.2), 0, 6.2832); ctx.stroke();
			}
		}
		// Everyone else on the wall, as small faces at their height
		s = cr * 0.46;
		for (n = w.minor.length - 1; n >= 0; n--) { c = w.minor[n]; K.face(ctx, c.p, sx(w, zx(c)), headY(c) + cr, s); }
		// The climbers, lowest first so the leaders are on top
		for (n = w.show.length - 1; n >= 0; n--) {
			c = w.show[n]; s = cr; x = sx(w, zx(c)); y = headY(c);
			if (c.place) {
				s = cr * (c.place === 1 ? 1.2 + cheer * 0.22 : 1.1); y = ridge(flagX) + 0.2 * cr - 2.75 * s - (c.t >= 1 ? Math.abs(Math.sin(t * 6 + c.id)) * (c.place === 1 ? 10 : 5) * u * cheer : (1 - c.t) * hop * 0.2);
				if (c.place === 1 && !K.calm) K.glow(ctx, x, y + s, s * 4.2, '#ffd43b', 0.3 + cheer * 0.3);
			}
			if (!c.place && c.t >= 1) { b = resting(c); ctx.drawImage(b, Math.round((x - cr * 1.9) * k) / k, Math.round((y - cr * 1.9) * k) / k, b.width / k, b.height / k); }
			else {
				// A new arrival pops onto the wall.
				if (clock - c.born < 0.3) s *= K.back((clock - c.born) / 0.3);
				if (!c.place) K.shadow(ctx, x + 5 * u, y + s * 1.25, s * 1.5, s * 2.1, 0.34);
				drawClimber(ctx, c, x, y, s, t);
			}
			if (c.place === 1) K.crown(ctx, x, y - s * 0.98, s * 0.66);
			else if (c.place) { ctx.beginPath(); ctx.arc(x + s * 0.8, y + s * 0.7, s * 0.42, 0, 6.2832); ctx.fillStyle = MEDAL[c.place - 1]; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = INK; ctx.stroke(); K.text(ctx, String(c.place), x + s * 0.8, y + s * 0.72, s * 0.52, '#1a2033', 'center', false); }
			c.sy = y; c.ss = s;
		}
		if (rock && rock.c.w === w) {
			x = sx(w, rock.x); s = cr * 1.05;
			y = rock.falling ? rock.y : ridge(rock.x) - s * 0.7;
			ctx.save(); ctx.translate(x, y); ctx.rotate(rock.falling ? rock.rot : Math.sin(rock.t * 15) * 0.05 * Math.min(4, 1 + rock.t * 1.6)); ctx.drawImage(boulder(), -s, -s, s * 2, s * 2); ctx.restore();
		}
		// Pebbles, dust, rock chips and confetti
		for (n = 0; n < w.bits.length; n++) {
			b = w.bits[n]; a = b.life / b.max; x = sx(w, b.x);
			if (b.kind === 1) { K.glow(ctx, x, b.y, b.size * (2.2 - a), b.color, a * 0.5); continue; }
			ctx.globalAlpha = Math.min(1, a * 2.5); ctx.fillStyle = b.color;
			if (b.kind === 0) { ctx.beginPath(); ctx.arc(x, b.y, b.size * 0.5, 0, 6.2832); ctx.fill(); }
			else { ctx.save(); ctx.translate(x, b.y); ctx.rotate(b.rot); if (b.kind === 2) ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2); else { ctx.beginPath(); ctx.moveTo(-b.size * 0.5, -b.size * 0.3); ctx.lineTo(b.size * 0.3, -b.size * 0.5); ctx.lineTo(b.size * 0.5, b.size * 0.3); ctx.lineTo(-b.size * 0.3, b.size * 0.5); ctx.closePath(); ctx.fill(); } ctx.restore(); }
		}
		ctx.globalAlpha = 1;
		// Names: the wall's leaders, the three on the ridge and anyone who has just moved, kept inside the column
		// Best placed first: a name that would run into one already drawn is left out.
		for (n = 0, top = 0, len = 0; n < w.show.length; n++) {
			c = w.show[n];
			a = c.place || n < 3 ? 1 : top < 3 ? K.clamp((1.2 - (clock - c.moved)) * 3, 0, 1) : 0;
			if (a <= 0 || c.ss === undefined) continue;
			s = c.place ? labelSize * 1.15 : labelSize; half = c.nw * s / 2 + 8 * u;
			// On the ridge the name sits under the snow line, where it reads against the rock.
			x = K.clamp(sx(w, zx(c)), x0 + half, x0 + wallW - half); y = c.place ? ridge(flagX) + 34 * u + s * 0.5 : c.sy + c.ss * 2.75 + s * 0.78;
			for (f = 0; f < len; f += 3) if (Math.abs(boxes[f] - x) < boxes[f + 2] + half - 4 * u && Math.abs(boxes[f + 1] - y) < s) break;
			if (f < len) continue;
			boxes[len] = x; boxes[len + 1] = y; boxes[len + 2] = half; len += 3;
			if (!c.place && n >= 3) top++;
			ctx.globalAlpha = a;
			K.label(ctx, c.name, x, y, s, c.place === 1 || c === best ? '#ffe066' : '#ffffff');
		}
		ctx.globalAlpha = 1;
		// An empty wall asks for chat; with &command set, the word to type sits at its foot.
		if (!w.list.length) K.bubble(ctx, x0 + wallW / 2, baseY - 40 * u, Math.min(1, wallW / (260 * u)) * u, t + w.i);
		if (command) K.hint(ctx, '!' + command, x0 + wallW / 2, st.H - 40 * u, Math.min(30 * u, wallW * 0.09));
		ctx.restore();
	}
	function draw(t) {
		var ctx = K.begin(st), best = leader();
		drawWall(ctx, walls[0], t, best); drawWall(ctx, walls[1], t, best);
	}

	if (K.demo) (function () {
		// Fourteen chatters at their own pace: the quickest reaches the flag in a little over twenty seconds.
		var crew = K.names.slice(0, 14).map(function (name) { return { name: name, at: 0, every: 2 }; }), seen = 0;
		K.every(function () {
			var n, c, order;
			if (seen !== round) {
				seen = round; order = crew.slice().sort(function () { return Math.random() - 0.5; });
				for (n = 0; n < order.length; n++) { order[n].every = n < 3 ? 1.0 + n * 0.07 : 1.25 + (n - 3) * 0.13; order[n].at = clock + 0.3 + Math.random() * 1.6; }
			}
			for (n = 0; n < crew.length; n++) { c = crew[n]; if (clock >= c.at) { c.at = clock + c.every * K.rand(0.92, 1.1); K.say(c.name, command ? '!' + command : K.pick(['up', 'go go', 'climb!', 'hop'])); } }
		}, 60, 120);
	})();
	window.SSNCliffClimb = { state: function () { var best = summit[0] || leader(); return { climbers: [walls[0].list.length, walls[1].list.length], leader: best ? best.p.name : null, top: best ? best.hops : 0, summited: summit.length, over: !!over, round: round }; } };
	K.loop(update, draw);
	K.start();
})();
