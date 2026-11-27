/* Tiny living worlds pack: small simulated places that run themselves (a ski hill, a working harbour, a model railway, an
   ant farm, a city junction). Each is a background engine ("tiny-skihill", "tiny-harbor", "tiny-railway", "tiny-antfarm",
   "tiny-junction"), so the "Starting soon / BRB" screens and the "Animated background" template can use them too, plus
   one template ("tinyworld"). Built on fxkit.js. Keep this Chrome 80 friendly and ASCII only.
   Three parts per world, kept apart:
   - a simulation in fixed time steps with its own random numbers: agents with jobs, paths and queues. Every count is
     bounded, agents are recycled, and a stalled or hidden page carries on from where it was instead of catching up in a burst;
     a world is built a few milliseconds at a time (its builder is a generator) and kept for the next start with the same picture;
   - a renderer that draws it as pixel art on a small canvas (640 x 360 art pixels, or 360 x 640 on a vertical source):
     layers painted once and re-coloured for the time of day, sprites from one sheet, sorted by depth;
   - a camera that pans and zooms by moving that canvas with a CSS transform, so a camera move costs nothing to draw. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K || !SSO.register) { return; }
	var TAU = Math.PI * 2, STEP = 1 / 60, DAYLEN = 360, NSTEP = 144;
	var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
	var WORLDS = {}, ORDER = [];

	// ---------------------------------------------------------------- numbers and colours
	function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
	function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
	function lerp(a, b, t) { return a + (b - a) * t; }
	function sstep(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
	function rgb(c) { return typeof c === "string" ? K.toRgb(c) : c; }
	function mx(a, b, t) { a = rgb(a); b = rgb(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function mul(c, f) { c = rgb(c); return [c[0] * f, c[1] * f, c[2] * f]; }
	function b255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
	function css(c, a) {
		c = rgb(c);
		var s = b255(c[0]) + "," + b255(c[1]) + "," + b255(c[2]);
		return a == null ? "rgb(" + s + ")" : "rgba(" + s + "," + (+a).toFixed(3) + ")";
	}
	function lum(c) { c = rgb(c); return (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255; }
	function dist(ax, ay, bx, by) { ax -= bx; ay -= by; return Math.sqrt(ax * ax + ay * ay); }

	// Repeatable noise for painting terrain (never called in the frame loop).
	function ih(x, y, s) {
		var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
		h = Math.imul(h ^ (h >>> 13), 1103515245);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	function vn(x, y, s) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		var a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	}
	function fbm(x, y, s, oct) {
		var v = 0, a = 0.5, sum = 0, i;
		for (i = 0; i < oct; i++) { v += a * vn(x, y, s + i * 17); sum += a; x *= 2.03; y *= 2.03; a *= 0.5; }
		return v / sum;
	}
	// The same, repeating sideways every px cells (fog that slides without a seam).
	function vnT(x, y, px, s) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		var x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
		var a = ih(x0, yi, s), b = ih(x1, yi, s), c = ih(x0, yi + 1, s), d = ih(x1, yi + 1, s);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	}

	// ---------------------------------------------------------------- pixel drawing (whole art pixels only)
	function box(g, x, y, w, h, col) { if (col) { g.fillStyle = col; } g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
	function disc(g, cx, cy, r, col) {
		var y, x;
		if (col) { g.fillStyle = col; }
		for (y = -r; y <= r; y++) { x = Math.floor(Math.sqrt(r * r - y * y) + 0.5); g.fillRect(cx - x, cy + y, 2 * x + 1, 1); }
	}
	function ell(g, cx, cy, rx, ry, col) {
		var y, x;
		if (col) { g.fillStyle = col; }
		for (y = -ry; y <= ry; y++) { x = Math.floor(rx * Math.sqrt(Math.max(0, 1 - y * y / (ry * ry + 0.01))) + 0.5); g.fillRect(cx - x, cy + y, 2 * x + 1, 1); }
	}
	function line(g, x0, y0, x1, y1, col) {
		x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
		var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, e2, guard = 0;
		if (col) { g.fillStyle = col; }
		while (guard++ < 4000) {
			g.fillRect(x0, y0, 1, 1);
			if (x0 === x1 && y0 === y1) { break; }
			e2 = 2 * e;
			if (e2 >= dy) { e += dy; x0 += sx; }
			if (e2 <= dx) { e += dx; y0 += sy; }
		}
	}
	// A patch of ordered dither: density 0..1 of the pixels are filled.
	function dith(g, x, y, w, h, density, col) {
		var xx, yy, d = density * 16;
		if (col) { g.fillStyle = col; }
		for (yy = y; yy < y + h; yy++) { for (xx = x; xx < x + w; xx++) { if (BAYER[(yy & 3) * 4 + (xx & 3)] < d) { g.fillRect(xx, yy, 1, 1); } } }
	}
	// A sprite from rows of characters; pal maps a character to a colour, anything else is see-through.
	function pix(rows, pal) {
		var h = rows.length, w = 0, i;
		for (i = 0; i < h; i++) { if (rows[i].length > w) { w = rows[i].length; } }
		return K.bake(w, h, function (g) {
			var x, y, c;
			for (y = 0; y < h; y++) { for (x = 0; x < rows[y].length; x++) { c = pal[rows[y].charAt(x)]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } } }
		});
	}
	function flip(cv) { return K.bake(cv.width, cv.height, function (g, w) { g.translate(w, 0); g.scale(-1, 1); g.drawImage(cv, 0, 0); }); }
	// A pool of light on the ground or round a lamp: rings of falling strength with dithered joins.
	function poolSprite(rx, ry, col, strength) {
		return K.bake(rx * 2 + 1, ry * 2 + 1, function (g) {
			var x, y, d, lev, f, q;
			for (y = -ry; y <= ry; y++) {
				for (x = -rx; x <= rx; x++) {
					d = Math.sqrt(x * x / (rx * rx) + y * y / (ry * ry));
					if (d >= 1) { continue; }
					lev = (1 - d) * (1 - d) * 5; q = Math.floor(lev); f = lev - q;
					if (BAYER[((y + 64) & 3) * 4 + ((x + 64) & 3)] < f * 16) { q++; }
					if (q <= 0) { continue; }
					g.fillStyle = css(col, Math.min(1, q / 5 * strength)); g.fillRect(x + rx, y + ry, 1, 1);
				}
			}
		});
	}

	// Lamp light lying on the ground: a few flat rings, no dither (small pools look like static when dithered).
	function glowSprite(rx, ry, col, a) {
		return K.bake(rx * 2 + 1, ry * 2 + 1, function (g) { var i; for (i = 0; i < 4; i++) { ell(g, rx, ry, Math.round(rx * (1 - i * 0.22)), Math.round(ry * (1 - i * 0.22)), css(col, a * 0.3)); } });
	}
	// The glow round a lamp head: three flat rings and a bright middle.
	function haloSprite(r, col) {
		return K.bake(r * 2 + 1, r * 2 + 1, function (g) {
			disc(g, r, r, r, css(col, 0.16)); disc(g, r, r, Math.max(1, Math.round(r * 0.62)), css(col, 0.26)); disc(g, r, r, Math.max(1, Math.round(r * 0.3)), css(mx(col, [255, 255, 255], 0.5), 0.7));
			g.fillStyle = "#ffffff"; g.fillRect(r, r, 1, 1);
		});
	}

	// ---------------------------------------------------------------- the sprite sheet
	// Every sprite of a world lives on one canvas, so it can be re-coloured for the time of day in one go.
	function makeAtlas() {
		var list = [], A = { cv: null };
		// ox, oy: the point of the sprite that is placed on (x, y). By default the middle of its bottom edge (its feet).
		// sx, sy, w, h: the part of cv that is the sprite, when one canvas holds several (a set of turned copies).
		// A sprite that is partly see-through (a shadow, a ripple) should have its .soft set: the day's cross-fade treats it differently.
		A.add = function (cv, ox, oy, sx, sy, w, h) {
			var s = { src: cv, sx: sx || 0, sy: sy || 0, w: w || cv.width, h: h || cv.height, ox: 0, oy: 0, x: 0, y: 0, soft: false };
			s.ox = ox == null ? s.w >> 1 : ox; s.oy = oy == null ? s.h : oy;
			list.push(s);
			return s;
		};
		A.pack = function () {
			var order = list.slice().sort(function (a, b) { return b.h - a.h; }), x = 0, y = 0, row = 0, i, s, g;
			for (i = 0; i < order.length; i++) {
				s = order[i];
				if (x + s.w > 1024) { x = 0; y += row + 1; row = 0; }
				s.x = x; s.y = y; x += s.w + 1;
				if (s.h > row) { row = s.h; }
			}
			A.cv = K.canvas(1024, Math.max(2, y + row + 1));
			g = A.cv.getContext("2d");
			for (i = 0; i < order.length; i++) { s = order[i]; g.drawImage(s.src, s.sx, s.sy, s.w, s.h, s.x, s.y, s.w, s.h); s.src = null; }
		};
		return A;
	}

	// Spare canvases, so re-colouring layers as the day passes does not keep making new ones.
	var spare = {};
	function getCv(w, h) { var l = spare[w + "x" + h]; return l && l.length ? l.pop() : K.canvas(w, h); }
	function freeCv(cv) { var k = cv.width + "x" + cv.height, l = spare[k] || (spare[k] = []); if (l.length < 6) { l.push(cv); } }
	// dst = src multiplied by the light colour of look L, with a thin veil of its air colour, keeping src's shape.
	function tintInto(dst, src, L) {
		var c = dst.getContext("2d"), w = dst.width, h = dst.height, t = L.tint, v = L.veil;
		c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
		c.globalCompositeOperation = "copy"; c.drawImage(src, 0, 0);
		c.globalCompositeOperation = "multiply"; c.fillStyle = css([t[0] * 255, t[1] * 255, t[2] * 255]); c.fillRect(0, 0, w, h);
		if (v[3] > 0.004) { c.globalCompositeOperation = "source-over"; c.fillStyle = css(v, v[3]); c.fillRect(0, 0, w, h); }
		c.globalCompositeOperation = "destination-in"; c.drawImage(src, 0, 0);
		c.globalCompositeOperation = "source-over";
	}

	// ---------------------------------------------------------------- the day
	// A look is how the world is lit at one moment: sky colours, the colour everything is multiplied by, how far the lamps
	// are on. The day runs dawn, day, dusk, night; in between, two looks are blended.
	var LOOK0 = {
		day: { tint: [1, 1, 1], veil: [0, 0, 0, 0], lights: 0, stars: 0 },
		dusk: { tint: [0.96, 0.72, 0.7], veil: [150, 60, 90, 0.06], lights: 0.6, stars: 0.2 },
		night: { tint: [0.26, 0.33, 0.62], veil: [10, 16, 56, 0.1], lights: 1, stars: 1 },
		dawn: { tint: [0.95, 0.83, 0.88], veil: [150, 100, 130, 0.06], lights: 0.3, stars: 0.1 }
	};
	var SEQ = [[0, "dawn"], [0.07, "day"], [0.5, "day"], [0.61, "dusk"], [0.71, "night"], [0.93, "night"], [1, "dawn"]];
	var FIXED = { day: 0.2, dusk: 0.61, night: 0.82 };
	function makeLooks(def, S) {
		var out = {}, c = S.c1, l = lum(c);
		["day", "dusk", "night", "dawn"].forEach(function (k) {
			var x = def.sky[k], t = def.tint && def.tint[k];
			out[k] = { top: x[0], mid: x[1], low: x[2], tint: t || LOOK0[k].tint, veil: LOOK0[k].veil, lights: LOOK0[k].lights, stars: LOOK0[k].stars };
		});
		if (S.own1) {
			// The chosen sky colour is the daytime sky if it is bright and the night sky if it is dark; the rest follow it.
			if (l >= 0.2) {
				out.day.mid = c; out.day.top = mx(mul(c, 0.66), [30, 60, 160], 0.2); out.day.low = mx(c, [255, 255, 255], 0.6);
				out.night.top = mx(mul(c, 0.1), [6, 8, 26], 0.5); out.night.mid = mx(mul(c, 0.2), [12, 18, 52], 0.5); out.night.low = mx(mul(c, 0.34), [28, 38, 88], 0.5);
				out.dusk.top = mx(mul(c, 0.5), out.dusk.top, 0.5); out.dawn.top = mx(mul(c, 0.8), out.dawn.top, 0.5);
			} else {
				out.night.mid = c; out.night.top = mul(c, 0.55); out.night.low = mx(c, [84, 92, 160], 0.34);
				out.dusk.top = mx(c, out.dusk.top, 0.5);
			}
		}
		return out;
	}
	function mixLook(a, b, f) {
		var o = { top: mx(a.top, b.top, f), mid: mx(a.mid, b.mid, f), low: mx(a.low, b.low, f), tint: mx(a.tint, b.tint, f), lights: lerp(a.lights, b.lights, f), stars: lerp(a.stars, b.stars, f) };
		var va = a.veil, vb = b.veil, wa = va[3] * (1 - f), wb = vb[3] * f, w = wa + wb || 1;
		o.veil = [(va[0] * wa + vb[0] * wb) / w, (va[1] * wa + vb[1] * wb) / w, (va[2] * wa + vb[2] * wb) / w, wa + wb];
		return o;
	}
	function lookAt(looks, p) {
		var i, a, b;
		p = ((p % 1) + 1) % 1;
		for (i = 0; i < SEQ.length - 1; i++) { if (p <= SEQ[i + 1][0]) { break; } }
		a = SEQ[i]; b = SEQ[Math.min(i + 1, SEQ.length - 1)];
		if (a[1] === b[1]) { return looks[a[1]]; }
		return mixLook(looks[a[1]], looks[b[1]], sstep((p - a[0]) / (b[0] - a[0])));
	}
	function r2(v) { return Math.round(v * 200); }
	function tintKey(L) { return r2(L.tint[0]) + "," + r2(L.tint[1]) + "," + r2(L.tint[2]) + "," + Math.round(L.veil[0]) + "," + Math.round(L.veil[1]) + "," + Math.round(L.veil[2]) + "," + r2(L.veil[3]); }
	function skyKey(L) { return [L.top, L.mid, L.low].map(function (c) { return b255(c[0]) + "." + b255(c[1]) + "." + b255(c[2]); }).join("|") + "|" + Math.round(L.stars * 20); }
	// The sky as stepped bands with dithered joins, and the stars. h = how far down it is ever seen.
	function paintSky(cv, L, h, stars) {
		var g = cv.getContext("2d"), w = cv.width, img = g.createImageData(w, cv.height), d = img.data, NB = 13, x, y, t, k, f, a, b, q, p = 0, i, s, m;
		var bands = [];
		for (k = 0; k <= NB + 1; k++) { t = Math.min(1, k / NB); bands.push(t < 0.55 ? mx(L.top, L.mid, t / 0.55) : mx(L.mid, L.low, (t - 0.55) / 0.45)); }
		for (y = 0; y < cv.height; y++) {
			t = Math.min(0.9999, Math.pow(y / Math.max(1, h - 1), 0.9)) * NB; k = Math.floor(t); f = sstep((t - k - 0.25) / 0.5) * 16; a = bands[k]; b = bands[k + 1];
			for (x = 0; x < w; x++) { q = BAYER[(y & 3) * 4 + (x & 3)] < f ? b : a; d[p++] = q[0]; d[p++] = q[1]; d[p++] = q[2]; d[p++] = 255; }
		}
		if (L.stars > 0.04) {
			for (i = 0; i < stars.length; i++) {
				s = stars[i]; m = s[2] * L.stars; p = (s[1] * w + s[0]) * 4;
				if (s[1] >= cv.height || m < 0.08) { continue; }
				d[p] += (255 - d[p]) * m; d[p + 1] += (255 - d[p + 1]) * m; d[p + 2] += (255 - d[p + 2]) * m;
			}
		}
		g.putImageData(img, 0, 0);
	}
	function sunSprite(core, body, halo) {
		return K.bake(31, 31, function (g) {
			var x, y, d;
			for (y = -15; y <= 15; y++) {
				for (x = -15; x <= 15; x++) {
					d = Math.sqrt(x * x + y * y);
					if (d > 8.5 && d < 15 && BAYER[((y + 16) & 3) * 4 + ((x + 16) & 3)] < (15 - d) * 1.5) { g.fillStyle = css(halo, 0.55); g.fillRect(x + 15, y + 15, 1, 1); }
				}
			}
			disc(g, 15, 15, 8, css(body)); disc(g, 15, 15, 6, css(core));
		});
	}
	function moonSprite() {
		return K.bake(25, 25, function (g) {
			var x, y, d;
			for (y = -12; y <= 12; y++) {
				for (x = -12; x <= 12; x++) {
					d = Math.sqrt(x * x + y * y);
					if (d > 7.5 && d < 12 && BAYER[((y + 16) & 3) * 4 + ((x + 16) & 3)] < (12 - d) * 1.2) { g.fillStyle = "rgba(190,205,255,0.4)"; g.fillRect(x + 12, y + 12, 1, 1); }
				}
			}
			disc(g, 12, 12, 7, "#f2f4ff");
			g.fillStyle = "#cfd6f2"; disc(g, 10, 10, 2); disc(g, 15, 14, 1); g.fillRect(13, 8, 2, 1); g.fillRect(9, 15, 2, 2);
			g.fillStyle = "#ffffff"; for (y = -5; y <= 3; y++) { g.fillRect(12 - Math.floor(Math.sqrt(49 - y * y)) + 1, 12 + y, 1, 1); }
		});
	}
	// A chunky cloud: lit top, body, shaded flat underside.
	function cloudSprite(R, w) {
		var h = Math.round(w * 0.36) + 5, n = 4 + Math.floor(w / 11), blobs = [], i, r;
		for (i = 0; i < n; i++) { r = 2 + Math.floor(R() * w * 0.12); blobs.push([Math.round(r + 1 + (w - 2 * r - 2) * (i / (n - 1))), h - 2 - Math.floor(r * (0.35 + R() * 0.65)), r]); }
		return K.bake(w, h, function (g) {
			var pass;
			for (pass = 0; pass < 3; pass++) {
				g.globalCompositeOperation = pass ? "source-atop" : "source-over";
				g.fillStyle = pass === 0 ? "#ffffff" : pass === 1 ? "#e8f0fa" : "#c3d3ea";
				for (i = 0; i < n; i++) { disc(g, blobs[i][0], blobs[i][1] + (pass === 0 ? 0 : pass === 1 ? 2 : Math.round(blobs[i][2] * 0.8) + 2), blobs[i][2]); }
				if (pass === 0) { g.fillRect(3, h - 5, w - 6, 3); }
			}
			g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.fillRect(0, h - 2, w, 2); g.fillRect(0, h - 3, 2, 1); g.fillRect(w - 2, h - 3, 2, 1);
		});
	}
	// Drifting mist as a strip that repeats sideways: white, in four strengths with dithered joins. Painted a few rows at a
	// time when late() says the build has used up its share of the frame.
	var FOGC = ["", "rgba(212,222,236,0.24)", "rgba(212,222,236,0.48)", "rgba(212,222,236,0.72)", "rgba(212,222,236,0.96)"];
	function* fogSteps(w, h, seed, late) {
		var cv = K.canvas(w, h), g = cv.getContext("2d"), x, y, n, q, f, bell;
		for (y = 0; y < h; y++) {
			if (late && late()) { yield; }
			bell = Math.sin(Math.PI * (y + 0.5) / h);
			for (x = 0; x < w; x++) {
				n = (vnT(x / w * 7, y / h * 2.4, 7, seed) * 0.62 + vnT(x / w * 21, y / h * 6, 21, seed + 3) * 0.38) * bell;
				n = sstep((n - 0.26) / 0.42) * 4; q = Math.floor(n); f = n - q;
				if (BAYER[(y & 3) * 4 + (x & 3)] < f * 16) { q++; }
				if (q > 0) { g.fillStyle = FOGC[q > 4 ? 4 : q]; g.fillRect(x, y, 1, 1); }
			}
		}
		return cv;
	}
	// A canvas painted by a generator, so a big painting can stop for the frame and carry on after it.
	function* bakeSteps(w, h, paint) {
		var cv = K.canvas(w, h);
		yield* paint(cv.getContext("2d"), cv.width, cv.height);
		return cv;
	}

	// ---------------------------------------------------------------- paths
	// A smooth line through points, sampled once a pixel, so "where is s pixels along it" is a table look-up.
	function makePath(pts, closed) {
		var raw = [], n = pts.length, i, j, p0, p1, p2, p3, t, t2, t3, segs = closed ? n : n - 1, len = 0, d, out, m, k, acc, a, b, f;
		function P(q) { return closed ? pts[((q % n) + n) % n] : pts[q < 0 ? 0 : q >= n ? n - 1 : q]; }
		for (i = 0; i < segs; i++) {
			p0 = P(i - 1); p1 = P(i); p2 = P(i + 1); p3 = P(i + 2);
			for (j = 0; j < 14; j++) {
				t = j / 14; t2 = t * t; t3 = t2 * t;
				raw.push([0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
					0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3)]);
			}
		}
		raw.push(closed ? raw[0] : pts[n - 1]);
		for (i = 1; i < raw.length; i++) { len += dist(raw[i][0], raw[i][1], raw[i - 1][0], raw[i - 1][1]); }
		m = Math.max(2, Math.ceil(len) + 1);
		out = { len: len, n: m, x: new Float32Array(m), y: new Float32Array(m), closed: !!closed };
		k = 0; acc = 0;
		for (i = 0; i < m; i++) {
			t = Math.min(len, i * len / (m - 1));
			while (k < raw.length - 2) { a = raw[k]; b = raw[k + 1]; d = dist(a[0], a[1], b[0], b[1]); if (acc + d >= t) { break; } acc += d; k++; }
			a = raw[k]; b = raw[k + 1]; d = dist(a[0], a[1], b[0], b[1]); f = d > 0 ? clamp((t - acc) / d, 0, 1) : 0;
			out.x[i] = a[0] + (b[0] - a[0]) * f; out.y[i] = a[1] + (b[1] - a[1]) * f;
		}
		out.k = (m - 1) / len;
		return out;
	}
	// The same from straight pieces only (roads, corridors): pts joined by lines.
	function makeLine(pts) {
		var len = 0, i, m, out, k = 0, acc = 0, t, a, b, d, f;
		for (i = 1; i < pts.length; i++) { len += dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]); }
		m = Math.max(2, Math.ceil(len) + 1);
		out = { len: len, n: m, x: new Float32Array(m), y: new Float32Array(m), closed: false };
		for (i = 0; i < m; i++) {
			t = Math.min(len, i * len / (m - 1));
			while (k < pts.length - 2) { a = pts[k]; b = pts[k + 1]; d = dist(a[0], a[1], b[0], b[1]); if (acc + d >= t) { break; } acc += d; k++; }
			a = pts[k]; b = pts[k + 1]; d = dist(a[0], a[1], b[0], b[1]); f = d > 0 ? clamp((t - acc) / d, 0, 1) : 0;
			out.x[i] = a[0] + (b[0] - a[0]) * f; out.y[i] = a[1] + (b[1] - a[1]) * f;
		}
		out.k = (m - 1) / len;
		return out;
	}
	function wrapS(P, s) { if (P.closed) { s = s % P.len; if (s < 0) { s += P.len; } return s; } return s < 0 ? 0 : s > P.len ? P.len : s; }
	function pathX(P, s) { var f = wrapS(P, s) * P.k, i = Math.floor(f); if (i >= P.n - 1) { return P.x[P.n - 1]; } return P.x[i] + (P.x[i + 1] - P.x[i]) * (f - i); }
	function pathY(P, s) { var f = wrapS(P, s) * P.k, i = Math.floor(f); if (i >= P.n - 1) { return P.y[P.n - 1]; } return P.y[i] + (P.y[i + 1] - P.y[i]) * (f - i); }
	function pathA(P, s) { var a = s - 2, b = s + 2; if (!P.closed) { a = clamp(a, 0, P.len); b = clamp(b, 0, P.len); } return Math.atan2(pathY(P, b) - pathY(P, a), pathX(P, b) - pathX(P, a)); }

	// ---------------------------------------------------------------- small pixel particles (spray, smoke, dust)
	function makeDots(max) {
		var x = new Float32Array(max), y = new Float32Array(max), vx = new Float32Array(max), vy = new Float32Array(max), age = new Float32Array(max), life = new Float32Array(max);
		var sz = new Float32Array(max), grow = new Float32Array(max), ci = new Uint8Array(max), n = 0, P = { grav: 0, drag: 0 };
		P.add = function (px, py, pvx, pvy, plife, c, s, gr) {
			if (n >= max) { return; }
			x[n] = px; y[n] = py; vx[n] = pvx; vy[n] = pvy; age[n] = 0; life[n] = plife; ci[n] = c || 0; sz[n] = s || 1; grow[n] = gr || 0; n++;
		};
		P.step = function (dt) {
			var i, k = P.drag ? Math.exp(-P.drag * dt) : 1;
			for (i = n - 1; i >= 0; i--) {
				age[i] += dt;
				if (age[i] >= life[i]) { n--; x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n]; age[i] = age[n]; life[i] = life[n]; sz[i] = sz[n]; grow[i] = grow[n]; ci[i] = ci[n]; continue; }
				vy[i] += P.grav * dt; vx[i] *= k; vy[i] *= k; x[i] += vx[i] * dt; y[i] += vy[i] * dt;
			}
		};
		P.draw = function (g, cols) {
			var c, i, s, left, px, py;
			for (c = 0; c < cols.length; c++) {
				g.fillStyle = cols[c];
				for (i = 0; i < n; i++) {
					if (ci[i] !== c) { continue; }
					left = 1 - age[i] / life[i]; s = Math.round(sz[i] + grow[i] * age[i]); px = Math.round(x[i]); py = Math.round(y[i]);
					g.globalAlpha = left > 0.5 ? 1 : left > 0.25 ? 0.6 : 0.3;
					if (s <= 2) { g.fillRect(px, py, s, s); } else { g.fillRect(px + 1, py, s - 2, s); g.fillRect(px, py + 1, s, s - 2); }
				}
			}
			g.globalAlpha = 1;
		};
		P.count = function () { return n; };
		return P;
	}

	// ---------------------------------------------------------------- the camera director
	// Chooses something worth watching from what the world offers, eases over to it, holds, and moves on. V describes the
	// view: world size, how much of it shows at a zoom, the widest zoom and which zooms land on whole screen pixels.
	function makeDirector(V, S, world, rnd) {
		var cam = { x: V.W / 2, y: V.H / 2, z: V.zmin }, vx = 0, vy = 0, vz = 0, shot = null, left = 0, lastTag = "", cand = [], nc = 0, t = rnd() * 100, sinceWide = 0, lostFor = 0;
		var ax = 0.5, ay = 0.5, tx = cam.x, ty = cam.y, tz = cam.z, first = true;
		if (S.layout === "top") { ay = 0.64; } else if (S.layout === "bottom") { ay = 0.36; } else if (S.layout === "split") { ax = 0.7; } else if (S.layout === "center") { ay = 0.72; } else if (S.layout === "corner") { ax = 0.6; ay = 0.4; }
		function push(tag, x, y, z, w, f, len, alive) {
			var c = cand[nc] || (cand[nc] = {});
			c.tag = tag; c.x = x; c.y = y; c.z = z; c.w = w; c.f = f || null; c.len = len || 14; c.alive = alive || null; nc++;
		}
		function pick() {
			var total = 0, i, r, c = null;
			nc = 0; world.shots(push);
			sinceWide++;
			if (!first && nc && sinceWide >= 2 && rnd() < 0.34) { nc = 0; }
			if (!nc) { push("wide", V.W / 2, V.H / 2, 1, 1, null, 9, null); sinceWide = 0; }
			for (i = 0; i < nc; i++) { if (cand[i].tag === lastTag && nc > 1) { cand[i].w *= 0.08; } total += cand[i].w; }
			if (first) { c = cand[0]; for (i = 1; i < nc; i++) { if (cand[i].w > c.w) { c = cand[i]; } } }
			else { r = rnd() * total; for (i = 0; i < nc; i++) { r -= cand[i].w; if (r <= 0) { c = cand[i]; break; } } }
			c = c || cand[0];
			shot = { tag: c.tag, x: c.x, y: c.y, z: c.z, f: c.f, alive: c.alive };
			left = c.len * (0.85 + rnd() * 0.3); lastTag = c.tag; lostFor = 0;
		}
		function damp(cur, tgt, vel, st, maxV, dt) {
			var om = 2 / st, x = om * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), ch = clamp(cur - tgt, -maxV * st, maxV * st), tmp = (vel + om * ch) * dt;
			damp.v = (vel - om * tmp) * ex;
			return cur - ch + (ch + tmp) * ex;
		}
		cam.update = function (dt) {
			var vw, vh, st = 2.4;
			t += dt;
			if (S.camera === "wide") { tx = V.W / 2; ty = V.H / 2; tz = V.zmin; }
			else if (S.camera === "drift") {
				tz = V.snap(Math.max(V.zmin, 1.34));
				// on a small source that rounds back to the wide shot, which leaves nothing to drift across: the next whole-pixel zoom then
				if (V.vw(tz) > V.W - 16 && V.vh(tz) > V.H - 9) { tz = V.up(tz); }
				// to and fro across exactly as much of the world as lies outside the view, so it never sits still against an edge
				tx = V.W / 2 + Math.sin(t * 0.07) * Math.max(0, V.W - V.vw(tz)) * 0.49; ty = V.H / 2 + Math.sin(t * 0.05 + 1.3) * Math.max(0, V.H - V.vh(tz)) * 0.49;
			} else {
				left -= dt;
				if (shot && shot.f && shot.alive && !shot.alive(shot.f)) { lostFor += dt; if (lostFor > 1.2) { left = 0; } }
				if (!shot || left <= 0) { pick(); }
				if (shot.f) { tx = shot.f.x; ty = shot.f.y; st = 1.5; } else { tx = shot.x; ty = shot.y; }
				tz = V.snap(clamp(shot.z, V.zmin, 2.4));
			}
			vw = V.vw(tz); vh = V.vh(tz);
			if (tz > V.zmin + 0.01) { tx -= (V.mirror ? -1 : 1) * (ax - 0.5) * vw; ty -= (ay - 0.5) * vh; }
			if (!(tx === tx) || !(ty === ty)) { tx = V.W / 2; ty = V.H / 2; }
			tx = vw >= V.W ? V.W / 2 : clamp(tx, vw / 2, V.W - vw / 2); ty = vh >= V.H ? V.H / 2 : clamp(ty, vh / 2, V.H - vh / 2);
			if (first) { cam.x = tx; cam.y = ty; cam.z = tz; first = false; return; }
			cam.x = damp(cam.x, tx, vx, st, 46, dt); vx = damp.v;
			cam.y = damp(cam.y, ty, vy, st, 46, dt); vy = damp.v;
			cam.z = damp(cam.z, tz, vz, 2.6, 0.22, dt); vz = damp.v;
		};
		return cam;
	}

	// ---------------------------------------------------------------- one running world
	function settings(o, def) {
		o = o || {};
		var c1 = rgb(o.c1 || ("#" + def.colors[0])), d1 = rgb("#" + def.colors[0]), time = String(o.time == null ? "" : o.time), w = String(o.weather || ""), cam = String(o.camera || "");
		var own1 = !o.auto1 && (Math.abs(c1[0] - d1[0]) + Math.abs(c1[1] - d1[1]) + Math.abs(c1[2] - d1[2]) > 6);
		// Started without a time of day (a "Starting soon" screen): a dark sky colour means night, anything else the passing day.
		if (time !== "cycle" && time !== "day" && time !== "dusk" && time !== "night") { time = own1 && lum(c1) < 0.2 ? "night" : "cycle"; }
		return {
			c1: c1, own1: own1, accent: rgb(o.c2 || ("#" + def.colors[1])), lamp: rgb(o.c3 || ("#" + def.colors[2])), time: time,
			weather: w === "clear" || w === "rain" || w === "fog" ? w : "", camera: cam === "wide" || cam === "drift" ? cam : "follow",
			busy: clamp(num(o.busy, 1), 0.3, 2), speed: clamp(num(o.speed, 1), 0.1, 4), layout: String(o.layout || ""), sharp: clamp(num(o.quality, 1), 0.5, 1)
		};
	}
	// Finished worlds, kept for the next start that would paint the same picture. The editor renders an overlay again on
	// every change of a setting; with this, changing the camera, the weather or the time of day costs no rebuilding (the
	// world simply carries on from where it was). Two at most; a world in use is never in here, so it is never shared.
	var BAKES = [], tintPrimed = false, SOFT = { fog: 1, mist: 1, wet: 1 };
	function freeBake(b) {
		var k, n, e;
		for (k in b.sets) { e = b.sets[k]; if (e.atlas && e.own) { freeCv(e.atlas); } for (n in e.layers) { if (e.layers[n].own) { freeCv(e.layers[n].cv); } } }
		for (k in b.skies) { freeCv(b.skies[k].cv); }
	}
	function takeBake(key) { var i; for (i = 0; i < BAKES.length; i++) { if (BAKES[i].key === key) { return BAKES.splice(i, 1)[0]; } } return null; }
	function keepBake(b) { var old = takeBake(b.key); if (old) { freeBake(old); } BAKES.push(b); while (BAKES.length > 2) { freeBake(BAKES.shift()); } }

	function startWorld(id, host, o) {
		var def = WORLDS[id], S = settings(o, def), looks = makeLooks(def, S);
		var sc = K.scene(host, { fps: 30, pixelated: true, artPixel: 3 }), cv = sc.cv, g = sc.g;
		// Nothing to draw into: say so before any world is built, so the engine's own failure handling (which clears up the
		// scene and shows its plain colour instead) takes over.
		if (!g) { sc.stop(); throw new Error("tiny world: no 2D canvas"); }
		var WW = 0, WH = 0, s0 = 3, hw = 1920, hh = 1080, world = null, A = null, cam = null, core = null, stars = [], clouds = [];
		var rnd = K.seeded("tiny" + Date.now() + ":" + Math.random()), simT = 0, simDt = 0, acc = 0, phase = S.time === "cycle" ? 0.26 : FIXED[S.time], lastT = "";
		var X = { t: 0, lit: 0, rain: 0, fog: 0, p: phase, night: false }, wx = { rain: 0, fog: 0, rainTo: 0, fogTo: 0, timer: 20 + rnd() * 60, fogDay: rnd() < 0.6 };
		var sets = {}, skies = {}, setA = null, setB = null, skyA = null, skyB = null, fade = 0, xf = 0, stepI = -1, cur = looks.day, at = null, atA = null, atB = null, flakes = null, setN = null, skyN = null, nextL = null, used = {}, work = 0, primed = false;
		var qs = [], qx = [], qy = [], qk = [], qa = [], qi = [], qn = 0, D = { g: g, t: 0, lit: 0, W: 0, H: 0 }, alive = true, camRaf = 0, camLast = 0;
		var ready = false, job = null, slice = { end: 0 }, bakeKey = "", mixCv = null, mixG = null, mixName = "", mixFrame = -1, frameN = 0;
		host.style.overflow = "hidden";
		cv.style.transformOrigin = "0 0"; cv.style.willChange = "transform";

		var V = {
			W: 640, H: 360, zmin: 1,
			// some worlds are shown mirrored when the words sit on the left, so that their busiest corner is not under them
			mirror: !!def.flip && (S.layout === "corner" || S.layout === "split"),
			vw: function (z) { return hw / (s0 * z); }, vh: function (z) { return hh / (s0 * z); },
			// Zooms that put a whole number of screen pixels on every art pixel, so held shots are crisp.
			snap: function (z) { return z <= V.zmin + 0.01 ? V.zmin : Math.max(V.zmin, Math.round(s0 * z) / s0); },
			// the next such zoom above z
			up: function (z) { return (Math.floor(s0 * z + 0.001) + 1) / s0; }
		};
		function late() { return performance.now() > slice.end; }
		// Hands the finished world back for the next start, or throws away a half-built one.
		function release() {
			if (ready && world) { keepBake({ key: bakeKey, world: world, A: A, core: core, stars: stars, clouds: clouds, sets: sets, skies: skies }); }
			else { dropSets(true); }
			world = null; ready = false; job = null; sets = {}; skies = {};
			setA = setB = setN = skyA = skyB = skyN = nextL = null; stepI = -1; flakes = null; used = {}; primed = false; mixCv = null; mixName = "";
		}
		function build(tall) {
			var b;
			release();
			WW = tall ? 360 : 640; WH = tall ? 640 : 360; V.W = WW; V.H = WH; D.W = WW; D.H = WH;
			bakeKey = [id, tall ? 1 : 0, css(S.accent), css(S.lamp), S.busy].join("|");
			b = takeBake(bakeKey);
			if (b) { world = b.world; A = b.A; core = b.core; stars = b.stars; clouds = b.clouds; sets = b.sets; skies = b.skies; finish(); return; }
			A = makeAtlas();
			cam = { x: WW / 2, y: WH / 2, z: 1, update: function () { this.z = V.zmin; } };
			// Nothing is painted here: the building starts with the first animation frame. (Canvas work done while the page
			// is still running its own scripts was measured to stall for up to 50 ms now and then; a frame later it does not.)
			job = steps(tall);
		}
		// Building a world from nothing takes a few hundred milliseconds of painting. It is done a few milliseconds at a
		// time, between frames; until it is finished the picture is the sky, the bare ground and whatever layers are ready.
		function* steps(tall) {
			var R = K.seeded(id + (tall ? "-tall" : "-wide")), E, w, L, set, n;
			core = { sun: A.add(sunSprite([255, 252, 232], [255, 236, 170], [255, 240, 190]), 15, 15), sunLow: null, moon: null, clouds: [] };
			if (late()) { yield; }
			core.sunLow = A.add(sunSprite([255, 214, 150], [255, 150, 90], [255, 170, 110]), 15, 15); core.moon = A.add(moonSprite(), 12, 12);
			for (n = 0; n < 4; n++) { if (late()) { yield; } core.clouds.push(A.add(cloudSprite(R, [46, 30, 64, 22][n]), 0, 0)); }
			E = { W: WW, H: WH, tall: tall, R: R, rnd: rnd, A: A, accent: S.accent, lamp: S.lamp, count: function (m, lo, hi) { return Math.round(clamp(m * S.busy, lo || 1, hi || 999)); }, touch: touch, late: late };
			w = yield* def.build(E);
			// a world that does not place its own mist gets drifting bands of it over the whole picture
			if (!w.layers.fog && !w.layers.mist) { w.layers.mist = yield* fogSteps(WW, 140, 3, late); }
			if (late()) { yield; }
			A.pack();
			if (late()) { yield; }
			if (w.init) { w.init(); }
			// re-coloured for the light it starts in, a layer at a time (what was made for the first rough picture is dropped:
			// a layer may have been finished off since)
			dropSets(true);
			for (n in w.layers) { used[n] = true; }
			L = lookAt(looks, Math.floor(phase * NSTEP) / NSTEP); set = getSet(L);
			for (n in used) { if (late()) { yield; } lay(set, n); }
			if (late()) { yield; }
			getSky(L);
			return w;
		}
		function skyBits() {
			var R = K.seeded(id + "-sky" + WW), i;
			stars = []; clouds = [];
			for (i = 0; i < 130; i++) { stars.push([Math.floor(R() * WW), Math.floor(R() * R() * (world.skyH || 1) * 0.9), 0.35 + R() * 0.65, R() * TAU, 0.6 + R() * 1.8]); }
			if (world.skyH) { for (i = 0; i < (world.clouds == null ? 5 : world.clouds); i++) { clouds.push({ s: core.clouds[i % 4], x: R() * (WW + 80) - 60, y: Math.round(4 + R() * world.skyH * 0.5), v: 1.2 + R() * 2.2 }); } }
		}
		function advance() {
			var r;
			do { r = job.next(); if (r.value && !world) { world = r.value; skyBits(); } } while (!r.done && !late());
			if (r.done) { job = null; world = r.value; finish(); }
		}
		function finish() {
			var n;
			// every layer is re-coloured ahead of need, weather layers too, so the first shower costs no more than any other frame
			for (n in world.layers) { used[n] = true; }
			cam = makeDirector(V, S, world, K.seeded("cam" + Date.now() + Math.random()));
			ready = true;
			stepI = -1; lastT = "";
		}
		function dropSets(all) {
			var k, n, e;
			for (k in sets) { e = sets[k]; if (all || (e !== setA && e !== setB && e !== setN)) { if (e.atlas && e.own) { freeCv(e.atlas); } for (n in e.layers) { if (e.layers[n].own) { freeCv(e.layers[n].cv); } } delete sets[k]; } }
			for (k in skies) { e = skies[k]; if (all || (e !== skyA && e !== skyB && e !== skyN)) { freeCv(e.cv); delete skies[k]; } }
			if (all) { setA = setB = setN = skyA = skyB = skyN = nextL = null; stepI = -1; }
		}
		// A world calls this after repainting one of its layers, so the re-coloured copies are made again.
		function touch(name) {
			var k, e;
			for (k in sets) { e = sets[k].layers[name]; if (e) { if (e.own) { freeCv(e.cv); } delete sets[k].layers[name]; } }
		}
		// The sprite sheet of a look is added as soon as there is a sheet (while a world is still being built there is none).
		function getSet(L) {
			var k = tintKey(L), e = sets[k];
			if (!e) { e = sets[k] = { L: L, plain: k === "200,200,200,0,0,0,0", atlas: null, own: false, layers: {} }; }
			if (!e.atlas && A.cv) {
				if (e.plain) { e.atlas = A.cv; } else { e.atlas = getCv(A.cv.width, A.cv.height); e.own = true; tintInto(e.atlas, A.cv, e.L); work++; }
			}
			return e;
		}
		function getSky(L) {
			var k = skyKey(L), e = skies[k];
			if (e || !world.skyH) { return e || null; }
			e = skies[k] = { cv: getCv(WW, world.skyH) };
			paintSky(e.cv, L, world.skyH, stars); work++;
			return e;
		}
		function lay(set, name) {
			var e = set.layers[name], src;
			if (e) { return e.cv; }
			src = world.layers[name];
			if (set.plain) { e = { cv: src, own: false }; } else { e = { cv: getCv(src.width, src.height), own: true }; tintInto(e.cv, src, set.L); work++; }
			set.layers[name] = e;
			return e.cv;
		}
		function fitView() {
			var tall;
			hw = sc.hostW || host.clientWidth || 1920; hh = sc.hostH || host.clientHeight || 1080;
			tall = hh > hw * 1.1;
			if (!WW || (tall ? 360 : 640) !== WW) { build(tall); }
			if (cv.width !== WW || cv.height !== WH) { cv.width = WW; cv.height = WH; }
			cv.style.width = WW + "px"; cv.style.height = WH + "px";
			s0 = Math.max(hw / WW, hh / WH);
			V.zmin = S.sharp >= 0.99 ? 1 : Math.max(1, Math.round(s0 / S.sharp) / s0);
			lastT = "";
		}

		// The look after the next one is got ready a piece a frame (sheet, sky, then each layer), so that when the day moves
		// on a step everything it needs is already there and no frame has to do all the re-colouring at once.
		// Each new piece is also drawn once, one pixel big, under the picture: the graphics card takes a canvas in the first time
		// it is drawn, and that is better paid for here than on the frame the piece is first needed.
		function warm() {
			var w0 = work, k, c;
			setN = getSet(nextL); if (work !== w0) { g.drawImage(setN.atlas, 0, 0, 1, 1); return; }
			if (world.skyH) { skyN = getSky(nextL); if (work !== w0) { g.drawImage(skyN.cv, 0, 0, 1, 1); return; } }
			for (k in used) { if (world.layers[k]) { c = lay(setN, k); if (work !== w0) { g.drawImage(c, 0, 0, 1, 1); return; } } }
			nextL = null;
		}
		function prime() {
			var k;
			primed = true;
			g.drawImage(A.cv, 0, 0, 1, 1); g.drawImage(setA.atlas, 0, 0, 1, 1); g.drawImage(setB.atlas, 0, 0, 1, 1);
			for (k in world.layers) { g.drawImage(world.layers[k], 0, 0, 1, 1); g.drawImage(lay(setA, k), 0, 0, 1, 1); g.drawImage(lay(setB, k), 0, 0, 1, 1); }
			if (world.warm) { for (k = 0; k < world.warm.length; k++) { g.drawImage(world.warm[k], 0, 0, 1, 1); } }
			// the same for the ways of drawing that only come up later in the day (adding light, filling a beam, re-colouring
			// a layer): used once now, so the first dusk does not stall a frame while the graphics card sets them up. The
			// looks themselves are left to warm(), which makes each one just before it is needed.
			g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.02; g.drawImage(A.cv, 0, 0, 1, 1);
			g.fillStyle = "rgba(255,255,255,0.02)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(2, 0); g.lineTo(0, 2); g.fill();
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			if (!tintPrimed) { tintPrimed = true; k = getCv(A.cv.width, A.cv.height); tintInto(k, A.cv, looks.dusk); g.drawImage(k, 0, 0, 1, 1); freeCv(k); }
		}
		// ---- what a world draws with
		D.layer = function (name, x, y, a) {
			var src = world.layers[name], cA, cB;
			if (!src) { return; }
			used[name] = true;
			a = a == null ? 1 : a; x = x || 0; y = y || 0;
			cA = lay(setA, name);
			if (setB === setA || fade <= 0.02) { g.globalAlpha = a; g.drawImage(cA, x, y); g.globalAlpha = 1; return; }
			cB = lay(setB, name);
			// a solid layer at full strength: the next lighting simply fades in over this one
			if (a > 0.995 && !SOFT[name]) { g.drawImage(cA, x, y); g.globalAlpha = fade; g.drawImage(cB, x, y); g.globalAlpha = 1; return; }
			// a see-through layer (mist, the wet road) or anything drawn faint: its two lightings are blended first and the
			// result drawn once, so that its strength does not swell and sink with every step of the day
			if (mixName !== name || mixFrame !== frameN) {
				if (!mixCv) { mixCv = K.canvas(WW, WH); mixG = mixCv.getContext("2d"); }
				mixG.globalCompositeOperation = "copy"; mixG.globalAlpha = 1; mixG.drawImage(cA, 0, 0);
				mixG.globalCompositeOperation = "source-atop"; mixG.globalAlpha = fade; mixG.drawImage(cB, 0, 0);
				mixName = name; mixFrame = frameN;
			}
			g.globalAlpha = a; g.drawImage(mixCv, 0, 0, src.width, src.height, x, y, src.width, src.height); g.globalAlpha = 1;
		};
		// now, in the light of the moment. Between two steps of the day a solid sprite is drawn in both lightings, the second
		// fading in; a see-through one (a shadow, a ripple) takes the nearer lighting, as blending it twice would darken it.
		D.spr = function (s, x, y) {
			x = Math.round(x) - s.ox; y = Math.round(y) - s.oy;
			if (s.soft) { g.drawImage(at, s.x, s.y, s.w, s.h, x, y, s.w, s.h); return; }
			g.drawImage(atA, s.x, s.y, s.w, s.h, x, y, s.w, s.h);
			if (xf > 0) { g.globalAlpha = xf; g.drawImage(atB, s.x, s.y, s.w, s.h, x, y, s.w, s.h); g.globalAlpha = 1; }
		};
		// now, in its own colours (lamps, lit windows), a = strength
		D.raw = function (s, x, y, a) { g.globalAlpha = a == null ? 1 : a; g.drawImage(A.cv, s.x, s.y, s.w, s.h, Math.round(x) - s.ox, Math.round(y) - s.oy, s.w, s.h); g.globalAlpha = 1; };
		D.glow = function (s, x, y, a) { g.globalCompositeOperation = "lighter"; g.globalAlpha = a == null ? 1 : a; g.drawImage(A.cv, s.x, s.y, s.w, s.h, Math.round(x) - s.ox, Math.round(y) - s.oy, s.w, s.h); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; };
		// later, in depth order: key = how far down the picture its feet are. a < 0 = lit by the day, else its own colours at that strength.
		D.add = function (s, x, y, key, a) { qs[qn] = s; qx[qn] = Math.round(x); qy[qn] = Math.round(y); qk[qn] = key == null ? y : key; qa[qn] = a == null ? -1 : a; qi[qn] = qn; qn++; };
		D.flush = function () {
			var i, j, v, kv, s, a, x, y;
			for (i = 1; i < qn; i++) { v = qi[i]; kv = qk[v]; j = i - 1; while (j >= 0 && qk[qi[j]] > kv) { qi[j + 1] = qi[j]; j--; } qi[j + 1] = v; }
			for (i = 0; i < qn; i++) {
				j = qi[i]; s = qs[j]; a = qa[j]; x = qx[j] - s.ox; y = qy[j] - s.oy;
				if (a < 0) {
					if (s.soft) { g.drawImage(at, s.x, s.y, s.w, s.h, x, y, s.w, s.h); }
					else { g.drawImage(atA, s.x, s.y, s.w, s.h, x, y, s.w, s.h); if (xf > 0) { g.globalAlpha = xf; g.drawImage(atB, s.x, s.y, s.w, s.h, x, y, s.w, s.h); g.globalAlpha = 1; } }
				} else if (a > 0.02) { g.globalAlpha = a > 1 ? 1 : a; g.drawImage(A.cv, s.x, s.y, s.w, s.h, x, y, s.w, s.h); g.globalAlpha = 1; }
			}
			qn = 0;
		};
		// a colour as the light of the moment would show it
		D.shade = function (c, a) { var t = cur.tint; return css([c[0] * t[0], c[1] * t[1], c[2] * t[2]], a); };

		function weather(dt) {
			var dawnish = phase > 0.9 || phase < 0.1;
			if (S.weather === "clear") { wx.rainTo = 0; wx.fogTo = 0; }
			else if (S.weather === "rain") { wx.rainTo = 0.9; wx.fogTo = 0.12; }
			else if (S.weather === "fog") { wx.rainTo = 0; wx.fogTo = 0.85; }
			else {
				wx.timer -= dt;
				if (wx.timer <= 0) { if (wx.rainTo > 0) { wx.rainTo = 0; wx.timer = 80 + rnd() * 120; } else { wx.rainTo = 0.45 + rnd() * 0.5; wx.timer = 35 + rnd() * 45; } }
				wx.fogTo = S.time === "cycle" && dawnish && wx.fogDay ? 0.7 : wx.rainTo > 0 ? 0.15 : 0;
			}
			wx.rain += clamp(wx.rainTo - wx.rain, -dt / 7, dt / 7); wx.fog += clamp(wx.fogTo - wx.fog, -dt / 12, dt / 12);
			X.rain = wx.rain; X.fog = wx.fog;
		}
		function tick() {
			simT += STEP;
			if (S.time === "cycle") { phase += STEP / DAYLEN; if (phase >= 1) { phase -= 1; wx.fogDay = rnd() < 0.6; } }
			weather(STEP);
			X.t = simT; X.p = phase;
			world.step(STEP, X);
		}
		function precip(dt) {
			var P = world.precip, n, i, k, col, x, y, amt = wx.rain, x0, y0, w, h;
			if (!P || amt < 0.02) { return; }
			x0 = P.x0 || 0; y0 = P.y0 || 0; w = (P.x1 || WW) - x0; h = (P.y1 || WH) - y0;
			if (!flakes) { flakes = new Float32Array(260 * 3); for (i = 0; i < 260; i++) { flakes[i * 3] = Math.random(); flakes[i * 3 + 1] = Math.random(); flakes[i * 3 + 2] = 0.4 + Math.random() * 0.6; } }
			n = Math.round((P.kind === "snow" ? 240 : 200) * amt * Math.min(1.2, w * h / 160000));
			if (n > 260) { n = 260; }
			if (P.kind === "snow") {
				g.fillStyle = D.shade([255, 255, 255], 0.92);
				for (i = 0; i < n; i++) {
					k = flakes[i * 3 + 2];
					flakes[i * 3 + 1] += dt * (10 + 22 * k) / h; flakes[i * 3] += dt * (Math.sin(simT * 1.1 + i) * 5 - 6 * k) / w;
					if (flakes[i * 3 + 1] > 1) { flakes[i * 3 + 1] -= 1; flakes[i * 3] = Math.random(); }
					if (flakes[i * 3] < 0) { flakes[i * 3] += 1; }
					x = x0 + Math.floor(flakes[i * 3] * w); y = y0 + Math.floor(flakes[i * 3 + 1] * h);
					if (k > 0.86) { g.fillRect(x, y, 2, 2); } else { g.fillRect(x, y, 1, 1); }
				}
			} else {
				col = D.shade([205, 222, 250], 0.5); g.fillStyle = col;
				for (i = 0; i < n; i++) {
					k = flakes[i * 3 + 2];
					flakes[i * 3 + 1] += dt * (190 + 150 * k) / h; flakes[i * 3] -= dt * 40 / w;
					if (flakes[i * 3 + 1] > 1) { flakes[i * 3 + 1] -= 1; flakes[i * 3] = Math.random() * 1.1; }
					x = x0 + Math.floor(flakes[i * 3] * w); y = y0 + Math.floor(flakes[i * 3 + 1] * h);
					g.fillRect(x, y, 1, 2); g.fillRect(x - 1, y + 2, 1, k > 0.7 ? 3 : 2);
				}
			}
		}
		function celestial() {
			var hz = world.horizon || world.skyH, u, alt, x, y, low, p = phase, i, s, a, sx, mxx;
			// the sun rides an arc from dawn to dusk, the moon from dusk to dawn
			sx = world.sunX || [0.1, 0.9]; mxx = world.moonX || [0.16, 0.84];
			u = ((p + 0.04 + 1) % 1) / 0.69;
			if (u <= 1) {
				alt = Math.sin(Math.PI * u); x = WW * (sx[0] + (sx[1] - sx[0]) * u); y = hz + 6 - alt * (hz - 8); low = clamp(1 - alt * 1.7, 0, 1);
				D.raw(core.sun, x, y, 1 - low); if (low > 0.02) { D.raw(core.sunLow, x, y, low); }
				D.sunX = x; D.sunLow = y < hz ? low : 0;
			} else { D.sunLow = 0; }
			u = (p - 0.67) / 0.31;
			if (u >= 0 && u <= 1) { alt = Math.sin(Math.PI * u); D.raw(core.moon, WW * (mxx[0] + (mxx[1] - mxx[0]) * u), hz + 10 - alt * (hz - 10) * 0.92, clamp(cur.stars * 1.3, 0, 1)); }
			if (cur.stars > 0.3) {
				g.fillStyle = "#ffffff";
				for (i = 0; i < stars.length; i += 5) { s = stars[i]; a = Math.sin(simT * s[4] + s[3]); if (a > 0.55 && s[1] < world.skyH) { g.globalAlpha = cur.stars * (a - 0.3); g.fillRect(s[0], s[1], 1, 1); if (a > 0.93) { g.fillRect(s[0] - 1, s[1], 3, 1); g.fillRect(s[0], s[1] - 1, 1, 3); } } }
				g.globalAlpha = 1;
			}
			// clouds move by the time that was simulated this frame, like everything else
			for (i = 0; i < clouds.length; i++) {
				s = clouds[i]; s.x += s.v * simDt;
				if (s.x > WW + 4) { s.x = -s.s.w - 4 - Math.random() * 30; }
				D.spr(s.s, s.x, s.y);
			}
		}
		function place() {
			var s = s0 * cam.z, vw = hw / s, vh = hh / s, cx = vw >= WW ? WW / 2 : clamp(cam.x, vw / 2, WW - vw / 2), cy = vh >= WH ? WH / 2 : clamp(cam.y, vh / 2, WH - vh / 2);
			var tx = clamp(Math.round(hw / 2 - (V.mirror ? WW - cx : cx) * s), Math.ceil(hw - WW * s), 0), ty = clamp(Math.round(hh / 2 - cy * s), Math.ceil(hh - WH * s), 0);
			var t = V.mirror ? "translate(" + (tx + Math.round(WW * s)) + "px," + ty + "px) scale(" + (-s).toFixed(4) + "," + s.toFixed(4) + ")" : "translate(" + tx + "px," + ty + "px) scale(" + s.toFixed(4) + ")";
			if (t !== lastT) { lastT = t; cv.style.transform = t; }
		}
		// While a world is being built: the sky of the moment, the bare ground, and whatever the world can already show.
		function preview(i) {
			var L = lookAt(looks, i / NSTEP), y0 = world.skyH ? (world.horizon || world.skyH) : 0;
			cur = L; fade = 0; xf = 0; setA = setB = getSet(L); skyA = skyB = getSky(L);
			D.t = simT; D.lit = L.lights; D.dt = 0; D.look = L; D.rain = 0; D.fog = 0; D.p = phase;
			if (skyA) { g.drawImage(skyA.cv, 0, 0); }
			g.fillStyle = D.shade(world.base || [120, 124, 132]); g.fillRect(0, y0, WW, WH - y0);
			if (world.first) { world.first(D); }
		}
		sc.onresize = fitView;
		fitView();
		weather(0); wx.rain = wx.rainTo; wx.fog = wx.fogTo;
		sc.frame = function (gg, dt) {
			var n = 0, f = phase * NSTEP, i = Math.floor(f), LA, LB, most;
			frameN++;
			if (!world) { return; }
			g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			if (!ready) { preview(i); return; }
			// the look of the moment: two neighbouring steps of the day, blended
			if (i !== stepI || !setA) {
				n = setA && stepI >= 0 ? 0 : 1;
				stepI = i;
				LA = lookAt(looks, i / NSTEP); LB = S.time === "cycle" ? lookAt(looks, (i + 1) / NSTEP) : LA;
				setA = getSet(LA); setB = getSet(LB); skyA = getSky(LA); skyB = getSky(LB);
				setN = skyN = null; nextL = S.time === "cycle" ? lookAt(looks, (i + 2) / NSTEP) : null;
				if (nextL) { setN = sets[tintKey(nextL)] || null; skyN = skies[skyKey(nextL)] || null; }
				dropSets(false);
				if (n) { for (LA in used) { if (world.layers[LA]) { lay(setA, LA); lay(setB, LA); } } n = 0; }
			}
			fade = S.time === "cycle" ? f - i : 0;
			cur = setA === setB ? setA.L : mixLook(setA.L, setB.L, fade);
			at = (fade < 0.5 ? setA : setB).atlas; atA = setA.atlas; atB = setB.atlas; xf = setB !== setA && fade > 0.02 ? fade : 0;
			X.lit = cur.lights; X.night = cur.lights > 0.6;
			// As many steps as the time since the last frame asks for at this speed. The kit never reports more than a tenth
			// of a second for one frame (a stall, or a hidden source), and that is what bounds the catching up: at the slowest
			// governed rate, 15 frames a second, every frame is still simulated in full.
			acc += dt * S.speed; most = Math.ceil(0.1 * S.speed / STEP) + 1;
			while (acc >= STEP && n < most) { tick(); acc -= STEP; n++; }
			if (acc >= STEP) { acc = 0; }
			simDt = n * STEP;
			D.t = simT; D.lit = cur.lights; D.dt = simDt; D.look = cur; D.rain = wx.rain; D.fog = wx.fog; D.p = phase;
			if (!primed) { prime(); }
			if (nextL) { warm(); }
			if (skyA) {
				g.drawImage(skyA.cv, 0, 0);
				if (skyB && skyB !== skyA && fade > 0.02) { g.globalAlpha = fade; g.drawImage(skyB.cv, 0, 0); g.globalAlpha = 1; }
				celestial();
			}
			world.draw(D);
			if (wx.fog > 0.02 && world.layers.mist) { mist(); }
			precip(simDt);
		};
		function mist() {
			var h = world.layers.mist.height, y0 = world.mistY0 == null ? 0 : world.mistY0, y1 = world.mistY1 == null ? WH : world.mistY1, n = Math.max(1, Math.ceil((y1 - y0) / (h * 0.7))), i, off, y;
			for (i = 0; i < n; i++) {
				off = Math.floor(simT * (3 + (i % 3) * 1.7) + i * 211) % WW; y = Math.round(y0 + i * h * 0.7 - h * 0.15);
				D.layer("mist", -off, y, wx.fog * 0.85); D.layer("mist", WW - off, y, wx.fog * 0.85);
			}
		}
		// The camera moves on every animation frame, the world is redrawn 30 times a second: a pan stays smooth and costs
		// nothing. A source the governor has slowed to 15 frames a second is still given its whole interval; only a real
		// stall (more than a tenth of a second) is cut short. An unfinished world gets its next few milliseconds here too.
		function camLoop(now) {
			if (!alive) { return; }
			camRaf = requestAnimationFrame(camLoop);
			var dt = camLast ? clamp((now - camLast) / 1000, 0, 0.1) : 0.016;
			camLast = now;
			if (job) {
				slice.end = performance.now() + 8;
				try { advance(); } catch (err) { job = null; if (window.console && console.error) { console.error("tiny world could not be built", err); } }
			}
			if (cam) { cam.update(dt); place(); }
		}
		camRaf = requestAnimationFrame(camLoop);
		function shut() { if (alive) { alive = false; cancelAnimationFrame(camRaf); release(); } }
		SSO.onCleanup(host, shut);
		return { stop: function () { shut(); sc.stop(); } };
	}
	function addWorld(id, def) {
		WORLDS[id] = def; ORDER.push(id);
		K.addEngine({ id: "tiny-" + id, label: "Tiny world: " + def.label, colors: def.colors, start: function (host, o) { return startWorld(id, host, o); } });
	}

	// ================================================================ 1. the ski hill
	// Seen like a trail map: the whole mountain face, summit at the top, lodge and lift at the bottom. Skiers queue, ride
	// the chairlift, pick a run, carve down leaving tracks, and now and then stop at the lodge. At night only the floodlit
	// run stays open and a groomer works the others.
	var SKI = {
		down: ["..hhh..", "..ggg..", "..fff..", ".jjjjj.", ".jjJjj.", "..jjj..", "..p.p..", "..p.p..", "..s.s..", "..s.s.."],
		left: ["...hhh.", "...ggg.", "...fff.", "..jjjjj", ".kjjJj.", "..jjj..", "..ppp..", "..p.p..", ".s.s...", "s.s...."],
		side: ["..hhh..", "..ghh..", "..ffh..", "..jjj..", ".kjjJ..", "..jjj..", "..ppp..", "..p.p..", "..b.b..", "sssssss"],
		step: ["..hhh..", "..ghh..", "..ffh..", "..jjj..", "..jjJk.", "..jjj..", "..ppp..", "...p...", "...b...", "sssssss"],
		sit: ["..hhh..", "..ggg..", "..fff..", ".jjjjj.", ".jjJjj.", ".kpppk.", "..p.p..", "..b.b..", ".ss.ss."],
		fall: [".......", "s....s.", ".s.hh..", "..jjhf.", ".pjjj..", "p..k.s.", "....s.."],
		sat: ["..hhh..", "..ggg..", "..fff..", ".kjjjk.", "..jjj..", ".ppppp.", "ss...ss"],
		skate: ["..hhh..", "..hhh..", "..ffh..", "..jjj..", ".kjjJ..", "..jjj..", "..ppp..", "..p.p..", ".bb.bb."],
		glide: ["..hhh..", "..hhh..", "..ffh..", ".kjjj..", "..jjJk.", "..jjj..", "..ppp..", ".p..p..", "bb...bb"],
		bleft: ["...hhh.", "...ggg.", "...fff.", "..jjjjj", ".kjjJj.", "..jjj..", "..ppp..", "..p.p..", "..BBBB.", "BBBB..."],
		bdown: ["..hhh..", "..ggg..", "..fff..", ".jjjjj.", ".jjJjj.", "..jjj..", "..p.p..", "..p.p..", ".BBBBB."]
	};
	function pineSprite(h, R, snowy) {
		var w = Math.round(h * 0.62) | 1, cx = w >> 1, tiers = h > 16 ? 4 : 3;
		return K.bake(w, h, function (g) {
			var r, t, tier, tt, half, x, lit, sn, body = h - 2;
			for (r = 0; r < body; r++) {
				t = r / body; tier = Math.floor(t * tiers); tt = t * tiers - tier;
				half = Math.max(0, Math.round((0.18 + 0.82 * tt) * cx * (0.42 + 0.58 * (tier + 1) / tiers) - 0.2));
				for (x = cx - half; x <= cx + half; x++) {
					lit = x < cx - half * 0.15; sn = snowy && tt < 0.42 && x <= cx + half * 0.35 && (tier > 0 || r > 0);
					g.fillStyle = sn ? (lit ? "#f6f9fd" : "#c9daee") : lit ? (tt > 0.75 ? "#2c6b55" : "#3a8862") : (tt > 0.6 ? "#16393a" : "#1f4d46");
					g.fillRect(x, r, 1, 1);
				}
			}
			g.fillStyle = "#f6f9fd"; g.fillRect(cx, 0, 1, 1);
			g.fillStyle = "#5b3e2c"; g.fillRect(cx, body, 1, 2); g.fillStyle = "#3d2a20"; g.fillRect(cx + 1, body, 1, 1);
		});
	}
	function lodgeSprite(acc, lit) {
		// lit = only the glowing parts (windows, door), for the night
		return K.bake(72, 52, function (g) {
			var x, y, half, yy, wood = "#8b5a3c", woodD = "#69412e", woodL = "#a9764f", stone = "#8f939e", stoneD = "#6b6f7e", snow = "#f6f9fd", snowS = "#c4d6ec", a = css(acc), aD = css(mul(acc, 0.7));
			var glass = lit ? "#ffd98a" : "#33405e", glassL = lit ? "#fff3c4" : "#5a6c94";
			function win(wx, wy, ww, wh) {
				if (!lit) { box(g, wx - 1, wy - 1, ww + 2, wh + 2, woodD); box(g, wx - 2, wy, 1, wh, a); box(g, wx + ww + 1, wy, 1, wh, a); }
				box(g, wx, wy, ww, wh, glass); box(g, wx, wy, ww, 1, glassL);
				if (!lit) { box(g, wx + (ww >> 1), wy, 1, wh, woodD); box(g, wx - 1, wy + wh + 1, ww + 2, 1, snow); }
			}
			if (!lit) {
				// gable wall and the timber floor under it
				for (y = 8; y <= 26; y++) { half = Math.round((y - 8) / 18 * 30); box(g, 36 - half, y, half * 2, 1, y % 3 === 0 ? woodD : wood); }
				box(g, 8, 26, 56, 14, wood);
				for (y = 28; y < 40; y += 3) { box(g, 8, y, 56, 1, woodD); }
				box(g, 8, 26, 1, 14, woodL); box(g, 63, 26, 1, 14, woodD);
				// stone footing
				box(g, 7, 40, 58, 9, stone);
				for (y = 41; y < 49; y += 3) { for (x = 8 + ((y & 1) * 3); x < 63; x += 7) { box(g, x, y, 4, 2, stoneD); } }
				box(g, 7, 40, 58, 1, "#a9adb8");
				// chimney
				box(g, 50, 6, 6, 14, stone); box(g, 54, 6, 2, 14, stoneD); box(g, 49, 4, 8, 2, snow); box(g, 49, 6, 8, 1, snowS);
				// the roof: a thick snow slab on both slopes, dark eaves under it
				for (x = -34; x <= 34; x++) {
					yy = Math.round(6 + Math.abs(x) * 18 / 30);
					box(g, 36 + x, yy - 3, 1, 4, snow); box(g, 36 + x, yy + 1, 1, 1, snowS); box(g, 36 + x, yy + 2, 1, 2, x < 0 ? "#5e3b2c" : "#472b21");
				}
				box(g, 34, 2, 5, 2, snow);
				// balcony
				box(g, 18, 24, 36, 1, woodL); for (x = 18; x < 54; x += 3) { box(g, x, 21, 1, 3, woodL); } box(g, 18, 20, 36, 1, woodL); box(g, 18, 19, 36, 1, snow);
				// door, step, a rack of skis and a bench
				box(g, 32, 37, 9, 12, woodD); box(g, 33, 38, 7, 11, aD); box(g, 33, 38, 7, 1, a); box(g, 38, 43, 1, 1, "#ffd98a");
				box(g, 30, 49, 13, 2, "#d9e4f2");
				box(g, 10, 44, 9, 1, woodD); box(g, 11, 38, 1, 11, "#e5483f"); box(g, 13, 39, 1, 10, "#3d8fe0"); box(g, 15, 38, 1, 11, "#f2b233"); box(g, 17, 40, 1, 9, "#2fb37a");
				box(g, 52, 45, 10, 1, woodL); box(g, 53, 46, 1, 3, woodD); box(g, 60, 46, 1, 3, woodD); box(g, 52, 44, 10, 1, snow);
				// snow lying against the footing
				for (x = 0; x < 72; x++) { yy = 49 - Math.round(1.5 + 1.5 * Math.sin(x * 0.5) * Math.sin(x * 0.13)); if (x < 30 || x > 42) { box(g, x, yy, 1, 52 - yy, snow); } }
			}
			win(14, 30, 6, 6); win(23, 30, 6, 6); win(45, 30, 6, 6); win(54, 30, 6, 6);
			win(27, 13, 5, 6); win(40, 13, 5, 6);
			if (lit) { box(g, 33, 38, 7, 3, "#ffe7a8"); }
		});
	}
	function stationSprite(acc, top) {
		return K.bake(26, 22, function (g) {
			var a = css(acc), aD = css(mul(acc, 0.68)), steel = "#7b8499", steelD = "#4c5368";
			box(g, 3, 0, 20, 2, "#f6f9fd"); box(g, 2, 2, 22, 1, "#c4d6ec");
			box(g, 2, 3, 22, 7, a); box(g, 2, 8, 22, 2, aD); box(g, 14, 3, 10, 7, aD);
			box(g, 5, 4, 16, 3, "#2b3550"); box(g, 5, 4, 16, 1, "#566a96");
			box(g, 4, 10, 2, 12, steel); box(g, 20, 10, 2, 12, steelD); box(g, 5, 10, 1, 12, "#a3adc0");
			// the big wheel the cable turns round
			box(g, 6, 11, 14, 2, steelD); box(g, 7, 10, 12, 1, steel); box(g, 12, 9, 2, 5, steelD);
			if (!top) { box(g, 0, 20, 26, 2, "#e4edf7"); }
		});
	}

	function* skiBuild(E) {
		var W = E.W, H = E.H, R = E.R, rnd = E.rnd, A = E.A, tall = E.tall, acc = E.accent;
		var baseY = Math.round(H * (tall ? 0.85 : 0.885)), px = Math.round(W * 0.44), py = Math.round(H * (tall ? 0.14 : 0.11));
		var kL = (tall ? 118 : 106) / Math.pow(px, 1.15), kR = (tall ? 128 : 120) / Math.pow(W - px, 1.15);
		function ridge(x) { var d = x - px; return py + Math.pow(Math.abs(d), 1.15) * (d < 0 ? kL : kR) + (fbm(x / 22, 3, 11, 3) - 0.5) * 20 * Math.min(1, Math.abs(d) / 26); }
		var T = { x: px + 4, y: Math.round(ridge(px + 4) + 24) }, B = { x: Math.round(W * 0.63), y: baseY - 6 };
		var D = dist(T.x, T.y, B.x, B.y), ux = (T.x - B.x) / D, uy = (T.y - B.y) / D, nx = -uy, ny = ux, TURN = 10, LC = 2 * D + 2 * TURN, HANG = 11;
		var lodge = { x: Math.round(W * 0.3), y: baseY + 9 }, garage = { x: Math.round(W * 0.87), y: baseY + 10 }, door = { x: lodge.x, y: lodge.y + 1 };
		var P0 = [T.x - 13, T.y + 7], rink = tall ? { x: Math.round(W * 0.5), y: baseY + 40, rx: 64, ry: 13 } : { x: Math.round(W * 0.115), y: baseY + 12, rx: 46, ry: 10 };
		var runs = [
			{ P: makePath([P0, [W * 0.3, H * 0.36], [W * 0.14, H * 0.55], [W * 0.21, H * 0.71], [W * 0.42, H * 0.81], [B.x - 30, baseY + 2]]), hw: tall ? 15 : 19 },
			{ P: makePath([[P0[0] + 18, P0[1] + 2], [W * 0.6, H * 0.33], [W * 0.8, H * 0.47], [W * 0.87, H * 0.63], [W * 0.78, H * 0.77], [B.x + 34, baseY + 4]]), hw: tall ? 12 : 15 },
			{ P: makePath([[P0[0] + 4, P0[1] + 6], [W * 0.4, H * 0.42], [W * 0.47, H * 0.6], [W * 0.4, H * 0.73], [B.x - 58, baseY + 1]]), hw: tall ? 9 : 11 }
		];
		var runD = new Float32Array(W * H), runI = new Int8Array(W * H), props = [], skiers = [], chairs = [], queue = [], QMAX = 9, i, j;
		var tracks = K.canvas(W, H), tg = tracks.getContext("2d"), lights = K.canvas(W, H), dots = makeDots(160), fadeT = 0, smokeT = 0, inside = 0;
		var spr = { sk: [], pines: [], pinesBare: [] }, groom = { on: false, s: 0, x: garage.x, y: garage.y, wait: 6, P: null, up: true, lx: -99, ly: -99 };
		var world = { layers: {}, skyH: Math.min(H, py + 150), horizon: py + 112, sunX: [0.02, 0.92], moonX: [0.46, 0.98], clouds: 6, precip: { kind: "snow" } };
		world.base = [226, 236, 248]; world.first = function (Dr) { if (world.layers.terrain) { Dr.layer("terrain"); } };
		yield world;

		// ---- where the runs are (distance to the nearest run edge, negative inside)
		yield* (function* () {
			var r, s, cx, cy, rr, x, y, d, k, P, x0, x1, y0, y1;
			for (k = 0; k < runD.length; k++) { runD[k] = 99; }
			for (r = 0; r < runs.length; r++) {
				P = runs[r].P;
				for (s = 0; s <= P.len; s += 2) {
					if (E.late()) { yield; }
					cx = pathX(P, s); cy = pathY(P, s); rr = runs[r].hw * (0.86 + 0.28 * vn(s / 34, r * 7, 5)) * Math.min(1, 0.45 + s / 50); d = rr + 14;
					x0 = Math.max(0, Math.floor(cx - d)); x1 = Math.min(W - 1, Math.ceil(cx + d)); y0 = Math.max(0, Math.floor(cy - d)); y1 = Math.min(H - 1, Math.ceil(cy + d));
					for (y = y0; y <= y1; y++) { for (x = x0; x <= x1; x++) { k = y * W + x; d = dist(x, y, cx, cy) - rr; if (d < runD[k]) { runD[k] = d; runI[k] = r; } } }
				}
			}
			// the flat ground round the lodge and the lift
			for (y = baseY - 16; y < H; y++) { for (x = 0; x < W; x++) { k = y * W + x; d = baseY - 9 + (vn(x / 18, 1, 9) - 0.5) * 8 - y; if (d < runD[k]) { runD[k] = d; runI[k] = 3; } } }
		})();
		function liftD(x, y) { var t = clamp(((x - B.x) * ux + (y - B.y) * uy) / D, 0, 1); return dist(x, y, B.x + ux * D * t, B.y + uy * D * t); }

		// ---- sprites
		yield* (function* () {
			var JACK = [acc, [229, 72, 63], [242, 178, 51], [61, 143, 224], [155, 89, 208], [47, 179, 122], [255, 123, 176], [240, 244, 248], [255, 140, 60], [40, 190, 200]];
			var HELM = [[44, 48, 66], [240, 240, 246], [229, 72, 63], [61, 143, 224], [250, 204, 70]], PANT = [[40, 46, 70], [66, 70, 88], [30, 32, 44], [96, 72, 60], [52, 86, 120]], SKIN = [[244, 205, 170], [224, 172, 130], [170, 118, 84], [250, 220, 196]];
			var v, pal, o, k;
			for (v = 0; v < 10; v++) {
				if (E.late()) { yield; }
				pal = { h: css(HELM[v % 5]), g: "#1e2230", f: css(SKIN[v % 4]), j: css(JACK[v]), J: css(mul(JACK[v], 0.72)), p: css(PANT[(v * 3) % 5]), s: "#39405a", b: "#20232e", k: "#2a2d3c", B: css(JACK[(v + 4) % 10]) };
				o = {};
				for (k in SKI) { o[k] = pix(SKI[k], pal); }
				spr.sk.push({
					down: A.add(o.down), left: A.add(o.left), right: A.add(flip(o.left)), side: A.add(o.side), sideR: A.add(flip(o.side)), step: A.add(o.step), stepR: A.add(flip(o.step)),
					sit: A.add(o.sit), fall: A.add(o.fall), sat: A.add(o.sat), skate: A.add(o.skate), skateR: A.add(flip(o.skate)), glide: A.add(o.glide), glideR: A.add(flip(o.glide)), bleft: A.add(o.bleft), bright: A.add(flip(o.bleft)), bdown: A.add(o.bdown)
				});
			}
			for (v = 0; v < 6; v++) { spr.pines.push(A.add(pineSprite(13 + (v % 3) * 4 + (v > 2 ? 1 : 0), R, true))); }
			spr.pines.push(A.add(pineSprite(27, R, true))); spr.pines.push(A.add(pineSprite(31, R, true)));
			spr.chair = A.add(pix(["....c....", "....c....", "....c....", ".ccccccc.", ".c.....c.", ".c.....c.", ".c.....c.", ".c.....c.", ".aaaaaaa.", ".ddddddd."], { c: "#4d556b", a: css(acc), d: "#2c3144" }), 4, 0);
			spr.tower = A.add(pix(["wwwwwwwww", "w...l...w", "....ld...", "....ld...", "....ld...", "....ld...", "....ld...", "....ld...", "....ld...", "....ld...", "....ld...", "....ld...", "...lldd..", "..sssssss"], { w: "#4f5870", l: "#97a1b6", d: "#4a5268", s: "#e4edf7" }), 4, 13);
			spr.lodge = A.add(lodgeSprite(acc, false), 36, 51); spr.lodgeLit = A.add(lodgeSprite(acc, true), 36, 51);
			spr.base = A.add(stationSprite(acc, false), 13, 22); spr.top = A.add(stationSprite(acc, true), 13, 22);
			spr.pole = A.add(pix([".lll.", "ldddl", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", "..d..", ".sds."], { l: "#c9d2e0", d: "#565e74", s: "#e4edf7" }));
			spr.poleLit = A.add(pix(["yyy", "www"], { y: "#fff6c8", w: "#ffffff" }), 1, 16);
			spr.lamp = A.add(haloSprite(5, E.lamp), 5, 5);
			spr.garage = A.add(K.bake(24, 17, function (g) {
				box(g, 1, 0, 22, 3, "#f6f9fd"); box(g, 0, 3, 24, 1, "#c4d6ec"); box(g, 1, 4, 22, 13, "#7c8498"); box(g, 1, 4, 1, 13, "#a3adc0"); box(g, 22, 4, 1, 13, "#565e74");
				box(g, 5, 7, 14, 10, "#2a3046"); box(g, 5, 7, 14, 1, "#4a5270"); for (var y = 9; y < 17; y += 2) { box(g, 5, y, 14, 1, "#353c56"); }
			}));
			spr.garageLit = A.add(K.bake(24, 17, function (g) { box(g, 10, 4, 4, 2, "#ffe7a8"); }));
			spr.groomUp = A.add(pix([".bbbbbbbbb.", "t.........t", "tt.rrrrr.tt", "tt.rgggr.tt", "tt.rgggr.tt", "tt.rrrrr.tt", "tt.RRRRR.tt", "tt.RRRRR.tt", "tt.......tt", "t.ccccccc.t", ".ccccccccc."], { b: "#c9d2e0", t: "#262a38", r: css(acc), R: css(mul(acc, 0.7)), g: "#9fd4f2", c: "#5d6578" }), 5, 6);
			spr.groomDn = A.add(pix([".ccccccccc.", "t.ccccccc.t", "tt.......tt", "tt.RRRRR.tt", "tt.rrrrr.tt", "tt.rgggr.tt", "tt.rgggr.tt", "tt.rrrrr.tt", "tt.yrrry.tt", "t.........t", ".bbbbbbbbb."], { b: "#c9d2e0", t: "#262a38", r: css(acc), R: css(mul(acc, 0.7)), g: "#9fd4f2", c: "#5d6578", y: "#fff2b0" }), 5, 6);
			spr.beam = A.add(poolSprite(15, 11, [255, 240, 190], 0.75), 15, 11);
			spr.flag = [A.add(pix(["paaa", "paa.", "p...", "p...", "p...", "p..."], { p: "#565e74", a: css(acc) }), 0, 6), A.add(pix(["p.aa", "paaa", "p...", "p...", "p...", "p..."], { p: "#565e74", a: css(acc) }), 0, 6)];
			spr.wing = A.add(pix(["...aaaaaaa...", ".aabbbbbbbaa.", "ab.........ba", "l...........l", ".l.........l.", "..l.......l..", "...l.....l...", "....l...l....", ".....hhh.....", ".....jjj.....", ".....p.p....."], { a: css(acc), b: "#fff3c4", l: "#69718a", h: "#f0f0f6", j: "#3d8fe0", p: "#2a2d3c" }), 6, 11);
			spr.bird = [A.add(pix(["d.d", ".d."], { d: "#2b3348" }), 1, 1), A.add(pix([".d.", "d.d"], { d: "#2b3348" }), 1, 1)];
			spr.snowman = A.add(pix(["..kk..", ".wwww.", ".wkwk.", "..ww..", "rwwwwr", ".wwww.", "wwwwww", "wwwwww", ".wwww."], { w: "#ffffff", k: "#2a2d3c", r: "#e5483f" }));
		})();

		// ---- the mountain, painted once
		yield* (function* () {
			var cv = K.canvas(W, H), g = cv.getContext("2d"), img = g.createImageData(W, H), d = img.data, x, y, k, p, il, lev, q, f, c, rd, dTop, rk, s, sl, r, P, t, e, key;
			var SNOW = [[255, 255, 255], [240, 246, 252], [216, 230, 246], [186, 208, 237], [152, 180, 222], [122, 152, 204]];
			var ROCK = [[150, 156, 172], [112, 120, 140], [82, 88, 110], [58, 62, 84]], rockM = new Uint8Array(W * H), pk1, pk2, ICE = [[226, 240, 250], [200, 226, 246], [176, 210, 240]];
			function peaks(fa) {
				var n = fa.length, sm = new Float32Array(n), pk = new Int16Array(n), xx, pp, guard;
				for (xx = 0; xx < n; xx++) { sm[xx] = (fa[Math.max(0, xx - 2)] + fa[Math.max(0, xx - 1)] + fa[xx] + fa[Math.min(n - 1, xx + 1)] + fa[Math.min(n - 1, xx + 2)]) / 5; }
				for (xx = 0; xx < n; xx++) { pp = xx; guard = 0; while (guard++ < n) { if (pp > 0 && sm[pp - 1] < sm[pp]) { pp--; } else if (pp < n - 1 && sm[pp + 1] < sm[pp]) { pp++; } else { break; } } pk[xx] = pp; }
				return pk;
			}
			var rY = new Float32Array(W), f1 = new Float32Array(W), f2 = new Float32Array(W), hgt = new Float32Array(W * H), trees = [], lg = lights.getContext("2d"), pool;
			for (x = 0; x < W; x++) {
				rY[x] = ridge(x);
				f1[x] = py + 96 - Math.pow(fbm(x / 70 + 3, 1, 71, 4), 1.4) * 150; f2[x] = py + 122 - Math.pow(fbm(x / 46 + 9, 5, 83, 4), 1.3) * 120;
			}
			for (y = 0; y < H; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					k = y * W + x; rd = runD[k]; r = rd < 0 ? 0.28 : Math.min(1, 0.28 + rd / 9 * 0.72);
					hgt[k] = fbm(x / 84, y / 130, 5, 3) * 74 + fbm(x / 24, y / 38, 9, 2) * 17 * r + vn(x / 4.6, y / 4.6, 21) * 2.6 * r;
					dTop = y - rY[x];
					if (dTop >= 3 && rd > 4 && ((fbm(x / 15, y / 8, 31, 3) + (1 - dTop / 64) * 0.42 > 1.02 && dTop < 96) || (dTop > 44 && y < baseY - 34 && fbm(x / 36, y / 9, 47, 3) > 0.735 && rd > 9))) { rockM[k] = 1; }
				}
			}
			pk1 = peaks(f1); pk2 = peaks(f2);
			for (y = 0; y < H; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					k = y * W + x; p = k * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16;
					if (y < rY[x]) {
						// the far ranges: a lit face, a shaded face, and haze low down
						if (y >= f2[x]) { e = y - f2[x]; sl = (x - pk2[x]) + (vn(x / 6, y / 6, 3) - 0.5) * 7 - (y - f2[pk2[x]]) * 0.4; c = e > 34 + q * 14 ? [150, 176, 218] : sl < -1 ? [228, 238, 250] : sl < 5 + q * 6 ? [190, 208, 238] : [164, 188, 228]; }
						else if (y >= f1[x]) { e = y - f1[x]; sl = (x - pk1[x]) + (vn(x / 6, y / 6, 4) - 0.5) * 7 - (y - f1[pk1[x]]) * 0.4; c = e > 40 + q * 14 ? [184, 204, 234] : sl < -1 ? [238, 244, 252] : sl < 5 + q * 6 ? [212, 226, 244] : [194, 212, 240]; }
						else { continue; }
					} else {
						rd = runD[k]; dTop = y - rY[x];
						il = x > 0 && x < W - 1 && y > 0 && y < H - 1 ? (hgt[k + 1] - hgt[k - 1]) * 0.9 + (hgt[k + W] - hgt[k - W]) * 0.55 : 0;
						e = ((x - rink.x) * (x - rink.x)) / (rink.rx * rink.rx) + ((y - rink.y) * (y - rink.y)) / (rink.ry * rink.ry);
						if (rockM[k]) {
							// rock: snow lying on its top edge, strata across it, darker toward its foot
							if (!rockM[k - W] || !rockM[k - 2 * W]) { c = SNOW[x > px ? 1 : 0]; }
							else { lev = 0.9 - il * 0.5 + (vn(x / 11, y / 1.7, 61) > 0.58 ? 1 : 0) + (rockM[k + W] && rockM[k + 2 * W] ? 0 : 1.2) + (x > px ? 0.6 : 0); c = ROCK[clamp(Math.floor(lev + q * 0.7), 0, 3)]; }
						} else if (e < 1) {
							// the skating rink: swept ice with a few long scratches
							c = e > 0.86 ? SNOW[3] : ICE[vn(x / 14, y / 2.2, 77) > 0.62 ? 0 : (y - rink.y) > rink.ry * 0.3 ? 2 : 1];
						} else {
							lev = 1.75 - il * 0.52 + (x > px ? 1.0 : -0.35) * Math.exp(-dTop / 48) - (dTop < 3 ? 1.2 : 0) + (y > 0 && rockM[k - W] ? 1.4 : 0) - (e < 1.25 ? 0.9 : 0);
							if (rd < 0) { lev -= 0.55; if (runI[k] === 2 && rd < -2 && ((x + (y >> 2) * 3) % 6) < 2 && (y % 4) < 2) { lev += 1.3; } } else if (rd < 1.6) { lev += 0.9; }
							c = SNOW[clamp(Math.floor(lev + q), 0, 5)];
						}
					}
					d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
				}
			}
			g.putImageData(img, 0, 0);
			// trees: in clumps between the runs, thinning toward the tree line. Those a skier could pass behind stay separate
			// sprites; the rest are painted into the mountain.
			for (y = 0; y < H + 14; y += 7) {
				if (E.late()) { yield; }
				for (x = -4; x < W + 4; x += 8) {
					t = { x: Math.round(x + R() * 7), y: Math.round(y + R() * 6) };
					k = clamp(t.y, 0, H - 1) * W + clamp(t.x, 0, W - 1); rd = runD[k]; dTop = t.y - rY[clamp(t.x, 0, W - 1)];
					f = fbm(t.x / 46, t.y / 52, 97, 3);
					e = t.y >= H + 5;
					if (!e && (rd < 6 || liftD(t.x, t.y) < 9 || dTop < 40 + f * 40 || dist(t.x, t.y, lodge.x, lodge.y - 16) < 46 || t.y > baseY - 10)) { continue; }
					if (!e && f < 0.47 - Math.min(0.12, dTop / 900) && R() > 0.07) { continue; }
					if (rockM[clamp(t.y, 0, H - 1) * W + clamp(t.x, 0, W - 1)] || (e && R() < 0.2)) { continue; }
					t.s = e ? spr.pines[6 + (R() < 0.5 ? 1 : 0)] : spr.pines[Math.floor(R() * 3) + (dTop > 110 && R() < 0.7 ? 3 : 0)];
					e = false;
					for (j = 3; j < 22 && !e; j += 3) { for (i = -4; i <= 4 && !e; i += 4) { q = (t.y - j) * W + t.x + i; if (t.y - j >= 0 && t.x + i >= 0 && t.x + i < W && t.y - j < H && runD[q] < 1) { e = true; } } }
					t.prop = e;
					trees.push(t);
				}
			}
			trees.sort(function (a, b) { return a.y - b.y; });
			g.fillStyle = "rgba(64,96,160,0.3)";
			for (i = 0; i < trees.length; i++) { t = trees[i]; g.fillRect(t.x - 1, t.y - 1, 6, 1); g.fillRect(t.x, t.y, 6, 1); g.fillRect(t.x + 2, t.y + 1, 4, 1); }
			world.treeBake = [];
			for (i = 0; i < trees.length; i++) { t = trees[i]; if (t.prop) { props.push({ s: t.s, x: t.x, y: t.y, k: t.y }); } else { world.treeBake.push(t); } }
			// marker poles down the edges of the runs
			for (r = 0; r < runs.length; r++) {
				P = runs[r].P;
				for (s = 26; s < P.len - 20; s += 23) {
					for (j = -1; j <= 1; j += 2) {
						t = pathA(P, s); x = Math.round(pathX(P, s) - Math.sin(t) * (runs[r].hw + 1) * j); y = Math.round(pathY(P, s) + Math.cos(t) * (runs[r].hw + 1) * j);
						box(g, x, y - 2, 1, 2, "#4a5068"); box(g, x, y - 3, 1, 1, r === 0 ? "#3d8fe0" : r === 1 ? "#e5483f" : "#20232e");
					}
				}
			}
			// the shadow of the cable, and a fence by the lift queue
			for (s = 6; s < D; s += 3) { box(g, B.x + ux * s + 3, B.y + uy * s + 2, 1, 1, "rgba(64,96,160,0.3)"); }
			for (x = B.x + 12; x < B.x + 66 && x < W - 4; x += 6) { box(g, x, B.y - 5, 1, 4, "#8a5a3c"); box(g, x, B.y - 6, 1, 1, "#f6f9fd"); box(g, x, B.y - 4, 6, 1, "#a9764f"); }
			world.layers.terrain = cv; world.tg = g;
			// lamps: pools on the snow down the floodlit run, by the lodge door and under the lift
			P = runs[0].P; pool = poolSprite(34, 19, mx(E.lamp, [255, 255, 255], 0.1), 0.5);
			for (s = 24, j = 1; s < P.len - 10; s += 44, j = -j) {
				t = pathA(P, s); x = Math.round(pathX(P, s) - Math.sin(t) * (runs[0].hw + 3) * j); y = Math.round(pathY(P, s) + Math.cos(t) * (runs[0].hw + 3) * j);
				props.push({ s: spr.pole, x: x, y: y + 1, k: y + 1 }); props.push({ s: spr.poleLit, x: x, y: y + 1, k: y + 1.1, lit: 1 }); props.push({ s: spr.lamp, x: x, y: y - 14, k: y + 1.2, lit: 0.8 });
				lg.drawImage(pool, Math.round(pathX(P, s)) - 34, Math.round(pathY(P, s)) - 19);
			}
			pool = poolSprite(40, 13, E.lamp, 0.6); lg.drawImage(pool, lodge.x - 40, lodge.y - 9);
			pool = poolSprite(26, 12, E.lamp, 0.5); lg.drawImage(pool, B.x - 20, B.y - 12); lg.drawImage(pool, T.x - 30, T.y - 8); lg.drawImage(pool, garage.x - 26, garage.y - 9);
		})();
		// now that the sprite sheet exists the far trees can go into the mountain (called once, after packing)
		world.init = function () {
			var g = world.tg, i, t, s;
			for (i = 0; i < world.treeBake.length; i++) { t = world.treeBake[i]; s = t.s; g.drawImage(A.cv, s.x, s.y, s.w, s.h, t.x - s.ox, t.y - s.oy, s.w, s.h); }
			world.treeBake = null; world.tg = null;
			E.touch("terrain");
		};

		// ---- things that stand on the mountain
		props.push({ s: spr.lodge, x: lodge.x, y: lodge.y, k: lodge.y }); props.push({ s: spr.lodgeLit, x: lodge.x, y: lodge.y, k: lodge.y + 0.1, lit: 1 });
		props.push({ s: spr.base, x: B.x + 2, y: B.y + 3, k: B.y - 4 }); props.push({ s: spr.top, x: T.x, y: T.y + 2, k: T.y - 6 });
		props.push({ s: spr.garage, x: garage.x, y: garage.y, k: garage.y }); props.push({ s: spr.garageLit, x: garage.x, y: garage.y, k: garage.y + 0.1, lit: 1 });
		props.push({ s: spr.snowman, x: lodge.x - 44, y: lodge.y + 2, k: lodge.y + 2 });
		for (i = 1; i <= 5; i++) { j = D * i / 6; props.push({ s: spr.tower, x: Math.round(B.x + ux * j), y: Math.round(B.y + uy * j), k: Math.round(B.y + uy * j) }); }
		props.sort(function (a, b) { return a.k - b.k; });
		// the two cables, drawn over everything that stands under them
		world.layers.cables = K.bake(W, H, function (g) {
			line(g, B.x + nx * 4, B.y - HANG + ny * 4, T.x + nx * 4, T.y - HANG + ny * 4, "#3b4257");
			line(g, B.x - nx * 4, B.y - HANG - ny * 4, T.x - nx * 4, T.y - HANG - ny * 4, "#3b4257");
		});
		world.layers.fog = yield* fogSteps(W, tall ? 150 : 110, 5, E.late);

		// ---- the lift
		for (i = 0; i < Math.floor(LC / 30); i++) { chairs.push({ u: i * LC / Math.floor(LC / 30), rider: null, x: 0, y: 0 }); }
		function chairAt(c) {
			var u = c.u, f, a;
			if (u < D) { c.x = B.x + nx * 4 + ux * u; c.y = B.y - HANG + ny * 4 + uy * u; }
			else if (u < D + TURN) { f = (u - D) / TURN; a = 4 * Math.cos(f * Math.PI); c.x = T.x + nx * a + ux * 3 * Math.sin(f * Math.PI); c.y = T.y - HANG + ny * a + uy * 3 * Math.sin(f * Math.PI); }
			else if (u < 2 * D + TURN) { f = u - D - TURN; c.x = T.x - nx * 4 - ux * f; c.y = T.y - HANG - ny * 4 - uy * f; }
			else { f = (u - 2 * D - TURN) / TURN; a = -4 * Math.cos(f * Math.PI); c.x = B.x + nx * a - ux * 3 * Math.sin(f * Math.PI); c.y = B.y - HANG + ny * a - uy * 3 * Math.sin(f * Math.PI); }
		}
		function slot(n) { return [B.x + 10 + n * 6, B.y + 3 + (n & 1)]; }

		// ---- the skiers
		var ST_QUEUE = 0, ST_RIDE = 1, ST_OFF = 2, ST_SKI = 3, ST_FALL = 4, ST_WALK = 5, ST_IN = 6;
		function goTo(k, x, y, then) { k.st = ST_WALK; k.tx = x; k.ty = y; k.then = then; }
		function joinQueue(k) { if (queue.length >= QMAX) { goTo(k, door.x + (rnd() - 0.5) * 6, door.y, ST_IN); return; } queue.push(k); k.st = ST_QUEUE; }
		function startRun(k, night) {
			var r = night ? 0 : rnd() < 0.4 ? 0 : rnd() < (k.board ? 0.75 : 0.55) ? 1 : 2;
			k.run = r; k.s = 0; k.ph = rnd() * TAU; k.amp = (runs[r].hw - 4) * (0.5 + rnd() * 0.5); k.wave = 44 + rnd() * 36; k.v = 10;
			goTo(k, pathX(runs[r].P, 0), pathY(runs[r].P, 0), ST_SKI);
		}
		for (i = 0; i < E.count(22, 6, 46); i++) {
			j = { st: ST_IN, x: door.x, y: door.y, tx: 0, ty: 0, then: 0, t: rnd() * 14, run: 0, s: 0, ph: 0, amp: 8, wave: 50, v: 0, v0: 30 + rnd() * 16, look: i % 10, board: i % 4 === 3, owl: i % 3 === 0, face: 0, frame: "side", walkT: rnd() };
			// start the day already going: some on the runs, some riding, some queuing
			if (i % 3 === 0) { j.st = ST_SKI; j.run = i % 2 ? 1 : (i % 4 ? 0 : 2); j.s = (0.1 + 0.8 * rnd()) * runs[j.run].P.len; j.ph = rnd() * TAU; j.amp = (runs[j.run].hw - 4) * (0.5 + rnd() * 0.5); j.wave = 44 + rnd() * 36; j.v = j.v0; }
			else if (i % 3 === 1 && queue.length < 6) { j.x = slot(queue.length)[0]; j.y = slot(queue.length)[1]; queue.push(j); j.st = ST_QUEUE; }
			skiers.push(j);
		}
		// riders already on the way up
		for (i = 0; i < chairs.length; i++) {
			if (chairs[i].u > 14 && chairs[i].u < D - 10 && i % 2 === 0) {
				for (j = 0; j < skiers.length; j++) { if (skiers[j].st === ST_IN) { skiers[j].st = ST_RIDE; skiers[j].chair = chairs[i]; chairs[i].rider = skiers[j]; break; } }
			}
		}
		function stepSkier(k, dt, X) {
			var P, a, off, lat, d, sp, tp, n;
			if (k.st === ST_IN) {
				k.t -= dt;
				if (k.t <= 0) { if (X.night && !k.owl) { k.t = 4 + rnd() * 6; } else { inside--; k.x = door.x; k.y = door.y; joinQueue(k); if (k.st === ST_WALK) { k.st = ST_IN; inside++; k.t = 5 + rnd() * 8; } } }
			} else if (k.st === ST_WALK) {
				d = dist(k.x, k.y, k.tx, k.ty); sp = 15 * dt;
				if (d <= sp) {
					k.x = k.tx; k.y = k.ty; k.st = k.then;
					if (k.st === ST_IN) { inside++; k.t = (X.night ? 14 : 7) + rnd() * 18; } else if (k.st === ST_SKI) { k.v = 8; }
				} else { k.face = k.tx < k.x ? 0 : 1; k.x += (k.tx - k.x) / d * sp; k.y += (k.ty - k.y) / d * sp; k.walkT += dt * 3; }
			} else if (k.st === ST_QUEUE) {
				n = queue.indexOf(k); tp = slot(n < 0 ? 0 : n); d = dist(k.x, k.y, tp[0], tp[1]); sp = 13 * dt; k.face = 0;
				if (d > sp) { k.x += (tp[0] - k.x) / d * sp; k.y += (tp[1] - k.y) / d * sp; k.walkT += dt * 3; k.ready = false; } else { k.x = tp[0]; k.y = tp[1]; k.ready = true; }
			} else if (k.st === ST_RIDE) {
				k.x = k.chair.x; k.y = k.chair.y + 14;
			} else if (k.st === ST_SKI) {
				P = runs[k.run].P;
				k.v += (k.v0 * (0.78 + 0.3 * Math.abs(Math.cos(k.ph))) - k.v) * dt * 1.6;
				k.s += k.v * dt; k.ph += k.v * dt / k.wave * TAU;
				if (k.s >= P.len) {
					k.x = pathX(P, P.len); k.y = pathY(P, P.len);
					if ((X.night && !k.owl) || rnd() < (X.night ? 0.3 : 0.2)) { goTo(k, door.x + (rnd() - 0.5) * 6, door.y, ST_IN); } else { joinQueue(k); }
					return;
				}
				a = pathA(P, k.s); off = k.amp * Math.sin(k.ph) * Math.min(1, k.s / 26, (P.len - k.s) / 30); lat = Math.cos(k.ph) * -Math.sin(a);
				k.x = pathX(P, k.s) - Math.sin(a) * off; k.y = pathY(P, k.s) + Math.cos(a) * off;
				k.frame = lat < -0.4 ? (k.board ? "bleft" : "left") : lat > 0.4 ? (k.board ? "bright" : "right") : (k.board ? "bdown" : "down");
				// the track it leaves, and spray on the outside of a hard turn
				tg.fillStyle = "rgba(56,88,156,0.2)"; tg.fillRect(Math.round(k.x), Math.round(k.y), k.board ? 2 : 1, 1);
				if (Math.abs(Math.sin(k.ph)) > 0.93 && rnd() < 0.5) { dots.add(k.x + (off > 0 ? 2 : -2), k.y - 1, (off > 0 ? 9 : -9) + rnd() * 4, -6 - rnd() * 5, 0.5, 1, 1, 0); }
				if (k.run > 0 && k.s > 50 && k.s < P.len - 70 && rnd() < dt * 0.011) { k.st = ST_FALL; k.t = 0; for (n = 0; n < 9; n++) { dots.add(k.x, k.y - 2, (rnd() - 0.5) * 30, -rnd() * 22, 0.5 + rnd() * 0.5, 1, 1 + (n & 1), 0); } }
			} else if (k.st === ST_FALL) {
				k.t += dt;
				if (k.t < 0.6) { k.s += k.v * dt * (1 - k.t / 0.6) * 0.7; P = runs[k.run].P; k.x += (pathX(P, k.s) - k.x) * 0.02; k.y = Math.max(k.y, pathY(P, k.s) - 4) + k.v * dt * 0.3 * (1 - k.t / 0.6); }
				if (k.t > 3.2) { k.st = ST_SKI; k.v = 6; k.amp = Math.abs(k.x - pathX(runs[k.run].P, k.s)) < 3 ? k.amp : k.amp * 0.6; k.ph = 0; }
			}
		}
		// skaters going round the rink, a paraglider off the summit now and then, a few birds
		var skaters = [], birds = [], glider = { on: false, wait: 12 + rnd() * 30, s: 0, x: 0, y: 0, gx: 0, gy: 0, P: makePath([[T.x - 22, T.y + 2], [W * 0.22, H * 0.3], [W * 0.1, H * 0.5], [W * 0.3, H * 0.62], [W * 0.2, H * 0.76], [lodge.x + 48, baseY + 4]]) };
		for (i = 0; i < E.count(4, 2, 7); i++) { skaters.push({ a: rnd() * TAU, r: 0.3 + 0.55 * rnd(), v: (0.45 + rnd() * 0.5) * (i % 3 === 2 ? -1 : 1), look: (i * 3 + 1) % 10, x: rink.x, y: rink.y, ph: rnd() * 9 }); }
		for (i = 0; i < 3; i++) { birds.push({ x: rnd() * W, y: py * 0.5 + rnd() * 50, v: 9 + rnd() * 7, ph: rnd() * 9 }); }
		function stepExtras(dt, X) {
			var n, k, f;
			for (n = 0; n < skaters.length; n++) {
				k = skaters[n]; k.a += k.v * dt * (0.9 + 0.35 * Math.sin(X.t * 0.6 + k.ph)); f = k.r + 0.12 * Math.sin(X.t * 0.23 + k.ph);
				k.x = rink.x + Math.cos(k.a) * rink.rx * f * 0.84; k.y = rink.y + Math.sin(k.a) * rink.ry * f * 0.78;
			}
			for (n = 0; n < birds.length; n++) { k = birds[n]; k.x += k.v * dt; if (k.x > W + 8) { k.x = -8; k.y = py * 0.4 + rnd() * 60; } }
			if (!glider.on) { glider.wait -= dt; if (glider.wait <= 0 && !X.night && X.rain < 0.25) { glider.on = true; glider.s = 0; } return; }
			glider.s += 13 * dt;
			if (glider.s >= glider.P.len) { glider.on = false; glider.wait = 45 + rnd() * 70; return; }
			glider.gx = pathX(glider.P, glider.s); glider.gy = pathY(glider.P, glider.s);
			glider.x = glider.gx + Math.sin(X.t * 0.9) * 1.5; glider.y = glider.gy - 3 - 50 * Math.pow(Math.sin(Math.PI * glider.s / glider.P.len), 0.8);
		}
		// the groomer's round: out of its shed, up one run, down the other, home
		yield* (function* () {
			var pts = [[garage.x, garage.y + 2], [garage.x - 16, garage.y + 5]], P = runs[1].P, s;
			for (s = P.len - 8; s > 30; s -= 26) { pts.push([pathX(P, s), pathY(P, s)]); }
			P = runs[2].P;
			for (s = 30; s < P.len - 6; s += 26) { pts.push([pathX(P, s), pathY(P, s)]); }
			pts.push([garage.x - 60, garage.y + 6]); pts.push([garage.x - 16, garage.y + 5]); pts.push([garage.x, garage.y + 2]);
			groom.P = makePath(pts);
		})();
		function stepGroomer(dt, X) {
			var a, k, cxp, cyp;
			if (!groom.on) {
				groom.wait -= dt;
				if (X.night && groom.wait <= 0) { groom.on = true; groom.s = 0; }
				return;
			}
			groom.s += 11 * dt;
			if (groom.s >= groom.P.len) { groom.on = false; groom.wait = 9; groom.x = garage.x; groom.y = garage.y; return; }
			a = pathA(groom.P, groom.s); groom.x = pathX(groom.P, groom.s); groom.y = pathY(groom.P, groom.s); groom.up = Math.sin(a) < 0;
			if (dist(groom.x, groom.y, groom.lx, groom.ly) >= 1 && groom.s > 30 && groom.s < groom.P.len - 60) {
				groom.lx = groom.x; groom.ly = groom.y;
				// corduroy: fine stripes across its width, wiping the old tracks under it
				for (k = -6; k <= 6; k++) {
					cxp = Math.round(groom.x - Math.sin(a) * k - Math.cos(a) * 5); cyp = Math.round(groom.y + Math.cos(a) * k - Math.sin(a) * 5);
					tg.clearRect(cxp, cyp, 1, 1); tg.fillStyle = k & 1 ? "rgba(255,255,255,0.5)" : "rgba(60,92,160,0.24)"; tg.fillRect(cxp, cyp, 1, 1);
				}
			}
		}

		world.warm = [lights, tracks];
		world.step = function (dt, X) {
			var i, c, u0, k;
			for (i = 0; i < chairs.length; i++) {
				c = chairs[i]; u0 = c.u; c.u += 16 * dt;
				if (c.u >= LC) { c.u -= LC; }
				chairAt(c);
				// set down at the top, pick up at the bottom
				if (u0 < D - 2 && c.u >= D - 2 && c.rider) { k = c.rider; c.rider = null; k.chair = null; k.x = c.x - 2; k.y = c.y + 15; startRun(k, X.night); }
				if (c.u < u0 && !c.rider && queue.length && queue[0].ready) { k = queue.shift(); k.st = ST_RIDE; k.chair = c; k.ready = false; c.rider = k; }
			}
			for (i = 0; i < skiers.length; i++) { stepSkier(skiers[i], dt, X); }
			stepGroomer(dt, X);
			stepExtras(dt, X);
			dots.step(dt);
			// the lodge chimney
			smokeT -= dt;
			if (smokeT <= 0) { smokeT = 0.42; dots.add(lodge.x + 16, lodge.y - 48, 2.5 + rnd() * 2, -6 - rnd() * 2, 4.2, 0, 2, 0.85); }
			// old tracks slowly fill in
			fadeT += dt;
			if (fadeT > 3) { fadeT = 0; tg.globalCompositeOperation = "destination-out"; tg.fillStyle = "rgba(0,0,0,0.13)"; tg.fillRect(0, 0, W, H); tg.globalCompositeOperation = "source-over"; }
		};
		for (i = 0; i < skiers.length; i++) { if (skiers[i].st === ST_IN) { inside++; } }

		world.draw = function (Dr) {
			var g = Dr.g, i, k, c, s, f, off;
			Dr.layer("terrain");
			g.drawImage(tracks, 0, 0);
			if (Dr.lit > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = Dr.lit; g.drawImage(lights, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
			g.fillStyle = "rgba(48,78,150,0.3)";
			for (i = 0; i < skiers.length; i++) { k = skiers[i]; if (k.st !== ST_IN && k.st !== ST_RIDE) { g.fillRect(Math.round(k.x) - 1, Math.round(k.y), 5, 1); } }
			for (i = 0; i < chairs.length; i++) { c = chairs[i]; g.fillRect(Math.round(c.x) - 1, Math.round(c.y) + HANG + 3, 5, 1); }
			for (i = 0; i < skaters.length; i++) { k = skaters[i]; g.fillRect(Math.round(k.x) - 1, Math.round(k.y), 4, 1); }
			if (glider.on) { g.fillRect(Math.round(glider.gx) - 3, Math.round(glider.gy), 7, 1); g.fillRect(Math.round(glider.gx) - 2, Math.round(glider.gy) + 1, 5, 1); }
			for (i = 0; i < props.length; i++) { k = props[i]; if (k.lit) { Dr.add(k.s, k.x, k.y, k.k, Dr.lit * k.lit); } else { Dr.add(k.s, k.x, k.y, k.k); } }
			for (i = 0; i < skiers.length; i++) {
				k = skiers[i]; s = spr.sk[k.look];
				if (k.st === ST_IN) { continue; }
				if (k.st === ST_RIDE) { Dr.add(s.sit, k.x, k.y, k.chair.y + HANG + 4.5); continue; }
				if (k.st === ST_SKI) { f = s[k.frame]; }
				else if (k.st === ST_FALL) { f = k.t < 0.9 ? s.fall : s.sat; }
				else { f = (k.st === ST_WALK || !k.ready) && (Math.floor(k.walkT) & 1) ? (k.face ? s.stepR : s.step) : (k.face ? s.sideR : s.side); }
				Dr.add(f, k.x, k.y + 1, k.y + 1);
			}
			for (i = 0; i < chairs.length; i++) { c = chairs[i]; Dr.add(spr.chair, c.x, c.y, c.y + HANG + 4); }
			if (groom.on) {
				Dr.add(groom.up ? spr.groomUp : spr.groomDn, groom.x, groom.y, groom.y + 4);
				Dr.add(spr.beam, groom.x + (groom.up ? 0 : 0), groom.y + (groom.up ? -15 : 15), groom.y + 4.1, Dr.lit * 0.8);
			}
			for (i = 0; i < skaters.length; i++) {
				k = skaters[i]; s = spr.sk[k.look]; f = (Math.floor(Dr.t * 1.6 + k.ph) & 1);
				Dr.add(Math.sin(k.a) * k.v > 0 ? (f ? s.glide : s.skate) : (f ? s.glideR : s.skateR), k.x, k.y + 1, k.y + 1);
			}
			if (glider.on) { Dr.add(spr.wing, glider.x, glider.y, H + 50); }
			if (Dr.lit < 0.5) { for (i = 0; i < birds.length; i++) { k = birds[i]; Dr.add(spr.bird[Math.floor(Dr.t * 5 + k.ph) & 1], k.x, k.y + Math.sin(Dr.t * 0.7 + k.ph) * 4, H + 60); } }
			Dr.add(spr.flag[Math.floor(Dr.t * 3) & 1], px + 1, Math.round(ridge(px + 1)) + 1, 0);
			Dr.flush();
			Dr.layer("cables");
			dots.draw(g, [Dr.shade([232, 238, 246], 0.85), Dr.shade([255, 255, 255])]);
			if (Dr.fog > 0.02) {
				off = Math.floor(Dr.t * 5) % W; f = world.layers.fog.height;
				Dr.layer("fog", -off, baseY - f - 30, Dr.fog * 0.9); Dr.layer("fog", W - off, baseY - f - 30, Dr.fog * 0.9);
				off = Math.floor(Dr.t * 3 + W / 2) % W;
				Dr.layer("fog", -off, py + 40, Dr.fog * 0.7); Dr.layer("fog", W - off, py + 40, Dr.fog * 0.7);
			}
		};
		function skiing(k) { return k.st === ST_SKI || k.st === ST_FALL; }
		function groomOn() { return groom.on; }
		function gliding() { return glider.on; }
		world.shots = function (push) {
			var i, k, best = null;
			for (i = 0; i < skiers.length; i++) { k = skiers[i]; if (k.st === ST_SKI && k.s < runs[k.run].P.len * 0.4 && (!best || k.s < best.s)) { best = k; } }
			if (best) { push("ski", 0, 0, 1.67, 3.4, best, 15, skiing); }
			push("lift", B.x + 12, B.y - 20, 1.67, 2, null, 12);
			push("top", T.x - 6, T.y + 12, 1.67, 1.5, null, 11);
			push("lodge", lodge.x + 4, lodge.y - 18, 1.67, 1.3, null, 10);
			push("rink", rink.x, rink.y - 8, 1.67, 1.1, null, 9);
			if (glider.on && glider.s < glider.P.len * 0.6) { push("glide", 0, 0, 1.67, 5, glider, 16, gliding); }
			if (groom.on && groom.s < groom.P.len - 120) { push("groom", 0, 0, 1.67, 4, groom, 14, groomOn); }
		};
		return world;
	}
	addWorld("skihill", {
		label: "ski hill", colors: ["6db2ea", "e5483f", "ffd98a"], flip: true,
		sky: { day: [[58, 124, 212], [112, 174, 236], [190, 222, 246]], dusk: [[52, 46, 112], [190, 96, 124], [255, 178, 116]], night: [[7, 11, 36], [15, 23, 62], [32, 44, 96]], dawn: [[82, 102, 176], [222, 154, 168], [255, 212, 180]] },
		build: skiBuild
	});

	// ================================================================ 2. the working harbour
	// Side on: a stone quay with a warehouse and a crane on the left, open sea and a lighthouse on the right. A ship comes
	// in, ties up at the end of the quay, the crane lifts its crates ashore one at a time, dockers carry them into the
	// warehouse, and it sails again. Fishing boats cross with their gulls, the tide creeps up and down the wall.
	var DOCKER = {
		stand: [".hhh..", ".hhhh.", ".fff..", ".jjj..", "jjsjj.", ".jjj..", ".ppp..", ".p.p..", ".p.p..", ".b.b.."],
		walk: [".hhh..", ".hhhh.", ".fff..", ".jjj..", "jjsjj.", ".jjj..", ".ppp..", ".ppp..", "..p...", "..b..."],
		lift: ["f...f.", "jhhhj.", ".hhhh.", ".fff..", ".jsj..", ".jjj..", ".ppp..", ".p.p..", ".p.p..", ".b.b.."],
		lift2: ["f...f.", "jhhhj.", ".hhhh.", ".fff..", ".jsj..", ".jjj..", ".ppp..", ".ppp..", "..p...", "..b..."]
	};
	function crateSprite(c) {
		return K.bake(8, 7, function (g) {
			box(g, 0, 0, 8, 7, css(mul(c, 0.62))); box(g, 1, 1, 6, 5, css(c)); box(g, 1, 1, 6, 1, css(mx(c, [255, 255, 255], 0.3)));
			g.fillStyle = css(mul(c, 0.8)); g.fillRect(1, 3, 6, 1); g.fillRect(3, 1, 1, 5);
		});
	}
	function shipSprite(hull, acc, kind) {
		// 128 wide, bow to the left, its bottom row on the waterline
		return K.bake(128, 54, function (g) {
			var x, y, t, l, r, hc = css(hull), hd = css(mul(hull, 0.72)), hl = css(mx(hull, [255, 255, 255], 0.25)), wh = "#eef1f4", whD = "#bcc6d2", a = css(acc), dk = "#2b3144";
			for (y = 0; y < 16; y++) {
				t = y / 15; l = Math.round(2 + 13 * t * t + (y < 3 ? 0 : 1)); r = 127 - Math.round(3 * t * t * t * 2);
				box(g, l, 38 + y, r - l, 1, y < 2 ? wh : y > 12 ? "#8a3b34" : (y > 9 ? hd : hc));
			}
			box(g, 6, 40, 112, 1, hl); box(g, 10, 50, 110, 1, "#e8e2d2");
			for (x = 24; x < 84; x += 9) { box(g, x, 43, 2, 2, dk); box(g, x, 43, 1, 1, "#9db4d0"); }
			box(g, 3, 36, 4, 2, hd); box(g, 2, 35, 2, 2, hd);
			// deck rail, hatch coaming
			box(g, 8, 37, 76, 1, whD); for (x = 8; x < 84; x += 5) { box(g, x, 35, 1, 2, whD); } box(g, 8, 34, 76, 1, "#d7dde6");
			box(g, 26, 36, 52, 2, "#59607a");
			// the house aft: two decks of white, a bridge, a funnel with a band of the accent colour
			if (kind === 1) {
				box(g, 88, 26, 30, 12, wh); box(g, 88, 26, 30, 1, whD); box(g, 112, 26, 6, 12, whD);
				for (x = 91; x < 112; x += 5) { box(g, x, 29, 3, 3, dk); box(g, x, 29, 3, 1, "#7f9ac0"); }
				box(g, 92, 18, 18, 8, wh); box(g, 92, 18, 18, 1, whD); box(g, 94, 20, 14, 3, dk); box(g, 94, 20, 14, 1, "#7f9ac0");
				box(g, 100, 8, 7, 10, dk); box(g, 100, 10, 7, 3, a); box(g, 99, 7, 9, 1, "#4a5068");
				box(g, 96, 4, 1, 14, "#8a93a6"); box(g, 94, 6, 5, 1, "#8a93a6");
			} else {
				box(g, 84, 24, 36, 14, wh); box(g, 84, 24, 36, 1, whD); box(g, 114, 24, 6, 14, whD);
				for (x = 87; x < 114; x += 5) { box(g, x, 27, 3, 3, dk); box(g, x, 27, 3, 1, "#7f9ac0"); box(g, x, 33, 3, 2, dk); }
				box(g, 88, 15, 22, 9, wh); box(g, 88, 15, 22, 1, whD); box(g, 90, 17, 18, 3, dk); box(g, 90, 17, 18, 1, "#7f9ac0");
				box(g, 110, 6, 8, 18, a); box(g, 110, 6, 8, 3, dk); box(g, 116, 6, 2, 18, css(mul(acc, 0.7))); box(g, 110, 12, 8, 2, wh);
				box(g, 92, 2, 1, 13, "#8a93a6"); box(g, 90, 5, 5, 1, "#8a93a6");
				box(g, 97, 21, 9, 3, "#e0723a"); box(g, 97, 21, 9, 1, "#f0a070");
			}
			// a derrick forward
			box(g, 20, 14, 2, 22, "#8a93a6"); line(g, 21, 15, 44, 30, "#6a7286"); box(g, 19, 12, 4, 2, "#6a7286");
			box(g, 9, 30, 1, 8, "#8a93a6"); box(g, 10, 30, 3, 2, a);
		});
	}
	function boatSprite(hull, cabin) {
		return K.bake(24, 17, function (g) {
			var hc = css(hull), y, l;
			for (y = 0; y < 5; y++) { l = y < 1 ? 0 : y; box(g, l, 12 + y, 23 - l - (y > 2 ? 1 : 0), 1, y === 0 ? "#f0f0ea" : y > 3 ? css(mul(hull, 0.6)) : hc); }
			box(g, 13, 6, 8, 6, css(cabin)); box(g, 13, 6, 8, 1, "#f4f4f0"); box(g, 15, 8, 4, 2, "#27304a"); box(g, 19, 6, 2, 6, css(mul(cabin, 0.75)));
			box(g, 9, 1, 1, 11, "#6b5a4a"); line(g, 9, 2, 2, 9, "#8a7a68"); box(g, 2, 9, 1, 3, "#8a7a68");
			box(g, 4, 10, 4, 2, "#c9a24a"); box(g, 16, 4, 1, 2, "#6b5a4a");
		});
	}

	function* harborBuild(E) {
		var W = E.W, H = E.H, R = E.R, rnd = E.rnd, A = E.A, tall = E.tall, acc = E.accent, lamp = E.lamp;
		var hz = Math.round(H * (tall ? 0.53 : 0.52)), waterY = Math.round(H * (tall ? 0.79 : 0.75)), quayY = waterY - 26, qx = Math.round(W * (tall ? 0.5 : 0.47)), NH = H - waterY + 10;
		var lx = Math.round(W * (tall ? 0.84 : 0.87)), HH = tall ? 50 : 36, ly = hz - HH - (tall ? 64 : 56), doorX = Math.round(qx * 0.24), jibY = quayY - 68, upY = jibY + 9, homeX = qx - 42, berth = qx + 78;
		var world = { layers: {}, skyH: hz + 2, horizon: hz, sunX: [0.1, 0.62], moonX: [0.3, 0.8], clouds: 6, precip: { kind: "rain" } };
		world.base = [50, 116, 176]; world.first = function (Dr) { if (world.layers.back) { Dr.layer("back"); } };
		yield world;
		var lights = K.canvas(W, H), lg = lights.getContext("2d"), spr = {}, dots = makeDots(120), i, j;
		var SEA = [[168, 212, 232], [112, 176, 214], [74, 144, 196], [50, 116, 176], [38, 94, 152], [30, 76, 130]];
		var ST = [[206, 198, 184], [172, 164, 154], [140, 134, 130], [112, 108, 110], [84, 84, 92]];
		var lamps = [], bollards = [], winds = [];

		// ---- sprites
		yield* (function* () {
			var k, v, pal, o, JK = [[240, 130, 40], [60, 110, 190], [70, 150, 110], [200, 70, 60], [90, 90, 110], acc], HM = [[250, 204, 60], [240, 240, 240], [250, 204, 60], [230, 110, 40], [250, 204, 60], [240, 240, 240]], SK = [[244, 205, 170], [200, 150, 110], [150, 104, 76]];
			spr.men = [];
			for (v = 0; v < 6; v++) {
				if (E.late()) { yield; }
				pal = { h: css(HM[v]), f: css(SK[v % 3]), j: css(JK[v]), s: "#f4f0d0", p: v % 2 ? "#2e3550" : "#3b4a6a", b: "#1f2230" }; o = {};
				for (k in DOCKER) { o[k] = pix(DOCKER[k], pal); }
				spr.men.push({ stand: A.add(o.stand, 2), walk: A.add(o.walk, 2), standL: A.add(flip(o.stand), 3), walkL: A.add(flip(o.walk), 3), lift: A.add(o.lift, 2), lift2: A.add(o.lift2, 2), liftL: A.add(flip(o.lift), 3), lift2L: A.add(flip(o.lift2), 3) });
			}
			spr.crates = [A.add(crateSprite([176, 128, 78]), 4), A.add(crateSprite(acc), 4), A.add(crateSprite([72, 140, 150]), 4), A.add(crateSprite([196, 168, 96]), 4)];
			spr.ships = [];
			[[[42, 62, 104], 0], [[150, 54, 48], 1], [[40, 44, 56], 0], [[46, 104, 96], 1]].forEach(function (d) {
				var cv = shipSprite(d[0], acc, d[1]);
				spr.ships.push({ l: A.add(cv, 64), r: A.add(flip(cv), 64) });
			});
			spr.shipGlow = [];
			[0, 1].forEach(function (kind) {
				var cv = K.bake(128, 54, function (g) {
					var x;
					if (kind === 1) { for (x = 91; x < 112; x += 5) { box(g, x, 29, 3, 3, "#ffe7a8"); } box(g, 94, 20, 14, 3, "#fff3c4"); box(g, 96, 3, 1, 1, "#ffffff"); }
					else { for (x = 87; x < 114; x += 5) { box(g, x, 27, 3, 3, "#ffe7a8"); } box(g, 90, 17, 18, 3, "#fff3c4"); box(g, 92, 1, 1, 1, "#ffffff"); }
					box(g, 9, 29, 1, 1, "#ff6a5a");
				});
				spr.shipGlow.push({ l: A.add(cv, 64), r: A.add(flip(cv), 64) });
			});
			spr.boats = [];
			[[[196, 70, 60], [240, 236, 222]], [[60, 120, 170], [246, 214, 120]], [[236, 230, 210], [70, 150, 130]], [[240, 170, 60], [236, 240, 244]]].forEach(function (d) {
				var cv = boatSprite(d[0], d[1]);
				spr.boats.push({ l: A.add(cv, 12), r: A.add(flip(cv), 12) });
			});
			spr.gull = [A.add(pix(["w...w", ".www.", "..w.."], { w: "#f6f8fb" }), 2, 2), A.add(pix([".....", ".www.", "w.w.w"], { w: "#f6f8fb" }), 2, 2), A.add(pix([".ww.", "wwwy", ".gg.", ".o.."], { w: "#f6f8fb", y: "#f0b030", g: "#c4ccd8", o: "#e08a30" }), 2, 4)];
			spr.row = [A.add(pix(["......hh........", "......jj........", "o.....jjj.....o.", ".o...kkkkk...o..", ".hhhhhhhhhhhhh..", "..hhhhhhhhhhh..."], { h: "#8a5a3c", j: "#3d8fe0", k: "#6b432f", o: "#d9c9a8" }), 8), A.add(pix(["......hh........", "......jj........", "......jjj.......", "ooo..kkkkk..ooo.", ".hhhhhhhhhhhhh..", "..hhhhhhhhhhh..."], { h: "#8a5a3c", j: "#3d8fe0", k: "#6b432f", o: "#d9c9a8" }), 8)];
			spr.sail = A.add(pix(["...w...", "...ww..", "..www..", "..wwww.", ".wwwww.", ".wwwwww", "...m...", "hhhhhhh", ".hhhhh."], { w: "#f8f6ee", m: "#6b5a4a", h: "#3a4a6a" }), 3);
			spr.buoy = A.add(pix(["..y..", "..d..", ".rrr.", ".rwr.", "rrrrr", ".rrr."], { y: "#ffe9a0", d: "#4a5068", r: "#d9483f", w: "#f4f0ea" }), 2);
			spr.buoyLit = A.add(poolSprite(5, 5, [255, 120, 100], 1), 5, 5);
			spr.angler = [A.add(pix(["..........r", ".........r.", "........r..", ".hh....r...", ".ff...r....", ".jjjkr.....", ".jjj.......", ".ppp.......", "..pp......."], { h: "#3a6a4a", f: "#e8c09a", j: css(acc), k: "#e8c09a", p: "#3b4a6a", r: "#5a4a3a" }), 2), A.add(pix(["........r..", "........r..", ".......r...", ".hh....r...", ".ff...r....", ".jjjkr.....", ".jjj.......", ".ppp.......", "..pp......."], { h: "#3a6a4a", f: "#e8c09a", j: css(acc), k: "#e8c09a", p: "#3b4a6a", r: "#5a4a3a" }), 2)];
			spr.cat = { walk: [A.add(pix(["t....cc", "t.cccce", ".cccccc", ".c.c.c."], { c: "#e0903a", t: "#c4741e", e: "#2a2a2a" }), 3), A.add(pix(["t....cc", ".tcccce", ".cccccc", "..c..c."], { c: "#e0903a", t: "#c4741e", e: "#2a2a2a" }), 3)], sit: A.add(pix([".cc.", ".ce.", "ccc.", "cccc", "cc.t"], { c: "#e0903a", t: "#c4741e", e: "#2a2a2a" }), 2) };
			spr.catL = [A.add(flip(pix(["t....cc", "t.cccce", ".cccccc", ".c.c.c."], { c: "#e0903a", t: "#c4741e", e: "#2a2a2a" })), 3), A.add(flip(pix(["t....cc", ".tcccce", ".cccccc", "..c..c."], { c: "#e0903a", t: "#c4741e", e: "#2a2a2a" })), 3)];
			spr.trolley = A.add(pix(["ddddddd", "daaaaad", ".d...d."], { d: "#3a4056", a: css(acc) }), 3, 0);
			spr.hook = A.add(pix(["..d..", ".ddd.", "d.d.d"], { d: "#2a2f40" }), 2, 0);
			spr.lampGlow = A.add(haloSprite(6, lamp), 6, 6);
						spr.flash = A.add(poolSprite(13, 13, [255, 246, 210], 1), 13, 13);
			spr.streak = A.add(K.bake(3, 26, function (g) { var y; for (y = 0; y < 26; y += 2) { g.fillStyle = css(lamp, 0.75 * (1 - y / 26)); g.fillRect(y % 4 ? 1 : 0, y, y % 4 ? 1 : 3, 1); } }), 1, 0);
			spr.shadeShip = A.add(K.bake(126, 7, function (g) { var y; for (y = 0; y < 7; y++) { dith(g, 2 + y * 2, y, 122 - 4 * y, 1, 0.5 - y * 0.065, "rgba(16,34,70,0.45)"); } }), 63, 0);
			spr.dinghy = [A.add(pix(["w............w", "hwwwwwwwwwwwwh", ".hhhhhhhhhhhh.", "..hhhhhhhhhh.."], { w: "#f2efe4", h: "#3d8fa0" }), 7), A.add(pix(["w............w", "hwwwwwwwwwwwwh", ".hhhhhhhhhhhh.", "..hhhhhhhhhh.."], { w: "#f2efe4", h: css(acc) }), 7), A.add(pix(["w............w", "hwwwwwwwwwwwwh", ".hhhhhhhhhhhh.", "..hhhhhhhhhh.."], { w: "#f2efe4", h: "#d9a441" }), 7)];
			spr.shadeShip.soft = true;
			spr.shadeBoat = A.add(K.bake(22, 5, function (g) { var y; for (y = 0; y < 5; y++) { dith(g, 1 + y, y, 20 - 2 * y, 1, 0.6 - y * 0.1, "rgba(16,34,70,0.5)"); } }), 11, 0);
			spr.shadeBoat.soft = true;
		})();

		// ---- the far side: sea to the horizon, a headland with the lighthouse, a town on the hill behind the quay
		world.layers.back = yield* bakeSteps(W, H, function* (g) {
			var x, y, t, lev, q, c, hy, top, n, hx0 = Math.round(W * (tall ? 0.6 : 0.7)), img, d, p, k, RK = [[206, 190, 164], [170, 150, 132], [128, 112, 108], [90, 80, 92]], GR = [[150, 186, 124], [118, 160, 112], [92, 136, 108]], h1 = [], h4 = [], hd = [];
			function head(xx) { var u = clamp((xx - hx0) / (W - hx0), 0, 1); return hz - HH * sstep(u * 1.9) * (0.9 + 0.1 * Math.sin(xx * 0.21)) - (vn(xx / 9, 2, 7) - 0.5) * 5 * Math.min(1, u * 5); }
			function hill(xx, s, base, amp) { return base - amp * fbm(xx / 60 + s, s, 13 + s, 3) - (tall ? 10 : 0); }
			img = g.createImageData(W, H); d = img.data;
			// the outlines of the hills and the headland, once for every column
			for (x = 0; x < W; x++) { h1[x] = hill(x, 1, hz - 6, tall ? 60 : 46); h4[x] = hill(x, 4, hz + 2, tall ? 56 : 40) + Math.max(0, x - qx * 0.7) * 0.5; hd[x] = head(x); }
			for (y = 0; y < H; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					p = (y * W + x) * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16; c = null;
					if (y >= hz) {
						t = (y - hz) / Math.max(1, waterY - 8 - hz); lev = y >= waterY - 8 ? 3 : t * 3;
						c = SEA[clamp(Math.floor(lev + q * 0.9), 0, 5)];
						if (y === hz) { c = [206, 232, 244]; }
					}
					// hills behind the quay: a far blue one, a nearer green one
					top = h1[x];
					if (y < hz && y >= top && x < qx + 70) { c = y - top < 2 ? [150, 178, 204] : [128, 160, 196]; }
					top = h4[x];
					if (y < hz && y >= top) { n = y - top; c = n < 1.5 ? [142, 184, 128] : GR[clamp(Math.floor(n / 14 + q + (vn(x / 7, y / 4, 5) - 0.5)), 0, 2)]; }
					// the headland
					if (x >= hx0) {
						hy = hd[x];
						if (y >= hy && y < hz + 5 + (vn(x / 5, 3, 9) * 3)) {
							n = y - hy;
							if (n < 3 + vn(x / 6, 1, 3) * 3) { c = GR[n < 1 ? 0 : 1]; }
							else { lev = 0.2 + n / 20 + (vn(x / 2.4, y / 13, 21) - 0.5) * 1.5 + (fbm(x / 13, y / 9, 27, 2) - 0.45) * 3 + (y > hz - 4 ? 1 : 0); c = RK[clamp(Math.floor(lev + q * 0.5), 0, 3)]; }
							if (y >= hz + 2 && vn(x / 2.5, y, 31) > 0.45) { c = [236, 244, 248]; }
						}
					}
					if (c) { d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; }
				}
			}
			g.putImageData(img, 0, 0);
			// houses up the hill, a church
			for (k = 0; k < (tall ? 22 : 34); k++) {
				x = Math.round(4 + R() * (qx + 30)); top = hill(x, 4, hz + 2, tall ? 56 : 40) + Math.max(0, x - qx * 0.7) * 0.5; y = Math.round(top + 6 + R() * Math.max(4, hz - top - 22));
				if (y > hz - 8) { continue; }
				n = 4 + Math.floor(R() * 3);
				box(g, x, y, n, 4, R() < 0.5 ? "#e8dcc4" : "#d8c8b0"); box(g, x + n - 1, y, 1, 4, "#b4a48c"); box(g, x - 1, y - 2, n + 2, 2, R() < 0.4 ? css(mx(acc, [150, 90, 70], 0.4)) : R() < 0.5 ? "#b0584a" : "#7c6a80"); box(g, x, y - 3, n, 1, "#c87a60");
				box(g, x + 1, y + 1, 1, 2, "#3a4a6a"); winds.push([x + 1, y + 1, 1, 2]);
				if (n > 4) { box(g, x + 3, y + 1, 1, 1, "#3a4a6a"); winds.push([x + 3, y + 1, 1, 1]); }
			}
			x = Math.round(qx * 0.62); y = Math.round(hill(x, 4, hz + 2, tall ? 56 : 40) + 5);
			box(g, x, y, 5, 9, "#ece4d0"); box(g, x + 4, y, 1, 9, "#b8ac94"); box(g, x + 1, y - 5, 3, 5, "#ece4d0"); box(g, x + 2, y - 9, 1, 4, "#6c7a90"); box(g, x + 1, y - 6, 3, 1, "#6c7a90"); box(g, x + 5, y + 3, 7, 6, "#e0d6c0"); box(g, x + 4, y + 2, 9, 1, "#8c5a50");
			winds.push([x + 2, y - 3, 1, 2]);
			// the lighthouse and the keeper's cottage
			y = Math.round(head(lx));
			box(g, lx - 20, y - 8, 13, 8, "#ece4d0"); box(g, lx - 9, y - 8, 2, 8, "#b8ac94"); box(g, lx - 21, y - 10, 15, 2, css(mul(acc, 0.8))); box(g, lx - 17, y - 5, 2, 3, "#3a4a6a"); box(g, lx - 12, y - 4, 2, 4, "#6b432f");
			winds.push([lx - 17, y - 5, 2, 3]);
			for (k = 0; k <= y - ly; k++) {
				t = k / (y - ly); n = Math.round(4 + 3 * t);
				c = (Math.floor(t * 4.2) & 1) ? css(acc) : "#f4f1ea";
				box(g, lx - n, ly + k, n * 2 + 1, 1, c); box(g, lx + n - 1, ly + k, 2, 1, (Math.floor(t * 4.2) & 1) ? css(mul(acc, 0.7)) : "#c4c8d0"); box(g, lx - n, ly + k, 1, 1, (Math.floor(t * 4.2) & 1) ? css(mx(acc, [255, 255, 255], 0.25)) : "#ffffff");
			}
			box(g, lx - 7, ly - 1, 15, 2, "#3a4056"); box(g, lx - 7, ly - 4, 1, 3, "#3a4056"); box(g, lx + 7, ly - 4, 1, 3, "#3a4056"); box(g, lx - 4, ly - 9, 9, 8, "#27304a"); box(g, lx - 3, ly - 8, 7, 6, "#bfe0ee"); box(g, lx - 1, ly - 8, 1, 6, "#27304a"); box(g, lx + 2, ly - 8, 1, 6, "#27304a");
			box(g, lx - 5, ly - 11, 11, 2, css(mul(acc, 0.8))); box(g, lx - 3, ly - 13, 7, 2, css(mul(acc, 0.8))); box(g, lx - 1, ly - 14, 3, 1, css(mul(acc, 0.8))); box(g, lx, ly - 18, 1, 4, "#3a4056");
			box(g, lx, ly + 14, 2, 4, "#27304a"); box(g, lx - 1, ly + 32, 2, 4, "#27304a");
			world.lampXY = [lx, ly - 5];
		});

		// ---- the quay: wall, flagstones, warehouse, office, fish shed, the crane
		world.layers.quay = yield* bakeSteps(W, H, function* (g) {
			var x, y, k, n, t, wx = Math.round(qx * 0.06), ww = Math.round(Math.min(104, qx * 0.36)), wh = tall ? 60 : 54, ox, bx;
			function brick(x0, y0, w, h, c1, c2, c3) {
				var xx, yy;
				box(g, x0, y0, w, h, css(c1));
				for (yy = y0 + 1; yy < y0 + h; yy += 3) { for (xx = x0 + ((yy & 1) ? 1 : 3); xx < x0 + w - 2; xx += 6) { box(g, xx, yy, 3, 1, css(R() < 0.5 ? c2 : c3)); } }
				box(g, x0, y0, 1, h, css(mx(c1, [255, 255, 255], 0.18))); box(g, x0 + w - 2, y0, 2, h, css(mul(c1, 0.74)));
			}
			function win(x0, y0, w, h) { box(g, x0 - 1, y0 - 1, w + 2, h + 2, "#e8e0cc"); box(g, x0, y0, w, h, "#2c3a58"); box(g, x0, y0, w, 1, "#6a86b0"); winds.push([x0, y0, w, h]); }
			function lampPost(x0) { box(g, x0, quayY - 22, 1, 22, "#3a4056"); box(g, x0 - 1, quayY - 2, 3, 2, "#3a4056"); box(g, x0 - 2, quayY - 24, 5, 2, "#3a4056"); box(g, x0 - 1, quayY - 22, 3, 2, "#e8e2c8"); lamps.push([x0, quayY - 21]); }
			// wall and top
			for (y = quayY; y < waterY + 14; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < qx; x++) {
					n = y - quayY; t = (x + (((y - quayY - 3) / 6) | 0) * 7) % 14;
					k = n < 1 ? 0 : n < 3 ? 1 : ((y - quayY - 3) % 6 === 0 || t === 0) ? 4 : 2 + (vn(x / 14, y / 6, 3) > 0.62 ? 1 : 0);
					if (y > waterY - 9 + vn(x / 5, 1, 4) * 3) { k = Math.min(4, k + 1); }
					g.fillStyle = y > waterY - 5 + vn(x / 4, 2, 8) * 3 && k < 4 ? (vn(x / 3, y / 2, 5) > 0.5 ? "#4f7a5e" : "#5f6f68") : css(ST[k]); g.fillRect(x, y, 1, 1);
				}
			}
			box(g, qx - 1, quayY + 1, 1, waterY + 13 - quayY, css(ST[4])); box(g, qx - 2, quayY, 2, 1, css(ST[0]));
			for (x = 14; x < qx - 10; x += 37) { box(g, x, quayY + 8, 2, 2, "#3a3a44"); box(g, x, quayY + 10, 2, 1, "#2a2a32"); }
			box(g, qx - 7, quayY + 2, 1, waterY + 12 - quayY, "#4a4f60"); box(g, qx - 4, quayY + 2, 1, waterY + 12 - quayY, "#4a4f60"); for (y = quayY + 4; y < waterY + 12; y += 3) { box(g, qx - 7, y, 4, 1, "#5d6376"); }
			// the warehouse: brick, slate roof, a wide door the dockers use, a hoist beam over it
			y = quayY - wh;
			brick(wx, y + 12, ww, wh - 12, [158, 84, 66], [176, 100, 78], [136, 70, 58]);
			for (k = 0; k <= 13; k++) { n = Math.round(k / 13 * (ww / 2 + 3)); box(g, wx + (ww >> 1) - n, y - 1 + k, n * 2, 1, k < 2 ? "#6c7890" : (k % 3 === 0 ? "#4f5870" : "#5d6880")); }
			box(g, wx - 3, y + 12, ww + 6, 2, "#3f465a");
			world.door = [wx + Math.round(ww * 0.34), quayY]; doorX = world.door[0];
			box(g, doorX - 12, quayY - 26, 24, 26, "#3a2a26"); box(g, doorX - 11, quayY - 25, 22, 25, "#20181a"); box(g, doorX - 11, quayY - 25, 22, 2, "#4a3a34"); box(g, doorX - 13, quayY - 28, 26, 2, "#e8e0cc");
			box(g, doorX + 12, quayY - 26, 7, 26, "#7a8a6a"); for (k = quayY - 24; k < quayY; k += 4) { box(g, doorX + 12, k, 7, 1, "#5f6e54"); }
			box(g, doorX - 3, quayY - 36, 12, 2, "#3a4056"); box(g, doorX + 7, quayY - 34, 1, 5, "#3a4056");
			for (x = wx + Math.round(ww * 0.62); x < wx + ww - 9; x += 12) { win(x, quayY - 34, 6, 7); win(x, quayY - 16, 6, 7); }
			win(wx + (ww >> 1) - 3, y + 4, 6, 5);
			box(g, wx + 4, quayY - 9, 9, 9, "#8a6a3a"); box(g, wx + 4, quayY - 9, 9, 1, "#b08a4a"); box(g, wx + 6, quayY - 15, 7, 6, "#9a743e"); box(g, wx + 6, quayY - 15, 7, 1, "#b08a4a");
			// the harbour office: pale walls, trim in the accent colour, a clock
			ox = wx + ww + (tall ? 5 : 12);
			if (ox + 40 < qx - 46) {
				y = quayY - (tall ? 70 : 62);
				box(g, ox, y + 8, 36, quayY - y - 8, "#ebe3cf"); box(g, ox + 33, y + 8, 3, quayY - y - 8, "#c2b8a0"); box(g, ox, y + 8, 1, quayY - y - 8, "#fbf6e8");
				for (k = 0; k <= 9; k++) { n = Math.round(k / 9 * 21); box(g, ox + 18 - n, y - 1 + k, n * 2, 1, k < 2 ? css(mx(acc, [255, 255, 255], 0.2)) : css(mul(acc, k % 2 ? 0.86 : 0.76))); }
				box(g, ox - 2, y + 8, 40, 2, css(mul(acc, 0.6)));
				disc(g, ox + 18, y + 17, 4, "#fbf8ee"); box(g, ox + 18, y + 14, 1, 4, "#2a2a32"); box(g, ox + 18, y + 17, 3, 1, "#2a2a32"); winds.push([ox + 16, y + 15, 5, 5, 0.5]);
				win(ox + 5, y + 27, 6, 8); win(ox + 25, y + 27, 6, 8); win(ox + 5, quayY - 20, 6, 9); win(ox + 25, quayY - 20, 6, 9);
				box(g, ox + 14, quayY - 15, 8, 15, css(mul(acc, 0.66))); box(g, ox + 15, quayY - 14, 6, 14, css(mul(acc, 0.86))); box(g, ox + 13, quayY - 17, 10, 2, "#e8e0cc");
				box(g, ox + 18, y - 12, 1, 11, "#5a6074"); world.flag = [ox + 19, y - 12];
				bx = ox + 36 + 8;
			} else { bx = ox; }
			// a fish shed with a striped awning, boxes and nets
			if (bx + 36 < qx - 104) {
				box(g, bx, quayY - 24, 32, 24, "#7d8c94"); box(g, bx + 29, quayY - 24, 3, 24, "#5f6c74"); for (k = quayY - 22; k < quayY; k += 4) { box(g, bx, k, 30, 1, "#6c7a82"); }
				box(g, bx - 1, quayY - 27, 34, 3, "#4d5a66");
				for (x = 0; x < 34; x += 4) { box(g, bx - 2 + x, quayY - 17, 2, 4, "#f4f0e4"); box(g, bx + x, quayY - 17, 2, 4, css(acc)); } box(g, bx - 2, quayY - 13, 36, 1, "#c8c0ac");
				box(g, bx + 3, quayY - 12, 12, 12, "#22262e"); winds.push([bx + 3, quayY - 12, 12, 9, 0.6]);
				box(g, bx + 18, quayY - 6, 6, 6, "#b9c6ce"); box(g, bx + 18, quayY - 6, 6, 1, "#e4eef2"); box(g, bx + 25, quayY - 4, 6, 4, "#b9c6ce"); box(g, bx + 25, quayY - 4, 6, 1, "#e4eef2");
			}
			// lamp posts, bollards, crane rails
			for (k = 0; k < (tall ? 2 : 4); k++) { lampPost(Math.round(qx * (0.12 + k * (tall ? 0.52 : 0.245)))); }
			box(g, Math.round(qx * 0.55), quayY - 1, qx - Math.round(qx * 0.55), 1, "#4a5068");
			for (x = 10; x < qx - 6; x += 29) { box(g, x, quayY - 4, 3, 4, "#2f3446"); box(g, x - 1, quayY - 5, 5, 2, "#414860"); bollards.push(x + 1); }
			// the crane: a lattice tower on the quay edge, a cab, a long jib out over the berth
			x = qx - 20;
			for (y = jibY + 6; y < quayY; y++) { box(g, x - 7, y, 2, 1, "#56607a"); box(g, x + 6, y, 2, 1, "#3d455c"); }
			for (y = jibY + 8; y < quayY - 6; y += 12) { line(g, x - 6, y, x + 6, y + 11, "#4a5269"); line(g, x + 6, y, x - 6, y + 11, "#4a5269"); box(g, x - 7, y, 15, 1, "#56607a"); }
			box(g, x - 10, quayY - 3, 21, 3, "#3d455c"); box(g, x - 9, quayY - 4, 5, 1, "#2a2f40"); box(g, x + 5, quayY - 4, 5, 1, "#2a2f40");
			box(g, x - 9, jibY - 7, 17, 13, css(acc)); box(g, x + 4, jibY - 7, 4, 13, css(mul(acc, 0.7))); box(g, x - 9, jibY - 7, 17, 1, css(mx(acc, [255, 255, 255], 0.3))); box(g, x - 6, jibY - 4, 8, 5, "#2c3a58"); box(g, x - 6, jibY - 4, 8, 1, "#7a96c0"); winds.push([x - 6, jibY - 4, 8, 5, 0.7]);
			box(g, x - 3, jibY - 20, 2, 13, "#56607a"); line(g, x - 2, jibY - 20, qx + 104, jibY - 3, "#4a5269"); line(g, x - 2, jibY - 20, qx - 74, jibY - 3, "#4a5269");
			box(g, qx - 76, jibY, 184, 2, "#56607a"); box(g, qx - 76, jibY - 4, 184, 1, "#6a7490");
			for (k = qx - 76; k < qx + 104; k += 8) { line(g, k, jibY - 4, k + 4, jibY, "#6a7490"); line(g, k + 4, jibY, k + 8, jibY - 4, "#4a5269"); }
			box(g, qx - 78, jibY - 4, 9, 10, "#3d455c"); box(g, qx - 78, jibY - 4, 9, 1, "#56607a");
			box(g, qx + 106, jibY - 5, 2, 8, "#3d455c");
			world.craneTop = [x - 2, jibY - 21];
		});
		// ---- the water in front: one strip that rides up and down with the tide
		world.layers.near = yield* bakeSteps(W, NH, function* (g) {
			var x, y, q, lev, c, img = g.createImageData(W, NH), d = img.data, p;
			for (y = 0; y < NH; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					p = (y * W + x) * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16;
					lev = 3 + Math.max(0, y - 16) / Math.max(1, NH - 16) * 2.2;
					// the wall darkens the water at its foot
					if (x < qx && y < 12) { lev += (1 - y / 12) * 1.4; }
					c = SEA[clamp(Math.floor(lev + q), 0, 5)];
					if (x < qx - 1 && y < 1 && vn(x / 3, 1, 2) > 0.35) { c = [206, 226, 238]; }
					d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
				}
			}
			g.putImageData(img, 0, 0);
		});
		world.layers.fog = yield* fogSteps(W, tall ? 140 : 96, 9, E.late);
		// ---- the near corner: a wooden jetty with pots and a lantern, a few rocks opposite
		var FH = 46, jw = Math.round(W * (tall ? 0.46 : 0.3));
		world.layers.fore = K.bake(W, FH, function (g) {
			var x, y, k, n;
			for (x = 6; x < jw; x += 21) { box(g, x, 22, 3, FH - 22, "#4a3528"); box(g, x, 22, 1, FH - 22, "#6e4f3a"); box(g, x - 1, 17, 5, 3, "#5c4232"); box(g, x - 1, 17, 5, 1, "#8a6a4c"); }
			box(g, 0, 20, jw, 4, "#7a5a40"); box(g, 0, 20, jw, 1, "#a98562"); box(g, 0, 23, jw, 1, "#4a3528");
			for (x = 5; x < jw; x += 7) { box(g, x, 21, 1, 2, "#5c4232"); }
			// lobster pots, a coil of rope, a crate, the lantern post
			for (k = 0; k < 3; k++) { x = 12 + k * 9 - (k === 2 ? 13 : 0); y = k === 2 ? 9 : 14; box(g, x, y, 8, 6, "#b08a4a"); box(g, x, y, 8, 1, "#d4b070"); for (n = 1; n < 8; n += 2) { box(g, x + n, y + 1, 1, 5, "#7a5a30"); } box(g, x, y + 3, 8, 1, "#7a5a30"); }
			box(g, jw - 46, 17, 7, 3, "#d8c9a0"); box(g, jw - 45, 16, 5, 1, "#d8c9a0"); box(g, jw - 44, 18, 3, 1, "#a89868");
			box(g, jw - 14, 0, 1, 20, "#3a4056"); box(g, jw - 16, 0, 5, 2, "#3a4056"); box(g, jw - 15, 2, 3, 3, "#e8e2c8");
			world.foreLamp = [jw - 14, H - FH + 3];
			// rocks in the far corner
			for (k = 0; k < 4; k++) { x = W - 14 - k * 17 + (k & 1) * 4; n = 9 - k * 2 + (k === 1 ? 4 : 0); ell(g, x, FH + 2, n + 5, n + 4, "#5f5a66"); ell(g, x - 2, FH + 1, n + 2, n + 2, "#8a8490"); ell(g, x - 4, FH - 1, n - 2, n - 1, "#aaa4ac"); }
		});
		// lights: windows, pools under the lamps
		yield* (function* () {
			var k, w, pool = poolSprite(26, 9, lamp, 0.55);
			for (k = 0; k < winds.length; k++) { w = winds[k]; if (R() < (w[4] ? 1 : 0.62)) { lg.fillStyle = css(mx(lamp, [255, 255, 255], R() * 0.3), w[4] || 0.9); lg.fillRect(w[0], w[1], w[2], w[3]); } }
			for (k = 0; k < lamps.length; k++) { lg.drawImage(pool, lamps[k][0] - 26, quayY - 8); }
			lg.fillStyle = css(lamp, 0.5); lg.fillRect(doorX - 11, quayY - 25, 22, 25);
			lg.drawImage(pool, doorX - 26, quayY - 8); lg.drawImage(pool, jw - 40, H - 30);
		})();

		// ---- the sea's moving glints (positions fixed, each winks to its own beat)
		var glints = new Float32Array(110 * 4);
		for (i = 0; i < 110; i++) { glints[i * 4] = Math.floor(R() * W); glints[i * 4 + 1] = Math.pow(R(), 1.5); glints[i * 4 + 2] = R() * TAU; glints[i * 4 + 3] = 0.5 + R() * 1.4; }

		// ---- who works here
		var tide = 0, tideT = rnd() * 200;
		var ship = { st: 0, x: W + 90, dir: -1, type: 0, wait: 2, crates: [], v: 0, bob: 0, toot: 0 }, crane = { st: 0, x: homeX, hy: upY, load: -1, job: null, t: 0, slot: 0 }, stack = [], claimed = 0, men = [], boats = [], gulls = [], cat = { x: qx * 0.5, tx: qx * 0.5, st: 0, t: 3, face: 1 }, rower = { x: W * 0.3, dir: 1 }, angX = Math.round(qx * 0.46), bite = 20 + rnd() * 20, beamA = rnd() * TAU, sail = { x: W * 0.55 };
		var S_GONE = 0, S_IN = 1, S_MOORED = 2, S_OUT = 3;
		function shipY() { return waterY + 7 + tide; }
		function deckY() { return shipY() - 17; }
		function loadShip() {
			var n = 4 + Math.floor(rnd() * 3), k;
			ship.crates = [];
			for (k = 0; k < n; k++) { ship.crates.push({ dx: -34 + (k % 3) * 9, dy: -Math.floor(k / 3) * 7, kind: Math.floor(rnd() * 4), taken: false }); }
		}
		function slotX(n) { return qx - 66 + (n % 3) * 9; }
		function slotY(n) { return quayY - Math.floor(n / 3) * 7; }
		for (i = 0; i < E.count(4, 2, 8); i++) { men.push({ st: 0, x: qx - 84 - i * 9, y: quayY, home: qx - 84 - i * 9, look: i % 6, face: 1, t: 0, carry: -1, walkT: rnd() * 4 }); }
		for (i = 0; i < 3; i++) { boats.push({ turn: qx + 46 + rnd() * (W - qx - 130), x: qx + 60 + (W - qx - 80) * (i * 0.34 + rnd() * 0.2), y: hz + 9 + i * Math.round((waterY - hz - 22) / 3) + (i === 2 ? 3 : 0), dir: i % 2 ? 1 : -1, v: 5 + rnd() * 4, look: (i + Math.floor(rnd() * 4)) % 4, wait: 0 }); }
		for (i = 0; i < E.count(9, 4, 14); i++) { gulls.push({ home: i % 4, a: rnd() * TAU, r: 8 + rnd() * 14, v: (0.6 + rnd() * 0.8) * (rnd() < 0.5 ? -1 : 1), h: 10 + rnd() * 12, x: 0, y: 0, ph: rnd() * 9 }); }
		// start mid-job: a ship alongside with part of its cargo already ashore
		ship.st = S_MOORED; ship.x = berth; ship.type = Math.floor(rnd() * 4); loadShip(); ship.crates[ship.crates.length - 1].taken = true; stack.push(1); stack.push(0);

		function approach(cur, tgt, sp, dt) { var d = tgt - cur, s = Math.min(sp, Math.abs(d) * 3.2 + 3) * dt; return Math.abs(d) <= s ? tgt : cur + (d > 0 ? s : -s); }
		function stepCrane(dt) {
			var c = crane, k, left = 0, ty;
			if (c.st === 0) {
				c.x = approach(c.x, homeX, 30, dt); c.hy = approach(c.hy, upY, 26, dt);
				if (ship.st === S_MOORED && stack.length < 6) {
					for (k = ship.crates.length - 1; k >= 0; k--) { if (!ship.crates[k].taken) { c.job = ship.crates[k]; c.st = 1; break; } }
				}
			} else if (c.st === 1) { c.x = approach(c.x, ship.x + c.job.dx * -ship.dir, 34, dt); if (c.x === ship.x + c.job.dx * -ship.dir) { c.st = 2; } }
			else if (c.st === 2) { ty = deckY() + c.job.dy - 10; c.hy = approach(c.hy, ty, 28, dt); if (c.hy === ty) { c.st = 3; c.t = 0.35; } }
			else if (c.st === 3) { c.t -= dt; if (c.t <= 0) { c.job.taken = true; c.load = c.job.kind; c.st = 4; } }
			else if (c.st === 4) { c.hy = approach(c.hy, upY, 28, dt); if (c.hy === upY) { c.st = 5; } }
			else if (c.st === 5) { c.slot = Math.min(5, stack.length); c.x = approach(c.x, slotX(c.slot), 34, dt); if (c.x === slotX(c.slot)) { c.st = 6; } }
			else if (c.st === 6) {
				c.slot = Math.min(5, stack.length); ty = slotY(c.slot) - 10; c.x = approach(c.x, slotX(c.slot), 34, dt); c.hy = approach(c.hy, ty, 28, dt);
				if (c.hy === ty && c.x === slotX(c.slot) && stack.length < 6) { stack.push(c.load); c.load = -1; c.st = 0; }
			}
			if (ship.st === S_MOORED && (c.st === 0 || c.st >= 4)) {
				for (k = 0; k < ship.crates.length; k++) { if (!ship.crates[k].taken) { left++; } }
				if (!left) { ship.st = S_OUT; ship.toot = 1.2; }
			}
		}
		function stepShip(dt) {
			var d;
			ship.bob = Math.sin(tideT * 9) * 0.6;
			if (ship.st === S_GONE) {
				ship.wait -= dt;
				if (ship.wait <= 0) { ship.st = S_IN; ship.dir = -1; ship.type = (ship.type + 1 + Math.floor(rnd() * 2)) % 4; ship.x = W + 80; ship.v = 26; loadShip(); }
			} else if (ship.st === S_IN) {
				d = ship.x - berth; ship.v = Math.max(3, Math.min(26, d * 0.45 + 2)); ship.x -= ship.v * dt;
				if (ship.x <= berth + 0.4) { ship.x = berth; ship.st = S_MOORED; ship.v = 0; }
				if (rnd() < dt * 4 * ship.v / 26) { dots.add(ship.x + 49 + rnd() * 3, shipY() - 49, 4 + rnd() * 3, -5 - rnd() * 3, 3, 0, 2, 0.9); }
			} else if (ship.st === S_OUT) {
				if (ship.toot > 0) { ship.toot -= dt; if (rnd() < dt * 22) { dots.add(ship.x + 36, shipY() - 40, (rnd() - 0.5) * 6, -9 - rnd() * 5, 1.6, 1, 2, 1.4); } return; }
				ship.v = Math.min(24, ship.v + 5 * dt); ship.x -= ship.v * dt;
				if (rnd() < dt * 4) { dots.add(ship.x + 49 + rnd() * 3, shipY() - 49, 4 + rnd() * 3, -5 - rnd() * 3, 3, 0, 2, 0.9); }
				if (ship.x < -90) { ship.st = S_GONE; ship.wait = 5 + rnd() * 9; }
			}
		}
		function stepMan(m, dt) {
			var tx, sp = 16 * dt;
			if (m.st === 0) {
				// free: is there a crate nobody has claimed?
				if (stack.length - claimed > 0) { claimed++; m.st = 1; } else if (Math.abs(m.x - m.home) > 1) { m.face = m.home > m.x ? 1 : -1; m.x += m.face * sp; m.walkT += dt * 4; }
			} else if (m.st === 1) {
				tx = slotX(1) - 8; m.face = tx > m.x ? 1 : -1;
				if (Math.abs(tx - m.x) <= sp) { m.x = tx; m.face = 1; if (stack.length) { m.carry = stack.pop(); claimed = Math.max(0, claimed - 1); m.st = 2; m.t = 0.5; } else { claimed = Math.max(0, claimed - 1); m.st = 0; } } else { m.x += m.face * sp; m.walkT += dt * 4; }
			} else if (m.st === 2) {
				if (m.t > 0) { m.t -= dt; return; }
				m.face = -1; m.x -= sp * 0.9; m.walkT += dt * 4;
				if (m.x <= doorX) { m.st = 3; m.t = 1.6 + rnd() * 1.8; m.carry = -1; }
			} else if (m.st === 3) { m.t -= dt; if (m.t <= 0) { m.st = 0; m.x = doorX; } }
		}
		function stepLife(dt, X) {
			var k, b, gl, tx, ty;
			for (k = 0; k < boats.length; k++) {
				b = boats[k];
				if (b.wait > 0) { b.wait -= dt; continue; }
				b.x += b.dir * b.v * dt;
				// out from the open sea to its fishing ground, a while with the nets, then home again
				if (b.dir < 0 && b.x < b.turn) { b.dir = 1; b.wait = 6 + rnd() * 10; }
				else if (b.dir > 0 && b.x > W + 30) { b.dir = -1; b.wait = 3 + rnd() * 10; b.look = Math.floor(rnd() * 4); b.turn = qx + 46 + rnd() * (W - qx - 130); }
			}
			for (k = 0; k < gulls.length; k++) {
				gl = gulls[k]; gl.a += gl.v * dt;
				if (gl.home < 3) { b = boats[gl.home]; tx = b.x; ty = b.y - 14; } else { tx = lx - 10; ty = ly + 6; }
				tx += Math.cos(gl.a) * gl.r * 1.5; ty += Math.sin(gl.a) * gl.r * 0.4 - gl.h + Math.sin(gl.a * 2.3 + gl.ph) * 2;
				gl.x += (tx - gl.x) * Math.min(1, dt * 1.6); gl.y += (ty - gl.y) * Math.min(1, dt * 1.6);
			}
			rower.x += rower.dir * 4.5 * dt; if (rower.x < -20 || rower.x > W + 20) { rower.dir = -rower.dir; }
			sail.x += 1.3 * dt; if (sail.x > W + 12) { sail.x = -12; }
			// the cat patrols the quay and sits a while
			if (cat.st === 0) { cat.t -= dt; if (cat.t <= 0) { cat.st = 1; cat.tx = 16 + rnd() * (qx - 70); cat.face = cat.tx > cat.x ? 1 : -1; } }
			else { cat.x += cat.face * 9 * dt; if ((cat.tx - cat.x) * cat.face <= 0) { cat.st = 0; cat.t = 4 + rnd() * 12; } }
			bite -= dt;
			if (bite <= 0) { bite = 22 + rnd() * 30; for (k = 0; k < 5; k++) { dots.add(angX + 9, waterY + tide - 1, (rnd() - 0.5) * 12, -10 - rnd() * 8, 0.6, 2, 1, 0); } }
			beamA += dt * 0.9;
		}
		world.warm = [lights];
		world.step = function (dt, X) {
			var k;
			world.lit = X.lit;
			tideT += dt / 38; tide = Math.sin(tideT) * 5;
			stepShip(dt); stepCrane(dt);
			for (k = 0; k < men.length; k++) { stepMan(men[k], dt); }
			stepLife(dt, X);
			dots.step(dt);
		};

		world.draw = function (Dr) {
			var g = Dr.g, i, k, b, s, y0, t = Dr.t, wy = Math.round(waterY + tide), sy, f, x, y, c, m, lit = Dr.lit, off, gx, dy, hook;
			Dr.layer("back");
			// glints on the far water, and a path of light under a low sun
			g.fillStyle = Dr.shade([226, 240, 248], 0.75);
			for (i = 0; i < 110; i++) {
				if (Math.sin(t * glints[i * 4 + 3] + glints[i * 4 + 2]) < 0.35) { continue; }
				y = hz + 2 + Math.floor(glints[i * 4 + 1] * (H - hz - 4)); x = glints[i * 4];
				if (x < qx && y > quayY - 2 && y < wy) { continue; }
				g.fillRect(x, y, 2 + ((i * 7) % 3) + (y > waterY ? 2 : 0), 1);
			}
			if (Dr.sunLow > 0.05) {
				// the sun's road across the water
				g.fillStyle = "rgba(255,214,150," + (Dr.sunLow * 0.8).toFixed(3) + ")";
				for (i = 0; i < 26; i++) { if (Math.sin(t * (1.1 + (i % 5) * 0.3) + i * 1.9) > -0.25) { y = hz + 2 + Math.floor(i * i * 0.2 + i * 1.1); k = 3 + Math.floor(i * 0.7); if (y < H) { g.fillRect(Math.round(Dr.sunX - k / 2 + Math.sin(i * 2.4 + t * 0.6) * (1 + i * 0.3)), y, k, 1); } } }
			}
			Dr.spr(spr.sail, sail.x, hz + 3);
			for (i = 0; i < boats.length; i++) {
				b = boats[i]; if (b.x > W + 26) { continue; }
				y = b.y + Math.round(Math.sin(t * 1.3 + i * 2) * 0.7);
				Dr.spr(spr.shadeBoat, b.x, y);
				Dr.spr(b.dir < 0 ? spr.boats[b.look].l : spr.boats[b.look].r, b.x, y);
				if (b.wait <= 0) { g.fillStyle = Dr.shade([236, 244, 250], 0.8); g.fillRect(Math.round(b.x - b.dir * 13) - 2, y, 4, 1); g.fillRect(Math.round(b.x - b.dir * 19) - 1, y + 1, 3, 1); }
				if (lit > 0.3) { Dr.raw(spr.lampGlow, b.x - b.dir * -3, y - 14, lit * 0.9); Dr.raw(spr.streak, b.x + b.dir * 3, y + 1, lit * 0.6); }
			}
			Dr.layer("quay");
			if (lit > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = lit; g.drawImage(lights, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
			Dr.layer("near", 0, wy);
			// glints on the near water
			g.fillStyle = Dr.shade([200, 226, 244], 0.55);
			for (i = 0; i < 110; i += 2) {
				if (Math.sin(t * glints[i * 4 + 3] * 0.8 + glints[i * 4 + 2] + 2) < 0.2) { continue; }
				g.fillRect((glints[i * 4] + Math.floor(t * 3)) % W, wy + 3 + Math.floor(glints[i * 4 + 1] * (H - wy - 3)), 3 + (i % 5), 1);
			}
			if (Dr.rain > 0.05) { g.fillStyle = Dr.shade([220, 236, 250], 0.7 * Dr.rain); for (i = 0; i < 40; i++) { k = (i * 97 + Math.floor(t * 7 + i * 0.37) * 131) % (W * 8); g.fillRect(k % W, hz + 4 + ((k * 7) % (H - hz - 6)), 2, 1); } }
			// lamps: glow at the head, a wavering streak on the water under each
			if (lit > 0.05) {
				for (i = 0; i < lamps.length; i++) { Dr.raw(spr.lampGlow, lamps[i][0], lamps[i][1], lit); Dr.raw(spr.streak, lamps[i][0] + Math.round(Math.sin(t * 1.6 + i) * 0.8), wy + 2, lit * 0.7); }
				Dr.raw(spr.streak, doorX + Math.round(Math.sin(t * 1.3) * 0.8), wy + 2, lit * 0.5);
			}
			// the angler on the edge, the cat, the flag
			Dr.spr(spr.angler[bite < 1.2 ? 1 : 0], angX, quayY + 3);
			g.fillStyle = Dr.shade([240, 240, 236]); g.fillRect(angX + 9, wy - (bite < 1.2 ? 2 : 0), 1, 1);
			g.fillStyle = Dr.shade([90, 90, 100], 0.6); for (y = quayY - 5; y < wy - 1; y += 2) { g.fillRect(angX + 9, y, 1, 1); }
			if (cat.st === 0) { Dr.spr(spr.cat.sit, cat.x, quayY); } else { Dr.spr((cat.face > 0 ? spr.cat.walk : spr.catL)[Math.floor(t * 6) & 1], cat.x, quayY); }
			if (world.flag) { g.fillStyle = Dr.shade(acc); f = Math.floor(t * 3) & 1; g.fillRect(world.flag[0], world.flag[1] + f, 4, 3); g.fillRect(world.flag[0] + 4, world.flag[1] + 1 - f, 3, 3); }
			// dockers and the crates waiting on the quay
			for (i = 0; i < stack.length; i++) { Dr.spr(spr.crates[stack[i]], slotX(i), slotY(i)); }
			for (i = 0; i < men.length; i++) {
				m = men[i]; if (m.st === 3) { continue; }
				s = spr.men[m.look]; f = Math.floor(m.walkT) & 1;
				if (m.carry >= 0) { Dr.spr(m.face > 0 ? (f ? s.lift2 : s.lift) : (f ? s.lift2L : s.liftL), m.x, m.y); Dr.spr(spr.crates[m.carry], m.x, m.y - 10); }
				else { Dr.spr(m.face > 0 ? (f && (m.st === 1 || Math.abs(m.x - m.home) > 1) ? s.walk : s.stand) : (f && (m.st === 1 || Math.abs(m.x - m.home) > 1) ? s.walkL : s.standL), m.x, m.y); }
			}
			// the ship, its cargo, the smudge it puts on the water
			if (ship.st !== S_GONE) {
				sy = Math.round(shipY() + ship.bob); s = spr.ships[ship.type];
				Dr.spr(spr.shadeShip, ship.x, sy);
				Dr.spr(s.l, ship.x, sy);
				for (i = 0; i < ship.crates.length; i++) { c = ship.crates[i]; if (!c.taken) { Dr.spr(spr.crates[c.kind], ship.x + c.dx, sy - 17 + c.dy); } }
				if (lit > 0.05) { Dr.raw(spr.shipGlow[ship.type % 2].l, ship.x, sy, lit); Dr.raw(spr.streak, ship.x + 34, sy + 1, lit * 0.6); Dr.raw(spr.streak, ship.x + 44, sy + 2, lit * 0.5); }
				if (ship.v > 2) { g.fillStyle = Dr.shade([236, 244, 250], 0.85); for (i = 0; i < 6; i++) { g.fillRect(Math.round(ship.x + 62 + i * 7 + Math.sin(t * 5 + i) * 2), sy - (i & 1), 5 - (i >> 1), 1); } g.fillRect(Math.round(ship.x - 64), sy - 1, 4, 1); g.fillRect(Math.round(ship.x - 66), sy, 7, 1); }
			}
			// little boats tied up at the wall and by the jetty, the rowing boat and the buoy
			for (i = 0; i < 4; i++) {
				x = i < 2 ? Math.round(qx * (0.22 + i * 0.44)) : jw + 12 + (i - 2) * 24; y = (i < 2 ? wy + 5 : H - 16 + (i - 2) * 6) + Math.round(Math.sin(t * 1.2 + i * 1.7) * 0.7);
				Dr.spr(spr.shadeBoat, x, y); Dr.spr(spr.dinghy[i % 3], x, y);
			}
			y = Math.round(wy + (H - wy) * 0.5); Dr.spr(spr.shadeBoat, rower.x, y); Dr.spr(spr.row[Math.floor(t * 1.4) & 1], rower.x, y);
			x = Math.round(W * (tall ? 0.72 : 0.8)); y = Math.round(wy + (H - wy) * 0.36 + Math.sin(t * 1.1) * 1);
			Dr.spr(spr.buoy, x, y); if (lit > 0.3 && (Math.floor(t * 0.8) & 1)) { Dr.raw(spr.buoyLit, x, y - 6, lit); }
			Dr.layer("fore", 0, H - FH);
			Dr.spr(spr.gull[2], 40, H - FH + 20); Dr.spr(spr.gull[2], jw - 30, H - FH + 20);
			if (lit > 0.05) { Dr.raw(spr.lampGlow, world.foreLamp[0], world.foreLamp[1], lit); }
			// the crane's trolley, cable and whatever hangs from it
			g.fillStyle = Dr.shade([42, 47, 64]); x = Math.round(crane.x); hook = Math.round(crane.hy);
			g.fillRect(x, jibY + 4, 1, Math.max(0, hook - jibY - 4));
			Dr.spr(spr.trolley, x, jibY + 2); Dr.spr(spr.hook, x, hook);
			if (crane.load >= 0) { Dr.spr(spr.crates[crane.load], x, hook + 10); }
			if (lit > 0.3) { Dr.raw(spr.lampGlow, world.craneTop[0], world.craneTop[1], lit * ((Math.floor(t * 1.2) & 1) ? 1 : 0.25)); }
			// gulls
			for (i = 0; i < gulls.length; i++) { k = gulls[i]; Dr.spr(spr.gull[Math.floor(t * 4 + k.ph) & 1], k.x, k.y); }
			for (i = 0; i < bollards.length; i += 3) { Dr.spr(spr.gull[2], bollards[i], quayY - 5); }
			dots.draw(g, [Dr.shade([210, 214, 222], 0.8), Dr.shade([250, 250, 250], 0.9), Dr.shade([170, 200, 230])]);
			// the lighthouse: a lamp always, and at night the beam swinging round
			if (lit > 0.15) {
				x = world.lampXY[0]; y = world.lampXY[1]; c = Math.cos(beamA); f = Math.abs(c);
				Dr.raw(spr.flash, x, y, lit * (0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(beamA)), 6)));
				// the beam: two flat wedges, long when it points along the coast, short as it swings toward or away from us
				k = Math.round((tall ? 260 : 420) * c); dy = 8 + 26 * f;
				if (Math.abs(k) > 6) {
					g.globalCompositeOperation = "lighter";
					for (i = 0; i < 4; i++) {
						m = [1, 0.62, 0.36, 0.18][i];
						g.fillStyle = "rgba(255,244,204," + (lit * 0.055).toFixed(3) + ")"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * m, y - dy * m); g.lineTo(x + k * m, y + dy * m); g.fill();
					}
					g.globalCompositeOperation = "source-over";
				}
			}
			if (Dr.fog > 0.02) {
				off = Math.floor(t * 4) % W; f = world.layers.fog.height;
				Dr.layer("fog", -off, hz - f * 0.45, Dr.fog); Dr.layer("fog", W - off, hz - f * 0.45, Dr.fog);
				off = Math.floor(t * 6 + W / 3) % W;
				Dr.layer("fog", -off, wy - f * 0.5, Dr.fog * 0.85); Dr.layer("fog", W - off, wy - f * 0.5, Dr.fog * 0.85);
			}
		};
		function shipMoving() { return ship.st === S_IN || ship.st === S_OUT; }
		world.shots = function (push) {
			if (ship.st === S_IN) { push("ship", 0, 0, 1.67, 4, ship, 13, shipMoving); }
			else if (ship.st === S_MOORED) { push("crane", qx + 16, quayY - 30, 1.67, 3.2, null, 15); }
			push("quay", doorX + qx * 0.22, quayY - 22, 1.67, 2, null, 12);
			push("light", lx - (tall ? 40 : 70), ly + 40, 1.67, world.lit > 0.5 ? 2.6 : 0.35, null, 11);
			for (var k = 0; k < boats.length; k++) { if (boats[k].x > qx + 60 && boats[k].x < W - 60) { push("boat", 0, 0, 2, 1.6, boats[k], 12, null); break; } }
		};
		ship.y = 0;
		Object.defineProperty(ship, "y", { get: function () { return shipY() - 26; } });
		return world;
	}
	addWorld("harbor", {
		label: "working harbour", colors: ["79bfe8", "d9483f", "ffd98a"],
		sky: { day: [[70, 142, 214], [128, 190, 234], [206, 232, 244]], dusk: [[60, 54, 122], [214, 110, 112], [255, 190, 120]], night: [[6, 10, 34], [14, 24, 60], [30, 46, 92]], dawn: [[96, 118, 184], [232, 168, 170], [255, 220, 186]] },
		build: harborBuild
	});

	// ================================================================ shared by the two worlds seen from above
	// n copies of a sprite that points east, turned through the full circle; pick one with turnIndex(angle, n).
	function rotSet(A, src, n) {
		// all n copies go on one strip (one canvas), turned with hard pixels from the bare pixel values in src
		var w = src.w, h = src.h, sd = src.d, size = Math.ceil(Math.sqrt(w * w + h * h)) | 1, out = [], i;
		var strip = K.bake(size * n, size, function (g) {
			var img = g.createImageData(size * n, size), d = img.data, k, a, ca, sa, x, y, dx, dy, u, v, p, q;
			for (k = 0; k < n; k++) {
				a = k * TAU / n; ca = Math.cos(a); sa = Math.sin(a);
				for (y = 0; y < size; y++) {
					for (x = 0; x < size; x++) {
						dx = x + 0.5 - size / 2; dy = y + 0.5 - size / 2;
						u = Math.floor(dx * ca + dy * sa + w / 2); v = Math.floor(-dx * sa + dy * ca + h / 2);
						if (u < 0 || v < 0 || u >= w || v >= h) { continue; }
						p = (v * w + u) * 4; q = (y * size * n + k * size + x) * 4;
						d[q] = sd[p]; d[q + 1] = sd[p + 1]; d[q + 2] = sd[p + 2]; d[q + 3] = sd[p + 3];
					}
				}
			}
			g.putImageData(img, 0, 0);
		});
		for (i = 0; i < n; i++) { out.push(A.add(strip, size >> 1, size >> 1, i * size, 0, size, size)); }
		return out;
	}
	// A small picture as bare pixel values { w, h, d: RGBA bytes }, from rows of characters like pix(). The turned sets are
	// made from these, so that nothing has to be read back from a canvas (which stalls the page while the graphics card answers).
	function pixData(rows, pal) {
		var h = rows.length, w = rows[0].length, d = new Uint8ClampedArray(w * h * 4), x, y, c, p;
		for (y = 0; y < h; y++) { for (x = 0; x < w; x++) { c = pal[rows[y].charAt(x)]; if (c) { c = rgb(c); p = (y * w + x) * 4; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; } } }
		return { w: w, h: h, d: d };
	}
	function flipData(s) {
		var d = new Uint8ClampedArray(s.d.length), x, y, p, q, k;
		for (y = 0; y < s.h; y++) { for (x = 0; x < s.w; x++) { p = (y * s.w + x) * 4; q = (y * s.w + s.w - 1 - x) * 4; for (k = 0; k < 4; k++) { d[q + k] = s.d[p + k]; } } }
		return { w: s.w, h: s.h, d: d };
	}
	// A headlight's reach, pointing east: three flat wedges laid over each other.
	function coneData(len, half) {
		var h = half * 2 + 1, d = new Uint8ClampedArray(len * h * 4), x, y, k, m, n, p;
		for (y = 0; y < h; y++) {
			for (x = 0; x < len; x++) {
				n = 0;
				for (k = 0; k < 3; k++) { m = [1, 0.66, 0.36][k]; if (x < len * m && Math.abs(y - half) <= 0.6 + half * m * (x / (len * m))) { n++; } }
				if (n) { p = (y * len + x) * 4; d[p] = 255; d[p + 1] = 244; d[p + 2] = 200; d[p + 3] = Math.round(255 * (1 - Math.pow(0.83, n))); }
			}
		}
		return { w: len, h: h, d: d };
	}
	function turnIndex(a, n) { var i = Math.round(a / TAU * n) % n; return i < 0 ? i + n : i; }
	// Little upright people: variants x two walking frames.
	function walkers(A, n, acc) {
		var out = [], SH = [acc, [229, 72, 63], [61, 143, 224], [242, 178, 51], [240, 240, 244], [47, 179, 122], [155, 89, 208], [255, 140, 60], [70, 80, 110], [255, 150, 190]], HA = ["#3a2a22", "#6b4a2a", "#d9b25a", "#22222a", "#8a5a3a", "#e8e0d0"], SK = [[244, 205, 170], [224, 172, 130], [170, 118, 84]], i, pal;
		for (i = 0; i < n; i++) {
			pal = { h: HA[i % 6], f: css(SK[i % 3]), j: css(SH[i % 10]), J: css(mul(SH[i % 10], 0.74)), p: i % 2 ? "#2e3550" : "#4a5068", b: "#1f2230" };
			out.push([A.add(pix([".hh.", ".ff.", "jjJj", "jjJj", ".pp.", ".p.p"], pal)), A.add(pix([".hh.", ".ff.", "jjJj", "jjJj", ".pp.", "p.p."], pal))]);
		}
		return out;
	}
	// The nearest point of a path to (x, y), as a distance along it.
	function nearestS(P, x, y) {
		var best = 1e9, bi = 0, i, d;
		for (i = 0; i < P.n; i++) { d = (P.x[i] - x) * (P.x[i] - x) + (P.y[i] - y) * (P.y[i] - y); if (d < best) { best = d; bi = i; } }
		return bi / P.k;
	}
	// Writes into arr (w x h) how far each pixel is from path P, where that is less than what is there (out to rad).
	function* stampSteps(arr, w, h, P, rad, late) {
		var s, cx, cy, x, y, x0, x1, y0, y1, d, k, n = 0;
		for (s = 0; s <= P.len; s += 1.5) {
			if ((n++ & 15) === 0 && late()) { yield; }
			cx = pathX(P, s); cy = pathY(P, s);
			x0 = Math.max(0, Math.floor(cx - rad)); x1 = Math.min(w - 1, Math.ceil(cx + rad)); y0 = Math.max(0, Math.floor(cy - rad)); y1 = Math.min(h - 1, Math.ceil(cy + rad));
			for (y = y0; y <= y1; y++) { for (x = x0; x <= x1; x++) { k = y * w + x; d = dist(x, y, cx, cy); if (d < arr[k]) { arr[k] = d; } } }
		}
	}
	function treeTop(g, x, y, r, pine) {
		var a = pine ? "#1f4d46" : "#3f8a4e", b = pine ? "#2c6b55" : "#59a85a", c = pine ? "#3d8a62" : "#84c66a", d = pine ? "#16393a" : "#2c6a44";
		g.fillStyle = "rgba(16,44,30,0.34)"; ell(g, x + 2, y + 2, r, r - 1);
		disc(g, x, y, r, d); disc(g, x - 1, y - 1, r - 1, a); disc(g, x - 1, y - 1, Math.max(1, r - 2), b);
		g.fillStyle = c; g.fillRect(x - r + 2, y - r + 2, Math.max(1, r - 2), 1); g.fillRect(x - r + 1, y - r + 3, 2, Math.max(1, r - 3)); if (r > 4) { g.fillRect(x - 1, y - 2, 2, 1); }
	}
	// A house seen from above and a little from the front: a roof in two tones, a strip of wall with a door and windows.
	function houseTop(g, lit, x, y, w, d, wh, roof, wall, R, lamp) {
		var i, n, wx;
		g.fillStyle = "rgba(16,40,30,0.3)"; g.fillRect(x + 3, y + 4, w, d + wh);
		box(g, x, y, w, d, css(roof)); box(g, x, y, w, d >> 1, css(mx(roof, [255, 255, 255], 0.2))); box(g, x, y + (d >> 1), w, 1, css(mul(roof, 0.74))); box(g, x + w - 1, y, 1, d, css(mul(roof, 0.72))); box(g, x, y, w, 1, css(mx(roof, [255, 255, 255], 0.4)));
		box(g, x, y + d, w, wh, css(wall)); box(g, x, y + d, w, 1, css(mul(wall, 0.66))); box(g, x + w - 1, y + d, 1, wh, css(mul(wall, 0.8)));
		if (R() < 0.7) { box(g, x + w - 5, y + 1, 2, 2, "#8a7870"); box(g, x + w - 5, y + 1, 2, 1, "#b0a098"); }
		n = Math.max(1, Math.floor((w - 3) / 5)); wx = x + 2 + Math.floor(R() * n) * 5;
		box(g, wx, y + d + wh - 3, 2, 3, "#5a3a2a");
		for (i = 0; i < n; i++) {
			if (x + 2 + i * 5 === wx || wh < 4) { continue; }
			box(g, x + 2 + i * 5, y + d + 1, 2, 2, "#2c3a58");
			if (R() < 0.7) { lit.fillStyle = css(mx(lamp, [255, 255, 255], R() * 0.3), 0.95); lit.fillRect(x + 2 + i * 5, y + d + 1, 2, 2); }
		}
	}

	// ================================================================ 3. the model railway
	// Seen from above. Two trains share a loop cut into blocks: a signal goes red while the block beyond it is taken, and the
	// train behind waits. The passenger train stops at the station and people swap; a railcar shuttles up a branch to a
	// halt in the hills; the road into town has a level crossing whose gates hold the cars while a train goes by.
	var TRAIN_ART = {
		steam: ["rcccc.kkkkkkkkk.r", "rcCCckbbybbbybbkr", "rcCCcbbbbbbbbbsbr", "rcCCcbbbwbbbbssbr", "rcCCcbbbbbbbbbsbr", "rcCCckbbybbbybbkr", "rcccc.kkkkkkkkk.r"],
		tender: [".kkkkkkkkkkkkkkk.", "kgggggggggggggggk", "kgoOooOoooOoOoogk", "kgOooOoOoOooOoogk", "kgoOooOoooOoOoogk", "kgggggggggggggggk", ".kkkkkkkkkkkkkkk."],
		coal: [".kkkkkkkkkkkkkkk.", "knnnnnnnnnnnnnnnk", "knoOooOoooOoOoonk", "knOooOoOoOooOoonk", "knoOooOoooOoOoonk", "knnnnnnnnnnnnnnnk", ".kkkkkkkkkkkkkkk."],
		logs: [".kkkkkkkkkkkkkkk.", "kttttTtttttTttttk", "kTtttttTtttttttTk", "kttTtttttttTttttk", "ktttttTtttttttTtk", "kTtttttttTttttttk", ".kkkkkkkkkkkkkkk."],
		tank: ["..kkkkkkkkkkkkk..", ".kmmmmmmmmmmmmmk.", "kmMMMMMMMMMMMMMmk", "kmMWWWWWWWWWWWMmk", "kmMMMMMkkMMMMMMmk", "kmmmmmmmmmmmmmmmk", "..kkkkkkkkkkkkk.."],
		van: [".kkkkkkkkkkkkkkk.", "kvvvvvvvvvvvvvvvk", "kvVVVVVVVVVVVVVvk", "kvVVVVVVVVVVVVVvk", "kvVVVVVVVVVVVVVvk", "kvvvvvvvvvvvvvvvk", ".kkkkkkkkkkkkkkk."],
		diesel: [".yyaaaaaaaaaaayy.", "yyaAAAAAAAAAAAayy", "yyaAkkAAkkAAAAayy", "yyaAkkAAkkAAwAayy", "yyaAkkAAkkAAAAayy", "yyaAAAAAAAAAAAayy", ".yyaaaaaaaaaaayy."],
		coach: [".kAAAAAAAAAAAAAk.", "kammmmmmmmmmmmmak", "kamMMMMMMMMMMMmak", "kamMmMMMmMMMmMmak", "kamMMMMMMMMMMMmak", "kammmmmmmmmmmmmak", ".kaaaaaaaaaaaaak."],
		railcar: [".eeAAAAAAAAAAAeee", "eeammmmmmmmmmmaee", "eeamMMMMMMMMMmaee", "eeamMmMMMMMmMmawe", "eeamMMMMMMMMMmaee", "eeammmmmmmmmmmaee", ".eeaaaaaaaaaaaeee"],
		car: ["..bbbbbb.", ".bBwBBBwb", "hbBwBBBwb", ".bBwBBBwb", "..bbbbbb."]
	};
	function* railBuild(E) {
		var W = E.W, H = E.H, R = E.R, rnd = E.rnd, A = E.A, tall = E.tall, acc = E.accent, lamp = E.lamp, i, j;
		function path(list, closed) { return makePath(list.map(function (p) { return [p[0] * W, p[1] * H]; }), closed); }
		var main = path([[0.17, 0.19], [0.34, 0.12], [0.55, 0.17], [0.75, 0.11], [0.9, 0.22], [0.935, 0.5], [0.89, 0.78], [0.72, 0.86], [0.575, 0.86], [0.43, 0.86], [0.22, 0.87], [0.09, 0.76], [0.065, 0.45]], true);
		var branch = path([[0.47, 0.842], [0.43, 0.826], [0.37, 0.795], [0.29, 0.72], [0.215, 0.57], [0.235, 0.43], [0.31, 0.345]], false);
		var river = path([[0.45, -0.04], [0.42, 0.2], [0.4, 0.38], [0.335, 0.58], [0.345, 0.8], [0.37, 1.04]], false);
		var yR = Math.round(H * 0.5), bx0 = Math.round(W * 0.62), bx1 = Math.round(W * 0.765), by1 = Math.round(H * 0.745), L = main.len, NB = 6, GAP = 18;
		var roadMain = makeLine([[W + 12, yR], [bx0, yR]]), roadLoop = makeLine([[bx0, yR], [bx0, by1], [bx1, by1], [bx1, yR]]);
		// one lane each way on the road in; one way round the block
		var drive = makePath([[W + 14, yR - 3], [W * 0.9, yR - 3], [bx1 + 10, yR - 3], [bx0 + 5, yR - 3], [bx0, yR + 5], [bx0, by1 - 6], [bx0 + 6, by1], [bx1 - 6, by1], [bx1, by1 - 6], [bx1, yR + 9], [bx1 + 7, yR + 3], [W * 0.9, yR + 3], [W + 14, yR + 3]], false);
		var hill = { x: W * 0.125, y: H * 0.27, rx: W * (tall ? 0.21 : 0.115), ry: H * (tall ? 0.105 : 0.17) };
		function inHill(x, y, grow) { var dx = (x - hill.x) / (hill.rx + (grow || 0)), dy = (y - hill.y) / (hill.ry + (grow || 0)); return dx * dx + dy * dy < 1 + (vn(x / 13, y / 13, 41) - 0.5) * 0.28; }
		var pond = { x: Math.round(W * 0.53), y: Math.round(H * 0.36), rx: tall ? 20 : 26, ry: tall ? 16 : 13 };
		var stS = nearestS(main, W * 0.46 + 4, H * 0.86), stX0 = Math.round(W * 0.455), stX1 = Math.round(W * 0.705), stY = Math.round(H * 0.86), crossS = nearestS(main, W * 0.935, yR), crossX = Math.round(pathX(main, crossS));
		var driveA = 0, driveB = 0, parkS = nearestS(drive, bx0 + 20, by1);
		var world = { layers: {}, skyH: 0, precip: { kind: "rain" } }, lights = K.canvas(W, H), lg = lights.getContext("2d"), spr = {}, dots = makeDots(140), trackD = new Float32Array(W * H), roadD = new Float32Array(W * H), waterD = new Float32Array(W * H), rects = [];
		var signals = [], lampsXY = [], door = [0, 0], halt = [pathX(branch, branch.len), pathY(branch, branch.len)], mill = [Math.round(W * 0.15), Math.round(H * 0.63)];
		for (i = 0; i < W * H; i++) { trackD[i] = 99; roadD[i] = 99; waterD[i] = 99; }
		world.base = [126, 184, 100]; world.first = function (Dr) { if (world.layers.ground) { Dr.layer("ground"); } };
		yield world;
		yield* stampSteps(trackD, W, H, main, 16, E.late); yield* stampSteps(trackD, W, H, branch, 16, E.late); yield* stampSteps(roadD, W, H, roadMain, 16, E.late); yield* stampSteps(roadD, W, H, roadLoop, 16, E.late); yield* stampSteps(waterD, W, H, river, 14, E.late);
		function free(x, y, w, h, pad) {
			var k, r, xx, yy;
			for (k = 0; k < rects.length; k++) { r = rects[k]; if (x < r[0] + r[2] + pad && x + w + pad > r[0] && y < r[1] + r[3] + pad && y + h + pad > r[1]) { return false; } }
			for (yy = y - 2; yy <= y + h + 2; yy += 3) { for (xx = x - 2; xx <= x + w + 2; xx += 3) { if (xx < 2 || yy < 2 || xx >= W - 2 || yy >= H - 2) { return false; } k = yy * W + xx; if (trackD[k] < 9 || roadD[k] < 7 || waterD[k] < 9 || inHill(xx, yy, 6)) { return false; } } }
			return true;
		}

		// ---- sprites
		yield* (function* () {
			var k, pal = { r: "#c8372d", c: "#1f4d3a", C: "#2f7052", k: "#20232e", b: "#33384a", y: "#d9b25a", s: "#8a93a6", w: "#c9d2e0", g: "#3a3f52", o: "#15171e", O: "#2a2d3a", n: "#7a4a32", t: "#8a5a34", T: "#b0794a", m: "#7c8698", M: "#aab4c4", W: "#e6ecf4", v: "#8c4f3a", V: "#a8644a", a: css(mul(acc, 0.78)), A: css(acc), e: "#e9e2c8", h: "#fff6c8", B: "#d0d6e0" };
			var CARS = [[229, 72, 63], [61, 143, 224], [242, 178, 51], [240, 240, 244], [47, 179, 122], [70, 76, 96]], cv, lit;
			spr.t = {};
			for (k in TRAIN_ART) { if (k !== "car") { spr.t[k] = rotSet(A, pixData(TRAIN_ART[k], pal), 32); } }
			if (E.late()) { yield; }
			// what glows at night: light spilling from the coach windows, a lamp at the front
			lit = { W: "#ffe7a8" };
			spr.t.coachLit = rotSet(A, pixData(["..l.l.l.l.l.l.l..", ".................", ".................", ".................", ".................", ".................", "..l.l.l.l.l.l.l.."], { l: "#ffe7a8" }), 32);
			if (E.late()) { yield; }
			spr.t.headLit = rotSet(A, pixData([".................", ".................", "................w", "................w", "................w", ".................", "................."], { w: "#fff6c8" }), 32);
			if (E.late()) { yield; }
			spr.cars = [];
			for (k = 0; k < CARS.length; k++) { spr.cars.push(rotSet(A, pixData(TRAIN_ART.car, { b: css(mul(CARS[k], 0.8)), B: css(CARS[k]), w: "#27304a", h: "#fff6c8" }), 16)); }
			if (E.late()) { yield; }
			spr.carLit = rotSet(A, pixData(["........w", ".........", ".........", ".........", "........w"], { w: "#fff6c8" }), 16);
			if (E.late()) { yield; }
			spr.beam = rotSet(A, coneData(30, 7), 16);
			if (E.late()) { yield; }
			spr.men = walkers(A, 10, acc);
			spr.sig = [A.add(pix([".kkk.", ".kgk.", ".kkk.", "..k..", "..k..", "..k.."], { k: "#2a2f40", g: "#38e07a" })), A.add(pix([".kkk.", ".krk.", ".kkk.", "..k..", "..k..", "..k.."], { k: "#2a2f40", r: "#ff4a3a" }))];
			spr.sigGlow = [A.add(haloSprite(4, [56, 224, 122]), 4, 4), A.add(haloSprite(4, [255, 74, 58]), 4, 4)];
			spr.lamp = A.add(haloSprite(5, lamp), 5, 5);
			spr.gateH = A.add(pix(["wwrrwwrrwwrrw"], { w: "#f4f4f0", r: "#e5483f" }), 0, 0);
			spr.gateV = A.add(pix(["w", "w", "r", "r", "w", "w", "r", "r", "w", "w", "r", "r", "w"], { w: "#f4f4f0", r: "#e5483f" }), 0, 0);
			spr.xlamp = A.add(haloSprite(3, [255, 60, 50]), 3, 3);
			spr.sails = [];
			for (k = 0; k < 4; k++) {
				spr.sails.push(A.add(K.bake(23, 23, function (g) {
					var a = k * TAU / 16, n, q;
					for (n = 0; n < 4; n++) { q = a + n * TAU / 4; line(g, 11, 11, 11 + Math.cos(q) * 10, 11 + Math.sin(q) * 10, "#6b5a4a"); line(g, 11 + Math.cos(q) * 4 - Math.sin(q) * 2, 11 + Math.sin(q) * 4 + Math.cos(q) * 2, 11 + Math.cos(q) * 10 - Math.sin(q) * 2, 11 + Math.sin(q) * 10 + Math.cos(q) * 2, "#efe8d6"); }
					g.fillStyle = "#3a2a22"; g.fillRect(10, 10, 3, 3);
				}), 11, 11));
			}
			spr.sheep = [A.add(pix([".www.", "wwwwk", ".k.k."], { w: "#f4f2ea", k: "#2a2a30" }), 2), A.add(pix([".www.", "kwwww", ".k.k."], { w: "#f4f2ea", k: "#2a2a30" }), 2)];
			spr.duck = A.add(pix([".o", "ww"], { o: "#f0a030", w: "#fbfbf4" }), 1);
			spr.tractor = [A.add(pix(["kk.rrr.", "kkrrgrk", "kk.rrrk"], { k: "#22252e", r: "#d0453a", g: "#9fd4f2" }), 3, 2), A.add(flip(pix(["kk.rrr.", "kkrrgrk", "kk.rrrk"], { k: "#22252e", r: "#d0453a", g: "#9fd4f2" })), 3, 2)];
			spr.balloon = A.add(K.bake(17, 17, function (g) {
				var x;
				disc(g, 8, 8, 8, css(mul(acc, 0.72))); disc(g, 7, 7, 7, css(acc));
				for (x = -6; x <= 6; x += 4) { ell(g, 8 + x * 0.9, 8, 1, 7 - Math.abs(x) * 0.35, "#fff3c4"); }
				disc(g, 6, 5, 2, css(mx(acc, [255, 255, 255], 0.45))); g.fillStyle = "#5a3a2a"; g.fillRect(7, 7, 3, 3);
			}), 8, 8);
			spr.balloonSh = A.add(K.bake(15, 11, function (g) { ell(g, 7, 5, 7, 5, "rgba(16,40,30,0.3)"); }), 7, 5);
			spr.cloudSh = A.add(K.bake(90, 46, function (g) {
				var x, y, n;
				for (y = 0; y < 46; y++) { for (x = 0; x < 90; x++) { n = fbm(x / 26, y / 16, 71, 2) - Math.pow(dist(x / 45, y / 23, 1, 1), 2) * 0.55; if (n > 0.2 + BAYER[(y & 3) * 4 + (x & 3)] / 60) { g.fillStyle = "rgba(20,40,60,0.2)"; g.fillRect(x, y, 1, 1); } } }
			}), 45, 23);
		})();

		// ---- the land, painted once
		world.layers.ground = yield* bakeSteps(W, H, function* (g) {
			var img = g.createImageData(W, H), d = img.data, x, y, k, p, q, c, f, n, t, wd, rd, fields = [], F, e, s, a, P, list, hx, hy, w, h, tries;
			var GRASS = [[150, 200, 110], [126, 184, 100], [104, 166, 92], [86, 146, 86]], WATER = [[130, 196, 226], [86, 160, 212], [62, 134, 196]], ROAD = [[124, 128, 138], [116, 120, 131]];
			var CROP = [[[226, 196, 96], [206, 172, 78]], [[150, 108, 72], [128, 90, 62]], [[98, 160, 82], [70, 132, 72]], [[190, 214, 110], [164, 196, 96]], [[168, 142, 204], [112, 158, 96]]];
			// fields: rectangles of crop wherever there is room outside the town
			for (tries = 0; tries < 90 && fields.length < (tall ? 12 : 13); tries++) {
				w = 44 + Math.floor(R() * 60); h = 30 + Math.floor(R() * 36); hx = Math.floor(R() * (W - w - 8)) + 4; hy = Math.floor(R() * (H - h - 8)) + 4; e = true;
				if (hx + w > bx0 - 26 && hx < bx1 + 30 && hy + h > yR - 34 && hy < by1 + 24) { continue; }
				if (inHill(hx + w / 2, hy + h / 2, 24) || inHill(hx, hy, 8) || inHill(hx + w, hy + h, 8) || inHill(hx + w, hy, 8) || inHill(hx, hy + h, 8)) { continue; }
				if (hy + h > stY - 50 && hy < stY + 14 && hx + w > stX0 - 20 && hx < stX1 + 20) { continue; }
				if (dist(hx + w / 2, hy + h / 2, pond.x, pond.y) < 50 || dist(hx + w / 2, hy + h / 2, mill[0], mill[1]) < 34) { continue; }
				for (k = 0; k < fields.length && e; k++) { F = fields[k]; if (hx < F[0] + F[2] + 5 && hx + w + 5 > F[0] && hy < F[1] + F[3] + 5 && hy + h + 5 > F[1]) { e = false; } }
				for (y = hy; y < hy + h && e; y += 4) { for (x = hx; x < hx + w && e; x += 4) { if (waterD[y * W + x] < 11) { e = false; } } }
				if (e) { fields.push([hx, hy, w, h, Math.floor(R() * 5), R() < 0.5]); }
			}
			world.fields = fields;
			for (y = 0; y < H; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					k = y * W + x; p = k * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16; wd = waterD[k]; rd = roadD[k];
					e = ((x - pond.x) * (x - pond.x)) / (pond.rx * pond.rx) + ((y - pond.y) * (y - pond.y)) / (pond.ry * pond.ry) + (vn(x / 7, y / 7, 5) - 0.5) * 0.3;
					wd = Math.min(wd - 5.5 - vn(y / 18, 2, 3) * 2.5, (e - 1) * 12);
					if (wd < 0) { c = WATER[clamp(Math.floor(1.9 + wd * 0.34 + q * 1.1 + (vn(x / 9, y / 3, 8) > 0.72 ? -1 : 0)), 0, 2)]; }
					else if (wd < 1.8) { c = wd < 0.9 ? [214, 204, 160] : [170, 196, 120]; }
					else if (rd < (x > bx1 + 4 ? 6.6 : 5.2)) { c = ROAD[(vn(x / 3, y / 3, 6) > 0.6) ? 1 : 0]; if (rd > (x > bx1 + 4 ? 5.6 : 4.3)) { c = [176, 178, 180]; } }
					else {
						c = null;
						for (n = 0; n < fields.length && !c; n++) {
							F = fields[n];
							if (x >= F[0] && x < F[0] + F[2] && y >= F[1] && y < F[1] + F[3]) {
								t = F[5] ? y : x; e = Math.min(x - F[0], F[0] + F[2] - 1 - x, y - F[1], F[1] + F[3] - 1 - y);
								c = e < 1 ? [58, 110, 64] : e < 2 ? [84, 140, 76] : CROP[F[4]][(t >> 1) & 1];
							}
						}
						if (!c) {
							f = fbm(x / 60, y / 60, 21, 3) * 3.2 + (vn(x / 2.5, y / 2.5, 9) - 0.5) * 0.9; c = GRASS[clamp(Math.floor(f + q * 0.9), 0, 3)];
							// meadow flowers in drifts, darker tufts
							n = ih(x, y, 77);
							if (n > 0.985 && fbm(x / 34, y / 34, 51, 2) > 0.52) { c = n > 0.995 ? [250, 236, 140] : n > 0.99 ? [252, 250, 240] : [240, 170, 200]; } else if (n < 0.03) { c = [78, 136, 82]; }
						}
					}
					d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
				}
			}
			g.putImageData(img, 0, 0);
			// farm lanes: from the mill to the halt and across to the town
			list = [makePath([[mill[0] + 20, mill[1] + 12], [W * 0.25, H * 0.5], [halt[0] + 12, halt[1] + 2]]), makePath([[mill[0] + 30, mill[1] + 14], [W * 0.3, H * 0.66], [W * 0.46, H * 0.62], [bx0 - 4, H * 0.63]])];
			for (n = 0; n < 2; n++) { P = list[n]; for (s = 0; s < P.len; s += 1) { x = Math.round(pathX(P, s)); y = Math.round(pathY(P, s)); k = clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1); if (trackD[k] < 6) { continue; } if (waterD[k] < 8) { box(g, x - 2, y - 1, 5, 3, "#9a7450"); box(g, x - 2, y - 1, 5, 1, "#c49a6c"); } else { box(g, x, y, 2, 2, (s & 3) ? "#d2bf8c" : "#c0aa78"); } } }
			// an orchard by the farm
			for (y = 0; y < 4; y++) { for (x = 0; x < 5; x++) { hx = mill[0] - 34 + x * 9; hy = mill[1] - 46 + y * 9; if (hx > 6 && hy > 6 && trackD[hy * W + hx] > 9 && !inHill(hx, hy, 6)) { treeTop(g, hx, hy, 3, false); box(g, hx - 1, hy, 1, 1, "#e5483f"); box(g, hx + 1, hy - 2, 1, 1, "#e5483f"); rects.push([hx - 3, hy - 3, 7, 7]); } } }
			// road markings
			for (x = bx1 + 12; x < W; x += 9) { if (Math.abs(x - crossX) > 12) { box(g, x, yR, 4, 1, "#e8e4d0"); } }
			// the railway: a bed of ballast, sleepers across it, two rails
			list = [main, branch];
			for (n = 0; n < 2; n++) { P = list[n]; for (s = 0; s <= P.len; s += 1.5) { x = pathX(P, s); y = pathY(P, s); disc(g, Math.round(x), Math.round(y), 4, waterD[Math.round(clamp(y, 0, H - 1)) * W + Math.round(clamp(x, 0, W - 1))] < 8 ? "#8a8690" : "#b3a48e"); } }
			for (n = 0; n < 2; n++) {
				if (E.late()) { yield; }
				P = list[n];
				for (s = 0; s <= P.len; s += 1.5) { x = pathX(P, s); y = pathY(P, s); if (waterD[Math.round(clamp(y, 0, H - 1)) * W + Math.round(clamp(x, 0, W - 1))] < 8) { a = pathA(P, s); box(g, x - Math.sin(a) * 5.5, y + Math.cos(a) * 5.5, 1, 1, "#4a4a56"); box(g, x + Math.sin(a) * 5.5, y - Math.cos(a) * 5.5, 1, 1, "#6c6c78"); } }
				for (s = 0; s <= P.len; s += 3) { a = pathA(P, s); x = pathX(P, s); y = pathY(P, s); line(g, x - Math.sin(a) * 3.4, y + Math.cos(a) * 3.4, x + Math.sin(a) * 3.4, y - Math.cos(a) * 3.4, "#6b4f3a"); }
				for (s = 0; s <= P.len; s += 0.5) { a = pathA(P, s); x = pathX(P, s); y = pathY(P, s); box(g, x - Math.sin(a) * 2, y + Math.cos(a) * 2, 1, 1, "#d7dbe2"); box(g, x + Math.sin(a) * 2, y - Math.cos(a) * 2, 1, 1, "#8f96a4"); }
			}
			box(g, crossX - 6, yR - 6, 13, 13, "#8f8a84"); for (y = yR - 6; y < yR + 7; y += 1) { box(g, crossX - 2, y, 1, 1, "#d7dbe2"); box(g, crossX + 2, y, 1, 1, "#8f96a4"); }
			box(g, Math.round(halt[0]) - 2, Math.round(halt[1]) - 4, 5, 2, "#c8372d");
			// the station: a platform beside the track, a long building with a canopy, lamps, a forecourt
			box(g, stX0, stY - 11, stX1 - stX0, 6, "#c9c2b2"); box(g, stX0, stY - 11, stX1 - stX0, 1, "#e6e0d2"); box(g, stX0, stY - 6, stX1 - stX0, 1, "#f2e9a0"); box(g, stX0, stY - 5, stX1 - stX0, 1, "#8f8a80");
			w = Math.min(70, stX1 - stX0 - 16); hx = Math.round((stX0 + stX1) / 2 - w / 2); hy = stY - 34;
			box(g, hx - 6, hy + 20, w + 12, 4, "#a8a294");
			houseTop(g, lg, hx, hy, w, 12, 8, [120, 78, 66], [232, 222, 200], R, lamp); rects.push([hx - 4, hy - 2, w + 8, 30]);
			box(g, hx + (w >> 1) - 6, hy - 6, 12, 10, "#8c5a4c"); box(g, hx + (w >> 1) - 6, hy - 6, 12, 4, "#a87060"); disc(g, hx + (w >> 1), hy + 14, 2, "#fbf8ee"); box(g, hx + (w >> 1), hy + 13, 1, 2, "#2a2a32");
			box(g, hx - 4, hy + 20, w + 8, 3, css(mul(acc, 0.8))); box(g, hx - 4, hy + 20, w + 8, 1, css(mx(acc, [255, 255, 255], 0.3)));
			door = [hx + (w >> 1) + 9, stY - 11];
			for (x = stX0 + 6; x < stX1; x += Math.max(24, Math.round((stX1 - stX0 - 12) / 4))) { box(g, x, stY - 13, 1, 4, "#3a4056"); box(g, x - 1, stY - 14, 3, 1, "#e8e2c8"); lampsXY.push([x, stY - 13]); }
			// a water tower and a goods shed at the far end
			if (!tall) { disc(g, stX1 + 16, stY - 16, 5, "#6a5a4a"); disc(g, stX1 + 15, stY - 17, 4, "#8a7458"); box(g, stX1 + 14, stY - 19, 2, 1, "#b09a78"); rects.push([stX1 + 9, stY - 24, 14, 14]); }
			// the town: houses along the streets
			list = [[bx1 + 14, yR - 26, W - 30, yR - 26, 0], [bx0 - 34, yR - 27, bx1 + 6, yR - 27, 1], [bx0 + 10, yR + 9, bx1 - 12, yR + 9, 2], [bx0 + 10, by1 - 27, bx1 - 12, by1 - 27, 3], [bx0 - 30, yR + 12, bx0 - 30, by1 - 8, 4], [bx1 + 12, yR + 14, bx1 + 12, by1 - 6, 5], [bx0 - 6, by1 + 10, bx1 + 30, by1 + 10, 6]];
			var ROOFS = [[196, 84, 66], [176, 70, 60], [110, 116, 138], [150, 96, 70], acc, [206, 120, 80]], WALLS = [[236, 226, 204], [226, 210, 186], [214, 220, 226], [240, 232, 214]];
			for (n = 0; n < list.length; n++) {
				if (E.late()) { yield; }
				F = list[n]; e = dist(F[0], F[1], F[2], F[3]);
				for (t = 0; t < e; t += 20 + Math.floor(R() * 5)) {
					w = 13 + Math.floor(R() * 7); h = 8 + Math.floor(R() * 4); x = Math.round(F[0] + (F[2] - F[0]) * t / Math.max(1, e)); y = Math.round(F[1] + (F[3] - F[1]) * t / Math.max(1, e));
					if (x + w > W - 3 || y + h + 6 > H - 3 || !free(x, y, w, h + 6, 2)) { continue; }
					houseTop(g, lg, x, y, w, h, 5, ROOFS[Math.floor(R() * 6)], WALLS[Math.floor(R() * 4)], R, lamp); rects.push([x, y, w, h + 6]);
				}
			}
			// the church by the green, the farm with its barn and mill
			x = bx0 - 36; y = yR - 62;
			if (free(x, y, 22, 30, 2)) {
				houseTop(g, lg, x, y + 8, 12, 12, 6, [110, 116, 138], [236, 230, 214], R, lamp); box(g, x + 12, y, 9, 9, "#8a90a8"); box(g, x + 12, y, 9, 4, "#a8aec4"); box(g, x + 15, y + 3, 3, 3, "#d9b25a"); box(g, x + 12, y + 9, 9, 17, "#ece6d2"); box(g, x + 20, y + 9, 1, 17, "#c2bca6"); box(g, x + 15, y + 13, 3, 4, "#2c3a58");
				rects.push([x, y, 22, 30]);
			}
			x = mill[0]; y = mill[1];
			houseTop(g, lg, x + 16, y - 4, 22, 13, 6, [176, 60, 52], [200, 80, 66], R, lamp); rects.push([x + 14, y - 6, 26, 24]);
			houseTop(g, lg, x - 30, y + 6, 15, 9, 5, [150, 96, 70], [236, 226, 204], R, lamp); rects.push([x - 32, y + 4, 19, 19]);
			disc(g, x + 46, y + 6, 4, "#8a93a6"); disc(g, x + 45, y + 5, 3, "#c0c8d4"); rects.push([x + 40, y, 12, 12]);
			g.fillStyle = "rgba(16,40,30,0.3)"; ell(g, x + 3, y + 5, 7, 5);
			disc(g, x, y, 6, "#b9b2a4"); disc(g, x - 1, y - 1, 5, "#d6cfc0"); disc(g, x - 1, y - 1, 2, "#8a5a44"); rects.push([x - 8, y - 8, 16, 18]);
			// market stalls on the green in the middle of town, and a fountain
			x = Math.round((bx0 + bx1) / 2); y = Math.round((yR + by1) / 2);
			if (free(x - 14, y - 8, 28, 16, 1)) {
				disc(g, x, y, 4, "#b9b2a4"); disc(g, x, y, 3, "#6ab4dc"); box(g, x, y, 1, 1, "#f4f6fa");
				for (k = 0; k < 4; k++) { hx = x + (k % 2 ? 8 : -13); hy = y + (k < 2 ? -9 : 5); box(g, hx + 1, hy + 1, 6, 4, "rgba(16,40,30,0.3)"); box(g, hx, hy, 6, 4, css([[229, 72, 63], [61, 143, 224], [242, 178, 51], [240, 240, 244]][k])); box(g, hx, hy, 2, 4, "#f4f0e4"); box(g, hx + 4, hy, 2, 4, "#f4f0e4"); }
				rects.push([x - 14, y - 10, 28, 20]);
			}
			// a shelter at the halt, hay bales, a fence round the sheep
			box(g, Math.round(halt[0]) + 6, Math.round(halt[1]) - 7, 12, 3, "#c9c2b2"); houseTop(g, lg, Math.round(halt[0]) + 8, Math.round(halt[1]) - 17, 9, 5, 4, [150, 96, 70], [226, 210, 186], R, lamp);
			world.pen = null;
			for (n = 0; n < fields.length; n++) { F = fields[n]; if (F[4] === 3 && !world.pen) { world.pen = F; } if (F[4] === 0) { for (k = 0; k < 4; k++) { x = F[0] + 6 + Math.floor(R() * (F[2] - 12)); y = F[1] + 6 + Math.floor(R() * (F[3] - 12)); box(g, x, y, 3, 2, "#e8c860"); box(g, x, y + 2, 3, 1, "#a88a3a"); } } }
			// trees: woods in the corners and on the hill's skirts, singles along the hedges
			for (tries = 0; tries < (tall ? 620 : 700); tries++) {
				if ((tries & 31) === 0 && E.late()) { yield; }
				x = Math.floor(R() * W); y = Math.floor(R() * H); k = y * W + x; f = fbm(x / 50, y / 50, 33, 3);
				if (trackD[k] < 9 || roadD[k] < 8 || waterD[k] < 9 || inHill(x, y, 5) || dist(x, y, pond.x, pond.y) < pond.rx + 5) { continue; }
				e = true;
				for (n = 0; n < rects.length && e; n++) { F = rects[n]; if (x > F[0] - 5 && x < F[0] + F[2] + 5 && y > F[1] - 5 && y < F[1] + F[3] + 6) { e = false; } }
				for (n = 0; n < fields.length && e; n++) { F = fields[n]; if (x > F[0] + 1 && x < F[0] + F[2] - 2 && y > F[1] + 1 && y < F[1] + F[3] - 2) { e = false; } }
				if (!e || (f < 0.56 && R() > 0.16)) { continue; }
				treeTop(g, x, y, 3 + Math.floor(R() * 3), f > 0.62 && R() < 0.5);
			}
		});
		// ---- what stands over the trains: the hill with its tunnel, and the signal posts
		world.layers.over = yield* bakeSteps(W, H, function* (g) {
			var img = g.createImageData(W, H), d = img.data, x, y, p, q, e, c, k, s, a, HG = [[122, 172, 104], [98, 150, 92], [78, 128, 84], [60, 106, 78]], RKc = [[196, 190, 172], [158, 152, 142], [118, 114, 114]], dx, dy, x0 = Math.max(0, Math.floor(hill.x - hill.rx * 1.3)), x1 = Math.min(W, Math.ceil(hill.x + hill.rx * 1.3)), y0 = Math.max(0, Math.floor(hill.y - hill.ry * 1.3)), y1 = Math.min(H, Math.ceil(hill.y + hill.ry * 1.3));
			for (y = y0; y < y1; y++) {
				if (E.late()) { yield; }
				for (x = x0; x < x1; x++) {
					if (!inHill(x, y, 0)) { continue; }
					p = (y * W + x) * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16; dx = (x - hill.x) / hill.rx; dy = (y - hill.y) / hill.ry; e = Math.sqrt(dx * dx + dy * dy);
					// lit from the upper left, in terraces
					k = 1.3 + (dx + dy) * 1.5 - (1 - e) * 0.9 + (Math.floor(e * 5) & 1 ? 0.3 : 0) + (vn(x / 6, y / 6, 13) - 0.5) * 0.6;
					c = HG[clamp(Math.floor(k + q), 0, 3)];
					if (fbm(x / 9, y / 7, 19, 2) > 0.72 && e < 0.7) { c = RKc[clamp(Math.floor(1 + (dx + dy) * 1.2 + q * 0.5), 0, 2)]; }
					if (!inHill(x - 1, y - 1, 0)) { c = [170, 208, 130]; } else if (!inHill(x + 1, y + 2, 0)) { c = [44, 84, 66]; }
					d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
				}
			}
			g.putImageData(img, 0, 0);
			// tunnel mouths where the line goes under
			for (s = 0; s < L; s += 1) {
				x = pathX(main, s); y = pathY(main, s);
				if (inHill(x, y, 0) !== inHill(pathX(main, s + 1), pathY(main, s + 1), 0)) {
					a = pathA(main, s); k = inHill(x, y, 0) ? 1 : -1;
					for (e = -5; e <= 5; e++) { box(g, x - Math.sin(a) * e + Math.cos(a) * k * -2, y + Math.cos(a) * e + Math.sin(a) * k * -2, 2, 2, Math.abs(e) > 3 ? "#b9b2a4" : "#15171e"); box(g, x - Math.sin(a) * e + Math.cos(a) * k * -4, y + Math.cos(a) * e + Math.sin(a) * k * -4, 2, 2, "#8f8a84"); }
				}
			}
			for (k = 0; k < 46; k++) { x = Math.round(hill.x + (R() - 0.5) * 1.7 * hill.rx); y = Math.round(hill.y + (R() - 0.5) * 1.7 * hill.ry); if (inHill(x, y, -7) && fbm(x / 9, y / 7, 19, 2) < 0.6) { treeTop(g, x, y, 3 + Math.floor(R() * 2), true); } }
		});
		// signals at the ends of the blocks, lamps, the lights of the town
		yield* (function* () {
			var b, s, a, k, pool = glowSprite(13, 9, lamp, 0.55);
			for (b = 0; b < NB; b++) {
				s = b * L / NB; a = pathA(main, s - 8);
				signals.push({ x: Math.round(pathX(main, s - 8) - Math.sin(a) * 8), y: Math.round(pathY(main, s - 8) + Math.cos(a) * 8), red: false, hid: inHill(pathX(main, s - 8), pathY(main, s - 8), 8) });
			}
			for (k = 0; k < 7; k++) { s = roadLoop.len * (k + 0.5) / 7; lampsXY.push([Math.round(pathX(roadLoop, s) + (k % 2 ? 6 : -6)), Math.round(pathY(roadLoop, s))]); }
			for (k = 0; k < 4; k++) { lampsXY.push([Math.round(bx1 + 20 + k * (W - bx1 - 30) / 4), yR - 8]); }
			lampsXY.push([Math.round(halt[0]) + 12, Math.round(halt[1]) - 6]);
			for (k = 0; k < lampsXY.length; k++) { lg.drawImage(pool, lampsXY[k][0] - 13, lampsXY[k][1] - 7); }
		})();

		// ---- trains
		var trains = [
			{ s: L * 0.08, v: 0, vmax: 25, cars: ["steam", "tender", "coal", "logs", "tank", "van"], stops: false, dwell: 0, served: false, hold: false, puff: 0 },
			{ s: L * 0.62, v: 0, vmax: 36, cars: ["diesel", "coach", "coach", "coach"], stops: true, dwell: 0, served: false, hold: false, puff: 0 }
		], shuttle = { s: 30, v: 0, dir: 1, dwell: 4, x: 0, y: 0 }, gate = 0, gateWant = false;
		function ahead(a, b) { return ((b - a) % L + L) % L; }
		function blockOf(s) { return Math.floor((((s % L) + L) % L) / (L / NB)); }
		function taken(b, me) {
			var k, t, h, tl;
			for (k = 0; k < trains.length; k++) { t = trains[k]; if (t === me) { continue; } h = blockOf(t.s); tl = blockOf(t.s - t.cars.length * GAP - 4); if (b === h || b === tl || (h !== tl && b === (tl + 1) % NB && ahead(tl * L / NB, t.s) > L / NB)) { return true; } }
			return false;
		}
		function stepTrain(t, dt) {
			var lim = t.vmax, d, nb, k, a, x, y;
			t.x = pathX(main, t.s - 9); t.y = pathY(main, t.s - 9);
			if (t.dwell > 0) { t.dwell -= dt; t.v = 0; return; }
			// the signal at the end of this block
			nb = (blockOf(t.s) + 1) % NB; d = ahead(t.s, nb * L / NB) - 9; t.hold = taken(nb, t);
			if (t.hold) { lim = Math.min(lim, Math.sqrt(Math.max(0, 2 * 13 * (d - 1)))); }
			// the station
			if (t.stops) {
				d = ahead(t.s, stS);
				if (d > L - 60) { t.served = false; }
				if (!t.served && d < 200) { lim = Math.min(lim, Math.sqrt(Math.max(0, 2 * 11 * d)) + 1.5); if (d < 0.8) { t.dwell = 8; t.served = true; t.v = 0; arrive(t); return; } }
			}
			t.v += clamp(lim - t.v, -16 * dt, 8 * dt);
			if (t.v < 0) { t.v = 0; }
			t.s = (t.s + t.v * dt) % L;
			if (t.cars[0] === "steam" && t.v > 2) { t.puff -= dt * (0.5 + t.v / 12); if (t.puff <= 0) { t.puff = 1; x = pathX(main, t.s - 3); y = pathY(main, t.s - 3); if (!inHill(x, y, 3)) { dots.add(x, y - 2, (rnd() - 0.5) * 3, -4 - rnd() * 2, 2.2, 0, 2, 1.4); } } }
		}
		// ---- people at the station
		var folk = [], spawnT = 2, NFOLK = E.count(7, 3, 12);
		function slotOf(n) { return [stX0 + 12 + ((n * 37) % Math.max(20, stX1 - stX0 - 24)), stY - 7 - (n % 2)]; }
		for (i = 0; i < 4; i++) { j = slotOf(i); folk.push({ st: 1, x: j[0], y: j[1], tx: j[0], ty: j[1], look: i, n: i, t: rnd() * 5 }); }
		function arrive(t) {
			var k, n = 0, c, m;
			// those waiting get on at the nearest coach, a few get off and head for the way out
			for (k = 0; k < folk.length; k++) { m = folk[k]; if (m.st === 1) { m.st = 2; c = 1 + (k % 3); m.tx = clamp(pathX(main, t.s - 9 - c * GAP), stX0 + 3, stX1 - 3); m.ty = stY - 4; m.t = rnd() * 1.5; } }
			for (k = 0; k < 4 && folk.length < NFOLK + 6; k++) { c = 1 + (k % 3); folk.push({ st: 3, x: clamp(pathX(main, t.s - 9 - c * GAP) + (rnd() - 0.5) * 8, stX0 + 3, stX1 - 3), y: stY - 4, tx: door[0], ty: door[1], look: Math.floor(rnd() * 10), n: 0, t: 1.5 + rnd() * 3 }); }
		}
		function stepFolk(dt) {
			var k, m, d, sp, n = 0, used, q;
			for (k = folk.length - 1; k >= 0; k--) {
				m = folk[k];
				if (m.st === 1) { n++; continue; }
				if (m.t > 0) { m.t -= dt; continue; }
				d = dist(m.x, m.y, m.tx, m.ty); sp = 11 * dt;
				if (d <= sp) { if (m.st === 0) { m.st = 1; m.x = m.tx; m.y = m.ty; n++; } else { folk.splice(k, 1); } }
				else { m.x += (m.tx - m.x) / d * sp; m.y += (m.ty - m.y) / d * sp; if (m.st === 0) { n++; } }
			}
			spawnT -= dt;
			if (spawnT <= 0 && n < NFOLK - 1 && trains[1].dwell <= 0) {
				spawnT = 4 + rnd() * 7;
				for (q = 0; q < 12; q++) { used = false; for (k = 0; k < folk.length; k++) { if (folk[k].st < 2 && folk[k].n === q) { used = true; } } if (!used) { break; } }
				d = slotOf(q); folk.push({ st: 0, x: door[0], y: door[1], tx: d[0], ty: d[1], look: Math.floor(rnd() * 10), n: q, t: 0 });
			} else if (spawnT <= 0) { spawnT = 3; }
		}
		// ---- cars on the road in
		var cars = [], NCAR = E.count(5, 2, 9);
		for (i = 0; i < NCAR; i++) { cars.push({ s: -1, v: 0, wait: i * 5 + rnd() * 6, look: i % 6, park: 0, parked: false, x: -99, y: -99 }); }
		driveA = nearestS(drive, crossX + 11, yR - 3); driveB = drive.len - (W + 14 - (crossX - 11));
		function stepCars(dt) {
			var k, c, o, n, gap, lim, lead, busy = gate > 0.04 || gateWant;
			for (k = 0; k < cars.length; k++) {
				c = cars[k];
				if (c.s < 0) {
					c.wait -= dt;
					if (c.wait <= 0) { lead = 1e9; for (n = 0; n < cars.length; n++) { if (cars[n].s >= 0 && cars[n].s < lead) { lead = cars[n].s; } } if (lead > 34) { c.s = 0; c.v = 20; c.parked = false; c.look = Math.floor(rnd() * 6); } else { c.wait = 2; } }
					continue;
				}
				// the car in front, a closed gate, a stop outside the shops
				gap = 1e9; lead = null;
				for (n = 0; n < cars.length; n++) { o = cars[n]; if (o !== c && o.s > c.s && o.s - c.s < gap) { gap = o.s - c.s; lead = o; } }
				lim = Math.min(24, Math.max(0, (gap - 14) * 2.2));
				if (c.s < driveA && (busy || (lead && lead.s > driveA && lead.s < driveA + 44))) { lim = Math.min(lim, Math.max(0, (driveA - c.s - 1) * 2.4)); }
				if (c.s < driveB && c.s > driveA + 30 && (busy || (lead && lead.s > driveB && lead.s < driveB + 44))) { lim = Math.min(lim, Math.max(0, (driveB - c.s - 1) * 2.4)); }
				if (!c.parked && c.s < parkS) { lim = Math.min(lim, Math.max(0, (parkS - c.s) * 2.2 + 0.6)); if (parkS - c.s < 0.6) { c.parked = true; c.park = 3 + rnd() * 7; } }
				if (c.park > 0) { c.park -= dt; lim = 0; }
				c.v += clamp(lim - c.v, -70 * dt, 22 * dt);
				c.s += c.v * dt;
				if (c.s >= drive.len) { c.s = -1; c.wait = 4 + rnd() * 16; c.x = -99; continue; }
				c.x = pathX(drive, c.s); c.y = pathY(drive, c.s);
			}
		}
		// ---- the rest of the countryside
		var sheep = [], ducks = [], tractor = { x: 0, y: 0, dir: 1, F: null }, balloon = { x: -40, y: H * 0.3, on: false, wait: 15 + rnd() * 40, vx: 5, vy: 0 }, cloud = [{ x: W * 0.2, y: H * 0.3 }, { x: W * 0.8, y: H * 0.75 }], millA = 0;
		if (world.pen) { for (i = 0; i < 6; i++) { sheep.push({ x: world.pen[0] + 6 + rnd() * (world.pen[2] - 12), y: world.pen[1] + 6 + rnd() * (world.pen[3] - 12), tx: 0, ty: 0, t: rnd() * 8, f: 0 }); sheep[i].tx = sheep[i].x; sheep[i].ty = sheep[i].y; } }
		for (i = 0; i < 4; i++) { ducks.push({ a: rnd() * TAU, r: 0.3 + rnd() * 0.4, v: 0.2 + rnd() * 0.2 }); }
		for (i = 0; i < world.fields.length; i++) { if (world.fields[i][4] === 1) { tractor.F = world.fields[i]; tractor.x = tractor.F[0] + 4; tractor.y = tractor.F[1] + 5; break; } }
		function stepLand(dt, X) {
			var k, m, d, F;
			for (k = 0; k < sheep.length; k++) {
				m = sheep[k]; m.t -= dt;
				if (m.t <= 0) { m.t = 3 + rnd() * 9; m.tx = world.pen[0] + 5 + rnd() * (world.pen[2] - 10); m.ty = world.pen[1] + 5 + rnd() * (world.pen[3] - 10); }
				d = dist(m.x, m.y, m.tx, m.ty); if (d > 0.5) { m.f = m.tx > m.x ? 0 : 1; m.x += (m.tx - m.x) / d * 3 * dt; m.y += (m.ty - m.y) / d * 3 * dt; }
			}
			for (k = 0; k < ducks.length; k++) { ducks[k].a += ducks[k].v * dt; }
			F = tractor.F;
			if (F && !X.night) { tractor.x += tractor.dir * 5 * dt; if (tractor.x > F[0] + F[2] - 5 || tractor.x < F[0] + 4) { tractor.dir = -tractor.dir; tractor.y += 4; if (tractor.y > F[1] + F[3] - 4) { tractor.y = F[1] + 5; } } }
			millA += dt * 1.6;
			for (k = 0; k < cloud.length; k++) { cloud[k].x += 4 * dt; if (cloud[k].x > W + 60) { cloud[k].x = -60; cloud[k].y = H * (0.1 + rnd() * 0.8); } }
			if (!balloon.on) { balloon.wait -= dt; if (balloon.wait <= 0 && !X.night && X.rain < 0.2) { balloon.on = true; balloon.x = -20; balloon.y = H * (0.25 + rnd() * 0.5); balloon.vy = (rnd() - 0.5) * 1.6; } }
			else { balloon.x += 5.5 * dt; balloon.y += balloon.vy * dt; if (balloon.x > W + 30) { balloon.on = false; balloon.wait = 50 + rnd() * 80; } }
		}
		world.warm = [lights];
		world.step = function (dt, X) {
			var k, t, near = false, d;
			for (k = 0; k < trains.length; k++) { stepTrain(trains[k], dt); }
			for (k = 0; k < NB; k++) { signals[k].red = taken(k, null); }
			// the crossing: lights first, then the gates, until the last wagon is clear
			for (k = 0; k < trains.length; k++) { t = trains[k]; if (ahead(t.s, crossS) < 120 || ahead(crossS, t.s) < t.cars.length * GAP + 12) { near = true; } }
			gateWant = near; gate = clamp(gate + (near ? dt * 0.8 : -dt * 0.9), 0, 1.4);
			// the railcar on the branch
			if (shuttle.dwell > 0) { shuttle.dwell -= dt; }
			else {
				d = shuttle.dir > 0 ? branch.len - 4 - shuttle.s : shuttle.s - 30;
				shuttle.v += clamp(Math.min(22, Math.sqrt(Math.max(0, 2 * 9 * d)) + 1) - shuttle.v, -14 * dt, 7 * dt);
				shuttle.s += shuttle.dir * shuttle.v * dt;
				if (d < 0.7) { shuttle.dir = -shuttle.dir; shuttle.dwell = 7 + rnd() * 5; shuttle.v = 0; }
			}
			shuttle.x = pathX(branch, shuttle.s - 14); shuttle.y = pathY(branch, shuttle.s - 14);
			stepFolk(dt); stepCars(dt); stepLand(dt, X); dots.step(dt);
		};
		function car(Dr, set, P, s, key) { var a = pathA(P, s); Dr.spr(set[turnIndex(a, set.length)], pathX(P, s), pathY(P, s)); return a; }
		world.draw = function (Dr) {
			var g = Dr.g, lit = Dr.lit, t = Dr.t, i, k, c, a, m, x, y, s, tr, n, flash = Math.floor(t * 2.4) & 1;
			Dr.layer("ground");
			// ripples on the river and the pond
			g.fillStyle = Dr.shade([214, 236, 248], 0.8);
			for (i = 0; i < 16; i++) { s = ((i * 61 + t * 7) % (river.len - 20)) + 10; if (Math.sin(t * 1.3 + i * 2.1) > 0) { g.fillRect(Math.round(pathX(river, s) + ((i * 7) % 5) - 2), Math.round(pathY(river, s)), 2, 1); } }
			for (i = 0; i < ducks.length; i++) { k = ducks[i]; Dr.spr(spr.duck, pond.x + Math.cos(k.a) * pond.rx * k.r, pond.y + Math.sin(k.a) * pond.ry * k.r); }
			if (lit > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = lit; g.drawImage(lights, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
			for (i = 0; i < sheep.length; i++) { Dr.spr(spr.sheep[sheep[i].f], sheep[i].x, sheep[i].y); }
			if (tractor.F) { Dr.spr(spr.tractor[tractor.dir > 0 ? 0 : 1], tractor.x, tractor.y); }
			// shadows, then the cars and the trains
			g.fillStyle = "rgba(16,40,30,0.28)";
			for (i = 0; i < cars.length; i++) { c = cars[i]; if (c.s >= 0) { g.fillRect(Math.round(c.x) - 3, Math.round(c.y) - 1, 8, 5); } }
			for (i = 0; i < trains.length; i++) { tr = trains[i]; for (n = 0; n < tr.cars.length; n++) { s = tr.s - 9 - n * GAP; g.fillRect(Math.round(pathX(main, s)) - 6, Math.round(pathY(main, s)) - 3, 15, 10); } }
			for (i = 0; i < cars.length; i++) {
				c = cars[i]; if (c.s < 0) { continue; }
				a = car(Dr, spr.cars[c.look], drive, c.s);
				if (lit > 0.3) { k = turnIndex(a, 16); Dr.glow(spr.beam[k], c.x + Math.cos(a) * 17, c.y + Math.sin(a) * 17, lit * 0.7); Dr.raw(spr.carLit[k], c.x, c.y, lit); }
			}
			for (i = 0; i < trains.length; i++) {
				tr = trains[i];
				for (n = tr.cars.length - 1; n >= 0; n--) {
					s = tr.s - 9 - n * GAP; a = car(Dr, spr.t[tr.cars[n]], main, s);
					if (lit > 0.2) { k = turnIndex(a, 32); if (tr.cars[n] === "coach") { Dr.raw(spr.t.coachLit[k], pathX(main, s), pathY(main, s), lit); } else if (n === 0) { Dr.raw(spr.t.headLit[k], pathX(main, s), pathY(main, s), lit); Dr.glow(spr.beam[turnIndex(a, 16)], pathX(main, s) + Math.cos(a) * 24, pathY(main, s) + Math.sin(a) * 24, lit * 0.8); } }
				}
			}
			a = car(Dr, spr.t.railcar, branch, shuttle.s - 5); a = pathA(branch, shuttle.s - 23); Dr.spr(spr.t.railcar[turnIndex(a + Math.PI, 32)], pathX(branch, shuttle.s - 23), pathY(branch, shuttle.s - 23));
			if (lit > 0.2) { Dr.raw(spr.t.coachLit[turnIndex(a, 32)], pathX(branch, shuttle.s - 5), pathY(branch, shuttle.s - 5), lit); Dr.raw(spr.t.coachLit[turnIndex(a, 32)], pathX(branch, shuttle.s - 23), pathY(branch, shuttle.s - 23), lit); }
			dots.draw(g, [Dr.shade([236, 238, 242], 0.85)]);
			Dr.layer("over");
			// signals show their colour by day and glow by night
			for (i = 0; i < NB; i++) { m = signals[i]; if (m.hid) { continue; } Dr.spr(spr.sig[m.red ? 1 : 0], m.x, m.y); Dr.raw(spr.sigGlow[m.red ? 1 : 0], m.x, m.y - 5, 0.35 + lit * 0.65); }
			// the level crossing
			k = clamp((gate - 0.4) * 1.6, 0, 1);
			if (k > 0.5) { Dr.spr(spr.gateV, crossX + 9, yR - 6); Dr.spr(spr.gateV, crossX - 9, yR - 6); } else { Dr.spr(spr.gateH, crossX + 9, yR - 8); Dr.spr(spr.gateH, crossX - 21, yR + 8); }
			g.fillStyle = Dr.shade([42, 47, 64]); g.fillRect(crossX + 8, yR - 9, 3, 3); g.fillRect(crossX - 10, yR + 7, 3, 3);
			if (gate > 0.02) { Dr.raw(spr.xlamp, crossX + 9, yR - 8, flash ? 1 : 0.15); Dr.raw(spr.xlamp, crossX - 9, yR + 8, flash ? 0.15 : 1); }
			// people on the platform
			for (i = 0; i < folk.length; i++) { m = folk[i]; if (m.st !== 1 && m.t > 0 && m.st !== 2) { continue; } Dr.spr(spr.men[m.look][m.st === 1 || m.t > 0 ? 0 : (Math.floor(t * 5 + i) & 1)], m.x, m.y); }
			// the mill turns
			Dr.spr(spr.sails[Math.floor(millA) & 3], mill[0] - 1, mill[1] - 1);
			if (lit > 0.05) { for (i = 0; i < lampsXY.length; i++) { Dr.raw(spr.lamp, lampsXY[i][0], lampsXY[i][1], lit); } }
			// cloud shadows and a balloon drifting over
			if (lit < 0.7) { for (i = 0; i < cloud.length; i++) { Dr.raw(spr.cloudSh, cloud[i].x, cloud[i].y, (1 - lit) * 0.9); } }
			if (balloon.on) { Dr.raw(spr.balloonSh, balloon.x + 16, balloon.y + 22, 1); Dr.spr(spr.balloon, balloon.x, balloon.y + Math.sin(t * 0.8) * 1.5); }
		};
		function dwelling(t) { return t.dwell > 0 || ahead(t.s, stS) < 150; }
		function moving(t) { return t.v > 4; }
		function flying() { return balloon.on; }
		world.shots = function (push) {
			var p = trains[1], f = trains[0], waiting = 0, k;
			for (k = 0; k < cars.length; k++) { if (cars[k].s >= 0 && cars[k].v < 1 && Math.abs(cars[k].x - crossX) < 60) { waiting++; } }
			if (dwelling(p)) { push("station", (stX0 + stX1) / 2, stY - 14, 1.67, 4, null, 13); }
			else if (p.v > 4 && !inHill(p.x, p.y, 20)) { push("express", 0, 0, 1.67, 2.4, p, 13, moving); }
			if (f.v > 4 && !inHill(f.x, f.y, 20)) { push("freight", 0, 0, 1.67, 2.2, f, 13, moving); }
			if (gate > 0.3 || waiting) { push("crossing", crossX - 26, yR, 2, 3.4, null, 10); }
			push("town", (bx0 + bx1) / 2, (yR + by1) / 2, 1.67, 1, null, 10);
			push("mill", mill[0] + 20, mill[1], 1.67, 0.9, null, 9);
			push("branch", 0, 0, 1.67, shuttle.v > 3 ? 1.6 : 0.5, shuttle, 12, null);
			if (balloon.on && balloon.x > 30 && balloon.x < W * 0.6) { push("balloon", 0, 0, 1.67, 3, balloon, 13, flying); }
		};
		return world;
	}
	addWorld("railway", {
		label: "model railway", colors: ["8fc7ee", "c8372d", "ffd98a"],
		sky: { day: [[70, 142, 214], [128, 190, 234], [206, 232, 244]], dusk: [[60, 54, 122], [214, 110, 112], [255, 190, 120]], night: [[6, 10, 34], [14, 24, 60], [30, 46, 92]], dawn: [[96, 118, 184], [232, 168, 170], [255, 220, 186]] },
		tint: { night: [0.3, 0.38, 0.62], dusk: [0.98, 0.76, 0.66] },
		build: railBuild
	});

	// ================================================================ 4. the ant farm
	// A slice of earth behind glass, seen at ant height: grass blades like trees above, the nest below. The nest is a tree
	// of tunnels and chambers. Its heart (the shaft, the queen, the food store, the nursery) is always there; the outer
	// galleries are dug a few grains at a time, stand a while, fall in, and are dug again somewhere new. Each ant works
	// through a short list of steps (go there, wait, pick up, put down) for its job: digger, forager, nurse or wanderer.
	function* antBuild(E) {
		var W = E.W, H = E.H, R = E.R, rnd = E.rnd, A = E.A, tall = E.tall, acc = E.accent, lamp = E.lamp, i, j;
		var surfY = Math.round(H * (tall ? 0.2 : 0.27)), ex = Math.round(W * 0.48), gap = tall ? 50 : 43, LV = Math.max(3, Math.floor((H - surfY - 34) / gap)), SH = H - surfY + 8;
		function surf(x) { return surfY + Math.round((vn(x / 40, 3, 5) - 0.5) * 6); }
		var world = { night: false, rain: 0, layers: {}, skyH: surfY + 6, horizon: surfY, sunX: [0.08, 0.92], moonX: [0.2, 0.85], clouds: 4, precip: { kind: "rain", y1: surfY + 2 } };
		var nodes = [], edges = [], extras = [], root, queenN, foodN, nurseN, spr = {}, dots = makeDots(90);
		var mask = K.canvas(W, SH), mg = mask.getContext("2d"), dug = K.canvas(W, SH), dg = dug.getContext("2d"), tmp = K.canvas(W, SH), tg = tmp.getContext("2d"), inner, soil, dirty = true, sheen, fallen = null, fellAt = -9;
		var mound = new Int16Array(W), grains = 0, phase = 0, phaseT = 0, half = 0, store = 9, eggs = 5, foods = [], ants = [];
		world.base = [142, 92, 58]; world.first = function (Dr) { if (world.layers.top) { Dr.layer("top"); } if (soil) { Dr.g.drawImage(soil, 0, surfY - 6); } };
		yield world;

		// ---- the plan of the nest
		function addNode(x, y, kind, rx, ry) { var n = { id: nodes.length, x: x, y: y, kind: kind, rx: rx || 0, ry: ry || 0, parent: null, pe: null, grow: 0, core: false, level: 0, side: 0 }; nodes.push(n); return n; }
		function shape(e, bend) {
			var a = e.a, b = e.b, dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
			e.P = makePath([[a.x, a.y], [(a.x + b.x) / 2 - dy / l * bend, (a.y + b.y) / 2 + dx / l * bend], [b.x, b.y]]); e.len = e.P.len;
			// the patch of earth it lies in, chamber and all (what has to be painted again when it changes)
			var P = e.P, i, x0 = P.x[0], x1 = x0, y0 = P.y[0], y1 = y0;
			for (i = 1; i < P.n; i++) { if (P.x[i] < x0) { x0 = P.x[i]; } else if (P.x[i] > x1) { x1 = P.x[i]; } if (P.y[i] < y0) { y0 = P.y[i]; } else if (P.y[i] > y1) { y1 = P.y[i]; } }
			e.x0 = Math.floor(Math.min(x0, b.x - b.rx)) - 6; e.x1 = Math.ceil(Math.max(x1, b.x + b.rx)) + 6; e.y0 = Math.floor(Math.min(y0, b.y - b.ry)) - 6; e.y1 = Math.ceil(Math.max(y1, b.y + b.ry)) + 6;
		}
		function addEdge(a, b, bend) { var e = { a: a, b: b, P: null, len: 0, dug: 0, core: false, busy: 0 }; shape(e, bend); b.parent = a; b.pe = e; edges.push(e); return e; }
		function placeChamber(c, S, big) {
			var reach = c.side < 0 ? S.x - 46 : W - 46 - S.x;
			c.x = Math.round(S.x + c.side * (52 + R() * Math.max(10, reach - 52) * (big ? 0.7 : 1))); c.y = Math.round(S.y + 5 + R() * 12);
			c.rx = Math.round(big ? 36 : 20 + R() * 13); c.ry = Math.round(big ? 13 : 9 + R() * 4);
			c.y = Math.min(c.y, H - 10 - c.ry);
		}
		yield* (function* () {
			var k, S, prev, c, s, sides, e, n;
			root = addNode(ex, surf(ex) + 1, "root"); prev = root;
			for (k = 1; k <= LV; k++) {
				S = addNode(ex + (k % 2 ? -1 : 1) * Math.round(8 + R() * 16), surfY + 12 + k * gap - (k === LV ? 8 : 0), "junction"); S.level = k;
				addEdge(prev, S, (R() - 0.5) * 10).core = true; prev = S; S.core = true; S.grow = 1;
				sides = tall && R() < 0.55 && k !== LV ? [k % 2 ? -1 : 1] : [k % 2 ? -1 : 1, k % 2 ? 1 : -1];
				for (s = 0; s < sides.length; s++) {
					c = addNode(0, 0, "chamber"); c.level = k; c.side = sides[s]; c.first = s === 0;
					placeChamber(c, S, k === LV && s === 0);
					addEdge(S, c, (R() - 0.5) * 18);
				}
			}
			for (k = 0; k < nodes.length; k++) {
				n = nodes[k]; if (n.kind !== "chamber" || !n.first) { continue; }
				if (n.level === LV) { queenN = n; } else if (n.level === LV - 1) { nurseN = n; } else if (n.level === Math.min(2, LV - 2) || (!foodN && n.level === 1)) { foodN = foodN && foodN.level === 2 ? foodN : n; }
			}
			[queenN, foodN, nurseN].forEach(function (q) { q.core = true; q.grow = 1; q.pe.core = true; });
			for (k = 0; k < edges.length; k++) { e = edges[k]; if (e.core) { e.dug = e.len; } else { extras.push(e); } }
			extras.sort(function (p, q) { return p.b.level - q.b.level; });
			// begin part-way through the digging
			for (k = 0; k < extras.length; k++) { if (k < Math.ceil(extras.length * 0.5)) { extras[k].dug = extras[k].len; extras[k].b.grow = 1; } else if (k === Math.ceil(extras.length * 0.5)) { extras[k].dug = extras[k].len * 0.5; } }
		})();
		function ancestors(n) { var l = []; while (n) { l.push(n); n = n.parent; } return l; }
		// the nodes to pass, in order, to get from a to b through the nest
		function routeTo(a, b) {
			var pa = ancestors(a), pb = ancestors(b), k, m, out = [];
			for (k = 0; k < pa.length; k++) { m = pb.indexOf(pa[k]); if (m >= 0) { break; } out.push(pa[k]); }
			out.push(pa[k]);
			for (m = m - 1; m >= 0; m--) { out.push(pb[m]); }
			out.shift();
			return out;
		}
		function opened(n) { return n.kind !== "chamber" ? true : n.pe.dug >= n.pe.len && n.grow >= 0.6 && !n.pe.closing; }

		// ---- painting: the earth, the dark inside of the tunnels, the garden on top
		// one gallery into the mask: a run of discs as far as it is dug, and its chamber. c = only the part near that patch
		function paintEdge(e, c) {
			var s, n = e.b, f, x, y;
			for (s = 0; s <= e.dug; s += 1.5) {
				x = Math.round(pathX(e.P, s)); y = Math.round(pathY(e.P, s));
				if (c && (x < c.x0 - 5 || x > c.x1 + 5 || y < c.y0 - 5 || y > c.y1 + 5)) { continue; }
				disc(mg, x, y - surfY + 6, s < 6 && e.a === root ? 3 : 4);
			}
			if (n.kind === "chamber" && n.grow > 0.02 && e.dug >= e.len) { f = Math.sqrt(n.grow); ell(mg, n.x, n.y - surfY + 6, Math.max(3, Math.round(n.rx * f)), Math.max(3, Math.round(n.ry * f))); }
		}
		function repaintMask() {
			var k;
			mg.clearRect(0, 0, W, SH); mg.fillStyle = "#000";
			for (k = 0; k < edges.length; k++) { paintEdge(edges[k], null); }
			fallen = null; dirty = true;
		}
		// While a gallery falls in, only its own patch of the mask is cleared and painted again, together with the parts of
		// any other tunnel that pass through that patch.
		function repaintPart(c) {
			var k, e, y0 = c.y0 - surfY + 6;
			mg.save(); mg.beginPath(); mg.rect(c.x0, y0, c.x1 - c.x0, c.y1 - c.y0); mg.clip();
			mg.clearRect(c.x0, y0, c.x1 - c.x0, c.y1 - c.y0); mg.fillStyle = "#000";
			for (k = 0; k < edges.length; k++) { e = edges[k]; if (e.x0 < c.x1 && e.x1 > c.x0 && e.y0 < c.y1 && e.y1 > c.y0) { paintEdge(e, c); } }
			mg.restore();
			dirty = true;
		}
		function compose() {
			dirty = false;
			dg.globalCompositeOperation = "copy"; dg.drawImage(inner, 0, 0);
			dg.globalCompositeOperation = "destination-in"; dg.drawImage(mask, 0, 0);
			// a shadow under every roof, light on every floor, a pale lip of loose earth below
			tg.globalCompositeOperation = "copy"; tg.drawImage(mask, 0, 0); tg.globalCompositeOperation = "destination-out"; tg.drawImage(mask, 0, 2);
			tg.globalCompositeOperation = "source-in"; tg.fillStyle = "rgba(10,6,8,0.62)"; tg.fillRect(0, 0, W, SH);
			dg.globalCompositeOperation = "source-over"; dg.drawImage(tmp, 0, 0);
			tg.globalCompositeOperation = "copy"; tg.drawImage(mask, 0, 0); tg.globalCompositeOperation = "destination-out"; tg.drawImage(mask, 0, -1);
			tg.globalCompositeOperation = "source-in"; tg.fillStyle = "rgba(196,140,92,0.55)"; tg.fillRect(0, 0, W, SH);
			dg.globalCompositeOperation = "source-over"; dg.drawImage(tmp, 0, 0);
			tg.globalCompositeOperation = "copy"; tg.drawImage(mask, 0, 1); tg.globalCompositeOperation = "destination-out"; tg.drawImage(mask, 0, 0);
			tg.globalCompositeOperation = "source-in"; tg.fillStyle = "rgba(255,226,176,0.42)"; tg.fillRect(0, 0, W, SH);
			dg.globalCompositeOperation = "source-over"; dg.drawImage(tmp, 0, 0);
		}
		soil = yield* bakeSteps(W, SH, function* (g) {
			var img = g.createImageData(W, SH), d = img.data, x, y, p, q, dep, c, k, b, f, n, t, D = H - surfY;
			var ST = [[[78, 52, 38], [68, 46, 34]], [[142, 92, 58], [132, 85, 53]], [[176, 110, 66], [166, 102, 61]], [[204, 160, 104], [194, 151, 97]], [[120, 84, 66], [109, 76, 61]], [[84, 62, 60], [75, 56, 56]]];
			var B = [0.06, 0.26, 0.48, 0.68, 0.87], sf = [];
			for (x = 0; x < W; x++) { sf[x] = surf(x); }
			for (y = 0; y < SH; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					p = (y * W + x) * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16; dep = (y - 6 + surfY - sf[x]) / D + (fbm(x / 70, y / 30, 12, 3) - 0.5) * 0.14;
					for (b = 0; b < 5 && dep > B[b]; b++) { }
					// each band shades into the next through a strip of dither
					f = b < 5 ? (B[b] - dep) / 0.03 : 9; if (f < 1 && q > f) { b = Math.min(5, b + 1); }
					n = vn(x / 3.1, y / 2.2, 30 + b) + (vn(x / 11, y / 5, 9) - 0.5) * 0.7;
					c = ST[b][n > 0.56 ? 1 : 0];
					if (b === 3 && vn(x / 1.7, y / 1.7, 44) > 0.8) { c = [226, 190, 136]; }
					if (y < 6 + sf[x] - surfY) { d[p + 3] = 0; continue; }
					d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
				}
			}
			g.putImageData(img, 0, 0);
			// stones, a few big ones deep down
			for (k = 0; k < (tall ? 90 : 70); k++) {
				x = Math.floor(R() * W); y = 18 + Math.floor(R() * (SH - 26)); n = y > SH * 0.6 && R() < 0.3 ? 4 + Math.floor(R() * 5) : 1 + Math.floor(R() * 3); t = R() < 0.5;
				ell(g, x + 1, y + 1, n + 1, Math.max(1, n - 1), "rgba(30,18,16,0.35)"); ell(g, x, y, n + 1, Math.max(1, n - 1), t ? "#8d8a8c" : "#a89880"); ell(g, x - 1, y - 1, n, Math.max(1, n - 2), t ? "#b4b2b4" : "#c9bca0");
				if (n > 2) { box(g, x - n + 1, y - n + 2, 2, 1, "#e2e0e0"); }
			}
			// roots feeling their way down from the grass
			for (k = 0; k < (tall ? 9 : 14); k++) {
				x = 10 + R() * (W - 20); y = 6 + surf(Math.round(x)) - surfY; n = 20 + R() * 60; t = (R() - 0.5) * 0.8;
				if (Math.abs(x - ex) < 26) { continue; }
				for (b = 0; b < n; b++) { t += (R() - 0.5) * 0.5; t *= 0.94; x += t; y += 1; box(g, x, y, b < n * 0.35 ? 2 : 1, 1, b % 5 === 0 ? "#b89a70" : "#d8c096"); if (b > 8 && R() < 0.06) { f = R() < 0.5 ? -1 : 1; for (c = 1; c < 9; c++) { box(g, x + f * c, y + c * 0.6, 1, 1, "#c8ae84"); } } }
			}
			// something old, far down
			x = Math.round(W * (tall ? 0.74 : 0.87)); y = SH - 32;
			for (k = 0; k < 40; k++) { f = k * 0.33; box(g, x + Math.cos(f) * (1 + k * 0.2), y + Math.sin(f) * (1 + k * 0.2), 1, 1, k % 6 === 0 ? "#a89a88" : "#e6dcc8"); }
			x = Math.round(W * 0.14); y = SH - 22; box(g, x, y, 14, 2, "#ece4d2"); disc(g, x, y, 2, "#ece4d2"); disc(g, x + 14, y + 1, 2, "#ece4d2"); box(g, x + 2, y + 2, 10, 1, "#b8ac98");
			// the wooden frame the glass sits in
			box(g, 0, 0, 3, SH, "#7a5434"); box(g, 0, 0, 1, SH, "#a67a4c"); box(g, W - 3, 0, 3, SH, "#7a5434"); box(g, W - 1, 0, 1, SH, "#52361f"); box(g, 0, SH - 4, W, 4, "#7a5434"); box(g, 0, SH - 4, W, 1, "#a67a4c");
		});
		inner = yield* bakeSteps(W, SH, function* (g) {
			var img = g.createImageData(W, SH), d = img.data, x, y, p, n, c, T = [[58, 38, 32], [48, 31, 28], [39, 25, 24]];
			for (y = 0; y < SH; y++) { if (E.late()) { yield; } for (x = 0; x < W; x++) { p = (y * W + x) * 4; n = vn(x / 4, y / 3, 61) * 1.6 + BAYER[(y & 3) * 4 + (x & 3)] / 16 * 0.8 + y / SH * 0.5; c = T[clamp(Math.floor(n), 0, 2)]; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; } }
			g.putImageData(img, 0, 0);
		});
		world.layers.mist = yield* fogSteps(W, 76, 4, E.late); world.mistY0 = surfY - 80; world.mistY1 = surfY - 40;
		sheen = K.bake(W, H, function (g) {
			var y, x0 = Math.round(W * 0.16), x1 = Math.round(W * 0.7);
			for (y = surfY; y < H; y++) { box(g, x0 + Math.round((H - y) * 0.42), y, 10, 1, "rgba(255,255,255,0.05)"); box(g, x0 + 16 + Math.round((H - y) * 0.42), y, 3, 1, "rgba(255,255,255,0.05)"); box(g, x1 + Math.round((H - y) * 0.42), y, 5, 1, "rgba(255,255,255,0.04)"); }
		});
		// the garden: blades of grass as tall as trees, a daisy, a toadstool. back = hazier, behind; front = in front of the ants
		function blade(g, x, base, h, lean, c1, c2, wide) {
			var k, t, w, xx;
			for (k = 0; k < h; k++) { t = k / h; w = Math.max(1, Math.round(wide * (1 - t * t))); xx = Math.round(x + lean * t * t * h * 0.5 - w / 2); box(g, xx, base - k, w, 1, c2); box(g, xx, base - k, Math.max(1, w >> 1), 1, c1); }
		}
		world.layers.top = yield* bakeSteps(W, surfY + 12, function* (g) {
			var x, k, b, c, y, n, GR = ["#5fa04a", "#4c8a42", "#3c7440", "#77b85a"], HZ = ["#8fc08a", "#a6cf9c", "#7fb27e"];
			for (k = 0; k < (tall ? 26 : 44); k++) { if (E.late()) { yield; } x = R() * W; blade(g, x, surf(clamp(Math.round(x), 0, W - 1)) + 2, 24 + R() * (surfY - 30), (R() - 0.5) * 1.2, HZ[k % 3], HZ[(k + 1) % 3], 3 + R() * 3); }
			// a daisy and a clover on the far side of the entrance
			x = Math.round(W * 0.82); y = Math.max(14, surfY - 62);
			blade(g, x, surf(x) + 2, surf(x) - y, 0.1, "#6aa850", "#4c8a42", 3);
			for (k = 0; k < 10; k++) { c = k * TAU / 10; ell(g, Math.round(x + 1 + Math.cos(c) * 9), Math.round(y + Math.sin(c) * 7), 4, 3, k % 2 ? "#f6f4ee" : "#dfe4ea"); }
			ell(g, x + 1, y, 5, 4, "#f2b632"); ell(g, x, y - 1, 3, 2, "#ffd95a");
			x = Math.round(W * 0.2); y = surf(x) - 26; blade(g, x, surf(x) + 2, 26, 0, "#6aa850", "#4c8a42", 2);
			disc(g, x - 6, y, 6, "#4c8a42"); disc(g, x + 6, y, 6, "#4c8a42"); disc(g, x, y - 8, 6, "#4c8a42"); disc(g, x - 7, y - 1, 4, "#6aa850"); disc(g, x + 5, y - 1, 4, "#6aa850"); disc(g, x - 1, y - 9, 4, "#6aa850");
			// a toadstool
			x = Math.round(W * (tall ? 0.7 : 0.64)); y = surf(x);
			box(g, x - 3, y - 16, 7, 18, "#ece2cc"); box(g, x + 2, y - 16, 2, 18, "#cabfa6"); ell(g, x, y - 19, 14, 7, css(mul(acc, 0.72))); ell(g, x - 1, y - 20, 12, 5, css(acc)); box(g, x - 13, y - 16, 27, 2, "#f2ead8");
			box(g, x - 8, y - 22, 3, 2, "#fbf6ea"); box(g, x + 3, y - 24, 3, 2, "#fbf6ea"); box(g, x - 1, y - 20, 2, 2, "#fbf6ea"); box(g, x + 8, y - 20, 2, 1, "#fbf6ea");
			for (k = 0; k < (tall ? 40 : 70); k++) { if (E.late()) { yield; } x = R() * W; blade(g, x, surf(clamp(Math.round(x), 0, W - 1)) + 2, 10 + R() * R() * (surfY - 26), (R() - 0.5) * 1.6, GR[k % 4], GR[(k + 1) % 4], 2 + R() * 3); }
			// the turf itself, with small flowers
			for (x = 0; x < W; x++) { y = surf(x); box(g, x, y - 1, 1, 4, GR[(x * 7 + (x >> 2)) % 3]); box(g, x, y + 3, 1, 3, "#4a3222"); if (ih(x, 3, 7) < 0.5) { box(g, x, y - 2 - Math.floor(ih(x, 5, 9) * 4), 1, 3, GR[3]); } }
			for (k = 0; k < (tall ? 8 : 14); k++) { x = Math.round(8 + R() * (W - 16)); y = surf(x); if (Math.abs(x - ex) < 34) { continue; } n = 5 + Math.floor(R() * 6); box(g, x, y - n, 1, n, "#4c8a42"); c = k % 3 === 0 ? css(acc) : k % 3 === 1 ? "#f6f4ee" : "#f2c230"; box(g, x - 1, y - n - 1, 3, 1, c); box(g, x, y - n - 2, 1, 3, c); box(g, x, y - n - 1, 1, 1, "#f2b632"); }
		});
		world.layers.front = K.bake(W, 40, function (g) {
			var k, x, GR = ["#3c7440", "#2f6238", "#4c8a42"];
			for (k = 0; k < (tall ? 7 : 11); k++) { x = (k + 0.3 + R() * 0.5) * W / (tall ? 7 : 11); if (Math.abs(x - ex) < 40) { continue; } blade(g, x, 39, 12 + R() * 24, (R() - 0.5) * 1.6, GR[k % 3], GR[(k + 1) % 3], 3 + R() * 2); blade(g, x + 4, 39, 8 + R() * 12, (R() - 0.5) * 2, GR[(k + 2) % 3], GR[k % 3], 3); }
		});

		// ---- sprites
		yield* (function* () {
			var body = css(acc), hi = css(mx(acc, [255, 236, 190], 0.45)), leg = css(mul(acc, 0.62)), pal = { b: body, h: hi, l: leg, e: "#1c1210" };
			var F = [["........l", ".bbb.bbhh", "bbhbbbbhe", ".bbb.bb..", ".l..l.l.."], ["........l", ".bbb.bbhh", "bbhbbbbhe", ".bbb.bb..", "l..l...l."], [".......l.", ".bbb.bbhh", "bbhbbbbhe", ".bbb.bb..", ".l..l.l.."]], k, cv;
			spr.antR = []; spr.antL = [];
			for (k = 0; k < 3; k++) { cv = pixData(F[k], pal); spr.antR.push(rotSet(A, cv, 16)); spr.antL.push(rotSet(A, flipData(cv), 16)); }
			if (E.late()) { yield; }
			spr.bit = [null, A.add(pix(["ss", "sS"], { s: "#e2c494", S: "#b8946a" }), 1, 1), A.add(pix(["gG", "gg"], { g: "#8fd060", G: "#5fa83c" }), 1, 1), A.add(pix(["ww", "ww"], { w: "#fbf6ea" }), 1, 1), A.add(pix(["rR", "rr"], { r: "#ff6a5a", R: "#c8372d" }), 1, 1)];
			spr.queen = [A.add(pix(["..........ccc...l", ".aaaaaaa.ccccc.hh", "aasasasaaccccchhe", "aasasasaaccccchh.", ".aaaaaaa..l.l.l..", "..l..l..........."], { a: css(mul(acc, 0.8)), s: css(mx(acc, [255, 240, 200], 0.6)), c: css(mul(acc, 0.9)), h: hi, e: "#1c1210", l: leg })), A.add(pix(["..........ccc..l.", "aaaaaaaa.ccccc.hh", "asasasasaccccchhe", "asasasasaccccchh.", "aaaaaaaa..l.l.l..", ".l..l............"], { a: css(mul(acc, 0.8)), s: css(mx(acc, [255, 240, 200], 0.6)), c: css(mul(acc, 0.9)), h: hi, e: "#1c1210", l: leg }))];
			spr.egg = A.add(pix([".ww", "wwW"], { w: "#fbf6ea", W: "#d8d0c0" }), 1, 2);
			spr.grub = A.add(pix([".www.", "wWwWw"], { w: "#f4e8cc", W: "#d8c8a4" }), 2, 2);
			spr.berry = [A.add(pix([".gg...", "..g...", ".rrrr.", "rrRrrr", "rrrrRr", "rRrrrr", ".rrrr."], { g: "#4c8a42", r: "#e5483f", R: "#ffd0b0" }), 3), A.add(pix(["..g..", ".rrr.", "rRrrr", ".rrr."], { g: "#4c8a42", r: "#e5483f", R: "#ffd0b0" }), 2), A.add(pix([".r.", "rrr"], { r: "#e5483f" }), 1)];
			spr.leaf = [A.add(pix(["...gggg..", ".ggGGggg.", "ggGggGggg", ".gggGggg.", "...ggg..."], { g: "#7cc050", G: "#4c8a42" }), 4), A.add(pix([".gggg.", "ggGGgg", ".ggg.."], { g: "#7cc050", G: "#4c8a42" }), 3), A.add(pix(["ggg", ".g."], { g: "#7cc050" }), 1)];
			spr.fly = [A.add(pix(["a.a", ".k.", "a.a"], { a: css(mx(acc, [255, 255, 255], 0.3)), k: "#2a2028" }), 1, 1), A.add(pix([".a.", ".k.", ".a."], { a: css(mx(acc, [255, 255, 255], 0.3)), k: "#2a2028" }), 1, 1)];
			spr.spark = A.add(haloSprite(3, lamp), 3, 3);
			spr.snail = A.add(pix(["...sss...", "..sSSss.k", ".sSssSs.k", ".sSSSss.b", "bbbbbbbbb"], { s: "#c98a4a", S: "#8a5a2c", b: "#e8d8b0", k: "#6b5a4a" }), 4);
			spr.lady = A.add(pix([".rkr.", "rrkrr", "k.k.k"], { r: "#e5483f", k: "#1c1210" }), 2);
		})();

		// ---- the ants
		var NA = E.count(38, 12, 66), ROLES = ["dig", "dig", "forage", "nurse", "dig", "forage", "roam", "nurse", "forage", "roam"];
		function ground(x) { x = clamp(Math.round(x), 0, W - 1); return surf(x) - mound[x]; }
		function faces() {
			var out = [], k, e;
			if (phase !== 0) { return out; }
			for (k = 0; k < extras.length && out.length < 2; k++) { e = extras[k]; if (e.dug < e.len || e.b.grow < 1) { out.push(e); } }
			return out;
		}
		function anyChamber() {
			var k, n, tries = 0;
			do { n = nodes[Math.floor(rnd() * nodes.length)]; tries++; } while ((n.kind !== "chamber" || !opened(n)) && tries < 40);
			return n.kind === "chamber" && opened(n) ? n : foodN;
		}
		// one more grain on the heap by the door: it slides down until it rests
		function addGrain() {
			var x = clamp(ex + Math.round((rnd() + rnd() - 1) * 9), 4, W - 5), guard = 0;
			if (grains > 430) { return; }
			while (guard++ < 40) { if (mound[x - 1] < mound[x] - 1 && rnd() < 0.5) { x--; } else if (mound[x + 1] < mound[x] - 1) { x++; } else if (mound[x - 1] < mound[x] - 1) { x--; } else { break; } if (x < 3 || x > W - 4) { break; } }
			mound[x]++; grains++;
		}
		function plan(a) {
			var q = a.q, f, e, n, fd, role = a.role;
			q.length = 0; a.qi = 0; a.home = false; a.t = 0;
			if (a.flee) { a.flee = false; q.push(["N", root.id]); q.push(["N", anyChamber().id]); return; }
			if (role === "dig") {
				f = faces();
				if (f.length) {
					e = f[(a.id + Math.floor(rnd() * 2)) % f.length];
					q.push(["N", e.a.id], ["F", e], ["W", 2.2 + rnd(), 1], ["X", function (m) { digAt(e, m); }], ["B", e], ["N", root.id], ["S", ex + (rnd() + rnd() - 1) * 14], ["W", 0.5, 0], ["X", function (m) { if (m.carry === 1) { addGrain(); } m.carry = 0; }], ["R"]);
					return;
				}
				role = "roam";
			}
			if (role === "forage") {
				fd = foods[a.id % foods.length]; if (fd.left <= 0) { fd = foods[(a.id + 1) % foods.length]; }
				if (!world.night && world.rain < 0.3 && fd.left > 0 && store < 30) {
					q.push(["N", root.id], ["S", fd.x + (rnd() - 0.5) * 5], ["W", 1 + rnd(), 1], ["X", function (m) { if (fd.left > 0) { fd.left--; m.carry = fd.kind; } }], ["R"], ["N", foodN.id], ["H", foodN.id, 1.2], ["X", function (m) { if (m.carry) { store = Math.min(34, store + 1); } m.carry = 0; }]);
					return;
				}
				role = "roam";
			}
			if (role === "nurse") {
				q.push(["N", foodN.id], ["H", foodN.id, 1], ["X", function (m) { if (store > 0) { store--; m.carry = 2; } }], ["N", queenN.id], ["H", queenN.id, 2.4], ["X", function (m) { m.carry = 3; }], ["N", nurseN.id], ["H", nurseN.id, 1.8], ["X", function (m) { m.carry = 0; eggs = Math.min(16, eggs + 1); }], ["H", nurseN.id, 2 + rnd() * 4]);
				return;
			}
			n = anyChamber(); q.push(["N", n.id], ["H", n.id, 3 + rnd() * 8]);
		}
		function digAt(e, m) {
			var n = e.b, s0 = e.dug, k;
			if (phase !== 0) { return; }
			if (e.dug < e.len) { e.dug = Math.min(e.len, e.dug + 5); mg.fillStyle = "#000"; for (k = s0; k <= e.dug; k += 1) { disc(mg, Math.round(pathX(e.P, k)), Math.round(pathY(e.P, k) - surfY + 6), 4); } }
			else if (n.grow < 1) { n.grow = Math.min(1, n.grow + 5.5 / (n.rx * 1.3)); k = Math.sqrt(n.grow); mg.fillStyle = "#000"; ell(mg, n.x, n.y - surfY + 6, Math.max(3, Math.round(n.rx * k)), Math.max(3, Math.round(n.ry * k))); }
			dirty = true; m.carry = 1;
			for (k = 0; k < 5; k++) { dots.add(m.x, m.y, (rnd() - 0.5) * 14, -rnd() * 10, 0.5 + rnd() * 0.3, 0, 1, 0); }
		}
		for (i = 0; i < NA; i++) {
			j = { id: i, role: ROLES[i % 10], x: root.x, y: root.y, ang: 0, node: root, edge: null, s: 0, dir: 1, path: [], q: [], qi: 0, t: 0, mode: 0, carry: 0, tx: 0, ty: 0, lane: (rnd() - 0.5) * 3, cool: rnd() * 6, meet: 0, sp: 0.85 + rnd() * 0.35, ph: rnd() * 9, left: false, work: 0, flee: false };
			// scattered through the nest to begin with
			j.node = i % 4 === 0 ? root : anyChamber(); j.x = j.node.x; j.y = j.node.y;
			ants.push(j);
		}
		function enterEdge(a, to) {
			var e = to.parent === a.node ? to.pe : a.node.pe;
			a.edge = e; a.dir = to.parent === a.node ? 1 : -1; a.s = a.dir > 0 ? 0 : e.len; a.to = to; e.busy++;
		}
		function stepAnt(a, dt, slow) {
			var act = a.q[a.qi], e, sp = 15 * a.sp * slow * dt, d, n, k, o, f, gy;
			if (a.cool > 0) { a.cool -= dt; }
			if (a.meet > 0) { a.meet -= dt; return; }
			if (a.flee && !a.edge && a.mode !== 2) { act = null; }
			if (!act) { plan(a); return; }
			a.work = 0;
			if (act[0] === "N") {
				if (!a.edge) {
					if (a.mode === 2) { a.mode = 0; }
					if (a.node.id === act[1]) { a.qi++; return; }
					if (!a.path.length) { a.path = routeTo(a.node, nodes[act[1]]); }
					n = a.path[0];
					// the way is shut (still being dug, or fallen in): think again
					if (!n || (n.kind === "chamber" && n.parent === a.node && !opened(n))) { a.path.length = 0; a.q.length = 0; return; }
					a.path.shift(); enterEdge(a, n);
				}
				// keep a body's length behind the ant in front, so a column reads as ants and not as a stripe
				e = a.edge; f = 1;
				for (k = 0; k < ants.length; k++) { o = ants[k]; if (o !== a && o.edge === e && o.dir === a.dir) { d = (o.s - a.s) * a.dir; if (d > 0 && d < 8) { f = d < 5 ? 0.15 : 0.55; break; } } }
				a.s += a.dir * sp * f;
				if ((a.dir > 0 && a.s >= e.len) || (a.dir < 0 && a.s <= 0)) { a.node = a.to; a.x = a.node.x; a.y = a.node.y; e.busy--; a.edge = null; return; }
				a.x = pathX(e.P, a.s); a.y = pathY(e.P, a.s); f = pathA(e.P, a.s); a.ang = a.dir > 0 ? f : f + Math.PI;
				a.x += -Math.sin(f) * a.lane * 0.8; a.y += Math.cos(f) * a.lane * 0.5;
				// meeting another coming the other way: stop and touch antennae
				if (a.cool <= 0) {
					for (k = 0; k < ants.length; k++) { o = ants[k]; if (o !== a && o.edge === e && o.dir !== a.dir && o.cool <= 0 && Math.abs(o.s - a.s) < 5 && (o.s - a.s) * a.dir > 0) { a.meet = o.meet = 0.7 + rnd() * 0.5; a.cool = o.cool = 7 + rnd() * 9; break; } }
				}
			} else if (act[0] === "F") {
				e = act[1];
				if (!a.edge) { if (a.node !== e.a || phase !== 0) { a.q.length = 0; return; } a.edge = e; a.dir = 1; a.s = 0; e.busy++; }
				d = Math.max(2, Math.min(e.dug, e.len) - 3 + (e.dug >= e.len ? e.b.rx * Math.sqrt(e.b.grow) * 0.5 : 0));
				a.s += sp; if (a.s >= Math.min(d, e.len)) { a.s = Math.min(d, e.len); a.qi++; }
				a.x = pathX(e.P, a.s); a.y = pathY(e.P, a.s); a.ang = pathA(e.P, a.s);
			} else if (act[0] === "B") {
				e = act[1]; a.s -= sp; a.dir = -1;
				if (a.s <= 0) { a.node = e.a; a.x = e.a.x; a.y = e.a.y; e.busy--; a.edge = null; a.dir = 1; a.qi++; return; }
				a.x = pathX(e.P, a.s); a.y = pathY(e.P, a.s); a.ang = pathA(e.P, a.s) + Math.PI;
			} else if (act[0] === "W") {
				if (a.t <= 0) { a.t = act[1]; }
				a.t -= dt; a.work = act[2]; if (a.t <= 0) { a.t = 0; a.qi++; }
			} else if (act[0] === "X") { act[1](a); a.qi++; }
			else if (act[0] === "S" || act[0] === "R") {
				// out on the grass: x is all that matters, the ground gives y
				a.mode = 2; d = act[0] === "R" ? ex : clamp(act[1], 8, W - 9);
				if (Math.abs(d - a.x) <= sp * 1.3) { a.x = d; a.qi++; if (act[0] === "R") { a.node = root; } }
				else { a.left = d < a.x; a.x += (a.left ? -1 : 1) * sp * 1.3; }
				a.y = ground(a.x); gy = ground(a.x + (a.left ? -2 : 2)); a.ang = Math.atan2(gy - a.y, a.left ? -2 : 2);
			} else if (act[0] === "H") {
				// pottering about inside a chamber
				n = nodes[act[1]];
				if (!a.home) { a.home = true; a.t = act[2]; a.tx = n.x; a.ty = n.y; }
				a.t -= dt;
				if (a.t <= 0) { a.tx = n.x; a.ty = n.y; }
				d = dist(a.x, a.y, a.tx, a.ty);
				if (d < 1.2) {
					if (a.t <= 0) { a.home = false; a.t = 0; a.x = n.x; a.y = n.y; a.qi++; return; }
					if (rnd() < dt * 0.8) { f = rnd() * TAU; k = Math.sqrt(n.grow) * 0.7 * Math.sqrt(rnd()); a.tx = n.x + Math.cos(f) * n.rx * k; a.ty = n.y + Math.sin(f) * n.ry * k * 0.6 + n.ry * 0.3; }
				} else { a.x += (a.tx - a.x) / d * sp * 0.7; a.y += (a.ty - a.y) / d * sp * 0.7; a.left = a.tx < a.x; a.ang = a.left ? Math.PI : 0; }
			}
		}
		// ---- the outer galleries fall in and are dug again
		function stepNest(dt) {
			var k, e, any = false, n;
			phaseT += dt;
			if (phase === 0) { if (!faces().length) { phase = 1; phaseT = 0; } }
			else if (phase === 1) { if (phaseT > 150) { phase = 2; phaseT = 0; for (k = 0; k < extras.length; k++) { extras[k].closing = (k % 2) === half; } for (k = 0; k < ants.length; k++) { ants[k].flee = !ants[k].edge || !ants[k].edge.core; if (ants[k].flee && !ants[k].edge) { ants[k].q.length = 0; ants[k].t = 0; } } } }
			else if (phase === 2) {
				// from the far end back, once nobody is inside; the heap by the door blows away
				for (k = extras.length - 1; k >= 0 && !any && phaseT > 9; k--) {
					e = extras[k]; if (!e.closing || (e.dug <= 0 && e.b.grow <= 0)) { continue; }
					any = true;
					if (e.busy > 0 && phaseT < 60) { break; }
					if (e.b.grow > 0) { e.b.grow = Math.max(0, e.b.grow - dt * 0.2); } else { e.dug = Math.max(0, e.dug - dt * 16); }
					// the mask is painted again when the picture is next drawn (at most a few times a second), not here
					if (fallen && fallen !== e) { repaintPart(fallen); }
					fallen = e;
				}
				if (grains > 150 && rnd() < dt * 5) { n = clamp(ex + Math.round((rnd() + rnd() - 1) * 26), 2, W - 3); if (mound[n] > 0 && mound[n] >= mound[n - 1] && mound[n] >= mound[n + 1]) { mound[n]--; grains--; } }
				if (!any && phaseT > 9) {
					for (k = 0; k < extras.length; k++) { e = extras[k]; if (!e.closing) { continue; } e.closing = false; e.busy = 0; e.dug = 0; e.b.grow = 0; placeChamber(e.b, e.a, false); shape(e, (rnd() - 0.5) * 18); }
					half = 1 - half;
					for (k = 0; k < ants.length; k++) { if (ants[k].edge && !ants[k].edge.core && ants[k].edge.dug <= 0) { ants[k].edge = null; ants[k].node = root; ants[k].x = root.x; ants[k].y = root.y; ants[k].q.length = 0; ants[k].path.length = 0; } }
					repaintMask(); phase = 0; phaseT = 0;
				}
			}
		}
		// ---- on the grass: things to carry home, and the neighbours
		foods.push({ x: Math.round(W * 0.13), kind: 4, left: 16, max: 16, wait: 0 }); foods.push({ x: Math.round(W * (tall ? 0.86 : 0.74)), kind: 2, left: 14, max: 14, wait: 0 });
		var bfly = { x: W * 0.3, y: surfY * 0.4, tx: W * 0.5, ty: surfY * 0.3, t: 0 }, glow = [], snail = { x: -12 }, lady = { x: W * 0.9, dir: -1, wait: 0 }, eggT = 12;
		for (i = 0; i < 9; i++) { glow.push({ x: rnd() * W, y: surfY * (0.25 + rnd() * 0.7), ph: rnd() * 9, v: 0.3 + rnd() * 0.5 }); }
		for (i = 0; i < 170; i++) { addGrain(); }
		repaintMask();
		world.warm = [soil, dug, sheen];
		world.step = function (dt, X) {
			var k, f, slow = X.night ? 0.62 : 1, d;
			world.night = X.night; world.rain = X.rain;
			for (k = 0; k < ants.length; k++) { stepAnt(ants[k], dt, slow); }
			stepNest(dt);
			dots.grav = 40; dots.step(dt);
			for (k = 0; k < foods.length; k++) { f = foods[k]; if (f.left <= 0) { f.wait += dt; if (f.wait > 24) { f.wait = 0; f.left = f.max; f.x = Math.round(k === 0 ? W * (0.06 + rnd() * 0.3) : W * (0.62 + rnd() * 0.32)); } } }
			// the queen's eggs hatch and are eaten up
			eggT -= dt; if (eggT <= 0) { eggT = 14 + rnd() * 10; if (eggs > 4) { eggs--; } if (store > 6 && rnd() < 0.5) { store--; } }
			bfly.t -= dt; if (bfly.t <= 0) { bfly.t = 1.5 + rnd() * 3; bfly.tx = 20 + rnd() * (W - 40); bfly.ty = 8 + rnd() * (surfY - 26); }
			d = dist(bfly.x, bfly.y, bfly.tx, bfly.ty); if (d > 1) { bfly.x += (bfly.tx - bfly.x) / d * 16 * dt; bfly.y += (bfly.ty - bfly.y) / d * 16 * dt + Math.sin(X.t * 9) * 0.25; }
			snail.x += 0.55 * dt; if (snail.x > W + 14) { snail.x = -14; }
			if (lady.wait > 0) { lady.wait -= dt; } else { lady.x += lady.dir * 5 * dt; if (lady.x < 10 || lady.x > W - 10) { lady.dir = -lady.dir; lady.wait = 4 + rnd() * 10; } }
		};
		world.draw = function (Dr) {
			var g = Dr.g, t = Dr.t, lit = Dr.lit, k, a, s, f, x, y, n, set, oy = surfY - 6;
			Dr.layer("top");
			// the heap of dug earth by the door
			for (x = Math.max(2, ex - 40); x < Math.min(W - 2, ex + 40); x++) { n = mound[x]; if (n > 0) { y = surf(x); g.fillStyle = Dr.shade((x + n) % 3 ? [196, 150, 98] : [170, 126, 82]); g.fillRect(x, y - n, 1, n + 1); g.fillStyle = Dr.shade([226, 186, 130]); g.fillRect(x, y - n, 1, 1); } }
			g.fillStyle = Dr.shade([40, 26, 22]); g.fillRect(ex - 2, ground(ex) - 1, 5, 3);
			for (k = 0; k < foods.length; k++) { f = foods[k]; if (f.left > 0) { n = f.left > f.max * 0.6 ? 0 : f.left > f.max * 0.25 ? 1 : 2; Dr.spr((f.kind === 4 ? spr.berry : spr.leaf)[n], f.x, surf(f.x) + 1); } }
			Dr.spr(spr.snail, snail.x, surf(clamp(Math.round(snail.x), 0, W - 1)) + 1); Dr.spr(spr.lady, lady.x, surf(clamp(Math.round(lady.x), 0, W - 1)) - 1);
			g.drawImage(soil, 0, oy);
			if (fallen && (t - fellAt > 0.12 || t < fellAt)) { repaintPart(fallen); fallen = null; fellAt = t; }
			if (dirty) { compose(); }
			g.drawImage(dug, 0, oy);
			// what the chambers hold
			if (opened(foodN)) { for (k = 0; k < store; k++) { n = k % 9; x = foodN.x - 9 + n * 2 + (k > 17 ? 4 : k > 8 ? 2 : 0); y = foodN.y + foodN.ry - 2 - (k > 17 ? 4 : k > 8 ? 2 : 0); Dr.raw(spr.bit[(k * 7) % 3 === 0 ? 4 : 2], x, y, 1); } }
			for (k = 0; k < eggs; k++) { Dr.raw(k % 3 === 2 ? spr.grub : spr.egg, nurseN.x - nurseN.rx * 0.5 + (k % 8) * 4 + (k > 7 ? 2 : 0), nurseN.y + nurseN.ry - 1 - (k > 7 ? 3 : 0), 1); }
			Dr.raw(spr.queen[Math.floor(t * 0.8) & 1], queenN.x - 2, queenN.y + queenN.ry - 1, 1);
			Dr.raw(spr.egg, queenN.x - 14, queenN.y + queenN.ry - 1, 1); Dr.raw(spr.egg, queenN.x - 17, queenN.y + queenN.ry - 2, 1);
			// a worm working its way through the deep earth
			for (k = 0; k < 16; k++) { f = t * 0.35 - k * 0.11; x = W * 0.36 + Math.sin(f * 0.4) * W * 0.16 + Math.sin(f * 2.3) * 3; y = H - 13 + Math.sin(f * 3.1 + 1) * 2.5; g.fillStyle = k % 4 === 1 ? "#c9788a" : "#e59aa8"; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
			// dusk warms the earth a little and night darkens it; the ants are drawn after, so they stay bright
			k = Dr.look.tint[0] - Dr.look.tint[2];
			if (k > 0.03) { g.fillStyle = "rgba(255,120,70," + (k * 0.5).toFixed(3) + ")"; g.fillRect(0, surfY + 4, W, H - surfY - 4); }
			if (lit > 0.05) { g.fillStyle = "rgba(8,10,40," + (lit * 0.5).toFixed(3) + ")"; g.fillRect(0, surfY + 4, W, H - surfY - 4); }
			for (k = 0; k < ants.length; k++) {
				a = ants[k]; if (a.mode === 2) { continue; }
				f = a.meet > 0 ? 2 : (a.work ? (Math.floor(t * 9 + a.ph) & 1) : (Math.floor(t * 7 + a.ph) & 1));
				n = Math.cos(a.ang) >= 0;
				Dr.raw((n ? spr.antR : spr.antL)[f][turnIndex(n ? a.ang : a.ang - Math.PI, 16)], a.x, a.y + (a.edge ? 0 : -1), 1);
				if (a.carry) { Dr.raw(spr.bit[a.carry], a.x + Math.cos(a.ang) * 5, a.y + Math.sin(a.ang) * 5 - 3, 1); }
			}
			dots.draw(g, ["#d8b888"]);
			g.drawImage(sheen, 0, 0);
			// ants out on the grass, then the near blades over them
			for (k = 0; k < ants.length; k++) {
				a = ants[k]; if (a.mode !== 2) { continue; }
				f = a.work ? (Math.floor(t * 9 + a.ph) & 1) : (Math.floor(t * 7 + a.ph) & 1); n = !a.left;
				Dr.spr((n ? spr.antR : spr.antL)[f][turnIndex(n ? a.ang : a.ang - Math.PI, 16)], a.x, a.y - 1);
				if (a.carry) { Dr.spr(spr.bit[a.carry], a.x + (a.left ? -5 : 5), a.y - 5); }
			}
			Dr.layer("front", 0, surfY - 36);
			if (lit < 0.5) { Dr.spr(spr.fly[Math.floor(t * 8) & 1], bfly.x, bfly.y); }
			else { for (k = 0; k < glow.length; k++) { s = glow[k]; f = Math.sin(t * s.v * 3 + s.ph); if (f > 0) { Dr.raw(spr.spark, (s.x + Math.sin(t * s.v + s.ph) * 26 + W) % W, s.y + Math.cos(t * s.v * 0.7 + s.ph) * 8, f * lit); } } }
		};
		function busyAnt(a) { return a.mode === 2; }
		world.shots = function (push) {
			var f = faces(), k, a, out = null;
			push("queen", queenN.x - 4, queenN.y, 2, 2.6, null, 12);
			push("store", foodN.x, foodN.y, 2, 1.3, null, 9);
			push("nursery", nurseN.x, nurseN.y, 2, 1.5, null, 9);
			push("door", ex, surfY - 6, 1.67, 2.2, null, 11);
			if (f.length) { k = f[0]; push("dig", pathX(k.P, Math.min(k.dug, k.len)), pathY(k.P, Math.min(k.dug, k.len)), 2, 3.4, null, 13); }
			for (k = 0; k < ants.length; k++) { a = ants[k]; if (a.mode === 2 && a.carry && Math.abs(a.x - ex) > 60) { out = a; break; } }
			if (out) { push("forager", 0, 0, 2, 3, out, 12, busyAnt); }
		};
		return world;
	}
	addWorld("antfarm", {
		label: "ant farm", colors: ["8ed0f0", "e8842c", "e2ff8c"],
		sky: { day: [[92, 170, 232], [150, 208, 242], [214, 238, 246]], dusk: [[70, 62, 130], [222, 124, 116], [255, 200, 132]], night: [[8, 12, 38], [16, 26, 66], [34, 50, 100]], dawn: [[104, 128, 190], [236, 176, 176], [255, 224, 190]] },
		build: antBuild
	});

	// ================================================================ 5. the city junction
	// Seen from above. The lights run a fixed round: north-south, east-west, then everybody on foot at once. Vehicles go
	// straight on or turn right (so no two green streams ever cross), keep a gap to whatever is in front, will not enter
	// the box unless the road beyond it is moving, and trams keep to their rails down the middle of the wide road.
	var CITY_ART = {
		car: ["..bbbbbbb..", ".bBBwBBBwb.", "hbBBwBBBwbt", "hbBBwBBBwbt", ".bBBwBBBwb.", "..bbbbbbb.."],
		van: [".bbbbbbbbbbb.", "bBBBBBBBBwBbh", "bBBBBBBBBwBb.", "bBBBBBBBBwBb.", "bBBBBBBBBwBbh", ".bbbbbbbbbbb."],
		bus: [".aaaaaaaaaaaaaaaaaaaaaa.", "aAAAAAAAAAAAAAAAAAAAAwwa", "aAkAAkkAAAAkkAAAAkkAAwwh", "aAAAAAAAAAAAAAAAAAAAAwwa", "aAAAAAAAAAAAAAAAAAAAAwwa", "aAkAAkkAAAAkkAAAAkkAAwwh", "aAAAAAAAAAAAAAAAAAAAAwwa", ".aaaaaaaaaaaaaaaaaaaaaa."],
		tram: [".cccccccccccccccc.cccccccccccccccc.", "cCCCCCCCCCCCCCCCCkCCCCCCCCCCCCCCCwc", "cCaaaaaaCkkCaaaaCkCaaaaCkkCaaaaaCwh", "cCaaaaaaCkkCaaaaCkCaaaaCkkCaaaaaCwc", "cCaaaaaaCkkCaaaaCkCaaaaCkkCaaaaaCwh", "cCCCCCCCCCCCCCCCCkCCCCCCCCCCCCCCCwc", ".cccccccccccccccc.cccccccccccccccc."],
		bike: ["k.jj.k", "kkjfkk", "k.jj.k"]
	};
	function* junctionBuild(E) {
		var W = E.W, H = E.H, R = E.R, rnd = E.rnd, A = E.A, tall = E.tall, acc = E.accent, lamp = E.lamp, i, j;
		var cx = Math.round(W * 0.5), cy = Math.round(H * 0.5), NSW = 14, EWW = 22, PAV = 9, bx0 = cx - NSW, bx1 = cx + NSW, by0 = cy - EWW, by1 = cy + EWW;
		var world = { layers: {}, skyH: 0, precip: { kind: "rain" } }, lights = K.canvas(W, H), lg = lights.getContext("2d"), spr = {}, routes = [], bikeRoutes = [], tramRoutes = [], heads = [], lampsXY = [], neon = [], shine = [];
		var phase = 0, phT = rnd() * 6, LEN = [11, 2.5, 1.5, 11, 2.5, 1.5, 8, 3.5], blocked = [false, false, false, false];
		world.base = [112, 116, 126]; world.first = function (Dr) { if (world.layers.ground) { Dr.layer("ground"); } };
		yield world;
		// arms: 0 = from the north (heading south), 1 = from the east, 2 = from the south, 3 = from the west
		function arc(list, ox, oy, r, a0, a1) { var k, a; for (k = 0; k <= 6; k++) { a = a0 + (a1 - a0) * k / 6; list.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]); } }
		yield* (function* () {
			var xs = cx - 5, xn = cx + 5, yw = cy - 13, ye = cy + 13, r = 5, p;
			function add(list, pts, from, exit, stop) { var P = makeLine(pts); list.push({ P: P, from: from, exit: exit, stopS: stop }); }
			add(routes, [[xs, -16], [xs, H + 16]], 0, 2, by0 - 11 + 16);
			p = [[xs, -16]]; arc(p, xs - r, yw - r, r, 0, Math.PI / 2); p.push([-16, yw]); add(routes, p, 0, 3, by0 - 11 + 16);
			add(routes, [[W + 16, yw], [-16, yw]], 1, 3, W + 16 - (bx1 + 11));
			p = [[W + 16, yw]]; arc(p, xn + r, yw - r, r, Math.PI / 2, Math.PI); p.push([xn, -16]); add(routes, p, 1, 0, W + 16 - (bx1 + 11));
			add(routes, [[xn, H + 16], [xn, -16]], 2, 0, H + 16 - (by1 + 11));
			p = [[xn, H + 16]]; arc(p, xn + r, ye + r, r, Math.PI, Math.PI * 1.5); p.push([W + 16, ye]); add(routes, p, 2, 1, H + 16 - (by1 + 11));
			add(routes, [[-16, ye], [W + 16, ye]], 3, 1, bx0 - 11 + 16);
			p = [[-16, ye]]; arc(p, xs - r, ye + r, r, -Math.PI / 2, 0); p.push([xs, H + 16]); add(routes, p, 3, 2, bx0 - 11 + 16);
			add(bikeRoutes, [[cx - 11, -10], [cx - 11, H + 10]], 0, 2, by0 - 11 + 10); add(bikeRoutes, [[W + 10, cy - 19], [-10, cy - 19]], 1, 3, W + 10 - (bx1 + 11));
			add(bikeRoutes, [[cx + 11, H + 10], [cx + 11, -10]], 2, 0, H + 10 - (by1 + 11)); add(bikeRoutes, [[-10, cy + 19], [W + 10, cy + 19]], 3, 1, bx0 - 11 + 10);
			add(tramRoutes, [[W + 44, cy - 4], [-44, cy - 4]], 1, 3, W + 44 - (bx1 + 11)); add(tramRoutes, [[-44, cy + 4], [W + 44, cy + 4]], 3, 1, bx0 - 11 + 44);
		})();
		var corners = [[bx0 - 5, by0 - 5], [bx1 + 5, by0 - 5], [bx1 + 5, by1 + 5], [bx0 - 5, by1 + 5]];
		var ends = [[[-6, by0 - 5], [bx0 - 5, -6]], [[W + 6, by0 - 5], [bx1 + 5, -6]], [[W + 6, by1 + 5], [bx1 + 5, H + 6]], [[-6, by1 + 5], [bx0 - 5, H + 6]]];
		var park = { x0: bx1 + PAV + 6, y0: by1 + PAV + 6, x1: W - 6, y1: H - 6 }, pond = { x: 0, y: 0, rx: 0, ry: 0 };
		pond.x = Math.round(park.x0 + (park.x1 - park.x0) * (tall ? 0.5 : 0.58)); pond.y = Math.round(park.y0 + (park.y1 - park.y0) * (tall ? 0.62 : 0.52)); pond.rx = tall ? 26 : 34; pond.ry = tall ? 22 : 20;

		// ---- sprites
		yield* (function* () {
			var COL = [[229, 72, 63], [61, 143, 224], [240, 240, 244], [70, 76, 96], [47, 179, 122], [155, 89, 208], [200, 206, 216], [250, 204, 60]], k, pal;
			spr.cars = [];
			for (k = 0; k < COL.length; k++) { spr.cars.push(rotSet(A, pixData(CITY_ART.car, { b: css(mul(COL[k], 0.72)), B: css(COL[k]), w: "#27304a", h: "#fff6c8", t: "#c8372d" }), 16)); }
			if (E.late()) { yield; }
			spr.vans = [rotSet(A, pixData(CITY_ART.van, { b: "#b9c2d0", B: "#eef1f4", w: "#27304a", h: "#fff6c8" }), 16), rotSet(A, pixData(CITY_ART.van, { b: css(mul(acc, 0.7)), B: css(acc), w: "#27304a", h: "#fff6c8" }), 16)];
			if (E.late()) { yield; }
			spr.bus = rotSet(A, pixData(CITY_ART.bus, { a: css(mul(acc, 0.72)), A: css(acc), k: css(mx(acc, [255, 255, 255], 0.5)), w: "#27304a", h: "#fff6c8" }), 16);
			if (E.late()) { yield; }
			spr.tram = rotSet(A, pixData(CITY_ART.tram, { c: "#c9ccd2", C: "#f1f2ee", a: "#3a7a8c", k: "#30343f", w: "#27304a", h: "#fff6c8" }), 16);
			if (E.late()) { yield; }
			spr.tramLit = rotSet(A, pixData([".l.l.l.l.l.l.l.l...l.l.l.l.l.l.l.l.", "...................................", "...................................", "...................................", "...................................", "...................................", ".l.l.l.l.l.l.l.l...l.l.l.l.l.l.l.l."], { l: "#ffe7a8" }), 16);
			if (E.late()) { yield; }
			spr.bikes = [];
			[[229, 72, 63], [61, 143, 224], [250, 204, 60], [240, 240, 244]].forEach(function (c) { spr.bikes.push(rotSet(A, pixData(CITY_ART.bike, { k: "#22252e", j: css(c), f: "#f0c8a0" }), 16)); });
			if (E.late()) { yield; }
			spr.cone = rotSet(A, coneData(26, 6), 16);
			if (E.late()) { yield; }
			spr.tail = rotSet(A, pixData(["r..........", "...........", "...........", "...........", "...........", "r.........."], { r: "#ff3a2a" }), 16);
			if (E.late()) { yield; }
			spr.men = walkers(A, 10, acc);
			spr.brolly = [];
			[acc, [61, 143, 224], [250, 204, 60], [240, 240, 244], [47, 179, 122], [40, 44, 60]].forEach(function (c) { spr.brolly.push(A.add(K.bake(7, 7, function (g) { disc(g, 3, 3, 3, css(mul(c, 0.72))); disc(g, 3, 3, 2, css(c)); g.fillStyle = css(mx(c, [255, 255, 255], 0.5)); g.fillRect(2, 1, 2, 1); g.fillStyle = "#22252e"; g.fillRect(3, 3, 1, 1); }), 3, 5)); });
			spr.lamp = A.add(haloSprite(5, lamp), 5, 5);
			spr.sig = [A.add(haloSprite(3, [255, 70, 56]), 3, 3), A.add(haloSprite(3, [255, 196, 60]), 3, 3), A.add(haloSprite(3, [70, 230, 120]), 3, 3)];
			spr.streak = [];
			[[255, 70, 56], [255, 196, 60], [70, 230, 120], lamp, [255, 90, 190], [90, 220, 255]].forEach(function (c) { spr.streak.push(A.add(K.bake(3, 22, function (g) { var y; for (y = 0; y < 22; y += 2) { g.fillStyle = css(c, 0.7 * (1 - y / 22)); g.fillRect(y % 4 ? 1 : 0, y, y % 4 ? 1 : 3, 1); } }), 1, 0)); });
			spr.ring = [A.add(pix([".ww.", "w..w", ".ww."], { w: "rgba(220,236,250,0.7)" }), 2, 1), A.add(pix(["..ww..", ".w..w.", "w....w", ".w..w.", "..ww.."], { w: "rgba(220,236,250,0.4)" }), 3, 2)];
			spr.ring[0].soft = spr.ring[1].soft = true;
			spr.duck = A.add(pix([".o", "ww"], { o: "#f0a030", w: "#fbfbf4" }), 1);
			spr.jet = [A.add(pix([".w.", "www", ".w."], { w: "#e8f6ff" }), 1, 1), A.add(pix(["w.w", ".w.", "w.w"], { w: "#e8f6ff" }), 1, 1)];
		})();

		// ---- the ground: roads, pavements, the four corners
		world.layers.ground = yield* bakeSteps(W, H, function* (g) {
			var img = g.createImageData(W, H), d = img.data, x, y, p, q, c, k, n, t, inNS, inEW, pav, wx, list, w, h, bw, col;
			var ASP = [[70, 74, 86], [62, 66, 78]], PAVE = [[190, 186, 176], [176, 172, 164]], GRASS = [[132, 188, 104], [112, 170, 96], [94, 152, 90]];
			for (y = 0; y < H; y++) {
				if (E.late()) { yield; }
				for (x = 0; x < W; x++) {
					p = (y * W + x) * 4; q = BAYER[(y & 3) * 4 + (x & 3)] / 16;
					inNS = x >= bx0 && x < bx1; inEW = y >= by0 && y < by1;
					pav = (x >= bx0 - PAV && x < bx1 + PAV) || (y >= by0 - PAV && y < by1 + PAV);
					if (inNS || inEW) { c = ASP[vn(x / 5, y / 5, 3) + q * 0.3 > 0.62 ? 1 : 0]; if (inEW && !inNS && Math.abs(y - cy) < 9) { c = [80, 82, 92]; } }
					else if (pav) { c = PAVE[((x >> 2) + (y >> 2)) & 1]; if ((x & 3) === 0 || (y & 3) === 0) { c = [168, 164, 156]; } }
					else if (x >= park.x0 - 6 && y >= park.y0 - 6) { n = fbm(x / 40, y / 40, 9, 2) * 2.4 + (vn(x / 2.4, y / 2.4, 4) - 0.5) * 0.8; c = GRASS[clamp(Math.floor(n + q * 0.8), 0, 2)]; }
					else { c = vn(x / 6, y / 6, 14) > 0.6 ? [136, 138, 146] : [146, 148, 154]; if ((x % 12) === 0 || (y % 12) === 0) { c = [130, 132, 140]; } }
					d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
				}
			}
			g.putImageData(img, 0, 0);
			// kerbs
			g.fillStyle = "#d6d2c6";
			g.fillRect(0, by0 - 1, bx0, 1); g.fillRect(bx1, by0 - 1, W - bx1, 1); g.fillRect(0, by1, bx0, 1); g.fillRect(bx1, by1, W - bx1, 1);
			g.fillRect(bx0 - 1, 0, 1, by0); g.fillRect(bx0 - 1, by1, 1, H - by1); g.fillRect(bx1, 0, 1, by0); g.fillRect(bx1, by1, 1, H - by1);
			// tram rails down the middle of the wide road, cycle lanes at the edges, lane lines, stop lines, zebra crossings
			for (k = -1; k <= 1; k += 2) { box(g, 0, cy + k * 4 - 2, W, 1, "#a9adb8"); box(g, 0, cy + k * 4 + 1, W, 1, "#a9adb8"); }
						g.fillStyle = "rgba(196,96,74,0.5)";
			g.fillRect(0, by0, bx0 - 14, 5); g.fillRect(bx1 + 14, by0, W - bx1 - 14, 5); g.fillRect(0, by1 - 5, bx0 - 14, 5); g.fillRect(bx1 + 14, by1 - 5, W - bx1 - 14, 5);
			g.fillRect(bx0, 0, 5, by0 - 14); g.fillRect(bx1 - 5, 0, 5, by0 - 14); g.fillRect(bx0, by1 + 14, 5, H - by1 - 14); g.fillRect(bx1 - 5, by1 + 14, 5, H - by1 - 14);
			g.fillStyle = "#e9e6da";
			for (y = 2; y < H; y += 9) { if (y < by0 - 14 || y > by1 + 12) { g.fillRect(cx, y, 1, 4); } }
			for (x = 2; x < W; x += 9) { if (x < bx0 - 14 || x > bx1 + 12) { g.fillRect(x, cy - 9, 4, 1); g.fillRect(x, cy + 9, 4, 1); } }
			g.fillRect(bx0, by0 - 12, cx - bx0, 1); g.fillRect(cx, by1 + 11, bx1 - cx, 1); g.fillRect(bx1 + 11, by0, 1, cy - 9 - by0); g.fillRect(bx0 - 12, cy + 9, 1, by1 - cy - 9);
			for (x = bx0 + 1; x < bx1 - 1; x += 4) { g.fillRect(x, by0 - 9, 2, 7); g.fillRect(x, by1 + 2, 2, 7); }
			for (y = by0 + 1; y < by1 - 1; y += 4) { g.fillRect(bx0 - 9, y, 7, 2); g.fillRect(bx1 + 2, y, 7, 2); }
			// the box itself: yellow hatching, so nobody waits in it
			g.fillStyle = "rgba(240,200,70,0.42)";
			for (k = -60; k < 60; k += 6) { for (t = 0; t < 44; t++) { x = bx0 + k + t; y = by0 + t; if (x >= bx0 + 1 && x < bx1 - 1 && Math.abs(y - cy) > 9) { g.fillRect(x, y, 1, 1); } } }
			// bus stops: a marked bay in the lane and a glass shelter on the pavement beside it
			for (k = 0; k < 2; k++) {
				x = k ? cx + 1 : cx - 9; y = k ? by1 + 11 + 74 - 12 : by0 - 11 - 74 - 12; n = k ? bx1 + 2 : bx0 - 7;
				if (y > 4 && y + 24 < H - 4) {
					g.fillStyle = "#e8c84a"; g.fillRect(x, y, 8, 1); g.fillRect(x, y + 23, 8, 1); for (t = y + 2; t < y + 22; t += 4) { g.fillRect(k ? x + 7 : x, t, 1, 2); }
					box(g, n + 1, y + 6, 5, 13, "rgba(20,24,40,0.3)"); box(g, n, y + 5, 5, 13, "#7fa6cc"); box(g, n, y + 5, 5, 1, "#cfe2f4"); box(g, n, y + 5, 1, 13, "#b4d0ea"); box(g, n + 2, y + 8, 1, 7, "#5a7ea4");
				}
			}
			// drains and manholes
			for (k = 0; k < 10; k++) { x = Math.round(R() * W); y = cy + (R() < 0.5 ? -15 : 15); if (Math.abs(x - cx) > 40) { disc(g, x, y, 2, "#565a68"); box(g, x - 1, y, 3, 1, "#3e424e"); } }
			// ---- north side: shops and offices facing the street, yards and smaller roofs behind
			var ROOF = [[168, 172, 182], [150, 132, 122], [186, 176, 158], [124, 136, 156], [176, 150, 130], [142, 150, 150]], WALL = [[214, 150, 110], [226, 214, 190], [176, 110, 96], [200, 204, 210], [222, 186, 130], [150, 166, 190]], AWN = [acc, [61, 143, 224], [47, 179, 122], [250, 204, 60], [240, 240, 244], [155, 89, 208]];
			function tower(x0, y0, bw2, bd, wh, shop) {
				var rc = ROOF[Math.floor(R() * 6)], wc = WALL[Math.floor(R() * 6)], aw = AWN[Math.floor(R() * 6)], xx, m;
				g.fillStyle = "rgba(20,24,40,0.34)"; g.fillRect(x0 + 4, y0 + 5, bw2, bd + wh + 1);
				box(g, x0, y0, bw2, bd, css(rc)); box(g, x0, y0, bw2, 1, css(mx(rc, [255, 255, 255], 0.45))); box(g, x0, y0, 1, bd, css(mx(rc, [255, 255, 255], 0.3))); box(g, x0 + bw2 - 1, y0, 1, bd, css(mul(rc, 0.72))); box(g, x0 + 1, y0 + bd - 1, bw2 - 1, 1, css(mul(rc, 0.72)));
				box(g, x0 + 2, y0 + 2, bw2 - 4, bd - 4, css(mul(rc, 0.9)));
				// things on the roof
				for (m = 0; m < Math.floor(bw2 * bd / 260) + 1; m++) {
					xx = x0 + 4 + Math.floor(R() * Math.max(1, bw2 - 14)); t = y0 + 4 + Math.floor(R() * Math.max(1, bd - 12)); n = R();
					if (n < 0.3) { box(g, xx + 1, t + 1, 6, 5, "rgba(20,24,40,0.3)"); box(g, xx, t, 6, 5, "#c2c8d2"); box(g, xx, t, 6, 1, "#eef0f4"); box(g, xx + 1, t + 2, 4, 1, "#8a93a6"); }
					else if (n < 0.52) { box(g, xx, t, 7, 4, "#3d6ea8"); box(g, xx, t, 7, 1, "#8cc0ee"); box(g, xx + 3, t, 1, 4, "#27466e"); }
					else if (n < 0.7) { box(g, xx, t, 8, 5, "#5a9a5c"); box(g, xx + 1, t + 1, 2, 2, "#8fd070"); box(g, xx + 5, t + 2, 2, 2, "#e87a9a"); box(g, xx, t + 5, 8, 1, "#7a5a40"); }
					else if (n < 0.86) { disc(g, xx + 4, t + 3, 3, "rgba(20,24,40,0.3)"); disc(g, xx + 3, t + 2, 3, "#8a6a4a"); disc(g, xx + 3, t + 2, 2, "#a8845c"); }
					else { box(g, xx, t, 9, 5, "#27304a"); for (k = 0; k < 9; k += 3) { box(g, xx + k, t, 1, 5, "#4a5a84"); } box(g, xx, t + 2, 9, 1, "#4a5a84"); }
				}
				// the wall we can see, with a shop on the ground if it faces the street
				box(g, x0, y0 + bd, bw2, wh, css(wc)); box(g, x0, y0 + bd, bw2, 1, css(mul(wc, 0.6))); box(g, x0 + bw2 - 1, y0 + bd, 1, wh, css(mul(wc, 0.78)));
				if (shop) {
					for (xx = x0 + 2; xx + 5 < x0 + bw2 - 1; xx += 7) { box(g, xx, y0 + bd + wh - 5, 5, 4, "#27304a"); box(g, xx, y0 + bd + wh - 5, 5, 1, "#5a7aa8"); lg.fillStyle = css(mx(lamp, [255, 255, 255], R() * 0.3), 0.95); lg.fillRect(xx, y0 + bd + wh - 5, 5, 4); }
					for (xx = 0; xx < bw2; xx += 4) { box(g, x0 + xx, y0 + bd + wh - 8, 2, 3, css(aw)); box(g, x0 + xx + 2, y0 + bd + wh - 8, 2, 3, "#f4f0e4"); }
					box(g, x0, y0 + bd + wh - 5, bw2, 1, "rgba(20,24,40,0.35)");
					m = Math.floor(R() * 3); neon.push([x0 + 3 + Math.floor(R() * Math.max(1, bw2 - 16)), y0 + bd + 1, 9, 2, m, R() * 9]);
					lg.drawImage(glowSprite(Math.max(8, bw2 >> 1), 7, lamp, 0.5), x0, y0 + bd + wh - 4);
				} else { for (xx = x0 + 2; xx + 2 < x0 + bw2 - 1; xx += 5) { box(g, xx, y0 + bd + 2, 2, 2, "#27304a"); if (R() < 0.6) { lg.fillStyle = css(lamp, 0.9); lg.fillRect(xx, y0 + bd + 2, 2, 2); } } }
			}
			function row(x0, x1, yb, front, deep) {
				var xx = x0, bw2, bd, wh;
				while (xx < x1 - 18) {
					bw2 = Math.min(x1 - xx, 26 + Math.floor(R() * 34)); if (x1 - xx - bw2 < 20) { bw2 = x1 - xx; }
					bd = deep[0] + Math.floor(R() * (deep[1] - deep[0])); wh = front ? 12 : 6 + Math.floor(R() * 4);
					tower(xx, yb - bd - wh, bw2 - 3, bd, wh, front); xx += bw2;
				}
			}
			// back rows first, so the front rows overlap them
			y = by0 - PAV - 1;
			for (w = y - 62 - Math.floor((y - 62) / 58) * 58; w <= y - 62; w += 58) { if (E.late()) { yield; } row(4, bx0 - PAV - 3, w, false, [24, 38]); row(bx1 + PAV + 4, W - 3, w, false, [24, 38]); }
			if (E.late()) { yield; }
			row(3, bx0 - PAV - 2, y, true, [26, 40]);
			if (E.late()) { yield; }
			row(bx1 + PAV + 3, W - 2, y, true, [26, 40]);
			if (E.late()) { yield; }
			world.cafe = [bx1 + PAV + 6, y];
			// ---- south-west: a car park by the road, a ball court, flats behind
			x = 5; y = by1 + PAV + 5; w = bx0 - PAV - 9; h = Math.min(H - y - 4, tall ? 64 : 44);
			box(g, x, y, w, h, "#8a8d98"); box(g, x, y, w, 1, "#b4b7c0");
			for (k = x + 3; k < x + w - 8; k += 9) { box(g, k, y + 2, 1, 14, "#e9e6da"); box(g, k, y + h - 16, 1, 14, "#e9e6da"); if (R() < 0.66) { col = [[229, 72, 63], [61, 143, 224], [240, 240, 244], [70, 76, 96], [250, 204, 60]][Math.floor(R() * 5)]; box(g, k + 3, y + 4, 5, 11, "rgba(20,24,40,0.3)"); box(g, k + 2, y + 3, 5, 11, css(mul(col, 0.74))); box(g, k + 3, y + 4, 3, 9, css(col)); box(g, k + 3, y + 5, 3, 2, "#27304a"); box(g, k + 3, y + 11, 3, 1, "#27304a"); } if (R() < 0.5) { col = [[47, 179, 122], [200, 206, 216], [155, 89, 208]][Math.floor(R() * 3)]; box(g, k + 3, y + h - 14, 5, 11, "rgba(20,24,40,0.3)"); box(g, k + 2, y + h - 15, 5, 11, css(mul(col, 0.74))); box(g, k + 3, y + h - 14, 3, 9, css(col)); box(g, k + 3, y + h - 8, 3, 2, "#27304a"); } }
			y += h + 5;
			if (H - y > 40) {
				n = Math.min(60, Math.round(w * 0.36)); t = Math.min(34, H - y - 6);
				box(g, x, y, n, t, "#c8744a"); box(g, x + 1, y + 1, n - 2, t - 2, "#d88a5c"); g.fillStyle = "#f4f0e4"; g.fillRect(x + 2, y + 2, n - 4, 1); g.fillRect(x + 2, y + t - 3, n - 4, 1); g.fillRect(x + 2, y + 2, 1, t - 4); g.fillRect(x + n - 3, y + 2, 1, t - 4); g.fillRect(x + (n >> 1), y + 2, 1, t - 4);
				disc(g, x + (n >> 1), y + (t >> 1), 5, "#f4f0e4"); disc(g, x + (n >> 1), y + (t >> 1), 4, "#d88a5c");
				row(x + n + 6, bx0 - PAV - 3, H - 5, false, [26, Math.max(28, Math.min(46, H - y - 18))]);
			}
			// ---- south-east: the park. paths, a pond with a fountain, beds of flowers, benches, trees
			g.fillStyle = "#d9cba4";
			for (t = 0; t < 400; t++) { x = park.x0 + t; y = park.y0 + t * (park.y1 - park.y0) / (park.x1 - park.x0); if (x < park.x1) { g.fillRect(x, Math.round(y) - 2, 2, 5); } }
			for (t = 0; t < 400; t++) { x = park.x0 + t; y = park.y1 - t * (park.y1 - park.y0) / (park.x1 - park.x0) * 0.9; if (x < park.x1 && y > park.y0) { g.fillRect(x, Math.round(y) - 2, 2, 4); } }
			box(g, park.x0 - 6, park.y0 - 6, park.x1 - park.x0 + 12, 2, "#5a8a54"); box(g, park.x0 - 6, park.y0 - 6, 2, park.y1 - park.y0 + 12, "#5a8a54");
			ell(g, pond.x, pond.y, pond.rx + 3, pond.ry + 3, "#d9cba4"); ell(g, pond.x, pond.y, pond.rx + 1, pond.ry + 1, "#b8ac8c"); ell(g, pond.x, pond.y, pond.rx, pond.ry, "#4a96c8"); ell(g, pond.x - 2, pond.y - 2, pond.rx - 4, pond.ry - 4, "#6ab4dc"); disc(g, pond.x, pond.y, 3, "#c9ccd2"); disc(g, pond.x, pond.y, 1, "#f4f6fa");
			for (k = 0; k < (tall ? 5 : 6); k++) { x = Math.round(park.x0 + 14 + R() * (park.x1 - park.x0 - 30)); y = Math.round(park.y0 + 12 + R() * (park.y1 - park.y0 - 26)); if (dist(x, y, pond.x, pond.y) < pond.rx + 16) { continue; } ell(g, x, y, 8, 4, "#6a4a34"); for (n = 0; n < 16; n++) { box(g, x - 7 + Math.floor(R() * 14), y - 3 + Math.floor(R() * 6), 1, 1, n % 3 === 0 ? "#fff3c4" : n % 3 === 1 ? css(acc) : "#f08ab0"); } }
			for (k = 0; k < 6; k++) { t = k * TAU / 6 + 0.4; x = Math.round(pond.x + Math.cos(t) * (pond.rx + 9)); y = Math.round(pond.y + Math.sin(t) * (pond.ry + 8)); box(g, x - 2, y, 5, 2, "#8a5a3c"); box(g, x - 2, y, 5, 1, "#b0794a"); }
			for (k = 0; k < (tall ? 60 : 70); k++) { x = Math.round(park.x0 + R() * (park.x1 - park.x0)); y = Math.round(park.y0 + R() * (park.y1 - park.y0)); t = (x - park.x0) * (park.y1 - park.y0) / (park.x1 - park.x0); if (dist(x, y, pond.x, pond.y) < pond.rx + 12 || Math.abs(y - park.y0 - t) < 9 || Math.abs(y - (park.y1 - t * 0.9)) < 9) { continue; } treeTop(g, x, y, 4 + Math.floor(R() * 3), R() < 0.25); }
			// trees in the pavement, lamp posts at the corners and down the streets
			for (x = 20; x < W - 10; x += 34) { if (x < bx0 - 26 || x > bx1 + 26) { if (((x / 34) | 0) % 2) { treeTop(g, x, by0 - 5, 3, false); } else { lampsXY.push([x, by1 + 5]); } } }
			for (y = 16; y < H - 8; y += 38) { if (y < by0 - 26 || y > by1 + 26) { lampsXY.push([bx0 - 5, y]); treeTop(g, bx1 + 5, y + 14 < H ? y + 14 : y, 3, false); } }
			for (k = 0; k < 4; k++) { lampsXY.push([corners[k][0] + (k === 0 || k === 3 ? -3 : 3), corners[k][1] + (k < 2 ? -3 : 3)]); }
			for (k = 0; k < lampsXY.length; k++) { box(g, lampsXY[k][0], lampsXY[k][1], 2, 2, "#30343f"); box(g, lampsXY[k][0], lampsXY[k][1], 1, 1, "#e8e2c8"); }
			// a cafe terrace on the north-east corner
			x = world.cafe[0]; y = world.cafe[1] + 2;
			for (k = 0; k < 3; k++) { n = [[240, 240, 244], acc, [250, 204, 60]][k]; disc(g, x + 6 + k * 13, y + 3, 4, "rgba(20,24,40,0.3)"); disc(g, x + 5 + k * 13, y + 2, 4, css(mul(n, 0.76))); disc(g, x + 5 + k * 13, y + 2, 3, css(n)); box(g, x + 5 + k * 13, y + 2, 1, 1, "#30343f"); }
		});
		// what shows when the road is wet: a sheen along the lanes
		world.layers.wet = yield* bakeSteps(W, H, function* (g) {
			var x, y;
			for (y = 0; y < H; y++) { if (E.late()) { yield; } for (x = 0; x < W; x++) { if (((x >= bx0 && x < bx1) || (y >= by0 && y < by1)) && vn(x / 9, y / 3.2, 23) > 0.6 + BAYER[(y & 3) * 4 + (x & 3)] / 50) { g.fillStyle = "rgba(170,196,226,0.3)"; g.fillRect(x, y, 1, 1); } } }
		});
		// street lamp pools, the signal heads
		yield* (function* () {
			var k, pool = glowSprite(15, 11, lamp, 0.5);
			for (k = 0; k < lampsXY.length; k++) { lg.drawImage(pool, lampsXY[k][0] - 14, lampsXY[k][1] - 10); }
			heads = [[bx0 - 3, by0 - 12, 0], [bx1 + 11, by0 - 3, 1], [bx1 + 2, by1 + 11, 2], [bx0 - 12, by1 + 2, 3]];
		})();

		// ---- vehicles
		var vehicles = [], NCAR = E.count(15, 6, 28), spawnT = [0.5, 1.5, 2.5, 3.5];
		function make(kind) { return { on: false, kind: kind, R: null, s: 0, v: 0, x: -99, y: -99, a: 0, len: 11, vmax: 26, look: 0, wait: 0, dwell: 0, served: false, stuck: 0, lat: 5.5 }; }
		for (i = 0; i < NCAR; i++) { vehicles.push(make("car")); }
		for (i = 0; i < 2; i++) { j = make("bus"); j.len = 24; j.vmax = 21; j.wait = 4 + i * 16; j.R = routes[i * 4]; vehicles.push(j); }
		for (i = 0; i < 2; i++) { j = make("tram"); j.len = 35; j.vmax = 20; j.wait = 2 + i * 14; j.R = tramRoutes[i]; j.lat = 3.5; vehicles.push(j); }
		for (i = 0; i < E.count(5, 2, 9); i++) { j = make("bike"); j.len = 6; j.vmax = 11 + rnd() * 4; j.wait = rnd() * 20; j.lat = 2.6; vehicles.push(j); }
		function green(arm) { return (phase === 0 && (arm === 0 || arm === 2)) || (phase === 3 && (arm === 1 || arm === 3)); }
		function amber(arm) { return (phase === 1 && (arm === 0 || arm === 2)) || (phase === 4 && (arm === 1 || arm === 3)); }
		function clearAt(P, s, me) {
			var k, u, x = pathX(P, s), y = pathY(P, s);
			for (k = 0; k < vehicles.length; k++) { u = vehicles[k]; if (u.on && u !== me && dist(u.x, u.y, x, y) < u.len * 0.5 + 16) { return false; } }
			return true;
		}
		function launch(v, route) {
			if (!clearAt(route.P, v.len, v)) { return false; }
			v.on = true; v.R = route; v.s = 0; v.v = v.vmax * 0.8; v.served = false; v.dwell = 0; v.stuck = 0; v.x = pathX(route.P, 0); v.y = pathY(route.P, 0);
			return true;
		}
		function stepVehicle(v, dt) {
			var P, lim, d, k, u, hx, hy, ax, ay, f;
			if (!v.on) {
				if (v.kind === "car") { return; }
				v.wait -= dt;
				if (v.wait <= 0) { if (v.kind === "bike") { launch(v, bikeRoutes[Math.floor(rnd() * 4)]); v.look = Math.floor(rnd() * 4); } else { launch(v, v.R); } if (!v.on) { v.wait = 2; } }
				return;
			}
			P = v.R.P; lim = v.vmax; d = v.R.stopS - v.s - v.len / 2 - 1;
			// the light, and the rule about the box
			if (d > -1 && !(green(v.R.from) && !blocked[v.R.exit]) && !(amber(v.R.from) && d < 5)) { lim = Math.min(lim, Math.max(0, d * 2.6)); }
			if (v.kind === "bus" && !v.served) { d = v.R.stopS - 74 - v.s; if (d < 0.8) { v.served = true; v.dwell = 5 + rnd() * 3; } else if (d < 60) { lim = Math.min(lim, d * 1.8 + 1); } }
			if (v.dwell > 0) { v.dwell -= dt; lim = 0; }
			// whatever is in front
			hx = Math.cos(v.a); hy = Math.sin(v.a);
			if (v.stuck < 30) {
				for (k = 0; k < vehicles.length; k++) {
					u = vehicles[k]; if (!u.on || u === v) { continue; }
					ax = u.x - v.x; ay = u.y - v.y; d = ax * hx + ay * hy;
					if (d <= 0 || d > 46) { continue; }
					f = Math.abs(-ax * hy + ay * hx);
					if (f < Math.max(v.lat, u.kind === "bike" && v.kind !== "bike" ? 0 : Math.min(v.lat, u.lat))) { lim = Math.min(lim, Math.max(0, (d - (v.len + u.len) / 2 - 3) * 2.6)); }
				}
			}
			v.v += clamp(lim - v.v, -70 * dt, 20 * dt);
			if (v.v < 0.4 && v.dwell <= 0 && lim > 0.4) { v.v = Math.min(lim, 0.6); }
			v.stuck = v.v < 0.5 && v.dwell <= 0 && v.s > v.R.stopS ? v.stuck + dt : (v.stuck > 30 && v.stuck < 34 ? v.stuck + dt : 0);
			v.s += v.v * dt;
			if (v.s >= P.len) { v.on = false; v.x = -99; v.wait = v.kind === "bus" ? 18 + rnd() * 26 : v.kind === "tram" ? 12 + rnd() * 18 : 4 + rnd() * 18; return; }
			v.x = pathX(P, v.s); v.y = pathY(P, v.s); v.a = pathA(P, v.s);
		}
		// ---- people on foot
		var peds = [], NPED = E.count(26, 10, 44), walkers2 = [];
		function startPed(p, fresh) {
			var c = Math.floor(rnd() * 4), e = Math.floor(rnd() * 2), q = ends[c][e], f = fresh ? rnd() : 0;
			p.c0 = c; p.e0 = e; p.x = q[0] + (corners[c][0] - q[0]) * f * 0.8 + (rnd() - 0.5) * 4; p.y = q[1] + (corners[c][1] - q[1]) * f * 0.8 + (rnd() - 0.5) * 4;
			p.tx = corners[c][0] + (rnd() - 0.5) * 6; p.ty = corners[c][1] + (rnd() - 0.5) * 6; p.st = 0; p.sp = 9 + rnd() * 5; p.look = Math.floor(rnd() * 10);
			// most cross to another corner; some just turn the corner
			if (rnd() < 0.72) { p.c1 = (c + (rnd() < 0.3 ? 2 : rnd() < 0.5 ? 1 : 3)) % 4; } else { p.c1 = c; }
		}
		for (i = 0; i < NPED; i++) { j = { st: 0, x: 0, y: 0, tx: 0, ty: 0, c0: 0, c1: 0, e0: 0, sp: 10, look: 0, t: rnd() * 9, wait: 0 }; startPed(j, true); peds.push(j); }
		for (i = 0; i < 5; i++) { walkers2.push({ a: rnd() * TAU, r: 1.25 + rnd() * 0.5, v: (0.07 + rnd() * 0.07) * (i % 2 ? 1 : -1), look: (i * 3) % 10 }); }
		function stepPed(p, dt) {
			var d, q;
			if (p.wait > 0) { p.wait -= dt; return; }
			if (p.st === 1) {
				// at the kerb: go when the walk light is on and there is time to get over
				if (phase === 6 && phT < 4.5 && p.c1 !== p.c0) { p.st = 2; p.tx = corners[p.c1][0] + (rnd() - 0.5) * 6; p.ty = corners[p.c1][1] + (rnd() - 0.5) * 6; p.sp = 12 + rnd() * 4; }
				return;
			}
			d = dist(p.x, p.y, p.tx, p.ty);
			if (d <= p.sp * dt) {
				p.x = p.tx; p.y = p.ty;
				if (p.st === 0 && p.c1 !== p.c0) { p.st = 1; }
				else if (p.st === 0 || p.st === 2) { q = ends[p.c1][p.c1 === p.c0 ? 1 - p.e0 : Math.floor(rnd() * 2)]; p.st = 3; p.tx = q[0]; p.ty = q[1]; p.sp = 9 + rnd() * 5; }
				else { p.wait = 1 + rnd() * 6; startPed(p, false); }
				return;
			}
			p.x += (p.tx - p.x) / d * p.sp * dt; p.y += (p.ty - p.y) / d * p.sp * dt; p.t += dt * 5;
		}
		world.warm = [lights];
		world.step = function (dt, X) {
			var k, v, n, r, tries;
			phT += dt; if (phT >= LEN[phase]) { phT = 0; phase = (phase + 1) % 8; }
			// is the road just beyond the box moving? (one flag per way out)
			blocked[0] = blocked[1] = blocked[2] = blocked[3] = false;
			for (k = 0; k < vehicles.length; k++) {
				v = vehicles[k]; if (!v.on || v.v > 4 || v.kind === "bike") { continue; }
				if (v.y < by0 && v.y > by0 - 34 && Math.abs(v.x - cx - 5) < 5) { blocked[0] = true; } if (v.y > by1 && v.y < by1 + 34 && Math.abs(v.x - cx + 5) < 5) { blocked[2] = true; }
				if (v.x > bx1 && v.x < bx1 + 34 && v.y > cy) { blocked[1] = true; } if (v.x < bx0 && v.x > bx0 - 34 && v.y < cy) { blocked[3] = true; }
			}
			for (k = 0; k < vehicles.length; k++) { stepVehicle(vehicles[k], dt); }
			// new cars arrive at each of the four ways in
			for (n = 0; n < 4; n++) {
				spawnT[n] -= dt;
				if (spawnT[n] > 0) { continue; }
				spawnT[n] = 1.6 + rnd() * 4.5;
				for (k = 0; k < NCAR; k++) { v = vehicles[k]; if (!v.on) { r = routes[n * 2 + (rnd() < 0.36 ? 1 : 0)]; tries = rnd(); v.van = tries < 0.14; v.len = v.van ? 13 : 11; v.vmax = 22 + rnd() * 7; v.look = Math.floor(rnd() * (v.van ? 2 : 8)); launch(v, r); break; } }
			}
			for (k = 0; k < peds.length; k++) { stepPed(peds[k], dt); }
			for (k = 0; k < walkers2.length; k++) { walkers2[k].a += walkers2[k].v * dt; }
			world.rain = X.rain;
		};
		function lampCol(arm) { return green(arm) ? 2 : amber(arm) ? 1 : 0; }
		world.draw = function (Dr) {
			var g = Dr.g, t = Dr.t, lit = Dr.lit, rain = Dr.rain, wet = rain * (0.35 + 0.65 * lit), k, v, s, a, m, x, y, n, c, walk = phase === 6 || (phase === 7 && (Math.floor(t * 4) & 1));
			Dr.layer("ground");
			if (rain > 0.03) { Dr.layer("wet", 0, 0, Math.min(1, rain * 1.2)); }
			// the fountain and the ducks
			Dr.spr(spr.jet[Math.floor(t * 6) & 1], pond.x, pond.y); Dr.spr(spr.ring[Math.floor(t * 2) & 1], pond.x, pond.y);
			for (k = 0; k < 3; k++) { Dr.spr(spr.duck, pond.x + Math.cos(t * 0.2 + k * 2.1) * pond.rx * 0.62, pond.y + Math.sin(t * 0.2 + k * 2.1) * pond.ry * 0.62); }
			if (lit > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = lit; g.drawImage(lights, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
			// rain rings on the road, and every light smeared down the wet tarmac
			if (rain > 0.1) { for (k = 0; k < 26; k++) { n = Math.floor(t * 3 + k * 0.37); x = ((k * 131 + n * 197) % W); y = (k % 2) ? by0 + ((k * 53 + n * 71) % (by1 - by0)) : ((k * 89 + n * 113) % H); if (k % 2 === 0) { x = bx0 + ((k * 31 + n * 57) % (bx1 - bx0)); } Dr.spr(spr.ring[(t * 3 + k * 0.37) % 1 > 0.5 ? 1 : 0], x, y); } }
			if (wet > 0.05) {
				for (k = 0; k < 4; k++) { Dr.raw(spr.streak[lampCol(heads[k][2])], heads[k][0], heads[k][1] + 2, wet); }
				for (k = 0; k < lampsXY.length; k += 2) { Dr.raw(spr.streak[3], lampsXY[k][0] + Math.round(Math.sin(t * 1.5 + k)), lampsXY[k][1] + 3, wet * lit * 0.8); }
				for (k = 0; k < neon.length; k++) { n = neon[k]; if (n[1] + 14 > by0 - PAV - 6) { Dr.raw(spr.streak[n[4] === 0 ? 4 : n[4] === 1 ? 5 : 1], n[0] + 4, n[1] + 13, wet * lit * 0.9); } }
			}
			// shadows, vehicles, their lamps
			g.fillStyle = "rgba(14,18,34,0.32)";
			for (k = 0; k < vehicles.length; k++) { v = vehicles[k]; if (v.on) { if (Math.abs(Math.cos(v.a)) > 0.7) { g.fillRect(Math.round(v.x - v.len / 2) + 2, Math.round(v.y) - 1, v.len, v.kind === "bike" ? 2 : 6); } else { g.fillRect(Math.round(v.x) - 1, Math.round(v.y - v.len / 2) + 2, v.kind === "bike" ? 2 : 6, v.len); } } }
			for (k = 0; k < vehicles.length; k++) {
				v = vehicles[k]; if (!v.on) { continue; }
				a = turnIndex(v.a, 16);
				s = v.kind === "car" ? (v.van ? spr.vans[v.look % 2] : spr.cars[v.look % 8]) : v.kind === "bus" ? spr.bus : v.kind === "tram" ? spr.tram : spr.bikes[v.look % 4];
				Dr.spr(s[a], v.x, v.y);
				if (lit > 0.25 && v.kind !== "bike") {
					Dr.glow(spr.cone[a], v.x + Math.cos(v.a) * (v.len / 2 + 12), v.y + Math.sin(v.a) * (v.len / 2 + 12), lit * 0.5);
					if (v.kind === "tram") { Dr.raw(spr.tramLit[a], v.x, v.y, lit); } else if (v.kind === "car") { Dr.raw(spr.tail[a], v.x, v.y, lit); }
					if (wet > 0.2) { Dr.raw(spr.streak[3], v.x + Math.cos(v.a) * (v.len / 2 + 3), v.y + Math.sin(v.a) * (v.len / 2 + 3) + 1, wet * 0.55); }
				}
			}
			// people: walking, waiting at the kerb, or under an umbrella
			for (k = 0; k < peds.length; k++) {
				m = peds[k]; if (m.wait > 0) { continue; }
				if (rain > 0.3) { Dr.spr(spr.brolly[m.look % 6], m.x, m.y); } else { Dr.spr(spr.men[m.look][m.st === 1 ? 0 : (Math.floor(m.t) & 1)], m.x, m.y + 2); }
			}
			for (k = 0; k < walkers2.length; k++) { m = walkers2[k]; x = pond.x + Math.cos(m.a) * pond.rx * m.r; y = pond.y + Math.sin(m.a) * pond.ry * m.r; if (x > park.x0 && x < park.x1 && y > park.y0 && y < park.y1) { if (rain > 0.3) { Dr.spr(spr.brolly[m.look % 6], x, y); } else { Dr.spr(spr.men[m.look][Math.floor(t * 3 + k) & 1], x, y + 2); } } }
			// signal heads: three lamps each, the lit one glowing; a walk lamp on every corner
			for (k = 0; k < 4; k++) {
				x = heads[k][0]; y = heads[k][1]; c = lampCol(heads[k][2]);
				g.fillStyle = Dr.shade([34, 38, 50]); g.fillRect(x - 1, y - 1, k % 2 ? 7 : 3, k % 2 ? 3 : 7);
				g.fillStyle = c === 0 ? "#ff4638" : "#5a2a2a"; g.fillRect(x, y, 1, 1); g.fillStyle = c === 1 ? "#ffc43c" : "#5a4a2a"; g.fillRect(x + (k % 2 ? 2 : 0), y + (k % 2 ? 0 : 2), 1, 1); g.fillStyle = c === 2 ? "#46e678" : "#2a4a34"; g.fillRect(x + (k % 2 ? 4 : 0), y + (k % 2 ? 0 : 4), 1, 1);
				Dr.raw(spr.sig[c], x + (k % 2 ? c * 2 : 0), y + (k % 2 ? 0 : c * 2), 0.4 + lit * 0.6);
				g.fillStyle = walk ? "#46e678" : "#ff4638"; g.fillRect(corners[k][0] + (k === 0 || k === 3 ? 3 : -4), corners[k][1] + (k < 2 ? 3 : -4), 2, 2);
			}
			// neon over the shop doors, lamp heads
			if (lit > 0.1) {
				for (k = 0; k < neon.length; k++) { n = neon[k]; if (Math.sin(t * (0.5 + (k % 3) * 0.3) + n[5]) > -0.72) { g.globalAlpha = lit; g.fillStyle = n[4] === 0 ? "#ff5abe" : n[4] === 1 ? "#5adcff" : "#ffc43c"; g.fillRect(n[0], n[1], n[2], n[3]); g.fillStyle = "#ffffff"; g.fillRect(n[0] + 1, n[1], n[2] - 2, 1); g.globalAlpha = 1; } }
				for (k = 0; k < lampsXY.length; k++) { Dr.raw(spr.lamp, lampsXY[k][0] + 1, lampsXY[k][1] + 1, lit); }
			}
		};
		function onRoad(v) { return v.on; }
		world.shots = function (push) {
			var k, v, n = 0;
			for (k = 0; k < peds.length; k++) { if (peds[k].st === 1 || peds[k].st === 2) { n++; } }
			push("box", cx, cy, 1.67, phase >= 6 ? 4 : 2.2 + n * 0.08, null, 12);
			for (k = 0; k < vehicles.length; k++) { v = vehicles[k]; if (v.on && v.kind === "tram" && v.x > 50 && v.x < W - 50 && v.v > 3) { push("tram", 0, 0, 1.67, 2.6, v, 11, onRoad); break; } }
			for (k = 0; k < vehicles.length; k++) { v = vehicles[k]; if (v.on && v.kind === "bus" && v.y > 30 && v.y < H - 30) { push("bus", 0, 0, 1.67, 2, v, 11, onRoad); break; } }
			push("park", pond.x, pond.y, 2, 1.4, null, 10);
			push("shops", cx - (tall ? 70 : 120), by0 - 34, 2, 1.5, null, 10);
			push("cafe", cx + (tall ? 70 : 120), by0 - 30, 2, 1.1, null, 9);
		};
		return world;
	}
	addWorld("junction", {
		label: "city junction", colors: ["8fc7ee", "e5483f", "ffd98a"],
		sky: { day: [[70, 142, 214], [128, 190, 234], [206, 232, 244]], dusk: [[60, 54, 122], [214, 110, 112], [255, 190, 120]], night: [[6, 10, 34], [14, 24, 60], [30, 46, 92]], dawn: [[96, 118, 184], [232, 168, 170], [255, 220, 186]] },
		tint: { night: [0.3, 0.36, 0.62], dusk: [0.98, 0.76, 0.68] },
		build: junctionBuild
	});

	// ================================================================ the template
	var NAMES = { skihill: "Ski hill", harbor: "Working harbour", railway: "Model railway", antfarm: "Ant farm", junction: "City junction" };
	SSO.register({
		id: "tinyworld",
		name: "Tiny living worlds",
		category: "worlds",
		description: "Little pixel-art places that run themselves while you are away: skiers riding the lift and carving down, boats unloading at a quay, trains keeping to their signals, ants digging a nest, a junction full of traffic. The day passes, the weather turns and the camera wanders to whatever is happening. A background for a starting soon, break or ending scene.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "world", label: "Which world", type: "select", group: "World", default: ORDER[0], options: ORDER.map(function (id) { return [id, NAMES[id] || id]; }) },
			{ key: "time", label: "Time of day", type: "select", group: "World", default: "cycle", options: [["cycle", "A full day that slowly passes"], ["day", "Always day"], ["dusk", "Always dusk"], ["night", "Always night"]] },
			{ key: "weather", label: "Weather", type: "select", group: "World", default: "", options: [["", "Comes and goes"], ["clear", "Always clear"], ["rain", "Rain (snow on the ski hill)"], ["fog", "Fog"]] },
			{ key: "busy", label: "How busy it is", type: "range", group: "World", default: 1, min: 0.4, max: 2, step: 0.1 },
			{ key: "camera", label: "Camera", type: "select", group: "Camera", default: "follow", options: [["follow", "Follows the action"], ["wide", "One wide shot"], ["drift", "Slow drift"]] },
			{ key: "speed", label: "How fast everything moves and the day passes", type: "range", group: "World", default: 1, min: 0.3, max: 3, step: 0.1 },
			{ key: "sharp", label: "Picture sharpness (lower = chunkier pixels and a closer view)", type: "range", group: "Camera", default: 1, min: 0.5, max: 1, step: 0.05, help: "At 1 the wide shot shows the whole world. These worlds are light on the computer at any setting." },
			{ key: "c1", label: "Sky colour (blank = automatic)", type: "color", group: "Colours", default: "", help: "The railway and the junction are seen from above, so they show no sky." },
			{ key: "c2", label: "Accent colour: jackets, roofs, paintwork (blank = automatic)", type: "color", group: "Colours", default: "" },
			{ key: "c3", label: "Lamp and window light; the fireflies in the ant farm (blank = automatic)", type: "color", group: "Colours", default: "" }
		],
		presets: [
			{ name: "Ski hill, following the skiers", tags: ["winter", "cozy", "retro", "cute"], values: { world: "skihill" } },
			{ name: "Ski hill, the whole mountain by day", tags: ["winter", "retro", "simple"], values: { world: "skihill", time: "day", weather: "clear", camera: "wide" } },
			{ name: "Ski hill under the floodlights", tags: ["winter", "cozy", "christmas"], values: { world: "skihill", time: "night", weather: "rain", camera: "wide" } },
			{ name: "Harbour, following the work", tags: ["cozy", "retro", "summer", "cute"], values: { world: "harbor" } },
			{ name: "Harbour at sunset, the whole quay", tags: ["cozy", "elegant", "summer"], values: { world: "harbor", time: "dusk", weather: "clear", camera: "wide" } },
			{ name: "Harbour at night, lighthouse and rain", tags: ["cozy", "retro", "spooky"], values: { world: "harbor", time: "night", weather: "rain", camera: "wide" } },
			{ name: "Harbour in the morning fog", tags: ["cozy", "simple", "autumn"], values: { world: "harbor", time: "day", weather: "fog", camera: "drift" } },
			{ name: "Model railway, the whole layout", tags: ["retro", "cute", "spring"], values: { world: "railway", time: "day", weather: "clear", camera: "wide" } },
			{ name: "Model railway, riding with the trains", tags: ["retro", "cozy", "gaming"], values: { world: "railway" } },
			{ name: "Model railway by lamplight", tags: ["cozy", "retro", "elegant"], values: { world: "railway", time: "night", weather: "clear", camera: "wide" } },
			{ name: "Ant farm, the whole nest", tags: ["cute", "retro", "summer"], values: { world: "antfarm", time: "day", weather: "clear", camera: "wide" } },
			{ name: "Ant farm, down among the ants", tags: ["cute", "cozy", "gaming"], values: { world: "antfarm" } },
			{ name: "Ant farm at night, fireflies above", tags: ["cozy", "spooky", "cute"], values: { world: "antfarm", time: "night", weather: "clear", camera: "wide" } },
			{ name: "City junction, a busy day from above", tags: ["retro", "gaming", "pro"], values: { world: "junction", time: "day", weather: "clear", camera: "wide", busy: 1.5 } },
			{ name: "City junction on a rainy night", tags: ["cyber", "cozy", "retro"], values: { world: "junction", time: "night", weather: "rain" } },
			{ name: "City junction at dusk, drifting over", tags: ["cozy", "retro", "elegant"], values: { world: "junction", time: "dusk", weather: "clear", camera: "drift" } }
		].filter(function (p) { return !!WORLDS[p.values.world]; }),
		render: function (root, c) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine("tiny-" + c.world, host, { c1: c.c1, c2: c.c2, c3: c.c3, auto1: !c.c1, auto2: !c.c2, auto3: !c.c3, time: c.time, weather: c.weather, busy: c.busy, camera: c.camera, speed: c.speed, quality: c.sharp });
		}
	});

	// The same worlds behind the "Starting soon / BRB / ending" screens, with the words where each picture is calmest.
	K.addPresets("screen", [
		{ name: "Tiny world: ski hill, starting soon", tags: ["winter", "cozy", "retro"], values: { backdrop: "tiny-skihill", c1: "6db2ea", c2: "e5483f", c3: "ffd98a", title: "Starting soon", subtitle: "one more run first", minutes: 5, layout: "corner", panel: true, font: "Silkscreen", fontsize: 78, fg: "ffffff", accent: "ffd98a", dim: 0 } },
		{ name: "Tiny world: harbour, be right back", tags: ["cozy", "retro", "summer"], values: { backdrop: "tiny-harbor", c1: "79bfe8", c2: "d9483f", c3: "ffd98a", title: "Be right back", subtitle: "the next boat is due any minute", minutes: 0, layout: "top", font: "VT323", fontsize: 132, fg: "ffffff", accent: "fff2a8", fx: "pixel", fx2: "ffffff", fx3: "1d4f86", dim: 0 } },
		{ name: "Tiny world: model railway, intermission", tags: ["retro", "cute", "cozy"], values: { backdrop: "tiny-railway", c1: "8fc7ee", c2: "c8372d", c3: "ffd98a", title: "Intermission", subtitle: "the next train is on its way", minutes: 10, countlabel: "back in", endtext: "all aboard", layout: "bottom", panel: true, font: "Silkscreen", fontsize: 76, fg: "ffffff", accent: "ffd98a", dim: 0 } },
		{ name: "Tiny world: ant farm, loading", tags: ["cute", "retro", "gaming"], values: { backdrop: "tiny-antfarm", c1: "8ed0f0", c2: "e8842c", c3: "e2ff8c", title: "Getting ready", subtitle: "everyone is busy underground", minutes: 5, layout: "corner", panel: true, font: "Press Start 2P", fontsize: 72, fg: "ffffff", accent: "ffc46b", dim: 0 } },
		{ name: "Tiny world: city junction at night, ending", tags: ["cyber", "retro", "cozy"], values: { backdrop: "tiny-junction", c1: "0a1030", c2: "e5483f", c3: "ffd98a", title: "Thanks for watching", subtitle: "get home safe", minutes: 0, layout: "top", panel: true, font: "VT323", fontsize: 104, fg: "ffffff", accent: "5adcff", dim: 0 } }
	].filter(function (p) { return !!SSO.ENGINES[p.values.backdrop]; }));
})();
