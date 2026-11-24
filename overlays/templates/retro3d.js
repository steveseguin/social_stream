/* 8-bit 3D backgrounds pack: old-console style scenes with depth, each worked out pixel by pixel on a small grid and
   enlarged with hard edges. Five always-on pictures, each a background engine so the "Starting soon / BRB" screens can use
   them too ("bit3d-flyover", "bit3d-dungeon", "bit3d-canyon", "bit3d-vector", "bit3d-road"), plus one template ("retro3d")
   that picks the scene, its look, the pixel size and how much moves.
   How they stay cheap: the art grid is small (320 x 180 on a 1080-high source at the standard pixel size) and capped, so the
   work per frame does not grow with the source size. A frame is written into one ImageData through a Uint32Array view and
   put on the canvas once; nothing is allocated per frame. Palettes are short lists chosen per look; distance fade and
   gradients are ordered (4 x 4 Bayer) dithering between those colours, never blends. Maps and textures are built a few
   milliseconds at a time between frames, the sky first. Built on fxkit.js. Keep this Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K || !SSO.register) { return; }
	var TAU = Math.PI * 2;
	var BAY = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
	var LE = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
	// The most art pixels worked out per frame. The fine pixel size on a 16:9 source is 480 x 270 = 129,600; odd source
	// shapes (a 128 x 4320 strip has a grid of 553,000 single pixels) are worked out on a coarser grid and enlarged.
	var CAP = 140000;
	function now() { return performance.now(); }

	// ---------------------------------------------------------------- small helpers
	function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
	function hx(s) { var n = parseInt(s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
	function mx(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function ml(a, f) { return [a[0] * f, a[1] * f, a[2] * f]; }
	function b8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
	// a colour as the 32-bit word an ImageData's Uint32Array view expects
	function pk(c) {
		var r = b8(c[0]), g = b8(c[1]), b = b8(c[2]);
		return (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
	}
	function css(c) { return "rgb(" + b8(c[0]) + "," + b8(c[1]) + "," + b8(c[2]) + ")"; }
	// any colour from a link (or the look's own, as hex) as [r, g, b]; a malformed one falls back, never throws
	function rgb3(v, def) { var c = K.toRgb(v || ("#" + def)); return [c[0], c[1], c[2]]; }
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
	// Blends the short way round the colour wheel (deep blue to orange passes through violet and rose, as a sky does),
	// except where that would pass through green: then plainly.
	function hueMix(a, b, t) {
		var x = toHsl(a), y = toHsl(b), dh, mid;
		if (x[1] < 0.08) { x[0] = y[0]; } else if (y[1] < 0.08) { y[0] = x[0]; }
		dh = y[0] - x[0];
		if (dh > 180) { dh -= 360; } else if (dh < -180) { dh += 360; }
		mid = (((x[0] + dh * 0.5) % 360) + 360) % 360;
		if (Math.abs(dh) > 70 && mid > 62 && mid < 172) { return mx(a, b, t); }
		return fromHsl(x[0] + dh * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
	}
	// repeatable integer hash, 0..1
	function ih(x, y, s) {
		var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
		h = Math.imul(h ^ (h >>> 13), 1103515245);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	// value noise that tiles every p lattice cells, and its sum over octaves (also tiling)
	function vn(x, y, p, s) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		var x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
		var a = ih(x0, y0, s), b = ih(x1, y0, s), c = ih(x0, y1, s), d = ih(x1, y1, s);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	}
	function fbm(x, y, p, s, oct) {
		var v = 0, a = 0.5, sum = 0, i;
		for (i = 0; i < oct; i++) { v += a * vn(x, y, p, s + i * 31); sum += a; x *= 2; y *= 2; p *= 2; a *= 0.5; }
		return v / sum;
	}
	// bilinear lookup in a square Float32Array grid of side n that wraps
	function bil(a, n, x, y) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, m = n - 1;
		var x0 = xi & m, y0 = yi & m, x1 = (x0 + 1) & m, y1 = (y0 + 1) & m;
		var p = a[y0 * n + x0], q = a[y0 * n + x1], r = a[y1 * n + x0], s = a[y1 * n + x1];
		return p + (q - p) * xf + (r - p) * yf + (p - q - r + s) * xf * yf;
	}
	// A pixel-art sprite from rows of characters; map: character -> palette slot. 255 = see-through.
	function spr(rows, map) {
		var h = rows.length, w = 0, i, j, d, ch;
		for (j = 0; j < h; j++) { w = Math.max(w, rows[j].length); }
		d = new Uint8Array(w * h); d.fill(255);
		for (j = 0; j < h; j++) { for (i = 0; i < rows[j].length; i++) { ch = rows[j].charAt(i); if (map[ch] != null) { d[j * w + i] = map[ch]; } } }
		return { w: w, h: h, d: d };
	}

	// ---------------------------------------------------------------- shared settings, frame buffer, scanlines
	var MOTION = { steady: 0, gentle: 1, lively: 1.8 }, PIXELS = { chunky: 8, standard: 6, fine: 4 };
	function settings(o, looks, deflook) {
		o = o || {};
		var mo = MOTION[o.motion];
		return {
			speed: K.clamp(num(o.speed, 1), 0.05, 6),
			motion: mo == null ? 1 : mo,
			life: K.clamp(num(o.life, 1), 0, 3),
			look: looks[o.look] ? o.look : deflook,
			layout: String(o.layout || ""),
			tube: o.tube === true || o.tube === 1 || o.tube === "1",
			px: PIXELS[o.pixels] || 6
		};
	}
	// One ImageData the size of the art grid (or, past CAP art pixels, a coarser copy enlarged onto it), with a Uint32Array
	// view. fit() is called at the start of every frame and says whether the size changed; show() puts the frame up.
	function buffer(sc) {
		var F = { w: 2, h: 2, cw: 0, ch: 0, img: null, px: null, off: null, og: null };
		F.fit = function () {
			var cw = sc.cv.width, ch = sc.cv.height, w = cw, h = ch, s, tg;
			if (cw === F.cw && ch === F.ch && F.img) { return false; }
			F.cw = cw; F.ch = ch; F.img = null; F.px = null; F.off = null; F.og = null;
			if (cw * ch > CAP) { s = Math.sqrt(CAP / (cw * ch)); w = Math.max(2, Math.floor(cw * s)); h = Math.max(2, Math.floor(ch * s)); }
			if (w !== cw || h !== ch) { F.off = K.canvas(w, h); F.og = F.off.getContext("2d"); }
			tg = F.off ? F.og : sc.g;
			if (!tg) { return true; }
			F.w = w; F.h = h;
			F.img = tg.createImageData(w, h); F.px = new Uint32Array(F.img.data.buffer);
			return true;
		};
		F.show = function () {
			var g = sc.g;
			if (!F.img) { return; }
			if (F.off) {
				F.og.putImageData(F.img, 0, 0);
				g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
				g.drawImage(F.off, 0, 0, F.cw, F.ch);
			} else { g.putImageData(F.img, 0, 0); }
		};
		return F;
	}
	// The picture's shape on the art grid. A strip-shaped source shows the middle band of a 4:1 picture (off = rows cut off
	// the top); U is the art-pixel scale (1 on the standard 320 x 180 grid, 1.5 on the fine one), from the shorter side.
	function view(F) {
		var w = F.w, h = F.h, vh = Math.max(h, Math.round(w / 4));
		return { w: w, h: h, vh: vh, off: (vh - h) / 2, U: Math.max(0.2, Math.min(w, vh) / 180), tall: h > w * 1.1 };
	}
	// Optional scanlines: a dark line along the foot of every art-pixel row, laid over the canvas by the page.
	function tube(host, sc) {
		var d = document.createElement("div"), last = -1;
		d.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;";
		host.appendChild(d);
		return {
			fit: function () {
				var p = sc.cv.width > 0 ? (parseFloat(sc.cv.style.width) || sc.cv.width) / sc.cv.width : 1, dark, a;
				if (!isFinite(p) || Math.abs(p - last) < 0.01) { return; }
				last = p;
				if (p < 3) { d.style.backgroundImage = "none"; return; }
				dark = Math.max(1, Math.round(p / 3)); a = (p - dark).toFixed(2);
				d.style.backgroundImage = "repeating-linear-gradient(180deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) " + a + "px,rgba(0,0,0,0.3) " + a + "px,rgba(0,0,0,0.3) " + p.toFixed(2) + "px)";
			},
			remove: function () { if (d.parentNode) { d.parentNode.removeChild(d); } }
		};
	}
	// No 2D canvas (out of canvas memory, say): a plain sky in the scene's colours instead, and nothing running.
	function failed(host, a, b) {
		host.style.background = "linear-gradient(" + css(a) + "," + css(b) + ")";
		return { stop: function () { host.style.background = ""; } };
	}
	// The loop every scene shares: fit the buffer, step the world by the (speed-scaled, clamped) time, draw, show.
	// def: { resize(F), step(sdt, dt), draw(F) }, all optional except draw.
	function run(host, S, def, fallA, fallB) {
		var sc = K.scene(host, { fps: def.fps || 60, pixelated: true, artPixel: S.px });
		if (!sc.g) { sc.stop(); return failed(host, fallA, fallB); }
		var F = buffer(sc), tb = S.tube ? tube(host, sc) : null, alive = true;
		sc.frame = function (g, dt) {
			if (!alive) { return; }
			if (F.fit()) { if (tb) { tb.fit(); } if (F.img && def.resize) { def.resize(F); } }
			if (!F.img) { return; }
			dt = Math.min(0.1, Math.max(0, dt || 0));
			if (def.step) { def.step(dt * S.speed, dt); }
			def.draw(F);
			F.show();
		};
		return { stop: function () { if (!alive) { return; } alive = false; sc.stop(); if (tb) { tb.remove(); } if (def.stop) { def.stop(); } } };
	}
	// Sprite drawing, nearest-neighbour: im's bottom centre lands on (ax, ay), s screen pixels per sprite pixel, turned by
	// the camera roll (cr, sr). f16 is its haze level in sixteenths; pixels whose dithered level reaches `gone` are left out,
	// so far things dissolve in out of the haze rather than pop.
	function blit(F, im, ax, ay, s, cr, sr, f16, lut, gone) {
		var w = F.w, h = F.h, px = F.px, iw = im.w, ih2 = im.h, d = im.d, hw = iw * s * 0.5, hh = ih2 * s, inv = 1 / s;
		var x0, x1, y0, y1, x, y, lx, ly, ix, iy, c, l, row, b;
		if (s <= 0 || hh < 0.5) { return; }
		// the four corners of the turned rectangle
		var ax1 = -hw * cr + hh * sr, ay1 = -hw * sr - hh * cr, ax2 = hw * cr + hh * sr, ay2 = hw * sr - hh * cr, ax3 = -hw * cr, ay3 = -hw * sr, ax4 = hw * cr, ay4 = hw * sr;
		x0 = Math.floor(ax + Math.min(ax1, ax2, ax3, ax4)); x1 = Math.ceil(ax + Math.max(ax1, ax2, ax3, ax4));
		y0 = Math.floor(ay + Math.min(ay1, ay2, ay3, ay4)); y1 = Math.ceil(ay + Math.max(ay1, ay2, ay3, ay4));
		if (x1 < 0 || y1 < 0 || x0 >= w || y0 >= h) { return; }
		if (x0 < 0) { x0 = 0; } if (y0 < 0) { y0 = 0; } if (x1 > w - 1) { x1 = w - 1; } if (y1 > h - 1) { y1 = h - 1; }
		for (y = y0; y <= y1; y++) {
			lx = (x0 + 0.5 - ax) * cr + (y + 0.5 - ay) * sr + hw; ly = -(x0 + 0.5 - ax) * sr + (y + 0.5 - ay) * cr + hh;
			row = y * w; b = (y & 3) << 2;
			for (x = x0; x <= x1; x++, lx += cr, ly -= sr) {
				if (lx < 0 || ly < 0) { continue; }
				ix = (lx * inv) | 0; iy = (ly * inv) | 0;
				if (ix >= iw || iy >= ih2) { continue; }
				c = d[iy * iw + ix];
				if (c === 255) { continue; }
				l = (f16 + BAY[b | (x & 3)]) >> 4;
				if (l >= gone) { continue; }
				px[row + x] = lut[(l << 6) | c];
			}
		}
	}

	// ================================================================ 1. flyover: a flight over islands
	// A flat map seen in perspective (worked out for every pixel, turned by the bank of the camera), a banded sky with the
	// sun and a deck of clouds overhead, and trees, towers, windmills, balloons and birds as scaled sprites.
	// Palette slots (the map and the sprites store these; a look gives each its colour):
	var F_SKY = 0, F_SUN0 = 6, F_SUN1 = 7, F_CLD0 = 8, F_CLD1 = 9, F_STAR = 10, F_WD = 11, F_W0 = 12, F_W1 = 13, F_W2 = 14, F_SHL = 15, F_FOAM = 16,
		F_SA0 = 17, F_SA1 = 18, F_G0 = 19, F_G1 = 20, F_G2 = 21, F_F0 = 22, F_F1 = 23, F_FD0 = 24, F_FD1 = 25, F_FD2 = 26,
		F_R0 = 27, F_R1 = 28, F_SN = 29, F_RD = 30, F_RDL = 31, F_RF0 = 32, F_RF1 = 33, F_ST = 34, F_WIN = 35,
		F_TRK = 36, F_TS0 = 37, F_TS1 = 38, F_TRF = 39, F_LMP = 40, F_BL0 = 41, F_BL1 = 42, F_BL2 = 43, F_BSK = 44, F_BRD = 45, F_HAZE = 46,
		F_LF0 = 47, F_LF1 = 48, F_LF2 = 49, F_RF2 = 50, F_RF3 = 51, F_GW = 52, F_N = 55;
	// The looks: c = [sky, glow and sunlight, sea]; m = the land's own colours; sun = [height up the sky, radius].
	var FLY = {
		day: { c: ["2a5fd2", "cbe6ff", "2b7bcf"], sun: [0.78, 9], cloud: [0.06, 0.3], m: {
			grass: ["74bd48", "5aa63c", "438a34"], forest: ["2f7232", "225a2a"], leaf: ["5ab04a", "3a8a3a", "24602c"], sand: ["efdc98", "d4bd78"], rock: ["a29a8c", "7c746c"], snow: "f6f8ff",
			field: ["e6cc64", "c8aa4a", "8cc44e"], road: ["b0a28a", "ddd0b4"], roof: ["cc5640", "f0e6cc"], street: "8a8170", win: "ffe9a0",
			trunk: "6e4a2a", stone: ["e6e0d0", "aaa294"], troof: "c44636", lamp: "fff2b0", ball: ["e8463a", "faf2e2", "3a6ad8"], basket: "8a5a2a", bird: "f8f8f0" } },
		sunset: { c: ["2c2470", "ff9858", "463c8c"], sun: [0.16, 19], stripes: true, cloud: [0.35, 0.55], m: {
			grass: ["98a048", "7a8640", "5c6838"], forest: ["43582e", "324428"], leaf: ["8a9244", "62703a", "3e4a2c"], sand: ["f4bc7c", "d49c62"], rock: ["b88a78", "8e6a66"], snow: "ffe2d2",
			field: ["f2b652", "d29644", "b0a64a"], road: ["a88a78", "e6c4a2"], roof: ["d65a3e", "f6d4b2"], street: "8a6a5e", win: "ffe0a0",
			trunk: "5a3a2a", stone: ["f4d2b8", "b08e80"], troof: "b8403a", lamp: "fff0b8", ball: ["f0563c", "fce6c8", "6a4ab8"], basket: "7a4a2a", bird: "fff0e4" } },
		night: { c: ["050a22", "2c3e7e", "14285c"], moon: true, stars: true, sun: [0.62, 8], cloud: [0.3, 0.12], lights: true, m: {
			grass: ["325c54", "264c46", "1d3e3a"], forest: ["193c36", "11302c"], leaf: ["2e5a50", "1e443c", "13322c"], sand: ["7e7a70", "68645c"], rock: ["5c6272", "474c5c"], snow: "cad6ee",
			field: ["6c7658", "58624a", "40604a"], road: ["5c5c66", "8a8a92"], roof: ["4c3c4a", "5e5c6c"], street: "2c2c36", win: "ffd070",
			trunk: "2c2620", stone: ["a6acbc", "6c7282"], troof: "5c3c4c", lamp: "fff0a0", ball: ["c24a46", "e2dacb", "4a5ac8"], basket: "4a3a2a", bird: "0c0e1c" } },
		snow: { c: ["5a88cc", "eaf2ff", "24566e"], sun: [0.5, 10], cloud: [0.04, 0.2], conifer: true, m: {
			grass: ["f4f8ff", "dbe5f3", "bccbe0"], forest: ["2e5048", "203f3a"], leaf: ["3e6a5a", "2a5048", "1c3834"], sand: ["c8d8e8", "a8bccc"], rock: ["7c8696", "5e6878"], snow: "ffffff",
			field: ["e6edf8", "cdd8e8", "b6c6da"], road: ["8e887c", "b8b2a2"], roof: ["b44a3c", "f2f5fa"], street: "6a6c76", win: "ffe2a0",
			trunk: "4a3a2c", stone: ["dfe4ec", "9aa2b2"], troof: "a84238", lamp: "fff2c0", ball: ["e04a3c", "f6f4f0", "3a5ac0"], basket: "7a5232", bird: "30323e" } }
	};
	function flyPal(L, c1, c2, c3) {
		var m = L.m, Wt = [255, 255, 255], p = [], i;
		for (i = 0; i < 6; i++) { p[F_SKY + i] = hueMix(c1, c2, Math.pow(i / 5, 1.25)); }
		if (L.moon) { p[F_SUN0] = mx(c2, Wt, 0.86); p[F_SUN1] = mx(c2, Wt, 0.45); }
		else { p[F_SUN0] = mx(c2, Wt, 0.72); p[F_SUN1] = mx(c2, Wt, L.stripes ? 0.18 : 0.42); }
		p[F_CLD0] = mx(Wt, c2, L.cloud[0]); p[F_CLD1] = mx(mx(c1, c2, 0.6), Wt, L.cloud[1]); p[F_STAR] = mx(Wt, c2, 0.15);
		if (L.moon) { p[F_CLD0] = mx(c2, Wt, 0.28); p[F_CLD1] = mx(c1, c2, 0.55); }
		p[F_WD] = ml(c3, 0.78); p[F_W0] = c3; p[F_W1] = mx(c3, Wt, 0.1); p[F_W2] = mx(c3, Wt, 0.3);
		p[F_SHL] = mx(mx(c3, Wt, 0.12), hueMix(c1, c2, 1), 0.3); p[F_FOAM] = mx(c3, Wt, 0.72);
		p[F_SA0] = hx(m.sand[0]); p[F_SA1] = hx(m.sand[1]);
		p[F_G0] = hx(m.grass[0]); p[F_G1] = hx(m.grass[1]); p[F_G2] = hx(m.grass[2]);
		p[F_F0] = hx(m.forest[0]); p[F_F1] = hx(m.forest[1]);
		p[F_FD0] = hx(m.field[0]); p[F_FD1] = hx(m.field[1]); p[F_FD2] = hx(m.field[2]);
		p[F_R0] = hx(m.rock[0]); p[F_R1] = hx(m.rock[1]); p[F_SN] = hx(m.snow);
		p[F_RD] = hx(m.road[0]); p[F_RDL] = hx(m.road[1]); p[F_RF0] = hx(m.roof[0]); p[F_RF1] = hx(m.roof[1]); p[F_RF2] = ml(p[F_RF0], 0.7); p[F_RF3] = ml(p[F_RF1], 0.8); p[F_ST] = hx(m.street); p[F_WIN] = hx(m.win);
		p[F_TRK] = hx(m.trunk); p[F_TS0] = hx(m.stone[0]); p[F_TS1] = hx(m.stone[1]); p[F_TRF] = hx(m.troof); p[F_LMP] = hx(m.lamp);
		p[F_BL0] = hx(m.ball[0]); p[F_BL1] = hx(m.ball[1]); p[F_BL2] = hx(m.ball[2]); p[F_BSK] = hx(m.basket); p[F_BRD] = hx(m.bird);
		p[F_LF0] = hx(m.leaf[0]); p[F_LF1] = hx(m.leaf[1]); p[F_LF2] = hx(m.leaf[2]);
		p[F_HAZE] = p[F_SKY + 5];
		// the sun's (or moon's) glitter on the water: three slots that turn round like the sea's own
		p[F_GW] = mx(c3, p[F_SUN1], 0.35); p[F_GW + 1] = p[F_SUN1]; p[F_GW + 2] = p[F_SUN0];
		return p;
	}
	// the sprites, drawn by hand (a = light, b = middle, c = dark, t = trunk...)
	var FLY_SPR = {
		tree: [["...aab...", ".aaaabbb.", "aaaabbbbc", "aaabbbbcc", "aabbbbbcc", ".abbbbcc.", "..bcccc..", "....t....", "....t....", "...ttt..."], { a: F_LF0, b: F_LF1, c: F_LF2, t: F_TRK }],
		pine: [["...a...", "..aab..", "..abb..", ".aabbc.", "..abc..", ".aabbc.", "aaabbcc", ".abbcc.", "aabbbcc", "abbbccc", "...t...", "...t..."], { a: F_LF0, b: F_LF1, c: F_LF2, t: F_TRK }],
		light: [["...k...", "..klk..", "..klk..", ".kkkkk.", "..wwd..", "..rrd..", "..wwd..", "..rrd..", ".wwwd..", ".rrrd..", ".wwwdd.", ".rrrdd.", ".wwwdd.", ".rrrdd.", "wwwwddd", "sssssss"], { k: F_ST, l: F_LMP, w: F_TS0, d: F_TS1, r: F_TRF, s: F_R1 }],
		tower: [["a.a.a.a.a", "aaaaaaaab", ".aaaaaab.", ".aakaaab.", ".aaaaaab.", ".aaaaaab.", ".aakaaab.", ".aaaaaab.", ".aaaaaab.", "aaaaaaabb", "aaakaaabb", "aaaaaaabb", "aaaaaaabb", "bbbbbbbbb"], { a: F_TS0, b: F_TS1, k: F_ST }],
		church: [["....r....", "...rrr...", "..rrrrr..", ".rrrrrrr.", "..awwab..", "..awkab..", "..aaaab..", "..awwab..", "..aaaab..", "..aaaab..", ".aaaaabb.", ".aaaaabb.", ".aakkabb."], { a: F_TS0, b: F_TS1, r: F_TRF, w: F_WIN, k: F_ST }],
		mill: [["....r....", "...rrr...", "..rrrrr..", "..awwab..", "..aaaab..", "..aaaab..", ".aaaaabb.", ".aawaabb.", ".aaaaabb.", "aaaaaabbb", "aaakkabbb", "aaakkabbb"], { a: F_TS0, b: F_TS1, r: F_TRF, w: F_WIN, k: F_ST }],
		ballA: [["...aaaa...", ".aabbaabb.", "aabbaabbaa", "aabbaabbaa", "aabbaabbaa", "aabbaabbaa", ".abbaabba.", ".abbaabba.", "..bbaabb..", "...baab...", "....aa....", "...k..k...", "....kk....", "....pp....", "....pp...."], { a: F_BL0, b: F_BL1, k: F_ST, p: F_BSK }],
		ballB: [["...cccc...", ".ccbbccbb.", "ccbbccbbcc", "ccbbccbbcc", "aaaaaaaaaa", "ccbbccbbcc", ".cbbccbbc.", ".cbbccbbc.", "..bbccbb..", "...bccb...", "....cc....", "...k..k...", "....kk....", "....pp....", "....pp...."], { a: F_BL0, b: F_BL1, c: F_BL2, k: F_ST, p: F_BSK }],
		bird0: [["aa...aa", "..a.a..", "...b..."], { a: F_BRD, b: F_ST }],
		bird1: [[".......", "aaa.aaa", "...b..."], { a: F_BRD, b: F_ST }]
	};
	var FLY_IMG = null;
	function flyImages() {
		if (FLY_IMG) { return FLY_IMG; }
		var o = {}, k, i, f, im, a, r, x, y, n;
		for (k in FLY_SPR) { o[k] = spr(FLY_SPR[k][0], FLY_SPR[k][1]); }
		// windmill sails in four steps of a quarter turn's worth (the four blades look the same every 90 degrees)
		o.sails = [];
		for (f = 0; f < 4; f++) {
			im = { w: 23, h: 23, d: new Uint8Array(529) }; im.d.fill(255);
			for (n = 0; n < 4; n++) {
				a = (f / 4 + n) * TAU / 4;
				for (r = 2.5; r <= 10.5; r += 0.5) {
					for (i = 0.5; i <= 3.5; i += 0.5) {
						x = Math.round(11 + Math.cos(a) * r - Math.sin(a) * i); y = Math.round(11 + Math.sin(a) * r + Math.cos(a) * i);
						if (x >= 0 && y >= 0 && x < 23 && y < 23) { im.d[y * 23 + x] = i > 3 || r < 3 || r > 10 ? F_TS1 : F_TS0; }
					}
				}
				for (r = 0; r <= 10.5; r += 0.5) { x = Math.round(11 + Math.cos(a) * r); y = Math.round(11 + Math.sin(a) * r); im.d[y * 23 + x] = F_TRK; }
			}
			im.d[11 * 23 + 11] = F_ST;
			o.sails.push(im);
		}
		// a lighthouse with its lamp dark, for the blink at night
		o.lightOff = { w: o.light.w, h: o.light.h, d: new Uint8Array(o.light.d) };
		for (i = 0; i < o.lightOff.d.length; i++) { if (o.lightOff.d[i] === F_LMP) { o.lightOff.d[i] = F_TS1; } }
		FLY_IMG = o;
		return o;
	}
	// sprite kinds: image, height in map units, flies (dissolves when it comes close)
	var FK_TREE = 0, FK_PINE = 1, FK_LIGHT = 2, FK_TOWER = 3, FK_CHURCH = 4, FK_MILL = 5, FK_BALLA = 6, FK_BALLB = 7, FK_BIRD = 8;
	var FK_H = [6.5, 8, 17, 15, 15, 11, 10, 10, 1.1];
	var FN = 1024, FNM = 1023, FC = 128;
	// The map: 1024 x 1024 cells that tile, with three smaller copies for the distance, the cloud deck, and the sprites.
	// Built a slice at a time: step(deadline) works until the deadline and says when it has finished.
	function flyWorld(L, life, seedText) {
		var R = K.seeded(seedText), seed = Math.floor(R() * 1e6), Wd = { ready: false };
		var M0 = new Uint8Array(FN * FN), ch = new Float32Array(FC * FC), cm = new Float32Array(FC * FC), csh = new Float32Array(FC * FC), det = new Float32Array(64 * 64);
		var sea = 0.5, phase = 0, row = 0, rivers = [], towns = [], fields = [], CT = null;
		Wd.M0 = M0;
		function wrapD(d, n) { d = d % n; if (d > n / 2) { d -= n; } else if (d < -n / 2) { d += n; } return d; }
		function at(x, y) { return M0[((y & FNM) << 10) | (x & FNM)]; }
		function set(x, y, v) { M0[((y & FNM) << 10) | (x & FNM)] = v; }
		function isWater(v) { return v === F_WD || v === F_W0 || v === F_W1 || v === F_W2 || v === F_SHL || v === F_FOAM; }
		function isGrass(v) { return v === F_G0 || v === F_G1 || v === F_G2; }
		function coarseH(x, y) { return ch[(y & (FC - 1)) * FC + (x & (FC - 1))]; }
		function disc(cx, cy, r, v, onlyLand) {
			var x, y, r2 = r * r, q;
			for (y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
				for (x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
					if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) { continue; }
					q = at(x, y);
					if (onlyLand && isWater(q)) { continue; }
					set(x, y, v === F_W0 ? F_W0 + ((((x + y * 2) >> 1) % 3) + 3) % 3 : v);
				}
			}
		}
		function steps() {
			var x, y, i, j, n, h, d, mo, s, r, v, q, k, best, bx, by, path, cx, cy, ux, uy, tries, seen, a, b, t, w, len;
			if (phase === 0) {
				// the coarse lie of the land and where it is wet enough for woods, 16 rows a slice
				for (j = 0; j < 16 && row < FC; j++, row++) {
					for (x = 0; x < FC; x++) {
						h = fbm(x / 32, row / 32, 4, seed, 5);
						// a broad swell so the land gathers into islands with open sea between
						h = h * 0.75 + 0.25 * vn(x / 64, row / 64, 2, seed + 7);
						ch[row * FC + x] = h;
						cm[row * FC + x] = fbm(x / 16 + 3.7, row / 16 + 9.1, 8, seed + 99, 3);
					}
				}
				if (row >= FC) { phase = 1; row = 0; }
				return;
			}
			if (phase === 1) {
				// sea level: about 42% of the map is land
				var hist = new Uint32Array(256);
				for (i = 0; i < FC * FC; i++) { hist[Math.min(255, Math.max(0, Math.floor(ch[i] * 256)))]++; }
				for (n = 0, i = 0; i < 256; i++) { n += hist[i]; if (n >= FC * FC * 0.58) { break; } }
				sea = i / 256;
				// light from the top left: a bank facing it is lighter
				for (y = 0; y < FC; y++) { for (x = 0; x < FC; x++) { csh[y * FC + x] = ((coarseH(x - 1, y) - coarseH(x + 1, y)) + (coarseH(x, y - 1) - coarseH(x, y + 1))) * 16; } }
				for (i = 0; i < 64 * 64; i++) { det[i] = ih(i & 63, i >> 6, seed + 5); }
				// rivers: from high ground, downhill to the sea
				for (tries = 0; tries < 60 && rivers.length < 7; tries++) {
					x = Math.floor(R() * FC); y = Math.floor(R() * FC);
					if (coarseH(x, y) < sea + 0.12) { continue; }
					path = []; seen = {}; ux = x; uy = y;
					for (n = 0; n < 220; n++) {
						path.push(ux, uy); seen[(ux & 127) + "," + (uy & 127)] = 1;
						if (coarseH(ux, uy) < sea - 0.01) { break; }
						best = 9; bx = 0; by = 0;
						for (i = -1; i <= 1; i++) { for (k = -1; k <= 1; k++) { if (!i && !k) { continue; } if (seen[((ux + i) & 127) + "," + ((uy + k) & 127)]) { continue; } h = coarseH(ux + i, uy + k) + R() * 0.004; if (h < best) { best = h; bx = i; by = k; } } }
						if (best > 8) { break; }
						ux += bx; uy += by;
					}
					if (path.length >= 16 && coarseH(ux, uy) < sea) { rivers.push(path); }
				}
				// towns on low, flat land, well apart
				for (tries = 0; tries < 600 && towns.length < 9; tries++) {
					x = Math.floor(R() * FC); y = Math.floor(R() * FC); h = coarseH(x, y);
					if (h < sea + 0.02 || h > sea + 0.1 || Math.abs(coarseH(x + 2, y) - coarseH(x - 2, y)) > 0.05) { continue; }
					for (i = 0; i < towns.length; i++) { if (Math.abs(wrapD(towns[i][0] / 8 - x, FC)) + Math.abs(wrapD(towns[i][1] / 8 - y, FC)) < 20) { break; } }
					if (i < towns.length) { continue; }
					towns.push([x * 8 + 4, y * 8 + 4, 3 + Math.floor(R() * 3)]);
				}
				for (tries = 0; tries < 900 && fields.length < 70; tries++) {
					x = Math.floor(R() * FC); y = Math.floor(R() * FC); h = coarseH(x, y);
					if (h < sea + 0.025 || h > sea + 0.2 || cm[(y & 127) * FC + (x & 127)] > 0.56) { continue; }
					fields.push([x * 8 + Math.floor(R() * 8), y * 8 + Math.floor(R() * 8), 8 + Math.floor(R() * 16), 6 + Math.floor(R() * 14), Math.floor(R() * 4)]);
				}
				Wd.towns = towns;
				phase = 2; row = 0;
				return;
			}
			if (phase === 2) {
				// the map itself, 24 rows a slice
				for (j = 0; j < 24 && row < FN; j++, row++) {
					y = row;
					for (x = 0; x < FN; x++) {
						h = bil(ch, FC, x / 8 - 0.5, y / 8 - 0.5) + (bil(det, 64, x / 5, y / 5) - 0.5) * 0.018;
						d = h - sea; r = ih(x, y, seed);
						if (d < -0.06) { v = r < 0.035 ? F_W0 + ((x + y) >> 2) % 3 : F_WD; }
						else if (d < -0.013) { v = F_W0 + ((x + 2 * y + ((bil(det, 64, x / 9, y / 9) * 12) | 0)) >> 1) % 3; }
						else if (d < 0) { v = F_SHL; }
						else if (d < 0.012) { v = r < 0.3 ? F_SA1 : F_SA0; }
						else {
							s = bil(csh, FC, x / 8 - 0.5, y / 8 - 0.5) + (r - 0.5) * 0.5;
							mo = bil(cm, FC, x / 8 - 0.5, y / 8 - 0.5);
							if (d > 0.31) { v = d > 0.35 ? F_SN : s > 0.2 ? F_R0 : F_R1; }
							else if (d > 0.24) { v = s > 0.35 ? F_R0 : s > -0.3 ? (r < 0.5 ? F_R1 : F_G2) : F_R1; }
							else if (mo > 0.57 && d > 0.025) { v = s > 0.5 ? F_G2 : r < 0.42 ? F_F1 : F_F0; }
							else { v = s > 0.45 || r < 0.05 ? F_G0 : s < -0.45 || r > 0.95 ? F_G2 : F_G1; }
						}
						M0[(y << 10) | x] = v;
					}
				}
				if (row >= FN) { phase = 3; row = 0; }
				return;
			}
			if (phase === 3) {
				// fields: stripes of crops in hedged plots
				for (i = 0; i < fields.length; i++) {
					a = fields[i];
					for (y = 0; y < a[3]; y++) {
						for (x = 0; x < a[2]; x++) {
							q = at(a[0] + x, a[1] + y);
							if (!isGrass(q)) { continue; }
							if (x === 0 || y === 0 || x === a[2] - 1 || y === a[3] - 1) { set(a[0] + x, a[1] + y, F_G2); continue; }
							t = a[4] & 1 ? x : y;
							v = a[4] < 2 ? ((t >> 1) & 1 ? F_FD1 : F_FD0) : ((t >> 1) & 1 ? F_FD2 : F_G0);
							set(a[0] + x, a[1] + y, v);
						}
					}
				}
				phase = 4;
				return;
			}
			if (phase === 4) {
				// roads between the towns, then the towns: checkered blocks of roofs, a square in the middle
				for (i = 0; i < towns.length; i++) {
					a = towns[i]; b = towns[(i + 1) % towns.length];
					if (towns.length < 2) { break; }
					ux = a[0]; uy = a[1]; bx = wrapD(b[0] - a[0], FN); by = wrapD(b[1] - a[1], FN);
					for (n = 0, k = 0; k !== bx; k += bx > 0 ? 1 : -1) { n += isWater(at(ux + k, uy)) ? 1 : 0; }
					for (k = 0; k !== by; k += by > 0 ? 1 : -1) { n += isWater(at(ux + bx, uy + k)) ? 1 : 0; }
					if (n > (Math.abs(bx) + Math.abs(by)) * 0.12) { continue; }
					for (k = 0; k !== bx; k += bx > 0 ? 1 : -1) { set(ux + k, uy, at(ux + k, uy) === F_WD || isWater(at(ux + k, uy)) ? F_RDL : F_RD); set(ux + k, uy + 1, isWater(at(ux + k, uy + 1)) ? F_RDL : F_RD); }
					for (k = 0; k !== by; k += by > 0 ? 1 : -1) { set(ux + bx, uy + k, isWater(at(ux + bx, uy + k)) ? F_RDL : F_RD); set(ux + bx + 1, uy + k, isWater(at(ux + bx + 1, uy + k)) ? F_RDL : F_RD); }
				}
				for (i = 0; i < towns.length; i++) {
					a = towns[i]; n = a[2]; cx = a[0] - n * 4; cy = a[1] - n * 4;
					for (y = 0; y < n * 8; y++) {
						for (x = 0; x < n * 8; x++) {
							q = at(cx + x, cy + y);
							if (isWater(q)) { continue; }
							bx = Math.floor(x / 8); by = Math.floor(y / 8); ux = x % 8; uy = y % 8;
							// round the corners of the town off
							if ((bx === 0 || bx === n - 1) && (by === 0 || by === n - 1) && ih(bx, by, seed + i) < 0.7) { continue; }
							if (ux >= 6 || uy >= 6) { v = F_ST; }
							else if (bx === (n >> 1) && by === (n >> 1)) { v = ux === 0 || uy === 0 || ux === 5 || uy === 5 ? F_G0 : F_SA0; }
							else if ((bx + by) & 1) {
								// a red roof, its ridge across the middle: lit side and shaded side
								v = uy < 3 ? F_RF0 : F_RF2;
								if (L.lights && uy === 5 && (ux === 1 || ux === 4) && ih(cx + x, cy + y, seed + 8) < 0.6) { v = F_WIN; }
							} else {
								// a pale flat roof with a darker rim
								v = ux === 0 || uy === 0 || ux === 5 || uy === 5 ? F_RF3 : F_RF1;
								if (L.lights && ux > 0 && ux < 5 && uy > 0 && uy < 5 && ((ux + uy) & 1) && ih(cx + x, cy + y, seed + 8) < 0.5) { v = F_WIN; }
							}
							set(cx + x, cy + y, v);
						}
					}
				}
				phase = 5; row = 0;
				return;
			}
			if (phase === 5) {
				// surf along every shore, 64 rows a slice
				for (j = 0; j < 64 && row < FN; j++, row++) {
					y = row;
					for (x = 0; x < FN; x++) {
						q = M0[(y << 10) | x];
						if (q !== F_SHL && q !== F_W0 && q !== F_W1 && q !== F_W2) { continue; }
						if (!isWater(at(x + 1, y)) || !isWater(at(x - 1, y)) || !isWater(at(x, y + 1)) || !isWater(at(x, y - 1))) { M0[(y << 10) | x] = F_FOAM; }
					}
				}
				if (row >= FN) { phase = 6; row = 0; }
				return;
			}
			if (phase === 6) {
				// rivers, wider as they go
				for (i = 0; i < rivers.length; i++) {
					path = rivers[i]; len = path.length / 2;
					for (n = 0; n + 1 < len; n++) {
						ux = (path[n * 2] + 0.5) * 8 + (ih(path[n * 2], path[n * 2 + 1], seed + 3) - 0.5) * 5;
						uy = (path[n * 2 + 1] + 0.5) * 8 + (ih(path[n * 2], path[n * 2 + 1], seed + 4) - 0.5) * 5;
						bx = (path[n * 2 + 2] + 0.5) * 8 + (ih(path[n * 2 + 2], path[n * 2 + 3], seed + 3) - 0.5) * 5;
						by = (path[n * 2 + 3] + 0.5) * 8 + (ih(path[n * 2 + 2], path[n * 2 + 3], seed + 4) - 0.5) * 5;
						bx = ux + wrapD(bx - ux, FN); by = uy + wrapD(by - uy, FN);
						w = 0.9 + 1.4 * n / len;
						for (k = 0; k <= 8; k++) { disc(ux + (bx - ux) * k / 8, uy + (by - uy) * k / 8, w, F_W0, false); }
					}
				}
				phase = 7;
				return;
			}
			if (phase === 7) {
				// smaller copies for the distance: the commonest of each 2 x 2 cells (palette colours are never averaged)
				Wd.M1 = half(M0, FN); Wd.M2 = half(Wd.M1, FN >> 1);
				phase = 8; row = 0; CT = new Uint8Array(256 * 256); Wd.CT = CT;
				return;
			}
			if (phase === 8) {
				// the cloud deck, 64 rows a slice
				for (j = 0; j < 64 && row < 256; j++, row++) {
					for (x = 0; x < 256; x++) {
						h = fbm(x / 32, row / 32, 8, seed + 300, 4) * 0.7 + 0.3 * vn(x / 64, row / 64, 4, seed + 301);
						CT[row * 256 + x] = h > 0.6 ? (h > 0.64 ? 1 : 2) : 0;
					}
				}
				if (row >= 256) { phase = 9; }
				return;
			}
			if (phase === 9) { places(); Wd.ready = true; phase = 10; }
		}
		function half(src, n) {
			var m = n >> 1, out = new Uint8Array(m * m), x, y, a, b, c, d, i = 0, sh = Math.round(Math.log(n) / Math.LN2);
			for (y = 0; y < m; y++) {
				for (x = 0; x < m; x++) {
					a = src[((y * 2) << sh) | (x * 2)]; b = src[((y * 2) << sh) | (x * 2 + 1)]; c = src[((y * 2 + 1) << sh) | (x * 2)]; d = src[((y * 2 + 1) << sh) | (x * 2 + 1)];
					out[i++] = (a === b || a === c || a === d) ? a : (b === c || b === d) ? b : c === d ? c : a;
				}
			}
			return out;
		}
		// where the sprites stand
		function places() {
			var n = 0, MAX = 2600, SX = new Float32Array(MAX), SY = new Float32Array(MAX), SA = new Float32Array(MAX), SK = new Uint8Array(MAX), SS = new Float32Array(MAX), SP = new Float32Array(MAX);
			var i, x, y, q, k, tries, want = Math.round(1700 * Math.min(1.5, life)), a;
			function add(kind, px, py, alt, sz) { if (n >= MAX) { return; } SX[n] = px; SY[n] = py; SA[n] = alt; SK[n] = kind; SS[n] = sz; SP[n] = R(); n++; }
			for (tries = 0; tries < want * 6 && n < want; tries++) {
				x = R() * FN; y = R() * FN; q = at(x | 0, y | 0);
				if (q === F_F0 || q === F_F1) { if (R() < 0.85) { add(L.conifer || R() < 0.3 ? FK_PINE : FK_TREE, x, y, 0, 0.8 + R() * 0.45); } }
				else if (isGrass(q) && R() < 0.05) { add(L.conifer && R() < 0.7 ? FK_PINE : FK_TREE, x, y, 0, 0.7 + R() * 0.4); }
			}
			// lighthouses on the shore, towers on the hills, a church in every town, windmills by the fields
			for (tries = 0, k = 0; tries < 4000 && k < 5; tries++) {
				x = Math.floor(R() * FN); y = Math.floor(R() * FN); q = at(x, y);
				if ((q === F_SA0 || q === F_SA1) && isWater(at(x + 4, y)) + isWater(at(x - 4, y)) + isWater(at(x, y + 4)) + isWater(at(x, y - 4)) >= 1) { add(FK_LIGHT, x + 0.5, y + 0.5, 0, 1); k++; }
			}
			for (tries = 0, k = 0; tries < 4000 && k < 4; tries++) {
				x = Math.floor(R() * FN); y = Math.floor(R() * FN); q = at(x, y);
				if (q === F_R0 || q === F_R1) { add(FK_TOWER, x + 0.5, y + 0.5, 0, 1); k++; }
			}
			for (i = 0; i < towns.length; i++) { add(FK_CHURCH, towns[i][0] - towns[i][2] * 4 + (towns[i][2] >> 1) * 8 + 3, towns[i][1] - towns[i][2] * 4 + (towns[i][2] >> 1) * 8 + 3, 0, 1); }
			for (i = 0, k = 0; i < fields.length && k < 8; i += 3) { a = fields[i]; q = at(a[0] - 2, a[1] - 2); if (isGrass(q)) { add(FK_MILL, a[0] - 2, a[1] - 2, 0, 1); k++; } }
			Wd.nFixed = n;
			for (i = 0; i < Math.round(9 * life); i++) { add(R() < 0.5 ? FK_BALLA : FK_BALLB, R() * FN, R() * FN, 30 + R() * 22, 0.85 + R() * 0.4); }
			Wd.nBall = n;
			Wd.flocks = L.moon ? 0 : Math.round(3 * life);
			for (i = 0; i < Wd.flocks; i++) { for (k = 0; k < 5; k++) { add(FK_BIRD, 0, 0, 0, 1); SP[n - 1] = i * 5 + k; } }
			Wd.n = n; Wd.SX = SX; Wd.SY = SY; Wd.SA = SA; Wd.SK = SK; Wd.SS = SS; Wd.SP = SP;
		}
		Wd.step = function (deadline) {
			var guard = 0;
			while (!Wd.ready && guard++ < 40) { steps(); if (now() > deadline) { break; } }
			return Wd.ready;
		};
		return Wd;
	}

	function startFly(host, o) {
		var S = settings(o, FLY, "day"), L = FLY[S.look];
		var c1 = rgb3(o.c1, L.c[0]), c2 = rgb3(o.c2, L.c[1]), c3 = rgb3(o.c3, L.c[2]);
		var RGB = flyPal(L, c1, c2, c3), NF = 4, LUT = new Uint32Array(NF * 64), SKYC = new Uint32Array(64), i, j;
		for (j = 0; j < NF; j++) { for (i = 0; i < F_N; i++) { LUT[(j << 6) | i] = pk(mx(RGB[i], RGB[F_HAZE], j / (NF - 1))); } }
		for (i = 0; i < F_N; i++) { SKYC[i] = pk(RGB[i]); }
		var IM = flyImages(), Wd = null, ready = false, reveal = 0, cyc = -1, born = now(), placed = false;
		var V = null, FOC = 200, HZ = 70, AMAX = 0, skyK = null, skyT = null, sunR = 9, sunEl = 40, tanH = 1;
		var FOG0 = 110, FOG1 = 470, FOGK = 16 * (NF - 1) / (FOG1 - FOG0), CLOUD = 54, CFAR = 760, OFS = FN * 8;
		var T = 0, yaw0 = 0.9, yaw = yaw0, roll = 0, camH = 26, pitch = 0, camX = 512, camY = 512, wind = 0;
		var MAXV = 2700, VI = new Int32Array(MAXV), VZ = new Float32Array(MAXV), VX = new Float32Array(MAXV), VY = new Float32Array(MAXV), VS = new Float32Array(MAXV), nv = 0;
		var flockT = null;
		// the camera: slow turns either way, banking into them, a gentle rise and fall
		function camera(sdt) {
			var m = S.motion, amp = 0.55 + 0.45 * Math.min(1, m), a1 = 0.52 * amp, a2 = 0.24 * amp, turn, spd = 15;
			yaw = yaw0 + a1 * Math.sin(T * 0.06) + a2 * Math.sin(T * 0.15 + 1.3);
			turn = a1 * 0.06 * Math.cos(T * 0.06) + a2 * 0.15 * Math.cos(T * 0.15 + 1.3);
			camX += Math.cos(yaw) * spd * sdt; camY += Math.sin(yaw) * spd * sdt;
			camX -= Math.floor(camX / FN) * FN; camY -= Math.floor(camY / FN) * FN;
			roll = K.clamp(-turn * 2.8 * m, -0.32, 0.32);
			camH = 26 + m * (2.4 * Math.sin(T * 0.08) + 1.0 * Math.sin(T * 0.23 + 2));
			pitch = V ? m * V.U * 2 * Math.sin(T * 0.1 + 0.5) : 0;
			wind += sdt * 1.6;
		}
		function resize(F) {
			V = view(F);
			FOC = 200 * V.U;
			var hzf = V.tall ? 0.4 : 0.36, top, a, f, k;
			if (S.layout === "top") { hzf += 0.08; } else if (S.layout === "bottom") { hzf -= 0.04; }
			HZ = V.vh * hzf;
			tanH = (V.w / 2 + 30 * V.U) / FOC;
			AMAX = Math.ceil(V.vh * 1.5 + V.w) + 8;
			skyK = new Uint8Array(AMAX); skyT = new Uint8Array(AMAX);
			top = Math.max(8, HZ * 1.02);
			for (a = 0; a < AMAX; a++) {
				f = Math.min(0.9999, Math.pow(a / top, 0.85)) * 5; k = Math.floor(f);
				skyK[a] = k; skyT[a] = Math.round(K.clamp((f - k - 0.32) / 0.36, 0, 1) * 16);
			}
			sunR = Math.max(3, Math.round(L.sun[1] * V.U)); sunEl = L.sun[0] * HZ;
		}
		function step(sdt) {
			T += sdt;
			if (!ready) {
				if (!Wd) { Wd = flyWorld(L, S.life, "fly-" + S.look); }
				// the first frames show the sky over open sea while the map is made a few milliseconds at a time
				else if (Wd.step(now() + (now() - born < 300 ? 5 : 8))) { ready = true; }
			} else if (reveal < 16) { reveal = Math.min(16, reveal + sdt / S.speed * 24); }
			if (!placed) {
				// the flight starts a little way short of a town, so the first thing seen is not open sea
				if (!Wd || !Wd.towns) { camera(0); return; }
				placed = true;
				if (Wd.towns.length) { camX = Wd.towns[0][0] - Math.cos(yaw0) * 150 - 20; camY = Wd.towns[0][1] - Math.sin(yaw0) * 150; }
			}
			camera(sdt);
			// the sea's ripples: three slots of the palette turn round every so often
			var c = Math.floor(T * 2.2) % 3, n;
			if (c !== cyc) {
				cyc = c;
				for (j = 0; j < NF; j++) {
					for (n = 0; n < 3; n++) {
						LUT[(j << 6) | (F_W0 + n)] = pk(mx(RGB[F_W0 + (n + c) % 3], RGB[F_HAZE], j / (NF - 1)));
						LUT[(j << 6) | (F_GW + n)] = pk(mx(RGB[F_GW + (n + c) % 3], RGB[F_HAZE], j / (NF - 1) * 0.6));
					}
				}
			}
		}
		function draw(F) {
			var w = F.w, h = F.h, px = F.px, cxs = w / 2, hzr = HZ - V.off + pitch;
			var cr = Math.cos(roll), sr = Math.sin(roll), fx = Math.cos(yaw), fy = Math.sin(yaw), rx = -fy, ry = fx;
			var hf = camH * FOC, cf = CLOUD * FOC, inf = 1 / FOC, bx = camX + OFS, by = camY + OFS, cbx = camX + OFS + wind, cby = camY + OFS + wind * 0.4;
			var M0 = ready ? Wd.M0 : null, M1 = ready ? Wd.M1 : null, M2 = ready ? Wd.M2 : null, CT = ready ? Wd.CT : null, rv = reveal;
			var su = FOC * Math.tan(K.clamp(yaw0 - yaw, -1.3, 1.3)) * Math.min(1, V.w / 320 / V.U), sv = -sunEl, R2 = sunR * sunR, RH = sunR + 6 * V.U, RH2 = RH * RH, stars = !!L.stars, stripes = !!L.stripes;
			var yawPix = yaw * FOC, HZC = LUT[(3 << 6) | F_HAZE], gw = sunR * (L.moon ? 0.7 : stripes ? 1.15 : 0.6), gk = L.moon ? 0.05 : 0.12, glit = Math.abs(su) < w * 0.5 + gw * 2;
			var x, y, o, b, u, v, z, k, wx, wy, idx, l, a, bi, du, dv, d2, dx, dy, c, sx;
			for (y = 0; y < h; y++) {
				dy = y + 0.5 - hzr; dx = 0.5 - cxs;
				u = dx * cr + dy * sr; v = -dx * sr + dy * cr;
				o = y * w; b = (y & 3) << 2;
				for (x = 0; x < w; x++, u += cr, v -= sr) {
					bi = b | (x & 3);
					if (v > 0.5) {
						z = hf / v;
						if (z >= FOG1) { px[o + x] = HZC; continue; }
						k = z * inf;
						if (M0 && BAY[bi] < rv) {
							wx = bx + z * fx + u * k * rx; wy = by + z * fy + u * k * ry;
							if (k < 0.85) { idx = M0[((wy & FNM) << 10) | (wx & FNM)]; }
							else if (k < 1.7) { idx = M1[(((wy * 0.5) & 511) << 9) | ((wx * 0.5) & 511)]; }
							else { idx = M2[(((wy * 0.25) & 255) << 8) | ((wx * 0.25) & 255)]; }
						} else { idx = F_WD; }
						if (glit && idx >= F_W0 && idx <= F_W2) { du = (u - su) / (gw + v * gk); if (du * du * 16 < 8 + BAY[bi]) { idx += F_GW - F_W0; } }
						l = z > FOG0 ? (((z - FOG0) * FOGK) | 0) + BAY[bi] >> 4 : 0;
						px[o + x] = LUT[(l << 6) | idx];
						continue;
					}
					a = -v | 0;
					if (a >= AMAX) { a = AMAX - 1; }
					idx = F_SKY + 5 - skyK[a] - (BAY[bi] < skyT[a] ? 1 : 0);
					if (stars && a > 8 && idx < F_SKY + 3) {
						sx = (u + yawPix) | 0;
						c = Math.imul(sx * 73856093 ^ a * 19349663, 1103515245) >>> 22;
						if (c < 3 || (c === 3 && ((T * 3) | 0) & 1)) { idx = F_STAR; }
					}
					du = u - su; dv = v - sv; d2 = du * du + dv * dv;
					if (d2 < R2) {
						if (L.moon) { idx = (du + 2) * (du + 2) + (dv + 1) * (dv + 1) < R2 * 0.18 || (du - 3) * (du - 3) + (dv - 2) * (dv - 2) < R2 * 0.08 ? F_SUN1 : F_SUN0; }
						else if (stripes && dv > sunR * 0.12 && ((dv / V.U) | 0) % 4 < 1 + (dv / sunR) * 2.4) { idx = F_SKY + 5; }
						else { idx = dv > sunR * 0.45 && !stripes ? F_SUN1 : F_SUN0; }
					} else if (d2 < RH2 && BAY[bi] < (RH - Math.sqrt(d2)) * 8 / (6 * V.U) && !stars) { idx = F_SUN1; }
					if (CT && a > 1) {
						z = cf / -v;
						if (z < CFAR) {
							k = z * inf;
							wx = cbx + z * fx + u * k * rx; wy = cby + z * fy + u * k * ry;
							c = CT[(((wy * 0.25) & 255) << 8) | ((wx * 0.25) & 255)];
							if (c && (z < 380 || ((((z - 380) * 0.042) | 0) + BAY[bi] >> 4) < 1)) { idx = c === 1 ? F_CLD0 : F_CLD1; }
						}
					}
					px[o + x] = SKYC[idx];
				}
			}
			if (ready) { sprites(F, cxs, hzr, cr, sr, fx, fy, rx, ry); }
		}
		function sprites(F, cxs, hzr, cr, sr, fx, fy, rx, ry) {
			var n = Wd.n, SX = Wd.SX, SY = Wd.SY, SA = Wd.SA, SK = Wd.SK, SS = Wd.SS, SP = Wd.SP, i, j, k, dx, dy, zc, xc, us, vs, ti, tz, im, f16, hgt, fl;
			// balloons drift with the wind; the flocks fly the other way to the camera and are sent on ahead once passed
			for (i = Wd.nFixed; i < Wd.nBall; i++) { SX[i] = (SX[i] + 0.04) % FN; SY[i] = (SY[i] + 0.012) % FN; }
			if (!flockT) { flockT = new Float32Array(Math.max(1, Wd.flocks) * 3); for (i = 0; i < Wd.flocks; i++) { flockT[i * 3 + 2] = -1; } }
			for (i = 0; i < Wd.flocks; i++) {
				dx = flockT[i * 3] - camX; dy = flockT[i * 3 + 1] - camY; dx -= Math.round(dx / FN) * FN; dy -= Math.round(dy / FN) * FN;
				if (flockT[i * 3 + 2] < 0 || dx * fx + dy * fy < -20) {
					k = 260 + 140 * Math.random(); j = (Math.random() - 0.5) * 2 * k * 0.5;
					flockT[i * 3] = camX + fx * k + rx * j; flockT[i * 3 + 1] = camY + fy * k + ry * j; flockT[i * 3 + 2] = camH - 4 - Math.random() * 8;
				}
				flockT[i * 3] -= fx * 0.12; flockT[i * 3 + 1] -= fy * 0.12;
			}
			for (i = Wd.nBall; i < n; i++) {
				k = SP[i] | 0; j = (k / 5) | 0; k = k % 5;
				SX[i] = flockT[j * 3] + (k === 0 ? 0 : ((k + 1) >> 1) * 2.2 * (k & 1 ? 1 : -1)) * rx - ((k + 1) >> 1) * 1.8 * fx;
				SY[i] = flockT[j * 3 + 1] + (k === 0 ? 0 : ((k + 1) >> 1) * 2.2 * (k & 1 ? 1 : -1)) * ry - ((k + 1) >> 1) * 1.8 * fy;
				SA[i] = flockT[j * 3 + 2];
			}
			nv = 0;
			for (i = 0; i < n; i++) {
				dx = SX[i] - camX; dy = SY[i] - camY;
				dx -= Math.round(dx / FN) * FN; dy -= Math.round(dy / FN) * FN;
				zc = dx * fx + dy * fy;
				if (zc < 3 || zc >= FOG1) { continue; }
				xc = dx * rx + dy * ry;
				if (Math.abs(xc) > zc * tanH + 12) { continue; }
				if (nv >= MAXV) { break; }
				us = FOC * xc / zc; vs = FOC * (camH - SA[i]) / zc;
				VI[nv] = i; VZ[nv] = zc; VX[nv] = cxs + us * cr - vs * sr; VY[nv] = hzr + us * sr + vs * cr; VS[nv] = FOC * FK_H[SK[i]] * SS[i] / zc; nv++;
			}
			// far first
			for (i = 1; i < nv; i++) {
				ti = VI[i]; tz = VZ[i]; us = VX[i]; vs = VY[i]; hgt = VS[i]; j = i - 1;
				while (j >= 0 && VZ[j] < tz) { VI[j + 1] = VI[j]; VZ[j + 1] = VZ[j]; VX[j + 1] = VX[j]; VY[j + 1] = VY[j]; VS[j + 1] = VS[j]; j--; }
				VI[j + 1] = ti; VZ[j + 1] = tz; VX[j + 1] = us; VY[j + 1] = vs; VS[j + 1] = hgt;
			}
			for (j = 0; j < nv; j++) {
				i = VI[j]; k = SK[i]; zc = VZ[j];
				f16 = zc > FOG0 ? ((zc - FOG0) * FOGK) | 0 : 0;
				fl = k >= FK_BALLA;
				if (fl && zc < 14) { f16 = Math.max(f16, ((14 - zc) * 5.3) | 0); }
				im = k === FK_TREE ? IM.tree : k === FK_PINE ? IM.pine : k === FK_LIGHT ? (L.lights && ((T * 1.4 + SP[i] * 7) % 2) > 1 ? IM.lightOff : IM.light) : k === FK_TOWER ? IM.tower : k === FK_CHURCH ? IM.church : k === FK_MILL ? IM.mill : k === FK_BALLA ? IM.ballA : k === FK_BALLB ? IM.ballB : ((T * 5 + SP[i] * 1.7) % 2 > 1 ? IM.bird0 : IM.bird1);
				hgt = VS[j];
				blit(F, im, VX[j], VY[j], hgt / im.h, cr, sr, f16, LUT, NF - 1);
				if (k === FK_MILL) {
					// the sails turn on the front of the mill
					im = IM.sails[((T * 3 + SP[i] * 4) | 0) & 3];
										blit(F, im, VX[j] + hgt * 0.22 * sr, VY[j] - hgt * 0.22 * cr, hgt * 1.05 / im.h, cr, sr, f16, LUT, NF - 1);
				}
			}
		}
		return run(host, S, { resize: resize, step: step, draw: draw }, c1, c2);
	}
	K.addEngine({ id: "bit3d-flyover", label: "8-bit 3D: flight over islands", colors: FLY.day.c, start: startFly });

	// ================================================================ the template
	var SCENES = [["flyover", "Flight over islands"], ["dungeon", "Dungeon walk"], ["canyon", "Canyon run"], ["vector", "Vector space"], ["road", "Open road"]];
	var LOOKS = {
		flyover: { list: FLY, opts: [["day", "Sunny day"], ["sunset", "Sunset"], ["night", "Moonlit night"], ["snow", "Winter"]] }
	};
	var LIVE = SCENES.filter(function (s) { return !!SSO.ENGINES["bit3d-" + s[0]] && LOOKS[s[0]]; });
	SSO.register({
		id: "retro3d",
		name: "8-bit 3D backgrounds",
		category: "worlds",
		description: "Full-screen moving pictures in an old console style with real depth, to sit behind a title, a camera or a break screen: a flight over islands, a torch-lit dungeon walk, a canyon run, a vector-line space ride and an open road. Pick the look, the pixel size and how much the camera sways.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Scene", type: "select", group: "Scene", default: LIVE.length ? LIVE[0][0] : "flyover", options: LIVE }
		].concat(LIVE.map(function (s) {
			var L = LOOKS[s[0]];
			return { key: s[0], label: "Look", type: "select", group: "Scene", default: L.opts[0][0], options: L.opts, show: { scene: s[0] } };
		})).concat([
			{ key: "life", label: "How much passes by", type: "range", group: "Scene", default: 1, min: 0, max: 2, step: 0.1 },
			{ key: "c1", label: "Colour 1: sky or stone (blank = the look's own)", type: "color", group: "Colours", default: "" },
			{ key: "c2", label: "Colour 2: sun, glow or torchlight (blank = the look's own)", type: "color", group: "Colours", default: "" },
			{ key: "c3", label: "Colour 3: sea, rock, lines or signs (blank = the look's own)", type: "color", group: "Colours", default: "" },
			{ key: "speed", label: "Speed", type: "range", group: "Motion", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "motion", label: "Camera sway", type: "select", group: "Motion", default: "gentle", options: [["steady", "Steady (no banking or swaying)"], ["gentle", "Gentle"], ["lively", "Lively"]] },
			{ key: "pixels", label: "Pixel size", type: "select", group: "Look", default: "standard", options: [["chunky", "Chunky"], ["standard", "Standard"], ["fine", "Fine"]] },
			{ key: "tube", label: "Old TV lines", type: "bool", group: "Look", default: false }
		]),
		presets: [
			{ name: "Flight over islands, sunny day", tags: ["retro", "3d", "gaming", "summer"], values: { scene: "flyover", flyover: "day" } },
			{ name: "Flight over islands at sunset", tags: ["retro", "3d", "cozy"], values: { scene: "flyover", flyover: "sunset" } },
			{ name: "Night flight, town lights", tags: ["retro", "3d", "cozy"], values: { scene: "flyover", flyover: "night" } },
			{ name: "Winter flight, snowy islands", tags: ["retro", "3d", "winter"], values: { scene: "flyover", flyover: "snow" } }
		].filter(function (p) { return LIVE.some(function (s) { return s[0] === p.values.scene; }); }),
		render: function (root, c) {
			var host = document.createElement("div"), L = LOOKS[c.scene], look = c[c.scene], cols = L && L.list[look] ? L.list[look].c : [];
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;background:#000;";
			root.appendChild(host);
			SSO.startEngine("bit3d-" + c.scene, host, {
				c1: c.c1 || cols[0], c2: c.c2 || cols[1], c3: c.c3 || cols[2], look: look, speed: c.speed, motion: c.motion, life: c.life, tube: c.tube, pixels: c.pixels
			});
		}
	});
})();
