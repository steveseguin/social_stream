// Chat Aquarium: a calm break screen where every chatter is a fish wearing their own face. Chatting makes a fish dart and
// blow bubbles; a paid message drops food or a treasure chest and the whole tank rushes over. Fills any window shape.
(function () {
	'use strict';
	// &water=0: no tint, floor or plants, so the fish swim over whatever is behind the page.
	var K = window.SSNArcade, water = !/^(0|off|false|no)$/.test(K.word('water', '1')), st = K.stage();
	// The scenery is painted once (base). A copy carrying the slow things (light rays, plants, motes) is refreshed ten times a
	// second (back) and copied to the screen each frame. A fish that is level is stamped pixel for pixel. All of that is what
	// stays cheap when the processor does the painting.
	var base = document.createElement('canvas'), backC = document.createElement('canvas'), back = backC.getContext('2d');
	var u = 1, W = st.W, H = st.H, floorY = H;
	var MAX = 40, RB = 56, FR = 0.9, BW = Math.ceil(3.2 * RB), BH = Math.ceil(3.76 * RB), BX = 1.76 * RB, BY = 1.98 * RB, TW = 1.75 * RB, TH = 2.5 * RB, TX = 1.45 * RB, TY = 1.25 * RB;
	var GREENS = ['rgba(34,140,104,.95)', 'rgba(60,184,128,.95)', 'rgba(28,120,110,.95)', 'rgba(104,210,150,.95)'], FOOD = ['#ffb347', '#ff8c5a', '#ffd43b'], SMALL = ['#ffc078', '#99e9f2', '#ffe58a'];
	var idleSecs = K.num('idle', 10, 1, 120) * 60, mins = K.num('minutes', 0, 0, 600), endAt = mins > 0 ? Date.now() + mins * 60000 : 0;
	var fish = [], amb = [], byKey = {}, live = 0, bubbles = [], motes = [], pellets = [], drops = [], floats = [], ripples = [], blades = [], rocks = [], corals = [], vents = [], beams = [], dots = [];
	var tails = {}, tailCount = 0, glassC = null, chest = null, clock = 0, sizeK = 1.1, bakes = 0, slow = 0, refreshAt = 0, payAt = 7.5, payN = 0, dig = { c: document.createElement('canvas'), key: '' };
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	function mix(a, b, t) {
		var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
		return 'rgb(' + Math.round(K.lerp(x >> 16, y >> 16, t)) + ',' + Math.round(K.lerp(x >> 8 & 255, y >> 8 & 255, t)) + ',' + Math.round(K.lerp(x & 255, y & 255, t)) + ')';
	}

	// ---- Master art, each painted once ----
	// A fish facing right without its face or tail; the face sits at (BX, BY).
	function bodyArt(color) {
		return K.sprite('aq:body:' + color, BW, BH, function (g) {
			var grad, fin = mix(color, '#ffffff', 0.32), edge = mix(color, '#0a0e18', 0.52), n;
			g.translate(BX, BY); g.scale(RB, RB); g.lineJoin = 'round'; g.lineCap = 'round';
			g.fillStyle = fin; g.strokeStyle = edge; g.lineWidth = 0.055;
			g.beginPath(); g.moveTo(0.58, -0.94); g.quadraticCurveTo(0.16, -1.8, -0.62, -1.86); g.quadraticCurveTo(-0.94, -1.5, -1.16, -0.74); g.closePath(); g.fill(); g.stroke();
			g.beginPath(); g.moveTo(0.16, 1.0); g.quadraticCurveTo(-0.14, 1.62, -0.8, 1.64); g.quadraticCurveTo(-0.68, 1.28, -0.94, 0.84); g.closePath(); g.fill(); g.stroke();
			g.lineWidth = 0.03; g.globalAlpha = 0.4;
			for (n = 0; n < 4; n++) { g.beginPath(); g.moveTo(0.3 - n * 0.3, -1.05); g.lineTo(-0.02 - n * 0.3, -1.62 + n * 0.02); g.stroke(); }
			g.globalAlpha = 1;
			g.beginPath(); g.moveTo(1.22, 0.06); g.bezierCurveTo(1.15, -0.85, 0.35, -1.17, -0.25, -1.14); g.bezierCurveTo(-0.95, -1.08, -1.4, -0.5, -1.64, -0.17); g.lineTo(-1.64, 0.21);
			g.bezierCurveTo(-1.4, 0.55, -0.95, 1.1, -0.25, 1.15); g.bezierCurveTo(0.4, 1.18, 1.15, 0.92, 1.22, 0.06); g.closePath();
			grad = g.createLinearGradient(0, -1.15, 0, 1.15);
			grad.addColorStop(0, mix(color, '#0a1030', 0.26)); grad.addColorStop(0.45, color); grad.addColorStop(1, mix(color, '#ffffff', 0.45));
			g.fillStyle = grad; g.fill(); g.lineWidth = 0.06; g.stroke();
			g.beginPath(); g.ellipse(1.2, 0.1, 0.09, 0.15, 0, 0, 6.2832); g.fillStyle = mix(color, '#ffffff', 0.25); g.fill(); g.lineWidth = 0.045; g.stroke();
			g.globalAlpha = 0.4; g.lineWidth = 0.05; g.beginPath(); g.arc(-0.52, 0, 0.66, 2.45, 3.85); g.stroke(); g.globalAlpha = 1;
			g.beginPath(); g.moveTo(0.84, -0.79); g.quadraticCurveTo(0.2, -1.05, -0.72, -0.92); g.lineWidth = 0.09; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
		});
	}
	// The tail on its own, so it can beat. Its root is at (TX, TY).
	function tailArt(color) {
		return K.sprite('aq:tail:' + color, TW, TH, function (g) {
			var n;
			g.translate(TX, TY); g.scale(RB, RB); g.lineJoin = 'round'; g.lineCap = 'round';
			g.beginPath(); g.moveTo(0.2, -0.2); g.bezierCurveTo(-0.3, -0.35, -0.8, -1.12, -1.32, -1.08); g.quadraticCurveTo(-0.72, -0.4, -0.78, 0); g.quadraticCurveTo(-0.72, 0.4, -1.32, 1.08); g.bezierCurveTo(-0.8, 1.12, -0.3, 0.35, 0.2, 0.2); g.closePath();
			g.fillStyle = mix(color, '#ffffff', 0.32); g.fill(); g.lineWidth = 0.055; g.strokeStyle = mix(color, '#0a0e18', 0.52); g.stroke();
			g.lineWidth = 0.03; g.globalAlpha = 0.4;
			for (n = -2; n <= 2; n++) if (n) { g.beginPath(); g.moveTo(-0.16, n * 0.06); g.lineTo(-0.98, n * 0.37); g.stroke(); }
		});
	}
	// A glass dome over the face: a bright glint and a little shade at the rim, light enough to keep the face clear.
	function domeArt() {
		return K.sprite('aq:dome', 128, 128, function (g) {
			var grad;
			g.beginPath(); g.arc(64, 64, 60, 0, 6.2832); g.clip();
			grad = g.createRadialGradient(52, 46, 10, 64, 64, 64);
			grad.addColorStop(0, 'rgba(255,255,255,.12)'); grad.addColorStop(0.55, 'rgba(255,255,255,0)'); grad.addColorStop(0.86, 'rgba(6,10,34,.1)'); grad.addColorStop(1, 'rgba(6,10,34,.36)');
			g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
			grad = g.createRadialGradient(42, 32, 0, 42, 32, 24);
			grad.addColorStop(0, 'rgba(255,255,255,.95)'); grad.addColorStop(0.4, 'rgba(255,255,255,.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = grad; g.fillRect(10, 2, 68, 62);
			g.beginPath(); g.arc(64, 64, 53, 0.45, 1.7); g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.3)'; g.stroke();
		});
	}
	function smallArt(color) {
		return K.sprite('aq:small:' + color, 100, 60, function (g) {
			g.fillStyle = color; g.strokeStyle = 'rgba(10,14,24,.32)'; g.lineWidth = 2.5; g.lineJoin = 'round';
			g.beginPath(); g.moveTo(30, 30); g.lineTo(6, 10); g.quadraticCurveTo(15, 30, 6, 50); g.closePath(); g.fill(); g.stroke();
			g.beginPath(); g.moveTo(92, 31); g.bezierCurveTo(80, 10, 44, 8, 24, 30); g.bezierCurveTo(44, 52, 80, 50, 92, 31); g.closePath(); g.fill(); g.stroke();
			g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(60, 21, 16, 4.5, -0.08, 0, 6.2832); g.fill();
			g.fillStyle = '#0c1020'; g.beginPath(); g.arc(79, 27, 3.4, 0, 6.2832); g.fill();
		});
	}
	function bubbleArt() {
		return K.sprite('aq:bubble', 64, 64, function (g) {
			g.beginPath(); g.arc(32, 32, 27, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,.1)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.78)'; g.stroke();
			g.lineCap = 'round'; g.lineWidth = 4.5; g.strokeStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(32, 32, 18, 3.5, 4.4); g.stroke();
			g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(42, 43, 2.6, 0, 6.2832); g.fill();
		});
	}
	function pelletArt(n) {
		return K.sprite('aq:food:' + n, 32, 32, function (g) {
			var grad = g.createRadialGradient(12, 11, 1, 16, 16, 13);
			grad.addColorStop(0, '#fff7da'); grad.addColorStop(0.35, FOOD[n]); grad.addColorStop(1, mix(FOOD[n], '#5a2a08', 0.45));
			g.beginPath(); g.arc(16, 16, 13, 0, 6.2832); g.fillStyle = grad; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(60,28,6,.5)'; g.stroke();
		});
	}
	function glassArt() {
		return K.sprite('aq:glass', 264, 264, function (g) {
			var grad = g.createRadialGradient(132, 118, 20, 132, 132, 120);
			grad.addColorStop(0, 'rgba(20,42,72,.58)'); grad.addColorStop(0.8, 'rgba(10,26,52,.7)'); grad.addColorStop(1, 'rgba(150,232,255,.55)');
			g.beginPath(); g.arc(132, 132, 119, 0, 6.2832); g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.72)'; g.stroke();
			g.lineCap = 'round'; g.lineWidth = 9; g.strokeStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(132, 132, 99, 3.55, 4.3); g.stroke();
			g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(132, 132, 101, 0.45, 1.05); g.stroke();
		});
	}
	// The treasure chest, shut and open. Its base sits near the bottom edge at x = 110.
	function chestArt(open) {
		return K.sprite('aq:chest:' + open, 220, 200, function (g) {
			var grad, n, x;
			function straps(top, bottom) {
				for (n = 0; n < 2; n++) { x = n ? 150 : 52; g.fillStyle = '#ffd43b'; g.fillRect(x, top, 18, bottom - top); g.strokeStyle = '#a8760c'; g.lineWidth = 2.5; g.strokeRect(x, top, 18, bottom - top); }
			}
			g.lineJoin = 'round';
			if (open) {
				g.beginPath(); g.moveTo(34, 84); g.bezierCurveTo(34, 8, 186, 8, 186, 84); g.closePath();
				g.fillStyle = '#3b1d0b'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#ffd43b'; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#a8760c'; g.stroke();
				for (n = 0; n < 15; n++) {
					x = 50 + (n * 53 % 120);
					g.beginPath(); g.arc(x, 102 - (n * 29 % 30) - Math.sin((x - 50) / 120 * 3.1416) * 12, 13, 0, 6.2832); g.fillStyle = n % 4 === 3 ? '#ffe98a' : '#ffd43b'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#b8860b'; g.stroke();
				}
				g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(84, 62); g.lineTo(96, 74); g.lineTo(84, 88); g.lineTo(72, 74); g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = '#8f1f2a'; g.stroke();
				g.fillStyle = '#66d9e8'; g.beginPath(); g.moveTo(140, 58); g.lineTo(151, 69); g.lineTo(140, 82); g.lineTo(129, 69); g.closePath(); g.fill(); g.strokeStyle = '#0b7285'; g.stroke();
			} else {
				g.beginPath(); g.moveTo(26, 110); g.lineTo(26, 86); g.bezierCurveTo(26, 40, 194, 40, 194, 86); g.lineTo(194, 110); g.closePath();
				grad = g.createLinearGradient(0, 44, 0, 110); grad.addColorStop(0, '#c98342'); grad.addColorStop(1, '#8a4a1f');
				g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.strokeStyle = '#3b1d0a'; g.stroke();
				g.save(); g.clip(); straps(40, 112); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(26, 44, 168, 16); g.restore();
			}
			K.rr(g, 30, 104, 160, 88, 10);
			grad = g.createLinearGradient(0, 104, 0, 192); grad.addColorStop(0, '#a8642f'); grad.addColorStop(1, '#663414');
			g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.strokeStyle = '#3b1d0a'; g.stroke();
			g.strokeStyle = 'rgba(40,18,4,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 134); g.lineTo(186, 134); g.moveTo(34, 162); g.lineTo(186, 162); g.stroke();
			straps(106, 190);
			K.rr(g, 24, 100, 172, 15, 6); g.fillStyle = '#ffd43b'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#a8760c'; g.stroke();
			K.rr(g, 97, 108, 26, 32, 7); g.fillStyle = '#ffe066'; g.fill(); g.stroke();
			g.fillStyle = '#3b1d0a'; g.beginPath(); g.arc(110, 120, 4.5, 0, 6.2832); g.fill(); g.fillRect(108.2, 121, 3.6, 10);
		});
	}

	// ---- Art at screen size, for stamping ----
	// One chatter's fish for one direction, R screen pixels to the face's edge: body, face under its dome, a crown for members.
	function bake(f, left, R) {
		var s = R / RB, c = document.createElement('canvas'), g = c.getContext('2d'), x = Math.round((left ? BW - BX : BX) * s) + 1, y = Math.round(BY * s) + 1;
		c.width = Math.ceil(BW * s) + 2; c.height = Math.ceil(BH * s) + 2;
		g.save(); g.translate(x, y); g.scale(left ? -s : s, s); g.drawImage(bodyArt(f.p.color), -BX, -BY); g.restore();
		K.face(g, f.p, x, y, FR * R); g.drawImage(domeArt(), x - FR * R, y - FR * R, FR * R * 2, FR * R * 2);
		if (f.gold) K.crown(g, x, y - FR * R * 0.9, R * 0.36);
		return { c: c, x: x, y: y };
	}
	// One of seven frames of a beating tail, shared by every fish of that colour and size. (x, y) is the tail's root.
	function tailFrame(color, R, left, i) {
		var key = color + R + (left ? 'L' : 'R') + i, t = tails[key], s = R / RB, wag = (i - 3) / 3, c, g;
		if (t) return t;
		if (tailCount > 640) { tails = {}; tailCount = 0; }
		c = document.createElement('canvas'); c.width = Math.ceil(1.75 * R) + 2; c.height = Math.ceil(2.9 * R) + 2; g = c.getContext('2d');
		t = tails[key] = { c: c, x: left ? Math.round(0.22 * R) + 1 : c.width - Math.round(0.22 * R) - 1, y: Math.round(c.height / 2) };
		g.translate(t.x, t.y); g.scale(left ? -s : s, s); g.rotate(wag * 0.42); g.scale(1 - Math.abs(wag) * 0.18, 1);
		g.drawImage(tailArt(color), -TX, -TY);
		tailCount++;
		return t;
	}
	function chestBake(c) {
		var q = u * c.s * 0.92 * st.k, w = Math.ceil(220 * q), h = Math.ceil(200 * q), pad = Math.round(80 * q);
		c.w = w; c.h = h; c.pad = pad;
		c.art = [K.layer(w, h, function (g) { g.drawImage(chestArt(0), 0, 0, w, h); }), K.layer(w + pad * 2, h + pad * 2, function (g) { K.glow(g, pad + w / 2, pad + h * 0.46, w * 0.5 + pad, K.gold, 0.55); g.drawImage(chestArt(1), pad, pad, w, h); })];
	}

	// ---- The tank ----
	function sandY(x) { return floorY + (Math.sin(x / W * 9.4 + 0.6) * 9 + Math.sin(x / W * 23 + 2) * 4) * u; }
	function rock(g, o) {
		var x = o.x, b = floorY + 30 * u, w = o.w, h = o.h, grad;
		g.beginPath(); g.moveTo(x - w / 2, b); g.bezierCurveTo(x - w * 0.56, b - h * 0.7, x - w * 0.3, b - h * 1.05, x - w * 0.02, b - h); g.bezierCurveTo(x + w * 0.24, b - h * 0.98, x + w * 0.52, b - h * 0.62, x + w / 2, b); g.closePath();
		grad = g.createLinearGradient(0, b - h, 0, b); grad.addColorStop(0, '#98a5bf'); grad.addColorStop(1, '#3a4460');
		g.fillStyle = grad; g.fill(); g.lineWidth = 2.5 * u; g.strokeStyle = 'rgba(10,14,24,.38)'; g.stroke();
		g.save(); g.clip();
		g.beginPath(); g.ellipse(x - w * 0.16, b - h * 0.8, w * 0.26, h * 0.2, -0.3, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();
		g.beginPath(); g.ellipse(x + w * 0.22, b - h * 0.18, w * 0.42, h * 0.32, 0.2, 0, 6.2832); g.fillStyle = 'rgba(16,22,44,.22)'; g.fill();
		g.restore();
	}
	// A branching coral: every branch is one fat round-ended stroke, drawn dark first for an outline.
	function coral(g, o) {
		var pass;
		function branch(x, y, len, ang, w, depth, id) {
			var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, h = K.hash(o.c + id);
			g.lineWidth = w + (pass ? 0 : 5 * u); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
			if (depth > 0) { branch(x2, y2, len * (0.66 + h * 0.14), ang - 0.34 - h * 0.3, w * 0.76, depth - 1, id + 'a'); branch(x2, y2, len * (0.8 - h * 0.14), ang + 0.3 + h * 0.32, w * 0.76, depth - 1, id + 'b'); }
			else if (pass) { g.beginPath(); g.arc(x2 - w * 0.12, y2 - w * 0.1, w * 0.22, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill(); }
		}
		g.lineCap = 'round';
		for (pass = 0; pass < 2; pass++) { g.strokeStyle = pass ? o.c : mix(o.c, '#0a0e18', 0.5); branch(o.x, floorY + 24 * u, o.h * 0.36, -1.5708 + o.tilt, o.h * 0.15, 3, ''); }
	}
	// Everything that never moves: the water's depth, the surface, far ridges, corals, rocks and the sand.
	function paintBase() {
		var g = base.getContext('2d'), grad, n, x, y, tall = H > W ? 1.5 : 1;
		g.setTransform(st.k, 0, 0, st.k, 0, 0);
		grad = g.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, 'rgba(96,216,218,.36)'); grad.addColorStop(0.38, 'rgba(28,138,182,.47)'); grad.addColorStop(1, 'rgba(8,38,92,.62)');
		g.fillStyle = grad; g.fillRect(0, 0, W, H);
		// The surface, seen from below: a bright rim and a ripple line.
		grad = g.createLinearGradient(0, 0, 0, 170 * u); grad.addColorStop(0, 'rgba(232,255,250,.46)'); grad.addColorStop(0.25, 'rgba(232,255,250,.22)'); grad.addColorStop(0.6, 'rgba(232,255,250,.06)'); grad.addColorStop(1, 'rgba(232,255,250,0)');
		g.fillStyle = grad; g.fillRect(0, 0, W, 170 * u);
		g.beginPath(); for (x = -10; x <= W + 20 * u; x += 16 * u) g.lineTo(x, (15 + Math.sin(x / (62 * u)) * 4 + Math.sin(x / (23 * u) + 1) * 2) * u);
		g.lineWidth = 3 * u; g.strokeStyle = 'rgba(255,255,255,.42)'; g.stroke();
		// Two ridges far behind give the tank some depth.
		for (n = 0; n < 2; n++) {
			g.beginPath(); g.moveTo(0, H);
			for (x = 0; x <= W + 30 * u; x += 30 * u) g.lineTo(x, floorY - ((n ? 30 : 84) + Math.sin(x / W * (n ? 7.7 : 5.2) + (n ? 4 : 1.3)) * (n ? 34 : 56) + Math.sin(x / W * 14 + n) * 18) * u * tall);
			g.lineTo(W, H); g.closePath(); g.fillStyle = n ? 'rgba(6,38,76,.3)' : 'rgba(8,52,92,.24)'; g.fill();
		}
		for (n = 0; n < corals.length; n++) coral(g, corals[n]);
		for (n = 0; n < rocks.length; n++) rock(g, rocks[n]);
		g.beginPath(); g.moveTo(0, H); for (x = 0; x <= W + 16 * u; x += 16 * u) g.lineTo(x, sandY(x)); g.lineTo(W, H); g.closePath();
		grad = g.createLinearGradient(0, floorY - 14 * u, 0, H); grad.addColorStop(0, 'rgba(246,229,180,.97)'); grad.addColorStop(1, 'rgba(186,152,94,.97)');
		g.fillStyle = grad; g.fill();
		g.beginPath(); for (x = 0; x <= W + 16 * u; x += 16 * u) g.lineTo(x, sandY(x) + 2 * u); g.lineWidth = 4 * u; g.strokeStyle = 'rgba(255,248,220,.75)'; g.stroke();
		for (n = 0; n < 110; n++) {
			x = K.hash('sx' + n) * W; y = sandY(x) + (12 + K.hash('sy' + n) * 86) * u;
			g.beginPath(); g.ellipse(x, y, (2 + K.hash('sr' + n) * 4) * u, (1.5 + K.hash('sr' + n) * 2) * u, 0, 0, 6.2832); g.fillStyle = n % 3 ? 'rgba(150,114,62,.45)' : 'rgba(255,251,232,.7)'; g.fill();
		}
		K.star(g, W * 0.42, floorY + 52 * u, 22 * u, '#ff8787', 0.5);
		for (n = 0; n < 5; n++) { x = (0.12 + n * 0.19) * W; g.beginPath(); g.ellipse(x, sandY(x) + (34 + n % 2 * 22) * u, (13 + n % 3 * 5) * u, 8 * u, 0, 0, 6.2832); g.fillStyle = n % 2 ? '#8792aa' : '#6b7690'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = 'rgba(10,14,24,.3)'; g.stroke(); }
	}
	// Shafts of light from the surface: two soft-edged shapes, a wide and a narrow one, reused across the tank.
	function buildBeams() {
		var k = st.k, deep = Math.round((H > W ? 0.6 : 0.86) * H * k), slant = deep * 0.22, count = Math.max(4, Math.round(W / u / 330)), arts = [], n, wide, w0, x0, c, g, grad, pass, ww;
		for (wide = 0; wide < 2; wide++) {
			w0 = (wide ? 40 : 22) * u * k; x0 = w0 * 2.2 + 2;
			c = document.createElement('canvas'); c.width = Math.ceil(slant + w0 * 4.4) + 4; c.height = deep; g = c.getContext('2d');
			grad = g.createLinearGradient(0, 0, 0, deep); grad.addColorStop(0, 'rgba(222,255,246,.056)'); grad.addColorStop(0.5, 'rgba(222,255,246,.022)'); grad.addColorStop(1, 'rgba(222,255,246,0)');
			g.fillStyle = grad;
			for (pass = 0; pass < 8; pass++) { ww = w0 * (1 - pass * 0.11); g.beginPath(); g.moveTo(x0 - ww, 0); g.lineTo(x0 + ww, 0); g.lineTo(x0 + slant + ww * 2.2, deep); g.lineTo(x0 + slant - ww * 2.2, deep); g.closePath(); g.fill(); }
			arts.push(c);
		}
		beams = [];
		for (n = 0; n < count; n++) beams.push({ c: arts[(n + 1) % 2], x: (n + 0.05 + K.hash('ray' + n) * 0.6) / count * W - 150 * u, w: 0.2 + K.hash('rw' + n) * 0.25, ph: K.hash('rp' + n) * 6.28 });
	}
	function drawBlades(ctx, front) {
		var n, b, s1, s2, tx, ty, ax, ay, bx, by;
		ctx.lineCap = 'round';
		for (n = 0; n < blades.length; n++) {
			b = blades[n]; if (b.front !== front) continue;
			// Each blade bends in a slow S: the tip trails behind the middle.
			s1 = Math.sin(clock * b.w + b.ph); s2 = Math.sin(clock * b.w + b.ph - 1.2);
			tx = b.x + b.lean + s2 * b.sway; ty = b.y - b.h;
			ax = b.x - b.lean * 0.3 + s1 * b.sway * 0.25; ay = b.y - b.h * 0.38; bx = b.x + b.lean * 0.7 + s1 * b.sway * 0.75; by = b.y - b.h * 0.74;
			ctx.beginPath(); ctx.moveTo(b.x - b.wd, b.y); ctx.bezierCurveTo(ax - b.wd * 1.25, ay, bx - b.wd * 0.85, by, tx, ty); ctx.bezierCurveTo(bx + b.wd * 0.85, by, ax + b.wd * 1.25, ay, b.x + b.wd, b.y); ctx.closePath();
			ctx.fillStyle = b.color; ctx.fill();
			ctx.beginPath(); ctx.moveTo(b.x, b.y - b.h * 0.06); ctx.bezierCurveTo(ax, ay, bx, by, tx, ty + b.h * 0.08); ctx.lineWidth = b.wd * 0.24; ctx.strokeStyle = 'rgba(220,255,230,.28)'; ctx.stroke();
		}
	}
	// The slow layer: scenery, then light rays fading and drifting, motes, and the plants behind the fish.
	function refresh() {
		var k = st.k, n, o;
		back.setTransform(1, 0, 0, 1, 0, 0); back.globalAlpha = 1;
		back.globalCompositeOperation = 'copy'; back.drawImage(base, 0, 0); back.globalCompositeOperation = 'source-over';
		for (n = 0; n < beams.length; n++) {
			o = beams[n];
			back.globalAlpha = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(clock * o.w + o.ph));
			back.drawImage(o.c, Math.round((o.x + Math.sin(clock * o.w * 0.55 + o.ph * 2) * 60 * u) * k), 0);
		}
		for (n = 0; n < motes.length; n++) { o = motes[n]; back.globalAlpha = o.a; back.drawImage(dots[o.d], Math.round(o.x * k) - (dots[o.d].width >> 1), Math.round(o.y * k) - (dots[o.d].width >> 1)); }
		back.globalAlpha = 1; back.setTransform(k, 0, 0, k, 0, 0);
		drawBlades(back, false);
	}
	function layout() {
		var ow = W, oh = H, k = st.k, n, i, h1, h2, x, wide, spots, list, size;
		W = st.W; H = st.H; u = Math.min(W, H) / 1080 * K.scale;
		floorY = water ? H - 104 * u : H - 24 * u;
		for (n = 0; n < fish.length; n++) { fish[n].x *= W / ow; fish[n].y *= H / oh; }
		for (n = 0; n < amb.length; n++) { amb[n].x *= W / ow; amb[n].y *= H / oh; }
		for (n = 0; n < motes.length; n++) { motes[n].x *= W / ow; motes[n].y *= H / oh; }
		if (chest) { chest.x *= W / ow; chest.art = null; }
		bubbles.length = 0; pellets.length = 0; dig.key = ''; tails = {}; tailCount = 0;
		size = Math.round(194 * u * k);
		glassC = endAt ? K.layer(size, size, function (g) { g.drawImage(glassArt(), 0, 0, size, size); }) : null;
		if (!water) return;
		wide = W / u > 1400;
		list = wide ? [0.07, 150, 84, 0.215, 88, 50, 0.6, 196, 108, 0.69, 84, 48, 0.925, 132, 74] : [0.1, 150, 84, 0.62, 180, 100, 0.9, 96, 54];
		rocks = []; for (n = 0; n < list.length; n += 3) rocks.push({ x: list[n] * W, w: list[n + 1] * u, h: list[n + 2] * u });
		corals = wide ? [{ x: 0.165 * W, h: 150 * u, c: '#ff8fab', tilt: 0.1 }, { x: 0.47 * W, h: 110 * u, c: '#b197fc', tilt: -0.12 }, { x: 0.745 * W, h: 170 * u, c: '#ffa94d', tilt: 0.06 }] : [{ x: 0.3 * W, h: 150 * u, c: '#ff8fab', tilt: 0.1 }, { x: 0.82 * W, h: 150 * u, c: '#ffa94d', tilt: -0.08 }];
		spots = wide ? [0.03, 0.125, 0.255, 0.4, 0.535, 0.655, 0.79, 0.965] : [0.035, 0.2, 0.47, 0.74, 0.96];
		blades = [];
		for (n = 0; n < spots.length; n++) for (i = 0; i < 4; i++) {
			h1 = K.hash('b' + n + ':' + i); h2 = K.hash('c' + n + ':' + i);
			if (i === 3 && h1 < 0.4) continue;
			x = spots[n] * W + ((i - 1.5) * 22 + (h2 - 0.5) * 14) * u;
			// One clump stands in front of the fish; the rest are part of the slow layer behind them.
			blades.push({ x: x, y: sandY(x) + 8 * u, h: (120 + h1 * 250) * u * (n % 3 === 1 ? 0.62 : 1) * (H > W ? 1.35 : 1), wd: (11 + h2 * 9) * u, lean: (h2 - 0.5) * 80 * u, sway: (12 + h1 * 18) * u, w: 0.5 + h2 * 0.5, ph: h1 * 6.28 + n, color: GREENS[(n + i) % 4], front: n === 2 });
		}
		vents = wide ? [{ x: 0.335 * W, next: 1, left: 4 }, { x: 0.86 * W, next: 3, left: 3 }] : [{ x: 0.33 * W, next: 1, left: 4 }];
		dots = [];
		for (n = 0; n < 3; n++) dots.push(K.layer(Math.round((8 + n * 5) * u * k), Math.round((8 + n * 5) * u * k), function (g, w) { K.glow(g, w / 2, w / 2, w / 2, '#e6fffb', 1); }));
		base.width = backC.width = st.canvas.width; base.height = backC.height = st.canvas.height;
		paintBase(); buildBeams(); refresh();
	}
	function swimmer(p) {
		return { p: p, z: Math.random(), r: 40 * u, px: 0, x: 0, y: 0, vx: 0, vy: 0, wa: 0, dir: 1, face: 1, pitch: 0, ph: K.rand(0, 6), cruise: K.rand(42, 74), boost: 0, spoke: clock, name: 0, blow: 0, blowNext: 0, gulp: 0, leave: false, sq: 0, seed: K.rand(0, 6.28), art: [null, null], tail: [], photo: p && p.photo, gold: !!(p && p.member), label: p ? K.short(p.name, 14) : '', glint: 1, small: null };
	}
	st.onresize = layout;
	(function () {
		var n, f;
		for (n = 0; n < 26; n++) motes.push({ x: Math.random() * W, y: Math.random() * H, vx: K.rand(-7, 7), vy: K.rand(-4, 3), d: n % 3, a: K.rand(0.14, 0.4) });
		// A few small plain fish keep the tank alive before anyone has spoken.
		for (n = 0; n < 5; n++) { f = swimmer(null); f.x = K.rand(0.2, 0.8) * W; f.y = K.rand(0.25, 0.7) * H; f.wa = Math.random() < 0.5 ? 0 : Math.PI; f.small = smallArt(K.pick(SMALL)); f.r = K.rand(15, 21); f.z = 0; amb.push(f); }
	})();
	layout();

	function bubble(x, y, r) { if (bubbles.length < 90) bubbles.push({ x: x, y: y, r: r, v: 0, ph: Math.random() * 6.28 }); }
	function retire(f) { if (!f.leave) { f.leave = true; delete byKey[f.p.key]; live--; } }
	// A paid message: food for a small one, a treasure chest for a big one, with the giver bobbing at the surface.
	function pay(f, amount) {
		var x = K.rand(0.2, 0.74) * W, big = amount >= 10, n;
		if (floats.length < 3) floats.push({ p: f.p, label: f.label, x: x, t: 0, life: big ? 9 : 7 });
		if (ripples.length < 8) ripples.push({ x: x, t: 0 });
		if (big && !chest) chest = { x: x, y: -90 * u, vy: 140 * u, s: K.clamp(0.9 + Math.log(amount / 10) / Math.LN10 * 0.38, 0.9, 1.7), state: 0, t: 0, open: 7 + Math.min(8, amount / 15), coins: 24 + Math.min(60, amount), next: 0, art: null, w: 0, h: 0, pad: 0 };
		else if (big) { chest.open += 4; if (chest.state === 2) K.fx.burst(chest.x, chest.y - 90 * u * chest.s, K.gold, 30, 640 * u); }
		else if (drops.length < 6) { n = 20 + Math.round(Math.min(40, amount * 4)); drops.push({ x: x, n: n, left: n, next: clock + 0.3 }); }
	}
	K.onChat(function (msg) {
		var p = msg.player, f = byKey[p.key], n, q, side;
		if (!f) {
			// Someone whose fish was on its way out turns it around.
			for (n = 0; n < fish.length && !f; n++) if (fish[n].p === p) f = fish[n];
			if (live >= MAX) { for (q = null, n = 0; n < fish.length; n++) if (!fish[n].leave && fish[n] !== f && (!q || fish[n].spoke < q.spoke)) q = fish[n]; if (q) retire(q); }
			if (f) { f.leave = false; f.spoke = clock; f.name = 3.4; }
			else {
				// A new fish swims in from one side.
				side = Math.random() < 0.5 ? -1 : 1;
				f = swimmer(p); f.x = side > 0 ? W + 170 * u : -170 * u; f.y = K.rand(0.2, 0.68) * H; f.wa = side > 0 ? Math.PI : 0; f.vx = -side * 230 * u; f.dir = f.face = -side; f.boost = 0.7; f.name = 4;
				for (n = 0; n < fish.length && fish[n].z <= f.z; n++) {}
				fish.splice(n, 0, f);
			}
			byKey[p.key] = f; live++;
		} else {
			// Chatting again: a dart forward and a string of bubbles.
			f.spoke = clock; f.name = 3.4; f.boost = 1; f.blow = 5; f.sq = 1; f.vx += f.face * 250 * u;
		}
		if (msg.donation) pay(f, msg.amount);
	});

	// One fish's steering: wander, stay in the tank, keep loosely with neighbours, or rush to food and treasure.
	function swim(f, dt, list) {
		var R = f.r, hx, hy, n, o, dx, dy, d, e, sx = 0, sy = 0, cx = 0, cy = 0, ax = 0, ay = 0, cnt = 0, speed, len, rush = false, food = -1, best = 1e12, tx = 0, ty = 0, a;
		var side = 170 * u, top = 110 * u, bot = floorY - 50 * u - R, near = 210 * u;
		f.wa += K.rand(-1, 1) * Math.sqrt(dt) * 1.1 - Math.sin(2 * f.wa) * 0.6 * dt;
		hx = Math.cos(f.wa); hy = Math.sin(f.wa) * 0.45;
		speed = f.cruise * u * (1 + f.boost * 2.6);
		if (f.leave) { hx = f.x < W / 2 ? -1 : 1; hy = Math.sin(clock + f.seed) * 0.15; speed = 180 * u; }
		else {
			if (f.p) {
				// Each fish fancies different pellets a little, so the tank spreads out over the shower instead of piling on one.
				for (n = 0; n < pellets.length; n++) { o = pellets[n]; dx = o.x - f.x; dy = o.y - f.y; d = (dx * dx + dy * dy) * (0.4 + (o.ph * 7.3 + f.seed * 3.1) % 1 * 1.4); if (d < best) { best = d; food = n; } }
				if (food >= 0) { rush = true; tx = pellets[food].x; ty = Math.max(pellets[food].y, 160 * u); }
				else if (chest && chest.state < 3) {
					// Treasure: everyone mills back and forth in an arch over the chest, leaving it in view.
					rush = true; a = -1.5708 + Math.sin(clock * (0.5 + f.seed % 1 * 0.4) + f.seed * 5) * 2; d = (210 + f.seed * 37 % 1 * 190) * u * chest.s;
					tx = K.clamp(chest.x + Math.cos(a) * d, 90 * u, W - 90 * u); ty = Math.max(160 * u, chest.y - 170 * u * chest.s + Math.sin(a) * d * 0.5);
				}
			}
			if (rush) {
				dx = tx - f.x; dy = ty - f.y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
				hx = dx / d; hy = dy / d; speed = Math.min((food >= 0 ? 230 : 290) * u + f.z * 90 * u, d * 3.2 + 60 * u);
				if (food >= 0 && d < R && clock > f.gulp && pellets[food].y > 150 * u) {
					f.gulp = clock + 0.55;
					o = pellets[food]; pellets[food] = pellets[pellets.length - 1]; pellets.pop();
					f.sq = 1; K.fx.spark(o.x, o.y, '#ffe9a8', 3, 130 * u, 3 * u, 0.3); bubble(o.x, o.y, 5 * u);
				}
			} else {
				// Near an edge the fish turns back on its own.
				if ((f.x < side && hx < 0) || (f.x > W - side && hx > 0)) f.wa = Math.PI - f.wa;
				if ((f.y < top && hy < 0) || (f.y > bot && hy > 0)) f.wa = -f.wa;
				hx = Math.cos(f.wa); hy = Math.sin(f.wa) * 0.45;
				if (f.y < top) hy += (top - f.y) / top; else if (f.y > bot) hy -= (f.y - bot) / (60 * u);
			}
			for (n = 0; n < list.length; n++) {
				o = list[n]; if (o === f) continue;
				dx = o.x - f.x; dy = o.y - f.y; if (dx > near || dx < -near || dy > near || dy < -near) continue;
				d = Math.sqrt(dx * dx + dy * dy) + 0.01; if (d > near) continue;
				e = (R + o.r) * 1.7; if (d < e) { e = 1 - d / e; sx -= dx / d * e; sy -= dy / d * e; }
				// Faces should not sit on top of each other for long: overlapping fish ease apart.
				e = (R + o.r) * 1.12; if (d < e) { e = (e - d) * 2.4 * dt; f.x -= dx / d * e; f.y -= dy / d * e; }
				cx += dx; cy += dy; ax += o.vx; ay += o.vy; cnt++;
			}
			if (cnt) {
				hx += sx * (rush ? 2.6 : 1.6); hy += sy * (rush ? 2.6 : 1.6);
				if (!rush) { hx += cx / cnt / near * 0.3 + ax / cnt / (70 * u) * 0.28; hy += cy / cnt / near * 0.18 + ay / cnt / (70 * u) * 0.16; }
			}
			len = Math.sqrt(hx * hx + hy * hy); if (len > 1) { hx /= len; hy /= len; }
		}
		e = rush ? 3.2 : 1.5;
		f.vx = K.approach(f.vx, hx * speed, e, dt); f.vy = K.approach(f.vy, hy * speed, e, dt);
		f.x += f.vx * dt; f.y += f.vy * dt;
		if (!f.leave) f.y = K.clamp(f.y, 50 * u + R, floorY - R * 0.7);
		// Face the way it is going (with a dead zone so it does not flicker), pitch with the climb, beat the tail with speed.
		if (f.vx > 14 * u) f.face = 1; else if (f.vx < -14 * u) f.face = -1;
		f.dir = K.approach(f.dir, f.face, 7, dt);
		f.pitch = K.approach(f.pitch, K.clamp(f.vy / (Math.abs(f.vx) + 60 * u), -0.5, 0.5), 5, dt);
		f.ph += dt * (3.5 + Math.sqrt(f.vx * f.vx + f.vy * f.vy) / u * 0.085);
		f.boost *= Math.exp(-1.8 * dt);
		f.sq = K.approach(f.sq, 0, 5, dt);
	}

	function update(dt) {
		var n, i, f, o, c, leaving = 0, name;
		clock += dt;
		sizeK = K.approach(sizeK, K.clamp(1.2 - live / 90, 0.78, 1.14), 1.5, dt);
		for (n = 0; n < amb.length; n++) swim(amb[n], dt, amb);
		for (n = fish.length - 1; n >= 0; n--) {
			f = fish[n];
			f.r = 38 * u * (0.82 + f.z * 0.32) * sizeK;
			swim(f, dt, fish);
			// The stamped art is made in whole steps of size, so a slowly growing fish is not repainted every frame.
			i = Math.max(9, Math.round(f.r * st.k / 3) * 3);
			if (i !== f.px || f.photo !== f.p.photo || f.gold !== f.p.member) { f.px = i; f.photo = f.p.photo; f.gold = f.p.member; f.art[0] = f.art[1] = null; f.tail.length = 0; }
			if (f.name > 0) f.name -= dt;
			if (f.blow > 0 && clock > f.blowNext) { f.blow--; f.blowNext = clock + 0.085; bubble(f.x + f.face * f.r * 1.2, f.y, K.rand(5, 10) * u); }
			if (f.gold && (f.glint -= dt) < 0) { f.glint = K.rand(0.9, 2.2); K.fx.spark(f.x + K.rand(-1, 1) * f.r, f.y - f.r * K.rand(0.6, 1.3), '#ffe066', 2, 70 * u, 3.5 * u, 0.55); }
			if (!f.leave && clock - f.spoke > idleSecs) retire(f);
			// A fish on its way out is gone once it is past the glass; in a stampede only a few get to swim off.
			if (f.leave && (f.x < -4 * f.r || f.x > W + 4 * f.r || ++leaving > 10)) fish.splice(n, 1);
		}
		for (n = bubbles.length - 1; n >= 0; n--) {
			o = bubbles[n]; o.v = K.approach(o.v, -(50 + o.r / u * 9) * u, 3, dt); o.y += o.v * dt; o.x += Math.sin(clock * 3 + o.ph) * 12 * u * dt;
			if (o.y < 12 * u) { bubbles[n] = bubbles[bubbles.length - 1]; bubbles.pop(); }
		}
		for (n = 0; n < vents.length; n++) {
			o = vents[n];
			if (clock > o.next) { bubble(o.x + K.rand(-9, 9) * u, floorY, K.rand(5, 11) * u); o.left--; o.next = clock + (o.left > 0 ? K.rand(0.12, 0.32) : K.rand(2.5, 6)); if (o.left <= 0) o.left = 3 + Math.floor(Math.random() * 5); }
		}
		for (n = 0; n < motes.length; n++) {
			o = motes[n]; o.x += (o.vx + Math.sin(clock * 0.4 + n) * 4) * u * dt; o.y += o.vy * u * dt;
			if (o.x < -10) o.x = W + 10; else if (o.x > W + 10) o.x = -10;
			if (o.y < 20 * u) o.y = floorY - 10 * u; else if (o.y > floorY) o.y = 30 * u;
		}
		for (n = drops.length - 1; n >= 0; n--) {
			o = drops[n];
			while (o.left > 0 && clock > o.next && pellets.length < 70) {
				i = Math.floor(Math.random() * 3);
				pellets.push({ x: o.x + K.rand(-1, 1) * (150 + o.n * 5) * u, y: -8 * u, v: K.rand(240, 460) * u, sink: K.rand(46, 80) * u, ph: Math.random() * 6.28, r: K.rand(8, 12) * u, art: pelletArt(i), rest: 0 });
				o.left--; o.next += 0.05;
			}
			if (o.left <= 0 || pellets.length >= 70) drops.splice(n, 1);
		}
		for (n = pellets.length - 1; n >= 0; n--) {
			o = pellets[n];
			if (o.y < floorY + 6 * u) { o.v = K.approach(o.v, o.sink, 2.6, dt); o.y += o.v * dt; o.x += Math.sin(clock * 2 + o.ph) * 14 * u * dt; }
			else if ((o.rest += dt) > 7) { pellets[n] = pellets[pellets.length - 1]; pellets.pop(); }
		}
		for (n = floats.length - 1; n >= 0; n--) if ((floats[n].t += dt) > floats[n].life) floats.splice(n, 1);
		for (n = ripples.length - 1; n >= 0; n--) if ((ripples[n].t += dt * 1.1) >= 1) ripples.splice(n, 1);
		if (chest) {
			c = chest; c.t += dt;
			if (c.state === 0) {
				c.vy = K.approach(c.vy, Math.max(310 * u, H * 0.3), 1.6, dt); c.y += c.vy * dt;
				if (clock > c.next) { c.next = clock + 0.07; bubble(c.x + K.rand(-50, 50) * u * c.s, c.y - 60 * u * c.s, K.rand(5, 10) * u); }
				if (c.y >= floorY + 16 * u) { c.y = floorY + 16 * u; c.state = 1; c.t = 0; K.fx.burst(c.x, floorY, '#ecd9a4', 16, 300 * u); }
			} else if (c.state === 1 && c.t > 0.5) {
				c.state = 2; c.t = 0;
				K.fx.burst(c.x, c.y - 90 * u * c.s, K.gold, c.coins, 640 * u); K.fx.spark(c.x, c.y - 90 * u * c.s, '#fff3b0', 26, 560 * u, 6 * u, 0.9);
			} else if (c.state === 2) {
				if (clock > c.next) {
					c.next = clock + 0.4;
					K.fx.burst(c.x + K.rand(-40, 40) * u, c.y - 96 * u * c.s, K.gold, 3, 360 * u); K.fx.spark(c.x + K.rand(-60, 60) * u * c.s, c.y - K.rand(90, 150) * u * c.s, '#ffe066', 2, 150 * u, 4 * u, 0.6);
					bubble(c.x + K.rand(-50, 50) * u * c.s, c.y - 100 * u * c.s, K.rand(5, 10) * u);
				}
				if (c.t > c.open) { c.state = 3; c.t = 0; }
			} else if (c.state === 3 && c.t > 1.2) chest = null;
		}
		// Demo: a paid message about every 20 seconds, treasure and food in turn.
		if (K.demo && clock > payAt) { payAt = clock + 20; name = K.pick(K.names); K.say(name, 'for the fish', { membership: K.hash(name) < 0.22 ? 'member' : '', hasDonation: 'tip', donoValue: [25, 4, 100][payN++ % 3] }); }
		K.fx.update(dt);
	}

	function setM(ctx, x, y, c, s, sx, sy) { var k = st.k; ctx.setTransform(c * sx * k, s * sx * k, -s * sy * k, c * sy * k, x * k, y * k); }
	function drawFish(ctx, f) {
		var k = st.k, R = f.px, d = f.dir, left = d < 0, ad = Math.abs(d), side = left ? 1 : 0, color = f.p.color, wag = Math.sin(f.ph), y = f.y + Math.sin(clock * 1.3 + f.seed) * 3 * u;
		var rot = f.pitch * d, a = Math.abs(rot) - 0.07, art = f.art[side], t, i, X, Y, q, c, s, qx, qy, mx;
		// A slight climb or dive is drawn level; past that the fish tilts.
		rot = a > 0 ? (rot < 0 ? -a : a) * 1.2 : 0;
		if (!art && bakes < 3) { bakes++; art = f.art[side] = bake(f, left, R); }
		// Level and facing one way, which is nearly always: two stamps, a tail frame and the body.
		if (art && ((rot === 0 && ad > 0.97 && f.sq < 0.03) || slow <= 0)) {
			i = side * 7 + Math.round((wag + 1) * 3);
			t = f.tail[i] || (f.tail[i] = tailFrame(color, R, left, i - side * 7));
			X = Math.round(f.x * k); Y = Math.round(y * k);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(t.c, X + (left ? 1 : -1) * Math.round(1.5 * R) - t.x, Y - t.y);
			ctx.drawImage(art.c, X - art.x, Y - art.y);
			return;
		}
		// Turning, tilting or gulping: the parts go through a transform, and mid-turn the body flips around a face that stays the right way round.
		slow--;
		q = R / k / RB; ad = Math.max(0.16, ad); c = Math.cos(rot); s = Math.sin(rot); qx = q * (1 + f.sq * 0.1); qy = q * (1 - f.sq * 0.08); mx = (left ? -ad : ad) * qx;
		setM(ctx, f.x, y, c, s, mx, qy);
		ctx.translate(-1.5 * RB, 0); ctx.rotate(wag * 0.42); ctx.scale(1 - Math.abs(wag) * 0.18, 1);
		ctx.drawImage(tailArt(color), -TX, -TY);
		if (art && ad > 0.97) { setM(ctx, f.x, y, c, s, qx * RB / R, qy * RB / R); ctx.drawImage(art.c, -art.x, -art.y); }
		else {
			setM(ctx, f.x, y, c, s, mx, qy); ctx.drawImage(bodyArt(color), -BX, -BY);
			setM(ctx, f.x, y, c, s, qx, qy); K.face(ctx, f.p, 0, 0, FR * RB); ctx.drawImage(domeArt(), -FR * RB, -FR * RB, FR * RB * 2, FR * RB * 2);
			if (f.gold) K.crown(ctx, 0, -FR * RB * 0.9, RB * 0.36);
		}
	}
	function drawSmall(ctx, f) {
		var q = f.r * u / 20, rot = f.pitch * f.dir + Math.sin(f.ph) * 0.09;
		setM(ctx, f.x, f.y, Math.cos(rot), Math.sin(rot), (f.dir < 0 ? -1 : 1) * Math.max(0.3, Math.abs(f.dir)) * q * (1 + Math.sin(f.ph * 2) * 0.04), q);
		ctx.drawImage(f.small, -52, -30);
	}
	function drawChest(ctx) {
		var c = chest, k = st.k, q = u * c.s * 0.92, e = c.state === 3 ? K.clamp(1 - c.t / 1.2, 0, 1) : 1, X, Y;
		if (!c.art) chestBake(c);
		// Falling it rocks and landing it squashes; after that it is a stamp.
		if (c.state === 0 || (c.state === 1 && c.t < 0.3)) {
			ctx.save(); ctx.translate(c.x, c.y);
			if (c.state === 0) ctx.rotate(Math.sin(c.t * 4) * 0.1); else { e = Math.sin(c.t / 0.3 * 3.1416); ctx.scale(1 + e * 0.08, 1 - e * 0.12); }
			ctx.drawImage(c.art[0], -110 * q, -192 * q, 220 * q, 200 * q);
			ctx.restore();
			return;
		}
		X = Math.round(c.x * k - c.w / 2); Y = Math.round((c.y + (1 - e) * 30 * u) * k - c.h * 0.96);
		ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = e;
		if (c.state === 1) ctx.drawImage(c.art[0], X, Y); else ctx.drawImage(c.art[1], X - c.pad, Y - c.pad);
		ctx.globalAlpha = 1; ctx.setTransform(k, 0, 0, k, 0, 0);
	}
	function timeText(left) {
		return left >= 3600 ? Math.floor(left / 3600) + ':' + ('0' + Math.floor(left % 3600 / 60)).slice(-2) + ':' + ('0' + left % 60).slice(-2) : Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2);
	}
	// The break timer's digits, repainted only when they change; every digit gets the same width so they do not jitter.
	function digits(text, color, w, h) {
		var k = st.k, c = dig.c, key = text + color + k + ':' + w, n, wide = 0, size, x, a, ch, g;
		if (dig.key === key) return c;
		dig.key = key;
		for (n = 0; n < text.length; n++) wide += text.charAt(n) === ':' ? 0.34 : 0.63;
		size = Math.min(h * 0.9, w / wide);
		c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
		g = c.getContext('2d'); g.scale(k, k);
		g.font = K.font(size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
		x = (w - wide * size) / 2;
		for (n = 0; n < text.length; n++) { ch = text.charAt(n); a = (ch === ':' ? 0.34 : 0.63) * size; g.fillText(ch, x + a / 2, h / 2 + size * (ch === ':' ? -0.03 : 0.04)); x += a; }
		return c;
	}

	function draw() {
		var ctx = K.begin(st), k = st.k, n, f, o, c, e, x, y, r, left, art = bubbleArt();
		bakes = 0;
		// Only so many fish at once get to tilt, turn or gulp; the rest stay on the cheap path, fewer still on a struggling machine.
		slow = K.q >= 1 ? 14 : 5;
		if (water) {
			if (clock >= refreshAt) { refreshAt = clock + 0.1; refresh(); }
			ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(backC, 0, 0);
			ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(k, 0, 0, k, 0, 0);
		}
		for (n = 0; n < pellets.length; n++) { o = pellets[n]; ctx.drawImage(o.art, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2); }
		ctx.globalAlpha = 0.8;
		for (n = 0; n < amb.length; n++) drawSmall(ctx, amb[n]);
		ctx.globalAlpha = 1;
		// The chest sits in the middle of the tank's depth: far fish pass behind it, near ones in front.
		for (n = 0; n < fish.length && fish[n].z < 0.5; n++) drawFish(ctx, fish[n]);
		ctx.setTransform(k, 0, 0, k, 0, 0);
		if (chest) drawChest(ctx);
		for (; n < fish.length; n++) drawFish(ctx, fish[n]);
		ctx.setTransform(k, 0, 0, k, 0, 0);
		if (water) drawBlades(ctx, true);
		for (n = 0; n < bubbles.length; n++) { o = bubbles[n]; ctx.drawImage(art, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2); }
		for (n = 0; n < fish.length; n++) {
			f = fish[n];
			if (f.name > 0) { ctx.globalAlpha = Math.min(1, f.name * 2); K.label(ctx, f.label, f.x, f.y + f.r * 1.72 + 14 * u, 27 * u, f.gold ? '#ffe066' : K.ink); }
		}
		ctx.globalAlpha = 1;
		ctx.lineCap = 'round';
		for (n = 0; n < ripples.length; n++) {
			o = ripples[n]; e = K.out(o.t);
			ctx.globalAlpha = (1 - o.t) * 0.7; ctx.lineWidth = 5 * u * (1 - o.t) + 1; ctx.strokeStyle = '#ffffff';
			ctx.beginPath(); ctx.ellipse(o.x, 16 * u, (36 + 190 * e) * u, (5 + 16 * e) * u, 0, 0, 6.2832); ctx.stroke();
		}
		// Whoever sent the gift bobs at the surface while it lasts.
		for (n = 0; n < floats.length; n++) {
			o = floats[n]; e = K.back(o.t * 3) * K.clamp((o.life - o.t) * 2.5, 0, 1); r = 46 * u * e; x = o.x; y = 78 * u + Math.sin(clock * 2.2 + o.x) * 6 * u;
			if (r < 1) continue;
			ctx.globalAlpha = K.clamp(e, 0, 1);
			K.glow(ctx, x, y, r * 1.8, K.gold, 0.5);
			K.bigFace(ctx, o.p, x, y, r);
			ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, 6.2832); ctx.lineWidth = r * 0.15; ctx.strokeStyle = K.gold; ctx.stroke();
			K.label(ctx, o.label, x, y + r + 26 * u, 30 * u, '#ffe066');
		}
		ctx.globalAlpha = 1;
		if (endAt) {
			left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); r = 88 * u; x = W - r - 36 * u; y = r + 36 * u + Math.sin(clock * 1.4) * 5 * u;
			c = digits(timeText(left), left ? '#ffffff' : '#ffe066', r * 1.56, r * 0.8);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(glassC, Math.round(x * k - glassC.width / 2), Math.round(y * k - glassC.height / 2));
			ctx.drawImage(c, Math.round(x * k - c.width / 2), Math.round(y * k - c.height / 2));
			ctx.setTransform(k, 0, 0, k, 0, 0);
		}
		// An empty tank shows how to get in.
		if (!fish.length) K.bubble(ctx, W / 2, H * 0.5 + 40 * u, u, clock);
		K.fx.draw(ctx);
	}

	if (K.demo) K.every(function () { var name = K.pick(K.names); K.say(name, 'hi', { membership: K.hash(name) < 0.22 ? 'member' : '' }); }, 500, 1500);
	window.SSNAquarium = { state: function () {
		var n, members = 0;
		for (n = 0; n < fish.length; n++) if (!fish[n].leave && fish[n].p.member) members++;
		return { fish: live, feeding: pellets.length > 0 || drops.length > 0 || !!chest, left: endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : -1, members: members };
	} };
	K.loop(update, draw);
	K.start();
})();
