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
	var CAP = 140000, WMAX = 720;
	function now() { return performance.now(); }
	// A three-step diagonal ripple (0..2) that repeats exactly every 1024 cells either way, so a tiling map has no seam.
	function rip(x, y, d) { return ((((x + 2 * y + d) * 171) & 1023) * 3) >> 10; }

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
	// One ImageData the size of the art grid (or, past CAP art pixels or WMAX columns, a coarser copy enlarged onto it), with
	// a Uint32Array view. The width is capped as well as the area, because the depth scenes walk every column at every
	// distance: a 4320 x 32 strip would otherwise cost thirteen times a 16:9 picture. fit() is called at the start of every
	// frame and says whether the size changed; show() puts the frame up. broken: the coarser copy could not get a canvas.
	function buffer(sc) {
		var F = { w: 2, h: 2, cw: 0, ch: 0, img: null, px: null, off: null, og: null, broken: false };
		F.fit = function () {
			var cw = sc.cv.width, ch = sc.cv.height, w = cw, h = ch, s, tg;
			if (cw === F.cw && ch === F.ch && (F.img || F.broken)) { return false; }
			F.cw = cw; F.ch = ch; F.img = null; F.px = null; F.off = null; F.og = null; F.broken = false;
			if (cw * ch > CAP || cw > WMAX) { s = Math.min(Math.sqrt(CAP / (cw * ch)), WMAX / cw); w = Math.max(2, Math.floor(cw * s)); h = Math.max(2, Math.floor(ch * s)); }
			if (w !== cw || h !== ch) { F.off = K.canvas(w, h); F.og = F.off.getContext("2d"); if (!F.og) { F.broken = true; } }
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
	// 60 frames a second, because every scene is a moving camera and the motion is visibly smoother; under load the page's
	// governor asks for a lower resolution, and the answer is a coarser grid in whole art-pixel steps (6 becomes 8, then 11),
	// which costs roughly half and a quarter as much. The governor's own frame-rate steps come after that.
	function run(host, S, def, fallA, fallB) {
		var GOV = window.SSO_FRAMES || null, opts = { fps: def.fps || 60, pixelated: true, artPixel: S.px }, unhook = null, gave = null;
		function grid(r) { opts.artPixel = Math.max(S.px, Math.round(S.px / Math.max(0.3, r > 0 ? r : 1))); }
		if (GOV && GOV.scale) { grid(GOV.scale()); }
		var sc = K.scene(host, opts);
		if (!sc.g) { sc.stop(); return failed(host, fallA, fallB); }
		if (GOV && GOV.onScale) { unhook = GOV.onScale(grid); }
		var F = buffer(sc), tb = S.tube ? tube(host, sc) : null, alive = true;
		function halt() { alive = false; sc.stop(); if (unhook) { unhook(); unhook = null; } if (tb) { tb.remove(); tb = null; } }
		sc.frame = function (g, dt) {
			if (!alive) { return; }
			if (F.fit()) { if (tb) { tb.fit(); } if (F.img && def.resize) { def.resize(F); } }
			// no canvas for the coarser copy: the plain sky instead, and nothing more is tried
			if (F.broken) { halt(); gave = failed(host, fallA, fallB); return; }
			if (!F.img) { return; }
			dt = Math.min(0.1, Math.max(0, dt || 0));
			if (def.step) { def.step(dt * S.speed, dt); }
			def.draw(F);
			F.show();
		};
		return { stop: function () { if (gave) { gave.stop(); gave = null; } if (!alive) { return; } halt(); if (def.stop) { def.stop(); } } };
	}
	// Halves a square map (n a power of two) a few rows at a time: the commonest of each 2 x 2 for colours (palette slots
	// are never averaged), the mean for heights. step(deadline) carries on where it stopped and says when it is done.
	function halver(src, n, mode) {
		var m = n >> 1, out = new Uint8Array(m * m), sh = Math.round(Math.log(n) / Math.LN2), row = 0;
		return { out: out, step: function (deadline) {
			var x, a, b, c, d, i, r0, r1;
			while (row < m) {
				i = row * m; r0 = (row * 2) << sh; r1 = (row * 2 + 1) << sh;
				for (x = 0; x < m; x++, i++) {
					a = src[r0 | (x * 2)]; b = src[r0 | (x * 2 + 1)]; c = src[r1 | (x * 2)]; d = src[r1 | (x * 2 + 1)];
					out[i] = mode ? ((a === b || a === c || a === d) ? a : (b === c || b === d) ? b : c === d ? c : a) : (a + b + c + d + 2) >> 2;
				}
				row++;
				if ((row & 7) === 0 && now() > deadline) { break; }
			}
			return row >= m;
		} };
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
					set(x, y, v === F_W0 ? F_W0 + rip(x, y, 0) : v);
				}
			}
		}
		var red = null;
		function steps(deadline) {
			var x, y, i, j, n, h, d, mo, s, r, v, q, k, best, bx, by, path, cx, cy, ux, uy, tries, seen, a, b, t, w, len;
			if (phase === 0) {
				// the coarse lie of the land and where it is wet enough for woods, a row at a time until the deadline
				for (; row < FC; ) {
					for (x = 0; x < FC; x++) {
						h = fbm(x / 32, row / 32, 4, seed, 5);
						// a broad swell so the land gathers into islands with open sea between
						h = h * 0.75 + 0.25 * vn(x / 64, row / 64, 2, seed + 7);
						ch[row * FC + x] = h;
						cm[row * FC + x] = fbm(x / 16 + 3.7, row / 16 + 9.1, 8, seed + 99, 3);
					}
					row++;
					if (now() > deadline) { break; }
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
				// is there land here (from the coarse map; used to pick where the flight starts)
				Wd.land = function (x, y) { return bil(ch, FC, x / 8 - 0.5, y / 8 - 0.5) > sea + 0.004; };
				phase = 2; row = 0;
				return;
			}
			if (phase === 2) {
				// the map itself, a row at a time until the deadline (the detail grid is read so that it repeats a whole number of
				// times across the map, and the ripples repeat every 1024 cells, so the map joins up without a seam)
				for (; row < FN; ) {
					y = row;
					for (x = 0; x < FN; x++) {
						h = bil(ch, FC, x / 8 - 0.5, y / 8 - 0.5) + (bil(det, 64, x / 4, y / 4) - 0.5) * 0.018;
						d = h - sea; r = ih(x, y, seed);
						if (d < -0.06) { v = r < 0.035 ? F_W0 + (((((x + y) * 85) & 1023) * 3) >> 10) : F_WD; }
						else if (d < -0.013) { v = F_W0 + rip(x, y, (bil(det, 64, x / 8, y / 8) * 12) | 0); }
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
					row++;
					if (now() > deadline) { break; }
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
				// surf along every shore, a few rows at a time
				for (; row < FN; ) {
					y = row;
					for (x = 0; x < FN; x++) {
						q = M0[(y << 10) | x];
						if (q !== F_SHL && q !== F_W0 && q !== F_W1 && q !== F_W2) { continue; }
						if (!isWater(at(x + 1, y)) || !isWater(at(x - 1, y)) || !isWater(at(x, y + 1)) || !isWater(at(x, y - 1))) { M0[(y << 10) | x] = F_FOAM; }
					}
					row++;
					if ((row & 3) === 0 && now() > deadline) { break; }
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
				// smaller copies for the distance, a few rows at a time
				if (!red) { red = halver(M0, FN, true); }
				if (!red.step(deadline)) { return; }
				if (!Wd.M1) { Wd.M1 = red.out; red = halver(Wd.M1, FN >> 1, true); return; }
				Wd.M2 = red.out; red = null;
				phase = 8; row = 0; CT = new Uint8Array(256 * 256); Wd.CT = CT;
				return;
			}
			if (phase === 8) {
				// the cloud deck, a row at a time
				for (; row < 256; ) {
					for (x = 0; x < 256; x++) {
						h = fbm(x / 32, row / 32, 8, seed + 300, 4) * 0.7 + 0.3 * vn(x / 64, row / 64, 4, seed + 301);
						CT[row * 256 + x] = h > 0.6 ? (h > 0.64 ? 1 : 2) : 0;
					}
					row++;
					if (now() > deadline) { break; }
				}
				if (row >= 256) { phase = 9; }
				return;
			}
			if (phase === 9) { places(); Wd.ready = true; phase = 10; }
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
			while (!Wd.ready && guard++ < 40) { steps(deadline); if (now() > deadline) { break; } }
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
		var NBK = 1024, BK = new Int32Array(NBK + 1), VB = new Int16Array(MAXV), ORD = new Int32Array(MAXV);
		var flockT = null, flyDt = 0;
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
			// (the cloud deck repeats every 1024 units, and the wind's sideways share every 2560: wrap where both do)
			if (wind > 5120) { wind -= 5120; }
		}
		// Where the flight starts: the towns and some other spots are tried, each followed six seconds along the flight path,
		// and the one whose view there shows most nearly two parts land to one part sea is taken.
		function pickStart() {
			var best = -9, bx = camX, by = camY, R2 = K.seeded("start" + S.look), nT = Wd.towns.length, ci, sx, sy, t, yw = yaw0, d, l, x2, y2, nl, tot, sc2;
			var m = S.motion, amp = 0.55 + 0.45 * Math.min(1, m), a1 = 0.52 * amp, a2 = 0.24 * amp;
			for (ci = 0; ci < nT + 16; ci++) {
				if (ci < nT) { sx = Wd.towns[ci][0] - Math.cos(yaw0) * 150 - 20; sy = Wd.towns[ci][1] - Math.sin(yaw0) * 150; }
				else { sx = R2() * FN; sy = R2() * FN; }
				x2 = sx; y2 = sy;
				for (t = 0; t < 6; t += 0.25) { yw = yaw0 + a1 * Math.sin(t * 0.06) + a2 * Math.sin(t * 0.15 + 1.3); x2 += Math.cos(yw) * 3.75; y2 += Math.sin(yw) * 3.75; }
				nl = 0; tot = 0;
				for (d = 30; d <= 300; d *= 1.45) {
					for (l = -0.8; l <= 0.81; l += 0.4) { tot++; if (Wd.land(x2 + Math.cos(yw) * d - Math.sin(yw) * d * l, y2 + Math.sin(yw) * d + Math.cos(yw) * d * l)) { nl++; } }
				}
				sc2 = -Math.abs(nl / tot - 0.65) + (ci < nT ? 0.05 : 0);
				if (sc2 > best) { best = sc2; bx = sx; by = sy; }
			}
			camX = bx - Math.floor(bx / FN) * FN; camY = by - Math.floor(by / FN) * FN;
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
			// with a title across the top, the sun keeps out from behind it
			if (S.layout === "top") { sunEl = Math.min(sunEl, HZ * 0.4); }
		}
		function step(sdt) {
			T += sdt; flyDt = sdt;
			if (!ready) {
				if (!Wd) { Wd = flyWorld(L, S.life, "fly-" + S.look); }
				// the first frames show the sky over open sea while the map is made a few milliseconds at a time; it is shown from
				// the frame after the last slice, so that slice and the first full picture never fall in the same frame
				else if (Wd.ready) { ready = true; }
				else { Wd.step(now() + (now() - born < 300 ? 5 : 8)); }
			} else if (reveal < 16) { reveal = Math.min(16, reveal + sdt / S.speed * 24); }
			if (!placed) {
				// the flight waits for the lie of the land, so it can start where the view is not open sea
				if (!Wd || !Wd.towns) { camera(0); return; }
				placed = true;
				pickStart();
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
			for (i = Wd.nFixed; i < Wd.nBall; i++) { SX[i] = (SX[i] + 2.4 * flyDt) % FN; SY[i] = (SY[i] + 0.72 * flyDt) % FN; }
			if (!flockT) { flockT = new Float32Array(Math.max(1, Wd.flocks) * 3); for (i = 0; i < Wd.flocks; i++) { flockT[i * 3 + 2] = -1; } }
			for (i = 0; i < Wd.flocks; i++) {
				dx = flockT[i * 3] - camX; dy = flockT[i * 3 + 1] - camY; dx -= Math.round(dx / FN) * FN; dy -= Math.round(dy / FN) * FN;
				if (flockT[i * 3 + 2] < 0 || dx * fx + dy * fy < -20) {
					k = 260 + 140 * Math.random(); j = (Math.random() - 0.5) * 2 * k * 0.5;
					flockT[i * 3] = camX + fx * k + rx * j; flockT[i * 3 + 1] = camY + fy * k + ry * j; flockT[i * 3 + 2] = camH - 4 - Math.random() * 8;
				}
				flockT[i * 3] -= fx * 7.2 * flyDt; flockT[i * 3 + 1] -= fy * 7.2 * flyDt;
			}
			for (i = Wd.nBall; i < n; i++) {
				k = SP[i] | 0; j = (k / 5) | 0; k = k % 5;
				SX[i] = flockT[j * 3] + (k === 0 ? 0 : ((k + 1) >> 1) * 2.2 * (k & 1 ? 1 : -1)) * rx - ((k + 1) >> 1) * 1.8 * fx;
				SY[i] = flockT[j * 3 + 1] + (k === 0 ? 0 : ((k + 1) >> 1) * 2.2 * (k & 1 ? 1 : -1)) * ry - ((k + 1) >> 1) * 1.8 * fy;
				SA[i] = flockT[j * 3 + 2];
			}
			nv = 0;
			// The map tiles: on a wide picture the view reaches further than half the map to the sides, so besides the nearest
			// copy of a thing, the next copy over either way may be in view too. Every copy that can be is tried.
			var lim = FOG1 * Math.sqrt(1 + tanH * tanH) + 20, ox, oy, ex, ey;
			for (i = 0; i < n && nv < MAXV; i++) {
				ex = SX[i] - camX; ey = SY[i] - camY;
				ex -= Math.round(ex / FN) * FN; ey -= Math.round(ey / FN) * FN;
				for (ox = -FN; ox <= FN; ox += FN) {
					dx = ex + ox; if (dx > lim || dx < -lim) { continue; }
					for (oy = -FN; oy <= FN; oy += FN) {
						dy = ey + oy; if (dy > lim || dy < -lim) { continue; }
						zc = dx * fx + dy * fy;
						if (zc < 3 || zc >= FOG1) { continue; }
						xc = dx * rx + dy * ry;
						if (Math.abs(xc) > zc * tanH + 12 || nv >= MAXV) { continue; }
						us = FOC * xc / zc; vs = FOC * (camH - SA[i]) / zc;
						VI[nv] = i; VZ[nv] = zc; VX[nv] = cxs + us * cr - vs * sr; VY[nv] = hzr + us * sr + vs * cr; VS[nv] = FOC * FK_H[SK[i]] * SS[i] / zc; nv++;
					}
				}
			}
			// far first: the list of indices is put in order by depth (counted into buckets, then tidied by insertion, which
			// has almost nothing left to do); the projected values stay where they are
			BK.fill(0);
			for (j = 0; j < nv; j++) { k = NBK - 1 - Math.min(NBK - 1, (VZ[j] * NBK / FOG1) | 0); VB[j] = k; BK[k + 1]++; }
			for (k = 0; k < NBK; k++) { BK[k + 1] += BK[k]; }
			for (j = 0; j < nv; j++) { ORD[BK[VB[j]]++] = j; }
			for (j = 1; j < nv; j++) { ti = ORD[j]; tz = VZ[ti]; k = j - 1; while (k >= 0 && VZ[ORD[k]] < tz) { ORD[k + 1] = ORD[k]; k--; } ORD[k + 1] = ti; }
			for (ti = 0; ti < nv; ti++) {
				j = ORD[ti]; i = VI[j]; k = SK[i]; zc = VZ[j];
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

	// ================================================================ 2. dungeon: a walk through a torch-lit maze
	// One ray per screen column against a grid map, textured walls, a cast floor and ceiling, light from the torches baked
	// into a light map (the torches flicker), and pillars, chests and bats as sprites hidden behind the walls column by
	// column. The route is a closed loop through the maze, so the walk goes on for ever without a jump.
	var D_S0 = 0, D_S1 = 1, D_S2 = 2, D_S3 = 3, D_M0 = 4, D_M1 = 5, D_W0 = 6, D_W1 = 7, D_W2 = 8, D_I0 = 9, D_I1 = 10, D_FL0 = 11, D_FL1 = 12, D_FL2 = 13,
		D_B0 = 14, D_B1 = 15, D_B2 = 16, D_G0 = 17, D_G1 = 18, D_FS0 = 19, D_FS1 = 20, D_FS2 = 21, D_C0 = 22, D_C1 = 23, D_P0 = 24, D_P1 = 25, D_SPK = 26, D_BAT = 27, D_N = 28;
	var DNL = 8, DTOP = (DNL - 1) * 16;
	// c = [stone, light, banners]
	var DUN = {
		torch: { c: ["7a7a8e", "ffad48", "b2283c"], dark: "06060e", warm: 0.45, cool: [0.8, 0.84, 1], lamp: 0.76, m: { moss: ["58703e", "3e5430"], wood: ["925e34", "6e4628", "4a2e1c"], iron: ["5a5c68", "36373f"], floor: ["8e877a", "6e695f", "4e4a43"], ceil: ["403a36", "2c2724"], gold: ["ffd64a", "c4902a"], pillar: ["b0aebc", "8a8898"], bat: "1a1420" } },
		crypt: { c: ["5f7062", "7dffc6", "7a3ab0"], dark: "02050a", warm: 0.6, cool: [0.72, 0.82, 1], lamp: 0.66, mossy: true, m: { moss: ["5a8a46", "3c6634"], wood: ["5e5040", "463c30", "30281e"], iron: ["4a5654", "2e3634"], floor: ["66705e", "50584a", "383e34"], ceil: ["2c342e", "1e2420"], gold: ["e8e070", "9a9a3a"], pillar: ["8e9c8a", "6c7a6a"], bat: "100c18" } },
		ice: { c: ["8ab4dc", "bff4ff", "2a4cbc"], dark: "060c1c", warm: 0.5, cool: [0.72, 0.84, 1.05], lamp: 0.72, icy: true, m: { moss: ["d8f0ff", "a8d4f0"], wood: ["7a6a5c", "5c4e44", "3e342e"], iron: ["6a7a90", "46546a"], floor: ["a6c6e2", "86a8c8", "6688aa"], ceil: ["4a6684", "34485e"], gold: ["fff0a0", "d0b050"], pillar: ["d8ecff", "a8c8e8"], bat: "1a2234" } },
		lava: { c: ["6e3a32", "ff6a28", "2c1a2a"], dark: "0a0206", warm: 0.55, cool: [0.75, 0.55, 0.8], lamp: 0.5, m: { moss: ["ff8a2a", "c84a18"], wood: ["5a3426", "40241a", "2a1610"], iron: ["4a3a3a", "2e2222"], floor: ["4e3632", "3a2826", "2a1c1a"], ceil: ["2e1a18", "1e1010"], gold: ["ffd040", "c08a20"], pillar: ["8a5a50", "6a4038"], bat: "140808" } }
	};
	function dunPal(L, c1, c2, c3) {
		var m = L.m, Wt = [255, 255, 255], p = [];
		p[D_S0] = mx(c1, Wt, 0.22); p[D_S1] = c1; p[D_S2] = ml(c1, 0.72); p[D_S3] = ml(c1, 0.46);
		p[D_M0] = hx(m.moss[0]); p[D_M1] = hx(m.moss[1]);
		p[D_W0] = hx(m.wood[0]); p[D_W1] = hx(m.wood[1]); p[D_W2] = hx(m.wood[2]); p[D_I0] = hx(m.iron[0]); p[D_I1] = hx(m.iron[1]);
		p[D_FL0] = mx(c2, Wt, 0.78); p[D_FL1] = mx(c2, Wt, 0.2); p[D_FL2] = mx(c2, [190, 40, 24], 0.35);
		p[D_B0] = c3; p[D_B1] = mx(c3, Wt, 0.28); p[D_B2] = ml(c3, 0.58);
		p[D_G0] = hx(m.gold[0]); p[D_G1] = hx(m.gold[1]);
		p[D_FS0] = hx(m.floor[0]); p[D_FS1] = hx(m.floor[1]); p[D_FS2] = hx(m.floor[2]); p[D_C0] = hx(m.ceil[0]); p[D_C1] = hx(m.ceil[1]);
		p[D_P0] = hx(m.pillar[0]); p[D_P1] = hx(m.pillar[1]); p[D_SPK] = mx(hx(m.gold[0]), Wt, 0.7); p[D_BAT] = hx(m.bat);
		return p;
	}
	var D_GLOW = [D_FL0, D_FL1, D_FL2, D_SPK];
	// wall textures: 0 stone, 1 worn stone, 2 torch, 3 banner, 4 door; floors 5 flagstones, 6 hall tiles; ceilings 7 beams, 8 vault
	var DT_STONE = 0, DT_WORN = 1, DT_TORCH = 2, DT_BANNER = 3, DT_DOOR = 4, DT_FLOOR = 5, DT_HALL = 6, DT_BEAM = 7, DT_VAULT = 8;
	function dunTextures(L, seed) {
		var R = K.seeded("dtex" + seed), T = [], x, y, t, v, b, n, row, off, a, k, dx, dy, bx2;
		function tex() { return new Uint8Array(4096); }
		function put(a2, x2, y2, c) { if (x2 >= 0 && y2 >= 0 && x2 < 64 && y2 < 64) { a2[(y2 << 6) | x2] = c; } }
		// rows of pixel art drawn into a texture, each character a palette slot (or "." for none), scaled by sz
		function art(a2, rows, map, x0, y0, sz) {
			var i, j, ch, q, r;
			for (j = 0; j < rows.length; j++) {
				for (i = 0; i < rows[j].length; i++) {
					ch = rows[j].charAt(i);
					if (map[ch] == null) { continue; }
					for (q = 0; q < sz; q++) { for (r = 0; r < sz; r++) { put(a2, x0 + i * sz + r, y0 + j * sz + q, map[ch]); } }
				}
			}
		}
		function bricks(a2, worn) {
			// courses 8 high, bricks 16 long, every other course shifted half a brick; each brick its own shade
			var shade = new Float32Array(64), lava = L.m.moss[0] === "ff8a2a";
			for (k = 0; k < 64; k++) { shade[k] = R(); }
			for (y = 0; y < 64; y++) {
				row = y >> 3; off = row & 1 ? 8 : 0;
				for (x = 0; x < 64; x++) {
					bx2 = ((x + off) >> 4) & 3; b = (row * 4 + bx2) & 63;
					t = (x + off) & 15; v = y & 7; n = ih(x, y, seed + 11);
					if (v === 7 || t === 15) { a2[(y << 6) | x] = D_S3; continue; }
					if (v === 0 || t === 0) { a2[(y << 6) | x] = shade[b] > 0.8 ? D_S1 : D_S0; continue; }
					if (v === 6 || t === 14) { a2[(y << 6) | x] = D_S2; continue; }
					a2[(y << 6) | x] = shade[b] > 0.8 ? (n < 0.5 ? D_S2 : D_S1) : n < 0.07 ? D_S2 : n > 0.96 ? D_S0 : D_S1;
				}
			}
			if (!worn) { return; }
			if (L.mossy) {
				// moss creeping up from the floor and down the mortar
				for (y = 30; y < 64; y++) { for (x = 0; x < 64; x++) { n = ih(x >> 1, y >> 1, seed + 12); if (n < (y - 30) / 40 + (a2[(y << 6) | x] === D_S3 ? 0.25 : 0)) { a2[(y << 6) | x] = ih(x, y, seed + 14) < 0.5 ? D_M0 : D_M1; } } }
			} else if (L.icy) {
				// frost along the top and icicles hanging from it
				for (x = 0; x < 64; x++) { k = 3 + Math.floor(ih(x >> 1, 5, seed + 13) * (x % 5 === 2 ? 14 : 5)); for (y = 0; y < k; y++) { a2[(y << 6) | x] = y < k - 1 ? D_M0 : D_M1; } }
			} else {
				// cracks across a few bricks (glowing seams in the fire halls)
				for (k = 0; k < 2; k++) {
					x = 8 + Math.floor(R() * 48); y = Math.floor(R() * 20);
					for (n = 0; n < 30 && y < 63; n++) { put(a2, x, y, lava ? D_FL1 : D_S3); if (lava) { put(a2, x + 1, y, D_FL2); } y++; if (R() < 0.45) { x += R() < 0.5 ? -1 : 1; } }
				}
			}
		}
		T[DT_STONE] = tex(); bricks(T[DT_STONE], false);
		T[DT_WORN] = tex(); bricks(T[DT_WORN], true);
		// a torch in an iron bracket; the flame's colours turn round in the palette, so it flickers
		T[DT_TORCH] = tex(); bricks(T[DT_TORCH], false); a = T[DT_TORCH];
		art(a, ["iiiiiiii", "iIIIIIIi", ".iIIIIi.", "..iIIi..", "...ii..."], { i: D_I0, I: D_I1 }, 28, 30, 1);
		for (y = 18; y < 33; y++) { put(a, 31, y, D_W1); put(a, 32, y, D_W2); }
		art(a, ["....2.....", "...22.....", "...212....", "..2112.2..", "..21102...", ".211002...", ".2100012..", "21000012..", "2100001...", ".211112...", "..2222...."], { "0": D_FL0, "1": D_FL1, "2": D_FL2 }, 27, 7, 1);
		// a banner on a pole, with a made-up sign in gold
		T[DT_BANNER] = tex(); bricks(T[DT_BANNER], false); a = T[DT_BANNER];
		for (x = 14; x < 50; x++) { put(a, x, 4, D_W0); put(a, x, 5, D_W1); put(a, x, 6, D_W2); }
		art(a, ["gg", "gg"], { g: D_G0 }, 12, 4, 1); art(a, ["gg", "gg"], { g: D_G0 }, 50, 4, 1);
		for (y = 7; y < 58; y++) {
			for (x = 18; x < 46; x++) {
				if (y > 48 && Math.abs(x - 31.5) < (y - 48) * 1.6) { continue; }
				put(a, x, y, x < 20 || x > 43 ? D_B1 : x > 41 || y < 9 ? D_B2 : D_B0);
			}
		}
		art(a, ["...11...", "..1..1..", ".1.11.1.", "1.1..1.1", "1.1..1.1", ".1.11.1.", "..1..1..", "...11..."], { "1": D_G0 }, 24, 17, 2);
		for (x = 22; x < 42; x++) { put(a, x, 38, D_G1); put(a, x, 40, D_G0); }
		// a heavy door under a stone arch
		T[DT_DOOR] = tex(); bricks(T[DT_DOOR], false); a = T[DT_DOOR];
		for (y = 4; y < 64; y++) {
			for (x = 8; x < 56; x++) {
				dx = x - 31.5; dy = y - 24;
				if (dy < 0 && dx * dx + dy * dy * 1.3 > 560) { continue; }
				if ((dy < 0 && dx * dx + dy * dy * 1.3 > 400) || x < 11 || x > 52) { put(a, x, y, (x + y) % 7 === 0 ? D_S3 : D_S0); continue; }
				t = (x - 11) % 7;
				put(a, x, y, t === 6 ? D_W2 : t === 0 ? D_W0 : D_W1);
				if ((y >= 21 && y <= 23) || (y >= 50 && y <= 52)) { put(a, x, y, y === 21 || y === 50 ? D_I0 : D_I1); }
			}
		}
		art(a, [".gg.", "g..g", "g..g", ".gg."], { g: D_G0 }, 40, 35, 1);
		// floors: big flagstones, and the halls' chequered tiles
		T[DT_FLOOR] = tex(); a = T[DT_FLOOR];
		for (y = 0; y < 64; y++) {
			for (x = 0; x < 64; x++) {
				b = (x >> 5) + (y >> 5) * 2; t = x & 31; v = y & 31; n = ih(x, y, seed + 21);
				a[(y << 6) | x] = t === 0 || v === 0 ? D_FS2 : (t === 1 || v === 1) ? D_FS0 : (t === 31 || v === 31) ? D_FS2 : (b === 1 || b === 2) ? (n < 0.1 ? D_FS2 : D_FS1) : (n < 0.08 ? D_FS1 : D_FS0);
			}
		}
		T[DT_HALL] = tex(); a = T[DT_HALL];
		for (y = 0; y < 64; y++) { for (x = 0; x < 64; x++) { b = ((x >> 4) + (y >> 4)) & 1; t = x & 15; v = y & 15; a[(y << 6) | x] = t === 0 || v === 0 ? D_FS2 : b ? (L.icy ? D_FS1 : D_B2) : (t === 1 || v === 1 ? D_FS0 : ih(x, y, seed + 22) < 0.1 ? D_FS1 : D_FS0); } }
		// ceilings: a wooden beam across every cell, and a dark stone vault in the halls
		T[DT_BEAM] = tex(); a = T[DT_BEAM];
		for (y = 0; y < 64; y++) { for (x = 0; x < 64; x++) { n = ih(x, y, seed + 31); a[(y << 6) | x] = y >= 24 && y < 38 ? (y === 24 ? D_W0 : y >= 36 ? D_W2 : (x + (y & 3) * 7) % 13 === 0 ? D_W2 : D_W1) : ((x & 15) === 0 || (y & 15) === 8 ? D_C1 : n < 0.12 ? D_C1 : D_C0); } }
		T[DT_VAULT] = tex(); a = T[DT_VAULT];
		for (y = 0; y < 64; y++) { for (x = 0; x < 64; x++) { a[(y << 6) | x] = (x & 15) === 0 || (y & 15) === 0 ? D_C1 : ih(x, y, seed + 41) < 0.08 ? D_C1 : D_C0; } }
		return T;
	}
	var DUN_SPR = {
		pillar: [[
			"..aaaaaaaaaa..", ".aaaaaaaaaaaab", "bbbbbbbbbbbbbb", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..",
			"..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..",
			"..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", "..abaabaabab..", ".aaaaaaaaaaab.", "aaaaaaaaaaaabb", "bbbbbbbbbbbbbc"
		], { a: D_P0, b: D_P1, c: D_S3 }],
		chest: [[
			"..wwwwwwwwwwww..", ".wwwwwwwwwwwwwww", "wvvvvvvvvvvvvvvw", "iiiiiiiggiiiiiii", "wvvvvvvgGvvvvvvw", "wvvvvvvvvvvvvvvw", "wuvvvvvvvvvvvvuw", "iiiiiiiiiiiiiiii", "wvvvvvvvvvvvvvvw", "wvvvvvvvvvvvvvvw", "uuuuuuuuuuuuuuuu"
		], { w: D_W0, v: D_W1, u: D_W2, i: D_I0, g: D_G0, G: D_G1 }],
		gold: [[
			"......s.........", "..wwwwwwwwwwww..", ".wggGggggGgggGgw", "wvggggGggggggggw", "iiiiiiiiiiiiiiii", "wvvvvvvvvvvvvvvw", "wvvvvvvvvvvvvvvw", "wuvvvvvvvvvvvvuw", "iiiiiiiiiiiiiiii", "wvvvvvvvvvvvvvvw", "uuuuuuuuuuuuuuuu"
		], { w: D_W0, v: D_W1, u: D_W2, i: D_I0, g: D_G0, G: D_G1, s: D_SPK }],
		bat0: [["b.......b", "bb.....bb", ".bbb.bbb.", "..bbbbb..", "...b.b..."], { b: D_BAT }],
		bat1: [[".........", "...bbb...", ".bbbbbbb.", "bb.bbb.bb", "b..b.b..b"], { b: D_BAT }]
	};
	function dunWorld(seed, life) {
		var R = K.seeded("dun" + seed), NX = 13, NY = 11, SP = 3, MW = NX * SP + 1, MH = NY * SP + 1;
		var on = new Uint8Array(NX * NY), loop = [], i, j, k, a, b, c, e, tries, dx, dy, px, py, run, ok, m, n, x, y;
		var map = new Uint8Array(MW * MH), kind = new Uint8Array(MW * MH), wt = new Uint8Array(MW * MH);
		function onAt(p) { return on[p[1] * NX + p[0]]; }
		function inside(p) { return p[0] >= 0 && p[1] >= 0 && p[0] < NX && p[1] < NY; }
		// the loop: a square, pushed outward a run of edges at a time, so it winds without ever crossing itself
		x = (NX >> 1) - 1; y = (NY >> 1) - 1;
		loop = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
		for (i = 0; i < 4; i++) { on[loop[i][1] * NX + loop[i][0]] = 1; }
		for (tries = 0; tries < 9000 && loop.length < NX * NY * 0.6; tries++) {
			n = loop.length; i = Math.floor(R() * n); a = loop[i]; b = loop[(i + 1) % n];
			dx = b[0] - a[0]; dy = b[1] - a[1];
			// how far the edge runs on in a straight line
			run = 1; m = 1 + Math.floor(R() * 4);
			while (run < m && loop[(i + run + 1) % n][0] - loop[(i + run) % n][0] === dx && loop[(i + run + 1) % n][1] - loop[(i + run) % n][1] === dy) { run++; }
			k = R() < 0.5 ? 1 : -1; px = -dy * k; py = dx * k;
			ok = true;
			for (j = 0; j <= run; j++) { c = loop[(i + j) % n]; e = [c[0] + px, c[1] + py]; if (!inside(e) || onAt(e)) { ok = false; break; } }
			if (!ok) { continue; }
			var add = [];
			for (j = 0; j <= run; j++) { c = loop[(i + j) % n]; add.push([c[0] + px, c[1] + py]); }
			// the inner nodes of the run leave the loop
			for (j = 1; j < run; j++) { c = loop[(i + j) % n]; on[c[1] * NX + c[0]] = 0; }
			for (j = 0; j < add.length; j++) { on[add[j][1] * NX + add[j][0]] = 1; }
			if (i + run < n) { loop.splice.apply(loop, [i + 1, run - 1].concat(add)); }
			else {
				// the run wraps past the end of the list: rebuild it starting at i
				var rot = loop.slice(i).concat(loop.slice(0, i));
				loop = [rot[0]].concat(add).concat(rot.slice(run));
			}
		}
		// carve the corridors between consecutive nodes
		function cell(p) { return [p[0] * SP + 1, p[1] * SP + 1]; }
		n = loop.length;
		for (i = 0; i < n; i++) {
			a = cell(loop[i]); b = cell(loop[(i + 1) % n]); dx = Math.sign(b[0] - a[0]); dy = Math.sign(b[1] - a[1]);
			for (k = 0; k <= SP; k++) { map[(a[1] + dy * k) * MW + a[0] + dx * k] = 1; kind[(a[1] + dy * k) * MW + a[0] + dx * k] = 1; }
		}
		function open(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH && map[y * MW + x] === 1; }
		var props = [];
		// halls with four pillars where the route runs straight through and nothing else is near
		var halls = 0;
		for (i = 0; i < n; i++) {
			a = loop[(i + n - 1) % n]; b = loop[i]; c = loop[(i + 1) % n];
			if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1] || R() > 0.3) { continue; }
			e = cell(b); ok = true;
			// nothing within two cells but the route itself (it runs along one axis)
			dx = c[0] - b[0]; dy = c[1] - b[1];
			for (y = -2; y <= 2 && ok; y++) { for (x = -2; x <= 2; x++) { if (open(e[0] + x, e[1] + y) && (dx ? y !== 0 : x !== 0)) { ok = false; break; } } }
			if (!ok) { continue; }
			for (y = -1; y <= 1; y++) { for (x = -1; x <= 1; x++) { map[(e[1] + y) * MW + e[0] + x] = 1; kind[(e[1] + y) * MW + e[0] + x] = 2; } }
			props.push([e[0] - 0.5, e[1] - 0.5, 0], [e[0] + 1.5, e[1] - 0.5, 0], [e[0] - 0.5, e[1] + 1.5, 0], [e[0] + 1.5, e[1] + 1.5, 0]);
			halls++;
		}
		// alcoves off the corridors, each with a chest at the back
		var want = Math.round(10 * Math.max(0.4, life)), got = 0;
		for (tries = 0; tries < 800 && got < want; tries++) {
			i = Math.floor(R() * n); a = cell(loop[i]); b = cell(loop[(i + 1) % n]);
			dx = Math.sign(b[0] - a[0]); dy = Math.sign(b[1] - a[1]); k = 1 + Math.floor(R() * (SP - 1));
			x = a[0] + dx * k; y = a[1] + dy * k; j = R() < 0.5 ? 1 : -1; px = -dy * j; py = dx * j;
			c = [x + px, y + py];
			if (kind[c[1] * MW + c[0]] || c[0] < 1 || c[1] < 1 || c[0] >= MW - 1 || c[1] >= MH - 1) { continue; }
			// the alcove may only touch the corridor cell it opens from and that cell's two neighbours along the corridor
			ok = true;
			for (m = 0; m < 9 && ok; m++) {
				e = [c[0] + (m % 3) - 1, c[1] + ((m / 3) | 0) - 1];
				if (m === 4 || !open(e[0], e[1])) { continue; }
				if ((e[0] === x && e[1] === y) || (e[0] === x + dx && e[1] === y + dy) || (e[0] === x - dx && e[1] === y - dy)) { continue; }
				ok = false;
			}
			if (!ok) { continue; }
			map[c[1] * MW + c[0]] = 1; kind[c[1] * MW + c[0]] = 3;
			props.push([c[0] + 0.5 + px * 0.12, c[1] + 0.5 + py * 0.12, R() < 0.45 ? 2 : 1]);
			got++;
		}
		// what each wall cell shows: plain or worn stone, a torch every few cells along the route, banners, doors
		var torches = [];
		var along = 0;
		for (i = 0; i < n; i++) {
			a = cell(loop[i]); b = cell(loop[(i + 1) % n]); dx = Math.sign(b[0] - a[0]); dy = Math.sign(b[1] - a[1]);
			for (k = 0; k < SP; k++) {
				x = a[0] + dx * k; y = a[1] + dy * k; along++;
				for (j = -1; j <= 1; j += 2) {
					px = x - dy * j; py = y + dx * j;
					if (open(px, py) || px < 0 || py < 0 || px >= MW || py >= MH) { continue; }
					var w = wt[py * MW + px];
					if (w) { continue; }
					if (along % 4 === 0 && j === (((along / 4) & 1) ? 1 : -1)) { wt[py * MW + px] = DT_TORCH + 1; torches.push([x + 0.5 - dy * j * 0.36, y + 0.5 + dx * j * 0.36]); }
					else if (R() < 0.08) { wt[py * MW + px] = DT_BANNER + 1; }
					else if (R() < 0.07 && !open(px - dy * j, py + dx * j)) { wt[py * MW + px] = DT_DOOR + 1; }
					else { wt[py * MW + px] = R() < 0.3 ? DT_WORN + 1 : DT_STONE + 1; }
				}
			}
		}
		for (i = 0; i < MW * MH; i++) { if (!map[i] && !wt[i]) { wt[i] = ih(i, 3, seed) < 0.3 ? DT_WORN + 1 : DT_STONE + 1; } }
		// the route: node to node, every corner rounded with a half-cell arc, as points every so often with their distance
		var ptsX = [], ptsY = [];
		function emit(x0, y0) { ptsX.push(x0); ptsY.push(y0); }
		var P = loop.map(function (q) { return [q[0] * SP + 1.5, q[1] * SP + 1.5]; }), startIdx = [], best = 0, bestRun = 0;
		// the walk starts at the foot of the longest straight, so its first view is a long corridor rather than a corner
		for (i = 0; i < n; i++) {
			for (k = 0; k < n; k++) {
				a = loop[(i + k) % n]; b = loop[(i + k + 1) % n]; c = loop[(i + k + 2) % n];
				if (c[0] - b[0] !== b[0] - a[0] || c[1] - b[1] !== b[1] - a[1]) { break; }
			}
			if (k > bestRun) { bestRun = k; best = (i + 1) % n; }
		}
		for (i = 0; i < n; i++) {
			a = P[(i + n - 1) % n]; b = P[i]; c = P[(i + 1) % n]; e = P[(i + 2) % n];
			var di = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])], dout = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])], dn = [Math.sign(e[0] - c[0]), Math.sign(e[1] - c[1])];
			var turn = di[0] !== dout[0] || di[1] !== dout[1], turnN = dout[0] !== dn[0] || dout[1] !== dn[1];
			if (turn) {
				var cx = b[0] - di[0] * 0.5 + dout[0] * 0.5, cy = b[1] - di[1] * 0.5 + dout[1] * 0.5, a0 = Math.atan2(b[1] - di[1] * 0.5 - cy, b[0] - di[0] * 0.5 - cx), a1 = Math.atan2(b[1] + dout[1] * 0.5 - cy, b[0] + dout[0] * 0.5 - cx), da = a1 - a0;
				if (da > Math.PI) { da -= TAU; } else if (da < -Math.PI) { da += TAU; }
				for (k = 0; k < 8; k++) { emit(cx + Math.cos(a0 + da * k / 8) * 0.5, cy + Math.sin(a0 + da * k / 8) * 0.5); }
			}
			startIdx[i] = ptsX.length;
			var sx = turn ? b[0] + dout[0] * 0.5 : b[0], sy = turn ? b[1] + dout[1] * 0.5 : b[1], ex = turnN ? c[0] - dout[0] * 0.5 : c[0], ey = turnN ? c[1] - dout[1] * 0.5 : c[1];
			m = Math.max(1, Math.round((Math.abs(ex - sx) + Math.abs(ey - sy)) / 0.1));
			for (k = 0; k < m; k++) { emit(sx + (ex - sx) * k / m, sy + (ey - sy) * k / m); }
		}
		var NP = ptsX.length, PX = new Float32Array(NP), PY = new Float32Array(NP), PS = new Float32Array(NP + 1), tot = 0;
		for (i = 0; i < NP; i++) { PX[i] = ptsX[i]; PY[i] = ptsY[i]; }
		for (i = 0; i < NP; i++) { PS[i] = tot; j = (i + 1) % NP; tot += Math.sqrt((PX[j] - PX[i]) * (PX[j] - PX[i]) + (PY[j] - PY[i]) * (PY[j] - PY[i])); }
		PS[NP] = tot;
		return { MW: MW, MH: MH, map: map, kind: kind, wt: wt, props: props, torches: torches, PX: PX, PY: PY, PS: PS, NP: NP, len: tot, halls: halls, s0: PS[startIdx[best] || 0] };
	}
	function startDun(host, o) {
		var S = settings(o, DUN, "torch"), L = DUN[S.look];
		var c1 = rgb3(o.c1, L.c[0]), c2 = rgb3(o.c2, L.c[1]), c3 = rgb3(o.c3, L.c[2]), dark = hx(L.dark);
		// The shade table: [warmth 0..3][light 0..7][palette slot]. Light that only comes from the walker's own lamp is cool;
		// the more of it comes from torches, the warmer (towards colour 2) the stone turns.
		var RGB = dunPal(L, c1, c2, c3), SH = new Uint32Array(4 * DNL * 32), i, j, l, t, wi, tn;
		var tint = mx([255, 255, 255], c2, L.warm), tmax = Math.max(tint[0], tint[1], tint[2]) / 255, wT = [tint[0] / 255 / tmax, tint[1] / 255 / tmax, tint[2] / 255 / tmax];
		for (wi = 0; wi < 4; wi++) {
			tn = mx(L.cool, wT, wi / 3);
			for (l = 0; l < DNL; l++) {
				t = Math.pow(l / (DNL - 1), 1.2);
				for (i = 0; i < D_N; i++) { SH[(wi << 8) | (l << 5) | i] = pk(D_GLOW.indexOf(i) >= 0 ? RGB[i] : mx(dark, [RGB[i][0] * tn[0], RGB[i][1] * tn[1], RGB[i][2] * tn[2]], t)); }
			}
		}
		var IM = {}, k;
		for (k in DUN_SPR) { IM[k] = spr(DUN_SPR[k][0], DUN_SPR[k][1]); }
		var Wd = null, TX = null, LM = null, LW = 0, LH = 0, job = 0, born = now(), fade = 0;
		var V = null, FOC = 240, HZ = 90, w = 0, h = 0, ZB = null, WY0 = null, WY1 = null, ROWD = null, ROWL = null, LMF = new Uint8Array(256);
		var T = 0, s = 0, cur = 0, posX = 0, posY = 0, dirX = 1, dirY = 0, camZ = 0.5, bob = 0, flick = 1, stepPh = 0, walked = false;
		var bats = new Float32Array(12 * 4), nbat = Math.min(12, Math.round(3 * S.life)), BX = new Float32Array(12), BY = new Float32Array(12), SPV = new Int32Array(64), SPZ = new Float32Array(64);
		function at(sv) {
			// the route's point at distance sv (wrapped), found from the last place looked (the walk only goes forward)
			var len = Wd.len, NP = Wd.NP, PS = Wd.PS, q, f, i2;
			sv -= Math.floor(sv / len) * len;
			if (PS[cur] > sv || PS[cur + 1] <= sv) {
				if (cur + 2 <= NP && PS[cur + 1] <= sv && PS[cur + 2] > sv) { cur++; }
				else { var lo = 0, hi = NP - 1, mid; while (lo < hi) { mid = (lo + hi + 1) >> 1; if (PS[mid] <= sv) { lo = mid; } else { hi = mid - 1; } } cur = lo; }
			}
			q = cur; i2 = (q + 1) % NP; f = (sv - PS[q]) / Math.max(1e-6, PS[q + 1] - PS[q]);
			atX = Wd.PX[q] + (Wd.PX[i2] - Wd.PX[q]) * f; atY = Wd.PY[q] + (Wd.PY[i2] - Wd.PY[q]) * f;
		}
		var atX = 0, atY = 0;
		function look(sv) {
			// The eyes lead the feet: they turn towards the route a little way ahead, so a corner is looked round before it
			// is reached (rather than stared into), and the turn eases in and out.
			var x0, y0, ax, ay, dx, dy, d, bx2, by2;
			at(sv); x0 = atX; y0 = atY;
			at(sv + 0.8); ax = atX - x0; ay = atY - y0;
			at(sv + 1.7); ax += (atX - x0) * 0.7; ay += (atY - y0) * 0.7;
			at(sv - 0.6); bx2 = x0 - atX; by2 = y0 - atY;
			dx = ax + bx2 * 0.9; dy = ay + by2 * 0.9; d = Math.sqrt(dx * dx + dy * dy) || 1;
			dirX = dx / d; dirY = dy / d;
			// how sharply the route bends here (0 straight .. 1 a right angle): the walk slows a little round corners
			d = Math.sqrt(ax * ax + ay * ay) * Math.sqrt(bx2 * bx2 + by2 * by2) || 1;
			bend = 1 - (ax * bx2 + ay * by2) / d;
		}
		var bend = 0;
		function build() {
			// the maze, its textures and its light, spread over the first frames
			var seed = { torch: 7, crypt: 23, ice: 41, lava: 59 }[S.look] || 7;
			if (job === 0) { Wd = dunWorld(seed, S.life); s = Wd.s0; job = 1; return false; }
			if (job === 1) { TX = dunTextures(L, seed); job = 2; return false; }
			if (job === 2) {
				// light: every quarter cell, from each torch it can see, falling off over a few cells
				LW = Wd.MW * 4; LH = Wd.MH * 4; LM = new Uint8Array(LW * LH); job = 3; lrow = 0; return false;
			}
			if (job === 3) {
				var y, x, q, tx, ty, d, v, n2, st, cx, cy, ok2, lim = now() + 6;
				for (; lrow < LH && now() < lim; lrow++) {
					y = lrow;
					for (x = 0; x < LW; x++) {
						cx = (x + 0.5) / 4; cy = (y + 0.5) / 4;
						if (!Wd.map[(cy | 0) * Wd.MW + (cx | 0)]) { continue; }
						v = 0;
						for (q = 0; q < Wd.torches.length; q++) {
							tx = Wd.torches[q][0]; ty = Wd.torches[q][1]; d = Math.sqrt((tx - cx) * (tx - cx) + (ty - cy) * (ty - cy));
							if (d > 4.8) { continue; }
							// can the torch see this spot? walk the line between them in small steps
							ok2 = true; n2 = Math.ceil(d * 4);
							for (st = 1; st < n2; st++) { if (!Wd.map[((cy + (ty - cy) * st / n2) | 0) * Wd.MW + ((cx + (tx - cx) * st / n2) | 0)]) { ok2 = false; break; } }
							if (ok2) { v += Math.pow(1 - d / 4.8, 1.4); }
						}
						LM[y * LW + x] = Math.round(Math.min(1, v * 1.25) * DTOP);
					}
				}
				if (lrow >= LH) { job = 4; return true; }
				return false;
			}
			return true;
		}
		var lrow = 0;
		function resize(F) {
			V = view(F); w = F.w; h = F.h;
			// the field of view follows the width, but a tall picture gets a closer view so the walls still fill it
			FOC = Math.max(w * 0.72, V.vh * 0.7);
			HZ = V.vh * 0.5;
			ZB = new Float32Array(w); WY0 = new Int16Array(w); WY1 = new Int16Array(w); ROWD = new Float32Array(h); ROWL = new Int16Array(h);
		}
		function step(sdt, dt) {
			T += sdt;
			// the maze is walked from the frame after it is finished, so its last slice of light and the first full picture
			// never fall in the same frame
			if (job < 4) { build(); return; }
			walked = true;
			if (fade < 1) { fade = Math.min(1, fade + dt * 1.5); }
			// (s keeps counting up; the route wraps inside at())
			var ds = sdt * 0.95 * (1 - 0.3 * Math.min(1, bend));
			s += ds;
			// the route distance wraps after a lap (the route closes on itself), and the bats' places with it
			if (s > Wd.len) { s -= Wd.len; for (i = 0; i < nbat; i++) { bats[i * 4] -= Wd.len; } }
			look(s); at(s); posX = atX; posY = atY;
			// footsteps: a small bob, nothing at all when steady
			stepPh += ds * Math.PI * 1.7; if (stepPh > TAU) { stepPh -= TAU; }
			bob = Math.sin(stepPh) * 0.012 * S.motion;
			camZ = 0.5 + bob;
			flick = 0.84 + 0.09 * Math.sin(T * 11.3) + 0.07 * Math.sin(T * 23.7 + 1.1);
			for (i = 0; i < 256; i++) { LMF[i] = Math.min(255, (i * flick) | 0); }
			// the flame colours turn round
			var fc = Math.floor(T * 9) % 3, a0 = RGB[D_FL0], a1 = RGB[D_FL1], a2 = RGB[D_FL2];
			if (fc !== lastFc) {
				lastFc = fc;
				for (l = 0; l < 4 * DNL; l++) { SH[(l << 5) | D_FL0] = pk(fc === 2 ? a1 : a0); SH[(l << 5) | D_FL1] = pk(fc === 1 ? a2 : a1); SH[(l << 5) | D_FL2] = pk(fc === 0 ? a1 : a2); }
			}
			// bats: now and then one flies down the corridor towards the camera and over its head
			for (i = 0; i < nbat; i++) {
				var b = i * 4;
				if (bats[b + 3] <= 0) { bats[b + 3] = 3 + Math.random() * 14; bats[b] = s + 9 + Math.random() * 4; bats[b + 1] = (Math.random() - 0.5) * 0.5; bats[b + 2] = Math.random() * 6; }
				bats[b] -= sdt * 2.6; bats[b + 2] += sdt;
				if (bats[b] < s - 1) { bats[b + 3] -= sdt; if (bats[b + 3] < 3) { bats[b + 3] = 0; } }
				at(bats[b]); BX[i] = atX - dirY * bats[b + 1]; BY[i] = atY + dirX * bats[b + 1];
			}
		}
		var lastFc = -1;
		function draw(F) {
			var px = F.px, lm, wb, x, y, o, b, mapX, mapY, sdx, sdy, ddx, ddy, stx, sty, side, cellv, perp, rdx, rdy, top, bot, y0, y1, tx, tex, wx, tv, dv, lv, idx, lev, d, MW, map, wt, lmx, lmy, sx, sy;
			var hz = HZ - V.off, plane = (w / 2) / FOC, plx = -dirY * plane, ply = dirX * plane;
			if (!Wd || job < 4 || !walked) { px.fill(pk(dark)); return; }
			MW = Wd.MW; map = Wd.map; wt = Wd.wt;
			var LR = 5, LK = DTOP * L.lamp;
			// walls: one ray per column
			for (x = 0; x < w; x++) {
				var cam = 2 * (x + 0.5) / w - 1;
				rdx = dirX + plx * cam; rdy = dirY + ply * cam;
				mapX = posX | 0; mapY = posY | 0;
				ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx); ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
				if (rdx < 0) { stx = -1; sdx = (posX - mapX) * ddx; } else { stx = 1; sdx = (mapX + 1 - posX) * ddx; }
				if (rdy < 0) { sty = -1; sdy = (posY - mapY) * ddy; } else { sty = 1; sdy = (mapY + 1 - posY) * ddy; }
				side = 0;
				for (j = 0; j < 160; j++) {
					if (sdx < sdy) { sdx += ddx; mapX += stx; side = 0; } else { sdy += ddy; mapY += sty; side = 1; }
					if (mapX < 0 || mapY < 0 || mapX >= MW || mapY >= Wd.MH || !map[mapY * MW + mapX]) { break; }
				}
				perp = side === 0 ? sdx - ddx : sdy - ddy;
				if (perp < 0.02) { perp = 0.02; }
				ZB[x] = perp;
				top = hz - (1 - camZ) * FOC / perp; bot = hz + camZ * FOC / perp;
				y0 = Math.max(0, Math.ceil(top - 0.5)); y1 = Math.min(h, Math.ceil(bot - 0.5));
				if (y0 > h) { y0 = h; } if (y1 < 0) { y1 = 0; }
				WY0[x] = y0; WY1[x] = Math.max(y0, y1);
				wx = side === 0 ? posY + perp * rdy : posX + perp * rdx; wx -= Math.floor(wx);
				tx = (wx * 64) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) { tx = 63 - tx; }
				cellv = mapX < 0 || mapY < 0 || mapX >= MW || mapY >= Wd.MH ? DT_STONE + 1 : wt[mapY * MW + mapX];
				tex = TX[(cellv || 1) - 1];
				// the light where the ray met the wall (a hair in front of it), the lantern's by distance, the far side darker
				lmx = ((posX + rdx * perp * 0.985) * 4) | 0; lmy = ((posY + rdy * perp * 0.985) * 4) | 0;
				lm = lmx >= 0 && lmy >= 0 && lmx < LW && lmy < LH ? LMF[LM[lmy * LW + lmx]] : 0;
				lv = (perp < LR ? Math.pow(1 - perp / LR, 1.5) * LK : 0) + lm;
				if (side === 1) { lv -= 10; }
				lv = (lv < 0 ? 0 : lv > DTOP ? DTOP : lv) | 0;
				wb = Math.min(3, (lm + 12) >> 5) << 8;
				dv = 64 / (bot - top); tv = (y0 + 0.5 - top) * dv;
				for (y = y0; y < y1; y++, tv += dv) {
					idx = tex[(((tv | 0) & 63) << 6) | tx];
					lev = (lv + BAY[((y & 3) << 2) | (x & 3)]) >> 4;
					px[y * w + x] = SH[wb | (lev << 5) | idx];
				}
			}
			// floor and ceiling, a row at a time: each row is at one distance
			var rlx = dirX - plx, rly = dirY - ply, rrx = dirX + plx, rry = dirY + ply, dd, fx, fy, stepX, stepY, ftex, ctex, k2, lrow0, isF, cz;
			for (y = 0; y < h; y++) {
				isF = y + 0.5 > hz;
				dd = isF ? camZ * FOC / (y + 0.5 - hz) : (1 - camZ) * FOC / (hz - y - 0.5);
				if (!(dd > 0) || dd > 40) { dd = 40; }
				lrow0 = dd < LR ? Math.pow(1 - dd / LR, 1.5) * LK : 0;
				fx = posX + dd * rlx; fy = posY + dd * rly; stepX = dd * (rrx - rlx) / w; stepY = dd * (rry - rly) / w;
				o = y * w; b = (y & 3) << 2;
				for (x = 0; x < w; x++, fx += stepX, fy += stepY) {
					if (isF ? y < WY1[x] : y >= WY0[x]) { continue; }
					mapX = fx | 0; mapY = fy | 0;
					k2 = mapX >= 0 && mapY >= 0 && mapX < MW && mapY < Wd.MH ? Wd.kind[mapY * MW + mapX] : 0;
					tex = isF ? TX[k2 === 2 ? DT_HALL : DT_FLOOR] : TX[k2 === 2 ? DT_VAULT : DT_BEAM];
					idx = tex[((((fy * 64) | 0) & 63) << 6) | (((fx * 64) | 0) & 63)];
					lmx = (fx * 4) | 0; lmy = (fy * 4) | 0;
					lm = lmx >= 0 && lmy >= 0 && lmx < LW && lmy < LH ? LMF[LM[lmy * LW + lmx]] : 0;
					lv = lrow0 + lm;
					if (!isF) { lv *= 0.8; }
					lv = lv > DTOP ? DTOP : lv | 0;
					wb = (lm + (BAY[b | (x & 3)] << 1)) >> 5; if (wb > 3) { wb = 3; }
					px[o + x] = SH[(wb << 8) | ((lv + BAY[b | (x & 3)]) >> 4 << 5) | idx];
				}
			}
			sprites(F, hz, plx, ply);
			// the first moments come up out of the dark
			if (fade < 1) {
				var cut = (fade * 17) | 0, blk = pk(dark);
				for (y = 0; y < h; y++) { b = (y & 3) << 2; o = y * w; for (x = 0; x < w; x++) { if (BAY[b | (x & 3)] >= cut) { px[o + x] = blk; } } }
			}
		}
		function sprites(F, hz, plx, ply) {
			var px = F.px, props = Wd.props, n = props.length, i2, cnt = 0, lmx, lmy, near, lm, wb, dx, dy, dep, lat, sx2, sc2, im, hgt, x0, x1, xx, yy, ty0, ty1, tcol, c, lv, lev, cz, base, wid, ix, iy, b2, k2, j2, t2, ti;
			var rx = -dirY, ry = dirX;
			// gather what is in front, then draw far to near
			for (i2 = 0; i2 < n + nbat && cnt < 64; i2++) {
				if (i2 < n) { dx = props[i2][0] - posX; dy = props[i2][1] - posY; }
				else {
					k2 = (i2 - n) * 4; if (bats[k2 + 3] <= 0 || bats[k2] < s - 1 || bats[k2] > s + 14) { continue; }
					dx = BX[i2 - n] - posX; dy = BY[i2 - n] - posY;
				}
				dep = dx * dirX + dy * dirY;
				if (dep < 0.25 || dep > 22) { continue; }
				SPV[cnt] = i2; SPZ[cnt] = dep; cnt++;
			}
			for (i2 = 1; i2 < cnt; i2++) { ti = SPV[i2]; t2 = SPZ[i2]; j2 = i2 - 1; while (j2 >= 0 && SPZ[j2] < t2) { SPV[j2 + 1] = SPV[j2]; SPZ[j2 + 1] = SPZ[j2]; j2--; } SPV[j2 + 1] = ti; SPZ[j2 + 1] = t2; }
			for (j2 = 0; j2 < cnt; j2++) {
				i2 = SPV[j2]; dep = SPZ[j2];
				if (i2 < n) { dx = props[i2][0] - posX; dy = props[i2][1] - posY; k2 = props[i2][2]; im = k2 === 0 ? IM.pillar : k2 === 2 ? IM.gold : IM.chest; hgt = k2 === 0 ? 1 : 0.34; cz = 0; wid = k2 === 0 ? 0.5 : 0.5; }
				else {
					k2 = (i2 - n) * 4; dx = BX[i2 - n] - posX; dy = BY[i2 - n] - posY;
					im = (bats[k2 + 2] * 9 | 0) & 1 ? IM.bat0 : IM.bat1; hgt = 0.12; wid = 0.22; cz = 0.68 + 0.05 * Math.sin(bats[k2 + 2] * 3);
				}
				lat = dx * rx + dy * ry;
				// a bat that comes close fades out in a dither before it can fill the picture
				near = i2 >= n ? Math.max(0, Math.min(16, ((1.6 - dep) * 16) | 0)) : 0;
				// and anything far down a corridor comes in out of a dither, never all at once
				if (dep > 16) { near = Math.max(near, ((dep - 16) * 2.7) | 0); }
				sc2 = FOC / dep;
				sx2 = w / 2 + lat * sc2;
				base = hz + (camZ - cz) * sc2;
				var hp = hgt * sc2, wp = wid * sc2 * (im.w / im.h) / (wid / hgt);
				wp = hp * im.w / im.h;
				x0 = Math.max(0, Math.ceil(sx2 - wp / 2 - 0.5)); x1 = Math.min(w, Math.ceil(sx2 + wp / 2 - 0.5));
				ty0 = base - hp; ty1 = base;
				var yy0 = Math.max(0, Math.ceil(ty0 - 0.5)), yy1 = Math.min(h, Math.ceil(ty1 - 0.5));
				lmx = ((posX + dx) * 4) | 0; lmy = ((posY + dy) * 4) | 0;
				lm = lmx >= 0 && lmy >= 0 && lmx < LW && lmy < LH ? LMF[LM[lmy * LW + lmx]] : 0;
				lv = (dep < 5 ? Math.pow(1 - dep / 5, 1.5) * DTOP * L.lamp : 0) + lm;
				lv = lv > DTOP ? DTOP : lv | 0;
				wb = Math.min(3, (lm + 12) >> 5) << 8;
				for (xx = x0; xx < x1; xx++) {
					if (ZB[xx] < dep) { continue; }
					ix = (((xx + 0.5 - (sx2 - wp / 2)) / wp) * im.w) | 0; if (ix < 0 || ix >= im.w) { continue; }
					for (yy = yy0; yy < yy1; yy++) {
						iy = (((yy + 0.5 - ty0) / hp) * im.h) | 0; if (iy < 0 || iy >= im.h) { continue; }
						c = im.d[iy * im.w + ix]; if (c === 255) { continue; }
						if (near > 0 && BAY[((yy & 3) << 2) | (xx & 3)] < near) { continue; }
						lev = (lv + BAY[((yy & 3) << 2) | (xx & 3)]) >> 4;
						px[yy * w + xx] = SH[wb | (lev << 5) | c];
					}
				}
			}
		}
		return run(host, S, { resize: resize, step: step, draw: draw }, dark, c1);
	}
	K.addEngine({ id: "bit3d-dungeon", label: "8-bit 3D: torch-lit dungeon walk", colors: DUN.torch.c, start: startDun });

	// ================================================================ 3. canyon: a flight low down a river canyon
	// A height map drawn column by column from near to far, each column only painted where nothing nearer already stands
	// (a "y-buffer"), so cliffs hide what lies behind them. The canyon winds through a map that tiles, so the flight never
	// ends; the rock is banded in strata, lit from the sun and hazed with distance in dithered steps.
	var C_SKY = 0, C_SUN0 = 6, C_SUN1 = 7, C_STAR = 8, C_HAZE = 9, C_RA = 10, C_RB = 14, C_RC = 18, C_TOP = 22, C_W0 = 26, C_W1 = 27, C_W2 = 28, C_GL = 29, C_SAND = 30, C_SCRUB = 31, C_BIRD = 32, C_GW = 33, C_N = 36, C_GENTLE = 40;
	// c = [sky, sun and glow, rock]
	var CAN = {
		sunset: { c: ["2a1d5e", "ff8a4c", "c8582e"], sun: [0.5, 22], stripes: true, stars: 0.4, top: "c8a070", scrub: "6a7a3a", water: "4a3a8a", m: [0.28, 0.55] },
		noon: { c: ["3a78d6", "fff2c8", "d48c50"], sun: [0.8, 10], top: "e0c08a", scrub: "7a8a3a", water: "2e7ab8", m: [0.12, 0.35] },
		night: { c: ["050a22", "9ab0f0", "5a5680"], sun: [0.55, 9], moon: true, stars: 1, top: "6a6a86", scrub: "2e3c4e", water: "1a2a5a", m: [0.16, 0.6] },
		alien: { c: ["180a3c", "ff5ab4", "26a898"], sun: [0.62, 26], stripes: true, stars: 0.7, rings: true, top: "8ae0c8", scrub: "e04ab0", water: "c02a8a", m: [0.3, 0.55] }
	};
	function canPal(L, c1, c2, c3) {
		var Wt = [255, 255, 255], p = [], i, k, base, cols;
		for (i = 0; i < 6; i++) { p[C_SKY + i] = hueMix(c1, c2, Math.pow(i / 5, 1.35)); }
		p[C_SUN0] = mx(c2, Wt, L.moon ? 0.85 : 0.7); p[C_SUN1] = mx(c2, Wt, L.moon ? 0.4 : 0.2); p[C_STAR] = mx(Wt, c2, 0.2); p[C_HAZE] = p[C_SKY + 5];
		// three strata of rock, each in four lights: towards the sun, plain, turned away, deep shadow (tinted by the sky)
		cols = [c3, mx(c3, [255, 226, 178], 0.38), mx(ml(c3, 0.78), [120, 30, 40], 0.18)];
		for (k = 0; k < 3; k++) {
			base = cols[k];
			p[C_RA + k * 4] = mx(base, c2, L.m[0]); p[C_RA + k * 4] = mx(p[C_RA + k * 4], Wt, 0.08);
			p[C_RA + k * 4 + 1] = base;
			p[C_RA + k * 4 + 2] = mx(ml(base, 0.66), c1, L.m[1] * 0.6);
			p[C_RA + k * 4 + 3] = mx(ml(base, 0.42), c1, L.m[1]);
		}
		base = hx(L.top);
		p[C_TOP] = mx(base, c2, L.m[0] * 0.8); p[C_TOP + 1] = base; p[C_TOP + 2] = mx(ml(base, 0.7), c1, L.m[1] * 0.5); p[C_TOP + 3] = mx(ml(base, 0.48), c1, L.m[1]);
		base = hx(L.water);
		p[C_W0] = base; p[C_W1] = mx(base, p[C_SKY + 4], 0.3); p[C_W2] = mx(base, Wt, 0.2); p[C_GL] = mx(c2, Wt, 0.5);
		p[C_SAND] = mx(hx(L.top), c2, 0.15); p[C_SCRUB] = hx(L.scrub); p[C_BIRD] = mx(c1, [0, 0, 0], 0.55);
		p[C_GW] = mx(base, c2, 0.22); p[C_GW + 1] = mx(base, c2, 0.45); p[C_GW + 2] = mx(c2, Wt, 0.45);
		return p;
	}
	var CN = 1024, CNM = 1023, CHS = 0.5;
	// the canyon's line: where its middle is on each row of the map, and how wide it is there (both repeat every CN rows)
	function canLine(y) { var a = y / CN * TAU; return 512 + 130 * Math.sin(a) + 34 * Math.sin(3 * a + 1.1) + 10 * Math.sin(5 * a + 2.3); }
	function canSlope(y) { var a = y / CN * TAU, k = TAU / CN; return k * (130 * Math.cos(a) + 102 * Math.cos(3 * a + 1.1) + 50 * Math.cos(5 * a + 2.3)); }
	function canWidth(y) { var a = y / CN * TAU; return 62 + 16 * Math.sin(2 * a + 0.4) + 8 * Math.sin(7 * a); }
	function canWorld(L, seed) {
		var H0 = new Uint8Array(CN * CN), C0 = new Uint8Array(CN * CN), co = new Float32Array(128 * 128), de = new Float32Array(64 * 64), Wd = { ready: false, H0: H0, C0: C0 }, phase = 0, row = 0, red = null;
		var sun = L.sunDir;
		function hAt(x, y) { return H0[((y & CNM) << 10) | (x & CNM)]; }
		Wd.step = function (deadline) {
			var x, y, j, m, raw, t, d, cxv, cw, h, outside, p, n, q, gx, gy, lit, band;
			while (now() < deadline && !Wd.ready) {
				if (phase === 0) {
					for (; row < 128 && now() < deadline; row++) { for (x = 0; x < 128; x++) { co[row * 128 + x] = fbm(x / 32, row / 32, 4, seed, 4); } }
					if (row >= 128) { for (x = 0; x < 64 * 64; x++) { de[x] = ih(x & 63, x >> 6, seed + 3); } phase = 1; row = 0; }
				} else if (phase === 1) {
					// heights, a row at a time: mesas in terraces, the canyon cut down through them in ledges, a river at the foot
					// (the detail grid is read so that it repeats a whole number of times across the map: no seam where it tiles)
					for (; row < CN && now() < deadline; row++) {
						y = row; cxv = canLine(y); cw = canWidth(y);
						for (x = 0; x < CN; x++) {
							m = bil(co, 128, x / 8, y / 8);
							raw = 34 + 72 * K.smooth(0.38, 0.6, m) + 8 * (bil(de, 64, x / 8, y / 8) - 0.5);
							outside = Math.floor(raw / 10) * 10 + (raw % 10) * 0.12;
							d = x - cxv; d -= Math.round(d / CN) * CN; t = Math.abs(d) / cw;
							if (t < 1.15) {
								p = K.smooth(0.16, 1.15, t);
								p = Math.floor(p * 4) / 4 + Math.pow((p * 4) % 1, 4) / 4;
								// spires stand in the canyon here and there, never near its middle
								n = ih(x >> 4, y >> 4, seed + 9);
								if (n < 0.16 && t > 0.78 && (Math.pow((x & 15) - 7.5, 2) + Math.pow((y & 15) - 7.5, 2)) < 10 + n * 40) { p = Math.max(p, 0.85); }
								h = 8 + (outside - 8) * p;
								if (t < 0.13) { h = 6; } else if (t < 0.19) { h = Math.max(h, 7); }
							} else { h = outside; }
							H0[(y << 10) | x] = Math.max(0, Math.min(255, Math.round(h / CHS)));
						}
					}
					if (row >= CN) { phase = 2; row = 0; }
				} else if (phase === 2) {
					// colours, a row at a time: water, sand, the tops of things, and rock in bands lit from the sun
					for (; row < CN && now() < deadline; row++) {
						y = row; cxv = canLine(y); cw = canWidth(y);
						for (x = 0; x < CN; x++) {
							h = hAt(x, y);
							d = x - cxv; d -= Math.round(d / CN) * CN; t = Math.abs(d) / cw;
							if (t < 0.13 && h <= 12) { q = C_W0 + (((((x + 3 * y + ((de[((y >> 2) & 63) * 64 + ((x >> 2) & 63)] * 6) | 0)) * 85) & 1023) * 3) >> 10); if (de[(y & 63) * 64 + (x & 63)] < 0.04) { q = C_GL; } C0[(y << 10) | x] = q; continue; }
							gx = (hAt(x - 1, y) - hAt(x + 1, y)) * CHS; gy = (hAt(x, y - 1) - hAt(x, y + 1)) * CHS;
							lit = (gx * sun[0] + gy * sun[1] + 2 * sun[2]) / Math.sqrt(gx * gx + gy * gy + 4);
							n = ih(x, y, seed + 5);
							if (h <= 15 && Math.abs(gx) + Math.abs(gy) < 1) { C0[(y << 10) | x] = n < 0.12 ? C_SCRUB : C_SAND; continue; }
							q = lit > 0.78 ? 0 : lit > 0.5 ? 1 : lit > 0.22 ? 2 : 3;
							if (Math.abs(gx) + Math.abs(gy) < 0.7) { C0[(y << 10) | x] = n < 0.06 ? C_SCRUB : C_TOP + Math.min(3, q + (n < 0.25 ? 1 : 0)); continue; }
							// rock keeps only its light here: the band of rock is chosen per pixel from its height when drawn. Steep
							// rock is a cliff itself; gentler rock (the lip of a ledge) is marked apart, so the face below it is
							// not drawn in the lip's light.
							C0[(y << 10) | x] = (Math.abs(gx) + Math.abs(gy) > 2.2 ? C_RA : C_GENTLE) + q;
						}
					}
					if (row >= CN) { phase = 3; }
				} else if (phase === 3) {
					// the smaller copies for the distance, a few rows at a time: heights averaged, colours the commonest
					if (!red) { red = halver(H0, CN, false); }
					if (!red.step(deadline)) { continue; }
					if (!Wd.H1) { Wd.H1 = red.out; red = halver(Wd.H1, CN >> 1, false); }
					else if (!Wd.H2) { Wd.H2 = red.out; red = halver(C0, CN, true); }
					else if (!Wd.C1) { Wd.C1 = red.out; red = halver(Wd.C1, CN >> 1, true); }
					else { Wd.C2 = red.out; red = null; Wd.ready = true; }
				}
			}
			return Wd.ready;
		};
		return Wd;
	}
	function startCanyon(host, o) {
		var S = settings(o, CAN, "sunset"), L = CAN[S.look];
		var c1 = rgb3(o.c1, L.c[0]), c2 = rgb3(o.c2, L.c[1]), c3 = rgb3(o.c3, L.c[2]);
		L.sunDir = L.sunDir || [-0.66, 0.5, 0.56];
		var RGB = canPal(L, c1, c2, c3), NF = 4, LUT = new Uint32Array(NF * 64), SKYC = new Uint32Array(64), i, j;
		for (j = 0; j < NF; j++) { for (i = 0; i < C_N; i++) { LUT[(j << 6) | i] = pk(mx(RGB[i], RGB[C_HAZE], j / (NF - 1))); } }
		for (i = 0; i < C_N; i++) { SKYC[i] = pk(RGB[i]); }
		var Wd = null, ready = false, reveal = 0, cyc = -1, born = now();
		var V = null, w = 0, h = 0, FOC = 200, HZ = 70, YB = null, HZX = null, QR = null, PH = null, skyK = null, skyT = null, AMAX = 0, sunR = 10, sunEl = 20;
		var ZF = 520, FOG0 = 120, FOGK = 16 * (NF - 1) / (ZF - FOG0);
		// the strata: which of the three rock colours lies at each height (a quarter unit a step), in uneven layers
		var STRAT = new Uint8Array(512), sr = K.seeded("strata" + S.look), sk = 0, sh0 = 0, th;
		// rock grain: which pixels of a near cliff sit one light darker, fixed to the rock (its cell and its height)
		var GRAIN = new Uint8Array(1024);
		for (i = 0; i < 1024; i++) { GRAIN[i] = sr() < 0.16 ? 1 : 0; }
		while (sh0 < 512) { th = 10 + Math.floor(sr() * 34); for (i = 0; i < th && sh0 < 512; i++) { STRAT[sh0++] = sk; } sk = (sk + 1 + (sr() < 0.3 ? 1 : 0)) % 3; }
		var T = 0, camY = 40, camX = canLine(40), camH = 30, yaw = Math.PI / 2, roll = 0, sway = 0;
		var birds = new Float32Array(8 * 4), nb = Math.min(8, Math.round(4 * S.life)), BIRD = [spr(["aa.....aa", "..aa.aa..", "....a...."], { a: C_BIRD }), spr([".........", "aaaa.aaaa", "....a...."], { a: C_BIRD })];
		for (i = 0; i < nb; i++) { birds[i * 4] = Math.random() * TAU; birds[i * 4 + 1] = camY + 60 + Math.random() * 400; birds[i * 4 + 2] = (Math.random() - 0.5) * 60; birds[i * 4 + 3] = 70 + Math.random() * 40; }
		function resize(F) {
			var a, f, k, top;
			V = view(F); w = F.w; h = F.h;
			FOC = 190 * V.U;
			HZ = V.vh * (V.tall ? 0.4 : 0.34) + (S.layout === "top" ? V.vh * 0.08 : 0);
			YB = new Int16Array(w); HZX = new Float32Array(w); QR = new Uint8Array(w); PH = new Float32Array(w);
			AMAX = Math.ceil(V.vh * 2 + w) + 8; skyK = new Uint8Array(AMAX); skyT = new Uint8Array(AMAX); top = Math.max(8, HZ * 1.05);
			for (a = 0; a < AMAX; a++) { f = Math.min(0.9999, Math.pow(a / top, 0.8)) * 5; k = Math.floor(f); skyK[a] = k; skyT[a] = Math.round(K.clamp((f - k - 0.32) / 0.36, 0, 1) * 16); }
			sunR = Math.max(3, Math.round(L.sun[1] * V.U)); sunEl = L.sun[0] * HZ;
			if (S.layout === "top") { sunEl = Math.min(sunEl, HZ * (V.tall ? 0.1 : 0.24)); }
		}
		function step(sdt, dt) {
			var d, sl, ahead, m = S.motion;
			T += sdt;
			if (!Wd) { Wd = canWorld(L, 17 + S.look.length); }
			if (!ready) { if (Wd.ready) { ready = true; } else { Wd.step(now() + (now() - born < 300 ? 5 : 8)); } }
			else if (reveal < 16) { reveal = Math.min(16, reveal + dt * 24); }
			// down the middle of the canyon, the heading eased towards where the canyon goes a little way ahead
			camY += sdt * 20;
			if (camY > CN * 64) { camY -= CN * 32; for (i = 0; i < nb; i++) { birds[i * 4 + 1] -= CN * 32; } }
			camX = canLine(camY);
			// the eyes aim at the middle of the canyon a little way ahead, so they look down it rather than into its walls
			d = Math.atan2(70, canLine(camY + 70) - camX) * 0.5 + Math.atan2(150, canLine(camY + 150) - camX) * 0.5;
			yaw = d;
			sway = (canSlope(camY + 25) - canSlope(camY - 5)) / 30;
			roll = K.clamp(sway * 5 * m, -0.28, 0.28);
			camH = 72 + m * 4 * Math.sin(T * 0.21) + 1.5 * m * Math.sin(T * 0.53 + 1);
			var c = Math.floor(T * 2.4) % 3, n, l;
			if (c !== cyc) {
				cyc = c;
				for (l = 0; l < NF; l++) { for (n = 0; n < 3; n++) { LUT[(l << 6) | (C_W0 + n)] = pk(mx(RGB[C_W0 + (n + c) % 3], RGB[C_HAZE], l / (NF - 1))); LUT[(l << 6) | (C_GW + n)] = pk(mx(RGB[C_GW + (n + c) % 3], RGB[C_HAZE], l / (NF - 1) * 0.6)); } }
			}
			for (i = 0; i < nb; i++) { birds[i * 4] += sdt * (0.25 + (i % 3) * 0.06) * (i & 1 ? 1 : -1); birds[i * 4] -= Math.floor(birds[i * 4] / TAU) * TAU; }
		}
		function draw(F) {
			var px = F.px, x, y, o, z, dz, inv, lx, ly, sx, sy, f16, lev, hh, iy, top, c, Hm, Cm, sh, msk, sc, x0, y0, xf, yf, a, b2, q, r, bi, k, s, gw, glit, du, rise, gk;
			var fx = Math.cos(yaw), fy = Math.sin(yaw), rx = -fy, ry = fx, cxs = w / 2, hz = HZ - V.off, tr = Math.tan(roll), bx = camX + CN * 8, by = camY + CN * 8;
			var su = cxs + FOC * Math.tan(K.clamp(Math.PI / 2 - yaw, -1.2, 1.2)) * Math.min(1, w / 320 / V.U), rv = reveal, CHI = 1 / CHS;
			for (x = 0; x < w; x++) {
				YB[x] = h; HZX[x] = hz + (x - cxs) * tr; PH[x] = 1e9;
				// the light on a riser seen in this column (it faces back along the ray)
				a = fx + rx * (x + 0.5 - cxs) / FOC; b2 = fy + ry * (x + 0.5 - cxs) / FOC; k = Math.sqrt(a * a + b2 * b2);
				s = -(a * L.sunDir[0] + b2 * L.sunDir[1]) / k;
				QR[x] = C_RA + (s > 0.42 ? 0 : s > 0.1 ? 1 : s > -0.3 ? 2 : 3);
			}
			gw = sunR * (L.moon ? 0.5 : 0.7);
			if (ready) {
				z = 1.2; dz = 0.3;
				var ymin, most = h, tmin = Math.min(HZX[0], HZX[w - 1]);
				var zEnd = ZF * Math.min(1, 0.25 + rv / 18);
				while (z < zEnd) {
					inv = FOC / z;
					// the highest any ground could reach on screen at this distance; once every column is filled above that,
					// nothing further away can show
					// (and never above the top row: a strip that shows only ground is finished once every column is full)
					ymin = Math.max(0, tmin + (camH - 112) * inv);
					if (most <= ymin) { break; }
					most = 0;
					lx = bx + z * fx + z * rx * (0.5 - cxs) / FOC; ly = by + z * fy + z * ry * (0.5 - cxs) / FOC;
					sx = z * rx / FOC; sy = z * ry / FOC;
					f16 = z > FOG0 ? ((z - FOG0) * FOGK) | 0 : 0;
					if (z < 70) { Hm = Wd.H0; Cm = Wd.C0; sc = 1; sh = 10; msk = 1023; }
					else if (z < 190) { Hm = Wd.H1; Cm = Wd.C1; sc = 0.5; sh = 9; msk = 511; }
					else { Hm = Wd.H2; Cm = Wd.C2; sc = 0.25; sh = 8; msk = 255; }
					for (x = 0; x < w; x++, lx += sx, ly += sy) {
						if (YB[x] <= ymin) { continue; }
						// the height here, blended between the four nearest cells, so near ground moves smoothly
						a = lx * sc - 0.5; b2 = ly * sc - 0.5; x0 = a | 0; y0 = b2 | 0; xf = a - x0; yf = b2 - y0;
						q = ((y0 & msk) << sh); r = (((y0 + 1) & msk) << sh);
						k = Hm[q | (x0 & msk)]; s = Hm[q | ((x0 + 1) & msk)];
						hh = k + (s - k) * xf; k = Hm[r | (x0 & msk)]; s = Hm[r | ((x0 + 1) & msk)];
						hh += (k + (s - k) * xf - hh) * yf;
						y = HZX[x] + (camH - hh * CHS) * inv;
						iy = y < 0 ? 0 : (y + 0.5) | 0;
						top = YB[x];
						if (top > most) { most = top; }
						// how much the ground rose since the last (nearer) look along this column: a rise is a step face
						rise = hh * CHS - PH[x]; PH[x] = hh * CHS;
						if (iy >= top) { continue; }
						c = Cm[((((b2 + 0.5) | 0) & msk) << sh) | (((a + 0.5) | 0) & msk)];
						if (c >= C_W0 && c <= C_W2) { du = (x - su) / (gw + (iy - hz) * 0.35); if (du * du * 16 < 8 + BAY[((iy & 3) << 2) | (x & 3)]) { c += C_GW - C_W0; } }
						// Where the ground rose since the last look, the lower part of the span is the face of that step: there the
						// rock shows, its layer picked from the height of each pixel so the strata run level across cliffs, and the
						// colour of a top (sand, scrub, water, a ledge's lip) never runs down the face beneath it. Without a rise the
						// whole span is the surface.
						var hw = camH - (iy - HZX[x]) / inv, hs = 1 / inv, edge = rise > 0.6 ? hh * CHS - 0.25 : -1e9, rock = c <= C_RA + 3 && c >= C_RA, qf = rock ? c : QR[x], cc;
						if (c >= C_GENTLE) { c -= C_GENTLE - C_RA; rock = false; }
						gk = z < 130 ? ((((a + 0.5) | 0) * 73 + (((b2 + 0.5) | 0) * 151)) & 1023) : -1;
						for (o = iy * w + x, y = iy; y < top; y++, o += w, hw -= hs) {
							bi = ((y & 3) << 2) | (x & 3);
							cc = rock || hw < edge ? qf + (STRAT[(hw * 4) & 511] << 2) : c < C_RA + 4 ? c + (STRAT[(hw * 4) & 511] << 2) : c;
							if (gk >= 0 && cc >= C_RA && cc < C_TOP && ((cc - C_RA) & 3) < 3 && GRAIN[(gk + ((hw * 2) | 0)) & 1023]) { cc++; }
							px[o] = BAY[bi] < rv ? LUT[(((f16 + BAY[bi]) >> 4) << 6) | cc] : LUT[(3 << 6) | C_HAZE];
						}
						YB[x] = iy;
					}
					z += dz; dz = 0.3 + z * 0.011;
				}
			}
			// the sky over whatever is left of each column
			var sv = sunEl, stars = L.stars || 0, ss, R2 = sunR * sunR, RH = sunR + 6 * V.U, RH2 = RH * RH, dv, d2, yawPix = yaw * FOC;
			for (x = 0; x < w; x++) {
				top = YB[x];
				for (y = 0, o = x; y < top; y++, o += w) {
					a = (HZX[x] - y) | 0; if (a < 0) { a = 0; } if (a >= AMAX) { a = AMAX - 1; }
					bi = ((y & 3) << 2) | (x & 3);
					c = C_SKY + 5 - skyK[a] - (BAY[bi] < skyT[a] ? 1 : 0);
					if (stars && a > 12 && c < C_SKY + 3) { ss = Math.imul(((x - yawPix) | 0) * 73856093 ^ a * 19349663, 1103515245) >>> 22; if (ss < 3 * stars || (ss < 5 * stars && ((T * 2) | 0) & 1)) { c = C_STAR; } }
					du = x - su; dv = (HZX[x] - y) - sv; d2 = du * du + dv * dv;
					if (d2 < R2) {
						if (L.stripes && dv < -sunR * 0.1 && ((((-dv) / V.U) | 0) % 4) < 1 + (-dv / sunR) * 2.4) { c = C_SKY + 5; }
						else { c = dv < -sunR * 0.4 && !L.moon ? C_SUN1 : C_SUN0; }
					} else if (d2 < RH2 && !L.moon && BAY[bi] < (RH - Math.sqrt(d2)) * 8 / (6 * V.U)) { c = C_SUN1; }
					if (L.rings && Math.abs(dv * 3.2 - du * 0.5) < 1.6 * V.U && d2 > R2 && d2 < R2 * 4.4) { c = C_SUN1; }
					px[o] = SKYC[c];
				}
			}
			// hawks circling over the canyon, drawn where no rock stands in front of them
			if (ready) {
				for (i = 0; i < nb; i++) {
					var ang = birds[i * 4], dist = birds[i * 4 + 1] - camY, wx2 = canLine(camY + dist) + birds[i * 4 + 2] + Math.cos(ang) * 14, wy2 = camY + dist + Math.sin(ang) * 14, alt = birds[i * 4 + 3];
					var ddx = wx2 - camX, ddy = wy2 - camY, zz = ddx * fx + ddy * fy, xx = ddx * rx + ddy * ry, im, scl, bx2, by2;
					if (zz < 8 || zz > 300) { if (zz < 8) { birds[i * 4 + 1] = camY + 320 + Math.random() * 160; birds[i * 4 + 2] = (Math.random() - 0.5) * 60; } continue; }
					bx2 = cxs + FOC * xx / zz; by2 = hz + (bx2 - cxs) * tr + (camH - alt) * FOC / zz;
					if (bx2 < 0 || bx2 >= w || by2 >= YB[bx2 | 0]) { continue; }
					im = BIRD[((T * 4 + i) | 0) & 1]; scl = Math.max(0.5, Math.min(3, 1.6 * FOC / zz * 0.9));
					blit(F, im, bx2, by2, scl, 1, 0, Math.max(zz > FOG0 ? ((zz - FOG0) * FOGK) | 0 : 0, zz > 240 ? ((zz - 240) * 0.8) | 0 : 0), LUT, NF - 1);
				}
			}
		}
		return run(host, S, { resize: resize, step: step, draw: draw }, c1, c2);
	}
	K.addEngine({ id: "bit3d-canyon", label: "8-bit 3D: canyon run at sunset", colors: CAN.sunset.c, start: startCanyon });

	// ================================================================ 4. vector space: a world drawn in lines
	// Everything is one-pixel lines from an integer line routine, in three bright colours on black, the way vector arcade
	// machines drew it: a grid floor rolling towards the camera, a ring of mountains on the horizon (filled with black first,
	// so what is behind them is hidden), a striped sun, a ringed planet, stars, and solids and ships turning as they pass.
	// Distance is shown by dimmer and then dotted lines, never by blending.
	// c = [grid, mountains and ships, stars and highlights]; bg = [black, the glow along the horizon]
	var VEC = {
		neon: { c: ["ff2fa0", "2ee6ff", "ffe45a"], bg: ["05020c", "1c0634", "330a52"], sun: true },
		green: { c: ["1fa04a", "5cff80", "d6ffe0"], bg: ["000300", "001806", "002c0e"] },
		amber: { c: ["c05800", "ffae2a", "ffe8b8"], bg: ["030100", "1a0a00", "2e1400"], sun: true },
		ice: { c: ["2e60ff", "a0e6ff", "ffffff"], bg: ["01020a", "06122e", "0c2050"], planet: true }
	};
	// the solids: vertices, then faces as vertex lists (outward, anticlockwise seen from outside)
	var VMODELS = [
		{ v: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1], f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]] },
		{ v: [-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 0, 1.2, 0], f: [[0, 1, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]] },
		{ v: [1, 0, 0, -1, 0, 0, 0, 1.3, 0, 0, -1.3, 0, 0, 0, 1, 0, 0, -1], f: [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]] },
		// a dart-shaped ship, nose first
		{ v: [0, 0, 2.4, -1.7, -0.1, -1.1, 1.7, -0.1, -1.1, 0, 0.55, -0.7, 0, -0.35, -0.8], f: [[0, 3, 1], [0, 2, 3], [0, 1, 4], [0, 4, 2], [1, 3, 2, 4]], ship: true },
		// a flat wedge ship
		{ v: [0, 0, 1.8, -1.3, 0, -1.2, 1.3, 0, -1.2, -0.6, 0.45, -1.2, 0.6, 0.45, -1.2], f: [[3, 1, 0], [4, 3, 0], [2, 4, 0], [3, 4, 2, 1], [1, 2, 0]], ship: true }
	];
	(function () {
		// every model's edges, each with the faces either side of it, worked out once
		VMODELS.forEach(function (m) {
			var seen = {}, e = [], i, j, a, b, key, f;
			for (i = 0; i < m.f.length; i++) {
				f = m.f[i];
				for (j = 0; j < f.length; j++) {
					a = f[j]; b = f[(j + 1) % f.length]; key = a < b ? a + "," + b : b + "," + a;
					if (seen[key] == null) { seen[key] = e.length; e.push([Math.min(a, b), Math.max(a, b), i, -1]); } else { e[seen[key]][3] = i; }
				}
			}
			m.e = e;
		});
	})();
	function startVector(host, o) {
		var S = settings(o, VEC, "neon"), L = VEC[S.look];
		var c1 = rgb3(o.c1, L.c[0]), c2 = rgb3(o.c2, L.c[1]), c3 = rgb3(o.c3, L.c[2]), b0 = hx(L.bg[0]), b1 = hx(L.bg[1]), b2 = hx(L.bg[2]);
		// three colours, each bright, dim and faint; the background black and its two glows
		var COL = [c1, c2, c3].map(function (c) { return [pk(c), pk(mx(c, b0, 0.45)), pk(mx(c, b0, 0.72))]; }), BG0 = pk(b0), BG1 = pk(b1), BG2 = pk(b2);
		var V = null, w = 0, h = 0, FOC = 200, HZ = 90, glowK = null, AMAX = 0, i, j;
		var T = 0, camZ = 0, camX = 0, camY = 2.4, yaw = 0, roll = 0, pitch = 0, cr = 1, sr = 0, cxs = 0, hz = 0;
		// mountains: a ring of peaks far away, as heights at evenly spaced bearings, plus ridge lines down from some peaks
		// mountains: sharp peaks (each a triangle) all round the horizon; their outline sampled at fine bearings
		var NM = 360, MH = new Float32Array(NM), MR = K.seeded("vmount" + S.look), SIL = null, MX = new Float32Array(NM + 1), MY = new Float32Array(NM + 1), MOK = new Uint8Array(NM + 1);
		var NPK = 46, PKB = new Float32Array(NPK), PKH = new Float32Array(NPK), PKW = new Float32Array(NPK), pb, pw, ph, dd;
		for (j = 0; j < NPK; j++) { PKB[j] = (j + MR() * 0.8) / NPK * TAU; PKW[j] = 0.05 + MR() * 0.1; PKH[j] = 22 + Math.pow(MR(), 1.6) * 90; }
		for (i = 0; i < NM; i++) {
			for (j = 0; j < NPK; j++) { dd = i / NM * TAU - PKB[j]; dd -= Math.round(dd / TAU) * TAU; ph = PKH[j] * (1 - Math.abs(dd) / PKW[j]); if (ph > MH[i]) { MH[i] = ph; } }
		}
		// stars on the sky's dome (bearing, height above the horizon in radians, brightness)
		var NS = 160, STB = new Float32Array(NS), STE = new Float32Array(NS), STK = new Uint8Array(NS);
		for (i = 0; i < NS; i++) { STB[i] = MR() * TAU; STE[i] = 0.06 + Math.pow(MR(), 0.8) * 0.9; STK[i] = MR() < 0.2 ? 0 : MR() < 0.5 ? 1 : 2; }
		// things passing: model, position, spin, colour
		var NO = Math.max(0, Math.min(14, Math.round(7 * S.life))), OB = [];
		for (i = 0; i < NO; i++) { OB.push({ m: 0, x: 0, y: 0, z: 0, ax: 0, ay: 0, az: 0, sx: 0, sy: 0, sz: 0, s: 1, c: 1, v: 0 }); }
		var PX3 = new Float32Array(16), PY3 = new Float32Array(16), PZ3 = new Float32Array(16), FV = new Uint8Array(16);
		var shoot = { t: 4 + Math.random() * 6, on: 0, e: 0, x: 0, y: 0, dx: 0, dy: 0 };
		function spawn(ob, far) {
			var r = Math.random();
			ob.m = r < 0.2 ? 0 : r < 0.36 ? 1 : r < 0.52 ? 2 : r < 0.78 ? 3 : 4;
			ob.z = camZ + (far ? 60 + Math.random() * 110 : 20 + Math.random() * 150);
			ob.x = camX + (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 22);
			ob.y = 2.5 + Math.random() * 9;
			ob.ax = Math.random() * TAU; ob.ay = Math.random() * TAU; ob.az = Math.random() * TAU;
			ob.sx = (Math.random() - 0.5) * 1.4; ob.sy = (Math.random() - 0.5) * 1.8; ob.sz = (Math.random() - 0.5) * 1.2;
			ob.s = VMODELS[ob.m].ship ? 1.5 + Math.random() * 0.8 : 0.8 + Math.random() * 0.9;
			ob.c = VMODELS[ob.m].ship ? 1 : Math.random() < 0.5 ? 2 : 0;
			// ships fly the same way, slower than the camera, so they are overtaken; solids hang still and turn
			ob.v = VMODELS[ob.m].ship ? 3 + Math.random() * 3 : 0;
			if (VMODELS[ob.m].ship) { ob.ax = 0; ob.az = 0; ob.ay = 0; ob.sx = 0; ob.sy = 0; ob.sz = 0; }
		}
		for (i = 0; i < NO; i++) { spawn(OB[i], false); }
		function resize(F) {
			var a;
			V = view(F); w = F.w; h = F.h;
			FOC = 210 * V.U;
			HZ = V.vh * (V.tall ? 0.5 : 0.52) - (S.layout === "top" ? -V.vh * 0.06 : 0);
			AMAX = Math.ceil(V.vh * 2 + w) + 8; glowK = new Uint8Array(AMAX * 2);
			// the glow along the horizon, in dithered steps of two dark colours: (distance from the horizon) -> level 0..32
			for (a = 0; a < AMAX * 2; a++) { glowK[a] = Math.round(Math.max(0, 1 - (a < AMAX ? (AMAX - a) / (V.vh * 0.26) : (a - AMAX) / (V.vh * 0.035))) * 32); }
			SIL = new Float32Array(w);
		}
		function step(sdt) {
			var m = S.motion, ob, k;
			T += sdt;
			camZ += sdt * 9;
			// (wrapped at a whole number of grid squares, with everything passing moved back by the same)
			if (camZ > 4096) { camZ -= 4096; for (k = 0; k < NO; k++) { OB[k].z -= 4096; } }
			// side to side and a slow look round: none at all when steady
			k = m > 0 ? 0.3 + 0.7 * Math.min(1, m) : 0;
			camX = Math.sin(T * 0.13) * 6 * k;
			yaw = Math.sin(T * 0.071) * 0.18 * k;
			roll = -Math.cos(T * 0.13) * 0.13 * 0.78 * m;
			camY = 2.4 + m * 0.5 * Math.sin(T * 0.31);
			for (k = 0; k < NO; k++) {
				ob = OB[k];
				ob.z += ob.v * sdt; ob.ax = (ob.ax + ob.sx * sdt) % TAU; ob.ay = (ob.ay + ob.sy * sdt) % TAU; ob.az = (ob.az + ob.sz * sdt) % TAU;
				if (ob.z < camZ + 0.8) { spawn(ob, true); }
			}
			shoot.t -= sdt;
			if (shoot.t <= 0 && !shoot.on) { shoot.on = 1; shoot.e = 0; shoot.x = Math.random(); shoot.y = 0.15 + Math.random() * 0.25; shoot.dx = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.3); shoot.dy = 0.12 + Math.random() * 0.1; }
			if (shoot.on) { shoot.e += sdt * 1.6; if (shoot.e > 1.4) { shoot.on = 0; shoot.t = 5 + Math.random() * 12; } }
		}
		// screen position of a point in camera space (x right, y up, z ahead), turned by the roll; false behind the camera
		var QX = 0, QY = 0;
		function proj(x, y, z) {
			if (z < 0.05) { return false; }
			var u = FOC * x / z, v = -FOC * y / z;
			QX = cxs + u * cr - v * sr; QY = hz + u * sr + v * cr;
			return true;
		}
		// a one-pixel line between two points (Liang-Barsky clipped to the picture), solid or dotted by the Bayer pattern
		var LT0 = 0, LT1 = 1;
		function clipT(p, q) {
			var r;
			if (p === 0) { return q >= 0; }
			r = q / p;
			if (p < 0) { if (r > LT1) { return false; } if (r > LT0) { LT0 = r; } } else { if (r < LT0) { return false; } if (r < LT1) { LT1 = r; } }
			return true;
		}
		function line(px, x0, y0, x1, y1, col, dots) {
			var dx = x1 - x0, dy = y1 - y0, t0, t1, k, n, xs, ys, xi, yi, e, sx, sy, ax, ay, i2;
			if (!(isFinite(dx) && isFinite(dy))) { return; }
			LT0 = 0; LT1 = 1;
			if (!clipT(-dx, x0) || !clipT(dx, w - 1 - x0) || !clipT(-dy, y0) || !clipT(dy, h - 1 - y0)) { return; }
			t0 = LT0; t1 = LT1;
			xs = Math.round(x0 + dx * t0); ys = Math.round(y0 + dy * t0); xi = Math.round(x0 + dx * t1); yi = Math.round(y0 + dy * t1);
			ax = Math.abs(xi - xs); ay = Math.abs(yi - ys); sx = xs < xi ? 1 : -1; sy = ys < yi ? 1 : -1; e = ax - ay; n = ax + ay + 1;
			for (i2 = 0; i2 < n; i2++) {
				if (xs >= 0 && ys >= 0 && xs < w && ys < h && (dots >= 16 || BAY[((ys & 3) << 2) | (xs & 3)] < dots)) { px[ys * w + xs] = col; }
				if (xs === xi && ys === yi) { break; }
				k = 2 * e;
				if (k > -ay) { e -= ay; xs += sx; }
				if (k < ax) { e += ax; ys += sy; }
			}
		}
		function line3(px, x0, y0, z0, x1, y1, z1, col, dots) {
			// clipped against a plane just in front of the camera
			var N = 0.3, t;
			if (z0 < N && z1 < N) { return; }
			if (z0 < N) { t = (N - z0) / (z1 - z0); x0 += (x1 - x0) * t; y0 += (y1 - y0) * t; z0 = N; }
			if (z1 < N) { t = (N - z1) / (z0 - z1); x1 += (x0 - x1) * t; y1 += (y0 - y1) * t; z1 = N; }
			proj(x0, y0, z0); var ax = QX, ay = QY; proj(x1, y1, z1);
			line(px, ax, ay, QX, QY, col, dots);
		}
		// a style for a distance: [shade 0..2, dots out of 16]
		function far(z) { return z < 26 ? 0 : z < 55 ? 1 : 2; }
		function dots(z) { return z < 70 ? 16 : Math.max(3, 16 - ((z - 70) / 7) | 0); }
		function draw(F) {
			var px = F.px, x, y, o, u, v, a, k, z, gx, wx, x0, x1, sh, d, bi, ca, sa, cy, ob, M, q, n, col;
			cr = Math.cos(roll); sr = Math.sin(roll); cxs = w / 2; hz = HZ - V.off + pitch;
			// the black, with a glow along the horizon (turned with the roll)
			for (y = 0; y < h; y++) {
				v = -(0.5 - cxs) * sr + (y + 0.5 - hz) * cr; o = y * w; bi = (y & 3) << 2;
				for (x = 0; x < w; x++, v -= sr) {
					a = (v + AMAX) | 0; a = a < 0 ? 0 : a >= AMAX * 2 ? AMAX * 2 - 1 : a;
					k = glowK[a];
					px[o + x] = k > 16 ? (BAY[bi | (x & 3)] < k - 16 ? BG2 : BG1) : (BAY[bi | (x & 3)] < k ? BG1 : BG0);
				}
			}
			// stars, fixed on the sky, a few twinkling
			for (k = 0; k < NS; k++) {
				a = STB[k] - yaw; a -= Math.round(a / TAU) * TAU;
				if (Math.abs(a) > 1.2) { continue; }
				u = FOC * Math.tan(a); v = -FOC * Math.tan(STE[k]) * 0.62;
				x = (cxs + u * cr - v * sr) | 0; y = (hz + u * sr + v * cr) | 0;
				if (x < 0 || y < 0 || x >= w || y >= h) { continue; }
				q = STK[k] === 0 && ((T * 1.7 + k) | 0) % 5 === 0 ? 2 : STK[k];
				px[y * w + x] = COL[2][q];
			}
			// a shooting star now and then
			// (it streaks across over its first second, bright, then fades through the dimmer colours as it slows)
			if (shoot.on && shoot.e < 1.3) {
				a = 1 - (1 - Math.min(1, shoot.e)) * (1 - Math.min(1, shoot.e)); u = shoot.x * w + shoot.dx * w * a; v = shoot.y * hz + shoot.dy * hz * a;
				line(px, u, v, u - shoot.dx * w * 0.08 * (1.3 - shoot.e), v - shoot.dy * hz * 0.08 * (1.3 - shoot.e), COL[2][shoot.e < 0.7 ? 0 : shoot.e < 1 ? 1 : 2], 16);
			}
			// the ringed planet, high in the sky
			if (L.planet || !L.sun) { planet(px); }
			// the sun: a disc of stripes sitting on the horizon
			if (L.sun) { sun(px); }
			// the mountains: their outline per column, filled with black below it, then their lines
			mountains(px);
			// the grid: lines across (fixed distances ahead, rolling in) and lines along (fixed sideways places)
			// (it stops well short of the horizon, fading out in dots, so the far lines never crowd into a band)
			var GS = 4, zf = 84, zo = camZ % GS;
			for (k = 1; k * GS - zo < 62; k++) {
				z = k * GS - zo; if (z < 0.6) { continue; }
				line3(px, -70 - camX, -camY, z, 70 - camX, -camY, z, COL[0][z < 22 ? 0 : z < 38 ? 1 : 2], z < 38 ? 16 : Math.max(1, 16 - ((z - 38) / 1.6) | 0));
			}
			gx = Math.floor((camX - 64) / GS) * GS;
			for (wx = gx; wx <= camX + 64; wx += GS) {
				// near part bright, then dim, then dotted towards the horizon
				line3(px, wx - camX, -camY, 0.6, wx - camX, -camY, 24, COL[0][0], 16);
				line3(px, wx - camX, -camY, 24, wx - camX, -camY, 46, COL[0][1], 16);
				line3(px, wx - camX, -camY, 46, wx - camX, -camY, 64, COL[0][2], 10);
				line3(px, wx - camX, -camY, 64, wx - camX, -camY, zf, COL[0][2], 4);
			}
			// the passing things, furthest first
			for (k = 1; k < NO; k++) { ob = OB[k]; j = k - 1; while (j >= 0 && OB[j].z < ob.z) { OB[j + 1] = OB[j]; j--; } OB[j + 1] = ob; }
			for (k = 0; k < NO; k++) { solid(px, OB[k]); }
		}
		function planet(px) {
			var a = 0.42 - yaw, u, v, r = 22 * V.U, x0, y0, t, n = 48, i2, pxx, pyy, qx, qy, e, inside, rx2, ry2, yy, hw;
			if (Math.abs(a) > 1.3) { return; }
			u = FOC * Math.tan(a); v = -HZ * 0.62;
			x0 = cxs + u * cr - v * sr; y0 = hz + u * sr + v * cr;
			// the far half of the ring first (it is behind the planet), then the planet's face, then the near half
			rx2 = r * 2.1; ry2 = r * 0.5;
			for (i2 = 0; i2 < n; i2++) {
				t = i2 / n * TAU; e = (i2 + 1) / n * TAU;
				pxx = x0 + Math.cos(t) * rx2; pyy = y0 + Math.sin(t) * ry2 - Math.cos(t) * r * 0.25; qx = x0 + Math.cos(e) * rx2; qy = y0 + Math.sin(e) * ry2 - Math.cos(e) * r * 0.25;
				inside = (pxx - x0) * (pxx - x0) + (pyy - y0) * (pyy - y0) < r * r;
				if (Math.sin(t) < 0 && !inside) { line(px, pxx, pyy, qx, qy, COL[1][1], 16); }
			}
			// the planet's face hides the stars behind it
			for (yy = Math.max(0, Math.ceil(y0 - r)); yy <= Math.min(h - 1, y0 + r); yy++) {
				hw = Math.sqrt(Math.max(0, r * r - (yy - y0) * (yy - y0)));
				for (i2 = Math.max(0, Math.ceil(x0 - hw)); i2 <= Math.min(w - 1, x0 + hw); i2++) { px[yy * w + i2] = BG0; }
			}
			for (i2 = 0; i2 < n; i2++) {
				t = i2 / n * TAU; e = (i2 + 1) / n * TAU;
				line(px, x0 + Math.cos(t) * r, y0 + Math.sin(t) * r, x0 + Math.cos(e) * r, y0 + Math.sin(e) * r, COL[2][0], 16);
			}
			for (i2 = 1; i2 < 4; i2++) {
				// bands across the planet's face
				yy = y0 + r * (i2 / 2 - 1) * 0.8; hw = Math.sqrt(Math.max(0, r * r - (yy - y0) * (yy - y0)));
				line(px, x0 - hw + 1, yy, x0 + hw - 1, yy, COL[2][1], 16);
			}
			for (i2 = 0; i2 < n; i2++) {
				t = i2 / n * TAU; e = (i2 + 1) / n * TAU;
				if (Math.sin(t) < 0) { continue; }
				pxx = x0 + Math.cos(t) * rx2; pyy = y0 + Math.sin(t) * ry2 - Math.cos(t) * r * 0.25; qx = x0 + Math.cos(e) * rx2; qy = y0 + Math.sin(e) * ry2 - Math.cos(e) * r * 0.25;
				line(px, pxx, pyy, qx, qy, COL[1][0], 16);
			}
		}
		function sun(px) {
			var a = -yaw, u, v, r = 40 * V.U, x0, y0, dy, hw, k;
			if (Math.abs(a) > 1.2) { return; }
			u = FOC * Math.tan(a); v = -r * 0.45;
			x0 = cxs + u * cr - v * sr; y0 = hz + u * sr + v * cr;
			// stripes that thin out towards the foot of the sun, cut off at the horizon
			for (k = 0, dy = -r; dy < r * 0.45; k++) {
				hw = Math.sqrt(Math.max(0, r * r - dy * dy));
				line(px, x0 - hw * cr - dy * sr, y0 - hw * sr + dy * cr, x0 + hw * cr - dy * sr, y0 + hw * sr + dy * cr, COL[2][dy < 0 ? 0 : 1], 16);
				dy += dy < -r * 0.2 ? 2 * V.U : 2 * V.U + (dy + r * 0.2) / r * 6 * V.U;
			}
		}
		function mountains(px) {
			var i2, j, a, u, v, xa, xb, x, y, t, top, bot, x0, y0, x1, y1, tn = sr / cr;
			// the peaks in view, turned with the roll into screen points
			for (i2 = 0; i2 <= NM; i2++) {
				a = (i2 / NM) * TAU - yaw; a -= Math.round(a / TAU) * TAU;
				MOK[i2] = Math.abs(a) < 1.25 ? 1 : 0;
				if (!MOK[i2]) { continue; }
				u = FOC * Math.tan(a); v = -MH[i2 % NM] * FOC / 600 * V.vh / 180 / V.U;
				MX[i2] = cxs + u * cr - v * sr; MY[i2] = hz + u * sr + v * cr;
			}
			// below the outline, down to the horizon, filled with black: whatever is behind the mountains is hidden
			for (i2 = 0; i2 < NM; i2++) {
				if (!MOK[i2] || !MOK[i2 + 1]) { continue; }
				xa = Math.max(0, Math.ceil(Math.min(MX[i2], MX[i2 + 1]))); xb = Math.min(w - 1, Math.floor(Math.max(MX[i2], MX[i2 + 1])));
				for (x = xa; x <= xb; x++) {
					t = (x - MX[i2]) / ((MX[i2 + 1] - MX[i2]) || 1); top = MY[i2] + (MY[i2 + 1] - MY[i2]) * t; bot = hz + (x - cxs) * tn;
					for (y = Math.max(0, Math.ceil(top)); y <= Math.min(h - 1, bot); y++) { px[y * w + x] = BG0; }
				}
			}
			for (i2 = 0; i2 < NM; i2++) {
				if (!MOK[i2] || !MOK[i2 + 1]) { continue; }
				line(px, MX[i2], MY[i2], MX[i2 + 1], MY[i2 + 1], COL[1][0], 16);
			}
			// a ridge down the face of every peak that shows above its neighbours
			for (j = 0; j < NPK; j++) {
				a = PKB[j] - yaw; a -= Math.round(a / TAU) * TAU;
				if (Math.abs(a) > 1.2) { continue; }
				i2 = Math.round(PKB[j] / TAU * NM) % NM;
				if (MH[i2] > PKH[j] + 0.5 || PKH[j] < 40) { continue; }
				u = FOC * Math.tan(a); v = -PKH[j] * FOC / 600 * V.vh / 180 / V.U; t = (j % 3 - 1) * 5 * V.U;
				x0 = cxs + u * cr - v * sr; y0 = hz + u * sr + v * cr; v *= 0.3;
				line(px, x0, y0, cxs + (u + t) * cr - v * sr, hz + (u + t) * sr + v * cr, COL[1][1], 16);
			}
			// the horizon itself
			line(px, cxs - w * cr, hz - w * sr, cxs + w * cr, hz + w * sr, COL[0][0], 16);
		}
		function solid(px, ob) {
			var M = VMODELS[ob.m], nv = M.v.length / 3, i2, x, y, z, ca, sa, cb, sb, cc, sc, t, e, f, a, b, sh, d, rz = ob.z - camZ, col, nx, ny, nz, ux, uy, uz, vx, vy, vz;
			if (rz < 0.5 || rz > 170) { return; }
			ca = Math.cos(ob.ax); sa = Math.sin(ob.ax); cb = Math.cos(ob.ay); sb = Math.sin(ob.ay); cc = Math.cos(ob.az); sc = Math.sin(ob.az);
			for (i2 = 0; i2 < nv; i2++) {
				x = M.v[i2 * 3] * ob.s; y = M.v[i2 * 3 + 1] * ob.s; z = M.v[i2 * 3 + 2] * ob.s;
				t = y * ca - z * sa; z = y * sa + z * ca; y = t;
				t = x * cb + z * sb; z = -x * sb + z * cb; x = t;
				t = x * cc - y * sc; y = x * sc + y * cc; x = t;
				PX3[i2] = x + ob.x - camX; PY3[i2] = y + ob.y - camY; PZ3[i2] = z + rz;
			}
			// which faces look towards the camera
			for (i2 = 0; i2 < M.f.length; i2++) {
				f = M.f[i2]; a = f[0]; b = f[1]; e = f[2];
				ux = PX3[b] - PX3[a]; uy = PY3[b] - PY3[a]; uz = PZ3[b] - PZ3[a]; vx = PX3[e] - PX3[a]; vy = PY3[e] - PY3[a]; vz = PZ3[e] - PZ3[a];
				nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
				FV[i2] = nx * PX3[a] + ny * PY3[a] + nz * PZ3[a] < 0 ? 1 : 0;
			}
			sh = far(rz); d = dots(rz); col = COL[ob.c][sh];
			for (i2 = 0; i2 < M.e.length; i2++) {
				e = M.e[i2];
				if (!FV[e[2]] && (e[3] < 0 || !FV[e[3]])) { continue; }
				line3(px, PX3[e[0]], PY3[e[0]], PZ3[e[0]], PX3[e[1]], PY3[e[1]], PZ3[e[1]], col, d);
			}
		}
		return run(host, S, { resize: resize, step: step, draw: draw }, b0, b1);
	}
	K.addEngine({ id: "bit3d-vector", label: "8-bit 3D: vector-line space ride", colors: VEC.neon.c, start: startVector });

	// ================================================================ 5. open road: the pseudo-3D racing road
	// The road is a loop of short segments, each with a bend and a height. They are projected nearest first, each filling
	// the rows between its two ends (rows already filled by a nearer rise are skipped, so hills hide what is behind them);
	// the bends are faked by adding up sideways offsets, as the old machines did. Stripes alternate every few segments,
	// so they stream past smoothly. Roadside things and other cars are scaled sprites; the background slides in the bends.
	var R_SKY = 0, R_SUN0 = 6, R_SUN1 = 7, R_STAR = 8, R_HAZE = 9, R_G0 = 10, R_G1 = 11, R_RD0 = 12, R_RD1 = 13, R_RB0 = 14, R_RB1 = 15, R_LANE = 16,
		R_H0 = 17, R_H1 = 18, R_H2 = 19, R_H3 = 20, R_CAP = 21, R_SEA0 = 22, R_SEA1 = 23, R_SEA2 = 24, R_WIN = 25,
		R_K0 = 26, R_K1 = 27, R_K2 = 28, R_GLASS = 29, R_GL2 = 30, R_TAIL = 31, R_TAIL2 = 32, R_TYRE = 33, R_SHADOW = 34, R_PLATE = 35,
		R_P0 = 36, R_P1 = 37, R_P2 = 38, R_P3 = 39, R_P4 = 40, R_P5 = 41, R_T0 = 42, R_T1 = 43, R_T2 = 44, R_U0 = 45, R_U1 = 46, R_U2 = 47, R_N = 48;
	// c = [sky, sun or glow, the car]; g = ground (two bands), r = road, b = rumble strips, h = hills (far two, near two), p = roadside colours
	var ROAD = {
		coast: { c: ["2c1d62", "ff8e52", "e8384a"], sun: [0.3, 30], stripes: true, g: ["e6c48c", "d8b47c"], r: ["4c4660", "463f58"], b: ["f4f0f0", "d83c48"], lane: "f4ece0", h: ["7a4a8a", "8c5a96", "4a3a6c", "54406e"], sea: ["3c3c96", "4a4aa6", "ffb070"],
			side: ["palm", "palm", "sign", "palm"], p: ["8a5a3a", "6a4028", "3e9a4a", "2a7a3a", "1a5a2c", "f0d040"], back: "sea", t: ["2a8ad8", "f0f0f0", "f0c020"] },
		city: { c: ["070820", "ff4fb4", "37e2ff"], stars: true, moon: true, sun: [0.62, 9], g: ["1c1c34", "18182e"], r: ["2e2e42", "2a2a3e"], b: ["6a6a8a", "ff4fb4"], lane: "f0f0ff", h: ["14142c", "1a1a36", "0c0c1e", "101024"], sea: ["101028", "141432", "ffcf6a"],
			side: ["lamp", "lamp", "neon", "lamp"], p: ["4a4a66", "2e2e44", "ffe6a0", "ff4fb4", "37e2ff", "fff4d0"], back: "city", t: ["f0c020", "e83a3a", "b0b8c8"] },
		desert: { c: ["3b84de", "fff2c4", "f2a428"], sun: [0.85, 10], g: ["e2b274", "d6a668"], r: ["8a8682", "84807a"], b: ["f8f8f8", "cc3434"], lane: "fffae8", h: ["c87a4a", "d48a58", "a65e3e", "b46a44"], sea: ["e2b274", "d6a668", "fff"],
			side: ["rock", "cactus", "sign", "cactus"], p: ["9a6a44", "7a4e32", "4a9a3a", "3a7a2e", "b48a64", "f0d040"], back: "mesa", t: ["e83a3a", "2a6ad8", "f0f0f0"] },
		snow: { c: ["6a92d4", "f6f9ff", "d8303e"], sun: [0.55, 11], g: ["f4f8ff", "e0e8f4"], r: ["6c6e7a", "666874"], b: ["f8f8f8", "3858d0"], lane: "ffffff", h: ["8aa0c8", "9cb0d4", "5c6e96", "6a7ca2"], sea: ["f4f8ff", "e0e8f4", "fff"],
			side: ["pine", "pine", "sign", "pine"], p: ["4a3a2c", "2e5a46", "3e7058", "f8fbff", "c8d6ea", "f0d040"], back: "peaks", t: ["2a6ad8", "f0c020", "3a3a44"] }
	};
	function roadPal(L, c1, c2, c3) {
		var Wt = [255, 255, 255], Bk = [8, 8, 14], p = [], i;
		for (i = 0; i < 6; i++) { p[R_SKY + i] = hueMix(c1, c2, Math.pow(i / 5, 1.3)); }
		p[R_SUN0] = mx(c2, Wt, L.moon ? 0.85 : 0.7); p[R_SUN1] = mx(c2, Wt, L.moon ? 0.45 : 0.18); p[R_STAR] = mx(Wt, c2, 0.2); p[R_HAZE] = p[R_SKY + 5];
		p[R_G0] = hx(L.g[0]); p[R_G1] = hx(L.g[1]); p[R_RD0] = hx(L.r[0]); p[R_RD1] = hx(L.r[1]); p[R_RB0] = hx(L.b[0]); p[R_RB1] = hx(L.b[1]); p[R_LANE] = hx(L.lane);
		for (i = 0; i < 4; i++) { p[R_H0 + i] = mx(hx(L.h[i]), p[R_HAZE], i < 2 ? 0.35 : 0.12); }
		p[R_CAP] = mx(Wt, p[R_HAZE], 0.2);
		p[R_SEA0] = hx(L.sea[0]); p[R_SEA1] = hx(L.sea[1]); p[R_SEA2] = hx(L.sea[2]); p[R_WIN] = L.moon ? hx("ffd27a") : mx(c2, Wt, 0.4);
		// the car: colour 3, with its lights and glass
		p[R_K0] = mx(c3, Wt, 0.28); p[R_K1] = c3; p[R_K2] = mx(ml(c3, 0.55), Bk, 0.2);
		p[R_GLASS] = mx(mx(c1, Bk, 0.5), c3, 0.12); p[R_GL2] = mx(p[R_SKY + 4], Wt, 0.25); p[R_TAIL] = [255, 60, 52]; p[R_TAIL2] = [255, 210, 150]; p[R_TYRE] = [22, 20, 28]; p[R_SHADOW] = mx(hx(L.r[0]), Bk, 0.55); p[R_PLATE] = [236, 236, 228];
		for (i = 0; i < 6; i++) { p[R_P0 + i] = hx(L.p[i]); }
		// the other cars: three colours each
		p[R_T0] = mx(hx(L.t[0]), Wt, 0.25); p[R_T1] = hx(L.t[0]); p[R_T2] = ml(hx(L.t[0]), 0.55);
		p[R_U0] = mx(hx(L.t[1]), Wt, 0.25); p[R_U1] = hx(L.t[1]); p[R_U2] = ml(hx(L.t[1]), 0.55);
		return p;
	}
	// small raster helpers for sprites made in code
	function img(w, h) { var d = new Uint8Array(w * h); d.fill(255); return { w: w, h: h, d: d }; }
	function dot(im, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < im.w && y < im.h) { im.d[y * im.w + x] = c; } }
	function rect(im, x, y, w, h, c) { var i, j; for (j = 0; j < h; j++) { for (i = 0; i < w; i++) { dot(im, x + i, y + j, c); } } }
	// A car seen from behind (my own wedge shape), body colours b0 light / b1 / b2 dark; lean -1, 0 or 1 shifts the cabin.
	function carImg(b0, b1, b2, lean) {
		var W = 44, H = 22, im = img(W, H), y, x, ins, c;
		rect(im, 3, H - 2, W - 6, 2, R_SHADOW);
		rect(im, 3, H - 7, 8, 6, R_TYRE); rect(im, W - 11, H - 7, 8, 6, R_TYRE);
		// lower body and bumper, tail panel with lights and a plate, the deck
		rect(im, 1, H - 9, W - 2, 3, b2);
		rect(im, 0, H - 14, W, 5, b1);
		for (x = 0; x < W; x++) { dot(im, x, H - 15, b0); }
		rect(im, 3, H - 13, 9, 3, R_TAIL); rect(im, W - 12, H - 13, 9, 3, R_TAIL); rect(im, 4, H - 12, 3, 1, R_TAIL2); rect(im, W - 7, H - 12, 3, 1, R_TAIL2);
		rect(im, 17, H - 12, 10, 3, R_PLATE); rect(im, 19, H - 11, 2, 1, R_K2); rect(im, 22, H - 11, 1, 1, R_K2); rect(im, 24, H - 11, 2, 1, R_K2);
		for (x = 1; x < W - 1; x++) { dot(im, x, H - 9, x % 6 === 0 ? b1 : b2); }
		// the cabin: a trapezoid of glass framed by the body, leaning into the bend
		for (y = 1; y < H - 15; y++) {
			ins = 5 + Math.round((H - 15 - y) * 0.9);
			for (x = ins + lean * (H - 15 - y) * 0.35; x < W - ins + lean * (H - 15 - y) * 0.35; x++) {
				c = y === 1 ? b0 : (x - ins - lean * (H - 15 - y) * 0.35 < 2 || W - ins + lean * (H - 15 - y) * 0.35 - x <= 2) ? b1 : R_GLASS;
				if (c === R_GLASS && (x - y * 1.3) % 13 < 2) { c = R_GL2; }
				dot(im, x, y, c);
			}
		}
		for (x = 8; x < W - 8; x++) { dot(im, x + lean, 0, b2); }
		return im;
	}
	function palmImg() {
		var im = img(34, 52), t, x, y, a, k, j;
		// a trunk leaning a little, ringed, and fronds drooping from the crown
		for (t = 0; t <= 1; t += 0.01) {
			x = 13 + Math.pow(t, 1.6) * 6; y = 51 - t * 36;
			for (k = -1.5; k <= 1.5; k += 1) { dot(im, x + k, y, ((y | 0) % 4 < 2) ? R_P0 : R_P1); }
		}
		for (j = 0; j < 7; j++) {
			a = -Math.PI * (0.08 + j * 0.14);
			for (t = 0; t <= 15; t += 0.5) {
				x = 19 + Math.cos(a) * t; y = 15 + Math.sin(a) * t + 0.035 * t * t * (1 + Math.abs(Math.cos(a)));
				dot(im, x, y, R_P2); dot(im, x, y + 1, R_P3); if (t > 4 && t < 13) { dot(im, x, y + 2, R_P4); }
			}
		}
		rect(im, 17, 15, 2, 2, R_P1); rect(im, 20, 16, 2, 2, R_P1);
		return im;
	}
	function lampImg(on) {
		var im = img(20, 56), y;
		for (y = 6; y < 56; y++) { dot(im, 3, y, R_P0); dot(im, 4, y, R_P1); }
		rect(im, 2, 52, 4, 4, R_P1);
		for (y = 0; y < 12; y++) { dot(im, 4 + y, 6 - Math.min(3, y >> 2), R_P0); }
		rect(im, 13, 3, 6, 2, R_P1); rect(im, 13, 5, 6, 2, on ? R_P2 : R_P1);
		return im;
	}
	function neonImg() {
		// a sign on two legs with made-up glyphs in two neon colours
		var im = img(36, 40), x;
		rect(im, 6, 18, 2, 22, R_P1); rect(im, 28, 18, 2, 22, R_P1);
		rect(im, 0, 0, 36, 20, R_P1); rect(im, 1, 1, 34, 18, R_P0);
		for (x = 3; x < 33; x++) { dot(im, x, 2, R_P3); dot(im, x, 17, R_P3); }
		rect(im, 5, 6, 3, 8, R_P4); rect(im, 8, 6, 5, 2, R_P4); rect(im, 8, 12, 5, 2, R_P4);
		rect(im, 16, 6, 2, 8, R_P3); rect(im, 18, 9, 4, 2, R_P3); rect(im, 22, 6, 2, 8, R_P3);
		rect(im, 27, 6, 3, 8, R_P4); rect(im, 25, 6, 7, 2, R_P4);
		return im;
	}
	function signImg() {
		// a bend sign: chevrons on a board, on two posts
		var im = img(30, 34), x, y, k;
		rect(im, 5, 16, 2, 18, R_P1); rect(im, 23, 16, 2, 18, R_P1);
		rect(im, 0, 0, 30, 17, R_P0); rect(im, 1, 1, 28, 15, R_P5);
		for (k = 0; k < 3; k++) { for (y = 0; y < 11; y++) { x = 6 + k * 7 + Math.abs(y - 5) * 0.8; dot(im, x, 3 + y, R_P1); dot(im, x + 1, 3 + y, R_P1); } }
		return im;
	}
	function rockImg() {
		var im = img(28, 16), x, y, d;
		for (y = 0; y < 16; y++) { for (x = 0; x < 28; x++) { d = Math.pow((x - 14) / 14, 2) + Math.pow((y - 15) / 14, 2) + (ih(x >> 2, y >> 2, 4) - 0.5) * 0.3; if (d < 1) { dot(im, x, y, d < 0.5 && x < 13 && y < 11 ? R_P4 : x > 18 || y > 12 ? R_P1 : R_P0); } } }
		return im;
	}
	function cactusImg() {
		var im = img(20, 36);
		rect(im, 8, 2, 5, 34, R_P2); rect(im, 11, 3, 2, 33, R_P3); rect(im, 9, 0, 3, 2, R_P2);
		rect(im, 2, 12, 3, 10, R_P2); rect(im, 2, 21, 7, 3, R_P2); rect(im, 15, 8, 3, 10, R_P2); rect(im, 12, 16, 6, 3, R_P2); rect(im, 16, 9, 1, 9, R_P3);
		return im;
	}
	function pineImg() {
		var im = img(26, 44), y, x, k, half;
		rect(im, 12, 36, 3, 8, R_P0);
		for (k = 0; k < 4; k++) {
			for (y = 0; y < 13; y++) {
				half = 3 + y * (0.6 + k * 0.08);
				for (x = -half; x <= half; x++) { dot(im, 13 + x, 2 + k * 8 + y, y < 2 + (Math.abs(x) % 3 === 0 ? 1 : 0) ? R_P3 : x > half * 0.3 ? R_P1 : R_P2); }
			}
		}
		return im;
	}
	var RN = 2400, RSL = 0.25, RW = 1, RDRAW = 260;
	function startRoad(host, o) {
		var S = settings(o, ROAD, "coast"), L = ROAD[S.look];
		var c1 = rgb3(o.c1, L.c[0]), c2 = rgb3(o.c2, L.c[1]), c3 = rgb3(o.c3, L.c[2]);
		var RGB = roadPal(L, c1, c2, c3), NF = 4, LUT = new Uint32Array(NF * 64), SKYC = new Uint32Array(64), i, j, k, a;
		for (j = 0; j < NF; j++) { for (i = 0; i < R_N; i++) { LUT[(j << 6) | i] = pk(mx(RGB[i], RGB[R_HAZE], j / (NF - 1))); } }
		for (i = 0; i < R_N; i++) { SKYC[i] = pk(RGB[i]); }
		// the track: a bend and a height for every segment, both made of whole waves round the loop, so it joins up
		var CV = new Float32Array(RN), HY = new Float32Array(RN + 1), SHO = new Float32Array(RN), SP = new Uint8Array(RN), SPS = new Int8Array(RN), rr = K.seeded("road" + S.look);
		for (i = 0; i < RN; i++) {
			a = i / RN * TAU;
			k = Math.sin(a * 3 + 0.4) * 0.9 + Math.sin(a * 7 + 1.7) * 0.6 + Math.sin(a * 11 + 0.2) * 0.25;
			// long straights between the bends: weak bends are flattened out
			CV[i] = (Math.abs(k) < 0.45 ? 0 : (k - Math.sign(k) * 0.45)) * 0.0028;
			HY[i] = Math.sin(a * 5 + 0.9) * 1.15 + Math.sin(a * 9 + 2.1) * 0.5 + Math.sin(a * 2) * 0.9;
			SHO[i] = 2.6 + Math.sin(a * 13 + 1) * 0.9 + Math.sin(a * 4) * 0.6;
			// what stands beside the road here (0 none), and on which side (-1 left, 1 right, 2 both)
			if (i % 8 === 0 && rr() < 0.8 * Math.min(1.5, Math.max(0.2, S.life))) { SP[i] = 1 + Math.floor(rr() * 4); SPS[i] = L.back === "sea" ? 1 : rr() < 0.45 ? -1 : rr() < 0.8 ? 1 : 2; }
			if (Math.abs(CV[i]) > 0.0008 && i > 0 && Math.abs(CV[i - 1]) <= 0.0008 && SP[i] === 0) { SP[i] = 3; SPS[i] = CV[i] > 0 ? -1 : 1; }
		}
		HY[RN] = HY[0];
		var IMG = { palm: palmImg(), lamp: lampImg(true), neon: neonImg(), sign: signImg(), rock: rockImg(), cactus: cactusImg(), pine: pineImg() };
		var SIDE = L.side.map(function (n) { return IMG[n]; }), SIDEH = L.side.map(function (n) { return { palm: 2.3, lamp: 2.6, neon: 1.5, sign: 1.0, rock: 0.55, cactus: 1.5, pine: 2.4 }[n]; });
		var CAR = [carImg(R_K0, R_K1, R_K2, -1), carImg(R_K0, R_K1, R_K2, 0), carImg(R_K0, R_K1, R_K2, 1)], TCAR = [carImg(R_T0, R_T1, R_T2, 0), carImg(R_U0, R_U1, R_U2, 0)];
		var V = null, w = 0, h = 0, FOC = 200, HZ = 80, CH = 0.72, AMAX = 0, skyK = null, skyT = null, sunR = 20, sunEl = 20;
		var SY1 = new Float32Array(RDRAW), SX1 = new Float32Array(RDRAW), SW1 = new Float32Array(RDRAW), SCL = new Float32Array(RDRAW), SZ = new Float32Array(RDRAW);
		var T = 0, pos = 0, speed = 15, px0 = 0, pxT = 0, camXr = 0, bgOff = 0, lean = 0, laneT = 0, laneWait = 4, cyc = -1, bob = 0;
		var NT = Math.max(0, Math.min(6, Math.round(3 * S.life))), TZ = new Float32Array(6), TX = new Float32Array(6), TV = new Float32Array(6), TK = new Uint8Array(6);
		for (i = 0; i < NT; i++) { TZ[i] = 30 + i * 70 + Math.random() * 30; TX[i] = [-0.62, 0, 0.62][i % 3]; TV[i] = 8 + Math.random() * 4; TK[i] = i & 1; }
		function resize(F) {
			var f, top;
			V = view(F); w = F.w; h = F.h;
			FOC = 160 * V.U;
			HZ = V.vh * (V.tall ? 0.46 : 0.44) + (S.layout === "top" ? V.vh * 0.04 : 0);
			AMAX = Math.ceil(V.vh * 2) + 8; skyK = new Uint8Array(AMAX); skyT = new Uint8Array(AMAX); top = Math.max(8, HZ * 1.02);
			for (a = 0; a < AMAX; a++) { f = Math.min(0.9999, Math.pow(a / top, 0.85)) * 5; k = Math.floor(f); skyK[a] = k; skyT[a] = Math.round(K.clamp((f - k - 0.32) / 0.36, 0, 1) * 16); }
			sunR = Math.max(3, Math.round(L.sun[1] * V.U)); sunEl = L.sun[0] * HZ;
		}
		function step(sdt) {
			var base, cur, m = S.motion, near, l2;
			T += sdt;
			pos += speed * sdt;
			if (pos >= RN * RSL) { pos -= RN * RSL; for (i = 0; i < NT; i++) { TZ[i] -= RN * RSL; } }
			base = Math.floor(pos / RSL) % RN; cur = CV[base];
			// the background slides the other way in a bend
			bgOff += cur * speed * sdt * 480;
			// steering: drift out in a bend and steer back, change lane now and then, and move over for a slower car ahead
			laneWait -= sdt;
			for (i = 0; i < NT; i++) {
				TZ[i] += TV[i] * sdt;
				if (TZ[i] < pos - 4) { TZ[i] += 120 + Math.random() * 90; TX[i] = [-0.62, 0, 0.62][Math.floor(Math.random() * 3)]; TK[i] = Math.random() < 0.5 ? 0 : 1; }
				if (TZ[i] - pos > 2 && TZ[i] - pos < 16 && Math.abs(TX[i] - pxT) < 0.4) {
					// a slower car ahead in this lane: move over to the nearest lane it is not in
					near = TX[i]; l2 = near > 0.3 ? 0 : near < -0.3 ? 0 : (pxT >= 0 ? 0.55 : -0.55);
					pxT = l2; laneWait = 3 + Math.random() * 3;
				}
			}
			if (laneWait <= 0) { laneWait = 5 + Math.random() * 6; pxT = [-0.55, 0, 0.55][Math.floor(Math.random() * 3)]; }
			var want = pxT - cur * 34 * (0.4 + 0.6 * Math.min(1, m));
			px0 += (want - px0) * Math.min(1, sdt * 1.6);
			lean = K.clamp((want - px0) * 3 + cur * 260, -1, 1);
			// the camera follows the car sideways, except when steady: then it holds the middle of the road
			camXr += (px0 * 0.75 * Math.min(1, m) - camXr) * Math.min(1, sdt * 2.2);
			bob = m * 0.6 * Math.sin(T * 17) * V.U * 0.5;
			var c = Math.floor(T * 3) % 3, n, l;
			if (c !== cyc) {
				cyc = c;
				// the sea sparkles: three colours turning round
				// the glints on the sea swap between two colours
				if (L.back === "sea") { for (l = 0; l < NF; l++) { LUT[(l << 6) | R_SEA1] = pk(mx(RGB[c & 1 ? R_SEA2 : R_SEA1], RGB[R_HAZE], l / (NF - 1))); LUT[(l << 6) | R_SEA2] = pk(mx(RGB[c & 1 ? R_SEA1 : R_SEA2], RGB[R_HAZE], l / (NF - 1))); } }
			}
		}
		function sky(px, hz) {
			var x, y, o, a2, c, b, ss, du, dv, d2, R2 = sunR * sunR, RH = sunR + 6 * V.U, RH2 = RH * RH, su = w * 0.5 + (L.moon ? w * 0.22 : 0), sv = sunEl;
			for (y = 0; y < Math.min(h, Math.ceil(hz)); y++) {
				a2 = (hz - y) | 0; if (a2 >= AMAX) { a2 = AMAX - 1; } o = y * w; b = (y & 3) << 2;
				for (x = 0; x < w; x++) {
					c = R_SKY + 5 - skyK[a2] - (BAY[b | (x & 3)] < skyT[a2] ? 1 : 0);
					if (L.stars && a2 > 14 && c < R_SKY + 3) { ss = Math.imul(((x + bgOff * 0.05) | 0) * 73856093 ^ a2 * 19349663, 1103515245) >>> 22; if (ss < 4) { c = R_STAR; } }
					du = x - su; dv = a2 - sv; d2 = du * du + dv * dv;
					if (d2 < R2) {
						if (L.stripes && dv < -sunR * 0.05 && ((((-dv) / V.U) | 0) % 4) < 1 + (-dv / sunR) * 2.6) { c = R_SKY + 5; }
						else if (L.moon) { c = (du + 2) * (du + 2) + (dv - 1) * (dv - 1) < R2 * 0.2 ? R_SUN1 : R_SUN0; }
						else { c = dv < -sunR * 0.4 ? R_SUN1 : R_SUN0; }
					} else if (d2 < RH2 && !L.moon && BAY[b | (x & 3)] < (RH - Math.sqrt(d2)) * 8 / (6 * V.U)) { c = R_SUN1; }
					px[o + x] = SKYC[c];
				}
			}
		}
		// the far and near hills (or towers, or mesas, or peaks) as outlines that slide at two speeds
		function back(px, hz) {
			var x, y, o, s, hf, hn, top, kind = L.back, c, b, u, n2, bw, bx, bh, wx;
			for (x = 0; x < w; x++) {
				u = (x - w / 2) / V.U;
				s = (u + bgOff * 0.35) / 60; hf = (Math.sin(s * 1.3) * 0.5 + Math.sin(s * 2.9 + 1) * 0.3 + Math.sin(s * 6.1 + 2) * 0.12 + 0.6) * 26;
				s = (u + bgOff * 0.7) / 44; hn = (Math.sin(s * 1.1 + 3) * 0.5 + Math.sin(s * 3.3) * 0.25 + 0.45) * 16;
				if (kind === "mesa") { hf = Math.round(hf / 7) * 7 * 1.1; hn = Math.max(0, Math.round((hn - 8) / 4) * 4 * 1.3); }
				else if (kind === "peaks") { s = (u + bgOff * 0.35) / 30; hf = (Math.abs(((s % 2) + 2) % 2 - 1) * 0.8 + Math.abs((((s * 2.3) % 2) + 2) % 2 - 1) * 0.35) * 40 + 6; }
				else if (kind === "sea") { hn = 0; hf *= 0.45; }
				hf *= V.U; hn *= V.U;
				for (y = Math.max(0, Math.ceil(hz - hf)); y < Math.min(h, hz); y++) {
					b = (y & 3) << 2; c = (hz - y) < hn ? (BAY[b | (x & 3)] < 8 ? R_H2 : R_H3) : (BAY[b | (x & 3)] < 8 ? R_H0 : R_H1);
					if (kind === "peaks" && (hz - y) > hf - 7 * V.U && (hz - y) >= hn) { c = R_CAP; }
					if (kind === "city" && (hz - y) >= hn) { c = R_H0; }
					px[y * w + x] = SKYC[c];
				}
				if (kind === "city") {
					// a skyline of towers with lit windows, sliding slowest of all
					wx = ((u + bgOff * 0.25) % 4000 + 4000) % 4000; bw = 9; bx = Math.floor(wx / bw); n2 = ih(bx, 1, 9);
					bh = (14 + n2 * 46) * V.U;
					for (y = Math.max(0, Math.ceil(hz - bh)); y < Math.min(h, hz - hn); y++) {
						c = ((wx % bw) > 1 && ((hz - y) / V.U | 0) % 3 === 1 && ((wx | 0) % 2 === 0) && ih(bx, (hz - y) / V.U | 0, 3) < 0.45) ? R_WIN : R_H2;
						px[y * w + x] = SKYC[c];
					}
				}
			}
		}
		function draw(F) {
			var px = F.px, kz, comp, hz = HZ - V.off, cxs = w / 2, base, pct, camWY, x, dx, n, i2, z1, z2, sy1, sy2, sx1, sx2, sw1, sw2, maxy = h, y, ya, yb, t, cx, ww, o, b, f16, gC, rC, bC, lane, shore, sea, xr, xl, l, idx, e1, e2, e3, e4, e5, e6;
			sky(px, hz);
			back(px, hz);
			base = Math.floor(pos / RSL); pct = (pos - base * RSL) / RSL; base = base % RN;
			camWY = HY[base] + (HY[base + 1] - HY[base]) * pct + CH;
			x = 0; dx = -CV[base] * pct;
			var NEAR = 0.02, first = true, y1w, x1w, fr;
			for (n = 0; n < RDRAW; n++) {
				i2 = (base + n) % RN;
				z1 = (n - pct) * RSL; z2 = z1 + RSL; y1w = HY[i2]; x1w = x;
				SZ[n] = 0; SCL[n] = maxy;
				// a segment wholly behind a plane just in front of the camera is left out; one that crosses it is cut there
				if (z2 <= NEAR) { x += dx; dx += CV[i2]; continue; }
				if (z1 < NEAR) { fr = (NEAR - z1) / RSL; y1w = HY[i2] + (HY[i2 + 1] - HY[i2]) * fr; x1w = x + dx * fr; z1 = NEAR; }
				sy1 = hz - FOC * (y1w - camWY) / z1 + bob; sy2 = hz - FOC * (HY[i2 + 1] - camWY) / z2 + bob;
				sx1 = cxs + FOC * (x1w - camXr) / z1; sx2 = cxs + FOC * (x + dx - camXr) / z2;
				sw1 = FOC * RW / z1; sw2 = FOC * RW / z2;
				SY1[n] = sy1; SX1[n] = sx1; SW1[n] = sw1; SZ[n] = z1;
				x += dx; dx += CV[i2];
				if (sy2 >= maxy || sy2 >= sy1) { continue; }
				// fills the rows between this segment's far and near ends that no nearer rise already covers
				f16 = z1 > 14 ? Math.min(47, ((z1 - 14) * 1.05) | 0) : 0;
				l = (Math.floor(i2 / 3)) & 1;
				gC = l ? R_G1 : R_G0; rC = l ? R_RD1 : R_RD0; bC = l ? R_RB1 : R_RB0; lane = !l;
				shore = SHO[i2]; sea = L.back === "sea";
				// (the nearest segment drawn carries on to the foot of the picture, however tall the picture is)
				ya = Math.max(0, Math.ceil(sy2 - 0.5)); yb = first ? maxy : Math.min(maxy, Math.ceil(sy1 - 0.5)); first = false;
				for (y = ya; y < yb; y++) {
					t = (y + 0.5 - sy2) / (sy1 - sy2); cx = sx2 + (sx1 - sx2) * t; ww = sw2 + (sw1 - sw2) * t;
					o = y * w; b = (y & 3) << 2; kz = i2 * 3 + ((t * 3) | 0);
					// the edges along this row: sea shore, rumble, road, the two lane lines
					e1 = sea ? cx - ww * shore : -1; e2 = cx - ww * 1.16; e3 = cx - ww; e4 = cx + ww; e5 = cx + ww * 1.16;
					for (xr = 0; xr < w; xr++) {
						if (xr < e1) { idx = ih(((xr - cx) / ww * 6) | 0, kz, 5) < 0.14 ? R_SEA1 + (((xr >> 2) + kz) & 1) : R_SEA0; }
						else if (xr < e2 || xr >= e5) { idx = gC; }
						else if (xr < e3 || xr >= e4) { idx = bC; }
						else {
							idx = rC;
							if (lane) { e6 = (xr - cx) / ww; if (Math.abs(Math.abs(e6) - 0.333) < 0.028 + 0.5 / ww) { idx = R_LANE; } }
						}
						px[o + xr] = LUT[(((f16 + BAY[b | (xr & 3)]) >> 4) << 6) | idx];
					}
				}
				maxy = Math.min(maxy, Math.max(0, Math.ceil(sy2 - 0.5)));
			}
			// between the sky and the furthest road (beyond the draw distance, or behind a crest): far ground in the haze
			var hzc = LUT[(3 << 6) | R_HAZE];
			for (y = Math.max(0, Math.min(h, Math.ceil(hz))); y < maxy; y++) { px.fill(hzc, y * w, y * w + w); }
			// roadside things and the other cars, furthest first, hidden behind rises
			// (only out to about 37 units: further off, a bend can sweep the road sideways along the horizon and its
			// roadside things would crowd into a fence there; they come in out of a dither instead)
			for (n = 150; n > 0; n--) {
				i2 = (base + n) % RN;
				if (SZ[n] < 0.6) { continue; }
				f16 = SZ[n] > 14 ? Math.min(47, ((SZ[n] - 14) * 1.05) | 0) : 0;
				fadeIn = n > 118 ? ((150 - n) / 2) | 0 : 16;
				// where the road is seen almost edge-on (looking down a long descent its far part folds into a thin band),
				// the things along it would line up into a fence: they thin out in a dither instead
				comp = (SY1[n - 1] - SY1[n]) * 4 * SZ[n] / FOC;
				fadeIn = Math.min(fadeIn, Math.max(0, Math.min(16, ((comp - 0.002) * 4000) | 0)));
				for (k = 0; k < NT; k++) {
					// a car on this segment
					l = TZ[k] - pos; if (l < (n - pct) * RSL || l >= (n + 1 - pct) * RSL) { continue; }
					var im = TCAR[TK[k]], scl2 = FOC * 0.42 / SZ[n] / im.h;
					clipBlit(F, im, SX1[n] + TX[k] * SW1[n], SY1[n], scl2, f16, SCL[n]);
				}
				if (!SP[i2]) { continue; }
				var im2 = SIDE[SP[i2] - 1], hgt = SIDEH[SP[i2] - 1], sc3 = FOC * hgt / SZ[n] / im2.h, sd = SPS[i2];
				if (sd === -1 || sd === 2) { clipBlit(F, im2, SX1[n] - SW1[n] * (1.5 + (SP[i2] & 1) * 0.5) - im2.w * sc3 * 0.1, SY1[n], sc3, f16, SCL[n], true); }
				if (sd === 1 || sd === 2) { clipBlit(F, im2, SX1[n] + SW1[n] * (1.5 + (SP[i2] & 1) * 0.5), SY1[n], sc3, f16, SCL[n], false); }
			}
			// the car, nearest of all, swaying through the bends
			fadeIn = 16;
			var ci = CAR[lean < -0.35 ? 0 : lean > 0.35 ? 2 : 1], cs = Math.max(1, Math.round(2 * V.U));
			// (anchored in the same picture as the road: on a thin strip, which shows the middle band, it is below the band)
			clipBlit(F, ci, cxs + (px0 - camXr) * FOC * 0.62, h + V.off - 4 * V.U + (S.motion ? Math.round(Math.sin(T * 9) * 0.4) : 0), cs, 0, h, false);
		}
		// a sprite standing with its foot at (ax, ay), scaled, hazed, and cut off below the row `clip` (a rise in front)
		var fadeIn = 16;
		function clipBlit(F, im, ax, ay, s, f16, clip, flip) {
			var px = F.px, seen, iw = im.w, ih2 = im.h, d = im.d, dw = iw * s, dh = ih2 * s, x0 = Math.max(0, Math.ceil(ax - dw / 2 - 0.5)), x1 = Math.min(w, Math.ceil(ax + dw / 2 - 0.5)), y0 = Math.max(0, Math.ceil(ay - dh - 0.5)), y1 = Math.min(h, clip, Math.ceil(ay - 0.5)), x, y, ix, iy, c, l2, inv = 1 / s, left = ax - dw / 2, top = ay - dh;
			if (s <= 0 || dh < 0.6) { return; }
			// a thing mostly hidden behind a rise comes into view in a dither rather than as a sliver along the crest
			seen = Math.min(fadeIn, ay - 0.5 > clip ? Math.max(0, Math.min(16, (((clip - top) / dh) * 40) | 0)) : 16);
			if (seen <= 0) { return; }
			for (y = y0; y < y1; y++) {
				iy = ((y + 0.5 - top) * inv) | 0; if (iy < 0 || iy >= ih2) { continue; }
				for (x = x0; x < x1; x++) {
					ix = ((x + 0.5 - left) * inv) | 0; if (ix < 0 || ix >= iw) { continue; }
					c = d[iy * iw + (flip ? iw - 1 - ix : ix)]; if (c === 255) { continue; }
					l2 = BAY[((y & 3) << 2) | (x & 3)];
					if (l2 >= seen) { continue; }
					l2 = (f16 + l2) >> 4;
					if (l2 >= NF - 1) { continue; }
					px[y * w + x] = LUT[(l2 << 6) | c];
				}
			}
		}
		return run(host, S, { resize: resize, step: step, draw: draw }, c1, c2);
	}
	K.addEngine({ id: "bit3d-road", label: "8-bit 3D: open road at sunset", colors: ROAD.coast.c, start: startRoad });

	// ================================================================ the template
	var SCENES = [["flyover", "Flight over islands"], ["dungeon", "Dungeon walk"], ["canyon", "Canyon run"], ["vector", "Vector space"], ["road", "Open road"]];
	var LOOKS = {
		flyover: { list: FLY, opts: [["day", "Sunny day"], ["sunset", "Sunset"], ["night", "Moonlit night"], ["snow", "Winter"]] },
		dungeon: { list: DUN, opts: [["torch", "Torch-lit stone"], ["crypt", "Mossy crypt, ghostly light"], ["ice", "Ice cave"], ["lava", "Fire halls"]] },
		canyon: { list: CAN, opts: [["sunset", "Sunset"], ["noon", "Midday sun"], ["night", "Moonlit night"], ["alien", "Alien world"]] },
		vector: { list: VEC, opts: [["neon", "Neon pink and blue"], ["green", "Green screen"], ["amber", "Amber screen"], ["ice", "Ice blue, ringed planet"]] },
		road: { list: ROAD, opts: [["coast", "Coast road at sunset"], ["city", "Night city"], ["desert", "Desert at noon"], ["snow", "Snowy pass"]] }
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
			{ name: "Flight over islands at sunset", tags: ["retro", "3d", "cozy", "summer"], values: { scene: "flyover", flyover: "sunset" } },
			{ name: "Night flight, moon on the sea", tags: ["retro", "3d", "cozy"], values: { scene: "flyover", flyover: "night" } },
			{ name: "Winter flight over snowy islands", tags: ["retro", "3d", "winter", "christmas"], values: { scene: "flyover", flyover: "snow" } },
			{ name: "Torch-lit dungeon walk", tags: ["retro", "3d", "gaming", "spooky"], values: { scene: "dungeon", dungeon: "torch" } },
			{ name: "Mossy crypt, ghostly light", tags: ["retro", "3d", "spooky", "halloween"], values: { scene: "dungeon", dungeon: "crypt" } },
			{ name: "Ice cave walk", tags: ["retro", "3d", "gaming", "winter"], values: { scene: "dungeon", dungeon: "ice" } },
			{ name: "Fire halls of the dungeon", tags: ["retro", "3d", "gaming", "spicy"], values: { scene: "dungeon", dungeon: "lava" } },
			{ name: "Canyon run at sunset", tags: ["retro", "3d", "gaming", "summer"], values: { scene: "canyon", canyon: "sunset" } },
			{ name: "Canyon run at midday", tags: ["retro", "3d", "gaming", "summer"], values: { scene: "canyon", canyon: "noon" } },
			{ name: "Canyon by moonlight", tags: ["retro", "3d", "cozy"], values: { scene: "canyon", canyon: "night" } },
			{ name: "Alien canyon, ringed sun", tags: ["retro", "3d", "cyber", "gaming"], values: { scene: "canyon", canyon: "alien" } },
			{ name: "Neon vector ride", tags: ["retro", "3d", "cyber", "gaming"], values: { scene: "vector", vector: "neon" } },
			{ name: "Green screen vector ride", tags: ["retro", "3d", "cyber", "simple"], values: { scene: "vector", vector: "green" } },
			{ name: "Amber screen vector ride", tags: ["retro", "3d", "cyber", "cozy"], values: { scene: "vector", vector: "amber" } },
			{ name: "Ice-blue vector space, ringed planet", tags: ["retro", "3d", "cyber", "elegant"], values: { scene: "vector", vector: "ice" } },
			{ name: "Coast road at sunset", tags: ["retro", "3d", "gaming", "summer"], values: { scene: "road", road: "coast" } },
			{ name: "Night city drive", tags: ["retro", "3d", "gaming", "cyber"], values: { scene: "road", road: "city" } },
			{ name: "Desert road at noon", tags: ["retro", "3d", "gaming", "summer"], values: { scene: "road", road: "desert" } },
			{ name: "Snowy mountain pass", tags: ["retro", "3d", "gaming", "winter"], values: { scene: "road", road: "snow" } },
			{ name: "Old TV: pink dusk flight, big pixels", tags: ["retro", "3d", "cozy", "cute"], values: { scene: "flyover", flyover: "sunset", c1: "22104a", c2: "ff7cc4", c3: "3a2c8c", pixels: "chunky", tube: true } },
			{ name: "Old TV: teal midnight drive, big pixels", tags: ["retro", "3d", "cyber", "cozy"], values: { scene: "road", road: "city", c1: "021a20", c2: "2cffd2", c3: "ff3c6c", pixels: "chunky", tube: true } }
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

	// The same five scenes behind the "Starting soon / BRB / ending" screens, each with its title where the picture is calm.
	K.addPresets("screen", [
		{ name: "8-bit 3D: flight over islands, starting soon", tags: ["retro", "3d", "gaming"], values: { backdrop: "bit3d-flyover", c1: FLY.day.c[0], c2: FLY.day.c[1], c3: FLY.day.c[2], title: "Starting soon", subtitle: "taking off in a moment", minutes: 5, layout: "top", font: "Press Start 2P", fontsize: 56, upper: true, fg: "ffffff", accent: "ffe066", dim: 0 } },
		{ name: "8-bit 3D: dungeon walk, be right back", tags: ["retro", "3d", "gaming", "spooky"], values: { backdrop: "bit3d-dungeon", c1: DUN.torch.c[0], c2: DUN.torch.c[1], c3: DUN.torch.c[2], title: "Be right back", subtitle: "exploring the dungeon", minutes: 0, layout: "center", font: "Silkscreen", fontsize: 72, upper: true, fg: "ffe9c2", accent: "ffad48", dim: 0 } },
		{ name: "8-bit 3D: canyon run, starting soon", tags: ["retro", "3d", "gaming"], values: { backdrop: "bit3d-canyon", c1: CAN.sunset.c[0], c2: CAN.sunset.c[1], c3: CAN.sunset.c[2], title: "Starting soon", subtitle: "flying in low", minutes: 5, layout: "top", font: "VT323", fontsize: 112, upper: true, fg: "fff1e0", accent: "fff4c8", dim: 0 } },
		{ name: "8-bit 3D: vector ride, starting soon", tags: ["retro", "3d", "cyber"], values: { backdrop: "bit3d-vector", c1: VEC.neon.c[0], c2: VEC.neon.c[1], c3: VEC.neon.c[2], title: "Starting soon", subtitle: "entering the grid", minutes: 5, layout: "top", font: "Press Start 2P", fontsize: 56, upper: true, fg: "ffffff", accent: "2ee6ff", dim: 0 } },
		{ name: "8-bit 3D: open road, thanks for watching", tags: ["retro", "3d", "gaming", "cozy"], values: { backdrop: "bit3d-road", c1: ROAD.coast.c[0], c2: ROAD.coast.c[1], c3: ROAD.coast.c[2], title: "Thanks for watching", subtitle: "see you down the road", minutes: 0, layout: "top", font: "Press Start 2P", fontsize: 42, upper: true, fg: "ffffff", accent: "ffd36b", dim: 0 } }
	]);
})();
