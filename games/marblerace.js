// Marble Race: chat types !play, each face becomes a marble, and the field races down a random obstacle course.
// Built for portrait (9:16). In a wide window the machine keeps its shape; place it with &align=left|center|right.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage({ w: 720, h: 1280 });
	// The window onto the course is VW x VH design units at (VX, VY). The course is VW wide in its own units and several windows tall.
	var DW = 720, DH = 1280, VX = 14, VY = 108, VW = 640, VH = 1160, MIDX = VX + VW / 2, RAILX = 686;
	var L = 16, R = 624, CX = 320, HL = 90, HR = 550, GATE = 432, MR = 21, G = 1650, STEP = 1 / 120, VMAX = 1250, CELL = 96;
	var REST = 0.42, FRIC = 0.008, RACE_MAX = 80, CHEER = 8;
	var MEDAL = ['#ffd43b', '#cfd8ea', '#e8a56b'], CAMW = [0.55, 0.3, 0.15];
	var TINTS = [['#17223f', '#0f1830'], ['#1c2145', '#121634'], ['#13293d', '#0c1c2c'], ['#231f44', '#161330'], ['#162a44', '#0d1b30']];
	var HOT = ['#ff9f43', '#38d9a9', '#4dabf7', '#f783ac'];
	var command = K.word('command', 'play').replace(/^!/, '');
	var lobbySecs = K.demo && !K.params.has('lobby') ? 6 : K.num('lobby', 25, 10, 120);
	var maxMarbles = Math.round(K.num('max', 60, 10, 100));
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	var segs = [], pegs = [], wheels = [], sections = [], grid = [], pgrid = [], gate = [null, null], worldH = VH, finY = 0;
	var marbles = [], rank = [], pending = [], queue = [], taken = {}, podium = [], joined = 0;
	var slots = [0, 1, 2].map(function () { return { p: null, m: null, t: 9, name: '', size: 24, glow: 0 }; }), slotT = 0;
	var phase = 'idle', clock = 0, acc = 0, slow = 1, slowUsed = 0, lobbyEnd = 0, raceT = 0, finished = 0, decided = 0, winner = null, cheerEnd = 0, cheerNext = 0;
	var cam = 0, camV = 0, leadV = 0, tour = 0, fade = 0, fading = 0, gateA = 0, spawnT = 0, leader = null, streak = null, flash = 0, frame = null, sparkBudget = 0, go = 0, veil = 0, repaintT = 0, warm = K.layer(1, 1, function () {}).getContext('2d');

	// ---- Course ----
	function row(y) { return Math.max(0, Math.floor((y + 960) / CELL)); }
	function seg(x1, y1, x2, y2, t, look) {
		var s = { x1: x1, y1: y1, dx: x2 - x1, dy: y2 - y1, l2: 1, t: t, look: look === undefined ? 1 : look, on: true };
		s.l2 = s.dx * s.dx + s.dy * s.dy || 1;
		segs.push(s);
		return s;
	}
	function peg(x, y, r, kick, color) { pegs.push({ x: x, y: y, r: r, kick: kick || 0, color: color || '', hit: 0 }); }
	// A short ramp on a wall that turns a marble back into the field. dir is 1 on a left-hand wall, -1 on a right-hand one.
	function wedge(x, y, dir) { seg(x, y - 36, x + dir * 46, y + 4, 6); }
	function shuffle(a) { for (var i = a.length - 1, j, t; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

	// Each piece adds its walls at height y and returns how tall it is. Every surface is tilted, every gap is well clear of
	// a marble's width and nothing comes within 44 units of the piece's top or bottom, so any order is safe and nothing can rest.
	function hopper(y, sec) {
		seg(HL, -900, HL, 400, 6); seg(HR, -900, HR, 400, 6);
		seg(HL, 400, L, 470, 6); seg(HR, 400, R, 470, 6);
		gate[0] = seg(HL, 388, CX - 2, GATE, 6, 0); gate[1] = seg(HR, 388, CX + 2, GATE, 6, 0);
		sec.plates.push([0, 0, HL, 0, HL, 400, L, 470, 0, 470], [VW, 0, HR, 0, HR, 400, R, 470, VW, 470]);
		return 480;
	}
	function zig(y, sec) {
		var n = 3 + (Math.random() < 0.5 ? 1 : 0), side = Math.random() < 0.5 ? 0 : 1, rise = K.rand(108, 128), i, yy, a, b;
		for (i = 0; i < n; i++) {
			yy = y + 50 + i * 172;
			if ((i + side) % 2) { a = R; b = R - 430; } else { a = L; b = L + 430; }
			seg(a, yy, b, yy + rise, 7);
			sec.plates.push([a, yy + 4, a + (b - a) * 0.3, yy + rise * 0.3 + 4, a, yy + rise * 0.3 + 78]);
		}
		return 60 + n * 172;
	}
	function pegField(y) {
		var rows = 6 + Math.floor(Math.random() * 2), col = (R - L) / 6, r, i, yy;
		for (r = 0; r < rows; r++) {
			yy = y + 60 + r * 84;
			if (r % 2 === 0) for (i = 1; i <= 5; i++) peg(L + col * i, yy, 10);
			else {
				for (i = 1; i <= 4; i++) peg(L + col * (i + 0.5), yy, 10);
				wedge(L, yy, 1); wedge(R, yy, -1);
			}
		}
		return 60 + rows * 84;
	}
	function wheelBank(y) {
		var flip = Math.random() < 0.5, dir = Math.random() < 0.5 ? 1 : -1, sp = K.rand(1.7, 2.3), color = K.pick(HOT), ya = y + (flip ? 400 : 150), yb = y + (flip ? 150 : 400);
		wheels.push({ x: 176, y: ya, len: 104, w: dir * sp, a: Math.random() * 6.2832, color: color });
		wheels.push({ x: 464, y: ya, len: 104, w: -dir * sp, a: Math.random() * 6.2832, color: color });
		wheels.push({ x: CX, y: yb, len: 104, w: (Math.random() < 0.5 ? 1 : -1) * sp * 1.15, a: Math.random() * 6.2832, color: color });
		return 550;
	}
	function funnel(y, sec) {
		var a = CX - 80, b = CX + 80, y1 = y + 44, y2 = y + 290;
		seg(L, y1, a, y2, 7); seg(R, y1, b, y2, 7);
		seg(L, y2 + 14, a, y2, 5, 0); seg(R, y2 + 14, b, y2, 5, 0);
		sec.plates.push([L, y1, a, y2, L, y2 + 14], [R, y1, b, y2, R, y2 + 14]);
		// A roof under the mouth spreads the stream back out.
		seg(CX, y + 384, CX - 116, y + 456, 7); seg(CX, y + 384, CX + 116, y + 456, 7);
		seg(CX - 116, y + 456, CX + 116, y + 456, 5, 0);
		sec.plates.push([CX, y + 384, CX - 116, y + 456, CX + 116, y + 456]);
		return 510;
	}
	function bumperBank(y) {
		var flip = Math.random() < 0.5, color = K.pick(['#ff6b6b', '#f783ac', '#9775fa']), ya = y + 110, yb = y + 250, yc = y + 390;
		if (flip) { peg(CX, ya, 34, 460, color); peg(176, yb, 34, 460, color); peg(464, yb, 34, 460, color); peg(CX, yc, 34, 460, color); wedge(L, ya, 1); wedge(R, ya, -1); wedge(L, yc, 1); wedge(R, yc, -1); }
		else { peg(176, ya, 34, 460, color); peg(464, ya, 34, 460, color); peg(CX, yb, 34, 460, color); peg(176, yc, 34, 460, color); peg(464, yc, 34, 460, color); wedge(L, yb, 1); wedge(R, yb, -1); }
		return 480;
	}
	function split(y) {
		var m = Math.random() < 0.5 ? 1 : -1, wallA = m > 0 ? L : R, wallB = m > 0 ? R : L, divA = CX - 7 * m, divB = CX + 7 * m, i, yy;
		seg(CX, y + 56, CX, y + 566, 7);
		// Side A: four ledges to hop down. Side B: a tight peg lane.
		for (i = 0; i < 4; i++) {
			yy = y + 96 + i * 120;
			if (i % 2) seg(divA, yy, divA - m * 160, yy + 46, 6); else seg(wallA, yy, wallA + m * 160, yy + 46, 6);
		}
		for (i = 0; i < 6; i++) {
			yy = y + 110 + i * 78;
			if (i % 2) { peg(divB + m * 148.5, yy, 10); wedge(divB, yy, m); wedge(wallB, yy, -m); }
			else { peg(divB + m * 99, yy, 10); peg(divB + m * 198, yy, 10); }
		}
		return 620;
	}
	function chute(y, sec) {
		var m = Math.random() < 0.5;
		function X(x) { return m ? VW - x : x; }
		// A long collector feeds a covered slide to the far wall, and a last ramp turns the stream back.
		seg(X(R), y + 44, X(166), y + 215, 7);
		seg(X(166), y + 215, X(166), y + 262, 7);
		seg(X(166), y + 262, X(500), y + 420, 7);
		seg(X(500), y + 420, X(500), y + 92, 6, 0);
		seg(X(L), y + 350, X(444), y + 552, 7);
		seg(X(R), y + 610, X(424), y + 690, 7);
		sec.plates.push([X(500), y + 90, X(166), y + 215, X(166), y + 262, X(500), y + 420]);
		sec.plates.push([X(L), y + 354, X(230), y + 455, X(L), y + 520]);
		return 740;
	}
	function finish(y) {
		finY = y + 210;
		seg(L, finY + 322, CX, finY + 340, 6); seg(R, finY + 322, CX, finY + 340, 6);
		return 570;
	}
	var MAKERS = { zig: zig, pegs: pegField, wheels: wheelBank, funnel: funnel, bumpers: bumperBank, split: split, chute: chute };

	function build() {
		var y = 0, last = '', goal = VH * 5.2, pool, n, s, p, a, b, r;
		function add(type, make) {
			var sec = { type: type, i: sections.length, y: y, h: 0, s0: segs.length, p0: pegs.length, s1: 0, p1: 0, plates: [], layer: null, ls: 0, py: 0, ph: 0 };
			sec.h = make(y, sec); sec.s1 = segs.length; sec.p1 = pegs.length;
			sections.push(sec); y += sec.h; last = type;
		}
		for (n = 0; n < sections.length; n++) if (sections[n].layer) sections[n].layer.width = sections[n].layer.height = 0;
		segs = []; pegs = []; wheels = []; sections = [];
		add('hopper', hopper);
		while (y < goal) {
			pool = shuffle(Object.keys(MAKERS));
			for (n = 0; n < pool.length && y < goal; n++) if (pool[n] !== last) add(pool[n], MAKERS[pool[n]]);
		}
		add('finish', finish);
		worldH = y;
		// Broad phase for the walls: each wall is listed in every band of height a marble could touch it from.
		grid = []; pgrid = [];
		for (n = 0; n < segs.length; n++) {
			s = segs[n]; a = row(Math.min(s.y1, s.y1 + s.dy) - s.t - MR - 6); b = row(Math.max(s.y1, s.y1 + s.dy) + s.t + MR + 6);
			for (r = a; r <= b; r++) (grid[r] || (grid[r] = [])).push(s);
		}
		for (n = 0; n < pegs.length; n++) {
			p = pegs[n]; a = row(p.y - p.r - MR - 6); b = row(p.y + p.r + MR + 6);
			for (r = a; r <= b; r++) (pgrid[r] || (pgrid[r] = [])).push(p);
		}
		for (n = 0; n < 3; n++) paint(sections[n], layerScale());
	}

	// ---- Painting: every section is drawn once into its own layer ----
	function layerScale() { return K.clamp(st.k, 0.4, 1.6); }
	function poly(g, pts, ox, oy) {
		g.beginPath();
		for (var n = 0; n < pts.length; n += 2) g.lineTo(pts[n] + ox, pts[n + 1] + oy);
		g.closePath();
	}
	function steel(g, x1, y1, x2, y2) {
		var grad = g.createLinearGradient(x1, y1, x2, y2);
		grad.addColorStop(0, '#f3f6ff'); grad.addColorStop(0.3, '#aeb9d6'); grad.addColorStop(0.7, '#6a7799'); grad.addColorStop(1, '#39435f');
		return grad;
	}
	function line(g, s, ox, oy) { g.beginPath(); g.moveTo(s.x1 + ox, s.y1 + oy); g.lineTo(s.x1 + s.dx + ox, s.y1 + s.dy + oy); g.stroke(); }
	function railArt(g, s) {
		var len = Math.sqrt(s.l2), nx = -s.dy / len, ny = s.dx / len, t = s.t;
		// The normal that faces the light: up, or left for an upright rail.
		if (ny > 0.001 || (Math.abs(ny) <= 0.001 && nx > 0)) { nx = -nx; ny = -ny; }
		g.strokeStyle = '#080c18'; g.lineWidth = t * 2 + 4; line(g, s, 0, 0);
		g.strokeStyle = steel(g, s.x1 + nx * t, s.y1 + ny * t, s.x1 - nx * t, s.y1 - ny * t); g.lineWidth = t * 2; line(g, s, 0, 0);
		g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1.4, t * 0.3); line(g, s, nx * t * 0.42, ny * t * 0.42);
	}
	function bolt(g, x, y, r) {
		g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fillStyle = '#dfe6f5'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#080c18'; g.stroke();
		g.beginPath(); g.arc(x, y, r * 0.42, 0, 6.2832); g.fillStyle = '#59647f'; g.fill();
	}
	function plateArt(g, pts) {
		var n, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, grad, x, d;
		for (n = 0; n < pts.length; n += 2) { minX = Math.min(minX, pts[n]); maxX = Math.max(maxX, pts[n]); minY = Math.min(minY, pts[n + 1]); maxY = Math.max(maxY, pts[n + 1]); }
		grad = g.createLinearGradient(0, minY, 0, maxY); grad.addColorStop(0, '#2f3c66'); grad.addColorStop(1, '#1a2342');
		poly(g, pts, 0, 0); g.fillStyle = grad; g.fill();
		g.save(); g.clip();
		d = maxY - minY; g.strokeStyle = 'rgba(255,255,255,.04)'; g.lineWidth = 6; g.beginPath();
		for (x = minX - d; x < maxX; x += 20) { g.moveTo(x, maxY); g.lineTo(x + d, minY); }
		g.stroke(); g.restore();
		poly(g, pts, 0, 0); g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.09)'; g.stroke();
	}
	function paint(sec, ls) {
		var py = Math.round(sec.y * ls), ph = Math.max(1, Math.round((sec.y + sec.h) * ls) - py), old = sec.layer;
		sec.layer = K.layer(Math.round(VW * ls), ph, function (g) {
			var tint = TINTS[sec.i % TINTS.length], y0 = sec.y, h = sec.h, grad, x, y, n, s, p, sq;
			g.setTransform(ls, 0, 0, ls, 0, -py);
			grad = g.createLinearGradient(0, y0, 0, y0 + h); grad.addColorStop(0, tint[0]); grad.addColorStop(1, tint[1]);
			g.fillStyle = grad; g.fillRect(0, y0 - 1, VW, h + 2);
			// A perforated back plate, and faint chevrons that point the way down.
			g.beginPath();
			for (y = Math.ceil((y0 - 3) / 34) * 34; y < y0 + h + 3; y += 34) for (x = 34 + (Math.round(y / 34) % 2) * 17; x < VW - 20; x += 34) { g.moveTo(x + 2.4, y); g.arc(x, y, 2.4, 0, 6.2832); }
			g.fillStyle = 'rgba(0,0,0,.24)'; g.fill();
			g.lineWidth = 14; g.lineJoin = 'miter'; g.strokeStyle = 'rgba(255,255,255,.03)'; g.beginPath();
			for (y = Math.ceil((y0 - 40) / 240) * 240; y < y0 + h + 40; y += 240) { g.moveTo(CX - 64, y - 20); g.lineTo(CX, y + 20); g.lineTo(CX + 64, y - 20); }
			g.stroke();
			// Panel seams, and a pool of light in the middle of the section so the back wall is not flat
			for (y = Math.ceil((y0 - 3) / 170) * 170; y < y0 + h + 3; y += 170) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(L, y, R - L, 2); g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(L, y + 2, R - L, 1.5); }
			grad = g.createRadialGradient(CX, y0 + h * 0.5, 20, CX, y0 + h * 0.5, Math.max(330, h * 0.62));
			grad.addColorStop(0, 'rgba(150,175,255,.15)'); grad.addColorStop(0.6, 'rgba(150,175,255,.05)'); grad.addColorStop(1, 'rgba(150,175,255,0)');
			g.fillStyle = grad; g.fillRect(0, y0, VW, h);
			if (sec.i) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(L, y0, R - L, 3); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(L, y0 + 3, R - L, 1.5); }
			grad = g.createLinearGradient(L, 0, L + 64, 0); grad.addColorStop(0, 'rgba(0,0,0,.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(L, y0 - 1, 64, h + 2);
			grad = g.createLinearGradient(R, 0, R - 64, 0); grad.addColorStop(0, 'rgba(0,0,0,.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(R - 64, y0 - 1, 64, h + 2);
			if (sec.type === 'finish') {
				sq = (R - L) / 32;
				grad = g.createLinearGradient(0, finY, 0, finY + 340); grad.addColorStop(0, 'rgba(255,212,59,.2)'); grad.addColorStop(0.3, 'rgba(255,212,59,.05)'); grad.addColorStop(1, 'rgba(255,212,59,0)');
				g.fillStyle = grad; g.fillRect(L, finY, R - L, 345);
				g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(L, finY - sq + 7, R - L, sq * 2 + 4);
				for (y = 0; y < 2; y++) for (x = 0; x < 32; x++) { g.fillStyle = (x + y) % 2 ? '#f2f5fb' : '#141a2c'; g.fillRect(L + x * sq, finY - sq + y * sq, sq + 0.4, sq + 0.4); }
				g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(L, finY - sq, R - L, sq * 0.55);
				g.lineWidth = 2; g.strokeStyle = '#080c18'; g.strokeRect(L, finY - sq, R - L, sq * 2);
			}
			// Side walls
			grad = g.createLinearGradient(0, 0, L, 0); grad.addColorStop(0, '#232c47'); grad.addColorStop(0.35, '#8fa0c8'); grad.addColorStop(0.62, '#56658c'); grad.addColorStop(1, '#1b2238');
			g.fillStyle = grad; g.fillRect(0, y0 - 1, L, h + 2);
			grad = g.createLinearGradient(VW, 0, R, 0); grad.addColorStop(0, '#232c47'); grad.addColorStop(0.35, '#8fa0c8'); grad.addColorStop(0.62, '#56658c'); grad.addColorStop(1, '#1b2238');
			g.fillStyle = grad; g.fillRect(R, y0 - 1, VW - R, h + 2);
			for (y = Math.ceil((y0 - 4) / 116) * 116; y < y0 + h + 4; y += 116) { bolt(g, L / 2, y, 3.2); bolt(g, VW - L / 2, y, 3.2); }
			if (sec.type === 'finish') for (x = 0; x < 2; x++) {
				// Gold posts hold the two ends of the finish band
				K.rr(g, x ? R : -2, finY - 34, L + 2, 68, 6); g.fillStyle = '#ffd43b'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#080c18'; g.stroke();
				g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x ? R + 4 : 4, finY - 28, 4, 56);
			}
			// Solid plates, then rails and pegs, each over its own soft shadow
			for (n = 0; n < sec.plates.length; n++) { poly(g, sec.plates[n], 5, 9); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill(); }
			for (n = 0; n < sec.plates.length; n++) plateArt(g, sec.plates[n]);
			if (sec.type === 'hopper') {
				grad = g.createLinearGradient(0, 0, 0, GATE); grad.addColorStop(0, 'rgba(140,195,255,.2)'); grad.addColorStop(1, 'rgba(140,195,255,.06)');
				poly(g, [HL, 0, HR, 0, HR, 388, CX, GATE, HL, 388], 0, 0); g.fillStyle = grad; g.fill();
				for (n = 0; n < 5; n++) for (x = 0; x < 2; x++) {
					g.beginPath(); g.arc(x ? VW - 53 : 53, 84 + n * 62, 10, 0, 6.2832); g.fillStyle = '#070a14'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.14)'; g.stroke();
				}
			}
			g.lineCap = 'round';
			for (n = sec.s0; n < sec.s1; n++) {
				s = segs[n]; if (s.look !== 1) continue;
				g.strokeStyle = 'rgba(0,0,0,.13)';
				for (x = 0; x < 3; x++) { g.lineWidth = s.t * 2 + 12 - x * 5; line(g, s, 5, 9); }
			}
			for (n = sec.p0; n < sec.p1; n++) {
				p = pegs[n]; g.fillStyle = 'rgba(0,0,0,.16)';
				for (x = 0; x < 3; x++) { g.beginPath(); g.arc(p.x + 4, p.y + 8, p.r + 5 - x * 2.5, 0, 6.2832); g.fill(); }
			}
			for (n = sec.s0; n < sec.s1; n++) if (segs[n].look === 1) railArt(g, segs[n]);
			for (n = sec.s0; n < sec.s1; n++) { s = segs[n]; if (s.look === 1 && s.y1 >= 0) { bolt(g, s.x1, s.y1, s.t * 0.5); bolt(g, s.x1 + s.dx, s.y1 + s.dy, s.t * 0.5); } }
			for (n = sec.p0; n < sec.p1; n++) {
				p = pegs[n]; if (p.kick) continue;
				grad = g.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, 0.5, p.x, p.y, p.r);
				grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, '#b8c3dd'); grad.addColorStop(1, '#56617f');
				g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.2832); g.fillStyle = grad; g.fill(); g.lineWidth = 2; g.strokeStyle = '#080c18'; g.stroke();
			}
		});
		sec.ls = ls; sec.py = py; sec.ph = ph;
		// Browsers put off the real painting of a canvas until it is first used. Use it now, so that cost lands here and
		// not as a dropped frame when the section first scrolls into the race.
		warm.drawImage(sec.layer, 0, 0, 1, 1, 0, 0, 1, 1);
		if (old) old.width = old.height = 0;
	}
	// Layers are painted a few a second, the ones in view first, so neither a new course nor a change of resolution hands a
	// struggling machine a burst of work. Until its turn, a layer at the old resolution keeps working (scaled).
	function inView(sec) { return sec.y + sec.h > cam && sec.y < cam + VH; }
	function layers(dt) {
		var ls = layerScale(), todo = null, n, sec;
		repaintT -= dt;
		for (n = 0; n < sections.length; n++) {
			sec = sections[n];
			if (sec.layer && sec.ls === ls) continue;
			if (!sec.layer && inView(sec)) { paint(sec, ls); return; }
			if (!todo || (!inView(todo) && inView(sec))) todo = sec;
		}
		if (todo && repaintT <= 0) { paint(todo, ls); repaintT = 0.35; }
	}
	function paintFrame() {
		frame = K.layer(st.canvas.width, st.canvas.height, function (g, w, h) {
			var grad, n;
			g.scale(w / DW, h / DH);
			K.rr(g, 2, 2, DW - 4, DH - 4, 30);
			grad = g.createLinearGradient(0, 0, 0, DH); grad.addColorStop(0, '#1b2542'); grad.addColorStop(1, '#0c1222');
			g.fillStyle = grad; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.14)'; g.stroke();
			// The recess around the window, lit along its lower edge
			g.fillStyle = '#05080f'; g.fillRect(VX - 5, VY - 5, VW + 10, VH + 10);
			g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(VX - 5, VY + VH + 5, VW + 10, 2);
			g.clearRect(VX + 3, VY + 3, VW - 6, VH - 6);
			// Progress rail: a slot with the finish flag at the bottom
			K.rr(g, RAILX - 13, VY + 6, 26, VH - 12, 13); g.fillStyle = '#05080f'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.1)'; g.stroke();
			for (n = 0; n < 8; n++) { g.fillStyle = (n + (n >> 2)) % 2 ? '#f2f5fb' : '#2a3350'; g.fillRect(RAILX - 10 + (n % 4) * 5, VY + VH - 24 + (n >> 2) * 5, 5, 5); }
			g.beginPath(); g.moveTo(RAILX - 7, VY + 16); g.lineTo(RAILX + 7, VY + 16); g.lineTo(RAILX, VY + 27); g.closePath(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
		});
	}
	st.onresize = function () { frame = null; };

	function wheelSprite(color) {
		return K.sprite('mr:wheel:' + color, 348, 348, function (g, w) {
			var c = w / 2, s = w / 232, pass, k, grad, cs, sn;
			g.lineCap = 'round';
			// Paddles: a dark edge, the colour, a darker core and a light stripe, so they read as solid bars at any angle.
			for (pass = 0; pass < 4; pass++) for (k = 0; k < 4; k++) {
				cs = Math.cos(k * 1.5708); sn = Math.sin(k * 1.5708);
				g.strokeStyle = pass === 0 ? '#080c18' : pass === 1 ? color : pass === 2 ? 'rgba(10,14,30,.22)' : 'rgba(255,255,255,.6)'; g.lineWidth = [21, 16, 7, 3][pass] * s;
				g.beginPath(); g.moveTo(c + cs * (pass > 1 ? 34 : 0) * s, c + sn * (pass > 1 ? 34 : 0) * s);
				g.lineTo(c + cs * (pass > 1 ? 100 : 104) * s, c + sn * (pass > 1 ? 100 : 104) * s); g.stroke();
			}
			g.beginPath(); g.arc(c, c, 29 * s, 0, 6.2832); g.fillStyle = color; g.fill(); g.lineWidth = 3 * s; g.strokeStyle = '#080c18'; g.stroke();
			grad = g.createRadialGradient(c - 6 * s, c - 7 * s, 1, c, c, 21 * s);
			grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.55, '#b8c3dd'); grad.addColorStop(1, '#4b5674');
			g.beginPath(); g.arc(c, c, 19 * s, 0, 6.2832); g.fillStyle = grad; g.fill(); g.lineWidth = 2.5 * s; g.strokeStyle = '#080c18'; g.stroke();
			g.beginPath(); g.arc(c, c, 6 * s, 0, 6.2832); g.fillStyle = '#39435f'; g.fill();
		});
	}
	function wheelShadow() {
		return K.sprite('mr:wheelshade', 174, 174, function (g, w) {
			var c = w / 2, s = w / 232, k;
			g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.34)'; g.lineWidth = 25 * s; g.beginPath();
			for (k = 0; k < 4; k++) { g.moveTo(c, c); g.lineTo(c + Math.cos(k * 1.5708) * 104 * s, c + Math.sin(k * 1.5708) * 104 * s); }
			g.stroke();
		});
	}
	function bumperSprite(color) {
		return K.sprite('mr:bumper:' + color, 144, 144, function (g, w) {
			var c = w / 2, grad;
			g.beginPath(); g.arc(c, c, 66, 0, 6.2832); g.fillStyle = color; g.fill(); g.lineWidth = 5; g.strokeStyle = '#080c18'; g.stroke();
			g.beginPath(); g.arc(c, c, 58, 3.5, 5.2); g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
			grad = g.createRadialGradient(c - 14, c - 16, 2, c, c, 46);
			grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.6, '#c9d3ea'); grad.addColorStop(1, '#6c7896');
			g.beginPath(); g.arc(c, c, 44, 0, 6.2832); g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.strokeStyle = '#080c18'; g.stroke();
			K.star(g, c, c + 2, 25, color);
		});
	}
	function flapSprite() {
		return K.sprite('mr:flap', 520, 44, function (g, w, h) {
			g.lineCap = 'round';
			g.strokeStyle = '#080c18'; g.lineWidth = 34; g.beginPath(); g.moveTo(22, 22); g.lineTo(w - 22, 22); g.stroke();
			g.strokeStyle = steel(g, 0, 8, 0, 36); g.lineWidth = 26; g.beginPath(); g.moveTo(22, 22); g.lineTo(w - 22, 22); g.stroke();
			g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(26, 15); g.lineTo(w - 26, 15); g.stroke();
			bolt(g, 22, 22, 8);
		});
	}
	function rays() {
		return K.sprite('mr:rays', 512, 512, function (g) {
			var n, grad = g.createRadialGradient(256, 256, 30, 256, 256, 256);
			grad.addColorStop(0, 'rgba(255,224,102,.75)'); grad.addColorStop(1, 'rgba(255,224,102,0)');
			g.fillStyle = grad;
			for (n = 0; n < 12; n++) { g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 256, n * 0.5236, n * 0.5236 + 0.2618); g.closePath(); g.fill(); }
		});
	}

	// ---- Physics: fixed steps, circles against rounded rails, pegs, paddles and each other ----
	function bounce(m, nx, ny, svx, svy, rest, kick) {
		var vn = (m.vx - svx) * nx + (m.vy - svy) * ny, vt, out;
		if (vn >= 0) return 0;
		if (kick && vn < -50) { out = Math.max(-vn * rest, kick); m.vx += (out - vn) * nx; m.vy += (out - vn) * ny; }
		else { out = vn < -110 ? rest : 0; m.vx -= (1 + out) * vn * nx; m.vy -= (1 + out) * vn * ny; }
		// A little friction along the surface, and the roll that goes with it.
		vt = (m.vy - svy) * nx - (m.vx - svx) * ny;
		m.vx += vt * FRIC * ny; m.vy -= vt * FRIC * nx;
		m.spin += ((m.vy * nx - m.vx * ny) / MR - m.spin) * 0.3;
		if (vn < -540 && sparkBudget > 0 && phase === 'race') { sparkBudget--; K.fx.spark(m.x - nx * MR, m.y - ny * MR, '#ffe9b0', 4, 280, 4, 0.32); }
		return vn;
	}
	function hitLine(m, x1, y1, dx, dy, l2, t, wh) {
		var u = ((m.x - x1) * dx + (m.y - y1) * dy) / l2, px, py, nx, ny, d2, d, min = MR + t;
		u = u < 0 ? 0 : u > 1 ? 1 : u;
		px = x1 + dx * u; py = y1 + dy * u; nx = m.x - px; ny = m.y - py; d2 = nx * nx + ny * ny;
		if (d2 >= min * min) return;
		if (d2 < 0.0001) { nx = 0; ny = -1; } else { d = Math.sqrt(d2); nx /= d; ny /= d; }
		m.x = px + nx * min; m.y = py + ny * min; m.hits |= 1;
		// A paddle carries the marble with the speed of the spot that touched it.
		if (wh) bounce(m, nx, ny, -wh.w * (py - wh.y), wh.w * (px - wh.x), 0.3);
		else bounce(m, nx, ny, 0, 0, REST);
	}
	function hitPeg(m, p) {
		var nx = m.x - p.x, ny = m.y - p.y, d2 = nx * nx + ny * ny, min = MR + p.r, d, vn;
		if (d2 >= min * min) return;
		if (d2 < 0.0001) { nx = 0; ny = -1; } else { d = Math.sqrt(d2); nx /= d; ny /= d; }
		m.x = p.x + nx * min; m.y = p.y + ny * min; m.hits |= 1;
		vn = bounce(m, nx, ny, 0, 0, p.kick ? 0.7 : 0.5, p.kick);
		if (vn < -140) p.hit = 1;
		if (p.kick && vn < -50 && sparkBudget > 0) { sparkBudget--; K.fx.spark(p.x + nx * p.r, p.y + ny * p.r, '#fff0f0', 5, 340, 4, 0.35); }
	}
	function walls(m) {
		var list = grid[row(m.y)], n, s, w, k, c, d;
		if (list) for (n = 0; n < list.length; n++) { s = list[n]; if (s.on) hitLine(m, s.x1, s.y1, s.dx, s.dy, s.l2, s.t, null); }
		list = pgrid[row(m.y)];
		if (list) for (n = 0; n < list.length; n++) hitPeg(m, list[n]);
		for (n = 0; n < wheels.length; n++) {
			w = wheels[n];
			if (m.y < w.y - 132 || m.y > w.y + 132 || m.x < w.x - 132 || m.x > w.x + 132) continue;
			for (k = 0; k < 4; k++) { c = Math.cos(w.a + k * 1.5708) * w.len; d = Math.sin(w.a + k * 1.5708) * w.len; hitLine(m, w.x, w.y, c, d, w.len * w.len, 8, w); }
		}
		// The outer walls are absolute: whatever the pile does, nothing leaves the course.
		if (m.x < L + MR) { m.x = L + MR; if (m.vx < 0) m.vx *= -0.4; }
		else if (m.x > R - MR) { m.x = R - MR; if (m.vx > 0) m.vx *= -0.4; }
	}
	function cross(m) {
		m.place = ++finished;
		if (m.place <= 3 && !decided) {
			if (!K.calm) flash = 1;
			K.fx.pop(String(m.place), m.x, finY - 46, MEDAL[m.place - 1], 70);
			K.fx.spark(m.x, finY, MEDAL[m.place - 1], 22, 520, 6, 0.7);
			if (m.place === 1) K.shake(st, 9);
		}
	}
	function physics(h) {
		var count = marbles.length, rounds = phase === 'lobby' ? 4 : 2, n, i, j, it, m, a, b, dx, dy, d2, d, nx, ny, push, vn, e, sp, reach = MR * 2;
		for (n = 0; n < wheels.length; n++) wheels[n].a += wheels[n].w * h;
		for (n = 0; n < count; n++) {
			m = marbles[n];
			m.px = m.x; m.py = m.y; m.hits = 0;
			m.vy += G * h;
			sp = m.vx * m.vx + m.vy * m.vy;
			if (sp > VMAX * VMAX) { sp = VMAX / Math.sqrt(sp); m.vx *= sp; m.vy *= sp; }
			m.x += m.vx * h; m.y += m.vy * h; m.rot += m.spin * h; m.spin *= 1 - 1.2 * h;
		}
		// Broad phase for the marbles: kept in height order (nearly sorted already, so this is cheap), each one is only
		// tested against the few that follow it within a marble's height.
		for (i = 1; i < count; i++) {
			m = marbles[i];
			for (j = i - 1; j >= 0 && marbles[j].y > m.y; j--) marbles[j + 1] = marbles[j];
			marbles[j + 1] = m;
		}
		for (it = 0; it < rounds; it++) {
			for (i = 0; i < count; i++) {
				a = marbles[i];
				for (j = i + 1; j < count; j++) {
					b = marbles[j]; dy = b.y - a.y;
					if (dy > reach + 6) break;
					dx = b.x - a.x;
					if (dx > reach || dx < -reach) continue;
					d2 = dx * dx + dy * dy;
					if (d2 >= reach * reach) continue;
					if (d2 < 0.0001) { nx = 1; ny = 0; d = 0; } else { d = Math.sqrt(d2); nx = dx / d; ny = dy / d; }
					push = (reach - d) * 0.5;
					a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; a.hits |= 2; b.hits |= 2;
					vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
					if (vn < 0) {
						e = vn < -130 ? 0.32 : 0; vn *= -(1 + e) * 0.5;
						a.vx -= vn * nx; a.vy -= vn * ny; b.vx += vn * nx; b.vy += vn * ny;
					}
				}
			}
			// Walls go last, so they always win against a pushing pile.
			for (n = 0; n < count; n++) walls(marbles[n]);
		}
		// In a pile, speed that led nowhere is dropped: a slow marble pressed against others keeps only the motion it
		// really made this step. That is what lets a full hopper, or a queue at a ramp, lie still instead of sinking.
		for (n = 0; n < count; n++) {
			m = marbles[n];
			if (!(m.hits & 2)) continue;
			sp = m.vx * m.vx + m.vy * m.vy;
			if (sp > 62500) continue;
			dx = (m.x - m.px) / h; dy = (m.y - m.py) / h;
			if (dx * dx + dy * dy < sp) { m.vx = dx; m.vy = dy; }
		}
		if (phase === 'race' || phase === 'results') for (n = count - 1; n >= 0; n--) if (!marbles[n].place && marbles[n].y > finY) cross(marbles[n]);
	}

	// ---- Rounds ----
	function spawn(p, up) {
		var m = { p: p, name: K.short(p.name, 10), x: K.rand(HL + 44, HR - 44), y: -30 - up * 48, vx: K.rand(-70, 70), vy: K.rand(240, 420), rot: Math.random() * 6.2832, spin: K.rand(-7, 7), place: 0, px: 0, py: 0, hits: 0, ax: 0, ay: 0, still: 0, best: 0, stale: 0, nudges: 0, born: clock, rx: K.rand(-6, 6) };
		marbles.push(m); rank.push(m);
	}
	function openLobby() {
		phase = 'lobby'; lobbyEnd = clock + lobbySecs; joined = 0; spawnT = 0;
		while (queue.length && joined < maxMarbles) { pending.push(queue.shift()); joined++; }
	}
	function startRace() {
		var n, m;
		for (n = 0; n < pending.length; n++) spawn(pending[n], 1 + Math.floor(n / 8));
		pending.length = 0;
		gate[0].on = gate[1].on = false;
		phase = 'race'; raceT = 0; slowUsed = 0; finished = 0; decided = 0; leader = null; go = 1.6;
		for (n = 0; n < marbles.length; n++) { m = marbles[n]; m.ax = m.x; m.ay = m.y; m.best = m.y; m.still = 0; m.stale = 0; }
		K.shake(st, 6);
		K.fx.spark(CX, GATE, '#ffe9b0', 26, 620, 6, 0.6);
	}
	function byRank(a, b) { return a.place && b.place ? a.place - b.place : a.place ? -1 : b.place ? 1 : b.y - a.y; }
	// The race is decided by the first three over the line, or by progress if the clock runs out first.
	function decide() {
		var all = [], n;
		rank.sort(byRank);
		podium = [];
		for (n = 0; n < rank.length; n++) { all.push(rank[n].p); if (n < 3) podium.push(rank[n].p); }
		decided = clock; winner = podium[0].name;
		K.awardRound(podium, all);
	}
	function reset() {
		var n;
		for (n = 0; n < marbles.length; n++) delete taken[marbles[n].p.key];
		marbles = []; rank = []; finished = 0; decided = 0; winner = null; leader = null; streak = null; joined = 0; raceT = 0; slow = 1; flash = 0;
		K.fx.bits.length = 0; K.fx.sparks.length = 0; K.fx.labels.length = 0;
		build();
		cam = 0; camV = 0; leadV = 0; tour = 0; phase = 'idle';
		if (queue.length) openLobby();
	}

	K.onChat(function (msg) {
		var p = msg.player;
		if (msg.cmd !== command || taken[p.key]) return;
		if (phase === 'idle') openLobby();
		// Anyone who types while a race is on waits for the next one.
		if (phase === 'lobby' && joined < maxMarbles) {
			taken[p.key] = 1; pending.push(p); joined++;
			if (joined >= maxMarbles) lobbyEnd = Math.min(lobbyEnd, clock + 3);
		} else if (queue.length < 300) { taken[p.key] = 1; queue.push(p); }
	});

	function damp(target, time, dt) {
		var omega = 2 / time, x = omega * dt, decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), change = cam - target, temp = (camV + omega * change) * dt;
		camV = (camV - omega * temp) * decay;
		cam = target + (change + temp) * decay;
	}
	function update(dt) {
		var steps = 0, want = 1, sdt, n, m, e, p, f, wsum, yy, target = 0, dx, dy, power, span, live, same;
		clock += dt;
		sparkBudget = 5;
		layers(dt);
		// A close finish plays its last moment in slow motion.
		if (phase === 'race' && !finished && rank.length > 1 && slowUsed < 1.2 && rank[0].y > finY - 230 && rank[0].y - rank[1].y < 150) { want = 0.3; slowUsed += dt; }
		slow = K.approach(slow, want, 12, dt);
		sdt = dt * slow;
		acc += sdt;
		while (acc >= STEP && steps < 6) { physics(STEP); acc -= STEP; steps++; }
		if (acc >= STEP) acc = 0;
		// A marble that has come to rest rights itself, so the faces waiting in the hopper and lying at the finish can be
		// read (and an upright ball is the cheapest kind to draw).
		for (n = 0; n < marbles.length; n++) {
			m = marbles[n];
			if (!m.rot || m.vx * m.vx + m.vy * m.vy > 2500) continue;
			m.rot %= 6.2832; m.spin = 0;
			if (m.rot > 3.1416) m.rot -= 6.2832; else if (m.rot < -3.1416) m.rot += 6.2832;
			m.rot = Math.abs(m.rot) < 0.02 ? 0 : K.approach(m.rot, 0, 5, dt);
		}

		if (phase === 'lobby') {
			spawnT -= dt;
			while (pending.length && spawnT <= 0) { spawn(pending.shift(), 0); spawnT += 0.06; }
			if (!pending.length && spawnT < 0) spawnT = 0;
			if (clock >= lobbyEnd) startRace();
		} else if (phase === 'race') {
			raceT += sdt;
			// Nothing may sit still: a marble that has barely moved, or made no headway, gets a growing nudge. One held up
			// in a queue of others is only waiting its turn, and is given longer.
			for (n = 0; n < marbles.length; n++) {
				m = marbles[n];
				if (m.place) continue;
				dx = m.x - m.ax; dy = m.y - m.ay;
				if (dx * dx + dy * dy > 576) { m.ax = m.x; m.ay = m.y; m.still = 0; } else m.still += sdt;
				if (m.y > m.best + 40) { m.best = m.y; m.stale = 0; m.nudges = 0; } else m.stale += sdt;
				if (m.hits & 2 ? m.stale > 12 : m.still > 2 || m.stale > 7) {
					power = 1 + Math.min(2, m.nudges) * 0.5;
					m.vx += (Math.random() < 0.5 ? -1 : 1) * K.rand(140, 260) * power; m.vy -= K.rand(160, 300) * power;
					m.still = 0.9; m.stale = Math.min(m.stale, 4.5); m.nudges++;
				}
			}
			if (!decided) { if (marbles.length && (finished >= Math.min(3, marbles.length) || raceT > RACE_MAX)) decide(); }
			else if (clock > decided + 1.4) { phase = 'results'; cheerEnd = clock + CHEER; cheerNext = 0; }
		} else if (phase === 'results' && !fading) {
			if (clock > cheerNext) { cheerNext = clock + 0.42; K.fx.burst(K.rand(90, 550), cam + K.rand(160, 600), null, 20, 520); }
			if (clock > cheerEnd) fading = 1;
		}
		// The curtain between races: the next course is built while the window is dark.
		if (fading === 1) { fade = Math.min(1, fade + dt * 3); if (fade >= 1) { reset(); fading = 2; } }
		else if (fading === 2) { fade = Math.max(0, fade - dt * 2.5); if (fade <= 0) fading = 0; }

		if (!decided) rank.sort(byRank);
		if (phase === 'race' && !finished && rank.length) {
			m = rank[0];
			if (!leader) leader = m;
			else if (m !== leader && m.y > leader.y + 12) { leader = m; if (raceT > 2.5 && !K.calm) { streak = { m: m, t: 0 }; slots[0].glow = 1; } }
		}
		// Standings: the three chips change together, and only once a new order has held for a moment, so they never flicker.
		live = phase === 'race' && !decided;
		for (n = 0, same = true; n < 3; n++) if ((live ? (rank[n] ? rank[n].p : null) : podium[n] || null) !== slots[n].p) same = false;
		slotT = same ? 0 : slotT + dt;
		for (n = 0; n < 3; n++) {
			e = slots[n]; p = live ? (rank[n] ? rank[n].p : null) : podium[n] || null;
			if (p !== e.p && (slotT > 0.18 || !live)) { e.p = p; e.t = 0; e.size = 24; e.name = p ? K.short(p.name, 9) : ''; }
			e.m = live && rank[n] && rank[n].p === e.p ? rank[n] : live ? e.m : null;
			e.t += dt; e.glow = Math.max(0, e.glow - dt * 1.6);
		}

		// Camera: follows the leading pack, and settles on the finish as they reach it.
		if (phase === 'race' || phase === 'results') {
			f = 0; wsum = 0;
			for (n = 0; n < 3 && n < rank.length; n++) { yy = rank[n].place ? finY + 40 : Math.min(rank[n].y, finY + 40); f += yy * CAMW[n]; wsum += CAMW[n]; }
			if (wsum) {
				// The further the pack is strung out, the more the camera belongs to the leader; it also looks a little
				// ahead of a fast one, so a runaway never slips out of the bottom of the window.
				m = rank[0]; yy = m.place ? finY + 40 : Math.min(m.y, finY + 40);
				f /= wsum; f += (yy - f) * K.clamp((yy - f) / (VH * 0.5), 0, 1);
				leadV = K.approach(leadV, m.place ? 0 : K.clamp(m.vy, 0, 900), 2.4, dt);
				target = f - VH * 0.45 + leadV * 0.16;
			}
		} else if (phase === 'idle') {
			// With nobody playing the camera tours the course.
			tour += dt; f = (tour % 64) / 64; span = worldH - VH;
			target = f < 0.08 ? 0 : f < 0.74 ? span * K.ease((f - 0.08) / 0.66) : f < 0.8 ? span : span * (1 - K.ease((f - 0.8) / 0.2));
		}
		damp(K.clamp(target, 0, worldH - VH), phase === 'race' ? 0.28 : 0.5, dt);

		gateA = K.approach(gateA, gate[0].on ? 0 : 1, 14, dt);
		veil = K.approach(veil, phase === 'lobby' ? 0.5 : 0, 5, dt);
		for (n = 0; n < pegs.length; n++) if (pegs[n].hit > 0) pegs[n].hit = Math.max(0, pegs[n].hit - dt * 4);
		if (flash > 0) flash = Math.max(0, flash - dt * 3);
		if (go > 0) go -= dt;
		if (streak) { streak.t += dt; if (streak.t > 0.6) streak = null; }
		K.fx.update(sdt);
	}

	// ---- Drawing ----
	function ledLevel(n) {
		var left;
		if (go > 0) return 1;
		if (phase === 'lobby') {
			left = lobbyEnd - clock;
			if (left < 3) return K.calm || (clock * 4) % 1 < 0.5 ? 1 : 0.12;
			return Math.floor(clock * (4 + 8 * (1 - left / lobbySecs))) % 5 === n ? 1 : 0.12;
		}
		if (phase === 'idle') return 0.3 + 0.3 * Math.sin(clock * 2 - n * 0.9);
		return 0.12;
	}
	function world(ctx) {
		var top = cam - 60, bot = cam + VH + 60, n, p, w, m, s, a, c;
		if (flash > 0.02 && finY < bot) {
			ctx.globalAlpha = flash * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(L, finY - 19, R - L, 38); ctx.globalAlpha = 1;
			K.glow(ctx, CX, finY, 330, '#ffe9b0', flash * 0.5, true);
		}
		for (n = 0; n < pegs.length; n++) {
			p = pegs[n];
			if (p.y < top || p.y > bot) continue;
			if (p.kick) {
				s = (p.r + 3) * (1 + p.hit * 0.14);
				if (p.hit > 0.03) K.glow(ctx, p.x, p.y, 84, p.color, p.hit * 0.9, true);
				ctx.drawImage(bumperSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
			} else if (p.hit > 0.03) {
				K.glow(ctx, p.x, p.y, 34, '#ffe066', p.hit, true);
				ctx.globalAlpha = p.hit; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + p.hit * 2.5, 0, 6.2832); ctx.fillStyle = '#fff3bf'; ctx.fill(); ctx.globalAlpha = 1;
			}
		}
		for (n = 0; n < wheels.length; n++) {
			w = wheels[n];
			if (w.y < top - 80 || w.y > bot + 80) continue;
			ctx.save(); ctx.translate(w.x + 5, w.y + 9); ctx.rotate(w.a); ctx.drawImage(wheelShadow(), -116, -116, 232, 232); ctx.restore();
			ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a); ctx.drawImage(wheelSprite(w.color), -116, -116, 232, 232); ctx.restore();
		}
		// While the hopper fills, the course below waits in the dark.
		if (veil > 0.01) { ctx.globalAlpha = veil; ctx.fillStyle = '#05070f'; ctx.fillRect(0, 480, VW, Math.max(0, cam + VH - 480)); ctx.globalAlpha = 1; }
		if (cam < 520) {
			// The hopper: status lights down both sides and the two gate flaps, which swing away at the start.
			c = go > 0 ? '#69db7c' : phase === 'idle' ? '#4dabf7' : '#ffd43b';
			for (n = 0; n < 5; n++) {
				a = ledLevel(n);
				ctx.globalAlpha = a; ctx.fillStyle = c;
				ctx.beginPath(); ctx.arc(53, 84 + n * 62, 6.5, 0, 6.2832); ctx.arc(VW - 53, 84 + n * 62, 6.5, 0, 6.2832); ctx.fill();
				ctx.globalAlpha = 1;
				if (a > 0.5) { K.glow(ctx, 53, 84 + n * 62, 24, c, a * 0.7, true); K.glow(ctx, VW - 53, 84 + n * 62, 24, c, a * 0.7, true); }
			}
			a = K.lerp(0.1906, 1.42, K.back(gateA));
			ctx.save(); ctx.translate(HL, 388); ctx.rotate(a); ctx.drawImage(flapSprite(), -10.6, -10.6, 250, 21.2); ctx.restore();
			ctx.save(); ctx.translate(HR, 388); ctx.scale(-1, 1); ctx.rotate(a); ctx.drawImage(flapSprite(), -10.6, -10.6, 250, 21.2); ctx.restore();
		}
		for (n = 0; n < marbles.length; n++) { m = marbles[n]; if (m.y > top && m.y < bot) K.shadow(ctx, m.x + 5, m.y + 9, MR * 1.3, MR * 1.3, 0.55); }
		if (leader && phase === 'race' && !decided) K.glow(ctx, leader.x, leader.y, MR * 2.3, '#ffd43b', 0.6);
		for (n = 0; n < marbles.length; n++) { m = marbles[n]; if (m.y > top && m.y < bot) K.ball(ctx, m.p, m.x, m.y, MR, m.rot); }
		if (streak) {
			m = streak.m; a = 1 - streak.t / 0.6;
			ctx.save(); ctx.translate(m.x, m.y); ctx.scale(0.2, 1); K.glow(ctx, 0, -80, 170, '#fff3bf', a, true); ctx.restore();
			K.glow(ctx, m.x, m.y, 64, '#ffd43b', a * 0.8, true);
		}
		if (phase === 'race') {
			for (n = Math.min(3, rank.length) - 1; n >= 0; n--) { m = rank[n]; if (!m.place) K.label(ctx, m.name, m.x, m.y - MR - 15, 21, n ? '#ffffff' : '#ffe066'); }
		} else if (phase === 'lobby') {
			// Each new arrival wears its name for a moment.
			for (n = marbles.length - 1, c = 0; n >= 0 && c < 14; n--) {
				m = marbles[n]; a = clock - m.born;
				if (a < 1.8 && m.y > 20) { c++; ctx.globalAlpha = K.clamp((1.8 - a) * 3, 0, 1); K.label(ctx, m.name, m.x, m.y - MR - 15, 21, '#ffffff'); }
			}
			ctx.globalAlpha = 1;
		}
		K.fx.draw(ctx);
		if (cam < 440) {
			// Reflections on the hopper's glass front
			ctx.fillStyle = 'rgba(255,255,255,.055)';
			ctx.beginPath(); ctx.moveTo(HL + 96, 0); ctx.lineTo(HL + 170, 0); ctx.lineTo(HL + 62, 384); ctx.lineTo(HL + 8, 384); ctx.closePath(); ctx.fill();
			ctx.beginPath(); ctx.moveTo(HL + 200, 0); ctx.lineTo(HL + 226, 0); ctx.lineTo(HL + 128, 396); ctx.lineTo(HL + 104, 392); ctx.closePath(); ctx.fill();
		}
	}
	function results(ctx) {
		var t = clock - (cheerEnd - CHEER), a = K.ease(t * 2.2), b = K.back(t * 1.7), bob = Math.sin(clock * 2.4) * 6, n, p, x, s, r;
		ctx.globalAlpha = a * 0.76; ctx.fillStyle = '#070a14'; ctx.fillRect(VX, VY, VW, VH); ctx.globalAlpha = 1;
		p = podium[0];
		if (!p) return;
		ctx.save(); ctx.translate(MIDX, 500); ctx.rotate(clock * 0.3); ctx.globalAlpha = a * 0.6; ctx.drawImage(rays(), -340, -340, 680, 680); ctx.restore();
		ctx.globalAlpha = 1;
		K.glow(ctx, MIDX, 500, 290, '#ffd43b', a * 0.4);
		r = 148 * b;
		K.shadow(ctx, MIDX, 500 + bob + r * 1.02, r * 0.9, r * 0.2, 0.5 * a);
		K.bigFace(ctx, p, MIDX, 500 + bob, r);
		K.crown(ctx, MIDX, 500 + bob - r + 16 * b, 64 * b);
		ctx.globalAlpha = K.clamp(t * 3 - 0.6, 0, 1);
		K.label(ctx, K.short(p.name, 14), MIDX, 712, 58, '#ffe066');
		ctx.globalAlpha = 1;
		for (n = 1; n < podium.length; n++) {
			p = podium[n]; x = MIDX + (n === 1 ? -150 : 150); s = t - 0.35 - n * 0.2;
			if (s <= 0.02) continue;
			s = K.back(s * 2.2);
			K.shadow(ctx, x, 900 + 76 * s, 62 * s, 14 * s, 0.45);
			K.bigFace(ctx, p, x, 900, 72 * s);
			ctx.beginPath(); ctx.arc(x + 52 * s, 900 + 52 * s, 24 * s, 0, 6.2832); ctx.fillStyle = MEDAL[n]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
			K.text(ctx, String(n + 1), x + 52 * s, 900 + 53 * s, 30 * s, '#1a2033', 'center', false);
			ctx.globalAlpha = K.clamp(s * 2 - 0.8, 0, 1);
			K.label(ctx, K.short(p.name, 10), x, 1004, 32, '#ffffff');
			ctx.globalAlpha = 1;
		}
	}
	function chip(ctx, n) {
		var e = slots[n], x = 14 + n * 234, y = 14, w = 224, h = 80, live = phase === 'race' && !decided, s, m, got;
		if (e.glow > 0.02) K.glow(ctx, x + w / 2, y + h / 2, 150, '#ffd43b', e.glow * 0.7, true);
		K.rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(5,8,15,.72)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();
		if (e.p) {
			s = K.back(e.t * 4.5);
			K.face(ctx, e.p, x + 40, y + 40, 31 * s);
			got = K.label(ctx, e.name, x + 84, live ? y + 29 : y + 40, e.size, '#ffffff', 'left');
			if (got > 124) e.size = Math.max(13, e.size * 124 / got);
			if (live) { m = e.m; if (m) K.bar(ctx, x + 84, y + 49, 122, 13, m.place ? 1 : K.clamp((m.y - GATE) / (finY - GATE), 0, 1), MEDAL[n]); }
			else if (n === 0) K.crown(ctx, x + 40, y + 13, 15);
		} else { ctx.beginPath(); ctx.arc(x + 40, y + 40, 28, 0, 6.2832); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke(); }
		ctx.beginPath(); ctx.arc(x + 63, y + 60, 13, 0, 6.2832); ctx.fillStyle = MEDAL[n]; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
		K.text(ctx, String(n + 1), x + 63, y + 61, 18, '#1a2033', 'center', false);
	}
	function hud(ctx) {
		var n, m, a, left, x, y, w, shown, label = '!' + command;
		for (n = 0; n < 3; n++) chip(ctx, n);
		// Progress rail: the whole field as tiny faces, leaders drawn last so they sit on top.
		a = Math.max(1, finY - GATE);
		for (n = rank.length - 1; n >= 0; n--) {
			m = rank[n]; y = VY + 44 + (m.place ? 1 : K.clamp((m.y - GATE) / a, 0, 1)) * (VH - 84);
			K.face(ctx, m.p, RAILX + (n < 3 ? 0 : m.rx), y, n < 3 && phase === 'race' ? 12 : 9);
		}
		if (phase === 'idle') {
			K.bubble(ctx, MIDX, 720, 1.2, clock);
			K.hint(ctx, label, MIDX, 800, 36);
		} else if (phase === 'lobby') {
			left = Math.max(0, lobbyEnd - clock); n = Math.ceil(left - 1e-6);
			ctx.beginPath(); ctx.arc(MIDX, 640, 100, 0, 6.2832); ctx.fillStyle = 'rgba(8,11,22,.8)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
			K.ring(ctx, MIDX, 640, 80, left / lobbySecs, left < 3 ? '#ff8787' : '#ffe066', 14);
			K.text(ctx, String(n), MIDX, 644, 86 * (1 + Math.max(0, 1 - (n - left) * 5) * 0.2), '#ffffff');
			K.hint(ctx, label, MIDX, 800, 36);
		} else {
			// During a race the prompt shrinks into a corner, with the faces already waiting for the next one.
			shown = Math.min(queue.length, 7);
			ctx.font = K.font(22); w = ctx.measureText(label).width + 28;
			x = VX + 16; y = VY + VH - 62;
			if (shown) K.panel(ctx, x - 4, y - 4, w + shown * 32 + (queue.length > shown ? 58 : 12), 52, 26, 'rgba(8,11,22,.8)');
			K.hint(ctx, label, x + w / 2, y + 22, 22);
			for (n = 0; n < shown; n++) K.face(ctx, queue[n], x + w + 20 + n * 32, y + 22, 15);
			if (queue.length > shown) K.text(ctx, '+' + (queue.length - shown), x + w + 26 + shown * 32, y + 23, 22, '#ffe066');
		}
	}
	function draw() {
		var ctx = K.begin(st), k = st.k, tf = ctx.getTransform(), ox = Math.round(tf.e), oy = Math.round(tf.f);
		var X0 = ox + Math.round(VX * k), Y0 = oy + Math.round(VY * k), WP = Math.round(VW * k), HP = Math.round(VH * k), camPx = Math.round(cam * k), n, sec, a, b, t, l, r, fw, fh;
		// The course is blitted pixel for pixel: whole pixels for the window, the camera and every layer.
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.beginPath(); ctx.rect(X0, Y0, WP, HP); ctx.clip();
		for (n = 0; n < sections.length; n++) {
			sec = sections[n];
			if (sec.y + sec.h < cam - 2 || sec.y > cam + VH + 2) continue;
			if (!sec.layer) { ctx.fillStyle = '#0f1830'; ctx.fillRect(X0, Y0 + Math.floor(sec.y * k) - camPx, WP, Math.ceil(sec.h * k) + 1); }
			else if (sec.ls === k) {
				a = Math.max(0, camPx - sec.py); b = Math.min(sec.ph, camPx + HP - sec.py);
				if (b > a) ctx.drawImage(sec.layer, 0, a, sec.layer.width, b - a, X0, Y0 + sec.py + a - camPx, sec.layer.width, b - a);
			} else ctx.drawImage(sec.layer, X0, Y0 + sec.y * k - camPx, WP, sec.h * k);
		}
		ctx.setTransform(k, 0, 0, k, X0, Y0 - camPx);
		world(ctx);
		ctx.setTransform(k, 0, 0, k, ox, oy);
		if (phase === 'results') results(ctx);
		if (fade > 0.01) { ctx.globalAlpha = fade; ctx.fillStyle = '#070a14'; ctx.fillRect(VX, VY, VW, VH); ctx.globalAlpha = 1; }
		ctx.restore();
		// The cabinet around the window, drawn as four strips so the window itself is never painted twice.
		if (!frame || frame.width !== st.canvas.width || frame.height !== st.canvas.height) paintFrame();
		fw = frame.width; fh = frame.height;
		t = Math.round((VY + 3) * k); b = Math.round((VY + VH - 3) * k); l = Math.round((VX + 3) * k); r = Math.round((VX + VW - 3) * k);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(frame, 0, 0, fw, t, ox, oy, fw, t);
		ctx.drawImage(frame, 0, b, fw, fh - b, ox, oy + b, fw, fh - b);
		ctx.drawImage(frame, 0, t, l, b - t, ox, oy + t, l, b - t);
		ctx.drawImage(frame, r, t, fw - r, b - t, ox + r, oy + t, fw - r, b - t);
		ctx.setTransform(k, 0, 0, k, ox, oy);
		hud(ctx);
	}

	if (K.demo) (function () {
		// A crowd of 16 to 20 piles in as soon as the hopper opens, and a few latecomers queue during the race.
		var crowd = [], next = 0, size = 0, late = 0;
		K.every(function () {
			if (phase === 'idle' || (phase === 'lobby' && !size)) { crowd = shuffle(K.names.slice()); next = 0; size = 16 + Math.floor(Math.random() * 5); late = size + 3; }
			if ((phase === 'idle' || phase === 'lobby') && next < size) K.say(crowd[next++], '!' + command);
			else if (phase === 'race' && next < late && Math.random() < 0.05) K.say(crowd[next++], '!' + command);
			else if (phase === 'results') size = 0;
		}, 90, 240);
	})();
	window.SSNMarbleRace = { state: function () { return { phase: phase, marbles: phase === 'lobby' ? joined : marbles.length, queued: queue.length, finished: finished, winner: winner, secs: phase === 'lobby' ? Math.max(0, Math.ceil(lobbyEnd - clock - 1e-6)) : 0 }; } };
	build();
	K.loop(update, draw);
	K.start();
})();
