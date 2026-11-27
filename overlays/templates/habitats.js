/* Habitats pack: animated places with something living or moving in them. Built on fxkit.js. Keep this Chrome 80 friendly and ASCII only.
   Four always-on pictures, each a background engine ("hab-forest", "hab-koi", "hab-lava", "hab-planetrise") so the
   "Starting soon / BRB" screens and the "Animated background" template can use them too, plus one template ("habitats")
   that picks the place, its mood, how much is going on and the colours.
   How they stay cheap: everything that does not change is painted once into a cached canvas (sc.layer, K.bake) and only
   slid, turned or faded afterwards; living things are small pre-rendered sprites (a koi is ten slices of one sprite laid
   along its spine); light that moves is a couple of cached textures sliding over each other. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K || !SSO.register) { return; }
	var TAU = Math.PI * 2, WHITE = [255, 255, 255];

	// ---------------------------------------------------------------- small helpers
	function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
	function rgb(col) { return K.toRgb(col); }
	function mx(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function mul(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
	// one colour lit by another (both 0..255)
	function lit(c, l, f) { f = (f == null ? 1 : f) / 255; return [c[0] * l[0] * f, c[1] * l[1] * f, c[2] * l[2] * f]; }
	function b255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
	function css(c, a) {
		var s = b255(c[0]) + "," + b255(c[1]) + "," + b255(c[2]);
		return a == null ? "rgb(" + s + ")" : "rgba(" + s + "," + (+a).toFixed(3) + ")";
	}
	function toHsl(c) {
		var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo, h = 0, s = 0;
		if (d > 0.0001) {
			s = l > 0.5 ? d / (2 - hi - lo) : d / (hi + lo);
			h = hi === r ? (g - b) / d + (g < b ? 6 : 0) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
			h *= 60;
		}
		return [h, s, l];
	}
	function fromHsl(h, s, l) {
		h = ((h % 360) + 360) % 360; s = K.clamp(s, 0, 1); l = K.clamp(l, 0, 1);
		var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
		if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
		else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
		return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
	}
	// Turns the hue by dh degrees and scales saturation and lightness.
	function tune(c, dh, ks, kl) { var x = toHsl(c); return fromHsl(x[0] + (dh || 0), x[1] * (ks == null ? 1 : ks), x[2] * (kl == null ? 1 : kl)); }

	// Repeatable noise that tiles every px cells across and py cells down (0 = does not tile that way).
	function ihash(x, y, s) {
		var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
		h = Math.imul(h ^ (h >>> 13), 1103515245);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	function tnoise(x, y, px, py, s) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		var x0 = px ? ((xi % px) + px) % px : xi, x1 = px ? (x0 + 1) % px : xi + 1, y0 = py ? ((yi % py) + py) % py : yi, y1 = py ? (y0 + 1) % py : yi + 1;
		var a = ihash(x0, y0, s), b = ihash(x1, y0, s), c = ihash(x0, y1, s), d = ihash(x1, y1, s);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	}
	function tfbm(x, y, px, py, s, oct) {
		var v = 0, a = 0.5, sum = 0, i;
		for (i = 0; i < oct; i++) { v += a * tnoise(x, y, px, py, s + i * 31); sum += a; x *= 2; y *= 2; px *= 2; py *= 2; a *= 0.5; }
		return v / sum;
	}
	// Paints a canvas one pixel at a time: fn(x, y, out) fills out[0..3] with 0..255. For baking only.
	function pixels(w, h, fn) {
		return K.bake(w, h, function (g) {
			if (!g) { return; }
			var img = g.createImageData(w, h), d = img.data, o = [0, 0, 0, 0], x, y, i = 0;
			for (y = 0; y < h; y++) {
				for (x = 0; x < w; x++) { fn(x, y, o); d[i++] = o[0]; d[i++] = o[1]; d[i++] = o[2]; d[i++] = o[3]; }
			}
			g.putImageData(img, 0, 0);
		});
	}
	// The same, a few rows at a time, for pictures too slow to paint in one go: step(ms) works for about that long and
	// says whether the picture is finished (J.done). J.cv is the canvas.
	function pixelJob(w, h, fn) {
		var cv = K.canvas(w, h), g = cv.getContext("2d"), img = g ? g.createImageData(w, 1) : null, o = [0, 0, 0, 0], y = 0, J = { cv: cv, done: !g, step: null };
		J.step = function (ms) {
			var until = performance.now() + ms, d, x, i;
			while (y < h && !J.done) {
				d = img.data;
				for (x = 0, i = 0; x < w; x++) { fn(x, y, o); d[i++] = o[0]; d[i++] = o[1]; d[i++] = o[2]; d[i++] = o[3]; }
				g.putImageData(img, 0, y); y++;
				if (performance.now() >= until) { break; }
			}
			if (y >= h) { J.done = true; }
			return J.done;
		};
		return J;
	}
	// Gives each unfinished job in turn what is left of ms. True once they are all done.
	function work(jobs, ms) {
		var t0 = performance.now(), i;
		for (i = 0; i < jobs.length; i++) {
			if (jobs[i] && !jobs[i].done && !jobs[i].step(Math.max(1, ms - (performance.now() - t0)))) { return false; }
		}
		return true;
	}
	// A soft round patch of one colour: opaque-ish in the middle (a), fading to nothing at the rim.
	function puff(size, c, a, hold) {
		return K.bake(size, size, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
			gr.addColorStop(0, css(c, a)); gr.addColorStop(hold || 0.25, css(c, a * 0.82)); gr.addColorStop(0.62, css(c, a * 0.3)); gr.addColorStop(1, css(c, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// Fine grain over a smooth gradient, so it does not show bands once the stream is compressed.
	var grainTile = null;
	function grain(g, w, h, amount) {
		if (!grainTile) {
			grainTile = pixels(128, 128, function (x, y, o) { o[0] = o[1] = o[2] = Math.random() < 0.5 ? 0 : 255; o[3] = Math.random() * 255; });
		}
		g.save(); g.globalAlpha = amount; g.fillStyle = g.createPattern(grainTile, "repeat"); g.fillRect(0, 0, w, h); g.restore();
	}
	// Scene units to whole canvas pixels, so a cached layer is drawn 1:1.
	function snap(sc, u) { return Math.ceil(u * sc.k - 0.001) / sc.k; }
	// A cached layer that remembers how big it is meant to be in scene units: the kit may give it a smaller bitmap than
	// asked for (it caps each layer), so nothing here works out a drawn size from the bitmap.
	// On a tall or strip-shaped source the canvas has several pixels to a unit while showing only a sliver of the picture,
	// so a layer is never painted finer than 2 pixels to a unit, and a soft one (mist, light) never finer than 1.
	function layer(sc, name, paint, wu, hu, soft) {
		var W = wu || sc.W, H = hu || sc.H, q = Math.min(1, (soft ? 1 : 2) / sc.k), L;
		if (q > 0.97) { L = sc.layer(name, paint, wu, hu); }
		else { L = sc.layer(name, function (g) { g.scale(q, q); paint(g, W, H); }, W * q, H * q); }
		if (!L.wu) { L.wu = W; L.hu = H; }
		return L;
	}
	function put(g, L, k, x, y) { g.drawImage(L, Math.round(x * k) / k, Math.round(y * k) / k, L.wu, L.hu); }
	// Covers the picture with copies of a cached layer shifted by (ox, oy) units, on whole pixels: the cheapest way to
	// keep a full-screen texture moving when the graphics card is not helping.
	function tileOver(sc, g, L, ox, oy) {
		var k = sc.k, wu = L.wu, hu = L.hu, x, y;
		var x0 = Math.round(-(((ox % wu) + wu) % wu) * k) / k, y0 = Math.round(-(((oy % hu) + hu) % hu) * k) / k;
		for (y = y0; y < 1080; y += hu) { for (x = x0; x < sc.W; x += wu) { g.drawImage(L, x, y, wu, hu); } }
	}
	// 0..1 as x runs a..b, eased; b may be below a
	function ss(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
	function wrapPi(a) { while (a > Math.PI) { a -= TAU; } while (a < -Math.PI) { a += TAU; } return a; }
	function settings(o, moods) {
		o = o || {};
		var mood = String(o.mood || "");
		return {
			c1: rgb(o.c1 || "#2a8f86"), c2: rgb(o.c2 || "#ff6a1c"), c3: rgb(o.c3 || "#ffffff"),
			speed: K.clamp(num(o.speed, 1), 0.05, 6), life: K.clamp(num(o.life, 1), 0.2, 2.5), sharp: K.clamp(num(o.quality, 1), 0.3, 1),
			layout: String(o.layout || ""), mood: moods.indexOf(mood) === -1 ? moods[0] : mood
		};
	}
	// A leaf with pointed lobes (a maple, more or less), stem at the bottom, r = its length.
	var LOBES = [[-2.5, 0.36], [-1.72, 0.66], [-0.84, 0.88], [0, 1], [0.84, 0.88], [1.72, 0.66], [2.5, 0.36]];
	function leafPath(g, r) {
		var i, a, l, cy = r * 0.12, b;
		g.beginPath(); g.moveTo(0, r * 0.5);
		for (i = 0; i < LOBES.length; i++) {
			a = LOBES[i][0] - Math.PI / 2; l = LOBES[i][1] * r;
			if (i) { b = (LOBES[i][0] + LOBES[i - 1][0]) / 2 - Math.PI / 2; g.lineTo(Math.cos(b) * r * 0.3, Math.sin(b) * r * 0.3 + cy); }
			g.lineTo(Math.cos(a - 0.27) * l * 0.6, Math.sin(a - 0.27) * l * 0.6 + cy);
			g.lineTo(Math.cos(a) * l, Math.sin(a) * l + cy);
			g.lineTo(Math.cos(a + 0.27) * l * 0.6, Math.sin(a + 0.27) * l * 0.6 + cy);
		}
		g.closePath();
	}
	function leaf(g, x, y, r, rot, fill, vein) {
		g.save(); g.translate(x, y); g.rotate(rot);
		leafPath(g, r); g.fillStyle = fill; g.fill();
		if (vein) {
			g.strokeStyle = vein; g.lineWidth = Math.max(0.6, r * 0.035);
			g.beginPath(); g.moveTo(0, r * 0.62); g.lineTo(0, -r * 0.7);
			g.moveTo(0, r * 0.1); g.lineTo(-r * 0.5, -r * 0.42); g.moveTo(0, r * 0.1); g.lineTo(r * 0.5, -r * 0.42); g.stroke();
		}
		g.restore();
	}

	// ================================================================ 1. koi pond from above
	// Light on the bottom of a pool: rays through a rippled surface, counted where they land. Tiles in both directions.
	function causticJob(seed, n, c) {
		var R = K.seeded("cau" + seed), waves = [], NW = 10, m = Math.round(n * 1.5), per = m * m / (n * n), acc = new Float32Array(n * n), row = 0, i, gx, gy, s, J = { cv: null, done: false, step: null };
		for (i = 0; i < NW; i++) {
			do { gx = Math.round((R() * 2 - 1) * 10); gy = Math.round((R() * 2 - 1) * 10); s = gx * gx + gy * gy; } while (s < 18 || s > 110);
			waves.push([gx * TAU, gy * TAU, R() * TAU, 0.0058 / s]);
		}
		J.step = function (ms) {
			var until = performance.now() + ms, x, u, v, w, q, a, b, t, px, py, xi, yi, fx, fy, x1, y1;
			while (row < m) {
				v = (row + 0.5) / m;
				for (x = 0; x < m; x++) {
					u = (x + 0.5) / m; a = 0; b = 0;
					for (q = 0; q < NW; q++) { w = waves[q]; t = Math.sin(w[0] * u + w[1] * v + w[2]) * w[3]; a += t * w[0]; b += t * w[1]; }
					px = (u + a) * n - 0.5; py = (v + b) * n - 0.5;
					xi = Math.floor(px); yi = Math.floor(py); fx = px - xi; fy = py - yi;
					xi = ((xi % n) + n) % n; yi = ((yi % n) + n) % n; x1 = (xi + 1) % n; y1 = (yi + 1) % n;
					acc[yi * n + xi] += (1 - fx) * (1 - fy); acc[yi * n + x1] += fx * (1 - fy); acc[y1 * n + xi] += (1 - fx) * fy; acc[y1 * n + x1] += fx * fy;
				}
				row++;
				if (performance.now() >= until) { return false; }
			}
			J.cv = pixels(n, n, function (qx, qy, o) {
				var I = acc[qy * n + qx] / per, al = ss(1.05, 3.2, I);
				o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 255 * Math.min(1, al * 1.2 + ss(0.7, 1.5, I) * 0.1);
			});
			J.done = true;
			return true;
		};
		return J;
	}
	// The koi body sprite: nose at the left, ten slices of 24 px with 4 px spare at each end. Top view.
	var KOI_N = 10, KOI_SW = 24, KOI_OV = 4, KOI_H = 96, KOI_BW = KOI_N * KOI_SW, KOI_HALF = 27;
	function koiHalf(u) {
		if (u <= 0 || u > 1.02) { return 0; }
		if (u < 0.3) { return KOI_HALF * Math.pow(Math.sin(u / 0.3 * Math.PI / 2), 0.6); }
		return KOI_HALF * (1 - 0.85 * Math.pow((u - 0.3) / 0.7, 1.25));
	}
	var KOI_KINDS = ["kohaku", "orange", "sanke", "gold", "showa", "asagi", "tancho", "utsuri", "pearl"];
	// P: { white, orange, red, gold, black, blue, light (0..255 x3), dim, deep, deepMix, glow }
	function koiBody(seed, kind, P) {
		var R = K.seeded("koi" + seed), ox = R() * 90, oy = R() * 90, thr = 0.47 + R() * 0.1, thr2 = 0.63 + R() * 0.06, W = KOI_BW + 2 * KOI_OV, y0 = KOI_H / 2, finC;
		var bodyC = kind === "orange" ? P.orange : kind === "gold" ? P.gold : kind === "showa" || kind === "utsuri" ? P.black : kind === "asagi" ? P.blue : P.white;
		finC = P.glow ? mx(P.deep, P.orange, 0.5) : mx(lit(mx(bodyC, P.white, 0.45), P.light), P.deep, P.deepMix);
		var cv = K.bake(W, KOI_H, function (g) {
			// the small paired fins behind the middle, swept back
			var side, xb = KOI_OV + KOI_BW * 0.5, h = koiHalf(0.5);
			for (side = -1; side <= 1; side += 2) {
				g.beginPath(); g.moveTo(xb, y0 + side * (h - 2));
				g.quadraticCurveTo(xb + 16, y0 + side * (h + 13), xb + 37, y0 + side * (h + 9));
				g.quadraticCurveTo(xb + 30, y0 + side * (h + 1), xb + 26, y0 + side * (h - 6));
				g.closePath(); g.fillStyle = css(finC, 0.9); g.fill();
				g.strokeStyle = css(mul(finC, 0.7), 0.5); g.lineWidth = 0.8;
				g.beginPath(); g.moveTo(xb + 4, y0 + side * h); g.lineTo(xb + 30, y0 + side * (h + 9)); g.moveTo(xb + 6, y0 + side * (h - 1)); g.lineTo(xb + 34, y0 + side * (h + 6)); g.stroke();
			}
		});
		var body = pixels(W, KOI_H, function (x, y, o) {
			var u = (x - KOI_OV + 0.5) / KOI_BW, h = koiHalf(u), dy = Math.abs(y + 0.5 - y0), cover = h - dy + 0.5, q, n1, n2, n3, col, lum, m, e, ex, ey, net;
			if (cover <= 0 || h <= 0) { o[3] = 0; return; }
			q = Math.min(1, dy / Math.max(h, 1));
			n1 = K.fbm2(x / 44 + ox, (y - y0) / 30 + oy, 3) / 0.875;
			n2 = K.fbm2(x / 15 + oy, (y - y0) / 13 + ox, 2) / 0.75;
			n3 = K.fbm2(x / 52 + ox + 40, (y - y0) / 34 + oy + 17, 3) / 0.875;
			m = ss(thr - 0.025, thr + 0.025, n1);
			if (P.glow) {
				// a dark fish wearing patches of light
				col = mx(P.deep, P.blue, 0.25 + 0.2 * (1 - q));
				col = mx(col, P.orange, m);
				col = mx(col, P.red, ss(thr2 - 0.03, thr2 + 0.03, n3) * (1 - m * 0.6));
				col = mx(col, WHITE, 0.55 * m * ss(thr + 0.06, thr + 0.2, n1));
			} else if (kind === "kohaku") { col = mx(P.white, P.red, m); }
			else if (kind === "sanke") { col = mx(mx(P.white, P.red, m), P.black, ss(thr2, thr2 + 0.05, n2)); }
			else if (kind === "showa") { col = mx(mx(P.black, P.red, m), P.white, ss(0.56, 0.6, n3) * (1 - m)); }
			else if (kind === "gold") { col = mx(P.gold, P.white, 0.25 * n1 + 0.3 * ss(0.24, 0.02, u)); }
			else if (kind === "orange") { col = mx(mx(P.orange, P.red, 0.5 * n1), P.white, ss(0.72, 1, q) * 0.5 + ss(0.1, 0, u) * 0.6); }
			else if (kind === "tancho") { e = (u - 0.13) / 0.075; ex = dy / 12; col = mx(P.white, P.red, 1 - ss(0.8, 1.05, Math.sqrt(e * e + ex * ex))); }
			else if (kind === "utsuri") { col = mx(P.black, P.gold, ss(0.46, 0.52, n3)); }
			else if (kind === "asagi") { col = mx(mx(P.white, P.blue, 0.3 * n2), P.black, ss(0.5, 0.55, n3)); }
			else { col = mx(P.white, P.gold, 0.16 * n1 + 0.4 * ss(0.24, 0.04, u)); }
			// round it: bright along the back, falling away to the sides
			lum = 1.02 - 0.46 * Math.pow(q, 2.2) + 0.08 * Math.exp(-q * q * 11);
			// scales, from behind the head back, and the wet shine along the spine
			net = Math.sin(x * 0.5 + dy * 0.5) * Math.sin(x * 0.5 - dy * 0.5);
			lum *= 1 + 0.026 * net * ss(0.2, 0.3, u) * (1 - q);
			lum += 0.15 * Math.exp(-q * q * 70) * ss(0.04, 0.12, u) * ss(0.98, 0.7, u) * (0.45 + 0.55 * n2);
			// the fin along the back, seen edge on
			e = ss(0.31, 0.37, u) * ss(0.68, 0.58, u);
			if (e > 0 && dy < 3.2) { lum *= 1 - e * (dy < 1 ? -0.1 : 0.2 * ss(3.2, 1.6, dy)); }
			// the edge of the gill cover
			e = Math.abs(u - 0.2 + q * q * 0.035);
			if (e < 0.008) { lum *= 0.9; }
			if (P.glow) { col = mul(col, lum); }
			else { col = mx(lit(mul(col, lum), P.light), P.deep, P.deepMix); col = mx(col, mul(col, 0.5), ss(0.84, 1, q) * 0.55); }
			// eyes, set wide on the head
			ex = (x + 0.5) - (KOI_OV + KOI_BW * 0.085); ey = dy - koiHalf(0.085) * 0.82; e = Math.sqrt(ex * ex + ey * ey);
			if (e < 3.6) { col = mx(col, P.glow ? WHITE : [18, 18, 24], ss(3.6, 2.4, e)); }
			o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = 255 * Math.min(1, cover);
		});
		cv.getContext("2d").drawImage(body, 0, 0);
		cv.fin = finC; cv.tailC = P.glow ? P.orange : mx(lit(mx(bodyC, kind === "showa" || kind === "utsuri" ? P.red : P.white, 0.4), P.light), P.deep, P.deepMix);
		return cv;
	}
	// The tail fin, root at the left middle; it swings from there.
	function koiTail(base, tip, long) {
		return K.bake(128, 132, function (g, w, h) {
			var cy = h / 2, L = 86 + 34 * long, gr = g.createLinearGradient(0, 0, L, 0), i, a;
			gr.addColorStop(0, css(base, 0.96)); gr.addColorStop(0.4, css(mx(base, tip, 0.55), 0.84)); gr.addColorStop(1, css(tip, 0.4));
			g.beginPath(); g.moveTo(3, cy - 4.5);
			g.bezierCurveTo(L * 0.28, cy - 9, L * 0.6, cy - 38, L, cy - 56);
			g.bezierCurveTo(L * 0.94, cy - 28, L * 0.76, cy - 9, L * 0.62, cy);
			g.bezierCurveTo(L * 0.76, cy + 9, L * 0.94, cy + 28, L, cy + 56);
			g.bezierCurveTo(L * 0.6, cy + 38, L * 0.28, cy + 9, 3, cy + 4.5);
			g.closePath(); g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			g.strokeStyle = css(mul(base, 0.6), 0.3); g.lineWidth = 1;
			for (i = -9; i <= 9; i++) { a = i / 9 * 0.62; g.beginPath(); g.moveTo(3, cy); g.lineTo(3 + Math.cos(a) * 140, cy + Math.sin(a) * 140); g.stroke(); }
			g.restore();
		});
	}
	// A side fin, root at the left middle, fanning back.
	function koiFin(base, tip) {
		return K.bake(64, 48, function (g, w, h) {
			var cy = h / 2, gr = g.createLinearGradient(0, 0, w, 0), i, a;
			gr.addColorStop(0, css(base, 0.95)); gr.addColorStop(1, css(tip, 0.5));
			g.beginPath(); g.moveTo(2, cy - 3);
			g.bezierCurveTo(18, cy - 17, 44, cy - 22, 60, cy - 12);
			g.bezierCurveTo(64, cy - 2, 58, cy + 12, 42, cy + 15);
			g.bezierCurveTo(24, cy + 13, 10, cy + 7, 2, cy + 3);
			g.closePath(); g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			g.strokeStyle = css(mul(base, 0.6), 0.35); g.lineWidth = 0.9;
			for (i = -5; i <= 5; i++) { a = i / 5 * 0.5; g.beginPath(); g.moveTo(2, cy); g.lineTo(2 + Math.cos(a) * 70, cy + Math.sin(a) * 70); g.stroke(); }
			g.restore();
		});
	}
	// A lily pad seen from above, lit from the upper left. turn = which way the cut in the leaf faces.
	function padSprite(R, col, light, turn) {
		return K.bake(224, 224, function (g, w) {
			var c = w / 2, r = c - 6, notch = 0.2 + R() * 0.2, ph = R() * TAU, i, a, rr, gr;
			function outline() {
				g.beginPath(); g.moveTo(c, c);
				for (i = 0; i <= 56; i++) {
					a = turn + notch / 2 + (TAU - notch) * i / 56; rr = r * (0.97 + 0.025 * Math.sin(a * 7 + ph) + 0.012 * Math.sin(a * 15 + ph * 2));
					g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
				}
				g.closePath();
			}
			outline();
			gr = g.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.05, c, c, r);
			gr.addColorStop(0, css(mx(lit(col, light), lit(WHITE, light), 0.26))); gr.addColorStop(0.6, css(lit(col, light))); gr.addColorStop(1, css(lit(col, light, 0.66)));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// veins running out from the middle
			g.strokeStyle = css(mx(lit(col, light), lit(WHITE, light), 0.3), 0.55); g.lineWidth = 1.5;
			for (i = 0; i < 17; i++) {
				a = turn + notch / 2 + (TAU - notch) * (i + 0.5) / 17;
				g.beginPath(); g.moveTo(c, c); g.quadraticCurveTo(c + Math.cos(a + 0.09) * r * 0.5, c + Math.sin(a + 0.09) * r * 0.5, c + Math.cos(a) * r, c + Math.sin(a) * r); g.stroke();
			}
			// worn patches
			for (i = 0; i < 5; i++) {
				a = R() * TAU; rr = r * (0.3 + R() * 0.6);
				g.fillStyle = css(lit(mul(col, 0.7), light), 0.25); g.beginPath(); g.ellipse(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 5 + R() * 12, 4 + R() * 8, R() * 3, 0, TAU); g.fill();
			}
			// the far side from the light falls into shade; the near side has a waxy shine
			gr = g.createLinearGradient(c - r * 0.6, c - r * 0.7, c + r * 0.7, c + r * 0.8);
			gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,14,12,0.4)");
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
			gr = g.createRadialGradient(c - r * 0.4, c - r * 0.45, 0, c - r * 0.4, c - r * 0.45, r * 0.62);
			gr.addColorStop(0, css(lit(WHITE, light), 0.26)); gr.addColorStop(1, css(lit(WHITE, light), 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
			// a curled lip all round: dark on the shaded side, lit on the other
			outline(); g.strokeStyle = css(lit(mul(col, 0.42), light), 0.55); g.lineWidth = 7; g.stroke();
			g.translate(-2.2, -2.6); outline(); g.strokeStyle = css(mx(lit(col, light), lit(WHITE, light), 0.5), 0.75); g.lineWidth = 2.4; g.stroke(); g.translate(2.2, 2.6);
			g.restore();
			// a few beads of water
			for (i = 0; i < 3; i++) {
				a = turn + notch + R() * (TAU - notch * 2); rr = r * (0.25 + R() * 0.5);
				g.fillStyle = css(lit(WHITE, light), 0.5); g.beginPath(); g.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 2 + R() * 2.5, 0, TAU); g.fill();
			}
		});
	}
	// A water lily in flower, from above: three rings of pointed petals round a yellow heart.
	function lilySprite(col, light, glow) {
		return K.bake(160, 160, function (g, w) {
			var c = w / 2, ring, i, n, len, wid, a, gr, tip = mx(col, WHITE, 0.72), R = K.seeded("lily" + col.join("."));
			g.translate(c, c);
			for (ring = 0; ring < 3; ring++) {
				n = ring === 0 ? 10 : ring === 1 ? 8 : 6; len = ring === 0 ? 74 : ring === 1 ? 54 : 34; wid = ring === 0 ? 17 : ring === 1 ? 14 : 10;
				for (i = 0; i < n; i++) {
					a = (i + ring * 0.5) / n * TAU + (R() - 0.5) * 0.16;
					g.save(); g.rotate(a);
					gr = g.createLinearGradient(8, 0, len, 0);
					gr.addColorStop(0, css(lit(mul(col, 0.92 + ring * 0.05), light))); gr.addColorStop(0.7, css(lit(mx(col, tip, 0.6 + ring * 0.15), light))); gr.addColorStop(1, css(lit(tip, light)));
					g.fillStyle = "rgba(20,10,30,0.2)";
					g.beginPath(); g.moveTo(4, 3); g.quadraticCurveTo(len * 0.5, wid + 4, len + 2, 3); g.quadraticCurveTo(len * 0.5, -wid + 4, 4, 3); g.fill();
					g.fillStyle = gr;
					g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(len * 0.5, wid, len, 0); g.quadraticCurveTo(len * 0.5, -wid, 2, 0); g.fill();
					g.strokeStyle = css(lit(mul(col, 0.8), light), 0.35); g.lineWidth = 0.9; g.beginPath(); g.moveTo(8, 0); g.lineTo(len * 0.82, 0); g.stroke();
					g.restore();
				}
			}
			gr = g.createRadialGradient(0, 0, 0, 0, 0, 15);
			gr.addColorStop(0, css(lit([255, 236, 120], glow ? WHITE : light))); gr.addColorStop(0.7, css(lit([255, 190, 60], glow ? WHITE : light))); gr.addColorStop(1, css(lit([230, 140, 40], light), 0));
			g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
			for (i = 0; i < 14; i++) { a = i / 14 * TAU; g.fillStyle = css(lit([255, 244, 170], glow ? WHITE : light)); g.beginPath(); g.arc(Math.cos(a) * 8.5, Math.sin(a) * 8.5, 1.7, 0, TAU); g.fill(); }
		});
	}
	// A ripple ring on the surface: a bright crest between two dark troughs.
	function ringSprite(light, dark) {
		return K.bake(192, 192, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
			gr.addColorStop(0, css(light, 0)); gr.addColorStop(0.6, css(light, 0)); gr.addColorStop(0.7, css(dark, 0.26)); gr.addColorStop(0.79, css(light, 0.7));
			gr.addColorStop(0.86, css(light, 0.2)); gr.addColorStop(0.92, css(dark, 0.22)); gr.addColorStop(1, css(dark, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	var KOI_SIZES = [316, 258, 226, 290, 204, 246, 302, 214, 270, 196, 284, 236];
	var KOI_ORDER = [0, 1, 2, 3, 4, 0, 5, 6, 7, 8, 1, 2];
	function startKoi(host, o) {
		var S = settings(o, ["day", "lantern", "rain", "autumn", "night"]), sc = K.scene(host, { fps: 30, quality: S.sharp, maxPixels: 1300000 });
		var mood = S.mood, night = mood === "night", dusk = mood === "lantern", rainy = mood === "rain", fall = mood === "autumn", lay = S.layout;
		var c1 = S.c1, c2 = S.c2, c3 = S.c3, T = Math.random() * 400, T0 = T, i;
		// the light: its colour and strength, and how far it throws a shadow down through the water
		var light = night ? [112, 138, 215] : dusk ? [150, 148, 196] : rainy ? [196, 212, 214] : fall ? [255, 232, 196] : [255, 252, 240];
		var sun = night ? 0.25 : dusk ? 0.3 : rainy ? 0.3 : fall ? 0.9 : 1, cauA = night ? 0.26 : dusk ? 0.2 : rainy ? 0.12 : fall ? 0.5 : 0.58;
		var deepC = lit(mx(mul(c1, night ? 0.36 : dusk ? 0.46 : 0.4), mul(tune(c1, 18, 1, 1), 0.3), 0.4), light), tintC = lit(c1, light);
		var sandA = lit(mx([236, 222, 180], c1, 0.2), light), sandB = lit(mx([172, 176, 150], c1, 0.34), light);
		var SHX = 0.5, SHY = 0.86;
		// where the open, deep water is (the calm part of the picture) and where the lily pads gather
		var deepU = 0.57, deepV = 0.5, deepRU = 0.4, deepRV = 0.46, clusters = [[0.85, 0.2, 5, 0.17], [0.12, 0.82, 4, 0.15], [0.55, 0.96, 1, 0.04]], corner = 0;
		if (lay === "center") { deepU = 0.5; deepV = 0.5; deepRU = 0.36; deepRV = 0.4; clusters = [[0.88, 0.16, 4, 0.15], [0.1, 0.84, 4, 0.14], [0.9, 0.86, 2, 0.08]]; }
		else if (lay === "top") { deepU = 0.5; deepV = 0.2; deepRU = 0.5; deepRV = 0.38; clusters = [[0.84, 0.8, 5, 0.17], [0.12, 0.78, 4, 0.15], [0.5, 0.94, 1, 0.04]]; corner = 2; }
		else if (lay === "bottom") { deepU = 0.5; deepV = 0.8; deepRU = 0.5; deepRV = 0.38; clusters = [[0.86, 0.2, 5, 0.17], [0.3, 0.14, 3, 0.12]]; }
		else if (lay === "split") { deepU = 0.3; deepV = 0.5; deepRU = 0.32; deepRV = 0.5; clusters = [[0.84, 0.22, 5, 0.16], [0.74, 0.84, 4, 0.15]]; corner = 1; }
		else if (lay === "corner") { deepU = 0.28; deepV = 0.72; deepRU = 0.34; deepRV = 0.4; clusters = [[0.84, 0.22, 5, 0.17], [0.86, 0.8, 3, 0.12]]; corner = 1; }
		function depthAt(x, y, W) {
			var dx = (x - deepU * W) / (deepRU * Math.max(W, 760)), dy = (y - deepV * 1080) / (deepRV * 1080);
			return 1 - ss(0.5, 1.2, Math.sqrt(dx * dx + dy * dy) + (tnoise(x / 240, y / 240, 0, 0, 11) - 0.5) * 0.5);
		}

		// ---- sprites baked once
		// (the ripple light is worked out over the first frames and faded in; the dim moods only ever use one sheet of it)
		var cauJob = [causticJob(mood + "a", 320, mx(lit([255, 250, 226], light), WHITE, 0.5)), cauA >= 0.3 ? causticJob(mood + "b", 320, mx(lit([255, 250, 226], light), WHITE, 0.5)) : null], cauIn = [0, 0];
		var shadowSpr = puff(64, mul(deepC, 0.22), 0.8, 0.34), ringSpr = ringSprite(mx(lit(WHITE, light), WHITE, 0.5), mul(deepC, 0.4));
		var PAL = {
			white: [250, 244, 234], orange: c2, red: tune(c2, -12, 1.06, 0.9), gold: tune(c2, 24, 0.96, 1.16), black: [34, 30, 36], blue: [96, 124, 158],
			light: night ? [150, 165, 225] : dusk ? [205, 190, 215] : rainy ? [220, 228, 228] : light, deep: deepC, deepMix: 0, glow: false
		};
		if (night) { PAL.glow = true; PAL.orange = c2; PAL.red = c3; PAL.blue = mx(c1, c2, 0.4); PAL.deep = mul(c1, 0.3); }
		var fish = [], nFish = 0, nLive = 0, glowSpr = night ? [K.glow(css(c2), 96, 0.12), K.glow(css(c3), 96, 0.12)] : null;
		function makeFish(n) {
			var kind = KOI_KINDS[KOI_ORDER[n % 12]], deep = n % 3 === 2, len = KOI_SIZES[n % 12] * (deep ? 0.78 : 1), P = PAL, f, j, a = Math.random() * TAU;
			if (deep && !night) { P = {}; for (j in PAL) { P[j] = PAL[j]; } P.deepMix = 0.3; }
			f = {
				x: 0, y: 0, th: a, v: K.rnd(30, 55), vt: K.rnd(30, 55), om: 0, ph: Math.random() * 9, amp: 0.5, wd: 0, wt: 0, deep: deep, len: len, seg: len / KOI_N, u: len / KOI_BW,
				jx: new Float32Array(KOI_N + 1), jy: new Float32Array(KOI_N + 1), qx: new Float32Array(KOI_N + 1), qy: new Float32Array(KOI_N + 1),
				state: 0, st: 0, kt: K.rnd(6, 30), rise: 0, placed: false, g: n % 2
			};
			f.spr = koiBody(n + (night ? "n" : "") + mood, kind, P);
			f.tail = koiTail(f.spr.tailC, night ? mx(c2, WHITE, 0.5) : mx(f.spr.tailC, lit(WHITE, PAL.light), 0.6), (n * 0.37) % 1);
			f.fin = koiFin(f.spr.fin, night ? mx(c2, WHITE, 0.4) : mx(f.spr.fin, lit(WHITE, PAL.light), 0.5));
			return f;
		}
		function place(f, W) {
			var j;
			f.x = K.rnd(0.06, 0.94) * W; f.y = K.rnd(0.08, 0.92) * 1080;
			for (j = 0; j <= KOI_N; j++) { f.jx[j] = f.x - Math.cos(f.th) * f.seg * j; f.jy[j] = f.y - Math.sin(f.th) * f.seg * j; f.qx[j] = f.jx[j]; f.qy[j] = f.jy[j]; }
			f.placed = true;
		}

		// rings on the surface
		var RN = 72, rx = new Float32Array(RN), ry = new Float32Array(RN), rAge = new Float32Array(RN), rLife = new Float32Array(RN), rMax = new Float32Array(RN), rA = new Float32Array(RN), rNext = 0, rainAcc = 0;
		for (i = 0; i < RN; i++) { rLife[i] = 1; rAge[i] = 2; }
		function ring(x, y, max, life, a, delay) {
			var j = rNext; rNext = (rNext + 1) % RN;
			rx[j] = x; ry[j] = y; rMax[j] = max; rLife[j] = life; rA[j] = a; rAge[j] = -(delay || 0);
		}

		// ---- things laid out for the size of the picture
		var pads = [], lilies = [], drifters = [], lamps = [], builtW = 0, meetPh = Math.random() * 9;
		var padCols = fall ? [[124, 132, 54], [156, 126, 52], [96, 120, 60], [140, 104, 48]] : [[62, 142, 76], [88, 160, 72], [46, 122, 84], [72, 150, 92]];
		var padLight = night ? [120, 150, 215] : dusk ? [170, 160, 200] : rainy ? [205, 222, 220] : light;
		var lilyA = lilySprite(c3, night ? [200, 205, 255] : dusk ? [225, 205, 225] : padLight, night), lilyB = lilySprite(mx(c3, WHITE, 0.82), night ? [200, 205, 255] : dusk ? [225, 205, 225] : padLight, night);
		var lilyGlow = night ? K.glow(css(mx(c3, WHITE, 0.3)), 128, 0.2) : null;
		function build(W) {
			var R = K.seeded("koipads" + lay + (W < 1000 ? "v" : "")), areaK = K.clamp(W / 1920, 0.42, 1), ci, C, n, tries, x, y, r, ok, j, p;
			pads = []; lilies = [];
			for (ci = 0; ci < clusters.length; ci++) {
				C = clusters[ci]; n = Math.max(1, Math.round(C[2] * (W < 1000 ? 0.7 : 1)));
				for (j = 0; j < n; j++) {
					for (tries = 0; tries < 30; tries++) {
						r = 52 + R() * 46; if (j === 0) { r = 88 + R() * 16; }
						x = (C[0] + (R() - 0.5) * 2 * C[3] * (W < 1000 ? 1.6 : 1)) * W; y = (C[1] + (R() - 0.5) * 2 * C[3] * 1.5) * 1080;
						ok = true;
						for (p = 0; p < pads.length; p++) { if (Math.sqrt((pads[p].x - x) * (pads[p].x - x) + (pads[p].y - y) * (pads[p].y - y)) < (pads[p].r + r) * 0.93) { ok = false; break; } }
						if (ok) { break; }
					}
					if (!ok) { continue; }
					pads.push({ x: x, y: y, r: r, ph: R() * TAU, spr: padSprite(R, padCols[Math.floor(R() * padCols.length)], padLight, R() * TAU) });
					if ((j === 0 || R() < 0.3) && !rainy || j === 0) { lilies.push({ x: x + (R() - 0.5) * r * 0.9, y: y + (R() - 0.5) * r * 0.9, r: 44 + R() * 22, rot: R() * TAU, spr: R() < 0.6 ? lilyA : lilyB, ph: R() * TAU }); }
				}
			}
			// the fish
			nFish = Math.round(K.clamp(4 + 4 * S.life, 5, 12) * (W < 1000 ? 0.62 : 1));
			nFish = Math.max(W < 1000 ? 4 : 5, nFish);
			// petals or fallen leaves riding the surface
			n = Math.round((fall ? 30 : rainy ? 7 : 13) * K.clamp(S.life, 0.4, 1.6) * areaK);
			drifters = [];
			for (j = 0; j < n; j++) { drifters.push({ x: R() * W, y: R() * 1080, rot: R() * TAU, vr: (R() - 0.5) * 0.25, s: (0.7 + R() * 0.6) * (fall ? 1.7 : 1.1), k: Math.floor(R() * 4), ph: R() * TAU }); }
			lamps = [];
			if (dusk) {
				n = W < 1000 ? 2 : 4;
				for (j = 0; j < n; j++) { lamps.push({ x: (0.18 + 0.64 * ((j * 0.37 + 0.2) % 1)) * W, y: (0.2 + 0.6 * ((j * 0.61 + 0.33) % 1)) * 1080, vx: (R() - 0.5) * 7, vy: (R() - 0.5) * 5, rot: R() * TAU, ph: R() * TAU }); }
			}
			builtW = W;
		}

		// ---- cached layers
		var STONES = [[168, 160, 148], [142, 138, 130], [190, 176, 152], [118, 124, 132], [160, 130, 106], [208, 202, 190], [104, 112, 106], [180, 152, 122]];
		function floor() {
			return layer(sc, "floor", function (g, W, H) {
				var R = K.seeded("koifloor"), lw = Math.max(24, Math.round(W / 8)), lh = 135, cell, x, y, d, j, n, r, rx2, ry2, rot, col, cx, cy, gr, p;
				// the bed: sand and silt, darker and bluer where the water is deep, brightest under the light
				var bed = pixels(lw, lh, function (px, py, out) {
					var X = (px + 0.5) / lw * W, Y = (py + 0.5) / lh * H, dd = depthAt(X, Y, W), nn = tfbm(X / 170, Y / 170, 0, 0, 5, 3);
					var lightK = 1.14 - 0.4 * Math.min(1, Math.sqrt(X * X + Y * Y) / 1900), c = mx(mul(mx(sandA, sandB, nn), lightK), deepC, Math.pow(dd, 0.7) * 0.96);
					out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = 255;
				});
				g.imageSmoothingQuality = "high";
				g.drawImage(bed, 0, 0, W, H);
				// pebbles in drifts with bare sand between: small ones first, then stones
				for (p = 0; p < 2; p++) {
					cell = p ? 44 : 23;
					for (cy = -cell; cy < H + cell; cy += cell) {
						for (cx = -cell; cx < W + cell; cx += cell) {
							x = cx + R() * cell; y = cy + R() * cell; r = p ? 9 + R() * R() * 24 : 3 + R() * 6; rot = R() * 3.2; n = R(); j = R();
							d = depthAt(x, y, W);
							if (d > 0.9) { continue; }
							if (tfbm(x / 260, y / 260, 0, 0, 23, 2) + (p ? 0.04 : -0.03) < 0.36 + 0.3 * j) { continue; }
							rx2 = r * (0.85 + 0.4 * j); ry2 = r * (0.62 + 0.25 * (1 - j));
							col = mx(lit(STONES[Math.floor(n * 7.99)], light, 1.08 - 0.36 * Math.min(1, Math.sqrt(x * x + y * y) / 1900)), tintC, 0.12 + 0.3 * d);
							g.globalAlpha = (1 - ss(0.3, 0.92, d)) * (p ? 1 : 0.85);
							g.fillStyle = css(mul(deepC, 0.5), 0.42 * sun + 0.2); g.beginPath(); g.ellipse(x + r * 0.2 + 1, y + r * 0.32 + 1.2, rx2, ry2, rot, 0, TAU); g.fill();
							g.fillStyle = css(col); g.beginPath(); g.ellipse(x, y, rx2, ry2, rot, 0, TAU); g.fill();
							g.fillStyle = css(mx(col, lit(WHITE, light), 0.5), 0.2 + 0.3 * sun); g.beginPath(); g.ellipse(x - rx2 * 0.2, y - ry2 * 0.26, rx2 * 0.56, ry2 * 0.5, rot, 0, TAU); g.fill();
						}
					}
				}
				g.globalAlpha = 1;
				// the shade of the lily pads on the bottom
				for (j = 0; j < pads.length; j++) {
					p = pads[j]; d = depthAt(p.x, p.y, W); x = p.x + SHX * (46 + 30 * d); y = p.y + SHY * (46 + 30 * d); r = p.r * 1.14;
					gr = g.createRadialGradient(x, y, 0, x, y, r);
					gr.addColorStop(0, css(mul(deepC, 0.3), 0.4 + 0.3 * sun)); gr.addColorStop(0.76, css(mul(deepC, 0.3), 0.36 + 0.26 * sun)); gr.addColorStop(1, css(mul(deepC, 0.3), 0));
					g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
				}
				// the edges of the picture fall away a little
				gr = g.createRadialGradient(W * 0.46, H * 0.44, H * 0.42, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
				gr.addColorStop(0, css(mul(deepC, 0.4), 0)); gr.addColorStop(1, css(mul(deepC, 0.4), 0.5));
				g.fillStyle = gr; g.fillRect(0, 0, W, H);
				grain(g, W, H, 0.03);
			});
		}
		// the murk of the deep water, drawn over whatever swims low
		function murk() {
			return layer(sc, "murk", function (g, W, H) {
				var lw = Math.max(24, Math.round(W / 8)), lh = 135;
				g.imageSmoothingQuality = "high";
				g.drawImage(pixels(lw, lh, function (px, py, out) {
					var dd = depthAt((px + 0.5) / lw * W, (py + 0.5) / lh * H, W);
					out[0] = deepC[0]; out[1] = deepC[1]; out[2] = deepC[2]; out[3] = 255 * 0.8 * ss(0.2, 0.95, dd);
				}), 0, 0, W, H);
			});
		}
		function caustic(j) {
			var per = j ? 640 : 450;
			return layer(sc, "cau" + j, function (g, w, h) { g.imageSmoothingQuality = "high"; g.drawImage(cauJob[j].cv, 0, 0, w, h); }, snap(sc, per), snap(sc, per));
		}
		// a soft wash of light on the surface toward the light
		function sheen() {
			return layer(sc, "sheen", function (g, w, h) {
				var gr = g.createRadialGradient(0, 0, 0, 0, 0, w);
				gr.addColorStop(0, css(mx(lit(WHITE, light), WHITE, 0.5), night ? 0.16 : dusk ? 0.1 : rainy ? 0.2 : 0.3)); gr.addColorStop(0.5, css(lit(WHITE, light), 0.07)); gr.addColorStop(1, css(lit(WHITE, light), 0));
				g.fillStyle = gr; g.fillRect(0, 0, w, h);
			}, snap(sc, 900), snap(sc, 760), true);
		}
		// a branch reaching in over the water, close to us and out of focus
		var leafCols = fall ? [[214, 60, 34], [236, 112, 30], [248, 170, 44], [190, 40, 40], [226, 86, 40]] : [[88, 160, 62], [120, 186, 70], [64, 136, 66], [150, 200, 84]];
		var leafLight = night ? [70, 86, 140] : dusk ? [110, 100, 140] : rainy ? [170, 186, 180] : light;
		function branch() {
			var bw = 700, bh = 560, q = 0.17;
			return K.bake(bw * q * sc.k, bh * q * sc.k, function (g, w, h) {
				var R = K.seeded("koibranch"), twigs = [[0, 0, 280, 150, 520, 170], [120, 70, 280, 280, 340, 400], [0, 0, 110, 200, 130, 370], [240, 130, 400, 90, 560, 40]], j, t, n, x, y, r, tw, u, a, col;
				g.scale(w / bw, h / bh);
				g.strokeStyle = css(lit([46, 36, 30], leafLight)); g.lineCap = "round";
				for (j = 0; j < twigs.length; j++) { tw = twigs[j]; g.lineWidth = j ? 9 : 15; g.beginPath(); g.moveTo(tw[0] - 20, tw[1] - 20); g.quadraticCurveTo(tw[2], tw[3], tw[4], tw[5]); g.stroke(); }
				for (n = 0; n < 110; n++) {
					tw = twigs[n % twigs.length]; t = 0.08 + R() * 0.96; u = 1 - t;
					x = u * u * tw[0] + 2 * u * t * tw[2] + t * t * tw[4] + (R() - 0.5) * 130; y = u * u * tw[1] + 2 * u * t * tw[3] + t * t * tw[5] + (R() - 0.5) * 120;
					r = 36 + R() * 30; a = R() * TAU;
					// mostly in shadow against the bright water, a few leaves catching the sun
					col = lit(mul(leafCols[Math.floor(R() * leafCols.length)], R() < 0.3 ? 0.95 + R() * 0.25 : 0.34 + R() * 0.26), leafLight);
					if (fall) { leaf(g, x, y, r, a, css(col), null); }
					else {
						g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = css(col);
						g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(-r * 0.1, r * 0.5, r, 0); g.quadraticCurveTo(-r * 0.1, -r * 0.5, -r, 0); g.fill(); g.restore();
					}
				}
			});
		}
		var branchSpr = null;

		// ---- small moving things
		var petalSpr = [], dfly = null, dShadow = puff(48, [0, 10, 14], 0.4, 0.3), lampSpr = null, lampGlow = null;
		(function () {
			var j, cols = fall ? leafCols : [mx(c3, WHITE, 0.35), mx(c3, WHITE, 0.6), mx(c3, WHITE, 0.2), mx(c3, WHITE, 0.75)];
			function petal(col) {
				return K.bake(48, 48, function (g, w) {
					var gr;
					g.translate(w / 2, w / 2);
					if (fall) { leaf(g, 2, 3, 19, 0, "rgba(10,14,10,0.3)", null); leaf(g, 0, 0, 19, 0, css(lit(col, padLight)), css(lit(mul(col, 0.6), padLight), 0.6)); return; }
					g.fillStyle = "rgba(10,20,24,0.25)"; g.beginPath(); g.moveTo(-15, 3); g.quadraticCurveTo(1, 16, 17, 3); g.quadraticCurveTo(1, -9, -15, 3); g.fill();
					gr = g.createLinearGradient(-16, 0, 16, 0); gr.addColorStop(0, css(lit(mx(col, c3, 0.4), padLight))); gr.addColorStop(1, css(lit(mx(col, WHITE, 0.5), padLight)));
					g.fillStyle = gr; g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(0, 13, 16, 0); g.quadraticCurveTo(0, -12, -16, 0); g.fill();
					g.strokeStyle = css(lit(WHITE, padLight), 0.4); g.lineWidth = 1; g.beginPath(); g.moveTo(-11, 0); g.quadraticCurveTo(0, 3, 11, 0); g.stroke();
				});
			}
			for (j = 0; j < 4; j++) { petalSpr.push(petal(cols[j % cols.length])); }
			if (dusk) {
				// a paper lantern on a wooden float, seen from above, and the pool of light it throws
				lampSpr = K.bake(120, 120, function (g, w) {
					var c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, 44);
					g.fillStyle = "rgb(46,30,24)"; K.rr(g, c - 50, c - 50, 100, 100, 9); g.fill();
					g.fillStyle = "rgb(88,58,40)"; K.rr(g, c - 46, c - 46, 92, 92, 7); g.fill();
					gr.addColorStop(0, "rgb(255,252,224)"); gr.addColorStop(0.3, css(mx(c3, WHITE, 0.55))); gr.addColorStop(1, css(mul(c3, 0.94)));
					g.fillStyle = gr; K.rr(g, c - 36, c - 36, 72, 72, 5); g.fill();
					g.strokeStyle = css(mul(c3, 0.5), 0.75); g.lineWidth = 3; K.rr(g, c - 36, c - 36, 72, 72, 5); g.stroke();
					g.lineWidth = 2; g.beginPath(); g.moveTo(c - 36, c - 36); g.lineTo(c - 12, c - 12); g.moveTo(c + 36, c - 36); g.lineTo(c + 12, c - 12); g.moveTo(c - 36, c + 36); g.lineTo(c - 12, c + 12); g.moveTo(c + 36, c + 36); g.lineTo(c + 12, c + 12); g.stroke();
				});
				lampGlow = puff(256, mx(c3, [255, 190, 110], 0.3), 0.6, 0.12);
			}
		})();
		// A dragonfly: darts, hangs in the air, sometimes rests on a lily pad.
		function makeDragonfly(seed) {
			var body = night ? mx(c2, WHITE, 0.3) : fall ? [206, 60, 40] : dusk ? [230, 160, 90] : [38, 170, 196], wingC = night ? mx(c2, WHITE, 0.6) : lit(WHITE, padLight);
			var spr = [0, 1].map(function (fr) {
				return K.bake(120, 120, function (g, w) {
					var c = w / 2, j, a, len;
					g.translate(c, c);
					// four wings; the second picture has them a beat further round, and fainter, for the blur of flight
					for (j = 0; j < 4; j++) {
						a = (j < 2 ? -1 : 1) * (j % 2 ? 1.92 : 1.3) + (fr ? (j < 2 ? 0.2 : -0.2) : 0); len = j % 2 ? 46 : 50;
						g.save(); g.rotate(a);
						g.fillStyle = css(wingC, fr ? 0.2 : 0.42); g.beginPath(); g.ellipse(len * 0.55, 0, len * 0.5, fr ? 11 : 7.5, 0, 0, TAU); g.fill();
						g.strokeStyle = css(wingC, fr ? 0.2 : 0.6); g.lineWidth = 0.8; g.beginPath(); g.moveTo(4, 0); g.lineTo(len, -1); g.stroke();
						g.restore();
					}
					g.fillStyle = css(mul(body, 0.6)); g.beginPath(); g.ellipse(-22, 0, 26, 2.8, 0, 0, TAU); g.fill();
					g.fillStyle = css(body);
					for (j = 0; j < 6; j++) { g.beginPath(); g.ellipse(-8 - j * 7, 0, 3.2, 2.5 - j * 0.12, 0, 0, TAU); g.fill(); }
					g.fillStyle = css(mul(body, 0.85)); g.beginPath(); g.ellipse(4, 0, 8, 5, 0, 0, TAU); g.fill();
					g.fillStyle = css(mx(body, WHITE, 0.4)); g.beginPath(); g.ellipse(3, -1.5, 4, 2, 0, 0, TAU); g.fill();
					g.fillStyle = css(mul(body, 0.45)); g.beginPath(); g.arc(13, 0, 4.6, 0, TAU); g.fill();
					g.fillStyle = css(mx(body, WHITE, 0.5)); g.beginPath(); g.arc(14, -2.6, 1.8, 0, TAU); g.arc(14, 2.6, 1.8, 0, TAU); g.fill();
				});
			});
			var D = { x: -200, y: 300 + seed * 240, th: 0, hd: 0, state: 0, t: 0, len: K.rnd(1, 3), x0: 0, y0: 0, x1: 0, y1: 0, flap: 0, perch: false, born: false };
			D.step = function (dt, W) {
				var e, p, dx, dy;
				if (!D.born) { D.born = true; D.x = D.x1 = K.rnd(0.2, 0.8) * W; D.y = D.y1 = K.rnd(0.2, 0.8) * 1080; }
				D.t += dt;
				if (D.state === 1) {
					e = K.ease.inOut(Math.min(1, D.t / D.len));
					D.x = D.x0 + (D.x1 - D.x0) * e; D.y = D.y0 + (D.y1 - D.y0) * e;
					if (D.t >= D.len) { D.state = 0; D.t = 0; D.len = D.perch ? K.rnd(4, 9) : K.rnd(0.5, 2.4); D.hd = D.th + K.rnd(-1.2, 1.2); }
				} else {
					// hanging in the air, or resting
					if (!D.perch) { D.x = D.x1 + Math.sin(D.t * 7.1 + seed) * 2.2; D.y = D.y1 + Math.sin(D.t * 5.3 + seed * 2) * 2.2; D.th += wrapPi(D.hd - D.th) * Math.min(1, dt * 5); }
					if (D.t >= D.len) {
						D.state = 1; D.t = 0; D.x0 = D.x; D.y0 = D.y; D.perch = false;
						if (pads.length && Math.random() < 0.3) { p = pads[Math.floor(Math.random() * pads.length)]; D.x1 = p.x + K.rnd(-0.3, 0.3) * p.r; D.y1 = p.y + K.rnd(-0.3, 0.3) * p.r; D.perch = true; }
						else if (Math.random() < 0.12) { D.x1 = Math.random() < 0.5 ? -160 : W + 160; D.y1 = K.rnd(0, 1080); }
						else { D.x1 = K.rnd(0.06, 0.94) * W; D.y1 = K.rnd(0.08, 0.92) * 1080; }
						dx = D.x1 - D.x0; dy = D.y1 - D.y0; D.th = Math.atan2(dy, dx); D.len = Math.max(0.35, Math.sqrt(dx * dx + dy * dy) / 620);
					}
				}
				D.flap++;
			};
			D.shadow = function (g) {
				var resting = D.perch && D.state === 0, off = resting ? 5 : 58;
				g.globalAlpha = resting ? 0.5 : 0.3 * (0.4 + 0.6 * sun); g.drawImage(dShadow, D.x + SHX * off - 22, D.y + SHY * off - 12, 44, 24); g.globalAlpha = 1;
			};
			D.draw = function (g, k) {
				var c = Math.cos(D.th), s = Math.sin(D.th), resting = D.perch && D.state === 0, u = 0.95;
				g.setTransform(k * c * u, k * s * u, -k * s * u, k * c * u, k * D.x, k * (D.y - sc.top));
				g.drawImage(spr[resting ? 0 : D.flap % 2], -60, -60, 120, 120);
				g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			};
			return D;
		}
		var flies = [makeDragonfly(0)];
		if (S.life >= 1.4) { flies.push(makeDragonfly(1)); }
		// motes of light over a night pond
		var MN = night ? 46 : dusk ? 14 : 0, mote = new Float32Array(MN * 4), moteSpr = night ? K.glow(css(mx(c2, c3, 0.5)), 32, 0.3) : dusk ? K.glow("#ffd27a", 32, 0.3) : null;
		for (i = 0; i < MN * 4; i++) { mote[i] = Math.random(); }
		// sparkle on the ripples toward the sun
		var GN = sun > 0.8 ? 34 : 0, glint = new Float32Array(GN * 4), glintSpr = GN ? K.bake(64, 64, function (g, w) {
			var c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c * 0.5), a;
			gr.addColorStop(0, "rgba(255,252,236,1)"); gr.addColorStop(0.4, "rgba(255,244,214,0.4)"); gr.addColorStop(1, "rgba(255,244,214,0)");
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
			// four thin rays
			for (a = 0; a < 2; a++) {
				gr = a ? g.createLinearGradient(0, 0, 0, w) : g.createLinearGradient(0, 0, w, 0);
				gr.addColorStop(0, "rgba(255,250,230,0)"); gr.addColorStop(0.5, "rgba(255,250,230,0.9)"); gr.addColorStop(1, "rgba(255,250,230,0)");
				g.fillStyle = gr; if (a) { g.fillRect(c - 1, 0, 2, w); } else { g.fillRect(0, c - 1, w, 2); }
			}
		}) : null;
		for (i = 0; i < GN * 4; i++) { glint[i] = Math.random(); }

		function stepFish(f, dt, W) {
			var fx = Math.cos(f.th), fy = Math.sin(f.th), ax = fx, ay = fy, m = 170, j, o2, dx, dy, d, w, tm, N = KOI_N, nx, ny, off, env;
			f.wt -= dt;
			if (f.wt <= 0) {
				f.wt = K.rnd(1.6, 5); f.wd = K.rnd(-0.6, 0.6);
				if (f.state === 0) { f.vt = K.rnd(26, 60); if (Math.random() < 0.1) { f.vt = K.rnd(120, 180); } }
			}
			ax += -fy * f.wd; ay += fx * f.wd;
			// stay with the picture
			if (f.x < m) { ax += (m - f.x) / m * 1.7; } else if (f.x > W - m) { ax -= (f.x - (W - m)) / m * 1.7; }
			if (f.y < m) { ay += (m - f.y) / m * 1.7; } else if (f.y > 1080 - m) { ay -= (f.y - (1080 - m)) / m * 1.7; }
			// the shoal's loose meeting place wanders about the open water
			dx = (deepU + 0.24 * Math.sin(T * 0.05 + meetPh + f.g * 2.4)) * W - f.x; dy = (deepV + 0.3 * Math.sin(T * 0.037 + meetPh * 2 + f.g * 1.3)) * 1080 - f.y;
			d = Math.sqrt(dx * dx + dy * dy) + 1; w = 0.2 * ss(260, 800, d); ax += dx / d * w; ay += dy / d * w;
			// keep clear of the others at the same depth (head, middle and tail), and swing round the middle of a lily pad
			for (j = 0; j < nLive; j++) {
				o2 = fish[j];
				if (o2 === f || o2.deep !== f.deep) { continue; }
				for (w = 1; w <= 9; w += 4) {
					dx = f.x - o2.jx[w]; dy = f.y - o2.jy[w]; d = Math.sqrt(dx * dx + dy * dy) + 1;
					if (d < 190) { d = (1 - d / 190) * 1.25 / d; ax += dx * d; ay += dy * d; }
				}
			}
			if (!f.deep) {
				for (j = 0; j < pads.length; j++) {
					o2 = pads[j]; dx = f.x - o2.x; dy = f.y - o2.y; d = Math.sqrt(dx * dx + dy * dy) + 1;
					if (d < o2.r + 70) { w = (1 - d / (o2.r + 70)) * 0.9; ax += dx / d * w; ay += dy / d * w; }
				}
			}
			d = wrapPi(Math.atan2(ay, ax) - f.th);
			// a fish cannot turn tighter than about half its own length; one that has far to turn picks up a little speed for it
			tm = 0.1 + f.v / (0.52 * f.len);
			if (Math.abs(d) > 1.1 && f.state === 0 && f.vt < 78) { f.vt = 78; }
			f.om += (K.clamp(d * 1.7, -tm, tm) - f.om) * Math.min(1, dt * 2.4);
			f.th += f.om * dt;
			// coming up to touch the surface now and then
			f.kt -= dt;
			if (f.state === 0 && f.kt <= 0) {
				if (!f.deep && f.x > 120 && f.x < W - 120 && f.y > 120 && f.y < 960) { f.state = 1; f.st = 0; f.vt = 7; } else { f.kt = 3; }
			} else if (f.state === 1) {
				f.st += dt; f.rise += (1 - f.rise) * Math.min(1, dt * 2.5);
				if (f.st > 1.1) { ring(f.qx[0], f.qy[0], K.rnd(84, 120), 2.6, 0.85, 0); ring(f.qx[0], f.qy[0], K.rnd(50, 70), 2.2, 0.7, 0.3); f.state = 2; f.st = 0; f.vt = K.rnd(120, 170); f.wd = Math.random() < 0.5 ? -1 : 1; f.wt = 0.9; }
			} else if (f.state === 2) {
				f.st += dt; f.rise += (0 - f.rise) * Math.min(1, dt * 1.5);
				if (f.st > 1.2) { f.state = 0; f.kt = K.rnd(14, 44) / K.clamp(S.life, 0.5, 2); }
			}
			f.v += (f.vt - f.v) * Math.min(1, dt * (f.vt > f.v ? 2.4 : 0.5));
			if (f.vt > 90 && f.state !== 2) { f.vt -= dt * 110; }
			f.x += Math.cos(f.th) * f.v * dt; f.y += Math.sin(f.th) * f.v * dt;
			f.ph += dt * (1.7 + f.v * 0.052);
			f.amp += (Math.min(1.5, 0.32 + f.v / 130 + Math.abs(f.om) * 0.45) - f.amp) * Math.min(1, dt * 3);
			// the spine: each joint follows the one ahead at a fixed distance
			f.jx[0] = f.x; f.jy[0] = f.y;
			for (j = 1; j <= N; j++) {
				dx = f.jx[j] - f.jx[j - 1]; dy = f.jy[j] - f.jy[j - 1]; d = Math.sqrt(dx * dx + dy * dy) || 1;
				f.jx[j] = f.jx[j - 1] + dx / d * f.seg; f.jy[j] = f.jy[j - 1] + dy / d * f.seg;
			}
			// ...and the swimming wave runs down it, growing toward the tail
			for (j = 0; j <= N; j++) {
				o2 = j === 0 ? 1 : j;
				nx = -(f.jy[o2] - f.jy[o2 - 1]) / f.seg; ny = (f.jx[o2] - f.jx[o2 - 1]) / f.seg;
				env = 0.05 + Math.pow(j / N, 1.9);
				off = f.len * 0.062 * f.amp * env * Math.sin(f.ph - j * 0.6);
				f.qx[j] = f.jx[j] + nx * off; f.qy[j] = f.jy[j] + ny * off;
			}
		}
		function fishShadow(g, f, W, few) {
			var d = depthAt(f.qx[3], f.qy[3], W), off = (f.deep ? 20 : 44 + 16 * f.rise) + 34 * d, ox = SHX * off, oy = SHY * off, w = f.u * KOI_HALF * 3.3, j;
			g.globalAlpha = (f.deep ? 0.85 : 0.7) * (0.4 + 0.6 * sun);
			// (three larger patches instead of five when the machine is struggling)
			for (j = 1; j <= 9; j += few ? 4 : 2) { d = w * (j < 6 ? 1 : 0.6) * (few ? 1.25 : 1); g.drawImage(shadowSpr, f.qx[j] + ox - d / 2, f.qy[j] + oy - d / 2, d, d); }
		}
		function drawFish(g, f, k) {
			var N = KOI_N, j, x0, y0, dx, dy, len, c, s, u = f.u * (1 + 0.07 * f.rise), ov = KOI_OV * u, hh = KOI_H / 2 * u, a, sw, side, fa;
			// tail fin: swings a beat behind the last of the spine
			dx = f.qx[N] - f.qx[N - 1]; dy = f.qy[N] - f.qy[N - 1];
			a = Math.atan2(dy, dx) + 0.42 * f.amp * Math.sin(f.ph - N * 0.6 - 0.9);
			c = Math.cos(a) * k * u; s = Math.sin(a) * k * u;
			g.setTransform(c, s, -s, c, k * (f.qx[N] - dx * 0.25), k * (f.qy[N] - dy * 0.25 - sc.top));
			g.drawImage(f.tail, -3, -66);
			// side fins: spread when it slows or turns, folded back when it darts
			dx = f.qx[3] - f.qx[2]; dy = f.qy[3] - f.qy[2]; a = Math.atan2(dy, dx); len = Math.sqrt(dx * dx + dy * dy) || 1;
			sw = koiHalf(0.24) * u * 0.86;
			for (side = -1; side <= 1; side += 2) {
				fa = 0.95 - Math.min(0.6, f.v / 240) + 0.2 * Math.sin(f.ph * 0.5 + side) + side * K.clamp(f.om, -0.5, 0.5) * 0.5;
				c = Math.cos(a + side * fa) * k * u; s = Math.sin(a + side * fa) * k * u;
				g.setTransform(c, s, -s * side, c * side, k * (f.qx[2] + dx * 0.4 - dy / len * sw * side), k * (f.qy[2] + dy * 0.4 + dx / len * sw * side - sc.top));
				g.drawImage(f.fin, -2, -24);
			}
			// the body, slice by slice along the spine
			for (j = 0; j < N; j++) {
				x0 = f.qx[j]; y0 = f.qy[j]; dx = f.qx[j + 1] - x0; dy = f.qy[j + 1] - y0; len = Math.sqrt(dx * dx + dy * dy) || 1;
				c = dx / len * k; s = dy / len * k;
				g.setTransform(c, s, -s, c, k * x0, k * (y0 - sc.top));
				g.drawImage(f.spr, j * KOI_SW, 0, KOI_SW + 2 * KOI_OV, KOI_H, -ov, -hh, len + 2 * ov, 2 * hh);
			}
		}

		function padLayer(j) {
			var p = pads[j];
			return layer(sc, "pad" + j, function (g, w, h) { g.imageSmoothingQuality = "high"; g.drawImage(p.spr, 6 - p.r * 6 / 106, 6 - p.r * 6 / 106, p.r * 224 / 106, p.r * 224 / 106); }, snap(sc, p.r * 2 + 12), snap(sc, p.r * 2 + 12));
		}
		function lilyLayer(j) {
			var p = lilies[j];
			return layer(sc, "lily" + j, function (g, w, h) { g.imageSmoothingQuality = "high"; g.translate(p.r + 2, p.r + 2); g.rotate(p.rot); g.drawImage(p.spr, -p.r, -p.r, p.r * 2, p.r * 2); }, snap(sc, p.r * 2 + 4), snap(sc, p.r * 2 + 4));
		}
		// the branch at the size and in the corner it is shown, so each frame only has to lay it down
		function branchLayer(W) {
			var q = K.clamp(W / 1500, 0.56, 1);
			return layer(sc, "branch", function (g, w, h) {
				if (!branchSpr) { branchSpr = branch(); }
				g.imageSmoothingQuality = "high";
				g.translate(corner === 1 ? w : 0, corner === 2 ? h : 0); g.scale(corner === 1 ? -1 : 1, corner === 2 ? -1 : 1);
				g.drawImage(branchSpr, 0, 0, w, h);
			}, snap(sc, 610 * q), snap(sc, 488 * q));
		}
		sc.onresize = function () { branchSpr = null; };
		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, dts = dt * S.speed, slow = !!(window.SSO_FRAMES && window.SSO_FRAMES.level() > 0), j, f, L, a, r, p, d, x, y, c, s, n;
			// laid out again only when the shape of the picture changes, never because the resolution was lowered
			if (Math.abs(builtW - W) > 2) { build(W); }
			// the fish arrive one a frame (each takes a moment to paint), then the ripple light is worked out
			if (fish.length < nFish) { if (T !== T0) { f = makeFish(fish.length); place(f, W); fish.push(f); } } else { work(cauJob, 8); }
			nLive = Math.min(nFish, fish.length);
			T += dts;
			put(g, floor(), k, 0, 0);
			// light rippling over the bottom: two sheets sliding across each other
			if (cauA > 0.02) {
				if (cauJob[0].done) { cauIn[0] = Math.min(1, cauIn[0] + dt * 1.5); g.globalAlpha = (cauA < 0.3 ? cauA * 1.3 : cauA) * cauIn[0]; tileOver(sc, g, caustic(0), T * 13, T * 7); }
				// (the dim moods, and a machine that is struggling, make do with one sheet)
				if (cauJob[1] && cauJob[1].done && !slow) { cauIn[1] = Math.min(1, cauIn[1] + dt * 1.5); g.globalAlpha = cauA * 0.8 * cauIn[1]; tileOver(sc, g, caustic(1), -T * 9 + 300, T * 11 + 170); }
				g.globalAlpha = 1;
			}
			for (j = 0; j < nLive; j++) { stepFish(fish[j], dts, W); }
			for (j = 0; j < nLive; j++) { fishShadow(g, fish[j], W, slow); }
			g.globalAlpha = 1;
			for (j = 0; j < nLive; j++) { if (fish[j].deep) { drawFish(g, fish[j], k); } }
			g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			put(g, murk(), k, 0, 0);
			for (j = 0; j < nLive; j++) { if (!fish[j].deep) { drawFish(g, fish[j], k); } }
			g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			if (night) {
				// the fish carry their own light
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < nLive; j++) {
					f = fish[j]; g.globalAlpha = f.deep ? 0.3 : 0.5; r = f.len * 0.62;
					g.drawImage(glowSpr[f.g], f.qx[2] - r / 2, f.qy[2] - r / 2, r, r); g.drawImage(glowSpr[1 - f.g], f.qx[6] - r * 0.4, f.qy[6] - r * 0.4, r * 0.8, r * 0.8);
				}
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
			// rings where a fish touched the surface, or rain fell
			if (rainy) {
				rainAcc += dts * 22 * S.life * K.clamp(W / 1920, 0.4, 1);
				while (rainAcc >= 1) { rainAcc -= 1; x = Math.random() * W; y = Math.random() * 1080; a = K.rnd(20, 54); ring(x, y, a, K.rnd(0.8, 1.3), 0.7, 0); if (Math.random() < 0.4) { ring(x, y, a * 0.55, 0.9, 0.5, 0.18); } }
			}
			for (j = 0; j < RN; j++) {
				if (rAge[j] >= rLife[j]) { continue; }
				rAge[j] += dts;
				if (rAge[j] <= 0) { continue; }
				a = rAge[j] / rLife[j]; if (a >= 1) { continue; }
				r = rMax[j] * (0.12 + 0.88 * K.ease.out(a)) * 1.26;
				g.globalAlpha = rA[j] * (1 - a) * (1 - a); g.drawImage(ringSpr, rx[j] - r, ry[j] - r, r * 2, r * 2);
			}
			g.globalAlpha = 1;
			// petals and leaves riding the slow drift of the surface
			for (j = 0; j < drifters.length; j++) {
				p = drifters[j];
				p.x += (7 + 3 * Math.sin(T * 0.11 + p.ph)) * dts; p.y += (3.4 + 2.6 * Math.sin(T * 0.09 + p.ph * 2)) * dts; p.rot += p.vr * dts;
				if (p.x > W + 40) { p.x = -40; p.y = Math.random() * 1080; } if (p.y > 1120) { p.y = -40; p.x = Math.random() * W; }
				c = Math.cos(p.rot) * k * p.s; s = Math.sin(p.rot) * k * p.s;
				g.setTransform(c, s, -s, c, k * p.x, k * (p.y - sc.top)); g.drawImage(petalSpr[p.k], -24, -24);
			}
			g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			// lily pads and flowers, rocking a little
			for (j = 0; j < pads.length; j++) {
				p = pads[j]; x = p.x + 1.6 * Math.sin(T * 0.37 + p.ph * 2); y = p.y + 1.4 * Math.sin(T * 0.31 + p.ph);
				L = padLayer(j);
				if (slow) { put(g, L, k, x - p.r - 6, y - p.r - 6); } else { g.drawImage(L, x - p.r - 6, y - p.r - 6, L.wu, L.hu); }
			}
			if (lilyGlow) {
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < lilies.length; j++) { p = lilies[j]; r = p.r * 4.4; g.globalAlpha = 0.34 + 0.1 * Math.sin(T * 0.8 + p.ph); g.drawImage(lilyGlow, p.x - r / 2, p.y - r / 2, r, r); }
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
			for (j = 0; j < lilies.length; j++) {
				p = lilies[j]; x = p.x + 1.6 * Math.sin(T * 0.37 + p.ph * 2); y = p.y + 1.4 * Math.sin(T * 0.31 + p.ph);
				L = lilyLayer(j);
				if (slow) { put(g, L, k, x - p.r - 2, y - p.r - 2); } else { g.drawImage(L, x - p.r - 2, y - p.r - 2, L.wu, L.hu); }
			}
			// lanterns drifting, each in its pool of light
			if (lamps.length) {
				for (j = 0; j < lamps.length; j++) {
					p = lamps[j]; p.x += p.vx * dts; p.y += p.vy * dts; p.rot += 0.02 * dts;
					if (p.x < -260) { p.x = W + 250; } else if (p.x > W + 260) { p.x = -250; } if (p.y < -260) { p.y = 1330; } else if (p.y > 1340) { p.y = -250; }
				}
				g.globalCompositeOperation = "lighter";
				L = layer(sc, "lampglow", function (c2d, w, h) { c2d.imageSmoothingQuality = "high"; c2d.drawImage(lampGlow, 0, 0, w, h); }, snap(sc, 540), snap(sc, 540), true);
				for (j = 0; j < lamps.length; j++) { p = lamps[j]; g.globalAlpha = 0.78 + 0.08 * Math.sin(T * 5.3 + p.ph) * Math.sin(T * 3.1 + p.ph * 3); put(g, L, k, p.x - 270, p.y - 270); }
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
				for (j = 0; j < lamps.length; j++) {
					p = lamps[j]; c = Math.cos(p.rot) * k * 0.74; s = Math.sin(p.rot) * k * 0.74;
					g.setTransform(c, s, -s, c, k * p.x, k * (p.y - sc.top)); g.drawImage(lampSpr, -60, -60);
				}
				g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			}
			if (MN) {
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < MN; j++) {
					a = Math.sin(T * (0.5 + mote[j * 4 + 2]) + mote[j * 4 + 3] * 40); a = a * a;
					x = ((mote[j * 4] + T * 0.004 * (mote[j * 4 + 2] - 0.3)) % 1 + 1) % 1 * (W + 60) - 30 + 22 * Math.sin(T * 0.3 + j); y = ((mote[j * 4 + 1] + T * 0.003 * (mote[j * 4 + 3] - 0.5)) % 1 + 1) % 1 * 1140 - 30 + 22 * Math.cos(T * 0.23 + j * 2);
					r = 8 + 14 * mote[j * 4 + 2];
					g.globalAlpha = 0.25 + 0.7 * a; g.drawImage(moteSpr, x - r / 2, y - r / 2, r, r);
				}
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
			if (GN && !slow) {
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < GN; j++) {
					a = Math.sin(T * (0.8 + glint[j * 4 + 2] * 1.7) + glint[j * 4 + 3] * 50);
					if (a < 0.72) { continue; }
					a = (a - 0.72) / 0.28; r = 12 + 30 * a * (0.4 + glint[j * 4 + 2]);
					x = glint[j * 4] * glint[j * 4] * W * 0.95 + 5 * Math.sin(T * 0.3 + j); y = glint[j * 4 + 1] * glint[j * 4 + 1] * 940 + 5 * Math.cos(T * 0.27 + j);
					if (depthAt(x, y, W) > 0.45) { continue; }
					g.globalAlpha = a * a; g.drawImage(glintSpr, x - r / 2, y - r / 2, r, r);
				}
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
			for (j = 0; j < flies.length; j++) { flies[j].step(dts, W); flies[j].shadow(g); }
			for (j = 0; j < flies.length; j++) { flies[j].draw(g, k); }
			// the branch overhead, stirring
			L = branchLayer(W); r = L.wu;
			x = (corner === 1 ? W - r + 30 : -30) + 5 * Math.sin(T * 0.41) + 3 * Math.sin(T * 0.23 + 1); y = (corner === 2 ? 1080 - L.hu + 30 : -30) + 3 * Math.sin(T * 0.33);
			if (slow) { put(g, L, k, x, y); } else { g.drawImage(L, x, y, r, L.hu); }
			if (corner === 0 && !slow) { put(g, sheen(), k, 0, 0); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "hab-koi", label: "Habitat: koi pond from above", colors: ["2a8f86", "ff6a1c", "ff9ecb"], start: startKoi });

	// ================================================================ 2. old forest with light shafts
	// A soft band of mist as a small texture that tiles sideways; stretch it and slide it.
	function fogTex(seed, c, w, h, cx, cy, lo, hi) {
		return pixels(w, h, function (x, y, o) {
			var v = Math.sin(Math.PI * (y + 0.5) / h), n = tfbm(x / w * cx, y / h * cy, cx, 0, seed, 4);
			o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 255 * ss(lo, hi, n) * v * v * (3 - 2 * v);
		});
	}
	// Slides a cached strip that tiles sideways (its left edge at -off). On whole pixels when asked, which costs far less
	// to draw once the machine is struggling.
	function slide(sc, g, L, off, y, whole) {
		var k = sc.k, wu = L.wu, hu = L.hu, x = -(((off % wu) + wu) % wu);
		if (whole) { x = Math.round(x * k) / k; y = Math.round(y * k) / k; }
		for (; x < sc.W; x += wu) { g.drawImage(L, x, y, wu, hu); }
	}
	function startForest(host, o) {
		var S = settings(o, ["summer", "dawn", "autumn", "night"]), sc = K.scene(host, { fps: 30, quality: S.sharp });
		var mood = S.mood, night = mood === "night", dawn = mood === "dawn", fall = mood === "autumn", lay = S.layout;
		var leafC = S.c1, lightC = S.c2, hazeC = S.c3, T = Math.random() * 500, cam = Math.random() * 4000, CAMV = 22, PER = 2560, SLANT = 0.46, i;
		// the sun (or the moon) stands upper right, behind the leaves; its shafts fall down to the left
		var lightU = lay === "split" ? 0.76 : lay === "corner" ? 0.72 : 0.68, glowK = night ? 0.55 : dawn ? 0.8 : 1;
		var dark = mx(mul(leafC, 0.1), [9, 11, 13], 0.6), barkC = mul(mx([70, 52, 42], mul(leafC, 0.34), night ? 0.75 : 0.35), night ? 0.6 : 1);
		var mossC = fall ? mx(leafC, [84, 112, 40], 0.75) : leafC, sunHaze = mul(mx(mx(mul(leafC, 0.75), hazeC, night ? 0.5 : 0.52), lightC, night ? 0.06 : 0.14), night ? 0.8 : 1);
		var rayC = mx(lightC, WHITE, 0.25), litLeaf = mx(mul(leafC, 1.25), lightC, 0.34);
		// four depths of trees: f = how fast it slides past, gy = where its ground is, hz = how much air is in the way
		var LAY = [
			{ f: 0.1, gy: 664, hz: 0.8, w0: 11, w1: 20, n: 15, gh: 100, nv: 3 },
			{ f: 0.2, gy: 694, hz: 0.58, w0: 20, w1: 38, n: 10, gh: 120, nv: 4 },
			{ f: 0.36, gy: 742, hz: 0.33, w0: 38, w1: 70, n: 7, gh: 150, nv: 4 },
			{ f: 0.62, gy: 816, hz: dawn ? 0.2 : 0.07, w0: 84, w1: 148, n: 4, gh: 296, nv: 4 }
		];
		LAY.forEach(function (L, li) { L.i = li; L.sw = Math.ceil(L.w1 * 2.5); L.sh = L.gy + 26; L.trunks = []; });

		function paintTrunk(g, w, h, L, seed) {
			var R = K.seeded("tree" + seed), bw = (L.w0 + R() * (L.w1 - L.w0)) / 2, shear = (R() - 0.5) * 0.09, cx = w / 2, y, t, j, n, gr, x0, y0, len, big = L.w1 > 36;
			function half(yy) { var q = yy / h; return bw * (0.78 + 0.22 * q * q) + bw * 0.5 * Math.exp(-Math.abs(h - 20 - yy) / (bw * 0.7 + 4)); }
			g.save();
			g.transform(1, 0, shear, 1, -shear * h * 0.6, 0);
			if (big) {
				// a couple of bare boughs
				g.strokeStyle = css(mul(barkC, 0.8)); g.lineCap = "round";
				n = Math.floor(R() * 2.6);
				for (j = 0; j < n; j++) {
					y0 = h * (0.03 + R() * 0.2); t = R() < 0.5 ? -1 : 1; len = L.w1 * (0.6 + R() * 0.5);
					g.lineWidth = bw * (0.1 + R() * 0.1);
					g.beginPath(); g.moveTo(cx, y0); g.quadraticCurveTo(cx + t * len * 0.5, y0 - len * 0.15, cx + t * len, y0 - len * (0.5 + R() * 0.5)); g.stroke();
				}
			}
			g.beginPath(); g.moveTo(cx - half(0), 0);
			for (y = 10; y <= h; y += 10) { g.lineTo(cx - half(y), y); }
			for (y = h; y >= 0; y -= 10) { g.lineTo(cx + half(y), y); }
			g.closePath();
			g.save(); g.clip();
			// round it: a dark core, the side toward the sun warm and bright, a faint cool edge on the other
			gr = g.createLinearGradient(cx - bw * 1.15, 0, cx + bw * 1.15, 0);
			gr.addColorStop(0, css(mx(mul(barkC, 0.6), sunHaze, 0.3))); gr.addColorStop(0.12, css(mul(barkC, 0.5))); gr.addColorStop(0.6, css(mul(barkC, 0.8)));
			gr.addColorStop(0.84, css(mx(barkC, lightC, 0.22))); gr.addColorStop(0.95, css(mx(barkC, lightC, 0.62))); gr.addColorStop(1, css(mx(barkC, lightC, 0.86)));
			g.fillStyle = gr; g.fillRect(-w, 0, w * 3, h);
			if (big) {
				// bark: long broken furrows, dark and light
				n = Math.round(bw * 1.1) + 6;
				for (j = 0; j < n; j++) {
					x0 = cx + (R() * 2 - 1) * bw * 1.3; y0 = R() * h; len = 30 + R() * 200;
					g.strokeStyle = R() < 0.62 ? css(mul(barkC, 0.4), 0.3 + R() * 0.25) : css(mx(barkC, lightC, 0.35), 0.14 + R() * 0.14);
					g.lineWidth = 0.7 + R() * bw * 0.07;
					g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (R() - 0.5) * 5, y0 + len * 0.5); g.lineTo(x0 + (R() - 0.5) * 6, y0 + len); g.stroke();
				}
				// moss creeping up from the roots, thickest on the shaded side
				gr = g.createLinearGradient(0, h - 20 - h * 0.34, 0, h - 10);
				gr.addColorStop(0, css(mul(mossC, 0.5), 0)); gr.addColorStop(1, css(mul(mossC, 0.62), 0.7));
				g.fillStyle = gr; g.fillRect(-w, h * 0.5, w * 3, h * 0.5);
				for (j = 0; j < 150; j++) {
					t = R() * R(); x0 = cx + (R() * 2.2 - 1.3) * bw; y0 = h - 16 - t * h * 0.46;
					g.fillStyle = css(mx(mul(mossC, 0.4 + R() * 0.5), lightC, R() < 0.25 ? 0.3 : 0.04), 0.35 + 0.45 * (1 - t));
					g.beginPath(); g.ellipse(x0, y0, 1.5 + R() * bw * 0.09, 1.5 + R() * bw * 0.14, R() * 3, 0, TAU); g.fill();
				}
			}
			g.restore();
			g.restore();
			// the air between us and the tree: more of it with distance, and most in the mist near the ground
			gr = g.createLinearGradient(0, 0, 0, h);
			gr.addColorStop(0, css(sunHaze, L.hz * 0.8)); gr.addColorStop(0.55, css(sunHaze, L.hz)); gr.addColorStop(1, css(sunHaze, Math.min(0.96, L.hz + 0.26)));
			g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
		}
		function trunk(L, v) {
			return layer(sc, "t" + L.i + "_" + v, function (g, w, h) { paintTrunk(g, w, h, L, L.i * 10 + v); }, snap(sc, L.sw), snap(sc, L.sh));
		}
		// The ground of one depth: an uneven edge with grass and ferns along it, sunlit patches, leaf litter. Tiles sideways.
		function ground(L) {
			return layer(sc, "gr" + L.i, function (g, w, h) {
				var R = K.seeded("floor" + L.i), s = 0.35 + L.f * 1.05, earth = mx(mx(mul(mossC, 0.36), [40, 34, 24], 0.4), dark, 0.3), x, y, j, n, gr, len, t, rx, ry, m, c;
				function top(xx) { return 30 + 18 * s * (tfbm(xx / w * 16, L.i * 3.7, 16, 0, 40 + L.i, 3) - 0.5) * 2; }
				g.beginPath(); g.moveTo(0, h);
				for (x = 0; x <= w + 8; x += 8) { g.lineTo(x, top(x)); }
				g.lineTo(w, h); g.closePath();
				gr = g.createLinearGradient(0, 20, 0, h);
				gr.addColorStop(0, css(mx(mx(earth, mossC, 0.3), lightC, 0.12))); gr.addColorStop(Math.min(0.9, 70 / h), css(earth)); gr.addColorStop(1, css(mul(earth, L.i === 3 ? 0.4 : 0.9)));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				// pools of sunlight that found their way down
				n = Math.round(5 + 12 * L.f) * 3; t = 0; len = 0;
				for (j = 0; j < n; j++) {
					x = R() * w; rx = (36 + R() * 80) * s; ry = rx * (0.1 + 0.08 * R()); y = top(x) + ry + R() * (h - 50) * 0.55;
					if (j % 3) { x = t + (R() - 0.5) * rx * 2.2; y = len + (R() - 0.5) * ry * 2.4; } else { t = x; len = y; }
					for (m = -1; m <= 1; m++) {
						if (x + m * w + rx < 0 || x + m * w - rx > w) { continue; }
						g.save(); g.translate(x + m * w, y); g.scale(1, ry / rx);
						gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
						gr.addColorStop(0, css(mx(lightC, mossC, 0.25), 0.4 * glowK)); gr.addColorStop(0.5, css(mx(lightC, mossC, 0.35), 0.2 * glowK)); gr.addColorStop(1, css(lightC, 0));
						g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
					}
				}
				// leaf litter on the nearer ground
				n = Math.round(1400 * L.f * L.f);
				for (j = 0; j < n; j++) {
					x = R() * w; y = top(x) + 4 + R() * R() * (h - 30); c = R();
					g.fillStyle = c < 0.5 ? css(mul(earth, 0.5), 0.5) : css(mx(fall ? leafC : earth, lightC, 0.3), 0.3);
					g.beginPath(); g.ellipse(x, y, (2 + R() * 5) * s, (1 + R() * 2) * s, R() * 3, 0, TAU); g.fill();
				}
				g.restore();
				// what grows along the edge: grass everywhere, ferns and low bushes on the nearer ground
				for (x = 0; x < w; x += (4 + R() * 8) * s + 1.5) {
					y = top(x); len = (8 + R() * 24) * s; t = (R() - 0.5) * 0.9; c = R();
					g.fillStyle = css(mx(mul(mossC, 0.3 + R() * 0.4), lightC, c < 0.16 ? 0.45 : 0.06));
					g.beginPath(); g.moveTo(x - 1.7 * s, y + 4); g.lineTo(x + t * len, y - len); g.lineTo(x + 1.7 * s, y + 4); g.fill();
				}
				if (L.f > 0.15) {
					n = Math.round(9 + 8 * L.f);
					for (j = 0; j < n; j++) {
						x = 60 + R() * (w - 120); y = top(x) + 6; len = (26 + R() * 40) * s; c = R();
						g.strokeStyle = css(mx(mul(mossC, 0.3 + R() * 0.3), lightC, c < 0.3 ? 0.3 : 0.04)); g.lineCap = "round";
						for (m = 0; m < 9; m++) {
							t = (m / 8 - 0.5) * 2.4; g.lineWidth = (2.2 + R() * 2) * s;
							g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.sin(t) * len * 0.5, y - len * 0.9, x + Math.sin(t) * len * 1.25, y - len * (0.75 - 0.35 * Math.abs(t))); g.stroke();
						}
					}
				}
				gr = g.createLinearGradient(0, 0, 0, h);
				gr.addColorStop(0, css(sunHaze, Math.min(0.95, L.hz + 0.05))); gr.addColorStop(Math.min(1, 100 / h), css(sunHaze, L.i < 3 ? LAY[L.i + 1].hz + 0.05 : L.hz * 0.6)); gr.addColorStop(1, css(sunHaze, L.i < 3 ? LAY[L.i + 1].hz + 0.05 : 0));
				g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
			}, snap(sc, PER), snap(sc, L.gh));
		}
		function backdrop() {
			return layer(sc, "bd", function (g, W, H) {
				var gr = g.createLinearGradient(0, 0, 0, H), R = K.seeded("forestfar"), lx = lightU * W, r, j, x;
				var top = mx(mul(leafC, night ? 0.14 : 0.24), sunHaze, 0.12), mid = sunHaze, low = mx(mx(sunHaze, mul(mossC, 0.5), 0.35), dark, 0.3);
				gr.addColorStop(0, css(mul(top, 0.7))); gr.addColorStop(0.22, css(mx(top, mid, 0.55))); gr.addColorStop(0.46, css(mid)); gr.addColorStop(0.61, css(mx(mid, low, 0.55)));
				gr.addColorStop(0.72, css(low)); gr.addColorStop(1, css(mul(low, 0.5)));
				g.fillStyle = gr; g.fillRect(0, 0, W, H);
				g.save(); g.translate(lx, 220); g.scale(1.5, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 640);
				r.addColorStop(0, css(mx(lightC, WHITE, 0.7), glowK)); r.addColorStop(0.07, css(mx(lightC, WHITE, 0.45), 0.94 * glowK)); r.addColorStop(0.26, css(mx(lightC, WHITE, 0.1), 0.7 * glowK)); r.addColorStop(0.6, css(lightC, 0.28 * glowK)); r.addColorStop(1, css(lightC, 0));
				g.fillStyle = r; g.fillRect(-660, -660, 1320, 1320); g.restore();
				// away from the light the wood is cooler and deeper
				r = g.createLinearGradient(lx > W / 2 ? 0 : W, 0, lx, 0);
				r.addColorStop(0, css(mx(mul(leafC, 0.3), mul(hazeC, 0.4), 0.5), 0.5)); r.addColorStop(1, css(mul(leafC, 0.3), 0));
				g.fillStyle = r; g.fillRect(0, 0, W, H);
				// the furthest trees, barely there
				for (j = 0; j < Math.round(W / 30); j++) {
					x = R() * W;
					g.fillStyle = css(mx(dark, sunHaze, 0.5), 0.1 + R() * 0.2); g.fillRect(x, 0, 4 + R() * 9, 640 + R() * 30);
				}
				grain(g, W, H, 0.03);
			});
		}
		// The roof of leaves: j = 0 the further, paler one, j = 1 the near dark one. Ragged underneath, a few leaves lit through.
		function canopy(j) {
			return layer(sc, "can" + j, function (g, w, h) {
				var R = K.seeded("canopy" + j), base = j ? 120 : 200, t, col = j ? mx(dark, mul(leafC, 0.2), 0.5) : mx(mx(dark, mul(leafC, 0.4), 0.5), sunHaze, 0.34), x, y, r, n, q, c, m, a;
				function edge(xx) { return base + (j ? 84 : 72) * (tfbm(xx / w * 9, j * 5.3, 9, 0, 70 + j, 3) - 0.5) * 2 + 34 * (tfbm(xx / w * 40, j * 2.1, 40, 0, 90 + j, 2) - 0.5); }
				g.fillStyle = css(col);
				g.beginPath(); g.moveTo(0, 0);
				for (x = 0; x <= w + 10; x += 10) { g.lineTo(x, edge(x) - 22); }
				g.lineTo(w, 0); g.closePath(); g.fill();
				// boughs sagging below the edge
				n = j ? 16 : 12;
				for (q = 0; q < n; q++) {
					x = 100 + R() * (w - 200); y = edge(x) - 30; r = (60 + R() * 110) * (j ? 1.1 : 0.8); a = (R() - 0.5) * 1.3;
					g.strokeStyle = css(mx(col, barkC, 0.3)); g.lineWidth = j ? 4 : 3; g.lineCap = "round";
					g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.sin(a) * r * 0.5, y + r * 0.3, x + Math.sin(a) * r, y + r * 0.62); g.stroke();
					for (m = 0; m < 70; m++) {
						c = R(); t = R();
						g.fillStyle = c < 0.2 ? css(mx(litLeaf, sunHaze, j ? 0 : 0.3), 0.9) : css(mx(col, mul(leafC, 0.55), R() * 0.4));
						g.beginPath(); g.ellipse(x + Math.sin(a) * r * (0.05 + t) + (R() - 0.5) * 44 * (1.2 - t), y + r * (0.02 + t * 0.62) + (R() - 0.5) * 34 * (1.2 - t), (5 + R() * 7) * (j ? 1.2 : 0.9), (2.4 + R() * 3.4) * (j ? 1.2 : 0.9), R() * 3, 0, TAU); g.fill();
					}
				}
				// leaves along the ragged edge, some lit through by the sun
				n = Math.round(w / 0.9);
				for (q = 0; q < n; q++) {
					x = R() * w; r = (4.5 + R() * 7.5) * (j ? 1.25 : 0.9); y = edge(x) - 40 + R() * R() * 70; c = R();
					g.fillStyle = c < (j ? 0.14 : 0.22) ? css(mx(litLeaf, sunHaze, j ? 0 : 0.3), 0.9) : c < 0.45 ? css(mx(col, mul(leafC, 0.55), 0.35)) : css(col);
					a = R() * 3;
					for (m = -1; m <= 1; m++) {
						if (x + m * w + r < 0 || x + m * w - r > w) { continue; }
						g.beginPath(); g.ellipse(x + m * w, y, r, r * 0.52, a, 0, TAU); g.fill();
					}
				}
			}, snap(sc, PER), snap(sc, j ? 330 : 400));
		}
		// Shafts of light, painted small and enlarged (which is what softens their edges). Two sheets at two depths. Tile sideways.
		var BEAMS = [];
		(function () {
			var R = K.seeded("beams" + mood), x = 90, j = 0, n, rays;
			while (x < PER - 220) {
				rays = [];
				for (n = 0; n < 4; n++) { rays.push([R(), 0.1 + R() * 0.3, 0.2 + R() * 0.2]); }
				BEAMS.push({ x: x, w: 40 + R() * 130, a: 0.4 + R() * 0.6, len: 640 + R() * 380, sheet: j++ % 2, rays: rays });
				x += 150 + R() * 320;
			}
		})();
		function shafts(j) {
			return layer(sc, "shaft" + j, function (g, w, h) {
				var q = 0.125, cv = K.bake(Math.ceil(w * q * sc.k), Math.ceil(h * q * sc.k), function (c, cw, ch) {
					var n, m, s, b, wd, x0, a, gr;
					c.scale(cw / w, ch / h);
					for (n = 0; n < BEAMS.length; n++) {
						b = BEAMS[n];
						if (b.sheet !== j) { continue; }
						for (m = -1; m <= 1; m++) {
							for (s = 0; s < 5; s++) {
								// the whole beam first, then narrower, brighter rays inside it
								wd = s ? b.w * b.rays[s - 1][1] : b.w; x0 = b.x + m * w + (s ? (b.rays[s - 1][0] - 0.5) * (b.w - wd) : 0); a = b.a * (s ? b.rays[s - 1][2] * 1.5 : 0.62) * (night ? 0.7 : 1);
								gr = c.createLinearGradient(x0, 0, x0 - SLANT * b.len, b.len);
								gr.addColorStop(0, css(rayC, a)); gr.addColorStop(0.5, css(rayC, a * 0.62)); gr.addColorStop(1, css(rayC, 0));
								c.fillStyle = gr;
								c.beginPath(); c.moveTo(x0 - wd / 2, -10); c.lineTo(x0 + wd / 2, -10); c.lineTo(x0 + wd * 0.85 - SLANT * b.len, b.len); c.lineTo(x0 - wd * 0.85 - SLANT * b.len, b.len); c.closePath(); c.fill();
							}
						}
					}
				});
				g.imageSmoothingQuality = "high";
				g.drawImage(cv, 0, 0, w, h);
			}, snap(sc, PER), 1080, true);
		}
		// the glare round the sun, laid over the leaves in front of it
		function glare() {
			return layer(sc, "glare", function (g, w, h) {
				var gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2), R = K.seeded("sunstar"), j, a, len, wd;
				gr.addColorStop(0, css(mx(lightC, WHITE, 0.75), 0.9 * glowK)); gr.addColorStop(0.05, css(mx(lightC, WHITE, 0.5), 0.62 * glowK)); gr.addColorStop(0.16, css(mx(lightC, WHITE, 0.2), 0.34 * glowK)); gr.addColorStop(0.45, css(lightC, 0.13 * glowK)); gr.addColorStop(1, css(lightC, 0));
				g.scale(1, h / w); g.fillStyle = gr; g.fillRect(0, 0, w, w);
				g.translate(w / 2, w / 2); g.scale(1, w / h);
				for (j = 0; j < 14; j++) {
					a = j / 14 * TAU + R() * 0.3; len = 90 + R() * 210; wd = 2 + R() * 4;
					gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
					gr.addColorStop(0, css(mx(lightC, WHITE, 0.6), 0.5 * glowK)); gr.addColorStop(1, css(lightC, 0));
					g.fillStyle = gr; g.beginPath(); g.moveTo(-Math.sin(a) * wd, Math.cos(a) * wd); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.lineTo(Math.sin(a) * wd, -Math.cos(a) * wd); g.fill();
				}
			}, snap(sc, 1000), snap(sc, 700), true);
		}
		var fogs = [fogTex(3, mx(sunHaze, WHITE, 0.2), 320, 80, 5, 2, 0.3, 0.8), fogTex(17, mx(sunHaze, WHITE, 0.1), 320, 80, 4, 2, 0.32, 0.82)];
		function fog(j, bw, h) {
			return layer(sc, "fog" + j, function (g, w, hh) { g.imageSmoothingQuality = "high"; g.drawImage(fogs[j % 2], 0, 0, w, hh); }, snap(sc, bw), snap(sc, h), true);
		}
		// A fern for the foreground: fronds arching out of one crown, leaflets shrinking toward each tip.
		function fern(v) {
			return layer(sc, "fern" + v, function (g, w, h) {
				var R = K.seeded("fern" + v), n = 7 + Math.floor(R() * 4), bx = w / 2, by = h - 6, q, a, len, j, t, u, px, py, tx, ty, d, l2, m, cxp, cyp, ex, ey, col, sunny;
				for (q = 0; q < n; q++) {
					t = q / (n - 1) - 0.5; a = -Math.PI / 2 + t * 2.5 + (R() - 0.5) * 0.2; len = h * (0.62 + R() * 0.36) * (1 - 0.34 * Math.abs(t) * 2);
					ex = bx + Math.cos(a) * len * 1.12; ey = by + Math.sin(a) * len * 0.72 + len * 0.16 * Math.abs(Math.cos(a));
					cxp = bx + Math.cos(a) * len * 0.42; cyp = by + Math.sin(a) * len * 0.96;
					sunny = R() < 0.3; col = sunny ? mx(mul(mossC, 0.8), lightC, 0.22) : mx(mul(mossC, 0.22 + R() * 0.16), dark, 0.4);
					g.fillStyle = css(col);
					for (j = 2; j <= 26; j++) {
						t = j / 26; u = 1 - t;
						px = u * u * bx + 2 * u * t * cxp + t * t * ex; py = u * u * by + 2 * u * t * cyp + t * t * ey;
						tx = 2 * u * (cxp - bx) + 2 * t * (ex - cxp); ty = 2 * u * (cyp - by) + 2 * t * (ey - cyp); d = Math.sqrt(tx * tx + ty * ty) || 1; tx /= d; ty /= d;
						l2 = len * 0.2 * Math.sin(Math.PI * Math.pow(t, 0.72)) + 2;
						for (m = -1; m <= 1; m += 2) {
							g.beginPath(); g.moveTo(px - tx * 3.2, py - ty * 3.2); g.lineTo(px - ty * m * l2 + tx * l2 * 0.5, py + tx * m * l2 + ty * l2 * 0.5); g.lineTo(px + tx * 3.6, py + ty * 3.6); g.fill();
						}
					}
					g.strokeStyle = css(mul(col, 0.8)); g.lineWidth = 2.4; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cxp, cyp, ex, ey); g.stroke();
				}
			}, snap(sc, 560), snap(sc, 400));
		}

		// ---- a deer: a jointed outline that walks, stops to listen, and lowers its head to graze
		var deer = { x: 0, dir: 1, ph: Math.random(), gait: 1, gaitTo: 1, neck: 0.8, neckTo: 0.8, state: 1, t: 0, len: 4, stag: Math.random() < 0.5, wait: 0, ear: 0, born: false };
		var DEER_GY = 728, deerC = mx(mx(dark, barkC, 0.35), sunHaze, 0.5), deerFar = css(mx(deerC, sunHaze, 0.22)), deerRim = css(mx(lightC, WHITE, 0.2), night ? 0.3 : 0.62);
		var HIPS = [[-36, -72, 38, 42, -1], [28, -68, 34, 40, 1]], LG = [0, 0, 0, 0];
		function legPose(hip, p, gait) {
			var stride = 42, fx, fy = 0, q, l1 = hip[2], l2 = hip[3], dx, dy, d, r, a, b;
			if (p < 0.64) { fx = stride * (0.5 - p / 0.64); }
			else { q = (p - 0.64) / 0.36; fx = stride * (-0.5 + q * q * (3 - 2 * q)); fy = -13 * Math.sin(Math.PI * q) * gait; }
			dx = fx + (hip[4] > 0 ? 2 : -7); dy = fy - hip[1];
			d = Math.sqrt(dx * dx + dy * dy); r = Math.min(1, (l1 + l2 - 0.5) / d); dx *= r; dy *= r; d *= r;
			a = Math.acos(K.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); b = Math.atan2(dy, dx);
			// front legs fold forward at the knee, hind legs back at the hock
			LG[0] = hip[0] + Math.cos(b - hip[4] * a) * l1; LG[1] = hip[1] + Math.sin(b - hip[4] * a) * l1; LG[2] = hip[0] + dx; LG[3] = hip[1] + dy;
		}
		function leg(g, hip, col) {
			g.strokeStyle = col;
			g.lineWidth = hip[4] > 0 ? 8 : 10.5; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(LG[0], LG[1]); g.stroke();
			g.lineWidth = 4.4; g.beginPath(); g.moveTo(LG[0], LG[1]); g.lineTo(LG[2], LG[3] - 2); g.stroke();
		}
		function stepDeer(dt, W) {
			var D = deer;
			if (!D.born) { D.born = true; D.x = W * (0.32 + 0.3 * Math.random()); D.dir = Math.random() < 0.5 ? 1 : -1; D.len = K.rnd(3, 7); }
			D.x -= CAMV * 0.28 * dt;
			if (D.state === 0) {
				D.wait -= dt;
				if (D.wait <= 0) { D.state = 1; D.dir = Math.random() < 0.5 ? 1 : -1; D.x = D.dir > 0 ? -150 : W + 150; D.stag = Math.random() < 0.5; D.t = 0; D.len = K.rnd(5, 12); D.gait = 1; D.neck = 0.8; }
				return;
			}
			D.t += dt;
			if (D.state === 1) {
				D.gaitTo = 1; D.neckTo = 0.8;
				if (D.t > D.len && D.x > W * 0.14 && D.x < W * 0.86) { D.state = 2; D.t = 0; D.len = K.rnd(2.4, 4.6); }
				if (D.x < -180 || D.x > W + 180) { D.state = 0; D.wait = K.rnd(14, 38) / K.clamp(S.life, 0.4, 2); }
			} else if (D.state === 2) {
				// stopped, head up, listening
				D.gaitTo = 0; D.neckTo = 1;
				if (D.t > D.len) { D.t = 0; if (Math.random() < 0.6) { D.state = 3; D.len = K.rnd(3.5, 7); } else { D.state = 1; D.len = K.rnd(7, 15); } }
			} else {
				D.gaitTo = 0; D.neckTo = 0.05 + 0.03 * Math.sin(T * 3.1);
				if (D.t > D.len) { D.t = 0; D.state = 2; D.len = K.rnd(1.4, 2.6); }
			}
			D.gait += (D.gaitTo - D.gait) * Math.min(1, dt * 2.2);
			D.neck += (D.neckTo - D.neck) * Math.min(1, dt * (D.neckTo > D.neck ? 2.8 : 1.5));
			D.ear = D.state === 2 && Math.sin(T * 2.3) > 0.86 ? 0.5 : 0;
			// the body moves exactly as far as its standing feet push it, so they never slide
			D.ph = (D.ph + dt * 0.9 * D.gait) % 1;
			D.x += D.dir * 42 * 1.3 / 0.64 * 0.9 * D.gait * dt;
		}
		function drawDeer(g) {
			var D = deer, a, ex, ey, hd, px, py, hx, hy, col = css(deerC), bob = Math.sin(D.ph * TAU * 2) * 1.3 * D.gait;
			if (D.state === 0) { return; }
			g.save(); g.translate(D.x, DEER_GY); g.scale(D.dir * 1.3, 1.3);
			g.lineCap = "round"; g.lineJoin = "round";
			legPose(HIPS[0], (D.ph + 0.5) % 1, D.gait); leg(g, HIPS[0], deerFar);
			legPose(HIPS[1], (D.ph + 0.75) % 1, D.gait); leg(g, HIPS[1], deerFar);
			g.translate(0, bob);
			g.fillStyle = col;
			// tail, body, haunch and shoulder
			g.beginPath(); g.ellipse(-58, -86, 4.6, 10, 0.35, 0, TAU); g.fill();
			g.beginPath(); g.moveTo(45, -86);
			g.quadraticCurveTo(47, -105, 29, -107); g.quadraticCurveTo(0, -100, -36, -106); g.quadraticCurveTo(-57, -105, -57, -86);
			g.quadraticCurveTo(-57, -66, -40, -61); g.quadraticCurveTo(-10, -55, 22, -60); g.quadraticCurveTo(41, -64, 45, -86); g.fill();
			g.beginPath(); g.ellipse(-39, -79, 17, 23, 0.1, 0, TAU); g.ellipse(27, -81, 15, 21, -0.1, 0, TAU); g.fill();
			// neck and head
			a = -1.05 + 2.1 * D.neck; hd = -1.2 + 1.3 * D.neck;
			ex = 33 + Math.cos(a) * 58; ey = -93 - Math.sin(a) * 58; px = -Math.sin(a); py = -Math.cos(a);
			g.beginPath(); g.moveTo(20, -105); g.quadraticCurveTo((20 + ex) / 2 + px * 5, (-105 + ey) / 2 + py * 5, ex + px * 7, ey + py * 7);
			g.lineTo(ex - px * 7, ey - py * 7); g.quadraticCurveTo((46 + ex) / 2 - px * 2, (-76 + ey) / 2 - py * 2, 46, -76); g.closePath(); g.fill();
			hx = Math.cos(hd); hy = -Math.sin(hd);
			g.save(); g.translate(ex, ey); g.transform(hx, hy, -hy, hx, 0, 0);
			// (now +x runs down the muzzle and -y is the top of the head)
			g.beginPath(); g.arc(0, 0, 8.6, 0, TAU); g.fill();
			g.beginPath(); g.moveTo(-2, -8.4); g.lineTo(29, -3.6); g.quadraticCurveTo(32, 0.5, 29, 4); g.lineTo(-2, 8.4); g.closePath(); g.fill();
			g.fillStyle = deerFar; g.beginPath(); g.moveTo(-5, -5); g.quadraticCurveTo(-13, -15, -22, -21); g.quadraticCurveTo(-11, -21, -1, -8); g.fill();
			g.fillStyle = col; g.save(); g.translate(-3, -6); g.rotate(-D.ear);
			g.beginPath(); g.moveTo(-2, 1); g.quadraticCurveTo(-9, -12, -13, -22); g.quadraticCurveTo(-1, -15, 3, -1); g.fill(); g.restore();
			if (D.stag) {
				g.strokeStyle = col; g.lineWidth = 2.5;
				g.beginPath(); g.moveTo(1, -7); g.quadraticCurveTo(-16, -22, -8, -46); g.moveTo(-7, -20); g.lineTo(6, -30); g.moveTo(-10, -32); g.lineTo(3, -44); g.moveTo(-9, -40); g.lineTo(-17, -52); g.stroke();
				g.strokeStyle = deerFar; g.lineWidth = 2.1;
				g.beginPath(); g.moveTo(4, -7); g.quadraticCurveTo(-9, -24, 0, -46); g.moveTo(-1, -22); g.lineTo(11, -31); g.moveTo(-2, -34); g.lineTo(10, -45); g.stroke();
			}
			g.restore();
			// light catching the back, the neck and the top of the head
			g.strokeStyle = deerRim; g.lineWidth = 1.7;
			g.beginPath(); g.moveTo(-55, -97); g.quadraticCurveTo(-52, -105, -36, -106); g.quadraticCurveTo(0, -100, 20, -105.5);
			g.quadraticCurveTo((20 + ex) / 2 + px * 5, (-105 + ey) / 2 + py * 5, ex + px * 7, ey + py * 7); g.stroke();
			g.translate(0, -bob);
			legPose(HIPS[0], D.ph, D.gait); leg(g, HIPS[0], col);
			legPose(HIPS[1], (D.ph + 0.25) % 1, D.gait); leg(g, HIPS[1], col);
			g.restore();
		}

		// ---- birds crossing, motes in the light, falling leaves, fireflies
		var birds = [], birdWait = K.rnd(3, 9), birdC = css(mx(dark, sunHaze, 0.45));
		function drawBirds(g, dt, W) {
			var j, b, n, dir, y, f, s;
			birdWait -= dt;
			if (birdWait <= 0 && birds.length < 5) {
				n = 1 + Math.floor(Math.random() * 2.5); dir = Math.random() < 0.5 ? 1 : -1; y = K.rnd(300, 540);
				for (j = 0; j < n; j++) { birds.push({ x: dir > 0 ? -40 - j * K.rnd(50, 90) : W + 40 + j * K.rnd(50, 90), y: y + j * K.rnd(-34, 34), dir: dir, v: K.rnd(170, 230), ph: Math.random() * 9, s: K.rnd(0.8, 1.15) }); }
				birdWait = K.rnd(12, 30) / K.clamp(S.life, 0.4, 2);
			}
			g.strokeStyle = birdC; g.lineCap = "round"; g.lineJoin = "round";
			for (j = birds.length - 1; j >= 0; j--) {
				b = birds[j]; b.x += b.dir * b.v * dt; b.ph += dt * 10; b.y += Math.sin(b.ph * 0.13) * 8 * dt;
				if (b.x < -200 || b.x > W + 200) { birds.splice(j, 1); continue; }
				f = Math.sin(b.ph) * 0.9 + 0.25; s = b.s * 15;
				g.lineWidth = 2.6 * b.s;
				g.beginPath(); g.moveTo(b.x - s, b.y - s * 0.62 * f); g.quadraticCurveTo(b.x - s * 0.5, b.y - s * 0.5 * f - s * 0.16, b.x, b.y);
				g.quadraticCurveTo(b.x + s * 0.5, b.y - s * 0.5 * f - s * 0.16, b.x + s, b.y - s * 0.62 * f); g.stroke();
			}
		}
		var MN = Math.round(130 * K.clamp(S.life, 0.4, 2)), motes = new Float32Array(MN * 5), moteSpr = K.glow(css(mx(lightC, WHITE, 0.5)), 24, 0.4);
		for (i = 0; i < MN; i++) { motes[i * 5] = Math.floor(Math.random() * BEAMS.length); motes[i * 5 + 1] = Math.random() * 2 - 1; motes[i * 5 + 2] = Math.random(); motes[i * 5 + 3] = Math.random(); motes[i * 5 + 4] = Math.random() * 40; }
		var FN = night ? Math.round(34 * K.clamp(S.life, 0.4, 2)) : 0, flies = new Float32Array(FN * 4), flySpr = FN ? K.glow("#d8ff7a", 48, 0.2) : null;
		for (i = 0; i < FN * 4; i++) { flies[i] = Math.random(); }
		var LN = fall ? Math.round(30 * K.clamp(S.life, 0.4, 2)) : 0, falling = [], leafSpr = [];
		if (fall) {
			[[226, 92, 30], [244, 160, 40], [200, 54, 34], [250, 196, 70]].forEach(function (c) {
				leafSpr.push(K.bake(40, 40, function (g) { leaf(g, 20, 20, 17, 0, css(mx(c, lightC, 0.12)), css(mul(c, 0.6), 0.6)); }));
			});
			for (i = 0; i < LN; i++) { falling.push({ x: Math.random(), y: Math.random(), z: 0.35 + Math.random() * 0.65, rot: Math.random() * TAU, ph: Math.random() * 9, k: i % 4 }); }
		}
		var ferns = [], builtW = 0;
		function build(W) {
			var li, L, j, n, span;
			for (li = 0; li < LAY.length; li++) {
				L = LAY[li]; n = Math.max(2, Math.round(L.n * W / 1920)); L.m = L.sw / 2 + 12; L.span = W + 2 * L.m; L.trunks = [];
				for (j = 0; j < n; j++) { L.trunks.push({ x: -L.m + (j + 0.15 + 0.7 * Math.random()) * L.span / n, v: Math.floor(Math.random() * L.nv) }); }
			}
			n = Math.max(4, Math.round(W / (W < 1000 ? 170 : 300))); span = W + 640; ferns = [];
			for (j = 0; j < n; j++) { ferns.push({ x: -320 + (j + 0.2 + 0.6 * Math.random()) * span / n, v: j % 3, s: 0.62 + Math.random() * 0.42, ph: Math.random() * 9 }); }
			builtW = W;
		}
		function trees(g, L, k, step, whole) {
			var j, t, x;
			for (j = 0; j < L.trunks.length; j++) {
				t = L.trunks[j]; t.x -= step * L.f;
				if (t.x < -L.m) { t.x += L.span; t.v = Math.floor(Math.random() * L.nv); }
				x = t.x - L.sw / 2;
				g.drawImage(trunk(L, t.v), whole ? Math.round(x * k) / k : x, -6, snap(sc, L.sw), snap(sc, L.sh));
			}
			slide(sc, g, ground(L), cam * L.f, L.gy - 30, whole);
		}

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, dts = dt * S.speed, step = CAMV * dts, slow = !!(window.SSO_FRAMES && window.SSO_FRAMES.level() > 0), j, b, a, x, y, r, off, p, c, s, L;
			if (Math.abs(builtW - W) > 2) { build(W); }
			T += dts; cam += step;
			put(g, backdrop(), k, 0, 0);
			trees(g, LAY[0], k, step, slow);
			g.globalAlpha = (dawn ? 0.9 : 0.55); slide(sc, g, fog(0, 2300, 230), cam * 0.14 + T * 5, 520, slow); g.globalAlpha = 1;
			trees(g, LAY[1], k, step, slow);
			// the first sheet of light, behind the middle trees; it breathes as leaves move overhead
			g.globalAlpha = 0.78 + 0.2 * Math.sin(T * 0.23); slide(sc, g, shafts(0), cam * 0.24, 0, slow); g.globalAlpha = 1;
			stepDeer(dts, W); drawDeer(g);
			trees(g, LAY[2], k, step, slow);
			slide(sc, g, canopy(0), cam * 0.3 + 3 * Math.sin(T * 0.31), 2 * Math.sin(T * 0.4) - 4, slow);
			drawBirds(g, dts, W);
			g.globalAlpha = (dawn ? 0.85 : 0.5); slide(sc, g, fog(1, 2700, 300), cam * 0.45 - T * 7 + 600, 620, slow); g.globalAlpha = 1;
			g.globalAlpha = 0.8 + 0.2 * Math.sin(T * 0.19 + 2); slide(sc, g, shafts(1), cam * 0.5 + 900, 0, slow); g.globalAlpha = 1;
			// dust and pollen drifting in the beams
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < MN; j++) {
				b = BEAMS[motes[j * 5]]; off = cam * (b.sheet ? 0.5 : 0.24) + (b.sheet ? 900 : 0);
				motes[j * 5 + 2] += dts * (0.008 + 0.012 * motes[j * 5 + 3]); if (motes[j * 5 + 2] > 1) { motes[j * 5 + 2] -= 1; }
				y = motes[j * 5 + 2] * b.len * 0.92;
				x = ((b.x - off) % PER + PER) % PER; if (x > PER - 300) { x -= PER; }
				x += -SLANT * y + (motes[j * 5 + 1] + 0.22 * Math.sin(T * 0.5 + motes[j * 5 + 4])) * b.w * 0.5 * (1 + 0.7 * y / b.len);
				if (x < -10 || x > W + 10) { continue; }
				a = (1 - y / b.len) * (0.4 + 0.6 * b.a) * (0.45 + 0.55 * Math.sin(T * (0.8 + motes[j * 5 + 3]) + motes[j * 5 + 4]));
				if (a < 0.04) { continue; }
				r = 3 + 6 * motes[j * 5 + 3] * (b.sheet ? 1.3 : 0.8);
				g.globalAlpha = Math.min(1, a); g.drawImage(moteSpr, x - r / 2, y - r / 2, r, r);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			trees(g, LAY[3], k, step, slow);
			if (FN) {
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < FN; j++) {
					a = Math.sin(T * (0.7 + flies[j * 4 + 2] * 0.9) + flies[j * 4 + 3] * 30); if (a < 0.1) { continue; }
					x = (((flies[j * 4] * (W + 200) - cam * 0.5) % (W + 200)) + W + 200) % (W + 200) - 100 + 40 * Math.sin(T * 0.4 + j); y = 470 + flies[j * 4 + 1] * 470 + 26 * Math.sin(T * 0.53 + j * 1.7);
					r = 12 + 20 * flies[j * 4 + 2];
					g.globalAlpha = a * a; g.drawImage(flySpr, x - r / 2, y - r / 2, r, r);
				}
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
			for (j = 0; j < LN; j++) {
				p = falling[j]; p.y += dts * (0.03 + 0.05 * p.z); p.rot += dts * (0.8 + p.z);
				if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
				x = (((p.x * (W + 200) - cam * p.z + 60 * Math.sin(T * 0.6 + p.ph)) % (W + 200)) + W + 200) % (W + 200) - 100; y = p.y * 1080;
				c = Math.cos(p.rot) * k * p.z * 1.2; s = Math.sin(p.rot) * k * p.z * 1.2;
				g.setTransform(c, s, -s * Math.cos(T * 1.3 + p.ph), c * Math.cos(T * 1.3 + p.ph), k * x, k * (y - sc.top)); g.drawImage(leafSpr[p.k], -20, -20);
			}
			g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			slide(sc, g, canopy(1), cam * 0.8 + 5 * Math.sin(T * 0.27 + 1), 3 * Math.sin(T * 0.33) - 6, slow);
			put(g, glare(), k, lightU * W - 500, -150);
			// ferns in front of everything, stirring
			for (j = 0; j < ferns.length; j++) {
				p = ferns[j]; p.x -= step * 1.05;
				if (p.x < -330) { p.x += W + 660; p.v = Math.floor(Math.random() * 3); p.s = 0.62 + Math.random() * 0.42; }
				L = fern(p.v); a = 0.03 * Math.sin(T * 0.7 + p.ph) + 0.012 * Math.sin(T * 1.7 + p.ph * 2);
				c = Math.cos(a) * k * p.s; s = Math.sin(a) * k * p.s;
				g.setTransform(c, s, -s, c, k * p.x, k * (1100 - sc.top)); g.drawImage(L, -280, -394, 560, 400);
			}
			g.setTransform(k, 0, 0, k, 0, -sc.top * k);
			if (dawn) { g.globalAlpha = 0.5; slide(sc, g, fog(2, 3100, 340), cam * 0.9 + T * 12, 780, slow); g.globalAlpha = 1; }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "hab-forest", label: "Habitat: old forest with light shafts", colors: ["3f8f3a", "ffe8a6", "cfe8c4"], start: startForest });
	// ================================================================ 3. lava fields at night
	// The moving lava is two small textures that tile both ways: the glowing melt, and rafts of dark skin riding on it.
	// Both are painted a few rows a frame (see pixelJob).
	function meltTex(n, ramp) {
		return pixelJob(n, n, function (x, y, o) {
			var u = x / n, v = y / n, wx = tfbm(u * 4, v * 3, 4, 3, 5, 3) - 0.5, wy = tfbm(u * 4, v * 3, 4, 3, 9, 3) - 0.5;
			var a = tfbm(u * 6 + wx * 2.2, v * 3 + wy * 1.4, 6, 3, 13, 4), b = tfbm(u * 12 + wy * 2, v * 5 + wx * 2, 12, 5, 21, 3);
			var heat = K.clamp(0.14 + 0.6 * ss(0.3, 0.74, a) + 0.46 * Math.pow(1 - Math.abs(2 * b - 1), 5), 0, 1), t = heat * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(t)), c = mx(ramp[i], ramp[i + 1], t - i);
			o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 255;
		});
	}
	// Plates of cooled skin with cracks between them. cover = how much of the surface they hide (0..1).
	function skinTex(n, cells, cover, c, edge) {
		var R = K.seeded("skin" + cells), fx = [], fy = [], keep = [], i;
		for (i = 0; i < cells * cells; i++) { fx.push(R()); fy.push(R()); keep.push(R() < cover); }
		return pixelJob(n, n, function (x, y, o) {
			var cyN = Math.round(cells * 0.62), u = x / n * cells, v = y / n * cyN, cx, cy, d1 = 9, d2 = 9, id = 0, dx, dy, gx, gy, j, d, a, k2, m;
			u += (tfbm(x / n * 8, y / n * 8, 8, 8, 3, 2) - 0.5) * 0.5; v += (tfbm(x / n * 8, y / n * 8, 8, 8, 7, 2) - 0.5) * 0.5;
			cx = Math.floor(u); cy = Math.floor(v);
			for (gy = -1; gy <= 1; gy++) {
				for (gx = -1; gx <= 1; gx++) {
					j = (((cy + gy) % cyN) + cyN) % cyN * cells + (((cx + gx) % cells) + cells) % cells;
					dx = cx + gx + fx[j] - u; dy = cy + gy + fy[j] - v; d = Math.sqrt(dx * dx + dy * dy);
					if (d < d1) { d2 = d1; d1 = d; id = j; } else if (d < d2) { d2 = d; }
				}
			}
			a = keep[id] ? ss(0.035, 0.11, d2 - d1) : 0;
			// plates are a little paler toward the middle, and glow faintly red at their edges
			k2 = ss(0.11, 0.3, d2 - d1); m = mx(edge, mul(c, 0.8 + 0.5 * ihash(id, 3, 5)), k2);
			o[0] = m[0]; o[1] = m[1]; o[2] = m[2]; o[3] = 255 * a * 0.96;
		});
	}
	function startLava(host, o) {
		var S = settings(o, ["orange", "blue", "grey", "dusk"]), sc = K.scene(host, { fps: 30, quality: S.sharp });
		var mood = S.mood, grey = mood === "grey", dusk = mood === "dusk", lay = S.layout, skyC = S.c1, lavaC = S.c2, hotC = S.c3, T = Math.random() * 300, i;
		var HZ = lay === "top" ? 500 : 430, GY0 = HZ + 4, GH = 1080 - GY0, coneU = lay === "split" ? 0.72 : lay === "center" ? 0.3 : lay === "top" ? 0.86 : lay === "corner" ? 0.7 : 0.64;
		var airK = grey ? 0.36 : 1, rockC = grey ? mx(mul(skyC, 0.62), [30, 30, 33], 0.5) : mx(mul(skyC, dusk ? 0.16 : 0.32), [15, 13, 16], 0.6), hazeC = mx(mul(lavaC, 0.5 * airK), mul(skyC, grey ? 1.1 : 0.6), grey ? 0.6 : 0.35), widthK = grey ? 0.5 : 1;
		var RAMP = [mul(lavaC, 0.1), mul(lavaC, 0.34), mul(lavaC, 0.72), lavaC, mx(lavaC, hotC, 0.55), hotC, mx(hotC, WHITE, 0.5)];
		var melt = meltTex(288, RAMP), skin = skinTex(288, grey ? 7 : 6, grey ? 0.93 : 0.4, mx(rockC, mul(lavaC, 0.12), 0.3), mul(lavaC, grey ? 0.55 : 0.4));
		// each texture laid out several times across and twice down, so one strip of it can always be cut in a single piece
		function tiled(tex) {
			return K.bake(tex.width * 5, tex.height * 2, function (g) { var x, y; for (y = 0; y < 2; y++) { for (x = 0; x < 5; x++) { g.drawImage(tex, x * tex.width, y * tex.height); } } });
		}
		var meltT = null, skinT = null, TEX = 288, lavaIn = 0;
		// The ground is drawn in bands from the far plain to our feet; each shows a taller, faster-moving slice of the
		// textures than the one behind, which is what makes the lava come toward us.
		var BANDS = [];
		(function () {
			var y = 0, h = 5, t, sv, V = 0;
			while (y < GH) {
				h = Math.min(GH - y, h); t = (y + h / 2) / GH; sv = 0.3 + 2 * Math.pow(t, 1.5);
				BANDS.push({ y: y, h: h, sv: sv, V: V });
				V += h / sv; y += h; h *= 1.115;
			}
		})();
		var flowCv = null, flowG = null, flowW = 0;
		function drawFlow(W, k) {
			var fw = Math.ceil(W * k / 2), fh = Math.ceil(GH * k / 2), j, b, v, dv, su = 1.5, g, x, mw = meltT.width * su, sw = skinT.width * su * 1.12;
			if (!flowCv || flowCv.width !== fw || flowCv.height !== fh) { flowCv = K.canvas(fw, fh); flowG = flowCv.getContext("2d"); flowW = W; }
			g = flowG;
			if (!g) { return false; }
			g.setTransform(fw / W, 0, 0, fh / GH, 0, 0);
			// each strip is repeated across until it covers the picture, however wide that is
			for (j = 0; j < BANDS.length; j++) {
				b = BANDS[j]; dv = b.h / b.sv;
				v = (((b.V - T * 17) % TEX) + TEX) % TEX;
				for (x = -40; x < W; x += mw) { g.drawImage(meltT, 0, v, meltT.width, dv, x, b.y, mw + 0.5, b.h + 0.6); }
			}
			for (j = 0; j < BANDS.length; j++) {
				b = BANDS[j]; dv = b.h / b.sv;
				v = (((b.V * 0.9 - T * (grey ? 4 : 9)) % TEX) + TEX) % TEX;
				for (x = -130; x < W; x += sw) { g.drawImage(skinT, 0, v, skinT.width, dv * 0.9, x, b.y, sw, b.h + 0.6); }
			}
			return true;
		}
		// How deep into lava a point of the ground is: 0 = solid rock, 1 = the middle of a river or pool. x across the
		// picture, yy = how far below the horizon.
		function lavaAt(x, yy, W) {
			var Z = 650 / yy, X = (x - coneU * W + (coneU - 0.5) * W * Math.min(1, 1.6 / Z)) * Z / 650, n, r, m, p, far = ss(8, 2.5, Z);
			n = tfbm(X * 1.05 + 3.1, Z * 0.44 + 7.7, 0, 0, 91, 4); r = 1 - Math.abs(2 * n - 1);
			m = (X - 0.4 * Math.sin(Z * 0.82 + 0.5) - 0.1 * Math.sin(Z * 2.3 + 1)) / (0.2 * widthK * (0.75 + 0.5 * tfbm(Z * 1.3, 0.5, 0, 0, 17, 2)));
			p = tfbm(X * 0.55 + 21, Z * 0.34 + 5, 0, 0, 37, 3);
			return Math.max(ss(0.9 - 0.075 * widthK - 0.011 * Math.min(Z, 9), 0.985, r) * (0.25 + 0.75 * far), ss(1.25, 0.35, Math.abs(m)), ss(0.64, 0.74, p) * widthK * (0.5 + 0.5 * far)) * ss(10, 44, yy);
		}
		var hot = [];      // places on the lava where sparks may rise
		// The rock and its channels are the slowest thing here to work out, so that is done a few rows a frame, and at a
		// size that follows the shape of the picture and not the canvas resolution: when the load governor lowers the
		// resolution, nothing has to be worked out again.
		var cj = null;
		function crustJob(W) {
			var H = GH, lw = Math.max(8, Math.round(W / 2.2)), lh = Math.round(H / 2.2), Lmap = new Float32Array(lw * lh), edgeC = mul(lavaC, 0.66), J;
			hot = [];
			J = pixelJob(lw, lh, function (px, py, out) {
				var x = (px + 0.5) / lw * W, y = (py + 0.5) / lh * H, yy = y + GY0 - HZ, Z = 650 / yy, X = (x - W / 2) * Z / 650, L = lavaAt(x, yy, W);
				var tex = tfbm(X * 7 + 5, Z * 4.2 + 3, 0, 0, 55, 4), tex2 = tfbm(X * 26, Z * 15, 0, 0, 57, 2), far = ss(2.5, 11, Z), glow = ss(0, 0.42, L), wide = tfbm(X * 0.55 + 21, Z * 0.34 + 5, 0, 0, 37, 3), c, al;
				Lmap[py * lw + px] = L;
				// rock: rough, darker in its hollows, fading into the red haze far off, lit on the banks by the lava beside it
				c = mul(rockC, 0.55 + 2.5 * tex * tex + 0.9 * (tex2 - 0.5) * (1 - far));
				c = mx(c, mul(lavaC, 0.55), (0.06 + 0.2 * ss(0.4, 0.66, wide)) * airK);
				c = mx(c, hazeC, far * 0.86);
				c = mx(c, mx(lavaC, hotC, 0.25), glow * glow * 0.8);
				if (L > 0.42) { c = mx(c, mul(edgeC, 0.5 + 1.1 * tex), ss(0.42, 0.54, L)); }
				al = 1 - ss(0.46, 0.86, L);
				out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = 255 * al;
				if (L > 0.86 && yy > 60 && hot.length < 780 && ihash(px, py, 7) < 0.004) { hot.push(x, y + GY0, yy / 650); }
			});
			J.W = W; J.lw = lw; J.lh = lh; J.Lmap = Lmap;
			return J;
		}
		function crust() {
			return layer(sc, "crust", function (g, W, H) {
				var lw = cj.lw, lh = cj.lh, Lmap = cj.Lmap, R = K.seeded("lavacracks"), j, x, y, a, len, s, gr, n;
				g.imageSmoothingQuality = "high";
				g.drawImage(cj.cv, 0, 0, W, H);
				// cracks and ledges in the rock, larger toward us
				g.lineCap = "round";
				for (j = 0; j < 420; j++) {
					x = R() * W; y = H * Math.pow(R(), 1.5); s = 0.12 + 0.9 * (y + 30) / (H + 30); a = (R() - 0.5) * 1.1; len = (14 + R() * 60) * s; n = R();
					if (Lmap[Math.min(lh - 1, Math.floor(y / H * lh)) * lw + Math.min(lw - 1, Math.floor(x / W * lw))] > 0.2) { continue; }
					g.strokeStyle = css(mul(rockC, 0.3), 0.5); g.lineWidth = (0.8 + R() * 1.6) * s;
					g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.26 + (R() - 0.5) * 6 * s); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.3); g.stroke();
					if (n < 0.5) {
						g.strokeStyle = css(mx(mul(rockC, 2.2), lavaC, 0.25), 0.3); g.lineWidth = 0.9 * s;
						g.beginPath(); g.moveTo(x, y + 1.6 * s); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.3 + 1.6 * s); g.stroke();
					}
				}
				// the far plain swims in firelit haze
				gr = g.createLinearGradient(0, 0, 0, 150);
				gr.addColorStop(0, css(mx(hazeC, lavaC, 0.45), 0.96)); gr.addColorStop(0.16, css(mx(hazeC, lavaC, 0.3), 0.7)); gr.addColorStop(0.5, css(hazeC, 0.3)); gr.addColorStop(1, css(hazeC, 0));
				g.fillStyle = gr; g.fillRect(0, 0, W, 150);
			}, sc.W, snap(sc, GH));
		}
		// the sky, the cone and its lit smoke, the far ridges
		var crater = [0, 0];
		function backdrop() {
			return layer(sc, "sky", function (g, W, H) {
				var gr = g.createLinearGradient(0, 0, 0, H), R = K.seeded("lavasky"), cx = coneU * W, top = HZ - 250, hw = 540, j, x, y, r, dx, t, cw = 38;
				var skyTop = dusk ? mul(skyC, 0.5) : mul(skyC, 0.3), skyMid = dusk ? mx(skyC, lavaC, 0.18) : mx(mul(skyC, 0.5), mul(lavaC, 0.22), 0.4 * airK), skyLow = dusk ? mx(mx(skyC, lavaC, 0.6), hotC, 0.25) : mx(mul(lavaC, 0.52), skyC, grey ? 0.72 : 0.2);
				gr.addColorStop(0, css(skyTop)); gr.addColorStop(0.5, css(skyMid)); gr.addColorStop(0.86, css(skyLow)); gr.addColorStop(1, css(mx(skyLow, hotC, 0.2)));
				g.fillStyle = gr; g.fillRect(0, 0, W, H);
				for (j = 0; j < (dusk ? 240 : 110); j++) {
					y = R() * R() * (HZ - 90); x = R() * W; r = R() < 0.1 ? 1.8 : 1.1;
					g.fillStyle = css(WHITE, (0.25 + R() * 0.6) * (1 - y / (HZ - 60))); g.fillRect(x, y, r, r);
				}
				// the glow of the crater on the smoke and air above it
				r = g.createRadialGradient(cx, top - 30, 0, cx, top - 30, 420);
				r.addColorStop(0, css(mx(lavaC, hotC, 0.5), 0.75)); r.addColorStop(0.25, css(lavaC, 0.36)); r.addColorStop(0.6, css(lavaC, 0.1)); r.addColorStop(1, css(lavaC, 0));
				g.fillStyle = r; g.fillRect(cx - 430, top - 450, 860, 860);
				// far ridges, then the cone
				for (j = 0; j < 2; j++) {
					g.fillStyle = css(mx(mul(rockC, 0.8), skyLow, j ? 0.36 : 0.55));
					g.beginPath(); g.moveTo(0, H);
					for (x = 0; x <= W + 12; x += 12) { g.lineTo(x, HZ - 8 - (j ? 34 : 70) * tfbm(x / 300 + j * 9, j * 3.3, 0, 0, 77, 4) * (0.5 + 0.5 * ss(0, 1100, Math.abs(x - cx)))); }
					g.lineTo(W, H); g.closePath(); g.fill();
				}
				function slope(x) { dx = Math.abs(x - cx); t = Math.max(0, 1 - (dx - cw) / (hw - cw)); return HZ + 4 - (HZ - top) * Math.pow(t, 1.5) * (dx < cw ? 1 : 1) + 5 * (tfbm(x / 40, 0.5, 0, 0, 78, 3) - 0.5) * (1 - t) * 4; }
				gr = g.createLinearGradient(0, top, 0, HZ);
				gr.addColorStop(0, css(mx(mul(rockC, 0.75), lavaC, 0.16))); gr.addColorStop(0.25, css(mul(rockC, 0.62))); gr.addColorStop(1, css(mx(mul(rockC, 0.7), skyLow, 0.3)));
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(cx - hw - 60, H);
				for (x = cx - hw - 60; x <= cx + hw + 60; x += 6) {
					y = slope(x);
					if (Math.abs(x - cx) < cw) { y = top + 9 - 8 * Math.cos((x - cx) / cw * Math.PI) + 3 * Math.sin(x * 0.7); }
					g.lineTo(x, y);
				}
				g.lineTo(cx + hw + 60, H); g.closePath(); g.fill();
				// lava spilling down its flanks
				g.lineCap = "round"; g.lineJoin = "round";
				[[-10, -0.62, 0.9], [14, 0.5, 0.74], [2, -0.12, 1]].forEach(function (q) {
					var pts = [], n2, px = cx + q[0], py = top + 12, pass;
					for (n2 = 0; n2 < 26; n2++) {
						pts.push(px, py);
						py += (HZ - top) * q[2] / 26; px += q[1] * (HZ - top) / 26 * (1.1 + n2 * 0.09) + (tfbm(n2 * 0.6, q[0], 0, 0, 80, 2) - 0.5) * 16;
					}
					for (pass = 0; pass < 3; pass++) {
						g.strokeStyle = pass === 0 ? css(lavaC, 0.22) : pass === 1 ? css(lavaC, 0.85) : css(mx(hotC, WHITE, 0.3), 0.95);
						g.lineWidth = pass === 0 ? 11 : pass === 1 ? 3.4 : 1.3;
						g.beginPath(); g.moveTo(pts[0], pts[1]);
						for (n2 = 2; n2 < pts.length; n2 += 2) { g.lineTo(pts[n2], pts[n2 + 1]); }
						g.stroke();
					}
				});
				// the crater's lip, lit from inside
				r = g.createRadialGradient(cx, top + 6, 0, cx, top + 6, 90);
				r.addColorStop(0, css(mx(hotC, WHITE, 0.4), 0.95)); r.addColorStop(0.3, css(lavaC, 0.6)); r.addColorStop(1, css(lavaC, 0));
				g.fillStyle = r; g.fillRect(cx - 90, top - 84, 180, 180);
				crater[0] = cx; crater[1] = top + 4;
				// the line of the far plain: a thread of fire along the horizon
				gr = g.createLinearGradient(0, HZ - 44, 0, HZ + 6);
				gr.addColorStop(0, css(lavaC, 0)); gr.addColorStop(0.8, css(mx(lavaC, hotC, 0.3), 0.42)); gr.addColorStop(1, css(mx(hazeC, lavaC, 0.45)));
				g.fillStyle = gr; g.fillRect(0, HZ - 44, W, 52);
				grain(g, W, H, 0.035);
			}, sc.W, snap(sc, GY0 + 2));
		}
		// dark rock close to us along the bottom, its edges catching the glow
		function rocks() {
			return layer(sc, "rocks", function (g, W, H) {
				var R = K.seeded("lavarocks" + lay), full = lay === "bottom", x, y, j, pts, gr, e;
				function edge(xx) {
					e = full ? 0.75 : Math.max(ss(0.34 * W, 0, xx), ss(W - 0.3 * W, W, xx));
					return H - (40 + 190 * e * (0.45 + 0.75 * tfbm(xx / 150, 2.2, 0, 0, 61, 3))) + 28 * (tfbm(xx / 22, 4.4, 0, 0, 63, 2) - 0.5);
				}
				pts = [];
				for (x = -10; x <= W + 10; x += 9) { pts.push(x, edge(x)); }
				gr = g.createLinearGradient(0, H - 250, 0, H);
				gr.addColorStop(0, css(mul(rockC, 0.72))); gr.addColorStop(1, css(mul(rockC, 0.3)));
				g.fillStyle = gr; g.beginPath(); g.moveTo(-10, H);
				for (j = 0; j < pts.length; j += 2) { g.lineTo(pts[j], pts[j + 1]); }
				g.lineTo(W + 10, H); g.closePath(); g.fill();
				g.save(); g.clip();
				g.imageSmoothingQuality = "high";
				g.drawImage(pixels(240, 36, function (px, py, out) {
					var t = tfbm(px / 9, py / 5, 0, 0, 65, 3), c = t > 0.5 ? mx(mul(rockC, 2.2), lavaC, 0.14) : mul(rockC, 0.1);
					out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = 255 * Math.abs(t - 0.5) * 1.3;
				}), 0, 0, W, H);
				j = R();
				g.restore();
				// firelight along the top edges
				g.lineJoin = "round";
				g.strokeStyle = css(lavaC, 0.26); g.lineWidth = 8; g.beginPath(); g.moveTo(pts[0], pts[1] + 3);
				for (j = 2; j < pts.length; j += 2) { g.lineTo(pts[j], pts[j + 1] + 3); } g.stroke();
				g.strokeStyle = css(mx(lavaC, hotC, 0.35), 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(pts[0], pts[1]);
				for (j = 2; j < pts.length; j += 2) { g.lineTo(pts[j], pts[j + 1]); } g.stroke();
			}, sc.W, snap(sc, 290));
		}
		// ---- smoke, sparks, ash
		var smokeTex = [fogTex(41, mx(mul(rockC, 1.6), mul(lavaC, 0.34), 0.5), 320, 96, 5, 2, 0.34, 0.8), fogTex(47, mul(rockC, 1.1), 320, 96, 4, 2, 0.3, 0.78)];
		function smoke(j, bw, h) { return layer(sc, "smoke" + j, function (g, w, hh) { g.imageSmoothingQuality = "high"; g.drawImage(smokeTex[j], 0, 0, w, hh); }, snap(sc, bw), snap(sc, h), true); }
		var puffs = K.particles(96), puffSpr = [puff(128, mx(mul(rockC, 2.6), mul(lavaC, 0.62), 0.6), 0.6, 0.2), puff(128, mx(mul(rockC, 2.4), mul(skyC, 0.8), 0.4), 0.55, 0.2)], puffAcc = 0;
		puffs.step = function (p, dt) { p.vx += (p.data - p.vx) * dt * 0.25; p.vy *= 1 - 0.1 * dt; };
		var sparks = K.particles(140), sparkSpr = [K.glow(css(lavaC), 24, 0.3), K.glow(css(hotC), 24, 0.4)], craterGlow = K.glow(css(mx(lavaC, hotC, 0.4)), 256, 0.12);
		var burst = 0, burstWait = K.rnd(3, 7), burstAcc = 0;
		var EN = Math.round(70 * K.clamp(S.life, 0.3, 2)), emb = new Float32Array(EN * 6), embAlive = false;
		var AN = Math.round((grey ? 90 : 34) * K.clamp(S.life, 0.4, 2)), ash = new Float32Array(AN * 4), ashSpr = puff(16, grey ? [190, 186, 184] : mx([150, 140, 140], lavaC, 0.3), 0.8, 0.4);
		for (i = 0; i < AN * 4; i++) { ash[i] = Math.random(); }
		function newEmber(j) {
			var n = hot.length / 3, q;
			if (!n) { emb[j * 6 + 4] = 0; return; }
			q = Math.floor(Math.random() * n) * 3;
			emb[j * 6] = hot[q] + K.rnd(-8, 8); emb[j * 6 + 1] = hot[q + 1]; emb[j * 6 + 2] = hot[q + 2]; emb[j * 6 + 3] = Math.random() * 9; emb[j * 6 + 4] = 0.001; emb[j * 6 + 5] = K.rnd(2.5, 6);
		}

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, dts = dt * S.speed, j, p, a, x, y, r, z, L, B, n;
			T += dts;
			B = backdrop();
			if (!cj || Math.abs(cj.W - W) > 2) { cj = crustJob(W); sc.drop("crust"); }
			work([cj, melt, skin], 8);
			if (!meltT && melt.done && skin.done) { meltT = tiled(melt.cv); skinT = tiled(skin.cv); }
			put(g, B, k, 0, 0);
			// heat shimmer over the far plain: thin slices of the picture shifted from side to side
			for (j = 0; j < 22; j++) {
				y = HZ - 86 + j * 4; a = 1.7 * Math.sin(T * 3.4 + j * 0.9) * Math.sin(Math.PI * j / 22);
				g.drawImage(B, 0, y * B.height / B.hu, B.width, 4 * B.height / B.hu, a, y, B.wu, 4);
			}
			// smoke rolling off the cone, lit from beneath
			puffAcc += dts;
			if (puffAcc > 0.26) {
				puffAcc = 0; p = puffs.spawn();
				if (p) { p.x = crater[0] + K.rnd(-22, 22); p.y = crater[1] - 12; p.vx = K.rnd(-5, 8); p.vy = K.rnd(-34, -22); p.data = K.rnd(16, 34); p.life = K.rnd(15, 22); p.img = puffSpr[Math.random() < 0.55 ? 0 : 1]; p.size = K.rnd(50, 80); p.grow = K.rnd(16, 26); p.a = 0.8; p.fade = 0.75; p.rot = Math.random() * 6; p.vr = K.rnd(-0.1, 0.1); }
			}
			puffs.update(dts); puffs.draw(g);
			g.globalAlpha = 0.8; slide(sc, g, smoke(0, 2500, 250), -T * 6, HZ - 300, false);
			g.globalAlpha = 0.6; slide(sc, g, smoke(1, 3100, 300), -T * 10 + 700, 20, false); g.globalAlpha = 1;
			// the cone throws a fountain now and then
			burstWait -= dts;
			if (burstWait <= 0) { burst = K.rnd(1.6, 3.2); burstWait = K.rnd(9, 24) / K.clamp(S.life, 0.4, 2); }
			if (burst > 0) {
				burst -= dts; burstAcc += dts * 46;
				while (burstAcc >= 1) {
					burstAcc -= 1; p = sparks.spawn();
					if (p) { a = K.rnd(-0.5, 0.5); r = K.rnd(120, 300); p.x = crater[0] + K.rnd(-12, 12); p.y = crater[1] - 4; p.vx = Math.sin(a) * r; p.vy = -Math.cos(a) * r; p.grav = 150; p.drag = 0.25; p.life = K.rnd(1.6, 3.2); p.img = sparkSpr[Math.random() < 0.5 ? 0 : 1]; p.size = K.rnd(5, 11); p.add = true; p.fade = 0.5; }
				}
			}
			sparks.update(dts); sparks.draw(g);
			g.globalCompositeOperation = "lighter";
			a = 0.5 + 0.12 * Math.sin(T * 2.3) * Math.sin(T * 0.7) + (burst > 0 ? 0.4 : 0); r = 300 + (burst > 0 ? 120 : 0);
			g.globalAlpha = Math.min(1, a); g.drawImage(craterGlow, crater[0] - r / 2, crater[1] - r / 2 - 10, r, r);
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			// for the first moments, while the ground is being worked out, the plain is dark rock; then the lava glows up through it
			if (lavaIn < 1) { g.fillStyle = css(mx(rockC, hazeC, 0.35)); g.fillRect(0, GY0, W, GH); }
			if (cj.done) {
				if (meltT && drawFlow(W, k)) { lavaIn = Math.min(1, lavaIn + dt * 2.2); g.globalAlpha = lavaIn; g.drawImage(flowCv, 0, GY0, W, GH); g.globalAlpha = 1; }
				put(g, crust(), k, 0, GY0);
			}
			// sparks lifting off the lava, ash sifting down
			g.globalCompositeOperation = "lighter";
			if (!embAlive && hot.length) { embAlive = true; for (j = 0; j < EN; j++) { newEmber(j); emb[j * 6 + 4] = Math.random() * emb[j * 6 + 5]; } }
			for (j = 0; j < EN; j++) {
				if (!embAlive) { break; }
				emb[j * 6 + 4] += dts;
				if (emb[j * 6 + 4] > emb[j * 6 + 5]) { newEmber(j); }
				z = emb[j * 6 + 2]; a = emb[j * 6 + 4] / emb[j * 6 + 5];
				x = emb[j * 6] + (30 * Math.sin(T * 1.3 + emb[j * 6 + 3]) + 60 * a) * z; y = emb[j * 6 + 1] - (24 + 260 * a * (0.6 + 0.4 * Math.sin(emb[j * 6 + 3]))) * z;
				r = (3 + 9 * z) * (1 - 0.5 * a);
				g.globalAlpha = Math.sin(Math.PI * Math.min(1, a * 1.15)) * (0.6 + 0.4 * Math.sin(T * 9 + emb[j * 6 + 3] * 7));
				g.drawImage(sparkSpr[j % 2], x - r / 2, y - r / 2, r, r);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			for (j = 0; j < AN; j++) {
				z = 0.3 + 0.7 * ash[j * 4 + 2];
				x = (((ash[j * 4] + T * 0.006 * z + 0.02 * Math.sin(T * 0.4 + j)) % 1) + 1) % 1 * (W + 40) - 20; y = (((ash[j * 4 + 1] + T * (0.012 + 0.016 * z)) % 1) + 1) % 1 * 1100 - 10;
				r = 2 + 5 * z;
				g.globalAlpha = 0.2 + 0.4 * z; g.drawImage(ashSpr, x - r / 2, y - r / 2, r, r);
			}
			g.globalAlpha = 1;
			L = rocks(); put(g, L, k, 0, 1080 - L.hu);
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "hab-lava", label: "Habitat: lava fields at night", colors: ["2a1a26", "ff5a14", "ffd45a"], start: startLava });
	// ================================================================ 4. planet rising over a moon
	// Noise in three dimensions, so a world can be textured over its whole sphere without a seam or a pinch at the poles.
	function ihash3(x, y, z, s) {
		var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1911520717) ^ Math.imul(s | 0, 1274126177);
		h = Math.imul(h ^ (h >>> 13), 1103515245);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	function noise3(x, y, z, s) {
		var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
		var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
		var a = ihash3(xi, yi, zi, s), b = ihash3(xi + 1, yi, zi, s), c = ihash3(xi, yi + 1, zi, s), d = ihash3(xi + 1, yi + 1, zi, s);
		var e = ihash3(xi, yi, zi + 1, s), f = ihash3(xi + 1, yi, zi + 1, s), g2 = ihash3(xi, yi + 1, zi + 1, s), h = ihash3(xi + 1, yi + 1, zi + 1, s);
		a += (b - a) * u; c += (d - c) * u; e += (f - e) * u; g2 += (h - g2) * u;
		a += (c - a) * v; e += (g2 - e) * v;
		return a + (e - a) * w;
	}
	function fbm3(x, y, z, s, oct) {
		var v = 0, a = 0.5, sum = 0, i;
		for (i = 0; i < oct; i++) { v += a * noise3(x, y, z, s + i * 17); sum += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
		return v / sum;
	}
	// The face of a world, unrolled: longitude across (it wraps), and down the picture the sine of the latitude, which is
	// how a globe seen from far off lays its rows. Only the top `rows` are painted (the rest never rises above the moon).
	// Gives three strips, each laid out twice across so any half-turn can be cut out in one piece: the ground, the
	// cloud over it, and whatever glows in the dark. Painting a whole world takes a while, so it is done a few columns
	// at a time: step(ms) works for about that long; `ready` once the half that faces us (from column x0) is there.
	function worldTex(kind, mainC, airC, TW, TH, rows, x0) {
		var surf = K.canvas(TW * 2, rows), cloud = K.canvas(TW * 2, rows), glowC = K.canvas(TW * 2, rows);
		var gs = surf.getContext("2d"), gc = cloud.getContext("2d"), gl = glowC.getContext("2d");
		if (!gs || !gc || !gl) { return { ready: false, done: true, dead: true, step: function () {} }; }
		var is = gs.createImageData(1, rows), ic = gc.createImageData(1, rows), il = gl.createImageData(1, rows), ds = is.data, dc = ic.data, dl = il.data, nDone = 0, nFirst = 0, HALF = TW / 2 + 12, out, SL = new Float32Array(rows), CL = new Float32Array(rows);
		var y, i, s, c, lon, cl0, sl0, px, py, pz, h, m, e, col, n, r, a, t, cl, lat;
		for (y = 0; y < rows; y++) { SL[y] = 1 - 2 * (y + 0.5) / TH; CL[y] = Math.sqrt(Math.max(0, 1 - SL[y] * SL[y])); }
		var deep = mul(mainC, 0.42), shallow = mx(mainC, WHITE, 0.25), rust = mainC, pale = mx(mainC, WHITE, 0.55), darkC = mul(mainC, 0.5);
		var BAND = [mx(mainC, WHITE, 0.62), mainC, mx(mul(mainC, 0.62), [120, 60, 40], 0.3), mx(mainC, WHITE, 0.4), mul(mainC, 0.8), mx(mainC, airC, 0.5)];
		function column(x, twice) {
			lon = x / TW * TAU; cl0 = Math.cos(lon); sl0 = Math.sin(lon); i = 0;
			for (y = 0; y < rows; y++) {
				s = SL[y]; c = CL[y]; lat = Math.abs(s); px = c * cl0; py = s; pz = c * sl0;
				cl = 0; dl[i + 3] = 0;
				if (kind === "earth") {
					h = fbm3(px * 2.1 + 5, py * 2.1, pz * 2.1, 3, 6) + 0.028 * (noise3(px * 70, py * 70, pz * 70, 19) - 0.5); m = fbm3(px * 3.4, py * 3.4 + 9, pz * 3.4, 23, 3);
					if (h < 0.515) { col = mx(shallow, deep, ss(0, 0.1, 0.515 - h)); }
					else {
						e = (h - 0.515) / 0.25;
						col = mx([74, 128, 62], [196, 168, 112], ss(0.42, 0.62, m + 0.25 * (0.4 - Math.abs(lat - 0.3))));
						col = mx(col, [44, 92, 52], ss(0.56, 0.3, m) * 0.6);
						col = mx(col, [128, 112, 98], ss(0.3, 0.9, e));
						col = mx(col, [240, 244, 248], ss(0.75, 1.1, e + lat * 0.5));
						// towns and cities, mostly on low ground near the sea
						n = fbm3(px * 6, py * 6, pz * 6 + 4, 41, 3);
						if (e < 0.5 && ihash(x, y, 9) < 0.5 * ss(0.47, 0.7, n) * ss(0.55, 0.05, e)) { dl[i] = 255; dl[i + 1] = 206 + 40 * ihash(x, y, 4); dl[i + 2] = 130; dl[i + 3] = 255 * (0.5 + 0.5 * ihash(x, y, 5)); }
					}
					col = mx(col, mx([236, 244, 250], airC, 0.08), ss(0.85, 0.885, lat + 0.16 * (m - 0.5)));
					if (lat + 0.16 * (m - 0.5) > 0.86) { dl[i + 3] = 0; }
					n = fbm3(px * 3.3 + 2 * (m - 0.5), py * 4.2 + 1.2 * (h - 0.5), pz * 3.3, 61, 5) + 0.04 * (noise3(px * 60, py * 60, pz * 60, 29) - 0.5);
					cl = ss(0.55, 0.76, n + 0.07 * Math.sin(py * 8)) * 0.9;
					dc[i] = 250; dc[i + 1] = 252; dc[i + 2] = 255;
				} else if (kind === "gas") {
					t = fbm3(px * 2.4, py * 9, pz * 2.4, 5, 4) - 0.5; m = fbm3(px * 6, py * 22, pz * 6, 15, 3) - 0.5;
					h = (s + t * 0.09 + m * 0.02) * 9.5 + 20; n = Math.floor(h); e = h - n; e = e * e * (3 - 2 * e);
					col = mx(BAND[((n % 6) + 6) % 6], BAND[(((n + 1) % 6) + 6) % 6], e);
					col = mul(col, 0.86 + 0.3 * (fbm3(px * 5, py * 30, pz * 5, 31, 2)));
					// one great storm, and smaller pale ones
					a = wrapPi(lon - 2.2) * c / 0.26; r = (s + 0.3) / 0.085; r = a * a + r * r;
					if (r < 1.6) { col = mx(col, mx([196, 74, 44], mainC, 0.35), ss(1.6, 0.5, r) * 0.9); col = mx(col, pale, ss(0.5, 0, r) * 0.4); }
					col = mx(col, mx(mainC, airC, 0.6), ss(0.78, 0.98, lat) * 0.7);
					n = fbm3(px * 1.8, py * 14 + 3, pz * 1.8, 71, 3);
					cl = ss(0.52, 0.78, n) * 0.4; dc[i] = pale[0]; dc[i + 1] = pale[1]; dc[i + 2] = pale[2];
				} else if (kind === "desert") {
					h = fbm3(px * 2.3 + 2, py * 2.3, pz * 2.3, 7, 5); m = fbm3(px * 5, py * 5, pz * 5, 27, 3); r = 1 - Math.abs(2 * fbm3(px * 3.2, py * 3.2 + 5, pz * 3.2, 33, 3) - 1);
					col = mx(darkC, rust, ss(0.36, 0.56, h)); col = mx(col, mx(rust, [236, 196, 150], 0.6), ss(0.56, 0.78, h) * 0.8);
					col = mul(col, 0.82 + 0.36 * m);
					col = mx(col, mul(darkC, 0.62), ss(0.95, 0.99, r) * 0.5 + ss(0.8, 0.96, r) * 0.12);
					col = mx(col, [244, 238, 232], ss(0.885, 0.915, lat + 0.1 * (m - 0.5)));
					n = fbm3(px * 2 + 3, py * 4, pz * 2, 63, 3);
					cl = ss(0.56, 0.8, n) * 0.5; dc[i] = 232; dc[i + 1] = 190; dc[i + 2] = 150;
				} else if (kind === "ice") {
					h = fbm3(px * 2.2, py * 2.2 + 3, pz * 2.2, 11, 4); r = 1 - Math.abs(2 * fbm3(px * 3, py * 3, pz * 3 + 8, 35, 4) - 1); m = 1 - Math.abs(2 * fbm3(px * 7, py * 7 + 2, pz * 7, 37, 3) - 1);
					col = mx([244, 250, 255], mx(mainC, [120, 170, 210], 0.4), ss(0.35, 0.75, h) * 0.75);
					col = mx(col, mul(mx(mainC, [40, 110, 160], 0.6), 0.75), Math.max(ss(0.9, 0.98, r), ss(0.93, 0.99, m) * 0.6));
					n = fbm3(px * 2.4, py * 5, pz * 2.4 + 6, 65, 3);
					cl = ss(0.55, 0.8, n) * 0.55; dc[i] = 255; dc[i + 1] = 255; dc[i + 2] = 255;
				} else {
					// a world of fire: black crust, the cracks and seas between its plates glowing
					h = fbm3(px * 2.4 + 4, py * 2.4, pz * 2.4, 13, 5); r = 1 - Math.abs(2 * fbm3(px * 3.4, py * 3.4, pz * 3.4 + 3, 39, 4) - 1); m = fbm3(px * 9, py * 9, pz * 9, 43, 2);
					e = Math.max(ss(0.87, 0.97, r), ss(0.58, 0.66, h));
					col = mul([46, 34, 36], 0.5 + 1.1 * m); col = mx(col, mul(mainC, 0.5), ss(0.7, 0.9, r) * 0.5 + ss(0.5, 0.6, h) * 0.4);
					col = mx(col, mainC, e);
					if (e > 0.02) { a = mx(mainC, airC, e * (0.3 + 0.7 * m)); dl[i] = a[0]; dl[i + 1] = a[1]; dl[i + 2] = a[2]; dl[i + 3] = 255 * e; }
					n = fbm3(px * 2, py * 3 + 7, pz * 2, 67, 3);
					cl = ss(0.56, 0.8, n) * 0.45; dc[i] = 40; dc[i + 1] = 30; dc[i + 2] = 34;
				}
				ds[i] = col[0]; ds[i + 1] = col[1]; ds[i + 2] = col[2]; ds[i + 3] = 255; dc[i + 3] = 255 * cl;
				i += 4;
			}
			for (y = 0; y < (twice ? 2 : 1); y++) {
				gs.putImageData(is, x, 0); gs.putImageData(is, x + TW, 0);
				gc.putImageData(ic, x, 0); gc.putImageData(ic, x + TW, 0);
				gl.putImageData(il, x, 0); gl.putImageData(il, x + TW, 0);
				x = (x + 1) % TW;
			}
		}
		out = {
			surf: surf, cloud: cloud, glow: glowC, lit: kind === "earth" || kind === "lava", ready: false, done: false,
			step: function (ms) {
				// first every second column of the half that faces us, each used twice (a picture to show quickly, at half the
				// detail across); then every column of the whole map, which sharpens it and fills in the far side
				var until = performance.now() + ms, q;
				do {
					for (q = 0; q < 4; q++) {
						if (nFirst < HALF) { column((((x0 + nFirst) % TW) + TW) % TW, true); nFirst += 2; }
						else if (nDone < TW) { column((((x0 + nDone) % TW) + TW) % TW, false); nDone++; }
					}
				} while (nDone < TW && performance.now() < until);
				out.ready = nFirst >= HALF; out.done = nDone >= TW;
			}
		};
		return out;
	}
	function startPlanet(host, o) {
		var S = settings(o, ["earth", "gas", "desert", "ice", "lava"]), sc = K.scene(host, { fps: 30, quality: S.sharp, maxPixels: 2100000 });
		var mood = S.mood, gas = mood === "gas", fire = mood === "lava", lay = S.layout, groundC = S.c1, worldC = S.c2, airC = S.c3, T = 0, T0 = Math.random() * 600, i;
		var HZ = 772, RP = 560, TW = 2048, TH = 512, STRIPS = 56;
		var tilt = gas ? -0.2 : mood === "earth" ? 0.2 : mood === "ice" ? -0.12 : 0.1;
		var pu = lay === "split" ? 0.73 : lay === "center" ? 0.5 : lay === "top" ? 0.6 : 0.63, topY = lay === "center" ? 470 : lay === "top" ? 330 : 64;
		var sunC = fire ? mx(worldC, WHITE, 0.45) : [255, 250, 240], SUN = [-0.8, 0.27, -0.54];
		var tex = null, frames = 0, shown = 0, C = null, Cg = null, B = null, Bg = null, P = null, Pg = null, shade = null, shadeG = null, shadeImg = null, discM = null, limb = null, geoK = 0, lastUpd = -9, rot = Math.random() * TAU, spin = 0, planetOK = false, pk = 1;
		// the planet is painted into buffers of its own, never more than about 1.2 megapixels each however large the canvas
		// (a tall thin source has a huge scale but shows a sliver), and drawn back at the size it stands for
		var PKMAX = Math.sqrt(1200000 / (2 * RP * Math.min(2 * RP, HZ + 14 - topY)));
		// how far up the planet has come: it starts lower and eases up over the first couple of minutes
		function centreY() { return topY + RP + 150 * Math.exp(-T / 45); }
		function drumH() { var yc = Math.min(RP, HZ + 14 - topY - RP); return Math.min(2 * RP, RP + yc * Math.cos(tilt) + Math.sqrt(Math.max(0, RP * RP - yc * yc)) * Math.abs(Math.sin(tilt)) + 4); }

		// ---- the sky: stars, and the pale band of the galaxy
		function sky() {
			return layer(sc, "sky", function (g, W, H) {
				var R = K.seeded("stars" + mood), j, x, y, r, a, c, n = Math.round(W * 1.15), lw = Math.max(40, Math.round(W / 6)), lh = 180;
				g.fillStyle = "#020308"; g.fillRect(0, 0, W, H);
				g.imageSmoothingQuality = "high";
				g.drawImage(pixels(lw, lh, function (px, py, out) {
					var u = px / lw * W / 1080, v = py / lh, d = (v - 0.2 - 0.34 * u) * 2.6, band = Math.exp(-d * d * 3), nn = tfbm(u * 5 + 3, v * 5, 0, 0, 5, 4), dust = tfbm(u * 9, v * 9 + 4, 0, 0, 8, 3);
					var k2 = band * (0.25 + 0.9 * nn) * (0.55 + 0.6 * ss(0.35, 0.6, dust)), cc = mx(mx([70, 84, 140], airC, 0.25), [190, 170, 190], nn * band);
					out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2]; out[3] = 255 * Math.min(0.3, k2 * 0.2);
				}), 0, 0, W, H);
				for (j = 0; j < n * 2; j++) {
					x = R() * W; y = R() * (HZ + 20); a = Math.pow(R(), 3.2); r = 0.6 + a * 1.5; c = R();
					// the second half of the stars crowd along the galaxy
					if (j >= n) { y = (0.2 + 0.34 * x / 1080 + (R() + R() + R() - 1.5) * 0.14) * 1080; a *= 0.5; r = 0.5 + a; if (y < 0 || y > HZ + 20) { continue; } }
					g.fillStyle = css(c < 0.2 ? [190, 208, 255] : c < 0.34 ? [255, 224, 190] : WHITE, 0.3 + 0.7 * a + 0.2 * R());
					g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.fill();
				}
			});
		}
		var TWN = 34, twk = new Float32Array(TWN * 4), twSpr = K.glow("#dfe8ff", 32, 0.22);
		for (i = 0; i < TWN * 4; i++) { twk[i] = Math.random(); }

		// ---- the ground we stand on: pale dust in low sunlight, craters, a few rocks, a lander with its lamp
		var beacon = [0, 0];
		// the skyline, worked out once for every unit across and read from that list afterwards
		var HZC = null, HZW = -1;
		function horizon(x) {
			var n, i, q;
			if (HZW !== sc.W) {
				HZW = sc.W; n = Math.ceil(sc.W) + 24; HZC = new Float32Array(n);
				for (i = 0; i < n; i++) { q = i - 10; HZC[i] = HZ - 26 * tfbm(q / 430 + 3, 0.7, 0, 0, 71, 3) - 7 * tfbm(q / 60, 1.9, 0, 0, 73, 2); }
			}
			x += 10; i = Math.floor(x);
			if (i < 0) { return HZC[0]; }
			if (i >= HZC.length - 1) { return HZC[HZC.length - 1]; }
			return HZC[i] + (HZC[i + 1] - HZC[i]) * (x - i);
		}
		// The lie of the ground and the light on it are worked out a few rows a frame, at a size that follows the shape of
		// the picture and not the canvas resolution (so a change of resolution does not start it again).
		var gj = null, GTOP = HZ - 44, groundIn = 0;
		function groundJob(W) {
			var H = 1080 - GTOP, top = GTOP, lw = Math.max(8, Math.round(W / 2)), lh = Math.round(H / 2), Hm = new Float32Array(lw * lh), ln = Math.sqrt(SUN[0] * SUN[0] + SUN[1] * SUN[1] + SUN[2] * SUN[2]), ly = SUN[1] / ln;
			var shadowC = mx(mul(groundC, 0.05), mul(airC, 0.07), 0.5), litC = lit(groundC, sunC), py = 0, shade = null, J = { W: W, cv: null, done: false, step: null };
			J.step = function (ms) {
				var until = performance.now() + ms, px, x, y, yy, Z, X;
				// gentle rises and hollows; flat far off, where single hills are read from the skyline instead
				while (py < lh) {
					for (px = 0; px < lw; px++) {
						x = (px + 0.5) / lw * W; y = (py + 0.5) / lh * H + top; yy = Math.max(2, y - horizon(x) + 5); Z = 260 / yy; X = (x - W / 2) * Z / 260;
						Hm[py * lw + px] = (0.5 * tfbm(X * 0.7 + 11, Z * 0.7 + 5, 0, 0, 3, 3) + 0.022 * tfbm(X * 5, Z * 5, 0, 0, 9, 2)) * ss(7, 2, Z);
					}
					py++;
					if (performance.now() >= until) { return false; }
				}
				if (!shade) {
					shade = pixelJob(lw, lh, function (qx, qy, out) {
					var x2 = (qx + 0.5) / lw * W, y2 = (qy + 0.5) / lh * H + top, yy2 = Math.max(2, y2 - horizon(x2) + 5), Z2 = 260 / yy2, X2 = (x2 - W / 2) * Z2 / 260, u = W / lw;
					var hx = (Hm[qy * lw + Math.min(lw - 1, qx + 1)] - Hm[qy * lw + Math.max(0, qx - 1)]) / (2 * Z2 / 260 * u) * 0.62, hz = (Hm[Math.max(0, qy - 1) * lw + qx] - Hm[Math.min(lh - 1, qy + 1) * lw + qx]) / (2 * Z2 * Z2 / 260 * u) * 0.62;
					// far off, the slope of the skyline itself says which way the ground faces
					hx += (horizon(x2 - 6) - horizon(x2 + 6)) / 12 * 0.9 * ss(60, 8, yy2);
					var lam = (-hx * SUN[0] + SUN[1] - hz * SUN[2]) / (Math.sqrt(hx * hx + 1 + hz * hz) * ln), b = ss(-0.03, 0.1, lam) * Math.min(1.3, 0.22 + 0.78 * lam / ly) * 0.72;
					var alb = 0.8 + 0.3 * tfbm(X2 * 0.45 + 40, Z2 * 0.45, 0, 0, 13, 3), cc = mx(shadowC, mul(litC, alb), b);
					out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2]; out[3] = 255;
					});
					J.cv = shade.cv;
				}
				J.done = shade.step(Math.max(1, until - performance.now()));
				return J.done;
			};
			return J;
		}
		function ground() {
			var top = GTOP;
			return layer(sc, "ground", function (g, W, H) {
				var R = K.seeded("moon" + mood + lay), x, y, yy, Z, j, n, rx, ry, gr, s, shadowC = mx(mul(groundC, 0.05), mul(airC, 0.07), 0.5), litC = lit(groundC, sunC), q, hgt, len, cnt, a, pts;
				// everything below the skyline
				g.save();
				g.beginPath(); g.moveTo(0, H);
				for (x = 0; x <= W + 4; x += 4) { g.lineTo(x, horizon(x) - top); }
				g.lineTo(W, H); g.closePath(); g.clip();
				g.imageSmoothingQuality = "high";
				g.drawImage(gj.cv, 0, 0, W, H);
				grain(g, W, H, 0.06);
				// craters, seen at a low angle so each is a thin ellipse: the wall under the sun in black shadow, the far wall
				// bright, a lit lip toward the sun and a little shadow thrown beyond
				cnt = Math.round(130 * Math.max(0.5, W / 1920));
				for (j = 0; j < cnt; j++) {
					x = R() * W; q = Math.pow(R(), 1.5); yy = 10 + q * (1080 - HZ + 6); y = horizon(x) - top + yy; Z = 260 / yy;
					rx = (5 + Math.pow(R(), 3.2) * 120) * Math.min(1, 0.12 + yy / 300) + 1.5; ry = rx * K.clamp(0.34 / Math.pow(Z, 0.75), 0.08, 0.3);
					gr = g.createRadialGradient(x, y / (ry / rx), rx * 0.9, x, y / (ry / rx), rx * 1.5);
					gr.addColorStop(0, css(mul(litC, 1.1), 0.5)); gr.addColorStop(1, css(mul(litC, 1.1), 0));
					g.save(); g.scale(1, ry / rx); g.fillStyle = gr; g.fillRect(x - rx * 1.5, y / (ry / rx) - rx * 1.5, rx * 3, rx * 3); g.restore();
					g.fillStyle = css(shadowC, 0.7); g.beginPath(); g.ellipse(x + rx * 0.16, y + ry * 0.05, rx * 1.03, ry * 1.04, 0, -1.2, 1.2); g.fill();
					g.fillStyle = css(mul(litC, 1.22)); g.beginPath(); g.ellipse(x - rx * 0.03, y - ry * 0.03, rx * 1.02, ry * 1.04, 0, 0, TAU); g.fill();
					gr = g.createLinearGradient(x - rx, 0, x + rx, 0);
					gr.addColorStop(0, css(shadowC)); gr.addColorStop(0.42, css(shadowC)); gr.addColorStop(0.6, css(mul(litC, 0.42))); gr.addColorStop(0.9, css(mul(litC, 0.98))); gr.addColorStop(1, css(mul(litC, 1.16)));
					g.fillStyle = gr; g.beginPath(); g.ellipse(x + rx * 0.015, y + ry * 0.07, rx * 0.95, ry * 0.9, 0, 0, TAU); g.fill();
				}
				// boulders, each throwing a long shadow away from the sun
				cnt = Math.round(15 * Math.max(0.5, W / 1920));
				for (j = 0; j < cnt; j++) {
					x = R() * W; q = Math.pow(R(), 0.8); yy = 46 + q * (1080 - HZ - 40); y = horizon(x) - top + yy; s = (4 + R() * R() * 30) * (0.25 + 0.75 * yy / 300); hgt = s * (0.7 + R() * 0.5); len = hgt * 4.6;
					pts = [];
					for (n = 0; n < 7; n++) { a = Math.PI + n / 6 * Math.PI; pts.push(x + Math.cos(a) * s * (0.8 + 0.3 * R()), y + Math.sin(a) * hgt * (0.75 + 0.35 * R())); }
					g.fillStyle = css(shadowC, 0.94); g.beginPath(); g.moveTo(x - s * 0.3, y + s * 0.1); g.lineTo(x + len, y - hgt * 0.1); g.lineTo(x + len * 0.96, y + s * 0.06); g.lineTo(x + s * 0.7, y + s * 0.2); g.closePath(); g.fill();
					g.fillStyle = css(shadowC); g.beginPath(); g.moveTo(pts[0], pts[1]);
					for (n = 2; n < pts.length; n += 2) { g.lineTo(pts[n], pts[n + 1]); }
					g.lineTo(x + s * 0.5, y + s * 0.2); g.lineTo(x - s * 0.6, y + s * 0.16); g.closePath(); g.fill();
					g.fillStyle = css(mul(litC, 1.16)); g.beginPath(); g.moveTo(pts[0], pts[1]); g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.lineTo(pts[6], pts[7]); g.lineTo(x - s * 0.05, y + s * 0.18); g.lineTo(x - s * 0.6, y + s * 0.16); g.closePath(); g.fill();
				}
				// a lander, small and far, its feet in the dust
				x = W * (pu > 0.55 ? 0.2 : 0.8); y = horizon(x) - top + 74; s = 0.62;
				g.fillStyle = css(shadowC, 0.92); g.beginPath(); g.moveTo(x - 10 * s, y); g.lineTo(x + 330 * s, y - 8 * s); g.lineTo(x + 330 * s, y - 2 * s); g.lineTo(x + 30 * s, y + 5 * s); g.closePath(); g.fill();
				g.strokeStyle = css(mul(litC, 0.9)); g.lineWidth = 3 * s; g.lineCap = "round";
				g.beginPath(); g.moveTo(x - 18 * s, y - 30 * s); g.lineTo(x - 38 * s, y); g.moveTo(x + 18 * s, y - 30 * s); g.lineTo(x + 38 * s, y); g.moveTo(x - 44 * s, y); g.lineTo(x - 32 * s, y); g.moveTo(x + 32 * s, y); g.lineTo(x + 44 * s, y); g.stroke();
				g.fillStyle = css(mx([214, 170, 80], litC, 0.3)); g.beginPath(); g.moveTo(x - 26 * s, y - 28 * s); g.lineTo(x - 30 * s, y - 50 * s); g.lineTo(x - 16 * s, y - 62 * s); g.lineTo(x + 2 * s, y - 62 * s); g.lineTo(x + 2 * s, y - 28 * s); g.closePath(); g.fill();
				g.fillStyle = css(shadowC); g.beginPath(); g.moveTo(x + 2 * s, y - 62 * s); g.lineTo(x + 16 * s, y - 62 * s); g.lineTo(x + 30 * s, y - 50 * s); g.lineTo(x + 26 * s, y - 28 * s); g.lineTo(x + 2 * s, y - 28 * s); g.closePath(); g.fill();
				g.fillStyle = css(mul(litC, 1.1)); g.fillRect(x - 12 * s, y - 80 * s, 10 * s, 18 * s); g.fillStyle = css(shadowC); g.fillRect(x - 2 * s, y - 80 * s, 10 * s, 18 * s);
				g.strokeStyle = css(mul(litC, 0.9)); g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(x + 4 * s, y - 80 * s); g.lineTo(x + 10 * s, y - 112 * s); g.stroke();
				g.fillStyle = css(mul(litC, 1.1)); g.beginPath(); g.ellipse(x - 22 * s, y - 86 * s, 12 * s, 5 * s, -0.5, 0, TAU); g.fill();
				beacon[0] = x + 10 * s; beacon[1] = top + y - 113 * s;
				g.restore();
				// the lit edge of the skyline, a hair of light against the black
				g.strokeStyle = css(mul(litC, 0.9), 0.5); g.lineWidth = 1.2; g.beginPath();
				for (x = 0; x <= W + 4; x += 4) { if (x) { g.lineTo(x, horizon(x) - top + 0.6); } else { g.moveTo(x, horizon(x) - top + 0.6); } }
				g.stroke();
			}, sc.W, snap(sc, 1080 - top));
		}
		// ---- the planet
		function makeGeo(k) {
			var Rp = Math.round(RP * k), W2 = 2 * Rp, PH = Math.min(W2, Math.ceil((HZ + 14 - topY) * k)), gr, j;
			var CH = Math.min(W2, Math.ceil(drumH() * k));
			C = K.canvas(W2, CH); Cg = C.getContext("2d"); B = K.canvas(W2, CH); Bg = B.getContext("2d"); P = K.canvas(W2, PH); Pg = P.getContext("2d");
			shade = K.canvas(W2, 1); shadeG = shade.getContext("2d"); shadeImg = shadeG ? shadeG.createImageData(W2, 1) : null;
			geoK = k; lastUpd = -9; planetOK = !!(Cg && Bg && Pg && shadeImg);
			if (!planetOK) { return; }
			discM = K.bake(W2, PH, function (c) { c.fillStyle = "#fff"; c.beginPath(); c.arc(Rp, Rp, Rp - 0.75, 0, TAU); c.fill(); });
			// what lies over the globe and does not turn with it: the dark creeping in at the limb, the thin bright line of air
			// on the sunward edge, the shadow of the ring
			limb = K.bake(W2, PH, function (c) {
				gr = c.createRadialGradient(Rp, Rp, Rp * 0.55, Rp, Rp, Rp);
				gr.addColorStop(0, "rgba(0,2,10,0)"); gr.addColorStop(0.75, "rgba(0,2,10,0.16)"); gr.addColorStop(1, "rgba(0,2,10,0.62)");
				c.fillStyle = gr; c.fillRect(0, 0, W2, PH);
				if (gas) {
					c.save(); c.translate(Rp, Rp); c.rotate(tilt);
					for (j = 0; j < 3; j++) { c.strokeStyle = "rgba(6,4,10," + (j === 1 ? 0.46 : 0.26) + ")"; c.lineWidth = Rp * (j === 1 ? 0.06 : 0.03); c.beginPath(); c.ellipse(0, Rp * 0.1, Rp * (1.5 + j * 0.24), Rp * (0.3 + j * 0.05), 0, Math.PI + 0.1, TAU - 0.1); c.stroke(); }
					c.restore();
				}
				var rim = K.bake(W2, PH, function (d) {
					var rg = d.createRadialGradient(Rp, Rp, Rp * 0.8, Rp, Rp, Rp);
					rg.addColorStop(0, css(airC, 0)); rg.addColorStop(0.6, css(airC, 0.16)); rg.addColorStop(0.92, css(mx(airC, WHITE, 0.2), 0.6)); rg.addColorStop(1, css(mx(airC, WHITE, 0.6), 0.95));
					d.fillStyle = rg; d.fillRect(0, 0, W2, PH);
					d.translate(Rp, Rp); d.rotate(tilt);
					rg = d.createLinearGradient(-Rp * 0.5, 0, Rp * 0.7, 0); rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,0,1)");
					d.globalCompositeOperation = "destination-out"; d.fillStyle = rg; d.fillRect(-Rp * 2, -Rp * 2, Rp * 4, Rp * 4);
				});
				c.drawImage(rim, 0, 0);
			});
			geoK = k; lastUpd = -9;
		}
		// the glow of its air against the black, on the sunward side
		function halo() {
			return layer(sc, "halo", function (g, w, h) {
				var r = w / 2, gr = g.createRadialGradient(r, r, RP * 0.985, r, r, r);
				gr.addColorStop(0, css(mx(airC, WHITE, 0.3), 0.62)); gr.addColorStop(0.12, css(airC, 0.3)); gr.addColorStop(0.4, css(airC, 0.1)); gr.addColorStop(1, css(airC, 0));
				g.fillStyle = gr; g.fillRect(0, 0, w, h);
				g.translate(r, r); g.rotate(tilt);
				gr = g.createLinearGradient(-RP * 0.3, 0, RP * 0.8, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
				g.globalCompositeOperation = "destination-out"; g.fillStyle = gr; g.fillRect(-w, -w, w * 2, w * 2);
			}, snap(sc, RP * 2.44), snap(sc, Math.min(RP * 2.44, HZ + 20 - topY + RP * 0.22)), true);
		}
		function updatePlanet(k) {
			var Rp = Math.round(RP * k), W2 = 2 * Rp, CH = C.height, j, x0, x1, l0, l1, u0, du, d, a, beta = 1.22 + 0.24 * Math.sin((T + T0) * 0.011), sd = shadeImg.data, lit2, w, y, bh, ct = Math.cos(tilt), sn = Math.sin(tilt), q;
			var turn = rot / TAU * TW, turnC = turn + spin * 0.0036 / TAU * TW;
			// the globe unrolled onto a drum: strips of the map, each the same slice of longitude, so narrow toward the edges
			// where the surface turns away
			for (j = 0; j < STRIPS; j++) {
				x0 = Math.round(Rp * (1 - Math.cos(j / STRIPS * Math.PI))); x1 = Math.round(Rp * (1 - Math.cos((j + 1) / STRIPS * Math.PI)));
				if (x1 <= x0) { continue; }
				l0 = Math.asin(K.clamp(x0 / Rp - 1, -1, 1)); l1 = Math.asin(K.clamp(x1 / Rp - 1, -1, 1));
				u0 = (((l0 / TAU * TW + turn) % TW) + TW) % TW; du = (l1 - l0) / TAU * TW;
				Cg.drawImage(tex.surf, u0, 0, du, CH * TH / W2, x0, 0, x1 - x0, CH);
				u0 = (((l0 / TAU * TW + turnC) % TW) + TW) % TW;
				Cg.drawImage(tex.cloud, u0, 0, du, CH * TH / W2, x0, 0, x1 - x0, CH);
			}
			// day and night: one row of shading, stretched down the drum. The edge of night drifts slowly.
			for (j = 0; j < W2; j++) {
				d = Math.cos(Math.asin(K.clamp((j + 0.5) / Rp - 1, -1, 1)) + beta); lit2 = ss(-0.12, 0.3, d) * (0.4 + 0.6 * Math.pow(Math.max(0, d), 0.75));
				a = ss(0.24, -0.02, d) * ss(-0.3, -0.02, d);
				sd[j * 4] = 3 + 16 * a * (fire ? 0.3 : 1); sd[j * 4 + 1] = 5 + 5 * a; sd[j * 4 + 2] = 14; sd[j * 4 + 3] = 255 * Math.min(0.955, 1 - lit2);
			}
			shadeG.putImageData(shadeImg, 0, 0);
			Cg.drawImage(shade, 0, 0, W2, 1, 0, 0, W2, CH);
			if (tex.lit) {
				// lights on the night side (and on a world of fire, everywhere)
				Cg.globalCompositeOperation = "lighter";
				for (j = 0; j < STRIPS; j++) {
					x0 = Math.round(Rp * (1 - Math.cos(j / STRIPS * Math.PI))); x1 = Math.round(Rp * (1 - Math.cos((j + 1) / STRIPS * Math.PI)));
				if (x1 <= x0) { continue; }
					l0 = Math.asin(K.clamp(x0 / Rp - 1, -1, 1)); l1 = Math.asin(K.clamp(x1 / Rp - 1, -1, 1));
					d = Math.cos((l0 + l1) / 2 + beta); a = fire ? 0.55 + 0.45 * ss(0.3, -0.1, d) : ss(0.08, -0.2, d);
					if (a < 0.02) { continue; }
					u0 = (((l0 / TAU * TW + turn) % TW) + TW) % TW; du = (l1 - l0) / TAU * TW;
					Cg.globalAlpha = a; Cg.drawImage(tex.glow, u0, 0, du, CH * TH / W2, x0, 0, x1 - x0, CH);
				}
				Cg.globalAlpha = 1; Cg.globalCompositeOperation = "source-over";
			}
			// ...and the drum pressed into a ball: each band of rows drawn as wide as the globe is at that height
			Bg.clearRect(0, 0, W2, CH);
			for (y = 0; y < CH; y += bh) {
				q = y / Rp; bh = q < 0.22 ? 1 : q < 0.5 ? 2 : 3; if (y + bh > CH) { bh = CH - y; }
				d = y + bh / 2 - Rp; w = Math.sqrt(Math.max(0, Rp * Rp - d * d));
				if (w < 1) { continue; }
				Bg.drawImage(C, 0, y, W2, bh, Rp - w, y, 2 * w, bh);
			}
			Pg.setTransform(1, 0, 0, 1, 0, 0); Pg.globalCompositeOperation = "source-over"; Pg.clearRect(0, 0, P.width, P.height);
			Pg.setTransform(ct, sn, -sn, ct, Rp, Rp); Pg.drawImage(B, -Rp, -Rp);
			Pg.setTransform(1, 0, 0, 1, 0, 0);
			Pg.globalCompositeOperation = "destination-in"; Pg.drawImage(discM, 0, 0);
			Pg.globalCompositeOperation = "source-atop"; Pg.drawImage(limb, 0, 0);
			Pg.globalCompositeOperation = "source-over";
		}
		// rings: many thin bands of ice, each an arc drawn in a squashed frame (so it is wide at the sides and thin where it
		// crosses in front). We look up at them from below, so the near half arches over the planet's face; the far half is
		// drawn before the planet. Where a band passes into the planet's shadow it dims, then goes dark.
		var RINGS = [];
		(function () {
			var R = K.seeded("rings"), r = 1.27, w, a;
			while (r < 2.3) {
				w = 0.022 + R() * 0.07; a = r > 1.78 && r < 1.86 ? 0.05 : R() < 0.16 ? 0.1 : 0.3 + R() * 0.55;
				RINGS.push([r + w / 2, w, mx(mx(worldC, WHITE, 0.5 + R() * 0.2), airC, R() * 0.5), a * (r < 1.4 ? 0.5 : 1)]);
				r += w + 0.003;
			}
		})();
		// Each half is painted once (hundreds of wide arcs are far too much to draw every frame) and laid down turned to the planet's tilt.
		var RING_W = 2 * 2.31 * RP + 8, RING_H = 2.31 * RP * 0.2 + 6;
		function ringHalf(front) {
			return layer(sc, "ring" + (front ? 1 : 0), function (g, w, h) {
				var j, r, gr;
				g.translate(w / 2, front ? h : 0); g.scale(1, 0.2);
				for (j = 0; j < RINGS.length; j++) {
					r = RINGS[j]; g.lineWidth = r[1] * RP; g.strokeStyle = css(front ? r[2] : mul(r[2], 0.9), r[3]);
					g.beginPath(); if (front) { g.arc(0, 0, r[0] * RP, Math.PI, TAU); } else { g.arc(0, 0, r[0] * RP, 0, Math.PI); } g.stroke();
				}
				// the planet's shadow: a dark lane as wide as the planet, running away from the sun across the rings
				gr = g.createLinearGradient(0, -RP, 0, RP);
				gr.addColorStop(0, "rgba(3,3,8,0)"); gr.addColorStop(0.07, "rgba(3,3,8,0.93)"); gr.addColorStop(0.93, "rgba(3,3,8,0.93)"); gr.addColorStop(1, "rgba(3,3,8,0)");
				g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(RP * 0.25, -RP, RP * 2.3, RP * 2); g.globalCompositeOperation = "source-over";
			}, snap(sc, RING_W), snap(sc, RING_H));
		}
		function rings(g, cx, cy, front) {
			var L = ringHalf(front), k = sc.k, w = L.wu, h = L.hu;
			g.save(); g.translate(cx, cy); g.rotate(tilt); g.drawImage(L, -w / 2, front ? -h : 0, w, h); g.restore();
		}
		// small moons going round
		var moonSpr = K.bake(64, 64, function (g) {
			var gr = g.createRadialGradient(22, 26, 2, 32, 32, 30);
			gr.addColorStop(0, css(lit(mx(groundC, WHITE, 0.5), sunC))); gr.addColorStop(0.5, css(lit(mul(groundC, 0.8), sunC))); gr.addColorStop(0.82, css(mul(groundC, 0.1))); gr.addColorStop(1, css(mul(groundC, 0.03)));
			g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill();
			g.fillStyle = "rgba(0,0,0,0.16)"; g.beginPath(); g.arc(24, 24, 6, 0, TAU); g.arc(36, 40, 4, 0, TAU); g.arc(20, 40, 3, 0, TAU); g.fill();
		});
		var MOONS = gas ? [[2.5, 0.011, 2.4, 30]] : [[1.38, 0.016, 2.5, 34], [1.9, 0.009, 5.4, 20]];
		function moons(g, cx, cy, front) {
			var j, m, a, x, y, ct = Math.cos(tilt), sn = Math.sin(tilt), ex, ey;
			for (j = 0; j < MOONS.length; j++) {
				m = MOONS[j]; a = m[2] + (T + T0) * m[1];
				if ((Math.sin(a) > 0) !== front) { continue; }
				ex = Math.cos(a) * m[0] * RP; ey = Math.sin(a) * m[0] * RP * 0.2; x = cx + ex * ct - ey * sn; y = cy + ex * sn + ey * ct;
				g.drawImage(moonSpr, x - m[3] / 2, y - m[3] / 2, m[3], m[3]);
			}
		}
		// a satellite crossing, catching the sun for a moment
		var sat = { t: 4, len: 0, x0: 0, y0: 0, x1: 0, y1: 0, flare: 0.5 }, satSpr = K.glow("#ffffff", 40, 0.2), lampSpr = K.glow("#ff4a3a", 48, 0.2);

		sc.onresize = function () { geoK = 0; };
		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, dts = dt * S.speed, j, a, x, y, r, cx = pu * W, cy, L, slow = !!(window.SSO_FRAMES && window.SSO_FRAMES.level() > 0);
			T += dts; frames++;
			// the planet and its cloud stand still until the whole map is painted, so neither can turn to a part not there yet
			if (tex && tex.done) { rot += dts * 0.0145; spin += dts; }
			cy = centreY();
			put(g, sky(), k, 0, 0);
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < TWN; j++) {
				a = 0.5 + 0.5 * Math.sin((T + T0) * (0.6 + 2.2 * twk[j * 4 + 2]) + twk[j * 4 + 3] * 40); r = 7 + 12 * twk[j * 4 + 2] * a;
				g.globalAlpha = 0.25 + 0.75 * a; g.drawImage(twSpr, twk[j * 4] * W - r / 2, twk[j * 4 + 1] * twk[j * 4 + 1] * (HZ - 40) - r / 2, r, r);
			}
			// the satellite
			sat.t -= dts;
			if (sat.t <= 0 && sat.len <= 0) { sat.len = K.rnd(26, 40); sat.t = sat.len; sat.x0 = K.rnd(-0.1, 0.5) * W; sat.y0 = K.rnd(40, 330); sat.x1 = sat.x0 + K.rnd(0.5, 0.9) * W; sat.y1 = sat.y0 + K.rnd(-120, 160); sat.flare = K.rnd(0.25, 0.75); }
			if (sat.len > 0) {
				a = 1 - sat.t / sat.len; x = sat.x0 + (sat.x1 - sat.x0) * a; y = sat.y0 + (sat.y1 - sat.y0) * a;
				r = Math.exp(-Math.pow((a - sat.flare) / 0.035, 2)); j = 5 + 22 * r;
				g.globalAlpha = Math.min(1, (0.3 + 0.7 * r) * Math.sin(Math.PI * a) * 1.6); g.drawImage(satSpr, x - j / 2, y - j / 2, j, j);
				if (sat.t <= 0) { sat.len = 0; sat.t = K.rnd(20, 60) / K.clamp(S.life, 0.4, 2); }
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			// the planet, painted on the second frame (its map takes a moment) and then brought up out of the dark
			// first the ground is worked out, then the planet's map: a slice of each frame, never the whole frame
			if (!gj || Math.abs(gj.W - W) > 2) { gj = groundJob(W); sc.drop("ground"); groundIn = 0; }
			if (!gj.done) { gj.step(8); }
			else if (tex && !tex.done) { tex.step(tex.ready ? 5 : 8); }
			else if (!tex) { tex = worldTex(mood, worldC, airC, TW, TH, Math.min(TH, Math.ceil(TH * drumH() / (2 * RP)) + 3), Math.floor((rot / TAU - 0.25) * TW) - 6); }
			pk = Math.min(k, PKMAX);
			if (gj.done && tex && tex.ready && geoK !== pk) { makeGeo(pk); }
			else if (gj.done && tex && tex.ready && planetOK) {
				if (frames - lastUpd >= (slow ? 6 : 3)) { updatePlanet(pk); lastUpd = frames; }
				shown = Math.min(1, shown + dt * 1.6);
				g.globalAlpha = shown;
				L = halo(); put(g, L, k, cx - RP * 1.22, cy - RP * 1.22);
				if (gas) { rings(g, cx, cy, false); }
				moons(g, cx, cy, false);
				g.drawImage(P, Math.round((cx - RP) * k) / k, Math.round((cy - RP) * k) / k, P.width / pk, P.height / pk);
				if (gas) { rings(g, cx, cy, true); }
				moons(g, cx, cy, true);
				g.globalAlpha = 1;
			}
			// the ground comes up out of the dark as soon as it is worked out (a fraction of a second), the planet after it
			if (!gj.done) { return; }
			groundIn = Math.min(1, groundIn + dt * 2.5);
			L = ground(); g.globalAlpha = groundIn; put(g, L, k, 0, 1080 - L.hu); g.globalAlpha = 1;
			// the lander's lamp, winking
			a = Math.sin(T * 2.1); a = a > 0.55 ? (a - 0.55) / 0.45 : 0;
			if (a > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = a * groundIn; g.drawImage(lampSpr, beacon[0] - 15, beacon[1] - 15, 30, 30); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "hab-planetrise", label: "Habitat: planet rising over a moon", colors: ["c9ccd4", "2f6fd0", "7fc4ff"], start: startPlanet });
	// ================================================================ the template
	// The colours each place wears in each mood: [the place, the star of the picture, highlights].
	var LOOKS = {
		forest: { summer: ["3f8f3a", "ffe8a6", "cfe8c4"], dawn: ["2c6b74", "e4f4ff", "a9c9d6"], autumn: ["d07a1e", "ffd68a", "f4dcb0"], night: ["1d4a50", "b8d0ff", "24406e"] },
		koi: { day: ["2a8f86", "ff6a1c", "ff9ecb"], lantern: ["1b3f66", "ff7a2a", "ffb45c"], rain: ["55827c", "f2702a", "f4f1e6"], autumn: ["5d7440", "f26a1b", "ffd9a8"], night: ["0f2a66", "38e8ff", "ff5fd0"] },
		lava: { orange: ["2a1a26", "ff5a14", "ffd45a"], blue: ["101a44", "2f6bff", "a8f0ff"], grey: ["2a2c34", "ff6a2a", "ffc070"], dusk: ["5a2f86", "ff5a2a", "ffd070"] },
		planetrise: { earth: ["c9ccd4", "2f6fd0", "7fc4ff"], gas: ["cfc8bd", "d9a066", "ffe2b0"], desert: ["c8c2ba", "c4502a", "ffb58a"], ice: ["c2ccd8", "bfe6ff", "9fe0ff"], lava: ["4a4248", "ff5a1e", "ffb04a"] }
	};
	var MOODS = {
		forest: [["summer", "Green summer morning"], ["dawn", "Misty blue dawn"], ["autumn", "Golden autumn"], ["night", "Night, fireflies and moonbeams"]],
		koi: [["day", "Bright day"], ["lantern", "Evening, floating lanterns"], ["rain", "Rain"], ["autumn", "Autumn, red leaves on the water"], ["night", "Night pond, glowing fish"]],
		lava: [["orange", "Molten orange"], ["blue", "Blue sulphur fire"], ["grey", "Cooling grey field, bright cracks"], ["dusk", "Volcano at dusk, purple sky"]],
		planetrise: [["earth", "A blue world with seas and city lights"], ["gas", "A giant with rings"], ["desert", "A red desert world"], ["ice", "An ice world"], ["lava", "A world of fire, seen from a dark asteroid"]]
	};
	// each place keeps its mood under its own key in the link, so switching place never loses the others' choices
	var MOODKEY = { forest: "forest", koi: "pond", lava: "lava", planetrise: "world" };
	var SCENES = [["forest", "Old forest with light shafts"], ["koi", "Koi pond from above"], ["lava", "Lava fields at night"], ["planetrise", "Planet rising over a moon"]];
	SSO.register({
		id: "habitats",
		name: "Living places",
		category: "worlds",
		description: "Full-screen moving pictures of living places to sit behind a title, a camera or a break screen: an old forest with shafts of light and a deer passing, a koi pond seen from above, lava fields at night, and a planet rising over a moon. Pick the mood, how much is going on and the colours.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Place", type: "select", group: "Scene", default: "forest", options: SCENES }
		].concat(SCENES.map(function (s) {
			return { key: MOODKEY[s[0]], label: "Mood", type: "select", group: "Scene", default: MOODS[s[0]][0][0], options: MOODS[s[0]], show: { scene: s[0] } };
		})).concat([
			{ key: "life", label: "How much is going on (fish, animals, sparks, birds)", type: "range", group: "Scene", default: 1, min: 0.3, max: 2, step: 0.1 },
			{ key: "c1", label: "Colour of the place: leaves, water, rock, moon dust (blank = the mood's own)", type: "color", group: "Colours", default: "" },
			{ key: "c2", label: "Colour of the star of the picture: sunlight, fish, lava, planet (blank = the mood's own)", type: "color", group: "Colours", default: "" },
			{ key: "c3", label: "Colour of the highlights: mist, flowers, hottest glow, the planet's air (blank = the mood's own)", type: "color", group: "Colours", default: "" },
			{ key: "speed", label: "Speed", type: "range", group: "Motion", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "sharp", label: "Picture sharpness (lower is lighter on the computer)", type: "range", group: "Motion", default: 1, min: 0.5, max: 1, step: 0.05 }
		]),
		presets: [
			{ name: "Old forest, summer morning", tags: ["cozy", "elegant", "summer"], values: { scene: "forest", forest: "summer" } },
			{ name: "Old forest, misty blue dawn", tags: ["cozy", "simple"], values: { scene: "forest", forest: "dawn" } },
			{ name: "Old forest in golden autumn", tags: ["cozy", "autumn"], values: { scene: "forest", forest: "autumn" } },
			{ name: "Forest at night, fireflies", tags: ["cozy", "spooky"], values: { scene: "forest", forest: "night" } },
			{ name: "Koi pond on a bright day", tags: ["cozy", "elegant", "summer"], values: { scene: "koi", pond: "day" } },
			{ name: "Koi pond, evening lanterns", tags: ["cozy", "elegant"], values: { scene: "koi", pond: "lantern" } },
			{ name: "Koi pond in the rain", tags: ["cozy", "simple", "spring"], values: { scene: "koi", pond: "rain" } },
			{ name: "Koi pond in autumn", tags: ["cozy", "autumn"], values: { scene: "koi", pond: "autumn" } },
			{ name: "Night pond, glowing koi", tags: ["cyber", "elegant"], values: { scene: "koi", pond: "night" } },
			{ name: "Lava fields at night", tags: ["spicy", "gaming"], values: { scene: "lava", lava: "orange" } },
			{ name: "Blue sulphur fire", tags: ["spicy", "cyber", "spooky"], values: { scene: "lava", lava: "blue" } },
			{ name: "Cooling lava field, bright cracks", tags: ["spicy", "simple"], values: { scene: "lava", lava: "grey" } },
			{ name: "Volcano at dusk", tags: ["spicy", "elegant"], values: { scene: "lava", lava: "dusk" } },
			{ name: "Blue planet rising", tags: ["elegant", "pro", "cyber"], values: { scene: "planetrise", world: "earth" } },
			{ name: "Ringed giant rising", tags: ["elegant", "gaming"], values: { scene: "planetrise", world: "gas" } },
			{ name: "Red desert world rising", tags: ["gaming", "retro"], values: { scene: "planetrise", world: "desert" } },
			{ name: "Ice world rising", tags: ["elegant", "winter"], values: { scene: "planetrise", world: "ice" } },
			{ name: "World of fire, seen from an asteroid", tags: ["spicy", "gaming"], values: { scene: "planetrise", world: "lava" } }
		],
		render: function (root, c) {
			var host = document.createElement("div"), mood = c[MOODKEY[c.scene]], look = (LOOKS[c.scene] || {})[mood] || [];
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine("hab-" + c.scene, host, { c1: c.c1 || look[0], c2: c.c2 || look[1], c3: c.c3 || look[2], speed: c.speed, life: c.life, mood: mood, quality: c.sharp });
		}
	});

	// The same four places behind the "Starting soon / BRB / ending" screens, each with its title where the picture is calm.
	K.addPresets("screen", [
		{ name: "Living places: old forest, starting soon", tags: ["cozy", "elegant"], values: { backdrop: "hab-forest", c1: "3f8f3a", c2: "ffe8a6", c3: "cfe8c4", title: "Starting soon", subtitle: "the forest is waking up", minutes: 5, layout: "bottom", font: "Cinzel", fontsize: 92, accent: "ffe8a6", dim: 0 } },
		{ name: "Living places: koi pond, be right back", tags: ["cozy", "cute"], values: { backdrop: "hab-koi", c1: "2a8f86", c2: "ff6a1c", c3: "ff9ecb", title: "Be right back", subtitle: "gone to feed the fish", minutes: 0, layout: "center", font: "Playfair Display", fontsize: 116, accent: "ffd0e4", dim: 0 } },
		{ name: "Living places: lava fields, starting soon", tags: ["spicy", "gaming"], values: { backdrop: "hab-lava", c1: "2a1a26", c2: "ff5a14", c3: "ffd45a", title: "Starting soon", subtitle: "things are heating up", minutes: 5, layout: "top", font: "Bebas Neue", fontsize: 112, upper: true, accent: "ffe9a8", dim: 0 } },
		{ name: "Living places: planet rise, stand by", tags: ["elegant", "pro", "cyber"], values: { backdrop: "hab-planetrise", c1: "c9ccd4", c2: "2f6fd0", c3: "7fc4ff", title: "Stand by", subtitle: "the stream begins shortly", minutes: 5, countlabel: "starting in", layout: "top", font: "Orbitron", fontsize: 88, upper: true, accent: "7fc4ff", dim: 0 } }
	]);
})();
