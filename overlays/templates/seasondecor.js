/* Seasonal decor pack: a scene strip for the bottom edge of the stream (spring garden, summer beach, autumn harvest,
   Halloween graveyard, Easter meadow, Valentine's, St. Patrick's) and full-frame seasonal effects (blossom branches,
   butterflies, fireflies, sun rays, lanterns...). All canvas 2D, transparent and Chrome 80 friendly; nothing here
   connects to chat. Uses SSO.decorArt from themes.js (stage, layers, glow sprites, pumpkins, bats, spiders, webs). */
(function () {
	"use strict";
	var A = SSO.decorArt;
	if (!A) { return; }
	var TAU = Math.PI * 2;

	// ---------------------------------------------------------------- helpers
	function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
	function ease(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
	function span(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
	function pick(R, list) { return list[Math.floor(R() * list.length) % list.length]; }
	function rgbOf(hex) {
		var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim()), q = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(hex || ""));
		if (q) { return [+q[1], +q[2], +q[3]]; }
		if (!m) { return [136, 136, 136]; }
		var h = m[1]; if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
		var n = parseInt(h, 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	// f < 1 darkens, f > 1 lightens toward white.
	function shade(hex, f) { return "rgb(" + rgbOf(hex).map(function (v) { return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); }).join(",") + ")"; }
	function ell(g, x, y, rx, ry, col, rot) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.fill(); }
	function circ(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
	function path(g, pts) { g.beginPath(); for (var i = 0; i < pts.length; i += 2) { if (i) { g.lineTo(pts[i], pts[i + 1]); } else { g.moveTo(pts[i], pts[i + 1]); } } }
	function poly(g, pts, col) { g.fillStyle = col; path(g, pts); g.closePath(); g.fill(); }
	function stroke(g, pts, col, w) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; path(g, pts); g.stroke(); }
	function box(g, x, y, w, h, r, col) { g.fillStyle = col; A.rr(g, x, y, w, h, r); g.fill(); }
	function lin(g, x0, y0, x1, y1, c0, c1) { var gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
	function heart(g, x, y, s, col) {
		g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.9);
		g.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
		g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.2, x, y + s * 0.9); g.fill();
	}
	function star(g, x, y, r, col, rot) {
		g.fillStyle = col; g.beginPath();
		for (var i = 0; i < 10; i++) { var a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
		g.closePath(); g.fill();
	}
	function glowAt(g, x, y, r, rgb, a) { g.globalCompositeOperation = "lighter"; A.light(g, x, y, r, rgb, a); g.globalCompositeOperation = "source-over"; }

	// ---------------------------------------------------------------- plants (u units, base at 0,0, growing up)
	function blade(g, x, h, lean, col, w) {
		g.fillStyle = col; g.beginPath(); g.moveTo(x - w, 0); g.quadraticCurveTo(x - w * 0.4 + lean * 0.3, -h * 0.6, x + lean, -h);
		g.quadraticCurveTo(x + w + lean * 0.35, -h * 0.5, x + w, 0); g.closePath(); g.fill();
	}
	function stem(g, h, lean, col, w) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean * 0.2, -h * 0.5, lean, -h); g.stroke(); }
	function tulip(g, h, col, lean) {
		blade(g, -1, h * 0.66, -3.4, "#3f8a35", 1.5); blade(g, 1, h * 0.56, 3.2, "#5aa843", 1.5);
		stem(g, h, lean, "#4b9a3c", 1);
		g.save(); g.translate(lean, -h); g.rotate(lean * 0.04);
		g.fillStyle = shade(col, 0.8); g.beginPath(); g.moveTo(0, 2.6); g.bezierCurveTo(-3.7, 2.2, -3.7, -2, -2.4, -4.3); g.lineTo(-0.9, -1.4); g.lineTo(0, -5); g.lineTo(0.9, -1.4); g.lineTo(2.4, -4.3);
		g.bezierCurveTo(3.7, -2, 3.7, 2.2, 0, 2.6); g.fill();
		g.fillStyle = col; g.beginPath(); g.moveTo(0, 2.6); g.bezierCurveTo(-2.5, 1.6, -2.3, -2.6, 0, -4.7); g.bezierCurveTo(2.3, -2.6, 2.5, 1.6, 0, 2.6); g.fill();
		ell(g, -0.7, -1.2, 0.45, 1.6, "rgba(255,255,255,.3)", 0.15);
		g.restore();
	}
	function daffodil(g, h, lean) {
		blade(g, -0.8, h * 0.8, -2.2, "#4c9a3c", 1); blade(g, 0.9, h * 0.7, 2.6, "#62ad48", 1);
		stem(g, h, lean, "#4b9a3c", 0.9);
		g.save(); g.translate(lean, -h);
		for (var i = 0; i < 6; i++) { g.save(); g.rotate(i * TAU / 6 + 0.2); ell(g, 0, -2.7, 1.35, 2.7, i % 2 ? "#ffe66d" : "#ffd83a"); g.restore(); }
		circ(g, 0, 0, 1.9, "#f7941d"); circ(g, 0, 0, 1.2, "#ffb84d"); circ(g, 0, 0, 0.5, "#e07b12");
		g.restore();
	}
	function daisy(g, h, lean, col) {
		blade(g, 0.6, h * 0.45, 2.4, "#58a844", 0.9);
		stem(g, h, lean, "#4b9a3c", 0.8);
		g.save(); g.translate(lean, -h);
		for (var i = 0; i < 11; i++) { g.save(); g.rotate(i * TAU / 11); ell(g, 0, -2.3, 0.75, 2.1, col || "#ffffff"); g.restore(); }
		circ(g, 0, 0, 1.25, "#ffc93c"); circ(g, -0.3, -0.3, 0.5, "#ffe08a");
		g.restore();
	}
	function hyacinth(g, h, col) {
		blade(g, -0.8, h * 0.7, -2.4, "#3f8a35", 1.1); blade(g, 0.8, h * 0.62, 2.2, "#58a844", 1.1);
		stem(g, h * 0.6, 0, "#4b9a3c", 0.9);
		for (var i = 0; i < 12; i++) { var k = i / 11, y = -h * 0.5 - k * h * 0.5, w = (1 - Math.abs(k - 0.35) * 1.1) * 2.1; circ(g, (i % 3 - 1) * w * 0.55, y, 1.05, i % 2 ? col : shade(col, 1.25)); }
	}
	function dandelion(g, h, lean) {
		stem(g, h, lean, "#6aa84f", 0.6);
		g.save(); g.translate(lean, -h);
		g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 0.22;
		for (var i = 0; i < 18; i++) { var a = i * TAU / 18; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2.6, Math.sin(a) * 2.6); g.stroke(); circ(g, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.32, "rgba(255,255,255,.95)"); }
		circ(g, 0, 0, 0.6, "#d8d2b8");
		g.restore();
	}
	function sunflower(g, h, lean) {
		stem(g, h, lean, "#4f8f32", 1.5);
		[[0.3, -1], [0.52, 1], [0.7, -1]].forEach(function (q) { g.save(); g.translate(lean * q[0] * 0.5, -h * q[0]); g.rotate(q[1] * 1.05); ell(g, 0, -4, 2.3, 4.4, q[1] > 0 ? "#5a9c38" : "#4b8a30"); g.restore(); });
		g.save(); g.translate(lean, -h);
		for (var i = 0; i < 16; i++) { g.save(); g.rotate(i * TAU / 16); ell(g, 0, -5.4, 1.5, 3.4, i % 2 ? "#ffc61a" : "#f7a707"); g.restore(); }
		circ(g, 0, 0, 3.9, "#5a3413"); circ(g, 0, 0, 2.6, "#74461c");
		g.fillStyle = "rgba(30,15,5,.45)"; for (i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.cos(i * 2.4) * (0.6 + i * 0.2), Math.sin(i * 2.4) * (0.6 + i * 0.2), 0.3, 0, TAU); g.fill(); }
		g.restore();
	}
	function clover(g, x, y, s, col, four, bare) {
		var n = four ? 4 : 3;
		if (!bare) {
		g.strokeStyle = shade(col, 0.75); g.lineWidth = s * 0.14; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.3, y + s * 0.7, x + s * 0.1, y + s * 1.5); g.stroke();
		}
		for (var i = 0; i < n; i++) { g.save(); g.translate(x, y); g.rotate(i * TAU / n + (four ? Math.PI / 4 : -Math.PI / 2)); heart(g, s * 0.62, 0, s * 0.42, i % 2 ? col : shade(col, 1.15)); g.restore(); }
	}
	// A tapered trunk with two boughs, for the blossom / maple trees.
	function trunk(g, x, h, w, col, lean) {
		g.fillStyle = col; g.beginPath(); g.moveTo(x - w, 3); g.quadraticCurveTo(x - w * 0.5, -h * 0.5, x - w * 0.36 + lean, -h); g.lineTo(x + w * 0.36 + lean, -h); g.quadraticCurveTo(x + w * 0.5, -h * 0.5, x + w, 3); g.closePath(); g.fill();
		g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.moveTo(x + w * 0.2, 3); g.quadraticCurveTo(x + w * 0.2, -h * 0.5, x + w * 0.1 + lean, -h); g.lineTo(x + w * 0.36 + lean, -h); g.quadraticCurveTo(x + w * 0.5, -h * 0.5, x + w, 3); g.closePath(); g.fill();
		stroke(g, [x + lean * 0.7, -h * 0.74, x - w * 2.4 + lean, -h * 1.02, x - w * 4 + lean, -h * 1.3], col, w * 0.5);
		stroke(g, [x + lean * 0.8, -h * 0.82, x + w * 2.6 + lean, -h * 1.08, x + w * 4.4 + lean, -h * 1.26], col, w * 0.46);
		stroke(g, [x + lean, -h, x + lean * 1.3, -h * 1.4], col, w * 0.5);
	}
	// A leafy crown built from overlapping blobs: dark underside, main colour, sunlit highlights.
	function canopy(g, cx, cy, rx, ry, R, cols, n) {
		var list = [], i, q;
		for (i = 0; i < n; i++) { var a = R() * TAU, k = Math.sqrt(R()); list.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * (Math.sin(a) > 0 ? 0.75 : 1), (0.3 + R() * 0.2) * Math.min(rx, ry)]); }
		for (i = 0; i < n; i++) { q = list[i]; circ(g, q[0] + q[2] * 0.1, q[1] + q[2] * 0.16, q[2], cols[0]); }
		for (i = 0; i < n; i++) { q = list[i]; circ(g, q[0] - q[2] * 0.06, q[1] - q[2] * 0.08, q[2] * 0.86, cols[1]); }
		for (i = 0; i < n; i += 2) { q = list[i]; circ(g, q[0] - q[2] * 0.3, q[1] - q[2] * 0.34, q[2] * 0.42, cols[2]); }
		return list;
	}

	// ---------------------------------------------------------------- little creatures
	// flap 0..1 (0 = wings closed). s = wing length.
	function butterfly(g, x, y, s, flap, c1, c2, rot) {
		var k = 0.14 + 0.86 * flap, side;
		g.save(); g.translate(x, y); g.rotate(rot || 0);
		for (side = -1; side <= 1; side += 2) {
			g.save(); g.scale(side * k, 1);
			g.fillStyle = c1; g.beginPath(); g.moveTo(0, -s * 0.1); g.bezierCurveTo(s * 0.5, -s * 1.15, s * 1.3, -s * 0.9, s * 1.02, -s * 0.15); g.bezierCurveTo(s * 0.8, s * 0.1, s * 0.3, s * 0.1, 0, 0); g.fill();
			g.fillStyle = c2; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.5, s * 0.05, s * 0.98, s * 0.35, s * 0.72, s * 0.78); g.bezierCurveTo(s * 0.45, s * 0.98, s * 0.15, s * 0.6, 0, s * 0.15); g.fill();
			g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(s * 0.76, -s * 0.52, s * 0.11, 0, TAU); g.arc(s * 0.5, s * 0.48, s * 0.085, 0, TAU); g.fill();
			g.strokeStyle = "rgba(50,25,35,.5)"; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(0, -s * 0.1); g.bezierCurveTo(s * 0.5, -s * 1.15, s * 1.3, -s * 0.9, s * 1.02, -s * 0.15); g.stroke();
			g.restore();
		}
		ell(g, 0, 0, s * 0.09, s * 0.44, "#2a1c22");
		g.strokeStyle = "#2a1c22"; g.lineWidth = s * 0.045; g.beginPath(); g.moveTo(0, -s * 0.4); g.lineTo(-s * 0.2, -s * 0.78); g.moveTo(0, -s * 0.4); g.lineTo(s * 0.2, -s * 0.78); g.stroke();
		g.restore();
	}
	function bee(g, x, y, s, dir, t) {
		g.save(); g.translate(x, y); g.scale(dir, 1);
		g.fillStyle = "rgba(225,242,255," + (0.5 + 0.3 * Math.sin(t * 55)).toFixed(2) + ")";
		g.beginPath(); g.ellipse(-s * 0.12, -s * 0.52, s * 0.46, s * 0.26, -0.5, 0, TAU); g.ellipse(s * 0.2, -s * 0.5, s * 0.36, s * 0.22, 0.4, 0, TAU); g.fill();
		ell(g, 0, 0, s * 0.62, s * 0.42, "#ffcf33");
		g.fillStyle = "#2b2118"; g.fillRect(-s * 0.3, -s * 0.37, s * 0.16, s * 0.74); g.fillRect(s * 0.02, -s * 0.41, s * 0.16, s * 0.82);
		circ(g, s * 0.6, -s * 0.02, s * 0.26, "#2b2118");
		g.restore();
	}
	// Small songbird standing on (x, y).
	function bird(g, x, y, s, dir, col, belly, tilt) {
		g.save(); g.translate(x, y); g.scale(dir, 1); g.rotate(tilt || 0);
		stroke(g, [-s * 0.08, -s * 0.1, -s * 0.08, 0], "#8a5a2a", s * 0.08); stroke(g, [s * 0.14, -s * 0.1, s * 0.14, 0], "#8a5a2a", s * 0.08);
		poly(g, [-s * 0.4, -s * 0.5, -s * 1.3, -s * 0.9, -s * 1.15, -s * 0.42], shade(col, 0.78));
		ell(g, 0, -s * 0.5, s * 0.62, s * 0.45, col, -0.2);
		ell(g, s * 0.14, -s * 0.38, s * 0.42, s * 0.3, belly, -0.2);
		circ(g, s * 0.45, -s * 0.92, s * 0.33, col);
		poly(g, [s * 0.72, -s * 1.0, s * 1.1, -s * 0.9, s * 0.72, -s * 0.8], "#f2a23a");
		circ(g, s * 0.52, -s * 0.98, s * 0.075, "#1c1c1c");
		ell(g, -s * 0.14, -s * 0.54, s * 0.4, s * 0.24, shade(col, 0.76), 0.35);
		g.restore();
	}
	// Sitting bunny with its feet on (x, y). ear tilts the ears, s is its height to the top of the head.
	function bunny(g, x, y, s, dir, ear, col) {
		col = col || "#f4efe6";
		g.save(); g.translate(x, y); g.scale(dir, 1);
		circ(g, -s * 0.44, -s * 0.2, s * 0.13, "#ffffff");
		ell(g, 0, -s * 0.3, s * 0.42, s * 0.31, col);
		ell(g, -s * 0.1, -s * 0.12, s * 0.2, s * 0.13, shade(col, 0.93));
		ell(g, s * 0.24, -s * 0.05, s * 0.2, s * 0.075, shade(col, 0.9));
		[-0.3 + ear, 0.1 + ear * 0.6].forEach(function (a, i) {
			g.save(); g.translate(s * 0.3, -s * 0.74); g.rotate(a);
			ell(g, 0, -s * 0.3, s * 0.085, s * 0.31, i ? col : shade(col, 0.92)); ell(g, 0, -s * 0.3, s * 0.04, s * 0.22, "#f6b8c4");
			g.restore();
		});
		circ(g, s * 0.32, -s * 0.62, s * 0.21, col);
		ell(g, s * 0.46, -s * 0.55, s * 0.1, s * 0.08, "#ffffff");
		circ(g, s * 0.54, -s * 0.57, s * 0.027, "#e58a9a");
		circ(g, s * 0.38, -s * 0.66, s * 0.034, "#2a2020");
		g.restore();
	}
	function snail(g, x, y, s, dir) {
		g.save(); g.translate(x, y); g.scale(dir, 1);
		g.fillStyle = "#e9d8a6"; g.beginPath(); g.moveTo(-s * 1.1, 0); g.quadraticCurveTo(-s * 0.2, -s * 0.5, s * 0.9, -s * 0.3); g.quadraticCurveTo(s * 1.35, -s * 0.5, s * 1.3, 0); g.closePath(); g.fill();
		stroke(g, [s * 1.1, -s * 0.35, s * 1.2, -s * 0.95], "#e9d8a6", s * 0.13); stroke(g, [s * 1.25, -s * 0.3, s * 1.5, -s * 0.85], "#e9d8a6", s * 0.13);
		circ(g, s * 1.2, -s * 0.98, s * 0.1, "#2a2020"); circ(g, s * 1.5, -s * 0.88, s * 0.1, "#2a2020");
		circ(g, -s * 0.1, -s * 0.72, s * 0.72, "#c98d4f");
		g.strokeStyle = "#8a5a2a"; g.lineWidth = s * 0.14; g.beginPath();
		for (var a = 0; a < 9.4; a += 0.3) { var r = s * 0.6 * (1 - a / 11); if (a === 0) { g.moveTo(-s * 0.1 + r, -s * 0.72); } else { g.lineTo(-s * 0.1 + Math.cos(a) * r, -s * 0.72 + Math.sin(a) * r); } }
		g.stroke();
		g.restore();
	}
	function ladybug(g, x, y, s, rot) {
		g.save(); g.translate(x, y); g.rotate(rot || 0);
		circ(g, s * 0.75, 0, s * 0.45, "#1c1c1c");
		ell(g, 0, 0, s, s * 0.78, "#e02d2d");
		g.strokeStyle = "#1c1c1c"; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s * 0.6, 0); g.stroke();
		g.fillStyle = "#1c1c1c"; g.beginPath(); g.arc(-s * 0.3, -s * 0.36, s * 0.18, 0, TAU); g.arc(-s * 0.3, s * 0.36, s * 0.18, 0, TAU); g.arc(s * 0.25, -s * 0.34, s * 0.14, 0, TAU); g.arc(s * 0.25, s * 0.34, s * 0.14, 0, TAU); g.fill();
		g.restore();
	}

	// ---------------------------------------------------------------- strip plumbing
	// A sprite that sways around its base. draw(b) works in u units with (0, 0) at the base; x / y are slot units.
	// py = how far down the sprite the base sits (default 0.94, lower it for things that hang below their pivot).
	function sway(S, x, y, w, h, amp, draw, py) {
		var L = A.layer(w * S.u, h * S.u, S.d);
		py = py || 0.94;
		L.b.translate(w * S.u / 2, h * S.u * py); L.b.scale(S.u, S.u); draw(L.b);
		S.sway.push({ cv: L.cv, x: x, y: y, w: w, h: h, amp: amp, py: py, ph: S.R() * TAU });
	}
	function drawSway(g, S, t) {
		var u = S.u;
		for (var i = 0; i < S.sway.length; i++) {
			var q = S.sway[i];
			g.save(); g.translate(S.x + q.x * u, S.gy + q.y * u); g.rotate(Math.sin(t * 1.3 + q.ph) * q.amp + Math.sin(t * 0.41 + q.ph * 2.3) * q.amp * 0.6);
			g.drawImage(q.cv, -q.w * u / 2, -q.h * u * q.py, q.w * u, q.h * u); g.restore();
		}
	}
	// Things that flutter down from a crown (petals, leaves): call every frame inside the slot transform.
	function shed(g, S, dt, cx, cy, rx, ry, cols, rate, big) {
		if (Math.random() < dt * rate && S.fx.length < 26) { S.fx.push({ x: cx + (Math.random() * 2 - 1) * rx, y: cy + (Math.random() * 2 - 1) * ry, vy: 5 + Math.random() * 5, ph: Math.random() * TAU, fl: Math.random() * TAU, rot: Math.random() * TAU, col: cols[Math.floor(Math.random() * cols.length)], a: 1, land: 4 + Math.random() * 10 }); }
		for (var i = S.fx.length - 1; i >= 0; i--) {
			var p = S.fx[i];
			if (p.y < p.land) { p.y += p.vy * dt; p.x += Math.sin(p.ph + p.y * 0.12) * 7 * dt + 2 * dt; p.fl += dt * 4; p.rot += dt * 1.5; } else { p.a -= dt * 0.35; }
			if (p.a <= 0) { S.fx.splice(i, 1); continue; }
			g.globalAlpha = Math.min(1, p.a);
			g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, p.y < p.land ? Math.max(0.2, Math.abs(Math.cos(p.fl))) : 0.5);
			g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, big || 1.2, (big || 1.2) * 0.62, 0, 0, TAU); g.fill();
			g.restore();
		}
		g.globalAlpha = 1;
	}

	// ---------------------------------------------------------------- land: far hills, ground bands, grass
	function hillY(e, px, amp) { return e.gy - (15 + 9 * Math.sin(px / (120 * e.u) + 2 + e.seed) + 5 * Math.sin(px / (53 * e.u))) * e.u * (amp || 1); }
	function farHill(b, e, col, amp) {
		b.fillStyle = col; b.beginPath(); b.moveTo(0, e.H + 1);
		for (var px = 0; px <= e.W + 20 * e.u; px += 10 * e.u) { b.lineTo(px, hillY(e, px, amp)); }
		b.lineTo(e.W + 20 * e.u, e.H + 1); b.closePath(); b.fill();
	}
	function ground(b, e, c0, c1, rim) {
		var u = e.u, px;
		b.fillStyle = lin(b, 0, e.gy - 6 * u, 0, e.H, c0, c1); b.beginPath(); b.moveTo(0, e.H + 1);
		for (px = 0; px <= e.W + 12 * u; px += 6 * u) { b.lineTo(px, e.groundY(px)); }
		b.lineTo(e.W + 12 * u, e.H + 1); b.closePath(); b.fill();
		if (rim) { b.strokeStyle = rim; b.lineWidth = Math.max(1, u); b.beginPath(); b.moveTo(0, e.groundY(0)); for (px = 6 * u; px <= e.W + 12 * u; px += 6 * u) { b.lineTo(px, e.groundY(px)); } b.stroke(); }
	}
	// Blades of grass standing along the ground edge.
	function fringe(b, e, cols, lo, hi, gap, Rf) {
		var u = e.u;
		for (var px = -2 * u; px < e.W + 2 * u; px += gap * u * (0.6 + Rf() * 0.8)) {
			var h = (lo + Rf() * (hi - lo)) * u, lean = (Rf() - 0.5) * h * 0.8, y = e.groundY(px) + 1.6 * u, w = (0.45 + Rf() * 0.5) * u;
			b.fillStyle = cols[Math.floor(Rf() * cols.length)];
			b.beginPath(); b.moveTo(px - w, y); b.quadraticCurveTo(px + lean * 0.3, y - h * 0.6, px + lean, y - h); b.quadraticCurveTo(px + w + lean * 0.4, y - h * 0.5, px + w, y); b.closePath(); b.fill();
		}
	}
	// Little tufts scattered over the ground band.
	function tufts(b, e, cols, n, Rf) {
		var u = e.u;
		for (var i = 0; i < n; i++) {
			var x = Rf() * e.W, y = e.gy + (5 + Rf() * 17) * u;
			for (var k = -1; k <= 1; k++) { b.fillStyle = cols[(i + k + 3) % cols.length]; b.beginPath(); b.moveTo(x + k * 1.1 * u - 0.5 * u, y); b.lineTo(x + k * 2.4 * u, y - (2.6 + Rf() * 2) * u); b.lineTo(x + k * 1.1 * u + 0.5 * u, y); b.closePath(); b.fill(); }
		}
	}
	var BUSH = [[-0.85, -0.25, 0.5], [-0.42, -0.7, 0.56], [0.28, -0.82, 0.6], [0.82, -0.3, 0.52], [0, -0.3, 0.7]];
	function bush(b, r, cols) {
		BUSH.forEach(function (q) { circ(b, q[0] * r + r * 0.05, q[1] * r + r * 0.08, q[2] * r, cols[0]); });
		BUSH.forEach(function (q) { circ(b, q[0] * r, q[1] * r, q[2] * r * 0.9, cols[1]); });
		BUSH.forEach(function (q, i) { if (i < 4) { circ(b, q[0] * r - q[2] * r * 0.25, q[1] * r - q[2] * r * 0.3, q[2] * r * 0.42, cols[2]); } });
	}
	function bushes(b, e, cols, dots, Rf, gapLo, gapHi) {
		var u = e.u;
		for (var px = Rf() * 30 * u; px < e.W; px += (gapLo + Rf() * (gapHi - gapLo)) * u) {
			var r = (7 + Rf() * 7) * u, y = hillY(e, px) + 2 * u;
			b.save(); b.translate(px, y);
			bush(b, r, cols);
			if (dots) { for (var k = 0; k < 7; k++) { var da = Math.PI + Rf() * Math.PI, dk = Math.sqrt(Rf()); circ(b, Math.cos(da) * r * 1.15 * dk, Math.sin(da) * r * 0.9 * dk - r * 0.1, 0.75 * u, dots[k % dots.length]); } }
			b.restore();
		}
	}

	// Butterflies (and bees, low down) wandering the length of the strip.
	var WINGS = [["#ff9f1c", "#ffbf69"], ["#5fa8d3", "#cae9ff"], ["#f72585", "#ffafcc"], ["#ffd60a", "#fff3b0"], ["#9b5de5", "#d0b3ff"], ["#ffffff", "#dfeaff"]];
	function flutter(e, nFly, nBee, wings) {
		var u = e.u, list = [], scale = e.busy * Math.max(1, e.W / (430 * u)), i;
		function add(type) {
			var w = pick(Math.random, wings || WINGS);
			list.push({ type: type, x: Math.random() * e.W, y0: e.gy - (type ? 6 + Math.random() * 22 : 24 + Math.random() * 90) * u, dir: Math.random() < 0.5 ? -1 : 1, v: (type ? 16 : 9 + Math.random() * 8) * u, ph: Math.random() * TAU, s: (type ? 2.6 : 4.2 + Math.random() * 2.4) * u, c1: w[0], c2: w[1] });
		}
		for (i = 0; i < Math.round(nFly * scale); i++) { add(0); }
		for (i = 0; i < Math.round(nBee * scale); i++) { add(1); }
		return function (g, t, dt) {
			for (var j = 0; j < list.length; j++) {
				var f = list[j];
				f.x += f.dir * f.v * dt * (0.55 + 0.45 * Math.sin(t * 0.7 + f.ph));
				if (f.x > e.W + 12 * u) { f.x = -10 * u; } else if (f.x < -12 * u) { f.x = e.W + 10 * u; }
				if (f.type) { bee(g, f.x + Math.sin(t * 3.1 + f.ph) * 3 * u, f.y0 + Math.sin(t * 2.3 + f.ph) * 4 * u + Math.sin(t * 7 + f.ph) * u, f.s, f.dir, t); }
				else { butterfly(g, f.x, f.y0 + Math.sin(t * 0.9 + f.ph) * 9 * u + Math.sin(t * 2.7 + f.ph) * 2.5 * u, f.s, Math.abs(Math.sin(t * 9 + f.ph)), f.c1, f.c2, f.dir * 0.5 + Math.cos(t * 0.9 + f.ph) * 0.25); }
			}
		};
	}
	// Petals, leaves or hearts drifting down through the strip and fading in from its top edge.
	function drifter(e, kind, cols) {
		var u = e.u, list = [], spr = kind === "leaf" && SSO.leafSprites ? SSO.leafSprites() : null, n = Math.round((kind === "leaf" ? 8 : 13) * Math.max(1, e.W / (560 * u))), i, up = kind === "heart";
		for (i = 0; i < n; i++) { list.push({ x: Math.random() * e.W, y: Math.random() * e.gy, s: (kind === "leaf" ? 3.2 : kind === "heart" ? 2.2 : kind === "clover" ? 2.3 : 1.3) * (0.7 + Math.random() * 0.6) * u, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 1.6, fl: Math.random() * TAU, vf: 1.5 + Math.random() * 2.5, ph: Math.random() * TAU, sp: (7 + Math.random() * 7) * u, k: i }); }
		return function (g, t, dt) {
			var wind = 0.3 + Math.sin(t * 0.14) * 0.5;
			for (var j = 0; j < list.length; j++) {
				var p = list[j];
				p.y += (up ? -0.7 : 1) * p.sp * dt; p.x += (wind * p.sp * 0.6 + Math.sin(t * 0.9 + p.ph) * p.sp * 0.7) * dt; p.rot += p.vr * dt; p.fl += p.vf * dt;
				if (up ? p.y < -4 * u : p.y > e.gy + 9 * u) { p.y = up ? e.gy + 4 * u : -4 * u; p.x = Math.random() * e.W; }
				if (p.x > e.W + 6 * u) { p.x = -6 * u; } else if (p.x < -6 * u) { p.x = e.W + 6 * u; }
				var a = clamp(p.y / (e.H * 0.36), 0, 1) * clamp((e.gy + 9 * u - p.y) / (7 * u), 0, 1);
				if (a < 0.02) { continue; }
				g.globalAlpha = a * (up ? 0.85 : 1);
				g.save(); g.translate(p.x, p.y);
				if (up) { g.rotate(Math.sin(t * 1.4 + p.ph) * 0.25); heart(g, 0, 0, p.s, cols[p.k % cols.length]); }
				else {
					g.rotate(p.rot); g.scale(1, Math.max(0.16, Math.abs(Math.cos(p.fl))));
					if (spr) { g.drawImage(spr[p.k % spr.length], -p.s, -p.s, p.s * 2, p.s * 2); } else if (kind === "clover") { clover(g, 0, 0, p.s, cols[p.k % cols.length], false, true); } else { g.fillStyle = cols[p.k % cols.length]; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, TAU); g.fill(); }
				}
				g.restore();
			}
			g.globalAlpha = 1;
		};
	}

	// ---------------------------------------------------------------- vignettes
	// Each: { w (u), back(b, S), front(b, S), live(g, S, t, dt) }, drawn in u units with (0, 0) at the slot's left
	// end on the ground line. back goes behind the ground ridge, front on top of the ground, live every frame.
	var V = {}, SCENES = {};
	var PETAL = ["#f7a8c4", "#ffd3e2", "#ffffff", "#f48fb1"];

	V.tulips = { w: 44, front: function (b, S) {
		var cols = ["#e63946", "#ff7aa8", "#ffd23f", "#b565d8", "#ff8c42", "#ffffff"];
		for (var i = 0; i < 6; i++) {
			(function (i) {
				var h = 17 + S.R() * 9, col = pick(S.R, cols), lean = (S.R() - 0.5) * 3;
				sway(S, 5 + i * 6.8 + (S.R() - 0.5) * 3, 4 + (i % 3) * 3.5 + S.R() * 2.5, 16, h + 9, 0.05, function (g) { tulip(g, h, col, lean); });
			})(i);
		}
	} };
	V.daffs = { w: 42, front: function (b, S) {
		var hy = ["#7b6cf6", "#c77dff", "#5fa8d3", "#ff8fab"];
		for (var i = 0; i < 6; i++) {
			(function (i) {
				var h = 14 + S.R() * 8, lean = (S.R() - 0.5) * 3, col = pick(S.R, hy);
				sway(S, 4 + i * 6.6 + (S.R() - 0.5) * 3, 4 + (i % 3) * 3.5 + S.R() * 2.5, 16, h + 10, 0.05, i % 3 === 1 ? function (g) { hyacinth(g, h * 0.9, col); } : function (g) { daffodil(g, h, lean); });
			})(i);
		}
	} };
	V.daisies = { w: 36, front: function (b, S) {
		for (var i = 0; i < 7; i++) {
			(function (i) {
				var h = 8 + S.R() * 8, lean = (S.R() - 0.5) * 3;
				sway(S, 3 + i * 4.8 + (S.R() - 0.5) * 3, 4 + (i % 4) * 2.8 + S.R() * 2.5, 12, h + 8, 0.07, i % 4 === 2 ? function (g) { dandelion(g, h + 3, lean); } : function (g) { daisy(g, h, lean, i % 3 ? "#ffffff" : "#ffe0ec"); });
			})(i);
		}
	} };
	V.cherry = { w: 74,
		back: function (b, S) {
			trunk(b, 37, 44, 4.4, "#6b4630", 2);
			canopy(b, 38, -64, 31, 20, S.R, ["#e07fa6", "#f7a8c4", "#ffd9e6"], 34);
			for (var i = 0; i < 26; i++) { var a = S.R() * TAU, k = Math.sqrt(S.R()); circ(b, 38 + Math.cos(a) * 30 * k, -64 + Math.sin(a) * 19 * k, 0.75, i % 3 ? "#ffffff" : "#d85c8c"); }
		},
		front: function (b, S) { for (var i = 0; i < 16; i++) { ell(b, 6 + S.R() * 62, 4 + S.R() * 11, 1.2, 0.6, pick(S.R, PETAL), S.R() * 3); } },
		live: function (g, S, t, dt) { shed(g, S, dt, 38, -60, 28, 14, PETAL, 1.5); }
	};
	V.birdhouse = { w: 30,
		back: function (b, S) {
			var wall = pick(S.R, ["#5bb5c9", "#f2c14e", "#e86a5c", "#8fc97a"]);
			S.col = pick(S.R, ["#4a90d9", "#e2574c", "#f2b134", "#6b8f71"]);
			b.fillStyle = "#8a6238"; b.fillRect(13.6, -38, 2.8, 41); b.fillStyle = "rgba(0,0,0,.2)"; b.fillRect(15.5, -38, 0.9, 41);
			box(b, 7, -56, 16, 18, 1, wall); b.fillStyle = "rgba(0,0,0,.12)"; b.fillRect(18, -56, 5, 18);
			poly(b, [4.4, -55, 15, -66.5, 25.6, -55], "#b5523b"); poly(b, [15, -66.5, 25.6, -55, 22.6, -55, 15, -63.2], "rgba(0,0,0,.18)");
			circ(b, 15, -48.5, 2.7, "#3a2a20"); b.fillStyle = "#8a6238"; b.fillRect(14.3, -44.4, 1.4, 1.4);
		},
		live: function (g, S, t) {
			var k = t % 9, hop = k > 7.6 && k < 8.2 ? Math.sin((k - 7.6) / 0.6 * Math.PI) * 3.2 : 0, dir = Math.floor(t / 4.5) % 2 ? -1 : 1;
			bird(g, 15 - dir, -66 - hop, 4.6, dir, S.col, "#f6e7c8", Math.sin(t * 5) * 0.03);
			if (k > 2 && k < 4) { var q = (k - 2) / 2; g.globalAlpha = Math.sin(q * Math.PI); g.fillStyle = "#ffffff"; g.font = "700 5px sans-serif"; g.fillText("\u266a", 15 + dir * (6 + q * 4), -74 - q * 7); g.globalAlpha = 1; }
		}
	};
	V.wateringcan = { w: 48,
		front: function (b, S) {
			b.save(); b.translate(0, 8);
			ell(b, 15, 0.4, 13, 1.6, "rgba(0,0,0,.16)");
			stroke(b, [6.5, -12, 1.8, -10.5, 1.8, -4.5, 6.5, -3], "#2f8f8a", 1.5);
			poly(b, [21.5, -6.5, 31, -17.5, 33, -15.8, 21.5, -2], "#3aa6a0");
			box(b, 6, -16, 16, 16, 2, "#3aa6a0"); b.fillStyle = "rgba(255,255,255,.22)"; b.fillRect(8, -15, 2.2, 14); b.fillStyle = "rgba(0,0,0,.14)"; b.fillRect(18, -16, 4, 16);
			b.fillStyle = "#2f8f8a"; b.fillRect(6, -16.6, 16, 1.6);
			ell(b, 32.6, -17.2, 2.7, 1.7, "#2f8f8a", -0.86);
			for (var i = 0; i < 3; i++) {
				var x = 37 + i * 4.6, y = -1 + (i % 2) * 3;
				ell(b, x, y, 2.6, 1, "#6b4a2c");
				stroke(b, [x, y - 0.4, x, y - 3.6], "#58a844", 0.6); ell(b, x - 1.2, y - 4, 1.4, 0.8, "#6fbf4a", -0.5); ell(b, x + 1.2, y - 4.2, 1.4, 0.8, "#58a844", 0.5);
			}
			b.restore();
		},
		live: function (g, S, t) {
			var k = (t / 70) % 1, f = k < 0.5 ? k * 2 : 2 - k * 2;
			snail(g, 5 + f * 36, 14.4, 2.2, k < 0.5 ? 1 : -1);
		}
	};
	V.picket = { w: 62, back: function (b, S) {
		var i;
		b.fillStyle = "#d9dde2"; b.fillRect(0, -19, 62, 2.4); b.fillRect(0, -8.5, 62, 2.4);
		for (i = 0; i < 10; i++) {
			var x = 1.5 + i * 6.2;
			poly(b, [x, 3, x, -23, x + 2.2, -26.5, x + 4.4, -23, x + 4.4, 3], "#fdfdf8");
			b.fillStyle = "rgba(160,170,185,.4)"; b.fillRect(x + 3.3, -23, 1.1, 26);
		}
		b.strokeStyle = "#4f9a3a"; b.lineWidth = 0.9; b.lineCap = "round"; b.beginPath(); b.moveTo(2, 2);
		for (i = 0; i <= 12; i++) { b.lineTo(2 + i * 4.8, -8 - Math.sin(i * 0.9) * 7 - i * 0.6); }
		b.stroke();
		for (i = 1; i <= 12; i++) {
			var vx = 2 + i * 4.8, vy = -8 - Math.sin(i * 0.9) * 7 - i * 0.6;
			ell(b, vx - 1.4, vy + 1, 1.6, 0.9, i % 2 ? "#5aa843" : "#3f8a35", i);
			if (i % 3 === 0) { circ(b, vx, vy - 1, 1.7, pick(S.R, ["#ff5c8a", "#e63946", "#ffd6e0"])); circ(b, vx - 0.3, vy - 1.3, 0.7, "rgba(255,255,255,.45)"); }
		}
	} };
	V.mushrooms = { w: 28,
		front: function (b, S) {
			b.save(); b.translate(0, 9);
			[[9, 9, 5.4], [18, 6, 3.8], [23, 3.6, 2.5]].forEach(function (m, i) {
				box(b, m[0] - m[2] * 0.26, -m[1], m[2] * 0.52, m[1] + 0.5, m[2] * 0.2, "#f3ead8");
				b.fillStyle = i === 1 ? "#d7263d" : "#e63946"; b.beginPath(); b.moveTo(m[0] - m[2], -m[1] + 0.6); b.quadraticCurveTo(m[0] - m[2] * 0.9, -m[1] - m[2] * 1.15, m[0], -m[1] - m[2] * 1.1); b.quadraticCurveTo(m[0] + m[2] * 0.9, -m[1] - m[2] * 1.15, m[0] + m[2], -m[1] + 0.6); b.closePath(); b.fill();
				b.fillStyle = "#ffffff"; [[-0.45, -0.5, 0.2], [0.3, -0.72, 0.17], [0.55, -0.25, 0.13], [-0.1, -0.2, 0.12]].forEach(function (d2) { b.beginPath(); b.ellipse(m[0] + d2[0] * m[2], -m[1] + d2[1] * m[2], d2[2] * m[2], d2[2] * m[2] * 0.8, 0, 0, TAU); b.fill(); });
			});
			b.restore();
		},
		live: function (g, S, t) {
			var k = (t / 16) % 1, a = Math.PI + (k < 0.5 ? k * 2 : 2 - k * 2) * Math.PI;
			ladybug(g, 9 + Math.cos(a) * 5.2, -0.4 + Math.sin(a) * 5.6, 0.95, a + (k < 0.5 ? Math.PI / 2 : -Math.PI / 2));
		}
	};
	V.beehive = { w: 40,
		back: function (b, S) {
			poly(b, [8, 3, 9.5, -9, 30.5, -9, 32, 3], "#8a6238"); ell(b, 20, -9, 10.5, 2.4, "#c49a66");
			b.strokeStyle = "rgba(90,60,30,.6)"; b.lineWidth = 0.4; b.beginPath(); b.ellipse(20, -9, 6.5, 1.4, 0, 0, TAU); b.stroke(); b.beginPath(); b.ellipse(20, -9, 3, 0.7, 0, 0, TAU); b.stroke();
			for (var i = 0; i < 6; i++) { ell(b, 20, -12.4 - i * 3.9, 10.2 - i * 1.45 - (i > 3 ? (i - 3) * 1.1 : 0), 2.9, i % 2 ? "#cf9b38" : "#e0b04c"); }
			ell(b, 20, -35.2, 2.4, 1.6, "#cf9b38");
			b.fillStyle = "#3a2410"; b.beginPath(); b.arc(20, -10.4, 2.6, Math.PI, 0); b.fill();
		},
		live: function (g, S, t) {
			for (var i = 0; i < 4; i++) { var a = t * (1.6 + i * 0.3) + i * 1.9, r = 9 + i * 2.5; bee(g, 20 + Math.cos(a) * r, -24 + Math.sin(a * 1.3) * r * 0.55, 1.5, Math.sin(a) > 0 ? -1 : 1, t + i); }
		}
	};
	V.bunny = { w: 34,
		front: function (b, S) { S.fur = pick(S.R, ["#f4efe6", "#d9c3a5", "#cfd2d8", "#ffffff"]); for (var i = 0; i < 4; i++) { clover(b, 5 + S.R() * 24, 5 + S.R() * 8, 1.5, "#4f9a3a"); } },
		live: function (g, S, t) {
			var k = t % 7, hop = k > 5.4 && k < 6 ? Math.sin((k - 5.4) / 0.6 * Math.PI) : 0, dir = Math.floor(t / 7) % 2 ? -1 : 1;
			var ear = Math.sin(t * 0.8) * 0.06 + (k > 2 && k < 2.5 ? Math.sin((k - 2) * TAU * 2) * 0.22 : 0);
			ell(g, 17 + dir * hop * 3, 9.5, 5.5 - hop * 1.5, 1.1, "rgba(0,0,0,.16)");
			bunny(g, 17 + dir * hop * 3, 9 - hop * 5, 13, dir, ear, S.fur);
		}
	};

	// ---------------------------------------------------------------- scenes
	function meadow(c0, c1, blades, hill, bush, dots, speck) {
		return {
			far: function (b, e) { var Rf = SSO.seeded("far" + e.seed + e.kind); farHill(b, e, hill); bushes(b, e, bush, dots, Rf, 50, 120); },
			ground: function (b, e) {
				var Rf = SSO.seeded("gr" + e.seed);
				fringe(b, e, blades, 3, 6.5, 2.4, Rf);
				ground(b, e, c0, c1);
				fringe(b, e, blades, 2, 4.5, 3.2, Rf);
				tufts(b, e, blades, Math.round(e.W / (26 * e.u)), Rf);
				for (var i = 0; i < e.W / (9 * e.u); i++) { circ(b, Rf() * e.W, e.gy + (3 + Rf() * 21) * e.u, (0.5 + Rf() * 0.5) * e.u, pick(Rf, speck || ["#ffffff", "#fff3b0", "#ffd3e2"])); }
			}
		};
	}
	var GRASS = ["#9fd865", "#6dbb4a", "#4f9a3a"];
	SCENES.spring = meadow("#86c94f", "#4c9a36", GRASS, "#b9df8c", ["#7fbf5c", "#9bd272", "#c2e89a"], ["#ffffff", "#ffd3e2", "#fff3b0"]);
	SCENES.spring.deck = ["tulips", "cherry", "daffs", "birdhouse", "picket", "wateringcan", "mushrooms", "beehive", "bunny", "daisies"];
	SCENES.spring.roam = function (e) { return flutter(e, 1.3, 0.6); };
	SCENES.spring.drift = function (e) { return drifter(e, "petal", PETAL); };

	// ---------------------------------------------------------------- summer beach
	function umbrella(g, cx, top, rx, ry, c1, c2, n) {
		var i;
		g.save();
		g.beginPath(); g.ellipse(cx, top + ry, rx, ry, 0, Math.PI, TAU);
		for (i = n; i > 0; i--) { var x1 = cx - rx + (i - 1) * 2 * rx / n; g.quadraticCurveTo(x1 + rx / n, top + ry - ry * 0.2, x1, top + ry); }
		g.closePath(); g.clip();
		for (i = 0; i < n; i++) {
			var xa = cx - rx + i * 2 * rx / n, xb = xa + 2 * rx / n;
			g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(cx, top - 1); g.quadraticCurveTo((cx + xa) / 2 + (xa - cx) * 0.36, top + ry * 0.3, xa, top + ry + 1); g.lineTo(xb, top + ry + 1); g.quadraticCurveTo((cx + xb) / 2 + (xb - cx) * 0.36, top + ry * 0.3, cx, top - 1); g.fill();
		}
		g.fillStyle = "rgba(0,0,0,.13)"; g.fillRect(cx + rx * 0.3, top - 1, rx, ry + 3);
		g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(cx - rx, top - 1, rx * 0.45, ry + 3);
		g.restore();
		circ(g, cx, top - 0.5, 1, shade(c1, 0.8));
	}
	function beachBall(g, x, y, r, rot) {
		var cols = ["#e63946", "#ffffff", "#2a9df4", "#ffffff", "#ffd23f", "#ffffff"];
		g.save(); g.translate(x, y); g.rotate(rot || 0);
		for (var i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, i * TAU / 6, (i + 1) * TAU / 6); g.closePath(); g.fill(); }
		circ(g, 0, 0, r * 0.2, "#ffffff");
		g.restore();
		ell(g, x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.34, "rgba(255,255,255,.5)", 0.6);
	}
	function frond(g, ang, len, col) {
		g.save(); g.rotate(ang);
		for (var i = 1; i <= 13; i++) {
			var k = i / 13, px = 2 * (1 - k) * k * len * 0.55 + k * k * len, py = 2 * (1 - k) * k * (-len * 0.32) + k * k * len * 0.32, L = len * 0.34 * Math.sin(k * Math.PI * 0.86 + 0.25);
			poly(g, [px - 1.1, py, px + L * 0.3, py + L, px + 1.3, py], i % 2 ? col : shade(col, 0.86));
			poly(g, [px - 1.1, py, px + L * 0.4, py - L * 0.55, px + 1.3, py], shade(col, 1.15));
		}
		g.strokeStyle = shade(col, 0.7); g.lineWidth = 0.8; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.55, -len * 0.32, len, len * 0.32); g.stroke();
		g.restore();
	}
	function crab(g, x, y, s, t, col) {
		var i, side, w = Math.sin(t * 13);
		g.save(); g.translate(x, y);
		g.strokeStyle = shade(col, 0.8); g.lineWidth = s * 0.16; g.lineCap = "round"; g.lineJoin = "round";
		for (side = -1; side <= 1; side += 2) {
			for (i = 0; i < 3; i++) { var lift = (i % 2 ? w : -w) * s * 0.12 * side; g.beginPath(); g.moveTo(side * s * 0.6, -s * 0.3 + i * s * 0.14); g.lineTo(side * s * (1.25 + i * 0.1), -s * 0.55 + i * s * 0.2 + lift); g.lineTo(side * s * (1.5 + i * 0.08), i * s * 0.06 + lift); g.stroke(); }
			g.beginPath(); g.moveTo(side * s * 0.7, -s * 0.55); g.lineTo(side * s * 1.2, -s * 1.15); g.stroke();
			circ(g, side * s * 1.3, -s * 1.38, s * 0.36, col);
			poly(g, [side * s * 1.3, -s * 1.38, side * s * 1.75, -s * 1.75 - w * s * 0.08, side * s * 1.75, -s * 1.3 + w * s * 0.08], "#fbe9d7");
		}
		ell(g, 0, -s * 0.45, s, s * 0.62, col);
		ell(g, -s * 0.2, -s * 0.66, s * 0.5, s * 0.22, shade(col, 1.25));
		stroke(g, [-s * 0.3, -s * 0.95, -s * 0.34, -s * 1.3], col, s * 0.12); stroke(g, [s * 0.3, -s * 0.95, s * 0.34, -s * 1.3], col, s * 0.12);
		circ(g, -s * 0.34, -s * 1.36, s * 0.17, "#ffffff"); circ(g, s * 0.34, -s * 1.36, s * 0.17, "#ffffff");
		circ(g, -s * 0.34, -s * 1.36, s * 0.08, "#1c1c1c"); circ(g, s * 0.34, -s * 1.36, s * 0.08, "#1c1c1c");
		g.restore();
	}
	// Seagull standing on (x, y).
	function gull(g, x, y, s, dir, tilt) {
		g.save(); g.translate(x, y); g.scale(dir, 1); g.rotate(tilt || 0);
		stroke(g, [-s * 0.05, -s * 0.2, -s * 0.05, 0], "#f2a23a", s * 0.07); stroke(g, [s * 0.15, -s * 0.2, s * 0.15, 0], "#f2a23a", s * 0.07);
		poly(g, [-s * 0.45, -s * 0.6, -s * 1.15, -s * 0.62, -s * 0.5, -s * 0.36], "#3c4350");
		ell(g, 0, -s * 0.55, s * 0.7, s * 0.4, "#ffffff", -0.12);
		ell(g, -s * 0.18, -s * 0.6, s * 0.52, s * 0.25, "#aab4c2", 0.12);
		circ(g, s * 0.52, -s * 1.0, s * 0.27, "#ffffff");
		poly(g, [s * 0.74, -s * 1.08, s * 1.18, -s * 0.95, s * 0.74, -s * 0.88], "#f2b632");
		circ(g, s * 0.58, -s * 1.05, s * 0.06, "#1c1c1c");
		g.restore();
	}
	// Bird in flight seen from the side; flap -1..1. Used for gulls, crows and geese.
	function flyer(g, x, y, s, flap, body, tip) {
		g.save(); g.translate(x, y);
		for (var side = -1; side <= 1; side += 2) {
			var ty = -flap * s * 0.55;
			g.fillStyle = body; g.beginPath(); g.moveTo(0, -s * 0.06); g.quadraticCurveTo(side * s * 0.5, -s * 0.4 + ty * 0.5, side * s, ty); g.quadraticCurveTo(side * s * 0.5, -s * 0.06 + ty * 0.45, 0, s * 0.12); g.fill();
			if (tip) { g.fillStyle = tip; g.beginPath(); g.moveTo(side * s * 0.74, ty * 0.74 - s * 0.16); g.lineTo(side * s, ty); g.lineTo(side * s * 0.72, ty * 0.7); g.closePath(); g.fill(); }
		}
		ell(g, 0, 0, s * 0.3, s * 0.14, body);
		g.restore();
	}
	// A few flyers crossing high above the strip; kind "geese" comes through now and then in a V.
	function sky(e, n, body, tip, size, geese) {
		var u = e.u, list = [], i, flock = { on: false, next: e.preview ? 2 : 12 + Math.random() * 20 };
		for (i = 0; i < Math.round(n * e.busy * Math.max(1, e.W / (600 * u))); i++) { list.push({ x: Math.random() * e.W, y: e.gy - (70 + Math.random() * 85) * u, dir: Math.random() < 0.5 ? -1 : 1, v: (20 + Math.random() * 12) * u, ph: Math.random() * TAU, s: size * (0.8 + Math.random() * 0.5) * u }); }
		return function (g, t, dt) {
			for (var j = 0; j < list.length; j++) {
				var f = list[j], glide = Math.sin(t * 0.5 + f.ph) > 0.2;
				f.x += f.dir * f.v * dt;
				if (f.x > e.W + 20 * u) { f.x = -18 * u; f.y = e.gy - (70 + Math.random() * 85) * u; } else if (f.x < -20 * u) { f.x = e.W + 18 * u; f.y = e.gy - (70 + Math.random() * 85) * u; }
				flyer(g, f.x, f.y + Math.sin(t * 0.8 + f.ph) * 4 * u, f.s, glide ? 0.25 + Math.sin(t * 1.2 + f.ph) * 0.1 : Math.sin(t * 7 + f.ph), body, tip);
			}
			if (!geese || e.busy <= 0) { return; }
			if (!flock.on) { flock.next -= dt; if (flock.next <= 0) { flock.on = true; flock.dir = Math.random() < 0.5 ? -1 : 1; flock.x = flock.dir > 0 ? -60 * u : e.W + 60 * u; flock.y = e.gy - (120 + Math.random() * 30) * u; } return; }
			flock.x += flock.dir * 26 * u * dt;
			if (flock.x < -90 * u || flock.x > e.W + 90 * u) { flock.on = false; flock.next = 35 + Math.random() * 40; return; }
			for (var k = 0; k < 7; k++) { var r = Math.ceil(k / 2), sd = k % 2 ? 1 : -1; flyer(g, flock.x - flock.dir * r * 9 * u, flock.y + sd * r * 5 * u + Math.sin(t + k) * u, 3.4 * u, Math.sin(t * 6 + k * 0.9), "#3b3340", null); }
		};
	}

	V.umbrella = { w: 60,
		back: function (b, S) {
			var c = pick(S.R, [["#e63946", "#ffffff"], ["#2a9df4", "#ffffff"], ["#ffb703", "#fb5607"], ["#06d6a0", "#fff3b0"]]);
			stroke(b, [31, 3, 27.5, -44], "#f1f1f1", 1.3); stroke(b, [31.4, 3, 28, -44], "rgba(0,0,0,.15)", 0.5);
			b.save(); b.translate(27.5, -44); b.rotate(-0.08); umbrella(b, 0, -17, 25, 17, c[0], c[1], 6); b.restore();
		},
		front: function (b, S) {
			var c = pick(S.R, ["#2a9df4", "#e63946", "#06d6a0", "#ff8fab"]), i;
			b.save(); b.translate(0, 4);
			ell(b, 44, 5.6, 14, 1.4, "rgba(0,0,0,.14)");
			poly(b, [33, -1, 57, -1, 54, 5.5, 29, 5.5], "#ffffff");
			for (i = 0; i < 4; i++) { poly(b, [33.6 + i * 6.2, -1, 36.6 + i * 6.2, -1, 33 + i * 6.3, 5.5, 29.8 + i * 6.3, 5.5], c); }
			ell(b, 12, 6, 5.4, 1, "rgba(0,0,0,.16)"); beachBall(b, 12, 1, 5, 0.4);
			box(b, 18, -5, 11, 8.5, 1, "#2f7fc1"); box(b, 17.4, -6.6, 12.2, 2.6, 1, "#f4f6f8"); b.fillStyle = "rgba(0,0,0,.15)"; b.fillRect(26, -4, 3, 7.5);
			b.restore();
		}
	};
	V.castle = { w: 54,
		front: function (b, S) {
			var sand = "#eccb8c", dark = "#d2aa66", i;
			function tower(x, w, h) {
				b.fillStyle = sand; b.fillRect(x, -h, w, h); b.fillStyle = dark; b.fillRect(x + w * 0.68, -h, w * 0.32, h);
				b.fillStyle = sand; for (var k = 0; k < 3; k++) { b.fillRect(x - 0.5 + k * (w + 1 - 2.2) / 2, -h - 2, 2.2, 2.2); }
				b.fillStyle = "#8a6a3a"; b.fillRect(x + w * 0.38, -h * 0.7, w * 0.2, 2.6);
			}
			b.save(); b.translate(0, 5);
			ell(b, 24, 0.5, 23, 2.2, "rgba(0,0,0,.14)");
			ell(b, 24, 0, 22, 2.6, dark);
			tower(4, 9, 17); tower(34, 9, 17);
			b.fillStyle = sand; b.fillRect(11, -11, 26, 11); b.fillStyle = dark; b.fillRect(30, -11, 7, 11);
			b.fillStyle = sand; for (i = 0; i < 6; i++) { b.fillRect(11.4 + i * 4.6, -13, 2.3, 2.2); }
			tower(18.5, 10, 25);
			b.fillStyle = "#8a6a3a"; b.beginPath(); b.moveTo(21, 0); b.lineTo(21, -5); b.arc(23.5, -5, 2.5, Math.PI, 0); b.lineTo(26, 0); b.closePath(); b.fill();
			stroke(b, [23.5, -27, 23.5, -37], "#8a6238", 0.5);
			// bucket and spade
			poly(b, [44, -7, 51.5, -7, 50.4, 0.5, 45.1, 0.5], "#2a9df4"); b.fillStyle = "#1f7fd0"; b.fillRect(43.6, -7.6, 8.3, 1.3);
			b.strokeStyle = "#e9eef2"; b.lineWidth = 0.5; b.beginPath(); b.arc(47.75, -7.2, 4, Math.PI * 1.08, Math.PI * 1.92); b.stroke();
			stroke(b, [4, 1.5, 0.5, -9], "#e63946", 0.8); ell(b, 4.6, 2, 1.5, 2.2, "#e63946", -0.3);
			b.restore();
		},
		live: function (g, S, t) {
			var w = Math.sin(t * 4), w2 = Math.sin(t * 4 + 1.2);
			g.fillStyle = "#e63946"; g.beginPath(); g.moveTo(23.5, -32); g.quadraticCurveTo(27, -32.8 + w * 0.8, 30.5, -31.4 + w2 * 1.1); g.lineTo(30.2, -27.6 + w2 * 1.1); g.quadraticCurveTo(27, -29 + w * 0.8, 23.5, -28.2); g.closePath(); g.fill();
		}
	};
	V.palm = { w: 50,
		back: function (b, S) {
			var i, lean = 5 + S.R() * 6, n = 13;
			for (i = 0; i <= n; i++) {
				var k = i / n, x = 22 + 2 * (1 - k) * k * (-lean * 0.6) + k * k * lean, y = 3 - k * 60, w = 3.5 - k * 1.3;
				ell(b, x, y, w, 2.9, i % 2 ? "#a9793f" : "#93652d", -0.1);
			}
			S.top = [22 + lean, -58];
			circ(b, S.top[0] - 2.2, S.top[1] + 1.8, 2.1, "#5a3a1c"); circ(b, S.top[0] + 2, S.top[1] + 2.4, 2.1, "#6b4522"); circ(b, S.top[0], S.top[1] + 3.6, 2, "#4a2f16");
			sway(S, S.top[0], S.top[1], 86, 62, 0.035, function (g) {
				[-1.25, -0.72, -0.2, 0.3].forEach(function (a, i2) { frond(g, a, 30 - i2 * 1.5, i2 % 2 ? "#3f9a4a" : "#2f8540"); g.save(); g.scale(-1, 1); frond(g, a + 0.08, 29 - i2 * 1.5, i2 % 2 ? "#37904a" : "#48a653"); g.restore(); });
			}, 0.55);
		}
	};
	V.crabrock = { w: 42,
		front: function (b, S) {
			b.save(); b.translate(0, 5);
			ell(b, 12, 1, 9.5, 1.6, "rgba(0,0,0,.15)");
			b.fillStyle = "#8d96a3"; b.beginPath(); b.moveTo(3, 1); b.quadraticCurveTo(3, -9, 11, -10); b.quadraticCurveTo(20, -10.5, 21.5, 1); b.closePath(); b.fill();
			b.fillStyle = "#a9b2be"; b.beginPath(); b.moveTo(6, -4); b.quadraticCurveTo(7, -8.6, 12, -8.6); b.quadraticCurveTo(9, -6, 8.4, -3); b.closePath(); b.fill();
			b.save(); b.translate(29, 2); b.rotate(0.3); star(b, 0, 0, 3.6, "#f7813a"); star(b, 0, 0, 1.6, "#ffa560"); b.restore();
			// scallop shell
			b.fillStyle = "#ffd9cf"; b.beginPath(); b.moveTo(37, 6); b.arc(37, 6, 3, Math.PI * 1.08, Math.PI * 1.92); b.closePath(); b.fill();
			b.strokeStyle = "#e8a99a"; b.lineWidth = 0.3; for (var i = -2; i <= 2; i++) { b.beginPath(); b.moveTo(37, 6); b.lineTo(37 + i * 1.2, 3.2); b.stroke(); }
			b.restore();
		},
		live: function (g, S, t) {
			var k = (t / 14) % 1, f = k < 0.4 ? k / 0.4 : k < 0.5 ? 1 : k < 0.9 ? 1 - (k - 0.5) / 0.4 : 0, moving = (k < 0.4) || (k >= 0.5 && k < 0.9);
			crab(g, 8 + ease(f) * 26, 10, 2.6, moving ? t : 0, "#e4572e");
		}
	};
	V.surf = { w: 42,
		back: function (b, S) {
			[[10, -0.12, "#19b5a5", "#ffffff"], [24, 0.1, "#ffd23f", "#e63946"]].forEach(function (q) {
				b.save(); b.translate(q[0], 3); b.rotate(q[1]);
				b.fillStyle = q[2]; b.beginPath(); b.moveTo(-4.4, 0); b.bezierCurveTo(-5.6, -24, -3, -46, 0, -52); b.bezierCurveTo(3, -46, 5.6, -24, 4.4, 0); b.closePath(); b.fill();
				b.fillStyle = q[3]; b.fillRect(-0.7, -50, 1.4, 50);
				b.fillStyle = "rgba(0,0,0,.14)"; b.beginPath(); b.moveTo(1.6, 0); b.bezierCurveTo(2.4, -24, 1.4, -46, 0, -52); b.bezierCurveTo(3, -46, 5.6, -24, 4.4, 0); b.closePath(); b.fill();
				b.restore();
			});
		},
		front: function (b, S) {
			b.save(); b.translate(32, 8);
			[[0, 0.25], [4.6, 0.1]].forEach(function (q) { b.save(); b.translate(q[0], 0); b.rotate(q[1]); box(b, -1.5, -3.6, 3, 6.6, 1.4, "#ff7aa8"); stroke(b, [-1.1, -1, 0, -2.6, 1.1, -1], "#ffffff", 0.5); b.restore(); });
			b.restore();
		}
	};
	V.lifeguard = { w: 50,
		back: function (b, S) {
			var wood = "#f6f1e7", dk = "#cfc6b4";
			stroke(b, [8, 3, 13, -30], dk, 1.6); stroke(b, [40, 3, 35, -30], dk, 1.6); stroke(b, [14, 3, 15.5, -30], wood, 1.6); stroke(b, [34, 3, 32.5, -30], wood, 1.6);
			stroke(b, [10.5, -12, 37.5, -12], dk, 1.1); stroke(b, [10, -9, 38, -24], dk, 0.8);
			box(b, 8, -32.5, 32, 3, 0.6, wood);
			b.fillStyle = wood; b.fillRect(12, -50, 24, 18); b.fillStyle = dk; b.fillRect(30, -50, 6, 18);
			b.fillStyle = "#3d5a73"; b.fillRect(15.5, -46, 9, 8);
			poly(b, [9, -50, 24, -58, 39, -50], "#e63946"); poly(b, [24, -58, 39, -50, 35, -50, 24, -55.6], "rgba(0,0,0,.18)");
			stroke(b, [8.5, -32.5, 8.5, -40, 39.5, -40, 39.5, -32.5], wood, 0.9);
			// life ring
			b.strokeStyle = "#e63946"; b.lineWidth = 2.2; b.beginPath(); b.arc(32, -22, 4, 0, TAU); b.stroke();
			b.strokeStyle = "#ffffff"; b.lineWidth = 2.3; for (var i = 0; i < 4; i++) { b.beginPath(); b.arc(32, -22, 4, i * Math.PI / 2 + 0.5, i * Math.PI / 2 + 1.05); b.stroke(); }
			stroke(b, [38, -58, 38, -70], "#8a6238", 0.6);
		},
		live: function (g, S, t) {
			var w = Math.sin(t * 3.4), w2 = Math.sin(t * 3.4 + 1.1);
			g.fillStyle = "#ffd23f"; g.beginPath(); g.moveTo(38, -70); g.quadraticCurveTo(42.5, -71 + w, 47, -69.4 + w2 * 1.2); g.lineTo(46.6, -64.4 + w2 * 1.2); g.quadraticCurveTo(42.5, -66 + w, 38, -65); g.closePath(); g.fill();
		}
	};
	V.gullpost = { w: 22,
		back: function (b, S) {
			b.fillStyle = "#8a6238"; b.fillRect(8.5, -24, 5, 27); b.fillStyle = "rgba(0,0,0,.2)"; b.fillRect(12, -24, 1.5, 27);
			ell(b, 11, -24, 2.5, 0.9, "#a67c4c");
			b.strokeStyle = "#e8dcc0"; b.lineWidth = 0.9; for (var i = 0; i < 3; i++) { b.beginPath(); b.moveTo(8.3, -14 + i * 1.6); b.lineTo(13.7, -13.4 + i * 1.6); b.stroke(); }
		},
		live: function (g, S, t) {
			var dir = Math.floor(t / 5) % 2 ? -1 : 1, k = t % 5;
			gull(g, 11, -24.4, 5.6, dir, k > 3.6 && k < 4.2 ? Math.sin((k - 3.6) / 0.6 * Math.PI) * 0.25 : Math.sin(t * 1.3) * 0.02);
		}
	};
	V.deckchair = { w: 46,
		front: function (b, S) {
			var c = pick(S.R, ["#2a9df4", "#e63946", "#ffb703", "#19b5a5"]), i;
			b.save(); b.translate(0, 5);
			ell(b, 16, 0.6, 14, 1.5, "rgba(0,0,0,.14)");
			stroke(b, [4, 0, 24, -19], "#a67c4c", 1); stroke(b, [26, 0, 8, -9], "#a67c4c", 1); stroke(b, [8, -9, 3, -9.4], "#a67c4c", 1);
			b.save(); b.beginPath(); b.moveTo(24.3, -19.5); b.quadraticCurveTo(15, -8, 6.6, -9.6); b.lineTo(7.6, -7.2); b.quadraticCurveTo(16, -5.4, 26, -18.6); b.closePath(); b.clip();
			for (i = 0; i < 8; i++) { b.fillStyle = i % 2 ? "#ffffff" : c; b.save(); b.translate(5 + i * 3, 0); b.rotate(-0.75); b.fillRect(0, -30, 2.6, 40); b.restore(); }
			b.restore();
			// side table with a drink
			stroke(b, [35, 0, 35, -7], "#a67c4c", 0.9); ell(b, 35, -7.2, 5, 1.1, "#c49a66");
			poly(b, [33, -13, 37, -13, 36.4, -7.8, 33.6, -7.8], "rgba(255,255,255,.55)"); poly(b, [33.25, -11.2, 36.75, -11.2, 36.4, -7.8, 33.6, -7.8], "#ff9f1c");
			stroke(b, [35.6, -9, 37.6, -15.4], "#e63946", 0.4);
			b.fillStyle = "#ffd23f"; b.beginPath(); b.arc(33.4, -14.2, 2.2, Math.PI, 0); b.fill(); stroke(b, [33.4, -14.2, 33.6, -11.6], "#8a6238", 0.3);
			// radio
			box(b, 39.5, -4.6, 6, 4.6, 0.8, "#e63946"); circ(b, 41.4, -2.3, 1.2, "#3a2a2a"); stroke(b, [44.6, -4.6, 46.4, -9.6], "#9aa3b2", 0.3);
			b.restore();
		},
		live: function (g, S, t) {
			for (var i = 0; i < 2; i++) { var q = ((t * 0.3 + i * 0.5) % 1); g.globalAlpha = Math.sin(q * Math.PI) * 0.9; g.fillStyle = "#ffffff"; g.font = "700 4.6px sans-serif"; g.fillText(i ? "\u266b" : "\u266a", 43 + Math.sin(q * 5 + i) * 2.5, -2 - q * 15); }
			g.globalAlpha = 1;
		}
	};
	V.boat = { w: 60,
		back: function (b, S) {
			var c = pick(S.R, ["#2f6fa8", "#c0392b", "#19857b"]);
			b.save(); b.translate(30, 2); b.rotate(-0.07);
			stroke(b, [-8, -8, 22, -24], "#a67c4c", 0.9); ell(b, 23.6, -24.9, 3, 1.3, "#c49a66", -0.5);
			b.fillStyle = c; b.beginPath(); b.moveTo(-27, -11); b.lineTo(27, -11); b.quadraticCurveTo(24, 1.5, 13, 2); b.lineTo(-16, 2); b.quadraticCurveTo(-25, 0, -27, -11); b.closePath(); b.fill();
			b.fillStyle = "#f4f1e8"; b.beginPath(); b.moveTo(-27.6, -12.4); b.lineTo(27.8, -12.4); b.lineTo(26.6, -8.6); b.lineTo(-26.6, -8.6); b.closePath(); b.fill();
			b.fillStyle = "rgba(0,0,0,.16)"; b.beginPath(); b.moveTo(4, -8.6); b.lineTo(26.6, -8.6); b.quadraticCurveTo(24, 1.5, 13, 2); b.lineTo(8, 2); b.closePath(); b.fill();
			b.fillStyle = "#e63946"; b.fillRect(-18, -0.2, 32, 1.4);
			b.restore();
		},
		front: function (b, S) {
			b.save(); b.translate(8, 9);
			stroke(b, [0, -9, 0, 0], "#5d6673", 0.9); stroke(b, [-2.2, -7, 2.2, -7], "#5d6673", 0.8);
			b.strokeStyle = "#5d6673"; b.lineWidth = 0.9; b.beginPath(); b.arc(0, -2.6, 3.4, 0.15, Math.PI - 0.15); b.stroke();
			b.strokeStyle = "#5d6673"; b.lineWidth = 0.6; b.beginPath(); b.arc(0, -10.2, 1.2, 0, TAU); b.stroke();
			b.restore();
		}
	};

	SCENES.beach = {
		deck: ["umbrella", "castle", "palm", "crabrock", "surf", "lifeguard", "gullpost", "deckchair", "boat", "palm"],
		far: function (b, e) {
			var u = e.u, Rf = SSO.seeded("dune" + e.seed), px;
			farHill(b, e, "#f1dba6", 0.8);
			for (px = Rf() * 20 * u; px < e.W; px += (10 + Rf() * 46) * u) {
				var y = hillY(e, px, 0.8) + 1.5 * u;
				for (var k = 0; k < 5; k++) { var h = (5 + Rf() * 6) * u, lean = (Rf() - 0.5) * h; stroke(b, [px + k * 0.9 * u, y, px + k * 0.9 * u + lean * 0.4, y - h * 0.6, px + k * 0.9 * u + lean, y - h], k % 2 ? "#a7b56c" : "#8da152", Math.max(1, 0.55 * u)); }
			}
		},
		ground: function (b, e) {
			var u = e.u, Rf = SSO.seeded("sand" + e.seed), i;
			ground(b, e, "#f9e8b8", "#e2bd7d", "rgba(255,255,255,.55)");
			for (i = 0; i < e.W / (2.4 * u); i++) { b.fillStyle = Rf() < 0.5 ? "rgba(190,150,90,.4)" : "rgba(255,255,255,.5)"; b.fillRect(Rf() * e.W, e.gy + Rf() * 24 * u, 0.7 * u, 0.7 * u); }
			b.strokeStyle = "rgba(190,150,90,.32)"; b.lineWidth = Math.max(1, 0.5 * u); b.lineCap = "round";
			for (i = 0; i < e.W / (40 * u); i++) { var x = Rf() * e.W, y = e.gy + (4 + Rf() * 14) * u, w = (8 + Rf() * 12) * u; b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + w / 2, y - 1.6 * u, x + w, y); b.stroke(); }
		},
		// the tide lapping along the very bottom edge
		fore: function (g, e, t) {
			var u = e.u, base = e.H - 5 * u, reach = (0.5 + 0.5 * Math.sin(t * 0.7)) * 4.6 * u, px, step = 13 * u;
			function wy(x) { return base - reach + Math.sin(x / (38 * u) + t * 1.1) * 1.1 * u + Math.sin(x / (95 * u) - t * 0.6) * 1.5 * u; }
			g.fillStyle = "rgba(160,120,70,.3)"; g.beginPath(); g.moveTo(0, e.H);
			for (px = 0; px <= e.W + step; px += step) { g.lineTo(px, base - 5.2 * u + Math.sin(px / (60 * u)) * 1.1 * u); }
			g.lineTo(e.W + step, e.H); g.closePath(); g.fill();
			g.fillStyle = lin(g, 0, base - 5 * u, 0, e.H, "rgba(125,222,224,.86)", "#2aa6c8"); g.beginPath(); g.moveTo(0, e.H);
			for (px = 0; px <= e.W + step; px += step) { g.lineTo(px, wy(px)); }
			g.lineTo(e.W + step, e.H); g.closePath(); g.fill();
			g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 1.5 * u; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
			for (px = 0; px <= e.W + step; px += step) { if (px) { g.lineTo(px, wy(px)); } else { g.moveTo(px, wy(px)); } }
			g.stroke();
			g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 0.8 * u; g.beginPath();
			for (px = 0; px <= e.W + step; px += step) { var y2 = wy(px + 30 * u) + 3.2 * u; if (px) { g.lineTo(px, y2); } else { g.moveTo(px, y2); } }
			g.stroke();
		},
		roam: function (e) {
			var gulls = sky(e, 1.4, "#ffffff", "#5a6472", 6.5, false), u = e.u, crabs = [], i;
			for (i = 0; i < Math.round(0.8 * e.busy * Math.max(1, e.W / (600 * u))); i++) { crabs.push({ x: Math.random() * e.W, y: e.gy + (11 + Math.random() * 5) * u, dir: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 9 }); }
			return function (g, t, dt) {
				gulls(g, t, dt);
				for (var j = 0; j < crabs.length; j++) {
					var c = crabs[j], go = Math.sin(t * 0.6 + c.ph) > -0.3;
					if (go) { c.x += c.dir * 9 * u * dt; }
					if (c.x > e.W + 10 * u) { c.x = -8 * u; } else if (c.x < -10 * u) { c.x = e.W + 8 * u; }
					crab(g, c.x, c.y, 3.2 * u, go ? t + c.ph : 0, "#e9633a");
				}
			};
		}
	};

	// ---------------------------------------------------------------- autumn harvest
	var FALL = ["#c2410c", "#ea580c", "#f59e0b", "#dc2626", "#b45309", "#eab308"];
	function hayBale(g, x, y, w, h) {
		box(g, x, y - h, w, h, 1.4, "#e2b64e");
		g.fillStyle = "rgba(0,0,0,.13)"; g.fillRect(x + w * 0.78, y - h, w * 0.22, h);
		g.strokeStyle = "rgba(150,105,30,.55)"; g.lineWidth = 0.35; g.lineCap = "round";
		for (var i = 0; i < 26; i++) { var px = x + 1 + ((i * 7.3) % (w - 5)), py = y - 1.2 - ((i * 3.7) % (h - 2.4)); g.beginPath(); g.moveTo(px, py); g.lineTo(px + 2.6, py - 0.5 + (i % 3) * 0.4); g.stroke(); }
		g.fillStyle = "#a67832"; g.fillRect(x + w * 0.24, y - h, 0.9, h); g.fillRect(x + w * 0.66, y - h, 0.9, h);
		g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(x + 1, y - h, w - 2, 1);
	}
	// Crow standing on (x, y). peck dips its head.
	function crow(g, x, y, s, dir, peck) {
		g.save(); g.translate(x, y); g.scale(dir, 1);
		stroke(g, [-s * 0.05, -s * 0.2, -s * 0.05, 0], "#3a3a3a", s * 0.07); stroke(g, [s * 0.15, -s * 0.2, s * 0.15, 0], "#3a3a3a", s * 0.07);
		poly(g, [-s * 0.4, -s * 0.62, -s * 1.25, -s * 0.42, -s * 0.5, -s * 0.34], "#17151c");
		ell(g, 0, -s * 0.55, s * 0.68, s * 0.4, "#1d1b24", -0.18);
		ell(g, -s * 0.16, -s * 0.6, s * 0.48, s * 0.22, "#2d2a38", 0.2);
		g.save(); g.translate(s * 0.4, -s * 0.75); g.rotate(peck || 0);
		circ(g, s * 0.12, -s * 0.22, s * 0.27, "#1d1b24");
		poly(g, [s * 0.34, -s * 0.32, s * 0.86, -s * 0.16, s * 0.34, -s * 0.08], "#4a4756");
		circ(g, s * 0.2, -s * 0.28, s * 0.06, "#f1f1f1");
		g.restore(); g.restore();
	}
	function apple(g, x, y, r, col) {
		circ(g, x, y, r, col); circ(g, x - r * 0.3, y - r * 0.3, r * 0.3, "rgba(255,255,255,.35)");
		stroke(g, [x, y - r * 0.8, x + r * 0.2, y - r * 1.35], "#5a3a1c", r * 0.16);
	}
	function basket(g, x, y, w, h, col) {
		poly(g, [x, y - h, x + w, y - h, x + w * 0.88, y, x + w * 0.12, y], col);
		g.strokeStyle = shade(col, 0.72); g.lineWidth = 0.35;
		for (var i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x + w * i / 6, y - h); g.lineTo(x + w * (0.12 + 0.76 * i / 6), y); g.stroke(); }
		for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + w * 0.03 * i, y - h + h * i / 4); g.lineTo(x + w - w * 0.03 * i, y - h + h * i / 4); g.stroke(); }
		box(g, x - 0.6, y - h - 1, w + 1.2, 1.8, 0.8, shade(col, 0.8));
	}
	function turkey(g, x, y, s, dir, bob) {
		var cols = ["#8a4b1c", "#e07a2a", "#f6c453", "#b5451b"], i;
		g.save(); g.translate(x, y); g.scale(dir, 1);
		stroke(g, [-s * 0.06, -s * 0.16, -s * 0.06, 0], "#e09a3a", s * 0.05); stroke(g, [s * 0.12, -s * 0.16, s * 0.12, 0], "#e09a3a", s * 0.05);
		for (i = 0; i < 9; i++) {
			g.save(); g.translate(-s * 0.12, -s * 0.42); g.rotate(-1.95 + i * 0.33);
			ell(g, 0, -s * 0.5, s * 0.13, s * 0.5, cols[i % 2 ? 0 : 3]); ell(g, 0, -s * 0.78, s * 0.115, s * 0.2, cols[1]); ell(g, 0, -s * 0.92, s * 0.1, s * 0.09, cols[2]);
			g.restore();
		}
		ell(g, 0, -s * 0.38, s * 0.4, s * 0.32, "#6b3a18");
		ell(g, -s * 0.06, -s * 0.36, s * 0.24, s * 0.18, "#8a4b1c", 0.3);
		g.save(); g.translate(s * 0.28, -s * 0.5 + bob * s * 0.03); g.rotate(bob * 0.12);
		stroke(g, [0, 0, s * 0.12, -s * 0.3], "#6b3a18", s * 0.14);
		circ(g, s * 0.15, -s * 0.38, s * 0.12, "#7aa0b8");
		poly(g, [s * 0.24, -s * 0.42, s * 0.42, -s * 0.36, s * 0.24, -s * 0.31], "#f2b632");
		ell(g, s * 0.25, -s * 0.24, s * 0.045, s * 0.1, "#d7263d", -0.2);
		circ(g, s * 0.18, -s * 0.41, s * 0.025, "#1c1c1c");
		g.restore(); g.restore();
	}
	function squirrel(g, x, y, s, dir, tail) {
		g.save(); g.translate(x, y); g.scale(dir, 1);
		g.fillStyle = "#b5652a"; g.beginPath(); g.moveTo(-s * 0.26, -s * 0.1); g.bezierCurveTo(-s * 1.05, -s * 0.2, -s * (1.1 + tail * 0.2), -s * 1.15, -s * (0.5 + tail * 0.3), -s * 1.3); g.bezierCurveTo(-s * 0.1, -s * 1.3, -s * 0.5, -s * 0.6, -s * 0.2, -s * 0.36); g.closePath(); g.fill();
		g.fillStyle = "#d98a4a"; g.beginPath(); g.moveTo(-s * 0.4, -s * 0.3); g.bezierCurveTo(-s * 0.85, -s * 0.5, -s * (0.85 + tail * 0.2), -s * 1.0, -s * (0.52 + tail * 0.3), -s * 1.14); g.bezierCurveTo(-s * 0.38, -s * 1.0, -s * 0.55, -s * 0.6, -s * 0.4, -s * 0.3); g.fill();
		ell(g, 0, -s * 0.34, s * 0.3, s * 0.36, "#a85a24");
		ell(g, s * 0.08, -s * 0.3, s * 0.16, s * 0.24, "#f1dcc0");
		circ(g, s * 0.16, -s * 0.8, s * 0.2, "#a85a24");
		poly(g, [s * 0.04, -s * 0.94, s * 0.06, -s * 1.14, s * 0.18, -s * 0.98], "#a85a24");
		circ(g, s * 0.24, -s * 0.84, s * 0.035, "#1c1c1c"); circ(g, s * 0.36, -s * 0.76, s * 0.03, "#3a2a20");
		ell(g, s * 0.3, -s * 0.5, s * 0.09, s * 0.11, "#7a4a1c"); ell(g, s * 0.3, -s * 0.58, s * 0.1, s * 0.05, "#5a3413");
		g.restore();
	}

	V.pumpkinpile = { w: 56,
		back: function (b, S) {
			var i;
			for (i = 0; i < 11; i++) { var a = -0.5 + i * 0.1, tx = 32 + Math.sin(a) * 30, ty = -38 - Math.cos(a) * 6; stroke(b, [30 + (i - 5) * 0.9, 3, 31, -20, tx, ty], i % 2 ? "#d9b04a" : "#c49a38", 0.5); ell(b, tx + Math.sin(a) * 1.5, ty - 2.2, 0.9, 2.6, "#e8c25a", a); }
			b.fillStyle = "#8a5a2a"; b.fillRect(28.4, -21.5, 5.4, 1.6);
			A.pumpkin(b, 6, 3, 4.6, { col: [132, 158, 66], squash: 1.05, stem: "#6f6a3a" });
			A.pumpkin(b, 19, 3, 11.5, { col: [236, 124, 26], tilt: -0.04 });
			A.pumpkin(b, 47.5, 3, 5.2, { col: [238, 230, 212], squash: 0.72, stem: "#8a7a4a" });
			A.pumpkin(b, 37, 3, 8, { col: [246, 152, 44], squash: 0.9, tilt: 0.07 });
		},
		front: function (b, S) { for (var i = 0; i < 5; i++) { ell(b, 4 + S.R() * 48, 6 + S.R() * 10, 1.5, 0.8, pick(S.R, FALL), S.R() * 3); } }
	};
	V.haybales = { w: 58,
		back: function (b, S) {
			stroke(b, [50, 3, 44, -44], "#8a6238", 0.9); stroke(b, [41.6, -43.5, 46.4, -44.5], "#6b7280", 0.8);
			[[41.6, -43.5], [44, -44], [46.4, -44.5]].forEach(function (p) { stroke(b, [p[0], p[1], p[0] - 1.1, p[1] - 8], "#6b7280", 0.5); });
			hayBale(b, 2, 3, 27, 16); hayBale(b, 28, 3, 26, 16); hayBale(b, 13, -13, 27, 15);
			for (var i = 0; i < 9; i++) { stroke(b, [3 + S.R() * 50, 3, 1 + S.R() * 54, 3 - 2 - S.R() * 2], "#e2b64e", 0.35); }
		},
		live: function (g, S, t) {
			var k = t % 8, peck = k > 5 && k < 6.6 ? Math.max(0, Math.sin((k - 5) * Math.PI * 2.5)) * 0.8 : 0, dir = Math.floor(t / 16) % 2 ? -1 : 1;
			crow(g, 26, -28, 5.4, dir, peck);
		}
	};
	V.scarecrow = { w: 44,
		front: function (b, S) {
			var shirt = pick(S.R, ["#c0392b", "#2f6fa8", "#3d8b4f"]);
			sway(S, 22, 4, 48, 68, 0.022, function (g) {
				var i, side;
				g.fillStyle = "#8a6238"; g.fillRect(-1.1, -58, 2.2, 58); g.fillRect(-18, -43.2, 36, 2);
				// trousers
				box(g, -5.6, -24, 4.8, 13, 1, "#3f5f8f"); box(g, 0.8, -24, 4.8, 13, 1, "#35527c");
				for (side = -1; side <= 1; side += 2) { for (i = 0; i < 5; i++) { stroke(g, [side * 3.2 + (i - 2) * 0.8, -11.5, side * 3.2 + (i - 2) * 1.5, -7.2], "#e2b64e", 0.4); } }
				// shirt with sleeves
				poly(g, [-7, -45, 7, -45, 6.4, -22, -6.4, -22], shirt);
				box(g, -17, -46, 11, 5.6, 1.6, shirt); box(g, 6, -46, 11, 5.6, 1.6, shirt);
				g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(2.4, -45, 4.3, 23);
				g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = 0.4; for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-6.6, -41 + i * 5); g.lineTo(6.6, -41 + i * 5); g.stroke(); g.beginPath(); g.moveTo(-4.5 + i * 3, -45); g.lineTo(-4.5 + i * 3, -22); g.stroke(); }
				box(g, -4.6, -34, 3.6, 3.6, 0.4, "#f2c14e"); box(g, 1.6, -29, 3, 3, 0.4, "#7fb069");
				for (side = -1; side <= 1; side += 2) { for (i = 0; i < 6; i++) { stroke(g, [side * 17, -45.2 + i * 0.8, side * (20.5 + (i % 3) * 0.9), -47 + i * 1.5], "#e2b64e", 0.4); } }
				for (i = 0; i < 7; i++) { stroke(g, [-3 + i, -22, -4.2 + i * 1.4, -19], "#e2b64e", 0.4); }
				// head
				circ(g, 0, -51.5, 6.2, "#dcbc82"); g.fillStyle = "rgba(0,0,0,.1)"; g.beginPath(); g.arc(0, -51.5, 6.2, -0.9, 1.2); g.fill();
				circ(g, -2.3, -52.6, 1, "#2a2020"); circ(g, 2.3, -52.6, 1, "#2a2020");
				poly(g, [0, -51.5, 2.6, -50.2, 0, -49.6], "#e07a2a");
				g.strokeStyle = "#5a3413"; g.lineWidth = 0.4; g.beginPath(); g.arc(0, -50.6, 3.4, 0.5, Math.PI - 0.5); g.stroke();
				for (i = 0; i < 4; i++) { var a = 0.7 + i * 0.58; stroke(g, [Math.cos(a) * 3 , -50.6 + Math.sin(a) * 3, Math.cos(a) * 3.9, -50.6 + Math.sin(a) * 3.9], "#5a3413", 0.35); }
				for (i = 0; i < 6; i++) { stroke(g, [-6 + i * 0.6, -54, -8.4 + i * 0.5, -50.6 + (i % 2)], "#e2b64e", 0.4); stroke(g, [6 - i * 0.6, -54, 8.4 - i * 0.5, -50.6 + (i % 2)], "#e2b64e", 0.4); }
				// hat
				ell(g, 0, -56.2, 10, 1.8, "#a9772f"); poly(g, [-5.2, -56.4, -3.6, -63.4, 3.6, -63.4, 5.2, -56.4], "#b8873a"); g.fillStyle = "#c0392b"; g.fillRect(-5, -58.4, 10, 1.7);
			});
		},
		live: function (g, S, t) {
			var k = t % 11;
			crow(g, 33, -39.2, 4.2, -1, k > 8 && k < 9 ? Math.sin((k - 8) * Math.PI * 3) * 0.3 : 0);
		}
	};
	V.cornshock = { w: 36,
		back: function (b, S) {
			var cols = ["#d9c27a", "#c9a85a", "#b9a05a", "#a8904a", "#e2cf8a"], i;
			for (i = 0; i < 16; i++) {
				var k = i / 15, bx = 4 + k * 28, tx = 18 + (k - 0.5) * 34 + (S.R() - 0.5) * 4, ty = -48 - S.R() * 10;
				b.strokeStyle = cols[i % cols.length]; b.lineWidth = 1.5; b.lineCap = "round"; b.beginPath(); b.moveTo(bx, 3); b.quadraticCurveTo(18 + (k - 0.5) * 6, -24, tx, ty); b.stroke();
				if (i % 2) { b.lineWidth = 1; b.beginPath(); b.moveTo(18 + (k - 0.5) * 12, -32); b.quadraticCurveTo(tx + (k - 0.5) * 8, ty + 4, tx + (k - 0.5) * 22, ty + 16); b.stroke(); }
			}
			b.fillStyle = "#8a5a2a"; b.fillRect(12.4, -25.6, 11.2, 2.2);
			[[10, -8, -0.5], [27, -10, 0.5]].forEach(function (c) { b.save(); b.translate(c[0], c[1]); b.rotate(c[2]); ell(b, 0, 0, 1.7, 4.6, "#f2c230"); ell(b, -0.9, 1.6, 1.3, 3.6, "#b8b060", 0.3); b.strokeStyle = "rgba(160,110,20,.5)"; b.lineWidth = 0.25; b.beginPath(); b.moveTo(0, -4); b.lineTo(0, 3); b.stroke(); b.restore(); });
			A.pumpkin(b, 30, 3, 4.6, { col: [236, 124, 26] });
		}
	};
	V.maple = { w: 78,
		back: function (b, S) {
			trunk(b, 36, 44, 4.6, "#5a3d28", -2);
			canopy(b, 35, -64, 31, 20, S.R, ["#a63c12", "#e0692a", "#f8b048"], 34);
			for (var i = 0; i < 22; i++) { var a = S.R() * TAU, k = Math.sqrt(S.R()); circ(b, 35 + Math.cos(a) * 29 * k, -64 + Math.sin(a) * 18 * k, 1.5, i % 2 ? "#c0392b" : "#ffd166"); }
			stroke(b, [70, 3, 60, -30], "#a67c4c", 0.9); stroke(b, [56.5, -27, 62.5, -33], "#6b7280", 0.8);
			for (i = 0; i < 5; i++) { stroke(b, [56.8 + i * 1.4, -27.3 - i * 1.4, 54.6 + i * 1.4, -25 - i * 1.4], "#6b7280", 0.4); }
		},
		front: function (b, S) {
			var spr = SSO.leafSprites ? SSO.leafSprites() : null, i;
			for (i = 0; i < 26; i++) {
				var a = S.R() * Math.PI, k = Math.sqrt(S.R()), x = 58 + Math.cos(a) * 12 * k, y = 12 - Math.sin(a) * 8 * k, s = 2.4 + S.R() * 1.2;
				b.save(); b.translate(x, y); b.rotate(S.R() * TAU); b.scale(1, 0.6);
				if (spr) { b.drawImage(spr[i % spr.length], -s, -s, s * 2, s * 2); } else { ell(b, 0, 0, s, s * 0.6, FALL[i % FALL.length]); }
				b.restore();
			}
		},
		live: function (g, S, t, dt) { shed(g, S, dt, 35, -60, 28, 14, FALL, 1.3, 1.7); }
	};
	V.wheelbarrow = { w: 50,
		back: function (b, S) {
			A.pumpkin(b, 20, -12, 6, { col: [236, 124, 26], shadow: false }); A.pumpkin(b, 31, -12.5, 5, { col: [246, 160, 50], shadow: false, squash: 0.9 }); A.pumpkin(b, 26, -17, 4, { col: [238, 230, 212], shadow: false, stem: "#8a7a4a" });
			stroke(b, [38, -9, 39, 3], "#7a5230", 1.3); stroke(b, [40, -16, 50, -20], "#9a6b3c", 1.3);
			poly(b, [10, -17.5, 42, -17.5, 38, -6, 15.5, -6], "#9a6b3c"); poly(b, [33, -17.5, 42, -17.5, 38, -6, 31, -6], "rgba(0,0,0,.16)");
			b.fillStyle = "rgba(255,255,255,.14)"; b.fillRect(10.4, -17.5, 31, 1);
			b.strokeStyle = "rgba(60,35,15,.4)"; b.lineWidth = 0.35; b.beginPath(); b.moveTo(12.4, -13.6); b.lineTo(40.4, -13.6); b.moveTo(14, -9.8); b.lineTo(39.2, -9.8); b.stroke();
			circ(b, 14, -1.6, 5, "#2a2a30"); circ(b, 14, -1.6, 3.2, "#8a6238"); circ(b, 14, -1.6, 1, "#2a2a30");
		}
	};
	V.apples = { w: 42,
		front: function (b, S) {
			b.save(); b.translate(0, 10);
			ell(b, 20, 0.6, 19, 1.7, "rgba(0,0,0,.14)");
			[[8.5, -9.2, "#d7263d"], [12.6, -9.8, "#e63946"], [16.6, -9.2, "#c81d33"], [10.6, -11.6, "#e63946"], [14.6, -11.8, "#d7263d"]].forEach(function (q) { apple(b, q[0], q[1], 2.2, q[2]); });
			basket(b, 5, 0, 15, 9, "#c9974f");
			[[26.5, -7.4, "#8fc93a"], [30.4, -7.8, "#a4d65e"], [28.4, -9.6, "#8fc93a"]].forEach(function (q) { apple(b, q[0], q[1], 2.1, q[2]); });
			basket(b, 23, 0, 11.5, 7.4, "#b9843f");
			apple(b, 2.5, 2, 2, "#e63946"); apple(b, 21.4, 3.6, 1.9, "#8fc93a");
			// cider jug
			b.fillStyle = "#8a5a2a"; b.beginPath(); b.moveTo(36, 1); b.quadraticCurveTo(34.4, -7, 37, -9.4); b.lineTo(37, -12); b.lineTo(39.4, -12); b.lineTo(39.4, -9.4); b.quadraticCurveTo(42, -7, 40.4, 1); b.closePath(); b.fill();
			b.strokeStyle = "#8a5a2a"; b.lineWidth = 0.7; b.beginPath(); b.arc(40.4, -9, 1.6, -1.6, 1.4); b.stroke(); box(b, 37.2, -13, 2, 1.4, 0.3, "#d9c08a");
			b.fillStyle = "rgba(255,255,255,.2)"; b.fillRect(36.4, -6, 0.9, 5);
			b.restore();
		}
	};
	V.sunflowers = { w: 34, front: function (b, S) {
		for (var i = 0; i < 3; i++) {
			(function (i) { var h = 32 + S.R() * 13, lean = (S.R() - 0.5) * 5; sway(S, 7 + i * 10 + (S.R() - 0.5) * 3, 5 + i * 3 + S.R() * 3, 26, h + 14, 0.03, function (g) { sunflower(g, h, lean); }); })(i);
		}
	} };
	V.turkey = { w: 36,
		live: function (g, S, t) {
			var k = t % 6, bob = Math.sin(t * 2.2) + (k > 4 && k < 5 ? Math.sin((k - 4) * Math.PI * 4) * 2 : 0), dir = Math.floor(t / 12) % 2 ? -1 : 1;
			ell(g, 18, 11, 8, 1.3, "rgba(0,0,0,.16)");
			turkey(g, 18, 10.6, 17, dir, bob);
		}
	};
	V.squirrel = { w: 30,
		front: function (b, S) {
			b.save(); b.translate(0, 9);
			poly(b, [7, 1, 8.4, -8, 21.6, -8, 23, 1], "#7a5230"); ell(b, 15, -8, 6.7, 1.8, "#c49a66");
			b.strokeStyle = "rgba(90,60,30,.6)"; b.lineWidth = 0.3; b.beginPath(); b.ellipse(15, -8, 4, 1, 0, 0, TAU); b.stroke(); b.beginPath(); b.ellipse(15, -8, 1.8, 0.45, 0, 0, TAU); b.stroke();
			ell(b, 26, 1, 1.2, 1.5, "#7a4a1c"); ell(b, 26, 0, 1.3, 0.6, "#5a3413");
			b.restore();
		},
		live: function (g, S, t) { var k = t % 5; squirrel(g, 15, 1.2, 9, Math.floor(t / 10) % 2 ? -1 : 1, k > 3.6 && k < 4.4 ? Math.sin((k - 3.6) * Math.PI * 5) : Math.sin(t * 1.4) * 0.15); }
	};

	SCENES.autumn = meadow("#c8a646", "#8a6c26", ["#dcc063", "#b8963c", "#96802f"], "#e3c069", ["#a63c12", "#e0692a", "#f8b048"], ["#c0392b", "#ffd166"], ["#c2410c", "#f59e0b", "#dc2626", "#eab308"]);
	SCENES.autumn.far = function (b, e) {
		var u = e.u, Rf = SSO.seeded("far" + e.seed), px, pals = [["#a63c12", "#e0692a", "#f8b048"], ["#8f2d16", "#c9452a", "#ee7b4a"], ["#b97a12", "#e9aa28", "#ffd166"]];
		farHill(b, e, "#e3c069");
		for (px = Rf() * 30 * u; px < e.W; px += (26 + Rf() * 60) * u) {
			var r = (6 + Rf() * 6) * u, y = hillY(e, px) + 2 * u;
			b.fillStyle = "#6b4630"; b.fillRect(px - 0.7 * u, y - r * 1.2, 1.4 * u, r * 1.2);
			b.save(); b.translate(px, y - r * 1.25); bush(b, r, pals[Math.floor(Rf() * 3)]); b.restore();
		}
	};
	SCENES.autumn.deck = ["pumpkinpile", "maple", "haybales", "scarecrow", "cornshock", "wheelbarrow", "apples", "sunflowers", "turkey", "squirrel"];
	SCENES.autumn.roam = function (e) { return sky(e, 0.7, "#2a2630", null, 5, true); };
	SCENES.autumn.drift = function (e) { return drifter(e, "leaf", FALL); };

	// ---------------------------------------------------------------- Halloween graveyard
	var STONE = ["#a3a5ba", "#6c6e88"], NIGHT = "#1b1828", RIM = "rgba(160,135,225,.45)";
	// Headstone standing in the grass. kind 0 = rounded with RIP, 1 = cross, 2 = small plain.
	function tomb(g, x, w, h, tilt, kind) {
		g.save(); g.translate(x, 3); g.rotate(tilt || 0);
		g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, STONE[0], STONE[1]);
		if (kind === 1) {
			g.fillRect(-w * 0.17, -h, w * 0.34, h); g.fillRect(-w / 2, -h * 0.76, w, w * 0.32);
			g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(w * 0.05, -h, w * 0.12, h); g.fillRect(-w / 2, -h * 0.76 + w * 0.22, w, w * 0.1);
		} else {
			g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + w / 2); g.arc(0, -h + w / 2, w / 2, Math.PI, 0); g.lineTo(w / 2, 0); g.closePath(); g.fill();
			g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.moveTo(w * 0.3, 0); g.lineTo(w * 0.3, -h + w / 2); g.arc(0, -h + w / 2, w / 2, -0.93, 0); g.lineTo(w / 2, 0); g.closePath(); g.fill();
			if (kind === 0) {
				g.fillStyle = "rgba(40,40,62,.8)"; g.font = "700 " + (w * 0.32) + "px Georgia, serif"; g.textAlign = "center"; g.fillText("RIP", -w * 0.04, -h + w * 0.74);
				g.fillRect(-w * 0.3, -h + w * 0.92, w * 0.52, 0.5); g.fillRect(-w * 0.22, -h + w * 1.1, w * 0.36, 0.5);
			}
		}
		stroke(g, [-w * 0.24, -h * 0.5, -w * 0.08, -h * 0.38, -w * 0.18, -h * 0.24], "rgba(40,40,62,.5)", 0.4);
		g.restore();
	}
	function ghost(g, x, y, s, t, a) {
		g.save(); g.translate(x, y); g.globalAlpha = a;
		g.fillStyle = "#f4f6ff"; g.beginPath(); g.moveTo(-s, s * 1.5); g.lineTo(-s, 0); g.arc(0, 0, s, Math.PI, 0); g.lineTo(s, s * 1.5);
		for (var i = 0; i < 4; i++) { var x1 = s - (i + 1) * s * 0.5; g.quadraticCurveTo(x1 + s * 0.25, s * 1.5 - s * 0.36 + Math.sin(t * 3 + i * 1.6) * s * 0.14, x1, s * 1.5); }
		g.closePath(); g.fill();
		ell(g, s * 0.5, s * 0.4, s * 0.34, s * 0.9, "rgba(150,165,215,.3)");
		ell(g, -s * 0.36, -s * 0.12, s * 0.16, s * 0.25, "#23202f"); ell(g, s * 0.28, -s * 0.12, s * 0.16, s * 0.25, "#23202f");
		ell(g, -s * 0.04, s * 0.44, s * 0.13, s * 0.19, "#23202f");
		g.restore();
	}
	// Black cat sitting on (x, y); tail -1..1 swishes, blink 0..1 closes the eyes.
	function cat(g, x, y, s, dir, tail, blink) {
		g.save(); g.translate(x, y); g.scale(dir, 1);
		g.strokeStyle = "#16131d"; g.lineWidth = s * 0.13; g.lineCap = "round"; g.beginPath(); g.moveTo(-s * 0.28, -s * 0.08); g.bezierCurveTo(-s * 0.85, -s * 0.05, -s * (0.9 + tail * 0.18), -s * 0.5, -s * (0.62 - tail * 0.24), -s * 0.86); g.stroke();
		g.fillStyle = "#16131d"; g.strokeStyle = RIM; g.lineWidth = s * 0.035;
		g.beginPath(); g.moveTo(-s * 0.34, 0); g.bezierCurveTo(-s * 0.44, -s * 0.5, -s * 0.2, -s * 0.9, s * 0.06, -s * 0.86); g.bezierCurveTo(s * 0.3, -s * 0.8, s * 0.3, -s * 0.3, s * 0.3, 0); g.closePath(); g.fill(); g.stroke();
		g.beginPath(); g.moveTo(-s * 0.1, -s * 1.12); g.lineTo(-s * 0.1, -s * 1.46); g.lineTo(s * 0.1, -s * 1.24); g.lineTo(s * 0.14, -s * 1.24); g.lineTo(s * 0.34, -s * 1.46); g.lineTo(s * 0.34, -s * 1.12); g.closePath(); g.fill(); g.stroke();
		g.beginPath(); g.arc(s * 0.12, -s * 1.0, s * 0.27, 0, TAU); g.fill(); g.stroke();
		if (blink < 0.9) {
			var ry = s * 0.06 * (1 - blink);
			ell(g, s * 0.02, -s * 1.02, s * 0.075, ry, "#d8ff5a"); ell(g, s * 0.25, -s * 1.02, s * 0.075, ry, "#d8ff5a");
			ell(g, s * 0.03, -s * 1.02, s * 0.022, ry, "#16131d"); ell(g, s * 0.26, -s * 1.02, s * 0.022, ry, "#16131d");
		}
		g.restore();
	}
	function miniWeb(g, x, y, R) {
		var i, k;
		g.save(); g.translate(x, y); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 0.22; g.lineCap = "round"; g.beginPath();
		for (i = 0; i <= 4; i++) { g.moveTo(0, 0); g.lineTo(Math.cos(i / 4 * Math.PI / 2) * R, Math.sin(i / 4 * Math.PI / 2) * R); }
		for (k = 1; k <= 3; k++) {
			var r = R * k / 3.4;
			for (i = 0; i < 4; i++) { var a0 = i / 4 * Math.PI / 2, a1 = (i + 1) / 4 * Math.PI / 2, am = (a0 + a1) / 2; g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r); g.quadraticCurveTo(Math.cos(am) * r * 0.78, Math.sin(am) * r * 0.78, Math.cos(a1) * r, Math.sin(a1) * r); }
		}
		g.stroke(); g.restore();
	}
	function limb(g, x, y, ang, len, w, depth, R, col) {
		var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, bend = (R() - 0.5) * len * 0.5;
		g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 - Math.sin(ang) * bend, (y + y2) / 2 + Math.cos(ang) * bend, x2, y2); g.stroke();
		if (depth > 0) { limb(g, x2, y2, ang - 0.35 - R() * 0.5, len * (0.58 + R() * 0.15), w * 0.62, depth - 1, R, col); limb(g, x2, y2, ang + 0.3 + R() * 0.5, len * (0.54 + R() * 0.15), w * 0.6, depth - 1, R, col); }
		return [x2, y2];
	}
	// Iron pot sitting on y (cauldron, pot of gold).
	function pot(g, x, y, s) {
		g.fillStyle = "#23232d"; g.fillRect(x - s * 0.62, y - s * 0.12, s * 0.2, s * 0.16); g.fillRect(x + s * 0.42, y - s * 0.12, s * 0.2, s * 0.16);
		g.beginPath(); g.moveTo(x - s * 0.8, y - s * 0.98); g.bezierCurveTo(x - s * 1.28, y - s * 0.5, x - s * 0.92, y - s * 0.04, x - s * 0.5, y - s * 0.04); g.lineTo(x + s * 0.5, y - s * 0.04); g.bezierCurveTo(x + s * 0.92, y - s * 0.04, x + s * 1.28, y - s * 0.5, x + s * 0.8, y - s * 0.98); g.closePath(); g.fill();
		ell(g, x - s * 0.52, y - s * 0.52, s * 0.14, s * 0.3, "rgba(255,255,255,.13)", 0.3);
		g.strokeStyle = RIM; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(x - s * 0.8, y - s * 0.98); g.bezierCurveTo(x - s * 1.28, y - s * 0.5, x - s * 0.92, y - s * 0.04, x - s * 0.5, y - s * 0.04); g.stroke();
		box(g, x - s * 0.96, y - s * 1.14, s * 1.92, s * 0.25, s * 0.12, "#34343f");
	}
	function candy(g, x, y, s, col, rot) {
		g.save(); g.translate(x, y); g.rotate(rot || 0);
		poly(g, [-s, 0, -s * 1.8, -s * 0.6, -s * 1.8, s * 0.6], shade(col, 1.2)); poly(g, [s, 0, s * 1.8, -s * 0.6, s * 1.8, s * 0.6], shade(col, 1.2));
		ell(g, 0, 0, s, s * 0.66, col); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-s * 0.3, -s * 0.62, s * 0.26, s * 1.24);
		g.restore();
	}

	V.tombs = { w: 56,
		back: function (b, S) { tomb(b, 14, 15, 31, -0.04, 0); tomb(b, 34, 12, 34, 0.05, 1); tomb(b, 48, 10, 17, 0.14, 2); },
		front: function (b, S) { ell(b, 14, 6.5, 8.5, 2, "#3b2f3a"); ell(b, 12, 5.8, 5, 1, "#4a3b47"); ell(b, 6, 4.6, 3.4, 1.5, "#4f7a3e"); ell(b, 40, 4.4, 3, 1.3, "#5f8a4a"); },
		live: function (g, S, t) {
			var k = t % 16, up = ease(span(k, 2, 4)) * (1 - ease(span(k, 8.5, 10)));
			if (up > 0.01) {
				g.save(); g.beginPath(); g.rect(0, -80, 30, 57); g.clip();
				glowAt(g, 14, -30 - up * 12, 16, "190,210,255", 0.3 * up);
				ghost(g, 14 + Math.sin(t * 1.2) * 1.2, -18 - up * 20, 5.6, t, 0.9);
				g.restore();
				g.save(); g.beginPath(); g.rect(0, -40, 30, 34); g.clip(); tomb(g, 14, 15, 31, -0.04, 0); g.restore();
			}
		}
	};
	V.jacks = { w: 48,
		back: function (b, S) {
			box(b, 3, -11, 23, 14, 0.8, "#6b4a2c"); b.fillStyle = "rgba(0,0,0,.2)"; b.fillRect(3, -4.6, 23, 0.6); b.fillRect(3, -8, 23, 0.6); b.fillRect(20, -11, 6, 14);
			S.pk = [[14, -11, 7.4, { col: [236, 124, 26], face: 2, tilt: -0.05, shadow: false }], [35, 3, 10.5, { col: [229, 108, 16], face: 1, tilt: 0.04 }], [45.5, 3, 4.4, { col: [246, 152, 44], face: 3 }]];
			S.pk.forEach(function (p) { A.pumpkin(b, p[0], p[1], p[2], p[3]); });
		},
		live: function (g, S, t) {
			S.pk.forEach(function (p, i) { var f = A.flick(t * 1.1 + i * 2.7); glowAt(g, p[0], p[1] - p[2] * 0.8, p[2] * 2.6, "255,150,40", 0.3 + f * 0.25); A.pumpkinFace(g, p[0], p[1], p[2], p[3], 0.7 + f * 0.3); });
		}
	};
	V.deadtree = { w: 64,
		back: function (b, S) {
			var col = "#2c2436", R = S.R;
			poly(b, [24, 3, 27.5, -14, 28.6, -30, 33.4, -30, 34.6, -14, 39, 3], col);
			b.strokeStyle = RIM; b.lineWidth = 0.4; b.beginPath(); b.moveTo(24, 3); b.lineTo(27.5, -14); b.lineTo(28.6, -30); b.stroke();
			limb(b, 30, -29, -2.2, 16, 2.6, 3, R, col); limb(b, 32, -30, -1.25, 17, 2.5, 3, R, col);
			S.tip = limb(b, 33, -27, -0.42, 22, 2, 0, R, col); limb(b, S.tip[0], S.tip[1], -1.1, 9, 1.1, 1, R, col);
			ell(b, 31.4, -17, 2.6, 3.4, "#0d0b12");
			stroke(b, [25, 3, 20, 5], col, 1.6); stroke(b, [38.4, 3, 44, 5], col, 1.6);
		},
		live: function (g, S, t) {
			var k = t % 5, blink = k > 4.7 ? 1 : 0, len = 12 + Math.sin(t * 0.6) * 3, tx = S.tip[0] - 2, ty = S.tip[1];
			if (!blink) { circ(g, 30.5, -17.4, 0.8, "#ffd23f"); circ(g, 32.5, -17.4, 0.8, "#ffd23f"); circ(g, 30.5, -17.4, 0.3, "#0d0b12"); circ(g, 32.5, -17.4, 0.3, "#0d0b12"); }
			stroke(g, [tx, ty, tx + Math.sin(t * 0.9) * 0.6, ty + len], "rgba(255,255,255,.7)", 0.2);
			A.spider(g, tx + Math.sin(t * 0.9) * 0.6, ty + len, 1.5, t);
		}
	};
	V.cauldron = { w: 40,
		front: function (b, S) {
			b.save(); b.translate(0, 9);
			ell(b, 20, 0.6, 15, 1.6, "rgba(0,0,0,.25)");
			stroke(b, [8, 0, 30, -2.4], "#5a3a22", 2.4); stroke(b, [32, 0, 10, -2.4], "#4a2f1a", 2.4);
			circ(b, 30.4, -2.4, 1.2, "#b8895a"); circ(b, 9.6, -2.4, 1.2, "#a67c4c");
			b.restore();
		},
		live: function (g, S, t, dt) {
			var i, f = A.flick(t * 1.4);
			glowAt(g, 20, 5, 15, "255,140,40", 0.35 + f * 0.25);
			for (i = 0; i < 4; i++) { var fx = [6.5, 11.5, 28.5, 33.5][i], fh = (7 + ((i * 7) % 3)) * (0.7 + 0.3 * A.flick(t * 1.6 + i * 1.9)); g.fillStyle = i % 2 ? "#ffb21c" : "#ff7a1a"; g.beginPath(); g.moveTo(fx - 2.2, 7); g.quadraticCurveTo(fx - 2.4, 7 - fh * 0.5, fx + Math.sin(t * 5 + i) * 0.8, 7 - fh); g.quadraticCurveTo(fx + 2.4, 7 - fh * 0.5, fx + 2.2, 7); g.closePath(); g.fill(); }
			pot(g, 20, 5.4, 10.5);
			ell(g, 20, -6.2, 9, 1.7, "#58f066"); ell(g, 17.5, -6.5, 3.5, 0.6, "rgba(255,255,255,.4)");
			glowAt(g, 20, -8, 15, "90,255,110", 0.3 + 0.1 * Math.sin(t * 2));
			if (Math.random() < dt * 5 && S.fx.length < 16) { S.fx.push({ x: 13 + Math.random() * 14, y: -7, r: 0.5 + Math.random() * 0.9, v: 4 + Math.random() * 5, a: 1 }); }
			for (i = S.fx.length - 1; i >= 0; i--) {
				var p = S.fx[i]; p.y -= p.v * dt; p.r += dt * 0.7; p.a -= dt * 0.55; p.x += Math.sin(t * 3 + i) * 2 * dt;
				if (p.a <= 0) { S.fx.splice(i, 1); continue; }
				g.strokeStyle = "rgba(140,255,150," + p.a.toFixed(2) + ")"; g.lineWidth = 0.35; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke();
				circ(g, p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.25, "rgba(230,255,230," + (p.a * 0.8).toFixed(2) + ")");
			}
		}
	};
	V.haunted = { w: 74,
		back: function (b, S) {
			var wall = "#262036", trim = "#342c4b";
			b.fillStyle = wall; b.fillRect(46, -58, 15, 61); poly(b, [43.4, -58, 53.5, -79, 63.6, -58], trim);
			stroke(b, [53.5, -79, 53.5, -85], "#15121f", 0.5); poly(b, [53.5, -85, 57.5, -83.6, 53.5, -82.4], "#15121f");
			poly(b, [14, -45, 19.4, -50, 20.4, -62, 15, -61], wall); b.fillStyle = trim; b.fillRect(14, -63.2, 7.2, 2);
			b.fillStyle = wall; b.fillRect(9, -38, 39, 41);
			poly(b, [5, -37.4, 28, -57, 51, -37.4], trim);
			b.fillStyle = "rgba(0,0,0,.22)"; b.fillRect(40, -38, 8, 41); b.fillRect(56, -58, 5, 61);
			poly(b, [17, -15, 28, -21, 39, -15], trim); b.fillStyle = trim; b.fillRect(19, -15, 1.3, 18); b.fillRect(35.7, -15, 1.3, 18);
			box(b, 24, -13, 8, 16, 1, "#3d1f2a"); circ(b, 30.4, -5, 0.6, "#f6b23c");
			S.win = [[13.5, -31, 6.5, 9], [34, -31, 6.5, 9], [25, -46, 6, 6.5], [50.5, -51, 6, 9], [50.5, -33, 6, 8]];
			S.win.forEach(function (w) {
				b.fillStyle = "#e9a233"; b.fillRect(w[0], w[1], w[2], w[3]);
				b.strokeStyle = "#15121f"; b.lineWidth = 0.7; b.strokeRect(w[0], w[1], w[2], w[3]); b.beginPath(); b.moveTo(w[0] + w[2] / 2, w[1]); b.lineTo(w[0] + w[2] / 2, w[1] + w[3]); b.moveTo(w[0], w[1] + w[3] / 2); b.lineTo(w[0] + w[2], w[1] + w[3] / 2); b.stroke();
			});
			b.strokeStyle = RIM; b.lineWidth = 0.4; b.lineJoin = "round"; b.beginPath(); b.moveTo(5, -37.4); b.lineTo(28, -57); b.lineTo(46, -41.6); b.moveTo(43.4, -58); b.lineTo(53.5, -79); b.lineTo(63.6, -58); b.stroke();
			// broken fence
			for (var i = 0; i < 5; i++) { b.save(); b.translate(63 + i * 2.6, 3); b.rotate((i - 2) * 0.09); poly(b, [-0.7, 0, -0.7, -9 - (i % 2) * 2, 0, -11 - (i % 2) * 2, 0.7, -9 - (i % 2) * 2, 0.7, 0], "#3a3350"); b.restore(); }
		},
		live: function (g, S, t) {
			S.win.forEach(function (w, i) {
				var f = A.flick(t * 0.7 + i * 2.3);
				g.globalAlpha = 0.18 + f * 0.3; g.fillStyle = "#fff0a8"; g.fillRect(w[0] + 0.5, w[1] + 0.5, w[2] - 1, w[3] - 1); g.globalAlpha = 1;
				glowAt(g, w[0] + w[2] / 2, w[1] + w[3] / 2, 9, "255,170,60", 0.22 + f * 0.2);
			});
			A.bat(g, 53.5 + Math.cos(t * 1.1) * 15, -80 + Math.sin(t * 1.7) * 5, 3, Math.sin(t * 13));
			A.bat(g, 53.5 + Math.cos(t * 0.8 + 2.4) * 20, -70 + Math.sin(t * 1.3 + 1) * 6, 2.3, Math.sin(t * 15 + 1));
		}
	};
	V.ironfence = { w: 52,
		back: function (b, S) {
			var i, col = "#1c1929";
			b.strokeStyle = col; b.lineCap = "butt"; b.lineWidth = 1.1; b.beginPath(); b.moveTo(0, -6); b.lineTo(52, -6); b.moveTo(0, -20); b.lineTo(52, -20); b.stroke();
			for (i = 0; i < 12; i++) {
				var x = 2.4 + i * 4.3, h = 25 + (i % 3 === 1 ? 2.5 : 0);
				b.fillStyle = col; b.fillRect(x - 0.5, -h, 1, h + 3); poly(b, [x - 1.3, -h, x, -h - 3.6, x + 1.3, -h], col);
				b.fillStyle = RIM; b.fillRect(x - 0.5, -h, 0.25, h + 3);
			}
			b.fillStyle = col; b.fillRect(24.2, -31, 3.2, 34); circ(b, 25.8, -32.6, 2.1, col); b.fillStyle = RIM; b.fillRect(24.2, -31, 0.35, 34);
			miniWeb(b, 27.4, -20, 12);
		},
		live: function (g, S, t) { var k = t % 9; crow(g, 25.8, -34.6, 4.6, Math.floor(t / 9) % 2 ? -1 : 1, k > 6 && k < 7 ? Math.sin((k - 6) * Math.PI * 3) * 0.35 : 0); }
	};
	V.zombiehand = { w: 28,
		front: function (b, S) {
			b.save(); b.translate(0, 9);
			b.save(); b.translate(22, 1); b.rotate(0.14); b.fillStyle = "#6b4a2c"; b.fillRect(-0.9, -16, 1.8, 16); b.fillRect(-5, -13, 10, 1.8); b.restore();
			ell(b, 12, 1.4, 10, 2.6, "#3b2f3a"); ell(b, 10.5, 0.2, 6, 1.5, "#4a3b47"); circ(b, 4.4, 2.2, 0.9, "#4a3b47"); circ(b, 19, 2.6, 0.8, "#3b2f3a");
			b.restore();
		},
		live: function (g, S, t) {
			var k = t % 12, up = ease(span(k, 1, 2.6)) * (1 - ease(span(k, 9, 10.4))), i;
			if (up < 0.02) { return; }
			g.save(); g.beginPath(); g.rect(0, -30, 28, 39.4); g.clip();
			g.translate(12, 22 - up * 21); g.rotate(Math.sin(t * 1.3) * 0.08);
			var skin = "#8fbf6a";
			box(g, -2, -4, 4, 14, 1.6, skin); box(g, -3.2, -8.6, 6.4, 6.2, 2, skin);
			for (i = 0; i < 4; i++) { g.save(); g.translate(-2.4 + i * 1.6, -8); g.rotate((i - 1.5) * 0.16 + Math.sin(t * 5 + i * 1.3) * 0.16); box(g, -0.6, -5.6, 1.2, 6, 0.6, i % 2 ? skin : "#7fb05c"); g.restore(); }
			g.save(); g.translate(3, -5); g.rotate(0.9 + Math.sin(t * 4) * 0.1); box(g, -0.6, -4, 1.2, 4.4, 0.6, "#7fb05c"); g.restore();
			g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0.6, -4, 1.4, 14);
			g.restore();
		}
	};
	V.blackcat = { w: 28,
		back: function (b, S) {
			b.fillStyle = lin(b, 7, 0, 21, 0, STONE[0], STONE[1]); b.fillRect(8.4, -13, 11.2, 16); box(b, 6.6, -15, 14.8, 2.8, 0.6, STONE[0]); box(b, 7, 0.4, 14, 2.8, 0.6, STONE[1]);
			stroke(b, [11, -11, 12.4, -7.6, 11.2, -4.6], "rgba(40,40,62,.5)", 0.4);
		},
		live: function (g, S, t) { var k = t % 6; cat(g, 14, -15, 9.4, Math.floor(t / 18) % 2 ? -1 : 1, Math.sin(t * 1.6), k > 5.7 ? 1 : 0); }
	};
	V.candy = { w: 30,
		front: function (b, S) {
			var i, cols = ["#ff5c8a", "#5fd3f3", "#b565d8", "#8fc93a", "#ffd23f"];
			b.save(); b.translate(0, 9);
			ell(b, 14, 1, 11, 1.5, "rgba(0,0,0,.25)");
			b.strokeStyle = "#1c1929"; b.lineWidth = 0.6; b.beginPath(); b.arc(13, -9.5, 5.8, Math.PI * 1.05, Math.PI * 1.95); b.stroke();
			stroke(b, [17.6, -9, 21, -17], "#f1f1f1", 0.5); circ(b, 21.4, -18.4, 2.5, "#ff5c8a"); b.strokeStyle = "#ffffff"; b.lineWidth = 0.5; b.beginPath(); b.arc(21.4, -18.4, 1.3, 0, 4.4); b.stroke();
			candy(b, 10, -10, 1.5, cols[1], -0.5); candy(b, 14.4, -10.6, 1.5, cols[2], 0.3);
			A.pumpkin(b, 13, 1, 6.6, { col: [236, 124, 26], squash: 0.74, stem: "#236f3a" });
			A.pumpkinFace(b, 13, 1, 6.6, { col: [236, 124, 26], squash: 0.74, face: 0 }, 0);
			for (i = 0; i < 3; i++) { candy(b, 22 + i * 2.6, 0.4 + (i % 2) * 2.2, 1.2, cols[(i + 3) % 5], i * 1.1); }
			[[2.6, 1.6, 0.4], [5.6, 3.2, -0.7]].forEach(function (c) { b.save(); b.translate(c[0], c[1]); b.rotate(c[2]); poly(b, [-1.5, 1.4, 1.5, 1.4, 0, -2.2], "#ffd23f"); poly(b, [-0.95, 0.1, 0.95, 0.1, 0, -2.2], "#ff8a1c"); poly(b, [-0.42, -1.2, 0.42, -1.2, 0, -2.2], "#ffffff"); b.restore(); });
			b.restore();
		}
	};

	SCENES.halloween = {
		deck: ["tombs", "jacks", "deadtree", "cauldron", "haunted", "ironfence", "zombiehand", "blackcat", "candy", "tombs"],
		far: function (b, e) {
			var u = e.u, Rf = SSO.seeded("far" + e.seed), px, haze = b.createLinearGradient(0, e.gy - 105 * u, 0, e.gy);
			// moonlit haze, so the dark silhouettes still read when the stream behind them is dark too
			haze.addColorStop(0, "rgba(118,102,196,0)"); haze.addColorStop(0.55, "rgba(118,102,196,.2)"); haze.addColorStop(1, "rgba(132,118,208,.44)");
			b.fillStyle = haze; b.fillRect(0, e.gy - 105 * u, e.W, 105 * u + 2);
			farHill(b, e, "#2a2540", 0.9);
			for (px = Rf() * 40 * u; px < e.W; px += (40 + Rf() * 90) * u) {
				b.save(); b.translate(px, hillY(e, px, 0.9) + 2 * u); b.scale(u, u);
				if (Rf() < 0.55) { limb(b, 0, 0, -1.57 + (Rf() - 0.5) * 0.3, 9 + Rf() * 5, 1.3, 2, Rf, NIGHT); }
				else { b.globalAlpha = 0.4; tomb(b, 0, 5, 9 + Rf() * 4, (Rf() - 0.5) * 0.3, Rf() < 0.5 ? 1 : 2); b.globalAlpha = 1; }
				b.restore();
			}
		},
		ground: function (b, e) {
			var Rf = SSO.seeded("gr" + e.seed), blades = ["#3b3660", "#2c2947", "#4a4474"];
			fringe(b, e, blades, 3, 7, 2.6, Rf);
			ground(b, e, "#3a3657", "#171523", "rgba(160,135,225,.3)");
			fringe(b, e, blades, 2, 4.5, 3.4, Rf);
			tufts(b, e, blades, Math.round(e.W / (30 * e.u)), Rf);
		},
		// low mist creeping along the ground
		fore: function (g, e, t) {
			var u = e.u, n = Math.ceil(e.W / (70 * u)) + 3, span2 = e.W + 180 * u;
			for (var i = 0; i < n; i++) {
				var x = ((i * 137.5 * u + t * (4 + (i % 3) * 2.5) * u) % span2) - 90 * u, r = (40 + (i % 5) * 9) * u;
				g.save(); g.translate(x, e.gy + (4 + (i % 4) * 4) * u); g.scale(1, 0.34); A.light(g, 0, 0, r, "196,186,240", 0.2 + 0.06 * Math.sin(t * 0.4 + i)); g.restore();
			}
		},
		roam: function (e) {
			var u = e.u, bats = [], ghosts = [], k = e.busy * Math.max(1, e.W / (520 * u)), i;
			for (i = 0; i < Math.round(2.4 * k); i++) { bats.push({ x: Math.random() * e.W, y: e.gy - (64 + Math.random() * 90) * u, dir: Math.random() < 0.5 ? -1 : 1, v: (26 + Math.random() * 18) * u, ph: Math.random() * TAU, s: (4.4 + Math.random() * 3) * u }); }
			for (i = 0; i < Math.round(0.9 * k); i++) { ghosts.push({ x: Math.random() * e.W, y: e.gy - (44 + Math.random() * 46) * u, dir: Math.random() < 0.5 ? -1 : 1, v: (6 + Math.random() * 4) * u, ph: Math.random() * TAU, s: (6.4 + Math.random() * 2.6) * u }); }
			return function (g, t, dt) {
				var j, q;
				for (j = 0; j < ghosts.length; j++) {
					q = ghosts[j]; q.x += q.dir * q.v * dt;
					if (q.x > e.W + 20 * u) { q.x = -18 * u; } else if (q.x < -20 * u) { q.x = e.W + 18 * u; }
					var a = 0.5 + 0.28 * Math.sin(t * 0.6 + q.ph), gy2 = q.y + Math.sin(t * 1.1 + q.ph) * 4 * u;
					glowAt(g, q.x, gy2 + q.s * 0.4, q.s * 3.2, "190,210,255", 0.22 * a);
					ghost(g, q.x, gy2, q.s, t + q.ph, a);
				}
				for (j = 0; j < bats.length; j++) {
					q = bats[j]; q.x += q.dir * q.v * dt;
					if (q.x > e.W + 20 * u) { q.x = -18 * u; } else if (q.x < -20 * u) { q.x = e.W + 18 * u; }
					A.bat(g, q.x, q.y + Math.sin(t * 1.3 + q.ph) * 7 * u + Math.sin(t * 3.1 + q.ph) * 2 * u, q.s, Math.sin(t * 13 + q.ph));
				}
			};
		},
		drift: function (e) { return drifter(e, "leaf", FALL); }
	};

	// ---------------------------------------------------------------- Easter, Valentine's, St. Patrick's
	var PASTEL = [["#ffb3c6", "#ffffff"], ["#a0d8ef", "#fff3b0"], ["#fff3b0", "#ff8fab"], ["#cdb4f6", "#ffffff"], ["#b8e6b0", "#ffd6a5"], ["#ffd6a5", "#a0d8ef"]];
	function egg(g, x, y, r, c1, c2, pat, rot) {
		var i;
		g.save(); g.translate(x, y); g.rotate(rot || 0);
		g.beginPath(); g.moveTo(0, -r * 1.3); g.bezierCurveTo(r * 0.85, -r * 1.3, r * 1.05, r * 0.2, r * 0.7, r * 0.75); g.bezierCurveTo(r * 0.4, r * 1.1, -r * 0.4, r * 1.1, -r * 0.7, r * 0.75); g.bezierCurveTo(-r * 1.05, r * 0.2, -r * 0.85, -r * 1.3, 0, -r * 1.3); g.closePath();
		g.fillStyle = c1; g.fill(); g.save(); g.clip();
		g.fillStyle = c2; g.strokeStyle = c2; g.lineWidth = r * 0.17; g.lineJoin = "round";
		if (pat === 0) { g.fillRect(-r * 1.2, -r * 0.62, r * 2.4, r * 0.3); g.fillRect(-r * 1.2, r * 0.08, r * 2.4, r * 0.3); }
		else if (pat === 1) { for (i = 0; i < 9; i++) { g.beginPath(); g.arc(((i % 3) - 1) * r * 0.56 + (Math.floor(i / 3) % 2) * r * 0.24, (Math.floor(i / 3) - 1) * r * 0.62 - r * 0.1, r * 0.13, 0, TAU); g.fill(); } }
		else { for (var row = 0; row < 2; row++) { g.beginPath(); for (i = 0; i <= 8; i++) { var zx = -r * 1.1 + i * r * 0.275, zy = -r * 0.5 + row * r * 0.75 + (i % 2 ? r * 0.2 : -r * 0.2); if (i) { g.lineTo(zx, zy); } else { g.moveTo(zx, zy); } } g.stroke(); } }
		g.fillStyle = "rgba(255,255,255,.34)"; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.5, r * 0.18, r * 0.42, 0.3, 0, TAU); g.fill();
		g.fillStyle = "rgba(0,0,0,.09)"; g.fillRect(r * 0.36, -r * 1.4, r, r * 2.7);
		g.restore(); g.restore();
	}
	function chick(g, x, y, s, dir, peck) {
		g.save(); g.translate(x, y); g.scale(dir, 1);
		stroke(g, [-s * 0.1, -s * 0.12, -s * 0.1, 0, -s * 0.02, 0], "#f28c28", s * 0.07); stroke(g, [s * 0.14, -s * 0.12, s * 0.14, 0, s * 0.24, 0], "#f28c28", s * 0.07);
		circ(g, 0, -s * 0.5, s * 0.44, "#ffd84d");
		ell(g, -s * 0.14, -s * 0.46, s * 0.24, s * 0.16, "#f2c230", 0.4);
		g.save(); g.translate(s * 0.22, -s * 0.84); g.rotate(peck || 0);
		circ(g, s * 0.08, -s * 0.12, s * 0.3, "#ffe066");
		poly(g, [s * 0.34, -s * 0.2, s * 0.62, -s * 0.11, s * 0.34, -s * 0.02], "#f28c28");
		circ(g, s * 0.17, -s * 0.2, s * 0.05, "#1c1c1c");
		stroke(g, [s * 0.02, -s * 0.4, -s * 0.02, -s * 0.56], "#ffd84d", s * 0.07);
		g.restore(); g.restore();
	}
	function rose(g, x, y, r, col) {
		circ(g, x, y, r, col);
		g.strokeStyle = shade(col, 0.66); g.lineWidth = r * 0.16; g.lineCap = "round"; g.beginPath();
		for (var a = 0; a < 8; a += 0.4) { var q = r * 0.78 * (1 - a / 9.5); if (a === 0) { g.moveTo(x + q, y); } else { g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } }
		g.stroke();
		circ(g, x - r * 0.34, y - r * 0.36, r * 0.2, "rgba(255,255,255,.3)");
	}
	// A bunny or two hopping the length of the strip.
	function hoppers(e, n) {
		var u = e.u, list = [], i;
		for (i = 0; i < Math.round(n * e.busy * Math.max(1, e.W / (700 * u))); i++) { list.push({ x: Math.random() * e.W, dir: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 9, fur: pick(Math.random, ["#f4efe6", "#d9c3a5", "#cfd2d8", "#ffffff"]) }); }
		return function (g, t, dt) {
			for (var j = 0; j < list.length; j++) {
				var h = list[j], c = (t * 0.9 + h.ph) % 2.4, hop = c < 0.6 ? Math.sin(c / 0.6 * Math.PI) : 0;
				if (c < 0.6) { h.x += h.dir * 32 * u * dt; }
				if (h.x > e.W + 20 * u) { h.x = -18 * u; } else if (h.x < -20 * u) { h.x = e.W + 18 * u; }
				ell(g, h.x, e.gy + 14.5 * u, (7 - hop * 2) * u, 1.3 * u, "rgba(0,0,0,.15)");
				bunny(g, h.x, e.gy + 14 * u - hop * 9 * u, 17 * u, h.dir, c > 1.4 && c < 1.8 ? Math.sin((c - 1.4) * TAU * 2.5) * 0.2 : -hop * 0.25, h.fur);
			}
		};
	}

	V.eggs = { w: 44, front: function (b, S) {
		var i;
		b.save(); b.translate(0, 9);
		for (i = 0; i < 5; i++) { var p = PASTEL[Math.floor(S.R() * PASTEL.length)], r = 3 + S.R() * 1.1, x = 5 + i * 8.4 + (S.R() - 0.5) * 2, y = -r * 0.5 + (i % 2) * 3.2; ell(b, x, y + r * 0.95, r * 0.9, r * 0.24, "rgba(0,0,0,.15)"); egg(b, x, y, r, p[0], p[1], (i + Math.floor(S.R() * 3)) % 3, (S.R() - 0.5) * 0.7); }
		b.translate(0, 4.6);
		for (i = 0; i < 14; i++) { var gx = 2 + S.R() * 40; blade(b, gx, 3 + S.R() * 3.4, (S.R() - 0.5) * 2.4, pick(S.R, GRASS), 0.5); }
		b.restore();
	} };
	V.basket = { w: 38,
		front: function (b, S) {
			var i;
			b.save(); b.translate(0, 10);
			ell(b, 19, 0.8, 14, 1.7, "rgba(0,0,0,.16)");
			b.strokeStyle = "#a9772f"; b.lineWidth = 1.5; b.beginPath(); b.arc(19, -10, 11.4, Math.PI * 1.04, Math.PI * 1.96); b.stroke();
			b.strokeStyle = "#c9974f"; b.lineWidth = 0.5; b.beginPath(); b.arc(19, -10, 11.4, Math.PI * 1.04, Math.PI * 1.96); b.stroke();
			for (i = 0; i < 4; i++) { var p = PASTEL[(i + Math.floor(S.R() * 6)) % 6]; egg(b, 11.4 + i * 5, -11.6 - (i % 2) * 1.4, 3, p[0], p[1], i % 3, (i - 1.5) * 0.2); }
			basket(b, 8, 0, 22, 10.6, "#c9974f");
			// bow on the handle
			b.save(); b.translate(19, -21.4); heart(b, -2.2, 0, 1.9, "#ff7aa8"); heart(b, 2.2, 0, 1.9, "#ff7aa8"); circ(b, 0, 0.3, 1, "#e85a8c"); b.restore();
			b.restore();
		}
	};
	V.chicks = { w: 36,
		front: function (b, S) {
			b.save(); b.translate(0, 10);
			ell(b, 10, 1, 6, 1.1, "rgba(0,0,0,.15)");
			b.fillStyle = "#fbf7ee"; b.beginPath(); b.moveTo(4.6, -3.4); b.lineTo(6, -5.6); b.lineTo(7.6, -3.6); b.lineTo(9.2, -5.8); b.lineTo(10.8, -3.6); b.lineTo(12.4, -5.6); b.lineTo(14, -3.6); b.lineTo(15.4, -4.6); b.bezierCurveTo(16.4, -0.4, 13, 1.2, 10, 1.2); b.bezierCurveTo(7, 1.2, 3.6, -0.4, 4.6, -3.4); b.closePath(); b.fill();
			b.fillStyle = "rgba(0,0,0,.08)"; b.fillRect(12, -4, 3.6, 5.2);
			b.save(); b.translate(22, 2.6); b.rotate(0.5); b.fillStyle = "#fbf7ee"; b.beginPath(); b.arc(0, 0, 3.4, Math.PI, 0); b.lineTo(2, 1.4); b.lineTo(0.6, 0.2); b.lineTo(-0.8, 1.5); b.lineTo(-2.2, 0.2); b.closePath(); b.fill(); b.restore();
			b.restore();
		},
		live: function (g, S, t) {
			var k = t % 7, pop = ease(span(k, 0.6, 1.4)) * (1 - ease(span(k, 5, 5.8)));
			g.save(); g.beginPath(); g.rect(0, -20, 20, 25.2); g.clip(); chick(g, 10, 12.6 - pop * 5, 7, 1, Math.sin(t * 2) * 0.1); g.restore();
			var c = (t / 9) % 1, f = c < 0.5 ? c * 2 : 2 - c * 2, peck = Math.sin(t * 3) > 0.6 ? 0.7 : 0;
			chick(g, 22 + ease(f) * 10, 12 + Math.abs(Math.sin(t * 9)) * 0.4, 6, c < 0.5 ? 1 : -1, peck);
		}
	};
	V.carrots = { w: 38, front: function (b, S) {
		var i;
		b.save(); b.translate(0, 9);
		ell(b, 17, 2, 16, 3, "#6b4a2c"); ell(b, 15, 1, 12, 1.6, "#7d5836");
		for (i = 0; i < 4; i++) {
			var x = 6 + i * 7.4;
			poly(b, [x - 1.5, 0.4, x + 1.5, 0.4, x + 1.1, -1.4, x - 1.1, -1.4], "#f28c28");
			for (var k = -2; k <= 2; k++) { b.strokeStyle = k % 2 ? "#58a844" : "#3f8a35"; b.lineWidth = 0.6; b.lineCap = "round"; b.beginPath(); b.moveTo(x, -1.2); b.quadraticCurveTo(x + k * 0.9, -5, x + k * 1.9, -7.5 - (k % 2) * 1.2); b.stroke(); circ(b, x + k * 1.9, -7.6 - (k % 2) * 1.2, 0.8, k % 2 ? "#58a844" : "#6fbf4a"); }
		}
		b.save(); b.translate(32, 3); b.rotate(1.2); poly(b, [-1.6, 0, 1.6, 0, 0, 8.6], "#f28c28"); b.strokeStyle = "rgba(160,80,10,.5)"; b.lineWidth = 0.3; for (i = 1; i < 4; i++) { b.beginPath(); b.moveTo(-1.2 + i * 0.2, i * 1.8); b.lineTo(0.2, i * 1.8 + 0.3); b.stroke(); } stroke(b, [0, 0, -1.4, -3.4], "#58a844", 0.6); stroke(b, [0, 0, 1.2, -3.6], "#3f8a35", 0.6); b.restore();
		b.restore();
	} };

	SCENES.easter = meadow("#8fd15a", "#4f9f3a", GRASS, "#c4e69a", ["#86c765", "#a4d97c", "#cdeea8"], ["#ffffff", "#ffd3e2", "#cdb4f6"], ["#ffffff", "#fff3b0", "#ffb3c6", "#cdb4f6"]);
	SCENES.easter.deck = ["eggs", "basket", "tulips", "chicks", "bunny", "daffs", "eggs", "carrots", "picket", "daisies", "cherry"];
	SCENES.easter.roam = function (e) { var a = flutter(e, 1, 0.3), h = hoppers(e, 1); return function (g, t, dt) { h(g, t, dt); a(g, t, dt); }; };
	SCENES.easter.drift = function (e) { return drifter(e, "petal", ["#ffffff", "#ffd3e2", "#fff3b0", "#cdb4f6"]); };

	var LOVE = ["#ff5c8a", "#e63946", "#ffd6e0", "#ff8fab", "#c9184a"];
	V.mailbox = { w: 30,
		back: function (b, S) {
			b.fillStyle = "#8a6238"; b.fillRect(13.4, -24, 3, 27); b.fillStyle = "rgba(0,0,0,.2)"; b.fillRect(15.4, -24, 1, 27);
			[[20.5, -33, 0.5], [23, -30, 0.95]].forEach(function (q) { b.save(); b.translate(q[0], q[1]); b.rotate(q[2]); box(b, -3.6, -2.4, 7.2, 4.8, 0.4, "#ffffff"); stroke(b, [-3.6, -2.4, 0, 0.4, 3.6, -2.4], "#d9dde2", 0.3); heart(b, 0, 0.3, 1, "#e63946"); b.restore(); });
			b.fillStyle = "#d7263d"; b.beginPath(); b.moveTo(5, -24); b.lineTo(5, -32); b.arc(10.4, -32, 5.4, Math.PI, Math.PI * 1.5); b.lineTo(21, -37.4); b.lineTo(21, -24); b.closePath(); b.fill();
			b.fillStyle = "rgba(0,0,0,.16)"; b.fillRect(5, -27, 16, 3); ell(b, 21, -30.7, 1.6, 6.7, "#8f1626");
			stroke(b, [9, -32, 9, -41], "#f1f1f1", 0.6); poly(b, [9, -41.6, 14, -40, 9, -38.4], "#ffd23f");
			heart(b, 12.4, -30.4, 2, "#ffffff");
		},
		live: function (g, S, t, dt) {
			if (Math.random() < dt * 0.9 && S.fx.length < 8) { S.fx.push({ x: 22, y: -34, vx: 1 + Math.random() * 3, v: 6 + Math.random() * 4, s: 1.2 + Math.random() * 1.2, a: 1, ph: Math.random() * 6, col: pick(Math.random, LOVE) }); }
			for (var i = S.fx.length - 1; i >= 0; i--) {
				var p = S.fx[i]; p.y -= p.v * dt; p.x += (p.vx + Math.sin(t * 2 + p.ph) * 3) * dt; p.a -= dt * 0.22;
				if (p.a <= 0) { S.fx.splice(i, 1); continue; }
				g.globalAlpha = Math.min(1, p.a * 1.6); heart(g, p.x, p.y, p.s, p.col);
			}
			g.globalAlpha = 1;
		}
	};
	V.rosebush = { w: 44,
		back: function (b, S) {
			b.save(); b.translate(22, 3); bush(b, 15, ["#2f7a3a", "#3f9a4a", "#63b85e"]); b.restore();
			for (var i = 0; i < 11; i++) { var a = Math.PI + S.R() * Math.PI, k = 0.35 + S.R() * 0.6; rose(b, 22 + Math.cos(a) * 17 * k, 1 + Math.sin(a) * 14 * k - 2, 2 + S.R() * 0.9, pick(S.R, ["#e63946", "#ff5c8a", "#c9184a", "#ffd6e0"])); }
		},
		front: function (b, S) { for (var i = 0; i < 6; i++) { ell(b, 6 + S.R() * 32, 5 + S.R() * 8, 1.2, 0.6, pick(S.R, LOVE), S.R() * 3); } }
	};
	V.bench = { w: 56,
		back: function (b, S) {
			var wood = "#a8733d", i;
			stroke(b, [9, 3, 9, -14, 7.4, -30], "#2c2a33", 1.3); stroke(b, [47, 3, 47, -14, 48.6, -30], "#2c2a33", 1.3);
			b.strokeStyle = "#2c2a33"; b.lineWidth = 1; b.beginPath(); b.arc(7.2, -13, 3.4, -1.4, 1.5); b.stroke(); b.beginPath(); b.arc(48.8, -13, 3.4, Math.PI - 1.5, Math.PI + 1.4); b.stroke();
			for (i = 0; i < 3; i++) { box(b, 7.6, -30 + i * 4.6, 40.8, 3.3, 0.6, i % 2 ? shade(wood, 0.92) : wood); }
			box(b, 6, -13.4, 44, 2.8, 0.8, wood); box(b, 6.6, -10.4, 42.8, 1.6, 0.6, shade(wood, 0.8));
			// box of chocolates and a bouquet on the seat
			b.save(); b.translate(36, -15.6); b.rotate(-0.1); heart(b, 0, -1.4, 4, "#c9184a"); heart(b, 0, -1.6, 2.6, "#e63946"); b.restore();
			stroke(b, [17, -14, 20, -21], "#3f8a35", 1); rose(b, 19.4, -22.6, 1.9, "#e63946"); rose(b, 22.4, -21.4, 1.7, "#ff5c8a"); rose(b, 21, -24.4, 1.6, "#ffd6e0");
			poly(b, [15, -13.6, 19, -20.6, 21.4, -18.6], "#f6e7c8");
		},
		live: function (g, S, t) {
			var pulse = 1 + Math.sin(t * 3) * 0.12, k = t % 6, nod = k > 4 && k < 5 ? Math.sin((k - 4) * Math.PI * 2) * 0.12 : 0;
			bird(g, 22, -30, 4.6, 1, "#e2574c", "#f6e7c8", nod); bird(g, 34, -30, 4.6, -1, "#ff8fab", "#fff3f6", nod);
			glowAt(g, 28, -41, 7, "255,110,150", 0.3); heart(g, 28, -41, 2.6 * pulse, "#ff5c8a");
		}
	};
	V.balloons = { w: 38,
		front: function (b, S) {
			b.save(); b.translate(0, 10);
			ell(b, 19, 1, 8, 1.2, "rgba(0,0,0,.16)");
			box(b, 13, -8, 12, 8.6, 0.8, "#ff8fab"); b.fillStyle = "#ffffff"; b.fillRect(18, -8, 2, 8.6); b.fillRect(13, -4.6, 12, 1.6); b.fillStyle = "rgba(0,0,0,.12)"; b.fillRect(22, -8, 3, 8.6);
			heart(b, 16.6, -9.4, 1.8, "#ffffff"); heart(b, 21.4, -9.4, 1.8, "#ffffff");
			b.restore();
		},
		live: function (g, S, t) {
			for (var i = 0; i < 5; i++) {
				var bx = 19 + (i - 2) * 6.6 + Math.sin(t * 0.9 + i * 1.7) * 1.6, by = -34 - (i % 2) * 9 + Math.cos(t * 0.7 + i * 1.3) * 1.3, col = LOVE[i % LOVE.length];
				g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 0.22; g.beginPath(); g.moveTo(19, 1); g.quadraticCurveTo(19 + (bx - 19) * 0.2, by * 0.4, bx, by + 5.6); g.stroke();
				heart(g, bx, by, 6, col); ell(g, bx - 2.6, by - 2.4, 0.9, 1.7, "rgba(255,255,255,.45)", 0.5);
				poly(g, [bx - 0.8, by + 6.4, bx + 0.8, by + 6.4, bx, by + 5.2], shade(col, 0.8));
			}
		}
	};
	V.arch = { w: 58,
		back: function (b, S) {
			var i, a;
			b.strokeStyle = "#f6f1e7"; b.lineWidth = 1.7; b.lineCap = "round"; b.beginPath(); b.moveTo(8, 3); b.lineTo(8, -30); b.arc(29, -30, 21, Math.PI, 0); b.lineTo(50, 3); b.stroke();
			b.lineWidth = 1; b.beginPath(); b.moveTo(13, 3); b.lineTo(13, -30); b.arc(29, -30, 16, Math.PI, 0); b.lineTo(45, 3); b.stroke();
			S.pts = [];
			for (i = 0; i <= 26; i++) {
				var k = i / 26, x, y;
				if (k < 0.25) { x = 10.5; y = 3 - k / 0.25 * 33; } else if (k > 0.75) { x = 47.5; y = 3 - (1 - k) / 0.25 * 33; } else { a = Math.PI + (k - 0.25) / 0.5 * Math.PI; x = 29 + Math.cos(a) * 18.5; y = -30 + Math.sin(a) * 18.5; }
				circ(b, x + (S.R() - 0.5) * 2, y + (S.R() - 0.5) * 2, 3 + S.R() * 1.4, i % 2 ? "#3f9a4a" : "#2f7a3a");
				S.pts.push([x, y]);
			}
			S.pts.forEach(function (p, j) { circ(b, p[0] - 1, p[1] - 1, 1.5, "#63b85e"); if (j % 2 === 0) { rose(b, p[0] + (S.R() - 0.5) * 3, p[1] + (S.R() - 0.5) * 3, 1.6 + S.R() * 0.7, pick(S.R, ["#e63946", "#ff5c8a", "#ffd6e0", "#c9184a"])); } });
		},
		live: function (g, S, t) {
			var i;
			for (i = 0; i < 3; i++) { var sw = Math.sin(t * 1.4 + i * 1.9) * 0.16, hx = 20 + i * 9, top = -47 + Math.abs(i - 1) * 4.6, L = 7 + (i % 2) * 3; g.save(); g.translate(hx, top); g.rotate(sw); stroke(g, [0, 0, 0, L], "rgba(255,255,255,.7)", 0.25); heart(g, 0, L + 2, 2.4, LOVE[i]); g.restore(); }
			g.globalCompositeOperation = "lighter";
			for (i = 1; i < S.pts.length; i += 2) { var on = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.3); A.light(g, S.pts[i][0], S.pts[i][1], 2.6, "255,225,170", 0.25 + 0.75 * on * on); }
			g.globalCompositeOperation = "source-over";
		}
	};

	SCENES.valentine = meadow("#86c94f", "#4c9a36", GRASS, "#b9df8c", ["#5fae58", "#7cc56b", "#a8dc92"], ["#ff5c8a", "#ffd6e0", "#e63946"], ["#ffffff", "#ffd6e0", "#ff8fab"]);
	SCENES.valentine.deck = ["mailbox", "rosebush", "bench", "balloons", "arch", "tulips", "rosebush", "picket", "daisies"];
	SCENES.valentine.roam = function (e) { return flutter(e, 1.2, 0, [["#ff5c8a", "#ffd6e0"], ["#e63946", "#ff8fab"], ["#ffffff", "#ffd6e0"], ["#c9184a", "#ff5c8a"]]); };
	SCENES.valentine.drift = function (e) { return drifter(e, "heart", LOVE); };

	var CLOVER = ["#40c057", "#69db7c", "#2f9e44"];
	V.potgold = { w: 62,
		back: function (b, S) {
			var cols = ["#e63946", "#ff8c1a", "#ffd23f", "#40c057", "#2a9df4", "#7b5cd6"], i, s;
			b.lineCap = "butt";
			for (i = 0; i < 6; i++) {
				for (s = 0; s < 14; s++) { b.globalAlpha = Math.pow(1 - s / 14, 1.3) * 0.85; b.strokeStyle = cols[i]; b.lineWidth = 2.5; b.beginPath(); b.arc(-5, 2, 59 - i * 2.4, -s * 0.105 - 0.01, -(s + 1) * 0.105 - 0.03, true); b.stroke(); }
			}
			b.globalAlpha = 1;
			S.coins = [];
			for (i = 0; i < 16; i++) { var a = Math.PI + S.R() * Math.PI, k = Math.sqrt(S.R()), cx = 48 + Math.cos(a) * 8.4 * k, cy = -13.4 + Math.sin(a) * 5.6 * k; ell(b, cx, cy, 2.3, 1.5, "#d99a1c", (S.R() - 0.5) * 0.8); ell(b, cx - 0.2, cy - 0.35, 2.1, 1.3, "#ffd23f", (S.R() - 0.5) * 0.8); S.coins.push([cx, cy]); }
			ell(b, 48, 2.4, 12, 1.6, "rgba(0,0,0,.2)");
			pot(b, 48, 3, 11);
		},
		front: function (b, S) { [[34, 7], [38.4, 10.4], [60, 8.4], [30, 11.6]].forEach(function (c) { ell(b, c[0], c[1] + 0.4, 2.3, 1.1, "#d99a1c"); ell(b, c[0], c[1], 2.2, 1, "#ffd23f"); ell(b, c[0] - 0.5, c[1] - 0.2, 0.9, 0.35, "rgba(255,255,255,.6)"); }); },
		live: function (g, S, t) {
			for (var i = 0; i < S.coins.length; i += 3) { var c = S.coins[i], k = (t * 0.7 + i * 0.37) % 1, a = Math.sin(k * Math.PI); g.globalAlpha = a; star(g, c[0], c[1] - 1, 0.6 + a * 1.9, "#fffbe0", t + i); glowAt(g, c[0], c[1] - 1, 4, "255,225,120", a * 0.5); }
			g.globalAlpha = 1;
		}
	};
	V.clovers = { w: 38, front: function (b, S) {
		var i;
		for (i = 0; i < 9; i++) { clover(b, 3 + S.R() * 32, 4 + S.R() * 9, 1.7 + S.R() * 1, pick(S.R, ["#8ce99a", "#69db7c", "#b2f2bb"])); }
		for (i = 0; i < 5; i++) {
			(function (i) { var h = 7 + S.R() * 6, col = pick(S.R, CLOVER), four = i === 2; sway(S, 5 + i * 7 + (S.R() - 0.5) * 3, 6 + (i % 3) * 3 + S.R() * 2, 14, h + 9, 0.07, function (g) { stem(g, h, 0.6, shade(col, 0.8), 0.6); clover(g, 0.6, -h, four ? 4.6 : 3.6, four ? "#b2f2bb" : pick(S.R, ["#8ce99a", "#69db7c"]), four); }); })(i);
		}
	} };
	V.hat = { w: 36,
		front: function (b, S) {
			b.save(); b.translate(0, 9);
			ell(b, 16, 1.4, 14, 1.8, "rgba(0,0,0,.18)");
			b.save(); b.translate(15, 1); b.rotate(-0.1);
			ell(b, 0, 0, 13, 2.6, "#1f8a3c"); poly(b, [-7.6, -0.4, -6.4, -15, 6.4, -15, 7.6, -0.4], "#2b9e48"); ell(b, 0, -15, 6.4, 1.5, "#37b25a");
			b.fillStyle = "rgba(0,0,0,.14)"; b.fillRect(2.6, -15, 4.4, 14.8);
			b.fillStyle = "#1c1c1c"; b.fillRect(-7.4, -5.2, 14.8, 3.4); box(b, -2.4, -6, 4.8, 5, 0.6, "#ffd23f"); b.fillStyle = "#1c1c1c"; b.fillRect(-1.1, -4.8, 2.2, 2.6);
			clover(b, -4.4, -11, 1.5, "#8ce99a");
			b.restore();
			// horseshoe
			b.strokeStyle = "#d99a1c"; b.lineWidth = 1.7; b.lineCap = "round"; b.beginPath(); b.arc(30, -4, 3.6, -Math.PI * 0.75, -Math.PI * 0.25, true); b.stroke();
			b.strokeStyle = "#ffd23f"; b.lineWidth = 0.6; b.beginPath(); b.arc(30, -4, 3.6, -Math.PI * 0.75, -Math.PI * 0.25, true); b.stroke();
			b.restore();
		}
	};
	V.stone = { w: 34, back: function (b, S) {
		var i, a;
		b.fillStyle = lin(b, 8, 0, 26, 0, "#a9adb8", "#767b8a"); b.beginPath(); b.moveTo(8, 3); b.quadraticCurveTo(6, -24, 12, -34); b.quadraticCurveTo(17, -40, 23, -33); b.quadraticCurveTo(28, -22, 26, 3); b.closePath(); b.fill();
		b.strokeStyle = "rgba(235,240,250,.6)"; b.lineWidth = 0.6; b.lineCap = "round";
		for (i = 0; i < 3; i++) { var cx = 17 + Math.cos(i * TAU / 3 - Math.PI / 2) * 4, cy = -19 + Math.sin(i * TAU / 3 - Math.PI / 2) * 4; b.beginPath(); for (a = 0; a < 7.2; a += 0.35) { var r = 3.3 * (1 - a / 8.5); b.lineTo(cx + Math.cos(a + i * 2.1) * r, cy + Math.sin(a + i * 2.1) * r); } b.stroke(); }
		ell(b, 11, 0.6, 4.4, 2, "#4f9a3a"); ell(b, 23.4, 1.2, 3.4, 1.6, "#40c057"); ell(b, 12.6, -29, 2.6, 1.2, "#5fae58", -0.9);
	} };

	SCENES.stpatrick = meadow("#5fc04a", "#2f8a32", ["#8ce06a", "#40c057", "#2b8a3e"], "#a6de84", ["#3f9a4a", "#5fb85e", "#8cd98a"], ["#ffffff", "#ffd23f"], ["#ffffff", "#ffd23f", "#8ce99a"]);
	SCENES.stpatrick.deck = ["potgold", "clovers", "hat", "mushrooms", "stone", "clovers", "daisies", "picket"];
	SCENES.stpatrick.roam = function (e) { return flutter(e, 1.1, 0.3, [["#40c057", "#b2f2bb"], ["#ffffff", "#d3f9d8"], ["#ff922b", "#ffd8a8"], ["#ffd23f", "#fff3b0"]]); };
	SCENES.stpatrick.drift = function (e) { return drifter(e, "clover", CLOVER); };

	V.well = { w: 40, back: function (b, S) {
		var i, k;
		b.fillStyle = "#8a6238"; b.fillRect(8, -34, 2.2, 22); b.fillRect(29.8, -34, 2.2, 22);
		poly(b, [3.6, -33, 20, -45.5, 36.4, -33], "#2f8a3c"); poly(b, [20, -45.5, 36.4, -33, 31.6, -33, 20, -41.8], "rgba(0,0,0,.18)");
		clover(b, 20, -37.6, 2.1, "#8ce99a", false, true);
		stroke(b, [10, -27, 30, -27], "#6b4a2c", 1.3); stroke(b, [30, -27, 33.4, -27, 33.4, -23.6], "#4a4f5c", 0.6);
		stroke(b, [20, -27, 20, -19], "#e8dcc0", 0.4); poly(b, [17.4, -19, 22.6, -19, 21.9, -14, 18.1, -14], "#a8733d"); b.fillStyle = "#7a5230"; b.fillRect(17.4, -19.4, 5.2, 1);
		b.fillStyle = lin(b, 6, 0, 34, 0, "#a9adb8", "#767b8a"); b.fillRect(6, -13, 28, 16);
		ell(b, 20, -13, 14, 2.7, "#9499a8"); ell(b, 20, -13, 10.6, 1.8, "#27303c");
		b.strokeStyle = "rgba(60,66,84,.45)"; b.lineWidth = 0.4;
		for (i = 0; i < 3; i++) { b.beginPath(); b.moveTo(6, -6.6 + i * 4); b.lineTo(34, -6.6 + i * 4); b.stroke(); for (k = 0; k < 5; k++) { b.beginPath(); b.moveTo(9 + k * 6 + (i % 2) * 3, -10.4 + i * 4); b.lineTo(9 + k * 6 + (i % 2) * 3, -6.6 + i * 4); b.stroke(); } }
		ell(b, 9, 1.4, 4, 1.6, "#40c057"); ell(b, 31.6, 1.8, 3.2, 1.4, "#2f9e44");
	} };
	V.harp = { w: 28,
		front: function (b, S) {
			var i;
			function frame() { b.beginPath(); b.moveTo(9, 0); b.lineTo(9, -22); b.bezierCurveTo(12, -30, 19, -21, 23.4, -27.4); b.bezierCurveTo(24.4, -16, 19, -7, 9, 0); }
			b.save(); b.translate(0, 9);
			ell(b, 15.4, 0.8, 9, 1.3, "rgba(0,0,0,.16)");
			b.strokeStyle = "rgba(255,246,200,.75)"; b.lineWidth = 0.28;
			for (i = 0; i < 7; i++) { var x = 10.8 + i * 1.75; b.beginPath(); b.moveTo(x, -23.6 + Math.sin(i * 0.9) * 1.6); b.lineTo(x, -27 + (23.4 - x) / 14.4 * 27 - 1.5); b.stroke(); }
			b.lineCap = "round"; b.lineJoin = "round";
			b.strokeStyle = "#b9801a"; b.lineWidth = 2.5; frame(); b.stroke();
			b.strokeStyle = "#ffd23f"; b.lineWidth = 1.3; frame(); b.stroke();
			b.strokeStyle = "rgba(255,255,255,.5)"; b.lineWidth = 0.4; b.beginPath(); b.moveTo(8.6, -3); b.lineTo(8.6, -21); b.stroke();
			clover(b, 23.4, -28.6, 1.7, "#51cf66", false, true);
			b.restore();
		},
		live: function (g, S, t) {
			for (var i = 0; i < 2; i++) { var q = ((t * 0.26 + i * 0.5) % 1); g.globalAlpha = Math.sin(q * Math.PI) * 0.9; g.fillStyle = "#ffe98a"; g.font = "700 4.6px sans-serif"; g.fillText(i ? "\u266b" : "\u266a", 20 + Math.sin(q * 5 + i) * 3, -22 - q * 15); }
			g.globalAlpha = 1;
		}
	};
	V.irishflags = { w: 54,
		back: function (b, S) {
			[5, 49].forEach(function (x) { b.fillStyle = "#8a6238"; b.fillRect(x - 0.9, -44, 1.8, 47); b.fillStyle = "rgba(0,0,0,.2)"; b.fillRect(x + 0.2, -44, 0.7, 47); circ(b, x, -44.8, 1.4, "#ffd23f"); });
		},
		live: function (g, S, t) {
			var cols = ["#2f9e44", "#ffffff", "#ff922b"], i;
			function wy(x) { var f = (x - 5) / 44; return -43 + 22 * f * (1 - f); }
			g.strokeStyle = "#f6f1e7"; g.lineWidth = 0.3; g.beginPath(); for (i = 0; i <= 22; i++) { var x = 5 + i * 2; if (i) { g.lineTo(x, wy(x)); } else { g.moveTo(x, wy(x)); } } g.stroke();
			for (i = 0; i < 9; i++) {
				var fx = 8.6 + i * 4.6, tip = Math.sin(t * 2.6 + i * 1.3) * 0.7;
				g.save(); g.translate(fx, wy(fx)); g.rotate(Math.sin(t * 2 + i) * 0.07);
				poly(g, [-1.9, 0, 1.9, 0, tip, 5.6], cols[i % 3]); poly(g, [0.3, 0, 1.9, 0, tip, 5.6], "rgba(0,0,0,.12)");
				g.restore();
			}
		}
	};
	SCENES.stpatrick.deck = ["potgold", "clovers", "hat", "well", "mushrooms", "stone", "irishflags", "harp", "daisies", "picket"];

	// ---------------------------------------------------------------- the strip
	// Land (hills, ground band, wildlife) is measured in u = strip height / 200; the vignettes are drawn ZOOM times larger.
	var ZOOM = 1.5;
	function makeStrip(W, H, o, d) {
		var kind = SCENES[o.kind] ? o.kind : "spring", sc = SCENES[kind], u = H / 200, z = u * ZOOM, gy = H - 26 * u, seed = o.seed || 1, R = SSO.seeded("sstrip" + seed + kind), slots = [], deck = [], x = -R() * 18 * u, guard = 0, i;
		function groundY(px) { return gy - (2.2 + 1.7 * Math.sin(px / (47 * u) + 1.3 + seed) + 1.1 * Math.sin(px / (19 * u))) * u; }
		var env = { W: W, H: H, u: u, gy: gy, d: d, seed: seed, kind: kind, groundY: groundY, busy: o.busy == null ? 1 : o.busy, preview: o.preview };
		while (x < W + 4 * u && guard++ < 400) {
			if (!deck.length) { deck = sc.deck.slice(); for (i = deck.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp; } }
			// never the same vignette twice in a row
			if (slots.length && deck[0] === slots[slots.length - 1].name) { for (i = 1; i < deck.length; i++) { if (deck[i] !== deck[0]) { deck.push(deck.splice(0, 1, deck[i])[0]); deck.splice(i, 1); break; } } }
			var name = deck.shift(), v = V[name];
			if (!v) { continue; }
			slots.push({ name: name, v: v, x: x, w: v.w * z, u: z, gy: gy, d: d, R: SSO.seeded("slot" + slots.length + name + seed), sway: [], fx: [], t0: R() * 40, env: env });
			x += v.w * z + (6 + R() * 16) * u;
		}
		function inSlot(b, S, fn) { b.save(); b.translate(S.x, gy); b.scale(z, z); fn(b, S); b.restore(); }
		function paint(b) {
			if (sc.far) { sc.far(b, env); }
			slots.forEach(function (S) { if (S.v.back) { inSlot(b, S, S.v.back); } });
			sc.ground(b, env);
			slots.forEach(function (S) { if (S.v.front) { inSlot(b, S, S.v.front); } S.sway.sort(function (p, q) { return p.y - q.y; }); });
		}
		var roam = sc.roam ? sc.roam(env) : null, drift = o.drift !== false && sc.drift ? sc.drift(env) : null;
		function live(g, t, dt) {
			for (var k = 0; k < slots.length; k++) {
				var S = slots[k];
				if (S.sway.length) { drawSway(g, S, t); }
				if (S.v.live) { g.save(); g.translate(S.x, gy); g.scale(z, z); S.v.live(g, S, t + S.t0, dt); g.restore(); }
			}
			if (roam) { roam(g, t, dt); }
			if (drift) { drift(g, t, dt); }
			if (sc.fore) { sc.fore(g, env, t, dt); }
		}
		return { paint: paint, live: live };
	}

	SSO.register({
		id: "seasonstrip",
		name: "Seasonal scene strip",
		category: "holidays",
		description: "A short strip of seasonal life for the very bottom of your stream, the full width of the screen: a spring garden with tulips, bees and a cherry tree, a summer beach, an autumn harvest, a Halloween graveyard and more. Transparent above the scene, with gentle looping motion.",
		size: [1920, 220],
		sizeFor: function (c, thumb) { return thumb ? [1100, c.height] : [1920, c.height]; },
		fields: [
			{ key: "scene", label: "Scene", type: "select", group: "Strip", default: "spring", options: [["spring", "Spring garden"], ["beach", "Summer beach"], ["autumn", "Autumn harvest"], ["halloween", "Halloween graveyard"], ["easter", "Easter meadow"], ["valentine", "Valentine's garden"], ["stpatrick", "St. Patrick's Day"]] },
			{ key: "height", label: "Strip height", type: "range", group: "Strip", default: 220, min: 110, max: 460, step: 10, help: "Everything scales with the height. Set the OBS source to the full width of your canvas and this height, and sit it on the bottom edge." },
			{ key: "busy", label: "Wildlife (butterflies, gulls, bats, ghosts...)", type: "range", group: "Strip", default: 1, min: 0, max: 3, step: 0.1 },
			{ key: "speed", label: "Speed", type: "range", group: "Strip", default: 1, min: 0.3, max: 2, step: 0.1 },
			{ key: "seed", label: "Shuffle the layout (any number)", type: "number", group: "Strip", default: 1, min: 1, max: 9999, step: 1 },
			{ key: "drift", label: "Petals, leaves or hearts drifting over the strip", type: "bool", group: "Extras", default: true }
		],
		presets: [
			{ name: "Spring garden", tags: ["spring", "cute", "cozy"], values: {} },
			{ name: "Summer beach", tags: ["summer", "cute"], values: { scene: "beach" } },
			{ name: "Autumn harvest", tags: ["autumn", "cozy"], values: { scene: "autumn" } },
			{ name: "Halloween graveyard", tags: ["halloween", "spooky", "autumn"], values: { scene: "halloween" } },
			{ name: "Easter meadow", tags: ["holiday", "spring", "cute"], values: { scene: "easter" } },
			{ name: "Valentine's garden", tags: ["holiday", "cute"], values: { scene: "valentine" } },
			{ name: "St. Patrick's Day", tags: ["holiday", "spring"], values: { scene: "stpatrick" } },
			{ name: "Busy beach day", tags: ["summer"], values: { scene: "beach", busy: 2.4, seed: 5 } },
			{ name: "Thanksgiving harvest (tall)", tags: ["autumn", "holiday", "cozy"], values: { scene: "autumn", height: 320, seed: 8 } },
			{ name: "Haunted graveyard (tall)", tags: ["halloween", "spooky"], values: { scene: "halloween", height: 320, seed: 4, busy: 1.8 } },
			{ name: "Quiet spring meadow", tags: ["spring", "cozy"], values: { seed: 7, busy: 0.5, speed: 0.8 } }
		],
		render: function (root, c, ctx) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:" + c.height + "px;max-height:100%;overflow:hidden;";
			root.appendChild(host);
			var strip = null, back = null;
			A.stage(host, function (g, W, H, t, dt, resized, d) {
				if (resized || !strip) {
					strip = makeStrip(W, H, { kind: c.scene, seed: c.seed, busy: c.busy, drift: c.drift, preview: ctx && ctx.preview }, d);
					back = A.layer(W, H, d); strip.paint(back.b);
				}
				g.drawImage(back.cv, 0, 0, W, H);
				strip.live(g, t * c.speed, dt * c.speed);
			});
		}
	});

	// ---------------------------------------------------------------- seasonal effects (full frame, transparent)
	// Each kind: build(W, H, c, ctx, density) -> draw(g, t, dt), with t / dt already scaled by the speed setting.
	var FX = {};
	function hexOr(v, def) { v = String(v || "").replace(/^#/, ""); return /^[0-9a-f]{6}$/i.test(v) ? "#" + v : /^[0-9a-f]{3}$/i.test(v) ? "#" + v[0] + v[0] + v[1] + v[1] + v[2] + v[2] : def; }
	function cornersOf(where) { return { top: [0, 1], bottom: [2, 3], all: [0, 1, 2, 3], left: [0, 2], right: [1, 3], tl: [0], tr: [1] }[where] || [0, 1]; }
	// Runs fn with the canvas flipped so (0, 0) is that corner (0 TL, 1 TR, 2 BL, 3 BR) and +x / +y point into the frame.
	function inCorner(g, W, H, k, fn) { g.save(); g.translate(k % 2 ? W : 0, k > 1 ? H : 0); g.scale(k % 2 ? -1 : 1, k > 1 ? -1 : 1); fn(); g.restore(); }
	// A cord hung from evenly spaced pins: each span is a parabola, which one quadratic curve draws exactly.
	function swag(g, W, pins, top, sag) { g.beginPath(); g.moveTo(0, top); for (var i = 0; i < pins; i++) { g.quadraticCurveTo((i + 0.5) / pins * W, top + sag * 2, (i + 1) / pins * W, top); } g.stroke(); }
	function areaK(W, H) { return Math.max(0.6, W * H / 2073600); }
	function sprite(w, h, draw) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d")); return cv; }
	// Things that tumble down the frame like paper: list items { x, y, s, rot, vr, fl, vf, ph, sp, k }.
	function tumble(W, H, n, make) { var list = []; for (var i = 0; i < n; i++) { var p = make(i); p.x = Math.random() * W; p.y = Math.random() * H; p.rot = Math.random() * TAU; p.fl = Math.random() * TAU; p.ph = Math.random() * TAU; p.k = i; list.push(p); } return list; }
	function tumbleStep(list, W, H, t, dt, wind) {
		for (var j = 0; j < list.length; j++) {
			var p = list[j];
			p.y += p.sp * dt; p.x += (wind * p.sp * 0.7 + Math.sin(t * 0.8 + p.ph) * p.sp * 0.8) * dt; p.rot += p.vr * dt; p.fl += p.vf * dt;
			if (p.y > H + p.s * 2) { p.y = -p.s * 2; p.x = Math.random() * W; }
			if (p.x > W + p.s * 2) { p.x = -p.s * 2; } else if (p.x < -p.s * 2) { p.x = W + p.s * 2; }
		}
	}

	function flower5(g, x, y, r, col, rot) {
		var i;
		g.save(); g.translate(x, y); g.rotate(rot);
		for (i = 0; i < 5; i++) { g.save(); g.rotate(i * TAU / 5); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-r * 0.66, -r * 0.3, -r * 0.52, -r * 1.08, 0, -r * 0.9); g.bezierCurveTo(r * 0.52, -r * 1.08, r * 0.66, -r * 0.3, 0, 0); g.fill(); g.restore(); }
		circ(g, 0, 0, r * 0.25, "#d6336c");
		g.fillStyle = "#ffe066"; for (i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i * 1.05) * r * 0.38, Math.sin(i * 1.05) * r * 0.38, r * 0.06, 0, TAU); g.fill(); }
		g.restore();
	}
	// A bough that forks; pushes [x, y, depth] points along itself into out so blossoms can be hung on it.
	function bough(g, x, y, ang, len, w, depth, R, out) {
		var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, bend = (R() - 0.5) * len * 0.35, cx = (x + x2) / 2 - Math.sin(ang) * bend, cy = (y + y2) / 2 + Math.cos(ang) * bend, i;
		g.strokeStyle = "#4a2f26"; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
		g.strokeStyle = "rgba(255,225,205,.24)"; g.lineWidth = w * 0.3; g.beginPath(); g.moveTo(x, y - w * 0.22); g.quadraticCurveTo(cx, cy - w * 0.22, x2, y2 - w * 0.22); g.stroke();
		for (i = 1; i <= 4; i++) { var k = i / 4; out.push([(1 - k) * (1 - k) * x + 2 * (1 - k) * k * cx + k * k * x2, (1 - k) * (1 - k) * y + 2 * (1 - k) * k * cy + k * k * y2, depth]); }
		if (depth > 0) {
			bough(g, x2, y2, ang - 0.25 - R() * 0.45, len * (0.62 + R() * 0.16), w * 0.62, depth - 1, R, out);
			bough(g, x2, y2, ang + 0.3 + R() * 0.45, len * (0.56 + R() * 0.16), w * 0.58, depth - 1, R, out);
			if (R() < 0.6) { bough(g, cx, cy, ang + (R() < 0.5 ? 0.9 : -0.9), len * 0.42, w * 0.45, 0, R, out); }
		}
	}
	var petalImgs = null;
	function petalSprites() {
		if (petalImgs) { return petalImgs; }
		petalImgs = [["#ffe3ec", "#f7a8c4"], ["#ffffff", "#ffd3e2"], ["#ffd3e2", "#f48fb1"]].map(function (c) {
			return sprite(48, 48, function (g) {
				var gr = g.createLinearGradient(8, 8, 40, 40); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
				g.fillStyle = gr; g.beginPath(); g.moveTo(24, 44); g.bezierCurveTo(2, 34, 4, 8, 19, 5); g.lineTo(24, 11); g.lineTo(29, 5); g.bezierCurveTo(44, 8, 46, 34, 24, 44); g.fill();
				g.strokeStyle = "rgba(214,51,108,.25)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(24, 42); g.lineTo(24, 16); g.stroke();
			});
		});
		return petalImgs;
	}
	FX.blossom = function (W, H, c, ctx, d) {
		var vh = H / 100, S = Math.min(56 * vh * c.size, W * 0.48), layers = [], img = petalSprites(), cols = ["#ffd3e2", "#f7a8c4", "#ffffff", "#ffc2d6"];
		cornersOf(c.where).forEach(function (k, li) {
			var L = A.layer(S, S, d), b = L.b, R = SSO.seeded("blossom" + k), pts = [];
			bough(b, -S * 0.02, S * 0.09, 0.4, S * 0.36, S * 0.03, 3, R, pts);
			bough(b, S * 0.1, -S * 0.02, 1.05, S * 0.26, S * 0.022, 2, R, pts);
			pts.forEach(function (p) {
				var m = p[2] === 0 ? 3 : p[2] === 1 ? 2 : 1;
				for (var q = 0; q < m; q++) {
					var r = S * (0.02 + R() * 0.013), px = p[0] + (R() - 0.5) * S * 0.05, py = p[1] + (R() - 0.5) * S * 0.05, roll = R();
					if (roll < 0.18) { ell(b, px, py, r * 0.9, r * 0.4, R() < 0.5 ? "#7fbf5c" : "#5aa843", R() * 3); }
					else if (roll < 0.34) { circ(b, px, py, r * 0.42, "#e86a9a"); circ(b, px - r * 0.12, py - r * 0.12, r * 0.16, "#ffb3cd"); }
					else { flower5(b, px, py, r, pick(R, cols), R() * TAU); }
				}
			});
			layers.push({ k: k, cv: L.cv, ph: li * 1.7 });
		});
		var petals = tumble(W, H, Math.round(34 * c.amount * areaK(W, H)), function () { return { s: (0.7 + Math.random() * 0.8) * vh * c.size, vr: (Math.random() - 0.5) * 2, vf: 1.5 + Math.random() * 2.5, sp: (6 + Math.random() * 7) * vh }; });
		return function (g, t, dt) {
			layers.forEach(function (L) { inCorner(g, W, H, L.k, function () { g.drawImage(L.cv, 0, 0, S, S); }); });
			tumbleStep(petals, W, H, t, dt, 0.3 + Math.sin(t * 0.13) * 0.5);
			for (var j = 0; j < petals.length; j++) {
				var p = petals[j];
				g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.max(0.18, Math.abs(Math.cos(p.fl)))); g.drawImage(img[p.k % 3], -p.s, -p.s, p.s * 2, p.s * 2); g.restore();
			}
		};
	};

	FX.maple = function (W, H, c, ctx, d) {
		var vh = H / 100, S = Math.min(56 * vh * c.size, W * 0.48), layers = [], spr = SSO.leafSprites ? SSO.leafSprites() : null;
		function leaf(b, s, k) { if (spr) { b.drawImage(spr[k % spr.length], -s, -s, s * 2, s * 2); } else { ell(b, 0, 0, s * 0.6, s, FALL[k % FALL.length]); } }
		cornersOf(c.where).forEach(function (k) {
			var L = A.layer(S, S, d), b = L.b, R = SSO.seeded("maple" + k), pts = [], n = 0;
			bough(b, -S * 0.02, S * 0.09, 0.4, S * 0.36, S * 0.03, 3, R, pts);
			bough(b, S * 0.1, -S * 0.02, 1.05, S * 0.26, S * 0.022, 2, R, pts);
			pts.forEach(function (p) {
				for (var q = 0; q < (p[2] === 0 ? 2 : 1); q++) { b.save(); b.translate(p[0] + (R() - 0.5) * S * 0.06, p[1] + (R() - 0.5) * S * 0.06); b.rotate(R() * TAU); leaf(b, S * (0.03 + R() * 0.022), n++); b.restore(); }
			});
			layers.push({ k: k, cv: L.cv });
		});
		var leaves = tumble(W, H, Math.round(16 * c.amount * areaK(W, H)), function () { return { s: (1.6 + Math.random() * 1.6) * vh * c.size, vr: (Math.random() - 0.5) * 1.8, vf: 1 + Math.random() * 2.2, sp: (5 + Math.random() * 6) * vh }; });
		return function (g, t, dt) {
			layers.forEach(function (L) { inCorner(g, W, H, L.k, function () { g.drawImage(L.cv, 0, 0, S, S); }); });
			tumbleStep(leaves, W, H, t, dt, 0.35 + Math.sin(t * 0.12) * 0.5);
			for (var j = 0; j < leaves.length; j++) {
				var p = leaves[j];
				g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.max(0.14, Math.abs(Math.cos(p.fl)))); leaf(g, p.s, p.k); g.restore();
			}
		};
	};

	FX.butterflies = function (W, H, c) {
		var vh = H / 100, n = Math.max(1, Math.round(7 * c.amount)), main = hexOr(c.color, ""), list = [], i;
		for (i = 0; i < n; i++) {
			var w = main ? [i % 2 ? shade(main, 0.85) : main, shade(main, 1.5)] : WINGS[i % WINGS.length];
			list.push({ x: Math.random() * W, y: (12 + Math.random() * 72) * vh, dir: Math.random() < 0.5 ? -1 : 1, v: (7 + Math.random() * 8) * vh, ph: Math.random() * TAU, s: (2.6 + Math.random() * 2) * vh * c.size, c1: w[0], c2: w[1], wob: 5 + Math.random() * 9 });
		}
		list.sort(function (a, b) { return a.s - b.s; });
		return function (g, t, dt) {
			for (var j = 0; j < list.length; j++) {
				var f = list[j], m = f.s * 3;
				f.x += f.dir * f.v * dt * (0.5 + 0.5 * Math.sin(t * 0.6 + f.ph));
				if (f.x > W + m) { f.x = -m; f.y = (12 + Math.random() * 72) * vh; } else if (f.x < -m) { f.x = W + m; f.y = (12 + Math.random() * 72) * vh; }
				butterfly(g, f.x, f.y + Math.sin(t * 0.8 + f.ph) * f.wob * vh + Math.sin(t * 2.3 + f.ph) * 2 * vh, f.s, Math.abs(Math.sin(t * 8.5 + f.ph)), f.c1, f.c2, f.dir * 0.55 + Math.cos(t * 0.8 + f.ph) * 0.3);
			}
		};
	};

	FX.fireflies = function (W, H, c) {
		var vh = H / 100, n = Math.round(54 * c.amount * areaK(W, H)), list = [], i;
		for (i = 0; i < n; i++) { list.push({ x: Math.random() * W, y: H * (0.18 + Math.random() * 0.8), ax: (4 + Math.random() * 9) * vh, ay: (3 + Math.random() * 6) * vh, fx: 0.2 + Math.random() * 0.4, fy: 0.25 + Math.random() * 0.45, ph: Math.random() * TAU, bl: 2.6 + Math.random() * 4, off: Math.random() * 10, r: (0.9 + Math.random() * 0.9) * vh * c.size, vx: (Math.random() - 0.5) * 1.6 * vh }); }
		return function (g, t, dt) {
			g.globalCompositeOperation = "lighter";
			for (var j = 0; j < list.length; j++) {
				var f = list[j];
				f.x += f.vx * dt; if (f.x > W + 12 * vh) { f.x = -12 * vh; } else if (f.x < -12 * vh) { f.x = W + 12 * vh; }
				var x = f.x + Math.sin(t * f.fx + f.ph) * f.ax, y = f.y + Math.cos(t * f.fy + f.ph * 1.7) * f.ay, cyc = ((t + f.off) % f.bl) / f.bl, a = cyc < 0.45 ? Math.sin(cyc / 0.45 * Math.PI) : 0;
				a *= a;
				if (a > 0.02) { A.light(g, x, y, f.r * 3.4, "180,255,80", a * 0.85); A.light(g, x, y, f.r, "255,255,215", a); }
				else { A.light(g, x, y, f.r * 0.55, "150,190,70", 0.3); }
			}
			g.globalCompositeOperation = "source-over";
		};
	};

	var seedImg = null;
	function seedSprite() {
		return seedImg || (seedImg = sprite(64, 96, function (g) {
			g.strokeStyle = "rgba(255,255,255,.9)"; g.lineCap = "round"; g.lineWidth = 1;
			for (var i = 0; i < 13; i++) { var a = -Math.PI / 2 + (i - 6) * 0.2; g.beginPath(); g.moveTo(32, 46); g.lineTo(32 + Math.cos(a) * 28, 46 + Math.sin(a) * 30); g.stroke(); g.beginPath(); g.arc(32 + Math.cos(a) * 28, 46 + Math.sin(a) * 30, 1.6, 0, TAU); g.fillStyle = "rgba(255,255,255,.95)"; g.fill(); }
			g.lineWidth = 1.4; g.beginPath(); g.moveTo(32, 46); g.lineTo(32, 82); g.stroke();
			g.fillStyle = "#b9a37a"; g.beginPath(); g.ellipse(32, 86, 2.2, 6, 0, 0, TAU); g.fill();
		}));
	}
	FX.sunrays = function (W, H, c) {
		var vh = H / 100, left = c.sun === "left", sx = left ? W * 0.07 : W * 0.93, sy = -H * 0.05, reach = Math.sqrt(W * W + H * H) * 1.05, N = 512, img = seedSprite(), i;
		function rays(seed, count) {
			return sprite(N, N, function (b) {
				var R = SSO.seeded(seed);
				b.translate(N / 2, N / 2);
				for (var k = 0; k < count; k++) {
					var a = R() * TAU, w = 0.015 + R() * 0.05, al = (0.06 + R() * 0.12) * Math.min(1.6, 0.5 + c.amount * 0.5), gr = b.createRadialGradient(0, 0, 0, 0, 0, N / 2);
					gr.addColorStop(0, "rgba(255,246,205," + al.toFixed(3) + ")"); gr.addColorStop(0.5, "rgba(255,236,170," + (al * 0.55).toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,230,160,0)");
					b.fillStyle = gr; b.beginPath(); b.moveTo(0, 0); b.arc(0, 0, N / 2, a - w, a + w); b.closePath(); b.fill();
				}
			});
		}
		var r1 = rays("raysA", 30), r2 = rays("raysB", 22), seeds = [], motes = [];
		var low = sprite(Math.ceil(W / 4), Math.ceil(H / 4), function () {}), lb = low.getContext("2d");
		var ghosts = [[0.3, 5, "255,200,120", 0.2], [0.5, 2.4, "140,255,190", 0.16], [0.72, 8, "255,150,170", 0.12], [1.02, 3.6, "150,200,255", 0.17], [1.3, 11, "255,220,150", 0.1]];
		for (i = 0; i < Math.round(12 * c.amount * areaK(W, H)); i++) { seeds.push({ x: Math.random() * W, y: Math.random() * H, s: (1.3 + Math.random() * 1.3) * vh * c.size, vx: (left ? 1 : -1) * (2 + Math.random() * 3.5) * vh, vy: -(0.3 + Math.random() * 1.6) * vh, ph: Math.random() * TAU }); }
		for (i = 0; i < Math.round(30 * c.amount * areaK(W, H)); i++) { motes.push({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * TAU, sp: 0.5 + Math.random() * 1.5, r: (0.25 + Math.random() * 0.4) * vh }); }
		return function (g, t, dt) {
			var px = sx + Math.sin(t * 0.13) * 1.2 * vh, py = sy + Math.cos(t * 0.11) * 0.8 * vh, j;
			lb.setTransform(0.25, 0, 0, 0.25, 0, 0); lb.globalCompositeOperation = "source-over"; lb.clearRect(0, 0, W + 4, H + 4); lb.globalCompositeOperation = "lighter";
			lb.save(); lb.translate(px, py); lb.rotate(Math.sin(t * 0.09) * 0.12); lb.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.5); lb.drawImage(r1, -reach, -reach, reach * 2, reach * 2); lb.restore();
			lb.save(); lb.translate(px, py); lb.rotate(-Math.sin(t * 0.07 + 1) * 0.16); lb.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.37 + 2); lb.drawImage(r2, -reach, -reach, reach * 2, reach * 2); lb.restore();
			lb.globalAlpha = 1;
			A.light(lb, px, py, 48 * vh * c.size, "255,236,170", 0.8); A.light(lb, px, py, 17 * vh * c.size, "255,255,235", 1);
			g.drawImage(low, 0, 0, low.width * 4, low.height * 4);
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < ghosts.length; j++) { var G = ghosts[j]; A.light(g, px + (W / 2 - px) * G[0] * 1.5, py + (H / 2 - py) * G[0] * 1.5, G[1] * vh * c.size * (1 + 0.06 * Math.sin(t + j)), G[2], G[3]); }
			for (j = 0; j < motes.length; j++) { var m = motes[j]; m.y -= 0.6 * vh * dt; m.x += Math.sin(t * 0.4 + m.ph) * vh * dt; if (m.y < -vh) { m.y = H + vh; m.x = Math.random() * W; } var tw = 0.5 + 0.5 * Math.sin(t * m.sp + m.ph); A.light(g, m.x, m.y, m.r * 3, "255,244,200", tw * tw * 0.7); }
			g.globalCompositeOperation = "source-over";
			for (j = 0; j < seeds.length; j++) {
				var s = seeds[j];
				s.x += (s.vx + Math.sin(t * 0.5 + s.ph) * 1.5 * vh) * dt; s.y += (s.vy + Math.cos(t * 0.7 + s.ph) * 1.2 * vh) * dt;
				if (s.x > W + s.s * 2) { s.x = -s.s * 2; s.y = Math.random() * H; } else if (s.x < -s.s * 2) { s.x = W + s.s * 2; s.y = Math.random() * H; }
				if (s.y < -s.s * 3) { s.y = H + s.s * 2; }
				g.save(); g.translate(s.x, s.y); g.rotate(Math.sin(t * 0.6 + s.ph) * 0.35 + (left ? 0.25 : -0.25)); g.globalAlpha = 0.85; g.drawImage(img, -s.s, -s.s * 1.5, s.s * 2, s.s * 3); g.restore();
			}
			g.globalAlpha = 1;
		};
	};

	// Leaves for the tropical corners, each on its own canvas (base at the bottom centre) so the cut-outs stay inside the leaf.
	function monstera(size) {
		return sprite(size, size, function (b) {
			var h = size * 0.86, w = size * 0.3, gr, i, side;
			b.translate(size / 2, size);
			stroke(b, [0, 0, 0, -h * 0.2], "#1b6b3a", size * 0.022);
			gr = b.createLinearGradient(-w, -h, w, 0); gr.addColorStop(0, "#36a862"); gr.addColorStop(1, "#176b3a");
			b.fillStyle = gr; b.beginPath(); b.moveTo(0, -h * 0.14); b.bezierCurveTo(-w * 1.7, -h * 0.02, -w * 1.45, -h * 0.86, 0, -h); b.bezierCurveTo(w * 1.45, -h * 0.86, w * 1.7, -h * 0.02, 0, -h * 0.14); b.fill();
			b.globalCompositeOperation = "destination-out";
			for (i = 0; i < 4; i++) {
				for (side = -1; side <= 1; side += 2) {
					var y = -h * (0.3 + i * 0.15), ex = side * w * (1.5 - i * 0.14);
					b.beginPath(); b.moveTo(ex * 1.3, y - h * 0.045); b.lineTo(side * w * 0.5, y + h * 0.02); b.lineTo(ex * 1.3, y + h * 0.05); b.closePath(); b.fill();
					b.beginPath(); b.ellipse(side * w * 0.32, y - h * 0.065, w * 0.12, h * 0.026, side * -0.5, 0, TAU); b.fill();
				}
			}
			b.globalCompositeOperation = "source-over";
			stroke(b, [0, -h * 0.14, 0, -h * 0.97], "rgba(200,245,200,.5)", size * 0.009);
			for (i = 0; i < 5; i++) { for (side = -1; side <= 1; side += 2) { stroke(b, [0, -h * (0.22 + i * 0.15), side * w * (1.15 - i * 0.13), -h * (0.36 + i * 0.15)], "rgba(200,245,200,.28)", size * 0.005); } }
		});
	}
	function bananaLeaf(size) {
		return sprite(size, size, function (b) {
			var h = size * 0.94, w = size * 0.15, gr, i;
			b.translate(size / 2, size);
			gr = b.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, "#4fae62"); gr.addColorStop(0.5, "#6cc47a"); gr.addColorStop(1, "#2f8f4c");
			b.fillStyle = gr; b.beginPath(); b.moveTo(0, 0); b.bezierCurveTo(-w * 1.7, -h * 0.3, -w * 1.4, -h * 0.9, 0, -h); b.bezierCurveTo(w * 1.4, -h * 0.9, w * 1.7, -h * 0.3, 0, 0); b.fill();
			b.globalCompositeOperation = "destination-out";
			[[-1, 0.42], [1, 0.58], [-1, 0.72]].forEach(function (q) { b.beginPath(); b.moveTo(q[0] * w * 1.6, -h * q[1] - h * 0.02); b.lineTo(q[0] * w * 0.35, -h * q[1] + h * 0.03); b.lineTo(q[0] * w * 1.6, -h * q[1] + h * 0.035); b.closePath(); b.fill(); });
			b.globalCompositeOperation = "source-over";
			for (i = 1; i < 16; i++) { stroke(b, [0, -h * i / 16, -w * 1.2, -h * i / 16 - h * 0.06], "rgba(20,90,50,.25)", size * 0.004); stroke(b, [0, -h * i / 16, w * 1.2, -h * i / 16 - h * 0.06], "rgba(20,90,50,.25)", size * 0.004); }
			stroke(b, [0, 0, 0, -h * 0.97], "rgba(220,250,210,.6)", size * 0.012);
		});
	}
	function hibiscus(g, x, y, r, col, rot) {
		var i;
		g.save(); g.translate(x, y); g.rotate(rot);
		for (i = 0; i < 5; i++) {
			g.save(); g.rotate(i * TAU / 5);
			var gr = g.createLinearGradient(0, 0, 0, -r); gr.addColorStop(0, shade(col, 0.55)); gr.addColorStop(0.45, col); gr.addColorStop(1, shade(col, 1.3));
			g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-r * 0.85, -r * 0.2, -r * 0.75, -r * 1.05, 0, -r); g.bezierCurveTo(r * 0.75, -r * 1.05, r * 0.85, -r * 0.2, 0, 0); g.fill();
			stroke(g, [0, -r * 0.15, 0, -r * 0.8], "rgba(255,255,255,.22)", r * 0.03);
			g.restore();
		}
		stroke(g, [0, 0, r * 0.42, -r * 0.5], "#ffd23f", r * 0.07);
		for (i = 0; i < 5; i++) { circ(g, r * 0.42 + Math.cos(i * 1.3) * r * 0.1, -r * 0.5 + Math.sin(i * 1.3) * r * 0.1, r * 0.05, "#ffe98a"); }
		g.restore();
	}
	FX.tropical = function (W, H, c, ctx, d) {
		var vh = H / 100, S = Math.min(50 * vh * c.size, W * 0.48), F = S * 0.62, layers = [], mon = monstera(360), ban = bananaLeaf(360);
		function stamp(b, img, x, y, ang, len) { b.save(); b.translate(x, y); b.rotate(ang + Math.PI / 2); b.drawImage(img, -len / 2, -len, len, len); b.restore(); }
		cornersOf(c.where).forEach(function (k, li) {
			var R = SSO.seeded("tropic" + k), back = A.layer(S, S, d), front = A.layer(F, F, d), o = -S * 0.05;
			back.b.save(); back.b.translate(o, o); back.b.scale(S / 60, S / 60);
			[0.16, 0.5, 0.86, 1.2, 1.5].forEach(function (a, i) { frond(back.b, a - 0.32, 46 - (i % 2) * 6, i % 2 ? "#2a7d45" : "#1f6a3a"); });
			back.b.restore();
			stamp(back.b, ban, o, o, 0.3 + R() * 0.1, S * 0.82); stamp(back.b, ban, o, o, 1.24 + R() * 0.1, S * 0.7);
			stamp(back.b, mon, S * 0.02, S * 0.02, 0.78, S * 0.74);
			stamp(front.b, mon, o, S * 0.06, 0.28 + R() * 0.1, S * 0.5); stamp(front.b, mon, S * 0.08, o, 1.3 - R() * 0.1, S * 0.46);
			hibiscus(front.b, S * 0.16, S * 0.13, S * 0.085, "#ff4d6d", R() * 3); hibiscus(front.b, S * 0.3, S * 0.07, S * 0.06, "#ff922b", R() * 3); hibiscus(front.b, S * 0.07, S * 0.3, S * 0.062, "#ffd23f", R() * 3);
			[[0.23, 0.26, 0.036], [0.4, 0.14, 0.03], [0.13, 0.42, 0.03]].forEach(function (q) { flower5(front.b, S * q[0], S * q[1], S * q[2], "#ffffff", R() * 3); });
			layers.push({ k: k, back: back.cv, front: front.cv, ph: li * 1.9 });
		});
		return function (g, t) {
			layers.forEach(function (L) {
				inCorner(g, W, H, L.k, function () { g.drawImage(L.back, 0, 0, S, S); g.rotate(Math.sin(t * 0.6 + L.ph) * 0.02 + Math.sin(t * 0.23 + L.ph * 2) * 0.008); g.drawImage(L.front, 0, 0, F, F); });
			});
		};
	};

	function heartSprite(col) {
		return sprite(96, 96, function (g) {
			var gr = g.createRadialGradient(34, 30, 4, 48, 48, 52); gr.addColorStop(0, shade(col, 1.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, 0.72));
			heart(g, 48, 50, 34, gr);
			ell(g, 31, 33, 5, 9, "rgba(255,255,255,.45)", 0.6);
		});
	}
	FX.hearts = function (W, H, c) {
		var vh = H / 100, main = hexOr(c.color, ""), pal = main ? [main, shade(main, 1.3), shade(main, 0.8), shade(main, 1.6)] : LOVE, spr = pal.map(heartSprite), list = [], n = Math.round(34 * c.amount * areaK(W, H)), i;
		for (i = 0; i < n; i++) { var z = Math.random(); list.push({ x: Math.random() * W, y: Math.random() * H, z: z, s: (1.4 + z * 3.2) * vh * c.size, v: (4 + z * 7) * vh, ph: Math.random() * TAU, k: i % spr.length }); }
		list.sort(function (a, b) { return a.z - b.z; });
		return function (g, t, dt) {
			for (var j = 0; j < list.length; j++) {
				var p = list[j];
				p.y -= p.v * dt; if (p.y < -p.s * 2) { p.y = H + p.s * 2; p.x = Math.random() * W; }
				var x = p.x + Math.sin(t * 0.8 + p.ph) * (2 + p.z * 3) * vh, a = (0.5 + p.z * 0.5) * clamp(p.y / (14 * vh), 0, 1) * clamp((H + p.s - p.y) / (8 * vh), 0, 1);
				if (a < 0.02) { continue; }
				g.globalAlpha = a; g.save(); g.translate(x, p.y); g.rotate(Math.sin(t * 1.1 + p.ph) * 0.22); g.drawImage(spr[p.k], -p.s, -p.s, p.s * 2, p.s * 2); g.restore();
			}
			g.globalAlpha = 1;
		};
	};

	FX.shamrocks = function (W, H, c) {
		var vh = H / 100, spr = ["#51cf66", "#69db7c", "#40c057", "#8ce99a"].map(function (col, i) { return sprite(96, 96, function (g) { var n = i === 3 ? 4 : 3, a; clover(g, 48, 48, 33.5, shade(col, 0.5), i === 3, true); clover(g, 48, 48, 30, col, i === 3, true); circ(g, 48, 48, 4, shade(col, 0.8)); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1.6; g.lineCap = "round"; for (var q = 0; q < n; q++) { a = q * TAU / n + (n === 4 ? Math.PI / 4 : -Math.PI / 2); g.beginPath(); g.moveTo(48 + Math.cos(a) * 7, 48 + Math.sin(a) * 7); g.lineTo(48 + Math.cos(a) * 26, 48 + Math.sin(a) * 26); g.stroke(); } }); });
		var list = tumble(W, H, Math.round(38 * c.amount * areaK(W, H)), function (i) { return { s: (2.3 + Math.random() * 2.5) * vh * c.size, vr: (Math.random() - 0.5) * 1.8, vf: 1 + Math.random() * 2, sp: (5 + Math.random() * 6) * vh, four: i % 9 === 4 }; }), glints = [], i;
		for (i = 0; i < Math.round(7 * c.amount); i++) { glints.push({ x: Math.random(), y: Math.random(), ph: Math.random() * 9, len: 2.5 + Math.random() * 3 }); }
		return function (g, t, dt) {
			var j;
			tumbleStep(list, W, H, t, dt, 0.25 + Math.sin(t * 0.12) * 0.45);
			for (j = 0; j < list.length; j++) {
				var p = list[j];
				g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.max(0.2, Math.abs(Math.cos(p.fl)))); g.drawImage(spr[p.four ? 3 : p.k % 3], -p.s, -p.s, p.s * 2, p.s * 2); g.restore();
			}
			for (j = 0; j < glints.length; j++) {
				var q = glints[j], k = ((t + q.ph) % q.len) / q.len, a = Math.sin(k * Math.PI);
				if (k < 0.02) { q.x = Math.random(); q.y = Math.random(); }
				g.globalAlpha = a; star(g, q.x * W, q.y * H, (0.4 + a * 1.2) * vh * c.size, "#ffe98a", t); glowAt(g, q.x * W, q.y * H, 3 * vh * c.size, "255,220,110", a * 0.5);
			}
			g.globalAlpha = 1;
		};
	};

	function lanternSprite(col, tall) {
		return sprite(160, 400, function (g) {
			var s = 62, ry = s * (tall ? 1.2 : 0.9), cy = 30 + ry, gr, i;
			g.translate(80, 6);
			stroke(g, [0, 0, 0, 26], "#c9a23a", 3);
			gr = g.createRadialGradient(-s * 0.25, cy - ry * 0.2, s * 0.1, 0, cy, s * 1.2); gr.addColorStop(0, shade(col, 1.55)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, 0.58));
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, cy, s, ry, 0, 0, TAU); g.fill();
			g.strokeStyle = shade(col, 0.55); g.lineWidth = 2;
			for (i = 1; i <= 2; i++) { g.beginPath(); g.ellipse(0, cy, s * i / 3, ry, 0, 0, TAU); g.stroke(); }
			g.beginPath(); g.moveTo(0, cy - ry); g.lineTo(0, cy + ry); g.stroke();
			box(g, -s * 0.42, cy - ry - 6, s * 0.84, 12, 3, "#d9b24a"); box(g, -s * 0.42, cy + ry - 6, s * 0.84, 12, 3, "#c9a23a");
			stroke(g, [0, cy + ry + 6, 0, cy + ry + 26], "#d9b24a", 3); circ(g, 0, cy + ry + 30, 6, "#d9b24a");
			for (i = -3; i <= 3; i++) { stroke(g, [i * 2, cy + ry + 34, i * 4.4, cy + ry + 78], i % 2 ? "#d9b24a" : col, 2.2); }
		});
	}
	FX.lanterns = function (W, H, c, ctx, d) {
		var vh = H / 100, n = Math.max(2, Math.round(9 * c.amount)), col = hexOr(c.color, "#d7263d"), img = [lanternSprite(col, false), lanternSprite(col, true)], rgb = rgbOf(shade(col, 1.25)).join(","), list = [], pins = Math.max(1, Math.round(n / 3)), i;
		var top = 0.8 * vh, sag = 4 * vh * Math.sqrt(c.size), R = SSO.seeded("lanterns");
		function wy(px) { var f = (px / W * pins) % 1; return top + sag * 4 * f * (1 - f); }
		for (i = 0; i < n; i++) { var x = (i + 0.5) / n * W; list.push({ x: x, y: wy(x), s: (3.1 + R() * 1.2) * vh * c.size, drop: (0.2 + R() * 2.4) * vh * c.size, tall: i % 3 === 1 ? 1 : 0, ph: R() * TAU, sp: 0.7 + R() * 0.5 }); }
		return function (g, t) {
			var j;
			g.lineCap = "round"; g.lineJoin = "round";
			[["rgba(40,20,10,.55)", 0.34], ["#c9a23a", 0.16]].forEach(function (st) { g.strokeStyle = st[0]; g.lineWidth = Math.max(1, st[1] * vh); swag(g, W, pins, top, sag); });
			for (j = 0; j < list.length; j++) {
				var L = list[j], sw = Math.sin(t * L.sp + L.ph) * 0.07 + Math.sin(t * 0.31 + L.ph * 2) * 0.03, w = L.s * 2.58, h = w * 2.5, f = A.flick(t * 0.6 + L.ph);
				g.save(); g.translate(L.x, L.y); g.rotate(sw);
				g.strokeStyle = "#c9a23a"; g.lineWidth = Math.max(1, 0.14 * vh); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, L.drop + 2); g.stroke();
				g.drawImage(img[L.tall], -w / 2, L.drop, w, h);
				glowAt(g, 0, L.drop + h * (L.tall ? 0.28 : 0.23), L.s * 2.6, rgb, 0.3 + f * 0.22);
				glowAt(g, 0, L.drop + h * (L.tall ? 0.28 : 0.23), L.s * 0.8, "255,235,190", 0.25 + f * 0.2);
				g.restore();
			}
		};
	};

	var AIR = [["#e63946", "#ffd23f", "#2a9df4", "#ffffff"], ["#ff922b", "#ffffff"], ["#19b5a5", "#ffd23f", "#ff5c8a"], ["#7b5cd6", "#ffafcc", "#ffffff"], ["#2a9df4", "#ffffff", "#e63946"]];
	function balloonSprite(cols) {
		return sprite(240, 400, function (g) {
			var s = 110, i;
			function outline() { g.beginPath(); g.moveTo(-s * 0.26, s * 1.2); g.bezierCurveTo(-s * 0.5, s * 0.75, -s * 1.02, s * 0.5, -s, 0); g.arc(0, 0, s, Math.PI, 0); g.bezierCurveTo(s * 1.02, s * 0.5, s * 0.5, s * 0.75, s * 0.26, s * 1.2); g.closePath(); }
			g.translate(120, 116);
			g.save(); outline(); g.clip();
			for (i = 0; i < 7; i++) {
				var k0 = -1 + i * 2 / 7, k1 = k0 + 2 / 7;
				g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(s * k0 * 0.26, s * 1.25); g.bezierCurveTo(s * k0 * 1.5, s * 0.3, s * k0 * 1.25, -s * 0.9, 0, -s * 1.04); g.bezierCurveTo(s * k1 * 1.25, -s * 0.9, s * k1 * 1.5, s * 0.3, s * k1 * 0.26, s * 1.25); g.closePath(); g.fill();
			}
			var gr = g.createRadialGradient(-s * 0.4, -s * 0.45, s * 0.05, 0, 0, s * 1.5); gr.addColorStop(0, "rgba(255,255,255,.42)"); gr.addColorStop(0.4, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,30,.34)");
			g.fillStyle = gr; g.fillRect(-s * 1.1, -s * 1.1, s * 2.2, s * 2.5);
			g.restore();
			box(g, -s * 0.27, s * 1.17, s * 0.54, s * 0.07, 3, shade(cols[0], 0.7));
			stroke(g, [-s * 0.25, s * 1.22, -s * 0.17, s * 1.66], "#6b4a2c", 2.4); stroke(g, [s * 0.25, s * 1.22, s * 0.17, s * 1.66], "#6b4a2c", 2.4); stroke(g, [-s * 0.08, s * 1.22, -s * 0.06, s * 1.66], "#6b4a2c", 1.6); stroke(g, [s * 0.08, s * 1.22, s * 0.06, s * 1.66], "#6b4a2c", 1.6);
			box(g, -s * 0.2, s * 1.64, s * 0.4, s * 0.28, 5, "#a8733d");
			g.strokeStyle = "rgba(70,40,15,.45)"; g.lineWidth = 1.6; for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-s * 0.2, s * 1.64 + i * s * 0.07); g.lineTo(s * 0.2, s * 1.64 + i * s * 0.07); g.stroke(); }
			box(g, -s * 0.22, s * 1.62, s * 0.44, s * 0.05, 3, "#7a5230");
		});
	}
	FX.balloons = function (W, H, c) {
		var vh = H / 100, n = Math.max(1, Math.round(4 * c.amount)), main = hexOr(c.color, ""), list = [], i;
		var imgs = (main ? [[main, "#ffffff"], [main, shade(main, 1.5), shade(main, 0.75)], [shade(main, 0.8), "#ffd23f", "#ffffff"]] : AIR).map(balloonSprite);
		for (i = 0; i < n; i++) { var z = (i + Math.random()) / n; list.push({ x: Math.random() * W, y: (14 + Math.random() * 46) * vh, z: z, s: (5 + z * 8) * vh * c.size, v: (1 + z * 2.2) * vh, dir: i % 3 === 2 ? -1 : 1, ph: Math.random() * TAU, img: imgs[i % imgs.length] }); }
		list.sort(function (a, b) { return a.z - b.z; });
		return function (g, t, dt) {
			for (var j = 0; j < list.length; j++) {
				var p = list[j], w = p.s * 2.18, h = w * 400 / 240;
				p.x += p.dir * p.v * dt;
				if (p.x > W + w) { p.x = -w; p.y = (14 + Math.random() * 46) * vh; } else if (p.x < -w) { p.x = W + w; p.y = (14 + Math.random() * 46) * vh; }
				var y = p.y + Math.sin(t * 0.4 + p.ph) * 1.6 * vh, burn = Math.max(0, Math.sin(t * 0.8 + p.ph) - 0.75) * 4;
				g.globalAlpha = 0.72 + p.z * 0.28;
				g.save(); g.translate(p.x, y); g.rotate(Math.sin(t * 0.5 + p.ph) * 0.03); g.drawImage(p.img, -w / 2, -h * 0.29, w, h);
				if (burn > 0.02) { glowAt(g, 0, p.s * 1.3, p.s * 0.7, "255,170,60", burn); }
				g.restore();
			}
			g.globalAlpha = 1;
		};
	};

	FX.rain = function (W, H, c) {
		var vh = H / 100, n = Math.round(170 * c.amount * areaK(W, H)), drops = [], rings = [], slant = 0.16, i;
		function reset(p, any) { p.z = Math.random(); p.x = Math.random() * (W + H * slant) - H * slant * 0.2; p.y = any ? Math.random() * H : -Math.random() * 20 * vh; p.len = (1.8 + p.z * 3.2) * vh * c.size; p.v = (85 + p.z * 75) * vh; p.end = H - Math.random() * 7 * vh * (0.3 + p.z * 0.7); }
		for (i = 0; i < n; i++) { var p = {}; reset(p, true); drops.push(p); }
		return function (g, t, dt) {
			var j, k, q;
			for (j = 0; j < drops.length; j++) {
				q = drops[j]; q.y += q.v * dt; q.x -= q.v * slant * dt;
				if (q.y > q.end) { if (rings.length < 90) { rings.push({ x: q.x, y: q.end, a: 0.8, r: 0.3 * vh, z: q.z }); } reset(q, false); }
			}
			g.lineCap = "round";
			for (k = 0; k < 3; k++) {
				g.strokeStyle = "rgba(214,232,255," + [0.3, 0.45, 0.62][k] + ")"; g.lineWidth = Math.max(1, [0.1, 0.14, 0.2][k] * vh * c.size); g.beginPath();
				for (j = 0; j < drops.length; j++) { q = drops[j]; if (Math.min(2, Math.floor(q.z * 3)) === k) { g.moveTo(q.x, q.y); g.lineTo(q.x + q.len * slant, q.y - q.len); } }
				g.stroke();
			}
			for (j = rings.length - 1; j >= 0; j--) {
				q = rings[j]; q.r += (5 + q.z * 5) * vh * dt; q.a -= dt * 1.5;
				if (q.a <= 0) { rings.splice(j, 1); continue; }
				g.strokeStyle = "rgba(225,240,255," + (q.a * 0.75).toFixed(2) + ")"; g.lineWidth = Math.max(1, 0.12 * vh);
				g.beginPath(); g.ellipse(q.x, q.y, q.r, q.r * 0.3, 0, 0, TAU); g.stroke();
				if (q.a > 0.5) { var up = (0.8 - q.a) * 6 * vh; g.fillStyle = "rgba(235,245,255," + q.a.toFixed(2) + ")"; g.beginPath(); g.arc(q.x - q.r * 0.7, q.y - up, 0.14 * vh * c.size, 0, TAU); g.arc(q.x + q.r * 0.7, q.y - up * 0.8, 0.14 * vh * c.size, 0, TAU); g.fill(); }
			}
		};
	};

	FX.bunting = function (W, H, c) {
		var vh = H / 100, n = Math.max(4, Math.round(16 * c.amount)), main = hexOr(c.color, ""), pal = main ? [main, "#ffffff", shade(main, 0.75), "#fff3b0"] : ["#e63946", "#ffd23f", "#2a9df4", "#40c057", "#ff8fab", "#ff922b"];
		var pins = 2, top = 1 * vh, sag = 7.5 * vh * Math.sqrt(c.size), fw = Math.min(W / n * 0.84, 10 * vh * c.size), fh = fw * 1.22;
		function wy(px) { var f = (px / W * pins) % 1; return top + sag * 4 * f * (1 - f); }
		function slope(px) { var f = (px / W * pins) % 1; return sag * 4 * (1 - 2 * f) * pins / W; }
		return function (g, t) {
			var i;
			g.lineCap = "round"; g.lineJoin = "round";
			[["rgba(30,20,10,.45)", 0.36], ["#f6f1e7", 0.18]].forEach(function (st) { g.strokeStyle = st[0]; g.lineWidth = Math.max(1, st[1] * vh); swag(g, W, pins, top, sag); });
			for (i = 0; i < n; i++) {
				var x = (i + 0.5) / n * W, tip = Math.sin(t * 2.4 + i * 1.3) * fw * 0.12, col = pal[i % pal.length];
				g.save(); g.translate(x, wy(x)); g.rotate(Math.atan(slope(x)) + Math.sin(t * 1.9 + i * 0.9) * 0.06);
				g.fillStyle = col; g.beginPath(); g.moveTo(-fw / 2, -0.2 * vh); g.lineTo(fw / 2, -0.2 * vh); g.quadraticCurveTo(fw * 0.22 + tip * 0.6, fh * 0.5, tip, fh); g.quadraticCurveTo(-fw * 0.22 + tip * 0.6, fh * 0.5, -fw / 2, -0.2 * vh); g.fill();
				g.fillStyle = "rgba(0,0,0,.13)"; g.beginPath(); g.moveTo(fw * 0.05, -0.2 * vh); g.lineTo(fw / 2, -0.2 * vh); g.quadraticCurveTo(fw * 0.22 + tip * 0.6, fh * 0.5, tip, fh); g.closePath(); g.fill();
				g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-fw / 2, -0.2 * vh, fw, Math.max(1, fw * 0.05));
				g.restore();
			}
		};
	};

	// Fern-like ice crystals creeping in from a corner.
	function frostFern(g, x, y, ang, len, w, depth, R) {
		var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, n = Math.max(3, Math.round(len / (w * 13))), i;
		g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
		if (depth <= 0) { return; }
		for (i = 1; i <= n; i++) {
			var k = i / (n + 0.6), bx = x + (x2 - x) * k, by = y + (y2 - y) * k, bl = len * (0.36 - k * 0.24) * (0.7 + R() * 0.6);
			frostFern(g, bx, by, ang + 1.02 + (R() - 0.5) * 0.2, bl, w * 0.62, depth - 1, R); frostFern(g, bx, by, ang - 1.02 + (R() - 0.5) * 0.2, bl, w * 0.62, depth - 1, R);
		}
	}
	FX.frost = function (W, H, c, ctx, d) {
		var vh = H / 100, S = Math.min(46 * vh * c.size, W * 0.48), layers = [], glints = [], grow = ctx && ctx.preview ? 2.5 : 6;
		cornersOf(c.where).forEach(function (k) {
			var L = A.layer(S, S, d), b = L.b, R = SSO.seeded("frost" + k), i, gr = b.createRadialGradient(0, 0, 0, 0, 0, S * 0.9);
			gr.addColorStop(0, "rgba(236,246,255,.34)"); gr.addColorStop(0.45, "rgba(226,240,255,.13)"); gr.addColorStop(1, "rgba(226,240,255,0)");
			b.fillStyle = gr; b.fillRect(0, 0, S, S);
			b.strokeStyle = "rgba(244,250,255,.8)"; b.lineCap = "round";
			var count = Math.round(5 * Math.min(2, c.amount));
			for (i = 0; i < count; i++) { frostFern(b, R() * S * 0.05, R() * S * 0.05, (i + 0.3 + R() * 0.4) / count * Math.PI / 2, S * (0.5 + R() * 0.34), Math.max(0.8, S * 0.0042), 2 + (i % 2), R); }
			for (i = 0; i < 9; i++) { var along = i % 2, p = R() * S * 0.9; frostFern(b, along ? p : 0, along ? 0 : p, (along ? Math.PI / 2 : 0) + (R() - 0.5) * 0.9, S * (0.07 + R() * 0.1) * (1 - p / S * 0.6), Math.max(1, S * 0.004), 2, R); }
			layers.push({ k: k, cv: L.cv });
			for (i = 0; i < 9; i++) { var a = R() * Math.PI / 2, rr = S * (0.12 + R() * 0.6); glints.push({ k: k, x: Math.cos(a) * rr, y: Math.sin(a) * rr, ph: R() * 9, len: 2 + R() * 3 }); }
		});
		return function (g, t) {
			var reveal = ease(Math.min(1, t / grow));
			layers.forEach(function (L) {
				inCorner(g, W, H, L.k, function () {
					if (reveal < 1) { g.beginPath(); g.arc(0, 0, S * 1.42 * reveal, 0, TAU); g.clip(); }
					g.drawImage(L.cv, 0, 0, S, S);
				});
			});
			glints.forEach(function (q) {
				var k = ((t + q.ph) % q.len) / q.len, a = Math.sin(k * Math.PI) * reveal;
				if (a < 0.05) { return; }
				inCorner(g, W, H, q.k, function () { g.globalAlpha = a; star(g, q.x, q.y, (0.3 + a * 0.8) * vh * c.size, "#ffffff", t * 0.5); glowAt(g, q.x, q.y, 1.8 * vh * c.size, "200,230,255", a * 0.4); g.globalAlpha = 1; });
			});
		};
	};

	var FX_COLOR = ["butterflies", "hearts", "lanterns", "balloons", "bunting"], FX_CORNER = ["blossom", "maple", "tropical", "frost"];
	SSO.register({
		id: "seasonfx",
		name: "Seasonal effects",
		category: "holidays",
		description: "Transparent seasonal touches to lay over any scene: cherry-blossom branches with falling petals, autumn maple boughs, butterflies, fireflies, summer sun rays with drifting dandelion seeds, tropical leaf corners, floating hearts, shamrocks, paper lanterns, hot-air balloons, rain, party bunting and frosted corners.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "kind", label: "Effect", type: "select", group: "Effect", default: "blossom", options: [["blossom", "Cherry blossom branches & petals"], ["maple", "Autumn maple branches & leaves"], ["butterflies", "Butterflies"], ["fireflies", "Fireflies at dusk"], ["sunrays", "Sun rays & dandelion seeds"], ["tropical", "Tropical leaf corners"], ["hearts", "Floating hearts"], ["shamrocks", "Falling shamrocks"], ["lanterns", "Hanging paper lanterns"], ["balloons", "Hot-air balloons drifting by"], ["rain", "Rain with ripples"], ["bunting", "Party bunting"], ["frost", "Frosted corners"]] },
			{ key: "amount", label: "Amount", type: "range", group: "Effect", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "size", label: "Size", type: "range", group: "Effect", default: 1, min: 0.4, max: 2.5, step: 0.1 },
			{ key: "speed", label: "Speed", type: "range", group: "Effect", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "where", label: "Which corners", type: "select", group: "Effect", default: "top", options: [["top", "Top corners"], ["bottom", "Bottom corners"], ["all", "All four corners"], ["left", "Left side"], ["right", "Right side"], ["tl", "Top left only"], ["tr", "Top right only"]], show: { kind: FX_CORNER } },
			{ key: "sun", label: "Sun position", type: "select", group: "Effect", default: "right", options: [["right", "Top right"], ["left", "Top left"]], show: { kind: "sunrays" } },
			{ key: "color", label: "Main colour (blank = classic)", type: "color", group: "Effect", default: "", show: { kind: FX_COLOR } }
		],
		presets: [
			{ name: "Cherry blossom corners", tags: ["spring", "elegant", "cute"], values: {} },
			{ name: "Butterflies", tags: ["spring", "summer", "cute"], values: { kind: "butterflies" } },
			{ name: "Fireflies at dusk", tags: ["summer", "cozy"], values: { kind: "fireflies" } },
			{ name: "Summer sun rays", tags: ["summer", "cozy"], values: { kind: "sunrays" } },
			{ name: "Tropical corners", tags: ["summer"], values: { kind: "tropical" } },
			{ name: "Floating hearts", tags: ["holiday", "cute"], values: { kind: "hearts" } },
			{ name: "Paper lanterns", tags: ["holiday", "newyear", "elegant"], values: { kind: "lanterns" } },
			{ name: "Hot-air balloons", tags: ["summer", "cute"], values: { kind: "balloons" } },
			{ name: "Falling shamrocks", tags: ["holiday", "spring"], values: { kind: "shamrocks" } },
			{ name: "Spring rain", tags: ["spring", "cozy"], values: { kind: "rain" } },
			{ name: "Party bunting", tags: ["summer", "cute"], values: { kind: "bunting" } },
			{ name: "Autumn maple corners", tags: ["autumn", "cozy"], values: { kind: "maple" } },
			{ name: "Frosted corners", tags: ["winter", "elegant", "christmas"], values: { kind: "frost" } },
			{ name: "Blossoms all around", tags: ["spring", "elegant"], values: { where: "all", amount: 1.3, size: 0.9 } },
			{ name: "Tropical frame", tags: ["summer"], values: { kind: "tropical", where: "all", size: 0.85 } },
			{ name: "Golden lanterns", tags: ["holiday", "elegant", "cozy"], values: { kind: "lanterns", color: "f2a71b", amount: 1.2 } },
			{ name: "Blue morpho butterflies", tags: ["summer", "elegant"], values: { kind: "butterflies", color: "2a9df4", amount: 1.4 } },
			{ name: "Heavy rain", tags: ["autumn", "cozy"], values: { kind: "rain", amount: 2.2, speed: 1.2 } },
			{ name: "Pastel bunting", tags: ["spring", "cute"], values: { kind: "bunting", color: "ff8fab", amount: 1.2 } },
			{ name: "Frosted window", tags: ["winter", "cozy"], values: { kind: "frost", where: "all", amount: 1.4 } }
		],
		render: function (root, c, ctx) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;";
			root.appendChild(host);
			var build = FX[c.kind] || FX.blossom, scene = null;
			A.stage(host, function (g, W, H, t, dt, resized, d) {
				if (resized || !scene) { scene = build(W, H, c, ctx, d); }
				scene(g, t * c.speed, dt * c.speed);
			});
		}
	});
})();
