/* City backgrounds pack: animated skylines, streets and rooftops. Built on fxkit.js. Keep this Chrome 80 friendly and ASCII only.
   Six always-on pictures, each a background engine ("city-neon", "city-sunset", "city-rain", "city-rooftop", "city-pixel",
   "city-harbor") so the "Starting soon / BRB" screens and the "Animated background" template can use them too, plus one
   template ("city") that picks a scene, a time of day, the weather and the colours.
   How they stay cheap: every depth layer is painted once into a cached canvas (sc.layer) and only slid or faded afterwards;
   lights that move are small pre-rendered sprites; window lights that switch are a few small rectangles a second painted
   straight into the cached layer. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K || !SSO.register) { return; }
	var TAU = Math.PI * 2, FULL_HD = 2100000, RM = 16;

	// ---------------------------------------------------------------- small helpers
	function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
	function rgb(col) { return K.toRgb(col); }
	function mx(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function b255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
	function css(c, a) {
		var s = b255(c[0]) + "," + b255(c[1]) + "," + b255(c[2]);
		return a == null ? "rgb(" + s + ")" : "rgba(" + s + "," + (+a).toFixed(3) + ")";
	}
	function mul(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
	function toHsl(col) {
		var c = typeof col === "string" ? rgb(col) : col, r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
		var hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo, h = 0, s = 0;
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
	// Blends two colours the short way round the colour wheel, so deep blue to orange passes through violet and rose
	// (as a sky does) instead of through grey. Where that way would lead through green (teal to amber, say), which no
	// sky does, it blends plainly instead and the middle comes out a quiet neutral.
	function hueMix(a, b, t) {
		var x = toHsl(a), y = toHsl(b), dh = y[0] - x[0], mid;
		if (x[1] < 0.06) { x[0] = y[0]; dh = 0; } else if (y[1] < 0.06) { dh = 0; }
		if (dh > 180) { dh -= 360; } else if (dh < -180) { dh += 360; }
		mid = (((x[0] + dh * 0.5) % 360) + 360) % 360;
		if (Math.abs(dh) > 70 && mid > 62 && mid < 172) { return mx(typeof a === "string" ? rgb(a) : a, typeof b === "string" ? rgb(b) : b, t); }
		return fromHsl(x[0] + dh * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
	}
	// Turns the hue by dh degrees and scales saturation and lightness.
	function tune(col, dh, ks, kl) { var x = toHsl(col); return fromHsl(x[0] + (dh || 0), x[1] * (ks == null ? 1 : ks), x[2] * (kl == null ? 1 : kl)); }

	// Repeatable noise that tiles sideways every px cells (for fog and cloud textures that scroll without a seam).
	function ihash(x, y, s) {
		var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
		h = Math.imul(h ^ (h >>> 13), 1103515245);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	function vnoise(x, y, px, s) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
		var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		var x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
		var a = ihash(x0, yi, s), b = ihash(x1, yi, s), c = ihash(x0, yi + 1, s), d = ihash(x1, yi + 1, s);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	}
	function fbm(x, y, px, s, oct) {
		var v = 0, a = 0.5, sum = 0, i;
		for (i = 0; i < oct; i++) { v += a * vnoise(x, y, px, s + i * 31); sum += a; x *= 2; y *= 2; px *= 2; a *= 0.5; }
		return v / sum;
	}
	// A soft band of drifting fog or thin cloud as a small texture; stretch it and slide it. Tiles sideways.
	function fogTex(seed, col, w, h, cx, cy, lo, hi) {
		return K.bake(w, h, function (g) {
			var img = g.createImageData(w, h), d = img.data, c = typeof col === "string" ? rgb(col) : col, x, y, i = 0, n, v;
			for (y = 0; y < h; y++) {
				v = Math.sin(Math.PI * (y + 0.5) / h); v = v * v * (3 - 2 * v);
				for (x = 0; x < w; x++) {
					n = fbm(x / w * cx, y / h * cy, cx, seed, 4);
					d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2];
					d[i++] = Math.round(255 * K.smooth(lo, hi, n) * v);
				}
			}
			g.putImageData(img, 0, 0);
		});
	}
	function half(cv) {
		var o = K.canvas(Math.max(1, cv.width / 2), Math.max(1, cv.height / 2));
		o.getContext("2d").drawImage(cv, 0, 0, o.width, o.height);
		return o;
	}
	// Adds a soft glow around everything in `lights` (a canvas the same shape as g's) by shrinking it in steps and drawing
	// the small copies back enlarged. Done once when a layer is painted, never per frame.
	function bloom(g, lights, wu, hu, amount) {
		var a = half(half(lights)), b = half(a), c = half(b);
		g.globalCompositeOperation = "lighter";
		g.globalAlpha = Math.min(1, 0.5 * amount); g.drawImage(a, 0, 0, wu, hu);
		g.globalAlpha = Math.min(1, 0.5 * amount); g.drawImage(b, 0, 0, wu, hu);
		g.globalAlpha = Math.min(1, 0.42 * amount); g.drawImage(c, 0, 0, wu, hu);
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
	}
	// A transparent canvas matching g's, with the same units, for painting the lights of a layer separately.
	function lightCanvas(g, wu, hu) {
		var cv = K.canvas(g.canvas.width, g.canvas.height), c = cv.getContext("2d");
		c.setTransform(cv.width / wu, 0, 0, cv.height / hu, 0, 0);
		return c;
	}
	// Fine grain over a painted sky, so smooth gradients do not show bands once the stream is compressed.
	var grainTile = null;
	function grain(g, w, h, amount) {
		if (!grainTile) {
			grainTile = K.bake(128, 128, function (c) {
				var img = c.createImageData(128, 128), d = img.data, i, v;
				for (i = 0; i < d.length; i += 4) { v = Math.random() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(Math.random() * 255); }
				c.putImageData(img, 0, 0);
			});
		}
		g.save(); g.globalAlpha = amount; g.fillStyle = g.createPattern(grainTile, "repeat"); g.fillRect(0, 0, w, h); g.restore();
	}
	function settings(o) {
		o = o || {};
		return {
			c1: o.c1 || "#0b1030", c2: o.c2 || "#ff6b4a", c3: o.c3 || "#21e6c1",
			speed: K.clamp(num(o.speed, 1), 0.05, 6), detail: K.clamp(num(o.detail, 1), 0.2, 2.5), quality: K.clamp(num(o.quality, 1), 0.3, 1),
			layout: String(o.layout || ""), weather: String(o.weather || ""), time: String(o.time || "")
		};
	}
	// K.scene, plus two things this pack needs. Layers remember their size in units (L.wu, L.hu): the kit keeps a very large
	// layer at a lower resolution, so a layer's pixel size does not always say how big to draw it. And sc.own holds the
	// pack's own cached bands (see drift), emptied whenever the size or resolution changes.
	function scene(host, o) {
		var sc = K.scene(host, o), base = sc.layer;
		sc.own = {}; sc.shift = 0;
		sc.onresize = function () { sc.own = {}; };
		sc.layer = function (name, paint, wu, hu) {
			var L = base(name, paint, wu, hu);
			if (!L.wu) { L.wu = wu || sc.W; L.hu = hu || sc.H; }
			return L;
		};
		return sc;
	}
	// On a strip-shaped source only a band of the picture shows. A scene may slide the picture up by up to sc.top units to
	// bring its best part into that band; this is how far the top of the canvas then is from the top of the picture.
	function cutTop(sc) { return sc.top + sc.shift; }
	function slide(sc, g, most) { sc.shift = Math.min(sc.top, most); if (sc.shift) { g.translate(0, -sc.shift); } }
	// Scene units to whole canvas pixels, so a cached strip is drawn 1:1.
	function snap(sc, u) { return Math.ceil(u * sc.k - 0.001) / sc.k; }
	function put(g, L, k, x, y) { g.drawImage(L, x, y, L.wu, L.hu); }
	// Slides a band of cloud, fog or ripples that tiles sideways (bw units per copy, starting at -off). Where it fits in
	// about two megapixels and is not much wider than the picture, the band is kept at canvas resolution and drawn 1:1 on
	// whole pixels: the cheapest thing a canvas can do when the graphics card is not helping, and at these speeds the
	// one-pixel steps do not show. Otherwise (a vertical or tall narrow source makes every unit many pixels, and shows only
	// a sliver of each band) it is kept at about half a megapixel and enlarged: these are soft textures made from far
	// fewer pixels than that, so nothing is lost, and only the part in view costs anything to draw.
	var BAND_PX = 2000000;
	function drift(sc, g, name, tex, off, y, bw, h) {
		var k = sc.k, L = sc.own[name], full = bw * h * k * k <= BAND_PX && bw * k <= 2 * sc.cv.width, lk, wu, hu, x;
		if (!L) {
			lk = full ? k : Math.min(k, Math.sqrt(BAND_PX / 4 / (bw * h)));
			L = sc.own[name] = K.canvas(Math.ceil(bw * lk), Math.ceil(h * lk));
			L.getContext("2d").drawImage(tex, 0, 0, L.width, L.height);
		}
		wu = full ? L.width / sc.k : bw; hu = full ? L.height / sc.k : h;
		x = -(((off % wu) + wu) % wu);
		if (full) { x = Math.round(x * k) / k; y = Math.round((y - cutTop(sc)) * k) / k + cutTop(sc); }
		for (; x < sc.W; x += wu) { g.drawImage(L, x, y, full ? wu : wu + 0.5, hu); }
	}

	// ---------------------------------------------------------------- weather
	// Rain: thin streak sprites drawn in a tilted frame, a near and a far group.
	function makeRain(amount, col) {
		var n = Math.max(20, Math.round(230 * amount)), d = new Float32Array(n * 3), i, near = Math.round(n * 0.3);
		var spr = K.bake(6, 96, function (g, w, h) {
			var gr = g.createLinearGradient(0, 0, 0, h);
			gr.addColorStop(0, css(col, 0)); gr.addColorStop(0.6, css(col, 0.5)); gr.addColorStop(1, css(col, 0.95));
			g.fillStyle = gr; g.fillRect(1.5, 0, 3, h);
		});
		for (i = 0; i < n; i++) { d[i * 3] = Math.random(); d[i * 3 + 1] = Math.random(); d[i * 3 + 2] = 0.8 + Math.random() * 0.4; }
		return function (g, W, H, dt, slant, alpha) {
			var span = H + 500, wide = W + 700, z, len, v;
			g.save(); g.translate(W / 2, H / 2); g.rotate(slant); g.translate(-W / 2, -H / 2);
			for (i = 0; i < n; i++) {
				if (i === 0) { g.globalAlpha = 0.8 * alpha; } else if (i === near) { g.globalAlpha = 0.45 * alpha; }
				z = i < near ? 1 : 0.5; v = d[i * 3 + 2];
				d[i * 3 + 1] += dt * 2300 * z * v / span;
				if (d[i * 3 + 1] > 1) { d[i * 3 + 1] -= 1; d[i * 3] = Math.random(); }
				len = 130 * z * v;
				g.drawImage(spr, d[i * 3] * wide - 350, d[i * 3 + 1] * span - 250 - len, 3.4 * z, len);
			}
			g.restore(); g.globalAlpha = 1;
		};
	}
	// Snow: soft dots drifting down with a little sway, bigger and faster when nearer.
	function makeSnow(amount, col) {
		var n = Math.max(20, Math.round(170 * amount)), d = new Float32Array(n * 4), i, spr = K.glow(css(col), 32, 0.5), t = 0;
		for (i = 0; i < n; i++) { d[i * 4] = Math.random(); d[i * 4 + 1] = Math.random(); d[i * 4 + 2] = 0.25 + 0.75 * Math.pow(Math.random(), 2.2); d[i * 4 + 3] = Math.random() * TAU; }
		return function (g, W, H, dt, wind, alpha) {
			var z, size;
			t += dt;
			for (i = 0; i < n; i++) {
				z = d[i * 4 + 2];
				d[i * 4 + 1] += dt * (0.03 + 0.085 * z);
				d[i * 4] += dt * (wind * z + Math.sin(t * 0.9 + d[i * 4 + 3]) * 0.012) * 1080 / (W + 200);
				if (d[i * 4 + 1] > 1) { d[i * 4 + 1] -= 1; d[i * 4] = Math.random(); }
				if (d[i * 4] > 1) { d[i * 4] -= 1; } else if (d[i * 4] < 0) { d[i * 4] += 1; }
				size = 4 + 15 * z * z;
				g.globalAlpha = alpha * (0.35 + 0.6 * z);
				g.drawImage(spr, d[i * 4] * (W + 200) - 100 - size / 2, d[i * 4 + 1] * (H + 60) - 30 - size / 2, size, size);
			}
			g.globalAlpha = 1;
		};
	}

	// ---------------------------------------------------------------- signs
	// A made-up sign character: a few strokes on a 3 x 3 grid of points. Never a real letter on purpose.
	function glyph(g, R, x, y, w, h) {
		var n = 2 + Math.floor(R() * 3), i, a, k, p = [0, 0.5, 1];
		g.beginPath();
		for (i = 0; i < n; i++) {
			k = R(); a = Math.floor(R() * 3);
			if (k < 0.3) { g.moveTo(x, y + p[a] * h); g.lineTo(x + w, y + p[a] * h); }
			else if (k < 0.58) { g.moveTo(x + p[a] * w, y); g.lineTo(x + p[a] * w, y + h); }
			else if (k < 0.72) { g.moveTo(x, y + h); g.lineTo(x + w * 0.5, y + (a ? 0 : h * 0.5)); g.lineTo(x + w, y + h); }
			else if (k < 0.86) { g.moveTo(x + (a ? 0 : w), y); g.lineTo(x + (a ? w : 0), y + h); }
			else if (k < 0.94) { g.rect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6); }
			else { g.moveTo(x + w * 0.8, y + h * 0.5); g.arc(x + w * 0.5, y + h * 0.5, w * 0.3, 0, TAU); }
		}
		g.stroke();
	}
	// A glowing sign board. g takes the dark board, lc the light (frame, face and characters).
	function signBoard(g, lc, R, x, y, w, h, col, dark) {
		var small = Math.min(w, h), pad = small * 0.17, lw = Math.max(1.1, small * 0.09), cell, n, i, room;
		g.fillStyle = css(dark); g.fillRect(x, y, w, h);
		lc.globalAlpha = 1;
		lc.fillStyle = css(col, 0.2); lc.fillRect(x, y, w, h);
		lc.strokeStyle = css(col); lc.lineWidth = lw * 0.7; lc.lineJoin = "miter";
		lc.strokeRect(x + lw * 0.5, y + lw * 0.5, w - lw, h - lw);
		lc.strokeStyle = css(mx(col, [255, 255, 255], 0.6)); lc.lineWidth = lw; lc.lineCap = "round"; lc.lineJoin = "round";
		if (h >= w) {
			cell = w - pad * 2; n = Math.max(1, Math.floor((h - pad) / (cell + pad))); room = (h - n * cell - (n - 1) * pad) / 2;
			for (i = 0; i < n; i++) { glyph(lc, R, x + pad, y + room + i * (cell + pad), cell, cell); }
		} else {
			cell = h - pad * 2; n = Math.max(1, Math.floor((w - pad) / (cell * 0.85 + pad))); room = (w - n * cell * 0.85 - (n - 1) * pad) / 2;
			for (i = 0; i < n; i++) { glyph(lc, R, x + room + i * (cell * 0.85 + pad), y + pad, cell * 0.85, cell); }
		}
		lc.lineCap = "butt";
	}

	// ---------------------------------------------------------------- megacity towers
	var WIN_WARM = [255, 216, 156], WIN_AMBER = [255, 176, 92], WIN_COOL = [198, 233, 255];
	// Paints one depth layer of towers into a strip. P describes the layer; the strip is wu x hu units and its top edge
	// sits at P.y0 in the picture. Fills P.tw (windows that may switch later), P.beacons and P.hot (signs that flicker).
	function paintTowers(g, wu, hu, P) {
		var R = K.seeded(P.seed), R2 = K.seeded(P.seed + "tw"), s = P.s, lc = lightCanvas(g, wu, hu), LC = lc.canvas;
		var acc = K.canvas(Math.max(1, LC.width / 2), Math.max(1, LC.height / 2)), ac = acc.getContext("2d");
		var palCss = P.pal.map(function (c) { return css(c); }), sub, x, w, u, e, T, lastCi;
		P.tw = []; P.beacons = []; P.hot = []; P.screens = []; P.ctx = g;
		function hazeAt(c, y) {
			var t = K.clamp((y + P.y0 - P.hy0) / (P.hy1 - P.hy0), 0, 1);
			return mx(c, t < 0.7 ? mx(P.hzTop, P.hzBot, t / 0.7) : mx(P.hzBot, P.hzDeep, (t - 0.7) / 0.3), P.a0 + (P.a1 - P.a0) * Math.min(1, t / 0.7));
		}
		function win(wx, wy, ww, wh, ci, a, face) {
			if (ci !== lastCi) { lc.fillStyle = palCss[ci]; lastCi = ci; }
			lc.globalAlpha = a;
			lc.fillRect(wx, wy, ww, wh);
			if (P.tw.length < P.twMax && R2() < P.twP) {
				P.tw.push({ x: wx, y: wy, w: ww, h: wh, lit: true, on: css(hazeAt(mx(face, P.pal[ci], a * P.lightA), wy)), off: css(hazeAt(face, wy)) });
			}
		}
		// an unlit pane: a shade off the wall, so a dark tower still has a surface
		function dark(wx, wy, ww, wh, ci, a, face) {
			if (P.panes) { g.fillRect(wx, wy, ww, wh); }
			if (P.tw.length < P.twMax && R2() < P.twP * 0.45) {
				P.tw.push({ x: wx, y: wy, w: ww, h: wh, lit: false, on: css(hazeAt(mx(face, P.pal[ci], a * P.lightA), wy)), off: css(hazeAt(P.panes ? mx(face, P.hzTop, 0.16) : face, wy)) });
			}
		}
		function tower(T, back) {
			var x = T.x, w = T.w, top = T.top - P.y0, cx = x + w / 2, toLight = T.u > P.lu ? -1 : 1, i, n, y, sh, tw2, nh;
			var bc = mul(mx(P.body, P.hzTop, back ? P.backHaze : 0), 0.8 + 0.4 * T.r2), sideC = mx(bc, P.glow, P.sideLit), shaft = top, kind = T.r;
			var tall = hu - top;
			g.fillStyle = css(bc);
			if (kind < 0.2 || tall < 120 * s) {
				n = 1 + Math.floor(R() * 3);
				for (i = 0; i < n; i++) { sh = (6 + R() * 16) * s; tw2 = w * (0.15 + R() * 0.3); g.fillRect(x + (w - tw2) * R(), top - sh, tw2, sh + 1); }
			} else if (kind < 0.45) {
				n = 1 + Math.floor(R() * 3); y = top; var al = R() < 0.3 ? (R() < 0.5 ? 0 : 1) : 0.5;
				for (i = 0; i < n; i++) { sh = (14 + R() * 30) * s; tw2 = w * (1 - 0.2 * (n - i)); g.fillRect(x + (w - tw2) * al, y, tw2, sh + 1); y += sh; }
				shaft = y;
			} else if (kind < 0.6) {
				sh = (20 + R() * 60) * s; n = R() < 0.5; shaft = top + sh;
				g.beginPath(); g.moveTo(x, shaft + 1); g.lineTo(x, top + (n ? sh : 0)); g.lineTo(x + w, top + (n ? 0 : sh)); g.lineTo(x + w, shaft + 1); g.fill();
			} else if (kind < 0.76) {
				sh = (50 + R() * 90) * s; tw2 = w * (0.18 + R() * 0.2); nh = (40 + R() * 70) * s; shaft = top + sh;
				g.beginPath(); g.moveTo(x, shaft + 1); g.lineTo(cx - tw2 / 2, top); g.lineTo(cx + tw2 / 2, top); g.lineTo(x + w, shaft + 1); g.fill();
				g.fillRect(cx - Math.max(0.6, 1.1 * s), top - nh, Math.max(1.2, 2.2 * s), nh + 1);
				P.beacons.push([cx, top - nh, s]);
			} else if (kind < 0.88) {
				sh = (20 + R() * 50) * s; nh = sh * (0.3 + R() * 0.6); shaft = top + sh;
				g.fillRect(x, top, w * 0.36, sh + 1); g.fillRect(x + w * 0.64, shaft - nh, w * 0.36, nh + 1);
			} else {
				sh = w * 0.42; shaft = top + sh;
				g.beginPath(); g.moveTo(x, shaft + 1); g.bezierCurveTo(x, top - sh * 0.3, x + w, top - sh * 0.3, x + w, shaft + 1); g.fill();
			}
			if (R() < 0.5 && kind < 0.6) {
				nh = (24 + R() * 60) * s; y = kind < 0.2 ? top : top; tw2 = x + w * (0.25 + R() * 0.5);
				g.fillRect(tw2 - Math.max(0.6, 0.8 * s), y - nh, Math.max(1.2, 1.6 * s), nh + 1);
				g.fillRect(tw2 - 5 * s, y - nh * 0.72, 10 * s, Math.max(1, 1.2 * s));
				if (R() < 0.7) { P.beacons.push([tw2, y - nh, s]); }
			}
			g.fillRect(x, shaft, w, hu - shaft);
			// the face turned to the light is a touch brighter, with a thin lit edge
			var sw = w * (0.14 + 0.13 * T.r3), sx = toLight < 0 ? x : x + w - sw, fx = toLight < 0 ? x + sw : x, fw = w - sw;
			g.fillStyle = css(sideC); g.fillRect(sx, shaft, sw, hu - shaft);
			g.fillStyle = css(mx(bc, P.glow, P.sideLit * 2.6)); g.fillRect(toLight < 0 ? x : x + w - Math.max(1.1, 1.3 * s), shaft, Math.max(1.1, 1.3 * s), hu - shaft);
			// floors of windows
			var fh = (8.5 + 3 * T.r2) * s, cw = (6.4 + 2.6 * T.r3) * s, ww = cw * 0.6, wh = fh * 0.56, pad = 2.5 * s;
			var floors = Math.floor((hu - shaft - 5 * s) / fh), fk = T.r3 < 0.45 ? 0 : T.r3 < 0.7 ? 1 : T.r3 < 0.85 ? 2 : 3;
			var dom = T.r2 < 0.45 ? 0 : T.r2 < 0.65 ? 1 : T.r2 < 0.8 ? 2 : T.r2 < 0.93 ? 3 : 4, f, on, fl, ci, wx, seg, right = fx + fw - pad;
			// Lights come in zones of floors (an office, a hotel, an empty stretch) and in runs along a floor, the way real
			// towers are lit, rather than as even speckle.
			var litK = P.lit * (0.25 + 1.5 * R() * R()), zone = 0, zoneOn = 0, zci = dom, st;
			if (fk === 3) { cw *= 1.7; ww = cw * 0.66; }
			lastCi = -1; g.fillStyle = css(mx(bc, P.hzTop, 0.16));
			for (f = 0; f < floors; f++) {
				y = shaft + 4 * s + f * fh;
				if (zone <= 0) { zone = 3 + Math.floor(R() * 16); zoneOn = R() < 0.2 ? 0.03 : litK * (0.2 + 1.5 * R() * R()); zci = R() < 0.8 ? dom : Math.floor(R() * P.pal.length); continue; }
				zone--;
				fl = R(); on = fl < 0.06 ? 0 : fl > 0.965 ? 0.93 : zoneOn;
				if (f < 3 && T.r2 > 0.7) { on = 0.9; }
				ci = R() < 0.9 ? zci : Math.floor(R() * P.pal.length);
				if (fk === 1) {
					wx = fx + pad;
					while (wx < right - 2 * s) {
						seg = Math.min((5 + R() * 34) * s, right - wx);
						if (R() < on) { win(wx, y, seg, wh * 0.72, ci, 0.45 + 0.55 * R(), bc); } else { R(); dark(wx, y, seg, wh * 0.72, ci, 0.8, bc); }
						wx += seg + 2 * s;
					}
				} else if (fk === 2) {
					for (wx = fx + pad; wx + ww * 0.5 < right; wx += cw * 0.8) {
						if (R() < on * 0.9) { win(wx, y, ww * 0.5, fh * 0.86, ci, 0.4 + 0.6 * R(), bc); } else { R(); }
					}
				} else {
					st = R() < on;
					for (wx = fx + pad; wx + ww < right; wx += cw) {
						if (R() < 0.34) { st = R() < on; } else { R(); }
						if (st) { win(wx, y, ww, wh, ci, 0.4 + 0.6 * R(), bc); } else { R(); dark(wx, y, ww, wh, ci, 0.8, bc); }
					}
				}
				// narrow slits on the side face
				if (on > 0 && sw > 5 * s) {
					for (wx = sx + 1.6 * s; wx + 1.6 * s < sx + sw - s; wx += 3.6 * s) { if (R() < on * 0.7) { win(wx, y, 1.6 * s, wh, ci, 0.35 + 0.4 * R(), sideC); } else { R(); } }
				}
			}
			// trims of light
			lc.globalAlpha = 1;
			if (R() < 0.34) {
				ci = Math.floor(R() * P.neon.length); lc.fillStyle = css(P.neon[ci]); lastCi = -1;
				lc.fillRect(toLight < 0 ? x + w - 2 * s : x + 0.4 * s, shaft, Math.max(1.2, 1.7 * s), (60 + R() * 240) * s);
			}
			if (R() < 0.3) { ci = Math.floor(R() * P.neon.length); lc.fillStyle = css(P.neon[ci]); lastCi = -1; lc.fillRect(x, shaft + 1.5 * s, w, Math.max(1.2, 1.8 * s)); }
			if (R() < 0.22 && floors > 30) {
				ci = Math.floor(R() * P.neon.length); lc.fillStyle = css(P.neon[ci], 0.85); lastCi = -1;
				n = shaft + (0.2 + R() * 0.3) * (hu - shaft);
				lc.fillRect(x, n, w, Math.max(1.2, 1.6 * s)); lc.fillRect(x, n + 5 * s, w, Math.max(1, 1.1 * s));
			}
			// sign boards hung off the side or set on the face
			if (R() < P.signs) {
				n = 1 + (R() < 0.35 ? 1 : 0);
				for (i = 0; i < n; i++) {
					var bw = (15 + R() * 15) * s, bh = bw * (2.6 + Math.floor(R() * 4)), col = P.neon[Math.floor(R() * P.neon.length)], side = R() < 0.5;
					var bx = R() < 0.72 ? (side ? x - bw * 0.82 : x + w - bw * 0.18) : x + w * (0.2 + R() * 0.4), by = shaft + (14 + R() * 210) * s;
					if (R() < 0.25) { nh = bw; bw = Math.min(w * 0.8, bh * 0.8); bh = nh * 1.15; bx = x + (w - bw) * R(); }
					if (by + bh < hu - 40) {
						signBoard(g, lc, R, bx, by, bw, bh, col, mul(bc, 0.6));
						lastCi = -1;
						if (P.hotMax > P.hot.length) { P.hot.push([bx + bw / 2, by + bh / 2, bw, bh, col, R() * 100]); }
					}
				}
			}
			// a big screen on some wide towers (its moving picture is drawn each frame)
			if (P.screenMax > P.screens.length && w > 96 * s && R() < 0.6 && hu - shaft > 420 * s) {
				var qw = Math.min(w * 0.62, 92 * s), qh = qw * (1.35 + R() * 0.5), qx = fx + (fw - qw) / 2, qy = shaft + (26 + R() * 70) * s;
				g.fillStyle = css(mul(bc, 0.5)); g.fillRect(qx - 3 * s, qy - 3 * s, qw + 6 * s, qh + 6 * s);
				lc.clearRect(qx - 3 * s, qy - 3 * s, qw + 6 * s, qh + 6 * s);
				P.screens.push([qx, qy, qw, qh]);
			}
		}
		for (sub = 0; sub < P.rows; sub++) {
			lc.clearRect(0, 0, wu, hu);
			x = -P.wMax * s * R();
			while (x < wu) {
				w = (P.wMin + R() * (P.wMax - P.wMin)) * s;
				u = (x + w / 2 - P.margin) / P.W;
				e = P.env(u) * (0.62 + 0.38 * Math.sin(u * P.ef + P.ep + sub * 2.4));
				T = { x: x, w: w, u: u, r: R(), r2: R(), r3: R() };
				T.top = P.lo - (P.lo - P.hi) * e * (0.3 + 0.7 * Math.pow(R(), 0.75)) + (sub === 0 && P.rows > 1 ? -30 * s : 0);
				tower(T, sub === 0 && P.rows > 1);
				x += w * (P.gap0 + R() * P.gap1);
			}
			g.globalAlpha = P.lightA; g.drawImage(LC, 0, 0, wu, hu); g.globalAlpha = 1;
			ac.drawImage(LC, 0, 0, acc.width, acc.height);
		}
		// distance haze, thicker toward the street
		var gr = g.createLinearGradient(0, P.hy0 - P.y0, 0, P.hy1 - P.y0);
		gr.addColorStop(0, css(P.hzTop, P.a0)); gr.addColorStop(0.7, css(P.hzBot, P.a1)); gr.addColorStop(1, css(P.hzDeep, P.a1));
		g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, wu, hu);
		g.globalCompositeOperation = "lighter";
		var b1 = half(acc), b2 = half(b1), b3 = half(b2), am = P.bloom * (1 - P.a0 * 0.6);
		g.globalAlpha = Math.min(1, 0.5 * am); g.drawImage(b1, 0, 0, wu, hu);
		g.globalAlpha = Math.min(1, 0.5 * am); g.drawImage(b2, 0, 0, wu, hu);
		g.globalAlpha = Math.min(1, 0.42 * am); g.drawImage(b3, 0, 0, wu, hu);
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
	}

	// A streak of light with a bright head at its right end (flip = head at the left).
	function carSprite(col, flip) {
		return K.bake(128, 24, function (g, w, h) {
			var gr = g.createLinearGradient(flip ? w : 0, 0, flip ? 0 : w, 0), hx = flip ? 14 : w - 14, r;
			gr.addColorStop(0, css(col, 0)); gr.addColorStop(0.55, css(col, 0.3)); gr.addColorStop(0.88, css(col, 0.85)); gr.addColorStop(1, css(col, 0));
			g.fillStyle = gr; g.fillRect(0, h / 2 - 3, w, 6);
			r = g.createRadialGradient(hx, h / 2, 0, hx, h / 2, 12);
			r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, css(mx(col, [255, 255, 255], 0.6), 0.95)); r.addColorStop(0.7, css(col, 0.4)); r.addColorStop(1, css(col, 0));
			g.fillStyle = r; g.fillRect(hx - 12, 0, 24, h);
		});
	}
	// A searchlight beam: a narrow fan of light from the bottom centre, fading upward.
	function beamTex(col) {
		return K.bake(96, 384, function (g, w, h) {
			var img = g.createImageData(w, h), d = img.data, x, y, i = 0, t, hw, dx, a;
			for (y = 0; y < h; y++) {
				t = 1 - y / h; hw = 0.05 + 0.95 * t;
				for (x = 0; x < w; x++) {
					dx = Math.abs(x + 0.5 - w / 2) / (w / 2);
					a = (1 - K.smooth(hw * 0.25, hw, dx)) * Math.pow(1 - t, 1.5) * (0.35 + 0.65 * K.smooth(0, 0.08, t));
					d[i++] = col[0]; d[i++] = col[1]; d[i++] = col[2]; d[i++] = Math.round(255 * a);
				}
			}
			g.putImageData(img, 0, 0);
		});
	}
	// The picture shown on a big street screen: bands of colour and rows of made-up characters, tiling top to bottom.
	function screenTex(seed, a, b, c) {
		return K.bake(96, 384, function (g, w, h) {
			var R = K.seeded(seed), gr = g.createLinearGradient(0, 0, 0, h), y, i;
			gr.addColorStop(0, css(mul(a, 0.55))); gr.addColorStop(0.25, css(mul(b, 0.5))); gr.addColorStop(0.5, css(mul(c, 0.4))); gr.addColorStop(0.75, css(mul(b, 0.6))); gr.addColorStop(1, css(mul(a, 0.55)));
			g.fillStyle = gr; g.fillRect(0, 0, w, h);
			for (i = 0; i < 5; i++) {
				y = i * h / 5 + 8;
				g.fillStyle = css(mx(i % 2 ? a : c, [255, 255, 255], 0.25), 0.85);
				if (i % 2) { g.beginPath(); g.arc(w / 2, y + 30, 22, 0, TAU); g.fill(); g.fillStyle = css(mul(b, 0.35)); g.beginPath(); g.arc(w / 2 + 7, y + 26, 16, 0, TAU); g.fill(); }
				else { g.fillRect(10, y + 6, w - 20, 9); g.fillRect(10, y + 22, (w - 20) * (0.4 + R() * 0.5), 9); g.fillRect(10, y + 38, (w - 20) * (0.3 + R() * 0.4), 9); }
				g.strokeStyle = "rgba(255,255,255,0.92)"; g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round";
				glyph(g, R, 14, y + 56, 14, 14); glyph(g, R, 40, y + 56, 14, 14); glyph(g, R, 66, y + 56, 14, 14);
			}
			g.fillStyle = "rgba(0,0,0,0.22)";
			for (y = 0; y < h; y += 4) { g.fillRect(0, y, w, 1.5); }
		});
	}

	// ================================================================ 1. neon megacity at night
	function startNeon(host, o) {
		var S = settings(o), sc = scene(host, { fps: 30, quality: S.quality, maxPixels: FULL_HD });
		var rainy = S.weather === "rain", foggy = S.weather === "fog", snowy = S.weather === "snow";
		var c1 = rgb(S.c1), c2 = rgb(S.c2), c3 = rgb(S.c3), WHITE = [255, 255, 255];
		// the palette: night sky (c1) climbing through dusk colours to the glow of the streets (c2); c3 is the cold sign light
		var hzA = hueMix(c1, c2, 0.16), hzB = tune(hueMix(c1, c2, 0.46), 0, 0.78, 0.9), hzC = hueMix(c1, c2, 0.8), skyTop = mul(c1, 0.45);
		var body = mx(mul(c1, 0.42), [3, 4, 9], 0.3), fogC = mul(mx(mx(hzC, c2, 0.6), WHITE, 0.08), 0.9), deep = mx(mul(fogC, 0.36), hzB, 0.35), hzTop = mx(mx(hzA, hzB, 0.5), WHITE, 0.13);
		var neon = [c3, tune(c2, -30, 1.1, 1.02), [255, 204, 92], tune(c3, 48, 1, 1.05), c2, mx(c3, WHITE, 0.5)];
		var pal = [WIN_WARM, WIN_AMBER, WIN_COOL, mx(c3, WHITE, 0.4), mx(tune(c2, -30, 1, 1), WHITE, 0.3)];
		var hazeAdd = foggy ? 0.2 : rainy ? 0.07 : snowy ? 0.05 : 0, bloomK = foggy ? 1.7 : rainy ? 1.45 : 1;
		var lay = S.layout, lu = lay === "split" ? 0.72 : lay === "center" ? 0.5 : 0.61, vw = lay === "center" ? 0.25 : 0.16;
		var lift = lay === "top" ? 0.74 : 1, mtTop = lay === "top" ? 400 : 286, SWAY = 30, T = Math.random() * 500, twAcc = 0, i;
		function env(u) {
			var v = K.smooth(vw * 0.3, vw * 1.5, Math.abs(u - lu));
			if (lay === "split") { v *= 0.35 + 0.65 * K.smooth(0.3, 0.6, u); }
			return v * lift;
		}
		function LP(id, s, f, hi, lo, a0, a1, rows, lit, signs, twMax, wMin, wMax) {
			return {
				id: id, seed: "neon7" + id, s: s, f: f, hi: hi, lo: lo, y0: Math.floor(hi - 200 * s - 30), rows: rows, lit: lit, signs: signs,
				a0: Math.min(0.97, a0 + hazeAdd * (1 - a0) * 2.2), a1: Math.min(0.985, a1 + hazeAdd * 0.4), hy0: 520, hy1: 1080, hzTop: hzTop, hzBot: fogC, hzDeep: deep,
				body: body, glow: c2, sideLit: 0.17, backHaze: 0.2, pal: pal, neon: neon, lightA: 1, bloom: bloomK * (0.7 + 0.5 * s),
				twMax: twMax, twP: 0.05, gap0: 0.78, gap1: 0.62, ef: 9, ep: 0, panes: false, hotMax: 0, screenMax: 0, wMin: wMin || 70, wMax: wMax || 170, env: env, lu: lu, margin: Math.ceil(SWAY * 1.6 * f) + 2,
				tw: [], beacons: [], hot: [], screens: [], tx: 0, ty: 0, ctx: null, W: 1920
			};
		}
		var P5 = LP("e", 0.3, 0, 560, 735, 0.8, 0.97, 1, 0.5, 0, 260), P4 = LP("d", 0.43, 0, 470, 730, 0.64, 0.95, 1, 0.5, 0.1, 300);
		var P3 = LP("c", 0.6, 0.2, 320, 730, 0.46, 0.92, 2, 0.5, 0.4, 380), P2 = LP("b", 0.8, 0.42, 240, 790, 0.26, 0.78, 2, 0.46, 0.55, 420);
		var P1 = LP("a", 1.08, 0.72, 290, 900, 0.05, 0.56, 1, 0.42, 0.8, 420, 90, 190);
		P1.gap0 = 1.05; P1.gap1 = 1.5; P2.gap0 = 0.85; P2.gap1 = 0.95; P3.panes = P2.panes = P1.panes = true;
		P5.ef = 23; P4.ef = 17; P3.ef = 13; P2.ef = 9; P1.ef = 6; P5.ep = 1; P4.ep = 3.3; P3.ep = 5.1; P2.ep = 0.4; P1.ep = 2.2;
		P2.hotMax = 3; P1.hotMax = 5; P2.screenMax = 1; P1.screenMax = 2;
		var ROWS = [P5, P4, P3, P2, P1], STRIPS = [P3, P2, P1];
		// baked once, whatever the canvas size
		var fogs = [
			{ tex: fogTex(11, mx(hzC, WHITE, 0.12), 384, 96, 6, 2, 0.34, 0.8), y: 560, h: 250, bw: 2300, sp: 7, a: 0.6, f: 0.1 },
			{ tex: fogTex(23, mx(fogC, WHITE, 0.1), 384, 96, 5, 2, 0.3, 0.78), y: 660, h: 300, bw: 2700, sp: -11, a: 0.55, f: 0.3 },
			{ tex: fogTex(37, mx(fogC, WHITE, 0.18), 384, 96, 4, 2, 0.3, 0.8), y: 790, h: 330, bw: 3100, sp: 16, a: 0.5, f: 0.55 }
		];
		var smog = fogTex(51, hzB, 384, 96, 5, 2, 0.36, 0.82), beam = beamTex(mx(c3, WHITE, 0.55));
		var cars = [], flips = [], carCols = [[255, 236, 200], [255, 84, 72], mx(c3, WHITE, 0.3), [255, 190, 90]];
		carCols.forEach(function (c) { cars.push(carSprite(c, false)); flips.push(carSprite(c, true)); });
		var beaconSpr = K.glow("#ff3b3b", 48, 0.3), crownSpr = K.glow(css(mx(c3, WHITE, 0.35)), 256, 0.18), hotSpr = neon.map(function (c) { return K.glow(css(c), 128, 0.05); });
		var screens = [screenTex("s1", neon[0], neon[1], neon[3]), screenTex("s2", neon[1], neon[2], neon[0]), screenTex("s3", neon[3], neon[0], neon[1])];
		var rain = rainy ? makeRain(S.detail, [205, 225, 255]) : null, snow = snowy ? makeSnow(S.detail, [255, 255, 255]) : null;
		var steam = K.particles(40), puff = K.glow(css(mx(fogC, WHITE, 0.45)), 96, 0.02), steamAcc = 0;

		function lane(after, y, s, dir, n, speed, amp, slope, f, mixKind) {
			n = Math.max(3, Math.round(n * S.detail));
			var L = { after: after, y: y, s: s, dir: dir, n: n, sp: speed, amp: amp, slope: slope, f: f, ph: Math.random() * 10, off: new Float32Array(n), jit: new Float32Array(n), kind: new Uint8Array(n) }, acc = 0, j;
			for (j = 0; j < n; j++) { acc += 0.15 + Math.pow(Math.random(), 2) * 2.4; L.off[j] = acc; L.jit[j] = (Math.random() - 0.5) * 14 * s; L.kind[j] = Math.random() < 0.72 ? mixKind : Math.random() < 0.5 ? 2 : 3; }
			for (j = 0; j < n; j++) { L.off[j] /= acc + 0.4; }
			return L;
		}
		var lanes = [
			lane(0, 640, 0.2, 1, 90, 11, 9, 0.015, 0.05, 0), lane(0, 676, 0.24, -1, 80, 14, 7, -0.01, 0.07, 1), lane(0, 592, 0.17, -1, 60, 9, 12, 0.03, 0.04, 0),
			lane(1, 560, 0.4, -1, 44, 30, 16, 0.025, 0.3, 1), lane(1, 612, 0.46, 1, 50, 36, 12, -0.02, 0.32, 0),
			lane(2, 452, 0.66, 1, 26, 62, 22, 0.035, 0.56, 0), lane(2, 524, 0.7, -1, 30, 70, 16, 0.012, 0.58, 1),
			lane(3, 330, 1, -1, 10, 150, 24, -0.03, 0.9, 1), lane(3, 424, 1.1, 1, 12, 170, 18, 0.025, 0.95, 0)
		];
		function drawLanes(g, after, W, sway) {
			var n, L, j, len, x, y, w, h, li;
			for (li = 0; li < lanes.length; li++) {
				L = lanes[li];
				if (L.after !== after) { continue; }
				len = W + 700 * L.s + 200; w = 64 * L.s + 3; h = 12 * L.s + 1.5;
				for (j = 0, n = L.n; j < n; j++) {
					x = (((L.off[j] + T * L.sp * L.dir / len) % 1) + 1) % 1 * len - 100 - 350 * L.s + sway * L.f;
					y = L.y + L.slope * (x - W / 2) + L.amp * Math.sin(x * 0.0035 + L.ph) + L.jit[j];
					g.drawImage(L.dir > 0 ? cars[L.kind[j]] : flips[L.kind[j]], L.dir > 0 ? x - w : x, y - h / 2, w, h);
				}
			}
		}

		function backdrop() {
			return sc.layer("bd", function (g, W, H) {
				var gr = g.createLinearGradient(0, 0, 0, H), lx = lu * W, r, R = K.seeded("neonsky"), j, x, y, a;
				gr.addColorStop(0, css(skyTop)); gr.addColorStop(0.28, css(mx(skyTop, hzA, 0.6))); gr.addColorStop(0.48, css(hzA)); gr.addColorStop(0.61, css(hzB));
				gr.addColorStop(0.71, css(hzC)); gr.addColorStop(0.8, css(fogC)); gr.addColorStop(1, css(deep));
				g.fillStyle = gr; g.fillRect(0, 0, W, H);
				// the light source: the glow of the city's heart, low on the horizon
				g.save(); g.translate(lx, 800); g.scale(1.9, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 520);
				r.addColorStop(0, css(mx(c2, WHITE, 0.45), 0.85)); r.addColorStop(0.22, css(mx(c2, WHITE, 0.15), 0.5)); r.addColorStop(0.6, css(c2, 0.14)); r.addColorStop(1, css(c2, 0));
				g.fillStyle = r; g.fillRect(-560, -560, 1120, 1120); g.restore();
				for (j = 0; j < 150; j++) {
					x = R() * W; y = R() * R() * 520; a = (0.2 + R() * 0.65) * (1 - y / 560);
					g.fillStyle = css(mx(WHITE, c3, R() * 0.4), a); r = R() < 0.1 ? 1.5 : 0.9; g.fillRect(x, y, r, r);
				}
				megatower(g, lx);
				[P5, P4].forEach(function (P) {
					var hu = 1080 - P.y0;
					P.W = W; P.margin = 0;
					var cv = K.bake(Math.ceil(W * sc.k), Math.ceil(hu * sc.k), function (b, bw, bh) { b.setTransform(bw / W, 0, 0, bh / hu, 0, 0); paintTowers(b, W, hu, P); });
					g.drawImage(cv, 0, P.y0, W, hu);
					P.ctx = g; P.tx = 0; P.ty = P.y0;
				});
				grain(g, W, H, 0.035);
			});
		}
		// A colossal far-off spire, pale in the haze: it gives the eye somewhere to go and the city its scale.
		function megatower(g, x) {
			var top = mtTop, gr = g.createLinearGradient(0, top - 90, 0, 1000), dk = mx(hzA, body, 0.55), j, y;
			gr.addColorStop(0, css(dk)); gr.addColorStop(0.5, css(mx(hzB, body, 0.3))); gr.addColorStop(0.82, css(mx(hzC, body, 0.1), 0.9)); gr.addColorStop(1, css(hzC, 0));
			g.fillStyle = gr;
			g.beginPath();
			g.moveTo(x - 1.6, top - 96); g.lineTo(x + 1.6, top - 96); g.lineTo(x + 2.4, top); g.lineTo(x + 9, top + 14); g.lineTo(x + 15, top + 118);
			g.lineTo(x + 33, top + 124); g.lineTo(x + 33, top + 136); g.lineTo(x + 17, top + 142); g.lineTo(x + 27, top + 330);
			g.lineTo(x + 50, top + 338); g.lineTo(x + 50, top + 352); g.lineTo(x + 29, top + 360); g.lineTo(x + 52, 1000);
			g.lineTo(x - 52, 1000); g.lineTo(x - 29, top + 360); g.lineTo(x - 50, top + 352); g.lineTo(x - 50, top + 338); g.lineTo(x - 27, top + 330);
			g.lineTo(x - 17, top + 142); g.lineTo(x - 33, top + 136); g.lineTo(x - 33, top + 124); g.lineTo(x - 15, top + 118); g.lineTo(x - 9, top + 14); g.lineTo(x - 2.4, top);
			g.closePath(); g.fill();
			// the side toward the glow below catches a little light
			g.fillStyle = css(mx(hzC, WHITE, 0.2), 0.16);
			g.beginPath(); g.moveTo(x + 2.4, top); g.lineTo(x + 9, top + 14); g.lineTo(x + 15, top + 118); g.lineTo(x + 8, top + 118); g.closePath(); g.fill();
			g.beginPath(); g.moveTo(x + 17, top + 142); g.lineTo(x + 27, top + 330); g.lineTo(x + 16, top + 330); g.lineTo(x + 10, top + 142); g.closePath(); g.fill();
			// lights: rings at the two collars and a thread of windows up the middle
			for (j = -30; j <= 30; j += 5) { g.fillStyle = css(mx(c3, WHITE, 0.5), 0.9); g.fillRect(x + j - 0.8, top + 129, 1.7, 1.7); }
			for (j = -46; j <= 46; j += 5.2) { g.fillStyle = css(mx(c3, WHITE, 0.4), 0.8); g.fillRect(x + j - 0.8, top + 344, 1.7, 1.7); }
			for (y = top + 24; y < 900; y += 7) {
				j = Math.sin(y * 12.9898) * 43758.5453; j -= Math.floor(j);
				if (j < 0.55) { g.fillStyle = css(WIN_WARM, 0.25 + 0.5 * j); g.fillRect(x - 1 + (j - 0.3) * 10, y, 1.6, 2.4); }
			}
		}
		function strip(P) {
			var W = sc.W;
			return sc.layer(P.id, function (g, wu, hu) { P.W = W; paintTowers(g, wu, hu, P); }, snap(sc, W + 2 * P.margin), snap(sc, 1080 - P.y0));
		}
		// the nearest things: one tall tower cropped by the edge of the picture, and the roof we are standing on
		var edgeRight = lay === "split" || lay === "corner";
		function edgeTower() {
			var ks = Math.min(1, Math.max(0.55, sc.W / 1500)), wu = snap(sc, 290 * ks);
			return sc.layer("edge", function (g, w, h) {
				var R = K.seeded("neonedge5"), lc = lightCanvas(g, w, h), bw = 196 * ks, bc = mx(mul(body, 0.9), hzA, 0.1), x, y, f, ci, st, zone = 0, zoneOn = 0, gr;
				var fh = 27 * ks, cw = 19.5 * ks, ww = 11.5 * ks, wh = 16 * ks, sideW = 36 * ks, glass = css(mx(bc, hzA, 0.3)), sill = css(mul(bc, 0.6), 0.34);
				if (edgeRight) { g.translate(w, 0); g.scale(-1, 1); lc.translate(w, 0); lc.scale(-1, 1); }
				gr = g.createLinearGradient(0, 0, bw, 0);
				gr.addColorStop(0, css(mul(bc, 0.7))); gr.addColorStop(1, css(mul(bc, 1.25)));
				g.fillStyle = gr; g.fillRect(0, 0, bw, h);
				g.fillStyle = css(mx(mul(bc, 1.3), c2, 0.12)); g.fillRect(bw - sideW, 0, sideW, h);
				g.fillStyle = css(mx(bc, c2, 0.5)); g.fillRect(bw - 2.2, 0, 2.2, h);
				for (f = 0; f * fh < h; f++) {
					y = 12 * ks + f * fh;
					if (f % 7 === 6) {
						// a ledge every few floors
						g.fillStyle = css(mul(bc, 2.1)); g.fillRect(0, y + wh * 0.3, bw - sideW, 2.4 * ks); g.fillStyle = css(mul(bc, 0.45)); g.fillRect(0, y + wh * 0.3 + 2.4 * ks, bw - sideW, 5 * ks);
						continue;
					}
					if (zone <= 0) { zone = 2 + Math.floor(R() * 6); zoneOn = R() < 0.3 ? 0.04 : 0.12 + 0.4 * R() * R(); }
					zone--;
					st = R() < zoneOn;
					for (x = 9 * ks; x + ww < bw - sideW - 4 * ks; x += cw) {
						if (R() < 0.4) { st = R() < zoneOn; } else { R(); }
						ci = R() < 0.62 ? 0 : R() < 0.5 ? 1 : R() < 0.6 ? 2 : 3;
						if (st) {
							lc.globalAlpha = 0.35 + 0.6 * R(); lc.fillStyle = css(pal[ci]); lc.fillRect(x, y, ww, wh);
							lc.globalAlpha = 1; lc.fillStyle = sill; lc.fillRect(x, y + wh * (0.45 + 0.3 * R()), ww, wh * 0.55);
							lc.clearRect(x + ww * 0.46, y, ww * 0.1, wh);
						} else { R(); R(); g.fillStyle = glass; g.fillRect(x, y, ww, wh); g.fillStyle = css(mul(bc, 0.8)); g.fillRect(x + ww * 0.46, y, ww * 0.1, wh); }
					}
					for (x = bw - sideW + 5 * ks; x < bw - 7 * ks; x += 7 * ks) { if (R() < zoneOn * 0.9) { lc.globalAlpha = 0.3 + 0.4 * R(); lc.fillStyle = css(pal[0]); lc.fillRect(x, y, 3 * ks, wh); } else { R(); } }
				}
				lc.globalAlpha = 1;
				signBoard(g, lc, R, bw - 14 * ks, 250, 74 * ks, 330 * ks, neon[0], mul(bc, 0.55));
				signBoard(g, lc, R, 22 * ks, 690, 128 * ks, 50 * ks, neon[1], mul(bc, 0.55));
				signBoard(g, lc, R, bw - 6 * ks, 86, 42 * ks, 118 * ks, neon[2], mul(bc, 0.55));
				lc.fillStyle = css(neon[3]); lc.fillRect(bw - sideW - 2.6, 0, 2.6, h);
				g.setTransform(g.canvas.width / w, 0, 0, g.canvas.height / h, 0, 0);
				g.drawImage(lc.canvas, 0, 0, w, h);
				gr = g.createLinearGradient(0, 640, 0, 1080);
				gr.addColorStop(0, css(fogC, 0)); gr.addColorStop(0.75, css(fogC, 0.34 + hazeAdd)); gr.addColorStop(1, css(deep, 0.4 + hazeAdd));
				g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
				bloom(g, lc.canvas, w, h, 1.15 * bloomK);
			}, wu, 1080);
		}
		// The roof we are standing on: plant, a stair hut with its lamp on, a mast, a rail. Dark against the glow, edges lit.
		var vent = [0, 0], mast = [0, 0], ROOF_M = Math.ceil(SWAY * 1.6 * 1.25) + 2;
		function roof() {
			var W = sc.W, m = ROOF_M;
			return sc.layer("roof", function (g, w, h) {
				var R = K.seeded("neonroof4"), lc = lightCanvas(g, w, h), bc = mx(mul(body, 0.7), hzA, 0.06), rimC = mx(bc, fogC, 0.55), rim = css(rimC), base = 164, x, j, n, gr, top0 = 1080 - h;
				var mir = edgeRight, d = mir ? -1 : 1;
				function px(u) { return m + W * (mir ? 1 - u : u); }
				function box(bx, by, bw, bh) { g.fillStyle = css(bc); g.fillRect(bx, by, bw, bh); g.fillStyle = rim; g.fillRect(bx, by, bw, 1.8); g.fillStyle = css(mx(bc, fogC, 0.16)); g.fillRect(bx, by + 1.8, bw, 3); }
				// far edge of the roof with a low wall
				gr = g.createLinearGradient(0, base, 0, h);
				gr.addColorStop(0, css(mx(bc, fogC, 0.2))); gr.addColorStop(0.25, css(bc)); gr.addColorStop(1, css(mul(bc, 0.55)));
				g.fillStyle = gr; g.fillRect(0, base, w, h - base);
				g.fillStyle = rim; g.fillRect(0, base, w, 2);
				g.fillStyle = css(mul(bc, 0.5)); g.fillRect(0, base + 9, w, 4);
				// a rail along part of the edge
				x = px(0.27); n = Math.round(W * 0.2 / 46);
				g.fillStyle = css(bc);
				for (j = 0; j <= n; j++) { g.fillRect(x + d * j * 46 - 1.5, base - 34, 3, 34); }
				g.fillRect(Math.min(x, x + d * n * 46), base - 34, n * 46, 2.4); g.fillRect(Math.min(x, x + d * n * 46), base - 19, n * 46, 1.8);
				g.fillStyle = rim; g.fillRect(Math.min(x, x + d * n * 46), base - 35, n * 46, 1.2);
				// a stair hut with a lit door
				x = px(0.54) - 55;
				box(x, base - 84, 110, 84); box(x - 5, base - 90, 120, 7);
				g.fillStyle = css(mul(bc, 0.5)); g.fillRect(x + 66, base - 58, 30, 58);
				lc.fillStyle = css(WIN_WARM, 0.95); lc.fillRect(x + 73, base - 50, 16, 20);
				lc.fillStyle = css(WIN_AMBER); lc.beginPath(); lc.arc(x + 81, base - 68, 3.4, 0, TAU); lc.fill();
				lc.fillStyle = css(WIN_AMBER, 0.2); lc.beginPath(); lc.moveTo(x + 81, base - 66); lc.lineTo(x + 122, base + 4); lc.lineTo(x + 40, base + 4); lc.closePath(); lc.fill();
				g.fillStyle = css(mx(bc, WIN_AMBER, 0.3)); g.fillRect(x + 20, base + 2, 120, 5);
				// air units and pipework
				x = px(0.36) - 60;
				box(x, base - 48, 92, 48); box(x + 8, base - 56, 32, 8);
				g.fillStyle = css(mx(bc, fogC, 0.3)); for (j = 0; j < 6; j++) { g.fillRect(x + 50, base - 40 + j * 6, 34, 1.8); }
				box(x + 112, base - 28, 50, 28);
				lc.fillStyle = css(c3); lc.fillRect(x + 12, base - 38, 3, 3); lc.fillStyle = "#ff5a4a"; lc.fillRect(x + 20, base - 38, 3, 3);
				g.fillStyle = css(bc); g.fillRect(x - 74, base - 14, 76, 5); g.fillRect(x - 74, base - 14, 5, 14); g.fillStyle = rim; g.fillRect(x - 74, base - 14, 76, 1.2);
				// a vent stack (steam rises from it)
				x = px(0.19) - 11;
				box(x, base - 62, 22, 62); box(x - 5, base - 70, 32, 8);
				vent[0] = x + 11 - m; vent[1] = top0 + base - 72;
				// a mast with cross arms and stays, and a dish
				x = px(0.74);
				g.fillStyle = css(bc); g.fillRect(x - 2, 8, 4, base - 8); g.fillRect(x - 27, 38, 54, 2.6); g.fillRect(x - 19, 62, 38, 2.6); g.fillRect(x - 12, 84, 24, 2.6);
				g.fillRect(x - 27, 30, 2, 10); g.fillRect(x + 25, 30, 2, 10);
				g.strokeStyle = css(bc); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 24); g.lineTo(x - 74, base); g.moveTo(x, 24); g.lineTo(x + 66, base); g.stroke();
				mast[0] = x - m; mast[1] = top0 + 8;
				x = px(0.74) + d * 112;
				g.fillStyle = css(bc); g.fillRect(x - 3, base - 30, 6, 30);
				g.beginPath(); g.ellipse(x, base - 38, 31, 18, -0.6 * d, 0, TAU); g.fill();
				g.strokeStyle = rim; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, base - 38, 31, 18, -0.6 * d, Math.PI * 0.95, Math.PI * 1.85); g.stroke();
				// thin aerials further along
				n = Math.max(2, Math.round(W / 480));
				for (j = 0; j < n; j++) { x = m + W * (0.04 + 0.92 * R()); g.fillStyle = css(bc); g.fillRect(x, base - 26 - R() * 56, 1.8, 90); }
				g.drawImage(lc.canvas, 0, 0, w, h);
				bloom(g, lc.canvas, w, h, 1.3);
			}, snap(sc, W + 2 * m), snap(sc, 210));
		}
		function toggle() {
			var P = ROWS[(Math.random() * ROWS.length) | 0], w;
			if (!P.ctx || !P.tw.length) { return; }
			w = P.tw[(Math.random() * P.tw.length) | 0];
			w.lit = !w.lit;
			P.ctx.fillStyle = w.lit ? w.on : w.off;
			P.ctx.fillRect(w.x + P.tx, w.y + P.ty, w.w, w.h);
		}
		function extras(g, P, L, ox, oy, k) {
			var j, q, tex, off, h1, b, a;
			for (j = 0; j < P.screens.length; j++) {
				q = P.screens[j]; tex = screens[(j + (P === P1 ? 0 : 2)) % 3]; off = ((T * (9 + j * 3)) % 384 + 384) % 384;
				h1 = Math.min(384 - off, 384 * 0.42);
				// the screen shows a window 42% of the texture tall, wrapping round
				g.drawImage(tex, 0, off, 96, h1, ox + q[0], oy + q[1], q[2], q[3] * h1 / (384 * 0.42));
				if (h1 < 384 * 0.42 - 0.5) { g.drawImage(tex, 0, 0, 96, 384 * 0.42 - h1, ox + q[0], oy + q[1] + q[3] * h1 / (384 * 0.42), q[2], q[3] * (1 - h1 / (384 * 0.42))); }
			}
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < P.hot.length; j++) {
				b = P.hot[j]; a = 0.16 + 0.1 * Math.sin(T * 1.3 + b[5]) * Math.sin(T * 0.37 + b[5] * 2);
				if (Math.sin(T * 0.23 + b[5]) > 0.985) { a *= 0.3 + 0.7 * Math.random(); }
				g.globalAlpha = a;
				g.drawImage(hotSpr[neon.indexOf(b[4])] || hotSpr[0], ox + b[0] - b[2] * 2.2, oy + b[1] - b[3] * 0.85, b[2] * 4.4, b[3] * 1.7);
			}
			for (j = 0; j < P.beacons.length; j++) {
				b = P.beacons[j]; a = Math.sin(T * 1.9 + b[0] * 0.37); a = a > 0 ? a * a * a : 0;
				if (a < 0.02) { continue; }
				g.globalAlpha = a; q = 9 + 16 * b[2];
				g.drawImage(beaconSpr, ox + b[0] - q / 2, oy + b[1] - q / 2, q, q);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		}
		steam.step = function (p, dt) { p.vx += (18 - p.vx) * dt * 0.3; };

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, sway, j, L, P, F, ox, a, bx, p, slow = !!(window.SSO_FRAMES && window.SSO_FRAMES.level() > 0);
			T += dt * S.speed;
			sway = SWAY * (Math.sin(T * 0.045) + 0.55 * Math.sin(T * 0.019 + 1.7));
			sc.put(backdrop());
			// thin lit cloud drifting high up
			g.globalAlpha = 0.5; drift(sc, g, "d0", smog, T * 3.2, 330, 2500, 300); g.globalAlpha = 1;
			g.globalCompositeOperation = "lighter";
			// the top of the far spire breathes
			a = 0.5 + 0.5 * Math.sin(T * 0.7);
			g.globalAlpha = 0.5 + 0.35 * a; j = 150 + 50 * a;
			g.drawImage(crownSpr, lu * W - j / 2, mtTop - 96 - j / 2, j, j);
			// searchlights sweeping from behind the skyline
			for (j = 0; j < 3; j++) {
				bx = W * (j === 0 ? (lu > 0.55 ? 0.2 : 0.14) : j === 1 ? lu - 0.17 : (lu > 0.66 ? 0.94 : 0.86));
				g.globalAlpha = 0.3 + 0.08 * Math.sin(T * 0.21 + j * 2);
				g.save(); g.translate(bx, 690); g.rotate((j === 1 ? -0.1 : j ? -0.35 : 0.4) + 0.3 * Math.sin(T * (0.11 + j * 0.027) + j * 2.1));
				g.drawImage(beam, -70, -780, 140, 780); g.restore();
			}
			g.globalAlpha = 1;
			drawLanes(g, 0, W, sway);
			g.globalCompositeOperation = "source-over";
			for (j = 0; j < 3; j++) {
				F = fogs[j]; P = STRIPS[j];
				g.globalAlpha = Math.min(0.95, F.a * (foggy ? 1.5 : 1)); drift(sc, g, "fg" + j, F.tex, T * F.sp - sway * F.f, F.y, F.bw, F.h); g.globalAlpha = 1;
				// once the machine is struggling the layers move in whole pixels, which costs far less to draw
				L = strip(P); ox = -P.margin + sway * P.f; if (slow) { ox = Math.round(ox * k) / k; }
				put(g, L, k, ox, 1080 - L.hu);
				P.tx = 0; P.ty = 0;
				extras(g, P, L, ox, 1080 - L.hu, k);
				g.globalCompositeOperation = "lighter";
				drawLanes(g, j + 1, W, sway);
				g.globalCompositeOperation = "source-over";
			}
			if (foggy) { g.globalAlpha = 0.5; drift(sc, g, "d2", fogs[2].tex, T * 21 + 900, 420, 3400, 520); g.globalAlpha = 1; }
			// the foreground
			if (lay !== "split" && W >= 420) {
				L = edgeTower();
				ox = edgeRight ? W - L.wu + 50 + sway * 1.1 : -50 + sway * 1.1; if (slow) { ox = Math.round(ox * k) / k; }
				put(g, L, k, ox, 0);
			}
			L = roof(); ox = sway * 1.25 - ROOF_M; if (slow) { ox = Math.round(ox * k) / k; }
			steamAcc += dt * S.speed;
			if (steamAcc > 0.22) {
				steamAcc = 0; p = steam.spawn();
				if (p) { p.x = vent[0] + sway * 1.25 + K.rnd(-6, 6); p.y = vent[1]; p.vx = K.rnd(-6, 10); p.vy = K.rnd(-58, -38); p.life = K.rnd(4, 6.5); p.img = puff; p.size = K.rnd(20, 30); p.grow = K.rnd(22, 34); p.a = 0.3; p.fade = 0.75; }
			}
			steam.update(dt * S.speed); steam.draw(g);
			put(g, L, k, ox, 1080 - L.hu);
			a = Math.sin(T * 1.6); a = a > 0 ? a * a : 0;
			if (a > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = a; g.drawImage(beaconSpr, mast[0] + sway * 1.25 - 17, mast[1] - 17, 34, 34); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
			twAcc += dt * 7 * S.detail * S.speed;
			while (twAcc >= 1) { twAcc -= 1; toggle(); }
			if (rain) { rain(g, W, 1080, dt * S.speed, 0.2, 1); }
			if (snow) { snow(g, W, 1080, dt * S.speed, 0.02, 1); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "city-neon", label: "City: neon megacity at night", colors: ["0a1438", "ff7a3c", "1fe5c8"], start: startNeon });

	// ================================================================ shared sky, cloud, water and bird pieces
	// The bands of a low-sun sky, top to horizon: c1 overhead, c2 at the horizon, a touch of the sun colour at the bottom.
	// plain 0..1 = how far the middle bands are pulled back from vivid toward a quiet blend (a blue dusk rather than a pink one).
	function skyBands(gr, c1, c2, c3, top, hot, plain) {
		plain = plain || 0;
		gr.addColorStop(0, css(mul(c1, top)));
		gr.addColorStop(0.32, css(mx(hueMix(c1, c2, 0.13), mx(c1, c2, 0.08), plain)));
		gr.addColorStop(0.54, css(mx(tune(hueMix(c1, c2, 0.34), 0, 0.8, 1.04), mx(c1, c2, 0.22), plain)));
		gr.addColorStop(0.7, css(mx(tune(hueMix(c1, c2, 0.6), 0, 0.78, 1.08), mx(c1, c2, 0.5), plain)));
		gr.addColorStop(0.83, css(mx(tune(hueMix(c1, c2, 0.85), 0, 0.9, 1.04), mx(c1, c2, 0.82), plain)));
		gr.addColorStop(0.93, css(c2));
		gr.addColorStop(1, css(mx(c2, c3, hot)));
	}
	// Paints something blurry: draws it small (1/div of the size) and enlarges it. k = canvas pixels per unit.
	function soft(g, k, x, y, wu, hu, div, paint) {
		var cv = K.bake(Math.max(2, wu * k / div), Math.max(2, hu * k / div), function (c, w, h) { c.setTransform(w / wu, 0, 0, h / hu, 0, 0); paint(c, wu, hu); });
		g.drawImage(cv, x, y, wu, hu);
	}
	// A soft road of light on water under the sun or moon: narrow at the horizon, wider and fainter toward the viewer.
	function lightRoad(g, k, W, h, sx, col, w0, w1, a0, a1) {
		var cw = Math.max(8, Math.round(W * k / 8)), ch = Math.max(8, Math.round(h * k / 8));
		var cv = K.bake(cw, ch, function (c) {
			var img = c.createImageData(cw, ch), d = img.data, x, y, i = 0, v, wd, dx, a;
			for (y = 0; y < ch; y++) {
				v = (y + 0.5) / ch; wd = (w0 + (w1 - w0) * v) / W * cw; a = a0 + (a1 - a0) * Math.pow(v, 0.6);
				for (x = 0; x < cw; x++) { dx = (x + 0.5 - sx / W * cw) / wd; d[i++] = col[0]; d[i++] = col[1]; d[i++] = col[2]; d[i++] = Math.round(255 * a * Math.exp(-dx * dx)); }
			}
			c.putImageData(img, 0, 0);
		});
		g.drawImage(cv, 0, 0, W, h);
	}
	// A bank of cloud as a texture that tiles sideways, lit from below by a low sun: glowing undersides and edges, shaded
	// bodies. cover 0..1 = how much of the strip it fills.
	function cloudTex(seed, w, h, cx, cy, cover, softness, lit, shade, rim, maxA) {
		return K.bake(w, h, function (g) {
			var img = g.createImageData(w, h), d = img.data, den = new Float32Array(w * h), x, y, i, o, v, e, a, l, below, thick, r;
			var th = 0.64 - cover * 0.3, step = Math.max(1, Math.round(h * 0.07));
			for (y = 0, i = 0; y < h; y++) {
				v = (y + 0.5) / h; e = K.smooth(0, 0.24, v) * K.smooth(0, 0.24, 1 - v);
				for (x = 0; x < w; x++, i++) { den[i] = fbm(x / w * cx, y / h * cy, cx, seed, 5) * (0.62 + 0.38 * e) - (1 - e) * 0.3; }
			}
			for (y = 0, i = 0, o = 0; y < h; y++) {
				for (x = 0; x < w; x++, i++) {
					a = K.smooth(th, th + softness, den[i]);
					below = den[Math.min(h - 1, y + step) * w + x];
					l = K.clamp(0.4 + (den[i] - below) * 7.5, 0, 1);
					thick = K.smooth(th + softness, th + softness + 0.16, den[i]);
					l *= 1 - 0.3 * thick;
					r = a < 0.7 ? (1 - a / 0.7) * 0.55 : 0;
					d[o++] = (shade[0] + (lit[0] - shade[0]) * l) * (1 - r) + rim[0] * r;
					d[o++] = (shade[1] + (lit[1] - shade[1]) * l) * (1 - r) + rim[1] * r;
					d[o++] = (shade[2] + (lit[2] - shade[2]) * l) * (1 - r) + rim[2] * r;
					d[o++] = Math.round(255 * a * maxA);
				}
			}
			g.putImageData(img, 0, 0);
		});
	}
	// Small light and dark lens shapes: the broken surface of water. Tiles sideways.
	function rippleTex(seed, light, dark) {
		return K.bake(512, 96, function (g, w, h) {
			var R = K.seeded(seed), i, x, y, len, th;
			for (i = 0; i < 170; i++) {
				x = R() * w; y = 3 + R() * (h - 6); len = 8 + R() * R() * 64; th = 0.9 + R() * 1.7;
				g.fillStyle = i % 2 ? css(light, 0.1 + R() * 0.3) : css(dark, 0.08 + R() * 0.22);
				g.beginPath(); g.ellipse(x, y, len / 2, th / 2, 0, 0, TAU);
				if (x + len / 2 > w) { g.ellipse(x - w, y, len / 2, th / 2, 0, 0, TAU); }
				if (x - len / 2 < 0) { g.ellipse(x + w, y, len / 2, th / 2, 0, 0, TAU); }
				g.fill();
			}
		});
	}
	// Glints on the water under the sun: short bright dashes that fade in and out, each somewhere new every time.
	function makeGlitter(n, col) {
		var d = new Float32Array(n * 5), i;
		var spr = K.bake(64, 16, function (g, w, h) {
			var r;
			g.translate(w / 2, h / 2); g.scale(1, h / w);
			r = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
			r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, css(col, 0.8)); r.addColorStop(1, css(col, 0));
			g.fillStyle = r; g.fillRect(-w / 2, -w / 2, w, w);
		});
		function seed(j) { d[j * 5] = Math.random() + Math.random() - 1; d[j * 5 + 1] = Math.pow(Math.random(), 1.6); d[j * 5 + 2] = 0; d[j * 5 + 3] = 0.5 + Math.random() * 1.3; d[j * 5 + 4] = 0.45 + Math.random() * 0.55; }
		for (i = 0; i < n; i++) { seed(i); d[i * 5 + 2] = Math.random() * d[i * 5 + 3]; }
		return function (g, cx, y0, y1, dt, w0, w1, alpha) {
			var v, a, w;
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < n; i++) {
				d[i * 5 + 2] += dt;
				if (d[i * 5 + 2] >= d[i * 5 + 3]) { seed(i); }
				v = d[i * 5 + 1]; a = Math.sin(Math.PI * d[i * 5 + 2] / d[i * 5 + 3]);
				g.globalAlpha = a * a * alpha * d[i * 5 + 4];
				w = 9 + 74 * v;
				g.drawImage(spr, cx + d[i * 5] * (w0 + (w1 - w0) * v) - w / 2, y0 + v * (y1 - y0) - w * 0.08, w, w * 0.16);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		};
	}
	// Draws a baked reflection in thin slices that each slide sideways a little, more so nearer the viewer. Works in whole
	// canvas pixels (the layer is normally at canvas resolution, r = 1), so the slices meet without seams; slices outside
	// the canvas are skipped. mirror = the picture is flipped.
	// flick 0..1 = how much each slice also dims and brightens (the broken glitter of lights on a wet road).
	function wobble(sc, g, L, x, y, T, a0, a1, speed, mirror, flick) {
		var k = sc.k, hp = L.height, r = L.hu * k / hp, y0 = Math.round((y - cutTop(sc)) * k), x0 = Math.round(x * k), sy = 0, hh, f, off, dw, v;
		if (Math.abs(r - 1) < 0.01) { r = 1; }
		dw = r === 1 ? L.width : L.wu * k;
		if (mirror) { g.setTransform(-1, 0, 0, 1, sc.cv.width, 0); } else { g.setTransform(1, 0, 0, 1, 0, 0); }
		while (sy < hp) {
			f = sy / hp; hh = Math.min(hp - sy, 2 + Math.floor(f * 6 * k / r)); v = sy * r;
			if (y0 + v + hh * r > 0 && y0 + v < sc.cv.height) {
				off = (a0 + (a1 - a0) * f) * k * (Math.sin(T * speed + v * 0.045 / k) + 0.5 * Math.sin(T * speed * 1.73 + v * 0.11 / k));
				if (flick) { g.globalAlpha = 1 - flick * (0.5 + 0.5 * Math.sin(v * 2.1 + T * 3.3 + 4 * Math.sin(v * 0.37))); }
				g.drawImage(L, 0, sy, L.width, hh, x0 + Math.round(off), y0 + v, dw, hh * r);
			}
			sy += hh;
		}
		g.globalAlpha = 1;
		g.setTransform(k, 0, 0, k, 0, -cutTop(sc) * k);
		if (mirror) { g.translate(sc.W, 0); g.scale(-1, 1); }
	}
	// A loose flock that crosses the sky now and then; each bird is two curved strokes that flap. o: y0, y1 (band of
	// sky), size, speed, gap (seconds between visits), first (seconds before the first).
	function makeBirds(count, col, o) {
		var b = [], i, wait = o.first == null ? 5 : o.first, on = false, dir = 1, lead = 0, baseY = 0, sp = 60, slope = 0, t = Math.random() * 50;
		for (i = 0; i < count; i++) { b.push({ ox: 0, oy: 0, s: 1, ph: 0, fr: 6 }); }
		return function (g, W, dt) {
			var q, x, y, f, wing, out = true;
			t += dt;
			if (!on) {
				wait -= dt;
				if (wait > 0) { return; }
				on = true; dir = Math.random() < 0.5 ? 1 : -1; lead = dir > 0 ? -60 : W + 60; baseY = o.y0 + Math.random() * (o.y1 - o.y0);
				sp = o.speed * (0.8 + 0.5 * Math.random()); slope = (Math.random() - 0.5) * 0.1;
				for (i = 0; i < count; i++) {
					q = b[i]; q.s = o.size * (0.65 + 0.7 * Math.random()); q.ox = -dir * i * o.size * (1.6 + Math.random() * 2.2);
					q.oy = (Math.random() - 0.5) * o.size * (4 + count * 0.9); q.ph = Math.random() * TAU; q.fr = 5.5 + Math.random() * 3;
				}
			}
			lead += dir * sp * dt;
			g.strokeStyle = col; g.lineCap = "round"; g.lineJoin = "round";
			for (i = 0; i < count; i++) {
				q = b[i]; x = lead + q.ox; y = baseY + q.oy + slope * (x - W / 2) + Math.sin(t * 0.7 + q.ph) * q.s * 0.5;
				if (x > -80 && x < W + 80) { out = false; } else { continue; }
				// a few beats, then a short glide
				f = Math.sin(t * 0.9 + q.ph * 3) > 0.55 ? 0.25 : Math.sin(t * q.fr + q.ph);
				wing = q.s;
				g.lineWidth = Math.max(1.1, wing * 0.15);
				g.beginPath();
				g.moveTo(x - wing, y - f * wing * 0.6);
				g.quadraticCurveTo(x - wing * 0.45, y - wing * 0.28 - f * wing * 0.22, x, y);
				g.quadraticCurveTo(x + wing * 0.45, y - wing * 0.28 - f * wing * 0.22, x + wing, y - f * wing * 0.6);
				g.stroke();
			}
			if (out && ((dir > 0 && lead > W) || (dir < 0 && lead < 0))) { on = false; wait = o.gap * (0.6 + 0.8 * Math.random()); }
		};
	}
	// A far-off aircraft: a speck trailing a thin line by day, a blinking light after dark.
	function makePlane(col, lightsOn) {
		var x = 0, y = 0, dir = 1, sp = 40, ang = 0, wait = 8 + Math.random() * 18, t = 0;
		var trail = K.bake(256, 6, function (g, w) {
			var gr = g.createLinearGradient(0, 0, w, 0);
			gr.addColorStop(0, css(col, 0)); gr.addColorStop(0.65, css(col, 0.3)); gr.addColorStop(1, css(col, 0.9));
			g.fillStyle = gr; g.fillRect(0, 1.5, w, 3);
		});
		var white = K.glow("#ffffff", 32, 0.4), red = K.glow("#ff4338", 32, 0.4);
		return function (g, W, dt, y0, y1) {
			var a;
			t += dt;
			if (wait > 0) {
				wait -= dt;
				if (wait <= 0) { dir = Math.random() < 0.5 ? 1 : -1; x = dir > 0 ? -330 : W + 330; y = y0 + Math.random() * (y1 - y0); sp = 30 + Math.random() * 18; ang = -Math.random() * 0.1; }
				return;
			}
			x += dir * sp * dt; y += sp * dt * Math.sin(ang);
			if (x < -340 || x > W + 340) { wait = 30 + Math.random() * 50; return; }
			g.save(); g.translate(x, y); if (dir < 0) { g.scale(-1, 1); } g.rotate(ang);
			if (!lightsOn) { g.drawImage(trail, -310, -1.3, 310, 2.6); }
			g.fillStyle = css(lightsOn ? [20, 22, 40] : mx(col, [255, 255, 255], 0.5)); g.fillRect(-4, -0.9, 7, 1.8);
			g.restore();
			if (lightsOn) {
				g.globalCompositeOperation = "lighter";
				g.globalAlpha = 0.75; g.drawImage(red, x - 5, y - 5, 10, 10);
				a = (t * 0.9) % 1;
				if (a < 0.08) { g.globalAlpha = 1; g.drawImage(white, x - 9, y - 9, 18, 18); }
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
		};
	}
	function hazeTint(c, hz, y) { return mx(c, hz.col, hz.a0 + (hz.a1 - hz.a0) * K.clamp((y - hz.y0) / (hz.y1 - hz.y0), 0, 1)); }
	// Tints what is already painted toward the haze colour, more so lower down.
	function hazeFill(g, hz, w, h) {
		var gr = g.createLinearGradient(0, hz.y0, 0, hz.y1);
		gr.addColorStop(0, css(hz.col, hz.a0)); gr.addColorStop(1, css(hz.col, hz.a1));
		g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
	}
	// A plain skyline in silhouette standing on a ground line. o: seed, W, x0, x1, base, hMin, hMax, wMin, wMax, env(u),
	// body, cell (window pitch), lit (share of windows lit), pal, rim / rimA / rimSide (the sun-lit edge), heroes
	// [[u, width, height, kind]], tint(colour, y) (what the haze painted afterwards will do to a colour), tw (list to fill
	// with windows that may switch later), twP, twMax, tips (list to fill with mast tops). g takes the buildings, lc the lights.
	function skyline(g, lc, o) {
		var R = K.seeded(o.seed), R2 = K.seeded(o.seed + "t"), x = o.x0, list = [], w, u, i, palCss = o.pal.map(function (c) { return css(c); });
		function block(x, w, h, kind) {
			var top = o.base - h, bc = mul(o.body, 0.82 + 0.36 * R()), shaft = top, cx = x + w / 2, n, j, sh, tw, y, wx, cw = o.cell, ch = o.cell * 1.4;
			var zone = 0, zoneOn = 0, st, ci, a, wall, litK = o.lit * (0.3 + 1.4 * R());
			g.fillStyle = css(bc);
			if (kind < 0.5 || h < 60) {
				if (R() < 0.6) { tw = w * (0.2 + R() * 0.3); sh = 4 + R() * 9; g.fillRect(x + (w - tw) * R(), top - sh, tw, sh + 1); }
				if (R() < 0.3) { g.fillRect(x + w * (0.2 + R() * 0.6), top - 14 - R() * 22, 1.3, 40); }
			} else if (kind < 0.72) {
				n = 2 + Math.floor(R() * 2); y = top;
				for (j = 0; j < n; j++) { sh = 8 + R() * 18; tw = w * (0.4 + 0.6 * (j + 1) / (n + 1)); g.fillRect(cx - tw / 2, y, tw, sh + 1); y += sh; }
				shaft = y;
				if (R() < 0.5) { g.fillRect(cx - 0.7, top - 20 - R() * 30, 1.4, 60); }
			} else if (kind < 0.84) {
				// a stepped crown and a needle
				tw = w * 0.34; y = top + h * 0.2;
				g.fillRect(cx - tw / 2, top + h * 0.08, tw, h * 0.13); g.fillRect(cx - w * 0.33, y, w * 0.66, h * 0.1 + 1);
				g.beginPath(); g.moveTo(cx - tw / 2, top + h * 0.08 + 1); g.lineTo(cx, top - h * 0.02); g.lineTo(cx + tw / 2, top + h * 0.08 + 1); g.fill();
				g.fillRect(cx - 0.8, top - h * 0.2, 1.6, h * 0.24);
				shaft = y + h * 0.1;
				if (o.tips) { o.tips.push([cx, top - h * 0.2]); }
			} else if (kind < 0.93) {
				sh = w * (0.3 + R() * 0.4); n = R() < 0.5; shaft = top + sh;
				g.beginPath(); g.moveTo(x, shaft + 1); g.lineTo(x, top + (n ? sh : 0)); g.lineTo(x + w, top + (n ? 0 : sh)); g.lineTo(x + w, shaft + 1); g.fill();
			} else {
				sh = w * 0.5; shaft = top + sh;
				g.beginPath(); g.moveTo(x, shaft + 1); g.bezierCurveTo(x, top - sh * 0.3, x + w, top - sh * 0.3, x + w, shaft + 1); g.fill();
			}
			g.fillRect(x, shaft, w, o.base - shaft + 2);
			if (o.rim) { g.fillStyle = css(o.rim, o.rimA); g.fillRect(o.rimSide < 0 ? x : x + w - 1.5, shaft, 1.5, o.base - shaft); }
			for (y = shaft + ch * 0.6; y + ch * 0.5 < o.base - 2; y += ch) {
				if (zone <= 0) { zone = 2 + Math.floor(R() * 9); zoneOn = R() < 0.25 ? 0.02 : litK * (0.3 + 1.4 * R() * R()); }
				zone--;
				st = R() < zoneOn;
				for (wx = x + cw * 0.4; wx + cw * 0.5 < x + w - cw * 0.2; wx += cw) {
					if (R() < 0.4) { st = R() < zoneOn; } else { R(); }
					ci = R() < 0.8 ? 0 : Math.floor(R() * o.pal.length); a = 0.45 + 0.55 * R();
					if (st) { lc.fillStyle = palCss[ci]; lc.globalAlpha = a; lc.fillRect(wx, y, cw * 0.52, ch * 0.5); }
					if (o.tw && o.tw.length < o.twMax && R2() < (st ? o.twP : o.twP * 0.6)) {
						wall = o.tint ? o.tint(bc, y) : bc;
						o.tw.push({ x: wx, y: y, w: cw * 0.52, h: ch * 0.5, lit: st, on: css(mx(wall, o.pal[ci], a)), off: css(wall) });
					}
				}
			}
			lc.globalAlpha = 1;
		}
		while (x < o.x1) {
			w = o.wMin + R() * (o.wMax - o.wMin); u = (x + w / 2) / o.W;
			list.push([x, w, o.hMin + (o.hMax - o.hMin) * o.env(u) * (0.3 + 0.7 * R() * R()), R()]);
			x += w * (0.62 + R() * 0.5);
		}
		(o.heroes || []).forEach(function (q) { list.push([q[0] * o.W - q[1] / 2, q[1], q[2], q[3]]); });
		for (i = 0; i < list.length; i++) { block(list[i][0], list[i][1], list[i][2], list[i][3]); }
	}
	// A suspension bridge seen side-on: two towers, the hanging cables, a deck with a slight rise. o: x0, x1, deck, rise,
	// t1, t2 (tower positions), th (tower height above the deck), water (y of the waterline), col, lamp, tips (list to fill).
	function bridgeDeck(o, x) { return o.deck - o.rise * Math.sin(Math.PI * K.clamp((x - o.x0) / (o.x1 - o.x0), 0, 1)); }
	function bridge(g, lc, o) {
		var x, y, top1 = bridgeDeck(o, o.t1) - o.th, top2 = bridgeDeck(o, o.t2) - o.th, low = bridgeDeck(o, (o.t1 + o.t2) / 2) - 9;
		function cab(x) {
			var t;
			if (x <= o.t1) { t = (x - o.x0) / (o.t1 - o.x0); return o.deck - 3 + (top1 - o.deck + 3) * t * t; }
			if (x >= o.t2) { t = (o.x1 - x) / (o.x1 - o.t2); return o.deck - 3 + (top2 - o.deck + 3) * t * t; }
			t = 2 * (x - o.t1) / (o.t2 - o.t1) - 1;
			return low + ((top1 + top2) / 2 - low) * t * t;
		}
		g.fillStyle = css(o.col); g.strokeStyle = css(o.col); g.lineJoin = "round";
		g.beginPath(); g.moveTo(o.x0, bridgeDeck(o, o.x0));
		for (x = o.x0; x <= o.x1; x += 16) { g.lineTo(x, bridgeDeck(o, x)); }
		g.lineTo(o.x1, bridgeDeck(o, o.x1));
		for (x = o.x1; x >= o.x0; x -= 16) { g.lineTo(x, bridgeDeck(o, x) + 5); }
		g.closePath(); g.fill();
		// the truss under the deck
		g.lineWidth = 1; g.beginPath();
		for (x = o.x0; x < o.x1; x += 12) { g.moveTo(x, bridgeDeck(o, x) + 5); g.lineTo(x + 6, bridgeDeck(o, x + 6) + 13); g.lineTo(x + 12, bridgeDeck(o, x + 12) + 5); }
		g.moveTo(o.x0, bridgeDeck(o, o.x0) + 13);
		for (x = o.x0; x <= o.x1; x += 16) { g.lineTo(x, bridgeDeck(o, x) + 13); }
		g.stroke();
		[o.t1, o.t2].forEach(function (tx) {
			var d = bridgeDeck(o, tx), tp = d - o.th, j;
			g.fillRect(tx - 14, tp, 6, o.water - tp + 4); g.fillRect(tx + 8, tp, 6, o.water - tp + 4);
			g.fillRect(tx - 16, tp - 4, 10, 5); g.fillRect(tx + 6, tp - 4, 10, 5);
			for (j = 0; j < 4; j++) { g.fillRect(tx - 14, tp + 9 + j * (o.th - 14) / 4, 28, j === 0 ? 6 : 3.4); }
			g.lineWidth = 1.1; g.beginPath();
			for (j = 0; j < 3; j++) { y = tp + 15 + j * (o.th - 14) / 4; g.moveTo(tx - 9, y); g.lineTo(tx + 9, y + (o.th - 14) / 4 - 8); g.moveTo(tx + 9, y); g.lineTo(tx - 9, y + (o.th - 14) / 4 - 8); }
			g.stroke();
			g.fillRect(tx - 19, d + 13, 38, o.water - d - 9);
			if (o.tips) { o.tips.push([tx - 11, tp - 5]); o.tips.push([tx + 11, tp - 5]); }
		});
		// viaduct legs on the side spans
		for (x = o.t2 + 80; x < o.x1 - 20; x += 80) { g.fillRect(x - 3, bridgeDeck(o, x) + 5, 6, o.water - bridgeDeck(o, x)); }
		for (x = o.t1 - 80; x > o.x0; x -= 80) { g.fillRect(x - 3, bridgeDeck(o, x) + 5, 6, o.water - bridgeDeck(o, x)); }
		g.lineWidth = 2.3; g.beginPath(); g.moveTo(o.x0, cab(o.x0));
		for (x = o.x0; x <= o.x1; x += 6) { g.lineTo(x, cab(x)); }
		g.stroke();
		g.lineWidth = 0.9; g.beginPath();
		for (x = o.x0 + 6; x < o.x1 - 4; x += 12) { y = cab(x); if (bridgeDeck(o, x) - y > 3) { g.moveTo(x, y); g.lineTo(x, bridgeDeck(o, x)); } }
		g.stroke();
		lc.fillStyle = css(o.lamp);
		for (x = o.x0 + 10; x < o.x1; x += 28) { lc.fillRect(x - 0.9, bridgeDeck(o, x) - 4.6, 1.9, 1.9); }
	}

	// ================================================================ 2. skyline across the bay at sunset
	function startSunset(host, o) {
		var S = settings(o), sc = scene(host, { fps: 30, quality: S.quality, maxPixels: FULL_HD });
		var tod = S.time || "sunset", night = tod === "night", dusk = tod === "dusk", golden = tod === "golden", dawn = tod === "dawn";
		var rainy = S.weather === "rain", foggy = S.weather === "fog", snowy = S.weather === "snow";
		var c1 = rgb(S.c1), c2 = rgb(S.c2), c3 = rgb(S.c3), WHITE = [255, 255, 255], HZ = 650, CH0 = 400, T = Math.random() * 300, twAcc = 0, i;
		var flip = S.layout === "split", sunU = 0.27, sunUp = !dusk, sunR = night ? 30 : 46;
		var sunY = golden ? HZ - 236 : dusk ? HZ + 70 : night ? 170 : HZ - 62;
		var litK = night ? 0.62 : dusk ? 0.55 : golden ? 0.1 : dawn ? 0.2 : 0.3, dim = rainy ? 0.72 : foggy ? 0.9 : 1, rimK = night ? 0.25 : dusk ? 0.4 : 1;
		var sunC = night ? mx(c3, WHITE, 0.4) : c3, far = mx(mul(c1, 0.62), c2, 0.26), near = mx(mul(c1, 0.3), c2, 0.07), hazeC = mx(c2, c3, 0.3);
		var pal = [WIN_WARM, WIN_AMBER, mx(WIN_WARM, WHITE, 0.4), WIN_COOL], tips = [], tw = [], cityCtx = null, B = null;
		var litC = mul(mx(mx(c3, c2, dusk ? 0.75 : 0.45), WHITE, 0.14), night ? 0.5 : dusk ? 0.8 : 1), shadeC = mx(dusk || night ? mx(c1, c2, 0.25) : hueMix(c1, c2, 0.36), mul(c1, 0.8), 0.4), rimC = mul(mx(c3, WHITE, 0.5), night ? 0.6 : 1);
		var clouds = [
			{ tex: cloudTex(7, 512, 128, 6, 3, golden ? 0.42 : 0.52, 0.11, mx(litC, WHITE, 0.2), mx(shadeC, hueMix(c1, c2, 0.62), 0.55), rimC, 0.7), y: 20, h: 300, bw: 3000, sp: 3 },
			{ tex: cloudTex(19, 640, 160, 6, 3, rainy ? 0.8 : 0.6, 0.07, litC, shadeC, rimC, 0.96), y: 180, h: 340, bw: 2600, sp: 8 },
			{ tex: cloudTex(31, 512, 96, 5, 2, 0.4, 0.06, mx(c3, c2, 0.25), mx(shadeC, c2, 0.4), rimC, 0.85), y: 440, h: 140, bw: 2400, sp: 2 }
		];
		var ripple = rippleTex("bayrip", mx(mx(c2, c3, 0.5), WHITE, 0.25), mul(c1, 0.45));
		var glitter = makeGlitter(Math.round(80 * S.detail), mx(sunC, WHITE, 0.2));
		var birds = makeBirds(Math.max(3, Math.round(7 * S.detail)), css(mul(c1, 0.3)), { y0: 150, y1: 430, size: 11, speed: 62, gap: 34 / S.detail, first: 3 });
		var plane = makePlane(mx(mx(c3, c2, 0.3), WHITE, 0.4), dusk || night);
		var carW = K.glow("#fff0c8", 24, 0.35), carR = K.glow("#ff4a3a", 24, 0.35), tipSpr = K.glow("#ff3b3b", 40, 0.3), nCars = Math.max(4, Math.round(16 * S.detail)), carOff = new Float32Array(nCars * 2);
		var mist = foggy || dawn ? [fogTex(61, mx(hazeC, WHITE, 0.45), 384, 96, 5, 2, 0.3, 0.78), fogTex(67, mx(hazeC, WHITE, 0.3), 384, 96, 4, 2, 0.32, 0.8)] : null;
		var rain = rainy ? makeRain(S.detail, [220, 228, 245]) : null, snow = snowy ? makeSnow(S.detail, [255, 255, 255]) : null;
		for (i = 0; i < nCars * 2; i++) { carOff[i] = Math.random(); }
		// a small sailing boat with its reflection, drawn once
		var boat = K.bake(160, 210, function (g) {
			function draw(al, sail) {
				g.globalAlpha = al;
				g.fillStyle = css(mul(near, 0.8)); g.beginPath(); g.moveTo(22, 108); g.lineTo(138, 108); g.lineTo(126, 122); g.lineTo(38, 122); g.closePath(); g.fill();
				g.fillRect(79, 12, 2.6, 98);
				g.fillStyle = css(sail); g.beginPath(); g.moveTo(84, 16); g.lineTo(84, 102); g.lineTo(130, 102); g.closePath(); g.fill();
				g.fillStyle = css(mul(sail, 0.82)); g.beginPath(); g.moveTo(76, 28); g.lineTo(76, 102); g.lineTo(38, 102); g.closePath(); g.fill();
			}
			draw(1, mx(mx(c2, c3, 0.5), near, night ? 0.6 : 0.25));
			g.translate(0, 122 + 122 * 0.7); g.scale(1, -0.7);
			draw(0.3, mul(near, 0.9));
		});

		var plainK = dusk ? 0.8 : night ? 1 : 0;
		function band(t) { var v = hueMix(c1, c2, t); return plainK ? mx(v, mx(c1, c2, t), plainK) : v; }
		function envFar(u) { var d = (u - 0.74) / 0.27; return 0.12 + 0.88 * Math.exp(-d * d); }
		function envNear(u) { var d = (u - 0.72) / 0.17, e = (u - 0.95) / 0.06; return Math.exp(-d * d) + 0.3 * Math.exp(-e * e) + 0.05; }
		function sky() {
			return sc.layer("sky", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, HZ), sx = sunU * W, r, R = K.seeded("baysky"), j, y;
				skyBands(gr, c1, c2, c3, 0.8, sunUp && !night ? 0.45 : 0.12, plainK);
				g.fillStyle = gr; g.fillRect(0, 0, W, h);
				if (dusk || night) {
					for (j = 0; j < (night ? 260 : 120); j++) {
						y = R() * R() * (HZ - 120);
						g.fillStyle = css(WHITE, (0.25 + R() * 0.7) * (1 - y / (HZ - 60))); r = R() < 0.12 ? 1.7 : 1; g.fillRect(R() * W, y, r, r);
					}
				}
				// the glow round the sun, wider than it is tall
				g.save(); g.translate(sx, Math.min(sunY, HZ + 10)); g.scale(1.75, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 440);
				r.addColorStop(0, css(mx(sunC, WHITE, 0.35), night ? 0.28 : 0.92 * dim)); r.addColorStop(0.17, css(sunC, night ? 0.12 : 0.56 * dim));
				r.addColorStop(0.5, css(mx(sunC, c2, 0.6), night ? 0.04 : 0.2 * dim)); r.addColorStop(1, css(c2, 0));
				g.fillStyle = r; g.fillRect(-460, -460, 920, 920); g.restore();
				if (sunUp) {
					r = g.createRadialGradient(sx, sunY, 0, sx, sunY, sunR);
					r.addColorStop(0, css(mx(sunC, WHITE, 0.94))); r.addColorStop(0.8, css(mx(sunC, WHITE, 0.72))); r.addColorStop(0.95, css(mx(sunC, WHITE, 0.4))); r.addColorStop(1, css(sunC, 0));
					g.fillStyle = r; g.beginPath(); g.arc(sx, sunY, sunR, 0, TAU); g.fill();
					if (!night) {
						// redder toward its lower edge, as a sun near the horizon is
						g.save(); g.beginPath(); g.arc(sx, sunY, sunR * 0.97, 0, TAU); g.clip();
						r = g.createLinearGradient(0, sunY - sunR, 0, sunY + sunR); r.addColorStop(0.3, css(c2, 0)); r.addColorStop(1, css(mx(c2, c3, 0.25), golden ? 0.15 : 0.6));
						g.fillStyle = r; g.fillRect(sx - sunR, sunY - sunR, sunR * 2, sunR * 2); g.restore();
					} else {
						g.fillStyle = css(mul(c1, 1.4), 0.1);
						g.beginPath(); g.arc(sx - 9, sunY - 6, 8, 0, TAU); g.arc(sx + 8, sunY + 7, 6, 0, TAU); g.arc(sx + 6, sunY - 12, 4, 0, TAU); g.fill();
					}
				}
				grain(g, W, h, 0.03);
			}, sc.W, snap(sc, HZ + 2));
		}
		function city() {
			return sc.layer("city", function (g, W, h) {
				var lc = lightCanvas(g, W, h), base = CH0, sx = sunU * W, x, r, span = Math.max(120, 0.28 * W);
				var hz1 = { col: hazeC, a0: 0.1, a1: 0.5, y0: base - 230, y1: base }, hz2 = { col: hazeC, a0: 0, a1: 0.2, y0: base - 170, y1: base };
				tips = []; tw = []; cityCtx = g;
				// far hills across the water, pale
				g.fillStyle = css(mx(far, hazeC, 0.4));
				g.beginPath(); g.moveTo(0, base + 2);
				for (x = 0; x <= W + 16; x += 16) { g.lineTo(x, base - 12 - 58 * fbm(x / 260, 0.3, 64, 5, 3) * (1 - K.smooth(0.2 * W, 0.62 * W, x))); }
				g.lineTo(W + 16, base + 2); g.fill();
				skyline(g, lc, {
					seed: "bayfar2", W: W, x0: 0.36 * W, x1: W + 40, base: base, hMin: 12, hMax: 205, wMin: 14, wMax: 34, env: envFar, body: far, cell: 3.6, lit: litK * 0.8, pal: pal,
					rim: sunC, rimA: 0.3 * rimK, rimSide: -1, tips: null, tw: tw, twP: 0.06, twMax: 320, tint: function (c, y) { return hazeTint(hazeTint(c, hz1, y), hz2, y); }
				});
				hazeFill(g, hz1, W, h);
				// the deck always runs on past the second tower, however narrow the picture (its end is hidden behind the city)
				B = { x0: -60, x1: Math.max(0.52 * W, 0.12 * W + span + 60), deck: base - 44, rise: 7, t1: 0.12 * W, t2: 0.12 * W + span, th: Math.min(168, span * 0.31), water: base, col: mx(near, c2, 0.1), lamp: WIN_WARM, tips: tips };
				bridge(g, lc, B);
				skyline(g, lc, {
					seed: "baynear3", W: W, x0: 0.5 * W, x1: W + 40, base: base, hMin: 16, hMax: 240, wMin: 20, wMax: 46, env: envNear, body: near, cell: 4.6, lit: litK, pal: pal,
					rim: sunC, rimA: 0.5 * rimK, rimSide: -1, tips: tips, tw: tw, twP: 0.07, twMax: 620, tint: function (c, y) { return hazeTint(c, hz2, y); },
					heroes: [[0.7, 46, 318, 0.8], [0.775, 40, 252, 0.9], [0.64, 44, 216, 0.6], [0.875, 36, 184, 0.95]]
				});
				// the quay, then distance haze over everything and the sun's light wrapping round what stands in front of it
				g.fillStyle = css(mul(near, 0.8)); g.fillRect(0.47 * W, base - 6, W, 10);
				hazeFill(g, hz2, W, h);
				if (sunUp && !night) {
					r = g.createRadialGradient(sx, sunY - (HZ - CH0), 0, sx, sunY - (HZ - CH0), 300);
					r.addColorStop(0, css(mx(sunC, WHITE, 0.3), 0.75)); r.addColorStop(0.3, css(sunC, 0.3)); r.addColorStop(1, css(sunC, 0));
					g.globalCompositeOperation = "source-atop"; g.fillStyle = r; g.fillRect(0, 0, W, h); g.globalCompositeOperation = "source-over";
				}
				g.drawImage(lc.canvas, 0, 0, W, h);
				bloom(g, lc.canvas, W, h, night || dusk ? 1 : 0.7);
			}, sc.W, snap(sc, CH0 + 8));
		}
		function refl() {
			var C = city();
			// a little wider than the picture, so its edges never show as the slices slide
			return sc.layer("refl", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, h), W0 = sc.W, ch = C.hu;
				soft(g, sc.k, 0, 0, W, h, 4, function (c) {
					c.translate(RM, 0); c.scale(1, -1.2); c.drawImage(C, 0, -CH0, W0, ch);
					c.drawImage(C, 0, 0, 2, C.height, -RM, -CH0, RM + 0.5, ch); c.drawImage(C, C.width - 2, 0, 2, C.height, W0 - 0.5, -CH0, RM + 0.5, ch);
				});
				g.globalCompositeOperation = "source-atop"; g.fillStyle = css(mul(c1, 0.5), 0.3); g.fillRect(0, 0, W, h);
				gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.4, "rgba(0,0,0,0.5)"); gr.addColorStop(0.85, "rgba(0,0,0,0.08)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				g.globalCompositeOperation = "destination-in"; g.fillStyle = gr; g.fillRect(0, 0, W, h); g.globalCompositeOperation = "source-over";
			}, snap(sc, sc.W + 2 * RM), snap(sc, 420));
		}
		function water() {
			return sc.layer("water", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, h), sx = sunU * W, k = 0.82 * dim;
				gr.addColorStop(0, css(mul(mx(mx(c2, c3, sunUp && !night ? 0.3 : 0.05), c1, 0.12), k))); gr.addColorStop(0.1, css(mul(mx(c2, c1, 0.1), k * 0.95)));
				gr.addColorStop(0.3, css(mul(band(0.72), k * 0.9))); gr.addColorStop(0.58, css(mul(band(0.44), k * 0.82))); gr.addColorStop(1, css(mul(band(0.14), k * 0.7)));
				g.fillStyle = gr; g.fillRect(0, 0, W, h);
				// the sun's road on the water: a soft column that widens toward the viewer
				if (sunUp) { lightRoad(g, sc.k, W, h, sx, mx(sunC, WHITE, 0.25), 60, 250, (night ? 0.4 : 0.85) * dim, 0.16 * dim); }
				grain(g, W, h, 0.03);
			}, sc.W, snap(sc, 1080 - HZ));
		}
		// old pier posts standing in the water, near to us
		var POSTS = [[70, 96, 196, 20], [162, 44, 214, 24], [232, 118, 206, 18], [338, 70, 232, 24], [404, 138, 222, 19]];
		function postScale() { return Math.min(1, Math.max(0.5, sc.W / 1500)); }
		function posts() {
			var ks = postScale();
			return sc.layer("posts", function (g, w, h) {
				var body = mul(near, 0.62), rim = mx(sunC, c2, 0.4), j, p, x, top, wy, pw;
				g.scale(ks, ks);
				// the last plank of the pier, between two posts
				g.fillStyle = css(mul(body, 0.9)); g.fillRect(162, 108, 82, 9); g.fillStyle = css(rim, 0.5 * rimK); g.fillRect(162, 108, 82, 1.6);
				for (j = 0; j < POSTS.length; j++) {
					p = POSTS[j]; x = p[0]; top = p[1]; wy = p[2]; pw = p[3];
					g.fillStyle = css(body); g.beginPath(); g.moveTo(x - pw / 2, wy); g.lineTo(x - pw * 0.44, top); g.lineTo(x + pw * 0.44, top); g.lineTo(x + pw / 2, wy); g.closePath(); g.fill();
					g.fillStyle = css(rim, 0.62 * rimK); g.beginPath(); g.moveTo(x - pw / 2, wy); g.lineTo(x - pw * 0.44, top); g.lineTo(x - pw * 0.44 + 3.2, top); g.lineTo(x - pw / 2 + 3.6, wy); g.closePath(); g.fill();
					g.fillStyle = css(mx(body, rim, 0.3)); g.beginPath(); g.ellipse(x, top, pw * 0.44, 3.2, 0, 0, TAU); g.fill();
					g.strokeStyle = css(mx(sunC, WHITE, 0.3), 0.4); g.lineWidth = 1.3; g.beginPath(); g.ellipse(x, wy, pw * 0.9, 3.4, 0, 0, TAU); g.stroke();
				}
				// a gull resting on the tallest post
				p = POSTS[1]; g.fillStyle = css(mul(body, 0.8));
				g.beginPath(); g.ellipse(p[0] - 1, p[1] - 9, 11, 6, -0.15, 0, TAU); g.fill();
				g.beginPath(); g.arc(p[0] + 9, p[1] - 15, 4, 0, TAU); g.fill();
				g.beginPath(); g.moveTo(p[0] + 12, p[1] - 16); g.lineTo(p[0] + 19, p[1] - 14); g.lineTo(p[0] + 12, p[1] - 13); g.fill();
				g.beginPath(); g.moveTo(p[0] - 10, p[1] - 10); g.lineTo(p[0] - 21, p[1] - 6); g.lineTo(p[0] - 8, p[1] - 5); g.fill();
				g.fillRect(p[0] - 1, p[1] - 4, 1.4, 5); g.fillRect(p[0] + 3, p[1] - 4, 1.4, 5);
			}, snap(sc, 470 * ks), snap(sc, 240 * ks));
		}
		function postsRefl() {
			var ks = postScale();
			return sc.layer("postsR", function (g, w, h) {
				soft(g, sc.k, 0, 0, w, h, 2, function (c) {
					var j, p, gr;
					c.scale(ks, ks);
					for (j = 0; j < POSTS.length; j++) {
						p = POSTS[j];
						gr = c.createLinearGradient(0, p[2] - 190, 0, p[2] - 190 + (p[2] - p[1]) * 0.9);
						gr.addColorStop(0, css(mul(near, 0.5), 0.72)); gr.addColorStop(1, css(mul(near, 0.5), 0));
						c.fillStyle = gr; c.fillRect(p[0] - p[3] / 2, p[2] - 190, p[3], (p[2] - p[1]) * 0.9);
					}
				});
			}, snap(sc, 470 * ks), snap(sc, 190 * ks));
		}
		function toggle() {
			var w, tries = 0;
			if (!cityCtx || !tw.length) { return; }
			// more go on than off, so the city lights up as the evening draws in
			do { w = tw[(Math.random() * tw.length) | 0]; tries++; } while (tries < 3 && w.lit && Math.random() < 0.7);
			w.lit = !w.lit;
			cityCtx.fillStyle = w.lit ? w.on : w.off;
			cityCtx.fillRect(w.x, w.y, w.w, w.h);
		}

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, j, L, C, x, y, a, sx = sunU * W, ks, px, py;
			T += dt * S.speed;
			slide(sc, g, 50);
			if (flip) { g.translate(W, 0); g.scale(-1, 1); }
			put(g, sky(), k, 0, 0);
			for (j = 0; j < 3; j++) { C = clouds[j]; drift(sc, g, "cl" + j, C.tex, T * C.sp, C.y, C.bw, C.h); }
			plane(g, W, dt * S.speed, 60, 300);
			birds(g, W, dt * S.speed);
			put(g, water(), k, 0, HZ);
			wobble(sc, g, refl(), -RM, HZ, T, 1.5, 11, 1.25, flip);
			g.globalAlpha = 0.75; drift(sc, g, "d4", ripple, T * 5, HZ + 3, 900, 58);
			g.globalAlpha = 0.7; drift(sc, g, "d5", ripple, T * -9 + 300, HZ + 60, 1500, 132);
			g.globalAlpha = 0.6; drift(sc, g, "d6", ripple, T * 16 + 700, HZ + 190, 2500, 1080 - HZ - 190);
			g.globalAlpha = 1;
			if (sunUp) { glitter(g, sx, HZ + 4, 1076, dt * S.speed, 34, 230, (night ? 0.5 : 0.95) * dim); }
			L = city();
			put(g, L, k, 0, HZ - CH0);
			// traffic on the bridge, and the warning lights on the towers and masts
			g.globalCompositeOperation = "lighter";
			if (B) {
				a = B.x1 - B.x0;
				for (j = 0; j < nCars; j++) {
					x = B.x0 + ((carOff[j] + T * 17 / a) % 1) * a; g.drawImage(carW, x - 3.5, bridgeDeck(B, x) + (HZ - CH0) - 6.4, 7, 7);
					x = B.x0 + ((((carOff[nCars + j] - T * 14 / a) % 1) + 1) % 1) * a; g.drawImage(carR, x - 3, bridgeDeck(B, x) + (HZ - CH0) - 5.6, 6, 6);
				}
			}
			for (j = 0; j < tips.length; j++) {
				a = Math.sin(T * 1.7 + j * 1.3); a = a > 0 ? a * a : 0;
				if (a > 0.02) { g.globalAlpha = a; g.drawImage(tipSpr, tips[j][0] - 7, tips[j][1] + (HZ - CH0) - 7, 14, 14); }
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			// the boat slides along the far water
			x = W + 80 - ((T * 6.5) % (W + 220)); y = HZ + 16 + Math.sin(T * 1.1) * 1.1;
			g.drawImage(boat, x, y - 49, 64, 84);
			if (mist) {
				g.globalAlpha = foggy ? 0.85 : 0.5; drift(sc, g, "d7", mist[0], T * 9, HZ - 110, 2400, 190);
				g.globalAlpha = foggy ? 0.7 : 0.35; drift(sc, g, "d8", mist[1], T * -6 + 500, HZ - 20, 2800, 240);
				if (foggy) { g.globalAlpha = 0.5; drift(sc, g, "d9", mist[0], T * 14 + 900, HZ - 330, 3200, 420); }
				g.globalAlpha = 1;
			}
			ks = postScale(); px = W - 500 * ks; py = 1080 - 345 * ks;
			wobble(sc, g, postsRefl(), px, py + 190 * ks, T, 1.5, 6, 1.5, flip);
			put(g, posts(), k, px, py);
			twAcc += dt * 3.2 * S.detail * S.speed;
			while (twAcc >= 1) { twAcc -= 1; toggle(); }
			if (rain) { rain(g, W, 1080, dt * S.speed, 0.16, 0.9); }
			if (snow) { snow(g, W, 1080, dt * S.speed, 0.015, 1); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "city-sunset", label: "City: skyline across the bay at sunset", colors: ["26306f", "ff8a3d", "ffd98a"], start: startSunset });

	// ================================================================ 3. rainy street at night, at eye level
	// An out-of-focus point of light: a flat disc with a brighter edge.
	function bokehSprite(col) {
		return K.bake(96, 96, function (g, w) {
			var r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
			r.addColorStop(0, css(col, 0.5)); r.addColorStop(0.74, css(col, 0.56)); r.addColorStop(0.88, css(mx(col, [255, 255, 255], 0.3), 0.9)); r.addColorStop(1, css(col, 0));
			g.fillStyle = r; g.fillRect(0, 0, w, w);
		});
	}
	// The long smear a light leaves on a wet road: bright under the light, fading toward the viewer, soft at the sides.
	function streakSprite(col) {
		return K.bake(32, 192, function (g, w, h) {
			var img = g.createImageData(w, h), d = img.data, x, y, i = 0, v, dx, a;
			for (y = 0; y < h; y++) {
				v = (y + 0.5) / h; a = K.smooth(0, 0.07, v) * Math.pow(1 - v, 1.6);
				for (x = 0; x < w; x++) { dx = (x + 0.5 - w / 2) / (w * 0.3); d[i++] = col[0]; d[i++] = col[1]; d[i++] = col[2]; d[i++] = Math.round(255 * a * Math.exp(-dx * dx)); }
			}
			g.putImageData(img, 0, 0);
		});
	}
	function startRain(host, o) {
		var S = settings(o), sc = scene(host, { fps: 30, quality: S.quality, maxPixels: FULL_HD });
		var wx = S.weather || "rain", raining = wx === "rain", snowing = wx === "snow", foggy = wx === "fog";
		var c1 = rgb(S.c1), c2 = rgb(S.c2), c3 = rgb(S.c3), WHITE = [255, 255, 255], AMBER = [255, 190, 96];
		// the view: VY is eye level on the picture, E the drop from there to the road at depth 1, M one metre at depth 1,
		// ZM one metre along the street in depth units, XW the walls and XC the kerbs (to each side of the middle)
		var VY = 548, E = 640, M = 400, ZM = 0.385, XW = 6.2 * M, XC = 4 * M, vx = 960, T = Math.random() * 200, i;
		var glowC = mx(mx(c2, AMBER, 0.45), WHITE, 0.14), hazeC = mx(mx(mul(c1, 1.5), glowC, 0.3), [110, 122, 150], 0.14), wallC = mx(mul(c1, 0.6), [7, 8, 12], 0.3);
		// Snow lies pale on everything and throws the light about: cooler, lighter air, paler walls, softer reflections.
		var SNOWC = mx([232, 240, 255], c1, 0.1);
		if (snowing) { glowC = mx(glowC, [214, 226, 255], 0.4); hazeC = mx(hazeC, [150, 166, 204], 0.35); wallC = mx(wallC, [58, 68, 96], 0.25); }
		var lampC = [255, 196, 120], signs = [c2, c3, tune(c2, -36, 1, 1.05), AMBER, tune(c3, -52, 0.9, 1), mx(c3, WHITE, 0.6)], dark = mul(wallC, 0.4);
		var REFL = [], lamp = { x: 0, y: 0, gy: 0, s: 1 }, sig = { x: 0, y: 0, gy: 0, s: 1 }, grate = { x: 0, y: 0, s: 1 }, walkY = 0, walkS = 1;
		var skyTex = fogTex(71, mx(hazeC, glowC, 0.35), 256, 96, 4, 2, 0.34, 0.8), mistTex = fogTex(83, mx(hazeC, WHITE, 0.25), 384, 96, 5, 2, 0.3, 0.8);
		var bok = [bokehSprite([255, 240, 214]), bokehSprite([255, 76, 64]), bokehSprite(mx(c2, WHITE, 0.2)), bokehSprite(mx(c3, WHITE, 0.2)), bokehSprite(AMBER)];
		var sigCols = [[60, 240, 150], [255, 196, 70], [255, 62, 52]], sigGlow = sigCols.map(function (c) { return K.glow(css(c), 64, 0.3); }), sigStreak = sigCols.map(streakSprite);
		var cone = beamTex(mx(lampC, WHITE, 0.2)), lampGlow = K.glow(css(lampC), 128, 0.12), ring = K.bake(96, 96, function (g, w) {
			var r = g.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2), c = mx(glowC, WHITE, 0.5);
			r.addColorStop(0, css(c, 0)); r.addColorStop(0.75, css(c, 0.9)); r.addColorStop(1, css(c, 0));
			g.fillStyle = r; g.fillRect(0, 0, w, w);
		});
		var drop = K.bake(6, 48, function (g, w, h) { var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, css(lampC, 0)); gr.addColorStop(1, css(mx(lampC, WHITE, 0.6), 1)); g.fillStyle = gr; g.fillRect(1.5, 0, 3, h); });
		var rain = raining ? makeRain(S.detail, [200, 220, 255]) : null, snow = snowing ? makeSnow(S.detail * 1.2, [255, 255, 255]) : null;
		var NC = Math.max(2, Math.round(5 * S.detail)), carZ = new Float32Array(NC * 2), NR = 18, rings = new Float32Array(NR * 5), ringAcc = 0, ND = 44, drops = new Float32Array(ND * 2);
		var steam = K.particles(36), puff = K.glow(css(mx(hazeC, WHITE, 0.55)), 96, 0.02), steamAcc = 0;
		var walk = { on: false, wait: 5 + Math.random() * 6, x: 0, dir: 1, ph: 0, sp: 150, tint: null };
		for (i = 0; i < NC * 2; i++) { carZ[i] = 13 + Math.random() * 33; }
		for (i = 0; i < NR; i++) { rings[i * 5 + 4] = 0; }
		for (i = 0; i < ND; i++) { drops[i * 2] = Math.random() * 2 - 1; drops[i * 2 + 1] = Math.random(); }
		function sx(X, z) { return vx + X / z; }
		function sy(Y, z) { return VY + (E - Y) / z; }
		function wallQuad(c, sgn, z0, z1, Y0, Y1) {
			c.beginPath(); c.moveTo(sx(sgn * XW, z0), sy(Y0, z0)); c.lineTo(sx(sgn * XW, z1), sy(Y0, z1)); c.lineTo(sx(sgn * XW, z1), sy(Y1, z1)); c.lineTo(sx(sgn * XW, z0), sy(Y1, z0)); c.closePath(); c.fill();
		}
		function groundQuad(c, X0, X1, z0, z1) {
			c.beginPath(); c.moveTo(sx(X0, z0), sy(0, z0)); c.lineTo(sx(X1, z0), sy(0, z0)); c.lineTo(sx(X1, z1), sy(0, z1)); c.lineTo(sx(X0, z1), sy(0, z1)); c.closePath(); c.fill();
		}
		function back() {
			return sc.layer("back", function (g, W, H) {
				var lc = lightCanvas(g, W, H), R = K.seeded("rainstreet9"), gr, j, x, y, z, s, r, top, gy, hx, n;
				vx = W * (S.layout === "split" ? 0.62 : 0.5);
				REFL = [];
				// the sky between the roofs: low cloud lit from the street
				gr = g.createLinearGradient(0, 0, 0, VY + 40);
				gr.addColorStop(0, css(mul(c1, 0.35))); gr.addColorStop(0.55, css(mx(mul(c1, 0.7), hazeC, 0.35))); gr.addColorStop(1, css(mx(hazeC, glowC, 0.45)));
				g.fillStyle = gr; g.fillRect(0, 0, W, H);
				g.globalAlpha = 0.5; g.drawImage(skyTex, vx - 900, -60, 1800, VY + 40); g.globalAlpha = 1;
				// towers far beyond the end of the street, pale in the rain
				for (j = 0; j < 6; j++) {
					z = j < 3 ? 170 : 105; x = sx((R() - 0.5) * 2 * (j < 3 ? 70 : 40) * M, z); s = (13 + R() * 9) * M / z; top = sy((50 + R() * 70) * M, z);
					g.fillStyle = css(mx(mx(hazeC, glowC, 0.42), wallC, j < 3 ? 0.07 : 0.14)); g.fillRect(x - s / 2, top, s, VY - top + 10);
					g.fillRect(x - s * 0.3, top - s * 0.3, s * 0.6, s * 0.3 + 1); g.fillRect(x - 1, top - s * 0.9, 2, s * 0.9);
					for (n = 0; n < 40; n++) { lc.fillStyle = css(WIN_WARM, 0.06 + R() * 0.16); lc.fillRect(x - s / 2 + 2 + Math.floor(R() * (s - 6) / 4) * 4, top + 8 + Math.floor(R() * (VY - top - 20) / 6) * 6, 2, 3); }
				}
				r = g.createRadialGradient(vx, VY - 26, 0, vx, VY - 26, 340);
				r.addColorStop(0, css(mx(glowC, WHITE, 0.25), 0.8)); r.addColorStop(0.3, css(glowC, 0.38)); r.addColorStop(1, css(glowC, 0));
				g.fillStyle = r; g.fillRect(vx - 350, VY - 380, 700, 700);
				// the road: dark and wet, paler into the distance
				gr = g.createLinearGradient(0, VY, 0, H);
				gr.addColorStop(0, css(mx(hazeC, glowC, 0.4))); gr.addColorStop(0.06, css(mx(mul(c1, 0.5), hazeC, 0.4))); gr.addColorStop(0.3, css(mul(c1, 0.36))); gr.addColorStop(1, css(mul(c1, 0.2)));
				g.fillStyle = gr; g.fillRect(0, VY, W, H - VY);
				g.fillStyle = css(mx(c1, hazeC, 0.3), 0.22); groundQuad(g, -XW, -XC, 1.05, 80); groundQuad(g, XC, XW, 1.05, 80);
				g.fillStyle = css(mx(hazeC, WHITE, 0.2), 0.4); groundQuad(g, -XC, -XC + 0.18 * M, 1.05, 80); groundQuad(g, XC - 0.18 * M, XC, 1.05, 80);
				g.fillStyle = css(mul(c1, 0.12), 0.7); groundQuad(g, -XC + 0.18 * M, -XC + 0.5 * M, 1.05, 80); groundQuad(g, XC - 0.5 * M, XC - 0.18 * M, 1.05, 80);
				g.fillStyle = css(mx(AMBER, hazeC, 0.5), 0.3);
				for (z = 2.2; z < 40; z += 6 * ZM) { groundQuad(g, -0.06 * M, 0.06 * M, z, z + 3 * ZM); }
				// a crossing, its paint worn
				g.fillStyle = css(mx(hazeC, WHITE, 0.45), 0.24);
				for (x = -3.3; x < 3.2; x += 0.95) { groundQuad(g, x * M, (x + 0.5) * M, 3.02, 3.95); }
				walkS = M / 3.45; walkY = sy(0, 3.45);
				if (snowing) {
					// snow lying on the pavements, banked along the kerbs, slush at the road's edges and a dusting down the middle;
					// the wheel tracks stay dark and wet
					gr = g.createLinearGradient(0, VY, 0, VY + 150);
					gr.addColorStop(0, css(mx(SNOWC, hazeC, 0.6), 0.5)); gr.addColorStop(1, css(SNOWC, 0.72));
					g.fillStyle = gr; groundQuad(g, -XW, -XC + 0.2 * M, 1.05, 80); groundQuad(g, XC - 0.2 * M, XW, 1.05, 80);
					// the banks: three bands laid over each other so their edges are soft, then heaps and hollows along them
					for (j = 0; j < 3; j++) {
						gr = g.createLinearGradient(0, VY, 0, VY + 150);
						gr.addColorStop(0, css(mx(SNOWC, hazeC, 0.5), 0.3)); gr.addColorStop(1, css(SNOWC, 0.4 + j * 0.12));
						g.fillStyle = gr; s = (1.25 - j * 0.38) * M;
						groundQuad(g, -XC - 0.5 * M, -XC + s, 1.05, 80); groundQuad(g, XC - s, XC + 0.5 * M, 1.05, 80);
					}
					r = K.seeded("streetsnow");
					for (j = 0; j < 90; j++) {
						z = 1.15 + r() * r() * 26; n = r() < 0.5 ? -1 : 1; s = Math.min(105, (0.35 + r() * 0.7) * M / z);
						x = sx(n * (XC - (0.1 + r() * 1.3) * M), z); y = sy(0, z);
						g.fillStyle = css(mx(SNOWC, hazeC, (1 - Math.exp(-z / 26)) * 0.6), 0.5 + r() * 0.4);
						g.beginPath(); g.ellipse(x, y, s * (1.2 + r()), s * 0.2, 0, 0, TAU); g.fill();
					}
					for (j = 0; j < 24; j++) {
						z = 1.6 + r() * r() * 16; n = r() < 0.5 ? -1 : 1; s = Math.min(70, (0.25 + r() * 0.5) * M / z);
						x = sx(n * (XC + (0.5 + r() * 1.6) * M), z); y = sy(0, z);
						g.fillStyle = css(mul(SNOWC, 0.6), 0.1 + r() * 0.08);
						g.beginPath(); g.ellipse(x, y, s * (1 + r()), s * 0.2, 0, 0, TAU); g.fill();
					}
					g.fillStyle = css(SNOWC, 0.1); groundQuad(g, -0.5 * M, 0.5 * M, 1.05, 80);
				}
				// puddles: flatter, brighter patches
				for (j = 0; j < 7; j++) {
					z = 1.5 + R() * R() * 9; x = sx((R() - 0.5) * 6.4 * M, z); y = sy(0, z); s = (0.5 + R() * 1.1) * M / z;
					g.fillStyle = css(mx(hazeC, glowC, 0.4), 0.12); g.beginPath(); g.ellipse(x, y, s, s * 0.22, 0, 0, TAU); g.fill();
					g.strokeStyle = css(mx(hazeC, WHITE, 0.3), 0.16); g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, s, s * 0.22, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
				}
				// a grate in the road that steams
				z = 4.7; grate.x = sx(-1.9 * M, z); grate.y = sy(0, z); grate.s = M / z;
				g.fillStyle = css(mul(c1, 0.1)); g.beginPath(); g.ellipse(grate.x, grate.y, 0.42 * grate.s, 0.1 * grate.s, 0, 0, TAU); g.fill();
				// a sign painted flat on a wall, its characters leaning with the wall
				function wallSign(sgn, z0, z1, Y0, Y1, col, fade) {
					var zc, ax, ay, bx, by, cy, n2 = Math.max(1, Math.floor((z1 - z0) / (0.8 * ZM))), step = (z1 - z0) / n2, t = 0.07 * M;
					lc.fillStyle = css(col, 0.22 * fade); wallQuad(lc, sgn, z0, z1, Y0, Y1);
					lc.fillStyle = css(col, 0.9 * fade); wallQuad(lc, sgn, z0, z1, Y1 - t, Y1); wallQuad(lc, sgn, z0, z1, Y0, Y0 + t);
					wallQuad(lc, sgn, z0, z0 + 0.06 * ZM, Y0, Y1); wallQuad(lc, sgn, z1 - 0.06 * ZM, z1, Y0, Y1);
					lc.strokeStyle = css(mx(col, WHITE, 0.6), fade); lc.lineWidth = 1.5; lc.lineCap = "round"; lc.lineJoin = "round";
					for (zc = z0 + step * 0.22; zc + step * 0.56 <= z1; zc += step) {
						ax = sx(sgn * XW, zc); ay = sy(Y1 - 0.2 * M, zc); bx = sx(sgn * XW, zc + step * 0.56); by = sy(Y1 - 0.2 * M, zc + step * 0.56); cy = sy(Y0 + 0.2 * M, zc);
						lc.save(); lc.transform((bx - ax) / 10, (by - ay) / 10, 0, (cy - ay) / 10, ax, ay); glyph(lc, R, 0, 0, 10, 10); lc.restore();
					}
					lc.lineCap = "butt";
				}
				function building(sgn, b) {
					var zm = (b.z0 + b.z1) / 2, hz = 1 - Math.exp(-zm / 26), wc = mx(mul(wallC, 0.7 + 0.7 * b.tone), hazeC, hz * 0.85), f, zc, st, ci, col, q, zs, wm, Y0, Y1, x0, yy, hh, wpx, qa;
					var glass = css(mx(wc, mx(hazeC, c3, 0.25), 0.22)), sill = css(mul(wc, 1.5)), near = zm < 16, lit = zm < 8 ? Math.max(b.lit, 0.22) : b.lit, snowCss = css(mx(SNOWC, hazeC, hz * 0.7));
					g.fillStyle = css(wc); wallQuad(g, sgn, b.z0, b.z1, 0, b.H);
					if (zm < 12) {
						// piers up the wall, and the wash of the street's light across its foot
						g.fillStyle = css(mul(wc, 1.26));
						for (zc = b.z0 + 0.1 * ZM; zc < b.z1 - 0.3 * ZM; zc += 3.5 * ZM) { wallQuad(g, sgn, zc, zc + 0.2 * ZM, 0, b.H - 0.9 * M); }
						gr = g.createLinearGradient(0, sy(4.5 * M, zm), 0, sy(0, zm));
						gr.addColorStop(0, css(glowC, 0)); gr.addColorStop(1, css(mx(glowC, lampC, 0.5), 0.1));
						g.fillStyle = gr; wallQuad(g, sgn, b.z0, b.z1, 0, 4.5 * M);
					}
					g.fillStyle = css(mul(wc, 1.35)); wallQuad(g, sgn, b.z0, b.z1, b.H - 0.45 * M, b.H);
					g.fillStyle = css(mul(wc, 0.72)); wallQuad(g, sgn, b.z0, b.z1, b.H - 0.9 * M, b.H - 0.45 * M);
					g.fillStyle = css(mul(wc, 0.5)); wallQuad(g, sgn, b.z1 - 0.14 * ZM, b.z1, 0, b.H);
					if (snowing) { g.fillStyle = snowCss; wallQuad(g, sgn, b.z0, b.z1, b.H - 0.05 * M, b.H + 0.22 * M); }
					if (zm < 38) {
						for (f = 3.9 * M; f + 2.4 * M < b.H - 1 * M; f += 3.1 * M) {
							if (near) { g.fillStyle = css(mul(wc, 1.2)); wallQuad(g, sgn, b.z0, b.z1 - 0.14 * ZM, f - 0.34 * M, f - 0.22 * M); }
							st = R() < lit;
							for (zc = b.z0 + 0.5 * ZM; zc + 1.1 * ZM < b.z1 - 0.2 * ZM; zc += 1.75 * ZM) {
								if (R() < 0.45) { st = R() < lit; } else { R(); }
								ci = R(); q = R();
								if (st) {
									col = mx(ci < 0.6 ? WIN_WARM : ci < 0.8 ? WIN_AMBER : ci < 0.92 ? WIN_COOL : c3, wc, hz * 0.7);
									lc.fillStyle = css(col, 0.3 + 0.55 * q); wallQuad(lc, sgn, zc, zc + 1.1 * ZM, f + 0.8 * M, f + 2.3 * M);
									if (near) {
										// a blind half down, or a curtain to one side, and the bar of the frame
										lc.fillStyle = css(mul(wc, 0.7), 0.5);
										if (ci < 0.5) { wallQuad(lc, sgn, zc, zc + 1.1 * ZM, f + (1.5 + q * 0.5) * M, f + 2.3 * M); } else { wallQuad(lc, sgn, zc, zc + (0.3 + q * 0.3) * ZM, f + 0.8 * M, f + 2.3 * M); }
										lc.fillStyle = css(mul(wc, 0.6), 0.9); wallQuad(lc, sgn, zc + 0.52 * ZM, zc + 0.58 * ZM, f + 0.8 * M, f + 2.3 * M);
									}
								} else {
									g.fillStyle = glass; wallQuad(g, sgn, zc, zc + 1.1 * ZM, f + 0.8 * M, f + 2.3 * M);
									if (near) { g.fillStyle = css(mul(wc, 0.7)); wallQuad(g, sgn, zc + 0.52 * ZM, zc + 0.58 * ZM, f + 0.8 * M, f + 2.3 * M); }
								}
								if (near) {
									g.fillStyle = sill; wallQuad(g, sgn, zc - 0.08 * ZM, zc + 1.18 * ZM, f + 0.68 * M, f + 0.8 * M);
									if (snowing) { g.fillStyle = snowCss; wallQuad(g, sgn, zc - 0.08 * ZM, zc + 1.18 * ZM, f + 0.8 * M, f + 0.92 * M); }
									if (q > 0.78) { g.fillStyle = css(mul(wc, 0.62)); wallQuad(g, sgn, zc + 0.2 * ZM, zc + 0.9 * ZM, f + 0.08 * M, f + 0.6 * M); g.fillStyle = sill; wallQuad(g, sgn, zc + 0.2 * ZM, zc + 0.9 * ZM, f + 0.54 * M, f + 0.6 * M); }
								}
							}
						}
					}
					if (b.shop > 0.3 && zm < 44 && b.z0 > 2.5) {
						// a lit shop: glass brighter toward the ceiling lights, posts between the panes, things in the window, a door,
						// light on the pavement, and a sign or an awning over it
						col = mx(b.shop > 0.78 ? mx(c3, WHITE, 0.5) : b.shop > 0.55 ? WIN_WARM : mx(AMBER, WHITE, 0.25), wc, hz * 0.6);
						gr = lc.createLinearGradient(0, sy(2.75 * M, zm), 0, sy(0.45 * M, zm));
						gr.addColorStop(0, css(col, 0.8)); gr.addColorStop(0.45, css(col, 0.5)); gr.addColorStop(1, css(mul(col, 0.75), 0.3));
						lc.fillStyle = gr; wallQuad(lc, sgn, b.z0 + 0.35 * ZM, b.z1 - 0.35 * ZM, 0.45 * M, 2.75 * M);
						lc.fillStyle = css(mul(wc, 0.45), 0.9);
						for (zc = b.z0 + 0.35 * ZM; zc < b.z1 - 0.5 * ZM; zc += 1.5 * ZM) {
							wallQuad(lc, sgn, zc, zc + 0.1 * ZM, 0.45 * M, 2.75 * M);
							q = R(); qa = R();
							if (q < 0.75) { wallQuad(lc, sgn, zc + 0.25 * ZM, zc + (0.5 + q * 0.7) * ZM, 0.45 * M, (0.75 + qa * 0.7) * M); }
							if (qa < 0.4) { wallQuad(lc, sgn, zc + 0.2 * ZM, zc + 1.3 * ZM, 1.75 * M, 1.82 * M); }
						}
						wallQuad(lc, sgn, b.z0 + 0.35 * ZM, b.z1 - 0.35 * ZM, 2.3 * M, 2.42 * M);
						lc.fillStyle = css(col, 0.14); groundQuad(lc, sgn * (XW - 2.3 * M), sgn * XW, b.z0 + 0.3 * ZM, b.z1 - 0.3 * ZM);
						if (b.tone < 0.55 && zm < 26) {
							g.fillStyle = css(mul(wc, 0.45)); wallQuad(g, sgn, b.z0 + 0.3 * ZM, b.z1 - 0.3 * ZM, 2.9 * M, 3.72 * M);
							wallSign(sgn, b.z0 + 0.3 * ZM, b.z1 - 0.3 * ZM, 2.9 * M, 3.72 * M, signs[b.aw], 1 - hz * 0.6);
						} else {
							g.fillStyle = css(mx(mul(signs[b.aw], 0.4), wc, 0.4 + hz * 0.5)); wallQuad(g, sgn, b.z0 + 0.2 * ZM, b.z1 - 0.2 * ZM, 2.85 * M, 3.5 * M);
							g.fillStyle = css(mul(wc, 0.5), 0.5); wallQuad(g, sgn, b.z0 + 0.2 * ZM, b.z1 - 0.2 * ZM, 2.85 * M, 2.95 * M);
						}
						REFL.push([sx(sgn * (XW - 1.3 * M), zm), Math.abs(XW / b.z0 - XW / b.z1) * 0.45 + 1.2 * M / zm, sy(0, zm), 2.2 * M / zm, col, 0.3 * (1 - hz)]);
					} else if (zm < 30) {
						// a shutter pulled down under a striped awning whose edge catches the light, and a lamp on the wall above
						g.fillStyle = css(mul(wc, 0.8)); wallQuad(g, sgn, b.z0 + 0.5 * ZM, b.z1 - 0.5 * ZM, 0.1 * M, 2.9 * M);
						g.fillStyle = css(mul(wc, 1.25));
						for (f = 0.3 * M; f < 2.8 * M; f += 0.26 * M) { wallQuad(g, sgn, b.z0 + 0.5 * ZM, b.z1 - 0.5 * ZM, f, f + 0.05 * M); }
						g.fillStyle = css(mx(mul(signs[b.aw], 0.3), wc, 0.45 + hz * 0.4)); wallQuad(g, sgn, b.z0 + 0.3 * ZM, b.z1 - 0.3 * ZM, 2.95 * M, 3.6 * M);
						g.fillStyle = css(mul(wc, 0.6), 0.45);
						for (zc = b.z0 + 0.3 * ZM; zc < b.z1 - 0.8 * ZM; zc += ZM) { wallQuad(g, sgn, zc, zc + 0.5 * ZM, 2.95 * M, 3.6 * M); }
						g.fillStyle = css(mx(lampC, signs[b.aw], 0.5), 0.3 * (1 - hz)); wallQuad(g, sgn, b.z0 + 0.3 * ZM, b.z1 - 0.3 * ZM, 2.95 * M, 3.02 * M);
						if (zm < 9) {
							zs = (b.z0 + b.z1) / 2; x0 = sx(sgn * XW, zs); yy = sy(4.1 * M, zs); hh = M / zs;
							g.fillStyle = css(dark); g.fillRect(x0 - 0.13 * hh, yy - 0.22 * hh, 0.26 * hh, 0.16 * hh);
							gr = g.createRadialGradient(x0, yy + 0.6 * hh, 0, x0, yy + 0.6 * hh, 2.6 * hh); gr.addColorStop(0, css(lampC, 0.26)); gr.addColorStop(1, css(lampC, 0));
							g.fillStyle = gr; wallQuad(g, sgn, Math.max(b.z0, zs - 2.6 * ZM), Math.min(b.z1, zs + 2.6 * ZM), 0.1 * M, 7 * M);
							lc.fillStyle = css(mx(lampC, WHITE, 0.55)); lc.beginPath(); lc.arc(x0, yy, Math.max(1.6, 0.085 * hh), 0, TAU); lc.fill();
						}
					}
					if (snowing && zm < 30) { g.fillStyle = snowCss; wallQuad(g, sgn, b.z0 + 0.25 * ZM, b.z1 - 0.25 * ZM, 3.58 * M, 3.7 * M); }
					q = zm < 34 ? 1 + (R() < 0.55 ? 1 : 0) + (R() < 0.2 ? 1 : 0) : 0;
					for (f = 0; f < q; f++) {
						zs = b.z0 + (b.z1 - b.z0) * (0.15 + 0.7 * R()); wm = (0.7 + R() * 0.7) * M; Y0 = (3.9 + R() * 3.2) * M; Y1 = Y0 + (1.6 + R() * 3.4) * M; col = signs[Math.floor(R() * signs.length)];
						wpx = wm / zs; x0 = sgn > 0 ? sx(XW - wm - 0.12 * M, zs) : sx(-XW + 0.12 * M, zs); yy = sy(Y1, zs); hh = (Y1 - Y0) / zs;
						if (zs > 3.25 && wpx > 5 && yy + hh > -30 && Y1 < b.H) {
							g.fillStyle = css(dark); g.fillRect(sgn > 0 ? x0 + wpx : x0 - 0.14 * M / zs, yy + hh * 0.2, 0.14 * M / zs, Math.max(1.2, hh * 0.04)); g.fillRect(sgn > 0 ? x0 + wpx : x0 - 0.14 * M / zs, yy + hh * 0.8, 0.14 * M / zs, Math.max(1.2, hh * 0.04));
							// the sign's colour on the wall behind it
							gr = g.createRadialGradient(sx(sgn * XW, zs), yy + hh / 2, 0, sx(sgn * XW, zs), yy + hh / 2, hh * 0.7 + 1.6 * M / zs);
							gr.addColorStop(0, css(col, 0.2 * (1 - hz))); gr.addColorStop(1, css(col, 0));
							g.fillStyle = gr; wallQuad(g, sgn, Math.max(b.z0, zs - 2.4 * ZM), Math.min(b.z1, zs + 2.4 * ZM), Math.max(0, Y0 - 2 * M), Math.min(b.H, Y1 + 2 * M));
							signBoard(g, lc, R, x0, yy, wpx, hh, mx(col, hazeC, hz * 0.5), mul(wc, 0.45));
							if (snowing) { g.fillStyle = snowCss; g.fillRect(x0 - 1, yy - Math.max(1.6, 0.1 * M / zs), wpx + 2, Math.max(1.6, 0.1 * M / zs)); }
							REFL.push([x0 + wpx / 2, wpx, sy(0, zs), Y1 / zs, col, 0.62 * (1 - hz * 0.7)]);
						}
					}
				}
				[-1, 1].forEach(function (sgn) {
					var list = [], zz = 1.2 + R() * 0.5, len, m;
					while (zz < 76) {
						len = (5 + R() * 8) * ZM * (zz > 30 ? 2.2 : 1);
						list.push({ z0: zz, z1: zz + len, H: (9.5 + R() * R() * 28) * M, tone: R(), shop: R(), lit: 0.06 + R() * 0.34, aw: Math.floor(R() * signs.length) });
						zz += len;
					}
					for (m = list.length - 1; m >= 0; m--) { building(sgn, list[m]); }
					// on a very wide picture the wall carries on toward the viewer (its own random numbers, so nothing else moves)
					m = R; R = K.seeded("rainnear" + sgn);
					building(sgn, { z0: 0.45, z1: list[0].z0, H: 34 * M, tone: 0.45, shop: 0, lit: 0.1, aw: sgn > 0 ? 2 : 4 });
					R = m;
				});
				// wires across the street, one strung with lanterns
				[5.4, 7.6, 10.5, 15].forEach(function (zw, n3) {
					var Y = (7.2 + n3 * 0.5) * M, xa = sx(-XW, zw), xb = sx(XW, zw), yw = sy(Y, zw), sag = 0.8 * M / zw, m, tt, lx, ly, rr;
					g.strokeStyle = css(dark); g.lineWidth = Math.max(0.8, 6 / zw);
					g.beginPath(); g.moveTo(xa, yw); g.quadraticCurveTo((xa + xb) / 2, yw + sag * 2, xb, yw); g.stroke();
					if (n3 !== 1) { return; }
					for (m = 1; m < 9; m++) {
						tt = m / 9; lx = xa + (xb - xa) * tt; ly = yw + 4 * sag * tt * (1 - tt); rr = 0.3 * M / zw;
						g.fillStyle = css(dark); g.fillRect(lx - 0.6, ly, 1.2, rr * 0.7); g.fillRect(lx - rr * 0.45, ly + rr * 0.6, rr * 0.9, rr * 0.3); g.fillRect(lx - rr * 0.45, ly + rr * 2.5, rr * 0.9, rr * 0.3);
						lc.fillStyle = css(mx(c2, AMBER, 0.3)); lc.beginPath(); lc.ellipse(lx, ly + rr * 1.7, rr * 0.86, rr, 0, 0, TAU); lc.fill();
						lc.fillStyle = css(mx(AMBER, WHITE, 0.5), 0.9); lc.beginPath(); lc.ellipse(lx, ly + rr * 1.7, rr * 0.36, rr * 0.6, 0, 0, TAU); lc.fill();
						REFL.push([lx, rr * 2.2, sy(0, zw), 6.6 * M / zw, mx(c2, AMBER, 0.3), 0.3]);
					}
				});
				// street lamps down both kerbs, small with distance
				for (j = 0; j < 9; j++) {
					z = 8.5 + j * 5.2; s = M / z; x = sx((j % 2 ? -1 : 1) * (XC + 0.25 * M), z); gy = sy(0, z); top = sy(6.1 * M, z);
					g.fillStyle = css(mx(dark, hazeC, 1 - Math.exp(-z / 24))); g.fillRect(x - Math.max(0.5, 0.07 * s), top, Math.max(1, 0.14 * s), gy - top);
					hx = x + (j % 2 ? 1 : -1) * 1.3 * s; g.fillRect(Math.min(x, hx), top, Math.abs(hx - x), Math.max(1, 0.1 * s));
					lc.fillStyle = css(mx(lampC, WHITE, 0.3)); lc.beginPath(); lc.arc(hx, top + 0.12 * s, Math.max(1.4, 0.24 * s), 0, TAU); lc.fill();
					REFL.push([hx, Math.max(3, 0.6 * s), gy, 6 * s, lampC, 0.5 * Math.exp(-z / 40)]);
				}
				// the near lamp, right: post, arm, head; its pool of light on the ground
				z = Math.max(3.3, XC / Math.max(60, W - vx - 46)); s = M / z; x = sx(XC + 0.25 * M, z); gy = sy(0, z); top = sy(5.1 * M, z); hx = x - 1.5 * s;
				g.fillStyle = css(dark); g.fillRect(x - 0.08 * s, top + 0.1 * s, 0.16 * s, gy - top); g.fillRect(x - 0.15 * s, gy - 0.9 * s, 0.3 * s, 0.9 * s);
				g.fillStyle = css(mx(dark, lampC, 0.35)); g.fillRect(x - 0.08 * s, top + 0.5 * s, 0.035 * s, gy - top - 1.4 * s);
				g.strokeStyle = css(dark); g.lineWidth = 0.1 * s; g.lineCap = "round";
				g.beginPath(); g.moveTo(x, top + 0.5 * s); g.quadraticCurveTo(x, top, x - 0.5 * s, top); g.lineTo(hx, top); g.stroke(); g.lineCap = "butt";
				g.fillStyle = css(dark); g.fillRect(hx - 0.4 * s, top - 0.06 * s, 0.8 * s, 0.16 * s);
				lc.fillStyle = css(mx(lampC, WHITE, 0.6)); lc.beginPath(); lc.ellipse(hx, top + 0.13 * s, 0.3 * s, 0.07 * s, 0, 0, TAU); lc.fill();
				if (snowing) { g.fillStyle = css(SNOWC); g.fillRect(hx - 0.4 * s, top - 0.13 * s, 0.8 * s, 0.08 * s); g.fillRect(hx + 0.4 * s, top - 0.09 * s, 0.6 * s, 0.045 * s); }
				lamp.x = hx; lamp.y = top + 0.14 * s; lamp.gy = gy; lamp.s = s;
				lc.save(); lc.translate(hx, gy + 0.1 * s); lc.scale(1, 0.24);
				r = lc.createRadialGradient(0, 0, 0, 0, 0, 3.2 * s); r.addColorStop(0, css(lampC, 0.42)); r.addColorStop(0.5, css(lampC, 0.16)); r.addColorStop(1, css(lampC, 0));
				lc.fillStyle = r; lc.fillRect(-3.3 * s, -3.3 * s, 6.6 * s, 6.6 * s); lc.restore();
				REFL.push([hx, 0.8 * s, gy, 6.2 * s, lampC, 0.6]);
				// the crossing signal, left: post, arm over the road, a head of three lamps (lit each frame)
				z = Math.max(4.1, XC / Math.max(60, vx - 60)); s = M / z; x = sx(-XC - 0.2 * M, z); gy = sy(0, z); top = sy(5.7 * M, z); hx = x + 2.5 * s;
				g.fillStyle = css(dark); g.fillRect(x - 0.08 * s, top, 0.16 * s, gy - top); g.fillRect(x, top + 0.12 * s, 2.5 * s, 0.1 * s); g.fillRect(x - 0.14 * s, gy - 0.8 * s, 0.28 * s, 0.8 * s);
				g.fillStyle = css(mx(dark, hazeC, 0.3)); g.fillRect(x - 0.08 * s, top, 0.03 * s, gy - top);
				g.fillStyle = css(mul(dark, 0.8)); g.fillRect(hx - 0.27 * s, top + 0.18 * s, 0.54 * s, 1.36 * s);
				g.fillStyle = css(mx(dark, hazeC, 0.5)); g.fillRect(hx - 0.27 * s, top + 0.18 * s, 0.54 * s, 0.03 * s); g.fillRect(hx - 0.27 * s, top + 0.18 * s, 0.03 * s, 1.36 * s);
				g.fillStyle = css(mul(dark, 0.35));
				for (j = 0; j < 3; j++) { g.beginPath(); g.arc(hx, top + (0.44 + j * 0.42) * s, 0.15 * s, 0, TAU); g.fill(); }
				if (snowing) { g.fillStyle = css(SNOWC); g.fillRect(hx - 0.27 * s, top + 0.12 * s, 0.54 * s, 0.07 * s); g.fillRect(x + 0.1 * s, top + 0.075 * s, 2 * s, 0.05 * s); }
				sig.x = hx; sig.y = top; sig.gy = gy; sig.s = s;
				// lights far down the street, out of focus
				for (j = 0; j < 34; j++) {
					x = vx + (R() + R() + R() - 1.5) * Math.min(W, 1500) * 0.15; y = VY - 74 + (R() + R() - 1) * 110; s = 6 + R() * 13;
					lc.globalAlpha = 0.08 + R() * 0.24; lc.drawImage(bok[Math.floor(R() * bok.length)], x - s, y - s, s * 2, s * 2);
				}
				lc.globalAlpha = 1;
				g.drawImage(lc.canvas, 0, 0, W, H);
				bloom(g, lc.canvas, W, H, foggy ? 1.6 : 1.1);
				// wet air: a veil of glare round the far light, and darker corners
				g.save(); g.translate(vx, VY - 20); g.scale(1.5, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 480); r.addColorStop(0, css(glowC, foggy ? 0.45 : 0.22)); r.addColorStop(1, css(glowC, 0));
				g.fillStyle = r; g.fillRect(-500, -500, 1000, 1000); g.restore();
				r = g.createRadialGradient(W / 2, H * 0.52, H * 0.45, W / 2, H * 0.52, Math.max(W, H) * 0.75);
				r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(0,0,6,0.5)");
				g.fillStyle = r; g.fillRect(0, 0, W, H);
			});
		}
		// every light's smear on the wet road, painted soft; drawn each frame in sliding slices
		function refl() {
			back();
			return sc.layer("refl", function (g, Wm, h) {
				var W = sc.W, dull = snowing ? 0.55 : 1;
				g.translate(RM, 0);
				function pass(div, wk, ak) {
					soft(g, sc.k, -RM, 0, Wm, h, div, function (c) {
						var j, q, y0, len, gr;
						c.translate(RM, 0);
						c.globalCompositeOperation = "lighter";
						for (j = 0; j < REFL.length; j++) {
							q = REFL[j]; y0 = q[2] - VY; len = Math.max(30, q[3] * 2.3);
							gr = c.createLinearGradient(0, y0, 0, y0 + len);
							gr.addColorStop(0, css(q[4], 0)); gr.addColorStop(0.1, css(q[4], q[5] * ak * dull)); gr.addColorStop(0.5, css(q[4], q[5] * ak * dull * 0.45)); gr.addColorStop(1, css(q[4], 0));
							c.fillStyle = gr; c.fillRect(q[0] - q[1] * wk / 2, y0, q[1] * wk, len);
						}
					});
				}
				g.globalCompositeOperation = "lighter";
				pass(6, snowing ? 2 : 1.5, 0.5); pass(3, 0.6, snowing ? 0.3 : 0.55);
				lightRoad(g, sc.k, W, h, vx, mx(glowC, WHITE, 0.1), 22, 230, 0.55 * dull, 0.06);
				// broken by the rough of the road: dark dashes eaten out of the smears
				g.globalCompositeOperation = "destination-out";
				var R = K.seeded("roadbreak"), j, v, bw;
				for (j = 0; j < 520; j++) {
					v = Math.pow(R(), 0.7); bw = (8 + R() * R() * 150) * (0.25 + v);
					g.fillStyle = "rgba(0,0,0," + (0.2 + R() * 0.45).toFixed(2) + ")";
					g.fillRect(R() * Wm - RM - bw / 2, 6 + v * (h - 6), bw, 1 + v * R() * 5);
				}
				// only the road shows them: cut away everything outside it
				g.globalCompositeOperation = "destination-in";
				g.beginPath(); g.moveTo(vx, 0); g.lineTo(vx + XW * h / E, h); g.lineTo(vx - XW * h / E, h); g.closePath(); g.fillStyle = "#000"; g.fill();
				g.globalCompositeOperation = "source-over";
			}, snap(sc, sc.W + 2 * RM), snap(sc, 1080 - VY));
		}
		function streak(g, spr, x, y, w, h, seed) {
			var j, n = 6;
			for (j = 0; j < n; j++) { g.drawImage(spr, 0, j * 32, 32, 32, x - w / 2 + (1.5 + j * 1.6) * Math.sin(T * 1.7 + j * 1.3 + seed), y + j * h / n, w, h / n + 0.5); }
		}
		// someone with an umbrella, drawn from a few shapes; ph is the walking phase
		function person(g, x, gy, s, ph, dir, canopy, rim) {
			var sw = Math.sin(ph), cw = Math.cos(ph), bob = Math.abs(cw) * 1.5;
			g.save(); g.translate(x, gy); g.scale(dir * s, s); g.translate(0, -bob);
			g.strokeStyle = "#04060b"; g.fillStyle = "#04060b"; g.lineCap = "round"; g.lineJoin = "round";
			g.lineWidth = 8.5;
			g.beginPath(); g.moveTo(1, -46); g.quadraticCurveTo(5 + 9 * sw, -24, 16 * sw, bob - 3 - Math.max(0, cw) * 6);
			g.moveTo(-1, -46); g.quadraticCurveTo(3 - 9 * sw, -24, -16 * sw, bob - 3 - Math.max(0, -cw) * 6); g.stroke();
			g.lineWidth = 6;
			g.beginPath(); g.moveTo(16 * sw, bob - 2.5 - Math.max(0, cw) * 6); g.lineTo(16 * sw + 7, bob - 2.5 - Math.max(0, cw) * 6);
			g.moveTo(-16 * sw, bob - 2.5 - Math.max(0, -cw) * 6); g.lineTo(-16 * sw + 7, bob - 2.5 - Math.max(0, -cw) * 6); g.stroke();
			// a long coat, a little wider at the hem and swinging with the stride
			g.beginPath(); g.moveTo(-10, -80); g.quadraticCurveTo(-10, -88, -3, -88); g.lineTo(5, -88); g.quadraticCurveTo(12, -88, 12, -80);
			g.lineTo(15 + sw * 3, -36); g.quadraticCurveTo(1 + sw * 3, -32, -14 + sw * 3, -36); g.closePath(); g.fill();
			g.beginPath(); g.arc(1.5, -95, 6.8, 0, TAU); g.fill();
			g.lineWidth = 6; g.beginPath(); g.moveTo(6, -82); g.lineTo(13, -68); g.stroke();
			g.beginPath(); g.moveTo(-6, -82); g.quadraticCurveTo(-11 - sw * 4, -66, -8 - sw * 7, -54); g.stroke();
			g.lineWidth = 1.8; g.beginPath(); g.moveTo(12, -66); g.lineTo(9, -136); g.stroke();
			g.fillStyle = canopy;
			g.beginPath(); g.moveTo(-31, -107); g.quadraticCurveTo(9, -150, 49, -107);
			g.quadraticCurveTo(39, -113, 29, -107); g.quadraticCurveTo(19, -113, 9, -107); g.quadraticCurveTo(-1, -113, -11, -107); g.quadraticCurveTo(-21, -113, -31, -107); g.fill();
			if (rim) { g.strokeStyle = rim; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-28, -110); g.quadraticCurveTo(9, -148, 46, -110); g.stroke(); }
			g.restore();
		}
		steam.step = function (p, dt) { p.vx += (16 - p.vx) * dt * 0.3; };

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, j, z, a, x, y, r, s, ph, cur, nxt, f, inb, q, d = dt * S.speed, p, cw, ch;
			T += d;
			sc.put(back());
			g.globalCompositeOperation = "lighter";
			wobble(sc, g, refl(), -RM, VY, T, 0.5, snowing ? 3.5 : 6, 1.6, false, snowing ? 0.12 : 0.3);
			// the signal works through green, amber and red; its colour runs down the road
			ph = T % 23; cur = ph < 9.5 ? 0 : ph < 11.5 ? 1 : 2; nxt = (cur + 1) % 3;
			f = cur === 0 ? K.ramp(9.2, 9.5, ph) : cur === 1 ? K.ramp(11.2, 11.5, ph) : K.ramp(22.7, 23, ph);
			for (j = 0; j < 2; j++) {
				q = j ? nxt : cur; a = j ? f : 1 - f;
				if (a < 0.02) { continue; }
				s = sig.s; y = sig.y + (0.44 + (2 - q) * 0.42) * s;
				g.globalAlpha = a; g.drawImage(sigGlow[q], sig.x - 0.5 * s, y - 0.5 * s, s, s);
				g.globalAlpha = a * 0.8; streak(g, sigStreak[q], sig.x, sig.gy, 0.9 * s, 5.2 * s, 2);
			}
			// headlamps coming, tail lamps going, far off and out of focus
			for (j = 0; j < NC * 2; j++) {
				inb = j < NC; z = carZ[j] + (inb ? -1 : 1) * 2.1 * d;
				if (inb && z < 13) { z = 46; } else if (!inb && z > 46) { z = 13; }
				carZ[j] = z; a = K.smooth(13, 17, z) * (1 - K.smooth(40, 46, z)); r = 7 + 90 / z;
				for (q = -1; q <= 1; q += 2) {
					x = sx(((inb ? -1.7 : 1.7) + q * 0.72) * M, z); y = sy(0.72 * M, z);
					g.globalAlpha = a * 0.5; g.drawImage(bok[inb ? 0 : 1], x - r, y - r, r * 2, r * 2);
					g.globalAlpha = a * 0.18; g.drawImage(bok[inb ? 0 : 1], x - r * 0.8, sy(0, z) + r * 0.2, r * 1.6, r * 4.5);
				}
			}
			g.globalAlpha = 1;
			// rings where drops land
			if (raining) {
				ringAcc += d * 10 * S.detail;
				for (j = 0; j < NR; j++) {
					if (rings[j * 5 + 3] >= rings[j * 5 + 4]) {
						if (ringAcc < 1) { continue; }
						ringAcc -= 1; z = 1.25 + Math.random() * Math.random() * 7;
						rings[j * 5] = sx((Math.random() - 0.5) * 7.6 * M, z); rings[j * 5 + 1] = sy(0, z); rings[j * 5 + 2] = M / z; rings[j * 5 + 3] = 0; rings[j * 5 + 4] = 0.5 + Math.random() * 0.5;
					}
					rings[j * 5 + 3] += d; a = rings[j * 5 + 3] / rings[j * 5 + 4];
					if (a >= 1) { continue; }
					r = (0.06 + 0.4 * a) * rings[j * 5 + 2];
					g.globalAlpha = (1 - a) * 0.42; g.drawImage(ring, rings[j * 5] - r, rings[j * 5 + 1] - r * 0.26, r * 2, r * 0.52);
				}
				if (ringAcc > 3) { ringAcc = 3; }
				g.globalAlpha = 1;
			}
			g.globalCompositeOperation = "source-over";
			steamAcc += d;
			if (steamAcc > 0.2) {
				steamAcc = 0; p = steam.spawn();
				if (p) { s = grate.s / 87; p.x = grate.x + K.rnd(-12, 12) * s; p.y = grate.y - 4 * s; p.vx = K.rnd(-8, 8) * s; p.vy = K.rnd(-46, -30) * s; p.life = K.rnd(4, 6.5); p.img = puff; p.size = K.rnd(26, 40) * s; p.grow = K.rnd(24, 38) * s; p.a = 0.3; p.fade = 0.8; }
			}
			steam.update(d); steam.draw(g);
			g.globalAlpha = foggy ? 0.6 : 0.25; drift(sc, g, "d10", mistTex, T * 10, VY - 150, 2600, 300); g.globalAlpha = 1;
			// now and then someone crosses with an umbrella, their reflection under them
			if (walk.on) {
				walk.x += walk.dir * walk.sp * d; walk.ph += d * walk.sp / (walkS * 0.2);
				s = walkS * 1.76 / 100;
				g.save(); g.globalAlpha = 0.3; g.translate(0, walkY * 2); g.scale(1, -1);
				g.translate(0, walkY * 0.22); g.scale(1, 0.78);
				person(g, walk.x, walkY, s, walk.ph, walk.dir, walk.tint || "#04060b", null); g.restore(); g.globalAlpha = 1;
				person(g, walk.x, walkY, s, walk.ph, walk.dir, walk.tint || "#04060b", css(mx(lampC, WHITE, 0.3), 0.55));
				if (walk.x < -200 || walk.x > W + 200) { walk.on = false; walk.wait = (22 + Math.random() * 30) / S.detail; }
			} else {
				walk.wait -= d;
				if (walk.wait <= 0) {
					walk.on = true; walk.dir = Math.random() < 0.5 ? 1 : -1; walk.x = walk.dir > 0 ? -160 : W + 160; walk.sp = walkS * (1.1 + Math.random() * 0.35); walk.ph = 0;
					walk.tint = Math.random() < 0.45 ? css(mx(signs[(Math.random() * signs.length) | 0], [4, 6, 11], 0.62)) : null;
				}
			}
			// the near lamp: its glow, the cone of light under it, and the rain caught in the cone
			g.globalCompositeOperation = "lighter";
			s = lamp.s; cw = 5 * s; ch = lamp.gy - lamp.y + 0.5 * s;
			g.globalAlpha = 0.42;
			g.save(); g.translate(lamp.x, lamp.y); g.scale(1, -1); g.drawImage(cone, -cw / 2, -ch, cw, ch); g.restore();
			g.globalAlpha = 0.6 + 0.04 * Math.sin(T * 9); g.drawImage(lampGlow, lamp.x - 1.1 * s, lamp.y - 1.1 * s, 2.2 * s, 2.2 * s);
			if (raining) {
				for (j = 0; j < ND; j++) {
					y = drops[j * 2 + 1] + d * 1.9; x = drops[j * 2];
					if (y > 1) { y -= 1; x = Math.random() * 2 - 1; drops[j * 2] = x; }
					drops[j * 2 + 1] = y;
					g.globalAlpha = (1 - x * x) * (1 - y * 0.7);
					g.drawImage(drop, lamp.x + x * (0.05 + 0.9 * y) * cw * 0.42, lamp.y + y * ch - 0.5 * s, 0.03 * s + 1.2, 0.5 * s);
				}
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			if (rain) { rain(g, W, 1080, d, 0.1, 0.85); }
			if (snow) { snow(g, W, 1080, d, 0.02, 1); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "city-rain", label: "City: rainy street at night", colors: ["0a1a2c", "ff6a3d", "2fd6e8"], start: startRain });

	// ================================================================ 4. rooftop at dusk
	function startRooftop(host, o) {
		var S = settings(o), sc = scene(host, { fps: 30, quality: S.quality, maxPixels: FULL_HD });
		var tod = S.time || "dusk", night = tod === "night", dawn = tod === "dawn", early = tod === "sunset" || tod === "golden";
		var rainy = S.weather === "rain", foggy = S.weather === "fog", snowy = S.weather === "snow";
		var c1 = rgb(S.c1), c2 = rgb(S.c2), c3 = rgb(S.c3), WHITE = [255, 255, 255], T = Math.random() * 300, flip = S.layout === "split", i;
		var PY = 776, FY = 838, TOP = 280, plainK = night ? 1 : early || dawn ? 0 : 0.45;
		var body = mx(mul(c1, 0.36), [9, 9, 13], 0.4), warm = mx(c3, WIN_AMBER, 0.3), rimC = mx(c2, WHITE, 0.15), lampOn = true;
		var pal = [WIN_WARM, WIN_AMBER, mx(c3, WHITE, 0.4), WIN_COOL, mx(c2, WHITE, 0.3)];
		var litC = mul(mx(mx(c2, c3, 0.3), WHITE, 0.12), night ? 0.42 : 0.9), shadeC = mx(mx(c1, c2, 0.16), mul(c1, 0.75), 0.45), cRim = mul(mx(c2, WHITE, 0.4), night ? 0.5 : 1);
		var clouds = [
			{ tex: cloudTex(43, 512, 128, 6, 3, rainy ? 0.75 : 0.5, 0.11, mx(litC, WHITE, 0.15), mx(shadeC, c1, 0.3), cRim, 0.6), y: 10, h: 280, bw: 3100, sp: 2.4 },
			{ tex: cloudTex(57, 640, 160, 6, 3, rainy ? 0.85 : 0.58, 0.08, litC, shadeC, cRim, 0.92), y: 170, h: 330, bw: 2700, sp: 6 },
			{ tex: cloudTex(69, 512, 96, 5, 2, 0.48, 0.07, mx(c2, c3, 0.3), mx(shadeC, c2, 0.3), cRim, 0.85), y: 430, h: 150, bw: 2300, sp: 1.6 }
		];
		var bok = [bokehSprite(WIN_WARM), bokehSprite(WIN_AMBER), bokehSprite(mx(c3, WHITE, 0.3)), bokehSprite([190, 226, 255]), bokehSprite([255, 96, 84]), bokehSprite(mx(c2, WHITE, 0.2))];
		var NB = Math.round(34 * S.detail), tw = new Float32Array(NB * 5), NS = night ? 150 : dawn || early ? 26 : 70, stars = new Float32Array(NS * 4), starSpr = K.glow("#ffffff", 16, 0.5);
		var bulbGlow = K.glow(css(warm), 96, 0.14), bulbHalo = K.glow(css(mx(warm, c2, 0.2)), 128, 0.02), NBULB = 14;
		var plane = makePlane(mx(c2, WHITE, 0.5), true), mist = foggy ? fogTex(91, mx(mx(c1, c2, 0.5), WHITE, 0.35), 384, 96, 5, 2, 0.3, 0.8) : null;
		var rain = rainy ? makeRain(S.detail, [210, 225, 250]) : null, snow = snowy ? makeSnow(S.detail, [255, 255, 255]) : null;
		var wire = { x0: 0, y0: 0, x1: 0, y1: 0 }, cat = { x: 0, y: 0 }, vent = { x: 0, y: 0 }, lampP = { x: 0, y: 0 };
		var R0 = K.seeded("roofstars");
		for (i = 0; i < NS; i++) { stars[i * 4] = R0(); stars[i * 4 + 1] = R0() * R0(); stars[i * 4 + 2] = R0() * TAU; stars[i * 4 + 3] = 0.03 + R0() * 0.09; }
		for (i = 0; i < NB; i++) { tw[i * 5] = R0() + R0() - 1; tw[i * 5 + 1] = Math.pow(R0(), 0.7); tw[i * 5 + 2] = R0() * TAU; tw[i * 5 + 3] = 0.25 + R0() * 0.9; tw[i * 5 + 4] = Math.floor(R0() * 6); }

		function sky() {
			return sc.layer("sky", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, PY + 30), r;
				skyBands(gr, c1, c2, c3, 0.72, 0.18, plainK);
				g.fillStyle = gr; g.fillRect(0, 0, W, h);
				g.save(); g.translate(W * 0.56, PY - 10); g.scale(2.2, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 380);
				r.addColorStop(0, css(mx(c2, c3, 0.4), night ? 0.3 : 0.6)); r.addColorStop(0.4, css(c2, night ? 0.1 : 0.22)); r.addColorStop(1, css(c2, 0));
				g.fillStyle = r; g.fillRect(-400, -400, 800, 800); g.restore();
				if (night) {
					// a moon, three-quarters full
					r = g.createRadialGradient(W * 0.78, 168, 0, W * 0.78, 168, 150);
					r.addColorStop(0, "rgba(220,230,255,0.3)"); r.addColorStop(1, "rgba(220,230,255,0)"); g.fillStyle = r; g.fillRect(W * 0.78 - 150, 18, 300, 300);
					g.fillStyle = "#eef2ff"; g.beginPath(); g.arc(W * 0.78, 168, 30, 0, TAU); g.fill();
					g.fillStyle = "rgba(150,165,205,0.35)"; g.beginPath(); g.arc(W * 0.78 - 9, 162, 8, 0, TAU); g.arc(W * 0.78 + 9, 178, 6, 0, TAU); g.arc(W * 0.78 + 7, 156, 4, 0, TAU); g.fill();
				}
				grain(g, W, h, 0.03);
			}, sc.W, snap(sc, PY + 40));
		}
		// the city beyond the roof, out of focus: soft blocks and discs of light
		function city() {
			return sc.layer("city", function (g, W, h) {
				var base = h - 26, R = K.seeded("roofcity3"), j, x, y, s, gr;
				soft(g, sc.k, 0, 0, W, h, 5, function (c) {
					var lcx = lightCanvas(c, W, h);
					skyline(c, lcx, { seed: "rooffar", W: W, x0: -30, x1: W + 30, base: base, hMin: 40, hMax: 250, wMin: 30, wMax: 66, env: function (u) { return 0.6 + 0.4 * Math.sin(u * 9 + 1); }, body: mx(mul(c1, 0.78), c2, 0.3), cell: 8, lit: night ? 0.6 : 0.45, pal: pal });
					hazeFill(c, { col: mx(c2, c3, 0.2), a0: 0.1, a1: 0.5, y0: base - 260, y1: base }, W, h);
					skyline(c, lcx, { seed: "roofnear", W: W, x0: -30, x1: W + 30, base: base + 30, hMin: 60, hMax: 330, wMin: 44, wMax: 90, env: function (u) { return 0.5 + 0.5 * Math.sin(u * 6 + 4); }, body: mx(mul(c1, 0.5), c2, 0.14), cell: 10, lit: night ? 0.62 : 0.5, pal: pal });
					c.globalAlpha = 0.9; c.drawImage(lcx.canvas, 0, 0, W, h); c.globalAlpha = 1;
				});
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < 120; j++) {
					x = R() * W; y = base - 10 - Math.pow(R(), 1.5) * 280; s = 8 + R() * R() * 30;
					g.globalAlpha = (0.1 + R() * 0.32) * (night ? 1.1 : 1); g.drawImage(bok[Math.floor(R() * bok.length)], x - s, y - s, s * 2, s * 2);
				}
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
				gr = g.createLinearGradient(0, base - 150, 0, h);
				gr.addColorStop(0, css(mx(c2, c3, 0.3), 0)); gr.addColorStop(1, css(mx(c2, c3, 0.3), night ? 0.3 : 0.42));
				g.fillStyle = gr; g.fillRect(0, base - 150, W, h - base + 150);
			}, sc.W, snap(sc, 430));
		}
		// the roof itself and everything standing on it, painted once
		function roof() {
			return sc.layer("roof", function (g, W, h) {
				var lc = lightCanvas(g, W, h), oy = 1080 - h, R = K.seeded("rooftop5"), gr, j, x, y, n, bc = body, face = mul(body, 1.5), lit = mx(body, warm, 0.34);
				g.translate(0, -oy); lc.translate(0, -oy);
				function box(x0, y0, w, hh, topC) {
					gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, css(mx(face, rimC, 0.2))); gr.addColorStop(0.12, css(face)); gr.addColorStop(1, css(mul(face, 0.72)));
					g.fillStyle = gr; g.fillRect(x0, y0, w, hh);
					g.fillStyle = css(topC || mx(face, rimC, 0.4)); g.fillRect(x0, y0, w, 2.4);
				}
				// the low wall at the far edge, its coping catching the last of the sky
				gr = g.createLinearGradient(0, PY, 0, FY); gr.addColorStop(0, css(mul(body, 1.7))); gr.addColorStop(1, css(mul(body, 1.1)));
				g.fillStyle = gr; g.fillRect(0, PY, W, FY - PY);
				g.fillStyle = css(mx(mul(body, 1.6), rimC, 0.42)); g.fillRect(0, PY - 9, W, 9);
				g.fillStyle = css(mx(body, rimC, 0.75)); g.fillRect(0, PY - 9, W, 1.8);
				g.fillStyle = css(mul(body, 0.6)); g.fillRect(0, PY, W, 4);
				for (x = 60; x < W; x += 190 + R() * 60) { g.fillStyle = css(mul(body, 0.9), 0.5); g.fillRect(x, PY + 4, 1.6, FY - PY - 4); }
				// the roof floor: felt with seams, paler toward the wall
				gr = g.createLinearGradient(0, FY, 0, 1080); gr.addColorStop(0, css(mx(mul(body, 1.9), c2, 0.12))); gr.addColorStop(0.4, css(mx(mul(body, 1.45), c1, 0.12))); gr.addColorStop(1, css(mul(body, 0.95)));
				g.fillStyle = gr; g.fillRect(0, FY, W, 1080 - FY);
				g.strokeStyle = css(mul(body, 1.9), 0.3); g.lineWidth = 1.2; g.beginPath();
				for (j = -8; j <= 8; j++) { g.moveTo(W / 2 + j * 150, FY); g.lineTo(W / 2 + j * 520, 1080); }
				for (j = 0; j < 4; j++) { y = FY + 14 + j * j * 16 + j * 14; g.moveTo(0, y); g.lineTo(W, y); }
				g.stroke();
				g.fillStyle = css(mul(body, 0.5)); g.fillRect(0, FY, W, 3);
				// pots of green on the wall
				[0.36, 0.865].forEach(function (u, m) {
					var px = u * W, k2;
					g.fillStyle = css(mx(mul(face, 0.9), [120, 60, 40], 0.2)); g.beginPath(); g.moveTo(px - 17, PY - 36); g.lineTo(px + 17, PY - 36); g.lineTo(px + 13, PY - 9); g.lineTo(px - 13, PY - 9); g.closePath(); g.fill();
					g.fillStyle = css(mx(face, rimC, 0.35)); g.fillRect(px - 19, PY - 39, 38, 4);
					g.strokeStyle = css(mx(mul(body, 0.9), [30, 70, 50], 0.35)); g.lineCap = "round";
					for (k2 = 0; k2 < 9; k2++) {
						g.lineWidth = 3.4 - k2 * 0.12; g.beginPath(); g.moveTo(px + (R() - 0.5) * 12, PY - 38);
						g.quadraticCurveTo(px + (R() - 0.5) * 40, PY - 70 - R() * 30, px + (k2 - 4) * (9 + m * 2) + (R() - 0.5) * 10, PY - 62 - R() * 44); g.stroke();
					}
					g.lineCap = "butt";
				});
				// the cat sits on the wall, watching the lights (its tail is drawn each frame)
				cat.x = 0.505 * W; cat.y = PY - 9;
				g.fillStyle = css(mul(body, 0.5));
				g.beginPath(); g.ellipse(cat.x, cat.y - 25, 21, 27, 0, 0, TAU); g.fill();
				g.beginPath(); g.ellipse(cat.x + 9, cat.y - 58, 14, 12.5, 0, 0, TAU); g.fill();
				g.beginPath(); g.moveTo(cat.x - 2, cat.y - 64); g.lineTo(cat.x + 2, cat.y - 80); g.lineTo(cat.x + 9, cat.y - 68); g.moveTo(cat.x + 11, cat.y - 68); g.lineTo(cat.x + 19, cat.y - 80); g.lineTo(cat.x + 22, cat.y - 62); g.fill();
				g.fillRect(cat.x + 6, cat.y - 30, 10, 30);
				// an air unit and two goose-neck vents
				x = 0.385 * W; y = FY + 34; box(x, y - 70, 112, 70);
				g.strokeStyle = css(mul(face, 0.55)); g.lineWidth = 2; g.beginPath(); g.arc(x + 38, y - 35, 24, 0, TAU); g.moveTo(x + 14, y - 35); g.lineTo(x + 62, y - 35); g.moveTo(x + 38, y - 59); g.lineTo(x + 38, y - 11); g.stroke();
				g.fillStyle = css(mul(face, 0.6)); for (j = 0; j < 5; j++) { g.fillRect(x + 74, y - 58 + j * 10, 28, 3); }
				g.strokeStyle = css(mul(face, 0.95)); g.lineWidth = 11; g.lineCap = "butt";
				[0.555, 0.59].forEach(function (u, m) { var vx0 = u * W, vy0 = FY + 40 + m * 8; g.beginPath(); g.moveTo(vx0, vy0); g.lineTo(vx0, vy0 - 44 - m * 16); g.arc(vx0 + 15, vy0 - 44 - m * 16, 15, Math.PI, 0); g.lineTo(vx0 + 30, vy0 - 34 - m * 16); g.stroke(); });
				// a spinning vent cap (its vanes are drawn each frame)
				vent.x = 0.335 * W; vent.y = FY + 46;
				g.fillStyle = css(face); g.fillRect(vent.x - 8, vent.y - 30, 16, 30);
				g.fillStyle = css(mul(face, 1.2)); g.beginPath(); g.ellipse(vent.x, vent.y - 44, 21, 17, 0, 0, TAU); g.fill();
				g.fillStyle = css(mx(face, rimC, 0.45)); g.fillRect(vent.x - 14, vent.y - 62, 28, 3);
				// the water tank: timber staves, steel hoops, a cone of a roof, on a braced steel frame
				(function () {
					var cx = 0.24 * W, by = FY + 60, bw = 172, top = by - 392, bot = by - 196, wood = mx(mul(body, 1.5), [70, 44, 30], 0.3), hoop = mx(mul(body, 2.1), rimC, 0.2);
					g.strokeStyle = css(mul(face, 0.9)); g.lineWidth = 7;
					g.beginPath(); g.moveTo(cx - 76, by); g.lineTo(cx - 70, bot); g.moveTo(cx + 76, by); g.lineTo(cx + 70, bot); g.stroke();
					g.strokeStyle = css(mul(face, 0.62)); g.lineWidth = 5;
					g.beginPath(); g.moveTo(cx - 40, by - 14); g.lineTo(cx - 38, bot); g.moveTo(cx + 40, by - 14); g.lineTo(cx + 38, bot); g.stroke();
					g.strokeStyle = css(mul(face, 0.8)); g.lineWidth = 3;
					g.beginPath(); g.moveTo(cx - 75, by - 20); g.lineTo(cx + 71, bot + 12); g.moveTo(cx + 75, by - 20); g.lineTo(cx - 71, bot + 12); g.moveTo(cx - 74, by - 96); g.lineTo(cx + 74, by - 96); g.stroke();
					box(cx - 94, bot - 4, 188, 12);
					gr = g.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
					gr.addColorStop(0, css(mx(wood, rimC, 0.5))); gr.addColorStop(0.07, css(mul(wood, 1.1))); gr.addColorStop(0.45, css(mul(wood, 0.72))); gr.addColorStop(0.86, css(mx(wood, warm, lampOn ? 0.3 : 0.1))); gr.addColorStop(1, css(mul(wood, 0.8)));
					g.fillStyle = gr; g.beginPath(); g.moveTo(cx - bw / 2 + 5, bot - 4); g.quadraticCurveTo(cx - bw / 2 - 5, (top + bot) / 2, cx - bw / 2 + 3, top); g.lineTo(cx + bw / 2 - 3, top); g.quadraticCurveTo(cx + bw / 2 + 5, (top + bot) / 2, cx + bw / 2 - 5, bot - 4); g.closePath(); g.fill();
					g.fillStyle = css(mul(wood, 0.5), 0.4); for (x = cx - bw / 2 + 12; x < cx + bw / 2 - 6; x += 12.5) { g.fillRect(x, top + 2, 1.3, bot - top - 6); }
					g.fillStyle = css(hoop, 0.75); for (j = 0; j < 6; j++) { g.fillRect(cx - bw / 2 - 2, top + 12 + j * (bot - top - 26) / 5, bw + 4, 2.6); }
					g.fillStyle = css(mul(wood, 0.4), 0.6); g.fillRect(cx - bw / 2, top, bw, 7);
					g.fillStyle = css(mul(wood, 0.85)); g.beginPath(); g.moveTo(cx - 98, top + 2); g.lineTo(cx, top - 66); g.lineTo(cx + 98, top + 2); g.closePath(); g.fill();
					g.fillStyle = css(mx(wood, rimC, 0.42)); g.beginPath(); g.moveTo(cx - 98, top + 2); g.lineTo(cx, top - 66); g.lineTo(cx - 22, top + 2); g.closePath(); g.fill();
					g.fillStyle = css(mul(wood, 0.6)); g.fillRect(cx - 2, top - 80, 4, 16);
					// a ladder up its side and the pipe down
					g.strokeStyle = css(mul(face, 1.1)); g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx + 44, bot + 8); g.lineTo(cx + 44, top + 10); g.moveTo(cx + 62, bot + 8); g.lineTo(cx + 62, top + 10);
					for (y = bot; y > top + 14; y -= 17) { g.moveTo(cx + 44, y); g.lineTo(cx + 62, y); }
					g.stroke();
					g.fillStyle = css(mul(face, 0.8)); g.fillRect(cx - 5, bot + 8, 9, by - bot - 8);
				})();
				// the stair hut: brick, a door with a lit pane, a lamp over it, an aerial and a dish on top
				(function () {
					var x0 = 0.63 * W, by = FY + 82, w = 236, hh = 262, top = by - hh, brick = mx(mul(body, 1.55), [96, 44, 34], 0.26), k2;
					gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, css(mx(brick, rimC, 0.25))); gr.addColorStop(0.1, css(brick)); gr.addColorStop(1, css(mul(brick, 0.7)));
					g.fillStyle = gr; g.fillRect(x0, top, w, hh);
					g.fillStyle = css(mul(brick, 0.6), 0.35); for (y = top + 12; y < by; y += 11) { g.fillRect(x0, y, w, 1.2); }
					g.fillStyle = css(mul(body, 1.2)); g.beginPath(); g.moveTo(x0 - 12, top + 4); g.lineTo(x0 + w + 12, top - 12); g.lineTo(x0 + w + 12, top - 2); g.lineTo(x0 - 12, top + 14); g.closePath(); g.fill();
					g.fillStyle = css(mx(body, rimC, 0.6)); g.beginPath(); g.moveTo(x0 - 12, top + 4); g.lineTo(x0 + w + 12, top - 12); g.lineTo(x0 + w + 12, top - 9.5); g.lineTo(x0 - 12, top + 6.5); g.closePath(); g.fill();
					g.fillStyle = css(mul(body, 0.7)); g.fillRect(x0 + 40, by - 176, 82, 176);
					g.fillStyle = css(mul(body, 1.3)); g.fillRect(x0 + 46, by - 170, 70, 170);
					g.fillStyle = css(mul(body, 0.8)); g.fillRect(x0 + 104, by - 88, 6, 14);
					lampP.x = x0 + 81; lampP.y = by - 198;
					g.fillStyle = css(mul(body, 0.6)); g.fillRect(lampP.x - 9, lampP.y - 8, 18, 6);
					if (lampOn) {
						lc.fillStyle = css(mx(warm, WHITE, 0.35), 0.95); lc.fillRect(x0 + 58, by - 156, 46, 54);
						lc.fillStyle = css(mul(body, 0.9), 0.85); lc.fillRect(x0 + 80, by - 156, 2.4, 54); lc.fillRect(x0 + 58, by - 130, 46, 2.4);
						lc.fillStyle = css(mx(warm, WHITE, 0.6)); lc.beginPath(); lc.arc(lampP.x, lampP.y, 5, 0, TAU); lc.fill();
						soft(lc, sc.k, x0 - 60, lampP.y - 10, 300, by + 50 - lampP.y, 9, function (c) {
							var q = c.createLinearGradient(0, 10, 0, by + 40 - lampP.y); q.addColorStop(0, css(warm, 0.3)); q.addColorStop(1, css(warm, 0.03));
							c.fillStyle = q; c.beginPath(); c.moveTo(lampP.x - x0 + 60 - 10, 10); c.lineTo(lampP.x - x0 + 60 + 10, 10); c.lineTo(lampP.x - x0 + 60 + 100, by + 40 - lampP.y); c.lineTo(lampP.x - x0 + 60 - 100, by + 40 - lampP.y); c.closePath(); c.fill();
						});
						lc.save(); lc.translate(lampP.x, by + 16); lc.scale(1, 0.22); gr = lc.createRadialGradient(0, 0, 0, 0, 0, 190); gr.addColorStop(0, css(warm, 0.4)); gr.addColorStop(1, css(warm, 0));
						lc.fillStyle = gr; lc.fillRect(-200, -200, 400, 400); lc.restore();
					} else { g.fillStyle = css(mx(mul(body, 1.4), c2, 0.3)); g.fillRect(x0 + 58, by - 156, 46, 54); }
					// aerial
					x = x0 + 178; g.fillStyle = css(mul(body, 0.9)); g.fillRect(x - 1.6, top - 196, 3.2, 190);
					for (k2 = 0; k2 < 6; k2++) { g.fillRect(x - 40 + k2 * 5, top - 186 + k2 * 13, 80 - k2 * 10, 2.2); }
					g.strokeStyle = css(mul(body, 0.9)); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, top - 120); g.lineTo(x - 46, top - 4); g.moveTo(x, top - 120); g.lineTo(x + 36, top - 10); g.stroke();
					// dish
					x = x0 + 56; g.fillStyle = css(mul(body, 0.95)); g.fillRect(x - 3, top - 34, 6, 38);
					g.beginPath(); g.ellipse(x - 4, top - 44, 28, 17, 0.55, 0, TAU); g.fill();
					g.strokeStyle = css(mx(body, rimC, 0.6)); g.lineWidth = 1.6; g.beginPath(); g.ellipse(x - 4, top - 44, 28, 17, 0.55, Math.PI * 0.2, Math.PI * 1.1); g.stroke();
				})();
				// two chairs and a crate for a table, nearer to us
				(function () {
					var x0 = 0.47 * W, by = FY + 168, dk = css(mul(body, 0.5));
					g.fillStyle = dk; g.fillRect(x0 - 26, by - 44, 52, 44);
					g.fillStyle = css(mx(body, warm, 0.4)); g.fillRect(x0 - 26, by - 44, 52, 2.6);
					g.fillStyle = css(mul(body, 0.8)); g.fillRect(x0 - 26, by - 22, 52, 2);
					lc.fillStyle = css(mx(warm, WHITE, 0.3), 0.9); lc.fillRect(x0 - 6, by - 58, 9, 14);
					lc.fillStyle = css(WHITE, 0.9); lc.fillRect(x0 - 3.5, by - 63, 4, 6);
					g.strokeStyle = dk; g.lineWidth = 5; g.lineCap = "round";
					[-1, 1].forEach(function (d) {
						var cx = x0 + d * 96;
						g.beginPath(); g.moveTo(cx - d * 26, by - 46); g.lineTo(cx + d * 24, by - 46); g.moveTo(cx + d * 22, by - 46); g.lineTo(cx + d * 34, by - 112);
						g.moveTo(cx - d * 24, by - 46); g.lineTo(cx + d * 14, by); g.moveTo(cx + d * 20, by - 46); g.lineTo(cx - d * 20, by); g.stroke();
						g.strokeStyle = css(mx(body, warm, 0.5)); g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - d * 26, by - 49); g.lineTo(cx + d * 22, by - 49); g.stroke(); g.strokeStyle = dk; g.lineWidth = 5;
					});
					g.lineCap = "butt";
				})();
				// posts for the string of bulbs
				wire.x0 = 0.05 * W; wire.y0 = 520; wire.x1 = 0.955 * W; wire.y1 = 548;
				g.fillStyle = css(mul(body, 0.75)); g.fillRect(wire.x0 - 4, wire.y0 - 6, 8, PY + 40 - wire.y0); g.fillRect(wire.x1 - 4, wire.y1 - 6, 8, PY + 40 - wire.y1);
				g.fillStyle = css(mx(body, rimC, 0.5)); g.fillRect(wire.x0 - 4, wire.y0 - 6, 1.8, PY + 40 - wire.y0); g.fillRect(wire.x1 - 4, wire.y1 - 6, 1.8, PY + 40 - wire.y1);
				// the bulbs warm whatever is near them
				if (lampOn) {
					g.globalCompositeOperation = "source-atop";
					g.save(); g.translate(W / 2, 640); g.scale(Math.max(1, W / 1300), 1);
					gr = g.createRadialGradient(0, 0, 0, 0, 0, 640); gr.addColorStop(0, css(warm, 0.22)); gr.addColorStop(1, css(warm, 0));
					g.fillStyle = gr; g.fillRect(-660, -660, 1320, 1320); g.restore();
					g.globalCompositeOperation = "source-over";
					for (j = 0; j < 5; j++) {
						lc.save(); lc.translate(W * (0.14 + j * 0.18), FY + 80 + (j % 2) * 50); lc.scale(1, 0.2);
						gr = lc.createRadialGradient(0, 0, 0, 0, 0, 260); gr.addColorStop(0, css(warm, 0.2)); gr.addColorStop(1, css(warm, 0));
						lc.fillStyle = gr; lc.fillRect(-240, -240, 480, 480); lc.restore();
					}
				}
				g.drawImage(lc.canvas, 0, oy, W, h);
				g.setTransform(g.canvas.width / W, 0, 0, g.canvas.height / h, 0, 0);
				bloom(g, lc.canvas, W, h, 1.15);
			}, sc.W, snap(sc, 1080 - TOP));
		}

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, j, C, x, y, a, s, d = dt * S.speed, t, mx0, my0, u, L, nb;
			T += d;
			slide(sc, g, 130);
			if (flip) { g.translate(W, 0); g.scale(-1, 1); }
			put(g, sky(), k, 0, 0);
			// stars come and go slowly, so a few more seem to come out as you watch
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < NS; j++) {
				a = Math.sin(T * stars[j * 4 + 3] + stars[j * 4 + 2]); a = (a + 0.35) * (1 - stars[j * 4 + 1] * 0.8);
				if (a < 0.05) { continue; }
				g.globalAlpha = Math.min(1, a * (night ? 1 : 0.7)); s = 3 + (j % 5);
				g.drawImage(starSpr, stars[j * 4] * W - s / 2, stars[j * 4 + 1] * 470 + 6 - s / 2, s, s);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			for (j = 0; j < 3; j++) { C = clouds[j]; drift(sc, g, "cl" + j, C.tex, T * C.sp, C.y, C.bw, C.h); }
			plane(g, W, d, 50, 330);
			L = city(); put(g, L, k, 0, PY + 68 - L.hu);
			// lights in the far city wink
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < NB; j++) {
				a = 0.5 + 0.5 * Math.sin(T * tw[j * 5 + 3] + tw[j * 5 + 2]); s = 9 + ((j * 7) % 22);
				g.globalAlpha = 0.06 + 0.4 * a * a;
				g.drawImage(bok[tw[j * 5 + 4]], (0.5 + tw[j * 5] * 0.5) * W - s, PY + 28 - tw[j * 5 + 1] * 250 - s, s * 2, s * 2);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			if (mist) { g.globalAlpha = 0.8; drift(sc, g, "d12", mist, T * 8, PY - 270, 2600, 330); g.globalAlpha = 1; }
			L = roof(); put(g, L, k, 0, 1080 - L.hu);
			// the cat's tail, the vent's vanes
			a = Math.sin(T * 0.9) + 0.4 * Math.sin(T * 2.3);
			g.strokeStyle = css(mul(body, 0.5)); g.lineWidth = 7; g.lineCap = "round";
			g.beginPath(); g.moveTo(cat.x - 15, cat.y - 9); g.quadraticCurveTo(cat.x - 36 - a * 5, cat.y + 12, cat.x - 28 + a * 13, cat.y + 42); g.stroke(); g.lineCap = "butt";
			g.fillStyle = css(mx(body, rimC, 0.5), 0.75);
			for (j = 0; j < 6; j++) { a = T * 2.2 + j * Math.PI / 3; if (Math.sin(a) > 0) { g.fillRect(vent.x + Math.cos(a) * 19 - 1.2, vent.y - 58, 2.4, 27); } }
			// the string of bulbs, swaying
			mx0 = (wire.x0 + wire.x1) / 2 + 16 * Math.sin(T * 0.62) + 6 * Math.sin(T * 1.37 + 1); my0 = (wire.y0 + wire.y1) / 2 + Math.min(230, 70 + W * 0.2) + 6 * Math.sin(T * 0.9 + 2);
			// fewer bulbs on a narrow picture, so they stay beads on a string rather than one blaze
			nb = Math.max(4, Math.min(NBULB, Math.round(W / 70)));
			g.strokeStyle = css(mul(body, 0.7)); g.lineWidth = 1.6;
			g.beginPath(); g.moveTo(wire.x0, wire.y0); g.quadraticCurveTo(mx0, my0, wire.x1, wire.y1); g.stroke();
			for (j = 0; j < nb; j++) {
				t = (j + 0.5) / nb; u = 1 - t;
				x = u * u * wire.x0 + 2 * u * t * mx0 + t * t * wire.x1 + 2.5 * Math.sin(T * 1.7 + j * 1.9); y = u * u * wire.y0 + 2 * u * t * my0 + t * t * wire.y1 + 9;
				g.fillStyle = css(mul(body, 0.7)); g.fillRect(x - 2, y - 9, 4, 6);
				if (lampOn) { g.fillStyle = "#fff6dd"; g.beginPath(); g.arc(x, y, 4.6, 0, TAU); g.fill(); } else { g.fillStyle = css(mx(body, rimC, 0.6)); g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill(); }
			}
			if (lampOn) {
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < nb; j++) {
					t = (j + 0.5) / nb; u = 1 - t;
					x = u * u * wire.x0 + 2 * u * t * mx0 + t * t * wire.x1 + 2.5 * Math.sin(T * 1.7 + j * 1.9); y = u * u * wire.y0 + 2 * u * t * my0 + t * t * wire.y1 + 9;
					g.globalAlpha = 0.95; g.drawImage(bulbGlow, x - 44, y - 44, 88, 88);
					g.globalAlpha = 0.3; g.drawImage(bulbHalo, x - 120, y - 120, 240, 240);
				}
				// moths round the lamp over the door
				g.globalAlpha = 0.8;
				for (j = 0; j < 3; j++) { g.drawImage(starSpr, lampP.x + Math.cos(T * (2.1 + j * 0.7) + j * 2) * (16 + j * 7) - 3, lampP.y + 4 + Math.sin(T * (2.9 + j * 0.5) + j) * (10 + j * 4) - 3, 6, 6); }
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			}
			if (rain) { rain(g, W, 1080, d, 0.14, 0.9); }
			if (snow) { snow(g, W, 1080, d, 0.02, 1); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "city-rooftop", label: "City: rooftop at dusk", colors: ["16224f", "ff9a5c", "ffc46b"], start: startRooftop });

	// ================================================================ 5. pixel-art city
	// Drawn small (the short side of the picture is about 270 art pixels) and enlarged with hard edges. Every colour comes
	// from one short list built from the three scene colours; skies and haze are stepped and dithered, never blended.
	var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
	function startPixel(host, o) {
		// The kit keeps the art-pixel grid whole and fixed (4 screen pixels to an art pixel on a 1080-high source), so the
		// sharpness setting and the load governor leave this scene alone: it is the cheapest of the six as it is.
		var S = settings(o), sc = scene(host, { fps: 30, pixelated: true, artPixel: 4 });
		var tod = S.time || "night", sunny = tod === "sunset" || tod === "golden" || tod === "dawn", snowy = S.weather === "snow", rainy = S.weather === "rain", foggy = S.weather === "fog";
		var c1 = rgb(S.c1), c2 = rgb(S.c2), c3 = rgb(S.c3), WHITE = [255, 255, 255], TW = 640, T = Math.random() * 400, AW = 0, AH = 0, hk = 1, drop = 0;
		// the palette
		var SKY = [mul(c1, 0.7), c1, hueMix(c1, c2, 0.26), hueMix(c1, c2, 0.5), hueMix(c1, c2, 0.76), c2, mx(c2, c3, sunny ? 0.5 : 0.28)];
		var BLD = [mx(mul(c1, 0.3), [6, 6, 14], 0.4), mx(mul(c1, 0.55), hueMix(c1, c2, 0.3), 0.22), mx(mul(c1, 0.85), hueMix(c1, c2, 0.42), 0.45), mx(c1, hueMix(c1, c2, 0.62), 0.6)];
		var RIM = hueMix(c1, c2, 0.7), W1 = css(c3), W2c = mx(c3, c2, 0.45), W3c = mx([120, 226, 255], c3, 0.15), N1 = css(mx(c2, WHITE, 0.3)), N2 = css(tune(c2, 150, 0.9, 1.15)), RED = "#ff4a4a";
		var SNOW = css(mx([226, 238, 255], c1, 0.08)), SNOW2 = css(mx([226, 238, 255], c1, 0.3)), LIGHT = css(mx(c3, WHITE, 0.6)), MOON = sunny ? mx(c3, WHITE, 0.35) : mx([255, 246, 214], c3, 0.2);
		var skyCv = null, L = [], track = null, train = null, clouds = [], stars = [], fogCv = null, flakes = null, twAcc = 0, moonX = 0, moonY = 0;
		var tr = { on: false, wait: 7 + Math.random() * 6, x: 0, dir: 1 }, shoot = { t: 9, x: 0, y: 0, wait: 12 + Math.random() * 20 };

		function disc(c, cx, cy, r) { var y, x; for (y = -r; y <= r; y++) { x = Math.floor(Math.sqrt(r * r - y * y) + 0.5); c.fillRect(cx - x, cy + y, 2 * x + 1, 1); } }
		function ditherRow(c, x0, x1, y, density) { var x, d = density * 16, row = (y & 3) * 4; for (x = x0; x < x1; x++) { if (BAYER[row + (x & 3)] < d) { c.fillRect(x, y, 1, 1); } } }
		function paintSky() {
			var cv = K.canvas(AW, AH), c = cv.getContext("2d"), img = c.createImageData(AW, AH), d = img.data, x, y, f, k, t, a, b, p = 0, n = SKY.length - 1, q, r, dx, dy, dist, R = K.seeded("pixsky");
			for (y = 0; y < AH; y++) {
				f = Math.min(0.999, Math.pow(y / (AH * 0.74), 0.85)) * n; k = Math.floor(f); t = K.clamp((f - k - 0.3) / 0.4, 0, 1) * 16; a = SKY[k]; b = SKY[k + 1];
				for (x = 0; x < AW; x++) { q = BAYER[(y & 3) * 4 + (x & 3)] < t ? b : a; d[p++] = q[0]; d[p++] = q[1]; d[p++] = q[2]; d[p++] = 255; }
			}
			c.putImageData(img, 0, 0);
			if (!sunny) { for (k = 0; k < 90; k++) { c.fillStyle = css(mx(SKY[3], WHITE, 0.3 + R() * 0.4)); c.fillRect(Math.floor(R() * AW), Math.floor(R() * R() * AH * 0.6), 1, 1); } }
			moonX = Math.round(AW * (sunny ? 0.3 : S.layout === "center" ? 0.84 : 0.76)); moonY = Math.round(sunny ? AH - 114 * hk + drop : Math.min(34 + AH * 0.07, AH * 0.5)); r = sunny ? 34 : 19;
			// a ring of dithered light round it
			for (dy = -r - 9; dy <= r + 9; dy++) {
				for (dx = -r - 9; dx <= r + 9; dx++) {
					dist = Math.sqrt(dx * dx + dy * dy);
					if (dist > r && dist < r + 9 && BAYER[((moonY + dy) & 3) * 4 + ((moonX + dx) & 3)] < (r + 9 - dist) * 1.3) { c.fillStyle = css(mx(SKY[Math.min(n, Math.floor(Math.min(0.999, Math.pow(Math.max(0, moonY + dy) / (AH * 0.74), 0.85)) * n) + 1)], MOON, 0.3)); c.fillRect(moonX + dx, moonY + dy, 1, 1); }
				}
			}
			if (sunny) {
				// a low sun in three flat bands, sliced by lines of sky toward its foot
				for (dy = -r; dy <= r; dy++) {
					x = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
					if (dy > 2 && (dy + 1) % 5 < (dy > 16 ? 2 : 1)) { continue; }
					c.fillStyle = css(dy < -8 ? mx(c3, WHITE, 0.55) : dy < 8 ? c3 : mx(c3, c2, 0.6)); c.fillRect(moonX - x, moonY + dy, 2 * x + 1, 1);
				}
			} else {
				c.fillStyle = css(MOON); disc(c, moonX, moonY, r);
				c.fillStyle = css(mx(MOON, SKY[2], 0.3)); disc(c, moonX - 6, moonY - 4, 4); disc(c, moonX + 7, moonY + 6, 3); disc(c, moonX + 5, moonY - 9, 2); c.fillRect(moonX - 3, moonY + 9, 3, 2);
				c.fillStyle = css(mx(MOON, WHITE, 0.6)); for (dy = -r + 3; dy < r - 6; dy++) { c.fillRect(moonX - Math.floor(Math.sqrt(r * r - dy * dy)) + 1, moonY + dy, 1, 1); }
			}
			return cv;
		}
		// A chunky cloud in three tones: lit rim on top, body, shaded belly, flat underneath.
		function cloudSprite(R, w, far) {
			var h = Math.round(w * 0.42) + 6, cv = K.canvas(w, h), c = cv.getContext("2d"), n = 4 + Math.floor(w / 14), i2, r, pass, base = h - 2;
			var blobs = [], top = css(mx(SKY[far ? 4 : 5], MOON, far ? 0.3 : 0.5)), mid = css(mx(SKY[far ? 3 : 4], MOON, far ? 0.06 : 0.14)), low = css(mx(SKY[far ? 2 : 3], BLD[2], 0.25));
			for (i2 = 0; i2 < n; i2++) { r = 3 + Math.floor(R() * w * 0.13); blobs.push([Math.round(r + 1 + (w - 2 * r - 2) * (i2 / (n - 1))), base - Math.floor(r * (0.3 + R() * 0.7)), r]); }
			for (pass = 0; pass < 3; pass++) {
				c.globalCompositeOperation = pass ? "source-atop" : "source-over"; c.fillStyle = pass === 0 ? top : pass === 1 ? mid : low;
				for (i2 = 0; i2 < n; i2++) { disc(c, blobs[i2][0], blobs[i2][1] + (pass === 0 ? 0 : pass === 1 ? 2 : Math.round(blobs[i2][2] * 0.9) + 2), blobs[i2][2]); }
				if (pass === 0) { c.fillRect(4, base - 3, w - 8, 3); }
			}
			c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; c.fillRect(0, base, w, h - base);
			c.fillRect(0, base - 1, 2, 1); c.fillRect(w - 2, base - 1, 2, 1);
			return cv;
		}
		// One depth of the skyline as a strip that repeats sideways.
		function strip(seed, P) {
			var h = Math.round(P.h * hk), cv = K.canvas(TW, h), c = cv.getContext("2d"), R = K.seeded(seed), x = 0, w, bh, top, wx, wy, st, k, col, lit, ax, sw, sh, j, n;
			var out = { cv: cv, c: c, tw: [], bl: [], h: h, y: 0, sp: P.sp, off: 0 }, body = css(P.col), edge = css(mx(P.col, RIM, 0.28)), shade = css(mul(P.col, 0.76)), glass = css(mx(P.col, RIM, 0.16)), W2 = css(mx(W2c, P.col, P.dim)), W3 = css(mx(W3c, P.col, P.dim)), Wb = css(mx(c3, P.col, P.dim * 0.6));
			function roofSnow(x0, y0, ww) { if (snowy) { c.fillStyle = SNOW; c.fillRect(x0, y0, ww, P.snow); if (P.snow > 1) { c.fillStyle = SNOW2; c.fillRect(x0 + 1, y0 + P.snow, ww - 2, 1); } } }
			while (x < TW - 4) {
				w = P.wMin + Math.floor(R() * (P.wMax - P.wMin + 1)); if (x + w > TW - 3) { w = TW - x; }
				bh = Math.floor((P.hMin + (P.hMax - P.hMin) * Math.pow(R(), 1.7)) * hk); top = h - bh;
				c.fillStyle = body; c.fillRect(x, top, w, bh);
				c.fillStyle = edge; c.fillRect(x, top, 1, bh); c.fillRect(x, top, w, 1);
				c.fillStyle = shade; c.fillRect(x + w - 1, top + 1, 1, bh - 1);
				roofSnow(x, top, w);
				k = R(); sw = 0;
				if (P.detail && w > 13 && k < 0.36) {
					// a set-back top storey
					sw = w - 4 - 2 * Math.floor(R() * 3); sh = 3 + Math.floor(R() * 9); ax = x + ((w - sw) >> 1);
					c.fillStyle = body; c.fillRect(ax, top - sh, sw, sh); c.fillStyle = edge; c.fillRect(ax, top - sh, 1, sh); c.fillRect(ax, top - sh, sw, 1); c.fillStyle = shade; c.fillRect(ax + sw - 1, top - sh + 1, 1, sh - 1);
					roofSnow(ax, top - sh, sw);
					if (R() < 0.6) { n = 5 + Math.floor(R() * 12); c.fillStyle = body; c.fillRect(ax + (sw >> 1), top - sh - n, 1, n); out.bl.push([ax + (sw >> 1), top - sh - n - 1]); }
				} else if (P.detail && k < 0.58 && w > 9) {
					// a water tank on legs
					ax = x + 2 + Math.floor(R() * (w - 9)); n = P.detail > 1 ? 1 : 0;
					c.fillStyle = shade; c.fillRect(ax, top - 3 - n, 1, 3 + n); c.fillRect(ax + 4 + n, top - 3 - n, 1, 3 + n);
					c.fillStyle = body; c.fillRect(ax - 1, top - 9 - n * 3, 7 + n, 6 + n * 2); c.fillRect(ax, top - 10 - n * 3, 5 + n, 1); c.fillRect(ax + 2, top - 11 - n * 3, 1 + n, 1);
					c.fillStyle = edge; c.fillRect(ax - 1, top - 9 - n * 3, 1, 6 + n * 2); c.fillStyle = shade; c.fillRect(ax - 1, top - 6 - n * 2, 7 + n, 1);
					if (snowy) { c.fillStyle = SNOW; c.fillRect(ax, top - 10 - n * 3, 5 + n, 1); }
				} else if (P.detail > 1 && k < 0.74 && w > 22) {
					// a hoarding on the roof with made-up characters
					sw = 15 + Math.floor(R() * 6); ax = x + 3 + Math.floor(R() * (w - sw - 6));
					c.fillStyle = shade; c.fillRect(ax + 2, top - 3, 1, 3); c.fillRect(ax + sw - 3, top - 3, 1, 3);
					c.fillStyle = css(mul(P.col, 0.5)); c.fillRect(ax, top - 12, sw, 9);
					col = R() < 0.5 ? N1 : N2; c.fillStyle = col; c.fillRect(ax, top - 12, sw, 1); c.fillRect(ax, top - 4, sw, 1); c.fillRect(ax, top - 12, 1, 9); c.fillRect(ax + sw - 1, top - 12, 1, 9);
					c.fillStyle = LIGHT; for (j = 0; j < 3; j++) { for (n = 0; n < 12; n++) { if (R() < 0.55) { c.fillRect(ax + 2 + j * 4 + (n % 3), top - 10 + Math.floor(n / 3), 1, 1); } } }
				} else if (P.detail && k < 0.9) {
					n = 4 + Math.floor(R() * 10); ax = x + 2 + Math.floor(R() * (w - 4)); c.fillStyle = body; c.fillRect(ax, top - n, 1, n); c.fillRect(ax - 1, top - n + 2, 3, 1);
					if (R() < 0.5) { out.bl.push([ax, top - n - 1]); }
				}
				// windows, lit in runs
				lit = P.lit * (0.25 + 1.5 * R());
				for (wy = top + 3; wy + P.wh < h - 1; wy += P.gy) {
					st = R() < lit; k = R() < 0.14;
					for (wx = x + 2; wx + P.ww <= x + w - 2; wx += P.gx) {
						if (R() < 0.42) { st = R() < lit; } else { R(); }
						n = R(); col = n < 0.55 ? Wb : n < 0.88 ? W2 : W3;
						if (st && !k) { c.fillStyle = col; c.fillRect(wx, wy, P.ww, P.wh); } else if (P.glass) { c.fillStyle = glass; c.fillRect(wx, wy, P.ww, P.wh); }
						if (out.tw.length < 90 && R() < P.twP) { out.tw.push([wx, wy, P.ww, P.wh, col, P.glass ? glass : body, st && !k ? 1 : 0]); }
					}
				}
				// a sign down the wall
				if (P.detail > 1 && bh > 40 && R() < 0.4) {
					n = 3 + Math.floor(R() * 4); ax = R() < 0.5 ? x + 2 : x + w - 6; wy = top + 6 + Math.floor(R() * 14); col = R() < 0.5 ? N1 : N2;
					c.fillStyle = css(mul(P.col, 0.45)); c.fillRect(ax - 1, wy - 1, 6, n * 5 + 1);
					for (j = 0; j < n; j++) { c.fillStyle = col; for (k = 0; k < 12; k++) { if (R() < 0.6) { c.fillRect(ax + (k % 4), wy + j * 5 + Math.floor(k / 4), 1, 1); } } }
				}
				x += w + (R() < P.gapP ? 1 + Math.floor(R() * P.gapMax) : 0);
			}
			if (P.hazeH) {
				c.globalCompositeOperation = "source-atop"; c.fillStyle = css(P.haze);
				n = Math.round(P.hazeH * hk);
				for (wy = h - n; wy < h; wy++) { ditherRow(c, 0, TW, wy, (wy - (h - n)) / n * P.hazeMax); }
				c.globalCompositeOperation = "source-over";
			}
			return out;
		}
		function build() {
			var R = K.seeded("pixclouds"), j, c, x, cv, n;
			AW = sc.cv.width; AH = sc.cv.height; hk = K.clamp(AH / 270, 1, 1.6);
			// on a very short picture the skyline sinks, so its roofs and the sky stay in view rather than only the street
			drop = AH < 190 ? Math.min(110, 190 - AH) : 0;
			skyCv = paintSky();
			L = [
				strip("pixfar", { h: 104, col: BLD[3], wMin: 8, wMax: 20, hMin: 22, hMax: 96, ww: 1, wh: 1, gx: 3, gy: 4, lit: 0.26, dim: 0.5, glass: false, detail: 0, snow: 1, twP: 0.03, gapP: 0.3, gapMax: 6, hazeH: 34, hazeMax: 0.8, haze: SKY[5], sp: 2 }),
				strip("pixmid", { h: 146, col: BLD[2], wMin: 12, wMax: 28, hMin: 34, hMax: 134, ww: 1, wh: 2, gx: 3, gy: 5, lit: 0.3, dim: 0.3, glass: false, detail: 1, snow: 1, twP: 0.03, gapP: 0.35, gapMax: 8, hazeH: 30, hazeMax: 0.6, haze: SKY[4], sp: 4 }),
				strip("pixnear", { h: 182, col: BLD[1], wMin: 20, wMax: 44, hMin: 46, hMax: 172, ww: 2, wh: 3, gx: 4, gy: 6, lit: 0.32, dim: 0.12, glass: true, detail: 2, snow: 2, twP: 0.04, gapP: 0.5, gapMax: 14, hazeH: 22, hazeMax: 0.35, haze: SKY[3], sp: 7 }),
				strip("pixfront", { h: 62, col: BLD[0], wMin: 40, wMax: 92, hMin: 16, hMax: 56, ww: 3, wh: 4, gx: 6, gy: 8, lit: 0.3, dim: 0, glass: true, detail: 2, snow: 2, twP: 0.1, gapP: 0, gapMax: 0, hazeH: 0, sp: 12 })
			];
			L[0].y = AH - L[0].h - Math.round(30 * hk) + drop; L[1].y = AH - L[1].h - Math.round(18 * hk) + drop; L[2].y = AH - L[2].h - Math.round(8 * hk) + drop; L[3].y = AH - L[3].h + drop;
			// the raised railway: a deck on legs, repeating
			n = Math.round(60 * hk); cv = K.canvas(TW, n); c = cv.getContext("2d");
			c.fillStyle = css(mul(BLD[1], 0.8)); c.fillRect(0, 2, TW, 4);
			c.fillStyle = css(mx(BLD[1], RIM, 0.5)); c.fillRect(0, 1, TW, 1);
			c.fillStyle = css(mul(BLD[1], 0.55)); c.fillRect(0, 6, TW, 1);
			for (x = 0; x < TW; x += 4) { c.fillRect(x, 0, 1, 1); }
			for (x = 16; x < TW; x += 64) {
				c.fillStyle = css(mul(BLD[1], 0.8)); c.fillRect(x, 6, 4, n - 6); c.fillRect(x - 3, 6, 10, 2); c.fillRect(x - 1, 8, 6, 1);
				c.fillStyle = css(mx(BLD[1], RIM, 0.4)); c.fillRect(x, 8, 1, n - 8);
			}
			if (snowy) { c.fillStyle = SNOW; c.fillRect(0, 1, TW, 1); }
			track = { cv: cv, y: AH - Math.round(74 * hk) + drop };
			// the train: four cars, lit windows, a lamp at each end
			cv = K.canvas(180, 16); c = cv.getContext("2d");
			for (j = 0; j < 4; j++) {
				x = 6 + j * 42;
				c.fillStyle = css(mx(BLD[2], [150, 160, 190], 0.3)); c.fillRect(x, 3, 40, 10);
				c.fillStyle = css(mx(BLD[2], WHITE, 0.45)); c.fillRect(x + 1, 2, 38, 1);
				c.fillStyle = N1; c.fillRect(x, 10, 40, 1);
				c.fillStyle = css(mul(BLD[1], 0.7)); c.fillRect(x + 3, 13, 5, 2); c.fillRect(x + 32, 13, 5, 2); c.fillRect(x + 40, 8, 2, 1);
				c.fillStyle = W1; for (n = 0; n < 5; n++) { c.fillRect(x + 3 + n * 7, 5, 5, 4); }
				c.fillStyle = css(mul(BLD[1], 0.9)); c.fillRect(x + 17, 4, 1, 8); c.fillRect(x + 22, 4, 1, 8);
				if (snowy) { c.fillStyle = SNOW; c.fillRect(x + 1, 2, 38, 1); }
			}
			c.clearRect(6, 3, 2, 3); c.clearRect(8, 3, 1, 1); c.clearRect(170, 3, 2, 3); c.clearRect(169, 3, 1, 1);
			c.fillStyle = LIGHT; c.fillRect(6, 10, 2, 2); c.fillStyle = RED; c.fillRect(170, 10, 2, 2);
			c.fillStyle = css(mx(c3, WHITE, 0.3), 0.5); for (j = 0; j < 6; j++) { ditherRow(c, 0, 6 - j % 2, 8 + j, 0.5); }
			train = cv;
			clouds = [];
			for (j = 0; j < 7; j++) { n = j < 4; cv = cloudSprite(R, n ? 26 + Math.floor(R() * 30) : 44 + Math.floor(R() * 44), n); clouds.push({ cv: cv, x: R() * (AW + 120) - 60, y: Math.round((n ? 0.2 : 0.07) * AH + R() * AH * (n ? 0.26 : 0.3)), sp: n ? 1.2 + R() : 2.6 + R() * 1.6 }); }
			stars = [];
			if (!sunny) { for (j = 0; j < 46; j++) { stars.push([Math.floor(R() * AW), Math.floor(R() * R() * AH * 0.55), R() * TAU, 0.4 + R() * 1.6]); } }
			if (foggy) {
				fogCv = K.canvas(TW, 56); c = fogCv.getContext("2d"); c.fillStyle = css(mx(SKY[4], WHITE, 0.3));
				for (j = 0; j < 56; j++) { for (x = 0; x < TW; x += 8) { n = fbm(x / TW * 10, j / 14, 10, 5, 3) * Math.sin(Math.PI * (j + 0.5) / 56); ditherRow(c, x, x + 8, j, K.clamp((n - 0.2) * 2.4, 0, 0.9)); } }
			}
			if (snowy || rainy) { n = Math.round((snowy ? 90 : 70) * S.detail); flakes = new Float32Array(n * 3); for (j = 0; j < n; j++) { flakes[j * 3] = Math.random() * AW; flakes[j * 3 + 1] = Math.random() * AH; flakes[j * 3 + 2] = 0.4 + Math.random() * 0.6; } }
		}
		function toggle() {
			var P = L[(Math.random() * L.length) | 0], w;
			if (!P || !P.tw.length) { return; }
			w = P.tw[(Math.random() * P.tw.length) | 0]; w[6] = w[6] ? 0 : 1;
			P.c.fillStyle = w[6] ? w[4] : w[5]; P.c.fillRect(w[0], w[1], w[2], w[3]);
		}
		function layer(g, P) {
			var off = Math.floor(P.off) % TW, x, j, b;
			for (x = -off; x < AW; x += TW) { g.drawImage(P.cv, x, P.y); }
			// warning lights on the masts, one pixel each, on every copy of the strip
			g.fillStyle = RED;
			for (j = 0; j < P.bl.length; j++) {
				b = P.bl[j];
				if (Math.sin(T * 2.4 + b[0]) <= 0.2) { continue; }
				for (x = b[0] - off; x < AW; x += TW) { if (x >= 0) { g.fillRect(x, P.y + b[1], 1, 1); } }
			}
		}

		sc.frame = function (g, dt) {
			var d = dt * S.speed, j, c, x, y, s, a, n, off;
			if (sc.cv.width !== AW || sc.cv.height !== AH || !skyCv) { build(); }
			T += d;
			g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
			g.drawImage(skyCv, 0, 0);
			for (j = 0; j < stars.length; j++) {
				s = stars[j]; a = Math.sin(T * s[3] + s[2]);
				if (a > 0.1) { g.fillStyle = a > 0.72 ? "#ffffff" : LIGHT; g.fillRect(s[0], s[1], 1, 1); if (a > 0.93 && j % 5 === 0) { g.fillRect(s[0] - 1, s[1], 3, 1); g.fillRect(s[0], s[1] - 1, 1, 3); } }
			}
			// a falling star now and then
			if (!sunny) {
				shoot.wait -= d;
				if (shoot.wait <= 0) { shoot.wait = (18 + Math.random() * 40) / S.detail; shoot.t = 0; shoot.x = AW * (0.15 + Math.random() * 0.6); shoot.y = AH * (0.04 + Math.random() * 0.2); }
				if (shoot.t < 0.7) { shoot.t += d; g.fillStyle = "#ffffff"; for (j = 0; j < 7; j++) { if (j < 2 || (j & 1) === 0) { g.fillRect(Math.floor(shoot.x + shoot.t * 150 - j * 2), Math.floor(shoot.y + shoot.t * 60 - j * 0.8), j < 3 ? 2 : 1, 1); } } }
			}
			for (j = 0; j < clouds.length; j++) {
				c = clouds[j]; c.x -= c.sp * d;
				if (c.x < -c.cv.width - 4) { c.x = AW + 4 + Math.random() * 40; }
				g.drawImage(c.cv, Math.floor(c.x), c.y);
			}
			// a far aircraft: a white wink and a steady red
			x = Math.floor((T * 9) % (AW + 240)) - 120; y = Math.floor(AH * 0.13 + x * 0.03);
			g.fillStyle = RED; g.fillRect(x, y, 1, 1);
			if ((T * 1.1) % 1 < 0.12) { g.fillStyle = "#ffffff"; g.fillRect(x + 2, y, 1, 1); }
			for (j = 0; j < 3; j++) { L[j].off += L[j].sp * d; layer(g, L[j]); }
			if (fogCv) { off = Math.floor(T * 3) % TW; for (x = -off; x < AW; x += TW) { g.drawImage(fogCv, x, AH - Math.round(130 * hk) + drop); } }
			// the railway and, now and then, a train
			off = Math.floor(L[2].off) % TW;
			for (x = -off; x < AW; x += TW) { g.drawImage(track.cv, x, track.y); }
			if (tr.on) {
				tr.x += tr.dir * 86 * d - L[2].sp * d;
				x = Math.floor(tr.x);
				if (tr.dir > 0) { g.save(); g.translate(x + 180, 0); g.scale(-1, 1); g.drawImage(train, 0, track.y - 14); g.restore(); } else { g.drawImage(train, x, track.y - 14); }
				if (x > AW + 30 || x < -220) { tr.on = false; tr.wait = (16 + Math.random() * 22) / S.detail; }
			} else {
				tr.wait -= d;
				if (tr.wait <= 0) { tr.on = true; tr.dir = Math.random() < 0.5 ? 1 : -1; tr.x = tr.dir > 0 ? -200 : AW + 10; }
			}
			if (fogCv) { off = Math.floor(T * 5 + 300) % TW; for (x = -off; x < AW; x += TW) { g.drawImage(fogCv, x, AH - Math.round(96 * hk) + drop); } }
			L[3].off += L[3].sp * d; layer(g, L[3]);
			if (flakes) {
				n = flakes.length / 3;
				if (snowy) {
					g.fillStyle = "#ffffff";
					for (j = 0; j < n; j++) {
						s = flakes[j * 3 + 2]; flakes[j * 3 + 1] += (9 + 22 * s) * d; flakes[j * 3] += (Math.sin(T * 1.3 + j) * 6 - 5 * s) * d;
						if (flakes[j * 3 + 1] > AH) { flakes[j * 3 + 1] = -2; flakes[j * 3] = Math.random() * (AW + 20); }
						if (flakes[j * 3] < -2) { flakes[j * 3] += AW + 4; }
						a = s > 0.8 ? 2 : 1; g.fillRect(Math.floor(flakes[j * 3]), Math.floor(flakes[j * 3 + 1]), a, a);
					}
				} else {
					g.fillStyle = css(mx(SKY[5], WHITE, 0.6));
					for (j = 0; j < n; j++) {
						s = flakes[j * 3 + 2]; flakes[j * 3 + 1] += (150 + 130 * s) * d; flakes[j * 3] -= 30 * d;
						if (flakes[j * 3 + 1] > AH) { flakes[j * 3 + 1] = -4; flakes[j * 3] = Math.random() * (AW + 40); }
						g.fillRect(Math.floor(flakes[j * 3]), Math.floor(flakes[j * 3 + 1]), 1, s > 0.7 ? 4 : 3);
					}
				}
			}
			twAcc += d * 2.6 * S.detail;
			while (twAcc >= 1) { twAcc -= 1; toggle(); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "city-pixel", label: "City: pixel-art city night", colors: ["10133a", "a8508c", "ffd76a"], start: startPixel });

	// ================================================================ 6. harbour city at dawn
	var BOX_COLS = [[176, 68, 52], [42, 122, 128], [38, 64, 118], [196, 148, 62], [118, 124, 132], [206, 206, 198], [64, 118, 74], [150, 78, 110]];
	// A stack of shipping containers side-on: cols wide, up to rows high. tone = the silhouette colour they sink toward.
	function boxStack(g, R, x, base, cols, rows, bw, bh, tone, sink, rim) {
		var i, j, n, c;
		for (i = 0; i < cols; i++) {
			n = Math.max(1, Math.round(rows * (0.45 + 0.55 * R())));
			for (j = 0; j < n; j++) {
				c = mx(BOX_COLS[Math.floor(R() * BOX_COLS.length)], tone, sink);
				g.fillStyle = css(c); g.fillRect(x + i * (bw + 1), base - (j + 1) * (bh + 0.8), bw, bh);
				g.fillStyle = css(mul(c, 0.78)); g.fillRect(x + i * (bw + 1), base - (j + 1) * (bh + 0.8) + bh * 0.72, bw, bh * 0.28);
				g.fillStyle = css(mul(c, 0.86), 0.7); for (c = 3; c < bw - 2; c += 4) { g.fillRect(x + i * (bw + 1) + c, base - (j + 1) * (bh + 0.8) + 1.5, 1, bh - 3); }
				if (rim) { g.fillStyle = css(rim, 0.55); g.fillRect(x + i * (bw + 1), base - (j + 1) * (bh + 0.8), bw, 1.2); g.fillRect(x + i * (bw + 1) + bw - 1.2, base - (j + 1) * (bh + 0.8), 1.2, bh); }
			}
		}
	}
	// A ship-to-shore crane in silhouette, standing at x on the quay, its boom reaching left over the water (or raised).
	// Returns where its trolley runs: [x0, x1, y].
	function quayCrane(g, lc, x, base, s, up, col, rim, lamp, tips) {
		var gy = base - 150 * s, i;
		function bar(x0, y0, x1, y1, w) { g.lineWidth = w * s; g.beginPath(); g.moveTo(x + x0 * s, base + y0 * s); g.lineTo(x + x1 * s, base + y1 * s); g.stroke(); }
		g.strokeStyle = css(col); g.fillStyle = css(col); g.lineCap = "butt";
		bar(0, 0, 0, -158, 6); bar(64, 0, 64, -158, 6); bar(-4, -5, 68, -5, 5); bar(0, -62, 64, -62, 5);
		bar(0, -62, 64, -150, 2.2); bar(64, -62, 0, -150, 2.2); bar(0, -5, 64, -62, 2); bar(64, -5, 0, -62, 2);
		bar(-2, -154, 140, -154, 9);
		bar(0, -158, 30, -234, 4.5); bar(64, -158, 30, -234, 4.5); bar(30, -234, 30, -246, 2.5); bar(22, -234, 38, -234, 4);
		bar(30, -234, 140, -158, 1.6);
		g.fillRect(x + 72 * s, gy - 30 * s, 52 * s, 26 * s);
		if (up) {
			g.save(); g.translate(x, gy - 4 * s); g.rotate(1.28);
			g.fillRect(-150 * s, -4 * s, 150 * s, 8 * s); g.fillRect(-150 * s, -11 * s, 150 * s, 2 * s);
			for (i = 0; i < 150; i += 15) { g.fillRect(-i * s - 1.6 * s, -11 * s, 1.6 * s, 8 * s); }
			g.restore();
			bar(30, -234, -27, -249, 1.6);
		} else {
			bar(-152, -154, 0, -154, 9); bar(-152, -163, 0, -163, 2);
			for (i = -150; i < 0; i += 15) { bar(i, -163, i, -154, 1.6); }
			bar(30, -234, -70, -160, 1.6); bar(30, -234, -148, -160, 1.6);
			lc.fillStyle = css(lamp);
			for (i = -140; i < 0; i += 28) { lc.fillRect(x + i * s - 1, gy + 1.5 * s, 2.2, 2.2); }
		}
		lc.fillStyle = css(lamp); lc.fillRect(x + 80 * s, gy - 22 * s, 6 * s, 5 * s); lc.fillRect(x + 62 * s - 1, base - 64 * s, 2.4, 2.4);
		if (rim) { g.fillStyle = css(rim, 0.6); g.fillRect(x + 66 * s - 1.4, gy, 1.4, 150 * s); g.fillRect(x + 2 * s - 1.4, gy, 1.4, 150 * s); g.fillRect(x + 124 * s - 1.4, gy - 30 * s, 1.4, 26 * s); }
		if (tips) { tips.push([x + 30 * s, base - 248 * s]); }
		return up ? null : [x - 140 * s, x - 14 * s, gy + 1 * s];
	}
	function startHarbor(host, o) {
		var S = settings(o), sc = scene(host, { fps: 30, quality: S.quality, maxPixels: FULL_HD });
		var tod = S.time || "dawn", night = tod === "night", dusk = tod === "dusk", misty = S.weather === "fog", rainy = S.weather === "rain", snowy = S.weather === "snow", clear = S.weather === "clear";
		var c1 = rgb(S.c1), c2 = rgb(S.c2), c3 = rgb(S.c3), WHITE = [255, 255, 255], HZ = 650, CH0 = 430, T = Math.random() * 300, twAcc = 0, i;
		var sunUp = !night && !dusk, sunU = 0.745, sunY = HZ - 100, sunR = 42, dim = rainy ? 0.7 : misty ? 0.85 : 1, plainK = night ? 1 : dusk ? 0.7 : 0.25;
		var sunC = c3, hazeC = mx(c2, c3, 0.35), far = mx(mul(mx(c1, c2, 0.3), night ? 0.8 : 1.08), WHITE, night ? 0 : 0.04), near = mx(mul(c1, 0.3), c2, 0.06), mid = mx(mul(c1, 0.48), c2, 0.14);
		var pal = [WIN_WARM, WIN_AMBER, mx(WIN_WARM, WHITE, 0.4), WIN_COOL], lampC = [255, 222, 168], tips = [], tw = [], shoreCtx = null, trol = null, stackTop = 0;
		var litC = mul(mx(mx(c2, c3, 0.5), WHITE, 0.2), night ? 0.4 : 1), shadeC = mx(mx(c1, c2, 0.3), mul(c1, 0.85), 0.3), rimC = mul(mx(c3, WHITE, 0.5), night ? 0.5 : 1);
		var clouds = [
			{ tex: cloudTex(107, 512, 128, 6, 3, rainy ? 0.75 : 0.44, 0.12, mx(litC, WHITE, 0.2), mx(shadeC, c1, 0.2), rimC, 0.6), y: 16, h: 290, bw: 3200, sp: 2.2 },
			{ tex: cloudTex(113, 640, 128, 6, 2, rainy ? 0.8 : 0.5, 0.08, litC, shadeC, rimC, 0.85), y: 250, h: 250, bw: 2800, sp: 4.6 }
		];
		var ripple = rippleTex("harbrip", mx(mx(c2, c3, 0.5), WHITE, 0.3), mul(c1, 0.5)), glitter = makeGlitter(Math.round(70 * S.detail), mx(sunC, WHITE, 0.25));
		var birds = makeBirds(Math.max(3, Math.round(6 * S.detail)), css(mul(c1, 0.34)), { y0: 180, y1: 520, size: 15, speed: 74, gap: 26 / S.detail, first: 2 });
		var mistA = fogTex(131, mx(hazeC, WHITE, 0.55), 384, 96, 5, 2, 0.28, 0.76), mistB = fogTex(137, mx(hazeC, WHITE, 0.4), 384, 96, 4, 2, 0.3, 0.8), mistK = clear ? 0.35 : misty ? 1.5 : 1;
		var tipSpr = K.glow("#ff3b3b", 40, 0.3), lampSpr = K.glow(css(lampC), 96, 0.12), buoySpr = K.glow("#ff5a48", 48, 0.3), smoke = K.particles(46), puff = K.glow(css(mx(mx(c2, c3, 0.4), WHITE, 0.35)), 96, 0.02), smokeAcc = 0, stackPos = [0, 0];
		var rain = rainy ? makeRain(S.detail, [215, 225, 240]) : null, snow = snowy ? makeSnow(S.detail, [255, 255, 255]) : null;
		function ks() { return K.clamp(sc.W / 1400, 0.62, 1); }
		function band(t) { var v = hueMix(c1, c2, t); return plainK ? mx(v, mx(c1, c2, t), plainK) : v; }
		function sky() {
			return sc.layer("sky", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, HZ), sx = sunU * W, r, R = K.seeded("harbsky"), j, y;
				skyBands(gr, c1, c2, c3, 0.82, sunUp ? 0.5 : 0.12, plainK);
				g.fillStyle = gr; g.fillRect(0, 0, W, h);
				if (night || dusk) { for (j = 0; j < (night ? 240 : 90); j++) { y = R() * R() * (HZ - 140); g.fillStyle = css(WHITE, (0.25 + R() * 0.7) * (1 - y / (HZ - 80))); r = R() < 0.12 ? 1.7 : 1; g.fillRect(R() * W, y, r, r); } }
				g.save(); g.translate(sx, Math.min(sunY, HZ)); g.scale(1.8, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 460);
				r.addColorStop(0, css(mx(sunC, WHITE, 0.4), sunUp ? 0.95 * dim : 0.3)); r.addColorStop(0.16, css(sunC, sunUp ? 0.6 * dim : 0.14)); r.addColorStop(0.5, css(mx(sunC, c2, 0.6), sunUp ? 0.22 * dim : 0.05)); r.addColorStop(1, css(c2, 0));
				g.fillStyle = r; g.fillRect(-480, -480, 960, 960); g.restore();
				if (sunUp) {
					r = g.createRadialGradient(sx, sunY, 0, sx, sunY, sunR);
					r.addColorStop(0, css(mx(sunC, WHITE, 0.95))); r.addColorStop(0.82, css(mx(sunC, WHITE, 0.75))); r.addColorStop(0.96, css(mx(sunC, WHITE, 0.4))); r.addColorStop(1, css(sunC, 0));
					g.fillStyle = r; g.beginPath(); g.arc(sx, sunY, sunR, 0, TAU); g.fill();
				}
				grain(g, W, h, 0.03);
			}, sc.W, snap(sc, HZ + 2));
		}
		// everything on the far side of the water: the city (left), the container terminal (right)
		function shore() {
			return sc.layer("shore", function (g, W, h) {
				var lc = lightCanvas(g, W, h), base = CH0, R = K.seeded("harbour7"), s = ks(), sx = sunU * W, x, j, r, q, n, gr, quay0 = Math.min(0.46 * W, W - 560 * s);
				var hz1 = { col: mx(hazeC, c1, 0.22), a0: 0.04, a1: 0.4, y0: base - 220, y1: base }, rim = sunUp ? mx(sunC, WHITE, 0.2) : null;
				tips = []; tw = []; shoreCtx = g;
				g.fillStyle = css(mx(far, hazeC, 0.5));
				g.beginPath(); g.moveTo(0, base + 2);
				for (x = 0; x <= W + 16; x += 16) { g.lineTo(x, base - 10 - 44 * fbm(x / 300, 0.7, 64, 9, 3)); }
				g.lineTo(W + 16, base + 2); g.fill();
				skyline(g, lc, {
					seed: "harbcity", W: W, x0: -30, x1: 0.66 * W, base: base, hMin: 18, hMax: 330, wMin: 22, wMax: 52, body: far, cell: 5, lit: night ? 0.55 : dusk ? 0.5 : 0.24, pal: pal,
					env: function (u) { var d = (u - 0.27) / 0.2; return 0.1 + 0.9 * Math.exp(-d * d); }, rim: rim, rimA: 0.75, rimSide: 1, tips: tips, tw: tw, twP: 0.07, twMax: 500,
					tint: function (c, y) { return hazeTint(c, hz1, y); }, heroes: [[0.25, 50, 350, 0.8], [0.33, 44, 286, 0.6], [0.17, 46, 250, 0.9]]
				});
				if (sunUp) {
					// the first sun catches the tops of the towers
					gr = g.createLinearGradient(0, base - 360, 0, base - 90);
					gr.addColorStop(0, css(mx(sunC, c2, 0.35), 0.7 * dim)); gr.addColorStop(0.55, css(mx(sunC, c2, 0.5), 0.3 * dim)); gr.addColorStop(1, css(mx(sunC, c2, 0.5), 0));
					g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, W, h); g.globalCompositeOperation = "source-over";
				}
				hazeFill(g, hz1, W, h);
				// sheds, tanks and a chimney behind the quay
				g.fillStyle = css(mid);
				for (x = quay0 + 30; x < W + 60; x += 150 + R() * 60) { n = 34 + R() * 20; g.beginPath(); g.moveTo(x, base - 12); g.lineTo(x, base - n); for (j = 0; j < 4; j++) { g.lineTo(x + j * 30 + 22, base - n - 13); g.lineTo(x + j * 30 + 30, base - n); } g.lineTo(x + 120, base - 12); g.fill(); }
				x = W - 250 * s; g.fillRect(x, base - 170, 11, 160); g.fillRect(x - 3, base - 176, 17, 7);
				if (rim) { g.fillStyle = css(rim, 0.6); g.fillRect(x + 9.4, base - 170, 1.6, 150); }
				stackPos[0] = x + 5; stackPos[1] = HZ - CH0 + base - 180;
				g.fillStyle = css(mid);
				for (j = 0; j < 2; j++) { x = W - (150 - j * 62) * s; g.fillRect(x, base - 62, 54, 52); g.beginPath(); g.ellipse(x + 27, base - 62, 27, 7, 0, Math.PI, 0); g.fill(); if (rim) { g.fillStyle = css(rim, 0.5); g.fillRect(x + 52, base - 62, 2, 50); g.fillStyle = css(mid); } }
				// the quay and its stacks of boxes
				g.fillStyle = css(near); g.fillRect(quay0, base - 13, W - quay0 + 40, 17);
				g.fillStyle = css(mx(near, hazeC, 0.5)); g.fillRect(quay0, base - 13, W - quay0 + 40, 1.6);
				g.fillStyle = css(mul(near, 0.8)); for (x = quay0 + 16; x < W; x += 34) { g.fillRect(x, base - 4, 9, 5); }
				stackTop = HZ - CH0 + base - 13;
				for (x = quay0 + 20; x < W; x += q + 26 + R() * 40) {
					n = 2 + Math.floor(R() * 5); q = n * 39 * s;
					boxStack(g, R, x, base - 13, n, 2 + Math.floor(R() * 4), 38 * s, 15 * s, near, 0.52, rim);
				}
				// light masts
				for (j = 0; j < 3; j++) {
					x = W - (420 - j * 180) * s - 40; if (x < quay0 + 20) { continue; }
					g.fillStyle = css(near); g.fillRect(x - 1.6, base - 200, 3.2, 190); g.fillRect(x - 13, base - 204, 26, 5);
					lc.fillStyle = css(mx(lampC, WHITE, 0.4)); for (q = -10; q <= 10; q += 5) { lc.fillRect(x + q - 1.5, base - 199, 3, 3); }
					lc.save(); lc.translate(x, base - 196); r = lc.createRadialGradient(0, 0, 0, 0, 0, 70); r.addColorStop(0, css(lampC, 0.5)); r.addColorStop(1, css(lampC, 0)); lc.fillStyle = r; lc.fillRect(-70, -70, 140, 140); lc.restore();
				}
				// the cranes
				trol = null;
				if (W > 900) { quayCrane(g, lc, W - 560 * s, base - 13, s, true, near, rim, lampC, tips); }
				trol = quayCrane(g, lc, W - 318 * s, base - 13, s * 1.06, false, near, rim, lampC, tips);
				quayCrane(g, lc, W - 96 * s, base - 13, s * 0.94, false, near, rim, lampC, tips);
				if (trol) { trol.push(s * 1.06); }
				hazeFill(g, { col: hazeC, a0: 0, a1: 0.16, y0: base - 200, y1: base }, W, h);
				if (sunUp) {
					r = g.createRadialGradient(sx, sunY - (HZ - CH0), 0, sx, sunY - (HZ - CH0), 280);
					r.addColorStop(0, css(mx(sunC, WHITE, 0.3), 0.8 * dim)); r.addColorStop(0.3, css(sunC, 0.34 * dim)); r.addColorStop(1, css(sunC, 0));
					g.globalCompositeOperation = "source-atop"; g.fillStyle = r; g.fillRect(0, 0, W, h); g.globalCompositeOperation = "source-over";
				}
				g.drawImage(lc.canvas, 0, 0, W, h);
				bloom(g, lc.canvas, W, h, night || dusk ? 1.1 : 0.8);
			}, sc.W, snap(sc, CH0 + 8));
		}
		function refl() {
			var C = shore();
			return sc.layer("refl", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, h), W0 = sc.W, ch = C.hu;
				soft(g, sc.k, 0, 0, W, h, 4, function (c) {
					c.translate(RM, 0); c.scale(1, -1.15); c.drawImage(C, 0, -CH0, W0, ch);
					c.drawImage(C, 0, 0, 2, C.height, -RM, -CH0, RM + 0.5, ch); c.drawImage(C, C.width - 2, 0, 2, C.height, W0 - 0.5, -CH0, RM + 0.5, ch);
				});
				g.globalCompositeOperation = "source-atop"; g.fillStyle = css(mul(c1, 0.55), 0.3); g.fillRect(0, 0, W, h);
				gr.addColorStop(0, "rgba(0,0,0,0.68)"); gr.addColorStop(0.4, "rgba(0,0,0,0.36)"); gr.addColorStop(0.8, "rgba(0,0,0,0.05)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				g.globalCompositeOperation = "destination-in"; g.fillStyle = gr; g.fillRect(0, 0, W, h); g.globalCompositeOperation = "source-over";
			}, snap(sc, sc.W + 2 * RM), snap(sc, 420));
		}
		function water() {
			return sc.layer("water", function (g, W, h) {
				var gr = g.createLinearGradient(0, 0, 0, h), k = 0.84 * dim;
				gr.addColorStop(0, css(mul(mx(mx(c2, c3, sunUp ? 0.35 : 0.05), c1, 0.1), k))); gr.addColorStop(0.1, css(mul(mx(c2, c1, 0.12), k * 0.95)));
				gr.addColorStop(0.32, css(mul(band(0.7), k * 0.9))); gr.addColorStop(0.6, css(mul(band(0.42), k * 0.82))); gr.addColorStop(1, css(mul(band(0.14), k * 0.72)));
				g.fillStyle = gr; g.fillRect(0, 0, W, h);
				if (sunUp) { lightRoad(g, sc.k, W, h, sunU * W, mx(sunC, WHITE, 0.3), 54, 240, 0.8 * dim, 0.14 * dim); }
				grain(g, W, h, 0.03);
			}, sc.W, snap(sc, 1080 - HZ));
		}
		// the ship: hull, boxes on deck, the bridge aft with its lights on; painted once, with its reflection. SHIP_WL is her
		// waterline in the sprite: everything above it, mast light included (175 up), has to fit.
		var SHIP_WL = 182;
		function ship() {
			var s = ks();
			return sc.layer("ship", function (g, w, h) {
				var lc = lightCanvas(g, w, h), R = K.seeded("ship4"), hull = mx(mul(c1, 0.24), [14, 14, 22], 0.4), wl = SHIP_WL, x, j, rim = sunUp ? mx(sunC, WHITE, 0.2) : null;
				g.scale(s, s); lc.scale(s, s);
				// boxes on deck
				for (x = 86; x < 410; x += 76) { boxStack(g, R, x, wl - 36, 2, 2 + Math.floor(R() * 3), 35, 13, near, 0.42, rim); }
				// the hull, raked at the bow (left), a red boot-topping at the waterline
				g.fillStyle = css(hull); g.beginPath(); g.moveTo(8, wl - 46); g.lineTo(64, wl - 46); g.lineTo(70, wl - 36); g.lineTo(520, wl - 36); g.lineTo(520, wl - 52); g.lineTo(548, wl - 52); g.lineTo(540, wl); g.lineTo(44, wl); g.closePath(); g.fill();
				g.fillStyle = css(mx(hull, [150, 50, 44], 0.6)); g.beginPath(); g.moveTo(38, wl - 7); g.lineTo(541, wl - 7); g.lineTo(540, wl); g.lineTo(44, wl); g.closePath(); g.fill();
				g.fillStyle = css(mx(hull, hazeC, 0.4)); g.fillRect(70, wl - 36, 450, 1.4);
				if (rim) { g.fillStyle = css(rim, 0.5); g.fillRect(8, wl - 46, 56, 1.4); }
				// the bridge and funnel
				g.fillStyle = css(mx(mx(c1, WHITE, 0.36), hazeC, 0.25)); g.fillRect(452, wl - 112, 58, 76); g.fillRect(444, wl - 122, 74, 10);
				g.fillStyle = css(mx(mul(c1, 0.6), hazeC, 0.2)); g.fillRect(452, wl - 112, 58, 3);
				if (rim) { g.fillStyle = css(rim, 0.6); g.fillRect(508, wl - 112, 2, 76); g.fillRect(516, wl - 122, 2, 10); }
				g.fillStyle = css(hull); g.fillRect(488, wl - 150, 18, 30); g.fillStyle = css(mx(c2, [200, 60, 50], 0.5)); g.fillRect(488, wl - 142, 18, 7);
				g.fillStyle = css(hull); g.fillRect(470, wl - 172, 2.4, 50); g.fillRect(462, wl - 160, 18, 2); g.fillRect(30, wl - 78, 2, 32);
				lc.fillStyle = css(WIN_WARM, 0.95);
				for (j = 0; j < 5; j++) { for (x = 457; x < 504; x += 9) { if (R() < 0.42) { lc.fillRect(x, wl - 105 + j * 13, 4, 4); } } }
				lc.fillStyle = css(mx(WIN_COOL, WHITE, 0.2), 0.8); lc.fillRect(448, wl - 119, 66, 3);
				lc.fillStyle = "#ffffff"; lc.fillRect(469.7, wl - 175, 3, 3); lc.fillRect(29.5, wl - 81, 3, 3);
				lc.fillStyle = "#ff5247"; lc.fillRect(440, wl - 124, 3.4, 3.4);
				g.setTransform(g.canvas.width / w, 0, 0, g.canvas.height / h, 0, 0);
				g.drawImage(lc.canvas, 0, 0, w, h);
				bloom(g, lc.canvas, w, h, 1);
			}, snap(sc, 560 * s), snap(sc, (SHIP_WL + 2) * s));
		}
		function shipRefl() {
			var C = ship(), s = ks();
			return sc.layer("shipR", function (g, w, h) {
				var gr = g.createLinearGradient(0, 0, 0, h);
				soft(g, sc.k, 0, 0, w, h, 3, function (c) { c.translate(RM, 0); c.scale(1, -0.8); c.drawImage(C, 0, -SHIP_WL * s, C.wu, C.hu); });
				g.globalCompositeOperation = "source-atop"; g.fillStyle = css(mul(c1, 0.4), 0.45); g.fillRect(0, 0, w, h);
				gr.addColorStop(0, "rgba(0,0,0,0.8)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				g.globalCompositeOperation = "destination-in"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
			}, snap(sc, 560 * s + 2 * RM), snap(sc, 110 * s));
		}
		// the near quay: bollards, a lamp still lit, a mooring line
		var lampPos = [0, 0];
		function quay() {
			return sc.layer("quay", function (g, W, h) {
				var lc = lightCanvas(g, W, h), dk = mx(mul(c1, 0.2), [10, 10, 16], 0.4), rim = mx(dk, mx(c2, c3, 0.4), 0.5), base = h - 62, x, j;
				g.fillStyle = css(dk); g.fillRect(0, base, W, h - base);
				g.fillStyle = css(rim); g.fillRect(0, base, W, 2.2);
				g.fillStyle = css(mul(dk, 0.6)); g.fillRect(0, base + 12, W, 4);
				for (j = 0; j < 3; j++) {
					x = W * (0.3 + j * 0.27) + (j === 1 ? 40 : 0);
					g.fillStyle = css(dk); g.fillRect(x - 13, base - 30, 26, 30);
					g.beginPath(); g.ellipse(x, base - 32, 21, 8, 0, 0, TAU); g.fill(); g.fillRect(x - 18, base - 6, 36, 6);
					g.strokeStyle = css(rim); g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, base - 32, 21, 8, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
					g.fillStyle = css(rim, 0.7); g.fillRect(x + 11, base - 26, 1.8, 22);
				}
				// the lamp
				x = W * 0.085; g.fillStyle = css(dk); g.fillRect(x - 4, 26, 8, base - 26); g.fillRect(x - 9, base - 22, 18, 22);
				g.fillRect(x - 4, 20, 46, 6); g.fillRect(x + 26, 24, 30, 9);
				g.fillStyle = css(rim, 0.8); g.fillRect(x + 2.4, 30, 1.6, base - 52);
				lc.fillStyle = css(mx(lampC, WHITE, 0.5)); lc.beginPath(); lc.ellipse(x + 41, 35, 13, 4, 0, 0, TAU); lc.fill();
				lampPos[0] = x + 41; lampPos[1] = 1080 - h + 36;
				lc.save(); lc.translate(x + 41, base + 4); lc.scale(1, 0.18); j = lc.createRadialGradient(0, 0, 0, 0, 0, 240); j.addColorStop(0, css(lampC, 0.4)); j.addColorStop(1, css(lampC, 0)); lc.fillStyle = j; lc.fillRect(-250, -250, 500, 500); lc.restore();
				g.drawImage(lc.canvas, 0, 0, W, h); bloom(g, lc.canvas, W, h, 1.1);
			}, sc.W, snap(sc, 330));
		}
		function toggle() {
			var w;
			if (!shoreCtx || !tw.length) { return; }
			w = tw[(Math.random() * tw.length) | 0]; w.lit = !w.lit;
			shoreCtx.fillStyle = w.lit ? w.on : w.off; shoreCtx.fillRect(w.x, w.y, w.w, w.h);
		}
		smoke.step = function (p, dt) { p.vx += (-26 - p.vx) * dt * 0.25; };

		sc.frame = function (g, dt) {
			var W = sc.W, k = sc.k, j, C, L, x, y, a, d = dt * S.speed, s = ks(), sx = sunU * W, oy = HZ - CH0, p, ph, tx, hy, sw, bob;
			T += d;
			slide(sc, g, 70);
			put(g, sky(), k, 0, 0);
			for (j = 0; j < 2; j++) { C = clouds[j]; drift(sc, g, "cl" + j, C.tex, T * C.sp, C.y, C.bw, C.h); }
			birds(g, W, d);
			put(g, water(), k, 0, HZ);
			wobble(sc, g, refl(), -RM, HZ, T, 1.5, 10, 1.2, false);
			g.globalAlpha = 0.7; drift(sc, g, "d14", ripple, T * 5, HZ + 3, 900, 58);
			g.globalAlpha = 0.65; drift(sc, g, "d15", ripple, T * -8 + 300, HZ + 60, 1500, 132);
			g.globalAlpha = 0.55; drift(sc, g, "d16", ripple, T * 14 + 700, HZ + 190, 2500, 1080 - HZ - 190);
			g.globalAlpha = 1;
			if (sunUp) { glitter(g, sx, HZ + 4, 1076, d, 30, 220, 0.9 * dim); }
			// smoke from the chimney, drifting off on the breeze
			smokeAcc += d;
			if (smokeAcc > 0.3) { smokeAcc = 0; p = smoke.spawn(); if (p) { p.x = stackPos[0] + K.rnd(-3, 3); p.y = stackPos[1]; p.vx = K.rnd(-6, 2); p.vy = K.rnd(-30, -20); p.life = K.rnd(7, 11); p.img = puff; p.size = K.rnd(16, 22); p.grow = K.rnd(9, 15); p.a = 0.4; p.fade = 0.85; } }
			L = shore(); smoke.update(d); smoke.draw(g);
			put(g, L, k, 0, oy);
			// the middle crane works: its trolley runs out along the boom and the load goes down and comes up
			if (trol) {
				ph = (T * 0.05) % 1; sw = trol[3];
				a = ph < 0.3 ? K.ease.inOut(ph / 0.3) : ph < 0.5 ? 1 : ph < 0.8 ? 1 - K.ease.inOut((ph - 0.5) / 0.3) : 0;
				tx = trol[1] + (trol[0] - trol[1]) * a; hy = ph < 0.3 ? 0.25 : ph < 0.4 ? 0.25 + 0.6 * K.ease.inOut((ph - 0.3) / 0.1) : ph < 0.5 ? 0.85 - 0.6 * K.ease.inOut((ph - 0.4) / 0.1) : 0.25;
				y = trol[2] + oy;
				g.fillStyle = css(near); g.fillRect(tx - 7 * sw, y, 14 * sw, 7 * sw);
				g.fillRect(tx - 5 * sw, y + 7 * sw, 1, hy * 120 * sw); g.fillRect(tx + 5 * sw - 1, y + 7 * sw, 1, hy * 120 * sw);
				g.fillRect(tx - 19 * sw, y + 7 * sw + hy * 120 * sw, 38 * sw, 2.4 * sw);
				g.fillStyle = css(mx(BOX_COLS[1], near, 0.5)); g.fillRect(tx - 19 * sw, y + 9.4 * sw + hy * 120 * sw, 38 * sw, 14 * sw);
			}
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < tips.length; j++) { a = Math.sin(T * 1.6 + j * 1.9); a = a > 0 ? a * a : 0; if (a > 0.02) { g.globalAlpha = a; g.drawImage(tipSpr, tips[j][0] - 8, tips[j][1] + oy - 8, 16, 16); } }
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			// mist lying on the water, the ship sliding through it
			g.globalAlpha = Math.min(1, 0.6 * mistK); drift(sc, g, "d17", mistA, T * 7, HZ - 118, 2500, 200);
			L = ship(); x = W * 0.36 - ((T * 8.5) % (W + 700 * s)); if (x < -620 * s) { x += W + 700 * s; }
			y = HZ + 64; bob = Math.sin(T * 0.8) * 1.2;
			g.globalAlpha = 1;
			wobble(sc, g, shipRefl(), x - RM, y - 3, T, 1.5, 5, 1.4, false);
			put(g, L, k, x, y - SHIP_WL * s + bob);
			// her wake: a few pale lines astern, a curl at the bow
			g.globalAlpha = 0.5; g.drawImage(ripple, 0, 0, 256, 40, x + 520 * s, y - 5, 330 * s, 16); g.drawImage(ripple, 200, 30, 120, 30, x + 12 * s, y - 4, 70 * s, 9); g.globalAlpha = 1;
			g.globalAlpha = Math.min(1, 0.5 * mistK); drift(sc, g, "d18", mistB, T * -5 + 400, HZ + 6, 2900, 170);
			if (misty) { g.globalAlpha = 0.6; drift(sc, g, "d19", mistA, T * 11 + 900, HZ - 330, 3300, 460); }
			g.globalAlpha = 1;
			// a buoy, its light winking
			x = W * 0.2; y = 884 + Math.sin(T * 1.3) * 3; a = Math.sin(T * 1.3 + 1) * 0.1;
			g.save(); g.translate(x, y); g.rotate(a);
			g.fillStyle = css(mx(near, [190, 60, 50], 0.5)); g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); g.lineTo(7, -22); g.lineTo(-7, -22); g.closePath(); g.fill();
			g.fillStyle = css(near); g.fillRect(-1.5, -44, 3, 22); g.fillRect(-5, -48, 10, 5); g.restore();
			g.fillStyle = css(mul(c1, 0.4), 0.3); g.beginPath(); g.ellipse(x, y + 12, 16, 9, 0, 0, TAU); g.fill();
			a = Math.sin(T * 2.2); a = a > 0.2 ? 1 : 0;
			if (a) { g.globalCompositeOperation = "lighter"; g.drawImage(buoySpr, x - 16 - Math.sin(T * 1.3 + 1) * 4, y - 62, 32, 32); g.globalAlpha = 0.4; g.drawImage(buoySpr, x - 12, y + 2, 24, 60); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
			L = quay(); put(g, L, k, 0, 1080 - L.hu);
			g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.6 + 0.05 * Math.sin(T * 7); g.drawImage(lampSpr, lampPos[0] - 70, lampPos[1] - 70, 140, 140); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			twAcc += d * 2.4 * S.detail;
			while (twAcc >= 1) { twAcc -= 1; toggle(); }
			if (rain) { rain(g, W, 1080, d, 0.15, 0.9); }
			if (snow) { snow(g, W, 1080, d, 0.02, 1); }
		};
		return { stop: function () { sc.stop(); } };
	}
	K.addEngine({ id: "city-harbor", label: "City: harbour at dawn", colors: ["3b4d8c", "ffa582", "ffe2a6"], start: startHarbor });

	// ================================================================ the template
	// The colours each scene uses at each time of day: [sky, glow, lights]. "" is the scene's own.
	var LOOKS = {
		neon: { "": ["0a1438", "ff7a3c", "1fe5c8"] },
		rain: { "": ["0a1a2c", "ff6a3d", "2fd6e8"] },
		harbor: { "": ["3b4d8c", "ffa582", "ffe2a6"], dawn: ["3b4d8c", "ffa582", "ffe2a6"], golden: ["3f6fb0", "ffc070", "fff0c0"], sunset: ["33306f", "ff7f47", "ffd27a"], dusk: ["121a4a", "e07a50", "ffd9a0"], night: ["060d24", "2c4a7c", "ffd08a"] },
		pixel: { "": ["10133a", "a8508c", "ffd76a"], night: ["10133a", "a8508c", "ffd76a"], sunset: ["2b1d5e", "ff8a4c", "ffe08a"], dawn: ["3a4a8e", "ffa9a0", "fff0c0"], dusk: ["1b1f5a", "d9628a", "ffd76a"], golden: ["3c5a9e", "ffc56e", "fff0c0"] },
		rooftop: { "": ["16224f", "ff9a5c", "ffc46b"], night: ["060b22", "3a4a8c", "ffc46b"], sunset: ["3a3f86", "ff7d4d", "ffcf7a"], golden: ["4a78b8", "ffc070", "ffd98a"], dawn: ["5d74c0", "ffb3a6", "ffd9a0"], dusk: ["16224f", "ff9a5c", "ffc46b"] },
		sunset: { "": ["26306f", "ff8a3d", "ffd98a"], golden: ["3f72b8", "ffc56e", "fff0c0"], dusk: ["0b1a4c", "f08a42", "ffd9a0"], dawn: ["6276c4", "ffb09a", "fff0d2"], night: ["050a24", "243a78", "cfe0ff"] }
	};
	var SCENES = [
		["neon", "Neon megacity at night"], ["sunset", "Skyline across the bay"], ["rain", "Rainy street at night"],
		["rooftop", "Rooftop at dusk"], ["pixel", "Pixel-art city"], ["harbor", "Harbour city"]
	].filter(function (s) { return !!SSO.ENGINES["city-" + s[0]]; });
	var TIMED = ["sunset", "rooftop", "pixel", "harbor"];
	var PRESETS = [
		{ name: "Neon megacity at night", tags: ["cyber", "gaming"], values: { scene: "neon" } },
		{ name: "Neon megacity in the rain", tags: ["cyber", "gaming"], values: { scene: "neon", weather: "rain", c1: "06101f", c2: "3d7bff", c3: "ff3fa4" } },
		{ name: "Neon megacity, teal and amber", tags: ["cyber", "elegant"], values: { scene: "neon", c1: "062a3a", c2: "ffa63d", c3: "19d3c5" } },
		{ name: "Neon megacity in fog", tags: ["cyber", "spooky"], values: { scene: "neon", weather: "fog", c1: "10131c", c2: "8fa3c8", c3: "ff3b5c" } },
		{ name: "Sunset across the bay", tags: ["cozy", "elegant", "summer"], values: { scene: "sunset" } },
		{ name: "The bay at golden hour", tags: ["cozy", "summer"], values: { scene: "sunset", time: "golden" } },
		{ name: "The bay at dusk", tags: ["cozy", "elegant"], values: { scene: "sunset", time: "dusk" } },
		{ name: "The bay at pink dawn", tags: ["cozy", "cute", "spring"], values: { scene: "sunset", time: "dawn" } },
		{ name: "Rainy street at night", tags: ["cozy", "cyber"], values: { scene: "rain" } },
		{ name: "Snowy street, red lanterns", tags: ["cozy", "winter"], values: { scene: "rain", weather: "snow", c1: "12203c", c2: "ff4f55", c3: "9fd6ff" } },
		{ name: "Rooftop at dusk", tags: ["cozy", "cute"], values: { scene: "rooftop" } },
		{ name: "Rooftop on a clear night", tags: ["cozy", "elegant"], values: { scene: "rooftop", time: "night" } },
		{ name: "Pixel city night", tags: ["retro", "gaming"], values: { scene: "pixel" } },
		{ name: "Pixel city at sunset", tags: ["retro", "gaming", "summer"], values: { scene: "pixel", time: "sunset" } },
		{ name: "Pixel city in the snow", tags: ["retro", "winter", "christmas"], values: { scene: "pixel", weather: "snow", c1: "0e1a3a", c2: "5f7fb8", c3: "ffd98a" } },
		{ name: "Harbour at dawn", tags: ["cozy", "elegant"], values: { scene: "harbor" } },
		{ name: "Harbour in the morning mist", tags: ["cozy", "simple"], values: { scene: "harbor", weather: "fog", c1: "4a6078", c2: "e8c9b8", c3: "fff0d0" } },
		{ name: "Harbour at night", tags: ["elegant", "pro"], values: { scene: "harbor", time: "night" } }
	].filter(function (p) { return !!SSO.ENGINES["city-" + p.values.scene]; });
	SSO.register({
		id: "city",
		name: "City backgrounds",
		category: "worlds",
		description: "Full-screen moving city pictures to sit behind a title, a camera or a break screen: a neon megacity, a skyline across the bay, a rainy street, a rooftop, a pixel-art city and a harbour. Pick the time of day, the weather and the colours.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Scene", type: "select", group: "Scene", default: "neon", options: SCENES },
			{ key: "time", label: "Time of day", type: "select", group: "Scene", default: "", options: [["", "The scene's own"], ["dawn", "Dawn"], ["golden", "Golden hour"], ["sunset", "Sunset"], ["dusk", "Dusk"], ["night", "Night"]], show: { scene: TIMED } },
			{ key: "weather", label: "Weather", type: "select", group: "Scene", default: "", options: [["", "The scene's own"], ["clear", "Clear"], ["rain", "Rain"], ["fog", "Fog"], ["snow", "Snow"]] },
			{ key: "c1", label: "Sky colour (blank = the scene's own)", type: "color", group: "Colours", default: "" },
			{ key: "c2", label: "Glow colour (blank = the scene's own)", type: "color", group: "Colours", default: "" },
			{ key: "c3", label: "Lights colour (blank = the scene's own)", type: "color", group: "Colours", default: "" },
			{ key: "speed", label: "Speed", type: "range", group: "Motion", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "detail", label: "How busy (traffic, windows, birds)", type: "range", group: "Motion", default: 1, min: 0.3, max: 2, step: 0.1 },
			{ key: "sharp", label: "Picture sharpness (lower is lighter on the computer)", type: "range", group: "Motion", default: 1, min: 0.5, max: 1, step: 0.05, help: "The pixel-art city keeps its own pixel grid and ignores this: it is already the lightest of the six." }
		],
		presets: PRESETS,
		render: function (root, c) {
			var host = document.createElement("div");
			var looks = LOOKS[c.scene] || {}, timed = TIMED.indexOf(c.scene) !== -1 && looks[c.time] ? c.time : "", look = looks[timed] || looks[""] || [];
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine("city-" + c.scene, host, {
				c1: c.c1 || look[0], c2: c.c2 || look[1], c3: c.c3 || look[2], speed: c.speed, detail: c.detail, weather: c.weather, time: timed,
				quality: c.sharp
			});
		}
	});

	// The same six pictures behind the "Starting soon / BRB / ending" screens, each with a title where the picture is calm.
	K.addPresets("screen", [
		{ name: "City: neon megacity, starting soon", tags: ["cyber", "gaming"], values: { backdrop: "city-neon", c1: "0a1438", c2: "ff7a3c", c3: "1fe5c8", title: "Starting soon", subtitle: "the city is waking up", minutes: 5, layout: "top", font: "Orbitron", fontsize: 84, upper: true, accent: "1fe5c8", dim: 0 } },
		{ name: "City: sunset bay, thanks for watching", tags: ["cozy", "elegant"], values: { backdrop: "city-sunset", c1: "26306f", c2: "ff8a3d", c3: "ffd98a", title: "Thanks for watching", subtitle: "see you next stream", minutes: 0, layout: "bottom", font: "Playfair Display", fontsize: 88, accent: "ffd98a", dim: 0 } },
		{ name: "City: rainy street, be right back", tags: ["cozy", "cyber"], values: { backdrop: "city-rain", c1: "0a1a2c", c2: "ff6a3d", c3: "2fd6e8", title: "Be right back", subtitle: "waiting out the rain", minutes: 0, layout: "top", font: "Special Elite", fontsize: 84, accent: "2fd6e8", dim: 0 } },
		{ name: "City: rooftop at dusk, intermission", tags: ["cozy", "cute"], values: { backdrop: "city-rooftop", c1: "16224f", c2: "ff9a5c", c3: "ffc46b", title: "Intermission", subtitle: "stretch, hydrate, back shortly", minutes: 10, countlabel: "resuming in", endtext: "resuming now", layout: "top", font: "Caveat", fontsize: 124, accent: "ffc46b", dim: 0 } },
		{ name: "City: pixel city, loading", tags: ["retro", "gaming"], values: { backdrop: "city-pixel", c1: "10133a", c2: "a8508c", c3: "ffd76a", title: "Loading stream", subtitle: "press start in a moment", minutes: 5, layout: "top", font: "Press Start 2P", fontsize: 52, upper: true, accent: "ffd76a", dim: 0 } },
		{ name: "City: harbour at dawn, good morning", tags: ["cozy", "elegant", "pro"], values: { backdrop: "city-harbor", c1: "3b4d8c", c2: "ffa582", c3: "ffe2a6", title: "Good morning", subtitle: "the stream is about to begin", minutes: 5, layout: "top", font: "Montserrat", fontsize: 96, accent: "ffe2a6", dim: 0 } }
	]);
})();
