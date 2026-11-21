/* More styles for the "Webcam frame" template (scenes.js): line effects (marching ants, running light, HUD, sketch),
   materials (glass, gold, film, chalk, foil, marquee bulbs) and seasonal borders (autumn leaves, blossoms, bamboo,
   frost, cobwebs, hearts). Each new style is drawn on one canvas that sits behind the name tag and the cat;
   the original styles and their presets are not touched. Chrome 80 friendly. */
(function () {
	"use strict";
	var def = SSO.get("frame");
	if (!def) { return; }
	var TAU = Math.PI * 2;
	function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

	// ---------------------------------------------------------------- colour
	var probe = document.createElement("canvas").getContext("2d"), rgbCache = {};
	function rgb(col) {
		var key = String(col);
		if (rgbCache[key]) { return rgbCache[key]; }
		probe.fillStyle = "#888888"; probe.fillStyle = key;
		var v = probe.fillStyle, out = [136, 136, 136], m = /^#([0-9a-f]{6})$/i.exec(v);
		if (m) { var n = parseInt(m[1], 16); out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
		else if ((m = /rgba?\(([^)]+)\)/.exec(v))) { var p = m[1].split(","); out = [Math.round(+p[0]), Math.round(+p[1]), Math.round(+p[2])]; }
		return (rgbCache[key] = out);
	}
	// f < 1 darkens, f > 1 lightens toward white.
	function shade(col, f) { return "rgb(" + rgb(col).map(function (v) { return clamp(Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f), 0, 255); }).join(",") + ")"; }
	function alpha(col, a) { return "rgba(" + rgb(col).join(",") + "," + a + ")"; }
	function mix(a, b, k) { var x = rgb(a), y = rgb(b); return "rgb(" + x.map(function (v, i) { return Math.round(v + (y[i] - v) * k); }).join(",") + ")"; }

	// ---------------------------------------------------------------- canvas + loop
	function canvasIn(host) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		host.appendChild(cv);
		cv._fit = function () {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
			if (cv._w === w && cv._h === h) { return false; }
			var d = Math.min(window.devicePixelRatio || 1, 2);
			if (w * h * d * d > 2800000) { d = Math.max(0.5, Math.sqrt(2800000 / (w * h))); }
			cv._w = w; cv._h = h; cv._d = d;
			cv.width = Math.max(2, Math.round(w * d)); cv.height = Math.max(2, Math.round(h * d));
			return true;
		};
		cv._fit();
		return cv;
	}
	function layer(w, h, d) {
		var c = document.createElement("canvas");
		c.width = Math.max(2, Math.round(w * d)); c.height = Math.max(2, Math.round(h * d));
		var b = c.getContext("2d"); b.scale(d, d);
		return { cv: c, b: b };
	}
	function run(host, fn) {
		var alive = true, last = null, t = 0, id = 0;
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			t += SSO.frameDelta(now - last); last = now;
			fn(t);
			if (alive) { id = requestAnimationFrame(frame); }
		}
		id = requestAnimationFrame(frame);
		SSO.onCleanup(host, function () { alive = false; cancelAnimationFrame(id); });
	}
	var glowCache = {};
	function glow(col) {
		if (glowCache[col]) { return glowCache[col]; }
		var c = document.createElement("canvas"); c.width = c.height = 64;
		var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), k = rgb(col).join(",");
		gr.addColorStop(0, "rgba(" + k + ",1)"); gr.addColorStop(0.22, "rgba(" + k + ",.6)"); gr.addColorStop(0.55, "rgba(" + k + ",.18)"); gr.addColorStop(1, "rgba(" + k + ",0)");
		g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
		return (glowCache[col] = c);
	}
	function light(g, x, y, r, col, a) {
		if (a <= 0.01) { return; }
		g.globalAlpha = Math.min(1, a); g.drawImage(glow(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
	}

	// ---------------------------------------------------------------- geometry
	// Rounded rectangle as a sub-path (no beginPath), so two of them make a ring for an even-odd fill.
	function rr(g, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
		g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r); g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
	}
	// The frame outline pulled in by `a` pixels.
	function loop(g, G, a) { g.beginPath(); rr(g, G.x + a, G.y + a, G.w - a * 2, G.h - a * 2, Math.max(0, G.r - a)); }
	// A band between two insets; fill or clip it with "evenodd".
	function ring(g, G, a, b) { g.beginPath(); rr(g, G.x + a, G.y + a, G.w - a * 2, G.h - a * 2, Math.max(0, G.r - a)); rr(g, G.x + b, G.y + b, G.w - b * 2, G.h - b * 2, Math.max(0, G.r - b)); }
	function perLen(G, a) { var w = G.w - a * 2, h = G.h - a * 2, r = clamp(G.r - a, 0, Math.min(w, h) / 2); return 2 * (w + h) - 8 * r + TAU * r; }
	// Points around a rounded rectangle, clockwise from the top-left, each with its outward normal.
	function perimeter(x, y, w, h, r, step) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		var pts = [];
		function line(x0, y0, x1, y1, nx, ny) { var L = Math.abs(x1 - x0) + Math.abs(y1 - y0), n = Math.max(1, Math.round(L / step)); for (var i = 0; i < n; i++) { pts.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, nx: nx, ny: ny }); } }
		function arc(cx, cy, a0) { if (r < 0.5) { return; } var n = Math.max(1, Math.round(r * Math.PI / 2 / step)); for (var i = 0; i < n; i++) { var a = a0 + Math.PI / 2 * i / n; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }); } }
		line(x + r, y, x + w - r, y, 0, -1); arc(x + w - r, y + r, -Math.PI / 2);
		line(x + w, y + r, x + w, y + h - r, 1, 0); arc(x + w - r, y + h - r, 0);
		line(x + w - r, y + h, x + r, y + h, 0, 1); arc(x + r, y + h - r, Math.PI / 2);
		line(x, y + h - r, x, y + r, -1, 0); arc(x + r, y + r, Math.PI);
		pts.len = 2 * (w + h) - 8 * r + TAU * r;
		return pts;
	}
	function midPath(G, a, step) { return perimeter(G.x + a, G.y + a, G.w - a * 2, G.h - a * 2, Math.max(0, G.r - a), step); }
	// Point a fraction k (0..1) of the way round.
	function at(P, k) {
		k = ((k % 1) + 1) % 1;
		var f = k * P.length, i = Math.floor(f) % P.length, j = (i + 1) % P.length, u = f - Math.floor(f), a = P[i], b = P[j];
		return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, nx: a.nx, ny: a.ny };
	}
	// The four corners as [x, y, sx, sy]; sx / sy point into the frame. Pulled in to sit on a rounded corner.
	function corners(G, a) {
		var k = Math.max(0, G.r - a) * 0.293 + a;
		return [[G.x + k, G.y + k, 1, 1], [G.x + G.w - k, G.y + k, -1, 1], [G.x + G.w - k, G.y + G.h - k, -1, -1], [G.x + k, G.y + G.h - k, 1, -1]];
	}

	// ---------------------------------------------------------------- little drawings shared by the seasonal styles
	var MAPLE = "M0 -46 L7 -27 L21 -33 L17 -12 L40 -17 L31 -1 L43 7 L19 12 L23 27 L5 20 L2 44 L-2 44 L-5 20 L-23 27 L-19 12 L-43 7 L-31 -1 L-40 -17 L-17 -12 L-21 -33 L-7 -27 Z";
	var LEAF_COLS = [["#d9480f", "#8a2c0a"], ["#f08c00", "#a34a00"], ["#f5b301", "#b76e00"], ["#c92a2a", "#7a1414"], ["#b5651d", "#6e3a0f"], ["#e8a317", "#a35f00"], ["#a61e4d", "#5c0f2a"]];
	// kind 0 maple, 1 oak, 2 birch. s is half the leaf height.
	function leaf(g, kind, x, y, s, rot, c1, c2) {
		g.save(); g.translate(x, y); g.rotate(rot); g.scale(s / 46, s / 46);
		var gr = g.createLinearGradient(-30, -40, 30, 40); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
		g.fillStyle = gr;
		if (kind === 0) { g.fill(new Path2D(MAPLE)); }
		else if (kind === 1) {
			g.beginPath(); g.moveTo(0, -44);
			for (var k = 0; k <= 12; k++) { var a = -Math.PI / 2 + k / 12 * Math.PI, r = 30 + (k % 2) * 8; g.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 1.3); }
			for (k = 12; k >= 0; k--) { var a2 = -Math.PI / 2 + k / 12 * Math.PI, r2 = 30 + (k % 2) * 8; g.lineTo(-Math.cos(a2) * r2 * 0.72, Math.sin(a2) * r2 * 1.3); }
			g.closePath(); g.fill();
		} else { g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(34, -22, 28, 26, 0, 44); g.bezierCurveTo(-28, 26, -34, -22, 0, -46); g.fill(); }
		g.shadowColor = "transparent";
		g.strokeStyle = "rgba(60,20,5,.4)"; g.lineWidth = 1.8; g.lineCap = "round";
		g.beginPath(); g.moveTo(0, 42); g.lineTo(0, -36); g.moveTo(0, 4); g.lineTo(-26, -12); g.moveTo(0, 4); g.lineTo(26, -12); g.moveTo(0, 18); g.lineTo(-17, 24); g.moveTo(0, 18); g.lineTo(17, 24); g.stroke();
		g.strokeStyle = "rgba(255,235,190,.28)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1.5, 40); g.lineTo(1.5, -34); g.stroke();
		g.strokeStyle = "rgba(80,40,10,.85)"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 42); g.quadraticCurveTo(2, 50, -2, 56); g.stroke();
		g.restore();
	}
	function berry(g, x, y, r, col) {
		var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
		gr.addColorStop(0, shade(col, 1.5)); gr.addColorStop(0.6, col); gr.addColorStop(1, shade(col, 0.55));
		g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.38, r * 0.2, 0, TAU); g.fill();
	}
	function acorn(g, x, y, s, rot) {
		g.save(); g.translate(x, y); g.rotate(rot);
		var gr = g.createLinearGradient(-s * 0.5, 0, s * 0.5, 0); gr.addColorStop(0, "#8a5a2b"); gr.addColorStop(0.4, "#d39a56"); gr.addColorStop(1, "#7a4a22");
		g.fillStyle = gr; g.beginPath(); g.moveTo(-s * 0.42, -s * 0.1); g.bezierCurveTo(-s * 0.46, s * 0.6, -s * 0.12, s * 0.95, 0, s * 1.04); g.bezierCurveTo(s * 0.12, s * 0.95, s * 0.46, s * 0.6, s * 0.42, -s * 0.1); g.closePath(); g.fill();
		g.shadowColor = "transparent";
		g.fillStyle = "#5b3a1e"; g.beginPath(); g.moveTo(-s * 0.52, -s * 0.04); g.bezierCurveTo(-s * 0.52, -s * 0.66, s * 0.52, -s * 0.66, s * 0.52, -s * 0.04); g.quadraticCurveTo(0, s * 0.14, -s * 0.52, -s * 0.04); g.fill();
		g.strokeStyle = "rgba(255,220,170,.28)"; g.lineWidth = Math.max(0.6, s * 0.05);
		for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * s * 0.17 - s * 0.07, -s * 0.42); g.lineTo(i * s * 0.17 + s * 0.07, -s * 0.06); g.stroke(); }
		g.strokeStyle = "#5b3a1e"; g.lineWidth = s * 0.11; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -s * 0.5); g.lineTo(s * 0.07, -s * 0.76); g.stroke();
		g.restore();
	}
	function heartPath(g, x, y, s) {
		g.beginPath(); g.moveTo(x, y + s * 0.92);
		g.bezierCurveTo(x - s * 1.35, y - s * 0.05, x - s * 0.72, y - s * 1.12, x, y - s * 0.42);
		g.bezierCurveTo(x + s * 0.72, y - s * 1.12, x + s * 1.35, y - s * 0.05, x, y + s * 0.92); g.closePath();
	}
	function heartSprite(col) {
		var c = document.createElement("canvas"); c.width = c.height = 96;
		var g = c.getContext("2d"); g.translate(48, 50);
		g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 5; g.shadowOffsetY = 2;
		var gr = g.createRadialGradient(-10, -14, 3, 0, 0, 44); gr.addColorStop(0, shade(col, 1.55)); gr.addColorStop(0.45, col); gr.addColorStop(1, shade(col, 0.62));
		g.fillStyle = gr; heartPath(g, 0, 0, 36); g.fill();
		g.shadowColor = "transparent";
		g.strokeStyle = alpha(shade(col, 0.5), 0.6); g.lineWidth = 1.5; g.stroke();
		g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(-15, -17, 8, 5, -0.7, 0, TAU); g.fill();
		g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(-21, -9, 2.2, 0, TAU); g.fill();
		return c;
	}
	// Five-petal blossom. r is the radius to the petal tips.
	function blossom(g, x, y, r, rot, pale, deep) {
		g.save(); g.translate(x, y); g.rotate(rot);
		for (var i = 0; i < 5; i++) {
			g.rotate(TAU / 5);
			var gr = g.createRadialGradient(0, 0, r * 0.08, 0, -r * 0.5, r * 0.95);
			gr.addColorStop(0, mix(pale, deep, 0.75)); gr.addColorStop(0.35, pale); gr.addColorStop(1, mix(pale, "#ffffff", 0.6));
			g.fillStyle = gr;
			g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(r * 0.62, -r * 0.22, r * 0.66, -r * 0.92, r * 0.13, -r); g.lineTo(0, -r * 0.84); g.lineTo(-r * 0.13, -r);
			g.bezierCurveTo(-r * 0.66, -r * 0.92, -r * 0.62, -r * 0.22, 0, 0); g.fill();
		}
		g.shadowColor = "transparent";
		g.strokeStyle = alpha(deep, 0.85); g.lineWidth = Math.max(0.6, r * 0.045); g.lineCap = "round";
		for (i = 0; i < 7; i++) {
			var a = i / 7 * TAU + 0.3, l = r * (0.3 + (i % 3) * 0.06);
			g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
			g.fillStyle = "#ffd43b"; g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, r * 0.055, 0, TAU); g.fill();
		}
		g.fillStyle = deep; g.beginPath(); g.arc(0, 0, r * 0.1, 0, TAU); g.fill();
		g.restore();
	}
	function bud(g, x, y, r, rot, pale, deep) {
		g.save(); g.translate(x, y); g.rotate(rot);
		g.fillStyle = "#6a8f3a"; g.beginPath(); g.ellipse(0, r * 0.25, r * 0.42, r * 0.5, 0, 0, TAU); g.fill();
		var gr = g.createLinearGradient(0, -r, 0, r * 0.3); gr.addColorStop(0, mix(pale, "#ffffff", 0.3)); gr.addColorStop(1, mix(pale, deep, 0.7));
		g.fillStyle = gr; g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.5, r * 0.3, 0, r * 0.3); g.bezierCurveTo(-r * 0.5, r * 0.3, -r * 0.7, -r * 0.4, 0, -r); g.fill();
		g.restore();
	}
	function smallLeaf(g, x, y, s, rot, c1, c2) {
		g.save(); g.translate(x, y); g.rotate(rot);
		var gr = g.createLinearGradient(-s * 0.4, 0, s * 0.4, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
		g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.55, -s * 0.3, s * 0.4, -s * 0.85, 0, -s); g.bezierCurveTo(-s * 0.4, -s * 0.85, -s * 0.55, -s * 0.3, 0, 0); g.fill();
		g.shadowColor = "transparent";
		g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = Math.max(0.5, s * 0.05); g.beginPath(); g.moveTo(0, -s * 0.08); g.lineTo(0, -s * 0.9); g.stroke();
		g.restore();
	}
	function snowflake(g, x, y, s, rot, col) {
		g.save(); g.translate(x, y); g.rotate(rot);
		g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = Math.max(1, s * 0.11);
		for (var i = 0; i < 6; i++) {
			g.rotate(Math.PI / 3);
			g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s); g.moveTo(0, -s * 0.55); g.lineTo(-s * 0.26, -s * 0.8); g.moveTo(0, -s * 0.55); g.lineTo(s * 0.26, -s * 0.8);
			g.moveTo(0, -s * 0.26); g.lineTo(-s * 0.17, -s * 0.42); g.moveTo(0, -s * 0.26); g.lineTo(s * 0.17, -s * 0.42); g.stroke();
		}
		g.fillStyle = col; g.beginPath(); g.arc(0, 0, s * 0.12, 0, TAU); g.fill();
		g.restore();
	}
	// Four-point glint.
	function glint(g, x, y, s, col, a) {
		if (a <= 0.02) { return; }
		g.save(); g.translate(x, y); g.globalAlpha = Math.min(1, a); g.fillStyle = col;
		g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0); g.quadraticCurveTo(s * 0.12, s * 0.12, 0, s); g.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0); g.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s); g.fill();
		g.restore();
	}
	function pumpkin(g, x, base, r) {
		g.fillStyle = "#3f5f1f"; g.beginPath(); g.moveTo(x - r * 0.1, base - r * 1.35); g.quadraticCurveTo(x - r * 0.05, base - r * 1.8, x + r * 0.22, base - r * 1.82); g.lineTo(x + r * 0.26, base - r * 1.66); g.quadraticCurveTo(x + r * 0.1, base - r * 1.62, x + r * 0.12, base - r * 1.35); g.fill();
		for (var i = -2; i <= 2; i++) {
			var w = i === 0 ? 0.5 : 0.46, gr = g.createRadialGradient(x + i * r * 0.3 - r * 0.15, base - r * 1.0, r * 0.08, x + i * r * 0.3, base - r * 0.72, r * 0.95);
			gr.addColorStop(0, "#ffb347"); gr.addColorStop(0.55, "#f07c12"); gr.addColorStop(1, "#a8440a");
			g.fillStyle = gr; g.beginPath(); g.ellipse(x + i * r * 0.3, base - r * 0.72, r * w, r * 0.72, 0, 0, TAU); g.fill();
		}
	}
	function pumpkinFace(g, x, base, r, col) {
		g.fillStyle = col;
		g.beginPath(); g.moveTo(x - r * 0.48, base - r * 0.9); g.lineTo(x - r * 0.16, base - r * 0.9); g.lineTo(x - r * 0.3, base - r * 1.2); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(x + r * 0.48, base - r * 0.9); g.lineTo(x + r * 0.16, base - r * 0.9); g.lineTo(x + r * 0.3, base - r * 1.2); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(x - r * 0.55, base - r * 0.62); g.quadraticCurveTo(x, base - r * 0.12, x + r * 0.55, base - r * 0.62); g.lineTo(x + r * 0.3, base - r * 0.52); g.lineTo(x + r * 0.15, base - r * 0.66); g.lineTo(x, base - r * 0.5); g.lineTo(x - r * 0.15, base - r * 0.66); g.lineTo(x - r * 0.3, base - r * 0.52); g.closePath(); g.fill();
	}
	// Corner cobweb: spokes fan from (cx, cy) between angles a0 and a1.
	function web(g, cx, cy, R, a0, a1, col) {
		var spokes = 6, rings = 5, i, k, ends = [];
		g.strokeStyle = col; g.lineCap = "round";
		for (i = 0; i <= spokes; i++) {
			var a = a0 + (a1 - a0) * i / spokes, len = R * (0.82 + 0.18 * Math.abs(Math.sin(i * 2.3 + 1)));
			ends.push([a, len]);
			g.lineWidth = 1.1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
		}
		g.lineWidth = 0.9;
		for (k = 1; k <= rings; k++) {
			var f = Math.pow(k / (rings + 0.3), 1.15);
			g.beginPath();
			for (i = 0; i <= spokes; i++) {
				var px = cx + Math.cos(ends[i][0]) * ends[i][1] * f, py = cy + Math.sin(ends[i][0]) * ends[i][1] * f;
				if (i === 0) { g.moveTo(px, py); continue; }
				var am = (ends[i][0] + ends[i - 1][0]) / 2, lm = (ends[i][1] + ends[i - 1][1]) / 2 * f * 0.86;
				g.quadraticCurveTo(cx + Math.cos(am) * lm, cy + Math.sin(am) * lm, px, py);
			}
			g.stroke();
		}
	}
	function spider(g, x, y, s, wig, eye) {
		g.save(); g.translate(x, y);
		g.strokeStyle = "#0e0a14"; g.lineWidth = Math.max(1, s * 0.13); g.lineCap = "round"; g.lineJoin = "round";
		for (var side = -1; side <= 1; side += 2) {
			for (var i = 0; i < 4; i++) {
				var a = -0.9 + i * 0.55 + Math.sin(wig + i * 1.3) * 0.08, kx = side * s * (1.15 + i * 0.08), ky = -s * 0.55 + i * s * 0.32;
				g.beginPath(); g.moveTo(side * s * 0.3, 0); g.lineTo(kx * Math.cos(a * 0.3), ky - s * 0.25); g.lineTo(side * s * (1.6 + (i === 0 || i === 3 ? 0.2 : 0)), ky + s * (0.5 + i * 0.12)); g.stroke();
			}
		}
		var gr = g.createRadialGradient(-s * 0.2, s * 0.5, s * 0.1, 0, s * 0.7, s * 1.0); gr.addColorStop(0, "#3a2d4a"); gr.addColorStop(1, "#0e0a14");
		g.fillStyle = gr; g.beginPath(); g.ellipse(0, s * 0.72, s * 0.72, s * 0.86, 0, 0, TAU); g.fill();
		g.strokeStyle = "rgba(205,180,245,.3)"; g.lineWidth = Math.max(0.8, s * 0.07); g.stroke();
		g.fillStyle = "#17111f"; g.beginPath(); g.arc(0, -s * 0.12, s * 0.46, 0, TAU); g.fill();
		g.fillStyle = eye; g.beginPath(); g.arc(-s * 0.17, -s * 0.22, s * 0.1, 0, TAU); g.arc(s * 0.17, -s * 0.22, s * 0.1, 0, TAU); g.fill();
		g.restore();
	}
	// ws = half the wingspan, flap -1..1.
	function bat(g, x, y, ws, flap, eye) {
		g.save(); g.translate(x, y);
		var lift = flap * ws * 0.42;
		g.fillStyle = "#16101f";
		for (var side = -1; side <= 1; side += 2) {
			g.beginPath(); g.moveTo(0, -ws * 0.1);
			g.quadraticCurveTo(side * ws * 0.45, -ws * 0.5 - lift, side * ws, -ws * 0.2 - lift);
			g.quadraticCurveTo(side * ws * 0.86, ws * 0.02 - lift * 0.7, side * ws * 0.72, ws * 0.2 - lift * 0.6);
			g.quadraticCurveTo(side * ws * 0.6, ws * 0.0 - lift * 0.4, side * ws * 0.46, ws * 0.24 - lift * 0.35);
			g.quadraticCurveTo(side * ws * 0.34, ws * 0.04 - lift * 0.2, side * ws * 0.18, ws * 0.26);
			g.lineTo(0, ws * 0.2); g.closePath(); g.fill();
			g.strokeStyle = "rgba(205,180,245,.32)"; g.lineWidth = Math.max(0.8, ws * 0.035); g.stroke();
		}
		g.beginPath(); g.ellipse(0, ws * 0.04, ws * 0.15, ws * 0.26, 0, 0, TAU); g.fill();
		g.beginPath(); g.moveTo(-ws * 0.13, -ws * 0.14); g.lineTo(-ws * 0.1, -ws * 0.4); g.lineTo(-ws * 0.02, -ws * 0.2); g.lineTo(ws * 0.02, -ws * 0.2); g.lineTo(ws * 0.1, -ws * 0.4); g.lineTo(ws * 0.13, -ws * 0.14); g.fill();
		g.fillStyle = eye; g.beginPath(); g.arc(-ws * 0.055, -ws * 0.1, ws * 0.03, 0, TAU); g.arc(ws * 0.055, -ws * 0.1, ws * 0.03, 0, TAU); g.fill();
		g.restore();
	}
	// Bamboo pole from (0, 0) along +x, th thick; the caller translates and rotates.
	function bamboo(g, len, th, col, R) {
		var gr = g.createLinearGradient(0, -th / 2, 0, th / 2);
		gr.addColorStop(0, shade(col, 0.6)); gr.addColorStop(0.22, shade(col, 1.3)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, 0.55));
		g.fillStyle = gr; g.beginPath(); rr(g, 0, -th / 2, len, th, th * 0.32); g.fill();
		g.shadowColor = "transparent";
		g.strokeStyle = alpha(shade(col, 0.5), 0.3); g.lineWidth = Math.max(0.5, th * 0.035);
		for (var k = 0; k < 4; k++) { var gy = -th * 0.32 + k * th * 0.2 + (R() - 0.5) * th * 0.06; g.beginPath(); g.moveTo(th * 0.3, gy); g.lineTo(len - th * 0.3, gy + (R() - 0.5) * th * 0.05); g.stroke(); }
		var x = th * (1.4 + R() * 1.2);
		while (x < len - th * 1.2) {
			g.fillStyle = shade(col, 0.48); g.beginPath(); rr(g, x - th * 0.07, -th * 0.56, th * 0.14, th * 1.12, th * 0.07); g.fill();
			g.fillStyle = alpha(shade(col, 1.5), 0.7); g.fillRect(x + th * 0.07, -th * 0.42, th * 0.05, th * 0.5);
			g.fillStyle = alpha(shade(col, 0.4), 0.35); g.fillRect(x - th * 0.14, -th * 0.5, th * 0.07, th);
			x += th * (3 + R() * 1.6);
		}
		[0, len].forEach(function (ex) { g.fillStyle = shade(col, 0.42); g.beginPath(); g.ellipse(ex, 0, th * 0.13, th * 0.5, 0, 0, TAU); g.fill(); g.fillStyle = shade(col, 0.8); g.beginPath(); g.ellipse(ex, 0, th * 0.07, th * 0.3, 0, 0, TAU); g.fill(); });
	}
	function lashing(g, x, y, th) {
		g.save(); g.translate(x, y); g.lineCap = "round";
		for (var d = -1; d <= 1; d += 2) {
			for (var k = -1; k <= 1; k++) {
				g.strokeStyle = k === 0 ? "#d8bc86" : "#a8884f"; g.lineWidth = th * 0.14;
				g.beginPath(); g.moveTo(-th * 0.62 + k * th * 0.16, d * (-th * 0.62) ); g.lineTo(th * 0.62 + k * th * 0.16, d * (th * 0.62)); g.stroke();
			}
		}
		g.restore();
	}
	var monsteraCache = {};
	function monstera(size, col) {
		var key = Math.round(size) + col;
		if (monsteraCache[key]) { return monsteraCache[key]; }
		var c = document.createElement("canvas"); c.width = c.height = Math.max(8, Math.round(size));
		var g = c.getContext("2d"), s = c.width;
		g.translate(s / 2, s * 0.5); g.scale(s, s);
		var gr = g.createLinearGradient(-0.4, -0.4, 0.4, 0.5); gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, 0.6));
		g.fillStyle = gr;
		g.beginPath(); g.moveTo(0, -0.34);
		g.bezierCurveTo(0.18, -0.52, 0.5, -0.4, 0.48, -0.02); g.bezierCurveTo(0.47, 0.26, 0.22, 0.42, 0, 0.48);
		g.bezierCurveTo(-0.22, 0.42, -0.47, 0.26, -0.48, -0.02); g.bezierCurveTo(-0.5, -0.4, -0.18, -0.52, 0, -0.34); g.fill();
		// splits and holes
		g.globalCompositeOperation = "destination-out";
		for (var side = -1; side <= 1; side += 2) {
			[[-0.2, 0.22], [-0.03, 0.2], [0.14, 0.17], [0.29, 0.12]].forEach(function (cut) {
				var y = cut[0], inner = 0.15;
				g.beginPath(); g.moveTo(side * 0.6, y - 0.045); g.quadraticCurveTo(side * 0.3, y - 0.03, side * inner, y + 0.03); g.quadraticCurveTo(side * 0.32, y + 0.05, side * 0.6, y + 0.06); g.closePath(); g.fill();
			});
			[[0.1, -0.2, 0.035, 0.05], [0.11, 0.0, 0.03, 0.045], [0.09, 0.18, 0.025, 0.04]].forEach(function (h) { g.beginPath(); g.ellipse(side * h[0], h[1], h[2], h[3], side * 0.3, 0, TAU); g.fill(); });
		}
		g.globalCompositeOperation = "source-atop";
		g.strokeStyle = alpha(shade(col, 1.6), 0.55); g.lineWidth = 0.014; g.lineCap = "round";
		g.beginPath(); g.moveTo(0, -0.34); g.lineTo(0, 0.46); g.stroke();
		g.lineWidth = 0.008;
		for (side = -1; side <= 1; side += 2) { [-0.26, -0.11, 0.05, 0.21, 0.34].forEach(function (y) { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(side * 0.2, y - 0.02, side * 0.44, y - 0.08); g.stroke(); }); }
		g.globalCompositeOperation = "source-over";
		return (monsteraCache[key] = c);
	}
	// Palm frond growing from (x, y) toward angle a, L long.
	function frond(g, x, y, a, L, col, bend) {
		g.save(); g.translate(x, y); g.rotate(a);
		var n = 22, pts = [];
		for (var i = 0; i <= n; i++) { var k = i / n; pts.push([L * k, bend * L * k * k]); }
		for (i = n; i >= 1; i--) {
			var k2 = i / n, p = pts[i], q = pts[i - 1], ta = Math.atan2(p[1] - q[1], p[0] - q[0]), ll = L * 0.36 * Math.pow(Math.sin(Math.PI * Math.min(1, k2 * 0.92 + 0.08)), 0.7);
			for (var side = -1; side <= 1; side += 2) {
				var la = ta + side * (1.25 - k2 * 0.75), ex = p[0] + Math.cos(la) * ll, ey = p[1] + Math.sin(la) * ll + ll * 0.18;
				var gr = g.createLinearGradient(p[0], p[1], ex, ey); gr.addColorStop(0, shade(col, side < 0 ? 1.15 : 0.85)); gr.addColorStop(1, shade(col, side < 0 ? 0.8 : 0.58));
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(p[0], p[1]);
				g.quadraticCurveTo(p[0] + Math.cos(la - side * 0.35) * ll * 0.55, p[1] + Math.sin(la - side * 0.35) * ll * 0.55, ex, ey);
				g.quadraticCurveTo(p[0] + Math.cos(la + side * 0.2) * ll * 0.5, p[1] + Math.sin(la + side * 0.2) * ll * 0.5 + ll * 0.05, q[0], q[1]); g.closePath(); g.fill();
			}
		}
		g.shadowColor = "transparent";
		g.strokeStyle = shade(col, 0.5); g.lineWidth = Math.max(1, L * 0.018); g.lineCap = "round";
		g.beginPath(); g.moveTo(0, 0); pts.forEach(function (p2) { g.lineTo(p2[0], p2[1]); }); g.stroke();
		g.restore();
	}
	function hibiscus(g, x, y, r, rot, col) {
		g.save(); g.translate(x, y); g.rotate(rot);
		for (var i = 0; i < 5; i++) {
			g.rotate(TAU / 5);
			var gr = g.createRadialGradient(0, 0, r * 0.05, 0, -r * 0.5, r);
			gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.3, col); gr.addColorStop(1, shade(col, 1.45));
			g.fillStyle = gr;
			g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(r * 0.75, -r * 0.1, r * 0.85, -r * 0.8, r * 0.3, -r * 0.98); g.quadraticCurveTo(r * 0.1, -r * 0.88, 0, -r); g.quadraticCurveTo(-r * 0.12, -r * 0.9, -r * 0.32, -r * 0.96);
			g.bezierCurveTo(-r * 0.85, -r * 0.8, -r * 0.75, -r * 0.1, 0, 0); g.fill();
			g.strokeStyle = alpha(shade(col, 0.5), 0.35); g.lineWidth = Math.max(0.5, r * 0.02);
			g.beginPath(); g.moveTo(0, -r * 0.1); g.lineTo(0, -r * 0.8); g.moveTo(0, -r * 0.2); g.lineTo(r * 0.25, -r * 0.72); g.moveTo(0, -r * 0.2); g.lineTo(-r * 0.25, -r * 0.72); g.stroke();
		}
		g.shadowColor = "transparent";
		g.strokeStyle = "#ffd43b"; g.lineWidth = Math.max(1, r * 0.07); g.lineCap = "round";
		g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * 0.2, -r * 0.35, r * 0.5, -r * 0.55); g.stroke();
		for (i = 0; i < 5; i++) { g.fillStyle = i % 2 ? "#ffe066" : "#fab005"; g.beginPath(); g.arc(r * 0.5 + Math.cos(i * 1.3) * r * 0.09, -r * 0.55 + Math.sin(i * 1.3) * r * 0.09, r * 0.045, 0, TAU); g.fill(); }
		g.restore();
	}
	// Frost fern: a spine with side branches that keep splitting.
	function fern(g, x, y, a, len, w, depth, R) {
		var bendA = a + (R() - 0.5) * 0.18, x2 = x + Math.cos(bendA) * len, y2 = y + Math.sin(bendA) * len;
		g.lineWidth = Math.max(0.6, w); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
		if (depth <= 0 || len < 5) { return; }
		var n = Math.max(2, Math.round(len / Math.max(9, w * 7)));
		for (var i = 1; i <= n; i++) {
			var k = i / (n + 1), px = x + (x2 - x) * k, py = y + (y2 - y) * k, bl = len * 0.46 * (1 - k * 0.72) * (0.8 + R() * 0.4);
			fern(g, px, py, bendA + 0.96, bl, w * 0.66, depth - 1, R);
			fern(g, px, py, bendA - 0.96, bl, w * 0.66, depth - 1, R);
		}
	}
	// Grainy chalk line through points that carry normals.
	function chalk(g, pts, wd, col, R, a) {
		g.fillStyle = col;
		for (var i = 0; i < pts.length; i++) {
			var p = pts[i];
			for (var k = 0; k < 4; k++) {
				var off = (R() + R() + R() - 1.5) / 1.5 * wd * 0.5, sz = 0.7 + R() * 1.4;
				g.globalAlpha = a * (R() < 0.14 ? 0.12 : 0.3 + R() * 0.65);
				g.fillRect(p.x + p.nx * off + (R() - 0.5) * 1.6 - sz / 2, p.y + p.ny * off + (R() - 0.5) * 1.6 - sz / 2, sz, sz);
			}
		}
		g.globalAlpha = 1;
	}
	// Turns a polyline into evenly spaced points with normals, for chalk().
	function strokePts(poly, step) {
		var out = [];
		for (var i = 1; i < poly.length; i++) {
			var a = poly[i - 1], b = poly[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1, n = Math.max(1, Math.round(L / step));
			for (var k = 0; k < n; k++) { out.push({ x: a[0] + dx * k / n, y: a[1] + dy * k / n, nx: -dy / L, ny: dx / L }); }
		}
		return out;
	}

	// ---------------------------------------------------------------- the styles
	var STYLES = {}, ORDER = [];
	function style(id, label, d) { d.label = label; STYLES[id] = d; ORDER.push(id); }

	style("ants", "Marching ants (animated)", {
		fps: 30,
		build: function (G) { return { per: perLen(G, G.wd / 2) }; },
		frame: function (g, G, st, t) {
			var m = G.wd / 2, n = Math.max(6, Math.round(st.per / (G.wd * 5.2 + 6))), dash = st.per / n / 2;
			g.lineWidth = G.wd; g.lineCap = "butt";
			g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = Math.max(4, G.wd * 0.9);
			g.strokeStyle = G.col2; loop(g, G, m); g.stroke(); g.restore();
			g.setLineDash([dash, dash]); g.lineDashOffset = -t * (G.wd * 3 + 14); g.strokeStyle = G.col; loop(g, G, m); g.stroke(); g.setLineDash([]);
		}
	});

	style("runner", "Running light (animated)", {
		build: function (G) { return { P: midPath(G, G.wd / 2, 3) }; },
		still: function (b, G) {
			var m = G.wd / 2;
			b.save(); b.shadowColor = "rgba(0,0,0,.4)"; b.shadowBlur = Math.max(4, G.wd); b.lineWidth = G.wd; b.strokeStyle = alpha(mix(G.col, "#000000", 0.62), 0.9); loop(b, G, m); b.stroke(); b.restore();
			b.lineWidth = Math.max(1, G.wd * 0.22); b.strokeStyle = alpha(G.col, 0.6); loop(b, G, m); b.stroke();
		},
		frame: function (g, G, st, t) {
			var P = st.P, N = P.length, tail = Math.max(12, Math.round(N * 0.24)), speed = 240 / P.len, hot = mix(G.col, "#ffffff", 0.75);
			function pt(i) { return P[((i % N) + N) % N]; }
			g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "butt";
			for (var k = 0; k < 2; k++) {
				var col = k ? G.col2 : G.col, head = Math.floor(((t * speed + k * 0.5) % 1) * N);
				// Each piece spans two steps, so every point of the tail is covered twice and the joins never show.
				for (var s = tail; s > 0; s--) {
					var f = 1 - s / tail, a = pt(head - s - 1), b = pt(head - s + 1);
					g.strokeStyle = alpha(f > 0.9 ? (k ? mix(col, "#ffffff", 0.75) : hot) : col, f * f * 0.6);
					g.lineWidth = G.wd * (0.3 + 0.7 * f);
					g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
					if (s % 5 === 0) { light(g, b.x, b.y, G.wd * 2.2 + 3, col, f * f * 0.16); }
				}
				var hp = pt(head);
				light(g, hp.x, hp.y, G.wd * 3.6 + 6, col, 0.9); light(g, hp.x, hp.y, G.wd * 1.3 + 2, "#ffffff", 0.9);
			}
			g.restore();
		}
	});

	style("glass", "Frosted glass", {
		fps: 30,
		build: function (G) { return { bw: Math.max(4, G.wd) }; },
		still: function (b, G, st) {
			var bw = st.bw, x1 = G.x + G.w, y1 = G.y + G.h, lw = Math.max(1, bw * 0.12);
			b.save(); b.shadowColor = "rgba(0,0,0,.42)"; b.shadowBlur = bw * 0.9 + 4; b.shadowOffsetY = bw * 0.2 + 1;
			ring(b, G, 0, bw); b.fillStyle = alpha(G.col, 0.25); b.fill("evenodd"); b.restore();
			var gr = b.createLinearGradient(G.x, G.y, x1, y1);
			gr.addColorStop(0, "rgba(255,255,255,.66)"); gr.addColorStop(0.28, alpha(G.col, 0.34)); gr.addColorStop(0.7, alpha(G.col2, 0.34)); gr.addColorStop(1, "rgba(255,255,255,.5)");
			ring(b, G, 0, bw); b.fillStyle = gr; b.fill("evenodd");
			// soft highlight running round the middle of the band
			b.save(); ring(b, G, 0, bw); b.clip("evenodd");
			b.strokeStyle = "rgba(255,255,255,.2)"; b.lineWidth = bw * 0.34; loop(b, G, bw * 0.3); b.stroke();
			b.restore();
			var hl = b.createLinearGradient(G.x, G.y, x1, y1); hl.addColorStop(0, "rgba(255,255,255,.98)"); hl.addColorStop(0.5, "rgba(255,255,255,.3)"); hl.addColorStop(1, "rgba(255,255,255,.7)");
			b.strokeStyle = hl; b.lineWidth = lw; loop(b, G, lw / 2); b.stroke();
			var sh = b.createLinearGradient(G.x, G.y, x1, y1); sh.addColorStop(0, "rgba(0,0,0,.3)"); sh.addColorStop(0.5, "rgba(255,255,255,.25)"); sh.addColorStop(1, "rgba(255,255,255,.85)");
			b.strokeStyle = sh; loop(b, G, bw - lw / 2); b.stroke();
		},
		frame: function (g, G, st, t) {
			var k = (t % 7) / 1.5;
			if (k > 1) { return; }
			var gw = Math.max(50, G.W * 0.12), a = k * (G.W + G.H + gw * 4) - gw * 2;
			g.save(); ring(g, G, 0, st.bw); g.clip("evenodd");
			var gr = g.createLinearGradient(a, 0, a + gw, gw); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, G.W, G.H);
			g.restore();
		}
	});

	// Corner flourish in a unit square scaled by s: the corner is the origin, the scrolls run along +x and +y.
	function scroll(g, s) {
		// A stroke that thins from w0 to w1 along its points, like a pen lifting off the page.
		function taper(pts, w0, w1) {
			for (var i = 1; i < pts.length; i++) {
				var k = i / (pts.length - 1);
				g.lineWidth = s * (w0 + (w1 - w0) * k);
				g.beginPath(); g.moveTo(pts[i - 1][0] * s, pts[i - 1][1] * s); g.lineTo(pts[i][0] * s, pts[i][1] * s); g.stroke();
			}
		}
		function bez(p0, p1, p2, p3, n) {
			var out = [];
			for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
			return out;
		}
		function curl(cx, cy, r0, a0, dir, turns) {
			var out = [], n = 40;
			for (var i = 0; i <= n; i++) { var k = i / n, a = a0 + dir * k * TAU * turns, r = r0 * (1 - k * 0.8); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
			return out;
		}
		function leafAt(x, y, a, len, wid) {
			g.save(); g.translate(x * s, y * s); g.rotate(a);
			g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * s * 0.45, -wid * s, len * s, 0); g.quadraticCurveTo(len * s * 0.45, wid * s, 0, 0); g.fill();
			g.restore();
		}
		for (var m = 0; m < 2; m++) {
			g.save();
			if (m) { g.transform(0, 1, 1, 0, 0, 0); }
			// long scroll that runs along the edge and curls in on itself
			taper(bez([0.12, 0.12], [0.3, 0.02], [0.52, 0.2], [0.74, 0.1], 26), 0.05, 0.03);
			taper(curl(0.769, 0.164, 0.07, -1.997, 1, 1.35), 0.03, 0.009);
			g.beginPath(); g.arc(0.774 * s, 0.168 * s, 0.014 * s, 0, TAU); g.fill();
			// smaller counter-curl tucked underneath
			taper(bez([0.33, 0.085], [0.38, 0.22], [0.5, 0.27], [0.56, 0.21], 18), 0.034, 0.02);
			taper(curl(0.532, 0.182, 0.04, 0.785, -1, 1.2), 0.02, 0.007);
			// leaves and a trail of beads
			leafAt(0.4, 0.068, -0.5, 0.17, 0.04); leafAt(0.6, 0.118, -0.62, 0.15, 0.034); leafAt(0.2, 0.09, 0.95, 0.13, 0.03);
			[[0.9, 0.075, 0.022], [0.97, 0.07, 0.016], [1.03, 0.068, 0.011]].forEach(function (d) { g.beginPath(); g.arc(d[0] * s, d[1] * s, d[2] * s, 0, TAU); g.fill(); });
			g.restore();
		}
		// shell in the corner itself: three petals and a bead
		[0.3, Math.PI / 4, Math.PI / 2 - 0.3].forEach(function (a, i) { leafAt(0.1, 0.1, a, i === 1 ? 0.21 : 0.16, i === 1 ? 0.045 : 0.035); });
		g.beginPath(); g.arc(0.1 * s, 0.1 * s, 0.04 * s, 0, TAU); g.fill();
		g.beginPath(); g.arc(0.275 * s, 0.275 * s, 0.018 * s, 0, TAU); g.fill();
	}
	style("ornate", "Ornate gold", {
		still: function (b, G) {
			var wd = Math.max(5, G.wd), lw1 = wd * 0.5, lw2 = Math.max(1.2, wd * 0.14), s = clamp(Math.min(G.w, G.h) * 0.3, wd * 5, wd * 12);
			var metal = b.createLinearGradient(G.x, G.y, G.x + G.w, G.y + G.h);
			[[0, 1.5], [0.16, 0.62], [0.34, 1.3], [0.5, 0.78], [0.68, 1.55], [0.84, 0.6], [1, 1.25]].forEach(function (k) { metal.addColorStop(k[0], shade(G.col, k[1])); });
			b.save();
			b.shadowColor = "rgba(0,0,0,.55)"; b.shadowBlur = Math.max(3, wd * 0.5); b.shadowOffsetY = Math.max(1, wd * 0.16);
			b.strokeStyle = metal; b.fillStyle = metal; b.lineCap = "round"; b.lineJoin = "round";
			b.lineWidth = lw1; loop(b, G, lw1 / 2); b.stroke();
			b.lineWidth = lw2; loop(b, G, wd * 0.98); b.stroke();
			corners(G, lw1 / 2).forEach(function (k) { b.save(); b.translate(k[0], k[1]); b.scale(k[2], k[3]); scroll(b, s); b.restore(); });
			// little diamonds half way along each side
			var d = wd * 0.62;
			[[G.x + G.w / 2, G.y + lw1 / 2], [G.x + G.w / 2, G.y + G.h - lw1 / 2], [G.x + lw1 / 2, G.y + G.h / 2], [G.x + G.w - lw1 / 2, G.y + G.h / 2]].forEach(function (p, i) {
				var hz = i < 2;
				b.beginPath(); b.moveTo(p[0] - (hz ? d * 1.5 : d * 0.7), p[1]); b.lineTo(p[0], p[1] - (hz ? d * 0.7 : d * 1.5)); b.lineTo(p[0] + (hz ? d * 1.5 : d * 0.7), p[1]); b.lineTo(p[0], p[1] + (hz ? d * 0.7 : d * 1.5)); b.closePath(); b.fill();
				[-1, 1].forEach(function (sg) { b.beginPath(); b.arc(p[0] + (hz ? sg * d * 2.3 : 0), p[1] + (hz ? 0 : sg * d * 2.3), d * 0.3, 0, TAU); b.fill(); });
			});
			b.restore();
			// a bright hairline along the top-left of the thick line makes it read as metal
			b.strokeStyle = "rgba(255,255,255,.5)"; b.lineWidth = Math.max(0.6, lw1 * 0.16); loop(b, G, lw1 * 0.2); b.stroke();
		}
	});

	style("hud", "HUD scanner (animated)", {
		fps: 30,
		build: function (G) { var m = G.wd / 2; return { per: perLen(G, m), Lc: Math.max(clamp(Math.min(G.w, G.h) * 0.17, 22, 130), Math.max(0, G.r - m) + 12) }; },
		still: function (b, G, st) {
			var wd = G.wd, m = wd / 2, Lc = st.Lc, x0 = G.x + m, y0 = G.y + m, x1 = G.x + G.w - m, y1 = G.y + G.h - m, r = Math.max(0, G.r - m), i;
			b.strokeStyle = alpha(G.col, 0.42); b.lineWidth = Math.max(1, wd * 0.22); loop(b, G, m); b.stroke();
			function brackets(inset, len, rad) {
				var ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset;
				b.beginPath();
				b.moveTo(ax, ay + len); b.arcTo(ax, ay, ax + len, ay, rad); b.lineTo(ax + len, ay);
				b.moveTo(bx - len, ay); b.arcTo(bx, ay, bx, ay + len, rad); b.lineTo(bx, ay + len);
				b.moveTo(bx, by - len); b.arcTo(bx, by, bx - len, by, rad); b.lineTo(bx - len, by);
				b.moveTo(ax + len, by); b.arcTo(ax, by, ax, by - len, rad); b.lineTo(ax, by - len);
				b.stroke();
			}
			b.save(); b.shadowColor = G.col; b.shadowBlur = wd * 1.6 + 3; b.strokeStyle = G.col; b.lineWidth = wd; b.lineCap = "butt"; b.lineJoin = "miter";
			brackets(0, Lc, r); b.restore();
			b.strokeStyle = G.col2; b.lineWidth = Math.max(1, wd * 0.3); brackets(wd * 1.7 + 2, Lc * 0.42, Math.max(0, r - wd * 1.7 - 2));
			// ruler ticks along the top and bottom between the brackets
			b.fillStyle = alpha(G.col, 0.75);
			var tx0 = G.x + Lc + 14, tx1 = G.x + G.w - Lc - 14, pitch = 10, n = Math.floor((tx1 - tx0) / pitch), tw = Math.max(1, wd * 0.22);
			for (i = 0; i <= n; i++) { var tx = tx0 + (tx1 - tx0) * (n ? i / n : 0), tl = (i % 5 === 0 ? 7 : 3.5) + wd * 0.3; b.fillRect(tx - tw / 2, G.y + wd + 2, tw, tl); b.fillRect(tx - tw / 2, G.y + G.h - wd - 2 - tl, tw, tl); }
			// arrows half way up each side, and a tab hanging from the top
			var ts = 5 + wd * 0.9, cy = G.y + G.h / 2;
			b.fillStyle = G.col;
			b.beginPath(); b.moveTo(G.x + wd + 3, cy - ts); b.lineTo(G.x + wd + 3 + ts, cy); b.lineTo(G.x + wd + 3, cy + ts); b.closePath(); b.fill();
			b.beginPath(); b.moveTo(G.x + G.w - wd - 3, cy - ts); b.lineTo(G.x + G.w - wd - 3 - ts, cy); b.lineTo(G.x + G.w - wd - 3, cy + ts); b.closePath(); b.fill();
			var tabW = clamp(G.w * 0.16, 40, 150), tabH = 4 + wd * 0.8, cx = G.x + G.w / 2;
			b.beginPath(); b.moveTo(cx - tabW / 2, G.y); b.lineTo(cx + tabW / 2, G.y); b.lineTo(cx + tabW / 2 - tabH, G.y + tabH + wd * 0.5); b.lineTo(cx - tabW / 2 + tabH, G.y + tabH + wd * 0.5); b.closePath(); b.fill();
		},
		frame: function (g, G, st, t) {
			var wd = G.wd, m = wd / 2, i;
			// a blip that travels round the thin outline
			g.save(); g.shadowColor = G.col2; g.shadowBlur = 8; g.strokeStyle = G.col2; g.lineWidth = Math.max(2, wd * 0.6); g.lineCap = "round";
			g.setLineDash([Math.min(60, st.per * 0.05), st.per]); g.lineDashOffset = -(t * 260) % st.per; loop(g, G, m); g.stroke(); g.restore();
			// a little level meter in the bottom-right corner
			var n = 7, sw = 4 + wd * 0.5, sh = 6 + wd * 0.8, gap = 2, lit = Math.floor(t * 2.5) % (n + 2), bx = G.x + G.w - wd * 1.7 - 2 - st.Lc * 0.42 - n * (sw + gap) - 8, by = G.y + G.h - wd * 1.7 - 2 - sh;
			if (bx > G.x + st.Lc * 0.5) { for (i = 0; i < n; i++) { g.fillStyle = i < lit ? G.col2 : alpha(G.col, 0.28); g.fillRect(bx + i * (sw + gap), by, sw, sh); } }
			// corner pips blink in turn
			corners(G, wd * 3.6 + 6).forEach(function (k, j) { g.fillStyle = Math.floor(t * 2) % 4 === j ? G.col2 : alpha(G.col, 0.5); g.fillRect(k[0] - 2 - wd * 0.2, k[1] - 2 - wd * 0.2, 4 + wd * 0.4, 4 + wd * 0.4); });
		}
	});

	style("comic", "Comic book", {
		still: function (b, G) {
			var wd = Math.max(4, G.wd), o = clamp(wd * 0.9, 4, Math.max(4, G.inset - 1)), R = G.R, i;
			// offset colour block with a halftone fade
			b.save(); b.translate(o, o); ring(b, G, 0, wd); b.fillStyle = G.col; b.fill("evenodd"); b.clip("evenodd");
			b.fillStyle = shade(G.col, 0.6);
			var pitch = Math.max(4, wd * 0.55), row = 0;
			for (var y = G.y - pitch; y < G.y + G.h + pitch; y += pitch * 0.86, row++) {
				for (var x = G.x - pitch + (row % 2) * pitch / 2; x < G.x + G.w + pitch; x += pitch) {
					var k = ((x - G.x) / G.w + (y - G.y) / G.h) / 2, rad = pitch * 0.46 * clamp(0.15 + k * 0.95, 0, 1);
					b.beginPath(); b.arc(x, y, rad, 0, TAU); b.fill();
				}
			}
			b.restore();
			b.save(); b.translate(o, o); b.strokeStyle = "#111111"; b.lineWidth = Math.max(1.5, wd * 0.16); loop(b, G, 0); b.stroke(); loop(b, G, wd); b.stroke(); b.restore();
			// ink, laid down twice slightly off register so the edge is not machine-perfect
			b.strokeStyle = "#111111"; b.lineJoin = "round"; b.lineWidth = wd; loop(b, G, wd / 2); b.stroke();
			b.lineWidth = wd * 0.55;
			b.save(); b.translate(0.9, -0.6); loop(b, G, wd * 0.32); b.stroke(); b.restore();
			b.save(); b.translate(-0.7, 0.8); loop(b, G, wd * 0.7); b.stroke(); b.restore();
			b.strokeStyle = "#ffffff"; b.lineWidth = Math.max(1.5, wd * 0.2); loop(b, G, wd + b.lineWidth / 2); b.stroke();
			// starburst on the top-right corner
			var rb = clamp(wd * 3.3, 20, 72), cx = Math.min(G.x + G.w - wd * 0.5 - Math.max(0, G.r - wd) * 0.29, G.W - rb * 1.14 - o * 0.5), cy = Math.max(G.y + wd * 0.5 + Math.max(0, G.r - wd) * 0.29, rb * 1.14), n = 13;
			b.save(); b.translate(cx, cy); b.rotate(0.2);
			b.beginPath();
			for (i = 0; i < n * 2; i++) { var a = i / (n * 2) * TAU, rad2 = i % 2 ? rb * (0.6 + R() * 0.08) : rb * (0.92 + R() * 0.16); if (i) { b.lineTo(Math.cos(a) * rad2, Math.sin(a) * rad2); } else { b.moveTo(Math.cos(a) * rad2, Math.sin(a) * rad2); } }
			b.closePath();
			b.save(); b.translate(o * 0.5, o * 0.5); b.fillStyle = "#111111"; b.fill(); b.restore();
			b.fillStyle = G.col2; b.fill(); b.strokeStyle = "#111111"; b.lineWidth = Math.max(2, wd * 0.3); b.lineJoin = "miter"; b.stroke();
			b.fillStyle = "#ffffff"; b.strokeStyle = "#111111"; b.lineWidth = Math.max(1.5, wd * 0.22); b.lineJoin = "round";
			b.beginPath(); b.moveTo(-rb * 0.14, -rb * 0.42); b.lineTo(rb * 0.16, -rb * 0.42); b.lineTo(rb * 0.07, rb * 0.1); b.lineTo(-rb * 0.06, rb * 0.1); b.closePath(); b.fill(); b.stroke();
			b.beginPath(); b.arc(0, rb * 0.3, rb * 0.1, 0, TAU); b.fill(); b.stroke();
			b.restore();
		},
		tag: function (tag, c) { tag.style.border = "3px solid #111"; tag.style.borderRadius = "4px"; tag.style.boxShadow = "4px 4px 0 #111"; tag.style.transform = (c.tagpos.split("-")[1] === "center" ? "translateX(-50%) " : "") + "rotate(-2deg)"; }
	});

	style("sketch", "Pencil sketch (animated)", {
		fps: 4, t0: 0,
		build: function (G) { return { P: midPath(G, G.wd / 2, 14) }; },
		frame: function (g, G, st, t) {
			var R = SSO.seeded("sketch" + (Math.floor(t * 4) % 4)), wd = G.wd, m = wd / 2, pass, i;
			g.lineCap = "round"; g.lineJoin = "round";
			g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 3; g.shadowOffsetY = 1;
			for (pass = 0; pass < 3; pass++) {
				g.strokeStyle = alpha(G.col, [0.95, 0.75, 0.55][pass]); g.lineWidth = Math.max(1.2, wd * [0.5, 0.36, 0.26][pass]);
				var off = (pass - 1) * wd * 0.42 + (R() - 0.5) * wd * 0.3, amp = 1 + wd * 0.14;
				if (G.r < 6) {
					var x0 = G.x + m + off, y0 = G.y + m + off, x1 = G.x + G.w - m - off, y1 = G.y + G.h - m - off;
					[[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].forEach(function (s) {
						var dx = s[2] - s[0], dy = s[3] - s[1], L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, ov0 = 3 + R() * (6 + wd), ov1 = 3 + R() * (6 + wd);
						var ax = s[0] - ux * ov0 + (R() - 0.5) * amp, ay = s[1] - uy * ov0 + (R() - 0.5) * amp, bx = s[2] + ux * ov1 + (R() - 0.5) * amp, by = s[3] + uy * ov1 + (R() - 0.5) * amp, bow = (R() - 0.5) * (amp * 2 + L * 0.008);
						g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2 - uy * bow, (ay + by) / 2 + ux * bow, bx, by); g.stroke();
					});
				} else {
					var P = st.P, N = P.length, start = Math.floor(R() * N), p1 = R() * 6, p2 = R() * 6, pts = [];
					for (i = 0; i <= N + 3; i++) { var q = P[(start + i) % N], d = (Math.sin(i * 0.37 + p1) * 0.6 + Math.sin(i * 0.13 + p2) * 0.4) * amp - off; pts.push([q.x + q.nx * d, q.y + q.ny * d]); }
					g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
					for (i = 1; i < pts.length - 1; i++) { g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); }
					g.stroke();
				}
			}
			g.restore();
		}
	});

	style("film", "Film strip", {
		still: function (b, G) {
			var bt = Math.max(16, G.wd * 2.6), sd = Math.max(3, G.wd * 0.7), ro = Math.min(G.r, bt * 0.4), x = G.x, y = G.y, w = G.w, h = G.h, i;
			function shape() { b.beginPath(); rr(b, x, y, w, h, ro); rr(b, x + sd, y + bt, w - sd * 2, h - bt * 2, Math.min(4, ro)); }
			b.save(); b.shadowColor = "rgba(0,0,0,.45)"; b.shadowBlur = 10; b.shadowOffsetY = 3; shape(); b.fillStyle = G.col; b.fill("evenodd"); b.restore();
			b.save(); shape(); b.clip("evenodd");
			[[y, 1], [y + h - bt, -1]].forEach(function (band) {
				var gl = b.createLinearGradient(0, band[0], 0, band[0] + bt);
				gl.addColorStop(0, "rgba(255,255,255," + (band[1] > 0 ? 0.16 : 0) + ")"); gl.addColorStop(0.5, "rgba(255,255,255,.04)"); gl.addColorStop(1, "rgba(0,0,0," + (band[1] > 0 ? 0.18 : 0.3) + ")");
				b.fillStyle = gl; b.fillRect(x, band[0], w, bt);
			});
			b.restore();
			var text = bt >= 26, hw = bt * 0.36, hh = bt * (text ? 0.44 : 0.5), pitch = hw * 2.15, n = Math.max(2, Math.floor((w - ro * 2 - hw * 1.2) / pitch) + 1), start = x + (w - (n - 1) * pitch) / 2;
			var rows = [y + bt * (text ? 0.4 : 0.5), y + h - bt * (text ? 0.4 : 0.5)];
			b.globalCompositeOperation = "destination-out"; b.fillStyle = "#000";
			rows.forEach(function (cy) { for (i = 0; i < n; i++) { b.beginPath(); rr(b, start + i * pitch - hw / 2, cy - hh / 2, hw, hh, hw * 0.24); b.fill(); } });
			b.globalCompositeOperation = "source-over";
			b.strokeStyle = "rgba(255,255,255,.16)"; b.lineWidth = 1;
			rows.forEach(function (cy) { for (i = 0; i < n; i++) { b.beginPath(); rr(b, start + i * pitch - hw / 2 - 0.5, cy - hh / 2 - 0.5, hw + 1, hh + 1, hw * 0.24); b.stroke(); } });
			b.strokeStyle = "rgba(0,0,0,.4)"; b.lineWidth = 1.5; b.beginPath(); rr(b, x + sd, y + bt, w - sd * 2, h - bt * 2, Math.min(4, ro)); b.stroke();
			if (text) {
				// edge print: frame numbers and little arrows, like a real negative
				var fs = Math.round(bt * 0.24); b.fillStyle = G.col2; b.font = "700 " + fs + "px 'Roboto Mono', 'Courier New', monospace"; b.textBaseline = "alphabetic"; b.textAlign = "left";
				for (i = 0; i * 4 < n - 1; i++) {
					var tx = start + i * 4 * pitch + hw, label = (12 + Math.floor(i / 2)) + (i % 2 ? "A" : "");
					[y + bt * 0.92, y + h - bt * 0.72].forEach(function (ty) {
						b.fillText(label, tx, ty);
						var ax = tx + b.measureText(label).width + fs * 0.5; b.beginPath(); b.moveTo(ax, ty - fs * 0.72); b.lineTo(ax + fs * 0.6, ty - fs * 0.36); b.lineTo(ax, ty); b.closePath(); b.fill();
					});
				}
			}
		}
	});

	style("brutal", "Offset shadow (bold)", {
		still: function (b, G) {
			var wd = Math.max(4, G.wd), o = clamp(wd * 1.3, 5, Math.max(5, G.inset - 1)), ol = Math.max(2, wd * 0.26);
			b.lineJoin = "miter";
			function block(col) { ring(b, G, 0, wd); b.fillStyle = col; b.fill("evenodd"); b.strokeStyle = "#111111"; b.lineWidth = ol; loop(b, G, 0); b.stroke(); loop(b, G, wd); b.stroke(); }
			b.save(); b.translate(o, o); block(G.col2); b.restore();
			block(G.col);
			// selection handles, as if the camera were picked in a design tool
			var hs = Math.max(8, wd * 1.5), pts = corners(G, wd / 2).map(function (k) { return [k[0], k[1]]; });
			pts.push([G.x + G.w / 2, G.y + wd / 2], [G.x + G.w / 2, G.y + G.h - wd / 2], [G.x + wd / 2, G.y + G.h / 2], [G.x + G.w - wd / 2, G.y + G.h / 2]);
			pts.forEach(function (p) {
				b.fillStyle = "#111111"; b.fillRect(p[0] - hs / 2 + ol, p[1] - hs / 2 + ol, hs, hs);
				b.fillStyle = "#ffffff"; b.fillRect(p[0] - hs / 2, p[1] - hs / 2, hs, hs);
				b.strokeStyle = "#111111"; b.lineWidth = ol; b.strokeRect(p[0] - hs / 2, p[1] - hs / 2, hs, hs);
			});
		},
		tag: function (tag) { tag.style.border = "2.5px solid #111"; tag.style.borderRadius = "0"; tag.style.boxShadow = "4px 4px 0 #111"; }
	});

	style("ticket", "Postage stamp", {
		still: function (b, G) {
			var bw = Math.max(10, G.wd * 1.8), s = bw * 0.2, L = layer(G.W, G.H, G.d), p = L.b, R = G.R, i, ri = Math.min(G.r, Math.min(G.w, G.h) / 2 - bw);
			function paper() { p.beginPath(); p.rect(G.x, G.y, G.w, G.h); rr(p, G.x + bw, G.y + bw, G.w - bw * 2, G.h - bw * 2, Math.max(0, ri)); }
			paper(); p.fillStyle = G.col; p.fill("evenodd");
			p.save(); paper(); p.clip("evenodd");
			var pg = p.createLinearGradient(G.x, G.y, G.x + G.w, G.y + G.h); pg.addColorStop(0, "rgba(255,255,255,.22)"); pg.addColorStop(1, "rgba(0,0,0,.12)");
			p.fillStyle = pg; p.fillRect(0, 0, G.W, G.H);
			p.fillStyle = "rgba(60,40,20,.1)"; for (i = 0; i < (G.w + G.h) * 0.5; i++) { var e = R() * 4 | 0, px = e < 2 ? G.x + R() * G.w : (e === 2 ? G.x + R() * bw : G.x + G.w - R() * bw), py = e >= 2 ? G.y + R() * G.h : (e === 0 ? G.y + R() * bw : G.y + G.h - R() * bw); p.fillRect(px, py, 1.2, 1.2); }
			p.restore();
			// printed border lines
			p.strokeStyle = G.col2; p.lineWidth = Math.max(1.4, bw * 0.09);
			p.beginPath(); rr(p, G.x + bw * 0.56, G.y + bw * 0.56, G.w - bw * 1.12, G.h - bw * 1.12, Math.max(0, ri + bw * 0.44)); p.stroke();
			p.lineWidth = Math.max(0.8, bw * 0.04); p.beginPath(); rr(p, G.x + bw * 0.74, G.y + bw * 0.74, G.w - bw * 1.48, G.h - bw * 1.48, Math.max(0, ri + bw * 0.26)); p.stroke();
			// perforations
			p.globalCompositeOperation = "destination-out"; p.fillStyle = "#000";
			var nH = Math.max(4, Math.round(G.w / (s * 3.1))), nV = Math.max(4, Math.round(G.h / (s * 3.1)));
			for (i = 0; i <= nH; i++) { p.beginPath(); p.arc(G.x + G.w * i / nH, G.y, s, 0, TAU); p.arc(G.x + G.w * i / nH, G.y + G.h, s, 0, TAU); p.fill(); }
			for (i = 1; i < nV; i++) { p.beginPath(); p.arc(G.x, G.y + G.h * i / nV, s, 0, TAU); p.arc(G.x + G.w, G.y + G.h * i / nV, s, 0, TAU); p.fill(); }
			p.globalCompositeOperation = "source-over";
			b.save(); b.shadowColor = "rgba(0,0,0,.4)"; b.shadowBlur = 8; b.shadowOffsetY = 3; b.drawImage(L.cv, 0, 0, G.W, G.H); b.restore();
			// postmark over the top-right corner
			var rp = clamp(bw * 1.25, 14, 60), cx = G.x + G.w - bw * 1.2, cy = G.y + bw * 1.25, ink = alpha(shade(G.col2, 0.55), 0.62);
			b.save(); b.translate(cx, cy); b.rotate(-0.22); b.strokeStyle = ink; b.fillStyle = ink; b.lineCap = "round";
			b.lineWidth = Math.max(1.2, rp * 0.07); b.beginPath(); b.arc(0, 0, rp, 0, TAU); b.stroke();
			b.lineWidth = Math.max(0.8, rp * 0.04); b.beginPath(); b.arc(0, 0, rp * 0.74, 0, TAU); b.stroke();
			b.beginPath(); for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * TAU / 10, rad = i % 2 ? rp * 0.17 : rp * 0.42; if (i) { b.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } else { b.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } } b.closePath(); b.fill();
			for (i = 0; i < 8; i++) { var da = i / 8 * TAU; b.beginPath(); b.arc(Math.cos(da) * rp * 0.87, Math.sin(da) * rp * 0.87, rp * 0.035, 0, TAU); b.fill(); }
			b.lineWidth = Math.max(1.2, rp * 0.07);
			for (i = -2; i <= 2; i++) {
				b.beginPath();
				for (var k = 0; k <= 30; k++) { var wx = -rp * 1.15 - k / 30 * rp * 3.2, wy = i * rp * 0.3 + Math.sin(k * 0.7) * rp * 0.09; if (k) { b.lineTo(wx, wy); } else { b.moveTo(wx, wy); } }
				b.stroke();
			}
			b.restore();
		}
	});

	var HOLO = ["#ff6ec7", "#ffb86b", "#f3ff7a", "#6bffb8", "#6bc9ff", "#b47bff"];
	style("holo", "Holographic foil (animated)", {
		fps: 30,
		build: function (G) {
			var bw = Math.max(4, G.wd), P = midPath(G, bw / 2, 4), sp = [], n = Math.max(6, Math.round(P.len / 85));
			for (var i = 0; i < n; i++) { var p = at(P, (i + G.R() * 0.6) / n); sp.push([p.x + p.nx * (G.R() - 0.5) * bw * 0.5, p.y + p.ny * (G.R() - 0.5) * bw * 0.5, G.R() * 6]); }
			return { bw: bw, sp: sp };
		},
		still: function (b, G, st) { b.save(); b.shadowColor = "rgba(0,0,0,.4)"; b.shadowBlur = st.bw * 0.6 + 4; b.shadowOffsetY = 2; ring(b, G, 0, st.bw); b.fillStyle = "#ffffff"; b.fill("evenodd"); b.restore(); },
		frame: function (g, G, st, t) {
			var bw = st.bw, span = 380, n = Math.ceil((G.W + G.H) / span) + 2, off = (t * 46) % span, i, j;
			g.save(); ring(g, G, 0, bw); g.clip("evenodd");
			var gr = g.createLinearGradient(-off, 0, -off + n * span / 2, n * span / 2);
			for (i = 0; i < n; i++) { for (j = 0; j < 6; j++) { gr.addColorStop((i + j / 6) / n, HOLO[j]); } }
			gr.addColorStop(1, HOLO[0]);
			g.fillStyle = gr; g.fillRect(0, 0, G.W, G.H);
			g.fillStyle = alpha(G.col, 0.14); g.fillRect(0, 0, G.W, G.H);
			// sheen bands sliding the other way
			var sw = 150, so = (t * 70) % (sw * 2), sg, ns = Math.ceil((G.W + G.H * 0.5) / sw) + 3;
			g.globalCompositeOperation = "lighter";
			for (i = -2; i < ns; i++) {
				var x0 = i * sw * 2 + so;
				sg = g.createLinearGradient(x0, 0, x0 + sw, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.3)"); sg.addColorStop(1, "rgba(255,255,255,0)");
				g.save(); g.transform(1, 0, -0.45, 1, 0, 0); g.fillStyle = sg; g.fillRect(x0, 0, sw, G.H); g.restore();
			}
			g.restore();
			g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = Math.max(1, bw * 0.1); loop(g, G, g.lineWidth / 2); g.stroke();
			g.strokeStyle = "rgba(255,255,255,.7)"; loop(g, G, bw - g.lineWidth / 2); g.stroke();
			st.sp.forEach(function (s) { var a = Math.pow(Math.max(0, Math.sin(t * 2.2 + s[2])), 3); glint(g, s[0], s[1], bw * (0.5 + a * 0.9) + 2, "#ffffff", a); });
		}
	});

	style("chalk", "Chalk", {
		still: function (b, G) {
			var wd = Math.max(2.5, G.wd * 0.75), m = G.wd / 2, R = G.R, i;
			// dusty smudge under the line
			b.strokeStyle = alpha(G.col, 0.07); b.lineWidth = wd * 2.6; loop(b, G, m); b.stroke();
			chalk(b, midPath(G, m, 1.5), wd, G.col, R, 1);
			chalk(b, midPath(G, m + wd * 1.9, 1.7), wd * 0.42, G.col, R, 0.75);
			// doodles: a star in the top-right, a heart in the top-left, a curly underline in the bottom-right
			var u = clamp(wd * 2.6, 9, 30), k = corners(G, m + wd * 1.9 + u * 1.5), star = [];
			for (i = 0; i <= 5; i++) { var a = -Math.PI / 2 + i * TAU * 2 / 5; star.push([k[1][0] + Math.cos(a) * u, k[1][1] + Math.sin(a) * u]); }
			chalk(b, strokePts(star, 1.4), wd * 0.5, G.col, R, 0.95);
			var sq = [], heart = [];
			for (i = 0; i <= 40; i++) { sq.push([k[2][0] + u * 0.7 - i / 40 * u * 3.6, k[2][1] + u * 0.65 + Math.sin(i * 0.7) * u * 0.28 * (1 - i / 60)]); }
			chalk(b, strokePts(sq, 1.4), wd * 0.5, G.col, R, 0.95);
			for (i = 0; i <= 36; i++) { var ha = i / 36 * TAU, hs = u / 15; heart.push([k[0][0] - u * 0.35 + 16 * Math.pow(Math.sin(ha), 3) * hs, k[0][1] - u * 0.35 - (13 * Math.cos(ha) - 5 * Math.cos(2 * ha) - 2 * Math.cos(3 * ha) - Math.cos(4 * ha)) * hs]); }
			chalk(b, strokePts(heart, 1.4), wd * 0.5, G.col, R, 0.95);
		}
	});

	style("marquee", "Marquee bulbs (animated)", {
		fps: 30,
		build: function (G) {
			var bw = Math.max(14, G.wd * 2.2), P = midPath(G, bw / 2, 2), n = Math.max(8, Math.round(P.len / (bw * 1.12) / 3) * 3), bulbs = [], i;
			for (i = 0; i < n; i++) { bulbs.push(at(P, i / n)); }
			function sprite(lit) {
				var c = document.createElement("canvas"); c.width = c.height = 48;
				var g = c.getContext("2d"), gr = g.createRadialGradient(20, 19, 2, 24, 24, 22);
				if (lit) { gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, mix(G.col, "#ffffff", 0.35)); gr.addColorStop(1, shade(G.col, 0.85)); }
				else { gr.addColorStop(0, mix(G.col, "#ffffff", 0.1)); gr.addColorStop(0.5, shade(G.col, 0.5)); gr.addColorStop(1, shade(G.col, 0.28)); }
				g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 22, 0, TAU); g.fill();
				g.fillStyle = "rgba(255,255,255," + (lit ? 0.9 : 0.35) + ")"; g.beginPath(); g.ellipse(17, 16, 6, 4, -0.7, 0, TAU); g.fill();
				return c;
			}
			return { bw: bw, bulbs: bulbs, on: sprite(true), off: sprite(false) };
		},
		still: function (b, G, st) {
			var bw = st.bw, lw = Math.max(1.5, bw * 0.09);
			b.save(); b.shadowColor = "rgba(0,0,0,.5)"; b.shadowBlur = bw * 0.5 + 4; b.shadowOffsetY = 3; ring(b, G, 0, bw); b.fillStyle = G.col2; b.fill("evenodd"); b.restore();
			b.save(); ring(b, G, 0, bw); b.clip("evenodd");
			var gr = b.createLinearGradient(0, G.y, 0, G.y + G.h); gr.addColorStop(0, "rgba(255,255,255,.2)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.3)");
			b.fillStyle = gr; b.fillRect(0, 0, G.W, G.H);
			b.strokeStyle = "rgba(0,0,0,.28)"; b.lineWidth = bw * 0.5; loop(b, G, bw / 2); b.stroke();
			b.restore();
			var gold = b.createLinearGradient(G.x, G.y, G.x + G.w, G.y + G.h); gold.addColorStop(0, "#fff0b8"); gold.addColorStop(0.35, "#c9962e"); gold.addColorStop(0.6, "#f6dc8a"); gold.addColorStop(1, "#a87618");
			b.strokeStyle = gold; b.lineWidth = lw; loop(b, G, lw / 2); b.stroke(); loop(b, G, bw - lw / 2); b.stroke();
			st.bulbs.forEach(function (p) { b.fillStyle = "rgba(0,0,0,.5)"; b.beginPath(); b.arc(p.x, p.y, bw * 0.32, 0, TAU); b.fill(); });
		},
		frame: function (g, G, st, t) {
			var r = st.bw * 0.26, ph = t * 4.5;
			st.bulbs.forEach(function (p, i) {
				var k = (((i - ph) % 3) + 3) % 3, lit = k < 1 ? 1 - k : (k > 2 ? k - 2 : 0);
				lit = lit * lit * (3 - 2 * lit);
				g.drawImage(st.off, p.x - r, p.y - r, r * 2, r * 2);
				if (lit > 0.02) { g.globalAlpha = lit; g.drawImage(st.on, p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1; }
			});
			g.save(); g.globalCompositeOperation = "lighter";
			st.bulbs.forEach(function (p, i) { var k = (((i - ph) % 3) + 3) % 3, lit = k < 1 ? 1 - k : (k > 2 ? k - 2 : 0); light(g, p.x, p.y, st.bw * 1.05, G.col, lit * lit * 0.7); });
			g.restore();
		}
	});

	style("autumn", "Autumn leaves", {
		still: function (b, G) {
			var u = Math.max(8, G.wd), R = G.R, P = midPath(G, u * 0.5, 5), N = P.length, i;
			b.lineCap = "round"; b.lineJoin = "round";
			// two twigs wound round each other
			b.save(); b.shadowColor = "rgba(0,0,0,.4)"; b.shadowBlur = u * 0.3 + 2; b.shadowOffsetY = 1.5;
			[["#4e3018", 0.36, 0], ["#7c5632", 0.24, 2.4]].forEach(function (v) {
				b.strokeStyle = v[0]; b.lineWidth = Math.max(1.6, u * v[1]); b.beginPath();
				for (i = 0; i < N; i++) { var q = P[i], s = Math.sin(i * 0.24 + v[2]) * u * 0.22, px = q.x + q.nx * s, py = q.y + q.ny * s; if (i) { b.lineTo(px, py); } else { b.moveTo(px, py); } }
				b.closePath(); b.stroke();
			});
			b.restore();
			b.shadowColor = "rgba(0,0,0,.38)"; b.shadowBlur = u * 0.28 + 2; b.shadowOffsetY = u * 0.1 + 1;
			function one(x, y, s, rot) { var c = LEAF_COLS[Math.floor(R() * LEAF_COLS.length)], kind = R() < 0.5 ? 0 : (R() < 0.6 ? 1 : 2); leaf(b, kind, x, y, s, rot, c[0], c[1]); }
			// a scatter along the sides
			var stepN = Math.max(3, Math.round(u * 3.4 / 5));
			for (i = Math.floor(R() * stepN); i < N; i += stepN) {
				if (R() < 0.3) { continue; }
				var q2 = P[i], o = (R() - 0.5) * u * 0.9;
				one(q2.x + q2.nx * o, q2.y + q2.ny * o, u * (0.7 + R() * 0.55), Math.atan2(q2.ny, q2.nx) + Math.PI / 2 + (R() - 0.5) * 2.2);
			}
			// clusters on the corners: heavy on the top-left and bottom-right, lighter on the other two
			corners(G, u * 0.5).forEach(function (k, ci) {
				var big = ci % 2 === 0, count = big ? 11 : 5, spread = u * (big ? 3.1 : 2.1), base = Math.atan2(k[3], k[2]);
				for (var n = 0; n < count; n++) {
					var a = base + Math.PI + (R() - 0.5) * 3.6, d = Math.pow(R(), 0.7) * spread, lx = k[0] + Math.cos(a) * d * 0.55 + (R() - 0.5) * spread * 0.9 * (R() < 0.5 ? k[2] : 0) + (R() < 0.5 ? k[2] * R() * spread * 0.9 : 0), ly = k[1] + Math.sin(a) * d * 0.55 + (R() < 0.5 ? k[3] * R() * spread * 0.9 : 0);
					one(lx, ly, u * (big ? 1.05 + R() * 0.75 : 0.85 + R() * 0.5), a + Math.PI / 2 + (R() - 0.5) * 1.2);
				}
				if (big) {
					acorn(b, k[0] + k[2] * u * 1.5, k[1] + k[3] * u * 0.2, u * 0.62, k[2] * 0.5);
					acorn(b, k[0] + k[2] * u * 0.35, k[1] + k[3] * u * 1.55, u * 0.52, -k[2] * 0.9);
				}
				[[0.75, 0.75], [1.15, 0.5], [0.5, 1.2]].forEach(function (bp) { berry(b, k[0] + k[2] * u * bp[0] * (big ? 1 : 0.8), k[1] + k[3] * u * bp[1] * (big ? 1 : 0.8), u * 0.24, "#c0261c"); });
			});
			b.shadowColor = "transparent";
		}
	});

	style("blossom", "Spring blossoms", {
		still: function (b, G) {
			var u = Math.max(8, G.wd), R = G.R, m = u * 0.5, i, pale = G.col, deep = G.col2;
			b.lineCap = "round"; b.lineJoin = "round";
			b.save(); b.shadowColor = "rgba(0,0,0,.3)"; b.shadowBlur = 4; b.shadowOffsetY = 1;
			b.strokeStyle = alpha(pale, 0.95); b.lineWidth = Math.max(1.5, u * 0.2); loop(b, G, m); b.stroke();
			b.restore();
			b.strokeStyle = alpha(pale, 0.5); b.lineWidth = Math.max(0.8, u * 0.07); loop(b, G, m + u * 0.42); b.stroke();
			var flowers = [];
			// A branch from a corner along one side: tapering, slightly wavy, with twigs that end in flowers or buds.
			function branch(x, y, dx, dy, len, inx, iny) {
				var n = Math.max(6, Math.round(len / (u * 0.9))), pts = [], k;
				for (k = 0; k <= n; k++) { var f = k / n, wob = Math.sin(f * 5 + R() * 0.4) * u * 0.28 * f; pts.push([x + dx * len * f + inx * (wob + u * 0.2 * f), y + dy * len * f + iny * (wob + u * 0.2 * f)]); }
				b.save(); b.shadowColor = "rgba(0,0,0,.35)"; b.shadowBlur = 3; b.shadowOffsetY = 1.5;
				for (k = 1; k <= n; k++) { b.strokeStyle = k % 2 ? "#5a3b2a" : "#684634"; b.lineWidth = Math.max(1.2, u * (0.42 - 0.3 * k / n)); b.beginPath(); b.moveTo(pts[k - 1][0], pts[k - 1][1]); b.lineTo(pts[k][0], pts[k][1]); b.stroke(); }
				b.restore();
				for (k = 1; k <= n; k++) {
					if (k % 2 === 0 && k < n) {
						var side = (k / 2) % 2 ? 1 : -1, tl = u * (1.0 + R() * 0.9), ta = Math.atan2(dy, dx) + side * (0.7 + R() * 0.5), tx = pts[k][0] + Math.cos(ta) * tl, ty = pts[k][1] + Math.sin(ta) * tl;
						b.strokeStyle = "#5a3b2a"; b.lineWidth = Math.max(1, u * 0.14); b.beginPath(); b.moveTo(pts[k][0], pts[k][1]); b.quadraticCurveTo(pts[k][0] + Math.cos(ta) * tl * 0.5 + dx * tl * 0.2, pts[k][1] + Math.sin(ta) * tl * 0.5 + dy * tl * 0.2, tx, ty); b.stroke();
						flowers.push([tx, ty, R() < 0.3 ? 0 : 1, ta]);
						if (R() < 0.7) { flowers.push([pts[k][0] + Math.cos(ta + 1.4) * u * 0.5, pts[k][1] + Math.sin(ta + 1.4) * u * 0.5, 2, ta + 1.4]); }
					} else if (R() < 0.55) { flowers.push([pts[k][0] + (R() - 0.5) * u * 0.5, pts[k][1] + (R() - 0.5) * u * 0.5, 1, R() * TAU]); }
				}
				flowers.push([pts[n][0], pts[n][1], 0, Math.atan2(dy, dx)]);
			}
			var k0 = corners(G, m), lw = G.w * 0.42, lh = G.h * 0.46;
			branch(k0[0][0], k0[0][1], 1, 0, lw, 0, 1); branch(k0[0][0], k0[0][1], 0, 1, lh, 1, 0);
			branch(k0[2][0], k0[2][1], -1, 0, lw, 0, -1); branch(k0[2][0], k0[2][1], 0, -1, lh, -1, 0);
			// leaves first, then buds, then open flowers on top
			b.shadowColor = "rgba(0,0,0,.3)"; b.shadowBlur = 3; b.shadowOffsetY = 1.5;
			flowers.forEach(function (f) { if (f[2] === 2) { smallLeaf(b, f[0], f[1], u * (0.8 + R() * 0.4), f[3] + Math.PI / 2, "#8fce5a", "#4f9a3a"); } });
			flowers.forEach(function (f) { if (f[2] === 0) { bud(b, f[0], f[1], u * 0.5, f[3] + Math.PI / 2, pale, deep); } });
			flowers.forEach(function (f) { if (f[2] === 1) { blossom(b, f[0], f[1], u * (0.72 + R() * 0.38), R() * TAU, pale, deep); } });
			[k0[0], k0[2]].forEach(function (k) { blossom(b, k[0] + k[2] * u * 0.2, k[1] + k[3] * u * 0.2, u * 1.25, R() * TAU, pale, deep); blossom(b, k[0] + k[2] * u * 1.5, k[1] - k[3] * u * 0.1, u * 0.85, R() * TAU, pale, deep); blossom(b, k[0] - k[2] * u * 0.1, k[1] + k[3] * u * 1.5, u * 0.9, R() * TAU, pale, deep); });
			// loose petals that have landed on the rest of the line
			var P = midPath(G, m, 6);
			for (i = 0; i < 14; i++) {
				var q = at(P, 0.2 + R() * 0.25 + (i % 2) * 0.5), pr = u * (0.28 + R() * 0.2);
				b.save(); b.translate(q.x + q.nx * (R() - 0.5) * u, q.y + q.ny * (R() - 0.5) * u); b.rotate(R() * TAU);
				b.fillStyle = mix(pale, "#ffffff", 0.35 + R() * 0.3); b.beginPath(); b.moveTo(0, pr); b.bezierCurveTo(pr * 0.9, pr * 0.3, pr * 0.7, -pr, 0.12 * pr, -pr); b.lineTo(0, -pr * 0.75); b.lineTo(-0.12 * pr, -pr); b.bezierCurveTo(-pr * 0.7, -pr, -pr * 0.9, pr * 0.3, 0, pr); b.fill();
				b.restore();
			}
			b.shadowColor = "transparent";
		}
	});

	style("tropical", "Tropical bamboo", {
		still: function (b, G) {
			var th = Math.max(10, G.wd * 1.6), R = G.R, ov = Math.min(th * 0.7, Math.max(2, G.inset - 1)), m = th / 2, x0 = G.x + m, y0 = G.y + m, x1 = G.x + G.w - m, y1 = G.y + G.h - m;
			var green = "#2f9e58", ms = clamp(th * 4.6, 50, 170);
			// leaves tucked behind the top-left corner
			b.save(); b.shadowColor = "rgba(0,0,0,.35)"; b.shadowBlur = 6; b.shadowOffsetY = 3;
			frond(b, x0 + th * 0.2, y0 + th * 0.2, 0.35, ms * 1.15, "#2b8a4b", 0.2);
			frond(b, x0 + th * 0.2, y0 + th * 0.2, 1.15, ms * 1.0, "#37a35c", -0.15);
			frond(b, x1 - th * 0.2, y1 - th * 0.2, Math.PI + 0.3, ms * 1.1, "#2b8a4b", 0.2);
			frond(b, x1 - th * 0.2, y1 - th * 0.2, Math.PI + 1.2, ms * 0.95, "#37a35c", -0.15);
			b.restore();
			b.save(); b.shadowColor = "rgba(0,0,0,.42)"; b.shadowBlur = 6; b.shadowOffsetY = 2.5;
			[[x0, G.y - ov, G.h + ov * 2], [x1, G.y - ov, G.h + ov * 2]].forEach(function (p) { b.save(); b.translate(p[0], p[1]); b.rotate(Math.PI / 2); bamboo(b, p[2], th, G.col, R); b.restore(); });
			[[G.x - ov, y0, G.w + ov * 2], [G.x - ov, y1, G.w + ov * 2]].forEach(function (p) { b.save(); b.translate(p[0], p[1]); bamboo(b, p[2], th, G.col, R); b.restore(); });
			b.shadowBlur = 2; b.shadowOffsetY = 1;
			[[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(function (p) { lashing(b, p[0], p[1], th); });
			b.restore();
			// monstera and flowers over the corners
			b.save(); b.shadowColor = "rgba(0,0,0,.4)"; b.shadowBlur = 7; b.shadowOffsetY = 3;
			[[x0 + ms * 0.2, y0 + ms * 0.22, -0.75, 1], [x0 - ms * 0.02, y0 + ms * 0.62, -1.6, 0.72], [x1 - ms * 0.22, y1 - ms * 0.2, 2.4, 0.9]].forEach(function (p) {
				var s = ms * p[3], img = monstera(s * Math.min(2, G.d || 1), green);
				b.save(); b.translate(p[0], p[1]); b.rotate(p[2]); b.drawImage(img, -s / 2, -s / 2, s, s); b.restore();
			});
			hibiscus(b, x0 + th * 0.5, y0 + th * 0.4, th * 1.5, 0.4, G.col2);
			hibiscus(b, x0 + th * 2.6, y0 - th * 0.05, th * 0.95, 1.6, mix(G.col2, "#ffd43b", 0.55));
			hibiscus(b, x1 - th * 0.5, y1 - th * 0.3, th * 1.3, 2.2, G.col2);
			b.restore();
		}
	});

	style("frost", "Winter frost (animated)", {
		fps: 20,
		build: function (G) {
			var bw = Math.max(5, G.wd), P = midPath(G, bw / 2, 4), sp = [], n = Math.max(8, Math.round(P.len / 60));
			for (var i = 0; i < n; i++) { var p = at(P, (i + G.R() * 0.7) / n); sp.push([p.x - p.nx * G.R() * bw * 2.2, p.y - p.ny * G.R() * bw * 2.2, G.R() * 6]); }
			return { bw: bw, sp: sp };
		},
		still: function (b, G, st) {
			var bw = st.bw, R = G.R, ice = mix(G.col, "#a9d8ff", 0.55), i;
			b.save(); b.shadowColor = alpha("#3d7fc0", 0.45); b.shadowBlur = bw * 0.8 + 4; ring(b, G, 0, bw); b.fillStyle = alpha(ice, 0.4); b.fill("evenodd"); b.restore();
			var gr = b.createLinearGradient(G.x, G.y, G.x + G.w, G.y + G.h);
			gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.35, alpha(ice, 0.72)); gr.addColorStop(0.65, alpha(mix(G.col, "#ffffff", 0.7), 0.9)); gr.addColorStop(1, alpha(ice, 0.8));
			ring(b, G, 0, bw); b.fillStyle = gr; b.fill("evenodd");
			b.strokeStyle = "rgba(255,255,255,.9)"; b.lineWidth = Math.max(1, bw * 0.14); loop(b, G, bw * 0.28); b.stroke();
			b.strokeStyle = alpha("#6ea8dc", 0.6); b.lineWidth = 1.2; loop(b, G, 0.6); b.stroke(); loop(b, G, bw - 0.6); b.stroke();
			// frost growing in from the inner edge
			b.lineCap = "round"; b.strokeStyle = "rgba(255,255,255,.82)";
			var P = midPath(G, bw, 7);
			for (i = 0; i < P.length; i++) {
				if (R() < 0.45) { continue; }
				var q = P[i], l = 3 + R() * R() * bw * 1.5, a = Math.atan2(-q.ny, -q.nx) + (R() - 0.5) * 0.9;
				fern(b, q.x, q.y, a, l, Math.max(0.7, bw * 0.09), l > bw * 0.7 ? 1 : 0, R);
			}
			var Lc = clamp(Math.min(G.w, G.h) * 0.22, bw * 3, bw * 10);
			corners(G, bw * 0.7).forEach(function (k, ci) {
				var s = Lc * (ci % 2 === 0 ? 1 : 0.68), diag = Math.atan2(k[3], k[2]);
				b.strokeStyle = "rgba(255,255,255,.8)";
				fern(b, k[0], k[1], diag, s * 0.9, Math.max(1.1, bw * 0.15), 2, R);
				fern(b, k[0], k[1], Math.atan2(k[3] * 0.2, k[2]), s, Math.max(1, bw * 0.13), 2, R);
				fern(b, k[0], k[1], Math.atan2(k[3], k[2] * 0.2), s * 0.86, Math.max(1, bw * 0.13), 2, R);
			});
			var ks = corners(G, bw * 0.5);
			b.save(); b.shadowColor = alpha("#2d6fb0", 0.6); b.shadowBlur = 4;
			snowflake(b, ks[0][0], ks[0][1], bw * 1.7 + 3, 0.2, "#ffffff"); snowflake(b, ks[2][0], ks[2][1], bw * 1.4 + 3, 0.5, "#ffffff");
			snowflake(b, ks[1][0] - bw * 2.6, ks[1][1], bw * 0.8 + 2, 0.1, "#ffffff"); snowflake(b, ks[3][0], ks[3][1] - bw * 2.8, bw * 0.75 + 2, 0.3, "#ffffff");
			b.restore();
		},
		frame: function (g, G, st, t) {
			g.save(); g.globalCompositeOperation = "lighter";
			st.sp.forEach(function (s) { var a = Math.pow(Math.max(0, Math.sin(t * 1.6 + s[2])), 4); if (a > 0.03) { glint(g, s[0], s[1], st.bw * 0.3 + 1.5 + a * st.bw * 0.45, "#ffffff", a); light(g, s[0], s[1], st.bw * 0.9 + 3, "#cfe8ff", a * 0.45); } });
			g.restore();
		}
	});

	style("webs", "Cobwebs & bats (animated)", {
		fps: 30,
		build: function (G) { var m = Math.min(G.w, G.h); return { u: Math.max(6, G.wd), pr: clamp(m * 0.075, 16, 64), ws: clamp(m * 0.052, 13, 44), ss: clamp(m * 0.024, 6, 17) }; },
		still: function (b, G, st) {
			var u = st.u, lw = Math.max(2, G.wd * 0.6), k = corners(G, lw), big = clamp(Math.min(G.w, G.h) * 0.34, 46, 240), wc = "rgba(236,232,245,.78)";
			b.save(); b.shadowColor = "rgba(0,0,0,.5)"; b.shadowBlur = 6; b.shadowOffsetY = 2;
			b.strokeStyle = "#17111f"; b.lineWidth = lw + 3; loop(b, G, lw / 2); b.stroke(); b.restore();
			b.strokeStyle = G.col; b.lineWidth = lw; loop(b, G, lw / 2); b.stroke();
			b.strokeStyle = alpha(G.col, 0.45); b.lineWidth = Math.max(1, lw * 0.3); loop(b, G, lw + 2.5 + lw * 0.2); b.stroke();
			b.save(); b.shadowColor = "rgba(0,0,0,.5)"; b.shadowBlur = 2;
			web(b, k[0][0], k[0][1], big, 0, Math.PI / 2, wc);
			web(b, k[1][0], k[1][1], big * 0.7, Math.PI / 2, Math.PI, wc);
			web(b, k[3][0], k[3][1], big * 0.42, -Math.PI / 2, 0, wc);
			b.restore();
			// pumpkin sitting in the bottom-right corner
			var pr = st.pr; st.px = k[2][0] - pr * 1.35; st.py = G.y + G.h - lw * 0.5;
			b.save(); b.shadowColor = "rgba(0,0,0,.5)"; b.shadowBlur = 6; b.shadowOffsetY = 2; pumpkin(b, st.px, st.py, pr); b.restore();
			pumpkinFace(b, st.px, st.py, pr, "#3a1500");
		},
		frame: function (g, G, st, t) {
			var u = st.u, lw = Math.max(2, G.wd * 0.6), fl = 0.6 + 0.25 * Math.sin(t * 7.3) + 0.15 * Math.sin(t * 13.1 + 1.3);
			// candle glow in the pumpkin
			g.save(); g.globalCompositeOperation = "lighter"; light(g, st.px, st.py - st.pr * 0.75, st.pr * 1.9, "#ff9a2e", 0.25 + fl * 0.2); g.restore();
			pumpkinFace(g, st.px, st.py, st.pr, "rgba(255,214,90," + (0.7 + fl * 0.3).toFixed(3) + ")");
			// spider letting itself down from the top edge
			var sx = G.x + G.w * 0.7, ss = st.ss, drop = G.h * (0.13 + 0.07 * Math.sin(t * 0.7)) + ss * 2, sy = G.y + lw + drop;
			g.strokeStyle = "rgba(236,232,245,.75)"; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, G.y + lw); g.lineTo(sx, sy - ss * 0.5); g.stroke();
			spider(g, sx, sy, ss, t * 3, G.col2);
			// two bats hovering by the top-right corner, one by the left side
			var ws = st.ws;
			[[G.x + G.w - ws * 2.5, G.y + ws * 1.7, 1, 0], [G.x + G.w - ws * 5.4, G.y + ws * 0.95, 0.72, 1.7], [G.x + ws * 1.5, G.y + G.h * 0.6, 0.8, 3.1]].forEach(function (p) {
				bat(g, p[0] + Math.sin(t * 0.9 + p[3]) * ws * 0.5, p[1] + Math.sin(t * 1.7 + p[3]) * ws * 0.3, ws * p[2], Math.sin(t * 11 + p[3]), G.col2);
			});
		}
	});

	style("hearts", "String of hearts (animated)", {
		fps: 30,
		build: function (G) {
			var u = Math.max(8, G.wd), P = midPath(G, u * 0.5, 3), n = Math.max(8, Math.round(P.len / (u * 1.9) / 2) * 2), items = [], i;
			for (i = 0; i < n; i++) { var p = at(P, i / n); items.push({ x: p.x, y: p.y, s: i % 2 ? u * 0.56 : u * 0.8, c: i % 3, rot: (i % 2 ? 1 : -1) * (0.12 + G.R() * 0.2) }); }
			return { u: u, P: P, items: items, spr: [heartSprite(G.col), heartSprite(G.col2), heartSprite(mix(G.col, "#ffffff", 0.45))] };
		},
		still: function (b, G, st) {
			var u = st.u;
			b.save(); b.shadowColor = "rgba(0,0,0,.35)"; b.shadowBlur = 3; b.shadowOffsetY = 1;
			b.strokeStyle = alpha(mix(G.col, "#ffffff", 0.55), 0.95); b.lineWidth = Math.max(1.2, u * 0.12); loop(b, G, u * 0.5); b.stroke(); b.restore();
		},
		frame: function (g, G, st, t) {
			var u = st.u, n = st.items.length;
			st.items.forEach(function (h, i) {
				var beat = Math.pow(Math.max(0, Math.sin(t * 2.4 - i / n * TAU * 3)), 6), s = h.s * (1 + beat * 0.28);
				g.save(); g.translate(h.x, h.y); g.rotate(h.rot); g.drawImage(st.spr[h.c], -s * 1.33, -s * 1.39, s * 2.66, s * 2.66); g.restore();
			});
			var k = corners(G, u * 0.5), pulse = 1 + 0.07 * Math.sin(t * 2.4);
			[[k[0], -0.35, 1.75, 0], [k[2], 0.3, 1.55, 1]].forEach(function (c) {
				var s = u * c[2] * pulse;
				g.save(); g.translate(c[0][0], c[0][1]); g.rotate(c[1]); g.drawImage(st.spr[c[3]], -s * 1.33, -s * 1.39, s * 2.66, s * 2.66); g.restore();
				var s2 = u * 0.9;
				g.save(); g.translate(c[0][0] + c[0][2] * u * 2.1, c[0][1] - c[0][3] * u * 0.25); g.rotate(-c[1]); g.drawImage(st.spr[2], -s2 * 1.33, -s2 * 1.39, s2 * 2.66, s2 * 2.66); g.restore();
			});
			var tw = Math.pow(Math.max(0, Math.sin(t * 1.9)), 3);
			glint(g, k[0][0] + u * 1.5, k[0][1] + u * 1.6, u * (0.5 + tw * 0.5), "#ffffff", 0.5 + tw * 0.5);
			glint(g, k[2][0] - u * 1.7, k[2][1] - u * 1.5, u * (0.4 + (1 - tw) * 0.4), "#ffffff", 0.5 + (1 - tw) * 0.4);
		}
	});

	// ---------------------------------------------------------------- hook into the frame template
	var ANIMATED = ORDER.filter(function (id) { return !!STYLES[id].frame; });
	def.fields.forEach(function (f) {
		if (f.key === "style") { ORDER.forEach(function (id) { f.options.push([id, STYLES[id].label]); }); }
		if (f.key === "color2") { f.label = "Second colour"; }
	});
	for (var fi = 0; fi < def.fields.length; fi++) {
		if (def.fields[fi].key === "inset") { def.fields.splice(fi + 1, 0, { key: "motion", label: "Animate this style", type: "bool", group: "Style", default: true, show: { style: ANIMATED } }); break; }
	}
	def.presets = def.presets.concat([
		{ name: "Running light", tags: ["cyber", "gaming"], values: { style: "runner", color: "22d3ee", color2: "f472b6", width: 5, radius: 18, tag: "@yourname", tagbg: "0b1020", tagfg: "e6faff", font: "Rajdhani" } },
		{ name: "Frosted glass", tags: ["elegant", "simple", "pro"], values: { style: "glass", color: "ffffff", color2: "9ad5ff", width: 14, radius: 26 } },
		{ name: "Ornate gold", tags: ["elegant"], values: { style: "ornate", color: "d9a441", width: 9, radius: 4, tag: "Your Name", tagpos: "bottom-center", tagbg: "1a1408", tagfg: "f6e2a0", font: "Cinzel", fontsize: 18 } },
		{ name: "HUD scanner", tags: ["cyber", "gaming", "pro"], values: { style: "hud", color: "38f9ff", color2: "ff3ec8", width: 4, radius: 0, tag: "CAM 01", tagpos: "top-left", tagbg: "38f9ff", tagfg: "001018", font: "Share Tech Mono", fontsize: 16 } },
		{ name: "Marquee lights", tags: ["retro", "celebrate", "elegant"], values: { style: "marquee", color: "ffe9a8", color2: "8f1d2c", width: 10, radius: 10, tag: "NOW SHOWING", tagpos: "bottom-center", tagbg: "8f1d2c", tagfg: "ffe9a8", font: "Bungee", fontsize: 16 } },
		{ name: "Comic book", tags: ["punk", "cute", "retro"], values: { style: "comic", color: "ffd400", color2: "ff3b3b", width: 8, radius: 4, inset: 16, tag: "LIVE!", tagbg: "ffffff", tagfg: "111111", font: "Bangers", fontsize: 26 } },
		{ name: "Holographic foil", tags: ["cute", "cyber"], values: { style: "holo", color: "ffffff", width: 10, radius: 24, tag: "✨ live", tagbg: "ffffff", tagfg: "7c3aed", font: "Fredoka" } },
		{ name: "Marching ants", tags: ["simple", "retro"], values: { style: "ants", color: "ffffff", color2: "111111", width: 5, radius: 10 } },
		{ name: "Pencil sketch", tags: ["cute", "cozy", "simple"], values: { style: "sketch", color: "ffffff", width: 5, radius: 0, inset: 18, tag: "hello!", tagbg: "ffffff", tagfg: "222222", font: "Gochi Hand", fontsize: 24 } },
		{ name: "Chalkboard", tags: ["cozy", "cute"], values: { style: "chalk", color: "ffffff", width: 6, radius: 8, tag: "today's stream", tagbg: "2b3a34", tagfg: "ffffff", font: "Caveat", fontsize: 26 } },
		{ name: "Film strip", tags: ["retro", "elegant"], values: { style: "film", color: "16161a", color2: "f59e0b", width: 12, radius: 6 } },
		{ name: "Offset shadow", tags: ["punk", "simple"], values: { style: "brutal", color: "a3e635", color2: "111111", width: 9, radius: 0, inset: 18, tag: "ON AIR", tagbg: "ffffff", tagfg: "111111", font: "Anton", fontsize: 20 } },
		{ name: "Postage stamp", tags: ["cozy", "retro", "cute"], values: { style: "ticket", color: "f6efe0", color2: "b3402a", width: 9, radius: 2, tag: "greetings from chat", tagbg: "b3402a", tagfg: "f6efe0", font: "Special Elite", fontsize: 18 } },
		{ name: "Autumn leaves", tags: ["autumn", "cozy"], values: { style: "autumn", width: 14, radius: 18, inset: 22, tag: "cozy season", tagbg: "7c2d12", tagfg: "ffe8c7", font: "Amatic SC", fontsize: 32 } },
		{ name: "Cherry blossoms", tags: ["spring", "cute", "elegant"], values: { style: "blossom", color: "ffc2dc", color2: "e0457b", width: 13, radius: 20, inset: 20, tag: "hello spring", tagbg: "ffffff", tagfg: "c2255c", font: "Dancing Script", fontsize: 26 } },
		{ name: "Tropical bamboo", tags: ["summer", "cozy"], values: { style: "tropical", color: "d9bf6a", color2: "ff4f79", width: 11, radius: 0, inset: 18, tag: "aloha", tagbg: "0f766e", tagfg: "fef9c3", font: "Pacifico", fontsize: 24 } },
		{ name: "Winter frost", tags: ["winter", "elegant", "cozy"], values: { style: "frost", color: "ffffff", width: 10, radius: 16, tag: "stay warm", tagbg: "e8f4ff", tagfg: "1c4f82", font: "Comfortaa", fontsize: 18 } },
		{ name: "Cobwebs & bats", tags: ["halloween", "spooky"], values: { style: "webs", color: "ff7a18", color2: "b6ff3b", width: 7, radius: 6, tag: "boo!", tagbg: "ff7a18", tagfg: "1a0b00", font: "Creepster", fontsize: 26 } },
		{ name: "String of hearts", tags: ["cute", "holiday"], values: { style: "hearts", color: "ff4d8d", color2: "ff9ec0", width: 12, radius: 24, inset: 20, tag: "love you, chat", tagbg: "ffffff", tagfg: "d6336c", font: "Dancing Script", fontsize: 26 } }
	]);

	function paint(root, c) {
		var S = STYLES[c.style], host = document.createElement("div");
		host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;";
		root.insertBefore(host, root.firstChild);
		var cv = canvasIn(host), g = cv.getContext("2d"), G = null, st = null, lastDraw = -1;
		function build() {
			var W = cv._w, H = cv._h, inset = Math.min(c.inset, Math.min(W, H) * 0.25), w = Math.max(8, W - inset * 2), h = Math.max(8, H - inset * 2);
			G = { W: W, H: H, x: inset, y: inset, w: w, h: h, inset: inset, d: cv._d, r: Math.max(0, Math.min(c.radius, w / 2, h / 2)), wd: Math.max(1, Math.min(c.width, Math.min(w, h) * 0.2)),
				col: SSO.color(c.color, "#ffffff"), col2: SSO.color(c.color2, "#8b5cf6"), R: SSO.seeded("frame2" + c.style) };
			st = (S.build ? S.build(G, c) : null) || {};
			if (S.still) { st.layer = layer(W, H, cv._d); S.still(st.layer.b, G, st, c); }
		}
		function draw(t) {
			g.setTransform(cv._d, 0, 0, cv._d, 0, 0); g.clearRect(0, 0, G.W, G.H);
			if (st.layer) { g.drawImage(st.layer.cv, 0, 0, G.W, G.H); }
			if (S.frame) { S.frame(g, G, st, t, c); }
		}
		if (S.frame && c.motion !== false) {
			run(host, function (t) {
				var fresh = cv._fit() || !G;
				if (fresh) { build(); }
				else if (S.fps && t - lastDraw < 1 / S.fps - 0.004) { return; }
				lastDraw = t; draw(t);
			});
		} else {
			var once = function () { cv._w = 0; cv._fit(); build(); draw(S.t0 == null ? 0.9 : S.t0); };
			once();
			window.addEventListener("resize", once);
			SSO.onCleanup(host, function () { window.removeEventListener("resize", once); });
		}
		if (S.tag) { var tag = root.querySelector(".fr-tag"); if (tag) { S.tag(tag, c); } }
	}
	var original = def.render;
	def.render = function (root, c) {
		var out = original.apply(this, arguments);
		if (STYLES[c.style]) { try { paint(root, c); } catch (e) { console.warn("frame style failed", c.style, e); } }
		return out;
	};
})();
